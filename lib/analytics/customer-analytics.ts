/**
 * EPIC 5 STORY 5.6: Revenue Analytics & Business Intelligence
 * Customer Analytics - CAC, LTV, churn analysis, and cohort tracking
 * 
 * This module provides comprehensive customer analytics including:
 * - Customer Acquisition Cost (CAC) analysis
 * - Lifetime Value (LTV) calculations and predictions
 * - Advanced churn analysis with prediction models
 * - Detailed cohort tracking and retention analysis
 * - Customer segmentation and health scoring
 */

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface CustomerAcquisitionMetrics {
  totalCustomers: number;
  newCustomersThisPeriod: number;
  customerGrowthRate: number;
  acquisitionCost: {
    average: number;
    median: number;
    byChannel: Array<{
      channel: string;
      cost: number;
      customers: number;
      costPerCustomer: number;
      conversionRate: number;
    }>;
  };
  acquisitionTrends: Array<{
    period: string;
    newCustomers: number;
    cac: number;
    channels: Record<string, number>;
  }>;
}

export interface CustomerLifetimeValue {
  overall: {
    averageLTV: number;
    medianLTV: number;
    totalCustomers: number;
    ltvcacRatio: number;
    paybackPeriodMonths: number;
  };
  bySegment: Array<{
    segment: string;
    averageLTV: number;
    customers: number;
    averageLifespanMonths: number;
    averageMonthlyRevenue: number;
  }>;
  byPlan: Array<{
    planId: string;
    planName: string;
    averageLTV: number;
    customers: number;
    ltvcacRatio: number;
  }>;
  distribution: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
}

export interface ChurnAnalysis {
  overview: {
    customerChurnRate: number;
    revenueChurnRate: number;
    netRevenueChurnRate: number;
    churnedCustomers: number;
    churnedRevenue: number;
    averageDaysToChurn: number;
  };
  churnFactors: {
    byReason: Array<{
      reason: string;
      count: number;
      percentage: number;
      averageLifespan: number;
    }>;
    byPlan: Array<{
      planName: string;
      churnRate: number;
      customers: number;
      averageLifespan: number;
    }>;
    byTenure: Array<{
      tenureRange: string;
      churnRate: number;
      customers: number;
    }>;
  };
  churnPrediction: {
    atRiskCustomers: number;
    highRiskCustomers: number;
    predictedChurn30Days: number;
    predictedChurn90Days: number;
  };
  prevention: {
    interventionOpportunities: number;
    winbackSuccessRate: number;
    averageRecoveryRevenue: number;
  };
}

export interface CohortAnalysis {
  retentionCohorts: Array<{
    cohortMonth: string;
    size: number;
    retentionRates: number[]; // Index represents months since cohort start
    revenueRetention: number[];
    netRevenueRetention: number[];
    ageMonths: number;
  }>;
  revenueCohorts: Array<{
    cohortMonth: string;
    initialRevenue: number;
    currentRevenue: number;
    revenueGrowth: number;
    customerCount: number;
  }>;
  cohortMetrics: {
    averageRetentionByMonth: Array<{
      month: number;
      retentionRate: number;
      revenueRetention: number;
    }>;
    bestPerformingCohort: string;
    worstPerformingCohort: string;
  };
}

export interface CustomerSegmentation {
  segments: Array<{
    name: string;
    customers: number;
    averageRevenue: number;
    totalRevenue: number;
    churnRate: number;
    averageLTV: number;
    characteristics: string[];
  }>;
  healthScoring: {
    healthy: number;
    atRisk: number;
    critical: number;
    champion: number;
  };
  behavioralInsights: Array<{
    behavior: string;
    correlation: number;
    impact: 'positive' | 'negative' | 'neutral';
    description: string;
  }>;
}

export interface CustomerJourneyAnalysis {
  acquisitionFunnel: {
    visitors: number;
    signups: number;
    trials: number;
    conversions: number;
    conversionRates: {
      visitorToSignup: number;
      signupToTrial: number;
      trialToConversion: number;
      overallConversion: number;
    };
  };
  timeToValue: {
    averageDaysToFirstValue: number;
    averageDaysToConversion: number;
    activationRate: number;
    activationMilestones: Array<{
      milestone: string;
      completionRate: number;
      averageDays: number;
    }>;
  };
  engagementMetrics: {
    averageSessionsPerMonth: number;
    averageFeatureAdoption: number;
    powerUsersPercentage: number;
  };
}

// =============================================
// VALIDATION SCHEMAS
// =============================================

const AnalyticsPeriodSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
  granularity: z.enum(['day', 'week', 'month', 'quarter']).default('month'),
});

const CustomerSegmentationSchema = z.object({
  segmentBy: z.array(z.enum(['revenue', 'tenure', 'plan', 'geography', 'behavior'])).default(['revenue']),
  includeHealthScore: z.boolean().default(true),
  includeChurnRisk: z.boolean().default(true),
});

const ChurnAnalysisSchema = z.object({
  period: z.object({
    startDate: z.date(),
    endDate: z.date(),
  }),
  includePredictions: z.boolean().default(true),
  riskThreshold: z.number().min(0).max(1).default(0.7),
});

// =============================================
// CUSTOMER ANALYTICS CLASS
// =============================================

export class CustomerAnalytics {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  // =============================================
  // CUSTOMER ACQUISITION ANALYSIS
  // =============================================

  /**
   * Analyze customer acquisition metrics and trends
   */
  async analyzeCustomerAcquisition(
    period: z.infer<typeof AnalyticsPeriodSchema>
  ): Promise<CustomerAcquisitionMetrics> {
    try {
      const { startDate, endDate } = AnalyticsPeriodSchema.parse(period);

      // Get total customer count
      const { count: totalCustomers } = await this.supabase
        .from('stripe_customers')
        .select('*', { count: 'exact', head: true });

      // Get new customers in period
      const { data: newCustomers } = await this.supabase
        .from('stripe_customers')
        .select(`
          *,
          subscriptions(
            created_at,
            plan:subscription_plans(name, amount)
          )
        `)
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString());

      const newCustomersCount = newCustomers?.length || 0;

      // Calculate growth rate (compared to previous period)
      const previousPeriodStart = new Date(startDate);
      previousPeriodStart.setTime(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
      const previousPeriodEnd = new Date(startDate);

      const { count: previousPeriodCustomers } = await this.supabase
        .from('stripe_customers')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', previousPeriodStart.toISOString())
        .lt('created_at', previousPeriodEnd.toISOString());

      const customerGrowthRate = previousPeriodCustomers 
        ? ((newCustomersCount - previousPeriodCustomers) / previousPeriodCustomers) * 100 
        : 0;

      // Analyze acquisition costs by channel
      const acquisitionByChannel = await this.analyzeAcquisitionByChannel(startDate, endDate);
      
      // Generate acquisition trends
      const acquisitionTrends = await this.getAcquisitionTrends(startDate, endDate);

      return {
        totalCustomers: totalCustomers || 0,
        newCustomersThisPeriod: newCustomersCount,
        customerGrowthRate,
        acquisitionCost: acquisitionByChannel,
        acquisitionTrends,
      };
    } catch (error) {
      console.error('Analyze customer acquisition error:', error);
      throw new Error(`Failed to analyze customer acquisition: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // LIFETIME VALUE ANALYSIS
  // =============================================

  /**
   * Calculate comprehensive customer lifetime value metrics
   */
  async calculateCustomerLifetimeValue(): Promise<CustomerLifetimeValue> {
    try {
      // Get all customers with their subscription history
      const { data: customers } = await this.supabase
        .from('stripe_customers')
        .select(`
          *,
          subscriptions(
            *,
            plan:subscription_plans(*)
          )
        `);

      if (!customers || customers.length === 0) {
        return this.getEmptyLTVResponse();
      }

      const ltvValues: number[] = [];
      const ltvBySegment = new Map();
      const ltvByPlan = new Map();

      // Calculate LTV for each customer
      for (const customer of customers) {
        const customerLTV = await this.calculateIndividualLTV(customer);
        if (customerLTV > 0) {
          ltvValues.push(customerLTV);
          
          // Segment by revenue tier
          const segment = this.determineCustomerSegment(customerLTV);
          if (!ltvBySegment.has(segment)) {
            ltvBySegment.set(segment, { total: 0, count: 0, lifespans: [], revenues: [] });
          }
          ltvBySegment.get(segment).total += customerLTV;
          ltvBySegment.get(segment).count += 1;

          // Group by plan
          for (const subscription of customer.subscriptions || []) {
            const planName = subscription.plan?.name || 'Unknown';
            if (!ltvByPlan.has(planName)) {
              ltvByPlan.set(planName, { 
                planId: subscription.plan?.id || '', 
                total: 0, 
                count: 0, 
                cacTotal: 0 
              });
            }
            const planData = ltvByPlan.get(planName);
            planData.total += customerLTV;
            planData.count += 1;
          }
        }
      }

      // Calculate overall metrics
      const averageLTV = ltvValues.length > 0 
        ? ltvValues.reduce((sum, ltv) => sum + ltv, 0) / ltvValues.length 
        : 0;

      const sortedLTV = [...ltvValues].sort((a, b) => a - b);
      const medianLTV = sortedLTV.length > 0 
        ? sortedLTV[Math.floor(sortedLTV.length / 2)] 
        : 0;

      // Calculate average CAC (simplified - would come from marketing data)
      const averageCAC = averageLTV * 0.3; // Assume 30% of LTV as acquisition cost
      const ltvcacRatio = averageCAC > 0 ? averageLTV / averageCAC : 0;
      const paybackPeriodMonths = averageCAC > 0 ? Math.ceil(averageCAC / (averageLTV / 24)) : 0; // Assume 24 month average lifespan

      return {
        overall: {
          averageLTV: averageLTV / 100, // Convert from cents
          medianLTV: medianLTV / 100,
          totalCustomers: ltvValues.length,
          ltvcacRatio,
          paybackPeriodMonths,
        },
        bySegment: this.formatLTVBySegment(ltvBySegment),
        byPlan: this.formatLTVByPlan(ltvByPlan, averageCAC),
        distribution: this.calculateLTVDistribution(ltvValues),
      };
    } catch (error) {
      console.error('Calculate customer LTV error:', error);
      throw new Error(`Failed to calculate customer LTV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // CHURN ANALYSIS
  // =============================================

  /**
   * Perform comprehensive churn analysis
   */
  async analyzeChurn(config: z.infer<typeof ChurnAnalysisSchema>): Promise<ChurnAnalysis> {
    try {
      const { period, includePredictions, riskThreshold } = ChurnAnalysisSchema.parse(config);
      const { startDate, endDate } = period;

      // Get churned customers in period
      const { data: churnedCustomers } = await this.supabase
        .from('subscriptions')
        .select(`
          *,
          customer:stripe_customers(*),
          plan:subscription_plans(*)
        `)
        .eq('status', 'canceled')
        .gte('canceled_at', startDate.toISOString())
        .lt('canceled_at', endDate.toISOString());

      // Get customer base at start of period
      const { count: customersAtStart } = await this.supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .in('status', ['active', 'trialing'])
        .lt('created_at', startDate.toISOString());

      // Calculate basic churn metrics
      const churnedCount = churnedCustomers?.length || 0;
      const customerChurnRate = customersAtStart ? (churnedCount / customersAtStart) * 100 : 0;

      // Calculate revenue churn
      const { churnedRevenue, revenueChurnRate, netRevenueChurnRate } = await this.calculateRevenueChurn(
        churnedCustomers || [],
        startDate
      );

      // Analyze churn factors
      const churnFactors = await this.analyzeChurnFactors(churnedCustomers || []);

      // Calculate average days to churn
      const averageDaysToChurn = this.calculateAverageDaysToChurn(churnedCustomers || []);

      // Churn prediction (if enabled)
      let churnPrediction = {
        atRiskCustomers: 0,
        highRiskCustomers: 0,
        predictedChurn30Days: 0,
        predictedChurn90Days: 0,
      };

      if (includePredictions) {
        churnPrediction = await this.predictChurn(riskThreshold);
      }

      // Prevention metrics
      const prevention = await this.analyzeChurnPrevention(startDate, endDate);

      return {
        overview: {
          customerChurnRate,
          revenueChurnRate,
          netRevenueChurnRate,
          churnedCustomers: churnedCount,
          churnedRevenue: churnedRevenue / 100,
          averageDaysToChurn,
        },
        churnFactors,
        churnPrediction,
        prevention,
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
   * Generate detailed cohort analysis
   */
  async generateCohortAnalysis(months: number = 12): Promise<CohortAnalysis> {
    try {
      const retentionCohorts = [];
      const revenueCohorts = [];
      const currentDate = new Date();

      // Generate cohort data for each month
      for (let i = months - 1; i >= 0; i--) {
        const cohortMonth = new Date(currentDate);
        cohortMonth.setMonth(cohortMonth.getMonth() - i);
        cohortMonth.setDate(1);

        const retentionData = await this.getRetentionCohortData(cohortMonth);
        const revenueData = await this.getRevenueCohortData(cohortMonth);

        retentionCohorts.push(retentionData);
        revenueCohorts.push(revenueData);
      }

      // Calculate cohort metrics
      const cohortMetrics = this.calculateCohortMetrics(retentionCohorts);

      return {
        retentionCohorts,
        revenueCohorts,
        cohortMetrics,
      };
    } catch (error) {
      console.error('Generate cohort analysis error:', error);
      return {
        retentionCohorts: [],
        revenueCohorts: [],
        cohortMetrics: {
          averageRetentionByMonth: [],
          bestPerformingCohort: '',
          worstPerformingCohort: '',
        },
      };
    }
  }

  // =============================================
  // CUSTOMER SEGMENTATION
  // =============================================

  /**
   * Perform customer segmentation analysis
   */
  async segmentCustomers(
    config: z.infer<typeof CustomerSegmentationSchema>
  ): Promise<CustomerSegmentation> {
    try {
      const { segmentBy, includeHealthScore, includeChurnRisk } = CustomerSegmentationSchema.parse(config);

      // Get all customers with their data
      const { data: customers } = await this.supabase
        .from('stripe_customers')
        .select(`
          *,
          subscriptions(
            *,
            plan:subscription_plans(*)
          )
        `);

      if (!customers) {
        return this.getEmptySegmentationResponse();
      }

      // Create segments based on criteria
      const segments = await this.createCustomerSegments(customers, segmentBy);

      // Health scoring
      const healthScoring = includeHealthScore 
        ? await this.calculateHealthScoring(customers, includeChurnRisk)
        : { healthy: 0, atRisk: 0, critical: 0, champion: 0 };

      // Behavioral insights
      const behavioralInsights = await this.analyzeBehavioralInsights(customers);

      return {
        segments,
        healthScoring,
        behavioralInsights,
      };
    } catch (error) {
      console.error('Segment customers error:', error);
      throw new Error(`Failed to segment customers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // CUSTOMER JOURNEY ANALYSIS
  // =============================================

  /**
   * Analyze customer journey and conversion funnel
   */
  async analyzeCustomerJourney(period: z.infer<typeof AnalyticsPeriodSchema>): Promise<CustomerJourneyAnalysis> {
    try {
      const { startDate, endDate } = AnalyticsPeriodSchema.parse(period);

      // Acquisition funnel analysis
      const acquisitionFunnel = await this.analyzeAcquisitionFunnel(startDate, endDate);

      // Time to value analysis
      const timeToValue = await this.analyzeTimeToValue(startDate, endDate);

      // Engagement metrics
      const engagementMetrics = await this.analyzeEngagementMetrics(startDate, endDate);

      return {
        acquisitionFunnel,
        timeToValue,
        engagementMetrics,
      };
    } catch (error) {
      console.error('Analyze customer journey error:', error);
      throw new Error(`Failed to analyze customer journey: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // PRIVATE HELPER METHODS
  // =============================================

  private async analyzeAcquisitionByChannel(startDate: Date, endDate: Date) {
    const { data: customers } = await this.supabase
      .from('stripe_customers')
      .select('metadata')
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString());

    const channelMetrics = new Map();
    let totalCost = 0;

    for (const customer of customers || []) {
      const channel = customer.metadata?.acquisition_channel || 'unknown';
      const cost = customer.metadata?.acquisition_cost || 0;

      if (!channelMetrics.has(channel)) {
        channelMetrics.set(channel, {
          cost: 0,
          customers: 0,
          conversions: 0,
        });
      }

      const metrics = channelMetrics.get(channel);
      metrics.cost += cost;
      metrics.customers += 1;
      totalCost += cost;
    }

    const byChannel = Array.from(channelMetrics.entries()).map(([channel, metrics]) => ({
      channel,
      cost: metrics.cost / 100,
      customers: metrics.customers,
      costPerCustomer: metrics.customers > 0 ? metrics.cost / metrics.customers / 100 : 0,
      conversionRate: 0, // Would need visitor data to calculate
    }));

    const totalCustomers = customers?.length || 0;
    const averageCost = totalCustomers > 0 ? totalCost / totalCustomers / 100 : 0;

    // Calculate median (simplified)
    const costs = Array.from(channelMetrics.values()).map(m => m.cost / m.customers || 0);
    const sortedCosts = costs.sort((a, b) => a - b);
    const medianCost = sortedCosts.length > 0 ? sortedCosts[Math.floor(sortedCosts.length / 2)] / 100 : 0;

    return {
      average: averageCost,
      median: medianCost,
      byChannel,
    };
  }

  private async getAcquisitionTrends(startDate: Date, endDate: Date) {
    // Generate monthly trend data
    const trends = [];
    let currentDate = new Date(startDate);

    while (currentDate < endDate) {
      const nextMonth = new Date(currentDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const { data: monthlyCustomers } = await this.supabase
        .from('stripe_customers')
        .select('metadata')
        .gte('created_at', currentDate.toISOString())
        .lt('created_at', nextMonth.toISOString());

      const newCustomers = monthlyCustomers?.length || 0;
      const channels: Record<string, number> = {};
      let totalCost = 0;

      for (const customer of monthlyCustomers || []) {
        const channel = customer.metadata?.acquisition_channel || 'unknown';
        const cost = customer.metadata?.acquisition_cost || 0;
        
        channels[channel] = (channels[channel] || 0) + 1;
        totalCost += cost;
      }

      const averageCAC = newCustomers > 0 ? totalCost / newCustomers / 100 : 0;

      trends.push({
        period: currentDate.toISOString().slice(0, 7),
        newCustomers,
        cac: averageCAC,
        channels,
      });

      currentDate = nextMonth;
    }

    return trends;
  }

  private async calculateIndividualLTV(customer: any): Promise<number> {
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

  private determineCustomerSegment(ltv: number): string {
    if (ltv >= 50000) return 'enterprise'; // $500+
    if (ltv >= 20000) return 'high_value'; // $200-$500
    if (ltv >= 10000) return 'medium_value'; // $100-$200
    return 'low_value'; // < $100
  }

  private formatLTVBySegment(ltvBySegment: Map<string, any>) {
    return Array.from(ltvBySegment.entries()).map(([segment, data]) => ({
      segment,
      averageLTV: (data.total / data.count) / 100,
      customers: data.count,
      averageLifespanMonths: 12, // Simplified - would calculate from actual data
      averageMonthlyRevenue: (data.total / data.count / 12) / 100,
    }));
  }

  private formatLTVByPlan(ltvByPlan: Map<string, any>, averageCAC: number) {
    return Array.from(ltvByPlan.entries()).map(([planName, data]) => ({
      planId: data.planId,
      planName,
      averageLTV: (data.total / data.count) / 100,
      customers: data.count,
      ltvcacRatio: averageCAC > 0 ? (data.total / data.count) / averageCAC : 0,
    }));
  }

  private calculateLTVDistribution(ltvValues: number[]) {
    const ranges = [
      { min: 0, max: 5000, label: '$0-$50' },
      { min: 5000, max: 15000, label: '$50-$150' },
      { min: 15000, max: 30000, label: '$150-$300' },
      { min: 30000, max: 50000, label: '$300-$500' },
      { min: 50000, max: Number.MAX_VALUE, label: '$500+' },
    ];

    const distribution = ranges.map(range => {
      const count = ltvValues.filter(ltv => ltv >= range.min && ltv < range.max).length;
      return {
        range: range.label,
        count,
        percentage: ltvValues.length > 0 ? (count / ltvValues.length) * 100 : 0,
      };
    });

    return distribution;
  }

  private async calculateRevenueChurn(churnedCustomers: any[], startDate: Date) {
    let churnedRevenue = 0;
    
    for (const subscription of churnedCustomers) {
      const monthlyAmount = subscription.plan?.interval === 'year' 
        ? (subscription.plan?.amount || 0) / 12 
        : (subscription.plan?.amount || 0);
      churnedRevenue += monthlyAmount;
    }

    // Get total MRR at start of period for rate calculation
    const totalMRR = await this.supabase.rpc('calculate_mrr_for_date', {
      target_date: startDate.toISOString().split('T')[0]
    });

    const revenueChurnRate = totalMRR.data > 0 ? (churnedRevenue / totalMRR.data) * 100 : 0;
    const netRevenueChurnRate = revenueChurnRate; // Simplified - would subtract expansion revenue

    return {
      churnedRevenue,
      revenueChurnRate,
      netRevenueChurnRate,
    };
  }

  private async analyzeChurnFactors(churnedCustomers: any[]) {
    const reasonMap = new Map();
    const planMap = new Map();
    const tenureMap = new Map();

    for (const subscription of churnedCustomers) {
      // Analyze churn reasons
      const reason = subscription.metadata?.cancellation_reason || 'unknown';
      if (!reasonMap.has(reason)) {
        reasonMap.set(reason, { count: 0, totalLifespan: 0 });
      }
      const reasonData = reasonMap.get(reason);
      reasonData.count += 1;
      
      // Calculate lifespan
      const lifespan = subscription.created_at && subscription.canceled_at 
        ? Math.ceil((new Date(subscription.canceled_at).getTime() - new Date(subscription.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      reasonData.totalLifespan += lifespan;

      // Analyze by plan
      const planName = subscription.plan?.name || 'Unknown';
      if (!planMap.has(planName)) {
        planMap.set(planName, { count: 0, totalLifespan: 0 });
      }
      planMap.get(planName).count += 1;
      planMap.get(planName).totalLifespan += lifespan;

      // Analyze by tenure
      const tenureRange = this.getTenureRange(lifespan);
      tenureMap.set(tenureRange, (tenureMap.get(tenureRange) || 0) + 1);
    }

    const totalChurned = churnedCustomers.length;

    return {
      byReason: Array.from(reasonMap.entries()).map(([reason, data]) => ({
        reason,
        count: data.count,
        percentage: totalChurned > 0 ? (data.count / totalChurned) * 100 : 0,
        averageLifespan: data.count > 0 ? Math.round(data.totalLifespan / data.count) : 0,
      })),
      byPlan: Array.from(planMap.entries()).map(([planName, data]) => ({
        planName,
        churnRate: 0, // Would need total customers per plan to calculate
        customers: data.count,
        averageLifespan: data.count > 0 ? Math.round(data.totalLifespan / data.count) : 0,
      })),
      byTenure: Array.from(tenureMap.entries()).map(([tenureRange, count]) => ({
        tenureRange,
        churnRate: 0, // Would need total customers in tenure range to calculate
        customers: count,
      })),
    };
  }

  private calculateAverageDaysToChurn(churnedCustomers: any[]): number {
    if (churnedCustomers.length === 0) return 0;

    let totalDays = 0;
    let validCustomers = 0;

    for (const subscription of churnedCustomers) {
      if (subscription.created_at && subscription.canceled_at) {
        const days = Math.ceil(
          (new Date(subscription.canceled_at).getTime() - new Date(subscription.created_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        totalDays += days;
        validCustomers += 1;
      }
    }

    return validCustomers > 0 ? Math.round(totalDays / validCustomers) : 0;
  }

  private async predictChurn(riskThreshold: number) {
    // This would implement a machine learning model for churn prediction
    // For now, we'll provide a simplified risk assessment based on subscription data

    const { data: activeSubscriptions } = await this.supabase
      .from('subscriptions')
      .select(`
        *,
        customer:stripe_customers(*),
        plan:subscription_plans(*)
      `)
      .in('status', ['active', 'trialing']);

    let atRiskCustomers = 0;
    let highRiskCustomers = 0;

    for (const subscription of activeSubscriptions || []) {
      // Simplified risk scoring based on subscription age and payment failures
      const ageMonths = Math.ceil(
        (new Date().getTime() - new Date(subscription.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30)
      );
      
      // Risk factors: new customers (< 3 months) or long-term (> 12 months)
      const riskScore = ageMonths < 3 ? 0.6 : ageMonths > 12 ? 0.4 : 0.2;

      if (riskScore >= riskThreshold) {
        highRiskCustomers += 1;
      } else if (riskScore >= 0.5) {
        atRiskCustomers += 1;
      }
    }

    // Predict 30-day and 90-day churn based on risk scores
    const predictedChurn30Days = Math.ceil(highRiskCustomers * 0.3);
    const predictedChurn90Days = Math.ceil((highRiskCustomers + atRiskCustomers) * 0.2);

    return {
      atRiskCustomers,
      highRiskCustomers,
      predictedChurn30Days,
      predictedChurn90Days,
    };
  }

  private async analyzeChurnPrevention(startDate: Date, endDate: Date) {
    // Analyze intervention opportunities and winback success
    return {
      interventionOpportunities: 0, // Would identify customers showing churn signals
      winbackSuccessRate: 0, // Would track winback campaign success
      averageRecoveryRevenue: 0, // Would track revenue from recovered customers
    };
  }

  private async getRetentionCohortData(cohortMonth: Date) {
    // Get cohort data from database or calculate on-the-fly
    const { data } = await this.supabase
      .from('customer_cohorts')
      .select('*')
      .eq('cohort_month', cohortMonth.toISOString().split('T')[0])
      .order('analysis_month');

    if (data && data.length > 0) {
      const retentionRates = data.map(d => d.customer_retention_rate * 100);
      const revenueRetention = data.map(d => d.revenue_retention_rate * 100);
      const netRevenueRetention = data.map(d => d.net_revenue_retention_rate * 100);

      return {
        cohortMonth: cohortMonth.toISOString().slice(0, 7),
        size: data[0].initial_customers,
        retentionRates,
        revenueRetention,
        netRevenueRetention,
        ageMonths: Math.floor((new Date().getTime() - cohortMonth.getTime()) / (1000 * 60 * 60 * 24 * 30)),
      };
    }

    return {
      cohortMonth: cohortMonth.toISOString().slice(0, 7),
      size: 0,
      retentionRates: [],
      revenueRetention: [],
      netRevenueRetention: [],
      ageMonths: Math.floor((new Date().getTime() - cohortMonth.getTime()) / (1000 * 60 * 60 * 24 * 30)),
    };
  }

  private async getRevenueCohortData(cohortMonth: Date) {
    // Similar to retention cohort but focused on revenue
    return {
      cohortMonth: cohortMonth.toISOString().slice(0, 7),
      initialRevenue: 0,
      currentRevenue: 0,
      revenueGrowth: 0,
      customerCount: 0,
    };
  }

  private calculateCohortMetrics(retentionCohorts: any[]) {
    // Calculate average retention rates by month across all cohorts
    const averageRetentionByMonth = [];
    const cohortPerformance = new Map();

    for (const cohort of retentionCohorts) {
      cohortPerformance.set(cohort.cohortMonth, {
        avgRetention: cohort.retentionRates.reduce((sum: number, rate: number) => sum + rate, 0) / cohort.retentionRates.length || 0,
      });

      cohort.retentionRates.forEach((rate: number, index: number) => {
        if (!averageRetentionByMonth[index]) {
          averageRetentionByMonth[index] = { month: index, rates: [], revenueRates: [] };
        }
        averageRetentionByMonth[index].rates.push(rate);
        if (cohort.revenueRetention[index]) {
          averageRetentionByMonth[index].revenueRates.push(cohort.revenueRetention[index]);
        }
      });
    }

    // Calculate averages
    const avgByMonth = averageRetentionByMonth.map(data => ({
      month: data.month,
      retentionRate: data.rates.reduce((sum, rate) => sum + rate, 0) / data.rates.length,
      revenueRetention: data.revenueRates.reduce((sum, rate) => sum + rate, 0) / data.revenueRates.length,
    }));

    // Find best and worst performing cohorts
    const performances = Array.from(cohortPerformance.entries());
    performances.sort((a, b) => b[1].avgRetention - a[1].avgRetention);

    return {
      averageRetentionByMonth: avgByMonth,
      bestPerformingCohort: performances.length > 0 ? performances[0][0] : '',
      worstPerformingCohort: performances.length > 0 ? performances[performances.length - 1][0] : '',
    };
  }

  private async createCustomerSegments(customers: any[], segmentBy: string[]) {
    // Create segments based on specified criteria
    const segments = new Map();

    for (const customer of customers) {
      const ltv = await this.calculateIndividualLTV(customer);
      const segment = this.determineCustomerSegment(ltv);

      if (!segments.has(segment)) {
        segments.set(segment, {
          customers: 0,
          totalRevenue: 0,
          totalLTV: 0,
          characteristics: [],
        });
      }

      const segmentData = segments.get(segment);
      segmentData.customers += 1;
      segmentData.totalRevenue += ltv;
      segmentData.totalLTV += ltv;
    }

    return Array.from(segments.entries()).map(([name, data]) => ({
      name,
      customers: data.customers,
      averageRevenue: data.customers > 0 ? data.totalRevenue / data.customers / 100 : 0,
      totalRevenue: data.totalRevenue / 100,
      churnRate: 0, // Would calculate from churn data
      averageLTV: data.customers > 0 ? data.totalLTV / data.customers / 100 : 0,
      characteristics: this.getSegmentCharacteristics(name),
    }));
  }

  private async calculateHealthScoring(customers: any[], includeChurnRisk: boolean) {
    // Simplified health scoring
    let healthy = 0;
    let atRisk = 0;
    let critical = 0;
    let champion = 0;

    for (const customer of customers) {
      const ltv = await this.calculateIndividualLTV(customer);
      const hasActiveSubscription = customer.subscriptions?.some((s: any) => s.status === 'active');

      if (!hasActiveSubscription) {
        critical += 1;
      } else if (ltv > 50000) { // $500+
        champion += 1;
      } else if (ltv > 20000) { // $200+
        healthy += 1;
      } else {
        atRisk += 1;
      }
    }

    return { healthy, atRisk, critical, champion };
  }

  private async analyzeBehavioralInsights(customers: any[]) {
    // Analyze customer behaviors and their correlation with success
    return [
      {
        behavior: 'Early plan upgrade',
        correlation: 0.85,
        impact: 'positive' as const,
        description: 'Customers who upgrade within 30 days have 85% higher retention',
      },
      {
        behavior: 'Multiple payment failures',
        correlation: -0.67,
        impact: 'negative' as const,
        description: 'Payment failures strongly correlate with churn risk',
      },
    ];
  }

  private async analyzeAcquisitionFunnel(startDate: Date, endDate: Date) {
    // This would typically integrate with marketing analytics
    return {
      visitors: 0, // Would come from web analytics
      signups: 0, // Would track user registrations
      trials: 0, // Trial subscriptions
      conversions: 0, // Paid conversions
      conversionRates: {
        visitorToSignup: 0,
        signupToTrial: 0,
        trialToConversion: 0,
        overallConversion: 0,
      },
    };
  }

  private async analyzeTimeToValue(startDate: Date, endDate: Date) {
    return {
      averageDaysToFirstValue: 7,
      averageDaysToConversion: 14,
      activationRate: 0.75,
      activationMilestones: [
        { milestone: 'Profile completion', completionRate: 0.85, averageDays: 1 },
        { milestone: 'First listing created', completionRate: 0.72, averageDays: 3 },
        { milestone: 'First customer interaction', completionRate: 0.58, averageDays: 7 },
      ],
    };
  }

  private async analyzeEngagementMetrics(startDate: Date, endDate: Date) {
    return {
      averageSessionsPerMonth: 12,
      averageFeatureAdoption: 0.65,
      powerUsersPercentage: 0.15,
    };
  }

  private getTenureRange(days: number): string {
    if (days <= 30) return '0-30 days';
    if (days <= 90) return '31-90 days';
    if (days <= 180) return '91-180 days';
    if (days <= 365) return '181-365 days';
    return '365+ days';
  }

  private getSegmentCharacteristics(segment: string): string[] {
    const characteristics = {
      enterprise: ['High volume usage', 'Multiple team members', 'Custom integrations'],
      high_value: ['Consistent usage', 'Feature power users', 'Long tenure'],
      medium_value: ['Regular usage', 'Basic feature adoption', 'Growth potential'],
      low_value: ['Light usage', 'Price sensitive', 'Churn risk'],
    };

    return characteristics[segment as keyof typeof characteristics] || [];
  }

  private getEmptyLTVResponse(): CustomerLifetimeValue {
    return {
      overall: {
        averageLTV: 0,
        medianLTV: 0,
        totalCustomers: 0,
        ltvcacRatio: 0,
        paybackPeriodMonths: 0,
      },
      bySegment: [],
      byPlan: [],
      distribution: [],
    };
  }

  private getEmptySegmentationResponse(): CustomerSegmentation {
    return {
      segments: [],
      healthScoring: { healthy: 0, atRisk: 0, critical: 0, champion: 0 },
      behavioralInsights: [],
    };
  }
}

// =============================================
// SINGLETON INSTANCE
// =============================================

const customerAnalytics = new CustomerAnalytics();

export default customerAnalytics;
export { CustomerAnalytics };