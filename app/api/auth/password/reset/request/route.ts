/**
 * Password Reset Request API Endpoint
 * Epic 2 Story 2.6: Password Management and Account Security
 * 
 * POST /api/auth/password/reset/request
 * Initiates password reset process with secure token generation
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { initiatePasswordReset } from '@/lib/auth/password-reset'
import { processSecurityEvent } from '@/lib/auth/security-monitor'
import { getClientIP } from '@/lib/security/server'
import { validateCSRFToken } from '@/lib/security/csrf'

// Request validation schema
const resetRequestSchema = z.object({
  email: z.string().email('Valid email address required'),
  method: z.enum(['email', 'sms', 'admin']).default('email'),
  requireMFA: z.boolean().default(false),
  csrfToken: z.string().min(1, 'CSRF token required')
})

type ResetRequestData = z.infer<typeof resetRequestSchema>

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const clientIP = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Parse request body
    const body = await request.json()
    const validationResult = resetRequestSchema.safeParse(body)

    if (!validationResult.success) {
      await processSecurityEvent({
        type: 'authentication_bypass_attempt',
        severity: 'low',
        ipAddress: clientIP,
        userAgent,
        description: 'Invalid password reset request format',
        evidence: {
          errors: validationResult.error.errors,
          body: JSON.stringify(body)
        },
        source: 'authentication'
      }, request)

      return NextResponse.json({
        success: false,
        error: 'Invalid request format',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const { email, method, requireMFA, csrfToken } = validationResult.data

    // CSRF token validation
    const csrfValid = await validateCSRFToken(csrfToken, request)
    if (!csrfValid) {
      await processSecurityEvent({
        type: 'authentication_bypass_attempt',
        severity: 'high',
        ipAddress: clientIP,
        userAgent,
        description: 'Invalid CSRF token in password reset request',
        evidence: {
          email,
          providedToken: csrfToken.substring(0, 8) + '...',
          method
        },
        source: 'authentication'
      }, request)

      return NextResponse.json({
        success: false,
        error: 'Invalid security token'
      }, { status: 403 })
    }

    // Log password reset attempt
    await processSecurityEvent({
      type: 'password_reset_requested',
      severity: 'low',
      ipAddress: clientIP,
      userAgent,
      description: `Password reset requested for ${email}`,
      evidence: {
        email,
        method,
        requireMFA,
        requestTime: new Date()
      },
      source: 'authentication'
    }, request)

    // Initiate password reset
    const resetResult = await initiatePasswordReset({
      email,
      method,
      requireMFA,
      metadata: {
        userAgent,
        requestTime: new Date(),
        clientIP
      }
    }, request)

    const processingTime = Date.now() - startTime

    if (resetResult.rateLimited) {
      await processSecurityEvent({
        type: 'rate_limit_exceeded',
        severity: 'medium',
        ipAddress: clientIP,
        userAgent,
        description: 'Password reset rate limit exceeded',
        evidence: {
          email,
          method,
          errors: resetResult.errors
        },
        source: 'authentication'
      }, request)

      return NextResponse.json({
        success: false,
        error: 'Too many reset requests',
        details: resetResult.errors,
        rateLimited: true
      }, { status: 429 }) // Too Many Requests
    }

    if (!resetResult.success) {
      await processSecurityEvent({
        type: 'password_reset_failed',
        severity: 'medium',
        ipAddress: clientIP,
        userAgent,
        description: 'Password reset request failed',
        evidence: {
          email,
          method,
          errors: resetResult.errors,
          processingTime
        },
        source: 'authentication'
      }, request)

      return NextResponse.json({
        success: false,
        error: 'Reset request failed',
        details: resetResult.errors
      }, { status: 400 })
    }

    // Log successful reset request
    await processSecurityEvent({
      type: 'password_reset_initiated',
      severity: 'low',
      ipAddress: clientIP,
      userAgent,
      description: `Password reset initiated successfully for ${email}`,
      evidence: {
        email,
        method,
        tokenId: resetResult.tokenId,
        expiresAt: resetResult.expiresAt,
        processingTime
      },
      source: 'authentication'
    }, request)

    // Return success response (without sensitive data)
    return NextResponse.json({
      success: true,
      message: 'If an account with this email exists, a password reset link has been sent.',
      expiresAt: resetResult.expiresAt,
      method,
      processingTime
    })

  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error('Password reset request error:', error)

    await processSecurityEvent({
      type: 'authentication_bypass_attempt',
      severity: 'high',
      ipAddress: getClientIP(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      description: 'Password reset API system error',
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

// Rate limiting middleware for additional protection
export async function middleware(request: NextRequest) {
  const clientIP = getClientIP(request)
  
  // Check for basic rate limiting at the middleware level
  // This provides an additional layer of protection
  const rateLimitKey = `password_reset_rate_${clientIP}`
  
  // Implementation would use Redis or similar for distributed rate limiting
  // For now, we rely on the application-level rate limiting
  
  return NextResponse.next()
}