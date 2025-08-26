/**
 * Security Audit Logging and Monitoring System
 * Epic 2 Story 2.7: User Profile Management & Preferences Infrastructure
 * 
 * Comprehensive security monitoring with threat detection,
 * audit logging, and real-time alerting for profile operations.
 */

import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

// Type definitions
export interface SecurityEvent {
  id?: string
  eventType: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  userId?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  requestId?: string
  description: string
  details: any
  actionTaken?: string
  resolved?: boolean
  resolvedBy?: string
  resolvedAt?: string
  resolutionNotes?: string
  occurredAt: string
  detectedAt: string
  reportedAt?: string
}

export interface ThreatPattern {
  id: string
  name: string
  description: string
  pattern: RegExp | ((event: SecurityEvent) => boolean)
  severity: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
  threshold?: number
  timeWindow?: number // seconds
}

export interface AuditLogEntry {
  id?: string
  eventType: string
  eventCategory: string
  userId?: string
  targetUserId?: string
  sessionId?: string
  eventData: any
  success: boolean
  failureReason?: string
  ipAddress?: string
  userAgent?: string
  createdAt: string
}

export interface SecurityMetrics {
  totalEvents: number
  criticalEvents: number
  highSeverityEvents: number
  mediumSeverityEvents: number
  lowSeverityEvents: number
  resolvedEvents: number
  unresolvedEvents: number
  averageResolutionTime: number
  topThreatTypes: Array<{ type: string; count: number }>
  recentActivity: SecurityEvent[]
}

export interface MonitoringAlert {
  id: string
  alertType: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  triggeredBy: SecurityEvent[]
  threshold?: number
  actualValue?: number
  userId?: string
  createdAt: string
  acknowledgedAt?: string
  acknowledgedBy?: string
  resolvedAt?: string
  status: 'active' | 'acknowledged' | 'resolved' | 'false_positive'
}

/**
 * Security Monitor
 * 
 * Handles security event detection, logging, and alerting
 * with pattern-based threat detection and automated responses.
 */
export class SecurityMonitor {
  private supabase = createClient()
  private threatPatterns: ThreatPattern[] = []
  private eventBuffer: SecurityEvent[] = []
  private alertThresholds = new Map<string, { count: number; window: number; lastReset: number }>()

  constructor() {
    this.initializeThreatPatterns()
  }

  /**
   * Log a security event with threat detection
   */
  async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'detectedAt' | 'occurredAt'>): Promise<string> {
    try {
      const enhancedEvent: SecurityEvent = {
        ...event,
        occurredAt: new Date().toISOString(),
        detectedAt: new Date().toISOString(),
        ipAddress: event.ipAddress || await this.getClientIP(),
        userAgent: event.userAgent || await this.getClientUserAgent(),
        requestId: this.generateRequestId()
      }

      // Store in database
      const { data: storedEvent, error } = await this.supabase
        .from('security_events')
        .insert([enhancedEvent])
        .select()
        .single()

      if (error) {
        console.error('Failed to log security event:', error)
        // Fallback to local logging
        this.eventBuffer.push(enhancedEvent)
        return 'local-' + Date.now()
      }

      // Add to buffer for pattern detection
      this.eventBuffer.push(enhancedEvent)
      this.trimEventBuffer()

      // Run threat detection
      await this.detectThreats(enhancedEvent)

      // Check for alert conditions
      await this.checkAlertConditions(enhancedEvent)

      return storedEvent.id

    } catch (error) {
      console.error('Security event logging error:', error)
      throw new Error('Failed to log security event')
    }
  }

  /**
   * Log audit entry for profile operations
   */
  async logAuditEvent(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>): Promise<void> {
    try {
      const enhancedEntry: AuditLogEntry = {
        ...entry,
        createdAt: new Date().toISOString(),
        ipAddress: entry.ipAddress || await this.getClientIP(),
        userAgent: entry.userAgent || await this.getClientUserAgent()
      }

      const { error } = await this.supabase
        .from('auth_audit_logs')
        .insert([enhancedEntry])

      if (error) {
        console.error('Failed to log audit event:', error)
        // Continue execution - audit logging is not critical for operation
      }

    } catch (error) {
      console.error('Audit logging error:', error)
      // Non-critical error, continue execution
    }
  }

  /**
   * Detect suspicious profile activities
   */
  async detectSuspiciousActivity(
    userId: string,
    activityType: string,
    metadata: any = {}
  ): Promise<{ isSuspicious: boolean; riskScore: number; reasons: string[] }> {
    try {
      const riskFactors: Array<{ factor: string; score: number; weight: number }> = []

      // Check for rapid successive operations
      const recentActivity = await this.getRecentUserActivity(userId, 300) // 5 minutes
      const sameTypeActivities = recentActivity.filter(activity => 
        activity.event_data?.activity_type === activityType
      )

      if (sameTypeActivities.length > 5) {
        riskFactors.push({
          factor: 'rapid_successive_operations',
          score: 0.8,
          weight: 0.3
        })
      }

      // Check for unusual IP addresses
      const userSessions = await this.getUserSessionHistory(userId, 24) // 24 hours
      const currentIP = await this.getClientIP()
      const knownIPs = userSessions.map(session => session.ip_address).filter(Boolean)
      
      if (currentIP && !knownIPs.includes(currentIP)) {
        riskFactors.push({
          factor: 'unknown_ip_address',
          score: 0.6,
          weight: 0.2
        })
      }

      // Check for unusual time patterns
      const currentHour = new Date().getHours()
      const typicalHours = recentActivity.map(activity => 
        new Date(activity.created_at).getHours()
      )
      
      if (typicalHours.length > 0) {
        const isUnusualTime = !typicalHours.some(hour => 
          Math.abs(hour - currentHour) <= 2
        )
        
        if (isUnusualTime && (currentHour < 6 || currentHour > 23)) {
          riskFactors.push({
            factor: 'unusual_time_pattern',
            score: 0.4,
            weight: 0.15
          })
        }
      }

      // Check for data volume anomalies
      const dataVolume = JSON.stringify(metadata).length
      if (dataVolume > 10000) { // Large data volume
        riskFactors.push({
          factor: 'large_data_volume',
          score: 0.5,
          weight: 0.1
        })
      }

      // Calculate overall risk score
      const totalWeight = riskFactors.reduce((sum, factor) => sum + factor.weight, 0)
      const weightedScore = riskFactors.reduce((sum, factor) => 
        sum + (factor.score * factor.weight), 0
      )
      
      const riskScore = totalWeight > 0 ? weightedScore / totalWeight : 0
      const isSuspicious = riskScore > 0.5

      // Log if suspicious
      if (isSuspicious) {
        await this.logSecurityEvent({
          eventType: 'suspicious_activity_detected',
          severity: riskScore > 0.8 ? 'high' : 'medium',
          userId,
          description: `Suspicious ${activityType} activity detected`,
          details: {
            activity_type: activityType,
            risk_score: riskScore,
            risk_factors: riskFactors,
            metadata
          }
        })
      }

      return {
        isSuspicious,
        riskScore,
        reasons: riskFactors.map(factor => factor.factor)
      }

    } catch (error) {
      console.error('Suspicious activity detection error:', error)
      return {
        isSuspicious: false,
        riskScore: 0,
        reasons: []
      }
    }
  }

  /**
   * Monitor file upload security
   */
  async monitorFileUpload(
    userId: string,
    fileName: string,
    fileSize: number,
    mimeType: string,
    validationResult: any
  ): Promise<void> {
    try {
      const securityChecks = []

      // Check for suspicious file types
      const dangerousTypes = [
        'application/x-executable',
        'application/x-msdownload',
        'application/x-msdos-program',
        'text/javascript',
        'application/javascript'
      ]

      if (dangerousTypes.includes(mimeType)) {
        securityChecks.push('dangerous_mime_type')
      }

      // Check for suspicious file names
      const suspiciousPatterns = [
        /\.(exe|bat|cmd|scr|pif|com)$/i,
        /\.(js|vbs|wsf)$/i,
        /[<>:"|?*]/,
        /\.\./,
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
      ]

      if (suspiciousPatterns.some(pattern => pattern.test(fileName))) {
        securityChecks.push('suspicious_filename')
      }

      // Check for unusual file sizes
      if (fileSize > 50 * 1024 * 1024) { // > 50MB
        securityChecks.push('large_file_size')
      }

      // Check validation failures
      if (!validationResult?.isValid) {
        securityChecks.push('validation_failed')
      }

      // Log security events if any checks failed
      if (securityChecks.length > 0) {
        await this.logSecurityEvent({
          eventType: 'file_upload_security_check',
          severity: securityChecks.includes('dangerous_mime_type') ? 'high' : 'medium',
          userId,
          description: 'File upload security check triggered',
          details: {
            file_name: fileName,
            file_size: fileSize,
            mime_type: mimeType,
            security_checks: securityChecks,
            validation_result: validationResult
          }
        })
      }

    } catch (error) {
      console.error('File upload monitoring error:', error)
    }
  }

  /**
   * Monitor preference changes for security implications
   */
  async monitorPreferenceChange(
    userId: string,
    category: string,
    preferenceKey: string,
    oldValue: any,
    newValue: any
  ): Promise<void> {
    try {
      const securityImplications = []

      // Monitor privacy setting changes
      if (category === 'privacy') {
        if (preferenceKey === 'profile_visibility' && oldValue === 'private' && newValue === 'public') {
          securityImplications.push('privacy_degradation')
        }
        
        if (preferenceKey === 'show_contact_info' && !oldValue && newValue) {
          securityImplications.push('contact_info_exposure')
        }
      }

      // Monitor security setting changes
      if (category === 'security') {
        if (preferenceKey.includes('mfa') && oldValue && !newValue) {
          securityImplications.push('mfa_disabled')
        }
      }

      // Monitor notification changes (could indicate account compromise)
      if (category === 'notifications') {
        const criticalNotifications = ['login_alerts', 'security_alerts', 'account_changes']
        if (criticalNotifications.includes(preferenceKey) && oldValue && !newValue) {
          securityImplications.push('critical_notification_disabled')
        }
      }

      // Log security implications
      if (securityImplications.length > 0) {
        const severity = securityImplications.includes('mfa_disabled') ? 'high' : 'medium'
        
        await this.logSecurityEvent({
          eventType: 'preference_security_implication',
          severity,
          userId,
          description: 'Preference change with security implications',
          details: {
            category,
            preference_key: preferenceKey,
            old_value: oldValue,
            new_value: newValue,
            security_implications: securityImplications
          }
        })
      }

    } catch (error) {
      console.error('Preference monitoring error:', error)
    }
  }

  /**
   * Generate security metrics report
   */
  async getSecurityMetrics(timeframe: number = 24): Promise<SecurityMetrics> {
    try {
      const since = new Date(Date.now() - timeframe * 60 * 60 * 1000).toISOString()

      // Get security events
      const { data: events } = await this.supabase
        .from('security_events')
        .select('*')
        .gte('occurred_at', since)
        .order('occurred_at', { ascending: false })

      if (!events) {
        return this.getEmptyMetrics()
      }

      // Calculate metrics
      const totalEvents = events.length
      const criticalEvents = events.filter(e => e.severity === 'critical').length
      const highSeverityEvents = events.filter(e => e.severity === 'high').length
      const mediumSeverityEvents = events.filter(e => e.severity === 'medium').length
      const lowSeverityEvents = events.filter(e => e.severity === 'low').length
      const resolvedEvents = events.filter(e => e.resolved).length
      const unresolvedEvents = totalEvents - resolvedEvents

      // Calculate average resolution time
      const resolvedEventsWithTime = events.filter(e => e.resolved && e.resolved_at)
      const averageResolutionTime = resolvedEventsWithTime.length > 0
        ? resolvedEventsWithTime.reduce((sum, event) => {
            const resolutionTime = new Date(event.resolved_at!).getTime() - new Date(event.occurred_at).getTime()
            return sum + resolutionTime
          }, 0) / resolvedEventsWithTime.length / (1000 * 60) // Convert to minutes
        : 0

      // Top threat types
      const threatCounts = events.reduce((acc, event) => {
        acc[event.event_type] = (acc[event.event_type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const topThreatTypes = Object.entries(threatCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([type, count]) => ({ type, count }))

      // Recent activity (last 20 events)
      const recentActivity = events.slice(0, 20)

      return {
        totalEvents,
        criticalEvents,
        highSeverityEvents,
        mediumSeverityEvents,
        lowSeverityEvents,
        resolvedEvents,
        unresolvedEvents,
        averageResolutionTime,
        topThreatTypes,
        recentActivity
      }

    } catch (error) {
      console.error('Security metrics error:', error)
      return this.getEmptyMetrics()
    }
  }

  /**
   * Create monitoring alert
   */
  async createAlert(
    alertType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    title: string,
    description: string,
    triggeredBy: SecurityEvent[],
    userId?: string
  ): Promise<string> {
    try {
      const alert: MonitoringAlert = {
        id: this.generateAlertId(),
        alertType,
        severity,
        title,
        description,
        triggeredBy,
        userId,
        createdAt: new Date().toISOString(),
        status: 'active'
      }

      // Store alert (in a real implementation, this would go to an alerts table)
      console.warn('SECURITY ALERT:', alert)

      // TODO: Implement alert storage and notification system
      // - Store in database
      // - Send notifications (email, Slack, etc.)
      // - Trigger automated responses if needed

      return alert.id

    } catch (error) {
      console.error('Alert creation error:', error)
      throw new Error('Failed to create monitoring alert')
    }
  }

  // Private helper methods

  private initializeThreatPatterns(): void {
    this.threatPatterns = [
      {
        id: 'brute_force_login',
        name: 'Brute Force Login Attempts',
        description: 'Multiple failed login attempts from same IP',
        pattern: (event: SecurityEvent) => 
          event.eventType === 'login_failed' && 
          this.countRecentEvents('login_failed', event.ipAddress, 300) > 5,
        severity: 'high',
        enabled: true,
        threshold: 5,
        timeWindow: 300
      },
      {
        id: 'rapid_profile_changes',
        name: 'Rapid Profile Changes',
        description: 'Too many profile updates in short time',
        pattern: (event: SecurityEvent) =>
          event.eventType === 'profile_update' &&
          this.countRecentEvents('profile_update', event.userId, 600) > 10,
        severity: 'medium',
        enabled: true,
        threshold: 10,
        timeWindow: 600
      },
      {
        id: 'suspicious_file_upload',
        name: 'Suspicious File Upload',
        description: 'Upload of potentially dangerous file types',
        pattern: (event: SecurityEvent) =>
          event.eventType === 'file_upload_security_check' &&
          event.details?.security_checks?.includes('dangerous_mime_type'),
        severity: 'high',
        enabled: true
      },
      {
        id: 'privacy_degradation',
        name: 'Privacy Setting Degradation',
        description: 'Multiple privacy settings changed to less secure options',
        pattern: (event: SecurityEvent) =>
          event.eventType === 'preference_security_implication' &&
          event.details?.security_implications?.includes('privacy_degradation'),
        severity: 'medium',
        enabled: true
      }
    ]
  }

  private async detectThreats(event: SecurityEvent): Promise<void> {
    for (const pattern of this.threatPatterns) {
      if (!pattern.enabled) continue

      try {
        const isMatch = typeof pattern.pattern === 'function'
          ? pattern.pattern(event)
          : pattern.pattern.test(event.description)

        if (isMatch) {
          await this.createAlert(
            pattern.id,
            pattern.severity,
            pattern.name,
            pattern.description,
            [event],
            event.userId
          )
        }
      } catch (error) {
        console.error(`Threat pattern ${pattern.id} error:`, error)
      }
    }
  }

  private async checkAlertConditions(event: SecurityEvent): Promise<void> {
    // Check for alert thresholds
    const key = `${event.eventType}:${event.userId || event.ipAddress}`
    const threshold = this.alertThresholds.get(key)
    const now = Date.now()

    if (threshold) {
      // Reset counter if window expired
      if (now - threshold.lastReset > 300000) { // 5 minutes
        threshold.count = 1
        threshold.lastReset = now
      } else {
        threshold.count++
      }

      // Check if threshold exceeded
      if (threshold.count > threshold.window) {
        await this.createAlert(
          'threshold_exceeded',
          event.severity,
          'Event Threshold Exceeded',
          `Event ${event.eventType} exceeded threshold`,
          [event],
          event.userId
        )
      }
    } else {
      this.alertThresholds.set(key, {
        count: 1,
        window: 10, // Default threshold
        lastReset: now
      })
    }
  }

  private countRecentEvents(
    eventType: string,
    identifier?: string,
    timeWindow: number = 300
  ): number {
    const cutoff = Date.now() - timeWindow * 1000
    return this.eventBuffer.filter(event =>
      event.eventType === eventType &&
      new Date(event.occurredAt).getTime() > cutoff &&
      (identifier ? (event.userId === identifier || event.ipAddress === identifier) : true)
    ).length
  }

  private async getRecentUserActivity(userId: string, timeWindow: number): Promise<any[]> {
    const since = new Date(Date.now() - timeWindow * 1000).toISOString()
    
    const { data } = await this.supabase
      .from('auth_audit_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50)

    return data || []
  }

  private async getUserSessionHistory(userId: string, hours: number): Promise<any[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
    
    const { data } = await this.supabase
      .from('user_sessions')
      .select('ip_address, created_at')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })

    return data || []
  }

  private async getClientIP(): Promise<string | null> {
    try {
      const headersList = headers()
      return headersList.get('x-forwarded-for')?.split(',')[0] || 
             headersList.get('x-real-ip') || 
             null
    } catch {
      return null
    }
  }

  private async getClientUserAgent(): Promise<string | null> {
    try {
      const headersList = headers()
      return headersList.get('user-agent')
    } catch {
      return null
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private trimEventBuffer(): void {
    // Keep only last 1000 events in memory
    if (this.eventBuffer.length > 1000) {
      this.eventBuffer = this.eventBuffer.slice(-1000)
    }
  }

  private getEmptyMetrics(): SecurityMetrics {
    return {
      totalEvents: 0,
      criticalEvents: 0,
      highSeverityEvents: 0,
      mediumSeverityEvents: 0,
      lowSeverityEvents: 0,
      resolvedEvents: 0,
      unresolvedEvents: 0,
      averageResolutionTime: 0,
      topThreatTypes: [],
      recentActivity: []
    }
  }
}

// Export singleton instance
export const securityMonitor = new SecurityMonitor()

// Convenience functions for common security operations
export async function logProfileUpdate(
  userId: string,
  updatedFields: string[],
  success: boolean,
  errorReason?: string
): Promise<void> {
  await securityMonitor.logAuditEvent({
    eventType: 'profile_update',
    eventCategory: 'profile',
    userId,
    eventData: { updated_fields: updatedFields },
    success,
    failureReason: errorReason
  })

  if (success) {
    await securityMonitor.detectSuspiciousActivity(userId, 'profile_update', {
      updated_fields: updatedFields
    })
  }
}

export async function logPreferenceChange(
  userId: string,
  category: string,
  preferenceKey: string,
  oldValue: any,
  newValue: any,
  success: boolean
): Promise<void> {
  await securityMonitor.logAuditEvent({
    eventType: 'preference_change',
    eventCategory: 'preferences',
    userId,
    eventData: {
      category,
      preference_key: preferenceKey,
      old_value: oldValue,
      new_value: newValue
    },
    success
  })

  if (success) {
    await securityMonitor.monitorPreferenceChange(
      userId,
      category,
      preferenceKey,
      oldValue,
      newValue
    )
  }
}

export async function logFileOperation(
  userId: string,
  operation: 'upload' | 'download' | 'delete',
  fileName: string,
  fileSize?: number,
  success: boolean,
  errorReason?: string
): Promise<void> {
  await securityMonitor.logAuditEvent({
    eventType: 'file_operation',
    eventCategory: 'files',
    userId,
    eventData: {
      operation,
      file_name: fileName,
      file_size: fileSize
    },
    success,
    failureReason: errorReason
  })

  if (operation === 'upload' && success) {
    await securityMonitor.detectSuspiciousActivity(userId, 'file_upload', {
      file_name: fileName,
      file_size: fileSize
    })
  }
}

export async function logGDPROperation(
  userId: string,
  operation: 'export' | 'deletion',
  details: any,
  success: boolean
): Promise<void> {
  await securityMonitor.logSecurityEvent({
    eventType: 'gdpr_operation',
    severity: 'medium',
    userId,
    description: `GDPR ${operation} operation`,
    details: {
      operation,
      ...details
    }
  })

  await securityMonitor.logAuditEvent({
    eventType: 'gdpr_operation',
    eventCategory: 'gdpr',
    userId,
    eventData: { operation, ...details },
    success
  })
}

// Security monitoring middleware functions
export function createSecurityMiddleware() {
  return async (userId: string, operation: string, metadata: any = {}) => {
    const suspiciousActivity = await securityMonitor.detectSuspiciousActivity(
      userId,
      operation,
      metadata
    )

    if (suspiciousActivity.isSuspicious && suspiciousActivity.riskScore > 0.8) {
      // High risk - could block operation or require additional verification
      console.warn('High risk activity detected:', {
        userId,
        operation,
        riskScore: suspiciousActivity.riskScore,
        reasons: suspiciousActivity.reasons
      })
    }

    return suspiciousActivity
  }
}

// Export utility functions
export { SecurityMonitor, type SecurityEvent, type SecurityMetrics, type MonitoringAlert }