/**
 * KYC Verification Initiation API
 * Epic 2 Story 2.9: Business Owner Verification & KYC
 * Endpoint: POST /api/kyc/verification/initiate
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { rateLimit } from '@/lib/api/rate-limit';
import { validateCSRF } from '@/lib/api/csrf';
import { logSecurityEvent } from '@/lib/api/security-monitoring';

// Validation schema
const initiateKYCSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  businessId: z.string().uuid('Invalid business ID format').optional(),
  verificationType: z.enum(['personal_identity', 'business_owner', 'business_entity', 'enhanced_due_diligence']).default('business_owner'),
  verificationLevel: z.enum(['basic', 'enhanced', 'premium', 'institutional']).default('basic'),
  csrfToken: z.string().min(1, 'CSRF token is required')
});

type InitiateKYCRequest = z.infer<typeof initiateKYCSchema>;

interface KYCVerificationResponse {
  success: boolean;
  verificationId?: string;
  status?: string;
  nextSteps?: string[];
  estimatedCompletion?: string;
  error?: string;
  code?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<KYCVerificationResponse>> {
  const startTime = Date.now();
  const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  
  try {
    // Rate limiting - 3 requests per hour per IP
    const rateLimitResult = await rateLimit('kyc-initiate', clientIP, 3, 3600);
    if (!rateLimitResult.allowed) {
      await logSecurityEvent('kyc_initiation_rate_limited', 'medium', request, {
        retryAfter: rateLimitResult.retryAfter
      });
      
      return NextResponse.json({
        success: false,
        error: 'Too many KYC initiation attempts. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      }, { status: 429 });
    }

    // Parse and validate request body
    let body: InitiateKYCRequest;
    try {
      const rawBody = await request.json();
      body = initiateKYCSchema.parse(rawBody);
    } catch (error) {
      await logSecurityEvent('kyc_initiation_invalid_request', 'medium', request, {
        
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
      await logSecurityEvent('kyc_initiation_csrf_validation_failed', 'medium', request, {
        
        userId: body.userId
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
      await logSecurityEvent('kyc_initiation_unauthenticated', 'medium', request, {
        
        requestedUserId: body.userId
      });
      
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      }, { status: 401 });
    }

    // Verify user authorization (self or admin)
    if (user.id !== body.userId) {
      const { data: hasPermission } = await supabase.rpc('user_has_enhanced_permission', {
        p_user_id: user.id,
        p_resource: 'users',
        p_action: 'manage'
      });

      if (!hasPermission) {
        await logSecurityEvent('kyc_initiation_unauthorized', 'medium', request, {
          
          userId: user.id,
          requestedUserId: body.userId
        });
        
        return NextResponse.json({
          success: false,
          error: 'Insufficient permissions to initiate KYC for other users',
          code: 'INSUFFICIENT_PERMISSIONS'
        }, { status: 403 });
      }
    }

    // Validate business ownership if business ID provided
    if (body.businessId) {
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('id, owner_id, name')
        .eq('id', body.businessId)
        .single();

      if (businessError || !business) {
        return NextResponse.json({
          success: false,
          error: 'Business not found',
          code: 'BUSINESS_NOT_FOUND'
        }, { status: 404 });
      }

      // Check if user owns the business or has management permissions
      if (business.owner_id !== body.userId) {
        const { data: hasBusinessPermission } = await supabase.rpc('user_has_enhanced_permission', {
          p_user_id: user.id,
          p_resource: 'businesses',
          p_action: 'manage',
          p_context: { business_id: body.businessId }
        });

        if (!hasBusinessPermission) {
          await logSecurityEvent('kyc_initiation_business_unauthorized', 'medium', request, {
            
            userId: user.id,
            businessId: body.businessId
          });
          
          return NextResponse.json({
            success: false,
            error: 'Insufficient permissions to initiate KYC for this business',
            code: 'BUSINESS_PERMISSION_DENIED'
          }, { status: 403 });
        }
      }
    }

    // Call the KYC initiation function
    const { data: verificationId, error: kycError } = await supabase.rpc('initiate_kyc_verification', {
      p_user_id: body.userId,
      p_business_id: body.businessId || null,
      p_verification_type: body.verificationType,
      p_verification_level: body.verificationLevel
    });

    if (kycError) {
      await logSecurityEvent('kyc_initiation_database_error', 'medium', request, {
        
        userId: body.userId,
        error: kycError.message
      });

      // Handle specific known errors
      if (kycError.message.includes('Active KYC verification already exists')) {
        return NextResponse.json({
          success: false,
          error: 'An active KYC verification process is already in progress',
          code: 'VERIFICATION_IN_PROGRESS'
        }, { status: 409 });
      }
      
      return NextResponse.json({
        success: false,
        error: 'Failed to initiate KYC verification process',
        code: 'KYC_INITIATION_FAILED'
      }, { status: 500 });
    }

    // Get the created verification details
    const { data: verificationDetails, error: detailsError } = await supabase
      .from('kyc_verifications')
      .select(`
        id, status, verification_type, verification_level,
        expires_at, created_at,
        business_verification_workflows (
          id, current_step, progress_percentage,
          identity_verification_required,
          business_license_required,
          tax_verification_required,
          address_verification_required
        )
      `)
      .eq('id', verificationId)
      .single();

    if (detailsError || !verificationDetails) {
      await logSecurityEvent('kyc_verification_details_error', 'medium', request, {
        
        userId: body.userId,
        verificationId
      });
      
      return NextResponse.json({
        success: false,
        error: 'KYC verification initiated but details unavailable',
        code: 'VERIFICATION_DETAILS_ERROR'
      }, { status: 500 });
    }

    // Determine next steps based on verification type and requirements
    const nextSteps: string[] = [];
    const workflow = verificationDetails.business_verification_workflows?.[0];
    
    if (workflow) {
      if (workflow.identity_verification_required) {
        nextSteps.push('Upload government-issued ID (driver\'s license, passport, or state ID)');
      }
      if (workflow.business_license_required) {
        nextSteps.push('Upload business license or registration documents');
      }
      if (workflow.tax_verification_required) {
        nextSteps.push('Upload tax documents (EIN letter or business tax returns)');
      }
      if (workflow.address_verification_required) {
        nextSteps.push('Upload address verification (utility bill or bank statement)');
      }
    } else {
      nextSteps.push('Upload required identity verification documents');
    }

    // Log successful initiation
    await logSecurityEvent('kyc_verification_initiated_success', 'medium', request, {
      
      userId: body.userId,
      verificationId,
      verificationType: body.verificationType,
      businessId: body.businessId,
      processingTime: Date.now() - startTime
    });

    return NextResponse.json({
      success: true,
      verificationId,
      status: verificationDetails.status,
      nextSteps,
      estimatedCompletion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    }, { status: 201 });

  } catch (error) {
    await logSecurityEvent('kyc_initiation_unexpected_error', 'medium', request, {
      
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    });

    return NextResponse.json({
      success: false,
      error: 'Internal server error during KYC initiation',
      code: 'INTERNAL_SERVER_ERROR'
    }, { status: 500 });
  }
}

// Handle other HTTP methods
export async function GET(): Promise<NextResponse> {
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