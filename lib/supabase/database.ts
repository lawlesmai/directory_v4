import { supabase } from './client'
import { createClient } from './server'
import type { Database, Tables, Inserts, Updates } from './types'

// Type aliases for cleaner code
export type Business = Tables<'businesses'>
export type Category = Tables<'categories'>
export type BusinessReview = Tables<'business_reviews'>

export type BusinessInsert = Inserts<'businesses'>
export type CategoryInsert = Inserts<'categories'>
export type BusinessReviewInsert = Inserts<'business_reviews'>

export type BusinessUpdate = Updates<'businesses'>
export type CategoryUpdate = Updates<'categories'>  
export type BusinessReviewUpdate = Updates<'business_reviews'>

// Business service functions
export class BusinessService {
  // Get all active businesses with pagination
  static async getActiveBusinesses({
    limit = 20,
    offset = 0,
    categoryId,
    city,
    state,
    searchQuery,
  }: {
    limit?: number
    offset?: number
    categoryId?: string
    city?: string
    state?: string
    searchQuery?: string
  } = {}) {
    let query = supabase
      .from('businesses')
      .select(`
        *,
        categories:primary_category_id(id, name, slug, icon)
      `)
      .eq('status', 'active')
      .is('deleted_at', null)
      .not('published_at', 'is', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (categoryId) {
      query = query.eq('primary_category_id', categoryId)
    }

    if (city) {
      query = query.ilike('city', `%${city}%`)
    }

    if (state) {
      query = query.ilike('state', `%${state}%`)
    }

    if (searchQuery) {
      query = query.textSearch('name,description,short_description', searchQuery)
    }

    return query
  }

  // Get business by slug
  static async getBusinessBySlug(slug: string) {
    return supabase
      .from('businesses')
      .select(`
        *,
        categories:primary_category_id(id, name, slug, icon, color),
        business_reviews!inner(
          id, rating, title, content, created_at,
          reviewer:auth.users(id, email)
        )
      `)
      .eq('slug', slug)
      .eq('status', 'active')
      .is('deleted_at', null)
      .eq('business_reviews.status', 'approved')
      .single()
  }

  // Create new business
  static async createBusiness(business: BusinessInsert) {
    return supabase
      .from('businesses')
      .insert([business])
      .select()
      .single()
  }

  // Update business
  static async updateBusiness(id: string, updates: BusinessUpdate) {
    return supabase
      .from('businesses')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
  }

  // Delete business (soft delete)
  static async deleteBusiness(id: string) {
    return supabase
      .from('businesses')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
  }

  // Search businesses with geolocation
  static async searchBusinessesNearLocation({
    lat,
    lng,
    radiusMiles = 25,
    limit = 20,
  }: {
    lat: number
    lng: number
    radiusMiles?: number
    limit?: number
  }) {
    const client = await createClient()
    // TODO: Implement RPC function 'businesses_near_location'
    // return client
    //   .rpc('businesses_near_location', {
    //     lat,
    //     lng,
    //     radius_miles: radiusMiles
    //   })
    //   .limit(limit)
    
    // Placeholder implementation until RPC is created
    return client
      .from('businesses')
      .select('*')
      .limit(limit)
  }

  // Get businesses by owner
  static async getBusinessesByOwner(ownerId: string) {
    return supabase
      .from('businesses')
      .select(`
        *,
        categories:primary_category_id(id, name, slug)
      `)
      .eq('owner_id', ownerId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
  }
}

// Category service functions
export class CategoryService {
  // Get all active categories
  static async getActiveCategories() {
    return supabase
      .from('categories')
      .select('*')
      .eq('active', true)
      .order('level')
      .order('sort_order')
  }

  // Get category hierarchy
  static async getCategoryHierarchy() {
    return supabase
      .from('categories')
      .select('*')
      .eq('active', true)
      .order('level')
      .order('sort_order')
  }

  // Get category by slug with business count
  static async getCategoryBySlug(slug: string) {
    return supabase
      .from('categories')
      .select(`
        *,
        businesses:businesses!primary_category_id(count)
      `)
      .eq('slug', slug)
      .eq('active', true)
      .single()
  }

  // Get featured categories
  static async getFeaturedCategories() {
    return supabase
      .from('categories')
      .select('*')
      .eq('active', true)
      .eq('featured', true)
      .order('sort_order')
  }
}

// Review service functions
export class ReviewService {
  // Get reviews for a business
  static async getBusinessReviews(businessId: string, {
    limit = 10,
    offset = 0,
  }: {
    limit?: number
    offset?: number
  } = {}) {
    return supabase
      .from('business_reviews')
      .select(`
        *,
        reviewer:auth.users(id, email)
      `)
      .eq('business_id', businessId)
      .eq('status', 'approved')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
  }

  // Create new review
  static async createReview(review: BusinessReviewInsert) {
    return supabase
      .from('business_reviews')
      .insert([review])
      .select()
      .single()
  }

  // Update review
  static async updateReview(id: string, updates: BusinessReviewUpdate) {
    return supabase
      .from('business_reviews')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
  }

  // Get user's reviews
  static async getUserReviews(userId: string) {
    return supabase
      .from('business_reviews')
      .select(`
        *,
        business:businesses(id, name, slug)
      `)
      .eq('reviewer_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
  }
}

// Utility functions
export class DatabaseUtils {
  // Generate unique slug
  static async generateUniqueSlug(baseSlug: string, table: 'businesses' | 'categories'): Promise<string> {
    let slug = baseSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '')
    let counter = 0

    while (true) {
      const testSlug = counter === 0 ? slug : `${slug}-${counter}`
      
      const { data } = await supabase
        .from(table)
        .select('slug')
        .eq('slug', testSlug)
        .single()

      if (!data) {
        return testSlug
      }
      
      counter++
    }
  }

  // Geocode address to coordinates
  static async geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    // This would integrate with a geocoding service like Google Maps or MapBox
    // For now, return null - implement based on chosen provider
    return null
  }

  // Calculate distance between two points
  static calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 3959 // Earth's radius in miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }
}

// Export client for direct access when needed
export { supabase }
export { createClient }