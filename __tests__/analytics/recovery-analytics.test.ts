/**
 * EPIC 5 STORY 5.7: Payment Failure Recovery & Dunning Management
 * Recovery Analytics Tests - Comprehensive test suite
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@/lib/supabase/server';
import recoveryAnalytics, { RecoveryAnalytics } from '@/lib/analytics/recovery-analytics';

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
  not: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(),
  maybeSingle: jest.fn(),
  head: jest.fn(),
};

(createClient as jest.Mock).mockReturnValue(mockSupabase);

describe('RecoveryAnalytics', () => {
  let analytics: RecoveryAnalytics;

  beforeEach(() => {
    analytics = new RecoveryAnalytics();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('recordMetrics', () => {
    const mockMetricsData = {
      date: '2024-01-15',
      campaignType: 'standard',
      abTestGroup: 'control',
      failureReason: 'insufficient_funds',
      customerSegment: 'existing',
      totalFailures: 10,
      totalCampaignsStarted: 8,
      totalCampaignsCompleted: 6,
      totalCommunicationsSent: 24,
      emailOpenRate: 0.35,
      emailClickRate: 0.12,
      smsResponseRate: 0.18,
      recoveryRate: 0.25,
      revenueRecovered: 12500, // $125.00
      recoveryTimeAvg: 48,
      costPerRecovery: 750,
      roiPercentage: 150.5,
      metadata: {
        campaign_notes: 'High recovery rate for existing customers',
      },
    };

    it('should successfully record metrics', async () => {
      const mockResult = {
        id: '770e8400-e29b-41d4-a716-446655440000',
        date: mockMetricsData.date,
        campaign_type: mockMetricsData.campaignType,
        ab_test_group: mockMetricsData.abTestGroup,
        failure_reason: mockMetricsData.failureReason,
        customer_segment: mockMetricsData.customerSegment,
        total_failures: mockMetricsData.totalFailures,
        total_campaigns_started: mockMetricsData.totalCampaignsStarted,
        total_campaigns_completed: mockMetricsData.totalCampaignsCompleted,
        total_communications_sent: mockMetricsData.totalCommunicationsSent,
        email_open_rate: mockMetricsData.emailOpenRate,
        email_click_rate: mockMetricsData.emailClickRate,
        sms_response_rate: mockMetricsData.smsResponseRate,
        recovery_rate: mockMetricsData.recoveryRate,
        revenue_recovered: mockMetricsData.revenueRecovered,
        recovery_time_avg: mockMetricsData.recoveryTimeAvg,
        cost_per_recovery: mockMetricsData.costPerRecovery,
        roi_percentage: mockMetricsData.roiPercentage,
        metadata: mockMetricsData.metadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockSupabase.single.mockResolvedValueOnce({ data: mockResult });

      const result = await analytics.recordMetrics(mockMetricsData);

      expect(result).toEqual({
        date: mockMetricsData.date,
        campaignType: mockMetricsData.campaignType,
        abTestGroup: mockMetricsData.abTestGroup,
        failureReason: mockMetricsData.failureReason,
        customerSegment: mockMetricsData.customerSegment,
        totalFailures: mockMetricsData.totalFailures,
        totalCampaignsStarted: mockMetricsData.totalCampaignsStarted,
        totalCampaignsCompleted: mockMetricsData.totalCampaignsCompleted,
        totalCommunicationsSent: mockMetricsData.totalCommunicationsSent,
        emailOpenRate: mockMetricsData.emailOpenRate,
        emailClickRate: mockMetricsData.emailClickRate,
        smsResponseRate: mockMetricsData.smsResponseRate,
        recoveryRate: mockMetricsData.recoveryRate,
        revenueRecovered: mockMetricsData.revenueRecovered,
        recoveryTimeAvg: mockMetricsData.recoveryTimeAvg,
        costPerRecovery: mockMetricsData.costPerRecovery,
        roiPercentage: mockMetricsData.roiPercentage,
        metadata: mockMetricsData.metadata,
      });

      expect(mockSupabase.upsert).toHaveBeenCalledWith({
        date: mockMetricsData.date,
        campaign_type: mockMetricsData.campaignType,
        ab_test_group: mockMetricsData.abTestGroup,
        failure_reason: mockMetricsData.failureReason,
        customer_segment: mockMetricsData.customerSegment,
        total_failures: mockMetricsData.totalFailures,
        total_campaigns_started: mockMetricsData.totalCampaignsStarted,
        total_campaigns_completed: mockMetricsData.totalCampaignsCompleted,
        total_communications_sent: mockMetricsData.totalCommunicationsSent,
        email_open_rate: mockMetricsData.emailOpenRate,
        email_click_rate: mockMetricsData.emailClickRate,
        sms_response_rate: mockMetricsData.smsResponseRate,
        recovery_rate: mockMetricsData.recoveryRate,
        revenue_recovered: mockMetricsData.revenueRecovered,
        recovery_time_avg: mockMetricsData.recoveryTimeAvg,
        cost_per_recovery: mockMetricsData.costPerRecovery,
        roi_percentage: mockMetricsData.roiPercentage,
        metadata: mockMetricsData.metadata,
      });
    });

    it('should validate input data', async () => {
      const invalidData = {
        date: 'invalid-date-format',
        campaignType: 'standard',
        customerSegment: 'existing',
        totalFailures: -5, // Invalid negative value
        emailOpenRate: 1.5, // Invalid rate > 1.0
      };

      await expect(analytics.recordMetrics(invalidData)).rejects.toThrow('Failed to record metrics');
    });

    it('should handle defaults for optional fields', async () => {
      const minimalData = {
        date: '2024-01-15',
        campaignType: 'standard',
        customerSegment: 'existing',
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          ...minimalData,
          campaign_type: minimalData.campaignType,
          customer_segment: minimalData.customerSegment,
          total_failures: 0,
          total_campaigns_started: 0,
          email_open_rate: 0,
          recovery_rate: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

      const result = await analytics.recordMetrics(minimalData);

      expect(result.totalFailures).toBe(0);
      expect(result.totalCampaignsStarted).toBe(0);
      expect(result.emailOpenRate).toBe(0);
      expect(result.recoveryRate).toBe(0);
    });
  });

  describe('generateDailyMetrics', () => {
    const mockDate = '2024-01-15';

    beforeEach(() => {
      // Mock getActiveSegments
      const getActiveSegmentsSpy = jest.spyOn(analytics as any, 'getActiveSegments');
      getActiveSegmentsSpy.mockResolvedValue([
        { campaignType: 'standard', customerSegment: 'existing', abTestGroup: 'control' },
        { campaignType: 'standard', customerSegment: 'existing', abTestGroup: 'variant_a' },
        { campaignType: 'high_value', customerSegment: 'high_value', abTestGroup: 'control' },
      ]);

      // Mock calculateDailyMetrics
      const calculateDailyMetricsSpy = jest.spyOn(analytics as any, 'calculateDailyMetrics');
      calculateDailyMetricsSpy
        .mockResolvedValueOnce({
          totalFailures: 5,
          totalCampaignsStarted: 4,
          recoveryRate: 0.3,
          revenueRecovered: 6000,
        })
        .mockResolvedValueOnce({
          totalFailures: 3,
          totalCampaignsStarted: 2,
          recoveryRate: 0.4,
          revenueRecovered: 4000,
        })
        .mockResolvedValueOnce({
          totalFailures: 2,
          totalCampaignsStarted: 2,
          recoveryRate: 0.5,
          revenueRecovered: 8000,
        });

      // Mock recordMetrics
      const recordMetricsSpy = jest.spyOn(analytics, 'recordMetrics');
      recordMetricsSpy
        .mockResolvedValueOnce({
          date: mockDate,
          campaignType: 'standard',
          customerSegment: 'existing',
          abTestGroup: 'control',
          totalFailures: 5,
          totalCampaignsStarted: 4,
          recoveryRate: 0.3,
          revenueRecovered: 6000,
        } as any)
        .mockResolvedValueOnce({
          date: mockDate,
          campaignType: 'standard',
          customerSegment: 'existing',
          abTestGroup: 'variant_a',
          totalFailures: 3,
          totalCampaignsStarted: 2,
          recoveryRate: 0.4,
          revenueRecovered: 4000,
        } as any)
        .mockResolvedValueOnce({
          date: mockDate,
          campaignType: 'high_value',
          customerSegment: 'high_value',
          abTestGroup: 'control',
          totalFailures: 2,
          totalCampaignsStarted: 2,
          recoveryRate: 0.5,
          revenueRecovered: 8000,
        } as any);
    });

    it('should generate metrics for all active segments', async () => {
      const result = await analytics.generateDailyMetrics(mockDate);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        date: mockDate,
        campaignType: 'standard',
        customerSegment: 'existing',
        abTestGroup: 'control',
        totalFailures: 5,
        totalCampaignsStarted: 4,
        recoveryRate: 0.3,
        revenueRecovered: 6000,
      });

      expect(result[1]).toEqual({
        date: mockDate,
        campaignType: 'standard',
        customerSegment: 'existing',
        abTestGroup: 'variant_a',
        totalFailures: 3,
        totalCampaignsStarted: 2,
        recoveryRate: 0.4,
        revenueRecovered: 4000,
      });

      expect(result[2]).toEqual({
        date: mockDate,
        campaignType: 'high_value',
        customerSegment: 'high_value',
        abTestGroup: 'control',
        totalFailures: 2,
        totalCampaignsStarted: 2,
        recoveryRate: 0.5,
        revenueRecovered: 8000,
      });
    });

    it('should use current date when no date provided', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const result = await analytics.generateDailyMetrics();

      expect(result).toHaveLength(3);
      result.forEach(metric => {
        expect(metric.date).toBe(today);
      });
    });

    it('should skip segments with no activity', async () => {
      // Reset mocks for this test
      const getActiveSegmentsSpy = jest.spyOn(analytics as any, 'getActiveSegments');
      getActiveSegmentsSpy.mockResolvedValue([
        { campaignType: 'standard', customerSegment: 'existing', abTestGroup: 'control' },
        { campaignType: 'at_risk', customerSegment: 'at_risk', abTestGroup: 'control' },
      ]);

      const calculateDailyMetricsSpy = jest.spyOn(analytics as any, 'calculateDailyMetrics');
      calculateDailyMetricsSpy
        .mockResolvedValueOnce({
          totalFailures: 5,
          totalCampaignsStarted: 4,
        })
        .mockResolvedValueOnce({
          totalFailures: 0,
          totalCampaignsStarted: 0,
        });

      const recordMetricsSpy = jest.spyOn(analytics, 'recordMetrics');
      recordMetricsSpy.mockResolvedValueOnce({
        date: mockDate,
        campaignType: 'standard',
        customerSegment: 'existing',
        totalFailures: 5,
        totalCampaignsStarted: 4,
      } as any);

      const result = await analytics.generateDailyMetrics(mockDate);

      expect(result).toHaveLength(1);
      expect(recordMetricsSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAnalytics', () => {
    const mockAnalyticsQuery = {
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      campaignType: 'standard',
      customerSegment: 'existing',
    };

    const mockAnalyticsData = [
      {
        date: '2024-01-15',
        campaign_type: 'standard',
        customer_segment: 'existing',
        total_failures: 10,
        recovery_rate: 0.25,
        revenue_recovered: 12500,
        email_open_rate: 0.35,
      },
      {
        date: '2024-01-16',
        campaign_type: 'standard',
        customer_segment: 'existing',
        total_failures: 8,
        recovery_rate: 0.30,
        revenue_recovered: 9600,
        email_open_rate: 0.40,
      },
    ];

    it('should retrieve analytics data with filters', async () => {
      mockSupabase.single.mockImplementation(() => ({
        data: mockAnalyticsData,
      }));

      const result = await analytics.getAnalytics(mockAnalyticsQuery);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: '2024-01-15',
        campaignType: 'standard',
        customerSegment: 'existing',
        totalFailures: 10,
        recoveryRate: 0.25,
        revenueRecovered: 12500,
        emailOpenRate: 0.35,
        abTestGroup: undefined,
        failureReason: undefined,
        totalCampaignsStarted: undefined,
        totalCampaignsCompleted: undefined,
        totalCommunicationsSent: undefined,
        emailClickRate: undefined,
        smsResponseRate: undefined,
        recoveryTimeAvg: undefined,
        costPerRecovery: undefined,
        roiPercentage: undefined,
        metadata: undefined,
      });

      expect(mockSupabase.gte).toHaveBeenCalledWith('date', mockAnalyticsQuery.startDate);
      expect(mockSupabase.lte).toHaveBeenCalledWith('date', mockAnalyticsQuery.endDate);
      expect(mockSupabase.eq).toHaveBeenCalledWith('campaign_type', mockAnalyticsQuery.campaignType);
      expect(mockSupabase.eq).toHaveBeenCalledWith('customer_segment', mockAnalyticsQuery.customerSegment);
    });

    it('should retrieve all data when no filters applied', async () => {
      const queryWithoutFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      mockSupabase.single.mockImplementation(() => ({
        data: mockAnalyticsData,
      }));

      const result = await analytics.getAnalytics(queryWithoutFilters);

      expect(result).toHaveLength(2);
      expect(mockSupabase.gte).toHaveBeenCalledWith('date', queryWithoutFilters.startDate);
      expect(mockSupabase.lte).toHaveBeenCalledWith('date', queryWithoutFilters.endDate);
      // Should not call eq for optional filters
      expect(mockSupabase.eq).not.toHaveBeenCalledWith('campaign_type', expect.anything());
      expect(mockSupabase.eq).not.toHaveBeenCalledWith('customer_segment', expect.anything());
    });

    it('should handle empty results', async () => {
      mockSupabase.single.mockImplementation(() => ({
        data: null,
      }));

      const result = await analytics.getAnalytics(mockAnalyticsQuery);

      expect(result).toEqual([]);
    });

    it('should validate date format', async () => {
      const invalidQuery = {
        startDate: 'invalid-date',
        endDate: '2024-01-31',
      };

      await expect(analytics.getAnalytics(invalidQuery)).rejects.toThrow('Failed to get analytics');
    });
  });

  describe('analyzeABTest', () => {
    const mockABTestQuery = {
      campaignType: 'standard',
      sequenceStep: 1,
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    };

    const mockABTestData = [
      {
        ab_test_group: 'control',
        total_campaigns_started: 100,
        recovery_rate: 0.25,
        revenue_recovered: 25000,
        recovery_time_avg: 48,
      },
      {
        ab_test_group: 'variant_a',
        total_campaigns_started: 95,
        recovery_rate: 0.32,
        revenue_recovered: 30400,
        recovery_time_avg: 36,
      },
      {
        ab_test_group: 'variant_b',
        total_campaigns_started: 98,
        recovery_rate: 0.28,
        revenue_recovered: 27440,
        recovery_time_avg: 42,
      },
    ];

    beforeEach(() => {
      mockSupabase.single.mockImplementation(() => ({
        data: mockABTestData,
      }));

      // Mock groupByABTestGroup
      const groupByABTestGroupSpy = jest.spyOn(analytics as any, 'groupByABTestGroup');
      groupByABTestGroupSpy.mockReturnValue({
        control: [mockABTestData[0]],
        variant_a: [mockABTestData[1]],
        variant_b: [mockABTestData[2]],
      });

      // Mock calculateVariantMetrics
      const calculateVariantMetricsSpy = jest.spyOn(analytics as any, 'calculateVariantMetrics');
      calculateVariantMetricsSpy
        .mockReturnValueOnce({
          name: 'control',
          description: 'control variant',
          participants: 100,
          conversions: 25,
          conversionRate: 0.25,
          revenueRecovered: 25000,
          avgRecoveryTime: 48,
        })
        .mockReturnValueOnce({
          name: 'variant_a',
          description: 'variant_a variant',
          participants: 95,
          conversions: 30.4,
          conversionRate: 0.32,
          revenueRecovered: 30400,
          avgRecoveryTime: 36,
        })
        .mockReturnValueOnce({
          name: 'variant_b',
          description: 'variant_b variant',
          participants: 98,
          conversions: 27.44,
          conversionRate: 0.28,
          revenueRecovered: 27440,
          avgRecoveryTime: 42,
        });

      // Mock calculateStatisticalSignificance
      const calculateStatisticalSignificanceSpy = jest.spyOn(analytics as any, 'calculateStatisticalSignificance');
      calculateStatisticalSignificanceSpy.mockReturnValue({
        winner: 'variant_a',
        confidence: 0.85,
      });
    });

    it('should analyze A/B test results and determine winner', async () => {
      const result = await analytics.analyzeABTest(
        mockABTestQuery.campaignType,
        mockABTestQuery.sequenceStep,
        mockABTestQuery.startDate,
        mockABTestQuery.endDate
      );

      expect(result).toEqual({
        testId: `${mockABTestQuery.campaignType}_step${mockABTestQuery.sequenceStep}_${mockABTestQuery.startDate}`,
        testName: `${mockABTestQuery.campaignType} Step ${mockABTestQuery.sequenceStep} Test`,
        campaignType: mockABTestQuery.campaignType,
        sequenceStep: mockABTestQuery.sequenceStep,
        startDate: new Date(mockABTestQuery.startDate),
        endDate: new Date(mockABTestQuery.endDate),
        status: 'completed',
        controlGroup: {
          name: 'control',
          description: 'control variant',
          participants: 100,
          conversions: 25,
          conversionRate: 0.25,
          revenueRecovered: 25000,
          avgRecoveryTime: 48,
        },
        variants: [
          {
            name: 'variant_a',
            description: 'variant_a variant',
            participants: 95,
            conversions: 30.4,
            conversionRate: 0.32,
            revenueRecovered: 30400,
            avgRecoveryTime: 36,
          },
          {
            name: 'variant_b',
            description: 'variant_b variant',
            participants: 98,
            conversions: 27.44,
            conversionRate: 0.28,
            revenueRecovered: 27440,
            avgRecoveryTime: 42,
          },
        ],
        winner: 'variant_a',
        confidence: 0.85,
        significanceLevel: 0.95,
      });
    });

    it('should handle running test without end date', async () => {
      const result = await analytics.analyzeABTest(
        mockABTestQuery.campaignType,
        mockABTestQuery.sequenceStep,
        mockABTestQuery.startDate
      );

      expect(result.status).toBe('running');
      expect(result.endDate).toBeUndefined();
    });

    it('should throw error when no A/B test data found', async () => {
      mockSupabase.single.mockImplementation(() => ({
        data: null,
      }));

      await expect(
        analytics.analyzeABTest(
          mockABTestQuery.campaignType,
          mockABTestQuery.sequenceStep,
          mockABTestQuery.startDate,
          mockABTestQuery.endDate
        )
      ).rejects.toThrow('No A/B test data found');
    });

    it('should throw error when no control group found', async () => {
      // Mock data without control group
      const dataWithoutControl = mockABTestData.filter(item => item.ab_test_group !== 'control');
      mockSupabase.single.mockImplementation(() => ({
        data: dataWithoutControl,
      }));

      const groupByABTestGroupSpy = jest.spyOn(analytics as any, 'groupByABTestGroup');
      groupByABTestGroupSpy.mockReturnValue({
        variant_a: [dataWithoutControl[0]],
        variant_b: [dataWithoutControl[1]],
      });

      await expect(
        analytics.analyzeABTest(
          mockABTestQuery.campaignType,
          mockABTestQuery.sequenceStep,
          mockABTestQuery.startDate,
          mockABTestQuery.endDate
        )
      ).rejects.toThrow('No control group found in A/B test data');
    });
  });

  describe('generateOptimizationRecommendations', () => {
    const mockRecommendationQuery = {
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    };

    beforeEach(() => {
      // Mock getAnalytics
      const getAnalyticsSpy = jest.spyOn(analytics, 'getAnalytics');
      getAnalyticsSpy.mockResolvedValue([
        {
          date: '2024-01-15',
          campaignType: 'standard',
          customerSegment: 'existing',
          totalFailures: 10,
          recoveryRate: 0.25,
          revenueRecovered: 12500,
          emailOpenRate: 0.35,
        },
      ] as any);

      // Mock analyzeCustomerSegments
      const analyzeCustomerSegmentsSpy = jest.spyOn(analytics, 'analyzeCustomerSegments');
      analyzeCustomerSegmentsSpy.mockResolvedValue([
        {
          segment: 'existing',
          totalCustomers: 1000,
          totalFailures: 50,
          recoveryRate: 0.3,
          avgRecoveryTime: 48,
          revenueRecovered: 75000,
          costPerRecovery: 500,
          roi: 200,
          preferredChannels: ['email', 'sms'],
          optimalTimings: [1, 3, 7],
        },
        {
          segment: 'high_value',
          totalCustomers: 200,
          totalFailures: 10,
          recoveryRate: 0.5,
          avgRecoveryTime: 24,
          revenueRecovered: 50000,
          costPerRecovery: 750,
          roi: 300,
          preferredChannels: ['email', 'sms'],
          optimalTimings: [1, 2, 5],
        },
      ]);

      // Mock recommendation generators
      const generateTimingRecommendationsSpy = jest.spyOn(analytics as any, 'generateTimingRecommendations');
      generateTimingRecommendationsSpy.mockReturnValue([
        {
          type: 'timing',
          priority: 'high',
          title: 'Optimize First Contact Timing',
          description: 'Send initial recovery email within 2 hours of payment failure',
          expectedImpact: '15-20% improvement in recovery rate',
          implementation: 'Update campaign scheduler to trigger immediate emails',
          confidence: 0.85,
        },
      ]);

      const generateChannelRecommendationsSpy = jest.spyOn(analytics as any, 'generateChannelRecommendations');
      generateChannelRecommendationsSpy.mockReturnValue([
        {
          type: 'channel',
          priority: 'medium',
          title: 'Add SMS for High-Value Customers',
          description: 'Include SMS in recovery campaigns for customers with >$100 subscriptions',
          expectedImpact: '10-15% improvement in response rate',
          implementation: 'Enable SMS channel for high_value campaign type',
          confidence: 0.75,
        },
      ]);

      const generateSegmentRecommendationsSpy = jest.spyOn(analytics as any, 'generateSegmentRecommendations');
      generateSegmentRecommendationsSpy.mockReturnValue([
        {
          type: 'segment',
          priority: 'high',
          title: 'Optimize high_value Customer Recovery',
          description: 'Focus on high_value segment with 50.0% recovery rate',
          expectedImpact: 'Potential $10,000 additional revenue',
          implementation: 'Customize campaign timing and messaging for high_value customers',
          confidence: 0.8,
        },
      ]);

      const generateContentRecommendationsSpy = jest.spyOn(analytics as any, 'generateContentRecommendations');
      generateContentRecommendationsSpy.mockReturnValue([
        {
          type: 'content',
          priority: 'medium',
          title: 'A/B Test Email Subject Lines',
          description: 'Test urgency-based vs. helpful tone in email subjects',
          expectedImpact: '5-10% improvement in open rates',
          implementation: 'Set up A/B test variants for email templates',
          confidence: 0.7,
        },
      ]);
    });

    it('should generate comprehensive optimization recommendations', async () => {
      const result = await analytics.generateOptimizationRecommendations(
        mockRecommendationQuery.startDate,
        mockRecommendationQuery.endDate
      );

      expect(result).toEqual({
        recommendations: [
          {
            type: 'timing',
            priority: 'high',
            title: 'Optimize First Contact Timing',
            description: 'Send initial recovery email within 2 hours of payment failure',
            expectedImpact: '15-20% improvement in recovery rate',
            implementation: 'Update campaign scheduler to trigger immediate emails',
            confidence: 0.85,
          },
          {
            type: 'segment',
            priority: 'high',
            title: 'Optimize high_value Customer Recovery',
            description: 'Focus on high_value segment with 50.0% recovery rate',
            expectedImpact: 'Potential $10,000 additional revenue',
            implementation: 'Customize campaign timing and messaging for high_value customers',
            confidence: 0.8,
          },
          {
            type: 'channel',
            priority: 'medium',
            title: 'Add SMS for High-Value Customers',
            description: 'Include SMS in recovery campaigns for customers with >$100 subscriptions',
            expectedImpact: '10-15% improvement in response rate',
            implementation: 'Enable SMS channel for high_value campaign type',
            confidence: 0.75,
          },
          {
            type: 'content',
            priority: 'medium',
            title: 'A/B Test Email Subject Lines',
            description: 'Test urgency-based vs. helpful tone in email subjects',
            expectedImpact: '5-10% improvement in open rates',
            implementation: 'Set up A/B test variants for email templates',
            confidence: 0.7,
          },
        ],
        summary: {
          totalFailures: 10,
          totalRecovered: 2.5, // 10 * 0.25
          overallRecoveryRate: 0.25,
          totalRevenueRecovered: 12500,
          averageROI: expect.any(Number),
        },
      });
    });

    it('should limit recommendations to top 10', async () => {
      // Mock more than 10 recommendations
      const manyRecommendations = Array(15).fill(null).map((_, i) => ({
        type: 'timing',
        priority: i < 5 ? 'high' : i < 10 ? 'medium' : 'low',
        title: `Recommendation ${i + 1}`,
        description: `Description ${i + 1}`,
        expectedImpact: `Impact ${i + 1}`,
        implementation: `Implementation ${i + 1}`,
        confidence: 0.5 + (i * 0.02),
      }));

      const generateTimingRecommendationsSpy = jest.spyOn(analytics as any, 'generateTimingRecommendations');
      generateTimingRecommendationsSpy.mockReturnValue(manyRecommendations);

      const generateChannelRecommendationsSpy = jest.spyOn(analytics as any, 'generateChannelRecommendations');
      generateChannelRecommendationsSpy.mockReturnValue([]);

      const generateSegmentRecommendationsSpy = jest.spyOn(analytics as any, 'generateSegmentRecommendations');
      generateSegmentRecommendationsSpy.mockReturnValue([]);

      const generateContentRecommendationsSpy = jest.spyOn(analytics as any, 'generateContentRecommendations');
      generateContentRecommendationsSpy.mockReturnValue([]);

      const result = await analytics.generateOptimizationRecommendations(
        mockRecommendationQuery.startDate,
        mockRecommendationQuery.endDate
      );

      expect(result.recommendations).toHaveLength(10);
      // Should be sorted by priority (high first) and then by confidence
      expect(result.recommendations[0].priority).toBe('high');
    });
  });
});