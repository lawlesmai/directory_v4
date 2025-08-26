/**
 * RBAC Role Management API
 * Epic 2 Story 2.8: Enhanced Role-Based Access Control
 * 
 * Provides endpoints for managing roles, role assignments, and role hierarchy
 * with comprehensive audit logging and approval workflows.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { z } from 'zod'

// Request validation schemas
const RoleAssignmentSchema = z.object({
  targetUserId: z.string().uuid(),
  roleName: z.string().min(1).max(50),
  scopeType: z.string().optional().default('global'),
  scopeConstraints: z.record(z.any()).optional().default({}),
  justification: z.string().optional(),
  expiresIn: z.string().optional(), // ISO 8601 duration or specific date
  requiresApproval: z.boolean().optional().default(false)
})

const RoleCreationSchema = z.object({
  name: z.string().min(1).max(50),
  displayName: z.string().min(1).max(100),
  description: z.string().optional(),
  parentRole: z.string().optional(),
  permissions: z.array(z.string()).optional().default([]),
  isAssignable: z.boolean().optional().default(true),
  requiresMfa: z.boolean().optional().default(false)
})

const RoleUpdateSchema = z.object({
  displayName: z.string().optional(),
  description: z.string().optional(),
  isAssignable: z.boolean().optional(),
  requiresMfa: z.boolean().optional()
})

/**
 * GET /api/rbac/roles - Get roles with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHENTICATED' },
        { status: 401 }
      )
    }

    // Check permissions
    const { data: canViewRoles } = await supabase.rpc(
      'user_has_enhanced_permission',
      {
        p_user_id: user.id,
        p_resource: 'roles',
        p_action: 'read'
      }
    )

    if (!canViewRoles) {
      return NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const includePermissions = searchParams.get('includePermissions') === 'true'
    
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('*')
      .order('hierarchy_level')

    if (rolesError) {
      return NextResponse.json(
        { error: 'Failed to fetch roles', code: 'ROLES_FETCH_FAILED' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { roles }
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/rbac/roles - Assign role to user
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHENTICATED' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { targetUserId, roleName, scopeType, scopeConstraints } = RoleAssignmentSchema.parse(body)

    // Check permissions
    const { data: canAssignRoles } = await supabase.rpc(
      'user_has_enhanced_permission',
      {
        p_user_id: user.id,
        p_resource: 'users',
        p_action: 'manage'
      }
    )

    if (!canAssignRoles) {
      return NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    // Assign role
    const { data: assignmentResult, error: assignmentError } = await supabase.rpc(
      'assign_enhanced_role',
      {
        p_target_user_id: targetUserId,
        p_role_name: roleName,
        p_scope_type: scopeType,
        p_scope_constraints: scopeConstraints
      }
    )

    if (assignmentError) {
      return NextResponse.json(
        { error: 'Failed to assign role', code: 'ROLE_ASSIGNMENT_FAILED' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { assignmentId: assignmentResult },
      message: 'Role assigned successfully'
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
