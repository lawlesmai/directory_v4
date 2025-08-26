/**
 * Password Reset Completion API Endpoint
 * Epic 2 Story 2.6: Password Management and Account Security
 * 
 * POST /api/auth/password/reset/complete
 * Completes password reset process with new password validation
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { completePasswordReset, validateResetToken } from '@/lib/auth/password-reset'
import { processSecurityEvent } from '@/lib/auth/security-monitor'
import { getClientIP } from '@/lib/security/server'
import { validateCSRFToken } from '@/lib/security/csrf'
import { createClient } from '@/lib/supabase/server'

// Request validation schema
const resetCompleteSchema = z.object({
  tokenId: z.string().min(1, 'Token ID required'),
  token: z.string().min(32, 'Invalid token format'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Password confirmation required'),
  mfaToken: z.string().optional(),
  csrfToken: z.string().min(1, 'CSRF token required')
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
})

type ResetCompleteData = z.infer<typeof resetCompleteSchema>

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const clientIP = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Parse request body
    const body = await request.json()
    const validationResult = resetCompleteSchema.safeParse(body)

    if (!validationResult.success) {
      await processSecurityEvent({
        type: 'authentication_bypass_attempt',
        severity: 'medium',
        ipAddress: clientIP,
        userAgent,
        description: 'Invalid password reset completion request',
        evidence: {
          errors: validationResult.error.errors,
          tokenId: body.tokenId?.substring(0, 8) + '...' || 'missing'
        },
        source: 'authentication'
      }, request)

      return NextResponse.json({
        success: false,
        error: 'Invalid request format',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const { tokenId, token, newPassword, mfaToken, csrfToken } = validationResult.data

    // CSRF token validation
    const csrfValid = await validateCSRFToken(request)
    if (!csrfValid) {
      await processSecurityEvent({
        type: 'authentication_bypass_attempt',
        severity: 'high',
        ipAddress: clientIP,
        userAgent,
        description: 'Invalid CSRF token in password reset completion',
        evidence: {
          tokenId: tokenId.substring(0, 8) + '...',
          providedCsrfToken: csrfToken.substring(0, 8) + '...'
        },
        source: 'authentication'
      }, request)

      return NextResponse.json({
        success: false,
        error: 'Invalid security token'
      }, { status: 403 })
    }

    // First, validate the reset token
    const tokenValidation = await validateResetToken(tokenId, token, request)
    
    if (!tokenValidation.valid) {
      await processSecurityEvent({
        type: 'authentication_bypass_attempt',
        severity: 'high',
        userId: tokenValidation.userId,
        ipAddress: clientIP,
        userAgent,
        description: 'Invalid password reset token used',
        evidence: {
          tokenId: tokenId.substring(0, 8) + '...',
          errors: tokenValidation.errors,
          attemptsRemaining: tokenValidation.attemptsRemaining
        },
        source: 'authentication'
      }, request)

      return NextResponse.json({
        success: false,
        error: 'Invalid or expired reset token',
        details: tokenValidation.errors,
        attemptsRemaining: tokenValidation.attemptsRemaining
      }, { status: 400 })
    }

    // Log password reset attempt
    await processSecurityEvent({
      type: 'admin_action_suspicious',
      severity: 'low',
      userId: tokenValidation.userId,
      ipAddress: clientIP,
      userAgent,
      description: 'Password reset completion attempted',
      evidence: {
        tokenId: tokenId.substring(0, 8) + '...',
        requiresMFA: tokenValidation.requiresMFA,
        mfaProvided: !!mfaToken
      },
      source: 'authentication'
    }, request)

    // Complete password reset
    const resetResult = await completePasswordReset(
      tokenId,
      token,
      newPassword,
      request,
      mfaToken
    )

    const processingTime = Date.now() - startTime

    if (!resetResult.success) {
      const severity = resetResult.requiresMFA ? 'medium' : 'high'
      
      await processSecurityEvent({
        type: 'authentication_bypass_attempt',
        severity,
        userId: resetResult.userId || tokenValidation.userId,
        ipAddress: clientIP,
        userAgent,
        description: `Password reset failed: ${resetResult.errors?.join(', ')}`,
        evidence: {
          tokenId: tokenId.substring(0, 8) + '...',
          errors: resetResult.errors,
          requiresMFA: resetResult.requiresMFA,
          processingTime
        },
        source: 'authentication'
      }, request)

      const statusCode = resetResult.requiresMFA ? 202 : 400 // 202 Accepted for MFA requirement
      
      return NextResponse.json({
        success: false,
        error: resetResult.errors?.[0] || 'Password reset failed',
        details: resetResult.errors,
        requiresMFA: resetResult.requiresMFA
      }, { status: statusCode })
    }

    // Log successful password reset
    await processSecurityEvent({
      type: 'admin_action_suspicious',
      severity: 'low',
      userId: resetResult.userId,
      ipAddress: clientIP,
      userAgent,
      description: 'Password reset completed successfully',
      evidence: {
        tokenId: tokenId.substring(0, 8) + '...',
        securityEventId: resetResult.securityEventId,
        processingTime,
        method: 'token'
      },
      source: 'authentication'
    }, request)

    // Get user data for response (without sensitive information)
    const supabase = createClient()
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(resetResult.userId!)
    
    const userInfo = userData?.user ? {
      id: userData.user.id,
      email: userData.user.email,
      emailVerified: userData.user.email_confirmed_at != null,
      lastSignInAt: userData.user.last_sign_in_at
    } : undefined

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Password reset completed successfully',
      user: userInfo,
      securityEventId: resetResult.securityEventId,
      processingTime
    })

  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error('Password reset completion error:', error)

    await processSecurityEvent({
      type: 'admin_action_suspicious',
      severity: 'high',
      ipAddress: getClientIP(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      description: 'Password reset completion system error',
      evidence: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
        processingTime
      },
      source: 'system'
    }, request)

    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// GET endpoint to validate token without completing reset
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tokenId = searchParams.get('tokenId')
    const token = searchParams.get('token')

    if (!tokenId || !token) {
      return NextResponse.json({
        success: false,
        error: 'Token ID and token required'
      }, { status: 400 })
    }

    const clientIP = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Validate token
    const validation = await validateResetToken(tokenId, token, request)

    // Log validation attempt
    await processSecurityEvent({
      type: 'admin_action_suspicious',
      severity: 'low',
      userId: validation.userId,
      ipAddress: clientIP,
      userAgent,
      description: `Password reset token validation: ${validation.valid ? 'valid' : 'invalid'}`,
      evidence: {
        tokenId: tokenId.substring(0, 8) + '...',
        valid: validation.valid,
        errors: validation.errors,
        attemptsRemaining: validation.attemptsRemaining
      },
      source: 'authentication'
    }, request)

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid or expired token',
        details: validation.errors,
        attemptsRemaining: validation.attemptsRemaining
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      valid: true,
      expiresAt: validation.expiresAt,
      attemptsRemaining: validation.attemptsRemaining,
      requiresMFA: validation.requiresMFA
    })

  } catch (error) {
    console.error('Token validation error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}