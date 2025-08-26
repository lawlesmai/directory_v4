/**
 * KYC Document Upload API
 * Epic 2 Story 2.9: Business Owner Verification & KYC
 * Endpoint: POST /api/kyc/documents/upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { rateLimit } from '@/lib/api/rate-limit';
import { validateCSRF } from '@/lib/api/csrf';
import { logSecurityEvent } from '@/lib/api/security-monitoring';
import { uploadFile, deleteFile, generateFileHash } from '@/lib/api/file-storage';
import crypto from 'crypto';

// Validation schema
const uploadDocumentSchema = z.object({
  verificationId: z.string().uuid('Invalid verification ID format'),
  documentType: z.string().min(1, 'Document type is required'),
  documentSide: z.enum(['front', 'back', 'both', 'single']).default('single'),
  csrfToken: z.string().min(1, 'CSRF token is required')
});

// File validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/tiff',
  'image/tif',
  'application/pdf'
];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'pdf'];

interface DocumentUploadResponse {
  success: boolean;
  documentId?: string;
  status?: string;
  processingStatus?: string;
  message?: string;
  error?: string;
  code?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<DocumentUploadResponse>> {
  const startTime = Date.now();
  const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  
  try {
    // Rate limiting - 10 uploads per hour per IP
    const rateLimitResult = await rateLimit('kyc-upload', clientIP, 10, 3600);
    if (!rateLimitResult.allowed) {
      await logSecurityEvent('kyc_upload_rate_limited', 'medium', request, {
        retryAfter: rateLimitResult.retryAfter
      });
      
      return NextResponse.json({
        success: false,
        error: 'Too many upload attempts. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      }, { status: 429 });
    }

    // Initialize Supabase client
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      await logSecurityEvent('kyc_upload_unauthenticated', 'medium', request, { clientIP });
      
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      }, { status: 401 });
    }

    // Parse multipart form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Invalid multipart form data',
        code: 'INVALID_FORM_DATA'
      }, { status: 400 });
    }

    // Extract and validate form fields
    const verificationId = formData.get('verificationId') as string;
    const documentType = formData.get('documentType') as string;
    const documentSide = formData.get('documentSide') as string || 'single';
    const csrfToken = formData.get('csrfToken') as string;
    const file = formData.get('file') as File;

    // Validate form data
    try {
      uploadDocumentSchema.parse({
        verificationId,
        documentType,
        documentSide,
        csrfToken
      });
    } catch (error) {
      await logSecurityEvent('kyc_upload_invalid_request', 'medium', request, {
        
        userId: user.id,
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
      await logSecurityEvent('kyc_upload_csrf_validation_failed', 'medium', request, {
        
        userId: user.id,
        verificationId
      });
      
      return NextResponse.json({
        success: false,
        error: 'Invalid CSRF token',
        code: 'CSRF_VALIDATION_FAILED'
      }, { status: 403 });
    }

    // Validate file presence
    if (!file || !(file instanceof File)) {
      return NextResponse.json({
        success: false,
        error: 'No file provided or invalid file format',
        code: 'MISSING_FILE'
      }, { status: 400 });
    }

    // File size validation
    if (file.size > MAX_FILE_SIZE) {
      await logSecurityEvent('kyc_upload_file_too_large', 'medium', request, {
        
        userId: user.id,
        fileSize: file.size,
        fileName: file.name
      });
      
      return NextResponse.json({
        success: false,
        error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        code: 'FILE_TOO_LARGE'
      }, { status: 413 });
    }

    // MIME type validation
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      await logSecurityEvent('kyc_upload_invalid_mime_type', 'medium', request, {
        
        userId: user.id,
        mimeType: file.type,
        fileName: file.name
      });
      
      return NextResponse.json({
        success: false,
        error: `File type '${file.type}' not allowed. Accepted types: ${ALLOWED_MIME_TYPES.join(', ')}`,
        code: 'INVALID_FILE_TYPE'
      }, { status: 400 });
    }

    // File extension validation
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return NextResponse.json({
        success: false,
        error: `File extension not allowed. Accepted extensions: ${ALLOWED_EXTENSIONS.join(', ')}`,
        code: 'INVALID_FILE_EXTENSION'
      }, { status: 400 });
    }

    // Verify KYC verification exists and user has access
    const { data: verification, error: verificationError } = await supabase
      .from('kyc_verifications')
      .select('id, user_id, status, business_id')
      .eq('id', verificationId)
      .single();

    if (verificationError || !verification) {
      await logSecurityEvent('kyc_upload_verification_not_found', 'medium', request, {
        
        userId: user.id,
        verificationId
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
        await logSecurityEvent('kyc_upload_unauthorized', 'medium', request, {
          
          userId: user.id,
          verificationId,
          verificationUserId: verification.user_id
        });
        
        return NextResponse.json({
          success: false,
          error: 'Insufficient permissions to upload documents for this verification',
          code: 'INSUFFICIENT_PERMISSIONS'
        }, { status: 403 });
      }
    }

    // Check verification status allows uploads
    if (!['initiated', 'documents_required', 'documents_uploaded', 'under_review'].includes(verification.status)) {
      return NextResponse.json({
        success: false,
        error: 'Document uploads not allowed for current verification status',
        code: 'UPLOAD_NOT_ALLOWED'
      }, { status: 400 });
    }

    // Validate document type exists and is active
    const { data: documentTypeConfig, error: docTypeError } = await supabase
      .from('kyc_document_types')
      .select('*')
      .eq('type_code', documentType)
      .eq('is_active', true)
      .single();

    if (docTypeError || !documentTypeConfig) {
      return NextResponse.json({
        success: false,
        error: 'Invalid or inactive document type',
        code: 'INVALID_DOCUMENT_TYPE'
      }, { status: 400 });
    }

    // Additional file size validation based on document type config
    const maxSizeForType = documentTypeConfig.max_file_size_mb * 1024 * 1024;
    if (file.size > maxSizeForType) {
      return NextResponse.json({
        success: false,
        error: `File size exceeds maximum allowed for document type: ${documentTypeConfig.max_file_size_mb}MB`,
        code: 'FILE_TOO_LARGE_FOR_TYPE'
      }, { status: 413 });
    }

    // Generate file hash for duplicate detection and integrity
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Check for duplicate files by hash
    const { data: duplicateCheck, error: dupError } = await supabase
      .from('kyc_documents')
      .select('id, verification_id')
      .eq('file_hash', fileHash)
      .neq('verification_id', verificationId)
      .is('deleted_at', null)
      .limit(1);

    if (dupError) {
      await logSecurityEvent('kyc_upload_duplicate_check_error', 'medium', request, {
        
        userId: user.id,
        error: dupError.message
      });
    }

    if (duplicateCheck && duplicateCheck.length > 0) {
      await logSecurityEvent('kyc_upload_duplicate_detected', 'medium', request, {
        
        userId: user.id,
        fileHash,
        originalVerificationId: duplicateCheck[0].verification_id
      });
      
      return NextResponse.json({
        success: false,
        error: 'Document with identical content already exists in the system',
        code: 'DUPLICATE_DOCUMENT'
      }, { status: 409 });
    }

    // Generate secure file name and path
    const timestamp = Date.now();
    const randomSuffix = crypto.randomBytes(8).toString('hex');
    const secureFileName = `kyc_${verificationId}_${documentType}_${timestamp}_${randomSuffix}.${fileExtension}`;
    const filePath = `kyc-documents/${verification.user_id}/${verificationId}/${secureFileName}`;

    // Upload file to secure storage
    const uploadResult = await uploadFile(file, filePath);

    if (!uploadResult.success) {
      await logSecurityEvent('kyc_upload_storage_error', 'medium', request, {
        userId: user.id,
        message: uploadResult.message,
        fileName: file.name
      });
      
      return NextResponse.json({
        success: false,
        error: 'Failed to upload file to secure storage',
        code: 'STORAGE_ERROR'
      }, { status: 500 });
    }

    // Save document record to database
    const { data: documentId, error: dbError } = await supabase.rpc('upload_kyc_document', {
      p_verification_id: verificationId,
      p_document_type_code: documentType,
      p_file_name: secureFileName,
      p_file_path: filePath,
      p_file_size_bytes: file.size,
      p_file_type: fileExtension,
      p_file_hash: fileHash,
      p_document_side: documentSide
    });

    if (dbError) {
      await logSecurityEvent('kyc_upload_database_error', 'medium', request, {
        
        userId: user.id,
        error: dbError.message,
        fileName: file.name
      });

      // Clean up uploaded file on database error
      try {
        await deleteFile(filePath);
      } catch (cleanupError) {
        // Log but don't fail the response
        await logSecurityEvent('kyc_upload_cleanup_error', 'medium', request, {
          
          userId: user.id,
          filePath,
          error: cleanupError instanceof Error ? cleanupError.message : 'Unknown cleanup error'
        });
      }
      
      return NextResponse.json({
        success: false,
        error: 'Failed to save document record',
        code: 'DATABASE_ERROR'
      }, { status: 500 });
    }

    // Get the created document details
    const { data: documentDetails, error: detailsError } = await supabase
      .from('kyc_documents')
      .select(`
        id, file_name, file_size_bytes, upload_method,
        ocr_status, validation_status, review_status,
        created_at
      `)
      .eq('id', documentId)
      .single();

    // Log successful upload
    await logSecurityEvent('kyc_document_uploaded_success', 'medium', request, {
      
      userId: user.id,
      documentId,
      verificationId,
      documentType,
      fileSize: file.size,
      fileName: file.name,
      processingTime: Date.now() - startTime
    });

    return NextResponse.json({
      success: true,
      documentId,
      status: 'uploaded',
      processingStatus: documentDetails?.ocr_status || 'pending',
      message: 'Document uploaded successfully. Processing will begin shortly.'
    }, { status: 201 });

  } catch (error) {
    await logSecurityEvent('kyc_upload_unexpected_error', 'medium', request, {
      
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    });

    return NextResponse.json({
      success: false,
      error: 'Internal server error during document upload',
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