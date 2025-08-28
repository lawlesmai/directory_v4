import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAuth, AdminPermissionChecker, logAdminAction, checkAdminRateLimit } from '@/lib/auth/admin-middleware';
import { z } from 'zod';

const ipAccessRuleSchema = z.object({
  ipAddress: z.string().ip().optional(),
  ipRange: z.string().optional(), // CIDR notation
  accessType: z.enum(['whitelist', 'blacklist', 'monitor']).default('whitelist'),
  appliesTo: z.enum(['global', 'admin_level', 'specific_admin']).default('global'),
  targetAdminLevel: z.enum(['super_admin', 'platform_admin', 'support_admin', 'content_moderator']).optional(),
  targetAdminId: z.string().uuid().optional(),
  countryCodes: z.array(z.string().length(2)).optional(),
  regions: z.array(z.string()).optional(),
  description: z.string().max(500),
  expiresAt: z.string().datetime().optional()
}).refine(data => {
  // Must have either IP address or IP range
  return data.ipAddress || data.ipRange;
}, {
  message: "Either ipAddress or ipRange must be provided"
}).refine(data => {
  // Cannot have both IP address and IP range
  return !(data.ipAddress && data.ipRange);
}, {
  message: "Cannot specify both ipAddress and ipRange"
}).refine(data => {
  // If appliesTo is admin_level, must have targetAdminLevel
  return data.appliesTo !== 'admin_level' || data.targetAdminLevel;
}, {
  message: "targetAdminLevel required when appliesTo is 'admin_level'"
}).refine(data => {
  // If appliesTo is specific_admin, must have targetAdminId
  return data.appliesTo !== 'specific_admin' || data.targetAdminId;
}, {
  message: "targetAdminId required when appliesTo is 'specific_admin'"
});

const updateIpAccessRuleSchema = z.object({
  ipAddress: z.string().ip().optional(),
  ipRange: z.string().optional(),
  accessType: z.enum(['whitelist', 'blacklist', 'monitor']).optional(),
  appliesTo: z.enum(['global', 'admin_level', 'specific_admin']).optional(),
  targetAdminLevel: z.enum(['super_admin', 'platform_admin', 'support_admin', 'content_moderator']).optional(),
  targetAdminId: z.string().uuid().optional(),
  countryCodes: z.array(z.string().length(2)).optional(),
  regions: z.array(z.string()).optional(),
  description: z.string().max(500).optional(),
  expiresAt: z.string().datetime().optional(),
  isActive: z.boolean().optional()
});

// Utility function to validate IP range format
function validateCIDR(cidr: string): boolean {
  const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
  if (!cidrRegex.test(cidr)) return false;
  
  const [ip, mask] = cidr.split('/');
  const maskNum = parseInt(mask);
  
  if (maskNum < 0 || maskNum > 32) return false;
  
  const ipParts = ip.split('.').map(Number);
  return ipParts.every(part => part >= 0 && part <= 255);
}

// GET /api/admin/security/ip-access - List IP access rules
export const GET = requireAdminAuth(async (request, context) => {
  const supabase = createClient();
  const url = new URL(request.url);
  
  // Check permissions
  const permissions = new AdminPermissionChecker(context);
  if (!permissions.hasPermission('admin_security:read')) {
    return NextResponse.json({
      error: 'Insufficient permissions to view IP access rules'
    }, { status: 403 });
  }

  try {
    // Rate limiting check
    const rateLimit = await checkAdminRateLimit(context.user!.id, 'list_ip_rules', 100, 60);
    if (!rateLimit.allowed) {
      return NextResponse.json({
        error: 'Rate limit exceeded',
        resetAt: rateLimit.resetAt
      }, { status: 429 });
    }

    // Parse query parameters
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;
    
    const accessType = url.searchParams.get('accessType');
    const appliesTo = url.searchParams.get('appliesTo');
    const isActive = url.searchParams.get('isActive');
    
    // Build query
    let query = supabase
      .from('admin_ip_access')
      .select(`
        id,
        ip_address,
        ip_range,
        access_type,
        applies_to,
        target_admin_level,
        target_admin_id,
        country_codes,
        regions,
        description,
        is_active,
        created_at,
        updated_at,
        expires_at,
        created_by,
        profiles!admin_ip_access_created_by_fkey (
          display_name,
          email
        )
      `);

    // Apply filters
    if (accessType) {
      query = query.eq('access_type', accessType);
    }
    if (appliesTo) {
      query = query.eq('applies_to', appliesTo);
    }
    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }

    // Get total count
    const { count } = await supabase
      .from('admin_ip_access')
      .select('*', { count: 'exact', head: true });

    // Get paginated results
    const { data: ipRules, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    // Get target admin info for specific admin rules
    const adminIds = ipRules
      .filter((rule: any) => rule.target_admin_id)
      .map((rule: any) => rule.target_admin_id);

    let adminData: Record<string, any> = {};
    if (adminIds.length > 0) {
      const { data: admins } = await supabase
        .from('admin_users')
        .select(`
          id,
          profiles!inner (
            display_name,
            email
          )
        `)
        .in('id', adminIds);

      adminData = admins?.reduce((acc: any, admin: any) => {
        acc[admin.id] = admin.profiles;
        return acc;
      }, {}) || {};
    }

    // Format response data
    const formattedRules = ipRules.map((rule: any) => ({
      ...rule,
      targetAdmin: rule.target_admin_id ? adminData[rule.target_admin_id] : null,
      createdBy: rule.profiles
    }));

    // Log the access
    await logAdminAction(context, 'ip_access_rules_listed', 'security', {
      success: true,
      newValues: {
        filters: { accessType, appliesTo, isActive },
        resultCount: ipRules.length
      }
    });

    return NextResponse.json({
      success: true,
      data: formattedRules,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('List IP access rules error:', error);
    
    await logAdminAction(context, 'ip_access_rules_list_failed', 'security', {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json({
      error: 'Failed to retrieve IP access rules'
    }, { status: 500 });
  }
}, {
  requiredPermissions: ['admin_security:read']
});

// POST /api/admin/security/ip-access - Create IP access rule
export const POST = requireAdminAuth(async (request, context) => {
  const supabase = createClient();
  
  // Check permissions
  const permissions = new AdminPermissionChecker(context);
  if (!permissions.hasPermission('admin_security:configure')) {
    return NextResponse.json({
      error: 'Insufficient permissions to create IP access rules'
    }, { status: 403 });
  }

  try {
    // Rate limiting check
    const rateLimit = await checkAdminRateLimit(context.user!.id, 'create_ip_rule', 20, 60);
    if (!rateLimit.allowed) {
      return NextResponse.json({
        error: 'Rate limit exceeded',
        resetAt: rateLimit.resetAt
      }, { status: 429 });
    }

    const body = await request.json();
    const validatedData = ipAccessRuleSchema.parse(body);

    // Additional validation for CIDR ranges
    if (validatedData.ipRange && !validateCIDR(validatedData.ipRange)) {
      return NextResponse.json({
        error: 'Invalid CIDR range format'
      }, { status: 400 });
    }

    // Check if target admin exists (for specific admin rules)
    if (validatedData.targetAdminId) {
      const { data: targetAdmin, error: adminError } = await supabase
        .from('admin_users')
        .select('id')
        .eq('id', validatedData.targetAdminId)
        .single();

      if (adminError || !targetAdmin) {
        return NextResponse.json({
          error: 'Target admin user not found'
        }, { status: 404 });
      }
    }

    // Check for conflicts with existing rules
    let conflictQuery = supabase
      .from('admin_ip_access')
      .select('id, access_type, applies_to')
      .eq('is_active', true);

    if (validatedData.ipAddress) {
      conflictQuery = conflictQuery.eq('ip_address', validatedData.ipAddress);
    } else {
      conflictQuery = conflictQuery.eq('ip_range', validatedData.ipRange);
    }

    const { data: conflicts, error: conflictError } = await conflictQuery;

    if (conflictError) {
      throw conflictError;
    }

    // Check for problematic conflicts
    const hasConflicts = conflicts?.some((rule: any) => 
      rule.access_type !== validatedData.accessType ||
      rule.applies_to !== validatedData.appliesTo
    );

    if (hasConflicts) {
      return NextResponse.json({
        error: 'Conflicting IP access rule exists',
        conflicts: conflicts
      }, { status: 409 });
    }

    // Create the IP access rule
    const { data: newRule, error: createError } = await supabase
      .from('admin_ip_access')
      .insert([{
        ip_address: validatedData.ipAddress,
        ip_range: validatedData.ipRange,
        access_type: validatedData.accessType,
        applies_to: validatedData.appliesTo,
        target_admin_level: validatedData.targetAdminLevel,
        target_admin_id: validatedData.targetAdminId,
        country_codes: validatedData.countryCodes,
        regions: validatedData.regions,
        description: validatedData.description,
        created_by: context.user!.id,
        expires_at: validatedData.expiresAt,
        is_active: true
      }])
      .select(`
        *,
        profiles!admin_ip_access_created_by_fkey (
          display_name,
          email
        )
      `)
      .single();

    if (createError) {
      throw createError;
    }

    // Log the creation
    await logAdminAction(context, 'ip_access_rule_created', 'security', {
      resourceType: 'ip_access_rule',
      resourceId: newRule.id,
      success: true,
      newValues: {
        ipAddress: validatedData.ipAddress,
        ipRange: validatedData.ipRange,
        accessType: validatedData.accessType,
        appliesTo: validatedData.appliesTo,
        description: validatedData.description
      }
    });

    return NextResponse.json({
      success: true,
      data: newRule,
      message: 'IP access rule created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Create IP access rule error:', error);
    
    await logAdminAction(context, 'ip_access_rule_creation_failed', 'security', {
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
      error: 'Failed to create IP access rule'
    }, { status: 500 });
  }
}, {
  requiredPermissions: ['admin_security:configure'],
  requireFreshAuth: true,
  maxSessionAge: 60
});

// PUT /api/admin/security/ip-access - Update IP access rule
export const PUT = requireAdminAuth(async (request, context) => {
  const supabase = createClient();
  const url = new URL(request.url);
  const ruleId = url.searchParams.get('id');
  
  if (!ruleId) {
    return NextResponse.json({
      error: 'Rule ID is required'
    }, { status: 400 });
  }

  // Check permissions
  const permissions = new AdminPermissionChecker(context);
  if (!permissions.hasPermission('admin_security:configure')) {
    return NextResponse.json({
      error: 'Insufficient permissions to update IP access rules'
    }, { status: 403 });
  }

  try {
    // Rate limiting check
    const rateLimit = await checkAdminRateLimit(context.user!.id, 'update_ip_rule', 50, 60);
    if (!rateLimit.allowed) {
      return NextResponse.json({
        error: 'Rate limit exceeded',
        resetAt: rateLimit.resetAt
      }, { status: 429 });
    }

    const body = await request.json();
    const validatedData = updateIpAccessRuleSchema.parse(body);

    // Get existing rule
    const { data: existingRule, error: fetchError } = await supabase
      .from('admin_ip_access')
      .select('*')
      .eq('id', ruleId)
      .single();

    if (fetchError || !existingRule) {
      return NextResponse.json({
        error: 'IP access rule not found'
      }, { status: 404 });
    }

    // Validate CIDR if updating range
    if (validatedData.ipRange && !validateCIDR(validatedData.ipRange)) {
      return NextResponse.json({
        error: 'Invalid CIDR range format'
      }, { status: 400 });
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    // Only update provided fields
    Object.keys(validatedData).forEach(key => {
      const value = (validatedData as any)[key];
      if (value !== undefined) {
        // Map field names to database columns
        const fieldMap: { [key: string]: string } = {
          ipAddress: 'ip_address',
          ipRange: 'ip_range',
          accessType: 'access_type',
          appliesTo: 'applies_to',
          targetAdminLevel: 'target_admin_level',
          targetAdminId: 'target_admin_id',
          countryCodes: 'country_codes',
          isActive: 'is_active',
          expiresAt: 'expires_at'
        };
        
        const dbField = fieldMap[key] || key;
        updateData[dbField] = value;
      }
    });

    // Update the rule
    const { data: updatedRule, error: updateError } = await supabase
      .from('admin_ip_access')
      .update(updateData)
      .eq('id', ruleId)
      .select(`
        *,
        profiles!admin_ip_access_created_by_fkey (
          display_name,
          email
        )
      `)
      .single();

    if (updateError) {
      throw updateError;
    }

    // Log the update
    await logAdminAction(context, 'ip_access_rule_updated', 'security', {
      resourceType: 'ip_access_rule',
      resourceId: ruleId,
      success: true,
      oldValues: existingRule,
      newValues: updateData
    });

    return NextResponse.json({
      success: true,
      data: updatedRule,
      message: 'IP access rule updated successfully'
    });

  } catch (error) {
    console.error('Update IP access rule error:', error);
    
    await logAdminAction(context, 'ip_access_rule_update_failed', 'security', {
      resourceType: 'ip_access_rule',
      resourceId: ruleId,
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
      error: 'Failed to update IP access rule'
    }, { status: 500 });
  }
}, {
  requiredPermissions: ['admin_security:configure'],
  requireFreshAuth: true,
  maxSessionAge: 60
});

// DELETE /api/admin/security/ip-access - Delete IP access rule
export const DELETE = requireAdminAuth(async (request, context) => {
  const supabase = createClient();
  const url = new URL(request.url);
  const ruleId = url.searchParams.get('id');
  
  if (!ruleId) {
    return NextResponse.json({
      error: 'Rule ID is required'
    }, { status: 400 });
  }

  // Check permissions
  const permissions = new AdminPermissionChecker(context);
  if (!permissions.hasPermission('admin_security:configure') || 
      !permissions.hasAdminLevel('platform_admin')) {
    return NextResponse.json({
      error: 'Insufficient permissions to delete IP access rules'
    }, { status: 403 });
  }

  try {
    // Rate limiting check
    const rateLimit = await checkAdminRateLimit(context.user!.id, 'delete_ip_rule', 20, 60);
    if (!rateLimit.allowed) {
      return NextResponse.json({
        error: 'Rate limit exceeded',
        resetAt: rateLimit.resetAt
      }, { status: 429 });
    }

    // Get existing rule
    const { data: existingRule, error: fetchError } = await supabase
      .from('admin_ip_access')
      .select('*')
      .eq('id', ruleId)
      .single();

    if (fetchError || !existingRule) {
      return NextResponse.json({
        error: 'IP access rule not found'
      }, { status: 404 });
    }

    // Soft delete by deactivating
    const { error: deleteError } = await supabase
      .from('admin_ip_access')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', ruleId);

    if (deleteError) {
      throw deleteError;
    }

    // Log the deletion
    await logAdminAction(context, 'ip_access_rule_deleted', 'security', {
      resourceType: 'ip_access_rule',
      resourceId: ruleId,
      success: true,
      oldValues: existingRule
    });

    return NextResponse.json({
      success: true,
      message: 'IP access rule deleted successfully'
    });

  } catch (error) {
    console.error('Delete IP access rule error:', error);
    
    await logAdminAction(context, 'ip_access_rule_deletion_failed', 'security', {
      resourceType: 'ip_access_rule',
      resourceId: ruleId,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json({
      error: 'Failed to delete IP access rule'
    }, { status: 500 });
  }
}, {
  requiredPermissions: ['admin_security:configure'],
  requireFreshAuth: true,
  maxSessionAge: 30
});