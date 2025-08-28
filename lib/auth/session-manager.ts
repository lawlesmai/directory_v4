/**
 * Session Management System
 * Epic 2 Story 2.2: Comprehensive session management and monitoring
 * Handles token refresh, device tracking, session cleanup, concurrent sessions
 * Performance Goals: Session validation < 15ms, Cleanup operations optimized
 */

import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { createServiceRoleClient } from '@/lib/auth/server'
import { 
  generateSessionFingerprint, 
  getClientIP,
  createSecurityEvent 
} from '@/lib/security/server'
import type { Database } from '@/lib/supabase/database.types'
import type { User, Session } from '@supabase/supabase-js'

// Session configuration
export const SESSION_CONFIG = {
  // Session timeouts
  DEFAULT_TIMEOUT: 2 * 60 * 60 * 1000,      // 2 hours
  EXTENDED_TIMEOUT: 30 * 24 * 60 * 60 * 1000, // 30 days for "remember me"
  REFRESH_THRESHOLD: 10 * 60 * 1000,          // Refresh within 10 minutes of expiry
  
  // Concurrent sessions
  MAX_CONCURRENT_SESSIONS: 5,
  CLEANUP_INTERVAL: 15 * 60 * 1000,           // 15 minutes
  
  // Device tracking
  TRACK_DEVICE_CHANGES: true,
  REQUIRE_REVERIFICATION_ON_NEW_DEVICE: true,
  
  // Geographic monitoring
  TRACK_LOCATION_CHANGES: true,
  SUSPICIOUS_LOCATION_THRESHOLD: 1000, // km
  
  // Security monitoring
  ENABLE_SESSION_MONITORING: true,
  LOG_SESSION_EVENTS: true
} as const

// Enhanced session info
export interface SessionInfo {
  id: string
  user_id: string
  device_fingerprint: string
  ip_address: string
  user_agent: string
  location?: {
    country?: string
    region?: string
    city?: string
    latitude?: number
    longitude?: number
  }
  created_at: string
  last_activity: string
  expires_at?: string
  is_active: boolean
  revoked_at?: string
  revoke_reason?: string
}

// Session management result types
export interface SessionResult {
  success: boolean
  session?: SessionInfo
  error?: string
  requiresReauth?: boolean
  securityAlert?: boolean
}

export interface DeviceInfo {
  fingerprint: string
  ip_address: string
  user_agent: string
  platform?: string
  browser?: string
  location?: {
    country?: string
    region?: string
    city?: string
  }
}

/**
 * Session Manager Class
 * Handles all session lifecycle operations
 */
export class SessionManager {
  private supabase: Awaited<ReturnType<typeof createServerClient>>
  private serviceClient = createServiceRoleClient()

  constructor(supabaseClient?: Awaited<ReturnType<typeof createServerClient>>) {
    this.supabase = supabaseClient || this.createClient()
  }

  private async createClient() {
    const cookieStore = await cookies()
    
    return createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
              // Server Component context - can't modify cookies
            }
          }
        }
      }
    )
  }

  /**
   * Create new session with comprehensive tracking
   */
  async createSession(
    user: User,
    deviceInfo: DeviceInfo,
    rememberMe: boolean = false
  ): Promise<SessionResult> {
    try {
      const sessionId = crypto.randomUUID()
      const now = new Date()
      const expiresAt = new Date(
        now.getTime() + (rememberMe ? SESSION_CONFIG.EXTENDED_TIMEOUT : SESSION_CONFIG.DEFAULT_TIMEOUT)
      )

      // Check concurrent session limit
      const existingSessions = await this.getActiveSessions(user.id)
      
      if (existingSessions.length >= SESSION_CONFIG.MAX_CONCURRENT_SESSIONS) {
        // Revoke oldest session
        const oldestSession = existingSessions.sort(
          (a, b) => new Date(a.last_activity).getTime() - new Date(b.last_activity).getTime()
        )[0]
        
        await this.revokeSession(oldestSession.id, 'concurrent_limit_exceeded')
      }

      // Get location info if available
      const location = await this.getLocationFromIP(deviceInfo.ip_address)

      // Create session record
      const sessionData: Partial<SessionInfo> = {
        id: sessionId,
        user_id: user.id,
        device_fingerprint: deviceInfo.fingerprint,
        ip_address: deviceInfo.ip_address,
        user_agent: deviceInfo.user_agent,
        location,
        created_at: now.toISOString(),
        last_activity: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        is_active: true
      }

      const { error } = await this.serviceClient
        .from('user_sessions')
        .insert([sessionData])

      if (error) {
        console.error('Failed to create session:', error)
        return { success: false, error: 'Session creation failed' }
      }

      // Log session creation event
      await this.logSessionEvent('session_created', user.id, {
        session_id: sessionId,
        device_info: deviceInfo,
        remember_me: rememberMe,
        location
      })

      return {
        success: true,
        session: sessionData as SessionInfo
      }
    } catch (error) {
      console.error('Session creation error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Session creation failed'
      }
    }
  }

  /**
   * Validate existing session
   */
  async validateSession(sessionId?: string): Promise<SessionResult> {
    const startTime = Date.now()
    
    try {
      if (!this.supabase) {
        this.supabase = await this.createClient()
      }

      const { data: { session }, error: sessionError } = await this.supabase.auth.getSession()
      
      if (sessionError || !session) {
        return { success: false, error: 'No valid session' }
      }

      // Get session from database
      const { data: dbSession, error: dbError } = await this.serviceClient
        .from('user_sessions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .order('last_activity', { ascending: false })
        .limit(1)
        .single()

      if (dbError || !dbSession) {
        return { success: false, error: 'Session not found in database' }
      }

      // Check if session has expired
      if (dbSession.expires_at && new Date(dbSession.expires_at) < new Date()) {
        await this.revokeSession(dbSession.id, 'expired')
        return { success: false, error: 'Session expired' }
      }

      // Validate device fingerprint for security
      const headersList = await headers()
      const currentFingerprint = generateSessionFingerprint({
        headers: headersList,
        // Mock NextRequest structure for compatibility
        nextUrl: { pathname: '' },
        cookies: { getAll: () => [] }
      } as any)

      if (SESSION_CONFIG.TRACK_DEVICE_CHANGES && 
          dbSession.device_fingerprint !== currentFingerprint) {
        
        // Potential security issue
        await this.logSecurityEvent('device_fingerprint_mismatch', session.user.id, {
          stored_fingerprint: dbSession.device_fingerprint,
          current_fingerprint: currentFingerprint,
          session_id: dbSession.id
        })

        if (SESSION_CONFIG.REQUIRE_REVERIFICATION_ON_NEW_DEVICE) {
          await this.revokeSession(dbSession.id, 'device_change_detected')
          return {
            success: false,
            error: 'Device change detected',
            requiresReauth: true,
            securityAlert: true
          }
        }
      }

      // Update last activity
      await this.updateSessionActivity(dbSession.id)

      const processingTime = Date.now() - startTime
      if (processingTime > 15) {
        console.warn(`Slow session validation: ${processingTime}ms for session ${dbSession.id}`)
      }

      return {
        success: true,
        session: dbSession as SessionInfo
      }
    } catch (error) {
      console.error('Session validation error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Session validation failed'
      }
    }
  }

  /**
   * Refresh session tokens automatically
   */
  async refreshSession(): Promise<SessionResult> {
    try {
      if (!this.supabase) {
        this.supabase = await this.createClient()
      }

      const { data: { session }, error: sessionError } = await this.supabase.auth.getSession()
      
      if (sessionError || !session) {
        return { success: false, error: 'No session to refresh' }
      }

      // Check if refresh is needed
      const expiresAt = session.expires_at ? new Date(session.expires_at * 1000) : null
      const now = new Date()
      
      if (!expiresAt || (expiresAt.getTime() - now.getTime()) > SESSION_CONFIG.REFRESH_THRESHOLD) {
        return { success: true, session: await this.getSessionInfo(session.user.id) }
      }

      // Refresh the session
      const { data: { session: refreshedSession }, error: refreshError } = 
        await this.supabase.auth.refreshSession()

      if (refreshError || !refreshedSession) {
        await this.logSessionEvent('refresh_failed', session.user.id, {
          error: refreshError?.message,
          original_expires_at: expiresAt.toISOString()
        })
        
        return { success: false, error: 'Session refresh failed' }
      }

      // Update session in database
      await this.updateSessionActivity(session.user.id)

      // Log successful refresh
      await this.logSessionEvent('session_refreshed', session.user.id, {
        old_expires_at: expiresAt.toISOString(),
        new_expires_at: new Date(refreshedSession.expires_at! * 1000).toISOString()
      })

      return {
        success: true,
        session: await this.getSessionInfo(session.user.id)
      }
    } catch (error) {
      console.error('Session refresh error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Session refresh failed'
      }
    }
  }

  /**
   * Get all active sessions for user
   */
  async getActiveSessions(userId: string): Promise<SessionInfo[]> {
    try {
      const { data: sessions, error } = await this.serviceClient
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_activity', { ascending: false })

      if (error) {
        console.error('Failed to get active sessions:', error)
        return []
      }

      return sessions as SessionInfo[]
    } catch (error) {
      console.error('Get active sessions error:', error)
      return []
    }
  }

  /**
   * Revoke specific session
   */
  async revokeSession(sessionId: string, reason: string = 'manual_revoke'): Promise<boolean> {
    try {
      const { error } = await this.serviceClient
        .from('user_sessions')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoke_reason: reason
        })
        .eq('id', sessionId)

      if (error) {
        console.error('Failed to revoke session:', error)
        return false
      }

      // Log revocation
      await this.logSessionEvent('session_revoked', null, {
        session_id: sessionId,
        reason
      })

      return true
    } catch (error) {
      console.error('Session revocation error:', error)
      return false
    }
  }

  /**
   * Revoke all sessions for user except current
   */
  async revokeAllSessions(
    userId: string, 
    exceptSessionId?: string, 
    reason: string = 'revoke_all'
  ): Promise<number> {
    try {
      let query = this.serviceClient
        .from('user_sessions')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoke_reason: reason
        })
        .eq('user_id', userId)
        .eq('is_active', true)

      if (exceptSessionId) {
        query = query.neq('id', exceptSessionId)
      }

      const { data, error } = await query.select()

      if (error) {
        console.error('Failed to revoke all sessions:', error)
        return 0
      }

      // Log mass revocation
      await this.logSessionEvent('sessions_mass_revoked', userId, {
        revoked_count: data?.length || 0,
        except_session_id: exceptSessionId,
        reason
      })

      return data?.length || 0
    } catch (error) {
      console.error('Mass session revocation error:', error)
      return 0
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const now = new Date()
      
      const { data, error } = await this.serviceClient
        .from('user_sessions')
        .update({
          is_active: false,
          revoked_at: now.toISOString(),
          revoke_reason: 'expired'
        })
        .lt('expires_at', now.toISOString())
        .eq('is_active', true)
        .select()

      if (error) {
        console.error('Failed to cleanup expired sessions:', error)
        return 0
      }

      const cleanedCount = data?.length || 0
      
      if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} expired sessions`)
      }

      return cleanedCount
    } catch (error) {
      console.error('Session cleanup error:', error)
      return 0
    }
  }

  /**
   * Update session activity timestamp
   */
  private async updateSessionActivity(sessionIdOrUserId: string): Promise<void> {
    try {
      // Try to update by session ID first, then by user ID
      const { error } = await this.serviceClient
        .from('user_sessions')
        .update({ last_activity: new Date().toISOString() })
        .or(`id.eq.${sessionIdOrUserId},user_id.eq.${sessionIdOrUserId}`)
        .eq('is_active', true)

      if (error) {
        console.error('Failed to update session activity:', error)
      }
    } catch (error) {
      console.error('Update session activity error:', error)
    }
  }

  /**
   * Get session info by user ID
   */
  private async getSessionInfo(userId: string): Promise<SessionInfo | undefined> {
    try {
      const { data: session, error } = await this.serviceClient
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_activity', { ascending: false })
        .limit(1)
        .single()

      if (error || !session) {
        return undefined
      }

      return session as SessionInfo
    } catch (error) {
      console.error('Get session info error:', error)
      return undefined
    }
  }

  /**
   * Get approximate location from IP address
   */
  private async getLocationFromIP(ipAddress: string): Promise<any> {
    // This would typically integrate with a geolocation service
    // For now, return a placeholder
    try {
      // Example integration point for IP geolocation service
      // const response = await fetch(`https://ipapi.co/${ipAddress}/json/`)
      // const data = await response.json()
      // return { country: data.country, region: data.region, city: data.city }
      
      return {
        country: 'Unknown',
        region: 'Unknown',
        city: 'Unknown'
      }
    } catch (error) {
      console.error('IP location lookup error:', error)
      return null
    }
  }

  /**
   * Log session-related events
   */
  private async logSessionEvent(
    eventType: string, 
    userId: string | null, 
    metadata: Record<string, any>
  ): Promise<void> {
    if (!SESSION_CONFIG.LOG_SESSION_EVENTS) return

    try {
      const headersList = await headers()
      
      await this.serviceClient.from('auth_audit_logs').insert([{
        event_type: eventType,
        event_category: 'session',
        user_id: userId,
        event_data: metadata,
        success: true,
        ip_address: headersList.get('x-forwarded-for') || 'unknown',
        user_agent: headersList.get('user-agent') || 'unknown'
      }])
    } catch (error) {
      console.error('Failed to log session event:', error)
    }
  }

  /**
   * Log security events
   */
  private async logSecurityEvent(
    eventType: string,
    userId: string,
    details: Record<string, any>
  ): Promise<void> {
    try {
      const headersList = await headers()
      
      await this.serviceClient.from('security_events').insert([{
        event_type: eventType,
        severity: 'high',
        user_id: userId,
        description: `Session security event: ${eventType}`,
        details,
        ip_address: headersList.get('x-forwarded-for') || 'unknown',
        user_agent: headersList.get('user-agent') || 'unknown'
      }])
    } catch (error) {
      console.error('Failed to log security event:', error)
    }
  }
}

// Export singleton instance
export const sessionManager = new SessionManager()

// Utility functions for common session operations
export async function getCurrentSession(): Promise<SessionInfo | null> {
  const result = await sessionManager.validateSession()
  return result.success ? result.session || null : null
}

export async function refreshCurrentSession(): Promise<boolean> {
  const result = await sessionManager.refreshSession()
  return result.success
}

export async function revokeCurrentSession(): Promise<boolean> {
  const session = await getCurrentSession()
  if (!session) return false
  
  return await sessionManager.revokeSession(session.id)
}

export async function revokeAllOtherSessions(): Promise<number> {
  const session = await getCurrentSession()
  if (!session) return 0
  
  return await sessionManager.revokeAllSessions(session.user_id, session.id)
}

// Background cleanup function (should be called periodically)
export async function cleanupExpiredSessions(): Promise<number> {
  return await sessionManager.cleanupExpiredSessions()
}

// Types are already exported via their interface declarations above