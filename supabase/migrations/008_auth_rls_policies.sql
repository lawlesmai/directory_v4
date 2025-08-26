-- Migration: 008_auth_rls_policies
-- Epic 2 Story 2.1: Row Level Security Policies for Authentication
-- Description: Comprehensive RLS policies for all authentication tables
-- Date: 2025-01-25
-- Author: Backend Architecture Expert

BEGIN;

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_mfa_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_mfa_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_oauth_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PROFILES TABLE POLICIES
-- =====================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Public can view basic profile info for active users
CREATE POLICY "Public can view basic profiles"
    ON public.profiles FOR SELECT
    USING (
        account_status = 'active' 
        AND email_verified = true
    );

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin')
            AND ur.is_active = true
        )
    );

-- Admins can update profiles
CREATE POLICY "Admins can update profiles"
    ON public.profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin')
            AND ur.is_active = true
        )
    );

-- =====================================================
-- ROLES TABLE POLICIES
-- =====================================================

-- All authenticated users can view roles
CREATE POLICY "Authenticated users can view roles"
    ON public.roles FOR SELECT
    TO authenticated
    USING (true);

-- Only super admins can manage roles
CREATE POLICY "Super admins can manage roles"
    ON public.roles FOR ALL
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
-- PERMISSIONS TABLE POLICIES
-- =====================================================

-- Authenticated users can view permissions
CREATE POLICY "Authenticated users can view permissions"
    ON public.permissions FOR SELECT
    TO authenticated
    USING (true);

-- Only super admins can manage permissions
CREATE POLICY "Super admins can manage permissions"
    ON public.permissions FOR ALL
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
-- ROLE_PERMISSIONS TABLE POLICIES
-- =====================================================

-- Authenticated users can view role permissions
CREATE POLICY "Authenticated users can view role permissions"
    ON public.role_permissions FOR SELECT
    TO authenticated
    USING (true);

-- Only super admins can manage role permissions
CREATE POLICY "Super admins can manage role permissions"
    ON public.role_permissions FOR ALL
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
-- USER_ROLES TABLE POLICIES
-- =====================================================

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
    ON public.user_roles FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can view all user roles
CREATE POLICY "Admins can view all user roles"
    ON public.user_roles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin', 'moderator')
            AND ur.is_active = true
        )
    );

-- Admins can assign roles
CREATE POLICY "Admins can assign roles"
    ON public.user_roles FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin')
            AND ur.is_active = true
        )
    );

-- Admins can update roles
CREATE POLICY "Admins can update roles"
    ON public.user_roles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin')
            AND ur.is_active = true
        )
    );

-- Admins can revoke roles
CREATE POLICY "Admins can revoke roles"
    ON public.user_roles FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin')
            AND ur.is_active = true
        )
    );

-- =====================================================
-- MFA CONFIG TABLE POLICIES
-- =====================================================

-- Users can view their own MFA config
CREATE POLICY "Users can view own MFA config"
    ON public.auth_mfa_config FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update their own MFA config
CREATE POLICY "Users can update own MFA config"
    ON public.auth_mfa_config FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can insert their own MFA config
CREATE POLICY "Users can create own MFA config"
    ON public.auth_mfa_config FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Admins can view all MFA configs (without secrets)
CREATE POLICY "Admins can view MFA status"
    ON public.auth_mfa_config FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin')
            AND ur.is_active = true
        )
    );

-- =====================================================
-- MFA CHALLENGES TABLE POLICIES
-- =====================================================

-- Users can view their own challenges
CREATE POLICY "Users can view own MFA challenges"
    ON public.auth_mfa_challenges FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own challenges
CREATE POLICY "Users can create own MFA challenges"
    ON public.auth_mfa_challenges FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own challenges (for verification)
CREATE POLICY "Users can update own MFA challenges"
    ON public.auth_mfa_challenges FOR UPDATE
    USING (auth.uid() = user_id);

-- =====================================================
-- USER SESSIONS TABLE POLICIES
-- =====================================================

-- Users can view their own sessions
CREATE POLICY "Users can view own sessions"
    ON public.user_sessions FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update their own sessions (logout, refresh)
CREATE POLICY "Users can update own sessions"
    ON public.user_sessions FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own sessions (logout)
CREATE POLICY "Users can delete own sessions"
    ON public.user_sessions FOR DELETE
    USING (auth.uid() = user_id);

-- Service role can create sessions
CREATE POLICY "Service role can create sessions"
    ON public.user_sessions FOR INSERT
    TO service_role
    WITH CHECK (true);

-- =====================================================
-- SESSION ACTIVITIES TABLE POLICIES
-- =====================================================

-- Users can view their own session activities
CREATE POLICY "Users can view own session activities"
    ON public.session_activities FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_sessions
            WHERE user_sessions.id = session_activities.session_id
            AND user_sessions.user_id = auth.uid()
        )
    );

-- Service role can insert session activities
CREATE POLICY "Service role can insert session activities"
    ON public.session_activities FOR INSERT
    TO service_role
    WITH CHECK (true);

-- =====================================================
-- OAUTH PROVIDERS TABLE POLICIES
-- =====================================================

-- All users can view enabled OAuth providers
CREATE POLICY "Public can view enabled OAuth providers"
    ON public.oauth_providers FOR SELECT
    USING (enabled = true);

-- Only super admins can manage OAuth providers
CREATE POLICY "Super admins can manage OAuth providers"
    ON public.oauth_providers FOR ALL
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
-- USER OAUTH CONNECTIONS TABLE POLICIES
-- =====================================================

-- Users can view their own OAuth connections
CREATE POLICY "Users can view own OAuth connections"
    ON public.user_oauth_connections FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own OAuth connections
CREATE POLICY "Users can create own OAuth connections"
    ON public.user_oauth_connections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own OAuth connections
CREATE POLICY "Users can update own OAuth connections"
    ON public.user_oauth_connections FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own OAuth connections
CREATE POLICY "Users can delete own OAuth connections"
    ON public.user_oauth_connections FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- RATE LIMITS TABLE POLICIES
-- =====================================================

-- Service role can manage rate limits
CREATE POLICY "Service role can manage rate limits"
    ON public.rate_limits FOR ALL
    TO service_role
    USING (true);

-- Admins can view rate limits
CREATE POLICY "Admins can view rate limits"
    ON public.rate_limits FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin')
            AND ur.is_active = true
        )
    );

-- =====================================================
-- SECURITY EVENTS TABLE POLICIES
-- =====================================================

-- Users can view their own security events
CREATE POLICY "Users can view own security events"
    ON public.security_events FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can view all security events
CREATE POLICY "Admins can view all security events"
    ON public.security_events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin', 'moderator')
            AND ur.is_active = true
        )
    );

-- Service role can create security events
CREATE POLICY "Service role can create security events"
    ON public.security_events FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Admins can update security events (resolve them)
CREATE POLICY "Admins can update security events"
    ON public.security_events FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin')
            AND ur.is_active = true
        )
    );

-- =====================================================
-- PASSWORD HISTORY TABLE POLICIES
-- =====================================================

-- Service role can manage password history
CREATE POLICY "Service role can manage password history"
    ON public.password_history FOR ALL
    TO service_role
    USING (true);

-- =====================================================
-- AUTH AUDIT LOGS TABLE POLICIES
-- =====================================================

-- Users can view their own audit logs
CREATE POLICY "Users can view own audit logs"
    ON public.auth_audit_logs FOR SELECT
    USING (auth.uid() = user_id OR auth.uid() = target_user_id);

-- Admins can view all audit logs
CREATE POLICY "Admins can view all audit logs"
    ON public.auth_audit_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin', 'moderator')
            AND ur.is_active = true
        )
    );

-- Service role can create audit logs
CREATE POLICY "Service role can create audit logs"
    ON public.auth_audit_logs FOR INSERT
    TO service_role
    WITH CHECK (true);

-- =====================================================
-- TRUSTED DEVICES TABLE POLICIES
-- =====================================================

-- Users can view their own trusted devices
CREATE POLICY "Users can view own trusted devices"
    ON public.trusted_devices FOR SELECT
    USING (auth.uid() = user_id);

-- Users can manage their own trusted devices
CREATE POLICY "Users can manage own trusted devices"
    ON public.trusted_devices FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- GRANT NECESSARY PERMISSIONS
-- =====================================================

-- Grant usage on schemas
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA auth TO authenticated;

-- Grant select on all tables to authenticated users (RLS will filter)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

-- Grant specific permissions for user actions
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT INSERT, UPDATE ON public.auth_mfa_config TO authenticated;
GRANT INSERT, UPDATE ON public.auth_mfa_challenges TO authenticated;
GRANT UPDATE, DELETE ON public.user_sessions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.user_oauth_connections TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.trusted_devices TO authenticated;

-- Grant all permissions to service role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

COMMIT;
