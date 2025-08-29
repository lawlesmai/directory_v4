/**
 * EPIC 5 STORY 5.10: Payment Security & Compliance
 * Security Monitoring API Endpoints
 * 
 * Provides real-time security monitoring dashboard data,
 * threat detection metrics, and security event management.
 */

import { NextRequest, NextResponse } from 'next/server';
import securityMonitor, { SecurityEventType, SecuritySeverity } from '@/lib/payments/security-monitor';
import fraudDetection from '@/lib/payments/fraud-detection';
import paymentSecurity from '@/lib/payments/security-middleware';
import { z } from 'zod';

// =============================================
// REQUEST VALIDATION SCHEMAS
// =============================================

const GetSecurityMetricsSchema = z.object({
  timeWindow: z.string().regex(/^\d+[hmwd]$/).default('24h'),
  includeDetails: z.boolean().default(false)
});

const ReportSecurityEventSchema = z.object({
  type: z.nativeEnum(SecurityEventType),
  severity: z.nativeEnum(SecuritySeverity),
  source: z.string(),
  userId: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  resourceId: z.string().optional(),
  resourceType: z.string().optional(),
  details: z.object({
    action: z.string(),
    description: z.string(),
    evidence: z.any().optional(),
    context: z.any().optional()
  })
});

const CreateSecurityIncidentSchema = z.object({
  severity: z.nativeEnum(SecuritySeverity),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  relatedEvents: z.array(z.string()).default([]),
  assignedTo: z.string().optional()
});

// =============================================
// GET - Security Dashboard Data
// =============================================

export async function GET(request: NextRequest) {
  try {
    // Validate security permissions
    const { context, response } = await paymentSecurity.validatePaymentRequest(
      request,
      ['admin', 'security_analyst', 'compliance_officer'],
      false
    );

    if (response) {
      return response;
    }

    const url = new URL(request.url);
    const searchParams = url.searchParams;

    // Parse query parameters
    const params = {
      timeWindow: searchParams.get('timeWindow') || '24h',
      includeDetails: searchParams.get('includeDetails') === 'true'
    };

    // Validate parameters
    const validation = GetSecurityMetricsSchema.safeParse(params);
    if (!validation.success) {
      await paymentSecurity.logPaymentEvent(
        context,
        'security_monitoring_validation_error',
        'security_api',
        false,
        { errors: validation.error.errors },
        'Invalid request parameters'
      );

      return NextResponse.json(
        { error: 'Invalid parameters', details: validation.error.errors },
        { status: 400 }
      );
    }

    const validParams = validation.data;

    // Get security dashboard data
    const dashboardData = await securityMonitor.getSecurityDashboard();
    
    // Get specific metrics for the requested time window
    const metrics = await securityMonitor.getSecurityMetrics(validParams.timeWindow);

    // Get fraud detection metrics
    const fraudMetrics = await getFraudDetectionMetrics(validParams.timeWindow);

    const response_data = {
      timestamp: new Date().toISOString(),
      timeWindow: validParams.timeWindow,
      dashboard: dashboardData,
      metrics: {
        security: metrics,
        fraud: fraudMetrics
      },
      summary: {
        overallSecurityScore: metrics.systemHealth.securityPosture.score,
        activeThreats: metrics.threatsBlocked,
        criticalAlerts: dashboardData.activeAlerts.filter(
          alert => alert.severity === SecuritySeverity.CRITICAL
        ).length,
        fraudScore: fraudMetrics.averageRiskScore,
        systemHealth: metrics.systemHealth.overallStatus
      }
    };

    // Log successful request
    await paymentSecurity.logPaymentEvent(
      context,
      'security_monitoring_data_retrieved',
      'security_api',
      true,
      { timeWindow: validParams.timeWindow, includeDetails: validParams.includeDetails }
    );

    return NextResponse.json(response_data, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Security-Level': 'high'
      }
    });
  } catch (error) {
    console.error('Security monitoring API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Security monitoring failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// =============================================
// POST - Report Security Event
// =============================================

export async function POST(request: NextRequest) {
  try {
    // Validate security permissions
    const { context, response } = await paymentSecurity.validatePaymentRequest(
      request,
      ['admin', 'security_analyst', 'system'],
      false
    );

    if (response) {
      return response;
    }

    // Parse request body
    const body = await request.json();

    // Validate request data
    const validation = ReportSecurityEventSchema.safeParse(body);
    if (!validation.success) {
      await paymentSecurity.logPaymentEvent(
        context,
        'security_event_report_validation_error',
        'security_api',
        false,
        { errors: validation.error.errors },
        'Invalid security event data'
      );

      return NextResponse.json(
        { error: 'Invalid security event data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const eventData = validation.data;

    // Enrich event data with context
    const enrichedEvent = {
      ...eventData,
      ipAddress: eventData.ipAddress || context.ipAddress,
      userAgent: eventData.userAgent || context.userAgent,
      userId: eventData.userId || context.userId
    };

    // Report security event to monitoring system
    const securityEvent = await securityMonitor.reportSecurityEvent(enrichedEvent);

    // Check if this event should trigger additional fraud analysis
    if (eventData.type === SecurityEventType.FRAUD_DETECTED || 
        eventData.type === SecurityEventType.PAYMENT_ANOMALY) {
      
      // Trigger fraud detection analysis if we have enough context
      if (eventData.details.context) {
        const fraudAnalysis = await fraudDetection.analyzeTransaction(eventData.details.context);
        securityEvent.details.fraudAnalysis = fraudAnalysis;
      }
    }

    // Log successful event reporting
    await paymentSecurity.logPaymentEvent(
      context,
      'security_event_reported',
      'security_api',
      true,
      { 
        eventId: securityEvent.id,
        eventType: eventData.type,
        severity: eventData.severity
      }
    );

    return NextResponse.json(
      {
        eventId: securityEvent.id,
        status: 'reported',
        timestamp: securityEvent.timestamp,
        responseActions: securityEvent.responseActions?.map(action => ({
          action: action.action,
          success: action.success,
          executedAt: action.executedAt
        })) || []
      },
      { 
        status: 201,
        headers: {
          'X-Event-ID': securityEvent.id,
          'X-Security-Level': 'high'
        }
      }
    );
  } catch (error) {
    console.error('Security event reporting API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Security event reporting failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// =============================================
// PUT - Create Security Incident
// =============================================

export async function PUT(request: NextRequest) {
  try {
    // Validate security permissions - only admins and security analysts can create incidents
    const { context, response } = await paymentSecurity.validatePaymentRequest(
      request,
      ['admin', 'security_analyst'],
      false
    );

    if (response) {
      return response;
    }

    // Parse request body
    const body = await request.json();

    // Validate request data
    const validation = CreateSecurityIncidentSchema.safeParse(body);
    if (!validation.success) {
      await paymentSecurity.logPaymentEvent(
        context,
        'security_incident_creation_validation_error',
        'security_api',
        false,
        { errors: validation.error.errors },
        'Invalid incident creation data'
      );

      return NextResponse.json(
        { error: 'Invalid incident data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const incidentData = validation.data;

    // Create security incident
    const incident = await securityMonitor.createIncident(
      incidentData.severity,
      incidentData.title,
      incidentData.description,
      incidentData.relatedEvents
    );

    // Auto-assign if specified
    if (incidentData.assignedTo) {
      // Implementation would assign incident to specified user
      incident.assignedTo = incidentData.assignedTo;
    }

    // Log incident creation
    await paymentSecurity.logPaymentEvent(
      context,
      'security_incident_created',
      'security_api',
      true,
      { 
        incidentId: incident.incidentId,
        severity: incidentData.severity,
        assignedTo: incidentData.assignedTo
      }
    );

    return NextResponse.json(
      {
        incidentId: incident.incidentId,
        status: incident.status,
        severity: incident.severity,
        createdAt: incident.createdAt,
        assignedTo: incident.assignedTo
      },
      { 
        status: 201,
        headers: {
          'X-Incident-ID': incident.incidentId,
          'X-Security-Level': 'high'
        }
      }
    );
  } catch (error) {
    console.error('Security incident creation API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Security incident creation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// =============================================
// HELPER FUNCTIONS
// =============================================

async function getFraudDetectionMetrics(timeWindow: string) {
  try {
    // This would typically query fraud detection metrics from the database
    // For now, returning mock data structure
    return {
      timeWindow,
      totalTransactionsAnalyzed: 1250,
      fraudDetected: 23,
      fraudPrevented: 18,
      falsePositives: 5,
      averageRiskScore: 32.5,
      riskDistribution: {
        low: 892,
        medium: 235,
        high: 98,
        critical: 25
      },
      detectionAccuracy: 94.2,
      responseTime: {
        average: 125, // milliseconds
        p95: 250,
        p99: 500
      },
      topRiskFactors: [
        { factor: 'velocity', weight: 0.25, averageScore: 28 },
        { factor: 'geographic', weight: 0.20, averageScore: 35 },
        { factor: 'device', weight: 0.20, averageScore: 22 },
        { factor: 'behavioral', weight: 0.15, averageScore: 40 }
      ]
    };
  } catch (error) {
    console.error('Error getting fraud detection metrics:', error);
    return {
      timeWindow,
      error: 'Failed to retrieve fraud metrics'
    };
  }
}