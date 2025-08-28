/**
 * Session Monitoring and Cleanup System
 * Epic 2 Story 2.2: Comprehensive session monitoring, cleanup, and security
 * Handles automated cleanup, suspicious activity detection, geographic monitoring
 * Performance Goals: Background processes optimized, minimal impact on user experience
 */

import { createServiceRoleClient } from '@/lib/auth/server'
import { sessionManager, SESSION_CONFIG } from '@/lib/auth/session-manager'
import type { SessionInfo } from '@/lib/auth/session-manager'

// Monitoring configuration
export const MONITORING_CONFIG = {
  // Cleanup intervals
  EXPIRED_SESSIONS_INTERVAL: 15 * 60 * 1000,    // 15 minutes
  INACTIVE_SESSIONS_INTERVAL: 60 * 60 * 1000,    // 1 hour
  SECURITY_SCAN_INTERVAL: 5 * 60 * 1000,         // 5 minutes
  
  // Thresholds
  INACTIVE_SESSION_THRESHOLD: 24 * 60 * 60 * 1000, // 24 hours
  SUSPICIOUS_LOGIN_ATTEMPTS: 5,                      // per 30 minutes
  MAX_CONCURRENT_SESSIONS_PER_IP: 10,
  GEOGRAPHIC_CHANGE_THRESHOLD: 1000, // km
  
  // Alerts
  ENABLE_SECURITY_ALERTS: true,
  ALERT_WEBHOOK_URL: process.env.SECURITY_ALERT_WEBHOOK,
  
  // Retention
  AUDIT_LOG_RETENTION_DAYS: 90,
  SESSION_LOG_RETENTION_DAYS: 30,
  SECURITY_EVENT_RETENTION_DAYS: 365
} as const

// Monitoring result types
export interface MonitoringResult {
  timestamp: Date
  sessionsProcessed: number
  sessionsRevoked: number
  securityEventsDetected: number
  errors: string[]
}

export interface SecurityAlert {
  severity: 'low' | 'medium' | 'high' | 'critical'
  type: string
  description: string
  affectedUsers: string[]
  details: Record<string, any>
  timestamp: Date
}

export interface SessionAnalytics {
  totalActiveSessions: number
  uniqueUsers: number
  averageSessionDuration: number
  topCountries: Array<{ country: string; count: number }>
  topDevices: Array<{ device: string; count: number }>
  suspiciousActivity: SecurityAlert[]
}

/**
 * Session Monitoring Service
 * Handles all background monitoring and cleanup operations
 */
export class SessionMonitoringService {
  private supabase = createServiceRoleClient()
  private isRunning = false
  private intervals: NodeJS.Timeout[] = []

  /**
   * Start all monitoring processes
   */
  async startMonitoring(): Promise<void> {
    if (this.isRunning) {
      console.warn('Session monitoring is already running')
      return
    }

    this.isRunning = true
    console.log('Starting session monitoring service...')

    // Start cleanup intervals
    this.intervals.push(
      setInterval(() => {
        this.cleanupExpiredSessions().catch(console.error)
      }, MONITORING_CONFIG.EXPIRED_SESSIONS_INTERVAL)
    )

    this.intervals.push(
      setInterval(() => {
        this.cleanupInactiveSessions().catch(console.error)
      }, MONITORING_CONFIG.INACTIVE_SESSIONS_INTERVAL)
    )

    this.intervals.push(
      setInterval(() => {
        this.performSecurityScan().catch(console.error)
      }, MONITORING_CONFIG.SECURITY_SCAN_INTERVAL)
    )

    // Perform initial cleanup
    await this.performInitialCleanup()
  }

  /**
   * Stop all monitoring processes
   */
  stopMonitoring(): void {
    if (!this.isRunning) {
      return
    }

    console.log('Stopping session monitoring service...')
    this.intervals.forEach(interval => clearInterval(interval))
    this.intervals = []
    this.isRunning = false
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<MonitoringResult> {
    const startTime = Date.now()
    const result: MonitoringResult = {
      timestamp: new Date(),
      sessionsProcessed: 0,
      sessionsRevoked: 0,
      securityEventsDetected: 0,
      errors: []
    }

    try {
      const now = new Date()
      
      // Find expired sessions
      const { data: expiredSessions, error: selectError } = await this.supabase
        .from('user_sessions')
        .select('id, user_id, created_at')
        .eq('is_active', true)
        .lt('expires_at', now.toISOString())

      if (selectError) {
        result.errors.push(`Failed to fetch expired sessions: ${selectError.message}`)
        return result
      }

      result.sessionsProcessed = expiredSessions?.length || 0

      if (expiredSessions && expiredSessions.length > 0) {
        // Revoke expired sessions
        const { error: updateError } = await this.supabase
          .from('user_sessions')
          .update({
            is_active: false,
            revoked_at: now.toISOString(),
            revoke_reason: 'expired'
          })
          .in('id', expiredSessions.map((s: any) => s.id))

        if (updateError) {
          result.errors.push(`Failed to revoke expired sessions: ${updateError.message}`)
        } else {
          result.sessionsRevoked = expiredSessions.length
          
          // Log cleanup event
          await this.logSystemEvent('expired_sessions_cleanup', {
            sessions_revoked: result.sessionsRevoked,
            processing_time_ms: Date.now() - startTime
          })
        }
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`Cleanup error: ${errorMessage}`)
      console.error('Expired sessions cleanup error:', error)
      return result
    }
  }

  /**
   * Clean up inactive sessions
   */
  async cleanupInactiveSessions(): Promise<MonitoringResult> {
    const result: MonitoringResult = {
      timestamp: new Date(),
      sessionsProcessed: 0,
      sessionsRevoked: 0,
      securityEventsDetected: 0,
      errors: []
    }

    try {
      const inactiveThreshold = new Date(
        Date.now() - MONITORING_CONFIG.INACTIVE_SESSION_THRESHOLD
      )

      // Find inactive sessions
      const { data: inactiveSessions, error: selectError } = await this.supabase
        .from('user_sessions')
        .select('id, user_id, last_activity')
        .eq('is_active', true)
        .lt('last_activity', inactiveThreshold.toISOString())

      if (selectError) {
        result.errors.push(`Failed to fetch inactive sessions: ${selectError.message}`)
        return result
      }

      result.sessionsProcessed = inactiveSessions?.length || 0

      if (inactiveSessions && inactiveSessions.length > 0) {
        // Revoke inactive sessions
        const { error: updateError } = await this.supabase
          .from('user_sessions')
          .update({
            is_active: false,
            revoked_at: new Date().toISOString(),
            revoke_reason: 'inactive'
          })
          .in('id', inactiveSessions.map((s: any) => s.id))

        if (updateError) {
          result.errors.push(`Failed to revoke inactive sessions: ${updateError.message}`)
        } else {
          result.sessionsRevoked = inactiveSessions.length

          // Log cleanup event
          await this.logSystemEvent('inactive_sessions_cleanup', {
            sessions_revoked: result.sessionsRevoked,
            inactive_threshold_hours: MONITORING_CONFIG.INACTIVE_SESSION_THRESHOLD / (60 * 60 * 1000)
          })
        }
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`Inactive cleanup error: ${errorMessage}`)
      console.error('Inactive sessions cleanup error:', error)
      return result
    }
  }

  /**
   * Perform security scan for suspicious activities
   */
  async performSecurityScan(): Promise<MonitoringResult> {
    const result: MonitoringResult = {
      timestamp: new Date(),
      sessionsProcessed: 0,
      sessionsRevoked: 0,
      securityEventsDetected: 0,
      errors: []
    }

    try {
      // Check for suspicious activities
      await Promise.all([
        this.detectMultipleFailedLogins(result),
        this.detectSuspiciousIPActivity(result),
        this.detectGeographicAnomalies(result),
        this.detectConcurrentSessionAbusePerUser(result)
      ])

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`Security scan error: ${errorMessage}`)
      console.error('Security scan error:', error)
      return result
    }
  }

  /**
   * Detect multiple failed login attempts
   */
  private async detectMultipleFailedLogins(result: MonitoringResult): Promise<void> {
    try {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)

      const { data: failedAttempts, error } = await this.supabase
        .from('auth_audit_logs')
        .select('ip_address, user_id, created_at')
        .eq('event_type', 'user_login')
        .eq('success', false)
        .gte('created_at', thirtyMinutesAgo.toISOString())

      if (error || !failedAttempts) return

      // Group by IP address
      const attemptsByIP = failedAttempts.reduce((acc: any, attempt: any) => {
        const ip = attempt.ip_address || 'unknown'
        if (!acc[ip]) acc[ip] = []
        acc[ip].push(attempt)
        return acc
      }, {} as Record<string, typeof failedAttempts>)

      // Check for IPs with too many failed attempts
      for (const [ip, attempts] of Object.entries(attemptsByIP)) {
        const attemptList = attempts as any[]
        if (attemptList.length >= MONITORING_CONFIG.SUSPICIOUS_LOGIN_ATTEMPTS) {
          const alert: SecurityAlert = {
            severity: 'high',
            type: 'multiple_failed_logins',
            description: `${attemptList.length} failed login attempts from IP ${ip} in the last 30 minutes`,
            affectedUsers: [...new Set(attemptList.map((a: any) => a.user_id).filter(Boolean))],
            details: {
              ip_address: ip,
              attempt_count: attemptList.length,
              time_window: '30 minutes',
              affected_users: attemptList.length
            },
            timestamp: new Date()
          }

          await this.createSecurityAlert(alert)
          result.securityEventsDetected++

          // Consider temporarily blocking this IP
          await this.temporarilyBlockIP(ip, 'multiple_failed_logins', 60) // 60 minutes
        }
      }
    } catch (error) {
      console.error('Failed login detection error:', error)
    }
  }

  /**
   * Detect suspicious IP activity
   */
  private async detectSuspiciousIPActivity(result: MonitoringResult): Promise<void> {
    try {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

      // Check for IPs with too many concurrent sessions
      const { data: ipSessions, error } = await this.supabase
        .rpc('get_sessions_by_ip', {
          since_timestamp: oneHourAgo.toISOString()
        } as any)

      if (error || !ipSessions) return

      for (const ipData of ipSessions as any[]) {
        if (ipData.session_count > MONITORING_CONFIG.MAX_CONCURRENT_SESSIONS_PER_IP) {
          const alert: SecurityAlert = {
            severity: 'medium',
            type: 'suspicious_ip_activity',
            description: `IP ${ipData.ip_address} has ${ipData.session_count} concurrent sessions`,
            affectedUsers: ipData.user_ids || [],
            details: {
              ip_address: ipData.ip_address,
              session_count: ipData.session_count,
              max_allowed: MONITORING_CONFIG.MAX_CONCURRENT_SESSIONS_PER_IP,
              unique_users: ipData.unique_users
            },
            timestamp: new Date()
          }

          await this.createSecurityAlert(alert)
          result.securityEventsDetected++
        }
      }
    } catch (error) {
      console.error('Suspicious IP detection error:', error)
    }
  }

  /**
   * Detect geographic anomalies
   */
  private async detectGeographicAnomalies(result: MonitoringResult): Promise<void> {
    try {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)

      // Get recent sessions with location data
      const { data: recentSessions, error } = await this.supabase
        .from('user_sessions')
        .select('user_id, location, created_at, ip_address')
        .gte('created_at', sixHoursAgo.toISOString())
        .not('location', 'is', null)

      if (error || !recentSessions) return

      // Group by user to detect rapid location changes
      const sessionsByUser = recentSessions.reduce((acc: any, session: any) => {
        if (!acc[session.user_id]) acc[session.user_id] = []
        acc[session.user_id].push(session)
        return acc
      }, {} as Record<string, typeof recentSessions>)

      for (const [userId, sessions] of Object.entries(sessionsByUser)) {
        const sessionList = sessions as any[]
        if (sessionList.length < 2) continue

        // Sort by timestamp
        sessionList.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

        // Check for rapid geographic changes
        for (let i = 1; i < sessionList.length; i++) {
          const prevSession = sessionList[i - 1]
          const currentSession = sessionList[i]
          
          if (prevSession.location && currentSession.location) {
            const distance = this.calculateDistance(prevSession.location, currentSession.location)
            const timeDiff = new Date(currentSession.created_at).getTime() - 
                            new Date(prevSession.created_at).getTime()
            
            // If moved more than threshold distance in less than 2 hours
            if (distance > MONITORING_CONFIG.GEOGRAPHIC_CHANGE_THRESHOLD && timeDiff < 2 * 60 * 60 * 1000) {
              const alert: SecurityAlert = {
                severity: 'high',
                type: 'geographic_anomaly',
                description: `User ${userId} moved ${distance}km in ${Math.round(timeDiff / 60000)} minutes`,
                affectedUsers: [userId],
                details: {
                  user_id: userId,
                  distance_km: distance,
                  time_minutes: Math.round(timeDiff / 60000),
                  previous_location: prevSession.location,
                  current_location: currentSession.location,
                  previous_ip: prevSession.ip_address,
                  current_ip: currentSession.ip_address
                },
                timestamp: new Date()
              }

              await this.createSecurityAlert(alert)
              result.securityEventsDetected++
            }
          }
        }
      }
    } catch (error) {
      console.error('Geographic anomaly detection error:', error)
    }
  }

  /**
   * Detect users with excessive concurrent sessions
   */
  private async detectConcurrentSessionAbusePerUser(result: MonitoringResult): Promise<void> {
    try {
      const { data: userSessions, error } = await this.supabase
        .rpc('get_concurrent_sessions_by_user') as any

      if (error || !userSessions) return

      for (const userData of userSessions) {
        if (userData.session_count > SESSION_CONFIG.MAX_CONCURRENT_SESSIONS * 2) {
          const alert: SecurityAlert = {
            severity: 'medium',
            type: 'concurrent_session_abuse',
            description: `User ${userData.user_id} has ${userData.session_count} concurrent sessions`,
            affectedUsers: [userData.user_id],
            details: {
              user_id: userData.user_id,
              session_count: userData.session_count,
              max_allowed: SESSION_CONFIG.MAX_CONCURRENT_SESSIONS,
              different_ips: userData.unique_ips,
              different_devices: userData.unique_devices
            },
            timestamp: new Date()
          }

          await this.createSecurityAlert(alert)
          result.securityEventsDetected++

          // Auto-revoke oldest sessions if count is excessive
          if (userData.session_count > SESSION_CONFIG.MAX_CONCURRENT_SESSIONS * 3) {
            await sessionManager.revokeAllSessions(
              userData.user_id, 
              undefined, 
              'excessive_concurrent_sessions'
            )
          }
        }
      }
    } catch (error) {
      console.error('Concurrent session abuse detection error:', error)
    }
  }

  /**
   * Get session analytics
   */
  async getSessionAnalytics(): Promise<SessionAnalytics> {
    try {
      const [activeSessionsData, analyticsData] = await Promise.all([
        this.supabase
          .from('user_sessions')
          .select('user_id, created_at, location, user_agent')
          .eq('is_active', true),
        
        this.supabase
          .rpc('get_session_analytics') as any
      ])

      const activeSessions = activeSessionsData.data || []
      const analytics = analyticsData.data || {}

      return {
        totalActiveSessions: activeSessions.length,
        uniqueUsers: new Set(activeSessions.map((s: any) => s.user_id)).size,
        averageSessionDuration: analytics.avg_duration || 0,
        topCountries: this.aggregateByLocation(activeSessions),
        topDevices: this.aggregateByDevice(activeSessions),
        suspiciousActivity: await this.getRecentSecurityAlerts()
      }
    } catch (error) {
      console.error('Session analytics error:', error)
      return {
        totalActiveSessions: 0,
        uniqueUsers: 0,
        averageSessionDuration: 0,
        topCountries: [],
        topDevices: [],
        suspiciousActivity: []
      }
    }
  }

  /**
   * Perform initial cleanup on service start
   */
  private async performInitialCleanup(): Promise<void> {
    console.log('Performing initial session cleanup...')
    
    const [expiredResult, inactiveResult] = await Promise.all([
      this.cleanupExpiredSessions(),
      this.cleanupInactiveSessions()
    ])

    const totalRevoked = expiredResult.sessionsRevoked + inactiveResult.sessionsRevoked
    
    if (totalRevoked > 0) {
      console.log(`Initial cleanup completed: ${totalRevoked} sessions revoked`)
    }
  }

  /**
   * Create security alert
   */
  private async createSecurityAlert(alert: SecurityAlert): Promise<void> {
    try {
      await this.supabase.from('security_events').insert([{
        event_type: alert.type,
        severity: alert.severity,
        user_id: alert.affectedUsers[0] || null,
        description: alert.description,
        details: alert.details
      }])

      // Send webhook notification if configured
      if (MONITORING_CONFIG.ALERT_WEBHOOK_URL && 
          (alert.severity === 'high' || alert.severity === 'critical')) {
        await this.sendWebhookAlert(alert)
      }
    } catch (error) {
      console.error('Failed to create security alert:', error)
    }
  }

  /**
   * Send webhook notification for critical alerts
   */
  private async sendWebhookAlert(alert: SecurityAlert): Promise<void> {
    try {
      if (!MONITORING_CONFIG.ALERT_WEBHOOK_URL) return

      const response = await fetch(MONITORING_CONFIG.ALERT_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          severity: alert.severity,
          type: alert.type,
          description: alert.description,
          affected_users: alert.affectedUsers.length,
          timestamp: alert.timestamp.toISOString(),
          details: alert.details
        })
      })

      if (!response.ok) {
        console.error('Webhook alert failed:', response.statusText)
      }
    } catch (error) {
      console.error('Webhook alert error:', error)
    }
  }

  /**
   * Log system events
   */
  private async logSystemEvent(eventType: string, details: Record<string, any>): Promise<void> {
    try {
      await this.supabase.from('system_events').insert([{
        event_type: eventType,
        event_category: 'session_management',
        details,
        created_at: new Date().toISOString()
      }])
    } catch (error) {
      console.error('Failed to log system event:', error)
    }
  }

  /**
   * Temporarily block IP address
   */
  private async temporarilyBlockIP(
    ipAddress: string, 
    reason: string, 
    durationMinutes: number
  ): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000)
      
      await this.supabase.from('blocked_ips').insert([{
        ip_address: ipAddress,
        reason,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      }])
    } catch (error) {
      console.error('Failed to block IP:', error)
    }
  }

  /**
   * Calculate distance between two geographic points
   */
  private calculateDistance(loc1: any, loc2: any): number {
    if (!loc1?.latitude || !loc1?.longitude || !loc2?.latitude || !loc2?.longitude) {
      return 0
    }

    const R = 6371 // Earth's radius in km
    const dLat = this.toRad(loc2.latitude - loc1.latitude)
    const dLon = this.toRad(loc2.longitude - loc1.longitude)
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(loc1.latitude)) * Math.cos(this.toRad(loc2.latitude)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2)
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  /**
   * Aggregate sessions by location
   */
  private aggregateByLocation(sessions: any[]): Array<{ country: string; count: number }> {
    const counts: Record<string, number> = {}
    
    sessions.forEach(session => {
      const country = session.location?.country || 'Unknown'
      counts[country] = (counts[country] || 0) + 1
    })

    return Object.entries(counts)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }

  /**
   * Aggregate sessions by device
   */
  private aggregateByDevice(sessions: any[]): Array<{ device: string; count: number }> {
    const counts: Record<string, number> = {}
    
    sessions.forEach(session => {
      const device = this.extractDeviceFromUserAgent(session.user_agent) || 'Unknown'
      counts[device] = (counts[device] || 0) + 1
    })

    return Object.entries(counts)
      .map(([device, count]) => ({ device, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }

  private extractDeviceFromUserAgent(userAgent: string): string {
    if (!userAgent) return 'Unknown'
    
    if (userAgent.includes('Mobile')) return 'Mobile'
    if (userAgent.includes('Tablet')) return 'Tablet'
    if (userAgent.includes('Chrome')) return 'Desktop Chrome'
    if (userAgent.includes('Firefox')) return 'Desktop Firefox'
    if (userAgent.includes('Safari')) return 'Desktop Safari'
    
    return 'Desktop Other'
  }

  /**
   * Get recent security alerts
   */
  private async getRecentSecurityAlerts(): Promise<SecurityAlert[]> {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      
      const { data: alerts, error } = await this.supabase
        .from('security_events')
        .select('*')
        .gte('created_at', twentyFourHoursAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(50)

      if (error || !alerts) return []

      return alerts.map((alert: any) => ({
        severity: alert.severity as SecurityAlert['severity'],
        type: alert.event_type,
        description: alert.description,
        affectedUsers: alert.user_id ? [alert.user_id] : [],
        details: alert.details || {},
        timestamp: new Date(alert.created_at)
      }))
    } catch (error) {
      console.error('Get security alerts error:', error)
      return []
    }
  }
}

// Export singleton instance
export const sessionMonitoring = new SessionMonitoringService()

// Background process management
let monitoringProcess: SessionMonitoringService | null = null

/**
 * Start session monitoring (should be called once on app startup)
 */
export async function startSessionMonitoring(): Promise<void> {
  if (!monitoringProcess) {
    monitoringProcess = new SessionMonitoringService()
    await monitoringProcess.startMonitoring()
  }
}

/**
 * Stop session monitoring
 */
export function stopSessionMonitoring(): void {
  if (monitoringProcess) {
    monitoringProcess.stopMonitoring()
    monitoringProcess = null
  }
}

/**
 * Get current monitoring status
 */
export function getMonitoringStatus(): { running: boolean; uptime?: number } {
  return {
    running: monitoringProcess !== null
  }
}

