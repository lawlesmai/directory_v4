/**
 * EPIC 5 STORY 5.1: Stripe Integration & Payment Infrastructure
 * Webhook Event Processor - Secure and comprehensive Stripe webhook handling
 * 
 * This processor handles all critical Stripe webhook events with proper
 * security validation, error handling, and database synchronization.
 */

import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import stripeService from './stripe-service';

// =============================================
// WEBHOOK EVENT TYPES
// =============================================

export type WebhookEventType =
  | 'customer.created'
  | 'customer.updated'
  | 'customer.deleted'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'customer.subscription.trial_will_end'
  | 'invoice.created'
  | 'invoice.finalized'
  | 'invoice.payment_succeeded'
  | 'invoice.payment_failed'
  | 'invoice.payment_action_required'
  | 'payment_intent.created'
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'payment_intent.canceled'
  | 'payment_method.attached'
  | 'payment_method.detached'
  | 'charge.succeeded'
  | 'charge.failed'
  | 'charge.dispute.created';

export interface WebhookProcessingResult {
  success: boolean;
  eventId: string;
  eventType: string;
  processed: boolean;
  error?: string;
  retryable?: boolean;
}

// =============================================
// WEBHOOK PROCESSOR CLASS
// =============================================

class WebhookProcessor {
  private supabase;
  private stripe: Stripe;

  constructor() {
    this.supabase = createClient();
    this.stripe = stripeService.getStripeInstance();
  }

  /**
   * Process incoming webhook event
   */
  async processWebhook(
    body: string,
    signature: string,
    endpointSecret: string
  ): Promise<WebhookProcessingResult> {
    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = this.stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return {
        success: false,
        eventId: 'unknown',
        eventType: 'unknown',
        processed: false,
        error: 'Invalid webhook signature',
        retryable: false,
      };
    }

    try {
      // Check if event already processed
      const existingEvent = await this.checkEventExists(event.id);
      if (existingEvent?.processed) {
        console.log(`Event ${event.id} already processed, skipping`);
        return {
          success: true,
          eventId: event.id,
          eventType: event.type,
          processed: true,
        };
      }

      // Store webhook event
      await this.storeWebhookEvent(event);

      // Process the event
      const result = await this.handleEvent(event);

      // Mark as processed if successful
      if (result.success) {
        await this.markEventProcessed(event.id);
      } else {
        await this.recordEventError(event.id, result.error || 'Unknown error');
      }

      return result;
    } catch (error) {
      console.error(`Error processing webhook ${event.id}:`, error);
      
      await this.recordEventError(
        event.id,
        error instanceof Error ? error.message : 'Unknown error'
      );

      return {
        success: false,
        eventId: event.id,
        eventType: event.type,
        processed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: this.isRetryableError(error),
      };
    }
  }

  /**
   * Handle specific webhook event types
   */
  private async handleEvent(event: Stripe.Event): Promise<WebhookProcessingResult> {
    console.log(`Processing webhook event: ${event.type} (${event.id})`);

    try {
      switch (event.type as WebhookEventType) {
        case 'customer.created':
          return await this.handleCustomerCreated(event);
        
        case 'customer.updated':
          return await this.handleCustomerUpdated(event);
        
        case 'customer.deleted':
          return await this.handleCustomerDeleted(event);
        
        case 'customer.subscription.created':
          return await this.handleSubscriptionCreated(event);
        
        case 'customer.subscription.updated':
          return await this.handleSubscriptionUpdated(event);
        
        case 'customer.subscription.deleted':
          return await this.handleSubscriptionDeleted(event);
        
        case 'customer.subscription.trial_will_end':
          return await this.handleTrialWillEnd(event);
        
        case 'invoice.created':
          return await this.handleInvoiceCreated(event);
        
        case 'invoice.finalized':
          return await this.handleInvoiceFinalized(event);
        
        case 'invoice.payment_succeeded':
          return await this.handleInvoicePaymentSucceeded(event);
        
        case 'invoice.payment_failed':
          return await this.handleInvoicePaymentFailed(event);
        
        case 'payment_intent.succeeded':
          return await this.handlePaymentIntentSucceeded(event);
        
        case 'payment_intent.payment_failed':
          return await this.handlePaymentIntentFailed(event);
        
        case 'payment_method.attached':
          return await this.handlePaymentMethodAttached(event);
        
        case 'charge.succeeded':
          return await this.handleChargeSucceeded(event);
        
        case 'charge.failed':
          return await this.handleChargeFailed(event);
        
        case 'charge.dispute.created':
          return await this.handleDisputeCreated(event);

        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
          return {
            success: true,
            eventId: event.id,
            eventType: event.type,
            processed: true,
          };
      }
    } catch (error) {
      console.error(`Error handling event ${event.type}:`, error);
      return {
        success: false,
        eventId: event.id,
        eventType: event.type,
        processed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: this.isRetryableError(error),
      };
    }
  }

  // =============================================
  // EVENT HANDLERS
  // =============================================

  private async handleCustomerCreated(event: Stripe.Event): Promise<WebhookProcessingResult> {
    const customer = event.data.object as Stripe.Customer;
    
    // Customer creation is typically handled in the application flow
    // This webhook serves as a backup/sync mechanism
    console.log(`Customer created: ${customer.id}`);
    
    return {
      success: true,
      eventId: event.id,
      eventType: event.type,
      processed: true,
    };
  }

  private async handleCustomerUpdated(event: Stripe.Event): Promise<WebhookProcessingResult> {
    const customer = event.data.object as Stripe.Customer;
    
    // Update customer information in our database
    const { error } = await this.supabase
      .from('stripe_customers')
      .update({
        email: customer.email!,
        name: customer.name,
        phone: customer.phone,
        billing_address: customer.address,
        default_payment_method: customer.invoice_settings?.default_payment_method?.toString(),
        delinquent: customer.delinquent,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_customer_id', customer.id);

    if (error) {
      throw new Error(`Failed to update customer: ${error.message}`);
    }

    return {
      success: true,
      eventId: event.id,
      eventType: event.type,
      processed: true,
    };
  }

  private async handleCustomerDeleted(event: Stripe.Event): Promise<WebhookProcessingResult> {
    const customer = event.data.object as Stripe.Customer;
    
    // Mark customer as deleted (soft delete)
    const { error } = await this.supabase
      .from('stripe_customers')
      .update({
        deleted: true,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_customer_id', customer.id);

    if (error) {
      throw new Error(`Failed to mark customer as deleted: ${error.message}`);
    }

    return {
      success: true,
      eventId: event.id,
      eventType: event.type,
      processed: true,
    };
  }

  private async handleSubscriptionCreated(event: Stripe.Event): Promise<WebhookProcessingResult> {
    const subscription = event.data.object as Stripe.Subscription;
    
    // Get customer info
    const { data: customer } = await this.supabase
      .from('stripe_customers')
      .select('id')
      .eq('stripe_customer_id', subscription.customer as string)
      .single();

    if (!customer) {
      throw new Error(`Customer not found for subscription: ${subscription.id}`);
    }

    // Get plan info
    const priceId = subscription.items.data[0]?.price.id;
    const { data: plan } = await this.supabase
      .from('subscription_plans')
      .select('id')
      .eq('stripe_price_id', priceId)
      .single();

    // Insert subscription
    const { error } = await this.supabase
      .from('subscriptions')
      .insert({
        stripe_subscription_id: subscription.id,
        customer_id: customer.id,
        plan_id: plan?.id,
        status: subscription.status,
        quantity: subscription.items.data[0]?.quantity || 1,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
        collection_method: subscription.collection_method,
        default_payment_method: subscription.default_payment_method?.toString(),
        metadata: subscription.metadata,
      });

    if (error) {
      throw new Error(`Failed to create subscription: ${error.message}`);
    }

    return {
      success: true,
      eventId: event.id,
      eventType: event.type,
      processed: true,
    };
  }

  private async handleSubscriptionUpdated(event: Stripe.Event): Promise<WebhookProcessingResult> {
    const subscription = event.data.object as Stripe.Subscription;
    
    const { error } = await this.supabase
      .from('subscriptions')
      .update({
        status: subscription.status,
        quantity: subscription.items.data[0]?.quantity || 1,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
        cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
        canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
        ended_at: subscription.ended_at ? new Date(subscription.ended_at * 1000).toISOString() : null,
        collection_method: subscription.collection_method,
        default_payment_method: subscription.default_payment_method?.toString(),
        latest_invoice: subscription.latest_invoice?.toString(),
        metadata: subscription.metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id);

    if (error) {
      throw new Error(`Failed to update subscription: ${error.message}`);
    }

    return {
      success: true,
      eventId: event.id,
      eventType: event.type,
      processed: true,
    };
  }

  private async handleSubscriptionDeleted(event: Stripe.Event): Promise<WebhookProcessingResult> {
    const subscription = event.data.object as Stripe.Subscription;
    
    const { error } = await this.supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id);

    if (error) {
      throw new Error(`Failed to delete subscription: ${error.message}`);
    }

    return {
      success: true,
      eventId: event.id,
      eventType: event.type,
      processed: true,
    };
  }

  private async handleTrialWillEnd(event: Stripe.Event): Promise<WebhookProcessingResult> {
    const subscription = event.data.object as Stripe.Subscription;
    
    // TODO: Implement trial ending notification logic
    // This could send emails, notifications, or trigger other business logic
    console.log(`Trial will end for subscription: ${subscription.id}`);
    
    return {
      success: true,
      eventId: event.id,
      eventType: event.type,
      processed: true,
    };
  }

  private async handleInvoiceCreated(event: Stripe.Event): Promise<WebhookProcessingResult> {
    const invoice = event.data.object as Stripe.Invoice;
    
    // Get customer info
    const { data: customer } = await this.supabase
      .from('stripe_customers')
      .select('id')
      .eq('stripe_customer_id', invoice.customer as string)
      .single();

    // Get subscription info if applicable
    let subscription = null;
    if (invoice.subscription) {
      const { data: sub } = await this.supabase
        .from('subscriptions')
        .select('id')
        .eq('stripe_subscription_id', invoice.subscription as string)
        .single();
      subscription = sub;
    }

    const { error } = await this.supabase
      .from('invoices')
      .insert({
        stripe_invoice_id: invoice.id,
        customer_id: customer?.id,
        subscription_id: subscription?.id,
        status: invoice.status!,
        amount_due: invoice.amount_due,
        amount_paid: invoice.amount_paid,
        amount_remaining: invoice.amount_remaining,
        subtotal: invoice.subtotal,
        tax: invoice.tax || 0,
        total: invoice.total,
        currency: invoice.currency,
        period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
        period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
        due_date: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
        billing_reason: invoice.billing_reason,
        collection_method: invoice.collection_method,
        hosted_invoice_url: invoice.hosted_invoice_url,
        invoice_pdf: invoice.invoice_pdf,
        metadata: invoice.metadata,
      });

    if (error) {
      throw new Error(`Failed to create invoice: ${error.message}`);
    }

    return {
      success: true,
      eventId: event.id,
      eventType: event.type,
      processed: true,
    };
  }

  private async handleInvoiceFinalized(event: Stripe.Event): Promise<WebhookProcessingResult> {
    const invoice = event.data.object as Stripe.Invoice;
    
    const { error } = await this.supabase
      .from('invoices')
      .update({
        status: invoice.status!,
        finalized_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_invoice_id', invoice.id);

    if (error) {
      throw new Error(`Failed to finalize invoice: ${error.message}`);
    }

    return {
      success: true,
      eventId: event.id,
      eventType: event.type,
      processed: true,
    };
  }

  private async handleInvoicePaymentSucceeded(event: Stripe.Event): Promise<WebhookProcessingResult> {
    const invoice = event.data.object as Stripe.Invoice;
    
    const { error } = await this.supabase
      .from('invoices')
      .update({
        status: invoice.status!,
        amount_paid: invoice.amount_paid,
        amount_remaining: invoice.amount_remaining,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_invoice_id', invoice.id);

    if (error) {
      throw new Error(`Failed to update invoice payment: ${error.message}`);
    }

    // TODO: Implement success business logic (send confirmation emails, etc.)
    
    return {
      success: true,
      eventId: event.id,
      eventType: event.type,
      processed: true,
    };
  }

  private async handleInvoicePaymentFailed(event: Stripe.Event): Promise<WebhookProcessingResult> {
    const invoice = event.data.object as Stripe.Invoice;
    
    const { error } = await this.supabase
      .from('invoices')
      .update({
        status: invoice.status!,
        attempt_count: invoice.attempt_count,
        next_payment_attempt: invoice.next_payment_attempt ? 
          new Date(invoice.next_payment_attempt * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_invoice_id', invoice.id);

    if (error) {
      throw new Error(`Failed to update failed invoice: ${error.message}`);
    }

    // TODO: Implement failure business logic (send dunning emails, etc.)
    
    return {
      success: true,
      eventId: event.id,
      eventType: event.type,
      processed: true,
    };
  }

  private async handlePaymentIntentSucceeded(event: Stripe.Event): Promise<WebhookProcessingResult> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    
    const { error } = await this.supabase
      .from('payment_transactions')
      .update({
        status: paymentIntent.status,
        amount_received: paymentIntent.amount_received,
        paid: true,
        receipt_url: paymentIntent.charges?.data[0]?.receipt_url,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_payment_intent_id', paymentIntent.id);

    if (error) {
      throw new Error(`Failed to update payment intent: ${error.message}`);
    }

    return {
      success: true,
      eventId: event.id,
      eventType: event.type,
      processed: true,
    };
  }

  private async handlePaymentIntentFailed(event: Stripe.Event): Promise<WebhookProcessingResult> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    
    const { error } = await this.supabase
      .from('payment_transactions')
      .update({
        status: paymentIntent.status,
        failure_code: paymentIntent.last_payment_error?.code,
        failure_message: paymentIntent.last_payment_error?.message,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_payment_intent_id', paymentIntent.id);

    if (error) {
      throw new Error(`Failed to update failed payment intent: ${error.message}`);
    }

    return {
      success: true,
      eventId: event.id,
      eventType: event.type,
      processed: true,
    };
  }

  private async handlePaymentMethodAttached(event: Stripe.Event): Promise<WebhookProcessingResult> {
    const paymentMethod = event.data.object as Stripe.PaymentMethod;
    
    if (paymentMethod.customer) {
      // Get customer info
      const { data: customer } = await this.supabase
        .from('stripe_customers')
        .select('id')
        .eq('stripe_customer_id', paymentMethod.customer as string)
        .single();

      if (customer) {
        const { error } = await this.supabase
          .from('payment_methods')
          .upsert({
            stripe_payment_method_id: paymentMethod.id,
            customer_id: customer.id,
            type: paymentMethod.type,
            card_brand: paymentMethod.card?.brand,
            card_last4: paymentMethod.card?.last4,
            card_exp_month: paymentMethod.card?.exp_month,
            card_exp_year: paymentMethod.card?.exp_year,
            card_country: paymentMethod.card?.country,
            billing_details: paymentMethod.billing_details,
            updated_at: new Date().toISOString(),
          });

        if (error) {
          throw new Error(`Failed to update payment method: ${error.message}`);
        }
      }
    }

    return {
      success: true,
      eventId: event.id,
      eventType: event.type,
      processed: true,
    };
  }

  private async handleChargeSucceeded(event: Stripe.Event): Promise<WebhookProcessingResult> {
    const charge = event.data.object as Stripe.Charge;
    
    // Update transaction with charge details
    const { error } = await this.supabase
      .from('payment_transactions')
      .update({
        stripe_charge_id: charge.id,
        amount_received: charge.amount,
        paid: charge.paid,
        refunded: charge.refunded,
        fee_amount: charge.balance_transaction ? 
          (charge.balance_transaction as any).fee : 0,
        net_amount: charge.balance_transaction ? 
          (charge.balance_transaction as any).net : charge.amount,
        receipt_url: charge.receipt_url,
        outcome: charge.outcome,
        risk_level: charge.outcome?.risk_level,
        risk_score: charge.outcome?.risk_score,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_payment_intent_id', charge.payment_intent as string);

    if (error) {
      console.error('Failed to update charge details:', error);
    }

    return {
      success: true,
      eventId: event.id,
      eventType: event.type,
      processed: true,
    };
  }

  private async handleChargeFailed(event: Stripe.Event): Promise<WebhookProcessingResult> {
    const charge = event.data.object as Stripe.Charge;
    
    const { error } = await this.supabase
      .from('payment_transactions')
      .update({
        stripe_charge_id: charge.id,
        paid: charge.paid,
        failure_code: charge.failure_code,
        failure_message: charge.failure_message,
        outcome: charge.outcome,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_payment_intent_id', charge.payment_intent as string);

    if (error) {
      console.error('Failed to update failed charge:', error);
    }

    return {
      success: true,
      eventId: event.id,
      eventType: event.type,
      processed: true,
    };
  }

  private async handleDisputeCreated(event: Stripe.Event): Promise<WebhookProcessingResult> {
    const dispute = event.data.object as Stripe.Dispute;
    
    // Get payment transaction
    const { data: transaction } = await this.supabase
      .from('payment_transactions')
      .select('id')
      .eq('stripe_charge_id', dispute.charge)
      .single();

    const { error } = await this.supabase
      .from('payment_disputes')
      .insert({
        stripe_dispute_id: dispute.id,
        charge_id: dispute.charge,
        payment_transaction_id: transaction?.id,
        amount: dispute.amount,
        currency: dispute.currency,
        reason: dispute.reason,
        status: dispute.status,
        evidence: dispute.evidence,
        evidence_details: dispute.evidence_details,
        is_charge_refundable: dispute.is_charge_refundable,
        metadata: dispute.metadata,
      });

    if (error) {
      throw new Error(`Failed to create dispute: ${error.message}`);
    }

    // Update transaction with dispute amount
    if (transaction) {
      await this.supabase
        .from('payment_transactions')
        .update({
          dispute_amount: dispute.amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transaction.id);
    }

    return {
      success: true,
      eventId: event.id,
      eventType: event.type,
      processed: true,
    };
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  private async checkEventExists(eventId: string): Promise<any> {
    const { data } = await this.supabase
      .from('webhook_events')
      .select('processed')
      .eq('stripe_event_id', eventId)
      .single();

    return data;
  }

  private async storeWebhookEvent(event: Stripe.Event): Promise<void> {
    await this.supabase
      .from('webhook_events')
      .upsert({
        stripe_event_id: event.id,
        type: event.type,
        api_version: event.api_version,
        data: event.data,
        object_id: (event.data.object as any).id,
        livemode: event.livemode,
        pending_webhooks: event.pending_webhooks,
        request_id: event.request?.id,
        processed: false,
      });
  }

  private async markEventProcessed(eventId: string): Promise<void> {
    await this.supabase
      .from('webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq('stripe_event_id', eventId);
  }

  private async recordEventError(eventId: string, error: string): Promise<void> {
    await this.supabase
      .from('webhook_events')
      .update({
        error_message: error,
        retry_count: this.supabase.sql`retry_count + 1`,
      })
      .eq('stripe_event_id', eventId);
  }

  private isRetryableError(error: any): boolean {
    // Determine if error is retryable (temporary issues vs permanent failures)
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('timeout') ||
             message.includes('network') ||
             message.includes('rate limit') ||
             message.includes('temporarily unavailable');
    }
    return false;
  }
}

// =============================================
// SINGLETON INSTANCE
// =============================================

const webhookProcessor = new WebhookProcessor();
export default webhookProcessor;