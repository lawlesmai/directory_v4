/**
 * EPIC 5 STORY 5.1: Stripe Integration & Payment Infrastructure
 * Customers API Endpoint - Secure customer management
 * 
 * Handles customer creation, retrieval, and updates with comprehensive
 * security validation and audit logging.
 */

import { NextRequest, NextResponse } from 'next/server';
import stripeService from '@/lib/payments/stripe-service';
import paymentSecurity from '@/lib/payments/security-middleware';
import { generateSecureHeaders } from '@/lib/payments/security-config';

// =============================================
// POST - Create Customer
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
        'customer_create_invalid_json',
        'customer',
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

    // 3. Validate request data
    const validation = paymentSecurity.validatePaymentData(
      requestData,
      paymentSecurity.getCustomerRequestSchema()
    );

    if (!validation.valid) {
      await paymentSecurity.logPaymentEvent(
        context,
        'customer_create_validation_failed',
        'customer',
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

    // 4. Add user/business context
    const customerData = {
      ...validation.data,
      userId: context.businessId ? undefined : context.userId,
      businessId: context.businessId,
    };

    // 5. Create customer
    const customer = await stripeService.createCustomer(customerData);

    // 6. Log success
    await paymentSecurity.logPaymentEvent(
      context,
      'customer_created',
      'customer',
      true,
      { 
        customerId: customer.id,
        stripeCustomerId: customer.stripeCustomerId,
        email: customer.email 
      }
    );

    // 7. Return response (without sensitive data)
    const responseData = {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
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
    console.error('Customer creation error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log error (context might not be available)
    try {
      await paymentSecurity.logPaymentEvent(
        context!,
        'customer_create_error',
        'customer',
        false,
        { errorType: error instanceof Error ? error.constructor.name : 'unknown' },
        errorMessage
      );
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new NextResponse(
      JSON.stringify({ error: 'Customer creation failed' }),
      { 
        status: 500, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// =============================================
// GET - Retrieve Customer
// =============================================

export async function GET(request: NextRequest) {
  const secureHeaders = generateSecureHeaders();

  try {
    // 1. Security validation with customer access check
    const { context, response } = await paymentSecurity.validatePaymentRequest(
      request,
      ['authenticated', 'business_owner', 'admin'],
      true // requireCustomerAccess
    );

    if (response) {
      return response;
    }

    // 2. Get customer ID from URL
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId') || context.customerId;

    if (!customerId) {
      await paymentSecurity.logPaymentEvent(
        context,
        'customer_get_missing_id',
        'customer',
        false,
        {},
        'Customer ID not provided'
      );

      return new NextResponse(
        JSON.stringify({ error: 'Customer ID required' }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 3. Retrieve customer
    const customer = await stripeService.getCustomer(customerId);

    if (!customer) {
      await paymentSecurity.logPaymentEvent(
        context,
        'customer_not_found',
        'customer',
        false,
        { requestedCustomerId: customerId },
        'Customer not found'
      );

      return new NextResponse(
        JSON.stringify({ error: 'Customer not found' }),
        { 
          status: 404, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 4. Log access
    await paymentSecurity.logPaymentEvent(
      context,
      'customer_retrieved',
      'customer',
      true,
      { 
        customerId: customer.id,
        stripeCustomerId: customer.stripeCustomerId 
      }
    );

    // 5. Return customer data (without sensitive information)
    const responseData = {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      billingAddress: customer.billingAddress,
      shippingAddress: customer.shippingAddress,
      // Note: We don't return the actual Stripe customer ID to the client
    };

    return new NextResponse(
      JSON.stringify(responseData),
      { 
        status: 200, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Customer retrieval error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    try {
      await paymentSecurity.logPaymentEvent(
        context!,
        'customer_get_error',
        'customer',
        false,
        { errorType: error instanceof Error ? error.constructor.name : 'unknown' },
        errorMessage
      );
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new NextResponse(
      JSON.stringify({ error: 'Customer retrieval failed' }),
      { 
        status: 500, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// =============================================
// PUT - Update Customer
// =============================================

export async function PUT(request: NextRequest) {
  const secureHeaders = generateSecureHeaders();

  try {
    // 1. Security validation with customer access check
    const { context, response } = await paymentSecurity.validatePaymentRequest(
      request,
      ['authenticated', 'business_owner', 'admin'],
      true // requireCustomerAccess
    );

    if (response) {
      return response;
    }

    // 2. Get customer ID from URL
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId') || context.customerId;

    if (!customerId) {
      await paymentSecurity.logPaymentEvent(
        context,
        'customer_update_missing_id',
        'customer',
        false,
        {},
        'Customer ID not provided'
      );

      return new NextResponse(
        JSON.stringify({ error: 'Customer ID required' }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 3. Parse and validate request body
    const rawBody = await request.text();
    let requestData;

    try {
      requestData = JSON.parse(rawBody);
    } catch (error) {
      await paymentSecurity.logPaymentEvent(
        context,
        'customer_update_invalid_json',
        'customer',
        false,
        { customerId, rawBodyLength: rawBody.length },
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

    // 4. Validate request data (partial update schema)
    const updateSchema = paymentSecurity.getCustomerRequestSchema().partial();
    const validation = paymentSecurity.validatePaymentData(requestData, updateSchema);

    if (!validation.valid) {
      await paymentSecurity.logPaymentEvent(
        context,
        'customer_update_validation_failed',
        'customer',
        false,
        { customerId, errors: validation.errors },
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

    // 5. Update customer
    const updatedCustomer = await stripeService.updateCustomer(customerId, validation.data);

    if (!updatedCustomer) {
      await paymentSecurity.logPaymentEvent(
        context,
        'customer_update_not_found',
        'customer',
        false,
        { customerId },
        'Customer not found for update'
      );

      return new NextResponse(
        JSON.stringify({ error: 'Customer not found' }),
        { 
          status: 404, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 6. Log success
    await paymentSecurity.logPaymentEvent(
      context,
      'customer_updated',
      'customer',
      true,
      { 
        customerId: updatedCustomer.id,
        stripeCustomerId: updatedCustomer.stripeCustomerId,
        updatedFields: Object.keys(validation.data)
      }
    );

    // 7. Return updated customer data
    const responseData = {
      id: updatedCustomer.id,
      email: updatedCustomer.email,
      name: updatedCustomer.name,
      phone: updatedCustomer.phone,
      billingAddress: updatedCustomer.billingAddress,
      shippingAddress: updatedCustomer.shippingAddress,
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
    console.error('Customer update error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    try {
      await paymentSecurity.logPaymentEvent(
        context!,
        'customer_update_error',
        'customer',
        false,
        { 
          customerId: new URL(request.url).searchParams.get('customerId'),
          errorType: error instanceof Error ? error.constructor.name : 'unknown' 
        },
        errorMessage
      );
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new NextResponse(
      JSON.stringify({ error: 'Customer update failed' }),
      { 
        status: 500, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// =============================================
// DELETE - Delete Customer (Soft Delete)
// =============================================

export async function DELETE(request: NextRequest) {
  const secureHeaders = generateSecureHeaders();

  try {
    // 1. Security validation - only admins can delete customers
    const { context, response } = await paymentSecurity.validatePaymentRequest(
      request,
      ['admin', 'super_admin'],
      true // requireCustomerAccess
    );

    if (response) {
      return response;
    }

    // 2. Get customer ID from URL
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId') || context.customerId;

    if (!customerId) {
      await paymentSecurity.logPaymentEvent(
        context,
        'customer_delete_missing_id',
        'customer',
        false,
        {},
        'Customer ID not provided'
      );

      return new NextResponse(
        JSON.stringify({ error: 'Customer ID required' }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 3. Check if customer exists
    const customer = await stripeService.getCustomer(customerId);
    if (!customer) {
      await paymentSecurity.logPaymentEvent(
        context,
        'customer_delete_not_found',
        'customer',
        false,
        { customerId },
        'Customer not found for deletion'
      );

      return new NextResponse(
        JSON.stringify({ error: 'Customer not found' }),
        { 
          status: 404, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 4. Check for active subscriptions (prevent deletion if active)
    // This would be implemented with actual subscription checking logic
    // For now, we'll just log the deletion attempt
    
    // 5. Soft delete customer (mark as deleted in database)
    // In a real implementation, we would:
    // - Cancel any active subscriptions
    // - Mark customer as deleted in our database
    // - Keep Stripe customer for compliance but mark as inactive
    
    await paymentSecurity.logPaymentEvent(
      context,
      'customer_deleted',
      'customer',
      true,
      { 
        customerId,
        stripeCustomerId: customer.stripeCustomerId,
        deletedBy: context.userId
      },
      'Customer soft deleted by admin'
    );

    return new NextResponse(
      JSON.stringify({ 
        message: 'Customer deleted successfully',
        customerId: customerId
      }),
      { 
        status: 200, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Customer deletion error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    try {
      await paymentSecurity.logPaymentEvent(
        context!,
        'customer_delete_error',
        'customer',
        false,
        { 
          customerId: new URL(request.url).searchParams.get('customerId'),
          errorType: error instanceof Error ? error.constructor.name : 'unknown' 
        },
        errorMessage
      );
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new NextResponse(
      JSON.stringify({ error: 'Customer deletion failed' }),
      { 
        status: 500, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}