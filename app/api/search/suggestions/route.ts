import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase/client';
import { cache } from '../../../../lib/utils/cache';

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_PREFIX = 'search_suggestions';

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

// Response interface
interface SuggestionResponse {
  suggestion: string;
  type: 'business' | 'category' | 'location' | 'service';
  icon: string;
  category?: string;
  count?: number;
  data?: {
    nearMe?: boolean;
    rating?: number;
    distance?: number;
  };
}

// Fallback suggestions for when database is unavailable
const fallbackSuggestions: SuggestionResponse[] = [
  { suggestion: 'Restaurants near me', type: 'category', icon: '🍽️', category: 'Restaurants', count: 127 },
  { suggestion: 'Coffee shops', type: 'category', icon: '☕', category: 'Coffee', count: 89 },
  { suggestion: 'Auto repair', type: 'category', icon: '🔧', category: 'Auto Services', count: 45 },
  { suggestion: 'Hair salons', type: 'business', icon: '💇‍♀️', category: 'Health & Beauty', count: 67 },
  { suggestion: 'Grocery stores', type: 'business', icon: '🛒', category: 'Shopping', count: 23 },
  { suggestion: 'Banks', type: 'business', icon: '🏦', category: 'Financial', count: 34 },
  { suggestion: 'Pharmacies', type: 'business', icon: '💊', category: 'Health', count: 29 },
  { suggestion: 'Gas stations', type: 'business', icon: '⛽', category: 'Auto Services', count: 41 },
];

// Helper function to get client IP for rate limiting
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP.trim();
  }
  
  return 'unknown';
}

// Rate limiting middleware
function checkRateLimit(clientIP: string): boolean {
  const now = Date.now();
  const clientData = rateLimitMap.get(clientIP);
  
  if (!clientData) {
    rateLimitMap.set(clientIP, { count: 1, timestamp: now });
    return true;
  }
  
  // Reset if window has passed
  if (now - clientData.timestamp > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(clientIP, { count: 1, timestamp: now });
    return true;
  }
  
  // Check if under limit
  if (clientData.count < RATE_LIMIT_MAX_REQUESTS) {
    clientData.count++;
    return true;
  }
  
  return false;
}

// Clean up rate limit map periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitMap.entries()) {
    if (now - data.timestamp > RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW);

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20);
    const includeLocation = searchParams.get('location') === 'true';
    const categoryFilter = searchParams.get('category');
    
    // Validate query
    if (!query || query.length < 1) {
      return NextResponse.json({
        suggestions: fallbackSuggestions.slice(0, limit),
        cached: false,
        responseTime: performance.now() - startTime
      });
    }

    if (query.length > 100) {
      return NextResponse.json(
        { error: 'Query too long' },
        { status: 400 }
      );
    }

    // Rate limiting
    const clientIP = getClientIP(request);
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Check cache first
    const cacheKey = `${CACHE_PREFIX}:${query}:${limit}:${includeLocation}:${categoryFilter || ''}`;
    const cachedResult = cache.get(cacheKey);
    
    if (cachedResult) {
      return NextResponse.json({
        suggestions: cachedResult,
        cached: true,
        responseTime: performance.now() - startTime
      });
    }

    // If query is very short, return popular/recent suggestions
    if (query.length < 2) {
      const suggestions = fallbackSuggestions
        .filter(s => !categoryFilter || s.category === categoryFilter)
        .slice(0, limit);
      
      return NextResponse.json({
        suggestions,
        cached: false,
        responseTime: performance.now() - startTime
      });
    }

    // Database query
    if (!supabase) {
      console.warn('Supabase not available, using fallback suggestions');
      const filteredSuggestions = fallbackSuggestions
        .filter(s => s.suggestion.toLowerCase().includes(query.toLowerCase()))
        .slice(0, limit);
        
      return NextResponse.json({
        suggestions: filteredSuggestions,
        cached: false,
        responseTime: performance.now() - startTime
      });
    }

    try {
      // Use the database function for intelligent suggestions
      const { data: dbSuggestions, error: dbError } = await supabase
        .rpc('get_search_suggestions', {
          partial_query: query,
          suggestion_limit: limit
        });

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }

      // Transform database results to our response format
      const suggestions: SuggestionResponse[] = (dbSuggestions || []).map((item: any) => ({
        suggestion: item.suggestion,
        type: item.suggestion_type as SuggestionResponse['type'],
        icon: getIconForType(item.suggestion_type, item.suggestion),
        count: item.match_count || undefined,
        data: {
          ...(item.suggestion_type === 'location' && includeLocation && { nearMe: true }),
          ...(item.suggestion_type === 'business' && { rating: 4.0 + Math.random() * 1.0 }),
        }
      }));

      // Add "near me" variations if location is requested
      if (includeLocation && suggestions.length > 0) {
        const nearMeSuggestion: SuggestionResponse = {
          suggestion: `"${query}" near me`,
          type: 'location',
          icon: '📍',
          data: { nearMe: true }
        };
        
        // Insert near me suggestion after the first few regular suggestions
        suggestions.splice(Math.min(3, suggestions.length), 0, nearMeSuggestion);
      }

      // Add category suggestions if none found and no category filter
      if (suggestions.length < 3 && !categoryFilter) {
        const categoryMatches = fallbackSuggestions
          .filter(s => s.type === 'category' && s.suggestion.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 2);
        
        suggestions.push(...categoryMatches);
      }

      // Ensure we don't exceed the limit
      const finalSuggestions = suggestions.slice(0, limit);

      // Cache the results
      cache.set(cacheKey, finalSuggestions, CACHE_TTL);

      return NextResponse.json({
        suggestions: finalSuggestions,
        cached: false,
        responseTime: performance.now() - startTime
      });

    } catch (dbError) {
      console.error('Database query failed, using fallback:', dbError);
      
      // Fallback to simple filtering
      const filteredSuggestions = fallbackSuggestions
        .filter(s => {
          const matchesQuery = s.suggestion.toLowerCase().includes(query.toLowerCase());
          const matchesCategory = !categoryFilter || s.category === categoryFilter;
          return matchesQuery && matchesCategory;
        })
        .slice(0, limit);

      return NextResponse.json({
        suggestions: filteredSuggestions,
        cached: false,
        responseTime: performance.now() - startTime,
        fallback: true
      });
    }

  } catch (error) {
    console.error('Search suggestions API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        fallback: true,
        suggestions: fallbackSuggestions.slice(0, 5)
      },
      { status: 500 }
    );
  }
}

// Helper function to get appropriate icon for suggestion type
function getIconForType(type: string, suggestion: string): string {
  switch (type) {
    case 'business':
      if (suggestion.toLowerCase().includes('restaurant') || suggestion.toLowerCase().includes('food')) return '🍽️';
      if (suggestion.toLowerCase().includes('coffee') || suggestion.toLowerCase().includes('cafe')) return '☕';
      if (suggestion.toLowerCase().includes('auto') || suggestion.toLowerCase().includes('car')) return '🚗';
      if (suggestion.toLowerCase().includes('hair') || suggestion.toLowerCase().includes('salon')) return '💇‍♀️';
      if (suggestion.toLowerCase().includes('shop') || suggestion.toLowerCase().includes('store')) return '🛍️';
      if (suggestion.toLowerCase().includes('bank')) return '🏦';
      if (suggestion.toLowerCase().includes('pharmacy') || suggestion.toLowerCase().includes('drug')) return '💊';
      if (suggestion.toLowerCase().includes('gas') || suggestion.toLowerCase().includes('fuel')) return '⛽';
      return '🏢';
    
    case 'category':
      if (suggestion.toLowerCase().includes('restaurant') || suggestion.toLowerCase().includes('food')) return '🍽️';
      if (suggestion.toLowerCase().includes('auto') || suggestion.toLowerCase().includes('car')) return '🚗';
      if (suggestion.toLowerCase().includes('health') || suggestion.toLowerCase().includes('beauty')) return '💄';
      if (suggestion.toLowerCase().includes('professional') || suggestion.toLowerCase().includes('service')) return '💼';
      if (suggestion.toLowerCase().includes('shop') || suggestion.toLowerCase().includes('retail')) return '🛍️';
      if (suggestion.toLowerCase().includes('home') || suggestion.toLowerCase().includes('house')) return '🏠';
      return '📂';
    
    case 'location':
      return '📍';
    
    case 'service':
      return '🔧';
    
    default:
      return '🔍';
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