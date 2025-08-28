import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAuth, AdminPermissionChecker, logAdminAction, checkAdminRateLimit } from '@/lib/auth/admin-middleware';
import { z } from 'zod';

const updateAdminUserSchema = z.object({
  adminLevel: z.enum(['super_admin', 'platform_admin', 'support_admin', 'content_moderator']).optional(),
  employeeId: z.string().optional(),
  department: z.string().optional(),
  requiresMFA: z.boolean().optional(),
  ipWhitelist: z.array(z.string().ip()).optional(),
  ipWhitelistEnabled: z.boolean().optional(),
  maxConcurrentSessions: z.number().min(1).max(10).optional(),
  sessionTimeoutMinutes: z.number().min(10).max(480).optional(),
  notes: z.string().max(1000).optional(),
  tags: z.array(z.string().max(50)).max(10).optional()
});

// GET /api/admin/users/[id] - Get specific admin user details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return requireAdminAuth(async (request, context) => {
    const supabase = createClient();
    const { id: adminUserId } = params;

    // Check permissions
    const permissions = new AdminPermissionChecker(context);
    if (!permissions.hasPermission('admin_users:read')) {
      return NextResponse.json({
        error: 'Insufficient permissions to view admin user details'
      }, { status: 403 });
    }

    try {
      // Rate limiting check
      const rateLimit = await checkAdminRateLimit(context.user!.id, 'get_admin_user', 100, 60);
      if (!rateLimit.allowed) {
        return NextResponse.json({
          error: 'Rate limit exceeded',
          resetAt: rateLimit.resetAt
        }, { status: 429 });
      }

      // Get admin user details
      const { data: adminUser, error } = await supabase
        .from('admin_users')
        .select(`
          *,
          profiles!inner (
            display_name,
            email,
            avatar_url,
            phone_number,
            city,
            state,
            country,
            created_at as profile_created_at
          ),
          created_by_profile:profiles!admin_users_created_by_fkey (
            display_name,
            email
          )
        `)
        .eq('id', adminUserId)
        .is('deactivated_at', null)
        .single();

      if (error || !adminUser) {
        return NextResponse.json({
          error: 'Admin user not found'
        }, { status: 404 });
      }

      // Get active sessions
      const { data: activeSessions } = await supabase
        .from('admin_sessions')
        .select(`
          id,
          created_at,
          last_activity_at,
          expires_at,
          ip_address,
          user_agent,
          browser,
          os,
          device_type,
          is_suspicious,
          suspicion_score,
          mfa_verified
        `)
        .eq('admin_id', adminUserId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      // Get MFA configuration
      const { data: mfaConfig } = await supabase
        .from('auth_mfa_config')
        .select(`
          mfa_enabled,
          mfa_enforced,
          totp_enabled,
          sms_enabled,
          email_enabled,
          last_used_method,
          last_used_at,
          backup_codes_generated_at
        `)
        .eq('user_id', adminUserId)
        .single();

      // Get recent activity summary
      const { data: recentActivity } = await supabase
        .from('admin_audit_log')
        .select('action, action_category, created_at, success')
        .eq('admin_id', adminUserId)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      // Get assigned business contexts (if any)
      const { data: businessAssignments } = await supabase
        .from('admin_business_assignments')
        .select(`
          id,
          assignment_type,
          assignment_reason,
          assigned_at,
          expires_at,
          businesses!inner (
            id,
            name,
            slug,
            status
          )
        `)
        .eq('admin_id', adminUserId)
        .eq('is_active', true);

      // Calculate activity statistics
      const activityStats = {
        totalActions: recentActivity?.length || 0,
        successfulActions: recentActivity?.filter((a: any) => a.success).length || 0,
        failedActions: recentActivity?.filter((a: any) => !a.success).length || 0,
        categoryCounts: recentActivity?.reduce((acc: any, activity: any) => {
          acc[activity.action_category] = (acc[activity.action_category] || 0) + 1;
          return acc;
        }, {}) || {}
      };

      const response = {
        success: true,
        data: {
          ...adminUser,
          profile: adminUser.profiles,
          createdBy: adminUser.created_by_profile,
          sessions: {
            active: activeSessions || [],
            count: activeSessions?.length || 0
          },
          mfa: mfaConfig || {
            mfa_enabled: false,
            mfa_enforced: false,
            totp_enabled: false,
            sms_enabled: false,
            email_enabled: false
          },
          activity: {
            recent: recentActivity || [],
            stats: activityStats
          },
          businessAssignments: businessAssignments || []
        }
      };

      // Log the access
      await logAdminAction(context, 'admin_user_viewed', 'user_management', {
        resourceType: 'admin_user',
        resourceId: adminUserId,
        success: true
      });

      return NextResponse.json(response);

    } catch (error) {
      console.error('Get admin user error:', error);
      
      await logAdminAction(context, 'admin_user_view_failed', 'user_management', {
        resourceType: 'admin_user',
        resourceId: adminUserId,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      return NextResponse.json({
        error: 'Failed to retrieve admin user details'
      }, { status: 500 });
    }
  }, {
    requiredPermissions: ['admin_users:read']
  })(request);
}

// PUT /api/admin/users/[id] - Update admin user
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return requireAdminAuth(async (request, context) => {
    const supabase = createClient();
    const { id: adminUserId } = params;

    // Check permissions
    const permissions = new AdminPermissionChecker(context);
    if (!permissions.hasPermission('admin_users:update')) {
      return NextResponse.json({
        error: 'Insufficient permissions to update admin users'
      }, { status: 403 });
    }

    // Prevent self-modification of certain fields
    if (adminUserId === context.user!.id) {
      return NextResponse.json({
        error: 'Cannot modify your own admin account'
      }, { status: 403 });
    }

    try {
      // Rate limiting check
      const rateLimit = await checkAdminRateLimit(context.user!.id, 'update_admin_user', 50, 60);
      if (!rateLimit.allowed) {
        return NextResponse.json({
          error: 'Rate limit exceeded',
          resetAt: rateLimit.resetAt
        }, { status: 429 });
      }

      const body = await request.json();
      const validatedData = updateAdminUserSchema.parse(body);

      // Get current admin user data
      const { data: currentAdmin, error: currentError } = await supabase
        .from('admin_users')
        .select('*')
        .eq('id', adminUserId)
        .is('deactivated_at', null)
        .single();

      if (currentError || !currentAdmin) {
        return NextResponse.json({
          error: 'Admin user not found'
        }, { status: 404 });
      }

      // Check authorization for admin level changes
      if (validatedData.adminLevel && validatedData.adminLevel !== currentAdmin.admin_level) {
        // Only super admins can change admin levels
        if (!permissions.hasAdminLevel('super_admin')) {
          return NextResponse.json({
            error: 'Only super admins can change admin levels'
          }, { status: 403 });
        }

        // Cannot elevate to super admin without being super admin
        if (validatedData.adminLevel === 'super_admin' && !permissions.hasAdminLevel('super_admin')) {
          return NextResponse.json({
            error: 'Only super admins can create super admin users'
          }, { status: 403 });
        }
      }

      // Prepare update data
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      // Map validated fields to database columns
      if (validatedData.adminLevel !== undefined) {
        updateData.admin_level = validatedData.adminLevel;
      }
      if (validatedData.employeeId !== undefined) {
        updateData.employee_id = validatedData.employeeId;
      }
      if (validatedData.department !== undefined) {
        updateData.department = validatedData.department;
      }
      if (validatedData.requiresMFA !== undefined) {
        updateData.requires_mfa = validatedData.requiresMFA;
      }
      if (validatedData.ipWhitelist !== undefined) {
        updateData.ip_whitelist = validatedData.ipWhitelist;
      }
      if (validatedData.ipWhitelistEnabled !== undefined) {
        updateData.ip_whitelist_enabled = validatedData.ipWhitelistEnabled;
      }
      if (validatedData.maxConcurrentSessions !== undefined) {
        updateData.max_concurrent_sessions = validatedData.maxConcurrentSessions;
      }
      if (validatedData.sessionTimeoutMinutes !== undefined) {
        updateData.session_timeout_minutes = validatedData.sessionTimeoutMinutes;
      }
      if (validatedData.notes !== undefined) {
        updateData.notes = validatedData.notes;
      }
      if (validatedData.tags !== undefined) {
        updateData.tags = validatedData.tags;
      }

      // Update the admin user
      const { data: updatedAdmin, error: updateError } = await supabase
        .from('admin_users')
        .update(updateData)
        .eq('id', adminUserId)
        .select(`
          *,
          profiles!inner (
            display_name,
            email,
            avatar_url
          )
        `)
        .single();

      if (updateError) {
        throw updateError;
      }

      // Handle role changes if admin level changed
      if (validatedData.adminLevel && validatedData.adminLevel !== currentAdmin.admin_level) {
        const roleMapping = {
          'super_admin': 'super_admin',
          'platform_admin': 'admin',
          'support_admin': 'moderator',
          'content_moderator': 'moderator'
        };

        const newRoleName = roleMapping[validatedData.adminLevel as keyof typeof roleMapping];
        
        // Remove old role assignments
        await supabase
          .from('user_roles')
          .update({ is_active: false, revoked_at: new Date().toISOString() })
          .eq('user_id', adminUserId)
          .eq('is_active', true);

        // Assign new role
        await supabase.rpc('assign_enhanced_role', {
          p_target_user_id: adminUserId,
          p_role_name: newRoleName,
          p_scope_type: 'global',
          p_scope_constraints: '{}',
          p_justification: `Admin level changed to ${validatedData.adminLevel}`,
          p_expires_in: null
        } as any);
      }

      // If IP whitelist was updated and admin has active sessions, check them
      if (validatedData.ipWhitelist !== undefined || validatedData.ipWhitelistEnabled !== undefined) {
        const { data: activeSessions } = await supabase
          .from('admin_sessions')
          .select('id, ip_address')
          .eq('admin_id', adminUserId)
          .eq('is_active', true);

        if (activeSessions && updatedAdmin.ip_whitelist_enabled) {
          for (const session of activeSessions) {
            const { data: ipValid } = await supabase.rpc('validate_admin_ip_access', {
              p_admin_id: adminUserId,
              p_ip_address: session.ip_address
            } as any);

            if (!ipValid) {
              // Terminate sessions from non-whitelisted IPs
              await supabase
                .from('admin_sessions')
                .update({
                  is_active: false,
                  terminated_at: new Date().toISOString(),
                  termination_reason: 'ip_whitelist_violation'
                })
                .eq('id', session.id);
            }
          }
        }
      }

      // Log the update
      await logAdminAction(context, 'admin_user_updated', 'user_management', {
        resourceType: 'admin_user',
        resourceId: adminUserId,
        success: true,
        oldValues: currentAdmin,
        newValues: updateData
      });

      return NextResponse.json({
        success: true,
        data: updatedAdmin,
        message: 'Admin user updated successfully'
      });

    } catch (error) {
      console.error('Update admin user error:', error);
      
      await logAdminAction(context, 'admin_user_update_failed', 'user_management', {
        resourceType: 'admin_user',
        resourceId: adminUserId,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof z.ZodError) {
        return NextResponse.json({
          error: 'Validation error',
          details: error.errors
        }, { status: 400 });
      }

      return NextResponse.json({
        error: 'Failed to update admin user'
      }, { status: 500 });
    }
  }, {
    requiredPermissions: ['admin_users:update'],
    maxSessionAge: 60
  })(request);
}

// DELETE /api/admin/users/[id] - Deactivate admin user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return requireAdminAuth(async (request, context) => {
    const supabase = createClient();
    const { id: adminUserId } = params;

    // Check permissions
    const permissions = new AdminPermissionChecker(context);
    if (!permissions.hasPermission('admin_users:delete') || 
        !permissions.hasAdminLevel('super_admin')) {
      return NextResponse.json({
        error: 'Only super admins can deactivate admin users'
      }, { status: 403 });
    }

    // Prevent self-deletion
    if (adminUserId === context.user!.id) {
      return NextResponse.json({
        error: 'Cannot deactivate your own admin account'
      }, { status: 403 });
    }

    try {
      // Rate limiting check
      const rateLimit = await checkAdminRateLimit(context.user!.id, 'delete_admin_user', 10, 60);
      if (!rateLimit.allowed) {
        return NextResponse.json({
          error: 'Rate limit exceeded',
          resetAt: rateLimit.resetAt
        }, { status: 429 });
      }

      // Get current admin user data
      const { data: currentAdmin, error: currentError } = await supabase
        .from('admin_users')
        .select('*')
        .eq('id', adminUserId)
        .is('deactivated_at', null)
        .single();

      if (currentError || !currentAdmin) {
        return NextResponse.json({
          error: 'Admin user not found'
        }, { status: 404 });
      }

      // Cannot delete the last super admin
      if (currentAdmin.admin_level === 'super_admin') {
        const { count: superAdminCount } = await supabase
          .from('admin_users')
          .select('*', { count: 'exact', head: true })
          .eq('admin_level', 'super_admin')
          .is('deactivated_at', null);

        if (superAdminCount && superAdminCount <= 1) {
          return NextResponse.json({
            error: 'Cannot deactivate the last super admin'
          }, { status: 400 });
        }
      }

      // Soft delete the admin user
      const { error: deactivateError } = await supabase
        .from('admin_users')
        .update({
          deactivated_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', adminUserId);

      if (deactivateError) {
        throw deactivateError;
      }

      // Terminate all active sessions
      await supabase
        .from('admin_sessions')
        .update({
          is_active: false,
          terminated_at: new Date().toISOString(),
          termination_reason: 'admin_deactivated'
        })
        .eq('admin_id', adminUserId)
        .eq('is_active', true);

      // Revoke all role assignments
      await supabase
        .from('user_roles')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoke_reason: 'admin_deactivated'
        })
        .eq('user_id', adminUserId)
        .eq('is_active', true);

      // Deactivate business assignments
      await supabase
        .from('admin_business_assignments')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoke_reason: 'admin_deactivated'
        })
        .eq('admin_id', adminUserId)
        .eq('is_active', true);

      // Log the deactivation
      await logAdminAction(context, 'admin_user_deactivated', 'user_management', {
        resourceType: 'admin_user',
        resourceId: adminUserId,
        success: true,
        oldValues: currentAdmin,
        newValues: {
          deactivated_at: new Date().toISOString(),
          reason: 'Deactivated by super admin'
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Admin user deactivated successfully'
      });

    } catch (error) {
      console.error('Deactivate admin user error:', error);
      
      await logAdminAction(context, 'admin_user_deactivation_failed', 'user_management', {
        resourceType: 'admin_user',
        resourceId: adminUserId,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      return NextResponse.json({
        error: 'Failed to deactivate admin user'
      }, { status: 500 });
    }
  }, {
    requiredPermissions: ['admin_users:delete'],
    requiredAdminLevel: 'super_admin',
    requireFreshAuth: true,
    maxSessionAge: 30
  })(request);
}