/**
 * Social Account Unlinking API Route
 * Epic 2 Story 2.3: Social Media Login Integration
 * 
 * API endpoint for unlinking social accounts from user accounts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AccountLinkingManager } from '@/lib/auth/account-linking'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Verify user is authenticated
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session?.user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const body = await request.json()
    const { connectionId, reason } = body

    // Validate required fields
    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required', code: 'MISSING_CONNECTION_ID' },
        { status: 400 }
      )
    }

    // Unlink the account
    const accountLinking = new AccountLinkingManager()
    const unlinkResult = await accountLinking.unlinkOAuthAccount(userId, connectionId, reason)

    if (!unlinkResult.success) {
      return NextResponse.json(
        { 
          error: unlinkResult.error, 
          code: 'ACCOUNT_UNLINKING_FAILED'
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Account unlinked successfully',
      connectionId
    })

  } catch (error) {
    console.error('Social account unlinking error:', error)
    
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