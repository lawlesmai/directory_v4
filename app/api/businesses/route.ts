/**
 * Business API Route - GET /api/businesses
 * The Lawless Directory - Business listing endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { businessServerApi, BusinessSearchParams } from '../../../lib/api/businesses'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const params: BusinessSearchParams = {
      query: searchParams.get('query') || undefined,
      category: searchParams.get('category') || undefined,
      categoryId: searchParams.get('categoryId') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
      sortBy: (searchParams.get('sortBy') as any) || undefined,
      sortOrder: (searchParams.get('sortOrder') as any) || undefined,
    }

    // Parse location if provided
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')
    if (lat && lng) {
      params.location = {
        lat: parseFloat(lat),
        lng: parseFloat(lng)
      }
      params.radius = searchParams.get('radius') ? parseInt(searchParams.get('radius')!) : undefined
    }

    // Parse filters
    const filters: any = {}
    if (searchParams.get('rating')) {
      filters.rating = parseFloat(searchParams.get('rating')!)
    }
    if (searchParams.get('verifiedOnly') === 'true') {
      filters.verifiedOnly = true
    }
    if (searchParams.get('premiumOnly') === 'true') {
      filters.premiumOnly = true
    }
    if (Object.keys(filters).length > 0) {
      params.filters = filters
    }

    const result = await businessServerApi.getBusinesses(params)
    
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    })
  } catch (error) {
    console.error('Error fetching businesses:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch businesses',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}