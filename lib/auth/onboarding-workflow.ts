/**
 * User Onboarding Workflow Management System
 * Epic 2 Story 2.5: User Onboarding and Email Verification Infrastructure
 * 
 * Comprehensive onboarding workflow engine with step tracking, validation, and analytics
 */

import { supabase } from '@/lib/supabase/server';
import { Database } from '@/lib/supabase/database.types';

type OnboardingFlow = Database['public']['Tables']['onboarding_flows']['Row'];
type OnboardingFlowInsert = Database['public']['Tables']['onboarding_flows']['Insert'];
type UserOnboardingProgress = Database['public']['Tables']['user_onboarding_progress']['Row'];
type UserOnboardingProgressInsert = Database['public']['Tables']['user_onboarding_progress']['Insert'];
type OnboardingStepCompletion = Database['public']['Tables']['onboarding_step_completions']['Row'];
type OnboardingStepCompletionInsert = Database['public']['Tables']['onboarding_step_completions']['Insert'];

export interface OnboardingStep {
  step: string;
  name: string;
  type: 'info' | 'form' | 'verification' | 'upload' | 'settings' | 'tutorial' | 'external';
  required: boolean;
  description?: string;
  validation?: Record<string, any>;
  data?: Record<string, any>;
  estimatedMinutes?: number;
  helpText?: string;
  skipConditions?: string[];
}

export interface OnboardingFlowDefinition {
  name: string;
  displayName: string;
  description: string;
  flowType: 'standard' | 'business_owner' | 'admin' | 'custom';
  steps: OnboardingStep[];
  targetRoles: string[];
  isRequired: boolean;
  allowSkip: boolean;
  completionRequiredForAccess: boolean;
  estimatedDurationMinutes: number;
  successCriteria: Record<string, any>;
  targetConditions?: Record<string, any>;
}

export interface StepValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: Record<string, any>;
}

export interface OnboardingProgressData {
  flowId: string;
  flowName: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'skipped' | 'abandoned';
  currentStepIndex: number;
  completedSteps: number[];
  skippedSteps: number[];
  failedSteps: Record<number, string>;
  completionPercentage: number;
  startedAt?: string;
  completedAt?: string;
  lastActivityAt: string;
  engagementScore: number;
  totalTimeSpentMinutes: number;
  sessionsCount: number;
  stepData: Record<string, any>;
  requirementsMet: Record<string, boolean>;
}

export class OnboardingWorkflowService {
  /**
   * Get available onboarding flows for user based on role and conditions
   */
  async getAvailableFlows(userId: string): Promise<OnboardingFlow[]> {
    try {
      // Get user's roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          role_id,
          roles!inner(name)
        `)
        .eq('user_id', userId)
        .eq('is_active', true);

      if (rolesError) throw rolesError;

      const roleNames = userRoles?.map(ur => (ur.roles as any).name) || ['user'];

      // Get active flows that match user's roles
      const { data: flows, error: flowsError } = await supabase
        .from('onboarding_flows')
        .select('*')
        .eq('is_active', true)
        .overlaps('target_roles', roleNames)
        .order('created_at', { ascending: true });

      if (flowsError) throw flowsError;

      return flows || [];

    } catch (error) {
      console.error('Error fetching available flows:', error);
      return [];
    }
  }

  /**
   * Initialize onboarding for a user
   */
  async initializeUserOnboarding(
    userId: string,
    flowId?: string
  ): Promise<{
    success: boolean;
    progressId?: string;
    flowId?: string;
    error?: string;
  }> {
    try {
      let targetFlowId = flowId;

      // If no specific flow provided, determine the appropriate flow
      if (!targetFlowId) {
        const availableFlows = await this.getAvailableFlows(userId);
        
        if (availableFlows.length === 0) {
          return {
            success: false,
            error: 'No onboarding flows available for this user.',
          };
        }

        // Select the first required flow, or the first available flow
        const requiredFlow = availableFlows.find(f => f.is_required);
        targetFlowId = requiredFlow?.id || availableFlows[0].id;
      }

      // Check if user already has progress for this flow
      const { data: existingProgress, error: checkError } = await supabase
        .from('user_onboarding_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('flow_id', targetFlowId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingProgress) {
        return {
          success: true,
          progressId: existingProgress.id,
          flowId: targetFlowId,
        };
      }

      // Create new onboarding progress
      const progressData: UserOnboardingProgressInsert = {
        user_id: userId,
        flow_id: targetFlowId,
        status: 'not_started',
        current_step_index: 0,
        started_at: new Date().toISOString(),
        engagement_score: 0.5,
        sessions_count: 1,
      };

      const { data: newProgress, error: insertError } = await supabase
        .from('user_onboarding_progress')
        .insert(progressData)
        .select()
        .single();

      if (insertError) throw insertError;

      return {
        success: true,
        progressId: newProgress.id,
        flowId: targetFlowId,
      };

    } catch (error) {
      console.error('Error initializing onboarding:', error);
      return {
        success: false,
        error: 'Failed to initialize onboarding.',
      };
    }
  }

  /**
   * Get user's onboarding progress
   */
  async getUserOnboardingProgress(
    userId: string,
    flowId?: string
  ): Promise<OnboardingProgressData | null> {
    try {
      let query = supabase
        .from('user_onboarding_progress')
        .select(`
          *,
          onboarding_flows!inner(*)
        `)
        .eq('user_id', userId);

      if (flowId) {
        query = query.eq('flow_id', flowId);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!data) return null;

      const flow = data.onboarding_flows as any;

      return {
        flowId: data.flow_id,
        flowName: flow.display_name,
        status: data.status as any,
        currentStepIndex: data.current_step_index,
        completedSteps: data.completed_steps || [],
        skippedSteps: data.skipped_steps || [],
        failedSteps: data.failed_steps as Record<number, string> || {},
        completionPercentage: data.completion_percentage || 0,
        startedAt: data.started_at,
        completedAt: data.completed_at,
        lastActivityAt: data.last_activity_at,
        engagementScore: data.engagement_score || 0.5,
        totalTimeSpentMinutes: data.total_time_spent_minutes || 0,
        sessionsCount: data.sessions_count || 0,
        stepData: data.step_data as Record<string, any> || {},
        requirementsMet: data.requirements_met as Record<string, boolean> || {},
      };

    } catch (error) {
      console.error('Error fetching onboarding progress:', error);
      return null;
    }
  }

  /**
   * Get current onboarding step for user
   */
  async getCurrentStep(userId: string, flowId?: string): Promise<{
    step?: OnboardingStep;
    stepIndex?: number;
    canSkip: boolean;
    isLastStep: boolean;
    progress?: OnboardingProgressData;
  }> {
    try {
      const progress = await this.getUserOnboardingProgress(userId, flowId);
      
      if (!progress || progress.status === 'completed') {
        return { canSkip: false, isLastStep: true };
      }

      const { data: flow, error } = await supabase
        .from('onboarding_flows')
        .select('*')
        .eq('id', progress.flowId)
        .single();

      if (error) throw error;

      const steps = flow.steps as OnboardingStep[];
      const currentStep = steps[progress.currentStepIndex];
      const isLastStep = progress.currentStepIndex >= steps.length - 1;

      return {
        step: currentStep,
        stepIndex: progress.currentStepIndex,
        canSkip: flow.allow_skip && !currentStep?.required,
        isLastStep,
        progress,
      };

    } catch (error) {
      console.error('Error fetching current step:', error);
      return { canSkip: false, isLastStep: true };
    }
  }

  /**
   * Complete an onboarding step
   */
  async completeStep(
    userId: string,
    stepIndex: number,
    stepData: Record<string, any> = {},
    skipStep: boolean = false
  ): Promise<{
    success: boolean;
    nextStep?: OnboardingStep;
    isComplete?: boolean;
    error?: string;
  }> {
    try {
      // Get current progress
      const progress = await this.getUserOnboardingProgress(userId);
      if (!progress) {
        return {
          success: false,
          error: 'No onboarding progress found.',
        };
      }

      // Get flow definition
      const { data: flow, error: flowError } = await supabase
        .from('onboarding_flows')
        .select('*')
        .eq('id', progress.flowId)
        .single();

      if (flowError) throw flowError;

      const steps = flow.steps as OnboardingStep[];
      const step = steps[stepIndex];

      if (!step) {
        return {
          success: false,
          error: 'Invalid step index.',
        };
      }

      // Validate step data if not skipping
      if (!skipStep && step.required) {
        const validation = await this.validateStepData(step, stepData);
        if (!validation.isValid) {
          return {
            success: false,
            error: validation.errors.join(', '),
          };
        }
      }

      // Record step completion
      const completionData: OnboardingStepCompletionInsert = {
        progress_id: progress.flowId, // This might need to be progress ID from database
        step_index: stepIndex,
        step_name: step.name,
        step_type: step.type,
        status: skipStep ? 'skipped' : 'completed',
        input_data: stepData,
        completed_at: new Date().toISOString(),
      };

      // We need to get the actual progress record ID
      const { data: progressRecord, error: progressError } = await supabase
        .from('user_onboarding_progress')
        .select('id')
        .eq('user_id', userId)
        .eq('flow_id', progress.flowId)
        .single();

      if (progressError) throw progressError;

      completionData.progress_id = progressRecord.id;

      const { error: completionError } = await supabase
        .from('onboarding_step_completions')
        .insert(completionData);

      if (completionError) throw completionError;

      // Update progress
      const completedSteps = skipStep 
        ? progress.completedSteps 
        : [...progress.completedSteps, stepIndex];
      
      const skippedSteps = skipStep 
        ? [...progress.skippedSteps, stepIndex] 
        : progress.skippedSteps;

      const nextStepIndex = stepIndex + 1;
      const isComplete = nextStepIndex >= steps.length;
      
      const updatedStepData = {
        ...progress.stepData,
        [step.step]: stepData,
      };

      const completionPercentage = (completedSteps.length / steps.length) * 100;

      const updateData = {
        current_step_index: nextStepIndex,
        completed_steps: completedSteps,
        skipped_steps: skippedSteps,
        completion_percentage: completionPercentage,
        step_data: updatedStepData,
        last_activity_at: new Date().toISOString(),
        status: isComplete ? 'completed' : 'in_progress',
        completed_at: isComplete ? new Date().toISOString() : null,
      };

      const { error: updateError } = await supabase
        .from('user_onboarding_progress')
        .update(updateData)
        .eq('id', progressRecord.id);

      if (updateError) throw updateError;

      // Return next step if not complete
      const nextStep = isComplete ? undefined : steps[nextStepIndex];

      return {
        success: true,
        nextStep,
        isComplete,
      };

    } catch (error) {
      console.error('Error completing step:', error);
      return {
        success: false,
        error: 'Failed to complete step.',
      };
    }
  }

  /**
   * Validate step data based on step requirements
   */
  async validateStepData(
    step: OnboardingStep,
    data: Record<string, any>
  ): Promise<StepValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic required field validation
      if (step.required && (!data || Object.keys(data).length === 0)) {
        errors.push('Step data is required but not provided.');
        return { isValid: false, errors, warnings };
      }

      // Step-type specific validation
      switch (step.type) {
        case 'form':
          await this.validateFormStep(step, data, errors, warnings);
          break;
        
        case 'verification':
          await this.validateVerificationStep(step, data, errors, warnings);
          break;
        
        case 'upload':
          await this.validateUploadStep(step, data, errors, warnings);
          break;
        
        case 'settings':
          await this.validateSettingsStep(step, data, errors, warnings);
          break;
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        data,
      };

    } catch (error) {
      console.error('Error validating step data:', error);
      return {
        isValid: false,
        errors: ['Validation failed unexpectedly.'],
        warnings,
      };
    }
  }

  /**
   * Validate form step data
   */
  private async validateFormStep(
    step: OnboardingStep,
    data: Record<string, any>,
    errors: string[],
    warnings: string[]
  ): Promise<void> {
    const validation = step.validation || {};
    
    for (const [field, rules] of Object.entries(validation)) {
      const value = data[field];
      const fieldRules = rules as any;

      if (fieldRules.required && (!value || value === '')) {
        errors.push(`${field} is required.`);
      }

      if (value && fieldRules.minLength && value.length < fieldRules.minLength) {
        errors.push(`${field} must be at least ${fieldRules.minLength} characters.`);
      }

      if (value && fieldRules.maxLength && value.length > fieldRules.maxLength) {
        errors.push(`${field} must be no more than ${fieldRules.maxLength} characters.`);
      }

      if (value && fieldRules.pattern && !new RegExp(fieldRules.pattern).test(value)) {
        errors.push(`${field} format is invalid.`);
      }

      if (value && fieldRules.email && !this.isValidEmail(value)) {
        errors.push(`${field} must be a valid email address.`);
      }
    }
  }

  /**
   * Validate verification step data
   */
  private async validateVerificationStep(
    step: OnboardingStep,
    data: Record<string, any>,
    errors: string[],
    warnings: string[]
  ): Promise<void> {
    if (step.step === 'email_verification') {
      if (!data.verified || data.verified !== true) {
        errors.push('Email verification is required to continue.');
      }
    }

    if (step.step === 'phone_verification') {
      if (!data.phone || !data.verified) {
        errors.push('Phone verification is required to continue.');
      }
    }
  }

  /**
   * Validate upload step data
   */
  private async validateUploadStep(
    step: OnboardingStep,
    data: Record<string, any>,
    errors: string[],
    warnings: string[]
  ): Promise<void> {
    const requiredUploads = step.validation?.requiredDocuments || [];
    
    for (const docType of requiredUploads) {
      if (!data.uploads || !data.uploads[docType]) {
        errors.push(`${docType} document upload is required.`);
      }
    }
  }

  /**
   * Validate settings step data
   */
  private async validateSettingsStep(
    step: OnboardingStep,
    data: Record<string, any>,
    errors: string[],
    warnings: string[]
  ): Promise<void> {
    // Basic settings validation
    if (step.validation?.requiredSettings) {
      for (const setting of step.validation.requiredSettings) {
        if (data[setting] === undefined) {
          errors.push(`${setting} setting is required.`);
        }
      }
    }
  }

  /**
   * Get onboarding statistics for user
   */
  async getOnboardingStats(userId: string): Promise<{
    totalFlows: number;
    completedFlows: number;
    inProgressFlows: number;
    completionRate: number;
    totalStepsCompleted: number;
    averageCompletionTime: number;
    engagementScore: number;
  }> {
    try {
      const { data: progressRecords, error } = await supabase
        .from('user_onboarding_progress')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      const records = progressRecords || [];
      const totalFlows = records.length;
      const completedFlows = records.filter(r => r.status === 'completed').length;
      const inProgressFlows = records.filter(r => r.status === 'in_progress').length;
      const completionRate = totalFlows > 0 ? (completedFlows / totalFlows) * 100 : 0;
      
      const totalStepsCompleted = records.reduce(
        (sum, r) => sum + (r.completed_steps?.length || 0), 0
      );
      
      const completedRecords = records.filter(r => r.status === 'completed');
      const averageCompletionTime = completedRecords.length > 0
        ? completedRecords.reduce((sum, r) => sum + (r.total_time_spent_minutes || 0), 0) / completedRecords.length
        : 0;

      const engagementScore = records.length > 0
        ? records.reduce((sum, r) => sum + (r.engagement_score || 0), 0) / records.length
        : 0;

      return {
        totalFlows,
        completedFlows,
        inProgressFlows,
        completionRate,
        totalStepsCompleted,
        averageCompletionTime,
        engagementScore,
      };

    } catch (error) {
      console.error('Error fetching onboarding stats:', error);
      return {
        totalFlows: 0,
        completedFlows: 0,
        inProgressFlows: 0,
        completionRate: 0,
        totalStepsCompleted: 0,
        averageCompletionTime: 0,
        engagementScore: 0,
      };
    }
  }

  /**
   * Abandon onboarding flow
   */
  async abandonOnboarding(userId: string, flowId: string, reason?: string): Promise<boolean> {
    try {
      const { data: progress, error: findError } = await supabase
        .from('user_onboarding_progress')
        .select('id')
        .eq('user_id', userId)
        .eq('flow_id', flowId)
        .single();

      if (findError) throw findError;

      const { error: updateError } = await supabase
        .from('user_onboarding_progress')
        .update({
          status: 'abandoned',
          abandoned_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', progress.id);

      if (updateError) throw updateError;

      return true;

    } catch (error) {
      console.error('Error abandoning onboarding:', error);
      return false;
    }
  }

  /**
   * Utility method to validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// Export singleton instance
export const onboardingWorkflowService = new OnboardingWorkflowService();

// Export utility functions
export const getStepTypeName = (type: OnboardingStep['type']): string => {
  const names = {
    info: 'Information',
    form: 'Form',
    verification: 'Verification',
    upload: 'Upload',
    settings: 'Settings',
    tutorial: 'Tutorial',
    external: 'External',
  };
  return names[type] || type;
};

export const calculateEstimatedTimeRemaining = (
  steps: OnboardingStep[],
  currentStepIndex: number
): number => {
  return steps
    .slice(currentStepIndex)
    .reduce((total, step) => total + (step.estimatedMinutes || 2), 0);
};