/**
 * EPIC 5 STORY 5.2: Subscription Management & Billing System Tests
 * Subscription API Integration Tests
 * 
 * Comprehensive test suite for subscription management API endpoints
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { GET, POST, PUT, DELETE } from '@/app/api/payments/subscriptions/[subscriptionId]/route';
import { POST as CreateSubscriptionPreview } from '@/app/api/payments/subscriptions/preview/route';
import { POST as CancelSubscription, GET as GetCancellationOptions } from '@/app/api/payments/subscriptions/[subscriptionId]/cancel/route';
import { POST as ChangePlan, GET as PreviewPlanChange } from '@/app/api/payments/subscriptions/[subscriptionId]/change-plan/route';
import { NextRequest } from 'next/server';
import subscriptionManager from '@/lib/payments/subscription-manager';
import billingService from '@/lib/payments/billing-service';
import paymentSecurity from '@/lib/payments/security-middleware';

// Mock dependencies
jest.mock('@/lib/payments/subscription-manager');
jest.mock('@/lib/payments/billing-service');
jest.mock('@/lib/payments/security-middleware');
jest.mock('@/lib/payments/security-config');
jest.mock('@/lib/supabase/server');

const mockSubscriptionManager = subscriptionManager as jest.Mocked<typeof subscriptionManager>;
const mockBillingService = billingService as jest.Mocked<typeof billingService>;
const mockPaymentSecurity = paymentSecurity as jest.Mocked<typeof paymentSecurity>;

// Mock data
const mockContext = {
  userId: 'user_123',
  customerId: 'cust_123',
  businessId: null,
  isAdmin: false,
  permissions: ['subscription:read', 'subscription:write'],
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
  customer: {
    id: 'cust_123',
    email: 'test@example.com',
    name: 'Test User',
  },
  plan: {
    id: 'plan_123',
    name: 'Professional Plan',
    amount: 7900,
    currency: 'USD',
    interval: 'month',
    features: ['Advanced analytics', 'Priority support'],
  },
};

const mockPlanChangePreview = {
  currentPlan: {
    name: 'Professional Plan',
    amount: 7900,
    remainingDays: 15,
    proratedRefund: 3950,
  },
  newPlan: {
    name: 'Enterprise Plan',
    amount: 19900,
    proratedCharge: 9950,
  },
  immediateCharge: 6000,
  nextBillingAmount: 19900,
  effectiveDate: new Date(),
};

const mockSupabase = {
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ 
          data: { 
            id: 'plan_456', 
            name: 'Enterprise Plan', 
            amount: 19900,
            features: ['Everything in Professional', 'Advanced integrations']
          }, 
          error: null 
        }),
      }),
    }),
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({}),
    }),
  }),
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

jest.mock('@/lib/payments/security-config', () => ({
  generateSecureHeaders: jest.fn(() => ({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  })),
}));

describe('Subscription API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default security middleware behavior
    mockPaymentSecurity.validatePaymentRequest = jest.fn().mockResolvedValue({
      context: mockContext,
      response: null,
    });
    
    mockPaymentSecurity.logPaymentEvent = jest.fn().mockResolvedValue(undefined);
    
    // Setup default subscription manager behavior
    mockSubscriptionManager.getSubscriptionWithDetails = jest.fn().mockResolvedValue(mockSubscription);
    mockSubscriptionManager.createSubscription = jest.fn().mockResolvedValue(mockSubscription);
    mockSubscriptionManager.changePlan = jest.fn().mockResolvedValue(mockSubscription);
    mockSubscriptionManager.previewPlanChange = jest.fn().mockResolvedValue(mockPlanChangePreview);
    mockSubscriptionManager.cancelAtPeriodEnd = jest.fn().mockResolvedValue({
      ...mockSubscription,
      cancelAtPeriodEnd: true,
    });
    mockSubscriptionManager.cancelImmediately = jest.fn().mockResolvedValue({
      ...mockSubscription,
      status: 'canceled',
    });
    mockSubscriptionManager.convertTrialToPaid = jest.fn().mockResolvedValue(mockSubscription);
    mockSubscriptionManager.extendTrial = jest.fn().mockResolvedValue(mockSubscription);
    mockSubscriptionManager.reportUsage = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/payments/subscriptions/[subscriptionId]', () => {
    it('should retrieve subscription details successfully', async () => {
      const request = new NextRequest('http://localhost/api/payments/subscriptions/sub_123');
      const params = { subscriptionId: 'sub_123' };

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        id: 'sub_123',
        customerId: 'cust_123',
        status: 'active',
        customer: expect.objectContaining({
          email: 'test@example.com',
        }),
        plan: expect.objectContaining({
          name: 'Professional Plan',
        }),
        billing: expect.objectContaining({
          nextBillingDate: expect.any(String),
          isTrialing: false,
        }),
      });

      expect(mockSubscriptionManager.getSubscriptionWithDetails).toHaveBeenCalledWith('sub_123');
      expect(mockPaymentSecurity.logPaymentEvent).toHaveBeenCalledWith(
        mockContext,
        'subscription_details_retrieved',
        'subscription',
        true,
        expect.any(Object)
      );
    });

    it('should return 404 for non-existent subscription', async () => {
      mockSubscriptionManager.getSubscriptionWithDetails = jest.fn().mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/payments/subscriptions/invalid_sub');
      const params = { subscriptionId: 'invalid_sub' };

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Subscription not found');
    });

    it('should deny access to unauthorized users', async () => {
      const unauthorizedSubscription = {
        ...mockSubscription,
        customerId: 'other_customer',
      };

      mockSubscriptionManager.getSubscriptionWithDetails = jest.fn().mockResolvedValue(unauthorizedSubscription);

      const request = new NextRequest('http://localhost/api/payments/subscriptions/sub_123');
      const params = { subscriptionId: 'sub_123' };

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Access denied');
    });
  });

  describe('PUT /api/payments/subscriptions/[subscriptionId]', () => {
    it('should pause subscription successfully', async () => {
      const requestBody = { action: 'pause' };
      const request = new NextRequest('http://localhost/api/payments/subscriptions/sub_123', {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      });
      const params = { subscriptionId: 'sub_123' };

      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.action).toBe('pause');
      expect(data.updated).toBe(true);

      expect(mockSubscriptionManager.cancelAtPeriodEnd).toHaveBeenCalledWith('sub_123');
    });

    it('should convert trial subscription to paid', async () => {
      const trialSubscription = {
        ...mockSubscription,
        status: 'trialing',
      };

      mockSubscriptionManager.getSubscriptionWithDetails = jest.fn().mockResolvedValue(trialSubscription);

      const requestBody = {
        action: 'convert_trial',
        planId: 'plan_456',
        paymentMethodId: 'pm_123',
      };

      const request = new NextRequest('http://localhost/api/payments/subscriptions/sub_123', {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      });
      const params = { subscriptionId: 'sub_123' };

      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.action).toBe('convert_trial');

      expect(mockSubscriptionManager.convertTrialToPaid).toHaveBeenCalledWith('sub_123', {
        planId: 'plan_456',
        paymentMethodId: 'pm_123',
        couponId: undefined,
        promotionCode: undefined,
      });
    });

    it('should extend trial period', async () => {
      const trialSubscription = {
        ...mockSubscription,
        status: 'trialing',
        trialEnd: new Date('2024-01-15'),
      };

      mockSubscriptionManager.getSubscriptionWithDetails = jest.fn().mockResolvedValue(trialSubscription);

      const requestBody = {
        action: 'extend_trial',
        additionalDays: 7,
      };

      const request = new NextRequest('http://localhost/api/payments/subscriptions/sub_123', {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      });
      const params = { subscriptionId: 'sub_123' };

      const response = await PUT(request, { params });

      expect(response.status).toBe(200);
      expect(mockSubscriptionManager.extendTrial).toHaveBeenCalledWith('sub_123', 7);
    });

    it('should report usage for metered billing', async () => {
      const requestBody = {
        action: 'report_usage',
        subscriptionItemId: 'si_123',
        quantity: 100,
        action: 'increment',
      };

      const request = new NextRequest('http://localhost/api/payments/subscriptions/sub_123', {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      });
      const params = { subscriptionId: 'sub_123' };

      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.quantity).toBe(100);

      expect(mockSubscriptionManager.reportUsage).toHaveBeenCalledWith({
        subscriptionId: 'sub_123',
        subscriptionItemId: 'si_123',
        quantity: 100,
        action: 'increment',
      });
    });

    it('should reject invalid actions', async () => {
      const requestBody = { action: 'invalid_action' };
      const request = new NextRequest('http://localhost/api/payments/subscriptions/sub_123', {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      });
      const params = { subscriptionId: 'sub_123' };

      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid action');
      expect(data.validActions).toBeInstanceOf(Array);
    });
  });

  describe('DELETE /api/payments/subscriptions/[subscriptionId]', () => {
    it('should cancel subscription immediately', async () => {
      const request = new NextRequest('http://localhost/api/payments/subscriptions/sub_123', {
        method: 'DELETE',
      });
      const params = { subscriptionId: 'sub_123' };

      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Subscription canceled successfully');
      expect(data.subscriptionId).toBe('sub_123');

      expect(mockSubscriptionManager.cancelImmediately).toHaveBeenCalledWith('sub_123', true);
    });
  });

  describe('POST /api/payments/subscriptions/[subscriptionId]/cancel', () => {
    it('should process subscription cancellation with survey', async () => {
      const requestBody = {
        reason: 'too_expensive',
        feedback: 'The pricing is not suitable for my budget',
        immediate: false,
        requestRefund: false,
        retentionOffer: 'discount',
        surveyResponse: {
          satisfaction: '3',
          likelihood_return: '7',
        },
      };

      const request = new NextRequest('http://localhost/api/payments/subscriptions/sub_123/cancel', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const params = { subscriptionId: 'sub_123' };

      const response = await CancelSubscription(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.reason).toBe('too_expensive');
      expect(data.cancellationEffectiveDate).toBe(mockSubscription.currentPeriodEnd.toISOString());

      expect(mockSubscriptionManager.cancelAtPeriodEnd).toHaveBeenCalledWith('sub_123');
    });

    it('should process immediate cancellation with refund', async () => {
      const requestBody = {
        reason: 'requested_by_customer',
        immediate: true,
        requestRefund: true,
      };

      // Mock recent transaction for refund
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ 
                  data: { id: 'txn_123' }, 
                  error: null 
                }),
              }),
            }),
          }),
        }),
      });

      mockBillingService.processRefund = jest.fn().mockResolvedValue({ id: 'refund_123' });

      const request = new NextRequest('http://localhost/api/payments/subscriptions/sub_123/cancel', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const params = { subscriptionId: 'sub_123' };

      const response = await CancelSubscription(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.refund?.processed).toBe(true);

      expect(mockSubscriptionManager.cancelImmediately).toHaveBeenCalledWith('sub_123', true);
    });
  });

  describe('GET /api/payments/subscriptions/[subscriptionId]/cancel', () => {
    it('should return cancellation options', async () => {
      const request = new NextRequest('http://localhost/api/payments/subscriptions/sub_123/cancel');
      const params = { subscriptionId: 'sub_123' };

      const response = await GetCancellationOptions(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        subscriptionId: 'sub_123',
        canCancel: true,
        options: expect.objectContaining({
          immediate: expect.objectContaining({
            available: true,
            refund: expect.any(Object),
          }),
          endOfPeriod: expect.objectContaining({
            available: true,
            accessUntil: expect.any(String),
          }),
        }),
        retentionOffers: expect.any(Array),
        surveyQuestions: expect.any(Array),
      });
    });
  });

  describe('POST /api/payments/subscriptions/[subscriptionId]/change-plan', () => {
    it('should change subscription plan successfully', async () => {
      const requestBody = {
        newPlanId: 'plan_456',
        prorationBehavior: 'create_prorations',
      };

      const request = new NextRequest('http://localhost/api/payments/subscriptions/sub_123/change-plan', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const params = { subscriptionId: 'sub_123' };

      const response = await ChangePlan(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.planChange.type).toBe('upgrade');
      expect(data.planChange.toPlan.id).toBe('plan_456');

      expect(mockSubscriptionManager.changePlan).toHaveBeenCalledWith({
        subscriptionId: 'sub_123',
        newPlanId: 'plan_456',
        prorationBehavior: 'create_prorations',
        billingCycleAnchor: 'unchanged',
      });
    });

    it('should reject plan change to same plan', async () => {
      const requestBody = {
        newPlanId: 'plan_123', // Same as current plan
      };

      const request = new NextRequest('http://localhost/api/payments/subscriptions/sub_123/change-plan', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const params = { subscriptionId: 'sub_123' };

      const response = await ChangePlan(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('New plan is the same as current plan');
    });
  });

  describe('GET /api/payments/subscriptions/[subscriptionId]/change-plan', () => {
    it('should preview plan change', async () => {
      const request = new NextRequest('http://localhost/api/payments/subscriptions/sub_123/change-plan?newPlanId=plan_456');
      const params = { subscriptionId: 'sub_123' };

      const response = await PreviewPlanChange(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        subscriptionId: 'sub_123',
        changeType: 'upgrade',
        valid: true,
        currentPlan: expect.objectContaining({
          name: 'Professional Plan',
        }),
        newPlan: expect.objectContaining({
          name: 'Enterprise Plan',
        }),
        proration: expect.objectContaining({
          immediateCharge: expect.any(Number),
          nextBillingAmount: expect.any(Number),
        }),
      });

      expect(mockSubscriptionManager.previewPlanChange).toHaveBeenCalledWith('sub_123', 'plan_456');
    });
  });

  describe('POST /api/payments/subscriptions/preview', () => {
    it('should generate new subscription preview', async () => {
      const requestBody = {
        type: 'new_subscription',
        customerId: 'cust_123',
        planId: 'plan_123',
        trialDays: 14,
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: mockSubscription.plan, 
              error: null 
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost/api/payments/subscriptions/preview', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await CreateSubscriptionPreview(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        type: 'new_subscription',
        valid: true,
        plan: expect.objectContaining({
          name: 'Professional Plan',
          amount: 7900,
        }),
        trial: expect.objectContaining({
          enabled: true,
          days: 14,
        }),
        billing: expect.objectContaining({
          immediateCharge: 0, // No charge during trial
          recurringAmount: 7900,
        }),
      });
    });

    it('should generate plan change preview', async () => {
      const requestBody = {
        type: 'plan_change',
        customerId: 'cust_123',
        subscriptionId: 'sub_123',
        newPlanId: 'plan_456',
      };

      const request = new NextRequest('http://localhost/api/payments/subscriptions/preview', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await CreateSubscriptionPreview(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        type: 'plan_change',
        valid: true,
        changeType: expect.any(String),
        currentPlan: expect.any(Object),
        newPlan: expect.any(Object),
        proration: expect.any(Object),
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle subscription manager errors', async () => {
      mockSubscriptionManager.getSubscriptionWithDetails = jest.fn().mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/payments/subscriptions/sub_123');
      const params = { subscriptionId: 'sub_123' };

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to retrieve subscription details');
    });

    it('should handle invalid JSON in request body', async () => {
      const request = new NextRequest('http://localhost/api/payments/subscriptions/sub_123', {
        method: 'PUT',
        body: 'invalid json',
      });
      const params = { subscriptionId: 'sub_123' };

      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON in request body');
    });

    it('should handle security validation failures', async () => {
      mockPaymentSecurity.validatePaymentRequest = jest.fn().mockResolvedValue({
        context: null,
        response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      });

      const request = new NextRequest('http://localhost/api/payments/subscriptions/sub_123');
      const params = { subscriptionId: 'sub_123' };

      const response = await GET(request, { params });

      expect(response.status).toBe(401);
    });
  });

  describe('Logging and Monitoring', () => {
    it('should log all successful operations', async () => {
      const request = new NextRequest('http://localhost/api/payments/subscriptions/sub_123');
      const params = { subscriptionId: 'sub_123' };

      await GET(request, { params });

      expect(mockPaymentSecurity.logPaymentEvent).toHaveBeenCalledWith(
        mockContext,
        'subscription_details_retrieved',
        'subscription',
        true,
        expect.any(Object)
      );
    });

    it('should log failed operations', async () => {
      mockSubscriptionManager.getSubscriptionWithDetails = jest.fn().mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/payments/subscriptions/invalid_sub');
      const params = { subscriptionId: 'invalid_sub' };

      await GET(request, { params });

      expect(mockPaymentSecurity.logPaymentEvent).toHaveBeenCalledWith(
        mockContext,
        'subscription_not_found',
        'subscription',
        false,
        expect.any(Object),
        'Subscription not found'
      );
    });

    it('should log access denied attempts', async () => {
      const unauthorizedSubscription = {
        ...mockSubscription,
        customerId: 'other_customer',
      };

      mockSubscriptionManager.getSubscriptionWithDetails = jest.fn().mockResolvedValue(unauthorizedSubscription);

      const request = new NextRequest('http://localhost/api/payments/subscriptions/sub_123');
      const params = { subscriptionId: 'sub_123' };

      await GET(request, { params });

      expect(mockPaymentSecurity.logPaymentEvent).toHaveBeenCalledWith(
        mockContext,
        'subscription_access_denied',
        'subscription',
        false,
        expect.objectContaining({
          subscriptionId: 'sub_123',
          requestedCustomerId: 'other_customer',
          allowedCustomerId: 'cust_123',
        }),
        'Access denied to subscription'
      );
    });
  });
});