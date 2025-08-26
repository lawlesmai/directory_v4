/**
 * Database Type Definitions
 * Generated from Supabase Schema
 * The Lawless Directory
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string
          slug: string
          name: string
          legal_name: string | null
          description: string | null
          short_description: string | null
          primary_category_id: string | null
          secondary_categories: string[] | null
          tags: string[] | null
          phone: string | null
          phone_verified: boolean
          email: string | null
          email_verified: boolean
          website: string | null
          address_line_1: string | null
          address_line_2: string | null
          city: string
          state: string
          zip_code: string | null
          country: string
          location: unknown | null
          service_area_radius_miles: number | null
          business_hours: Json
          special_hours: Json
          year_established: number | null
          employee_count: string | null
          annual_revenue: string | null
          logo_url: string | null
          cover_image_url: string | null
          gallery: Json
          video_urls: Json
          brand_colors: Json
          social_media: Json
          external_platforms: Json
          verification_status: string
          verification_date: string | null
          verification_documents: Json
          trust_signals: Json
          quality_score: number
          subscription_tier: string
          subscription_valid_until: string | null
          premium_features: Json
          featured_until: string | null
          boost_credits: number
          view_count: number
          click_count: number
          save_count: number
          share_count: number
          last_activity_at: string
          meta_title: string | null
          meta_description: string | null
          meta_keywords: string[] | null
          custom_attributes: Json
          status: string
          published_at: string | null
          suspended_at: string | null
          suspension_reason: string | null
          deleted_at: string | null
          owner_id: string | null
          claimed_at: string | null
          claim_token: string | null
          transfer_token: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          legal_name?: string | null
          description?: string | null
          short_description?: string | null
          primary_category_id?: string | null
          secondary_categories?: string[] | null
          tags?: string[] | null
          phone?: string | null
          phone_verified?: boolean
          email?: string | null
          email_verified?: boolean
          website?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          city: string
          state: string
          zip_code?: string | null
          country?: string
          location?: unknown | null
          service_area_radius_miles?: number | null
          business_hours?: Json
          special_hours?: Json
          year_established?: number | null
          employee_count?: string | null
          annual_revenue?: string | null
          logo_url?: string | null
          cover_image_url?: string | null
          gallery?: Json
          video_urls?: Json
          brand_colors?: Json
          social_media?: Json
          external_platforms?: Json
          verification_status?: string
          verification_date?: string | null
          verification_documents?: Json
          trust_signals?: Json
          quality_score?: number
          subscription_tier?: string
          subscription_valid_until?: string | null
          premium_features?: Json
          featured_until?: string | null
          boost_credits?: number
          view_count?: number
          click_count?: number
          save_count?: number
          share_count?: number
          last_activity_at?: string
          meta_title?: string | null
          meta_description?: string | null
          meta_keywords?: string[] | null
          custom_attributes?: Json
          status?: string
          published_at?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          deleted_at?: string | null
          owner_id?: string | null
          claimed_at?: string | null
          claim_token?: string | null
          transfer_token?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          legal_name?: string | null
          description?: string | null
          short_description?: string | null
          primary_category_id?: string | null
          secondary_categories?: string[] | null
          tags?: string[] | null
          phone?: string | null
          phone_verified?: boolean
          email?: string | null
          email_verified?: boolean
          website?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string
          state?: string
          zip_code?: string | null
          country?: string
          location?: unknown | null
          service_area_radius_miles?: number | null
          business_hours?: Json
          special_hours?: Json
          year_established?: number | null
          employee_count?: string | null
          annual_revenue?: string | null
          logo_url?: string | null
          cover_image_url?: string | null
          gallery?: Json
          video_urls?: Json
          brand_colors?: Json
          social_media?: Json
          external_platforms?: Json
          verification_status?: string
          verification_date?: string | null
          verification_documents?: Json
          trust_signals?: Json
          quality_score?: number
          subscription_tier?: string
          subscription_valid_until?: string | null
          premium_features?: Json
          featured_until?: string | null
          boost_credits?: number
          view_count?: number
          click_count?: number
          save_count?: number
          share_count?: number
          last_activity_at?: string
          meta_title?: string | null
          meta_description?: string | null
          meta_keywords?: string[] | null
          custom_attributes?: Json
          status?: string
          published_at?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          deleted_at?: string | null
          owner_id?: string | null
          claimed_at?: string | null
          claim_token?: string | null
          transfer_token?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          parent_id: string | null
          slug: string
          name: string
          description: string | null
          icon: string | null
          image_url: string | null
          color: string | null
          level: number
          path: string[] | null
          path_slugs: string[] | null
          children_count: number
          business_count: number
          sort_order: number
          featured: boolean
          show_in_navigation: boolean
          show_in_directory: boolean
          meta_title: string | null
          meta_description: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          parent_id?: string | null
          slug: string
          name: string
          description?: string | null
          icon?: string | null
          image_url?: string | null
          color?: string | null
          level?: number
          path?: string[] | null
          path_slugs?: string[] | null
          children_count?: number
          business_count?: number
          sort_order?: number
          featured?: boolean
          show_in_navigation?: boolean
          show_in_directory?: boolean
          meta_title?: string | null
          meta_description?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          parent_id?: string | null
          slug?: string
          name?: string
          description?: string | null
          icon?: string | null
          image_url?: string | null
          color?: string | null
          level?: number
          path?: string[] | null
          path_slugs?: string[] | null
          children_count?: number
          business_count?: number
          sort_order?: number
          featured?: boolean
          show_in_navigation?: boolean
          show_in_directory?: boolean
          meta_title?: string | null
          meta_description?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      business_reviews: {
        Row: {
          id: string
          business_id: string
          reviewer_id: string | null
          rating: number
          title: string | null
          content: string
          visit_date: string | null
          verification_type: string | null
          verification_data: Json | null
          photos: Json
          videos: Json
          helpful_count: number
          not_helpful_count: number
          status: string
          moderation_notes: string | null
          flagged_count: number
          flag_reasons: Json
          sentiment_score: number | null
          topics: string[] | null
          language: string
          created_at: string
          updated_at: string
          published_at: string | null
          edited_at: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          business_id: string
          reviewer_id?: string | null
          rating: number
          title?: string | null
          content: string
          visit_date?: string | null
          verification_type?: string | null
          verification_data?: Json | null
          photos?: Json
          videos?: Json
          helpful_count?: number
          not_helpful_count?: number
          status?: string
          moderation_notes?: string | null
          flagged_count?: number
          flag_reasons?: Json
          sentiment_score?: number | null
          topics?: string[] | null
          language?: string
          created_at?: string
          updated_at?: string
          published_at?: string | null
          edited_at?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          business_id?: string
          reviewer_id?: string | null
          rating?: number
          title?: string | null
          content?: string
          visit_date?: string | null
          verification_type?: string | null
          verification_data?: Json | null
          photos?: Json
          videos?: Json
          helpful_count?: number
          not_helpful_count?: number
          status?: string
          moderation_notes?: string | null
          flagged_count?: number
          flag_reasons?: Json
          sentiment_score?: number | null
          topics?: string[] | null
          language?: string
          created_at?: string
          updated_at?: string
          published_at?: string | null
          edited_at?: string | null
          deleted_at?: string | null
        }
      }
      business_review_responses: {
        Row: {
          id: string
          review_id: string
          business_id: string
          responder_id: string
          content: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          review_id: string
          business_id: string
          responder_id: string
          content: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          review_id?: string
          business_id?: string
          responder_id?: string
          content?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      business_managers: {
        Row: {
          id: string
          business_id: string
          user_id: string
          role: string
          permissions: Json
          invited_by: string | null
          invitation_accepted_at: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          user_id: string
          role?: string
          permissions?: Json
          invited_by?: string | null
          invitation_accepted_at?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          user_id?: string
          role?: string
          permissions?: Json
          invited_by?: string | null
          invitation_accepted_at?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: string
          permissions: Json
          granted_by: string | null
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role: string
          permissions?: Json
          granted_by?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: string
          permissions?: Json
          granted_by?: string | null
          expires_at?: string | null
          created_at?: string
        }
      }
      business_analytics: {
        Row: {
          id: string
          business_id: string
          date: string
          page_views: number
          unique_visitors: number
          avg_time_on_page: unknown | null
          bounce_rate: number | null
          phone_clicks: number
          website_clicks: number
          direction_clicks: number
          share_clicks: number
          save_clicks: number
          new_reviews: number
          avg_rating: number | null
          search_impressions: number
          search_clicks: number
          search_position: number | null
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          date: string
          page_views?: number
          unique_visitors?: number
          avg_time_on_page?: unknown | null
          bounce_rate?: number | null
          phone_clicks?: number
          website_clicks?: number
          direction_clicks?: number
          share_clicks?: number
          save_clicks?: number
          new_reviews?: number
          avg_rating?: number | null
          search_impressions?: number
          search_clicks?: number
          search_position?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          date?: string
          page_views?: number
          unique_visitors?: number
          avg_time_on_page?: unknown | null
          bounce_rate?: number | null
          phone_clicks?: number
          website_clicks?: number
          direction_clicks?: number
          share_clicks?: number
          save_clicks?: number
          new_reviews?: number
          avg_rating?: number | null
          search_impressions?: number
          search_clicks?: number
          search_position?: number | null
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          display_name: string | null
          username: string | null
          avatar_url: string | null
          bio: string | null
          first_name: string | null
          last_name: string | null
          date_of_birth: string | null
          phone_number: string | null
          phone_verified: boolean
          city: string | null
          state: string | null
          country: string | null
          timezone: string
          website: string | null
          social_links: Json
          preferences: Json
          marketing_consent: boolean
          data_processing_consent: boolean
          consent_timestamp: string | null
          email: string | null
          email_verified: boolean
          account_status: string
          suspension_reason: string | null
          suspension_date: string | null
          last_login_at: string | null
          last_login_ip: string | null
          failed_login_attempts: number
          locked_until: string | null
          metadata: Json
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id: string
          display_name?: string | null
          username?: string | null
          avatar_url?: string | null
          bio?: string | null
          first_name?: string | null
          last_name?: string | null
          date_of_birth?: string | null
          phone_number?: string | null
          phone_verified?: boolean
          city?: string | null
          state?: string | null
          country?: string | null
          timezone?: string
          website?: string | null
          social_links?: Json
          preferences?: Json
          marketing_consent?: boolean
          data_processing_consent?: boolean
          consent_timestamp?: string | null
          email?: string | null
          email_verified?: boolean
          account_status?: string
          suspension_reason?: string | null
          suspension_date?: string | null
          last_login_at?: string | null
          last_login_ip?: string | null
          failed_login_attempts?: number
          locked_until?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          display_name?: string | null
          username?: string | null
          avatar_url?: string | null
          bio?: string | null
          first_name?: string | null
          last_name?: string | null
          date_of_birth?: string | null
          phone_number?: string | null
          phone_verified?: boolean
          city?: string | null
          state?: string | null
          country?: string | null
          timezone?: string
          website?: string | null
          social_links?: Json
          preferences?: Json
          marketing_consent?: boolean
          data_processing_consent?: boolean
          consent_timestamp?: string | null
          email?: string | null
          email_verified?: boolean
          account_status?: string
          suspension_reason?: string | null
          suspension_date?: string | null
          last_login_at?: string | null
          last_login_ip?: string | null
          failed_login_attempts?: number
          locked_until?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      roles: {
        Row: {
          id: string
          name: string
          display_name: string
          description: string | null
          level: number
          parent_role_id: string | null
          permissions: Json
          is_system_role: boolean
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          display_name: string
          description?: string | null
          level?: number
          parent_role_id?: string | null
          permissions?: Json
          is_system_role?: boolean
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          display_name?: string
          description?: string | null
          level?: number
          parent_role_id?: string | null
          permissions?: Json
          is_system_role?: boolean
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      auth_audit_logs: {
        Row: {
          id: string
          event_type: string
          event_category: string
          user_id: string | null
          target_user_id: string | null
          session_id: string | null
          event_data: Json
          success: boolean
          failure_reason: string | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_type: string
          event_category: string
          user_id?: string | null
          target_user_id?: string | null
          session_id?: string | null
          event_data?: Json
          success: boolean
          failure_reason?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          event_type?: string
          event_category?: string
          user_id?: string | null
          target_user_id?: string | null
          session_id?: string | null
          event_data?: Json
          success?: boolean
          failure_reason?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
      gdpr_data_deletions: {
        Row: {
          id: string
          user_id: string | null
          deletion_type: string
          deletion_scope: string[] | null
          keep_anonymized: boolean
          legal_basis: string
          justification: string | null
          status: string
          processing_started_at: string | null
          processing_completed_at: string | null
          items_deleted: number
          items_anonymized: number
          deletion_log: Json | null
          requested_at: string
          requested_by: string | null
          processed_by: string | null
          review_required: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          deletion_type?: string
          deletion_scope?: string[] | null
          keep_anonymized?: boolean
          legal_basis: string
          justification?: string | null
          status?: string
          processing_started_at?: string | null
          processing_completed_at?: string | null
          items_deleted?: number
          items_anonymized?: number
          deletion_log?: Json | null
          requested_at?: string
          requested_by?: string | null
          processed_by?: string | null
          review_required?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          deletion_type?: string
          deletion_scope?: string[] | null
          keep_anonymized?: boolean
          legal_basis?: string
          justification?: string | null
          status?: string
          processing_started_at?: string | null
          processing_completed_at?: string | null
          items_deleted?: number
          items_anonymized?: number
          deletion_log?: Json | null
          requested_at?: string
          requested_by?: string | null
          processed_by?: string | null
          review_required?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      business_stats: {
        Row: {
          id: string
          slug: string
          name: string
          primary_category_id: string | null
          city: string
          state: string
          subscription_tier: string
          verification_status: string
          review_count: number
          avg_rating: number | null
          recent_review_count: number
          week_review_count: number
          median_rating: number | null
          last_review_date: string | null
          total_helpful_votes: number | null
          last_refreshed: string
        }
      }
      category_business_counts: {
        Row: {
          id: string
          slug: string
          name: string
          parent_id: string | null
          depth: number
          direct_business_count: number
          total_business_count: number
          verified_business_count: number
          premium_business_count: number
          category_avg_rating: number | null
          last_refreshed: string
        }
      }
    }
    Functions: {
      find_nearby_businesses: {
        Args: {
          user_location: unknown
          radius_meters?: number
          category_filter?: string
          limit_count?: number
          offset_count?: number
        }
        Returns: {
          id: string
          slug: string
          name: string
          description: string
          category_name: string
          address: string
          city: string
          state: string
          distance_meters: number
          bearing_degrees: number
          rating: number
          review_count: number
          is_premium: boolean
          is_verified: boolean
          logo_url: string
          business_hours: Json
        }[]
      }
      search_businesses: {
        Args: {
          search_query: string
          category_filter?: string
          location_filter?: unknown
          radius_meters?: number
          limit_count?: number
          offset_count?: number
        }
        Returns: {
          id: string
          slug: string
          name: string
          description: string
          category_name: string
          address: string
          city: string
          state: string
          relevance_score: number
          distance_meters: number
          rating: number
          review_count: number
          is_premium: boolean
          is_verified: boolean
          logo_url: string
        }[]
      }
      get_business_details: {
        Args: {
          business_slug: string
        }
        Returns: {
          business: Json
          reviews: Json
          stats: Json
        }[]
      }
      check_database_health: {
        Args: Record<PropertyKey, never>
        Returns: {
          check_name: string
          status: string
          details: string
          severity: string
          recommendation: string
        }[]
      }
      refresh_all_materialized_views: {
        Args: Record<PropertyKey, never>
        Returns: {
          view_name: string
          refresh_status: string
          duration: unknown
        }[]
      }
    }
    Enums: {
      business_status: 'draft' | 'pending' | 'active' | 'inactive' | 'suspended' | 'deleted'
      subscription_tier: 'free' | 'starter' | 'premium' | 'elite' | 'enterprise'
      verification_status: 'pending' | 'verified' | 'rejected' | 'expired'
      review_status: 'pending' | 'published' | 'rejected' | 'flagged' | 'deleted'
      user_role: 'user' | 'business_owner' | 'moderator' | 'admin' | 'super_admin'
    }
  }
}

// Helper types for better TypeScript support
export type Business = Database['public']['Tables']['businesses']['Row']
export type BusinessInsert = Database['public']['Tables']['businesses']['Insert']
export type BusinessUpdate = Database['public']['Tables']['businesses']['Update']

export type Category = Database['public']['Tables']['categories']['Row']
export type CategoryInsert = Database['public']['Tables']['categories']['Insert']
export type CategoryUpdate = Database['public']['Tables']['categories']['Update']

export type BusinessReview = Database['public']['Tables']['business_reviews']['Row']
export type BusinessReviewInsert = Database['public']['Tables']['business_reviews']['Insert']
export type BusinessReviewUpdate = Database['public']['Tables']['business_reviews']['Update']

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Role = Database['public']['Tables']['roles']['Row']
export type RoleInsert = Database['public']['Tables']['roles']['Insert']
export type RoleUpdate = Database['public']['Tables']['roles']['Update']

export type AuthAuditLog = Database['public']['Tables']['auth_audit_logs']['Row']
export type AuthAuditLogInsert = Database['public']['Tables']['auth_audit_logs']['Insert']
export type AuthAuditLogUpdate = Database['public']['Tables']['auth_audit_logs']['Update']

export type GdprDataDeletion = Database['public']['Tables']['gdpr_data_deletions']['Row']
export type GdprDataDeletionInsert = Database['public']['Tables']['gdpr_data_deletions']['Insert']
export type GdprDataDeletionUpdate = Database['public']['Tables']['gdpr_data_deletions']['Update']

export type BusinessStats = Database['public']['Views']['business_stats']['Row']
export type CategoryBusinessCounts = Database['public']['Views']['category_business_counts']['Row']

// Function return types
export type NearbyBusinessResult = Database['public']['Functions']['find_nearby_businesses']['Returns'][0]
export type SearchBusinessResult = Database['public']['Functions']['search_businesses']['Returns'][0]
export type BusinessDetailsResult = Database['public']['Functions']['get_business_details']['Returns'][0]
