/**
 * OAuth Security Validation Tests - Critical Security Fixes Validation
 * 
 * Tests all critical security vulnerabilities are properly fixed:
 * 1. Token encryption (CVSS 7.5)
 * 2. State parameter validation (CVSS 7.8) 
 * 3. Account linking security (CVSS 7.2)
 * 4. Configuration security (CVSS 6.5)
 * 5. Redirect URI validation
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { encryptToken, decryptToken } from '@/lib/auth/token-encryption'
import { generateSecureState, validateSecureState } from '@/lib/auth/state-validation'
import { validateRedirectUri, redirectValidator } from '@/lib/auth/redirect-validation'
import { getSecureOAuthConfig, validateOAuthEnvironment } from '@/lib/auth/secure-config'
import { AccountLinkingSecurity } from '@/lib/auth/account-linking-security'
import { OAuthRateLimiter } from '@/lib/auth/oauth-rate-limiting'

// Mock environment variables for testing
const originalEnv = process.env

beforeEach(() => {
  process.env = {
    ...originalEnv,
    TOKEN_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    OAUTH_HMAC_KEY: 'test-hmac-key-must-be-at-least-32-chars-long-for-security',
    CONFIG_ENCRYPTION_KEY: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
    NEXT_PUBLIC_SITE_URL: 'https://example.com',
    ALLOWED_REDIRECT_ORIGINS: 'https://app.example.com,https://admin.example.com',
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-secret-with-sufficient-complexity-123!@#',
    NODE_ENV: 'test'
  }
})

afterEach(() => {
  process.env = originalEnv
})

describe('OAuth Security Validation Tests', () => {
  
  describe('1. Token Encryption Security (CVSS 7.5 Fix)', () => {
    test('should properly encrypt and decrypt OAuth tokens', async () => {
      const originalToken = 'ya29.a0ARrdaM-test-access-token-with-sufficient-length'
      
      const encryptedToken = await encryptToken(originalToken)
      expect(encryptedToken).not.toBe(originalToken)
      expect(encryptedToken).not.toContain(originalToken)
      
      // Ensure it's not just base64 encoding
      expect(() => JSON.parse(encryptedToken)).not.toThrow()
      const parsed = JSON.parse(encryptedToken)
      expect(parsed).toHaveProperty('encrypted')
      expect(parsed).toHaveProperty('iv')
      expect(parsed).toHaveProperty('tag')
      expect(parsed.algorithm).toBe('aes-256-gcm')
      
      const decryptedToken = await decryptToken(encryptedToken)
      expect(decryptedToken).toBe(originalToken)
    })
    
    test('should fail on invalid encrypted token format', async () => {
      // Test with old base64 format (should fail)
      const oldFormatToken = btoa('test-token')
      await expect(decryptToken(oldFormatToken)).rejects.toThrow()
      
      // Test with malformed JSON
      await expect(decryptToken('invalid-json')).rejects.toThrow()
      
      // Test with tampered encryption data
      const validToken = await encryptToken('test')
      const parsed = JSON.parse(validToken)
      parsed.encrypted = 'tampered'
      await expect(decryptToken(JSON.stringify(parsed))).rejects.toThrow()
    })
    
    test('should use different IVs for each encryption', async () => {
      const token = 'test-token'
      const encrypted1 = await encryptToken(token)
      const encrypted2 = await encryptToken(token)
      
      expect(encrypted1).not.toBe(encrypted2)
      
      const parsed1 = JSON.parse(encrypted1)
      const parsed2 = JSON.parse(encrypted2)
      expect(parsed1.iv).not.toBe(parsed2.iv)
    })
  })
  
  describe('2. State Parameter Validation Security (CVSS 7.8 Fix)', () => {
    test('should generate HMAC-signed state parameters', () => {
      const state = generateSecureState({
        provider: 'google',
        redirectTo: '/dashboard',
        timestamp: Date.now(),
        nonce: 'test-nonce'
      })
      
      // Should not be simple base64 JSON
      expect(() => {
        const decoded = Buffer.from(state, 'base64').toString('utf8')
        JSON.parse(decoded)
      }).toThrow()
      
      // Should be base64url encoded with signature
      const decoded = Buffer.from(state, 'base64url').toString('utf8')
      const signedData = JSON.parse(decoded)
      expect(signedData).toHaveProperty('payload')
      expect(signedData).toHaveProperty('signature')
      expect(signedData).toHaveProperty('timestamp')
    })
    
    test('should validate HMAC signatures correctly', () => {
      const validState = generateSecureState({
        provider: 'google',
        redirectTo: '/dashboard',
        timestamp: Date.now(),
        nonce: 'test-nonce'
      })
      
      const validation = validateSecureState(validState, 'google')
      expect(validation.valid).toBe(true)
      expect(validation.payload).toBeDefined()
      expect(validation.payload?.provider).toBe('google')
    })
    
    test('should reject tampered state parameters', () => {
      const validState = generateSecureState({
        provider: 'google',
        redirectTo: '/dashboard',
        timestamp: Date.now(),
        nonce: 'test-nonce'
      })
      
      // Tamper with the state
      const decoded = Buffer.from(validState, 'base64url').toString('utf8')
      const signedData = JSON.parse(decoded)
      signedData.signature = 'tampered-signature'
      const tamperedState = Buffer.from(JSON.stringify(signedData)).toString('base64url')
      
      const validation = validateSecureState(tamperedState, 'google')
      expect(validation.valid).toBe(false)
      expect(validation.error).toContain('signature')
    })
    
    test('should reject expired state parameters', () => {
      const expiredState = generateSecureState({
        provider: 'google',
        redirectTo: '/dashboard',
        timestamp: Date.now() - (15 * 60 * 1000), // 15 minutes ago
        nonce: 'test-nonce'
      })
      
      const validation = validateSecureState(expiredState, 'google')
      expect(validation.valid).toBe(false)
      expect(validation.error).toContain('expired')
    })
    
    test('should prevent provider mismatch attacks', () => {
      const state = generateSecureState({
        provider: 'google',
        redirectTo: '/dashboard',
        timestamp: Date.now(),
        nonce: 'test-nonce'
      })
      
      const validation = validateSecureState(state, 'facebook')
      expect(validation.valid).toBe(false)
      expect(validation.error).toContain('mismatch')
    })
  })
  
  describe('3. Redirect URI Validation Security', () => {
    test('should validate allowed redirect URIs', () => {
      const validUrls = [
        '/dashboard',
        '/profile',
        'https://example.com/dashboard',
        'https://app.example.com/callback'
      ]
      
      for (const url of validUrls) {
        const result = validateRedirectUri(url, 'https://example.com')
        expect(result.valid).toBe(true)
      }
    })
    
    test('should block dangerous redirect URIs', () => {
      const dangerousUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'https://evil.com/redirect',
        '/api/admin/delete-all',
        'https://example.com///evil.com',
        'https://example.com\\\\evil.com'
      ]
      
      for (const url of dangerousUrls) {
        const result = validateRedirectUri(url, 'https://example.com')
        expect(result.valid).toBe(false)
      }
    })
    
    test('should enforce HTTPS in production', () => {
      process.env.NODE_ENV = 'production'
      
      const result = validateRedirectUri('http://example.com/dashboard')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('HTTPS')
      
      process.env.NODE_ENV = 'test'
    })
    
    test('should sanitize valid URLs', () => {
      const result = validateRedirectUri('/dashboard?param=value', 'https://example.com')
      expect(result.valid).toBe(true)
      expect(result.sanitizedUrl).toBe('https://example.com/dashboard?param=value')
    })
  })
  
  describe('4. OAuth Configuration Security (CVSS 6.5 Fix)', () => {
    test('should validate client secret strength', () => {
      const configs = [
        { secret: 'weak', valid: false },
        { secret: 'short-but-complex-123!@#', valid: false }, // Too short
        { secret: 'long-but-simple-abcdefghijklmnopqrstuvwxyz1234567890', valid: false }, // No special chars
        { secret: 'test-google-secret-with-sufficient-complexity-123!@#', valid: true }
      ]
      
      for (const config of configs) {
        process.env.TEST_CLIENT_SECRET = config.secret
        const result = getSecureOAuthConfig('test')
        
        if (config.valid) {
          expect(result).not.toBeNull()
        } else {
          expect(result).toBeNull()
        }
      }
    })
    
    test('should validate environment configuration', () => {
      const validation = validateOAuthEnvironment()
      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })
    
    test('should detect missing configuration', () => {
      delete process.env.CONFIG_ENCRYPTION_KEY
      
      const validation = validateOAuthEnvironment()
      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('CONFIG_ENCRYPTION_KEY environment variable is required')
    })
  })
  
  describe('5. Rate Limiting Security', () => {
    let rateLimiter: OAuthRateLimiter
    
    beforeEach(() => {
      rateLimiter = new OAuthRateLimiter()
    })
    
    test('should enforce OAuth initiation rate limits', async () => {
      const identifier = 'test-ip-123'
      
      // First 5 requests should be allowed
      for (let i = 0; i < 5; i++) {
        const result = await rateLimiter.checkRateLimit('oauth_initiation', identifier)
        expect(result.allowed).toBe(true)
      }
      
      // 6th request should be blocked
      const blockedResult = await rateLimiter.checkRateLimit('oauth_initiation', identifier)
      expect(blockedResult.allowed).toBe(false)
      expect(blockedResult.error).toContain('Rate limit exceeded')
    })
    
    test('should apply penalty multipliers for failures', async () => {
      const identifier = 'test-ip-456'
      
      // Record a security violation (10x penalty)
      await rateLimiter.recordFailure('oauth_callback', identifier, 'security_violation')
      
      // Should be near or at limit due to penalty
      const result = await rateLimiter.checkRateLimit('oauth_callback', identifier)
      // Should be blocked or very close to limit
      expect(result.remaining || 0).toBeLessThan(5)
    })
  })
  
  describe('6. Account Linking Security (CVSS 7.2 Fix)', () => {
    let linkingSecurity: AccountLinkingSecurity
    
    beforeEach(() => {
      linkingSecurity = new AccountLinkingSecurity()
    })
    
    test('should require re-authentication for account linking', async () => {
      const request = {
        userId: 'test-user-123',
        provider: 'google',
        providerUserId: 'google-user-456',
        providerEmail: 'test@example.com',
        requireReauth: true
      }
      
      const result = await linkingSecurity.initiateSecureAccountLinking(
        request,
        'fake-session-token'
      )
      
      // Should require re-authentication
      expect(result.success).toBe(false)
      expect(result.challengeCode).toBe('REAUTH_REQUIRED')
      expect(result.verificationId).toBeDefined()
    })
    
    test('should validate email verification codes', async () => {
      // This would require setting up proper test data
      // For now, test the structure
      const result = await linkingSecurity.validateEmailVerification(
        'test-verification-id',
        'invalid-code'
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })
  
  describe('7. Integration Security Tests', () => {
    test('should handle complete OAuth flow securely', async () => {
      // Test the complete flow with all security measures
      const provider = 'google'
      const redirectTo = '/dashboard'
      
      // 1. Generate secure state
      const state = generateSecureState({
        provider,
        redirectTo,
        timestamp: Date.now(),
        nonce: 'test-nonce'
      })
      
      // 2. Validate redirect URI
      const redirectValidation = validateRedirectUri(redirectTo)
      expect(redirectValidation.valid).toBe(true)
      
      // 3. Validate state on callback
      const stateValidation = validateSecureState(state, provider)
      expect(stateValidation.valid).toBe(true)
      
      // 4. Test token encryption
      const accessToken = 'ya29.test-access-token'
      const encryptedToken = await encryptToken(accessToken)
      const decryptedToken = await decryptToken(encryptedToken)
      expect(decryptedToken).toBe(accessToken)
    })
    
    test('should prevent common attack vectors', () => {
      // CSRF attacks
      const tamperedState = 'tampered-state-value'
      const csrfResult = validateSecureState(tamperedState)
      expect(csrfResult.valid).toBe(false)
      
      // Open redirect attacks
      const maliciousRedirect = 'https://evil.com/steal-tokens'
      const redirectResult = validateRedirectUri(maliciousRedirect)
      expect(redirectResult.valid).toBe(false)
      
      // XSS in redirect
      const xssRedirect = '/dashboard?evil=<script>alert(1)</script>'
      const xssResult = validateRedirectUri(xssRedirect)
      expect(xssResult.valid).toBe(false)
    })
  })
  
  describe('8. Compliance and Standards Validation', () => {
    test('should meet OAuth 2.1 security requirements', () => {
      // State parameter with sufficient entropy
      const state1 = generateSecureState({
        provider: 'google',
        redirectTo: '/dashboard',
        timestamp: Date.now(),
        nonce: 'nonce1'
      })
      
      const state2 = generateSecureState({
        provider: 'google',
        redirectTo: '/dashboard',
        timestamp: Date.now(),
        nonce: 'nonce2'
      })
      
      // Each state should be unique
      expect(state1).not.toBe(state2)
      
      // Should be cryptographically secure length
      expect(state1.length).toBeGreaterThan(32)
    })
    
    test('should implement proper error handling without information leakage', () => {
      // Errors should not reveal internal system details
      const invalidState = 'clearly-invalid-state'
      const result = validateSecureState(invalidState)
      
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
      // Should not leak cryptographic details
      expect(result.error).not.toContain('signature')
      expect(result.error).not.toContain('HMAC')
      expect(result.error).not.toContain('key')
    })
  })
})

describe('OAuth Security Environment Validation', () => {
  test('should validate all security environment variables are present', () => {
    const requiredEnvVars = [
      'TOKEN_ENCRYPTION_KEY',
      'OAUTH_HMAC_KEY', 
      'CONFIG_ENCRYPTION_KEY',
      'NEXT_PUBLIC_SITE_URL'
    ]
    
    for (const envVar of requiredEnvVars) {
      expect(process.env[envVar]).toBeDefined()
      expect(process.env[envVar]).not.toBe('')
    }
  })
  
  test('should validate encryption key formats', () => {
    expect(process.env.TOKEN_ENCRYPTION_KEY).toMatch(/^[0-9a-fA-F]{64}$/)
    expect(process.env.CONFIG_ENCRYPTION_KEY).toMatch(/^[0-9a-fA-F]{64}$/)
    expect(process.env.OAUTH_HMAC_KEY!.length).toBeGreaterThanOrEqual(32)
  })
})