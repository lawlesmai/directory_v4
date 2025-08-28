import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export interface AdminAuthContext {
  isAuthenticated: boolean;
  user?: {
    id: string;
    adminLevel: string;
    email: string;
    displayName?: string;
  };
  session?: {
    id: string;
    expiresAt: string;
    isSuspicious: boolean;
    requiresReauth: boolean;
  };
  permissions: string[];
}

export interface AdminAuthOptions {
  requiredPermissions?: string[];
  requiredAdminLevel?: string;
  allowSuspiciousSession?: boolean;
  requireFreshAuth?: boolean;
  maxSessionAge?: number; // in minutes
}

/**
 * Middleware to authenticate and authorize admin users
 */
export async function withAdminAuth(
  request: NextRequest,
  options: AdminAuthOptions = {}
): Promise<{ success: boolean; context?: AdminAuthContext; response?: NextResponse }> {
  try {
    const supabase = createClient();
    const cookieStore = cookies();
    
    // Get session token from cookie
    const sessionToken = cookieStore.get('admin-session')?.value;
    
    if (!sessionToken) {
      return {
        success: false,
        response: NextResponse.json({
          error: 'Authentication required',
          code: 'NO_SESSION'
        }, { status: 401 })
      };
    }

    // Get client IP for security validation
    const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';

    // Validate session and get admin details
    const { data: session, error: sessionError } = await supabase
      .from('admin_sessions')
      .select(`
        id,
        admin_id,
        ip_address,
        expires_at,
        is_suspicious,
        suspicion_score,
        mfa_verified,
        created_at,
        admin_users!inner (
          id,
          admin_level,
          account_locked,
          requires_mfa,
          mfa_grace_period,
          profiles!inner (
            display_name,
            email
          )
        )
      `)
      .eq('session_token', sessionToken)
      .eq('is_active', true)
      .single();

    if (sessionError || !session) {
      // Clear invalid cookie
      cookieStore.delete('admin-session');
      
      return {
        success: false,
        response: NextResponse.json({
          error: 'Invalid or expired session',
          code: 'INVALID_SESSION'
        }, { status: 401 })
      };
    }

    // Check if session has expired
    if (new Date(session.expires_at) <= new Date()) {
      // Terminate expired session
      await supabase
        .from('admin_sessions')
        .update({
          is_active: false,
          terminated_at: new Date().toISOString(),
          termination_reason: 'expired'
        })
        .eq('id', session.id);

      cookieStore.delete('admin-session');
      
      return {
        success: false,
        response: NextResponse.json({
          error: 'Session expired',
          code: 'SESSION_EXPIRED'
        }, { status: 401 })
      };
    }

    // Check if admin account is locked
    if (session.admin_users.account_locked) {
      // Terminate session for locked account
      await supabase
        .from('admin_sessions')
        .update({
          is_active: false,
          terminated_at: new Date().toISOString(),
          termination_reason: 'account_locked'
        })
        .eq('id', session.id);

      cookieStore.delete('admin-session');
      
      return {
        success: false,
        response: NextResponse.json({
          error: 'Account has been locked',
          code: 'ACCOUNT_LOCKED'
        }, { status: 423 })
      };
    }

    // Validate IP consistency for high-privilege operations
    const ipChanged = session.ip_address !== clientIP;
    const requiresReauth = ipChanged && (
      session.admin_users.admin_level === 'super_admin' ||
      options.requireFreshAuth
    );

    // Check suspicious activity
    if (session.is_suspicious && !options.allowSuspiciousSession) {
      if (session.suspicion_score > 75) {
        return {
          success: false,
          response: NextResponse.json({
            error: 'Session flagged as suspicious - re-authentication required',
            code: 'SUSPICIOUS_SESSION'
          }, { status: 403 })
        };
      }
    }

    // Check session age if required
    if (options.maxSessionAge) {
      const sessionAge = (Date.now() - new Date(session.created_at).getTime()) / (1000 * 60);
      if (sessionAge > options.maxSessionAge) {
        return {
          success: false,
          response: NextResponse.json({
            error: 'Session too old - fresh authentication required',
            code: 'STALE_SESSION'
          }, { status: 401 })
        };
      }
    }

    // Check MFA requirements
    const requiresMFA = session.admin_users.requires_mfa || session.admin_users.admin_level === 'super_admin';
    const inGracePeriod = session.admin_users.mfa_grace_period && 
      new Date(session.admin_users.mfa_grace_period) > new Date();
    
    if (requiresMFA && !session.mfa_verified && !inGracePeriod) {
      return {
        success: false,
        response: NextResponse.json({
          error: 'MFA verification required',
          code: 'MFA_REQUIRED'
        }, { status: 412 })
      };
    }

    // Check required admin level
    if (options.requiredAdminLevel) {
      const adminLevelHierarchy = {
        'super_admin': 0,
        'platform_admin': 1,
        'support_admin': 2,
        'content_moderator': 3
      };

      const userLevel = adminLevelHierarchy[session.admin_users.admin_level as keyof typeof adminLevelHierarchy] ?? 999;
      const requiredLevel = adminLevelHierarchy[options.requiredAdminLevel as keyof typeof adminLevelHierarchy] ?? 0;

      if (userLevel > requiredLevel) {
        return {
          success: false,
          response: NextResponse.json({
            error: 'Insufficient admin privileges',
            code: 'INSUFFICIENT_PRIVILEGES'
          }, { status: 403 })
        };
      }
    }

    // Get user permissions
    const { data: permissions } = await supabase.rpc('evaluate_user_permissions', {
      p_user_id: session.admin_id,
      p_context: { admin_portal: true }
    } as any);

    const userPermissions = (permissions as any)?.map?.((p: any) => `${p.resource_name}:${p.action_name}`) || [];

    // Check required permissions
    if (options.requiredPermissions && options.requiredPermissions.length > 0) {
      const hasAllPermissions = options.requiredPermissions.every(permission => 
        userPermissions.includes(permission)
      );

      if (!hasAllPermissions) {
        return {
          success: false,
          response: NextResponse.json({
            error: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS',
            required: options.requiredPermissions,
            available: userPermissions
          }, { status: 403 })
        };
      }
    }

    // Update last activity
    await supabase
      .from('admin_sessions')
      .update({
        last_activity_at: new Date().toISOString()
      })
      .eq('id', session.id);

    await supabase
      .from('admin_users')
      .update({
        last_activity_at: new Date().toISOString()
      })
      .eq('id', session.admin_id);

    // Build authentication context
    const context: AdminAuthContext = {
      isAuthenticated: true,
      user: {
        id: session.admin_users.id,
        adminLevel: session.admin_users.admin_level,
        email: session.admin_users.profiles.email,
        displayName: session.admin_users.profiles.display_name
      },
      session: {
        id: session.id,
        expiresAt: session.expires_at,
        isSuspicious: session.is_suspicious,
        requiresReauth: Boolean(requiresReauth)
      },
      permissions: userPermissions
    };

    return { success: true, context };

  } catch (error) {
    console.error('Admin authentication middleware error:', error);
    
    return {
      success: false,
      response: NextResponse.json({
        error: 'Authentication error',
        code: 'AUTH_ERROR'
      }, { status: 500 })
    };
  }
}

/**
 * Higher-order function to wrap API routes with admin authentication
 */
export function requireAdminAuth(
  handler: (request: NextRequest, context: AdminAuthContext) => Promise<NextResponse>,
  options: AdminAuthOptions = {}
) {
  return async (request: NextRequest) => {
    const authResult = await withAdminAuth(request, options);
    
    if (!authResult.success) {
      return authResult.response!;
    }
    
    try {
      return await handler(request, authResult.context!);
    } catch (error) {
      console.error('Admin route handler error:', error);
      return NextResponse.json({
        error: 'Internal server error'
      }, { status: 500 });
    }
  };
}

/**
 * Permission checking utilities
 */
export class AdminPermissionChecker {
  constructor(private context: AdminAuthContext) {}

  hasPermission(permission: string): boolean {
    return this.context.permissions.includes(permission);
  }

  hasAnyPermission(permissions: string[]): boolean {
    return permissions.some(permission => this.hasPermission(permission));
  }

  hasAllPermissions(permissions: string[]): boolean {
    return permissions.every(permission => this.hasPermission(permission));
  }

  hasAdminLevel(level: string): boolean {
    const hierarchy = {
      'super_admin': 0,
      'platform_admin': 1,
      'support_admin': 2,
      'content_moderator': 3
    };

    const userLevel = hierarchy[this.context.user!.adminLevel as keyof typeof hierarchy] ?? 999;
    const requiredLevel = hierarchy[level as keyof typeof hierarchy] ?? 0;

    return userLevel <= requiredLevel;
  }

  canManageUser(targetUserId: string): boolean {
    // Super admins can manage anyone
    if (this.hasAdminLevel('super_admin')) {
      return true;
    }

    // Users can't manage themselves through admin functions
    if (this.context.user!.id === targetUserId) {
      return false;
    }

    // Platform admins can manage support admins and content moderators
    if (this.hasAdminLevel('platform_admin')) {
      return this.hasPermission('users:manage');
    }

    return false;
  }

  canAccessResource(resource: string, action: string, context?: any): boolean {
    const permission = `${resource}:${action}`;
    
    if (!this.hasPermission(permission)) {
      return false;
    }

    // Additional context-based checks
    if (context?.businessId && resource === 'businesses') {
      // Check if admin has access to specific business
      return this.hasPermission('businesses:read') || 
             this.hasPermission('businesses:manage');
    }

    return true;
  }
}

/**
 * Audit logging for admin actions
 */
export async function logAdminAction(
  context: AdminAuthContext,
  action: string,
  category: string,
  details: {
    resourceType?: string;
    resourceId?: string;
    oldValues?: any;
    newValues?: any;
    success: boolean;
    errorMessage?: string;
  }
): Promise<void> {
  try {
    const supabase = createClient();
    
    await supabase.rpc('log_admin_action', {
      p_admin_id: context.user!.id,
      p_session_id: context.session!.id,
      p_action: action,
      p_action_category: category,
      p_resource_type: details.resourceType,
      p_resource_id: details.resourceId,
      p_old_values: details.oldValues,
      p_new_values: details.newValues,
      p_success: details.success,
      p_error_message: details.errorMessage
    } as any);
  } catch (error) {
    console.error('Failed to log admin action:', error);
    // Don't throw - logging failures shouldn't break the main operation
  }
}

/**
 * Rate limiting for admin operations
 */
export async function checkAdminRateLimit(
  adminId: string,
  operation: string,
  maxAttempts: number = 100,
  windowMinutes: number = 60
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  try {
    const supabase = createClient();
    
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
    const windowEnd = new Date(Date.now());

    // Get or create rate limit record
    const { data: rateLimit, error } = await supabase
      .from('admin_rate_limits')
      .select('*')
      .eq('admin_id', adminId)
      .eq('operation', operation)
      .gte('window_end', new Date().toISOString())
      .single();

    if (error && error.code === 'PGRST116') {
      // Create new rate limit record
      await supabase
        .from('admin_rate_limits')
        .insert([{
          admin_id: adminId,
          operation,
          operation_category: operation.split('_')[0] || 'general',
          attempt_count: 1,
          max_attempts: maxAttempts,
          window_start: windowStart.toISOString(),
          window_end: windowEnd.toISOString()
        }]);

      return {
        allowed: true,
        remaining: maxAttempts - 1,
        resetAt: windowEnd
      };
    }

    if (error) {
      throw error;
    }

    // Check if blocked
    if (rateLimit.is_blocked && rateLimit.blocked_until && new Date(rateLimit.blocked_until) > new Date()) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(rateLimit.blocked_until)
      };
    }

    // Increment attempt count
    const newCount = rateLimit.attempt_count + 1;
    const isBlocked = newCount > maxAttempts;

    await supabase
      .from('admin_rate_limits')
      .update({
        attempt_count: newCount,
        is_blocked: isBlocked,
        blocked_until: isBlocked ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null
      })
      .eq('id', rateLimit.id);

    return {
      allowed: !isBlocked,
      remaining: Math.max(0, maxAttempts - newCount),
      resetAt: new Date(rateLimit.window_end)
    };

  } catch (error) {
    console.error('Rate limiting error:', error);
    // On error, allow the operation to prevent blocking due to infrastructure issues
    return {
      allowed: true,
      remaining: 999,
      resetAt: new Date(Date.now() + 60 * 60 * 1000)
    };
  }
}