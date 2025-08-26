/**
 * Email Verification API Route
 * Epic 2 Story 2.5: User Onboarding and Email Verification Infrastructure
 * 
 * Handles email verification token generation, validation, and resend functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { emailVerificationService, generateVerificationUrl } from '@/lib/auth/email-verification';
import { emailTemplateService } from '@/lib/auth/email-templates';
import { rateLimit } from '@/lib/auth/rate-limiting';

/**
 * POST /api/onboarding/verify-email
 * Generate and send email verification token
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const headersList = headers();
    const userAgent = headersList.get('user-agent') || 'Unknown';
    const ip = headersList.get('x-forwarded-for') || 'Unknown';

    // Get user from session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { emailAddress, verificationType = 'registration' } = body;

    // Use user's email if not provided
    const targetEmail = emailAddress || user.email;

    if (!targetEmail) {
      return NextResponse.json(
        { error: 'Email address is required' },
        { status: 400 }
      );
    }

    // Rate limiting
    const rateLimitKey = `email_verification_${targetEmail}`;
    const rateLimitResult = await rateLimit(rateLimitKey, 'email_verification_send', 5, 3600);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. Please wait before requesting another verification email.',
          retryAfter: rateLimitResult.retryAfter
        },
        { status: 429 }
      );
    }

    // Generate verification token
    const tokenResult = await emailVerificationService.generateVerificationToken(
      user.id,
      targetEmail,
      verificationType
    );

    if (!tokenResult.success) {
      return NextResponse.json(
        { error: tokenResult.error },
        { status: 400 }
      );
    }

    // Generate verification URL
    const verificationUrl = generateVerificationUrl(tokenResult.token!);

    // Prepare email context
    const emailContext = {
      user: {
        id: user.id,
        email: targetEmail,
        displayName: user.user_metadata?.display_name,
        firstName: user.user_metadata?.first_name,
        lastName: user.user_metadata?.last_name,
      },
      verification: {
        token: tokenResult.token!,
        verificationUrl,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      platform: {
        name: process.env.NEXT_PUBLIC_PLATFORM_NAME || 'Lawless Directory',
        url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        supportEmail: process.env.SUPPORT_EMAIL || 'support@lawlessdirectory.com',
      },
    };

    // Render email template
    const templateId = verificationType === 'email_change' ? 'email_change_verification' : 'email_verification';
    const emailContent = await emailTemplateService.renderTemplate(templateId, emailContext);

    if (!emailContent) {
      return NextResponse.json(
        { error: 'Failed to generate email content' },
        { status: 500 }
      );
    }

    // Send email via Supabase
    const { error: emailError } = await supabase.auth.resend({
      type: 'signup',
      email: targetEmail,
      options: {
        emailRedirectTo: verificationUrl,
      }
    });

    // Track email delivery (even if Supabase sending fails, we want to track the attempt)
    await emailVerificationService.trackEmailDelivery(
      tokenResult.token!, // We'll need to store token ID in the service
      targetEmail,
      'email_verification',
      templateId,
      emailError ? 'failed' : 'sent',
      {
        provider: 'supabase',
        errorMessage: emailError?.message,
      }
    );

    if (emailError) {
      console.error('Error sending verification email:', emailError);
      return NextResponse.json(
        { error: 'Failed to send verification email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verification email sent successfully',
      expiresIn: '24 hours',
    });

  } catch (error) {
    console.error('Error in email verification endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/onboarding/verify-email?token=xxx
 * Verify email verification token
 */
export async function GET(request: NextRequest) {
  try {
    const headersList = headers();
    const userAgent = headersList.get('user-agent') || 'Unknown';
    const ip = headersList.get('x-forwarded-for') || 'Unknown';

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }

    // Validate token
    const validationResult = await emailVerificationService.validateToken(
      token,
      userAgent,
      ip
    );

    if (!validationResult.isValid) {
      const statusCode = validationResult.isExpired ? 410 : 400;
      
      return NextResponse.json(
        {
          error: validationResult.error,
          isExpired: validationResult.isExpired,
          attemptsRemaining: validationResult.attemptsRemaining,
        },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      userId: validationResult.userId,
    });

  } catch (error) {
    console.error('Error in email verification validation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/onboarding/verify-email
 * Check token status without consuming an attempt
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    const status = await emailVerificationService.checkTokenStatus(token);

    return NextResponse.json({
      success: true,
      ...status,
    });

  } catch (error) {
    console.error('Error checking token status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}