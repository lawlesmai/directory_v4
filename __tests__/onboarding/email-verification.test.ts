/**
 * Email Verification Service Test Suite
 * Epic 2 Story 2.5: User Onboarding and Email Verification Infrastructure
 * 
 * Comprehensive tests for email verification functionality
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { emailVerificationService } from '@/lib/auth/email-verification';

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              gte: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => ({
                    single: jest.fn(),
                  })),
                })),
              })),
            })),
          })),
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
      delete: jest.fn(() => ({
        lt: jest.fn(() => ({
          select: jest.fn(),
        })),
      })),
    })),
    sql: jest.fn(),
  },
}));

// Mock rate limiting
jest.mock('@/lib/auth/rate-limiting', () => ({
  rateLimit: jest.fn(),
}));

describe('EmailVerificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateVerificationToken', () => {
    it('should generate a verification token successfully', async () => {
      // Mock rate limit check to allow request
      const { rateLimit } = require('@/lib/auth/rate-limiting');
      rateLimit.mockResolvedValue({ allowed: true });

      // Mock database responses
      const { supabase } = require('@/lib/supabase/server');
      supabase.from().select().eq().eq().eq().eq().gte().order().limit().single
        .mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }, // No existing token
        });

      supabase.from().insert().select().single
        .mockResolvedValue({
          data: {
            id: 'token-id-123',
            token: 'generated-token-456',
            user_id: 'user-123',
            email_address: 'test@example.com',
          },
          error: null,
        });

      const result = await emailVerificationService.generateVerificationToken(
        'user-123',
        'test@example.com',
        'registration'
      );

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should handle rate limiting', async () => {
      // Mock rate limit check to deny request
      const { rateLimit } = require('@/lib/auth/rate-limiting');
      rateLimit.mockResolvedValue({
        allowed: false,
        retryAfter: 60,
      });

      const result = await emailVerificationService.generateVerificationToken(
        'user-123',
        'test@example.com',
        'registration'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
      expect(result.retryAfter).toBe(60);
    });

    it('should handle existing unexpired token with resend cooldown', async () => {
      // Mock rate limit check to allow request
      const { rateLimit } = require('@/lib/auth/rate-limiting');
      rateLimit.mockResolvedValue({ allowed: true });

      // Mock existing token within cooldown period
      const recentTime = new Date(Date.now() - 30 * 1000); // 30 seconds ago
      const { supabase } = require('@/lib/supabase/server');
      supabase.from().select().eq().eq().eq().eq().gte().order().limit().single
        .mockResolvedValue({
          data: {
            id: 'existing-token-id',
            token: 'existing-token',
            last_resent_at: recentTime.toISOString(),
            created_at: recentTime.toISOString(),
            resent_count: 1,
          },
          error: null,
        });

      const result = await emailVerificationService.generateVerificationToken(
        'user-123',
        'test@example.com',
        'registration'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Please wait before requesting');
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should resend existing token after cooldown period', async () => {
      // Mock rate limit check to allow request
      const { rateLimit } = require('@/lib/auth/rate-limiting');
      rateLimit.mockResolvedValue({ allowed: true });

      // Mock existing token outside cooldown period
      const oldTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      const { supabase } = require('@/lib/supabase/server');
      supabase.from().select().eq().eq().eq().eq().gte().order().limit().single
        .mockResolvedValue({
          data: {
            id: 'existing-token-id',
            token: 'existing-token-123',
            last_resent_at: oldTime.toISOString(),
            created_at: oldTime.toISOString(),
            resent_count: 1,
          },
          error: null,
        });

      supabase.from().update().eq
        .mockResolvedValue({ error: null });

      const result = await emailVerificationService.generateVerificationToken(
        'user-123',
        'test@example.com',
        'registration'
      );

      expect(result.success).toBe(true);
      expect(result.token).toBe('existing-token-123');
    });

    it('should handle database errors gracefully', async () => {
      // Mock rate limit check to allow request
      const { rateLimit } = require('@/lib/auth/rate-limiting');
      rateLimit.mockResolvedValue({ allowed: true });

      // Mock database error
      const { supabase } = require('@/lib/supabase/server');
      supabase.from().select().eq().eq().eq().eq().gte().order().limit().single
        .mockResolvedValue({
          data: null,
          error: new Error('Database connection failed'),
        });

      const result = await emailVerificationService.generateVerificationToken(
        'user-123',
        'test@example.com',
        'registration'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to generate verification token.');
    });
  });

  describe('validateToken', () => {
    it('should validate a correct token successfully', async () => {
      const { supabase } = require('@/lib/supabase/server');

      // Mock token lookup
      supabase.from().select().eq().eq().order().limit().single
        .mockResolvedValue({
          data: {
            id: 'token-id-123',
            user_id: 'user-123',
            email_address: 'test@example.com',
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
            attempts: 0,
            max_attempts: 3,
            is_verified: false,
          },
          error: null,
        });

      // Mock update operations
      supabase.from().update().eq
        .mockResolvedValue({ error: null });

      const result = await emailVerificationService.validateToken(
        'a'.repeat(64), // Valid token format
        'test-user-agent',
        '192.168.1.1'
      );

      expect(result.isValid).toBe(true);
      expect(result.isExpired).toBe(false);
      expect(result.userId).toBe('user-123');
    });

    it('should reject invalid token format', async () => {
      const result = await emailVerificationService.validateToken(
        'invalid-token-format',
        'test-user-agent',
        '192.168.1.1'
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid token format.');
    });

    it('should handle expired token', async () => {
      const { supabase } = require('@/lib/supabase/server');

      // Mock expired token
      supabase.from().select().eq().eq().order().limit().single
        .mockResolvedValue({
          data: {
            id: 'token-id-123',
            user_id: 'user-123',
            email_address: 'test@example.com',
            expires_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
            attempts: 0,
            max_attempts: 3,
          },
          error: null,
        });

      const result = await emailVerificationService.validateToken(
        'a'.repeat(64),
        'test-user-agent',
        '192.168.1.1'
      );

      expect(result.isValid).toBe(false);
      expect(result.isExpired).toBe(true);
      expect(result.error).toBe('Token has expired.');
    });

    it('should handle token with exceeded attempts', async () => {
      const { supabase } = require('@/lib/supabase/server');

      // Mock token with max attempts exceeded
      supabase.from().select().eq().eq().order().limit().single
        .mockResolvedValue({
          data: {
            id: 'token-id-123',
            user_id: 'user-123',
            email_address: 'test@example.com',
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            attempts: 3,
            max_attempts: 3,
          },
          error: null,
        });

      const result = await emailVerificationService.validateToken(
        'a'.repeat(64),
        'test-user-agent',
        '192.168.1.1'
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Maximum verification attempts exceeded.');
      expect(result.attemptsRemaining).toBe(0);
    });

    it('should handle non-existent token', async () => {
      const { supabase } = require('@/lib/supabase/server');

      // Mock token not found
      supabase.from().select().eq().eq().order().limit().single
        .mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        });

      const result = await emailVerificationService.validateToken(
        'a'.repeat(64),
        'test-user-agent',
        '192.168.1.1'
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token not found or already used.');
    });
  });

  describe('checkTokenStatus', () => {
    it('should return correct token status', async () => {
      const { supabase } = require('@/lib/supabase/server');

      supabase.from().select().eq().order().limit().single
        .mockResolvedValue({
          data: {
            id: 'token-id-123',
            email_address: 'test@example.com',
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            attempts: 1,
            max_attempts: 3,
            is_verified: false,
          },
          error: null,
        });

      const result = await emailVerificationService.checkTokenStatus('a'.repeat(64));

      expect(result.exists).toBe(true);
      expect(result.isExpired).toBe(false);
      expect(result.isVerified).toBe(false);
      expect(result.attemptsRemaining).toBe(2);
      expect(result.emailAddress).toBe('test@example.com');
    });

    it('should handle non-existent token status check', async () => {
      const { supabase } = require('@/lib/supabase/server');

      supabase.from().select().eq().order().limit().single
        .mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        });

      const result = await emailVerificationService.checkTokenStatus('a'.repeat(64));

      expect(result.exists).toBe(false);
      expect(result.isExpired).toBe(false);
      expect(result.isVerified).toBe(false);
      expect(result.attemptsRemaining).toBe(0);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should clean up expired tokens and return count', async () => {
      const { supabase } = require('@/lib/supabase/server');

      supabase.from().delete().lt().select
        .mockResolvedValue({
          data: [
            { id: 'token-1' },
            { id: 'token-2' },
            { id: 'token-3' },
          ],
          error: null,
        });

      const result = await emailVerificationService.cleanupExpiredTokens();

      expect(result.deletedCount).toBe(3);
    });

    it('should handle cleanup errors gracefully', async () => {
      const { supabase } = require('@/lib/supabase/server');

      supabase.from().delete().lt().select
        .mockResolvedValue({
          data: null,
          error: new Error('Cleanup failed'),
        });

      const result = await emailVerificationService.cleanupExpiredTokens();

      expect(result.deletedCount).toBe(0);
    });
  });

  describe('getUserVerificationHistory', () => {
    it('should return user verification history', async () => {
      const { supabase } = require('@/lib/supabase/server');

      const mockHistory = [
        {
          id: 'token-1',
          verification_type: 'registration',
          created_at: '2025-01-01T10:00:00Z',
          is_verified: true,
        },
        {
          id: 'token-2',
          verification_type: 'email_change',
          created_at: '2025-01-02T10:00:00Z',
          is_verified: false,
        },
      ];

      supabase.from().select().eq().order().limit
        .mockResolvedValue({
          data: mockHistory,
          error: null,
        });

      const result = await emailVerificationService.getUserVerificationHistory('user-123');

      expect(result).toEqual(mockHistory);
      expect(result).toHaveLength(2);
    });

    it('should handle empty history', async () => {
      const { supabase } = require('@/lib/supabase/server');

      supabase.from().select().eq().order().limit
        .mockResolvedValue({
          data: [],
          error: null,
        });

      const result = await emailVerificationService.getUserVerificationHistory('user-123');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('trackEmailDelivery', () => {
    it('should track email delivery successfully', async () => {
      const { supabase } = require('@/lib/supabase/server');

      supabase.from().insert
        .mockResolvedValue({ error: null });

      // Should not throw an error
      await expect(
        emailVerificationService.trackEmailDelivery(
          'token-id-123',
          'test@example.com',
          'email_verification',
          'verification_template',
          'sent'
        )
      ).resolves.not.toThrow();
    });

    it('should handle delivery tracking errors gracefully', async () => {
      const { supabase } = require('@/lib/supabase/server');

      supabase.from().insert
        .mockResolvedValue({
          error: new Error('Insert failed'),
        });

      // Should not throw an error (graceful handling)
      await expect(
        emailVerificationService.trackEmailDelivery(
          'token-id-123',
          'test@example.com',
          'email_verification',
          'verification_template',
          'failed'
        )
      ).resolves.not.toThrow();
    });
  });

  describe('getEmailDeliveryAnalytics', () => {
    it('should return email delivery analytics', async () => {
      const { supabase } = require('@/lib/supabase/server');

      const mockDeliveryData = [
        { status: 'sent' },
        { status: 'sent' },
        { status: 'delivered' },
        { status: 'delivered' },
        { status: 'opened' },
        { status: 'clicked' },
        { status: 'bounced' },
        { status: 'failed' },
      ];

      supabase.from().select().gte().lte().eq
        .mockResolvedValue({
          data: mockDeliveryData,
          error: null,
        });

      const dateRange = {
        from: new Date('2025-01-01'),
        to: new Date('2025-01-31'),
      };

      const result = await emailVerificationService.getEmailDeliveryAnalytics(dateRange);

      expect(result.total).toBe(8);
      expect(result.sent).toBe(2);
      expect(result.delivered).toBe(2);
      expect(result.opened).toBe(1);
      expect(result.clicked).toBe(1);
      expect(result.bounced).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.deliveryRate).toBe(25); // 2/8 * 100
      expect(result.openRate).toBe(50); // 1/2 * 100
      expect(result.clickRate).toBe(100); // 1/1 * 100
    });

    it('should handle empty analytics data', async () => {
      const { supabase } = require('@/lib/supabase/server');

      supabase.from().select().gte().lte().eq
        .mockResolvedValue({
          data: [],
          error: null,
        });

      const dateRange = {
        from: new Date('2025-01-01'),
        to: new Date('2025-01-31'),
      };

      const result = await emailVerificationService.getEmailDeliveryAnalytics(dateRange);

      expect(result.total).toBe(0);
      expect(result.deliveryRate).toBe(0);
      expect(result.openRate).toBe(0);
      expect(result.clickRate).toBe(0);
    });
  });
});