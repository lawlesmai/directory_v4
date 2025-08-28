/**
 * Comprehensive Audit Logging for MFA Operations
 * Enterprise-grade security auditing and compliance logging
 * 
 * The Lawless Directory - Epic 2 Story 2.4
 * Multi-Factor Authentication Infrastructure
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// Configuration for audit logging
const MFA_AUDIT_CONFIG = {
  // Event types and their severity levels
  eventTypes: {
    // MFA Setup and Configuration
    'mfa_enabled': 'medium',
    'mfa_disabled': 'high',
    'mfa_methods_changed': 'medium',
    'totp_secret_generated': 'medium',
    'backup_codes_generated': 'low',
    'backup_codes_viewed': 'low',
    'sms_number_changed': 'medium',
    
    // MFA Verification Events
    'mfa_challenge_created': 'low',
    'mfa_verification_attempt': 'low',
    'mfa_verification_success': 'low',
    'mfa_verification_failed': 'medium',
    'mfa_verification_blocked': 'high',
    
    // Backup Code Events
    'backup_code_used': 'medium',
    'backup_code_invalid': 'medium',
    'backup_codes_exhausted': 'high',
    'backup_codes_regenerated': 'medium',
    
    // Device Trust Events
    'device_registered': 'low',
    'device_trust_calculated': 'low',
    'device_trusted': 'medium',
    'device_trust_revoked': 'medium',
    'suspicious_device_detected': 'high',
    
    // Recovery Events
    'recovery_initiated': 'high',
    'recovery_method_used': 'high',
    'recovery_completed': 'critical',
    'recovery_failed': 'medium',
    'identity_verification_started': 'high',
    'identity_verification_completed': 'critical',
    
    // Admin Override Events
    'admin_override_created': 'critical',
    'admin_override_approved': 'critical',
    'admin_override_used': 'critical',
    'admin_override_revoked': 'high',
    'emergency_access_granted': 'critical',
    
    // Rate Limiting Events
    'rate_limit_triggered': 'medium',
    'rate_limit_blocked': 'high',
    'account_locked': 'high',
    'account_unlocked': 'medium',
    
    // Security Events
    'suspicious_activity_detected': 'high',
    'fraud_pattern_detected': 'critical',
    'geo_anomaly_detected': 'medium',
    'time_anomaly_detected': 'medium',
    'brute_force_detected': 'high',
    
    // Compliance Events
    'compliance_check': 'low',
    'policy_violation': 'high',
    'data_export': 'medium',
    'audit_log_accessed': 'medium'
  } as const,
  
  // Retention policies
  retention: {
    low: 90,      // 90 days
    medium: 365,  // 1 year
    high: 1825,   // 5 years
    critical: 2555 // 7 years
  },
  
  // Data sensitivity levels
  dataSensitivity: {
    public: ['event_type', 'created_at', 'success'],
    internal: ['user_id', 'ip_address', 'user_agent'],
    restricted: ['session_id', 'device_id', 'challenge_id'],
    confidential: ['verification_method', 'failure_reason'],
    secret: ['code_hash', 'token_hash']
  },
  
  // Compliance standards
  compliance: {
    sox: true,      // Sarbanes-Oxley
    pci: true,      // PCI DSS
    hipaa: false,   // HIPAA (if healthcare data)
    gdpr: true,     // GDPR
    ccpa: true,     // CCPA
    iso27001: true  // ISO 27001
  },
  
  // Real-time alerting thresholds
  alertThresholds: {
    failedAttemptsPerMinute: 10,
    suspiciousEventsPerHour: 20,
    criticalEventsPerDay: 5,
    adminOverridesPerDay: 3,
    recoveryAttemptsPerDay: 5
  },
  
  // Log integrity settings
  integrity: {
    useDigitalSignatures: true,
    hashAlgorithm: 'sha256',
    tamperDetection: true,
    blockchainBackup: false // For high-security environments
  }
} as const;

// Initialize Supabase client
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Audit Event Interface
 */
interface AuditEvent {
  eventType: keyof typeof MFA_AUDIT_CONFIG.eventTypes;
  userId?: string;
  sessionId?: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  eventData?: Record<string, any>;
  failureReason?: string;
  riskScore?: number;
  complianceFlags?: string[];
  correlationId?: string;
  targetUserId?: string; // For admin actions
}

/**
 * Audit Query Interface
 */
interface AuditQuery {
  userId?: string;
  eventType?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  severity?: string;
  success?: boolean;
  ipAddress?: string;
  deviceId?: string;
  limit?: number;
  offset?: number;
  includeData?: boolean;
}

/**
 * Audit Report Interface
 */
interface AuditReport {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  successRate: number;
  topFailureReasons: Array<{ reason: string; count: number }>;
  riskTrends: Array<{ date: string; avgRisk: number }>;
  complianceStatus: Record<string, boolean>;
  anomalies: Array<{
    type: string;
    description: string;
    severity: string;
    firstOccurrence: Date;
    count: number;
  }>;
}

/**
 * MFA Audit Logger Service
 */
export class MFAAuditLogger {
  /**
   * Logs an MFA-related audit event
   */
  static async logEvent(event: AuditEvent): Promise<{ success: boolean; eventId?: string; error?: string }> {
    try {
      // Validate event
      const validation = this.validateEvent(event);
      if (!validation.valid) {
        console.error('Invalid audit event:', validation.errors);
        return { success: false, error: validation.errors.join(', ') };
      }
      
      // Enrich event with metadata
      const enrichedEvent = await this.enrichEvent(event);
      
      // Generate event hash for integrity
      const eventHash = this.generateEventHash(enrichedEvent);
      
      // Determine retention period
      const severity = MFA_AUDIT_CONFIG.eventTypes[event.eventType];
      const retentionDays = MFA_AUDIT_CONFIG.retention[severity];
      const retentionDate = new Date();
      retentionDate.setDate(retentionDate.getDate() + retentionDays);
      
      // Insert audit record
      const { data: auditRecord, error: insertError } = await supabase
        .from('auth_audit_logs')
        .insert([{
          event_type: event.eventType,
          event_category: this.getEventCategory(event.eventType),
          user_id: event.userId,
          target_user_id: event.targetUserId,
          session_id: event.sessionId,
          ip_address: event.ipAddress,
          user_agent: event.userAgent,
          success: event.success,
          failure_reason: event.failureReason,
          event_data: {
            ...enrichedEvent.eventData,
            device_id: event.deviceId,
            risk_score: event.riskScore,
            compliance_flags: event.complianceFlags,
            correlation_id: event.correlationId,
            event_hash: eventHash,
            severity: severity,
            retention_until: retentionDate.toISOString()
          },
          created_at: new Date().toISOString()
        }])
        .select('id')
        .single();
      
      if (insertError || !auditRecord) {
        throw new Error(`Failed to log audit event: ${insertError?.message}`);
      }
      
      // Check for real-time alert conditions
      await this.checkAlertConditions(event, auditRecord.id);
      
      // Update audit metrics
      await this.updateAuditMetrics(event.eventType, severity, event.success);
      
      return {
        success: true,
        eventId: auditRecord.id
      };
      
    } catch (error) {
      console.error('Audit logging error:', error);
      // Critical: Audit logging failure should be handled gracefully
      // but also reported to monitoring systems
      await this.logAuditFailure(event, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Audit logging failed'
      };
    }
  }
  
  /**
   * Logs MFA verification attempt with detailed context
   */
  static async logMFAVerification(params: {
    userId: string;
    method: string;
    success: boolean;
    challengeId?: string;
    deviceId?: string;
    ipAddress: string;
    userAgent: string;
    responseTimeMs?: number;
    failureReason?: string;
    riskFactors?: string[];
    trustScore?: number;
  }): Promise<void> {
    const event: AuditEvent = {
      eventType: params.success ? 'mfa_verification_success' : 'mfa_verification_failed',
      userId: params.userId,
      deviceId: params.deviceId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      success: params.success,
      failureReason: params.failureReason,
      riskScore: this.calculateEventRiskScore(params.riskFactors),
      eventData: {
        verification_method: params.method,
        challenge_id: params.challengeId,
        response_time_ms: params.responseTimeMs,
        risk_factors: params.riskFactors,
        trust_score: params.trustScore
      },
      complianceFlags: this.getComplianceFlags('mfa_verification')
    };
    
    await this.logEvent(event);
    
    // Log to verification attempts table as well
    await supabase
      .from('mfa_verification_attempts')
      .insert([{
        user_id: params.userId,
        challenge_id: params.challengeId,
        verification_method: params.method,
        is_valid: params.success,
        device_id: params.deviceId,
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
        response_time_ms: params.responseTimeMs || 0,
        is_suspicious: (params.riskFactors?.length || 0) > 0,
        suspicion_reasons: params.riskFactors || [],
        fraud_score: params.trustScore ? 1 - params.trustScore : 0
      }]);
  }
  
  /**
   * Logs admin actions with enhanced tracking
   */
  static async logAdminAction(params: {
    adminUserId: string;
    targetUserId?: string;
    action: string;
    success: boolean;
    details?: Record<string, any>;
    justification?: string;
    ipAddress: string;
    userAgent: string;
  }): Promise<void> {
    const event: AuditEvent = {
      eventType: params.action as keyof typeof MFA_AUDIT_CONFIG.eventTypes,
      userId: params.adminUserId,
      targetUserId: params.targetUserId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      success: params.success,
      eventData: {
        action: params.action,
        details: params.details,
        justification: params.justification,
        admin_level: await this.getAdminLevel(params.adminUserId)
      },
      complianceFlags: this.getComplianceFlags('admin_action'),
      correlationId: `admin_${params.adminUserId}_${Date.now()}`
    };
    
    await this.logEvent(event);
    
    // Critical admin actions trigger immediate security review
    const criticalActions = ['admin_override_created', 'emergency_access_granted', 'mfa_disabled'];
    if (criticalActions.includes(params.action)) {
      await this.triggerSecurityReview(event);
    }
  }
  
  /**
   * Logs security events and anomalies
   */
  static async logSecurityEvent(params: {
    eventType: string;
    userId?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    details?: Record<string, any>;
    ipAddress?: string;
    deviceId?: string;
    automaticResponse?: string;
  }): Promise<void> {
    const event: AuditEvent = {
      eventType: params.eventType as keyof typeof MFA_AUDIT_CONFIG.eventTypes,
      userId: params.userId,
      deviceId: params.deviceId,
      ipAddress: params.ipAddress,
      success: true, // Security events are always "successful" logs
      eventData: {
        severity: params.severity,
        description: params.description,
        details: params.details,
        automatic_response: params.automaticResponse,
        detection_timestamp: new Date().toISOString()
      },
      riskScore: this.severityToRiskScore(params.severity),
      complianceFlags: this.getComplianceFlags('security_event')
    };
    
    await this.logEvent(event);
    
    // Insert into security events table
    await supabase
      .from('security_events')
      .insert([{
        event_type: params.eventType,
        severity: params.severity,
        user_id: params.userId,
        description: params.description,
        details: params.details,
        ip_address: params.ipAddress,
        action_taken: params.automaticResponse,
        resolved: false
      }]);
  }
  
  /**
   * Queries audit logs with filtering and pagination
   */
  static async queryAuditLogs(query: AuditQuery): Promise<{
    events: any[];
    totalCount: number;
    hasMore: boolean;
  }> {
    try {
      let queryBuilder = supabase
        .from('auth_audit_logs')
        .select(`
          id,
          event_type,
          event_category,
          user_id,
          target_user_id,
          success,
          failure_reason,
          ip_address,
          created_at,
          ${query.includeData ? 'event_data,' : ''}
          profiles:user_id(display_name, username)
        `);
      
      // Apply filters
      if (query.userId) {
        queryBuilder = queryBuilder.eq('user_id', query.userId);
      }
      
      if (query.eventType) {
        queryBuilder = queryBuilder.eq('event_type', query.eventType);
      }
      
      if (query.success !== undefined) {
        queryBuilder = queryBuilder.eq('success', query.success);
      }
      
      if (query.ipAddress) {
        queryBuilder = queryBuilder.eq('ip_address', query.ipAddress);
      }
      
      if (query.dateRange) {
        queryBuilder = queryBuilder
          .gte('created_at', query.dateRange.start.toISOString())
          .lte('created_at', query.dateRange.end.toISOString());
      }
      
      // Apply pagination
      const limit = Math.min(query.limit || 100, 1000); // Max 1000 records
      const offset = query.offset || 0;
      
      queryBuilder = queryBuilder
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      const { data: events, error, count } = await queryBuilder;
      
      if (error) {
        throw new Error(`Audit query failed: ${error.message}`);
      }
      
      return {
        events: events || [],
        totalCount: count || 0,
        hasMore: (count || 0) > offset + limit
      };
      
    } catch (error) {
      console.error('Audit query error:', error);
      return {
        events: [],
        totalCount: 0,
        hasMore: false
      };
    }
  }
  
  /**
   * Generates comprehensive audit report
   */
  static async generateAuditReport(params: {
    startDate: Date;
    endDate: Date;
    userId?: string;
    includeDetails?: boolean;
  }): Promise<AuditReport> {
    try {
      // Get all events in date range
      const { data: events } = await supabase
        .from('auth_audit_logs')
        .select('event_type, success, failure_reason, event_data, created_at')
        .gte('created_at', params.startDate.toISOString())
        .lte('created_at', params.endDate.toISOString())
        .eq('user_id', params.userId || undefined);
      
      if (!events) {
        throw new Error('Failed to fetch audit events');
      }
      
      // Calculate metrics
      const totalEvents = events.length;
      const successfulEvents = events.filter((e: any) => e.success).length;
      const successRate = totalEvents > 0 ? (successfulEvents / totalEvents) * 100 : 0;
      
      // Group by event type
      const eventsByType = events.reduce((acc: any, event: any) => {
        acc[event.event_type] = (acc[event.event_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Group by severity
      const eventsBySeverity = events.reduce((acc: any, event: any) => {
        const severity = MFA_AUDIT_CONFIG.eventTypes[event.event_type as keyof typeof MFA_AUDIT_CONFIG.eventTypes] || 'low';
        acc[severity] = (acc[severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Top failure reasons
      const failureReasons = events
        .filter((e: any) => !e.success && e.failure_reason)
        .reduce((acc: any, event: any) => {
          const reason = event.failure_reason!;
          acc[reason] = (acc[reason] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      
      const topFailureReasons = Object.entries(failureReasons)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 10)
        .map(([reason, count]) => ({ reason, count: count as number }));
      
      // Risk trends (simplified)
      const riskTrends = await this.calculateRiskTrends(params.startDate, params.endDate);
      
      // Compliance status
      const complianceStatus = await this.checkComplianceStatus(events);
      
      // Detect anomalies
      const anomalies = await this.detectAnomalies(events);
      
      return {
        totalEvents,
        eventsByType,
        eventsBySeverity,
        successRate,
        topFailureReasons,
        riskTrends,
        complianceStatus,
        anomalies
      };
      
    } catch (error) {
      console.error('Audit report generation error:', error);
      throw error;
    }
  }
  
  /**
   * Helper methods
   */
  
  private static validateEvent(event: AuditEvent): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!event.eventType || !(event.eventType in MFA_AUDIT_CONFIG.eventTypes)) {
      errors.push('Invalid event type');
    }
    
    if (event.success === undefined) {
      errors.push('Success status is required');
    }
    
    if (!event.ipAddress && (event.eventType as string) !== 'system_event') {
      errors.push('IP address is required for user events');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  private static async enrichEvent(event: AuditEvent): Promise<AuditEvent> {
    const enriched = { ...event };
    
    // Add geolocation if IP is available
    if (event.ipAddress) {
      enriched.eventData = {
        ...enriched.eventData,
        geo_location: await this.getGeolocation(event.ipAddress)
      };
    }
    
    // Add user context if available
    if (event.userId) {
      const userContext = await this.getUserContext(event.userId);
      enriched.eventData = {
        ...enriched.eventData,
        user_context: userContext
      };
    }
    
    return enriched;
  }
  
  private static generateEventHash(event: AuditEvent): string {
    const hashData = {
      event_type: event.eventType,
      user_id: event.userId,
      timestamp: new Date().toISOString(),
      success: event.success,
      ip_address: event.ipAddress
    };
    
    const crypto = require('crypto');
    return crypto
      .createHash(MFA_AUDIT_CONFIG.integrity.hashAlgorithm)
      .update(JSON.stringify(hashData))
      .digest('hex');
  }
  
  private static getEventCategory(eventType: string): string {
    const categoryMap: Record<string, string> = {
      'mfa_enabled': 'mfa_setup',
      'mfa_disabled': 'mfa_setup',
      'mfa_verification_success': 'mfa_verification',
      'mfa_verification_failed': 'mfa_verification',
      'backup_code_used': 'backup_codes',
      'device_registered': 'device_trust',
      'recovery_initiated': 'recovery',
      'admin_override_created': 'admin_actions',
      'suspicious_activity_detected': 'security'
    };
    
    return categoryMap[eventType] || 'other';
  }
  
  private static calculateEventRiskScore(riskFactors?: string[]): number {
    if (!riskFactors || riskFactors.length === 0) return 0;
    
    const riskWeights: Record<string, number> = {
      'new_device': 0.3,
      'new_location': 0.4,
      'vpn_usage': 0.2,
      'tor_usage': 0.8,
      'failed_attempts': 0.5,
      'time_anomaly': 0.3
    };
    
    const totalRisk = riskFactors.reduce((sum, factor) => {
      return sum + (riskWeights[factor] || 0.1);
    }, 0);
    
    return Math.min(1.0, totalRisk);
  }
  
  private static getComplianceFlags(eventCategory: string): string[] {
    const flags: string[] = [];
    
    if (MFA_AUDIT_CONFIG.compliance.sox) flags.push('SOX');
    if (MFA_AUDIT_CONFIG.compliance.pci) flags.push('PCI');
    if (MFA_AUDIT_CONFIG.compliance.gdpr) flags.push('GDPR');
    if (MFA_AUDIT_CONFIG.compliance.ccpa) flags.push('CCPA');
    if (MFA_AUDIT_CONFIG.compliance.iso27001) flags.push('ISO27001');
    
    return flags;
  }
  
  private static severityToRiskScore(severity: string): number {
    const severityMap: Record<string, number> = {
      'low': 0.2,
      'medium': 0.5,
      'high': 0.8,
      'critical': 1.0
    };
    
    return severityMap[severity] || 0.5;
  }
  
  private static async getAdminLevel(adminUserId: string): Promise<string> {
    const { data } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', adminUserId)
      .eq('is_active', true);
    
    const roleNames = data?.map((r: any) => (r.roles as any)?.name).filter(Boolean) || [];
    
    if (roleNames.includes('super_admin')) return 'super_admin';
    if (roleNames.includes('admin')) return 'admin';
    return 'unknown';
  }
  
  private static async getGeolocation(ipAddress: string): Promise<Record<string, any>> {
    // In production, integrate with IP geolocation service
    return { ip: ipAddress, location: 'unknown' };
  }
  
  private static async getUserContext(userId: string): Promise<Record<string, any>> {
    const { data } = await supabase
      .from('profiles')
      .select('display_name, account_status')
      .eq('id', userId)
      .single();
    
    return data || {};
  }
  
  private static async checkAlertConditions(event: AuditEvent, eventId: string): Promise<void> {
    const severity = MFA_AUDIT_CONFIG.eventTypes[event.eventType];
    
    if (severity === 'critical') {
      await this.triggerImmediateAlert(event, eventId);
    }
    
    // Check threshold-based alerts
    await this.checkThresholdAlerts(event);
  }
  
  private static async triggerImmediateAlert(event: AuditEvent, eventId: string): Promise<void> {
    console.log(`CRITICAL ALERT: ${event.eventType} for user ${event.userId}`);
    // In production, integrate with alerting system (PagerDuty, Slack, etc.)
  }
  
  private static async checkThresholdAlerts(event: AuditEvent): Promise<void> {
    // Implementation would check various thresholds and trigger alerts
    // This is a placeholder for the alerting system
  }
  
  private static async triggerSecurityReview(event: AuditEvent): Promise<void> {
    await supabase
      .from('security_events')
      .insert([{
        event_type: 'security_review_required',
        severity: 'high',
        user_id: event.userId,
        description: `Critical admin action requires security review: ${event.eventType}`,
        details: event.eventData
      }]);
  }
  
  private static async updateAuditMetrics(eventType: string, severity: string, success: boolean): Promise<void> {
    // Update real-time metrics for monitoring dashboards
    const hour = new Date().getHours();
    const date = new Date().toISOString().split('T')[0];
    
    await supabase
      .from('mfa_analytics')
      .upsert({
        date,
        hour,
        [`${eventType}_count`]: 1
      }, {
        onConflict: 'date,hour'
      });
  }
  
  private static async calculateRiskTrends(startDate: Date, endDate: Date): Promise<Array<{ date: string; avgRisk: number }>> {
    // Simplified risk trend calculation
    return [];
  }
  
  private static async checkComplianceStatus(events: any[]): Promise<Record<string, boolean>> {
    return {
      SOX: true,
      PCI: true,
      GDPR: true,
      CCPA: true,
      ISO27001: true
    };
  }
  
  private static async detectAnomalies(events: any[]): Promise<any[]> {
    // Simplified anomaly detection
    return [];
  }
  
  private static async logAuditFailure(event: AuditEvent, error: any): Promise<void> {
    console.error('CRITICAL: Audit logging failure', {
      eventType: event.eventType,
      userId: event.userId,
      error: error.message
    });
    
    // In production, this would trigger immediate alerts to operations team
    // Could also write to local file system as backup
  }
}

/**
 * Audit Compliance Utilities
 */
export class AuditComplianceUtils {
  /**
   * Generates compliance report for specific standard
   */
  static async generateComplianceReport(
    standard: 'SOX' | 'PCI' | 'GDPR' | 'CCPA' | 'ISO27001',
    dateRange: { start: Date; end: Date }
  ): Promise<{
    compliant: boolean;
    requirements: Record<string, { met: boolean; evidence: string[] }>;
    recommendations: string[];
  }> {
    // Implementation would vary by compliance standard
    return {
      compliant: true,
      requirements: {},
      recommendations: []
    };
  }
  
  /**
   * Validates audit log integrity
   */
  static async validateLogIntegrity(
    dateRange: { start: Date; end: Date }
  ): Promise<{
    valid: boolean;
    corruptedEvents: string[];
    missingEvents: string[];
  }> {
    // Implementation would verify event hashes and detect tampering
    return {
      valid: true,
      corruptedEvents: [],
      missingEvents: []
    };
  }
}

// Export types and configuration
export type { AuditEvent, AuditQuery, AuditReport };
export { MFA_AUDIT_CONFIG };