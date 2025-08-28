/**
 * EPIC 5 STORY 5.7: Payment Failure Recovery & Dunning Management
 * Payment Failure Handler Tests - Comprehensive test suite
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@/lib/supabase/server';
import paymentFailureHandler, { PaymentFailureHandler } from '@/lib/payments/payment-failure-handler';
import stripeService from '@/lib/payments/stripe-service';

// Mock dependencies
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/payments/stripe-service');

const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  upsert: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  neq: jest.fn(() => mockSupabase),
  lte: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(),
  maybeSingle: jest.fn(),
};

const mockStripe = {
  paymentIntents: {
    create: jest.fn(),
    confirm: jest.fn(),
  },
};

(createClient as jest.Mock).mockReturnValue(mockSupabase);
(stripeService.getStripeInstance as jest.Mock).mockReturnValue(mockStripe);

describe('PaymentFailureHandler', () => {
  let handler: PaymentFailureHandler;

  beforeEach(() => {
    handler = new PaymentFailureHandler();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('processFailure', () => {
    const mockFailureData = {
      customerId: '123e4567-e89b-12d3-a456-426614174000',
      paymentIntentId: 'pi_test123',
      failureReason: 'insufficient_funds',
      failureCode: 'insufficient_funds',
      failureMessage: 'Your card has insufficient funds.',
      amount: 2900, // $29.00 in cents
      currency: 'USD',
      paymentMethodId: 'pm_test123',
    };

    it('should create new failure record when no existing failure found', async () => {
      // Mock no existing failure
      mockSupabase.single.mockResolvedValueOnce({ data: null });

      // Mock customer data
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: mockFailureData.customerId,
          stripe_customer_id: 'cus_test123',
          email: 'test@example.com',
        },
      });

      // Mock failure creation
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          customer_id: mockFailureData.customerId,
          payment_intent_id: mockFailureData.paymentIntentId,
          failure_reason: mockFailureData.failureReason,
          failure_code: mockFailureData.failureCode,
          failure_message: mockFailureData.failureMessage,
          amount: mockFailureData.amount,
          currency: mockFailureData.currency,
          payment_method_id: mockFailureData.paymentMethodId,
          retry_count: 0,
          max_retry_attempts: 3,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

      const result = await handler.processFailure(mockFailureData);

      expect(result).toEqual({
        id: '550e8400-e29b-41d4-a716-446655440000',
        customerId: mockFailureData.customerId,
        paymentIntentId: mockFailureData.paymentIntentId,
        failureReason: mockFailureData.failureReason,
        failureCode: mockFailureData.failureCode,
        failureMessage: mockFailureData.failureMessage,
        amount: mockFailureData.amount,
        currency: mockFailureData.currency,
        paymentMethodId: mockFailureData.paymentMethodId,
        retryCount: 0,
        maxRetryAttempts: 3,
        status: 'pending',
        subscriptionId: undefined,
        invoiceId: undefined,
        nextRetryAt: undefined,
        lastRetryAt: undefined,
        resolutionType: undefined,
        resolvedAt: undefined,
        metadata: undefined,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_id: mockFailureData.customerId,
          payment_intent_id: mockFailureData.paymentIntentId,
          failure_reason: mockFailureData.failureReason,
          failure_code: mockFailureData.failureCode,
          max_retry_attempts: 3,
          status: 'pending',
        })
      );
    });

    it('should update existing failure record when found', async () => {
      const existingFailure = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        customer_id: mockFailureData.customerId,
        payment_intent_id: mockFailureData.paymentIntentId,
        retry_count: 1,
        metadata: { previous_attempt: true },
      };

      // Mock existing failure found
      mockSupabase.single.mockResolvedValueOnce({ data: existingFailure });

      // Mock customer data
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: mockFailureData.customerId,
          stripe_customer_id: 'cus_test123',
        },
      });

      // Mock failure update
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          ...existingFailure,
          retry_count: 2,
          last_retry_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

      const result = await handler.processFailure(mockFailureData);

      expect(result.retryCount).toBe(2);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          retry_count: 2,
          last_retry_at: expect.any(String),
        })
      );
    });

    it('should handle validation errors', async () => {
      const invalidData = {
        customerId: 'invalid-uuid',
        failureReason: 'test',
        amount: -100, // Invalid negative amount
      };

      await expect(handler.processFailure(invalidData)).rejects.toThrow('Failed to process payment failure');
    });
  });

  describe('retryPayment', () => {
    const mockRetryData = {
      failureId: '550e8400-e29b-41d4-a716-446655440000',
      paymentMethodId: 'pm_test123',
    };

    const mockFailure = {
      id: mockRetryData.failureId,
      customer_id: '123e4567-e89b-12d3-a456-426614174000',
      amount: 2900,
      currency: 'USD',
      payment_method_id: 'pm_test123',
      retry_count: 1,
      max_retry_attempts: 3,
      status: 'pending',
    };

    const mockCustomer = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      stripe_customer_id: 'cus_test123',
      email: 'test@example.com',
    };

    beforeEach(() => {
      // Mock failure retrieval
      mockSupabase.single.mockResolvedValueOnce({ data: mockFailure });
      
      // Mock customer retrieval
      mockSupabase.single.mockResolvedValueOnce({ data: mockCustomer });
    });

    it('should successfully retry payment and resolve failure on success', async () => {
      const mockPaymentIntent = {
        id: 'pi_retry123',
        status: 'succeeded',
        amount: 2900,
        currency: 'USD',
        metadata: {
          original_failure_id: mockRetryData.failureId,
          retry_attempt: '2',
        },
      };

      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

      // Mock failure update
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          ...mockFailure,
          retry_count: 2,
          status: 'resolved',
          resolution_type: 'payment_succeeded',
          resolved_at: new Date().toISOString(),
        },
      });

      const result = await handler.retryPayment(mockRetryData);

      expect(result.success).toBe(true);
      expect(result.paymentIntent).toEqual(mockPaymentIntent);
      expect(result.failure?.status).toBe('resolved');

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: mockFailure.amount,
        currency: mockFailure.currency,
        customer: mockCustomer.stripe_customer_id,
        payment_method: mockRetryData.paymentMethodId,
        confirmation_method: 'automatic',
        confirm: true,
        metadata: {
          original_failure_id: mockRetryData.failureId,
          retry_attempt: '2',
        },
      });

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          retry_count: 2,
          status: 'resolved',
          resolution_type: 'payment_succeeded',
        })
      );
    });

    it('should handle payment retry failure and schedule next retry', async () => {
      const mockPaymentIntent = {
        id: 'pi_retry123',
        status: 'requires_payment_method',
        amount: 2900,
        currency: 'USD',
      };

      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

      // Mock failure update
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          ...mockFailure,
          retry_count: 2,
          status: 'pending',
          next_retry_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 1 day from now
        },
      });

      const result = await handler.retryPayment(mockRetryData);

      expect(result.success).toBe(false);
      expect(result.nextRetryAt).toBeDefined();
      expect(result.failure?.retryCount).toBe(2);
    });

    it('should abandon failure when max retries exceeded', async () => {
      const maxedFailure = {
        ...mockFailure,
        retry_count: 3,
        max_retry_attempts: 3,
      };

      // Override failure retrieval mock
      mockSupabase.single.mockReset();
      mockSupabase.single.mockResolvedValueOnce({ data: maxedFailure });

      // Mock abandon failure
      mockSupabase.update.mockResolvedValueOnce({ data: null });

      const result = await handler.retryPayment(mockRetryData);

      expect(result.success).toBe(false);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'abandoned',
          resolution_type: 'max_retries_exceeded',
        })
      );
    });

    it('should throw error when failure not found', async () => {
      mockSupabase.single.mockReset();
      mockSupabase.single.mockResolvedValueOnce({ data: null });

      await expect(handler.retryPayment(mockRetryData)).rejects.toThrow('Payment failure not found');
    });
  });

  describe('processPendingRetries', () => {
    it('should process multiple pending retries', async () => {
      const mockPendingFailures = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          customer_id: '123e4567-e89b-12d3-a456-426614174001',
          amount: 2900,
          currency: 'USD',
          payment_method_id: 'pm_test1',
          retry_count: 1,
          max_retry_attempts: 3,
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          customer_id: '123e4567-e89b-12d3-a456-426614174002',
          amount: 4900,
          currency: 'USD',
          payment_method_id: 'pm_test2',
          retry_count: 2,
          max_retry_attempts: 3,
        },
      ];

      // Mock pending failures retrieval
      mockSupabase.single.mockImplementation(() => ({
        data: mockPendingFailures,
        count: mockPendingFailures.length,
      }));

      // Mock individual retry attempts
      const retryHandlerSpy = jest.spyOn(handler, 'retryPayment');
      retryHandlerSpy
        .mockResolvedValueOnce({
          success: true,
          paymentIntent: { id: 'pi_1', status: 'succeeded' } as any,
          failure: { status: 'resolved' } as any,
        })
        .mockResolvedValueOnce({
          success: false,
          failure: { status: 'pending' } as any,
          nextRetryAt: new Date(),
        });

      const result = await handler.processPendingRetries();

      expect(result).toEqual({
        processed: 2,
        successful: 1,
        failed: 1,
        abandoned: 0,
      });

      expect(retryHandlerSpy).toHaveBeenCalledTimes(2);
    });

    it('should return zero results when no pending retries', async () => {
      mockSupabase.single.mockResolvedValue({ data: [], count: 0 });

      const result = await handler.processPendingRetries();

      expect(result).toEqual({
        processed: 0,
        successful: 0,
        failed: 0,
        abandoned: 0,
      });
    });
  });

  describe('failure analysis', () => {
    it('should correctly classify insufficient_funds as temporary failure', async () => {
      const failureData = {
        customerId: '123e4567-e89b-12d3-a456-426614174000',
        failureReason: 'card_declined',
        failureCode: 'insufficient_funds',
        amount: 2900,
      };

      // Mock no existing failure
      mockSupabase.single.mockResolvedValueOnce({ data: null });

      // Mock customer data
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: failureData.customerId, stripe_customer_id: 'cus_test' },
      });

      // Mock failure creation with 3 max retries (indicating temporary failure)
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'test-id',
          customer_id: failureData.customerId,
          max_retry_attempts: 3,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

      const result = await handler.processFailure(failureData);

      expect(result.maxRetryAttempts).toBe(3);
      expect(result.status).toBe('pending');
    });

    it('should correctly classify expired_card as customer_action_required', async () => {
      const failureData = {
        customerId: '123e4567-e89b-12d3-a456-426614174000',
        failureReason: 'card_declined',
        failureCode: 'expired_card',
        amount: 2900,
      };

      // Mock no existing failure
      mockSupabase.single.mockResolvedValueOnce({ data: null });

      // Mock customer data
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: failureData.customerId, stripe_customer_id: 'cus_test' },
      });

      // Mock failure creation with 1 max retry (indicating customer action required)
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'test-id',
          customer_id: failureData.customerId,
          max_retry_attempts: 1,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

      const result = await handler.processFailure(failureData);

      expect(result.maxRetryAttempts).toBe(1);
    });
  });

  describe('payment method health tracking', () => {
    it('should update payment method health on failure', async () => {
      const failureData = {
        customerId: '123e4567-e89b-12d3-a456-426614174000',
        paymentMethodId: 'pm_test123',
        failureReason: 'card_declined',
        failureCode: 'generic_decline',
        amount: 2900,
      };

      // Mock no existing failure
      mockSupabase.single.mockResolvedValueOnce({ data: null });

      // Mock customer data
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: failureData.customerId, stripe_customer_id: 'cus_test' },
      });

      // Mock failure creation
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'test-id',
          customer_id: failureData.customerId,
          payment_method_id: failureData.paymentMethodId,
          failure_reason: failureData.failureReason,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

      // Mock payment method health check (no existing record)
      mockSupabase.single.mockResolvedValueOnce({ data: null });

      // Mock payment method health creation
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          customer_id: failureData.customerId,
          payment_method_id: failureData.paymentMethodId,
          failure_count: 1,
          success_count: 0,
          health_score: 0,
          recommendation: 'update_payment_method',
        },
      });

      await handler.processFailure(failureData);

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_id: failureData.customerId,
          payment_method_id: failureData.paymentMethodId,
          failure_count: 1,
          common_failure_reasons: [failureData.failureReason],
        })
      );
    });
  });
});