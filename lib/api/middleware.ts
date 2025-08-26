/**
 * API Middleware Collection
 * Centralized middleware functions for API routes
 * Handles rate limiting, CSRF protection, and common security checks
 */

import { NextRequest } from 'next/server';
import { withRateLimit } from './rate-limit';
import { withCSRFProtection } from './csrf';
import { withSecurityMonitoring } from './security-monitoring';

export interface MiddlewareOptions {
  enableRateLimit?: boolean;
  enableCSRF?: boolean;
  enableSecurityMonitoring?: boolean;
  rateLimitConfig?: {
    maxRequests?: number;
    windowMs?: number;
  };
}

/**
 * Comprehensive API middleware wrapper
 */
export async function withAPIMiddleware(
  req: NextRequest,
  options: MiddlewareOptions = {}
): Promise<{
  allowed: boolean;
  error?: string;
  statusCode?: number;
  retryAfter?: number;
}> {
  const {
    enableRateLimit = true,
    enableCSRF = true,
    enableSecurityMonitoring = true,
    rateLimitConfig = {}
  } = options;

  try {
    // Security monitoring (always run first)
    if (enableSecurityMonitoring) {
      const securityResult = withSecurityMonitoring(req);
      if (securityResult.isSuspicious) {
        return {
          allowed: false,
          error: 'Request flagged as suspicious',
          statusCode: 403
        };
      }
    }

    // Rate limiting
    if (enableRateLimit) {
      const rateLimitResult = await withRateLimit(req);
      if (!rateLimitResult.success) {
        return {
          allowed: false,
          error: rateLimitResult.message || 'Rate limit exceeded',
          statusCode: 429,
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
        };
      }
    }

    // CSRF protection for state-changing operations
    if (enableCSRF && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const csrfResult = await withCSRFProtection(req);
      if (!csrfResult.success) {
        return {
          allowed: false,
          error: csrfResult.message || 'CSRF validation failed',
          statusCode: 403
        };
      }
    }

    return { allowed: true };

  } catch (error) {
    console.error('Middleware error:', error);
    return {
      allowed: false,
      error: 'Internal middleware error',
      statusCode: 500
    };
  }
}

/**
 * Simplified rate limit function for backward compatibility
 */
export async function rateLimit(
  identifier: string,
  operation: string,
  maxAttempts: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const mockRequest = {
    ip: identifier,
    method: 'POST',
    nextUrl: { pathname: `/api/${operation}` }
  } as NextRequest;

  const result = await withRateLimit(mockRequest);
  
  return {
    allowed: result.success,
    retryAfter: result.success ? undefined : Math.ceil((result.resetTime - Date.now()) / 1000)
  };
}

/**
 * Simplified CSRF validation function
 */
export async function validateCSRF(req: NextRequest): Promise<boolean> {
  const result = await withCSRFProtection(req);
  return result.success;
}

/**
 * Enhanced CSRF token validation with detailed response
 */
export async function validateCSRFToken(req: NextRequest): Promise<{ isValid: boolean; error?: string }> {
  const result = await withCSRFProtection(req);
  return {
    isValid: result.success,
    error: result.success ? undefined : result.message
  };
}

// Re-export common types
export type { RateLimitResult } from './rate-limit';
export type { CSRFResult } from './csrf';