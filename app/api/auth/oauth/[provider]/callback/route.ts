/**
 * OAuth Provider Authentication Callback Route
 * Epic 2 Story 2.3: Social Media Login Integration
 * 
 * Handles OAuth authentication callbacks from social providers,
 * validates tokens, creates/links accounts, and manages sessions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ProfileInsert } from '@/lib/supabase/database.types'
import { oauthConfig, isValidOAuthProvider, OAuthProvider } from '@/lib/auth/oauth-config'
import { headers } from 'next/headers'
import { AccountLinkingManager } from '@/lib/auth/account-linking'
import { ProfileSyncManager } from '@/lib/auth/profile-sync'
import { validateSecureState } from '@/lib/auth/state-validation'
import { encryptToken } from '@/lib/auth/token-encryption'
import { validateRedirectUri } from '@/lib/auth/redirect-validation'
import { checkOAuthRateLimit, getIpIdentifier, oauthRateLimiter } from '@/lib/auth/oauth-rate-limiting'

interface OAuthCallbackError {
  error: string
  error_description?: string
  error_uri?: string
  state?: string
}

interface OAuthCallbackSuccess {
  code: string
  state: string
  scope?: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const startTime = Date.now()
  const ipIdentifier = getIpIdentifier(request)
  
  try {
    // Rate limiting check
    const rateLimitResult = await checkOAuthRateLimit(
      'oauth_callback',
      ipIdentifier,
      { provider: params.provider }
    )
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: rateLimitResult.error,
          code: 'RATE_LIMITED',
          retryAfter: rateLimitResult.retryAfter
        },
        { 
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
          }
        }
      )
    }
    const { provider } = params
    const { searchParams } = new URL(request.url)
    
    // Validate provider
    if (!isValidOAuthProvider(provider)) {
      return handleOAuthError('Invalid OAuth provider', 'INVALID_PROVIDER', 400)
    }

    // Check for OAuth errors first
    const error = searchParams.get('error')
    if (error) {
      const errorData: OAuthCallbackError = {
        error,
        error_description: searchParams.get('error_description') || undefined,
        error_uri: searchParams.get('error_uri') || undefined,
        state: searchParams.get('state') || undefined
      }
      
      await logAuthEvent({
        eventType: 'oauth_callback_error',
        provider,
        success: false,
        error: `OAuth error: ${error} - ${errorData.error_description}`,
        metadata: errorData,
        request
      })
      
      return handleOAuthError(
        errorData.error_description || 'OAuth authentication failed',
        'OAUTH_ERROR',
        400,
        errorData
      )
    }

    // Get callback parameters
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const scope = searchParams.get('scope')
    
    if (!code || !state) {
      return handleOAuthError('Missing required OAuth parameters', 'MISSING_PARAMETERS', 400)
    }

    // Validate HMAC-signed state parameter (Enhanced CSRF protection)
    const storedState = request.cookies.get(`oauth_state_${provider}`)?.value
    if (!storedState) {
      await logAuthEvent({
        eventType: 'oauth_csrf_violation',
        provider,
        success: false,
        error: 'Missing stored state parameter',
        metadata: { receivedState: state?.substring(0, 20) + '...', hasStoredState: false },
        request
      })
      
      return handleOAuthError('Missing state parameter', 'CSRF_VIOLATION', 400)
    }

    // Validate the signed state parameter
    const stateValidation = validateSecureState(state, provider)
    if (!stateValidation.valid || !stateValidation.payload) {
      await logAuthEvent({
        eventType: 'oauth_csrf_violation',
        provider,
        success: false,
        error: `State validation failed: ${stateValidation.error}`,
        metadata: { 
          receivedState: state?.substring(0, 20) + '...',
          validationError: stateValidation.error
        },
        request
      })
      
      return handleOAuthError(
        stateValidation.error || 'Invalid state parameter',
        'CSRF_VIOLATION',
        400
      )
    }

    const statePayload = stateValidation.payload
    
    // Validate redirect URI to prevent open redirects
    const redirectValidation = validateRedirectUri(statePayload.redirectTo)
    if (!redirectValidation.valid) {
      await logAuthEvent({
        eventType: 'oauth_redirect_validation_failed',
        provider,
        success: false,
        error: `Invalid redirect URI: ${redirectValidation.error}`,
        metadata: { redirectTo: statePayload.redirectTo },
        request
      })
      
      return handleOAuthError(
        'Invalid redirect destination',
        'INVALID_REDIRECT_URI',
        400
      )
    }

    // Validate OAuth callback
    const validation = await oauthConfig.validateOAuthCallback(provider, code, state, state)
    if (!validation.valid) {
      await logAuthEvent({
        eventType: 'oauth_validation_failed',
        provider,
        success: false,
        error: validation.error,
        metadata: { code: code.substring(0, 10) + '...', state: state.substring(0, 20) + '...' },
        request
      })
      
      return handleOAuthError(validation.error || 'OAuth validation failed', 'VALIDATION_FAILED', 400)
    }

    // Exchange code for access token
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const redirectUri = `${baseUrl}/api/auth/oauth/${provider}/callback`
    
    const tokenData = await oauthConfig.exchangeCodeForToken(provider, code, state, redirectUri)
    if (!tokenData) {
      await logAuthEvent({
        eventType: 'oauth_token_exchange_failed',
        provider,
        success: false,
        error: 'Token exchange failed',
        request
      })
      
      return handleOAuthError('Failed to exchange authorization code', 'TOKEN_EXCHANGE_FAILED', 500)
    }

    // Get user info from provider
    const providerUserInfo = await oauthConfig.getUserInfo(provider, tokenData.access_token)
    if (!providerUserInfo) {
      await logAuthEvent({
        eventType: 'oauth_user_info_failed',
        provider,
        success: false,
        error: 'Failed to get user info from provider',
        request
      })
      
      return handleOAuthError('Failed to get user information', 'USER_INFO_FAILED', 500)
    }

    // Process OAuth authentication
    const authResult = await processOAuthAuthentication({
      provider,
      tokenData,
      providerUserInfo,
      request
    })
    
    if (!authResult.success) {
      return handleOAuthError(authResult.error || 'Authentication failed', 'AUTH_PROCESSING_FAILED', 500)
    }

    // Clear OAuth state cookie  
    const safeRedirectUrl = redirectValidation.sanitizedUrl || '/dashboard'
    const response = NextResponse.redirect(new URL(safeRedirectUrl, request.url))
    
    // Record successful OAuth callback for rate limiting
    await oauthRateLimiter.recordSuccess(
      'oauth_callback',
      ipIdentifier,
      { 
        provider,
        userId: authResult.userId,
        duration: Date.now() - startTime
      }
    )
    response.cookies.delete(`oauth_state_${provider}`)

    // Set authentication session (if using custom session management)
    if (authResult.sessionToken) {
      response.cookies.set('session_token', authResult.sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/'
      })
    }

    await logAuthEvent({
      eventType: 'oauth_success',
      provider,
      success: true,
      metadata: {
        userId: authResult.userId,
        isNewUser: authResult.isNewUser,
        linkedAccount: authResult.linkedAccount,
        redirectTo: statePayload.redirectTo
      },
      request
    })

    return response

  } catch (error) {
    console.error('OAuth callback error:', error)
    
    // Record failure for rate limiting with penalty
    await oauthRateLimiter.recordFailure(
      'oauth_callback',
      ipIdentifier,
      'internal_error',
      { 
        provider: params.provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    )
    
    await logAuthEvent({
      eventType: 'oauth_callback_error',
      provider: params.provider,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      request
    })
    
    return handleOAuthError(
      'Internal server error during OAuth callback',
      'INTERNAL_ERROR',
      500,
      error instanceof Error ? { message: error.message } : undefined
    )
  }
}

async function processOAuthAuthentication({
  provider,
  tokenData,
  providerUserInfo,
  request
}: {
  provider: OAuthProvider
  tokenData: any
  providerUserInfo: any
  request: NextRequest
}): Promise<{
  success: boolean
  error?: string
  userId?: string
  sessionToken?: string
  isNewUser?: boolean
  linkedAccount?: boolean
}> {
  try {
    const supabase = createClient()
    
    // Normalize provider user info
    const normalizedUserInfo = normalizeProviderUserInfo(provider, providerUserInfo)
    
    // Check if OAuth connection already exists
    const { data: existingConnection } = await (supabase as any)
      .from('user_oauth_connections')
      .select(`
        *,
        profiles:user_id (*)
      `)
      .eq('provider_id', (await getProviderConfigId(provider)))
      .eq('provider_user_id', normalizedUserInfo.id)
      .maybeSingle()

    let userId: string
    let isNewUser = false
    let linkedAccount = false

    if (existingConnection) {
      // Existing OAuth connection - update tokens and sign in
      userId = (existingConnection as any).user_id
      
      await (supabase as any)
        .from('user_oauth_connections')
        .update({
          access_token_encrypted: await encryptToken(tokenData.access_token),
          refresh_token_encrypted: tokenData.refresh_token ? await encryptToken(tokenData.refresh_token) : null,
          id_token_encrypted: tokenData.id_token ? await encryptToken(tokenData.id_token) : null,
          token_expires_at: tokenData.expires_in 
            ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
            : null,
          provider_data: normalizedUserInfo,
          last_used_at: new Date().toISOString()
        })
        .eq('id', (existingConnection as any).id)

      // Sync profile data
      const profileSync = new ProfileSyncManager()
      await profileSync.syncProviderProfile(userId, provider, normalizedUserInfo)
      
    } else {
      // New OAuth connection - check if user exists by email
      let existingUser: { id: string } | null = null
      
      if (normalizedUserInfo.email) {
        const { data } = await (supabase as any)
          .from('profiles')
          .select('id')
          .eq('email', normalizedUserInfo.email)
          .maybeSingle()
        
        existingUser = data as { id: string } | null
      }

      if (existingUser) {
        // Link OAuth account to existing user
        userId = existingUser.id
        linkedAccount = true
        
        const accountLinking = new AccountLinkingManager()
        const linkResult = await accountLinking.linkOAuthAccount(
          userId,
          provider,
          {
            provider_user_id: normalizedUserInfo.id,
            provider_email: normalizedUserInfo.email,
            provider_username: normalizedUserInfo.username,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            id_token: tokenData.id_token,
            expires_in: tokenData.expires_in,
            provider_data: normalizedUserInfo
          }
        )
        
        if (!linkResult.success) {
          return { success: false, error: linkResult.error }
        }
        
      } else {
        // Create new user account
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: normalizedUserInfo.email,
          email_confirm: true,
          user_metadata: {
            provider: provider,
            provider_id: normalizedUserInfo.id,
            full_name: normalizedUserInfo.name,
            avatar_url: normalizedUserInfo.picture,
            oauth_signup: true
          }
        })

        if (authError || !authUser.user) {
          console.error('Failed to create user:', authError)
          return { success: false, error: 'Failed to create user account' }
        }

        userId = authUser.user.id
        isNewUser = true

        // Create profile
        const profileData: ProfileInsert = {
          id: userId,
          display_name: normalizedUserInfo.name,
          avatar_url: normalizedUserInfo.picture,
          email: normalizedUserInfo.email,
          email_verified: true,
          account_status: 'active',
          created_at: new Date().toISOString()
        }
        
        await (supabase as any)
          .from('profiles')
          .insert([profileData])

        // Assign default user role
        const { data: userRole } = await (supabase as any)
          .from('roles')
          .select('id')
          .eq('name', 'user')
          .single()

        if (userRole) {
          await (supabase as any)
            .from('user_roles')
            .insert([{
              user_id: userId,
              role_id: userRole.id,
              is_active: true
            }])
        }

        // Create OAuth connection
        const providerId = await getProviderConfigId(provider)
        await (supabase as any)
          .from('user_oauth_connections')
          .insert([{
            user_id: userId,
            provider_id: providerId,
            provider_user_id: normalizedUserInfo.id,
            provider_email: normalizedUserInfo.email,
            provider_username: normalizedUserInfo.username,
            access_token_encrypted: await encryptToken(tokenData.access_token),
            refresh_token_encrypted: tokenData.refresh_token ? await encryptToken(tokenData.refresh_token) : null,
            id_token_encrypted: tokenData.id_token ? await encryptToken(tokenData.id_token) : null,
            token_expires_at: tokenData.expires_in 
              ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
              : null,
            provider_data: normalizedUserInfo,
            is_primary: true,
            is_verified: true,
            connected_at: new Date().toISOString()
          }])
      }
    }

    // Create session if needed (using Supabase Auth)
    const { data: session, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedUserInfo.email,
      options: {
        redirectTo: '/'
      }
    })

    if (sessionError) {
      console.error('Session generation error:', sessionError)
    }

    return {
      success: true,
      userId,
      sessionToken: (session as any)?.properties?.access_token,
      isNewUser,
      linkedAccount
    }

  } catch (error) {
    console.error('OAuth processing error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'OAuth processing failed' 
    }
  }
}

function normalizeProviderUserInfo(provider: OAuthProvider, userInfo: any) {
  switch (provider) {
    case 'google':
      return {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        verified_email: userInfo.verified_email,
        given_name: userInfo.given_name,
        family_name: userInfo.family_name,
        locale: userInfo.locale
      }
    
    case 'facebook':
      return {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture?.data?.url,
        first_name: userInfo.first_name,
        last_name: userInfo.last_name
      }
    
    case 'github':
      return {
        id: userInfo.id.toString(),
        email: userInfo.email,
        name: userInfo.name || userInfo.login,
        username: userInfo.login,
        picture: userInfo.avatar_url,
        bio: userInfo.bio,
        location: userInfo.location,
        company: userInfo.company,
        blog: userInfo.blog
      }
    
    case 'apple':
      return {
        id: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name ? `${userInfo.name.firstName} ${userInfo.name.lastName}` : null,
        email_verified: userInfo.email_verified === 'true',
        is_private_email: userInfo.is_private_email === 'true'
      }
    
    default:
      return userInfo
  }
}

async function getProviderConfigId(provider: OAuthProvider): Promise<string> {
  const supabase = createClient()
  const { data } = await (supabase as any)
    .from('oauth_providers')
    .select('id')
    .eq('provider_name', provider)
    .single()
  
  return data?.id || ''
}

// Removed insecure token encryption - now using secure module

function handleOAuthError(
  message: string, 
  code: string, 
  status: number, 
  details?: any
): NextResponse {
  const errorUrl = new URL('/auth/error', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')
  errorUrl.searchParams.set('error', code)
  errorUrl.searchParams.set('message', message)
  
  if (details) {
    errorUrl.searchParams.set('details', JSON.stringify(details))
  }
  
  return NextResponse.redirect(errorUrl)
}

async function logAuthEvent({
  eventType,
  provider,
  success,
  error,
  metadata,
  request
}: {
  eventType: string
  provider: string
  success: boolean
  error?: string
  metadata?: any
  request: NextRequest
}) {
  try {
    const supabase = createClient()
    const headersList = headers()
    const userAgent = headersList.get('user-agent') || 'unknown'
    const forwardedFor = headersList.get('x-forwarded-for')
    const realIp = headersList.get('x-real-ip')
    const ipAddress = forwardedFor?.split(',')[0] || realIp || 'unknown'
    
    await (supabase as any).from('auth_audit_logs').insert({
      event_type: eventType,
      event_category: 'oauth',
      success,
      failure_reason: error,
      event_data: {
        provider,
        ip_address: ipAddress,
        user_agent: userAgent,
        ...metadata
      },
      ip_address: ipAddress,
      user_agent: userAgent
    })
  } catch (logError) {
    console.error('Failed to log auth event:', logError)
  }
}