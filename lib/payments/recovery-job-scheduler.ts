/**
 * EPIC 5 STORY 5.7: Payment Failure Recovery & Dunning Management
 * Recovery Job Scheduler - Background job processing for retry scheduling
 * 
 * This service manages background jobs for payment retry scheduling,
 * dunning campaign execution, grace period monitoring, and analytics generation.
 */

import { createClient } from '@/lib/supabase/server';
import paymentFailureHandler from './payment-failure-handler';
import dunningManager from './dunning-manager';
import accountStateManager from './account-state-manager';
import recoveryAnalytics from '../analytics/recovery-analytics';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface JobResult {
  jobType: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  success: boolean;
  processed: number;
  successful: number;
  failed: number;
  errors: string[];
  metadata?: Record<string, any>;
}

export interface SchedulerConfig {
  retryJobInterval: number; // minutes
  dunningJobInterval: number; // minutes
  gracePeriodJobInterval: number; // minutes
  analyticsJobInterval: number; // minutes (daily)
  maxConcurrentJobs: number;
  jobTimeoutMs: number;
}

// =============================================
// RECOVERY JOB SCHEDULER CLASS
// =============================================

class RecoveryJobScheduler {
  private supabase;
  private activeJobs: Set<string> = new Set();
  private jobIntervals: Map<string, NodeJS.Timeout> = new Map();
  private config: SchedulerConfig;

  constructor(config?: Partial<SchedulerConfig>) {
    this.supabase = createClient();
    this.config = {
      retryJobInterval: 15, // Every 15 minutes
      dunningJobInterval: 30, // Every 30 minutes
      gracePeriodJobInterval: 60, // Every hour
      analyticsJobInterval: 1440, // Daily (1440 minutes)
      maxConcurrentJobs: 5,
      jobTimeoutMs: 300000, // 5 minutes
      ...config,
    };
  }

  // =============================================
  // SCHEDULER MANAGEMENT
  // =============================================

  /**
   * Start all scheduled jobs
   */
  start(): void {
    console.log('Starting Recovery Job Scheduler...');

    // Schedule payment retry job
    const retryInterval = setInterval(
      () => this.executeJob('payment_retry', () => this.processPaymentRetries()),
      this.config.retryJobInterval * 60 * 1000
    );
    this.jobIntervals.set('payment_retry', retryInterval);

    // Schedule dunning campaign job
    const dunningInterval = setInterval(
      () => this.executeJob('dunning_campaigns', () => this.processDunningCampaigns()),
      this.config.dunningJobInterval * 60 * 1000
    );
    this.jobIntervals.set('dunning_campaigns', dunningInterval);

    // Schedule grace period monitoring job
    const gracePeriodInterval = setInterval(
      () => this.executeJob('grace_period_monitoring', () => this.processExpiredGracePeriods()),
      this.config.gracePeriodJobInterval * 60 * 1000
    );
    this.jobIntervals.set('grace_period_monitoring', gracePeriodInterval);

    // Schedule analytics generation job
    const analyticsInterval = setInterval(
      () => this.executeJob('analytics_generation', () => this.generateAnalytics()),
      this.config.analyticsJobInterval * 60 * 1000
    );
    this.jobIntervals.set('analytics_generation', analyticsInterval);

    // Run initial jobs immediately (with delay to avoid startup conflicts)
    setTimeout(() => {
      this.executeJob('payment_retry', () => this.processPaymentRetries());
    }, 5000);

    setTimeout(() => {
      this.executeJob('dunning_campaigns', () => this.processDunningCampaigns());
    }, 10000);

    console.log('Recovery Job Scheduler started successfully');
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    console.log('Stopping Recovery Job Scheduler...');

    // Clear all intervals
    this.jobIntervals.forEach((interval, jobType) => {
      clearInterval(interval);
      console.log(`Stopped ${jobType} job`);
    });

    this.jobIntervals.clear();
    this.activeJobs.clear();

    console.log('Recovery Job Scheduler stopped');
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    activeJobs: string[];
    scheduledJobs: string[];
    config: SchedulerConfig;
  } {
    return {
      isRunning: this.jobIntervals.size > 0,
      activeJobs: Array.from(this.activeJobs),
      scheduledJobs: Array.from(this.jobIntervals.keys()),
      config: this.config,
    };
  }

  // =============================================
  // JOB EXECUTION FRAMEWORK
  // =============================================

  /**
   * Execute a job with proper error handling and logging
   */
  private async executeJob(jobType: string, jobFunction: () => Promise<any>): Promise<JobResult> {
    const startTime = new Date();
    const jobId = `${jobType}_${startTime.getTime()}`;

    // Check if max concurrent jobs reached
    if (this.activeJobs.size >= this.config.maxConcurrentJobs) {
      console.warn(`Skipping ${jobType} job - max concurrent jobs reached`);
      return {
        jobType,
        startTime,
        endTime: new Date(),
        duration: 0,
        success: false,
        processed: 0,
        successful: 0,
        failed: 0,
        errors: ['Max concurrent jobs reached'],
      };
    }

    // Check if job is already running
    if (this.activeJobs.has(jobType)) {
      console.warn(`Skipping ${jobType} job - already running`);
      return {
        jobType,
        startTime,
        endTime: new Date(),
        duration: 0,
        success: false,
        processed: 0,
        successful: 0,
        failed: 0,
        errors: ['Job already running'],
      };
    }

    this.activeJobs.add(jobType);
    
    try {
      console.log(`Starting ${jobType} job...`);

      // Execute job with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Job timeout')), this.config.jobTimeoutMs);
      });

      const result = await Promise.race([jobFunction(), timeoutPromise]);
      
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const jobResult: JobResult = {
        jobType,
        startTime,
        endTime,
        duration,
        success: true,
        processed: result.processed || 0,
        successful: result.successful || 0,
        failed: result.failed || 0,
        errors: result.errors || [],
        metadata: result.metadata,
      };

      console.log(`Completed ${jobType} job in ${duration}ms:`, {
        processed: jobResult.processed,
        successful: jobResult.successful,
        failed: jobResult.failed,
      });

      // Log job result to database
      await this.logJobResult(jobResult);

      return jobResult;
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const jobResult: JobResult = {
        jobType,
        startTime,
        endTime,
        duration,
        success: false,
        processed: 0,
        successful: 0,
        failed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };

      console.error(`Failed ${jobType} job after ${duration}ms:`, error);

      // Log job result to database
      await this.logJobResult(jobResult);

      return jobResult;
    } finally {
      this.activeJobs.delete(jobType);
    }
  }

  // =============================================
  // SPECIFIC JOB IMPLEMENTATIONS
  // =============================================

  /**
   * Process pending payment retries
   */
  private async processPaymentRetries(): Promise<{
    processed: number;
    successful: number;
    failed: number;
    abandoned: number;
  }> {
    try {
      const result = await paymentFailureHandler.processPendingRetries();
      
      // Update payment method health based on results
      if (result.successful > 0) {
        await this.updateSystemHealthMetrics('payment_retry_success', result.successful);
      }

      return result;
    } catch (error) {
      console.error('Process payment retries job error:', error);
      throw error;
    }
  }

  /**
   * Process pending dunning communications
   */
  private async processDunningCampaigns(): Promise<{
    processed: number;
    sent: number;
    failed: number;
  }> {
    try {
      const result = await dunningManager.processPendingCommunications();

      // Update communication health metrics
      if (result.sent > 0) {
        await this.updateSystemHealthMetrics('dunning_communications_sent', result.sent);
      }

      return result;
    } catch (error) {
      console.error('Process dunning campaigns job error:', error);
      throw error;
    }
  }

  /**
   * Process expired grace periods
   */
  private async processExpiredGracePeriods(): Promise<{
    processed: number;
    suspended: number;
    errors: number;
  }> {
    try {
      const result = await accountStateManager.processExpiredGracePeriods();

      // Update account state metrics
      if (result.suspended > 0) {
        await this.updateSystemHealthMetrics('accounts_suspended', result.suspended);
      }

      return result;
    } catch (error) {
      console.error('Process expired grace periods job error:', error);
      throw error;
    }
  }

  /**
   * Generate daily analytics
   */
  private async generateAnalytics(): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }> {
    try {
      // Generate analytics for yesterday (completed day)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateString = yesterday.toISOString().split('T')[0];

      const metrics = await recoveryAnalytics.generateDailyMetrics(dateString);

      // Also generate analytics for today (partial day) for real-time dashboard
      const today = new Date().toISOString().split('T')[0];
      const todayMetrics = await recoveryAnalytics.generateDailyMetrics(today);

      const totalMetrics = metrics.length + todayMetrics.length;

      await this.updateSystemHealthMetrics('analytics_metrics_generated', totalMetrics);

      return {
        processed: 2, // Two days processed
        successful: totalMetrics,
        failed: 0,
      };
    } catch (error) {
      console.error('Generate analytics job error:', error);
      throw error;
    }
  }

  // =============================================
  // MANUAL JOB TRIGGERS
  // =============================================

  /**
   * Manually trigger a specific job (for admin/testing use)
   */
  async triggerJob(jobType: string): Promise<JobResult> {
    switch (jobType) {
      case 'payment_retry':
        return this.executeJob(jobType, () => this.processPaymentRetries());
      
      case 'dunning_campaigns':
        return this.executeJob(jobType, () => this.processDunningCampaigns());
      
      case 'grace_period_monitoring':
        return this.executeJob(jobType, () => this.processExpiredGracePeriods());
      
      case 'analytics_generation':
        return this.executeJob(jobType, () => this.generateAnalytics());
      
      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }
  }

  /**
   * Get job history from database
   */
  async getJobHistory(
    jobType?: string,
    limit: number = 50
  ): Promise<Array<{
    id: string;
    jobType: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    success: boolean;
    processed: number;
    successful: number;
    failed: number;
    errors: string[];
    metadata?: Record<string, any>;
  }>> {
    try {
      let query = this.supabase
        .from('job_execution_log')
        .select('*')
        .order('start_time', { ascending: false })
        .limit(limit);

      if (jobType) {
        query = query.eq('job_type', jobType);
      }

      const { data: jobs, error } = await query;

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return jobs?.map(job => ({
        id: job.id,
        jobType: job.job_type,
        startTime: new Date(job.start_time),
        endTime: new Date(job.end_time),
        duration: job.duration,
        success: job.success,
        processed: job.processed,
        successful: job.successful,
        failed: job.failed,
        errors: job.errors || [],
        metadata: job.metadata,
      })) || [];
    } catch (error) {
      console.error('Get job history error:', error);
      return [];
    }
  }

  // =============================================
  // HELPER METHODS
  // =============================================

  /**
   * Log job execution result to database
   */
  private async logJobResult(result: JobResult): Promise<void> {
    try {
      // First ensure the job_execution_log table exists
      await this.ensureJobLogTable();

      await this.supabase
        .from('job_execution_log')
        .insert({
          job_type: result.jobType,
          start_time: result.startTime.toISOString(),
          end_time: result.endTime.toISOString(),
          duration: result.duration,
          success: result.success,
          processed: result.processed,
          successful: result.successful,
          failed: result.failed,
          errors: result.errors,
          metadata: result.metadata,
        });
    } catch (error) {
      // Don't throw here to avoid breaking the job execution
      console.error('Failed to log job result:', error);
    }
  }

  /**
   * Update system health metrics
   */
  private async updateSystemHealthMetrics(metric: string, value: number): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Update or insert system health metrics
      await this.supabase
        .from('system_health_metrics')
        .upsert({
          date: today,
          metric_name: metric,
          metric_value: value,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'date,metric_name',
        });
    } catch (error) {
      console.error('Failed to update system health metrics:', error);
      // Don't throw to avoid breaking job execution
    }
  }

  /**
   * Ensure job execution log table exists
   */
  private async ensureJobLogTable(): Promise<void> {
    try {
      // This would be better handled by a migration, but for now check if table exists
      const { error } = await this.supabase
        .from('job_execution_log')
        .select('*')
        .limit(1);

      if (error && error.message.includes('relation "job_execution_log" does not exist')) {
        // Create the table (this should be in a migration instead)
        console.warn('Job execution log table does not exist - jobs will not be logged');
      }
    } catch (error) {
      console.warn('Could not verify job log table existence');
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<{
    scheduler: {
      isRunning: boolean;
      activeJobs: string[];
      lastJobExecution: Record<string, Date | null>;
    };
    metrics: {
      lastRetryJobSuccess: Date | null;
      lastDunningJobSuccess: Date | null;
      lastGracePeriodJobSuccess: Date | null;
      lastAnalyticsJobSuccess: Date | null;
      totalJobsToday: number;
      successfulJobsToday: number;
      failedJobsToday: number;
    };
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get recent successful jobs
      const { data: recentJobs } = await this.supabase
        .from('job_execution_log')
        .select('job_type, end_time')
        .eq('success', true)
        .gte('start_time', `${today}T00:00:00Z`)
        .order('end_time', { ascending: false });

      // Get today's job statistics
      const { data: todayStats } = await this.supabase
        .from('job_execution_log')
        .select('success')
        .gte('start_time', `${today}T00:00:00Z`);

      const lastJobExecution: Record<string, Date | null> = {
        payment_retry: null,
        dunning_campaigns: null,
        grace_period_monitoring: null,
        analytics_generation: null,
      };

      recentJobs?.forEach(job => {
        if (!lastJobExecution[job.job_type]) {
          lastJobExecution[job.job_type] = new Date(job.end_time);
        }
      });

      const totalJobsToday = todayStats?.length || 0;
      const successfulJobsToday = todayStats?.filter(job => job.success).length || 0;
      const failedJobsToday = totalJobsToday - successfulJobsToday;

      return {
        scheduler: {
          isRunning: this.jobIntervals.size > 0,
          activeJobs: Array.from(this.activeJobs),
          lastJobExecution,
        },
        metrics: {
          lastRetryJobSuccess: lastJobExecution.payment_retry,
          lastDunningJobSuccess: lastJobExecution.dunning_campaigns,
          lastGracePeriodJobSuccess: lastJobExecution.grace_period_monitoring,
          lastAnalyticsJobSuccess: lastJobExecution.analytics_generation,
          totalJobsToday,
          successfulJobsToday,
          failedJobsToday,
        },
      };
    } catch (error) {
      console.error('Get system health error:', error);
      return {
        scheduler: {
          isRunning: this.jobIntervals.size > 0,
          activeJobs: Array.from(this.activeJobs),
          lastJobExecution: {},
        },
        metrics: {
          lastRetryJobSuccess: null,
          lastDunningJobSuccess: null,
          lastGracePeriodJobSuccess: null,
          lastAnalyticsJobSuccess: null,
          totalJobsToday: 0,
          successfulJobsToday: 0,
          failedJobsToday: 0,
        },
      };
    }
  }
}

// =============================================
// SINGLETON INSTANCE
// =============================================

const recoveryJobScheduler = new RecoveryJobScheduler();

// Start scheduler if in production environment
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_RECOVERY_SCHEDULER === 'true') {
  recoveryJobScheduler.start();
}

export default recoveryJobScheduler;
export { RecoveryJobScheduler };
export type { JobResult, SchedulerConfig };