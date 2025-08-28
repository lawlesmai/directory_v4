/**
 * EPIC 5 STORY 5.2: Subscription Management & Billing System
 * Subscription Cancellation API - Dedicated cancellation flow endpoint
 * 
 * Provides structured cancellation flow with:
 * - Cancellation options (immediate vs end of period)
 * - Retention offers and surveys
 * - Prorated refunds and credit calculations
 * - Cancellation reason tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import subscriptionManager from '@/lib/payments/subscription-manager';
import billingService from '@/lib/payments/billing-service';
import paymentSecurity from '@/lib/payments/security-middleware';
import { generateSecureHeaders } from '@/lib/payments/security-config';
import { z } from 'zod';

// =============================================
// VALIDATION SCHEMAS
// =============================================

const CancellationRequestSchema = z.object({
  reason: z.enum([
    'too_expensive',
    'not_using_enough',
    'missing_features',
    'poor_support',
    'switching_providers',
    'temporary_pause',
    'business_closing',
    'other'
  ]),
  feedback: z.string().max(1000).optional(),
  immediate: z.boolean().default(false),
  requestRefund: z.boolean().default(false),
  retentionOffer: z.enum(['discount', 'feature_upgrade', 'pause_subscription', 'none']).default('none'),
  surveyResponse: z.record(z.string(), z.any()).optional(),
});

// =============================================
// POST - Process Cancellation Request
// =============================================

export async function POST(
  request: NextRequest,
  { params }: { params: { subscriptionId: string } }
) {
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

    const { subscriptionId } = params;

    if (!subscriptionId) {
      return new NextResponse(
        JSON.stringify({ error: 'Subscription ID required' }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 2. Parse and validate request body
    const rawBody = await request.text();
    let requestData;

    try {
      requestData = JSON.parse(rawBody);
    } catch (error) {
      await paymentSecurity.logPaymentEvent(
        context,
        'subscription_cancel_invalid_json',
        'subscription',
        false,
        { subscriptionId, rawBodyLength: rawBody.length },
        'Invalid JSON in cancellation request'
      );

      return new NextResponse(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const validation = CancellationRequestSchema.safeParse(requestData);

    if (!validation.success) {
      await paymentSecurity.logPaymentEvent(
        context,
        'subscription_cancel_validation_failed',
        'subscription',
        false,
        { subscriptionId, errors: validation.error.errors },
        'Cancellation request validation failed'
      );

      return new NextResponse(
        JSON.stringify({ 
          error: 'Invalid cancellation request',
          details: validation.error.errors
        }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const cancellationData = validation.data;

    // 3. Validate subscription exists and access
    const subscription = await subscriptionManager.getSubscriptionWithDetails(subscriptionId);

    if (!subscription) {
      await paymentSecurity.logPaymentEvent(
        context,
        'subscription_cancel_not_found',
        'subscription',
        false,
        { subscriptionId },
        'Subscription not found for cancellation'
      );

      return new NextResponse(
        JSON.stringify({ error: 'Subscription not found' }),
        { 
          status: 404, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (subscription.customerId !== context.customerId && !context.isAdmin) {
      await paymentSecurity.logPaymentEvent(
        context,
        'subscription_cancel_access_denied',
        'subscription',
        false,
        { 
          subscriptionId,
          requestedCustomerId: subscription.customerId,
          allowedCustomerId: context.customerId 
        },
        'Access denied for subscription cancellation'
      );

      return new NextResponse(
        JSON.stringify({ error: 'Access denied' }),
        { 
          status: 403, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 4. Check if subscription can be canceled
    if (['canceled', 'incomplete_expired'].includes(subscription.status)) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Subscription is already canceled or expired',
          status: subscription.status
        }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 5. Calculate potential refund/credit
    let refundInfo = null;
    if (cancellationData.requestRefund && cancellationData.immediate) {
      const now = new Date();
      const periodEnd = subscription.currentPeriodEnd;
      const periodStart = subscription.currentPeriodStart;
      
      const totalPeriodDays = Math.ceil(
        (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      const remainingDays = Math.ceil(
        (periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (remainingDays > 0) {
        const proratedAmount = Math.floor(
          (subscription.plan.amount * remainingDays) / totalPeriodDays
        );

        refundInfo = {
          eligible: proratedAmount > 100, // Minimum $1.00 refund
          amount: proratedAmount,
          remainingDays,
          totalPeriodDays,
        };
      }
    }

    // 6. Process retention offer
    let retentionOfferResult = null;
    if (cancellationData.retentionOffer !== 'none' && !cancellationData.immediate) {
      retentionOfferResult = await processRetentionOffer(
        subscription,
        cancellationData.retentionOffer,
        cancellationData.reason
      );
    }

    // 7. Process cancellation based on type
    let canceledSubscription;
    const cancellationMetadata = {
      reason: cancellationData.reason,
      feedback: cancellationData.feedback,
      retention_offer: cancellationData.retentionOffer,
      survey_response: cancellationData.surveyResponse,
      canceled_by: context.userId,
      canceled_at: new Date().toISOString(),
      refund_requested: cancellationData.requestRefund,
    };

    if (cancellationData.immediate) {
      // Immediate cancellation
      canceledSubscription = await subscriptionManager.cancelImmediately(
        subscriptionId,
        refundInfo?.eligible || false
      );

      // Process refund if eligible and requested
      if (refundInfo?.eligible && cancellationData.requestRefund) {
        try {
          // Find the most recent successful payment for this subscription
          const { createClient } = await import('@/lib/supabase/server');
          const supabase = createClient();
          
          const { data: recentTransaction } = await supabase
            .from('payment_transactions')
            .select('id')
            .eq('subscription_id', subscriptionId)
            .eq('status', 'succeeded')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (recentTransaction) {
            await billingService.processRefund({
              paymentTransactionId: recentTransaction.id,
              reason: 'requested_by_customer',
              metadata: {
                cancellation_reason: cancellationData.reason,
                prorated_refund: 'true',
              },
            }, {
              amount: refundInfo.amount,
            });

            refundInfo.processed = true;
          }
        } catch (refundError) {
          console.error('Refund processing error:', refundError);
          refundInfo.processed = false;
          refundInfo.error = 'Failed to process refund';
        }
      }

      await paymentSecurity.logPaymentEvent(
        context,
        'subscription_canceled_immediately',
        'subscription',
        true,
        { 
          subscriptionId,
          reason: cancellationData.reason,
          refundRequested: cancellationData.requestRefund,
          refundProcessed: refundInfo?.processed || false
        }
      );
    } else {
      // Cancel at period end
      canceledSubscription = await subscriptionManager.cancelAtPeriodEnd(subscriptionId);

      await paymentSecurity.logPaymentEvent(
        context,
        'subscription_canceled_at_period_end',
        'subscription',
        true,
        { 
          subscriptionId,
          reason: cancellationData.reason,
          periodEnd: subscription.currentPeriodEnd
        }
      );
    }

    // 8. Update subscription metadata with cancellation info
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = createClient();
    
    await supabase
      .from('subscriptions')
      .update({
        metadata: {
          ...subscription.metadata,
          ...cancellationMetadata,
        },
      })
      .eq('id', subscriptionId);

    // 9. Send cancellation confirmation (implement email service integration)
    await sendCancellationConfirmation(subscription, cancellationData, refundInfo);

    // 10. Return cancellation response
    const responseData = {
      success: true,
      subscriptionId,
      status: canceledSubscription.status,
      canceledAt: cancellationData.immediate ? new Date().toISOString() : null,
      cancellationEffectiveDate: cancellationData.immediate 
        ? new Date().toISOString() 
        : subscription.currentPeriodEnd.toISOString(),
      reason: cancellationData.reason,
      refund: refundInfo,
      retentionOffer: retentionOfferResult,
      accessUntil: cancellationData.immediate 
        ? new Date().toISOString() 
        : subscription.currentPeriodEnd.toISOString(),
      message: cancellationData.immediate
        ? 'Your subscription has been canceled immediately.'
        : `Your subscription will remain active until ${subscription.currentPeriodEnd.toLocaleDateString()}.`,
    };

    return new NextResponse(
      JSON.stringify(responseData),
      { 
        status: 200, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Subscription cancellation error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    try {
      await paymentSecurity.logPaymentEvent(
        context!,
        'subscription_cancel_error',
        'subscription',
        false,
        { 
          subscriptionId: params.subscriptionId,
          errorType: error instanceof Error ? error.constructor.name : 'unknown' 
        },
        errorMessage
      );
    } catch (logError) {
      console.error('Failed to log cancellation error:', logError);
    }

    return new NextResponse(
      JSON.stringify({ error: 'Failed to process cancellation' }),
      { 
        status: 500, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// =============================================
// GET - Get Cancellation Options
// =============================================

export async function GET(
  request: NextRequest,
  { params }: { params: { subscriptionId: string } }
) {
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

    const { subscriptionId } = params;

    if (!subscriptionId) {
      return new NextResponse(
        JSON.stringify({ error: 'Subscription ID required' }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 2. Get subscription details
    const subscription = await subscriptionManager.getSubscriptionWithDetails(subscriptionId);

    if (!subscription) {
      return new NextResponse(
        JSON.stringify({ error: 'Subscription not found' }),
        { 
          status: 404, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (subscription.customerId !== context.customerId && !context.isAdmin) {
      return new NextResponse(
        JSON.stringify({ error: 'Access denied' }),
        { 
          status: 403, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 3. Calculate cancellation options
    const now = new Date();
    const periodEnd = subscription.currentPeriodEnd;
    const daysUntilRenewal = Math.ceil(
      (periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate potential prorated refund
    const periodStart = subscription.currentPeriodStart;
    const totalPeriodDays = Math.ceil(
      (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    const usedDays = totalPeriodDays - daysUntilRenewal;
    const proratedRefund = daysUntilRenewal > 0 
      ? Math.floor((subscription.plan.amount * daysUntilRenewal) / totalPeriodDays)
      : 0;

    // Generate retention offers based on subscription history and reason
    const retentionOffers = await generateRetentionOffers(subscription);

    // 4. Return cancellation options
    const cancellationOptions = {
      subscriptionId,
      canCancel: !['canceled', 'incomplete_expired'].includes(subscription.status),
      options: {
        immediate: {
          available: true,
          description: 'Cancel immediately and lose access now',
          refund: {
            available: proratedRefund > 100,
            amount: proratedRefund,
            currency: subscription.plan.currency,
            description: `Prorated refund for ${daysUntilRenewal} unused days`,
          },
        },
        endOfPeriod: {
          available: daysUntilRenewal > 0,
          description: `Continue access until ${periodEnd.toLocaleDateString()}`,
          accessUntil: periodEnd.toISOString(),
          daysRemaining: daysUntilRenewal,
        },
      },
      retentionOffers,
      surveyQuestions: [
        {
          id: 'primary_reason',
          question: 'What is the primary reason for canceling?',
          type: 'radio',
          required: true,
          options: [
            { value: 'too_expensive', label: 'Too expensive' },
            { value: 'not_using_enough', label: 'Not using it enough' },
            { value: 'missing_features', label: 'Missing features I need' },
            { value: 'poor_support', label: 'Poor customer support' },
            { value: 'switching_providers', label: 'Switching to another provider' },
            { value: 'temporary_pause', label: 'Temporary pause' },
            { value: 'business_closing', label: 'Business closing' },
            { value: 'other', label: 'Other' },
          ],
        },
        {
          id: 'feedback',
          question: 'Any additional feedback? (Optional)',
          type: 'textarea',
          required: false,
          maxLength: 1000,
        },
        {
          id: 'likelihood_return',
          question: 'How likely are you to use our service again in the future?',
          type: 'scale',
          required: false,
          scale: { min: 1, max: 10, minLabel: 'Very unlikely', maxLabel: 'Very likely' },
        },
      ],
      currentSubscription: {
        id: subscription.id,
        status: subscription.status,
        planName: subscription.plan.name,
        amount: subscription.plan.amount,
        currency: subscription.plan.currency,
        interval: subscription.plan.interval,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      },
    };

    await paymentSecurity.logPaymentEvent(
      context,
      'subscription_cancel_options_retrieved',
      'subscription',
      true,
      { subscriptionId }
    );

    return new NextResponse(
      JSON.stringify(cancellationOptions),
      { 
        status: 200, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Get cancellation options error:', error);

    return new NextResponse(
      JSON.stringify({ error: 'Failed to retrieve cancellation options' }),
      { 
        status: 500, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Process retention offer based on type and reason
 */
async function processRetentionOffer(
  subscription: any,
  offerType: string,
  cancellationReason: string
): Promise<any> {
  try {
    switch (offerType) {
      case 'discount':
        // Generate discount offer (would integrate with Stripe Coupons)
        return {
          type: 'discount',
          description: 'Get 50% off your next 3 months',
          value: 50,
          duration: 3,
          code: `SAVE50-${Date.now()}`,
        };

      case 'feature_upgrade':
        // Offer plan upgrade at same price
        return {
          type: 'feature_upgrade',
          description: 'Upgrade to our Professional plan at your current price',
          currentPlan: subscription.plan.name,
          upgradePlan: 'Professional',
        };

      case 'pause_subscription':
        // Offer subscription pause
        return {
          type: 'pause_subscription',
          description: 'Pause your subscription for up to 3 months',
          maxPauseDays: 90,
        };

      default:
        return null;
    }
  } catch (error) {
    console.error('Process retention offer error:', error);
    return null;
  }
}

/**
 * Generate personalized retention offers
 */
async function generateRetentionOffers(subscription: any): Promise<any[]> {
  const offers = [];

  // Discount offer for price-sensitive customers
  offers.push({
    id: 'discount_50',
    type: 'discount',
    title: 'Special Retention Offer',
    description: 'Get 50% off your next 3 billing cycles',
    value: '50% off for 3 months',
    conditions: 'Available for limited time',
  });

  // Pause option
  offers.push({
    id: 'pause_subscription',
    type: 'pause',
    title: 'Pause Instead of Cancel',
    description: 'Take a break and resume when ready',
    value: 'Pause for up to 90 days',
    conditions: 'Resume anytime during pause period',
  });

  // Plan downgrade offer
  if (subscription.plan.name !== 'Starter') {
    offers.push({
      id: 'downgrade_plan',
      type: 'downgrade',
      title: 'Switch to a Lower Plan',
      description: 'Keep essential features at a lower cost',
      value: 'Downgrade to Starter plan',
      conditions: 'Keep core functionality',
    });
  }

  return offers;
}

/**
 * Send cancellation confirmation email
 */
async function sendCancellationConfirmation(
  subscription: any,
  cancellationData: any,
  refundInfo: any
): Promise<void> {
  try {
    // In a real implementation, this would use an email service
    console.log(`Sending cancellation confirmation to ${subscription.customer.email}`);
    
    // Here you would integrate with your email service (SendGrid, AWS SES, etc.)
    // await emailService.send({
    //   to: subscription.customer.email,
    //   template: 'subscription-canceled',
    //   data: {
    //     customerName: subscription.customer.name,
    //     subscriptionId: subscription.id,
    //     planName: subscription.plan.name,
    //     cancellationReason: cancellationData.reason,
    //     immediate: cancellationData.immediate,
    //     accessUntil: cancellationData.immediate ? new Date() : subscription.currentPeriodEnd,
    //     refundInfo,
    //   }
    // });
  } catch (error) {
    console.error('Send cancellation confirmation error:', error);
    // Don't throw error here as it's not critical to the cancellation process
  }
}