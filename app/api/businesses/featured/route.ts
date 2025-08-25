/**
 * Featured Businesses API Route - GET /api/businesses/featured
 * The Lawless Directory - Featured/premium business endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { businessServerApi } from '../../../../lib/api/businesses'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10
    
    const businesses = await businessServerApi.getFeaturedBusinesses(limit)
    
    return NextResponse.json(businesses, {
      headers: {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
      },
    })
  } catch (error) {
    console.error('Error fetching featured businesses:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch featured businesses',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}