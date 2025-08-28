/**
 * EPIC 5 STORY 5.2: Subscription Management & Billing System
 * Subscription Manager Service - Complete subscription lifecycle management
 * 
 * This service provides comprehensive subscription management including:
 * - Subscription creation and management
 * - Plan changes with proration calculations
 * - Trial management and conversion
 * - Automated billing workflows
 * - Usage-based billing and overages
 */

import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import stripeService, { StripeCustomer, StripeSubscription } from './stripe-service';
import { z } from 'zod';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface SubscriptionWithDetails extends StripeSubscription {
  customer: StripeCustomer;
  plan: {
    id: string;
    name: string;
    amount: number;
    currency: string;
    interval: string;
    features: string[];
  };
  usage?: {
    current: number;
    limit: number;
    overageRate: number;
  };
}

export interface PlanChangePreview {
  currentPlan: {
    name: string;
    amount: number;
    remainingDays: number;
    proratedRefund: number;
  };
  newPlan: {
    name: string;
    amount: number;
    proratedCharge: number;
  };
  immediateCharge: number;
  nextBillingAmount: number;
  effectiveDate: Date;
}

export interface TrialConversionOptions {
  planId: string;
  paymentMethodId?: string;
  couponId?: string;
  promotionCode?: string;
}

export interface UsageBillingOptions {
  meteredPriceId: string;
  quantity: number;
  timestamp?: number;
  action?: 'increment' | 'set';
}

// =============================================
// VALIDATION SCHEMAS
// =============================================

const CreateSubscriptionSchema = z.object({
  customerId: z.string().uuid(),
  planId: z.string().uuid(),
  paymentMethodId: z.string().optional(),
  trialDays: z.number().min(0).max(90).default(14),
  couponId: z.string().optional(),
  promotionCode: z.string().optional(),
  collectPaymentMethod: z.boolean().default(false),
  metadata: z.record(z.string()).optional(),
});

const ChangePlanSchema = z.object({
  subscriptionId: z.string().uuid(),
  newPlanId: z.string().uuid(),
  prorationBehavior: z.enum(['create_prorations', 'none', 'always_invoice']).default('create_prorations'),
  billingCycleAnchor: z.enum(['now', 'unchanged']).default('unchanged'),
});

const UpdateUsageSchema = z.object({
  subscriptionId: z.string().uuid(),
  subscriptionItemId: z.string(),
  quantity: z.number().positive(),
  timestamp: z.number().optional(),
  action: z.enum(['increment', 'set']).default('increment'),
});

// =============================================
// SUBSCRIPTION MANAGER SERVICE
// =============================================

class SubscriptionManager {
  private supabase;
  private stripe: Stripe;

  constructor() {
    this.supabase = createClient();
    this.stripe = stripeService.getStripeInstance();
  }

  // =============================================
  // SUBSCRIPTION CREATION & MANAGEMENT
  // =============================================

  /**
   * Create new subscription with trial period
   */
  async createSubscription(
    data: z.infer<typeof CreateSubscriptionSchema>
  ): Promise<SubscriptionWithDetails> {
    try {
      const validatedData = CreateSubscriptionSchema.parse(data);

      // Get customer and plan details
      const customer = await stripeService.getCustomer(validatedData.customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      const { data: plan } = await this.supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', validatedData.planId)
        .single();

      if (!plan) {
        throw new Error('Subscription plan not found');
      }

      // Create subscription in Stripe
      const subscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: customer.stripeCustomerId,
        items: [{ price: plan.stripe_price_id }],
        trial_period_days: validatedData.trialDays > 0 ? validatedData.trialDays : undefined,
        collection_method: validatedData.collectPaymentMethod ? 'charge_automatically' : 'charge_automatically',
        metadata: validatedData.metadata,
        expand: ['latest_invoice.payment_intent', 'customer'],
      };

      // Add payment method if provided
      if (validatedData.paymentMethodId) {
        subscriptionParams.default_payment_method = validatedData.paymentMethodId;
      }

      // Add coupon if provided
      if (validatedData.couponId) {
        subscriptionParams.coupon = validatedData.couponId;
      }

      // Add promotion code if provided
      if (validatedData.promotionCode) {
        subscriptionParams.promotion_code = validatedData.promotionCode;
      }

      const stripeSubscription = await this.stripe.subscriptions.create(subscriptionParams);

      // Store subscription in database
      const { data: dbSubscription, error } = await this.supabase
        .from('subscriptions')
        .insert({
          stripe_subscription_id: stripeSubscription.id,
          customer_id: validatedData.customerId,
          plan_id: validatedData.planId,
          status: stripeSubscription.status,
          quantity: stripeSubscription.items.data[0]?.quantity || 1,
          current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
          trial_start: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000).toISOString() : null,
          trial_end: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000).toISOString() : null,
          cancel_at_period_end: stripeSubscription.cancel_at_period_end,
          collection_method: stripeSubscription.collection_method,
          default_payment_method: stripeSubscription.default_payment_method?.toString(),
          latest_invoice: stripeSubscription.latest_invoice?.toString(),
          metadata: validatedData.metadata,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return this.mapToSubscriptionWithDetails(dbSubscription, customer, plan);
    } catch (error) {
      console.error('Create subscription error:', error);
      throw new Error(`Failed to create subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get subscription with full details
   */
  async getSubscriptionWithDetails(subscriptionId: string): Promise<SubscriptionWithDetails | null> {
    try {
      const { data } = await this.supabase
        .from('subscriptions')
        .select(`
          *,
          customer:stripe_customers(*),
          plan:subscription_plans(*)
        `)
        .eq('id', subscriptionId)
        .single();

      if (!data) return null;

      return this.mapToSubscriptionWithDetails(data, data.customer, data.plan);
    } catch (error) {
      console.error('Get subscription error:', error);
      return null;
    }
  }

  /**
   * Get all subscriptions for a customer
   */
  async getCustomerSubscriptions(customerId: string): Promise<SubscriptionWithDetails[]> {
    try {
      const { data } = await this.supabase
        .from('subscriptions')
        .select(`
          *,
          customer:stripe_customers(*),
          plan:subscription_plans(*)
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (!data) return [];

      return data.map(sub => this.mapToSubscriptionWithDetails(sub, sub.customer, sub.plan));
    } catch (error) {
      console.error('Get customer subscriptions error:', error);
      return [];
    }
  }

  // =============================================
  // PLAN CHANGES & PRORATIONS
  // =============================================

  /**
   * Preview plan change with proration calculations
   */
  async previewPlanChange(
    subscriptionId: string,
    newPlanId: string
  ): Promise<PlanChangePreview> {
    try {
      const subscription = await this.getSubscriptionWithDetails(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const { data: newPlan } = await this.supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', newPlanId)
        .single();

      if (!newPlan) {
        throw new Error('New plan not found');
      }

      // Preview the change in Stripe
      const upcoming = await this.stripe.invoices.retrieveUpcoming({
        customer: subscription.customer.stripeCustomerId,
        subscription: subscription.stripeSubscriptionId,
        subscription_items: [{
          id: subscription.stripeSubscriptionId, // This would need the actual subscription item ID
          price: newPlan.stripe_price_id,
        }],
        subscription_proration_behavior: 'create_prorations',
      });

      // Calculate remaining days in current period
      const now = new Date();
      const periodEnd = new Date(subscription.currentPeriodEnd);
      const remainingDays = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Calculate prorations
      const currentPeriodDays = Math.ceil(
        (subscription.currentPeriodEnd.getTime() - subscription.currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      const usedDays = currentPeriodDays - remainingDays;
      const proratedRefund = Math.floor((subscription.plan.amount * remainingDays) / currentPeriodDays);
      const proratedCharge = Math.floor((newPlan.amount * remainingDays) / currentPeriodDays);

      return {
        currentPlan: {
          name: subscription.plan.name,
          amount: subscription.plan.amount,
          remainingDays,
          proratedRefund,
        },
        newPlan: {
          name: newPlan.name,
          amount: newPlan.amount,
          proratedCharge,
        },
        immediateCharge: Math.max(0, proratedCharge - proratedRefund),
        nextBillingAmount: newPlan.amount,
        effectiveDate: now,
      };
    } catch (error) {
      console.error('Preview plan change error:', error);
      throw new Error(`Failed to preview plan change: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Change subscription plan with prorations
   */
  async changePlan(data: z.infer<typeof ChangePlanSchema>): Promise<SubscriptionWithDetails> {
    try {
      const validatedData = ChangePlanSchema.parse(data);

      const subscription = await this.getSubscriptionWithDetails(validatedData.subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const { data: newPlan } = await this.supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', validatedData.newPlanId)
        .single();

      if (!newPlan) {
        throw new Error('New plan not found');
      }

      // Update subscription in Stripe
      const stripeSubscription = await this.stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
      const subscriptionItem = stripeSubscription.items.data[0];

      const updatedSubscription = await this.stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          items: [{
            id: subscriptionItem.id,
            price: newPlan.stripe_price_id,
          }],
          proration_behavior: validatedData.prorationBehavior,
          billing_cycle_anchor: validatedData.billingCycleAnchor === 'now' ? 'now' : undefined,
        }
      );

      // Update database
      const { data: dbSubscription, error } = await this.supabase
        .from('subscriptions')
        .update({
          plan_id: validatedData.newPlanId,
          status: updatedSubscription.status,
          quantity: updatedSubscription.items.data[0]?.quantity || 1,
          current_period_start: new Date(updatedSubscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
          latest_invoice: updatedSubscription.latest_invoice?.toString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', validatedData.subscriptionId)
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return this.mapToSubscriptionWithDetails(dbSubscription, subscription.customer, newPlan);
    } catch (error) {
      console.error('Change plan error:', error);
      throw new Error(`Failed to change plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // TRIAL MANAGEMENT
  // =============================================

  /**
   * Convert trial subscription to paid
   */
  async convertTrialToPaid(
    subscriptionId: string,
    options: TrialConversionOptions
  ): Promise<SubscriptionWithDetails> {
    try {
      const subscription = await this.getSubscriptionWithDetails(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      if (subscription.status !== 'trialing') {
        throw new Error('Subscription is not in trial period');
      }

      // Get new plan if different from current
      let targetPlan = subscription.plan;
      if (options.planId !== subscription.planId) {
        const { data: newPlan } = await this.supabase
          .from('subscription_plans')
          .select('*')
          .eq('id', options.planId)
          .single();

        if (!newPlan) {
          throw new Error('Target plan not found');
        }
        targetPlan = newPlan;
      }

      // Update subscription in Stripe - end trial immediately
      const updateParams: Stripe.SubscriptionUpdateParams = {
        trial_end: 'now',
      };

      // Change plan if different
      if (options.planId !== subscription.planId) {
        const stripeSubscription = await this.stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
        const subscriptionItem = stripeSubscription.items.data[0];
        
        updateParams.items = [{
          id: subscriptionItem.id,
          price: targetPlan.stripe_price_id,
        }];
      }

      // Set payment method if provided
      if (options.paymentMethodId) {
        updateParams.default_payment_method = options.paymentMethodId;
      }

      // Add coupon if provided
      if (options.couponId) {
        updateParams.coupon = options.couponId;
      }

      // Add promotion code if provided
      if (options.promotionCode) {
        updateParams.promotion_code = options.promotionCode;
      }

      const updatedSubscription = await this.stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        updateParams
      );

      // Update database
      const { data: dbSubscription, error } = await this.supabase
        .from('subscriptions')
        .update({
          plan_id: options.planId,
          status: updatedSubscription.status,
          trial_end: null, // Trial ended
          current_period_start: new Date(updatedSubscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
          default_payment_method: updatedSubscription.default_payment_method?.toString(),
          latest_invoice: updatedSubscription.latest_invoice?.toString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscriptionId)
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return this.mapToSubscriptionWithDetails(dbSubscription, subscription.customer, targetPlan);
    } catch (error) {
      console.error('Convert trial error:', error);
      throw new Error(`Failed to convert trial: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extend trial period
   */
  async extendTrial(subscriptionId: string, additionalDays: number): Promise<SubscriptionWithDetails> {
    try {
      const subscription = await this.getSubscriptionWithDetails(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      if (subscription.status !== 'trialing' || !subscription.trialEnd) {
        throw new Error('Subscription is not in trial period');
      }

      const newTrialEnd = new Date(subscription.trialEnd.getTime() + additionalDays * 24 * 60 * 60 * 1000);

      // Update trial end in Stripe
      const updatedSubscription = await this.stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          trial_end: Math.floor(newTrialEnd.getTime() / 1000),
        }
      );

      // Update database
      const { data: dbSubscription, error } = await this.supabase
        .from('subscriptions')
        .update({
          trial_end: newTrialEnd.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscriptionId)
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return this.mapToSubscriptionWithDetails(dbSubscription, subscription.customer, subscription.plan);
    } catch (error) {
      console.error('Extend trial error:', error);
      throw new Error(`Failed to extend trial: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // SUBSCRIPTION CANCELLATION
  // =============================================

  /**
   * Cancel subscription at period end
   */
  async cancelAtPeriodEnd(subscriptionId: string): Promise<SubscriptionWithDetails> {
    try {
      const subscription = await this.getSubscriptionWithDetails(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Update subscription in Stripe
      const updatedSubscription = await this.stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          cancel_at_period_end: true,
        }
      );

      // Update database
      const { data: dbSubscription, error } = await this.supabase
        .from('subscriptions')
        .update({
          cancel_at_period_end: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscriptionId)
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return this.mapToSubscriptionWithDetails(dbSubscription, subscription.customer, subscription.plan);
    } catch (error) {
      console.error('Cancel subscription error:', error);
      throw new Error(`Failed to cancel subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cancel subscription immediately
   */
  async cancelImmediately(subscriptionId: string, prorateCreditIfApplicable: boolean = true): Promise<SubscriptionWithDetails> {
    try {
      const subscription = await this.getSubscriptionWithDetails(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Cancel subscription in Stripe
      const canceledSubscription = await this.stripe.subscriptions.cancel(
        subscription.stripeSubscriptionId,
        {
          prorate: prorateCreditIfApplicable,
        }
      );

      // Update database
      const { data: dbSubscription, error } = await this.supabase
        .from('subscriptions')
        .update({
          status: canceledSubscription.status,
          canceled_at: new Date(canceledSubscription.canceled_at! * 1000).toISOString(),
          ended_at: canceledSubscription.ended_at ? new Date(canceledSubscription.ended_at * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscriptionId)
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return this.mapToSubscriptionWithDetails(dbSubscription, subscription.customer, subscription.plan);
    } catch (error) {
      console.error('Cancel immediately error:', error);
      throw new Error(`Failed to cancel subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Reactivate canceled subscription
   */
  async reactivateSubscription(subscriptionId: string): Promise<SubscriptionWithDetails> {
    try {
      const subscription = await this.getSubscriptionWithDetails(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      if (!subscription.cancelAtPeriodEnd) {
        throw new Error('Subscription is not scheduled for cancellation');
      }

      // Reactivate subscription in Stripe
      const reactivatedSubscription = await this.stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          cancel_at_period_end: false,
        }
      );

      // Update database
      const { data: dbSubscription, error } = await this.supabase
        .from('subscriptions')
        .update({
          cancel_at_period_end: false,
          status: reactivatedSubscription.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscriptionId)
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return this.mapToSubscriptionWithDetails(dbSubscription, subscription.customer, subscription.plan);
    } catch (error) {
      console.error('Reactivate subscription error:', error);
      throw new Error(`Failed to reactivate subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // USAGE-BASED BILLING
  // =============================================

  /**
   * Report usage for metered billing
   */
  async reportUsage(data: z.infer<typeof UpdateUsageSchema>): Promise<void> {
    try {
      const validatedData = UpdateUsageSchema.parse(data);

      // Get subscription details
      const subscription = await this.getSubscriptionWithDetails(validatedData.subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Report usage to Stripe
      await this.stripe.subscriptionItems.createUsageRecord(
        validatedData.subscriptionItemId,
        {
          quantity: validatedData.quantity,
          timestamp: validatedData.timestamp || Math.floor(Date.now() / 1000),
          action: validatedData.action,
        }
      );

      console.log(`Usage reported for subscription ${validatedData.subscriptionId}: ${validatedData.quantity} units`);
    } catch (error) {
      console.error('Report usage error:', error);
      throw new Error(`Failed to report usage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get usage summary for subscription
   */
  async getUsageSummary(subscriptionId: string, subscriptionItemId: string): Promise<any> {
    try {
      const summary = await this.stripe.subscriptionItems.listUsageRecordSummaries(
        subscriptionItemId,
        { limit: 100 }
      );

      return {
        subscriptionId,
        subscriptionItemId,
        totalUsage: summary.data.reduce((total, record) => total + record.total_usage, 0),
        period: {
          start: summary.data[0]?.period?.start,
          end: summary.data[0]?.period?.end,
        },
        records: summary.data,
      };
    } catch (error) {
      console.error('Get usage summary error:', error);
      throw new Error(`Failed to get usage summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  /**
   * Map database subscription to detailed interface
   */
  private mapToSubscriptionWithDetails(
    dbSub: any,
    customer: any,
    plan: any
  ): SubscriptionWithDetails {
    return {
      id: dbSub.id,
      stripeSubscriptionId: dbSub.stripe_subscription_id,
      customerId: dbSub.customer_id,
      planId: dbSub.plan_id,
      status: dbSub.status,
      currentPeriodStart: new Date(dbSub.current_period_start),
      currentPeriodEnd: new Date(dbSub.current_period_end),
      trialEnd: dbSub.trial_end ? new Date(dbSub.trial_end) : undefined,
      cancelAtPeriodEnd: dbSub.cancel_at_period_end,
      metadata: dbSub.metadata,
      customer: {
        id: customer.id,
        userId: customer.user_id,
        businessId: customer.business_id,
        stripeCustomerId: customer.stripe_customer_id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        billingAddress: customer.billing_address,
        shippingAddress: customer.shipping_address,
        metadata: customer.metadata,
      },
      plan: {
        id: plan.id,
        name: plan.name,
        amount: plan.amount,
        currency: plan.currency,
        interval: plan.interval,
        features: plan.features || [],
      },
    };
  }

  /**
   * Get subscription by Stripe ID
   */
  async getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<SubscriptionWithDetails | null> {
    try {
      const { data } = await this.supabase
        .from('subscriptions')
        .select(`
          *,
          customer:stripe_customers(*),
          plan:subscription_plans(*)
        `)
        .eq('stripe_subscription_id', stripeSubscriptionId)
        .single();

      if (!data) return null;

      return this.mapToSubscriptionWithDetails(data, data.customer, data.plan);
    } catch (error) {
      console.error('Get subscription by Stripe ID error:', error);
      return null;
    }
  }

  /**
   * List all active subscriptions with pagination
   */
  async listActiveSubscriptions(
    page: number = 1,
    limit: number = 50
  ): Promise<{
    subscriptions: SubscriptionWithDetails[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const offset = (page - 1) * limit;

      // Get total count
      const { count } = await this.supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .in('status', ['active', 'trialing', 'past_due']);

      // Get subscriptions with details
      const { data } = await this.supabase
        .from('subscriptions')
        .select(`
          *,
          customer:stripe_customers(*),
          plan:subscription_plans(*)
        `)
        .in('status', ['active', 'trialing', 'past_due'])
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const subscriptions = data?.map(sub => 
        this.mapToSubscriptionWithDetails(sub, sub.customer, sub.plan)
      ) || [];

      return {
        subscriptions,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      };
    } catch (error) {
      console.error('List active subscriptions error:', error);
      return {
        subscriptions: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      };
    }
  }
}

// =============================================
// SINGLETON INSTANCE
// =============================================

const subscriptionManager = new SubscriptionManager();

export default subscriptionManager;
export { SubscriptionManager };