/**
 * EPIC 5 STORY 5.1: Stripe Integration & Payment Infrastructure
 * Core Stripe Service - Comprehensive payment processing and management
 * 
 * This service provides secure, PCI DSS compliant payment processing
 * with comprehensive error handling, logging, and monitoring.
 */

import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { cache } from 'react';
import { z } from 'zod';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface StripeCustomer {
  id: string;
  userId?: string;
  businessId?: string;
  stripeCustomerId: string;
  email: string;
  name?: string;
  phone?: string;
  billingAddress?: Record<string, any>;
  shippingAddress?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface StripeSubscription {
  id: string;
  stripeSubscriptionId: string;
  customerId: string;
  planId: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd: boolean;
  metadata?: Record<string, any>;
}

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
  clientSecret: string;
  customerId: string;
  metadata?: Record<string, any>;
}

// =============================================
// VALIDATION SCHEMAS
// =============================================

const CreateCustomerSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  phone: z.string().optional(),
  userId: z.string().uuid().optional(),
  businessId: z.string().uuid().optional(),
  billingAddress: z.record(z.any()).optional(),
  shippingAddress: z.record(z.any()).optional(),
  metadata: z.record(z.string()).optional(),
});

const CreatePaymentIntentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  customerId: z.string(),
  paymentMethodId: z.string().optional(),
  confirmationMethod: z.enum(['automatic', 'manual']).default('automatic'),
  captureMethod: z.enum(['automatic', 'manual']).default('automatic'),
  setupFutureUsage: z.enum(['off_session', 'on_session']).optional(),
  metadata: z.record(z.string()).optional(),
});

const CreateSubscriptionSchema = z.object({
  customerId: z.string(),
  priceId: z.string(),
  paymentMethodId: z.string().optional(),
  trialPeriodDays: z.number().optional(),
  couponId: z.string().optional(),
  promotionCodeId: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

// =============================================
// STRIPE SERVICE CLASS
// =============================================

class StripeService {
  private stripe: Stripe;
  private supabase;

  constructor() {
    // Initialize Stripe with proper configuration
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-06-20',
      typescript: true,
      telemetry: false, // Disable for security
    });

    this.supabase = createClient();
  }

  // =============================================
  // CUSTOMER MANAGEMENT
  // =============================================

  /**
   * Create or retrieve Stripe customer
   */
  async createCustomer(data: z.infer<typeof CreateCustomerSchema>): Promise<StripeCustomer> {
    try {
      const validatedData = CreateCustomerSchema.parse(data);

      // Check if customer already exists
      const existingCustomer = await this.findCustomerByEmail(validatedData.email);
      if (existingCustomer) {
        return existingCustomer;
      }

      // Create Stripe customer
      const stripeCustomer = await this.stripe.customers.create({
        email: validatedData.email,
        name: validatedData.name,
        phone: validatedData.phone,
        address: validatedData.billingAddress ? {
          line1: validatedData.billingAddress.line1,
          line2: validatedData.billingAddress.line2,
          city: validatedData.billingAddress.city,
          state: validatedData.billingAddress.state,
          postal_code: validatedData.billingAddress.postal_code,
          country: validatedData.billingAddress.country,
        } : undefined,
        shipping: validatedData.shippingAddress ? {
          name: validatedData.name || validatedData.email,
          address: {
            line1: validatedData.shippingAddress.line1,
            line2: validatedData.shippingAddress.line2,
            city: validatedData.shippingAddress.city,
            state: validatedData.shippingAddress.state,
            postal_code: validatedData.shippingAddress.postal_code,
            country: validatedData.shippingAddress.country,
          },
        } : undefined,
        metadata: validatedData.metadata,
      });

      // Store in database
      const { data: customer, error } = await this.supabase
        .from('stripe_customers')
        .insert({
          user_id: validatedData.userId,
          business_id: validatedData.businessId,
          stripe_customer_id: stripeCustomer.id,
          email: validatedData.email,
          name: validatedData.name,
          phone: validatedData.phone,
          billing_address: validatedData.billingAddress,
          shipping_address: validatedData.shippingAddress,
          metadata: validatedData.metadata,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return this.mapCustomerFromDB(customer);
    } catch (error) {
      console.error('Create customer error:', error);
      throw new Error(`Failed to create customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find customer by email
   */
  async findCustomerByEmail(email: string): Promise<StripeCustomer | null> {
    try {
      const { data: customer } = await this.supabase
        .from('stripe_customers')
        .select('*')
        .eq('email', email)
        .single();

      return customer ? this.mapCustomerFromDB(customer) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId: string): Promise<StripeCustomer | null> {
    try {
      const { data: customer } = await this.supabase
        .from('stripe_customers')
        .select('*')
        .eq('id', customerId)
        .single();

      return customer ? this.mapCustomerFromDB(customer) : null;
    } catch (error) {
      console.error('Get customer error:', error);
      return null;
    }
  }

  /**
   * Update customer information
   */
  async updateCustomer(customerId: string, updates: Partial<StripeCustomer>): Promise<StripeCustomer | null> {
    try {
      const customer = await this.getCustomer(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Update Stripe customer
      if (updates.email || updates.name || updates.phone) {
        await this.stripe.customers.update(customer.stripeCustomerId, {
          email: updates.email,
          name: updates.name,
          phone: updates.phone,
        });
      }

      // Update database
      const { data: updatedCustomer, error } = await this.supabase
        .from('stripe_customers')
        .update({
          email: updates.email,
          name: updates.name,
          phone: updates.phone,
          billing_address: updates.billingAddress,
          shipping_address: updates.shippingAddress,
          metadata: updates.metadata,
        })
        .eq('id', customerId)
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return this.mapCustomerFromDB(updatedCustomer);
    } catch (error) {
      console.error('Update customer error:', error);
      throw new Error(`Failed to update customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // PAYMENT INTENT MANAGEMENT
  // =============================================

  /**
   * Create payment intent
   */
  async createPaymentIntent(data: z.infer<typeof CreatePaymentIntentSchema>): Promise<PaymentIntent> {
    try {
      const validatedData = CreatePaymentIntentSchema.parse(data);

      const customer = await this.getCustomer(validatedData.customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: validatedData.amount,
        currency: validatedData.currency,
        customer: customer.stripeCustomerId,
        payment_method: validatedData.paymentMethodId,
        confirmation_method: validatedData.confirmationMethod,
        capture_method: validatedData.captureMethod,
        setup_future_usage: validatedData.setupFutureUsage,
        metadata: validatedData.metadata,
      });

      // Store transaction record
      await this.supabase
        .from('payment_transactions')
        .insert({
          stripe_payment_intent_id: paymentIntent.id,
          customer_id: validatedData.customerId,
          amount: validatedData.amount,
          currency: validatedData.currency,
          status: paymentIntent.status,
          payment_method_id: validatedData.paymentMethodId,
          confirmation_method: validatedData.confirmationMethod,
          capture_method: validatedData.captureMethod,
          setup_future_usage: validatedData.setupFutureUsage,
          metadata: validatedData.metadata,
        });

      return {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        clientSecret: paymentIntent.client_secret!,
        customerId: validatedData.customerId,
        metadata: paymentIntent.metadata,
      };
    } catch (error) {
      console.error('Create payment intent error:', error);
      throw new Error(`Failed to create payment intent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Confirm payment intent
   */
  async confirmPaymentIntent(paymentIntentId: string, paymentMethodId?: string): Promise<PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId,
      });

      // Update transaction record
      await this.supabase
        .from('payment_transactions')
        .update({
          status: paymentIntent.status,
          payment_method_id: paymentIntent.payment_method?.toString(),
          processed_at: new Date().toISOString(),
        })
        .eq('stripe_payment_intent_id', paymentIntentId);

      return {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        clientSecret: paymentIntent.client_secret!,
        customerId: '', // Will be populated from database
        metadata: paymentIntent.metadata,
      };
    } catch (error) {
      console.error('Confirm payment intent error:', error);
      throw new Error(`Failed to confirm payment intent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // SUBSCRIPTION MANAGEMENT
  // =============================================

  /**
   * Create subscription
   */
  async createSubscription(data: z.infer<typeof CreateSubscriptionSchema>): Promise<StripeSubscription> {
    try {
      const validatedData = CreateSubscriptionSchema.parse(data);

      const customer = await this.getCustomer(validatedData.customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      const subscription = await this.stripe.subscriptions.create({
        customer: customer.stripeCustomerId,
        items: [{ price: validatedData.priceId }],
        default_payment_method: validatedData.paymentMethodId,
        trial_period_days: validatedData.trialPeriodDays,
        coupon: validatedData.couponId,
        promotion_code: validatedData.promotionCodeId,
        metadata: validatedData.metadata,
        expand: ['latest_invoice.payment_intent'],
      });

      // Get plan information
      const { data: plan } = await this.supabase
        .from('subscription_plans')
        .select('id')
        .eq('stripe_price_id', validatedData.priceId)
        .single();

      // Store subscription record
      const { data: dbSubscription, error } = await this.supabase
        .from('subscriptions')
        .insert({
          stripe_subscription_id: subscription.id,
          customer_id: validatedData.customerId,
          plan_id: plan?.id,
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
          trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
          cancel_at_period_end: subscription.cancel_at_period_end,
          metadata: validatedData.metadata,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return this.mapSubscriptionFromDB(dbSubscription);
    } catch (error) {
      console.error('Create subscription error:', error);
      throw new Error(`Failed to create subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true): Promise<StripeSubscription> {
    try {
      const { data: dbSubscription } = await this.supabase
        .from('subscriptions')
        .select('stripe_subscription_id')
        .eq('id', subscriptionId)
        .single();

      if (!dbSubscription) {
        throw new Error('Subscription not found');
      }

      let stripeSubscription;
      if (cancelAtPeriodEnd) {
        stripeSubscription = await this.stripe.subscriptions.update(dbSubscription.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
      } else {
        stripeSubscription = await this.stripe.subscriptions.cancel(dbSubscription.stripe_subscription_id);
      }

      // Update database
      const { data: updatedSubscription, error } = await this.supabase
        .from('subscriptions')
        .update({
          status: stripeSubscription.status,
          cancel_at_period_end: stripeSubscription.cancel_at_period_end,
          canceled_at: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000).toISOString() : null,
          ended_at: stripeSubscription.ended_at ? new Date(stripeSubscription.ended_at * 1000).toISOString() : null,
        })
        .eq('id', subscriptionId)
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return this.mapSubscriptionFromDB(updatedSubscription);
    } catch (error) {
      console.error('Cancel subscription error:', error);
      throw new Error(`Failed to cancel subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // PAYMENT METHOD MANAGEMENT
  // =============================================

  /**
   * Attach payment method to customer
   */
  async attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    try {
      const customer = await this.getCustomer(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.stripeCustomerId,
      });

      // Get payment method details
      const paymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodId);

      // Store in database
      await this.supabase
        .from('payment_methods')
        .insert({
          stripe_payment_method_id: paymentMethodId,
          customer_id: customerId,
          type: paymentMethod.type,
          card_brand: paymentMethod.card?.brand,
          card_last4: paymentMethod.card?.last4,
          card_exp_month: paymentMethod.card?.exp_month,
          card_exp_year: paymentMethod.card?.exp_year,
          card_country: paymentMethod.card?.country,
          billing_details: paymentMethod.billing_details,
        });
    } catch (error) {
      console.error('Attach payment method error:', error);
      throw new Error(`Failed to attach payment method: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Set default payment method
   */
  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    try {
      const customer = await this.getCustomer(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Update Stripe customer
      await this.stripe.customers.update(customer.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Update database
      await this.supabase
        .from('stripe_customers')
        .update({
          default_payment_method: paymentMethodId,
        })
        .eq('id', customerId);

      // Update payment method as default
      await this.supabase
        .from('payment_methods')
        .update({ is_default: true })
        .eq('customer_id', customerId)
        .eq('stripe_payment_method_id', paymentMethodId);
    } catch (error) {
      console.error('Set default payment method error:', error);
      throw new Error(`Failed to set default payment method: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  /**
   * Map database customer to interface
   */
  private mapCustomerFromDB(customer: any): StripeCustomer {
    return {
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
    };
  }

  /**
   * Map database subscription to interface
   */
  private mapSubscriptionFromDB(subscription: any): StripeSubscription {
    return {
      id: subscription.id,
      stripeSubscriptionId: subscription.stripe_subscription_id,
      customerId: subscription.customer_id,
      planId: subscription.plan_id,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start),
      currentPeriodEnd: new Date(subscription.current_period_end),
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end) : undefined,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      metadata: subscription.metadata,
    };
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(body: string, signature: string, secret: string): boolean {
    try {
      this.stripe.webhooks.constructEvent(body, signature, secret);
      return true;
    } catch (error) {
      console.error('Webhook signature validation failed:', error);
      return false;
    }
  }

  /**
   * Get Stripe instance (for advanced usage)
   */
  getStripeInstance(): Stripe {
    return this.stripe;
  }
}

// =============================================
// SINGLETON INSTANCE
// =============================================

const stripeService = new StripeService();

// Cache commonly used methods
export const createCustomer = cache(stripeService.createCustomer.bind(stripeService));
export const getCustomer = cache(stripeService.getCustomer.bind(stripeService));
export const findCustomerByEmail = cache(stripeService.findCustomerByEmail.bind(stripeService));

export default stripeService;
export { StripeService };