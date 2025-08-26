/**
 * OAuth Redirect URI Validation Module - Critical Security Fix
 * 
 * Implements strict redirect URI validation with whitelisting
 * Prevents open redirect vulnerabilities and unauthorized redirects
 */

export interface RedirectValidationResult {
  valid: boolean
  error?: string
  sanitizedUrl?: string
}

export interface RedirectPolicy {
  allowedOrigins: string[]
  allowedPaths: string[]
  blockedPaths: string[]
  requireHttps: boolean
  allowLocalhost: boolean
}

/**
 * Default redirect security policy
 */
const DEFAULT_POLICY: RedirectPolicy = {
  allowedOrigins: [],
  allowedPaths: [
    '/dashboard',
    '/profile',
    '/settings',
    '/auth/success',
    '/auth/callback',
    '/onboarding'
  ],
  blockedPaths: [
    '/api/',
    '/admin/',
    '/auth/error',
    '///',
    '\\\\',
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'ftp:'
  ],
  requireHttps: process.env.NODE_ENV === 'production',
  allowLocalhost: process.env.NODE_ENV !== 'production'
}

/**
 * Comprehensive OAuth redirect URI validator
 */
export class RedirectUriValidator {
  private policy: RedirectPolicy
  
  constructor(customPolicy?: Partial<RedirectPolicy>) {
    this.policy = {
      ...DEFAULT_POLICY,
      ...customPolicy
    }
    
    // Load allowed origins from environment
    const envOrigins = process.env.ALLOWED_REDIRECT_ORIGINS
    if (envOrigins) {
      this.policy.allowedOrigins.push(
        ...envOrigins.split(',').map(origin => origin.trim()).filter(Boolean)
      )
    }
    
    // Always allow site origin
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    if (siteUrl) {
      try {
        const siteOrigin = new URL(siteUrl).origin
        if (!this.policy.allowedOrigins.includes(siteOrigin)) {
          this.policy.allowedOrigins.push(siteOrigin)
        }
      } catch (error) {
        console.error('Invalid NEXT_PUBLIC_SITE_URL:', error)
      }
    }
  }
  
  /**
   * Validate redirect URI against security policy
   */
  validateRedirectUri(redirectUri: string, baseUrl?: string): RedirectValidationResult {
    try {
      // Handle relative URLs by resolving against base URL
      let resolvedUrl: URL
      try {
        if (redirectUri.startsWith('/')) {
          const base = baseUrl || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
          resolvedUrl = new URL(redirectUri, base)
        } else {
          resolvedUrl = new URL(redirectUri)
        }
      } catch (error) {
        return {
          valid: false,
          error: 'Invalid URL format'
        }
      }
      
      // Basic protocol validation
      const protocolCheck = this.validateProtocol(resolvedUrl)
      if (!protocolCheck.valid) {
        return protocolCheck
      }
      
      // Origin validation
      const originCheck = this.validateOrigin(resolvedUrl)
      if (!originCheck.valid) {
        return originCheck
      }
      
      // Path validation
      const pathCheck = this.validatePath(resolvedUrl)
      if (!pathCheck.valid) {
        return pathCheck
      }
      
      // Query parameter validation
      const queryCheck = this.validateQueryParameters(resolvedUrl)
      if (!queryCheck.valid) {
        return queryCheck
      }
      
      // Additional security checks
      const securityCheck = this.performSecurityChecks(resolvedUrl)
      if (!securityCheck.valid) {
        return securityCheck
      }
      
      return {
        valid: true,
        sanitizedUrl: resolvedUrl.toString()
      }
      
    } catch (error) {
      console.error('Redirect URI validation error:', error)
      return {
        valid: false,
        error: 'Redirect URI validation failed'
      }
    }
  }
  
  /**
   * Validate URL protocol
   */
  private validateProtocol(url: URL): RedirectValidationResult {
    const allowedProtocols = ['http:', 'https:']
    
    if (!allowedProtocols.includes(url.protocol)) {
      return {
        valid: false,
        error: `Protocol ${url.protocol} is not allowed`
      }
    }
    
    // Enforce HTTPS in production
    if (this.policy.requireHttps && url.protocol !== 'https:') {
      // Allow HTTP for localhost in development
      if (!this.policy.allowLocalhost || !this.isLocalhost(url.hostname)) {
        return {
          valid: false,
          error: 'HTTPS is required in production'
        }
      }
    }
    
    return { valid: true }
  }
  
  /**
   * Validate URL origin against whitelist
   */
  private validateOrigin(url: URL): RedirectValidationResult {
    const origin = url.origin
    
    // Check if origin is in allowed list
    if (this.policy.allowedOrigins.length > 0) {
      const isAllowed = this.policy.allowedOrigins.some(allowedOrigin => {
        try {
          return new URL(allowedOrigin).origin === origin
        } catch {
          // Treat as hostname pattern if not valid URL
          return url.hostname === allowedOrigin || url.hostname.endsWith('.' + allowedOrigin)
        }
      })
      
      if (!isAllowed) {
        // Special handling for localhost in development
        if (this.policy.allowLocalhost && this.isLocalhost(url.hostname)) {
          return { valid: true }
        }
        
        return {
          valid: false,
          error: `Origin ${origin} is not in the allowed list`
        }
      }
    }
    
    return { valid: true }
  }
  
  /**
   * Validate URL path against allowed/blocked patterns
   */
  private validatePath(url: URL): RedirectValidationResult {
    const path = url.pathname
    
    // Check blocked paths first
    for (const blockedPath of this.policy.blockedPaths) {
      if (this.matchesPattern(path, blockedPath)) {
        return {
          valid: false,
          error: `Path ${path} is blocked`
        }
      }
    }
    
    // Check allowed paths if specified
    if (this.policy.allowedPaths.length > 0) {
      const isAllowed = this.policy.allowedPaths.some(allowedPath => 
        this.matchesPattern(path, allowedPath)
      )
      
      if (!isAllowed) {
        return {
          valid: false,
          error: `Path ${path} is not in the allowed list`
        }
      }
    }
    
    return { valid: true }
  }
  
  /**
   * Validate query parameters for suspicious content
   */
  private validateQueryParameters(url: URL): RedirectValidationResult {
    const searchParams = url.searchParams
    
    // Check for suspicious parameter names
    const suspiciousParams = ['javascript', 'vbscript', 'data', 'file']
    
    for (const [key, value] of searchParams) {
      // Check parameter names
      if (suspiciousParams.some(suspicious => 
        key.toLowerCase().includes(suspicious)
      )) {
        return {
          valid: false,
          error: `Suspicious parameter name: ${key}`
        }
      }
      
      // Check parameter values for scripts or data URLs
      if (this.containsSuspiciousContent(value)) {
        return {
          valid: false,
          error: `Suspicious parameter value detected`
        }
      }
    }
    
    return { valid: true }
  }
  
  /**
   * Perform additional security checks
   */
  private performSecurityChecks(url: URL): RedirectValidationResult {
    const urlString = url.toString()
    
    // Check for encoded dangerous patterns
    const dangerousPatterns = [
      '%2F%2F%2F', // ///
      '%5C%5C',    // \\
      'javascript%3A', // javascript:
      'data%3A',       // data:
      'vbscript%3A'    // vbscript:
    ]
    
    for (const pattern of dangerousPatterns) {
      if (urlString.includes(pattern)) {
        return {
          valid: false,
          error: 'Potentially dangerous encoded content detected'
        }
      }
    }
    
    // Check for multiple slashes that could bypass validation
    if (urlString.includes('///') || urlString.includes('\\\\')) {
      return {
        valid: false,
        error: 'Multiple slashes detected - potential bypass attempt'
      }
    }
    
    // Check URL length to prevent DoS
    if (urlString.length > 2048) {
      return {
        valid: false,
        error: 'URL too long'
      }
    }
    
    return { valid: true }
  }
  
  /**
   * Check if hostname is localhost
   */
  private isLocalhost(hostname: string): boolean {
    const localhostPatterns = [
      'localhost',
      '127.0.0.1',
      '::1',
      '0.0.0.0'
    ]
    
    return localhostPatterns.some(pattern => 
      hostname === pattern || hostname.startsWith(pattern + ':')
    )
  }
  
  /**
   * Match path against pattern (supports wildcards)
   */
  private matchesPattern(path: string, pattern: string): boolean {
    if (pattern === path) {
      return true
    }
    
    // Simple wildcard support
    if (pattern.endsWith('*')) {
      return path.startsWith(pattern.slice(0, -1))
    }
    
    if (pattern.startsWith('*')) {
      return path.endsWith(pattern.slice(1))
    }
    
    // Check if path starts with pattern (for directory matching)
    if (pattern.endsWith('/')) {
      return path.startsWith(pattern)
    }
    
    return path.startsWith(pattern + '/')
  }
  
  /**
   * Check for suspicious content in values
   */
  private containsSuspiciousContent(value: string): boolean {
    const suspiciousPatterns = [
      /javascript:/i,
      /vbscript:/i,
      /data:/i,
      /file:/i,
      /<script/i,
      /on\w+\s*=/i, // on event handlers
      /eval\s*\(/i,
      /expression\s*\(/i
    ]
    
    return suspiciousPatterns.some(pattern => pattern.test(value))
  }
  
  /**
   * Get current validation policy
   */
  getPolicy(): RedirectPolicy {
    return { ...this.policy }
  }
  
  /**
   * Update validation policy
   */
  updatePolicy(updates: Partial<RedirectPolicy>): void {
    this.policy = {
      ...this.policy,
      ...updates
    }
  }
}

// Default instance for common usage
export const redirectValidator = new RedirectUriValidator()

/**
 * Simple validation function for quick checks
 */
export function validateRedirectUri(
  redirectUri: string,
  baseUrl?: string
): RedirectValidationResult {
  return redirectValidator.validateRedirectUri(redirectUri, baseUrl)
}

/**
 * Validate and sanitize redirect URI for OAuth flows
 */
export function validateOAuthRedirect(
  redirectUri: string,
  allowedOrigins?: string[]
): RedirectValidationResult {
  const validator = new RedirectUriValidator({
    allowedOrigins: allowedOrigins || []
  })
  
  return validator.validateRedirectUri(redirectUri)
}

/**
 * Create a secure redirect URL with validation
 */
export function createSecureRedirectUrl(
  path: string,
  baseUrl?: string,
  params?: Record<string, string>
): string {
  try {
    const base = baseUrl || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const url = new URL(path, base)
    
    // Add query parameters if provided
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value)
      }
    }
    
    // Validate the constructed URL
    const validation = validateRedirectUri(url.toString(), base)
    
    if (!validation.valid) {
      console.warn('Redirect URL validation failed:', validation.error)
      // Return safe fallback
      return new URL('/dashboard', base).toString()
    }
    
    return validation.sanitizedUrl || url.toString()
    
  } catch (error) {
    console.error('Error creating secure redirect URL:', error)
    // Return safe fallback
    const fallbackBase = baseUrl || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    return new URL('/dashboard', fallbackBase).toString()
  }
}