/**
 * Authentication Client Utilities
 * Epic 2 Story 2.1: Client-side authentication functions
 * Provides authentication utilities for browser context
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/supabase/database.types'
import type { User, Session } from '@supabase/supabase-js'

// Extended user type with custom claims
export interface AuthUser extends User {
  roles?: string[]
  permissions?: string[]
  owned_businesses?: string[]
  subscription?: {
    tier: string
    valid_until?: string
    features?: Record<string, any>
  }
  profile?: {
    username?: string
    display_name?: string
    avatar_url?: string
    email_verified?: boolean
    phone_verified?: boolean
    account_status?: string
  }
}

// Authentication state type
export interface AuthState {
  user: AuthUser | null
  session: Session | null
  isLoading: boolean
  error: Error | null
}

// Create authenticated Supabase client
export function createAuthClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    }
  })
}

// Authentication service class
export class AuthService {
  private client = createAuthClient()

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string, metadata?: Record<string, any>) {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    })

    if (error) throw error
    return data
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password
    })

    if (error) throw error
    return data
  }

  /**
   * Sign in with OAuth provider
   */
  async signInWithOAuth(provider: 'google' | 'apple' | 'facebook' | 'github') {
    const { data, error } = await this.client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: this.getOAuthScopes(provider)
      }
    })

    if (error) throw error
    return data
  }

  /**
   * Sign in with magic link
   */
  async signInWithMagicLink(email: string) {
    const { data, error } = await this.client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    })

    if (error) throw error
    return data
  }

  /**
   * Sign out
   */
  async signOut() {
    const { error } = await this.client.auth.signOut()
    if (error) throw error
  }

  /**
   * Get current session
   */
  async getSession() {
    const { data, error } = await this.client.auth.getSession()
    if (error) throw error
    return data.session
  }

  /**
   * Get current user with custom claims
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    const { data: { user }, error } = await this.client.auth.getUser()
    if (error || !user) return null

    // Fetch additional user data
    const { data: profile } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    const { data: roles } = await this.client
      .from('user_roles')
      .select('role:roles(name)')
      .eq('user_id', user.id)
      .eq('is_active', true)

    const { data: businesses } = await this.client
      .from('businesses')
      .select('id, subscription_tier, subscription_valid_until, premium_features')
      .eq('owner_id', user.id)
      .eq('status', 'active')

    return {
      ...user,
      roles: roles?.map((r: any) => r.role?.name).filter(Boolean) || [],
      owned_businesses: businesses?.map((b: any) => b.id) || [],
      subscription: businesses?.[0] ? {
        tier: businesses[0].subscription_tier || 'free',
        valid_until: businesses[0].subscription_valid_until,
        features: businesses[0].premium_features
      } : { tier: 'free' },
      profile: profile || undefined
    } as AuthUser
  }

  /**
   * Reset password
   */
  async resetPassword(email: string) {
    const { data, error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    })

    if (error) throw error
    return data
  }

  /**
   * Update password
   */
  async updatePassword(newPassword: string) {
    const { data, error } = await this.client.auth.updateUser({
      password: newPassword
    })

    if (error) throw error
    return data
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: Partial<Database['public']['Tables']['profiles']['Update']>) {
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await this.client
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Check if user has role
   */
  async hasRole(roleName: string): Promise<boolean> {
    const user = await this.getCurrentUser()
    if (!user) return false
    return user.roles?.includes(roleName) || false
  }

  /**
   * Check if user has permission
   */
  async hasPermission(resource: string, action: string): Promise<boolean> {
    const user = await this.getCurrentUser()
    if (!user) return false
    return user.permissions?.includes(`${resource}:${action}`) || false
  }

  /**
   * Enable MFA
   */
  async enableMFA(type: 'totp' | 'sms' = 'totp') {
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await this.client.rpc('enable_mfa', {
      p_user_id: user.id,
      p_mfa_type: type
    } as any)

    if (error) throw error
    return data
  }

  /**
   * Verify MFA code
   */
  async verifyMFA(code: string, type: 'totp' | 'sms' | 'backup_code' = 'totp') {
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await this.client.rpc('verify_mfa_code', {
      p_user_id: user.id,
      p_code: code,
      p_challenge_type: type
    } as any)

    if (error) throw error
    return data
  }

  /**
   * Get OAuth scopes for provider
   */
  private getOAuthScopes(provider: string): string | undefined {
    const scopes: Record<string, string> = {
      google: 'openid email profile',
      github: 'read:user user:email',
      facebook: 'email public_profile'
    }
    return scopes[provider]
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return this.client.auth.onAuthStateChange(callback)
  }
}

// Export singleton instance
export const authService = new AuthService()

// Export types
export type { Database }
