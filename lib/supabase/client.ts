/**
 * Supabase Client Configuration
 * The Lawless Directory - Database Client Setup
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

// Create a Supabase client for use in the browser
export const createClient = () => {
  // Only check environment variables at runtime to avoid server-side issues
  if (typeof window === 'undefined') {
    // Return null during SSR - we'll handle this in the API layer
    return null
  }
  
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  // Validate environment variables
  if (!SUPABASE_URL || 
      !SUPABASE_ANON_KEY || 
      SUPABASE_URL === 'your-project-url-here' ||
      SUPABASE_ANON_KEY === 'your-anon-key-here' ||
      !SUPABASE_URL.startsWith('http')) {
    console.warn('Supabase environment variables not configured. Using fallback mode.')
    return null
  }
  
  return createBrowserClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  )
}

// Default client instance (can be null if not configured)
export const supabase = createClient()

// Export configuration status for other modules to check
export const isSupabaseReady = () => {
  if (typeof window === 'undefined') return false
  
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  return SUPABASE_URL && 
         SUPABASE_ANON_KEY && 
         SUPABASE_URL !== 'your-project-url-here' &&
         SUPABASE_ANON_KEY !== 'your-anon-key-here' &&
         SUPABASE_URL.startsWith('http')
}