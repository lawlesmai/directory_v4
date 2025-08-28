/**
 * EPIC 5 STORY 5.2: Subscription Management & Billing System Tests
 * Subscription Analytics Service Tests
 * 
 * Comprehensive test suite for subscription analytics and forecasting
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import subscriptionAnalytics from '@/lib/payments/subscription-analytics';

// Mock dependencies
jest.mock('@/lib/supabase/server');

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(),
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

// Mock data
const mockSubscriptionsData = [
  {
    id: 'sub_1',
    created_at: '2024-01-01T00:00:00Z',
    canceled_at: null,
    status: 'active',
    plan: { amount: 2900, interval: 'month' }, // $29.00
  },
  {
    id: 'sub_2',
    created_at: '2024-01-01T00:00:00Z',
    canceled_at: '2024-01-15T00:00:00Z',
    status: 'canceled',
    plan: { amount: 7900, interval: 'month' }, // $79.00
  },
  {
    id: 'sub_3',
    created_at: '2024-01-15T00:00:00Z',
    canceled_at: null,
    status: 'active',
    plan: { amount: 19900, interval: 'year' }, // $199.00 yearly
  },
];

const mockCustomersData = [
  {
    id: 'cust_1',
    subscriptions: [
      {
        id: 'sub_1',
        created_at: '2024-01-01T00:00:00Z',
        canceled_at: '2024-06-01T00:00:00Z',
        plan: { amount: 2900 },
      },
    ],
  },
  {
    id: 'cust_2',
    subscriptions: [
      {
        id: 'sub_2',
        created_at: '2024-01-01T00:00:00Z',
        canceled_at: null,
        plan: { amount: 7900 },
      },
    ],
  },
];

const mockTrialSubscriptions = [
  {
    id: 'sub_trial_1',
    trial_start: '2024-01-01T00:00:00Z',
    trial_end: '2024-01-15T00:00:00Z',
    status: 'active',
    customer: { metadata: { acquisition_source: 'website' } },
  },
  {
    id: 'sub_trial_2',
    trial_start: '2024-01-01T00:00:00Z',
    trial_end: '2024-01-15T00:00:00Z',
    status: 'canceled',
    customer: { metadata: { acquisition_source: 'referral' } },
  },
];

describe('Subscription Analytics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock behavior
    mockSupabase.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        in: jest.fn().mockReturnValue({
          lt: jest.fn().mockReturnValue({
            or: jest.fn().mockResolvedValue({ data: mockSubscriptionsData }),
          }),
          gte: jest.fn().mockReturnValue({
            lt: jest.fn().mockResolvedValue({ data: mockSubscriptionsData }),
          }),
        }),
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockSubscriptionsData[0] }),
        }),
        gte: jest.fn().mockReturnValue({
          lt: jest.fn().mockResolvedValue({ data: mockSubscriptionsData }),
        }),
      }),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('calculateMRR', () => {
    it('should calculate Monthly Recurring Revenue breakdown', async () => {
      // Mock current and previous month data
      jest.spyOn(subscriptionAnalytics as any, 'getMRRForMonth')
        .mockResolvedValueOnce(12000) // Current MRR: $120.00
        .mockResolvedValueOnce(10000); // Previous MRR: $100.00

      jest.spyOn(subscriptionAnalytics as any, 'calculateMRRMovement')
        .mockResolvedValue({
          newMRR: 3000,
          expansionMRR: 1000,
          contractionMRR: 500,
          churnedMRR: 1500,
        });

      const result = await subscriptionAnalytics.calculateMRR();

      expect(result).toMatchObject({
        currentMRR: 12000,
        previousMRR: 10000,
        mrrGrowth: 2000,
        mrrGrowthRate: 20, // 20% growth
        newMRR: 3000,
        expansionMRR: 1000,
        contractionMRR: 500,
        churnedMRR: 1500,
        netNewMRR: 2000, // 3000 + 1000 - 500 - 1500
      });
    });

    it('should handle zero previous MRR', async () => {
      jest.spyOn(subscriptionAnalytics as any, 'getMRRForMonth')
        .mockResolvedValueOnce(5000) // Current MRR: $50.00
        .mockResolvedValueOnce(0); // Previous MRR: $0.00

      jest.spyOn(subscriptionAnalytics as any, 'calculateMRRMovement')
        .mockResolvedValue({
          newMRR: 5000,
          expansionMRR: 0,
          contractionMRR: 0,
          churnedMRR: 0,
        });

      const result = await subscriptionAnalytics.calculateMRR();

      expect(result.mrrGrowthRate).toBe(0); // No growth rate calculation when previous is 0
      expect(result.netNewMRR).toBe(5000);
    });
  });

  describe('calculateARR', () => {
    it('should calculate Annual Recurring Revenue metrics', async () => {
      jest.spyOn(subscriptionAnalytics as any, 'getMRRForMonth')
        .mockResolvedValueOnce(10000) // Current MRR: $100.00
        .mockResolvedValueOnce(8000); // Previous year MRR: $80.00

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({ 
            data: [
              { plan: { amount: 2900, interval: 'month' } },
              { plan: { amount: 7900, interval: 'month' } },
              { plan: { amount: 19900, interval: 'year' } },
            ] 
          }),
        }),
      });

      const result = await subscriptionAnalytics.calculateARR();

      expect(result).toMatchObject({
        currentARR: 120000, // $10,000 MRR * 12
        arrGrowthRate: 25, // 25% growth from previous year
        customerCount: 3,
        averageContractValue: expect.any(Number),
      });
    });
  });

  describe('getMRRTrend', () => {
    it('should return MRR trend over specified months', async () => {
      jest.spyOn(subscriptionAnalytics as any, 'getMRRForMonth')
        .mockResolvedValueOnce(8000)  // 3 months ago
        .mockResolvedValueOnce(9000)  // 2 months ago
        .mockResolvedValueOnce(10000); // 1 month ago

      const result = await subscriptionAnalytics.getMRRTrend(3);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        month: expect.stringMatching(/^\d{4}-\d{2}$/),
        mrr: 8000,
      });
      expect(result[1].mrr).toBe(9000);
      expect(result[2].mrr).toBe(10000);
    });
  });

  describe('analyzeChurn', () => {
    it('should analyze churn rates and patterns', async () => {
      const churnedSubscriptions = [
        {
          id: 'sub_1',
          plan: { amount: 2900 },
          customer: {},
          metadata: { cancellation_reason: 'too_expensive' },
        },
        {
          id: 'sub_2',
          plan: { amount: 7900 },
          customer: {},
          metadata: { cancellation_reason: 'not_using_enough' },
        },
      ];

      mockSupabase.from = jest.fn().mockImplementation((table) => {
        if (table === 'subscriptions') {
          return {
            select: jest.fn().mockImplementation((query) => {
              if (query.includes('count')) {
                return {
                  in: jest.fn().mockReturnValue({
                    lt: jest.fn().mockResolvedValue({ count: 100 }),
                  }),
                };
              }
              return {
                select: jest.fn().mockReturnValue({
                  in: jest.fn().mockReturnValue({
                    gte: jest.fn().mockReturnValue({
                      lt: jest.fn().mockResolvedValue({ data: churnedSubscriptions }),
                    }),
                  }),
                }),
              };
            }),
          };
        }
        return { select: jest.fn() };
      });

      jest.spyOn(subscriptionAnalytics as any, 'getMRRForMonth')
        .mockResolvedValue(50000); // $500.00 total MRR

      const period = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const result = await subscriptionAnalytics.analyzeChurn(period);

      expect(result).toMatchObject({
        customerChurn: {
          rate: 2, // 2 churned out of 100 customers = 2%
          count: 2,
          totalCustomers: 100,
        },
        revenueChurn: {
          rate: expect.any(Number),
          amount: 10800, // $29.00 + $79.00 = $108.00
          totalRevenue: 50000,
        },
        churnReasons: expect.arrayContaining([
          expect.objectContaining({
            reason: 'too_expensive',
            count: 1,
            percentage: 50,
          }),
        ]),
      });
    });
  });

  describe('generateCohortAnalysis', () => {
    it('should generate cohort analysis data', async () => {
      const cohortCustomers = [
        {
          id: 'sub_1',
          customer_id: 'cust_1',
          created_at: '2024-01-01T00:00:00Z',
          canceled_at: '2024-03-01T00:00:00Z', // Canceled after 2 months
          plan: { amount: 2900 },
        },
        {
          id: 'sub_2',
          customer_id: 'cust_2',
          created_at: '2024-01-01T00:00:00Z',
          canceled_at: null, // Still active
          plan: { amount: 7900 },
        },
      ];

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lt: jest.fn().mockResolvedValue({ data: cohortCustomers }),
          }),
        }),
      });

      // Mock current date for consistent testing
      jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-01').getTime());

      const result = await subscriptionAnalytics.generateCohortAnalysis(3);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        cohortMonth: expect.stringMatching(/^\d{4}-\d{2}$/),
        initialCustomers: expect.any(Number),
        retentionRates: expect.any(Array),
        revenueRetention: expect.any(Array),
        averageRevenue: expect.any(Array),
      });
    });
  });

  describe('analyzeConversionFunnel', () => {
    it('should analyze trial-to-paid conversion funnel', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lt: jest.fn().mockResolvedValue({ data: mockTrialSubscriptions }),
          }),
        }),
      });

      const period = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const result = await subscriptionAnalytics.analyzeConversionFunnel(period);

      expect(result).toMatchObject({
        trialStarts: 2,
        trialToActive: 1, // Only 1 active subscription
        trialToPaid: 1, // 1 converted to paid (active and no trial_end)
        conversionRate: 50, // 1 out of 2 = 50%
        averageTrialDuration: 14, // Default trial duration
        topConversionSources: expect.arrayContaining([
          expect.objectContaining({
            source: 'website',
            conversions: expect.any(Number),
            rate: expect.any(Number),
          }),
        ]),
      });
    });
  });

  describe('calculateCLV', () => {
    it('should calculate Customer Lifetime Value metrics', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: mockCustomersData }),
      });

      jest.spyOn(subscriptionAnalytics as any, 'getMRRForMonth')
        .mockResolvedValue(10000); // $100.00 MRR

      const result = await subscriptionAnalytics.calculateCLV();

      expect(result).toMatchObject({
        averageCLV: expect.any(Number),
        medianCLV: expect.any(Number),
        clvByPlan: expect.any(Array),
        paybackPeriod: expect.any(Number),
        ltvrRatio: expect.any(Number),
      });

      // CLV should be positive and reasonable
      expect(result.averageCLV).toBeGreaterThan(0);
      expect(result.medianCLV).toBeGreaterThan(0);
    });
  });

  describe('forecastRevenue', () => {
    it('should generate revenue forecasting projections', async () => {
      jest.spyOn(subscriptionAnalytics as any, 'getMRRTrend')
        .mockResolvedValue([
          { month: '2024-01', mrr: 8000 },
          { month: '2024-02', mrr: 9000 },
          { month: '2024-03', mrr: 10000 },
        ]);

      jest.spyOn(subscriptionAnalytics, 'analyzeChurn')
        .mockResolvedValue({
          period: '2024-03',
          customerChurn: { rate: 5, count: 5, totalCustomers: 100 },
          revenueChurn: { rate: 3, amount: 300, totalRevenue: 10000 },
          voluntaryChurn: 80,
          involuntaryChurn: 20,
          churnReasons: [],
        });

      const config = {
        period: 'monthly' as const,
        forecastMonths: 6,
        confidenceLevel: 95,
      };

      const result = await subscriptionAnalytics.forecastRevenue(config);

      expect(result).toMatchObject({
        period: 'monthly',
        forecastMonths: 6,
        projectedRevenue: expect.any(Array),
        assumptions: {
          churnRate: 5,
          growthRate: expect.any(Number),
          averageRevenue: 10000,
        },
      });

      expect(result.projectedRevenue).toHaveLength(6);
      expect(result.projectedRevenue[0]).toMatchObject({
        period: expect.stringMatching(/^\d{4}-\d{2}$/),
        projected: expect.any(Number),
        confidence: 95,
        lowerBound: expect.any(Number),
        upperBound: expect.any(Number),
      });
    });
  });

  describe('getDashboardMetrics', () => {
    it('should retrieve comprehensive analytics dashboard data', async () => {
      // Mock all required methods
      jest.spyOn(subscriptionAnalytics, 'calculateMRR')
        .mockResolvedValue({
          currentMRR: 10000,
          previousMRR: 8000,
          mrrGrowth: 2000,
          mrrGrowthRate: 25,
          newMRR: 3000,
          expansionMRR: 500,
          contractionMRR: 300,
          churnedMRR: 1200,
          netNewMRR: 2000,
        });

      jest.spyOn(subscriptionAnalytics, 'calculateARR')
        .mockResolvedValue({
          currentARR: 120000,
          projectedARR: 150000,
          arrGrowthRate: 25,
          averageContractValue: 4000,
          customerCount: 30,
        });

      jest.spyOn(subscriptionAnalytics, 'analyzeChurn')
        .mockResolvedValue({
          period: '2024-03',
          customerChurn: { rate: 5, count: 5, totalCustomers: 100 },
          revenueChurn: { rate: 3, amount: 300, totalRevenue: 10000 },
          voluntaryChurn: 80,
          involuntaryChurn: 20,
          churnReasons: [],
        });

      jest.spyOn(subscriptionAnalytics, 'analyzeConversionFunnel')
        .mockResolvedValue({
          trialStarts: 50,
          trialToActive: 35,
          trialToPaid: 30,
          conversionRate: 60,
          averageTrialDuration: 14,
          topConversionSources: [],
        });

      jest.spyOn(subscriptionAnalytics, 'calculateCLV')
        .mockResolvedValue({
          averageCLV: 1200,
          medianCLV: 1000,
          clvByPlan: [],
          paybackPeriod: 3,
          ltvrRatio: 4,
        });

      const result = await subscriptionAnalytics.getDashboardMetrics();

      expect(result).toMatchObject({
        mrr: expect.objectContaining({
          currentMRR: 10000,
          mrrGrowthRate: 25,
        }),
        arr: expect.objectContaining({
          currentARR: 120000,
          customerCount: 30,
        }),
        churn: expect.objectContaining({
          customerChurn: expect.objectContaining({ rate: 5 }),
        }),
        conversion: expect.objectContaining({
          conversionRate: 60,
        }),
        clv: expect.objectContaining({
          averageCLV: 1200,
          ltvrRatio: 4,
        }),
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully in MRR calculation', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockReturnValue({
            lt: jest.fn().mockReturnValue({
              or: jest.fn().mockRejectedValue(new Error('Database error')),
            }),
          }),
        }),
      });

      await expect(subscriptionAnalytics.calculateMRR())
        .rejects.toThrow('Failed to calculate MRR');
    });

    it('should handle empty data sets', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({ data: [] }),
        }),
      });

      jest.spyOn(subscriptionAnalytics as any, 'getMRRForMonth')
        .mockResolvedValue(0);

      const result = await subscriptionAnalytics.calculateMRR();

      expect(result.currentMRR).toBe(0);
      expect(result.previousMRR).toBe(0);
      expect(result.mrrGrowthRate).toBe(0);
    });
  });

  describe('Private Methods', () => {
    it('should calculate MRR for specific month', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockReturnValue({
            lt: jest.fn().mockReturnValue({
              or: jest.fn().mockResolvedValue({ 
                data: [
                  { plan: { amount: 2900, interval: 'month' } },
                  { plan: { amount: 7900, interval: 'month' } },
                  { plan: { amount: 19900, interval: 'year' } }, // $199/year = ~$16.58/month
                ]
              }),
            }),
          }),
        }),
      });

      const targetMonth = new Date('2024-01-01');
      const mrr = await (subscriptionAnalytics as any).getMRRForMonth(targetMonth);

      // Expected: $29 + $79 + $16.58 = $124.58 = 12458 cents
      expect(mrr).toBeCloseTo(12458, 0);
    });
  });
});