/**
 * EPIC 5 STORY 5.5: Usage Analytics API Route
 * Provides comprehensive usage analytics, ROI metrics, and upgrade recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import subscriptionAnalytics from '@/lib/payments/subscription-analytics';
import { z } from 'zod';

// =============================================
// VALIDATION SCHEMAS
// =============================================

const QuerySchema = z.object({
  period: z.enum(['week', 'month', 'quarter']).default('month'),
});

// =============================================
// TYPES AND INTERFACES
// =============================================

interface UsageMetric {
  name: string;
  category: string;
  current: number;
  limit: number;
  unit: string;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
  isNearLimit: boolean;
  isOverLimit: boolean;
  description: string;
}

interface ROIMetric {
  name: string;
  value: number;
  unit: string;
  description: string;
  comparison: {
    period: string;
    value: number;
    change: number;
  };
}

interface UpgradeRecommendation {
  reason: string;
  benefit: string;
  estimatedValue: number;
  planSuggestion: {
    name: string;
    price: number;
    features: string[];
  };
}

// =============================================
// API HANDLER
// =============================================

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    
    // Validate query parameters
    const query = QuerySchema.parse({
      period: searchParams.get('period') || 'month',
    });

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    // Get user's subscription
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq('user_id', user.id)
      .single();

    if (subscriptionError && subscriptionError.code !== 'PGRST116') {
      console.error('Subscription fetch error:', subscriptionError);
      return NextResponse.json(
        { error: 'Failed to fetch subscription data' },
        { status: 500 }
      );
    }

    // Calculate period dates
    const now = new Date();
    const periodStart = new Date();
    
    switch (query.period) {
      case 'week':
        periodStart.setDate(now.getDate() - 7);
        break;
      case 'month':
        periodStart.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        periodStart.setMonth(now.getMonth() - 3);
        break;
    }

    // Get usage metrics (mock data - in production this would come from actual usage tracking)
    const usageMetrics: UsageMetric[] = subscription ? [
      {
        name: 'Business Listings',
        category: 'Content',
        current: 3,
        limit: subscription.plan?.metadata?.listings_limit || 10,
        unit: 'listings',
        percentage: (3 / (subscription.plan?.metadata?.listings_limit || 10)) * 100,
        trend: 'up',
        trendPercentage: 15.3,
        isNearLimit: false,
        isOverLimit: false,
        description: 'Total business listings created and managed',
      },
      {
        name: 'Photo Uploads',
        category: 'Media',
        current: 47,
        limit: subscription.plan?.metadata?.photos_limit || 100,
        unit: 'photos',
        percentage: (47 / (subscription.plan?.metadata?.photos_limit || 100)) * 100,
        trend: 'up',
        trendPercentage: 23.7,
        isNearLimit: true,
        isOverLimit: false,
        description: 'Photos uploaded across all business listings',
      },
      {
        name: 'Monthly Page Views',
        category: 'Traffic',
        current: 1250,
        limit: subscription.plan?.metadata?.pageviews_limit || 5000,
        unit: 'views',
        percentage: (1250 / (subscription.plan?.metadata?.pageviews_limit || 5000)) * 100,
        trend: 'up',
        trendPercentage: 8.4,
        isNearLimit: false,
        isOverLimit: false,
        description: 'Total page views across all your business listings',
      },
      {
        name: 'Customer Inquiries',
        category: 'Engagement',
        current: 28,
        limit: subscription.plan?.metadata?.inquiries_limit || 100,
        unit: 'inquiries',
        percentage: (28 / (subscription.plan?.metadata?.inquiries_limit || 100)) * 100,
        trend: 'up',
        trendPercentage: 12.1,
        isNearLimit: false,
        isOverLimit: false,
        description: 'Customer inquiries received through your listings',
      },
      {
        name: 'API Calls',
        category: 'Technical',
        current: 890,
        limit: subscription.plan?.metadata?.api_calls_limit || 1000,
        unit: 'calls',
        percentage: (890 / (subscription.plan?.metadata?.api_calls_limit || 1000)) * 100,
        trend: 'stable',
        trendPercentage: 2.1,
        isNearLimit: true,
        isOverLimit: false,
        description: 'API calls made this period',
      },
    ] : [];

    // Update limit flags
    usageMetrics.forEach(metric => {
      metric.isNearLimit = metric.percentage >= 80 && metric.percentage < 100;
      metric.isOverLimit = metric.percentage >= 100;
    });

    // Calculate ROI metrics
    const roiMetrics: ROIMetric[] = subscription ? [
      {
        name: 'Customer Acquisition Cost',
        value: 45.50,
        unit: 'currency',
        description: 'Average cost to acquire a new customer through the platform',
        comparison: {
          period: 'Previous month',
          value: 52.30,
          change: -13.0,
        },
      },
      {
        name: 'Average Order Value',
        value: 127.80,
        unit: 'currency',
        description: 'Average value of orders generated through your listings',
        comparison: {
          period: 'Previous month',
          value: 118.40,
          change: 7.9,
        },
      },
      {
        name: 'Conversion Rate',
        value: 3.2,
        unit: 'percentage',
        description: 'Percentage of visitors who become customers',
        comparison: {
          period: 'Previous month',
          value: 2.8,
          change: 14.3,
        },
      },
      {
        name: 'Return on Investment',
        value: 280,
        unit: 'percentage',
        description: 'Overall ROI from platform investment',
        comparison: {
          period: 'Previous month',
          value: 245,
          change: 14.3,
        },
      },
    ] : [];

    // Generate upgrade recommendations
    const upgradeRecommendations: UpgradeRecommendation[] = [];
    
    if (subscription) {
      const nearLimitMetrics = usageMetrics.filter(m => m.isNearLimit || m.isOverLimit);
      
      if (nearLimitMetrics.length > 0) {
        upgradeRecommendations.push({
          reason: `You're approaching limits on ${nearLimitMetrics.length} features`,
          benefit: 'Upgrade to unlock higher limits and avoid service interruptions',
          estimatedValue: 150.00,
          planSuggestion: {
            name: 'Premium Plan',
            price: 4900, // $49.00 in cents
            features: [
              '50 Business Listings',
              '500 Photo Uploads',
              '25,000 Monthly Page Views',
              '500 Customer Inquiries',
              '10,000 API Calls',
              'Priority Support',
            ],
          },
        });
      }

      // Check for high ROI potential
      const conversionRate = roiMetrics.find(m => m.name === 'Conversion Rate');
      if (conversionRate && conversionRate.comparison.change > 10) {
        upgradeRecommendations.push({
          reason: 'Your conversion rate is trending up (+14.3%)',
          benefit: 'Advanced analytics can help you optimize further and increase revenue',
          estimatedValue: 320.00,
          planSuggestion: {
            name: 'Professional Plan',
            price: 9900, // $99.00 in cents
            features: [
              'Everything in Premium',
              'Advanced Analytics Dashboard',
              'A/B Testing Tools',
              'Custom Reporting',
              'Dedicated Account Manager',
            ],
          },
        });
      }
    }

    // Calculate summary metrics
    const totalValue = roiMetrics.reduce((sum, metric) => {
      if (metric.unit === 'currency') {
        return sum + metric.value;
      }
      return sum;
    }, 0);

    const efficiency = usageMetrics.reduce((sum, metric) => sum + metric.percentage, 0) / usageMetrics.length || 0;
    
    const growthRate = usageMetrics.reduce((sum, metric) => {
      return sum + (metric.trend === 'up' ? metric.trendPercentage : 0);
    }, 0) / usageMetrics.filter(m => m.trend === 'up').length || 0;

    return NextResponse.json({
      usageMetrics,
      roiMetrics,
      upgradeRecommendations,
      summary: {
        totalValue,
        efficiency,
        growthRate,
      },
    });

  } catch (error) {
    console.error('Usage analytics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================
// UTILITY FUNCTIONS
// =============================================

function calculateTrendPercentage(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function determineTrend(trendPercentage: number): 'up' | 'down' | 'stable' {
  if (Math.abs(trendPercentage) < 5) return 'stable';
  return trendPercentage > 0 ? 'up' : 'down';
}