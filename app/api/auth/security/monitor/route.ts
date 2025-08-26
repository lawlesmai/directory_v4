/**
 * Security Monitoring API Endpoint
 * Epic 2 Story 2.6: Password Management and Account Security
 * 
 * GET /api/auth/security/monitor
 * Provides security metrics, incident reports, and monitoring data
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSecurityMetrics, detectSecurityAnomalies } from '@/lib/auth/security-monitor'
import { checkAccountLockout } from '@/lib/auth/account-lockout'
import { createClient } from '@/lib/supabase/server'
import { getClientIP } from '@/lib/security/server'

// Query parameters validation
const monitorQuerySchema = z.object({
  timeframe: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
  userId: z.string().uuid().optional(),
  includeAnomalies: z.string().default('false').transform(val => val === 'true'),
  includeMetrics: z.string().default('true').transform(val => val === 'true'),
  includeLockoutStatus: z.string().default('true').transform(val => val === 'true')
})

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const clientIP = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Get current user from session
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const queryParams = {
      timeframe: searchParams.get('timeframe') || '24h',
      userId: searchParams.get('userId'),
      includeAnomalies: searchParams.get('includeAnomalies'),
      includeMetrics: searchParams.get('includeMetrics'),
      includeLockoutStatus: searchParams.get('includeLockoutStatus')
    }

    const validationResult = monitorQuerySchema.safeParse(queryParams)
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid query parameters',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const { timeframe, userId, includeAnomalies, includeMetrics, includeLockoutStatus } = validationResult.data

    // Authorization check
    const requestedUserId = userId || user?.id
    if (userId && userId !== user?.id && user?.id) {
      // Check if current user has admin privileges
      const { data: userRoles } = await (supabase as any)
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('is_primary', true)
        .single()

      const isAdmin = userRoles?.role === 'admin' || userRoles?.role === 'security_admin'
      
      if (!isAdmin) {
        return NextResponse.json({
          success: false,
          error: 'Unauthorized to view other user security data'
        }, { status: 403 })
      }
    }

    // Build response data
    const responseData: any = {
      success: true,
      timestamp: new Date().toISOString(),
      timeframe,
      userId: requestedUserId
    }

    // Get security metrics
    if (includeMetrics) {
      try {
        const metrics = await getSecurityMetrics(timeframe)
        responseData.metrics = {
          authentication: {
            totalAttempts: metrics.totalLoginAttempts,
            successfulLogins: metrics.successfulLogins,
            failedAttempts: metrics.failedLoginAttempts,
            failureRate: Math.round(metrics.failureRate * 100) / 100
          },
          incidents: {
            total: metrics.incidentsLast24h,
            byType: metrics.incidentsByType,
            bySeverity: metrics.incidentsBySeverity,
            averageRiskScore: Math.round(metrics.averageRiskScore * 100) / 100
          },
          risks: {
            highRiskEvents: metrics.highRiskEvents,
            criticalEvents: metrics.criticalEvents,
            topAttackCountries: metrics.topAttackCountries.slice(0, 5),
            suspiciousIPs: metrics.suspiciousIPs.slice(0, 10)
          },
          trends: {
            attacks: metrics.trendData.attacks.map(trend => ({
              timestamp: trend.timestamp,
              count: trend.count
            })),
            riskScores: metrics.trendData.riskScores.map(trend => ({
              timestamp: trend.timestamp,
              avgScore: Math.round(trend.avgScore * 100) / 100
            }))
          }
        }
      } catch (error) {
        console.error('Error getting security metrics:', error)
        responseData.metrics = {
          error: 'Failed to load security metrics'
        }
      }
    }

    // Get lockout status
    if (includeLockoutStatus && requestedUserId) {
      try {
        const lockoutStatus = await checkAccountLockout(requestedUserId, clientIP)
        responseData.lockoutStatus = {
          isLocked: lockoutStatus.isLocked,
          lockoutType: lockoutStatus.lockoutType,
          lockedUntil: lockoutStatus.lockedUntil,
          reason: lockoutStatus.reason,
          attemptCount: lockoutStatus.attemptCount,
          maxAttempts: lockoutStatus.maxAttempts,
          canUnlock: lockoutStatus.canUnlock,
          requiresAdminIntervention: lockoutStatus.requiresAdminIntervention,
          securityIncidents: lockoutStatus.securityIncidents
        }
      } catch (error) {
        console.error('Error getting lockout status:', error)
        responseData.lockoutStatus = {
          error: 'Failed to load lockout status'
        }
      }
    }

    // Detect anomalies
    if (includeAnomalies && requestedUserId) {
      try {
        const anomalies = await detectSecurityAnomalies(requestedUserId, clientIP, request)
        responseData.anomalies = {
          detected: anomalies.anomalies.length > 0,
          count: anomalies.anomalies.length,
          items: anomalies.anomalies.map(anomaly => ({
            type: anomaly.type,
            severity: anomaly.severity,
            description: anomaly.description,
            evidence: anomaly.evidence
          }))
        }
      } catch (error) {
        console.error('Error detecting anomalies:', error)
        responseData.anomalies = {
          error: 'Failed to detect anomalies'
        }
      }
    }

    // Get recent security events for the user
    if (requestedUserId) {
      try {
        const { data: recentEvents } = await (supabase as any)
          .from('account_security_events')
          .select('event_type, created_at, risk_score, metadata')
          .eq('user_id', requestedUserId)
          .order('created_at', { ascending: false })
          .limit(10)

        responseData.recentEvents = recentEvents?.map((event: any) => ({
          type: event.event_type,
          timestamp: event.created_at,
          riskScore: event.risk_score,
          description: event.metadata?.description || `${event.event_type} event`
        })) || []
      } catch (error) {
        console.error('Error getting recent events:', error)
        responseData.recentEvents = []
      }
    }

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('Security monitor API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// POST endpoint for security incident reporting
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const clientIP = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const reportSchema = z.object({
      type: z.string().min(1, 'Incident type required'),
      description: z.string().min(1, 'Description required'),
      severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
      evidence: z.record(z.any()).optional()
    })

    const validationResult = reportSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid report format',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const { type, description, severity, evidence } = validationResult.data

    // Create security incident
    const { data: incident, error: insertError } = await (supabase as any)
      .from('security_incidents')
      .insert([{
        incident_type: type,
        severity,
        user_id: user.id,
        ip_address: clientIP,
        user_agent: userAgent,
        description,
        evidence: evidence || {},
        status: 'open',
        admin_notified: severity === 'critical'
      }])
      .select('id')
      .single()

    if (insertError) {
      console.error('Security incident creation error:', insertError)
      return NextResponse.json({
        success: false,
        error: 'Failed to create security incident'
      }, { status: 500 })
    }

    // Log the incident reporting
    await (supabase as any)
      .from('account_security_events')
      .insert([{
        user_id: user.id,
        event_type: 'security_incident_reported',
        ip_address: clientIP,
        user_agent: userAgent,
        metadata: {
          incidentId: incident.id,
          incidentType: type,
          severity,
          reportedBy: 'user'
        }
      }])

    return NextResponse.json({
      success: true,
      incidentId: incident.id,
      message: 'Security incident reported successfully'
    })

  } catch (error) {
    console.error('Security incident reporting error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}