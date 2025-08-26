/**
 * Business Interactions API Route - POST /api/businesses/interactions
 * The Lawless Directory - Track business interactions
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { businessId, action, metadata } = body
    
    if (!businessId || !action) {
      return NextResponse.json(
        { error: 'Business ID and action are required' },
        { status: 400 }
      )
    }
    
    if (!['view', 'click', 'save', 'share'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action type' },
        { status: 400 }
      )
    }

    const supabase = createClient()
    
    // Update the business interaction counters
    const updateField = `${action}_count`
    const { error: updateError } = await (supabase as any)
      .from('businesses')
      .update({ 
        [updateField]: (supabase as any).rpc('increment_counter', { amount: 1 }),
        last_activity_at: new Date().toISOString()
      })
      .eq('id', businessId)

    if (updateError) {
      console.error('Error updating business interaction:', updateError)
      return NextResponse.json(
        { error: 'Failed to track interaction' },
        { status: 500 }
      )
    }
    
    // Optionally log detailed analytics (could be moved to a separate analytics table)
    if (metadata) {
      // This could be expanded to log to a separate analytics table
      console.log('Business interaction tracked:', {
        businessId,
        action,
        metadata,
        timestamp: new Date().toISOString()
      })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error tracking business interaction:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to track interaction',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}