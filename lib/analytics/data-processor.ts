/**
 * EPIC 5 STORY 5.6: Revenue Analytics & Business Intelligence
 * Data Processor - ETL processes for metrics aggregation and transformation
 * 
 * This module provides comprehensive data processing capabilities including:
 * - ETL (Extract, Transform, Load) processes for analytics data
 * - Metrics aggregation and pre-computation for performance
 * - Data transformation and normalization
 * - Automated data quality checks and validation
 * - Incremental data processing and updates
 */

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface DataProcessingJob {
  id: string;
  type: 'daily_metrics' | 'cohort_analysis' | 'ltv_calculation' | 'churn_analysis';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  recordsProcessed: number;
  errors: string[];
  metadata: Record<string, any>;
}

export interface MetricsAggregation {
  date: string;
  metrics: {
    revenue: {
      mrr: number;
      arr: number;
      newMrr: number;
      expansionMrr: number;
      contractionMrr: number;
      churnedMrr: number;
    };
    customers: {
      total: number;
      new: number;
      churned: number;
      active: number;
    };
    subscriptions: {
      total: number;
      byPlan: Record<string, number>;
      byStatus: Record<string, number>;
    };
  };
  dataQuality: {
    completeness: number;
    accuracy: number;
    consistency: number;
    timeliness: number;
  };
}

export interface CohortProcessingResult {
  cohortMonth: string;
  customersProcessed: number;
  retentionRates: number[];
  revenueRetention: number[];
  dataPoints: number;
  processingTime: number;
}

export interface DataQualityReport {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  missingFields: Record<string, number>;
  dataAnomalies: Array<{
    type: string;
    field: string;
    count: number;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
  qualityScore: number;
}

// =============================================
// VALIDATION SCHEMAS
// =============================================

const ProcessingConfigSchema = z.object({
  startDate: z.date(),
  endDate: z.date().optional(),
  forceRefresh: z.boolean().default(false),
  batchSize: z.number().min(100).max(10000).default(1000),
  includeDataQuality: z.boolean().default(true),
});

const MetricsCalculationSchema = z.object({
  targetDate: z.date(),
  metricsTypes: z.array(z.enum(['revenue', 'customers', 'cohorts', 'ltv', 'churn'])).default(['revenue', 'customers']),
  granularity: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
});

// =============================================
// DATA PROCESSOR CLASS
// =============================================

export class DataProcessor {
  private supabase;
  private processingJobs: Map<string, DataProcessingJob> = new Map();

  constructor() {
    this.supabase = createClient();
  }

  // =============================================
  // MAIN ETL PROCESSES
  // =============================================

  /**
   * Process daily metrics for all key business metrics
   */
  async processDailyMetrics(
    config: z.infer<typeof ProcessingConfigSchema>
  ): Promise<MetricsAggregation[]> {
    const jobId = this.generateJobId('daily_metrics');
    
    try {
      const { startDate, endDate, forceRefresh, batchSize, includeDataQuality } = ProcessingConfigSchema.parse(config);
      const job = this.startJob(jobId, 'daily_metrics', { startDate, endDate, batchSize });

      const results: MetricsAggregation[] = [];
      let currentDate = new Date(startDate);
      const finalDate = endDate || new Date();

      while (currentDate <= finalDate) {
        // Check if metrics already exist for this date (unless force refresh)
        const existingMetrics = await this.getExistingMetrics(currentDate);
        if (existingMetrics && !forceRefresh) {
          results.push(existingMetrics);
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        // Extract raw data for the date
        const rawData = await this.extractDailyData(currentDate);
        
        // Transform data into metrics
        const transformedMetrics = await this.transformDailyMetrics(rawData, currentDate);
        
        // Perform data quality checks
        const dataQuality = includeDataQuality 
          ? await this.validateDataQuality(rawData)
          : { completeness: 1, accuracy: 1, consistency: 1, timeliness: 1 };

        const aggregation: MetricsAggregation = {
          date: currentDate.toISOString().split('T')[0],
          metrics: transformedMetrics,
          dataQuality: {
            completeness: dataQuality.completeness,
            accuracy: dataQuality.accuracy,
            consistency: dataQuality.consistency,
            timeliness: dataQuality.timeliness,
          },
        };

        // Load metrics into database
        await this.loadDailyMetrics(aggregation);
        results.push(aggregation);

        job.recordsProcessed += 1;
        currentDate.setDate(currentDate.getDate() + 1);
      }

      this.completeJob(jobId);
      return results;

    } catch (error) {
      this.failJob(jobId, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Process cohort analysis data for retention tracking
   */
  async processCohortAnalysis(
    config: z.infer<typeof ProcessingConfigSchema>
  ): Promise<CohortProcessingResult[]> {
    const jobId = this.generateJobId('cohort_analysis');
    
    try {
      const { startDate, endDate, batchSize } = ProcessingConfigSchema.parse(config);
      const job = this.startJob(jobId, 'cohort_analysis', { startDate, endDate });

      const results: CohortProcessingResult[] = [];
      const currentDate = new Date();
      
      // Process cohorts from startDate to current month
      let cohortMonth = new Date(startDate);
      cohortMonth.setDate(1); // First day of month

      while (cohortMonth < currentDate) {
        const processingStart = Date.now();
        
        // Get customers who joined in this cohort month
        const cohortCustomers = await this.getCohortCustomers(cohortMonth);
        
        if (cohortCustomers.length > 0) {
          // Calculate retention for each subsequent month
          const retentionData = await this.calculateCohortRetention(cohortMonth, cohortCustomers);
          
          // Store cohort data in database
          await this.saveCohortData(cohortMonth, retentionData);
          
          const processingTime = Date.now() - processingStart;
          
          results.push({
            cohortMonth: cohortMonth.toISOString().slice(0, 7),
            customersProcessed: cohortCustomers.length,
            retentionRates: retentionData.retentionRates,
            revenueRetention: retentionData.revenueRetention,
            dataPoints: retentionData.dataPoints,
            processingTime,
          });

          job.recordsProcessed += cohortCustomers.length;
        }

        // Move to next month
        cohortMonth.setMonth(cohortMonth.getMonth() + 1);
      }

      this.completeJob(jobId);
      return results;

    } catch (error) {
      this.failJob(jobId, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Process customer lifetime value calculations
   */
  async processLTVCalculations(
    config: z.infer<typeof ProcessingConfigSchema>
  ): Promise<{ customersProcessed: number; averageLTV: number; processingTime: number }> {
    const jobId = this.generateJobId('ltv_calculation');
    
    try {
      const { startDate, batchSize } = ProcessingConfigSchema.parse(config);
      const job = this.startJob(jobId, 'ltv_calculation', { startDate, batchSize });

      const processingStart = Date.now();
      
      // Get all customers that need LTV recalculation
      const customers = await this.getCustomersForLTVCalculation(startDate);
      
      let totalLTV = 0;
      let processedCount = 0;

      // Process customers in batches
      for (let i = 0; i < customers.length; i += batchSize) {
        const batch = customers.slice(i, i + batchSize);
        
        for (const customer of batch) {
          const ltv = await this.calculateCustomerLTV(customer);
          await this.saveLTVData(customer.id, ltv, startDate);
          
          totalLTV += ltv;
          processedCount++;
          job.recordsProcessed = processedCount;
        }

        // Update job progress
        await this.updateJobProgress(jobId, processedCount, customers.length);
      }

      const processingTime = Date.now() - processingStart;
      const averageLTV = processedCount > 0 ? totalLTV / processedCount : 0;

      this.completeJob(jobId);

      return {
        customersProcessed: processedCount,
        averageLTV,
        processingTime,
      };

    } catch (error) {
      this.failJob(jobId, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Process comprehensive churn analysis
   */
  async processChurnAnalysis(
    config: z.infer<typeof ProcessingConfigSchema>
  ): Promise<{ churnRate: number; patterns: any[]; predictiveScores: number }> {
    const jobId = this.generateJobId('churn_analysis');
    
    try {
      const { startDate, endDate } = ProcessingConfigSchema.parse(config);
      const job = this.startJob(jobId, 'churn_analysis', { startDate, endDate });

      const finalDate = endDate || new Date();
      
      // Get churned customers in the period
      const churnedCustomers = await this.getChurnedCustomers(startDate, finalDate);
      
      // Get active customers at start of period
      const activeCustomers = await this.getActiveCustomersAtDate(startDate);
      
      // Calculate churn rate
      const churnRate = activeCustomers.length > 0 ? churnedCustomers.length / activeCustomers.length : 0;
      
      // Analyze churn patterns
      const patterns = await this.analyzeChurnPatterns(churnedCustomers);
      
      // Generate predictive churn scores for active customers
      const predictiveScores = await this.generateChurnPredictionScores(activeCustomers);
      
      // Save churn analysis results
      await this.saveChurnAnalysis({
        periodStart: startDate,
        periodEnd: finalDate,
        churnRate,
        patterns,
        totalChurned: churnedCustomers.length,
        totalActive: activeCustomers.length,
      });

      job.recordsProcessed = churnedCustomers.length + activeCustomers.length;
      this.completeJob(jobId);

      return {
        churnRate,
        patterns,
        predictiveScores: predictiveScores.length,
      };

    } catch (error) {
      this.failJob(jobId, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  // =============================================
  // DATA EXTRACTION METHODS
  // =============================================

  /**
   * Extract raw data for a specific date
   */
  private async extractDailyData(date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Extract subscription data
    const { data: subscriptions } = await this.supabase
      .from('subscriptions')
      .select(`
        *,
        customer:stripe_customers(*),
        plan:subscription_plans(*)
      `)
      .or(`created_at.gte.${startOfDay.toISOString()},canceled_at.gte.${startOfDay.toISOString()},updated_at.gte.${startOfDay.toISOString()}`)
      .lte('created_at', endOfDay.toISOString());

    // Extract payment data
    const { data: transactions } = await this.supabase
      .from('payment_transactions')
      .select('*')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString());

    // Extract customer data
    const { data: customers } = await this.supabase
      .from('stripe_customers')
      .select('*')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString());

    return {
      subscriptions: subscriptions || [],
      transactions: transactions || [],
      customers: customers || [],
      extractionDate: date,
    };
  }

  // =============================================
  // DATA TRANSFORMATION METHODS
  // =============================================

  /**
   * Transform raw data into daily metrics
   */
  private async transformDailyMetrics(rawData: any, date: Date) {
    // Calculate revenue metrics
    const revenue = await this.calculateRevenueMetrics(rawData, date);
    
    // Calculate customer metrics
    const customers = await this.calculateCustomerMetrics(rawData, date);
    
    // Calculate subscription metrics
    const subscriptions = await this.calculateSubscriptionMetrics(rawData, date);

    return {
      revenue,
      customers,
      subscriptions,
    };
  }

  /**
   * Calculate revenue metrics from raw data
   */
  private async calculateRevenueMetrics(rawData: any, date: Date) {
    // Get current MRR
    const mrr = await this.supabase.rpc('calculate_mrr_for_date', {
      target_date: date.toISOString().split('T')[0]
    });

    // Calculate MRR components
    let newMrr = 0;
    let expansionMrr = 0;
    let contractionMrr = 0;
    let churnedMrr = 0;

    for (const subscription of rawData.subscriptions) {
      const monthlyAmount = subscription.plan?.interval === 'year' 
        ? (subscription.plan?.amount || 0) / 12 
        : (subscription.plan?.amount || 0);

      if (subscription.created_at && new Date(subscription.created_at).toDateString() === date.toDateString()) {
        newMrr += monthlyAmount;
      }

      if (subscription.canceled_at && new Date(subscription.canceled_at).toDateString() === date.toDateString()) {
        churnedMrr += monthlyAmount;
      }
    }

    return {
      mrr: mrr.data || 0,
      arr: (mrr.data || 0) * 12,
      newMrr,
      expansionMrr,
      contractionMrr,
      churnedMrr,
    };
  }

  /**
   * Calculate customer metrics from raw data
   */
  private async calculateCustomerMetrics(rawData: any, date: Date) {
    // Count active customers at date
    const { count: totalActive } = await this.supabase
      .from('subscriptions')
      .select('customer_id', { count: 'exact', head: true })
      .in('status', ['active', 'trialing'])
      .lte('created_at', date.toISOString())
      .or(`canceled_at.is.null,canceled_at.gt.${date.toISOString()}`);

    // Count new customers on date
    const newCustomers = rawData.customers.length;

    // Count churned customers on date
    const churnedCustomers = rawData.subscriptions.filter((sub: any) => 
      sub.canceled_at && new Date(sub.canceled_at).toDateString() === date.toDateString()
    ).length;

    return {
      total: totalActive || 0,
      new: newCustomers,
      churned: churnedCustomers,
      active: totalActive || 0,
    };
  }

  /**
   * Calculate subscription metrics from raw data
   */
  private async calculateSubscriptionMetrics(rawData: any, date: Date) {
    const { count: totalSubscriptions } = await this.supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .lte('created_at', date.toISOString())
      .or(`canceled_at.is.null,canceled_at.gt.${date.toISOString()}`);

    // Group by plan
    const byPlan: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const subscription of rawData.subscriptions) {
      const planName = subscription.plan?.name || 'Unknown';
      const status = subscription.status || 'unknown';

      byPlan[planName] = (byPlan[planName] || 0) + 1;
      byStatus[status] = (byStatus[status] || 0) + 1;
    }

    return {
      total: totalSubscriptions || 0,
      byPlan,
      byStatus,
    };
  }

  // =============================================
  // DATA LOADING METHODS
  // =============================================

  /**
   * Load processed metrics into database
   */
  private async loadDailyMetrics(aggregation: MetricsAggregation) {
    const { date, metrics, dataQuality } = aggregation;

    await this.supabase
      .from('billing_metrics')
      .upsert({
        date: date,
        mrr: metrics.revenue.mrr,
        arr: metrics.revenue.arr,
        new_mrr: metrics.revenue.newMrr,
        expansion_mrr: metrics.revenue.expansionMrr,
        contraction_mrr: metrics.revenue.contractionMrr,
        churned_mrr: metrics.revenue.churnedMrr,
        total_customers: metrics.customers.total,
        new_customers: metrics.customers.new,
        churned_customers: metrics.customers.churned,
        active_subscribers: metrics.customers.active,
        data_quality_score: Math.min(
          dataQuality.completeness,
          dataQuality.accuracy,
          dataQuality.consistency,
          dataQuality.timeliness
        ),
        calculated_at: new Date().toISOString(),
      })
      .select();
  }

  // =============================================
  // DATA QUALITY METHODS
  // =============================================

  /**
   * Validate data quality for processed data
   */
  private async validateDataQuality(rawData: any): Promise<DataQualityReport> {
    const totalRecords = rawData.subscriptions.length + rawData.transactions.length + rawData.customers.length;
    let validRecords = 0;
    let invalidRecords = 0;
    const missingFields: Record<string, number> = {};
    const dataAnomalies: any[] = [];

    // Validate subscriptions
    for (const subscription of rawData.subscriptions) {
      let isValid = true;

      if (!subscription.customer_id) {
        missingFields['customer_id'] = (missingFields['customer_id'] || 0) + 1;
        isValid = false;
      }

      if (!subscription.plan_id) {
        missingFields['plan_id'] = (missingFields['plan_id'] || 0) + 1;
        isValid = false;
      }

      if (!subscription.status) {
        missingFields['status'] = (missingFields['status'] || 0) + 1;
        isValid = false;
      }

      // Check for anomalies
      if (subscription.plan?.amount && subscription.plan.amount < 0) {
        dataAnomalies.push({
          type: 'negative_amount',
          field: 'plan.amount',
          count: 1,
          severity: 'high' as const,
          description: 'Subscription has negative amount',
        });
        isValid = false;
      }

      if (isValid) {
        validRecords++;
      } else {
        invalidRecords++;
      }
    }

    const qualityScore = totalRecords > 0 ? validRecords / totalRecords : 1;

    return {
      totalRecords,
      validRecords,
      invalidRecords,
      missingFields,
      dataAnomalies,
      qualityScore,
    };
  }

  // =============================================
  // HELPER METHODS
  // =============================================

  private generateJobId(type: string): string {
    return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startJob(id: string, type: DataProcessingJob['type'], metadata: any): DataProcessingJob {
    const job: DataProcessingJob = {
      id,
      type,
      status: 'running',
      startTime: new Date(),
      recordsProcessed: 0,
      errors: [],
      metadata,
    };

    this.processingJobs.set(id, job);
    return job;
  }

  private completeJob(id: string) {
    const job = this.processingJobs.get(id);
    if (job) {
      job.status = 'completed';
      job.endTime = new Date();
    }
  }

  private failJob(id: string, error: string) {
    const job = this.processingJobs.get(id);
    if (job) {
      job.status = 'failed';
      job.endTime = new Date();
      job.errors.push(error);
    }
  }

  private async updateJobProgress(id: string, processed: number, total: number) {
    const job = this.processingJobs.get(id);
    if (job) {
      job.recordsProcessed = processed;
      job.metadata.progress = total > 0 ? (processed / total) * 100 : 0;
    }
  }

  private async getExistingMetrics(date: Date): Promise<MetricsAggregation | null> {
    const { data } = await this.supabase
      .from('billing_metrics')
      .select('*')
      .eq('date', date.toISOString().split('T')[0])
      .single();

    if (!data) return null;

    return {
      date: data.date,
      metrics: {
        revenue: {
          mrr: data.mrr,
          arr: data.arr,
          newMrr: data.new_mrr,
          expansionMrr: data.expansion_mrr,
          contractionMrr: data.contraction_mrr,
          churnedMrr: data.churned_mrr,
        },
        customers: {
          total: data.total_customers,
          new: data.new_customers,
          churned: data.churned_customers,
          active: data.active_subscribers,
        },
        subscriptions: {
          total: data.active_subscribers,
          byPlan: {},
          byStatus: {},
        },
      },
      dataQuality: {
        completeness: data.data_quality_score || 1,
        accuracy: data.data_quality_score || 1,
        consistency: data.data_quality_score || 1,
        timeliness: data.data_quality_score || 1,
      },
    };
  }

  private async getCohortCustomers(cohortMonth: Date) {
    const monthEnd = new Date(cohortMonth);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    const { data } = await this.supabase
      .from('subscriptions')
      .select(`
        customer_id,
        created_at,
        canceled_at,
        plan:subscription_plans(amount, interval)
      `)
      .gte('created_at', cohortMonth.toISOString())
      .lt('created_at', monthEnd.toISOString())
      .order('created_at');

    return data || [];
  }

  private async calculateCohortRetention(cohortMonth: Date, cohortCustomers: any[]) {
    const retentionRates: number[] = [];
    const revenueRetention: number[] = [];
    const initialRevenue = cohortCustomers.reduce((sum, customer) => {
      const monthlyAmount = customer.plan?.interval === 'year' 
        ? (customer.plan?.amount || 0) / 12 
        : (customer.plan?.amount || 0);
      return sum + monthlyAmount;
    }, 0);

    const currentDate = new Date();
    const maxMonths = Math.min(12, Math.floor((currentDate.getTime() - cohortMonth.getTime()) / (1000 * 60 * 60 * 24 * 30)));

    for (let month = 1; month <= maxMonths; month++) {
      const targetDate = new Date(cohortMonth);
      targetDate.setMonth(targetDate.getMonth() + month);

      let activeCustomers = 0;
      let activeRevenue = 0;

      for (const customer of cohortCustomers) {
        const canceledAt = customer.canceled_at ? new Date(customer.canceled_at) : null;
        if (!canceledAt || canceledAt > targetDate) {
          activeCustomers++;
          const monthlyAmount = customer.plan?.interval === 'year' 
            ? (customer.plan?.amount || 0) / 12 
            : (customer.plan?.amount || 0);
          activeRevenue += monthlyAmount;
        }
      }

      const retentionRate = (activeCustomers / cohortCustomers.length) * 100;
      const revenueRetentionRate = initialRevenue > 0 ? (activeRevenue / initialRevenue) * 100 : 0;

      retentionRates.push(retentionRate);
      revenueRetention.push(revenueRetentionRate);
    }

    return {
      retentionRates,
      revenueRetention,
      dataPoints: maxMonths,
    };
  }

  private async saveCohortData(cohortMonth: Date, retentionData: any) {
    // Save to customer_cohorts table for each month of retention data
    for (let i = 0; i < retentionData.retentionRates.length; i++) {
      const analysisMonth = new Date(cohortMonth);
      analysisMonth.setMonth(analysisMonth.getMonth() + i + 1);

      await this.supabase
        .from('customer_cohorts')
        .upsert({
          cohort_month: cohortMonth.toISOString().split('T')[0],
          analysis_month: analysisMonth.toISOString().split('T')[0],
          customer_retention_rate: retentionData.retentionRates[i] / 100,
          revenue_retention_rate: retentionData.revenueRetention[i] / 100,
          cohort_age_months: i + 1,
        })
        .select();
    }
  }

  private async getCustomersForLTVCalculation(sinceDate: Date) {
    const { data } = await this.supabase
      .from('stripe_customers')
      .select(`
        *,
        subscriptions(
          *,
          plan:subscription_plans(*)
        )
      `)
      .gte('created_at', sinceDate.toISOString())
      .order('created_at');

    return data || [];
  }

  private async calculateCustomerLTV(customer: any): Promise<number> {
    let totalRevenue = 0;

    for (const subscription of customer.subscriptions || []) {
      const startDate = new Date(subscription.created_at);
      const endDate = subscription.canceled_at ? new Date(subscription.canceled_at) : new Date();
      
      const monthsDuration = Math.max(1, Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      ));

      const monthlyAmount = subscription.plan?.interval === 'year' 
        ? (subscription.plan?.amount || 0) / 12 
        : (subscription.plan?.amount || 0);

      totalRevenue += monthlyAmount * monthsDuration;
    }

    return totalRevenue;
  }

  private async saveLTVData(customerId: string, ltv: number, calculationDate: Date) {
    await this.supabase
      .from('customer_ltv_analysis')
      .upsert({
        customer_id: customerId,
        calculation_date: calculationDate.toISOString().split('T')[0],
        current_ltv: ltv,
        predicted_ltv: ltv * 1.2, // Simplified prediction
      })
      .select();
  }

  private async getChurnedCustomers(startDate: Date, endDate: Date) {
    const { data } = await this.supabase
      .from('subscriptions')
      .select(`
        *,
        customer:stripe_customers(*),
        plan:subscription_plans(*)
      `)
      .eq('status', 'canceled')
      .gte('canceled_at', startDate.toISOString())
      .lt('canceled_at', endDate.toISOString());

    return data || [];
  }

  private async getActiveCustomersAtDate(date: Date) {
    const { data } = await this.supabase
      .from('subscriptions')
      .select('customer_id')
      .in('status', ['active', 'trialing'])
      .lt('created_at', date.toISOString())
      .or(`canceled_at.is.null,canceled_at.gt.${date.toISOString()}`);

    return data || [];
  }

  private async analyzeChurnPatterns(churnedCustomers: any[]) {
    const patterns: any[] = [];
    const reasonMap = new Map();

    for (const subscription of churnedCustomers) {
      const reason = subscription.metadata?.cancellation_reason || 'unknown';
      reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
    }

    Array.from(reasonMap.entries()).forEach(([reason, count]) => {
      patterns.push({
        pattern: reason,
        frequency: count,
        percentage: (count / churnedCustomers.length) * 100,
      });
    });

    return patterns;
  }

  private async generateChurnPredictionScores(activeCustomers: any[]): Promise<any[]> {
    const scores: any[] = [];

    for (const customer of activeCustomers) {
      // Simplified churn prediction based on subscription age
      const subscriptionAge = Math.ceil(
        (new Date().getTime() - new Date(customer.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Risk factors: very new customers or very old customers
      let riskScore = 0.2; // Base risk
      if (subscriptionAge < 30) riskScore += 0.4; // New customer risk
      if (subscriptionAge > 365) riskScore += 0.3; // Long-term customer risk

      scores.push({
        customerId: customer.customer_id,
        riskScore: Math.min(1, riskScore),
        factors: ['subscription_age'],
      });
    }

    return scores;
  }

  private async saveChurnAnalysis(analysisData: any) {
    await this.supabase
      .from('churn_analysis')
      .upsert({
        analysis_period_start: analysisData.periodStart.toISOString().split('T')[0],
        analysis_period_end: analysisData.periodEnd.toISOString().split('T')[0],
        customer_churn_rate: analysisData.churnRate,
        churned_customers: analysisData.totalChurned,
        total_customers_start: analysisData.totalActive,
        churn_reasons: JSON.stringify(analysisData.patterns),
      })
      .select();
  }

  /**
   * Get processing job status
   */
  getJobStatus(jobId: string): DataProcessingJob | undefined {
    return this.processingJobs.get(jobId);
  }

  /**
   * Get all processing jobs
   */
  getAllJobs(): DataProcessingJob[] {
    return Array.from(this.processingJobs.values());
  }

  /**
   * Clear completed jobs from memory
   */
  clearCompletedJobs() {
    for (const [id, job] of this.processingJobs.entries()) {
      if (job.status === 'completed' || job.status === 'failed') {
        this.processingJobs.delete(id);
      }
    }
  }
}

// =============================================
// SINGLETON INSTANCE
// =============================================

const dataProcessor = new DataProcessor();

export default dataProcessor;
export { DataProcessor };