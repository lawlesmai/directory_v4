import { PostgrestFilterBuilder } from '@supabase/postgrest-js';

declare module '@supabase/supabase-js' {
  interface SupabaseClient {
    from<T extends string>(table: T): {
      select: (...args: any[]) => PostgrestFilterBuilder<any, any, any>;
      insert: (values: any[], options?: any) => PostgrestFilterBuilder<any, any, any>;
      update: (values: any, options?: any) => PostgrestFilterBuilder<any, any, any>;
      upsert: (values: any, options?: any) => PostgrestFilterBuilder<any, any, any>;
      delete: () => PostgrestFilterBuilder<any, any, any>;
      eq: (column: string, value: any) => PostgrestFilterBuilder<any, any, any>;
      gte: (column: string, value: any) => PostgrestFilterBuilder<any, any, any>;
    };
  }
}

export type PostgrestSuccessResponse<T> = {
  data: T | null;
  error: null;
} | {
  data: null;
  error: { message: string };
};

export type Permission = 
  | 'read:businesses'
  | 'write:businesses'
  | 'manage:users'
  | 'moderate:content'
  | 'read:profile'
  | 'write:profile'
  | 'manage:system';
