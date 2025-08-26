/**
 * SMS Verification System for MFA
 * Twilio Integration for Secure SMS-based Two-Factor Authentication
 * 
 * The Lawless Directory - Epic 2 Story 2.4
 * Multi-Factor Authentication Infrastructure
 */

import crypto from 'crypto';
import { Twilio } from 'twilio';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// Configuration
const SMS_CONFIG = {
  // Code configuration
  codeLength: 6,
  codeValidityMinutes: 10,
  
  // Rate limiting
  maxAttemptsPerHour: 5,
  maxAttemptsPerDay: 10,
  cooldownMinutes: 2,
  
  // Security
  maxVerificationAttempts: 3,
  phoneNumberValidationRegex: /^\+[1-9]\d{1,14}$/,
  
  // Twilio settings
  twilioFromNumber: process.env.TWILIO_FROM_NUMBER || '',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  
  // Message templates
  messageTemplate: 'Your Lawless Directory verification code is: {code}. This code expires in {minutes} minutes. Do not share this code.',
  appName: 'Lawless Directory'
} as const;

// Initialize Twilio client
let twilioClient: Twilio | null = null;

function getTwilioClient(): Twilio {
  if (!twilioClient) {
    if (!SMS_CONFIG.twilioAccountSid || !SMS_CONFIG.twilioAuthToken) {
      throw new SMSError('Twilio credentials not configured', 'TWILIO_NOT_CONFIGURED');
    }
    twilioClient = new Twilio(SMS_CONFIG.twilioAccountSid, SMS_CONFIG.twilioAuthToken);
  }
  return twilioClient;
}

// Initialize Supabase client
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * SMS Verification Code Interface
 */
interface SMSVerificationCode {
  code: string;
  hashedCode: string;
  expiresAt: Date;
  phoneNumber: string;
  userId: string;
  challengeId?: string;
}

/**
 * SMS Send Result Interface
 */
interface SMSSendResult {
  success: boolean;
  messageId?: string;
  challengeId: string;
  expiresAt: Date;
  attemptsRemaining?: number;
  cooldownUntil?: Date;
  error?: string;
}

/**
 * SMS Verification Result Interface
 */
interface SMSVerificationResult {
  valid: boolean;
  challengeId?: string;
  attemptsRemaining?: number;
  lockedUntil?: Date;
  error?: string;
}

/**
 * Phone Number Validation and Formatting
 */
export class PhoneNumberUtils {
  /**
   * Validates phone number format (E.164)
   */
  static validate(phoneNumber: string): boolean {
    return SMS_CONFIG.phoneNumberValidationRegex.test(phoneNumber);
  }
  
  /**
   * Formats phone number to E.164 standard
   */
  static format(phoneNumber: string): string {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Add country code if missing (default to US +1)
    if (digits.length === 10) {
      return `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }
    
    // Return as-is if already has country code
    return `+${digits}`;
  }
  
  /**
   * Masks phone number for display
   */
  static mask(phoneNumber: string): string {
    if (!phoneNumber.startsWith('+')) {
      return phoneNumber;
    }
    
    const countryCode = phoneNumber.substring(1, phoneNumber.length - 10);
    const areaCode = phoneNumber.slice(-10, -7);
    const lastFour = phoneNumber.slice(-4);
    
    return `+${countryCode}${areaCode}***${lastFour}`;
  }
}

/**
 * SMS Verification Service
 */
export class SMSVerificationService {
  /**
   * Sends SMS verification code
   */
  static async sendVerificationCode(
    userId: string,
    phoneNumber: string,
    options: {
      purpose?: 'mfa_setup' | 'mfa_login' | 'recovery';
      deviceId?: string;
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): Promise<SMSSendResult> {
    try {
      // Validate phone number
      const formattedPhone = PhoneNumberUtils.format(phoneNumber);
      if (!PhoneNumberUtils.validate(formattedPhone)) {
        return {
          success: false,
          challengeId: '',
          expiresAt: new Date(),
          error: 'Invalid phone number format'
        };
      }
      
      // Check rate limits
      const rateLimitResult = await this.checkRateLimit(userId, formattedPhone);
      if (!rateLimitResult.allowed) {
        return {
          success: false,
          challengeId: '',
          expiresAt: new Date(),
          attemptsRemaining: rateLimitResult.attemptsRemaining,
          cooldownUntil: rateLimitResult.cooldownUntil,
          error: 'Rate limit exceeded'
        };
      }
      
      // Generate verification code
      const verificationCode = this.generateVerificationCode();
      const hashedCode = this.hashCode(verificationCode.code);
      const expiresAt = new Date(Date.now() + SMS_CONFIG.codeValidityMinutes * 60 * 1000);
      
      // Create challenge in database
      const { data: challenge, error: challengeError } = await supabase
        .from('auth_mfa_challenges')
        .insert({
          user_id: userId,
          challenge_type: 'sms',
          challenge_code: hashedCode,
          expires_at: expiresAt.toISOString(),
          ip_address: options.ipAddress,
          user_agent: options.userAgent,
          device_id: options.deviceId
        })
        .select('id')
        .single();
      
      if (challengeError || !challenge) {
        throw new Error(`Failed to create SMS challenge: ${challengeError?.message}`);
      }
      
      // Send SMS via Twilio
      const message = SMS_CONFIG.messageTemplate
        .replace('{code}', verificationCode.code)
        .replace('{minutes}', SMS_CONFIG.codeValidityMinutes.toString());
      
      const twilioResult = await this.sendSMSViaTwilio(formattedPhone, message);
      
      if (!twilioResult.success) {
        // Clean up challenge if SMS failed
        await supabase
          .from('auth_mfa_challenges')
          .delete()
          .eq('id', challenge.id);
        
        return {
          success: false,
          challengeId: '',
          expiresAt: new Date(),
          error: twilioResult.error || 'Failed to send SMS'
        };
      }
      
      // Update rate limit tracking
      await this.updateRateLimit(userId, formattedPhone, 'sms_request');
      
      // Log the attempt
      await this.logSMSAttempt({
        userId,
        phoneNumber: formattedPhone,
        challengeId: challenge.id,
        success: true,
        messageId: twilioResult.messageId,
        purpose: options.purpose,
        deviceId: options.deviceId,
        ipAddress: options.ipAddress
      });
      
      return {
        success: true,
        messageId: twilioResult.messageId,
        challengeId: challenge.id,
        expiresAt,
        attemptsRemaining: rateLimitResult.attemptsRemaining - 1
      };
      
    } catch (error) {
      console.error('SMS verification send error:', error);
      return {
        success: false,
        challengeId: '',
        expiresAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Verifies SMS code
   */
  static async verifyCode(
    challengeId: string,
    code: string,
    options: {
      deviceId?: string;
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): Promise<SMSVerificationResult> {
    try {
      // Get challenge from database
      const { data: challenge, error: challengeError } = await supabase
        .from('auth_mfa_challenges')
        .select('*')
        .eq('id', challengeId)
        .eq('challenge_type', 'sms')
        .eq('verified', false)
        .single();
      
      if (challengeError || !challenge) {
        return {
          valid: false,
          error: 'Invalid or expired challenge'
        };
      }
      
      // Check if challenge has expired
      if (new Date(challenge.expires_at) < new Date()) {
        await supabase
          .from('auth_mfa_challenges')
          .delete()
          .eq('id', challengeId);
        
        return {
          valid: false,
          error: 'Verification code has expired'
        };
      }
      
      // Check attempt limits
      if (challenge.attempts >= challenge.max_attempts) {
        return {
          valid: false,
          error: 'Maximum verification attempts exceeded',
          lockedUntil: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
        };
      }
      
      // Hash provided code and compare
      const hashedCode = this.hashCode(code.replace(/\s/g, ''));
      const isValid = this.constantTimeCompare(hashedCode, challenge.challenge_code || '');
      
      // Update attempt count
      const newAttempts = challenge.attempts + 1;
      await supabase
        .from('auth_mfa_challenges')
        .update({
          attempts: newAttempts,
          verified: isValid,
          verified_at: isValid ? new Date().toISOString() : undefined
        })
        .eq('id', challengeId);
      
      // Log verification attempt
      await supabase
        .from('mfa_verification_attempts')
        .insert({
          user_id: challenge.user_id,
          challenge_id: challengeId,
          verification_method: 'sms',
          code_hash: hashedCode,
          is_valid: isValid,
          device_id: options.deviceId,
          ip_address: options.ipAddress,
          user_agent: options.userAgent,
          response_time_ms: 0 // Will be calculated on frontend
        });
      
      if (isValid) {
        // Clean up successful challenge after a delay to prevent replay
        setTimeout(async () => {
          await supabase
            .from('auth_mfa_challenges')
            .delete()
            .eq('id', challengeId);
        }, 30000); // 30 seconds
        
        return {
          valid: true,
          challengeId
        };
      } else {
        const attemptsRemaining = challenge.max_attempts - newAttempts;
        return {
          valid: false,
          attemptsRemaining,
          error: attemptsRemaining > 0 
            ? `Invalid code. ${attemptsRemaining} attempts remaining.`
            : 'Maximum attempts exceeded'
        };
      }
      
    } catch (error) {
      console.error('SMS verification error:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Verification failed'
      };
    }
  }
  
  /**
   * Sends SMS via Twilio
   */
  private static async sendSMSViaTwilio(
    phoneNumber: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const twilioClient = getTwilioClient();
      
      const result = await twilioClient.messages.create({
        body: message,
        from: SMS_CONFIG.twilioFromNumber,
        to: phoneNumber
      });
      
      return {
        success: true,
        messageId: result.sid
      };
      
    } catch (error) {
      console.error('Twilio SMS error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SMS delivery failed'
      };
    }
  }
  
  /**
   * Generates secure verification code
   */
  private static generateVerificationCode(): { code: string; hashedCode: string } {
    // Generate cryptographically secure random code
    const codeBytes = crypto.randomBytes(4);
    const code = (codeBytes.readUInt32BE(0) % Math.pow(10, SMS_CONFIG.codeLength))
      .toString()
      .padStart(SMS_CONFIG.codeLength, '0');
    
    const hashedCode = this.hashCode(code);
    
    return { code, hashedCode };
  }
  
  /**
   * Hashes verification code
   */
  private static hashCode(code: string): string {
    return crypto
      .createHash('sha256')
      .update(code + process.env.MFA_SALT || 'default_salt')
      .digest('hex');
  }
  
  /**
   * Constant time string comparison
   */
  private static constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }
  
  /**
   * Checks rate limits for SMS sending
   */
  private static async checkRateLimit(
    userId: string,
    phoneNumber: string
  ): Promise<{ allowed: boolean; attemptsRemaining: number; cooldownUntil?: Date }> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Check hourly limit
    const { count: hourlyCount } = await supabase
      .from('mfa_rate_limits')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('limit_type', 'sms_requests')
      .gte('created_at', oneHourAgo.toISOString());
    
    if ((hourlyCount || 0) >= SMS_CONFIG.maxAttemptsPerHour) {
      return {
        allowed: false,
        attemptsRemaining: 0,
        cooldownUntil: new Date(oneHourAgo.getTime() + 60 * 60 * 1000)
      };
    }
    
    // Check daily limit
    const { count: dailyCount } = await supabase
      .from('mfa_rate_limits')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('limit_type', 'sms_requests')
      .gte('created_at', oneDayAgo.toISOString());
    
    if ((dailyCount || 0) >= SMS_CONFIG.maxAttemptsPerDay) {
      return {
        allowed: false,
        attemptsRemaining: 0,
        cooldownUntil: new Date(oneDayAgo.getTime() + 24 * 60 * 60 * 1000)
      };
    }
    
    return {
      allowed: true,
      attemptsRemaining: SMS_CONFIG.maxAttemptsPerHour - (hourlyCount || 0)
    };
  }
  
  /**
   * Updates rate limit tracking
   */
  private static async updateRateLimit(
    userId: string,
    phoneNumber: string,
    limitType: string
  ): Promise<void> {
    await supabase
      .from('mfa_rate_limits')
      .insert({
        user_id: userId,
        limit_type: limitType,
        window_duration_minutes: 60,
        max_attempts: SMS_CONFIG.maxAttemptsPerHour,
        attempts: 1
      });
  }
  
  /**
   * Logs SMS attempt for audit purposes
   */
  private static async logSMSAttempt(params: {
    userId: string;
    phoneNumber: string;
    challengeId: string;
    success: boolean;
    messageId?: string;
    purpose?: string;
    deviceId?: string;
    ipAddress?: string;
  }): Promise<void> {
    await supabase
      .from('auth_audit_logs')
      .insert({
        event_type: 'sms_verification_sent',
        event_category: 'mfa',
        user_id: params.userId,
        success: params.success,
        ip_address: params.ipAddress,
        event_data: {
          phone_number_masked: PhoneNumberUtils.mask(params.phoneNumber),
          challenge_id: params.challengeId,
          message_id: params.messageId,
          purpose: params.purpose,
          device_id: params.deviceId
        }
      });
  }
}

/**
 * SMS Verification Utilities
 */
export class SMSUtils {
  /**
   * Validates SMS provider configuration
   */
  static validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!SMS_CONFIG.twilioAccountSid) {
      errors.push('TWILIO_ACCOUNT_SID is not configured');
    }
    
    if (!SMS_CONFIG.twilioAuthToken) {
      errors.push('TWILIO_AUTH_TOKEN is not configured');
    }
    
    if (!SMS_CONFIG.twilioFromNumber) {
      errors.push('TWILIO_FROM_NUMBER is not configured');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Estimates SMS costs based on destination
   */
  static estimateCost(phoneNumber: string): { cost: number; currency: string } {
    const countryCode = phoneNumber.substring(1, 2);
    
    // Simplified cost estimation (actual costs vary by provider and destination)
    const costs: Record<string, number> = {
      '1': 0.0075, // US/Canada
      '44': 0.0350, // UK
      '49': 0.0900, // Germany
      '33': 0.0900, // France
      '81': 0.0700, // Japan
    };
    
    return {
      cost: costs[countryCode] || 0.05, // Default international rate
      currency: 'USD'
    };
  }
  
  /**
   * Gets supported countries for SMS
   */
  static getSupportedCountries(): Array<{ code: string; name: string; prefix: string }> {
    return [
      { code: 'US', name: 'United States', prefix: '+1' },
      { code: 'CA', name: 'Canada', prefix: '+1' },
      { code: 'GB', name: 'United Kingdom', prefix: '+44' },
      { code: 'DE', name: 'Germany', prefix: '+49' },
      { code: 'FR', name: 'France', prefix: '+33' },
      { code: 'JP', name: 'Japan', prefix: '+81' },
      { code: 'AU', name: 'Australia', prefix: '+61' },
      // Add more as needed
    ];
  }
}

/**
 * SMS Error Class
 */
export class SMSError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'SMSError';
  }
}

/**
 * SMS Error Codes
 */
export const SMSErrors = {
  INVALID_PHONE: 'INVALID_PHONE',
  RATE_LIMITED: 'RATE_LIMITED',
  TWILIO_ERROR: 'TWILIO_ERROR',
  INVALID_CODE: 'INVALID_CODE',
  EXPIRED_CODE: 'EXPIRED_CODE',
  MAX_ATTEMPTS: 'MAX_ATTEMPTS',
  TWILIO_NOT_CONFIGURED: 'TWILIO_NOT_CONFIGURED'
} as const;

// Export configuration for testing/monitoring
export { SMS_CONFIG };