/**
 * Onboarding Workflow Service Test Suite
 * Epic 2 Story 2.5: User Onboarding and Email Verification Infrastructure
 * 
 * Comprehensive tests for onboarding workflow functionality
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { onboardingWorkflowService } from '@/lib/auth/onboarding-workflow';

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                single: jest.fn(),
              })),
            })),
          })),
        })),
        overlaps: jest.fn(() => ({
          order: jest.fn(),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(),
      })),
    })),
  },
}));

describe('OnboardingWorkflowService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getAvailableFlows', () => {
    it('should return available flows for user roles', async () => {
      const { supabase } = require('@/lib/supabase/server');

      // Mock user roles lookup
      supabase.from().select().eq().eq
        .mockResolvedValue({
          data: [
            { role_id: 'role-1', roles: { name: 'user' } },
          ],
          error: null,
        });

      // Mock available flows
      supabase.from().select().eq().overlaps().order
        .mockResolvedValue({
          data: [
            {
              id: 'flow-1',
              name: 'standard_user',
              display_name: 'Standard User Onboarding',
              target_roles: ['user'],
              is_active: true,
            },
          ],
          error: null,
        });

      const result = await onboardingWorkflowService.getAvailableFlows('user-123');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('standard_user');
    });

    it('should handle user without roles', async () => {
      const { supabase } = require('@/lib/supabase/server');

      // Mock no roles found
      supabase.from().select().eq().eq
        .mockResolvedValue({
          data: [],
          error: null,
        });

      // Mock flows for default 'user' role
      supabase.from().select().eq().overlaps().order
        .mockResolvedValue({
          data: [
            {
              id: 'flow-1',
              name: 'standard_user',
              target_roles: ['user'],
            },
          ],
          error: null,
        });

      const result = await onboardingWorkflowService.getAvailableFlows('user-123');

      expect(result).toHaveLength(1);
    });

    it('should handle database errors gracefully', async () => {
      const { supabase } = require('@/lib/supabase/server');

      // Mock database error
      supabase.from().select().eq().eq
        .mockResolvedValue({
          data: null,
          error: new Error('Database error'),
        });

      const result = await onboardingWorkflowService.getAvailableFlows('user-123');

      expect(result).toEqual([]);
    });
  });

  describe('initializeUserOnboarding', () => {
    it('should initialize onboarding successfully', async () => {
      const { supabase } = require('@/lib/supabase/server');

      // Mock available flows
      const mockFlows = [
        {
          id: 'flow-1',
          name: 'standard_user',
          is_required: true,
        },
      ];

      // Setup mocks for getAvailableFlows path
      supabase.from().select().eq().eq
        .mockResolvedValue({
          data: [{ role_id: 'role-1', roles: { name: 'user' } }],
          error: null,
        });

      supabase.from().select().eq().overlaps().order
        .mockResolvedValue({
          data: mockFlows,
          error: null,
        });

      // Mock no existing progress
      supabase.from().select().eq().eq().single
        .mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        });

      // Mock progress creation
      supabase.from().insert().select().single
        .mockResolvedValue({
          data: {
            id: 'progress-123',
            flow_id: 'flow-1',
            user_id: 'user-123',
          },
          error: null,
        });

      const result = await onboardingWorkflowService.initializeUserOnboarding('user-123');

      expect(result.success).toBe(true);
      expect(result.progressId).toBe('progress-123');
      expect(result.flowId).toBe('flow-1');
    });

    it('should return existing progress if already initialized', async () => {
      const { supabase } = require('@/lib/supabase/server');

      // Mock existing progress
      supabase.from().select().eq().eq().single
        .mockResolvedValue({
          data: {
            id: 'existing-progress-123',
            flow_id: 'flow-1',
            user_id: 'user-123',
          },
          error: null,
        });

      const result = await onboardingWorkflowService.initializeUserOnboarding(
        'user-123',
        'flow-1'
      );

      expect(result.success).toBe(true);
      expect(result.progressId).toBe('existing-progress-123');
      expect(result.flowId).toBe('flow-1');
    });

    it('should handle no available flows', async () => {
      const { supabase } = require('@/lib/supabase/server');

      // Mock user roles
      supabase.from().select().eq().eq
        .mockResolvedValue({
          data: [{ role_id: 'role-1', roles: { name: 'user' } }],
          error: null,
        });

      // Mock no available flows
      supabase.from().select().eq().overlaps().order
        .mockResolvedValue({
          data: [],
          error: null,
        });

      const result = await onboardingWorkflowService.initializeUserOnboarding('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No onboarding flows available for this user.');
    });
  });

  describe('getUserOnboardingProgress', () => {
    it('should return user progress with flow information', async () => {
      const { supabase } = require('@/lib/supabase/server');

      const mockProgressData = {
        flow_id: 'flow-1',
        status: 'in_progress',
        current_step_index: 2,
        completed_steps: [0, 1],
        skipped_steps: [],
        failed_steps: {},
        completion_percentage: 50,
        started_at: '2025-01-01T10:00:00Z',
        last_activity_at: '2025-01-01T11:00:00Z',
        engagement_score: 0.7,
        total_time_spent_minutes: 15,
        sessions_count: 2,
        step_data: { step1: { completed: true } },
        requirements_met: { email_verified: true },
        onboarding_flows: {
          display_name: 'Standard User Onboarding',
        },
      };

      supabase.from().select().eq().order().limit().single
        .mockResolvedValue({
          data: mockProgressData,
          error: null,
        });

      const result = await onboardingWorkflowService.getUserOnboardingProgress('user-123');

      expect(result).toBeDefined();
      expect(result?.flowId).toBe('flow-1');
      expect(result?.flowName).toBe('Standard User Onboarding');
      expect(result?.status).toBe('in_progress');
      expect(result?.completionPercentage).toBe(50);
    });

    it('should return null for user without progress', async () => {
      const { supabase } = require('@/lib/supabase/server');

      supabase.from().select().eq().order().limit().single
        .mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        });

      const result = await onboardingWorkflowService.getUserOnboardingProgress('user-123');

      expect(result).toBeNull();
    });
  });

  describe('getCurrentStep', () => {
    it('should return current step information', async () => {
      const { supabase } = require('@/lib/supabase/server');

      // Mock progress
      const mockProgress = {
        flowId: 'flow-1',
        currentStepIndex: 1,
        status: 'in_progress',
      };

      const getUserOnboardingProgressSpy = jest.spyOn(
        onboardingWorkflowService,
        'getUserOnboardingProgress'
      ).mockResolvedValue(mockProgress as any);

      // Mock flow with steps
      supabase.from().select().eq().single
        .mockResolvedValue({
          data: {
            allow_skip: true,
            steps: [
              { step: 'welcome', name: 'Welcome', type: 'info', required: true },
              { step: 'profile', name: 'Profile Setup', type: 'form', required: false },
              { step: 'complete', name: 'Complete', type: 'info', required: true },
            ],
          },
          error: null,
        });

      const result = await onboardingWorkflowService.getCurrentStep('user-123');

      expect(result.step).toBeDefined();
      expect(result.step?.name).toBe('Profile Setup');
      expect(result.stepIndex).toBe(1);
      expect(result.canSkip).toBe(true);
      expect(result.isLastStep).toBe(false);

      getUserOnboardingProgressSpy.mockRestore();
    });

    it('should handle completed onboarding', async () => {
      const { supabase } = require('@/lib/supabase/server');

      // Mock completed progress
      const mockProgress = {
        flowId: 'flow-1',
        status: 'completed',
      };

      const getUserOnboardingProgressSpy = jest.spyOn(
        onboardingWorkflowService,
        'getUserOnboardingProgress'
      ).mockResolvedValue(mockProgress as any);

      const result = await onboardingWorkflowService.getCurrentStep('user-123');

      expect(result.step).toBeUndefined();
      expect(result.canSkip).toBe(false);
      expect(result.isLastStep).toBe(true);

      getUserOnboardingProgressSpy.mockRestore();
    });
  });

  describe('completeStep', () => {
    it('should complete step successfully', async () => {
      const { supabase } = require('@/lib/supabase/server');

      // Mock progress
      const mockProgress = {
        flowId: 'flow-1',
        currentStepIndex: 0,
        completedSteps: [],
        skippedSteps: [],
        stepData: {},
      };

      const getUserOnboardingProgressSpy = jest.spyOn(
        onboardingWorkflowService,
        'getUserOnboardingProgress'
      ).mockResolvedValue(mockProgress as any);

      // Mock flow
      supabase.from().select().eq().single
        .mockResolvedValueOnce({
          data: {
            steps: [
              { step: 'welcome', name: 'Welcome', type: 'info', required: true },
              { step: 'profile', name: 'Profile', type: 'form', required: false },
            ],
          },
          error: null,
        });

      // Mock progress record lookup
      supabase.from().select().eq().eq().single
        .mockResolvedValueOnce({
          data: { id: 'progress-record-123' },
          error: null,
        });

      // Mock step completion insert
      supabase.from().insert
        .mockResolvedValue({ error: null });

      // Mock progress update
      supabase.from().update().eq
        .mockResolvedValue({ error: null });

      const result = await onboardingWorkflowService.completeStep(
        'user-123',
        0,
        { welcomeViewed: true }
      );

      expect(result.success).toBe(true);
      expect(result.nextStep).toBeDefined();
      expect(result.isComplete).toBe(false);

      getUserOnboardingProgressSpy.mockRestore();
    });

    it('should handle step completion on last step', async () => {
      const { supabase } = require('@/lib/supabase/server');

      // Mock progress at last step
      const mockProgress = {
        flowId: 'flow-1',
        currentStepIndex: 1,
        completedSteps: [0],
        skippedSteps: [],
        stepData: {},
      };

      const getUserOnboardingProgressSpy = jest.spyOn(
        onboardingWorkflowService,
        'getUserOnboardingProgress'
      ).mockResolvedValue(mockProgress as any);

      // Mock single-step flow
      supabase.from().select().eq().single
        .mockResolvedValueOnce({
          data: {
            steps: [
              { step: 'welcome', name: 'Welcome', type: 'info', required: true },
              { step: 'complete', name: 'Complete', type: 'info', required: true },
            ],
          },
          error: null,
        });

      // Mock progress record lookup
      supabase.from().select().eq().eq().single
        .mockResolvedValueOnce({
          data: { id: 'progress-record-123' },
          error: null,
        });

      // Mock operations
      supabase.from().insert.mockResolvedValue({ error: null });
      supabase.from().update().eq.mockResolvedValue({ error: null });

      const result = await onboardingWorkflowService.completeStep(
        'user-123',
        1,
        { completed: true }
      );

      expect(result.success).toBe(true);
      expect(result.nextStep).toBeUndefined();
      expect(result.isComplete).toBe(true);

      getUserOnboardingProgressSpy.mockRestore();
    });

    it('should handle step skipping', async () => {
      const { supabase } = require('@/lib/supabase/server');

      // Mock progress
      const mockProgress = {
        flowId: 'flow-1',
        currentStepIndex: 0,
        completedSteps: [],
        skippedSteps: [],
        stepData: {},
      };

      const getUserOnboardingProgressSpy = jest.spyOn(
        onboardingWorkflowService,
        'getUserOnboardingProgress'
      ).mockResolvedValue(mockProgress as any);

      // Mock flow
      supabase.from().select().eq().single
        .mockResolvedValueOnce({
          data: {
            steps: [
              { step: 'profile', name: 'Profile', type: 'form', required: false },
              { step: 'complete', name: 'Complete', type: 'info', required: true },
            ],
          },
          error: null,
        });

      // Mock progress record lookup
      supabase.from().select().eq().eq().single
        .mockResolvedValueOnce({
          data: { id: 'progress-record-123' },
          error: null,
        });

      // Mock operations
      supabase.from().insert.mockResolvedValue({ error: null });
      supabase.from().update().eq.mockResolvedValue({ error: null });

      const result = await onboardingWorkflowService.completeStep(
        'user-123',
        0,
        {},
        true // skip step
      );

      expect(result.success).toBe(true);
      expect(result.nextStep).toBeDefined();
      expect(result.isComplete).toBe(false);

      getUserOnboardingProgressSpy.mockRestore();
    });

    it('should handle validation errors for required steps', async () => {
      const { supabase } = require('@/lib/supabase/server');

      // Mock progress
      const mockProgress = {
        flowId: 'flow-1',
        currentStepIndex: 0,
        completedSteps: [],
        skippedSteps: [],
        stepData: {},
      };

      const getUserOnboardingProgressSpy = jest.spyOn(
        onboardingWorkflowService,
        'getUserOnboardingProgress'
      ).mockResolvedValue(mockProgress as any);

      // Mock flow with required step
      supabase.from().select().eq().single
        .mockResolvedValueOnce({
          data: {
            steps: [
              { 
                step: 'profile', 
                name: 'Profile', 
                type: 'form', 
                required: true,
                validation: {
                  firstName: { required: true },
                }
              },
            ],
          },
          error: null,
        });

      const result = await onboardingWorkflowService.completeStep(
        'user-123',
        0,
        {} // empty data for required step
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('firstName is required');

      getUserOnboardingProgressSpy.mockRestore();
    });
  });

  describe('validateStepData', () => {
    it('should validate form step data correctly', async () => {
      const step = {
        step: 'profile',
        name: 'Profile Setup',
        type: 'form' as const,
        required: true,
        validation: {
          firstName: { required: true, minLength: 2 },
          email: { required: true, email: true },
        },
      };

      const validData = {
        firstName: 'John',
        email: 'john@example.com',
      };

      const result = await onboardingWorkflowService.validateStepData(step, validData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should catch validation errors in form data', async () => {
      const step = {
        step: 'profile',
        name: 'Profile Setup',
        type: 'form' as const,
        required: true,
        validation: {
          firstName: { required: true, minLength: 2 },
          email: { required: true, email: true },
        },
      };

      const invalidData = {
        firstName: 'J', // too short
        email: 'invalid-email', // invalid format
      };

      const result = await onboardingWorkflowService.validateStepData(step, invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContain('firstName must be at least 2 characters.');
      expect(result.errors).toContain('email must be a valid email address.');
    });

    it('should validate verification step data', async () => {
      const step = {
        step: 'email_verification',
        name: 'Email Verification',
        type: 'verification' as const,
        required: true,
      };

      const validData = { verified: true };
      const result = await onboardingWorkflowService.validateStepData(step, validData);

      expect(result.isValid).toBe(true);

      const invalidData = { verified: false };
      const invalidResult = await onboardingWorkflowService.validateStepData(step, invalidData);

      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('Email verification is required to continue.');
    });
  });

  describe('getOnboardingStats', () => {
    it('should return comprehensive onboarding statistics', async () => {
      const { supabase } = require('@/lib/supabase/server');

      const mockProgressRecords = [
        {
          status: 'completed',
          completed_steps: [0, 1, 2],
          total_time_spent_minutes: 30,
          engagement_score: 0.8,
        },
        {
          status: 'in_progress',
          completed_steps: [0, 1],
          total_time_spent_minutes: 15,
          engagement_score: 0.6,
        },
        {
          status: 'completed',
          completed_steps: [0, 1, 2, 3],
          total_time_spent_minutes: 45,
          engagement_score: 0.9,
        },
      ];

      supabase.from().select().eq
        .mockResolvedValue({
          data: mockProgressRecords,
          error: null,
        });

      const result = await onboardingWorkflowService.getOnboardingStats('user-123');

      expect(result.totalFlows).toBe(3);
      expect(result.completedFlows).toBe(2);
      expect(result.inProgressFlows).toBe(1);
      expect(result.completionRate).toBe((2 / 3) * 100);
      expect(result.totalStepsCompleted).toBe(3 + 2 + 4);
      expect(result.averageCompletionTime).toBe((30 + 45) / 2);
      expect(result.engagementScore).toBe((0.8 + 0.6 + 0.9) / 3);
    });

    it('should handle empty statistics gracefully', async () => {
      const { supabase } = require('@/lib/supabase/server');

      supabase.from().select().eq
        .mockResolvedValue({
          data: [],
          error: null,
        });

      const result = await onboardingWorkflowService.getOnboardingStats('user-123');

      expect(result.totalFlows).toBe(0);
      expect(result.completedFlows).toBe(0);
      expect(result.completionRate).toBe(0);
      expect(result.averageCompletionTime).toBe(0);
      expect(result.engagementScore).toBe(0);
    });
  });

  describe('abandonOnboarding', () => {
    it('should abandon onboarding successfully', async () => {
      const { supabase } = require('@/lib/supabase/server');

      // Mock finding progress record
      supabase.from().select().eq().eq().single
        .mockResolvedValue({
          data: { id: 'progress-123' },
          error: null,
        });

      // Mock update operation
      supabase.from().update().eq
        .mockResolvedValue({ error: null });

      const result = await onboardingWorkflowService.abandonOnboarding(
        'user-123',
        'flow-1',
        'User decided to skip'
      );

      expect(result).toBe(true);
    });

    it('should handle abandonment errors', async () => {
      const { supabase } = require('@/lib/supabase/server');

      // Mock error finding progress
      supabase.from().select().eq().eq().single
        .mockResolvedValue({
          data: null,
          error: new Error('Progress not found'),
        });

      const result = await onboardingWorkflowService.abandonOnboarding(
        'user-123',
        'flow-1'
      );

      expect(result).toBe(false);
    });
  });
});