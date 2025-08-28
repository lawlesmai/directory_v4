/**
 * EPIC 5 STORY 5.7: Payment Failure Recovery & Dunning Management
 * Recovery Analytics API - Performance metrics and insights
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import recoveryAnalytics from '@/lib/analytics/recovery-analytics';
import { withAuth } from '@/lib/api/middleware';

// =============================================
// VALIDATION SCHEMAS
// =============================================

const GetAnalyticsSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  campaignType: z.string().optional(),
  customerSegment: z.string().optional(),
  abTestGroup: z.string().optional(),
  groupBy: z.enum(['date', 'campaign_type', 'customer_segment', 'ab_test_group']).default('date'),
});

const GetTrendsSchema = z.object({
  metric: z.enum(['recovery_rate', 'email_open_rate', 'email_click_rate', 'revenue_recovered', 'roi_percentage']),
  period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  days: z.number().int().min(1).max(365).default(30),
});

const GetABTestSchema = z.object({
  campaignType: z.string(),
  sequenceStep: z.number().int().min(1).max(10),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const GetSegmentAnalysisSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const GetRecommendationsSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// =============================================
// API HANDLERS
// =============================================

/**
 * GET /api/payments/recovery/analytics
 * Get recovery analytics with flexible filtering
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      // Check if user is admin or has analytics access
      const hasAnalyticsAccess = await checkAnalyticsAccess(user.id);
      if (!hasAnalyticsAccess) {
        return NextResponse.json(
          { error: 'Access denied. Analytics access required.' },
          { status: 403 }
        );
      }

      const { searchParams } = new URL(req.url);
      const query = {
        startDate: searchParams.get('startDate')!,
        endDate: searchParams.get('endDate')!,
        campaignType: searchParams.get('campaignType') || undefined,
        customerSegment: searchParams.get('customerSegment') || undefined,
        abTestGroup: searchParams.get('abTestGroup') || undefined,
        groupBy: (searchParams.get('groupBy') as any) || 'date',
      };

      const validatedQuery = GetAnalyticsSchema.parse(query);

      // Get analytics data
      const analyticsData = await recoveryAnalytics.getAnalytics(validatedQuery);

      return NextResponse.json({
        analytics: analyticsData.map(metric => ({
          date: metric.date,
          campaignType: metric.campaignType,
          abTestGroup: metric.abTestGroup,
          failureReason: metric.failureReason,
          customerSegment: metric.customerSegment,
          totalFailures: metric.totalFailures,
          totalCampaignsStarted: metric.totalCampaignsStarted,
          totalCampaignsCompleted: metric.totalCampaignsCompleted,
          totalCommunicationsSent: metric.totalCommunicationsSent,
          emailOpenRate: metric.emailOpenRate,
          emailClickRate: metric.emailClickRate,
          smsResponseRate: metric.smsResponseRate,
          recoveryRate: metric.recoveryRate,
          revenueRecovered: metric.revenueRecovered,
          recoveryTimeAvg: metric.recoveryTimeAvg,
          costPerRecovery: metric.costPerRecovery,
          roiPercentage: metric.roiPercentage,
        })),
        filters: validatedQuery,
        total: analyticsData.length,
      });
    } catch (error) {
      console.error('Get analytics API error:', error);
      
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request parameters', details: error.errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to get analytics' },
        { status: 500 }
      );
    }
  });
}

/**
 * GET /api/payments/recovery/analytics/trends
 * Get performance trends for specific metrics
 */
export async function getTrends(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const hasAnalyticsAccess = await checkAnalyticsAccess(user.id);
      if (!hasAnalyticsAccess) {
        return NextResponse.json(
          { error: 'Access denied. Analytics access required.' },
          { status: 403 }
        );
      }

      const { searchParams } = new URL(req.url);
      const query = {
        metric: searchParams.get('metric') as any,
        period: (searchParams.get('period') as any) || 'daily',
        days: parseInt(searchParams.get('days') || '30'),
      };

      const { metric, period, days } = GetTrendsSchema.parse(query);

      const trends = await recoveryAnalytics.getPerformanceTrends(metric, period, days);

      return NextResponse.json({
        metric: trends.metric,
        period: trends.period,
        data: trends.data,
      });
    } catch (error) {
      console.error('Get trends API error:', error);
      
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request parameters', details: error.errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to get trends' },
        { status: 500 }
      );
    }
  });
}

/**
 * GET /api/payments/recovery/analytics/ab-test
 * Get A/B test results and statistical significance
 */
export async function getABTest(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const hasAnalyticsAccess = await checkAnalyticsAccess(user.id);
      if (!hasAnalyticsAccess) {
        return NextResponse.json(
          { error: 'Access denied. Analytics access required.' },
          { status: 403 }
        );
      }

      const { searchParams } = new URL(req.url);
      const query = {
        campaignType: searchParams.get('campaignType')!,
        sequenceStep: parseInt(searchParams.get('sequenceStep')!),
        startDate: searchParams.get('startDate')!,
        endDate: searchParams.get('endDate') || undefined,
      };

      const { campaignType, sequenceStep, startDate, endDate } = GetABTestSchema.parse(query);

      const abTestResults = await recoveryAnalytics.analyzeABTest(
        campaignType,
        sequenceStep,
        startDate,
        endDate
      );

      return NextResponse.json({
        testId: abTestResults.testId,
        testName: abTestResults.testName,
        campaignType: abTestResults.campaignType,
        sequenceStep: abTestResults.sequenceStep,
        startDate: abTestResults.startDate,
        endDate: abTestResults.endDate,
        status: abTestResults.status,
        controlGroup: {
          name: abTestResults.controlGroup.name,
          description: abTestResults.controlGroup.description,
          participants: abTestResults.controlGroup.participants,
          conversions: abTestResults.controlGroup.conversions,
          conversionRate: abTestResults.controlGroup.conversionRate,
          revenueRecovered: abTestResults.controlGroup.revenueRecovered,
          avgRecoveryTime: abTestResults.controlGroup.avgRecoveryTime,
        },
        variants: abTestResults.variants.map(variant => ({
          name: variant.name,
          description: variant.description,
          participants: variant.participants,
          conversions: variant.conversions,
          conversionRate: variant.conversionRate,
          revenueRecovered: variant.revenueRecovered,
          avgRecoveryTime: variant.avgRecoveryTime,
        })),
        winner: abTestResults.winner,
        confidence: abTestResults.confidence,
        significanceLevel: abTestResults.significanceLevel,
      });
    } catch (error) {
      console.error('Get A/B test API error:', error);
      
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request parameters', details: error.errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to get A/B test results' },
        { status: 500 }
      );
    }
  });
}

/**
 * GET /api/payments/recovery/analytics/segments
 * Get customer segment analysis
 */
export async function getSegmentAnalysis(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const hasAnalyticsAccess = await checkAnalyticsAccess(user.id);
      if (!hasAnalyticsAccess) {
        return NextResponse.json(
          { error: 'Access denied. Analytics access required.' },
          { status: 403 }
        );
      }

      const { searchParams } = new URL(req.url);
      const query = {
        startDate: searchParams.get('startDate')!,
        endDate: searchParams.get('endDate')!,
      };

      const { startDate, endDate } = GetSegmentAnalysisSchema.parse(query);

      const segmentAnalyses = await recoveryAnalytics.analyzeCustomerSegments(startDate, endDate);

      return NextResponse.json({
        segments: segmentAnalyses.map(analysis => ({
          segment: analysis.segment,
          totalCustomers: analysis.totalCustomers,
          totalFailures: analysis.totalFailures,
          recoveryRate: analysis.recoveryRate,
          avgRecoveryTime: analysis.avgRecoveryTime,
          revenueRecovered: analysis.revenueRecovered,
          costPerRecovery: analysis.costPerRecovery,
          roi: analysis.roi,
          preferredChannels: analysis.preferredChannels,
          optimalTimings: analysis.optimalTimings,
        })),
      });
    } catch (error) {
      console.error('Get segment analysis API error:', error);
      
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request parameters', details: error.errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to get segment analysis' },
        { status: 500 }
      );
    }
  });
}

/**
 * GET /api/payments/recovery/analytics/recommendations
 * Get optimization recommendations based on analytics
 */
export async function getRecommendations(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const hasAnalyticsAccess = await checkAnalyticsAccess(user.id);
      if (!hasAnalyticsAccess) {
        return NextResponse.json(
          { error: 'Access denied. Analytics access required.' },
          { status: 403 }
        );
      }

      const { searchParams } = new URL(req.url);
      const query = {
        startDate: searchParams.get('startDate')!,
        endDate: searchParams.get('endDate')!,
      };

      const { startDate, endDate } = GetRecommendationsSchema.parse(query);

      const recommendations = await recoveryAnalytics.generateOptimizationRecommendations(
        startDate,
        endDate
      );

      return NextResponse.json({
        recommendations: recommendations.recommendations.map(rec => ({
          type: rec.type,
          priority: rec.priority,
          title: rec.title,
          description: rec.description,
          expectedImpact: rec.expectedImpact,
          implementation: rec.implementation,
          confidence: rec.confidence,
        })),
        summary: {
          totalFailures: recommendations.summary.totalFailures,
          totalRecovered: recommendations.summary.totalRecovered,
          overallRecoveryRate: recommendations.summary.overallRecoveryRate,
          totalRevenueRecovered: recommendations.summary.totalRevenueRecovered,
          averageROI: recommendations.summary.averageROI,
        },
      });
    } catch (error) {
      console.error('Get recommendations API error:', error);
      
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request parameters', details: error.errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to get recommendations' },
        { status: 500 }
      );
    }
  });
}

/**
 * POST /api/payments/recovery/analytics/generate
 * Generate daily metrics (for admin/background job use)
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      // Check if user is admin
      const isAdmin = await checkAdminAccess(user.id);
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Access denied. Admin access required.' },
          { status: 403 }
        );
      }

      const body = await req.json();
      const { date } = z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }).parse(body);

      const metrics = await recoveryAnalytics.generateDailyMetrics(date);

      return NextResponse.json({
        success: true,
        date: date || new Date().toISOString().split('T')[0],
        metricsGenerated: metrics.length,
        metrics: metrics.map(metric => ({
          campaignType: metric.campaignType,
          customerSegment: metric.customerSegment,
          totalFailures: metric.totalFailures,
          recoveryRate: metric.recoveryRate,
          revenueRecovered: metric.revenueRecovered,
        })),
      });
    } catch (error) {
      console.error('Generate analytics API error:', error);
      
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request data', details: error.errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to generate analytics' },
        { status: 500 }
      );
    }
  });
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Check if user has analytics access
 */
async function checkAnalyticsAccess(userId: string): Promise<boolean> {
  try {
    const supabase = createClient();
    
    // Check if user is admin or has analytics role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', userId)
      .single();

    const allowedRoles = ['admin', 'super_admin', 'analytics'];
    return userRole?.roles?.name && allowedRoles.includes(userRole.roles.name);
  } catch (error) {
    return false;
  }
}

/**
 * Check if user has admin access
 */
async function checkAdminAccess(userId: string): Promise<boolean> {
  try {
    const supabase = createClient();
    
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', userId)
      .single();

    const adminRoles = ['admin', 'super_admin'];
    return userRole?.roles?.name && adminRoles.includes(userRole.roles.name);
  } catch (error) {
    return false;
  }
}