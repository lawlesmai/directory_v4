/**
 * EPIC 5 STORY 5.1: Stripe Integration & Payment Infrastructure
 * Payment Methods API Endpoint - Secure payment method management
 * 
 * Handles payment method attachment, detachment, and default setting
 * with comprehensive security validation and PCI DSS compliance.
 */

import { NextRequest, NextResponse } from 'next/server';
import stripeService from '@/lib/payments/stripe-service';
import paymentSecurity from '@/lib/payments/security-middleware';
import { generateSecureHeaders, isValidStripeId } from '@/lib/payments/security-config';

// =============================================
// POST - Attach Payment Method
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
        'payment_method_attach_invalid_json',
        'payment_method',
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

    // 3. Validate required fields
    const { paymentMethodId, customerId, setAsDefault } = requestData;

    if (!paymentMethodId || !customerId) {
      await paymentSecurity.logPaymentEvent(
        context,
        'payment_method_attach_missing_fields',
        'payment_method',
        false,
        { hasPaymentMethodId: !!paymentMethodId, hasCustomerId: !!customerId },
        'Missing required fields'
      );

      return new NextResponse(
        JSON.stringify({ 
          error: 'Missing required fields',
          required: ['paymentMethodId', 'customerId']
        }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 4. Validate payment method ID format
    if (!isValidStripeId(paymentMethodId, 'payment_method')) {
      await paymentSecurity.logPaymentEvent(
        context,
        'payment_method_attach_invalid_id',
        'payment_method',
        false,
        { paymentMethodId },
        'Invalid payment method ID format'
      );

      return new NextResponse(
        JSON.stringify({ error: 'Invalid payment method ID format' }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 5. Ensure customer access matches request
    if (customerId !== context.customerId && !context.isAdmin) {
      await paymentSecurity.logPaymentEvent(
        context,
        'payment_method_attach_access_denied',
        'payment_method',
        false,
        { 
          requestedCustomerId: customerId,
          allowedCustomerId: context.customerId,
          paymentMethodId
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

    // 6. Attach payment method
    await stripeService.attachPaymentMethod(customerId, paymentMethodId);

    // 7. Set as default if requested
    if (setAsDefault === true) {
      await stripeService.setDefaultPaymentMethod(customerId, paymentMethodId);
    }

    // 8. Log success
    await paymentSecurity.logPaymentEvent(
      context,
      'payment_method_attached',
      'payment_method',
      true,
      { 
        paymentMethodId,
        customerId,
        setAsDefault: !!setAsDefault,
        stripePaymentMethodId: paymentMethodId
      }
    );

    // 9. Return response
    const responseData = {
      paymentMethodId,
      customerId,
      attached: true,
      setAsDefault: !!setAsDefault,
    };

    return new NextResponse(
      JSON.stringify(responseData),
      { 
        status: 201, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Payment method attachment error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    try {
      await paymentSecurity.logPaymentEvent(
        context!,
        'payment_method_attach_error',
        'payment_method',
        false,
        { errorType: error instanceof Error ? error.constructor.name : 'unknown' },
        errorMessage
      );
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new NextResponse(
      JSON.stringify({ error: 'Payment method attachment failed' }),
      { 
        status: 500, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// =============================================
// GET - List Payment Methods
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
    const customerId = searchParams.get('customerId');
    const paymentMethodId = searchParams.get('paymentMethodId');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 3. Validate customer access
    if (customerId && customerId !== context.customerId && !context.isAdmin) {
      await paymentSecurity.logPaymentEvent(
        context,
        'payment_method_list_access_denied',
        'payment_method',
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

    // 4. Retrieve payment methods from database
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = createClient();

    let query = supabase
      .from('payment_methods')
      .select(`
        id,
        stripe_payment_method_id,
        customer_id,
        type,
        card_brand,
        card_last4,
        card_exp_month,
        card_exp_year,
        card_country,
        billing_details,
        is_default,
        status,
        created_at,
        updated_at,
        stripe_customers!inner(
          email,
          name
        )
      `);

    // Apply filters based on access level
    if (!context.isAdmin) {
      // Non-admin users can only see their own payment methods
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
    if (paymentMethodId) {
      query = query.eq('id', paymentMethodId);
    }

    if (type) {
      query = query.eq('type', type);
    }

    // Only show active payment methods
    query = query.eq('status', 'active');

    // Apply pagination and ordering
    query = query
      .range(offset, offset + limit - 1)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    const { data: paymentMethods, error, count } = await query;

    if (error) {
      console.error('Database error retrieving payment methods:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    // 5. Log access
    await paymentSecurity.logPaymentEvent(
      context,
      paymentMethodId ? 'payment_method_retrieved' : 'payment_methods_listed',
      'payment_method',
      true,
      { 
        paymentMethodId,
        customerId,
        resultCount: paymentMethods?.length || 0,
        filters: { type, limit, offset }
      }
    );

    // 6. Format response (mask sensitive data)
    const responseData = {
      paymentMethods: paymentMethods?.map(pm => ({
        id: pm.id,
        customerId: pm.customer_id,
        type: pm.type,
        card: pm.type === 'card' ? {
          brand: pm.card_brand,
          last4: pm.card_last4,
          expMonth: pm.card_exp_month,
          expYear: pm.card_exp_year,
          country: pm.card_country,
        } : null,
        billingDetails: pm.billing_details,
        isDefault: pm.is_default,
        status: pm.status,
        createdAt: pm.created_at,
        updatedAt: pm.updated_at,
        customer: {
          email: pm.stripe_customers.email,
          name: pm.stripe_customers.name,
        },
        // Note: We don't expose the actual Stripe payment method ID to the client
      })) || [],
      pagination: {
        limit,
        offset,
        total: count || 0,
        hasMore: (paymentMethods?.length || 0) === limit
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
    console.error('Payment methods retrieval error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    try {
      await paymentSecurity.logPaymentEvent(
        context!,
        'payment_method_list_error',
        'payment_method',
        false,
        { errorType: error instanceof Error ? error.constructor.name : 'unknown' },
        errorMessage
      );
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new NextResponse(
      JSON.stringify({ error: 'Payment methods retrieval failed' }),
      { 
        status: 500, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// =============================================
// PUT - Update Payment Method (Set Default)
// =============================================

export async function PUT(request: NextRequest) {
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

    // 2. Parse request body
    const rawBody = await request.text();
    let requestData;

    try {
      requestData = JSON.parse(rawBody);
    } catch (error) {
      await paymentSecurity.logPaymentEvent(
        context,
        'payment_method_update_invalid_json',
        'payment_method',
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

    // 3. Validate request
    const { paymentMethodId, customerId, setAsDefault } = requestData;

    if (!paymentMethodId || !customerId || setAsDefault !== true) {
      await paymentSecurity.logPaymentEvent(
        context,
        'payment_method_update_invalid_request',
        'payment_method',
        false,
        { 
          hasPaymentMethodId: !!paymentMethodId,
          hasCustomerId: !!customerId,
          setAsDefault 
        },
        'Invalid update request'
      );

      return new NextResponse(
        JSON.stringify({ 
          error: 'Invalid request',
          message: 'Currently only setting default payment method is supported'
        }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 4. Validate customer access
    if (customerId !== context.customerId && !context.isAdmin) {
      await paymentSecurity.logPaymentEvent(
        context,
        'payment_method_update_access_denied',
        'payment_method',
        false,
        { 
          requestedCustomerId: customerId,
          allowedCustomerId: context.customerId,
          paymentMethodId
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

    // 5. Set as default payment method
    await stripeService.setDefaultPaymentMethod(customerId, paymentMethodId);

    // 6. Log success
    await paymentSecurity.logPaymentEvent(
      context,
      'payment_method_set_default',
      'payment_method',
      true,
      { 
        paymentMethodId,
        customerId,
        stripePaymentMethodId: paymentMethodId
      }
    );

    // 7. Return response
    const responseData = {
      paymentMethodId,
      customerId,
      setAsDefault: true,
      updated: true,
    };

    return new NextResponse(
      JSON.stringify(responseData),
      { 
        status: 200, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Payment method update error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    try {
      await paymentSecurity.logPaymentEvent(
        context!,
        'payment_method_update_error',
        'payment_method',
        false,
        { errorType: error instanceof Error ? error.constructor.name : 'unknown' },
        errorMessage
      );
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new NextResponse(
      JSON.stringify({ error: 'Payment method update failed' }),
      { 
        status: 500, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// =============================================
// DELETE - Detach Payment Method
// =============================================

export async function DELETE(request: NextRequest) {
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

    // 2. Get parameters
    const { searchParams } = new URL(request.url);
    const paymentMethodId = searchParams.get('paymentMethodId');
    const customerId = searchParams.get('customerId') || context.customerId;

    if (!paymentMethodId || !customerId) {
      await paymentSecurity.logPaymentEvent(
        context,
        'payment_method_detach_missing_params',
        'payment_method',
        false,
        { hasPaymentMethodId: !!paymentMethodId, hasCustomerId: !!customerId },
        'Missing required parameters'
      );

      return new NextResponse(
        JSON.stringify({ error: 'Payment method ID and customer ID required' }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 3. Validate customer access
    if (customerId !== context.customerId && !context.isAdmin) {
      await paymentSecurity.logPaymentEvent(
        context,
        'payment_method_detach_access_denied',
        'payment_method',
        false,
        { 
          requestedCustomerId: customerId,
          allowedCustomerId: context.customerId,
          paymentMethodId
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

    // 4. Get payment method details from database
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = createClient();

    const { data: paymentMethod, error } = await supabase
      .from('payment_methods')
      .select('stripe_payment_method_id, is_default')
      .eq('id', paymentMethodId)
      .eq('customer_id', customerId)
      .single();

    if (error || !paymentMethod) {
      await paymentSecurity.logPaymentEvent(
        context,
        'payment_method_detach_not_found',
        'payment_method',
        false,
        { paymentMethodId, customerId },
        'Payment method not found'
      );

      return new NextResponse(
        JSON.stringify({ error: 'Payment method not found' }),
        { 
          status: 404, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 5. Check if this is the default payment method
    if (paymentMethod.is_default) {
      await paymentSecurity.logPaymentEvent(
        context,
        'payment_method_detach_default_denied',
        'payment_method',
        false,
        { paymentMethodId, customerId },
        'Cannot detach default payment method'
      );

      return new NextResponse(
        JSON.stringify({ 
          error: 'Cannot detach default payment method',
          message: 'Set another payment method as default first'
        }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 6. Detach from Stripe
    const stripe = stripeService.getStripeInstance();
    await stripe.paymentMethods.detach(paymentMethod.stripe_payment_method_id);

    // 7. Update database
    await supabase
      .from('payment_methods')
      .update({ status: 'inactive' })
      .eq('id', paymentMethodId);

    // 8. Log success
    await paymentSecurity.logPaymentEvent(
      context,
      'payment_method_detached',
      'payment_method',
      true,
      { 
        paymentMethodId,
        customerId,
        stripePaymentMethodId: paymentMethod.stripe_payment_method_id
      }
    );

    return new NextResponse(
      JSON.stringify({ 
        message: 'Payment method detached successfully',
        paymentMethodId,
        detached: true
      }),
      { 
        status: 200, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Payment method detachment error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    try {
      await paymentSecurity.logPaymentEvent(
        context!,
        'payment_method_detach_error',
        'payment_method',
        false,
        { 
          paymentMethodId: new URL(request.url).searchParams.get('paymentMethodId'),
          errorType: error instanceof Error ? error.constructor.name : 'unknown' 
        },
        errorMessage
      );
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new NextResponse(
      JSON.stringify({ error: 'Payment method detachment failed' }),
      { 
        status: 500, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}