/**
 * Account Linking and Management System
 * Epic 2 Story 2.3: Social Media Login Integration
 * 
 * Handles linking/unlinking of social accounts, account merging,
 * and primary authentication method management.
 */

import { createClient } from '@/lib/supabase/server'
import { OAuthProvider } from './oauth-config'
import { encryptToken, decryptToken } from './token-encryption'

export interface OAuthConnectionData {
  provider_user_id: string
  provider_email?: string
  provider_username?: string
  access_token: string
  refresh_token?: string
  id_token?: string
  expires_in?: number
  provider_data: Record<string, any>
}

export interface AccountLinkingResult {
  success: boolean
  error?: string
  connectionId?: string
  conflicts?: string[]
}

export interface LinkedAccount {
  id: string
  provider: OAuthProvider
  provider_user_id: string
  provider_email?: string
  provider_username?: string
  provider_data: Record<string, any>
  is_primary: boolean
  is_verified: boolean
  connected_at: string
  last_used_at?: string
}

/**
 * Account Linking Manager
 * Handles all OAuth account linking operations with security validation
 */
export class AccountLinkingManager {
  private supabase = createClient()

  /**
   * Link an OAuth account to an existing user
   */
  async linkOAuthAccount(
    userId: string,
    provider: OAuthProvider,
    connectionData: OAuthConnectionData
  ): Promise<AccountLinkingResult> {
    try {
      // Validate user exists and is active
      const { data: user, error: userError } = await this.supabase
        .from('profiles')
        .select('id, account_status')
        .eq('id', userId)
        .single()

      if (userError || !user) {
        return { success: false, error: 'User not found' }
      }

      if (user.account_status !== 'active') {
        return { success: false, error: 'User account is not active' }
      }

      // Get provider configuration
      const { data: providerConfig, error: providerError } = await this.supabase
        .from('oauth_providers')
        .select('id, provider_name, auto_link_accounts, require_email_verification')
        .eq('provider_name', provider)
        .eq('enabled', true)
        .single()

      if (providerError || !providerConfig) {
        return { success: false, error: 'OAuth provider not configured or disabled' }
      }

      // Check if this OAuth account is already linked to any user
      const { data: existingConnection } = await this.supabase
        .from('user_oauth_connections')
        .select('user_id, provider_id')
        .eq('provider_id', providerConfig.id)
        .eq('provider_user_id', connectionData.provider_user_id)
        .maybeSingle()

      if (existingConnection) {
        if (existingConnection.user_id === userId) {
          return { success: false, error: 'OAuth account already linked to this user' }
        } else {
          return { success: false, error: 'OAuth account already linked to another user' }
        }
      }

      // Check for email conflicts if applicable
      const conflicts: string[] = []
      if (connectionData.provider_email) {
        const { data: emailConflicts } = await this.supabase
          .from('user_oauth_connections')
          .select('provider_id, oauth_providers!inner(provider_name)')
          .eq('provider_email', connectionData.provider_email)
          .neq('user_id', userId)

        if (emailConflicts && emailConflicts.length > 0) {
          conflicts.push(`Email ${connectionData.provider_email} is already linked to other accounts`)
        }
      }

      // If auto-linking is disabled and conflicts exist, require manual confirmation
      if (!providerConfig.auto_link_accounts && conflicts.length > 0) {
        return { success: false, error: 'Account linking requires manual confirmation', conflicts }
      }

      // Create OAuth connection
      const { data: connection, error: connectionError } = await this.supabase
        .from('user_oauth_connections')
        .insert({
          user_id: userId,
          provider_id: providerConfig.id,
          provider_user_id: connectionData.provider_user_id,
          provider_email: connectionData.provider_email,
          provider_username: connectionData.provider_username,
          access_token_encrypted: await encryptToken(connectionData.access_token),
          refresh_token_encrypted: connectionData.refresh_token 
            ? await encryptToken(connectionData.refresh_token) 
            : null,
          id_token_encrypted: connectionData.id_token 
            ? await encryptToken(connectionData.id_token) 
            : null,
          token_expires_at: connectionData.expires_in 
            ? new Date(Date.now() + connectionData.expires_in * 1000).toISOString()
            : null,
          provider_data: connectionData.provider_data,
          is_primary: false, // Never make linked accounts primary by default
          is_verified: !providerConfig.require_email_verification,
          connected_at: new Date().toISOString()
        } as any)
        .select('id')
        .single()

      if (connectionError || !connection) {
        console.error('Failed to create OAuth connection:', connectionError)
        return { success: false, error: 'Failed to link OAuth account' }
      }

      // Log account linking event
      await this.logAccountLinkingEvent({
        userId,
        eventType: 'account_linked',
        provider,
        success: true,
        metadata: {
          connectionId: connection.id,
          providerUserId: connectionData.provider_user_id,
          providerEmail: connectionData.provider_email
        }
      })

      return {
        success: true,
        connectionId: connection.id,
        conflicts: conflicts.length > 0 ? conflicts : undefined
      }

    } catch (error) {
      console.error('Account linking error:', error)
      
      await this.logAccountLinkingEvent({
        userId,
        eventType: 'account_link_failed',
        provider,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Account linking failed'
      }
    }
  }

  /**
   * Unlink an OAuth account from a user
   */
  async unlinkOAuthAccount(
    userId: string,
    connectionId: string,
    reason?: string
  ): Promise<AccountLinkingResult> {
    try {
      // Validate the connection belongs to the user
      const { data: connection, error: connectionError } = await this.supabase
        .from('user_oauth_connections')
        .select(`
          *,
          oauth_providers!inner(provider_name)
        `)
        .eq('id', connectionId)
        .eq('user_id', userId)
        .single()

      if (connectionError || !connection) {
        return { success: false, error: 'OAuth connection not found' }
      }

      // Prevent unlinking if it's the only authentication method
      const { data: userAuth } = await this.supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single()

      const { data: otherConnections, error: otherError } = await this.supabase
        .from('user_oauth_connections')
        .select('id')
        .eq('user_id', userId)
        .neq('id', connectionId)

      // Check if user has email/password authentication
      let hasPasswordAuth = false
      if (userAuth?.email) {
        const { data: authUser } = await this.supabase.auth.admin.getUserById(userId)
        hasPasswordAuth = !!(authUser.user as any)?.encrypted_password
      }

      if (!hasPasswordAuth && (!otherConnections || otherConnections.length === 0)) {
        return { 
          success: false, 
          error: 'Cannot unlink the only authentication method. Set up password authentication first.' 
        }
      }

      // Prevent unlinking if it's marked as primary and there are other connections
      if (connection.is_primary && otherConnections && otherConnections.length > 0) {
        return {
          success: false,
          error: 'Cannot unlink primary authentication method. Set another method as primary first.'
        }
      }

      // Soft delete the connection (mark as disconnected)
      const { error: unlinkError } = await this.supabase
        .from('user_oauth_connections')
        .update({
          disconnected_at: new Date().toISOString(),
          is_primary: false,
          // Keep the record for audit trail but mark as disconnected
        })
        .eq('id', connectionId)

      if (unlinkError) {
        console.error('Failed to unlink OAuth account:', unlinkError)
        return { success: false, error: 'Failed to unlink OAuth account' }
      }

      // If this was the primary connection, set another one as primary
      if (connection.is_primary && otherConnections && otherConnections.length > 0) {
        await this.supabase
          .from('user_oauth_connections')
          .update({ is_primary: true })
          .eq('id', otherConnections[0].id)
      }

      // Log account unlinking event
      await this.logAccountLinkingEvent({
        userId,
        eventType: 'account_unlinked',
        provider: connection.oauth_providers.provider_name as OAuthProvider,
        success: true,
        metadata: {
          connectionId,
          reason,
          providerUserId: connection.provider_user_id
        }
      })

      return { success: true }

    } catch (error) {
      console.error('Account unlinking error:', error)
      
      await this.logAccountLinkingEvent({
        userId,
        eventType: 'account_unlink_failed',
        provider: 'unknown',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Account unlinking failed'
      }
    }
  }

  /**
   * Get all linked accounts for a user
   */
  async getLinkedAccounts(userId: string): Promise<LinkedAccount[]> {
    try {
      const { data: connections, error } = await this.supabase
        .from('user_oauth_connections')
        .select(`
          id,
          provider_user_id,
          provider_email,
          provider_username,
          provider_data,
          is_primary,
          is_verified,
          connected_at,
          last_used_at,
          oauth_providers!inner(provider_name)
        `)
        .eq('user_id', userId)
        .is('disconnected_at', null) // Only active connections
        .order('connected_at', { ascending: false })

      if (error) {
        console.error('Failed to get linked accounts:', error)
        return []
      }

      return (connections || []).map((conn: any) => ({
        id: conn.id,
        provider: conn.oauth_providers.provider_name as OAuthProvider,
        provider_user_id: conn.provider_user_id,
        provider_email: conn.provider_email,
        provider_username: conn.provider_username,
        provider_data: conn.provider_data || {},
        is_primary: conn.is_primary,
        is_verified: conn.is_verified,
        connected_at: conn.connected_at,
        last_used_at: conn.last_used_at
      }))

    } catch (error) {
      console.error('Error getting linked accounts:', error)
      return []
    }
  }

  /**
   * Set primary authentication method
   */
  async setPrimaryAuthMethod(
    userId: string,
    connectionId?: string
  ): Promise<AccountLinkingResult> {
    try {
      // If connectionId is null, setting email/password as primary
      if (!connectionId) {
        // Remove primary flag from all OAuth connections
        await this.supabase
          .from('user_oauth_connections')
          .update({ is_primary: false })
          .eq('user_id', userId)

        await this.logAccountLinkingEvent({
          userId,
          eventType: 'primary_auth_changed',
          provider: 'email',
          success: true,
          metadata: { newPrimary: 'email_password' }
        })

        return { success: true }
      }

      // Validate connection belongs to user
      const { data: connection, error: connectionError } = await this.supabase
        .from('user_oauth_connections')
        .select(`
          id,
          oauth_providers!inner(provider_name)
        `)
        .eq('id', connectionId)
        .eq('user_id', userId)
        .is('disconnected_at', null)
        .single()

      if (connectionError || !connection) {
        return { success: false, error: 'OAuth connection not found' }
      }

      // Remove primary flag from all other connections
      await this.supabase
        .from('user_oauth_connections')
        .update({ is_primary: false })
        .eq('user_id', userId)
        .neq('id', connectionId)

      // Set new primary connection
      const { error: updateError } = await this.supabase
        .from('user_oauth_connections')
        .update({ is_primary: true })
        .eq('id', connectionId)

      if (updateError) {
        console.error('Failed to set primary auth method:', updateError)
        return { success: false, error: 'Failed to set primary authentication method' }
      }

      await this.logAccountLinkingEvent({
        userId,
        eventType: 'primary_auth_changed',
        provider: connection.oauth_providers.provider_name as OAuthProvider,
        success: true,
        metadata: { 
          connectionId,
          newPrimary: connection.oauth_providers.provider_name
        }
      })

      return { success: true }

    } catch (error) {
      console.error('Set primary auth method error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set primary method'
      }
    }
  }

  /**
   * Merge user accounts (advanced feature)
   */
  async mergeUserAccounts(
    primaryUserId: string,
    secondaryUserId: string,
    confirmationCode: string
  ): Promise<AccountLinkingResult> {
    // This is a complex operation that would require careful implementation
    // Including data migration, conflict resolution, etc.
    // For now, return not implemented
    return { 
      success: false, 
      error: 'Account merging is not yet implemented' 
    }
  }

  /**
   * Refresh OAuth tokens for a connection
   */
  async refreshOAuthTokens(connectionId: string): Promise<AccountLinkingResult> {
    try {
      const { data: connection, error } = await this.supabase
        .from('user_oauth_connections')
        .select(`
          *,
          oauth_providers!inner(provider_name, client_id_encrypted, client_secret_encrypted, token_url)
        `)
        .eq('id', connectionId)
        .is('disconnected_at', null)
        .single()

      if (error || !connection) {
        return { success: false, error: 'OAuth connection not found' }
      }

      if (!connection.refresh_token_encrypted) {
        return { success: false, error: 'No refresh token available' }
      }

      // Decrypt refresh token
      const refreshToken = await decryptToken(connection.refresh_token_encrypted)
      
      // Refresh tokens using OAuth provider
      const tokenData = await this.refreshProviderTokens(
        connection.oauth_providers.provider_name as OAuthProvider,
        refreshToken,
        connection.oauth_providers
      )

      if (!tokenData) {
        return { success: false, error: 'Failed to refresh tokens' }
      }

      // Update connection with new tokens
      await this.supabase
        .from('user_oauth_connections')
        .update({
          access_token_encrypted: await encryptToken(tokenData.access_token),
          refresh_token_encrypted: tokenData.refresh_token 
            ? await encryptToken(tokenData.refresh_token)
            : connection.refresh_token_encrypted, // Keep existing if not provided
          token_expires_at: tokenData.expires_in 
            ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', connectionId)

      return { success: true }

    } catch (error) {
      console.error('Token refresh error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed'
      }
    }
  }

  // Private utility methods

  // Removed insecure token encryption methods - now using secure token-encryption module

  private async refreshProviderTokens(
    provider: OAuthProvider,
    refreshToken: string,
    providerConfig: any
  ): Promise<any> {
    try {
      // Decrypt provider credentials (simplified for demo)
      const clientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`]
      const clientSecret = process.env[`${provider.toUpperCase()}_CLIENT_SECRET`]
      
      const response = await fetch(providerConfig.token_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId || '',
          client_secret: clientSecret || ''
        })
      })

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`Failed to refresh ${provider} tokens:`, error)
      return null
    }
  }

  private async logAccountLinkingEvent({
    userId,
    eventType,
    provider,
    success,
    error,
    metadata
  }: {
    userId: string
    eventType: string
    provider: OAuthProvider | string
    success: boolean
    error?: string
    metadata?: any
  }) {
    try {
      await (this.supabase as any).from('auth_audit_logs').insert({
        event_type: eventType,
        event_category: 'account_linking',
        user_id: userId,
        success,
        failure_reason: error,
        event_data: {
          provider,
          ...metadata
        }
      })
    } catch (logError) {
      console.error('Failed to log account linking event:', logError)
    }
  }
}

/**
 * Utility functions for account management
 */
export const accountLinking = new AccountLinkingManager()

/**
 * Check if user has multiple authentication methods
 */
export async function hasMultipleAuthMethods(userId: string): Promise<boolean> {
  const supabase = createClient()
  
  // Check OAuth connections
  const { data: oauthConnections } = await supabase
    .from('user_oauth_connections')
    .select('id')
    .eq('user_id', userId)
    .is('disconnected_at', null)

  const oauthCount = oauthConnections?.length || 0

  // Check if has password auth
  const { data: authUser } = await supabase.auth.admin.getUserById(userId)
  const hasPassword = !!(authUser.user as any)?.encrypted_password

  return (oauthCount + (hasPassword ? 1 : 0)) > 1
}

/**
 * Get primary authentication method for user
 */
export async function getPrimaryAuthMethod(userId: string): Promise<{
  type: 'email' | 'oauth'
  provider?: OAuthProvider
  connectionId?: string
} | null> {
  const supabase = createClient()
  
  // Check for primary OAuth connection
  const { data: primaryConnection } = await supabase
    .from('user_oauth_connections')
    .select(`
      id,
      oauth_providers!inner(provider_name)
    `)
    .eq('user_id', userId)
    .eq('is_primary', true)
    .is('disconnected_at', null)
    .maybeSingle()

  if (primaryConnection) {
    return {
      type: 'oauth',
      provider: primaryConnection.oauth_providers.provider_name as OAuthProvider,
      connectionId: primaryConnection.id
    }
  }

  // Check if has email/password auth
  const { data: authUser } = await supabase.auth.admin.getUserById(userId)
  if ((authUser.user as any)?.encrypted_password) {
    return { type: 'email' }
  }

  return null
}