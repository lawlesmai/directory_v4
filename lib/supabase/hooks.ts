/**
 * Supabase React Hooks
 * The Lawless Directory - Data Fetching Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './client'
import type {
  Business,
  BusinessInsert,
  BusinessUpdate,
  Category,
  BusinessReview,
  NearbyBusinessResult,
  SearchBusinessResult,
  BusinessDetailsResult
} from './database.types'

// =====================================================
// BUSINESS HOOKS
// =====================================================

/**
 * Fetch all active businesses
 */
export const useBusinesses = (options?: {
  category?: string
  city?: string
  state?: string
  limit?: number
  offset?: number
}) => {
  return useQuery({
    queryKey: ['businesses', options],
    queryFn: async () => {
      let query = supabase
        .from('businesses')
        .select(`
          *,
          categories!primary_category_id (
            id,
            name,
            slug,
            icon
          )
        `)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('quality_score', { ascending: false })

      if (options?.category) {
        query = query.eq('primary_category_id', options.category)
      }
      if (options?.city) {
        query = query.eq('city', options.city)
      }
      if (options?.state) {
        query = query.eq('state', options.state)
      }
      if (options?.limit) {
        query = query.limit(options.limit)
      }
      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
      }

      const { data, error } = await query

      if (error) throw error
      return data
    },
  })
}

/**
 * Fetch a single business by slug
 */
export const useBusiness = (slug: string) => {
  return useQuery({
    queryKey: ['business', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_business_details', { business_slug: slug })
        .single()

      if (error) throw error
      return data as BusinessDetailsResult
    },
    enabled: !!slug,
  })
}

/**
 * Search businesses
 */
export const useSearchBusinesses = (
  searchQuery: string,
  options?: {
    category?: string
    location?: { lat: number; lng: number }
    radius?: number
    limit?: number
    offset?: number
  }
) => {
  return useQuery({
    queryKey: ['search', searchQuery, options],
    queryFn: async () => {
      const params: any = {
        search_query: searchQuery,
        limit_count: options?.limit || 50,
        offset_count: options?.offset || 0,
      }

      if (options?.category) {
        params.category_filter = options.category
      }
      if (options?.location) {
        params.location_filter = `POINT(${options.location.lng} ${options.location.lat})`
        params.radius_meters = options.radius || 10000
      }

      const { data, error } = await supabase
        .rpc('search_businesses', params)

      if (error) throw error
      return data as SearchBusinessResult[]
    },
    enabled: !!searchQuery,
  })
}

/**
 * Find nearby businesses
 */
export const useNearbyBusinesses = (
  location: { lat: number; lng: number },
  options?: {
    radius?: number
    category?: string
    limit?: number
    offset?: number
  }
) => {
  return useQuery({
    queryKey: ['nearby', location, options],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('find_nearby_businesses', {
          user_location: `POINT(${location.lng} ${location.lat})`,
          radius_meters: options?.radius || 5000,
          category_filter: options?.category || null,
          limit_count: options?.limit || 50,
          offset_count: options?.offset || 0,
        })

      if (error) throw error
      return data as NearbyBusinessResult[]
    },
    enabled: !!location,
  })
}

/**
 * Create a new business
 */
export const useCreateBusiness = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (business: BusinessInsert) => {
      const { data, error } = await supabase
        .from('businesses')
        .insert(business)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] })
    },
  })
}

/**
 * Update a business
 */
export const useUpdateBusiness = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: BusinessUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('businesses')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['business', data.slug] })
      queryClient.invalidateQueries({ queryKey: ['businesses'] })
    },
  })
}

// =====================================================
// CATEGORY HOOKS
// =====================================================

/**
 * Fetch all active categories
 */
export const useCategories = () => {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('active', true)
        .order('sort_order')

      if (error) throw error
      return data as Category[]
    },
  })
}

/**
 * Fetch category with business counts
 */
export const useCategoryStats = () => {
  return useQuery({
    queryKey: ['category-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('category_business_counts')
        .select('*')
        .order('total_business_count', { ascending: false })

      if (error) throw error
      return data
    },
  })
}

// =====================================================
// REVIEW HOOKS
// =====================================================

/**
 * Fetch reviews for a business
 */
export const useBusinessReviews = (
  businessId: string,
  options?: {
    limit?: number
    offset?: number
  }
) => {
  return useQuery({
    queryKey: ['reviews', businessId, options],
    queryFn: async () => {
      let query = supabase
        .from('business_reviews')
        .select(`
          *,
          business_review_responses (*)
        `)
        .eq('business_id', businessId)
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (options?.limit) {
        query = query.limit(options.limit)
      }
      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
      }

      const { data, error } = await query

      if (error) throw error
      return data as BusinessReview[]
    },
    enabled: !!businessId,
  })
}

/**
 * Create a new review
 */
export const useCreateReview = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (review: {
      business_id: string
      rating: number
      title?: string
      content: string
    }) => {
      const { data, error } = await supabase
        .from('business_reviews')
        .insert({
          ...review,
          reviewer_id: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reviews', data.business_id] })
      queryClient.invalidateQueries({ queryKey: ['business'] })
    },
  })
}

/**
 * Mark a review as helpful
 */
export const useMarkReviewHelpful = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (reviewId: string) => {
      const { data, error } = await supabase
        .from('business_reviews')
        .update({ helpful_count: supabase.raw('helpful_count + 1') })
        .eq('id', reviewId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reviews', data.business_id] })
    },
  })
}

// =====================================================
// ANALYTICS HOOKS
// =====================================================

/**
 * Track a business view
 */
export const useTrackBusinessView = () => {
  return useMutation({
    mutationFn: async (businessId: string) => {
      const { error } = await supabase
        .from('businesses')
        .update({ 
          view_count: supabase.raw('view_count + 1'),
          last_activity_at: new Date().toISOString()
        })
        .eq('id', businessId)

      if (error) throw error
    },
  })
}

/**
 * Track a click event
 */
export const useTrackClick = () => {
  return useMutation({
    mutationFn: async ({
      businessId,
      clickType,
    }: {
      businessId: string
      clickType: 'phone' | 'website' | 'directions' | 'share' | 'save'
    }) => {
      const columnMap = {
        phone: 'phone_clicks',
        website: 'website_clicks',
        directions: 'direction_clicks',
        share: 'share_clicks',
        save: 'save_clicks',
      }

      const column = columnMap[clickType]

      // Update business analytics for today
      const { error } = await supabase
        .from('business_analytics')
        .upsert({
          business_id: businessId,
          date: new Date().toISOString().split('T')[0],
          [column]: supabase.raw(`${column} + 1`),
        })

      if (error) throw error
    },
  })
}

// =====================================================
// AUTHENTICATION HOOKS
// =====================================================

/**
 * Get current user
 */
export const useUser = () => {
  return useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      return user
    },
  })
}

/**
 * Get user's businesses
 */
export const useMyBusinesses = () => {
  return useQuery({
    queryKey: ['my-businesses'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Business[]
    },
  })
}

// =====================================================
// REAL-TIME SUBSCRIPTIONS
// =====================================================

/**
 * Subscribe to business updates
 */
export const useBusinessSubscription = (
  businessId: string,
  onUpdate: (payload: any) => void
) => {
  useEffect(() => {
    const subscription = supabase
      .channel(`business:${businessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'businesses',
          filter: `id=eq.${businessId}`,
        },
        onUpdate
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [businessId, onUpdate])
}

/**
 * Subscribe to new reviews
 */
export const useReviewsSubscription = (
  businessId: string,
  onNewReview: (payload: any) => void
) => {
  useEffect(() => {
    const subscription = supabase
      .channel(`reviews:${businessId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'business_reviews',
          filter: `business_id=eq.${businessId}`,
        },
        onNewReview
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [businessId, onNewReview])
}

import { useEffect } from 'react'
