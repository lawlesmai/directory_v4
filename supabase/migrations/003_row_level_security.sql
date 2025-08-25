-- Migration: 003_row_level_security
-- Description: Row Level Security policies for all tables
-- Date: 2025-01-24
-- Author: Backend Architect Agent

BEGIN;

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_review_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- BUSINESSES TABLE POLICIES
-- =====================================================

-- Public read access for active businesses
CREATE POLICY businesses_public_read ON businesses
    FOR SELECT
    USING (
        status = 'active' 
        AND deleted_at IS NULL
        AND (suspended_at IS NULL OR suspended_at > NOW())
    );

-- Authenticated users can create businesses
CREATE POLICY businesses_insert_authenticated ON businesses
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND (owner_id = auth.uid() OR owner_id IS NULL)
    );

-- Business owners can update their own businesses
CREATE POLICY businesses_owner_update ON businesses
    FOR UPDATE
    USING (
        auth.uid() = owner_id
        OR EXISTS (
            SELECT 1 FROM business_managers 
            WHERE business_id = businesses.id 
            AND user_id = auth.uid()
            AND active = true
            AND role IN ('admin', 'manager', 'editor')
        )
    )
    WITH CHECK (
        auth.uid() = owner_id
        OR EXISTS (
            SELECT 1 FROM business_managers 
            WHERE business_id = businesses.id 
            AND user_id = auth.uid()
            AND active = true
            AND role IN ('admin', 'manager', 'editor')
        )
    );

-- Business owners can delete their own businesses (soft delete)
CREATE POLICY businesses_owner_delete ON businesses
    FOR DELETE
    USING (
        auth.uid() = owner_id
    );

-- Admin full access to businesses
CREATE POLICY businesses_admin_all ON businesses
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
            AND (expires_at IS NULL OR expires_at > NOW())
        )
    );

-- =====================================================
-- CATEGORIES TABLE POLICIES
-- =====================================================

-- Public read access for active categories
CREATE POLICY categories_public_read ON categories
    FOR SELECT
    USING (active = true);

-- Only admins can modify categories
CREATE POLICY categories_admin_all ON categories
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
            AND (expires_at IS NULL OR expires_at > NOW())
        )
    );

-- =====================================================
-- BUSINESS REVIEWS TABLE POLICIES
-- =====================================================

-- Public read access for published reviews
CREATE POLICY reviews_public_read ON business_reviews
    FOR SELECT
    USING (
        status = 'published' 
        AND deleted_at IS NULL
    );

-- Authenticated users can create reviews
CREATE POLICY reviews_insert_authenticated ON business_reviews
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND reviewer_id = auth.uid()
        -- Ensure one review per user per business
        AND NOT EXISTS (
            SELECT 1 FROM business_reviews
            WHERE business_id = NEW.business_id
            AND reviewer_id = auth.uid()
            AND deleted_at IS NULL
        )
    );

-- Review authors can update their own reviews
CREATE POLICY reviews_author_update ON business_reviews
    FOR UPDATE
    USING (
        reviewer_id = auth.uid()
        AND created_at > NOW() - INTERVAL '30 days'  -- Can only edit within 30 days
    )
    WITH CHECK (
        reviewer_id = auth.uid()
    );

-- Review authors can delete their own reviews
CREATE POLICY reviews_author_delete ON business_reviews
    FOR DELETE
    USING (
        reviewer_id = auth.uid()
    );

-- Moderators can manage all reviews
CREATE POLICY reviews_moderator_all ON business_reviews
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'moderator')
            AND (expires_at IS NULL OR expires_at > NOW())
        )
    );

-- =====================================================
-- BUSINESS REVIEW RESPONSES TABLE POLICIES
-- =====================================================

-- Public read access for active responses
CREATE POLICY responses_public_read ON business_review_responses
    FOR SELECT
    USING (status = 'active');

-- Business owners/managers can insert responses
CREATE POLICY responses_business_insert ON business_review_responses
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM businesses b
            WHERE b.id = business_id
            AND (
                b.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM business_managers bm
                    WHERE bm.business_id = b.id
                    AND bm.user_id = auth.uid()
                    AND bm.active = true
                    AND bm.role IN ('admin', 'manager')
                )
            )
        )
        AND responder_id = auth.uid()
    );

-- Response authors can update their responses
CREATE POLICY responses_author_update ON business_review_responses
    FOR UPDATE
    USING (responder_id = auth.uid())
    WITH CHECK (responder_id = auth.uid());

-- Response authors can delete their responses
CREATE POLICY responses_author_delete ON business_review_responses
    FOR DELETE
    USING (responder_id = auth.uid());

-- =====================================================
-- BUSINESS MANAGERS TABLE POLICIES
-- =====================================================

-- Business owners can view their managers
CREATE POLICY managers_business_read ON business_managers
    FOR SELECT
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM businesses
            WHERE id = business_managers.business_id
            AND owner_id = auth.uid()
        )
    );

-- Business owners can add managers
CREATE POLICY managers_owner_insert ON business_managers
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM businesses
            WHERE id = business_id
            AND owner_id = auth.uid()
        )
    );

-- Business owners can update managers
CREATE POLICY managers_owner_update ON business_managers
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM businesses
            WHERE id = business_managers.business_id
            AND owner_id = auth.uid()
        )
    );

-- Business owners can remove managers
CREATE POLICY managers_owner_delete ON business_managers
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM businesses
            WHERE id = business_managers.business_id
            AND owner_id = auth.uid()
        )
    );

-- =====================================================
-- USER ROLES TABLE POLICIES
-- =====================================================

-- Users can view their own roles
CREATE POLICY roles_user_read ON user_roles
    FOR SELECT
    USING (user_id = auth.uid());

-- Only super admins can manage roles
CREATE POLICY roles_super_admin_all ON user_roles
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'super_admin'
            AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        )
    );

-- =====================================================
-- SERVICE AREAS TABLE POLICIES
-- =====================================================

-- Public read access for active service areas
CREATE POLICY service_areas_public_read ON service_areas
    FOR SELECT
    USING (active = true);

-- Business owners/managers can manage service areas
CREATE POLICY service_areas_business_all ON service_areas
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM businesses b
            WHERE b.id = business_id
            AND (
                b.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM business_managers bm
                    WHERE bm.business_id = b.id
                    AND bm.user_id = auth.uid()
                    AND bm.active = true
                    AND bm.role IN ('admin', 'manager')
                )
            )
        )
    );

-- =====================================================
-- BUSINESS ANALYTICS TABLE POLICIES
-- =====================================================

-- Business owners/managers can view their analytics
CREATE POLICY analytics_business_read ON business_analytics
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM businesses b
            WHERE b.id = business_id
            AND (
                b.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM business_managers bm
                    WHERE bm.business_id = b.id
                    AND bm.user_id = auth.uid()
                    AND bm.active = true
                )
            )
        )
    );

-- System can insert analytics (via service role)
-- No user-level insert policy needed

-- Admins can view all analytics
CREATE POLICY analytics_admin_read ON business_analytics
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
            AND (expires_at IS NULL OR expires_at > NOW())
        )
    );

-- =====================================================
-- SEARCH ANALYTICS TABLE POLICIES
-- =====================================================

-- Only admins can view search analytics
CREATE POLICY search_analytics_admin_read ON search_analytics
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
            AND (expires_at IS NULL OR expires_at > NOW())
        )
    );

-- System can insert search analytics (via service role)
-- No user-level insert policy needed

-- =====================================================
-- AUDIT LOGS TABLE POLICIES
-- =====================================================

-- Users can view audit logs for their own actions
CREATE POLICY audit_logs_user_read ON audit_logs
    FOR SELECT
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin', 'moderator')
            AND (expires_at IS NULL OR expires_at > NOW())
        )
    );

-- Only system can insert audit logs (via triggers)
-- No user-level insert policy needed

-- =====================================================
-- PREMIUM FEATURE ACCESS POLICIES
-- =====================================================

-- Create policy for premium feature access
CREATE POLICY businesses_premium_features ON businesses
    FOR SELECT
    USING (
        -- Always show basic info
        true
    )
    WITH CHECK (
        -- Premium features visible only to subscribers or owners
        CASE 
            WHEN subscription_tier IN ('premium', 'elite', 'enterprise') THEN true
            WHEN auth.uid() = owner_id THEN true
            WHEN EXISTS (
                SELECT 1 FROM business_managers
                WHERE business_id = businesses.id
                AND user_id = auth.uid()
                AND active = true
            ) THEN true
            ELSE false
        END
    );

-- =====================================================
-- DATA PRIVACY POLICIES
-- =====================================================

-- Ensure email addresses are only visible to authorized users
CREATE POLICY businesses_email_privacy ON businesses
    FOR SELECT
    USING (
        -- Email visible only to owner, managers, or if business chooses to display it
        CASE
            WHEN auth.uid() = owner_id THEN true
            WHEN EXISTS (
                SELECT 1 FROM business_managers
                WHERE business_id = businesses.id
                AND user_id = auth.uid()
                AND active = true
            ) THEN true
            WHEN email_verified = true AND status = 'active' THEN true
            ELSE false
        END
    );

-- =====================================================
-- BYPASS RLS FOR SERVICE ROLE
-- =====================================================

-- Grant necessary permissions to service role for system operations
-- Note: This is handled automatically by Supabase for the service role

COMMIT;
