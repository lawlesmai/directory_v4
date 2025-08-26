import { NextRequest } from 'next/server';

interface RateLimitOptions {
  windowMs?: number; // Time window in milliseconds
  maxRequests?: number; // Max requests per window
  identifier?: (req: NextRequest) => string; // Function to identify unique users
  message?: string; // Custom rate limit exceeded message
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  message?: string;
}

class RateLimiter {
  private requests = new Map<string, { count: number; resetTime: number }>();

  constructor(private options: RateLimitOptions = {}) {
    // Default options
    this.options = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // 100 requests per window
      identifier: (req) => req.ip || 'unknown',
      message: 'Too many requests, please try again later.',
      ...options,
    };
  }

  async limit(req: NextRequest): Promise<RateLimitResult> {
    const identifier = this.options.identifier!(req);
    const now = Date.now();
    const windowMs = this.options.windowMs!;
    const maxRequests = this.options.maxRequests!;

    // Clean up expired entries
    this.cleanup(now);

    const userRequests = this.requests.get(identifier) || {
      count: 0,
      resetTime: now + windowMs,
    };

    // If the window has expired, reset the count
    if (now > userRequests.resetTime) {
      userRequests.count = 0;
      userRequests.resetTime = now + windowMs;
    }

    userRequests.count++;
    this.requests.set(identifier, userRequests);

    const remaining = Math.max(0, maxRequests - userRequests.count);
    const success = userRequests.count <= maxRequests;

    return {
      success,
      limit: maxRequests,
      remaining,
      resetTime: userRequests.resetTime,
      message: success ? undefined : this.options.message,
    };
  }

  private cleanup(now: number) {
    for (const [key, value] of this.requests.entries()) {
      if (now > value.resetTime) {
        this.requests.delete(key);
      }
    }
  }
}

// Pre-configured rate limiters
export const defaultRateLimiter = new RateLimiter();

export const strictRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 requests per window
  message: 'Rate limit exceeded. Please wait before making more requests.',
});

export const authRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5, // 5 auth attempts per hour
  message: 'Too many authentication attempts. Please wait before trying again.',
});

// Helper function to apply rate limiting to API routes
export async function withRateLimit(
  req: NextRequest,
  rateLimiter: RateLimiter = defaultRateLimiter
): Promise<RateLimitResult> {
  return rateLimiter.limit(req);
}

// Simple rate limit function for backward compatibility
export async function rateLimit(
  identifier: string,
  operation: string,
  maxAttempts: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const rateLimiter = new RateLimiter({
    windowMs,
    maxRequests: maxAttempts,
    identifier: () => identifier,
  });

  // Create a mock NextRequest for the rate limiter
  const mockRequest = {
    ip: identifier,
  } as any;

  const result = await rateLimiter.limit(mockRequest);
  
  return {
    allowed: result.success,
    retryAfter: result.success ? undefined : Math.ceil((result.resetTime - Date.now()) / 1000)
  };
}

export { RateLimiter };
export type { RateLimitOptions, RateLimitResult };
