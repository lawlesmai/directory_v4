/**
 * Security Validator Tests
 * Epic 2 Story 2.3: Social Media Login Integration
 * 
 * Tests for OAuth security validation, threat detection, and monitoring.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { 
  OAuthSecurityValidator,
  validateOAuthSecurity
} from '@/lib/auth/security-validator'

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
          gte: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({
              data: [],
              error: null
            }))
          }))
        })),
        gte: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({
            data: [],
            error: null
          }))
        }))
      }))
    })),
    insert: vi.fn(() => Promise.resolve({
      data: {},
      error: null
    }))
  })),
  rpc: vi.fn()
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabaseClient
}))

vi.mock('next/headers', () => ({
  headers: () => ({
    get: vi.fn((name) => {
      switch (name) {
        case 'user-agent':
          return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        case 'x-forwarded-for':
          return '192.168.1.100'
        case 'cf-ipcountry':
          return 'US'
        default:
          return null
      }
    })
  })
}))

describe('OAuth Security Validator', () => {
  let securityValidator: OAuthSecurityValidator
  let mockRequest: NextRequest

  beforeEach(() => {
    securityValidator = new OAuthSecurityValidator()
    mockRequest = new NextRequest('https://example.com/oauth/google', {
      method: 'GET',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'x-forwarded-for': '192.168.1.100',
        'cf-ipcountry': 'US'
      }
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Rate Limit Checking', () => {
    beforeEach(() => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [{
          allowed: true,
          current_attempts: 1,
          window_end: new Date(Date.now() + 3600000).toISOString(),
          blocked_until: null
        }],
        error: null
      })
    })

    it('should allow requests within rate limits', async () => {
      const result = await securityValidator.checkRateLimit('192.168.1.100', 'google', 'initiation')

      expect(result.allowed).toBe(true)
      expect(result.attemptsRemaining).toBeGreaterThan(0)
      expect(result.resetTime).toBeInstanceOf(Date)
    })

    it('should block requests exceeding rate limits', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [{
          allowed: false,
          current_attempts: 10,
          window_end: new Date(Date.now() + 3600000).toISOString(),
          blocked_until: new Date(Date.now() + 900000).toISOString()
        }],
        error: null
      })

      const result = await securityValidator.checkRateLimit('192.168.1.100', 'google', 'initiation')

      expect(result.allowed).toBe(false)
      expect(result.attemptsRemaining).toBe(0)
      expect(result.blockedUntil).toBeInstanceOf(Date)
    })

    it('should handle different rate limits for different actions', async () => {
      await securityValidator.checkRateLimit('192.168.1.100', 'google', 'callback')

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'check_oauth_rate_limit',
        expect.objectContaining({
          p_action: 'callback',
          p_max_attempts: 5, // Callback has lower limit
          p_window_minutes: 15 // Callback has shorter window
        })
      )
    })

    it('should use user-specific rate limiting when user ID provided', async () => {
      await securityValidator.checkRateLimit('192.168.1.100', 'google', 'initiation', 'user-123')

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'check_oauth_rate_limit',
        expect.objectContaining({
          p_identifier: 'user-123:192.168.1.100',
          p_identifier_type: 'user'
        })
      )
    })

    it('should handle rate limit check failures gracefully', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      })

      const result = await securityValidator.checkRateLimit('192.168.1.100', 'google', 'initiation')

      // Should fail open for availability
      expect(result.allowed).toBe(true)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('oauth_security_incidents')
    })
  })

  describe('IP Address Validation', () => {
    beforeEach(() => {
      // Mock no blocked IP by default
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'security_events') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(() => Promise.resolve({
                      data: null,
                      error: null
                    }))
                  }))
                }))
              }))
            }))
          }
        }
        if (table === 'auth_audit_logs') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  gte: vi.fn(() => ({
                    limit: vi.fn(() => Promise.resolve({
                      data: [],
                      error: null
                    }))
                  }))
                }))
              }))
            }))
          }
        }
        return {
          select: vi.fn(() => ({})),
          insert: vi.fn(() => ({}))
        }
      })
    })

    it('should allow requests from normal IP addresses', async () => {
      const result = await securityValidator.validateIPAddress('203.0.113.1', 'google')

      expect(result.allowed).toBe(true)
      expect(result.riskLevel).toBe('low')
    })

    it('should block requests from blocked IP addresses', async () => {
      // Mock blocked IP
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'security_events') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(() => Promise.resolve({
                      data: { id: 'blocked-ip-record' },
                      error: null
                    }))
                  }))
                }))
              }))
            }))
          }
        }
        return {
          select: vi.fn(() => ({})),
          insert: vi.fn(() => ({}))
        }
      })

      const result = await securityValidator.validateIPAddress('192.168.1.1', 'google')

      expect(result.allowed).toBe(false)
      expect(result.riskLevel).toBe('critical')
      expect(result.reasons).toContain('IP address is blocked')
    })

    it('should detect VPN/proxy usage', async () => {
      const result = await securityValidator.validateIPAddress('192.168.1.100', 'google')

      expect(result.riskLevel).toBe('medium')
      expect(result.reasons).toContain('VPN or proxy detected')
    })

    it('should flag IPs with multiple recent failures', async () => {
      // Mock multiple failed attempts
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'security_events') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(() => Promise.resolve({
                      data: null,
                      error: null
                    }))
                  }))
                }))
              }))
            }))
          }
        }
        if (table === 'auth_audit_logs') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  gte: vi.fn(() => ({
                    limit: vi.fn(() => Promise.resolve({
                      data: Array(6).fill({ id: 'failed-attempt' }), // 6 failures > 5 threshold
                      error: null
                    }))
                  }))
                }))
              }))
            }))
          }
        }
        return {
          select: vi.fn(() => ({})),
          insert: vi.fn(() => ({}))
        }
      })

      const result = await securityValidator.validateIPAddress('203.0.113.1', 'google')

      expect(result.riskLevel).toBe('medium')
      expect(result.reasons).toContain('Multiple recent failed attempts from IP')
    })
  })

  describe('User Agent Validation', () => {
    it('should allow normal browser user agents', async () => {
      const normalUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      
      const result = await securityValidator.validateUserAgent(normalUserAgent, 'google')

      expect(result.allowed).toBe(true)
      expect(result.riskLevel).toBe('low')
    })

    it('should flag missing or short user agents', async () => {
      const result = await securityValidator.validateUserAgent('short', 'google')

      expect(result.riskLevel).toBe('medium')
      expect(result.reasons).toContain('Missing or too short user agent')
    })

    it('should detect bot user agents', async () => {
      const botUserAgent = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      
      const result = await securityValidator.validateUserAgent(botUserAgent, 'google')

      expect(result.riskLevel).toBe('high')
      expect(result.reasons).toContain('Bot or automated tool detected')
      expect(result.actionRequired).toBe('admin_review')
    })

    it('should flag outdated browsers', async () => {
      const oldUserAgent = 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)'
      
      const result = await securityValidator.validateUserAgent(oldUserAgent, 'google')

      expect(result.riskLevel).toBe('medium')
      expect(result.reasons).toContain('Outdated browser detected')
    })

    it('should detect common automation tools', async () => {
      const automationTools = ['curl/7.68.0', 'python-requests/2.25.1', 'node-fetch/2.6.1']

      for (const userAgent of automationTools) {
        const result = await securityValidator.validateUserAgent(userAgent, 'google')
        
        expect(result.riskLevel).toBe('high')
        expect(result.reasons).toContain('Bot or automated tool detected')
      }
    })
  })

  describe('Suspicious Pattern Detection', () => {
    it('should allow normal authentication patterns', async () => {
      const metadata = {
        state: btoa(JSON.stringify({
          provider: 'google',
          timestamp: Date.now() - 5000, // 5 seconds ago
          nonce: 'abc123'
        })),
        initiationTime: Date.now() - 10000 // 10 seconds ago
      }

      const result = await securityValidator.checkSuspiciousPatterns(metadata, 'google', 'user-123')

      expect(result.allowed).toBe(true)
      expect(result.riskLevel).toBe('low')
    })

    it('should detect rapid provider switching', async () => {
      // Mock recent provider switches
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'auth_audit_logs') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    gte: vi.fn(() => ({
                      order: vi.fn(() => ({
                        limit: vi.fn(() => Promise.resolve({
                          data: [
                            { event_data: { provider: 'google' } },
                            { event_data: { provider: 'facebook' } },
                            { event_data: { provider: 'github' } }
                          ],
                          error: null
                        }))
                      }))
                    }))
                  }))
                }))
              }))
            }))
          }
        }
        return {
          select: vi.fn(() => ({})),
          insert: vi.fn(() => ({}))
        }
      })

      const metadata = { state: null }

      const result = await securityValidator.checkSuspiciousPatterns(metadata, 'apple', 'user-123')

      expect(result.riskLevel).toBe('medium')
      expect(result.reasons).toContain('Rapid OAuth provider switching detected')
    })

    it('should detect suspicious OAuth state timestamps', async () => {
      const metadata = {
        state: btoa(JSON.stringify({
          provider: 'google',
          timestamp: Date.now() - 20 * 60 * 1000, // 20 minutes ago (> 15 min limit)
          nonce: 'abc123'
        }))
      }

      const result = await securityValidator.checkSuspiciousPatterns(metadata, 'google')

      expect(result.riskLevel).toBe('high')
      expect(result.reasons).toContain('Suspicious OAuth state timestamp')
    })

    it('should detect malformed OAuth state', async () => {
      const metadata = {
        state: 'invalid-base64-!@#$%'
      }

      const result = await securityValidator.checkSuspiciousPatterns(metadata, 'google')

      expect(result.riskLevel).toBe('high')
      expect(result.reasons).toContain('Malformed OAuth state parameter')
    })

    it('should detect suspiciously fast OAuth completion', async () => {
      const metadata = {
        initiationTime: Date.now() - 1000 // Only 1 second ago
      }

      const result = await securityValidator.checkSuspiciousPatterns(metadata, 'google')

      expect(result.riskLevel).toBe('high')
      expect(result.reasons).toContain('Suspiciously fast OAuth completion')
    })
  })

  describe('Geolocation Validation', () => {
    const mockRecentLogins = [
      { country_code: 'US', city: 'New York' },
      { country_code: 'US', city: 'Los Angeles' },
      { country_code: 'CA', city: 'Toronto' }
    ]

    beforeEach(() => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'user_sessions') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                not: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(() => Promise.resolve({
                      data: mockRecentLogins,
                      error: null
                    }))
                  }))
                }))
              }))
            }))
          }
        }
        return {
          select: vi.fn(() => ({})),
          insert: vi.fn(() => ({}))
        }
      })
    })

    it('should allow logins from familiar countries', async () => {
      const metadata = {
        country_code: 'US'
      }

      const result = await securityValidator.validateGeolocation('user-123', metadata, 'google')

      expect(result.allowed).toBe(true)
      expect(result.riskLevel).toBe('low')
    })

    it('should flag logins from new countries', async () => {
      const metadata = {
        country_code: 'FR' // France - not in recent logins
      }

      const result = await securityValidator.validateGeolocation('user-123', metadata, 'google')

      expect(result.riskLevel).toBe('medium')
      expect(result.reasons).toContain('Login from new country')
    })

    it('should flag logins from high-risk countries', async () => {
      const metadata = {
        country_code: 'CN' // China - in high-risk list
      }

      const result = await securityValidator.validateGeolocation('user-123', metadata, 'google')

      expect(result.riskLevel).toBe('high')
      expect(result.reasons).toContain('Login from high-risk country')
      expect(result.actionRequired).toBe('mfa_required')
    })

    it('should detect rapid geolocation changes', async () => {
      const metadata = {
        country_code: 'RU' // Russia - different from recent US login
      }

      const result = await securityValidator.validateGeolocation('user-123', metadata, 'google')

      expect(result.riskLevel).toBe('high')
      expect(result.reasons).toContain('Rapid geolocation change detected')
    })

    it('should handle users with no login history', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'user_sessions') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                not: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(() => Promise.resolve({
                      data: [],
                      error: null
                    }))
                  }))
                }))
              }))
            }))
          }
        }
        return {
          select: vi.fn(() => ({})),
          insert: vi.fn(() => ({}))
        }
      })

      const metadata = {
        country_code: 'US'
      }

      const result = await securityValidator.validateGeolocation('user-123', metadata, 'google')

      expect(result.allowed).toBe(true)
      expect(result.riskLevel).toBe('low')
    })
  })

  describe('Overall OAuth Request Validation', () => {
    beforeEach(() => {
      // Mock successful rate limit check
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [{
          allowed: true,
          current_attempts: 1,
          window_end: new Date(Date.now() + 3600000).toISOString(),
          blocked_until: null
        }],
        error: null
      })

      // Mock normal security responses
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => Promise.resolve({
                data: null,
                error: null
              })),
              gte: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve({
                  data: [],
                  error: null
                })),
                order: vi.fn(() => ({
                  limit: vi.fn(() => Promise.resolve({
                    data: [],
                    error: null
                  }))
                }))
              }))
            }))
          })),
          not: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({
                data: [],
                error: null
              }))
            }))
          }))
        })),
        insert: vi.fn(() => Promise.resolve({
          data: {},
          error: null
        }))
      }))
    })

    it('should allow low-risk OAuth requests', async () => {
      const result = await securityValidator.validateOAuthRequest('google', mockRequest)

      expect(result.allowed).toBe(true)
      expect(result.riskLevel).toBe('low')
      expect(result.actionRequired).toBeUndefined()
    })

    it('should block high-risk requests', async () => {
      // Mock rate limit exceeded
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [{
          allowed: false,
          current_attempts: 10,
          window_end: new Date(Date.now() + 3600000).toISOString(),
          blocked_until: new Date(Date.now() + 900000).toISOString()
        }],
        error: null
      })

      const result = await securityValidator.validateOAuthRequest('google', mockRequest)

      expect(result.allowed).toBe(false)
      expect(result.riskLevel).toBe('high')
      expect(result.reasons).toContain('Rate limit exceeded')
      expect(result.actionRequired).toBe('rate_limit')
    })

    it('should require MFA for medium-high risk requests', async () => {
      // Create request with bot user agent
      const botRequest = new NextRequest('https://example.com/oauth/google', {
        method: 'GET',
        headers: {
          'user-agent': 'curl/7.68.0',
          'x-forwarded-for': '192.168.1.100'
        }
      })

      const result = await securityValidator.validateOAuthRequest('google', botRequest)

      expect(result.allowed).toBe(false) // Bot detected
      expect(result.riskLevel).toBe('high')
      expect(result.actionRequired).toBe('admin_review')
    })

    it('should log security validation results', async () => {
      await securityValidator.validateOAuthRequest('google', mockRequest)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('auth_audit_logs')
    })
  })

  describe('Security Incident Reporting', () => {
    it('should report security incidents', async () => {
      const incident = {
        type: 'suspicious_login',
        severity: 'high' as const,
        description: 'Multiple rapid login attempts detected',
        provider: 'google' as const,
        userId: 'user-123',
        ipAddress: '192.168.1.100',
        rawData: { attempts: 10 }
      }

      await securityValidator.reportSecurityIncident(incident)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('oauth_security_incidents')
    })

    it('should auto-notify for critical incidents', async () => {
      const criticalIncident = {
        type: 'account_takeover_attempt',
        severity: 'critical' as const,
        description: 'Potential account takeover detected',
        provider: 'facebook' as const,
        userId: 'user-456',
        ipAddress: '10.0.0.1'
      }

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await securityValidator.reportSecurityIncident(criticalIncident)

      expect(consoleSpy).toHaveBeenCalledWith('CRITICAL SECURITY INCIDENT:', criticalIncident)
      
      consoleSpy.mockRestore()
    })
  })

  describe('Utility Function', () => {
    it('should validate OAuth security using utility function', async () => {
      const result = await validateOAuthSecurity('google', mockRequest, 'user-123')

      expect(result).toBeDefined()
      expect(typeof result.allowed).toBe('boolean')
      expect(typeof result.riskLevel).toBe('string')
    })
  })
})