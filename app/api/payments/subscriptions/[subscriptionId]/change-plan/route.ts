/**
 * EPIC 5 STORY 5.2: Subscription Management & Billing System
 * Plan Change API - Subscription plan modifications with prorations
 * 
 * Handles subscription plan changes including:
 * - Plan upgrades and downgrades
 * - Proration calculations and billing
 * - Immediate vs billing cycle changes
 * - Feature access modifications
 */

import { NextRequest, NextResponse } from 'next/server';
import subscriptionManager from '@/lib/payments/subscription-manager';
import paymentSecurity from '@/lib/payments/security-middleware';
import { generateSecureHeaders } from '@/lib/payments/security-config';
import { z } from 'zod';

// =============================================
// VALIDATION SCHEMAS
// =============================================

const PlanChangeRequestSchema = z.object({
  newPlanId: z.string().uuid(),
  prorationBehavior: z.enum(['create_prorations', 'none', 'always_invoice']).default('create_prorations'),
  billingCycleAnchor: z.enum(['now', 'unchanged']).default('unchanged'),
  paymentMethodId: z.string().optional(),
  couponId: z.string().optional(),
  promotionCode: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

// =============================================
// POST - Change Subscription Plan
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
        'subscription_plan_change_invalid_json',
        'subscription',
        false,
        { subscriptionId, rawBodyLength: rawBody.length },
        'Invalid JSON in plan change request'
      );

      return new NextResponse(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const validation = PlanChangeRequestSchema.safeParse(requestData);

    if (!validation.success) {
      await paymentSecurity.logPaymentEvent(
        context,
        'subscription_plan_change_validation_failed',
        'subscription',
        false,
        { subscriptionId, errors: validation.error.errors },
        'Plan change request validation failed'
      );

      return new NextResponse(
        JSON.stringify({ 
          error: 'Invalid plan change request',
          details: validation.error.errors
        }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const planChangeData = validation.data;

    // 3. Validate subscription exists and access
    const subscription = await subscriptionManager.getSubscriptionWithDetails(subscriptionId);

    if (!subscription) {
      await paymentSecurity.logPaymentEvent(
        context,
        'subscription_plan_change_not_found',
        'subscription',
        false,
        { subscriptionId },
        'Subscription not found for plan change'
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
        'subscription_plan_change_access_denied',
        'subscription',
        false,
        { 
          subscriptionId,
          requestedCustomerId: subscription.customerId,
          allowedCustomerId: context.customerId 
        },
        'Access denied for subscription plan change'
      );

      return new NextResponse(
        JSON.stringify({ error: 'Access denied' }),
        { 
          status: 403, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 4. Validate subscription status
    if (!['active', 'trialing', 'past_due'].includes(subscription.status)) {
      await paymentSecurity.logPaymentEvent(
        context,
        'subscription_plan_change_invalid_status',
        'subscription',
        false,
        { subscriptionId, status: subscription.status },
        `Cannot change plan for subscription with status: ${subscription.status}`
      );

      return new NextResponse(
        JSON.stringify({ 
          error: 'Cannot change plan for this subscription',
          reason: `Subscription status is ${subscription.status}`,
          validStatuses: ['active', 'trialing', 'past_due']
        }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 5. Validate new plan is different from current
    if (planChangeData.newPlanId === subscription.planId) {
      await paymentSecurity.logPaymentEvent(
        context,
        'subscription_plan_change_same_plan',
        'subscription',
        false,
        { subscriptionId, currentPlanId: subscription.planId, newPlanId: planChangeData.newPlanId },
        'Attempted to change to the same plan'
      );

      return new NextResponse(
        JSON.stringify({ 
          error: 'New plan is the same as current plan',
          currentPlan: subscription.plan.name
        }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 6. Get new plan details
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = createClient();
    
    const { data: newPlan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planChangeData.newPlanId)
      .eq('active', true)
      .single();

    if (planError || !newPlan) {
      await paymentSecurity.logPaymentEvent(
        context,
        'subscription_plan_change_invalid_plan',
        'subscription',
        false,
        { subscriptionId, newPlanId: planChangeData.newPlanId },
        'Invalid or inactive plan selected'
      );

      return new NextResponse(
        JSON.stringify({ error: 'Invalid or inactive plan selected' }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 7. Calculate plan change preview (proration details)
    const preview = await subscriptionManager.previewPlanChange(
      subscriptionId,
      planChangeData.newPlanId
    );

    // 8. Execute plan change
    const updatedSubscription = await subscriptionManager.changePlan({
      subscriptionId,
      newPlanId: planChangeData.newPlanId,
      prorationBehavior: planChangeData.prorationBehavior,
      billingCycleAnchor: planChangeData.billingCycleAnchor,
    });

    // 9. Update metadata if provided
    if (planChangeData.metadata) {
      await supabase
        .from('subscriptions')
        .update({
          metadata: {
            ...subscription.metadata,
            ...planChangeData.metadata,
            plan_change_history: [
              ...(subscription.metadata?.plan_change_history || []),
              {
                from_plan: subscription.planId,
                to_plan: planChangeData.newPlanId,
                changed_at: new Date().toISOString(),
                changed_by: context.userId,
                proration_behavior: planChangeData.prorationBehavior,
                billing_cycle_anchor: planChangeData.billingCycleAnchor,
              }
            ]
          },
        })
        .eq('id', subscriptionId);
    }

    // 10. Determine plan change type (upgrade/downgrade)
    const isUpgrade = newPlan.amount > subscription.plan.amount;
    const changeType = isUpgrade ? 'upgrade' : 'downgrade';

    // 11. Log successful plan change
    await paymentSecurity.logPaymentEvent(
      context,
      `subscription_plan_${changeType}d`,
      'subscription',
      true,
      { 
        subscriptionId,
        fromPlan: subscription.plan.name,
        toPlan: newPlan.name,
        fromAmount: subscription.plan.amount,
        toAmount: newPlan.amount,
        prorationBehavior: planChangeData.prorationBehavior,
        immediateCharge: preview.immediateCharge,
        nextBillingAmount: preview.nextBillingAmount
      }
    );

    // 12. Send plan change confirmation
    await sendPlanChangeConfirmation(
      subscription,
      newPlan,
      preview,
      changeType,
      context
    );

    // 13. Return success response
    const responseData = {
      success: true,
      subscriptionId,
      planChange: {
        type: changeType,
        fromPlan: {
          id: subscription.planId,
          name: subscription.plan.name,
          amount: subscription.plan.amount,
          currency: subscription.plan.currency,
        },
        toPlan: {
          id: newPlan.id,
          name: newPlan.name,
          amount: newPlan.amount,
          currency: newPlan.currency,
        },
        effectiveDate: new Date().toISOString(),
        prorationDetails: {
          immediateCharge: preview.immediateCharge,
          nextBillingAmount: preview.nextBillingAmount,
          prorationBehavior: planChangeData.prorationBehavior,
        },
      },
      updatedSubscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        planId: updatedSubscription.planId,
        currentPeriodStart: updatedSubscription.currentPeriodStart,
        currentPeriodEnd: updatedSubscription.currentPeriodEnd,
      },
      message: `Your subscription has been ${changeType}d to ${newPlan.name}. ${
        preview.immediateCharge > 0 
          ? `You will be charged $${(preview.immediateCharge / 100).toFixed(2)} for the prorated difference.`
          : preview.immediateCharge < 0
          ? `You will receive a credit of $${(Math.abs(preview.immediateCharge) / 100).toFixed(2)} for the prorated difference.`
          : 'No immediate charge applies.'
      }`,
    };

    return new NextResponse(
      JSON.stringify(responseData),
      { 
        status: 200, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Subscription plan change error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    try {
      await paymentSecurity.logPaymentEvent(
        context!,
        'subscription_plan_change_error',
        'subscription',
        false,
        { 
          subscriptionId: params.subscriptionId,
          errorType: error instanceof Error ? error.constructor.name : 'unknown' 
        },
        errorMessage
      );
    } catch (logError) {
      console.error('Failed to log plan change error:', logError);
    }

    return new NextResponse(
      JSON.stringify({ error: 'Failed to change subscription plan' }),
      { 
        status: 500, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// =============================================
// GET - Preview Plan Change
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
    const { searchParams } = new URL(request.url);
    const newPlanId = searchParams.get('newPlanId');

    if (!subscriptionId || !newPlanId) {
      return new NextResponse(
        JSON.stringify({ error: 'Subscription ID and new plan ID required' }),
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

    // 3. Validate new plan exists
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = createClient();
    
    const { data: newPlan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', newPlanId)
      .eq('active', true)
      .single();

    if (planError || !newPlan) {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid or inactive plan selected' }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 4. Check if it's the same plan
    if (newPlanId === subscription.planId) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Cannot preview change to the same plan',
          currentPlan: subscription.plan.name
        }),
        { 
          status: 400, 
          headers: { ...secureHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 5. Generate preview
    const preview = await subscriptionManager.previewPlanChange(subscriptionId, newPlanId);

    // 6. Determine change type and feature differences
    const isUpgrade = newPlan.amount > subscription.plan.amount;
    const changeType = isUpgrade ? 'upgrade' : 'downgrade';

    // Calculate feature differences
    const currentFeatures = subscription.plan.features || [];
    const newFeatures = newPlan.features || [];
    const addedFeatures = newFeatures.filter(f => !currentFeatures.includes(f));
    const removedFeatures = currentFeatures.filter(f => !newFeatures.includes(f));

    // 7. Log preview access
    await paymentSecurity.logPaymentEvent(
      context,
      'subscription_plan_change_previewed',
      'subscription',
      true,
      { 
        subscriptionId,
        currentPlanId: subscription.planId,
        newPlanId,
        changeType
      }
    );

    // 8. Return preview data
    const previewData = {
      subscriptionId,
      changeType,
      valid: true,
      currentPlan: {
        id: subscription.planId,
        name: subscription.plan.name,
        amount: subscription.plan.amount,
        currency: subscription.plan.currency,
        interval: subscription.plan.interval,
        features: currentFeatures,
      },
      newPlan: {
        id: newPlan.id,
        name: newPlan.name,
        amount: newPlan.amount,
        currency: newPlan.currency,
        interval: newPlan.interval,
        features: newFeatures,
      },
      proration: {
        immediateCharge: preview.immediateCharge,
        nextBillingAmount: preview.nextBillingAmount,
        effectiveDate: preview.effectiveDate,
        description: preview.immediateCharge > 0 
          ? `You will be charged $${(preview.immediateCharge / 100).toFixed(2)} for the prorated upgrade.`
          : preview.immediateCharge < 0
          ? `You will receive a credit of $${(Math.abs(preview.immediateCharge) / 100).toFixed(2)} for the prorated downgrade.`
          : 'No immediate charge will apply.',
      },
      featureChanges: {
        added: addedFeatures,
        removed: removedFeatures,
        hasChanges: addedFeatures.length > 0 || removedFeatures.length > 0,
      },
      billing: {
        currentPeriodEnd: subscription.currentPeriodEnd,
        nextBillingDate: subscription.currentPeriodEnd,
        newBillingAmount: preview.nextBillingAmount,
        billingInterval: newPlan.interval,
      },
      warnings: generatePlanChangeWarnings(subscription, newPlan, changeType),
    };

    return new NextResponse(
      JSON.stringify(previewData),
      { 
        status: 200, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Preview plan change error:', error);

    return new NextResponse(
      JSON.stringify({ error: 'Failed to preview plan change' }),
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
 * Generate warnings for plan changes
 */
function generatePlanChangeWarnings(
  subscription: any,
  newPlan: any,
  changeType: string
): string[] {
  const warnings = [];

  if (changeType === 'downgrade') {
    warnings.push('Downgrading will reduce your available features.');
    
    if (subscription.plan.features?.includes('unlimited') && !newPlan.features?.includes('unlimited')) {
      warnings.push('You will lose unlimited access and may be subject to usage limits.');
    }
    
    if (subscription.plan.features?.includes('priority_support') && !newPlan.features?.includes('priority_support')) {
      warnings.push('You will lose priority customer support.');
    }
  }

  if (subscription.status === 'trialing') {
    warnings.push('Plan changes during trial period will end your trial immediately.');
  }

  if (subscription.cancelAtPeriodEnd) {
    warnings.push('This subscription is scheduled for cancellation. Changing plans will reactivate it.');
  }

  return warnings;
}

/**
 * Send plan change confirmation email
 */
async function sendPlanChangeConfirmation(
  subscription: any,
  newPlan: any,
  preview: any,
  changeType: string,
  context: any
): Promise<void> {
  try {
    // In a real implementation, this would use an email service
    console.log(`Sending plan ${changeType} confirmation to ${subscription.customer.email}`);
    
    // Here you would integrate with your email service (SendGrid, AWS SES, etc.)
    // await emailService.send({
    //   to: subscription.customer.email,
    //   template: `plan-${changeType}`,
    //   data: {
    //     customerName: subscription.customer.name,
    //     subscriptionId: subscription.id,
    //     oldPlan: subscription.plan.name,
    //     newPlan: newPlan.name,
    //     immediateCharge: preview.immediateCharge,
    //     nextBillingAmount: preview.nextBillingAmount,
    //     effectiveDate: preview.effectiveDate,
    //   }
    // });
  } catch (error) {
    console.error('Send plan change confirmation error:', error);
    // Don't throw error here as it's not critical to the plan change process
  }
}