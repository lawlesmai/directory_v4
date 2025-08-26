/**
 * Business Verification API Routes
 * Epic 2 Story 2.5: User Onboarding and Email Verification Infrastructure
 * 
 * Handles business verification workflow, document uploads, and KYC processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { businessVerificationService } from '@/lib/auth/business-verification';
import { rateLimit } from '@/lib/auth/rate-limiting';

/**
 * GET /api/onboarding/business-verification
 * Get business verification workflow status
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
    const workflowId = searchParams.get('workflowId');

    if (!workflowId) {
      // Initialize workflow if none exists
      const initResult = await businessVerificationService.initializeVerificationWorkflow(user.id);
      
      if (!initResult.success) {
        return NextResponse.json(
          { error: initResult.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        workflowId: initResult.workflowId,
        status: initResult.status,
        initialized: true,
      });
    }

    // Get existing workflow status
    try {
      const status = await businessVerificationService.getVerificationStatus(workflowId);
      
      return NextResponse.json({
        success: true,
        status,
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'Workflow not found or access denied' },
        { status: 404 }
      );
    }

  } catch (error) {
    console.error('Error fetching business verification status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/onboarding/business-verification
 * Initialize business verification workflow or submit KYC data
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

    const contentType = request.headers.get('content-type') || '';

    // Handle KYC data submission
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { action, workflowId, kycData, businessId } = body;

      if (action === 'initialize') {
        // Rate limiting for workflow initialization
        const rateLimitResult = await rateLimit(
          `business_verification_init_${user.id}`, 
          'verification_request', 
          3, 
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

        // Initialize verification workflow
        const result = await businessVerificationService.initializeVerificationWorkflow(
          user.id,
          businessId
        );

        return NextResponse.json({
          success: result.success,
          workflowId: result.workflowId,
          status: result.status,
          error: result.error,
        });
      }

      if (action === 'submit_kyc' && workflowId && kycData) {
        // Rate limiting for KYC submission
        const rateLimitResult = await rateLimit(
          `kyc_submit_${user.id}`, 
          'verification_request', 
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

        // Submit KYC information
        const result = await businessVerificationService.submitKYCInformation(
          user.id,
          workflowId,
          kycData
        );

        return NextResponse.json({
          success: result.success,
          kycScore: result.kycScore,
          riskFlags: result.risk_flags,
          error: result.error,
        });
      }

      return NextResponse.json(
        { error: 'Invalid action or missing required parameters' },
        { status: 400 }
      );
    }

    // Handle file upload
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      
      const workflowId = formData.get('workflowId') as string;
      const documentType = formData.get('documentType') as string;
      const businessId = formData.get('businessId') as string;
      const file = formData.get('file') as File;

      if (!workflowId || !documentType || !file) {
        return NextResponse.json(
          { error: 'Missing required fields: workflowId, documentType, and file' },
          { status: 400 }
        );
      }

      // Rate limiting for document upload
      const rateLimitResult = await rateLimit(
        `document_upload_${user.id}`, 
        'business_document_upload', 
        10, 
        3600
      );

      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          { 
            error: 'Upload rate limit exceeded',
            retryAfter: rateLimitResult.retryAfter
          },
          { status: 429 }
        );
      }

      // Convert file to buffer
      const buffer = Buffer.from(await file.arrayBuffer());
      
      const fileData = {
        name: file.name,
        type: file.type,
        size: file.size,
        buffer,
      };

      // Upload document
      const result = await businessVerificationService.uploadVerificationDocument(
        user.id,
        workflowId,
        documentType as any,
        fileData,
        businessId
      );

      return NextResponse.json({
        success: result.success,
        documentId: result.documentId,
        requiresAdditional: result.requiresAdditional,
        error: result.error,
      });
    }

    return NextResponse.json(
      { error: 'Unsupported content type' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error in business verification endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}