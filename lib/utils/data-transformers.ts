/**
 * Data Transformers - Type Compatibility Layer
 * The Lawless Directory - Transform database types to UI types
 */

import type { Business as DatabaseBusiness, Category, BusinessReview } from '../supabase/database.types'
import type { Business as UIBusiness, BusinessHours, DayHours } from '../../types/business'

/**
 * Transform database business to UI business format
 */
export const transformBusinessForUI = (
  dbBusiness: DatabaseBusiness & { 
    category?: Category | null
    review_stats?: { review_count: number; avg_rating: number } | null
    distance_meters?: number
  }
): UIBusiness => {
  // Parse business hours from JSON
  const parseBusinessHours = (hoursJson: any): BusinessHours => {
    if (!hoursJson) return {}
    
    const parseDay = (day: any): DayHours | undefined => {
      if (!day || day.isClosed) return { open: '00:00', close: '00:00', isClosed: true }
      return {
        open: day.open || '09:00',
        close: day.close || '17:00',
        isClosed: false
      }
    }

    return {
      monday: parseDay(hoursJson.monday),
      tuesday: parseDay(hoursJson.tuesday),
      wednesday: parseDay(hoursJson.wednesday),
      thursday: parseDay(hoursJson.thursday),
      friday: parseDay(hoursJson.friday),
      saturday: parseDay(hoursJson.saturday),
      sunday: parseDay(hoursJson.sunday),
    }
  }

  // Parse gallery images
  const parseGallery = (galleryJson: any): string[] => {
    if (!galleryJson) return []
    if (Array.isArray(galleryJson)) return galleryJson.filter(img => typeof img === 'string')
    if (typeof galleryJson === 'object' && galleryJson.images) {
      return Array.isArray(galleryJson.images) ? galleryJson.images : []
    }
    return []
  }

  // Determine price range (this would need business logic based on your pricing data)
  const determinePriceRange = (business: DatabaseBusiness): '$' | '$$' | '$$$' | '$$$$' => {
    // This is a placeholder - you'd implement actual logic based on your business data
    const tier = business.subscription_tier
    if (tier === 'enterprise') return '$$$$'
    if (tier === 'premium') return '$$$'
    if (tier === 'starter') return '$$'
    return '$'
  }

  // Convert distance from meters to miles
  const distanceInMiles = dbBusiness.distance_meters 
    ? Math.round((dbBusiness.distance_meters * 0.000621371) * 10) / 10 
    : 0

  // Parse coordinates from PostGIS point
  const parseCoordinates = (location: any) => {
    if (!location) return undefined
    
    // PostGIS POINT format handling would go here
    // This is a placeholder for actual PostGIS parsing
    try {
      if (typeof location === 'object' && location.coordinates) {
        return {
          lat: location.coordinates[1],
          lng: location.coordinates[0]
        }
      }
    } catch (error) {
      console.warn('Error parsing coordinates:', error)
    }
    return undefined
  }

  const gallery = parseGallery(dbBusiness.gallery)

  return {
    id: dbBusiness.id,
    name: dbBusiness.name,
    category: dbBusiness.category?.name || 'General',
    subcategory: dbBusiness.category?.parent_id ? undefined : dbBusiness.category?.name,
    description: dbBusiness.description || '',
    shortDescription: dbBusiness.short_description || '',

    // Location & Contact
    address: {
      street: dbBusiness.address_line_1 || '',
      city: dbBusiness.city,
      state: dbBusiness.state,
      zipCode: dbBusiness.zip_code || '',
      country: dbBusiness.country || 'US'
    },
    coordinates: parseCoordinates(dbBusiness.location),
    phone: dbBusiness.phone || undefined,
    email: dbBusiness.email || undefined,
    website: dbBusiness.website || undefined,

    // Business Details
    price: determinePriceRange(dbBusiness),
    distance: distanceInMiles,
    averageRating: dbBusiness.review_stats?.avg_rating || dbBusiness.quality_score,
    reviewCount: dbBusiness.review_stats?.review_count || 0,
    hours: parseBusinessHours(dbBusiness.business_hours),

    // Media & Images
    primaryImage: dbBusiness.cover_image_url || gallery[0] || '/placeholder.jpg',
    images: gallery,
    logo: dbBusiness.logo_url || undefined,

    // Status & Features
    isActive: dbBusiness.status === 'active',
    isVerified: dbBusiness.verification_status === 'verified',
    subscription: dbBusiness.subscription_tier === 'enterprise' ? 'enterprise' :
                  dbBusiness.subscription_tier === 'premium' ? 'premium' : 'free',
    features: [], // Would be derived from custom_attributes or premium_features
    badges: dbBusiness.verification_status === 'verified' ? ['Verified'] : [],

    // Business Operations (would need to be stored in custom_attributes)
    acceptsReservations: undefined,
    deliveryAvailable: undefined,
    takeoutAvailable: undefined,
    wheelchairAccessible: undefined,
    parkingAvailable: undefined,

    // Timestamps
    createdAt: dbBusiness.created_at,
    updatedAt: dbBusiness.updated_at,
    claimedAt: dbBusiness.claimed_at || undefined
  }
}

/**
 * Transform multiple businesses for UI
 */
export const transformBusinessListForUI = (
  businesses: (DatabaseBusiness & { 
    category?: Category | null
    review_stats?: { review_count: number; avg_rating: number } | null
    distance_meters?: number
  })[]
): UIBusiness[] => {
  return businesses.map(transformBusinessForUI)
}

/**
 * Transform UI search params to database params
 */
export const transformSearchParamsForDB = (uiParams: {
  query?: string
  category?: string
  location?: { lat: number; lng: number }
  radius?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  filters?: {
    minRating?: number
    priceRange?: string[]
    openNow?: boolean
    verified?: boolean
    premium?: boolean
  }
}) => {
  return {
    query: uiParams.query,
    category: uiParams.category,
    location: uiParams.location,
    radius: uiParams.radius ? uiParams.radius * 1609.34 : undefined, // Convert miles to meters
    sortBy: uiParams.sortBy === 'rating' ? 'quality_score' : 
           uiParams.sortBy === 'distance' ? 'distance' :
           uiParams.sortBy || 'name',
    sortOrder: uiParams.sortOrder,
    filters: {
      rating: uiParams.filters?.minRating,
      verifiedOnly: uiParams.filters?.verified,
      premiumOnly: uiParams.filters?.premium,
      openNow: uiParams.filters?.openNow
    }
  }
}

/**
 * Transform database category to UI format
 */
export const transformCategoryForUI = (dbCategory: Category) => {
  return {
    id: dbCategory.id,
    name: dbCategory.name,
    slug: dbCategory.slug,
    description: dbCategory.description,
    icon: dbCategory.icon,
    color: dbCategory.color,
    businessCount: dbCategory.business_count,
    featured: dbCategory.featured
  }
}

/**
 * Transform database review to UI format
 */
export const transformReviewForUI = (dbReview: BusinessReview) => {
  return {
    id: dbReview.id,
    businessId: dbReview.business_id,
    reviewerId: dbReview.reviewer_id,
    rating: dbReview.rating,
    title: dbReview.title,
    content: dbReview.content,
    visitDate: dbReview.visit_date,
    photos: Array.isArray(dbReview.photos) ? dbReview.photos : [],
    helpfulCount: dbReview.helpful_count,
    createdAt: dbReview.created_at,
    updatedAt: dbReview.updated_at
  }
}

/**
 * Optimize image URL for different sizes
 */
export const optimizeImageForSize = (
  imageUrl: string | null | undefined,
  size: 'thumbnail' | 'card' | 'hero' | 'full' = 'card'
): string => {
  if (!imageUrl) {
    return '/placeholder.jpg'
  }

  // Size mappings
  const sizeMap = {
    thumbnail: { width: 150, height: 150 },
    card: { width: 400, height: 300 },
    hero: { width: 1200, height: 600 },
    full: { width: 1920, height: 1080 }
  }

  const dimensions = sizeMap[size]

  // If it's a Supabase storage URL, add transform parameters
  if (imageUrl.includes('supabase.co/storage')) {
    const transformParams = [
      `width=${dimensions.width}`,
      `height=${dimensions.height}`,
      'quality=80',
      'format=webp'
    ]
    
    const separator = imageUrl.includes('?') ? '&' : '?'
    return `${imageUrl}${separator}${transformParams.join('&')}`
  }

  return imageUrl
}

/**
 * Create search suggestions from businesses and categories
 */
export const createSearchSuggestions = (
  businesses: UIBusiness[],
  categories: any[],
  query: string
) => {
  const suggestions = []

  // Add business suggestions
  businesses.slice(0, 3).forEach(business => {
    suggestions.push({
      text: business.name,
      icon: '🏢',
      type: 'business' as const,
      category: business.category
    })
  })

  // Add category suggestions
  categories.slice(0, 2).forEach(category => {
    suggestions.push({
      text: category.name,
      icon: category.icon || '📁',
      type: 'category' as const,
      category: category.name
    })
  })

  // Add location suggestion if query looks like a location
  if (query.includes(',') || /\d{5}/.test(query)) {
    suggestions.push({
      text: `Businesses near "${query}"`,
      icon: '📍',
      type: 'location' as const
    })
  }

  return suggestions.slice(0, 5)
}

/**
 * Format distance for display
 */
export const formatDistanceForDisplay = (distanceInMiles: number): string => {
  if (distanceInMiles < 0.1) {
    return 'Very close'
  } else if (distanceInMiles < 1) {
    return `${Math.round(distanceInMiles * 10) / 10} mi`
  } else if (distanceInMiles < 10) {
    return `${Math.round(distanceInMiles * 10) / 10} mi`
  } else {
    return `${Math.round(distanceInMiles)} mi`
  }
}

/**
 * Format rating for display
 */
export const formatRatingForDisplay = (rating: number): string => {
  return rating.toFixed(1)
}

/**
 * Check if business is open now
 */
export const isBusinessOpenNow = (hours: BusinessHours): boolean => {
  const now = new Date()
  const currentDay = now.getDay() // 0 = Sunday, 1 = Monday, etc.
  const currentTime = now.toTimeString().slice(0, 5) // HH:MM format

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const todayKey = dayNames[currentDay] as keyof BusinessHours
  const todayHours = hours[todayKey]

  if (!todayHours || todayHours.isClosed) {
    return false
  }

  return currentTime >= todayHours.open && currentTime <= todayHours.close
}