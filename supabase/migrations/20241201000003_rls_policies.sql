-- Enable Row Level Security on all tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_reviews ENABLE ROW LEVEL SECURITY;

-- Create user roles table for role-based access control
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ,
    active BOOLEAN DEFAULT TRUE,
    
    UNIQUE(user_id, role),
    CHECK (role IN ('admin', 'super_admin', 'moderator', 'business_owner', 'verified_user'))
);

-- Create business managers table for multi-user business management
CREATE TABLE IF NOT EXISTS business_managers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'manager',
    permissions JSONB DEFAULT '{}',
    invited_by UUID REFERENCES auth.users(id),
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    
    UNIQUE(business_id, user_id),
    CHECK (role IN ('owner', 'manager', 'editor', 'viewer'))
);

-- Helper function to check if user has admin role
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = user_uuid
        AND role IN ('admin', 'super_admin')
        AND active = true
        AND (expires_at IS NULL OR expires_at > NOW())
    );
$$;

-- Helper function to check if user is business owner or manager
CREATE OR REPLACE FUNCTION can_manage_business(business_uuid UUID, user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM businesses
        WHERE id = business_uuid
        AND owner_id = user_uuid
    ) OR EXISTS (
        SELECT 1 FROM business_managers
        WHERE business_id = business_uuid
        AND user_id = user_uuid
        AND role IN ('owner', 'manager', 'editor')
        AND accepted_at IS NOT NULL
    );
$$;

-- Categories RLS Policies
-- Public read access for active categories
CREATE POLICY categories_public_read ON categories
    FOR SELECT
    USING (active = true);

-- Admin full access
CREATE POLICY categories_admin_all ON categories
    FOR ALL
    USING (is_admin());

-- Businesses RLS Policies
-- Public read access for active, published businesses
CREATE POLICY businesses_public_read ON businesses
    FOR SELECT
    USING (
        status = 'active' 
        AND deleted_at IS NULL
        AND (suspended_at IS NULL OR suspended_at < NOW())
        AND published_at IS NOT NULL
        AND published_at <= NOW()
    );

-- Business owners can manage their own businesses
CREATE POLICY businesses_owner_all ON businesses
    FOR ALL
    USING (can_manage_business(id))
    WITH CHECK (can_manage_business(id));

-- Business owners can insert new businesses
CREATE POLICY businesses_owner_insert ON businesses
    FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

-- Admin full access
CREATE POLICY businesses_admin_all ON businesses
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- Authenticated users can view draft businesses they own for editing
CREATE POLICY businesses_owner_draft_read ON businesses
    FOR SELECT
    USING (
        auth.uid() = owner_id
        AND deleted_at IS NULL
    );

-- Business Reviews RLS Policies  
-- Public read access for approved reviews on active businesses
CREATE POLICY business_reviews_public_read ON business_reviews
    FOR SELECT
    USING (
        status = 'approved'
        AND deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM businesses b
            WHERE b.id = business_id
            AND b.status = 'active'
            AND b.deleted_at IS NULL
        )
    );

-- Authenticated users can create reviews
CREATE POLICY business_reviews_user_insert ON business_reviews
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = reviewer_id
        AND EXISTS (
            SELECT 1 FROM businesses b
            WHERE b.id = business_id
            AND b.status = 'active'
            AND b.deleted_at IS NULL
        )
    );

-- Users can update their own reviews (before approval)
CREATE POLICY business_reviews_user_update ON business_reviews
    FOR UPDATE
    USING (
        auth.uid() = reviewer_id
        AND status IN ('pending', 'flagged')
        AND deleted_at IS NULL
    )
    WITH CHECK (
        auth.uid() = reviewer_id
        AND status IN ('pending', 'flagged')
    );

-- Business owners can view all reviews for their businesses
CREATE POLICY business_reviews_business_owner_read ON business_reviews
    FOR SELECT
    USING (
        can_manage_business(business_id)
        AND deleted_at IS NULL
    );

-- Moderators can manage reviews
CREATE POLICY business_reviews_moderator_all ON business_reviews
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('moderator', 'admin', 'super_admin')
            AND active = true
        )
    );

-- Admin full access
CREATE POLICY business_reviews_admin_all ON business_reviews
    FOR ALL
    USING (is_admin());

-- User Roles RLS Policies
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Admins can manage roles
CREATE POLICY user_roles_admin_all ON user_roles
    FOR ALL
    USING (is_admin());

-- Users can view their own roles
CREATE POLICY user_roles_self_read ON user_roles
    FOR SELECT
    USING (auth.uid() = user_id);

-- Business Managers RLS Policies
ALTER TABLE business_managers ENABLE ROW LEVEL SECURITY;

-- Business owners can manage their business managers
CREATE POLICY business_managers_owner_all ON business_managers
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM businesses b
            WHERE b.id = business_id
            AND b.owner_id = auth.uid()
        )
    );

-- Managers can view their own manager records
CREATE POLICY business_managers_self_read ON business_managers
    FOR SELECT
    USING (auth.uid() = user_id);

-- Admin full access
CREATE POLICY business_managers_admin_all ON business_managers
    FOR ALL
    USING (is_admin());

-- Create indexes on RLS-related columns for performance
CREATE INDEX idx_user_roles_user_active ON user_roles(user_id) WHERE active = true;
CREATE INDEX idx_business_managers_business ON business_managers(business_id);
CREATE INDEX idx_business_managers_user ON business_managers(user_id);
CREATE INDEX idx_businesses_owner_status ON businesses(owner_id, status);

-- Grant appropriate permissions
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON categories TO authenticated;
GRANT ALL ON businesses TO authenticated;  
GRANT ALL ON business_reviews TO authenticated;
GRANT ALL ON user_roles TO authenticated;
GRANT ALL ON business_managers TO authenticated;