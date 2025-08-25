import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase/client';
import { cache } from '../../../lib/utils/cache';

// Cache configuration
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes for search results
const CACHE_PREFIX = 'search_results';

// Rate limiting
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 200;
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

// Search parameters interface
interface SearchParams {
  query?: string;
  category?: string;
  latitude?: number;
  longitude?: number;
  radius?: number; // in miles
  rating?: number;
  priceMin?: number;
  priceMax?: number;
  openNow?: boolean;
  premiumOnly?: boolean;
  verifiedOnly?: boolean;
  sortBy?: 'relevance' | 'distance' | 'rating' | 'newest';
  limit?: number;
  offset?: number;
}

// Search response interface
interface SearchResponse {
  businesses: any[];
  total: number;
  hasMore: boolean;
  facets?: {
    categories: { [key: string]: number };
    ratings: { [key: string]: number };
    distances: { [key: string]: number };
  };
  performance: {
    query: string;
    responseTime: number;
    cached: boolean;
    resultCount: number;
    searchMethod: string;
  };
}

// Helper function to get client IP
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) return forwarded.split(',')[0].trim();
  if (realIP) return realIP.trim();
  return 'unknown';
}

// Rate limiting
function checkRateLimit(clientIP: string): boolean {
  const now = Date.now();
  const clientData = rateLimitMap.get(clientIP);
  
  if (!clientData) {
    rateLimitMap.set(clientIP, { count: 1, timestamp: now });
    return true;
  }
  
  if (now - clientData.timestamp > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(clientIP, { count: 1, timestamp: now });
    return true;
  }
  
  if (clientData.count < RATE_LIMIT_MAX_REQUESTS) {
    clientData.count++;
    return true;
  }
  
  return false;
}

// Parse and validate search parameters
function parseSearchParams(searchParams: URLSearchParams): SearchParams {
  const params: SearchParams = {
    query: searchParams.get('q')?.trim() || undefined,
    category: searchParams.get('category') || undefined,
    latitude: searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : undefined,
    longitude: searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : undefined,
    radius: searchParams.get('radius') ? Math.min(parseFloat(searchParams.get('radius')!), 50) : 25,
    rating: searchParams.get('rating') ? parseFloat(searchParams.get('rating')!) : undefined,
    priceMin: searchParams.get('priceMin') ? parseInt(searchParams.get('priceMin')!) : undefined,
    priceMax: searchParams.get('priceMax') ? parseInt(searchParams.get('priceMax')!) : undefined,
    openNow: searchParams.get('openNow') === 'true',
    premiumOnly: searchParams.get('premiumOnly') === 'true',
    verifiedOnly: searchParams.get('verifiedOnly') === 'true',
    sortBy: (searchParams.get('sortBy') as SearchParams['sortBy']) || 'relevance',
    limit: Math.min(parseInt(searchParams.get('limit') || '20'), 100),
    offset: Math.max(parseInt(searchParams.get('offset') || '0'), 0),
  };

  // Validate coordinates
  if (params.latitude !== undefined && (params.latitude < -90 || params.latitude > 90)) {
    params.latitude = undefined;
  }
  if (params.longitude !== undefined && (params.longitude < -180 || params.longitude > 180)) {
    params.longitude = undefined;
  }

  return params;
}

// Generate cache key
function generateCacheKey(params: SearchParams): string {
  const keyParts = [
    CACHE_PREFIX,
    params.query || 'all',
    params.category || 'all',
    params.latitude?.toFixed(3) || 'no-lat',
    params.longitude?.toFixed(3) || 'no-lng',
    params.radius || 25,
    params.rating || 'any',
    `${params.priceMin || 0}-${params.priceMax || 9999}`,
    params.openNow ? 'open' : 'any-hours',
    params.premiumOnly ? 'premium' : 'all-tiers',
    params.verifiedOnly ? 'verified' : 'all-status',
    params.sortBy || 'relevance',
    params.limit || 20,
    params.offset || 0,
  ];
  return keyParts.join(':');
}

// Fallback search data
const fallbackBusinesses = [
  {
    id: '1',
    slug: 'cozy-downtown-cafe',
    name: 'Cozy Downtown Café',
    description: 'Artisan coffee and fresh pastries in a warm atmosphere',
    short_description: 'Artisan coffee and fresh pastries',
    city: 'Downtown',
    state: 'NY',
    cover_image_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=250&fit=crop',
    quality_score: 4.9,
    subscription_tier: 'premium',
    verification_status: 'verified',
    distance_meters: 500,
    relevance_score: 0.95,
    match_type: 'full_text'
  },
  {
    id: '2',
    slug: 'elite-auto-repair',
    name: 'Elite Auto Repair',
    description: 'Complete automotive service with 20+ years experience',
    short_description: 'Complete automotive service',
    city: 'Midtown',
    state: 'NY',
    cover_image_url: 'https://images.unsplash.com/photo-1562967916-eb82221dfb92?w=400&h=250&fit=crop',
    quality_score: 4.6,
    subscription_tier: 'free',
    verification_status: 'verified',
    distance_meters: 1200,
    relevance_score: 0.87,
    match_type: 'fuzzy'
  }
];

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    // Rate limiting
    const clientIP = getClientIP(request);
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Parse search parameters
    const { searchParams } = new URL(request.url);
    const params = parseSearchParams(searchParams);

    // Generate cache key and check cache
    const cacheKey = generateCacheKey(params);
    const cachedResult = cache.get(cacheKey);
    
    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        performance: {
          ...cachedResult.performance,
          responseTime: performance.now() - startTime,
          cached: true
        }
      });
    }

    // If no database connection, use fallback
    if (!supabase) {
      console.warn('Supabase not available, using fallback data');
      
      let businesses = [...fallbackBusinesses];
      
      // Simple filtering for fallback
      if (params.query) {
        businesses = businesses.filter(b => 
          b.name.toLowerCase().includes(params.query!.toLowerCase()) ||
          b.description.toLowerCase().includes(params.query!.toLowerCase())
        );
      }
      
      const response: SearchResponse = {
        businesses: businesses.slice(params.offset || 0, (params.offset || 0) + (params.limit || 20)),
        total: businesses.length,
        hasMore: businesses.length > (params.offset || 0) + (params.limit || 20),
        performance: {
          query: params.query || '',
          responseTime: performance.now() - startTime,
          cached: false,
          resultCount: businesses.length,
          searchMethod: 'fallback'
        }
      };
      
      return NextResponse.json(response);
    }

    // Use advanced search function
    let searchMethod = 'advanced_search';
    let searchResults: any[] = [];

    try {
      const hasLocation = params.latitude !== undefined && params.longitude !== undefined;
      const hasQuery = params.query && params.query.trim().length >= 2;

      // Determine search method based on parameters
      if (hasLocation && hasQuery) {
        searchMethod = 'geo_text_search';
      } else if (hasLocation) {
        searchMethod = 'geo_search';
      } else if (hasQuery) {
        searchMethod = 'text_search';
      } else {
        searchMethod = 'browse';
      }

      // Execute the advanced search function
      const { data: searchData, error: searchError } = await supabase
        .rpc('search_businesses_advanced', {
          search_query: params.query || null,
          category_filter: params.category ? params.category : null,
          user_location: hasLocation 
            ? `POINT(${params.longitude} ${params.latitude})` 
            : null,
          radius_meters: (params.radius || 25) * 1609.34, // Convert miles to meters
          rating_filter: params.rating || null,
          price_range_min: params.priceMin || null,
          price_range_max: params.priceMax || null,
          open_now: params.openNow || false,
          premium_only: params.premiumOnly || false,
          verified_only: params.verifiedOnly || false,
          result_limit: params.limit || 20,
          result_offset: params.offset || 0
        });

      if (searchError) {
        throw new Error(`Search failed: ${searchError.message}`);
      }

      searchResults = searchData || [];

    } catch (dbError) {
      console.error('Advanced search failed, falling back to simple search:', dbError);
      
      // Fallback to simpler query if advanced search fails
      let query = supabase
        .from('businesses')
        .select(`
          id, slug, name, description, short_description,
          city, state, cover_image_url, logo_url,
          quality_score, subscription_tier, verification_status
        `)
        .eq('status', 'active')
        .is('deleted_at', null);

      // Apply filters
      if (params.query) {
        query = query.textSearch('name', params.query);
      }
      
      if (params.category) {
        query = query.eq('primary_category_id', params.category);
      }
      
      if (params.rating) {
        query = query.gte('quality_score', params.rating);
      }
      
      if (params.verifiedOnly) {
        query = query.eq('verification_status', 'verified');
      }
      
      if (params.premiumOnly) {
        query = query.neq('subscription_tier', 'free');
      }

      // Sorting
      switch (params.sortBy) {
        case 'rating':
          query = query.order('quality_score', { ascending: false });
          break;
        case 'newest':
          query = query.order('created_at', { ascending: false });
          break;
        default:
          query = query.order('quality_score', { ascending: false });
      }

      // Pagination
      query = query.range(params.offset || 0, (params.offset || 0) + (params.limit || 20) - 1);

      const { data, error } = await query;
      
      if (error) {
        throw new Error(`Fallback search failed: ${error.message}`);
      }

      searchResults = (data || []).map(business => ({
        ...business,
        distance_meters: null,
        relevance_score: business.quality_score / 5.0,
        match_type: 'simple'
      }));
      
      searchMethod = 'simple_search';
    }

    // Track search analytics if we have a query
    if (params.query) {
      try {
        await supabase.rpc('track_search_analytics', {
          search_query: params.query,
          result_count: searchResults.length,
          response_time_ms: Math.round(performance.now() - startTime),
          search_filters: JSON.stringify({
            category: params.category,
            location: params.latitude && params.longitude ? [params.latitude, params.longitude] : null,
            radius: params.radius,
            rating: params.rating,
            openNow: params.openNow,
            premiumOnly: params.premiumOnly,
            verifiedOnly: params.verifiedOnly
          }),
          user_location: params.latitude && params.longitude 
            ? `POINT(${params.longitude} ${params.latitude})` 
            : null
        });
      } catch (analyticsError) {
        console.warn('Failed to track search analytics:', analyticsError);
      }
    }

    // Build response
    const response: SearchResponse = {
      businesses: searchResults,
      total: searchResults.length,
      hasMore: searchResults.length >= (params.limit || 20),
      performance: {
        query: params.query || '',
        responseTime: performance.now() - startTime,
        cached: false,
        resultCount: searchResults.length,
        searchMethod
      }
    };

    // Cache the results (but not location-based searches for privacy)
    if (!params.latitude && !params.longitude) {
      cache.set(cacheKey, response, CACHE_TTL);
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Search API error:', error);
    
    // Return fallback data on error
    const response: SearchResponse = {
      businesses: fallbackBusinesses,
      total: fallbackBusinesses.length,
      hasMore: false,
      performance: {
        query: '',
        responseTime: performance.now() - startTime,
        cached: false,
        resultCount: fallbackBusinesses.length,
        searchMethod: 'error_fallback'
      }
    };
    
    return NextResponse.json(response, { status: 200 }); // Return 200 with fallback data
  }
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}