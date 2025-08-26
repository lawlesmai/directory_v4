/**
 * Edge-Compatible Security Functions
 * These functions run in Edge Runtime (middleware) and don't use Node.js APIs
 */

import { NextRequest } from 'next/server'

/**
 * Generate session fingerprint using Edge Runtime compatible functions
 */
export function generateSessionFingerprint(request: NextRequest): string {
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const ip = getClientIP(request)
  const acceptLanguage = request.headers.get('accept-language') || 'unknown'
  const acceptEncoding = request.headers.get('accept-encoding') || 'unknown'
  
  // Use simple hash for Edge Runtime
  const data = `${userAgent}:${ip}:${acceptLanguage}:${acceptEncoding}:${Date.now()}`
  
  // Simple hash implementation for Edge Runtime
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  
  const absHash = hash < 0 ? -hash : hash
  return absHash.toString(16).padStart(16, '0')
}

/**
 * Validate session fingerprint with timing-safe comparison
 */
export function validateSessionFingerprint(
  currentFingerprint: string, 
  storedFingerprint: string
): boolean {
  if (!currentFingerprint || !storedFingerprint) return false
  if (currentFingerprint.length !== storedFingerprint.length) return false
  
  // Simple timing-safe comparison
  let result = 0
  for (let i = 0; i < currentFingerprint.length; i++) {
    result |= currentFingerprint.charCodeAt(i) ^ storedFingerprint.charCodeAt(i)
  }
  
  return result === 0
}

/**
 * Get real client IP address with enhanced detection
 */
export function getClientIP(request: NextRequest): string {
  // Check various proxy headers in order of reliability
  const headers = [
    'cf-connecting-ip',      // Cloudflare
    'x-real-ip',            // Nginx
    'x-forwarded-for',      // Standard
    'x-client-ip',          // Alternative
    'x-forwarded',          // Less common
    'forwarded-for',        // Legacy
    'forwarded'             // RFC 7239
  ]
  
  for (const header of headers) {
    const value = request.headers.get(header)
    if (value) {
      // Take first IP if comma-separated
      const ip = value.split(',')[0].trim()
      if (isValidIP(ip)) return ip
    }
  }
  
  return request.ip || 'unknown'
}

/**
 * Security event interface for Edge Runtime
 */
export interface EdgeSecurityEvent {
  type: 'auth_attempt' | 'auth_success' | 'auth_failure' | 'suspicious_activity' | 'rate_limit_exceeded' | 'csrf_violation'
  severity: 'low' | 'medium' | 'high' | 'critical'
  userId?: string
  ip: string
  userAgent?: string
  details: Record<string, any>
  timestamp: string
  sessionFingerprint?: string
  riskScore: number
}

export function createSecurityEvent(
  type: EdgeSecurityEvent['type'],
  severity: EdgeSecurityEvent['severity'],
  request: NextRequest,
  details: Record<string, any> = {},
  userId?: string,
  riskScore: number = 50
): EdgeSecurityEvent {
  return {
    type,
    severity,
    userId,
    ip: getClientIP(request),
    userAgent: request.headers.get('user-agent') || undefined,
    details,
    timestamp: new Date().toISOString(),
    sessionFingerprint: generateSessionFingerprint(request),
    riskScore: riskScore < 0 ? 0 : (riskScore > 100 ? 100 : riskScore)
  }
}

/**
 * Validate IP address format
 */
function isValidIP(ip: string): boolean {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
  return ipv4Regex.test(ip) || ipv6Regex.test(ip)
}

/**
 * Generate secure random string using Edge Runtime compatible methods
 */
export function generateSecureRandom(length: number = 32): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Create rate limiting key
 */
export function createRateLimitKey(identifier: string, action: string): string {
  // Simple hash for rate limiting keys
  const data = identifier + ':' + action
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  const absHash = hash < 0 ? -hash : hash
  return 'rate_limit:' + action + ':' + absHash.toString(16)
}
