import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { randomBytes } from 'crypto';

// Session validation and refresh
const sessionSchema = z.object({
  action: z.enum(['validate', 'refresh', 'extend', 'terminate']),
  sessionId: z.string().uuid().optional(),
  extendReason: z.string().max(500).optional()
});

// GET - Validate current session
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const cookieStore = cookies();
    
    // Get session token from cookie
    const sessionToken = cookieStore.get('admin-session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({
        error: 'No session',
        message: 'No active admin session found',
        code: 'NO_SESSION'
      }, { status: 401 });
    }

    const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Validate session in database
    const { data: session, error: sessionError } = await supabase
      .from('admin_sessions')
      .select(`
        *,
        admin_users!inner (
          id, admin_level, account_locked, deactivated_at, requires_mfa,
          last_activity_at, session_timeout_minutes
        )
      `)
      .eq('session_token', sessionToken)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      // Clean up invalid cookie
      cookieStore.delete('admin-session');
      
      await logSecurityEvent(supabase, null, 'invalid_session_access', {
        token_hash: sessionToken ? sessionToken.substring(0, 16) : null,
        ip: clientIP,
        userAgent
      });
      
      return NextResponse.json({
        error: 'Invalid session',
        message: 'Session is invalid or expired',
        code: 'INVALID_SESSION'
      }, { status: 401 });
    }

    const adminUser = session.admin_users;

    // Check admin account status
    if (adminUser.account_locked) {
      await terminateSession(supabase, session.id, 'account_locked', adminUser.id);
      cookieStore.delete('admin-session');
      
      return NextResponse.json({
        error: 'Account locked',
        message: 'Admin account has been locked',
        code: 'ACCOUNT_LOCKED'
      }, { status: 423 });
    }

    if (adminUser.deactivated_at) {
      await terminateSession(supabase, session.id, 'account_deactivated', adminUser.id);
      cookieStore.delete('admin-session');
      
      return NextResponse.json({
        error: 'Account deactivated',
        message: 'Admin account has been deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      }, { status: 423 });
    }

    // Check for session security issues
    const securityIssues = await checkSessionSecurity(session, clientIP, userAgent);
    
    if (securityIssues.length > 0) {
      await logSecurityEvent(supabase, adminUser.id, 'session_security_violation', {
        session_id: session.id,
        issues: securityIssues,
        ip: clientIP,
        userAgent
      });
      
      // For high-risk issues, terminate session
      const highRiskIssues = securityIssues.filter(issue => 
        issue.severity === 'high' || issue.severity === 'critical'
      );
      
      if (highRiskIssues.length > 0) {
        await terminateSession(supabase, session.id, 'security_violation', adminUser.id);
        cookieStore.delete('admin-session');
        
        return NextResponse.json({
          error: 'Security violation',
          message: 'Session terminated due to security concerns',
          code: 'SECURITY_VIOLATION',
          issues: securityIssues.map(i => i.message)
        }, { status: 403 });
      }
    }

    // Update last activity
    await supabase
      .from('admin_sessions')
      .update({ 
        last_activity_at: new Date().toISOString()
      })
      .eq('id', session.id);

    // Check if session needs extension (within 5 minutes of expiry)
    const expiresAt = new Date(session.expires_at);
    const now = new Date();
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    const needsExtension = timeUntilExpiry <= 5 * 60 * 1000; // 5 minutes

    return NextResponse.json({
      valid: true,
      session: {
        id: session.id,
        adminId: adminUser.id,
        adminLevel: adminUser.admin_level,
        createdAt: session.created_at,
        lastActivity: session.last_activity_at,
        expiresAt: session.expires_at,
        mfaVerified: session.mfa_verified,
        ipAddress: session.ip_address,
        needsExtension,
        timeUntilExpiry: Math.max(0, Math.floor(timeUntilExpiry / 1000))
      },
      securityWarnings: securityIssues.filter(i => i.severity === 'medium'),
      permissions: await getUserPermissions(supabase, adminUser.id)
    });

  } catch (error) {
    console.error('Session validation error:', error);
    return NextResponse.json({
      error: 'Session validation failed',
      code: 'VALIDATION_ERROR'
    }, { status: 500 });
  }
}

// POST - Session operations (refresh, extend, terminate)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = sessionSchema.parse(body);
    const supabase = createClient();
    const cookieStore = cookies();
    
    const sessionToken = cookieStore.get('admin-session')?.value;
    const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    if (!sessionToken) {
      return NextResponse.json({
        error: 'No session',
        message: 'No active session found',
        code: 'NO_SESSION'
      }, { status: 401 });
    }

    // Get current session
    const { data: session, error: sessionError } = await supabase
      .from('admin_sessions')
      .select(`
        *,
        admin_users!inner (
          id, admin_level, session_timeout_minutes, max_concurrent_sessions
        )
      `)
      .eq('session_token', sessionToken)
      .eq('is_active', true)
      .single();

    if (sessionError || !session) {
      cookieStore.delete('admin-session');
      return NextResponse.json({
        error: 'Invalid session',
        code: 'INVALID_SESSION'
      }, { status: 401 });
    }

    const adminUser = session.admin_users;

    switch (validatedData.action) {
      case 'refresh':
        return await refreshSession(supabase, session, cookieStore, clientIP, userAgent);
      
      case 'extend':
        return await extendSession(supabase, session, validatedData.extendReason, clientIP, userAgent);
      
      case 'terminate':
        return await terminateCurrentSession(supabase, session, cookieStore, adminUser.id);
      
      default:
        return NextResponse.json({
          error: 'Invalid action',
          code: 'INVALID_ACTION'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Session operation error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 });
    }
    
    return NextResponse.json({
      error: 'Session operation failed',
      code: 'OPERATION_ERROR'
    }, { status: 500 });
  }
}

// DELETE - Terminate all sessions for current admin
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient();
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('admin-session')?.value;

    if (!sessionToken) {
      return NextResponse.json({
        error: 'No session',
        code: 'NO_SESSION'
      }, { status: 401 });
    }

    // Get current session to identify admin
    const { data: session } = await supabase
      .from('admin_sessions')
      .select('admin_id')
      .eq('session_token', sessionToken)
      .single();

    if (!session) {
      return NextResponse.json({
        error: 'Invalid session',
        code: 'INVALID_SESSION'
      }, { status: 401 });
    }

    const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Terminate all sessions for this admin
    const { data: terminatedSessions, error: terminateError } = await supabase
      .from('admin_sessions')
      .update({
        is_active: false,
        terminated_at: new Date().toISOString(),
        termination_reason: 'user_requested_logout_all'
      })
      .eq('admin_id', session.admin_id)
      .eq('is_active', true)
      .select('id');

    if (terminateError) {
      console.error('Session termination error:', terminateError);
      return NextResponse.json({
        error: 'Failed to terminate sessions',
        code: 'TERMINATION_ERROR'
      }, { status: 500 });
    }

    // Clear cookie
    cookieStore.delete('admin-session');

    // Log the action
    await supabase
      .from('admin_audit_log')
      .insert([{
        admin_id: session.admin_id,
        action: 'all_sessions_terminated',
        action_category: 'security',
        description: 'Admin terminated all active sessions',
        new_values: { 
          terminated_sessions_count: terminatedSessions?.length || 0
        },
        ip_address: clientIP,
        user_agent: userAgent,
        success: true
      }]);

    return NextResponse.json({
      success: true,
      message: 'All sessions terminated successfully',
      terminatedSessions: terminatedSessions?.length || 0
    });

  } catch (error) {
    console.error('Session termination error:', error);
    return NextResponse.json({
      error: 'Failed to terminate sessions',
      code: 'TERMINATION_ERROR'
    }, { status: 500 });
  }
}

// Helper functions
async function checkSessionSecurity(
  session: any,
  currentIP: string,
  currentUserAgent: string
): Promise<Array<{ severity: string; message: string; code: string }>> {
  const issues: Array<{ severity: string; message: string; code: string }> = [];
  
  // Check IP address consistency
  if (session.ip_address !== currentIP) {
    issues.push({
      severity: 'high',
      message: 'IP address changed during session',
      code: 'IP_CHANGE'
    });
  }
  
  // Check user agent consistency
  if (session.user_agent !== currentUserAgent) {
    issues.push({
      severity: 'medium',
      message: 'User agent changed during session',
      code: 'USER_AGENT_CHANGE'
    });
  }
  
  // Check session age (warn after 8 hours)
  const sessionAge = Date.now() - new Date(session.created_at).getTime();
  if (sessionAge > 8 * 60 * 60 * 1000) {
    issues.push({
      severity: 'medium',
      message: 'Session has been active for over 8 hours',
      code: 'LONG_SESSION'
    });
  }
  
  // Check for suspicious activity patterns
  if (session.is_suspicious) {
    issues.push({
      severity: 'high',
      message: 'Session flagged as suspicious',
      code: 'SUSPICIOUS_SESSION'
    });
  }
  
  return issues;
}

async function refreshSession(
  supabase: any,
  session: any,
  cookieStore: any,
  clientIP: string,
  userAgent: string
): Promise<NextResponse> {
  try {
    // Generate new session token
    const newSessionToken = randomBytes(32).toString('hex');
    const adminUser = session.admin_users;
    
    // Update session with new token and extended expiry
    const newExpiry = new Date(Date.now() + (adminUser.session_timeout_minutes || 30) * 60 * 1000);
    
    await supabase
      .from('admin_sessions')
      .update({
        session_token: newSessionToken,
        expires_at: newExpiry.toISOString(),
        last_activity_at: new Date().toISOString()
      })
      .eq('id', session.id);

    // Set new cookie
    cookieStore.set('admin-session', newSessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: (adminUser.session_timeout_minutes || 30) * 60,
      path: '/admin'
    });

    // Log the refresh
    await supabase
      .from('admin_audit_log')
      .insert([{
        admin_id: adminUser.id,
        session_id: session.id,
        action: 'session_refreshed',
        action_category: 'authentication',
        ip_address: clientIP,
        user_agent: userAgent,
        success: true
      }]);

    return NextResponse.json({
      success: true,
      message: 'Session refreshed successfully',
      expiresAt: newExpiry.toISOString()
    });

  } catch (error) {
    console.error('Session refresh error:', error);
    throw error;
  }
}

async function extendSession(
  supabase: any,
  session: any,
  reason: string | undefined,
  clientIP: string,
  userAgent: string
): Promise<NextResponse> {
  try {
    const adminUser = session.admin_users;
    
    // Only super admins can extend sessions beyond normal limits
    if (adminUser.admin_level !== 'super_admin') {
      return NextResponse.json({
        error: 'Permission denied',
        message: 'Only super administrators can extend session duration',
        code: 'INSUFFICIENT_PRIVILEGES'
      }, { status: 403 });
    }

    // Extend session by 4 hours maximum
    const extensionTime = 4 * 60 * 60 * 1000; // 4 hours
    const newExpiry = new Date(Date.now() + extensionTime);
    
    await supabase
      .from('admin_sessions')
      .update({
        expires_at: newExpiry.toISOString(),
        extended_until: newExpiry.toISOString(),
        last_activity_at: new Date().toISOString()
      })
      .eq('id', session.id);

    // Log the extension with reason
    await supabase
      .from('admin_audit_log')
      .insert([{
        admin_id: adminUser.id,
        session_id: session.id,
        action: 'session_extended',
        action_category: 'security',
        description: `Session extended: ${reason || 'No reason provided'}`,
        new_values: { 
          extended_until: newExpiry.toISOString(),
          reason: reason || 'No reason provided'
        },
        ip_address: clientIP,
        user_agent: userAgent,
        success: true
      }]);

    return NextResponse.json({
      success: true,
      message: 'Session extended successfully',
      expiresAt: newExpiry.toISOString(),
      extensionReason: reason || 'Administrative extension'
    });

  } catch (error) {
    console.error('Session extension error:', error);
    throw error;
  }
}

async function terminateCurrentSession(
  supabase: any,
  session: any,
  cookieStore: any,
  adminId: string
): Promise<NextResponse> {
  try {
    await terminateSession(supabase, session.id, 'user_logout', adminId);
    cookieStore.delete('admin-session');

    return NextResponse.json({
      success: true,
      message: 'Session terminated successfully'
    });

  } catch (error) {
    console.error('Session termination error:', error);
    throw error;
  }
}

async function terminateSession(
  supabase: any,
  sessionId: string,
  reason: string,
  terminatedBy?: string
): Promise<void> {
  await supabase
    .from('admin_sessions')
    .update({
      is_active: false,
      terminated_at: new Date().toISOString(),
      termination_reason: reason,
      terminated_by: terminatedBy
    })
    .eq('id', sessionId);
}

async function getUserPermissions(
  supabase: any,
  userId: string
): Promise<string[]> {
  try {
    const { data: permissions } = await supabase.rpc('get_user_permissions', {
      p_user_id: userId
    });
    
    return permissions || [];
  } catch (error) {
    console.error('Failed to get user permissions:', error);
    return [];
  }
}

async function logSecurityEvent(
  supabase: any,
  adminId: string | null,
  eventType: string,
  eventData: any
): Promise<void> {
  try {
    await supabase
      .from('admin_security_incidents')
      .insert([{
        incident_type: eventType,
        severity: eventType.includes('violation') ? 'high' : 'medium',
        affected_admin_id: adminId,
        title: `Session Security Event: ${eventType}`,
        description: 'Security event detected during session management',
        incident_data: eventData,
        detected_by: 'automated',
        detection_method: 'session_monitoring',
        source_ip: eventData.ip,
        occurred_at: new Date().toISOString()
      }]);
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}