import { NextRequest } from 'next/server';

interface SecurityEvent {
  type: 
    // Generic security events
    | 'suspicious_activity' 
    | 'rate_limit_exceeded' 
    | 'auth_failure' 
    | 'csrf_violation' 
    | 'malicious_request'
    // Authentication events
    | 'authentication_bypass_attempt'
    | 'admin_action_suspicious'
    // KYC-specific events
    | 'kyc_admin_review_invalid_request'
    | 'kyc_admin_review_csrf_validation_failed'
    | 'kyc_admin_review_unauthenticated'
    | 'kyc_admin_review_unauthorized'
    | 'kyc_admin_review_verification_not_found'
    | 'kyc_admin_review_processing_error'
    | 'kyc_verification_escalated'
    | 'kyc_compliance_flagged'
    | 'kyc_admin_review_completed'
    | 'kyc_admin_review_unexpected_error'
    | 'kyc_appeal_rate_limited'
    | 'kyc_upload_rate_limited'
    | 'kyc_verification_initiated'
    | 'kyc_document_uploaded'
    | 'kyc_document_processing_failed'
    // KYC Appeals events
    | 'kyc_appeal_invalid_request'
    | 'kyc_appeal_csrf_validation_failed'
    | 'kyc_appeal_unauthenticated'
    | 'kyc_appeal_verification_not_found'
    | 'kyc_appeal_unauthorized'
    | 'kyc_appeal_creation_error'
    | 'kyc_appeal_created_success'
    | 'kyc_appeal_unexpected_error'
    | 'kyc_appeals_fetch_error'
    | 'kyc_appeals_unexpected_error'
    // KYC Status events
    | 'kyc_status_invalid_request'
    | 'kyc_status_unauthenticated'
    | 'kyc_status_verification_not_found'
    | 'kyc_status_unauthorized'
    | 'kyc_status_check_success'
    | 'kyc_status_unexpected_error'
    // KYC Initiation events
    | 'kyc_initiation_rate_limited'
    | 'kyc_initiation_invalid_request'
    | 'kyc_initiation_csrf_validation_failed'
    | 'kyc_initiation_unauthenticated'
    | 'kyc_initiation_unauthorized'
    | 'kyc_initiation_business_unauthorized'
    | 'kyc_initiation_database_error'
    | 'kyc_verification_details_error'
    | 'kyc_verification_initiated_success'
    | 'kyc_initiation_unexpected_error'
    // KYC Upload events
    | 'kyc_upload_unauthenticated'
    | 'kyc_upload_invalid_request'
    | 'kyc_upload_csrf_validation_failed'
    | 'kyc_upload_file_too_large'
    | 'kyc_upload_invalid_mime_type'
    | 'kyc_upload_verification_not_found'
    | 'kyc_upload_unauthorized'
    | 'kyc_upload_duplicate_check_error'
    | 'kyc_upload_duplicate_detected'
    | 'kyc_upload_storage_error'
    | 'kyc_upload_database_error'
    | 'kyc_upload_cleanup_error'
    | 'kyc_document_uploaded_success'
    | 'kyc_upload_unexpected_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  ip?: string;
  userAgent?: string;
  endpoint?: string;
  details: Record<string, any>;
}

interface SecurityMetrics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  recentEvents: SecurityEvent[];
}

class SecurityMonitor {
  private events: SecurityEvent[] = [];
  private maxEvents = 1000; // Keep last 1000 events in memory

  logEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: Date.now(),
    };

    this.events.push(securityEvent);

    // Keep only the most recent events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Security Monitor]', securityEvent);
    }

    // In production, you might want to:
    // - Send to a security monitoring service
    // - Write to a database
    // - Send alerts for critical events
    if (securityEvent.severity === 'critical') {
      this.handleCriticalEvent(securityEvent);
    }
  }

  private handleCriticalEvent(event: SecurityEvent): void {
    // Handle critical security events
    console.error('[CRITICAL SECURITY EVENT]', event);
    
    // In production, implement:
    // - Send immediate alerts
    // - Trigger incident response
    // - Log to security systems
  }

  getMetrics(): SecurityMetrics {
    const totalEvents = this.events.length;
    const eventsByType: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};

    this.events.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
    });

    return {
      totalEvents,
      eventsByType,
      eventsBySeverity,
      recentEvents: this.events.slice(-10), // Last 10 events
    };
  }

  getEventsInTimeRange(startTime: number, endTime: number): SecurityEvent[] {
    return this.events.filter(
      event => event.timestamp >= startTime && event.timestamp <= endTime
    );
  }

  getSuspiciousIPs(threshold = 5): string[] {
    const ipCounts: Record<string, number> = {};
    
    this.events.forEach(event => {
      if (event.ip) {
        ipCounts[event.ip] = (ipCounts[event.ip] || 0) + 1;
      }
    });

    return Object.entries(ipCounts)
      .filter(([_, count]) => count >= threshold)
      .map(([ip]) => ip);
  }
}

// Global security monitor instance
export const securityMonitor = new SecurityMonitor();

// Helper functions
export function logSecurityEvent(
  type: SecurityEvent['type'],
  severity: SecurityEvent['severity'],
  req: NextRequest,
  details: Record<string, any> = {}
): void {
  securityMonitor.logEvent({
    type,
    severity,
    ip: req.ip || 'unknown',
    userAgent: req.headers.get('user-agent') || undefined,
    endpoint: `${req.method} ${req.nextUrl.pathname}`,
    details,
  });
}

export function logSuspiciousActivity(req: NextRequest, reason: string): void {
  logSecurityEvent('suspicious_activity', 'medium', req, { reason });
}

export function logRateLimitExceeded(req: NextRequest, limit: number): void {
  logSecurityEvent('rate_limit_exceeded', 'medium', req, { limit });
}

export function logAuthFailure(req: NextRequest, reason: string): void {
  logSecurityEvent('auth_failure', 'high', req, { reason });
}

export function logCSRFViolation(req: NextRequest): void {
  logSecurityEvent('csrf_violation', 'high', req, {});
}

export function logMaliciousRequest(req: NextRequest, reason: string): void {
  logSecurityEvent('malicious_request', 'critical', req, { reason });
}

// Middleware helpers
export function withSecurityMonitoring(req: NextRequest) {
  // Basic request analysis
  const userAgent = req.headers.get('user-agent') || '';
  const contentType = req.headers.get('content-type') || '';
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /scanner/i,
    /vulnerability/i,
    /<script/i,
    /javascript:/i,
    /vbscript:/i,
  ];

  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(userAgent) || pattern.test(req.nextUrl.searchParams.toString())
  );

  if (isSuspicious) {
    logSuspiciousActivity(req, 'Suspicious user agent or request parameters');
  }

  return {
    isSuspicious,
    userAgent,
    contentType,
  };
}

export { SecurityMonitor };
export type { SecurityEvent, SecurityMetrics };
