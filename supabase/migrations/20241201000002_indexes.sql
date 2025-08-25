-- Performance indexes for businesses table

-- B-tree indexes for frequently queried columns
CREATE INDEX idx_businesses_slug ON businesses(slug);
CREATE INDEX idx_businesses_status ON businesses(status) WHERE status = 'active';
CREATE INDEX idx_businesses_category ON businesses(primary_category_id);
CREATE INDEX idx_businesses_city_state ON businesses(city, state);
CREATE INDEX idx_businesses_owner ON businesses(owner_id);
CREATE INDEX idx_businesses_subscription ON businesses(subscription_tier) WHERE subscription_tier != 'free';
CREATE INDEX idx_businesses_featured ON businesses(featured_until) WHERE featured_until > NOW();
CREATE INDEX idx_businesses_published ON businesses(published_at) WHERE published_at IS NOT NULL;
CREATE INDEX idx_businesses_verification ON businesses(verification_status);
CREATE INDEX idx_businesses_created_at ON businesses(created_at);
CREATE INDEX idx_businesses_last_activity ON businesses(last_activity_at);

-- Geospatial indexes for location-based queries
CREATE INDEX idx_businesses_location ON businesses USING GIST(location);

-- GIN indexes for full-text search and array operations
CREATE INDEX idx_businesses_search ON businesses USING GIN(
  to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(short_description, ''))
);
CREATE INDEX idx_businesses_secondary_categories ON businesses USING GIN(secondary_categories);
CREATE INDEX idx_businesses_tags ON businesses USING GIN(tags);
CREATE INDEX idx_businesses_meta_keywords ON businesses USING GIN(meta_keywords);

-- Composite indexes for common query patterns
CREATE INDEX idx_businesses_active_location ON businesses(status, city, state) 
  WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX idx_businesses_category_status ON businesses(primary_category_id, status) 
  WHERE status = 'active';
CREATE INDEX idx_businesses_subscription_status ON businesses(subscription_tier, status) 
  WHERE status = 'active';

-- Partial indexes for performance on filtered queries
CREATE INDEX idx_businesses_verified_active ON businesses(verification_status, quality_score) 
  WHERE status = 'active' AND verification_status = 'verified';
CREATE INDEX idx_businesses_premium_active ON businesses(subscription_tier, featured_until) 
  WHERE status = 'active' AND subscription_tier IN ('premium', 'enterprise');

-- Performance indexes for categories table
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_active ON categories(active) WHERE active = true;
CREATE INDEX idx_categories_featured ON categories(featured) WHERE featured = true;
CREATE INDEX idx_categories_navigation ON categories(show_in_navigation) WHERE show_in_navigation = true;
CREATE INDEX idx_categories_level_sort ON categories(level, sort_order);

-- GIN index for category path hierarchy
CREATE INDEX idx_categories_path ON categories USING GIN(path);

-- Performance indexes for business_reviews table
CREATE INDEX idx_business_reviews_business ON business_reviews(business_id);
CREATE INDEX idx_business_reviews_reviewer ON business_reviews(reviewer_id);
CREATE INDEX idx_business_reviews_status ON business_reviews(status) WHERE status = 'approved';
CREATE INDEX idx_business_reviews_rating ON business_reviews(rating);
CREATE INDEX idx_business_reviews_created ON business_reviews(created_at);
CREATE INDEX idx_business_reviews_published ON business_reviews(published_at) WHERE published_at IS NOT NULL;

-- Composite indexes for review queries
CREATE INDEX idx_business_reviews_business_status ON business_reviews(business_id, status) 
  WHERE status = 'approved';
CREATE INDEX idx_business_reviews_business_rating ON business_reviews(business_id, rating, created_at) 
  WHERE status = 'approved';

-- GIN indexes for review content search
CREATE INDEX idx_business_reviews_search ON business_reviews USING GIN(
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
);
CREATE INDEX idx_business_reviews_topics ON business_reviews USING GIN(topics);

-- Partial indexes for moderation
CREATE INDEX idx_business_reviews_flagged ON business_reviews(flagged_count, status) 
  WHERE flagged_count > 0;
CREATE INDEX idx_business_reviews_pending ON business_reviews(created_at) 
  WHERE status = 'pending';

-- Indexes for analytics and aggregation queries
CREATE INDEX idx_businesses_view_count ON businesses(view_count) WHERE view_count > 0;
CREATE INDEX idx_businesses_quality_score ON businesses(quality_score) WHERE quality_score > 0;

-- Expression indexes for computed values
CREATE INDEX idx_businesses_name_lower ON businesses(lower(name));
CREATE INDEX idx_businesses_city_lower ON businesses(lower(city));

-- Indexes to support ordering and pagination
CREATE INDEX idx_businesses_created_desc ON businesses(created_at DESC) WHERE status = 'active';
CREATE INDEX idx_businesses_updated_desc ON businesses(updated_at DESC) WHERE status = 'active';
CREATE INDEX idx_businesses_alphabetical ON businesses(lower(name)) WHERE status = 'active';
CREATE INDEX idx_businesses_quality_desc ON businesses(quality_score DESC) WHERE status = 'active';

-- Statistics for query optimization
ANALYZE businesses;
ANALYZE categories; 
ANALYZE business_reviews;