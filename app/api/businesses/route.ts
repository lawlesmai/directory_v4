/**
 * Business API Route - GET /api/businesses
 * The Lawless Directory - Business listing endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { businessServerApi, BusinessSearchParams } from '../../../lib/api/businesses'
import { sanitizeInput, isValidEmail } from '../../../lib/security'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse and sanitize query parameters
    const rawQuery = searchParams.get('query')
    const rawCategory = searchParams.get('category')
    const rawCategoryId = searchParams.get('categoryId')
    const rawLimit = searchParams.get('limit')
    const rawOffset = searchParams.get('offset')
    const rawSortBy = searchParams.get('sortBy')
    const rawSortOrder = searchParams.get('sortOrder')
    
    // Validate and sanitize inputs
    const params: BusinessSearchParams = {
      query: rawQuery ? sanitizeInput(rawQuery) : undefined,
      category: rawCategory ? sanitizeInput(rawCategory) : rawCategoryId ? sanitizeInput(rawCategoryId) : undefined,
      limit: rawLimit ? Math.min(Math.max(parseInt(rawLimit), 1), 100) : undefined, // Limit between 1-100
      offset: rawOffset ? Math.max(parseInt(rawOffset), 0) : undefined, // Non-negative offset
      sortBy: rawSortBy ? sanitizeInput(rawSortBy) as any : undefined,
      sortOrder: rawSortOrder && ['asc', 'desc'].includes(rawSortOrder) ? rawSortOrder as any : undefined,
    }

    // Parse and validate location if provided
    const rawLat = searchParams.get('lat')
    const rawLng = searchParams.get('lng')
    const rawRadius = searchParams.get('radius')
    
    if (rawLat && rawLng) {
      const lat = parseFloat(rawLat)
      const lng = parseFloat(rawLng)
      
      // Validate coordinate ranges
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        params.location = { lat, lng }
        
        if (rawRadius) {
          const radius = parseInt(rawRadius)
          // Limit radius to reasonable range (1km - 100km)
          params.radius = Math.min(Math.max(radius, 1), 100)
        }
      }
    }

    // Parse and validate filters
    const filters: any = {}
    const rawRating = searchParams.get('rating')
    
    if (rawRating) {
      const rating = parseFloat(rawRating)
      // Validate rating range (1-5)
      if (rating >= 1 && rating <= 5) {
        filters.rating = rating
      }
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