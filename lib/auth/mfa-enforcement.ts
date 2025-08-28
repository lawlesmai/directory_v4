/**
 * MFA Enforcement Middleware with Role-Based Policies
 * Comprehensive MFA policy enforcement for different user roles and contexts
 * 
 * The Lawless Directory - Epic 2 Story 2.4
 * Multi-Factor Authentication Infrastructure
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { DeviceTrustUtils } from './device-trust';
import { NextRequest, NextResponse } from 'next/server';

// Configuration for MFA enforcement policies
const MFA_ENFORCEMENT_CONFIG = {
  // Role-based MFA requirements
  roleRequirements: {
    super_admin: { required: true, gracePeriodDays: 0, methods: ['totp', 'backup_code'] },
    admin: { required: true, gracePeriodDays: 7, methods: ['totp', 'sms', 'backup_code'] },
    moderator: { required: false, gracePeriodDays: 14, methods: ['totp', 'sms', 'backup_code'] },
    business_owner: { required: true, gracePeriodDays: 30, methods: ['totp', 'sms', 'backup_code'] },
    user: { required: false, gracePeriodDays: 0, methods: ['totp', 'sms', 'backup_code'] },
    guest: { required: false, gracePeriodDays: 0, methods: [] }
  },
  
  // Action-based MFA requirements
  actionRequirements: {
    // Administrative actions
    'admin:user:impersonate': { required: true, freshness: 300 }, // 5 minutes
    'admin:user:delete': { required: true, freshness: 300 },
    'admin:system:configure': { required: true, freshness: 600 }, // 10 minutes
    'admin:roles:assign': { required: true, freshness: 300 },
    
    // Business management
    'business:create': { required: false, freshness: 1800 }, // 30 minutes
    'business:transfer': { required: true, freshness: 300 },
    'business:delete': { required: true, freshness: 300 },
    'business:verify': { required: true, freshness: 600 },
    
    // Financial/sensitive actions
    'subscription:upgrade': { required: true, freshness: 900 }, // 15 minutes
    'subscription:cancel': { required: true, freshness: 600 },
    'payment:add': { required: true, freshness: 900 },
    'payment:delete': { required: true, freshness: 300 },
    
    // Account security
    'account:password:change': { required: true, freshness: 300 },
    'account:email:change': { required: true, freshness: 300 },
    'account:mfa:disable': { required: true, freshness: 300 },
    'account:delete': { required: true, freshness: 300 },
    
    // Data export/sensitive operations
    'data:export': { required: true, freshness: 1800 },
    'analytics:export': { required: true, freshness: 1800 }
  },
  
  // Risk-based triggers
  riskTriggers: {
    newDevice: { mfaRequired: true, trustThreshold: 0.6 },
    newLocation: { mfaRequired: true, distanceThreshold: 500 }, // km
    suspiciousActivity: { mfaRequired: true, scoreThreshold: 0.7 },
    failedAttempts: { mfaRequired: true, attemptThreshold: 3 },
    vpnUsage: { mfaRequired: false, allowBypass: true },
    torUsage: { mfaRequired: true, allowBypass: false }
  },
  
  // Context-based settings
  contextSettings: {
    apiAccess: { 
      requireApiKey: true, 
      mfaForSensitive: true,
      rateLimitMultiplier: 2 
    },
    webAccess: { 
      deviceTrustRequired: true, 
      sessionTimeout: 3600 // 1 hour
    },
    mobileAccess: { 
      biometricPreferred: true, 
      extendedSession: true 
    }
  },
  
  // Grace period settings
  gracePeriod: {
    newUserDays: 7,
    enrollmentReminderDays: [1, 3, 7, 14, 28],
    enforcementWarningDays: 3
  },
  
  // Bypass settings
  bypass: {
    emergencyCodeDuration: 24, // hours
    adminOverrideDuration: 4, // hours
    recoveryTokenDuration: 1 // hour
  }
} as const;

// Initialize Supabase client
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * MFA Enforcement Context Interface
 */
interface MFAEnforcementContext {
  userId: string;
  sessionId?: string;
  userRoles: string[];
  action?: string;
  deviceId?: string;
  ipAddress: string;
  userAgent: string;
  riskScore?: number;
  deviceTrustScore?: number;
  isNewDevice?: boolean;
  isNewLocation?: boolean;
  lastMFATime?: Date;
}

/**
 * MFA Enforcement Result Interface
 */
interface MFAEnforcementResult {
  required: boolean;
  methods: string[];
  reason: string;
  gracePeriodExpires?: Date;
  freshnessMeet?: boolean;
  bypassAvailable?: boolean;
  skipReasons?: string[];
  errorMessage?: string;
}

/**
 * MFA Policy Check Result Interface
 */
interface MFAPolicyResult {
  enforce: boolean;
  policy: string;
  requirements: {
    methods: string[];
    freshness?: number;
    gracePeriod?: Date;
  };
  metadata: {
    userRoles: string[];
    trustScore?: number;
    riskFactors: string[];
  };
}

/**
 * MFA Enforcement Service
 */
export class MFAEnforcementService {
  /**
   * Main enforcement check - determines if MFA is required
   */
  static async checkMFARequirement(
    context: MFAEnforcementContext
  ): Promise<MFAEnforcementResult> {
    try {
      // Get user MFA configuration
      const mfaConfig = await this.getUserMFAConfig(context.userId);
      
      // Check if MFA is already satisfied for this session
      const mfaStatus = await this.getSessionMFAStatus(context);
      
      // Check various enforcement policies
      const rolePolicy = await this.checkRoleBasedPolicy(context, mfaConfig);
      const actionPolicy = await this.checkActionBasedPolicy(context, mfaStatus);
      const riskPolicy = await this.checkRiskBasedPolicy(context);
      const devicePolicy = await this.checkDeviceBasedPolicy(context);
      
      // Determine final enforcement decision
      const enforcement = this.consolidateEnforcement([
        rolePolicy,
        actionPolicy,
        riskPolicy,
        devicePolicy
      ]);
      
      // Check for bypass conditions
      const bypassCheck = await this.checkBypassConditions(context, enforcement);
      
      // Apply bypass if available
      if (bypassCheck.canBypass) {
        return {
          required: false,
          methods: [],
          reason: `Bypass applied: ${bypassCheck.reason}`,
          bypassAvailable: true,
          skipReasons: [bypassCheck.reason || 'Unknown bypass reason']
        };
      }
      
      // Return final result
      return {
        required: enforcement.enforce,
        methods: enforcement.requirements.methods,
        reason: this.formatEnforcementReason(enforcement),
        gracePeriodExpires: enforcement.requirements.gracePeriod,
        freshnessMeet: mfaStatus.isFresh,
        bypassAvailable: bypassCheck.available
      };
      
    } catch (error) {
      console.error('MFA enforcement check error:', error);
      return {
        required: true, // Fail secure
        methods: ['totp', 'backup_code'],
        reason: 'System error - MFA required for security',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Checks role-based MFA policies
   */
  private static async checkRoleBasedPolicy(
    context: MFAEnforcementContext,
    mfaConfig: any
  ): Promise<MFAPolicyResult> {
    // Get highest privilege role
    const highestRole = this.getHighestPrivilegeRole(context.userRoles);
    const roleConfig = MFA_ENFORCEMENT_CONFIG.roleRequirements[
      highestRole as keyof typeof MFA_ENFORCEMENT_CONFIG.roleRequirements
    ];
    
    if (!roleConfig || !roleConfig.required) {
      return {
        enforce: false,
        policy: 'role_based',
        requirements: { methods: [] },
        metadata: {
          userRoles: context.userRoles,
          riskFactors: []
        }
      };
    }
    
    // Check grace period
    let gracePeriodExpires: Date | undefined;
    if (roleConfig.gracePeriodDays > 0) {
      const accountCreated = await this.getUserAccountCreationDate(context.userId);
      if (accountCreated) {
        gracePeriodExpires = new Date(accountCreated);
        gracePeriodExpires.setDate(gracePeriodExpires.getDate() + roleConfig.gracePeriodDays);
        
        // If still in grace period and MFA not enabled
        if (new Date() < gracePeriodExpires && !mfaConfig?.mfa_enabled) {
          return {
            enforce: false,
            policy: 'role_based_grace',
            requirements: { 
              methods: [...roleConfig.methods],
              gracePeriod: gracePeriodExpires
            },
            metadata: {
              userRoles: context.userRoles,
              riskFactors: ['grace_period_active']
            }
          };
        }
      }
    }
    
    return {
      enforce: true,
      policy: 'role_based',
      requirements: {
        methods: [...roleConfig.methods],
        gracePeriod: gracePeriodExpires
      },
      metadata: {
        userRoles: context.userRoles,
        riskFactors: [`role_${highestRole}_requires_mfa`]
      }
    };
  }
  
  /**
   * Checks action-based MFA policies
   */
  private static async checkActionBasedPolicy(
    context: MFAEnforcementContext,
    mfaStatus: any
  ): Promise<MFAPolicyResult> {
    if (!context.action) {
      return {
        enforce: false,
        policy: 'action_based',
        requirements: { methods: [] },
        metadata: { userRoles: context.userRoles, riskFactors: [] }
      };
    }
    
    const actionConfig = MFA_ENFORCEMENT_CONFIG.actionRequirements[
      context.action as keyof typeof MFA_ENFORCEMENT_CONFIG.actionRequirements
    ];
    
    if (!actionConfig || !actionConfig.required) {
      return {
        enforce: false,
        policy: 'action_based',
        requirements: { methods: [] },
        metadata: { userRoles: context.userRoles, riskFactors: [] }
      };
    }
    
    // Check freshness requirement
    const freshnessRequired = actionConfig.freshness;
    if (freshnessRequired && mfaStatus.lastMFATime) {
      const timeSinceLastMFA = Date.now() - mfaStatus.lastMFATime.getTime();
      const freshnessSeconds = freshnessRequired * 1000;
      
      if (timeSinceLastMFA <= freshnessSeconds) {
        return {
          enforce: false,
          policy: 'action_based_fresh',
          requirements: { 
            methods: ['totp', 'sms', 'backup_code'],
            freshness: freshnessRequired
          },
          metadata: {
            userRoles: context.userRoles,
            riskFactors: ['mfa_recently_verified']
          }
        };
      }
    }
    
    return {
      enforce: true,
      policy: 'action_based',
      requirements: {
        methods: ['totp', 'sms', 'backup_code'],
        freshness: freshnessRequired
      },
      metadata: {
        userRoles: context.userRoles,
        riskFactors: [`action_${context.action}_requires_mfa`]
      }
    };
  }
  
  /**
   * Checks risk-based MFA policies
   */
  private static async checkRiskBasedPolicy(
    context: MFAEnforcementContext
  ): Promise<MFAPolicyResult> {
    const riskFactors: string[] = [];
    let enforce = false;
    
    // Check for new device
    if (context.isNewDevice) {
      const config = MFA_ENFORCEMENT_CONFIG.riskTriggers.newDevice;
      if (config.mfaRequired && (context.deviceTrustScore || 0) < config.trustThreshold) {
        enforce = true;
        riskFactors.push('new_untrusted_device');
      }
    }
    
    // Check for new location
    if (context.isNewLocation) {
      enforce = true;
      riskFactors.push('new_geographic_location');
    }
    
    // Check overall risk score
    if (context.riskScore && context.riskScore > MFA_ENFORCEMENT_CONFIG.riskTriggers.suspiciousActivity.scoreThreshold) {
      enforce = true;
      riskFactors.push('high_risk_activity');
    }
    
    return {
      enforce,
      policy: 'risk_based',
      requirements: {
        methods: ['totp', 'sms', 'backup_code']
      },
      metadata: {
        userRoles: context.userRoles,
        trustScore: context.deviceTrustScore,
        riskFactors
      }
    };
  }
  
  /**
   * Checks device-based MFA policies
   */
  private static async checkDeviceBasedPolicy(
    context: MFAEnforcementContext
  ): Promise<MFAPolicyResult> {
    if (!context.deviceId) {
      return {
        enforce: true,
        policy: 'device_based',
        requirements: { methods: ['totp', 'sms', 'backup_code'] },
        metadata: {
          userRoles: context.userRoles,
          riskFactors: ['no_device_identification']
        }
      };
    }
    
    // Get device trust status
    const deviceStatus = await DeviceTrustUtils.getDeviceTrustStatus(
      context.userId,
      context.deviceId
    );
    
    return {
      enforce: deviceStatus.requiresMFA,
      policy: 'device_based',
      requirements: {
        methods: ['totp', 'sms', 'backup_code']
      },
      metadata: {
        userRoles: context.userRoles,
        trustScore: deviceStatus.trustScore,
        riskFactors: deviceStatus.riskFactors
      }
    };
  }
  
  /**
   * Consolidates multiple policy results into final decision
   */
  private static consolidateEnforcement(
    policies: MFAPolicyResult[]
  ): MFAPolicyResult {
    // If any policy requires enforcement, MFA is required
    const enforcingPolicies = policies.filter(p => p.enforce);
    
    if (enforcingPolicies.length === 0) {
      return {
        enforce: false,
        policy: 'none',
        requirements: { methods: [] },
        metadata: { userRoles: [], riskFactors: [] }
      };
    }
    
    // Combine all requirements
    const allMethods = new Set<string>();
    const allRiskFactors: string[] = [];
    let shortestFreshness: number | undefined;
    let earliestGracePeriod: Date | undefined;
    
    for (const policy of enforcingPolicies) {
      policy.requirements.methods.forEach(method => allMethods.add(method));
      allRiskFactors.push(...policy.metadata.riskFactors);
      
      if (policy.requirements.freshness) {
        shortestFreshness = Math.min(
          shortestFreshness || policy.requirements.freshness,
          policy.requirements.freshness
        );
      }
      
      if (policy.requirements.gracePeriod) {
        earliestGracePeriod = !earliestGracePeriod || policy.requirements.gracePeriod < earliestGracePeriod
          ? policy.requirements.gracePeriod
          : earliestGracePeriod;
      }
    }
    
    return {
      enforce: true,
      policy: enforcingPolicies.map(p => p.policy).join(', '),
      requirements: {
        methods: Array.from(allMethods),
        freshness: shortestFreshness,
        gracePeriod: earliestGracePeriod
      },
      metadata: {
        userRoles: policies[0]?.metadata.userRoles || [],
        trustScore: policies.find(p => p.metadata.trustScore)?.metadata.trustScore,
        riskFactors: [...new Set(allRiskFactors)]
      }
    };
  }
  
  /**
   * Checks for bypass conditions
   */
  private static async checkBypassConditions(
    context: MFAEnforcementContext,
    enforcement: MFAPolicyResult
  ): Promise<{ canBypass: boolean; available: boolean; reason?: string }> {
    // Check for admin override
    const adminOverride = await this.checkAdminOverride(context.userId);
    if (adminOverride.active) {
      return {
        canBypass: true,
        available: true,
        reason: `Admin override active until ${adminOverride.expiresAt}`
      };
    }
    
    // Check for emergency access codes
    const emergencyAccess = await this.checkEmergencyAccess(context.userId);
    if (emergencyAccess.active) {
      return {
        canBypass: true,
        available: true,
        reason: 'Emergency access code used'
      };
    }
    
    // Check for recovery token
    const recoveryToken = await this.checkRecoveryToken(context.userId);
    if (recoveryToken.active) {
      return {
        canBypass: true,
        available: true,
        reason: 'Recovery token active'
      };
    }
    
    return { canBypass: false, available: false };
  }
  
  /**
   * Helper methods
   */
  
  private static async getUserMFAConfig(userId: string): Promise<any> {
    const { data } = await supabase
      .from('auth_mfa_config')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    return data;
  }
  
  private static async getSessionMFAStatus(
    context: MFAEnforcementContext
  ): Promise<{ isFresh: boolean; lastMFATime?: Date }> {
    if (!context.sessionId) {
      return { isFresh: false };
    }
    
    const { data } = await supabase
      .from('user_sessions')
      .select('mfa_verified_at')
      .eq('id', context.sessionId)
      .single();
    
    if (!data?.mfa_verified_at) {
      return { isFresh: false };
    }
    
    const lastMFATime = new Date(data.mfa_verified_at);
    const timeSinceLastMFA = Date.now() - lastMFATime.getTime();
    const freshnessThreshold = 30 * 60 * 1000; // 30 minutes default
    
    return {
      isFresh: timeSinceLastMFA <= freshnessThreshold,
      lastMFATime
    };
  }
  
  private static getHighestPrivilegeRole(roles: string[]): string {
    const hierarchy = ['super_admin', 'admin', 'moderator', 'business_owner', 'user', 'guest'];
    
    for (const role of hierarchy) {
      if (roles.includes(role)) {
        return role;
      }
    }
    
    return 'user';
  }
  
  private static async getUserAccountCreationDate(userId: string): Promise<Date | null> {
    const { data } = await supabase
      .from('profiles')
      .select('created_at')
      .eq('id', userId)
      .single();
    
    return data?.created_at ? new Date(data.created_at) : null;
  }
  
  private static async checkAdminOverride(userId: string): Promise<{ active: boolean; expiresAt?: string }> {
    const { data } = await supabase
      .from('mfa_admin_overrides')
      .select('expires_at')
      .eq('target_user_id', userId)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    return {
      active: !!data,
      expiresAt: data?.expires_at
    };
  }
  
  private static async checkEmergencyAccess(userId: string): Promise<{ active: boolean }> {
    // Implementation would check for emergency access codes
    // This is a placeholder for the emergency access system
    return { active: false };
  }
  
  private static async checkRecoveryToken(userId: string): Promise<{ active: boolean }> {
    const { data } = await supabase
      .from('mfa_recovery_requests')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('completed_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // 1 hour
      .single();
    
    return { active: !!data };
  }
  
  private static formatEnforcementReason(enforcement: MFAPolicyResult): string {
    const reasons = enforcement.metadata.riskFactors;
    
    if (reasons.length === 0) {
      return `MFA required by ${enforcement.policy} policy`;
    }
    
    return `MFA required: ${reasons.join(', ')}`;
  }
}

/**
 * Express/Next.js Middleware for MFA Enforcement
 */
export class MFAMiddleware {
  /**
   * Next.js middleware function
   */
  static async enforceForNextJS(
    request: NextRequest,
    context: {
      userId: string;
      userRoles: string[];
      action?: string;
      sessionId?: string;
    }
  ): Promise<NextResponse | null> {
    const enforcementContext: MFAEnforcementContext = {
      userId: context.userId,
      sessionId: context.sessionId,
      userRoles: context.userRoles,
      action: context.action,
      ipAddress: request.ip || '0.0.0.0',
      userAgent: request.headers.get('user-agent') || '',
      deviceId: request.cookies.get('device_id')?.value
    };
    
    const result = await MFAEnforcementService.checkMFARequirement(enforcementContext);
    
    if (result.required) {
      // Redirect to MFA challenge page
      const mfaUrl = new URL('/auth/mfa', request.url);
      mfaUrl.searchParams.set('return_to', request.url);
      mfaUrl.searchParams.set('methods', result.methods.join(','));
      mfaUrl.searchParams.set('reason', result.reason);
      
      return NextResponse.redirect(mfaUrl);
    }
    
    return null; // Allow request to continue
  }
  
  /**
   * API route protection
   */
  static async enforceForAPI(
    request: NextRequest,
    context: {
      userId: string;
      userRoles: string[];
      action?: string;
    }
  ): Promise<{ allowed: boolean; response?: NextResponse }> {
    const enforcementContext: MFAEnforcementContext = {
      userId: context.userId,
      userRoles: context.userRoles,
      action: context.action,
      ipAddress: request.ip || '0.0.0.0',
      userAgent: request.headers.get('user-agent') || ''
    };
    
    const result = await MFAEnforcementService.checkMFARequirement(enforcementContext);
    
    if (result.required) {
      return {
        allowed: false,
        response: NextResponse.json(
          {
            error: 'MFA_REQUIRED',
            message: result.reason,
            mfa_methods: result.methods,
            grace_period_expires: result.gracePeriodExpires
          },
          { status: 403 }
        )
      };
    }
    
    return { allowed: true };
  }
}

/**
 * MFA Policy Configuration Utilities
 */
export class MFAPolicyUtils {
  /**
   * Gets MFA requirements for a specific role
   */
  static getRoleRequirements(role: string): typeof MFA_ENFORCEMENT_CONFIG.roleRequirements[keyof typeof MFA_ENFORCEMENT_CONFIG.roleRequirements] | null {
    return MFA_ENFORCEMENT_CONFIG.roleRequirements[
      role as keyof typeof MFA_ENFORCEMENT_CONFIG.roleRequirements
    ] || null;
  }
  
  /**
   * Gets MFA requirements for a specific action
   */
  static getActionRequirements(action: string): typeof MFA_ENFORCEMENT_CONFIG.actionRequirements[keyof typeof MFA_ENFORCEMENT_CONFIG.actionRequirements] | null {
    return MFA_ENFORCEMENT_CONFIG.actionRequirements[
      action as keyof typeof MFA_ENFORCEMENT_CONFIG.actionRequirements
    ] || null;
  }
  
  /**
   * Validates MFA policy configuration
   */
  static validatePolicyConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Validate role requirements
    for (const [role, config] of Object.entries(MFA_ENFORCEMENT_CONFIG.roleRequirements)) {
      if (config.gracePeriodDays < 0) {
        errors.push(`Role ${role} has negative grace period`);
      }
      
      if (config.methods.length === 0 && config.required) {
        errors.push(`Role ${role} requires MFA but has no allowed methods`);
      }
    }
    
    // Validate action requirements
    for (const [action, config] of Object.entries(MFA_ENFORCEMENT_CONFIG.actionRequirements)) {
      if (config.freshness && config.freshness < 60) {
        errors.push(`Action ${action} has freshness requirement less than 60 seconds`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export types and configuration
export type {
  MFAEnforcementContext,
  MFAEnforcementResult,
  MFAPolicyResult
};

export { MFA_ENFORCEMENT_CONFIG };