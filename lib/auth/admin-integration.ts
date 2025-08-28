/**
 * Integration layer between the new Admin Portal system and existing Epic 2 authentication
 * Ensures compatibility and provides seamless integration with existing RBAC and auth flows
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

export interface AuthIntegrationContext {
  isAdminPortal: boolean;
  user?: {
    id: string;
    email: string;
    isAdmin: boolean;
    adminLevel?: string;
  };
  session?: {
    id: string;
    type: 'regular' | 'admin';
    expiresAt: string;
  };
  permissions: string[];
}

/**
 * Universal authentication function that works for both regular users and admin portal
 * Determines the appropriate authentication flow based on context
 */
export async function authenticateRequest(
  request: NextRequest,
  options: {
    requireAdmin?: boolean;
    requiredPermissions?: string[];
    requiredAdminLevel?: string;
  } = {}
): Promise<{ success: boolean; context?: AuthIntegrationContext; error?: string }> {
  try {
    const supabase = createClient();
    
    // Determine if this is an admin portal request
    const isAdminPortalRequest = request.url.includes('/api/admin/') || 
                                request.headers.get('x-admin-portal') === 'true';
    
    if (isAdminPortalRequest || options.requireAdmin) {
      // Use admin authentication
      const { withAdminAuth } = await import('./admin-middleware');
      const result = await withAdminAuth(request, {
        requiredPermissions: options.requiredPermissions,
        requiredAdminLevel: options.requiredAdminLevel
      });
      
      if (!result.success) {
        return { 
          success: false, 
          error: result.response ? await result.response.text() : 'Admin authentication failed' 
        };
      }
      
      return {
        success: true,
        context: {
          isAdminPortal: true,
          user: {
            id: result.context!.user!.id,
            email: result.context!.user!.email,
            isAdmin: true,
            adminLevel: result.context!.user!.adminLevel
          },
          session: {
            id: result.context!.session!.id,
            type: 'admin',
            expiresAt: result.context!.session!.expiresAt
          },
          permissions: result.context!.permissions
        }
      };
    } else {
      // Use regular Epic 2 authentication
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        return { success: false, error: 'Authentication required' };
      }
      
      // Get user permissions using existing RBAC system
      const { data: permissions } = await supabase.rpc('evaluate_user_permissions', {
        p_user_id: user.id,
        p_context: '{}'
      } as any);
      
      const userPermissions = (permissions as any)?.map?.((p: any) => `${p.resource_name}:${p.action_name}`) || [];
      
      // Check if user is also an admin
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('admin_level')
        .eq('id', user.id)
        .single();
      
      return {
        success: true,
        context: {
          isAdminPortal: false,
          user: {
            id: user.id,
            email: user.email!,
            isAdmin: !!adminUser,
            adminLevel: adminUser?.admin_level
          },
          permissions: userPermissions
        }
      };
    }
  } catch (error) {
    console.error('Authentication integration error:', error);
    return { success: false, error: 'Authentication system error' };
  }
}

/**
 * Enhanced RBAC integration that works with both regular and admin permissions
 */
export class IntegratedPermissionChecker {
  constructor(private context: AuthIntegrationContext) {}

  /**
   * Check if user has a specific permission (works for both regular and admin permissions)
   */
  hasPermission(permission: string): boolean {
    return this.context.permissions.includes(permission);
  }

  /**
   * Check if user has any of the provided permissions
   */
  hasAnyPermission(permissions: string[]): boolean {
    return permissions.some(permission => this.hasPermission(permission));
  }

  /**
   * Check if user has all of the provided permissions
   */
  hasAllPermissions(permissions: string[]): boolean {
    return permissions.every(permission => this.hasPermission(permission));
  }

  /**
   * Check if user can access admin portal features
   */
  canAccessAdminPortal(): boolean {
    return this.context.user?.isAdmin === true;
  }

  /**
   * Check if user has sufficient admin level
   */
  hasAdminLevel(level: string): boolean {
    if (!this.context.user?.isAdmin) {
      return false;
    }
    
    const hierarchy = {
      'super_admin': 0,
      'platform_admin': 1,
      'support_admin': 2,
      'content_moderator': 3
    };

    const userLevel = hierarchy[this.context.user.adminLevel as keyof typeof hierarchy] ?? 999;
    const requiredLevel = hierarchy[level as keyof typeof hierarchy] ?? 0;

    return userLevel <= requiredLevel;
  }

  /**
   * Check if user can manage another user (considering both regular and admin contexts)
   */
  canManageUser(targetUserId: string, context?: { isTargetAdmin?: boolean; targetAdminLevel?: string }): boolean {
    // Admin portal permissions
    if (this.context.isAdminPortal) {
      // Super admins can manage anyone
      if (this.hasAdminLevel('super_admin')) {
        return true;
      }
      
      // Platform admins can manage non-admin users and lower-level admins
      if (this.hasAdminLevel('platform_admin')) {
        if (!context?.isTargetAdmin) {
          return true; // Can manage regular users
        }
        
        // Can manage lower-level admins
        if (context.targetAdminLevel) {
          return this.hasAdminLevel(context.targetAdminLevel);
        }
      }
      
      return false;
    }
    
    // Regular Epic 2 permissions
    return this.hasPermission('users:manage') || this.hasPermission('users:update');
  }

  /**
   * Check if user can access business management features
   */
  canManageBusiness(businessId?: string, action: string = 'read'): boolean {
    const permission = `businesses:${action}`;
    
    if (this.hasPermission(permission)) {
      return true;
    }
    
    // Check business-specific permissions if business ID provided
    if (businessId && this.context.isAdminPortal) {
      return this.hasPermission(`businesses:${action}`) || 
             this.hasPermission('admin_portal:business_management');
    }
    
    return false;
  }

  /**
   * Get effective permissions based on context
   */
  getEffectivePermissions(): {
    regular: string[];
    admin: string[];
    combined: string[];
  } {
    const regularPermissions = this.context.permissions.filter(p => !p.startsWith('admin_'));
    const adminPermissions = this.context.permissions.filter(p => p.startsWith('admin_'));
    
    return {
      regular: regularPermissions,
      admin: adminPermissions,
      combined: this.context.permissions
    };
  }
}

/**
 * Migrate existing users to admin system if they have admin roles
 */
export async function migrateAdminUsers(): Promise<{ success: boolean; migrated: number; errors: string[] }> {
  try {
    const supabase = createClient();
    const errors: string[] = [];
    let migrated = 0;
    
    // Find users with admin roles in the existing system
    const { data: adminRoleUsers, error: roleError } = await supabase
      .from('user_roles')
      .select(`
        user_id,
        roles!inner (
          name
        ),
        profiles!inner (
          email
        )
      `)
      .in('roles.name', ['super_admin', 'admin', 'moderator'])
      .eq('is_active', true);
    
    if (roleError) {
      throw roleError;
    }
    
    for (const roleUser of adminRoleUsers || []) {
      try {
        // Check if user is already in admin system
        const { data: existingAdmin } = await supabase
          .from('admin_users')
          .select('id')
          .eq('id', roleUser.user_id)
          .single();
        
        if (existingAdmin) {
          continue; // Already migrated
        }
        
        // Map role names to admin levels
        const roleMapping = {
          'super_admin': 'super_admin',
          'admin': 'platform_admin',
          'moderator': 'support_admin'
        };
        
        const adminLevel = roleMapping[roleUser.roles.name as keyof typeof roleMapping] || 'support_admin';
        
        // Create admin user entry
        const { error: createError } = await supabase.rpc('create_admin_user', {
          p_user_id: roleUser.user_id,
          p_admin_level: adminLevel,
          p_employee_id: null,
          p_department: 'Migration',
          p_created_by: null // System migration
        } as any);
        
        if (createError) {
          errors.push(`Failed to migrate user ${roleUser.user_id}: ${createError.message}`);
        } else {
          migrated++;
        }
        
      } catch (error) {
        errors.push(`Error processing user ${roleUser.user_id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return { success: true, migrated, errors };
    
  } catch (error) {
    console.error('Admin user migration error:', error);
    return { 
      success: false, 
      migrated: 0, 
      errors: [error instanceof Error ? error.message : 'Migration failed'] 
    };
  }
}

/**
 * Sync permissions between regular RBAC and admin portal systems
 */
export async function syncPermissions(): Promise<{ success: boolean; synced: number; errors: string[] }> {
  try {
    const supabase = createClient();
    const errors: string[] = [];
    let synced = 0;
    
    // Get all admin users
    const { data: adminUsers, error: adminError } = await supabase
      .from('admin_users')
      .select('id, admin_level')
      .is('deactivated_at', null);
    
    if (adminError) {
      throw adminError;
    }
    
    for (const admin of adminUsers || []) {
      try {
        // Map admin level to Epic 2 roles
        const roleMapping = {
          'super_admin': 'super_admin',
          'platform_admin': 'admin',
          'support_admin': 'moderator',
          'content_moderator': 'moderator'
        };
        
        const roleName = roleMapping[admin.admin_level as keyof typeof roleMapping];
        
        if (!roleName) {
          continue;
        }
        
        // Check if user already has the role in Epic 2 system
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', admin.id)
          .eq('roles.name', roleName)
          .eq('is_active', true)
          .single();
        
        if (existingRole) {
          continue; // Already has role
        }
        
        // Assign the role in Epic 2 system
        const { error: assignError } = await supabase.rpc('assign_enhanced_role', {
          p_target_user_id: admin.id,
          p_role_name: roleName,
          p_scope_type: 'global',
          p_scope_constraints: '{}',
          p_justification: 'Admin portal sync',
          p_expires_in: null
        } as any);
        
        if (assignError) {
          errors.push(`Failed to sync permissions for admin ${admin.id}: ${assignError.message}`);
        } else {
          synced++;
        }
        
      } catch (error) {
        errors.push(`Error syncing admin ${admin.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return { success: true, synced, errors };
    
  } catch (error) {
    console.error('Permission sync error:', error);
    return { 
      success: false, 
      synced: 0, 
      errors: [error instanceof Error ? error.message : 'Sync failed'] 
    };
  }
}

/**
 * Validate system integrity between Epic 2 auth and admin portal
 */
export async function validateSystemIntegrity(): Promise<{
  success: boolean;
  issues: string[];
  stats: {
    totalUsers: number;
    adminUsers: number;
    orphanedAdmins: number;
    missingRoles: number;
  };
}> {
  try {
    const supabase = createClient();
    const issues: string[] = [];
    
    // Get statistics
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    const { count: adminUsers } = await supabase
      .from('admin_users')
      .select('*', { count: 'exact', head: true })
      .is('deactivated_at', null);
    
    // Find admin users without corresponding Epic 2 user accounts
    const { data: orphanedAdmins } = await supabase
      .from('admin_users')
      .select('id')
      .not('id', 'in', 
        supabase.from('profiles').select('id')
      )
      .is('deactivated_at', null);
    
    if (orphanedAdmins && orphanedAdmins.length > 0) {
      issues.push(`Found ${orphanedAdmins.length} admin users without corresponding user profiles`);
    }
    
    // Find admin users without proper Epic 2 roles
    const { data: adminsWithoutRoles } = await supabase
      .from('admin_users')
      .select(`
        id,
        admin_level,
        user_roles!left (
          id,
          roles!inner (
            name
          )
        )
      `)
      .is('deactivated_at', null)
      .is('user_roles.id', null);
    
    if (adminsWithoutRoles && adminsWithoutRoles.length > 0) {
      issues.push(`Found ${adminsWithoutRoles.length} admin users without corresponding Epic 2 roles`);
    }
    
    // Check for permission inconsistencies
    const { data: inconsistentPermissions } = await supabase.rpc('validate_permission_consistency');
    
    if (inconsistentPermissions && (inconsistentPermissions as any)?.length > 0) {
      issues.push(`Found ${(inconsistentPermissions as any).length} permission inconsistencies`);
    }
    
    return {
      success: issues.length === 0,
      issues,
      stats: {
        totalUsers: totalUsers || 0,
        adminUsers: adminUsers || 0,
        orphanedAdmins: orphanedAdmins?.length || 0,
        missingRoles: adminsWithoutRoles?.length || 0
      }
    };
    
  } catch (error) {
    console.error('System integrity validation error:', error);
    return {
      success: false,
      issues: [error instanceof Error ? error.message : 'Validation failed'],
      stats: {
        totalUsers: 0,
        adminUsers: 0,
        orphanedAdmins: 0,
        missingRoles: 0
      }
    };
  }
}

/**
 * Higher-order function for routes that need integrated authentication
 */
export function withIntegratedAuth<T extends any[]>(
  handler: (request: NextRequest, context: AuthIntegrationContext, ...args: T) => Promise<Response>,
  options: {
    requireAdmin?: boolean;
    requiredPermissions?: string[];
    requiredAdminLevel?: string;
  } = {}
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    try {
      const authResult = await authenticateRequest(request, options);
      
      if (!authResult.success) {
        return new Response(JSON.stringify({
          error: 'Authentication failed',
          message: authResult.error
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return await handler(request, authResult.context!, ...args);
      
    } catch (error) {
      console.error('Integrated auth wrapper error:', error);
      return new Response(JSON.stringify({
        error: 'Authentication system error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  };
}

export default {
  authenticateRequest,
  IntegratedPermissionChecker,
  migrateAdminUsers,
  syncPermissions,
  validateSystemIntegrity,
  withIntegratedAuth
};