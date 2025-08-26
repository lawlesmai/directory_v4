/**
 * Onboarding API Routes Test Suite
 * Epic 2 Story 2.5: User Onboarding and Email Verification Infrastructure
 * 
 * Integration tests for onboarding API endpoints
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';

// Mock Next.js dependencies
jest.mock('next/headers', () => ({
  headers: jest.fn(() => ({
    get: jest.fn((name) => {
      const headerMap: Record<string, string> = {
        'user-agent': 'test-user-agent',
        'x-forwarded-for': '192.168.1.1',
      };
      return headerMap[name] || null;
    }),
  })),
  cookies: jest.fn(),
}));

// Mock Supabase auth helpers
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createRouteHandlerClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
      resend: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
    })),
  })),
}));

// Mock services
jest.mock('@/lib/auth/email-verification', () => ({
  emailVerificationService: {
    generateVerificationToken: jest.fn(),
    validateToken: jest.fn(),
    checkTokenStatus: jest.fn(),
    trackEmailDelivery: jest.fn(),
  },
  generateVerificationUrl: jest.fn((token) => `https://example.com/verify?token=${token}`),
}));

jest.mock('@/lib/auth/email-templates', () => ({
  emailTemplateService: {
    renderTemplate: jest.fn(),
  },
}));

jest.mock('@/lib/auth/onboarding-workflow', () => ({
  onboardingWorkflowService: {
    getUserOnboardingProgress: jest.fn(),
    initializeUserOnboarding: jest.fn(),
    getCurrentStep: jest.fn(),
    completeStep: jest.fn(),
    abandonOnboarding: jest.fn(),
  },
}));

jest.mock('@/lib/auth/rate-limiting', () => ({
  rateLimit: jest.fn(),
}));

describe('Onboarding API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/onboarding/verify-email', () => {
    // Dynamic import to ensure mocks are set up
    let POST: any;

    beforeEach(async () => {
      const module = await import('@/app/api/onboarding/verify-email/route');
      POST = module.POST;
    });

    it('should generate email verification token successfully', async () => {
      // Setup mocks
      const { createRouteHandlerClient } = require('@supabase/auth-helpers-nextjs');
      const mockSupabase = createRouteHandlerClient();
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            user_metadata: {
              first_name: 'John',
              display_name: 'John Doe',
            },
          },
        },
        error: null,
      });
      mockSupabase.auth.resend.mockResolvedValue({ error: null });

      const { rateLimit } = require('@/lib/auth/rate-limiting');
      rateLimit.mockResolvedValue({ allowed: true });

      const { emailVerificationService } = require('@/lib/auth/email-verification');
      emailVerificationService.generateVerificationToken.mockResolvedValue({
        success: true,
        token: 'verification-token-123',
      });
      emailVerificationService.trackEmailDelivery.mockResolvedValue(undefined);

      const { emailTemplateService } = require('@/lib/auth/email-templates');
      emailTemplateService.renderTemplate.mockResolvedValue({
        subject: 'Verify your email',
        htmlContent: '<h1>Verify</h1>',
        textContent: 'Verify your email',
      });

      // Create request
      const request = new NextRequest('http://localhost:3000/api/onboarding/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          emailAddress: 'test@example.com',
          verificationType: 'registration',
        }),
      });

      // Execute
      const response = await POST(request);
      const responseData = await response.json();

      // Verify
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Verification email sent successfully');
      expect(emailVerificationService.generateVerificationToken).toHaveBeenCalledWith(
        'user-123',
        'test@example.com',
        'registration'
      );
    });

    it('should handle rate limiting', async () => {
      // Setup mocks
      const { createRouteHandlerClient } = require('@supabase/auth-helpers-nextjs');
      const mockSupabase = createRouteHandlerClient();
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      const { rateLimit } = require('@/lib/auth/rate-limiting');
      rateLimit.mockResolvedValue({
        allowed: false,
        retryAfter: 60,
      });

      // Create request
      const request = new NextRequest('http://localhost:3000/api/onboarding/verify-email', {
        method: 'POST',
        body: JSON.stringify({ emailAddress: 'test@example.com' }),
      });

      // Execute
      const response = await POST(request);
      const responseData = await response.json();

      // Verify
      expect(response.status).toBe(429);
      expect(responseData.error).toContain('Rate limit exceeded');
      expect(responseData.retryAfter).toBe(60);
    });

    it('should handle unauthorized requests', async () => {
      // Setup mocks
      const { createRouteHandlerClient } = require('@supabase/auth-helpers-nextjs');
      const mockSupabase = createRouteHandlerClient();
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Unauthorized'),
      });

      // Create request
      const request = new NextRequest('http://localhost:3000/api/onboarding/verify-email', {
        method: 'POST',
        body: JSON.stringify({ emailAddress: 'test@example.com' }),
      });

      // Execute
      const response = await POST(request);
      const responseData = await response.json();

      // Verify
      expect(response.status).toBe(401);
      expect(responseData.error).toBe('Unauthorized');
    });

    it('should handle token generation failure', async () => {
      // Setup mocks
      const { createRouteHandlerClient } = require('@supabase/auth-helpers-nextjs');
      const mockSupabase = createRouteHandlerClient();
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      const { rateLimit } = require('@/lib/auth/rate-limiting');
      rateLimit.mockResolvedValue({ allowed: true });

      const { emailVerificationService } = require('@/lib/auth/email-verification');
      emailVerificationService.generateVerificationToken.mockResolvedValue({
        success: false,
        error: 'Token generation failed',
      });

      // Create request
      const request = new NextRequest('http://localhost:3000/api/onboarding/verify-email', {
        method: 'POST',
        body: JSON.stringify({ emailAddress: 'test@example.com' }),
      });

      // Execute
      const response = await POST(request);
      const responseData = await response.json();

      // Verify
      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Token generation failed');
    });
  });

  describe('GET /api/onboarding/verify-email', () => {
    let GET: any;

    beforeEach(async () => {
      const module = await import('@/app/api/onboarding/verify-email/route');
      GET = module.GET;
    });

    it('should validate token successfully', async () => {
      const { emailVerificationService } = require('@/lib/auth/email-verification');
      emailVerificationService.validateToken.mockResolvedValue({
        isValid: true,
        isExpired: false,
        userId: 'user-123',
        attemptsRemaining: 2,
      });

      // Create request with token
      const request = new NextRequest('http://localhost:3000/api/onboarding/verify-email?token=' + 'a'.repeat(64));

      // Execute
      const response = await GET(request);
      const responseData = await response.json();

      // Verify
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Email verified successfully');
      expect(responseData.userId).toBe('user-123');
    });

    it('should handle invalid token', async () => {
      const { emailVerificationService } = require('@/lib/auth/email-verification');
      emailVerificationService.validateToken.mockResolvedValue({
        isValid: false,
        isExpired: false,
        error: 'Invalid token format.',
        attemptsRemaining: 0,
      });

      // Create request with invalid token
      const request = new NextRequest('http://localhost:3000/api/onboarding/verify-email?token=invalid-token');

      // Execute
      const response = await GET(request);
      const responseData = await response.json();

      // Verify
      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Invalid token format.');
      expect(responseData.isExpired).toBe(false);
    });

    it('should handle expired token', async () => {
      const { emailVerificationService } = require('@/lib/auth/email-verification');
      emailVerificationService.validateToken.mockResolvedValue({
        isValid: false,
        isExpired: true,
        error: 'Token has expired.',
        attemptsRemaining: 0,
      });

      // Create request with expired token
      const request = new NextRequest('http://localhost:3000/api/onboarding/verify-email?token=' + 'a'.repeat(64));

      // Execute
      const response = await GET(request);
      const responseData = await response.json();

      // Verify
      expect(response.status).toBe(410);
      expect(responseData.error).toBe('Token has expired.');
      expect(responseData.isExpired).toBe(true);
    });

    it('should handle missing token', async () => {
      // Create request without token
      const request = new NextRequest('http://localhost:3000/api/onboarding/verify-email');

      // Execute
      const response = await GET(request);
      const responseData = await response.json();

      // Verify
      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Verification token is required');
    });
  });

  describe('GET /api/onboarding/workflow', () => {
    let GET: any;

    beforeEach(async () => {
      const module = await import('@/app/api/onboarding/workflow/route');
      GET = module.GET;
    });

    it('should return existing onboarding progress', async () => {
      // Setup mocks
      const { createRouteHandlerClient } = require('@supabase/auth-helpers-nextjs');
      const mockSupabase = createRouteHandlerClient();
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const { onboardingWorkflowService } = require('@/lib/auth/onboarding-workflow');
      onboardingWorkflowService.getUserOnboardingProgress.mockResolvedValue({
        flowId: 'flow-1',
        flowName: 'Standard User Onboarding',
        status: 'in_progress',
        currentStepIndex: 1,
        completionPercentage: 50,
      });

      onboardingWorkflowService.getCurrentStep.mockResolvedValue({
        step: { name: 'Profile Setup', type: 'form' },
        stepIndex: 1,
        canSkip: true,
        isLastStep: false,
      });

      // Create request
      const request = new NextRequest('http://localhost:3000/api/onboarding/workflow');

      // Execute
      const response = await GET(request);
      const responseData = await response.json();

      // Verify
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.progress.flowName).toBe('Standard User Onboarding');
      expect(responseData.currentStep.name).toBe('Profile Setup');
    });

    it('should initialize onboarding if not started', async () => {
      // Setup mocks
      const { createRouteHandlerClient } = require('@supabase/auth-helpers-nextjs');
      const mockSupabase = createRouteHandlerClient();
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const { onboardingWorkflowService } = require('@/lib/auth/onboarding-workflow');
      onboardingWorkflowService.getUserOnboardingProgress.mockResolvedValue(null);
      onboardingWorkflowService.initializeUserOnboarding.mockResolvedValue({
        success: true,
        progressId: 'progress-123',
        flowId: 'flow-1',
      });
      onboardingWorkflowService.getUserOnboardingProgress.mockResolvedValueOnce({
        flowId: 'flow-1',
        status: 'not_started',
      });

      // Create request
      const request = new NextRequest('http://localhost:3000/api/onboarding/workflow');

      // Execute
      const response = await GET(request);
      const responseData = await response.json();

      // Verify
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.initialized).toBe(true);
      expect(onboardingWorkflowService.initializeUserOnboarding).toHaveBeenCalledWith('user-123', undefined);
    });

    it('should handle unauthorized requests', async () => {
      // Setup mocks
      const { createRouteHandlerClient } = require('@supabase/auth-helpers-nextjs');
      const mockSupabase = createRouteHandlerClient();
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Unauthorized'),
      });

      // Create request
      const request = new NextRequest('http://localhost:3000/api/onboarding/workflow');

      // Execute
      const response = await GET(request);
      const responseData = await response.json();

      // Verify
      expect(response.status).toBe(401);
      expect(responseData.error).toBe('Unauthorized');
    });
  });

  describe('PUT /api/onboarding/workflow', () => {
    let PUT: any;

    beforeEach(async () => {
      const module = await import('@/app/api/onboarding/workflow/route');
      PUT = module.PUT;
    });

    it('should complete onboarding step successfully', async () => {
      // Setup mocks
      const { createRouteHandlerClient } = require('@supabase/auth-helpers-nextjs');
      const mockSupabase = createRouteHandlerClient();
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const { rateLimit } = require('@/lib/auth/rate-limiting');
      rateLimit.mockResolvedValue({ allowed: true });

      const { onboardingWorkflowService } = require('@/lib/auth/onboarding-workflow');
      onboardingWorkflowService.completeStep.mockResolvedValue({
        success: true,
        nextStep: { name: 'Next Step', type: 'form' },
        isComplete: false,
      });
      onboardingWorkflowService.getUserOnboardingProgress.mockResolvedValue({
        flowId: 'flow-1',
        completionPercentage: 75,
      });

      // Create request
      const request = new NextRequest('http://localhost:3000/api/onboarding/workflow', {
        method: 'PUT',
        body: JSON.stringify({
          stepIndex: 1,
          stepData: { profileComplete: true },
          skipStep: false,
        }),
      });

      // Execute
      const response = await PUT(request);
      const responseData = await response.json();

      // Verify
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Step completed successfully');
      expect(responseData.nextStep.name).toBe('Next Step');
      expect(responseData.isComplete).toBe(false);
    });

    it('should skip onboarding step successfully', async () => {
      // Setup mocks
      const { createRouteHandlerClient } = require('@supabase/auth-helpers-nextjs');
      const mockSupabase = createRouteHandlerClient();
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const { rateLimit } = require('@/lib/auth/rate-limiting');
      rateLimit.mockResolvedValue({ allowed: true });

      const { onboardingWorkflowService } = require('@/lib/auth/onboarding-workflow');
      onboardingWorkflowService.completeStep.mockResolvedValue({
        success: true,
        nextStep: undefined,
        isComplete: true,
      });
      onboardingWorkflowService.getUserOnboardingProgress.mockResolvedValue({
        flowId: 'flow-1',
        completionPercentage: 100,
      });

      // Create request
      const request = new NextRequest('http://localhost:3000/api/onboarding/workflow', {
        method: 'PUT',
        body: JSON.stringify({
          stepIndex: 2,
          stepData: {},
          skipStep: true,
        }),
      });

      // Execute
      const response = await PUT(request);
      const responseData = await response.json();

      // Verify
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Step skipped successfully');
      expect(responseData.isComplete).toBe(true);
    });

    it('should handle step completion validation errors', async () => {
      // Setup mocks
      const { createRouteHandlerClient } = require('@supabase/auth-helpers-nextjs');
      const mockSupabase = createRouteHandlerClient();
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const { rateLimit } = require('@/lib/auth/rate-limiting');
      rateLimit.mockResolvedValue({ allowed: true });

      const { onboardingWorkflowService } = require('@/lib/auth/onboarding-workflow');
      onboardingWorkflowService.completeStep.mockResolvedValue({
        success: false,
        error: 'firstName is required.',
      });

      // Create request with invalid data
      const request = new NextRequest('http://localhost:3000/api/onboarding/workflow', {
        method: 'PUT',
        body: JSON.stringify({
          stepIndex: 1,
          stepData: {}, // missing required data
        }),
      });

      // Execute
      const response = await PUT(request);
      const responseData = await response.json();

      // Verify
      expect(response.status).toBe(400);
      expect(responseData.error).toBe('firstName is required.');
    });

    it('should handle rate limiting on step attempts', async () => {
      // Setup mocks
      const { createRouteHandlerClient } = require('@supabase/auth-helpers-nextjs');
      const mockSupabase = createRouteHandlerClient();
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const { rateLimit } = require('@/lib/auth/rate-limiting');
      rateLimit.mockResolvedValue({
        allowed: false,
        retryAfter: 120,
      });

      // Create request
      const request = new NextRequest('http://localhost:3000/api/onboarding/workflow', {
        method: 'PUT',
        body: JSON.stringify({
          stepIndex: 1,
          stepData: { test: true },
        }),
      });

      // Execute
      const response = await PUT(request);
      const responseData = await response.json();

      // Verify
      expect(response.status).toBe(429);
      expect(responseData.error).toBe('Rate limit exceeded');
      expect(responseData.retryAfter).toBe(120);
    });

    it('should handle missing step index', async () => {
      // Setup mocks
      const { createRouteHandlerClient } = require('@supabase/auth-helpers-nextjs');
      const mockSupabase = createRouteHandlerClient();
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      // Create request without stepIndex
      const request = new NextRequest('http://localhost:3000/api/onboarding/workflow', {
        method: 'PUT',
        body: JSON.stringify({
          stepData: { test: true },
        }),
      });

      // Execute
      const response = await PUT(request);
      const responseData = await response.json();

      // Verify
      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Step index is required');
    });
  });

  describe('DELETE /api/onboarding/workflow', () => {
    let DELETE: any;

    beforeEach(async () => {
      const module = await import('@/app/api/onboarding/workflow/route');
      DELETE = module.DELETE;
    });

    it('should abandon onboarding successfully', async () => {
      // Setup mocks
      const { createRouteHandlerClient } = require('@supabase/auth-helpers-nextjs');
      const mockSupabase = createRouteHandlerClient();
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const { onboardingWorkflowService } = require('@/lib/auth/onboarding-workflow');
      onboardingWorkflowService.abandonOnboarding.mockResolvedValue(true);

      // Create request
      const request = new NextRequest('http://localhost:3000/api/onboarding/workflow?flowId=flow-1&reason=too_complex');

      // Execute
      const response = await DELETE(request);
      const responseData = await response.json();

      // Verify
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Onboarding abandoned successfully');
      expect(onboardingWorkflowService.abandonOnboarding).toHaveBeenCalledWith(
        'user-123',
        'flow-1',
        'too_complex'
      );
    });

    it('should handle missing flow ID', async () => {
      // Setup mocks
      const { createRouteHandlerClient } = require('@supabase/auth-helpers-nextjs');
      const mockSupabase = createRouteHandlerClient();
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      // Create request without flowId
      const request = new NextRequest('http://localhost:3000/api/onboarding/workflow');

      // Execute
      const response = await DELETE(request);
      const responseData = await response.json();

      // Verify
      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Flow ID is required');
    });

    it('should handle abandonment failure', async () => {
      // Setup mocks
      const { createRouteHandlerClient } = require('@supabase/auth-helpers-nextjs');
      const mockSupabase = createRouteHandlerClient();
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const { onboardingWorkflowService } = require('@/lib/auth/onboarding-workflow');
      onboardingWorkflowService.abandonOnboarding.mockResolvedValue(false);

      // Create request
      const request = new NextRequest('http://localhost:3000/api/onboarding/workflow?flowId=flow-1');

      // Execute
      const response = await DELETE(request);
      const responseData = await response.json();

      // Verify
      expect(response.status).toBe(500);
      expect(responseData.error).toBe('Failed to abandon onboarding');
    });
  });
});