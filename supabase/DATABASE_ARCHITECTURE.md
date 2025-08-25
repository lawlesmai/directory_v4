# Supabase Database Architecture for The Lawless Directory

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Database Schema Design](#database-schema-design)
3. [Performance Optimization Strategy](#performance-optimization-strategy)
4. [Security Implementation](#security-implementation)
5. [Migration Strategy](#migration-strategy)
6. [Integration Guide](#integration-guide)
7. [Monitoring & Maintenance](#monitoring--maintenance)

## Architecture Overview

### System Architecture Diagram

```mermaid
graph TB
    subgraph "Frontend Layer"
        NX[Next.js App]
        RC[React Components]
        TQ[TanStack Query]
    end
    
    subgraph "API Layer"
        SC[Supabase Client]
        RT[Real-time Subscriptions]
        ST[Storage API]
    end
    
    subgraph "Database Layer"
        PG[(PostgreSQL 15+)]
        PG --> PS[PostGIS Extension]
        PG --> FT[Full-Text Search]
        PG --> RLS[Row Level Security]
        PG --> TR[Triggers & Functions]
    end
    
    subgraph "Cache Layer"
        MC[Materialized Views]
        QC[Query Cache]
        CP[Connection Pool]
    end
    
    NX --> SC
    RC --> TQ
    TQ --> SC
    SC --> CP
    CP --> PG
    PG --> MC
    PG --> QC
    RT --> PG
    ST --> PG
```

### Entity Relationship Diagram

```mermaid
erDiagram
    BUSINESSES ||--o{ BUSINESS_REVIEWS : has
    BUSINESSES ||--o{ BUSINESS_MANAGERS : managed_by
    BUSINESSES ||--|| CATEGORIES : belongs_to
    BUSINESSES ||--o{ BUSINESS_ANALYTICS : tracks
    BUSINESSES ||--o{ SERVICE_AREAS : serves
    BUSINESSES ||--o{ BUSINESS_MEDIA : contains
    
    USERS ||--o{ BUSINESS_REVIEWS : writes
    USERS ||--o{ BUSINESSES : owns
    USERS ||--o{ USER_ROLES : has
    USERS ||--o{ USER_PREFERENCES : configures
    
    BUSINESS_REVIEWS ||--o| REVIEW_RESPONSES : receives
    BUSINESS_REVIEWS ||--o{ REVIEW_MEDIA : includes
    
    CATEGORIES ||--o{ CATEGORIES : contains
    
    BUSINESSES {
        uuid id PK
        string slug UK
        string name
        uuid primary_category_id FK
        geography location
        jsonb business_hours
        string subscription_tier
        decimal quality_score
        timestamp created_at
        timestamp updated_at
    }
    
    CATEGORIES {
        uuid id PK
        uuid parent_id FK
        string slug UK
        string name
        integer level
        text[] path
    }
    
    BUSINESS_REVIEWS {
        uuid id PK
        uuid business_id FK
        uuid reviewer_id FK
        integer rating
        text content
        decimal sentiment_score
        timestamp created_at
    }
    
    USERS {
        uuid id PK
        string email UK
        string name
        jsonb preferences
        timestamp created_at
    }
```

## Database Schema Design

### Core Business Tables

#### 1. Businesses Table (Primary Entity)

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Main businesses table with comprehensive fields
CREATE TABLE businesses (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    description TEXT,
    short_description VARCHAR(500),
    
    -- Category hierarchy
    primary_category_id UUID REFERENCES categories(id),
    secondary_categories UUID[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    
    -- Contact information
    phone VARCHAR(20),
    phone_verified BOOLEAN DEFAULT FALSE,
    email VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE,
    website VARCHAR(255),
    
    -- Location data with PostGIS
    address_line_1 VARCHAR(255),
    address_line_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    zip_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'United States',
    location GEOGRAPHY(POINT, 4326),
    service_area_radius_miles INTEGER,
    
    -- Business details
    business_hours JSONB DEFAULT '{}',
    special_hours JSONB DEFAULT '{}',
    year_established INTEGER,
    employee_count VARCHAR(50),
    annual_revenue VARCHAR(50),
    
    -- Media and branding
    logo_url VARCHAR(500),
    cover_image_url VARCHAR(500),
    gallery JSONB DEFAULT '[]',
    video_urls JSONB DEFAULT '[]',
    brand_colors JSONB DEFAULT '{}',
    
    -- Social and external platforms
    social_media JSONB DEFAULT '{}',
    external_platforms JSONB DEFAULT '{}',
    
    -- Verification and quality
    verification_status VARCHAR(50) DEFAULT 'pending',
    verification_date TIMESTAMPTZ,
    verification_documents JSONB DEFAULT '[]',
    trust_signals JSONB DEFAULT '{}',
    quality_score DECIMAL(3,2) DEFAULT 0.00,
    
    -- Subscription and features
    subscription_tier VARCHAR(50) DEFAULT 'free',
    subscription_valid_until TIMESTAMPTZ,
    premium_features JSONB DEFAULT '{}',
    featured_until TIMESTAMPTZ,
    boost_credits INTEGER DEFAULT 0,
    
    -- Analytics and metrics
    view_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    save_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- SEO and content
    meta_title VARCHAR(255),
    meta_description VARCHAR(500),
    meta_keywords TEXT[],
    custom_attributes JSONB DEFAULT '{}',
    
    -- Status and lifecycle
    status VARCHAR(50) DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    suspended_at TIMESTAMPTZ,
    suspension_reason TEXT,
    deleted_at TIMESTAMPTZ,
    
    -- Ownership
    owner_id UUID REFERENCES auth.users(id),
    claimed_at TIMESTAMPTZ,
    claim_token VARCHAR(255),
    transfer_token VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_location CHECK (
        (location IS NULL) OR 
        (ST_X(location::geometry) BETWEEN -180 AND 180 AND 
         ST_Y(location::geometry) BETWEEN -90 AND 90)
    ),
    CONSTRAINT valid_quality_score CHECK (quality_score >= 0 AND quality_score <= 5),
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
    CONSTRAINT valid_phone CHECK (phone ~* '^\+?[1-9]\d{1,14}$' OR phone IS NULL),
    CONSTRAINT valid_year_established CHECK (year_established >= 1800 AND year_established <= EXTRACT(YEAR FROM CURRENT_DATE))
);
```

#### 2. Categories Table (Hierarchical Structure)

```sql
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    image_url VARCHAR(500),
    color VARCHAR(7),
    
    -- Hierarchy helpers
    level INTEGER DEFAULT 0,
    path TEXT[],
    path_slugs TEXT[],
    children_count INTEGER DEFAULT 0,
    business_count INTEGER DEFAULT 0,
    
    -- Display settings
    sort_order INTEGER DEFAULT 0,
    featured BOOLEAN DEFAULT FALSE,
    show_in_navigation BOOLEAN DEFAULT TRUE,
    show_in_directory BOOLEAN DEFAULT TRUE,
    
    -- SEO
    meta_title VARCHAR(255),
    meta_description VARCHAR(500),
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_color CHECK (color ~* '^#[0-9A-Fa-f]{6}$' OR color IS NULL)
);
```

#### 3. Business Reviews Table

```sql
CREATE TABLE business_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES auth.users(id),
    
    -- Review content
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title VARCHAR(255),
    content TEXT NOT NULL CHECK (LENGTH(content) >= 10),
    
    -- Review metadata
    visit_date DATE,
    verification_type VARCHAR(50),
    verification_data JSONB,
    
    -- Media
    photos JSONB DEFAULT '[]',
    videos JSONB DEFAULT '[]',
    
    -- Engagement metrics
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    
    -- Moderation
    status VARCHAR(50) DEFAULT 'pending',
    moderation_notes TEXT,
    flagged_count INTEGER DEFAULT 0,
    flag_reasons JSONB DEFAULT '[]',
    
    -- ML/AI features
    sentiment_score DECIMAL(3,2),
    topics TEXT[],
    language VARCHAR(10) DEFAULT 'en',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    
    -- Ensure one review per user per business
    CONSTRAINT unique_user_business_review UNIQUE (business_id, reviewer_id, deleted_at)
);
```

### Supporting Tables

#### 4. Business Review Responses

```sql
CREATE TABLE business_review_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL UNIQUE REFERENCES business_reviews(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    responder_id UUID NOT NULL REFERENCES auth.users(id),
    content TEXT NOT NULL CHECK (LENGTH(content) >= 10),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 5. Business Managers

```sql
CREATE TABLE business_managers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'manager',
    permissions JSONB DEFAULT '{}',
    invited_by UUID REFERENCES auth.users(id),
    invitation_accepted_at TIMESTAMPTZ,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_business_user UNIQUE (business_id, user_id)
);
```

#### 6. User Roles

```sql
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    permissions JSONB DEFAULT '{}',
    granted_by UUID REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_user_role UNIQUE (user_id, role)
);
```

### Analytics Tables

#### 7. Business Analytics

```sql
CREATE TABLE business_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- View metrics
    page_views INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    avg_time_on_page INTERVAL,
    bounce_rate DECIMAL(5,2),
    
    -- Engagement metrics
    phone_clicks INTEGER DEFAULT 0,
    website_clicks INTEGER DEFAULT 0,
    direction_clicks INTEGER DEFAULT 0,
    share_clicks INTEGER DEFAULT 0,
    save_clicks INTEGER DEFAULT 0,
    
    -- Review metrics
    new_reviews INTEGER DEFAULT 0,
    avg_rating DECIMAL(3,2),
    
    -- Search metrics
    search_impressions INTEGER DEFAULT 0,
    search_clicks INTEGER DEFAULT 0,
    search_position DECIMAL(5,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_business_date UNIQUE (business_id, date)
);
```

#### 8. Search Analytics

```sql
CREATE TABLE search_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query TEXT NOT NULL,
    category_filter UUID REFERENCES categories(id),
    location_filter GEOGRAPHY(POINT, 4326),
    radius_filter INTEGER,
    results_count INTEGER,
    clicked_results UUID[],
    user_id UUID REFERENCES auth.users(id),
    session_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Audit Tables

#### 9. Audit Logs

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    
    -- Change tracking
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    request_id UUID,
    session_id UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE audit_logs_2025_02 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- Continue for all months...
```

## Performance Optimization Strategy

### Index Strategy

```sql
-- Primary indexes for businesses table
CREATE INDEX idx_businesses_slug ON businesses(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_businesses_status ON businesses(status) WHERE status = 'active';
CREATE INDEX idx_businesses_location ON businesses USING GIST(location);
CREATE INDEX idx_businesses_category ON businesses(primary_category_id) WHERE status = 'active';
CREATE INDEX idx_businesses_city_state ON businesses(city, state) WHERE status = 'active';
CREATE INDEX idx_businesses_owner ON businesses(owner_id);
CREATE INDEX idx_businesses_subscription ON businesses(subscription_tier) WHERE subscription_tier != 'free';
CREATE INDEX idx_businesses_featured ON businesses(featured_until) WHERE featured_until > NOW();

-- Full-text search indexes
CREATE INDEX idx_businesses_search ON businesses USING GIN(
    to_tsvector('english', 
        coalesce(name, '') || ' ' || 
        coalesce(description, '') || ' ' ||
        coalesce(array_to_string(tags, ' '), '')
    )
) WHERE status = 'active';

-- Category indexes
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_path ON categories USING GIN(path);

-- Review indexes
CREATE INDEX idx_reviews_business ON business_reviews(business_id) WHERE status = 'published';
CREATE INDEX idx_reviews_reviewer ON business_reviews(reviewer_id);
CREATE INDEX idx_reviews_rating ON business_reviews(rating) WHERE status = 'published';
CREATE INDEX idx_reviews_created ON business_reviews(created_at DESC) WHERE status = 'published';

-- Analytics indexes
CREATE INDEX idx_analytics_business_date ON business_analytics(business_id, date DESC);
CREATE INDEX idx_search_analytics_query ON search_analytics USING GIN(to_tsvector('english', query));
```

### Materialized Views for Performance

```sql
-- Business statistics materialized view
CREATE MATERIALIZED VIEW business_stats AS
SELECT 
    b.id,
    b.slug,
    b.name,
    b.primary_category_id,
    COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'published') as review_count,
    AVG(r.rating) FILTER (WHERE r.status = 'published') as avg_rating,
    COUNT(DISTINCT r.id) FILTER (WHERE r.created_at > NOW() - INTERVAL '30 days' AND r.status = 'published') as recent_reviews,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY r.rating) FILTER (WHERE r.status = 'published') as median_rating,
    MAX(r.created_at) FILTER (WHERE r.status = 'published') as last_review_date
FROM businesses b
LEFT JOIN business_reviews r ON b.id = r.business_id
WHERE b.status = 'active' AND b.deleted_at IS NULL
GROUP BY b.id, b.slug, b.name, b.primary_category_id
WITH DATA;

CREATE UNIQUE INDEX ON business_stats(id);
CREATE INDEX ON business_stats(avg_rating DESC NULLS LAST);
CREATE INDEX ON business_stats(review_count DESC);

-- Category business counts
CREATE MATERIALIZED VIEW category_business_counts AS
WITH RECURSIVE category_tree AS (
    SELECT 
        id,
        parent_id,
        slug,
        name,
        ARRAY[id] as path_ids
    FROM categories
    WHERE parent_id IS NULL
    
    UNION ALL
    
    SELECT 
        c.id,
        c.parent_id,
        c.slug,
        c.name,
        ct.path_ids || c.id
    FROM categories c
    JOIN category_tree ct ON c.parent_id = ct.id
)
SELECT 
    ct.id,
    ct.slug,
    ct.name,
    COUNT(DISTINCT b.id) as direct_business_count,
    COUNT(DISTINCT CASE WHEN b.primary_category_id = ANY(ct.path_ids) THEN b.id END) as total_business_count
FROM category_tree ct
LEFT JOIN businesses b ON b.primary_category_id = ct.id AND b.status = 'active' AND b.deleted_at IS NULL
GROUP BY ct.id, ct.slug, ct.name
WITH DATA;

CREATE UNIQUE INDEX ON category_business_counts(id);
```

### Query Optimization Functions

```sql
-- Optimized nearby businesses search
CREATE OR REPLACE FUNCTION find_nearby_businesses(
    user_location GEOGRAPHY,
    radius_meters INTEGER DEFAULT 5000,
    category_filter UUID DEFAULT NULL,
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    slug VARCHAR,
    name VARCHAR,
    description TEXT,
    category_name VARCHAR,
    distance_meters FLOAT,
    bearing_degrees FLOAT,
    rating DECIMAL,
    review_count BIGINT,
    is_premium BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id,
        b.slug,
        b.name,
        b.short_description as description,
        c.name as category_name,
        ST_Distance(b.location, user_location) as distance_meters,
        degrees(ST_Azimuth(user_location, b.location)) as bearing_degrees,
        bs.avg_rating as rating,
        bs.review_count,
        b.subscription_tier != 'free' as is_premium
    FROM businesses b
    LEFT JOIN categories c ON b.primary_category_id = c.id
    LEFT JOIN business_stats bs ON b.id = bs.id
    WHERE 
        ST_DWithin(b.location, user_location, radius_meters)
        AND b.status = 'active'
        AND b.deleted_at IS NULL
        AND (category_filter IS NULL OR b.primary_category_id = category_filter)
    ORDER BY 
        b.subscription_tier != 'free' DESC,
        ST_Distance(b.location, user_location),
        bs.avg_rating DESC NULLS LAST
    LIMIT limit_count
    OFFSET offset_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Optimized search function with relevance ranking
CREATE OR REPLACE FUNCTION search_businesses(
    search_query TEXT,
    category_filter UUID DEFAULT NULL,
    location_filter GEOGRAPHY DEFAULT NULL,
    radius_meters INTEGER DEFAULT 10000,
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    slug VARCHAR,
    name VARCHAR,
    description TEXT,
    category_name VARCHAR,
    relevance_score FLOAT,
    distance_meters FLOAT,
    rating DECIMAL,
    review_count BIGINT,
    is_premium BOOLEAN
) AS $$
DECLARE
    tsquery_value tsquery;
BEGIN
    -- Convert search query to tsquery
    tsquery_value := plainto_tsquery('english', search_query);
    
    RETURN QUERY
    WITH search_results AS (
        SELECT 
            b.id,
            b.slug,
            b.name,
            b.short_description as description,
            c.name as category_name,
            ts_rank_cd(
                to_tsvector('english', 
                    coalesce(b.name, '') || ' ' || 
                    coalesce(b.description, '') || ' ' ||
                    coalesce(array_to_string(b.tags, ' '), '')
                ),
                tsquery_value,
                32
            ) as text_rank,
            similarity(b.name, search_query) as name_similarity,
            CASE 
                WHEN location_filter IS NOT NULL 
                THEN ST_Distance(b.location, location_filter)
                ELSE 0
            END as distance,
            bs.avg_rating as rating,
            bs.review_count,
            b.subscription_tier != 'free' as is_premium
        FROM businesses b
        LEFT JOIN categories c ON b.primary_category_id = c.id
        LEFT JOIN business_stats bs ON b.id = bs.id
        WHERE 
            (
                to_tsvector('english', 
                    coalesce(b.name, '') || ' ' || 
                    coalesce(b.description, '') || ' ' ||
                    coalesce(array_to_string(b.tags, ' '), '')
                ) @@ tsquery_value
                OR b.name ILIKE '%' || search_query || '%'
            )
            AND b.status = 'active'
            AND b.deleted_at IS NULL
            AND (category_filter IS NULL OR b.primary_category_id = category_filter)
            AND (location_filter IS NULL OR ST_DWithin(b.location, location_filter, radius_meters))
    )
    SELECT 
        id,
        slug,
        name,
        description,
        category_name,
        (text_rank * 0.6 + name_similarity * 0.4) as relevance_score,
        distance as distance_meters,
        rating,
        review_count,
        is_premium
    FROM search_results
    ORDER BY 
        is_premium DESC,
        (text_rank * 0.6 + name_similarity * 0.4) DESC,
        distance ASC,
        rating DESC NULLS LAST
    LIMIT limit_count
    OFFSET offset_count;
END;
$$ LANGUAGE plpgsql STABLE;
```

## Security Implementation

### Row Level Security Policies

```sql
-- Enable RLS on all tables
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_review_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_analytics ENABLE ROW LEVEL SECURITY;

-- Businesses table policies
CREATE POLICY businesses_public_read ON businesses
    FOR SELECT
    USING (
        status = 'active' 
        AND deleted_at IS NULL
        AND (suspended_at IS NULL OR suspended_at > NOW())
    );

CREATE POLICY businesses_owner_all ON businesses
    FOR ALL
    USING (
        auth.uid() = owner_id
        OR EXISTS (
            SELECT 1 FROM business_managers 
            WHERE business_id = businesses.id 
            AND user_id = auth.uid()
            AND active = true
        )
    );

CREATE POLICY businesses_insert_authenticated ON businesses
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND (owner_id = auth.uid() OR owner_id IS NULL)
    );

-- Business reviews policies
CREATE POLICY reviews_public_read ON business_reviews
    FOR SELECT
    USING (
        status = 'published' 
        AND deleted_at IS NULL
    );

CREATE POLICY reviews_author_all ON business_reviews
    FOR ALL
    USING (
        reviewer_id = auth.uid()
    );

CREATE POLICY reviews_insert_authenticated ON business_reviews
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND reviewer_id = auth.uid()
        AND NOT EXISTS (
            SELECT 1 FROM business_reviews
            WHERE business_id = NEW.business_id
            AND reviewer_id = auth.uid()
            AND deleted_at IS NULL
        )
    );

-- Review responses policies
CREATE POLICY responses_public_read ON business_review_responses
    FOR SELECT
    USING (status = 'active');

CREATE POLICY responses_business_owner_insert ON business_review_responses
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM businesses
            WHERE id = business_id
            AND (
                owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM business_managers
                    WHERE business_id = businesses.id
                    AND user_id = auth.uid()
                    AND active = true
                )
            )
        )
    );

-- Admin policies
CREATE POLICY admin_full_access_businesses ON businesses
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
            AND (expires_at IS NULL OR expires_at > NOW())
        )
    );

CREATE POLICY admin_full_access_reviews ON business_reviews
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'moderator')
            AND (expires_at IS NULL OR expires_at > NOW())
        )
    );
```

### Security Helper Functions

```sql
-- Check if user has a specific role
CREATE OR REPLACE FUNCTION auth.has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role = required_role
        AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user owns or manages a business
CREATE OR REPLACE FUNCTION auth.can_manage_business(business_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM businesses
        WHERE id = business_uuid
        AND owner_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM business_managers
        WHERE business_id = business_uuid
        AND user_id = auth.uid()
        AND active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log security events
CREATE OR REPLACE FUNCTION log_security_event(
    event_type TEXT,
    event_data JSONB,
    severity TEXT DEFAULT 'info'
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        user_id,
        new_values,
        ip_address,
        created_at
    ) VALUES (
        'security_events',
        gen_random_uuid(),
        event_type,
        auth.uid(),
        jsonb_build_object(
            'event_data', event_data,
            'severity', severity,
            'timestamp', NOW()
        ),
        current_setting('request.headers', true)::jsonb->>'x-forwarded-for',
        NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Trigger Functions

```sql
-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_businesses_updated_at
    BEFORE UPDATE ON businesses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_reviews_updated_at
    BEFORE UPDATE ON business_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Update category path when parent changes
CREATE OR REPLACE FUNCTION update_category_path()
RETURNS TRIGGER AS $$
DECLARE
    parent_path TEXT[];
    parent_level INTEGER;
BEGIN
    IF NEW.parent_id IS NULL THEN
        NEW.path = ARRAY[NEW.name];
        NEW.path_slugs = ARRAY[NEW.slug];
        NEW.level = 0;
    ELSE
        SELECT path, path_slugs, level 
        INTO parent_path, NEW.path_slugs, parent_level
        FROM categories 
        WHERE id = NEW.parent_id;
        
        NEW.path = parent_path || NEW.name;
        NEW.path_slugs = NEW.path_slugs || NEW.slug;
        NEW.level = parent_level + 1;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_category_path_trigger
    BEFORE INSERT OR UPDATE OF parent_id, name, slug ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_category_path();

-- Update business quality score
CREATE OR REPLACE FUNCTION update_business_quality_score()
RETURNS TRIGGER AS $$
DECLARE
    new_score DECIMAL(3,2);
BEGIN
    SELECT 
        LEAST(5.0, GREATEST(0.0,
            (AVG(rating) * 0.4) +
            (LEAST(COUNT(*), 50) / 50.0 * 0.3) +
            (CASE WHEN b.verification_status = 'verified' THEN 1.0 ELSE 0.0 END * 0.2) +
            (CASE WHEN b.subscription_tier != 'free' THEN 1.0 ELSE 0.0 END * 0.1)
        ))
    INTO new_score
    FROM business_reviews r
    JOIN businesses b ON b.id = r.business_id
    WHERE r.business_id = COALESCE(NEW.business_id, OLD.business_id)
    AND r.status = 'published'
    AND r.deleted_at IS NULL
    GROUP BY b.verification_status, b.subscription_tier;
    
    UPDATE businesses 
    SET quality_score = COALESCE(new_score, 0.0)
    WHERE id = COALESCE(NEW.business_id, OLD.business_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_quality_score_on_review
    AFTER INSERT OR UPDATE OR DELETE ON business_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_business_quality_score();

-- Audit log trigger
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (
            table_name, record_id, action, user_id,
            old_values, ip_address
        ) VALUES (
            TG_TABLE_NAME,
            OLD.id,
            TG_OP,
            auth.uid(),
            to_jsonb(OLD),
            current_setting('request.headers', true)::jsonb->>'x-forwarded-for'
        );
        RETURN OLD;
    ELSE
        INSERT INTO audit_logs (
            table_name, record_id, action, user_id,
            old_values, new_values, changed_fields, ip_address
        ) VALUES (
            TG_TABLE_NAME,
            NEW.id,
            TG_OP,
            auth.uid(),
            CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
            to_jsonb(NEW),
            CASE WHEN TG_OP = 'UPDATE' THEN 
                ARRAY(
                    SELECT jsonb_object_keys(to_jsonb(NEW)) 
                    EXCEPT 
                    SELECT jsonb_object_keys(to_jsonb(OLD))
                )
            ELSE NULL END,
            current_setting('request.headers', true)::jsonb->>'x-forwarded-for'
        );
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to critical tables
CREATE TRIGGER audit_businesses
    AFTER INSERT OR UPDATE OR DELETE ON businesses
    FOR EACH ROW
    EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_reviews
    AFTER INSERT OR UPDATE OR DELETE ON business_reviews
    FOR EACH ROW
    EXECUTE FUNCTION create_audit_log();
```

## Migration Strategy

### Initial Migration (001_initial_schema.sql)

```sql
-- Migration: 001_initial_schema
-- Description: Initial database schema for The Lawless Directory
-- Date: 2025-01-24

BEGIN;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Create all tables (as defined above)
-- ... (include all CREATE TABLE statements)

-- Create all indexes
-- ... (include all CREATE INDEX statements)

-- Enable RLS
-- ... (include all ALTER TABLE ENABLE ROW LEVEL SECURITY statements)

-- Create policies
-- ... (include all CREATE POLICY statements)

-- Create functions
-- ... (include all CREATE FUNCTION statements)

-- Create triggers
-- ... (include all CREATE TRIGGER statements)

-- Create materialized views
-- ... (include all CREATE MATERIALIZED VIEW statements)

-- Insert initial data
INSERT INTO categories (slug, name, description, icon, sort_order) VALUES
    ('restaurants', 'Restaurants', 'Dining establishments and food services', 'utensils', 1),
    ('health-medical', 'Health & Medical', 'Healthcare providers and medical services', 'heart', 2),
    ('home-services', 'Home Services', 'Home improvement and maintenance', 'home', 3),
    ('automotive', 'Automotive', 'Auto repair, sales, and services', 'car', 4),
    ('professional', 'Professional Services', 'Business and professional services', 'briefcase', 5),
    ('retail', 'Retail', 'Shopping and retail stores', 'shopping-bag', 6),
    ('beauty-spa', 'Beauty & Spa', 'Beauty, wellness, and spa services', 'sparkles', 7),
    ('education', 'Education', 'Schools, training, and educational services', 'graduation-cap', 8),
    ('entertainment', 'Entertainment', 'Entertainment and recreational activities', 'music', 9),
    ('real-estate', 'Real Estate', 'Real estate services and property management', 'building', 10);

COMMIT;
```

### Rollback Strategy

```sql
-- Rollback: 001_initial_schema
-- Description: Rollback initial database schema

BEGIN;

-- Drop triggers
DROP TRIGGER IF EXISTS update_businesses_updated_at ON businesses CASCADE;
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories CASCADE;
DROP TRIGGER IF EXISTS update_reviews_updated_at ON business_reviews CASCADE;
DROP TRIGGER IF EXISTS update_category_path_trigger ON categories CASCADE;
DROP TRIGGER IF EXISTS update_quality_score_on_review ON business_reviews CASCADE;
DROP TRIGGER IF EXISTS audit_businesses ON businesses CASCADE;
DROP TRIGGER IF EXISTS audit_reviews ON business_reviews CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_category_path() CASCADE;
DROP FUNCTION IF EXISTS update_business_quality_score() CASCADE;
DROP FUNCTION IF EXISTS create_audit_log() CASCADE;
DROP FUNCTION IF EXISTS find_nearby_businesses(GEOGRAPHY, INTEGER, UUID, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS search_businesses(TEXT, UUID, GEOGRAPHY, INTEGER, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS auth.has_role(TEXT) CASCADE;
DROP FUNCTION IF EXISTS auth.can_manage_business(UUID) CASCADE;
DROP FUNCTION IF EXISTS log_security_event(TEXT, JSONB, TEXT) CASCADE;

-- Drop materialized views
DROP MATERIALIZED VIEW IF EXISTS business_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS category_business_counts CASCADE;

-- Drop policies
DROP POLICY IF EXISTS businesses_public_read ON businesses;
DROP POLICY IF EXISTS businesses_owner_all ON businesses;
DROP POLICY IF EXISTS businesses_insert_authenticated ON businesses;
DROP POLICY IF EXISTS reviews_public_read ON business_reviews;
DROP POLICY IF EXISTS reviews_author_all ON business_reviews;
DROP POLICY IF EXISTS reviews_insert_authenticated ON business_reviews;
DROP POLICY IF EXISTS responses_public_read ON business_review_responses;
DROP POLICY IF EXISTS responses_business_owner_insert ON business_review_responses;
DROP POLICY IF EXISTS admin_full_access_businesses ON businesses;
DROP POLICY IF EXISTS admin_full_access_reviews ON business_reviews;

-- Drop indexes
DROP INDEX IF EXISTS idx_businesses_slug;
DROP INDEX IF EXISTS idx_businesses_status;
DROP INDEX IF EXISTS idx_businesses_location;
DROP INDEX IF EXISTS idx_businesses_category;
DROP INDEX IF EXISTS idx_businesses_city_state;
DROP INDEX IF EXISTS idx_businesses_owner;
DROP INDEX IF EXISTS idx_businesses_subscription;
DROP INDEX IF EXISTS idx_businesses_featured;
DROP INDEX IF EXISTS idx_businesses_search;
DROP INDEX IF EXISTS idx_categories_slug;
DROP INDEX IF EXISTS idx_categories_parent;
DROP INDEX IF EXISTS idx_categories_path;
DROP INDEX IF EXISTS idx_reviews_business;
DROP INDEX IF EXISTS idx_reviews_reviewer;
DROP INDEX IF EXISTS idx_reviews_rating;
DROP INDEX IF EXISTS idx_reviews_created;
DROP INDEX IF EXISTS idx_analytics_business_date;
DROP INDEX IF EXISTS idx_search_analytics_query;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS search_analytics CASCADE;
DROP TABLE IF EXISTS business_analytics CASCADE;
DROP TABLE IF EXISTS business_review_responses CASCADE;
DROP TABLE IF EXISTS business_reviews CASCADE;
DROP TABLE IF EXISTS business_managers CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS businesses CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- Drop extensions
DROP EXTENSION IF EXISTS "uuid-ossp";
DROP EXTENSION IF EXISTS "postgis";
DROP EXTENSION IF EXISTS "pg_trgm";
DROP EXTENSION IF EXISTS "unaccent";

COMMIT;
```

## Monitoring & Maintenance

### Performance Monitoring Queries

```sql
-- Query performance monitoring
CREATE OR REPLACE VIEW query_performance_stats AS
SELECT 
    query,
    calls,
    mean_exec_time,
    stddev_exec_time,
    total_exec_time,
    min_exec_time,
    max_exec_time,
    rows / NULLIF(calls, 0) as avg_rows
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC
LIMIT 100;

-- Table size and bloat monitoring
CREATE OR REPLACE VIEW table_maintenance_stats AS
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS indexes_size,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    round(n_dead_tup::numeric / NULLIF(n_live_tup, 0) * 100, 2) AS dead_percent,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage statistics
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 100 THEN 'RARELY USED'
        ELSE 'ACTIVE'
    END as usage_status
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Connection monitoring
CREATE OR REPLACE VIEW connection_stats AS
SELECT 
    datname as database,
    count(*) as total_connections,
    count(*) FILTER (WHERE state = 'active') as active_connections,
    count(*) FILTER (WHERE state = 'idle') as idle_connections,
    count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
    max(age(clock_timestamp(), query_start)) FILTER (WHERE state = 'active') as longest_query_time,
    max(age(clock_timestamp(), state_change)) FILTER (WHERE state = 'idle') as longest_idle_time
FROM pg_stat_activity
WHERE datname IS NOT NULL
GROUP BY datname;

-- Slow query detection
CREATE OR REPLACE FUNCTION get_slow_queries(threshold_ms INTEGER DEFAULT 1000)
RETURNS TABLE(
    pid INTEGER,
    duration INTERVAL,
    query TEXT,
    state TEXT,
    wait_event TEXT,
    username TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pg_stat_activity.pid,
        age(clock_timestamp(), query_start) as duration,
        pg_stat_activity.query,
        pg_stat_activity.state,
        pg_stat_activity.wait_event,
        usename as username
    FROM pg_stat_activity
    WHERE state = 'active'
    AND age(clock_timestamp(), query_start) > (threshold_ms || ' milliseconds')::INTERVAL
    ORDER BY duration DESC;
END;
$$ LANGUAGE plpgsql;
```

### Maintenance Procedures

```sql
-- Refresh materialized views
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY business_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY category_business_counts;
END;
$$ LANGUAGE plpgsql;

-- Schedule with pg_cron (if available)
-- SELECT cron.schedule('refresh-materialized-views', '*/15 * * * *', 'SELECT refresh_all_materialized_views()');

-- Vacuum and analyze procedure
CREATE OR REPLACE FUNCTION perform_maintenance()
RETURNS TABLE(
    table_name TEXT,
    action TEXT,
    status TEXT
) AS $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN 
        SELECT schemaname || '.' || tablename as full_table_name
        FROM pg_stat_user_tables
        WHERE n_dead_tup > 1000
        OR last_vacuum < NOW() - INTERVAL '7 days'
        OR last_analyze < NOW() - INTERVAL '7 days'
    LOOP
        BEGIN
            EXECUTE 'VACUUM ANALYZE ' || rec.full_table_name;
            RETURN QUERY SELECT rec.full_table_name, 'VACUUM ANALYZE', 'SUCCESS';
        EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT rec.full_table_name, 'VACUUM ANALYZE', 'FAILED: ' || SQLERRM;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Database health check
CREATE OR REPLACE FUNCTION check_database_health()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    details TEXT,
    severity TEXT
) AS $$
BEGIN
    -- Check table bloat
    RETURN QUERY
    SELECT 
        'table_bloat',
        CASE 
            WHEN MAX(n_dead_tup::numeric / NULLIF(n_live_tup, 0)) > 0.2 THEN 'WARNING'
            ELSE 'OK'
        END,
        'Max bloat ratio: ' || ROUND(MAX(n_dead_tup::numeric / NULLIF(n_live_tup, 0)) * 100, 2) || '%',
        CASE 
            WHEN MAX(n_dead_tup::numeric / NULLIF(n_live_tup, 0)) > 0.5 THEN 'HIGH'
            WHEN MAX(n_dead_tup::numeric / NULLIF(n_live_tup, 0)) > 0.2 THEN 'MEDIUM'
            ELSE 'LOW'
        END
    FROM pg_stat_user_tables;
    
    -- Check connection count
    RETURN QUERY
    SELECT 
        'connection_count',
        CASE 
            WHEN COUNT(*) > 90 THEN 'CRITICAL'
            WHEN COUNT(*) > 80 THEN 'WARNING'
            ELSE 'OK'
        END,
        'Active connections: ' || COUNT(*),
        CASE 
            WHEN COUNT(*) > 90 THEN 'HIGH'
            WHEN COUNT(*) > 80 THEN 'MEDIUM'
            ELSE 'LOW'
        END
    FROM pg_stat_activity
    WHERE state = 'active';
    
    -- Check long-running queries
    RETURN QUERY
    SELECT 
        'long_running_queries',
        CASE 
            WHEN COUNT(*) > 0 THEN 'WARNING'
            ELSE 'OK'
        END,
        'Queries running > 5 minutes: ' || COUNT(*),
        CASE 
            WHEN COUNT(*) > 5 THEN 'HIGH'
            WHEN COUNT(*) > 0 THEN 'MEDIUM'
            ELSE 'LOW'
        END
    FROM pg_stat_activity
    WHERE state = 'active'
    AND age(clock_timestamp(), query_start) > INTERVAL '5 minutes';
    
    -- Check index usage
    RETURN QUERY
    SELECT 
        'unused_indexes',
        CASE 
            WHEN COUNT(*) > 10 THEN 'WARNING'
            ELSE 'OK'
        END,
        'Unused indexes: ' || COUNT(*),
        'LOW'
    FROM pg_stat_user_indexes
    WHERE idx_scan = 0
    AND indexrelid > 16384;
    
    -- Check materialized view freshness
    RETURN QUERY
    SELECT 
        'materialized_view_freshness',
        CASE 
            WHEN MAX(age(clock_timestamp(), last_refresh)) > INTERVAL '1 hour' THEN 'WARNING'
            ELSE 'OK'
        END,
        'Oldest refresh: ' || MAX(age(clock_timestamp(), last_refresh)),
        CASE 
            WHEN MAX(age(clock_timestamp(), last_refresh)) > INTERVAL '2 hours' THEN 'HIGH'
            WHEN MAX(age(clock_timestamp(), last_refresh)) > INTERVAL '1 hour' THEN 'MEDIUM'
            ELSE 'LOW'
        END
    FROM (
        SELECT pg_stat_user_tables.schemaname, pg_stat_user_tables.tablename, 
               greatest(last_vacuum, last_autovacuum, last_analyze, last_autoanalyze) as last_refresh
        FROM pg_stat_user_tables
        WHERE tablename LIKE '%_stats'
    ) mv;
END;
$$ LANGUAGE plpgsql;
```

## Backup and Recovery Procedures

### Backup Configuration

```bash
#!/bin/bash
# backup.sh - Automated backup script for Supabase

# Configuration
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_KEY="your-service-key"
BACKUP_DIR="/backups/supabase"
S3_BUCKET="lawless-directory-backups"
RETENTION_DAYS=30

# Create backup
pg_dump \
    "${SUPABASE_URL}/postgres" \
    --format=custom \
    --verbose \
    --no-owner \
    --no-privileges \
    --file="${BACKUP_DIR}/backup_$(date +%Y%m%d_%H%M%S).dump"

# Upload to S3
aws s3 cp \
    "${BACKUP_DIR}/backup_$(date +%Y%m%d_%H%M%S).dump" \
    "s3://${S3_BUCKET}/backups/"

# Clean old backups
find ${BACKUP_DIR} -name "*.dump" -mtime +${RETENTION_DAYS} -delete
aws s3 ls "s3://${S3_BUCKET}/backups/" | \
    while read -r line; do
        createDate=$(echo $line | awk '{print $1" "$2}')
        createDate=$(date -d "$createDate" +%s)
        olderThan=$(date -d "${RETENTION_DAYS} days ago" +%s)
        if [[ $createDate -lt $olderThan ]]; then
            fileName=$(echo $line | awk '{print $4}')
            aws s3 rm "s3://${S3_BUCKET}/backups/$fileName"
        fi
    done
```

### Recovery Procedures

```bash
#!/bin/bash
# restore.sh - Database recovery script

# Configuration
SUPABASE_URL="https://your-project.supabase.co"
BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: ./restore.sh <backup_file>"
    exit 1
fi

# Restore database
pg_restore \
    --verbose \
    --no-owner \
    --no-privileges \
    --dbname="${SUPABASE_URL}/postgres" \
    "$BACKUP_FILE"

# Verify restoration
psql "${SUPABASE_URL}/postgres" -c "
    SELECT 
        table_name,
        COUNT(*) as row_count
    FROM information_schema.tables t
    LEFT JOIN LATERAL (
        SELECT COUNT(*) FROM t.table_name
    ) c ON true
    WHERE table_schema = 'public'
    GROUP BY table_name
    ORDER BY table_name;
"
```

## Environment Configuration

### .env.local Configuration

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database Direct Connection (for migrations)
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# Application Settings
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_ENV=development
```

## Next Steps

1. **Initialize Supabase Project**
   - Create new Supabase project
   - Configure environment variables
   - Run initial migration

2. **Apply Database Schema**
   - Execute migration scripts
   - Verify table creation
   - Test RLS policies

3. **Seed Initial Data**
   - Load categories
   - Import sample businesses
   - Generate test reviews

4. **Integrate with Next.js**
   - Configure Supabase client
   - Generate TypeScript types
   - Create API hooks

5. **Performance Testing**
   - Load test with sample data
   - Verify query performance
   - Optimize slow queries

6. **Security Audit**
   - Test RLS policies
   - Verify authentication flow
   - Audit access controls

7. **Monitoring Setup**
   - Configure alerts
   - Set up dashboards
   - Schedule maintenance tasks
