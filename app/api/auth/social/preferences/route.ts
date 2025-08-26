/**
 * Profile Sync Preferences API Route
 * Epic 2 Story 2.3: Social Media Login Integration
 * 
 * API endpoint for managing user profile synchronization preferences.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ProfileSyncManager } from '@/lib/auth/profile-sync'

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

    // Get sync preferences
    const profileSync = new ProfileSyncManager()
    const preferences = await profileSync.getUserSyncPreferences(userId)

    return NextResponse.json({
      preferences
    })

  } catch (error) {
    console.error('Get sync preferences error:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to get sync preferences',
        code: 'GET_PREFERENCES_FAILED',
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

    // Validate preferences structure
    const allowedFields = [
      'overwriteExisting',
      'preserveUserChanges',
      'syncFields',
      'excludeFields'
    ]

    const preferences: any = {}
    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key)) {
        preferences[key] = value
      }
    }

    if (Object.keys(preferences).length === 0) {
      return NextResponse.json(
        { error: 'No valid preferences provided', code: 'NO_VALID_PREFERENCES' },
        { status: 400 }
      )
    }

    // Update sync preferences
    const profileSync = new ProfileSyncManager()
    const result = await profileSync.updateSyncPreferences(userId, preferences)

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          code: 'UPDATE_PREFERENCES_FAILED'
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Sync preferences updated successfully',
      preferences
    })

  } catch (error) {
    console.error('Update sync preferences error:', error)
    
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