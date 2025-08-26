/**
 * KYC Verification Status API
 * Epic 2 Story 2.9: Business Owner Verification & KYC
 * Endpoint: GET /api/kyc/verification/status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { rateLimit } from '@/lib/api/rate-limit';
import { logSecurityEvent } from '@/lib/api/security-monitoring';

// Query parameter validation schema
const statusQuerySchema = z.object({
  verificationId: z.string().uuid('Invalid verification ID format'),
  includeDocuments: z.enum(['true', 'false']).transform(val => val === 'true').optional().default(false),
  includeRiskAssessment: z.enum(['true', 'false']).transform(val => val === 'true').optional().default(false),
  includeWorkflow: z.enum(['true', 'false']).transform(val => val === 'true').optional().default(true)
});

interface DocumentInfo {
  id: string;
  documentType: string;
  fileName: string;
  uploadedAt: string;
  ocrStatus: string;
  validationStatus: string;
  reviewStatus: string;
  qualityScore?: number;
}

interface WorkflowInfo {
  id: string;
  workflowType: string;
  currentStep: string;
  progressPercentage: number;
  completedSteps: number;
  totalSteps: number;
  nextActionRequired?: string;
  estimatedCompletion?: string;
  requirements: {
    identityVerification: { required: boolean; completed: boolean };
    businessLicense: { required: boolean; completed: boolean };
    taxVerification: { required: boolean; completed: boolean };
    addressVerification: { required: boolean; completed: boolean };
    financialVerification: { required: boolean; completed: boolean };
    biometricVerification: { required: boolean; completed: boolean };
    enhancedDueDiligence: { required: boolean; completed: boolean };
  };
}

interface RiskAssessmentInfo {
  id: string;
  overallScore: number;
  riskCategory: string;
  identityScore?: number;
  documentScore?: number;
  businessScore?: number;
  riskIndicators: Array<{
    type: string;
    impact: number;
    description: string;
  }>;
  assessedAt: string;
}

interface VerificationStatusResponse {
  success: boolean;
  verification?: {
    id: string;
    userId: string;
    businessId?: string;
    verificationType: string;
    verificationLevel: string;
    status: string;
    decision?: string;
    decisionConfidence?: number;
    riskLevel: string;
    riskScore?: number;
    initiatedAt: string;
    submittedAt?: string;
    reviewedAt?: string;
    decidedAt?: string;
    expiresAt?: string;
    assignedReviewer?: string;
    estimatedCompletion?: string;
    documents?: DocumentInfo[];
    workflow?: WorkflowInfo;
    riskAssessment?: RiskAssessmentInfo;
  };
  error?: string;
  code?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<VerificationStatusResponse>> {
  const startTime = Date.now();
  const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  
  try {
    // Rate limiting - 60 requests per hour per IP
    const rateLimitResult = await rateLimit('kyc-status', clientIP, 60, 3600);
    if (!rateLimitResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Too many status check requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      }, { status: 429 });
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      verificationId: searchParams.get('verificationId'),
      includeDocuments: searchParams.get('includeDocuments'),
      includeRiskAssessment: searchParams.get('includeRiskAssessment'),
      includeWorkflow: searchParams.get('includeWorkflow')
    };

    let validatedQuery;
    try {
      validatedQuery = statusQuerySchema.parse(queryParams);
    } catch (error) {
      await logSecurityEvent('kyc_status_invalid_request', {
        clientIP,
        error: error instanceof Error ? error.message : 'Unknown validation error'
      });
      
      return NextResponse.json({
        success: false,
        error: 'Invalid request parameters',
        code: 'INVALID_REQUEST'
      }, { status: 400 });
    }

    // Initialize Supabase client
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      await logSecurityEvent('kyc_status_unauthenticated', {
        clientIP,
        verificationId: validatedQuery.verificationId
      });
      
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      }, { status: 401 });
    }

    // Get verification with basic details
    const { data: verification, error: verificationError } = await supabase
      .from('kyc_verifications')
      .select(`
        id, user_id, business_id, verification_type, verification_level,
        status, decision, decision_confidence, decision_reason,
        risk_level, risk_score,
        initiated_at, submitted_at, reviewed_at, decided_at, expires_at,
        assigned_reviewer_id, estimated_completion,
        auth_users_assigned_reviewer:assigned_reviewer_id(email)
      `)
      .eq('id', validatedQuery.verificationId)
      .single();

    if (verificationError || !verification) {
      await logSecurityEvent('kyc_status_verification_not_found', {
        clientIP,
        userId: user.id,
        verificationId: validatedQuery.verificationId
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
        p_action: 'read'
      });

      if (!hasPermission) {
        await logSecurityEvent('kyc_status_unauthorized', {
          clientIP,
          userId: user.id,
          verificationId: validatedQuery.verificationId,
          verificationUserId: verification.user_id
        });
        
        return NextResponse.json({
          success: false,
          error: 'Insufficient permissions to view this verification status',
          code: 'INSUFFICIENT_PERMISSIONS'
        }, { status: 403 });
      }
    }

    // Build response object
    const response: VerificationStatusResponse = {
      success: true,
      verification: {
        id: verification.id,
        userId: verification.user_id,
        businessId: verification.business_id,
        verificationType: verification.verification_type,
        verificationLevel: verification.verification_level,
        status: verification.status,
        decision: verification.decision,
        decisionConfidence: verification.decision_confidence,
        riskLevel: verification.risk_level,
        riskScore: verification.risk_score,
        initiatedAt: verification.initiated_at,
        submittedAt: verification.submitted_at,
        reviewedAt: verification.reviewed_at,
        decidedAt: verification.decided_at,
        expiresAt: verification.expires_at,
        assignedReviewer: verification.auth_users_assigned_reviewer?.email,
        estimatedCompletion: verification.estimated_completion
      }
    };

    // Include documents if requested
    if (validatedQuery.includeDocuments) {
      const { data: documents, error: documentsError } = await supabase
        .from('kyc_documents')
        .select(`
          id, file_name, ocr_status, validation_status, review_status,
          document_quality_score, created_at,
          kyc_document_types(type_code, display_name)
        `)
        .eq('verification_id', validatedQuery.verificationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (!documentsError && documents) {
        response.verification!.documents = documents.map(doc => ({
          id: doc.id,
          documentType: doc.kyc_document_types?.display_name || doc.kyc_document_types?.type_code || 'Unknown',
          fileName: doc.file_name,
          uploadedAt: doc.created_at,
          ocrStatus: doc.ocr_status,
          validationStatus: doc.validation_status,
          reviewStatus: doc.review_status,
          qualityScore: doc.document_quality_score
        }));
      }
    }

    // Include workflow if requested
    if (validatedQuery.includeWorkflow) {
      const { data: workflow, error: workflowError } = await supabase
        .from('business_verification_workflows')
        .select('*')
        .eq('kyc_verification_id', validatedQuery.verificationId)
        .single();

      if (!workflowError && workflow) {
        response.verification!.workflow = {
          id: workflow.id,
          workflowType: workflow.workflow_type,
          currentStep: workflow.current_step,
          progressPercentage: workflow.progress_percentage,
          completedSteps: workflow.completed_steps,
          totalSteps: workflow.total_steps,
          nextActionRequired: workflow.next_action_required,
          estimatedCompletion: workflow.estimated_completion_time,
          requirements: {
            identityVerification: {
              required: workflow.identity_verification_required,
              completed: workflow.identity_verification_completed
            },
            businessLicense: {
              required: workflow.business_license_required,
              completed: workflow.business_license_completed
            },
            taxVerification: {
              required: workflow.tax_verification_required,
              completed: workflow.tax_verification_completed
            },
            addressVerification: {
              required: workflow.address_verification_required,
              completed: workflow.address_verification_completed
            },
            financialVerification: {
              required: workflow.financial_verification_required,
              completed: workflow.financial_verification_completed
            },
            biometricVerification: {
              required: workflow.biometric_verification_required,
              completed: workflow.biometric_verification_completed
            },
            enhancedDueDiligence: {
              required: workflow.enhanced_due_diligence_required,
              completed: workflow.enhanced_due_diligence_completed
            }
          }
        };
      }
    }

    // Include risk assessment if requested
    if (validatedQuery.includeRiskAssessment) {
      const { data: riskAssessment, error: riskError } = await supabase
        .from('kyc_risk_assessments')
        .select(`
          id, overall_risk_score, risk_category,
          identity_risk_score, document_risk_score, business_risk_score,
          risk_indicators, created_at
        `)
        .eq('verification_id', validatedQuery.verificationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!riskError && riskAssessment) {
        response.verification!.riskAssessment = {
          id: riskAssessment.id,
          overallScore: riskAssessment.overall_risk_score,
          riskCategory: riskAssessment.risk_category,
          identityScore: riskAssessment.identity_risk_score,
          documentScore: riskAssessment.document_risk_score,
          businessScore: riskAssessment.business_risk_score,
          riskIndicators: riskAssessment.risk_indicators || [],
          assessedAt: riskAssessment.created_at
        };
      }
    }

    // Log successful status check
    await logSecurityEvent('kyc_status_check_success', {
      clientIP,
      userId: user.id,
      verificationId: validatedQuery.verificationId,
      status: verification.status,
      includeDocuments: validatedQuery.includeDocuments,
      includeRiskAssessment: validatedQuery.includeRiskAssessment,
      includeWorkflow: validatedQuery.includeWorkflow,
      processingTime: Date.now() - startTime
    });

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    await logSecurityEvent('kyc_status_unexpected_error', {
      clientIP,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    });

    return NextResponse.json({
      success: false,
      error: 'Internal server error during status check',
      code: 'INTERNAL_SERVER_ERROR'
    }, { status: 500 });
  }
}

// Handle other HTTP methods
export async function POST(): Promise<NextResponse> {
  return NextResponse.json({
    success: false,
    error: 'Method not allowed',
    code: 'METHOD_NOT_ALLOWED'
  }, { status: 405 });
}

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