/**
 * OAuth Provider Authentication Initiation Route
 * Epic 2 Story 2.3: Social Media Login Integration
 * 
 * Handles OAuth authentication initiation for social providers
 * with PKCE security and comprehensive error handling.
 */

import { NextRequest, NextResponse } from 'next/server'
import { oauthConfig, isValidOAuthProvider } from '@/lib/auth/oauth-config'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { createOAuthState } from '@/lib/auth/state-validation'
import { validateRedirectUri } from '@/lib/auth/redirect-validation'
import { checkOAuthRateLimit, getIpIdentifier, oauthRateLimiter } from '@/lib/auth/oauth-rate-limiting'

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const ipIdentifier = getIpIdentifier(request)
  
  try {
    // Rate limiting check
    const rateLimitResult = await checkOAuthRateLimit(
      'oauth_initiation',
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
      return NextResponse.json(
        { error: 'Invalid OAuth provider', code: 'INVALID_PROVIDER' },
        { status: 400 }
      )
    }

    // Get and validate request parameters
    const redirectTo = searchParams.get('redirect_to') || '/dashboard'
    const scopes = searchParams.get('scopes')?.split(',') || undefined
    
    // Validate redirect URI to prevent open redirects
    const redirectValidation = validateRedirectUri(redirectTo)
    if (!redirectValidation.valid) {
      await logAuthEvent({
        eventType: 'oauth_initiation_invalid_redirect',
        provider,
        success: false,
        error: `Invalid redirect URI: ${redirectValidation.error}`,
        metadata: { redirectTo },
        request
      })
      
      return NextResponse.json(
        { 
          error: 'Invalid redirect destination',
          code: 'INVALID_REDIRECT_URI',
          details: redirectValidation.error
        },
        { status: 400 }
      )
    }
    
    const safeRedirectTo = redirectValidation.sanitizedUrl || '/dashboard'
    
    // Generate HMAC-signed secure state parameter
    const encodedState = createOAuthState(provider, safeRedirectTo)
    
    // Get redirect URI from environment or construct
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const redirectUri = `${baseUrl}/api/auth/oauth/${provider}/callback`
    
    // Generate authorization URL
    const authUrl = await oauthConfig.generateAuthorizationURL(
      provider,
      redirectUri,
      encodedState,
      scopes
    )
    
    if (!authUrl) {
      return NextResponse.json(
        { error: 'OAuth provider not configured', code: 'PROVIDER_NOT_CONFIGURED' },
        { status: 503 }
      )
    }
    
    // Store state in secure HTTP-only cookie for CSRF protection
    const response = NextResponse.redirect(authUrl)
    response.cookies.set(`oauth_state_${provider}`, encodedState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/'
    })
    
    // Record successful OAuth initiation
    await oauthRateLimiter.recordSuccess(
      'oauth_initiation',
      ipIdentifier,
      { provider, redirectTo: safeRedirectTo, scopes }
    )
    
    // Log authentication initiation
    await logAuthEvent({
      eventType: 'oauth_initiation',
      provider,
      success: true,
      metadata: { redirectTo: safeRedirectTo, scopes },
      request
    })
    
    return response
    
  } catch (error) {
    console.error('OAuth initiation error:', error)
    
    // Record failure for rate limiting with penalty
    await oauthRateLimiter.recordFailure(
      'oauth_initiation',
      ipIdentifier,
      'internal_error',
      { 
        provider: params.provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    )
    
    await logAuthEvent({
      eventType: 'oauth_initiation',
      provider: params.provider,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      request
    })
    
    return NextResponse.json(
      { 
        error: 'Failed to initiate OAuth flow', 
        code: 'OAUTH_INITIATION_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
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