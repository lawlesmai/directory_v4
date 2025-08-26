/**
 * CSRF Protection Middleware
 * Edge Runtime Compatible Version
 * Implements Double Submit Cookie pattern for CSRF protection
 * Addresses High Security Issue: CVSS 7.8 - Missing CSRF protection
 */

import { NextRequest, NextResponse } from 'next/server'

// CSRF configuration
const CSRF_CONFIG = {
  cookieName: '__csrf_token',
  headerName: 'x-csrf-token',
  parameterName: '_csrf',
  maxAge: 3600, // 1 hour
  excludedMethods: ['GET', 'HEAD', 'OPTIONS'],
  excludedPaths: [
    '/api/health',
    '/api/status',
    '/api/auth/callback',
    '/api/webhooks'
  ]
}

/**
 * Generate CSRF secret using Edge Runtime compatible methods
 */
function generateCSRFSecret(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Create hash using Edge Runtime compatible SubtleCrypto
 */
async function createHash(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Synchronous hash for immediate use (less secure but Edge compatible)
 */
function createSimpleHash(data: string): string {
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  const absHash = hash < 0 ? -hash : hash
  return absHash.toString(16).padStart(8, '0')
}

/**
 * Generate CSRF token pair (secret + token)
 */
export function generateCSRFTokenPair(): {
  secret: string
  token: string
  cookieValue: string
} {
  const secret = generateCSRFSecret()
  const timestamp = Date.now().toString()
  
  // Create token with simple hash (for Edge Runtime compatibility)
  const token = createSimpleHash(`${secret}:${timestamp}`)
  
  // Cookie value includes both secret and timestamp
  const cookieValue = `${secret}.${timestamp}`
  
  return { secret, token, cookieValue }
}

/**
 * Validate CSRF token from request
 */
export function validateCSRFTokenFromRequest(
  request: NextRequest
): { isValid: boolean; error?: string } {
  const method = request.method
  const pathname = request.nextUrl.pathname
  
  // Skip validation for excluded methods
  if (CSRF_CONFIG.excludedMethods.includes(method)) {
    return { isValid: true }
  }
  
  // Skip validation for excluded paths
  if (CSRF_CONFIG.excludedPaths.some(path => pathname.startsWith(path))) {
    return { isValid: true }
  }
  
  // Get CSRF token from header or body
  const tokenFromHeader = request.headers.get(CSRF_CONFIG.headerName)
  
  if (!tokenFromHeader) {
    return { 
      isValid: false, 
      error: 'CSRF token missing' 
    }
  }
  
  // Get CSRF secret from cookie
  const csrfCookie = request.cookies.get(CSRF_CONFIG.cookieName)?.value
  
  if (!csrfCookie) {
    return { 
      isValid: false, 
      error: 'CSRF cookie missing' 
    }
  }
  
  // Parse cookie value
  const [secret, timestamp] = csrfCookie.split('.')
  
  if (!secret || !timestamp) {
    return { 
      isValid: false, 
      error: 'Invalid CSRF cookie format' 
    }
  }
  
  // Check token age
  const tokenAge = Date.now() - parseInt(timestamp)
  if (tokenAge > CSRF_CONFIG.maxAge * 1000) {
    return { 
      isValid: false, 
      error: 'CSRF token expired' 
    }
  }
  
  // Validate token
  const expectedToken = createSimpleHash(`${secret}:${timestamp}`)
  
  // Simple comparison for Edge Runtime compatibility
  return { isValid: tokenFromHeader === expectedToken }
}

/**
 * Add CSRF protection to response
 */
export function addCSRFProtection(response: NextResponse): NextResponse {
  const { secret, token, cookieValue } = generateCSRFTokenPair()
  
  // Set CSRF cookie
  response.cookies.set(CSRF_CONFIG.cookieName, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CSRF_CONFIG.maxAge,
    path: '/'
  })
  
  // Add token to response headers for client-side access
  response.headers.set('X-CSRF-Token', token)
  
  return response
}

/**
 * CSRF middleware function
 */
export async function csrfProtection(
  request: NextRequest
): Promise<NextResponse | null> {
  // Validate CSRF token for state-changing operations
  const validation = validateCSRFTokenFromRequest(request)
  
  if (!validation.isValid) {
    console.warn('CSRF validation failed:', validation.error, {
      path: request.nextUrl.pathname,
      method: request.method,
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    })
    
    return NextResponse.json(
      { 
        error: 'CSRF validation failed',
        code: 'CSRF_TOKEN_INVALID'
      },
      { status: 403 }
    )
  }
  
  return null // Continue processing
}

/**
 * Get CSRF token for client-side use
 */
export function getCSRFTokenForClient(request: NextRequest): string | null {
  const csrfCookie = request.cookies.get(CSRF_CONFIG.cookieName)?.value
  
  if (!csrfCookie) {
    return null
  }
  
  const [secret, timestamp] = csrfCookie.split('.')
  
  if (!secret || !timestamp) {
    return null
  }
  
  // Check if token is still valid
  const tokenAge = Date.now() - parseInt(timestamp)
  if (tokenAge > CSRF_CONFIG.maxAge * 1000) {
    return null
  }
  
  // Generate token for client use
  const token = createSimpleHash(`${secret}:${timestamp}`)
  
  return token
}

/**
 * CSRF token API endpoint helper
 */
export function createCSRFTokenResponse(): NextResponse {
  const { token, cookieValue } = generateCSRFTokenPair()
  
  const response = NextResponse.json({ 
    csrfToken: token,
    expires: Date.now() + (CSRF_CONFIG.maxAge * 1000)
  })
  
  // Set CSRF cookie
  response.cookies.set(CSRF_CONFIG.cookieName, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CSRF_CONFIG.maxAge,
    path: '/'
  })
  
  return response
}

/**
 * Clear CSRF protection
 */
export function clearCSRFProtection(response: NextResponse): NextResponse {
  response.cookies.set(CSRF_CONFIG.cookieName, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/'
  })
  
  return response
}

/**
 * Compatibility function for password reset routes
 */
export async function validateCSRFToken(request: NextRequest): Promise<{ isValid: boolean; error?: string }> {
  const validation = validateCSRFTokenFromRequest(request)
  return {
    isValid: validation.isValid,
    error: validation.error
  }
}
