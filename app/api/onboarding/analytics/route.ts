/**
 * Onboarding Analytics API Routes
 * Epic 2 Story 2.5: User Onboarding and Email Verification Infrastructure
 * 
 * Provides analytics data for onboarding flows, user engagement, and insights
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { onboardingAnalyticsService } from '@/lib/auth/onboarding-analytics';

/**
 * GET /api/onboarding/analytics
 * Get onboarding analytics and insights
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get user from session and check admin permissions
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has admin permissions
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select(`
        role_id,
        roles!inner(name)
      `)
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (rolesError) throw rolesError;

    const hasAdminRole = userRoles?.some((ur: any) => 
      ['admin', 'super_admin'].includes((ur.roles as any).name)
    );

    if (!hasAdminRole) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const flowId = searchParams.get('flowId');
    const type = searchParams.get('type') || 'overview';
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');
    const userId = searchParams.get('userId'); // For user-specific analytics

    // Default date range (last 30 days)
    const dateRange = {
      from: fromDate ? new Date(fromDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      to: toDate ? new Date(toDate) : new Date(),
    };

    switch (type) {
      case 'flow_analytics':
        if (!flowId) {
          return NextResponse.json(
            { error: 'Flow ID is required for flow analytics' },
            { status: 400 }
          );
        }

        const flowAnalytics = await onboardingAnalyticsService.generateFlowAnalytics(
          flowId,
          dateRange
        );

        if (!flowAnalytics) {
          return NextResponse.json(
            { error: 'Failed to generate flow analytics' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          analytics: flowAnalytics,
        });

      case 'user_engagement':
        if (!userId) {
          return NextResponse.json(
            { error: 'User ID is required for user engagement analytics' },
            { status: 400 }
          );
        }

        const userEngagement = await onboardingAnalyticsService.getUserEngagementData(userId);

        if (!userEngagement) {
          return NextResponse.json(
            { error: 'User engagement data not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          engagement: userEngagement,
        });

      case 'insights':
        if (!flowId) {
          return NextResponse.json(
            { error: 'Flow ID is required for insights' },
            { status: 400 }
          );
        }

        const insights = await onboardingAnalyticsService.generateOnboardingInsights(
          flowId,
          dateRange
        );

        return NextResponse.json({
          success: true,
          insights,
        });

      case 'overview':
      default:
        // Get list of available flows with basic metrics
        const { data: flows, error: flowsError } = await supabase
          .from('onboarding_flows')
          .select('id, name, display_name, flow_type')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (flowsError) throw flowsError;

        // Get analytics for each flow
        const flowsWithAnalytics = await Promise.all(
          (flows || []).map(async (flow: any) => {
            const analytics = await onboardingAnalyticsService.generateFlowAnalytics(
              flow.id,
              dateRange
            );

            return {
              ...flow,
              metrics: analytics?.metrics || null,
            };
          })
        );

        return NextResponse.json({
          success: true,
          overview: {
            dateRange,
            flows: flowsWithAnalytics,
            totalFlows: flows?.length || 0,
          },
        });
    }

  } catch (error) {
    console.error('Error fetching onboarding analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/onboarding/analytics
 * Generate and store analytics data (for scheduled jobs)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Verify this is an internal request (in production, you'd use a proper auth mechanism)
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.INTERNAL_API_TOKEN;

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { flowId, dateRange } = body;

    if (!flowId) {
      return NextResponse.json(
        { error: 'Flow ID is required' },
        { status: 400 }
      );
    }

    const range = dateRange || {
      from: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      to: new Date(),
    };

    // Generate analytics
    const analytics = await onboardingAnalyticsService.generateFlowAnalytics(
      flowId,
      {
        from: new Date(range.from),
        to: new Date(range.to),
      }
    );

    if (!analytics) {
      return NextResponse.json(
        { error: 'Failed to generate analytics' },
        { status: 500 }
      );
    }

    // Store analytics data
    const stored = await onboardingAnalyticsService.storeAnalyticsData(analytics);

    if (!stored) {
      return NextResponse.json(
        { error: 'Failed to store analytics data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Analytics generated and stored successfully',
      flowId,
      dateRange: range,
      metrics: analytics.metrics,
    });

  } catch (error) {
    console.error('Error generating analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}