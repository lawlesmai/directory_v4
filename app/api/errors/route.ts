import { NextRequest, NextResponse } from 'next/server';

interface ErrorReport {
  message: string;
  stack?: string;
  name: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  componentStack?: string;
  level?: 'error' | 'warning' | 'info';
  context?: Record<string, any>;
  timestamp: number;
  url: string;
  userAgent?: string;
  sessionId?: string;
  userId?: string;
  errorBoundary?: boolean;
  programmaticReport?: boolean;
  retryCount?: number;
}

interface ErrorMetadata {
  ip: string;
  userAgent: string;
  referer?: string;
  origin?: string;
  timestamp: number;
}

// Rate limiting for error reports
const errorRateLimitMap = new Map<string, { count: number; resetTime: number }>();
const ERROR_RATE_LIMIT = 50; // errors per minute per IP
const ERROR_RATE_WINDOW = 60 * 1000; // 1 minute

function checkErrorRateLimit(clientId: string): boolean {
  const now = Date.now();
  const clientData = errorRateLimitMap.get(clientId) || { count: 0, resetTime: now + ERROR_RATE_WINDOW };
  
  if (now > clientData.resetTime) {
    clientData.count = 1;
    clientData.resetTime = now + ERROR_RATE_WINDOW;
  } else {
    clientData.count++;
  }
  
  errorRateLimitMap.set(clientId, clientData);
  return clientData.count <= ERROR_RATE_LIMIT;
}

function getClientId(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';
  return ip;
}

function validateErrorReport(payload: any): payload is ErrorReport {
  return (
    payload &&
    typeof payload.message === 'string' &&
    typeof payload.name === 'string' &&
    typeof payload.timestamp === 'number' &&
    typeof payload.url === 'string'
  );
}

function categorizeError(error: ErrorReport): {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'javascript' | 'network' | 'component' | 'api' | 'performance' | 'security' | 'unknown';
  isUserFacing: boolean;
} {
  const message = error.message.toLowerCase();
  const stack = (error.stack || '').toLowerCase();
  
  // Determine severity
  let severity: 'critical' | 'high' | 'medium' | 'low' = 'medium';
  
  if (
    message.includes('chunk') && message.includes('loading failed') ||
    message.includes('network error') ||
    message.includes('failed to fetch') ||
    error.level === 'error' && error.errorBoundary
  ) {
    severity = 'critical';
  } else if (
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('timeout') ||
    error.retryCount && error.retryCount > 2
  ) {
    severity = 'high';
  } else if (
    message.includes('warning') ||
    error.level === 'warning'
  ) {
    severity = 'low';
  }

  // Determine category
  let category: 'javascript' | 'network' | 'component' | 'api' | 'performance' | 'security' | 'unknown' = 'unknown';
  
  if (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('cors') ||
    message.includes('timeout')
  ) {
    category = 'network';
  } else if (
    message.includes('chunk') ||
    message.includes('loading') ||
    stack.includes('webpack')
  ) {
    category = 'performance';
  } else if (
    error.componentStack ||
    error.errorBoundary ||
    stack.includes('react')
  ) {
    category = 'component';
  } else if (
    message.includes('api') ||
    message.includes('server') ||
    message.includes('response')
  ) {
    category = 'api';
  } else if (
    message.includes('security') ||
    message.includes('unauthorized') ||
    message.includes('forbidden')
  ) {
    category = 'security';
  } else if (
    error.filename ||
    error.lineno ||
    stack.length > 0
  ) {
    category = 'javascript';
  }

  // Determine if user-facing
  const isUserFacing = severity === 'critical' || (
    severity === 'high' && 
    (category === 'component' || category === 'network' || category === 'performance')
  );

  return { severity, category, isUserFacing };
}

async function processErrorReport(error: ErrorReport, metadata: ErrorMetadata) {
  try {
    const classification = categorizeError(error);
    
    // Enhanced error logging
    const logData = {
      ...error,
      ...metadata,
      classification,
      fingerprint: generateErrorFingerprint(error),
      environment: process.env.NODE_ENV || 'unknown'
    };

    // Log based on severity
    if (classification.severity === 'critical') {
      console.error('🚨 CRITICAL ERROR:', logData);
    } else if (classification.severity === 'high') {
      console.warn('⚠️  HIGH SEVERITY ERROR:', logData);
    } else if (process.env.NODE_ENV === 'development') {
      console.log('📝 Error Report:', logData);
    }

    // In production, you would:
    // 1. Store in database for analysis
    // 2. Send to error tracking service (Sentry, LogRocket, etc.)
    // 3. Alert development team for critical errors
    // 4. Update error dashboard metrics
    
    // For now, simulate database storage
    if (classification.isUserFacing) {
      // Simulate alerting for user-facing errors
      console.warn('📧 User-facing error alert would be sent:', {
        fingerprint: logData.fingerprint,
        severity: classification.severity,
        category: classification.category,
        message: error.message,
        url: error.url,
        timestamp: error.timestamp
      });
    }

    return { success: true, classification, fingerprint: logData.fingerprint };

  } catch (processingError) {
    console.error('Failed to process error report:', processingError);
    return { success: false, error: 'Processing failed' };
  }
}

function generateErrorFingerprint(error: ErrorReport): string {
  // Create a unique fingerprint for the error to group similar errors
  const components = [
    error.name,
    error.message,
    error.filename || '',
    error.lineno?.toString() || '',
    error.url.split('?')[0] // Remove query parameters
  ];
  
  const fingerprint = components.join('|');
  return Buffer.from(fingerprint).toString('base64').substring(0, 16);
}

export async function POST(request: NextRequest) {
  try {
    // Check rate limiting
    const clientId = getClientId(request);
    if (!checkErrorRateLimit(clientId)) {
      return NextResponse.json(
        { error: 'Error reporting rate limit exceeded' },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();
    
    if (!validateErrorReport(body)) {
      return NextResponse.json(
        { error: 'Invalid error report format' },
        { status: 400 }
      );
    }

    // Extract metadata
    const metadata: ErrorMetadata = {
      ip: clientId,
      userAgent: request.headers.get('user-agent') || 'unknown',
      referer: request.headers.get('referer') || undefined,
      origin: request.headers.get('origin') || undefined,
      timestamp: Date.now()
    };

    // Process error report
    const result = await processErrorReport(body, metadata);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to process error report' },
        { status: 500 }
      );
    }

    // Return success response
    return NextResponse.json({
      success: true,
      fingerprint: result.fingerprint,
      classification: result.classification,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Error reporting API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // This endpoint could provide error analytics and summaries
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const severity = searchParams.get('severity');
    const category = searchParams.get('category');

    // Mock error analytics data
    const mockErrorAnalytics = {
      summary: {
        totalErrors: 156,
        criticalErrors: 3,
        highSeverityErrors: 12,
        mediumSeverityErrors: 89,
        lowSeverityErrors: 52,
        errorRate: 0.023, // 2.3%
        meanTimeToResolution: 4.2 // hours
      },
      categories: [
        { category: 'network', count: 45, percentage: 28.8 },
        { category: 'javascript', count: 38, percentage: 24.4 },
        { category: 'component', count: 32, percentage: 20.5 },
        { category: 'api', count: 24, percentage: 15.4 },
        { category: 'performance', count: 12, percentage: 7.7 },
        { category: 'security', count: 5, percentage: 3.2 }
      ],
      topErrors: [
        {
          fingerprint: 'YmV0dGVyLWVycm9y',
          message: 'Network request failed',
          count: 23,
          lastSeen: Date.now() - 3600000, // 1 hour ago
          severity: 'high',
          category: 'network'
        },
        {
          fingerprint: 'Y29tcG9uZW50LWVy',
          message: 'Cannot read property of undefined',
          count: 18,
          lastSeen: Date.now() - 1800000, // 30 minutes ago
          severity: 'medium',
          category: 'javascript'
        },
        {
          fingerprint: 'cGVyZm9ybWFuY2U=',
          message: 'ChunkLoadError: Loading chunk failed',
          count: 15,
          lastSeen: Date.now() - 900000, // 15 minutes ago
          severity: 'critical',
          category: 'performance'
        }
      ],
      trends: {
        hourly: Array.from({ length: 24 }, (_, i) => ({
          hour: i,
          errors: Math.floor(Math.random() * 20)
        })),
        daily: Array.from({ length: 7 }, (_, i) => ({
          day: i,
          errors: Math.floor(Math.random() * 100)
        }))
      }
    };

    return NextResponse.json({
      success: true,
      data: mockErrorAnalytics,
      filters: { startDate, endDate, severity, category },
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Error analytics GET API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Health check
export async function HEAD() {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}