-- Migration: 001_initial_schema
-- Description: Initial database schema for The Lawless Directory
-- Date: 2025-01-24
-- Author: Backend Architect Agent

BEGIN;

-- =====================================================
-- EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Categories table (create first as it's referenced by businesses)
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

-- Main businesses table
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
    business_hours JSONB DEFAULT '{
        "monday": {"open": "09:00", "close": "17:00", "closed": false},
        "tuesday": {"open": "09:00", "close": "17:00", "closed": false},
        "wednesday": {"open": "09:00", "close": "17:00", "closed": false},
        "thursday": {"open": "09:00", "close": "17:00", "closed": false},
        "friday": {"open": "09:00", "close": "17:00", "closed": false},
        "saturday": {"open": "10:00", "close": "16:00", "closed": false},
        "sunday": {"open": null, "close": null, "closed": true}
    }'::jsonb,
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
    verification_status VARCHAR(50) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected', 'expired')),
    verification_date TIMESTAMPTZ,
    verification_documents JSONB DEFAULT '[]',
    trust_signals JSONB DEFAULT '{}',
    quality_score DECIMAL(3,2) DEFAULT 0.00,
    
    -- Subscription and features
    subscription_tier VARCHAR(50) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'premium', 'elite', 'enterprise')),
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
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'active', 'inactive', 'suspended', 'deleted')),
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
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$' OR email IS NULL),
    CONSTRAINT valid_phone CHECK (phone ~* '^\+?[1-9]\d{1,14}$' OR phone IS NULL),
    CONSTRAINT valid_year_established CHECK (year_established IS NULL OR (year_established >= 1800 AND year_established <= EXTRACT(YEAR FROM CURRENT_DATE))),
    CONSTRAINT valid_boost_credits CHECK (boost_credits >= 0)
);

-- Business reviews table
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
    verification_type VARCHAR(50) CHECK (verification_type IN ('receipt', 'photo', 'location', 'purchase', 'none')),
    verification_data JSONB,
    
    -- Media
    photos JSONB DEFAULT '[]',
    videos JSONB DEFAULT '[]',
    
    -- Engagement metrics
    helpful_count INTEGER DEFAULT 0 CHECK (helpful_count >= 0),
    not_helpful_count INTEGER DEFAULT 0 CHECK (not_helpful_count >= 0),
    
    -- Moderation
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected', 'flagged', 'deleted')),
    moderation_notes TEXT,
    flagged_count INTEGER DEFAULT 0 CHECK (flagged_count >= 0),
    flag_reasons JSONB DEFAULT '[]',
    
    -- ML/AI features
    sentiment_score DECIMAL(3,2) CHECK (sentiment_score IS NULL OR (sentiment_score >= -1 AND sentiment_score <= 1)),
    topics TEXT[],
    language VARCHAR(10) DEFAULT 'en',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    
    -- Ensure one review per user per business (excluding deleted)
    CONSTRAINT unique_user_business_review UNIQUE NULLS NOT DISTINCT (business_id, reviewer_id, deleted_at)
);

-- Business review responses table
CREATE TABLE business_review_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL UNIQUE REFERENCES business_reviews(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    responder_id UUID NOT NULL REFERENCES auth.users(id),
    content TEXT NOT NULL CHECK (LENGTH(content) >= 10),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'edited', 'deleted')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SUPPORTING TABLES
-- =====================================================

-- Business managers table
CREATE TABLE business_managers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'manager' CHECK (role IN ('manager', 'editor', 'viewer', 'admin')),
    permissions JSONB DEFAULT '{}',
    invited_by UUID REFERENCES auth.users(id),
    invitation_accepted_at TIMESTAMPTZ,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_business_user UNIQUE (business_id, user_id)
);

-- User roles table
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'business_owner', 'moderator', 'admin', 'super_admin')),
    permissions JSONB DEFAULT '{}',
    granted_by UUID REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_user_role UNIQUE (user_id, role)
);

-- Service areas table
CREATE TABLE service_areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    area GEOGRAPHY(POLYGON, 4326),
    area_name VARCHAR(255),
    delivery_fee DECIMAL(10,2) CHECK (delivery_fee >= 0),
    minimum_order DECIMAL(10,2) CHECK (minimum_order >= 0),
    estimated_time_minutes INTEGER CHECK (estimated_time_minutes > 0),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ANALYTICS TABLES
-- =====================================================

-- Business analytics table
CREATE TABLE business_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- View metrics
    page_views INTEGER DEFAULT 0 CHECK (page_views >= 0),
    unique_visitors INTEGER DEFAULT 0 CHECK (unique_visitors >= 0),
    avg_time_on_page INTERVAL,
    bounce_rate DECIMAL(5,2) CHECK (bounce_rate IS NULL OR (bounce_rate >= 0 AND bounce_rate <= 100)),
    
    -- Engagement metrics
    phone_clicks INTEGER DEFAULT 0 CHECK (phone_clicks >= 0),
    website_clicks INTEGER DEFAULT 0 CHECK (website_clicks >= 0),
    direction_clicks INTEGER DEFAULT 0 CHECK (direction_clicks >= 0),
    share_clicks INTEGER DEFAULT 0 CHECK (share_clicks >= 0),
    save_clicks INTEGER DEFAULT 0 CHECK (save_clicks >= 0),
    
    -- Review metrics
    new_reviews INTEGER DEFAULT 0 CHECK (new_reviews >= 0),
    avg_rating DECIMAL(3,2) CHECK (avg_rating IS NULL OR (avg_rating >= 1 AND avg_rating <= 5)),
    
    -- Search metrics
    search_impressions INTEGER DEFAULT 0 CHECK (search_impressions >= 0),
    search_clicks INTEGER DEFAULT 0 CHECK (search_clicks >= 0),
    search_position DECIMAL(5,2) CHECK (search_position IS NULL OR search_position > 0),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_business_date UNIQUE (business_id, date)
);

-- Search analytics table
CREATE TABLE search_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query TEXT NOT NULL,
    category_filter UUID REFERENCES categories(id),
    location_filter GEOGRAPHY(POINT, 4326),
    radius_filter INTEGER CHECK (radius_filter IS NULL OR radius_filter > 0),
    results_count INTEGER CHECK (results_count >= 0),
    clicked_results UUID[],
    user_id UUID REFERENCES auth.users(id),
    session_id UUID,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- AUDIT TABLES
-- =====================================================

-- Audit logs table (partitioned by month)
CREATE TABLE audit_logs (
    id UUID DEFAULT uuid_generate_v4(),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')),
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
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for the next 12 months
CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE audit_logs_2025_02 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE audit_logs_2025_03 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE audit_logs_2025_04 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE audit_logs_2025_05 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE audit_logs_2025_06 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE audit_logs_2025_07 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE audit_logs_2025_08 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE audit_logs_2025_09 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE audit_logs_2025_10 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE audit_logs_2025_11 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE audit_logs_2025_12 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Businesses table indexes
CREATE INDEX idx_businesses_slug ON businesses(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_businesses_status ON businesses(status) WHERE status = 'active';
CREATE INDEX idx_businesses_location ON businesses USING GIST(location);
CREATE INDEX idx_businesses_category ON businesses(primary_category_id) WHERE status = 'active';
CREATE INDEX idx_businesses_city_state ON businesses(city, state) WHERE status = 'active';
CREATE INDEX idx_businesses_owner ON businesses(owner_id);
CREATE INDEX idx_businesses_subscription ON businesses(subscription_tier) WHERE subscription_tier != 'free';
CREATE INDEX idx_businesses_featured ON businesses(featured_until) WHERE featured_until > NOW();
CREATE INDEX idx_businesses_verification ON businesses(verification_status) WHERE verification_status = 'verified';
CREATE INDEX idx_businesses_quality ON businesses(quality_score DESC) WHERE status = 'active';

-- Full-text search index
CREATE INDEX idx_businesses_search ON businesses USING GIN(
    to_tsvector('english', 
        coalesce(name, '') || ' ' || 
        coalesce(description, '') || ' ' ||
        coalesce(array_to_string(tags, ' '), '')
    )
) WHERE status = 'active';

-- Trigram index for fuzzy search
CREATE INDEX idx_businesses_name_trgm ON businesses USING GIN(name gin_trgm_ops) WHERE status = 'active';

-- Categories table indexes
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_path ON categories USING GIN(path);
CREATE INDEX idx_categories_active ON categories(active) WHERE active = TRUE;

-- Reviews table indexes
CREATE INDEX idx_reviews_business ON business_reviews(business_id) WHERE status = 'published';
CREATE INDEX idx_reviews_reviewer ON business_reviews(reviewer_id);
CREATE INDEX idx_reviews_rating ON business_reviews(rating) WHERE status = 'published';
CREATE INDEX idx_reviews_created ON business_reviews(created_at DESC) WHERE status = 'published';
CREATE INDEX idx_reviews_status ON business_reviews(status);

-- Analytics table indexes
CREATE INDEX idx_analytics_business_date ON business_analytics(business_id, date DESC);
CREATE INDEX idx_search_analytics_query ON search_analytics USING GIN(to_tsvector('english', query));
CREATE INDEX idx_search_analytics_created ON search_analytics(created_at DESC);

-- Audit logs indexes
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- =====================================================
-- Initial Data
-- =====================================================

-- Insert initial categories
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
    ('real-estate', 'Real Estate', 'Real estate services and property management', 'building', 10),
    ('fitness', 'Fitness & Sports', 'Gyms, sports facilities, and fitness services', 'dumbbell', 11),
    ('pets', 'Pet Services', 'Pet care, veterinary, and pet supplies', 'paw', 12),
    ('financial', 'Financial Services', 'Banking, insurance, and financial planning', 'dollar-sign', 13),
    ('travel', 'Travel & Hospitality', 'Hotels, travel agencies, and tourism', 'plane', 14),
    ('technology', 'Technology', 'IT services, electronics, and tech support', 'laptop', 15);

COMMIT;
