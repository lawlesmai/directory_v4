import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { authRateLimiter } from '@/lib/api/rate-limit';

// Enhanced input validation schema
const adminLoginSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .min(3, 'Email must be at least 3 characters')
    .max(255, 'Email must not exceed 255 characters')
    .transform(str => str.toLowerCase().trim()),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters'),
  mfaCode: z.string()
    .optional()
    .refine(val => !val || /^[0-9]{6}$/.test(val) || /^[A-Z0-9]{8}$/.test(val), {
      message: 'MFA code must be either 6 digits or 8-character backup code'
    }),
  deviceId: z.string()
    .uuid('Device ID must be a valid UUID')
    .optional(),
  rememberDevice: z.boolean().default(false),
  timeZone: z.string().optional(),
  clientVersion: z.string().optional()
});

// Rate limiting configuration - use the auth rate limiter from our lib

interface AdminUser {
  id: string;
  admin_level: string;
  requires_mfa: boolean;
  account_locked: boolean;
  failed_login_attempts: number;
  ip_whitelist_enabled: boolean;
  ip_whitelist: string[] | null;
  mfa_grace_period: string | null;
}

interface MFAConfig {
  mfa_enabled: boolean;
  totp_enabled: boolean;
  sms_enabled: boolean;
  email_enabled: boolean;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const rateLimitResult = await authRateLimiter.limit(request);
    
    if (!rateLimitResult.success) {
      return NextResponse.json({
        error: 'Too many login attempts',
        message: rateLimitResult.message || 'Please wait before attempting to login again',
        retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
      }, { status: 429 });
    }

    // Parse and validate request body
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

    // Validate request size (prevent large payloads)
    const bodyStr = JSON.stringify(body);
    if (bodyStr.length > 10000) { // 10KB limit
      return NextResponse.json({
        error: 'Request too large',
        message: 'Request body exceeds maximum size limit',
        code: 'PAYLOAD_TOO_LARGE'
      }, { status: 413 });
    }

    let validatedData;
    try {
      validatedData = adminLoginSchema.parse(body);
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
    
    // Get client IP and user agent for security logging
    const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // Step 1: Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: validatedData.email,
      password: validatedData.password
    });

    if (authError || !authData.user) {
      // Log failed authentication attempt
      await logFailedAuthAttempt(supabase, validatedData.email, clientIP, userAgent, 'invalid_credentials', authError?.message);
      
      // Generic error message to prevent user enumeration
      return NextResponse.json({
        error: 'Authentication failed',
        message: 'Invalid credentials or account access denied',
        code: 'AUTH_FAILED',
        timestamp: new Date().toISOString()
      }, { 
        status: 401,
        headers: {
          'WWW-Authenticate': 'Bearer realm="admin"',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }

    // Step 2: Check if user is an admin
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select(`
        id,
        admin_level,
        requires_mfa,
        account_locked,
        failed_login_attempts,
        ip_whitelist_enabled,
        ip_whitelist,
        mfa_grace_period
      `)
      .eq('id', authData.user.id)
      .single();

    if (adminError || !adminUser) {
      // Sign out from Supabase auth since user is not an admin
      await supabase.auth.signOut();
      
      await logFailedAuthAttempt(supabase, validatedData.email, clientIP, userAgent, 'not_admin', adminError?.message);
      
      return NextResponse.json({
        error: 'Access denied',
        message: 'Administrative access required',
        code: 'INSUFFICIENT_PRIVILEGES',
        timestamp: new Date().toISOString()
      }, { 
        status: 403,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }

    // Step 3: Check account status
    if (adminUser.account_locked) {
      await supabase.auth.signOut();
      
      await logFailedAuthAttempt(supabase, validatedData.email, clientIP, userAgent, 'account_locked');
      
      return NextResponse.json({
        error: 'Account locked',
        message: 'Account has been temporarily locked due to security reasons. Contact system administrator.',
        code: 'ACCOUNT_LOCKED',
        timestamp: new Date().toISOString(),
        supportContact: process.env.ADMIN_SUPPORT_EMAIL || 'support@thelawlessdirectory.com'
      }, { 
        status: 423,
        headers: {
          'Retry-After': '3600', // Suggest retry after 1 hour
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }

    // Step 4: Validate IP access if enabled
    if (adminUser.ip_whitelist_enabled) {
      const { data: ipValid } = await supabase.rpc('validate_admin_ip_access', {
        p_admin_id: adminUser.id,
        p_ip_address: clientIP
      } as any);

      if (!ipValid) {
        await supabase.auth.signOut();
        
        await logFailedAuthAttempt(supabase, validatedData.email, clientIP, userAgent, 'ip_not_whitelisted');
        
        return NextResponse.json({
          error: 'Access denied',
          message: 'Access from this location is not permitted for administrative accounts',
          code: 'IP_NOT_WHITELISTED',
          timestamp: new Date().toISOString(),
          clientIP: clientIP.split('.').map((octet, index) => index < 3 ? octet : 'xxx').join('.') // Partially mask IP
        }, { 
          status: 403,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
      }
    }

    // Step 5: Check MFA requirements
    const requiresMFA = adminUser.requires_mfa || adminUser.admin_level === 'super_admin';
    const inGracePeriod = adminUser.mfa_grace_period && new Date(adminUser.mfa_grace_period) > new Date();
    
    if (requiresMFA && !inGracePeriod) {
      // Get MFA configuration
      const { data: mfaConfig, error: mfaError } = await supabase
        .from('auth_mfa_config')
        .select('mfa_enabled, totp_enabled, sms_enabled, email_enabled')
        .eq('user_id', adminUser.id)
        .single();

      if (mfaError || !mfaConfig?.mfa_enabled) {
        await supabase.auth.signOut();
        
        return NextResponse.json({
          error: 'MFA required',
          message: 'Multi-factor authentication must be configured for admin access',
          code: 'MFA_SETUP_REQUIRED',
          requiresMFASetup: true,
          timestamp: new Date().toISOString()
        }, { 
          status: 412,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
      }

      // If MFA code not provided, create challenge
      if (!validatedData.mfaCode) {
        const challengeId = await createMFAChallenge(
          supabase,
          adminUser.id,
          mfaConfig,
          clientIP,
          userAgent,
          validatedData.deviceId
        );

        await supabase.auth.signOut(); // Sign out until MFA verified
        
        return NextResponse.json({
          requiresMFA: true,
          challengeId,
          code: 'MFA_CHALLENGE_CREATED',
          availableMethods: {
            totp: mfaConfig.totp_enabled,
            sms: mfaConfig.sms_enabled,
            email: mfaConfig.email_enabled
          },
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          timestamp: new Date().toISOString()
        }, { 
          status: 200,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
      }

      // Verify MFA code
      const mfaValid = await verifyMFACode(
        supabase,
        adminUser.id,
        validatedData.mfaCode,
        clientIP,
        userAgent
      );

      if (!mfaValid) {
        await supabase.auth.signOut();
        
        await logFailedAuthAttempt(supabase, validatedData.email, clientIP, userAgent, 'invalid_mfa');
        
        return NextResponse.json({
          error: 'Invalid MFA code',
          message: 'The provided MFA code is invalid or expired',
          code: 'INVALID_MFA_CODE',
          timestamp: new Date().toISOString()
        }, { 
          status: 401,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
      }
    }

    // Step 6: Create admin session
    const sessionToken = randomBytes(32).toString('hex');
    const sessionId = await createAdminSession(
      supabase,
      adminUser.id,
      sessionToken,
      clientIP,
      userAgent,
      validatedData.deviceId,
      validatedData.rememberDevice
    );

    // Step 7: Reset failed attempts and update last login
    await supabase.rpc('update_admin_login_stats', {
      p_admin_id: adminUser.id,
      p_login_ip: clientIP
    } as any);

    // Step 8: Log successful authentication
    await logSuccessfulAuth(supabase, adminUser.id, sessionId, clientIP, userAgent);

    // Step 9: Detect suspicious activity
    await supabase.rpc('detect_suspicious_admin_activity', {
      p_session_id: sessionId
    } as any);

    // Step 10: Set secure cookie
    const cookieStore = cookies();
    cookieStore.set('admin-session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 60, // 30 minutes
      path: '/admin'
    });

    return NextResponse.json({
      success: true,
      user: {
        id: adminUser.id,
        adminLevel: adminUser.admin_level,
        email: authData.user.email,
        department: adminUser.department,
        requiresMFA: adminUser.requires_mfa,
        lastLoginAt: adminUser.last_login_at?.toISOString(),
        permissions: [] // This would be populated from RBAC system
      },
      sessionId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      sessionTimeout: 30 * 60, // seconds
      serverTime: new Date().toISOString(),
      features: {
        mfaEnabled: adminUser.requires_mfa,
        ipWhitelistEnabled: adminUser.ip_whitelist_enabled,
        sessionExtension: adminUser.admin_level === 'super_admin'
      }
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    
    // Log the error for monitoring
    try {
      const supabase = createClient();
      await supabase
        .from('admin_security_incidents')
        .insert([{
          incident_type: 'system_error',
          severity: 'medium',
          title: 'Admin login system error',
          description: 'Unexpected error during admin authentication',
          incident_data: {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : null,
            timestamp: new Date().toISOString()
          },
          detected_by: 'automated',
          detection_method: 'exception_handler',
          source_ip: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
          occurred_at: new Date().toISOString()
        }]);
    } catch (logError) {
      console.error('Failed to log admin error:', logError);
    }
    
    return NextResponse.json({
      error: 'Internal server error',
      message: 'An unexpected error occurred during authentication. Please try again.',
      code: 'SYSTEM_ERROR',
      timestamp: new Date().toISOString(),
      requestId: randomBytes(8).toString('hex')
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
}

async function logFailedAuthAttempt(
  supabase: any,
  email: string,
  ip: string,
  userAgent: string,
  reason: string,
  errorDetails?: string
): Promise<void> {
  try {
    // Try to get user ID if user exists
    let userId = null;
    let shouldLock = false;
    
    try {
      const { data: user, error: userError } = await supabase.auth.admin.getUserByEmail(email);
      if (user && !userError) {
        userId = user.id;
        
        // Increment failed attempts and check if account should be locked
        const { data: lockResult, error: rpcError } = await supabase.rpc('increment_failed_login_attempts', {
          p_user_id: userId,
          p_max_attempts: 5
        });
        
        if (!rpcError) {
          shouldLock = lockResult;
        }
      }
    } catch (userLookupError) {
      console.warn('Failed to lookup user for failed auth logging:', userLookupError);
    }

    // Determine severity based on reason and account lock status
    const severity = shouldLock ? 'high' : 
                    reason === 'account_locked' ? 'high' :
                    reason === 'ip_not_whitelisted' ? 'high' :
                    'medium';
    
    // Log to security events
    const incidentData = {
      email: email.replace(/(.{2}).*(@.*)/, '$1***$2'), // Partially mask email
      reason,
      ip,
      user_agent: userAgent,
      error_details: errorDetails,
      account_locked: shouldLock,
      timestamp: new Date().toISOString()
    };
    
    await supabase
      .from('admin_security_incidents')
      .insert({
        incident_type: 'failed_admin_login',
        severity,
        affected_admin_id: userId,
        title: `Failed admin login attempt${shouldLock ? ' - Account Locked' : ''}`,
        description: `Failed login attempt: ${reason}${shouldLock ? '. Account has been locked due to repeated failures.' : ''}`,
        incident_data: incidentData,
        detected_by: 'automated',
        detection_method: 'login_monitoring',
        source_ip: ip,
        occurred_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error logging failed auth attempt:', error);
  }
}

async function createMFAChallenge(
  supabase: any,
  userId: string,
  mfaConfig: MFAConfig,
  ip: string,
  userAgent: string,
  deviceId?: string
): Promise<string> {
  try {
    // Generate secure challenge code for SMS/Email
    const challengeCode = mfaConfig.totp_enabled ? null : 
                         randomBytes(3).toString('hex').toUpperCase().slice(0, 6);
    
    // Determine primary challenge type
    const challengeType = mfaConfig.totp_enabled ? 'totp' : 
                         mfaConfig.sms_enabled ? 'sms' : 
                         mfaConfig.email_enabled ? 'email' : 'totp';
    
    const { data, error } = await supabase
      .from('auth_mfa_challenges')
      .insert({
        user_id: userId,
        challenge_type: challengeType,
        challenge_code: challengeCode,
        ip_address: ip,
        user_agent: userAgent,
        device_id: deviceId,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
        max_attempts: 3,
        attempts: 0
      })
      .select('id')
      .single();

    if (error) {
      console.error('MFA challenge creation error:', error);
      throw new Error(`Failed to create MFA challenge: ${error.message}`);
    }

    // Send SMS/Email if not TOTP (in production, integrate with SMS/email service)
    if (!mfaConfig.totp_enabled && challengeCode) {
      console.log(`MFA code for user ${userId}: ${challengeCode}`);
      // TODO: Integrate with actual SMS/Email service
      // await sendMFACode(userId, challengeCode, challengeType);
    }

    return data.id;
  } catch (error) {
    console.error('Error creating MFA challenge:', error);
    throw new Error('Failed to create authentication challenge');
  }
}

async function verifyMFACode(
  supabase: any,
  userId: string,
  code: string,
  ip: string,
  userAgent: string
): Promise<boolean> {
  try {
    // Input validation
    if (!code || code.trim().length === 0) {
      return false;
    }
    
    const cleanCode = code.trim().replace(/\s/g, '');
    
    // Get the latest challenge
    const { data: challenge, error } = await supabase
      .from('auth_mfa_challenges')
      .select('*')
      .eq('user_id', userId)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !challenge) {
      console.warn('No valid MFA challenge found for user:', userId);
      return false;
    }

    // Check if max attempts exceeded
    if (challenge.attempts >= challenge.max_attempts) {
      console.warn('MFA challenge max attempts exceeded for user:', userId);
      return false;
    }

    // Increment attempt count
    const newAttempts = challenge.attempts + 1;
    await supabase
      .from('auth_mfa_challenges')
      .update({ attempts: newAttempts })
      .eq('id', challenge.id);

    let isValid = false;

    if (challenge.challenge_type === 'totp') {
      // Verify TOTP code using database function
      try {
        const { data: valid, error: totpError } = await supabase.rpc('verify_totp_code', {
          p_user_id: userId,
          p_code: cleanCode
        });
        
        if (totpError) {
          console.error('TOTP verification error:', totpError);
          return false;
        }
        
        isValid = Boolean(valid);
      } catch (totpError) {
        console.error('TOTP RPC call failed:', totpError);
        return false;
      }
    } else {
      // Verify SMS/Email code with constant-time comparison
      isValid = challenge.challenge_code && 
               cleanCode.length === challenge.challenge_code.length &&
               constantTimeEquals(cleanCode, challenge.challenge_code);
    }

    if (isValid) {
      try {
        // Mark challenge as verified
        await supabase
          .from('auth_mfa_challenges')
          .update({
            verified: true,
            verified_at: new Date().toISOString()
          })
          .eq('id', challenge.id);

        // Update MFA config last used
        await supabase
          .from('auth_mfa_config')
          .update({
            last_used_method: challenge.challenge_type,
            last_used_at: new Date().toISOString()
          })
          .eq('user_id', userId);
          
        console.log('MFA verification successful for user:', userId);
      } catch (updateError) {
        console.error('Failed to update MFA verification status:', updateError);
        // Don't fail the verification if logging fails
      }
    } else {
      console.warn('Invalid MFA code provided for user:', userId);
    }

    return isValid;
  } catch (error) {
    console.error('MFA verification error:', error);
    return false;
  }
}

// Constant-time string comparison to prevent timing attacks
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

async function createAdminSession(
  supabase: any,
  adminId: string,
  sessionToken: string,
  ip: string,
  userAgent: string,
  deviceId?: string,
  rememberDevice: boolean = false
): Promise<string> {
  try {
    // Parse user agent for device info
    const deviceInfo = parseUserAgent(userAgent);
    
    // Calculate session duration based on admin settings
    const sessionDuration = rememberDevice ? 24 * 60 * 60 * 1000 : 30 * 60 * 1000; // 24 hours vs 30 minutes
    
    // Generate browser fingerprint for additional security
    const browserFingerprint = createHash('sha256')
      .update(`${userAgent}-${ip}-${deviceInfo.browser}-${deviceInfo.os}`)
      .digest('hex')
      .substring(0, 32);

    const sessionData = {
      admin_id: adminId,
      session_token: sessionToken,
      ip_address: ip,
      user_agent: userAgent,
      browser_fingerprint: browserFingerprint,
      device_id: deviceId,
      browser: deviceInfo.browser,
      browser_version: deviceInfo.browserVersion,
      os: deviceInfo.os,
      os_version: deviceInfo.osVersion,
      device_type: deviceInfo.deviceType,
      mfa_verified: true,
      mfa_verified_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + sessionDuration).toISOString(),
      last_activity_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('admin_sessions')
      .insert(sessionData)
      .select('id')
      .single();

    if (error) {
      console.error('Session creation error:', error);
      throw new Error(`Failed to create admin session: ${error.message}`);
    }

    console.log('Admin session created successfully for admin:', adminId);
    return data.id;
  } catch (error) {
    console.error('Error creating admin session:', error);
    throw new Error('Failed to create secure session');
  }
}

async function logSuccessfulAuth(
  supabase: any,
  adminId: string,
  sessionId: string,
  ip: string,
  userAgent: string
): Promise<void> {
  await supabase
    .from('admin_audit_log')
    .insert({
      admin_id: adminId,
      session_id: sessionId,
      action: 'admin_login_successful',
      action_category: 'authentication',
      ip_address: ip,
      user_agent: userAgent,
      success: true
    });
}

function parseUserAgent(userAgent: string): any {
  try {
    // Enhanced user agent parsing with better regex patterns
    const browserPattern = /(Chrome|Firefox|Safari|Edge|Opera|Internet Explorer)\/([\d\.]+)/i;
    const osPattern = /(Windows NT|Mac OS X|Linux|Android|iOS|iPhone OS)\s?([\d\._]+)?/i;
    const mobilePattern = /(Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini)/i;
    
    const browserMatch = userAgent.match(browserPattern);
    const osMatch = userAgent.match(osPattern);
    const isMobile = mobilePattern.test(userAgent);
    
    // Extract Chrome version more accurately
    let browser = 'Unknown';
    let browserVersion = '0.0';
    
    if (browserMatch) {
      browser = browserMatch[1];
      browserVersion = browserMatch[2] || '0.0';
    } else if (userAgent.includes('Chrome')) {
      browser = 'Chrome';
      const chromeMatch = userAgent.match(/Chrome\/([\d\.]+)/);
      browserVersion = chromeMatch ? chromeMatch[1] : '0.0';
    } else if (userAgent.includes('Firefox')) {
      browser = 'Firefox';
      const firefoxMatch = userAgent.match(/Firefox\/([\d\.]+)/);
      browserVersion = firefoxMatch ? firefoxMatch[1] : '0.0';
    } else if (userAgent.includes('Safari')) {
      browser = 'Safari';
      const safariMatch = userAgent.match(/Safari\/([\d\.]+)/);
      browserVersion = safariMatch ? safariMatch[1] : '0.0';
    }
    
    let os = 'Unknown';
    let osVersion = '0.0';
    
    if (osMatch) {
      os = osMatch[1].replace(/NT|OS X/, '').trim();
      osVersion = osMatch[2] ? osMatch[2].replace(/_/g, '.') : '0.0';
    }
    
    return {
      browser,
      browserVersion: browserVersion.split('.').slice(0, 2).join('.'), // Major.minor
      os: os || 'Unknown',
      osVersion: osVersion.split('.').slice(0, 2).join('.'), // Major.minor
      deviceType: isMobile ? 'mobile' : 'desktop',
      isBot: /bot|crawler|spider|scraper/i.test(userAgent),
      fullUserAgent: userAgent
    };
  } catch (error) {
    console.warn('User agent parsing failed:', error);
    return {
      browser: 'Unknown',
      browserVersion: '0.0',
      os: 'Unknown',
      osVersion: '0.0',
      deviceType: 'desktop',
      isBot: false,
      fullUserAgent: userAgent
    };
  }
}