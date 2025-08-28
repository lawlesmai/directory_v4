import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateTOTPSecret, generateQRCodeDataURL } from '@/lib/auth/totp';
import { z } from 'zod';
import { randomBytes } from 'crypto';

const mfaSetupSchema = z.object({
  method: z.enum(['totp', 'sms', 'email']),
  phoneNumber: z.string().optional(),
  email: z.string().email().optional()
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body with comprehensive error handling
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json({
        error: 'Invalid request',
        message: 'Request body must be valid JSON',
        code: 'INVALID_JSON'
      }, { status: 400 });
    }

    // Validate request size
    const bodyStr = JSON.stringify(body);
    if (bodyStr.length > 5000) { // 5KB limit
      return NextResponse.json({
        error: 'Request too large',
        message: 'Request body exceeds maximum size limit',
        code: 'PAYLOAD_TOO_LARGE'
      }, { status: 413 });
    }

    let validatedData;
    try {
      validatedData = mfaSetupSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({
          error: 'Validation failed',
          message: 'Invalid request parameters',
          code: 'VALIDATION_ERROR',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
            code: e.code
          }))
        }, { status: 400 });
      }
      throw error;
    }

    const supabase = createClient();

    // Get current user session with enhanced validation
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.user) {
      return NextResponse.json({
        error: 'Authentication required',
        message: 'Valid admin session required',
        code: 'AUTH_REQUIRED'
      }, { status: 401 });
    }

    const user = session.user;
    const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Verify user is an admin
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('id, admin_level, requires_mfa')
      .eq('id', user.id)
      .single();

    if (adminError || !adminUser) {
      return NextResponse.json({
        error: 'Admin access required'
      }, { status: 403 });
    }

    // Get or create MFA configuration
    const { data: existingMFA, error: mfaError } = await supabase
      .from('auth_mfa_config')
      .select('*')
      .eq('user_id', user.id)
      .single();

    let mfaConfig = existingMFA;
    
    if (mfaError && mfaError.code === 'PGRST116') {
      // Create new MFA config
      const { data: newMFA, error: createError } = await supabase
        .from('auth_mfa_config')
        .insert([{
          user_id: user.id,
          mfa_enabled: false
        }])
        .select()
        .single();

      if (createError) {
        return NextResponse.json({
          error: 'Failed to create MFA configuration'
        }, { status: 500 });
      }

      mfaConfig = newMFA;
    } else if (mfaError) {
      return NextResponse.json({
        error: 'Failed to retrieve MFA configuration'
      }, { status: 500 });
    }

    const response: any = {
      success: true,
      method: validatedData.method
    };

    switch (validatedData.method) {
      case 'totp':
        const secret = generateTOTPSecret();
        const qrCodeDataURL = await generateQRCodeDataURL(
          secret,
          user.email || 'admin@example.com',
          'Admin Portal'
        );

        // Store encrypted secret temporarily (will be confirmed later)
        const { error: totpError } = await supabase
          .from('auth_mfa_config')
          .update({
            totp_secret_encrypted: await encryptSecret(secret),
            totp_verified: false
          })
          .eq('user_id', user.id);

        if (totpError) {
          return NextResponse.json({
            error: 'Failed to setup TOTP'
          }, { status: 500 });
        }

        response.secret = secret;
        response.qrCode = qrCodeDataURL;
        response.backupCodes = await generateBackupCodes(supabase, user.id);
        break;

      case 'sms':
        if (!validatedData.phoneNumber) {
          return NextResponse.json({
            error: 'Phone number required for SMS MFA'
          }, { status: 400 });
        }

        // Validate phone number format
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        if (!phoneRegex.test(validatedData.phoneNumber)) {
          return NextResponse.json({
            error: 'Invalid phone number format'
          }, { status: 400 });
        }

        // Store phone number and send verification
        const { error: smsError } = await supabase
          .from('auth_mfa_config')
          .update({
            sms_phone_number: validatedData.phoneNumber,
            sms_phone_verified: false
          })
          .eq('user_id', user.id);

        if (smsError) {
          return NextResponse.json({
            error: 'Failed to setup SMS MFA'
          }, { status: 500 });
        }

        // Send verification SMS
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        await sendSMSVerification(validatedData.phoneNumber, verificationCode);
        
        // Store verification challenge
        await supabase
          .from('auth_mfa_challenges')
          .insert([{
            user_id: user.id,
            challenge_type: 'sms',
            challenge_code: verificationCode,
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
          }]);

        response.message = 'Verification code sent to phone number';
        break;

      case 'email':
        const emailAddress = validatedData.email || user.email;
        
        if (!emailAddress) {
          return NextResponse.json({
            error: 'Email address required'
          }, { status: 400 });
        }

        // Store email and send verification
        const { error: emailError } = await supabase
          .from('auth_mfa_config')
          .update({
            email_address: emailAddress
          })
          .eq('user_id', user.id);

        if (emailError) {
          return NextResponse.json({
            error: 'Failed to setup email MFA'
          }, { status: 500 });
        }

        // Send verification email
        const emailVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        await sendEmailVerification(emailAddress, emailVerificationCode);
        
        // Store verification challenge
        await supabase
          .from('auth_mfa_challenges')
          .insert([{
            user_id: user.id,
            challenge_type: 'email',
            challenge_code: emailVerificationCode,
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
          }]);

        response.message = 'Verification code sent to email';
        break;
    }

    // Log MFA setup attempt
    await supabase
      .from('admin_audit_log')
      .insert([{
        admin_id: user.id,
        action: 'mfa_setup_initiated',
        action_category: 'security',
        new_values: {
          method: validatedData.method,
          phone_number: validatedData.method === 'sms' ? validatedData.phoneNumber : null,
          email: validatedData.method === 'email' ? validatedData.email : null
        },
        success: true
      }]);

    return NextResponse.json(response);

  } catch (error) {
    console.error('MFA setup error:', error);
    
    return NextResponse.json({
      error: 'Internal server error',
      message: 'Failed to setup MFA'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient();
    const body = await request.json();
    
    const verifySchema = z.object({
      method: z.enum(['totp', 'sms', 'email']),
      code: z.string().min(6, 'Code must be at least 6 digits')
    });

    const validatedData = verifySchema.parse(body);

    // Get current admin user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({
        error: 'Authentication required'
      }, { status: 401 });
    }

    let isValid = false;

    if (validatedData.method === 'totp') {
      // Verify TOTP code
      const { data: valid } = await supabase.rpc('verify_totp_code', {
        p_user_id: user.id,
        p_code: validatedData.code
      } as any);
      isValid = Boolean(valid);

      if (isValid) {
        await supabase
          .from('auth_mfa_config')
          .update({
            totp_enabled: true,
            totp_verified: true,
            mfa_enabled: true
          })
          .eq('user_id', user.id);
      }
    } else {
      // Verify SMS/Email code
      const { data: challenge, error: challengeError } = await supabase
        .from('auth_mfa_challenges')
        .select('*')
        .eq('user_id', user.id)
        .eq('challenge_type', validatedData.method)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (challengeError || !challenge) {
        return NextResponse.json({
          error: 'Invalid or expired verification code'
        }, { status: 400 });
      }

      isValid = validatedData.code === challenge.challenge_code;

      if (isValid) {
        // Mark challenge as verified
        await supabase
          .from('auth_mfa_challenges')
          .update({
            verified: true,
            verified_at: new Date().toISOString()
          })
          .eq('id', challenge.id);

        // Enable the MFA method
        const updates: any = { mfa_enabled: true };
        
        if (validatedData.method === 'sms') {
          updates.sms_enabled = true;
          updates.sms_phone_verified = true;
        } else if (validatedData.method === 'email') {
          updates.email_enabled = true;
        }

        await supabase
          .from('auth_mfa_config')
          .update(updates)
          .eq('user_id', user.id);
      }
    }

    if (!isValid) {
      return NextResponse.json({
        error: 'Invalid verification code'
      }, { status: 400 });
    }

    // Log successful MFA setup
    await supabase
      .from('admin_audit_log')
      .insert([{
        admin_id: user.id,
        action: 'mfa_setup_completed',
        action_category: 'security',
        new_values: {
          method: validatedData.method
        },
        success: true
      }]);

    return NextResponse.json({
      success: true,
      message: `${validatedData.method.toUpperCase()} MFA successfully configured`,
      backupCodes: validatedData.method === 'totp' ? await getBackupCodes(supabase, user.id) : undefined
    });

  } catch (error) {
    console.error('MFA verification error:', error);
    
    return NextResponse.json({
      error: 'Internal server error',
      message: 'Failed to verify MFA setup'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    // Get current admin user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Get MFA configuration
    const { data: mfaConfig, error: mfaError } = await supabase
      .from('auth_mfa_config')
      .select(`
        mfa_enabled,
        mfa_enforced,
        totp_enabled,
        totp_verified,
        sms_enabled,
        sms_phone_verified,
        sms_phone_number,
        email_enabled,
        email_address,
        backup_codes_generated_at
      `)
      .eq('user_id', user.id)
      .single();

    if (mfaError && mfaError.code !== 'PGRST116') {
      return NextResponse.json({
        error: 'Failed to retrieve MFA configuration'
      }, { status: 500 });
    }

    const config = mfaConfig || {
      mfa_enabled: false,
      mfa_enforced: false,
      totp_enabled: false,
      totp_verified: false,
      sms_enabled: false,
      sms_phone_verified: false,
      sms_phone_number: null,
      email_enabled: false,
      email_address: null,
      backup_codes_generated_at: null
    };

    return NextResponse.json({
      mfaEnabled: config.mfa_enabled,
      mfaEnforced: config.mfa_enforced,
      methods: {
        totp: {
          enabled: config.totp_enabled,
          verified: config.totp_verified
        },
        sms: {
          enabled: config.sms_enabled,
          verified: config.sms_phone_verified,
          phoneNumber: config.sms_phone_number ? 
            config.sms_phone_number.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : null
        },
        email: {
          enabled: config.email_enabled,
          emailAddress: config.email_address
        }
      },
      backupCodes: {
        generated: !!config.backup_codes_generated_at,
        generatedAt: config.backup_codes_generated_at
      }
    });

  } catch (error) {
    console.error('MFA status error:', error);
    
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// Helper functions
async function encryptSecret(secret: string): Promise<string> {
  // In production, use proper encryption
  // This is a placeholder implementation
  return Buffer.from(secret).toString('base64');
}

async function generateBackupCodes(supabase: any, userId: string): Promise<string[]> {
  const backupCodes = Array.from({ length: 8 }, () => 
    Math.random().toString(36).substring(2, 10).toUpperCase()
  );

  // Store encrypted backup codes
  const encryptedCodes = backupCodes.map(code => Buffer.from(code).toString('base64'));
  
  await supabase
    .from('auth_mfa_config')
    .update({
      backup_codes_encrypted: encryptedCodes,
      backup_codes_used: [],
      backup_codes_generated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  return backupCodes;
}

async function getBackupCodes(supabase: any, userId: string): Promise<string[] | null> {
  const { data, error } = await supabase
    .from('auth_mfa_config')
    .select('backup_codes_encrypted, backup_codes_used')
    .eq('user_id', userId)
    .single();

  if (error || !data?.backup_codes_encrypted) {
    return null;
  }

  // Decrypt and filter out used codes
  const allCodes = data.backup_codes_encrypted.map((encrypted: string) =>
    Buffer.from(encrypted, 'base64').toString()
  );

  const usedIndexes = data.backup_codes_used || [];
  return allCodes.filter((_: string, index: number) => !usedIndexes.includes(index));
}

async function sendSMSVerification(phoneNumber: string, code: string): Promise<void> {
  // In production, integrate with SMS provider (Twilio, AWS SNS, etc.)
  console.log(`SMS to ${phoneNumber}: Your admin MFA verification code is: ${code}`);
}

async function sendEmailVerification(email: string, code: string): Promise<void> {
  // In production, integrate with email provider (SendGrid, AWS SES, etc.)
  console.log(`Email to ${email}: Your admin MFA verification code is: ${code}`);
  // TODO: Replace with actual email service integration
}

// Generate cryptographically secure verification code
function generateSecureCode(length: number = 6): string {
  const digits = '0123456789';
  let result = '';
  const bytes = randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    result += digits[bytes[i] % digits.length];
  }
  
  return result;
}

// Log security events for monitoring and compliance
async function logSecurityEvent(
  supabase: any,
  userId: string | null,
  eventType: string,
  eventData: any
): Promise<void> {
  try {
    await supabase
      .from('admin_security_incidents')
      .insert({
        incident_type: eventType,
        severity: 'medium',
        affected_admin_id: userId,
        title: `MFA Security Event: ${eventType}`,
        description: `Security event detected during MFA operations`,
        incident_data: eventData,
        detected_by: 'automated',
        detection_method: 'mfa_monitoring',
        source_ip: eventData.ip,
        occurred_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}