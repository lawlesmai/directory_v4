/**
 * RBAC Permission Management API
 * Epic 2 Story 2.8: Enhanced Role-Based Access Control
 * 
 * Provides endpoints for managing user permissions, role assignments,
 * and permission evaluation with high performance and comprehensive audit logging.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { z } from 'zod'

// Request validation schemas
const PermissionEvaluationSchema = z.object({
  userId: z.string().uuid().optional(), // If not provided, uses current user
  permissions: z.array(z.string()).min(1).max(50), // Array of 'resource:action' strings
  context: z.record(z.any()).optional().default({})
})

const UserPermissionsSchema = z.object({
  userId: z.string().uuid().optional(),
  context: z.record(z.any()).optional().default({}),
  includeInherited: z.boolean().optional().default(true),
  includeBusinessPermissions: z.boolean().optional().default(true)
})

// Response types
interface PermissionResult {
  permission: string
  allowed: boolean
  reason: string
  source?: {
    type: 'role' | 'business' | 'direct'
    name: string
    inherited?: boolean
  }
}

interface UserPermission {
  resourceName: string
  actionName: string
  permissionName: string
  grantType: 'allow' | 'deny' | 'conditional'
  scopeType: string
  scopeConstraints: Record<string, any>
  isInherited: boolean
  sourceRole: string
}

/**
 * GET /api/rbac/permissions - Get user permissions or evaluate specific permissions
 */
export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now()
    const supabase = createRouteHandlerClient({ cookies })
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHENTICATED' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const requestType = searchParams.get('type') || 'user-permissions'
    
    if (requestType === 'user-permissions') {
      // Get all user permissions
      const userId = searchParams.get('userId') || user.id
      const context = searchParams.get('context') 
        ? JSON.parse(searchParams.get('context')!) 
        : {}
      const includeInherited = searchParams.get('includeInherited') !== 'false'
      const includeBusinessPermissions = searchParams.get('includeBusinessPermissions') !== 'false'

      // Check if user can view target user's permissions
      if (userId !== user.id) {
        const { data: canViewPermissions } = await supabase.rpc(
          'user_has_enhanced_permission',
          {
            p_user_id: user.id,
            p_resource: 'users',
            p_action: 'read',
            p_context: { target_user_id: userId }
          }
        )

        if (!canViewPermissions) {
          return NextResponse.json(
            { error: 'Insufficient permissions to view user permissions', code: 'FORBIDDEN' },
            { status: 403 }
          )
        }
      }

      // Get user permissions from database
      const { data: permissions, error: permissionsError } = await supabase.rpc(
        'evaluate_user_permissions',
        {
          p_user_id: userId,
          p_context: context
        }
      )

      if (permissionsError) {
        console.error('Error evaluating user permissions:', permissionsError)
        return NextResponse.json(
          { error: 'Failed to evaluate permissions', code: 'PERMISSION_EVALUATION_FAILED' },
          { status: 500 }
        )
      }

      // Filter permissions based on options
      let filteredPermissions = permissions as UserPermission[]
      
      if (!includeInherited) {
        filteredPermissions = filteredPermissions.filter(p => !p.isInherited)
      }

      if (!includeBusinessPermissions) {
        filteredPermissions = filteredPermissions.filter(p => p.scopeType !== 'business')
      }

      // Group permissions by resource for better organization
      const groupedPermissions = filteredPermissions.reduce((groups, permission) => {
        const resource = permission.resourceName
        if (!groups[resource]) {
          groups[resource] = []
        }
        groups[resource].push(permission)
        return groups
      }, {} as Record<string, UserPermission[]>)

      const processingTime = Date.now() - startTime

      return NextResponse.json({
        success: true,
        data: {
          userId,
          permissions: filteredPermissions,
          groupedPermissions,
          summary: {
            totalPermissions: filteredPermissions.length,
            resourceCount: Object.keys(groupedPermissions).length,
            inheritedCount: filteredPermissions.filter(p => p.isInherited).length,
            businessPermissionCount: filteredPermissions.filter(p => p.scopeType === 'business').length
          },
          metadata: {
            processingTime,
            context,
            includeInherited,
            includeBusinessPermissions
          }
        }
      })
    }
    
    return NextResponse.json(
      { error: 'Invalid request type', code: 'INVALID_REQUEST_TYPE' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error in permissions API:', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/rbac/permissions - Evaluate specific permissions
 */
export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now()
    const supabase = createRouteHandlerClient({ cookies })
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHENTICATED' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const { userId = user.id, permissions, context } = PermissionEvaluationSchema.parse(body)

    // Check if user can evaluate permissions for target user
    if (userId !== user.id) {
      const { data: canEvaluatePermissions } = await supabase.rpc(
        'user_has_enhanced_permission',
        {
          p_user_id: user.id,
          p_resource: 'users',
          p_action: 'read',
          p_context: { target_user_id: userId }
        }
      )

      if (!canEvaluatePermissions) {
        return NextResponse.json(
          { error: 'Insufficient permissions to evaluate permissions for this user', code: 'FORBIDDEN' },
          { status: 403 }
        )
      }
    }

    // Evaluate permissions using bulk evaluation function
    const { data: results, error: evaluationError } = await supabase.rpc(
      'evaluate_bulk_permissions',
      {
        p_user_id: userId,
        p_permissions: permissions,
        p_context: context
      }
    )

    if (evaluationError) {
      console.error('Error evaluating bulk permissions:', evaluationError)
      return NextResponse.json(
        { error: 'Failed to evaluate permissions', code: 'PERMISSION_EVALUATION_FAILED' },
        { status: 500 }
      )
    }

    // Transform results to include more detailed information
    const detailedResults: PermissionResult[] = results.map((result: any) => ({
      permission: result.permission,
      allowed: result.allowed,
      reason: result.reason,
      source: result.allowed ? {
        type: 'role', // This would be determined by the evaluation logic
        name: 'Determined by role assignment',
        inherited: false
      } : undefined
    }))

    const processingTime = Date.now() - startTime
    const allowedCount = detailedResults.filter(r => r.allowed).length
    const deniedCount = detailedResults.length - allowedCount

    // Log permission evaluation for audit purposes
    await supabase.from('auth_audit_logs').insert({
      event_type: 'bulk_permission_evaluation',
      event_category: 'permission',
      user_id: user.id,
      target_user_id: userId !== user.id ? userId : null,
      event_data: {
        permissions_evaluated: permissions,
        context,
        results_summary: {
          total: detailedResults.length,
          allowed: allowedCount,
          denied: deniedCount
        },
        processing_time_ms: processingTime
      },
      success: true
    })

    return NextResponse.json({
      success: true,
      data: {
        userId,
        results: detailedResults,
        summary: {
          total: detailedResults.length,
          allowed: allowedCount,
          denied: deniedCount,
          allowedPercentage: Math.round((allowedCount / detailedResults.length) * 100)
        },
        metadata: {
          processingTime,
          context,
          evaluatedAt: new Date().toISOString()
        }
      }
    })

  } catch (error) {
    console.error('Error in bulk permission evaluation:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request format', 
          code: 'VALIDATION_ERROR',
          details: error.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/rbac/permissions - Refresh permission cache
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHENTICATED' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { userId = user.id } = body

    // Check if user can refresh cache for target user
    if (userId !== user.id) {
      const { data: canRefreshCache } = await supabase.rpc(
        'user_has_enhanced_permission',
        {
          p_user_id: user.id,
          p_resource: 'users',
          p_action: 'manage',
          p_context: { target_user_id: userId }
        }
      )

      if (!canRefreshCache) {
        return NextResponse.json(
          { error: 'Insufficient permissions to refresh cache for this user', code: 'FORBIDDEN' },
          { status: 403 }
        )
      }
    }

    // Refresh permission cache
    const { data: refreshResult, error: refreshError } = await supabase.rpc(
      'refresh_user_permissions',
      { p_user_id: userId }
    )

    if (refreshError) {
      console.error('Error refreshing permission cache:', refreshError)
      return NextResponse.json(
        { error: 'Failed to refresh permission cache', code: 'CACHE_REFRESH_FAILED' },
        { status: 500 }
      )
    }

    // Log cache refresh
    await supabase.from('auth_audit_logs').insert({
      event_type: 'permission_cache_refreshed',
      event_category: 'permission',
      user_id: user.id,
      target_user_id: userId !== user.id ? userId : null,
      event_data: {
        refresh_successful: refreshResult,
        refreshed_at: new Date().toISOString()
      },
      success: true
    })

    return NextResponse.json({
      success: true,
      data: {
        userId,
        cacheRefreshed: refreshResult,
        refreshedAt: new Date().toISOString()
      },
      message: 'Permission cache refreshed successfully'
    })

  } catch (error) {
    console.error('Error refreshing permission cache:', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
