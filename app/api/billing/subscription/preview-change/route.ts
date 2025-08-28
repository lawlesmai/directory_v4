/**
 * EPIC 5 STORY 5.5: Subscription Change Preview API Route
 * Provides cost preview for subscription plan changes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// =============================================
// VALIDATION SCHEMAS
// =============================================

const PreviewSchema = z.object({
  newPlanId: z.string(),
  newInterval: z.enum(['month', 'year']),
});

// =============================================
// TYPES AND INTERFACES
// =============================================

interface PlanChangePreview {
  newPlan: {
    id: string;
    name: string;
    amount: number;
    currency: string;
    interval: string;
  };
  newInterval: 'month' | 'year';
  prorationAmount: number;
  effectiveDate: Date;
  nextBillingDate: Date;
  nextBillingAmount: number;
}

// =============================================
// API HANDLER
// =============================================

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const body = await request.json();
    
    // Validate request body
    const { newPlanId, newInterval } = PreviewSchema.parse(body);

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    // Get current subscription
    const { data: currentSubscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq('user_id', user.id)
      .single();

    if (subscriptionError || !currentSubscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // Get new plan details
    const { data: newPlan, error: newPlanError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', newPlanId)
      .single();

    if (newPlanError || !newPlan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Calculate pricing based on interval
    const newPlanAmount = newInterval === 'year' 
      ? Math.round(newPlan.amount * 12 * 0.83) // 17% discount for yearly
      : newPlan.amount;

    // Calculate proration
    const currentPeriodStart = new Date(currentSubscription.current_period_start);
    const currentPeriodEnd = new Date(currentSubscription.current_period_end);
    const now = new Date();

    // Calculate remaining days in current period
    const totalPeriodDays = Math.ceil((currentPeriodEnd.getTime() - currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24));
    const remainingDays = Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const usedDays = totalPeriodDays - remainingDays;

    // Calculate proration amounts
    const currentPlanDailyRate = (currentSubscription.plan?.amount || 0) / totalPeriodDays;
    const newPlanDailyRate = newPlanAmount / (newInterval === 'year' ? 365 : 30);

    // Unused amount from current plan
    const unusedCurrentAmount = currentPlanDailyRate * remainingDays;
    
    // Amount for new plan for remaining period
    const newPlanRemainingAmount = newPlanDailyRate * remainingDays;
    
    // Proration amount (positive = additional charge, negative = credit)
    const prorationAmount = newPlanRemainingAmount - unusedCurrentAmount;

    // Calculate next billing details
    const effectiveDate = now;
    const nextBillingDate = new Date(currentPeriodEnd);
    const nextBillingAmount = newPlanAmount;

    // If changing to yearly, next billing is in a year
    if (newInterval === 'year') {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    } else {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    }

    const preview: PlanChangePreview = {
      newPlan: {
        id: newPlan.id,
        name: newPlan.name,
        amount: newPlanAmount,
        currency: newPlan.currency || 'usd',
        interval: newInterval,
      },
      newInterval,
      prorationAmount: Math.round(prorationAmount),
      effectiveDate,
      nextBillingDate,
      nextBillingAmount: Math.round(nextBillingAmount),
    };

    return NextResponse.json(preview);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Subscription preview error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}