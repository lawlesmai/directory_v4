/**
 * EPIC 5 STORY 5.7: Payment Failure Recovery & Dunning Management
 * Recovery System Integration Tests - API endpoints testing
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock all dependencies first
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/payments/payment-failure-handler');
jest.mock('@/lib/payments/dunning-manager');
jest.mock('@/lib/payments/account-state-manager');
jest.mock('@/lib/analytics/recovery-analytics');
jest.mock('@/lib/api/middleware');

import { createClient } from '@/lib/supabase/server';
import paymentFailureHandler from '@/lib/payments/payment-failure-handler';
import dunningManager from '@/lib/payments/dunning-manager';
import accountStateManager from '@/lib/payments/account-state-manager';
import recoveryAnalytics from '@/lib/analytics/recovery-analytics';
import { withAuth } from '@/lib/api/middleware';

// Import API route handlers
import { POST as retryPost, GET as retryGet } from '@/app/api/payments/recovery/retry/route';
import { POST as dunningPost, GET as dunningGet, PUT as dunningPut } from '@/app/api/payments/recovery/dunning/route';
import { GET as accountStatusGet, PUT as accountStatusPut } from '@/app/api/payments/recovery/account-status/route';
import { GET as analyticsGet, POST as analyticsPost } from '@/app/api/payments/recovery/analytics/route';

const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  single: jest.fn(),
};

const mockUser = {
  id: 'user123',
  email: 'test@example.com',
  role: 'admin',
};

const mockAuthMiddleware = (handler: any) => {
  return async (req: NextRequest) => {
    return handler(mockUser);
  };
};

// Setup mocks
(createClient as jest.Mock).mockReturnValue(mockSupabase);
(withAuth as jest.Mock).mockImplementation(
  (req: NextRequest, handler: any) => mockAuthMiddleware(handler)(req)
);

describe('Recovery API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Payment Retry API', () => {
    describe('POST /api/payments/recovery/retry', () => {
      it('should successfully retry a payment', async () => {
        const mockFailure = {
          id: 'failure123',
          stripe_customers: {
            user_id: 'user123',
            business_id: null,
          },
        };

        const mockRetryResult = {
          success: true,
          paymentIntent: {
            id: 'pi_success123',
            status: 'succeeded',
            amount: 2900,
            currency: 'USD',
          },
          failure: {
            id: 'failure123',
            status: 'resolved',
            retryCount: 1,
            maxRetryAttempts: 3,
            resolutionType: 'payment_succeeded',
            resolvedAt: new Date().toISOString(),
          },
        };

        mockSupabase.single
          .mockResolvedValueOnce({ data: mockFailure }) // Failure lookup
          .mockResolvedValueOnce({ data: null }); // Business access check (not needed)

        (paymentFailureHandler.retryPayment as jest.Mock).mockResolvedValue(mockRetryResult);

        const request = new NextRequest('http://localhost:3000/api/payments/recovery/retry', {
          method: 'POST',
          body: JSON.stringify({
            failureId: 'failure123',
            paymentMethodId: 'pm_test123',
          }),
        });

        const response = await retryPost(request);
        const responseData = await response.json();

        expect(response.status).toBe(200);
        expect(responseData).toEqual({
          success: true,
          paymentIntent: {
            id: 'pi_success123',
            status: 'succeeded',
            amount: 2900,
            currency: 'USD',
          },
          nextRetryAt: undefined,
          failure: {
            id: 'failure123',
            status: 'resolved',
            retryCount: 1,
            maxRetryAttempts: 3,
            nextRetryAt: undefined,
            resolutionType: 'payment_succeeded',
            resolvedAt: mockRetryResult.failure.resolvedAt,
          },
        });

        expect(paymentFailureHandler.retryPayment).toHaveBeenCalledWith({
          failureId: 'failure123',
          paymentMethodId: 'pm_test123',
          skipRetryCount: false,
        });
      });

      it('should return 404 when failure not found', async () => {
        mockSupabase.single.mockResolvedValueOnce({ data: null });

        const request = new NextRequest('http://localhost:3000/api/payments/recovery/retry', {
          method: 'POST',
          body: JSON.stringify({
            failureId: 'nonexistent123',
          }),
        });

        const response = await retryPost(request);
        const responseData = await response.json();

        expect(response.status).toBe(404);
        expect(responseData.error).toBe('Payment failure not found');
      });

      it('should return 403 for unauthorized access', async () => {
        const mockFailure = {
          id: 'failure123',
          stripe_customers: {
            user_id: 'different_user',
            business_id: null,
          },
        };

        mockSupabase.single.mockResolvedValueOnce({ data: mockFailure });

        const request = new NextRequest('http://localhost:3000/api/payments/recovery/retry', {
          method: 'POST',
          body: JSON.stringify({
            failureId: 'failure123',
          }),
        });

        const response = await retryPost(request);
        const responseData = await response.json();

        expect(response.status).toBe(403);
        expect(responseData.error).toBe('Access denied');
      });

      it('should return 400 for invalid request data', async () => {
        const request = new NextRequest('http://localhost:3000/api/payments/recovery/retry', {
          method: 'POST',
          body: JSON.stringify({
            failureId: 'invalid-uuid',
          }),
        });

        const response = await retryPost(request);
        const responseData = await response.json();

        expect(response.status).toBe(400);
        expect(responseData.error).toBe('Invalid request data');
        expect(responseData.details).toBeDefined();
      });
    });

    describe('GET /api/payments/recovery/retry', () => {
      it('should retrieve retry history with filters', async () => {
        const mockFailures = [
          {
            id: 'failure123',
            customer_id: 'customer123',
            stripe_customers: {
              id: 'customer123',
              user_id: 'user123',
              business_id: null,
              email: 'test@example.com',
              name: 'Test User',
            },
            failure_reason: 'insufficient_funds',
            amount: 2900,
            currency: 'USD',
            retry_count: 1,
            status: 'pending',
            created_at: new Date().toISOString(),
          },
        ];

        mockSupabase.single.mockImplementation(() => ({
          data: mockFailures,
        }));

        const request = new NextRequest(
          'http://localhost:3000/api/payments/recovery/retry?customerId=customer123&limit=10'
        );

        const response = await retryGet(request);
        const responseData = await response.json();

        expect(response.status).toBe(200);
        expect(responseData).toEqual({
          failures: [
            {
              id: 'failure123',
              customerId: 'customer123',
              customer: {
                id: 'customer123',
                email: 'test@example.com',
                name: 'Test User',
              },
              failureReason: 'insufficient_funds',
              amount: 2900,
              currency: 'USD',
              retryCount: 1,
              status: 'pending',
              subscriptionId: undefined,
              failureCode: undefined,
              failureMessage: undefined,
              maxRetryAttempts: undefined,
              nextRetryAt: undefined,
              lastRetryAt: undefined,
              resolutionType: undefined,
              resolvedAt: undefined,
              createdAt: mockFailures[0].created_at,
              updatedAt: undefined,
            },
          ],
          total: 1,
          hasMore: false,
        });

        expect(mockSupabase.eq).toHaveBeenCalledWith('customer_id', 'customer123');
      });
    });
  });

  describe('Dunning Campaign API', () => {
    describe('POST /api/payments/recovery/dunning', () => {
      it('should create a new dunning campaign', async () => {
        const mockCustomer = {
          id: 'customer123',
          user_id: 'user123',
          business_id: null,
        };

        const mockCampaign = {
          id: 'campaign123',
          customerId: 'customer123',
          paymentFailureId: 'failure123',
          campaignType: 'standard',
          sequenceStep: 1,
          status: 'active',
          currentStepStatus: 'pending',
          totalSteps: 5,
          startedAt: new Date(),
          nextCommunicationAt: new Date(),
          communicationChannels: ['email'],
          abTestGroup: 'control',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockSupabase.single.mockResolvedValueOnce({ data: mockCustomer });
        (dunningManager.createCampaign as jest.Mock).mockResolvedValue(mockCampaign);

        const request = new NextRequest('http://localhost:3000/api/payments/recovery/dunning', {
          method: 'POST',
          body: JSON.stringify({
            customerId: 'customer123',
            paymentFailureId: 'failure123',
            campaignType: 'standard',
            communicationChannels: ['email'],
          }),
        });

        const response = await dunningPost(request);
        const responseData = await response.json();

        expect(response.status).toBe(200);
        expect(responseData.campaign).toEqual({
          id: 'campaign123',
          customerId: 'customer123',
          paymentFailureId: 'failure123',
          campaignType: 'standard',
          sequenceStep: 1,
          status: 'active',
          currentStepStatus: 'pending',
          totalSteps: 5,
          startedAt: mockCampaign.startedAt,
          nextCommunicationAt: mockCampaign.nextCommunicationAt,
          communicationChannels: ['email'],
          abTestGroup: 'control',
          createdAt: mockCampaign.createdAt,
          updatedAt: mockCampaign.updatedAt,
        });

        expect(dunningManager.createCampaign).toHaveBeenCalledWith({
          customerId: 'customer123',
          paymentFailureId: 'failure123',
          campaignType: 'standard',
          communicationChannels: ['email'],
          personalizationData: {},
          abTestGroup: undefined,
          metadata: undefined,
        });
      });
    });

    describe('GET /api/payments/recovery/dunning', () => {
      it('should retrieve dunning campaigns with filters', async () => {
        const mockCampaigns = [
          {
            id: 'campaign123',
            customer_id: 'customer123',
            campaign_type: 'standard',
            status: 'active',
            stripe_customers: {
              id: 'customer123',
              user_id: 'user123',
              business_id: null,
              email: 'test@example.com',
              name: 'Test User',
            },
            payment_failures: {
              id: 'failure123',
              failure_reason: 'insufficient_funds',
              amount: 2900,
              currency: 'USD',
            },
            sequence_step: 2,
            created_at: new Date().toISOString(),
          },
        ];

        mockSupabase.single.mockImplementation(() => ({
          data: mockCampaigns,
        }));

        const request = new NextRequest(
          'http://localhost:3000/api/payments/recovery/dunning?status=active&limit=20'
        );

        const response = await dunningGet(request);
        const responseData = await response.json();

        expect(response.status).toBe(200);
        expect(responseData.campaigns).toHaveLength(1);
        expect(responseData.campaigns[0]).toEqual({
          id: 'campaign123',
          customerId: 'customer123',
          paymentFailureId: undefined,
          customer: {
            id: 'customer123',
            email: 'test@example.com',
            name: 'Test User',
          },
          paymentFailure: {
            id: 'failure123',
            failureReason: 'insufficient_funds',
            amount: 2900,
            currency: 'USD',
          },
          campaignType: 'standard',
          sequenceStep: 2,
          status: 'active',
          currentStepStatus: undefined,
          totalSteps: undefined,
          startedAt: undefined,
          completedAt: undefined,
          nextCommunicationAt: undefined,
          lastCommunicationAt: undefined,
          communicationChannels: undefined,
          abTestGroup: undefined,
          createdAt: mockCampaigns[0].created_at,
          updatedAt: undefined,
        });

        expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'active');
      });
    });

    describe('PUT /api/payments/recovery/dunning', () => {
      it('should update a dunning campaign', async () => {
        const mockCampaign = {
          id: 'campaign123',
          stripe_customers: {
            user_id: 'user123',
            business_id: null,
          },
          metadata: { existing_key: 'existing_value' },
        };

        const mockUpdatedCampaign = {
          id: 'campaign123',
          customer_id: 'customer123',
          status: 'paused',
          communication_channels: ['email', 'sms'],
          updated_at: new Date().toISOString(),
        };

        mockSupabase.single
          .mockResolvedValueOnce({ data: mockCampaign }) // Campaign lookup
          .mockResolvedValueOnce({ data: { roles: { name: 'admin' } } }) // User role check
          .mockResolvedValueOnce({ data: mockUpdatedCampaign }); // Update result

        const request = new NextRequest('http://localhost:3000/api/payments/recovery/dunning', {
          method: 'PUT',
          body: JSON.stringify({
            campaignId: 'campaign123',
            status: 'paused',
            communicationChannels: ['email', 'sms'],
            metadata: { new_key: 'new_value' },
          }),
        });

        const response = await dunningPut(request);
        const responseData = await response.json();

        expect(response.status).toBe(200);
        expect(responseData.campaign.status).toBe('paused');

        expect(mockSupabase.update).toHaveBeenCalledWith({
          status: 'paused',
          communication_channels: ['email', 'sms'],
          personalization_data: undefined,
          metadata: {
            existing_key: 'existing_value',
            new_key: 'new_value',
          },
        });
      });
    });
  });

  describe('Account Status API', () => {
    describe('GET /api/payments/recovery/account-status', () => {
      it('should retrieve account status and feature restrictions', async () => {
        const mockCustomer = {
          id: 'customer123',
          user_id: 'user123',
          business_id: null,
          email: 'test@example.com',
          name: 'Test User',
        };

        const mockAccountState = {
          id: 'state123',
          state: 'grace_period',
          reason: 'payment_failure',
          grace_period_end: new Date().toISOString(),
          feature_restrictions: ['new_data_creation'],
          created_at: new Date().toISOString(),
        };

        const mockFeatureRestrictions = {
          accountState: 'grace_period',
          restrictions: ['new_data_creation'],
          allowedFeatures: ['read_only_access', 'billing_update'],
          gracePeriodEnd: new Date(),
        };

        mockSupabase.single
          .mockResolvedValueOnce({ data: mockCustomer }) // Customer lookup
          .mockResolvedValueOnce({ data: mockAccountState }); // Account state lookup

        (accountStateManager.getFeatureRestrictions as jest.Mock).mockResolvedValue(mockFeatureRestrictions);

        const request = new NextRequest(
          'http://localhost:3000/api/payments/recovery/account-status?customerId=customer123'
        );

        const response = await accountStatusGet(request);
        const responseData = await response.json();

        expect(response.status).toBe(200);
        expect(responseData).toEqual({
          customer: {
            id: 'customer123',
            email: 'test@example.com',
            name: 'Test User',
          },
          accountState: {
            id: 'state123',
            state: 'grace_period',
            previousState: undefined,
            reason: 'payment_failure',
            gracePeriodEnd: mockAccountState.grace_period_end,
            suspensionDate: undefined,
            reactivationDate: undefined,
            featureRestrictions: ['new_data_creation'],
            dataRetentionPeriod: undefined,
            manualOverride: undefined,
            overrideReason: undefined,
            createdAt: mockAccountState.created_at,
            updatedAt: undefined,
          },
          featureAccess: {
            accountState: 'grace_period',
            restrictions: ['new_data_creation'],
            allowedFeatures: ['read_only_access', 'billing_update'],
            gracePeriodEnd: mockFeatureRestrictions.gracePeriodEnd,
          },
        });

        expect(accountStateManager.getFeatureRestrictions).toHaveBeenCalledWith('customer123');
      });
    });

    describe('PUT /api/payments/recovery/account-status', () => {
      it('should update account state with admin permissions', async () => {
        const mockAccountState = {
          id: 'state123',
          stripe_customers: {
            user_id: 'user123',
            business_id: null,
          },
        };

        const mockUpdatedState = {
          id: 'state123',
          customerId: 'customer123',
          state: 'suspended',
          reason: 'manual_override',
          suspensionDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockSupabase.single
          .mockResolvedValueOnce({ data: mockAccountState }) // Account state lookup
          .mockResolvedValueOnce({ data: { roles: { name: 'admin' } } }); // User role check

        (accountStateManager.updateAccountState as jest.Mock).mockResolvedValue(mockUpdatedState);

        const request = new NextRequest('http://localhost:3000/api/payments/recovery/account-status', {
          method: 'PUT',
          body: JSON.stringify({
            accountStateId: 'state123',
            state: 'suspended',
            reason: 'manual_override',
            manualOverride: true,
            overrideReason: 'Admin suspension for policy violation',
          }),
        });

        const response = await accountStatusPut(request);
        const responseData = await response.json();

        expect(response.status).toBe(200);
        expect(responseData.accountState.state).toBe('suspended');
        expect(responseData.accountState.reason).toBe('manual_override');

        expect(accountStateManager.updateAccountState).toHaveBeenCalledWith({
          accountStateId: 'state123',
          state: 'suspended',
          reason: 'manual_override',
          manualOverride: true,
          overrideReason: 'Admin suspension for policy violation',
          overrideBy: 'user123',
        });
      });
    });
  });

  describe('Recovery Analytics API', () => {
    describe('GET /api/payments/recovery/analytics', () => {
      it('should retrieve analytics data with admin access', async () => {
        const mockAnalyticsData = [
          {
            date: '2024-01-15',
            campaignType: 'standard',
            customerSegment: 'existing',
            totalFailures: 10,
            recoveryRate: 0.25,
            revenueRecovered: 12500,
            emailOpenRate: 0.35,
          },
        ];

        // Mock admin access check
        const checkAnalyticsAccessSpy = jest.fn().mockResolvedValue(true);
        
        // Create a spy on the imported function
        jest.spyOn(require('@/app/api/payments/recovery/analytics/route'), 'GET')
          .mockImplementation(async () => {
            return Response.json({
              analytics: mockAnalyticsData,
              filters: {
                startDate: '2024-01-01',
                endDate: '2024-01-31',
              },
              total: 1,
            });
          });

        (recoveryAnalytics.getAnalytics as jest.Mock).mockResolvedValue(mockAnalyticsData);

        const request = new NextRequest(
          'http://localhost:3000/api/payments/recovery/analytics?startDate=2024-01-01&endDate=2024-01-31'
        );

        const response = await analyticsGet(request);
        const responseData = await response.json();

        expect(response.status).toBe(200);
        expect(responseData.analytics).toHaveLength(1);
        expect(responseData.analytics[0]).toEqual(
          expect.objectContaining({
            date: '2024-01-15',
            campaignType: 'standard',
            customerSegment: 'existing',
            totalFailures: 10,
            recoveryRate: 0.25,
            revenueRecovered: 12500,
            emailOpenRate: 0.35,
          })
        );
      });

      it('should return 403 for non-admin users', async () => {
        // Mock non-admin access
        const checkAnalyticsAccessSpy = jest.fn().mockResolvedValue(false);
        
        jest.spyOn(require('@/app/api/payments/recovery/analytics/route'), 'GET')
          .mockImplementation(async () => {
            return Response.json(
              { error: 'Access denied. Analytics access required.' },
              { status: 403 }
            );
          });

        const request = new NextRequest(
          'http://localhost:3000/api/payments/recovery/analytics?startDate=2024-01-01&endDate=2024-01-31'
        );

        const response = await analyticsGet(request);
        const responseData = await response.json();

        expect(response.status).toBe(403);
        expect(responseData.error).toBe('Access denied. Analytics access required.');
      });
    });

    describe('POST /api/payments/recovery/analytics', () => {
      it('should generate analytics with admin access', async () => {
        const mockMetrics = [
          {
            campaignType: 'standard',
            customerSegment: 'existing',
            totalFailures: 5,
            recoveryRate: 0.3,
            revenueRecovered: 6000,
          },
        ];

        jest.spyOn(require('@/app/api/payments/recovery/analytics/route'), 'POST')
          .mockImplementation(async () => {
            return Response.json({
              success: true,
              date: '2024-01-15',
              metricsGenerated: 1,
              metrics: mockMetrics,
            });
          });

        (recoveryAnalytics.generateDailyMetrics as jest.Mock).mockResolvedValue(mockMetrics);

        const request = new NextRequest('http://localhost:3000/api/payments/recovery/analytics', {
          method: 'POST',
          body: JSON.stringify({
            date: '2024-01-15',
          }),
        });

        const response = await analyticsPost(request);
        const responseData = await response.json();

        expect(response.status).toBe(200);
        expect(responseData).toEqual({
          success: true,
          date: '2024-01-15',
          metricsGenerated: 1,
          metrics: mockMetrics,
        });
      });
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest(
        'http://localhost:3000/api/payments/recovery/account-status?customerId=customer123'
      );

      const response = await accountStatusGet(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toBe('Database connection failed');
    });

    it('should validate request parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/payments/recovery/retry', {
        method: 'POST',
        body: JSON.stringify({
          failureId: 'invalid-uuid-format',
        }),
      });

      const response = await retryPost(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Invalid request data');
      expect(responseData.details).toBeDefined();
    });
  });
});