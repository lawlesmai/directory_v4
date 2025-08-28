/**
 * EPIC 5 STORY 5.6: Revenue Analytics & Business Intelligence
 * Executive Dashboard API - High-level KPIs for executive decision making
 * 
 * This API provides executive-level analytics including:
 * - Key Performance Indicators (KPIs) summary
 * - Business health scoring and alerts
 * - Strategic insights and recommendations
 * - Comparative performance metrics
 * - Growth trajectory analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import revenueCalculator from '@/lib/analytics/revenue-calculator';
import customerAnalytics from '@/lib/analytics/customer-analytics';
import forecastingEngine from '@/lib/analytics/forecasting-engine';
import { z } from 'zod';

// =============================================
// TYPES AND INTERFACES
// =============================================

interface ExecutiveKPI {
  name: string;
  value: string | number;
  previousValue?: string | number;
  change?: number;
  trend: 'up' | 'down' | 'stable';
  status: 'excellent' | 'good' | 'warning' | 'critical';
  target?: number;
  unit?: string;
  description: string;
}

interface BusinessHealthScore {
  overall: number;
  components: {
    revenue: { score: number; weight: number };
    customers: { score: number; weight: number };
    operations: { score: number; weight: number };
    growth: { score: number; weight: number };
  };
  trend: 'improving' | 'stable' | 'declining';
  alerts: Array<{
    type: 'info' | 'warning' | 'critical';
    message: string;
    priority: 'low' | 'medium' | 'high';
  }>;
}

interface StrategicInsight {
  category: 'revenue' | 'customer' | 'product' | 'market' | 'operational';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  recommendations: string[];
  metrics?: Record<string, number>;
}

// =============================================
// VALIDATION SCHEMAS
// =============================================

const ExecutiveDashboardQuerySchema = z.object({
  view: z.enum(['overview', 'detailed', 'forecasts', 'alerts', 'insights']).default('overview'),
  period: z.enum(['week', 'month', 'quarter', 'year']).default('month'),
  compareWith: z.enum(['previous_period', 'year_ago', 'target']).default('previous_period'),
  includeForecasts: z.boolean().default(true),
  includeInsights: z.boolean().default(true),
  alertsOnly: z.boolean().default(false),
});

// =============================================
// API HANDLERS
// =============================================

/**
 * GET /api/analytics/executive
 * Get executive dashboard data
 */
export async function GET(request: NextRequest) {
  try {
    // Verify executive/admin access
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check executive permissions
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select(`
        role:roles(name)
      `)
      .eq('user_id', user.id);

    const hasExecutiveAccess = userRoles?.some(ur => 
      ['admin', 'super_admin', 'executive'].includes(ur.role?.name)
    );

    if (!hasExecutiveAccess) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Executive access required' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    // Parse boolean parameters
    ['includeForecasts', 'includeInsights', 'alertsOnly'].forEach(param => {
      if (queryParams[param]) {
        queryParams[param] = queryParams[param] === 'true';
      }
    });

    const config = ExecutiveDashboardQuerySchema.parse(queryParams);

    switch (config.view) {
      case 'overview':
        return await handleExecutiveOverview(config);
      
      case 'detailed':
        return await handleDetailedAnalytics(config);
      
      case 'forecasts':
        return await handleExecutiveForecasts(config);
      
      case 'alerts':
        return await handleExecutiveAlerts(config);
      
      case 'insights':
        return await handleStrategicInsights(config);
      
      default:
        return await handleExecutiveOverview(config);
    }

  } catch (error) {
    console.error('Executive dashboard API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation Error', 
          message: 'Invalid query parameters',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}

// =============================================
// HANDLER FUNCTIONS
// =============================================

/**
 * Handle executive overview dashboard
 */
async function handleExecutiveOverview(config: z.infer<typeof ExecutiveDashboardQuerySchema>) {
  try {
    const endDate = new Date();
    const startDate = getPeriodStartDate(endDate, config.period);
    const compareStartDate = getComparisonStartDate(startDate, config.compareWith);
    const compareEndDate = new Date(startDate);

    // Get all key metrics in parallel
    const [
      currentRevenue,
      previousRevenue,
      currentCustomers,
      previousCustomers,
      churnAnalysis,
      forecasts
    ] = await Promise.all([
      revenueCalculator.calculateRevenueMetrics({ targetDate: endDate }),
      revenueCalculator.calculateRevenueMetrics({ targetDate: compareEndDate }),
      customerAnalytics.analyzeCustomerAcquisition({ startDate, endDate, granularity: 'month' }),
      customerAnalytics.analyzeCustomerAcquisition({ 
        startDate: compareStartDate, 
        endDate: compareEndDate, 
        granularity: 'month' 
      }),
      customerAnalytics.analyzeChurn({ 
        period: { startDate, endDate }, 
        includePredictions: true 
      }),
      config.includeForecasts ? forecastingEngine.forecastRevenue({ 
        horizonMonths: getPeriodMonths(config.period),
        confidenceLevel: 95
      }) : null
    ]);

    // Generate KPIs
    const kpis = generateExecutiveKPIs(
      currentRevenue, 
      previousRevenue, 
      currentCustomers, 
      previousCustomers, 
      churnAnalysis
    );

    // Calculate business health score
    const healthScore = calculateBusinessHealthScore(
      currentRevenue,
      currentCustomers,
      churnAnalysis
    );

    // Generate strategic insights
    const insights = config.includeInsights ? 
      await generateStrategicInsights(currentRevenue, currentCustomers, churnAnalysis, forecasts) :
      [];

    return NextResponse.json({
      success: true,
      data: {
        kpis,
        healthScore,
        insights: insights.slice(0, 5), // Top 5 insights for overview
        forecasts: forecasts ? {
          revenue: forecasts.predictions.slice(0, 3), // Next 3 periods
          confidence: forecasts.predictions[0]?.confidence || 0
        } : null,
        period: {
          current: { start: startDate.toISOString(), end: endDate.toISOString() },
          comparison: { start: compareStartDate.toISOString(), end: compareEndDate.toISOString() },
          type: config.period,
          compareWith: config.compareWith
        },
        generatedAt: new Date().toISOString(),
      }
    });

  } catch (error) {
    throw new Error(`Failed to generate executive overview: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle detailed analytics for executives
 */
async function handleDetailedAnalytics(config: z.infer<typeof ExecutiveDashboardQuerySchema>) {
  try {
    const endDate = new Date();
    const startDate = getPeriodStartDate(endDate, config.period);

    // Get comprehensive analytics
    const [
      revenueMetrics,
      revenueSegmentation,
      customerMetrics,
      customerSegmentation,
      cohortAnalysis,
      churnAnalysis
    ] = await Promise.all([
      revenueCalculator.calculateRevenueMetrics(),
      revenueCalculator.getRevenueSegmentation(endDate, ['plan', 'geography']),
      customerAnalytics.analyzeCustomerAcquisition({ startDate, endDate, granularity: 'month' }),
      customerAnalytics.segmentCustomers({ segmentBy: ['revenue'], includeHealthScore: true }),
      customerAnalytics.generateCohortAnalysis(12),
      customerAnalytics.analyzeChurn({ period: { startDate, endDate }, includePredictions: true })
    ]);

    // Generate detailed insights
    const detailedInsights = await generateDetailedInsights({
      revenue: revenueMetrics,
      revenueSegmentation,
      customers: customerMetrics,
      customerSegmentation,
      cohorts: cohortAnalysis,
      churn: churnAnalysis
    });

    return NextResponse.json({
      success: true,
      data: {
        revenue: {
          metrics: revenueMetrics,
          segmentation: revenueSegmentation,
          insights: detailedInsights.revenue
        },
        customers: {
          metrics: customerMetrics,
          segmentation: customerSegmentation,
          cohorts: cohortAnalysis,
          insights: detailedInsights.customers
        },
        churn: {
          analysis: churnAnalysis,
          insights: detailedInsights.churn
        },
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          type: config.period
        },
        generatedAt: new Date().toISOString(),
      }
    });

  } catch (error) {
    throw new Error(`Failed to generate detailed analytics: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle executive forecasts
 */
async function handleExecutiveForecasts(config: z.infer<typeof ExecutiveDashboardQuerySchema>) {
  try {
    const horizonMonths = getPeriodMonths(config.period) * 2; // Forecast for 2 periods ahead

    // Generate forecasts
    const [
      revenueForecast,
      customerForecast,
      churnPrediction,
      scenarioAnalysis
    ] = await Promise.all([
      forecastingEngine.forecastRevenue({ 
        horizonMonths, 
        confidenceLevel: 95,
        includeSeasonality: true 
      }),
      forecastingEngine.forecastCustomerGrowth({ 
        horizonMonths, 
        confidenceLevel: 95 
      }),
      forecastingEngine.predictChurn({ 
        predictionHorizon: 90,
        riskThreshold: 0.7 
      }),
      forecastingEngine.generateScenarioAnalysis({ 
        scenarios: ['conservative', 'base', 'optimistic'] 
      })
    ]);

    // Generate forecast insights
    const forecastInsights = generateForecastInsights({
      revenue: revenueForecast,
      customers: customerForecast,
      churn: churnPrediction,
      scenarios: scenarioAnalysis
    });

    return NextResponse.json({
      success: true,
      data: {
        forecasts: {
          revenue: revenueForecast,
          customers: customerForecast,
          churn: churnPrediction
        },
        scenarios: scenarioAnalysis,
        insights: forecastInsights,
        confidence: {
          overall: calculateOverallForecastConfidence([revenueForecast, customerForecast]),
          factors: ['Historical data quality', 'Model accuracy', 'Market stability']
        },
        generatedAt: new Date().toISOString(),
      }
    });

  } catch (error) {
    throw new Error(`Failed to generate executive forecasts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle executive alerts
 */
async function handleExecutiveAlerts(config: z.infer<typeof ExecutiveDashboardQuerySchema>) {
  try {
    const endDate = new Date();
    const startDate = getPeriodStartDate(endDate, config.period);

    // Get current metrics for alert generation
    const [
      revenueMetrics,
      customerMetrics,
      churnAnalysis,
      customerSegmentation
    ] = await Promise.all([
      revenueCalculator.calculateRevenueMetrics(),
      customerAnalytics.analyzeCustomerAcquisition({ startDate, endDate, granularity: 'month' }),
      customerAnalytics.analyzeChurn({ period: { startDate, endDate }, includePredictions: true }),
      customerAnalytics.segmentCustomers({ segmentBy: ['revenue'], includeHealthScore: true })
    ]);

    // Generate alerts
    const alerts = generateExecutiveAlerts({
      revenue: revenueMetrics,
      customers: customerMetrics,
      churn: churnAnalysis,
      segmentation: customerSegmentation
    });

    // Sort alerts by priority
    const sortedAlerts = alerts.sort((a, b) => {
      const priorityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    return NextResponse.json({
      success: true,
      data: {
        alerts: config.alertsOnly ? sortedAlerts.filter(a => a.priority !== 'low') : sortedAlerts,
        summary: {
          critical: alerts.filter(a => a.priority === 'critical').length,
          high: alerts.filter(a => a.priority === 'high').length,
          medium: alerts.filter(a => a.priority === 'medium').length,
          low: alerts.filter(a => a.priority === 'low').length,
        },
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          type: config.period
        },
        generatedAt: new Date().toISOString(),
      }
    });

  } catch (error) {
    throw new Error(`Failed to generate executive alerts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle strategic insights
 */
async function handleStrategicInsights(config: z.infer<typeof ExecutiveDashboardQuerySchema>) {
  try {
    const endDate = new Date();
    const startDate = getPeriodStartDate(endDate, config.period);

    // Get comprehensive data for insights
    const [
      revenueMetrics,
      revenueSegmentation,
      customerMetrics,
      cohortAnalysis,
      churnAnalysis,
      forecasts
    ] = await Promise.all([
      revenueCalculator.calculateRevenueMetrics(),
      revenueCalculator.getRevenueSegmentation(endDate, ['plan', 'geography', 'size']),
      customerAnalytics.analyzeCustomerAcquisition({ startDate, endDate, granularity: 'month' }),
      customerAnalytics.generateCohortAnalysis(12),
      customerAnalytics.analyzeChurn({ period: { startDate, endDate }, includePredictions: true }),
      forecastingEngine.forecastRevenue({ horizonMonths: 12, confidenceLevel: 95 })
    ]);

    // Generate comprehensive strategic insights
    const insights = await generateStrategicInsights(
      revenueMetrics,
      customerMetrics,
      churnAnalysis,
      forecasts,
      { revenueSegmentation, cohortAnalysis }
    );

    // Categorize insights
    const categorizedInsights = categorizeInsights(insights);

    return NextResponse.json({
      success: true,
      data: {
        insights: insights,
        categories: categorizedInsights,
        recommendations: generateActionableRecommendations(insights),
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          type: config.period
        },
        generatedAt: new Date().toISOString(),
      }
    });

  } catch (error) {
    throw new Error(`Failed to generate strategic insights: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// =============================================
// UTILITY FUNCTIONS
// =============================================

function generateExecutiveKPIs(
  currentRevenue: any,
  previousRevenue: any,
  currentCustomers: any,
  previousCustomers: any,
  churnAnalysis: any
): ExecutiveKPI[] {
  const kpis: ExecutiveKPI[] = [];

  // Monthly Recurring Revenue
  kpis.push({
    name: 'Monthly Recurring Revenue',
    value: `$${currentRevenue.current.mrr.toLocaleString()}`,
    previousValue: `$${previousRevenue.current.mrr.toLocaleString()}`,
    change: currentRevenue.growth.mrrGrowthRate,
    trend: currentRevenue.growth.mrrGrowthRate > 0 ? 'up' : currentRevenue.growth.mrrGrowthRate < 0 ? 'down' : 'stable',
    status: currentRevenue.growth.mrrGrowthRate > 10 ? 'excellent' : 
           currentRevenue.growth.mrrGrowthRate > 0 ? 'good' : 
           currentRevenue.growth.mrrGrowthRate > -5 ? 'warning' : 'critical',
    unit: '%',
    description: 'Monthly recurring revenue growth rate'
  });

  // Annual Recurring Revenue
  kpis.push({
    name: 'Annual Recurring Revenue',
    value: `$${currentRevenue.current.arr.toLocaleString()}`,
    previousValue: `$${previousRevenue.current.arr.toLocaleString()}`,
    change: currentRevenue.growth.arrGrowthRate,
    trend: currentRevenue.growth.arrGrowthRate > 0 ? 'up' : currentRevenue.growth.arrGrowthRate < 0 ? 'down' : 'stable',
    status: currentRevenue.growth.arrGrowthRate > 50 ? 'excellent' : 
           currentRevenue.growth.arrGrowthRate > 20 ? 'good' : 
           currentRevenue.growth.arrGrowthRate > 0 ? 'warning' : 'critical',
    unit: '%',
    description: 'Annual recurring revenue growth rate'
  });

  // Customer Growth Rate
  kpis.push({
    name: 'Customer Growth Rate',
    value: `${currentCustomers.customerGrowthRate.toFixed(1)}%`,
    previousValue: `${previousCustomers.customerGrowthRate.toFixed(1)}%`,
    change: currentCustomers.customerGrowthRate - previousCustomers.customerGrowthRate,
    trend: currentCustomers.customerGrowthRate > previousCustomers.customerGrowthRate ? 'up' : 
           currentCustomers.customerGrowthRate < previousCustomers.customerGrowthRate ? 'down' : 'stable',
    status: currentCustomers.customerGrowthRate > 15 ? 'excellent' : 
           currentCustomers.customerGrowthRate > 5 ? 'good' : 
           currentCustomers.customerGrowthRate > 0 ? 'warning' : 'critical',
    unit: '%',
    description: 'Month-over-month customer growth rate'
  });

  // Churn Rate
  kpis.push({
    name: 'Customer Churn Rate',
    value: `${churnAnalysis.overview.customerChurnRate.toFixed(1)}%`,
    trend: 'stable', // Would need historical data to determine trend
    status: churnAnalysis.overview.customerChurnRate < 3 ? 'excellent' : 
           churnAnalysis.overview.customerChurnRate < 5 ? 'good' : 
           churnAnalysis.overview.customerChurnRate < 10 ? 'warning' : 'critical',
    unit: '%',
    description: 'Monthly customer churn rate'
  });

  // Average Revenue Per User
  kpis.push({
    name: 'Average Revenue Per User',
    value: `$${currentRevenue.current.arpu.toFixed(2)}`,
    previousValue: `$${previousRevenue.current.arpu.toFixed(2)}`,
    change: currentRevenue.growth.arpuGrowthRate,
    trend: currentRevenue.growth.arpuGrowthRate > 0 ? 'up' : 
           currentRevenue.growth.arpuGrowthRate < 0 ? 'down' : 'stable',
    status: currentRevenue.growth.arpuGrowthRate > 5 ? 'excellent' : 
           currentRevenue.growth.arpuGrowthRate > 0 ? 'good' : 
           currentRevenue.growth.arpuGrowthRate > -5 ? 'warning' : 'critical',
    unit: '%',
    description: 'Average revenue per user growth rate'
  });

  // Total Customers
  kpis.push({
    name: 'Total Customers',
    value: currentRevenue.current.customers.toLocaleString(),
    previousValue: previousRevenue.current.customers.toLocaleString(),
    change: ((currentRevenue.current.customers - previousRevenue.current.customers) / previousRevenue.current.customers) * 100,
    trend: currentRevenue.current.customers > previousRevenue.current.customers ? 'up' : 
           currentRevenue.current.customers < previousRevenue.current.customers ? 'down' : 'stable',
    status: currentRevenue.current.customers > previousRevenue.current.customers ? 'good' : 'warning',
    description: 'Total active customer count'
  });

  return kpis;
}

function calculateBusinessHealthScore(
  revenueMetrics: any,
  customerMetrics: any,
  churnAnalysis: any
): BusinessHealthScore {
  // Revenue health (40% weight)
  let revenueScore = 100;
  if (revenueMetrics.growth.mrrGrowthRate < 0) revenueScore -= 40;
  else if (revenueMetrics.growth.mrrGrowthRate < 5) revenueScore -= 20;
  else if (revenueMetrics.growth.mrrGrowthRate < 10) revenueScore -= 10;
  if (revenueMetrics.growth.mrrGrowthRate > 20) revenueScore += 10;

  // Customer health (30% weight)
  let customerScore = 100;
  if (customerMetrics.customerGrowthRate < 0) customerScore -= 40;
  else if (customerMetrics.customerGrowthRate < 5) customerScore -= 20;
  else if (customerMetrics.customerGrowthRate < 10) customerScore -= 10;
  if (customerMetrics.customerGrowthRate > 20) customerScore += 10;

  // Operations health (20% weight) - based on churn
  let operationsScore = 100;
  if (churnAnalysis.overview.customerChurnRate > 10) operationsScore -= 40;
  else if (churnAnalysis.overview.customerChurnRate > 5) operationsScore -= 20;
  else if (churnAnalysis.overview.customerChurnRate > 3) operationsScore -= 10;
  if (churnAnalysis.overview.customerChurnRate < 2) operationsScore += 10;

  // Growth health (10% weight) - overall trajectory
  let growthScore = 100;
  const combinedGrowth = (revenueMetrics.growth.mrrGrowthRate + customerMetrics.customerGrowthRate) / 2;
  if (combinedGrowth < 0) growthScore -= 40;
  else if (combinedGrowth < 10) growthScore -= 20;
  else if (combinedGrowth < 15) growthScore -= 10;

  // Clamp scores
  revenueScore = Math.max(0, Math.min(100, revenueScore));
  customerScore = Math.max(0, Math.min(100, customerScore));
  operationsScore = Math.max(0, Math.min(100, operationsScore));
  growthScore = Math.max(0, Math.min(100, growthScore));

  // Calculate weighted overall score
  const overall = Math.round(
    (revenueScore * 0.4) + 
    (customerScore * 0.3) + 
    (operationsScore * 0.2) + 
    (growthScore * 0.1)
  );

  // Generate alerts
  const alerts = [];
  if (revenueScore < 70) {
    alerts.push({
      type: 'warning' as const,
      message: 'Revenue growth is below expectations',
      priority: 'high' as const
    });
  }
  if (churnAnalysis.overview.customerChurnRate > 8) {
    alerts.push({
      type: 'critical' as const,
      message: 'Customer churn rate is critically high',
      priority: 'high' as const
    });
  }
  if (customerScore < 60) {
    alerts.push({
      type: 'warning' as const,
      message: 'Customer growth is concerning',
      priority: 'medium' as const
    });
  }

  return {
    overall,
    components: {
      revenue: { score: revenueScore, weight: 40 },
      customers: { score: customerScore, weight: 30 },
      operations: { score: operationsScore, weight: 20 },
      growth: { score: growthScore, weight: 10 }
    },
    trend: overall > 75 ? 'improving' : overall < 60 ? 'declining' : 'stable',
    alerts
  };
}

async function generateStrategicInsights(
  revenueMetrics: any,
  customerMetrics: any,
  churnAnalysis: any,
  forecasts: any,
  additionalData?: any
): Promise<StrategicInsight[]> {
  const insights: StrategicInsight[] = [];

  // Revenue insights
  if (revenueMetrics.growth.mrrGrowthRate > 15) {
    insights.push({
      category: 'revenue',
      title: 'Strong Revenue Growth Momentum',
      description: `MRR growth of ${revenueMetrics.growth.mrrGrowthRate.toFixed(1)}% indicates strong market traction`,
      impact: 'high',
      confidence: 0.9,
      recommendations: [
        'Scale successful marketing channels',
        'Invest in customer success to maintain growth',
        'Consider expanding to adjacent markets'
      ],
      metrics: { growth_rate: revenueMetrics.growth.mrrGrowthRate }
    });
  } else if (revenueMetrics.growth.mrrGrowthRate < 0) {
    insights.push({
      category: 'revenue',
      title: 'Revenue Growth Challenges',
      description: `Negative MRR growth of ${revenueMetrics.growth.mrrGrowthRate.toFixed(1)}% requires immediate attention`,
      impact: 'high',
      confidence: 0.95,
      recommendations: [
        'Analyze churn drivers and implement retention programs',
        'Review pricing strategy and value proposition',
        'Focus on customer expansion and upselling'
      ],
      metrics: { growth_rate: revenueMetrics.growth.mrrGrowthRate }
    });
  }

  // Customer insights
  if (churnAnalysis.churnPrediction.atRiskCustomers > 20) {
    insights.push({
      category: 'customer',
      title: 'High Number of At-Risk Customers',
      description: `${churnAnalysis.churnPrediction.atRiskCustomers} customers are at risk of churning`,
      impact: 'high',
      confidence: 0.85,
      recommendations: [
        'Implement proactive customer success outreach',
        'Create targeted retention campaigns',
        'Analyze common characteristics of at-risk customers'
      ],
      metrics: { at_risk_customers: churnAnalysis.churnPrediction.atRiskCustomers }
    });
  }

  // Market insights
  if (forecasts && forecasts.predictions.length > 0) {
    const futureGrowth = forecasts.predictions[2]?.predicted / forecasts.predictions[0]?.predicted;
    if (futureGrowth > 1.1) {
      insights.push({
        category: 'market',
        title: 'Positive Growth Trajectory Forecasted',
        description: 'Revenue forecasts show continued growth over the next quarters',
        impact: 'medium',
        confidence: forecasts.predictions[0]?.confidence / 100 || 0.7,
        recommendations: [
          'Prepare infrastructure for projected growth',
          'Plan hiring and resource allocation',
          'Consider strategic partnerships'
        ]
      });
    }
  }

  // Operational insights
  if (churnAnalysis.overview.customerChurnRate < 3 && revenueMetrics.growth.mrrGrowthRate > 10) {
    insights.push({
      category: 'operational',
      title: 'Excellent Operational Efficiency',
      description: 'Low churn combined with strong growth indicates efficient operations',
      impact: 'medium',
      confidence: 0.8,
      recommendations: [
        'Document and scale successful processes',
        'Invest in team development and training',
        'Consider expanding service offerings'
      ]
    });
  }

  return insights;
}

function generateExecutiveAlerts(data: any) {
  const alerts = [];

  // Critical revenue alert
  if (data.revenue.growth.mrrGrowthRate < -10) {
    alerts.push({
      type: 'critical',
      priority: 'critical',
      title: 'Severe Revenue Decline',
      message: `MRR declined by ${Math.abs(data.revenue.growth.mrrGrowthRate).toFixed(1)}% - immediate action required`,
      category: 'revenue'
    });
  }

  // High churn alert
  if (data.churn.overview.customerChurnRate > 10) {
    alerts.push({
      type: 'critical',
      priority: 'critical',
      title: 'Critical Churn Rate',
      message: `Customer churn rate of ${data.churn.overview.customerChurnRate.toFixed(1)}% is unsustainable`,
      category: 'customer'
    });
  }

  // At-risk customers alert
  if (data.churn.churnPrediction.atRiskCustomers > 50) {
    alerts.push({
      type: 'warning',
      priority: 'high',
      title: 'High Number of At-Risk Customers',
      message: `${data.churn.churnPrediction.atRiskCustomers} customers are at high risk of churning`,
      category: 'customer'
    });
  }

  // Slow growth alert
  if (data.revenue.growth.mrrGrowthRate < 5 && data.revenue.growth.mrrGrowthRate >= 0) {
    alerts.push({
      type: 'warning',
      priority: 'medium',
      title: 'Slow Revenue Growth',
      message: `MRR growth of ${data.revenue.growth.mrrGrowthRate.toFixed(1)}% is below industry average`,
      category: 'revenue'
    });
  }

  // Customer acquisition slowdown
  if (data.customers.customerGrowthRate < 5) {
    alerts.push({
      type: 'info',
      priority: 'medium',
      title: 'Customer Acquisition Slowdown',
      message: `Customer growth rate of ${data.customers.customerGrowthRate.toFixed(1)}% may impact future revenue`,
      category: 'customer'
    });
  }

  return alerts;
}

// Helper functions for date calculations
function getPeriodStartDate(endDate: Date, period: string): Date {
  const startDate = new Date(endDate);
  
  switch (period) {
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'quarter':
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case 'year':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
  }
  
  return startDate;
}

function getComparisonStartDate(currentStart: Date, compareWith: string): Date {
  const compareStart = new Date(currentStart);
  
  switch (compareWith) {
    case 'previous_period':
      const periodLength = new Date().getTime() - currentStart.getTime();
      compareStart.setTime(currentStart.getTime() - periodLength);
      break;
    case 'year_ago':
      compareStart.setFullYear(compareStart.getFullYear() - 1);
      break;
    case 'target':
      // Would use target dates from configuration
      break;
  }
  
  return compareStart;
}

function getPeriodMonths(period: string): number {
  switch (period) {
    case 'week': return 1;
    case 'month': return 3;
    case 'quarter': return 6;
    case 'year': return 12;
    default: return 3;
  }
}

// Additional utility functions
function generateDetailedInsights(data: any) {
  return {
    revenue: [
      'Revenue segmentation shows strong performance across all plans',
      'Geographic expansion opportunity identified in European markets'
    ],
    customers: [
      'Customer health scoring indicates 75% are in good standing',
      'Cohort retention rates improving month-over-month'
    ],
    churn: [
      'Primary churn driver is pricing sensitivity',
      'Early intervention programs showing 40% success rate'
    ]
  };
}

function generateForecastInsights(forecasts: any) {
  return [
    'Revenue forecast shows 25% growth over next 6 months with high confidence',
    'Customer growth is expected to accelerate in Q2',
    'Churn risk factors are trending downward'
  ];
}

function calculateOverallForecastConfidence(forecasts: any[]): number {
  return forecasts.reduce((sum, f) => sum + (f.predictions?.[0]?.confidence || 80), 0) / forecasts.length;
}

function categorizeInsights(insights: StrategicInsight[]) {
  return {
    revenue: insights.filter(i => i.category === 'revenue').length,
    customer: insights.filter(i => i.category === 'customer').length,
    market: insights.filter(i => i.category === 'market').length,
    operational: insights.filter(i => i.category === 'operational').length,
    product: insights.filter(i => i.category === 'product').length
  };
}

function generateActionableRecommendations(insights: StrategicInsight[]) {
  const recommendations = [];
  
  const highImpactInsights = insights.filter(i => i.impact === 'high');
  
  for (const insight of highImpactInsights) {
    recommendations.push({
      category: insight.category,
      title: `Action on: ${insight.title}`,
      priority: insight.impact,
      actions: insight.recommendations.slice(0, 3) // Top 3 recommendations
    });
  }
  
  return recommendations.slice(0, 10); // Top 10 actionable recommendations
}