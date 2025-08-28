/**
 * OAuth Rate Limiting Module - Security Enhancement
 * 
 * Implements sophisticated rate limiting for OAuth endpoints
 * Prevents abuse, brute force attacks, and DoS attempts
 */

import { createClient } from '@/lib/supabase/server'

export interface RateLimitResult {
  allowed: boolean
  error?: string
  retryAfter?: number
  remaining?: number
  resetTime?: number
}

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  blockDurationMs?: number
  skipSuccessful?: boolean
}

export interface RateLimitRule {
  endpoint: string
  config: RateLimitConfig
  keyGenerator?: (request: any) => string
}

/**
 * OAuth-specific rate limiting configurations
 */
const OAUTH_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // OAuth initiation - prevent scanning/enumeration
  'oauth_initiation': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5, // 5 attempts per minute per IP
    blockDurationMs: 5 * 60 * 1000 // Block for 5 minutes after limit
  },
  
  // OAuth callback - prevent code reuse attacks
  'oauth_callback': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 callbacks per minute per IP
    blockDurationMs: 10 * 60 * 1000, // Block for 10 minutes after limit
    skipSuccessful: true // Don't count successful authentications
  },
  
  // Account linking - prevent account takeover attempts
  'account_linking': {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 3, // 3 linking attempts per 5 minutes per user
    blockDurationMs: 30 * 60 * 1000 // Block for 30 minutes after limit
  },
  
  // Password reset via OAuth
  'oauth_password_reset': {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 2, // 2 reset attempts per 15 minutes per email
    blockDurationMs: 60 * 60 * 1000 // Block for 1 hour after limit
  },
  
  // Token refresh - prevent token harvesting
  'token_refresh': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 refreshes per minute per connection
    blockDurationMs: 15 * 60 * 1000 // Block for 15 minutes after limit
  }
}

/**
 * OAuth Rate Limiter with multiple strategies
 */
export class OAuthRateLimiter {
  private supabase = createClient()
  
  /**
   * Check if request is rate limited
   */
  async checkRateLimit(
    limitType: string,
    identifier: string,
    additionalContext?: Record<string, any>
  ): Promise<RateLimitResult> {
    try {
      const config = OAUTH_RATE_LIMITS[limitType]
      if (!config) {
        console.warn(`No rate limit config for type: ${limitType}`)
        return { allowed: true }
      }
      
      const now = Date.now()
      const windowStart = now - config.windowMs
      
      // Get current rate limit state
      const rateLimitState = await this.getRateLimitState(
        limitType,
        identifier,
        windowStart,
        now
      )
      
      // Check if currently blocked
      if (rateLimitState.blocked && rateLimitState.blockUntil > now) {
        const retryAfter = Math.ceil((rateLimitState.blockUntil - now) / 1000)
        
        await this.logRateLimitEvent({
          limitType,
          identifier,
          action: 'blocked',
          context: additionalContext
        })
        
        return {
          allowed: false,
          error: 'Rate limit exceeded - temporarily blocked',
          retryAfter
        }
      }
      
      // Check current request count
      if (rateLimitState.currentCount >= config.maxRequests) {
        // Apply block if configured
        const blockUntil = config.blockDurationMs 
          ? now + config.blockDurationMs 
          : null
        
        await this.updateRateLimitBlock(limitType, identifier, blockUntil)
        
        const retryAfter = blockUntil 
          ? Math.ceil((blockUntil - now) / 1000)
          : Math.ceil(config.windowMs / 1000)
        
        await this.logRateLimitEvent({
          limitType,
          identifier,
          action: 'limit_exceeded',
          blockUntil,
          context: additionalContext
        })
        
        return {
          allowed: false,
          error: 'Rate limit exceeded',
          retryAfter
        }
      }
      
      // Record this request
      await this.recordRateLimitRequest(limitType, identifier, now)
      
      const remaining = Math.max(0, config.maxRequests - rateLimitState.currentCount - 1)
      const resetTime = windowStart + config.windowMs
      
      return {
        allowed: true,
        remaining,
        resetTime
      }
      
    } catch (error) {
      console.error('Rate limit check error:', error)
      // Fail open - allow request on error
      return { allowed: true }
    }
  }
  
  /**
   * Record successful OAuth operation (may affect future rate limits)
   */
  async recordSuccess(
    limitType: string,
    identifier: string,
    context?: Record<string, any>
  ): Promise<void> {
    try {
      const config = OAUTH_RATE_LIMITS[limitType]
      
      // If configured to skip successful requests, decrement counter
      if (config?.skipSuccessful) {
        await this.decrementRateLimitCounter(limitType, identifier)
      }
      
      await this.logRateLimitEvent({
        limitType,
        identifier,
        action: 'success',
        context
      })
      
    } catch (error) {
      console.error('Error recording success:', error)
    }
  }
  
  /**
   * Record failed OAuth operation (increases penalty)
   */
  async recordFailure(
    limitType: string,
    identifier: string,
    failureType: string,
    context?: Record<string, any>
  ): Promise<void> {
    try {
      // Apply additional penalties for certain failure types
      let penaltyMultiplier = 1
      
      switch (failureType) {
        case 'invalid_credentials':
          penaltyMultiplier = 2
          break
        case 'suspicious_activity':
          penaltyMultiplier = 5
          break
        case 'security_violation':
          penaltyMultiplier = 10
          break
      }
      
      // Record additional penalty requests
      const now = Date.now()
      for (let i = 0; i < penaltyMultiplier - 1; i++) {
        await this.recordRateLimitRequest(limitType, identifier, now + i)
      }
      
      await this.logRateLimitEvent({
        limitType,
        identifier,
        action: 'failure',
        failureType,
        penaltyMultiplier,
        context
      })
      
    } catch (error) {
      console.error('Error recording failure:', error)
    }
  }
  
  /**
   * Clear rate limit for identifier (admin function)
   */
  async clearRateLimit(limitType: string, identifier: string): Promise<void> {
    try {
      await this.supabase
        .from('rate_limit_requests')
        .delete()
        .eq('limit_type', limitType)
        .eq('identifier', identifier)
      
      await this.supabase
        .from('rate_limit_blocks')
        .delete()
        .eq('limit_type', limitType)
        .eq('identifier', identifier)
      
      await this.logRateLimitEvent({
        limitType,
        identifier,
        action: 'cleared'
      })
      
    } catch (error) {
      console.error('Error clearing rate limit:', error)
      throw error
    }
  }
  
  /**
   * Get rate limit status for monitoring
   */
  async getRateLimitStatus(
    limitType: string,
    identifier: string
  ): Promise<{
    currentCount: number
    maxRequests: number
    windowMs: number
    blocked: boolean
    blockUntil?: number
    nextReset: number
  }> {
    const config = OAUTH_RATE_LIMITS[limitType]
    if (!config) {
      throw new Error(`Unknown rate limit type: ${limitType}`)
    }
    
    const now = Date.now()
    const windowStart = now - config.windowMs
    
    const state = await this.getRateLimitState(limitType, identifier, windowStart, now)
    
    return {
      currentCount: state.currentCount,
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      blocked: state.blocked && state.blockUntil > now,
      blockUntil: state.blocked ? state.blockUntil : undefined,
      nextReset: windowStart + config.windowMs
    }
  }
  
  // Private methods
  
  private async getRateLimitState(
    limitType: string,
    identifier: string,
    windowStart: number,
    now: number
  ): Promise<{
    currentCount: number
    blocked: boolean
    blockUntil: number
  }> {
    // Get request count in current window
    const { count: currentCount } = await this.supabase
      .from('rate_limit_requests')
      .select('*', { count: 'exact', head: true })
      .eq('limit_type', limitType)
      .eq('identifier', identifier)
      .gte('created_at', new Date(windowStart).toISOString())
      .lte('created_at', new Date(now).toISOString())
    
    // Check if blocked
    const { data: blockData } = await this.supabase
      .from('rate_limit_blocks')
      .select('block_until')
      .eq('limit_type', limitType)
      .eq('identifier', identifier)
      .gte('block_until', new Date(now).toISOString())
      .maybeSingle()
    
    return {
      currentCount: currentCount || 0,
      blocked: !!blockData,
      blockUntil: blockData ? new Date(blockData.block_until).getTime() : 0
    }
  }
  
  private async recordRateLimitRequest(
    limitType: string,
    identifier: string,
    timestamp: number
  ): Promise<void> {
    await this.supabase
      .from('rate_limit_requests')
      .insert([{
        limit_type: limitType,
        identifier,
        created_at: new Date(timestamp).toISOString()
      }])
  }
  
  private async updateRateLimitBlock(
    limitType: string,
    identifier: string,
    blockUntil: number | null
  ): Promise<void> {
    if (!blockUntil) return
    
    await this.supabase
      .from('rate_limit_blocks')
      .upsert({
        limit_type: limitType,
        identifier,
        block_until: new Date(blockUntil).toISOString(),
        created_at: new Date().toISOString()
      })
  }
  
  private async decrementRateLimitCounter(
    limitType: string,
    identifier: string
  ): Promise<void> {
    // Remove one request from the current window
    const { data: oldestRequest } = await this.supabase
      .from('rate_limit_requests')
      .select('id')
      .eq('limit_type', limitType)
      .eq('identifier', identifier)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    
    if (oldestRequest) {
      await this.supabase
        .from('rate_limit_requests')
        .delete()
        .eq('id', oldestRequest.id)
    }
  }
  
  private async logRateLimitEvent(event: {
    limitType: string
    identifier: string
    action: string
    failureType?: string
    penaltyMultiplier?: number
    blockUntil?: number | null
    context?: Record<string, any>
  }): Promise<void> {
    try {
      await (this.supabase as any).from('auth_audit_logs').insert({
        event_type: 'rate_limit_event',
        event_category: 'security',
        success: event.action === 'success',
        event_data: {
          limit_type: event.limitType,
          identifier: event.identifier,
          action: event.action,
          failure_type: event.failureType,
          penalty_multiplier: event.penaltyMultiplier,
          block_until: event.blockUntil,
          ...event.context
        }
      })
    } catch (error) {
      console.error('Failed to log rate limit event:', error)
    }
  }
}

// Singleton instance
export const oauthRateLimiter = new OAuthRateLimiter()

/**
 * Middleware-style rate limiting function
 */
export async function checkOAuthRateLimit(
  limitType: string,
  identifier: string,
  context?: Record<string, any>
): Promise<RateLimitResult> {
  return oauthRateLimiter.checkRateLimit(limitType, identifier, context)
}

/**
 * Generate rate limit identifier for IP-based limiting
 */
export function getIpIdentifier(request: any): string {
  // Get real IP address, handling proxies
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const directIp = request.ip
  
  const ip = forwardedFor?.split(',')[0] || realIp || directIp || 'unknown'
  
  return `ip:${ip}`
}

/**
 * Generate rate limit identifier for user-based limiting
 */
export function getUserIdentifier(userId: string): string {
  return `user:${userId}`
}

/**
 * Generate rate limit identifier for email-based limiting
 */
export function getEmailIdentifier(email: string): string {
  return `email:${email.toLowerCase()}`
}

/**
 * Generate rate limit identifier for provider-specific limiting
 */
export function getProviderIdentifier(provider: string, providerUserId: string): string {
  return `provider:${provider}:${providerUserId}`
}