/**
 * Database Utilities - Advanced Query Implementation
 * The Lawless Directory - PostGIS and full-text search utilities
 */

import { createClient } from '../supabase/server'
import { supabase } from '../supabase/client'
import type { Database, Business } from '../supabase/database.types'

// Query builder for advanced search
export class BusinessQueryBuilder {
  private query: any
  private isServerSide: boolean

  constructor(serverSide: boolean = false) {
    this.isServerSide = serverSide
    if (serverSide) {
      this.query = createClient().from('businesses')
    } else {
      this.query = supabase.from('businesses')
    }
  }

  // Basic selection with optimized fields
  select(fields?: string) {
    const defaultFields = `
      id,
      slug,
      name,
      short_description,
      logo_url,
      cover_image_url,
      city,
      state,
      location,
      quality_score,
      subscription_tier,
      verification_status,
      status,
      phone,
      website,
      address_line_1,
      primary_category:categories!primary_category_id(
        id, name, slug, icon, color
      ),
      business_stats!id(
        review_count,
        avg_rating
      )
    `
    
    this.query = this.query.select(fields || defaultFields, { count: 'exact' })
    return this
  }

  // Active businesses only
  activeOnly() {
    this.query = this.query
      .eq('status', 'active')
      .is('deleted_at', null)
    return this
  }

  // Full-text search with ranking
  fullTextSearch(searchTerm: string) {
    if (!searchTerm?.trim()) return this
    
    // Use the database function for advanced search
    this.query = this.query.rpc('search_businesses_advanced', {
      search_query: searchTerm.trim(),
      include_suggestions: true
    })
    
    return this
  }

  // Category filtering
  byCategory(categoryId?: string, categorySlug?: string) {
    if (categoryId) {
      this.query = this.query.eq('primary_category_id', categoryId)
    } else if (categorySlug) {
      this.query = this.query.eq('categories.slug', categorySlug)
    }
    return this
  }

  // Location-based filtering with PostGIS
  nearLocation(lat: number, lng: number, radiusMeters: number = 10000) {
    // Use PostGIS function for accurate distance calculation
    this.query = this.query.rpc('businesses_near_point', {
      user_lat: lat,
      user_lng: lng,
      radius_meters: radiusMeters
    })
    return this
  }

  // Within bounding box (for map views)
  withinBounds(
    northEast: { lat: number; lng: number },
    southWest: { lat: number; lng: number }
  ) {
    this.query = this.query.rpc('businesses_within_bounds', {
      ne_lat: northEast.lat,
      ne_lng: northEast.lng,
      sw_lat: southWest.lat,
      sw_lng: southWest.lng
    })
    return this
  }

  // Quality/rating filters
  minRating(rating: number) {
    this.query = this.query.gte('quality_score', rating)
    return this
  }

  // Subscription tier filters
  premiumOnly() {
    this.query = this.query.neq('subscription_tier', 'free')
    return this
  }

  verifiedOnly() {
    this.query = this.query.eq('verification_status', 'verified')
    return this
  }

  featuredOnly() {
    this.query = this.query.or('subscription_tier.neq.free,featured_until.gt.now()')
    return this
  }

  // Business hours filter (open now)
  openNow() {
    const now = new Date()
    const dayOfWeek = now.getDay() // 0 = Sunday, 1 = Monday, etc.
    const currentTime = now.toTimeString().slice(0, 5) // HH:MM format
    
    this.query = this.query.rpc('businesses_open_now', {
      current_day: dayOfWeek,
      current_time: currentTime
    })
    return this
  }

  // Recently updated businesses
  recentlyUpdated(days: number = 30) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    
    this.query = this.query.gte('updated_at', cutoffDate.toISOString())
    return this
  }

  // Has photos/gallery
  hasPhotos() {
    this.query = this.query.not('gallery', 'is', null)
    return this
  }

  // Has reviews
  hasReviews() {
    this.query = this.query.gt('business_stats.review_count', 0)
    return this
  }

  // Sorting options
  sortBy(field: string, ascending: boolean = true) {
    // Special handling for distance sorting (when using location queries)
    if (field === 'distance') {
      this.query = this.query.order('distance_meters', { ascending })
    } else if (field === 'relevance') {
      this.query = this.query.order('search_rank', { ascending: false })
    } else {
      this.query = this.query.order(field, { ascending })
    }
    return this
  }

  // Pagination
  paginate(offset: number, limit: number) {
    this.query = this.query.range(offset, offset + limit - 1)
    return this
  }

  // Execute the query
  async execute() {
    const { data, error, count } = await this.query
    
    if (error) {
      throw new Error(`Database query failed: ${error.message}`)
    }

    return {
      data: data || [],
      count: count || 0,
      error: null
    }
  }
}

// Specialized query functions
export const databaseQueries = {
  // Advanced search with typo tolerance and suggestions
  advancedSearch: async (
    searchTerm: string,
    options: {
      limit?: number
      includeCategories?: boolean
      includeSuggestions?: boolean
      typoTolerance?: boolean
    } = {}
  ) => {
    const { limit = 20, includeCategories = true, includeSuggestions = true, typoTolerance = true } = options

    try {
      const client = supabase
      
      const { data, error } = await client.rpc('advanced_business_search', {
        search_query: searchTerm,
        search_limit: limit,
        include_categories: includeCategories,
        include_suggestions: includeSuggestions,
        typo_tolerance: typoTolerance
      })

      if (error) {
        throw new Error(`Search failed: ${error.message}`)
      }

      return {
        businesses: data?.businesses || [],
        suggestions: data?.suggestions || [],
        categories: data?.categories || [],
        totalCount: data?.total_count || 0
      }
    } catch (error) {
      console.error('Advanced search error:', error)
      throw error
    }
  },

  // Get businesses with detailed analytics
  getBusinessesWithAnalytics: async (
    businessIds: string[],
    dateRange?: { start: string; end: string }
  ) => {
    try {
      const client = supabase
      
      const { data, error } = await client.rpc('get_businesses_with_analytics', {
        business_ids: businessIds,
        start_date: dateRange?.start || null,
        end_date: dateRange?.end || null
      })

      if (error) {
        throw new Error(`Analytics query failed: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('Business analytics error:', error)
      throw error
    }
  },

  // Location-based search with travel time estimates
  searchWithTravelTime: async (
    userLocation: { lat: number; lng: number },
    options: {
      radius?: number
      limit?: number
      transportMode?: 'driving' | 'walking' | 'cycling'
    } = {}
  ) => {
    const { radius = 10000, limit = 20, transportMode = 'driving' } = options

    try {
      const client = supabase
      
      const { data, error } = await client.rpc('businesses_with_travel_time', {
        user_lat: userLocation.lat,
        user_lng: userLocation.lng,
        radius_meters: radius,
        search_limit: limit,
        transport_mode: transportMode
      })

      if (error) {
        throw new Error(`Travel time search failed: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('Travel time search error:', error)
      throw error
    }
  },

  // Trending businesses based on recent activity
  getTrendingBusinesses: async (
    location?: { lat: number; lng: number; radius: number },
    limit: number = 10
  ) => {
    try {
      const client = supabase
      
      const { data, error } = await client.rpc('get_trending_businesses', {
        user_lat: location?.lat || null,
        user_lng: location?.lng || null,
        radius_meters: location?.radius || null,
        result_limit: limit
      })

      if (error) {
        throw new Error(`Trending businesses query failed: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('Trending businesses error:', error)
      throw error
    }
  },

  // Similar businesses based on category and location
  getSimilarBusinesses: async (
    businessId: string,
    limit: number = 5
  ) => {
    try {
      const client = supabase
      
      const { data, error } = await client.rpc('get_similar_businesses', {
        business_id: businessId,
        result_limit: limit
      })

      if (error) {
        throw new Error(`Similar businesses query failed: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('Similar businesses error:', error)
      throw error
    }
  },

  // Business performance metrics
  getBusinessMetrics: async (
    businessId: string,
    period: 'week' | 'month' | 'quarter' | 'year' = 'month'
  ) => {
    try {
      const client = supabase
      
      const { data, error } = await client.rpc('get_business_metrics', {
        business_id: businessId,
        time_period: period
      })

      if (error) {
        throw new Error(`Business metrics query failed: ${error.message}`)
      }

      return data?.[0] || null
    } catch (error) {
      console.error('Business metrics error:', error)
      throw error
    }
  }
}

// Database health and performance monitoring
export const databaseHealth = {
  // Check database connection and performance
  checkHealth: async () => {
    try {
      const client = supabase
      
      const startTime = Date.now()
      const { data, error } = await client.rpc('check_database_health')
      const responseTime = Date.now() - startTime

      if (error) {
        throw new Error(`Health check failed: ${error.message}`)
      }

      return {
        healthy: true,
        responseTime,
        checks: data || [],
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('Database health check error:', error)
      return {
        healthy: false,
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  },

  // Get query performance statistics
  getPerformanceStats: async () => {
    try {
      const client = supabase
      
      const { data, error } = await client.rpc('get_performance_stats')

      if (error) {
        throw new Error(`Performance stats query failed: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('Performance stats error:', error)
      throw error
    }
  }
}

// Export the query builder and utilities
export { BusinessQueryBuilder }
export default databaseQueries