/**
 * EPIC 5 STORY 5.7: Payment Failure Recovery & Dunning Management
 * Payment Failure Handler - Intelligent retry scheduling and failure classification
 * 
 * This service handles payment failures with smart retry logic, failure analysis,
 * and customer communication orchestration to minimize involuntary churn.
 */

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import stripeService from './stripe-service';
import type Stripe from 'stripe';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface PaymentFailure {
  id: string;
  customerId: string;
  subscriptionId?: string;
  invoiceId?: string;
  paymentIntentId?: string;
  failureReason: string;
  failureCode?: string;
  failureMessage?: string;
  amount: number;
  currency: string;
  paymentMethodId?: string;
  retryCount: number;
  maxRetryAttempts: number;
  nextRetryAt?: Date;
  lastRetryAt?: Date;
  status: 'pending' | 'retrying' | 'resolved' | 'abandoned';
  resolutionType?: string;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface RetrySchedule {
  nextRetryAt: Date;
  retryIntervalDays: number;
  recommendedAction: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface FailureAnalysis {
  classification: 'temporary' | 'permanent' | 'customer_action_required';
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendedRetryCount: number;
  customerCommunicationRequired: boolean;
  paymentMethodUpdateRequired: boolean;
  alternativePaymentMethodSuggested: boolean;
  estimatedResolutionTime: number; // hours
}

// =============================================
// VALIDATION SCHEMAS
// =============================================

const CreateFailureSchema = z.object({
  customerId: z.string().uuid(),
  subscriptionId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  paymentIntentId: z.string().optional(),
  failureReason: z.string(),
  failureCode: z.string().optional(),
  failureMessage: z.string().optional(),
  amount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  paymentMethodId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const RetryPaymentSchema = z.object({
  failureId: z.string().uuid(),
  paymentMethodId: z.string().optional(),
  skipRetryCount: z.boolean().default(false),
});

// =============================================
// PAYMENT FAILURE HANDLER CLASS
// =============================================

class PaymentFailureHandler {
  private supabase;
  private stripe;

  constructor() {
    this.supabase = createClient();
    this.stripe = stripeService.getStripeInstance();
  }

  // =============================================
  // FAILURE PROCESSING AND CLASSIFICATION
  // =============================================

  /**
   * Process and record a payment failure
   */
  async processFailure(data: z.infer<typeof CreateFailureSchema>): Promise<PaymentFailure> {
    try {
      const validatedData = CreateFailureSchema.parse(data);

      // Analyze the failure to determine retry strategy
      const analysis = this.analyzeFailure(
        validatedData.failureReason,
        validatedData.failureCode,
        validatedData.failureMessage
      );

      // Create or update existing failure record
      const existingFailure = await this.findExistingFailure(
        validatedData.customerId,
        validatedData.paymentIntentId
      );

      let failure: PaymentFailure;

      if (existingFailure) {
        // Update existing failure with new attempt
        failure = await this.updateFailureRecord(existingFailure.id, {
          failureReason: validatedData.failureReason,
          failureCode: validatedData.failureCode,
          failureMessage: validatedData.failureMessage,
          retryCount: existingFailure.retryCount + 1,
          lastRetryAt: new Date(),
          metadata: { ...existingFailure.metadata, ...validatedData.metadata },
        });
      } else {
        // Create new failure record
        failure = await this.createFailureRecord({
          ...validatedData,
          maxRetryAttempts: analysis.recommendedRetryCount,
          status: 'pending',
        });
      }

      // Update payment method health
      if (validatedData.paymentMethodId) {
        await this.updatePaymentMethodHealth(
          validatedData.customerId,
          validatedData.paymentMethodId,
          'failure',
          validatedData.failureReason
        );
      }

      // Initiate dunning campaign if customer communication is required
      if (analysis.customerCommunicationRequired) {
        await this.initiateDunningCampaign(failure, analysis);
      }

      // Update account state if necessary
      await this.updateAccountState(failure, analysis);

      return failure;
    } catch (error) {
      console.error('Process failure error:', error);
      throw new Error(`Failed to process payment failure: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze failure reason and determine appropriate response
   */
  private analyzeFailure(
    failureReason: string,
    failureCode?: string,
    failureMessage?: string
  ): FailureAnalysis {
    // Classify failure based on Stripe decline codes and reasons
    switch (failureCode) {
      // Temporary failures - high retry potential
      case 'insufficient_funds':
        return {
          classification: 'temporary',
          severity: 'medium',
          recommendedRetryCount: 3,
          customerCommunicationRequired: true,
          paymentMethodUpdateRequired: false,
          alternativePaymentMethodSuggested: true,
          estimatedResolutionTime: 72, // 3 days
        };

      case 'card_declined':
      case 'generic_decline':
        return {
          classification: 'temporary',
          severity: 'medium',
          recommendedRetryCount: 2,
          customerCommunicationRequired: true,
          paymentMethodUpdateRequired: true,
          alternativePaymentMethodSuggested: true,
          estimatedResolutionTime: 24,
        };

      // Customer action required
      case 'expired_card':
        return {
          classification: 'customer_action_required',
          severity: 'high',
          recommendedRetryCount: 1,
          customerCommunicationRequired: true,
          paymentMethodUpdateRequired: true,
          alternativePaymentMethodSuggested: false,
          estimatedResolutionTime: 12,
        };

      case 'authentication_required':
      case 'three_d_secure_required':
        return {
          classification: 'customer_action_required',
          severity: 'medium',
          recommendedRetryCount: 2,
          customerCommunicationRequired: true,
          paymentMethodUpdateRequired: false,
          alternativePaymentMethodSuggested: false,
          estimatedResolutionTime: 6,
        };

      // Permanent failures - low retry potential
      case 'card_not_supported':
      case 'currency_not_supported':
        return {
          classification: 'permanent',
          severity: 'high',
          recommendedRetryCount: 0,
          customerCommunicationRequired: true,
          paymentMethodUpdateRequired: true,
          alternativePaymentMethodSuggested: true,
          estimatedResolutionTime: 24,
        };

      case 'fraudulent':
      case 'stolen_card':
        return {
          classification: 'permanent',
          severity: 'critical',
          recommendedRetryCount: 0,
          customerCommunicationRequired: true,
          paymentMethodUpdateRequired: true,
          alternativePaymentMethodSuggested: true,
          estimatedResolutionTime: 48,
        };

      // Default classification for unknown codes
      default:
        return {
          classification: 'temporary',
          severity: 'medium',
          recommendedRetryCount: 2,
          customerCommunicationRequired: true,
          paymentMethodUpdateRequired: true,
          alternativePaymentMethodSuggested: true,
          estimatedResolutionTime: 48,
        };
    }
  }

  // =============================================
  // RETRY MANAGEMENT
  // =============================================

  /**
   * Retry failed payment with intelligent scheduling
   */
  async retryPayment(data: z.infer<typeof RetryPaymentSchema>): Promise<{
    success: boolean;
    paymentIntent?: Stripe.PaymentIntent;
    nextRetryAt?: Date;
    failure?: PaymentFailure;
  }> {
    try {
      const validatedData = RetryPaymentSchema.parse(data);

      // Get failure record
      const failure = await this.getFailureById(validatedData.failureId);
      if (!failure) {
        throw new Error('Payment failure not found');
      }

      // Check if retry is allowed
      if (failure.retryCount >= failure.maxRetryAttempts) {
        await this.abandonFailure(failure.id, 'max_retries_exceeded');
        return { success: false, failure };
      }

      // Get customer information
      const customer = await this.getCustomerById(failure.customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Determine payment method to use
      const paymentMethodId = validatedData.paymentMethodId || failure.paymentMethodId;
      if (!paymentMethodId) {
        throw new Error('No payment method available for retry');
      }

      // Create new payment intent for retry
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: failure.amount,
        currency: failure.currency,
        customer: customer.stripe_customer_id,
        payment_method: paymentMethodId,
        confirmation_method: 'automatic',
        confirm: true,
        metadata: {
          original_failure_id: failure.id,
          retry_attempt: (failure.retryCount + 1).toString(),
          ...(failure.metadata || {}),
        },
      });

      // Update failure record
      const updatedFailure = await this.updateFailureRecord(failure.id, {
        retryCount: failure.retryCount + 1,
        lastRetryAt: new Date(),
        status: paymentIntent.status === 'succeeded' ? 'resolved' : 'retrying',
        resolutionType: paymentIntent.status === 'succeeded' ? 'payment_succeeded' : undefined,
        resolvedAt: paymentIntent.status === 'succeeded' ? new Date() : undefined,
      });

      // Update payment method health
      await this.updatePaymentMethodHealth(
        failure.customerId,
        paymentMethodId,
        paymentIntent.status === 'succeeded' ? 'success' : 'failure',
        paymentIntent.status === 'succeeded' ? undefined : 'retry_failed'
      );

      // Schedule next retry if payment still failed
      let nextRetryAt: Date | undefined;
      if (paymentIntent.status !== 'succeeded' && updatedFailure.retryCount < updatedFailure.maxRetryAttempts) {
        const retrySchedule = this.calculateNextRetryTime(failure.failureReason, updatedFailure.retryCount);
        nextRetryAt = retrySchedule.nextRetryAt;
        
        await this.updateFailureRecord(failure.id, {
          nextRetryAt,
          status: 'pending',
        });
      }

      return {
        success: paymentIntent.status === 'succeeded',
        paymentIntent,
        nextRetryAt,
        failure: updatedFailure,
      };
    } catch (error) {
      console.error('Retry payment error:', error);
      throw new Error(`Failed to retry payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate next retry time with intelligent scheduling
   */
  private calculateNextRetryTime(failureReason: string, retryCount: number): RetrySchedule {
    // Base intervals in hours
    let retryIntervals: number[];
    let priority: 'low' | 'medium' | 'high' | 'critical';
    let recommendedAction: string;

    switch (failureReason) {
      case 'insufficient_funds':
        retryIntervals = [24, 72, 168]; // 1 day, 3 days, 7 days
        priority = 'medium';
        recommendedAction = 'Wait for customer to add funds';
        break;

      case 'card_declined':
        retryIntervals = [2, 24, 72]; // 2 hours, 1 day, 3 days
        priority = 'medium';
        recommendedAction = 'Contact customer to verify card';
        break;

      case 'expired_card':
        retryIntervals = [1, 6, 24]; // 1 hour, 6 hours, 1 day
        priority = 'high';
        recommendedAction = 'Request payment method update';
        break;

      case 'authentication_required':
        retryIntervals = [0.5, 2, 12]; // 30 minutes, 2 hours, 12 hours
        priority = 'high';
        recommendedAction = 'Guide customer through authentication';
        break;

      default:
        retryIntervals = [4, 24, 72]; // 4 hours, 1 day, 3 days
        priority = 'medium';
        recommendedAction = 'Standard retry sequence';
    }

    // Get interval for current retry count or last interval if exceeded
    const intervalIndex = Math.min(retryCount, retryIntervals.length - 1);
    const retryIntervalHours = retryIntervals[intervalIndex];

    // Add jitter to avoid thundering herd (±25%)
    const jitter = (Math.random() - 0.5) * 0.5;
    const finalIntervalHours = retryIntervalHours * (1 + jitter);

    const nextRetryAt = new Date();
    nextRetryAt.setHours(nextRetryAt.getHours() + finalIntervalHours);

    return {
      nextRetryAt,
      retryIntervalDays: finalIntervalHours / 24,
      recommendedAction,
      priority,
    };
  }

  /**
   * Process pending retries (called by background job)
   */
  async processPendingRetries(): Promise<{
    processed: number;
    successful: number;
    failed: number;
    abandoned: number;
  }> {
    try {
      // Get failures ready for retry
      const { data: failures } = await this.supabase
        .from('payment_failures')
        .select('*')
        .eq('status', 'pending')
        .lte('next_retry_at', new Date().toISOString())
        .order('created_at')
        .limit(50); // Process in batches

      if (!failures || failures.length === 0) {
        return { processed: 0, successful: 0, failed: 0, abandoned: 0 };
      }

      let successful = 0;
      let failed = 0;
      let abandoned = 0;

      for (const failure of failures) {
        try {
          const result = await this.retryPayment({ failureId: failure.id });
          
          if (result.success) {
            successful++;
          } else if (result.failure?.status === 'abandoned') {
            abandoned++;
          } else {
            failed++;
          }
        } catch (error) {
          console.error(`Failed to retry payment for failure ${failure.id}:`, error);
          failed++;
        }
      }

      return {
        processed: failures.length,
        successful,
        failed,
        abandoned,
      };
    } catch (error) {
      console.error('Process pending retries error:', error);
      throw new Error(`Failed to process pending retries: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // PAYMENT METHOD HEALTH MANAGEMENT
  // =============================================

  /**
   * Update payment method health score and recommendations
   */
  private async updatePaymentMethodHealth(
    customerId: string,
    paymentMethodId: string,
    result: 'success' | 'failure',
    failureReason?: string
  ): Promise<void> {
    try {
      // Get existing health record or create new one
      let { data: health } = await this.supabase
        .from('payment_method_health')
        .select('*')
        .eq('customer_id', customerId)
        .eq('payment_method_id', paymentMethodId)
        .single();

      if (!health) {
        // Create new health record
        const { data: newHealth } = await this.supabase
          .from('payment_method_health')
          .insert({
            customer_id: customerId,
            payment_method_id: paymentMethodId,
            success_count: result === 'success' ? 1 : 0,
            failure_count: result === 'failure' ? 1 : 0,
            last_successful_payment: result === 'success' ? new Date().toISOString() : null,
            last_failed_payment: result === 'failure' ? new Date().toISOString() : null,
            common_failure_reasons: failureReason ? [failureReason] : [],
          })
          .select()
          .single();

        health = newHealth;
      } else {
        // Update existing health record
        const updates: any = {
          success_count: health.success_count + (result === 'success' ? 1 : 0),
          failure_count: health.failure_count + (result === 'failure' ? 1 : 0),
        };

        if (result === 'success') {
          updates.last_successful_payment = new Date().toISOString();
        } else {
          updates.last_failed_payment = new Date().toISOString();
          
          // Update common failure reasons
          const reasons = Array.isArray(health.common_failure_reasons) ? health.common_failure_reasons : [];
          if (failureReason && !reasons.includes(failureReason)) {
            reasons.push(failureReason);
            updates.common_failure_reasons = reasons.slice(-5); // Keep last 5 failure reasons
          }
        }

        const { data: updatedHealth } = await this.supabase
          .from('payment_method_health')
          .update(updates)
          .eq('customer_id', customerId)
          .eq('payment_method_id', paymentMethodId)
          .select()
          .single();

        health = updatedHealth;
      }

      // Block payment method if health score is too low
      if (health && health.health_score < 0.2 && health.failure_count >= 3) {
        await this.supabase
          .from('payment_method_health')
          .update({
            blocked_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Block for 1 week
          })
          .eq('customer_id', customerId)
          .eq('payment_method_id', paymentMethodId);
      }
    } catch (error) {
      console.error('Update payment method health error:', error);
      // Don't throw here to avoid blocking main flow
    }
  }

  // =============================================
  // DATABASE OPERATIONS
  // =============================================

  /**
   * Create failure record in database
   */
  private async createFailureRecord(data: any): Promise<PaymentFailure> {
    const { data: failure, error } = await this.supabase
      .from('payment_failures')
      .insert({
        customer_id: data.customerId,
        subscription_id: data.subscriptionId,
        invoice_id: data.invoiceId,
        payment_intent_id: data.paymentIntentId,
        failure_reason: data.failureReason,
        failure_code: data.failureCode,
        failure_message: data.failureMessage,
        amount: data.amount,
        currency: data.currency,
        payment_method_id: data.paymentMethodId,
        max_retry_attempts: data.maxRetryAttempts,
        status: data.status,
        metadata: data.metadata,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return this.mapFailureFromDB(failure);
  }

  /**
   * Update failure record in database
   */
  private async updateFailureRecord(failureId: string, updates: any): Promise<PaymentFailure> {
    const { data: failure, error } = await this.supabase
      .from('payment_failures')
      .update(updates)
      .eq('id', failureId)
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return this.mapFailureFromDB(failure);
  }

  /**
   * Find existing failure for customer and payment intent
   */
  private async findExistingFailure(customerId: string, paymentIntentId?: string): Promise<PaymentFailure | null> {
    if (!paymentIntentId) return null;

    try {
      const { data: failure } = await this.supabase
        .from('payment_failures')
        .select('*')
        .eq('customer_id', customerId)
        .eq('payment_intent_id', paymentIntentId)
        .neq('status', 'resolved')
        .single();

      return failure ? this.mapFailureFromDB(failure) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get failure by ID
   */
  private async getFailureById(failureId: string): Promise<PaymentFailure | null> {
    try {
      const { data: failure } = await this.supabase
        .from('payment_failures')
        .select('*')
        .eq('id', failureId)
        .single();

      return failure ? this.mapFailureFromDB(failure) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get customer by ID
   */
  private async getCustomerById(customerId: string): Promise<any> {
    const { data: customer } = await this.supabase
      .from('stripe_customers')
      .select('*')
      .eq('id', customerId)
      .single();

    return customer;
  }

  /**
   * Abandon failure (stop retrying)
   */
  private async abandonFailure(failureId: string, reason: string): Promise<void> {
    await this.supabase
      .from('payment_failures')
      .update({
        status: 'abandoned',
        resolved_at: new Date().toISOString(),
        resolution_type: reason,
      })
      .eq('id', failureId);
  }

  /**
   * Map database failure to interface
   */
  private mapFailureFromDB(failure: any): PaymentFailure {
    return {
      id: failure.id,
      customerId: failure.customer_id,
      subscriptionId: failure.subscription_id,
      invoiceId: failure.invoice_id,
      paymentIntentId: failure.payment_intent_id,
      failureReason: failure.failure_reason,
      failureCode: failure.failure_code,
      failureMessage: failure.failure_message,
      amount: failure.amount,
      currency: failure.currency,
      paymentMethodId: failure.payment_method_id,
      retryCount: failure.retry_count,
      maxRetryAttempts: failure.max_retry_attempts,
      nextRetryAt: failure.next_retry_at ? new Date(failure.next_retry_at) : undefined,
      lastRetryAt: failure.last_retry_at ? new Date(failure.last_retry_at) : undefined,
      status: failure.status,
      resolutionType: failure.resolution_type,
      resolvedAt: failure.resolved_at ? new Date(failure.resolved_at) : undefined,
      metadata: failure.metadata,
      createdAt: new Date(failure.created_at),
      updatedAt: new Date(failure.updated_at),
    };
  }

  // =============================================
  // INTEGRATION HOOKS
  // =============================================

  /**
   * Initiate dunning campaign
   */
  private async initiateDunningCampaign(failure: PaymentFailure, analysis: FailureAnalysis): Promise<void> {
    try {
      const dunningManager = await import('./dunning-manager');
      
      // Determine campaign type based on customer and failure analysis
      let campaignType: 'standard' | 'high_value' | 'at_risk' = 'standard';
      
      // Get customer information to determine campaign type
      const customer = await this.getCustomerById(failure.customerId);
      if (customer) {
        // Check if customer is high value (subscription > $100/month)
        if (customer.subscriptions?.some((sub: any) => 
          sub.status === 'active' && sub.subscription_plans?.amount > 10000
        )) {
          campaignType = 'high_value';
        }
        
        // Check if customer is at risk (multiple recent failures)
        const { count: recentFailures } = await this.supabase
          .from('payment_failures')
          .select('*', { count: 'exact', head: true })
          .eq('customer_id', failure.customerId)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days
        
        if (recentFailures && recentFailures > 2) {
          campaignType = 'at_risk';
        }
      }

      // Determine communication channels based on analysis
      const channels = ['email'];
      if (analysis.severity === 'high' || analysis.severity === 'critical') {
        if (customer?.phone) {
          channels.push('sms');
        }
        channels.push('in_app');
      }

      // Create the dunning campaign
      await dunningManager.default.createCampaign({
        customerId: failure.customerId,
        paymentFailureId: failure.id,
        campaignType,
        communicationChannels: channels,
        personalizationData: {
          failure_reason: failure.failureReason,
          amount: failure.amount,
          currency: failure.currency,
          retry_count: failure.retryCount,
        },
        metadata: {
          analysis_classification: analysis.classification,
          analysis_severity: analysis.severity,
          estimated_resolution_time: analysis.estimatedResolutionTime,
        },
      });
    } catch (error) {
      console.error('Failed to initiate dunning campaign:', error);
      // Don't throw to avoid blocking main payment failure processing
    }
  }

  /**
   * Update account state based on payment failure
   */
  private async updateAccountState(failure: PaymentFailure, analysis: FailureAnalysis): Promise<void> {
    try {
      const accountStateManager = await import('./account-state-manager');
      
      // Process the payment failure to update account state
      await accountStateManager.default.processPaymentFailure(failure);
    } catch (error) {
      console.error('Failed to update account state:', error);
      // Don't throw to avoid blocking main payment failure processing
    }
  }
}

// =============================================
// SINGLETON INSTANCE
// =============================================

const paymentFailureHandler = new PaymentFailureHandler();

export default paymentFailureHandler;
export { PaymentFailureHandler };
export type { PaymentFailure, RetrySchedule, FailureAnalysis };