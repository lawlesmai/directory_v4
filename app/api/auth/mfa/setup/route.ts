/**
 * MFA Setup API Endpoints
 * Handles MFA enrollment, configuration, and method setup
 * 
 * The Lawless Directory - Epic 2 Story 2.4
 * Multi-Factor Authentication Infrastructure
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateTOTPSecret, generateQRCodeURL, isValidTOTPSecret } from '@/lib/auth/totp';
import { BackupCodeService } from '@/lib/auth/backup-codes';
import { MFAAuditLogger } from '@/lib/auth/mfa-audit';
import { MFAMiddleware } from '@/lib/auth/mfa-enforcement';
import type { Database } from '@/lib/supabase/database.types';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/auth/mfa/setup
 * Gets MFA setup status and available methods
 */
export async function GET(request: NextRequest) {
  try {
    // Get user from session
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract user ID from session (simplified - in production use proper auth)
    const token = authHeader.replace('Bearer ', '');
    const { data: session } = await supabase.auth.getUser(token);
    
    if (!session.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get current MFA configuration
    const { data: mfaConfig, error: configError } = await supabase
      .from('auth_mfa_config')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      throw new Error(`Failed to get MFA config: ${configError.message}`);
    }

    // Get backup code status
    const backupCodeStatus = await BackupCodeService.getBackupCodeStatus(userId);

    // Get user role requirements - using type assertion for database schema compatibility
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role_name')
      .eq('user_id', userId)
      .eq('is_active', true);

    const roleNames = userRoles?.map((r: any) => r.role_name).filter(Boolean) || [];

    // Check if MFA is required for user
    const mfaRequired = roleNames.some((role: string) => 
      ['super_admin', 'admin', 'business_owner'].includes(role)
    );

    // Calculate grace period if applicable
    let gracePeriodExpires: Date | null = null;
    if (mfaRequired && !(mfaConfig as any)?.mfa_enabled) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('id', userId)
        .single();

      if ((profile as any)?.created_at) {
        gracePeriodExpires = new Date((profile as any).created_at);
        gracePeriodExpires.setDate(gracePeriodExpires.getDate() + 30); // 30-day grace period
      }
    }

    const response = {
      mfa_enabled: (mfaConfig as any)?.mfa_enabled || false,
      mfa_enforced: (mfaConfig as any)?.mfa_enforced || false,
      mfa_required: mfaRequired,
      grace_period_expires: gracePeriodExpires,
      methods: {
        totp: {
          enabled: (mfaConfig as any)?.totp_enabled || false,
          verified: (mfaConfig as any)?.totp_verified || false,
          available: true
        },
        sms: {
          enabled: (mfaConfig as any)?.sms_enabled || false,
          phone_number: (mfaConfig as any)?.sms_phone_number,
          phone_verified: (mfaConfig as any)?.sms_phone_verified || false,
          available: true
        },
        email: {
          enabled: (mfaConfig as any)?.email_enabled || false,
          email_address: (mfaConfig as any)?.email_address,
          available: true
        },
        backup_codes: {
          enabled: backupCodeStatus.hasBackupCodes,
          total_codes: backupCodeStatus.totalCodes,
          used_codes: backupCodeStatus.usedCodes,
          remaining_codes: backupCodeStatus.remainingCodes,
          expires_at: backupCodeStatus.expiresAt,
          near_expiry: backupCodeStatus.nearExpiry
        }
      },
      trusted_devices_enabled: (mfaConfig as any)?.trust_device_enabled ?? true,
      max_trusted_devices: (mfaConfig as any)?.max_trusted_devices || 5
    };

    // Log setup status check
    await MFAAuditLogger.logEvent({
      eventType: 'compliance_check',
      userId,
      ipAddress: request.ip || '0.0.0.0',
      userAgent: request.headers.get('user-agent') || '',
      success: true,
      eventData: {
        mfa_enabled: response.mfa_enabled,
        methods_enabled: Object.keys(response.methods).filter(
          method => response.methods[method as keyof typeof response.methods].enabled
        )
      }
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('MFA setup status error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get MFA setup status',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/mfa/setup
 * Enables MFA for the user account
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { enable_mfa = true, methods = ['totp'] } = body;

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

    // Validate methods
    const validMethods = ['totp', 'sms', 'email'];
    const invalidMethods = methods.filter((m: string) => !validMethods.includes(m));
    
    if (invalidMethods.length > 0) {
      return NextResponse.json(
        { error: `Invalid MFA methods: ${invalidMethods.join(', ')}` },
        { status: 400 }
      );
    }

    // Create or update MFA configuration - using type assertion for schema compatibility
    const { data: mfaConfig, error: configError } = await (supabase as any)
      .from('auth_mfa_config')
      .upsert({
        user_id: userId,
        mfa_enabled: enable_mfa,
        totp_enabled: methods.includes('totp'),
        sms_enabled: methods.includes('sms'),
        email_enabled: methods.includes('email'),
        enrollment_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (configError) {
      throw new Error(`Failed to update MFA config: ${configError.message}`);
    }

    // Generate setup data for requested methods
    const setupData: Record<string, any> = {};

    if (methods.includes('totp')) {
      const secret = generateTOTPSecret();
      const userEmail = session.user.email || 'user@example.com';
      const qrCodeUrl = generateQRCodeURL(secret, userEmail, 'The Lawless Directory');
      
      // Store encrypted TOTP secret
      await (supabase as any)
        .from('auth_mfa_config')
        .update({
          totp_secret_encrypted: secret // In production, encrypt this
        })
        .eq('user_id', userId);

      setupData.totp = {
        secret,
        qr_code_url: qrCodeUrl,
        manual_entry_key: secret.replace(/(.{4})/g, '$1 ').trim()
      };
    }

    if (methods.includes('backup_codes')) {
      const backupResult = await BackupCodeService.generateBackupCodes(userId, {
        codeCount: 8,
        replaceExisting: false,
        deviceId: request.headers.get('x-device-id') || undefined,
        ipAddress: request.ip || '0.0.0.0'
      });

      if (backupResult.success) {
        setupData.backup_codes = {
          codes: backupResult.codes?.map(c => c.code),
          expires_at: backupResult.expiresAt
        };
      }
    }

    // Log MFA setup initiation
    await MFAAuditLogger.logEvent({
      eventType: 'mfa_enabled',
      userId,
      ipAddress: request.ip || '0.0.0.0',
      userAgent: request.headers.get('user-agent') || '',
      success: true,
      eventData: {
        methods_enabled: methods,
        totp_setup: methods.includes('totp'),
        sms_setup: methods.includes('sms'),
        email_setup: methods.includes('email')
      }
    });

    return NextResponse.json({
      message: 'MFA setup initiated successfully',
      mfa_enabled: enable_mfa,
      methods_configured: methods,
      setup_data: setupData,
      next_steps: getSetupNextSteps(methods)
    });

  } catch (error) {
    console.error('MFA setup error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to setup MFA',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/mfa/setup
 * Disables MFA for the user account (with proper authorization)
 */
export async function DELETE(request: NextRequest) {
  try {
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

    // Check if user has proper roles to disable MFA
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', userId)
      .eq('is_active', true);

    const roleNames = userRoles?.map((r: any) => r.role_name || r.roles?.name).filter(Boolean) || [];

    // Prevent MFA disable for required roles without admin override
    const requiredMFARoles = ['super_admin', 'admin', 'business_owner'];
    if (roleNames.some((role: string) => requiredMFARoles.includes(role))) {
      // Check for admin override
      const { data: adminOverride } = await supabase
        .from('mfa_admin_overrides')
        .select('*')
        .eq('target_user_id', userId)
        .eq('override_type', 'temporary_disable')
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (!adminOverride) {
        return NextResponse.json(
          { error: 'MFA cannot be disabled for your role without admin override' },
          { status: 403 }
        );
      }
    }

    // Disable MFA
    await (supabase as any)
      .from('auth_mfa_config')
      .update({
        mfa_enabled: false,
        totp_enabled: false,
        sms_enabled: false,
        email_enabled: false,
        totp_secret_encrypted: null,
        sms_phone_number: null,
        email_address: null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    // Invalidate all backup codes
    await BackupCodeService.invalidateExistingCodes(userId, 'mfa_disabled');

    // Revoke all trusted devices
    await (supabase as any)
      .from('trusted_devices')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoke_reason: 'mfa_disabled'
      })
      .eq('user_id', userId);

    // Log MFA disable
    await MFAAuditLogger.logEvent({
      eventType: 'mfa_disabled',
      userId,
      ipAddress: request.ip || '0.0.0.0',
      userAgent: request.headers.get('user-agent') || '',
      success: true,
      eventData: {
        disabled_by_user: true,
        admin_override_used: false
      }
    });

    return NextResponse.json({
      message: 'MFA has been disabled successfully',
      mfa_enabled: false,
      backup_codes_invalidated: true,
      trusted_devices_revoked: true
    });

  } catch (error) {
    console.error('MFA disable error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to disable MFA',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

/**
 * Helper function to get setup next steps
 */
function getSetupNextSteps(methods: string[]): string[] {
  const steps: string[] = [];

  if (methods.includes('totp')) {
    steps.push('Scan the QR code with your authenticator app');
    steps.push('Enter the verification code to complete TOTP setup');
  }

  if (methods.includes('sms')) {
    steps.push('Add your phone number for SMS verification');
    steps.push('Verify your phone number with the SMS code');
  }

  if (methods.includes('email')) {
    steps.push('Verify your email address for email-based MFA');
  }

  steps.push('Generate and save your backup codes');
  steps.push('Test your MFA setup by logging out and back in');

  return steps;
}