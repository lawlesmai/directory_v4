/**
 * Social Authentication Integration Tests
 * Epic 2 Story 2.3: Social Media Login Integration
 * 
 * End-to-end integration tests for the complete social authentication flow
 * including OAuth initiation, callback handling, and account management.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Mock environment variables
process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'
process.env.GOOGLE_CLIENT_ID = 'mock-google-client-id'
process.env.GOOGLE_CLIENT_SECRET = 'mock-google-client-secret'

// Mock Supabase client with comprehensive responses
const mockSupabaseClient = {
  from: vi.fn((table) => {
    const mockMethods = {
      select: vi.fn(() => mockMethods),
      eq: vi.fn(() => mockMethods),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      insert: vi.fn(() => mockMethods),
      update: vi.fn(() => mockMethods),
      order: vi.fn(() => mockMethods),
      limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      gte: vi.fn(() => mockMethods),
      neq: vi.fn(() => mockMethods),
      is: vi.fn(() => mockMethods),
      not: vi.fn(() => mockMethods)
    }
    return mockMethods
  }),
  auth: {
    admin: {
      createUser: vi.fn(),
      getUserById: vi.fn(),
      generateLink: vi.fn()
    },
    getSession: vi.fn()
  },
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
          return '203.0.113.1'
        case 'cf-ipcountry':
          return 'US'
        default:
          return null
      }
    })
  })
}))

// Import the modules after mocking
const { GET: oauthInitiationHandler } = await import('@/app/api/auth/oauth/[provider]/route')
const { GET: oauthCallbackHandler } = await import('@/app/api/auth/oauth/[provider]/callback/route')

describe('Social Authentication Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default successful responses
    mockSupabaseClient.from.mockImplementation((table) => {
      switch (table) {
        case 'oauth_providers':
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(() => Promise.resolve({
                    data: {
                      id: 'provider-123',
                      provider_name: 'google',
                      enabled: true,
                      auto_link_accounts: true,
                      require_email_verification: false
                    },
                    error: null
                  }))
                }))
              }))
            }))
          }
        
        case 'auth_audit_logs':
          return {
            insert: vi.fn(() => Promise.resolve({ data: {}, error: null }))
          }
        
        default:
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: null, error: null })),
                maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null }))
              }))
            })),
            insert: vi.fn(() => Promise.resolve({ data: {}, error: null }))
          }
      }
    })

    // Mock rate limit check
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

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('OAuth Initiation Flow', () => {
    it('should successfully initiate Google OAuth flow', async () => {
      const request = new NextRequest('https://example.com/api/auth/oauth/google?redirect_to=/dashboard')
      
      const response = await oauthInitiationHandler(request, { params: { provider: 'google' } })

      expect(response.status).toBe(302) // Redirect
      
      const location = response.headers.get('location')
      expect(location).toContain('accounts.google.com/o/oauth2/v2/auth')
      expect(location).toContain('client_id=')
      expect(location).toContain('redirect_uri=')
      expect(location).toContain('state=')
      expect(location).toContain('scope=')
      
      // Check that state cookie is set
      const cookies = response.headers.get('set-cookie')
      expect(cookies).toContain('oauth_state_google=')
    })

    it('should reject invalid OAuth providers', async () => {
      const request = new NextRequest('https://example.com/api/auth/oauth/invalid')
      
      const response = await oauthInitiationHandler(request, { params: { provider: 'invalid' } })

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('Invalid OAuth provider')
      expect(body.code).toBe('INVALID_PROVIDER')
    })

    it('should handle custom redirect URLs', async () => {
      const request = new NextRequest('https://example.com/api/auth/oauth/google?redirect_to=/profile')
      
      const response = await oauthInitiationHandler(request, { params: { provider: 'google' } })

      expect(response.status).toBe(302)
      
      // Verify state contains redirect URL
      const cookies = response.headers.get('set-cookie')
      const stateMatch = cookies?.match(/oauth_state_google=([^;]+)/)
      if (stateMatch) {
        const stateValue = decodeURIComponent(stateMatch[1])
        const stateData = JSON.parse(atob(stateValue))
        expect(stateData.redirectTo).toBe('/profile')
      }
    })

    it('should handle disabled OAuth providers', async () => {
      // Mock disabled provider
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'oauth_providers') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(() => Promise.resolve({
                    data: null,
                    error: { message: 'Provider disabled' }
                  }))
                }))
              }))
            }))
          }
        }
        return {
          insert: vi.fn(() => Promise.resolve({ data: {}, error: null }))
        }
      })

      const request = new NextRequest('https://example.com/api/auth/oauth/facebook')
      
      const response = await oauthInitiationHandler(request, { params: { provider: 'facebook' } })

      expect(response.status).toBe(503)
      const body = await response.json()
      expect(body.code).toBe('PROVIDER_NOT_CONFIGURED')
    })

    it('should handle rate limiting', async () => {
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

      const request = new NextRequest('https://example.com/api/auth/oauth/google')
      
      const response = await oauthInitiationHandler(request, { params: { provider: 'google' } })

      expect(response.status).toBe(302) // Should redirect to error page
      const location = response.headers.get('location')
      expect(location).toContain('/auth/error')
      expect(location).toContain('error=RATE_LIMIT_EXCEEDED')
    })
  })

  describe('OAuth Callback Flow', () => {
    const mockProviderUserInfo = {
      id: '123456789',
      email: 'user@example.com',
      name: 'Test User',
      picture: 'https://example.com/avatar.jpg',
      verified_email: true
    }

    const mockTokenResponse = {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      id_token: 'mock-id-token',
      expires_in: 3600
    }

    beforeEach(() => {
      // Mock successful token exchange
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProviderUserInfo)
        })

      // Mock user creation
      mockSupabaseClient.auth.admin.createUser.mockResolvedValue({
        user: { id: 'new-user-123' },
        error: null
      })

      // Mock session generation
      mockSupabaseClient.auth.admin.generateLink.mockResolvedValue({
        properties: { access_token: 'session-token' },
        error: null
      })
    })

    it('should handle successful OAuth callback for new user', async () => {
      const state = btoa(JSON.stringify({
        provider: 'google',
        redirectTo: '/dashboard',
        timestamp: Date.now()
      }))

      const request = new NextRequest(
        `https://example.com/api/auth/oauth/google/callback?code=auth-code&state=${state}`,
        {
          headers: {
            cookie: `oauth_state_google=${state}`
          }
        }
      )

      // Mock successful provider configuration and new user flow
      mockSupabaseClient.from.mockImplementation((table) => {
        switch (table) {
          case 'profiles':
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(() => Promise.resolve({
                    data: null, // No existing user
                    error: null
                  }))
                }))
              })),
              insert: vi.fn(() => Promise.resolve({ data: {}, error: null }))
            }
          
          case 'roles':
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(() => Promise.resolve({
                    data: { id: 'user-role-id' },
                    error: null
                  }))
                }))
              }))
            }
          
          case 'user_roles':
            return {
              insert: vi.fn(() => Promise.resolve({ data: {}, error: null }))
            }
          
          case 'user_oauth_connections':
            return {
              insert: vi.fn(() => Promise.resolve({ data: {}, error: null }))
            }
          
          default:
            return {
              insert: vi.fn(() => Promise.resolve({ data: {}, error: null }))
            }
        }
      })

      const response = await oauthCallbackHandler(request, { params: { provider: 'google' } })

      expect(response.status).toBe(302) // Redirect to dashboard
      
      const location = response.headers.get('location')
      expect(location).toContain('/dashboard')

      // Verify user creation was called
      expect(mockSupabaseClient.auth.admin.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: mockProviderUserInfo.email,
          email_confirm: true
        })
      )
    })

    it('should handle OAuth callback for existing user', async () => {
      const state = btoa(JSON.stringify({
        provider: 'google',
        redirectTo: '/profile',
        timestamp: Date.now()
      }))

      const request = new NextRequest(
        `https://example.com/api/auth/oauth/google/callback?code=auth-code&state=${state}`,
        {
          headers: {
            cookie: `oauth_state_google=${state}`
          }
        }
      )

      // Mock existing OAuth connection
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'user_oauth_connections') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(() => Promise.resolve({
                    data: {
                      user_id: 'existing-user-123',
                      profiles: { id: 'existing-user-123' }
                    },
                    error: null
                  }))
                }))
              })),
              update: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({ data: {}, error: null }))
              }))
            }))
          }
        }
        return {
          insert: vi.fn(() => Promise.resolve({ data: {}, error: null }))
        }
      })

      const response = await oauthCallbackHandler(request, { params: { provider: 'google' } })

      expect(response.status).toBe(302)
      
      const location = response.headers.get('location')
      expect(location).toContain('/profile')

      // Verify user creation was NOT called for existing user
      expect(mockSupabaseClient.auth.admin.createUser).not.toHaveBeenCalled()
    })

    it('should handle OAuth error responses', async () => {
      const request = new NextRequest(
        'https://example.com/api/auth/oauth/google/callback?error=access_denied&error_description=User%20denied%20access&state=test-state'
      )

      const response = await oauthCallbackHandler(request, { params: { provider: 'google' } })

      expect(response.status).toBe(302) // Redirect to error page
      
      const location = response.headers.get('location')
      expect(location).toContain('/auth/error')
      expect(location).toContain('error=OAUTH_ERROR')
    })

    it('should validate state parameter to prevent CSRF', async () => {
      const request = new NextRequest(
        'https://example.com/api/auth/oauth/google/callback?code=auth-code&state=invalid-state',
        {
          headers: {
            cookie: 'oauth_state_google=different-state'
          }
        }
      )

      const response = await oauthCallbackHandler(request, { params: { provider: 'google' } })

      expect(response.status).toBe(302) // Redirect to error page
      
      const location = response.headers.get('location')
      expect(location).toContain('/auth/error')
      expect(location).toContain('error=CSRF_VIOLATION')
    })

    it('should handle token exchange failures', async () => {
      // Mock failed token exchange
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      })

      const state = btoa(JSON.stringify({
        provider: 'google',
        redirectTo: '/dashboard',
        timestamp: Date.now()
      }))

      const request = new NextRequest(
        `https://example.com/api/auth/oauth/google/callback?code=invalid-code&state=${state}`,
        {
          headers: {
            cookie: `oauth_state_google=${state}`
          }
        }
      )

      const response = await oauthCallbackHandler(request, { params: { provider: 'google' } })

      expect(response.status).toBe(302) // Redirect to error page
      
      const location = response.headers.get('location')
      expect(location).toContain('/auth/error')
      expect(location).toContain('error=TOKEN_EXCHANGE_FAILED')
    })

    it('should handle user info retrieval failures', async () => {
      // Mock successful token exchange but failed user info
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401
        })

      const state = btoa(JSON.stringify({
        provider: 'google',
        redirectTo: '/dashboard',
        timestamp: Date.now()
      }))

      const request = new NextRequest(
        `https://example.com/api/auth/oauth/google/callback?code=auth-code&state=${state}`,
        {
          headers: {
            cookie: `oauth_state_google=${state}`
          }
        }
      )

      const response = await oauthCallbackHandler(request, { params: { provider: 'google' } })

      expect(response.status).toBe(302) // Redirect to error page
      
      const location = response.headers.get('location')
      expect(location).toContain('/auth/error')
      expect(location).toContain('error=USER_INFO_FAILED')
    })
  })

  describe('Security Integration', () => {
    it('should block suspicious requests', async () => {
      // Mock high-risk validation result
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [{
          allowed: false,
          current_attempts: 15,
          window_end: new Date(Date.now() + 3600000).toISOString(),
          blocked_until: new Date(Date.now() + 3600000).toISOString()
        }],
        error: null
      })

      const request = new NextRequest('https://example.com/api/auth/oauth/google')
      
      const response = await oauthInitiationHandler(request, { params: { provider: 'google' } })

      expect(response.status).toBe(302) // Redirect to error
      const location = response.headers.get('location')
      expect(location).toContain('/auth/error')
    })

    it('should log all authentication events', async () => {
      const request = new NextRequest('https://example.com/api/auth/oauth/google')
      
      await oauthInitiationHandler(request, { params: { provider: 'google' } })

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('auth_audit_logs')
    })
  })

  describe('Error Handling Integration', () => {
    it('should provide detailed error information', async () => {
      // Mock provider configuration error
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'oauth_providers') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(() => Promise.resolve({
                    data: null,
                    error: { message: 'Provider not found' }
                  }))
                }))
              }))
            }))
          }
        }
        return {
          insert: vi.fn(() => Promise.resolve({ data: {}, error: null }))
        }
      })

      const request = new NextRequest('https://example.com/api/auth/oauth/google')
      
      const response = await oauthInitiationHandler(request, { params: { provider: 'google' } })

      expect(response.status).toBe(503)
      
      const body = await response.json()
      expect(body.error).toBeDefined()
      expect(body.code).toBe('PROVIDER_NOT_CONFIGURED')
    })

    it('should handle network errors gracefully', async () => {
      // Mock network error during token exchange
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const state = btoa(JSON.stringify({
        provider: 'google',
        redirectTo: '/dashboard',
        timestamp: Date.now()
      }))

      const request = new NextRequest(
        `https://example.com/api/auth/oauth/google/callback?code=auth-code&state=${state}`,
        {
          headers: {
            cookie: `oauth_state_google=${state}`
          }
        }
      )

      const response = await oauthCallbackHandler(request, { params: { provider: 'google' } })

      expect(response.status).toBe(302) // Should redirect to error page
      
      const location = response.headers.get('location')
      expect(location).toContain('/auth/error')
    })
  })

  describe('Cross-Provider Consistency', () => {
    const providers = ['google', 'apple', 'facebook', 'github']

    it.each(providers)('should handle %s provider consistently', async (provider) => {
      const request = new NextRequest(`https://example.com/api/auth/oauth/${provider}`)
      
      const response = await oauthInitiationHandler(request, { params: { provider } })

      if (provider === 'google') {
        expect(response.status).toBe(302) // Configured provider
      } else {
        // Other providers might not be configured in test
        expect([302, 503]).toContain(response.status)
      }
    })
  })
})