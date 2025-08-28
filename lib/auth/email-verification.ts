/**
 * Email Verification System
 * Epic 2 Story 2.5: User Onboarding and Email Verification Infrastructure
 * 
 * Secure email verification with token generation, validation, and tracking
 */

import { createHash, randomBytes } from 'crypto';
import { supabase } from '@/lib/supabase/server';
import { Database } from '@/lib/supabase/database.types';
import { rateLimit } from '@/lib/auth/rate-limiting';

// TODO: Add these types to database.types.ts when tables are created
type EmailVerificationToken = any;
type EmailVerificationInsert = any;
type EmailDeliveryLog = any;

export interface EmailVerificationConfig {
  tokenLength: number;
  expirationHours: number;
  maxAttempts: number;
  resendCooldownMinutes: number;
}

export interface EmailVerificationResult {
  success: boolean;
  token?: string;
  error?: string;
  retryAfter?: number;
}

export interface TokenValidationResult {
  isValid: boolean;
  isExpired: boolean;
  attemptsRemaining: number;
  userId?: string;
  error?: string;
}

export class EmailVerificationService {
  private readonly config: EmailVerificationConfig = {
    tokenLength: 32,
    expirationHours: 24,
    maxAttempts: 3,
    resendCooldownMinutes: 2,
  };

  /**
   * Generate a secure verification token
   */
  private generateSecureToken(): { token: string; hash: string } {
    const token = randomBytes(this.config.tokenLength).toString('hex');
    const hash = this.hashToken(token);
    
    return { token, hash };
  }

  /**
   * Hash a token for secure storage
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Validate token format and structure
   */
  private isValidTokenFormat(token: string): boolean {
    return /^[a-f0-9]{64}$/.test(token);
  }

  /**
   * Generate and store email verification token
   */
  async generateVerificationToken(
    userId: string,
    emailAddress: string,
    verificationType: 'registration' | 'email_change' | 'password_reset' | 'account_recovery' = 'registration',
    customExpirationHours?: number
  ): Promise<EmailVerificationResult> {
    try {
      // Rate limiting check
      const rateLimitKey = `email_verification_${emailAddress}`;
      const rateLimitResult = await rateLimit(
        rateLimitKey,
        'email_verification_send',
        5, // max attempts
        60 // per hour
      );

      if (!rateLimitResult.allowed) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: rateLimitResult.retryAfter,
        };
      }

      // Check for existing unexpired tokens
      const { data: existingToken, error: checkError } = await supabase
        .from('email_verification_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('email_address', emailAddress)
        .eq('verification_type', verificationType)
        .eq('is_verified', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      // If existing token found and resend cooldown not expired
      if (existingToken) {
        const lastResent = existingToken.last_resent_at 
          ? new Date(existingToken.last_resent_at)
          : new Date(existingToken.created_at);
        
        const cooldownExpired = new Date().getTime() - lastResent.getTime() >= 
          this.config.resendCooldownMinutes * 60 * 1000;

        if (!cooldownExpired) {
          const retryAfter = Math.ceil(
            (lastResent.getTime() + this.config.resendCooldownMinutes * 60 * 1000 - new Date().getTime()) / 1000
          );
          
          return {
            success: false,
            error: 'Please wait before requesting another verification email.',
            retryAfter,
          };
        }

        // Update existing token with new resend
        const { error: updateError } = await supabase
          .from('email_verification_tokens')
          .update({
            last_resent_at: new Date().toISOString(),
            resent_count: (existingToken.resent_count || 0) + 1,
          })
          .eq('id', existingToken.id);

        if (updateError) throw updateError;

        return {
          success: true,
          token: existingToken.token,
        };
      }

      // Generate new token
      const { token, hash } = this.generateSecureToken();
      const expirationHours = customExpirationHours || this.config.expirationHours;
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expirationHours);

      // Store token in database
      const tokenData: EmailVerificationInsert = {
        user_id: userId,
        token,
        token_hash: hash,
        email_address: emailAddress,
        verification_type: verificationType,
        expires_at: expiresAt.toISOString(),
        max_attempts: this.config.maxAttempts,
      };

      const { data: newToken, error: insertError } = await supabase
        .from('email_verification_tokens')
        .insert(tokenData)
        .select()
        .single();

      if (insertError) throw insertError;

      return {
        success: true,
        token,
      };

    } catch (error) {
      console.error('Error generating verification token:', error);
      return {
        success: false,
        error: 'Failed to generate verification token.',
      };
    }
  }

  /**
   * Validate verification token
   */
  async validateToken(
    token: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<TokenValidationResult> {
    try {
      // Validate token format
      if (!this.isValidTokenFormat(token)) {
        return {
          isValid: false,
          isExpired: false,
          attemptsRemaining: 0,
          error: 'Invalid token format.',
        };
      }

      // Hash the provided token for lookup
      const tokenHash = this.hashToken(token);

      // Find token in database
      const { data: tokenRecord, error: findError } = await supabase
        .from('email_verification_tokens')
        .select('*')
        .eq('token_hash', tokenHash)
        .eq('is_verified', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (findError || !tokenRecord) {
        return {
          isValid: false,
          isExpired: false,
          attemptsRemaining: 0,
          error: 'Token not found or already used.',
        };
      }

      // Check if token is expired
      const now = new Date();
      const expiresAt = new Date(tokenRecord.expires_at);
      const isExpired = now > expiresAt;

      if (isExpired) {
        return {
          isValid: false,
          isExpired: true,
          attemptsRemaining: 0,
          userId: tokenRecord.user_id,
          error: 'Token has expired.',
        };
      }

      // Check attempt limits
      const attemptsRemaining = tokenRecord.max_attempts - tokenRecord.attempts;
      
      if (attemptsRemaining <= 0) {
        return {
          isValid: false,
          isExpired: false,
          attemptsRemaining: 0,
          userId: tokenRecord.user_id,
          error: 'Maximum verification attempts exceeded.',
        };
      }

      // Record the attempt
      await this.recordAttempt(tokenRecord.id, true, userAgent, ipAddress);

      // Mark token as verified and update user profile
      await this.markTokenAsVerified(tokenRecord, userAgent, ipAddress);

      return {
        isValid: true,
        isExpired: false,
        attemptsRemaining: attemptsRemaining - 1,
        userId: tokenRecord.user_id,
      };

    } catch (error) {
      console.error('Error validating token:', error);
      return {
        isValid: false,
        isExpired: false,
        attemptsRemaining: 0,
        error: 'Token validation failed.',
      };
    }
  }

  /**
   * Record a validation attempt
   */
  private async recordAttempt(
    tokenId: string,
    isValid: boolean,
    userAgent?: string,
    ipAddress?: string
  ): Promise<void> {
    // Use RPC to increment attempts atomically
    await supabase.rpc('increment_verification_attempts', { 
      token_id: tokenId,
      is_valid: isValid 
    } as any);
  }

  /**
   * Mark token as verified and update user profile
   */
  private async markTokenAsVerified(
    tokenRecord: EmailVerificationToken,
    userAgent?: string,
    ipAddress?: string
  ): Promise<void> {
    const now = new Date().toISOString();

    // Update token as verified
    await supabase
      .from('email_verification_tokens')
      .update({
        is_verified: true,
        verified_at: now,
        verification_ip: ipAddress,
        verification_user_agent: userAgent,
      })
      .eq('id', tokenRecord.id);

    // Update user profile email verification status
    if (tokenRecord.verification_type === 'registration') {
      await supabase
        .from('profiles')
        .update({
          email_verified: true,
          account_status: 'active',
          updated_at: now,
        })
        .eq('id', tokenRecord.user_id);
    }
  }

  /**
   * Check token status without consuming an attempt
   */
  async checkTokenStatus(token: string): Promise<{
    exists: boolean;
    isExpired: boolean;
    isVerified: boolean;
    attemptsRemaining: number;
    emailAddress?: string;
  }> {
    try {
      if (!this.isValidTokenFormat(token)) {
        return {
          exists: false,
          isExpired: false,
          isVerified: false,
          attemptsRemaining: 0,
        };
      }

      const tokenHash = this.hashToken(token);

      const { data: tokenRecord, error } = await supabase
        .from('email_verification_tokens')
        .select('*')
        .eq('token_hash', tokenHash)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !tokenRecord) {
        return {
          exists: false,
          isExpired: false,
          isVerified: false,
          attemptsRemaining: 0,
        };
      }

      const now = new Date();
      const expiresAt = new Date(tokenRecord.expires_at);
      const isExpired = now > expiresAt;

      return {
        exists: true,
        isExpired,
        isVerified: tokenRecord.is_verified,
        attemptsRemaining: Math.max(0, tokenRecord.max_attempts - tokenRecord.attempts),
        emailAddress: tokenRecord.email_address,
      };

    } catch (error) {
      console.error('Error checking token status:', error);
      return {
        exists: false,
        isExpired: false,
        isVerified: false,
        attemptsRemaining: 0,
      };
    }
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(): Promise<{ deletedCount: number }> {
    try {
      const { data, error } = await supabase
        .from('email_verification_tokens')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('id');

      if (error) throw error;

      return { deletedCount: data?.length || 0 };

    } catch (error) {
      console.error('Error cleaning up expired tokens:', error);
      return { deletedCount: 0 };
    }
  }

  /**
   * Get user's verification history
   */
  async getUserVerificationHistory(
    userId: string,
    limit: number = 10
  ): Promise<EmailVerificationToken[]> {
    try {
      const { data, error } = await supabase
        .from('email_verification_tokens')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];

    } catch (error) {
      console.error('Error fetching verification history:', error);
      return [];
    }
  }

  /**
   * Resend verification email (with rate limiting)
   */
  async resendVerificationEmail(
    userId: string,
    emailAddress: string,
    verificationType: 'registration' | 'email_change' | 'password_reset' | 'account_recovery' = 'registration'
  ): Promise<EmailVerificationResult> {
    // This method leverages generateVerificationToken which handles resend logic
    return this.generateVerificationToken(userId, emailAddress, verificationType);
  }

  /**
   * Track email delivery events
   */
  async trackEmailDelivery(
    verificationTokenId: string,
    recipientEmail: string,
    emailType: string,
    emailTemplate: string,
    status: 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed' | 'spam',
    providerDetails?: {
      provider?: string;
      messageId?: string;
      response?: Record<string, any>;
      errorCode?: string;
      errorMessage?: string;
    }
  ): Promise<void> {
    try {
      const deliveryData = {
        verification_token_id: verificationTokenId,
        recipient_email: recipientEmail,
        email_type: emailType,
        email_template: emailTemplate,
        status,
        provider: providerDetails?.provider || 'supabase',
        provider_message_id: providerDetails?.messageId,
        provider_response: providerDetails?.response || {},
        error_code: providerDetails?.errorCode,
        error_message: providerDetails?.errorMessage,
        sent_at: ['sent', 'delivered', 'opened', 'clicked'].includes(status) 
          ? new Date().toISOString() 
          : null,
        delivered_at: ['delivered', 'opened', 'clicked'].includes(status) 
          ? new Date().toISOString() 
          : null,
        opened_at: status === 'opened' ? new Date().toISOString() : null,
        clicked_at: status === 'clicked' ? new Date().toISOString() : null,
        failed_at: ['bounced', 'failed', 'spam'].includes(status) 
          ? new Date().toISOString() 
          : null,
      };

      const { error } = await supabase
        .from('email_delivery_logs')
        .insert([deliveryData]);

      if (error) throw error;

    } catch (error) {
      console.error('Error tracking email delivery:', error);
      // Don't throw here as this is tracking/logging
    }
  }

  /**
   * Get email delivery analytics
   */
  async getEmailDeliveryAnalytics(
    dateRange: { from: Date; to: Date },
    emailType?: string
  ): Promise<{
    total: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    failed: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
  }> {
    try {
      let query = supabase
        .from('email_delivery_logs')
        .select('status')
        .gte('queued_at', dateRange.from.toISOString())
        .lte('queued_at', dateRange.to.toISOString());

      if (emailType) {
        query = query.eq('email_type', emailType);
      }

      const { data, error } = await query;

      if (error) throw error;

      const total = data?.length || 0;
      const sent = data?.filter((d: any) => d.status === 'sent').length || 0;
      const delivered = data?.filter((d: any) => d.status === 'delivered').length || 0;
      const opened = data?.filter((d: any) => d.status === 'opened').length || 0;
      const clicked = data?.filter((d: any) => d.status === 'clicked').length || 0;
      const bounced = data?.filter((d: any) => d.status === 'bounced').length || 0;
      const failed = data?.filter((d: any) => d.status === 'failed').length || 0;

      return {
        total,
        sent,
        delivered,
        opened,
        clicked,
        bounced,
        failed,
        deliveryRate: total > 0 ? (delivered / total) * 100 : 0,
        openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
        clickRate: opened > 0 ? (clicked / opened) * 100 : 0,
      };

    } catch (error) {
      console.error('Error fetching email analytics:', error);
      return {
        total: 0,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        failed: 0,
        deliveryRate: 0,
        openRate: 0,
        clickRate: 0,
      };
    }
  }
}

// Export singleton instance
export const emailVerificationService = new EmailVerificationService();

// Export utilities
export const generateVerificationUrl = (
  token: string,
  baseUrl: string = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
): string => {
  return `${baseUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;
};

export const isValidVerificationToken = (token: string): boolean => {
  return /^[a-f0-9]{64}$/.test(token);
};