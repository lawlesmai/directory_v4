/**
 * EPIC 5 STORY 5.2: Subscription Management & Billing System
 * Subscription Preview API - Preview subscription changes before applying
 * 
 * Provides preview functionality for:
 * - New subscription creation estimates
 * - Plan change cost calculations
 * - Trial conversion impacts
 * - Proration and billing previews
 */

import { NextRequest, NextResponse } from 'next/server';
import subscriptionManager from '@/lib/payments/subscription-manager';
import subscriptionAnalytics from '@/lib/payments/subscription-analytics';
import paymentSecurity from '@/lib/payments/security-middleware';
import { generateSecureHeaders } from '@/lib/payments/security-config';
import { z } from 'zod';

// =============================================
// VALIDATION SCHEMAS
// =============================================

const PreviewRequestSchema = z.object({
  type: z.enum(['new_subscription', 'plan_change', 'trial_conversion', 'cancellation_impact']),
  customerId: z.string().uuid(),
  subscriptionId: z.string().uuid().optional(),
  planId: z.string().uuid(),
  newPlanId: z.string().uuid().optional(),
  trialDays: z.number().min(0).max(90).default(14),
  couponId: z.string().optional(),
  promotionCode: z.string().optional(),
  prorationBehavior: z.enum(['create_prorations', 'none', 'always_invoice']).default('create_prorations'),
  billingCycleAnchor: z.enum(['now', 'unchanged']).default('unchanged'),
});

// =============================================
// POST - Generate Preview
// =============================================

export async function POST(request: NextRequest) {
  const secureHeaders = generateSecureHeaders();

  try {
    // 1. Security validation
    const { context, response } = await paymentSecurity.validatePaymentRequest(
      request,
      ['authenticated', 'business_owner', 'admin']
    );

    if (response) {
      return response;
    }

    // 2. Parse and validate request body
    const rawBody = await request.text();
    let requestData;

    try {
      requestData = JSON.parse(rawBody);
    } catch (error) {
      await paymentSecurity.logPaymentEvent(
        context,
        'subscription_preview_invalid_json',
        'subscription',
        false,
        { rawBodyLength: rawBody.length },
        'Invalid JSON in preview request'
      );

      return new NextResponse(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const validation = PreviewRequestSchema.safeParse(requestData);

    if (!validation.success) {
      await paymentSecurity.logPaymentEvent(
        context,
        'subscription_preview_validation_failed',
        'subscription',
        false,
        { errors: validation.error.errors },
        'Preview request validation failed'
      );

      return new NextResponse(
        JSON.stringify({ 
          error: 'Invalid preview request',
          details: validation.error.errors
        }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const previewData = validation.data;

    // 3. Validate customer access
    if (previewData.customerId !== context.customerId && !context.isAdmin) {
      await paymentSecurity.logPaymentEvent(
        context,
        'subscription_preview_access_denied',
        'subscription',
        false,
        { 
          requestedCustomerId: previewData.customerId,
          allowedCustomerId: context.customerId 
        },
        'Access denied for subscription preview'
      );

      return new NextResponse(
        JSON.stringify({ error: 'Access denied' }),
        { 
          status: 403, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 4. Generate preview based on type
    let previewResult;

    switch (previewData.type) {
      case 'new_subscription':
        previewResult = await generateNewSubscriptionPreview(previewData);
        break;

      case 'plan_change':
        if (!previewData.subscriptionId || !previewData.newPlanId) {
          return new NextResponse(
            JSON.stringify({ error: 'Subscription ID and new plan ID required for plan change preview' }),
            { 
              status: 400, 
              headers: { ...secureHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
        previewResult = await generatePlanChangePreview(previewData);
        break;

      case 'trial_conversion':
        if (!previewData.subscriptionId) {
          return new NextResponse(
            JSON.stringify({ error: 'Subscription ID required for trial conversion preview' }),
            { 
              status: 400, 
              headers: { ...secureHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
        previewResult = await generateTrialConversionPreview(previewData);
        break;

      case 'cancellation_impact':
        if (!previewData.subscriptionId) {
          return new NextResponse(
            JSON.stringify({ error: 'Subscription ID required for cancellation impact preview' }),
            { 
              status: 400, 
              headers: { ...secureHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
        previewResult = await generateCancellationImpactPreview(previewData);
        break;

      default:
        return new NextResponse(
          JSON.stringify({ 
            error: 'Invalid preview type',
            validTypes: ['new_subscription', 'plan_change', 'trial_conversion', 'cancellation_impact']
          }),
          { 
            status: 400, 
            headers: { ...secureHeaders, 'Content-Type': 'application/json' }
          }
        );
    }

    // 5. Log preview generation
    await paymentSecurity.logPaymentEvent(
      context,
      `subscription_preview_${previewData.type}`,
      'subscription',
      true,
      { 
        type: previewData.type,
        customerId: previewData.customerId,
        subscriptionId: previewData.subscriptionId,
        planId: previewData.planId,
        newPlanId: previewData.newPlanId
      }
    );

    // 6. Return preview result
    return new NextResponse(
      JSON.stringify(previewResult),
      { 
        status: 200, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Subscription preview error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    try {
      await paymentSecurity.logPaymentEvent(
        context!,
        'subscription_preview_error',
        'subscription',
        false,
        { errorType: error instanceof Error ? error.constructor.name : 'unknown' },
        errorMessage
      );
    } catch (logError) {
      console.error('Failed to log preview error:', logError);
    }

    return new NextResponse(
      JSON.stringify({ error: 'Failed to generate subscription preview' }),
      { 
        status: 500, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// =============================================
// GET - Get Available Plans for Preview
// =============================================

export async function GET(request: NextRequest) {
  const secureHeaders = generateSecureHeaders();

  try {
    // 1. Security validation
    const { context, response } = await paymentSecurity.validatePaymentRequest(
      request,
      ['authenticated', 'business_owner', 'admin']
    );

    if (response) {
      return response;
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    if (customerId && customerId !== context.customerId && !context.isAdmin) {
      return new NextResponse(
        JSON.stringify({ error: 'Access denied' }),
        { 
          status: 403, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 3. Get available plans
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = createClient();

    let query = supabase
      .from('subscription_plans')
      .select('*')
      .order('amount', { ascending: true });

    if (!includeInactive) {
      query = query.eq('active', true);
    }

    const { data: plans, error } = await query;

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // 4. Get customer's current subscriptions for comparison
    let currentSubscriptions = [];
    if (customerId) {
      currentSubscriptions = await subscriptionManager.getCustomerSubscriptions(customerId);
    }

    // 5. Enhance plans with preview information
    const enhancedPlans = plans?.map(plan => {
      const currentSubscription = currentSubscriptions.find(sub => 
        sub.planId === plan.id && ['active', 'trialing'].includes(sub.status)
      );

      return {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        amount: plan.amount,
        currency: plan.currency,
        interval: plan.interval,
        intervalCount: plan.interval_count,
        trialPeriodDays: plan.trial_period_days,
        features: plan.features || [],
        active: plan.active,
        metadata: plan.metadata,
        isCurrent: !!currentSubscription,
        currentSubscriptionId: currentSubscription?.id,
        pricing: {
          monthly: plan.interval === 'month' ? plan.amount : Math.floor(plan.amount / 12),
          yearly: plan.interval === 'year' ? plan.amount : plan.amount * 12,
          displayPrice: `$${(plan.amount / 100).toFixed(2)}/${plan.interval}`,
        },
        popular: plan.metadata?.popular === true,
        recommended: plan.metadata?.recommended === true,
      };
    }) || [];

    // 6. Log access
    await paymentSecurity.logPaymentEvent(
      context,
      'subscription_plans_retrieved_for_preview',
      'subscription',
      true,
      { 
        customerId,
        planCount: enhancedPlans.length,
        includeInactive
      }
    );

    // 7. Return enhanced plans data
    const responseData = {
      plans: enhancedPlans,
      currentSubscriptions: currentSubscriptions.map(sub => ({
        id: sub.id,
        planId: sub.planId,
        planName: sub.plan.name,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
        trialEnd: sub.trialEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      })),
      metadata: {
        totalPlans: enhancedPlans.length,
        activePlans: enhancedPlans.filter(p => p.active).length,
        customerHasActiveSubscriptions: currentSubscriptions.some(sub => 
          ['active', 'trialing'].includes(sub.status)
        ),
      },
    };

    return new NextResponse(
      JSON.stringify(responseData),
      { 
        status: 200, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Get plans for preview error:', error);

    return new NextResponse(
      JSON.stringify({ error: 'Failed to retrieve plans for preview' }),
      { 
        status: 500, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// =============================================
// PREVIEW GENERATORS
// =============================================

/**
 * Generate preview for new subscription
 */
async function generateNewSubscriptionPreview(data: any) {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = createClient();

  // Get plan details
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('id', data.planId)
    .single();

  if (!plan) {
    throw new Error('Plan not found');
  }

  // Calculate costs
  const trialDays = data.trialDays || plan.trial_period_days || 0;
  const immediateCharge = trialDays > 0 ? 0 : plan.amount;
  const firstBillingDate = new Date();
  if (trialDays > 0) {
    firstBillingDate.setDate(firstBillingDate.getDate() + trialDays);
  }

  // Get applicable discounts
  let discountInfo = null;
  if (data.couponId || data.promotionCode) {
    // In a real implementation, you'd fetch coupon/promo details from Stripe
    discountInfo = {
      type: 'coupon',
      description: 'Promotional discount applied',
      // This would be calculated based on actual coupon details
    };
  }

  return {
    type: 'new_subscription',
    valid: true,
    plan: {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      amount: plan.amount,
      currency: plan.currency,
      interval: plan.interval,
      features: plan.features || [],
    },
    billing: {
      immediateCharge,
      firstBillingDate: firstBillingDate.toISOString(),
      recurringAmount: plan.amount,
      billingInterval: plan.interval,
    },
    trial: {
      enabled: trialDays > 0,
      days: trialDays,
      startsImmediately: true,
      endsAt: trialDays > 0 ? firstBillingDate.toISOString() : null,
    },
    discount: discountInfo,
    summary: {
      description: `New ${plan.name} subscription`,
      totalToday: immediateCharge,
      nextBillingAmount: plan.amount,
      nextBillingDate: firstBillingDate.toISOString(),
    },
  };
}

/**
 * Generate preview for plan change
 */
async function generatePlanChangePreview(data: any) {
  const preview = await subscriptionManager.previewPlanChange(
    data.subscriptionId!,
    data.newPlanId!
  );

  const subscription = await subscriptionManager.getSubscriptionWithDetails(data.subscriptionId!);
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  const changeType = preview.newPlan.amount > preview.currentPlan.amount ? 'upgrade' : 'downgrade';

  return {
    type: 'plan_change',
    valid: true,
    changeType,
    subscriptionId: data.subscriptionId,
    currentPlan: preview.currentPlan,
    newPlan: preview.newPlan,
    proration: {
      immediateCharge: preview.immediateCharge,
      nextBillingAmount: preview.nextBillingAmount,
      effectiveDate: preview.effectiveDate,
      behavior: data.prorationBehavior,
    },
    billing: {
      currentPeriodEnd: subscription.currentPeriodEnd,
      nextBillingDate: subscription.currentPeriodEnd,
      billingCycleChange: data.billingCycleAnchor === 'now',
    },
    summary: {
      description: `${changeType} from ${preview.currentPlan.name} to ${preview.newPlan.name}`,
      totalToday: preview.immediateCharge,
      nextBillingAmount: preview.nextBillingAmount,
      savingsOrCost: changeType === 'upgrade' 
        ? `Additional $${((preview.newPlan.amount - preview.currentPlan.amount) / 100).toFixed(2)}/${preview.newPlan.name.toLowerCase().includes('year') ? 'year' : 'month'}`
        : `Save $${((preview.currentPlan.amount - preview.newPlan.amount) / 100).toFixed(2)}/${preview.currentPlan.name.toLowerCase().includes('year') ? 'year' : 'month'}`,
    },
  };
}

/**
 * Generate preview for trial conversion
 */
async function generateTrialConversionPreview(data: any) {
  const subscription = await subscriptionManager.getSubscriptionWithDetails(data.subscriptionId!);
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  if (subscription.status !== 'trialing') {
    throw new Error('Subscription is not in trial period');
  }

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = createClient();

  // Get target plan (if different from current)
  let targetPlan = subscription.plan;
  if (data.planId !== subscription.planId) {
    const { data: newPlan } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', data.planId)
      .single();

    if (!newPlan) {
      throw new Error('Target plan not found');
    }
    targetPlan = newPlan;
  }

  const trialEndsAt = subscription.trialEnd || new Date();
  const daysRemaining = Math.max(0, Math.ceil(
    (trialEndsAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  ));

  return {
    type: 'trial_conversion',
    valid: true,
    subscriptionId: data.subscriptionId,
    trial: {
      daysRemaining,
      endsAt: trialEndsAt.toISOString(),
      canExtend: daysRemaining > 0,
    },
    conversion: {
      targetPlan: {
        id: targetPlan.id,
        name: targetPlan.name,
        amount: targetPlan.amount,
        currency: targetPlan.currency,
      },
      immediateCharge: targetPlan.amount,
      nextBillingDate: subscription.currentPeriodEnd,
    },
    summary: {
      description: `Convert trial to ${targetPlan.name} subscription`,
      totalToday: targetPlan.amount,
      nextBillingAmount: targetPlan.amount,
      nextBillingDate: subscription.currentPeriodEnd.toISOString(),
    },
  };
}

/**
 * Generate preview for cancellation impact
 */
async function generateCancellationImpactPreview(data: any) {
  const subscription = await subscriptionManager.getSubscriptionWithDetails(data.subscriptionId!);
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  const now = new Date();
  const periodEnd = subscription.currentPeriodEnd;
  const daysRemaining = Math.max(0, Math.ceil(
    (periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  ));

  // Calculate potential refund
  const periodStart = subscription.currentPeriodStart;
  const totalPeriodDays = Math.ceil(
    (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  const proratedRefund = daysRemaining > 0 
    ? Math.floor((subscription.plan.amount * daysRemaining) / totalPeriodDays)
    : 0;

  // Get usage or value estimates
  let valueAtRisk = null;
  try {
    const analytics = await subscriptionAnalytics.calculateCLV();
    valueAtRisk = {
      estimatedLTV: analytics.averageCLV,
      monthlyValue: subscription.plan.amount / 100,
    };
  } catch {
    // Analytics unavailable
  }

  return {
    type: 'cancellation_impact',
    valid: true,
    subscriptionId: data.subscriptionId,
    subscription: {
      planName: subscription.plan.name,
      status: subscription.status,
      amount: subscription.plan.amount,
      currency: subscription.plan.currency,
    },
    cancellationOptions: {
      immediate: {
        available: true,
        lossOfAccess: 'Immediate',
        refund: {
          available: proratedRefund > 100,
          amount: proratedRefund,
          description: `Prorated refund for ${daysRemaining} unused days`,
        },
      },
      endOfPeriod: {
        available: daysRemaining > 0,
        lossOfAccess: periodEnd.toISOString(),
        daysRemaining,
        refund: {
          available: false,
          amount: 0,
          description: 'No refund for end-of-period cancellation',
        },
      },
    },
    impact: {
      featuresLost: subscription.plan.features || [],
      dataRetention: '90 days after cancellation',
      reactivationPeriod: '30 days with full data restore',
      valueAtRisk,
    },
    summary: {
      description: 'Cancellation impact analysis',
      immediateRefund: proratedRefund,
      accessUntil: daysRemaining > 0 ? periodEnd.toISOString() : now.toISOString(),
      recommendation: daysRemaining > 7 
        ? 'Consider end-of-period cancellation to maximize value'
        : 'Immediate cancellation may provide prorated refund',
    },
  };
}