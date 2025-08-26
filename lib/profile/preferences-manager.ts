/**
 * Hierarchical Preferences Management System
 * Epic 2 Story 2.7: User Profile Management & Preferences Infrastructure
 * 
 * Manages user preferences with inheritance, validation, and GDPR compliance.
 * Supports hierarchical preference inheritance from defaults and parent preferences.
 */

import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type { Database } from '@/lib/supabase/database.types'

// Type definitions
export interface UserPreference {
  id: string
  user_id: string
  category: string
  subcategory?: string
  preference_key: string
  preference_value: any
  inherits_from?: string
  is_inherited: boolean
  preference_type: 'user' | 'system' | 'business' | 'inherited'
  data_type: 'string' | 'number' | 'boolean' | 'json' | 'array'
  is_sensitive: boolean
  is_encrypted: boolean
  requires_consent: boolean
  consent_given: boolean
  consent_date?: string
  gdpr_category?: string
  retention_period?: string
  version: number
  created_at: string
  updated_at: string
  expires_at?: string
}

export interface PreferenceTemplate {
  id: string
  template_name: string
  display_name: string
  description?: string
  category: string
  subcategory?: string
  preference_key: string
  default_value: any
  data_type: 'string' | 'number' | 'boolean' | 'json' | 'array'
  validation_schema?: any
  allowed_values?: any[]
  is_required: boolean
  is_user_configurable: boolean
  requires_consent: boolean
  is_sensitive: boolean
  gdpr_category?: string
  retention_period?: string
  applies_to_roles?: string[]
  applies_to_user_types?: string[]
  conditional_logic?: any
  ui_component?: string
  ui_props?: any
  display_order: number
  is_visible: boolean
}

export interface PreferenceValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  sanitizedValue?: any
}

export interface PreferenceUpdateResult {
  success: boolean
  error?: string
  updatedPreference?: UserPreference
  validationResult?: PreferenceValidationResult
}

export interface BulkPreferenceUpdate {
  category: string
  subcategory?: string
  preferences: Record<string, any>
}

export interface PreferenceExportData {
  preferences: UserPreference[]
  templates: PreferenceTemplate[]
  exportMetadata: {
    userId: string
    exportDate: string
    totalPreferences: number
    categories: string[]
    gdprCategories: string[]
  }
}

/**
 * Hierarchical Preferences Manager
 * 
 * Handles complex preference management with inheritance, validation,
 * and GDPR compliance features.
 */
export class PreferencesManager {
  private supabase = createClient()

  /**
   * Get user preferences with inheritance resolution
   */
  async getUserPreferences(
    userId: string, 
    category?: string,
    includeInherited: boolean = true
  ): Promise<UserPreference[]> {
    try {
      if (includeInherited) {
        // Use database function for inheritance resolution
        const { data, error } = await this.supabase
          .rpc('get_user_preferences_with_inheritance', {
            user_uuid: userId,
            pref_category: category || null
          })

        if (error) throw error

        return data.map(this.mapPreferenceRow)
      } else {
        // Get only direct user preferences
        let query = this.supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', userId)
          .eq('is_inherited', false)

        if (category) {
          query = query.eq('category', category)
        }

        const { data, error } = await query.order('category', { ascending: true })
          .order('display_order', { ascending: true })

        if (error) throw error
        return data.map(this.mapPreferenceRow)
      }
    } catch (error) {
      console.error('Failed to get user preferences:', error)
      throw new Error('Failed to retrieve user preferences')
    }
  }

  /**
   * Get a specific user preference value
   */
  async getUserPreference(
    userId: string,
    category: string,
    preferenceKey: string,
    subcategory?: string
  ): Promise<any> {
    try {
      const preferences = await this.getUserPreferences(userId, category)
      
      const preference = preferences.find(p => 
        p.preference_key === preferenceKey && 
        (!subcategory || p.subcategory === subcategory)
      )

      if (preference) {
        return this.deserializePreferenceValue(preference.preference_value, preference.data_type)
      }

      // Fall back to template default
      const template = await this.getPreferenceTemplate(category, preferenceKey, subcategory)
      if (template) {
        return this.deserializePreferenceValue(template.default_value, template.data_type)
      }

      return null
    } catch (error) {
      console.error('Failed to get user preference:', error)
      throw new Error('Failed to retrieve user preference')
    }
  }

  /**
   * Update a user preference
   */
  async updateUserPreference(
    userId: string,
    category: string,
    preferenceKey: string,
    value: any,
    options: {
      subcategory?: string
      requiresConsent?: boolean
      changeReason?: string
      expiresAt?: string
    } = {}
  ): Promise<PreferenceUpdateResult> {
    try {
      // Get preference template for validation
      const template = await this.getPreferenceTemplate(
        category, 
        preferenceKey, 
        options.subcategory
      )

      if (!template) {
        return {
          success: false,
          error: 'Preference template not found'
        }
      }

      // Validate the new value
      const validationResult = await this.validatePreferenceValue(value, template)
      if (!validationResult.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validationResult.errors.join(', ')}`,
          validationResult
        }
      }

      // Check consent requirements
      if (template.requires_consent && options.requiresConsent !== true) {
        return {
          success: false,
          error: 'This preference requires explicit consent'
        }
      }

      // Serialize value for storage
      const serializedValue = this.serializePreferenceValue(
        validationResult.sanitizedValue ?? value, 
        template.data_type
      )

      // Check if preference already exists
      const { data: existingPref } = await this.supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .eq('category', category)
        .eq('preference_key', preferenceKey)
        .eq('subcategory', options.subcategory || null)
        .single()

      let result

      if (existingPref) {
        // Update existing preference
        const { data, error } = await this.supabase
          .from('user_preferences')
          .update({
            preference_value: serializedValue,
            previous_value: existingPref.preference_value,
            version: existingPref.version + 1,
            changed_by: userId,
            change_reason: options.changeReason,
            consent_given: template.requires_consent ? true : existingPref.consent_given,
            consent_date: template.requires_consent ? new Date().toISOString() : existingPref.consent_date,
            expires_at: options.expiresAt,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPref.id)
          .select()
          .single()

        if (error) throw error
        result = data
      } else {
        // Create new preference
        const { data, error } = await this.supabase
          .from('user_preferences')
          .insert({
            user_id: userId,
            category,
            subcategory: options.subcategory,
            preference_key: preferenceKey,
            preference_value: serializedValue,
            preference_type: 'user',
            data_type: template.data_type,
            is_sensitive: template.is_sensitive,
            requires_consent: template.requires_consent,
            consent_given: template.requires_consent ? true : false,
            consent_date: template.requires_consent ? new Date().toISOString() : null,
            gdpr_category: template.gdpr_category,
            retention_period: template.retention_period,
            changed_by: userId,
            change_reason: options.changeReason || 'User update',
            expires_at: options.expiresAt
          })
          .select()
          .single()

        if (error) throw error
        result = data
      }

      // Log the preference change
      await this.logPreferenceChange(userId, category, preferenceKey, {
        action: existingPref ? 'update' : 'create',
        oldValue: existingPref?.preference_value,
        newValue: serializedValue,
        changeReason: options.changeReason
      })

      return {
        success: true,
        updatedPreference: this.mapPreferenceRow(result),
        validationResult
      }

    } catch (error) {
      console.error('Failed to update user preference:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Bulk update user preferences
   */
  async bulkUpdateUserPreferences(
    userId: string,
    updates: BulkPreferenceUpdate[]
  ): Promise<{ success: boolean; results: PreferenceUpdateResult[]; errors: string[] }> {
    const results: PreferenceUpdateResult[] = []
    const errors: string[] = []

    try {
      // Process updates sequentially to maintain data integrity
      for (const update of updates) {
        for (const [key, value] of Object.entries(update.preferences)) {
          const result = await this.updateUserPreference(
            userId,
            update.category,
            key,
            value,
            { subcategory: update.subcategory }
          )

          results.push(result)

          if (!result.success) {
            errors.push(`${update.category}.${key}: ${result.error}`)
          }
        }
      }

      const successCount = results.filter(r => r.success).length
      const totalCount = results.length

      return {
        success: successCount === totalCount,
        results,
        errors
      }

    } catch (error) {
      console.error('Bulk preference update failed:', error)
      return {
        success: false,
        results,
        errors: [error instanceof Error ? error.message : 'Bulk update failed']
      }
    }
  }

  /**
   * Delete a user preference (revert to default)
   */
  async deleteUserPreference(
    userId: string,
    category: string,
    preferenceKey: string,
    subcategory?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('user_preferences')
        .delete()
        .eq('user_id', userId)
        .eq('category', category)
        .eq('preference_key', preferenceKey)
        .eq('subcategory', subcategory || null)

      if (error) throw error

      // Log the preference deletion
      await this.logPreferenceChange(userId, category, preferenceKey, {
        action: 'delete',
        changeReason: 'User reset to default'
      })

      return { success: true }

    } catch (error) {
      console.error('Failed to delete user preference:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get preference templates for a category
   */
  async getPreferenceTemplates(
    category?: string,
    userRoles?: string[]
  ): Promise<PreferenceTemplate[]> {
    try {
      let query = this.supabase
        .from('preference_templates')
        .select('*')
        .eq('is_visible', true)

      if (category) {
        query = query.eq('category', category)
      }

      const { data, error } = await query.order('display_order', { ascending: true })

      if (error) throw error

      // Filter by user roles if provided
      if (userRoles && userRoles.length > 0) {
        return data.filter(template => {
          if (!template.applies_to_roles) return true
          return template.applies_to_roles.some(role => userRoles.includes(role))
        })
      }

      return data
    } catch (error) {
      console.error('Failed to get preference templates:', error)
      throw new Error('Failed to retrieve preference templates')
    }
  }

  /**
   * Get a specific preference template
   */
  async getPreferenceTemplate(
    category: string,
    preferenceKey: string,
    subcategory?: string
  ): Promise<PreferenceTemplate | null> {
    try {
      const { data, error } = await this.supabase
        .from('preference_templates')
        .select('*')
        .eq('category', category)
        .eq('preference_key', preferenceKey)
        .eq('subcategory', subcategory || null)
        .single()

      if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows found

      return data
    } catch (error) {
      console.error('Failed to get preference template:', error)
      return null
    }
  }

  /**
   * Export user preferences for GDPR compliance
   */
  async exportUserPreferences(userId: string): Promise<PreferenceExportData> {
    try {
      // Get all user preferences
      const preferences = await this.getUserPreferences(userId)
      
      // Get relevant templates
      const categories = [...new Set(preferences.map(p => p.category))]
      const templates: PreferenceTemplate[] = []
      
      for (const category of categories) {
        const categoryTemplates = await this.getPreferenceTemplates(category)
        templates.push(...categoryTemplates)
      }

      // Build export metadata
      const gdprCategories = [...new Set(preferences
        .filter(p => p.gdpr_category)
        .map(p => p.gdpr_category!)
      )]

      return {
        preferences,
        templates,
        exportMetadata: {
          userId,
          exportDate: new Date().toISOString(),
          totalPreferences: preferences.length,
          categories,
          gdprCategories
        }
      }

    } catch (error) {
      console.error('Failed to export user preferences:', error)
      throw new Error('Failed to export user preferences')
    }
  }

  /**
   * Delete user preferences for GDPR compliance
   */
  async deleteUserPreferences(
    userId: string,
    categories?: string[],
    keepAnonymized: boolean = false
  ): Promise<{ success: boolean; deletedCount: number; error?: string }> {
    try {
      let query = this.supabase
        .from('user_preferences')
        .delete()
        .eq('user_id', userId)

      if (categories && categories.length > 0) {
        query = query.in('category', categories)
      }

      const { error, count } = await query

      if (error) throw error

      // Log GDPR deletion activity
      await this.supabase.from('gdpr_compliance_logs').insert({
        user_id: userId,
        activity_type: 'preferences_deletion',
        activity_description: 'User preferences deleted for GDPR compliance',
        compliance_requirement: 'right_to_be_forgotten',
        data_categories: categories || ['all_preferences'],
        data_volume: count || 0,
        automated: false,
        success: true,
        performed_by: userId
      })

      return {
        success: true,
        deletedCount: count || 0
      }

    } catch (error) {
      console.error('Failed to delete user preferences:', error)
      return {
        success: false,
        deletedCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Private helper methods

  private async validatePreferenceValue(
    value: any,
    template: PreferenceTemplate
  ): Promise<PreferenceValidationResult> {
    const result: PreferenceValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    }

    try {
      // Type validation
      const typeValidation = this.validateDataType(value, template.data_type)
      if (!typeValidation.isValid) {
        result.isValid = false
        result.errors.push(...typeValidation.errors)
      } else {
        result.sanitizedValue = typeValidation.sanitizedValue
      }

      // Schema validation
      if (template.validation_schema) {
        const schemaValidation = await this.validateAgainstSchema(
          result.sanitizedValue ?? value, 
          template.validation_schema
        )
        if (!schemaValidation.isValid) {
          result.isValid = false
          result.errors.push(...schemaValidation.errors)
        }
      }

      // Allowed values validation
      if (template.allowed_values && template.allowed_values.length > 0) {
        const currentValue = result.sanitizedValue ?? value
        if (!template.allowed_values.includes(currentValue)) {
          result.isValid = false
          result.errors.push(`Value must be one of: ${template.allowed_values.join(', ')}`)
        }
      }

      // Conditional logic validation
      if (template.conditional_logic) {
        const conditionalResult = await this.evaluateConditionalLogic(
          result.sanitizedValue ?? value,
          template.conditional_logic
        )
        if (!conditionalResult.isValid) {
          result.isValid = false
          result.errors.push(...conditionalResult.errors)
        }
        result.warnings.push(...conditionalResult.warnings)
      }

    } catch (error) {
      result.isValid = false
      result.errors.push('Validation error: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }

    return result
  }

  private validateDataType(
    value: any,
    dataType: string
  ): { isValid: boolean; errors: string[]; sanitizedValue?: any } {
    const result = { isValid: true, errors: [] as string[], sanitizedValue: value }

    switch (dataType) {
      case 'string':
        if (typeof value !== 'string') {
          result.sanitizedValue = String(value)
        }
        break

      case 'number':
        const numValue = Number(value)
        if (isNaN(numValue)) {
          result.isValid = false
          result.errors.push('Value must be a valid number')
        } else {
          result.sanitizedValue = numValue
        }
        break

      case 'boolean':
        if (typeof value !== 'boolean') {
          result.sanitizedValue = Boolean(value)
        }
        break

      case 'json':
        if (typeof value === 'string') {
          try {
            result.sanitizedValue = JSON.parse(value)
          } catch {
            result.isValid = false
            result.errors.push('Value must be valid JSON')
          }
        }
        break

      case 'array':
        if (!Array.isArray(value)) {
          if (typeof value === 'string') {
            try {
              const parsed = JSON.parse(value)
              if (Array.isArray(parsed)) {
                result.sanitizedValue = parsed
              } else {
                result.isValid = false
                result.errors.push('Value must be an array')
              }
            } catch {
              result.isValid = false
              result.errors.push('Value must be a valid array')
            }
          } else {
            result.isValid = false
            result.errors.push('Value must be an array')
          }
        }
        break

      default:
        result.warnings = ['Unknown data type, skipping type validation']
    }

    return result
  }

  private async validateAgainstSchema(
    value: any,
    schema: any
  ): Promise<{ isValid: boolean; errors: string[] }> {
    // Implement JSON schema validation if needed
    // For now, return valid
    return { isValid: true, errors: [] }
  }

  private async evaluateConditionalLogic(
    value: any,
    logic: any
  ): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    // Implement conditional logic evaluation
    // For now, return valid
    return { isValid: true, errors: [], warnings: [] }
  }

  private serializePreferenceValue(value: any, dataType: string): any {
    switch (dataType) {
      case 'json':
      case 'array':
        return typeof value === 'string' ? value : JSON.stringify(value)
      default:
        return value
    }
  }

  private deserializePreferenceValue(value: any, dataType: string): any {
    switch (dataType) {
      case 'json':
      case 'array':
        return typeof value === 'string' ? JSON.parse(value) : value
      case 'number':
        return Number(value)
      case 'boolean':
        return Boolean(value)
      default:
        return value
    }
  }

  private mapPreferenceRow(row: any): UserPreference {
    return {
      id: row.id,
      user_id: row.user_id,
      category: row.category,
      subcategory: row.subcategory,
      preference_key: row.preference_key,
      preference_value: row.preference_value,
      inherits_from: row.inherits_from,
      is_inherited: row.is_inherited,
      preference_type: row.preference_type || 'user',
      data_type: row.data_type || 'json',
      is_sensitive: row.is_sensitive || false,
      is_encrypted: row.is_encrypted || false,
      requires_consent: row.requires_consent || false,
      consent_given: row.consent_given || false,
      consent_date: row.consent_date,
      gdpr_category: row.gdpr_category,
      retention_period: row.retention_period,
      version: row.version || 1,
      created_at: row.created_at,
      updated_at: row.updated_at,
      expires_at: row.expires_at
    }
  }

  private async logPreferenceChange(
    userId: string,
    category: string,
    preferenceKey: string,
    details: {
      action: 'create' | 'update' | 'delete'
      oldValue?: any
      newValue?: any
      changeReason?: string
    }
  ): Promise<void> {
    try {
      await (this.supabase as any).from('auth_audit_logs').insert({
        event_type: 'preference_change',
        event_category: 'preferences',
        user_id: userId,
        success: true,
        event_data: {
          category,
          preference_key: preferenceKey,
          action: details.action,
          old_value: details.oldValue,
          new_value: details.newValue,
          change_reason: details.changeReason
        }
      })
    } catch (error) {
      console.error('Failed to log preference change:', error)
      // Non-critical error, continue execution
    }
  }
}

// Cached preferences manager instance
export const preferencesManager = new PreferencesManager()

// React cache for frequently accessed preferences
export const getCachedUserPreferences = cache(async (userId: string, category?: string) => {
  return preferencesManager.getUserPreferences(userId, category)
})

export const getCachedUserPreference = cache(async (
  userId: string,
  category: string,
  preferenceKey: string,
  subcategory?: string
) => {
  return preferencesManager.getUserPreference(userId, category, preferenceKey, subcategory)
})

// Utility functions for common preference operations
export async function getNotificationPreferences(userId: string) {
  return getCachedUserPreferences(userId, 'notifications')
}

export async function getPrivacyPreferences(userId: string) {
  return getCachedUserPreferences(userId, 'privacy')
}

export async function getUIPreferences(userId: string) {
  return getCachedUserPreferences(userId, 'ui')
}

export async function getBusinessPreferences(userId: string) {
  return getCachedUserPreferences(userId, 'business')
}