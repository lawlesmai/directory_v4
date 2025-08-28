/**
 * Authentication Server Utilities
 * Epic 2 Story 2.1: Server-side authentication functions
 * Provides authentication utilities for server context with SSR support
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/lib/supabase/database.types'
import { 
  hashPassword as secureHashPassword, 
  verifyPassword as secureVerifyPassword,
  validatePasswordStrength,
  generateSessionFingerprint,
  createSecurityEvent,
  getClientIP
} from '@/lib/security/server'

// Server authentication configuration
export const authConfig = {
  // Token lifetimes
  jwt_expiry: 3600, // 1 hour
  refresh_token_expiry: 604800, // 7 days
  
  // Security settings
  password_min_length: 12,
  password_require_uppercase: true,
  password_require_numbers: true,
  password_require_symbols: true,
  
  // Rate limiting
  max_login_attempts: 5,
  lockout_duration: 900, // 15 minutes
  
  // Session settings
  concurrent_sessions_limit: 5,
  session_timeout_minutes: 60,
  remember_me_duration_days: 30,
  
  // MFA settings
  mfa_enrollment_required: ['admin', 'business_owner'],
  mfa_grace_period_days: 7
}

/**
 * Create authenticated server client
 */
export async function createAuthServerClient() {
  const cookieStore = await cookies()
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

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
            // This happens when called from a Server Component
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
 * Create service role client for admin operations
 */
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!serviceRoleKey) {
    throw new Error('Service role key not configured')
  }

  return createServerClient<Database>(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      cookies: {
        getAll() { return [] },
        setAll() { }
      }
    }
  )
}

/**
 * Get authenticated user from request
 */
export async function getAuthUser(request?: NextRequest) {
  const supabase = await createAuthServerClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }

  // Fetch extended user data
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: userRoles } = await supabase
    .from('user_roles')
    .select(`
      roles (
        name,
        display_name
      )
    `)
    .eq('user_id', user.id)
    .eq('is_active', true)

  const roles = userRoles?.map((r: any) => r.roles?.name).filter(Boolean) || []
  
  return {
    ...user,
    profile,
    roles,
    isAdmin: roles.includes('admin') || roles.includes('super_admin'),
    isBusinessOwner: roles.includes('business_owner'),
    isModerator: roles.includes('moderator')
  }
}

/**
 * Require authentication middleware
 */
export async function requireAuth(request: NextRequest) {
  const user = await getAuthUser(request)
  
  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
  
  return user
}

/**
 * Require specific role middleware
 */
export async function requireRole(request: NextRequest, role: string) {
  const user = await getAuthUser(request)
  
  if (!user || !user.roles.includes(role)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 403 }
    )
  }
  
  return user
}

/**
 * Check rate limit for action
 */
export async function checkRateLimit(
  identifier: string,
  action: string,
  maxAttempts: number = 10,
  windowMinutes: number = 60
) {
  const supabase = createServiceRoleClient()
  
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_identifier: identifier,
    p_identifier_type: 'ip',
    p_action: action,
    p_max_attempts: maxAttempts,
    p_window_minutes: windowMinutes
  } as any)
  
  if (error) {
    console.error('Rate limit check failed:', error)
    return false
  }
  
  return data
}

/**
 * Log authentication event
 */
export async function logAuthEvent(
  eventType: string,
  userId: string | null,
  success: boolean,
  metadata: Record<string, any> = {}
) {
  try {
    const supabase = createServiceRoleClient()
    
    await (supabase as any).from('auth_audit_logs').insert({
      event_type: eventType,
      event_category: getEventCategory(eventType),
      user_id: userId,
      event_data: metadata,
      success,
      ip_address: metadata.ip_address,
      user_agent: metadata.user_agent
    })
  } catch (error) {
    console.error('Failed to log auth event:', error)
  }
}

/**
 * Get event category from event type
 */
function getEventCategory(eventType: string): string {
  const categories: Record<string, string> = {
    'user_login': 'login',
    'user_logout': 'logout',
    'user_registered': 'registration',
    'password_reset': 'password',
    'password_changed': 'password',
    'mfa_enabled': 'mfa',
    'mfa_verified': 'mfa',
    'mfa_failed': 'mfa',
    'role_assigned': 'permission',
    'role_revoked': 'permission'
  }
  
  return categories[eventType] || 'other'
}

// Password validation is now handled by the security module

/**
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  const array = new Uint8Array(length)
  
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array)
  } else {
    // Server-side
    const crypto = require('crypto')
    crypto.randomFillSync(array)
  }
  
  for (let i = 0; i < length; i++) {
    token += chars[array[i] % chars.length]
  }
  
  return token
}

/**
 * Hash password using secure Argon2id hashing
 * Replaces basic SHA-256 with industry-standard password hashing
 * Fixes Critical Security Issue: CVSS 8.7 - Missing Password Hashing
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  const result = await secureHashPassword(plainPassword)
  return typeof result === 'string' ? result : result.hash
}

/**
 * Verify password against secure hash
 * Uses constant-time comparison to prevent timing attacks
 */
export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  const result = await secureVerifyPassword(plainPassword, hashedPassword)
  return typeof result === 'boolean' ? result : result.isValid
}

/**
 * Hash sensitive data (kept for backwards compatibility)
 */
export async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  
  if (typeof window !== 'undefined' && window.crypto) {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  } else {
    // Server-side
    const crypto = require('crypto')
    return crypto.createHash('sha256').update(data).digest('hex')
  }
}

/**
 * Verify user permissions
 */
export async function verifyPermission(
  userId: string,
  resource: string,
  action: string
): Promise<boolean> {
  const supabase = await createAuthServerClient()
  
  const { data, error } = await supabase.rpc('user_has_permission', {
    check_user_id: userId,
    resource,
    action
  } as any)
  
  if (error) {
    console.error('Permission check failed:', error)
    return false
  }
  
  return data || false
}

/**
 * Create secure session
 */
export async function createSecureSession(
  userId: string,
  deviceInfo: Record<string, any> = {}
) {
  const supabase = createServiceRoleClient()
  
  const { data, error } = await supabase.rpc('create_user_session', {
    p_user_id: userId,
    p_device_info: deviceInfo,
    p_ip_address: deviceInfo.ip_address,
    p_user_agent: deviceInfo.user_agent
  } as any)
  
  if (error) {
    throw error
  }
  
  return data
}

/**
 * Invalidate user sessions
 */
export async function invalidateUserSessions(
  userId: string,
  exceptSessionId?: string
) {
  const supabase = createServiceRoleClient()
  
  const query = supabase
    .from('user_sessions')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
      revoke_reason: 'manual_invalidation'
    })
    .eq('user_id', userId)
    .eq('is_active', true)
  
  if (exceptSessionId) {
    query.neq('id', exceptSessionId)
  }
  
  const { error } = await query
  
  if (error) {
    throw error
  }
}

// Export types
export type { Database }
