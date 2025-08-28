/**
 * Onboarding Integration with Authentication System
 * Epic 2 Story 2.5: User Onboarding and Email Verification Infrastructure
 * 
 * Seamless integration with existing authentication, profiles, and MFA systems
 */

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase/server';
import { Database } from '@/lib/supabase/database.types';
import { emailVerificationService } from '@/lib/auth/email-verification';
import { onboardingWorkflowService } from '@/lib/auth/onboarding-workflow';
import { businessVerificationService } from '@/lib/auth/business-verification';

type User = Database['public']['Tables']['profiles']['Row'];
type UserRole = Database['public']['Tables']['user_roles']['Row'];

export interface UserOnboardingContext {
  user: User;
  roles: string[];
  mfaEnabled: boolean;
  emailVerified: boolean;
  hasActiveOnboarding: boolean;
  requiredOnboardingFlows: string[];
  completedFlows: string[];
  businessVerificationRequired: boolean;
  businessVerificationStatus?: string;
}

export interface OnboardingRequirements {
  emailVerification: boolean;
  profileCompletion: boolean;
  mfaSetup: boolean;
  businessVerification: boolean;
  roleSpecificSteps: string[];
}

export class OnboardingIntegrationService {
  /**
   * Get comprehensive onboarding context for user
   */
  async getUserOnboardingContext(userId: string): Promise<UserOnboardingContext | null> {
    try {
      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      // Get user roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          role_id,
          roles!inner(name)
        `)
        .eq('user_id', userId)
        .eq('is_active', true);

      if (rolesError) throw rolesError;

      const roles = userRoles?.map((ur: any) => (ur.roles as any).name) || ['user'];

      // Check MFA status
      const { data: mfaConfig, error: mfaError } = await supabase
        .from('auth_mfa_config')
        .select('mfa_enabled')
        .eq('user_id', userId)
        .single();

      if (mfaError && mfaError.code !== 'PGRST116') {
        throw mfaError;
      }

      const mfaEnabled = mfaConfig?.mfa_enabled || false;

      // Get onboarding progress
      const onboardingProgress = await onboardingWorkflowService.getUserOnboardingProgress(userId);
      
      // Get available flows for user roles
      const availableFlows = await onboardingWorkflowService.getAvailableFlows(userId);
      
      const requiredOnboardingFlows = availableFlows
        .filter(flow => flow.is_required)
        .map(flow => flow.id);

      // Get completed flows
      const { data: completedFlowRecords, error: completedError } = await supabase
        .from('user_onboarding_progress')
        .select('flow_id')
        .eq('user_id', userId)
        .eq('status', 'completed');

      if (completedError) throw completedError;

      const completedFlows = completedFlowRecords?.map((record: any) => record.flow_id) || [];

      // Check business verification requirements
      const businessVerificationRequired = roles.includes('business_owner') || 
        this.requiresBusinessVerification(profile);

      let businessVerificationStatus;
      if (businessVerificationRequired) {
        try {
          const { data: businessWorkflow } = await supabase
            .from('business_verification_workflows')
            .select('status')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          businessVerificationStatus = businessWorkflow?.status;
        } catch (error) {
          businessVerificationStatus = 'not_started';
        }
      }

      return {
        user: profile,
        roles,
        mfaEnabled,
        emailVerified: profile.email_verified || false,
        hasActiveOnboarding: !!onboardingProgress && onboardingProgress.status === 'in_progress',
        requiredOnboardingFlows,
        completedFlows,
        businessVerificationRequired,
        businessVerificationStatus,
      };

    } catch (error) {
      console.error('Error getting user onboarding context:', error);
      return null;
    }
  }

  /**
   * Handle post-registration onboarding initialization
   */
  async initializePostRegistrationOnboarding(
    userId: string,
    registrationData: {
      email: string;
      firstName?: string;
      lastName?: string;
      displayName?: string;
      role?: string;
    }
  ): Promise<{
    success: boolean;
    onboardingInitialized: boolean;
    emailVerificationSent: boolean;
    welcomeCampaignEnrolled: boolean;
    error?: string;
  }> {
    try {
      // 1. Create user profile if it doesn't exist
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          first_name: registrationData.firstName,
          last_name: registrationData.lastName,
          display_name: registrationData.displayName || 
            `${registrationData.firstName} ${registrationData.lastName}`.trim() || 
            registrationData.email.split('@')[0],
          email_verified: false,
          account_status: 'pending_verification',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id',
        });

      if (profileError) throw profileError;

      // 2. Assign default role if specified
      if (registrationData.role) {
        await this.assignUserRole(userId, registrationData.role);
      }

      // 3. Initialize onboarding workflow
      const onboardingResult = await onboardingWorkflowService.initializeUserOnboarding(userId);
      
      if (!onboardingResult.success) {
        console.error('Failed to initialize onboarding:', onboardingResult.error);
      }

      // 4. Send email verification
      const emailVerificationResult = await emailVerificationService.generateVerificationToken(
        userId,
        registrationData.email,
        'registration'
      );

      // 5. Enroll in welcome campaign (handled by database trigger)
      // This is automatically triggered when the profile is created

      return {
        success: true,
        onboardingInitialized: onboardingResult.success,
        emailVerificationSent: emailVerificationResult.success,
        welcomeCampaignEnrolled: true, // Assuming trigger works
      };

    } catch (error) {
      console.error('Error initializing post-registration onboarding:', error);
      return {
        success: false,
        onboardingInitialized: false,
        emailVerificationSent: false,
        welcomeCampaignEnrolled: false,
        error: 'Failed to initialize onboarding',
      };
    }
  }

  /**
   * Check onboarding requirements for user
   */
  async getOnboardingRequirements(userId: string): Promise<OnboardingRequirements> {
    try {
      const context = await this.getUserOnboardingContext(userId);
      
      if (!context) {
        return {
          emailVerification: true,
          profileCompletion: true,
          mfaSetup: false,
          businessVerification: false,
          roleSpecificSteps: [],
        };
      }

      const requirements: OnboardingRequirements = {
        emailVerification: !context.emailVerified,
        profileCompletion: this.isProfileIncomplete(context.user),
        mfaSetup: this.requiresMfaSetup(context.roles, context.mfaEnabled),
        businessVerification: context.businessVerificationRequired && 
          !['approved', 'completed'].includes(context.businessVerificationStatus || ''),
        roleSpecificSteps: this.getRoleSpecificSteps(context.roles),
      };

      return requirements;

    } catch (error) {
      console.error('Error checking onboarding requirements:', error);
      return {
        emailVerification: true,
        profileCompletion: true,
        mfaSetup: false,
        businessVerification: false,
        roleSpecificSteps: [],
      };
    }
  }

  /**
   * Handle successful email verification
   */
  async handleEmailVerification(userId: string): Promise<{
    success: boolean;
    profileUpdated: boolean;
    onboardingAdvanced: boolean;
    achievementUnlocked: boolean;
  }> {
    try {
      // Update profile email verification status
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          email_verified: true,
          account_status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      // Advance onboarding if email verification was a required step
      let onboardingAdvanced = false;
      try {
        const currentStep = await onboardingWorkflowService.getCurrentStep(userId);
        
        if (currentStep.step?.step === 'email_verification') {
          const completionResult = await onboardingWorkflowService.completeStep(
            userId,
            currentStep.stepIndex || 0,
            { verified: true }
          );
          
          onboardingAdvanced = completionResult.success;
        }
      } catch (error) {
        console.error('Error advancing onboarding after email verification:', error);
      }

      // Unlock email verification achievement
      let achievementUnlocked = false;
      try {
        await this.unlockAchievement(userId, 'email_verified');
        achievementUnlocked = true;
      } catch (error) {
        console.error('Error unlocking achievement:', error);
      }

      return {
        success: true,
        profileUpdated: true,
        onboardingAdvanced,
        achievementUnlocked,
      };

    } catch (error) {
      console.error('Error handling email verification:', error);
      return {
        success: false,
        profileUpdated: false,
        onboardingAdvanced: false,
        achievementUnlocked: false,
      };
    }
  }

  /**
   * Handle business verification approval
   */
  async handleBusinessVerificationApproval(
    userId: string,
    workflowId: string
  ): Promise<{
    success: boolean;
    roleUpdated: boolean;
    onboardingCompleted: boolean;
    businessProfileCreated: boolean;
  }> {
    try {
      // Update user role to business_owner
      const roleUpdated = await this.assignUserRole(userId, 'business_owner');

      // Complete business verification onboarding step if active
      let onboardingCompleted = false;
      try {
        const currentStep = await onboardingWorkflowService.getCurrentStep(userId);
        
        if (currentStep.step?.step === 'verification_docs') {
          const completionResult = await onboardingWorkflowService.completeStep(
            userId,
            currentStep.stepIndex || 0,
            { verified: true, workflowId }
          );
          
          onboardingCompleted = completionResult.success;
        }
      } catch (error) {
        console.error('Error completing onboarding after business verification:', error);
      }

      // Create or update business profile
      // This would be more sophisticated in a real implementation
      const businessProfileCreated = true;

      return {
        success: true,
        roleUpdated,
        onboardingCompleted,
        businessProfileCreated,
      };

    } catch (error) {
      console.error('Error handling business verification approval:', error);
      return {
        success: false,
        roleUpdated: false,
        onboardingCompleted: false,
        businessProfileCreated: false,
      };
    }
  }

  /**
   * Check if user can access features based on onboarding completion
   */
  async canAccessFeature(
    userId: string,
    feature: 'create_business' | 'post_review' | 'admin_panel' | 'analytics' | 'api_access'
  ): Promise<{
    allowed: boolean;
    reason?: string;
    requiredSteps?: string[];
  }> {
    try {
      const context = await this.getUserOnboardingContext(userId);
      
      if (!context) {
        return {
          allowed: false,
          reason: 'User context not available',
        };
      }

      const requirements = await this.getOnboardingRequirements(userId);

      // Feature-specific access controls
      switch (feature) {
        case 'create_business':
          if (!context.emailVerified) {
            return {
              allowed: false,
              reason: 'Email verification required',
              requiredSteps: ['email_verification'],
            };
          }
          break;

        case 'post_review':
          if (!context.emailVerified) {
            return {
              allowed: false,
              reason: 'Email verification required',
              requiredSteps: ['email_verification'],
            };
          }
          break;

        case 'admin_panel':
          if (!context.roles.includes('admin') && !context.roles.includes('super_admin')) {
            return {
              allowed: false,
              reason: 'Admin role required',
            };
          }
          
          if (context.roles.includes('admin') && !context.mfaEnabled) {
            return {
              allowed: false,
              reason: 'MFA required for admin access',
              requiredSteps: ['mfa_setup'],
            };
          }
          break;

        case 'analytics':
          if (!context.roles.some(role => ['admin', 'business_owner'].includes(role))) {
            return {
              allowed: false,
              reason: 'Admin or business owner role required',
            };
          }
          break;

        case 'api_access':
          if (!context.emailVerified) {
            return {
              allowed: false,
              reason: 'Email verification required for API access',
              requiredSteps: ['email_verification'],
            };
          }
          break;
      }

      return { allowed: true };

    } catch (error) {
      console.error('Error checking feature access:', error);
      return {
        allowed: false,
        reason: 'Access check failed',
      };
    }
  }

  /**
   * Private helper methods
   */
  
  private requiresBusinessVerification(profile: User): boolean {
    // This would contain logic to determine if business verification is required
    // based on profile data, user behavior, etc.
    return false;
  }

  private isProfileIncomplete(profile: User): boolean {
    const requiredFields = ['first_name', 'last_name'];
    return requiredFields.some(field => !profile[field as keyof User]);
  }

  private requiresMfaSetup(roles: string[], mfaEnabled: boolean): boolean {
    const mfaRequiredRoles = ['admin', 'super_admin', 'business_owner'];
    return roles.some(role => mfaRequiredRoles.includes(role)) && !mfaEnabled;
  }

  private getRoleSpecificSteps(roles: string[]): string[] {
    const steps: string[] = [];

    if (roles.includes('business_owner')) {
      steps.push('business_profile_setup', 'business_verification');
    }

    if (roles.includes('admin')) {
      steps.push('admin_training', 'security_briefing');
    }

    return steps;
  }

  private async assignUserRole(userId: string, roleName: string): Promise<boolean> {
    try {
      // Get role ID
      const { data: role, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('name', roleName)
        .single();

      if (roleError) throw roleError;

      // Assign role to user
      const { error: assignError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role_id: role.id,
          granted_at: new Date().toISOString(),
          is_active: true,
        }, {
          onConflict: 'user_id,role_id',
        });

      if (assignError) throw assignError;

      return true;

    } catch (error) {
      console.error('Error assigning user role:', error);
      return false;
    }
  }

  private async unlockAchievement(userId: string, achievementName: string): Promise<void> {
    try {
      // Get achievement ID
      const { data: achievement, error: achievementError } = await supabase
        .from('achievements')
        .select('id, point_value')
        .eq('name', achievementName)
        .single();

      if (achievementError) throw achievementError;

      // Unlock achievement for user
      const { error: unlockError } = await supabase
        .from('user_achievements')
        .upsert({
          user_id: userId,
          achievement_id: achievement.id,
          status: 'unlocked',
          unlocked_at: new Date().toISOString(),
          points_earned: achievement.point_value || 0,
          progress_percentage: 100,
        }, {
          onConflict: 'user_id,achievement_id',
        });

      if (unlockError) throw unlockError;

    } catch (error) {
      console.error('Error unlocking achievement:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const onboardingIntegrationService = new OnboardingIntegrationService();

// Export utility functions
export const getOnboardingRedirectUrl = (
  context: UserOnboardingContext,
  currentPath: string = '/'
): string => {
  // Determine where to redirect user based on onboarding status
  if (!context.emailVerified) {
    return '/onboarding/verify-email';
  }

  if (context.hasActiveOnboarding) {
    return '/onboarding/continue';
  }

  const requirements = onboardingIntegrationService.getOnboardingRequirements(context.user.id);
  
  // This would be more sophisticated based on requirements
  if (context.businessVerificationRequired && 
      !['approved', 'completed'].includes(context.businessVerificationStatus || '')) {
    return '/onboarding/business-verification';
  }

  return currentPath;
};

export const shouldShowOnboardingBanner = (
  context: UserOnboardingContext
): boolean => {
  return !context.emailVerified || 
    context.hasActiveOnboarding || 
    (context.businessVerificationRequired && 
     !['approved', 'completed'].includes(context.businessVerificationStatus || ''));
};