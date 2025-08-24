# Story 2.2: Next.js Auth Middleware & Server Components Integration

**Epic:** Epic 2 - Authentication & Authorization Layer  
**Story ID:** 2.2  
**Story Points:** 21  
**Priority:** P0 (Critical Security Foundation)  
**Assignee:** Backend Architect Agent  
**Sprint:** 1

## User Story

As a developer, I want secure authentication middleware and server components that follow Supabase SSR best practices so that authentication state is properly managed across the application with comprehensive route protection and session management.

## Story Overview

This story implements the Next.js App Router authentication middleware and server-side components that integrate with Supabase SSR. It establishes route-level protection, session management, and proper authentication state handling across server and client components.

## Detailed Acceptance Criteria

### Authentication Middleware Implementation
- **Given** the need for route-level authentication
- **When** implementing Next.js middleware
- **Then** create comprehensive middleware that handles:

**Route Protection:**
- Protects all `/dashboard/*` routes for authenticated users
- Protects `/admin/*` routes for admin users only
- Protects `/business/*` management routes for business owners
- Redirects unauthenticated users to login with return URL
- Handles role-based access control at middleware level

**Session Management:**
- Validates authentication sessions on every request
- Refreshes tokens automatically when near expiration
- Handles session cleanup on logout
- Manages CSRF protection tokens
- Implements secure session cookies with httpOnly flag

### Middleware Implementation
```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  // Refresh session if expired - required for Server Components
  const { data: { session }, error } = await supabase.auth.getSession()
  
  const url = req.nextUrl.clone()
  const pathname = url.pathname
  
  // Public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/auth/login',
    '/auth/register',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/callback',
    '/businesses',
    '/about',
    '/contact'
  ]
  
  const isPublicRoute = publicRoutes.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  )
  
  // Protected route patterns
  const protectedRoutes = {
    '/dashboard': ['user', 'business_owner', 'admin'],
    '/business': ['business_owner', 'admin'],
    '/admin': ['admin']
  }
  
  // Check if current route requires authentication
  const requiresAuth = Object.keys(protectedRoutes).some(route => 
    pathname.startsWith(route)
  )
  
  if (requiresAuth && (!session || error)) {
    // Redirect to login with return URL
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('redirect_to', pathname)
    return NextResponse.redirect(loginUrl)
  }
  
  if (session && requiresAuth) {
    // Check role-based access
    const userRoles = session.user.app_metadata?.roles || []
    const requiredRoles = Object.entries(protectedRoutes).find(([route]) =>
      pathname.startsWith(route)
    )?.[1] || []
    
    const hasAccess = requiredRoles.some(role => userRoles.includes(role))
    
    if (!hasAccess) {
      // Redirect to unauthorized page or dashboard
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }
  }
  
  // Handle authentication redirect after successful login
  if (pathname === '/auth/callback') {
    const redirectTo = url.searchParams.get('redirect_to') || '/dashboard'
    return NextResponse.redirect(new URL(redirectTo, req.url))
  }
  
  return res
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### Server Component Authentication
- **Given** the SSR architecture requirements
- **When** implementing server components
- **Then** create authentication utilities:

**Server-Side Auth Utilities:**
```typescript
// lib/supabase/server.ts
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Database } from '@/types/database'

export const createServerSupabaseClient = () => {
  return createServerComponentClient<Database>({
    cookies,
  })
}

// Server-side authentication utilities
export async function getServerSession() {
  const supabase = createServerSupabaseClient()
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    return session
  } catch (error) {
    console.error('Error getting server session:', error)
    return null
  }
}

export async function requireAuth() {
  const session = await getServerSession()
  if (!session) {
    redirect('/auth/login')
  }
  return session.user
}

export async function requireRole(role: string) {
  const session = await getServerSession()
  if (!session) {
    redirect('/auth/login')
  }
  
  const userRoles = session.user.app_metadata?.roles || []
  if (!userRoles.includes(role)) {
    redirect('/unauthorized')
  }
  
  return session.user
}

export async function getServerUser() {
  const session = await getServerSession()
  return session?.user || null
}

export async function getUserPermissions(userId: string) {
  const supabase = createServerSupabaseClient()
  
  const { data: permissions, error } = await supabase
    .from('user_permissions_view')
    .select('*')
    .eq('user_id', userId)
  
  if (error) {
    console.error('Error fetching user permissions:', error)
    return []
  }
  
  return permissions || []
}

export async function checkPermission(userId: string, permission: string) {
  const permissions = await getUserPermissions(userId)
  return permissions.some(p => p.permission === permission)
}
```

**Protected Server Components:**
```typescript
// components/server/ProtectedDashboard.tsx
import { requireAuth } from '@/lib/supabase/server'

export default async function ProtectedDashboard() {
  const user = await requireAuth()
  
  return (
    <div>
      <h1>Welcome, {user.email}!</h1>
      <p>This is your protected dashboard.</p>
    </div>
  )
}

// components/server/BusinessManagement.tsx
import { requireRole } from '@/lib/supabase/server'

export default async function BusinessManagement() {
  const user = await requireRole('business_owner')
  
  return (
    <div>
      <h1>Business Management</h1>
      <p>Welcome, business owner: {user.email}</p>
    </div>
  )
}

// components/server/AdminPanel.tsx
import { requireRole } from '@/lib/supabase/server'

export default async function AdminPanel() {
  const user = await requireRole('admin')
  
  return (
    <div>
      <h1>Admin Panel</h1>
      <p>Administrative access for: {user.email}</p>
    </div>
  )
}
```

### Client Component Authentication
- **Given** the need for interactive authentication features
- **When** implementing client components
- **Then** create client-side auth hooks:

**Authentication Context:**
```typescript
// contexts/AuthContext.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Session, User } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string, options?: SignInOptions) => Promise<AuthResponse>
  signUp: (email: string, password: string, options?: SignUpOptions) => Promise<AuthResponse>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<AuthResponse>
}

interface AuthResponse {
  user?: User | null
  error?: Error | null
}

interface SignInOptions {
  rememberMe?: boolean
  redirectTo?: string
}

interface SignUpOptions {
  data?: Record<string, any>
  redirectTo?: string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  
  const supabase = createClientComponentClient<Database>()
  
  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Error getting session:', error)
        } else {
          setSession(session)
          setUser(session?.user ?? null)
        }
      } catch (error) {
        console.error('Unexpected error getting session:', error)
      } finally {
        setLoading(false)
      }
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
        
        // Handle auth events
        if (event === 'SIGNED_IN') {
          console.log('User signed in:', session?.user?.email)
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase.auth])
  
  const signIn = async (
    email: string, 
    password: string, 
    options: SignInOptions = {}
  ): Promise<AuthResponse> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) throw error
      
      // Handle remember me functionality
      if (options.rememberMe) {
        // Set longer session duration
        await supabase.auth.updateUser({
          data: { remember_me: true }
        })
      }
      
      return { user: data.user, error: null }
    } catch (error) {
      console.error('Sign in error:', error)
      return { user: null, error: error as Error }
    }
  }
  
  const signUp = async (
    email: string,
    password: string,
    options: SignUpOptions = {}
  ): Promise<AuthResponse> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: options.data,
          emailRedirectTo: options.redirectTo
        }
      })
      
      if (error) throw error
      
      return { user: data.user, error: null }
    } catch (error) {
      console.error('Sign up error:', error)
      return { user: null, error: error as Error }
    }
  }
  
  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }
  
  const resetPassword = async (email: string): Promise<AuthResponse> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      })
      
      if (error) throw error
      
      return { error: null }
    } catch (error) {
      console.error('Password reset error:', error)
      return { error: error as Error }
    }
  }

  const value: AuthContextType = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
```

**Authentication Hooks:**
```typescript
// hooks/useAuthGuard.ts
'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function useRequireAuth() {
  const { user, loading } = useAuth()
  const router = useRouter()
  
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])
  
  return { user, loading }
}

export function useRequireRole(role: string) {
  const { user, loading } = useAuth()
  const router = useRouter()
  
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
      return
    }
    
    if (!loading && user) {
      const userRoles = user.app_metadata?.roles || []
      if (!userRoles.includes(role)) {
        router.push('/unauthorized')
      }
    }
  }, [user, loading, role, router])
  
  return { user, loading }
}

export function usePermission(permission: string) {
  const { user, loading } = useAuth()
  const [hasPermission, setHasPermission] = useState(false)
  
  useEffect(() => {
    if (!loading && user) {
      const userPermissions = user.app_metadata?.permissions || []
      setHasPermission(userPermissions.includes(permission))
    }
  }, [user, loading, permission])
  
  return { hasPermission, loading }
}
```

## Technical Implementation Notes

### Supabase SSR Implementation
- Use @supabase/auth-helpers-nextjs package exclusively
- Implement proper cookie management for SSR
- Handle hydration mismatches gracefully
- Use server and client component separation correctly

### Performance Considerations
- Cache user sessions appropriately
- Minimize authentication checks where possible
- Implement efficient role checking
- Use React Server Components for auth-dependent content

### Security Best Practices
- Never expose authentication tokens to client-side code
- Implement proper CSRF protection
- Use secure cookie configurations
- Regular security header implementation

### Token Refresh Implementation
```typescript
// lib/supabase/client.ts
import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/database'

let supabaseClient: ReturnType<typeof createBrowserSupabaseClient<Database>> | null = null

export const getSupabaseClient = () => {
  if (!supabaseClient) {
    supabaseClient = createBrowserSupabaseClient<Database>()
    
    // Set up automatic token refresh
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed successfully')
      } else if (event === 'SIGNED_OUT') {
        // Clear any cached data
        supabaseClient = null
      }
    })
  }
  
  return supabaseClient
}
```

## Dependencies
- Story 2.1 (Authentication infrastructure must be complete)
- Epic 1 Stories 1.1-1.2 (Next.js foundation and components)
- Supabase Auth configuration and database setup

## Testing Requirements

### Middleware Tests
- Route protection validation tests
- Role-based access control tests
- Session refresh functionality tests
- Redirect behavior validation tests
- CSRF protection validation

### Server Component Tests
- Authentication state in server components
- Protected route rendering tests
- User role validation in components
- Session handling in server actions
- Error boundary testing for auth failures

### Client Component Tests
- Authentication hook functionality tests
- State synchronization tests between server and client
- Loading state handling tests
- Auth context provider tests
- Permission hook validation tests

### Integration Tests
- Full authentication flow testing
- Cross-component authentication state tests
- Session persistence across page reloads
- Authentication error handling flows

## Definition of Done

### Core Implementation
- [ ] Authentication middleware protecting all specified routes with role-based access
- [ ] Server components properly handling authentication state without client-side token exposure
- [ ] Client-side authentication hooks functional with proper error handling
- [ ] Authentication context providing consistent state management
- [ ] Session management handling refresh and logout automatically

### Security Implementation
- [ ] Role-based access control working at both middleware and component level
- [ ] CSRF protection implemented and tested
- [ ] Secure cookie configurations with httpOnly and secure flags
- [ ] Security headers implemented (CSP, HSTS, etc.)
- [ ] Token refresh handling without exposing tokens to client

### Error Handling
- [ ] Proper error handling for authentication failures at all levels
- [ ] Graceful handling of expired sessions
- [ ] User feedback for authentication errors
- [ ] Redirect handling for unauthorized access attempts

### Performance & UX
- [ ] Performance optimizations for authentication checks (< 50ms response time)
- [ ] Minimal authentication-related re-renders
- [ ] Proper loading states during authentication operations
- [ ] Seamless user experience across server/client component boundaries

### Testing Coverage
- [ ] All authentication middleware functions tested
- [ ] Server component authentication tested
- [ ] Client component hooks tested with various scenarios
- [ ] Integration tests covering full authentication flows
- [ ] Security testing for auth bypasses and vulnerabilities

### Documentation
- [ ] Authentication architecture documentation complete
- [ ] Server component authentication patterns documented
- [ ] Client component usage guidelines created
- [ ] Security implementation guide finalized
- [ ] API documentation for auth utilities complete

## Acceptance Validation

### Security Validation
- [ ] No authentication bypass possible through middleware
- [ ] All protected routes properly secured
- [ ] Session hijacking prevention verified
- [ ] CSRF attacks mitigated
- [ ] Role escalation prevented

### Performance Validation
- [ ] Authentication middleware response time < 50ms (P95)
- [ ] Server component auth checks < 20ms (P95)
- [ ] Client component state updates < 100ms
- [ ] No memory leaks in auth context
- [ ] Proper cleanup on component unmount

### User Experience Validation
- [ ] Seamless authentication flow across server/client components
- [ ] No authentication-related hydration mismatches
- [ ] Clear loading states during auth operations
- [ ] Proper error messaging for auth failures
- [ ] Smooth redirect handling for unauthorized access

## Risk Assessment

**High Risk:** SSR hydration issues with authentication state
- *Mitigation:* Comprehensive testing across SSR/CSR boundaries and proper server/client separation

**Medium Risk:** Complex middleware configuration affecting performance
- *Mitigation:* Performance testing and middleware optimization

**Medium Risk:** Session synchronization across server and client components
- *Mitigation:* Thorough integration testing and state management validation

**Low Risk:** Client-side authentication state management complexity
- *Mitigation:* Well-tested authentication context and hooks

## Success Metrics

- **Security:** Zero authentication bypass vulnerabilities
- **Performance:** Authentication middleware response < 50ms (P95)
- **Reliability:** 99.9% successful authentication state synchronization
- **Developer Experience:** < 5 lines of code for basic auth protection
- **User Experience:** Seamless authentication flow with no visible hydration issues

This story establishes the comprehensive authentication middleware and component integration that provides secure, performant, and user-friendly authentication throughout the Next.js application.