/**
 * KYC Administrative Review API
 * Epic 2 Story 2.9: Business Owner Verification & KYC
 * Endpoint: POST /api/kyc/admin/review
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { rateLimit } from '@/lib/api/rate-limit';
import { validateCSRF } from '@/lib/api/csrf';
import { logSecurityEvent } from '@/lib/api/security-monitoring';

// Validation schema
const adminReviewSchema = z.object({
  verificationId: z.string().uuid('Invalid verification ID format'),
  decision: z.enum(['approved', 'rejected', 'pending']),
  reviewNotes: z.string().min(10, 'Review notes must be at least 10 characters').max(2000, 'Review notes too long'),
  decisionReason: z.string().min(5, 'Decision reason is required').max(500, 'Decision reason too long'),
  requiresAdditionalDocuments: z.boolean().default(false),
  additionalDocumentsRequired: z.array(z.string()).optional(),
  escalateToSeniorReviewer: z.boolean().default(false),
  flagForCompliance: z.boolean().default(false),
  complianceNotes: z.string().max(1000, 'Compliance notes too long').optional(),
  csrfToken: z.string().min(1, 'CSRF token is required')
});

interface AdminReviewResponse {
  success: boolean;
  verificationId?: string;
  decision?: string;
  status?: string;
  message?: string;
  nextActions?: string[];
  error?: string;
  code?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<AdminReviewResponse>> {
  const startTime = Date.now();
  const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  
  try {
    // Rate limiting - 20 reviews per hour per IP (admin activity)
    const rateLimitResult = await rateLimit('kyc-admin-review', clientIP, 20, 3600);
    if (!rateLimitResult.allowed) {
      await logSecurityEvent('rate_limit_exceeded', 'high', request, {
        retryAfter: rateLimitResult.retryAfter
      });
      
      return NextResponse.json({
        success: false,
        error: 'Too many review requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      }, { status: 429 });
    }

    // Parse and validate request body
    let body: z.infer<typeof adminReviewSchema>;
    try {
      const rawBody = await request.json();
      body = adminReviewSchema.parse(rawBody);
    } catch (error) {
      await logSecurityEvent('kyc_admin_review_invalid_request', 'medium', request, {
        error: error instanceof Error ? error.message : 'Unknown validation error'
      });
      
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        code: 'INVALID_REQUEST'
      }, { status: 400 });
    }

    // CSRF validation
    if (!await validateCSRF(request)) {
      await logSecurityEvent('kyc_admin_review_csrf_validation_failed', 'high', request, {
        verificationId: body.verificationId
      });
      
      return NextResponse.json({
        success: false,
        error: 'Invalid CSRF token',
        code: 'CSRF_VALIDATION_FAILED'
      }, { status: 403 });
    }

    // Initialize Supabase client
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      await logSecurityEvent('kyc_admin_review_unauthenticated', 'high', request, {
        
        verificationId: body.verificationId
      });
      
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      }, { status: 401 });
    }

    // Verify user has admin/reviewer permissions
    const { data: hasReviewPermission } = await supabase.rpc('user_has_enhanced_permission', {
      p_user_id: user.id,
      p_resource: 'businesses',
      p_action: 'verify'
    });

    const { data: hasAdminPermission } = await supabase.rpc('user_has_enhanced_permission', {
      p_user_id: user.id,
      p_resource: 'users',
      p_action: 'manage'
    });

    if (!hasReviewPermission && !hasAdminPermission) {
      await logSecurityEvent('kyc_admin_review_unauthorized', 'high', request, {
        
        userId: user.id,
        verificationId: body.verificationId
      });
      
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions to perform KYC reviews',
        code: 'INSUFFICIENT_PERMISSIONS'
      }, { status: 403 });
    }

    // Get verification details
    const { data: verification, error: verificationError } = await supabase
      .from('kyc_verifications')
      .select(`
        id, user_id, business_id, verification_type, status,
        assigned_reviewer_id, risk_level, decision
      `)
      .eq('id', body.verificationId)
      .single();

    if (verificationError || !verification) {
      await logSecurityEvent('kyc_admin_review_verification_not_found', 'medium', request, {
        
        userId: user.id,
        verificationId: body.verificationId
      });
      
      return NextResponse.json({
        success: false,
        error: 'KYC verification not found',
        code: 'VERIFICATION_NOT_FOUND'
      }, { status: 404 });
    }

    // Check if verification is in reviewable state
    if (!['under_review', 'verification_pending', 'additional_info_required'].includes(verification.status)) {
      return NextResponse.json({
        success: false,
        error: 'Verification is not in a reviewable state',
        code: 'NOT_REVIEWABLE'
      }, { status: 400 });
    }

    // Check if already decided
    if (verification.decision && verification.decision !== 'pending') {
      return NextResponse.json({
        success: false,
        error: 'Verification has already been decided',
        code: 'ALREADY_DECIDED'
      }, { status: 400 });
    }

    // If escalating, check for senior reviewer permissions
    if (body.escalateToSeniorReviewer) {
      const { data: hasSeniorPermission } = await supabase.rpc('user_has_enhanced_permission', {
        p_user_id: user.id,
        p_resource: 'users',
        p_action: 'manage'
      });

      if (!hasSeniorPermission) {
        return NextResponse.json({
          success: false,
          error: 'Insufficient permissions to escalate to senior reviewer',
          code: 'ESCALATION_NOT_ALLOWED'
        }, { status: 403 });
      }
    }

    // Start database transaction for atomic review processing
    const { data: reviewResult, error: reviewError } = await supabase.rpc('finalize_kyc_verification', {
      p_verification_id: body.verificationId,
      p_decision: body.decision === 'pending' ? null : body.decision,
      p_reviewer_id: user.id
    });

    if (reviewError) {
      await logSecurityEvent('kyc_admin_review_processing_error', 'high', request, {
        
        userId: user.id,
        verificationId: body.verificationId,
        error: reviewError.message
      });
      
      return NextResponse.json({
        success: false,
        error: 'Failed to process review decision',
        code: 'REVIEW_PROCESSING_ERROR'
      }, { status: 500 });
    }

    // Update review queue with notes and status
    const { error: queueUpdateError } = await supabase
      .from('kyc_review_queue')
      .update({
        status: body.decision === 'pending' ? 'in_review' : 'completed',
        reviewer_notes: body.reviewNotes,
        review_actions: [
          {
            action: 'admin_review',
            decision: body.decision,
            reason: body.decisionReason,
            reviewer_id: user.id,
            timestamp: new Date().toISOString(),
            requires_additional_docs: body.requiresAdditionalDocuments,
            additional_docs_required: body.additionalDocumentsRequired || [],
            escalated: body.escalateToSeniorReviewer,
            compliance_flagged: body.flagForCompliance
          }
        ],
        completed_at: body.decision !== 'pending' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('verification_id', body.verificationId);

    // Handle escalation if requested
    if (body.escalateToSeniorReviewer && body.decision === 'pending') {
      const { error: escalationError } = await supabase
        .from('kyc_review_queue')
        .update({
          queue_type: 'escalated',
          priority_score: 95,
          assigned_to: null, // Will be reassigned to senior reviewer
          assignment_method: 'escalated'
        })
        .eq('verification_id', body.verificationId);

      if (!escalationError) {
        // Log escalation
        await logSecurityEvent('kyc_verification_escalated', 'medium', request, {
          
          userId: user.id,
          verificationId: body.verificationId,
          reason: body.decisionReason
        });
      }
    }

    // Handle compliance flagging
    if (body.flagForCompliance) {
      const { error: complianceError } = await supabase
        .from('auth_audit_logs')
        .insert([{
          event_type: 'compliance_flag',
          event_category: 'kyc_review',
          user_id: user.id,
          target_user_id: verification.user_id,
          event_data: {
            verification_id: body.verificationId,
            flag_reason: body.complianceNotes || body.decisionReason,
            risk_level: verification.risk_level,
            timestamp: new Date().toISOString()
          },
          success: true
        }]);

      if (!complianceError) {
        await logSecurityEvent('kyc_compliance_flagged', 'high', request, {
          
          userId: user.id,
          verificationId: body.verificationId,
          reason: body.complianceNotes || body.decisionReason
        });
      }
    }

    // If additional documents required, update verification status
    if (body.requiresAdditionalDocuments && body.decision === 'pending') {
      const { error: statusUpdateError } = await supabase
        .from('kyc_verifications')
        .update({
          status: 'additional_info_required',
          decision_reason: body.decisionReason,
          updated_at: new Date().toISOString()
        })
        .eq('id', body.verificationId);
    }

    // Determine next actions based on decision
    const nextActions: string[] = [];
    
    if (body.decision === 'approved') {
      nextActions.push('Business owner role will be automatically assigned');
      nextActions.push('Business verification status will be updated to verified');
      if (verification.business_id) {
        nextActions.push('Business listing will be marked as verified');
      }
    } else if (body.decision === 'rejected') {
      nextActions.push('User will be notified of rejection with reason');
      nextActions.push('Appeal process information will be provided');
    } else if (body.requiresAdditionalDocuments) {
      nextActions.push('User will be notified of additional document requirements');
      nextActions.push('Document upload interface will be re-enabled');
    }
    
    if (body.escalateToSeniorReviewer) {
      nextActions.push('Case escalated to senior reviewer queue');
    }

    // Log successful review completion
    await logSecurityEvent('kyc_admin_review_completed', 'low', request, {
      
      userId: user.id,
      verificationId: body.verificationId,
      decision: body.decision,
      escalated: body.escalateToSeniorReviewer,
      complianceFlagged: body.flagForCompliance,
      processingTime: Date.now() - startTime
    });

    return NextResponse.json({
      success: true,
      verificationId: body.verificationId,
      decision: body.decision,
      status: body.decision === 'pending' ? 
        (body.requiresAdditionalDocuments ? 'additional_info_required' : 'under_review') :
        body.decision,
      message: `Review completed successfully. Decision: ${body.decision}`,
      nextActions
    }, { status: 200 });

  } catch (error) {
    await logSecurityEvent('kyc_admin_review_unexpected_error', 'critical', request, {
      
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    });

    return NextResponse.json({
      success: false,
      error: 'Internal server error during review processing',
      code: 'INTERNAL_SERVER_ERROR'
    }, { status: 500 });
  }
}

// GET endpoint to fetch review queue
export async function GET(request: NextRequest): Promise<NextResponse> {
  const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  
  try {
    // Rate limiting for review queue access
    const rateLimitResult = await rateLimit('kyc-review-queue', clientIP, 30, 3600);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        success: false,
        error: 'Too many queue access requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      }, { status: 429 });
    }

    const supabase = createRouteHandlerClient({ cookies });
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      }, { status: 401 });
    }

    // Check permissions
    const { data: hasPermission } = await supabase.rpc('user_has_enhanced_permission', {
      p_user_id: user.id,
      p_resource: 'businesses',
      p_action: 'verify'
    });

    if (!hasPermission) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions to access review queue',
        code: 'INSUFFICIENT_PERMISSIONS'
      }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queueType = searchParams.get('queueType') || 'all';
    const assignedToMe = searchParams.get('assignedToMe') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);

    // Build query
    let query = supabase
      .from('kyc_review_queue')
      .select(`
        id, verification_id, queue_type, priority_score, status,
        assigned_to, assigned_at, deadline, is_overdue, created_at,
        kyc_verifications (
          id, user_id, business_id, verification_type, verification_level,
          status, risk_level, risk_score, initiated_at,
          auth_users:user_id(email),
          businesses(name)
        )
      `)
      .in('status', ['queued', 'assigned', 'in_review'])
      .order('priority_score', { ascending: false })
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (queueType !== 'all') {
      query = query.eq('queue_type', queueType);
    }

    if (assignedToMe) {
      query = query.eq('assigned_to', user.id);
    }

    const { data: reviewQueue, error: queueError } = await query;

    if (queueError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch review queue',
        code: 'QUEUE_FETCH_ERROR'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      queue: reviewQueue || [],
      pagination: {
        offset,
        limit,
        total: reviewQueue?.length || 0
      }
    }, { status: 200 });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Internal server error accessing review queue',
      code: 'INTERNAL_SERVER_ERROR'
    }, { status: 500 });
  }
}

// Handle other HTTP methods
export async function PUT(): Promise<NextResponse> {
  return NextResponse.json({
    success: false,
    error: 'Method not allowed',
    code: 'METHOD_NOT_ALLOWED'
  }, { status: 405 });
}

export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json({
    success: false,
    error: 'Method not allowed',
    code: 'METHOD_NOT_ALLOWED'
  }, { status: 405 });
}