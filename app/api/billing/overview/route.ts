/**
 * EPIC 5 STORY 5.5: Billing Overview API Route
 * Provides comprehensive billing status, usage metrics, and payment method health
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// =============================================
// TYPES AND INTERFACES
// =============================================

interface BillingStatus {
  isActive: boolean;
  nextBillingDate: Date;
  daysUntilBilling: number;
  currentAmount: number;
  currency: string;
  status: 'active' | 'past_due' | 'trialing' | 'canceled' | 'paused';
  trialEndsAt?: Date;
  cancelAtPeriodEnd: boolean;
}

interface UsageMetric {
  name: string;
  current: number;
  limit: number;
  unit: string;
  percentage: number;
  isNearLimit: boolean;
  isOverLimit: boolean;
}

interface PaymentMethodHealth {
  id: string;
  type: 'card' | 'bank_account' | 'paypal';
  last4?: string;
  brand?: string;
  isDefault: boolean;
  isExpiring: boolean;
  expiryDate?: Date;
  hasIssues: boolean;
  issueType?: 'expired' | 'declined' | 'verification_needed';
}

interface BillingAlert {
  id: string;
  type: 'warning' | 'error' | 'info' | 'success';
  message: string;
  action?: string;
  timestamp: Date;
}

// =============================================
// API HANDLER
// =============================================

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    // Get user's subscription data
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

    // Get payment methods
    const { data: paymentMethods, error: paymentMethodsError } = await supabase
      .from('stripe_payment_methods')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (paymentMethodsError) {
      console.error('Payment methods fetch error:', paymentMethodsError);
    }

    // Get usage data (mock data for now - would come from actual usage tracking)
    const usageMetrics: UsageMetric[] = subscription ? [
      {
        name: 'Business Listings',
        current: 3,
        limit: subscription.plan?.metadata?.listings_limit || 10,
        unit: 'listings',
        percentage: (3 / (subscription.plan?.metadata?.listings_limit || 10)) * 100,
        isNearLimit: false,
        isOverLimit: false,
      },
      {
        name: 'Photo Uploads',
        current: 47,
        limit: subscription.plan?.metadata?.photos_limit || 100,
        unit: 'photos',
        percentage: (47 / (subscription.plan?.metadata?.photos_limit || 100)) * 100,
        isNearLimit: true,
        isOverLimit: false,
      },
      {
        name: 'Monthly Page Views',
        current: 1250,
        limit: subscription.plan?.metadata?.pageviews_limit || 5000,
        unit: 'views',
        percentage: (1250 / (subscription.plan?.metadata?.pageviews_limit || 5000)) * 100,
        isNearLimit: false,
        isOverLimit: false,
      },
    ] : [];

    // Mark metrics near or over limits
    usageMetrics.forEach(metric => {
      metric.isNearLimit = metric.percentage >= 80 && metric.percentage < 100;
      metric.isOverLimit = metric.percentage >= 100;
    });

    // Build billing status
    const billingStatus: BillingStatus = subscription ? {
      isActive: subscription.status === 'active',
      nextBillingDate: new Date(subscription.current_period_end),
      daysUntilBilling: Math.ceil(
        (new Date(subscription.current_period_end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      ),
      currentAmount: subscription.plan?.amount || 0,
      currency: subscription.plan?.currency || 'usd',
      status: subscription.status,
      trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end) : undefined,
      cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
    } : {
      isActive: false,
      nextBillingDate: new Date(),
      daysUntilBilling: 0,
      currentAmount: 0,
      currency: 'usd',
      status: 'canceled',
      cancelAtPeriodEnd: false,
    };

    // Build payment method health data
    const paymentMethodHealth: PaymentMethodHealth[] = (paymentMethods || []).map(method => {
      const isExpiring = method.card_exp_month && method.card_exp_year ? 
        new Date(method.card_exp_year, method.card_exp_month - 1) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) :
        false;

      return {
        id: method.id,
        type: method.type as 'card' | 'bank_account' | 'paypal',
        last4: method.card_last4 || method.bank_last4,
        brand: method.card_brand,
        isDefault: method.is_default || false,
        isExpiring,
        expiryDate: method.card_exp_month && method.card_exp_year ? 
          new Date(method.card_exp_year, method.card_exp_month - 1) : 
          undefined,
        hasIssues: isExpiring,
        issueType: isExpiring ? 'expired' as const : undefined,
      };
    });

    // Generate alerts
    const recentAlerts: BillingAlert[] = [];

    // Trial ending alert
    if (billingStatus.status === 'trialing' && billingStatus.trialEndsAt) {
      const daysUntilTrialEnd = Math.ceil(
        (billingStatus.trialEndsAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysUntilTrialEnd <= 7) {
        recentAlerts.push({
          id: 'trial-ending',
          type: 'warning',
          message: `Your free trial ends in ${daysUntilTrialEnd} days. Add a payment method to continue.`,
          action: 'Add Payment Method',
          timestamp: new Date(),
        });
      }
    }

    // Payment method expiring alerts
    paymentMethodHealth.forEach(method => {
      if (method.isExpiring && method.isDefault) {
        recentAlerts.push({
          id: `payment-method-expiring-${method.id}`,
          type: 'warning',
          message: `Your default payment method ending in ${method.last4} is expiring soon.`,
          action: 'Update Payment Method',
          timestamp: new Date(),
        });
      }
    });

    // Usage limit alerts
    usageMetrics.forEach(metric => {
      if (metric.isOverLimit) {
        recentAlerts.push({
          id: `usage-over-${metric.name}`,
          type: 'error',
          message: `You've exceeded your ${metric.name.toLowerCase()} limit (${metric.current}/${metric.limit}).`,
          action: 'Upgrade Plan',
          timestamp: new Date(),
        });
      } else if (metric.isNearLimit) {
        recentAlerts.push({
          id: `usage-near-${metric.name}`,
          type: 'warning',
          message: `You're approaching your ${metric.name.toLowerCase()} limit (${metric.current}/${metric.limit}).`,
          action: 'Upgrade Plan',
          timestamp: new Date(),
        });
      }
    });

    // Subscription cancellation alert
    if (billingStatus.cancelAtPeriodEnd) {
      recentAlerts.push({
        id: 'subscription-ending',
        type: 'warning',
        message: `Your subscription will end on ${billingStatus.nextBillingDate.toLocaleDateString()}.`,
        action: 'Reactivate Subscription',
        timestamp: new Date(),
      });
    }

    // Return comprehensive billing overview
    return NextResponse.json({
      billingStatus,
      usageMetrics,
      paymentMethodHealth,
      recentAlerts: recentAlerts.slice(0, 5), // Limit to most important alerts
    });

  } catch (error) {
    console.error('Billing overview error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================
// UTILITIES
// =============================================

function calculateDaysBetween(date1: Date, date2: Date): number {
  const timeDiff = date2.getTime() - date1.getTime();
  return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
}