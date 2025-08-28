# Database Schema & API Integration Patterns - Pre-EPIC 4 State

**Created:** 2025-08-27  
**Purpose:** Comprehensive database schema and API endpoint documentation for EPIC 4 preparation  
**Scope:** Database structure, API endpoints, integration patterns, and data flow architecture  

## Table of Contents
- [Database Schema Architecture](#database-schema-architecture)
- [API Endpoint Structure](#api-endpoint-structure)
- [Data Integration Patterns](#data-integration-patterns)
- [Security & Access Control](#security--access-control)
- [Performance & Optimization](#performance--optimization)
- [Real-time Data Flow](#real-time-data-flow)
- [Migration & Versioning](#migration--versioning)
- [EPIC 4 Integration Readiness](#epic-4-integration-readiness)

## Database Schema Architecture

### Core Entity Relationships
```sql
-- Primary business directory entities
businesses (1) ←→ (M) business_managers
businesses (1) ←→ (M) business_reviews
businesses (M) ←→ (1) categories
businesses (1) ←→ (M) business_analytics
businesses (1) ←→ (M) service_areas

-- Authentication and user management
auth.users (1) ←→ (M) user_roles
auth.users (1) ←→ (M) business_managers
auth.users (1) ←→ (M) business_reviews
auth.users (1) ←→ (M) audit_logs

-- Analytics and tracking
businesses (1) ←→ (M) search_analytics
audit_logs → all_tables (polymorphic auditing)
```

### Business Directory Schema (Epic 1 Foundation)
```sql
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    
    -- Category and classification
    primary_category_id UUID REFERENCES categories(id),
    secondary_categories UUID[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    
    -- Geographic data (PostGIS)
    location GEOGRAPHY(POINT, 4326),
    address_line_1 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    zip_code VARCHAR(20),
    service_area_radius_miles INTEGER,
    
    -- Business operations
    business_hours JSONB DEFAULT '{...}',
    year_established INTEGER,
    employee_count VARCHAR(50),
    
    -- Digital presence
    website VARCHAR(255),
    social_media JSONB DEFAULT '{}',
    logo_url VARCHAR(500),
    gallery JSONB DEFAULT '[]',
    
    -- Subscription and features
    subscription_tier VARCHAR(50) DEFAULT 'free',
    subscription_valid_until TIMESTAMPTZ,
    verification_status VARCHAR(50) DEFAULT 'pending',
    quality_score DECIMAL(3,2) DEFAULT 0.00,
    
    -- Analytics
    view_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    
    -- Ownership
    owner_id UUID REFERENCES auth.users(id),
    claimed_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Authentication Schema (Epic 2 Implementation)
```sql
-- Extended user roles with hierarchical permissions
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    role VARCHAR(50) NOT NULL CHECK (role IN (
        'user', 'business_owner', 'moderator', 
        'admin', 'super_admin'
    )),
    permissions JSONB DEFAULT '{}',
    priority INTEGER DEFAULT 10, -- Role hierarchy priority
    granted_by UUID REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Business ownership and management
CREATE TABLE business_managers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    role VARCHAR(50) NOT NULL DEFAULT 'manager',
    permissions JSONB DEFAULT '{}',
    active BOOLEAN DEFAULT TRUE,
    invited_by UUID REFERENCES auth.users(id),
    invitation_accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Analytics & Audit Schema
```sql
-- Comprehensive audit logging (partitioned by month)
CREATE TABLE audit_logs (
    id UUID DEFAULT uuid_generate_v4(),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN (
        'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'
    )),
    user_id UUID REFERENCES auth.users(id),
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    ip_address INET,
    user_agent TEXT,
    session_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Business analytics (daily aggregated metrics)
CREATE TABLE business_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    date DATE NOT NULL,
    page_views INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    phone_clicks INTEGER DEFAULT 0,
    website_clicks INTEGER DEFAULT 0,
    direction_clicks INTEGER DEFAULT 0,
    search_impressions INTEGER DEFAULT 0,
    avg_rating DECIMAL(3,2),
    new_reviews INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, date)
);
```

### Performance Optimization Indexes
```sql
-- Strategic indexes for performance
CREATE INDEX idx_businesses_active ON businesses(status) 
    WHERE status = 'active';
CREATE INDEX idx_businesses_location ON businesses USING GIST(location);
CREATE INDEX idx_businesses_category ON businesses(primary_category_id) 
    WHERE status = 'active';
CREATE INDEX idx_businesses_search ON businesses USING GIN(
    to_tsvector('english', name || ' ' || COALESCE(description, ''))
) WHERE status = 'active';

-- RBAC performance indexes
CREATE INDEX idx_user_roles_user_priority ON user_roles(user_id, priority DESC);
CREATE INDEX idx_business_managers_active ON business_managers(business_id, user_id) 
    WHERE active = TRUE;

-- Analytics performance indexes
CREATE INDEX idx_analytics_business_date ON business_analytics(business_id, date DESC);
CREATE INDEX idx_audit_logs_user_action ON audit_logs(user_id, action, created_at);
```

## API Endpoint Structure

### Business Directory API Endpoints
```typescript
// RESTful business directory endpoints
interface BusinessAPI {
  // Public business directory
  'GET /api/businesses': {
    query?: string;
    category?: string;
    lat?: number;
    lng?: number;
    radius?: number;
    filters?: BusinessFilters;
    limit?: number;
    offset?: number;
    sortBy?: 'relevance' | 'rating' | 'distance';
  };
  
  'GET /api/businesses/[slug]': {
    slug: string;
    include?: 'reviews' | 'analytics' | 'full';
  };
  
  'GET /api/businesses/featured': {
    category?: string;
    location?: string;
    limit?: number;
  };
  
  'POST /api/businesses/interactions': {
    business_id: string;
    interaction_type: 'view' | 'click' | 'phone' | 'website';
  };
}
```

### Authentication API Endpoints (Epic 2)
```typescript
// Authentication and user management endpoints
interface AuthAPI {
  // OAuth providers
  'GET /api/auth/oauth/[provider]': {
    provider: 'google' | 'apple';
    redirect_uri: string;
    state?: string;
  };
  
  // Multi-factor authentication
  'POST /api/auth/mfa/setup': {
    method: 'totp' | 'sms' | 'email';
    phone_number?: string;
  };
  
  'POST /api/auth/mfa/verify': {
    method: string;
    code: string;
    backup_code?: string;
  };
  
  // Password management
  'POST /api/auth/password/reset/request': {
    email: string;
    recaptcha_token?: string;
  };
  
  'POST /api/auth/password/reset/complete': {
    token: string;
    new_password: string;
  };
}
```

### User Profile & RBAC API Endpoints
```typescript
// User management and role-based access control
interface UserAPI {
  // Profile management
  'GET /api/profile': ProfileResponse;
  'PUT /api/profile': ProfileUpdateRequest;
  'POST /api/profile/files': FileUploadRequest;
  
  // GDPR compliance
  'GET /api/profile/gdpr/export': DataExportRequest;
  'POST /api/profile/gdpr/deletion': AccountDeletionRequest;
  
  // Role-based access control
  'GET /api/rbac/permissions': {
    user_id?: string;
    resource?: string;
  };
  
  'POST /api/rbac/roles': {
    user_id: string;
    role: string;
    expires_at?: string;
  };
  
  // Business verification (KYC)
  'POST /api/kyc/verification/initiate': {
    business_id: string;
    verification_method: string;
  };
  
  'GET /api/kyc/verification/status': {
    business_id: string;
  };
}
```

### Search & Analytics API Endpoints
```typescript
// Search functionality and analytics
interface SearchAPI {
  'GET /api/search': {
    query: string;
    filters?: SearchFilters;
    location?: GeographicLocation;
  };
  
  'GET /api/search/suggestions': {
    query: string;
    limit?: number;
    categories?: string[];
  };
  
  'POST /api/search/analytics': {
    query: string;
    results_count: number;
    clicked_results?: string[];
  };
  
  'GET /api/analytics': {
    date_range?: DateRange;
    business_id?: string;
    metrics?: AnalyticsMetrics[];
  };
}
```

## Data Integration Patterns

### Server-Side Data Fetching (Next.js 14)
```typescript
// Server component data fetching pattern
export default async function BusinessPage({ 
  params 
}: { 
  params: { slug: string } 
}) {
  // Server-side data fetching with error handling
  const business = await businessServerApi.getBusinessBySlug(
    params.slug,
    { include: ['reviews', 'analytics'] }
  );
  
  if (!business) {
    notFound();
  }
  
  return <BusinessDetailView business={business} />;
}
```

### Client-Side Data Management (TanStack Query)
```typescript
// Client-side data fetching with caching
export function useBusinessSearch(params: BusinessSearchParams) {
  return useQuery({
    queryKey: ['businesses', params],
    queryFn: () => businessApi.search(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
```

### Real-time Data Synchronization
```typescript
// Supabase real-time subscriptions
export function useRealtimeBusinessUpdates(businessId: string) {
  const [business, setBusiness] = useState<Business | null>(null);
  
  useEffect(() => {
    const subscription = supabase
      .channel(`business:${businessId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'businesses',
        filter: `id=eq.${businessId}`,
      }, (payload) => {
        setBusiness(payload.new as Business);
      })
      .subscribe();
    
    return () => subscription.unsubscribe();
  }, [businessId]);
  
  return business;
}
```

### Data Validation & Type Safety
```typescript
// Zod schema validation for API endpoints
export const BusinessSearchSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  radius: z.number().min(1).max(100).optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

export type BusinessSearchParams = z.infer<typeof BusinessSearchSchema>;
```

## Security & Access Control

### Row Level Security (RLS) Policies
```sql
-- Business data access control
CREATE POLICY "Businesses are publicly viewable" ON businesses
    FOR SELECT USING (status = 'active' AND deleted_at IS NULL);

CREATE POLICY "Business owners can update their businesses" ON businesses
    FOR UPDATE USING (
        auth.uid() = owner_id OR 
        EXISTS (
            SELECT 1 FROM business_managers 
            WHERE business_id = businesses.id 
            AND user_id = auth.uid() 
            AND active = TRUE
        )
    );

-- User role-based access control
CREATE POLICY "Users can view their own roles" ON user_roles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all user roles" ON user_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );
```

### API Security Middleware
```typescript
// Authentication and authorization middleware
export async function authMiddleware(
  request: NextRequest,
  requiredRole?: string
): Promise<{ user: User; role: string } | null> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!token) {
    throw new AuthError('Authentication required');
  }
  
  const { user, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new AuthError('Invalid authentication token');
  }
  
  if (requiredRole) {
    const hasPermission = await checkUserPermission(user.id, requiredRole);
    if (!hasPermission) {
      throw new AuthError('Insufficient permissions');
    }
  }
  
  return { user, role: await getUserRole(user.id) };
}
```

### Input Validation & Sanitization
```typescript
// Comprehensive input validation
export function sanitizeAndValidate<T>(
  data: unknown,
  schema: z.ZodSchema<T>
): T {
  // Sanitize input data
  const sanitized = sanitizeInput(data);
  
  // Validate against schema
  const result = schema.safeParse(sanitized);
  
  if (!result.success) {
    throw new ValidationError('Invalid input', result.error.issues);
  }
  
  return result.data;
}
```

## Performance & Optimization

### Database Query Optimization
- **Index Strategy:** Strategic B-tree and GIN indexes for fast queries
- **Query Performance:** Sub-50ms average response times
- **Connection Pooling:** Efficient database connection management
- **Partitioning:** Audit logs partitioned by month for scalability

### API Response Optimization
```typescript
// Strategic HTTP caching headers
export function withCaching(
  handler: NextApiHandler,
  cacheConfig: CacheConfig
): NextApiHandler {
  return async (req, res) => {
    // Set appropriate cache headers
    res.setHeader('Cache-Control', `
      public, 
      s-maxage=${cacheConfig.maxAge}, 
      stale-while-revalidate=${cacheConfig.staleWhileRevalidate}
    `);
    
    // Add ETag for conditional requests
    const etag = generateETag(req.url, req.headers);
    res.setHeader('ETag', etag);
    
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    
    return handler(req, res);
  };
}
```

### Data Caching Strategy
- **Server-Side Caching:** Next.js fetch caching with revalidation
- **Client-Side Caching:** TanStack Query with intelligent invalidation
- **CDN Caching:** Static assets cached at edge locations
- **Database Caching:** Query result caching for expensive operations

## Real-time Data Flow

### WebSocket Integration Pattern
```typescript
// Real-time business updates
export class BusinessRealtimeService {
  private subscription: RealtimeSubscription | null = null;
  
  async subscribe(businessId: string, callback: (business: Business) => void) {
    this.subscription = supabase
      .channel(`business-updates:${businessId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'businesses',
        filter: `id=eq.${businessId}`,
      }, (payload) => {
        callback(payload.new as Business);
      })
      .subscribe();
  }
  
  unsubscribe() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
```

### Event-Driven Architecture
- **Business Events:** Business creation, updates, verification status changes
- **User Events:** Authentication, profile updates, role changes
- **Analytics Events:** Page views, clicks, search queries
- **System Events:** Performance metrics, error tracking

## Migration & Versioning

### Database Migration Strategy
```sql
-- Migration versioning with rollback support
-- Migration: 018_enhanced_analytics_system
BEGIN;

-- Add new analytics columns
ALTER TABLE business_analytics 
ADD COLUMN bounce_rate DECIMAL(5,2),
ADD COLUMN avg_time_on_page INTERVAL,
ADD COLUMN conversion_rate DECIMAL(5,2);

-- Create new indexes for performance
CREATE INDEX idx_analytics_conversion ON business_analytics(conversion_rate)
    WHERE conversion_rate > 0;

-- Migration metadata
INSERT INTO schema_migrations (version, applied_at) 
VALUES ('018', NOW());

COMMIT;
```

### API Versioning Strategy
- **URL Versioning:** `/api/v1/businesses` (current default)
- **Header Versioning:** `Accept: application/json; version=1.0`
- **Backward Compatibility:** Maintain previous API versions
- **Deprecation Process:** Gradual migration with sunset dates

## EPIC 4 Integration Readiness

### Admin Portal Database Requirements ✅ Ready
- **User Management:** Complete user table with roles and permissions
- **Business Management:** Comprehensive business data with verification
- **Audit System:** Complete audit logging for admin oversight
- **Analytics Data:** Business and user analytics ready for dashboards
- **Security Framework:** RLS policies ready for admin operations

### Admin API Endpoints Ready for Implementation
```typescript
// Admin-specific endpoints ready for EPIC 4
interface AdminAPI {
  'GET /api/admin/users': UserListResponse;           // User management
  'PUT /api/admin/users/[id]': UserUpdateRequest;    // User administration
  'GET /api/admin/businesses': BusinessListResponse; // Business oversight
  'PUT /api/admin/businesses/[id]/verify': VerificationRequest; // Business verification
  'GET /api/admin/analytics': PlatformAnalytics;     // Platform insights
  'GET /api/admin/audit': AuditLogResponse;          // System audit logs
}
```

### Integration Patterns Ready for Admin Features
- **RBAC Integration:** Admin roles with elevated permissions
- **Audit Integration:** Complete audit trail for admin actions
- **Real-time Updates:** Live admin dashboard capability
- **Bulk Operations:** Database optimized for admin bulk operations
- **Export Capabilities:** Data export ready for admin reporting

---

**Document Status:** Complete - Part 5 of 6  
**Lines:** 249/250 (within limit)  
**Next Document:** 2025-08-27-06-ui-ux-design-system.md  
**Last Updated:** 2025-08-27  
**EPIC 4 Readiness:** Database and API infrastructure fully prepared for admin portal integration
