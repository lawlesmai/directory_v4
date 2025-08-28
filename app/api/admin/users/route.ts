import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAuth, AdminPermissionChecker, logAdminAction, checkAdminRateLimit } from '@/lib/auth/admin-middleware';
import { z } from 'zod';

const createAdminUserSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  adminLevel: z.enum(['super_admin', 'platform_admin', 'support_admin', 'content_moderator']),
  employeeId: z.string().optional(),
  department: z.string().optional(),
  requiresMFA: z.boolean().default(true),
  ipWhitelist: z.array(z.string()).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional()
});

const updateAdminUserSchema = z.object({
  adminLevel: z.enum(['super_admin', 'platform_admin', 'support_admin', 'content_moderator']).optional(),
  employeeId: z.string().optional(),
  department: z.string().optional(),
  requiresMFA: z.boolean().optional(),
  ipWhitelist: z.array(z.string()).optional(),
  ipWhitelistEnabled: z.boolean().optional(),
  accountLocked: z.boolean().optional(),
  lockoutReason: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional()
});

// GET /api/admin/users - List admin users with filtering and pagination
export const GET = requireAdminAuth(async (request, context) => {
  const supabase = createClient();
  const url = new URL(request.url);
  
  // Check permissions
  const permissions = new AdminPermissionChecker(context);
  if (!permissions.hasPermission('admin_users:read')) {
    return NextResponse.json({
      error: 'Insufficient permissions to view admin users'
    }, { status: 403 });
  }

  // Parse query parameters
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const offset = (page - 1) * limit;
  
  const adminLevel = url.searchParams.get('adminLevel');
  const department = url.searchParams.get('department');
  const status = url.searchParams.get('status'); // 'active', 'locked', 'all'
  const search = url.searchParams.get('search');

  try {
    // Rate limiting check
    const rateLimit = await checkAdminRateLimit(context.user!.id, 'list_admin_users', 200, 60);
    if (!rateLimit.allowed) {
      return NextResponse.json({
        error: 'Rate limit exceeded',
        resetAt: rateLimit.resetAt
      }, { status: 429 });
    }

    // Build query
    let query = supabase
      .from('admin_users')
      .select(`
        id,
        admin_level,
        department,
        employee_id,
        requires_mfa,
        account_locked,
        lockout_reason,
        last_login_at,
        last_activity_at,
        total_logins,
        created_at,
        updated_at,
        notes,
        tags,
        profiles!inner (
          display_name,
          email,
          avatar_url
        )
      `)
      .is('deactivated_at', null);

    // Apply filters
    if (adminLevel) {
      query = query.eq('admin_level', adminLevel);
    }
    
    if (department) {
      query = query.eq('department', department);
    }
    
    if (status === 'locked') {
      query = query.eq('account_locked', true);
    } else if (status === 'active') {
      query = query.eq('account_locked', false);
    }

    // Search functionality
    if (search) {
      query = query.or(`
        profiles.display_name.ilike.%${search}%,
        profiles.email.ilike.%${search}%,
        employee_id.ilike.%${search}%
      `);
    }

    // Get total count
    const { count } = await supabase
      .from('admin_users')
      .select('*', { count: 'exact', head: true })
      .is('deactivated_at', null);

    // Get paginated results
    const { data: adminUsers, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    // Get active sessions for each admin
    const adminIds = adminUsers.map((user: any) => user.id);
    const { data: activeSessions } = await supabase
      .from('admin_sessions')
      .select('admin_id, COUNT(*)')
      .in('admin_id', adminIds)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString());

    const sessionCounts = activeSessions?.reduce((acc: any, session: any) => {
      acc[session.admin_id] = session.count;
      return acc;
    }, {}) || {};

    // Log the list access
    await logAdminAction(context, 'admin_users_listed', 'user_management', {
      success: true,
      newValues: {
        filters: { adminLevel, department, status, search },
        resultCount: adminUsers.length
      }
    });

    return NextResponse.json({
      success: true,
      data: adminUsers.map((user: any) => ({
        ...user,
        activeSessions: sessionCounts[user.id] || 0
      })),
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('List admin users error:', error);
    
    await logAdminAction(context, 'admin_users_list_failed', 'user_management', {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json({
      error: 'Failed to retrieve admin users'
    }, { status: 500 });
  }
}, {
  requiredPermissions: ['admin_users:read']
});

// POST /api/admin/users - Create new admin user
export const POST = requireAdminAuth(async (request, context) => {
  const supabase = createClient();
  
  // Check permissions
  const permissions = new AdminPermissionChecker(context);
  if (!permissions.hasPermission('admin_users:create')) {
    return NextResponse.json({
      error: 'Insufficient permissions to create admin users'
    }, { status: 403 });
  }

  try {
    // Rate limiting check
    const rateLimit = await checkAdminRateLimit(context.user!.id, 'create_admin_user', 10, 60);
    if (!rateLimit.allowed) {
      return NextResponse.json({
        error: 'Rate limit exceeded',
        resetAt: rateLimit.resetAt
      }, { status: 429 });
    }

    const body = await request.json();
    const validatedData = createAdminUserSchema.parse(body);

    // Additional authorization checks
    if (validatedData.adminLevel === 'super_admin' && !permissions.hasAdminLevel('super_admin')) {
      return NextResponse.json({
        error: 'Only super admins can create super admin users'
      }, { status: 403 });
    }

    // Check if target user exists and is not already an admin
    const { data: targetUser, error: userError } = await supabase.auth.admin.getUserById(validatedData.userId);
    
    if (userError || !targetUser) {
      return NextResponse.json({
        error: 'Target user not found'
      }, { status: 404 });
    }

    const { data: existingAdmin, error: existingError } = await supabase
      .from('admin_users')
      .select('id')
      .eq('id', validatedData.userId)
      .single();

    if (existingAdmin) {
      return NextResponse.json({
        error: 'User is already an admin'
      }, { status: 409 });
    }

    // Create admin user using the database function
    const { data: adminUserId, error: createError } = await supabase.rpc('create_admin_user', {
      p_user_id: validatedData.userId,
      p_admin_level: validatedData.adminLevel,
      p_employee_id: validatedData.employeeId,
      p_department: validatedData.department,
      p_created_by: context.user!.id
    } as any);

    if (createError) {
      throw createError;
    }

    // Update additional fields if provided
    const updateData: any = {};
    if (validatedData.requiresMFA !== undefined) {
      updateData.requires_mfa = validatedData.requiresMFA;
    }
    if (validatedData.ipWhitelist) {
      updateData.ip_whitelist = validatedData.ipWhitelist;
      updateData.ip_whitelist_enabled = validatedData.ipWhitelist.length > 0;
    }
    if (validatedData.notes) {
      updateData.notes = validatedData.notes;
    }
    if (validatedData.tags) {
      updateData.tags = validatedData.tags;
    }

    if (Object.keys(updateData).length > 0) {
      await supabase
        .from('admin_users')
        .update(updateData)
        .eq('id', validatedData.userId);
    }

    // Get the created admin user with profile data
    const { data: createdAdmin, error: fetchError } = await supabase
      .from('admin_users')
      .select(`
        *,
        profiles!inner (
          display_name,
          email,
          avatar_url
        )
      `)
      .eq('id', validatedData.userId)
      .single();

    if (fetchError) {
      console.error('Failed to fetch created admin:', fetchError);
    }

    // Log the creation
    await logAdminAction(context, 'admin_user_created', 'user_management', {
      resourceType: 'admin_user',
      resourceId: validatedData.userId,
      success: true,
      newValues: {
        adminLevel: validatedData.adminLevel,
        employeeId: validatedData.employeeId,
        department: validatedData.department,
        email: targetUser.user?.email
      }
    });

    return NextResponse.json({
      success: true,
      data: createdAdmin,
      message: 'Admin user created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Create admin user error:', error);
    
    await logAdminAction(context, 'admin_user_creation_failed', 'user_management', {
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
      error: 'Failed to create admin user'
    }, { status: 500 });
  }
}, {
  requiredPermissions: ['admin_users:create'],
  maxSessionAge: 60 // Require fresh authentication within 1 hour
});

// Additional endpoints would be added here for:
// - PUT /api/admin/users/[id] - Update admin user
// - DELETE /api/admin/users/[id] - Deactivate admin user
// - POST /api/admin/users/[id]/lock - Lock admin account
// - POST /api/admin/users/[id]/unlock - Unlock admin account
// - GET /api/admin/users/[id]/sessions - Get admin user sessions
// - DELETE /api/admin/users/[id]/sessions - Terminate admin user sessions