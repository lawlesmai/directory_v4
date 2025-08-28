/**
 * EPIC 5 STORY 5.2: Subscription Management & Billing System
 * Billing Service - Automated billing and invoice management
 * 
 * This service provides comprehensive billing automation including:
 * - Recurring billing automation
 * - Invoice generation and delivery
 * - Payment retry logic with smart intervals
 * - Grace period management
 * - Tax compliance and calculation
 * - PDF invoice generation
 */

import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import stripeService from './stripe-service';
import { z } from 'zod';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface InvoiceDetails {
  id: string;
  stripeInvoiceId: string;
  customerId: string;
  subscriptionId?: string;
  status: string;
  amountDue: number;
  amountPaid: number;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  dueDate?: Date;
  paidAt?: Date;
  invoicePdf?: string;
  hostedInvoiceUrl?: string;
  receiptNumber?: string;
  customer: {
    email: string;
    name?: string;
    billingAddress?: any;
  };
  lineItems: InvoiceLineItem[];
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  amount: number;
  quantity: number;
  period?: {
    start: Date;
    end: Date;
  };
}

export interface PaymentRetryConfig {
  maxRetries: number;
  retryIntervals: number[]; // in hours
  gracePeriodDays: number;
  suspensionDays: number;
}

export interface BillingCycleResult {
  processedSubscriptions: number;
  successfulBillings: number;
  failedBillings: number;
  retryScheduled: number;
  errors: string[];
}

export interface RefundOptions {
  amount?: number; // partial refund amount in cents
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  refundApplicationFee?: boolean;
  reverseTransfer?: boolean;
  metadata?: Record<string, string>;
}

// =============================================
// VALIDATION SCHEMAS
// =============================================

const CreateInvoiceSchema = z.object({
  customerId: z.string().uuid(),
  subscriptionId: z.string().uuid().optional(),
  description: z.string().optional(),
  currency: z.string().length(3).default('USD'),
  dueDate: z.date().optional(),
  autoAdvance: z.boolean().default(true),
  collectionMethod: z.enum(['charge_automatically', 'send_invoice']).default('charge_automatically'),
  metadata: z.record(z.string()).optional(),
});

const AddInvoiceItemSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  description: z.string(),
  quantity: z.number().positive().default(1),
  invoiceId: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

const ProcessRefundSchema = z.object({
  paymentTransactionId: z.string().uuid(),
  amount: z.number().positive().optional(),
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).default('requested_by_customer'),
  metadata: z.record(z.string()).optional(),
});

// =============================================
// BILLING SERVICE CLASS
// =============================================

class BillingService {
  private supabase;
  private stripe: Stripe;
  
  // Default retry configuration
  private readonly defaultRetryConfig: PaymentRetryConfig = {
    maxRetries: 3,
    retryIntervals: [24, 72, 168], // 1 day, 3 days, 7 days
    gracePeriodDays: 3,
    suspensionDays: 10,
  };

  constructor() {
    this.supabase = createClient();
    this.stripe = stripeService.getStripeInstance();
  }

  // =============================================
  // INVOICE GENERATION & MANAGEMENT
  // =============================================

  /**
   * Create and finalize invoice
   */
  async createInvoice(data: z.infer<typeof CreateInvoiceSchema>): Promise<InvoiceDetails> {
    try {
      const validatedData = CreateInvoiceSchema.parse(data);

      // Get customer details
      const customer = await stripeService.getCustomer(validatedData.customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Create invoice in Stripe
      const stripeInvoice = await this.stripe.invoices.create({
        customer: customer.stripeCustomerId,
        subscription: validatedData.subscriptionId ? await this.getStripeSubscriptionId(validatedData.subscriptionId) : undefined,
        description: validatedData.description,
        currency: validatedData.currency,
        due_date: validatedData.dueDate ? Math.floor(validatedData.dueDate.getTime() / 1000) : undefined,
        auto_advance: validatedData.autoAdvance,
        collection_method: validatedData.collectionMethod,
        metadata: validatedData.metadata,
      });

      // Finalize the invoice to make it payable
      const finalizedInvoice = await this.stripe.invoices.finalizeInvoice(stripeInvoice.id);

      // Store in database
      const { data: dbInvoice, error } = await this.supabase
        .from('invoices')
        .insert({
          stripe_invoice_id: finalizedInvoice.id,
          customer_id: validatedData.customerId,
          subscription_id: validatedData.subscriptionId,
          status: finalizedInvoice.status,
          amount_due: finalizedInvoice.amount_due,
          amount_paid: finalizedInvoice.amount_paid,
          amount_remaining: finalizedInvoice.amount_remaining,
          subtotal: finalizedInvoice.subtotal,
          tax: finalizedInvoice.tax || 0,
          total: finalizedInvoice.total,
          currency: finalizedInvoice.currency,
          due_date: finalizedInvoice.due_date ? new Date(finalizedInvoice.due_date * 1000).toISOString() : null,
          auto_advance: finalizedInvoice.auto_advance,
          billing_reason: finalizedInvoice.billing_reason,
          collection_method: finalizedInvoice.collection_method,
          invoice_pdf: finalizedInvoice.invoice_pdf,
          hosted_invoice_url: finalizedInvoice.hosted_invoice_url,
          finalized_at: finalizedInvoice.created ? new Date(finalizedInvoice.created * 1000).toISOString() : null,
          metadata: validatedData.metadata,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return this.mapToInvoiceDetails(dbInvoice, customer, finalizedInvoice.lines.data);
    } catch (error) {
      console.error('Create invoice error:', error);
      throw new Error(`Failed to create invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add line item to invoice
   */
  async addInvoiceItem(data: z.infer<typeof AddInvoiceItemSchema>): Promise<void> {
    try {
      const validatedData = AddInvoiceItemSchema.parse(data);

      const customer = await stripeService.getCustomer(validatedData.customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      await this.stripe.invoiceItems.create({
        customer: customer.stripeCustomerId,
        amount: validatedData.amount,
        currency: validatedData.currency,
        description: validatedData.description,
        quantity: validatedData.quantity,
        invoice: validatedData.invoiceId,
        metadata: validatedData.metadata,
      });
    } catch (error) {
      console.error('Add invoice item error:', error);
      throw new Error(`Failed to add invoice item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get invoice with full details
   */
  async getInvoiceDetails(invoiceId: string): Promise<InvoiceDetails | null> {
    try {
      const { data } = await this.supabase
        .from('invoices')
        .select(`
          *,
          customer:stripe_customers(*)
        `)
        .eq('id', invoiceId)
        .single();

      if (!data) return null;

      // Get line items from Stripe
      const stripeInvoice = await this.stripe.invoices.retrieve(data.stripe_invoice_id, {
        expand: ['lines'],
      });

      return this.mapToInvoiceDetails(data, data.customer, stripeInvoice.lines.data);
    } catch (error) {
      console.error('Get invoice details error:', error);
      return null;
    }
  }

  /**
   * Get customer invoices with pagination
   */
  async getCustomerInvoices(
    customerId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    invoices: InvoiceDetails[];
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
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', customerId);

      // Get invoices with details
      const { data } = await this.supabase
        .from('invoices')
        .select(`
          *,
          customer:stripe_customers(*)
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const invoices: InvoiceDetails[] = [];

      if (data) {
        for (const invoice of data) {
          try {
            const stripeInvoice = await this.stripe.invoices.retrieve(invoice.stripe_invoice_id, {
              expand: ['lines'],
            });
            invoices.push(this.mapToInvoiceDetails(invoice, invoice.customer, stripeInvoice.lines.data));
          } catch (error) {
            console.error(`Error retrieving Stripe invoice ${invoice.stripe_invoice_id}:`, error);
          }
        }
      }

      return {
        invoices,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      };
    } catch (error) {
      console.error('Get customer invoices error:', error);
      return {
        invoices: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      };
    }
  }

  // =============================================
  // PAYMENT RETRY LOGIC
  // =============================================

  /**
   * Process failed payments with retry logic
   */
  async processFailedPayments(config: Partial<PaymentRetryConfig> = {}): Promise<BillingCycleResult> {
    const retryConfig = { ...this.defaultRetryConfig, ...config };
    const result: BillingCycleResult = {
      processedSubscriptions: 0,
      successfulBillings: 0,
      failedBillings: 0,
      retryScheduled: 0,
      errors: [],
    };

    try {
      // Get failed invoices that need retry
      const { data: failedInvoices } = await this.supabase
        .from('invoices')
        .select(`
          *,
          customer:stripe_customers(*),
          subscription:subscriptions(*)
        `)
        .eq('status', 'open')
        .lt('attempt_count', retryConfig.maxRetries)
        .lt('next_payment_attempt', new Date().toISOString());

      if (!failedInvoices) return result;

      result.processedSubscriptions = failedInvoices.length;

      for (const invoice of failedInvoices) {
        try {
          // Attempt to pay the invoice
          const paymentResult = await this.retryInvoicePayment(invoice.stripe_invoice_id);

          if (paymentResult.success) {
            result.successfulBillings++;
            
            // Update invoice status
            await this.supabase
              .from('invoices')
              .update({
                status: 'paid',
                amount_paid: paymentResult.amountPaid,
                amount_remaining: 0,
                paid_at: new Date().toISOString(),
                attempt_count: invoice.attempt_count + 1,
              })
              .eq('id', invoice.id);

            // Remove grace period if subscription was suspended
            if (invoice.subscription) {
              await this.removeGracePeriod(invoice.subscription.id);
            }
          } else {
            result.failedBillings++;
            
            const nextAttempt = invoice.attempt_count + 1;
            
            if (nextAttempt < retryConfig.maxRetries) {
              // Schedule next retry
              const nextRetryHours = retryConfig.retryIntervals[Math.min(nextAttempt - 1, retryConfig.retryIntervals.length - 1)];
              const nextRetryTime = new Date(Date.now() + nextRetryHours * 60 * 60 * 1000);
              
              await this.supabase
                .from('invoices')
                .update({
                  attempt_count: nextAttempt,
                  next_payment_attempt: nextRetryTime.toISOString(),
                })
                .eq('id', invoice.id);
              
              result.retryScheduled++;
            } else {
              // Max retries reached - apply grace period or suspend
              if (invoice.subscription) {
                await this.applyGracePeriodOrSuspend(invoice.subscription.id, retryConfig);
              }
            }
          }
        } catch (error) {
          result.errors.push(`Failed to process invoice ${invoice.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } catch (error) {
      result.errors.push(`Failed to process failed payments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Retry payment for specific invoice
   */
  async retryInvoicePayment(stripeInvoiceId: string): Promise<{ success: boolean; amountPaid: number; error?: string }> {
    try {
      const invoice = await this.stripe.invoices.pay(stripeInvoiceId);
      
      return {
        success: invoice.status === 'paid',
        amountPaid: invoice.amount_paid,
      };
    } catch (error: any) {
      return {
        success: false,
        amountPaid: 0,
        error: error.message,
      };
    }
  }

  // =============================================
  // GRACE PERIOD & SUSPENSION MANAGEMENT
  // =============================================

  /**
   * Apply grace period or suspend subscription
   */
  async applyGracePeriodOrSuspend(subscriptionId: string, config: PaymentRetryConfig): Promise<void> {
    try {
      const { data: subscription } = await this.supabase
        .from('subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single();

      if (!subscription) return;

      const now = new Date();
      const gracePeriodEnd = new Date(now.getTime() + config.gracePeriodDays * 24 * 60 * 60 * 1000);
      const suspensionDate = new Date(now.getTime() + config.suspensionDays * 24 * 60 * 60 * 1000);

      // Update subscription with grace period
      await this.supabase
        .from('subscriptions')
        .update({
          status: 'past_due',
          metadata: {
            ...subscription.metadata,
            grace_period_end: gracePeriodEnd.toISOString(),
            scheduled_suspension: suspensionDate.toISOString(),
            payment_failed: true,
          },
        })
        .eq('id', subscriptionId);

      console.log(`Applied grace period to subscription ${subscriptionId} until ${gracePeriodEnd.toISOString()}`);
    } catch (error) {
      console.error('Apply grace period error:', error);
    }
  }

  /**
   * Remove grace period from subscription
   */
  async removeGracePeriod(subscriptionId: string): Promise<void> {
    try {
      const { data: subscription } = await this.supabase
        .from('subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single();

      if (!subscription) return;

      const metadata = { ...subscription.metadata };
      delete metadata.grace_period_end;
      delete metadata.scheduled_suspension;
      delete metadata.payment_failed;

      await this.supabase
        .from('subscriptions')
        .update({
          status: 'active',
          metadata,
        })
        .eq('id', subscriptionId);

      console.log(`Removed grace period from subscription ${subscriptionId}`);
    } catch (error) {
      console.error('Remove grace period error:', error);
    }
  }

  /**
   * Suspend subscriptions past grace period
   */
  async suspendOverdueSubscriptions(): Promise<number> {
    try {
      const now = new Date().toISOString();
      
      // Find subscriptions past grace period
      const { data: overdueSubscriptions } = await this.supabase
        .from('subscriptions')
        .select('*')
        .eq('status', 'past_due')
        .filter('metadata->grace_period_end', 'lt', now);

      if (!overdueSubscriptions) return 0;

      let suspendedCount = 0;

      for (const subscription of overdueSubscriptions) {
        try {
          // Cancel subscription in Stripe
          await this.stripe.subscriptions.update(subscription.stripe_subscription_id, {
            pause_collection: {
              behavior: 'void',
            },
          });

          // Update local database
          await this.supabase
            .from('subscriptions')
            .update({
              status: 'paused',
              metadata: {
                ...subscription.metadata,
                suspended_at: now,
                suspension_reason: 'payment_failed',
              },
            })
            .eq('id', subscription.id);

          suspendedCount++;
          console.log(`Suspended subscription ${subscription.id} due to payment failure`);
        } catch (error) {
          console.error(`Error suspending subscription ${subscription.id}:`, error);
        }
      }

      return suspendedCount;
    } catch (error) {
      console.error('Suspend overdue subscriptions error:', error);
      return 0;
    }
  }

  // =============================================
  // REFUND PROCESSING
  // =============================================

  /**
   * Process refund for payment transaction
   */
  async processRefund(
    data: z.infer<typeof ProcessRefundSchema>,
    options: RefundOptions = {}
  ): Promise<any> {
    try {
      const validatedData = ProcessRefundSchema.parse(data);

      // Get payment transaction
      const { data: transaction } = await this.supabase
        .from('payment_transactions')
        .select('*')
        .eq('id', validatedData.paymentTransactionId)
        .single();

      if (!transaction) {
        throw new Error('Payment transaction not found');
      }

      if (transaction.status !== 'succeeded') {
        throw new Error('Cannot refund unsuccessful payment');
      }

      // Create refund in Stripe
      const refundParams: Stripe.RefundCreateParams = {
        charge: transaction.stripe_charge_id,
        amount: options.amount || validatedData.amount,
        reason: validatedData.reason,
        refund_application_fee: options.refundApplicationFee,
        reverse_transfer: options.reverseTransfer,
        metadata: {
          ...validatedData.metadata,
          ...options.metadata,
        },
      };

      const stripeRefund = await this.stripe.refunds.create(refundParams);

      // Store refund record
      const { data: refund, error } = await this.supabase
        .from('payment_refunds')
        .insert({
          stripe_refund_id: stripeRefund.id,
          charge_id: transaction.stripe_charge_id,
          payment_transaction_id: validatedData.paymentTransactionId,
          amount: stripeRefund.amount,
          currency: stripeRefund.currency,
          reason: stripeRefund.reason,
          status: stripeRefund.status,
          receipt_number: stripeRefund.receipt_number,
          metadata: stripeRefund.metadata,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Update transaction refund amount
      await this.supabase
        .from('payment_transactions')
        .update({
          refunded: true,
          refund_amount: transaction.refund_amount + stripeRefund.amount,
        })
        .eq('id', validatedData.paymentTransactionId);

      return refund;
    } catch (error) {
      console.error('Process refund error:', error);
      throw new Error(`Failed to process refund: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // TAX COMPLIANCE
  // =============================================

  /**
   * Calculate tax for invoice
   */
  async calculateTax(customerId: string, amount: number, currency: string = 'USD'): Promise<number> {
    try {
      const customer = await stripeService.getCustomer(customerId);
      if (!customer?.billingAddress) {
        return 0; // No tax if no billing address
      }

      // Use Stripe Tax API for accurate tax calculation
      const taxRate = await this.stripe.taxRates.list({
        active: true,
        limit: 1,
      });

      // Simple tax calculation - in production, use proper tax service
      if (taxRate.data.length > 0 && customer.billingAddress.country === 'US') {
        const rate = taxRate.data[0].percentage / 100;
        return Math.round(amount * rate);
      }

      return 0;
    } catch (error) {
      console.error('Calculate tax error:', error);
      return 0;
    }
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  /**
   * Map database invoice to detailed interface
   */
  private mapToInvoiceDetails(dbInvoice: any, customer: any, lineItems: any[]): InvoiceDetails {
    return {
      id: dbInvoice.id,
      stripeInvoiceId: dbInvoice.stripe_invoice_id,
      customerId: dbInvoice.customer_id,
      subscriptionId: dbInvoice.subscription_id,
      status: dbInvoice.status,
      amountDue: dbInvoice.amount_due,
      amountPaid: dbInvoice.amount_paid,
      subtotal: dbInvoice.subtotal,
      tax: dbInvoice.tax,
      total: dbInvoice.total,
      currency: dbInvoice.currency,
      dueDate: dbInvoice.due_date ? new Date(dbInvoice.due_date) : undefined,
      paidAt: dbInvoice.paid_at ? new Date(dbInvoice.paid_at) : undefined,
      invoicePdf: dbInvoice.invoice_pdf,
      hostedInvoiceUrl: dbInvoice.hosted_invoice_url,
      receiptNumber: dbInvoice.receipt_number,
      customer: {
        email: customer.email,
        name: customer.name,
        billingAddress: customer.billing_address,
      },
      lineItems: lineItems.map(item => ({
        id: item.id,
        description: item.description || '',
        amount: item.amount,
        quantity: item.quantity || 1,
        period: item.period ? {
          start: new Date(item.period.start * 1000),
          end: new Date(item.period.end * 1000),
        } : undefined,
      })),
    };
  }

  /**
   * Get Stripe subscription ID from database subscription ID
   */
  private async getStripeSubscriptionId(subscriptionId: string): Promise<string | undefined> {
    try {
      const { data } = await this.supabase
        .from('subscriptions')
        .select('stripe_subscription_id')
        .eq('id', subscriptionId)
        .single();

      return data?.stripe_subscription_id;
    } catch {
      return undefined;
    }
  }

  /**
   * Send invoice by email
   */
  async sendInvoiceByEmail(invoiceId: string): Promise<void> {
    try {
      const { data: invoice } = await this.supabase
        .from('invoices')
        .select('stripe_invoice_id')
        .eq('id', invoiceId)
        .single();

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      await this.stripe.invoices.sendInvoice(invoice.stripe_invoice_id);
      
      console.log(`Invoice ${invoiceId} sent by email`);
    } catch (error) {
      console.error('Send invoice email error:', error);
      throw new Error(`Failed to send invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate invoice PDF
   */
  async generateInvoicePdf(invoiceId: string): Promise<string | null> {
    try {
      const { data: invoice } = await this.supabase
        .from('invoices')
        .select('stripe_invoice_id, invoice_pdf')
        .eq('id', invoiceId)
        .single();

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.invoice_pdf) {
        return invoice.invoice_pdf;
      }

      // Get PDF URL from Stripe
      const stripeInvoice = await this.stripe.invoices.retrieve(invoice.stripe_invoice_id);
      
      if (stripeInvoice.invoice_pdf) {
        // Update database with PDF URL
        await this.supabase
          .from('invoices')
          .update({ invoice_pdf: stripeInvoice.invoice_pdf })
          .eq('id', invoiceId);
        
        return stripeInvoice.invoice_pdf;
      }

      return null;
    } catch (error) {
      console.error('Generate invoice PDF error:', error);
      return null;
    }
  }
}

// =============================================
// SINGLETON INSTANCE
// =============================================

const billingService = new BillingService();

export default billingService;
export { BillingService };