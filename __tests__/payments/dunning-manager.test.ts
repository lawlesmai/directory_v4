/**
 * EPIC 5 STORY 5.7: Payment Failure Recovery & Dunning Management
 * Dunning Manager Tests - Comprehensive test suite
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@/lib/supabase/server';
import dunningManager, { DunningManager } from '@/lib/payments/dunning-manager';

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
};

(createClient as jest.Mock).mockReturnValue(mockSupabase);

describe('DunningManager', () => {
  let manager: DunningManager;

  beforeEach(() => {
    manager = new DunningManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createCampaign', () => {
    const mockCampaignData = {
      customerId: '123e4567-e89b-12d3-a456-426614174000',
      paymentFailureId: '550e8400-e29b-41d4-a716-446655440000',
      campaignType: 'standard' as const,
      communicationChannels: ['email'],
      personalizationData: {
        customer_name: 'John Doe',
        failure_amount: '$29.00',
      },
      metadata: {
        failure_reason: 'insufficient_funds',
        urgency: 'medium',
      },
    };

    const mockCustomer = {
      id: mockCampaignData.customerId,
      email: 'john.doe@example.com',
      name: 'John Doe',
      phone: '+1234567890',
    };

    beforeEach(() => {
      // Mock customer retrieval
      mockSupabase.single.mockResolvedValueOnce({ data: mockCustomer });
    });

    it('should create new campaign when no existing campaign found', async () => {
      // Mock no existing campaign
      mockSupabase.single.mockResolvedValueOnce({ data: null });

      const mockCampaignResult = {
        id: '770e8400-e29b-41d4-a716-446655440000',
        customer_id: mockCampaignData.customerId,
        payment_failure_id: mockCampaignData.paymentFailureId,
        campaign_type: mockCampaignData.campaignType,
        sequence_step: 1,
        status: 'active',
        current_step_status: 'pending',
        total_steps: 5,
        started_at: new Date().toISOString(),
        next_communication_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        communication_channels: mockCampaignData.communicationChannels,
        personalization_data: expect.objectContaining({
          customer_name: 'John Doe',
          customer_email: 'john.doe@example.com',
        }),
        ab_test_group: expect.any(String),
        metadata: mockCampaignData.metadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock campaign creation
      mockSupabase.single.mockResolvedValueOnce({ data: mockCampaignResult });

      const result = await manager.createCampaign(mockCampaignData);

      expect(result).toEqual({
        id: mockCampaignResult.id,
        customerId: mockCampaignData.customerId,
        paymentFailureId: mockCampaignData.paymentFailureId,
        campaignType: mockCampaignData.campaignType,
        sequenceStep: 1,
        status: 'active',
        currentStepStatus: 'pending',
        totalSteps: 5,
        startedAt: expect.any(Date),
        nextCommunicationAt: expect.any(Date),
        communicationChannels: mockCampaignData.communicationChannels,
        personalizationData: expect.objectContaining({
          customer_name: 'John Doe',
          customer_email: 'john.doe@example.com',
        }),
        abTestGroup: expect.any(String),
        metadata: mockCampaignData.metadata,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        completedAt: undefined,
        lastCommunicationAt: undefined,
      });

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_id: mockCampaignData.customerId,
          payment_failure_id: mockCampaignData.paymentFailureId,
          campaign_type: mockCampaignData.campaignType,
          status: 'active',
          current_step_status: 'pending',
          total_steps: 5,
        })
      );
    });

    it('should return existing active campaign if found', async () => {
      const existingCampaign = {
        id: '770e8400-e29b-41d4-a716-446655440000',
        customer_id: mockCampaignData.customerId,
        payment_failure_id: mockCampaignData.paymentFailureId,
        campaign_type: mockCampaignData.campaignType,
        status: 'active',
        sequence_step: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock existing campaign found
      mockSupabase.single.mockResolvedValueOnce({ data: existingCampaign });

      const result = await manager.createCampaign(mockCampaignData);

      expect(result.id).toBe(existingCampaign.id);
      expect(result.sequenceStep).toBe(2);
      expect(mockSupabase.insert).not.toHaveBeenCalled();
    });

    it('should handle high-value campaign type with different sequence', async () => {
      const highValueData = {
        ...mockCampaignData,
        campaignType: 'high_value' as const,
      };

      // Mock no existing campaign
      mockSupabase.single.mockResolvedValueOnce({ data: null });

      // Mock campaign creation with high-value configuration
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: '770e8400-e29b-41d4-a716-446655440000',
          campaign_type: 'high_value',
          total_steps: 5, // High-value campaigns have same total steps but different timing
          sequence_step: 1,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

      const result = await manager.createCampaign(highValueData);

      expect(result.campaignType).toBe('high_value');
      expect(result.totalSteps).toBe(5);
    });

    it('should handle customer not found error', async () => {
      // Mock customer not found
      mockSupabase.single.mockReset();
      mockSupabase.single.mockResolvedValueOnce({ data: null });

      await expect(manager.createCampaign(mockCampaignData)).rejects.toThrow('Customer not found');
    });

    it('should validate campaign data input', async () => {
      const invalidData = {
        customerId: 'invalid-uuid',
        paymentFailureId: 'invalid-uuid',
        campaignType: 'invalid' as any,
      };

      await expect(manager.createCampaign(invalidData)).rejects.toThrow();
    });
  });

  describe('processPendingCommunications', () => {
    const mockPendingCampaigns = [
      {
        id: '770e8400-e29b-41d4-a716-446655440001',
        customer_id: '123e4567-e89b-12d3-a456-426614174001',
        campaign_type: 'standard',
        sequence_step: 1,
        status: 'active',
        current_step_status: 'pending',
        total_steps: 5,
        communication_channels: ['email'],
        personalization_data: { customer_name: 'John Doe' },
        ab_test_group: 'control',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '770e8400-e29b-41d4-a716-446655440002',
        customer_id: '123e4567-e89b-12d3-a456-426614174002',
        campaign_type: 'high_value',
        sequence_step: 2,
        status: 'active',
        current_step_status: 'pending',
        total_steps: 5,
        communication_channels: ['email', 'sms'],
        personalization_data: { customer_name: 'Jane Smith' },
        ab_test_group: 'variant_a',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    beforeEach(() => {
      // Mock pending campaigns retrieval
      mockSupabase.single.mockImplementation(() => ({
        data: mockPendingCampaigns,
        count: mockPendingCampaigns.length,
      }));
    });

    it('should process multiple pending campaigns successfully', async () => {
      // Mock sendStepCommunications success for both campaigns
      const sendStepSpy = jest.spyOn(manager as any, 'sendStepCommunications');
      sendStepSpy.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);

      const result = await manager.processPendingCommunications();

      expect(result).toEqual({
        processed: 2,
        sent: 2,
        failed: 0,
      });

      expect(sendStepSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle communication failures gracefully', async () => {
      // Mock sendStepCommunications to fail for one campaign
      const sendStepSpy = jest.spyOn(manager as any, 'sendStepCommunications');
      sendStepSpy
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Email service unavailable'));

      const result = await manager.processPendingCommunications();

      expect(result).toEqual({
        processed: 2,
        sent: 1,
        failed: 1,
      });

      // Should mark failed campaign as failed
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          current_step_status: 'failed',
        })
      );
    });

    it('should return zero results when no pending campaigns', async () => {
      mockSupabase.single.mockReset();
      mockSupabase.single.mockImplementation(() => ({
        data: [],
        count: 0,
      }));

      const result = await manager.processPendingCommunications();

      expect(result).toEqual({
        processed: 0,
        sent: 0,
        failed: 0,
      });
    });
  });

  describe('sendCommunication', () => {
    const mockCommunicationData = {
      campaignId: '770e8400-e29b-41d4-a716-446655440000',
      communicationType: 'email' as const,
      templateId: 'std_email_1',
      subject: 'Payment Update Required',
      content: 'Hi John, we had trouble processing your payment...',
      metadata: {
        sequence_step: 1,
        urgency_level: 'low',
      },
    };

    const mockCampaign = {
      id: mockCommunicationData.campaignId,
      customerId: '123e4567-e89b-12d3-a456-426614174000',
      status: 'active',
    };

    const mockCustomer = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      user_id: 'user123',
    };

    beforeEach(() => {
      // Mock campaign retrieval
      mockSupabase.single.mockResolvedValueOnce({ data: mockCampaign });
      
      // Mock customer retrieval
      mockSupabase.single.mockResolvedValueOnce({ data: mockCustomer });
    });

    it('should successfully send email communication', async () => {
      const mockCommunicationResult = {
        id: '880e8400-e29b-41d4-a716-446655440000',
        campaign_id: mockCommunicationData.campaignId,
        customer_id: mockCustomer.id,
        communication_type: 'email',
        subject: mockCommunicationData.subject,
        content: mockCommunicationData.content,
        status: 'pending',
        metadata: mockCommunicationData.metadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock communication creation
      mockSupabase.single.mockResolvedValueOnce({ data: mockCommunicationResult });

      // Mock successful communication sending
      const sendActualSpy = jest.spyOn(manager as any, 'sendActualCommunication');
      sendActualSpy.mockResolvedValueOnce(true);

      // Mock communication status update
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          ...mockCommunicationResult,
          status: 'sent',
          sent_at: new Date().toISOString(),
        },
      });

      const result = await manager.sendCommunication(mockCommunicationData);

      expect(result).toEqual({
        id: mockCommunicationResult.id,
        campaignId: mockCommunicationData.campaignId,
        customerId: mockCustomer.id,
        communicationType: 'email',
        templateId: undefined,
        subject: mockCommunicationData.subject,
        content: mockCommunicationData.content,
        status: 'sent',
        sentAt: expect.any(Date),
        metadata: mockCommunicationData.metadata,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        deliveredAt: undefined,
        openedAt: undefined,
        clickedAt: undefined,
        bouncedAt: undefined,
        failedAt: undefined,
        failureReason: undefined,
        trackingId: undefined,
        externalMessageId: undefined,
      });

      expect(sendActualSpy).toHaveBeenCalledWith(
        'email',
        mockCustomer,
        mockCommunicationData.subject,
        mockCommunicationData.content,
        mockCommunicationResult.id
      );
    });

    it('should handle SMS communication', async () => {
      const smsData = {
        ...mockCommunicationData,
        communicationType: 'sms' as const,
        subject: undefined,
        content: 'Your payment failed. Update at: example.com/billing',
      };

      // Mock communication creation
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: '880e8400-e29b-41d4-a716-446655440000',
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

      // Mock successful SMS sending
      const sendActualSpy = jest.spyOn(manager as any, 'sendActualCommunication');
      sendActualSpy.mockResolvedValueOnce(true);

      // Mock status update
      mockSupabase.single.mockResolvedValueOnce({
        data: { status: 'sent', sent_at: new Date().toISOString() },
      });

      const result = await manager.sendCommunication(smsData);

      expect(result.communicationType).toBe('sms');
      expect(result.status).toBe('sent');
      expect(sendActualSpy).toHaveBeenCalledWith(
        'sms',
        mockCustomer,
        undefined,
        smsData.content,
        expect.any(String)
      );
    });

    it('should handle communication sending failure', async () => {
      // Mock communication creation
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: '880e8400-e29b-41d4-a716-446655440000',
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

      // Mock failed communication sending
      const sendActualSpy = jest.spyOn(manager as any, 'sendActualCommunication');
      sendActualSpy.mockResolvedValueOnce(false);

      // Mock status update to failed
      mockSupabase.single.mockResolvedValueOnce({
        data: { 
          status: 'failed', 
          failure_reason: 'Send failed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

      const result = await manager.sendCommunication(mockCommunicationData);

      expect(result.status).toBe('failed');
      expect(result.failureReason).toBe('Send failed');
    });

    it('should throw error when campaign not found', async () => {
      mockSupabase.single.mockReset();
      mockSupabase.single.mockResolvedValueOnce({ data: null });

      await expect(manager.sendCommunication(mockCommunicationData)).rejects.toThrow('Campaign not found');
    });
  });

  describe('getCampaignPerformance', () => {
    const campaignId = '770e8400-e29b-41d4-a716-446655440000';

    it('should calculate campaign performance metrics correctly', async () => {
      const mockCommunications = [
        { status: 'sent' },
        { status: 'delivered' },
        { status: 'opened' },
        { status: 'clicked' },
        { status: 'bounced' },
        { status: 'failed' },
      ];

      mockSupabase.single.mockImplementation(() => ({
        data: mockCommunications,
      }));

      const result = await manager.getCampaignPerformance(campaignId);

      expect(result).toEqual({
        campaignId,
        totalSent: 4, // sent, delivered, opened, clicked
        totalDelivered: 3, // delivered, opened, clicked
        totalOpened: 2, // opened, clicked
        totalClicked: 1, // clicked
        totalBounced: 1,
        totalFailed: 1,
        deliveryRate: 0.75, // 3/4
        openRate: expect.closeTo(0.667, 2), // 2/3
        clickRate: 0.5, // 1/2
        bounceRate: 0.25, // 1/4
        conversionRate: 0,
        revenueRecovered: 0,
      });
    });

    it('should handle empty communications list', async () => {
      mockSupabase.single.mockImplementation(() => ({
        data: null,
      }));

      const result = await manager.getCampaignPerformance(campaignId);

      expect(result).toEqual({
        campaignId,
        totalSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalBounced: 0,
        totalFailed: 0,
        deliveryRate: 0,
        openRate: 0,
        clickRate: 0,
        bounceRate: 0,
        conversionRate: 0,
        revenueRecovered: 0,
      });
    });
  });

  describe('A/B test group assignment', () => {
    it('should assign random A/B test groups', () => {
      const assignments = new Set();
      
      // Generate 100 assignments to test randomness
      for (let i = 0; i < 100; i++) {
        const assignment = (manager as any).assignABTestGroup();
        assignments.add(assignment);
      }

      // Should have all three possible groups
      expect(assignments.has('control')).toBe(true);
      expect(assignments.has('variant_a')).toBe(true);
      expect(assignments.has('variant_b')).toBe(true);
      expect(assignments.size).toBe(3);
    });
  });

  describe('content personalization', () => {
    it('should replace template variables with customer data', () => {
      const template = 'Hi {{customer_first_name}}, your payment of {{amount}} failed. Please update at {{billing_url}}.';
      const data = {
        customer_first_name: 'John',
        amount: '$29.00',
        billing_url: 'https://example.com/billing',
      };

      const result = (manager as any).personalizeContent(template, data);

      expect(result).toBe('Hi John, your payment of $29.00 failed. Please update at https://example.com/billing.');
    });

    it('should handle missing template variables gracefully', () => {
      const template = 'Hi {{customer_first_name}}, your {{missing_variable}} needs attention.';
      const data = {
        customer_first_name: 'John',
      };

      const result = (manager as any).personalizeContent(template, data);

      expect(result).toBe('Hi John, your {{missing_variable}} needs attention.');
    });
  });
});