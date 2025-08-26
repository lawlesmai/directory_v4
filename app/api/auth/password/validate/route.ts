/**
 * Password Validation API Endpoint
 * Epic 2 Story 2.6: Password Management and Account Security
 * 
 * POST /api/auth/password/validate
 * Validates password strength and compliance with security policies
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validatePasswordSecurity } from '@/lib/auth/password-policy'
import { checkAccountLockout } from '@/lib/auth/account-lockout'
import { processSecurityEvent } from '@/lib/auth/security-monitor'
import { getClientIP } from '@/lib/security/server'
import { createClient } from '@/lib/supabase/server'

// Request validation schema
const validatePasswordSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  userId: z.string().uuid().optional(),
  role: z.enum(['user', 'business_owner', 'admin']).optional(),
  personalInfo: z.object({
    email: z.string().email().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional()
  }).optional(),
  context: z.enum(['registration', 'password_change', 'password_reset']).default('registration')
})

type ValidatePasswordRequest = z.infer<typeof validatePasswordSchema>

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const clientIP = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Parse and validate request
    const body = await request.json()
    const validationResult = validatePasswordSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const { password, userId, role, personalInfo, context } = validationResult.data

    // Check if user/IP is locked out
    const lockoutStatus = await checkAccountLockout(userId, clientIP, role)
    if (lockoutStatus.isLocked) {
      // Log security event
      await processSecurityEvent({
        type: 'rate_limit_exceeded',
        severity: 'medium',
        userId,
        ipAddress: clientIP,
        userAgent,
        description: 'Password validation attempted while account locked',
        evidence: {
          lockoutType: lockoutStatus.lockoutType,
          reason: lockoutStatus.reason,
          context
        },
        source: 'authentication'
      }, request)

      return NextResponse.json({
        success: false,
        error: 'Account temporarily locked',
        lockoutStatus: {
          locked: true,
          until: lockoutStatus.lockedUntil,
          reason: lockoutStatus.reason
        }
      }, { status: 423 }) // 423 Locked
    }

    // Validate password
    const passwordValidation = await validatePasswordSecurity(
      password,
      userId,
      role || 'user',
      personalInfo
    )

    // Log validation attempt
    await processSecurityEvent({
      type: passwordValidation.compliant ? 'password_policy_validation_success' : 'password_policy_violation',
      severity: passwordValidation.compliant ? 'low' : 'medium',
      userId,
      ipAddress: clientIP,
      userAgent,
      description: `Password validation for ${context}: ${passwordValidation.compliant ? 'passed' : 'failed'}`,
      evidence: {
        context,
        score: passwordValidation.score,
        level: passwordValidation.level,
        breachDetected: passwordValidation.feedback.warnings.some(w => w.includes('breach')),
        reuseDetected: passwordValidation.feedback.warnings.some(w => w.includes('reuse')),
        violations: passwordValidation.feedback.requirements
          .filter(req => req.required && !req.met)
          .map(req => req.name)
      },
      source: 'authentication'
    }, request)

    // Prepare response
    const response = {
      success: true,
      validation: {
        compliant: passwordValidation.compliant,
        score: passwordValidation.score,
        level: passwordValidation.level,
        timeToBreak: passwordValidation.timeToBreak,
        feedback: {
          suggestions: passwordValidation.feedback.suggestions,
          warnings: passwordValidation.feedback.warnings,
          requirements: passwordValidation.feedback.requirements.map(req => ({
            name: req.name,
            description: req.description,
            met: req.met,
            required: req.required
          })),
          entropy: Math.round(passwordValidation.feedback.entropy * 100) / 100
        }
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Password validation API error:', error)

    // Log error as security event
    await processSecurityEvent({
      type: 'authentication_bypass_attempt',
      severity: 'medium',
      ipAddress: getClientIP(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      description: 'Password validation API error',
      evidence: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      source: 'system'
    }, request)

    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// GET endpoint for password policy information
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role') || 'user'

    // Validate role parameter
    if (!['user', 'business_owner', 'admin'].includes(role)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid role parameter'
      }, { status: 400 })
    }

    // Get password policy for role
    const { passwordPolicyEngine } = await import('@/lib/auth/password-policy')
    const policy = passwordPolicyEngine.getPolicyForRole(role)

    return NextResponse.json({
      success: true,
      policy: {
        minLength: policy.minLength,
        maxLength: policy.maxLength,
        requireComplexity: policy.requireComplexity,
        checkBreaches: policy.checkBreaches,
        preventReuse: policy.preventReuse,
        role: policy.role
      }
    })

  } catch (error) {
    console.error('Password policy API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}