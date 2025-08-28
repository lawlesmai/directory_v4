/**
 * GDPR Data Export API
 * Epic 2 Story 2.7: User Profile Management & Preferences Infrastructure
 * 
 * API endpoint for GDPR-compliant data export (Right to Data Portability)
 * allowing users to request and download their personal data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { gdprComplianceManager, requestDataExport } from '@/lib/profile/gdpr-compliance'

/**
 * POST /api/profile/gdpr/export - Request data export
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

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const {
      exportType = 'full',
      format = 'json',
      categories,
      includeMetadata = true,
      includeSystemData = false,
      includeDeletedData = false
    } = body

    // Validate export type
    const validExportTypes = ['full', 'partial', 'profile', 'activity', 'files']
    if (!validExportTypes.includes(exportType)) {
      return NextResponse.json(
        { error: 'Invalid export type', code: 'INVALID_EXPORT_TYPE' },
        { status: 400 }
      )
    }

    // Validate format
    const validFormats = ['json', 'csv', 'xml', 'pdf']
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { error: 'Invalid export format', code: 'INVALID_FORMAT' },
        { status: 400 }
      )
    }

    // Check for existing pending export
    const { data: existingExport } = await (supabase as any)
      .from('gdpr_data_exports')
      .select('id, status, created_at')
      .eq('user_id', userId)
      .in('status', ['pending', 'processing'])
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .single()

    if (existingExport) {
      return NextResponse.json(
        {
          error: 'An export request is already in progress',
          code: 'EXPORT_IN_PROGRESS',
          existingExportId: existingExport.id,
          status: existingExport.status
        },
        { status: 409 }
      )
    }

    // Create export request
    const exportResult = await gdprComplianceManager.exportUserData({
      userId,
      requestType: exportType,
      categories: categories || [],
      format,
      includeMetadata,
      includeSystemData,
      includeDeletedData
    })

    if (!exportResult.success) {
      return NextResponse.json(
        {
          error: exportResult.error,
          code: 'EXPORT_FAILED'
        },
        { status: 500 }
      )
    }

    // Log export request
    await (supabase as any).from('auth_audit_logs').insert({
      event_type: 'gdpr_export_requested',
      event_category: 'gdpr',
      user_id: userId,
      success: true,
      event_data: {
        export_id: exportResult.exportId,
        export_type: exportType,
        format,
        categories: categories || [],
        include_metadata: includeMetadata,
        include_system_data: includeSystemData,
        file_size_bytes: exportResult.fileSize
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Data export completed successfully',
      exportId: exportResult.exportId,
      downloadUrl: exportResult.downloadUrl,
      fileSize: exportResult.fileSize,
      format,
      expiresAt: exportResult.expiresAt,
      processingTime: `${exportResult.processingTimeMs}ms`,
      instructions: {
        download: 'Use the downloadUrl to download your data. The link will expire in 30 days.',
        format: `Your data is exported in ${format.toUpperCase()} format`,
        contents: exportType === 'full' 
          ? 'This export contains all your personal data including profile, preferences, files, and activity history.'
          : `This export contains your ${exportType} data.`
      }
    })

  } catch (error) {
    console.error('GDPR export API error:', error)
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
 * GET /api/profile/gdpr/export - Get export status and history
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
    const exportId = searchParams.get('exportId')
    const limit = parseInt(searchParams.get('limit') || '10')

    if (exportId) {
      // Get specific export
      const { data: exportRecord, error: exportError } = await supabase
        .from('gdpr_data_exports')
        .select('*')
        .eq('id', exportId)
        .eq('user_id', userId)
        .single()

      if (exportError || !exportRecord) {
        return NextResponse.json(
          { error: 'Export not found', code: 'EXPORT_NOT_FOUND' },
          { status: 404 }
        )
      }

      // Get signed download URL if export is completed and not expired
      let downloadUrl: string | null = null
      if (exportRecord.status === 'completed' && 
          exportRecord.expires_at && 
          new Date(exportRecord.expires_at) > new Date()) {
        
        try {
          const { data: urlData } = await supabase.storage
            .from('gdpr-exports')
            .createSignedUrl(
              `${userId}/${exportRecord.id}.${exportRecord.format}`,
              3600 // 1 hour
            )
          downloadUrl = urlData?.signedUrl || null
        } catch (urlError) {
          console.error('Failed to generate download URL:', urlError)
        }
      }

      return NextResponse.json({
        export: {
          id: exportRecord.id,
          requestType: exportRecord.request_type,
          format: exportRecord.format,
          status: exportRecord.status,
          fileSize: exportRecord.export_size_bytes,
          downloadUrl,
          downloadCount: exportRecord.download_count,
          requestedAt: exportRecord.requested_at,
          processingStartedAt: exportRecord.processing_started_at,
          processingCompletedAt: exportRecord.processing_completed_at,
          processingTime: exportRecord.processing_time_seconds,
          expiresAt: exportRecord.expires_at,
          errorMessage: exportRecord.error_message,
          categories: exportRecord.requested_categories,
          includeMetadata: exportRecord.include_metadata,
          includeSystemData: exportRecord.include_system_data
        }
      })

    } else {
      // Get export history
      const { data: exports, error: exportsError } = await supabase
        .from('gdpr_data_exports')
        .select('*')
        .eq('user_id', userId)
        .order('requested_at', { ascending: false })
        .limit(limit)

      if (exportsError) {
        throw exportsError
      }

      return NextResponse.json({
        exports: (exports || []).map((exp: any) => ({
          id: exp.id,
          requestType: exp.request_type,
          format: exp.format,
          status: exp.status,
          fileSize: exp.export_size_bytes,
          downloadCount: exp.download_count,
          requestedAt: exp.requested_at,
          processingCompletedAt: exp.processing_completed_at,
          expiresAt: exp.expires_at,
          errorMessage: exp.error_message,
          canDownload: exp.status === 'completed' && 
                       exp.expires_at && 
                       new Date(exp.expires_at) > new Date()
        })),
        pagination: {
          limit,
          hasMore: (exports?.length || 0) === limit
        }
      })
    }

  } catch (error) {
    console.error('GDPR export status API error:', error)
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
 * DELETE /api/profile/gdpr/export - Cancel pending export or delete completed export
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

    // Get export ID from query parameters
    const searchParams = request.nextUrl.searchParams
    const exportId = searchParams.get('exportId')

    if (!exportId) {
      return NextResponse.json(
        { error: 'Export ID is required', code: 'EXPORT_ID_REQUIRED' },
        { status: 400 }
      )
    }

    // Get export record
    const { data: exportRecord, error: exportError } = await supabase
      .from('gdpr_data_exports')
      .select('*')
      .eq('id', exportId)
      .eq('user_id', userId)
      .single()

    if (exportError || !exportRecord) {
      return NextResponse.json(
        { error: 'Export not found', code: 'EXPORT_NOT_FOUND' },
        { status: 404 }
      )
    }

    // Cancel or delete based on status
    if (exportRecord.status === 'pending' || exportRecord.status === 'processing') {
      // Cancel pending/processing export
      const { error: cancelError } = await supabase
        .from('gdpr_data_exports')
        .update({
          status: 'cancelled',
          error_message: 'Cancelled by user'
        })
        .eq('id', exportId)

      if (cancelError) {
        throw cancelError
      }

      return NextResponse.json({
        success: true,
        message: 'Export cancelled successfully',
        exportId,
        action: 'cancelled'
      })

    } else if (exportRecord.status === 'completed') {
      // Delete completed export file and record
      if (exportRecord.export_file_path) {
        await supabase.storage
          .from('gdpr-exports')
          .remove([exportRecord.export_file_path])
          .catch(console.error) // Don't fail if file doesn't exist
      }

      const { error: deleteError } = await supabase
        .from('gdpr_data_exports')
        .delete()
        .eq('id', exportId)

      if (deleteError) {
        throw deleteError
      }

      // Log export deletion
      await (supabase as any).from('auth_audit_logs').insert({
        event_type: 'gdpr_export_deleted',
        event_category: 'gdpr',
        user_id: userId,
        success: true,
        event_data: {
          export_id: exportId,
          export_type: exportRecord.request_type,
          was_downloaded: exportRecord.download_count > 0
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Export deleted successfully',
        exportId,
        action: 'deleted'
      })

    } else {
      return NextResponse.json(
        { error: 'Export cannot be cancelled or deleted', code: 'INVALID_STATUS' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('GDPR export deletion API error:', error)
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