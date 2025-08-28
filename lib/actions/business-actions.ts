/**
 * Business Server Actions - Next.js Server Actions
 * The Lawless Directory - Server-side data fetching for SSR/SSG
 */

'use server'

import { cache } from 'react'
import { businessServerApi, BusinessSearchParams } from '../api/businesses'
import type { Business, Category } from '../supabase/database.types'

// Cache business listings for better performance
export const getCachedBusinesses = cache(async (params: BusinessSearchParams = {}) => {
  try {
    const result = await businessServerApi.getBusinesses(params)
    return {
      success: true,
      data: result,
      error: null
    }
  } catch (error) {
    console.error('Error in getCachedBusinesses:', error)
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})

// Cache business details for better performance
export const getCachedBusinessBySlug = cache(async (slug: string) => {
  try {
    const business = await businessServerApi.getBusinessBySlug(slug)
    return {
      success: true,
      data: business,
      error: null
    }
  } catch (error) {
    console.error(`Error in getCachedBusinessBySlug for ${slug}:`, error)
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})

// Cache categories for better performance
export const getCachedCategories = cache(async () => {
  try {
    const categories = await businessServerApi.getBusinessCategories()
    return {
      success: true,
      data: categories,
      error: null
    }
  } catch (error) {
    console.error('Error in getCachedCategories:', error)
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})

// Cache featured businesses for better performance
export const getCachedFeaturedBusinesses = cache(async (limit: number = 10) => {
  try {
    const businesses = await businessServerApi.getFeaturedBusinesses(limit)
    return {
      success: true,
      data: businesses,
      error: null
    }
  } catch (error) {
    console.error('Error in getCachedFeaturedBusinesses:', error)
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})

// Get businesses by category with caching
export const getCachedBusinessesByCategory = cache(async (
  categorySlug: string,
  params: Omit<BusinessSearchParams, 'category'> = {}
) => {
  try {
    const result = await businessServerApi.getBusinessesByCategory(categorySlug)
    return {
      success: true,
      data: result,
      error: null
    }
  } catch (error) {
    console.error(`Error in getCachedBusinessesByCategory for ${categorySlug}:`, error)
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})

// Get static paths for business pages (for static generation)
export const getBusinessStaticPaths = async (limit: number = 100) => {
  try {
    const result = await businessServerApi.getBusinesses({ 
      limit, 
      sortBy: 'created_at', 
      sortOrder: 'desc' 
    })
    
    const paths = result.data?.map((business) => ({
      params: { slug: business.slug }
    })) || []
    
    return paths
  } catch (error) {
    console.error('Error generating business static paths:', error)
    return []
  }
}

// Get static paths for category pages (for static generation)
export const getCategoryStaticPaths = async () => {
  try {
    const categoriesResponse = await businessServerApi.getBusinessCategories()
    
    const paths = (categoriesResponse.data || []).map((category: any) => ({
      params: { slug: category.slug }
    }))
    
    return paths
  } catch (error) {
    console.error('Error generating category static paths:', error)
    return []
  }
}

// Prefetch data for a business (useful for hover prefetching)
export const prefetchBusinessData = async (slug: string) => {
  try {
    // This will use the cache, so subsequent calls will be fast
    await getCachedBusinessBySlug(slug)
    return { success: true }
  } catch (error) {
    console.error(`Error prefetching business data for ${slug}:`, error)
    return { success: false }
  }
}

// Search businesses server action (for form submissions)
export const searchBusinessesAction = async (formData: FormData) => {
  const query = formData.get('query')?.toString() || ''
  const category = formData.get('category')?.toString() || ''
  const location = formData.get('location')?.toString() || ''
  
  if (!query.trim()) {
    return {
      success: false,
      data: null,
      error: 'Search query is required'
    }
  }

  try {
    const params: BusinessSearchParams = {
      query: query.trim(),
      limit: 20
    }
    
    if (category) {
      params.category = category
    }
    
    // Parse location if provided (format: "lat,lng")
    if (location) {
      const [lat, lng] = location.split(',').map(coord => parseFloat(coord.trim()))
      if (!isNaN(lat) && !isNaN(lng)) {
        params.location = { lat, lng }
        params.radius = 10000 // 10km default
      }
    }
    
    const result = await businessServerApi.getBusinesses(params)
    
    return {
      success: true,
      data: result,
      error: null
    }
  } catch (error) {
    console.error('Error in searchBusinessesAction:', error)
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Search failed'
    }
  }
}

// Filter businesses server action (for form submissions)
export const filterBusinessesAction = async (formData: FormData) => {
  try {
    const params: BusinessSearchParams = {}
    
    // Parse form data
    const category = formData.get('category')?.toString()
    const rating = formData.get('rating')?.toString()
    const sortBy = formData.get('sortBy')?.toString()
    const sortOrder = formData.get('sortOrder')?.toString()
    const verifiedOnly = formData.get('verifiedOnly') === 'true'
    const premiumOnly = formData.get('premiumOnly') === 'true'
    const location = formData.get('location')?.toString()
    
    if (category) {
      params.category = category
    }
    
    if (sortBy) {
      params.sortBy = sortBy as any
    }
    
    if (sortOrder) {
      params.sortOrder = sortOrder as any
    }
    
    // Parse location if provided
    if (location) {
      const [lat, lng] = location.split(',').map(coord => parseFloat(coord.trim()))
      if (!isNaN(lat) && !isNaN(lng)) {
        params.location = { lat, lng }
        params.radius = 15000 // 15km for filtering
      }
    }
    
    // Set up filters
    params.filters = {}
    if (rating) {
      const ratingNum = parseFloat(rating)
      if (!isNaN(ratingNum)) {
        params.filters.rating = ratingNum
      }
    }
    
    if (verifiedOnly) {
      params.filters.verifiedOnly = true
    }
    
    if (premiumOnly) {
      params.filters.premiumOnly = true
    }
    
    const result = await businessServerApi.getBusinesses(params)
    
    return {
      success: true,
      data: result,
      error: null
    }
  } catch (error) {
    console.error('Error in filterBusinessesAction:', error)
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Filter failed'
    }
  }
}

// Increment business view count (called when business page is visited)
export const incrementBusinessViewCount = async (businessId: string) => {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/businesses/interactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        businessId,
        action: 'view',
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'server-action'
        }
      }),
    })
    
    if (!response.ok) {
      throw new Error('Failed to increment view count')
    }
    
    return { success: true }
  } catch (error) {
    console.error('Error incrementing view count:', error)
    return { success: false }
  }
}