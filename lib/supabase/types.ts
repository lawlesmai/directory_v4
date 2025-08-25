export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      businesses: {
        Row: BusinessRow
        Insert: BusinessInsert
        Update: BusinessUpdate
        Relationships: [
          {
            foreignKeyName: "businesses_primary_category_id_fkey"
            columns: ["primary_category_id"]
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "businesses_owner_id_fkey"
            columns: ["owner_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      categories: {
        Row: CategoryRow
        Insert: CategoryInsert
        Update: CategoryUpdate
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
      business_reviews: {
        Row: BusinessReviewRow
        Insert: BusinessReviewInsert
        Update: BusinessReviewUpdate
        Relationships: [
          {
            foreignKeyName: "business_reviews_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Business types
export interface BusinessRow {
  id: string
  slug: string
  name: string
  legal_name: string | null
  description: string | null
  short_description: string | null
  
  // Category hierarchy
  primary_category_id: string | null
  secondary_categories: string[]
  tags: string[]
  
  // Contact information
  phone: string | null
  phone_verified: boolean
  email: string | null
  email_verified: boolean
  website: string | null
  
  // Location data
  address_line_1: string | null
  address_line_2: string | null
  city: string
  state: string
  zip_code: string | null
  country: string
  location: unknown | null // PostGIS geography type
  service_area_radius_miles: number | null
  
  // Business details
  business_hours: Json
  special_hours: Json
  year_established: number | null
  employee_count: string | null
  annual_revenue: string | null
  
  // Media and branding
  logo_url: string | null
  cover_image_url: string | null
  gallery: Json
  video_urls: Json
  brand_colors: Json
  
  // Social and external platforms
  social_media: Json
  external_platforms: Json
  
  // Verification and quality
  verification_status: string
  verification_date: string | null
  verification_documents: Json
  trust_signals: Json
  quality_score: number
  
  // Subscription and features
  subscription_tier: string
  subscription_valid_until: string | null
  premium_features: Json
  featured_until: string | null
  boost_credits: number
  
  // Analytics and metrics
  view_count: number
  click_count: number
  save_count: number
  share_count: number
  last_activity_at: string
  
  // SEO and content
  meta_title: string | null
  meta_description: string | null
  meta_keywords: string[]
  custom_attributes: Json
  
  // Status and lifecycle
  status: string
  published_at: string | null
  suspended_at: string | null
  suspension_reason: string | null
  deleted_at: string | null
  
  // Ownership
  owner_id: string | null
  claimed_at: string | null
  claim_token: string | null
  transfer_token: string | null
  
  // Timestamps
  created_at: string
  updated_at: string
}

export type BusinessInsert = Omit<BusinessRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  created_at?: string
  updated_at?: string
}

export type BusinessUpdate = Partial<BusinessInsert>

// Category types
export interface CategoryRow {
  id: string
  parent_id: string | null
  slug: string
  name: string
  description: string | null
  icon: string | null
  image_url: string | null
  color: string | null
  
  // Hierarchy helpers
  level: number
  path: string[]
  children_count: number
  business_count: number
  
  // Display settings
  sort_order: number
  featured: boolean
  show_in_navigation: boolean
  show_in_directory: boolean
  
  // SEO
  meta_title: string | null
  meta_description: string | null
  
  // Status
  active: boolean
  created_at: string
  updated_at: string
}

export type CategoryInsert = Omit<CategoryRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  created_at?: string
  updated_at?: string
}

export type CategoryUpdate = Partial<CategoryInsert>

// Business Review types
export interface BusinessReviewRow {
  id: string
  business_id: string
  reviewer_id: string | null
  
  // Review content
  rating: number
  title: string | null
  content: string
  
  // Review metadata
  visit_date: string | null
  verification_type: string | null
  verification_data: Json | null
  
  // Media
  photos: Json
  videos: Json
  
  // Engagement metrics
  helpful_count: number
  not_helpful_count: number
  response_id: string | null
  
  // Moderation
  status: string
  moderation_notes: string | null
  flagged_count: number
  flag_reasons: Json
  
  // ML/AI features
  sentiment_score: number | null
  topics: string[]
  language: string
  
  created_at: string
  updated_at: string
  published_at: string | null
  edited_at: string | null
  deleted_at: string | null
}

export type BusinessReviewInsert = Omit<BusinessReviewRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  created_at?: string
  updated_at?: string
}

export type BusinessReviewUpdate = Partial<BusinessReviewInsert>

// Utility types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']  
export type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']