/**
 * OAuth Configuration Tests
 * Epic 2 Story 2.3: Social Media Login Integration
 * 
 * Tests for OAuth provider configuration, PKCE generation,
 * and security validation functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { 
  OAuthConfigManager, 
  generateOAuthState, 
  isValidOAuthProvider,
  getOAuthButtonStyle,
  OAUTH_PROVIDER_CONFIGS
} from '@/lib/auth/oauth-config'

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        })),
        order: vi.fn(() => ({
          eq: vi.fn(() => ({}))
        }))
      }))
    }))
  }))
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabaseClient
}))

// Mock crypto for testing
const mockCrypto = {
  getRandomValues: vi.fn((array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256)
    }
    return array
  }),
  subtle: {
    digest: vi.fn(async (algorithm, data) => {
      // Simple mock hash
      return new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer
    })
  }
}

// @ts-ignore
global.crypto = mockCrypto

describe('OAuth Configuration', () => {
  let oauthConfig: OAuthConfigManager

  beforeEach(() => {
    oauthConfig = new OAuthConfigManager()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Provider Validation', () => {
    it('should validate supported OAuth providers', () => {
      expect(isValidOAuthProvider('google')).toBe(true)
      expect(isValidOAuthProvider('apple')).toBe(true)
      expect(isValidOAuthProvider('facebook')).toBe(true)
      expect(isValidOAuthProvider('github')).toBe(true)
      expect(isValidOAuthProvider('invalid')).toBe(false)
      expect(isValidOAuthProvider('')).toBe(false)
    })

    it('should return correct button styles for providers', () => {
      const googleStyle = getOAuthButtonStyle('google')
      expect(googleStyle.backgroundColor).toBe('#4285f4')
      expect(googleStyle.border).toBe('1px solid #dadce0')

      const appleStyle = getOAuthButtonStyle('apple')
      expect(appleStyle.backgroundColor).toBe('#000000')
      expect(appleStyle.color).toBe('#ffffff')
    })
  })

  describe('State Generation', () => {
    it('should generate secure OAuth state parameters', () => {
      const state1 = generateOAuthState()
      const state2 = generateOAuthState()
      
      expect(state1).toMatch(/^[a-f0-9]{64}$/)
      expect(state2).toMatch(/^[a-f0-9]{64}$/)
      expect(state1).not.toBe(state2)
    })
  })

  describe('Provider Configuration', () => {
    beforeEach(() => {
      // Mock successful database response
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({
                data: {
                  id: 'provider-id',
                  provider_name: 'google',
                  display_name: 'Google',
                  enabled: true,
                  auto_link_accounts: true,
                  require_email_verification: false,
                  button_text: 'Continue with Google'
                },
                error: null
              }))
            }))
          }))
        }))
      })
    })

    it('should get provider configuration from database', async () => {
      const config = await oauthConfig.getProviderConfig('google')
      
      expect(config).toBeDefined()
      expect(config?.provider_name).toBe('google')
      expect(config?.display_name).toBe('Google')
      expect(config?.enabled).toBe(true)
    })

    it('should return null for disabled providers', async () => {
      // Mock disabled provider
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({
                data: null,
                error: { message: 'Provider not found or disabled' }
              }))
            }))
          }))
        }))
      })

      const config = await oauthConfig.getProviderConfig('facebook')
      expect(config).toBeNull()
    })
  })

  describe('Authorization URL Generation', () => {
    beforeEach(() => {
      // Mock provider config
      vi.spyOn(oauthConfig, 'getProviderConfig').mockResolvedValue({
        id: 'google-id',
        provider_name: 'google',
        display_name: 'Google',
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        redirect_uri: 'https://example.com/callback',
        authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth',
        token_url: 'https://oauth2.googleapis.com/token',
        user_info_url: 'https://www.googleapis.com/oauth2/v2/userinfo',
        default_scopes: ['openid', 'email', 'profile'],
        optional_scopes: [],
        enabled: true,
        auto_link_accounts: true,
        require_email_verification: false,
        button_text: 'Continue with Google'
      })
    })

    it('should generate valid authorization URL for Google', async () => {
      const redirectUri = 'https://example.com/callback'
      const state = 'test-state'
      
      const authUrl = await oauthConfig.generateAuthorizationURL('google', redirectUri, state)
      
      expect(authUrl).toBeDefined()
      expect(authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth')
      expect(authUrl).toContain('client_id=test-client-id')
      expect(authUrl).toContain('redirect_uri=https%3A//example.com/callback')
      expect(authUrl).toContain('state=test-state')
      expect(authUrl).toContain('scope=openid%20email%20profile')
      expect(authUrl).toContain('response_type=code')
    })

    it('should include PKCE parameters for supported providers', async () => {
      const authUrl = await oauthConfig.generateAuthorizationURL('google', 'https://example.com/callback', 'test-state')
      
      expect(authUrl).toContain('code_challenge')
      expect(authUrl).toContain('code_challenge_method=S256')
    })

    it('should include provider-specific parameters', async () => {
      const authUrl = await oauthConfig.generateAuthorizationURL('google', 'https://example.com/callback', 'test-state')
      
      expect(authUrl).toContain('access_type=offline')
      expect(authUrl).toContain('prompt=consent')
    })

    it('should handle custom scopes', async () => {
      const customScopes = ['openid', 'email']
      const authUrl = await oauthConfig.generateAuthorizationURL('google', 'https://example.com/callback', 'test-state', customScopes)
      
      expect(authUrl).toContain('scope=openid%20email')
    })
  })

  describe('OAuth Callback Validation', () => {
    it('should validate state parameter', async () => {
      const result = await oauthConfig.validateOAuthCallback('google', 'test-code', 'state1', 'state2')
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid state parameter')
    })

    it('should validate authorization code format', async () => {
      const result = await oauthConfig.validateOAuthCallback('google', '', 'state', 'state')
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid authorization code')
    })

    it('should validate Google authorization codes', async () => {
      const validResult = await oauthConfig.validateOAuthCallback('google', 'valid-google-code', 'state', 'state')
      const invalidResult = await oauthConfig.validateOAuthCallback('google', 'short', 'state', 'state')
      
      expect(validResult.valid).toBe(true)
      expect(invalidResult.valid).toBe(false)
    })

    it('should validate GitHub authorization codes', async () => {
      const validCode = '0' * 20 // 20 character code
      const invalidCode = 'short'
      
      const validResult = await oauthConfig.validateOAuthCallback('github', validCode, 'state', 'state')
      const invalidResult = await oauthConfig.validateOAuthCallback('github', invalidCode, 'state', 'state')
      
      expect(validResult.valid).toBe(true)
      expect(invalidResult.valid).toBe(false)
      expect(invalidResult.error).toBe('Invalid GitHub authorization code format')
    })
  })

  describe('Token Exchange', () => {
    beforeEach(() => {
      // Mock provider config
      vi.spyOn(oauthConfig, 'getProviderConfig').mockResolvedValue({
        id: 'google-id',
        provider_name: 'google',
        display_name: 'Google',
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        redirect_uri: 'https://example.com/callback',
        authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth',
        token_url: 'https://oauth2.googleapis.com/token',
        user_info_url: 'https://www.googleapis.com/oauth2/v2/userinfo',
        default_scopes: ['openid', 'email', 'profile'],
        optional_scopes: [],
        enabled: true,
        auto_link_accounts: true,
        require_email_verification: false,
        button_text: 'Continue with Google'
      })
    })

    it('should exchange authorization code for tokens', async () => {
      // Mock successful token response
      const mockTokenResponse = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        id_token: 'mock-id-token',
        expires_in: 3600
      }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      })

      const tokenData = await oauthConfig.exchangeCodeForToken(
        'google',
        'test-code',
        'test-state',
        'https://example.com/callback'
      )

      expect(tokenData).toEqual(mockTokenResponse)
      expect(fetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded'
          })
        })
      )
    })

    it('should handle token exchange failures', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      })

      const tokenData = await oauthConfig.exchangeCodeForToken(
        'google',
        'invalid-code',
        'test-state',
        'https://example.com/callback'
      )

      expect(tokenData).toBeNull()
    })
  })

  describe('User Info Retrieval', () => {
    beforeEach(() => {
      vi.spyOn(oauthConfig, 'getProviderConfig').mockResolvedValue({
        id: 'google-id',
        provider_name: 'google',
        display_name: 'Google',
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        redirect_uri: 'https://example.com/callback',
        authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth',
        token_url: 'https://oauth2.googleapis.com/token',
        user_info_url: 'https://www.googleapis.com/oauth2/v2/userinfo',
        default_scopes: ['openid', 'email', 'profile'],
        optional_scopes: [],
        enabled: true,
        auto_link_accounts: true,
        require_email_verification: false,
        button_text: 'Continue with Google'
      })
    })

    it('should retrieve user info from Google', async () => {
      const mockUserInfo = {
        id: '123456789',
        email: 'user@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        verified_email: true
      }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserInfo)
      })

      const userInfo = await oauthConfig.getUserInfo('google', 'access-token')

      expect(userInfo).toEqual(mockUserInfo)
      expect(fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer access-token'
          })
        })
      )
    })

    it('should handle user info retrieval failures', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401
      })

      const userInfo = await oauthConfig.getUserInfo('google', 'invalid-token')

      expect(userInfo).toBeNull()
    })

    it('should use query parameters for Facebook', async () => {
      // Mock Facebook config
      vi.spyOn(oauthConfig, 'getProviderConfig').mockResolvedValue({
        id: 'facebook-id',
        provider_name: 'facebook',
        display_name: 'Facebook',
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        redirect_uri: 'https://example.com/callback',
        authorization_url: 'https://www.facebook.com/v18.0/dialog/oauth',
        token_url: 'https://graph.facebook.com/v18.0/oauth/access_token',
        user_info_url: 'https://graph.facebook.com/me',
        default_scopes: ['email', 'public_profile'],
        optional_scopes: [],
        enabled: true,
        auto_link_accounts: true,
        require_email_verification: true,
        button_text: 'Continue with Facebook'
      })

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'fb123', name: 'Test User' })
      })

      await oauthConfig.getUserInfo('facebook', 'access-token')

      expect(fetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/me?access_token=access-token&fields=id,name,email,picture',
        expect.any(Object)
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle provider configuration errors gracefully', async () => {
      // Mock database error
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({
                data: null,
                error: { message: 'Database connection failed' }
              }))
            }))
          }))
        }))
      })

      const config = await oauthConfig.getProviderConfig('google')
      expect(config).toBeNull()
    })

    it('should throw error for unconfigured providers in auth URL generation', async () => {
      vi.spyOn(oauthConfig, 'getProviderConfig').mockResolvedValue(null)

      await expect(
        oauthConfig.generateAuthorizationURL('google', 'https://example.com/callback', 'state')
      ).rejects.toThrow('OAuth provider google not configured or disabled')
    })
  })
})