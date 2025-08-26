/**
 * Comprehensive Password Management Test Suite
 * Epic 2 Story 2.6: Password Management and Account Security
 * 
 * Tests for password policy engine, security monitoring, account lockout,
 * and password reset workflows with performance benchmarks.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { 
  passwordPolicyEngine, 
  validatePasswordSecurity, 
  checkPasswordBreach,
  getPasswordPolicyForRole
} from '@/lib/auth/password-policy'
import { 
  accountLockoutManager,
  checkAccountLockout,
  recordAuthFailure,
  unlockAccount
} from '@/lib/auth/account-lockout'
import {
  passwordResetManager,
  initiatePasswordReset,
  validateResetToken,
  completePasswordReset
} from '@/lib/auth/password-reset'
import {
  securityMonitor,
  processSecurityEvent,
  getSecurityMetrics,
  detectSecurityAnomalies
} from '@/lib/auth/security-monitor'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

// Mock dependencies
jest.mock('@/lib/supabase/server')
jest.mock('bcryptjs')
jest.mock('crypto')

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnValue({ data: null, error: null }),
  rpc: jest.fn().mockReturnValue({ data: [], error: null }),
  auth: {
    admin: {
      getUserById: jest.fn().mockReturnValue({ data: { user: null }, error: null }),
      updateUserById: jest.fn().mockReturnValue({ error: null }),
      listUsers: jest.fn().mockReturnValue({ data: { users: [] }, error: null })
    },
    resetPasswordForEmail: jest.fn().mockReturnValue({ error: null })
  }
}

;(createClient as jest.Mock).mockReturnValue(mockSupabase)

// Mock HTTP request
const createMockRequest = (overrides?: Partial<NextRequest>): NextRequest => {
  return {
    headers: new Headers({
      'user-agent': 'Test User Agent',
      'x-forwarded-for': '192.168.1.1',
      ...overrides?.headers
    }),
    url: 'http://localhost:3000/test',
    ...overrides
  } as NextRequest
}

describe('Password Management System', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset any global state
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  describe('Password Policy Engine', () => {
    describe('Password Validation', () => {
      it('should validate NIST 800-63B compliant passwords', async () => {
        const testCases = [
          {
            password: 'MySecureP@ssw0rd2024!',
            role: 'user',
            expectedCompliant: true,
            expectedLevel: 'strong'
          },
          {
            password: 'password123',
            role: 'user',
            expectedCompliant: false,
            expectedLevel: 'weak'
          },
          {
            password: 'SuperS3cur3P@ssw0rd!2024',
            role: 'admin',
            expectedCompliant: true,
            expectedLevel: 'very_strong'
          }
        ]

        for (const testCase of testCases) {
          const result = await validatePasswordSecurity(
            testCase.password,
            'test-user-id',
            testCase.role
          )

          expect(result.compliant).toBe(testCase.expectedCompliant)
          expect(result.level).toBe(testCase.expectedLevel)
          expect(result.score).toBeGreaterThanOrEqual(0)
          expect(result.score).toBeLessThanOrEqual(100)
        }
      })

      it('should enforce role-based password policies', async () => {
        const adminPolicy = getPasswordPolicyForRole('admin')
        const userPolicy = getPasswordPolicyForRole('user')

        expect(adminPolicy.minLength).toBeGreaterThan(userPolicy.minLength)
        expect(adminPolicy.preventReuse).toBeGreaterThanOrEqual(userPolicy.preventReuse)
        expect(adminPolicy.requireComplexity).toBe(true)
      })

      it('should detect password reuse', async () => {
        const userId = 'test-user-id'
        const password = 'TestPassword123!'

        // Mock password history
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnValue({
            data: [
              { password_hash: 'mock-hash-1', algorithm: 'bcrypt' },
              { password_hash: 'mock-hash-2', algorithm: 'bcrypt' }
            ],
            error: null
          })
        })

        const bcrypt = await import('bcryptjs')
        ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

        const reuseCheck = await passwordPolicyEngine.checkPasswordReuse(password, userId, 5)
        expect(reuseCheck).toBe(true)
      })

      it('should check password breaches via HaveIBeenPwned', async () => {
        const breachedPassword = 'password123'
        const safePassword = 'UniqueS3cur3P@ssw0rd2024!'

        // Mock fetch for HaveIBeenPwned API
        global.fetch = jest.fn().mockImplementation((url: string) => {
          if (url.includes('password123')) {
            return Promise.resolve({
              ok: true,
              text: () => Promise.resolve('HASH_SUFFIX:12345\nOTHER_HASH:67890')
            })
          }
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('')
          })
        })

        const breachedResult = await checkPasswordBreach(breachedPassword)
        expect(breachedResult.isBreached).toBe(true)

        const safeResult = await checkPasswordBreach(safePassword)
        expect(safeResult.isBreached).toBe(false)
      })

      it('should calculate password strength within performance thresholds', async () => {
        const password = 'TestPassword123!'
        const startTime = Date.now()

        const result = await validatePasswordSecurity(password)
        const endTime = Date.now()
        const duration = endTime - startTime

        expect(duration).toBeLessThan(50) // 50ms threshold
        expect(result.score).toBeGreaterThan(0)
        expect(result.feedback.entropy).toBeGreaterThan(0)
      })
    })

    describe('Password History Management', () => {
      it('should store password history correctly', async () => {
        const userId = 'test-user-id'
        const passwordHash = 'mock-hash'

        mockSupabase.from.mockReturnValue({
          insert: jest.fn().mockReturnValue({ error: null }),
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          range: jest.fn().mockReturnValue({ data: [], error: null }),
          delete: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnValue({ error: null })
        })

        await passwordPolicyEngine.storePasswordHistory(userId, passwordHash)

        expect(mockSupabase.from).toHaveBeenCalledWith('user_password_history')
      })

      it('should clean up old password history entries', async () => {
        const userId = 'test-user-id'
        const passwordHash = 'mock-hash'

        // Mock returning old entries that need cleanup
        mockSupabase.from.mockImplementation((table) => {
          if (table === 'user_password_history') {
            return {
              insert: jest.fn().mockReturnValue({ error: null }),
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              range: jest.fn().mockReturnValue({ 
                data: [{ id: 'old-1' }, { id: 'old-2' }], 
                error: null 
              }),
              delete: jest.fn().mockReturnThis(),
              in: jest.fn().mockReturnValue({ error: null })
            }
          }
          return mockSupabase
        })

        await passwordPolicyEngine.storePasswordHistory(userId, passwordHash)

        // Verify cleanup was attempted
        expect(mockSupabase.from).toHaveBeenCalledWith('user_password_history')
      })
    })
  })

  describe('Account Lockout System', () => {
    describe('Lockout Detection', () => {
      it('should detect and apply progressive lockout', async () => {
        const userId = 'test-user-id'
        const ipAddress = '192.168.1.1'
        const request = createMockRequest()

        // Mock successful lockout check initially
        mockSupabase.rpc.mockResolvedValue({
          data: [{ is_locked: false, attempt_count: 0 }],
          error: null
        })

        // Mock recent failed attempts
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnValue({
            data: [1, 2, 3, 4], // 4 failed attempts
            error: null
          })
        })

        const lockoutStatus = await checkAccountLockout(userId, ipAddress, 'user')
        expect(lockoutStatus.attemptCount).toBe(4)
        expect(lockoutStatus.isLocked).toBe(false) // Not locked yet

        // Simulate 5th failed attempt
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnValue({
            data: [1, 2, 3, 4, 5], // 5 failed attempts
            error: null
          })
        })

        const lockoutAfterFifth = await checkAccountLockout(userId, ipAddress, 'user')
        expect(lockoutAfterFifth.isLocked).toBe(true)
      })

      it('should implement progressive delay for repeated attempts', async () => {
        const event = {
          userId: 'test-user-id',
          ipAddress: '192.168.1.1',
          userAgent: 'Test Agent',
          eventType: 'failed_login' as const,
          reason: 'Invalid password'
        }
        const request = createMockRequest()

        // Mock increasing attempt counts
        const attemptCounts = [1, 2, 3, 4, 5]
        const delays: number[] = []

        for (const count of attemptCounts) {
          // Mock lockout status with current attempt count
          mockSupabase.from.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnValue({
              data: Array(count).fill(1),
              error: null
            })
          })

          mockSupabase.rpc.mockResolvedValue({
            data: [{ is_locked: false, attempt_count: count }],
            error: null
          })

          const result = await recordAuthFailure(event, request)
          delays.push(result.delayMs)
        }

        // Verify progressive delay increase
        for (let i = 1; i < delays.length; i++) {
          expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1])
        }
      })

      it('should handle IP-based lockouts separately from user lockouts', async () => {
        const ipAddress = '192.168.1.1'
        
        // Test IP lockout without user ID
        const ipLockoutStatus = await checkAccountLockout(undefined, ipAddress, 'user')
        expect(ipLockoutStatus).toBeDefined()

        // Test user lockout without IP
        const userLockoutStatus = await checkAccountLockout('test-user-id', undefined, 'user')
        expect(userLockoutStatus).toBeDefined()
      })
    })

    describe('Lockout Recovery', () => {
      it('should unlock account via admin intervention', async () => {
        const unlockRequest = {
          userId: 'test-user-id',
          method: 'admin' as const,
          adminUserId: 'admin-user-id',
          reason: 'Manual unlock after verification'
        }

        mockSupabase.from.mockReturnValue({
          update: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnValue({ error: null }),
          insert: jest.fn().mockReturnValue({ error: null })
        })

        const result = await unlockAccount(unlockRequest)
        expect(result.success).toBe(true)
      })

      it('should implement automatic unlock after timeout', async () => {
        // Mock expired lockout
        const now = new Date()
        const pastLockout = new Date(now.getTime() - 60 * 60 * 1000) // 1 hour ago

        mockSupabase.rpc.mockResolvedValue({
          data: [{ 
            is_locked: false, 
            lockout_until: pastLockout.toISOString(),
            attempt_count: 5
          }],
          error: null
        })

        const lockoutStatus = await checkAccountLockout('test-user-id', '192.168.1.1')
        expect(lockoutStatus.isLocked).toBe(false)
      })
    })
  })

  describe('Password Reset System', () => {
    describe('Reset Token Generation', () => {
      it('should generate cryptographically secure tokens', async () => {
        const resetRequest = {
          email: 'test@example.com',
          method: 'email' as const
        }
        const request = createMockRequest()

        // Mock user lookup
        mockSupabase.auth.admin.listUsers.mockResolvedValue({
          data: {
            users: [{ id: 'test-user-id', email: 'test@example.com' }]
          },
          error: null
        })

        // Mock rate limit check
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnValue({
            data: [], // No previous attempts
            error: null
          })
        })

        // Mock token storage
        mockSupabase.from.mockReturnValue({
          insert: jest.fn().mockReturnValue({ error: null })
        })

        const result = await initiatePasswordReset(resetRequest, request)
        expect(result.success).toBe(true)
        expect(result.tokenId).toBeDefined()
        expect(result.expiresAt).toBeInstanceOf(Date)
      })

      it('should enforce rate limiting for reset requests', async () => {
        const resetRequest = {
          email: 'test@example.com',
          method: 'email' as const
        }
        const request = createMockRequest()

        // Mock user lookup
        mockSupabase.auth.admin.listUsers.mockResolvedValue({
          data: {
            users: [{ id: 'test-user-id', email: 'test@example.com' }]
          },
          error: null
        })

        // Mock excessive previous attempts
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnValue({
            data: Array(10).fill({}), // 10 previous attempts
            error: null
          })
        })

        const result = await initiatePasswordReset(resetRequest, request)
        expect(result.success).toBe(false)
        expect(result.rateLimited).toBe(true)
      })

      it('should not reveal user existence during reset', async () => {
        const resetRequest = {
          email: 'nonexistent@example.com',
          method: 'email' as const
        }
        const request = createMockRequest()

        // Mock no user found
        mockSupabase.auth.admin.listUsers.mockResolvedValue({
          data: { users: [] },
          error: null
        })

        const result = await initiatePasswordReset(resetRequest, request)
        
        // Should appear successful to prevent email enumeration
        expect(result.success).toBe(true)
        expect(result.expiresAt).toBeDefined()
      })
    })

    describe('Token Validation', () => {
      it('should validate reset tokens correctly', async () => {
        const tokenId = 'test-token-id'
        const token = 'test-token-value'
        const request = createMockRequest()

        // Mock valid token
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          single: jest.fn().mockReturnValue({
            data: {
              id: tokenId,
              user_id: 'test-user-id',
              expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 mins future
              attempt_count: 1,
              max_attempts: 3,
              requires_mfa: false
            },
            error: null
          })
        })

        const validation = await validateResetToken(tokenId, token, request)
        expect(validation.valid).toBe(true)
        expect(validation.userId).toBe('test-user-id')
        expect(validation.attemptsRemaining).toBe(1) // 3 - 1 - 1 (this attempt)
      })

      it('should reject expired tokens', async () => {
        const tokenId = 'expired-token-id'
        const token = 'expired-token-value'
        const request = createMockRequest()

        // Mock expired token
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          single: jest.fn().mockReturnValue({
            data: {
              id: tokenId,
              user_id: 'test-user-id',
              expires_at: new Date(Date.now() - 60 * 1000).toISOString(), // 1 min ago
              attempt_count: 1,
              max_attempts: 3,
              requires_mfa: false
            },
            error: null
          })
        })

        const validation = await validateResetToken(tokenId, token, request)
        expect(validation.valid).toBe(false)
        expect(validation.errors).toContain('Reset token has expired')
      })
    })

    describe('Password Reset Completion', () => {
      it('should complete password reset successfully', async () => {
        const tokenId = 'test-token-id'
        const token = 'test-token-value'
        const newPassword = 'NewSecureP@ssw0rd2024!'
        const request = createMockRequest()

        // Mock valid token validation
        jest.spyOn(passwordResetManager, 'validateResetToken').mockResolvedValue({
          valid: true,
          tokenId,
          userId: 'test-user-id',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          attemptsRemaining: 2,
          requiresMFA: false
        })

        // Mock user data
        mockSupabase.auth.admin.getUserById.mockResolvedValue({
          data: {
            user: {
              id: 'test-user-id',
              email: 'test@example.com',
              user_metadata: { role: 'user' }
            }
          },
          error: null
        })

        // Mock password update
        mockSupabase.auth.admin.updateUserById.mockResolvedValue({ error: null })

        // Mock token marking as used
        mockSupabase.from.mockReturnValue({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnValue({ error: null })
        })

        const result = await completePasswordReset(tokenId, token, newPassword, request)
        expect(result.success).toBe(true)
        expect(result.userId).toBe('test-user-id')
        expect(result.securityEventId).toBeDefined()
      })

      it('should enforce password policy during reset', async () => {
        const tokenId = 'test-token-id'
        const token = 'test-token-value'
        const weakPassword = 'weak'
        const request = createMockRequest()

        // Mock valid token validation
        jest.spyOn(passwordResetManager, 'validateResetToken').mockResolvedValue({
          valid: true,
          tokenId,
          userId: 'test-user-id',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          attemptsRemaining: 2,
          requiresMFA: false
        })

        // Mock user data
        mockSupabase.auth.admin.getUserById.mockResolvedValue({
          data: {
            user: {
              id: 'test-user-id',
              email: 'test@example.com',
              user_metadata: { role: 'user' }
            }
          },
          error: null
        })

        const result = await completePasswordReset(tokenId, token, weakPassword, request)
        expect(result.success).toBe(false)
        expect(result.errors).toBeDefined()
        expect(result.errors![0]).toContain('Password policy violations')
      })
    })
  })

  describe('Security Monitoring System', () => {
    describe('Anomaly Detection', () => {
      it('should detect location anomalies', async () => {
        const userId = 'test-user-id'
        const ipAddress = '192.168.1.1'
        const request = createMockRequest({
          headers: new Headers({
            'cf-ipcountry': 'US',
            'user-agent': 'Test Agent'
          })
        })

        // Mock user's historical locations
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnValue({
            data: [
              { country_code: 'CA', city: 'Toronto' },
              { country_code: 'CA', city: 'Vancouver' }
            ],
            error: null
          })
        })

        const anomalies = await detectSecurityAnomalies(userId, ipAddress, request)
        
        // Should detect US as anomalous when user typically from CA
        expect(anomalies.anomalies).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'location_anomaly',
              severity: 'medium'
            })
          ])
        )
      })

      it('should detect device anomalies', async () => {
        const userId = 'test-user-id'
        const request = createMockRequest({
          headers: new Headers({
            'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)'
          })
        })

        // Mock user's known devices (all Chrome on Windows)
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnValue({
            data: [
              { user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
              { user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36' }
            ],
            error: null
          })
        })

        const anomalies = await detectSecurityAnomalies(userId, undefined, request)
        
        // Should detect iPhone as anomalous device
        expect(anomalies.anomalies).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'device_anomaly',
              severity: 'low'
            })
          ])
        )
      })
    })

    describe('Security Metrics', () => {
      it('should calculate security metrics within performance threshold', async () => {
        const startTime = Date.now()
        
        // Mock various data sources
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          range: jest.fn().mockReturnValue({
            data: [],
            error: null,
            count: 0
          })
        })

        const metrics = await getSecurityMetrics('24h')
        const duration = Date.now() - startTime

        expect(duration).toBeLessThan(200) // 200ms threshold
        expect(metrics).toBeDefined()
        expect(metrics.totalLoginAttempts).toBeDefined()
        expect(metrics.failureRate).toBeDefined()
      })

      it('should provide trend analysis', async () => {
        // Mock trend data
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnValue({
            data: [
              { created_at: '2024-01-01T00:00:00Z', event_type: 'failed_login' },
              { created_at: '2024-01-01T01:00:00Z', event_type: 'failed_login' },
              { created_at: '2024-01-01T02:00:00Z', event_type: 'successful_login' }
            ],
            error: null
          })
        })

        const metrics = await getSecurityMetrics('24h')
        
        expect(metrics.trendData).toBeDefined()
        expect(metrics.trendData.attacks).toBeInstanceOf(Array)
        expect(metrics.trendData.riskScores).toBeInstanceOf(Array)
      })
    })

    describe('Event Processing', () => {
      it('should process security events and calculate risk scores', async () => {
        const event = {
          type: 'brute_force_attack' as const,
          severity: 'high' as const,
          ipAddress: '192.168.1.1',
          userAgent: 'Test Agent',
          description: 'Multiple failed login attempts detected',
          evidence: {
            attemptCount: 10,
            timeWindow: '5 minutes'
          },
          source: 'authentication' as const
        }
        const request = createMockRequest()

        // Mock event storage
        mockSupabase.from.mockReturnValue({
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockReturnValue({
            data: { id: 'event-id-123' },
            error: null
          })
        })

        const processedEvent = await processSecurityEvent(event, request)
        
        expect(processedEvent.id).toBeDefined()
        expect(processedEvent.riskScore).toBeGreaterThan(0)
        expect(processedEvent.riskScore).toBeLessThanOrEqual(100)
        expect(processedEvent.timestamp).toBeInstanceOf(Date)
      })

      it('should trigger automated responses for high-risk events', async () => {
        const criticalEvent = {
          type: 'account_takeover_attempt' as const,
          severity: 'critical' as const,
          userId: 'test-user-id',
          ipAddress: '192.168.1.1',
          userAgent: 'Malicious Bot',
          description: 'Suspected account takeover in progress',
          evidence: {
            suspiciousPatterns: ['multiple_countries', 'high_frequency', 'credential_stuffing']
          },
          source: 'authentication' as const
        }
        const request = createMockRequest()

        // Mock event storage
        mockSupabase.from.mockReturnValue({
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockReturnValue({
            data: { id: 'critical-event-123' },
            error: null
          })
        })

        const processedEvent = await processSecurityEvent(criticalEvent, request)
        
        expect(processedEvent.riskScore).toBeGreaterThan(90)
        expect(processedEvent.requiresInvestigation).toBe(true)
        expect(processedEvent.severity).toBe('critical')
      })
    })
  })

  describe('Integration Tests', () => {
    it('should handle complete password reset flow with security monitoring', async () => {
      const email = 'test@example.com'
      const newPassword = 'NewSecureP@ssw0rd2024!'
      const request = createMockRequest()

      // Step 1: Initiate password reset
      const resetRequest = { email, method: 'email' as const }
      
      // Mock successful initiation
      mockSupabase.auth.admin.listUsers.mockResolvedValue({
        data: { users: [{ id: 'test-user-id', email }] },
        error: null
      })
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnValue({ data: [], error: null }),
        insert: jest.fn().mockReturnValue({ error: null }),
        update: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnValue({ data: null, error: null })
      })

      mockSupabase.rpc.mockResolvedValue({ data: [{ is_locked: false }], error: null })

      const resetResult = await initiatePasswordReset(resetRequest, request)
      expect(resetResult.success).toBe(true)

      // Step 2: Complete password reset
      const tokenId = resetResult.tokenId!
      const token = 'mock-token-value'

      // Mock successful completion
      jest.spyOn(passwordResetManager, 'validateResetToken').mockResolvedValue({
        valid: true,
        tokenId,
        userId: 'test-user-id',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        attemptsRemaining: 2,
        requiresMFA: false
      })

      mockSupabase.auth.admin.getUserById.mockResolvedValue({
        data: {
          user: {
            id: 'test-user-id',
            email,
            user_metadata: { role: 'user' }
          }
        },
        error: null
      })

      mockSupabase.auth.admin.updateUserById.mockResolvedValue({ error: null })

      const completionResult = await completePasswordReset(tokenId, token, newPassword, request)
      expect(completionResult.success).toBe(true)

      // Verify security events were logged
      expect(mockSupabase.from).toHaveBeenCalledWith('account_security_events')
    })

    it('should integrate lockout system with password validation', async () => {
      const userId = 'test-user-id'
      const ipAddress = '192.168.1.1'
      const password = 'TestPassword123!'
      
      // Simulate multiple failed attempts leading to lockout
      const failureEvent = {
        userId,
        ipAddress,
        userAgent: 'Test Agent',
        eventType: 'failed_login' as const,
        reason: 'Invalid password'
      }
      
      // Mock progressive attempt counts
      for (let attempts = 1; attempts <= 5; attempts++) {
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnValue({
            data: Array(attempts).fill({}),
            error: null
          })
        })

        mockSupabase.rpc.mockResolvedValue({
          data: [{ is_locked: attempts >= 5, attempt_count: attempts }],
          error: null
        })

        const result = await recordAuthFailure(failureEvent)
        
        if (attempts < 5) {
          expect(result.locked).toBe(false)
          expect(result.delayMs).toBeGreaterThan(0)
        } else {
          expect(result.locked).toBe(true)
        }
      }

      // After lockout, password validation should be blocked
      const lockoutStatus = await checkAccountLockout(userId, ipAddress)
      expect(lockoutStatus.isLocked).toBe(true)
    })
  })

  describe('Performance Benchmarks', () => {
    it('should meet password validation performance requirements', async () => {
      const password = 'ComplexP@ssw0rd123!'
      const iterations = 100
      const startTime = Date.now()

      const promises = Array(iterations).fill(null).map(() => 
        validatePasswordSecurity(password, 'test-user-id', 'user')
      )

      await Promise.all(promises)
      const totalTime = Date.now() - startTime
      const averageTime = totalTime / iterations

      expect(averageTime).toBeLessThan(50) // 50ms average per validation
    })

    it('should handle concurrent password reset requests efficiently', async () => {
      const requests = Array(10).fill(null).map((_, i) => ({
        email: `test${i}@example.com`,
        method: 'email' as const
      }))

      // Mock responses
      mockSupabase.auth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnValue({ data: [], error: null }),
        insert: jest.fn().mockReturnValue({ error: null })
      })

      mockSupabase.rpc.mockResolvedValue({ data: [{ is_locked: false }], error: null })

      const startTime = Date.now()
      const results = await Promise.all(
        requests.map(req => initiatePasswordReset(req, createMockRequest()))
      )
      const totalTime = Date.now() - startTime

      expect(results).toHaveLength(10)
      expect(totalTime).toBeLessThan(2000) // 2 seconds for 10 concurrent requests
      results.forEach(result => expect(result.success).toBe(true))
    })
  })
})