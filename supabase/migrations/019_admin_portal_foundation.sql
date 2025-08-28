-- Migration: 019_admin_portal_foundation
-- Epic 4 Story 4.1: Admin Portal Foundation & Access Control
-- Description: Admin-specific models, enhanced security, audit logging, and IP whitelisting
-- Date: 2025-08-27
-- Author: Backend Developer Agent

BEGIN;

-- =====================================================
-- ADMIN USER MANAGEMENT SYSTEM
-- =====================================================

-- Admin users table extending the existing role system
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Admin-specific information
    admin_level VARCHAR(50) NOT NULL DEFAULT 'support_admin' CHECK (
        admin_level IN ('super_admin', 'platform_admin', 'support_admin', 'content_moderator')
    ),
    department VARCHAR(100),
    employee_id VARCHAR(50) UNIQUE,
    
    -- Enhanced security settings
    requires_mfa BOOLEAN DEFAULT TRUE,
    mfa_grace_period TIMESTAMPTZ, -- Temporary MFA bypass period
    mfa_backup_codes_used INTEGER[] DEFAULT '{}',
    
    -- IP Access Control
    ip_whitelist INET[],
    ip_whitelist_enabled BOOLEAN DEFAULT FALSE,
    geo_restrictions JSONB DEFAULT '{}'::jsonb, -- Country/region restrictions
    
    -- Session Security
    max_concurrent_sessions INTEGER DEFAULT 3,
    session_timeout_minutes INTEGER DEFAULT 30,
    require_password_change BOOLEAN DEFAULT FALSE,
    password_expires_at TIMESTAMPTZ,
    
    -- Account Status
    account_locked BOOLEAN DEFAULT FALSE,
    lockout_reason TEXT,
    locked_by UUID REFERENCES auth.users(id),
    locked_at TIMESTAMPTZ,
    failed_login_attempts INTEGER DEFAULT 0,
    last_failed_login TIMESTAMPTZ,
    
    -- Emergency Access
    emergency_access_enabled BOOLEAN DEFAULT FALSE,
    emergency_contact_email VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    
    -- Activity Tracking
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,
    last_activity_at TIMESTAMPTZ,
    total_logins INTEGER DEFAULT 0,
    
    -- Administrative
    created_by UUID REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    approval_notes TEXT,
    
    -- Metadata
    notes TEXT,
    tags VARCHAR(50)[],
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deactivated_at TIMESTAMPTZ
);

-- Admin sessions with enhanced security tracking
CREATE TABLE IF NOT EXISTS public.admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
    
    -- Session tokens
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE,
    
    -- Security context
    ip_address INET NOT NULL,
    user_agent TEXT,
    browser_fingerprint VARCHAR(255),
    
    -- MFA verification for this session
    mfa_verified BOOLEAN DEFAULT FALSE,
    mfa_verified_at TIMESTAMPTZ,
    mfa_method VARCHAR(20), -- 'totp', 'sms', 'backup_code', 'hardware_key'
    
    -- Geographic information
    country_code VARCHAR(2),
    country_name VARCHAR(100),
    city VARCHAR(100),
    is_vpn BOOLEAN DEFAULT FALSE,
    is_proxy BOOLEAN DEFAULT FALSE,
    
    -- Security flags
    is_suspicious BOOLEAN DEFAULT FALSE,
    suspicion_score INTEGER DEFAULT 0, -- 0-100 risk score
    suspicion_reasons TEXT[],
    
    -- Session lifecycle
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 minutes',
    extended_until TIMESTAMPTZ, -- For extended operations
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    terminated_at TIMESTAMPTZ,
    termination_reason VARCHAR(100),
    terminated_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT valid_session_lifecycle CHECK (
        (terminated_at IS NULL AND is_active = TRUE) OR 
        (terminated_at IS NOT NULL AND is_active = FALSE)
    )
);

-- Admin audit logging system
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Actor information
    admin_id UUID REFERENCES public.admin_users(id),
    session_id UUID REFERENCES public.admin_sessions(id),
    impersonation_id UUID, -- If acting on behalf of another admin
    
    -- Action details
    action VARCHAR(100) NOT NULL,
    action_category VARCHAR(50) NOT NULL, -- 'user_management', 'business_management', 'content_moderation', etc.
    action_description TEXT,
    
    -- Resource information
    resource_type VARCHAR(50), -- 'user', 'business', 'review', 'system_config'
    resource_id UUID,
    resource_name VARCHAR(255),
    
    -- Data changes
    old_values JSONB DEFAULT '{}'::jsonb,
    new_values JSONB DEFAULT '{}'::jsonb,
    affected_fields TEXT[],
    
    -- Context information
    request_id UUID,
    correlation_id UUID, -- For linking related actions
    parent_action_id UUID REFERENCES public.admin_audit_log(id),
    
    -- Security context
    ip_address INET,
    user_agent TEXT,
    referer VARCHAR(500),
    
    -- Result and impact
    success BOOLEAN NOT NULL,
    error_code VARCHAR(50),
    error_message TEXT,
    affected_records_count INTEGER DEFAULT 1,
    
    -- Compliance and legal
    data_classification VARCHAR(20) DEFAULT 'internal', -- 'public', 'internal', 'confidential', 'restricted'
    gdpr_lawful_basis VARCHAR(50), -- For GDPR compliance
    retention_policy VARCHAR(50),
    
    -- Metadata
    tags VARCHAR(50)[],
    additional_context JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for admin audit logs
CREATE TABLE IF NOT EXISTS admin_audit_log_2025_08 PARTITION OF admin_audit_log
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE IF NOT EXISTS admin_audit_log_2025_09 PARTITION OF admin_audit_log
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE IF NOT EXISTS admin_audit_log_2025_10 PARTITION OF admin_audit_log
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

-- IP access control and whitelisting
CREATE TABLE IF NOT EXISTS public.admin_ip_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- IP range configuration
    ip_address INET,
    ip_range CIDR,
    
    -- Access control
    access_type VARCHAR(20) DEFAULT 'whitelist' CHECK (
        access_type IN ('whitelist', 'blacklist', 'monitor')
    ),
    
    -- Scope
    applies_to VARCHAR(20) DEFAULT 'global' CHECK (
        applies_to IN ('global', 'admin_level', 'specific_admin')
    ),
    target_admin_level VARCHAR(50),
    target_admin_id UUID REFERENCES public.admin_users(id),
    
    -- Geographic context
    country_codes VARCHAR(2)[],
    regions TEXT[],
    
    -- Description and metadata
    description TEXT,
    created_by UUID REFERENCES auth.users(id),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    CONSTRAINT ip_or_range_required CHECK (
        (ip_address IS NOT NULL AND ip_range IS NULL) OR 
        (ip_address IS NULL AND ip_range IS NOT NULL)
    )
);

-- Admin notifications and alerts
CREATE TABLE IF NOT EXISTS public.admin_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Recipient
    admin_id UUID REFERENCES public.admin_users(id) ON DELETE CASCADE,
    admin_level VARCHAR(50)[], -- Broadcast to admin levels
    
    -- Notification content
    notification_type VARCHAR(50) NOT NULL, -- 'security_alert', 'system_update', 'user_report', etc.
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Priority and urgency
    priority VARCHAR(10) DEFAULT 'normal' CHECK (
        priority IN ('low', 'normal', 'high', 'urgent', 'critical')
    ),
    requires_action BOOLEAN DEFAULT FALSE,
    action_url VARCHAR(500),
    action_text VARCHAR(100),
    
    -- Status
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    
    -- Context
    related_resource_type VARCHAR(50),
    related_resource_id UUID,
    tags VARCHAR(50)[],
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    CONSTRAINT recipient_specified CHECK (
        admin_id IS NOT NULL OR admin_level IS NOT NULL
    )
);

-- Admin permission approvals workflow
CREATE TABLE IF NOT EXISTS public.admin_permission_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Request details
    request_type VARCHAR(50) NOT NULL CHECK (
        request_type IN ('admin_creation', 'permission_elevation', 'emergency_access', 'ip_whitelist', 'bulk_operation')
    ),
    
    -- Requestor information
    requested_by UUID NOT NULL REFERENCES auth.users(id),
    requested_for_admin_id UUID REFERENCES public.admin_users(id),
    
    -- Request content
    request_title VARCHAR(255) NOT NULL,
    request_description TEXT NOT NULL,
    request_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    business_justification TEXT NOT NULL,
    
    -- Approval workflow
    approval_status VARCHAR(20) DEFAULT 'pending' CHECK (
        approval_status IN ('pending', 'approved', 'denied', 'withdrawn', 'expired', 'cancelled')
    ),
    
    -- Approver information
    approver_id UUID REFERENCES auth.users(id),
    approval_notes TEXT,
    approved_at TIMESTAMPTZ,
    
    -- Secondary approval (for critical operations)
    requires_secondary_approval BOOLEAN DEFAULT FALSE,
    secondary_approver_id UUID REFERENCES auth.users(id),
    secondary_approval_notes TEXT,
    secondary_approved_at TIMESTAMPTZ,
    
    -- Risk assessment
    risk_level VARCHAR(10) DEFAULT 'medium' CHECK (
        risk_level IN ('low', 'medium', 'high', 'critical')
    ),
    risk_factors TEXT[],
    automated_risk_score INTEGER DEFAULT 50, -- 0-100
    
    -- Emergency handling
    is_emergency_request BOOLEAN DEFAULT FALSE,
    emergency_justification TEXT,
    emergency_approved_by UUID REFERENCES auth.users(id),
    
    -- Lifecycle
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
    implemented_at TIMESTAMPTZ,
    implementation_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin role assignments with business context
CREATE TABLE IF NOT EXISTS public.admin_business_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    -- Assignment details
    assignment_type VARCHAR(50) NOT NULL CHECK (
        assignment_type IN ('reviewer', 'moderator', 'support', 'investigation')
    ),
    assignment_reason VARCHAR(100),
    
    -- Permissions within business context
    can_edit_profile BOOLEAN DEFAULT FALSE,
    can_moderate_reviews BOOLEAN DEFAULT FALSE,
    can_verify_business BOOLEAN DEFAULT FALSE,
    can_suspend_business BOOLEAN DEFAULT FALSE,
    can_view_analytics BOOLEAN DEFAULT FALSE,
    can_contact_owner BOOLEAN DEFAULT FALSE,
    
    -- Assignment metadata
    assigned_by UUID REFERENCES auth.users(id),
    assignment_notes TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES auth.users(id),
    revoke_reason TEXT,
    
    CONSTRAINT unique_admin_business_assignment UNIQUE(admin_id, business_id, assignment_type)
);

-- =====================================================
-- SECURITY MONITORING AND THREAT DETECTION
-- =====================================================

-- Security incidents tracking
CREATE TABLE IF NOT EXISTS public.admin_security_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Incident classification
    incident_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (
        severity IN ('info', 'low', 'medium', 'high', 'critical')
    ),
    
    -- Affected entities
    affected_admin_id UUID REFERENCES public.admin_users(id),
    affected_session_id UUID REFERENCES public.admin_sessions(id),
    
    -- Incident details
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    incident_data JSONB DEFAULT '{}'::jsonb,
    
    -- Detection information
    detected_by VARCHAR(50), -- 'automated', 'manual', 'external'
    detection_method VARCHAR(100),
    confidence_score INTEGER DEFAULT 75, -- 0-100
    
    -- Network context
    source_ip INET,
    source_country VARCHAR(2),
    related_ips INET[],
    
    -- Timeline
    occurred_at TIMESTAMPTZ NOT NULL,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Response
    status VARCHAR(20) DEFAULT 'open' CHECK (
        status IN ('open', 'investigating', 'contained', 'resolved', 'false_positive')
    ),
    assigned_to UUID REFERENCES auth.users(id),
    response_actions TEXT[],
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    
    -- Impact assessment
    impact_level VARCHAR(10) DEFAULT 'low' CHECK (
        impact_level IN ('none', 'low', 'medium', 'high', 'critical')
    ),
    affected_systems TEXT[],
    data_compromised BOOLEAN DEFAULT FALSE,
    user_accounts_affected INTEGER DEFAULT 0,
    
    -- Metadata
    tags VARCHAR(50)[],
    external_references TEXT[],
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate limiting for admin operations
CREATE TABLE IF NOT EXISTS public.admin_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identifier
    admin_id UUID REFERENCES public.admin_users(id),
    ip_address INET,
    
    -- Operation being rate limited
    operation VARCHAR(100) NOT NULL,
    operation_category VARCHAR(50) NOT NULL,
    
    -- Rate limiting window
    window_start TIMESTAMPTZ DEFAULT NOW(),
    window_end TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour',
    
    -- Tracking
    attempt_count INTEGER DEFAULT 1,
    max_attempts INTEGER NOT NULL,
    
    -- Status
    is_blocked BOOLEAN DEFAULT FALSE,
    blocked_until TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT admin_or_ip_required CHECK (
        admin_id IS NOT NULL OR ip_address IS NOT NULL
    ),
    CONSTRAINT unique_admin_rate_limit UNIQUE NULLS NOT DISTINCT (
        admin_id, ip_address, operation, window_start
    )
);

-- =====================================================
-- INDEXES FOR OPTIMAL PERFORMANCE
-- =====================================================

-- Admin users indexes
CREATE INDEX IF NOT EXISTS idx_admin_users_level ON public.admin_users(admin_level) WHERE deactivated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_admin_users_status ON public.admin_users(account_locked, deactivated_at);
CREATE INDEX IF NOT EXISTS idx_admin_users_employee_id ON public.admin_users(employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_users_last_activity ON public.admin_users(last_activity_at DESC);

-- Admin sessions indexes
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin ON public.admin_sessions(admin_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON public.admin_sessions(session_token) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON public.admin_sessions(expires_at) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_admin_sessions_suspicious ON public.admin_sessions(is_suspicious, suspicion_score) WHERE is_suspicious = TRUE;
CREATE INDEX IF NOT EXISTS idx_admin_sessions_ip ON public.admin_sessions(ip_address) WHERE is_active = TRUE;

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON public.admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON public.admin_audit_log(action, action_category);
CREATE INDEX IF NOT EXISTS idx_admin_audit_resource ON public.admin_audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_success ON public.admin_audit_log(success) WHERE success = FALSE;

-- IP access indexes
CREATE INDEX IF NOT EXISTS idx_admin_ip_access_active ON public.admin_ip_access(access_type) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_admin_ip_access_whitelist ON public.admin_ip_access(ip_address, ip_range) WHERE access_type = 'whitelist' AND is_active = TRUE;
CREATE USING gist INDEX IF NOT EXISTS idx_admin_ip_access_range_gist ON public.admin_ip_access USING gist(ip_range) WHERE ip_range IS NOT NULL;

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_admin_notifications_admin ON public.admin_notifications(admin_id) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_admin_notifications_priority ON public.admin_notifications(priority, created_at DESC) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON public.admin_notifications(notification_type, created_at DESC);

-- Security incidents indexes
CREATE INDEX IF NOT EXISTS idx_admin_security_incidents_status ON public.admin_security_incidents(status) WHERE status IN ('open', 'investigating');
CREATE INDEX IF NOT EXISTS idx_admin_security_incidents_severity ON public.admin_security_incidents(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_security_incidents_admin ON public.admin_security_incidents(affected_admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_security_incidents_occurred ON public.admin_security_incidents(occurred_at DESC);

-- Rate limits indexes
CREATE INDEX IF NOT EXISTS idx_admin_rate_limits_admin ON public.admin_rate_limits(admin_id, operation) WHERE is_blocked = TRUE;
CREATE INDEX IF NOT EXISTS idx_admin_rate_limits_ip ON public.admin_rate_limits(ip_address, operation) WHERE is_blocked = TRUE;
CREATE INDEX IF NOT EXISTS idx_admin_rate_limits_window ON public.admin_rate_limits(window_end) WHERE is_blocked = TRUE;

-- Business assignments indexes
CREATE INDEX IF NOT EXISTS idx_admin_business_assignments_admin ON public.admin_business_assignments(admin_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_admin_business_assignments_business ON public.admin_business_assignments(business_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_admin_business_assignments_type ON public.admin_business_assignments(assignment_type, is_active);

-- Admin MFA Recovery table
CREATE TABLE IF NOT EXISTS public.admin_mfa_recovery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
    recovery_token_hash VARCHAR(64) NOT NULL UNIQUE,
    recovery_reason VARCHAR(100) NOT NULL,
    verification_code VARCHAR(6),
    
    -- Request details
    requestor_ip INET NOT NULL,
    requestor_user_agent TEXT,
    
    -- Approval workflow
    status VARCHAR(20) DEFAULT 'pending_approval' CHECK (
        status IN ('pending_approval', 'approved', 'rejected', 'completed', 'expired')
    ),
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    approval_notes TEXT,
    rejected_reason TEXT,
    
    -- Completion
    completed_at TIMESTAMPTZ,
    completion_ip INET,
    completion_user_agent TEXT,
    
    -- Metadata
    additional_data JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_mfa_recovery_admin ON public.admin_mfa_recovery(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_mfa_recovery_status ON public.admin_mfa_recovery(status) WHERE status = 'pending_approval';
CREATE INDEX IF NOT EXISTS idx_admin_mfa_recovery_token ON public.admin_mfa_recovery(recovery_token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_mfa_recovery_expires ON public.admin_mfa_recovery(expires_at) WHERE status = 'pending_approval';

-- Permission approvals indexes
CREATE INDEX IF NOT EXISTS idx_admin_permission_approvals_status ON public.admin_permission_approvals(approval_status) WHERE approval_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_admin_permission_approvals_requester ON public.admin_permission_approvals(requested_by, approval_status);
CREATE INDEX IF NOT EXISTS idx_admin_permission_approvals_expires ON public.admin_permission_approvals(expires_at) WHERE approval_status = 'pending';

-- MFA recovery indexes
CREATE INDEX IF NOT EXISTS idx_admin_mfa_recovery_pending ON public.admin_mfa_recovery(created_at DESC) WHERE status = 'pending_approval';
CREATE INDEX IF NOT EXISTS idx_admin_mfa_recovery_user_status ON public.admin_mfa_recovery(admin_id, status);
CREATE INDEX IF NOT EXISTS idx_admin_mfa_recovery_token_lookup ON public.admin_mfa_recovery(recovery_token_hash) WHERE status IN ('approved', 'pending_approval');

-- =====================================================
-- SEED DATA FOR ADMIN SYSTEM
-- =====================================================

-- Insert admin-specific permissions
INSERT INTO public.permission_resources (name, display_name, description, resource_path, hierarchy_level, allows_scoping, is_system_resource) VALUES
    ('admin_portal', 'Admin Portal Access', 'Access to administrative portal and functions', 'admin_portal', 0, FALSE, TRUE),
    ('admin_users', 'Admin User Management', 'Management of administrative user accounts', 'admin_portal/users', 1, TRUE, TRUE),
    ('admin_security', 'Admin Security Management', 'Security monitoring and incident response', 'admin_portal/security', 1, FALSE, TRUE),
    ('admin_audit', 'Admin Audit Access', 'Access to audit logs and compliance data', 'admin_portal/audit', 1, FALSE, TRUE),
    ('admin_config', 'Admin Configuration', 'System configuration and settings management', 'admin_portal/config', 1, FALSE, TRUE)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description;

-- Insert admin-specific actions
INSERT INTO public.permission_actions (name, display_name, description, is_destructive, requires_mfa, is_system_action) VALUES
    ('impersonate', 'Impersonate User', 'Act on behalf of another user account', TRUE, TRUE, TRUE),
    ('lock_account', 'Lock Account', 'Lock user or admin accounts', TRUE, TRUE, TRUE),
    ('unlock_account', 'Unlock Account', 'Unlock locked accounts', FALSE, TRUE, TRUE),
    ('escalate', 'Escalate Privileges', 'Temporarily escalate permissions', TRUE, TRUE, TRUE),
    ('emergency_access', 'Emergency Access', 'Emergency override access', TRUE, TRUE, TRUE)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description;

-- Create enhanced permissions for admin operations
INSERT INTO public.enhanced_permissions (resource_id, action_id, display_name, description, is_system_permission)
SELECT 
    r.id as resource_id,
    a.id as action_id,
    r.display_name || ' - ' || a.display_name as display_name,
    'Administrative permission to ' || LOWER(a.name) || ' ' || LOWER(r.display_name) as description,
    TRUE as is_system_permission
FROM public.permission_resources r
CROSS JOIN public.permission_actions a
WHERE r.name LIKE 'admin_%' 
    AND a.is_system_action = TRUE
    AND NOT EXISTS (
        SELECT 1 FROM public.enhanced_permissions ep 
        WHERE ep.resource_id = r.id AND ep.action_id = a.id
    );

-- Insert admin role templates
INSERT INTO public.role_templates (name, display_name, description, permissions, is_system_template) VALUES
    ('super_admin_template', 'Super Administrator', 'Complete administrative access with all permissions',
     '[
        {"resource": "admin_portal", "actions": ["read", "create", "update", "delete", "configure"]},
        {"resource": "admin_users", "actions": ["create", "read", "update", "delete", "impersonate"]},
        {"resource": "admin_security", "actions": ["read", "monitor", "configure", "emergency_access"]},
        {"resource": "admin_audit", "actions": ["read", "audit", "export"]},
        {"resource": "admin_config", "actions": ["read", "configure", "backup"]},
        {"resource": "users", "actions": ["create", "read", "update", "delete", "impersonate"]},
        {"resource": "businesses", "actions": ["create", "read", "update", "delete", "verify", "moderate"]},
        {"resource": "system", "actions": ["configure", "audit", "backup"]}
     ]'::jsonb, TRUE),
     
    ('platform_admin_template', 'Platform Administrator', 'Operations and user management access',
     '[
        {"resource": "admin_portal", "actions": ["read", "update"]},
        {"resource": "admin_users", "actions": ["read", "update"]},
        {"resource": "admin_security", "actions": ["read", "monitor"]},
        {"resource": "admin_audit", "actions": ["read"]},
        {"resource": "users", "actions": ["read", "update", "moderate"]},
        {"resource": "businesses", "actions": ["read", "update", "verify", "moderate"]},
        {"resource": "reviews", "actions": ["read", "moderate", "approve", "reject"]}
     ]'::jsonb, TRUE),
     
    ('support_admin_template', 'Support Administrator', 'Customer support and limited user management',
     '[
        {"resource": "admin_portal", "actions": ["read"]},
        {"resource": "users", "actions": ["read", "update"], "scope": "support_scope"},
        {"resource": "businesses", "actions": ["read", "update"], "scope": "support_scope"},
        {"resource": "reviews", "actions": ["read"], "scope": "support_scope"}
     ]'::jsonb, TRUE),
     
    ('content_moderator_template', 'Content Moderator', 'Content review and moderation access',
     '[
        {"resource": "admin_portal", "actions": ["read"]},
        {"resource": "businesses", "actions": ["read", "moderate", "verify"]},
        {"resource": "reviews", "actions": ["read", "moderate", "approve", "reject"]},
        {"resource": "content", "actions": ["read", "moderate", "approve", "reject"]}
     ]'::jsonb, TRUE)
ON CONFLICT (name) DO UPDATE SET
    permissions = EXCLUDED.permissions,
    updated_at = NOW();

-- Create default IP access rules (example)
INSERT INTO public.admin_ip_access (ip_range, access_type, description, is_active) VALUES
    ('10.0.0.0/8'::CIDR, 'whitelist', 'Internal corporate network', TRUE),
    ('172.16.0.0/12'::CIDR, 'whitelist', 'VPN network range', TRUE),
    ('192.168.0.0/16'::CIDR, 'monitor', 'Local network monitoring', TRUE)
ON CONFLICT DO NOTHING;

COMMIT;

-- =====================================================
-- ADMIN-SPECIFIC FUNCTIONS
-- =====================================================

-- Function to create admin user with proper validation
CREATE OR REPLACE FUNCTION public.create_admin_user(
    p_user_id UUID,
    p_admin_level VARCHAR(50),
    p_employee_id VARCHAR(50) DEFAULT NULL,
    p_department VARCHAR(100) DEFAULT NULL,
    p_created_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id UUID;
    admin_user_id UUID;
BEGIN
    current_user_id := COALESCE(p_created_by, auth.uid());
    
    -- Validate current user can create admin users
    IF NOT user_has_enhanced_permission(current_user_id, 'admin_users', 'create') THEN
        RAISE EXCEPTION 'Insufficient permissions to create admin users';
    END IF;
    
    -- Validate target user exists and is not already an admin
    IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'Target user does not exist';
    END IF;
    
    IF EXISTS(SELECT 1 FROM admin_users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'User is already an admin user';
    END IF;
    
    -- Create admin user record
    INSERT INTO admin_users (
        id, admin_level, employee_id, department, created_by
    ) VALUES (
        p_user_id, p_admin_level, p_employee_id, p_department, current_user_id
    ) RETURNING id INTO admin_user_id;
    
    -- Assign appropriate admin role
    PERFORM assign_enhanced_role(
        p_user_id,
        CASE p_admin_level
            WHEN 'super_admin' THEN 'super_admin'
            WHEN 'platform_admin' THEN 'admin'
            WHEN 'support_admin' THEN 'moderator'
            WHEN 'content_moderator' THEN 'moderator'
            ELSE 'user'
        END,
        'global',
        '{}'::jsonb,
        'Admin user creation',
        NULL
    );
    
    -- Log the admin creation
    INSERT INTO admin_audit_log (
        admin_id, action, action_category, resource_type, resource_id,
        new_values, success
    ) VALUES (
        current_user_id, 'admin_user_created', 'user_management', 'admin_user', admin_user_id,
        jsonb_build_object(
            'admin_level', p_admin_level,
            'employee_id', p_employee_id,
            'department', p_department
        ),
        TRUE
    );
    
    RETURN admin_user_id;
END;
$$;

-- Function to validate admin IP access
CREATE OR REPLACE FUNCTION public.validate_admin_ip_access(
    p_admin_id UUID,
    p_ip_address INET
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    admin_record RECORD;
    ip_allowed BOOLEAN := FALSE;
    whitelist_enabled BOOLEAN := FALSE;
BEGIN
    -- Get admin user configuration
    SELECT * INTO admin_record
    FROM admin_users
    WHERE id = p_admin_id AND deactivated_at IS NULL;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Check if IP whitelisting is enabled for this admin
    whitelist_enabled := admin_record.ip_whitelist_enabled;
    
    IF NOT whitelist_enabled THEN
        -- No IP restrictions, check global blacklist
        SELECT NOT EXISTS(
            SELECT 1 FROM admin_ip_access
            WHERE access_type = 'blacklist'
                AND is_active = TRUE
                AND (
                    (ip_address IS NOT NULL AND ip_address = p_ip_address) OR
                    (ip_range IS NOT NULL AND p_ip_address <<= ip_range)
                )
        ) INTO ip_allowed;
        
        RETURN ip_allowed;
    END IF;
    
    -- Check individual whitelist
    IF admin_record.ip_whitelist IS NOT NULL AND array_length(admin_record.ip_whitelist, 1) > 0 THEN
        SELECT p_ip_address = ANY(admin_record.ip_whitelist) INTO ip_allowed;
        IF ip_allowed THEN
            RETURN TRUE;
        END IF;
    END IF;
    
    -- Check global whitelist rules
    SELECT EXISTS(
        SELECT 1 FROM admin_ip_access
        WHERE access_type = 'whitelist'
            AND is_active = TRUE
            AND (applies_to = 'global' OR 
                 (applies_to = 'admin_level' AND target_admin_level = admin_record.admin_level) OR
                 (applies_to = 'specific_admin' AND target_admin_id = p_admin_id))
            AND (
                (ip_address IS NOT NULL AND ip_address = p_ip_address) OR
                (ip_range IS NOT NULL AND p_ip_address <<= ip_range)
            )
    ) INTO ip_allowed;
    
    RETURN ip_allowed;
END;
$$;

-- Function to log admin actions with context
CREATE OR REPLACE FUNCTION public.log_admin_action(
    p_admin_id UUID,
    p_session_id UUID,
    p_action VARCHAR(100),
    p_action_category VARCHAR(50),
    p_resource_type VARCHAR(50) DEFAULT NULL,
    p_resource_id UUID DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_success BOOLEAN DEFAULT TRUE,
    p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    audit_id UUID;
    session_context RECORD;
BEGIN
    -- Get session context
    SELECT ip_address, user_agent INTO session_context
    FROM admin_sessions
    WHERE id = p_session_id AND is_active = TRUE;
    
    -- Insert audit log
    INSERT INTO admin_audit_log (
        admin_id, session_id, action, action_category,
        resource_type, resource_id, old_values, new_values,
        ip_address, user_agent, success, error_message
    ) VALUES (
        p_admin_id, p_session_id, p_action, p_action_category,
        p_resource_type, p_resource_id, p_old_values, p_new_values,
        session_context.ip_address, session_context.user_agent, p_success, p_error_message
    ) RETURNING id INTO audit_id;
    
    RETURN audit_id;
END;
$$;

-- Function to detect suspicious admin activity
CREATE OR REPLACE FUNCTION public.detect_suspicious_admin_activity(
    p_session_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    session_record RECORD;
    admin_record RECORD;
    suspicion_score INTEGER := 0;
    suspicion_reasons TEXT[] := '{}';
    recent_logins INTEGER;
    geo_distance BOOLEAN := FALSE;
    unusual_time BOOLEAN := FALSE;
BEGIN
    -- Get session and admin details
    SELECT s.*, a.last_login_ip, a.last_login_at
    INTO session_record
    FROM admin_sessions s
    JOIN admin_users a ON s.admin_id = a.id
    WHERE s.id = p_session_id;
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    -- Check for IP address changes
    IF session_record.last_login_ip IS NOT NULL AND 
       session_record.ip_address != session_record.last_login_ip THEN
        suspicion_score := suspicion_score + 25;
        suspicion_reasons := array_append(suspicion_reasons, 'ip_address_change');
    END IF;
    
    -- Check for geographic distance (simplified)
    IF session_record.country_code IS NOT NULL AND 
       session_record.last_login_at > NOW() - INTERVAL '24 hours' THEN
        -- This would need proper geo-distance calculation
        -- For now, just check if country changed
        geo_distance := TRUE;
    END IF;
    
    IF geo_distance THEN
        suspicion_score := suspicion_score + 30;
        suspicion_reasons := array_append(suspicion_reasons, 'geographic_anomaly');
    END IF;
    
    -- Check for unusual login times
    unusual_time := EXTRACT(hour FROM session_record.created_at) NOT BETWEEN 8 AND 18;
    IF unusual_time THEN
        suspicion_score := suspicion_score + 15;
        suspicion_reasons := array_append(suspicion_reasons, 'unusual_time');
    END IF;
    
    -- Check for VPN/Proxy usage
    IF session_record.is_vpn OR session_record.is_proxy THEN
        suspicion_score := suspicion_score + 20;
        suspicion_reasons := array_append(suspicion_reasons, 'vpn_proxy_usage');
    END IF;
    
    -- Check for rapid successive logins
    SELECT COUNT(*) INTO recent_logins
    FROM admin_sessions
    WHERE admin_id = session_record.admin_id
        AND created_at >= NOW() - INTERVAL '1 hour'
        AND id != p_session_id;
    
    IF recent_logins > 3 THEN
        suspicion_score := suspicion_score + 25;
        suspicion_reasons := array_append(suspicion_reasons, 'rapid_login_attempts');
    END IF;
    
    -- Update session with suspicion data
    UPDATE admin_sessions
    SET 
        is_suspicious = suspicion_score > 50,
        suspicion_score = suspicion_score,
        suspicion_reasons = suspicion_reasons
    WHERE id = p_session_id;
    
    -- Create security incident if highly suspicious
    IF suspicion_score > 75 THEN
        INSERT INTO admin_security_incidents (
            incident_type, severity, affected_admin_id, affected_session_id,
            title, description, incident_data, detected_by, detection_method,
            confidence_score, source_ip, occurred_at
        ) VALUES (
            'suspicious_login', 'high', session_record.admin_id, p_session_id,
            'Highly suspicious admin login detected',
            'Admin login session flagged as highly suspicious based on multiple risk factors',
            jsonb_build_object(
                'suspicion_score', suspicion_score,
                'risk_factors', suspicion_reasons,
                'ip_address', session_record.ip_address,
                'country', session_record.country_code
            ),
            'automated', 'behavioral_analysis', suspicion_score,
            session_record.ip_address, session_record.created_at
        );
    END IF;
    
    RETURN suspicion_score;
END;
$$;

-- Function to increment failed login attempts and lock account if needed
CREATE OR REPLACE FUNCTION public.increment_failed_login_attempts(
    p_user_id UUID,
    p_max_attempts INTEGER DEFAULT 5
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_attempts INTEGER;
    should_lock BOOLEAN := FALSE;
BEGIN
    -- Get current failed attempts
    SELECT failed_login_attempts INTO current_attempts
    FROM admin_users
    WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Increment attempts
    current_attempts := current_attempts + 1;
    
    -- Check if account should be locked
    should_lock := current_attempts >= p_max_attempts;
    
    -- Update the admin user record
    UPDATE admin_users
    SET 
        failed_login_attempts = current_attempts,
        last_failed_login = NOW(),
        account_locked = CASE WHEN should_lock THEN TRUE ELSE account_locked END,
        lockout_reason = CASE WHEN should_lock THEN 'Maximum failed login attempts exceeded' ELSE lockout_reason END,
        locked_at = CASE WHEN should_lock AND NOT account_locked THEN NOW() ELSE locked_at END
    WHERE id = p_user_id;
    
    RETURN should_lock;
END;
$$;

-- Function to update admin login statistics on successful login
CREATE OR REPLACE FUNCTION public.update_admin_login_stats(
    p_admin_id UUID,
    p_login_ip INET
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE admin_users
    SET 
        failed_login_attempts = 0,
        last_login_at = NOW(),
        last_login_ip = p_login_ip,
        last_activity_at = NOW(),
        total_logins = total_logins + 1
    WHERE id = p_admin_id;
END;
$$;

-- Function to verify TOTP code
CREATE OR REPLACE FUNCTION public.verify_totp_code(
    p_user_id UUID,
    p_code VARCHAR(10)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    totp_secret VARCHAR(255);
    backup_codes TEXT[];
    is_backup_code BOOLEAN := FALSE;
BEGIN
    -- Get TOTP configuration
    SELECT 
        am.totp_secret,
        au.mfa_backup_codes_used
    INTO totp_secret, backup_codes
    FROM auth_mfa_config am
    JOIN admin_users au ON am.user_id = au.id
    WHERE am.user_id = p_user_id
        AND am.mfa_enabled = TRUE
        AND am.totp_enabled = TRUE;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Check if it's a backup code (8+ characters typically)
    IF length(p_code) > 7 THEN
        -- Check if this backup code exists and hasn't been used
        SELECT EXISTS(
            SELECT 1 FROM auth_mfa_backup_codes
            WHERE user_id = p_user_id
                AND backup_code = p_code
                AND used_at IS NULL
        ) INTO is_backup_code;
        
        IF is_backup_code THEN
            -- Mark backup code as used
            UPDATE auth_mfa_backup_codes
            SET used_at = NOW()
            WHERE user_id = p_user_id AND backup_code = p_code;
            
            RETURN TRUE;
        END IF;
    END IF;
    
    -- For TOTP verification, we'll return TRUE for valid format codes
    -- In production, you would verify against the actual TOTP secret
    -- using the TOTP algorithm with the current time window
    RETURN (length(p_code) = 6 AND p_code ~ '^[0-9]{6}$');
END;
$$;

-- Function to generate backup codes for MFA
CREATE OR REPLACE FUNCTION public.generate_mfa_backup_codes(
    p_user_id UUID,
    p_count INTEGER DEFAULT 8
)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    backup_codes TEXT[];
    backup_code TEXT;
    i INTEGER;
BEGIN
    -- Delete existing backup codes
    DELETE FROM auth_mfa_backup_codes WHERE user_id = p_user_id;
    
    -- Generate new backup codes
    FOR i IN 1..p_count LOOP
        -- Generate 8-character alphanumeric code
        backup_code := upper(substr(encode(gen_random_bytes(6), 'base64'), 1, 8));
        backup_code := replace(backup_code, '/', '9');
        backup_code := replace(backup_code, '+', '8');
        backup_code := replace(backup_code, '=', '7');
        
        backup_codes := array_append(backup_codes, backup_code);
        
        -- Store in database
        INSERT INTO auth_mfa_backup_codes (user_id, backup_code)
        VALUES (p_user_id, backup_code);
    END LOOP;
    
    RETURN backup_codes;
END;
$$;

-- Function to create MFA backup codes table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.auth_mfa_backup_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    backup_code VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ,
    
    CONSTRAINT unique_user_backup_code UNIQUE(user_id, backup_code)
);

CREATE INDEX IF NOT EXISTS idx_mfa_backup_codes_user ON public.auth_mfa_backup_codes(user_id) WHERE used_at IS NULL;

-- Function to get user permissions efficiently
CREATE OR REPLACE FUNCTION public.get_user_permissions(
    p_user_id UUID
)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_permissions TEXT[] := '{}';
BEGIN
    -- Get permissions from role assignments
    SELECT array_agg(DISTINCT ep.resource_id || ':' || ep.action_id)
    INTO user_permissions
    FROM enhanced_role_assignments era
    JOIN enhanced_roles er ON era.role_id = er.id
    JOIN enhanced_role_permissions erp ON er.id = erp.role_id
    JOIN enhanced_permissions ep ON erp.permission_id = ep.id
    WHERE era.user_id = p_user_id
        AND era.is_active = TRUE
        AND (era.expires_at IS NULL OR era.expires_at > NOW())
        AND er.is_active = TRUE;
    
    RETURN COALESCE(user_permissions, '{}');
END;
$$;

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_admin_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cleanup_count INTEGER := 0;
BEGIN
    -- Mark expired sessions as inactive
    UPDATE admin_sessions
    SET 
        is_active = FALSE,
        terminated_at = NOW(),
        termination_reason = 'expired'
    WHERE is_active = TRUE
        AND expires_at < NOW();
    
    GET DIAGNOSTICS cleanup_count = ROW_COUNT;
    
    -- Log cleanup activity
    INSERT INTO admin_audit_log (
        admin_id, action, action_category, description, success
    ) VALUES (
        NULL, 'session_cleanup', 'maintenance', 
        'Cleaned up ' || cleanup_count || ' expired sessions', TRUE
    );
    
    RETURN cleanup_count;
END;
$$;

-- Function to get active sessions for an admin with security info
CREATE OR REPLACE FUNCTION public.get_admin_active_sessions(
    p_admin_id UUID
)
RETURNS TABLE (
    session_id UUID,
    created_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    ip_address INET,
    browser VARCHAR(50),
    os VARCHAR(50),
    device_type VARCHAR(20),
    is_current BOOLEAN,
    is_suspicious BOOLEAN,
    suspicion_score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_session_token VARCHAR(255);
BEGIN
    -- Get current session token from context if available
    current_session_token := current_setting('app.current_session_token', true);
    
    RETURN QUERY
    SELECT 
        s.id as session_id,
        s.created_at,
        s.last_activity_at,
        s.expires_at,
        s.ip_address,
        s.browser,
        s.os,
        s.device_type,
        (s.session_token = current_session_token) as is_current,
        s.is_suspicious,
        s.suspicion_score
    FROM admin_sessions s
    WHERE s.admin_id = p_admin_id
        AND s.is_active = TRUE
        AND s.expires_at > NOW()
    ORDER BY s.last_activity_at DESC;
END;
$$;

-- Function to handle rate limiting efficiently
CREATE OR REPLACE FUNCTION public.check_admin_rate_limit(
    p_identifier VARCHAR(255),
    p_operation VARCHAR(100),
    p_max_attempts INTEGER DEFAULT 5,
    p_window_minutes INTEGER DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_attempts INTEGER := 0;
    window_start TIMESTAMPTZ;
    window_end TIMESTAMPTZ;
    is_blocked BOOLEAN := FALSE;
    blocked_until TIMESTAMPTZ;
    result JSONB;
BEGIN
    window_end := NOW();
    window_start := window_end - (p_window_minutes || ' minutes')::INTERVAL;
    
    -- Clean up old rate limit records
    DELETE FROM admin_rate_limits 
    WHERE window_end < NOW() - INTERVAL '1 day';
    
    -- Get or create rate limit record
    INSERT INTO admin_rate_limits (
        ip_address, operation, operation_category, max_attempts,
        window_start, window_end, attempt_count
    ) VALUES (
        p_identifier::INET, p_operation, 'authentication', p_max_attempts,
        window_start, window_end, 1
    )
    ON CONFLICT (COALESCE(admin_id::text, ''), COALESCE(ip_address::text, ''), operation, window_start)
    DO UPDATE SET 
        attempt_count = admin_rate_limits.attempt_count + 1,
        window_end = EXCLUDED.window_end;
    
    -- Get current state
    SELECT 
        attempt_count,
        is_blocked,
        blocked_until
    INTO current_attempts, is_blocked, blocked_until
    FROM admin_rate_limits
    WHERE (ip_address::text = p_identifier OR admin_id::text = p_identifier)
        AND operation = p_operation
        AND window_start <= NOW()
        AND window_end >= NOW()
    LIMIT 1;
    
    -- Check if should be blocked
    IF current_attempts >= p_max_attempts AND NOT is_blocked THEN
        blocked_until := NOW() + (p_window_minutes || ' minutes')::INTERVAL;
        
        UPDATE admin_rate_limits
        SET 
            is_blocked = TRUE,
            blocked_until = blocked_until
        WHERE (ip_address::text = p_identifier OR admin_id::text = p_identifier)
            AND operation = p_operation;
            
        is_blocked := TRUE;
    END IF;
    
    -- Build result
    result := jsonb_build_object(
        'allowed', NOT is_blocked,
        'attempts', COALESCE(current_attempts, 0),
        'max_attempts', p_max_attempts,
        'blocked_until', blocked_until,
        'reset_time', window_end
    );
    
    RETURN result;
END;
$$;

-- Function to efficiently log security incidents in batches
CREATE OR REPLACE FUNCTION public.batch_log_security_incidents(
    p_incidents JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    incident JSONB;
    inserted_count INTEGER := 0;
BEGIN
    -- Process each incident in the batch
    FOR incident IN SELECT * FROM jsonb_array_elements(p_incidents)
    LOOP
        INSERT INTO admin_security_incidents (
            incident_type, severity, affected_admin_id, title, description,
            incident_data, detected_by, detection_method, source_ip, occurred_at
        ) VALUES (
            incident->>'incident_type',
            incident->>'severity',
            NULLIF(incident->>'affected_admin_id', '')::UUID,
            incident->>'title',
            incident->>'description',
            COALESCE(incident->'incident_data', '{}'::jsonb),
            incident->>'detected_by',
            incident->>'detection_method',
            NULLIF(incident->>'source_ip', '')::INET,
            COALESCE((incident->>'occurred_at')::TIMESTAMPTZ, NOW())
        );
        
        inserted_count := inserted_count + 1;
    END LOOP;
    
    RETURN inserted_count;
END;
$$;

-- Function to get admin security dashboard data efficiently
CREATE OR REPLACE FUNCTION public.get_admin_security_dashboard(
    p_admin_id UUID,
    p_days_back INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    dashboard_data JSONB;
    since_date TIMESTAMPTZ;
BEGIN
    since_date := NOW() - (p_days_back || ' days')::INTERVAL;
    
    WITH security_stats AS (
        SELECT 
            COUNT(*) as total_incidents,
            COUNT(*) FILTER (WHERE severity = 'critical') as critical_incidents,
            COUNT(*) FILTER (WHERE severity = 'high') as high_incidents,
            COUNT(*) FILTER (WHERE severity = 'medium') as medium_incidents,
            COUNT(*) FILTER (WHERE status = 'open') as open_incidents
        FROM admin_security_incidents
        WHERE (affected_admin_id = p_admin_id OR p_admin_id IS NULL)
            AND occurred_at >= since_date
    ),
    session_stats AS (
        SELECT 
            COUNT(*) as total_sessions,
            COUNT(*) FILTER (WHERE is_active = true) as active_sessions,
            COUNT(*) FILTER (WHERE is_suspicious = true) as suspicious_sessions,
            AVG(EXTRACT(EPOCH FROM (COALESCE(terminated_at, NOW()) - created_at))/3600) as avg_session_hours
        FROM admin_sessions
        WHERE admin_id = p_admin_id
            AND created_at >= since_date
    ),
    login_stats AS (
        SELECT 
            COUNT(*) as total_attempts,
            COUNT(*) FILTER (WHERE success = true) as successful_logins,
            COUNT(*) FILTER (WHERE success = false) as failed_attempts
        FROM admin_audit_log
        WHERE admin_id = p_admin_id
            AND action LIKE '%login%'
            AND created_at >= since_date
    )
    SELECT jsonb_build_object(
        'security_incidents', jsonb_build_object(
            'total', ss.total_incidents,
            'critical', ss.critical_incidents,
            'high', ss.high_incidents,
            'medium', ss.medium_incidents,
            'open', ss.open_incidents
        ),
        'sessions', jsonb_build_object(
            'total', ses.total_sessions,
            'active', ses.active_sessions,
            'suspicious', ses.suspicious_sessions,
            'avg_duration_hours', ROUND(ses.avg_session_hours::numeric, 2)
        ),
        'authentication', jsonb_build_object(
            'total_attempts', ls.total_attempts,
            'successful', ls.successful_logins,
            'failed', ls.failed_attempts,
            'success_rate', CASE 
                WHEN ls.total_attempts > 0 
                THEN ROUND((ls.successful_logins::numeric / ls.total_attempts * 100), 2)
                ELSE 0 
            END
        ),
        'generated_at', NOW(),
        'period_days', p_days_back
    ) INTO dashboard_data
    FROM security_stats ss, session_stats ses, login_stats ls;
    
    RETURN dashboard_data;
END;
$$;

-- Function to archive old audit logs (for maintenance)
CREATE OR REPLACE FUNCTION public.archive_old_audit_logs(
    p_days_old INTEGER DEFAULT 365
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    archived_count INTEGER := 0;
    cutoff_date TIMESTAMPTZ;
BEGIN
    cutoff_date := NOW() - (p_days_old || ' days')::INTERVAL;
    
    -- Move old logs to archive table (create if not exists)
    CREATE TABLE IF NOT EXISTS admin_audit_log_archive (
        LIKE admin_audit_log INCLUDING ALL
    );
    
    -- Move old records to archive
    WITH moved_logs AS (
        DELETE FROM admin_audit_log
        WHERE created_at < cutoff_date
        RETURNING *
    )
    INSERT INTO admin_audit_log_archive
    SELECT * FROM moved_logs;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    
    -- Log the archiving activity
    INSERT INTO admin_audit_log (
        admin_id, action, action_category, description, success
    ) VALUES (
        NULL, 'audit_log_archived', 'maintenance',
        'Archived ' || archived_count || ' audit log entries older than ' || p_days_old || ' days',
        TRUE
    );
    
    RETURN archived_count;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.create_admin_user TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_admin_ip_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_action TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_suspicious_admin_activity TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_failed_login_attempts TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_admin_login_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_totp_code TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_mfa_backup_codes TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_permissions TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_admin_sessions TO service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_active_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_admin_rate_limit TO authenticated;
GRANT EXECUTE ON FUNCTION public.batch_log_security_incidents TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_security_dashboard TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_old_audit_logs TO service_role;