/**
 * User Preferences Management API
 * Epic 2 Story 2.7: User Profile Management & Preferences Infrastructure
 * 
 * RESTful API endpoints for hierarchical preference management with
 * inheritance, validation, and GDPR compliance.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { preferencesManager } from '@/lib/profile/preferences-manager'

/**
 * GET /api/profile/preferences - Get user preferences with inheritance
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
    const includeInherited = searchParams.get('includeInherited') !== 'false'
    const includeTemplates = searchParams.get('includeTemplates') === 'true'

    // Get user preferences
    const preferences = await preferencesManager.getUserPreferences(
      userId,
      category,
      includeInherited
    )

    // Build response data
    const responseData: any = {
      preferences: preferences.map(pref => ({
        id: pref.id,
        category: pref.category,
        subcategory: pref.subcategory,
        preferenceKey: pref.preference_key,
        value: pref.preference_value,
        isInherited: pref.is_inherited,
        dataType: pref.data_type,
        isSensitive: pref.is_sensitive,
        requiresConsent: pref.requires_consent,
        consentGiven: pref.consent_given,
        consentDate: pref.consent_date,
        gdprCategory: pref.gdpr_category,
        version: pref.version,
        createdAt: pref.created_at,
        updatedAt: pref.updated_at,
        expiresAt: pref.expires_at
      }))
    }

    // Add preference templates if requested
    if (includeTemplates) {
      const templates = await preferencesManager.getPreferenceTemplates(category)
      responseData.templates = templates.map(template => ({
        id: template.id,
        templateName: template.template_name,
        displayName: template.display_name,
        description: template.description,
        category: template.category,
        subcategory: template.subcategory,
        preferenceKey: template.preference_key,
        defaultValue: template.default_value,
        dataType: template.data_type,
        validationSchema: template.validation_schema,
        allowedValues: template.allowed_values,
        isRequired: template.is_required,
        isUserConfigurable: template.is_user_configurable,
        requiresConsent: template.requires_consent,
        isSensitive: template.is_sensitive,
        uiComponent: template.ui_component,
        uiProps: template.ui_props,
        displayOrder: template.display_order,
        isVisible: template.is_visible
      }))
    }

    // Group preferences by category for easier consumption
    const groupedPreferences: Record<string, any[]> = {}
    for (const pref of responseData.preferences) {
      if (!groupedPreferences[pref.category]) {
        groupedPreferences[pref.category] = []
      }
      groupedPreferences[pref.category].push(pref)
    }

    responseData.grouped = groupedPreferences

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('Preferences API error:', error)
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
 * PUT /api/profile/preferences - Update multiple preferences
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
    const { preferences, changeReason } = await request.json()

    if (!Array.isArray(preferences) || preferences.length === 0) {
      return NextResponse.json(
        { error: 'Preferences array is required', code: 'PREFERENCES_REQUIRED' },
        { status: 400 }
      )
    }

    // Validate preferences structure
    const validPreferences = preferences.filter(pref => 
      pref.category && 
      pref.preferenceKey && 
      pref.value !== undefined
    )

    if (validPreferences.length === 0) {
      return NextResponse.json(
        { error: 'No valid preferences provided', code: 'NO_VALID_PREFERENCES' },
        { status: 400 }
      )
    }

    // Convert to bulk update format
    const bulkUpdates = validPreferences.reduce((acc: any, pref: any) => {
      const category = pref.category
      const existingUpdate = acc.find((u: any) => u.category === category && u.subcategory === pref.subcategory)
      
      if (existingUpdate) {
        existingUpdate.preferences[pref.preferenceKey] = pref.value
      } else {
        acc.push({
          category,
          subcategory: pref.subcategory,
          preferences: {
            [pref.preferenceKey]: pref.value
          }
        })
      }
      
      return acc
    }, [])

    // Perform bulk update
    const result = await preferencesManager.bulkUpdateUserPreferences(userId, bulkUpdates)

    // Log preferences update
    await (supabase as any).from('auth_audit_logs').insert({
      event_type: 'preferences_bulk_update',
      event_category: 'preferences',
      user_id: userId,
      success: result.success,
      event_data: {
        updated_count: result.results.filter(r => r.success).length,
        failed_count: result.results.filter(r => !r.success).length,
        change_reason: changeReason,
        categories: [...new Set(validPreferences.map(p => p.category))]
      }
    })

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Some preferences failed to update',
          code: 'PARTIAL_UPDATE_FAILED',
          results: result.results,
          errors: result.errors
        },
        { status: 207 } // Multi-status
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Preferences updated successfully',
      updatedCount: result.results.filter(r => r.success).length,
      results: result.results
    })

  } catch (error) {
    console.error('Preferences bulk update API error:', error)
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
 * PATCH /api/profile/preferences - Update single preference
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
    const { 
      category, 
      subcategory, 
      preferenceKey, 
      value, 
      requiresConsent,
      changeReason,
      expiresAt 
    } = await request.json()

    if (!category || !preferenceKey) {
      return NextResponse.json(
        { error: 'Category and preferenceKey are required', code: 'MISSING_REQUIRED_FIELDS' },
        { status: 400 }
      )
    }

    if (value === undefined) {
      return NextResponse.json(
        { error: 'Value is required', code: 'VALUE_REQUIRED' },
        { status: 400 }
      )
    }

    // Update preference
    const result = await preferencesManager.updateUserPreference(
      userId,
      category,
      preferenceKey,
      value,
      {
        subcategory,
        requiresConsent,
        changeReason,
        expiresAt
      }
    )

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          code: 'PREFERENCE_UPDATE_FAILED',
          validationResult: result.validationResult
        },
        { status: 400 }
      )
    }

    // Log preference update
    await (supabase as any).from('auth_audit_logs').insert({
      event_type: 'preference_update',
      event_category: 'preferences',
      user_id: userId,
      success: true,
      event_data: {
        category,
        subcategory,
        preference_key: preferenceKey,
        change_reason: changeReason,
        requires_consent: requiresConsent
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Preference updated successfully',
      preference: result.updatedPreference,
      validationResult: result.validationResult
    })

  } catch (error) {
    console.error('Preference update API error:', error)
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
 * DELETE /api/profile/preferences - Reset preference to default
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

    // Parse query parameters or request body
    let category: string
    let preferenceKey: string
    let subcategory: string | undefined

    const searchParams = request.nextUrl.searchParams
    if (searchParams.has('category') && searchParams.has('preferenceKey')) {
      // Query parameters
      category = searchParams.get('category')!
      preferenceKey = searchParams.get('preferenceKey')!
      subcategory = searchParams.get('subcategory') || undefined
    } else {
      // Request body
      const body = await request.json()
      category = body.category
      preferenceKey = body.preferenceKey
      subcategory = body.subcategory
    }

    if (!category || !preferenceKey) {
      return NextResponse.json(
        { error: 'Category and preferenceKey are required', code: 'MISSING_REQUIRED_FIELDS' },
        { status: 400 }
      )
    }

    // Delete preference (revert to default)
    const result = await preferencesManager.deleteUserPreference(
      userId,
      category,
      preferenceKey,
      subcategory
    )

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          code: 'PREFERENCE_DELETE_FAILED'
        },
        { status: 500 }
      )
    }

    // Get default value from template
    const template = await preferencesManager.getPreferenceTemplate(
      category,
      preferenceKey,
      subcategory
    )

    const defaultValue = template ? template.default_value : null

    // Log preference reset
    await (supabase as any).from('auth_audit_logs').insert({
      event_type: 'preference_reset',
      event_category: 'preferences',
      user_id: userId,
      success: true,
      event_data: {
        category,
        subcategory,
        preference_key: preferenceKey,
        reverted_to_default: defaultValue
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Preference reset to default',
      category,
      preferenceKey,
      defaultValue
    })

  } catch (error) {
    console.error('Preference delete API error:', error)
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