import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

// Types for analytics data
interface AnalyticsEvent {
  name: string;
  timestamp: number;
  properties?: Record<string, any>;
  userId?: string;
  sessionId: string;
}

interface CoreWebVitalMetric {
  name: 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB' | 'INP';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  timestamp: number;
  url: string;
  sessionId: string;
}

interface PerformanceMetrics {
  pageLoadTime: number;
  timeToInteractive: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay?: number;
  interactionToNextPaint?: number;
  timeToFirstByte?: number;
  sessionId: string;
  timestamp: number;
  url: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  connectionType?: string;
  rating: 'good' | 'needs-improvement' | 'poor';
}

interface AnalyticsPayload {
  events: AnalyticsEvent[];
  session: {
    sessionId: string;
    startTime: number;
    pageViews: number;
    interactions: number;
    searches: number;
    businessViews: number;
    conversions: number;
  };
  timestamp: number;
  metadata?: {
    userAgent?: string;
    referrer?: string;
    viewport?: { width: number; height: number };
    location?: { latitude: number; longitude: number };
  };
}

// Rate limiting storage (in production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const clientData = rateLimitMap.get(clientId) || { count: 0, resetTime: now + RATE_WINDOW };
  
  if (now > clientData.resetTime) {
    clientData.count = 1;
    clientData.resetTime = now + RATE_WINDOW;
  } else {
    clientData.count++;
  }
  
  rateLimitMap.set(clientId, clientData);
  return clientData.count <= RATE_LIMIT;
}

function getClientId(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';
  return ip;
}

function validateAnalyticsPayload(payload: any): payload is AnalyticsPayload {
  return (
    payload &&
    Array.isArray(payload.events) &&
    payload.session &&
    typeof payload.session.sessionId === 'string' &&
    typeof payload.timestamp === 'number'
  );
}

function categorizePerformanceMetrics(events: AnalyticsEvent[]): {
  coreWebVitals: CoreWebVitalMetric[];
  performanceMetrics: PerformanceMetrics[];
  errorEvents: AnalyticsEvent[];
  userEvents: AnalyticsEvent[];
} {
  const coreWebVitals: CoreWebVitalMetric[] = [];
  const performanceMetrics: PerformanceMetrics[] = [];
  const errorEvents: AnalyticsEvent[] = [];
  const userEvents: AnalyticsEvent[] = [];

  events.forEach(event => {
    if (event.name === 'core_web_vital' && event.properties) {
      coreWebVitals.push(event.properties as CoreWebVitalMetric);
    } else if (event.name === 'performance_metrics' && event.properties) {
      performanceMetrics.push(event.properties as PerformanceMetrics);
    } else if (event.name.includes('error') || event.name.includes('Error')) {
      errorEvents.push(event);
    } else {
      userEvents.push(event);
    }
  });

  return { coreWebVitals, performanceMetrics, errorEvents, userEvents };
}

async function storeAnalyticsData(payload: AnalyticsPayload, clientInfo: any) {
  try {
    // In a real application, you would store this data in your database
    // For now, we'll log structured data for monitoring
    
    const { coreWebVitals, performanceMetrics, errorEvents, userEvents } = 
      categorizePerformanceMetrics(payload.events);

    // Log performance issues
    coreWebVitals.forEach(vital => {
      if (vital.rating === 'poor') {
        console.warn(`🚨 Poor ${vital.name} score:`, {
          value: vital.value,
          url: vital.url,
          sessionId: vital.sessionId,
          timestamp: vital.timestamp
        });
      }
    });

    // Log errors
    if (errorEvents.length > 0) {
      console.error('📊 Analytics Errors:', {
        count: errorEvents.length,
        sessionId: payload.session.sessionId,
        errors: errorEvents.map(e => ({
          name: e.name,
          properties: e.properties,
          timestamp: e.timestamp
        }))
      });
    }

    // Log session summary for monitoring
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Analytics Data Received:', {
        sessionId: payload.session.sessionId,
        eventsCount: payload.events.length,
        coreWebVitalsCount: coreWebVitals.length,
        performanceMetricsCount: performanceMetrics.length,
        errorEventsCount: errorEvents.length,
        userEventsCount: userEvents.length,
        session: payload.session,
        clientInfo
      });
    }

    // Here you would typically:
    // 1. Store in database (e.g., Supabase, PostgreSQL)
    // 2. Send to external analytics service (e.g., Google Analytics, Mixpanel)
    // 3. Update performance dashboards
    // 4. Trigger alerts for performance issues

    return true;
  } catch (error) {
    console.error('Failed to store analytics data:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check rate limiting
    const clientId = getClientId(request);
    if (!checkRateLimit(clientId)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Parse request body with error handling
    let body;
    try {
      const text = await request.text();
      if (!text || text.trim() === '') {
        return NextResponse.json(
          { error: 'Empty request body' },
          { status: 400 }
        );
      }
      body = JSON.parse(text);
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    if (!validateAnalyticsPayload(body)) {
      return NextResponse.json(
        { error: 'Invalid analytics payload' },
        { status: 400 }
      );
    }

    // Extract client information
    const userAgent = request.headers.get('user-agent');
    const referer = request.headers.get('referer');
    const origin = request.headers.get('origin');
    
    const clientInfo = {
      userAgent,
      referer,
      origin,
      ip: clientId,
      timestamp: Date.now()
    };

    // Store analytics data
    const stored = await storeAnalyticsData(body, clientInfo);
    
    if (!stored) {
      return NextResponse.json(
        { error: 'Failed to store analytics data' },
        { status: 500 }
      );
    }

    // Return success with minimal data
    return NextResponse.json({
      success: true,
      received: body.events.length,
      sessionId: body.session.sessionId,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // This endpoint could provide analytics dashboard data
    // For security, you might want to require authentication
    
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const metrics = searchParams.get('metrics')?.split(',') || ['all'];

    // In a real implementation, you would query your database
    // For now, return mock data structure
    const mockAnalytics = {
      overview: {
        totalSessions: 1234,
        totalPageViews: 5678,
        averageSessionDuration: 180000, // 3 minutes
        bounceRate: 0.45,
        conversionRate: 0.12
      },
      performance: {
        averagePageLoadTime: 1200,
        averageLCP: 2.1,
        averageFID: 80,
        averageCLS: 0.05,
        performanceScore: 85
      },
      topPages: [
        { path: '/', views: 1000, avgLoadTime: 1100 },
        { path: '/search', views: 800, avgLoadTime: 1300 },
        { path: '/business/:id', views: 600, avgLoadTime: 1400 }
      ],
      topSearches: [
        { query: 'restaurants near me', count: 245 },
        { query: 'coffee shops', count: 189 },
        { query: 'auto repair', count: 156 }
      ],
      errors: {
        totalErrors: 12,
        errorRate: 0.02,
        topErrors: [
          { message: 'Network request failed', count: 5 },
          { message: 'Component render error', count: 4 },
          { message: 'API timeout', count: 3 }
        ]
      }
    };

    return NextResponse.json({
      success: true,
      data: mockAnalytics,
      timestamp: Date.now(),
      query: {
        sessionId,
        startDate,
        endDate,
        metrics
      }
    });

  } catch (error) {
    console.error('Analytics GET API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function HEAD() {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
}