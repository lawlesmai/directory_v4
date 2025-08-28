/**
 * EPIC 5 STORY 5.2: Subscription Management & Billing System
 * Background Job Processor - Automated billing cycle processing
 * 
 * This service provides automated background job processing including:
 * - Daily billing cycle processing
 * - Failed payment retry scheduling
 * - Subscription status updates
 * - Metric calculations and analytics
 * - Cleanup and maintenance tasks
 */

import { createClient } from '@/lib/supabase/server';
import billingService, { BillingCycleResult } from './billing-service';
import subscriptionManager from './subscription-manager';
import { z } from 'zod';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface JobResult {
  jobName: string;
  status: 'success' | 'failure' | 'partial';
  startTime: Date;
  endTime: Date;
  duration: number;
  results: any;
  errors: string[];
}

export interface BillingJobsConfig {
  retryFailedPayments: boolean;
  processTrialExpirations: boolean;
  suspendOverdueAccounts: boolean;
  updateMetrics: boolean;
  cleanupExpiredTokens: boolean;
  sendRenewalNotifications: boolean;
}

export interface TrialExpirationResult {
  processedTrials: number;
  convertedTrials: number;
  expiredTrials: number;
  notificationsSent: number;
  errors: string[];
}

export interface MetricsUpdateResult {
  metricsUpdated: boolean;
  date: string;
  totalRevenue: number;
  newSubscriptions: number;
  canceledSubscriptions: number;
  activeSubscriptions: number;
  churnRate: number;
}

// =============================================
// VALIDATION SCHEMAS
// =============================================

const JobConfigSchema = z.object({
  retryFailedPayments: z.boolean().default(true),
  processTrialExpirations: z.boolean().default(true),
  suspendOverdueAccounts: z.boolean().default(true),
  updateMetrics: z.boolean().default(true),
  cleanupExpiredTokens: z.boolean().default(true),
  sendRenewalNotifications: z.boolean().default(true),
});

// =============================================
// BILLING JOBS PROCESSOR
// =============================================

class BillingJobsProcessor {
  private supabase;
  private defaultConfig: BillingJobsConfig = {
    retryFailedPayments: true,
    processTrialExpirations: true,
    suspendOverdueAccounts: true,
    updateMetrics: true,
    cleanupExpiredTokens: true,
    sendRenewalNotifications: true,
  };

  constructor() {
    this.supabase = createClient();
  }

  // =============================================
  // MAIN JOB PROCESSOR
  // =============================================

  /**
   * Run daily billing jobs
   */
  async runDailyBillingJobs(config: Partial<BillingJobsConfig> = {}): Promise<JobResult[]> {
    const jobConfig = { ...this.defaultConfig, ...config };
    const jobs: Promise<JobResult>[] = [];

    console.log('Starting daily billing jobs...');

    // Process failed payments
    if (jobConfig.retryFailedPayments) {
      jobs.push(this.runJob('retry-failed-payments', () => this.processFailedPayments()));
    }

    // Process trial expirations
    if (jobConfig.processTrialExpirations) {
      jobs.push(this.runJob('process-trial-expirations', () => this.processTrialExpirations()));
    }

    // Suspend overdue accounts
    if (jobConfig.suspendOverdueAccounts) {
      jobs.push(this.runJob('suspend-overdue-accounts', () => this.suspendOverdueAccounts()));
    }

    // Update daily metrics
    if (jobConfig.updateMetrics) {
      jobs.push(this.runJob('update-daily-metrics', () => this.updateDailyMetrics()));
    }

    // Send renewal notifications
    if (jobConfig.sendRenewalNotifications) {
      jobs.push(this.runJob('send-renewal-notifications', () => this.sendRenewalNotifications()));
    }

    // Cleanup expired tokens and data
    if (jobConfig.cleanupExpiredTokens) {
      jobs.push(this.runJob('cleanup-expired-data', () => this.cleanupExpiredData()));
    }

    const results = await Promise.all(jobs);

    // Log job results
    await this.logJobResults(results);

    console.log('Daily billing jobs completed');
    return results;
  }

  // =============================================
  // INDIVIDUAL JOB PROCESSORS
  // =============================================

  /**
   * Process failed payments and retry logic
   */
  async processFailedPayments(): Promise<BillingCycleResult> {
    try {
      console.log('Processing failed payments...');
      
      const result = await billingService.processFailedPayments();
      
      console.log(`Failed payments processed: ${result.processedSubscriptions} subscriptions, ${result.successfulBillings} successful, ${result.failedBillings} failed, ${result.retryScheduled} retries scheduled`);
      
      return result;
    } catch (error) {
      console.error('Process failed payments error:', error);
      throw error;
    }
  }

  /**
   * Process trial expirations and conversions
   */
  async processTrialExpirations(): Promise<TrialExpirationResult> {
    const result: TrialExpirationResult = {
      processedTrials: 0,
      convertedTrials: 0,
      expiredTrials: 0,
      notificationsSent: 0,
      errors: [],
    };

    try {
      console.log('Processing trial expirations...');

      // Get subscriptions with trials ending today
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: expiringTrials } = await this.supabase
        .from('subscriptions')
        .select(`
          *,
          customer:stripe_customers(*)
        `)
        .eq('status', 'trialing')
        .lt('trial_end', tomorrow.toISOString())
        .gt('trial_end', new Date().toISOString());

      if (!expiringTrials) return result;

      result.processedTrials = expiringTrials.length;

      for (const subscription of expiringTrials) {
        try {
          // Check if customer has a payment method
          const { data: paymentMethods } = await this.supabase
            .from('payment_methods')
            .select('*')
            .eq('customer_id', subscription.customer_id)
            .eq('is_default', true)
            .limit(1);

          if (paymentMethods && paymentMethods.length > 0) {
            // Customer has payment method - let trial convert naturally
            console.log(`Trial subscription ${subscription.id} will convert automatically`);
            result.convertedTrials++;
          } else {
            // No payment method - notify customer
            await this.sendTrialExpirationNotification(subscription);
            result.notificationsSent++;
          }
        } catch (error) {
          const errorMsg = `Error processing trial ${subscription.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // Process actually expired trials (past trial_end)
      const { data: expiredTrials } = await this.supabase
        .from('subscriptions')
        .select('*')
        .eq('status', 'trialing')
        .lt('trial_end', new Date().toISOString());

      if (expiredTrials) {
        for (const subscription of expiredTrials) {
          try {
            // Cancel expired trial without payment method
            await subscriptionManager.cancelImmediately(subscription.id, false);
            result.expiredTrials++;
            console.log(`Canceled expired trial subscription ${subscription.id}`);
          } catch (error) {
            const errorMsg = `Error canceling expired trial ${subscription.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            result.errors.push(errorMsg);
            console.error(errorMsg);
          }
        }
      }

      console.log(`Trial processing completed: ${result.convertedTrials} converted, ${result.expiredTrials} expired, ${result.notificationsSent} notified`);
      return result;
    } catch (error) {
      const errorMsg = `Process trial expirations error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      console.error(errorMsg);
      return result;
    }
  }

  /**
   * Suspend overdue accounts
   */
  async suspendOverdueAccounts(): Promise<number> {
    try {
      console.log('Suspending overdue accounts...');
      
      const suspendedCount = await billingService.suspendOverdueSubscriptions();
      
      console.log(`Suspended ${suspendedCount} overdue accounts`);
      return suspendedCount;
    } catch (error) {
      console.error('Suspend overdue accounts error:', error);
      throw error;
    }
  }

  /**
   * Update daily payment metrics
   */
  async updateDailyMetrics(): Promise<MetricsUpdateResult> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    try {
      console.log('Updating daily metrics...');

      // Get daily transaction data
      const { data: transactions } = await this.supabase
        .from('payment_transactions')
        .select('*')
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString())
        .eq('status', 'succeeded');

      // Get subscription data
      const { data: newSubscriptions } = await this.supabase
        .from('subscriptions')
        .select('*')
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString());

      const { data: canceledSubscriptions } = await this.supabase
        .from('subscriptions')
        .select('*')
        .gte('canceled_at', today.toISOString())
        .lt('canceled_at', tomorrow.toISOString());

      const { data: activeSubscriptions } = await this.supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .in('status', ['active', 'trialing']);

      // Calculate metrics
      const totalRevenue = transactions?.reduce((sum, txn) => sum + txn.net_amount, 0) || 0;
      const refundAmount = transactions?.reduce((sum, txn) => sum + txn.refund_amount, 0) || 0;
      const disputeAmount = transactions?.reduce((sum, txn) => sum + txn.dispute_amount, 0) || 0;
      const feeAmount = transactions?.reduce((sum, txn) => sum + txn.fee_amount, 0) || 0;

      const newSubCount = newSubscriptions?.length || 0;
      const canceledSubCount = canceledSubscriptions?.length || 0;
      const activeSubCount = activeSubscriptions || 0;

      // Calculate churn rate (simplified)
      const churnRate = activeSubCount > 0 ? (canceledSubCount / activeSubCount) : 0;

      // Upsert daily analytics
      const { data: analytics, error } = await this.supabase
        .from('payment_analytics')
        .upsert({
          date: today.toISOString().split('T')[0],
          total_revenue: totalRevenue,
          total_transactions: transactions?.length || 0,
          successful_transactions: transactions?.length || 0,
          refund_amount: refundAmount,
          dispute_amount: disputeAmount,
          fee_amount: feeAmount,
          net_revenue: totalRevenue - refundAmount - disputeAmount,
          new_subscriptions: newSubCount,
          canceled_subscriptions: canceledSubCount,
          active_subscriptions: activeSubCount,
          churn_rate: churnRate,
          currency: 'USD',
        }, {
          onConflict: 'date,currency',
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      const result: MetricsUpdateResult = {
        metricsUpdated: true,
        date: today.toISOString().split('T')[0],
        totalRevenue,
        newSubscriptions: newSubCount,
        canceledSubscriptions: canceledSubCount,
        activeSubscriptions: activeSubCount,
        churnRate,
      };

      console.log(`Metrics updated for ${result.date}: $${(totalRevenue / 100).toFixed(2)} revenue, ${newSubCount} new subs, ${canceledSubCount} canceled, ${(churnRate * 100).toFixed(2)}% churn`);
      
      return result;
    } catch (error) {
      console.error('Update daily metrics error:', error);
      throw error;
    }
  }

  /**
   * Send renewal notifications
   */
  async sendRenewalNotifications(): Promise<number> {
    try {
      console.log('Sending renewal notifications...');

      // Get subscriptions renewing in the next 3 days
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      const { data: renewingSubscriptions } = await this.supabase
        .from('subscriptions')
        .select(`
          *,
          customer:stripe_customers(*)
        `)
        .eq('status', 'active')
        .lt('current_period_end', threeDaysFromNow.toISOString())
        .gt('current_period_end', new Date().toISOString());

      if (!renewingSubscriptions) return 0;

      let notificationsSent = 0;

      for (const subscription of renewingSubscriptions) {
        try {
          // Check if we've already sent a notification for this renewal period
          const notificationKey = `renewal_${subscription.id}_${subscription.current_period_end}`;
          
          const { data: existingNotification } = await this.supabase
            .from('webhook_events')
            .select('id')
            .eq('type', 'renewal_notification_sent')
            .eq('object_id', notificationKey)
            .single();

          if (!existingNotification) {
            // Send renewal notification (implement email service)
            await this.sendRenewalNotificationEmail(subscription);
            
            // Record that we sent the notification
            await this.supabase
              .from('webhook_events')
              .insert({
                stripe_event_id: `local_${Date.now()}`,
                type: 'renewal_notification_sent',
                object_id: notificationKey,
                data: {
                  subscription_id: subscription.id,
                  customer_email: subscription.customer.email,
                  renewal_date: subscription.current_period_end,
                },
                processed: true,
                processed_at: new Date().toISOString(),
              });

            notificationsSent++;
          }
        } catch (error) {
          console.error(`Error sending renewal notification for subscription ${subscription.id}:`, error);
        }
      }

      console.log(`Sent ${notificationsSent} renewal notifications`);
      return notificationsSent;
    } catch (error) {
      console.error('Send renewal notifications error:', error);
      throw error;
    }
  }

  /**
   * Cleanup expired data and tokens
   */
  async cleanupExpiredData(): Promise<{ cleanedItems: number; categories: string[] }> {
    const result = { cleanedItems: 0, categories: [] as string[] };

    try {
      console.log('Cleaning up expired data...');

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Cleanup old webhook events
      const { count: webhookCount } = await this.supabase
        .from('webhook_events')
        .delete({ count: 'exact' })
        .eq('processed', true)
        .lt('created_at', thirtyDaysAgo.toISOString());

      if (webhookCount) {
        result.cleanedItems += webhookCount;
        result.categories.push('webhook_events');
      }

      // Cleanup old payment transaction logs (keep financial data longer - 2 years)
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      // Only cleanup failed/canceled transactions older than 2 years
      const { count: transactionCount } = await this.supabase
        .from('payment_transactions')
        .delete({ count: 'exact' })
        .in('status', ['canceled', 'requires_payment_method'])
        .lt('created_at', twoYearsAgo.toISOString());

      if (transactionCount) {
        result.cleanedItems += transactionCount;
        result.categories.push('payment_transactions');
      }

      console.log(`Cleaned up ${result.cleanedItems} expired items from categories: ${result.categories.join(', ')}`);
      return result;
    } catch (error) {
      console.error('Cleanup expired data error:', error);
      throw error;
    }
  }

  // =============================================
  // NOTIFICATION HELPERS
  // =============================================

  /**
   * Send trial expiration notification
   */
  private async sendTrialExpirationNotification(subscription: any): Promise<void> {
    try {
      // In a real implementation, this would use an email service
      console.log(`Sending trial expiration notification to ${subscription.customer.email} for subscription ${subscription.id}`);
      
      // Here you would integrate with your email service (SendGrid, AWS SES, etc.)
      // await emailService.send({
      //   to: subscription.customer.email,
      //   template: 'trial-expiration',
      //   data: {
      //     customerName: subscription.customer.name,
      //     trialEndDate: subscription.trial_end,
      //     subscriptionId: subscription.id,
      //   }
      // });
    } catch (error) {
      console.error('Send trial expiration notification error:', error);
      throw error;
    }
  }

  /**
   * Send renewal notification email
   */
  private async sendRenewalNotificationEmail(subscription: any): Promise<void> {
    try {
      console.log(`Sending renewal notification to ${subscription.customer.email} for subscription ${subscription.id}`);
      
      // Here you would integrate with your email service
      // await emailService.send({
      //   to: subscription.customer.email,
      //   template: 'subscription-renewal',
      //   data: {
      //     customerName: subscription.customer.name,
      //     renewalDate: subscription.current_period_end,
      //     subscriptionId: subscription.id,
      //   }
      // });
    } catch (error) {
      console.error('Send renewal notification email error:', error);
      throw error;
    }
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  /**
   * Run individual job with error handling and timing
   */
  private async runJob<T>(jobName: string, jobFunction: () => Promise<T>): Promise<JobResult> {
    const startTime = new Date();
    
    try {
      console.log(`Starting job: ${jobName}`);
      
      const results = await jobFunction();
      const endTime = new Date();
      
      const jobResult: JobResult = {
        jobName,
        status: 'success',
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        results,
        errors: [],
      };

      console.log(`Job ${jobName} completed successfully in ${jobResult.duration}ms`);
      return jobResult;
    } catch (error) {
      const endTime = new Date();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      const jobResult: JobResult = {
        jobName,
        status: 'failure',
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        results: null,
        errors: [errorMessage],
      };

      console.error(`Job ${jobName} failed after ${jobResult.duration}ms:`, errorMessage);
      return jobResult;
    }
  }

  /**
   * Log job results to database
   */
  private async logJobResults(results: JobResult[]): Promise<void> {
    try {
      const jobLog = {
        date: new Date().toISOString().split('T')[0],
        jobs_run: results.length,
        successful_jobs: results.filter(r => r.status === 'success').length,
        failed_jobs: results.filter(r => r.status === 'failure').length,
        total_duration: results.reduce((sum, r) => sum + r.duration, 0),
        job_details: results.map(r => ({
          name: r.jobName,
          status: r.status,
          duration: r.duration,
          errors: r.errors,
        })),
      };

      // Store job log (you might create a dedicated table for this)
      await this.supabase
        .from('webhook_events')
        .insert({
          stripe_event_id: `job_log_${Date.now()}`,
          type: 'daily_billing_jobs_completed',
          data: jobLog,
          processed: true,
          processed_at: new Date().toISOString(),
        });

      console.log('Job results logged to database');
    } catch (error) {
      console.error('Error logging job results:', error);
    }
  }

  /**
   * Get job execution history
   */
  async getJobHistory(days: number = 7): Promise<any[]> {
    try {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);

      const { data } = await this.supabase
        .from('webhook_events')
        .select('*')
        .eq('type', 'daily_billing_jobs_completed')
        .gte('created_at', sinceDate.toISOString())
        .order('created_at', { ascending: false });

      return data || [];
    } catch (error) {
      console.error('Get job history error:', error);
      return [];
    }
  }
}

// =============================================
// SINGLETON INSTANCE
// =============================================

const billingJobsProcessor = new BillingJobsProcessor();

export default billingJobsProcessor;
export { BillingJobsProcessor };