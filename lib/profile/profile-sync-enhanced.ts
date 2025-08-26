/**
 * Enhanced Profile Synchronization System
 * Epic 2 Story 2.7: User Profile Management & Preferences Infrastructure
 * 
 * Extended profile synchronization with advanced conflict resolution,
 * preference integration, and comprehensive audit logging.
 */

import { createClient } from '@/lib/supabase/server'
import { ProfileSyncManager, ProviderProfileData, ProfileConflict, ProfileSyncResult, ProfileSyncOptions } from '@/lib/auth/profile-sync'
import { preferencesManager } from './preferences-manager'
import { fileManager } from './file-manager'
import { OAuthProvider } from '@/lib/auth/oauth-config'
import { cache } from 'react'

// Enhanced interfaces for comprehensive profile sync
export interface EnhancedProfileSyncOptions extends ProfileSyncOptions {
  syncAvatars?: boolean
  downloadAvatars?: boolean
  syncPrivacySettings?: boolean
  updatePreferences?: boolean
  enableSmartConflictResolution?: boolean
  auditLevel?: 'basic' | 'detailed' | 'comprehensive'
}

export interface EnhancedProfileSyncResult extends ProfileSyncResult {
  avatarSyncResult?: AvatarSyncResult
  preferencesSyncResult?: PreferencesSyncResult
  privacySyncResult?: PrivacySyncResult
  auditTrail?: SyncAuditEntry[]
  recommendations?: SyncRecommendation[]
  profileCompletionDelta?: {
    before: number
    after: number
    improvement: number
  }
}

export interface AvatarSyncResult {
  success: boolean
  downloaded: boolean
  fileId?: string
  error?: string
  previousAvatar?: string
  newAvatar?: string
}

export interface PreferencesSyncResult {
  success: boolean
  updatedPreferences: string[]
  conflicts: string[]
  error?: string
}

export interface PrivacySyncResult {
  success: boolean
  updatedSettings: string[]
  warnings: string[]
  error?: string
}

export interface SyncAuditEntry {
  timestamp: string
  action: string
  field?: string
  oldValue?: any
  newValue?: any
  source: 'provider' | 'user' | 'system'
  confidence: number // 0-100
  reasoning: string
}

export interface SyncRecommendation {
  type: 'privacy' | 'completion' | 'verification' | 'security'
  priority: 'low' | 'medium' | 'high'
  title: string
  description: string
  action?: string
  actionUrl?: string
}

export interface ProviderCapabilities {
  providesEmail: boolean
  providesName: boolean
  providesAvatar: boolean
  providesBio: boolean
  providesLocation: boolean
  providesWebsite: boolean
  providesPhone: boolean
  providesBirthdate: boolean
  providesGender: boolean
  providesLanguage: boolean
  providesTimezone: boolean
  dataQuality: 'low' | 'medium' | 'high'
  updateFrequency: 'static' | 'occasional' | 'frequent'
}

/**
 * Enhanced Profile Synchronization Manager
 * 
 * Extends the basic ProfileSyncManager with advanced features including
 * avatar synchronization, preference integration, and intelligent conflict resolution.
 */
export class EnhancedProfileSyncManager extends ProfileSyncManager {
  private supabase = createClient()

  // Provider capability mappings
  private static readonly PROVIDER_CAPABILITIES: Record<OAuthProvider, ProviderCapabilities> = {
    google: {
      providesEmail: true,
      providesName: true,
      providesAvatar: true,
      providesBio: false,
      providesLocation: false,
      providesWebsite: false,
      providesPhone: false,
      providesBirthdate: false,
      providesGender: false,
      providesLanguage: true,
      providesTimezone: true,
      dataQuality: 'high',
      updateFrequency: 'frequent'
    },
    facebook: {
      providesEmail: true,
      providesName: true,
      providesAvatar: true,
      providesBio: true,
      providesLocation: true,
      providesWebsite: true,
      providesPhone: false,
      providesBirthdate: true,
      providesGender: true,
      providesLanguage: true,
      providesTimezone: true,
      dataQuality: 'medium',
      updateFrequency: 'occasional'
    },
    github: {
      providesEmail: true,
      providesName: true,
      providesAvatar: true,
      providesBio: true,
      providesLocation: true,
      providesWebsite: true,
      providesPhone: false,
      providesBirthdate: false,
      providesGender: false,
      providesLanguage: false,
      providesTimezone: false,
      dataQuality: 'medium',
      updateFrequency: 'frequent'
    },
    apple: {
      providesEmail: true,
      providesName: true,
      providesAvatar: false,
      providesBio: false,
      providesLocation: false,
      providesWebsite: false,
      providesPhone: false,
      providesBirthdate: false,
      providesGender: false,
      providesLanguage: false,
      providesTimezone: false,
      dataQuality: 'high',
      updateFrequency: 'static'
    }
  }

  /**
   * Enhanced profile synchronization with comprehensive features
   */
  async syncProviderProfileEnhanced(
    userId: string,
    provider: OAuthProvider,
    providerData: ProviderProfileData,
    options: EnhancedProfileSyncOptions = {}
  ): Promise<EnhancedProfileSyncResult> {
    const auditTrail: SyncAuditEntry[] = []
    const recommendations: SyncRecommendation[] = []

    try {
      // Record sync start
      auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'sync_started',
        source: 'system',
        confidence: 100,
        reasoning: `Profile sync initiated for provider ${provider}`
      })

      // Get current profile completion score
      const { data: beforeCompletion } = await this.supabase
        .rpc('calculate_profile_completion_score', { user_uuid: userId })
        .single()

      // Enhanced options with defaults
      const enhancedOptions: EnhancedProfileSyncOptions = {
        syncAvatars: true,
        downloadAvatars: true,
        syncPrivacySettings: false,
        updatePreferences: true,
        enableSmartConflictResolution: true,
        auditLevel: 'detailed',
        ...options
      }

      // Perform basic profile sync
      const basicSyncResult = await super.syncProviderProfile(
        userId,
        provider,
        providerData,
        enhancedOptions
      )

      auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'basic_sync_completed',
        source: 'system',
        confidence: basicSyncResult.success ? 100 : 0,
        reasoning: basicSyncResult.success ? 'Basic profile sync successful' : `Basic sync failed: ${basicSyncResult.error}`
      })

      // Enhanced synchronization features
      let avatarSyncResult: AvatarSyncResult | undefined
      let preferencesSyncResult: PreferencesSyncResult | undefined
      let privacySyncResult: PrivacySyncResult | undefined

      // Avatar synchronization
      if (enhancedOptions.syncAvatars && providerData.avatar_url) {
        avatarSyncResult = await this.syncProviderAvatar(
          userId,
          provider,
          providerData.avatar_url,
          enhancedOptions,
          auditTrail
        )

        if (avatarSyncResult.success) {
          recommendations.push({
            type: 'completion',
            priority: 'low',
            title: 'Profile Avatar Updated',
            description: `Your profile avatar has been updated from your ${provider} account.`,
          })
        }
      }

      // Preferences synchronization
      if (enhancedOptions.updatePreferences) {
        preferencesSyncResult = await this.syncProviderPreferences(
          userId,
          provider,
          providerData,
          enhancedOptions,
          auditTrail
        )
      }

      // Privacy settings synchronization
      if (enhancedOptions.syncPrivacySettings) {
        privacySyncResult = await this.syncProviderPrivacySettings(
          userId,
          provider,
          providerData,
          enhancedOptions,
          auditTrail
        )
      }

      // Smart conflict resolution
      if (enhancedOptions.enableSmartConflictResolution && basicSyncResult.conflicts) {
        await this.applySmartConflictResolution(
          userId,
          provider,
          basicSyncResult.conflicts,
          auditTrail
        )
      }

      // Generate recommendations
      recommendations.push(...await this.generateSyncRecommendations(
        userId,
        provider,
        providerData,
        basicSyncResult
      ))

      // Calculate profile completion improvement
      const { data: afterCompletion } = await this.supabase
        .rpc('calculate_profile_completion_score', { user_uuid: userId })
        .single()

      const profileCompletionDelta = {
        before: beforeCompletion?.score || 0,
        after: afterCompletion?.score || 0,
        improvement: (afterCompletion?.score || 0) - (beforeCompletion?.score || 0)
      }

      auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'sync_completed',
        source: 'system',
        confidence: 100,
        reasoning: `Profile sync completed. Completion score improved by ${profileCompletionDelta.improvement} points`
      })

      // Record comprehensive sync history
      await this.recordEnhancedSyncHistory(
        userId,
        provider,
        {
          ...basicSyncResult,
          avatarSyncResult,
          preferencesSyncResult,
          privacySyncResult,
          auditTrail,
          recommendations,
          profileCompletionDelta
        }
      )

      return {
        ...basicSyncResult,
        avatarSyncResult,
        preferencesSyncResult,
        privacySyncResult,
        auditTrail,
        recommendations,
        profileCompletionDelta
      }

    } catch (error) {
      console.error('Enhanced profile sync failed:', error)

      auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'sync_failed',
        source: 'system',
        confidence: 0,
        reasoning: `Sync failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Enhanced sync failed',
        auditTrail,
        recommendations
      }
    }
  }

  /**
   * Synchronize provider avatar
   */
  private async syncProviderAvatar(
    userId: string,
    provider: OAuthProvider,
    avatarUrl: string,
    options: EnhancedProfileSyncOptions,
    auditTrail: SyncAuditEntry[]
  ): Promise<AvatarSyncResult> {
    try {
      auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'avatar_sync_started',
        source: 'provider',
        confidence: 90,
        reasoning: `Starting avatar sync from ${provider}`,
        newValue: avatarUrl
      })

      // Get current profile to check existing avatar
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', userId)
        .single()

      const currentAvatar = profile?.avatar_url

      // Check if we should download the avatar
      if (!options.downloadAvatars) {
        // Just update the URL reference
        const { error } = await this.supabase
          .from('profiles')
          .update({ 
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)

        if (error) throw error

        auditTrail.push({
          timestamp: new Date().toISOString(),
          action: 'avatar_url_updated',
          source: 'provider',
          confidence: 100,
          reasoning: 'Avatar URL updated without downloading',
          oldValue: currentAvatar,
          newValue: avatarUrl
        })

        return {
          success: true,
          downloaded: false,
          previousAvatar: currentAvatar,
          newAvatar: avatarUrl
        }
      }

      // Download and upload avatar
      try {
        const response = await fetch(avatarUrl)
        if (!response.ok) {
          throw new Error(`Failed to download avatar: ${response.statusText}`)
        }

        const avatarBuffer = Buffer.from(await response.arrayBuffer())
        const fileName = `avatar_${provider}_${Date.now()}.jpg`

        // Upload avatar using file manager
        const uploadResult = await fileManager.uploadFile(
          userId,
          avatarBuffer,
          fileName,
          'avatar',
          {
            makePublic: true,
            metadata: {
              source: 'provider_sync',
              provider: provider,
              original_url: avatarUrl
            }
          }
        )

        if (!uploadResult.success || !uploadResult.file) {
          throw new Error(uploadResult.error || 'Avatar upload failed')
        }

        // Update profile with new avatar
        const publicUrl = uploadResult.file.public_url
        const { error: updateError } = await this.supabase
          .from('profiles')
          .update({ 
            avatar_url: publicUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)

        if (updateError) throw updateError

        auditTrail.push({
          timestamp: new Date().toISOString(),
          action: 'avatar_downloaded_updated',
          source: 'provider',
          confidence: 100,
          reasoning: 'Avatar downloaded and profile updated',
          oldValue: currentAvatar,
          newValue: publicUrl
        })

        return {
          success: true,
          downloaded: true,
          fileId: uploadResult.file.id,
          previousAvatar: currentAvatar,
          newAvatar: publicUrl
        }

      } catch (downloadError) {
        // Fallback to URL reference if download fails
        const { error } = await this.supabase
          .from('profiles')
          .update({ 
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)

        if (error) throw error

        auditTrail.push({
          timestamp: new Date().toISOString(),
          action: 'avatar_download_failed_fallback',
          source: 'provider',
          confidence: 50,
          reasoning: `Avatar download failed, using URL reference: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`,
          oldValue: currentAvatar,
          newValue: avatarUrl
        })

        return {
          success: true,
          downloaded: false,
          error: `Download failed: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`,
          previousAvatar: currentAvatar,
          newAvatar: avatarUrl
        }
      }

    } catch (error) {
      auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'avatar_sync_failed',
        source: 'system',
        confidence: 0,
        reasoning: `Avatar sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      })

      return {
        success: false,
        downloaded: false,
        error: error instanceof Error ? error.message : 'Avatar sync failed'
      }
    }
  }

  /**
   * Synchronize provider preferences
   */
  private async syncProviderPreferences(
    userId: string,
    provider: OAuthProvider,
    providerData: ProviderProfileData,
    options: EnhancedProfileSyncOptions,
    auditTrail: SyncAuditEntry[]
  ): Promise<PreferencesSyncResult> {
    const updatedPreferences: string[] = []
    const conflicts: string[] = []

    try {
      auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'preferences_sync_started',
        source: 'provider',
        confidence: 80,
        reasoning: `Starting preference sync from ${provider}`
      })

      // Language preference
      if (providerData.locale) {
        const language = providerData.locale.split('-')[0] // Extract language code
        const result = await preferencesManager.updateUserPreference(
          userId,
          'ui',
          'language',
          language,
          { subcategory: 'localization', changeReason: `Synced from ${provider}` }
        )

        if (result.success) {
          updatedPreferences.push('ui.language')
          auditTrail.push({
            timestamp: new Date().toISOString(),
            action: 'preference_updated',
            field: 'ui.language',
            source: 'provider',
            confidence: 90,
            reasoning: `Language preference updated from ${provider}`,
            newValue: language
          })
        } else {
          conflicts.push('ui.language')
        }
      }

      // Timezone preference
      if (providerData.timezone) {
        const result = await preferencesManager.updateUserPreference(
          userId,
          'ui',
          'timezone',
          providerData.timezone,
          { subcategory: 'localization', changeReason: `Synced from ${provider}` }
        )

        if (result.success) {
          updatedPreferences.push('ui.timezone')
          auditTrail.push({
            timestamp: new Date().toISOString(),
            action: 'preference_updated',
            field: 'ui.timezone',
            source: 'provider',
            confidence: 85,
            reasoning: `Timezone preference updated from ${provider}`,
            newValue: providerData.timezone
          })
        } else {
          conflicts.push('ui.timezone')
        }
      }

      // Email verification status
      if (providerData.verified_email !== undefined) {
        // This updates profile, not preferences, but tracks in preferences sync
        const { error } = await this.supabase
          .from('profiles')
          .update({ 
            email_verified: providerData.verified_email,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)

        if (!error) {
          updatedPreferences.push('profile.email_verified')
          auditTrail.push({
            timestamp: new Date().toISOString(),
            action: 'email_verification_updated',
            field: 'profile.email_verified',
            source: 'provider',
            confidence: 100,
            reasoning: `Email verification status updated from ${provider}`,
            newValue: providerData.verified_email
          })
        }
      }

      auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'preferences_sync_completed',
        source: 'system',
        confidence: 100,
        reasoning: `Preferences sync completed. Updated: ${updatedPreferences.length}, Conflicts: ${conflicts.length}`
      })

      return {
        success: true,
        updatedPreferences,
        conflicts
      }

    } catch (error) {
      auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'preferences_sync_failed',
        source: 'system',
        confidence: 0,
        reasoning: `Preferences sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      })

      return {
        success: false,
        updatedPreferences,
        conflicts,
        error: error instanceof Error ? error.message : 'Preferences sync failed'
      }
    }
  }

  /**
   * Synchronize provider privacy settings
   */
  private async syncProviderPrivacySettings(
    userId: string,
    provider: OAuthProvider,
    providerData: ProviderProfileData,
    options: EnhancedProfileSyncOptions,
    auditTrail: SyncAuditEntry[]
  ): Promise<PrivacySyncResult> {
    const updatedSettings: string[] = []
    const warnings: string[] = []

    try {
      auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'privacy_sync_started',
        source: 'provider',
        confidence: 70,
        reasoning: `Starting privacy settings sync from ${provider}`
      })

      // Provider-specific privacy setting mappings
      const capabilities = EnhancedProfileSyncManager.PROVIDER_CAPABILITIES[provider]
      
      if (capabilities.providesEmail && providerData.email) {
        // Update email visibility based on provider verification
        const showEmail = providerData.verified_email === true
        const result = await preferencesManager.updateUserPreference(
          userId,
          'privacy',
          'show_contact',
          showEmail,
          { subcategory: 'profile', changeReason: `Privacy sync from ${provider}` }
        )

        if (result.success) {
          updatedSettings.push('privacy.show_contact')
          auditTrail.push({
            timestamp: new Date().toISOString(),
            action: 'privacy_setting_updated',
            field: 'privacy.show_contact',
            source: 'provider',
            confidence: 80,
            reasoning: `Email visibility updated based on ${provider} verification status`,
            newValue: showEmail
          })
        }
      }

      // Set profile visibility based on provider data completeness
      const dataCompleteness = this.calculateProviderDataCompleteness(providerData, capabilities)
      if (dataCompleteness > 0.7) {
        const result = await preferencesManager.updateUserPreference(
          userId,
          'privacy',
          'visibility',
          'public',
          { subcategory: 'profile', changeReason: `Profile appears complete from ${provider}` }
        )

        if (result.success) {
          updatedSettings.push('privacy.profile_visibility')
          warnings.push('Profile visibility set to public based on data completeness')
        }
      }

      auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'privacy_sync_completed',
        source: 'system',
        confidence: 100,
        reasoning: `Privacy sync completed. Updated: ${updatedSettings.length}, Warnings: ${warnings.length}`
      })

      return {
        success: true,
        updatedSettings,
        warnings
      }

    } catch (error) {
      auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'privacy_sync_failed',
        source: 'system',
        confidence: 0,
        reasoning: `Privacy sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      })

      return {
        success: false,
        updatedSettings,
        warnings,
        error: error instanceof Error ? error.message : 'Privacy sync failed'
      }
    }
  }

  /**
   * Apply smart conflict resolution
   */
  private async applySmartConflictResolution(
    userId: string,
    provider: OAuthProvider,
    conflicts: ProfileConflict[],
    auditTrail: SyncAuditEntry[]
  ): Promise<void> {
    const capabilities = EnhancedProfileSyncManager.PROVIDER_CAPABILITIES[provider]

    for (const conflict of conflicts) {
      try {
        const resolution = this.determineSmartResolution(conflict, capabilities)
        
        if (resolution.action === 'auto_resolve') {
          await this.resolveProfileConflict(
            userId,
            conflict.field,
            resolution.choice,
            resolution.choice === 'use_provider' ? conflict.providerValue : undefined
          )

          auditTrail.push({
            timestamp: new Date().toISOString(),
            action: 'conflict_auto_resolved',
            field: conflict.field,
            source: 'system',
            confidence: resolution.confidence,
            reasoning: resolution.reasoning,
            oldValue: conflict.currentValue,
            newValue: resolution.choice === 'use_provider' ? conflict.providerValue : conflict.currentValue
          })

          conflict.autoResolved = true
          conflict.resolution = resolution.choice
        }
      } catch (error) {
        console.error(`Failed to resolve conflict for field ${conflict.field}:`, error)
      }
    }
  }

  /**
   * Generate sync recommendations
   */
  private async generateSyncRecommendations(
    userId: string,
    provider: OAuthProvider,
    providerData: ProviderProfileData,
    syncResult: ProfileSyncResult
  ): Promise<SyncRecommendation[]> {
    const recommendations: SyncRecommendation[] = []
    const capabilities = EnhancedProfileSyncManager.PROVIDER_CAPABILITIES[provider]

    // Profile completion recommendations
    if (syncResult.updatedFields && syncResult.updatedFields.length > 0) {
      recommendations.push({
        type: 'completion',
        priority: 'medium',
        title: 'Profile Updated from Social Account',
        description: `We've updated ${syncResult.updatedFields.length} fields from your ${provider} account to improve your profile completeness.`,
      })
    }

    // Verification recommendations
    if (providerData.verified_email && capabilities.dataQuality === 'high') {
      recommendations.push({
        type: 'verification',
        priority: 'low',
        title: 'Email Verified',
        description: `Your email has been verified through your ${provider} account.`,
      })
    }

    // Privacy recommendations
    if (capabilities.providesAvatar && providerData.avatar_url) {
      recommendations.push({
        type: 'privacy',
        priority: 'low',
        title: 'Profile Picture Updated',
        description: 'Consider reviewing your privacy settings for profile visibility.',
        action: 'Review Privacy Settings',
        actionUrl: '/settings/privacy'
      })
    }

    // Security recommendations
    if (syncResult.conflicts && syncResult.conflicts.length > 0) {
      recommendations.push({
        type: 'security',
        priority: 'medium',
        title: 'Profile Data Conflicts Detected',
        description: `We found ${syncResult.conflicts.length} conflicts between your profile and ${provider} data. Review these to ensure accuracy.`,
        action: 'Review Conflicts',
        actionUrl: '/settings/profile/conflicts'
      })
    }

    return recommendations
  }

  /**
   * Record enhanced sync history
   */
  private async recordEnhancedSyncHistory(
    userId: string,
    provider: OAuthProvider,
    syncResult: EnhancedProfileSyncResult
  ): Promise<void> {
    try {
      await this.supabase
        .from('profile_sync_history')
        .insert({
          user_id: userId,
          provider: provider,
          sync_type: 'enhanced',
          trigger_event: 'manual_sync',
          synced_fields: syncResult.updatedFields || [],
          sync_data: {
            enhanced_result: {
              avatar_sync: syncResult.avatarSyncResult,
              preferences_sync: syncResult.preferencesSyncResult,
              privacy_sync: syncResult.privacySyncResult,
              profile_completion_delta: syncResult.profileCompletionDelta,
              recommendations_count: syncResult.recommendations?.length || 0,
              audit_entries: syncResult.auditTrail?.length || 0
            }
          },
          conflicts_detected: syncResult.conflicts?.length || 0,
          conflicts_resolved: syncResult.conflicts?.filter(c => c.autoResolved).length || 0,
          conflicts_data: syncResult.conflicts || [],
          success: syncResult.success,
          error_message: syncResult.error,
          processing_time_ms: 0 // TODO: Add timing
        })
    } catch (error) {
      console.error('Failed to record enhanced sync history:', error)
    }
  }

  // Private helper methods

  private determineSmartResolution(
    conflict: ProfileConflict,
    capabilities: ProviderCapabilities
  ): {
    action: 'auto_resolve' | 'manual_required'
    choice?: 'keep_current' | 'use_provider'
    confidence: number
    reasoning: string
  } {
    // High-confidence auto-resolution cases
    if (capabilities.dataQuality === 'high' && capabilities.updateFrequency === 'frequent') {
      return {
        action: 'auto_resolve',
        choice: 'use_provider',
        confidence: 90,
        reasoning: 'High-quality, frequently updated provider data'
      }
    }

    // Field-specific resolution logic
    switch (conflict.field) {
      case 'avatar_url':
        if (this.isPlaceholderAvatar(conflict.currentValue)) {
          return {
            action: 'auto_resolve',
            choice: 'use_provider',
            confidence: 95,
            reasoning: 'Current avatar is placeholder'
          }
        }
        break

      case 'email_verified':
        if (conflict.providerValue === true && capabilities.dataQuality === 'high') {
          return {
            action: 'auto_resolve',
            choice: 'use_provider',
            confidence: 100,
            reasoning: 'Provider email verification is authoritative'
          }
        }
        break

      case 'display_name':
      case 'first_name':
      case 'last_name':
        if (!conflict.currentValue || conflict.currentValue.length < 2) {
          return {
            action: 'auto_resolve',
            choice: 'use_provider',
            confidence: 85,
            reasoning: 'Current value is empty or too short'
          }
        }
        break
    }

    // Default to manual resolution for complex cases
    return {
      action: 'manual_required',
      confidence: 0,
      reasoning: 'Conflict requires manual review'
    }
  }

  private calculateProviderDataCompleteness(
    providerData: ProviderProfileData,
    capabilities: ProviderCapabilities
  ): number {
    const fields = Object.keys(providerData).filter(key => providerData[key as keyof ProviderProfileData])
    const totalPossibleFields = Object.values(capabilities).filter(v => v === true).length
    
    return totalPossibleFields > 0 ? fields.length / totalPossibleFields : 0
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
}

// Export enhanced sync manager instance
export const enhancedProfileSyncManager = new EnhancedProfileSyncManager()

// Cached enhanced sync functions
export const performEnhancedProfileSync = cache(async (
  userId: string,
  provider: OAuthProvider,
  providerData: ProviderProfileData,
  options?: EnhancedProfileSyncOptions
) => {
  return enhancedProfileSyncManager.syncProviderProfileEnhanced(
    userId,
    provider,
    providerData,
    options
  )
})

// Utility functions for different sync scenarios
export async function syncAfterLogin(
  userId: string,
  provider: OAuthProvider,
  providerData: ProviderProfileData
) {
  return enhancedProfileSyncManager.syncProviderProfileEnhanced(userId, provider, providerData, {
    syncAvatars: true,
    downloadAvatars: true,
    updatePreferences: true,
    syncPrivacySettings: false,
    enableSmartConflictResolution: true,
    auditLevel: 'detailed'
  })
}

export async function syncForProfileCompletion(
  userId: string,
  provider: OAuthProvider,
  providerData: ProviderProfileData
) {
  return enhancedProfileSyncManager.syncProviderProfileEnhanced(userId, provider, providerData, {
    syncAvatars: true,
    downloadAvatars: true,
    updatePreferences: true,
    syncPrivacySettings: true,
    enableSmartConflictResolution: true,
    auditLevel: 'comprehensive'
  })
}