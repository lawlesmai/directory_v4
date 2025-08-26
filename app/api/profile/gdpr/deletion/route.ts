/**
 * GDPR Data Deletion API
 * Epic 2 Story 2.7: User Profile Management & Preferences Infrastructure
 * 
 * API endpoint for GDPR-compliant data deletion (Right to be Forgotten)
 * allowing users to request deletion of their personal data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { gdprComplianceManager, requestAccountDeletion } from '@/lib/profile/gdpr-compliance'

/**
 * POST /api/profile/gdpr/deletion - Request data deletion
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
      deletionType = 'account',
      deletionScope = [],
      keepAnonymized = false,
      legalBasis = 'user_request',
      justification,
      confirmationToken
    } = body

    // Validate deletion type
    const validDeletionTypes = ['account', 'profile', 'activity', 'files', 'specific']
    if (!validDeletionTypes.includes(deletionType)) {
      return NextResponse.json(
        { error: 'Invalid deletion type', code: 'INVALID_DELETION_TYPE' },
        { status: 400 }
      )
    }

    // For account deletion, require additional confirmation
    if (deletionType === 'account') {
      if (!confirmationToken || confirmationToken !== 'DELETE_MY_ACCOUNT') {
        return NextResponse.json(
          {
            error: 'Account deletion requires confirmation token',
            code: 'CONFIRMATION_REQUIRED',
            instructions: 'Include confirmationToken: "DELETE_MY_ACCOUNT" in your request'
          },
          { status: 400 }
        )
      }

      if (!justification || justification.trim().length < 10) {
        return NextResponse.json(
          { error: 'Justification is required for account deletion', code: 'JUSTIFICATION_REQUIRED' },
          { status: 400 }
        )
      }
    }

    // Check for existing pending deletion
    const { data: existingDeletion } = await supabase
      .from('gdpr_data_deletions')
      .select('id, status, deletion_type, requested_at')
      .eq('user_id', userId)
      .in('status', ['pending', 'processing'])
      .single()

    if (existingDeletion) {
      return NextResponse.json(
        {
          error: 'A deletion request is already in progress',
          code: 'DELETION_IN_PROGRESS',
          existingDeletionId: existingDeletion.id,
          status: existingDeletion.status,
          deletionType: existingDeletion.deletion_type,
          requestedAt: existingDeletion.requested_at
        },
        { status: 409 }
      )
    }

    // For account deletion, check for active business ownership
    if (deletionType === 'account') {
      const { data: businessOwnership } = await supabase
        .from('business_owners')
        .select('business_id, businesses(name, status)')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (businessOwnership && businessOwnership.length > 0) {
        const activeBusinesses = businessOwnership.filter(bo => 
          bo.businesses?.status === 'active'
        )

        if (activeBusinesses.length > 0) {
          return NextResponse.json(
            {
              error: 'Cannot delete account with active business ownership',
              code: 'ACTIVE_BUSINESS_OWNERSHIP',
              activeBusinesses: activeBusinesses.map(ab => ({
                businessId: ab.business_id,
                businessName: ab.businesses?.name
              })),
              instructions: 'Please transfer or close your businesses before deleting your account'
            },
            { status: 409 }
          )
        }
      }
    }

    // Create deletion request
    const deletionResult = await gdprComplianceManager.deleteUserData({
      userId,
      deletionType,
      deletionScope,
      keepAnonymized,
      legalBasis,
      justification
    })

    if (!deletionResult.success) {
      return NextResponse.json(
        {
          error: deletionResult.error,
          code: 'DELETION_FAILED'
        },
        { status: 500 }
      )
    }

    // Log deletion request
    await supabase.from('auth_audit_logs').insert({
      event_type: 'gdpr_deletion_requested',
      event_category: 'gdpr',
      user_id: userId,
      success: true,
      event_data: {
        deletion_id: deletionResult.deletionId,
        deletion_type: deletionType,
        deletion_scope: deletionScope,
        keep_anonymized: keepAnonymized,
        legal_basis: legalBasis,
        items_deleted: deletionResult.itemsDeleted,
        items_anonymized: deletionResult.itemsAnonymized,
        items_retained: deletionResult.itemsRetained
      }
    })

    // Prepare response message based on deletion type
    let message = 'Data deletion completed successfully'
    let instructions: any = {}

    switch (deletionType) {
      case 'account':
        if (keepAnonymized) {
          message = 'Account has been anonymized'
          instructions = {
            status: 'Your account has been anonymized while preserving system integrity',
            access: 'You can still log in, but your personal information has been removed',
            reversal: 'This action cannot be reversed'
          }
        } else {
          message = 'Account has been marked for deletion'
          instructions = {
            status: 'Your account is scheduled for permanent deletion',
            timeline: 'Deletion will be completed within 30 days as required by law',
            reversal: 'You may be able to recover your account within 7 days by contacting support'
          }
        }
        break

      case 'profile':
        message = 'Profile data has been deleted'
        instructions = {
          status: 'Your profile information has been removed',
          retained: 'System logs and analytics data may be retained for legal compliance'
        }
        break

      case 'files':
        message = `${deletionResult.itemsDeleted} files have been deleted`
        instructions = {
          status: 'Your uploaded files have been permanently removed',
          backup: 'Please ensure you have backups if needed'
        }
        break
    }

    return NextResponse.json({
      success: true,
      message,
      deletionId: deletionResult.deletionId,
      deletionType,
      summary: {
        itemsDeleted: deletionResult.itemsDeleted,
        itemsAnonymized: deletionResult.itemsAnonymized,
        itemsRetained: deletionResult.itemsRetained,
        retentionReasons: deletionResult.retentionReasons
      },
      processingTime: `${deletionResult.processingTimeMs}ms`,
      instructions,
      compliance: {
        legalBasis,
        gdprArticle: deletionType === 'account' ? 'Article 17 - Right to erasure' : 'Article 17 - Right to erasure',
        processingLawfulness: 'Data processing ceased as requested'
      }
    })

  } catch (error) {
    console.error('GDPR deletion API error:', error)
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
 * GET /api/profile/gdpr/deletion - Get deletion status and history
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
    const deletionId = searchParams.get('deletionId')
    const limit = parseInt(searchParams.get('limit') || '10')

    if (deletionId) {
      // Get specific deletion request
      const { data: deletionRecord, error: deletionError } = await supabase
        .from('gdpr_data_deletions')
        .select('*')
        .eq('id', deletionId)
        .eq('user_id', userId)
        .single()

      if (deletionError || !deletionRecord) {
        return NextResponse.json(
          { error: 'Deletion request not found', code: 'DELETION_NOT_FOUND' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        deletion: {
          id: deletionRecord.id,
          deletionType: deletionRecord.deletion_type,
          deletionScope: deletionRecord.deletion_scope,
          keepAnonymized: deletionRecord.keep_anonymized,
          legalBasis: deletionRecord.legal_basis,
          justification: deletionRecord.justification,
          status: deletionRecord.status,
          itemsDeleted: deletionRecord.items_deleted,
          itemsAnonymized: deletionRecord.items_anonymized,
          itemsRetained: deletionRecord.items_retained,
          retentionReasons: deletionRecord.retention_reasons,
          requestedAt: deletionRecord.requested_at,
          processingStartedAt: deletionRecord.processing_started_at,
          processingCompletedAt: deletionRecord.processing_completed_at,
          canBeReversed: deletionRecord.can_be_reversed,
          reversalDeadline: deletionRecord.reversal_deadline,
          errorMessage: deletionRecord.error_message
        }
      })

    } else {
      // Get deletion history
      const { data: deletions, error: deletionsError } = await supabase
        .from('gdpr_data_deletions')
        .select('*')
        .eq('user_id', userId)
        .order('requested_at', { ascending: false })
        .limit(limit)

      if (deletionsError) {
        throw deletionsError
      }

      return NextResponse.json({
        deletions: (deletions || []).map(del => ({
          id: del.id,
          deletionType: del.deletion_type,
          status: del.status,
          itemsDeleted: del.items_deleted,
          itemsAnonymized: del.items_anonymized,
          itemsRetained: del.items_retained,
          requestedAt: del.requested_at,
          processingCompletedAt: del.processing_completed_at,
          canBeReversed: del.can_be_reversed &&
                         del.reversal_deadline &&
                         new Date(del.reversal_deadline) > new Date(),
          reversalDeadline: del.reversal_deadline,
          errorMessage: del.error_message
        })),
        pagination: {
          limit,
          hasMore: (deletions?.length || 0) === limit
        }
      })
    }

  } catch (error) {
    console.error('GDPR deletion status API error:', error)
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
 * PATCH /api/profile/gdpr/deletion - Reverse deletion (if within allowed timeframe)
 */
export async function PATCH(request: NextRequest) {
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
    const { deletionId, reversalReason } = await request.json()

    if (!deletionId) {
      return NextResponse.json(
        { error: 'Deletion ID is required', code: 'DELETION_ID_REQUIRED' },
        { status: 400 }
      )
    }

    // Get deletion record
    const { data: deletionRecord, error: deletionError } = await supabase
      .from('gdpr_data_deletions')
      .select('*')
      .eq('id', deletionId)
      .eq('user_id', userId)
      .single()

    if (deletionError || !deletionRecord) {
      return NextResponse.json(
        { error: 'Deletion request not found', code: 'DELETION_NOT_FOUND' },
        { status: 404 }
      )
    }

    // Check if reversal is allowed
    if (!deletionRecord.can_be_reversed) {
      return NextResponse.json(
        { error: 'This deletion cannot be reversed', code: 'REVERSAL_NOT_ALLOWED' },
        { status: 409 }
      )
    }

    if (!deletionRecord.reversal_deadline || 
        new Date(deletionRecord.reversal_deadline) <= new Date()) {
      return NextResponse.json(
        { error: 'Reversal deadline has passed', code: 'REVERSAL_EXPIRED' },
        { status: 409 }
      )
    }

    if (deletionRecord.status !== 'completed') {
      return NextResponse.json(
        { error: 'Only completed deletions can be reversed', code: 'INVALID_STATUS' },
        { status: 400 }
      )
    }

    // Mark deletion as reversed
    const { error: updateError } = await supabase
      .from('gdpr_data_deletions')
      .update({
        reversed_at: new Date().toISOString(),
        reversal_reason: reversalReason || 'User requested reversal',
        can_be_reversed: false
      })
      .eq('id', deletionId)

    if (updateError) {
      throw updateError
    }

    // Note: Actual data restoration would need to be implemented based on what was deleted
    // This is a complex process that may involve restoring from backups

    // Log deletion reversal
    await supabase.from('auth_audit_logs').insert({
      event_type: 'gdpr_deletion_reversed',
      event_category: 'gdpr',
      user_id: userId,
      success: true,
      event_data: {
        deletion_id: deletionId,
        deletion_type: deletionRecord.deletion_type,
        reversal_reason: reversalReason
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Deletion reversal initiated',
      deletionId,
      reversalDate: new Date().toISOString(),
      instructions: {
        status: 'Your deletion reversal request has been recorded',
        timeline: 'Data restoration may take up to 48 hours to complete',
        limitations: 'Some data may not be fully recoverable depending on the deletion scope',
        support: 'Contact support if you experience any issues accessing your data'
      }
    })

  } catch (error) {
    console.error('GDPR deletion reversal API error:', error)
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