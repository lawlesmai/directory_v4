/**
 * EPIC 5 STORY 5.2: Subscription Management & Billing System
 * Subscription Analytics Service - Advanced analytics and forecasting
 * 
 * This service provides comprehensive subscription analytics including:
 * - MRR/ARR calculations and tracking
 * - Cohort analysis and retention metrics
 * - Churn prediction and analysis
 * - Revenue forecasting and projections
 * - Customer lifetime value calculations
 * - Conversion funnel analytics
 */

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface MRRBreakdown {
  currentMRR: number;
  previousMRR: number;
  mrrGrowth: number;
  mrrGrowthRate: number;
  newMRR: number;
  expansionMRR: number;
  contractionMRR: number;
  churnedMRR: number;
  netNewMRR: number;
}

export interface ARRMetrics {
  currentARR: number;
  projectedARR: number;
  arrGrowthRate: number;
  averageContractValue: number;
  customerCount: number;
}

export interface ChurnAnalysis {
  period: string;
  customerChurn: {
    rate: number;
    count: number;
    totalCustomers: number;
  };
  revenueChurn: {
    rate: number;
    amount: number;
    totalRevenue: number;
  };
  voluntaryChurn: number;
  involuntaryChurn: number;
  churnReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
}

export interface CohortData {
  cohortMonth: string;
  initialCustomers: number;
  retentionRates: number[]; // indexed by month (0 = month 1, 1 = month 2, etc.)
  revenueRetention: number[];
  averageRevenue: number[];
}

export interface ConversionFunnel {
  trialStarts: number;
  trialToActive: number;
  trialToPaid: number;
  conversionRate: number;
  averageTrialDuration: number;
  topConversionSources: Array<{
    source: string;
    conversions: number;
    rate: number;
  }>;
}

export interface CustomerLifetimeValue {
  averageCLV: number;
  medianCLV: number;
  clvByPlan: Array<{
    planName: string;
    clv: number;
  }>;
  paybackPeriod: number; // in months
  ltvrRatio: number; // LTV to CAC ratio
}

export interface RevenueForecasting {
  period: 'monthly' | 'quarterly' | 'yearly';
  forecastMonths: number;
  projectedRevenue: Array<{
    period: string;
    projected: number;
    confidence: number; // 0-100%
    lowerBound: number;
    upperBound: number;
  }>;
  assumptions: {
    churnRate: number;
    growthRate: number;
    averageRevenue: number;
  };
}

// =============================================
// VALIDATION SCHEMAS
// =============================================

const AnalyticsPeriodSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
  granularity: z.enum(['day', 'week', 'month', 'quarter', 'year']).default('month'),
});

const ForecastingSchema = z.object({
  period: z.enum(['monthly', 'quarterly', 'yearly']).default('monthly'),
  forecastMonths: z.number().min(1).max(24).default(12),
  confidenceLevel: z.number().min(50).max(99).default(95),
});

// =============================================
// SUBSCRIPTION ANALYTICS SERVICE
// =============================================

class SubscriptionAnalytics {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  // =============================================
  // MRR/ARR CALCULATIONS
  // =============================================

  /**
   * Calculate Monthly Recurring Revenue breakdown
   */
  async calculateMRR(targetMonth?: Date): Promise<MRRBreakdown> {
    try {
      const currentMonth = targetMonth || new Date();
      const previousMonth = new Date(currentMonth);
      previousMonth.setMonth(previousMonth.getMonth() - 1);

      // Get current month's MRR
      const currentMRR = await this.getMRRForMonth(currentMonth);
      const previousMRR = await this.getMRRForMonth(previousMonth);

      // Calculate MRR movement components
      const mrrMovement = await this.calculateMRRMovement(previousMonth, currentMonth);

      const mrrGrowth = currentMRR - previousMRR;
      const mrrGrowthRate = previousMRR > 0 ? (mrrGrowth / previousMRR) * 100 : 0;

      return {
        currentMRR,
        previousMRR,
        mrrGrowth,
        mrrGrowthRate,
        newMRR: mrrMovement.newMRR,
        expansionMRR: mrrMovement.expansionMRR,
        contractionMRR: mrrMovement.contractionMRR,
        churnedMRR: mrrMovement.churnedMRR,
        netNewMRR: mrrMovement.newMRR + mrrMovement.expansionMRR - mrrMovement.contractionMRR - mrrMovement.churnedMRR,
      };
    } catch (error) {
      console.error('Calculate MRR error:', error);
      throw new Error(`Failed to calculate MRR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate Annual Recurring Revenue metrics
   */
  async calculateARR(targetDate?: Date): Promise<ARRMetrics> {
    try {
      const currentDate = targetDate || new Date();
      const mrr = await this.getMRRForMonth(currentDate);
      
      // Get previous year's ARR for growth calculation
      const previousYear = new Date(currentDate);
      previousYear.setFullYear(previousYear.getFullYear() - 1);
      const previousARR = (await this.getMRRForMonth(previousYear)) * 12;

      const currentARR = mrr * 12;
      const arrGrowthRate = previousARR > 0 ? ((currentARR - previousARR) / previousARR) * 100 : 0;

      // Get average contract value and customer count
      const { data: subscriptions } = await this.supabase
        .from('subscriptions')
        .select(`
          *,
          plan:subscription_plans(amount, interval)
        `)
        .in('status', ['active', 'trialing']);

      const customerCount = subscriptions?.length || 0;
      const totalContractValue = subscriptions?.reduce((sum, sub) => {
        const monthlyValue = sub.plan?.interval === 'year' 
          ? sub.plan.amount / 12 
          : sub.plan.amount || 0;
        return sum + monthlyValue;
      }, 0) || 0;

      const averageContractValue = customerCount > 0 ? (totalContractValue * 12) / customerCount : 0;

      return {
        currentARR,
        projectedARR: currentARR * (1 + arrGrowthRate / 100),
        arrGrowthRate,
        averageContractValue,
        customerCount,
      };
    } catch (error) {
      console.error('Calculate ARR error:', error);
      throw new Error(`Failed to calculate ARR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get MRR trend over time
   */
  async getMRRTrend(months: number = 12): Promise<Array<{ month: string; mrr: number }>> {
    try {
      const trend = [];
      const currentDate = new Date();

      for (let i = months - 1; i >= 0; i--) {
        const targetMonth = new Date(currentDate);
        targetMonth.setMonth(targetMonth.getMonth() - i);
        
        const mrr = await this.getMRRForMonth(targetMonth);
        
        trend.push({
          month: targetMonth.toISOString().slice(0, 7), // YYYY-MM format
          mrr,
        });
      }

      return trend;
    } catch (error) {
      console.error('Get MRR trend error:', error);
      return [];
    }
  }

  // =============================================
  // CHURN ANALYSIS
  // =============================================

  /**
   * Analyze churn rates and patterns
   */
  async analyzeChurn(period: z.infer<typeof AnalyticsPeriodSchema>): Promise<ChurnAnalysis> {
    try {
      const { startDate, endDate } = AnalyticsPeriodSchema.parse(period);

      // Get churned subscriptions in period
      const { data: churnedSubs } = await this.supabase
        .from('subscriptions')
        .select(`
          *,
          plan:subscription_plans(amount),
          customer:stripe_customers(*)
        `)
        .in('status', ['canceled'])
        .gte('canceled_at', startDate.toISOString())
        .lt('canceled_at', endDate.toISOString());

      // Get total active subscriptions at start of period
      const { count: totalCustomers } = await this.supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .in('status', ['active', 'trialing'])
        .lt('created_at', startDate.toISOString());

      // Calculate churn metrics
      const churnedCount = churnedSubs?.length || 0;
      const customerChurnRate = totalCustomers ? (churnedCount / totalCustomers) * 100 : 0;

      // Calculate revenue churn
      const totalRevenue = await this.getMRRForMonth(startDate);
      const churnedRevenue = churnedSubs?.reduce((sum, sub) => {
        const monthlyAmount = sub.plan?.amount || 0;
        return sum + monthlyAmount;
      }, 0) || 0;

      const revenueChurnRate = totalRevenue > 0 ? (churnedRevenue / totalRevenue) * 100 : 0;

      // Analyze churn reasons (from metadata or cancellation surveys)
      const churnReasons = this.analyzeChurnReasons(churnedSubs || []);

      // Calculate voluntary vs involuntary churn
      const voluntaryChurn = churnedSubs?.filter(sub => 
        sub.metadata?.cancellation_reason !== 'payment_failed'
      ).length || 0;
      const involuntaryChurn = churnedCount - voluntaryChurn;

      return {
        period: `${startDate.toISOString().slice(0, 7)} to ${endDate.toISOString().slice(0, 7)}`,
        customerChurn: {
          rate: customerChurnRate,
          count: churnedCount,
          totalCustomers: totalCustomers || 0,
        },
        revenueChurn: {
          rate: revenueChurnRate,
          amount: churnedRevenue,
          totalRevenue,
        },
        voluntaryChurn: (voluntaryChurn / churnedCount) * 100,
        involuntaryChurn: (involuntaryChurn / churnedCount) * 100,
        churnReasons,
      };
    } catch (error) {
      console.error('Analyze churn error:', error);
      throw new Error(`Failed to analyze churn: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // COHORT ANALYSIS
  // =============================================

  /**
   * Generate cohort analysis data
   */
  async generateCohortAnalysis(months: number = 12): Promise<CohortData[]> {
    try {
      const cohorts: CohortData[] = [];
      const currentDate = new Date();

      for (let i = months - 1; i >= 0; i--) {
        const cohortMonth = new Date(currentDate);
        cohortMonth.setMonth(cohortMonth.getMonth() - i);
        cohortMonth.setDate(1); // First day of month

        const cohortData = await this.getCohortData(cohortMonth);
        cohorts.push(cohortData);
      }

      return cohorts;
    } catch (error) {
      console.error('Generate cohort analysis error:', error);
      return [];
    }
  }

  /**
   * Get cohort data for specific month
   */
  private async getCohortData(cohortMonth: Date): Promise<CohortData> {
    const monthEnd = new Date(cohortMonth);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    // Get customers who started in this cohort month
    const { data: cohortCustomers } = await this.supabase
      .from('subscriptions')
      .select(`
        id,
        customer_id,
        created_at,
        canceled_at,
        plan:subscription_plans(amount)
      `)
      .gte('created_at', cohortMonth.toISOString())
      .lt('created_at', monthEnd.toISOString());

    const initialCustomers = cohortCustomers?.length || 0;
    const retentionRates: number[] = [];
    const revenueRetention: number[] = [];
    const averageRevenue: number[] = [];

    if (initialCustomers === 0) {
      return {
        cohortMonth: cohortMonth.toISOString().slice(0, 7),
        initialCustomers: 0,
        retentionRates: [],
        revenueRetention: [],
        averageRevenue: [],
      };
    }

    const initialRevenue = cohortCustomers?.reduce((sum, sub) => sum + (sub.plan?.amount || 0), 0) || 0;

    // Calculate retention for each subsequent month
    const currentDate = new Date();
    let monthsToAnalyze = Math.min(12, Math.floor((currentDate.getTime() - cohortMonth.getTime()) / (1000 * 60 * 60 * 24 * 30)));

    for (let month = 1; month <= monthsToAnalyze; month++) {
      const targetMonth = new Date(cohortMonth);
      targetMonth.setMonth(targetMonth.getMonth() + month);

      let activeCustomers = 0;
      let activeRevenue = 0;

      for (const customer of cohortCustomers || []) {
        // Check if customer was still active in target month
        const canceledAt = customer.canceled_at ? new Date(customer.canceled_at) : null;
        if (!canceledAt || canceledAt > targetMonth) {
          activeCustomers++;
          activeRevenue += customer.plan?.amount || 0;
        }
      }

      const retentionRate = (activeCustomers / initialCustomers) * 100;
      const revenueRetentionRate = initialRevenue > 0 ? (activeRevenue / initialRevenue) * 100 : 0;
      const avgRevenue = activeCustomers > 0 ? activeRevenue / activeCustomers : 0;

      retentionRates.push(retentionRate);
      revenueRetention.push(revenueRetentionRate);
      averageRevenue.push(avgRevenue);
    }

    return {
      cohortMonth: cohortMonth.toISOString().slice(0, 7),
      initialCustomers,
      retentionRates,
      revenueRetention,
      averageRevenue,
    };
  }

  // =============================================
  // CONVERSION ANALYTICS
  // =============================================

  /**
   * Analyze trial-to-paid conversion funnel
   */
  async analyzeConversionFunnel(period: z.infer<typeof AnalyticsPeriodSchema>): Promise<ConversionFunnel> {
    try {
      const { startDate, endDate } = AnalyticsPeriodSchema.parse(period);

      // Get trial subscriptions started in period
      const { data: trialSubs } = await this.supabase
        .from('subscriptions')
        .select(`
          *,
          customer:stripe_customers(metadata)
        `)
        .gte('trial_start', startDate.toISOString())
        .lt('trial_start', endDate.toISOString());

      const trialStarts = trialSubs?.length || 0;

      // Count conversions to active/paid status
      const trialToActive = trialSubs?.filter(sub => 
        ['active'].includes(sub.status)
      ).length || 0;

      const trialToPaid = trialSubs?.filter(sub => 
        ['active'].includes(sub.status) && !sub.trial_end
      ).length || 0;

      const conversionRate = trialStarts > 0 ? (trialToPaid / trialStarts) * 100 : 0;

      // Calculate average trial duration
      let totalTrialDuration = 0;
      let trialsWithDuration = 0;

      for (const sub of trialSubs || []) {
        if (sub.trial_start && sub.trial_end) {
          const start = new Date(sub.trial_start);
          const end = new Date(sub.trial_end);
          const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          totalTrialDuration += duration;
          trialsWithDuration++;
        }
      }

      const averageTrialDuration = trialsWithDuration > 0 ? totalTrialDuration / trialsWithDuration : 14;

      // Analyze conversion sources
      const sourceCounts = new Map<string, { conversions: number; total: number }>();

      for (const sub of trialSubs || []) {
        const source = sub.customer?.metadata?.acquisition_source || 'unknown';
        const isConverted = ['active'].includes(sub.status) && !sub.trial_end;

        if (!sourceCounts.has(source)) {
          sourceCounts.set(source, { conversions: 0, total: 0 });
        }

        const sourceData = sourceCounts.get(source)!;
        sourceData.total++;
        if (isConverted) {
          sourceData.conversions++;
        }
      }

      const topConversionSources = Array.from(sourceCounts.entries())
        .map(([source, data]) => ({
          source,
          conversions: data.conversions,
          rate: data.total > 0 ? (data.conversions / data.total) * 100 : 0,
        }))
        .sort((a, b) => b.rate - a.rate)
        .slice(0, 5);

      return {
        trialStarts,
        trialToActive,
        trialToPaid,
        conversionRate,
        averageTrialDuration,
        topConversionSources,
      };
    } catch (error) {
      console.error('Analyze conversion funnel error:', error);
      throw new Error(`Failed to analyze conversion funnel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // CUSTOMER LIFETIME VALUE
  // =============================================

  /**
   * Calculate Customer Lifetime Value metrics
   */
  async calculateCLV(): Promise<CustomerLifetimeValue> {
    try {
      // Get all customers with their subscription history
      const { data: customers } = await this.supabase
        .from('stripe_customers')
        .select(`
          *,
          subscriptions:subscriptions(
            *,
            plan:subscription_plans(*)
          )
        `);

      if (!customers) {
        throw new Error('No customer data found');
      }

      const clvValues: number[] = [];
      const clvByPlan = new Map<string, number[]>();

      for (const customer of customers) {
        let customerCLV = 0;
        
        for (const subscription of customer.subscriptions || []) {
          const monthlyValue = subscription.plan?.amount || 0;
          
          // Calculate subscription duration in months
          const startDate = new Date(subscription.created_at);
          const endDate = subscription.canceled_at 
            ? new Date(subscription.canceled_at)
            : new Date(); // Still active
          
          const durationMonths = Math.ceil(
            (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
          );

          const subscriptionValue = monthlyValue * durationMonths;
          customerCLV += subscriptionValue;

          // Track CLV by plan
          const planName = subscription.plan?.name || 'Unknown';
          if (!clvByPlan.has(planName)) {
            clvByPlan.set(planName, []);
          }
          clvByPlan.get(planName)!.push(subscriptionValue);
        }

        if (customerCLV > 0) {
          clvValues.push(customerCLV);
        }
      }

      // Calculate statistics
      const averageCLV = clvValues.length > 0 
        ? clvValues.reduce((sum, val) => sum + val, 0) / clvValues.length 
        : 0;

      const sortedCLV = [...clvValues].sort((a, b) => a - b);
      const medianCLV = sortedCLV.length > 0 
        ? sortedCLV[Math.floor(sortedCLV.length / 2)] 
        : 0;

      // Calculate CLV by plan
      const clvByPlanResults = Array.from(clvByPlan.entries()).map(([planName, values]) => ({
        planName,
        clv: values.reduce((sum, val) => sum + val, 0) / values.length,
      }));

      // Estimate payback period (simplified)
      const averageMonthlyRevenue = await this.getMRRForMonth(new Date());
      const totalCustomers = customers.length;
      const averageRevenuePerCustomer = totalCustomers > 0 ? averageMonthlyRevenue / totalCustomers : 0;
      
      // Assume CAC is 3x monthly revenue (this should come from marketing data)
      const estimatedCAC = averageRevenuePerCustomer * 3;
      const paybackPeriod = estimatedCAC > 0 ? averageRevenuePerCustomer / estimatedCAC : 0;
      const ltvrRatio = estimatedCAC > 0 ? averageCLV / estimatedCAC : 0;

      return {
        averageCLV: averageCLV / 100, // Convert from cents to dollars
        medianCLV: medianCLV / 100,
        clvByPlan: clvByPlanResults.map(p => ({ ...p, clv: p.clv / 100 })),
        paybackPeriod,
        ltvrRatio,
      };
    } catch (error) {
      console.error('Calculate CLV error:', error);
      throw new Error(`Failed to calculate CLV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // REVENUE FORECASTING
  // =============================================

  /**
   * Generate revenue forecasting projections
   */
  async forecastRevenue(config: z.infer<typeof ForecastingSchema>): Promise<RevenueForecasting> {
    try {
      const { period, forecastMonths, confidenceLevel } = ForecastingSchema.parse(config);

      // Get historical data for trend analysis
      const historicalMonths = Math.min(12, forecastMonths);
      const mrrTrend = await this.getMRRTrend(historicalMonths);
      
      if (mrrTrend.length === 0) {
        throw new Error('Insufficient historical data for forecasting');
      }

      // Calculate growth rate from historical data
      const recentMRR = mrrTrend[mrrTrend.length - 1].mrr;
      const olderMRR = mrrTrend[0].mrr;
      const monthsSpan = mrrTrend.length - 1;
      const monthlyGrowthRate = monthsSpan > 0 && olderMRR > 0 
        ? Math.pow(recentMRR / olderMRR, 1 / monthsSpan) - 1 
        : 0;

      // Get churn rate
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const churnAnalysis = await this.analyzeChurn({
        startDate: lastMonth,
        endDate: new Date(),
      });

      // Generate projections
      const projectedRevenue = [];
      const currentDate = new Date();

      for (let i = 1; i <= forecastMonths; i++) {
        const projectionMonth = new Date(currentDate);
        projectionMonth.setMonth(projectionMonth.getMonth() + i);

        // Simple growth model with churn consideration
        const projectedMRR = recentMRR * Math.pow(1 + monthlyGrowthRate, i) * Math.pow(1 - churnAnalysis.customerChurn.rate / 100, i);
        
        // Calculate confidence interval
        const variance = Math.pow(monthlyGrowthRate * 0.5, 2); // Simplified variance
        const stdError = Math.sqrt(variance * i);
        const zScore = confidenceLevel === 95 ? 1.96 : confidenceLevel === 90 ? 1.64 : 1.28;
        
        const marginOfError = zScore * stdError * projectedMRR;
        
        const projectionData = {
          period: projectionMonth.toISOString().slice(0, 7),
          projected: Math.max(0, projectedMRR),
          confidence: confidenceLevel,
          lowerBound: Math.max(0, projectedMRR - marginOfError),
          upperBound: projectedMRR + marginOfError,
        };

        projectedRevenue.push(projectionData);
      }

      return {
        period,
        forecastMonths,
        projectedRevenue,
        assumptions: {
          churnRate: churnAnalysis.customerChurn.rate,
          growthRate: monthlyGrowthRate * 100,
          averageRevenue: recentMRR,
        },
      };
    } catch (error) {
      console.error('Forecast revenue error:', error);
      throw new Error(`Failed to forecast revenue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  /**
   * Get MRR for specific month
   */
  private async getMRRForMonth(targetMonth: Date): Promise<number> {
    const monthStart = new Date(targetMonth);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    // Get all active subscriptions during the target month
    const { data: subscriptions } = await this.supabase
      .from('subscriptions')
      .select(`
        *,
        plan:subscription_plans(amount, interval)
      `)
      .in('status', ['active', 'trialing'])
      .lt('created_at', monthEnd.toISOString())
      .or(`canceled_at.is.null,canceled_at.gte.${monthStart.toISOString()}`);

    let totalMRR = 0;

    for (const subscription of subscriptions || []) {
      const planAmount = subscription.plan?.amount || 0;
      const interval = subscription.plan?.interval || 'month';

      // Convert to monthly recurring revenue
      const monthlyAmount = interval === 'year' ? planAmount / 12 : planAmount;
      totalMRR += monthlyAmount;
    }

    return totalMRR;
  }

  /**
   * Calculate MRR movement components
   */
  private async calculateMRRMovement(previousMonth: Date, currentMonth: Date) {
    // This is a simplified implementation
    // In production, you'd track actual subscription changes and categorize them
    
    const previousMRR = await this.getMRRForMonth(previousMonth);
    const currentMRR = await this.getMRRForMonth(currentMonth);
    
    // Get new subscriptions
    const monthStart = new Date(currentMonth);
    monthStart.setDate(1);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    const { data: newSubs } = await this.supabase
      .from('subscriptions')
      .select(`
        *,
        plan:subscription_plans(amount, interval)
      `)
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', monthEnd.toISOString());

    const newMRR = newSubs?.reduce((sum, sub) => {
      const amount = sub.plan?.amount || 0;
      const monthlyAmount = sub.plan?.interval === 'year' ? amount / 12 : amount;
      return sum + monthlyAmount;
    }, 0) || 0;

    // Get churned subscriptions
    const { data: churnedSubs } = await this.supabase
      .from('subscriptions')
      .select(`
        *,
        plan:subscription_plans(amount, interval)
      `)
      .gte('canceled_at', monthStart.toISOString())
      .lt('canceled_at', monthEnd.toISOString());

    const churnedMRR = churnedSubs?.reduce((sum, sub) => {
      const amount = sub.plan?.amount || 0;
      const monthlyAmount = sub.plan?.interval === 'year' ? amount / 12 : amount;
      return sum + monthlyAmount;
    }, 0) || 0;

    // Simplified expansion/contraction (would need plan change tracking)
    const expansionMRR = Math.max(0, currentMRR - previousMRR - newMRR + churnedMRR) * 0.7;
    const contractionMRR = Math.max(0, previousMRR + newMRR - churnedMRR - currentMRR) * 0.3;

    return {
      newMRR,
      expansionMRR,
      contractionMRR,
      churnedMRR,
    };
  }

  /**
   * Analyze churn reasons from subscription metadata
   */
  private analyzeChurnReasons(churnedSubscriptions: any[]): Array<{ reason: string; count: number; percentage: number }> {
    const reasonCounts = new Map<string, number>();

    for (const sub of churnedSubscriptions) {
      const reason = sub.metadata?.cancellation_reason || 'unknown';
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    }

    const total = churnedSubscriptions.length;
    
    return Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get comprehensive analytics dashboard data
   */
  async getDashboardMetrics(): Promise<{
    mrr: MRRBreakdown;
    arr: ARRMetrics;
    churn: ChurnAnalysis;
    conversion: ConversionFunnel;
    clv: CustomerLifetimeValue;
  }> {
    try {
      const currentMonth = new Date();
      const previousMonth = new Date(currentMonth);
      previousMonth.setMonth(previousMonth.getMonth() - 1);

      const [mrr, arr, churn, conversion, clv] = await Promise.all([
        this.calculateMRR(),
        this.calculateARR(),
        this.analyzeChurn({
          startDate: previousMonth,
          endDate: currentMonth,
        }),
        this.analyzeConversionFunnel({
          startDate: previousMonth,
          endDate: currentMonth,
        }),
        this.calculateCLV(),
      ]);

      return { mrr, arr, churn, conversion, clv };
    } catch (error) {
      console.error('Get dashboard metrics error:', error);
      throw new Error(`Failed to get dashboard metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// =============================================
// SINGLETON INSTANCE
// =============================================

const subscriptionAnalytics = new SubscriptionAnalytics();

export default subscriptionAnalytics;
export { SubscriptionAnalytics };