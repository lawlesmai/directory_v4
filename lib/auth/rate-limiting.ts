/**
 * Rate Limiting and Security Controls for MFA
 * Advanced rate limiting with adaptive thresholds and abuse prevention
 * 
 * The Lawless Directory - Epic 2 Story 2.4
 * Multi-Factor Authentication Infrastructure
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { MFAAuditLogger } from './mfa-audit';

// Configuration for rate limiting
const RATE_LIMIT_CONFIG = {
  // MFA verification attempts
  mfaVerification: {
    maxAttempts: 5,
    windowMinutes: 10,
    escalationSteps: [
      { attempts: 3, cooldownMinutes: 5 },
      { attempts: 5, cooldownMinutes: 15 },
      { attempts: 10, cooldownMinutes: 60 },
      { attempts: 15, cooldownMinutes: 240 } // 4 hours
    ]
  },
  
  // SMS requests
  smsRequests: {
    maxAttempts: 3,
    windowMinutes: 60,
    dailyLimit: 10,
    escalationSteps: [
      { attempts: 3, cooldownMinutes: 30 },
      { attempts: 6, cooldownMinutes: 120 },
      { attempts: 10, cooldownMinutes: 480 } // 8 hours
    ]
  },
  
  // TOTP attempts
  totpAttempts: {
    maxAttempts: 10,
    windowMinutes: 15,
    escalationSteps: [
      { attempts: 5, cooldownMinutes: 2 },
      { attempts: 10, cooldownMinutes: 10 },
      { attempts: 20, cooldownMinutes: 60 }
    ]
  },
  
  // Backup code attempts
  backupCodeAttempts: {
    maxAttempts: 3,
    windowMinutes: 30,
    escalationSteps: [
      { attempts: 3, cooldownMinutes: 30 },
      { attempts: 6, cooldownMinutes: 120 },
      { attempts: 10, cooldownMinutes: 480 }
    ]
  },
  
  // Recovery requests
  recoveryRequests: {
    maxAttempts: 3,
    windowHours: 24,
    weeklyLimit: 5,
    escalationSteps: [
      { attempts: 2, cooldownHours: 2 },
      { attempts: 3, cooldownHours: 8 },
      { attempts: 5, cooldownHours: 24 }
    ]
  },
  
  // Admin overrides
  adminOverrides: {
    maxAttempts: 10,
    windowMinutes: 60,
    dailyLimit: 20,
    escalationSteps: [
      { attempts: 5, cooldownMinutes: 15 },
      { attempts: 10, cooldownMinutes: 60 },
      { attempts: 15, cooldownMinutes: 240 }
    ]
  },
  
  // IP-based limits
  ipLimits: {
    maxFailuresPerHour: 20,
    maxFailuresPerDay: 100,
    suspiciousThreshold: 50,
    blockDurationHours: 1
  },
  
  // Device-based limits  
  deviceLimits: {
    maxFailuresPerHour: 15,
    maxFailuresPerDay: 50,
    newDevicePenalty: 2, // Multiplier for new devices
    untrustedDevicePenalty: 1.5
  },
  
  // Adaptive thresholds
  adaptive: {
    enabled: true,
    baselineWindowDays: 7,
    anomalyThreshold: 3.0, // Standard deviations
    adaptiveCooldownMultiplier: 1.5
  }
} as const;

// Initialize Supabase client
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Rate Limit Check Result Interface
 */
interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  resetTime: Date;
  cooldownUntil?: Date;
  escalationLevel: number;
  reason?: string;
  blockedUntil?: Date;
}

/**
 * Security Context Interface
 */
interface SecurityContext {
  userId?: string;
  ipAddress: string;
  deviceId?: string;
  userAgent: string;
  method: string;
  isNewDevice?: boolean;
  deviceTrustScore?: number;
  riskScore?: number;
}

/**
 * Rate Limiter Service
 */
export class RateLimiterService {
  /**
   * Checks if an MFA operation is rate limited
   */
  static async checkRateLimit(
    operation: 'mfa_verification' | 'sms_request' | 'totp_attempt' | 'backup_code_attempt' | 'recovery_request' | 'admin_override',
    context: SecurityContext
  ): Promise<RateLimitResult> {
    try {
      // Get operation-specific configuration
      const config = this.getOperationConfig(operation);
      
      // Check multiple rate limit layers
      const [userLimit, ipLimit, deviceLimit] = await Promise.all([
        context.userId ? this.checkUserRateLimit(operation, context.userId, config) : null,
        this.checkIPRateLimit(operation, context.ipAddress, config),
        context.deviceId ? this.checkDeviceRateLimit(operation, context.deviceId, config, context) : null
      ]);
      
      // Find most restrictive limit
      const limits = [userLimit, ipLimit, deviceLimit].filter(Boolean);
      const mostRestrictive = limits.reduce((most, current) => {
        if (!most) return current;
        if (!current) return most;
        
        // Most restrictive is the one that blocks or has longest cooldown
        if (!current.allowed && most.allowed) return current;
        if (!most.allowed && current.allowed) return most;
        if (!current.allowed && !most.allowed) {
          return (current.cooldownUntil?.getTime() || 0) > (most.cooldownUntil?.getTime() || 0) ? current : most;
        }
        
        return current.remainingAttempts < most.remainingAttempts ? current : most;
      });
      
      if (!mostRestrictive) {
        return {
          allowed: true,
          remainingAttempts: config.maxAttempts,
          resetTime: new Date(Date.now() + config.windowMinutes * 60 * 1000),
          escalationLevel: 0
        };
      }
      
      // Log rate limit decision
      await this.logRateLimitDecision(operation, context, mostRestrictive);
      
      return mostRestrictive;
      
    } catch (error) {
      console.error('Rate limit check error:', error);
      // Fail open but log the error
      return {
        allowed: true,
        remainingAttempts: 1,
        resetTime: new Date(Date.now() + 60 * 1000),
        escalationLevel: 0,
        reason: 'rate_limit_check_failed'
      };
    }
  }
  
  /**
   * Records an attempt (successful or failed)
   */
  static async recordAttempt(
    operation: string,
    context: SecurityContext,
    success: boolean
  ): Promise<void> {
    try {
      const now = new Date();
      
      // Record in rate limits table
      await supabase
        .from('mfa_rate_limits')
        .insert({
          user_id: context.userId,
          ip_address: context.ipAddress,
          device_id: context.deviceId,
          limit_type: operation,
          window_duration_minutes: this.getOperationConfig(operation).windowMinutes,
          max_attempts: this.getOperationConfig(operation).maxAttempts,
          attempts: 1
        });
      
      // Update aggregate statistics
      await this.updateRateLimitStats(operation, context, success);
      
      // Check for escalation
      if (!success) {
        await this.checkEscalation(operation, context);
      }
      
    } catch (error) {
      console.error('Error recording rate limit attempt:', error);
    }
  }
  
  /**
   * Checks user-specific rate limits
   */
  private static async checkUserRateLimit(
    operation: string,
    userId: string,
    config: any
  ): Promise<RateLimitResult> {
    const windowStart = new Date(Date.now() - config.windowMinutes * 60 * 1000);
    
    const { count: attempts } = await supabase
      .from('mfa_rate_limits')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('limit_type', operation)
      .gte('created_at', windowStart.toISOString());
    
    const currentAttempts = attempts || 0;
    
    // Check for existing blocks
    const { data: existingBlock } = await supabase
      .from('mfa_rate_limits')
      .select('blocked_until')
      .eq('user_id', userId)
      .eq('limit_type', operation)
      .eq('is_blocked', true)
      .gt('blocked_until', new Date().toISOString())
      .single();
    
    if (existingBlock) {
      return {
        allowed: false,
        remainingAttempts: 0,
        resetTime: new Date(windowStart.getTime() + config.windowMinutes * 60 * 1000),
        cooldownUntil: new Date(existingBlock.blocked_until),
        escalationLevel: this.getEscalationLevel(currentAttempts, config),
        reason: 'user_blocked'
      };
    }
    
    const escalationLevel = this.getEscalationLevel(currentAttempts, config);
    const escalationRule = config.escalationSteps?.[escalationLevel];
    
    if (currentAttempts >= config.maxAttempts) {
      const cooldownUntil = new Date(Date.now() + (escalationRule?.cooldownMinutes || 30) * 60 * 1000);
      
      // Create block record
      await supabase
        .from('mfa_rate_limits')
        .insert({
          user_id: userId,
          limit_type: operation,
          attempts: currentAttempts,
          window_duration_minutes: config.windowMinutes,
          max_attempts: config.maxAttempts,
          is_blocked: true,
          blocked_until: cooldownUntil.toISOString()
        });
      
      return {
        allowed: false,
        remainingAttempts: 0,
        resetTime: new Date(windowStart.getTime() + config.windowMinutes * 60 * 1000),
        cooldownUntil,
        escalationLevel,
        reason: 'max_attempts_exceeded'
      };
    }
    
    return {
      allowed: true,
      remainingAttempts: config.maxAttempts - currentAttempts,
      resetTime: new Date(windowStart.getTime() + config.windowMinutes * 60 * 1000),
      escalationLevel
    };
  }
  
  /**
   * Checks IP-based rate limits
   */
  private static async checkIPRateLimit(
    operation: string,
    ipAddress: string,
    config: any
  ): Promise<RateLimitResult> {
    const windowStart = new Date(Date.now() - config.windowMinutes * 60 * 1000);
    
    const { count: attempts } = await supabase
      .from('mfa_rate_limits')
      .select('*', { count: 'exact' })
      .eq('ip_address', ipAddress)
      .eq('limit_type', operation)
      .gte('created_at', windowStart.toISOString());
    
    const currentAttempts = attempts || 0;
    const ipConfig = RATE_LIMIT_CONFIG.ipLimits;
    
    // Check hourly failures
    const hourlyFailures = await this.getIPFailures(ipAddress, 1);
    if (hourlyFailures >= ipConfig.maxFailuresPerHour) {
      const blockedUntil = new Date(Date.now() + ipConfig.blockDurationHours * 60 * 60 * 1000);
      
      return {
        allowed: false,
        remainingAttempts: 0,
        resetTime: new Date(windowStart.getTime() + config.windowMinutes * 60 * 1000),
        blockedUntil,
        escalationLevel: 3,
        reason: 'ip_blocked_hourly_limit'
      };
    }
    
    // Check daily failures
    const dailyFailures = await this.getIPFailures(ipAddress, 24);
    if (dailyFailures >= ipConfig.maxFailuresPerDay) {
      const blockedUntil = new Date(Date.now() + ipConfig.blockDurationHours * 60 * 60 * 1000);
      
      return {
        allowed: false,
        remainingAttempts: 0,
        resetTime: new Date(windowStart.getTime() + config.windowMinutes * 60 * 1000),
        blockedUntil,
        escalationLevel: 4,
        reason: 'ip_blocked_daily_limit'
      };
    }
    
    const escalationLevel = this.getEscalationLevel(currentAttempts, config);
    const maxAttempts = config.maxAttempts * (hourlyFailures > ipConfig.suspiciousThreshold ? 0.5 : 1);
    
    return {
      allowed: currentAttempts < maxAttempts,
      remainingAttempts: Math.max(0, maxAttempts - currentAttempts),
      resetTime: new Date(windowStart.getTime() + config.windowMinutes * 60 * 1000),
      escalationLevel
    };
  }
  
  /**
   * Checks device-based rate limits
   */
  private static async checkDeviceRateLimit(
    operation: string,
    deviceId: string,
    config: any,
    context: SecurityContext
  ): Promise<RateLimitResult> {
    const windowStart = new Date(Date.now() - config.windowMinutes * 60 * 1000);
    
    const { count: attempts } = await supabase
      .from('mfa_rate_limits')
      .select('*', { count: 'exact' })
      .eq('device_id', deviceId)
      .eq('limit_type', operation)
      .gte('created_at', windowStart.toISOString());
    
    const currentAttempts = attempts || 0;
    const deviceConfig = RATE_LIMIT_CONFIG.deviceLimits;
    
    // Apply penalties for new or untrusted devices
    let penalty = 1;
    if (context.isNewDevice) {
      penalty *= deviceConfig.newDevicePenalty;
    }
    if ((context.deviceTrustScore || 0) < 0.5) {
      penalty *= deviceConfig.untrustedDevicePenalty;
    }
    
    const adjustedMaxAttempts = Math.floor(config.maxAttempts / penalty);
    const escalationLevel = this.getEscalationLevel(currentAttempts, { ...config, maxAttempts: adjustedMaxAttempts });
    
    return {
      allowed: currentAttempts < adjustedMaxAttempts,
      remainingAttempts: Math.max(0, adjustedMaxAttempts - currentAttempts),
      resetTime: new Date(windowStart.getTime() + config.windowMinutes * 60 * 1000),
      escalationLevel
    };
  }
  
  /**
   * Gets operation-specific configuration
   */
  private static getOperationConfig(operation: string): any {
    const configMap: Record<string, any> = {
      'mfa_verification': RATE_LIMIT_CONFIG.mfaVerification,
      'sms_request': RATE_LIMIT_CONFIG.smsRequests,
      'totp_attempt': RATE_LIMIT_CONFIG.totpAttempts,
      'backup_code_attempt': RATE_LIMIT_CONFIG.backupCodeAttempts,
      'recovery_request': { ...RATE_LIMIT_CONFIG.recoveryRequests, windowMinutes: RATE_LIMIT_CONFIG.recoveryRequests.windowHours * 60 },
      'admin_override': RATE_LIMIT_CONFIG.adminOverrides
    };
    
    return configMap[operation] || RATE_LIMIT_CONFIG.mfaVerification;
  }
  
  /**
   * Determines escalation level based on attempt count
   */
  private static getEscalationLevel(attempts: number, config: any): number {
    if (!config.escalationSteps) return 0;
    
    for (let i = config.escalationSteps.length - 1; i >= 0; i--) {
      if (attempts >= config.escalationSteps[i].attempts) {
        return i + 1;
      }
    }
    
    return 0;
  }
  
  /**
   * Gets IP failure count for a time window
   */
  private static async getIPFailures(ipAddress: string, hours: number): Promise<number> {
    const windowStart = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const { count } = await supabase
      .from('mfa_verification_attempts')
      .select('*', { count: 'exact' })
      .eq('ip_address', ipAddress)
      .eq('is_valid', false)
      .gte('created_at', windowStart.toISOString());
    
    return count || 0;
  }
  
  /**
   * Updates rate limit statistics
   */
  private static async updateRateLimitStats(
    operation: string,
    context: SecurityContext,
    success: boolean
  ): Promise<void> {
    const hour = new Date().getHours();
    const date = new Date().toISOString().split('T')[0];
    
    // Update MFA analytics
    await supabase
      .from('mfa_analytics')
      .upsert({
        date,
        hour,
        [`${operation}_attempts`]: 1,
        [`${operation}_successes`]: success ? 1 : 0,
        [`${operation}_failures`]: success ? 0 : 1
      }, {
        onConflict: 'date,hour'
      });
  }
  
  /**
   * Checks for escalation conditions and triggers alerts
   */
  private static async checkEscalation(
    operation: string,
    context: SecurityContext
  ): Promise<void> {
    const config = this.getOperationConfig(operation);
    
    if (!context.userId) return;
    
    // Get recent failures for this user
    const recentFailures = await this.getUserFailures(context.userId, operation, 60); // 60 minutes
    
    // Check if we need to escalate
    const escalationLevel = this.getEscalationLevel(recentFailures, config);
    
    if (escalationLevel >= 2) {
      // Trigger security review for repeated failures
      await supabase
        .from('security_events')
        .insert({
          event_type: 'repeated_mfa_failures',
          severity: escalationLevel >= 3 ? 'high' : 'medium',
          user_id: context.userId,
          description: `User has ${recentFailures} failed ${operation} attempts in the last hour`,
          details: {
            operation,
            failure_count: recentFailures,
            escalation_level: escalationLevel,
            ip_address: context.ipAddress,
            device_id: context.deviceId
          }
        });
    }
  }
  
  /**
   * Gets user failure count for a specific operation and time window
   */
  private static async getUserFailures(userId: string, operation: string, minutes: number): Promise<number> {
    const windowStart = new Date(Date.now() - minutes * 60 * 1000);
    
    const { count } = await supabase
      .from('mfa_verification_attempts')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('verification_method', operation.replace('_attempt', '').replace('_request', ''))
      .eq('is_valid', false)
      .gte('created_at', windowStart.toISOString());
    
    return count || 0;
  }
  
  /**
   * Logs rate limiting decisions for audit purposes
   */
  private static async logRateLimitDecision(
    operation: string,
    context: SecurityContext,
    result: RateLimitResult
  ): Promise<void> {
    await MFAAuditLogger.logEvent({
      eventType: result.allowed ? 'rate_limit_check_passed' : 'rate_limit_triggered',
      userId: context.userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      success: result.allowed,
      eventData: {
        operation,
        remaining_attempts: result.remainingAttempts,
        escalation_level: result.escalationLevel,
        cooldown_until: result.cooldownUntil,
        blocked_until: result.blockedUntil,
        reason: result.reason,
        device_id: context.deviceId,
        risk_score: context.riskScore
      },
      riskScore: result.escalationLevel * 0.2,
      complianceFlags: ['rate_limiting']
    });
  }
}

/**
 * Security Controls Service
 */
export class SecurityControlsService {
  /**
   * Implements progressive security measures based on risk assessment
   */
  static async applySecurityControls(
    context: SecurityContext,
    riskScore: number = 0
  ): Promise<{
    allowOperation: boolean;
    requiredControls: string[];
    additionalVerification?: string[];
    blockDuration?: number;
  }> {
    const controls: string[] = [];
    const additionalVerification: string[] = [];
    let allowOperation = true;
    let blockDuration: number | undefined;
    
    // Risk-based controls
    if (riskScore > 0.8) {
      controls.push('high_risk_detected');
      additionalVerification.push('identity_verification');
      allowOperation = false;
    } else if (riskScore > 0.6) {
      controls.push('medium_risk_detected');
      additionalVerification.push('additional_mfa_method');
    } else if (riskScore > 0.4) {
      controls.push('elevated_risk_detected');
      additionalVerification.push('email_confirmation');
    }
    
    // IP-based controls
    const ipRisk = await this.assessIPRisk(context.ipAddress);
    if (ipRisk.isHighRisk) {
      controls.push('high_risk_ip');
      additionalVerification.push('phone_verification');
      
      if (ipRisk.isMalicious) {
        allowOperation = false;
        blockDuration = 3600; // 1 hour
      }
    }
    
    // Device-based controls
    if (context.isNewDevice) {
      controls.push('new_device');
      additionalVerification.push('email_confirmation');
    }
    
    if ((context.deviceTrustScore || 0) < 0.3) {
      controls.push('untrusted_device');
      additionalVerification.push('additional_verification');
    }
    
    // Behavioral controls
    const behaviorRisk = await this.assessBehavioralRisk(context);
    if (behaviorRisk.isAnomalous) {
      controls.push('behavioral_anomaly');
      additionalVerification.push('security_questions');
    }
    
    // Log security controls application
    await this.logSecurityControls(context, {
      controls_applied: controls,
      additional_verification: additionalVerification,
      operation_allowed: allowOperation,
      risk_score: riskScore
    });
    
    return {
      allowOperation,
      requiredControls: controls,
      additionalVerification,
      blockDuration
    };
  }
  
  /**
   * Assesses IP address risk level
   */
  private static async assessIPRisk(ipAddress: string): Promise<{
    isHighRisk: boolean;
    isMalicious: boolean;
    reasons: string[];
  }> {
    // In production, integrate with threat intelligence feeds
    // This is a simplified implementation
    
    const reasons: string[] = [];
    let isHighRisk = false;
    let isMalicious = false;
    
    // Check against known bad IP lists (placeholder)
    const isKnownBad = false; // Would check threat intelligence
    if (isKnownBad) {
      isHighRisk = true;
      isMalicious = true;
      reasons.push('known_malicious_ip');
    }
    
    // Check for excessive failures from this IP
    const recentFailures = await RateLimiterService['getIPFailures'](ipAddress, 24);
    if (recentFailures > 20) {
      isHighRisk = true;
      reasons.push('excessive_failures');
    }
    
    return { isHighRisk, isMalicious, reasons };
  }
  
  /**
   * Assesses behavioral risk based on patterns
   */
  private static async assessBehavioralRisk(context: SecurityContext): Promise<{
    isAnomalous: boolean;
    reasons: string[];
  }> {
    const reasons: string[] = [];
    let isAnomalous = false;
    
    if (!context.userId) {
      return { isAnomalous: false, reasons: [] };
    }
    
    // Check for unusual timing patterns
    const currentHour = new Date().getHours();
    const { data: recentSessions } = await supabase
      .from('user_sessions')
      .select('created_at')
      .eq('user_id', context.userId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // 7 days
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (recentSessions && recentSessions.length > 5) {
      const sessionHours = recentSessions.map(s => new Date(s.created_at).getHours());
      const avgHour = sessionHours.reduce((a, b) => a + b, 0) / sessionHours.length;
      const hourDifference = Math.abs(currentHour - avgHour);
      
      if (hourDifference > 6) {
        isAnomalous = true;
        reasons.push('unusual_time_pattern');
      }
    }
    
    // Check for rapid successive attempts
    const { count: recentAttempts } = await supabase
      .from('mfa_verification_attempts')
      .select('*', { count: 'exact' })
      .eq('user_id', context.userId)
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // 5 minutes
    
    if ((recentAttempts || 0) > 3) {
      isAnomalous = true;
      reasons.push('rapid_attempts');
    }
    
    return { isAnomalous, reasons };
  }
  
  /**
   * Logs security controls application
   */
  private static async logSecurityControls(
    context: SecurityContext,
    controlsData: Record<string, any>
  ): Promise<void> {
    await MFAAuditLogger.logSecurityEvent({
      eventType: 'security_controls_applied',
      userId: context.userId,
      severity: controlsData.operation_allowed ? 'low' : 'high',
      description: `Security controls applied: ${controlsData.controls_applied.join(', ')}`,
      details: controlsData,
      ipAddress: context.ipAddress,
      deviceId: context.deviceId
    });
  }
}

/**
 * Fraud Detection Service
 */
export class FraudDetectionService {
  /**
   * Calculates comprehensive fraud score
   */
  static async calculateFraudScore(context: SecurityContext): Promise<{
    fraudScore: number;
    riskFactors: string[];
    recommendedAction: 'allow' | 'challenge' | 'block';
  }> {
    let fraudScore = 0;
    const riskFactors: string[] = [];
    
    // IP reputation score (0-0.4)
    const ipScore = await this.calculateIPScore(context.ipAddress);
    fraudScore += ipScore.score;
    riskFactors.push(...ipScore.factors);
    
    // Device trust score (0-0.3)
    const deviceScore = this.calculateDeviceScore(context);
    fraudScore += deviceScore.score;
    riskFactors.push(...deviceScore.factors);
    
    // Behavioral score (0-0.2)
    const behaviorScore = await this.calculateBehaviorScore(context);
    fraudScore += behaviorScore.score;
    riskFactors.push(...behaviorScore.factors);
    
    // Velocity score (0-0.1)
    const velocityScore = await this.calculateVelocityScore(context);
    fraudScore += velocityScore.score;
    riskFactors.push(...velocityScore.factors);
    
    // Determine recommended action
    let recommendedAction: 'allow' | 'challenge' | 'block' = 'allow';
    if (fraudScore > 0.8) {
      recommendedAction = 'block';
    } else if (fraudScore > 0.5) {
      recommendedAction = 'challenge';
    }
    
    return {
      fraudScore: Math.min(1.0, fraudScore),
      riskFactors: [...new Set(riskFactors)],
      recommendedAction
    };
  }
  
  private static async calculateIPScore(ipAddress: string): Promise<{ score: number; factors: string[] }> {
    // Simplified IP scoring - in production would use threat intelligence
    let score = 0;
    const factors: string[] = [];
    
    const failures = await RateLimiterService['getIPFailures'](ipAddress, 24);
    if (failures > 10) {
      score += 0.2;
      factors.push('high_failure_rate');
    }
    
    return { score, factors };
  }
  
  private static calculateDeviceScore(context: SecurityContext): { score: number; factors: string[] } {
    let score = 0;
    const factors: string[] = [];
    
    if (context.isNewDevice) {
      score += 0.1;
      factors.push('new_device');
    }
    
    if ((context.deviceTrustScore || 0) < 0.3) {
      score += 0.2;
      factors.push('low_device_trust');
    }
    
    return { score, factors };
  }
  
  private static async calculateBehaviorScore(context: SecurityContext): Promise<{ score: number; factors: string[] }> {
    let score = 0;
    const factors: string[] = [];
    
    if (!context.userId) return { score: 0.1, factors: ['no_user_context'] };
    
    // Check for unusual patterns
    const behaviorRisk = await SecurityControlsService['assessBehavioralRisk'](context);
    if (behaviorRisk.isAnomalous) {
      score += 0.15;
      factors.push('behavioral_anomaly');
    }
    
    return { score, factors };
  }
  
  private static async calculateVelocityScore(context: SecurityContext): Promise<{ score: number; factors: string[] }> {
    let score = 0;
    const factors: string[] = [];
    
    if (!context.userId) return { score, factors };
    
    // Check for rapid attempts
    const { count: recentAttempts } = await supabase
      .from('mfa_verification_attempts')
      .select('*', { count: 'exact' })
      .eq('user_id', context.userId)
      .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());
    
    if ((recentAttempts || 0) > 5) {
      score += 0.1;
      factors.push('high_velocity');
    }
    
    return { score, factors };
  }
}

// Simple rate limit function for backward compatibility
export async function rateLimit(
  identifier: string,
  operation: string,
  maxAttempts: number = 5,
  windowMinutes: number = 60
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const context: SecurityContext = {
    userId: undefined,
    ipAddress: identifier,
    deviceId: undefined,
    userAgent: 'unknown',
    method: 'POST',
    isNewDevice: false,
    deviceTrustScore: 0.5,
    riskScore: 0.3
  };

  const result = await RateLimiterService.checkRateLimit(
    operation as any, // Type assertion for compatibility
    context
  );

  return {
    allowed: result.allowed,
    retryAfter: result.cooldownUntil 
      ? Math.ceil((result.cooldownUntil.getTime() - Date.now()) / 1000)
      : undefined
  };
}

// Export types and configuration
export type { RateLimitResult, SecurityContext };
export { RATE_LIMIT_CONFIG };