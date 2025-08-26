/**
 * Social Account Linking API Route
 * Epic 2 Story 2.3: Social Media Login Integration
 * 
 * API endpoint for linking additional social accounts to existing user accounts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AccountLinkingManager } from '@/lib/auth/account-linking'
import { oauthConfig, isValidOAuthProvider, OAuthProvider } from '@/lib/auth/oauth-config'

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
    const { provider, authorization_code, redirect_uri, state } = body

    // Validate required fields
    if (!provider || !authorization_code || !redirect_uri) {
      return NextResponse.json(
        { error: 'Missing required fields', code: 'MISSING_FIELDS' },
        { status: 400 }
      )
    }

    // Validate provider
    if (!isValidOAuthProvider(provider)) {
      return NextResponse.json(
        { error: 'Invalid OAuth provider', code: 'INVALID_PROVIDER' },
        { status: 400 }
      )
    }

    // Validate OAuth callback
    const validation = await oauthConfig.validateOAuthCallback(
      provider,
      authorization_code,
      state || '',
      state || ''
    )

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error, code: 'VALIDATION_FAILED' },
        { status: 400 }
      )
    }

    // Exchange authorization code for tokens
    const tokenData = await oauthConfig.exchangeCodeForToken(
      provider,
      authorization_code,
      state || '',
      redirect_uri
    )

    if (!tokenData) {
      return NextResponse.json(
        { error: 'Failed to exchange authorization code', code: 'TOKEN_EXCHANGE_FAILED' },
        { status: 500 }
      )
    }

    // Get user info from provider
    const providerUserInfo = await oauthConfig.getUserInfo(provider, tokenData.access_token)
    if (!providerUserInfo) {
      return NextResponse.json(
        { error: 'Failed to get user information from provider', code: 'USER_INFO_FAILED' },
        { status: 500 }
      )
    }

    // Link the account
    const accountLinking = new AccountLinkingManager()
    const linkResult = await accountLinking.linkOAuthAccount(userId, provider, {
      provider_user_id: providerUserInfo.id || providerUserInfo.sub,
      provider_email: providerUserInfo.email,
      provider_username: providerUserInfo.username || providerUserInfo.login,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      id_token: tokenData.id_token,
      expires_in: tokenData.expires_in,
      provider_data: providerUserInfo
    })

    if (!linkResult.success) {
      return NextResponse.json(
        { 
          error: linkResult.error, 
          code: 'ACCOUNT_LINKING_FAILED',
          conflicts: linkResult.conflicts 
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Account linked successfully',
      connectionId: linkResult.connectionId,
      provider,
      conflicts: linkResult.conflicts
    })

  } catch (error) {
    console.error('Social account linking error:', error)
    
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

    // Get all linked accounts
    const accountLinking = new AccountLinkingManager()
    const linkedAccounts = await accountLinking.getLinkedAccounts(userId)

    return NextResponse.json({
      linkedAccounts,
      count: linkedAccounts.length
    })

  } catch (error) {
    console.error('Get linked accounts error:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to get linked accounts',
        code: 'GET_ACCOUNTS_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}