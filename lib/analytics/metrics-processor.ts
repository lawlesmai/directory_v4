/**
 * EPIC 5 STORY 5.6: Revenue Analytics & Business Intelligence
 * Real-Time Metrics Processor - Daily calculation jobs and real-time processing
 * 
 * This module provides real-time metrics processing including:
 * - Daily automated metrics calculation
 * - Real-time revenue tracking for dashboards
 * - Automated cohort analysis updates
 * - Performance alert system for KPI thresholds
 * - Webhook-triggered metric updates
 */

import { createClient } from '@/lib/supabase/server';
import dataProcessor from './data-processor';
import revenueCalculator from './revenue-calculator';
import customerAnalytics from './customer-analytics';
import { z } from 'zod';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface MetricsJobConfig {
  id: string;
  name: string;
  schedule: string; // Cron expression
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  status: 'idle' | 'running' | 'completed' | 'failed';
  errorCount: number;
  maxRetries: number;
}

export interface MetricsAlert {
  id: string;
  metric: string;
  threshold: number;
  condition: 'above' | 'below' | 'equals';
  value: number;
  severity: 'info' | 'warning' | 'critical';
  triggered: boolean;
  triggeredAt?: Date;
  resolvedAt?: Date;
  message: string;
  recipients: string[];
}

export interface RealTimeMetric {
  key: string;
  value: number;
  timestamp: Date;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface ProcessingResult {
  jobId: string;
  status: 'success' | 'partial' | 'failed';
  recordsProcessed: number;
  errors: string[];
  duration: number;
  metrics: {
    created: number;
    updated: number;
    failed: number;
  };
}

// =============================================
// VALIDATION SCHEMAS
// =============================================

const MetricsJobSchema = z.object({
  name: z.string().min(1),
  schedule: z.string().min(1), // Cron expression
  enabled: z.boolean().default(true),
  config: z.record(z.any()).default({}),
});

const AlertConfigSchema = z.object({
  metric: z.string(),
  threshold: z.number(),
  condition: z.enum(['above', 'below', 'equals']),
  severity: z.enum(['info', 'warning', 'critical']).default('warning'),
  recipients: z.array(z.string().email()),
});

// =============================================
// METRICS PROCESSOR CLASS
// =============================================

export class MetricsProcessor {
  private supabase;
  private jobs: Map<string, MetricsJobConfig> = new Map();
  private alerts: Map<string, MetricsAlert> = new Map();
  private realTimeMetrics: Map<string, RealTimeMetric> = new Map();
  private processingQueue: Array<{ jobId: string; priority: number }> = [];
  private isProcessing = false;

  constructor() {
    this.supabase = createClient();
    this.initializeJobs();
    this.initializeAlerts();
    this.startProcessingLoop();
  }

  // =============================================
  // JOB MANAGEMENT
  // =============================================

  /**
   * Register a new metrics processing job
   */
  async registerJob(config: z.infer<typeof MetricsJobSchema>): Promise<string> {
    try {
      const validatedConfig = MetricsJobSchema.parse(config);
      const jobId = this.generateJobId();

      const job: MetricsJobConfig = {
        id: jobId,
        name: validatedConfig.name,
        schedule: validatedConfig.schedule,
        enabled: validatedConfig.enabled,
        nextRun: this.calculateNextRun(validatedConfig.schedule),
        status: 'idle',
        errorCount: 0,
        maxRetries: 3,
      };

      this.jobs.set(jobId, job);

      // Save job configuration to database
      await this.saveJobConfig(job);

      return jobId;
    } catch (error) {
      throw new Error(`Failed to register job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute daily metrics calculation
   */
  async executeDailyMetricsJob(): Promise<ProcessingResult> {
    const jobId = 'daily_metrics';
    const startTime = Date.now();

    try {
      this.updateJobStatus(jobId, 'running');

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Process daily metrics
      const result = await dataProcessor.processDailyMetrics({
        startDate: yesterday,
        endDate: today,
        forceRefresh: false,
        batchSize: 1000,
        includeDataQuality: true,
      });

      // Update real-time metrics cache
      await this.updateRealTimeMetrics(result);

      // Check for alert conditions
      await this.checkAlerts(result);

      const duration = Date.now() - startTime;
      this.updateJobStatus(jobId, 'completed');

      return {
        jobId,
        status: 'success',
        recordsProcessed: result.length,
        errors: [],
        duration,
        metrics: {
          created: result.length,
          updated: 0,
          failed: 0,
        },
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateJobStatus(jobId, 'failed');
      
      return {
        jobId,
        status: 'failed',
        recordsProcessed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        duration,
        metrics: {
          created: 0,
          updated: 0,
          failed: 1,
        },
      };
    }
  }

  /**
   * Execute cohort analysis job
   */
  async executeCohortAnalysisJob(): Promise<ProcessingResult> {
    const jobId = 'cohort_analysis';
    const startTime = Date.now();

    try {
      this.updateJobStatus(jobId, 'running');

      // Process cohort analysis for the last 12 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const result = await dataProcessor.processCohortAnalysis({
        startDate: sixMonthsAgo,
        endDate: new Date(),
        forceRefresh: false,
        batchSize: 500,
        includeDataQuality: true,
      });

      const duration = Date.now() - startTime;
      this.updateJobStatus(jobId, 'completed');

      return {
        jobId,
        status: 'success',
        recordsProcessed: result.reduce((sum, cohort) => sum + cohort.customersProcessed, 0),
        errors: [],
        duration,
        metrics: {
          created: result.length,
          updated: 0,
          failed: 0,
        },
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateJobStatus(jobId, 'failed');
      
      return {
        jobId,
        status: 'failed',
        recordsProcessed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        duration,
        metrics: {
          created: 0,
          updated: 0,
          failed: 1,
        },
      };
    }
  }

  /**
   * Execute LTV calculation job
   */
  async executeLTVCalculationJob(): Promise<ProcessingResult> {
    const jobId = 'ltv_calculation';
    const startTime = Date.now();

    try {
      this.updateJobStatus(jobId, 'running');

      // Process LTV calculations for customers modified in last week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const result = await dataProcessor.processLTVCalculations({
        startDate: oneWeekAgo,
        endDate: new Date(),
        forceRefresh: false,
        batchSize: 100,
        includeDataQuality: true,
      });

      const duration = Date.now() - startTime;
      this.updateJobStatus(jobId, 'completed');

      return {
        jobId,
        status: 'success',
        recordsProcessed: result.customersProcessed,
        errors: [],
        duration,
        metrics: {
          created: result.customersProcessed,
          updated: 0,
          failed: 0,
        },
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateJobStatus(jobId, 'failed');
      
      return {
        jobId,
        status: 'failed',
        recordsProcessed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        duration,
        metrics: {
          created: 0,
          updated: 0,
          failed: 1,
        },
      };
    }
  }

  // =============================================
  // REAL-TIME METRICS
  // =============================================

  /**
   * Update real-time metrics from processed data
   */
  async updateRealTimeMetrics(processedData: any[]): Promise<void> {
    try {
      const timestamp = new Date();

      for (const data of processedData) {
        // Update MRR metric
        this.realTimeMetrics.set('mrr', {
          key: 'mrr',
          value: data.metrics.revenue.mrr,
          timestamp,
          metadata: {
            date: data.date,
            currency: 'USD',
          },
          tags: ['revenue', 'recurring'],
        });

        // Update customer count
        this.realTimeMetrics.set('total_customers', {
          key: 'total_customers',
          value: data.metrics.customers.total,
          timestamp,
          metadata: {
            date: data.date,
            new_customers: data.metrics.customers.new,
            churned_customers: data.metrics.customers.churned,
          },
          tags: ['customers', 'total'],
        });

        // Update ARR metric
        this.realTimeMetrics.set('arr', {
          key: 'arr',
          value: data.metrics.revenue.arr,
          timestamp,
          metadata: {
            date: data.date,
            mrr: data.metrics.revenue.mrr,
          },
          tags: ['revenue', 'annual'],
        });

        // Update growth rates
        const previousMRR = await this.getPreviousMetric('mrr', data.date);
        if (previousMRR) {
          const growthRate = ((data.metrics.revenue.mrr - previousMRR) / previousMRR) * 100;
          this.realTimeMetrics.set('mrr_growth_rate', {
            key: 'mrr_growth_rate',
            value: growthRate,
            timestamp,
            metadata: {
              date: data.date,
              current_mrr: data.metrics.revenue.mrr,
              previous_mrr: previousMRR,
            },
            tags: ['revenue', 'growth'],
          });
        }
      }

      // Persist real-time metrics to cache
      await this.persistRealTimeMetrics();

    } catch (error) {
      console.error('Error updating real-time metrics:', error);
    }
  }

  /**
   * Get current real-time metric value
   */
  getRealTimeMetric(key: string): RealTimeMetric | undefined {
    return this.realTimeMetrics.get(key);
  }

  /**
   * Get all real-time metrics
   */
  getAllRealTimeMetrics(): Record<string, RealTimeMetric> {
    return Object.fromEntries(this.realTimeMetrics.entries());
  }

  /**
   * Handle webhook-triggered metric updates
   */
  async handleWebhookUpdate(event: string, data: any): Promise<void> {
    try {
      switch (event) {
        case 'subscription.created':
          await this.updateSubscriptionMetrics('created', data);
          break;
        
        case 'subscription.updated':
          await this.updateSubscriptionMetrics('updated', data);
          break;
        
        case 'subscription.canceled':
          await this.updateSubscriptionMetrics('canceled', data);
          break;
        
        case 'payment.succeeded':
          await this.updatePaymentMetrics('succeeded', data);
          break;
        
        case 'payment.failed':
          await this.updatePaymentMetrics('failed', data);
          break;
        
        default:
          console.log(`Unhandled webhook event: ${event}`);
      }
    } catch (error) {
      console.error(`Error handling webhook update for ${event}:`, error);
    }
  }

  // =============================================
  // ALERTS SYSTEM
  // =============================================

  /**
   * Register a new performance alert
   */
  async registerAlert(config: z.infer<typeof AlertConfigSchema>): Promise<string> {
    try {
      const validatedConfig = AlertConfigSchema.parse(config);
      const alertId = this.generateAlertId();

      const alert: MetricsAlert = {
        id: alertId,
        metric: validatedConfig.metric,
        threshold: validatedConfig.threshold,
        condition: validatedConfig.condition,
        value: 0,
        severity: validatedConfig.severity,
        triggered: false,
        message: `${validatedConfig.metric} is ${validatedConfig.condition} ${validatedConfig.threshold}`,
        recipients: validatedConfig.recipients,
      };

      this.alerts.set(alertId, alert);
      await this.saveAlertConfig(alert);

      return alertId;
    } catch (error) {
      throw new Error(`Failed to register alert: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check all alerts against current metrics
   */
  async checkAlerts(metricsData: any[]): Promise<void> {
    try {
      for (const [alertId, alert] of this.alerts.entries()) {
        const currentValue = this.extractMetricValue(metricsData, alert.metric);
        
        if (currentValue !== null) {
          const shouldTrigger = this.evaluateAlertCondition(
            currentValue, 
            alert.threshold, 
            alert.condition
          );

          if (shouldTrigger && !alert.triggered) {
            // Trigger alert
            alert.triggered = true;
            alert.triggeredAt = new Date();
            alert.value = currentValue;
            
            await this.sendAlert(alert);
            
          } else if (!shouldTrigger && alert.triggered) {
            // Resolve alert
            alert.triggered = false;
            alert.resolvedAt = new Date();
            alert.value = currentValue;
            
            await this.sendAlertResolution(alert);
          }

          // Update alert value
          alert.value = currentValue;
          this.alerts.set(alertId, alert);
        }
      }
    } catch (error) {
      console.error('Error checking alerts:', error);
    }
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): MetricsAlert[] {
    return Array.from(this.alerts.values()).filter(alert => alert.triggered);
  }

  /**
   * Get alert history
   */
  async getAlertHistory(hours: number = 24): Promise<MetricsAlert[]> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);

    return Array.from(this.alerts.values()).filter(alert => 
      alert.triggeredAt && alert.triggeredAt >= cutoff
    );
  }

  // =============================================
  // PRIVATE METHODS
  // =============================================

  private async initializeJobs(): Promise<void> {
    // Register default jobs
    const defaultJobs = [
      {
        name: 'Daily Metrics Calculation',
        schedule: '0 1 * * *', // Daily at 1 AM
        enabled: true,
      },
      {
        name: 'Cohort Analysis',
        schedule: '0 2 * * 0', // Weekly on Sunday at 2 AM
        enabled: true,
      },
      {
        name: 'LTV Calculation',
        schedule: '0 3 * * 1', // Weekly on Monday at 3 AM
        enabled: true,
      },
    ];

    for (const jobConfig of defaultJobs) {
      try {
        await this.registerJob(jobConfig);
      } catch (error) {
        console.error(`Failed to register default job ${jobConfig.name}:`, error);
      }
    }
  }

  private async initializeAlerts(): Promise<void> {
    // Register default alerts
    const defaultAlerts = [
      {
        metric: 'mrr_growth_rate',
        threshold: -5,
        condition: 'below' as const,
        severity: 'critical' as const,
        recipients: ['admin@company.com'],
      },
      {
        metric: 'customer_churn_rate',
        threshold: 10,
        condition: 'above' as const,
        severity: 'warning' as const,
        recipients: ['admin@company.com'],
      },
      {
        metric: 'total_customers',
        threshold: 100,
        condition: 'above' as const,
        severity: 'info' as const,
        recipients: ['admin@company.com'],
      },
    ];

    for (const alertConfig of defaultAlerts) {
      try {
        await this.registerAlert(alertConfig);
      } catch (error) {
        console.error(`Failed to register default alert:`, error);
      }
    }
  }

  private startProcessingLoop(): void {
    // Start processing loop to handle scheduled jobs
    setInterval(async () => {
      await this.processScheduledJobs();
    }, 60000); // Check every minute

    // Start queue processing
    setInterval(async () => {
      if (!this.isProcessing && this.processingQueue.length > 0) {
        await this.processQueue();
      }
    }, 5000); // Process queue every 5 seconds
  }

  private async processScheduledJobs(): Promise<void> {
    const now = new Date();

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.enabled && job.nextRun && job.nextRun <= now && job.status === 'idle') {
        // Add to processing queue
        this.processingQueue.push({ jobId, priority: 1 });
        
        // Update next run time
        job.nextRun = this.calculateNextRun(job.schedule);
        this.jobs.set(jobId, job);
      }
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processingQueue.length === 0) return;

    this.isProcessing = true;

    try {
      // Sort by priority
      this.processingQueue.sort((a, b) => b.priority - a.priority);
      
      const { jobId } = this.processingQueue.shift()!;
      const job = this.jobs.get(jobId);

      if (!job) return;

      // Execute job based on name
      let result: ProcessingResult;
      
      switch (job.name) {
        case 'Daily Metrics Calculation':
          result = await this.executeDailyMetricsJob();
          break;
        case 'Cohort Analysis':
          result = await this.executeCohortAnalysisJob();
          break;
        case 'LTV Calculation':
          result = await this.executeLTVCalculationJob();
          break;
        default:
          console.log(`Unknown job: ${job.name}`);
          return;
      }

      // Handle job result
      if (result.status === 'failed') {
        job.errorCount++;
        if (job.errorCount >= job.maxRetries) {
          job.enabled = false;
          console.error(`Job ${job.name} disabled after ${job.maxRetries} failures`);
        }
      } else {
        job.errorCount = 0;
      }

      job.lastRun = new Date();
      this.jobs.set(jobId, job);

    } catch (error) {
      console.error('Error processing queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async updateSubscriptionMetrics(action: string, data: any): Promise<void> {
    const timestamp = new Date();

    // Update subscription count
    const currentCount = this.realTimeMetrics.get('total_subscriptions')?.value || 0;
    let newCount = currentCount;

    switch (action) {
      case 'created':
        newCount = currentCount + 1;
        break;
      case 'canceled':
        newCount = Math.max(0, currentCount - 1);
        break;
    }

    this.realTimeMetrics.set('total_subscriptions', {
      key: 'total_subscriptions',
      value: newCount,
      timestamp,
      metadata: { action, subscription_id: data.id },
      tags: ['subscriptions', action],
    });

    // Trigger MRR recalculation if needed
    if (['created', 'updated', 'canceled'].includes(action)) {
      // Queue MRR recalculation
      this.processingQueue.push({ jobId: 'recalc_mrr', priority: 2 });
    }
  }

  private async updatePaymentMetrics(action: string, data: any): Promise<void> {
    const timestamp = new Date();

    // Update payment success rate
    const successKey = 'payment_success_rate';
    const currentMetric = this.realTimeMetrics.get(successKey);
    
    if (currentMetric) {
      // Simple rolling average (in production, would use more sophisticated calculation)
      const currentRate = currentMetric.value;
      const newRate = action === 'succeeded' 
        ? Math.min(100, currentRate + 0.1)
        : Math.max(0, currentRate - 0.1);

      this.realTimeMetrics.set(successKey, {
        key: successKey,
        value: newRate,
        timestamp,
        metadata: { action, payment_id: data.id },
        tags: ['payments', 'success_rate'],
      });
    }
  }

  private calculateNextRun(schedule: string): Date {
    // Simple cron parsing - in production, would use a proper cron library
    const now = new Date();
    const nextRun = new Date(now);
    
    // Default to next day at same time for simplicity
    nextRun.setDate(nextRun.getDate() + 1);
    
    return nextRun;
  }

  private updateJobStatus(jobId: string, status: MetricsJobConfig['status']): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = status;
      this.jobs.set(jobId, job);
    }
  }

  private async getPreviousMetric(key: string, currentDate: string): Promise<number | null> {
    try {
      const { data } = await this.supabase
        .from('billing_metrics')
        .select('mrr, total_customers')
        .lt('date', currentDate)
        .order('date', { ascending: false })
        .limit(1)
        .single();

      return data ? (key === 'mrr' ? data.mrr : data.total_customers) : null;
    } catch (error) {
      return null;
    }
  }

  private async persistRealTimeMetrics(): Promise<void> {
    // In production, would persist to Redis or similar cache
    // For now, just log the metrics
    const metrics = this.getAllRealTimeMetrics();
    console.log('Real-time metrics updated:', Object.keys(metrics).length, 'metrics');
  }

  private extractMetricValue(metricsData: any[], metricName: string): number | null {
    if (metricsData.length === 0) return null;

    const latestData = metricsData[metricsData.length - 1];
    
    switch (metricName) {
      case 'mrr':
        return latestData.metrics?.revenue?.mrr || 0;
      case 'mrr_growth_rate':
        return this.realTimeMetrics.get('mrr_growth_rate')?.value || 0;
      case 'customer_churn_rate':
        return latestData.dataQuality?.churnRate || 0;
      case 'total_customers':
        return latestData.metrics?.customers?.total || 0;
      default:
        return null;
    }
  }

  private evaluateAlertCondition(
    value: number, 
    threshold: number, 
    condition: 'above' | 'below' | 'equals'
  ): boolean {
    switch (condition) {
      case 'above':
        return value > threshold;
      case 'below':
        return value < threshold;
      case 'equals':
        return Math.abs(value - threshold) < 0.001;
      default:
        return false;
    }
  }

  private async sendAlert(alert: MetricsAlert): Promise<void> {
    // In production, would send email, Slack notification, etc.
    console.log(`ALERT TRIGGERED: ${alert.message}`, {
      metric: alert.metric,
      value: alert.value,
      threshold: alert.threshold,
      severity: alert.severity,
    });

    // Save alert to database
    try {
      await this.supabase
        .from('system_alerts')
        .insert({
          alert_id: alert.id,
          metric: alert.metric,
          threshold: alert.threshold,
          value: alert.value,
          condition: alert.condition,
          severity: alert.severity,
          message: alert.message,
          triggered_at: alert.triggeredAt?.toISOString(),
          recipients: alert.recipients,
        });
    } catch (error) {
      console.error('Failed to save alert to database:', error);
    }
  }

  private async sendAlertResolution(alert: MetricsAlert): Promise<void> {
    console.log(`ALERT RESOLVED: ${alert.message}`, {
      metric: alert.metric,
      value: alert.value,
      resolvedAt: alert.resolvedAt,
    });
  }

  private async saveJobConfig(job: MetricsJobConfig): Promise<void> {
    // In production, would save to database
    console.log(`Job registered: ${job.name} (${job.id})`);
  }

  private async saveAlertConfig(alert: MetricsAlert): Promise<void> {
    // In production, would save to database
    console.log(`Alert registered: ${alert.metric} ${alert.condition} ${alert.threshold} (${alert.id})`);
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // =============================================
  // PUBLIC API METHODS
  // =============================================

  /**
   * Get job status
   */
  getJobStatus(jobId: string): MetricsJobConfig | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): MetricsJobConfig[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Enable/disable job
   */
  toggleJob(jobId: string, enabled: boolean): boolean {
    const job = this.jobs.get(jobId);
    if (job) {
      job.enabled = enabled;
      this.jobs.set(jobId, job);
      return true;
    }
    return false;
  }

  /**
   * Manually trigger job execution
   */
  async triggerJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'idle') {
      this.processingQueue.unshift({ jobId, priority: 3 }); // High priority
    }
  }

  /**
   * Get processing queue status
   */
  getQueueStatus(): { queueLength: number; isProcessing: boolean; nextJob?: string } {
    return {
      queueLength: this.processingQueue.length,
      isProcessing: this.isProcessing,
      nextJob: this.processingQueue[0]?.jobId,
    };
  }
}

// =============================================
// SINGLETON INSTANCE
// =============================================

const metricsProcessor = new MetricsProcessor();

export default metricsProcessor;
export { MetricsProcessor };