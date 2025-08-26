/**
 * OAuth Provider Configuration and Management
 * Epic 2 Story 2.3: Social Media Login Integration
 * 
 * Manages OAuth provider configurations, client setup, and security validation
 * for Google, Apple, Facebook, and GitHub authentication.
 */

import { createClient } from '@/lib/supabase/server'
import { Database } from '@/lib/supabase/database.types'

export type OAuthProvider = 'google' | 'apple' | 'facebook' | 'github'

export interface OAuthProviderConfig {
  id: string
  provider_name: OAuthProvider
  display_name: string
  client_id: string
  client_secret: string
  redirect_uri: string
  authorization_url?: string
  token_url?: string
  user_info_url?: string
  default_scopes: string[]
  optional_scopes: string[]
  enabled: boolean
  auto_link_accounts: boolean
  require_email_verification: boolean
  button_text: string
  button_color?: string
  icon_url?: string
  metadata?: Record<string, any>
}

export interface OAuthAuthorizationParams {
  client_id: string
  redirect_uri: string
  scope: string
  response_type: 'code'
  state: string
  code_challenge?: string
  code_challenge_method?: 'S256'
  access_type?: 'offline'
  prompt?: string
  nonce?: string
}

/**
 * Provider-specific OAuth configurations
 */
export const OAUTH_PROVIDER_CONFIGS: Record<OAuthProvider, Partial<OAuthProviderConfig>> = {
  google: {
    display_name: 'Google',
    authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_url: 'https://oauth2.googleapis.com/token',
    user_info_url: 'https://www.googleapis.com/oauth2/v2/userinfo',
    default_scopes: ['openid', 'email', 'profile'],
    optional_scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    button_text: 'Continue with Google',
    button_color: '#4285f4',
    auto_link_accounts: true,
    require_email_verification: false,
  },
  apple: {
    display_name: 'Apple',
    authorization_url: 'https://appleid.apple.com/auth/authorize',
    token_url: 'https://appleid.apple.com/auth/token',
    default_scopes: ['name', 'email'],
    optional_scopes: [],
    button_text: 'Sign in with Apple',
    button_color: '#000000',
    auto_link_accounts: false, // Apple handles privacy differently
    require_email_verification: false,
  },
  facebook: {
    display_name: 'Facebook',
    authorization_url: 'https://www.facebook.com/v18.0/dialog/oauth',
    token_url: 'https://graph.facebook.com/v18.0/oauth/access_token',
    user_info_url: 'https://graph.facebook.com/me',
    default_scopes: ['email', 'public_profile'],
    optional_scopes: ['pages_show_list', 'pages_read_engagement'],
    button_text: 'Continue with Facebook',
    button_color: '#1877f2',
    auto_link_accounts: true,
    require_email_verification: true,
  },
  github: {
    display_name: 'GitHub',
    authorization_url: 'https://github.com/login/oauth/authorize',
    token_url: 'https://github.com/login/oauth/access_token',
    user_info_url: 'https://api.github.com/user',
    default_scopes: ['read:user', 'user:email'],
    optional_scopes: ['repo', 'read:org'],
    button_text: 'Sign in with GitHub',
    button_color: '#24292e',
    auto_link_accounts: true,
    require_email_verification: false,
  },
}

/**
 * OAuth Configuration Manager
 */
export class OAuthConfigManager {
  private supabase = createClient()

  /**
   * Get OAuth provider configuration from database
   */
  async getProviderConfig(provider: OAuthProvider): Promise<OAuthProviderConfig | null> {
    try {
      const { data, error } = await this.supabase
        .from('oauth_providers')
        .select('*')
        .eq('provider_name', provider)
        .eq('enabled', true)
        .single()

      if (error || !data) {
        console.error(`Failed to get OAuth config for ${provider}:`, error)
        return null
      }

      // Decrypt client credentials (this would be done server-side)
      const decryptedConfig = await this.decryptProviderConfig(data)
      
      return {
        ...OAUTH_PROVIDER_CONFIGS[provider],
        ...decryptedConfig,
      } as OAuthProviderConfig

    } catch (error) {
      console.error(`Error getting OAuth provider config for ${provider}:`, error)
      return null
    }
  }

  /**
   * Get all enabled OAuth providers
   */
  async getEnabledProviders(): Promise<OAuthProvider[]> {
    try {
      const { data, error } = await this.supabase
        .from('oauth_providers')
        .select('provider_name')
        .eq('enabled', true)
        .order('provider_name')

      if (error) {
        console.error('Failed to get enabled OAuth providers:', error)
        return []
      }

      return (data?.map(p => p.provider_name) || []) as OAuthProvider[]
    } catch (error) {
      console.error('Error getting enabled OAuth providers:', error)
      return []
    }
  }

  /**
   * Generate OAuth authorization URL with PKCE
   */
  async generateAuthorizationURL(
    provider: OAuthProvider,
    redirectUri: string,
    state: string,
    scopes?: string[]
  ): Promise<string | null> {
    const config = await this.getProviderConfig(provider)
    if (!config) {
      throw new Error(`OAuth provider ${provider} not configured or disabled`)
    }

    const authParams: OAuthAuthorizationParams = {
      client_id: config.client_id,
      redirect_uri: redirectUri,
      scope: (scopes || config.default_scopes).join(' '),
      response_type: 'code',
      state: state,
    }

    // Add PKCE for enhanced security
    if (provider === 'google' || provider === 'github') {
      const { codeChallenge, codeVerifier } = await this.generatePKCE()
      authParams.code_challenge = codeChallenge
      authParams.code_challenge_method = 'S256'
      
      // Store code verifier in secure session storage
      await this.storeCodeVerifier(state, codeVerifier)
    }

    // Provider-specific parameters
    switch (provider) {
      case 'google':
        authParams.access_type = 'offline'
        authParams.prompt = 'consent'
        break
      case 'apple':
        authParams.response_type = 'code'
        authParams.nonce = await this.generateNonce()
        break
      case 'facebook':
        // Facebook uses default parameters
        break
      case 'github':
        // GitHub uses default parameters
        break
    }

    const url = new URL(config.authorization_url!)
    Object.entries(authParams).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value.toString())
    })

    return url.toString()
  }

  /**
   * Validate OAuth callback parameters
   */
  async validateOAuthCallback(
    provider: OAuthProvider,
    code: string,
    state: string,
    receivedState: string
  ): Promise<{ valid: boolean; error?: string }> {
    // Validate state parameter (CSRF protection)
    if (state !== receivedState) {
      return { valid: false, error: 'Invalid state parameter' }
    }

    // Validate authorization code format
    if (!code || typeof code !== 'string') {
      return { valid: false, error: 'Invalid authorization code' }
    }

    // Provider-specific validations
    switch (provider) {
      case 'google':
        if (code.length < 10) {
          return { valid: false, error: 'Invalid Google authorization code format' }
        }
        break
      case 'apple':
        // Apple codes are typically longer and contain specific patterns
        if (code.length < 20) {
          return { valid: false, error: 'Invalid Apple authorization code format' }
        }
        break
      case 'facebook':
        if (!code.startsWith('AQ') && code.length < 20) {
          return { valid: false, error: 'Invalid Facebook authorization code format' }
        }
        break
      case 'github':
        if (code.length !== 20) {
          return { valid: false, error: 'Invalid GitHub authorization code format' }
        }
        break
    }

    return { valid: true }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    provider: OAuthProvider,
    code: string,
    state: string,
    redirectUri: string
  ): Promise<{
    access_token: string
    refresh_token?: string
    id_token?: string
    expires_in?: number
    scope?: string
  } | null> {
    const config = await this.getProviderConfig(provider)
    if (!config) {
      throw new Error(`OAuth provider ${provider} not configured`)
    }

    const tokenParams: Record<string, string> = {
      grant_type: 'authorization_code',
      client_id: config.client_id,
      client_secret: config.client_secret,
      code: code,
      redirect_uri: redirectUri,
    }

    // Add PKCE code verifier if used
    const codeVerifier = await this.getCodeVerifier(state)
    if (codeVerifier) {
      tokenParams.code_verifier = codeVerifier
    }

    try {
      const response = await fetch(config.token_url!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'lawless-directory/1.0.0',
        },
        body: new URLSearchParams(tokenParams),
      })

      if (!response.ok) {
        console.error(`Token exchange failed for ${provider}:`, response.status, response.statusText)
        return null
      }

      const tokenData = await response.json()
      
      // Clean up stored code verifier
      await this.removeCodeVerifier(state)
      
      return tokenData
    } catch (error) {
      console.error(`Error exchanging code for token (${provider}):`, error)
      return null
    }
  }

  /**
   * Get user information from OAuth provider
   */
  async getUserInfo(provider: OAuthProvider, accessToken: string): Promise<any> {
    const config = await this.getProviderConfig(provider)
    if (!config || !config.user_info_url) {
      throw new Error(`User info URL not configured for ${provider}`)
    }

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'User-Agent': 'lawless-directory/1.0.0',
      }

      // Provider-specific authorization headers
      switch (provider) {
        case 'google':
        case 'github':
          headers.Authorization = `Bearer ${accessToken}`
          break
        case 'facebook':
          // Facebook uses query parameter for access token
          break
      }

      let url = config.user_info_url
      if (provider === 'facebook') {
        url += `?access_token=${accessToken}&fields=id,name,email,picture`
      }

      const response = await fetch(url, { headers })
      
      if (!response.ok) {
        console.error(`Failed to fetch user info from ${provider}:`, response.status)
        return null
      }

      return await response.json()
    } catch (error) {
      console.error(`Error fetching user info from ${provider}:`, error)
      return null
    }
  }

  // Private utility methods

  private async decryptProviderConfig(encryptedData: any): Promise<Partial<OAuthProviderConfig>> {
    // In a real implementation, this would decrypt the stored credentials
    // For now, return placeholder - this should use server-side decryption
    return {
      id: encryptedData.id,
      provider_name: encryptedData.provider_name,
      display_name: encryptedData.display_name,
      client_id: process.env[`${encryptedData.provider_name.toUpperCase()}_CLIENT_ID`] || '',
      client_secret: process.env[`${encryptedData.provider_name.toUpperCase()}_CLIENT_SECRET`] || '',
      redirect_uri: encryptedData.redirect_uri,
      enabled: encryptedData.enabled,
      auto_link_accounts: encryptedData.auto_link_accounts,
      require_email_verification: encryptedData.require_email_verification,
      button_text: encryptedData.button_text,
      button_color: encryptedData.button_color,
      icon_url: encryptedData.icon_url,
      metadata: encryptedData.metadata || {},
    }
  }

  private async generatePKCE(): Promise<{ codeChallenge: string; codeVerifier: string }> {
    const codeVerifier = this.generateRandomString(128)
    const encoder = new TextEncoder()
    const data = encoder.encode(codeVerifier)
    const digest = await crypto.subtle.digest('SHA-256', data)
    const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
    
    return { codeChallenge, codeVerifier }
  }

  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)]
    }
    return result
  }

  private async generateNonce(): Promise<string> {
    return this.generateRandomString(32)
  }

  private async storeCodeVerifier(state: string, codeVerifier: string): Promise<void> {
    // Store in secure session storage or database
    // This is a simplified implementation - in production, use encrypted storage
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`pkce_${state}`, codeVerifier)
    }
  }

  private async getCodeVerifier(state: string): Promise<string | null> {
    // Retrieve from secure session storage or database
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(`pkce_${state}`)
    }
    return null
  }

  private async removeCodeVerifier(state: string): Promise<void> {
    // Clean up stored code verifier
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(`pkce_${state}`)
    }
  }
}

/**
 * Utility functions for OAuth operations
 */
export const oauthConfig = new OAuthConfigManager()

/**
 * Generate secure random state parameter for OAuth flows
 */
export function generateOAuthState(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Validate OAuth provider name
 */
export function isValidOAuthProvider(provider: string): provider is OAuthProvider {
  return ['google', 'apple', 'facebook', 'github'].includes(provider)
}

/**
 * Get OAuth button styling based on provider
 */
export function getOAuthButtonStyle(provider: OAuthProvider) {
  const config = OAUTH_PROVIDER_CONFIGS[provider]
  return {
    backgroundColor: config.button_color,
    color: provider === 'apple' || provider === 'github' ? '#ffffff' : '#ffffff',
    border: provider === 'google' ? '1px solid #dadce0' : 'none',
  }
}