/**
 * Security Utilities Module
 * Comprehensive security functions for password hashing, CSRF protection, and session security
 * Addresses Critical Security Vulnerabilities:
 * - CVSS 8.7: Missing Password Hashing Implementation
 * - CVSS 7.8: Insufficient Session Security
 */

// Client-safe security utilities
// Server-side functions are in /lib/security/server.ts

// Security configuration constants
export const SECURITY_CONFIG = {
  
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
  },
  
  // Rate limiting
  RATE_LIMIT: {
    loginAttempts: 5,
    lockoutDuration: 900,     // 15 minutes
    windowMinutes: 15,
    maxRequests: 100
  }
} as const

/**
 * Client-Safe Functions Only
 * Server-side functions moved to /lib/security/server.ts
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
  
  // Entropy estimation (simplified)
  const charsetSize = [
    /[a-z]/.test(password) ? 26 : 0,
    /[A-Z]/.test(password) ? 26 : 0, 
    /\d/.test(password) ? 10 : 0,
    /[^a-zA-Z\d]/.test(password) ? 32 : 0
  ].reduce((sum, val) => sum + val, 0)
  
  const entropy = Math.log2(Math.pow(charsetSize, password.length))
  if (entropy < 50) {
    suggestions.push('Password may be vulnerable to brute force attacks')
  }
  
  return {
    isValid: errors.length === 0,
    score: Math.min(score, 10),
    errors,
    suggestions
  }
}

// Server-side session and CSRF functions moved to /lib/security/server.ts

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  if (!input) return ''
  
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/[&'"]/g, match => {
      const htmlEntities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;'
      }
      return htmlEntities[match] || match
    })
    .trim()
    .substring(0, 1000) // Limit length
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 254
}

// Rate limiting helper moved to server.ts

/**
 * Security headers configuration
 */
export const SECURITY_HEADERS = {
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  
  // Prevent MIME sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Enable XSS protection
  'X-XSS-Protection': '1; mode=block',
  
  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Prevent DNS prefetching
  'X-DNS-Prefetch-Control': 'off',
  
  // HSTS (HTTPS only)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  
  // Content Security Policy (restrictive)
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co",
    "style-src 'self' 'unsafe-inline'", 
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join('; '),
  
  // Feature policy
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'interest-cohort=()'
  ].join(', ')
} as const

// Security event logging moved to server.ts