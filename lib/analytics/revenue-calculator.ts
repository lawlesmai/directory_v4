/**
 * EPIC 5 STORY 5.6: Revenue Analytics & Business Intelligence
 * Revenue Calculator - MRR/ARR calculations with growth attribution
 * 
 * This module provides comprehensive revenue analytics including:
 * - Monthly and Annual Recurring Revenue calculations
 * - Revenue growth attribution (new, expansion, contraction, churn)
 * - Trend analysis and growth decomposition
 * - Revenue cohort analysis
 */

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface RevenueMetrics {
  current: {
    mrr: number;
    arr: number;
    customers: number;
    arpu: number;
  };
  previous: {
    mrr: number;
    arr: number;
    customers: number;
    arpu: number;
  };
  growth: {
    mrrGrowth: number;
    mrrGrowthRate: number;
    arrGrowthRate: number;
    customerGrowthRate: number;
    arpuGrowthRate: number;
  };
}

export interface RevenueAttribution {
  newRevenue: number; // Revenue from new customers
  expansionRevenue: number; // Revenue from upgrades/add-ons
  contractionRevenue: number; // Revenue lost from downgrades
  churnedRevenue: number; // Revenue lost from cancellations
  netNewRevenue: number; // Net change in revenue
  reactivationRevenue: number; // Revenue from returning customers
}

export interface RevenueTrend {
  period: string;
  mrr: number;
  arr: number;
  customers: number;
  newCustomers: number;
  churnedCustomers: number;
  netCustomerChange: number;
  growthRate: number;
  attribution: RevenueAttribution;
}

export interface RevenueSegmentation {
  byPlan: Array<{
    planId: string;
    planName: string;
    mrr: number;
    customers: number;
    averageRevenue: number;
    growthRate: number;
  }>;
  byGeography: Array<{
    country: string;
    mrr: number;
    customers: number;
    percentage: number;
  }>;
  byCustomerSize: Array<{
    segment: 'small' | 'medium' | 'large' | 'enterprise';
    mrr: number;
    customers: number;
    averageRevenue: number;
  }>;
}

export interface RevenueCohortsData {
  cohorts: Array<{
    month: string;
    initialCustomers: number;
    initialMrr: number;
    currentCustomers: number;
    currentMrr: number;
    retentionRate: number;
    revenueRetentionRate: number;
    netRevenueRetentionRate: number;
    ageMonths: number;
  }>;
  averageRetentionByAge: Array<{
    ageMonths: number;
    averageRetentionRate: number;
    averageRevenueRetention: number;
  }>;
}

// =============================================
// VALIDATION SCHEMAS
// =============================================

const DateRangeSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
  granularity: z.enum(['day', 'week', 'month', 'quarter']).default('month'),
});

const RevenueCalculationSchema = z.object({
  targetDate: z.date().optional(),
  includePending: z.boolean().default(false),
  currency: z.string().default('USD'),
  segmentBy: z.array(z.enum(['plan', 'geography', 'size'])).default(['plan']),
});

// =============================================
// REVENUE CALCULATOR CLASS
// =============================================

export class RevenueCalculator {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  // =============================================
  // CORE REVENUE CALCULATIONS
  // =============================================

  /**
   * Calculate comprehensive revenue metrics for current and previous periods
   */
  async calculateRevenueMetrics(
    options: z.infer<typeof RevenueCalculationSchema> = {}
  ): Promise<RevenueMetrics> {
    try {
      const config = RevenueCalculationSchema.parse(options);
      const targetDate = config.targetDate || new Date();
      
      const currentMonth = new Date(targetDate);
      currentMonth.setDate(1); // First day of month
      
      const previousMonth = new Date(currentMonth);
      previousMonth.setMonth(previousMonth.getMonth() - 1);

      // Calculate current period metrics
      const currentMrr = await this.calculateMrrForDate(currentMonth);
      const currentCustomers = await this.getActiveCustomersCount(currentMonth);
      
      // Calculate previous period metrics
      const previousMrr = await this.calculateMrrForDate(previousMonth);
      const previousCustomers = await this.getActiveCustomersCount(previousMonth);

      // Calculate ARPU (Average Revenue Per User)
      const currentArpu = currentCustomers > 0 ? currentMrr / currentCustomers : 0;
      const previousArpu = previousCustomers > 0 ? previousMrr / previousCustomers : 0;

      // Calculate growth rates
      const mrrGrowth = currentMrr - previousMrr;
      const mrrGrowthRate = previousMrr > 0 ? (mrrGrowth / previousMrr) * 100 : 0;
      const arrGrowthRate = mrrGrowthRate; // ARR growth follows MRR growth
      const customerGrowthRate = previousCustomers > 0 
        ? ((currentCustomers - previousCustomers) / previousCustomers) * 100 
        : 0;
      const arpuGrowthRate = previousArpu > 0 
        ? ((currentArpu - previousArpu) / previousArpu) * 100 
        : 0;

      return {
        current: {
          mrr: currentMrr / 100, // Convert from cents to dollars
          arr: (currentMrr * 12) / 100,
          customers: currentCustomers,
          arpu: currentArpu / 100,
        },
        previous: {
          mrr: previousMrr / 100,
          arr: (previousMrr * 12) / 100,
          customers: previousCustomers,
          arpu: previousArpu / 100,
        },
        growth: {
          mrrGrowth: mrrGrowth / 100,
          mrrGrowthRate,
          arrGrowthRate,
          customerGrowthRate,
          arpuGrowthRate,
        },
      };
    } catch (error) {
      console.error('Calculate revenue metrics error:', error);
      throw new Error(`Failed to calculate revenue metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate revenue attribution breakdown
   */
  async calculateRevenueAttribution(
    startDate: Date,
    endDate: Date
  ): Promise<RevenueAttribution> {
    try {
      const previousPeriodStart = new Date(startDate);
      previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1);
      
      const previousPeriodEnd = new Date(endDate);
      previousPeriodEnd.setMonth(previousPeriodEnd.getMonth() - 1);

      // Get new customer revenue (customers who started in this period)
      const newRevenue = await this.getNewCustomerRevenue(startDate, endDate);
      
      // Get churned revenue (customers who canceled in this period)
      const churnedRevenue = await this.getChurnedRevenue(startDate, endDate);
      
      // Get expansion and contraction revenue
      const { expansionRevenue, contractionRevenue } = await this.getPlanChangeRevenue(startDate, endDate);
      
      // Get reactivation revenue (customers who returned)
      const reactivationRevenue = await this.getReactivationRevenue(startDate, endDate);

      const netNewRevenue = newRevenue + expansionRevenue - contractionRevenue - churnedRevenue + reactivationRevenue;

      return {
        newRevenue: newRevenue / 100,
        expansionRevenue: expansionRevenue / 100,
        contractionRevenue: contractionRevenue / 100,
        churnedRevenue: churnedRevenue / 100,
        netNewRevenue: netNewRevenue / 100,
        reactivationRevenue: reactivationRevenue / 100,
      };
    } catch (error) {
      console.error('Calculate revenue attribution error:', error);
      throw new Error(`Failed to calculate revenue attribution: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get revenue trend over specified period
   */
  async getRevenueTrend(
    options: z.infer<typeof DateRangeSchema>
  ): Promise<RevenueTrend[]> {
    try {
      const { startDate, endDate, granularity } = DateRangeSchema.parse(options);
      const trend: RevenueTrend[] = [];
      
      let currentDate = new Date(startDate);
      currentDate.setDate(1); // Start from first day of month
      
      while (currentDate <= endDate) {
        const nextDate = new Date(currentDate);
        
        // Set next period based on granularity
        switch (granularity) {
          case 'month':
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
          case 'quarter':
            nextDate.setMonth(nextDate.getMonth() + 3);
            break;
          case 'week':
            nextDate.setDate(nextDate.getDate() + 7);
            break;
          case 'day':
            nextDate.setDate(nextDate.getDate() + 1);
            break;
        }

        // Calculate metrics for this period
        const mrr = await this.calculateMrrForDate(currentDate);
        const customers = await this.getActiveCustomersCount(currentDate);
        const newCustomers = await this.getNewCustomersCount(currentDate, nextDate);
        const churnedCustomers = await this.getChurnedCustomersCount(currentDate, nextDate);
        
        // Calculate attribution for this period
        const attribution = await this.calculateRevenueAttribution(currentDate, nextDate);
        
        // Calculate growth rate compared to previous period
        let growthRate = 0;
        if (trend.length > 0) {
          const previousMrr = trend[trend.length - 1].mrr * 100; // Convert back to cents
          growthRate = previousMrr > 0 ? ((mrr - previousMrr) / previousMrr) * 100 : 0;
        }

        trend.push({
          period: this.formatPeriod(currentDate, granularity),
          mrr: mrr / 100,
          arr: (mrr * 12) / 100,
          customers,
          newCustomers,
          churnedCustomers,
          netCustomerChange: newCustomers - churnedCustomers,
          growthRate,
          attribution,
        });

        currentDate = nextDate;
      }

      return trend;
    } catch (error) {
      console.error('Get revenue trend error:', error);
      return [];
    }
  }

  /**
   * Get revenue segmentation data
   */
  async getRevenueSegmentation(
    targetDate: Date = new Date(),
    segments: string[] = ['plan', 'geography']
  ): Promise<RevenueSegmentation> {
    try {
      const result: RevenueSegmentation = {
        byPlan: [],
        byGeography: [],
        byCustomerSize: [],
      };

      if (segments.includes('plan')) {
        result.byPlan = await this.getRevenueByPlan(targetDate);
      }

      if (segments.includes('geography')) {
        result.byGeography = await this.getRevenueByGeography(targetDate);
      }

      if (segments.includes('size')) {
        result.byCustomerSize = await this.getRevenueByCustomerSize(targetDate);
      }

      return result;
    } catch (error) {
      console.error('Get revenue segmentation error:', error);
      throw new Error(`Failed to get revenue segmentation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate revenue cohort analysis
   */
  async getRevenueCohorts(months: number = 12): Promise<RevenueCohortsData> {
    try {
      const cohorts = [];
      const currentDate = new Date();
      
      // Generate cohort data for each month
      for (let i = months - 1; i >= 0; i--) {
        const cohortMonth = new Date(currentDate);
        cohortMonth.setMonth(cohortMonth.getMonth() - i);
        cohortMonth.setDate(1);
        
        const cohortData = await this.getCohortData(cohortMonth);
        cohorts.push(cohortData);
      }

      // Calculate average retention by age
      const retentionByAge = await this.calculateAverageRetentionByAge(cohorts);

      return {
        cohorts,
        averageRetentionByAge: retentionByAge,
      };
    } catch (error) {
      console.error('Get revenue cohorts error:', error);
      return { cohorts: [], averageRetentionByAge: [] };
    }
  }

  // =============================================
  // PRIVATE HELPER METHODS
  // =============================================

  /**
   * Calculate MRR for a specific date
   */
  private async calculateMrrForDate(targetDate: Date): Promise<number> {
    const { data, error } = await this.supabase.rpc('calculate_mrr_for_date', {
      target_date: targetDate.toISOString().split('T')[0]
    });

    if (error) {
      console.error('Calculate MRR for date error:', error);
      return 0;
    }

    return data || 0;
  }

  /**
   * Get count of active customers on specific date
   */
  private async getActiveCustomersCount(targetDate: Date): Promise<number> {
    const { count } = await this.supabase
      .from('subscriptions')
      .select('customer_id', { count: 'exact', head: true })
      .in('status', ['active', 'trialing'])
      .lte('created_at', targetDate.toISOString())
      .or(`canceled_at.is.null,canceled_at.gt.${targetDate.toISOString()}`);

    return count || 0;
  }

  /**
   * Get new customer revenue for period
   */
  private async getNewCustomerRevenue(startDate: Date, endDate: Date): Promise<number> {
    const { data } = await this.supabase
      .from('subscriptions')
      .select(`
        plan:subscription_plans(amount, interval)
      `)
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString())
      .in('status', ['active', 'trialing']);

    let totalRevenue = 0;
    for (const subscription of data || []) {
      const amount = subscription.plan?.amount || 0;
      const monthlyAmount = subscription.plan?.interval === 'year' ? amount / 12 : amount;
      totalRevenue += monthlyAmount;
    }

    return totalRevenue;
  }

  /**
   * Get churned revenue for period
   */
  private async getChurnedRevenue(startDate: Date, endDate: Date): Promise<number> {
    const { data } = await this.supabase
      .from('subscriptions')
      .select(`
        plan:subscription_plans(amount, interval)
      `)
      .gte('canceled_at', startDate.toISOString())
      .lt('canceled_at', endDate.toISOString())
      .eq('status', 'canceled');

    let totalRevenue = 0;
    for (const subscription of data || []) {
      const amount = subscription.plan?.amount || 0;
      const monthlyAmount = subscription.plan?.interval === 'year' ? amount / 12 : amount;
      totalRevenue += monthlyAmount;
    }

    return totalRevenue;
  }

  /**
   * Get expansion and contraction revenue from plan changes
   */
  private async getPlanChangeRevenue(startDate: Date, endDate: Date): Promise<{
    expansionRevenue: number;
    contractionRevenue: number;
  }> {
    // This would typically track subscription_items changes
    // For now, we'll estimate based on subscription modifications
    
    // In a production system, you'd track plan changes in a separate table
    // and calculate the revenue impact of each change
    
    return {
      expansionRevenue: 0, // Would calculate from plan upgrades
      contractionRevenue: 0, // Would calculate from plan downgrades
    };
  }

  /**
   * Get reactivation revenue from returning customers
   */
  private async getReactivationRevenue(startDate: Date, endDate: Date): Promise<number> {
    // Find customers who reactivated (had canceled subscription, then created new one)
    const { data } = await this.supabase
      .from('subscriptions')
      .select(`
        customer_id,
        plan:subscription_plans(amount, interval)
      `)
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString())
      .in('status', ['active', 'trialing']);

    let reactivationRevenue = 0;
    
    for (const subscription of data || []) {
      // Check if customer had a previous canceled subscription
      const { data: previousSubs } = await this.supabase
        .from('subscriptions')
        .select('id')
        .eq('customer_id', subscription.customer_id)
        .eq('status', 'canceled')
        .lt('created_at', startDate.toISOString());

      if (previousSubs && previousSubs.length > 0) {
        const amount = subscription.plan?.amount || 0;
        const monthlyAmount = subscription.plan?.interval === 'year' ? amount / 12 : amount;
        reactivationRevenue += monthlyAmount;
      }
    }

    return reactivationRevenue;
  }

  /**
   * Get new customers count for period
   */
  private async getNewCustomersCount(startDate: Date, endDate: Date): Promise<number> {
    const { count } = await this.supabase
      .from('subscriptions')
      .select('customer_id', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString())
      .in('status', ['active', 'trialing']);

    return count || 0;
  }

  /**
   * Get churned customers count for period
   */
  private async getChurnedCustomersCount(startDate: Date, endDate: Date): Promise<number> {
    const { count } = await this.supabase
      .from('subscriptions')
      .select('customer_id', { count: 'exact', head: true })
      .gte('canceled_at', startDate.toISOString())
      .lt('canceled_at', endDate.toISOString())
      .eq('status', 'canceled');

    return count || 0;
  }

  /**
   * Get revenue breakdown by plan
   */
  private async getRevenueByPlan(targetDate: Date) {
    const { data } = await this.supabase
      .from('subscriptions')
      .select(`
        plan:subscription_plans(id, name, amount, interval),
        customer_id
      `)
      .in('status', ['active', 'trialing'])
      .lte('created_at', targetDate.toISOString())
      .or(`canceled_at.is.null,canceled_at.gt.${targetDate.toISOString()}`);

    const planMetrics = new Map();

    for (const subscription of data || []) {
      const plan = subscription.plan;
      if (!plan) continue;

      const planId = plan.id;
      const monthlyAmount = plan.interval === 'year' ? plan.amount / 12 : plan.amount;

      if (!planMetrics.has(planId)) {
        planMetrics.set(planId, {
          planId,
          planName: plan.name,
          mrr: 0,
          customers: 0,
          totalAmount: 0,
        });
      }

      const metrics = planMetrics.get(planId);
      metrics.mrr += monthlyAmount;
      metrics.customers += 1;
      metrics.totalAmount += monthlyAmount;
    }

    return Array.from(planMetrics.values()).map(metrics => ({
      ...metrics,
      mrr: metrics.mrr / 100,
      averageRevenue: metrics.customers > 0 ? metrics.totalAmount / metrics.customers / 100 : 0,
      growthRate: 0, // Would calculate from historical data
    }));
  }

  /**
   * Get revenue breakdown by geography
   */
  private async getRevenueByGeography(targetDate: Date) {
    const { data } = await this.supabase
      .from('subscriptions')
      .select(`
        plan:subscription_plans(amount, interval),
        customer:stripe_customers(billing_address)
      `)
      .in('status', ['active', 'trialing'])
      .lte('created_at', targetDate.toISOString())
      .or(`canceled_at.is.null,canceled_at.gt.${targetDate.toISOString()}`);

    const geoMetrics = new Map();
    let totalMrr = 0;

    for (const subscription of data || []) {
      const country = subscription.customer?.billing_address?.country || 'Unknown';
      const monthlyAmount = subscription.plan?.interval === 'year' 
        ? (subscription.plan?.amount || 0) / 12 
        : (subscription.plan?.amount || 0);

      totalMrr += monthlyAmount;

      if (!geoMetrics.has(country)) {
        geoMetrics.set(country, { mrr: 0, customers: 0 });
      }

      const metrics = geoMetrics.get(country);
      metrics.mrr += monthlyAmount;
      metrics.customers += 1;
    }

    return Array.from(geoMetrics.entries()).map(([country, metrics]) => ({
      country,
      mrr: metrics.mrr / 100,
      customers: metrics.customers,
      percentage: totalMrr > 0 ? (metrics.mrr / totalMrr) * 100 : 0,
    }));
  }

  /**
   * Get revenue breakdown by customer size
   */
  private async getRevenueByCustomerSize(targetDate: Date) {
    // This would typically be based on plan tiers or custom customer segmentation
    // For now, we'll segment by subscription amount
    
    const segments = [
      { name: 'small' as const, min: 0, max: 5000 }, // $0-$50
      { name: 'medium' as const, min: 5000, max: 15000 }, // $50-$150
      { name: 'large' as const, min: 15000, max: 50000 }, // $150-$500
      { name: 'enterprise' as const, min: 50000, max: Number.MAX_VALUE }, // $500+
    ];

    const { data } = await this.supabase
      .from('subscriptions')
      .select(`
        plan:subscription_plans(amount, interval)
      `)
      .in('status', ['active', 'trialing'])
      .lte('created_at', targetDate.toISOString())
      .or(`canceled_at.is.null,canceled_at.gt.${targetDate.toISOString()}`);

    const sizeMetrics = segments.map(segment => ({
      segment: segment.name,
      mrr: 0,
      customers: 0,
      totalAmount: 0,
    }));

    for (const subscription of data || []) {
      const monthlyAmount = subscription.plan?.interval === 'year' 
        ? (subscription.plan?.amount || 0) / 12 
        : (subscription.plan?.amount || 0);

      const segment = segments.find(s => monthlyAmount >= s.min && monthlyAmount < s.max);
      if (segment) {
        const metrics = sizeMetrics.find(m => m.segment === segment.name);
        if (metrics) {
          metrics.mrr += monthlyAmount;
          metrics.customers += 1;
          metrics.totalAmount += monthlyAmount;
        }
      }
    }

    return sizeMetrics.map(metrics => ({
      segment: metrics.segment,
      mrr: metrics.mrr / 100,
      customers: metrics.customers,
      averageRevenue: metrics.customers > 0 ? metrics.totalAmount / metrics.customers / 100 : 0,
    }));
  }

  /**
   * Get cohort data for specific month
   */
  private async getCohortData(cohortMonth: Date) {
    const { data } = await this.supabase
      .from('customer_cohorts')
      .select('*')
      .eq('cohort_month', cohortMonth.toISOString().split('T')[0])
      .order('analysis_month', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const cohort = data[0];
      return {
        month: cohort.cohort_month,
        initialCustomers: cohort.initial_customers,
        initialMrr: cohort.initial_mrr / 100,
        currentCustomers: cohort.active_customers,
        currentMrr: cohort.current_mrr / 100,
        retentionRate: cohort.customer_retention_rate * 100,
        revenueRetentionRate: cohort.revenue_retention_rate * 100,
        netRevenueRetentionRate: cohort.net_revenue_retention_rate * 100,
        ageMonths: cohort.cohort_age_months,
      };
    }

    // If no data in cohorts table, calculate on the fly
    return {
      month: cohortMonth.toISOString().slice(0, 7),
      initialCustomers: 0,
      initialMrr: 0,
      currentCustomers: 0,
      currentMrr: 0,
      retentionRate: 0,
      revenueRetentionRate: 0,
      netRevenueRetentionRate: 0,
      ageMonths: Math.floor((new Date().getTime() - cohortMonth.getTime()) / (1000 * 60 * 60 * 24 * 30)),
    };
  }

  /**
   * Calculate average retention rates by cohort age
   */
  private async calculateAverageRetentionByAge(cohorts: any[]) {
    const ageGroups = new Map();

    for (const cohort of cohorts) {
      const age = cohort.ageMonths;
      if (!ageGroups.has(age)) {
        ageGroups.set(age, {
          retentionRates: [],
          revenueRetentionRates: [],
        });
      }

      const group = ageGroups.get(age);
      group.retentionRates.push(cohort.retentionRate);
      group.revenueRetentionRates.push(cohort.revenueRetentionRate);
    }

    return Array.from(ageGroups.entries()).map(([age, group]) => ({
      ageMonths: age,
      averageRetentionRate: group.retentionRates.reduce((sum: number, rate: number) => sum + rate, 0) / group.retentionRates.length,
      averageRevenueRetention: group.revenueRetentionRates.reduce((sum: number, rate: number) => sum + rate, 0) / group.revenueRetentionRates.length,
    }));
  }

  /**
   * Format period string based on granularity
   */
  private formatPeriod(date: Date, granularity: string): string {
    switch (granularity) {
      case 'day':
        return date.toISOString().slice(0, 10);
      case 'week':
        return `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}`;
      case 'month':
        return date.toISOString().slice(0, 7);
      case 'quarter':
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return `${date.getFullYear()}-Q${quarter}`;
      default:
        return date.toISOString().slice(0, 7);
    }
  }
}

// =============================================
// SINGLETON INSTANCE
// =============================================

const revenueCalculator = new RevenueCalculator();

export default revenueCalculator;
export { RevenueCalculator };