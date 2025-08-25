-- Create function to search businesses near a location using PostGIS
CREATE OR REPLACE FUNCTION businesses_near_location(
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    radius_miles INTEGER DEFAULT 25
)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    slug VARCHAR,
    short_description VARCHAR,
    city VARCHAR,
    state VARCHAR,
    distance_miles DOUBLE PRECISION,
    quality_score DECIMAL,
    subscription_tier VARCHAR,
    logo_url VARCHAR,
    primary_category_id UUID
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        b.id,
        b.name,
        b.slug,
        b.short_description,
        b.city,
        b.state,
        ST_Distance(
            b.location::geography,
            ST_SetSRID(ST_Point(lng, lat), 4326)::geography
        ) * 0.000621371 as distance_miles,
        b.quality_score,
        b.subscription_tier,
        b.logo_url,
        b.primary_category_id
    FROM businesses b
    WHERE b.status = 'active'
    AND b.deleted_at IS NULL
    AND b.published_at IS NOT NULL
    AND b.location IS NOT NULL
    AND ST_DWithin(
        b.location::geography,
        ST_SetSRID(ST_Point(lng, lat), 4326)::geography,
        radius_miles * 1609.34  -- Convert miles to meters
    )
    ORDER BY b.location::geography <-> ST_SetSRID(ST_Point(lng, lat), 4326)::geography;
$$;

-- Create function to get business statistics
CREATE OR REPLACE FUNCTION get_business_stats(business_uuid UUID)
RETURNS JSON
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    SELECT json_build_object(
        'total_reviews', COALESCE((
            SELECT COUNT(*) FROM business_reviews 
            WHERE business_id = business_uuid 
            AND status = 'approved' 
            AND deleted_at IS NULL
        ), 0),
        'average_rating', COALESCE((
            SELECT ROUND(AVG(rating)::numeric, 2) FROM business_reviews 
            WHERE business_id = business_uuid 
            AND status = 'approved' 
            AND deleted_at IS NULL
        ), 0),
        'rating_distribution', COALESCE((
            SELECT json_object_agg(rating, count)
            FROM (
                SELECT rating, COUNT(*) as count
                FROM business_reviews 
                WHERE business_id = business_uuid 
                AND status = 'approved' 
                AND deleted_at IS NULL
                GROUP BY rating
                ORDER BY rating
            ) rating_counts
        ), '{}'),
        'recent_reviews', COALESCE((
            SELECT COUNT(*) FROM business_reviews 
            WHERE business_id = business_uuid 
            AND status = 'approved' 
            AND deleted_at IS NULL
            AND created_at > NOW() - INTERVAL '30 days'
        ), 0)
    );
$$;

-- Create function to update business quality score
CREATE OR REPLACE FUNCTION update_business_quality_score(business_uuid UUID)
RETURNS DECIMAL
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
DECLARE
    avg_rating DECIMAL;
    review_count INTEGER;
    recency_factor DECIMAL;
    verification_bonus DECIMAL;
    quality_score DECIMAL;
BEGIN
    -- Get average rating and review count
    SELECT 
        COALESCE(AVG(rating), 0),
        COUNT(*)
    INTO avg_rating, review_count
    FROM business_reviews
    WHERE business_id = business_uuid
    AND status = 'approved'
    AND deleted_at IS NULL;
    
    -- Calculate recency factor (more recent reviews weighted higher)
    SELECT COALESCE(AVG(
        CASE 
            WHEN created_at > NOW() - INTERVAL '30 days' THEN 1.0
            WHEN created_at > NOW() - INTERVAL '90 days' THEN 0.8
            WHEN created_at > NOW() - INTERVAL '180 days' THEN 0.6
            ELSE 0.4
        END
    ), 0.5) INTO recency_factor
    FROM business_reviews
    WHERE business_id = business_uuid
    AND status = 'approved'
    AND deleted_at IS NULL;
    
    -- Verification bonus
    SELECT CASE 
        WHEN verification_status = 'verified' THEN 0.2
        ELSE 0
    END INTO verification_bonus
    FROM businesses
    WHERE id = business_uuid;
    
    -- Calculate final quality score (0-5 scale)
    quality_score := LEAST(5.0, 
        (avg_rating * 0.7) + 
        (LEAST(review_count / 10.0, 1.0) * 0.8) + 
        (recency_factor * 0.3) + 
        verification_bonus
    );
    
    -- Update the business record
    UPDATE businesses 
    SET quality_score = quality_score,
        updated_at = NOW()
    WHERE id = business_uuid;
    
    RETURN quality_score;
END;
$$;

-- Create function to search businesses with full-text search
CREATE OR REPLACE FUNCTION search_businesses(
    search_query TEXT,
    category_filter UUID DEFAULT NULL,
    city_filter VARCHAR DEFAULT NULL,
    state_filter VARCHAR DEFAULT NULL,
    limit_results INTEGER DEFAULT 20,
    offset_results INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    slug VARCHAR,
    short_description VARCHAR,
    city VARCHAR,
    state VARCHAR,
    quality_score DECIMAL,
    subscription_tier VARCHAR,
    logo_url VARCHAR,
    primary_category_id UUID,
    search_rank REAL
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        b.id,
        b.name,
        b.slug,
        b.short_description,
        b.city,
        b.state,
        b.quality_score,
        b.subscription_tier,
        b.logo_url,
        b.primary_category_id,
        ts_rank(
            to_tsvector('english', 
                coalesce(b.name, '') || ' ' || 
                coalesce(b.description, '') || ' ' ||
                coalesce(b.short_description, '') || ' ' ||
                array_to_string(b.tags, ' ')
            ),
            plainto_tsquery('english', search_query)
        ) as search_rank
    FROM businesses b
    WHERE b.status = 'active'
    AND b.deleted_at IS NULL
    AND b.published_at IS NOT NULL
    AND to_tsvector('english', 
        coalesce(b.name, '') || ' ' || 
        coalesce(b.description, '') || ' ' ||
        coalesce(b.short_description, '') || ' ' ||
        array_to_string(b.tags, ' ')
    ) @@ plainto_tsquery('english', search_query)
    AND (category_filter IS NULL OR b.primary_category_id = category_filter)
    AND (city_filter IS NULL OR b.city ILIKE '%' || city_filter || '%')
    AND (state_filter IS NULL OR b.state ILIKE '%' || state_filter || '%')
    ORDER BY search_rank DESC, b.quality_score DESC
    LIMIT limit_results
    OFFSET offset_results;
$$;

-- Create function to get trending businesses
CREATE OR REPLACE FUNCTION get_trending_businesses(
    days_back INTEGER DEFAULT 7,
    limit_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    slug VARCHAR,
    city VARCHAR,
    state VARCHAR,
    view_count INTEGER,
    recent_views INTEGER,
    quality_score DECIMAL,
    subscription_tier VARCHAR,
    logo_url VARCHAR
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        b.id,
        b.name,
        b.slug,
        b.city,
        b.state,
        b.view_count,
        -- Calculate recent views (would need a views table for accurate tracking)
        GREATEST(b.view_count - LAG(b.view_count, 1, 0) OVER (ORDER BY b.updated_at), 0) as recent_views,
        b.quality_score,
        b.subscription_tier,
        b.logo_url
    FROM businesses b
    WHERE b.status = 'active'
    AND b.deleted_at IS NULL
    AND b.published_at IS NOT NULL
    AND b.last_activity_at > NOW() - INTERVAL '1' DAY * days_back
    ORDER BY recent_views DESC, b.quality_score DESC, b.view_count DESC
    LIMIT limit_results;
$$;

-- Create function to get category statistics
CREATE OR REPLACE FUNCTION get_category_stats(category_uuid UUID)
RETURNS JSON
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    SELECT json_build_object(
        'total_businesses', COALESCE((
            SELECT COUNT(*) FROM businesses 
            WHERE primary_category_id = category_uuid 
            AND status = 'active' 
            AND deleted_at IS NULL
        ), 0),
        'verified_businesses', COALESCE((
            SELECT COUNT(*) FROM businesses 
            WHERE primary_category_id = category_uuid 
            AND status = 'active' 
            AND deleted_at IS NULL
            AND verification_status = 'verified'
        ), 0),
        'premium_businesses', COALESCE((
            SELECT COUNT(*) FROM businesses 
            WHERE primary_category_id = category_uuid 
            AND status = 'active' 
            AND deleted_at IS NULL
            AND subscription_tier IN ('premium', 'enterprise')
        ), 0),
        'average_quality_score', COALESCE((
            SELECT ROUND(AVG(quality_score)::numeric, 2) FROM businesses 
            WHERE primary_category_id = category_uuid 
            AND status = 'active' 
            AND deleted_at IS NULL
        ), 0)
    );
$$;

-- Create trigger to automatically update quality scores when reviews change
CREATE OR REPLACE FUNCTION trigger_update_business_quality_score()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_business_quality_score(
        CASE 
            WHEN TG_OP = 'DELETE' THEN OLD.business_id
            ELSE NEW.business_id
        END
    );
    
    RETURN CASE 
        WHEN TG_OP = 'DELETE' THEN OLD
        ELSE NEW
    END;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic quality score updates
CREATE TRIGGER trigger_business_reviews_quality_update
    AFTER INSERT OR UPDATE OR DELETE ON business_reviews
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_business_quality_score();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION businesses_near_location TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_business_stats TO authenticated, anon;
GRANT EXECUTE ON FUNCTION search_businesses TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_trending_businesses TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_category_stats TO authenticated, anon;