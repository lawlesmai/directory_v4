import { createClient } from '@supabase/supabase-js';

export const createMockSupabaseClient = async () => {
  // Mock Supabase client creation with environment-specific configuration
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      auth: {
        persistSession: true
      }
    }
  );
};
