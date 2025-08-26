/**
 * Business Context RBAC API
 * Epic 2 Story 2.8: Business-specific permission management
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { z } from 'zod'

const BusinessPermissionSchema = z.object({
  userId: z.string().uuid(),
  businessId: z.string().uuid(),
  businessRole: z.enum(['owner', 'manager', 'employee', 'contributor']),
  relationshipType: z.enum(['owner', 'co_owner', 'manager', 'employee', 'contractor', 'contributor']),
  permissionLevel: z.enum(['basic', 'advanced', 'admin', 'full']).default('basic'),
  effectiveUntil: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { userId, businessId, businessRole, relationshipType, permissionLevel } = BusinessPermissionSchema.parse(body)

    const { data: permissionId, error } = await supabase.rpc(
      'assign_business_permission',
      {
        p_user_id: userId,
        p_business_id: businessId,
        p_business_role: businessRole,
        p_relationship_type: relationshipType,
        p_permission_level: permissionLevel
      }
    )

    if (error) {
      return NextResponse.json(
        { error: 'Failed to assign business permission' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { permissionId }
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    let query = supabase
      .from('business_permissions')
      .select(`
        *,
        user:users(id, email),
        business:businesses(id, name)
      `)
      .eq('is_active', true)

    if (businessId) {
      query = query.eq('business_id', businessId)
    }

    const { data: permissions, error } = await query

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch business permissions' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { permissions }
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
