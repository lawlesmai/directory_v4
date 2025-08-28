/**
 * User Profile Management API
 * Epic 2 Story 2.7: User Profile Management & Preferences Infrastructure
 * 
 * RESTful API endpoints for comprehensive profile management including
 * profile data, completion scoring, and basic CRUD operations.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { profileCompletionManager } from '@/lib/profile/completion-scoring'
import { enhancedProfileSyncManager } from '@/lib/profile/profile-sync-enhanced'

/**
 * GET /api/profile - Get user profile with completion scoring
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
    const includeCompletion = searchParams.get('includeCompletion') === 'true'
    const includeAnalytics = searchParams.get('includeAnalytics') === 'true'
    const includeRecommendations = searchParams.get('includeRecommendations') === 'true'

    // Get basic profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        *,
        user_roles(
          role_id,
          is_active,
          roles(name, display_name)
        )
      `)
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('Profile fetch error:', profileError)
      return NextResponse.json(
        { error: 'Failed to fetch profile', code: 'PROFILE_FETCH_FAILED' },
        { status: 500 }
      )
    }

    // Build response data
    const responseData: any = {
      profile: {
        id: profile.id,
        displayName: profile.display_name,
        username: profile.username,
        firstName: profile.first_name,
        lastName: profile.last_name,
        email: session.user.email,
        avatarUrl: profile.avatar_url,
        bio: profile.bio,
        phoneNumber: profile.phone_number,
        phoneVerified: profile.phone_verified,
        emailVerified: profile.email_verified,
        city: profile.city,
        state: profile.state,
        country: profile.country,
        timezone: profile.timezone,
        website: profile.website,
        socialLinks: profile.social_links,
        preferences: profile.preferences,
        profileVisibility: profile.profile_visibility,
        profileSearchable: profile.profile_searchable,
        showContactInfo: profile.show_contact_info,
        showSocialLinks: profile.show_social_links,
        showLocation: profile.show_location,
        showActivity: profile.show_activity,
        isBusinessOwner: profile.is_business_owner,
        businessOwnerVerified: profile.business_owner_verified,
        profileCompletionScore: profile.profile_completion_score,
        profileCompletionLevel: profile.profile_completion_level,
        accountStatus: profile.account_status,
        lastLoginAt: profile.last_login_at,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
        roles: profile.user_roles?.filter((ur: any) => ur.is_active).map((ur: any) => ({
          id: ur.role_id,
          name: ur.roles?.name,
          displayName: ur.roles?.display_name
        })) || []
      }
    }

    // Add completion data if requested
    if (includeCompletion) {
      const completion = await profileCompletionManager.calculateProfileCompletion(userId)
      responseData.completion = completion
    }

    // Add analytics if requested
    if (includeAnalytics) {
      const analytics = await profileCompletionManager.getCompletionAnalytics(userId)
      responseData.analytics = analytics
    }

    // Add quick recommendations if requested
    if (includeRecommendations) {
      const { topRecommendations } = await import('@/lib/profile/completion-scoring')
        .then(module => module.quickProfileCheck(userId))
      responseData.recommendations = topRecommendations
    }

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('Profile API error:', error)
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
 * PUT /api/profile - Update user profile
 */
export async function PUT(request: NextRequest) {
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
    const updateData = await request.json()

    // Validate and sanitize update data
    const allowedFields = [
      'display_name', 'username', 'first_name', 'last_name', 'bio',
      'phone_number', 'city', 'state', 'country', 'timezone',
      'website', 'social_links', 'preferred_name', 'middle_name',
      'title', 'company', 'job_title', 'profile_visibility',
      'profile_searchable', 'show_contact_info', 'show_social_links',
      'show_location', 'show_activity', 'custom_fields', 'profile_tags'
    ]

    const sanitizedData: any = {}
    const changedFields: string[] = []

    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key) && value !== undefined) {
        sanitizedData[key] = value
        changedFields.push(key)
      }
    }

    if (Object.keys(sanitizedData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields provided', code: 'NO_VALID_FIELDS' },
        { status: 400 }
      )
    }

    // Add update metadata
    sanitizedData.updated_at = new Date().toISOString()
    sanitizedData.last_profile_update = new Date().toISOString()

    // Username uniqueness check
    if (sanitizedData.username) {
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', sanitizedData.username)
        .neq('id', userId)
        .single()

      if (existingUser) {
        return NextResponse.json(
          { error: 'Username already taken', code: 'USERNAME_TAKEN' },
          { status: 409 }
        )
      }
    }

    // Update profile
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update(sanitizedData)
      .eq('id', userId)
      .select()
      .single()

    if (updateError) {
      console.error('Profile update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update profile', code: 'UPDATE_FAILED' },
        { status: 500 }
      )
    }

    // Update profile completion score
    const completion = await profileCompletionManager.updateCompletionAndCheckAchievements(userId)

    // Log profile update
    await (supabase as any).from('auth_audit_logs').insert({
      event_type: 'profile_update',
      event_category: 'profile',
      user_id: userId,
      success: true,
      event_data: {
        changed_fields: changedFields,
        completion_score_change: completion.completion.totalScore - (updatedProfile.profile_completion_score || 0)
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      profile: updatedProfile,
      completion: completion.completion,
      newBadges: completion.newBadges,
      newMilestones: completion.newMilestones
    })

  } catch (error) {
    console.error('Profile update API error:', error)
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
 * PATCH /api/profile - Partial profile update (specific fields)
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
    const { field, value, metadata } = await request.json()

    if (!field) {
      return NextResponse.json(
        { error: 'Field name is required', code: 'FIELD_REQUIRED' },
        { status: 400 }
      )
    }

    // Validate field name
    const allowedFields = [
      'display_name', 'username', 'first_name', 'last_name', 'bio',
      'phone_number', 'city', 'state', 'country', 'timezone',
      'website', 'social_links', 'profile_visibility', 'profile_searchable',
      'show_contact_info', 'show_social_links', 'show_location', 'show_activity'
    ]

    if (!allowedFields.includes(field)) {
      return NextResponse.json(
        { error: 'Invalid field name', code: 'INVALID_FIELD' },
        { status: 400 }
      )
    }

    // Special validation for username
    if (field === 'username' && value) {
      if (!/^[a-zA-Z0-9_]{3,50}$/.test(value)) {
        return NextResponse.json(
          { error: 'Username must be 3-50 characters and contain only letters, numbers, and underscores', code: 'INVALID_USERNAME' },
          { status: 400 }
        )
      }

      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', value)
        .neq('id', userId)
        .single()

      if (existingUser) {
        return NextResponse.json(
          { error: 'Username already taken', code: 'USERNAME_TAKEN' },
          { status: 409 }
        )
      }
    }

    // Update single field
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({
        [field]: value,
        updated_at: new Date().toISOString(),
        last_profile_update: new Date().toISOString(),
        ...(field === 'display_name' ? { display_name_user_set: true } : {}),
        ...(metadata && { custom_fields: { ...metadata } })
      })
      .eq('id', userId)
      .select()
      .single()

    if (updateError) {
      console.error('Field update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update field', code: 'UPDATE_FAILED' },
        { status: 500 }
      )
    }

    // Update completion score
    const { completion } = await profileCompletionManager.updateCompletionAndCheckAchievements(userId)

    // Log field update
    await (supabase as any).from('auth_audit_logs').insert({
      event_type: 'profile_field_update',
      event_category: 'profile',
      user_id: userId,
      success: true,
      event_data: {
        field,
        new_value: value,
        metadata
      }
    })

    return NextResponse.json({
      success: true,
      message: `${field} updated successfully`,
      field,
      value,
      completionScore: completion.totalScore,
      completionLevel: completion.level
    })

  } catch (error) {
    console.error('Profile field update API error:', error)
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
 * DELETE /api/profile - Soft delete user profile
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
    const { reason, keepAnonymized = true } = await request.json()

    if (keepAnonymized) {
      // Soft delete - anonymize profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: 'Deleted User',
          username: null,
          first_name: null,
          last_name: null,
          bio: null,
          phone_number: null,
          city: null,
          state: null,
          country: null,
          website: null,
          social_links: {},
          avatar_url: null,
          custom_fields: {},
          account_status: 'deleted',
          deleted_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        throw updateError
      }
    } else {
      // Mark for hard deletion (handled by GDPR compliance system)
      const { error: markError } = await supabase
        .from('profiles')
        .update({
          account_status: 'pending_deletion',
          deleted_at: new Date().toISOString(),
          suspension_reason: reason || 'User requested account deletion'
        })
        .eq('id', userId)

      if (markError) {
        throw markError
      }
    }

    // Log profile deletion
    await (supabase as any).from('auth_audit_logs').insert({
      event_type: 'profile_deletion',
      event_category: 'profile',
      user_id: userId,
      success: true,
      event_data: {
        deletion_type: keepAnonymized ? 'soft_delete' : 'mark_for_deletion',
        reason
      }
    })

    return NextResponse.json({
      success: true,
      message: keepAnonymized ? 'Profile anonymized successfully' : 'Profile marked for deletion',
      deletionType: keepAnonymized ? 'anonymized' : 'marked_for_deletion'
    })

  } catch (error) {
    console.error('Profile deletion API error:', error)
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