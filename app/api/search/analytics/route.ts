import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase/client';

// Analytics event types
interface SearchAnalyticsEvent {
  query: string;
  filters: Record<string, any>;
  resultCount: number;
  responseTime: number;
  clickThroughRate?: number;
  location?: {
    lat: number;
    lng: number;
  };
  userAgent?: string;
  sessionId?: string;
}

interface BusinessClickEvent {
  businessId: string;
  businessName: string;
  searchQuery: string;
  position: number;
  clickTime: number;
}

// Rate limiting
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_EVENTS = 100;
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) return forwarded.split(',')[0].trim();
  if (realIP) return realIP.trim();
  return 'unknown';
}

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
  
  if (clientData.count < RATE_LIMIT_MAX_EVENTS) {
    clientData.count++;
    return true;
  }
  
  return false;
}

// Track search analytics
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(request);
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { 
      type, 
      query, 
      filters = {}, 
      resultCount = 0, 
      responseTime = 0, 
      businessId,
      businessName,
      position,
      location,
      sessionId 
    } = body;

    if (!type) {
      return NextResponse.json(
        { error: 'Event type is required' },
        { status: 400 }
      );
    }

    // Don't track if Supabase is not available
    if (!supabase) {
      console.warn('Supabase not available, analytics not tracked');
      return NextResponse.json({ success: true, tracked: false });
    }

    const userAgent = request.headers.get('user-agent') || undefined;
    const timestamp = new Date().toISOString();

    if (type === 'search') {
      // Track search event
      if (!query || query.trim().length === 0) {
        return NextResponse.json(
          { error: 'Search query is required for search events' },
          { status: 400 }
        );
      }

      try {
        const { data, error } = await supabase
          .rpc('track_search_analytics', {
            search_query: query.trim(),
            result_count: resultCount,
            response_time_ms: Math.round(responseTime),
            search_filters: filters,
            user_location: location ? `POINT(${location.lng} ${location.lat})` : null,
          });

        if (error) {
          console.error('Failed to track search analytics:', error);
          return NextResponse.json({ 
            success: false, 
            error: error.message 
          }, { status: 500 });
        }

        return NextResponse.json({ 
          success: true, 
          tracked: true,
          analyticsId: data
        });

      } catch (dbError) {
        console.error('Database error tracking search:', dbError);
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to track analytics' 
        }, { status: 500 });
      }

    } else if (type === 'business_click') {
      // Track business click event
      if (!businessId || !query) {
        return NextResponse.json(
          { error: 'Business ID and search query are required for click events' },
          { status: 400 }
        );
      }

      try {
        // Insert into a business_click_analytics table (would need to be created)
        const { data, error } = await supabase
          .from('business_click_analytics')
          .insert([{
            business_id: businessId,
            business_name: businessName,
            search_query: query,
            position_in_results: position || 0,
            click_timestamp: timestamp,
            user_agent: userAgent,
            session_id: sessionId,
            ip_address: clientIP,
          }]);

        if (error) {
          console.error('Failed to track business click:', error);
          // Don't fail the request for analytics failures
        }

        return NextResponse.json({ 
          success: true, 
          tracked: !error,
          ...(error && { warning: 'Click tracking failed but search succeeded' })
        });

      } catch (dbError) {
        console.error('Database error tracking click:', dbError);
        return NextResponse.json({ 
          success: true, 
          tracked: false,
          warning: 'Click tracking unavailable'
        });
      }

    } else if (type === 'search_performance') {
      // Track performance metrics
      try {
        const performanceData = {
          query: query || 'performance_metric',
          response_time: responseTime,
          result_count: resultCount,
          timestamp: timestamp,
          user_agent: userAgent,
          filters: filters,
          session_id: sessionId
        };

        // Store in a separate performance metrics collection
        // For now, we'll use the same analytics table with a special marker
        const { error } = await supabase
          .rpc('track_search_analytics', {
            search_query: `_performance_${sessionId || 'unknown'}`,
            result_count: 0,
            response_time_ms: Math.round(responseTime),
            search_filters: performanceData,
          });

        if (error) {
          console.error('Failed to track performance metrics:', error);
        }

        return NextResponse.json({ 
          success: true, 
          tracked: !error 
        });

      } catch (dbError) {
        console.error('Database error tracking performance:', dbError);
        return NextResponse.json({ 
          success: true, 
          tracked: false 
        });
      }

    } else {
      return NextResponse.json(
        { error: 'Unknown event type' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        tracked: false
      },
      { status: 500 }
    );
  }
}

// Get analytics dashboard data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    const type = searchParams.get('type') || 'overview';

    if (!supabase) {
      return NextResponse.json(
        { error: 'Analytics service unavailable' },
        { status: 503 }
      );
    }

    try {
      if (type === 'overview') {
        // Get overview metrics
        const { data: metrics, error } = await supabase
          .from('search_performance_metrics')
          .select('*')
          .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('date', { ascending: false })
          .limit(days);

        if (error) {
          throw new Error(`Failed to fetch metrics: ${error.message}`);
        }

        const summary = {
          totalSearches: metrics?.reduce((sum, day) => sum + day.total_searches, 0) || 0,
          avgResponseTime: metrics?.reduce((sum, day) => sum + day.avg_response_time, 0) / (metrics?.length || 1) || 0,
          avgResultCount: metrics?.reduce((sum, day) => sum + day.avg_results, 0) / (metrics?.length || 1) || 0,
          zeroResultRate: metrics?.reduce((sum, day) => sum + day.zero_result_rate, 0) / (metrics?.length || 1) || 0,
          dailyMetrics: metrics || []
        };

        return NextResponse.json({ 
          success: true, 
          data: summary 
        });

      } else if (type === 'popular') {
        // Get popular searches
        const { data: popular, error } = await supabase
          .from('popular_searches')
          .select('*')
          .limit(20);

        if (error) {
          throw new Error(`Failed to fetch popular searches: ${error.message}`);
        }

        return NextResponse.json({ 
          success: true, 
          data: popular || [] 
        });

      } else {
        return NextResponse.json(
          { error: 'Invalid analytics type' },
          { status: 400 }
        );
      }

    } catch (dbError) {
      console.error('Database error fetching analytics:', dbError);
      return NextResponse.json(
        { error: 'Failed to fetch analytics data' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Analytics GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}