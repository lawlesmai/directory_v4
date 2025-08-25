-- Migration: 002_functions_triggers
-- Description: Database functions, triggers, and helper procedures
-- Date: 2025-01-24
-- Author: Backend Architect Agent

BEGIN;

-- =====================================================
-- TRIGGER FUNCTIONS
-- =====================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update category path when parent changes
CREATE OR REPLACE FUNCTION update_category_path()
RETURNS TRIGGER AS $$
DECLARE
    parent_path TEXT[];
    parent_path_slugs TEXT[];
    parent_level INTEGER;
BEGIN
    IF NEW.parent_id IS NULL THEN
        NEW.path = ARRAY[NEW.name];
        NEW.path_slugs = ARRAY[NEW.slug];
        NEW.level = 0;
    ELSE
        SELECT path, path_slugs, level 
        INTO parent_path, parent_path_slugs, parent_level
        FROM categories 
        WHERE id = NEW.parent_id;
        
        NEW.path = parent_path || NEW.name;
        NEW.path_slugs = parent_path_slugs || NEW.slug;
        NEW.level = parent_level + 1;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update business quality score based on reviews and other factors
CREATE OR REPLACE FUNCTION update_business_quality_score()
RETURNS TRIGGER AS $$
DECLARE
    new_score DECIMAL(3,2);
    avg_rating DECIMAL(3,2);
    review_count INTEGER;
    is_verified BOOLEAN;
    is_premium BOOLEAN;
BEGIN
    -- Get review statistics
    SELECT 
        AVG(rating)::DECIMAL(3,2),
        COUNT(*)
    INTO avg_rating, review_count
    FROM business_reviews
    WHERE business_id = COALESCE(NEW.business_id, OLD.business_id)
    AND status = 'published'
    AND deleted_at IS NULL;
    
    -- Get business status
    SELECT 
        verification_status = 'verified',
        subscription_tier != 'free'
    INTO is_verified, is_premium
    FROM businesses
    WHERE id = COALESCE(NEW.business_id, OLD.business_id);
    
    -- Calculate quality score (weighted formula)
    new_score := LEAST(5.0, GREATEST(0.0,
        COALESCE(avg_rating * 0.4, 0) +                           -- 40% weight on average rating
        (LEAST(review_count, 50) / 50.0 * 5.0 * 0.3) +          -- 30% weight on review count (capped at 50)
        (CASE WHEN is_verified THEN 5.0 ELSE 0.0 END * 0.2) +   -- 20% weight on verification
        (CASE WHEN is_premium THEN 5.0 ELSE 0.0 END * 0.1)      -- 10% weight on premium status
    ));
    
    -- Update the business quality score
    UPDATE businesses 
    SET quality_score = new_score
    WHERE id = COALESCE(NEW.business_id, OLD.business_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Audit log trigger function
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    request_headers jsonb;
BEGIN
    -- Safely get request headers if available
    BEGIN
        request_headers := current_setting('request.headers', true)::jsonb;
    EXCEPTION WHEN OTHERS THEN
        request_headers := '{}'::jsonb;
    END;

    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (
            table_name, record_id, action, user_id,
            old_values, ip_address, user_agent
        ) VALUES (
            TG_TABLE_NAME,
            OLD.id,
            TG_OP,
            auth.uid(),
            to_jsonb(OLD),
            (request_headers->>'x-forwarded-for')::inet,
            request_headers->>'user-agent'
        );
        RETURN OLD;
    ELSE
        INSERT INTO audit_logs (
            table_name, record_id, action, user_id,
            old_values, new_values, changed_fields, ip_address, user_agent
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
            (request_headers->>'x-forwarded-for')::inet,
            request_headers->>'user-agent'
        );
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Update category business counts
CREATE OR REPLACE FUNCTION update_category_business_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.primary_category_id != OLD.primary_category_id) THEN
        -- Increment new category
        UPDATE categories 
        SET business_count = business_count + 1
        WHERE id = NEW.primary_category_id;
        
        -- Decrement old category if updating
        IF TG_OP = 'UPDATE' THEN
            UPDATE categories 
            SET business_count = business_count - 1
            WHERE id = OLD.primary_category_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement category
        UPDATE categories 
        SET business_count = business_count - 1
        WHERE id = OLD.primary_category_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- APPLY TRIGGERS
-- =====================================================

-- Updated timestamp triggers
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

CREATE TRIGGER update_review_responses_updated_at
    BEFORE UPDATE ON business_review_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_managers_updated_at
    BEFORE UPDATE ON business_managers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_service_areas_updated_at
    BEFORE UPDATE ON service_areas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Category path trigger
CREATE TRIGGER update_category_path_trigger
    BEFORE INSERT OR UPDATE OF parent_id, name, slug ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_category_path();

-- Quality score trigger
CREATE TRIGGER update_quality_score_on_review
    AFTER INSERT OR UPDATE OR DELETE ON business_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_business_quality_score();

-- Category business count trigger
CREATE TRIGGER update_category_count_on_business
    AFTER INSERT OR UPDATE OF primary_category_id OR DELETE ON businesses
    FOR EACH ROW
    WHEN (NEW.status = 'active' OR OLD.status = 'active')
    EXECUTE FUNCTION update_category_business_count();

-- Audit triggers for critical tables
CREATE TRIGGER audit_businesses
    AFTER INSERT OR UPDATE OR DELETE ON businesses
    FOR EACH ROW
    EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_reviews
    AFTER INSERT OR UPDATE OR DELETE ON business_reviews
    FOR EACH ROW
    EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_user_roles
    AFTER INSERT OR UPDATE OR DELETE ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION create_audit_log();

-- =====================================================
-- SEARCH AND QUERY FUNCTIONS
-- =====================================================

-- Find nearby businesses with distance calculation
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
    address VARCHAR,
    city VARCHAR,
    state VARCHAR,
    distance_meters FLOAT,
    bearing_degrees FLOAT,
    rating DECIMAL,
    review_count BIGINT,
    is_premium BOOLEAN,
    is_verified BOOLEAN,
    logo_url VARCHAR,
    business_hours JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id,
        b.slug,
        b.name,
        b.short_description as description,
        c.name as category_name,
        b.address_line_1 as address,
        b.city,
        b.state,
        ST_Distance(b.location, user_location) as distance_meters,
        degrees(ST_Azimuth(user_location::geometry, b.location::geometry)) as bearing_degrees,
        b.quality_score as rating,
        (SELECT COUNT(*) FROM business_reviews br WHERE br.business_id = b.id AND br.status = 'published')::BIGINT as review_count,
        b.subscription_tier != 'free' as is_premium,
        b.verification_status = 'verified' as is_verified,
        b.logo_url,
        b.business_hours
    FROM businesses b
    LEFT JOIN categories c ON b.primary_category_id = c.id
    WHERE 
        ST_DWithin(b.location, user_location, radius_meters)
        AND b.status = 'active'
        AND b.deleted_at IS NULL
        AND (category_filter IS NULL OR b.primary_category_id = category_filter)
    ORDER BY 
        b.subscription_tier != 'free' DESC,  -- Premium businesses first
        ST_Distance(b.location, user_location),
        b.quality_score DESC NULLS LAST
    LIMIT limit_count
    OFFSET offset_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Advanced search function with relevance ranking
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
    address VARCHAR,
    city VARCHAR,
    state VARCHAR,
    relevance_score FLOAT,
    distance_meters FLOAT,
    rating DECIMAL,
    review_count BIGINT,
    is_premium BOOLEAN,
    is_verified BOOLEAN,
    logo_url VARCHAR
) AS $$
DECLARE
    tsquery_value tsquery;
BEGIN
    -- Convert search query to tsquery
    tsquery_value := websearch_to_tsquery('english', search_query);
    
    RETURN QUERY
    WITH search_results AS (
        SELECT 
            b.id,
            b.slug,
            b.name,
            b.short_description as description,
            c.name as category_name,
            b.address_line_1 as address,
            b.city,
            b.state,
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
            b.quality_score as rating,
            (SELECT COUNT(*) FROM business_reviews br WHERE br.business_id = b.id AND br.status = 'published')::BIGINT as review_count,
            b.subscription_tier != 'free' as is_premium,
            b.verification_status = 'verified' as is_verified,
            b.logo_url
        FROM businesses b
        LEFT JOIN categories c ON b.primary_category_id = c.id
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
        address,
        city,
        state,
        (text_rank * 0.6 + name_similarity * 0.4)::FLOAT as relevance_score,
        distance as distance_meters,
        rating,
        review_count,
        is_premium,
        is_verified,
        logo_url
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

-- Get business with full details
CREATE OR REPLACE FUNCTION get_business_details(business_slug VARCHAR)
RETURNS TABLE(
    business JSONB,
    reviews JSONB,
    stats JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH business_data AS (
        SELECT 
            jsonb_build_object(
                'id', b.id,
                'slug', b.slug,
                'name', b.name,
                'description', b.description,
                'shortDescription', b.short_description,
                'category', jsonb_build_object(
                    'id', c.id,
                    'name', c.name,
                    'slug', c.slug,
                    'icon', c.icon
                ),
                'contact', jsonb_build_object(
                    'phone', b.phone,
                    'email', b.email,
                    'website', b.website
                ),
                'location', jsonb_build_object(
                    'address', b.address_line_1,
                    'address2', b.address_line_2,
                    'city', b.city,
                    'state', b.state,
                    'zipCode', b.zip_code,
                    'coordinates', CASE 
                        WHEN b.location IS NOT NULL 
                        THEN jsonb_build_object(
                            'lat', ST_Y(b.location::geometry),
                            'lng', ST_X(b.location::geometry)
                        )
                        ELSE NULL
                    END
                ),
                'businessHours', b.business_hours,
                'media', jsonb_build_object(
                    'logo', b.logo_url,
                    'coverImage', b.cover_image_url,
                    'gallery', b.gallery,
                    'videos', b.video_urls
                ),
                'socialMedia', b.social_media,
                'verification', jsonb_build_object(
                    'status', b.verification_status,
                    'date', b.verification_date
                ),
                'premium', b.subscription_tier != 'free',
                'featured', b.featured_until > NOW(),
                'qualityScore', b.quality_score,
                'createdAt', b.created_at,
                'updatedAt', b.updated_at
            ) as business_json
        FROM businesses b
        LEFT JOIN categories c ON b.primary_category_id = c.id
        WHERE b.slug = business_slug
        AND b.status = 'active'
        AND b.deleted_at IS NULL
    ),
    review_data AS (
        SELECT 
            jsonb_agg(
                jsonb_build_object(
                    'id', r.id,
                    'rating', r.rating,
                    'title', r.title,
                    'content', r.content,
                    'photos', r.photos,
                    'helpfulCount', r.helpful_count,
                    'createdAt', r.created_at,
                    'response', CASE 
                        WHEN rr.id IS NOT NULL 
                        THEN jsonb_build_object(
                            'id', rr.id,
                            'content', rr.content,
                            'createdAt', rr.created_at
                        )
                        ELSE NULL
                    END
                ) ORDER BY r.created_at DESC
            ) as reviews_json
        FROM business_reviews r
        LEFT JOIN business_review_responses rr ON r.id = rr.review_id
        WHERE r.business_id = (SELECT (business_json->>'id')::UUID FROM business_data)
        AND r.status = 'published'
        AND r.deleted_at IS NULL
        LIMIT 10
    ),
    stats_data AS (
        SELECT 
            jsonb_build_object(
                'totalReviews', COUNT(*),
                'averageRating', ROUND(AVG(rating)::numeric, 2),
                'ratingDistribution', jsonb_build_object(
                    '5', COUNT(*) FILTER (WHERE rating = 5),
                    '4', COUNT(*) FILTER (WHERE rating = 4),
                    '3', COUNT(*) FILTER (WHERE rating = 3),
                    '2', COUNT(*) FILTER (WHERE rating = 2),
                    '1', COUNT(*) FILTER (WHERE rating = 1)
                )
            ) as stats_json
        FROM business_reviews
        WHERE business_id = (SELECT (business_json->>'id')::UUID FROM business_data)
        AND status = 'published'
        AND deleted_at IS NULL
    )
    SELECT 
        (SELECT business_json FROM business_data),
        COALESCE((SELECT reviews_json FROM review_data), '[]'::jsonb),
        COALESCE((SELECT stats_json FROM stats_data), '{}'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- SECURITY HELPER FUNCTIONS
-- =====================================================

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

-- Get user's business permissions
CREATE OR REPLACE FUNCTION auth.get_business_permissions(business_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    user_permissions JSONB;
BEGIN
    -- Check if owner
    IF EXISTS (SELECT 1 FROM businesses WHERE id = business_uuid AND owner_id = auth.uid()) THEN
        RETURN jsonb_build_object(
            'role', 'owner',
            'canEdit', true,
            'canDelete', true,
            'canManageUsers', true,
            'canViewAnalytics', true,
            'canManageSubscription', true
        );
    END IF;
    
    -- Check if manager
    SELECT permissions 
    INTO user_permissions
    FROM business_managers
    WHERE business_id = business_uuid
    AND user_id = auth.uid()
    AND active = true;
    
    IF user_permissions IS NOT NULL THEN
        RETURN user_permissions;
    END IF;
    
    -- No permissions
    RETURN '{}'::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log security events
CREATE OR REPLACE FUNCTION log_security_event(
    event_type TEXT,
    event_data JSONB,
    severity TEXT DEFAULT 'info'
)
RETURNS VOID AS $$
DECLARE
    request_headers jsonb;
BEGIN
    -- Safely get request headers if available
    BEGIN
        request_headers := current_setting('request.headers', true)::jsonb;
    EXCEPTION WHEN OTHERS THEN
        request_headers := '{}'::jsonb;
    END;

    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        user_id,
        new_values,
        ip_address,
        user_agent,
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
        (request_headers->>'x-forwarded-for')::inet,
        request_headers->>'user-agent',
        NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
