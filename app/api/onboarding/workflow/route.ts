/**
 * Onboarding Workflow API Routes
 * Epic 2 Story 2.5: User Onboarding and Email Verification Infrastructure
 * 
 * Handles onboarding workflow management, step completion, and progress tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { onboardingWorkflowService } from '@/lib/auth/onboarding-workflow';
import { rateLimit } from '@/lib/auth/rate-limiting';

/**
 * GET /api/onboarding/workflow
 * Get user's onboarding progress and current step
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get user from session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const flowId = searchParams.get('flowId');

    // Get current progress
    const progress = await onboardingWorkflowService.getUserOnboardingProgress(user.id, flowId || undefined);
    
    if (!progress) {
      // Initialize onboarding if not started
      const initResult = await onboardingWorkflowService.initializeUserOnboarding(user.id, flowId || undefined);
      
      if (!initResult.success) {
        return NextResponse.json(
          { error: initResult.error },
          { status: 400 }
        );
      }

      // Get progress after initialization
      const newProgress = await onboardingWorkflowService.getUserOnboardingProgress(user.id, initResult.flowId);
      
      return NextResponse.json({
        success: true,
        progress: newProgress,
        initialized: true,
      });
    }

    // Get current step information
    const currentStep = await onboardingWorkflowService.getCurrentStep(user.id, progress.flowId);

    return NextResponse.json({
      success: true,
      progress,
      currentStep: currentStep.step,
      canSkip: currentStep.canSkip,
      isLastStep: currentStep.isLastStep,
    });

  } catch (error) {
    console.error('Error fetching onboarding workflow:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/onboarding/workflow
 * Initialize onboarding workflow for user
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get user from session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { flowId } = body;

    // Rate limiting
    const rateLimitResult = await rateLimit(
      `onboarding_init_${user.id}`, 
      'onboarding_initialization', 
      5, 
      3600
    );

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter
        },
        { status: 429 }
      );
    }

    // Initialize workflow
    const result = await onboardingWorkflowService.initializeUserOnboarding(user.id, flowId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // Get initial progress and step
    const progress = await onboardingWorkflowService.getUserOnboardingProgress(user.id, result.flowId);
    const currentStep = await onboardingWorkflowService.getCurrentStep(user.id, result.flowId);

    return NextResponse.json({
      success: true,
      workflowId: result.progressId,
      flowId: result.flowId,
      progress,
      currentStep: currentStep.step,
      canSkip: currentStep.canSkip,
      isLastStep: currentStep.isLastStep,
    });

  } catch (error) {
    console.error('Error initializing onboarding workflow:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/onboarding/workflow
 * Complete a step in the onboarding workflow
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get user from session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { stepIndex, stepData = {}, skipStep = false } = body;

    if (stepIndex === undefined) {
      return NextResponse.json(
        { error: 'Step index is required' },
        { status: 400 }
      );
    }

    // Rate limiting for step completion
    const rateLimitResult = await rateLimit(
      `onboarding_step_${user.id}`, 
      'onboarding_step_attempt', 
      20, 
      3600
    );

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter
        },
        { status: 429 }
      );
    }

    // Complete step
    const result = await onboardingWorkflowService.completeStep(
      user.id,
      stepIndex,
      stepData,
      skipStep
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // Get updated progress
    const progress = await onboardingWorkflowService.getUserOnboardingProgress(user.id);

    return NextResponse.json({
      success: true,
      message: skipStep ? 'Step skipped successfully' : 'Step completed successfully',
      nextStep: result.nextStep,
      isComplete: result.isComplete,
      progress,
    });

  } catch (error) {
    console.error('Error completing onboarding step:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/onboarding/workflow
 * Abandon onboarding workflow
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get user from session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const flowId = searchParams.get('flowId');
    const reason = searchParams.get('reason');

    if (!flowId) {
      return NextResponse.json(
        { error: 'Flow ID is required' },
        { status: 400 }
      );
    }

    // Abandon onboarding
    const success = await onboardingWorkflowService.abandonOnboarding(user.id, flowId, reason || undefined);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to abandon onboarding' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Onboarding abandoned successfully',
    });

  } catch (error) {
    console.error('Error abandoning onboarding workflow:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}