/**
 * MFA Verification API Endpoints
 * Handles MFA code verification and challenge completion
 * 
 * The Lawless Directory - Epic 2 Story 2.4
 * Multi-Factor Authentication Infrastructure
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyTOTPCode } from '@/lib/auth/totp';
import { SMSVerificationService } from '@/lib/auth/sms-verification';
import { BackupCodeService } from '@/lib/auth/backup-codes';
import { DeviceTrustService } from '@/lib/auth/device-trust';
import { MFAAuditLogger } from '@/lib/auth/mfa-audit';
import type { Database } from '@/lib/supabase/database.types';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/auth/mfa/verify
 * Verifies MFA code/token during authentication or setup
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      code, 
      method, 
      challenge_id,
      device_fingerprint,
      remember_device = false,
      setup_mode = false
    } = body;

    // Validate required parameters
    if (!code || !method) {
      return NextResponse.json(
        { error: 'Code and method are required' },
        { status: 400 }
      );
    }

    // Get user from session
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: session } = await supabase.auth.getUser(token);
    
    if (!session.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const userId = session.user.id;
    const ipAddress = request.ip || '0.0.0.0';
    const userAgent = request.headers.get('user-agent') || '';
    const deviceId = request.headers.get('x-device-id');

    const startTime = Date.now();

    // Get user's MFA configuration
    const { data: mfaConfig, error: configError } = await supabase
      .from('auth_mfa_config')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (configError) {
      throw new Error(`Failed to get MFA config: ${configError.message}`);
    }

    let verificationResult: any = { valid: false };
    let riskFactors: string[] = [];

    // Verify based on method
    switch (method) {
      case 'totp':
        verificationResult = await verifyTOTPVerification(
          userId, 
          code, 
          mfaConfig, 
          setup_mode
        );
        break;

      case 'sms':
        if (!challenge_id) {
          return NextResponse.json(
            { error: 'Challenge ID required for SMS verification' },
            { status: 400 }
          );
        }
        verificationResult = await SMSVerificationService.verifyCode(
          challenge_id,
          code,
          { deviceId: deviceId || undefined, ipAddress, userAgent }
        );
        break;

      case 'backup_code':
        verificationResult = await BackupCodeService.verifyBackupCode(
          userId,
          code,
          { deviceId: deviceId || undefined, ipAddress, userAgent, challengeId: challenge_id }
        );
        break;

      case 'email':
        verificationResult = await verifyEmailCode(
          userId,
          challenge_id || '',
          code
        );
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid verification method' },
          { status: 400 }
        );
    }

    const responseTime = Date.now() - startTime;

    // Handle device trust if verification successful
    let deviceTrustResult: any = null;
    if (verificationResult.valid && device_fingerprint) {
      deviceTrustResult = await DeviceTrustService.registerDevice(
        userId,
        device_fingerprint,
        {
          ipAddress,
          userAgent,
          network: await getNetworkContext(ipAddress),
          geographic: await getGeographicContext(ipAddress)
        }
      );

      if (deviceTrustResult.success) {
        riskFactors.push(...(deviceTrustResult.riskFactors || []));
      }
    }

    // Log verification attempt
    await MFAAuditLogger.logMFAVerification({
      userId,
      method,
      success: verificationResult.valid,
      challengeId: challenge_id,
      deviceId: deviceId || undefined,
      ipAddress,
      userAgent,
      responseTimeMs: responseTime,
      failureReason: verificationResult.error,
      riskFactors,
      trustScore: deviceTrustResult?.trustScore
    });

    if (!verificationResult.valid) {
      return NextResponse.json({
        success: false,
        error: verificationResult.error || 'Invalid verification code',
        attempts_remaining: verificationResult.attemptsRemaining,
        locked_until: verificationResult.lockedUntil
      }, { status: 400 });
    }

    // Update session with MFA verification
    if (!setup_mode) {
      await updateSessionMFAStatus(userId, deviceId || undefined, method);
    }

    // Complete TOTP setup if in setup mode
    if (setup_mode && method === 'totp') {
      await (supabase as any)
        .from('auth_mfa_config')
        .update({
          totp_verified: true,
          enrollment_completed_at: new Date().toISOString()
        })
        .eq('user_id', userId);
    }

    // Handle device trust preferences
    if (remember_device && deviceTrustResult?.success) {
      await handleDeviceRemembering(userId, deviceId || undefined, deviceTrustResult.trustScore);
    }

    const response = {
      success: true,
      verification_completed: true,
      method_used: method,
      setup_completed: setup_mode && verificationResult.valid,
      device_trust: deviceTrustResult ? {
        trusted: deviceTrustResult.trustScore >= 0.6,
        trust_score: deviceTrustResult.trustScore,
        requires_mfa: deviceTrustResult.requiresVerification
      } : null,
      backup_codes: verificationResult.lastUsed ? {
        warning: 'This was your last backup code. Please generate new ones.',
        remaining: verificationResult.remainingCodes || 0
      } : null,
      session_extended: !setup_mode,
      next_mfa_required: !remember_device || (deviceTrustResult?.trustScore || 0) < 0.8
    };

    // Special handling for last backup code
    if (method === 'backup_code' && verificationResult.lastUsed) {
      await notifyLastBackupCodeUsed(userId);
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('MFA verification error:', error);
    return NextResponse.json(
      { 
        error: 'Verification failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/mfa/verify/challenge
 * Creates a new MFA challenge (for SMS/Email methods)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const method = searchParams.get('method');
    const phone = searchParams.get('phone');
    const email = searchParams.get('email');

    if (!method) {
      return NextResponse.json(
        { error: 'Method parameter is required' },
        { status: 400 }
      );
    }

    // Get user from session
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: session } = await supabase.auth.getUser(token);
    
    if (!session.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const userId = session.user.id;
    const ipAddress = request.ip || '0.0.0.0';
    const userAgent = request.headers.get('user-agent') || '';
    const deviceId = request.headers.get('x-device-id');

    let challengeResult: any;

    switch (method) {
      case 'sms':
        if (!phone) {
          return NextResponse.json(
            { error: 'Phone number is required for SMS challenge' },
            { status: 400 }
          );
        }

        challengeResult = await SMSVerificationService.sendVerificationCode(
          userId,
          phone,
          {
            purpose: 'mfa_login',
            deviceId: deviceId || undefined,
            ipAddress,
            userAgent
          }
        );
        break;

      case 'email':
        challengeResult = await createEmailChallenge(
          userId,
          email || session.user.email!,
          { deviceId: deviceId || undefined, ipAddress, userAgent }
        );
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid challenge method' },
          { status: 400 }
        );
    }

    if (!challengeResult.success) {
      return NextResponse.json({
        error: challengeResult.error || 'Failed to create challenge',
        rate_limited: challengeResult.rateLimited,
        cooldown_until: challengeResult.cooldownUntil
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      challenge_id: challengeResult.challengeId,
      expires_at: challengeResult.expiresAt,
      method: method,
      delivery_method: method === 'sms' ? 'sms' : 'email',
      masked_contact: method === 'sms' 
        ? phone?.replace(/(\d{3})\d{4}(\d{4})/, '$1***$2')
        : email?.replace(/(.{2}).*(@.*)/, '$1***$2'),
      attempts_remaining: challengeResult.attemptsRemaining
    });

  } catch (error) {
    console.error('MFA challenge creation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create challenge',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

/**
 * Helper Functions
 */

async function verifyTOTPVerification(
  userId: string, 
  code: string, 
  mfaConfig: any, 
  setupMode: boolean
): Promise<{ valid: boolean; error?: string }> {
  if (!mfaConfig?.totp_secret_encrypted) {
    return { valid: false, error: 'TOTP not configured' };
  }

  const result = verifyTOTPCode(mfaConfig.totp_secret_encrypted, code);
  
  if (!result.valid) {
    return { valid: false, error: 'Invalid TOTP code' };
  }

  // In setup mode, we're more lenient with timing
  if (!setupMode && Math.abs(result.timeOffset) > 1) {
    return { valid: false, error: 'Code expired or clock drift too large' };
  }

  return { valid: true };
}

async function verifyEmailCode(
  userId: string,
  challengeId: string,
  code: string
): Promise<{ valid: boolean; error?: string }> {
  // Get email challenge
  const { data: challenge, error } = await supabase
    .from('auth_mfa_challenges')
    .select('*')
    .eq('id', challengeId)
    .eq('user_id', userId)
    .eq('challenge_type', 'email')
    .single();

  if (error || !challenge) {
    return { valid: false, error: 'Invalid or expired challenge' };
  }

  if (new Date((challenge as any).expires_at) < new Date()) {
    return { valid: false, error: 'Challenge expired' };
  }

  if ((challenge as any).attempts >= (challenge as any).max_attempts) {
    return { valid: false, error: 'Too many attempts' };
  }

  const isValid = (challenge as any).challenge_code === code;

  // Update attempt count
  await (supabase as any)
    .from('auth_mfa_challenges')
    .update({
      attempts: (challenge as any).attempts + 1,
      verified: isValid,
      verified_at: isValid ? new Date().toISOString() : undefined
    })
    .eq('id', challengeId);

  return { 
    valid: isValid, 
    error: isValid ? undefined : 'Invalid verification code' 
  };
}

async function createEmailChallenge(
  userId: string,
  email: string,
  context: { deviceId?: string; ipAddress: string; userAgent: string }
): Promise<{ success: boolean; challengeId?: string; expiresAt?: Date; error?: string }> {
  try {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create challenge
    const { data: challenge, error } = await (supabase as any)
      .from('auth_mfa_challenges')
      .insert([{
        user_id: userId,
        challenge_type: 'email',
        challenge_code: code,
        expires_at: expiresAt.toISOString(),
        ip_address: context.ipAddress,
        user_agent: context.userAgent,
        device_id: context.deviceId
      }])
      .select('id')
      .single();

    if (error || !challenge) {
      throw new Error('Failed to create email challenge');
    }

    // In production, send actual email
    console.log(`Email MFA code for ${email}: ${code}`);

    return {
      success: true,
      challengeId: challenge.id,
      expiresAt
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create email challenge'
    };
  }
}

async function updateSessionMFAStatus(
  userId: string, 
  deviceId?: string, 
  method?: string
): Promise<void> {
  // Update current session with MFA verification
  await (supabase as any)
    .from('user_sessions')
    .update({
      mfa_verified: true,
      mfa_verified_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('device_id', deviceId || '');
}

async function handleDeviceRemembering(
  userId: string,
  deviceId?: string,
  trustScore?: number
): Promise<void> {
  if (!deviceId || !trustScore || trustScore < 0.6) {
    return;
  }

  // Add or update trusted device
  await (supabase as any)
    .from('trusted_devices')
    .upsert({
      user_id: userId,
      device_id: deviceId,
      trust_level: trustScore >= 0.8 ? 'high' : 'medium',
      last_used_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    });
}

async function notifyLastBackupCodeUsed(userId: string): Promise<void> {
  // Create high-priority notification
  await (supabase as any)
    .from('security_events')
    .insert([{
      event_type: 'last_backup_code_used',
      severity: 'high',
      user_id: userId,
      description: 'User has used their last backup code and needs to generate new ones',
      action_taken: 'user_notification_required'
    }]);
}

async function getNetworkContext(ipAddress: string): Promise<any> {
  // In production, integrate with IP intelligence services
  return {
    ipAddress,
    isVPN: false,
    isTor: false,
    isDatacenter: false
  };
}

async function getGeographicContext(ipAddress: string): Promise<any> {
  // In production, integrate with IP geolocation services
  return {
    country: 'US',
    region: 'Unknown',
    city: 'Unknown'
  };
}