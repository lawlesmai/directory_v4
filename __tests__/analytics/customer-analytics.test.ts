/**
 * EPIC 5 STORY 5.6: Revenue Analytics & Business Intelligence
 * Customer Analytics Test Suite
 * 
 * Comprehensive tests for customer analytics and churn prediction functionality
 */

import { CustomerAnalytics } from '@/lib/analytics/customer-analytics';

// Mock Supabase
jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: jest.fn(),
    select: jest.fn(),
    rpc: jest.fn(),
  }),
}));

describe('Customer Analytics', () => {
  let customerAnalytics: CustomerAnalytics;
  let mockSupabase: any;

  beforeEach(() => {
    customerAnalytics = new CustomerAnalytics();
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
    };

    (customerAnalytics as any).supabase = mockSupabase;
  });

  describe('Customer Acquisition Analysis', () => {
    test('should calculate customer acquisition metrics correctly', async () => {
      const mockNewCustomers = [
        {
          id: 'cust-1',
          metadata: { acquisition_channel: 'organic', acquisition_cost: 0 },
          subscriptions: [{ plan: { amount: 2900 } }],
        },
        {
          id: 'cust-2',
          metadata: { acquisition_channel: 'paid_search', acquisition_cost: 5000 },
          subscriptions: [{ plan: { amount: 7900 } }],
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: () => ({ 
          count: 'exact', 
          head: true 
        }),
      });

      // Mock total customers count
      mockSupabase.select
        .mockResolvedValueOnce({ count: 1000 }) // Total customers
        .mockResolvedValueOnce({ count: 180 });  // Previous period customers

      // Mock new customers data
      mockSupabase.from.mockReturnValueOnce({
        select: () => ({ data: mockNewCustomers }),
      });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const acquisitionMetrics = await customerAnalytics.analyzeCustomerAcquisition({
        startDate,
        endDate,
        granularity: 'month',
      });

      expect(acquisitionMetrics.newCustomersThisPeriod).toBe(2);
      expect(acquisitionMetrics.acquisitionCost.byChannel).toHaveLength(2);
      
      const organicChannel = acquisitionMetrics.acquisitionCost.byChannel.find(
        c => c.channel === 'organic'
      );
      expect(organicChannel?.costPerCustomer).toBe(0);

      const paidChannel = acquisitionMetrics.acquisitionCost.byChannel.find(
        c => c.channel === 'paid_search'
      );
      expect(paidChannel?.costPerCustomer).toBe(50); // 5000 cents = $50
    });

    test('should calculate customer growth rate correctly', async () => {
      mockSupabase.from.mockReturnValue({
        select: () => ({ count: 'exact', head: true }),
      });

      mockSupabase.select
        .mockResolvedValueOnce({ count: 1000 }) // Total customers
        .mockResolvedValueOnce({ count: 200 })  // New customers this period
        .mockResolvedValueOnce({ count: 150 }); // New customers previous period

      mockSupabase.from.mockReturnValueOnce({
        select: () => ({ data: [] }),
      });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const acquisitionMetrics = await customerAnalytics.analyzeCustomerAcquisition({
        startDate,
        endDate,
        granularity: 'month',
      });

      const expectedGrowthRate = ((200 - 150) / 150) * 100;
      expect(acquisitionMetrics.customerGrowthRate).toBeCloseTo(expectedGrowthRate, 2);
    });
  });

  describe('Customer Lifetime Value (LTV)', () => {
    test('should calculate LTV correctly for active customers', async () => {
      const mockCustomers = [
        {
          id: 'cust-1',
          subscriptions: [
            {
              created_at: '2023-01-01T00:00:00Z',
              canceled_at: null, // Still active
              plan: { amount: 2900, interval: 'month' },
            },
          ],
        },
        {
          id: 'cust-2',
          subscriptions: [
            {
              created_at: '2023-06-01T00:00:00Z',
              canceled_at: '2024-01-01T00:00:00Z',
              plan: { amount: 7900, interval: 'month' },
            },
          ],
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: () => ({ data: mockCustomers }),
      });

      const ltvMetrics = await customerAnalytics.calculateCustomerLifetimeValue();

      expect(ltvMetrics.overall.totalCustomers).toBe(2);
      expect(ltvMetrics.overall.averageLTV).toBeGreaterThan(0);
      expect(ltvMetrics.overall.medianLTV).toBeGreaterThan(0);
    });

    test('should handle annual subscriptions in LTV calculation', async () => {
      const mockCustomers = [
        {
          id: 'cust-1',
          subscriptions: [
            {
              created_at: '2023-01-01T00:00:00Z',
              canceled_at: '2024-01-01T00:00:00Z', // 12 months
              plan: { amount: 29900, interval: 'year' }, // $299/year
            },
          ],
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: () => ({ data: mockCustomers }),
      });

      const ltvMetrics = await customerAnalytics.calculateCustomerLifetimeValue();

      // Should calculate LTV as ~$299 (annual amount for 1 year)
      expect(ltvMetrics.overall.averageLTV).toBeCloseTo(299, 0);
    });

    test('should segment LTV by customer value', async () => {
      const mockCustomers = [
        {
          id: 'cust-1',
          subscriptions: [
            {
              created_at: '2022-01-01T00:00:00Z',
              canceled_at: null,
              plan: { amount: 19900, interval: 'month' }, // High value
            },
          ],
        },
        {
          id: 'cust-2',
          subscriptions: [
            {
              created_at: '2023-01-01T00:00:00Z',
              canceled_at: null,
              plan: { amount: 2900, interval: 'month' }, // Low value
            },
          ],
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: () => ({ data: mockCustomers }),
      });

      const ltvMetrics = await customerAnalytics.calculateCustomerLifetimeValue();

      expect(ltvMetrics.bySegment.length).toBeGreaterThan(0);
      
      const segments = ltvMetrics.bySegment.map(s => s.segment);
      expect(segments).toContain('high_value');
      expect(segments).toContain('low_value');
    });
  });

  describe('Churn Analysis', () => {
    test('should calculate churn rate correctly', async () => {
      const mockChurnedCustomers = [
        {
          customer_id: 'cust-1',
          canceled_at: '2024-01-15T00:00:00Z',
          plan: { amount: 2900 },
          metadata: { cancellation_reason: 'price' },
        },
        {
          customer_id: 'cust-2',
          canceled_at: '2024-01-20T00:00:00Z',
          plan: { amount: 7900 },
          metadata: { cancellation_reason: 'features' },
        },
      ];

      mockSupabase.from
        .mockReturnValueOnce({
          select: () => ({ data: mockChurnedCustomers }),
        })
        .mockReturnValueOnce({
          select: () => ({ count: 100 }), // Total customers at start
        });

      // Mock MRR calculation
      (customerAnalytics as any).supabase.rpc = jest.fn().mockResolvedValue({ data: 50000 });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const churnAnalysis = await customerAnalytics.analyzeChurn({
        period: { startDate, endDate },
        includePredictions: false,
        riskThreshold: 0.7,
      });

      expect(churnAnalysis.overview.churnedCustomers).toBe(2);
      expect(churnAnalysis.overview.customerChurnRate).toBe(2); // 2/100 * 100 = 2%
      
      expect(churnAnalysis.churnFactors.byReason).toHaveLength(2);
      const priceReason = churnAnalysis.churnFactors.byReason.find(r => r.reason === 'price');
      expect(priceReason?.count).toBe(1);
      expect(priceReason?.percentage).toBe(50);
    });

    test('should categorize voluntary vs involuntary churn', async () => {
      const mockChurnedCustomers = [
        {
          customer_id: 'cust-1',
          metadata: { cancellation_reason: 'price' }, // Voluntary
        },
        {
          customer_id: 'cust-2',
          metadata: { cancellation_reason: 'payment_failed' }, // Involuntary
        },
      ];

      mockSupabase.from
        .mockReturnValueOnce({
          select: () => ({ data: mockChurnedCustomers }),
        })
        .mockReturnValueOnce({
          select: () => ({ count: 100 }),
        });

      (customerAnalytics as any).supabase.rpc = jest.fn().mockResolvedValue({ data: 50000 });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const churnAnalysis = await customerAnalytics.analyzeChurn({
        period: { startDate, endDate },
        includePredictions: false,
        riskThreshold: 0.7,
      });

      expect(churnAnalysis.overview.churnedCustomers).toBe(2);
      expect(churnAnalysis.voluntaryChurn).toBe(50); // 1 out of 2 = 50%
      expect(churnAnalysis.involuntaryChurn).toBe(50); // 1 out of 2 = 50%
    });
  });

  describe('Cohort Analysis', () => {
    test('should generate cohort data correctly', async () => {
      // Mock cohort data from database
      mockSupabase.from.mockReturnValue({
        select: () => ({
          data: [
            {
              cohort_month: '2023-01-01',
              analysis_month: '2023-02-01',
              initial_customers: 100,
              active_customers: 85,
              customer_retention_rate: 0.85,
              revenue_retention_rate: 0.90,
              net_revenue_retention_rate: 0.95,
              cohort_age_months: 1,
            },
          ],
        }),
      });

      const cohortAnalysis = await customerAnalytics.generateCohortAnalysis(3);

      expect(cohortAnalysis.retentionCohorts).toHaveLength(3);
      
      const firstCohort = cohortAnalysis.retentionCohorts[0];
      expect(firstCohort.size).toBe(100);
      expect(firstCohort.retentionRates).toContain(85); // 85% retention
      expect(firstCohort.revenueRetention).toContain(90); // 90% revenue retention
    });

    test('should calculate cohort metrics correctly', async () => {
      mockSupabase.from.mockReturnValue({
        select: () => ({
          data: [
            {
              cohort_month: '2023-01-01',
              customer_retention_rate: 0.85,
              revenue_retention_rate: 0.90,
              cohort_age_months: 1,
            },
            {
              cohort_month: '2023-02-01',
              customer_retention_rate: 0.80,
              revenue_retention_rate: 0.88,
              cohort_age_months: 1,
            },
          ],
        }),
      });

      const cohortAnalysis = await customerAnalytics.generateCohortAnalysis(2);

      expect(cohortAnalysis.cohortMetrics.averageRetentionByMonth).toHaveLength(1);
      expect(cohortAnalysis.cohortMetrics.averageRetentionByMonth[0].retentionRate).toBeCloseTo(82.5, 1);
    });
  });

  describe('Customer Segmentation', () => {
    test('should segment customers by revenue correctly', async () => {
      const mockCustomers = [
        {
          id: 'cust-1',
          subscriptions: [
            { plan: { amount: 29900, interval: 'month' } }, // High value
          ],
        },
        {
          id: 'cust-2',
          subscriptions: [
            { plan: { amount: 2900, interval: 'month' } }, // Low value
          ],
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: () => ({ data: mockCustomers }),
      });

      const segmentation = await customerAnalytics.segmentCustomers({
        segmentBy: ['revenue'],
        includeHealthScore: true,
        includeChurnRisk: true,
      });

      expect(segmentation.segments.length).toBeGreaterThan(0);
      
      const segments = segmentation.segments.map(s => s.name);
      expect(segments).toContain('high_value');
      expect(segments).toContain('low_value');
    });

    test('should calculate health scoring correctly', async () => {
      const mockCustomers = [
        {
          id: 'cust-1',
          subscriptions: [
            { status: 'active', plan: { amount: 29900 } },
          ],
        },
        {
          id: 'cust-2',
          subscriptions: [
            { status: 'canceled', plan: { amount: 2900 } },
          ],
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: () => ({ data: mockCustomers }),
      });

      const segmentation = await customerAnalytics.segmentCustomers({
        segmentBy: ['revenue'],
        includeHealthScore: true,
        includeChurnRisk: true,
      });

      expect(segmentation.healthScoring.champion).toBeGreaterThan(0);
      expect(segmentation.healthScoring.critical).toBeGreaterThan(0);
      
      const totalHealth = Object.values(segmentation.healthScoring).reduce((sum, count) => sum + count, 0);
      expect(totalHealth).toBe(mockCustomers.length);
    });
  });

  describe('Customer Journey Analysis', () => {
    test('should analyze acquisition funnel correctly', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const journeyAnalysis = await customerAnalytics.analyzeCustomerJourney({
        startDate,
        endDate,
        granularity: 'month',
      });

      expect(journeyAnalysis).toHaveProperty('acquisitionFunnel');
      expect(journeyAnalysis).toHaveProperty('timeToValue');
      expect(journeyAnalysis).toHaveProperty('engagementMetrics');

      expect(journeyAnalysis.acquisitionFunnel).toHaveProperty('visitors');
      expect(journeyAnalysis.acquisitionFunnel).toHaveProperty('signups');
      expect(journeyAnalysis.acquisitionFunnel).toHaveProperty('trials');
      expect(journeyAnalysis.acquisitionFunnel).toHaveProperty('conversions');
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(
        customerAnalytics.analyzeCustomerAcquisition({
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
          granularity: 'month',
        })
      ).rejects.toThrow('Failed to analyze customer acquisition');
    });

    test('should handle empty customer datasets', async () => {
      mockSupabase.from.mockReturnValue({
        select: () => ({ data: [] }),
      });

      const ltvMetrics = await customerAnalytics.calculateCustomerLifetimeValue();

      expect(ltvMetrics.overall.totalCustomers).toBe(0);
      expect(ltvMetrics.overall.averageLTV).toBe(0);
      expect(ltvMetrics.bySegment).toEqual([]);
    });
  });

  describe('Data Validation', () => {
    test('should validate input parameters', async () => {
      await expect(
        customerAnalytics.analyzeCustomerAcquisition({
          startDate: new Date('invalid'),
          endDate: new Date('2024-01-31'),
          granularity: 'month',
        })
      ).rejects.toThrow();
    });

    test('should handle missing customer metadata', async () => {
      const mockCustomers = [
        {
          id: 'cust-1',
          metadata: null,
          subscriptions: [
            { plan: { amount: 2900 } },
          ],
        },
      ];

      mockSupabase.from
        .mockReturnValueOnce({
          select: () => ({ count: 1000 }),
        })
        .mockReturnValueOnce({
          select: () => ({ count: 100 }),
        })
        .mockReturnValueOnce({
          select: () => ({ data: mockCustomers }),
        });

      const acquisitionMetrics = await customerAnalytics.analyzeCustomerAcquisition({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        granularity: 'month',
      });

      expect(acquisitionMetrics.acquisitionCost.byChannel).toHaveLength(1);
      expect(acquisitionMetrics.acquisitionCost.byChannel[0].channel).toBe('unknown');
    });
  });

  describe('Performance', () => {
    test('should handle large customer datasets efficiently', async () => {
      // Generate 1000 mock customers
      const mockCustomers = Array.from({ length: 1000 }, (_, i) => ({
        id: `cust-${i}`,
        subscriptions: [
          {
            created_at: '2023-01-01T00:00:00Z',
            canceled_at: Math.random() > 0.8 ? '2024-01-01T00:00:00Z' : null,
            plan: { amount: Math.floor(Math.random() * 20000) + 1000, interval: 'month' },
          },
        ],
      }));

      mockSupabase.from.mockReturnValue({
        select: () => ({ data: mockCustomers }),
      });

      const startTime = Date.now();
      const ltvMetrics = await customerAnalytics.calculateCustomerLifetimeValue();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(ltvMetrics.overall.totalCustomers).toBe(1000);
    });
  });
});

describe('Customer Analytics Integration', () => {
  test('should integrate with other analytics components', async () => {
    const customerAnalytics = new CustomerAnalytics();
    
    // Mock minimal required data
    (customerAnalytics as any).supabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnValue({
        data: [
          {
            id: 'cust-1',
            subscriptions: [
              {
                created_at: '2023-01-01T00:00:00Z',
                canceled_at: null,
                plan: { amount: 2900, interval: 'month' },
              },
            ],
          },
        ],
      }),
    };

    const ltvMetrics = await customerAnalytics.calculateCustomerLifetimeValue();
    
    expect(ltvMetrics).toHaveProperty('overall');
    expect(ltvMetrics).toHaveProperty('bySegment');
    expect(ltvMetrics).toHaveProperty('byPlan');
    
    expect(typeof ltvMetrics.overall.averageLTV).toBe('number');
    expect(typeof ltvMetrics.overall.ltvcacRatio).toBe('number');
  });
});