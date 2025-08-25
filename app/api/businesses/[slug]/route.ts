/**
 * Business Details API Route - GET /api/businesses/[slug]
 * The Lawless Directory - Single business endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { businessServerApi } from '../../../../lib/api/businesses'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    
    if (!slug) {
      return NextResponse.json(
        { error: 'Business slug is required' },
        { status: 400 }
      )
    }

    const business = await businessServerApi.getBusinessBySlug(slug)
    
    return NextResponse.json(business, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
      },
    })
  } catch (error) {
    console.error(`Error fetching business ${params.slug}:`, error)
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch business details',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}