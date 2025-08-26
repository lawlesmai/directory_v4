/**
 * Profile File Management API
 * Epic 2 Story 2.7: User Profile Management & Preferences Infrastructure
 * 
 * API endpoints for secure file upload, management, and processing
 * including avatar uploads and document management with GDPR compliance.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fileManager, uploadAvatar, uploadDocument } from '@/lib/profile/file-manager'

/**
 * GET /api/profile/files - Get user files
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Verify authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session?.user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category') || undefined
    const isPublic = searchParams.get('isPublic') ? searchParams.get('isPublic') === 'true' : undefined
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const includeDeleted = searchParams.get('includeDeleted') === 'true'

    // Get user files
    const result = await fileManager.getUserFiles(userId, {
      category,
      isPublic,
      limit,
      offset,
      includeDeleted
    })

    // Format response
    const files = result.files.map(file => ({
      id: file.id,
      fileName: file.original_name,
      fileType: file.file_type,
      mimeType: file.mime_type,
      category: file.file_category,
      fileSize: file.file_size,
      dimensions: file.dimensions,
      isPublic: file.is_public,
      publicUrl: file.public_url,
      thumbnailPath: file.thumbnail_path,
      validationStatus: file.validation_status,
      processingStatus: file.processing_status,
      downloadCount: file.download_count,
      lastAccessed: file.last_accessed,
      uploadedAt: file.uploaded_at,
      lastModified: file.last_modified,
      deletedAt: file.deleted_at,
      metadata: {
        isProcessed: file.is_processed,
        variants: file.variants,
        virusScanResult: file.virus_scan_result,
        isSensitive: file.is_sensitive
      }
    }))

    return NextResponse.json({
      files,
      pagination: {
        total: result.total,
        limit,
        offset,
        hasMore: result.total > offset + limit
      }
    })

  } catch (error) {
    console.error('Files API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/profile/files - Upload file
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Verify authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session?.user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const category = (formData.get('category') as string) || 'other'
    const makePublic = formData.get('makePublic') === 'true'
    const isVerification = formData.get('isVerification') === 'true'
    const metadata = formData.get('metadata') ? JSON.parse(formData.get('metadata') as string) : {}

    if (!file) {
      return NextResponse.json(
        { error: 'File is required', code: 'FILE_REQUIRED' },
        { status: 400 }
      )
    }

    // Validate file category
    const validCategories = ['avatar', 'document', 'verification', 'business', 'other']
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: 'Invalid file category', code: 'INVALID_CATEGORY' },
        { status: 400 }
      )
    }

    // Upload file based on category
    let uploadResult

    if (category === 'avatar') {
      uploadResult = await uploadAvatar(userId, file)
    } else if (category === 'document' || isVerification) {
      uploadResult = await uploadDocument(userId, file, isVerification)
    } else {
      // Generic file upload
      uploadResult = await fileManager.uploadFile(
        userId,
        file,
        file.name,
        category as any,
        {
          makePublic,
          metadata: {
            ...metadata,
            uploaded_via: 'api',
            original_category: category
          }
        }
      )
    }

    if (!uploadResult.success) {
      return NextResponse.json(
        {
          error: uploadResult.error,
          code: 'UPLOAD_FAILED',
          validationResult: uploadResult.validationResult
        },
        { status: 400 }
      )
    }

    // If avatar upload, update profile
    if (category === 'avatar' && uploadResult.file?.public_url) {
      await supabase
        .from('profiles')
        .update({
          avatar_url: uploadResult.file.public_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
    }

    // Log file upload
    await supabase.from('auth_audit_logs').insert({
      event_type: 'file_upload',
      event_category: 'files',
      user_id: userId,
      success: true,
      event_data: {
        file_id: uploadResult.file?.id,
        file_category: category,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        is_public: makePublic,
        processing_results: uploadResult.processingResults?.length || 0
      }
    })

    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        id: uploadResult.file?.id,
        fileName: uploadResult.file?.original_name,
        fileType: uploadResult.file?.file_type,
        mimeType: uploadResult.file?.mime_type,
        category: uploadResult.file?.file_category,
        fileSize: uploadResult.file?.file_size,
        dimensions: uploadResult.file?.dimensions,
        isPublic: uploadResult.file?.is_public,
        publicUrl: uploadResult.file?.public_url,
        thumbnailPath: uploadResult.file?.thumbnail_path,
        validationStatus: uploadResult.file?.validation_status,
        processingStatus: uploadResult.file?.processing_status,
        uploadedAt: uploadResult.file?.uploaded_at
      },
      processing: {
        results: uploadResult.processingResults,
        totalOperations: uploadResult.processingResults?.length || 0,
        successful: uploadResult.processingResults?.filter(r => r.success).length || 0
      }
    })

  } catch (error) {
    console.error('File upload API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/profile/files - Delete file
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Verify authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session?.user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Get file ID from query parameters or request body
    const searchParams = request.nextUrl.searchParams
    const fileId = searchParams.get('fileId') || (await request.json().catch(() => ({})))?.fileId

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required', code: 'FILE_ID_REQUIRED' },
        { status: 400 }
      )
    }

    // Parse additional parameters
    const permanent = searchParams.get('permanent') === 'true'
    const deleteReason = searchParams.get('reason') || 'User request'

    // Delete file
    const result = await fileManager.deleteFile(fileId, userId, {
      permanent,
      deleteReason
    })

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          code: 'DELETE_FAILED'
        },
        { status: 400 }
      )
    }

    // If deleted file was avatar, clear from profile
    const file = await fileManager.getFile(fileId, userId)
    if (file?.file_category === 'avatar') {
      await supabase
        .from('profiles')
        .update({
          avatar_url: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
    }

    // Log file deletion
    await supabase.from('auth_audit_logs').insert({
      event_type: 'file_deletion',
      event_category: 'files',
      user_id: userId,
      success: true,
      event_data: {
        file_id: fileId,
        deletion_type: permanent ? 'permanent' : 'soft',
        deletion_reason: deleteReason
      }
    })

    return NextResponse.json({
      success: true,
      message: permanent ? 'File permanently deleted' : 'File deleted',
      fileId,
      deletionType: permanent ? 'permanent' : 'soft'
    })

  } catch (error) {
    console.error('File deletion API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}