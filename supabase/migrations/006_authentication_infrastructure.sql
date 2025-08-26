-- Migration: 006_authentication_infrastructure
-- Epic 2 Story 2.1: Supabase Auth Configuration & Security Infrastructure
-- Description: Complete authentication infrastructure with RBAC, MFA, session management, and security
-- Date: 2025-01-25
-- Author: Backend Architecture Expert

BEGIN;

-- =====================================================
-- EXTENSIONS FOR AUTHENTICATION
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pgjwt";

-- =====================================================
-- USER PROFILES AND AUTHENTICATION
-- =====================================================

-- User profiles table extending auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Display information
    display_name VARCHAR(255),
    username VARCHAR(50) UNIQUE,
    avatar_url VARCHAR(500),
    bio TEXT,
    
    -- Personal information (encrypted where sensitive)
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    date_of_birth DATE,
    phone_number VARCHAR(20),
    phone_verified BOOLEAN DEFAULT FALSE,
    
    -- Location
    city VARCHAR(100),
    state VARCHAR(50),
    country VARCHAR(50),
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Social and external links
    website VARCHAR(255),
    social_links JSONB DEFAULT '{
        "twitter": null,
        "linkedin": null,
        "facebook": null,
        "instagram": null,
        "github": null
    }'::jsonb,
    
    -- Preferences and settings
    preferences JSONB DEFAULT '{
        "email_notifications": true,
        "push_notifications": false,
        "marketing_emails": false,
        "newsletter": false,
        "language": "en",
        "theme": "light",
        "accessibility": {}
    }'::jsonb,
    
    -- Privacy and consent
    marketing_consent BOOLEAN DEFAULT FALSE,
    data_processing_consent BOOLEAN DEFAULT FALSE,
    consent_timestamp TIMESTAMPTZ,
    
    -- Account status
    email_verified BOOLEAN DEFAULT FALSE,
    account_status VARCHAR(50) DEFAULT 'active' CHECK (
        account_status IN ('active', 'inactive', 'suspended', 'deleted', 'pending_verification')
    ),
    suspension_reason TEXT,
    suspension_date TIMESTAMPTZ,
    
    -- Security
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT valid_username CHECK (username ~* '^[a-zA-Z0-9_]{3,50}$' OR username IS NULL),
    CONSTRAINT valid_phone CHECK (phone_number ~* '^\+?[1-9]\d{1,14}$' OR phone_number IS NULL)
);

-- =====================================================
-- ROLE-BASED ACCESS CONTROL (RBAC)
-- =====================================================

-- Roles table defining available roles
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Role hierarchy
    parent_role VARCHAR(50),
    hierarchy_level INTEGER DEFAULT 0,
    
    -- System flags
    is_system_role BOOLEAN DEFAULT FALSE,
    is_assignable BOOLEAN DEFAULT TRUE,
    requires_mfa BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Permission grouping
    category VARCHAR(50),
    
    -- System flags
    is_system_permission BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_permission UNIQUE(resource, action)
);

-- Role permissions mapping
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    
    -- Grant details
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_role_permission UNIQUE(role_id, permission_id)
);

-- User roles assignment (enhanced from existing table)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    
    -- Assignment details
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    revoked_at TIMESTAMPTZ,
    revoke_reason TEXT,
    
    -- Scope (for business-specific roles)
    scope_type VARCHAR(50), -- 'global', 'business', 'category'
    scope_id UUID, -- business_id or category_id if scoped
    
    CONSTRAINT unique_user_role_scope UNIQUE NULLS NOT DISTINCT (user_id, role_id, scope_type, scope_id),
    CONSTRAINT valid_expiry CHECK (expires_at IS NULL OR expires_at > granted_at)
);

-- =====================================================
-- MULTI-FACTOR AUTHENTICATION (MFA)
-- =====================================================

-- MFA configuration per user
CREATE TABLE IF NOT EXISTS public.auth_mfa_config (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- MFA settings
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_enforced BOOLEAN DEFAULT FALSE, -- Admin can enforce MFA
    
    -- TOTP configuration
    totp_enabled BOOLEAN DEFAULT FALSE,
    totp_secret_encrypted TEXT, -- Encrypted with pgcrypto
    totp_verified BOOLEAN DEFAULT FALSE,
    
    -- SMS configuration
    sms_enabled BOOLEAN DEFAULT FALSE,
    sms_phone_number VARCHAR(20),
    sms_phone_verified BOOLEAN DEFAULT FALSE,
    
    -- Email configuration
    email_enabled BOOLEAN DEFAULT FALSE,
    email_address VARCHAR(255),
    
    -- Backup codes
    backup_codes_encrypted TEXT[], -- Array of encrypted backup codes
    backup_codes_used INTEGER[] DEFAULT '{}',
    backup_codes_generated_at TIMESTAMPTZ,
    
    -- Recovery
    recovery_email VARCHAR(255),
    recovery_phone VARCHAR(20),
    
    -- Trusted devices
    trusted_devices JSONB DEFAULT '[]'::jsonb,
    
    -- Metadata
    last_used_method VARCHAR(20),
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MFA challenges and verification
CREATE TABLE IF NOT EXISTS public.auth_mfa_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Challenge details
    challenge_type VARCHAR(20) NOT NULL CHECK (
        challenge_type IN ('totp', 'sms', 'email', 'backup_code')
    ),
    challenge_code VARCHAR(10),
    challenge_secret TEXT, -- For encrypted data
    
    -- Verification
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    
    -- Device info
    ip_address INET,
    user_agent TEXT,
    device_id VARCHAR(255),
    
    -- Lifecycle
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '10 minutes',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_attempts CHECK (attempts >= 0 AND attempts <= max_attempts)
);

-- =====================================================
-- SESSION MANAGEMENT
-- =====================================================

-- Extended session tracking
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Session tokens
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE,
    access_token_jti VARCHAR(255) UNIQUE, -- JWT ID for tracking
    
    -- Device information
    device_id VARCHAR(255),
    device_type VARCHAR(50), -- 'desktop', 'mobile', 'tablet'
    device_name VARCHAR(255),
    browser VARCHAR(100),
    browser_version VARCHAR(50),
    os VARCHAR(50),
    os_version VARCHAR(50),
    
    -- Network information
    ip_address INET,
    user_agent TEXT,
    
    -- Geographic information
    country_code VARCHAR(2),
    country_name VARCHAR(100),
    region VARCHAR(100),
    city VARCHAR(100),
    postal_code VARCHAR(20),
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    timezone VARCHAR(50),
    
    -- Session security
    is_suspicious BOOLEAN DEFAULT FALSE,
    suspicion_reasons TEXT[],
    requires_mfa BOOLEAN DEFAULT FALSE,
    mfa_verified BOOLEAN DEFAULT FALSE,
    mfa_verified_at TIMESTAMPTZ,
    
    -- Session lifecycle
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
    revoked_at TIMESTAMPTZ,
    revoke_reason VARCHAR(100),
    
    -- Session flags
    is_active BOOLEAN DEFAULT TRUE,
    is_remembered BOOLEAN DEFAULT FALSE,
    
    CONSTRAINT valid_session CHECK (
        (revoked_at IS NULL AND is_active = TRUE) OR 
        (revoked_at IS NOT NULL AND is_active = FALSE)
    )
);

-- Session activity logging
CREATE TABLE IF NOT EXISTS public.session_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.user_sessions(id) ON DELETE CASCADE,
    
    -- Activity details
    activity_type VARCHAR(50) NOT NULL,
    activity_data JSONB DEFAULT '{}'::jsonb,
    
    -- Request information
    request_method VARCHAR(10),
    request_path VARCHAR(500),
    request_params JSONB,
    response_status INTEGER,
    
    -- Location
    ip_address INET,
    
    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- OAUTH PROVIDER MANAGEMENT
-- =====================================================

-- OAuth provider configurations
CREATE TABLE IF NOT EXISTS public.oauth_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_name VARCHAR(50) UNIQUE NOT NULL,
    
    -- Provider configuration
    client_id_encrypted TEXT NOT NULL,
    client_secret_encrypted TEXT NOT NULL,
    redirect_uri VARCHAR(500),
    authorization_url VARCHAR(500),
    token_url VARCHAR(500),
    user_info_url VARCHAR(500),
    
    -- Scopes and permissions
    default_scopes TEXT[],
    optional_scopes TEXT[],
    
    -- Display settings
    display_name VARCHAR(100),
    icon_url VARCHAR(500),
    button_text VARCHAR(50),
    button_color VARCHAR(7),
    
    -- Settings
    enabled BOOLEAN DEFAULT TRUE,
    auto_link_accounts BOOLEAN DEFAULT FALSE,
    require_email_verification BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User OAuth connections
CREATE TABLE IF NOT EXISTS public.user_oauth_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES public.oauth_providers(id),
    
    -- Provider account info
    provider_user_id VARCHAR(255) NOT NULL,
    provider_email VARCHAR(255),
    provider_username VARCHAR(255),
    
    -- Tokens (encrypted)
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    id_token_encrypted TEXT,
    token_expires_at TIMESTAMPTZ,
    
    -- Provider data
    provider_data JSONB DEFAULT '{}'::jsonb,
    
    -- Connection status
    is_primary BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    disconnected_at TIMESTAMPTZ,
    
    CONSTRAINT unique_provider_connection UNIQUE(provider_id, provider_user_id)
);

-- =====================================================
-- RATE LIMITING AND SECURITY
-- =====================================================

-- Rate limiting tracking
CREATE TABLE IF NOT EXISTS public.rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identifier (can be user_id, ip, or combination)
    identifier VARCHAR(255) NOT NULL,
    identifier_type VARCHAR(50) NOT NULL, -- 'user', 'ip', 'api_key'
    
    -- Action being limited
    action VARCHAR(100) NOT NULL,
    
    -- Tracking
    attempts INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    window_end TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour',
    
    -- Limits
    max_attempts INTEGER NOT NULL,
    
    -- Block status
    is_blocked BOOLEAN DEFAULT FALSE,
    blocked_until TIMESTAMPTZ,
    
    CONSTRAINT unique_rate_limit UNIQUE(identifier, action, window_start)
);

-- Security events logging
CREATE TABLE IF NOT EXISTS public.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event identification
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (
        severity IN ('low', 'medium', 'high', 'critical')
    ),
    
    -- User context
    user_id UUID REFERENCES auth.users(id),
    session_id UUID REFERENCES public.user_sessions(id),
    
    -- Event details
    description TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    
    -- Network context
    ip_address INET,
    user_agent TEXT,
    request_id UUID,
    
    -- Response
    action_taken VARCHAR(100),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    
    -- Timestamps
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    reported_at TIMESTAMPTZ
);

-- Password history for preventing reuse
CREATE TABLE IF NOT EXISTS public.password_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Password hash (never store plain text)
    password_hash TEXT NOT NULL,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Keep only last 12 passwords
    CONSTRAINT max_password_history CHECK (
        (SELECT COUNT(*) FROM password_history WHERE user_id = user_id) <= 12
    )
);

-- =====================================================
-- AUDIT LOGGING FOR AUTHENTICATION
-- =====================================================

-- Authentication audit logs
CREATE TABLE IF NOT EXISTS public.auth_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event details
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50) NOT NULL, -- 'login', 'logout', 'password_change', 'mfa', 'permission'
    
    -- User context
    user_id UUID REFERENCES auth.users(id),
    target_user_id UUID REFERENCES auth.users(id), -- For admin actions on other users
    session_id UUID REFERENCES public.user_sessions(id),
    
    -- Event data
    event_data JSONB DEFAULT '{}'::jsonb,
    
    -- Result
    success BOOLEAN NOT NULL,
    failure_reason TEXT,
    
    -- Network context
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for audit logs
CREATE TABLE auth_audit_logs_2025_01 PARTITION OF auth_audit_logs
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE auth_audit_logs_2025_02 PARTITION OF auth_audit_logs
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE auth_audit_logs_2025_03 PARTITION OF auth_audit_logs
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- =====================================================
-- DEVICE TRUST AND MANAGEMENT
-- =====================================================

-- Trusted devices for users
CREATE TABLE IF NOT EXISTS public.trusted_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Device identification
    device_id VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    device_type VARCHAR(50),
    
    -- Device fingerprint
    fingerprint_hash TEXT NOT NULL,
    
    -- Trust details
    trust_level VARCHAR(20) DEFAULT 'low' CHECK (
        trust_level IN ('low', 'medium', 'high', 'verified')
    ),
    last_verified_at TIMESTAMPTZ,
    
    -- Usage tracking
    last_used_at TIMESTAMPTZ,
    usage_count INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    revoked_at TIMESTAMPTZ,
    revoke_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '90 days',
    
    CONSTRAINT unique_user_device UNIQUE(user_id, device_id)
);

-- =====================================================
-- INSERT DEFAULT ROLES AND PERMISSIONS
-- =====================================================

-- Insert system roles
INSERT INTO public.roles (name, display_name, description, hierarchy_level, is_system_role, requires_mfa) VALUES
    ('super_admin', 'Super Administrator', 'Full system access', 0, true, true),
    ('admin', 'Administrator', 'Administrative access', 1, true, true),
    ('moderator', 'Moderator', 'Content moderation access', 2, true, false),
    ('business_owner', 'Business Owner', 'Business management access', 3, true, false),
    ('user', 'User', 'Standard user access', 4, true, false),
    ('guest', 'Guest', 'Limited guest access', 5, true, false)
ON CONFLICT (name) DO NOTHING;

-- Insert system permissions
INSERT INTO public.permissions (resource, action, name, category, is_system_permission) VALUES
    -- User management
    ('users', 'create', 'Create users', 'user_management', true),
    ('users', 'read', 'Read user data', 'user_management', true),
    ('users', 'update', 'Update users', 'user_management', true),
    ('users', 'delete', 'Delete users', 'user_management', true),
    ('users', 'impersonate', 'Impersonate users', 'user_management', true),
    
    -- Business management
    ('businesses', 'create', 'Create businesses', 'business_management', true),
    ('businesses', 'read', 'Read business data', 'business_management', true),
    ('businesses', 'update', 'Update businesses', 'business_management', true),
    ('businesses', 'delete', 'Delete businesses', 'business_management', true),
    ('businesses', 'verify', 'Verify businesses', 'business_management', true),
    ('businesses', 'moderate', 'Moderate business content', 'business_management', true),
    
    -- Review management
    ('reviews', 'create', 'Create reviews', 'review_management', true),
    ('reviews', 'read', 'Read reviews', 'review_management', true),
    ('reviews', 'update', 'Update reviews', 'review_management', true),
    ('reviews', 'delete', 'Delete reviews', 'review_management', true),
    ('reviews', 'moderate', 'Moderate reviews', 'review_management', true),
    
    -- Analytics
    ('analytics', 'read', 'View analytics', 'analytics', true),
    ('analytics', 'export', 'Export analytics data', 'analytics', true),
    
    -- System administration
    ('system', 'configure', 'Configure system settings', 'system', true),
    ('system', 'audit', 'View audit logs', 'system', true),
    ('system', 'backup', 'Manage backups', 'system', true),
    ('roles', 'manage', 'Manage roles and permissions', 'system', true)
ON CONFLICT (resource, action) DO NOTHING;

-- Assign permissions to roles
WITH role_permission_mappings AS (
    SELECT 
        r.id as role_id,
        p.id as permission_id
    FROM public.roles r
    CROSS JOIN public.permissions p
    WHERE 
        (r.name = 'super_admin') OR
        (r.name = 'admin' AND p.resource != 'system') OR
        (r.name = 'moderator' AND p.resource IN ('businesses', 'reviews') AND p.action IN ('read', 'moderate')) OR
        (r.name = 'business_owner' AND p.resource = 'businesses' AND p.action IN ('create', 'read', 'update')) OR
        (r.name = 'user' AND p.resource IN ('businesses', 'reviews') AND p.action IN ('read', 'create'))
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT role_id, permission_id FROM role_permission_mappings
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =====================================================
-- INSERT DEFAULT OAUTH PROVIDERS
-- =====================================================

INSERT INTO public.oauth_providers (
    provider_name, 
    display_name,
    client_id_encrypted, 
    client_secret_encrypted,
    default_scopes,
    button_text,
    enabled
) VALUES
    ('google', 'Google', 'encrypted_placeholder', 'encrypted_placeholder', 
     ARRAY['openid', 'email', 'profile'], 'Continue with Google', true),
    ('apple', 'Apple', 'encrypted_placeholder', 'encrypted_placeholder',
     ARRAY['name', 'email'], 'Sign in with Apple', true),
    ('facebook', 'Facebook', 'encrypted_placeholder', 'encrypted_placeholder',
     ARRAY['email', 'public_profile'], 'Continue with Facebook', false),
    ('github', 'GitHub', 'encrypted_placeholder', 'encrypted_placeholder',
     ARRAY['read:user', 'user:email'], 'Sign in with GitHub', false)
ON CONFLICT (provider_name) DO NOTHING;

-- =====================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Profile indexes
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_email_verified ON public.profiles(email_verified) WHERE email_verified = true;
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);

-- User roles indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_roles_scope ON public.user_roles(scope_type, scope_id) WHERE scope_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_roles_expires ON public.user_roles(expires_at) WHERE expires_at IS NOT NULL;

-- Session indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.user_sessions(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.user_sessions(session_token) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON public.user_sessions(expires_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sessions_device ON public.user_sessions(device_id) WHERE device_id IS NOT NULL;

-- MFA indexes
CREATE INDEX IF NOT EXISTS idx_mfa_config_user ON public.auth_mfa_config(user_id) WHERE mfa_enabled = true;
CREATE INDEX IF NOT EXISTS idx_mfa_challenges_user ON public.auth_mfa_challenges(user_id) WHERE verified = false;
CREATE INDEX IF NOT EXISTS idx_mfa_challenges_expires ON public.auth_mfa_challenges(expires_at) WHERE verified = false;

-- OAuth indexes
CREATE INDEX IF NOT EXISTS idx_oauth_connections_user ON public.user_oauth_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_connections_provider ON public.user_oauth_connections(provider_id);

-- Security indexes
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON public.rate_limits(identifier, action) WHERE is_blocked = false;
CREATE INDEX IF NOT EXISTS idx_security_events_user ON public.security_events(user_id) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events(severity) WHERE resolved = false;

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_user ON public.auth_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_event ON public.auth_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_created ON public.auth_audit_logs(created_at DESC);

COMMIT;
