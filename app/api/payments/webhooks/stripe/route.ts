/**
 * EPIC 5 STORY 5.1: Stripe Integration & Payment Infrastructure
 * Stripe Webhooks API Endpoint - Secure webhook event processing
 * 
 * Handles all Stripe webhook events with signature verification,
 * security validation, and comprehensive event processing.
 */

import { NextRequest, NextResponse } from 'next/server';
import webhookProcessor from '@/lib/payments/webhook-processor';
import paymentSecurity from '@/lib/payments/security-middleware';
import { generateSecureHeaders, ENV_CONFIG } from '@/lib/payments/security-config';

// =============================================
// WEBHOOK CONFIGURATION
// =============================================

// Disable Next.js body parsing to get raw body for signature verification
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// =============================================
// POST - Handle Stripe Webhooks
// =============================================

export async function POST(request: NextRequest) {
  const secureHeaders = generateSecureHeaders();
  const requestId = secureHeaders['X-Request-ID'];
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

  try {
    // 1. Basic security validation for webhooks
    const webhookValidation = await paymentSecurity.validateWebhookRequest(
      request,
      ENV_CONFIG.STRIPE_WEBHOOK_SECRET
    );

    if (!webhookValidation.valid && webhookValidation.response) {
      return webhookValidation.response;
    }

    // 2. Get raw body and signature
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('Missing Stripe signature header');
      return new NextResponse(
        JSON.stringify({ error: 'Missing signature' }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!body) {
      console.error('Missing webhook body');
      return new NextResponse(
        JSON.stringify({ error: 'Missing body' }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 3. Log webhook attempt
    console.log(`Processing webhook request ${requestId} from IP ${ipAddress}`);

    // 4. Process the webhook with comprehensive error handling
    const processingResult = await webhookProcessor.processWebhook(
      body,
      signature,
      ENV_CONFIG.STRIPE_WEBHOOK_SECRET
    );

    // 5. Handle processing results
    if (!processingResult.success) {
      console.error('Webhook processing failed:', {
        eventId: processingResult.eventId,
        eventType: processingResult.eventType,
        error: processingResult.error,
        retryable: processingResult.retryable
      });

      // Determine response based on error type
      if (processingResult.error?.includes('Invalid webhook signature')) {
        return new NextResponse(
          JSON.stringify({ error: 'Invalid signature' }),
          { 
            status: 401, 
            headers: { ...secureHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      if (processingResult.retryable) {
        // Return 500 for retryable errors so Stripe will retry
        return new NextResponse(
          JSON.stringify({ 
            error: 'Processing failed',
            retryable: true,
            eventId: processingResult.eventId
          }),
          { 
            status: 500, 
            headers: { 
              ...secureHeaders, 
              'Content-Type': 'application/json',
              'Retry-After': '60' // Tell Stripe to retry in 60 seconds
            }
          }
        );
      } else {
        // Return 400 for non-retryable errors
        return new NextResponse(
          JSON.stringify({ 
            error: 'Processing failed',
            retryable: false,
            eventId: processingResult.eventId
          }),
          { 
            status: 400, 
            headers: { ...secureHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // 6. Success response
    console.log('Webhook processed successfully:', {
      eventId: processingResult.eventId,
      eventType: processingResult.eventType,
      processed: processingResult.processed
    });

    const responseBody = {
      received: true,
      eventId: processingResult.eventId,
      eventType: processingResult.eventType,
      processed: processingResult.processed,
      requestId: requestId
    };

    return new NextResponse(
      JSON.stringify(responseBody),
      { 
        status: 200, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Webhook endpoint error:', error);

    // Log critical webhook errors
    const errorDetails = {
      requestId,
      ipAddress,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    };

    console.error('Critical webhook error:', errorDetails);

    // Return 500 to trigger Stripe retry
    return new NextResponse(
      JSON.stringify({ 
        error: 'Internal server error',
        requestId: requestId
      }),
      { 
        status: 500, 
        headers: { 
          ...secureHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': '300' // 5 minutes
        }
      }
    );
  }
}

// =============================================
// GET - Webhook Status (For Health Checks)
// =============================================

export async function GET(request: NextRequest) {
  const secureHeaders = generateSecureHeaders();

  try {
    // Only allow internal health checks or admin access
    const { searchParams } = new URL(request.url);
    const healthCheck = searchParams.get('health');
    
    if (healthCheck === 'true') {
      // Simple health check
      return new NextResponse(
        JSON.stringify({ 
          status: 'healthy',
          service: 'stripe-webhooks',
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV
        }),
        { 
          status: 200, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // For non-health check requests, require admin authentication
    const { context, response } = await paymentSecurity.validatePaymentRequest(
      request,
      ['admin', 'super_admin']
    );

    if (response) {
      return response;
    }

    // Return webhook endpoint information for admins
    const webhookInfo = {
      endpoint: '/api/payments/webhooks/stripe',
      supportedEvents: [
        'customer.created',
        'customer.updated',
        'customer.deleted',
        'customer.subscription.created',
        'customer.subscription.updated', 
        'customer.subscription.deleted',
        'customer.subscription.trial_will_end',
        'invoice.created',
        'invoice.finalized',
        'invoice.payment_succeeded',
        'invoice.payment_failed',
        'payment_intent.succeeded',
        'payment_intent.payment_failed',
        'payment_method.attached',
        'charge.succeeded',
        'charge.failed',
        'charge.dispute.created'
      ],
      configuration: {
        signatureValidation: 'enabled',
        rateLimiting: 'enabled',
        ipWhitelisting: ENV_CONFIG.IS_PRODUCTION ? 'enabled' : 'disabled',
        retryLogic: 'enabled'
      },
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    };

    return new NextResponse(
      JSON.stringify(webhookInfo),
      { 
        status: 200, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Webhook GET error:', error);

    return new NextResponse(
      JSON.stringify({ error: 'Failed to get webhook information' }),
      { 
        status: 500, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// =============================================
// Method Not Allowed Handler
// =============================================

export async function PUT() {
  return new NextResponse(
    JSON.stringify({ error: 'Method not allowed' }),
    { 
      status: 405, 
      headers: { 
        ...generateSecureHeaders(),
        'Allow': 'POST, GET',
        'Content-Type': 'application/json'
      }
    }
  );
}

export async function DELETE() {
  return new NextResponse(
    JSON.stringify({ error: 'Method not allowed' }),
    { 
      status: 405, 
      headers: { 
        ...generateSecureHeaders(),
        'Allow': 'POST, GET',
        'Content-Type': 'application/json'
      }
    }
  );
}

export async function PATCH() {
  return new NextResponse(
    JSON.stringify({ error: 'Method not allowed' }),
    { 
      status: 405, 
      headers: { 
        ...generateSecureHeaders(),
        'Allow': 'POST, GET',
        'Content-Type': 'application/json'
      }
    }
  );
}