/**
 * KYC Appeals Management API
 * Epic 2 Story 2.9: Business Owner Verification & KYC
 * Endpoint: POST /api/kyc/appeals (Create appeal)
 * Endpoint: GET /api/kyc/appeals (Get appeals)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { rateLimit } from '@/lib/api/rate-limit';
import { validateCSRF } from '@/lib/api/csrf';
import { logSecurityEvent } from '@/lib/api/security-monitoring';

// Validation schema for creating appeals
const createAppealSchema = z.object({
  verificationId: z.string().uuid('Invalid verification ID format'),
  appealReason: z.enum([
    'document_quality', 'processing_error', 'incorrect_rejection',
    'technical_issue', 'discrimination_claim', 'data_accuracy', 'other'
  ]),
  appealDescription: z.string().min(20, 'Appeal description must be at least 20 characters').max(2000, 'Appeal description too long'),
  supportingEvidence: z.array(z.object({
    type: z.string(),
    description: z.string(),
    fileUrl: z.string().url().optional()
  })).optional(),
  contactPreference: z.enum(['email', 'phone', 'portal']).default('email'),
  csrfToken: z.string().min(1, 'CSRF token is required')
});

interface AppealResponse {
  success: boolean;
  appeal?: {
    id: string;
    verificationId: string;
    status: string;
    submittedAt: string;
    estimatedResolution: string;
  };
  appeals?: Array<{
    id: string;
    verificationId: string;
    appealReason: string;
    status: string;
    submittedAt: string;
    reviewedAt?: string;
    decision?: string;
    resolutionDeadline: string;
  }>;
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
  error?: string;
  code?: string;
}

// POST - Create new appeal
export async function POST(request: NextRequest): Promise<NextResponse<AppealResponse>> {
  const startTime = Date.now();
  const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  
  try {
    // Rate limiting - 2 appeals per day per IP
    const rateLimitResult = await rateLimit('kyc-appeal-create', clientIP, 2, 24 * 3600);
    if (!rateLimitResult.success) {
      await logSecurityEvent('kyc_appeal_rate_limited', {
        clientIP,
        remainingAttempts: rateLimitResult.remaining
      });
      
      return NextResponse.json({
        success: false,
        error: 'Too many appeal submissions. Please try again tomorrow.',
        code: 'RATE_LIMIT_EXCEEDED'
      }, { status: 429 });
    }

    // Parse and validate request body
    let body: z.infer<typeof createAppealSchema>;
    try {
      const rawBody = await request.json();
      body = createAppealSchema.parse(rawBody);
    } catch (error) {
      await logSecurityEvent('kyc_appeal_invalid_request', {
        clientIP,
        error: error instanceof Error ? error.message : 'Unknown validation error'
      });
      
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        code: 'INVALID_REQUEST'
      }, { status: 400 });
    }

    // CSRF validation
    if (!await validateCSRF(body.csrfToken, request)) {
      await logSecurityEvent('kyc_appeal_csrf_validation_failed', {
        clientIP,
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
      await logSecurityEvent('kyc_appeal_unauthenticated', {
        clientIP,
        verificationId: body.verificationId
      });
      
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      }, { status: 401 });
    }

    // Verify verification exists and user has access
    const { data: verification, error: verificationError } = await supabase
      .from('kyc_verifications')
      .select('id, user_id, status, decision, decided_at')
      .eq('id', body.verificationId)
      .single();

    if (verificationError || !verification) {
      await logSecurityEvent('kyc_appeal_verification_not_found', {
        clientIP,
        userId: user.id,
        verificationId: body.verificationId
      });
      
      return NextResponse.json({
        success: false,
        error: 'KYC verification not found',
        code: 'VERIFICATION_NOT_FOUND'
      }, { status: 404 });
    }

    // Check user authorization
    if (verification.user_id !== user.id) {
      const { data: hasPermission } = await supabase.rpc('user_has_enhanced_permission', {
        p_user_id: user.id,
        p_resource: 'users',
        p_action: 'manage'
      });

      if (!hasPermission) {
        await logSecurityEvent('kyc_appeal_unauthorized', {
          clientIP,
          userId: user.id,
          verificationId: body.verificationId,
          verificationUserId: verification.user_id
        });
        
        return NextResponse.json({
          success: false,
          error: 'Insufficient permissions to appeal this verification',
          code: 'INSUFFICIENT_PERMISSIONS'
        }, { status: 403 });
      }
    }

    // Check if verification can be appealed
    if (!verification.decided_at || verification.decision !== 'rejected') {
      return NextResponse.json({
        success: false,
        error: 'Only rejected verifications can be appealed',
        code: 'APPEAL_NOT_ALLOWED'
      }, { status: 400 });
    }

    // Check if appeal window is still open (typically 30 days)
    const decisionDate = new Date(verification.decided_at);
    const appealDeadline = new Date(decisionDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    if (new Date() > appealDeadline) {
      return NextResponse.json({
        success: false,
        error: 'Appeal deadline has passed. Appeals must be submitted within 30 days of decision.',
        code: 'APPEAL_DEADLINE_PASSED'
      }, { status: 400 });
    }

    // Check for existing active appeals
    const { data: existingAppeal } = await supabase
      .from('kyc_appeals')
      .select('id, status')
      .eq('verification_id', body.verificationId)
      .in('status', ['submitted', 'under_review', 'additional_info_requested'])
      .limit(1)
      .single();

    if (existingAppeal) {
      return NextResponse.json({
        success: false,
        error: 'An active appeal already exists for this verification',
        code: 'APPEAL_ALREADY_EXISTS'
      }, { status: 409 });
    }

    // Create the appeal
    const { data: appeal, error: appealError } = await supabase
      .from('kyc_appeals')
      .insert({
        verification_id: body.verificationId,
        appellant_id: user.id,
        appeal_reason: body.appealReason,
        appeal_description: body.appealDescription,
        supporting_evidence: body.supportingEvidence || [],
        status: 'submitted',
        resolution_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      })
      .select('id, status, submitted_at, resolution_deadline')
      .single();

    if (appealError || !appeal) {
      await logSecurityEvent('kyc_appeal_creation_error', {
        clientIP,
        userId: user.id,
        verificationId: body.verificationId,
        error: appealError?.message
      });
      
      return NextResponse.json({
        success: false,
        error: 'Failed to create appeal',
        code: 'APPEAL_CREATION_FAILED'
      }, { status: 500 });
    }

    // Add to high priority review queue
    await supabase
      .from('kyc_review_queue')
      .insert({
        verification_id: body.verificationId,
        queue_type: 'appeal',
        priority_score: 85,
        sla_target_hours: 48,
        deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      });

    // Log successful appeal creation
    await logSecurityEvent('kyc_appeal_created_success', {
      clientIP,
      userId: user.id,
      appealId: appeal.id,
      verificationId: body.verificationId,
      appealReason: body.appealReason,
      processingTime: Date.now() - startTime
    });

    return NextResponse.json({
      success: true,
      appeal: {
        id: appeal.id,
        verificationId: body.verificationId,
        status: appeal.status,
        submittedAt: appeal.submitted_at,
        estimatedResolution: appeal.resolution_deadline
      }
    }, { status: 201 });

  } catch (error) {
    await logSecurityEvent('kyc_appeal_unexpected_error', {
      clientIP,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    });

    return NextResponse.json({
      success: false,
      error: 'Internal server error during appeal creation',
      code: 'INTERNAL_SERVER_ERROR'
    }, { status: 500 });
  }
}

// GET - Get user appeals
export async function GET(request: NextRequest): Promise<NextResponse<AppealResponse>> {
  const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  
  try {
    // Rate limiting - 20 requests per hour
    const rateLimitResult = await rateLimit('kyc-appeal-get', clientIP, 20, 3600);
    if (!rateLimitResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Too many requests. Please try again later.',
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const status = searchParams.get('status');
    const verificationId = searchParams.get('verificationId');

    // Build query
    let query = supabase
      .from('kyc_appeals')
      .select(`
        id, verification_id, appeal_reason, status, submitted_at,
        review_started_at, decision_at, decision, resolution_deadline,
        kyc_verifications (
          id, verification_type, business_id
        )
      `, { count: 'exact' })
      .eq('appellant_id', user.id)
      .order('submitted_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (verificationId) {
      query = query.eq('verification_id', verificationId);
    }

    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: appeals, error: appealsError, count } = await query;

    if (appealsError) {
      await logSecurityEvent('kyc_appeals_fetch_error', {
        clientIP,
        userId: user.id,
        error: appealsError.message
      });
      
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch appeals',
        code: 'APPEALS_FETCH_ERROR'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      appeals: (appeals || []).map(appeal => ({
        id: appeal.id,
        verificationId: appeal.verification_id,
        appealReason: appeal.appeal_reason,
        status: appeal.status,
        submittedAt: appeal.submitted_at,
        reviewedAt: appeal.review_started_at,
        decision: appeal.decision,
        resolutionDeadline: appeal.resolution_deadline
      })),
      pagination: {
        page,
        limit,
        total: count || 0
      }
    }, { status: 200 });

  } catch (error) {
    await logSecurityEvent('kyc_appeals_unexpected_error', {
      clientIP,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json({
      success: false,
      error: 'Internal server error fetching appeals',
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