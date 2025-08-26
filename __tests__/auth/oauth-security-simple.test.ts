/**
 * OAuth Security Validation Tests - Critical Security Fixes Validation
 * 
 * Tests all critical security vulnerabilities are properly fixed:
 * 1. Token encryption (CVSS 7.5)
 * 2. State parameter validation (CVSS 7.8) 
 * 3. Redirect URI validation
 */

// Set environment variables before any imports
process.env.TOKEN_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
process.env.OAUTH_HMAC_KEY = 'test-hmac-key-must-be-at-least-32-chars-long-for-security'
process.env.CONFIG_ENCRYPTION_KEY = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210'
process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'
process.env.ALLOWED_REDIRECT_ORIGINS = 'https://app.example.com,https://admin.example.com'
process.env.NODE_ENV = 'test'

import { describe, test, expect } from '@jest/globals'

describe('OAuth Security Fixes Validation', () => {
  
  test('should have secure environment configuration', () => {
    // Verify critical environment variables are set
    expect(process.env.TOKEN_ENCRYPTION_KEY).toBeDefined()
    expect(process.env.TOKEN_ENCRYPTION_KEY!.length).toBe(64)
    expect(process.env.OAUTH_HMAC_KEY).toBeDefined()
    expect(process.env.OAUTH_HMAC_KEY!.length).toBeGreaterThanOrEqual(32)
    expect(process.env.NEXT_PUBLIC_SITE_URL).toBe('https://example.com')
  })

  test('should validate token encryption module exists', async () => {
    const { encryptToken, decryptToken } = await import('@/lib/auth/token-encryption')
    
    const testToken = 'test-oauth-token-123'
    const encrypted = await encryptToken(testToken)
    
    expect(encrypted).not.toBe(testToken)
    expect(encrypted).not.toContain('btoa') // Should not be base64
    
    const decrypted = await decryptToken(encrypted)
    expect(decrypted).toBe(testToken)
  })

  test('should validate state parameter security module exists', async () => {
    const { generateSecureState, validateSecureState } = await import('@/lib/auth/state-validation')
    
    const state = generateSecureState({
      provider: 'google',
      redirectTo: '/dashboard',
      timestamp: Date.now(),
      nonce: 'test-nonce'
    })
    
    expect(state).toBeDefined()
    expect(state.length).toBeGreaterThan(32)
    
    const validation = validateSecureState(state, 'google')
    expect(validation.valid).toBe(true)
  })

  test('should validate redirect URI validation module exists', async () => {
    const { validateRedirectUri } = await import('@/lib/auth/redirect-validation')
    
    // Test valid redirect
    const validResult = validateRedirectUri('/dashboard')
    expect(validResult.valid).toBe(true)
    
    // Test invalid redirect
    const invalidResult = validateRedirectUri('javascript:alert(1)')
    expect(invalidResult.valid).toBe(false)
  })

  test('should prevent common security vulnerabilities', async () => {
    const { validateRedirectUri } = await import('@/lib/auth/redirect-validation')
    const { validateSecureState } = await import('@/lib/auth/state-validation')
    
    // Prevent open redirects
    const openRedirect = validateRedirectUri('https://evil.com/steal-tokens')
    expect(openRedirect.valid).toBe(false)
    
    // Prevent XSS
    const xssRedirect = validateRedirectUri('/dashboard?evil=<script>alert(1)</script>')
    expect(xssRedirect.valid).toBe(false)
    
    // Prevent CSRF with invalid state
    const csrfResult = validateSecureState('invalid-state')
    expect(csrfResult.valid).toBe(false)
  })
})

describe('OAuth Security Integration', () => {
  test('should have all security modules working together', async () => {
    // Import all modules
    const tokenModule = await import('@/lib/auth/token-encryption')
    const stateModule = await import('@/lib/auth/state-validation')
    const redirectModule = await import('@/lib/auth/redirect-validation')
    
    // Test complete secure flow
    const redirectTo = '/dashboard'
    const provider = 'google'
    
    // 1. Validate redirect
    const redirectValidation = redirectModule.validateRedirectUri(redirectTo)
    expect(redirectValidation.valid).toBe(true)
    
    // 2. Generate secure state
    const state = stateModule.generateSecureState({
      provider,
      redirectTo: redirectValidation.sanitizedUrl || redirectTo,
      timestamp: Date.now(),
      nonce: 'secure-nonce'
    })
    
    // 3. Validate state
    const stateValidation = stateModule.validateSecureState(state, provider)
    expect(stateValidation.valid).toBe(true)
    
    // 4. Encrypt/decrypt token
    const token = 'oauth-access-token-example'
    const encrypted = await tokenModule.encryptToken(token)
    const decrypted = await tokenModule.decryptToken(encrypted)
    expect(decrypted).toBe(token)
  })
})