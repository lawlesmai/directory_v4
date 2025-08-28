/**
 * EPIC 5 STORY 5.7: Payment Failure Recovery & Dunning Management
 * Recovery Job Scheduler Tests - Comprehensive test suite
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@/lib/supabase/server';
import { RecoveryJobScheduler } from '@/lib/payments/recovery-job-scheduler';
import paymentFailureHandler from '@/lib/payments/payment-failure-handler';
import dunningManager from '@/lib/payments/dunning-manager';
import accountStateManager from '@/lib/payments/account-state-manager';
import recoveryAnalytics from '@/lib/analytics/recovery-analytics';

// Mock dependencies
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/payments/payment-failure-handler');
jest.mock('@/lib/payments/dunning-manager');
jest.mock('@/lib/payments/account-state-manager');
jest.mock('@/lib/analytics/recovery-analytics');

const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  upsert: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  gte: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(),
  head: jest.fn(),
};

(createClient as jest.Mock).mockReturnValue(mockSupabase);

describe('RecoveryJobScheduler', () => {
  let scheduler: RecoveryJobScheduler;
  let mockSetInterval: jest.Mock;
  let mockClearInterval: jest.Mock;

  beforeEach(() => {
    // Mock timer functions
    mockSetInterval = jest.fn().mockImplementation((fn, interval) => {
      return `interval-${interval}`;
    });
    mockClearInterval = jest.fn();

    global.setInterval = mockSetInterval;
    global.clearInterval = mockClearInterval;
    global.setTimeout = jest.fn().mockImplementation((fn) => {
      fn(); // Execute immediately for testing
      return 'timeout-id';
    });

    scheduler = new RecoveryJobScheduler({
      retryJobInterval: 1, // 1 minute for testing
      dunningJobInterval: 2,
      gracePeriodJobInterval: 3,
      analyticsJobInterval: 5,
      maxConcurrentJobs: 2,
      jobTimeoutMs: 1000,
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    scheduler.stop();
    jest.restoreAllMocks();
  });

  describe('scheduler lifecycle', () => {
    it('should start all scheduled jobs', () => {
      scheduler.start();

      expect(mockSetInterval).toHaveBeenCalledTimes(4);
      expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 60000); // 1 min in ms
      expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 120000); // 2 min in ms
      expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 180000); // 3 min in ms
      expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 300000); // 5 min in ms
    });

    it('should stop all scheduled jobs', () => {
      scheduler.start();
      scheduler.stop();

      expect(mockClearInterval).toHaveBeenCalledTimes(4);
      expect(mockClearInterval).toHaveBeenCalledWith('interval-60000');
      expect(mockClearInterval).toHaveBeenCalledWith('interval-120000');
      expect(mockClearInterval).toHaveBeenCalledWith('interval-180000');
      expect(mockClearInterval).toHaveBeenCalledWith('interval-300000');
    });

    it('should return correct status when running', () => {
      scheduler.start();
      const status = scheduler.getStatus();

      expect(status).toEqual({
        isRunning: true,
        activeJobs: [],
        scheduledJobs: ['payment_retry', 'dunning_campaigns', 'grace_period_monitoring', 'analytics_generation'],
        config: {
          retryJobInterval: 1,
          dunningJobInterval: 2,
          gracePeriodJobInterval: 3,
          analyticsJobInterval: 5,
          maxConcurrentJobs: 2,
          jobTimeoutMs: 1000,
        },
      });
    });

    it('should return correct status when stopped', () => {
      const status = scheduler.getStatus();

      expect(status).toEqual({
        isRunning: false,
        activeJobs: [],
        scheduledJobs: [],
        config: expect.any(Object),
      });
    });
  });

  describe('job execution framework', () => {
    beforeEach(() => {
      // Mock logJobResult to avoid database calls
      const logJobResultSpy = jest.spyOn(scheduler as any, 'logJobResult');
      logJobResultSpy.mockResolvedValue(undefined);
    });

    it('should execute job successfully', async () => {
      const mockJobFunction = jest.fn().mockResolvedValue({
        processed: 5,
        successful: 3,
        failed: 2,
      });

      const result = await (scheduler as any).executeJob('test_job', mockJobFunction);

      expect(result).toEqual({
        jobType: 'test_job',
        startTime: expect.any(Date),
        endTime: expect.any(Date),
        duration: expect.any(Number),
        success: true,
        processed: 5,
        successful: 3,
        failed: 2,
        errors: [],
        metadata: undefined,
      });

      expect(mockJobFunction).toHaveBeenCalledTimes(1);
    });

    it('should handle job execution errors', async () => {
      const mockJobFunction = jest.fn().mockRejectedValue(new Error('Job execution failed'));

      const result = await (scheduler as any).executeJob('test_job', mockJobFunction);

      expect(result).toEqual({
        jobType: 'test_job',
        startTime: expect.any(Date),
        endTime: expect.any(Date),
        duration: expect.any(Number),
        success: false,
        processed: 0,
        successful: 0,
        failed: 0,
        errors: ['Job execution failed'],
      });
    });

    it('should prevent concurrent execution of same job type', async () => {
      const longRunningJob = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ processed: 1 }), 500))
      );

      // Start first job execution (will be running)
      const firstPromise = (scheduler as any).executeJob('test_job', longRunningJob);

      // Try to start second execution of same job type
      const secondResult = await (scheduler as any).executeJob('test_job', jest.fn());

      expect(secondResult).toEqual({
        jobType: 'test_job',
        startTime: expect.any(Date),
        endTime: expect.any(Date),
        duration: 0,
        success: false,
        processed: 0,
        successful: 0,
        failed: 0,
        errors: ['Job already running'],
      });

      // Wait for first job to complete
      await firstPromise;
    });

    it('should enforce max concurrent jobs limit', async () => {
      const longRunningJob = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ processed: 1 }), 500))
      );

      // Start two jobs (hitting the limit of 2)
      const firstPromise = (scheduler as any).executeJob('job_1', longRunningJob);
      const secondPromise = (scheduler as any).executeJob('job_2', longRunningJob);

      // Try to start third job (should be rejected)
      const thirdResult = await (scheduler as any).executeJob('job_3', jest.fn());

      expect(thirdResult).toEqual({
        jobType: 'job_3',
        startTime: expect.any(Date),
        endTime: expect.any(Date),
        duration: 0,
        success: false,
        processed: 0,
        successful: 0,
        failed: 0,
        errors: ['Max concurrent jobs reached'],
      });

      // Wait for running jobs to complete
      await Promise.all([firstPromise, secondPromise]);
    });

    it('should handle job timeout', async () => {
      const timeoutJob = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ processed: 1 }), 2000)) // 2 seconds, longer than 1 second timeout
      );

      const result = await (scheduler as any).executeJob('timeout_job', timeoutJob);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Job timeout');
    });
  });

  describe('payment retry job', () => {
    beforeEach(() => {
      const logJobResultSpy = jest.spyOn(scheduler as any, 'logJobResult');
      logJobResultSpy.mockResolvedValue(undefined);

      const updateSystemHealthMetricsSpy = jest.spyOn(scheduler as any, 'updateSystemHealthMetrics');
      updateSystemHealthMetricsSpy.mockResolvedValue(undefined);
    });

    it('should process payment retries successfully', async () => {
      const mockRetryResult = {
        processed: 10,
        successful: 7,
        failed: 2,
        abandoned: 1,
      };

      (paymentFailureHandler.processPendingRetries as jest.Mock).mockResolvedValue(mockRetryResult);

      const result = await (scheduler as any).processPaymentRetries();

      expect(result).toEqual(mockRetryResult);
      expect(paymentFailureHandler.processPendingRetries).toHaveBeenCalledTimes(1);
      
      // Should update health metrics for successful retries
      const updateHealthSpy = jest.spyOn(scheduler as any, 'updateSystemHealthMetrics');
      expect(updateHealthSpy).toHaveBeenCalledWith('payment_retry_success', 7);
    });

    it('should handle payment retry errors', async () => {
      (paymentFailureHandler.processPendingRetries as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect((scheduler as any).processPaymentRetries()).rejects.toThrow('Database connection failed');
    });
  });

  describe('dunning campaigns job', () => {
    beforeEach(() => {
      const logJobResultSpy = jest.spyOn(scheduler as any, 'logJobResult');
      logJobResultSpy.mockResolvedValue(undefined);

      const updateSystemHealthMetricsSpy = jest.spyOn(scheduler as any, 'updateSystemHealthMetrics');
      updateSystemHealthMetricsSpy.mockResolvedValue(undefined);
    });

    it('should process dunning campaigns successfully', async () => {
      const mockCampaignResult = {
        processed: 15,
        sent: 12,
        failed: 3,
      };

      (dunningManager.processPendingCommunications as jest.Mock).mockResolvedValue(mockCampaignResult);

      const result = await (scheduler as any).processDunningCampaigns();

      expect(result).toEqual(mockCampaignResult);
      expect(dunningManager.processPendingCommunications).toHaveBeenCalledTimes(1);
      
      // Should update health metrics for sent communications
      const updateHealthSpy = jest.spyOn(scheduler as any, 'updateSystemHealthMetrics');
      expect(updateHealthSpy).toHaveBeenCalledWith('dunning_communications_sent', 12);
    });

    it('should handle dunning campaign errors', async () => {
      (dunningManager.processPendingCommunications as jest.Mock).mockRejectedValue(
        new Error('Email service unavailable')
      );

      await expect((scheduler as any).processDunningCampaigns()).rejects.toThrow('Email service unavailable');
    });
  });

  describe('grace period monitoring job', () => {
    beforeEach(() => {
      const logJobResultSpy = jest.spyOn(scheduler as any, 'logJobResult');
      logJobResultSpy.mockResolvedValue(undefined);

      const updateSystemHealthMetricsSpy = jest.spyOn(scheduler as any, 'updateSystemHealthMetrics');
      updateSystemHealthMetricsSpy.mockResolvedValue(undefined);
    });

    it('should process expired grace periods successfully', async () => {
      const mockGracePeriodResult = {
        processed: 5,
        suspended: 4,
        errors: 1,
      };

      (accountStateManager.processExpiredGracePeriods as jest.Mock).mockResolvedValue(mockGracePeriodResult);

      const result = await (scheduler as any).processExpiredGracePeriods();

      expect(result).toEqual(mockGracePeriodResult);
      expect(accountStateManager.processExpiredGracePeriods).toHaveBeenCalledTimes(1);
      
      // Should update health metrics for suspended accounts
      const updateHealthSpy = jest.spyOn(scheduler as any, 'updateSystemHealthMetrics');
      expect(updateHealthSpy).toHaveBeenCalledWith('accounts_suspended', 4);
    });

    it('should handle grace period processing errors', async () => {
      (accountStateManager.processExpiredGracePeriods as jest.Mock).mockRejectedValue(
        new Error('Account state update failed')
      );

      await expect((scheduler as any).processExpiredGracePeriods()).rejects.toThrow('Account state update failed');
    });
  });

  describe('analytics generation job', () => {
    beforeEach(() => {
      const logJobResultSpy = jest.spyOn(scheduler as any, 'logJobResult');
      logJobResultSpy.mockResolvedValue(undefined);

      const updateSystemHealthMetricsSpy = jest.spyOn(scheduler as any, 'updateSystemHealthMetrics');
      updateSystemHealthMetricsSpy.mockResolvedValue(undefined);
    });

    it('should generate analytics for yesterday and today', async () => {
      const mockYesterdayMetrics = [
        { date: '2024-01-14', campaignType: 'standard', totalFailures: 5 },
        { date: '2024-01-14', campaignType: 'high_value', totalFailures: 2 },
      ];

      const mockTodayMetrics = [
        { date: '2024-01-15', campaignType: 'standard', totalFailures: 3 },
      ];

      (recoveryAnalytics.generateDailyMetrics as jest.Mock)
        .mockResolvedValueOnce(mockYesterdayMetrics)  // Yesterday
        .mockResolvedValueOnce(mockTodayMetrics);     // Today

      const result = await (scheduler as any).generateAnalytics();

      expect(result).toEqual({
        processed: 2, // Two days processed
        successful: 3, // Total metrics generated
        failed: 0,
      });

      expect(recoveryAnalytics.generateDailyMetrics).toHaveBeenCalledTimes(2);
      
      // Should update health metrics for generated analytics
      const updateHealthSpy = jest.spyOn(scheduler as any, 'updateSystemHealthMetrics');
      expect(updateHealthSpy).toHaveBeenCalledWith('analytics_metrics_generated', 3);
    });

    it('should handle analytics generation errors', async () => {
      (recoveryAnalytics.generateDailyMetrics as jest.Mock).mockRejectedValue(
        new Error('Analytics calculation failed')
      );

      await expect((scheduler as any).generateAnalytics()).rejects.toThrow('Analytics calculation failed');
    });
  });

  describe('manual job triggers', () => {
    beforeEach(() => {
      const executeJobSpy = jest.spyOn(scheduler as any, 'executeJob');
      executeJobSpy.mockResolvedValue({
        jobType: 'manual_test',
        success: true,
        processed: 1,
      });
    });

    it('should trigger payment retry job manually', async () => {
      const result = await scheduler.triggerJob('payment_retry');

      expect(result.jobType).toBe('payment_retry');
      expect(result.success).toBe(true);
    });

    it('should trigger dunning campaigns job manually', async () => {
      const result = await scheduler.triggerJob('dunning_campaigns');

      expect(result.jobType).toBe('dunning_campaigns');
      expect(result.success).toBe(true);
    });

    it('should trigger grace period monitoring job manually', async () => {
      const result = await scheduler.triggerJob('grace_period_monitoring');

      expect(result.jobType).toBe('grace_period_monitoring');
      expect(result.success).toBe(true);
    });

    it('should trigger analytics generation job manually', async () => {
      const result = await scheduler.triggerJob('analytics_generation');

      expect(result.jobType).toBe('analytics_generation');
      expect(result.success).toBe(true);
    });

    it('should throw error for unknown job type', async () => {
      await expect(scheduler.triggerJob('unknown_job')).rejects.toThrow('Unknown job type: unknown_job');
    });
  });

  describe('job history and logging', () => {
    it('should retrieve job history from database', async () => {
      const mockJobHistory = [
        {
          id: '1',
          job_type: 'payment_retry',
          start_time: '2024-01-15T10:00:00Z',
          end_time: '2024-01-15T10:01:30Z',
          duration: 90000,
          success: true,
          processed: 10,
          successful: 8,
          failed: 2,
          errors: [],
          metadata: null,
        },
        {
          id: '2',
          job_type: 'dunning_campaigns',
          start_time: '2024-01-15T10:30:00Z',
          end_time: '2024-01-15T10:31:15Z',
          duration: 75000,
          success: true,
          processed: 5,
          successful: 5,
          failed: 0,
          errors: [],
          metadata: null,
        },
      ];

      mockSupabase.single.mockImplementation(() => ({
        data: mockJobHistory,
      }));

      const result = await scheduler.getJobHistory();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: '1',
        jobType: 'payment_retry',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T10:01:30Z'),
        duration: 90000,
        success: true,
        processed: 10,
        successful: 8,
        failed: 2,
        errors: [],
        metadata: null,
      });

      expect(mockSupabase.order).toHaveBeenCalledWith('start_time', { ascending: false });
      expect(mockSupabase.limit).toHaveBeenCalledWith(50);
    });

    it('should filter job history by job type', async () => {
      mockSupabase.single.mockImplementation(() => ({
        data: [],
      }));

      await scheduler.getJobHistory('payment_retry', 25);

      expect(mockSupabase.eq).toHaveBeenCalledWith('job_type', 'payment_retry');
      expect(mockSupabase.limit).toHaveBeenCalledWith(25);
    });

    it('should handle job history retrieval errors', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Database connection failed'));

      const result = await scheduler.getJobHistory();

      expect(result).toEqual([]);
    });
  });

  describe('system health monitoring', () => {
    it('should return comprehensive system health status', async () => {
      const mockRecentJobs = [
        {
          job_type: 'payment_retry',
          end_time: '2024-01-15T10:00:00Z',
        },
        {
          job_type: 'dunning_campaigns',
          end_time: '2024-01-15T09:30:00Z',
        },
      ];

      const mockTodayStats = [
        { success: true },
        { success: true },
        { success: false },
        { success: true },
      ];

      mockSupabase.single
        .mockResolvedValueOnce({ data: mockRecentJobs }) // Recent jobs query
        .mockResolvedValueOnce({ data: mockTodayStats }); // Today stats query

      scheduler.start(); // Start scheduler to have running status

      const result = await scheduler.getSystemHealth();

      expect(result).toEqual({
        scheduler: {
          isRunning: true,
          activeJobs: [],
          lastJobExecution: {
            payment_retry: new Date('2024-01-15T10:00:00Z'),
            dunning_campaigns: new Date('2024-01-15T09:30:00Z'),
            grace_period_monitoring: null,
            analytics_generation: null,
          },
        },
        metrics: {
          lastRetryJobSuccess: new Date('2024-01-15T10:00:00Z'),
          lastDunningJobSuccess: new Date('2024-01-15T09:30:00Z'),
          lastGracePeriodJobSuccess: null,
          lastAnalyticsJobSuccess: null,
          totalJobsToday: 4,
          successfulJobsToday: 3,
          failedJobsToday: 1,
        },
      });
    });

    it('should handle system health query errors gracefully', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Database connection failed'));

      scheduler.start();
      const result = await scheduler.getSystemHealth();

      expect(result.scheduler.isRunning).toBe(true);
      expect(result.metrics.totalJobsToday).toBe(0);
      expect(result.metrics.successfulJobsToday).toBe(0);
      expect(result.metrics.failedJobsToday).toBe(0);
    });
  });
});