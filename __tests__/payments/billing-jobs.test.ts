/**
 * EPIC 5 STORY 5.2: Subscription Management & Billing System Tests
 * Billing Jobs Processor Tests
 * 
 * Comprehensive test suite for automated billing job processing
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import billingJobsProcessor from '@/lib/payments/billing-jobs';
import billingService from '@/lib/payments/billing-service';
import subscriptionManager from '@/lib/payments/subscription-manager';

// Mock dependencies
jest.mock('@/lib/payments/billing-service');
jest.mock('@/lib/payments/subscription-manager');
jest.mock('@/lib/supabase/server');

const mockBillingService = billingService as jest.Mocked<typeof billingService>;
const mockSubscriptionManager = subscriptionManager as jest.Mocked<typeof subscriptionManager>;

// Mock data
const mockBillingResult = {
  processedSubscriptions: 5,
  successfulBillings: 4,
  failedBillings: 1,
  retryScheduled: 1,
  errors: [],
};

const mockTrialExpirationResult = {
  processedTrials: 3,
  convertedTrials: 2,
  expiredTrials: 1,
  notificationsSent: 2,
  errors: [],
};

const mockMetricsResult = {
  metricsUpdated: true,
  date: '2024-01-01',
  totalRevenue: 50000,
  newSubscriptions: 10,
  canceledSubscriptions: 2,
  activeSubscriptions: 100,
  churnRate: 2,
};

const mockExpiringTrials = [
  {
    id: 'sub_1',
    customer_id: 'cust_1',
    trial_end: new Date(Date.now() + 86400000).toISOString(), // 1 day from now
    customer: { email: 'test1@example.com' },
  },
  {
    id: 'sub_2',
    customer_id: 'cust_2',
    trial_end: new Date(Date.now() + 86400000).toISOString(),
    customer: { email: 'test2@example.com' },
  },
];

const mockExpiredTrials = [
  {
    id: 'sub_expired_1',
    status: 'trialing',
    trial_end: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
  },
];

const mockRenewingSubscriptions = [
  {
    id: 'sub_renew_1',
    current_period_end: new Date(Date.now() + 172800000).toISOString(), // 2 days from now
    customer: { email: 'renewal1@example.com' },
  },
];

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        gte: jest.fn().mockReturnValue({
          lt: jest.fn().mockResolvedValue({ data: mockExpiringTrials }),
        }),
        gt: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            range: jest.fn().mockResolvedValue({ data: [] }),
          }),
        }),
        filter: jest.fn().mockResolvedValue({ data: [] }),
        single: jest.fn().mockResolvedValue({ data: null }),
      }),
      gte: jest.fn().mockReturnValue({
        lt: jest.fn().mockResolvedValue({ 
          data: [
            { net_amount: 2900, refund_amount: 0, dispute_amount: 0, fee_amount: 100 },
            { net_amount: 7900, refund_amount: 0, dispute_amount: 0, fee_amount: 200 },
          ]
        }),
      }),
      count: jest.fn().mockResolvedValue({ count: 100 }),
    }),
    insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
    update: jest.fn().mockResolvedValue({ data: {}, error: null }),
    upsert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: mockMetricsResult, error: null }),
      }),
    }),
    delete: jest.fn().mockResolvedValue({ count: 5 }),
  }),
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

describe('Billing Jobs Processor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock billing service methods
    mockBillingService.processFailedPayments = jest.fn().mockResolvedValue(mockBillingResult);
    mockBillingService.suspendOverdueSubscriptions = jest.fn().mockResolvedValue(3);
    
    // Mock subscription manager methods
    mockSubscriptionManager.cancelImmediately = jest.fn().mockResolvedValue({
      id: 'sub_expired_1',
      status: 'canceled',
    } as any);
    
    // Mock console methods to avoid test output noise
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('runDailyBillingJobs', () => {
    it('should successfully run all daily billing jobs', async () => {
      const results = await billingJobsProcessor.runDailyBillingJobs();

      expect(results).toHaveLength(6); // All 6 default jobs
      
      const jobNames = results.map(r => r.jobName);
      expect(jobNames).toEqual(
        expect.arrayContaining([
          'retry-failed-payments',
          'process-trial-expirations',
          'suspend-overdue-accounts',
          'update-daily-metrics',
          'send-renewal-notifications',
          'cleanup-expired-data',
        ])
      );

      // All jobs should succeed
      results.forEach(result => {
        expect(result.status).toBe('success');
        expect(result.duration).toBeGreaterThan(0);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should run only selected jobs when config provided', async () => {
      const config = {
        retryFailedPayments: true,
        processTrialExpirations: false,
        suspendOverdueAccounts: false,
        updateMetrics: false,
        cleanupExpiredTokens: false,
        sendRenewalNotifications: false,
      };

      const results = await billingJobsProcessor.runDailyBillingJobs(config);

      expect(results).toHaveLength(1);
      expect(results[0].jobName).toBe('retry-failed-payments');
    });

    it('should handle job failures gracefully', async () => {
      mockBillingService.processFailedPayments = jest.fn().mockRejectedValue(new Error('Billing service error'));

      const results = await billingJobsProcessor.runDailyBillingJobs({
        retryFailedPayments: true,
        processTrialExpirations: false,
        suspendOverdueAccounts: false,
        updateMetrics: false,
        cleanupExpiredTokens: false,
        sendRenewalNotifications: false,
      });

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('failure');
      expect(results[0].errors).toHaveLength(1);
      expect(results[0].errors[0]).toBe('Billing service error');
    });
  });

  describe('processFailedPayments', () => {
    it('should process failed payments successfully', async () => {
      const result = await billingJobsProcessor['processFailedPayments']();

      expect(result).toEqual(mockBillingResult);
      expect(mockBillingService.processFailedPayments).toHaveBeenCalled();
    });

    it('should handle processing errors', async () => {
      mockBillingService.processFailedPayments = jest.fn().mockRejectedValue(new Error('Processing failed'));

      await expect(billingJobsProcessor['processFailedPayments']())
        .rejects.toThrow('Processing failed');
    });
  });

  describe('processTrialExpirations', () => {
    it('should process trial expirations successfully', async () => {
      // Mock expiring trials
      mockSupabase.from = jest.fn().mockImplementation((table) => {
        if (table === 'subscriptions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                lt: jest.fn().mockReturnValue({
                  gt: jest.fn().mockResolvedValue({ data: mockExpiringTrials }),
                }),
              }),
            }),
          };
        }
        if (table === 'payment_methods') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({ data: [{ id: 'pm_1' }] }),
              }),
            }),
          };
        }
        return { select: jest.fn() };
      });

      const result = await billingJobsProcessor['processTrialExpirations']();

      expect(result).toMatchObject({
        processedTrials: 2,
        convertedTrials: 2, // Both have payment methods
        expiredTrials: 0,
        notificationsSent: 0,
        errors: [],
      });
    });

    it('should send notifications for trials without payment methods', async () => {
      // Mock expiring trials without payment methods
      mockSupabase.from = jest.fn().mockImplementation((table) => {
        if (table === 'subscriptions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                lt: jest.fn().mockReturnValue({
                  gt: jest.fn().mockResolvedValue({ data: mockExpiringTrials }),
                }),
              }),
            }),
          };
        }
        if (table === 'payment_methods') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({ data: [] }), // No payment methods
              }),
            }),
          };
        }
        return { select: jest.fn() };
      });

      const result = await billingJobsProcessor['processTrialExpirations']();

      expect(result.notificationsSent).toBe(2);
    });

    it('should cancel expired trials', async () => {
      // Mock expired trials
      mockSupabase.from = jest.fn().mockImplementation((table) => {
        if (table === 'subscriptions') {
          const selectMock = jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              lt: jest.fn().mockImplementation((field, value) => {
                // First call for expiring trials (empty), second for expired trials
                const mockData = field === 'trial_end' && value < new Date().toISOString() 
                  ? mockExpiredTrials 
                  : [];
                return {
                  gt: jest.fn().mockResolvedValue({ data: mockData }),
                };
              }),
            }),
          });
          return { select: selectMock };
        }
        return { select: jest.fn() };
      });

      const result = await billingJobsProcessor['processTrialExpirations']();

      expect(result.expiredTrials).toBe(1);
      expect(mockSubscriptionManager.cancelImmediately).toHaveBeenCalledWith('sub_expired_1', false);
    });

    it('should handle errors during trial processing', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lt: jest.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      });

      const result = await billingJobsProcessor['processTrialExpirations']();

      expect(result.errors).toContain('Process trial expirations error: Database error');
    });
  });

  describe('suspendOverdueAccounts', () => {
    it('should suspend overdue accounts successfully', async () => {
      const result = await billingJobsProcessor['suspendOverdueAccounts']();

      expect(result).toBe(3);
      expect(mockBillingService.suspendOverdueSubscriptions).toHaveBeenCalled();
    });

    it('should handle suspension errors', async () => {
      mockBillingService.suspendOverdueSubscriptions = jest.fn().mockRejectedValue(new Error('Suspension failed'));

      await expect(billingJobsProcessor['suspendOverdueAccounts']())
        .rejects.toThrow('Suspension failed');
    });
  });

  describe('updateDailyMetrics', () => {
    it('should update daily payment metrics successfully', async () => {
      // Mock date to be consistent
      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-01T00:00:00.000Z');

      const result = await billingJobsProcessor['updateDailyMetrics']();

      expect(result).toMatchObject({
        metricsUpdated: true,
        date: '2024-01-01',
        totalRevenue: 10500, // Sum of net amounts minus refunds/disputes
        newSubscriptions: 0, // No new subscriptions in mock data
        canceledSubscriptions: 0, // No canceled subscriptions in mock data
        activeSubscriptions: 0, // Based on count query
        churnRate: 0,
      });

      expect(mockSupabase.from().upsert).toHaveBeenCalled();
    });

    it('should handle database errors during metrics update', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lt: jest.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      });

      await expect(billingJobsProcessor['updateDailyMetrics']())
        .rejects.toThrow('Database error');
    });
  });

  describe('sendRenewalNotifications', () => {
    it('should send renewal notifications successfully', async () => {
      mockSupabase.from = jest.fn().mockImplementation((table) => {
        if (table === 'subscriptions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                lt: jest.fn().mockReturnValue({
                  gt: jest.fn().mockResolvedValue({ data: mockRenewingSubscriptions }),
                }),
              }),
            }),
          };
        }
        if (table === 'webhook_events') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null }), // No existing notification
              }),
            }),
            insert: jest.fn().mockResolvedValue({}),
          };
        }
        return { select: jest.fn() };
      });

      const result = await billingJobsProcessor['sendRenewalNotifications']();

      expect(result).toBe(1); // 1 notification sent
      expect(mockSupabase.from().insert).toHaveBeenCalled();
    });

    it('should skip sending duplicate notifications', async () => {
      mockSupabase.from = jest.fn().mockImplementation((table) => {
        if (table === 'subscriptions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                lt: jest.fn().mockReturnValue({
                  gt: jest.fn().mockResolvedValue({ data: mockRenewingSubscriptions }),
                }),
              }),
            }),
          };
        }
        if (table === 'webhook_events') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { id: 'existing' } }), // Existing notification
              }),
            }),
          };
        }
        return { select: jest.fn() };
      });

      const result = await billingJobsProcessor['sendRenewalNotifications']();

      expect(result).toBe(0); // No notifications sent (already exists)
    });
  });

  describe('cleanupExpiredData', () => {
    it('should cleanup expired data successfully', async () => {
      const result = await billingJobsProcessor['cleanupExpiredData']();

      expect(result).toMatchObject({
        cleanedItems: 10, // 5 webhook events + 5 payment transactions
        categories: expect.arrayContaining(['webhook_events', 'payment_transactions']),
      });

      expect(mockSupabase.from().delete).toHaveBeenCalledTimes(2);
    });

    it('should handle cleanup errors gracefully', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        delete: jest.fn().mockRejectedValue(new Error('Cleanup failed')),
      });

      await expect(billingJobsProcessor['cleanupExpiredData']())
        .rejects.toThrow('Cleanup failed');
    });
  });

  describe('getJobHistory', () => {
    it('should retrieve job execution history', async () => {
      const mockJobHistory = [
        {
          id: 'event_1',
          type: 'daily_billing_jobs_completed',
          data: {
            date: '2024-01-01',
            jobs_run: 6,
            successful_jobs: 6,
            failed_jobs: 0,
            total_duration: 5000,
          },
          created_at: '2024-01-01T01:00:00Z',
        },
      ];

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: mockJobHistory }),
            }),
          }),
        }),
      });

      const result = await billingJobsProcessor.getJobHistory(7);

      expect(result).toEqual(mockJobHistory);
      expect(mockSupabase.from).toHaveBeenCalledWith('webhook_events');
    });

    it('should handle empty job history', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: [] }),
            }),
          }),
        }),
      });

      const result = await billingJobsProcessor.getJobHistory();

      expect(result).toEqual([]);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should continue processing other jobs when one fails', async () => {
      mockBillingService.processFailedPayments = jest.fn().mockRejectedValue(new Error('Payment processing failed'));

      const results = await billingJobsProcessor.runDailyBillingJobs({
        retryFailedPayments: true,
        processTrialExpirations: true,
        suspendOverdueAccounts: false,
        updateMetrics: false,
        cleanupExpiredTokens: false,
        sendRenewalNotifications: false,
      });

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('failure');
      expect(results[1].status).toBe('success'); // Trial expirations should still succeed
    });

    it('should log job results even if logging fails', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockRejectedValue(new Error('Logging failed')),
      });

      // Should not throw error even if logging fails
      await expect(billingJobsProcessor.runDailyBillingJobs({
        retryFailedPayments: false,
        processTrialExpirations: false,
        suspendOverdueAccounts: false,
        updateMetrics: false,
        cleanupExpiredTokens: false,
        sendRenewalNotifications: false,
      })).resolves.toBeDefined();
    });

    it('should handle individual subscription errors during trial processing', async () => {
      const trialWithError = {
        ...mockExpiringTrials[0],
        customer_id: 'invalid_customer',
      };

      mockSupabase.from = jest.fn().mockImplementation((table) => {
        if (table === 'subscriptions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                lt: jest.fn().mockReturnValue({
                  gt: jest.fn().mockResolvedValue({ data: [trialWithError] }),
                }),
              }),
            }),
          };
        }
        if (table === 'payment_methods') {
          // Simulate error for invalid customer
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                limit: jest.fn().mockRejectedValue(new Error('Customer not found')),
              }),
            }),
          };
        }
        return { select: jest.fn() };
      });

      const result = await billingJobsProcessor['processTrialExpirations']();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Customer not found');
    });
  });

  describe('Performance and Timing', () => {
    it('should track job execution duration', async () => {
      const results = await billingJobsProcessor.runDailyBillingJobs({
        retryFailedPayments: true,
        processTrialExpirations: false,
        suspendOverdueAccounts: false,
        updateMetrics: false,
        cleanupExpiredTokens: false,
        sendRenewalNotifications: false,
      });

      expect(results[0].duration).toBeGreaterThan(0);
      expect(results[0].startTime).toBeInstanceOf(Date);
      expect(results[0].endTime).toBeInstanceOf(Date);
      expect(results[0].endTime.getTime()).toBeGreaterThanOrEqual(results[0].startTime.getTime());
    });

    it('should handle jobs that take longer than expected', async () => {
      // Mock a slow job
      mockBillingService.processFailedPayments = jest.fn().mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(mockBillingResult), 100);
        });
      });

      const results = await billingJobsProcessor.runDailyBillingJobs({
        retryFailedPayments: true,
        processTrialExpirations: false,
        suspendOverdueAccounts: false,
        updateMetrics: false,
        cleanupExpiredTokens: false,
        sendRenewalNotifications: false,
      });

      expect(results[0].duration).toBeGreaterThanOrEqual(100);
      expect(results[0].status).toBe('success');
    });
  });
});