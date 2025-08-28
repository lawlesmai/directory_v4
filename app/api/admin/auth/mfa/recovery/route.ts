import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';

// Schema for MFA recovery requests
const mfaRecoverySchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .min(3, 'Email must be at least 3 characters')
    .max(255, 'Email must not exceed 255 characters')
    .transform(str => str.toLowerCase().trim()),
  employeeId: z.string()
    .min(1, 'Employee ID is required')
    .max(50, 'Employee ID must not exceed 50 characters')
    .optional(),
  recoveryCode: z.string()
    .min(8, 'Recovery code must be at least 8 characters')
    .optional(),
  newMfaMethod: z.enum(['totp', 'sms', 'email']).optional(),
  phoneNumber: z.string()
    .regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in international format')
    .optional()
});

const recoveryVerificationSchema = z.object({
  recoveryToken: z.string().uuid('Invalid recovery token format'),
  verificationCode: z.string().regex(/^[0-9]{6}$/, 'Verification code must be 6 digits'),
  newPassword: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 'Password must contain uppercase, lowercase, number and special character')
    .optional()
});

// POST - Initiate MFA recovery process
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request
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

    const validatedData = mfaRecoverySchema.parse(body);
    const supabase = createClient();
    
    const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Rate limiting for recovery requests
    const recentRecovery = await supabase
      .from('admin_security_incidents')
      .select('created_at')
      .eq('incident_type', 'mfa_recovery_initiated')
      .eq('source_ip', clientIP)
      .gte('created_at', new Date(Date.now() - 3600000).toISOString()) // Last hour
      .limit(3);

    if (recentRecovery.data && recentRecovery.data.length >= 3) {
      await logSecurityIncident(supabase, null, 'excessive_recovery_attempts', {
        ip: clientIP,
        userAgent,
        email: validatedData.email,
        attempts: recentRecovery.data.length
      });
      
      return NextResponse.json({
        error: 'Rate limited',
        message: 'Too many recovery attempts. Please wait before trying again.',
        code: 'RECOVERY_RATE_LIMITED',
        retryAfter: 3600
      }, { status: 429 });
    }

    // Find admin user by email and employee ID
    let adminUser: any = null;
    try {
      const { data: users, error: userError } = await supabase.auth.admin.listUsers();
      const user = users?.users?.find(u => u.email === validatedData.email);
      
      if (userError || !user) {
        await logSecurityIncident(supabase, null, 'recovery_invalid_user', {
          ip: clientIP,
          userAgent,
          email: validatedData.email
        });
        
        // Generic response to prevent user enumeration
        return NextResponse.json({
          success: true,
          message: 'If this account exists, recovery instructions have been sent to the associated email and administrators have been notified.',
          code: 'RECOVERY_INITIATED'
        });
      }

      const { data: admin, error: adminError } = await supabase
        .from('admin_users')
        .select('id, admin_level, employee_id, department, account_locked, deactivated_at')
        .eq('id', user.id)
        .single();

      if (adminError || !admin) {
        await logSecurityIncident(supabase, user.id, 'recovery_non_admin_attempt', {
          ip: clientIP,
          userAgent,
          email: validatedData.email
        });
        
        // Generic response
        return NextResponse.json({
          success: true,
          message: 'If this account exists, recovery instructions have been sent to the associated email and administrators have been notified.',
          code: 'RECOVERY_INITIATED'
        });
      }

      // Check account status
      if (admin.account_locked) {
        await logSecurityIncident(supabase, admin.id, 'recovery_locked_account_attempt', {
          ip: clientIP,
          userAgent,
          email: validatedData.email
        });
        
        return NextResponse.json({
          error: 'Account locked',
          message: 'This account is locked. Contact system administrator for assistance.',
          code: 'ACCOUNT_LOCKED'
        }, { status: 423 });
      }

      if (admin.deactivated_at) {
        return NextResponse.json({
          error: 'Account deactivated',
          message: 'This account has been deactivated',
          code: 'ACCOUNT_DEACTIVATED'
        }, { status: 423 });
      }

      // Verify employee ID if provided
      if (validatedData.employeeId && admin.employee_id !== validatedData.employeeId) {
        await logSecurityIncident(supabase, admin.id, 'recovery_invalid_employee_id', {
          ip: clientIP,
          userAgent,
          email: validatedData.email,
          provided_employee_id: validatedData.employeeId
        });
        
        return NextResponse.json({
          error: 'Invalid credentials',
          message: 'The provided information does not match our records.',
          code: 'INVALID_CREDENTIALS'
        }, { status: 400 });
      }

      adminUser = admin;
    } catch (error) {
      console.error('User lookup error during MFA recovery:', error);
      return NextResponse.json({
        error: 'System error',
        message: 'Unable to process recovery request',
        code: 'SYSTEM_ERROR'
      }, { status: 500 });
    }

    if (!adminUser) {
      return NextResponse.json({
        error: 'User not found',
        message: 'Unable to process recovery request',
        code: 'USER_NOT_FOUND'
      }, { status: 404 });
    }

    // Generate recovery token
    const recoveryToken = randomBytes(32).toString('hex');
    const recoveryHash = createHash('sha256').update(recoveryToken).digest('hex');
    
    // Store recovery request
    const { error: recoveryError } = await supabase
      .from('admin_mfa_recovery')
      .insert([{
        admin_id: adminUser.id,
        recovery_token_hash: recoveryHash,
        recovery_reason: 'lost_mfa_device',
        requestor_ip: clientIP,
        requestor_user_agent: userAgent,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        status: 'pending_approval'
      }]);

    if (recoveryError) {
      console.error('Recovery request storage error:', recoveryError);
      return NextResponse.json({
        error: 'System error',
        message: 'Failed to initiate recovery process',
        code: 'RECOVERY_STORAGE_ERROR'
      }, { status: 500 });
    }

    // Create approval request for super admins
    await supabase
      .from('admin_permission_approvals')
      .insert([{
        request_type: 'emergency_access',
        requested_by: adminUser.id,
        requested_for_admin_id: adminUser.id,
        request_title: 'MFA Recovery Request',
        request_description: `MFA recovery requested for admin ${validatedData.email} due to lost authenticator device`,
        request_data: {
          recovery_token: recoveryToken,
          recovery_reason: 'lost_mfa_device',
          ip_address: clientIP,
          user_agent: userAgent,
          employee_id: adminUser.employee_id
        },
        business_justification: 'Admin requires access restoration due to lost MFA device',
        is_emergency_request: true,
        emergency_justification: 'MFA device unavailable, blocking admin access',
        risk_level: 'high',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }]);

    // Notify super admins
    await notifySuperAdmins(supabase, adminUser, clientIP, userAgent);

    // Log the recovery initiation
    await logSecurityIncident(supabase, adminUser.id, 'mfa_recovery_initiated', {
      ip: clientIP,
      userAgent,
      email: validatedData.email,
      employee_id: adminUser.employee_id,
      admin_level: adminUser.admin_level
    });

    // Send email notification to user (in production)
    await sendRecoveryNotificationEmail(validatedData.email, adminUser.employee_id);

    return NextResponse.json({
      success: true,
      message: 'MFA recovery request has been submitted and is pending approval by system administrators. You will be notified once approved.',
      code: 'RECOVERY_SUBMITTED',
      requestId: recoveryToken.substring(0, 16), // Partial token for reference
      estimatedApprovalTime: '4-24 hours'
    });

  } catch (error) {
    console.error('MFA recovery error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        message: 'Invalid request parameters',
        code: 'VALIDATION_ERROR',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      }, { status: 400 });
    }
    
    return NextResponse.json({
      error: 'Internal server error',
      message: 'An unexpected error occurred during recovery initiation',
      code: 'SYSTEM_ERROR',
      requestId: randomBytes(8).toString('hex')
    }, { status: 500 });
  }
}

// PUT - Complete MFA recovery after approval
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = recoveryVerificationSchema.parse(body);
    const supabase = createClient();
    
    const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Find and validate recovery request
    const recoveryHash = createHash('sha256').update(validatedData.recoveryToken).digest('hex');
    
    const { data: recovery, error: recoveryError } = await supabase
      .from('admin_mfa_recovery')
      .select(`
        *,
        admin_users!inner (
          id, email, admin_level, employee_id
        )
      `)
      .eq('recovery_token_hash', recoveryHash)
      .eq('status', 'approved')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (recoveryError || !recovery) {
      await logSecurityIncident(supabase, null, 'invalid_recovery_token', {
        ip: clientIP,
        userAgent,
        token_hash: recoveryHash.substring(0, 16)
      });
      
      return NextResponse.json({
        error: 'Invalid token',
        message: 'Recovery token is invalid, expired, or not approved',
        code: 'INVALID_RECOVERY_TOKEN'
      }, { status: 400 });
    }

    // Verify the verification code (this would be sent via secure channel)
    if (!validateRecoveryVerificationCode(validatedData.verificationCode, recovery.verification_code)) {
      await logSecurityIncident(supabase, recovery.admin_id, 'invalid_recovery_verification', {
        ip: clientIP,
        userAgent,
        recovery_id: recovery.id
      });
      
      return NextResponse.json({
        error: 'Invalid verification code',
        message: 'The verification code is incorrect',
        code: 'INVALID_VERIFICATION_CODE'
      }, { status: 400 });
    }

    // Reset MFA configuration
    await supabase
      .from('auth_mfa_config')
      .update({
        mfa_enabled: false,
        totp_enabled: false,
        totp_secret: null,
        sms_enabled: false,
        email_enabled: false,
        backup_codes_used: [],
        last_reset_at: new Date().toISOString(),
        reset_reason: 'recovery_process'
      })
      .eq('user_id', recovery.admin_id);

    // Update password if provided
    if (validatedData.newPassword) {
      const { error: passwordError } = await supabase.auth.admin.updateUserById(
        recovery.admin_id,
        { password: validatedData.newPassword }
      );
      
      if (passwordError) {
        console.error('Password update error during recovery:', passwordError);
      }
    }

    // Mark recovery as completed
    await supabase
      .from('admin_mfa_recovery')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completion_ip: clientIP,
        completion_user_agent: userAgent
      })
      .eq('id', recovery.id);

    // Force MFA setup requirement
    await supabase
      .from('admin_users')
      .update({
        requires_mfa: true,
        mfa_grace_period: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days grace period
      })
      .eq('id', recovery.admin_id);

    // Log successful recovery
    await supabase
      .from('admin_audit_log')
      .insert([{
        admin_id: recovery.admin_id,
        action: 'mfa_recovery_completed',
        action_category: 'security',
        description: 'MFA recovery process completed, MFA reset required',
        old_values: { mfa_enabled: true },
        new_values: { mfa_enabled: false, requires_setup: true },
        ip_address: clientIP,
        user_agent: userAgent,
        success: true
      }]);

    // Send confirmation email
    await sendRecoveryCompletionEmail(recovery.admin_users.email);

    return NextResponse.json({
      success: true,
      message: 'MFA recovery completed successfully. You must set up MFA again within 7 days.',
      code: 'RECOVERY_COMPLETED',
      nextSteps: [
        'Log in with your email and password',
        'Set up MFA using your preferred method (TOTP recommended)',
        'Save your new backup codes securely'
      ],
      gracePeriod: '7 days'
    });

  } catch (error) {
    console.error('MFA recovery completion error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 });
    }
    
    return NextResponse.json({
      error: 'Recovery completion failed',
      code: 'SYSTEM_ERROR'
    }, { status: 500 });
  }
}

// GET - Check recovery status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get('requestId');
    
    if (!requestId) {
      return NextResponse.json({
        error: 'Request ID required',
        code: 'MISSING_REQUEST_ID'
      }, { status: 400 });
    }

    const supabase = createClient();
    
    // Look up recovery by partial token
    const { data: recovery } = await supabase
      .from('admin_mfa_recovery')
      .select('status, created_at, expires_at, approved_at, approved_by')
      .ilike('recovery_token_hash', `${requestId}%`)
      .single();

    if (!recovery) {
      return NextResponse.json({
        error: 'Recovery request not found',
        code: 'REQUEST_NOT_FOUND'
      }, { status: 404 });
    }

    return NextResponse.json({
      status: recovery.status,
      submittedAt: recovery.created_at,
      expiresAt: recovery.expires_at,
      approvedAt: recovery.approved_at,
      message: getStatusMessage(recovery.status)
    });

  } catch (error) {
    console.error('Recovery status check error:', error);
    return NextResponse.json({
      error: 'Status check failed',
      code: 'SYSTEM_ERROR'
    }, { status: 500 });
  }
}

// Helper functions
async function logSecurityIncident(
  supabase: any,
  adminId: string | null,
  incidentType: string,
  incidentData: any
): Promise<void> {
  try {
    await supabase
      .from('admin_security_incidents')
      .insert([{
        incident_type: incidentType,
        severity: incidentType.includes('invalid') || incidentType.includes('excessive') ? 'high' : 'medium',
        affected_admin_id: adminId,
        title: `MFA Recovery Security Event: ${incidentType}`,
        description: `Security event detected during MFA recovery process`,
        incident_data: incidentData,
        detected_by: 'automated',
        detection_method: 'mfa_recovery_monitoring',
        source_ip: incidentData.ip,
        occurred_at: new Date().toISOString()
      }]);
  } catch (error) {
    console.error('Failed to log security incident:', error);
  }
}

async function notifySuperAdmins(
  supabase: any,
  adminUser: any,
  clientIP: string,
  userAgent: string
): Promise<void> {
  try {
    // Get all super admins
    const { data: superAdmins } = await supabase
      .from('admin_users')
      .select('id')
      .eq('admin_level', 'super_admin')
      .eq('account_locked', false)
      .is('deactivated_at', null);

    if (superAdmins && superAdmins.length > 0) {
      const notifications = superAdmins.map(admin => ({
        admin_id: admin.id,
        notification_type: 'mfa_recovery_request',
        priority: 'high',
        title: 'MFA Recovery Request Requires Approval',
        message: `Admin ${adminUser.employee_id || adminUser.id} has requested MFA recovery. Review and approve if legitimate.`,
        requires_action: true,
        action_url: `/admin/security/recovery-requests`,
        action_text: 'Review Request',
        related_resource_type: 'admin_user',
        related_resource_id: adminUser.id,
        metadata: {
          requester_ip: clientIP,
          requester_user_agent: userAgent,
          admin_level: adminUser.admin_level,
          department: adminUser.department
        }
      }));

      await supabase
        .from('admin_notifications')
        .insert(notifications);
    }
  } catch (error) {
    console.error('Failed to notify super admins:', error);
  }
}

function validateRecoveryVerificationCode(providedCode: string, expectedCode: string): boolean {
  // In production, this would validate against a securely generated and stored code
  // For now, we'll generate a deterministic code based on the recovery request
  return providedCode === expectedCode;
}

async function sendRecoveryNotificationEmail(email: string, employeeId: string): Promise<void> {
  // In production, send actual email
  console.log(`Recovery notification sent to ${email} for employee ${employeeId}`);
}

async function sendRecoveryCompletionEmail(email: string): Promise<void> {
  // In production, send actual email
  console.log(`Recovery completion notification sent to ${email}`);
}

function getStatusMessage(status: string): string {
  switch (status) {
    case 'pending_approval':
      return 'Your recovery request is pending approval by system administrators';
    case 'approved':
      return 'Your recovery request has been approved. Check your email for completion instructions';
    case 'rejected':
      return 'Your recovery request has been rejected. Contact system administrator for assistance';
    case 'completed':
      return 'Recovery process completed successfully';
    case 'expired':
      return 'Recovery request has expired. Please submit a new request';
    default:
      return 'Unknown status';
  }
}

// Create the admin_mfa_recovery table if it doesn't exist (this would typically be in migrations)
const createRecoveryTableSQL = `
CREATE TABLE IF NOT EXISTS public.admin_mfa_recovery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  recovery_token_hash VARCHAR(64) NOT NULL UNIQUE,
  recovery_reason VARCHAR(100) NOT NULL,
  verification_code VARCHAR(6),
  
  -- Request details
  requestor_ip INET NOT NULL,
  requestor_user_agent TEXT,
  
  -- Approval workflow
  status VARCHAR(20) DEFAULT 'pending_approval' CHECK (
    status IN ('pending_approval', 'approved', 'rejected', 'completed', 'expired')
  ),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  rejected_reason TEXT,
  
  -- Completion
  completed_at TIMESTAMPTZ,
  completion_ip INET,
  completion_user_agent TEXT,
  
  -- Metadata
  additional_data JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_mfa_recovery_admin ON public.admin_mfa_recovery(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_mfa_recovery_status ON public.admin_mfa_recovery(status) WHERE status = 'pending_approval';
CREATE INDEX IF NOT EXISTS idx_admin_mfa_recovery_token ON public.admin_mfa_recovery(recovery_token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_mfa_recovery_expires ON public.admin_mfa_recovery(expires_at) WHERE status = 'pending_approval';
`;