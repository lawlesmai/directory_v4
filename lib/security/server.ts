/**
 * Server-Side Security Functions
 * Contains security functions that can only run on the server
 * Fixes build issues with client-side webpack bundling
 */

import * as bcrypt from 'bcryptjs'
import { randomBytes, createHash, timingSafeEqual } from 'crypto'
import { NextRequest } from 'next/server'

// Security configuration (mirrored from main module)
export const SECURITY_CONFIG = {
  // Password hashing with bcrypt (industry standard)
  PASSWORD_HASH: {
    saltRounds: 12  // High security rounds
  },
  
  // Session security
  SESSION: {
    maxAge: 7200,           // 2 hours
    extendedMaxAge: 2592000, // 30 days for "remember me"
    fingerprintLength: 64,   // Session fingerprint length
    regenerateInterval: 1800 // 30 minutes
  },
  
  // CSRF protection
  CSRF: {
    secretLength: 32,
    tokenLength: 64,
    maxAge: 3600, // 1 hour
    sameSite: 'strict' as const,
    secure: true,
    httpOnly: true
  }
} as const

/**
 * Password Security Functions (Server-Only)
 */

/**
 * Validate password strength according to NIST guidelines
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean
  score: number
  errors: string[]
  suggestions: string[]
} {
  const errors: string[] = []
  const suggestions: string[] = []
  let score = 0
  
  // Length check (NIST minimum 8, recommended 12+)
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  } else if (password.length >= 12) {
    score += 2
  } else {
    score += 1
    suggestions.push('Consider using a longer password (12+ characters)')
  }
  
  // Complexity checks
  if (/[a-z]/.test(password)) score += 1
  else errors.push('Password must contain lowercase letters')
  
  if (/[A-Z]/.test(password)) score += 1  
  else errors.push('Password must contain uppercase letters')
  
  if (/\d/.test(password)) score += 1
  else errors.push('Password must contain numbers')
  
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 2
  else suggestions.push('Consider adding special characters for stronger security')
  
  // Common password patterns (basic check)
  const commonPatterns = [
    /^(.)\1+$/, // All same character
    /^(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def)+/i, // Sequential
    /^(password|admin|user|test|guest|login)+/i // Common words
  ]
  
  if (commonPatterns.some(pattern => pattern.test(password))) {
    errors.push('Password contains common patterns')
    score = Math.max(0, score - 2)
  }
  
  return {
    isValid: errors.length === 0,
    score: Math.min(score, 10),
    errors,
    suggestions
  }
}

/**
 * Hash password using bcrypt (industry standard)
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  try {
    // Validate password strength first
    const validation = validatePasswordStrength(plainPassword)
    if (!validation.isValid) {
      throw new Error(`Password validation failed: ${validation.errors.join(', ')}`)
    }
    
    const hash = await bcrypt.hash(plainPassword, SECURITY_CONFIG.PASSWORD_HASH.saltRounds)
    return hash
  } catch (error) {
    console.error('Password hashing failed:', error)
    throw new Error('Password hashing failed')
  }
}

/**
 * Verify password against hash
 */
export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plainPassword, hashedPassword)
  } catch (error) {
    console.error('Password verification failed:', error)
    return false
  }
}

/**
 * Session Security Functions (Server-Only)
 */

/**
 * Generate session fingerprint
 */
export function generateSessionFingerprint(request: NextRequest): string {
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const ip = getClientIP(request)
  const acceptLanguage = request.headers.get('accept-language') || 'unknown'
  
  const fingerprint = createHash('sha256')
    .update(`${userAgent}:${ip}:${acceptLanguage}`)
    .digest('hex')
  
  return fingerprint.substring(0, SECURITY_CONFIG.SESSION.fingerprintLength)
}

/**
 * Validate session fingerprint
 */
export function validateSessionFingerprint(
  currentFingerprint: string, 
  storedFingerprint: string
): boolean {
  if (currentFingerprint.length !== storedFingerprint.length) {
    return false
  }
  
  const currentBuffer = Buffer.from(currentFingerprint, 'hex')
  const storedBuffer = Buffer.from(storedFingerprint, 'hex')
  
  return timingSafeEqual(currentBuffer, storedBuffer)
}

/**
 * CSRF Protection Functions (Server-Only)
 */

/**
 * Generate CSRF token
 */
export function generateCSRFToken(): string {
  return randomBytes(SECURITY_CONFIG.CSRF.tokenLength).toString('hex')
}

/**
 * Generate CSRF secret
 */
export function generateCSRFSecret(): string {
  return randomBytes(SECURITY_CONFIG.CSRF.secretLength).toString('hex')
}

/**
 * Validate CSRF token
 */
export function validateCSRFToken(token: string, secret: string): boolean {
  if (!token || !secret) return false
  
  try {
    const expectedToken = createHash('sha256')
      .update(`${secret}:${token}`)
      .digest('hex')
    
    return timingSafeEqual(
      Buffer.from(token, 'hex'),
      Buffer.from(expectedToken.substring(0, token.length), 'hex')
    )
  } catch (error) {
    console.error('CSRF validation error:', error)
    return false
  }
}

/**
 * Security Utilities (Server-Only)
 */

/**
 * Get real client IP address
 */
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  
  if (cfConnectingIP) return cfConnectingIP
  if (realIP) return realIP
  if (forwarded) return forwarded.split(',')[0].trim()
  
  return 'unknown'
}

/**
 * Generate secure random string
 */
export function generateSecureRandom(length: number = 32): string {
  return randomBytes(length).toString('hex')
}

/**
 * Rate limiting helper
 */
export function createRateLimitKey(identifier: string, action: string): string {
  return `rate_limit:${action}:${createHash('sha256').update(identifier).digest('hex')}`
}

/**
 * Create security event
 */
export interface SecurityEvent {
  type: 'auth_attempt' | 'auth_success' | 'auth_failure' | 'suspicious_activity' | 'rate_limit_exceeded'
  severity: 'low' | 'medium' | 'high' | 'critical'
  userId?: string
  ip: string
  userAgent?: string
  details: Record<string, any>
  timestamp: Date
}

export function createSecurityEvent(
  type: SecurityEvent['type'],
  severity: SecurityEvent['severity'],
  request: NextRequest,
  details: Record<string, any> = {},
  userId?: string
): SecurityEvent {
  return {
    type,
    severity,
    userId,
    ip: getClientIP(request),
    userAgent: request.headers.get('user-agent') || undefined,
    details,
    timestamp: new Date()
  }
}