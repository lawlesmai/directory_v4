/**
 * EPIC 5 STORY 5.7: Payment Failure Recovery & Dunning Management
 * Payment Retry API - Manual retry triggers and retry history
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import paymentFailureHandler from '@/lib/payments/payment-failure-handler';
import { withAuth } from '@/lib/api/middleware';

// =============================================
// VALIDATION SCHEMAS
// =============================================

const RetryPaymentSchema = z.object({
  failureId: z.string().uuid(),
  paymentMethodId: z.string().optional(),
  skipRetryCount: z.boolean().default(false),
});

const GetRetryHistorySchema = z.object({
  customerId: z.string().uuid().optional(),
  failureId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

// =============================================
// API HANDLERS
// =============================================

/**
 * POST /api/payments/recovery/retry
 * Manually retry a failed payment
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const body = await req.json();
      const { failureId, paymentMethodId, skipRetryCount } = RetryPaymentSchema.parse(body);

      const supabase = createClient();

      // Verify user has access to this payment failure
      const { data: failure, error: failureError } = await supabase
        .from('payment_failures')
        .select(`
          *,
          stripe_customers!inner(user_id, business_id)
        `)
        .eq('id', failureId)
        .single();

      if (failureError || !failure) {
        return NextResponse.json(
          { error: 'Payment failure not found' },
          { status: 404 }
        );
      }

      // Check access permissions
      const hasAccess = failure.stripe_customers.user_id === user.id ||
        (failure.stripe_customers.business_id && await checkBusinessAccess(
          user.id,
          failure.stripe_customers.business_id,
          supabase
        ));

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }

      // Retry the payment
      const result = await paymentFailureHandler.retryPayment({
        failureId,
        paymentMethodId,
        skipRetryCount,
      });

      return NextResponse.json({
        success: result.success,
        paymentIntent: result.paymentIntent ? {
          id: result.paymentIntent.id,
          status: result.paymentIntent.status,
          amount: result.paymentIntent.amount,
          currency: result.paymentIntent.currency,
        } : undefined,
        nextRetryAt: result.nextRetryAt,
        failure: result.failure ? {
          id: result.failure.id,
          status: result.failure.status,
          retryCount: result.failure.retryCount,
          maxRetryAttempts: result.failure.maxRetryAttempts,
          nextRetryAt: result.failure.nextRetryAt,
          resolutionType: result.failure.resolutionType,
          resolvedAt: result.failure.resolvedAt,
        } : undefined,
      });
    } catch (error) {
      console.error('Retry payment API error:', error);
      
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request data', details: error.errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to retry payment' },
        { status: 500 }
      );
    }
  });
}

/**
 * GET /api/payments/recovery/retry
 * Get retry history for failures
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const { searchParams } = new URL(req.url);
      const query = {
        customerId: searchParams.get('customerId') || undefined,
        failureId: searchParams.get('failureId') || undefined,
        limit: parseInt(searchParams.get('limit') || '20'),
        offset: parseInt(searchParams.get('offset') || '0'),
      };

      const { customerId, failureId, limit, offset } = GetRetryHistorySchema.parse(query);

      const supabase = createClient();

      // Build query based on filters
      let dbQuery = supabase
        .from('payment_failures')
        .select(`
          id,
          customer_id,
          subscription_id,
          failure_reason,
          failure_code,
          failure_message,
          amount,
          currency,
          retry_count,
          max_retry_attempts,
          next_retry_at,
          last_retry_at,
          status,
          resolution_type,
          resolved_at,
          created_at,
          updated_at,
          stripe_customers!inner(
            id,
            user_id,
            business_id,
            email,
            name
          )
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Add filters
      if (customerId) {
        dbQuery = dbQuery.eq('customer_id', customerId);
      }

      if (failureId) {
        dbQuery = dbQuery.eq('id', failureId);
      }

      const { data: failures, error } = await dbQuery;

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      if (!failures) {
        return NextResponse.json({ failures: [], total: 0 });
      }

      // Filter results based on user access
      const accessibleFailures = [];
      for (const failure of failures) {
        const hasAccess = failure.stripe_customers.user_id === user.id ||
          (failure.stripe_customers.business_id && await checkBusinessAccess(
            user.id,
            failure.stripe_customers.business_id,
            supabase
          ));

        if (hasAccess) {
          accessibleFailures.push({
            id: failure.id,
            customerId: failure.customer_id,
            subscriptionId: failure.subscription_id,
            customer: {
              id: failure.stripe_customers.id,
              email: failure.stripe_customers.email,
              name: failure.stripe_customers.name,
            },
            failureReason: failure.failure_reason,
            failureCode: failure.failure_code,
            failureMessage: failure.failure_message,
            amount: failure.amount,
            currency: failure.currency,
            retryCount: failure.retry_count,
            maxRetryAttempts: failure.max_retry_attempts,
            nextRetryAt: failure.next_retry_at,
            lastRetryAt: failure.last_retry_at,
            status: failure.status,
            resolutionType: failure.resolution_type,
            resolvedAt: failure.resolved_at,
            createdAt: failure.created_at,
            updatedAt: failure.updated_at,
          });
        }
      }

      return NextResponse.json({
        failures: accessibleFailures,
        total: accessibleFailures.length,
        hasMore: failures.length === limit,
      });
    } catch (error) {
      console.error('Get retry history API error:', error);
      
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request parameters', details: error.errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to get retry history' },
        { status: 500 }
      );
    }
  });
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Check if user has access to business
 */
async function checkBusinessAccess(
  userId: string,
  businessId: string,
  supabase: any
): Promise<boolean> {
  try {
    const { data: member } = await supabase
      .from('business_members')
      .select('role')
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .in('role', ['owner', 'admin', 'billing'])
      .single();

    return !!member;
  } catch (error) {
    return false;
  }
}