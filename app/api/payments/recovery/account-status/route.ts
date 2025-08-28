/**
 * EPIC 5 STORY 5.7: Payment Failure Recovery & Dunning Management
 * Account Status API - Account state management and restoration
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import accountStateManager from '@/lib/payments/account-state-manager';
import { withAuth } from '@/lib/api/middleware';

// =============================================
// VALIDATION SCHEMAS
// =============================================

const GetAccountStatusSchema = z.object({
  customerId: z.string().uuid(),
});

const UpdateAccountStateSchema = z.object({
  accountStateId: z.string().uuid(),
  state: z.enum(['active', 'grace_period', 'restricted', 'suspended', 'canceled']),
  reason: z.string(),
  manualOverride: z.boolean().default(false),
  overrideReason: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const CheckFeatureAccessSchema = z.object({
  customerId: z.string().uuid(),
  feature: z.string(),
});

const ReactivateAccountSchema = z.object({
  customerId: z.string().uuid(),
  paymentIntentId: z.string(),
});

// =============================================
// API HANDLERS
// =============================================

/**
 * GET /api/payments/recovery/account-status
 * Get current account status and feature restrictions
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const { searchParams } = new URL(req.url);
      const { customerId } = GetAccountStatusSchema.parse({
        customerId: searchParams.get('customerId'),
      });

      const supabase = createClient();

      // Verify user has access to this customer
      const { data: customer, error: customerError } = await supabase
        .from('stripe_customers')
        .select('user_id, business_id, email, name')
        .eq('id', customerId)
        .single();

      if (customerError || !customer) {
        return NextResponse.json(
          { error: 'Customer not found' },
          { status: 404 }
        );
      }

      // Check access permissions
      const hasAccess = customer.user_id === user.id ||
        (customer.business_id && await checkBusinessAccess(
          user.id,
          customer.business_id,
          supabase
        ));

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }

      // Get current account state
      const { data: accountState } = await supabase
        .from('account_states')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get feature restrictions
      const featureRestrictions = await accountStateManager.getFeatureRestrictions(customerId);

      return NextResponse.json({
        customer: {
          id: customerId,
          email: customer.email,
          name: customer.name,
        },
        accountState: accountState ? {
          id: accountState.id,
          state: accountState.state,
          previousState: accountState.previous_state,
          reason: accountState.reason,
          gracePeriodEnd: accountState.grace_period_end,
          suspensionDate: accountState.suspension_date,
          reactivationDate: accountState.reactivation_date,
          featureRestrictions: accountState.feature_restrictions,
          dataRetentionPeriod: accountState.data_retention_period,
          manualOverride: accountState.manual_override,
          overrideReason: accountState.override_reason,
          createdAt: accountState.created_at,
          updatedAt: accountState.updated_at,
        } : null,
        featureAccess: {
          accountState: featureRestrictions.accountState,
          restrictions: featureRestrictions.restrictions,
          allowedFeatures: featureRestrictions.allowedFeatures,
          gracePeriodEnd: featureRestrictions.gracePeriodEnd,
        },
      });
    } catch (error) {
      console.error('Get account status API error:', error);
      
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request parameters', details: error.errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to get account status' },
        { status: 500 }
      );
    }
  });
}

/**
 * PUT /api/payments/recovery/account-status
 * Update account state (admin/manual override)
 */
export async function PUT(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const body = await req.json();
      const data = UpdateAccountStateSchema.parse(body);

      const supabase = createClient();

      // Verify user has admin access or business access
      const { data: accountState, error: stateError } = await supabase
        .from('account_states')
        .select(`
          *,
          stripe_customers!inner(user_id, business_id)
        `)
        .eq('id', data.accountStateId)
        .single();

      if (stateError || !accountState) {
        return NextResponse.json(
          { error: 'Account state not found' },
          { status: 404 }
        );
      }

      // Check if user is admin
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('roles(name)')
        .eq('user_id', user.id)
        .single();

      const isAdmin = userRole?.roles?.name === 'admin' || userRole?.roles?.name === 'super_admin';

      // Check business access for non-admin users
      if (!isAdmin) {
        const hasBusinessAccess = accountState.stripe_customers.user_id === user.id ||
          (accountState.stripe_customers.business_id && await checkBusinessAccess(
            user.id,
            accountState.stripe_customers.business_id,
            supabase
          ));

        if (!hasBusinessAccess) {
          return NextResponse.json(
            { error: 'Access denied' },
            { status: 403 }
          );
        }
      }

      // Update account state
      const updatedState = await accountStateManager.updateAccountState({
        ...data,
        overrideBy: user.id,
      });

      return NextResponse.json({
        accountState: {
          id: updatedState.id,
          customerId: updatedState.customerId,
          subscriptionId: updatedState.subscriptionId,
          state: updatedState.state,
          previousState: updatedState.previousState,
          reason: updatedState.reason,
          gracePeriodEnd: updatedState.gracePeriodEnd,
          suspensionDate: updatedState.suspensionDate,
          reactivationDate: updatedState.reactivationDate,
          featureRestrictions: updatedState.featureRestrictions,
          dataRetentionPeriod: updatedState.dataRetentionPeriod,
          manualOverride: updatedState.manualOverride,
          overrideReason: updatedState.overrideReason,
          overrideBy: updatedState.overrideBy,
          createdAt: updatedState.createdAt,
          updatedAt: updatedState.updatedAt,
        },
      });
    } catch (error) {
      console.error('Update account state API error:', error);
      
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request data', details: error.errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to update account state' },
        { status: 500 }
      );
    }
  });
}

/**
 * POST /api/payments/recovery/account-status/feature-access
 * Check feature access for customer
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const body = await req.json();
      const { customerId, feature } = CheckFeatureAccessSchema.parse(body);

      const supabase = createClient();

      // Verify user has access to this customer
      const { data: customer, error: customerError } = await supabase
        .from('stripe_customers')
        .select('user_id, business_id')
        .eq('id', customerId)
        .single();

      if (customerError || !customer) {
        return NextResponse.json(
          { error: 'Customer not found' },
          { status: 404 }
        );
      }

      // Check access permissions
      const hasAccess = customer.user_id === user.id ||
        (customer.business_id && await checkBusinessAccess(
          user.id,
          customer.business_id,
          supabase
        ));

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }

      // Check feature access
      const featureAccess = await accountStateManager.checkFeatureAccess({
        customerId,
        feature,
      });

      return NextResponse.json({
        feature,
        allowed: featureAccess.allowed,
        reason: featureAccess.reason,
        gracePeriodEnd: featureAccess.gracePeriodEnd,
      });
    } catch (error) {
      console.error('Check feature access API error:', error);
      
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request data', details: error.errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to check feature access' },
        { status: 500 }
      );
    }
  });
}

// =============================================
// REACTIVATION ENDPOINT
// =============================================

/**
 * POST /api/payments/recovery/account-status/reactivate
 * Reactivate account after successful payment
 */
export async function reactivateAccount(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const body = await req.json();
      const { customerId, paymentIntentId } = ReactivateAccountSchema.parse(body);

      const supabase = createClient();

      // Verify user has access to this customer
      const { data: customer, error: customerError } = await supabase
        .from('stripe_customers')
        .select('user_id, business_id')
        .eq('id', customerId)
        .single();

      if (customerError || !customer) {
        return NextResponse.json(
          { error: 'Customer not found' },
          { status: 404 }
        );
      }

      // Check access permissions
      const hasAccess = customer.user_id === user.id ||
        (customer.business_id && await checkBusinessAccess(
          user.id,
          customer.business_id,
          supabase
        ));

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }

      // Process payment success and reactivate account
      const accountState = await accountStateManager.processPaymentSuccess(
        customerId,
        paymentIntentId
      );

      return NextResponse.json({
        success: true,
        accountState: accountState ? {
          id: accountState.id,
          customerId: accountState.customerId,
          state: accountState.state,
          previousState: accountState.previousState,
          reason: accountState.reason,
          reactivationDate: accountState.reactivationDate,
          featureRestrictions: accountState.featureRestrictions,
          createdAt: accountState.createdAt,
          updatedAt: accountState.updatedAt,
        } : null,
      });
    } catch (error) {
      console.error('Reactivate account API error:', error);
      
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request data', details: error.errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to reactivate account' },
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