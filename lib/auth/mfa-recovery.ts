/**
 * MFA Recovery and Admin Override Systems
 * Comprehensive recovery mechanisms for MFA lockout situations
 * 
 * The Lawless Directory - Epic 2 Story 2.4
 * Multi-Factor Authentication Infrastructure
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { SMSVerificationService } from './sms-verification';

// Configuration
const MFA_RECOVERY_CONFIG = {
  // Recovery methods
  recoveryMethods: {
    email: {
      enabled: true,
      tokenLength: 32,
      tokenValidityHours: 24,
      maxAttempts: 3,
      cooldownHours: 1
    },
    sms: {
      enabled: true,
      codeLength: 6,
      codeValidityMinutes: 15,
      maxAttempts: 5,
      cooldownMinutes: 30
    },
    identityVerification: {
      enabled: true,
      requiresManualReview: true,
      validityDays: 7,
      requiredDocuments: ['government_id', 'proof_of_address']
    },
    adminAssisted: {
      enabled: true,
      requiresApproval: true,
      escalationLevels: ['admin', 'super_admin'],
      maxDurationHours: 4
    }
  },
  
  // Admin override settings
  adminOverride: {
    types: {
      temporary_disable: { 
        maxDurationHours: 24, 
        requiresJustification: true,
        requiresApproval: false
      },
      reset_mfa: { 
        maxDurationHours: 1, 
        requiresJustification: true,
        requiresApproval: true
      },
      emergency_access: { 
        maxDurationHours: 4, 
        requiresJustification: true,
        requiresApproval: true
      },
      trust_device: { 
        maxDurationHours: 72, 
        requiresJustification: false,
        requiresApproval: false
      }
    },
    approvalRequirements: {
      reset_mfa: ['super_admin'],
      emergency_access: ['super_admin'],
      temporary_disable: ['admin', 'super_admin']
    }
  },
  
  // Security settings
  security: {
    maxConcurrentRecoveries: 3,
    recoveryTokenEntropy: 256, // bits
    auditAllOperations: true,
    requireSecurityReview: true,
    notifyUserOnRecovery: true
  },
  
  // Rate limiting
  rateLimits: {
    recoveryAttempts: { perHour: 5, perDay: 10 },
    adminOverrides: { perHour: 10, perDay: 50 },
    identityVerification: { perWeek: 3, perMonth: 5 }
  }
} as const;

// Initialize Supabase client
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Recovery Request Interface
 */
interface RecoveryRequest {
  id: string;
  userId: string;
  method: 'email' | 'sms' | 'identity_verification' | 'admin_assisted';
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'expired';
  token?: string;
  code?: string;
  contactInfo?: string;
  expiresAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Recovery Initiation Result Interface
 */
interface RecoveryInitiationResult {
  success: boolean;
  requestId?: string;
  method: string;
  expiresAt?: Date;
  nextSteps?: string;
  error?: string;
  rateLimited?: boolean;
  cooldownUntil?: Date;
}

/**
 * Recovery Verification Result Interface
 */
interface RecoveryVerificationResult {
  success: boolean;
  requestId: string;
  accessGranted?: boolean;
  temporaryToken?: string;
  attemptsRemaining?: number;
  error?: string;
}

/**
 * Admin Override Request Interface
 */
interface AdminOverrideRequest {
  targetUserId: string;
  overrideType: string;
  duration: number; // hours
  reason: string;
  emergencyJustification?: string;
  requestedBy: string;
  approvedBy?: string;
}

/**
 * Admin Override Result Interface
 */
interface AdminOverrideResult {
  success: boolean;
  overrideId?: string;
  expiresAt?: Date;
  requiresApproval?: boolean;
  error?: string;
}

/**
 * MFA Recovery Service
 */
export class MFARecoveryService {
  /**
   * Initiates MFA recovery process
   */
  static async initiateRecovery(
    userId: string,
    method: 'email' | 'sms' | 'identity_verification' | 'admin_assisted',
    context: {
      ipAddress: string;
      userAgent: string;
      contactInfo?: string;
      identityDocuments?: any[];
      emergencyDetails?: string;
    }
  ): Promise<RecoveryInitiationResult> {
    try {
      // Check rate limits
      const rateLimitCheck = await this.checkRecoveryRateLimit(userId, method);
      if (!rateLimitCheck.allowed) {
        return {
          success: false,
          method,
          error: 'Rate limit exceeded',
          rateLimited: true,
          cooldownUntil: rateLimitCheck.cooldownUntil
        };
      }
      
      // Check for existing active recovery requests
      const activeRequests = await this.getActiveRecoveryRequests(userId);
      if (activeRequests.length >= MFA_RECOVERY_CONFIG.security.maxConcurrentRecoveries) {
        return {
          success: false,
          method,
          error: 'Maximum concurrent recovery requests reached'
        };
      }
      
      // Generate recovery request based on method
      let recoveryRequest: Partial<RecoveryRequest>;
      
      switch (method) {
        case 'email':
          recoveryRequest = await this.generateEmailRecovery(userId, context);
          break;
        case 'sms':
          recoveryRequest = await this.generateSMSRecovery(userId, context);
          break;
        case 'identity_verification':
          recoveryRequest = await this.generateIdentityVerification(userId, context);
          break;
        case 'admin_assisted':
          recoveryRequest = await this.generateAdminAssistedRecovery(userId, context);
          break;
        default:
          return {
            success: false,
            method,
            error: 'Invalid recovery method'
          };
      }
      
      // Store recovery request in database
      const { data: request, error: insertError } = await supabase
        .from('mfa_recovery_requests')
        .insert([{
          user_id: userId,
          recovery_method: method,
          verification_token: recoveryRequest.token,
          verification_code: recoveryRequest.code,
          recovery_email: method === 'email' ? context.contactInfo : undefined,
          recovery_phone: method === 'sms' ? context.contactInfo : undefined,
          identity_documents: method === 'identity_verification' ? context.identityDocuments : undefined,
          request_ip: context.ipAddress,
          request_user_agent: context.userAgent,
          expires_at: recoveryRequest.expiresAt?.toISOString()
        }])
        .select('id, expires_at')
        .single();
      
      if (insertError || !request) {
        throw new Error(`Failed to create recovery request: ${insertError?.message}`);
      }
      
      // Log recovery initiation
      await this.logRecoveryEvent({
        userId,
        eventType: 'recovery_initiated',
        method,
        requestId: request.id,
        ipAddress: context.ipAddress,
        success: true
      });
      
      // Send recovery instructions based on method
      await this.sendRecoveryInstructions(userId, method, {
        requestId: request.id,
        token: recoveryRequest.token,
        code: recoveryRequest.code,
        contactInfo: context.contactInfo
      });
      
      return {
        success: true,
        requestId: request.id,
        method,
        expiresAt: new Date(request.expires_at),
        nextSteps: this.getRecoveryNextSteps(method)
      };
      
    } catch (error) {
      console.error('Recovery initiation error:', error);
      return {
        success: false,
        method,
        error: error instanceof Error ? error.message : 'Recovery initiation failed'
      };
    }
  }
  
  /**
   * Verifies recovery token or code
   */
  static async verifyRecovery(
    requestId: string,
    credential: string, // token, code, or verification data
    context: {
      ipAddress: string;
      userAgent: string;
    }
  ): Promise<RecoveryVerificationResult> {
    try {
      // Get recovery request
      const { data: request, error: requestError } = await supabase
        .from('mfa_recovery_requests')
        .select('*')
        .eq('id', requestId)
        .eq('status', 'pending')
        .single();
      
      if (requestError || !request) {
        return {
          success: false,
          requestId,
          error: 'Invalid or expired recovery request'
        };
      }
      
      // Check expiration
      if (new Date(request.expires_at) < new Date()) {
        await this.expireRecoveryRequest(requestId);
        return {
          success: false,
          requestId,
          error: 'Recovery request has expired'
        };
      }
      
      // Verify credential based on method
      let verificationResult: boolean;
      
      switch (request.recovery_method) {
        case 'email':
          verificationResult = await this.verifyEmailToken(request, credential);
          break;
        case 'sms':
          verificationResult = await this.verifySMSCode(request, credential);
          break;
        case 'identity_verification':
          verificationResult = await this.verifyIdentityDocuments(request, credential);
          break;
        case 'admin_assisted':
          verificationResult = await this.verifyAdminAssistance(request, credential);
          break;
        default:
          return {
            success: false,
            requestId,
            error: 'Invalid recovery method'
          };
      }
      
      if (!verificationResult) {
        await this.logRecoveryEvent({
          userId: request.user_id,
          eventType: 'recovery_verification_failed',
          method: request.recovery_method,
          requestId,
          ipAddress: context.ipAddress,
          success: false
        });
        
        return {
          success: false,
          requestId,
          error: 'Invalid recovery credential'
        };
      }
      
      // Mark request as completed
      await supabase
        .from('mfa_recovery_requests')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', requestId);
      
      // Generate temporary access token
      const temporaryToken = await this.generateTemporaryAccessToken(request.user_id);
      
      // Log successful recovery
      await this.logRecoveryEvent({
        userId: request.user_id,
        eventType: 'recovery_completed',
        method: request.recovery_method,
        requestId,
        ipAddress: context.ipAddress,
        success: true
      });
      
      // Notify user of successful recovery
      await this.notifyRecoverySuccess(request.user_id, request.recovery_method);
      
      return {
        success: true,
        requestId,
        accessGranted: true,
        temporaryToken
      };
      
    } catch (error) {
      console.error('Recovery verification error:', error);
      return {
        success: false,
        requestId,
        error: error instanceof Error ? error.message : 'Verification failed'
      };
    }
  }
  
  /**
   * Generates different types of recovery requests
   */
  private static async generateEmailRecovery(
    userId: string,
    context: any
  ): Promise<Partial<RecoveryRequest>> {
    const config = MFA_RECOVERY_CONFIG.recoveryMethods.email;
    const token = crypto.randomBytes(config.tokenLength).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + config.tokenValidityHours);
    
    return {
      token,
      expiresAt,
      contactInfo: context.contactInfo
    };
  }
  
  private static async generateSMSRecovery(
    userId: string,
    context: any
  ): Promise<Partial<RecoveryRequest>> {
    const config = MFA_RECOVERY_CONFIG.recoveryMethods.sms;
    const code = Math.floor(Math.random() * 1000000).toString().padStart(config.codeLength, '0');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + config.codeValidityMinutes);
    
    return {
      code,
      expiresAt,
      contactInfo: context.contactInfo
    };
  }
  
  private static async generateIdentityVerification(
    userId: string,
    context: any
  ): Promise<Partial<RecoveryRequest>> {
    const config = MFA_RECOVERY_CONFIG.recoveryMethods.identityVerification;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.validityDays);
    
    return {
      token,
      expiresAt,
      metadata: {
        documents: context.identityDocuments,
        requiresManualReview: true
      }
    };
  }
  
  private static async generateAdminAssistedRecovery(
    userId: string,
    context: any
  ): Promise<Partial<RecoveryRequest>> {
    const config = MFA_RECOVERY_CONFIG.recoveryMethods.adminAssisted;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Default 24 hours for admin review
    
    return {
      token,
      expiresAt,
      metadata: {
        emergencyDetails: context.emergencyDetails,
        requiresApproval: true
      }
    };
  }
  
  /**
   * Verification methods for different recovery types
   */
  private static async verifyEmailToken(request: any, providedToken: string): Promise<boolean> {
    return request.verification_token === providedToken;
  }
  
  private static async verifySMSCode(request: any, providedCode: string): Promise<boolean> {
    return request.verification_code === providedCode;
  }
  
  private static async verifyIdentityDocuments(request: any, verificationData: string): Promise<boolean> {
    // In production, this would integrate with identity verification services
    // For now, it's a placeholder that would require manual admin review
    return request.identity_verification_status === 'verified';
  }
  
  private static async verifyAdminAssistance(request: any, adminToken: string): Promise<boolean> {
    // Check if admin has approved the recovery request
    const { data: approval } = await supabase
      .from('mfa_admin_overrides')
      .select('id')
      .eq('target_user_id', request.user_id)
      .eq('override_type', 'emergency_access')
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString())
      .single();
    
    return !!approval;
  }
  
  /**
   * Helper methods
   */
  
  private static async checkRecoveryRateLimit(
    userId: string,
    method: string
  ): Promise<{ allowed: boolean; cooldownUntil?: Date }> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const { count: hourlyAttempts } = await supabase
      .from('mfa_recovery_requests')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('recovery_method', method)
      .gte('created_at', oneHourAgo.toISOString());
    
    const { count: dailyAttempts } = await supabase
      .from('mfa_recovery_requests')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('recovery_method', method)
      .gte('created_at', oneDayAgo.toISOString());
    
    const limits = MFA_RECOVERY_CONFIG.rateLimits.recoveryAttempts;
    
    if ((hourlyAttempts || 0) >= limits.perHour) {
      return {
        allowed: false,
        cooldownUntil: new Date(oneHourAgo.getTime() + 60 * 60 * 1000)
      };
    }
    
    if ((dailyAttempts || 0) >= limits.perDay) {
      return {
        allowed: false,
        cooldownUntil: new Date(oneDayAgo.getTime() + 24 * 60 * 60 * 1000)
      };
    }
    
    return { allowed: true };
  }
  
  private static async getActiveRecoveryRequests(userId: string): Promise<any[]> {
    const { data } = await supabase
      .from('mfa_recovery_requests')
      .select('id, recovery_method')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .gte('expires_at', new Date().toISOString());
    
    return data || [];
  }
  
  private static async expireRecoveryRequest(requestId: string): Promise<void> {
    await supabase
      .from('mfa_recovery_requests')
      .update({ status: 'expired' })
      .eq('id', requestId);
  }
  
  private static async generateTemporaryAccessToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour temporary access
    
    // Store temporary token (in production, use JWT or similar)
    await supabase
      .from('user_sessions')
      .insert([{
        user_id: userId,
        session_token: token,
        expires_at: expiresAt.toISOString(),
        is_active: true,
        device_type: 'recovery_session'
      }]);
    
    return token;
  }
  
  private static async sendRecoveryInstructions(
    userId: string,
    method: string,
    details: any
  ): Promise<void> {
    // In production, integrate with email/SMS services
    console.log(`Sending ${method} recovery instructions to user ${userId}`);
    
    if (method === 'sms' && details.contactInfo) {
      await SMSVerificationService.sendVerificationCode(
        userId,
        details.contactInfo,
        { purpose: 'recovery' }
      );
    }
  }
  
  private static getRecoveryNextSteps(method: string): string {
    const steps = {
      email: 'Check your email for a recovery link. Click the link to regain access.',
      sms: 'Check your phone for a verification code. Enter the code to continue.',
      identity_verification: 'Your identity documents are being reviewed. You will be contacted within 24-48 hours.',
      admin_assisted: 'Your recovery request has been escalated to an administrator. You will be contacted shortly.'
    };
    
    return steps[method as keyof typeof steps] || 'Follow the instructions provided.';
  }
  
  private static async notifyRecoverySuccess(userId: string, method: string): Promise<void> {
    // Log security event
    await supabase
      .from('security_events')
      .insert([{
        event_type: 'mfa_recovery_completed',
        severity: 'high',
        user_id: userId,
        description: `User completed MFA recovery using ${method}`,
        action_taken: 'temporary_access_granted'
      }]);
  }
  
  private static async logRecoveryEvent(params: {
    userId: string;
    eventType: string;
    method: string;
    requestId: string;
    ipAddress: string;
    success: boolean;
  }): Promise<void> {
    await supabase
      .from('auth_audit_logs')
      .insert([{
        event_type: `mfa_${params.eventType}`,
        event_category: 'mfa_recovery',
        user_id: params.userId,
        success: params.success,
        ip_address: params.ipAddress,
        event_data: {
          recovery_method: params.method,
          request_id: params.requestId
        }
      }]);
  }
}

/**
 * Admin Override Service
 */
export class AdminOverrideService {
  /**
   * Creates admin override for user's MFA
   */
  static async createOverride(
    adminUserId: string,
    request: AdminOverrideRequest
  ): Promise<AdminOverrideResult> {
    try {
      // Validate admin permissions
      const hasPermission = await this.validateAdminPermissions(adminUserId, request.overrideType);
      if (!hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions for this override type'
        };
      }
      
      // Validate override request
      const validation = this.validateOverrideRequest(request);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }
      
      // Calculate expiration time
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + request.duration);
      
      // Check if approval is required
      const requiresApproval = this.requiresApproval(request.overrideType);
      
      // Create override record
      const { data: override, error: insertError } = await supabase
        .from('mfa_admin_overrides')
        .insert([{
          target_user_id: request.targetUserId,
          admin_user_id: adminUserId,
          override_type: request.overrideType,
          expires_at: expiresAt.toISOString(),
          reason: request.reason,
          emergency_justification: request.emergencyJustification,
          requires_approval: requiresApproval,
          is_active: !requiresApproval // Only active if no approval needed
        }])
        .select('id')
        .single();
      
      if (insertError || !override) {
        throw new Error(`Failed to create override: ${insertError?.message}`);
      }
      
      // Log admin override creation
      await this.logAdminOverrideEvent({
        adminUserId,
        targetUserId: request.targetUserId,
        overrideId: override.id,
        overrideType: request.overrideType,
        eventType: 'override_created',
        success: true
      });
      
      // Send for approval if required
      if (requiresApproval) {
        await this.requestOverrideApproval(override.id, request);
      }
      
      return {
        success: true,
        overrideId: override.id,
        expiresAt,
        requiresApproval
      };
      
    } catch (error) {
      console.error('Admin override creation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Override creation failed'
      };
    }
  }
  
  /**
   * Approves a pending admin override
   */
  static async approveOverride(
    approverUserId: string,
    overrideId: string,
    approvalNotes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate approver permissions
      const hasPermission = await this.validateApproverPermissions(approverUserId, overrideId);
      if (!hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions to approve this override'
        };
      }
      
      // Update override to approved and active
      const { error: updateError } = await supabase
        .from('mfa_admin_overrides')
        .update({
          approved_by: approverUserId,
          approved_at: new Date().toISOString(),
          approval_notes: approvalNotes,
          is_active: true
        })
        .eq('id', overrideId)
        .eq('requires_approval', true);
      
      if (updateError) {
        throw new Error(`Failed to approve override: ${updateError.message}`);
      }
      
      // Log approval
      await this.logAdminOverrideEvent({
        adminUserId: approverUserId,
        overrideId,
        eventType: 'override_approved',
        success: true
      });
      
      return { success: true };
      
    } catch (error) {
      console.error('Override approval error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Approval failed'
      };
    }
  }
  
  /**
   * Revokes an active admin override
   */
  static async revokeOverride(
    adminUserId: string,
    overrideId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Update override to inactive
      const { error: updateError } = await supabase
        .from('mfa_admin_overrides')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoke_reason: reason
        })
        .eq('id', overrideId);
      
      if (updateError) {
        throw new Error(`Failed to revoke override: ${updateError.message}`);
      }
      
      // Log revocation
      await this.logAdminOverrideEvent({
        adminUserId,
        overrideId,
        eventType: 'override_revoked',
        success: true
      });
      
      return { success: true };
      
    } catch (error) {
      console.error('Override revocation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Revocation failed'
      };
    }
  }
  
  /**
   * Helper methods for admin override system
   */
  
  private static async validateAdminPermissions(adminUserId: string, overrideType: string): Promise<boolean> {
    // Check if user has admin role
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('role_id, roles(name)')
      .eq('user_id', adminUserId)
      .eq('is_active', true);
    
    if (!adminRoles || adminRoles.length === 0) {
      return false;
    }
    
    const roleNames = adminRoles.map((r: any) => (r.roles as any)?.name).filter(Boolean);
    const requiredRoles = MFA_RECOVERY_CONFIG.adminOverride.approvalRequirements[
      overrideType as keyof typeof MFA_RECOVERY_CONFIG.adminOverride.approvalRequirements
    ] || ['admin'];
    
    return requiredRoles.some(role => roleNames.includes(role));
  }
  
  private static validateOverrideRequest(request: AdminOverrideRequest): { valid: boolean; error?: string } {
    const overrideConfig = MFA_RECOVERY_CONFIG.adminOverride.types[
      request.overrideType as keyof typeof MFA_RECOVERY_CONFIG.adminOverride.types
    ];
    
    if (!overrideConfig) {
      return { valid: false, error: 'Invalid override type' };
    }
    
    if (request.duration > overrideConfig.maxDurationHours) {
      return { 
        valid: false, 
        error: `Duration exceeds maximum of ${overrideConfig.maxDurationHours} hours` 
      };
    }
    
    if (overrideConfig.requiresJustification && !request.reason) {
      return { valid: false, error: 'Justification is required for this override type' };
    }
    
    return { valid: true };
  }
  
  private static requiresApproval(overrideType: string): boolean {
    const overrideConfig = MFA_RECOVERY_CONFIG.adminOverride.types[
      overrideType as keyof typeof MFA_RECOVERY_CONFIG.adminOverride.types
    ];
    
    return overrideConfig?.requiresApproval || false;
  }
  
  private static async validateApproverPermissions(approverUserId: string, overrideId: string): Promise<boolean> {
    // Get override details to determine required approval level
    const { data: override } = await supabase
      .from('mfa_admin_overrides')
      .select('override_type')
      .eq('id', overrideId)
      .single();
    
    if (!override) return false;
    
    return this.validateAdminPermissions(approverUserId, override.override_type);
  }
  
  private static async requestOverrideApproval(overrideId: string, request: AdminOverrideRequest): Promise<void> {
    // In production, this would send notifications to approvers
    console.log(`Override ${overrideId} requires approval for type: ${request.overrideType}`);
  }
  
  private static async logAdminOverrideEvent(params: {
    adminUserId: string;
    targetUserId?: string;
    overrideId: string;
    overrideType?: string;
    eventType: string;
    success: boolean;
  }): Promise<void> {
    await supabase
      .from('auth_audit_logs')
      .insert([{
        event_type: `admin_${params.eventType}`,
        event_category: 'admin_override',
        user_id: params.adminUserId,
        target_user_id: params.targetUserId,
        success: params.success,
        event_data: {
          override_id: params.overrideId,
          override_type: params.overrideType
        }
      }]);
  }
}

// Export types and configuration
export type {
  RecoveryRequest,
  RecoveryInitiationResult,
  RecoveryVerificationResult,
  AdminOverrideRequest,
  AdminOverrideResult
};

export { MFA_RECOVERY_CONFIG };