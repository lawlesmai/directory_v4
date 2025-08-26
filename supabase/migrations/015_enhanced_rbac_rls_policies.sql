-- Migration: 015_enhanced_rbac_rls_policies
-- Epic 2 Story 2.8: Row Level Security Policies for Enhanced RBAC System
-- Description: Comprehensive RLS policies for enhanced RBAC tables with performance optimization
-- Date: 2025-01-26
-- Author: Backend Architecture Expert

BEGIN;

-- =====================================================
-- ENABLE RLS ON ENHANCED RBAC TABLES
-- =====================================================

ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enhanced_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_hierarchy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enhanced_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_approvals ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- ROLE TEMPLATES POLICIES
-- =====================================================

-- All authenticated users can view active role templates
CREATE POLICY "Authenticated users can view role templates"
    ON public.role_templates FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Only super admins can manage role templates
CREATE POLICY "Super admins can manage role templates"
    ON public.role_templates FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name = 'super_admin'
            AND ur.is_active = true
        )
    );

-- =====================================================
-- PERMISSION RESOURCES POLICIES
-- =====================================================

-- All authenticated users can view active resources
CREATE POLICY "Authenticated users can view permission resources"
    ON public.permission_resources FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Only super admins can manage resources
CREATE POLICY "Super admins can manage permission resources"
    ON public.permission_resources FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name = 'super_admin'
            AND ur.is_active = true
        )
    );

-- =====================================================
-- PERMISSION ACTIONS POLICIES
-- =====================================================

-- All authenticated users can view active actions
CREATE POLICY "Authenticated users can view permission actions"
    ON public.permission_actions FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Only super admins can manage actions
CREATE POLICY "Super admins can manage permission actions"
    ON public.permission_actions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name = 'super_admin'
            AND ur.is_active = true
        )
    );

-- =====================================================
-- ENHANCED PERMISSIONS POLICIES
-- =====================================================

-- All authenticated users can view active permissions
CREATE POLICY "Authenticated users can view enhanced permissions"
    ON public.enhanced_permissions FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Only super admins can manage permissions
CREATE POLICY "Super admins can manage enhanced permissions"
    ON public.enhanced_permissions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name = 'super_admin'
            AND ur.is_active = true
        )
    );

-- =====================================================
-- PERMISSION DEPENDENCIES POLICIES
-- =====================================================

-- All authenticated users can view permission dependencies
CREATE POLICY "Authenticated users can view permission dependencies"
    ON public.permission_dependencies FOR SELECT
    TO authenticated
    USING (true);

-- Only super admins can manage dependencies
CREATE POLICY "Super admins can manage permission dependencies"
    ON public.permission_dependencies FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name = 'super_admin'
            AND ur.is_active = true
        )
    );

-- =====================================================
-- ROLE HIERARCHY POLICIES
-- =====================================================

-- All authenticated users can view active role hierarchy
CREATE POLICY "Authenticated users can view role hierarchy"
    ON public.role_hierarchy FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Only super admins can manage role hierarchy
CREATE POLICY "Super admins can manage role hierarchy"
    ON public.role_hierarchy FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name = 'super_admin'
            AND ur.is_active = true
        )
    );

-- =====================================================
-- ENHANCED ROLE PERMISSIONS POLICIES
-- =====================================================

-- Users can view role permissions for their own roles
CREATE POLICY "Users can view own role permissions"
    ON public.enhanced_role_permissions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role_id = enhanced_role_permissions.role_id
            AND ur.is_active = true
        )
    );

-- Admins can view all role permissions
CREATE POLICY "Admins can view all enhanced role permissions"
    ON public.enhanced_role_permissions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin', 'moderator')
            AND ur.is_active = true
        )
    );

-- Only super admins can manage enhanced role permissions
CREATE POLICY "Super admins can manage enhanced role permissions"
    ON public.enhanced_role_permissions FOR INSERT, UPDATE, DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name = 'super_admin'
            AND ur.is_active = true
        )
    );

-- =====================================================
-- BUSINESS PERMISSIONS POLICIES
-- =====================================================

-- Users can view their own business permissions
CREATE POLICY "Users can view own business permissions"
    ON public.business_permissions FOR SELECT
    USING (auth.uid() = user_id);

-- Business owners can view permissions for their businesses
CREATE POLICY "Business owners can view business permissions"
    ON public.business_permissions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM businesses
            WHERE id = business_permissions.business_id
            AND owner_id = auth.uid()
        )
    );

-- Users with business management permissions can view business permissions
CREATE POLICY "Business managers can view business permissions"
    ON public.business_permissions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM business_permissions bp
            WHERE bp.business_id = business_permissions.business_id
            AND bp.user_id = auth.uid()
            AND bp.permission_level IN ('admin', 'full')
            AND bp.is_active = true
            AND bp.employment_status = 'active'
        )
    );

-- Admins can view all business permissions
CREATE POLICY "Admins can view all business permissions"
    ON public.business_permissions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin')
            AND ur.is_active = true
        )
    );

-- Business owners can assign permissions for their businesses
CREATE POLICY "Business owners can assign business permissions"
    ON public.business_permissions FOR INSERT, UPDATE
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM businesses
            WHERE id = business_permissions.business_id
            AND owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM business_permissions bp
            WHERE bp.business_id = business_permissions.business_id
            AND bp.user_id = auth.uid()
            AND bp.permission_level = 'full'
            AND bp.is_active = true
            AND bp.employment_status = 'active'
        )
        OR
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin')
            AND ur.is_active = true
        )
    );

-- Business owners can revoke permissions for their businesses
CREATE POLICY "Business owners can revoke business permissions"
    ON public.business_permissions FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM businesses
            WHERE id = business_permissions.business_id
            AND owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM business_permissions bp
            WHERE bp.business_id = business_permissions.business_id
            AND bp.user_id = auth.uid()
            AND bp.permission_level = 'full'
            AND bp.is_active = true
            AND bp.employment_status = 'active'
        )
        OR
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin')
            AND ur.is_active = true
        )
    );

-- =====================================================
-- PERMISSION CACHE POLICIES
-- =====================================================

-- Users can only access their own permission cache
CREATE POLICY "Users can only access own permission cache"
    ON public.permission_cache FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert/update their own cache
CREATE POLICY "Users can manage own permission cache"
    ON public.permission_cache FOR INSERT, UPDATE
    WITH CHECK (auth.uid() = user_id);

-- Service role can manage all cache entries
CREATE POLICY "Service role can manage all permission cache"
    ON public.permission_cache FOR ALL
    TO service_role
    USING (true);

-- Cache cleanup - expired entries can be deleted by anyone with admin role
CREATE POLICY "Admins can cleanup expired cache"
    ON public.permission_cache FOR DELETE
    USING (
        expires_at <= NOW()
        OR
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin')
            AND ur.is_active = true
        )
    );

-- =====================================================
-- PERMISSION APPROVALS POLICIES
-- =====================================================

-- Users can view approval requests they made
CREATE POLICY "Users can view own approval requests"
    ON public.permission_approvals FOR SELECT
    USING (auth.uid() = requested_by_user_id);

-- Users can view approval requests made for them
CREATE POLICY "Users can view approval requests for them"
    ON public.permission_approvals FOR SELECT
    USING (auth.uid() = requested_for_user_id);

-- Admins can view all approval requests
CREATE POLICY "Admins can view all approval requests"
    ON public.permission_approvals FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin')
            AND ur.is_active = true
        )
    );

-- Users can create approval requests
CREATE POLICY "Users can create approval requests"
    ON public.permission_approvals FOR INSERT
    WITH CHECK (
        auth.uid() = requested_by_user_id
        AND
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin', 'moderator', 'business_owner')
            AND ur.is_active = true
        )
    );

-- Users can withdraw their own requests
CREATE POLICY "Users can withdraw own approval requests"
    ON public.permission_approvals FOR UPDATE
    USING (
        auth.uid() = requested_by_user_id
        AND approval_status = 'pending'
    )
    WITH CHECK (
        auth.uid() = requested_by_user_id
        AND approval_status IN ('pending', 'withdrawn')
    );

-- Admins can approve/deny requests
CREATE POLICY "Admins can process approval requests"
    ON public.permission_approvals FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin')
            AND ur.is_active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin')
            AND ur.is_active = true
        )
        AND approval_status IN ('approved', 'denied')
    );

-- =====================================================
-- GRANT TABLE PERMISSIONS FOR ENHANCED RBAC
-- =====================================================

-- Grant usage on public schema
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant select on all enhanced RBAC tables to authenticated users (RLS will filter)
GRANT SELECT ON public.role_templates TO authenticated;
GRANT SELECT ON public.permission_resources TO authenticated;
GRANT SELECT ON public.permission_actions TO authenticated;
GRANT SELECT ON public.enhanced_permissions TO authenticated;
GRANT SELECT ON public.permission_dependencies TO authenticated;
GRANT SELECT ON public.role_hierarchy TO authenticated;
GRANT SELECT ON public.enhanced_role_permissions TO authenticated;
GRANT SELECT ON public.business_permissions TO authenticated;
GRANT SELECT ON public.permission_cache TO authenticated;
GRANT SELECT ON public.permission_approvals TO authenticated;

-- Grant specific permissions for user actions
GRANT INSERT, UPDATE ON public.business_permissions TO authenticated;
GRANT INSERT, UPDATE ON public.permission_cache TO authenticated;
GRANT INSERT, UPDATE ON public.permission_approvals TO authenticated;

-- Grant all permissions to service role
GRANT ALL ON public.role_templates TO service_role;
GRANT ALL ON public.permission_resources TO service_role;
GRANT ALL ON public.permission_actions TO service_role;
GRANT ALL ON public.enhanced_permissions TO service_role;
GRANT ALL ON public.permission_dependencies TO service_role;
GRANT ALL ON public.role_hierarchy TO service_role;
GRANT ALL ON public.enhanced_role_permissions TO service_role;
GRANT ALL ON public.business_permissions TO service_role;
GRANT ALL ON public.permission_cache TO service_role;
GRANT ALL ON public.permission_approvals TO service_role;

-- =====================================================
-- PERFORMANCE OPTIMIZATION FUNCTIONS
-- =====================================================

-- Function to refresh permission cache for specific user
CREATE OR REPLACE FUNCTION public.refresh_user_permissions(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Invalidate existing cache
    DELETE FROM permission_cache WHERE user_id = p_user_id;
    
    -- Trigger fresh evaluation on next permission check
    PERFORM evaluate_user_permissions(p_user_id, '{}'::jsonb);
    
    RETURN TRUE;
END;
$$;

-- Function to cleanup expired cache entries (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_permission_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM permission_cache WHERE expires_at <= NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$;

-- Grant permissions for cache management functions
GRANT EXECUTE ON FUNCTION public.refresh_user_permissions TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_permission_cache TO service_role;

COMMIT;
