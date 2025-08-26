/**
 * Profile Synchronization API Route
 * Epic 2 Story 2.3: Social Media Login Integration
 * 
 * API endpoint for manual profile synchronization from OAuth providers.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ProfileSyncManager } from '@/lib/auth/profile-sync'
import { isValidOAuthProvider, OAuthProvider } from '@/lib/auth/oauth-config'

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
    const { provider, options = {} } = body

    // Validate provider
    if (!provider || !isValidOAuthProvider(provider)) {
      return NextResponse.json(
        { error: 'Invalid OAuth provider', code: 'INVALID_PROVIDER' },
        { status: 400 }
      )
    }

    // Get user's OAuth connection for this provider
    const { data: connection, error: connectionError } = await (supabase as any)
      .from('user_oauth_connections')
      .select(`
        provider_data,
        oauth_providers!inner(provider_name)
      `)
      .eq('user_id', userId)
      .eq('oauth_providers.provider_name', provider)
      .is('disconnected_at', null)
      .single()

    if (connectionError || !connection) {
      return NextResponse.json(
        { 
          error: `No active ${provider} connection found`, 
          code: 'NO_CONNECTION' 
        },
        { status: 404 }
      )
    }

    // Sync profile data
    const profileSync = new ProfileSyncManager()
    const syncResult = await profileSync.syncProviderProfile(
      userId,
      provider as OAuthProvider,
      (connection as any).provider_data,
      options
    )

    if (!syncResult.success) {
      return NextResponse.json(
        {
          error: syncResult.error,
          code: 'SYNC_FAILED'
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Profile synchronized successfully',
      updatedFields: syncResult.updatedFields,
      conflicts: syncResult.conflicts
    })

  } catch (error) {
    console.error('Profile sync error:', error)
    
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
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    // Get sync history
    const profileSync = new ProfileSyncManager()
    const syncHistory = await profileSync.getSyncHistory(userId, limit)

    return NextResponse.json({
      syncHistory,
      count: syncHistory.length
    })

  } catch (error) {
    console.error('Get sync history error:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to get sync history',
        code: 'GET_HISTORY_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}