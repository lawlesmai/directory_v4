/**
 * Business API Functions
 * The Lawless Directory - Database Integration
 */

import { supabase, isSupabaseReady } from '../supabase/client';
import type { 
  Business, 
  Category, 
  BusinessReview,
  NearbyBusinessResult,
  SearchBusinessResult,
  BusinessDetailsResult 
} from '../supabase/database.types';

// Enhanced business data with computed fields
export interface EnhancedBusiness extends Business {
  category?: Category;
  review_stats?: {
    avg_rating: number;
    total_reviews: number;
    recent_reviews?: number;
  };
  distance?: number;
  is_premium?: boolean;
  is_verified?: boolean;
}

// Search parameters interface
export interface BusinessSearchParams {
  query?: string;
  category?: string;
  location?: { lat: number; lng: number };
  radius?: number; // in meters
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'rating' | 'distance' | 'created_at' | 'quality_score';
  sortOrder?: 'asc' | 'desc';
  filters?: {
    rating?: number;
    priceRange?: [number, number];
    openNow?: boolean;
    premiumOnly?: boolean;
    verifiedOnly?: boolean;
  };
}

// API response wrapper
interface ApiResponse<T> {
  data: T;
  total?: number;
  hasMore?: boolean;
  error?: string;
}

// Fallback sample data when Supabase is not available
const fallbackBusinesses: EnhancedBusiness[] = [
  {
    id: '1',
    slug: 'cozy-downtown-cafe',
    name: 'Cozy Downtown Café',
    legal_name: 'Cozy Downtown Café LLC',
    description: 'Artisan coffee and fresh pastries in a warm, welcoming atmosphere perfect for work or relaxation.',
    short_description: 'Artisan coffee and fresh pastries',
    primary_category_id: 'restaurants',
    city: 'Downtown',
    state: 'NY',
    country: 'US',
    cover_image_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=250&fit=crop',
    logo_url: null,
    quality_score: 4.9,
    subscription_tier: 'premium',
    verification_status: 'verified',
    status: 'active',
    phone_verified: true,
    email_verified: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    category: {
      id: 'restaurants',
      name: 'Restaurants',
      slug: 'restaurants',
      icon: '🍽️',
      color: '#f59e0b'
    } as Category,
    review_stats: {
      avg_rating: 4.9,
      total_reviews: 127
    },
    is_premium: true,
    is_verified: true
  },
  {
    id: '2',
    slug: 'elite-auto-repair',
    name: 'Elite Auto Repair',
    legal_name: 'Elite Auto Repair Inc.',
    description: 'Complete automotive service with 20+ years experience in all makes and models.',
    short_description: 'Complete automotive service',
    primary_category_id: 'auto-services',
    city: 'Midtown',
    state: 'NY', 
    country: 'US',
    cover_image_url: 'https://images.unsplash.com/photo-1562967916-eb82221dfb92?w=400&h=250&fit=crop',
    logo_url: null,
    quality_score: 4.6,
    subscription_tier: 'free',
    verification_status: 'verified',
    status: 'active',
    phone_verified: true,
    email_verified: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    category: {
      id: 'auto-services',
      name: 'Auto Services',
      slug: 'auto-services',
      icon: '🚗',
      color: '#3b82f6'
    } as Category,
    review_stats: {
      avg_rating: 4.6,
      total_reviews: 89
    },
    is_premium: false,
    is_verified: true
  },
  {
    id: '3',
    slug: 'bellas-italian-kitchen',
    name: "Bella's Italian Kitchen",
    legal_name: "Bella's Italian Kitchen LLC",
    description: 'Authentic Italian cuisine with fresh ingredients and family recipes passed down through generations.',
    short_description: 'Authentic Italian cuisine',
    primary_category_id: 'restaurants',
    city: 'Little Italy',
    state: 'NY',
    country: 'US', 
    cover_image_url: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=250&fit=crop',
    logo_url: null,
    quality_score: 4.8,
    subscription_tier: 'starter',
    verification_status: 'verified',
    status: 'active',
    phone_verified: true,
    email_verified: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    category: {
      id: 'restaurants',
      name: 'Restaurants', 
      slug: 'restaurants',
      icon: '🍽️',
      color: '#f59e0b'
    } as Category,
    review_stats: {
      avg_rating: 4.8,
      total_reviews: 203
    },
    is_premium: false,
    is_verified: true
  }
] as EnhancedBusiness[];

const fallbackCategories: Category[] = [
  {
    id: 'restaurants',
    name: 'Restaurants',
    slug: 'restaurants',
    icon: '🍽️',
    color: '#f59e0b',
    active: true
  },
  {
    id: 'auto-services', 
    name: 'Auto Services',
    slug: 'auto-services',
    icon: '🚗',
    color: '#3b82f6',
    active: true
  },
  {
    id: 'health-beauty',
    name: 'Health & Beauty',
    slug: 'health-beauty',
    icon: '💄',
    color: '#ec4899',
    active: true
  },
  {
    id: 'professional-services',
    name: 'Professional Services',
    slug: 'professional-services', 
    icon: '💼',
    color: '#6b7280',
    active: true
  },
  {
    id: 'shopping',
    name: 'Shopping',
    slug: 'shopping',
    icon: '🛍️',
    color: '#8b5cf6',
    active: true
  },
  {
    id: 'home-services',
    name: 'Home Services',
    slug: 'home-services',
    icon: '🏠',
    color: '#10b981',
    active: true
  }
] as Category[];

export const businessApi = {
  /**
   * Get paginated business listings with enhanced data
   */
  getBusinesses: async (params: BusinessSearchParams = {}): Promise<ApiResponse<EnhancedBusiness[]>> => {
    // Return fallback data if Supabase is not configured
    if (!isSupabaseReady() || !supabase) {
      console.log('Using fallback business data - Supabase not configured');
      
      let businesses = [...fallbackBusinesses];
      
      // Apply simple filtering for demo
      if (params.query) {
        businesses = businesses.filter(b => 
          b.name.toLowerCase().includes(params.query!.toLowerCase()) ||
          b.description?.toLowerCase().includes(params.query!.toLowerCase()) ||
          b.category?.name.toLowerCase().includes(params.query!.toLowerCase())
        );
      }
      
      if (params.category && params.category !== 'All') {
        businesses = businesses.filter(b => 
          b.category?.name === params.category
        );
      }
      
      return {
        data: businesses,
        total: businesses.length,
        hasMore: false
      };
    }

    try {
      const {
        query,
        category,
        location,
        radius = 10000, // 10km default
        limit = 20,
        offset = 0,
        sortBy = 'quality_score',
        sortOrder = 'desc',
        filters = {}
      } = params;

      let queryBuilder = supabase
        .from('businesses')
        .select(`
          *,
          category:categories!primary_category_id(
            id,
            name,
            slug,
            icon,
            color
          )
        `, { count: 'exact' })
        .eq('status', 'active')
        .is('deleted_at', null);

      // Full-text search
      if (query && query.trim().length >= 2) {
        // Use the search function for better results
        const { data: searchResults, error: searchError } = await supabase
          .rpc('search_businesses', {
            search_query: query,
            category_filter: category || null,
            location_filter: location ? `POINT(${location.lng} ${location.lat})` : null,
            radius_meters: radius,
            limit_count: limit,
            offset_count: offset
          });

        if (searchError) {
          throw new Error(`Search failed: ${searchError.message}`);
        }

        return {
          data: searchResults?.map((result: SearchBusinessResult) => ({
            ...result,
            is_premium: result.is_premium,
            is_verified: result.is_verified,
            review_stats: {
              avg_rating: result.rating,
              total_reviews: result.review_count
            }
          })) || [],
          total: searchResults?.length || 0,
          hasMore: (searchResults?.length || 0) >= limit
        };
      }

      // Category filter
      if (category) {
        queryBuilder = queryBuilder.eq('primary_category_id', category);
      }

      // Location-based search using nearby function
      if (location) {
        const { data: nearbyResults, error: nearbyError } = await supabase
          .rpc('find_nearby_businesses', {
            user_location: `POINT(${location.lng} ${location.lat})`,
            radius_meters: radius,
            category_filter: category || null,
            limit_count: limit,
            offset_count: offset
          });

        if (nearbyError) {
          throw new Error(`Nearby search failed: ${nearbyError.message}`);
        }

        return {
          data: nearbyResults?.map((result: NearbyBusinessResult) => ({
            ...result,
            distance: result.distance_meters,
            is_premium: result.is_premium,
            is_verified: result.is_verified,
            review_stats: {
              avg_rating: result.rating,
              total_reviews: result.review_count
            }
          })) || [],
          total: nearbyResults?.length || 0,
          hasMore: (nearbyResults?.length || 0) >= limit
        };
      }

      // Apply additional filters
      if (filters.verifiedOnly) {
        queryBuilder = queryBuilder.eq('verification_status', 'verified');
      }

      if (filters.premiumOnly) {
        queryBuilder = queryBuilder.neq('subscription_tier', 'free');
      }

      if (filters.rating) {
        queryBuilder = queryBuilder.gte('quality_score', filters.rating);
      }

      // Sorting
      queryBuilder = queryBuilder.order(sortBy, { ascending: sortOrder === 'asc' });

      // Pagination
      queryBuilder = queryBuilder.range(offset, offset + limit - 1);

      const { data, error, count } = await queryBuilder;

      if (error) {
        throw new Error(`Failed to fetch businesses: ${error.message}`);
      }

      // Enhance data with computed fields
      const enhancedData: EnhancedBusiness[] = (data || []).map(business => ({
        ...business,
        is_premium: business.subscription_tier !== 'free',
        is_verified: business.verification_status === 'verified',
        review_stats: {
          avg_rating: business.quality_score || 0,
          total_reviews: 0 // Will be computed by aggregation
        }
      }));

      return {
        data: enhancedData,
        total: count || 0,
        hasMore: (count || 0) > offset + limit
      };

    } catch (error) {
      console.error('Error fetching businesses:', error);
      return {
        data: [],
        total: 0,
        hasMore: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  },

  /**
   * Get single business by slug with full details
   */
  getBusinessBySlug: async (slug: string): Promise<ApiResponse<EnhancedBusiness | null>> => {
    try {
      const { data, error } = await supabase
        .rpc('get_business_details', {
          business_slug: slug
        });

      if (error) {
        throw new Error(`Failed to fetch business: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return {
          data: null,
          error: 'Business not found'
        };
      }

      const businessDetails = data[0] as BusinessDetailsResult;
      
      return {
        data: businessDetails.business as EnhancedBusiness
      };

    } catch (error) {
      console.error('Error fetching business details:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  },

  /**
   * Search with auto-suggestions
   */
  searchSuggestions: async (query: string, limit: number = 10): Promise<ApiResponse<string[]>> => {
    // Return fallback data if Supabase is not configured
    if (!isSupabaseReady() || !supabase) {
      console.log('Using fallback search suggestions - Supabase not configured');
      
      if (!query || query.trim().length < 2) {
        return { data: [] };
      }
      
      const suggestions = fallbackBusinesses
        .filter(b => b.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, limit)
        .map(b => b.name);
      
      return {
        data: suggestions
      };
    }

    try {
      if (!query || query.trim().length < 2) {
        return { data: [] };
      }

      // Use the advanced search suggestions function
      const { data: suggestionsData, error } = await supabase
        .rpc('get_search_suggestions', {
          partial_query: query,
          suggestion_limit: limit
        });

      if (error) {
        throw new Error(`Search suggestions failed: ${error.message}`);
      }

      // Extract suggestion text from the structured response
      const suggestions = (suggestionsData || []).map((item: any) => item.suggestion);
      
      return {
        data: suggestions
      };

    } catch (error) {
      console.error('Error fetching search suggestions, using fallback:', error);
      
      // Fallback to simple name-based search
      try {
        const { data, error: fallbackError } = await supabase
          .from('businesses')
          .select('name')
          .ilike('name', `%${query}%`)
          .eq('status', 'active')
          .is('deleted_at', null)
          .limit(limit);

        if (fallbackError) throw fallbackError;

        const suggestions = data?.map(business => business.name) || [];
        return { data: suggestions };
        
      } catch (fallbackError) {
        console.error('Fallback search also failed:', fallbackError);
        return {
          data: [],
          error: 'Search suggestions unavailable'
        };
      }
    }
  },

  /**
   * Get all categories for filtering
   */
  getCategories: async (): Promise<ApiResponse<Category[]>> => {
    // Return fallback data if Supabase is not configured
    if (!isSupabaseReady() || !supabase) {
      console.log('Using fallback category data - Supabase not configured');
      return {
        data: fallbackCategories
      };
    }

    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('active', true)
        .eq('show_in_directory', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch categories: ${error.message}`);
      }

      return {
        data: data || []
      };

    } catch (error) {
      console.error('Error fetching categories:', error);
      return {
        data: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  },

  /**
   * Get featured/premium businesses
   */
  getFeaturedBusinesses: async (limit: number = 6): Promise<ApiResponse<EnhancedBusiness[]>> => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select(`
          *,
          category:categories!primary_category_id(
            id,
            name,
            slug,
            icon,
            color
          )
        `)
        .eq('status', 'active')
        .is('deleted_at', null)
        .or('subscription_tier.neq.free,featured_until.gte.now()')
        .order('quality_score', { ascending: false })
        .order('subscription_tier', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to fetch featured businesses: ${error.message}`);
      }

      // Enhance data with computed fields
      const enhancedData: EnhancedBusiness[] = (data || []).map(business => ({
        ...business,
        is_premium: business.subscription_tier !== 'free',
        is_verified: business.verification_status === 'verified',
        review_stats: {
          avg_rating: business.quality_score || 0,
          total_reviews: 0
        }
      }));

      return {
        data: enhancedData
      };

    } catch (error) {
      console.error('Error fetching featured businesses:', error);
      return {
        data: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  },

  /**
   * Get business reviews
   */
  getBusinessReviews: async (businessId: string, limit: number = 10, offset: number = 0): Promise<ApiResponse<BusinessReview[]>> => {
    try {
      const { data, error, count } = await supabase
        .from('business_reviews')
        .select('*', { count: 'exact' })
        .eq('business_id', businessId)
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to fetch reviews: ${error.message}`);
      }

      return {
        data: data || [],
        total: count || 0,
        hasMore: (count || 0) > offset + limit
      };

    } catch (error) {
      console.error('Error fetching reviews:', error);
      return {
        data: [],
        total: 0,
        hasMore: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
};

// Additional functions for business pages
export const getBusinessBySlug = async (slug: string): Promise<Business | null> => {
  // Return fallback data if Supabase is not configured
  if (!isSupabaseReady() || !supabase) {
    console.log('Using fallback business data - Supabase not configured');
    const business = fallbackBusinesses.find(b => b.slug === slug);
    if (!business) return null;

    // Convert fallback data to Business type
    return {
      id: business.id,
      name: business.name,
      category: business.category?.name || 'General',
      subcategory: business.category?.name,
      description: business.description || '',
      shortDescription: business.short_description,
      address: {
        street: '123 Main St',
        city: business.city || 'New York',
        state: business.state || 'NY',
        zipCode: '10001',
        country: business.country || 'US'
      },
      coordinates: { lat: 40.7128, lng: -74.0060 },
      phone: '+1 (555) 123-4567',
      email: 'contact@business.com',
      website: 'https://www.business.com',
      price: '$$' as const,
      distance: 0.5,
      averageRating: business.review_stats?.avg_rating || 4.5,
      reviewCount: business.review_stats?.total_reviews || 50,
      hours: {
        monday: { open: '09:00', close: '17:00' },
        tuesday: { open: '09:00', close: '17:00' },
        wednesday: { open: '09:00', close: '17:00' },
        thursday: { open: '09:00', close: '17:00' },
        friday: { open: '09:00', close: '17:00' },
        saturday: { open: '10:00', close: '16:00' },
        sunday: { isClosed: true }
      },
      primaryImage: business.cover_image_url || '/placeholder-business.jpg',
      images: [
        business.cover_image_url || '/placeholder-business.jpg',
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=250&fit=crop',
        'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&h=250&fit=crop'
      ].filter(Boolean),
      logo: business.logo_url,
      isActive: business.status === 'active',
      isVerified: business.is_verified || false,
      subscription: business.is_premium ? 'premium' : 'free',
      features: ['Free WiFi', 'Outdoor Seating', 'Credit Cards Accepted', 'Wheelchair Accessible'],
      badges: business.is_verified ? ['Verified Business'] : [],
      acceptsReservations: true,
      deliveryAvailable: false,
      takeoutAvailable: true,
      wheelchairAccessible: true,
      parkingAvailable: true,
      createdAt: business.created_at,
      updatedAt: business.updated_at
    };
  }

  try {
    const response = await businessApi.getBusinessBySlug(slug);
    if (response.error || !response.data) {
      return null;
    }

    const business = response.data;
    
    // Convert EnhancedBusiness to Business type
    return {
      id: business.id,
      name: business.name,
      category: business.category?.name || 'General',
      subcategory: business.category?.name,
      description: business.description || '',
      shortDescription: business.short_description,
      address: {
        street: '123 Main St', // Would come from business data
        city: business.city || 'New York',
        state: business.state || 'NY',
        zipCode: '10001',
        country: business.country || 'US'
      },
      coordinates: { lat: 40.7128, lng: -74.0060 }, // Would come from business data
      phone: '+1 (555) 123-4567', // Would come from business data
      email: 'contact@business.com', // Would come from business data
      website: 'https://www.business.com', // Would come from business data
      price: '$$' as const, // Would come from business data
      distance: business.distance || 0,
      averageRating: business.review_stats?.avg_rating || business.quality_score || 0,
      reviewCount: business.review_stats?.total_reviews || 0,
      hours: {
        monday: { open: '09:00', close: '17:00' },
        tuesday: { open: '09:00', close: '17:00' },
        wednesday: { open: '09:00', close: '17:00' },
        thursday: { open: '09:00', close: '17:00' },
        friday: { open: '09:00', close: '17:00' },
        saturday: { open: '10:00', close: '16:00' },
        sunday: { isClosed: true }
      },
      primaryImage: business.cover_image_url || '/placeholder-business.jpg',
      images: [
        business.cover_image_url || '/placeholder-business.jpg',
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=250&fit=crop',
        'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&h=250&fit=crop'
      ].filter(Boolean),
      logo: business.logo_url,
      isActive: business.status === 'active',
      isVerified: business.is_verified || false,
      subscription: business.is_premium ? 'premium' : 'free',
      features: ['Free WiFi', 'Outdoor Seating', 'Credit Cards Accepted', 'Wheelchair Accessible'],
      badges: business.is_verified ? ['Verified Business'] : [],
      acceptsReservations: true,
      deliveryAvailable: false,
      takeoutAvailable: true,
      wheelchairAccessible: true,
      parkingAvailable: true,
      createdAt: business.created_at,
      updatedAt: business.updated_at
    };
  } catch (error) {
    console.error('Error fetching business by slug:', error);
    return null;
  }
};

export const getBusinessesByCategory = async (categorySlug: string): Promise<Business[]> => {
  try {
    const response = await businessApi.getBusinesses({ 
      category: categorySlug,
      limit: 50 
    });
    
    if (response.error || !response.data) {
      return [];
    }

    // Convert EnhancedBusiness[] to Business[]
    return response.data.map(business => ({
      id: business.id,
      name: business.name,
      category: business.category?.name || 'General',
      subcategory: business.category?.name,
      description: business.description || '',
      shortDescription: business.short_description,
      address: {
        street: '123 Main St',
        city: business.city || 'New York',
        state: business.state || 'NY',
        zipCode: '10001',
        country: business.country || 'US'
      },
      coordinates: { lat: 40.7128, lng: -74.0060 },
      phone: '+1 (555) 123-4567',
      email: 'contact@business.com',
      website: 'https://www.business.com',
      price: '$$' as const,
      distance: business.distance || 0,
      averageRating: business.review_stats?.avg_rating || business.quality_score || 0,
      reviewCount: business.review_stats?.total_reviews || 0,
      hours: {
        monday: { open: '09:00', close: '17:00' },
        tuesday: { open: '09:00', close: '17:00' },
        wednesday: { open: '09:00', close: '17:00' },
        thursday: { open: '09:00', close: '17:00' },
        friday: { open: '09:00', close: '17:00' },
        saturday: { open: '10:00', close: '16:00' },
        sunday: { isClosed: true }
      },
      primaryImage: business.cover_image_url || '/placeholder-business.jpg',
      images: [business.cover_image_url || '/placeholder-business.jpg'],
      logo: business.logo_url,
      isActive: business.status === 'active',
      isVerified: business.is_verified || false,
      subscription: business.is_premium ? 'premium' : 'free',
      features: ['Free WiFi', 'Credit Cards Accepted'],
      badges: business.is_verified ? ['Verified Business'] : [],
      acceptsReservations: true,
      deliveryAvailable: false,
      takeoutAvailable: true,
      wheelchairAccessible: true,
      parkingAvailable: true,
      createdAt: business.created_at,
      updatedAt: business.updated_at
    }));
  } catch (error) {
    console.error('Error fetching businesses by category:', error);
    return [];
  }
};

export const getAllBusinessSlugs = async (): Promise<Array<{ category: string; slug: string }>> => {
  // Return fallback data if Supabase is not configured
  if (!isSupabaseReady() || !supabase) {
    console.log('Using fallback business slugs - Supabase not configured');
    return fallbackBusinesses.map(business => ({
      category: business.category?.slug || 'general',
      slug: business.slug
    }));
  }

  try {
    const { data, error } = await supabase
      .from('businesses')
      .select(`
        slug,
        category:categories!primary_category_id(slug)
      `)
      .eq('status', 'active')
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Failed to fetch business slugs: ${error.message}`);
    }

    return (data || []).map(business => ({
      category: business.category?.slug || 'general',
      slug: business.slug
    }));
  } catch (error) {
    console.error('Error fetching business slugs:', error);
    return [];
  }
};

export default businessApi;