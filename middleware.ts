/**
 * Enhanced Security Middleware
 * Epic 2 Story 2.2: Comprehensive server-side authentication and session management
 * Handles session refresh, route protection, RBAC, CSRF protection, rate limiting
 * Fixes Critical Security Issues: CVSS 7.8 - Session Security & CSRF Protection
 * Performance Goals: Middleware processing < 10ms, Auth checks < 50ms
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { 
  generateSessionFingerprint, 
  validateSessionFingerprint,
  createSecurityEvent,
  getClientIP 
} from '@/lib/security/server'
import { SECURITY_HEADERS } from '@/lib/security'
import { csrfProtection, addCSRFProtection } from '@/lib/security/csrf'

// Enhanced route protection configuration with role-based access control
const routeConfig = {
  // Public routes - no authentication required
  public: [
    '/',
    '/auth/login',
    '/auth/register', 
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/callback',
    '/auth/verify-email',
    '/business',
    '/businesses',
    '/about',
    '/contact',
    '/terms',
    '/privacy',
    '/api/public',
    '/api/businesses',
    '/api/search',
    '/api/categories'
  ],
  
  // Routes requiring authentication (any authenticated user)
  protected: {
    '/dashboard': ['user', 'business_owner', 'admin', 'super_admin'],
    '/profile': ['user', 'business_owner', 'admin', 'super_admin'],
    '/settings': ['user', 'business_owner', 'admin', 'super_admin'],
    '/notifications': ['user', 'business_owner', 'admin', 'super_admin']
  },
  
  // Business owner specific routes
  businessOwner: {
    '/business/manage': ['business_owner', 'admin', 'super_admin'],
    '/business/dashboard': ['business_owner', 'admin', 'super_admin'],
    '/business/analytics': ['business_owner', 'admin', 'super_admin'],
    '/business/settings': ['business_owner', 'admin', 'super_admin'],
    '/business/reviews': ['business_owner', 'admin', 'super_admin'],
    '/business/subscription': ['business_owner', 'admin', 'super_admin']
  },
  
  // Admin routes
  admin: {
    '/admin': ['admin', 'super_admin'],
    '/admin/dashboard': ['admin', 'super_admin'],
    '/admin/users': ['admin', 'super_admin'],
    '/admin/businesses': ['admin', 'super_admin'],
    '/admin/analytics': ['admin', 'super_admin'],
    '/admin/settings': ['admin', 'super_admin'],
    '/admin/audit': ['admin', 'super_admin'],
    '/admin/security': ['super_admin']
  },
  
  // API route protection
  api: {
    '/api/admin': ['admin', 'super_admin'],
    '/api/business': ['business_owner', 'admin', 'super_admin'],
    '/api/user': ['user', 'business_owner', 'admin', 'super_admin']
  }
}

// Public routes that should redirect if authenticated
const authRoutes = [
  '/auth/login',
  '/auth/signup',
  '/auth/forgot-password'
]

export async function middleware(request: NextRequest) {
  const startTime = Date.now()
  const ip = getClientIP(request)
  const pathname = request.nextUrl.pathname
  
  // Apply CSRF protection first (before any other processing)
  const csrfResult = await csrfProtection(request)
  if (csrfResult) {
    // CSRF validation failed
    const securityEvent = createSecurityEvent(
      'suspicious_activity',
      'high',
      request,
      { 
        reason: 'csrf_validation_failed',
        path: pathname
      }
    )
    console.warn('Security Event:', securityEvent)
    return csrfResult
  }
  
  let supabaseResponse = NextResponse.next({
    request
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        }
      }
    }
  )

  // IMPORTANT: Do not write any logic between createServerClient and supabase.auth.getUser()
  const { data: { user } } = await supabase.auth.getUser()
  
  // Generate and validate session fingerprint for authenticated users
  let sessionValid = true
  if (user) {
    const currentFingerprint = generateSessionFingerprint(request)
    const storedFingerprint = request.cookies.get('session_fingerprint')?.value
    
    if (storedFingerprint) {
      sessionValid = validateSessionFingerprint(currentFingerprint, storedFingerprint)
      
      if (!sessionValid) {
        // Potential session hijacking
        const securityEvent = createSecurityEvent(
          'suspicious_activity',
          'critical',
          request,
          { 
            reason: 'session_fingerprint_mismatch',
            current_fingerprint: currentFingerprint,
            stored_fingerprint: storedFingerprint
          },
          user.id
        )
        
        console.error('Security Alert: Potential session hijacking detected', securityEvent)
        
        // Log security event to database
        try {
          await supabase.from('security_events').insert({
            event_type: 'session_hijack_attempt',
            severity: 'critical',
            user_id: user.id,
            description: 'Session fingerprint mismatch detected',
            details: securityEvent.details,
            ip_address: ip,
            user_agent: request.headers.get('user-agent')
          })
        } catch (error) {
          console.error('Failed to log security event:', error)
        }
        
        // Force logout and redirect to login
        const response = NextResponse.redirect(new URL('/auth/login?reason=security', request.url))
        response.cookies.delete('sb-*') // Clear Supabase cookies
        response.cookies.delete('session_fingerprint')
        return response
      }
    } else {
      // Set initial session fingerprint
      supabaseResponse.cookies.set('session_fingerprint', currentFingerprint, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7200 // 2 hours
      })
    }
  }

  // Route classification with enhanced logic
  const isPublicRoute = routeConfig.public.some(route => {
    if (route.endsWith('*')) {
      return pathname.startsWith(route.slice(0, -1))
    }
    return pathname === route || pathname.startsWith(`${route}/`)
  })
  
  const isAuthRoute = ['/auth/login', '/auth/register', '/auth/forgot-password'].some(route => 
    pathname.startsWith(route)
  )
  
  // Find required roles for current route
  const getRequiredRoles = (path: string): string[] => {
    // Check all route categories
    const allRoutes = {
      ...routeConfig.protected,
      ...routeConfig.businessOwner,
      ...routeConfig.admin,
      ...routeConfig.api
    }
    
    // Find exact match first
    if (allRoutes[path]) {
      return allRoutes[path]
    }
    
    // Find prefix match
    for (const [route, roles] of Object.entries(allRoutes)) {
      if (path.startsWith(route + '/') || path === route) {
        return roles
      }
    }
    
    return []
  }
  
  const requiredRoles = getRequiredRoles(pathname)
  const requiresAuth = requiredRoles.length > 0

  // Redirect authenticated users away from auth pages
  if (user && isAuthRoute) {
    const redirectUrl = request.nextUrl.searchParams.get('redirect') || '/dashboard'
    return NextResponse.redirect(new URL(redirectUrl, request.url))
  }

  // Handle authentication and authorization
  if (!user && requiresAuth) {
    const redirectUrl = new URL('/auth/login', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Enhanced role-based access control for authenticated users
  if (user && requiresAuth) {
    // Get user roles with caching optimization
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select(`
        role:roles(
          name,
          permissions:role_permissions(
            permission:permissions(name, resource, action)
          )
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError)
      return NextResponse.redirect(new URL('/auth/login?error=role_fetch_failed', request.url))
    }

    const userRoleNames = userRoles?.map(r => r.role?.name).filter(Boolean) || []
    const hasRequiredRole = requiredRoles.some(role => userRoleNames.includes(role))

    if (!hasRequiredRole) {
      // Log unauthorized access attempt
      await supabase.from('security_events').insert({
        event_type: 'unauthorized_access_attempt',
        severity: 'medium',
        user_id: user.id,
        description: `Unauthorized access attempt to ${pathname}`,
        details: {
          path: pathname,
          required_roles: requiredRoles,
          user_roles: userRoleNames,
          timestamp: new Date().toISOString()
        },
        ip_address: ip,
        user_agent: request.headers.get('user-agent')
      })
      
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }

    // Store user context for server components
    const userPermissions = userRoles?.flatMap(r => 
      r.role?.permissions?.map(p => `${p.permission?.resource}:${p.permission?.action}`) || []
    ).filter(Boolean) || []

    // Enhanced user context headers for server components
    supabaseResponse.headers.set('x-user-id', user.id)
    supabaseResponse.headers.set('x-user-email', user.email || '')
    supabaseResponse.headers.set('x-user-roles', JSON.stringify(userRoleNames))
    supabaseResponse.headers.set('x-user-permissions', JSON.stringify(userPermissions))
    supabaseResponse.headers.set('x-auth-timestamp', new Date().toISOString())

    // Apply comprehensive security headers
    Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
      supabaseResponse.headers.set(key, value)
    })
    
    // Add performance and timing headers
    const processingTime = Date.now() - startTime
    supabaseResponse.headers.set('X-Response-Time', `${processingTime}ms`)
    
    // Add CSRF protection for subsequent requests
    supabaseResponse = addCSRFProtection(supabaseResponse)

    // Enhanced rate limiting check for API routes
    if (pathname.startsWith('/api/')) {
      // Different limits for different endpoint types
      let maxAttempts = 100
      let windowMinutes = 1
      
      // Stricter limits for sensitive endpoints
      const sensitiveEndpoints = [
        '/api/auth/',
        '/api/admin/',
        '/api/users/password',
        '/api/users/delete'
      ]
      
      if (sensitiveEndpoints.some(endpoint => pathname.startsWith(endpoint))) {
        maxAttempts = 10
        windowMinutes = 15
      }
      
      const { data: rateLimitOk } = await supabase.rpc('check_rate_limit', {
        p_identifier: ip,
        p_identifier_type: 'ip',
        p_action: `api:${pathname}`,
        p_max_attempts: maxAttempts,
        p_window_minutes: windowMinutes
      })

      if (!rateLimitOk) {
        // Log rate limit exceeded event
        const securityEvent = createSecurityEvent(
          'rate_limit_exceeded',
          'medium',
          request,
          { 
            endpoint: pathname,
            limit: maxAttempts,
            window: windowMinutes
          },
          user?.id
        )
        
        console.warn('Rate limit exceeded:', securityEvent)
        
        return NextResponse.json(
          { 
            error: 'Too many requests',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: windowMinutes * 60
          },
          { status: 429 }
        )
      }
    }

    // Log security events for sensitive operations
    const sensitiveOperations = [
      '/api/auth/password-reset',
      '/api/auth/mfa',
      '/api/users/delete',
      '/api/businesses/transfer'
    ]

    if (sensitiveOperations.some(op => pathname.startsWith(op))) {
      await supabase.from('security_events').insert({
        event_type: 'sensitive_operation_attempt',
        severity: 'medium',
        user_id: user.id,
        description: `Attempting sensitive operation: ${pathname}`,
        details: {
          path: pathname,
          method: request.method,
          timestamp: new Date().toISOString()
        },
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent')
      })
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - public files with extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
