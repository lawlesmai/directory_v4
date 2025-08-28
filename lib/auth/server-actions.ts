/**
 * Server Actions Authentication Utilities
 * Epic 2 Story 2.2: Authentication-protected server actions
 * Provides wrapper functions and utilities for secure server actions
 * Performance Goals: Auth checks < 50ms, Validation < 15ms
 */

'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { 
  getServerUser, 
  requireAuth, 
  requireRole, 
  requirePermission,
  hasRole,
  hasPermission,
  validateAndRefreshSession,
  logAuthEvent,
  type ServerAuthUser 
} from '@/lib/auth/server-utils'
import { sessionManager } from '@/lib/auth/session-manager'
import { createServiceRoleClient } from '@/lib/auth/server'

// Action result types
export interface ActionResult<T = any> {
  success: boolean
  data?: T
  error?: string
  fieldErrors?: Record<string, string[]>
  redirect?: string
  revalidate?: string | string[]
}

// Action context with user info
export interface ActionContext {
  user: ServerAuthUser
  permissions: string[]
  roles: string[]
  sessionId?: string
}

// Authentication wrapper options
export interface AuthWrapperOptions {
  requireAuth?: boolean
  requiredRole?: string | string[]
  requiredPermission?: { resource: string; action: string }
  rateLimit?: { maxAttempts: number; windowMinutes: number }
  validateSession?: boolean
  logEvent?: string
}

/**
 * Authentication wrapper for server actions
 * Provides consistent auth checking across all server actions
 */
export function withAuth<TInput, TOutput>(
  action: (input: TInput, context: ActionContext) => Promise<ActionResult<TOutput>>,
  options: AuthWrapperOptions = {}
): (input: TInput) => Promise<ActionResult<TOutput>> {
  return async (input: TInput): Promise<ActionResult<TOutput>> => {
    const startTime = Date.now()
    
    try {
      // Validate session if required
      if (options.validateSession) {
        const sessionResult = await validateAndRefreshSession()
        if (!sessionResult.user) {
          return {
            success: false,
            error: 'Session validation failed',
            redirect: '/auth/login'
          }
        }
      }

      // Get authenticated user
      let user: ServerAuthUser | null = null
      
      if (options.requireAuth !== false) {
        user = await getServerUser()
        
        if (!user) {
          return {
            success: false,
            error: 'Authentication required',
            redirect: '/auth/login'
          }
        }
      }

      // Role-based access control
      if (options.requiredRole && user) {
        const roles = Array.isArray(options.requiredRole) 
          ? options.requiredRole 
          : [options.requiredRole]
        
        const hasRequiredRole = roles.some(role => user.roles.includes(role))
        
        if (!hasRequiredRole) {
          await logAuthEvent('unauthorized_action_attempt', false, {
            action: action.name,
            required_roles: roles,
            user_roles: user.roles,
            user_id: user.id
          })
          
          return {
            success: false,
            error: 'Insufficient permissions',
            redirect: '/unauthorized'
          }
        }
      }

      // Permission-based access control
      if (options.requiredPermission && user) {
        const { resource, action: permAction } = options.requiredPermission
        const permissionKey = `${resource}:${permAction}`
        
        if (!user.permissions.includes(permissionKey)) {
          await logAuthEvent('unauthorized_permission_attempt', false, {
            action: action.name,
            required_permission: permissionKey,
            user_permissions: user.permissions,
            user_id: user.id
          })
          
          return {
            success: false,
            error: 'Permission denied',
            redirect: '/unauthorized'
          }
        }
      }

      // Rate limiting
      if (options.rateLimit && user) {
        const { maxAttempts, windowMinutes } = options.rateLimit
        const supabase = createServiceRoleClient()
        
        const { data: rateLimitOk } = await supabase.rpc('check_rate_limit', {
          p_identifier: user.id,
          p_identifier_type: 'user',
          p_action: `action:${action.name}`,
          p_max_attempts: maxAttempts,
          p_window_minutes: windowMinutes
        } as any)

        if (!rateLimitOk) {
          return {
            success: false,
            error: `Rate limit exceeded. Try again in ${windowMinutes} minutes.`
          }
        }
      }

      // Build context
      const context: ActionContext = {
        user: user!,
        permissions: user?.permissions || [],
        roles: user?.roles || [],
        sessionId: user?.session_info?.device_fingerprint
      }

      // Log action attempt
      if (options.logEvent && user) {
        await logAuthEvent(options.logEvent, true, {
          action: action.name,
          user_id: user.id,
          input: typeof input === 'object' ? JSON.stringify(input) : String(input)
        })
      }

      // Execute the action
      const result = await action(input, context)

      // Performance monitoring
      const processingTime = Date.now() - startTime
      if (processingTime > 1000) {
        console.warn(`Slow server action: ${action.name} took ${processingTime}ms`)
      }

      return result
    } catch (error) {
      console.error(`Server action error in ${action.name}:`, error)
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      }
    }
  }
}

/**
 * Validation wrapper for server actions with Zod schema
 */
export function withValidation<TInput, TOutput>(
  schema: z.ZodSchema<TInput>,
  action: (input: TInput, context: ActionContext) => Promise<ActionResult<TOutput>>
): (input: unknown, context: ActionContext) => Promise<ActionResult<TOutput>> {
  return async (input: unknown, context: ActionContext): Promise<ActionResult<TOutput>> => {
    try {
      // Validate input
      const validatedInput = schema.parse(input)
      
      return await action(validatedInput, context)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors = error.flatten().fieldErrors
        const cleanedFieldErrors: Record<string, string[]> = {}
        
        // Filter out undefined values
        Object.entries(fieldErrors).forEach(([key, value]) => {
          if (value) {
            cleanedFieldErrors[key] = value
          }
        })
        
        return {
          success: false,
          error: 'Validation failed',
          fieldErrors: cleanedFieldErrors
        }
      }
      
      return {
        success: false,
        error: 'Validation error'
      }
    }
  }
}

/**
 * Combined auth and validation wrapper
 */
export function withAuthAndValidation<TInput, TOutput>(
  schema: z.ZodSchema<TInput>,
  action: (input: TInput, context: ActionContext) => Promise<ActionResult<TOutput>>,
  authOptions: AuthWrapperOptions = {}
): (input: unknown) => Promise<ActionResult<TOutput>> {
  const validatedAction = withValidation(schema, action)
  const authAction = withAuth(
    (input: unknown, context: ActionContext) => validatedAction(input, context),
    authOptions
  )
  
  return authAction
}

// Common server actions with authentication

/**
 * Update user profile action
 */
const updateProfileSchema = z.object({
  username: z.string().min(3).max(30).optional(),
  display_name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatar_url: z.string().url().optional()
})

export const updateUserProfile = withAuthAndValidation(
  updateProfileSchema,
  async (input, context): Promise<ActionResult> => {
    try {
      const supabase = createServiceRoleClient()
      
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...input,
          updated_at: new Date().toISOString()
        })
        .eq('id', context.user.id)
        .select()
        .single()

      if (error) {
        return {
          success: false,
          error: 'Failed to update profile'
        }
      }

      revalidatePath('/profile')
      revalidateTag(`user-profile-${context.user.id}`)

      return {
        success: true,
        data
      }
    } catch (error) {
      return {
        success: false,
        error: 'Profile update failed'
      }
    }
  },
  { 
    requireAuth: true,
    logEvent: 'profile_updated',
    rateLimit: { maxAttempts: 10, windowMinutes: 60 }
  }
)

/**
 * Change password action
 */
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
  confirmPassword: z.string().min(8)
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
})

export const changePassword = withAuthAndValidation(
  changePasswordSchema,
  async (input, context): Promise<ActionResult> => {
    try {
      // Verify current password first
      const { verifyPassword } = await import('@/lib/security/server')
      
      // Get current password hash
      const supabase = createServiceRoleClient()
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('password_hash')
        .eq('id', context.user.id)
        .single()

      if (profileError || !profile?.password_hash) {
        return {
          success: false,
          error: 'Unable to verify current password'
        }
      }

      const isCurrentPasswordValid = await verifyPassword(input.currentPassword, profile.password_hash)
      
      if (!isCurrentPasswordValid) {
        return {
          success: false,
          fieldErrors: {
            currentPassword: ['Current password is incorrect']
          }
        }
      }

      // Hash new password
      const { hashPassword } = await import('@/lib/security/server')
      const newPasswordHash = await hashPassword(input.newPassword)

      // Update password
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          password_hash: newPasswordHash,
          password_changed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', context.user.id)

      if (updateError) {
        return {
          success: false,
          error: 'Failed to update password'
        }
      }

      // Revoke all other sessions for security
      await sessionManager.revokeAllSessions(context.user.id, context.sessionId, 'password_changed')

      // Log password change
      await logAuthEvent('password_changed', true, {
        user_id: context.user.id,
        forced_logout_other_sessions: true
      })

      return {
        success: true,
        data: { message: 'Password changed successfully' }
      }
    } catch (error) {
      return {
        success: false,
        error: 'Password change failed'
      }
    }
  },
  {
    requireAuth: true,
    validateSession: true,
    logEvent: 'password_change_attempt',
    rateLimit: { maxAttempts: 5, windowMinutes: 60 }
  }
)

/**
 * Business management actions
 */
const updateBusinessSchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  hours: z.record(z.string()).optional()
})

export const updateBusiness = withAuthAndValidation(
  updateBusinessSchema,
  async (input, context): Promise<ActionResult> => {
    try {
      const { businessId, ...updates } = input
      
      // Check if user owns this business or is admin
      const supabase = createServiceRoleClient()
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('id, owner_id')
        .eq('id', businessId)
        .single()

      if (businessError || !business) {
        return {
          success: false,
          error: 'Business not found'
        }
      }

      const canEdit = business.owner_id === context.user.id || 
                     context.roles.includes('admin') || 
                     context.roles.includes('super_admin')

      if (!canEdit) {
        return {
          success: false,
          error: 'Not authorized to edit this business'
        }
      }

      // Update business
      const { data, error } = await supabase
        .from('businesses')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', businessId)
        .select()
        .single()

      if (error) {
        return {
          success: false,
          error: 'Failed to update business'
        }
      }

      revalidatePath(`/business/${businessId}`)
      revalidateTag(`business-${businessId}`)

      return {
        success: true,
        data
      }
    } catch (error) {
      return {
        success: false,
        error: 'Business update failed'
      }
    }
  },
  {
    requireAuth: true,
    requiredRole: ['business_owner', 'admin', 'super_admin'],
    logEvent: 'business_updated',
    rateLimit: { maxAttempts: 20, windowMinutes: 60 }
  }
)

/**
 * Admin actions
 */
const manageUserSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(['suspend', 'activate', 'delete']),
  reason: z.string().min(10).max(500)
})

export const manageUser = withAuthAndValidation(
  manageUserSchema,
  async (input, context): Promise<ActionResult> => {
    try {
      const { userId, action, reason } = input
      
      const supabase = createServiceRoleClient()
      
      let updateData: any = {
        updated_at: new Date().toISOString()
      }

      switch (action) {
        case 'suspend':
          updateData.account_status = 'suspended'
          updateData.suspended_at = new Date().toISOString()
          updateData.suspension_reason = reason
          break
        case 'activate':
          updateData.account_status = 'active'
          updateData.suspended_at = null
          updateData.suspension_reason = null
          break
        case 'delete':
          updateData.account_status = 'deleted'
          updateData.deleted_at = new Date().toISOString()
          updateData.deletion_reason = reason
          break
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single()

      if (error) {
        return {
          success: false,
          error: `Failed to ${action} user`
        }
      }

      // Revoke all sessions for suspended/deleted users
      if (action === 'suspend' || action === 'delete') {
        await sessionManager.revokeAllSessions(userId, undefined, action)
      }

      // Log admin action
      await logAuthEvent('admin_user_management', true, {
        target_user_id: userId,
        action,
        reason,
        admin_id: context.user.id
      })

      revalidateTag(`user-${userId}`)

      return {
        success: true,
        data
      }
    } catch (error) {
      return {
        success: false,
        error: 'User management action failed'
      }
    }
  },
  {
    requireAuth: true,
    requiredRole: ['admin', 'super_admin'],
    logEvent: 'admin_action_attempted',
    rateLimit: { maxAttempts: 50, windowMinutes: 60 }
  }
)

/**
 * Session management actions
 */
export const revokeSession = withAuth(
  async (sessionId: string, context): Promise<ActionResult> => {
    try {
      const success = await sessionManager.revokeSession(sessionId, 'user_revoked')
      
      if (!success) {
        return {
          success: false,
          error: 'Failed to revoke session'
        }
      }

      revalidatePath('/profile/sessions')

      return {
        success: true,
        data: { message: 'Session revoked successfully' }
      }
    } catch (error) {
      return {
        success: false,
        error: 'Session revocation failed'
      }
    }
  },
  {
    requireAuth: true,
    logEvent: 'session_revoked_by_user',
    rateLimit: { maxAttempts: 10, windowMinutes: 60 }
  }
)

export const revokeAllOtherSessions = withAuth(
  async (_input: void, context): Promise<ActionResult> => {
    try {
      const revokedCount = await sessionManager.revokeAllSessions(
        context.user.id,
        context.sessionId,
        'user_revoked_all'
      )

      revalidatePath('/profile/sessions')

      return {
        success: true,
        data: { 
          message: `${revokedCount} sessions revoked successfully`,
          revokedCount 
        }
      }
    } catch (error) {
      return {
        success: false,
        error: 'Failed to revoke sessions'
      }
    }
  },
  {
    requireAuth: true,
    logEvent: 'all_other_sessions_revoked',
    rateLimit: { maxAttempts: 5, windowMinutes: 60 }
  }
)

// Types are already exported via their interface declarations above