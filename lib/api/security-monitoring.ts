import { NextRequest } from 'next/server';

interface SecurityEvent {
  type: 'suspicious_activity' | 'rate_limit_exceeded' | 'auth_failure' | 'csrf_violation' | 'malicious_request';
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
