-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create categories table first (referenced by businesses)
CREATE TABLE categories (
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
    path TEXT[] DEFAULT '{}',
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
    
    -- Constraints
    CONSTRAINT valid_slug_format CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT valid_color_format CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$')
);

-- Create businesses table
CREATE TABLE businesses (
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
    meta_keywords TEXT[] DEFAULT '{}',
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
    CONSTRAINT valid_email CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
    CONSTRAINT valid_slug_format CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT valid_phone CHECK (phone IS NULL OR phone ~ '^[\+]?[0-9\(\)\-\.\s]+$'),
    CONSTRAINT valid_year CHECK (year_established IS NULL OR year_established BETWEEN 1800 AND EXTRACT(YEAR FROM NOW())),
    CONSTRAINT valid_service_radius CHECK (service_area_radius_miles IS NULL OR service_area_radius_miles > 0),
    CONSTRAINT valid_status CHECK (status IN ('draft', 'active', 'inactive', 'suspended', 'deleted')),
    CONSTRAINT valid_verification_status CHECK (verification_status IN ('pending', 'verified', 'rejected', 'expired')),
    CONSTRAINT valid_subscription_tier CHECK (subscription_tier IN ('free', 'basic', 'premium', 'enterprise'))
);

-- Create business_reviews table
CREATE TABLE business_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES auth.users(id),
    
    -- Review content
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title VARCHAR(255),
    content TEXT NOT NULL,
    
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
    response_id UUID, -- Will reference business_review_responses table when created
    
    -- Moderation
    status VARCHAR(50) DEFAULT 'pending',
    moderation_notes TEXT,
    flagged_count INTEGER DEFAULT 0,
    flag_reasons JSONB DEFAULT '[]',
    
    -- ML/AI features
    sentiment_score DECIMAL(3,2),
    topics TEXT[] DEFAULT '{}',
    language VARCHAR(10) DEFAULT 'en',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT valid_review_status CHECK (status IN ('pending', 'approved', 'rejected', 'flagged', 'deleted')),
    CONSTRAINT valid_sentiment_score CHECK (sentiment_score IS NULL OR (sentiment_score >= -1 AND sentiment_score <= 1)),
    CONSTRAINT valid_verification_type CHECK (verification_type IS NULL OR verification_type IN ('receipt', 'photo', 'location', 'phone', 'email')),
    CONSTRAINT valid_language CHECK (language ~ '^[a-z]{2}(-[A-Z]{2})?$'),
    CONSTRAINT valid_helpful_counts CHECK (helpful_count >= 0 AND not_helpful_count >= 0),
    CONSTRAINT non_empty_content CHECK (LENGTH(TRIM(content)) > 0)
);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_reviews_updated_at BEFORE UPDATE ON business_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to update business counts in categories
CREATE OR REPLACE FUNCTION update_category_business_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Update count for old primary category
    IF OLD.primary_category_id IS NOT NULL THEN
        UPDATE categories 
        SET business_count = (
            SELECT COUNT(*) FROM businesses 
            WHERE primary_category_id = OLD.primary_category_id 
            AND status = 'active' 
            AND deleted_at IS NULL
        )
        WHERE id = OLD.primary_category_id;
    END IF;
    
    -- Update count for new primary category
    IF NEW.primary_category_id IS NOT NULL THEN
        UPDATE categories 
        SET business_count = (
            SELECT COUNT(*) FROM businesses 
            WHERE primary_category_id = NEW.primary_category_id 
            AND status = 'active' 
            AND deleted_at IS NULL
        )
        WHERE id = NEW.primary_category_id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for category business count updates
CREATE TRIGGER update_business_category_count 
    AFTER INSERT OR UPDATE OF primary_category_id, status, deleted_at ON businesses
    FOR EACH ROW EXECUTE FUNCTION update_category_business_count();

-- Create function to update category hierarchy path
CREATE OR REPLACE FUNCTION update_category_path()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.parent_id IS NULL THEN
        NEW.path = ARRAY[NEW.id::TEXT];
        NEW.level = 0;
    ELSE
        SELECT path || NEW.id::TEXT, level + 1
        INTO NEW.path, NEW.level
        FROM categories
        WHERE id = NEW.parent_id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for category path updates
CREATE TRIGGER update_categories_path BEFORE INSERT OR UPDATE OF parent_id ON categories
    FOR EACH ROW EXECUTE FUNCTION update_category_path();

-- Create function to prevent circular category references
CREATE OR REPLACE FUNCTION prevent_category_circular_reference()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.parent_id IS NOT NULL AND NEW.id = NEW.parent_id THEN
        RAISE EXCEPTION 'Category cannot be its own parent';
    END IF;
    
    -- Check if new parent would create circular reference
    IF NEW.parent_id IS NOT NULL THEN
        IF NEW.id::TEXT = ANY(
            SELECT path FROM categories WHERE id = NEW.parent_id
        ) THEN
            RAISE EXCEPTION 'Circular category reference detected';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to prevent circular references
CREATE TRIGGER prevent_categories_circular_ref BEFORE INSERT OR UPDATE OF parent_id ON categories
    FOR EACH ROW EXECUTE FUNCTION prevent_category_circular_reference();