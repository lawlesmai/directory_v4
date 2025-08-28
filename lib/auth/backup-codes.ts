/**
 * Secure Backup Code Generation and Management System
 * Enterprise-grade backup codes for MFA recovery
 * 
 * The Lawless Directory - Epic 2 Story 2.4
 * Multi-Factor Authentication Infrastructure
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// Configuration
const BACKUP_CODE_CONFIG = {
  // Code format settings
  codeLength: 8,
  codeFormat: 'alphanumeric', // 'numeric', 'alphanumeric', 'hex'
  useDashes: true, // Format: XXXX-XXXX
  excludeAmbiguous: true, // Exclude 0, O, l, I, etc.
  
  // Security settings
  defaultCodeCount: 8,
  minCodeCount: 6,
  maxCodeCount: 12,
  
  // Validation settings
  maxUsageAttempts: 3, // How many times a user can try invalid codes before lockout
  lockoutDurationMinutes: 30,
  
  // Expiration settings
  defaultExpiryMonths: 12,
  warnExpiryDays: 30,
  
  // Usage tracking
  logUsage: true,
  trackFailedAttempts: true,
  
  // Character sets
  numericChars: '0123456789',
  alphanumericChars: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  alphanumericSafe: '23456789ABCDEFGHJKLMNPQRSTUVWXYZ', // Excludes ambiguous chars
  hexChars: '0123456789ABCDEF'
} as const;

// Initialize Supabase client
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Backup Code Interface
 */
interface BackupCode {
  code: string;
  hash: string;
  partial: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Backup Code Generation Result
 */
interface BackupCodeGenerationResult {
  success: boolean;
  codes?: BackupCode[];
  batchId?: string;
  expiresAt?: Date;
  error?: string;
}

/**
 * Backup Code Verification Result
 */
interface BackupCodeVerificationResult {
  valid: boolean;
  codeId?: string;
  remainingCodes?: number;
  lastUsed?: boolean;
  attemptsRemaining?: number;
  lockedUntil?: Date;
  error?: string;
}

/**
 * Backup Code Management Result
 */
interface BackupCodeManagementResult {
  success: boolean;
  action?: string;
  affectedCodes?: number;
  error?: string;
}

/**
 * Backup Code Generation Service
 */
export class BackupCodeService {
  /**
   * Generates new backup codes for a user
   */
  static async generateBackupCodes(
    userId: string,
    options: {
      codeCount?: number;
      expiryMonths?: number;
      replaceExisting?: boolean;
      format?: 'numeric' | 'alphanumeric' | 'hex';
      deviceId?: string;
      ipAddress?: string;
    } = {}
  ): Promise<BackupCodeGenerationResult> {
    try {
      const codeCount = Math.min(
        Math.max(options.codeCount || BACKUP_CODE_CONFIG.defaultCodeCount, BACKUP_CODE_CONFIG.minCodeCount),
        BACKUP_CODE_CONFIG.maxCodeCount
      );
      
      const expiryMonths = options.expiryMonths || BACKUP_CODE_CONFIG.defaultExpiryMonths;
      const format = options.format || BACKUP_CODE_CONFIG.codeFormat;
      
      // If replacing existing codes, invalidate them first
      if (options.replaceExisting) {
        await this.invalidateExistingCodes(userId, 'regenerated');
      }
      
      // Generate batch ID for tracking
      const batchId = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + expiryMonths);
      
      // Generate codes
      const codes: BackupCode[] = [];
      const usedCodes = new Set<string>(); // Prevent duplicates
      
      for (let i = 0; i < codeCount; i++) {
        let code: string;
        let attempts = 0;
        
        // Generate unique code
        do {
          code = this.generateSingleCode(format);
          attempts++;
          
          if (attempts > 100) {
            throw new Error('Failed to generate unique backup codes');
          }
        } while (usedCodes.has(code));
        
        usedCodes.add(code);
        
        const hash = this.hashCode(code, userId);
        const partial = code.substring(0, 4);
        
        codes.push({
          code,
          hash,
          partial,
          createdAt: new Date(),
          expiresAt
        });
      }
      
      // Store codes in database
      const codeInserts = codes.map(codeData => ({
        user_id: userId,
        code_hash: codeData.hash,
        code_partial: codeData.partial,
        generation_batch: batchId,
        expires_at: codeData.expiresAt.toISOString()
      }));
      
      const { error: insertError } = await supabase
        .from('mfa_backup_codes')
        .insert(codeInserts);
      
      if (insertError) {
        throw new Error(`Failed to store backup codes: ${insertError.message}`);
      }
      
      // Update user MFA config
      await supabase
        .from('auth_mfa_config')
        .upsert({
          user_id: userId,
          backup_codes_generated_at: new Date().toISOString()
        });
      
      // Log generation event
      await this.logBackupCodeEvent({
        userId,
        eventType: 'codes_generated',
        batchId,
        codeCount,
        deviceId: options.deviceId,
        ipAddress: options.ipAddress
      });
      
      return {
        success: true,
        codes,
        batchId,
        expiresAt
      };
      
    } catch (error) {
      console.error('Backup code generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Code generation failed'
      };
    }
  }
  
  /**
   * Verifies a backup code
   */
  static async verifyBackupCode(
    userId: string,
    code: string,
    options: {
      deviceId?: string;
      ipAddress?: string;
      userAgent?: string;
      challengeId?: string;
    } = {}
  ): Promise<BackupCodeVerificationResult> {
    try {
      const cleanCode = code.replace(/[-\s]/g, '').toUpperCase();
      
      // Check for rate limiting
      const rateLimitCheck = await this.checkVerificationRateLimit(userId);
      if (!rateLimitCheck.allowed) {
        return {
          valid: false,
          attemptsRemaining: 0,
          lockedUntil: rateLimitCheck.lockedUntil,
          error: 'Too many failed attempts. Account temporarily locked.'
        };
      }
      
      // Hash the provided code
      const hashedCode = this.hashCode(cleanCode, userId);
      
      // Find matching unused backup code
      const { data: matchingCode, error: findError } = await supabase
        .from('mfa_backup_codes')
        .select('*')
        .eq('user_id', userId)
        .eq('code_hash', hashedCode)
        .eq('is_used', false)
        .gte('expires_at', new Date().toISOString())
        .single();
      
      if (findError || !matchingCode) {
        // Log failed attempt
        await this.logVerificationAttempt({
          userId,
          codeHash: hashedCode,
          success: false,
          reason: 'invalid_code',
          challengeId: options.challengeId,
          deviceId: options.deviceId,
          ipAddress: options.ipAddress
        });
        
        // Update failed attempt counter
        await this.incrementFailedAttempts(userId);
        
        const remainingAttempts = await this.getRemainingAttempts(userId);
        
        return {
          valid: false,
          attemptsRemaining: remainingAttempts,
          error: 'Invalid backup code'
        };
      }
      
      // Mark code as used
      const { error: updateError } = await supabase
        .from('mfa_backup_codes')
        .update({
          is_used: true,
          used_at: new Date().toISOString(),
          used_ip: options.ipAddress,
          used_device_id: options.deviceId
        })
        .eq('id', matchingCode.id);
      
      if (updateError) {
        throw new Error(`Failed to mark code as used: ${updateError.message}`);
      }
      
      // Get remaining code count
      const { count: remainingCodes } = await supabase
        .from('mfa_backup_codes')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_used', false)
        .gte('expires_at', new Date().toISOString());
      
      // Log successful verification
      await this.logVerificationAttempt({
        userId,
        codeHash: hashedCode,
        codeId: matchingCode.id,
        success: true,
        challengeId: options.challengeId,
        deviceId: options.deviceId,
        ipAddress: options.ipAddress
      });
      
      // Reset failed attempt counter
      await this.resetFailedAttempts(userId);
      
      // Check if this was the last code
      const isLastCode = (remainingCodes || 0) === 0;
      
      if (isLastCode) {
        // Notify user that they should generate new codes
        await this.notifyLastCodeUsed(userId);
      }
      
      return {
        valid: true,
        codeId: matchingCode.id,
        remainingCodes: remainingCodes || 0,
        lastUsed: isLastCode
      };
      
    } catch (error) {
      console.error('Backup code verification error:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Verification failed'
      };
    }
  }
  
  /**
   * Gets backup code status for user
   */
  static async getBackupCodeStatus(userId: string): Promise<{
    hasBackupCodes: boolean;
    totalCodes: number;
    usedCodes: number;
    remainingCodes: number;
    expiresAt?: Date;
    nearExpiry: boolean;
    lastGenerated?: Date;
  }> {
    try {
      // Get unused codes
      const { data: unusedCodes, count: totalUnused } = await supabase
        .from('mfa_backup_codes')
        .select('expires_at, created_at', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_used', false)
        .gte('expires_at', new Date().toISOString());
      
      // Get used codes count
      const { count: usedCount } = await supabase
        .from('mfa_backup_codes')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_used', true);
      
      // Get MFA config for last generation time
      const { data: mfaConfig } = await supabase
        .from('auth_mfa_config')
        .select('backup_codes_generated_at')
        .eq('user_id', userId)
        .single();
      
      const remainingCodes = totalUnused || 0;
      const usedCodes = usedCount || 0;
      const totalCodes = remainingCodes + usedCodes;
      
      // Find earliest expiry date
      let expiresAt: Date | undefined;
      let nearExpiry = false;
      
      if (unusedCodes && unusedCodes.length > 0) {
        const earliestExpiry = unusedCodes.reduce((earliest: Date | undefined, code: any) => {
          const expiry = new Date(code.expires_at);
          return !earliest || expiry < earliest ? expiry : earliest;
        }, undefined as Date | undefined);
        
        if (earliestExpiry) {
          expiresAt = earliestExpiry;
          const daysUntilExpiry = Math.floor(
            (earliestExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          nearExpiry = daysUntilExpiry <= BACKUP_CODE_CONFIG.warnExpiryDays;
        }
      }
      
      return {
        hasBackupCodes: remainingCodes > 0,
        totalCodes,
        usedCodes,
        remainingCodes,
        expiresAt,
        nearExpiry,
        lastGenerated: mfaConfig?.backup_codes_generated_at 
          ? new Date(mfaConfig.backup_codes_generated_at) 
          : undefined
      };
      
    } catch (error) {
      console.error('Error getting backup code status:', error);
      return {
        hasBackupCodes: false,
        totalCodes: 0,
        usedCodes: 0,
        remainingCodes: 0,
        nearExpiry: false
      };
    }
  }
  
  /**
   * Invalidates existing backup codes
   */
  static async invalidateExistingCodes(
    userId: string,
    reason: string
  ): Promise<BackupCodeManagementResult> {
    try {
      // Mark all unused codes as used with reason
      const { data: deletedCodes } = await supabase
        .from('mfa_backup_codes')
        .delete()
        .eq('user_id', userId)
        .eq('is_used', false)
        .select('id');
      
      const affectedCodes = deletedCodes?.length || 0;
      
      // Log invalidation event
      await this.logBackupCodeEvent({
        userId,
        eventType: 'codes_invalidated',
        reason,
        affectedCount: affectedCodes
      });
      
      return {
        success: true,
        action: 'invalidated',
        affectedCodes
      };
      
    } catch (error) {
      console.error('Error invalidating backup codes:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Invalidation failed'
      };
    }
  }
  
  /**
   * Generates a single backup code
   */
  private static generateSingleCode(format: string): string {
    let charset: string;
    
    switch (format) {
      case 'numeric':
        charset = BACKUP_CODE_CONFIG.numericChars;
        break;
      case 'hex':
        charset = BACKUP_CODE_CONFIG.hexChars;
        break;
      case 'alphanumeric':
      default:
        charset = BACKUP_CODE_CONFIG.excludeAmbiguous 
          ? BACKUP_CODE_CONFIG.alphanumericSafe 
          : BACKUP_CODE_CONFIG.alphanumericChars;
        break;
    }
    
    let code = '';
    for (let i = 0; i < BACKUP_CODE_CONFIG.codeLength; i++) {
      const randomIndex = crypto.randomInt(charset.length);
      code += charset[randomIndex];
    }
    
    // Add dashes if configured
    if (BACKUP_CODE_CONFIG.useDashes && code.length === 8) {
      return `${code.substring(0, 4)}-${code.substring(4)}`;
    }
    
    return code;
  }
  
  /**
   * Hashes a backup code with user-specific salt
   */
  private static hashCode(code: string, userId: string): string {
    const salt = crypto
      .createHash('sha256')
      .update(userId + (process.env.MFA_SALT || 'default_salt'))
      .digest('hex');
    
    return crypto
      .createHash('sha256')
      .update(code + salt)
      .digest('hex');
  }
  
  /**
   * Checks verification rate limiting
   */
  private static async checkVerificationRateLimit(
    userId: string
  ): Promise<{ allowed: boolean; lockedUntil?: Date }> {
    const { data: config } = await supabase
      .from('auth_mfa_config')
      .select('failed_attempts_count, locked_until')
      .eq('user_id', userId)
      .single();
    
    if (!config) {
      return { allowed: true };
    }
    
    // Check if currently locked
    if (config.locked_until && new Date(config.locked_until) > new Date()) {
      return {
        allowed: false,
        lockedUntil: new Date(config.locked_until)
      };
    }
    
    // Check attempt limit
    const maxAttempts = BACKUP_CODE_CONFIG.maxUsageAttempts;
    if ((config.failed_attempts_count || 0) >= maxAttempts) {
      const lockedUntil = new Date(
        Date.now() + BACKUP_CODE_CONFIG.lockoutDurationMinutes * 60 * 1000
      );
      
      // Apply lockout
      await supabase
        .from('auth_mfa_config')
        .update({ locked_until: lockedUntil.toISOString() })
        .eq('user_id', userId);
      
      return { allowed: false, lockedUntil };
    }
    
    return { allowed: true };
  }
  
  /**
   * Increments failed attempt counter
   */
  private static async incrementFailedAttempts(userId: string): Promise<void> {
    await supabase.rpc('increment_mfa_failed_attempts', { user_id: userId } as any);
  }
  
  /**
   * Resets failed attempt counter
   */
  private static async resetFailedAttempts(userId: string): Promise<void> {
    await supabase
      .from('auth_mfa_config')
      .update({ 
        failed_attempts_count: 0,
        locked_until: null 
      })
      .eq('user_id', userId);
  }
  
  /**
   * Gets remaining verification attempts
   */
  private static async getRemainingAttempts(userId: string): Promise<number> {
    const { data: config } = await supabase
      .from('auth_mfa_config')
      .select('failed_attempts_count')
      .eq('user_id', userId)
      .single();
    
    const failedAttempts = config?.failed_attempts_count || 0;
    return Math.max(0, BACKUP_CODE_CONFIG.maxUsageAttempts - failedAttempts);
  }
  
  /**
   * Logs backup code events
   */
  private static async logBackupCodeEvent(params: {
    userId: string;
    eventType: string;
    batchId?: string;
    codeCount?: number;
    reason?: string;
    affectedCount?: number;
    deviceId?: string;
    ipAddress?: string;
  }): Promise<void> {
    await supabase
      .from('auth_audit_logs')
      .insert([{
        event_type: `backup_code_${params.eventType}`,
        event_category: 'mfa',
        user_id: params.userId,
        success: true,
        ip_address: params.ipAddress,
        event_data: {
          batch_id: params.batchId,
          code_count: params.codeCount,
          reason: params.reason,
          affected_count: params.affectedCount,
          device_id: params.deviceId
        }
      }]);
  }
  
  /**
   * Logs verification attempts
   */
  private static async logVerificationAttempt(params: {
    userId: string;
    codeHash: string;
    codeId?: string;
    success: boolean;
    reason?: string;
    challengeId?: string;
    deviceId?: string;
    ipAddress?: string;
  }): Promise<void> {
    await supabase
      .from('mfa_verification_attempts')
      .insert([{
        user_id: params.userId,
        challenge_id: params.challengeId,
        verification_method: 'backup_code',
        code_hash: params.codeHash,
        is_valid: params.success,
        device_id: params.deviceId,
        ip_address: params.ipAddress
      }]);
  }
  
  /**
   * Notifies user when last backup code is used
   */
  private static async notifyLastCodeUsed(userId: string): Promise<void> {
    // This would integrate with notification system
    console.log(`User ${userId} used their last backup code`);
    
    // Log critical event
    await supabase
      .from('security_events')
      .insert([{
        event_type: 'last_backup_code_used',
        severity: 'high',
        user_id: userId,
        description: 'User has used their last backup code and needs to generate new ones',
        action_taken: 'user_notification_sent'
      }]);
  }
}

/**
 * Backup Code Utilities
 */
export class BackupCodeUtils {
  /**
   * Validates backup code format
   */
  static validateCodeFormat(code: string): { valid: boolean; error?: string } {
    const cleanCode = code.replace(/[-\s]/g, '');
    
    if (cleanCode.length !== BACKUP_CODE_CONFIG.codeLength) {
      return {
        valid: false,
        error: `Code must be ${BACKUP_CODE_CONFIG.codeLength} characters long`
      };
    }
    
    // Check character set
    const validChars = BACKUP_CODE_CONFIG.excludeAmbiguous 
      ? BACKUP_CODE_CONFIG.alphanumericSafe 
      : BACKUP_CODE_CONFIG.alphanumericChars;
    
    for (const char of cleanCode) {
      if (!validChars.includes(char)) {
        return {
          valid: false,
          error: 'Code contains invalid characters'
        };
      }
    }
    
    return { valid: true };
  }
  
  /**
   * Formats backup code for display
   */
  static formatCode(code: string): string {
    const cleanCode = code.replace(/[-\s]/g, '');
    
    if (BACKUP_CODE_CONFIG.useDashes && cleanCode.length === 8) {
      return `${cleanCode.substring(0, 4)}-${cleanCode.substring(4)}`;
    }
    
    return cleanCode;
  }
  
  /**
   * Generates printable backup codes sheet
   */
  static generatePrintableSheet(
    codes: BackupCode[],
    userEmail: string,
    generatedAt: Date
  ): string {
    const header = `
===========================================
THE LAWLESS DIRECTORY - BACKUP CODES
===========================================

Account: ${userEmail}
Generated: ${generatedAt.toLocaleString()}
Expires: ${codes[0]?.expiresAt.toLocaleDateString()}

IMPORTANT: Store these codes in a safe place.
Each code can only be used once.

`;
    
    const codesList = codes
      .map((code, index) => `${index + 1}. ${this.formatCode(code.code)}`)
      .join('\n');
    
    const footer = `

===========================================
SECURITY TIPS:
- Print this page and store it securely
- Do not share these codes with anyone
- Generate new codes if you suspect compromise
- Each code works only once
===========================================
`;
    
    return header + codesList + footer;
  }
}

/**
 * Export configuration and types
 */
export { BACKUP_CODE_CONFIG };
export type { 
  BackupCode, 
  BackupCodeGenerationResult, 
  BackupCodeVerificationResult,
  BackupCodeManagementResult 
};