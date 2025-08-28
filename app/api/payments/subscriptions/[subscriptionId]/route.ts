/**
 * EPIC 5 STORY 5.2: Subscription Management & Billing System
 * Individual Subscription API Endpoint - Complete subscription lifecycle management
 * 
 * Handles individual subscription operations including:
 * - Detailed subscription retrieval
 * - Status updates and modifications
 * - Trial management
 * - Usage reporting
 */

import { NextRequest, NextResponse } from 'next/server';
import subscriptionManager from '@/lib/payments/subscription-manager';
import billingService from '@/lib/payments/billing-service';
import paymentSecurity from '@/lib/payments/security-middleware';
import { generateSecureHeaders } from '@/lib/payments/security-config';

// =============================================
// GET - Retrieve Individual Subscription
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

    // 2. Get subscription with full details
    const subscription = await subscriptionManager.getSubscriptionWithDetails(subscriptionId);

    if (!subscription) {
      await paymentSecurity.logPaymentEvent(
        context,
        'subscription_not_found',
        'subscription',
        false,
        { subscriptionId },
        'Subscription not found'
      );

      return new NextResponse(
        JSON.stringify({ error: 'Subscription not found' }),
        { 
          status: 404, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 3. Validate access permissions
    if (subscription.customerId !== context.customerId && !context.isAdmin) {
      await paymentSecurity.logPaymentEvent(
        context,
        'subscription_access_denied',
        'subscription',
        false,
        { 
          subscriptionId,
          requestedCustomerId: subscription.customerId,
          allowedCustomerId: context.customerId 
        },
        'Access denied to subscription'
      );

      return new NextResponse(
        JSON.stringify({ error: 'Access denied' }),
        { 
          status: 403, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 4. Get usage data if metered billing
    let usageData = null;
    if (subscription.plan && subscription.plan.features.includes('usage_based')) {
      // This would be implemented based on your usage tracking system
      // usageData = await subscriptionManager.getUsageSummary(subscriptionId, subscriptionItemId);
    }

    // 5. Log access
    await paymentSecurity.logPaymentEvent(
      context,
      'subscription_details_retrieved',
      'subscription',
      true,
      { 
        subscriptionId,
        customerId: subscription.customerId,
        status: subscription.status
      }
    );

    // 6. Return detailed subscription data
    const responseData = {
      id: subscription.id,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      customerId: subscription.customerId,
      planId: subscription.planId,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEnd: subscription.trialEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      metadata: subscription.metadata,
      customer: {
        id: subscription.customer.id,
        email: subscription.customer.email,
        name: subscription.customer.name,
      },
      plan: {
        id: subscription.plan.id,
        name: subscription.plan.name,
        amount: subscription.plan.amount,
        currency: subscription.plan.currency,
        interval: subscription.plan.interval,
        features: subscription.plan.features,
      },
      usage: usageData,
      billing: {
        nextBillingDate: subscription.currentPeriodEnd,
        isTrialing: subscription.status === 'trialing',
        daysUntilRenewal: Math.ceil(
          (subscription.currentPeriodEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
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
    console.error('Get subscription details error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    try {
      await paymentSecurity.logPaymentEvent(
        context!,
        'subscription_details_error',
        'subscription',
        false,
        { 
          subscriptionId: params.subscriptionId,
          errorType: error instanceof Error ? error.constructor.name : 'unknown' 
        },
        errorMessage
      );
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new NextResponse(
      JSON.stringify({ error: 'Failed to retrieve subscription details' }),
      { 
        status: 500, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// =============================================
// PUT - Update Subscription
// =============================================

export async function PUT(
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

    // 2. Parse request body
    const rawBody = await request.text();
    let requestData;

    try {
      requestData = JSON.parse(rawBody);
    } catch (error) {
      await paymentSecurity.logPaymentEvent(
        context,
        'subscription_update_invalid_json',
        'subscription',
        false,
        { subscriptionId, rawBodyLength: rawBody.length },
        'Invalid JSON in request body'
      );

      return new NextResponse(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 3. Validate subscription exists and access
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

    // 4. Process different update actions
    const { action } = requestData;
    let updatedSubscription;

    switch (action) {
      case 'pause':
        // Pause subscription at period end
        updatedSubscription = await subscriptionManager.cancelAtPeriodEnd(subscriptionId);
        
        await paymentSecurity.logPaymentEvent(
          context,
          'subscription_paused',
          'subscription',
          true,
          { subscriptionId, cancelAtPeriodEnd: true }
        );
        break;

      case 'resume':
        // Resume paused subscription
        updatedSubscription = await subscriptionManager.reactivateSubscription(subscriptionId);
        
        await paymentSecurity.logPaymentEvent(
          context,
          'subscription_resumed',
          'subscription',
          true,
          { subscriptionId }
        );
        break;

      case 'cancel_immediately':
        // Cancel subscription immediately
        updatedSubscription = await subscriptionManager.cancelImmediately(
          subscriptionId, 
          requestData.prorateCreditIfApplicable !== false
        );
        
        await paymentSecurity.logPaymentEvent(
          context,
          'subscription_canceled_immediately',
          'subscription',
          true,
          { subscriptionId, prorated: requestData.prorateCreditIfApplicable !== false }
        );
        break;

      case 'extend_trial':
        // Extend trial period
        if (!requestData.additionalDays || requestData.additionalDays <= 0) {
          return new NextResponse(
            JSON.stringify({ error: 'Additional trial days required' }),
            { 
              status: 400, 
              headers: { ...secureHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

        updatedSubscription = await subscriptionManager.extendTrial(
          subscriptionId, 
          requestData.additionalDays
        );
        
        await paymentSecurity.logPaymentEvent(
          context,
          'subscription_trial_extended',
          'subscription',
          true,
          { subscriptionId, additionalDays: requestData.additionalDays }
        );
        break;

      case 'convert_trial':
        // Convert trial to paid subscription
        updatedSubscription = await subscriptionManager.convertTrialToPaid(
          subscriptionId,
          {
            planId: requestData.planId || subscription.planId,
            paymentMethodId: requestData.paymentMethodId,
            couponId: requestData.couponId,
            promotionCode: requestData.promotionCode,
          }
        );
        
        await paymentSecurity.logPaymentEvent(
          context,
          'subscription_trial_converted',
          'subscription',
          true,
          { subscriptionId, newPlanId: requestData.planId }
        );
        break;

      case 'report_usage':
        // Report usage for metered billing
        if (!requestData.quantity || !requestData.subscriptionItemId) {
          return new NextResponse(
            JSON.stringify({ error: 'Usage quantity and subscription item ID required' }),
            { 
              status: 400, 
              headers: { ...secureHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

        await subscriptionManager.reportUsage({
          subscriptionId,
          subscriptionItemId: requestData.subscriptionItemId,
          quantity: requestData.quantity,
          timestamp: requestData.timestamp,
          action: requestData.action || 'increment',
        });

        await paymentSecurity.logPaymentEvent(
          context,
          'subscription_usage_reported',
          'subscription',
          true,
          { 
            subscriptionId, 
            quantity: requestData.quantity,
            action: requestData.action || 'increment'
          }
        );

        return new NextResponse(
          JSON.stringify({ 
            success: true, 
            message: 'Usage reported successfully',
            quantity: requestData.quantity
          }),
          { 
            status: 200, 
            headers: { ...secureHeaders, 'Content-Type': 'application/json' }
          }
        );

      default:
        await paymentSecurity.logPaymentEvent(
          context,
          'subscription_update_invalid_action',
          'subscription',
          false,
          { subscriptionId, action },
          `Invalid action: ${action}`
        );

        return new NextResponse(
          JSON.stringify({ 
            error: 'Invalid action',
            validActions: [
              'pause', 
              'resume', 
              'cancel_immediately', 
              'extend_trial', 
              'convert_trial',
              'report_usage'
            ]
          }),
          { 
            status: 400, 
            headers: { ...secureHeaders, 'Content-Type': 'application/json' }
          }
        );
    }

    // 5. Return updated subscription
    const responseData = {
      id: updatedSubscription!.id,
      status: updatedSubscription!.status,
      currentPeriodStart: updatedSubscription!.currentPeriodStart,
      currentPeriodEnd: updatedSubscription!.currentPeriodEnd,
      trialEnd: updatedSubscription!.trialEnd,
      cancelAtPeriodEnd: updatedSubscription!.cancelAtPeriodEnd,
      updated: true,
      action: action,
    };

    return new NextResponse(
      JSON.stringify(responseData),
      { 
        status: 200, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Update subscription error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    try {
      await paymentSecurity.logPaymentEvent(
        context!,
        'subscription_update_error',
        'subscription',
        false,
        { 
          subscriptionId: params.subscriptionId,
          errorType: error instanceof Error ? error.constructor.name : 'unknown' 
        },
        errorMessage
      );
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new NextResponse(
      JSON.stringify({ error: 'Failed to update subscription' }),
      { 
        status: 500, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// =============================================
// DELETE - Cancel Subscription Immediately
// =============================================

export async function DELETE(
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

    // 2. Validate subscription exists and access
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

    // 3. Cancel subscription immediately
    const canceledSubscription = await subscriptionManager.cancelImmediately(subscriptionId, true);

    // 4. Log cancellation
    await paymentSecurity.logPaymentEvent(
      context,
      'subscription_deleted',
      'subscription',
      true,
      { 
        subscriptionId,
        customerId: subscription.customerId,
        deletedBy: context.userId
      }
    );

    return new NextResponse(
      JSON.stringify({ 
        message: 'Subscription canceled successfully',
        subscriptionId: subscriptionId,
        status: canceledSubscription.status,
        canceledAt: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Cancel subscription error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    try {
      await paymentSecurity.logPaymentEvent(
        context!,
        'subscription_delete_error',
        'subscription',
        false,
        { 
          subscriptionId: params.subscriptionId,
          errorType: error instanceof Error ? error.constructor.name : 'unknown' 
        },
        errorMessage
      );
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new NextResponse(
      JSON.stringify({ error: 'Failed to cancel subscription' }),
      { 
        status: 500, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}