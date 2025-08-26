/**
 * RBAC Performance Monitoring API
 * Epic 2 Story 2.8: Performance monitoring and optimization for RBAC system
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

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

    // Check admin permissions
    const { data: canViewMetrics } = await supabase.rpc(
      'user_has_enhanced_permission',
      {
        p_user_id: user.id,
        p_resource: 'system',
        p_action: 'monitor'
      }
    )

    if (!canViewMetrics) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get performance metrics
    const { data: metrics, error: metricsError } = await supabase.rpc(
      'get_rbac_performance_metrics'
    )

    if (metricsError) {
      return NextResponse.json(
        { error: 'Failed to fetch performance metrics' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        metrics: metrics || [],
        retrievedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
