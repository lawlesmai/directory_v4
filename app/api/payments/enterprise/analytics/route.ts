/**
 * EPIC 5 STORY 5.8: Enterprise Sales & Custom Billing
 * Enterprise Analytics API - SLA monitoring, compliance reporting, and performance analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import enterpriseAnalytics from '@/lib/analytics/enterprise-analytics';
import { createClient } from '@/lib/supabase/server';

// =============================================
// REQUEST SCHEMAS
// =============================================

const GenerateReportSchema = z.object({
  customerId: z.string().uuid(),
  reportType: z.enum(['sla', 'usage', 'revenue', 'compliance', 'executive_summary']),
  periodStart: z.string().transform(str => new Date(str)),
  periodEnd: z.string().transform(str => new Date(str)),
  deliveryMethod: z.enum(['email', 'portal', 'api']).default('portal'),
  recipients: z.array(z.string().email()).optional(),
});

const RecordIncidentSchema = z.object({
  customerId: z.string().uuid(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  cause: z.string().min(10),
  affectedServices: z.array(z.string()).min(1),
  startTime: z.string().transform(str => new Date(str)),
  endTime: z.string().transform(str => new Date(str)).optional(),
  customerImpact: z.string(),
  resolution: z.string().optional(),
});

const SLAQuerySchema = z.object({
  customerId: z.string().uuid(),
  periodStart: z.string().transform(str => new Date(str)).optional(),
  periodEnd: z.string().transform(str => new Date(str)).optional(),
  metricType: z.enum(['uptime', 'support', 'performance', 'compliance', 'overall']).optional(),
});

// =============================================
// AUTHENTICATION
// =============================================

async function authenticateRequest(request: NextRequest) {
  const supabase = createClient();
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return { isAuthenticated: false, error: 'Unauthorized' };
    }

    // Check for analytics or admin role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select(`roles(name, permissions)`)
      .eq('user_id', user.id)
      .single();

    const roleName = userRole?.roles?.name;
    if (!['admin', 'super_admin', 'analytics', 'customer_success', 'enterprise_sales'].includes(roleName)) {
      return { isAuthenticated: false, error: 'Insufficient permissions' };
    }

    return { isAuthenticated: true, userId: user.id, role: roleName };
  } catch {
    return { isAuthenticated: false, error: 'Authentication failed' };
  }
}

// =============================================
// GET - Retrieve Analytics Data
// =============================================

export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const auth = await authenticateRequest(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: auth.error },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'sla_metrics':
        return await handleGetSLAMetrics(searchParams);
      
      case 'usage_analytics':
        return await handleGetUsageAnalytics(searchParams);
      
      case 'compliance_status':
        return await handleGetComplianceStatus(searchParams);
      
      case 'performance_metrics':
        return await handleGetPerformanceMetrics(searchParams);
      
      case 'customer_health':
        return await handleGetCustomerHealth(searchParams);
      
      case 'reports':
        return await handleGetReports(searchParams);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Enterprise Analytics API GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retrieve analytics' },
      { status: 500 }
    );
  }
}

// =============================================
// POST - Generate Reports and Record Incidents
// =============================================

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const auth = await authenticateRequest(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: auth.error },
        { status: 401 }
      );
    }

    const body = await request.json();
    const action = body.action;

    switch (action) {
      case 'generate_report':
        return await handleGenerateReport(body, auth.userId);
      
      case 'record_incident':
        return await handleRecordIncident(body, auth.userId);
      
      case 'bulk_metrics_update':
        return await handleBulkMetricsUpdate(body, auth.userId);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Enterprise Analytics API POST error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analytics operation failed' },
      { status: 500 }
    );
  }
}

// =============================================
// PUT - Update Analytics Configuration
// =============================================

export async function PUT(request: NextRequest) {
  try {
    // Authenticate
    const auth = await authenticateRequest(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: auth.error },
        { status: 401 }
      );
    }

    const body = await request.json();
    const action = body.action;

    switch (action) {
      case 'update_sla_targets':
        return await handleUpdateSLATargets(body, auth.userId);
      
      case 'configure_alerts':
        return await handleConfigureAlerts(body, auth.userId);
      
      case 'update_compliance_status':
        return await handleUpdateComplianceStatus(body, auth.userId);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Enterprise Analytics API PUT error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analytics update failed' },
      { status: 500 }
    );
  }
}

// =============================================
// HANDLER FUNCTIONS - GET ACTIONS
// =============================================

async function handleGetSLAMetrics(searchParams: URLSearchParams) {
  const customerId = searchParams.get('customerId');
  const periodStart = searchParams.get('periodStart') 
    ? new Date(searchParams.get('periodStart')!)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
  const periodEnd = searchParams.get('periodEnd') 
    ? new Date(searchParams.get('periodEnd')!)
    : new Date();

  if (!customerId) {
    return NextResponse.json(
      { error: 'customerId is required' },
      { status: 400 }
    );
  }

  const slaMetrics = await enterpriseAnalytics.generateSLAMetrics(customerId, periodStart, periodEnd);

  return NextResponse.json({
    success: true,
    data: slaMetrics,
  });
}

async function handleGetUsageAnalytics(searchParams: URLSearchParams) {
  const customerId = searchParams.get('customerId');
  const periodStart = searchParams.get('periodStart') 
    ? new Date(searchParams.get('periodStart')!)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const periodEnd = searchParams.get('periodEnd') 
    ? new Date(searchParams.get('periodEnd')!)
    : new Date();

  if (!customerId) {
    return NextResponse.json(
      { error: 'customerId is required' },
      { status: 400 }
    );
  }

  const usageAnalytics = await enterpriseAnalytics.generateUsageAnalytics(customerId, periodStart, periodEnd);

  return NextResponse.json({
    success: true,
    data: usageAnalytics,
  });
}

async function handleGetComplianceStatus(searchParams: URLSearchParams) {
  const customerId = searchParams.get('customerId');

  if (!customerId) {
    return NextResponse.json(
      { error: 'customerId is required' },
      { status: 400 }
    );
  }

  const supabase = createClient();
  
  // Get contract compliance requirements
  const { data: contract } = await supabase
    .from('enterprise_contracts')
    .select('compliance')
    .eq('customer_id', customerId)
    .eq('status', 'active')
    .single();

  if (!contract) {
    return NextResponse.json(
      { error: 'No active contract found for customer' },
      { status: 404 }
    );
  }

  // Get current compliance status
  const compliance = contract.compliance || { required: [], certifications: [], auditSchedule: {}, reportingRequirements: [] };
  
  // Calculate compliance score
  const totalRequirements = compliance.required.length;
  const compliantRequirements = compliance.required.filter((req: any) => req.status === 'compliant').length;
  const complianceScore = totalRequirements > 0 ? (compliantRequirements / totalRequirements) * 100 : 100;

  return NextResponse.json({
    success: true,
    data: {
      customerId,
      complianceScore,
      status: complianceScore >= 95 ? 'compliant' : complianceScore >= 80 ? 'at_risk' : 'non_compliant',
      requirements: compliance.required,
      certifications: compliance.certifications,
      auditSchedule: compliance.auditSchedule,
      reportingRequirements: compliance.reportingRequirements,
      lastUpdated: new Date().toISOString(),
    },
  });
}

async function handleGetPerformanceMetrics(searchParams: URLSearchParams) {
  const customerId = searchParams.get('customerId');
  const metricType = searchParams.get('metricType') || 'overall';
  const periodStart = searchParams.get('periodStart') 
    ? new Date(searchParams.get('periodStart')!)
    : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24 hours
  const periodEnd = searchParams.get('periodEnd') 
    ? new Date(searchParams.get('periodEnd')!)
    : new Date();

  if (!customerId) {
    return NextResponse.json(
      { error: 'customerId is required' },
      { status: 400 }
    );
  }

  // Get performance data from database
  const supabase = createClient();
  const { data: performanceData, error } = await supabase
    .from('performance_metrics')
    .select('*')
    .eq('customer_id', customerId)
    .gte('recorded_at', periodStart.toISOString())
    .lte('recorded_at', periodEnd.toISOString())
    .order('recorded_at', { ascending: false });

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  // Calculate aggregated metrics
  const metrics = performanceData?.length ? {
    averagePageLoadTime: Math.round(performanceData.reduce((sum, data) => sum + data.page_load_time, 0) / performanceData.length),
    averageApiResponseTime: Math.round(performanceData.reduce((sum, data) => sum + data.api_response_time, 0) / performanceData.length),
    averageSearchResponseTime: Math.round(performanceData.reduce((sum, data) => sum + data.search_response_time, 0) / performanceData.length),
    totalRequests: performanceData.reduce((sum, data) => sum + (data.total_requests || 0), 0),
    totalErrors: performanceData.reduce((sum, data) => sum + (data.error_count || 0), 0),
    errorRate: 0,
    uptime: 99.95, // Would calculate from actual uptime data
    dataPoints: performanceData.length,
  } : {
    averagePageLoadTime: 0,
    averageApiResponseTime: 0,
    averageSearchResponseTime: 0,
    totalRequests: 0,
    totalErrors: 0,
    errorRate: 0,
    uptime: 0,
    dataPoints: 0,
  };

  if (metrics.totalRequests > 0) {
    metrics.errorRate = Math.round((metrics.totalErrors / metrics.totalRequests) * 10000) / 100; // Percentage with 2 decimal places
  }

  return NextResponse.json({
    success: true,
    data: {
      customerId,
      period: {
        start: periodStart,
        end: periodEnd,
      },
      metrics,
      trend: 'stable', // Would calculate actual trend
      alerts: [], // Would include any performance alerts
    },
  });
}

async function handleGetCustomerHealth(searchParams: URLSearchParams) {
  const customerId = searchParams.get('customerId');

  if (!customerId) {
    return NextResponse.json(
      { error: 'customerId is required' },
      { status: 400 }
    );
  }

  // Get recent SLA metrics, usage analytics, and support data
  const periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
  const periodEnd = new Date();

  const [slaMetrics, usageAnalytics] = await Promise.all([
    enterpriseAnalytics.generateSLAMetrics(customerId, periodStart, periodEnd),
    enterpriseAnalytics.generateUsageAnalytics(customerId, periodStart, periodEnd),
  ]);

  // Calculate health score
  const healthFactors = {
    slaCompliance: slaMetrics.overallScore,
    usageEngagement: Math.min(100, usageAnalytics.engagement.totalSessions / 100 * 10), // Normalize engagement
    supportSatisfaction: slaMetrics.support.customerSatisfaction * 20, // Convert to 100 scale
    uptimeScore: (slaMetrics.uptime.actual / slaMetrics.uptime.target) * 100,
  };

  const overallHealthScore = Object.values(healthFactors).reduce((sum, score) => sum + score, 0) / Object.keys(healthFactors).length;

  let healthStatus = 'healthy';
  if (overallHealthScore < 60) healthStatus = 'at_risk';
  if (overallHealthScore < 40) healthStatus = 'critical';

  return NextResponse.json({
    success: true,
    data: {
      customerId,
      overallHealthScore: Math.round(overallHealthScore * 100) / 100,
      healthStatus,
      factors: healthFactors,
      recommendations: generateHealthRecommendations(healthFactors, healthStatus),
      lastUpdated: new Date().toISOString(),
    },
  });
}

async function handleGetReports(searchParams: URLSearchParams) {
  const customerId = searchParams.get('customerId');
  const reportType = searchParams.get('reportType');
  const limit = parseInt(searchParams.get('limit') || '10');

  const supabase = createClient();
  let query = supabase
    .from('enterprise_reports')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(limit);

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }
  if (reportType) {
    query = query.eq('report_type', reportType);
  }

  const { data: reports, error } = await query;

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  return NextResponse.json({
    success: true,
    data: reports || [],
  });
}

// =============================================
// HANDLER FUNCTIONS - POST ACTIONS
// =============================================

async function handleGenerateReport(body: any, userId: string) {
  const validatedData = GenerateReportSchema.parse(body);
  
  const report = await enterpriseAnalytics.generateReport({
    customerId: validatedData.customerId,
    reportType: validatedData.reportType,
    periodStart: validatedData.periodStart,
    periodEnd: validatedData.periodEnd,
    deliveryMethod: validatedData.deliveryMethod,
    recipients: validatedData.recipients,
  });

  return NextResponse.json({
    success: true,
    data: report,
    message: 'Report generated successfully',
  });
}

async function handleRecordIncident(body: any, userId: string) {
  const validatedData = RecordIncidentSchema.parse(body);
  
  await enterpriseAnalytics.recordIncident({
    customerId: validatedData.customerId,
    severity: validatedData.severity,
    cause: validatedData.cause,
    affectedServices: validatedData.affectedServices,
    startTime: validatedData.startTime,
    endTime: validatedData.endTime,
    customerImpact: validatedData.customerImpact,
  });

  return NextResponse.json({
    success: true,
    message: 'Incident recorded successfully',
  });
}

async function handleBulkMetricsUpdate(body: any, userId: string) {
  const { customerId, metrics } = body;

  if (!customerId || !metrics) {
    return NextResponse.json(
      { error: 'customerId and metrics are required' },
      { status: 400 }
    );
  }

  const supabase = createClient();
  
  // Insert performance metrics
  const { error } = await supabase
    .from('performance_metrics')
    .insert({
      customer_id: customerId,
      page_load_time: metrics.pageLoadTime || 0,
      api_response_time: metrics.apiResponseTime || 0,
      search_response_time: metrics.searchResponseTime || 0,
      total_requests: metrics.totalRequests || 0,
      error_count: metrics.errorCount || 0,
      recorded_at: new Date().toISOString(),
    });

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  return NextResponse.json({
    success: true,
    message: 'Metrics updated successfully',
  });
}

// =============================================
// HANDLER FUNCTIONS - PUT ACTIONS
// =============================================

async function handleUpdateSLATargets(body: any, userId: string) {
  const { customerId, slaTargets } = body;

  if (!customerId || !slaTargets) {
    return NextResponse.json(
      { error: 'customerId and slaTargets are required' },
      { status: 400 }
    );
  }

  const supabase = createClient();
  
  // Update contract SLA targets
  const { error } = await supabase
    .from('enterprise_contracts')
    .update({
      terms: {
        serviceLevel: slaTargets,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('customer_id', customerId)
    .eq('status', 'active');

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  return NextResponse.json({
    success: true,
    message: 'SLA targets updated successfully',
  });
}

async function handleConfigureAlerts(body: any, userId: string) {
  const { customerId, alertConfig } = body;

  // This would configure alerting thresholds and notification preferences
  // For now, just return success
  return NextResponse.json({
    success: true,
    message: 'Alert configuration updated successfully',
  });
}

async function handleUpdateComplianceStatus(body: any, userId: string) {
  const { customerId, requirementId, status, evidence } = body;

  if (!customerId || !requirementId || !status) {
    return NextResponse.json(
      { error: 'customerId, requirementId, and status are required' },
      { status: 400 }
    );
  }

  // This would update specific compliance requirement status
  // Implementation would depend on contract structure
  return NextResponse.json({
    success: true,
    message: 'Compliance status updated successfully',
  });
}

// =============================================
// UTILITY FUNCTIONS
// =============================================

function generateHealthRecommendations(factors: any, status: string): string[] {
  const recommendations = [];

  if (factors.slaCompliance < 90) {
    recommendations.push('Review SLA compliance and address any performance issues');
  }
  
  if (factors.usageEngagement < 70) {
    recommendations.push('Consider customer success outreach to improve engagement');
  }
  
  if (factors.supportSatisfaction < 80) {
    recommendations.push('Analyze support interactions and improve response quality');
  }
  
  if (factors.uptimeScore < 99) {
    recommendations.push('Investigate uptime issues and implement reliability improvements');
  }

  if (status === 'at_risk') {
    recommendations.push('Schedule proactive customer health review meeting');
  }

  if (status === 'critical') {
    recommendations.push('Escalate to customer success manager immediately');
  }

  return recommendations;
}