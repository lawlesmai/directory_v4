/**
 * Server-Side Authentication Utilities
 * Epic 2 Story 2.2: SSR-compatible authentication utilities
 * Provides comprehensive server-side authentication, session validation, and RBAC
 * Performance Goals: Auth checks < 50ms, Session validation < 15ms
 */

import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import type { Database } from '@/lib/supabase/database.types'
import type { User, Session } from '@supabase/supabase-js'

// Enhanced user type with comprehensive role and permission data
export interface ServerAuthUser extends User {
  roles: string[]
  permissions: string[]
  profile?: {
    username?: string
    display_name?: string
    avatar_url?: string
    email_verified?: boolean
    phone_verified?: boolean
    account_status?: string
    mfa_enabled?: boolean
    last_seen?: string
  }
  subscription?: {
    tier: string
    valid_until?: string
    features?: Record<string, any>
  }
  owned_businesses?: string[]
  session_info?: {
    device_fingerprint?: string
    last_activity?: string
    ip_address?: string
    user_agent?: string
  }
}

// Authentication result types
export interface AuthResult {
  user: ServerAuthUser | null
  session: Session | null
  error?: string
}

export interface PermissionCheck {
  hasPermission: boolean
  user?: ServerAuthUser
  requiredRole?: string
  requiredPermission?: string
}

/**
 * Create server-side Supabase client with proper SSR configuration
 * Uses @supabase/ssr package exclusively as required
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // This can happen when called from a Server Component
            // Server Components can't modify cookies
          }
        }
      },
      auth: {
        autoRefreshToken: true,
        persistSession: true
      }
    }
  )
}

/**
 * Get current authenticated user with comprehensive data
 * Cached for performance optimization within request lifecycle
 */
export const getServerUser = cache(async (): Promise<ServerAuthUser | null> => {
  const startTime = Date.now()
  
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get user from session
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return null
    }
    
    // Fetch extended user data in parallel for performance
    const [profileData, rolesData, businessData, sessionData] = await Promise.all([
      // User profile
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single(),
      
      // User roles and permissions
      supabase
        .from('user_roles')
        .select(`
          role:roles(
            name,
            display_name,
            permissions:role_permissions(
              permission:permissions(name, resource, action)
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true),
      
      // Owned businesses for business owner role
      supabase
        .from('businesses')
        .select('id, subscription_tier, subscription_valid_until, premium_features')
        .eq('owner_id', user.id)
        .eq('status', 'active'),
      
      // Current session info
      supabase
        .from('user_sessions')
        .select('device_fingerprint, last_activity, ip_address, user_agent')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
    ])
    
    // Process roles and permissions
    const roles = rolesData.data?.map(r => r.role?.name).filter(Boolean) || []
    const permissions = rolesData.data?.flatMap(r => 
      r.role?.permissions?.map(p => `${p.permission?.resource}:${p.permission?.action}`) || []
    ).filter(Boolean) || []
    
    // Build enhanced user object
    const serverUser: ServerAuthUser = {
      ...user,
      roles,
      permissions,
      profile: profileData.data ? {
        username: profileData.data.username,
        display_name: profileData.data.display_name,
        avatar_url: profileData.data.avatar_url,
        email_verified: profileData.data.email_verified,
        phone_verified: profileData.data.phone_verified,
        account_status: profileData.data.account_status,
        mfa_enabled: profileData.data.mfa_enabled,
        last_seen: profileData.data.last_seen
      } : undefined,
      subscription: businessData.data?.[0] ? {
        tier: businessData.data[0].subscription_tier || 'free',
        valid_until: businessData.data[0].subscription_valid_until,
        features: businessData.data[0].premium_features
      } : { tier: 'free' },
      owned_businesses: businessData.data?.map(b => b.id) || [],
      session_info: sessionData.data ? {
        device_fingerprint: sessionData.data.device_fingerprint,
        last_activity: sessionData.data.last_activity,
        ip_address: sessionData.data.ip_address,
        user_agent: sessionData.data.user_agent
      } : undefined
    }
    
    // Performance monitoring
    const processingTime = Date.now() - startTime
    if (processingTime > 50) {
      console.warn(`Slow auth check: ${processingTime}ms for user ${user.id}`)
    }
    
    return serverUser
  } catch (error) {
    console.error('Error getting server user:', error)
    return null
  }
})

/**
 * Get current session with validation
 * Cached for performance within request lifecycle
 */
export const getServerSession = cache(async (): Promise<Session | null> => {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('Error getting server session:', error)
      return null
    }
    
    return session
  } catch (error) {
    console.error('Error in getServerSession:', error)
    return null
  }
})

/**
 * Require authentication - redirect to login if not authenticated
 * Returns authenticated user or redirects
 */
export async function requireAuth(): Promise<ServerAuthUser> {
  const user = await getServerUser()
  
  if (!user) {
    const headersList = await headers()
    const pathname = headersList.get('x-pathname') || '/'
    redirect(`/auth/login?redirect=${encodeURIComponent(pathname)}`)
  }
  
  return user
}

/**
 * Require specific role - redirect if user doesn't have required role
 */
export async function requireRole(requiredRole: string | string[]): Promise<ServerAuthUser> {
  const user = await requireAuth()
  
  const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
  const hasRole = requiredRoles.some(role => user.roles.includes(role))
  
  if (!hasRole) {
    redirect('/unauthorized')
  }
  
  return user
}

/**
 * Require specific permission - redirect if user doesn't have permission
 */
export async function requirePermission(
  resource: string,
  action: string
): Promise<ServerAuthUser> {
  const user = await requireAuth()
  
  const permissionKey = `${resource}:${action}`
  const hasPermission = user.permissions.includes(permissionKey)
  
  if (!hasPermission) {
    redirect('/unauthorized')
  }
  
  return user
}

/**
 * Check if user has specific role (non-redirecting)
 */
export async function hasRole(roleName: string): Promise<PermissionCheck> {
  const user = await getServerUser()
  
  return {
    hasPermission: user?.roles.includes(roleName) || false,
    user,
    requiredRole: roleName
  }
}

/**
 * Check if user has specific permission (non-redirecting)
 */
export async function hasPermission(
  resource: string,
  action: string
): Promise<PermissionCheck> {
  const user = await getServerUser()
  const permissionKey = `${resource}:${action}`
  
  return {
    hasPermission: user?.permissions.includes(permissionKey) || false,
    user,
    requiredPermission: permissionKey
  }
}

/**
 * Get user from request headers (set by middleware)
 * Fast alternative when user data is already available in headers
 */
export async function getUserFromHeaders(): Promise<Partial<ServerAuthUser> | null> {
  try {
    const headersList = await headers()
    
    const userId = headersList.get('x-user-id')
    const userEmail = headersList.get('x-user-email')
    const userRoles = headersList.get('x-user-roles')
    const userPermissions = headersList.get('x-user-permissions')
    
    if (!userId) {
      return null
    }
    
    return {
      id: userId,
      email: userEmail || undefined,
      roles: userRoles ? JSON.parse(userRoles) : [],
      permissions: userPermissions ? JSON.parse(userPermissions) : []
    }
  } catch (error) {
    console.error('Error getting user from headers:', error)
    return null
  }
}

/**
 * Validate session and refresh if needed
 * Used in server actions and API routes
 */
export async function validateAndRefreshSession(): Promise<AuthResult> {
  const startTime = Date.now()
  
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return {
        user: null,
        session: null,
        error: 'No valid session'
      }
    }
    
    // Check if token needs refresh (within 10 minutes of expiry)
    const tokenExpiry = session.expires_at ? new Date(session.expires_at * 1000) : null
    const now = new Date()
    const tenMinutes = 10 * 60 * 1000
    
    if (tokenExpiry && (tokenExpiry.getTime() - now.getTime()) < tenMinutes) {
      // Refresh token
      const { data: { session: refreshedSession }, error: refreshError } = 
        await supabase.auth.refreshSession()
      
      if (refreshError) {
        console.error('Session refresh failed:', refreshError)
        return {
          user: null,
          session: null,
          error: 'Session refresh failed'
        }
      }
      
      if (refreshedSession) {
        session.access_token = refreshedSession.access_token
        session.refresh_token = refreshedSession.refresh_token
        session.expires_at = refreshedSession.expires_at
      }
    }
    
    // Get enhanced user data
    const user = await getServerUser()
    
    const processingTime = Date.now() - startTime
    if (processingTime > 15) {
      console.warn(`Slow session validation: ${processingTime}ms`)
    }
    
    return {
      user,
      session
    }
  } catch (error) {
    console.error('Session validation error:', error)
    return {
      user: null,
      session: null,
      error: error instanceof Error ? error.message : 'Session validation failed'
    }
  }
}

/**
 * Get business ownership for current user
 * Used for business-specific authorization
 */
export async function getUserBusinesses(): Promise<string[]> {
  const user = await getServerUser()
  
  if (!user) {
    return []
  }
  
  return user.owned_businesses || []
}

/**
 * Check if user owns specific business
 */
export async function ownsBusinessOrAdmin(businessId: string): Promise<boolean> {
  const user = await getServerUser()
  
  if (!user) {
    return false
  }
  
  // Admin and super_admin can access any business
  if (user.roles.includes('admin') || user.roles.includes('super_admin')) {
    return true
  }
  
  // Check if user owns the business
  return user.owned_businesses?.includes(businessId) || false
}

/**
 * Log authentication event for audit trail
 */
export async function logAuthEvent(
  eventType: string,
  success: boolean,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    const user = await getServerUser()
    const headersList = await headers()
    const supabase = await createServerSupabaseClient()
    
    await supabase.from('auth_audit_logs').insert({
      event_type: eventType,
      event_category: getEventCategory(eventType),
      user_id: user?.id || null,
      event_data: metadata,
      success,
      ip_address: headersList.get('x-forwarded-for') || 'unknown',
      user_agent: headersList.get('user-agent') || 'unknown'
    })
  } catch (error) {
    console.error('Failed to log auth event:', error)
  }
}

/**
 * Get event category for audit logs
 */
function getEventCategory(eventType: string): string {
  const categories: Record<string, string> = {
    'server_auth_check': 'authentication',
    'permission_check': 'authorization', 
    'role_check': 'authorization',
    'session_validation': 'session',
    'business_access': 'business',
    'admin_access': 'admin'
  }
  
  return categories[eventType] || 'other'
}

// Export types for use in other modules
export type { Database }