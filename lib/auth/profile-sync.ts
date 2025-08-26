/**
 * Profile Data Synchronization Manager
 * Epic 2 Story 2.3: Social Media Login Integration
 * 
 * Handles synchronization of user profile data from OAuth providers,
 * conflict resolution, and data preferences management.
 */

import { createClient } from '@/lib/supabase/server'
import { OAuthProvider } from './oauth-config'

export interface ProfileSyncOptions {
  overwriteExisting?: boolean
  preserveUserChanges?: boolean
  syncFields?: string[]
  excludeFields?: string[]
}

export interface ProfileSyncResult {
  success: boolean
  error?: string
  updatedFields?: string[]
  conflicts?: ProfileConflict[]
}

export interface ProfileConflict {
  field: string
  currentValue: any
  providerValue: any
  provider: OAuthProvider
  autoResolved?: boolean
  resolution?: 'keep_current' | 'use_provider' | 'manual'
}

export interface ProviderProfileData {
  name?: string
  display_name?: string
  first_name?: string
  last_name?: string
  email?: string
  avatar_url?: string
  bio?: string
  location?: string
  website?: string
  username?: string
  phone_number?: string
  social_links?: Record<string, any>
  locale?: string
  timezone?: string
  verified_email?: boolean
  [key: string]: any
}

/**
 * Profile Data Synchronization Manager
 */
export class ProfileSyncManager {
  private supabase = createClient()

  /**
   * Sync profile data from OAuth provider
   */
  async syncProviderProfile(
    userId: string,
    provider: OAuthProvider,
    providerData: ProviderProfileData,
    options: ProfileSyncOptions = {}
  ): Promise<ProfileSyncResult> {
    try {
      // Get current profile data
      const { data: currentProfile, error: profileError } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (profileError || !currentProfile) {
        return { success: false, error: 'User profile not found' }
      }

      // Get user's sync preferences
      const syncPreferences = await this.getUserSyncPreferences(userId)
      
      // Merge options with user preferences
      const finalOptions: ProfileSyncOptions = {
        overwriteExisting: false,
        preserveUserChanges: true,
        ...syncPreferences,
        ...options
      }

      // Normalize provider data
      const normalizedData = this.normalizeProviderData(provider, providerData)
      
      // Determine fields to sync
      const fieldsToSync = this.getFieldsToSync(normalizedData, finalOptions)
      
      // Detect conflicts
      const conflicts = this.detectConflicts(
        currentProfile,
        normalizedData,
        provider,
        fieldsToSync
      )

      // Resolve conflicts automatically where possible
      const resolvedData = await this.resolveConflicts(
        currentProfile,
        normalizedData,
        conflicts,
        finalOptions
      )

      // Prepare update data
      const updateData = this.prepareUpdateData(resolvedData, fieldsToSync)
      
      if (Object.keys(updateData).length === 0) {
        return {
          success: true,
          updatedFields: [],
          conflicts: conflicts.filter(c => !c.autoResolved)
        }
      }

      // Update profile
      const { error: updateError } = await this.supabase
        .from('profiles')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        console.error('Profile sync update error:', updateError)
        return { success: false, error: 'Failed to update profile' }
      }

      // Update sync history
      await this.recordSyncHistory(userId, provider, {
        synced_fields: Object.keys(updateData),
        conflicts: conflicts.length,
        auto_resolved: conflicts.filter(c => c.autoResolved).length
      })

      // Log sync event
      await this.logSyncEvent({
        userId,
        provider,
        success: true,
        updatedFields: Object.keys(updateData),
        conflictsCount: conflicts.length
      })

      return {
        success: true,
        updatedFields: Object.keys(updateData),
        conflicts: conflicts.filter(c => !c.autoResolved)
      }

    } catch (error) {
      console.error('Profile sync error:', error)
      
      await this.logSyncEvent({
        userId,
        provider,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Profile sync failed'
      }
    }
  }

  /**
   * Get user's profile sync preferences
   */
  async getUserSyncPreferences(userId: string): Promise<ProfileSyncOptions> {
    try {
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('preferences')
        .eq('id', userId)
        .single()

      const preferences = profile?.preferences || {}
      const syncPrefs = preferences.profile_sync || {}

      return {
        overwriteExisting: syncPrefs.overwrite_existing ?? false,
        preserveUserChanges: syncPrefs.preserve_user_changes ?? true,
        syncFields: syncPrefs.sync_fields,
        excludeFields: syncPrefs.exclude_fields || ['email'] // Never sync email by default
      }
    } catch (error) {
      console.error('Failed to get sync preferences:', error)
      return {
        overwriteExisting: false,
        preserveUserChanges: true,
        excludeFields: ['email']
      }
    }
  }

  /**
   * Update user's profile sync preferences
   */
  async updateSyncPreferences(
    userId: string,
    preferences: Partial<ProfileSyncOptions>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: currentProfile } = await this.supabase
        .from('profiles')
        .select('preferences')
        .eq('id', userId)
        .single()

      const currentPreferences = currentProfile?.preferences || {}
      const updatedPreferences = {
        ...currentPreferences,
        profile_sync: {
          ...currentPreferences.profile_sync,
          ...preferences
        }
      }

      const { error } = await this.supabase
        .from('profiles')
        .update({
          preferences: updatedPreferences,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) {
        return { success: false, error: 'Failed to update sync preferences' }
      }

      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Manually resolve profile conflicts
   */
  async resolveProfileConflict(
    userId: string,
    field: string,
    resolution: 'keep_current' | 'use_provider',
    providerValue?: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (resolution === 'use_provider' && providerValue !== undefined) {
        const updateData = { [field]: providerValue }
        
        const { error } = await this.supabase
          .from('profiles')
          .update({
            ...updateData,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)

        if (error) {
          return { success: false, error: 'Failed to resolve conflict' }
        }
      }

      // Record resolution
      await this.recordConflictResolution(userId, field, resolution, providerValue)

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Conflict resolution failed'
      }
    }
  }

  /**
   * Get profile sync history for user
   */
  async getSyncHistory(userId: string, limit: number = 10) {
    try {
      const { data, error } = await this.supabase
        .from('profile_sync_history')
        .select('*')
        .eq('user_id', userId)
        .order('synced_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Failed to get sync history:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Sync history error:', error)
      return []
    }
  }

  // Private methods

  private normalizeProviderData(
    provider: OAuthProvider, 
    providerData: ProviderProfileData
  ): ProviderProfileData {
    const normalized: ProviderProfileData = {}

    switch (provider) {
      case 'google':
        normalized.display_name = providerData.name
        normalized.first_name = providerData.given_name
        normalized.last_name = providerData.family_name
        normalized.email = providerData.email
        normalized.avatar_url = providerData.picture
        normalized.verified_email = providerData.verified_email
        normalized.locale = providerData.locale
        break

      case 'facebook':
        normalized.display_name = providerData.name
        normalized.first_name = providerData.first_name
        normalized.last_name = providerData.last_name
        normalized.email = providerData.email
        normalized.avatar_url = providerData.picture
        break

      case 'github':
        normalized.display_name = providerData.name || providerData.login
        normalized.username = providerData.login
        normalized.email = providerData.email
        normalized.avatar_url = providerData.avatar_url
        normalized.bio = providerData.bio
        normalized.location = providerData.location
        normalized.website = providerData.blog || providerData.html_url
        normalized.social_links = {
          github: providerData.html_url
        }
        break

      case 'apple':
        if (providerData.name) {
          normalized.display_name = providerData.name
          normalized.first_name = providerData.name.split(' ')[0]
          normalized.last_name = providerData.name.split(' ').slice(1).join(' ')
        }
        normalized.email = providerData.email
        normalized.verified_email = providerData.email_verified
        break

      default:
        // Copy all fields as-is for unknown providers
        Object.assign(normalized, providerData)
    }

    return normalized
  }

  private getFieldsToSync(
    normalizedData: ProviderProfileData,
    options: ProfileSyncOptions
  ): string[] {
    const availableFields = Object.keys(normalizedData).filter(field => 
      normalizedData[field] !== undefined && normalizedData[field] !== null
    )

    let fieldsToSync = availableFields

    if (options.syncFields) {
      fieldsToSync = fieldsToSync.filter(field => options.syncFields!.includes(field))
    }

    if (options.excludeFields) {
      fieldsToSync = fieldsToSync.filter(field => !options.excludeFields!.includes(field))
    }

    return fieldsToSync
  }

  private detectConflicts(
    currentProfile: any,
    normalizedData: ProviderProfileData,
    provider: OAuthProvider,
    fieldsToSync: string[]
  ): ProfileConflict[] {
    const conflicts: ProfileConflict[] = []

    for (const field of fieldsToSync) {
      const currentValue = currentProfile[field]
      const providerValue = normalizedData[field]

      if (currentValue && currentValue !== providerValue && providerValue) {
        // Special handling for certain fields
        if (field === 'avatar_url' && this.isPlaceholderAvatar(currentValue)) {
          // Don't create conflict for placeholder avatars
          continue
        }

        if (field === 'display_name' && !currentProfile.display_name_user_set) {
          // Don't create conflict if user hasn't manually set display name
          continue
        }

        conflicts.push({
          field,
          currentValue,
          providerValue,
          provider,
          autoResolved: false
        })
      }
    }

    return conflicts
  }

  private async resolveConflicts(
    currentProfile: any,
    normalizedData: ProviderProfileData,
    conflicts: ProfileConflict[],
    options: ProfileSyncOptions
  ): Promise<ProviderProfileData> {
    const resolvedData = { ...normalizedData }

    for (const conflict of conflicts) {
      if (options.preserveUserChanges && currentProfile[`${conflict.field}_user_set`]) {
        // User has explicitly set this field, keep current value
        resolvedData[conflict.field] = conflict.currentValue
        conflict.autoResolved = true
        conflict.resolution = 'keep_current'
      } else if (options.overwriteExisting) {
        // Overwrite with provider value
        conflict.autoResolved = true
        conflict.resolution = 'use_provider'
      } else {
        // Apply auto-resolution rules
        const resolution = this.getAutoResolutionRule(conflict)
        if (resolution) {
          if (resolution === 'keep_current') {
            resolvedData[conflict.field] = conflict.currentValue
          }
          conflict.autoResolved = true
          conflict.resolution = resolution
        }
      }
    }

    return resolvedData
  }

  private getAutoResolutionRule(conflict: ProfileConflict): 'keep_current' | 'use_provider' | null {
    switch (conflict.field) {
      case 'avatar_url':
        // Prefer provider avatar if current is placeholder
        if (this.isPlaceholderAvatar(conflict.currentValue)) {
          return 'use_provider'
        }
        // Prefer higher quality images (heuristic based on URL)
        if (this.isHigherQualityImage(conflict.providerValue, conflict.currentValue)) {
          return 'use_provider'
        }
        return 'keep_current'

      case 'location':
        // Prefer more specific location (more words usually means more specific)
        if (conflict.providerValue.split(' ').length > conflict.currentValue.split(' ').length) {
          return 'use_provider'
        }
        return 'keep_current'

      case 'bio':
        // Prefer longer, more descriptive bio
        if (conflict.providerValue.length > conflict.currentValue.length * 1.5) {
          return 'use_provider'
        }
        return 'keep_current'

      default:
        return null // Requires manual resolution
    }
  }

  private prepareUpdateData(resolvedData: ProviderProfileData, fieldsToSync: string[]): any {
    const updateData: any = {}

    for (const field of fieldsToSync) {
      if (resolvedData[field] !== undefined) {
        updateData[field] = resolvedData[field]
      }
    }

    return updateData
  }

  private isPlaceholderAvatar(url: string): boolean {
    if (!url) return true
    
    const placeholderPatterns = [
      'placeholder',
      'default-avatar',
      'gravatar.com/avatar/00000',
      'ui-avatars.com',
      'robohash.org',
      'identicon'
    ]

    return placeholderPatterns.some(pattern => url.toLowerCase().includes(pattern))
  }

  private isHigherQualityImage(newUrl: string, currentUrl: string): boolean {
    // Simple heuristic: larger size parameter usually means higher quality
    const newSizeMatch = newUrl.match(/[?&]s(?:ize)?=(\d+)/i)
    const currentSizeMatch = currentUrl.match(/[?&]s(?:ize)?=(\d+)/i)
    
    if (newSizeMatch && currentSizeMatch) {
      return parseInt(newSizeMatch[1]) > parseInt(currentSizeMatch[1])
    }

    // Prefer URLs with 'large' or high DPI indicators
    const qualityIndicators = ['large', '2x', 'hd', 'high']
    const newHasQuality = qualityIndicators.some(q => newUrl.toLowerCase().includes(q))
    const currentHasQuality = qualityIndicators.some(q => currentUrl.toLowerCase().includes(q))
    
    return newHasQuality && !currentHasQuality
  }

  private async recordSyncHistory(
    userId: string,
    provider: OAuthProvider,
    syncData: any
  ): Promise<void> {
    try {
      // First, create the table if it doesn't exist (in a real migration)
      await this.supabase.rpc('ensure_profile_sync_history_table')
      
      await this.supabase
        .from('profile_sync_history')
        .insert({
          user_id: userId,
          provider: provider,
          sync_data: syncData,
          synced_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('Failed to record sync history:', error)
    }
  }

  private async recordConflictResolution(
    userId: string,
    field: string,
    resolution: string,
    value?: any
  ): Promise<void> {
    try {
      await this.supabase
        .from('profile_conflict_resolutions')
        .insert({
          user_id: userId,
          field_name: field,
          resolution_type: resolution,
          resolved_value: value,
          resolved_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('Failed to record conflict resolution:', error)
    }
  }

  private async logSyncEvent({
    userId,
    provider,
    success,
    error,
    updatedFields,
    conflictsCount
  }: {
    userId: string
    provider: OAuthProvider
    success: boolean
    error?: string
    updatedFields?: string[]
    conflictsCount?: number
  }): Promise<void> {
    try {
      await this.supabase.from('auth_audit_logs').insert({
        event_type: 'profile_sync',
        event_category: 'profile',
        user_id: userId,
        success,
        failure_reason: error,
        event_data: {
          provider,
          updated_fields: updatedFields,
          conflicts_count: conflictsCount
        }
      })
    } catch (logError) {
      console.error('Failed to log sync event:', logError)
    }
  }
}

/**
 * Utility functions for profile synchronization
 */
export const profileSync = new ProfileSyncManager()

/**
 * Batch sync profiles for multiple users (admin function)
 */
export async function batchSyncProfiles(
  userIds: string[],
  provider: OAuthProvider,
  options: ProfileSyncOptions = {}
): Promise<{ success: number; failed: number; errors: string[] }> {
  let success = 0
  let failed = 0
  const errors: string[] = []

  for (const userId of userIds) {
    try {
      // Get user's OAuth connection data
      const supabase = createClient()
      const { data: connection } = await supabase
        .from('user_oauth_connections')
        .select('provider_data')
        .eq('user_id', userId)
        .eq('provider_name', provider)
        .is('disconnected_at', null)
        .single()

      if (connection) {
        const result = await profileSync.syncProviderProfile(
          userId,
          provider,
          connection.provider_data,
          options
        )

        if (result.success) {
          success++
        } else {
          failed++
          errors.push(`User ${userId}: ${result.error}`)
        }
      } else {
        failed++
        errors.push(`User ${userId}: No ${provider} connection found`)
      }
    } catch (error) {
      failed++
      errors.push(`User ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return { success, failed, errors }
}