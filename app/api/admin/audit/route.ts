import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAuth, AdminPermissionChecker, logAdminAction, checkAdminRateLimit } from '@/lib/auth/admin-middleware';
import { z } from 'zod';

const auditQuerySchema = z.object({
  page: z.string().transform(val => parseInt(val)).default('1'),
  limit: z.string().transform(val => Math.min(parseInt(val), 100)).default('20'),
  adminId: z.string().uuid().optional(),
  action: z.string().optional(),
  actionCategory: z.enum(['authentication', 'user_management', 'business_management', 'content_moderation', 'system_config', 'security']).optional(),
  resourceType: z.enum(['user', 'admin_user', 'business', 'review', 'system_config', 'admin_session']).optional(),
  resourceId: z.string().uuid().optional(),
  success: z.enum(['true', 'false', 'all']).default('all'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional()
});

// GET /api/admin/audit - Query audit logs with filtering and search
export const GET = requireAdminAuth(async (request, context) => {
  const supabase = createClient();
  const url = new URL(request.url);
  
  // Check permissions
  const permissions = new AdminPermissionChecker(context);
  if (!permissions.hasPermission('admin_audit:read')) {
    return NextResponse.json({
      error: 'Insufficient permissions to view audit logs'
    }, { status: 403 });
  }

  try {
    // Rate limiting check
    const rateLimit = await checkAdminRateLimit(context.user!.id, 'query_audit_logs', 100, 60);
    if (!rateLimit.allowed) {
      return NextResponse.json({
        error: 'Rate limit exceeded',
        resetAt: rateLimit.resetAt
      }, { status: 429 });
    }

    // Parse and validate query parameters
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const validatedQuery = auditQuerySchema.parse(queryParams);
    
    const {
      page,
      limit,
      adminId,
      action,
      actionCategory,
      resourceType,
      resourceId,
      success,
      startDate,
      endDate,
      search,
      severity
    } = validatedQuery;

    const offset = (page - 1) * limit;

    // Build base query
    let query = supabase
      .from('admin_audit_log')
      .select(`
        id,
        admin_id,
        session_id,
        action,
        action_category,
        action_description,
        resource_type,
        resource_id,
        resource_name,
        old_values,
        new_values,
        affected_fields,
        ip_address,
        user_agent,
        success,
        error_code,
        error_message,
        affected_records_count,
        data_classification,
        tags,
        created_at,
        processed_at,
        admin_users!inner (
          id,
          admin_level,
          profiles!inner (
            display_name,
            email
          )
        )
      `);

    // Apply filters
    if (adminId) {
      query = query.eq('admin_id', adminId);
    }
    
    if (action) {
      query = query.eq('action', action);
    }
    
    if (actionCategory) {
      query = query.eq('action_category', actionCategory);
    }
    
    if (resourceType) {
      query = query.eq('resource_type', resourceType);
    }
    
    if (resourceId) {
      query = query.eq('resource_id', resourceId);
    }
    
    if (success !== 'all') {
      query = query.eq('success', success === 'true');
    }

    // Date range filtering
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    // Search functionality
    if (search) {
      query = query.or(`
        action.ilike.%${search}%,
        action_description.ilike.%${search}%,
        resource_name.ilike.%${search}%,
        error_message.ilike.%${search}%,
        admin_users.profiles.display_name.ilike.%${search}%,
        admin_users.profiles.email.ilike.%${search}%
      `);
    }

    // Get total count for pagination
    const { count, error: countError } = await query
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw countError;
    }

    // Get paginated results
    const { data: auditLogs, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    // Get related session information for context
    const sessionIds = auditLogs
      .map((log: any) => log.session_id)
      .filter((id: any) => id !== null);

    let sessionData: Record<string, any> = {};
    if (sessionIds.length > 0) {
      const { data: sessions } = await supabase
        .from('admin_sessions')
        .select('id, ip_address, user_agent, created_at, terminated_at')
        .in('id', sessionIds);

      sessionData = sessions?.reduce((acc: Record<string, any>, session: any) => {
        acc[session.id] = session;
        return acc;
      }, {}) || {};
    }

    // Format the response data
    const formattedLogs = auditLogs.map((log: any) => ({
      id: log.id,
      admin: {
        id: log.admin_users.id,
        displayName: log.admin_users.profiles.display_name,
        email: log.admin_users.profiles.email,
        adminLevel: log.admin_users.admin_level
      },
      session: sessionData[log.session_id] || null,
      action: {
        name: log.action,
        category: log.action_category,
        description: log.action_description
      },
      resource: {
        type: log.resource_type,
        id: log.resource_id,
        name: log.resource_name
      },
      changes: {
        oldValues: log.old_values,
        newValues: log.new_values,
        affectedFields: log.affected_fields,
        affectedRecordsCount: log.affected_records_count
      },
      context: {
        ipAddress: log.ip_address,
        userAgent: log.user_agent
      },
      result: {
        success: log.success,
        errorCode: log.error_code,
        errorMessage: log.error_message
      },
      metadata: {
        dataClassification: log.data_classification,
        tags: log.tags
      },
      timestamps: {
        createdAt: log.created_at,
        processedAt: log.processed_at
      }
    }));

    // Log the audit query (meta-logging)
    await logAdminAction(context, 'audit_logs_queried', 'security', {
      success: true,
      newValues: {
        filters: {
          adminId,
          action,
          actionCategory,
          resourceType,
          success,
          dateRange: startDate || endDate ? { startDate, endDate } : null
        },
        resultCount: auditLogs.length
      }
    });

    return NextResponse.json({
      success: true,
      data: formattedLogs,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      },
      filters: {
        adminId,
        action,
        actionCategory,
        resourceType,
        success,
        startDate,
        endDate,
        search
      }
    });

  } catch (error) {
    console.error('Audit logs query error:', error);
    
    await logAdminAction(context, 'audit_logs_query_failed', 'security', {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid query parameters',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Failed to retrieve audit logs'
    }, { status: 500 });
  }
}, {
  requiredPermissions: ['admin_audit:read']
});

// GET /api/admin/audit/summary - Get audit summary statistics (invalid Next.js route export)
// This functionality should be moved to /api/admin/audit/summary/route.ts
// For now, commenting out to prevent build errors
/*
export async function GET_SUMMARY(request: NextRequest) {
  return requireAdminAuth(async (request, context) => {
    const supabase = createClient();
    
    // Check permissions
    const permissions = new AdminPermissionChecker(context);
    if (!permissions.hasPermission('admin_audit:read')) {
      return NextResponse.json({
        error: 'Insufficient permissions to view audit summary'
      }, { status: 403 });
    }

    try {
      // Rate limiting check
      const rateLimit = await checkAdminRateLimit(context.user!.id, 'audit_summary', 20, 60);
      if (!rateLimit.allowed) {
        return NextResponse.json({
          error: 'Rate limit exceeded',
          resetAt: rateLimit.resetAt
        }, { status: 429 });
      }

      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get activity counts by time period
      const { data: activityCounts } = await supabase
        .from('admin_audit_log')
        .select('created_at, success, action_category')
        .gte('created_at', last30Days.toISOString());

      // Calculate statistics
      const stats = {
        totalActions: activityCounts?.length || 0,
        last24Hours: activityCounts?.filter(log => 
          new Date(log.created_at) >= last24Hours).length || 0,
        last7Days: activityCounts?.filter(log => 
          new Date(log.created_at) >= last7Days).length || 0,
        last30Days: activityCounts?.filter(log => 
          new Date(log.created_at) >= last30Days).length || 0,
        successfulActions: activityCounts?.filter(log => log.success).length || 0,
        failedActions: activityCounts?.filter(log => !log.success).length || 0
      };

      // Get top admins by activity
      const { data: topAdmins } = await supabase
        .from('admin_audit_log')
        .select(`
          admin_id,
          admin_users!inner (
            profiles!inner (
              display_name,
              email
            )
          )
        `)
        .gte('created_at', last7Days.toISOString());

      const adminActivity = topAdmins?.reduce((acc: any, log: any) => {
        const adminId = log.admin_id;
        if (!acc[adminId]) {
          acc[adminId] = {
            adminId,
            displayName: log.admin_users.profiles.display_name,
            email: log.admin_users.profiles.email,
            count: 0
          };
        }
        acc[adminId].count++;
        return acc;
      }, {});

      const topActiveAdmins = Object.values(adminActivity || {})
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 5);

      // Get activity by category
      const categoryStats = activityCounts?.reduce((acc: any, log: any) => {
        const category = log.action_category;
        if (!acc[category]) {
          acc[category] = { total: 0, successful: 0, failed: 0 };
        }
        acc[category].total++;
        if (log.success) {
          acc[category].successful++;
        } else {
          acc[category].failed++;
        }
        return acc;
      }, {});

      // Get recent security incidents
      const { data: securityIncidents } = await supabase
        .from('admin_security_incidents')
        .select(`
          id,
          incident_type,
          severity,
          title,
          occurred_at,
          status
        `)
        .gte('occurred_at', last7Days.toISOString())
        .order('occurred_at', { ascending: false })
        .limit(10);

      const response = {
        success: true,
        summary: {
          activity: stats,
          topAdmins: topActiveAdmins,
          categoryBreakdown: categoryStats || {},
          recentSecurityIncidents: securityIncidents || [],
          generatedAt: now.toISOString()
        }
      };

      // Log the summary access
      await logAdminAction(context, 'audit_summary_accessed', 'security', {
        success: true
      });

      return NextResponse.json(response);

    } catch (error) {
      console.error('Audit summary error:', error);
      
      await logAdminAction(context, 'audit_summary_failed', 'security', {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      return NextResponse.json({
        error: 'Failed to generate audit summary'
      }, { status: 500 });
    }
  }, {
    requiredPermissions: ['admin_audit:read']
  })(request);
}
*/

// POST /api/admin/audit/export - Export audit logs
export const POST = requireAdminAuth(async (request, context) => {
  const supabase = createClient();
  
  // Check permissions - exports require higher privileges
  const permissions = new AdminPermissionChecker(context);
  if (!permissions.hasPermission('admin_audit:export') && !permissions.hasAdminLevel('platform_admin')) {
    return NextResponse.json({
      error: 'Insufficient permissions to export audit logs'
    }, { status: 403 });
  }

  try {
    // Rate limiting for exports (more restrictive)
    const rateLimit = await checkAdminRateLimit(context.user!.id, 'export_audit_logs', 5, 60);
    if (!rateLimit.allowed) {
      return NextResponse.json({
        error: 'Export rate limit exceeded',
        resetAt: rateLimit.resetAt
      }, { status: 429 });
    }

    const body = await request.json();
    const exportSchema = z.object({
      format: z.enum(['csv', 'json']).default('csv'),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      adminId: z.string().uuid().optional(),
      actionCategory: z.string().optional(),
      includePersonalData: z.boolean().default(false)
    });

    const { format, startDate, endDate, adminId, actionCategory, includePersonalData } = exportSchema.parse(body);

    // Additional permission check for personal data
    if (includePersonalData && !permissions.hasAdminLevel('super_admin')) {
      return NextResponse.json({
        error: 'Only super admins can export personal data'
      }, { status: 403 });
    }

    // Build export query
    let query = supabase
      .from('admin_audit_log')
      .select(`
        id,
        action,
        action_category,
        resource_type,
        resource_id,
        success,
        created_at,
        admin_users!inner (
          admin_level,
          profiles!inner (
            ${includePersonalData ? 'display_name, email' : 'display_name'}
          )
        )
        ${includePersonalData ? ', ip_address, user_agent, old_values, new_values' : ''}
      `);

    // Apply filters
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);
    if (adminId) query = query.eq('admin_id', adminId);
    if (actionCategory) query = query.eq('action_category', actionCategory);

    // Limit export size
    const { data: auditLogs, error } = await query
      .order('created_at', { ascending: false })
      .limit(10000); // Maximum 10k records per export

    if (error) {
      throw error;
    }

    // Log the export request
    await logAdminAction(context, 'audit_logs_exported', 'security', {
      success: true,
      newValues: {
        format,
        recordCount: auditLogs.length,
        includePersonalData,
        filters: { startDate, endDate, adminId, actionCategory }
      }
    });

    // Return the data (in production, might want to stream large exports)
    return NextResponse.json({
      success: true,
      data: auditLogs,
      meta: {
        format,
        recordCount: auditLogs.length,
        exportedAt: new Date().toISOString(),
        exportedBy: context.user!.id
      }
    });

  } catch (error) {
    console.error('Audit export error:', error);
    
    await logAdminAction(context, 'audit_export_failed', 'security', {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid export parameters',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Failed to export audit logs'
    }, { status: 500 });
  }
}, {
  requiredPermissions: ['admin_audit:export'],
  requireFreshAuth: true,
  maxSessionAge: 30 // Require very fresh authentication for exports
});