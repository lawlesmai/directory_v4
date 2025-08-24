# Story 1.4: Supabase Database Setup & Schema Design

**User Story:** As a platform developer, I want to establish a Supabase database with a comprehensive schema for business listings so that the application can transition from static content to dynamic, database-driven functionality.

**Assignee:** Backend Architect Agent  
**Priority:** P0  
**Story Points:** 21  
**Sprint:** 2

## Epic Context
**Epic:** 1 - Public Directory MVP  
**Epic Mission:** Transform The Lawless Directory's sophisticated vanilla JavaScript prototype into a production-ready Next.js + Supabase application while preserving and enhancing all existing UI sophistication, performance optimizations, and user experience features.

## Detailed Acceptance Criteria

### Supabase Project Setup
- **Given** a new Supabase project requirement
- **When** setting up the database infrastructure
- **Then** configure:
  - New Supabase project with appropriate naming convention
  - PostgreSQL database with proper performance settings
  - Database connection strings for development, staging, and production
  - Environment variables properly configured in Next.js
  - Supabase client initialization with TypeScript support

### Database Schema Design
- **Given** the business directory requirements
- **When** designing the database schema
- **Then** create the following tables:

  **`businesses` Table:**
  ```sql
  businesses (
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
    special_hours JSONB DEFAULT '{}', -- holidays, exceptions
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
    external_platforms JSONB DEFAULT '{}', -- Yelp, TripAdvisor, etc.
    
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
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
  );
  ```

  **`categories` Table:**
  ```sql
  categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID REFERENCES categories(id),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    image_url VARCHAR(500),
    color VARCHAR(7),
    
    -- Hierarchy helpers
    level INTEGER DEFAULT 0,
    path TEXT[], -- materialized path for efficient queries
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
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

  **`business_reviews` Table:**
  ```sql
  business_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES auth.users(id),
    
    -- Review content
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title VARCHAR(255),
    content TEXT NOT NULL,
    
    -- Review metadata
    visit_date DATE,
    verification_type VARCHAR(50), -- receipt, photo, location
    verification_data JSONB,
    
    -- Media
    photos JSONB DEFAULT '[]',
    videos JSONB DEFAULT '[]',
    
    -- Engagement metrics
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    response_id UUID REFERENCES business_review_responses(id),
    
    -- Moderation
    status VARCHAR(50) DEFAULT 'pending',
    moderation_notes TEXT,
    flagged_count INTEGER DEFAULT 0,
    flag_reasons JSONB DEFAULT '[]',
    
    -- ML/AI features
    sentiment_score DECIMAL(3,2),
    topics TEXT[],
    language VARCHAR(10) DEFAULT 'en',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
  );
  ```

### Database Indexes and Performance
- **Given** the need for efficient queries
- **When** setting up the database
- **Then** create appropriate indexes:
  - B-tree indexes on frequently queried columns (category, city, state)
  - GIN indexes for full-text search (name, description)
  - Geospatial indexes for location-based queries
  - Composite indexes for common query patterns

```sql
-- Performance indexes
CREATE INDEX idx_businesses_slug ON businesses(slug);
CREATE INDEX idx_businesses_status ON businesses(status) WHERE status = 'active';
CREATE INDEX idx_businesses_location ON businesses USING GIST(location);
CREATE INDEX idx_businesses_category ON businesses(primary_category_id);
CREATE INDEX idx_businesses_city_state ON businesses(city, state);
CREATE INDEX idx_businesses_owner ON businesses(owner_id);
CREATE INDEX idx_businesses_subscription ON businesses(subscription_tier) WHERE subscription_tier != 'free';
CREATE INDEX idx_businesses_search ON businesses USING GIN(
  to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
);
```

### Row Level Security (RLS)
- **Given** the security requirements
- **When** configuring database access
- **Then** implement RLS policies:
  - Public read access for active businesses
  - Authenticated user policies for reviews
  - Business owner policies for editing their listings
  - Admin policies for full access

```sql
-- Enable RLS
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- Public read access for active businesses
CREATE POLICY businesses_public_read ON businesses
  FOR SELECT
  USING (
    status = 'active' 
    AND deleted_at IS NULL
    AND (suspended_at IS NULL OR suspended_at > NOW())
  );

-- Owner write access
CREATE POLICY businesses_owner_write ON businesses
  FOR ALL
  USING (
    auth.uid() = owner_id
    OR auth.uid() IN (
      SELECT user_id FROM business_managers 
      WHERE business_id = businesses.id
    )
  );

-- Admin full access
CREATE POLICY businesses_admin_all ON businesses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );
```

## Technical Implementation Notes

### Database Architecture Design
- **Given** the need for a scalable database foundation
- **When** designing the architecture
- **Then** document and implement:

  **Schema Design Principles:**
  ```sql
  -- Normalization Strategy
  -- 3NF for transactional data
  -- Selective denormalization for read-heavy tables
  -- JSONB for flexible attributes
  
  -- Naming Conventions
  -- Tables: plural, snake_case (businesses, business_reviews)
  -- Columns: snake_case (created_at, business_id)
  -- Indexes: idx_table_column (idx_businesses_category)
  -- Constraints: table_column_type (businesses_email_unique)
  ```

### Data Migration Strategy
- Prepare seed data based on existing prototype businesses
- Create migration scripts for development data
- Implement data validation at database level

### Performance Optimizations
- Connection pooling configuration
- Query optimization for common access patterns
- Database query caching strategy

### Backup and Recovery
- Automated daily backups
- Point-in-time recovery setup
- Database monitoring and alerting

## Current State Context
**Performance Targets:**
- Query response time < 50ms for 95th percentile
- Write operations < 100ms for 99th percentile
- Connection pool efficiency > 90%
- Database CPU usage < 60% under normal load
- Storage growth projection: 100GB first year

**Database Technology Stack:**
- PostgreSQL 15+ via Supabase
- PostGIS for geospatial queries
- pg_cron for scheduled tasks
- pgvector for future AI/ML features
- TimescaleDB considerations for analytics

## Dependencies
- Story 1.1 (Next.js foundation for environment configuration)

## Testing Requirements

### Database Tests
- Schema validation tests
- Constraint validation tests
- Index performance tests
- RLS policy tests

### Migration Tests
- Data migration integrity tests
- Rollback procedure tests
- Performance impact tests

### Security Tests
- Access control validation
- SQL injection prevention tests
- Data encryption verification

## Definition of Done
- [ ] Supabase project created and configured
- [ ] Complete database schema implemented with all tables
- [ ] Appropriate indexes created for performance
- [ ] Row Level Security policies implemented and tested
- [ ] Environment variables configured for all environments
- [ ] Database connection working in Next.js application
- [ ] Seed data populated for development testing
- [ ] Database backup and recovery procedures documented
- [ ] All database tests passing
- [ ] Performance benchmarks meet requirements (query time < 100ms)

## Risk Assessment
- **Low Risk:** Standard Supabase setup
- **Medium Risk:** Complex RLS policies may affect performance
- **Mitigation:** Thorough policy testing and query optimization

## Backend/Frontend/Testing Integration

### Backend Requirements
- Database architecture optimized for application needs
- Performance monitoring and alerting systems
- Backup and recovery procedures established
- Security policies enforced at database level

### Frontend Implementation
- Database schema types generated for TypeScript
- API layer optimized for efficient data access
- Caching strategies implemented for performance
- Error handling for database operations

### Testing Strategy (TDD Approach)
- Schema validation testing before implementation
- Performance testing for all database operations
- Security testing for RLS policies
- Migration testing for data integrity

## Success Metrics
- **Technical:** Database setup complete with all schema elements
- **Performance:** All queries meet performance benchmarks
- **Quality:** 100% schema test coverage with security validation
- **User Experience:** Fast, reliable data access supporting application needs