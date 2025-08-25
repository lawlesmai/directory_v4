-- Advanced Search & Filtering System Migration
-- Story 1.6 Implementation - PostgreSQL Full-Text Search with Trigram Fuzzy Matching

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS postgis;

-- Custom search configuration with unaccent support
DROP TEXT SEARCH CONFIGURATION IF EXISTS custom_search CASCADE;
CREATE TEXT SEARCH CONFIGURATION custom_search (COPY = english);

-- Add unaccent support to the search configuration
ALTER TEXT SEARCH CONFIGURATION custom_search
  ALTER MAPPING FOR asciiword, asciihword, hword_asciipart, word, hword, hword_part
  WITH unaccent, english_stem;

-- Add search_vector column to businesses table if it doesn't exist
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS search_text text;

-- Update search_vector and search_text for existing records
UPDATE businesses SET
  search_text = coalesce(name, '') || ' ' || 
                coalesce(description, '') || ' ' || 
                coalesce(short_description, '') || ' ' ||
                array_to_string(coalesce(tags, ARRAY[]::text[]), ' '),
  search_vector = to_tsvector('custom_search', 
    coalesce(name, '') || ' ' || 
    coalesce(description, '') || ' ' || 
    coalesce(short_description, '') || ' ' ||
    array_to_string(coalesce(tags, ARRAY[]::text[]), ' ')
  );

-- Create indexes for optimized search performance
DROP INDEX IF EXISTS idx_businesses_search_vector;
CREATE INDEX idx_businesses_search_vector ON businesses USING GIN(search_vector);

DROP INDEX IF EXISTS idx_businesses_search_trigram;
CREATE INDEX idx_businesses_search_trigram ON businesses USING GIN(search_text gin_trgm_ops);

DROP INDEX IF EXISTS idx_businesses_location;
CREATE INDEX idx_businesses_location ON businesses USING GIST(location);

DROP INDEX IF EXISTS idx_businesses_compound_search;
CREATE INDEX idx_businesses_compound_search ON businesses USING GIN(
  to_tsvector('custom_search', coalesce(name, '') || ' ' || coalesce(description, ''))
);

-- Trigger to maintain search_vector and search_text
CREATE OR REPLACE FUNCTION update_business_search_fields()
RETURNS trigger AS $$
BEGIN
  NEW.search_text := coalesce(NEW.name, '') || ' ' || 
                    coalesce(NEW.description, '') || ' ' || 
                    coalesce(NEW.short_description, '') || ' ' ||
                    array_to_string(coalesce(NEW.tags, ARRAY[]::text[]), ' ');
  
  NEW.search_vector := to_tsvector('custom_search', NEW.search_text);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_business_search_fields ON businesses;
CREATE TRIGGER trigger_update_business_search_fields
  BEFORE INSERT OR UPDATE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION update_business_search_fields();

-- Advanced search function with fuzzy matching and relevance scoring
CREATE OR REPLACE FUNCTION search_businesses_advanced(
  search_query text DEFAULT NULL,
  category_filter uuid DEFAULT NULL,
  user_location geography DEFAULT NULL,
  radius_meters integer DEFAULT 25000,
  rating_filter numeric DEFAULT NULL,
  price_range_min integer DEFAULT NULL,
  price_range_max integer DEFAULT NULL,
  open_now boolean DEFAULT FALSE,
  premium_only boolean DEFAULT FALSE,
  verified_only boolean DEFAULT FALSE,
  result_limit integer DEFAULT 50,
  result_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  slug text,
  name text,
  description text,
  short_description text,
  city text,
  state text,
  cover_image_url text,
  logo_url text,
  quality_score numeric,
  subscription_tier text,
  verification_status text,
  distance_meters numeric,
  relevance_score numeric,
  match_type text
) AS $$
DECLARE
  query_tsquery tsquery;
  has_location boolean := user_location IS NOT NULL;
BEGIN
  -- Prepare the text search query if provided
  IF search_query IS NOT NULL AND length(trim(search_query)) >= 2 THEN
    query_tsquery := plainto_tsquery('custom_search', search_query);
  END IF;

  RETURN QUERY
  SELECT 
    b.id,
    b.slug,
    b.name,
    b.description,
    b.short_description,
    b.city,
    b.state,
    b.cover_image_url,
    b.logo_url,
    b.quality_score,
    b.subscription_tier,
    b.verification_status,
    CASE 
      WHEN has_location THEN ST_Distance(b.location, user_location)
      ELSE NULL
    END as distance_meters,
    CASE
      -- Full-text search scoring
      WHEN search_query IS NOT NULL THEN
        (ts_rank_cd(b.search_vector, query_tsquery) * 0.4) +
        (similarity(b.search_text, search_query) * 0.3) +
        -- Name exact match bonus
        (CASE WHEN lower(b.name) = lower(search_query) THEN 0.2 ELSE 0 END) +
        -- Quality score bonus
        (b.quality_score / 5.0 * 0.1)
      -- Location-only search scoring
      WHEN has_location THEN
        (5.0 - GREATEST(ST_Distance(b.location, user_location) / 1000.0, 1.0)) / 4.0 +
        (b.quality_score / 5.0 * 0.2)
      -- Default scoring
      ELSE b.quality_score / 5.0
    END as relevance_score,
    CASE
      WHEN search_query IS NOT NULL AND b.search_vector @@ query_tsquery THEN 'full_text'
      WHEN search_query IS NOT NULL AND b.search_text % search_query THEN 'fuzzy'
      WHEN has_location THEN 'location'
      ELSE 'default'
    END as match_type
  FROM businesses b
  LEFT JOIN categories c ON b.primary_category_id = c.id
  WHERE 
    -- Status filters
    b.status = 'active' 
    AND b.deleted_at IS NULL
    AND (b.published_at IS NULL OR b.published_at <= NOW())
    
    -- Search query filters
    AND (
      search_query IS NULL 
      OR length(trim(search_query)) < 2
      OR b.search_vector @@ query_tsquery
      OR similarity(b.search_text, search_query) > 0.2
    )
    
    -- Category filter
    AND (category_filter IS NULL OR b.primary_category_id = category_filter)
    
    -- Location filter
    AND (
      user_location IS NULL 
      OR ST_DWithin(b.location, user_location, radius_meters)
    )
    
    -- Rating filter
    AND (rating_filter IS NULL OR b.quality_score >= rating_filter)
    
    -- Premium filter
    AND (NOT premium_only OR b.subscription_tier != 'free')
    
    -- Verification filter
    AND (NOT verified_only OR b.verification_status = 'verified')
    
    -- Business hours filter (simplified - would need more complex logic for actual hours)
    AND (NOT open_now OR b.status = 'active') -- Placeholder for hours logic
  
  ORDER BY relevance_score DESC, b.quality_score DESC, b.created_at DESC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$ LANGUAGE plpgsql;

-- Geographic search function optimized for PostGIS
CREATE OR REPLACE FUNCTION search_businesses_nearby(
  user_location geography,
  search_text text DEFAULT NULL,
  radius_meters integer DEFAULT 10000,
  category_filter uuid DEFAULT NULL,
  result_limit integer DEFAULT 50
)
RETURNS TABLE(
  id uuid,
  slug text,
  name text,
  description text,
  city text,
  state text,
  cover_image_url text,
  distance_meters numeric,
  relevance_score numeric,
  bearing numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.slug,
    b.name,
    b.description,
    b.city,
    b.state,
    b.cover_image_url,
    ST_Distance(b.location, user_location) as distance_meters,
    -- Distance-based relevance with quality bonus
    (1.0 - LEAST(ST_Distance(b.location, user_location) / radius_meters, 1.0)) * 0.7 +
    (b.quality_score / 5.0 * 0.3) +
    -- Text search bonus if provided
    CASE 
      WHEN search_text IS NOT NULL THEN
        GREATEST(ts_rank(b.search_vector, plainto_tsquery('custom_search', search_text)) * 0.2, 0)
      ELSE 0
    END as relevance_score,
    -- Bearing from user location to business (in degrees)
    degrees(ST_Azimuth(user_location, b.location)) as bearing
  FROM businesses b
  WHERE 
    b.status = 'active'
    AND b.deleted_at IS NULL
    AND ST_DWithin(b.location, user_location, radius_meters)
    AND (category_filter IS NULL OR b.primary_category_id = category_filter)
    AND (
      search_text IS NULL 
      OR b.search_vector @@ plainto_tsquery('custom_search', search_text)
      OR similarity(b.search_text, search_text) > 0.1
    )
  ORDER BY distance_meters ASC, relevance_score DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Search suggestions function with intelligent ranking
CREATE OR REPLACE FUNCTION get_search_suggestions(
  partial_query text,
  suggestion_limit integer DEFAULT 10
)
RETURNS TABLE(
  suggestion text,
  suggestion_type text,
  match_count integer,
  relevance_score numeric
) AS $$
BEGIN
  RETURN QUERY
  -- Business name suggestions
  SELECT 
    b.name as suggestion,
    'business' as suggestion_type,
    1 as match_count,
    similarity(b.name, partial_query) as relevance_score
  FROM businesses b
  WHERE 
    b.status = 'active'
    AND b.deleted_at IS NULL
    AND (
      b.name ILIKE partial_query || '%'
      OR similarity(b.name, partial_query) > 0.3
    )
  
  UNION ALL
  
  -- Category suggestions
  SELECT 
    c.name as suggestion,
    'category' as suggestion_type,
    c.business_count as match_count,
    similarity(c.name, partial_query) as relevance_score
  FROM categories c
  WHERE 
    c.active = true
    AND c.show_in_directory = true
    AND (
      c.name ILIKE partial_query || '%'
      OR similarity(c.name, partial_query) > 0.3
    )
  
  UNION ALL
  
  -- Location-based suggestions (city names)
  SELECT 
    DISTINCT b.city || ', ' || b.state as suggestion,
    'location' as suggestion_type,
    COUNT(*)::integer as match_count,
    MAX(similarity(b.city, partial_query)) as relevance_score
  FROM businesses b
  WHERE 
    b.status = 'active'
    AND b.deleted_at IS NULL
    AND (
      b.city ILIKE partial_query || '%'
      OR similarity(b.city, partial_query) > 0.3
    )
  GROUP BY b.city, b.state
  
  ORDER BY relevance_score DESC, match_count DESC
  LIMIT suggestion_limit;
END;
$$ LANGUAGE plpgsql;

-- Popular searches tracking table
CREATE TABLE IF NOT EXISTS search_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  normalized_query text NOT NULL,
  result_count integer DEFAULT 0,
  click_through_rate numeric DEFAULT 0.0,
  response_time_ms integer DEFAULT 0,
  filters jsonb DEFAULT '{}',
  user_location geography,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT NOW(),
  
  -- Analytics indexes
  INDEX idx_search_analytics_query (normalized_query),
  INDEX idx_search_analytics_created_at (created_at),
  INDEX idx_search_analytics_user_id (user_id)
);

-- Function to track search analytics
CREATE OR REPLACE FUNCTION track_search_analytics(
  search_query text,
  result_count integer,
  response_time_ms integer DEFAULT 0,
  search_filters jsonb DEFAULT '{}',
  user_location geography DEFAULT NULL,
  user_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  analytics_id uuid;
  normalized_query text;
BEGIN
  -- Normalize the query for better analytics
  normalized_query := lower(trim(search_query));
  
  INSERT INTO search_analytics (
    query,
    normalized_query,
    result_count,
    response_time_ms,
    filters,
    user_location,
    user_id
  ) VALUES (
    search_query,
    normalized_query,
    result_count,
    response_time_ms,
    search_filters,
    user_location,
    user_id
  ) RETURNING id INTO analytics_id;
  
  RETURN analytics_id;
END;
$$ LANGUAGE plpgsql;

-- Popular searches view
CREATE OR REPLACE VIEW popular_searches AS
SELECT 
  normalized_query,
  COUNT(*) as search_count,
  AVG(result_count) as avg_results,
  AVG(response_time_ms) as avg_response_time,
  MAX(created_at) as last_searched
FROM search_analytics
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY normalized_query
HAVING COUNT(*) >= 3
ORDER BY search_count DESC, last_searched DESC
LIMIT 50;

-- Search performance monitoring view
CREATE OR REPLACE VIEW search_performance_metrics AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_searches,
  AVG(response_time_ms) as avg_response_time,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95_response_time,
  AVG(result_count) as avg_results,
  COUNT(CASE WHEN result_count = 0 THEN 1 END) as zero_result_searches,
  (COUNT(CASE WHEN result_count = 0 THEN 1 END)::numeric / COUNT(*) * 100) as zero_result_rate
FROM search_analytics
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION search_businesses_advanced TO authenticated, anon;
GRANT EXECUTE ON FUNCTION search_businesses_nearby TO authenticated, anon;  
GRANT EXECUTE ON FUNCTION get_search_suggestions TO authenticated, anon;
GRANT EXECUTE ON FUNCTION track_search_analytics TO authenticated, anon;
GRANT SELECT ON popular_searches TO authenticated;
GRANT SELECT ON search_performance_metrics TO authenticated;

-- Row Level Security for search analytics
ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own analytics
CREATE POLICY "Users can insert search analytics" ON search_analytics
  FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Policy: Users can view their own analytics  
CREATE POLICY "Users can view own search analytics" ON search_analytics
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

COMMENT ON FUNCTION search_businesses_advanced IS 'Advanced search with full-text search, fuzzy matching, and multiple filter options';
COMMENT ON FUNCTION search_businesses_nearby IS 'Geographic search optimized for PostGIS with distance-based relevance';
COMMENT ON FUNCTION get_search_suggestions IS 'Intelligent search suggestions with business names, categories, and locations';
COMMENT ON FUNCTION track_search_analytics IS 'Track search queries for analytics and performance monitoring';
COMMENT ON TABLE search_analytics IS 'Search analytics and performance tracking table';
COMMENT ON VIEW popular_searches IS 'Popular search queries in the last 30 days';
COMMENT ON VIEW search_performance_metrics IS 'Daily search performance metrics and monitoring';