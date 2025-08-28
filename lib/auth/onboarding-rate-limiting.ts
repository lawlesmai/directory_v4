/**
 * Onboarding-Specific Rate Limiting System
 * Epic 2 Story 2.5: User Onboarding and Email Verification Infrastructure
 * 
 * Advanced rate limiting with escalation, anti-spam, and abuse prevention
 */

import { supabase } from '@/lib/supabase/server';
import { Database } from '@/lib/supabase/database.types';

// Temporary type workarounds for missing database tables
type OnboardingRateLimit = any;
type OnboardingRateLimitInsert = any;

export interface RateLimitConfig {
  maxAttempts: number;
  windowDurationMinutes: number;
  escalationThreshold?: number;
  escalationActions?: string[];
  blockDurationMinutes?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
  escalationLevel?: number;
  isBlocked: boolean;
}

export class OnboardingRateLimitService {
  private readonly defaultConfigs: Record<string, RateLimitConfig> = {
    email_verification_send: {
      maxAttempts: 5,
      windowDurationMinutes: 60,
      escalationThreshold: 3,
      escalationActions: ['log_security_event', 'notify_admin'],
      blockDurationMinutes: 60,
    },
    email_resend: {
      maxAttempts: 3,
      windowDurationMinutes: 15,
      escalationThreshold: 2,
      escalationActions: ['temporary_block'],
      blockDurationMinutes: 30,
    },
    onboarding_step_attempt: {
      maxAttempts: 50,
      windowDurationMinutes: 60,
      escalationThreshold: 30,
      escalationActions: ['flag_suspicious_activity'],
    },
    business_document_upload: {
      maxAttempts: 20,
      windowDurationMinutes: 60,
      escalationThreshold: 15,
      escalationActions: ['require_verification', 'manual_review'],
      blockDurationMinutes: 120,
    },
    verification_request: {
      maxAttempts: 10,
      windowDurationMinutes: 60,
      escalationThreshold: 5,
      escalationActions: ['require_additional_verification'],
      blockDurationMinutes: 240,
    },
  };

  /**
   * Check and enforce rate limits
   */
  async checkRateLimit(
    identifier: string,
    identifierType: 'user_id' | 'email' | 'ip_address',
    action: 'email_verification_send' | 'email_resend' | 'onboarding_step_attempt' | 
           'business_document_upload' | 'verification_request',
    customConfig?: Partial<RateLimitConfig>
  ): Promise<RateLimitResult> {
    try {
      const config = { ...this.defaultConfigs[action], ...customConfig };
      const now = new Date();
      const windowStart = new Date(now.getTime() - config.windowDurationMinutes * 60 * 1000);

      // Get or create rate limit record
      const { data: existingRecord, error: findError } = await supabase
        .from('onboarding_rate_limits')
        .select('*')
        .eq('identifier', identifier)
        .eq('identifier_type', identifierType)
        .eq('action', action)
        .gte('window_start', windowStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (findError && findError.code !== 'PGRST116') {
        throw findError;
      }

      let rateLimitRecord: OnboardingRateLimit;

      if (existingRecord) {
        rateLimitRecord = existingRecord;

        // Check if blocked
        if (rateLimitRecord.is_blocked && rateLimitRecord.blocked_until) {
          const blockedUntil = new Date(rateLimitRecord.blocked_until);
          
          if (now < blockedUntil) {
            return {
              allowed: false,
              remaining: 0,
              resetAt: blockedUntil,
              retryAfter: Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000),
              escalationLevel: rateLimitRecord.escalation_level,
              isBlocked: true,
            };
          } else {
            // Unblock if time has passed
            await this.unblockIdentifier(rateLimitRecord.id);
            rateLimitRecord.is_blocked = false;
          }
        }

        // Check if within rate limit
        if (rateLimitRecord.attempts >= rateLimitRecord.max_attempts) {
          // Escalate if necessary
          await this.handleEscalation(rateLimitRecord, config);

          return {
            allowed: false,
            remaining: 0,
            resetAt: new Date(rateLimitRecord.window_start),
            escalationLevel: rateLimitRecord.escalation_level,
            isBlocked: rateLimitRecord.is_blocked,
          };
        }

        // Increment attempt count
        const { data: updatedRecord, error: updateError } = await supabase
          .from('onboarding_rate_limits')
          .update({
            attempts: rateLimitRecord.attempts + 1,
            updated_at: now.toISOString(),
          })
          .eq('id', rateLimitRecord.id)
          .select()
          .single();

        if (updateError) throw updateError;

        rateLimitRecord = updatedRecord;

      } else {
        // Create new rate limit record
        const newRecord: OnboardingRateLimitInsert = {
          identifier,
          identifier_type: identifierType,
          action,
          attempts: 1,
          window_start: now.toISOString(),
          window_duration_minutes: config.windowDurationMinutes,
          max_attempts: config.maxAttempts,
          escalation_level: 1,
        };

        const { data: createdRecord, error: createError } = await supabase
          .from('onboarding_rate_limits')
          .insert(newRecord)
          .select()
          .single();

        if (createError) throw createError;

        rateLimitRecord = createdRecord;
      }

      const remaining = Math.max(0, rateLimitRecord.max_attempts - rateLimitRecord.attempts);
      const windowEnd = new Date(
        new Date(rateLimitRecord.window_start).getTime() + 
        config.windowDurationMinutes * 60 * 1000
      );

      return {
        allowed: true,
        remaining,
        resetAt: windowEnd,
        escalationLevel: rateLimitRecord.escalation_level,
        isBlocked: false,
      };

    } catch (error) {
      console.error('Error checking rate limit:', error);
      
      // Fail open for availability, but log the error
      return {
        allowed: true,
        remaining: 1,
        resetAt: new Date(Date.now() + 60 * 60 * 1000),
        isBlocked: false,
      };
    }
  }

  /**
   * Handle escalation when rate limits are exceeded
   */
  private async handleEscalation(
    record: OnboardingRateLimit,
    config: RateLimitConfig
  ): Promise<void> {
    const escalationThreshold = config.escalationThreshold || config.maxAttempts;
    
    if (record.attempts >= escalationThreshold) {
      const newEscalationLevel = record.escalation_level + 1;
      const escalationActions = config.escalationActions || [];

      // Apply escalation actions
      for (const action of escalationActions) {
        await this.executeEscalationAction(action, record, newEscalationLevel);
      }

      // Block if configured
      if (config.blockDurationMinutes) {
        const blockedUntil = new Date(
          Date.now() + config.blockDurationMinutes * 60 * 1000
        );

        await supabase
          .from('onboarding_rate_limits')
          .update({
            escalation_level: newEscalationLevel,
            escalation_actions: escalationActions,
            is_blocked: true,
            blocked_until: blockedUntil.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', record.id);
      } else {
        await supabase
          .from('onboarding_rate_limits')
          .update({
            escalation_level: newEscalationLevel,
            escalation_actions: escalationActions,
            updated_at: new Date().toISOString(),
          })
          .eq('id', record.id);
      }
    }
  }

  /**
   * Execute escalation action
   */
  private async executeEscalationAction(
    action: string,
    record: OnboardingRateLimit,
    escalationLevel: number
  ): Promise<void> {
    switch (action) {
      case 'log_security_event':
        await this.logSecurityEvent(record, escalationLevel);
        break;
        
      case 'notify_admin':
        await this.notifyAdmins(record, escalationLevel);
        break;
        
      case 'temporary_block':
        // Already handled in handleEscalation
        break;
        
      case 'flag_suspicious_activity':
        await this.flagSuspiciousActivity(record);
        break;
        
      case 'require_verification':
        await this.requireAdditionalVerification(record);
        break;
        
      case 'manual_review':
        await this.triggerManualReview(record);
        break;
        
      default:
        console.warn(`Unknown escalation action: ${action}`);
    }
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(
    record: OnboardingRateLimit,
    escalationLevel: number
  ): Promise<void> {
    try {
      await supabase
        .from('security_events')
        .insert([{
          event_type: 'rate_limit_exceeded',
          severity: escalationLevel > 2 ? 'high' : 'medium',
          description: `Rate limit exceeded for ${record.action}`,
          details: {
            identifier: record.identifier,
            identifierType: record.identifier_type,
            action: record.action,
            attempts: record.attempts,
            escalationLevel,
          },
          action_taken: 'rate_limit_applied',
        }]);
    } catch (error) {
      console.error('Error logging security event:', error);
    }
  }

  /**
   * Notify administrators of suspicious activity
   */
  private async notifyAdmins(
    record: OnboardingRateLimit,
    escalationLevel: number
  ): Promise<void> {
    // In a real implementation, this would send notifications to admins
    console.log(`ADMIN NOTIFICATION: Rate limit escalation level ${escalationLevel} for ${record.identifier} on action ${record.action}`);
  }

  /**
   * Flag suspicious activity
   */
  private async flagSuspiciousActivity(record: OnboardingRateLimit): Promise<void> {
    // This would integrate with a fraud detection system
    console.log(`SUSPICIOUS ACTIVITY: ${record.identifier} performing ${record.action} excessively`);
  }

  /**
   * Require additional verification
   */
  private async requireAdditionalVerification(record: OnboardingRateLimit): Promise<void> {
    // This would trigger additional verification steps
    console.log(`ADDITIONAL VERIFICATION REQUIRED: ${record.identifier}`);
  }

  /**
   * Trigger manual review
   */
  private async triggerManualReview(record: OnboardingRateLimit): Promise<void> {
    // This would create a manual review task
    console.log(`MANUAL REVIEW TRIGGERED: ${record.identifier} for ${record.action}`);
  }

  /**
   * Unblock identifier
   */
  private async unblockIdentifier(recordId: string): Promise<void> {
    await supabase
      .from('onboarding_rate_limits')
      .update({
        is_blocked: false,
        blocked_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordId);
  }

  /**
   * Get rate limit status for identifier
   */
  async getRateLimitStatus(
    identifier: string,
    identifierType: 'user_id' | 'email' | 'ip_address',
    action: string
  ): Promise<{
    isLimited: boolean;
    attempts: number;
    maxAttempts: number;
    remaining: number;
    resetAt?: Date;
    isBlocked: boolean;
    blockedUntil?: Date;
  }> {
    try {
      const now = new Date();
      
      const { data: record, error } = await supabase
        .from('onboarding_rate_limits')
        .select('*')
        .eq('identifier', identifier)
        .eq('identifier_type', identifierType)
        .eq('action', action)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!record) {
        return {
          isLimited: false,
          attempts: 0,
          maxAttempts: this.defaultConfigs[action]?.maxAttempts || 10,
          remaining: this.defaultConfigs[action]?.maxAttempts || 10,
          isBlocked: false,
        };
      }

      const windowEnd = new Date(
        new Date(record.window_start).getTime() + 
        record.window_duration_minutes * 60 * 1000
      );

      const remaining = Math.max(0, record.max_attempts - record.attempts);
      const isLimited = record.attempts >= record.max_attempts && now < windowEnd;
      const isBlocked = record.is_blocked && record.blocked_until && 
        now < new Date(record.blocked_until);

      return {
        isLimited,
        attempts: record.attempts,
        maxAttempts: record.max_attempts,
        remaining,
        resetAt: windowEnd,
        isBlocked: !!isBlocked,
        blockedUntil: record.blocked_until ? new Date(record.blocked_until) : undefined,
      };

    } catch (error) {
      console.error('Error getting rate limit status:', error);
      return {
        isLimited: false,
        attempts: 0,
        maxAttempts: 10,
        remaining: 10,
        isBlocked: false,
      };
    }
  }

  /**
   * Clean up expired rate limit records
   */
  async cleanupExpiredRecords(): Promise<{ deletedCount: number }> {
    try {
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

      const { data, error } = await supabase
        .from('onboarding_rate_limits')
        .delete()
        .lt('window_start', cutoffTime.toISOString())
        .eq('is_blocked', false)
        .select('id');

      if (error) throw error;

      return { deletedCount: data?.length || 0 };

    } catch (error) {
      console.error('Error cleaning up expired rate limit records:', error);
      return { deletedCount: 0 };
    }
  }

  /**
   * Reset rate limits for identifier (admin function)
   */
  async resetRateLimits(
    identifier: string,
    identifierType: 'user_id' | 'email' | 'ip_address',
    action?: string
  ): Promise<boolean> {
    try {
      let query = supabase
        .from('onboarding_rate_limits')
        .delete()
        .eq('identifier', identifier)
        .eq('identifier_type', identifierType);

      if (action) {
        query = query.eq('action', action);
      }

      const { error } = await query;

      if (error) throw error;

      return true;

    } catch (error) {
      console.error('Error resetting rate limits:', error);
      return false;
    }
  }

  /**
   * Get rate limiting analytics
   */
  async getRateLimitAnalytics(
    dateRange: { from: Date; to: Date }
  ): Promise<{
    totalLimits: number;
    blockedRequests: number;
    topActions: Array<{ action: string; count: number }>;
    topIdentifiers: Array<{ identifier: string; count: number }>;
    escalationCounts: Record<number, number>;
  }> {
    try {
      const { data: records, error } = await supabase
        .from('onboarding_rate_limits')
        .select('*')
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString());

      if (error) throw error;

      const totalLimits = records?.length || 0;
      const blockedRequests = records?.filter((r: any) => r.is_blocked).length || 0;

      // Calculate top actions
      const actionCounts: Record<string, number> = {};
      const identifierCounts: Record<string, number> = {};
      const escalationCounts: Record<number, number> = {};

      records?.forEach((record: any) => {
        actionCounts[record.action] = (actionCounts[record.action] || 0) + 1;
        identifierCounts[record.identifier] = (identifierCounts[record.identifier] || 0) + 1;
        escalationCounts[record.escalation_level] = (escalationCounts[record.escalation_level] || 0) + 1;
      });

      const topActions = Object.entries(actionCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([action, count]) => ({ action, count }));

      const topIdentifiers = Object.entries(identifierCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([identifier, count]) => ({ identifier, count }));

      return {
        totalLimits,
        blockedRequests,
        topActions,
        topIdentifiers,
        escalationCounts,
      };

    } catch (error) {
      console.error('Error getting rate limit analytics:', error);
      return {
        totalLimits: 0,
        blockedRequests: 0,
        topActions: [],
        topIdentifiers: [],
        escalationCounts: {},
      };
    }
  }
}

// Export singleton instance
export const onboardingRateLimitService = new OnboardingRateLimitService();

// Export utility functions
export const getClientIP = (request: Request): string => {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP.trim();
  }
  
  return 'unknown';
};

export const generateRateLimitKey = (
  userId?: string, 
  email?: string, 
  ip?: string
): { identifier: string; type: 'user_id' | 'email' | 'ip_address' } => {
  if (userId) {
    return { identifier: userId, type: 'user_id' };
  }
  
  if (email) {
    return { identifier: email, type: 'email' };
  }
  
  return { identifier: ip || 'unknown', type: 'ip_address' };
};