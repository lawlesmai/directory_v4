/**
 * CSRF Token API Endpoint
 * Provides CSRF tokens for client-side form submissions
 * Implements secure CSRF protection
 */

import { NextRequest } from 'next/server'
import { createCSRFTokenResponse } from '@/lib/security/csrf'

/**
 * GET /api/csrf - Get CSRF token
 * Returns a CSRF token for client-side use
 */
export async function GET(request: NextRequest) {
  try {
    return createCSRFTokenResponse()
  } catch (error) {
    console.error('CSRF token generation failed:', error)
    
    return new Response(
      JSON.stringify({ error: 'Failed to generate CSRF token' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

/**
 * Only allow GET requests
 */
export async function POST() {
  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}