# Story 1.5: Supabase Integration & Data Fetching Implementation

**User Story:** As a user, I want to see real business listings from the database instead of static content so that I can access current and comprehensive business information.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 21  
**Sprint:** 2

## Epic Context
**Epic:** 1 - Public Directory MVP  
**Epic Mission:** Transform The Lawless Directory's sophisticated vanilla JavaScript prototype into a production-ready Next.js + Supabase application while preserving and enhancing all existing UI sophistication, performance optimizations, and user experience features.

## Detailed Acceptance Criteria

### Supabase Client Integration
- **Given** the configured Supabase database
- **When** integrating with Next.js application
- **Then** implement:
  - Supabase client configuration with proper TypeScript types
  - Server-side data fetching for SEO optimization
  - Client-side data fetching for interactive features
  - Error handling and retry mechanisms
  - Loading states and skeleton UI components

### Data Fetching Implementation
- **Given** the business listings requirement
- **When** fetching data from Supabase
- **Then** create the following data fetching functions:
  
  **Server-Side Functions (for SEO):**
  - `getBusinesses()` - paginated business listings
  - `getBusinessBySlug()` - individual business details
  - `getBusinessesByCategory()` - category-filtered listings
  - `getFeaturedBusinesses()` - premium/featured businesses
  - `getBusinessCategories()` - all active categories

  **Client-Side Functions (for interactivity):**
  - `searchBusinesses()` - real-time search functionality
  - `filterBusinesses()` - dynamic filtering
  - `getBusinessReviews()` - business review data
  - `getNearbyBusinesses()` - location-based queries

### TypeScript Type Safety
- **Given** the database schema
- **When** implementing data fetching
- **Then** create comprehensive TypeScript types:
  - Generate types from Supabase schema
  - Create API response interfaces
  - Implement proper error type handling
  - Type-safe query builders

### API Data Access Layer Implementation

```typescript
// lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'X-Client-Info': 'lawless-directory@1.0.0'
    }
  }
})

// Server-side client for SSR
export const supabaseServer = createClient<Database>(
  supabaseUrl, 
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)
```

### Data Fetching Functions Implementation

```typescript
// lib/api/businesses.ts
interface BusinessSearchParams {
  query?: string
  category?: string
  location?: { lat: number; lng: number }
  radius?: number
  limit?: number
  offset?: number
  sortBy?: 'name' | 'rating' | 'distance' | 'created_at'
  sortOrder?: 'asc' | 'desc'
  filters?: {
    rating?: number
    priceRange?: [number, number]
    openNow?: boolean
    premiumOnly?: boolean
  }
}

export const businessApi = {
  // Paginated business listing
  getBusinesses: async (params: BusinessSearchParams = {}) => {
    const {
      query,
      category,
      location,
      radius = 10000, // 10km default
      limit = 20,
      offset = 0,
      sortBy = 'name',
      sortOrder = 'asc',
      filters = {}
    } = params

    let queryBuilder = supabase
      .from('businesses')
      .select(`
        id,
        slug,
        name,
        short_description,
        logo_url,
        cover_image_url,
        city,
        state,
        location,
        quality_score,
        subscription_tier,
        status,
        primary_category:categories(id, name, slug, icon),
        review_stats:business_reviews(
          rating.avg(),
          count()
        )
      `)
      .eq('status', 'active')
      .is('deleted_at', null)

    // Full-text search
    if (query) {
      queryBuilder = queryBuilder.textSearch('search_text', query)
    }

    // Category filter
    if (category) {
      queryBuilder = queryBuilder.eq('primary_category_id', category)
    }

    // Location-based search
    if (location) {
      queryBuilder = queryBuilder.rpc('nearby_businesses', {
        lat: location.lat,
        lng: location.lng,
        radius_meters: radius
      })
    }

    // Additional filters
    if (filters.rating) {
      queryBuilder = queryBuilder.gte('quality_score', filters.rating)
    }

    if (filters.premiumOnly) {
      queryBuilder = queryBuilder.neq('subscription_tier', 'free')
    }

    // Sorting
    queryBuilder = queryBuilder.order(sortBy, { ascending: sortOrder === 'asc' })

    // Pagination
    queryBuilder = queryBuilder.range(offset, offset + limit - 1)

    const { data, error, count } = await queryBuilder

    if (error) {
      throw new Error(`Failed to fetch businesses: ${error.message}`)
    }

    return {
      businesses: data || [],
      total: count || 0,
      hasMore: (count || 0) > offset + limit
    }
  },

  // Get single business by slug
  getBusinessBySlug: async (slug: string) => {
    const { data, error } = await supabase
      .from('businesses')
      .select(`
        *,
        category:categories(id, name, slug, icon, color),
        reviews:business_reviews(
          id,
          rating,
          title,
          content,
          created_at,
          reviewer_id,
          photos,
          helpful_count
        ),
        owner:auth.users(id, email, user_metadata)
      `)
      .eq('slug', slug)
      .eq('status', 'active')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('Business not found')
      }
      throw new Error(`Failed to fetch business: ${error.message}`)
    }

    return data
  },

  // Search with suggestions
  searchBusinesses: async (query: string, limit: number = 10) => {
    const { data, error } = await supabase
      .rpc('search_businesses_with_suggestions', {
        search_query: query,
        result_limit: limit
      })

    if (error) {
      throw new Error(`Search failed: ${error.message}`)
    }

    return data
  },

  // Get nearby businesses
  getNearbyBusinesses: async (
    lat: number, 
    lng: number, 
    radius: number = 5000
  ) => {
    const { data, error } = await supabase
      .rpc('find_nearby_businesses', {
        user_location: `POINT(${lng} ${lat})`,
        radius_meters: radius
      })

    if (error) {
      throw new Error(`Failed to find nearby businesses: ${error.message}`)
    }

    return data
  }
}
```

### Caching Strategy
- **Given** the need for performance optimization
- **When** fetching data
- **Then** implement caching:
  - Next.js static generation for business pages
  - Client-side caching with SWR or React Query
  - CDN caching for static assets
  - Database query result caching

```typescript
// hooks/useBusinessData.ts
export const useBusinessData = {
  useBusinesses: (params: BusinessSearchParams) => {
    return useQuery({
      queryKey: ['businesses', params],
      queryFn: () => businessApi.getBusinesses(params),
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      enabled: !!params,
      placeholderData: keepPreviousData
    })
  },

  useBusinessDetails: (slug: string) => {
    return useQuery({
      queryKey: ['business', slug],
      queryFn: () => businessApi.getBusinessBySlug(slug),
      staleTime: 10 * 60 * 1000,
      enabled: !!slug,
      retry: (failureCount, error) => {
        if (error.message.includes('not found')) return false
        return failureCount < 3
      }
    })
  },

  useSearchSuggestions: (query: string) => {
    const debouncedQuery = useDebounce(query, 300)
    
    return useQuery({
      queryKey: ['search-suggestions', debouncedQuery],
      queryFn: () => businessApi.searchBusinesses(debouncedQuery),
      enabled: debouncedQuery.length >= 2,
      staleTime: 5 * 60 * 1000
    })
  }
}
```

## Technical Implementation Notes

### Server-Side Rendering Strategy
- Use Next.js generateStaticParams for business pages
- Implement incremental static regeneration (ISR)
- Server-side props for dynamic content

### Client-Side Data Management
- Implement React Query for client-side data fetching
- Error boundary components for data errors
- Optimistic updates for better UX

### Performance Optimizations
- Database connection pooling
- Query optimization and batching
- Image optimization with Next.js Image component

## Current State Context
**Database Integration Requirements:**
- Real-time data synchronization with database
- Optimized query performance for large datasets
- Type-safe database interactions
- Robust error handling and retry mechanisms

**Performance Benchmarks to Maintain:**
- Page load time < 2s with database data
- Search response time < 500ms
- Database query performance < 100ms
- Client-side data loading with smooth UX

## Dependencies
- Story 1.4 (Database setup must be complete)
- Story 1.2 (Component architecture needed for integration)

## Testing Requirements

### Unit Tests
- Data fetching function tests
- Type validation tests
- Error handling tests
- Cache invalidation tests

### Integration Tests
- Server-side rendering tests
- Client-side data fetching tests
- Database query performance tests
- Error boundary tests

### End-to-End Tests
- Full page loading with real data
- Search functionality with database queries
- Business detail page rendering
- Mobile data loading optimization

## Definition of Done
- [ ] Supabase client properly configured and connected
- [ ] All data fetching functions implemented and typed
- [ ] Server-side rendering working with database data
- [ ] Client-side search and filtering operational
- [ ] TypeScript types generated from database schema
- [ ] Caching strategy implemented and tested
- [ ] Error handling robust for all data operations
- [ ] Loading states implemented throughout application
- [ ] Performance benchmarks met (page load < 2s)
- [ ] All tests passing with >80% coverage

## Risk Assessment
- **Medium Risk:** Data fetching performance may impact user experience
- **Low Risk:** Type safety implementation
- **Mitigation:** Comprehensive performance testing and optimization

## Backend/Frontend/Testing Integration

### Backend Requirements
- Database optimized for frontend query patterns
- API performance monitoring and alerting
- Efficient indexing for search and filter operations
- Real-time capabilities for dynamic content

### Frontend Implementation
- Type-safe database integration throughout application
- Performance-optimized data fetching with caching
- Error handling and loading states for all data operations
- Search and filter functionality integrated with database

### Testing Strategy (TDD Approach)
- Test-driven development for all data fetching functions
- Performance testing for database integration
- Error scenario testing for robust application behavior
- End-to-end testing with real database operations

## Success Metrics
- **Technical:** All data operations working smoothly with type safety
- **Performance:** Database integration maintains application performance standards
- **Quality:** Comprehensive test coverage for all data fetching scenarios
- **User Experience:** Seamless transition from static to dynamic content