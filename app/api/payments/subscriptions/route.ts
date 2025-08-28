/**
 * EPIC 5 STORY 5.1: Stripe Integration & Payment Infrastructure
 * Subscriptions API Endpoint - Comprehensive subscription management
 * 
 * Handles subscription creation, retrieval, updates, and cancellation
 * with security validation and comprehensive audit logging.
 */

import { NextRequest, NextResponse } from 'next/server';
import stripeService from '@/lib/payments/stripe-service';
import paymentSecurity from '@/lib/payments/security-middleware';
import { generateSecureHeaders } from '@/lib/payments/security-config';

// =============================================
// POST - Create Subscription
// =============================================

export async function POST(request: NextRequest) {
  const secureHeaders = generateSecureHeaders();

  try {
    // 1. Security validation with customer access
    const { context, response } = await paymentSecurity.validatePaymentRequest(
      request,
      ['authenticated', 'business_owner', 'admin'],
      true // requireCustomerAccess
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
        'subscription_create_invalid_json',
        'subscription',
        false,
        { rawBodyLength: rawBody.length },
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

    // 3. Validate subscription request data
    const validation = paymentSecurity.validatePaymentData(
      requestData,
      paymentSecurity.getSubscriptionRequestSchema()
    );

    if (!validation.valid) {
      await paymentSecurity.logPaymentEvent(
        context,
        'subscription_create_validation_failed',
        'subscription',
        false,
        { errors: validation.errors },
        `Validation failed: ${validation.errors?.join(', ')}`
      );

      return new NextResponse(
        JSON.stringify({ 
          error: 'Invalid request data',
          details: validation.errors 
        }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 4. Ensure customer access matches request
    if (validation.data.customerId !== context.customerId && !context.isAdmin) {
      await paymentSecurity.logPaymentEvent(
        context,
        'subscription_create_access_denied',
        'subscription',
        false,
        { 
          requestedCustomerId: validation.data.customerId,
          allowedCustomerId: context.customerId 
        },
        'Customer access mismatch'
      );

      return new NextResponse(
        JSON.stringify({ error: 'Access denied' }),
        { 
          status: 403, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 5. Create subscription
    const subscription = await stripeService.createSubscription(validation.data);

    // 6. Log success
    await paymentSecurity.logPaymentEvent(
      context,
      'subscription_created',
      'subscription',
      true,
      { 
        subscriptionId: subscription.id,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        customerId: subscription.customerId,
        planId: subscription.planId,
        status: subscription.status
      }
    );

    // 7. Return response
    const responseData = {
      id: subscription.id,
      customerId: subscription.customerId,
      planId: subscription.planId,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEnd: subscription.trialEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      created: true,
    };

    return new NextResponse(
      JSON.stringify(responseData),
      { 
        status: 201, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Subscription creation error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    try {
      await paymentSecurity.logPaymentEvent(
        context!,
        'subscription_create_error',
        'subscription',
        false,
        { errorType: error instanceof Error ? error.constructor.name : 'unknown' },
        errorMessage
      );
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new NextResponse(
      JSON.stringify({ error: 'Subscription creation failed' }),
      { 
        status: 500, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// =============================================
// GET - Retrieve Subscription(s)
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

    // 2. Parse URL parameters
    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('subscriptionId');
    const customerId = searchParams.get('customerId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 3. Validate access permissions
    if (customerId && customerId !== context.customerId && !context.isAdmin) {
      await paymentSecurity.logPaymentEvent(
        context,
        'subscription_get_access_denied',
        'subscription',
        false,
        { 
          requestedCustomerId: customerId,
          allowedCustomerId: context.customerId 
        },
        'Customer access mismatch'
      );

      return new NextResponse(
        JSON.stringify({ error: 'Access denied' }),
        { 
          status: 403, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 4. Retrieve subscription(s) from database
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = createClient();

    let query = supabase
      .from('subscriptions')
      .select(`
        id,
        stripe_subscription_id,
        customer_id,
        plan_id,
        status,
        quantity,
        current_period_start,
        current_period_end,
        trial_start,
        trial_end,
        cancel_at_period_end,
        canceled_at,
        ended_at,
        created_at,
        updated_at,
        subscription_plans!inner(
          name,
          description,
          amount,
          currency,
          interval,
          features
        ),
        stripe_customers!inner(
          email,
          name
        )
      `);

    // Apply filters based on access level
    if (!context.isAdmin) {
      // Non-admin users can only see their own subscriptions
      if (context.customerId) {
        query = query.eq('customer_id', context.customerId);
      } else if (context.businessId) {
        // Filter by business ownership through customer relationship
        query = query.eq('stripe_customers.business_id', context.businessId);
      }
    } else if (customerId) {
      // Admin requesting specific customer
      query = query.eq('customer_id', customerId);
    }

    // Apply additional filters
    if (subscriptionId) {
      query = query.eq('id', subscriptionId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    // Apply pagination
    query = query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    const { data: subscriptions, error, count } = await query;

    if (error) {
      console.error('Database error retrieving subscriptions:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    // 5. Log access
    await paymentSecurity.logPaymentEvent(
      context,
      subscriptionId ? 'subscription_retrieved' : 'subscriptions_listed',
      'subscription',
      true,
      { 
        subscriptionId,
        customerId,
        resultCount: subscriptions?.length || 0,
        filters: { status, limit, offset }
      }
    );

    // 6. Format response
    const responseData = {
      subscriptions: subscriptions?.map(sub => ({
        id: sub.id,
        customerId: sub.customer_id,
        planId: sub.plan_id,
        status: sub.status,
        quantity: sub.quantity,
        currentPeriodStart: sub.current_period_start,
        currentPeriodEnd: sub.current_period_end,
        trialStart: sub.trial_start,
        trialEnd: sub.trial_end,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        canceledAt: sub.canceled_at,
        endedAt: sub.ended_at,
        createdAt: sub.created_at,
        updatedAt: sub.updated_at,
        plan: sub.subscription_plans,
        customer: {
          email: sub.stripe_customers.email,
          name: sub.stripe_customers.name,
        },
      })) || [],
      pagination: {
        limit,
        offset,
        total: count || 0,
        hasMore: (subscriptions?.length || 0) === limit
      }
    };

    return new NextResponse(
      JSON.stringify(responseData),
      { 
        status: 200, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Subscription retrieval error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    try {
      await paymentSecurity.logPaymentEvent(
        context!,
        'subscription_get_error',
        'subscription',
        false,
        { errorType: error instanceof Error ? error.constructor.name : 'unknown' },
        errorMessage
      );
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new NextResponse(
      JSON.stringify({ error: 'Subscription retrieval failed' }),
      { 
        status: 500, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// =============================================
// PUT - Update Subscription (Cancel/Modify)
// =============================================

export async function PUT(request: NextRequest) {
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

    // 2. Get subscription ID from URL
    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('subscriptionId');

    if (!subscriptionId) {
      await paymentSecurity.logPaymentEvent(
        context,
        'subscription_update_missing_id',
        'subscription',
        false,
        {},
        'Subscription ID not provided'
      );

      return new NextResponse(
        JSON.stringify({ error: 'Subscription ID required' }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 3. Parse request body
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

    // 4. Validate action
    const { action, cancelAtPeriodEnd } = requestData;

    if (!action || !['cancel', 'reactivate'].includes(action)) {
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
          validActions: ['cancel', 'reactivate']
        }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 5. Process action
    let updatedSubscription;

    if (action === 'cancel') {
      updatedSubscription = await stripeService.cancelSubscription(
        subscriptionId,
        cancelAtPeriodEnd !== false // Default to true
      );

      await paymentSecurity.logPaymentEvent(
        context,
        'subscription_canceled',
        'subscription',
        true,
        { 
          subscriptionId,
          stripeSubscriptionId: updatedSubscription.stripeSubscriptionId,
          cancelAtPeriodEnd: updatedSubscription.cancelAtPeriodEnd
        }
      );
    } else if (action === 'reactivate') {
      // Reactivation logic would go here
      // For now, just log the attempt
      await paymentSecurity.logPaymentEvent(
        context,
        'subscription_reactivate_attempted',
        'subscription',
        false,
        { subscriptionId },
        'Subscription reactivation not yet implemented'
      );

      return new NextResponse(
        JSON.stringify({ error: 'Reactivation not yet implemented' }),
        { 
          status: 501, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 6. Return response
    const responseData = {
      id: updatedSubscription!.id,
      status: updatedSubscription!.status,
      cancelAtPeriodEnd: updatedSubscription!.cancelAtPeriodEnd,
      currentPeriodEnd: updatedSubscription!.currentPeriodEnd,
      updated: true,
      action: action
    };

    return new NextResponse(
      JSON.stringify(responseData),
      { 
        status: 200, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Subscription update error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    try {
      await paymentSecurity.logPaymentEvent(
        context!,
        'subscription_update_error',
        'subscription',
        false,
        { 
          subscriptionId: new URL(request.url).searchParams.get('subscriptionId'),
          errorType: error instanceof Error ? error.constructor.name : 'unknown' 
        },
        errorMessage
      );
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new NextResponse(
      JSON.stringify({ error: 'Subscription update failed' }),
      { 
        status: 500, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// =============================================
// DELETE - Delete Subscription (Admin Only)
// =============================================

export async function DELETE(request: NextRequest) {
  const secureHeaders = generateSecureHeaders();

  try {
    // 1. Security validation - admin only
    const { context, response } = await paymentSecurity.validatePaymentRequest(
      request,
      ['admin', 'super_admin']
    );

    if (response) {
      return response;
    }

    // 2. Get subscription ID
    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('subscriptionId');

    if (!subscriptionId) {
      await paymentSecurity.logPaymentEvent(
        context,
        'subscription_delete_missing_id',
        'subscription',
        false,
        {},
        'Subscription ID not provided'
      );

      return new NextResponse(
        JSON.stringify({ error: 'Subscription ID required' }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 3. Cancel subscription immediately (admin override)
    const canceledSubscription = await stripeService.cancelSubscription(
      subscriptionId,
      false // Immediate cancellation
    );

    // 4. Log deletion
    await paymentSecurity.logPaymentEvent(
      context,
      'subscription_deleted_by_admin',
      'subscription',
      true,
      { 
        subscriptionId,
        stripeSubscriptionId: canceledSubscription.stripeSubscriptionId,
        deletedBy: context.userId
      }
    );

    return new NextResponse(
      JSON.stringify({ 
        message: 'Subscription deleted successfully',
        subscriptionId: subscriptionId,
        status: canceledSubscription.status
      }),
      { 
        status: 200, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Subscription deletion error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    try {
      await paymentSecurity.logPaymentEvent(
        context!,
        'subscription_delete_error',
        'subscription',
        false,
        { 
          subscriptionId: new URL(request.url).searchParams.get('subscriptionId'),
          errorType: error instanceof Error ? error.constructor.name : 'unknown' 
        },
        errorMessage
      );
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new NextResponse(
      JSON.stringify({ error: 'Subscription deletion failed' }),
      { 
        status: 500, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}