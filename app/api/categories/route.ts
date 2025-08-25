/**
 * Categories API Route - GET /api/categories
 * The Lawless Directory - Business categories endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { businessServerApi } from '../../../lib/api/businesses'

export async function GET(request: NextRequest) {
  try {
    const categories = await businessServerApi.getBusinessCategories()
    
    return NextResponse.json(categories, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
      },
    })
  } catch (error) {
    console.error('Error fetching categories:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch categories',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}