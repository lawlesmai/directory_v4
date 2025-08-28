/**
 * EPIC 5 STORY 5.2: Subscription Management & Billing System Tests
 * Subscription Manager Service Tests
 * 
 * Comprehensive test suite for subscription lifecycle management
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import subscriptionManager from '@/lib/payments/subscription-manager';
import stripeService from '@/lib/payments/stripe-service';

// Mock dependencies
jest.mock('@/lib/payments/stripe-service');
jest.mock('@/lib/supabase/server');

const mockStripeService = stripeService as jest.Mocked<typeof stripeService>;

// Mock data
const mockCustomer = {
  id: 'cust_123',
  userId: 'user_123',
  businessId: null,
  stripeCustomerId: 'cus_stripe123',
  email: 'test@example.com',
  name: 'Test User',
  phone: null,
  billingAddress: null,
  shippingAddress: null,
  metadata: {},
};

const mockPlan = {
  id: 'plan_123',
  stripe_price_id: 'price_123',
  stripe_product_id: 'prod_123',
  name: 'Professional Plan',
  description: 'Advanced features for growing businesses',
  amount: 7900, // $79.00
  currency: 'USD',
  interval: 'month',
  interval_count: 1,
  trial_period_days: 14,
  active: true,
  features: ['Advanced analytics', 'Priority support', 'API access'],
  metadata: {},
};

const mockSubscription = {
  id: 'sub_123',
  stripeSubscriptionId: 'sub_stripe123',
  customerId: 'cust_123',
  planId: 'plan_123',
  status: 'active',
  currentPeriodStart: new Date('2024-01-01'),
  currentPeriodEnd: new Date('2024-02-01'),
  trialEnd: null,
  cancelAtPeriodEnd: false,
  metadata: {},
  customer: mockCustomer,
  plan: mockPlan,
};

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: mockPlan, error: null }),
      }),
    }),
    insert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: mockSubscription, error: null }),
      }),
    }),
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockSubscription, error: null }),
        }),
      }),
    }),
  }),
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

describe('Subscription Manager Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Stripe service methods
    mockStripeService.getCustomer = jest.fn().mockResolvedValue(mockCustomer);
    mockStripeService.getStripeInstance = jest.fn().mockReturnValue({
      subscriptions: {
        create: jest.fn().mockResolvedValue({
          id: 'sub_stripe123',
          status: 'active',
          current_period_start: 1704067200, // 2024-01-01 timestamp
          current_period_end: 1706745600,   // 2024-02-01 timestamp
          trial_start: null,
          trial_end: null,
          cancel_at_period_end: false,
          collection_method: 'charge_automatically',
          items: {
            data: [{ quantity: 1 }],
          },
        }),
        update: jest.fn().mockResolvedValue({
          id: 'sub_stripe123',
          status: 'active',
          cancel_at_period_end: true,
          current_period_start: 1704067200,
          current_period_end: 1706745600,
        }),
        cancel: jest.fn().mockResolvedValue({
          id: 'sub_stripe123',
          status: 'canceled',
          canceled_at: Math.floor(Date.now() / 1000),
          ended_at: Math.floor(Date.now() / 1000),
        }),
        retrieve: jest.fn().mockResolvedValue({
          id: 'sub_stripe123',
          items: {
            data: [{ id: 'si_123' }],
          },
        }),
      },
      subscriptionItems: {
        createUsageRecord: jest.fn().mockResolvedValue({}),
        listUsageRecordSummaries: jest.fn().mockResolvedValue({
          data: [{ total_usage: 100, period: { start: 1704067200, end: 1706745600 } }],
        }),
      },
      invoices: {
        retrieveUpcoming: jest.fn().mockResolvedValue({
          amount_due: 7900,
          amount_paid: 0,
        }),
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createSubscription', () => {
    it('should successfully create a new subscription', async () => {
      const subscriptionData = {
        customerId: 'cust_123',
        planId: 'plan_123',
        trialDays: 14,
        metadata: { source: 'test' },
      };

      const result = await subscriptionManager.createSubscription(subscriptionData);

      expect(result).toMatchObject({
        id: 'sub_123',
        customerId: 'cust_123',
        planId: 'plan_123',
        status: 'active',
        customer: mockCustomer,
        plan: expect.objectContaining({
          name: 'Professional Plan',
          amount: 7900,
        }),
      });

      expect(mockStripeService.getCustomer).toHaveBeenCalledWith('cust_123');
      expect(mockSupabase.from).toHaveBeenCalledWith('subscription_plans');
      expect(mockSupabase.from).toHaveBeenCalledWith('subscriptions');
    });

    it('should handle customer not found error', async () => {
      mockStripeService.getCustomer = jest.fn().mockResolvedValue(null);

      const subscriptionData = {
        customerId: 'invalid_customer',
        planId: 'plan_123',
      };

      await expect(subscriptionManager.createSubscription(subscriptionData))
        .rejects.toThrow('Customer not found');
    });

    it('should handle plan not found error', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const subscriptionData = {
        customerId: 'cust_123',
        planId: 'invalid_plan',
      };

      await expect(subscriptionManager.createSubscription(subscriptionData))
        .rejects.toThrow('Subscription plan not found');
    });

    it('should create subscription with coupon', async () => {
      const subscriptionData = {
        customerId: 'cust_123',
        planId: 'plan_123',
        couponId: 'coupon_123',
      };

      const mockStripe = mockStripeService.getStripeInstance();
      
      await subscriptionManager.createSubscription(subscriptionData);

      expect(mockStripe.subscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          coupon: 'coupon_123',
        })
      );
    });
  });

  describe('getSubscriptionWithDetails', () => {
    it('should retrieve subscription with full details', async () => {
      const mockDetailedSubscription = {
        ...mockSubscription,
        customer: mockCustomer,
        plan: mockPlan,
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockDetailedSubscription, error: null }),
          }),
        }),
      });

      const result = await subscriptionManager.getSubscriptionWithDetails('sub_123');

      expect(result).toMatchObject({
        id: 'sub_123',
        customer: expect.objectContaining({
          email: 'test@example.com',
        }),
        plan: expect.objectContaining({
          name: 'Professional Plan',
        }),
      });
    });

    it('should return null for non-existent subscription', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const result = await subscriptionManager.getSubscriptionWithDetails('invalid_sub');

      expect(result).toBeNull();
    });
  });

  describe('changePlan', () => {
    it('should successfully change subscription plan', async () => {
      const newPlan = {
        ...mockPlan,
        id: 'plan_456',
        name: 'Enterprise Plan',
        amount: 19900,
      };

      // Mock getting subscription details
      jest.spyOn(subscriptionManager, 'getSubscriptionWithDetails')
        .mockResolvedValue(mockSubscription);

      // Mock new plan lookup
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: newPlan, error: null }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ 
                data: { ...mockSubscription, plan_id: 'plan_456' }, 
                error: null 
              }),
            }),
          }),
        }),
      });

      const result = await subscriptionManager.changePlan({
        subscriptionId: 'sub_123',
        newPlanId: 'plan_456',
        prorationBehavior: 'create_prorations',
      });

      expect(result.planId).toBe('plan_456');
      expect(mockStripeService.getStripeInstance().subscriptions.update)
        .toHaveBeenCalled();
    });

    it('should handle subscription not found during plan change', async () => {
      jest.spyOn(subscriptionManager, 'getSubscriptionWithDetails')
        .mockResolvedValue(null);

      await expect(subscriptionManager.changePlan({
        subscriptionId: 'invalid_sub',
        newPlanId: 'plan_456',
      })).rejects.toThrow('Subscription not found');
    });
  });

  describe('previewPlanChange', () => {
    it('should generate accurate plan change preview', async () => {
      const currentSubscription = {
        ...mockSubscription,
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-01-31'),
        plan: { ...mockPlan, amount: 2900 }, // $29.00
      };

      const newPlan = {
        ...mockPlan,
        id: 'plan_456',
        name: 'Enterprise Plan',
        amount: 7900, // $79.00
      };

      jest.spyOn(subscriptionManager, 'getSubscriptionWithDetails')
        .mockResolvedValue(currentSubscription);

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: newPlan, error: null }),
          }),
        }),
      });

      // Mock current date to be mid-period
      jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-01-16').getTime());

      const preview = await subscriptionManager.previewPlanChange('sub_123', 'plan_456');

      expect(preview).toMatchObject({
        currentPlan: expect.objectContaining({
          name: mockPlan.name,
          amount: 2900,
        }),
        newPlan: expect.objectContaining({
          name: 'Enterprise Plan',
          amount: 7900,
        }),
        immediateCharge: expect.any(Number),
        nextBillingAmount: 7900,
      });

      // Should have positive immediate charge for upgrade
      expect(preview.immediateCharge).toBeGreaterThan(0);
    });
  });

  describe('cancelAtPeriodEnd', () => {
    it('should schedule subscription for cancellation at period end', async () => {
      jest.spyOn(subscriptionManager, 'getSubscriptionWithDetails')
        .mockResolvedValue(mockSubscription);

      mockSupabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ 
                data: { ...mockSubscription, cancel_at_period_end: true }, 
                error: null 
              }),
            }),
          }),
        }),
      });

      const result = await subscriptionManager.cancelAtPeriodEnd('sub_123');

      expect(result.cancelAtPeriodEnd).toBe(true);
      expect(mockStripeService.getStripeInstance().subscriptions.update)
        .toHaveBeenCalledWith('sub_stripe123', { cancel_at_period_end: true });
    });
  });

  describe('cancelImmediately', () => {
    it('should cancel subscription immediately', async () => {
      jest.spyOn(subscriptionManager, 'getSubscriptionWithDetails')
        .mockResolvedValue(mockSubscription);

      mockSupabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ 
                data: { ...mockSubscription, status: 'canceled' }, 
                error: null 
              }),
            }),
          }),
        }),
      });

      const result = await subscriptionManager.cancelImmediately('sub_123', true);

      expect(result.status).toBe('canceled');
      expect(mockStripeService.getStripeInstance().subscriptions.cancel)
        .toHaveBeenCalledWith('sub_stripe123', { prorate: true });
    });
  });

  describe('convertTrialToPaid', () => {
    it('should successfully convert trial subscription to paid', async () => {
      const trialSubscription = {
        ...mockSubscription,
        status: 'trialing',
        trialEnd: new Date('2024-01-15'),
      };

      jest.spyOn(subscriptionManager, 'getSubscriptionWithDetails')
        .mockResolvedValue(trialSubscription);

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockPlan, error: null }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ 
                data: { ...mockSubscription, status: 'active', trial_end: null }, 
                error: null 
              }),
            }),
          }),
        }),
      });

      const result = await subscriptionManager.convertTrialToPaid('sub_123', {
        planId: 'plan_123',
        paymentMethodId: 'pm_123',
      });

      expect(result.status).toBe('active');
      expect(mockStripeService.getStripeInstance().subscriptions.update)
        .toHaveBeenCalledWith('sub_stripe123', expect.objectContaining({
          trial_end: 'now',
          default_payment_method: 'pm_123',
        }));
    });

    it('should reject conversion for non-trial subscription', async () => {
      const activeSubscription = {
        ...mockSubscription,
        status: 'active',
      };

      jest.spyOn(subscriptionManager, 'getSubscriptionWithDetails')
        .mockResolvedValue(activeSubscription);

      await expect(subscriptionManager.convertTrialToPaid('sub_123', {
        planId: 'plan_123',
      })).rejects.toThrow('Subscription is not in trial period');
    });
  });

  describe('extendTrial', () => {
    it('should extend trial period by specified days', async () => {
      const trialSubscription = {
        ...mockSubscription,
        status: 'trialing',
        trialEnd: new Date('2024-01-15'),
      };

      jest.spyOn(subscriptionManager, 'getSubscriptionWithDetails')
        .mockResolvedValue(trialSubscription);

      const expectedNewTrialEnd = new Date('2024-01-22'); // 7 days later

      mockSupabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ 
                data: { 
                  ...mockSubscription, 
                  trial_end: expectedNewTrialEnd.toISOString() 
                }, 
                error: null 
              }),
            }),
          }),
        }),
      });

      const result = await subscriptionManager.extendTrial('sub_123', 7);

      expect(result.trialEnd?.getTime()).toBeCloseTo(expectedNewTrialEnd.getTime(), -3);
      expect(mockStripeService.getStripeInstance().subscriptions.update)
        .toHaveBeenCalledWith('sub_stripe123', expect.objectContaining({
          trial_end: expect.any(Number),
        }));
    });
  });

  describe('reportUsage', () => {
    it('should successfully report usage for metered billing', async () => {
      const usageData = {
        subscriptionId: 'sub_123',
        subscriptionItemId: 'si_123',
        quantity: 100,
        action: 'increment' as const,
      };

      jest.spyOn(subscriptionManager, 'getSubscriptionWithDetails')
        .mockResolvedValue(mockSubscription);

      await subscriptionManager.reportUsage(usageData);

      expect(mockStripeService.getStripeInstance().subscriptionItems.createUsageRecord)
        .toHaveBeenCalledWith('si_123', expect.objectContaining({
          quantity: 100,
          action: 'increment',
          timestamp: expect.any(Number),
        }));
    });

    it('should handle subscription not found for usage reporting', async () => {
      jest.spyOn(subscriptionManager, 'getSubscriptionWithDetails')
        .mockResolvedValue(null);

      await expect(subscriptionManager.reportUsage({
        subscriptionId: 'invalid_sub',
        subscriptionItemId: 'si_123',
        quantity: 100,
      })).rejects.toThrow('Subscription not found');
    });
  });

  describe('getUsageSummary', () => {
    it('should retrieve usage summary for subscription', async () => {
      const result = await subscriptionManager.getUsageSummary('sub_123', 'si_123');

      expect(result).toMatchObject({
        subscriptionId: 'sub_123',
        subscriptionItemId: 'si_123',
        totalUsage: 100,
        period: expect.objectContaining({
          start: expect.any(Number),
          end: expect.any(Number),
        }),
      });

      expect(mockStripeService.getStripeInstance().subscriptionItems.listUsageRecordSummaries)
        .toHaveBeenCalledWith('si_123', { limit: 100 });
    });
  });

  describe('reactivateSubscription', () => {
    it('should reactivate a subscription scheduled for cancellation', async () => {
      const canceledSubscription = {
        ...mockSubscription,
        cancelAtPeriodEnd: true,
      };

      jest.spyOn(subscriptionManager, 'getSubscriptionWithDetails')
        .mockResolvedValue(canceledSubscription);

      mockSupabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ 
                data: { ...mockSubscription, cancel_at_period_end: false }, 
                error: null 
              }),
            }),
          }),
        }),
      });

      const result = await subscriptionManager.reactivateSubscription('sub_123');

      expect(result.cancelAtPeriodEnd).toBe(false);
      expect(mockStripeService.getStripeInstance().subscriptions.update)
        .toHaveBeenCalledWith('sub_stripe123', { cancel_at_period_end: false });
    });

    it('should reject reactivation for subscription not scheduled for cancellation', async () => {
      jest.spyOn(subscriptionManager, 'getSubscriptionWithDetails')
        .mockResolvedValue(mockSubscription);

      await expect(subscriptionManager.reactivateSubscription('sub_123'))
        .rejects.toThrow('Subscription is not scheduled for cancellation');
    });
  });

  describe('listActiveSubscriptions', () => {
    it('should retrieve paginated list of active subscriptions', async () => {
      const mockSubscriptions = [mockSubscription, { ...mockSubscription, id: 'sub_456' }];

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              range: jest.fn().mockResolvedValue({ 
                data: mockSubscriptions.map(sub => ({
                  ...sub,
                  customer: mockCustomer,
                  plan: mockPlan,
                })), 
                error: null 
              }),
            }),
          }),
          count: jest.fn().mockResolvedValue({ count: 2 }),
        }),
      });

      const result = await subscriptionManager.listActiveSubscriptions(1, 10);

      expect(result.subscriptions).toHaveLength(2);
      expect(result.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle Stripe API errors gracefully', async () => {
      const stripeError = new Error('Stripe API Error');
      mockStripeService.getStripeInstance().subscriptions.create = jest.fn().mockRejectedValue(stripeError);

      await expect(subscriptionManager.createSubscription({
        customerId: 'cust_123',
        planId: 'plan_123',
      })).rejects.toThrow('Failed to create subscription');
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: null, 
              error: { message: 'Database connection failed' }
            }),
          }),
        }),
      });

      await expect(subscriptionManager.createSubscription({
        customerId: 'cust_123',
        planId: 'plan_123',
      })).rejects.toThrow('Failed to create subscription');
    });
  });

  describe('Validation', () => {
    it('should validate subscription creation data', async () => {
      // Test with invalid data that should trigger validation errors
      await expect(subscriptionManager.createSubscription({
        customerId: '', // Invalid empty customer ID
        planId: 'plan_123',
      })).rejects.toThrow();
    });

    it('should validate plan change data', async () => {
      await expect(subscriptionManager.changePlan({
        subscriptionId: '', // Invalid empty subscription ID
        newPlanId: 'plan_456',
      })).rejects.toThrow();
    });

    it('should validate usage reporting data', async () => {
      await expect(subscriptionManager.reportUsage({
        subscriptionId: 'sub_123',
        subscriptionItemId: 'si_123',
        quantity: -1, // Invalid negative quantity
      })).rejects.toThrow();
    });
  });
});