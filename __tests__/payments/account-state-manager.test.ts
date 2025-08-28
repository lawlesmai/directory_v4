/**
 * EPIC 5 STORY 5.7: Payment Failure Recovery & Dunning Management
 * Account State Manager Tests - Comprehensive test suite
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@/lib/supabase/server';
import accountStateManager, { AccountStateManager } from '@/lib/payments/account-state-manager';
import type { PaymentFailure } from '@/lib/payments/payment-failure-handler';

// Mock dependencies
jest.mock('@/lib/supabase/server');

const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  upsert: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  neq: jest.fn(() => mockSupabase),
  lte: jest.fn(() => mockSupabase),
  gte: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(),
  maybeSingle: jest.fn(),
  head: jest.fn(),
};

(createClient as jest.Mock).mockReturnValue(mockSupabase);

describe('AccountStateManager', () => {
  let manager: AccountStateManager;

  beforeEach(() => {
    manager = new AccountStateManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('processPaymentFailure', () => {
    const mockPaymentFailure: PaymentFailure = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      customerId: '123e4567-e89b-12d3-a456-426614174000',
      subscriptionId: '456e7890-e12b-34c5-d678-90123456789a',
      failureReason: 'insufficient_funds',
      failureCode: 'insufficient_funds',
      failureMessage: 'Your card has insufficient funds.',
      amount: 2900,
      currency: 'USD',
      paymentMethodId: 'pm_test123',
      retryCount: 0,
      maxRetryAttempts: 3,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockCustomer = {
      id: mockPaymentFailure.customerId,
      stripe_customer_id: 'cus_test123',
      email: 'john.doe@example.com',
      name: 'John Doe',
      created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago
      subscriptions: [{
        id: mockPaymentFailure.subscriptionId,
        status: 'active',
        subscription_plans: { amount: 5000 }, // $50/month - existing customer
      }],
    };

    beforeEach(() => {
      // Mock customer segment determination
      mockSupabase.single.mockResolvedValueOnce({ data: mockCustomer });
      mockSupabase.single.mockImplementation(({ count }: { count?: string } = {}) => {
        if (count) {
          return { count: 1 }; // 1 recent failure
        }
        return { data: mockCustomer };
      });
    });

    it('should create new account state for first failure', async () => {
      // Mock no existing account state
      mockSupabase.single.mockResolvedValueOnce({ data: null });

      const mockNewAccountState = {
        id: '660e8400-e29b-41d4-a716-446655440000',
        customer_id: mockPaymentFailure.customerId,
        subscription_id: mockPaymentFailure.subscriptionId,
        state: 'grace_period',
        reason: 'payment_failure',
        grace_period_end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days for existing
        feature_restrictions: [],
        data_retention_period: 90,
        automated_actions: {},
        metadata: {
          payment_failure_id: mockPaymentFailure.id,
          failure_reason: mockPaymentFailure.failureReason,
          failure_count: 1,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock account state creation
      mockSupabase.single.mockResolvedValueOnce({ data: mockNewAccountState });

      const result = await manager.processPaymentFailure(mockPaymentFailure);

      expect(result.state).toBe('grace_period');
      expect(result.reason).toBe('payment_failure');
      expect(result.gracePeriodEnd).toBeInstanceOf(Date);
      expect(result.featureRestrictions).toEqual([]);

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_id: mockPaymentFailure.customerId,
          subscription_id: mockPaymentFailure.subscriptionId,
          state: 'grace_period',
          reason: 'payment_failure',
          grace_period_end: expect.any(String),
          feature_restrictions: [],
        })
      );
    });

    it('should update existing account state for subsequent failures', async () => {
      const existingAccountState = {
        id: '660e8400-e29b-41d4-a716-446655440000',
        customer_id: mockPaymentFailure.customerId,
        state: 'grace_period',
        reason: 'payment_failure',
        grace_period_end: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        feature_restrictions: [],
        metadata: { previous_failure_count: 1 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock existing account state
      mockSupabase.single.mockResolvedValueOnce({ data: existingAccountState });

      const updatedAccountState = {
        ...existingAccountState,
        state: 'restricted',
        reason: 'multiple_payment_failures',
        feature_restrictions: ['new_data_creation', 'advanced_features', 'api_access'],
        updated_at: new Date().toISOString(),
      };

      // Mock account state update
      mockSupabase.single.mockResolvedValueOnce({ data: updatedAccountState });

      const failureWithMultipleRetries = {
        ...mockPaymentFailure,
        retryCount: 2,
      };

      const result = await manager.processPaymentFailure(failureWithMultipleRetries);

      expect(result.state).toBe('restricted');
      expect(result.reason).toBe('multiple_payment_failures');
      expect(result.featureRestrictions).toContain('new_data_creation');
      expect(result.featureRestrictions).toContain('advanced_features');
      expect(result.featureRestrictions).toContain('api_access');

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'restricted',
          reason: 'multiple_payment_failures',
        })
      );
    });

    it('should determine customer segment correctly for new customers', async () => {
      const newCustomer = {
        ...mockCustomer,
        created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days ago
      };

      // Mock new customer
      mockSupabase.single.mockReset();
      mockSupabase.single.mockResolvedValueOnce({ data: null }); // No existing state
      mockSupabase.single.mockResolvedValueOnce({ data: newCustomer });
      mockSupabase.single.mockImplementation(({ count }: { count?: string } = {}) => {
        if (count) {
          return { count: 1 };
        }
        return { data: newCustomer };
      });

      const mockNewAccountState = {
        id: '660e8400-e29b-41d4-a716-446655440000',
        customer_id: mockPaymentFailure.customerId,
        state: 'grace_period',
        grace_period_end: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days for new
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockSupabase.single.mockResolvedValueOnce({ data: mockNewAccountState });

      const result = await manager.processPaymentFailure(mockPaymentFailure);

      expect(result.gracePeriodEnd).toBeDefined();
      // For new customers, grace period should be 3 days
      const gracePeriodDays = Math.floor((result.gracePeriodEnd!.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      expect(gracePeriodDays).toBeCloseTo(3, 0);
    });

    it('should determine high-value customer segment correctly', async () => {
      const highValueCustomer = {
        ...mockCustomer,
        subscriptions: [{
          id: mockPaymentFailure.subscriptionId,
          status: 'active',
          subscription_plans: { amount: 15000 }, // $150/month - high value
        }],
      };

      // Mock high-value customer
      mockSupabase.single.mockReset();
      mockSupabase.single.mockResolvedValueOnce({ data: null }); // No existing state
      mockSupabase.single.mockResolvedValueOnce({ data: highValueCustomer });
      mockSupabase.single.mockImplementation(({ count }: { count?: string } = {}) => {
        if (count) {
          return { count: 1 };
        }
        return { data: highValueCustomer };
      });

      const mockNewAccountState = {
        id: '660e8400-e29b-41d4-a716-446655440000',
        customer_id: mockPaymentFailure.customerId,
        state: 'grace_period',
        grace_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days for high-value
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockSupabase.single.mockResolvedValueOnce({ data: mockNewAccountState });

      const result = await manager.processPaymentFailure(mockPaymentFailure);

      // For high-value customers, grace period should be 7 days
      const gracePeriodDays = Math.floor((result.gracePeriodEnd!.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      expect(gracePeriodDays).toBeCloseTo(7, 0);
    });
  });

  describe('processPaymentSuccess', () => {
    const customerId = '123e4567-e89b-12d3-a456-426614174000';
    const paymentIntentId = 'pi_success123';

    it('should reactivate account when payment is successful', async () => {
      const existingAccountState = {
        id: '660e8400-e29b-41d4-a716-446655440000',
        customer_id: customerId,
        state: 'grace_period',
        reason: 'payment_failure',
        feature_restrictions: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock existing restricted account state
      mockSupabase.single.mockResolvedValueOnce({ data: existingAccountState });

      const reactivatedState = {
        ...existingAccountState,
        state: 'active',
        reason: 'payment_recovered',
        reactivation_date: new Date().toISOString(),
        metadata: {
          payment_intent_id: paymentIntentId,
          reactivated_from: 'grace_period',
          reactivated_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      };

      // Mock account state update
      mockSupabase.single.mockResolvedValueOnce({ data: reactivatedState });

      const result = await manager.processPaymentSuccess(customerId, paymentIntentId);

      expect(result?.state).toBe('active');
      expect(result?.reason).toBe('payment_recovered');
      expect(result?.reactivationDate).toBeInstanceOf(Date);

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'active',
          reason: 'payment_recovered',
          metadata: expect.objectContaining({
            payment_intent_id: paymentIntentId,
            reactivated_from: 'grace_period',
          }),
        })
      );
    });

    it('should return null when account is already active', async () => {
      const activeAccountState = {
        id: '660e8400-e29b-41d4-a716-446655440000',
        customer_id: customerId,
        state: 'active',
        reason: 'normal_operation',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock active account state
      mockSupabase.single.mockResolvedValueOnce({ data: activeAccountState });

      const result = await manager.processPaymentSuccess(customerId, paymentIntentId);

      expect(result?.state).toBe('active');
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    it('should return null when no account state exists', async () => {
      // Mock no existing account state
      mockSupabase.single.mockResolvedValueOnce({ data: null });

      const result = await manager.processPaymentSuccess(customerId, paymentIntentId);

      expect(result).toBeNull();
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });
  });

  describe('checkFeatureAccess', () => {
    const customerId = '123e4567-e89b-12d3-a456-426614174000';

    it('should allow all features for active accounts', async () => {
      // Mock no account state (defaults to active)
      mockSupabase.single.mockResolvedValueOnce({ data: null });

      const result = await manager.checkFeatureAccess({ customerId, feature: 'advanced_analytics' });

      expect(result).toEqual({
        feature: 'advanced_analytics',
        allowed: true,
      });
    });

    it('should allow explicitly allowed features in restricted states', async () => {
      const restrictedAccountState = {
        id: '660e8400-e29b-41d4-a716-446655440000',
        customer_id: customerId,
        state: 'restricted',
        feature_restrictions: ['new_data_creation', 'advanced_features', 'api_access'],
        grace_period_end: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock restricted account state
      mockSupabase.single.mockResolvedValueOnce({ data: restrictedAccountState });

      const result = await manager.checkFeatureAccess({ customerId, feature: 'read_only_access' });

      expect(result).toEqual({
        feature: 'read_only_access',
        allowed: true,
        reason: 'Feature allowed in restricted state',
        gracePeriodEnd: expect.any(Date),
      });
    });

    it('should restrict explicitly forbidden features', async () => {
      const restrictedAccountState = {
        id: '660e8400-e29b-41d4-a716-446655440000',
        customer_id: customerId,
        state: 'restricted',
        feature_restrictions: ['new_data_creation', 'advanced_features', 'api_access'],
        grace_period_end: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock restricted account state
      mockSupabase.single.mockResolvedValueOnce({ data: restrictedAccountState });

      const result = await manager.checkFeatureAccess({ customerId, feature: 'api_access' });

      expect(result).toEqual({
        feature: 'api_access',
        allowed: false,
        reason: 'Feature restricted due to account state: restricted',
        gracePeriodEnd: expect.any(Date),
      });
    });

    it('should restrict all features for suspended accounts', async () => {
      const suspendedAccountState = {
        id: '660e8400-e29b-41d4-a716-446655440000',
        customer_id: customerId,
        state: 'suspended',
        feature_restrictions: ['all_features'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock suspended account state
      mockSupabase.single.mockResolvedValueOnce({ data: suspendedAccountState });

      const result = await manager.checkFeatureAccess({ customerId, feature: 'basic_access' });

      expect(result).toEqual({
        feature: 'basic_access',
        allowed: false,
        reason: 'Feature restricted due to account state: suspended',
        gracePeriodEnd: undefined,
      });
    });

    it('should allow billing updates even for suspended accounts', async () => {
      const suspendedAccountState = {
        id: '660e8400-e29b-41d4-a716-446655440000',
        customer_id: customerId,
        state: 'suspended',
        feature_restrictions: ['all_features'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock suspended account state
      mockSupabase.single.mockResolvedValueOnce({ data: suspendedAccountState });

      const result = await manager.checkFeatureAccess({ customerId, feature: 'billing_update' });

      expect(result).toEqual({
        feature: 'billing_update',
        allowed: true,
        reason: 'Feature allowed in suspended state',
        gracePeriodEnd: undefined,
      });
    });

    it('should fail open when encountering errors', async () => {
      // Mock database error
      mockSupabase.single.mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await manager.checkFeatureAccess({ customerId, feature: 'any_feature' });

      expect(result).toEqual({
        feature: 'any_feature',
        allowed: true,
        reason: 'Error checking access - defaulting to allow',
      });
    });
  });

  describe('processExpiredGracePeriods', () => {
    const mockExpiredStates = [
      {
        id: '660e8400-e29b-41d4-a716-446655440001',
        customer_id: '123e4567-e89b-12d3-a456-426614174001',
        state: 'grace_period',
        grace_period_end: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440002',
        customer_id: '123e4567-e89b-12d3-a456-426614174002',
        state: 'grace_period',
        grace_period_end: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    it('should suspend accounts with expired grace periods', async () => {
      // Mock expired grace periods retrieval
      mockSupabase.single.mockImplementation(() => ({
        data: mockExpiredStates,
        count: mockExpiredStates.length,
      }));

      // Mock successful updates for both accounts
      const updateSpy = jest.spyOn(manager, 'updateAccountState');
      updateSpy
        .mockResolvedValueOnce({
          id: mockExpiredStates[0].id,
          customerId: mockExpiredStates[0].customer_id,
          state: 'suspended',
          reason: 'grace_period_expired',
          featureRestrictions: ['all_features'],
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .mockResolvedValueOnce({
          id: mockExpiredStates[1].id,
          customerId: mockExpiredStates[1].customer_id,
          state: 'suspended',
          reason: 'grace_period_expired',
          featureRestrictions: ['all_features'],
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);

      const result = await manager.processExpiredGracePeriods();

      expect(result).toEqual({
        processed: 2,
        suspended: 2,
        errors: 0,
      });

      expect(updateSpy).toHaveBeenCalledTimes(2);
      expect(updateSpy).toHaveBeenCalledWith({
        accountStateId: mockExpiredStates[0].id,
        state: 'suspended',
        reason: 'grace_period_expired',
        metadata: expect.objectContaining({
          grace_period_expired_at: expect.any(String),
        }),
      });
    });

    it('should handle errors during suspension gracefully', async () => {
      // Mock expired grace periods retrieval
      mockSupabase.single.mockImplementation(() => ({
        data: mockExpiredStates,
        count: mockExpiredStates.length,
      }));

      // Mock one success and one failure
      const updateSpy = jest.spyOn(manager, 'updateAccountState');
      updateSpy
        .mockResolvedValueOnce({
          id: mockExpiredStates[0].id,
          customerId: mockExpiredStates[0].customer_id,
          state: 'suspended',
          reason: 'grace_period_expired',
          featureRestrictions: ['all_features'],
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await manager.processExpiredGracePeriods();

      expect(result).toEqual({
        processed: 2,
        suspended: 1,
        errors: 1,
      });
    });

    it('should return zero results when no expired grace periods', async () => {
      // Mock no expired states
      mockSupabase.single.mockImplementation(() => ({
        data: [],
        count: 0,
      }));

      const result = await manager.processExpiredGracePeriods();

      expect(result).toEqual({
        processed: 0,
        suspended: 0,
        errors: 0,
      });
    });
  });

  describe('getFeatureRestrictions', () => {
    const customerId = '123e4567-e89b-12d3-a456-426614174000';

    it('should return active state restrictions for active accounts', async () => {
      // Mock no account state (defaults to active)
      mockSupabase.single.mockResolvedValueOnce({ data: null });

      const result = await manager.getFeatureRestrictions(customerId);

      expect(result).toEqual({
        accountState: 'active',
        restrictions: [],
        allowedFeatures: ['all_features'],
      });
    });

    it('should return correct restrictions for restricted accounts', async () => {
      const restrictedAccountState = {
        id: '660e8400-e29b-41d4-a716-446655440000',
        customer_id: customerId,
        state: 'restricted',
        feature_restrictions: ['new_data_creation', 'advanced_features', 'api_access'],
        grace_period_end: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock restricted account state
      mockSupabase.single.mockResolvedValueOnce({ data: restrictedAccountState });

      const result = await manager.getFeatureRestrictions(customerId);

      expect(result).toEqual({
        accountState: 'restricted',
        restrictions: ['new_data_creation', 'advanced_features', 'api_access'],
        allowedFeatures: ['read_only_access', 'billing_update', 'data_export'],
        gracePeriodEnd: expect.any(Date),
      });
    });

    it('should handle errors gracefully', async () => {
      // Mock database error
      mockSupabase.single.mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await manager.getFeatureRestrictions(customerId);

      expect(result).toEqual({
        accountState: 'error',
        restrictions: [],
        allowedFeatures: ['all_features'],
      });
    });
  });
});