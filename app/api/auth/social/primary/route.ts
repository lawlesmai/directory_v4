/**
 * Primary Authentication Method Management API Route
 * Epic 2 Story 2.3: Social Media Login Integration
 * 
 * API endpoint for managing primary authentication method selection.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AccountLinkingManager, getPrimaryAuthMethod } from '@/lib/auth/account-linking'

export async function GET(request: NextRequest) {
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

    // Get primary authentication method
    const primaryMethod = await getPrimaryAuthMethod(userId)

    return NextResponse.json({
      primaryMethod
    })

  } catch (error) {
    console.error('Get primary auth method error:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to get primary authentication method',
        code: 'GET_PRIMARY_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

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
    const { connectionId } = body

    // connectionId can be null to set email/password as primary

    // Set primary authentication method
    const accountLinking = new AccountLinkingManager()
    const result = await accountLinking.setPrimaryAuthMethod(userId, connectionId)

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error, 
          code: 'SET_PRIMARY_FAILED'
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Primary authentication method updated successfully',
      connectionId
    })

  } catch (error) {
    console.error('Set primary auth method error:', error)
    
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