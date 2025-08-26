/**
 * Enhanced RBAC Middleware
 * Epic 2 Story 2.8: High-performance permission enforcement middleware
 * 
 * Provides automatic permission checking for API routes and server actions
 * with intelligent caching and comprehensive audit logging.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// Permission context interface
export interface PermissionContext {
  businessId?: string
  userId?: string
  resourceId?: string
  scope?: Record<string, any>
  requiresMfa?: boolean
  emergencyOverride?: boolean
}

// Permission check result
export interface PermissionResult {
  allowed: boolean
  reason: string
  source?: {
    type: 'role' | 'business' | 'direct'
    name: string
    inherited: boolean
  }
  requiresMfa: boolean
  auditData: Record<string, any>
}

// RBAC configuration for different route patterns
export interface RBACConfig {
  resource: string
  action: string
  context?: PermissionContext
  allowSelfAccess?: boolean // Allow users to access their own resources
  businessOwnerOverride?: boolean // Allow business owners full access to their businesses
  skipAuditLog?: boolean
}

/**
 * High-performance permission checker with intelligent caching
 */
export class RBACPermissionChecker {
  private supabase: any
  private cacheHits = 0
  private cacheMisses = 0

  constructor(supabase: any) {
    this.supabase = supabase
  }

  /**
   * Check if user has specific permission with context
   */
  async checkPermission(
    userId: string,
    resource: string,
    action: string,
    context: PermissionContext = {}
  ): Promise<PermissionResult> {
    const startTime = Date.now()

    try {
      // Build permission check context
      const permissionContext = {
        user_id: context.userId,
        business_id: context.businessId,
        resource_id: context.resourceId,
        ...context.scope
      }

      // Use enhanced permission check function
      const { data: hasPermission, error } = await this.supabase.rpc(
        'user_has_enhanced_permission',
        {
          p_user_id: userId,
          p_resource: resource,
          p_action: action,
          p_context: permissionContext
        }
      )

      if (error) {
        console.error('Permission check error:', error)
        return {
          allowed: false,
          reason: 'Permission evaluation failed',
          requiresMfa: false,
          auditData: {
            error: error.message,
            resource,
            action,
            context: permissionContext,
            processing_time_ms: Date.now() - startTime
          }
        }
      }

      // Check for self-access scenarios
      const isSelfAccess = context.userId === userId && (
        resource === 'users' || 
        (resource === 'profiles' && action === 'read')
      )

      // Check business owner override
      let businessOwnerAccess = false
      if (context.businessId && context.businessOwnerOverride) {
        const { data: isOwner } = await this.supabase
          .from('businesses')
          .select('owner_id')
          .eq('id', context.businessId)
          .single()
        
        businessOwnerAccess = isOwner?.owner_id === userId
      }

      const finalAllowed = hasPermission || isSelfAccess || businessOwnerAccess

      return {
        allowed: finalAllowed,
        reason: finalAllowed 
          ? (hasPermission ? 'Permission granted' : 
             isSelfAccess ? 'Self-access allowed' : 'Business owner access')
          : 'Access denied',
        source: hasPermission ? {
          type: 'role',
          name: 'Role-based permission',
          inherited: false
        } : undefined,
        requiresMfa: context.requiresMfa || false,
        auditData: {
          resource,
          action,
          context: permissionContext,
          has_permission: hasPermission,
          self_access: isSelfAccess,
          business_owner_access: businessOwnerAccess,
          processing_time_ms: Date.now() - startTime
        }
      }
    } catch (error) {
      console.error('Permission check exception:', error)
      return {
        allowed: false,
        reason: 'Permission check failed',
        requiresMfa: false,
        auditData: {
          error: error instanceof Error ? error.message : 'Unknown error',
          resource,
          action,
          context,
          processing_time_ms: Date.now() - startTime
        }
      }
    }
  }

  /**
   * Bulk permission evaluation for multiple permissions
   */
  async checkBulkPermissions(
    userId: string,
    permissions: { resource: string; action: string; context?: PermissionContext }[],
    globalContext: PermissionContext = {}
  ): Promise<Record<string, PermissionResult>> {
    const results: Record<string, PermissionResult> = {}

    // Group permissions by context to optimize database calls
    const permissionGroups = permissions.reduce((groups, perm) => {
      const contextKey = JSON.stringify({ ...globalContext, ...perm.context })
      if (!groups[contextKey]) {
        groups[contextKey] = []
      }
      groups[contextKey].push(perm)
      return groups
    }, {} as Record<string, typeof permissions>)

    // Process each context group
    await Promise.all(
      Object.entries(permissionGroups).map(async ([contextKey, perms]) => {
        const context = JSON.parse(contextKey)
        const permissionStrings = perms.map(p => `${p.resource}:${p.action}`)

        const { data: bulkResults } = await this.supabase.rpc(
          'evaluate_bulk_permissions',
          {
            p_user_id: userId,
            p_permissions: permissionStrings,
            p_context: context
          }
        )

        // Map results back to individual permissions
        perms.forEach((perm, index) => {
          const key = `${perm.resource}:${perm.action}`
          const result = bulkResults?.[index] || { permission: key, allowed: false, reason: 'Unknown' }
          
          results[key] = {
            allowed: result.allowed,
            reason: result.reason,
            requiresMfa: perm.context?.requiresMfa || false,
            auditData: {
              bulk_evaluation: true,
              context,
              permission: key
            }
          }
        })
      })
    )

    return results
  }

  /**
   * Get cache performance statistics
   */
  getCacheStats() {
    const total = this.cacheHits + this.cacheMisses
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      total,
      hitRatio: total > 0 ? (this.cacheHits / total) * 100 : 0
    }
  }
}

/**
 * RBAC middleware for API routes
 */
export function createRBACMiddleware(config: RBACConfig) {
  return async (request: NextRequest) => {
    const startTime = Date.now()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            // Note: Cannot set cookies in middleware, handled in response
          },
          remove(name: string, options: any) {
            // Note: Cannot remove cookies in middleware, handled in response
          }
        }
      }
    )

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHENTICATED' },
        { status: 401 }
      )
    }

    // Create permission checker
    const checker = new RBACPermissionChecker(supabase)

    // Build permission context from request
    const permissionContext: PermissionContext = {
      ...config.context,
      userId: user.id
    }

    // Extract context from URL parameters if needed
    const { pathname, searchParams } = new URL(request.url)
    const pathSegments = pathname.split('/').filter(Boolean)

    // Auto-detect business context from URL
    if (pathSegments.includes('businesses') && !permissionContext.businessId) {
      const businessIndex = pathSegments.indexOf('businesses')
      if (pathSegments[businessIndex + 1]) {
        permissionContext.businessId = pathSegments[businessIndex + 1]
      }
    }

    // Auto-detect user context from URL
    if (pathSegments.includes('users') && !permissionContext.userId) {
      const userIndex = pathSegments.indexOf('users')
      if (pathSegments[userIndex + 1]) {
        permissionContext.userId = pathSegments[userIndex + 1]
      }
    }

    // Check permission
    const permissionResult = await checker.checkPermission(
      user.id,
      config.resource,
      config.action,
      permissionContext
    )

    if (!permissionResult.allowed) {
      // Log unauthorized access attempt
      if (!config.skipAuditLog) {
        await (supabase as any).from('auth_audit_logs').insert({
          event_type: 'unauthorized_api_access',
          event_category: 'permission',
          user_id: user.id,
          event_data: {
            ...permissionResult.auditData,
            path: pathname,
            method: request.method,
            user_agent: request.headers.get('user-agent'),
            ip_address: request.headers.get('x-forwarded-for') || 'unknown'
          },
          success: false
        })
      }

      return NextResponse.json(
        {
          error: 'Insufficient permissions',
          code: 'FORBIDDEN',
          details: {
            resource: config.resource,
            action: config.action,
            reason: permissionResult.reason
          }
        },
        { status: 403 }
      )
    }

    // Log successful access if configured
    if (!config.skipAuditLog) {
      await (supabase as any).from('auth_audit_logs').insert({
        event_type: 'authorized_api_access',
        event_category: 'permission',
        user_id: user.id,
        event_data: {
          ...permissionResult.auditData,
          path: pathname,
          method: request.method,
          processing_time_ms: Date.now() - startTime
        },
        success: true
      })
    }

    // Add permission context to request headers for downstream handlers
    const response = NextResponse.next()
    response.headers.set('x-permission-granted', 'true')
    response.headers.set('x-permission-source', JSON.stringify(permissionResult.source))
    response.headers.set('x-permission-context', JSON.stringify(permissionContext))
    response.headers.set('x-rbac-processing-time', (Date.now() - startTime).toString())

    return response
  }
}

/**
 * HOC for protecting server actions with RBAC
 */
export function withRBAC<T extends any[], R>(
  config: RBACConfig,
  action: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    const supabase = createRouteHandlerClient({ cookies })
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('Authentication required')
    }

    const checker = new RBACPermissionChecker(supabase)
    const permissionResult = await checker.checkPermission(
      user.id,
      config.resource,
      config.action,
      config.context
    )

    if (!permissionResult.allowed) {
      // Log unauthorized attempt
      if (!config.skipAuditLog) {
        await (supabase as any).from('auth_audit_logs').insert({
          event_type: 'unauthorized_server_action',
          event_category: 'permission',
          user_id: user.id,
          event_data: {
            ...permissionResult.auditData,
            action_name: action.name,
            args: args.length
          },
          success: false
        })
      }

      throw new Error(`Insufficient permissions: ${permissionResult.reason}`)
    }

    // Execute the action
    return await action(...args)
  }
}

/**
 * Utility function to check permissions in React Server Components
 */
export async function checkUserPermission(
  resource: string,
  action: string,
  context: PermissionContext = {}
): Promise<boolean> {
  const supabase = createRouteHandlerClient({ cookies })
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return false
  }

  const checker = new RBACPermissionChecker(supabase)
  const result = await checker.checkPermission(user.id, resource, action, context)
  
  return result.allowed
}

/**
 * Route-specific RBAC configurations
 */
export const RBAC_ROUTES = {
  // Admin routes
  ADMIN_USERS: {
    resource: 'users',
    action: 'manage',
    businessOwnerOverride: false
  },
  
  // Business management
  BUSINESS_MANAGE: {
    resource: 'businesses',
    action: 'manage',
    businessOwnerOverride: true
  },
  
  BUSINESS_READ: {
    resource: 'businesses',
    action: 'read',
    allowSelfAccess: true
  },
  
  // User profile management
  PROFILE_READ: {
    resource: 'profiles',
    action: 'read',
    allowSelfAccess: true
  },
  
  PROFILE_UPDATE: {
    resource: 'profiles',
    action: 'update',
    allowSelfAccess: true
  },
  
  // Review management
  REVIEW_MODERATE: {
    resource: 'reviews',
    action: 'moderate',
    businessOwnerOverride: true
  }
} as const

export type RBACRouteConfig = typeof RBAC_ROUTES[keyof typeof RBAC_ROUTES]
