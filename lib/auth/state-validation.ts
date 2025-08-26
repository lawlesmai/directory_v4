/**
 * OAuth State Parameter Security Module - Critical Security Fix
 * 
 * Implements HMAC-signed state parameters with timestamp validation
 * Fixes CVSS 7.8 vulnerability: Inadequate State Parameter Validation
 */

import crypto from 'crypto'

interface StatePayload {
  provider: string
  redirectTo: string
  timestamp: number
  nonce: string
  userId?: string
  sessionId?: string
}

interface SignedStateData {
  payload: string
  signature: string
  timestamp: number
}

// Use secure HMAC key from environment
const HMAC_KEY = (() => {
  const key = process.env.OAUTH_HMAC_KEY
  if (!key) {
    throw new Error('OAUTH_HMAC_KEY environment variable is required')
  }
  if (key.length < 32) {
    throw new Error('OAUTH_HMAC_KEY must be at least 32 characters')
  }
  return key
})()

const STATE_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes
const HMAC_ALGORITHM = 'sha256'

/**
 * Generate HMAC-signed state parameter with timestamp validation
 */
export function generateSecureState(payload: StatePayload): string {
  try {
    // Add current timestamp and validation data
    const enhancedPayload = {
      ...payload,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex'),
      version: '1.0'
    }
    
    // Encode payload
    const encodedPayload = Buffer.from(JSON.stringify(enhancedPayload)).toString('base64url')
    
    // Generate HMAC signature
    const hmac = crypto.createHmac(HMAC_ALGORITHM, HMAC_KEY)
    hmac.update(encodedPayload)
    const signature = hmac.digest('hex')
    
    // Create signed state data
    const signedData: SignedStateData = {
      payload: encodedPayload,
      signature,
      timestamp: enhancedPayload.timestamp
    }
    
    // Return base64url encoded signed state
    return Buffer.from(JSON.stringify(signedData)).toString('base64url')
    
  } catch (error) {
    console.error('State generation failed:', error)
    throw new Error('Failed to generate secure state parameter')
  }
}

/**
 * Validate HMAC-signed state parameter with comprehensive checks
 */
export function validateSecureState(
  stateParam: string,
  expectedProvider?: string
): { valid: boolean; error?: string; payload?: StatePayload } {
  try {
    // Decode the signed state data
    let signedData: SignedStateData
    try {
      const decoded = Buffer.from(stateParam, 'base64url').toString('utf8')
      signedData = JSON.parse(decoded)
    } catch {
      return { valid: false, error: 'Invalid state parameter format' }
    }
    
    // Validate structure
    if (!signedData.payload || !signedData.signature || !signedData.timestamp) {
      return { valid: false, error: 'Malformed state parameter' }
    }
    
    // Verify HMAC signature
    const hmac = crypto.createHmac(HMAC_ALGORITHM, HMAC_KEY)
    hmac.update(signedData.payload)
    const expectedSignature = hmac.digest('hex')
    
    // Use constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(
      Buffer.from(signedData.signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )) {
      return { valid: false, error: 'Invalid state signature - possible CSRF attack' }
    }
    
    // Check timestamp to prevent replay attacks
    const now = Date.now()
    const stateAge = now - signedData.timestamp
    
    if (stateAge > STATE_EXPIRY_MS) {
      return { valid: false, error: 'State parameter expired - possible replay attack' }
    }
    
    if (signedData.timestamp > now + 60000) { // 1 minute clock skew allowance
      return { valid: false, error: 'State parameter from future - possible manipulation' }
    }
    
    // Decode and validate payload
    let payload: StatePayload
    try {
      const payloadJson = Buffer.from(signedData.payload, 'base64url').toString('utf8')
      payload = JSON.parse(payloadJson)
    } catch {
      return { valid: false, error: 'Invalid state payload format' }
    }
    
    // Validate payload structure
    if (!payload.provider || !payload.redirectTo || !payload.timestamp || !payload.nonce) {
      return { valid: false, error: 'Missing required state payload fields' }
    }
    
    // Validate provider if expected
    if (expectedProvider && payload.provider !== expectedProvider) {
      return { valid: false, error: 'Provider mismatch in state parameter' }
    }
    
    // Validate redirect URL to prevent open redirects
    if (!isValidRedirectUrl(payload.redirectTo)) {
      return { valid: false, error: 'Invalid redirect URL in state parameter' }
    }
    
    return { valid: true, payload }
    
  } catch (error) {
    console.error('State validation error:', error)
    return { valid: false, error: 'State validation failed' }
  }
}

/**
 * Validate redirect URLs against whitelist to prevent open redirects
 */
function isValidRedirectUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url, process.env.NEXT_PUBLIC_SITE_URL)
    
    // Get allowed origins from environment
    const allowedOrigins = (process.env.ALLOWED_REDIRECT_ORIGINS || '')
      .split(',')
      .map(origin => origin.trim())
      .filter(Boolean)
    
    // Always allow same origin
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const siteOrigin = new URL(siteUrl).origin
    allowedOrigins.push(siteOrigin)
    
    // Check if the redirect URL origin is in the whitelist
    const isAllowedOrigin = allowedOrigins.some(allowed => {
      try {
        const allowedUrl = new URL(allowed)
        return parsedUrl.origin === allowedUrl.origin
      } catch {
        // If allowed origin is a path, combine with site origin
        return parsedUrl.origin === siteOrigin && parsedUrl.pathname.startsWith(allowed)
      }
    })
    
    if (!isAllowedOrigin) {
      console.warn(`Blocked redirect to unauthorized origin: ${parsedUrl.origin}`)
      return false
    }
    
    // Additional security checks
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return false
    }
    
    // Block redirects to potentially dangerous paths
    const dangerousPaths = [
      '/api/',
      '///',
      '\\\\'
    ]
    
    if (dangerousPaths.some(path => parsedUrl.pathname.includes(path))) {
      return false
    }
    
    return true
    
  } catch (error) {
    console.error('Redirect URL validation error:', error)
    return false
  }
}

/**
 * Generate secure nonce for additional CSRF protection
 */
export function generateNonce(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

/**
 * Create state parameter for OAuth flow with comprehensive security
 */
export function createOAuthState(
  provider: string,
  redirectTo: string,
  userId?: string,
  sessionId?: string
): string {
  return generateSecureState({
    provider,
    redirectTo,
    timestamp: Date.now(),
    nonce: generateNonce(),
    userId,
    sessionId
  })
}

/**
 * Validate environment configuration for state security
 */
export function validateStateConfiguration(): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!process.env.OAUTH_HMAC_KEY) {
    errors.push('OAUTH_HMAC_KEY environment variable is required')
  } else if (process.env.OAUTH_HMAC_KEY.length < 32) {
    errors.push('OAUTH_HMAC_KEY must be at least 32 characters')
  }
  
  if (!process.env.NEXT_PUBLIC_SITE_URL) {
    errors.push('NEXT_PUBLIC_SITE_URL environment variable is required')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}