/**
 * EPIC 5 STORY 5.6: Revenue Analytics & Business Intelligence
 * Revenue Analytics Test Suite
 * 
 * Comprehensive tests for revenue calculation and analytics functionality
 */

import { RevenueCalculator } from '@/lib/analytics/revenue-calculator';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase
jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: jest.fn(),
    rpc: jest.fn(),
  }),
}));

describe('Revenue Analytics', () => {
  let revenueCalculator: RevenueCalculator;
  let mockSupabase: any;

  beforeEach(() => {
    revenueCalculator = new RevenueCalculator();
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
      rpc: jest.fn(),
    };

    // Mock the createClient function
    (revenueCalculator as any).supabase = mockSupabase;
  });

  describe('Revenue Metrics Calculation', () => {
    test('should calculate current MRR correctly', async () => {
      const mockSubscriptions = [
        {
          plan: { amount: 2900, interval: 'month' }, // $29
          status: 'active',
        },
        {
          plan: { amount: 7900, interval: 'month' }, // $79
          status: 'active',
        },
        {
          plan: { amount: 23880, interval: 'year' }, // $199/month annually
          status: 'active',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: () => ({ data: mockSubscriptions }),
      });

      mockSupabase.rpc.mockResolvedValue({ data: 31780 }); // $317.80 MRR

      const metrics = await revenueCalculator.calculateRevenueMetrics();

      expect(metrics.current.mrr).toBeCloseTo(317.80, 2);
      expect(metrics.current.arr).toBeCloseTo(3813.60, 2);
    });

    test('should calculate MRR growth rate correctly', async () => {
      const currentMRR = 31780; // $317.80
      const previousMRR = 28000; // $280.00

      mockSupabase.rpc
        .mockResolvedValueOnce({ data: currentMRR })  // Current month
        .mockResolvedValueOnce({ data: previousMRR }); // Previous month

      mockSupabase.from.mockReturnValue({
        select: () => ({
          count: 'exact',
          head: true,
          data: null,
        }),
      });

      const metrics = await revenueCalculator.calculateRevenueMetrics();

      const expectedGrowthRate = ((currentMRR - previousMRR) / previousMRR) * 100;
      expect(metrics.growth.mrrGrowthRate).toBeCloseTo(expectedGrowthRate, 2);
    });

    test('should handle zero previous MRR correctly', async () => {
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: 31780 })  // Current month
        .mockResolvedValueOnce({ data: 0 });     // Previous month (first month)

      mockSupabase.from.mockReturnValue({
        select: () => ({
          count: 'exact',
          head: true,
          data: null,
        }),
      });

      const metrics = await revenueCalculator.calculateRevenueMetrics();

      expect(metrics.growth.mrrGrowthRate).toBe(0);
      expect(metrics.previous.mrr).toBe(0);
    });
  });

  describe('Revenue Attribution', () => {
    test('should calculate new customer revenue correctly', async () => {
      const mockNewSubscriptions = [
        { plan: { amount: 2900, interval: 'month' } },
        { plan: { amount: 7900, interval: 'month' } },
      ];

      mockSupabase.from.mockReturnValue({
        select: () => ({ data: mockNewSubscriptions }),
      });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const attribution = await revenueCalculator.calculateRevenueAttribution(startDate, endDate);

      const expectedNewRevenue = (2900 + 7900) / 100; // Convert from cents
      expect(attribution.newRevenue).toBe(expectedNewRevenue);
    });

    test('should calculate churned revenue correctly', async () => {
      const mockChurnedSubscriptions = [
        { plan: { amount: 2900, interval: 'month' } },
      ];

      // Mock new customer revenue query (empty)
      mockSupabase.from
        .mockReturnValueOnce({
          select: () => ({ data: [] }),
        })
        // Mock churned customer revenue query
        .mockReturnValueOnce({
          select: () => ({ data: mockChurnedSubscriptions }),
        });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const attribution = await revenueCalculator.calculateRevenueAttribution(startDate, endDate);

      const expectedChurnedRevenue = 2900 / 100; // Convert from cents
      expect(attribution.churnedRevenue).toBe(expectedChurnedRevenue);
    });

    test('should handle annual subscription revenue conversion', async () => {
      const mockSubscriptions = [
        { plan: { amount: 35880, interval: 'year' } }, // $299/year = $24.90/month
      ];

      mockSupabase.from.mockReturnValue({
        select: () => ({ data: mockSubscriptions }),
      });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const attribution = await revenueCalculator.calculateRevenueAttribution(startDate, endDate);

      const expectedMonthlyRevenue = (35880 / 12) / 100; // Convert to monthly, then to dollars
      expect(attribution.newRevenue).toBeCloseTo(expectedMonthlyRevenue, 2);
    });
  });

  describe('Revenue Trends', () => {
    test('should calculate revenue trend over time', async () => {
      const mockTrendData = [
        { mrr: 25000, customers: 100 }, // Month 1
        { mrr: 28000, customers: 110 }, // Month 2
        { mrr: 31780, customers: 125 }, // Month 3
      ];

      mockSupabase.rpc
        .mockResolvedValueOnce({ data: mockTrendData[0].mrr })
        .mockResolvedValueOnce({ data: mockTrendData[1].mrr })
        .mockResolvedValueOnce({ data: mockTrendData[2].mrr });

      mockSupabase.from.mockReturnValue({
        select: () => ({
          count: 'exact',
          head: true,
        }),
      });

      // Mock customer counts
      mockSupabase.select
        .mockResolvedValueOnce({ count: mockTrendData[0].customers })
        .mockResolvedValueOnce({ count: mockTrendData[1].customers })
        .mockResolvedValueOnce({ count: mockTrendData[2].customers });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-03-31');

      const trend = await revenueCalculator.getRevenueTrend({
        startDate,
        endDate,
        granularity: 'month',
      });

      expect(trend).toHaveLength(3);
      expect(trend[0].mrr).toBe(mockTrendData[0].mrr / 100);
      expect(trend[1].mrr).toBe(mockTrendData[1].mrr / 100);
      expect(trend[2].mrr).toBe(mockTrendData[2].mrr / 100);

      // Check growth rate calculation
      const expectedGrowthRate = ((mockTrendData[1].mrr - mockTrendData[0].mrr) / mockTrendData[0].mrr) * 100;
      expect(trend[1].growthRate).toBeCloseTo(expectedGrowthRate, 2);
    });

    test('should handle different granularities', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 31780 });
      mockSupabase.from.mockReturnValue({
        select: () => ({
          count: 'exact',
          head: true,
        }),
      });
      mockSupabase.select.mockResolvedValue({ count: 125 });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-14');

      const weeklyTrend = await revenueCalculator.getRevenueTrend({
        startDate,
        endDate,
        granularity: 'week',
      });

      expect(weeklyTrend).toHaveLength(2); // 2 weeks
    });
  });

  describe('Revenue Segmentation', () => {
    test('should segment revenue by plan correctly', async () => {
      const mockSubscriptions = [
        {
          plan: { id: 'plan-1', name: 'Starter', amount: 2900, interval: 'month' },
          customer_id: 'cust-1',
        },
        {
          plan: { id: 'plan-1', name: 'Starter', amount: 2900, interval: 'month' },
          customer_id: 'cust-2',
        },
        {
          plan: { id: 'plan-2', name: 'Professional', amount: 7900, interval: 'month' },
          customer_id: 'cust-3',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: () => ({ data: mockSubscriptions }),
      });

      const segmentation = await revenueCalculator.getRevenueSegmentation();

      expect(segmentation.byPlan).toHaveLength(2);

      const starterPlan = segmentation.byPlan.find(p => p.planName === 'Starter');
      expect(starterPlan).toBeDefined();
      expect(starterPlan?.customers).toBe(2);
      expect(starterPlan?.mrr).toBe(58); // $58 (2 * $29)

      const proPlan = segmentation.byPlan.find(p => p.planName === 'Professional');
      expect(proPlan).toBeDefined();
      expect(proPlan?.customers).toBe(1);
      expect(proPlan?.mrr).toBe(79); // $79
    });

    test('should segment revenue by geography', async () => {
      const mockSubscriptions = [
        {
          plan: { amount: 2900, interval: 'month' },
          customer: { billing_address: { country: 'US' } },
        },
        {
          plan: { amount: 7900, interval: 'month' },
          customer: { billing_address: { country: 'US' } },
        },
        {
          plan: { amount: 2900, interval: 'month' },
          customer: { billing_address: { country: 'CA' } },
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: () => ({ data: mockSubscriptions }),
      });

      const segmentation = await revenueCalculator.getRevenueSegmentation(
        new Date(),
        ['geography']
      );

      expect(segmentation.byGeography).toHaveLength(2);

      const usRevenue = segmentation.byGeography.find(g => g.country === 'US');
      expect(usRevenue).toBeDefined();
      expect(usRevenue?.customers).toBe(2);
      expect(usRevenue?.mrr).toBe(108); // $108 ($29 + $79)

      const caRevenue = segmentation.byGeography.find(g => g.country === 'CA');
      expect(caRevenue).toBeDefined();
      expect(caRevenue?.customers).toBe(1);
      expect(caRevenue?.mrr).toBe(29); // $29
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Database connection failed'));

      await expect(revenueCalculator.calculateRevenueMetrics()).rejects.toThrow(
        'Failed to calculate revenue metrics'
      );
    });

    test('should handle empty data sets', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 0 });
      mockSupabase.from.mockReturnValue({
        select: () => ({
          count: 'exact',
          head: true,
        }),
      });
      mockSupabase.select.mockResolvedValue({ count: 0 });

      const metrics = await revenueCalculator.calculateRevenueMetrics();

      expect(metrics.current.mrr).toBe(0);
      expect(metrics.current.arr).toBe(0);
      expect(metrics.current.customers).toBe(0);
    });

    test('should handle invalid date ranges', async () => {
      const startDate = new Date('2024-12-31');
      const endDate = new Date('2024-01-01'); // End before start

      mockSupabase.from.mockReturnValue({
        select: () => ({ data: [] }),
      });

      const trend = await revenueCalculator.getRevenueTrend({
        startDate,
        endDate,
        granularity: 'month',
      });

      expect(trend).toHaveLength(0);
    });
  });

  describe('Data Validation', () => {
    test('should validate configuration parameters', async () => {
      await expect(
        revenueCalculator.getRevenueTrend({
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
          granularity: 'invalid' as any,
        })
      ).rejects.toThrow();
    });

    test('should handle missing plan information', async () => {
      const mockSubscriptions = [
        { plan: null, customer_id: 'cust-1' },
        { plan: undefined, customer_id: 'cust-2' },
      ];

      mockSupabase.from.mockReturnValue({
        select: () => ({ data: mockSubscriptions }),
      });

      const segmentation = await revenueCalculator.getRevenueSegmentation();

      expect(segmentation.byPlan).toEqual([]);
    });
  });

  describe('Performance', () => {
    test('should handle large datasets efficiently', async () => {
      // Generate 1000 mock subscriptions
      const mockSubscriptions = Array.from({ length: 1000 }, (_, i) => ({
        plan: { id: `plan-${i % 10}`, name: `Plan ${i % 10}`, amount: 2900, interval: 'month' },
        customer_id: `cust-${i}`,
      }));

      mockSupabase.from.mockReturnValue({
        select: () => ({ data: mockSubscriptions }),
      });

      const startTime = Date.now();
      const segmentation = await revenueCalculator.getRevenueSegmentation();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
      expect(segmentation.byPlan.length).toBeGreaterThan(0);
    });
  });
});

describe('Revenue Calculator Integration', () => {
  test('should integrate with other analytics components', async () => {
    const revenueCalculator = new RevenueCalculator();
    
    // Mock minimal required data
    (revenueCalculator as any).supabase = {
      rpc: jest.fn().mockResolvedValue({ data: 31780 }),
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnValue({
        count: 'exact',
        head: true,
      }),
    };

    const metrics = await revenueCalculator.calculateRevenueMetrics();
    
    expect(metrics).toHaveProperty('current');
    expect(metrics).toHaveProperty('previous');
    expect(metrics).toHaveProperty('growth');
    
    expect(typeof metrics.current.mrr).toBe('number');
    expect(typeof metrics.current.arr).toBe('number');
    expect(typeof metrics.growth.mrrGrowthRate).toBe('number');
  });
});