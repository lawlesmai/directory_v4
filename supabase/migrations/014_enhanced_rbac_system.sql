-- Migration: 014_enhanced_rbac_system
-- Epic 2 Story 2.8: Comprehensive Role-Based Access Control (RBAC) System
-- Description: Enhanced RBAC with hierarchical roles, granular permissions, business context authorization, and high-performance caching
-- Date: 2025-01-26
-- Author: Backend Architecture Expert

BEGIN;

-- =====================================================
-- ENHANCED RBAC TABLES
-- =====================================================

-- Role templates for common permission sets
CREATE TABLE IF NOT EXISTS public.role_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    description TEXT,
    
    -- Template configuration
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of permission objects
    is_system_template BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enhanced permissions table with resource hierarchy
CREATE TABLE IF NOT EXISTS public.permission_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    description TEXT,
    
    -- Resource hierarchy
    parent_resource VARCHAR(100) REFERENCES public.permission_resources(name),
    resource_path VARCHAR(500) NOT NULL, -- Full hierarchical path
    hierarchy_level INTEGER DEFAULT 0,
    
    -- Resource configuration
    allows_scoping BOOLEAN DEFAULT FALSE, -- Can be scoped to specific entities
    scope_entity_type VARCHAR(50), -- 'business', 'category', etc.
    
    -- System flags
    is_system_resource BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permission actions for resources
CREATE TABLE IF NOT EXISTS public.permission_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Action configuration
    is_destructive BOOLEAN DEFAULT FALSE, -- Requires additional confirmation
    requires_mfa BOOLEAN DEFAULT FALSE,
    requires_approval BOOLEAN DEFAULT FALSE,
    
    -- System flags
    is_system_action BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced permissions combining resources and actions
CREATE TABLE IF NOT EXISTS public.enhanced_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES public.permission_resources(id),
    action_id UUID NOT NULL REFERENCES public.permission_actions(id),
    
    -- Permission details
    name VARCHAR(150) GENERATED ALWAYS AS (
        (SELECT name FROM permission_resources WHERE id = resource_id) || ':' || 
        (SELECT name FROM permission_actions WHERE id = action_id)
    ) STORED,
    display_name VARCHAR(200),
    description TEXT,
    
    -- Permission configuration
    condition_expression TEXT, -- JSONPath or SQL expression for conditional permissions
    context_requirements JSONB DEFAULT '{}'::jsonb,
    
    -- System flags
    is_system_permission BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_resource_action UNIQUE(resource_id, action_id)
);

-- Permission dependencies and conflicts
CREATE TABLE IF NOT EXISTS public.permission_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_id UUID NOT NULL REFERENCES public.enhanced_permissions(id) ON DELETE CASCADE,
    
    -- Dependency configuration
    dependency_type VARCHAR(20) NOT NULL CHECK (dependency_type IN ('requires', 'conflicts', 'implies')),
    dependent_permission_id UUID NOT NULL REFERENCES public.enhanced_permissions(id) ON DELETE CASCADE,
    
    -- Dependency details
    description TEXT,
    is_strict BOOLEAN DEFAULT TRUE, -- If false, dependency is advisory only
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_permission_dependency UNIQUE(permission_id, dependent_permission_id, dependency_type),
    CONSTRAINT no_self_dependency CHECK (permission_id != dependent_permission_id)
);

-- Enhanced role hierarchy with inheritance
CREATE TABLE IF NOT EXISTS public.role_hierarchy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    child_role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    
    -- Inheritance configuration
    inheritance_type VARCHAR(20) DEFAULT 'full' CHECK (inheritance_type IN ('full', 'partial', 'override')),
    permission_filters JSONB DEFAULT '{}'::jsonb, -- Filters for partial inheritance
    
    -- Hierarchy details
    hierarchy_depth INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_role_hierarchy UNIQUE(parent_role_id, child_role_id),
    CONSTRAINT no_self_inheritance CHECK (parent_role_id != child_role_id)
);

-- Enhanced role permissions with granular control
CREATE TABLE IF NOT EXISTS public.enhanced_role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.enhanced_permissions(id) ON DELETE CASCADE,
    
    -- Permission grant details
    grant_type VARCHAR(20) DEFAULT 'allow' CHECK (grant_type IN ('allow', 'deny', 'conditional')),
    condition_expression TEXT, -- For conditional grants
    
    -- Scope and context
    scope_type VARCHAR(50), -- 'global', 'business', 'category', 'custom'
    scope_constraints JSONB DEFAULT '{}'::jsonb,
    
    -- Administrative details
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    -- Audit and approval
    requires_approval BOOLEAN DEFAULT FALSE,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    approval_notes TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT unique_enhanced_role_permission UNIQUE(role_id, permission_id, scope_type, scope_constraints)
);

-- Business context permissions for complex authorization
CREATE TABLE IF NOT EXISTS public.business_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    -- Business-specific role
    business_role VARCHAR(50) NOT NULL, -- 'owner', 'manager', 'employee', 'contributor'
    permission_level VARCHAR(20) NOT NULL DEFAULT 'basic' CHECK (
        permission_level IN ('basic', 'advanced', 'admin', 'full')
    ),
    
    -- Specific permissions within business context
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Employment/relationship details
    relationship_type VARCHAR(30) NOT NULL DEFAULT 'owner' CHECK (
        relationship_type IN ('owner', 'co_owner', 'manager', 'employee', 'contractor', 'contributor')
    ),
    employment_status VARCHAR(20) DEFAULT 'active' CHECK (
        employment_status IN ('active', 'inactive', 'suspended', 'terminated')
    ),
    
    -- Administrative details
    assigned_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    effective_from TIMESTAMPTZ DEFAULT NOW(),
    effective_until TIMESTAMPTZ,
    
    -- Territory and department scoping
    territory_scope JSONB DEFAULT '{}'::jsonb, -- Geographic or departmental constraints
    department VARCHAR(100),
    
    -- Status and audit
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_business_user_role UNIQUE(user_id, business_id, business_role, relationship_type)
);

-- Permission evaluation cache for high performance
CREATE TABLE IF NOT EXISTS public.permission_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Cache key components
    cache_key VARCHAR(500) NOT NULL,
    context_hash VARCHAR(64) NOT NULL, -- SHA256 hash of context
    
    -- Cached permissions
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    roles JSONB NOT NULL DEFAULT '[]'::jsonb,
    business_permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Cache metadata
    cache_version INTEGER DEFAULT 1,
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour',
    
    -- Performance metrics
    computation_time_ms INTEGER,
    cache_hit_count INTEGER DEFAULT 0,
    
    CONSTRAINT unique_user_cache_key UNIQUE(user_id, cache_key)
);

-- Administrative approval workflows
CREATE TABLE IF NOT EXISTS public.permission_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Request details
    request_type VARCHAR(30) NOT NULL CHECK (
        request_type IN ('role_assignment', 'permission_grant', 'business_access', 'privilege_escalation')
    ),
    requested_for_user_id UUID NOT NULL REFERENCES auth.users(id),
    requested_by_user_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- Request content
    request_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    justification TEXT NOT NULL,
    
    -- Approval workflow
    approval_status VARCHAR(20) DEFAULT 'pending' CHECK (
        approval_status IN ('pending', 'approved', 'denied', 'withdrawn', 'expired')
    ),
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    approval_notes TEXT,
    
    -- Emergency and urgency
    urgency_level VARCHAR(10) DEFAULT 'normal' CHECK (
        urgency_level IN ('low', 'normal', 'high', 'urgent', 'emergency')
    ),
    is_emergency_override BOOLEAN DEFAULT FALSE,
    emergency_justification TEXT,
    
    -- Lifecycle
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ENHANCED INDEXES FOR PERFORMANCE
-- =====================================================

-- Permission cache indexes for sub-10ms lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_permission_cache_user_key 
    ON public.permission_cache(user_id, cache_key) 
    WHERE expires_at > NOW();

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_permission_cache_expires 
    ON public.permission_cache(expires_at) 
    WHERE expires_at > NOW();

-- Business permissions indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_permissions_user_business 
    ON public.business_permissions(user_id, business_id) 
    WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_permissions_business_role 
    ON public.business_permissions(business_id, business_role) 
    WHERE is_active = true AND employment_status = 'active';

-- Enhanced permissions indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enhanced_permissions_resource_action 
    ON public.enhanced_permissions(resource_id, action_id) 
    WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enhanced_role_permissions_role 
    ON public.enhanced_role_permissions(role_id) 
    WHERE is_active = true;

-- Role hierarchy indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_role_hierarchy_parent 
    ON public.role_hierarchy(parent_role_id) 
    WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_role_hierarchy_child 
    ON public.role_hierarchy(child_role_id) 
    WHERE is_active = true;

-- Approval workflow indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_permission_approvals_status 
    ON public.permission_approvals(approval_status) 
    WHERE approval_status = 'pending' AND expires_at > NOW();

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_permission_approvals_user 
    ON public.permission_approvals(requested_for_user_id, approval_status);

-- =====================================================
-- SEED DATA FOR ENHANCED RBAC
-- =====================================================

-- Insert permission resources with hierarchy
INSERT INTO public.permission_resources (name, display_name, description, parent_resource, resource_path, hierarchy_level, allows_scoping, is_system_resource) VALUES
    -- Root level resources
    ('system', 'System Administration', 'Root system administration access', NULL, 'system', 0, FALSE, TRUE),
    ('users', 'User Management', 'User account management operations', NULL, 'users', 0, TRUE, TRUE),
    ('businesses', 'Business Management', 'Business entity management operations', NULL, 'businesses', 0, TRUE, TRUE),
    ('reviews', 'Review Management', 'Review and rating management operations', NULL, 'reviews', 0, TRUE, TRUE),
    ('analytics', 'Analytics Access', 'Analytics and reporting access', NULL, 'analytics', 0, TRUE, TRUE),
    ('content', 'Content Management', 'Content moderation and management', NULL, 'content', 0, TRUE, TRUE),
    
    -- System sub-resources
    ('system.config', 'System Configuration', 'System configuration management', 'system', 'system/config', 1, FALSE, TRUE),
    ('system.monitoring', 'System Monitoring', 'System monitoring and health checks', 'system', 'system/monitoring', 1, FALSE, TRUE),
    ('system.backup', 'System Backup', 'System backup and recovery operations', 'system', 'system/backup', 1, FALSE, TRUE),
    ('system.audit', 'System Audit', 'System audit log access and management', 'system', 'system/audit', 1, FALSE, TRUE),
    
    -- User management sub-resources
    ('users.profiles', 'User Profiles', 'User profile management', 'users', 'users/profiles', 1, TRUE, TRUE),
    ('users.security', 'User Security', 'User security and authentication settings', 'users', 'users/security', 1, TRUE, TRUE),
    ('users.permissions', 'User Permissions', 'User role and permission management', 'users', 'users/permissions', 1, TRUE, TRUE),
    
    -- Business management sub-resources
    ('businesses.listings', 'Business Listings', 'Business listing management', 'businesses', 'businesses/listings', 1, TRUE, TRUE),
    ('businesses.verification', 'Business Verification', 'Business verification processes', 'businesses', 'businesses/verification', 1, TRUE, TRUE),
    ('businesses.analytics', 'Business Analytics', 'Business-specific analytics', 'businesses', 'businesses/analytics', 1, TRUE, TRUE),
    ('businesses.subscription', 'Business Subscriptions', 'Business subscription management', 'businesses', 'businesses/subscription', 1, TRUE, TRUE)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description;

-- Insert permission actions
INSERT INTO public.permission_actions (name, display_name, description, is_destructive, requires_mfa, is_system_action) VALUES
    ('create', 'Create', 'Create new entities or records', FALSE, FALSE, TRUE),
    ('read', 'Read', 'View and read existing data', FALSE, FALSE, TRUE),
    ('update', 'Update', 'Modify existing entities or records', FALSE, FALSE, TRUE),
    ('delete', 'Delete', 'Remove entities or records', TRUE, TRUE, TRUE),
    ('list', 'List', 'List and search entities', FALSE, FALSE, TRUE),
    ('export', 'Export', 'Export data to external formats', FALSE, FALSE, TRUE),
    ('import', 'Import', 'Import data from external sources', FALSE, FALSE, TRUE),
    ('approve', 'Approve', 'Approve pending requests or submissions', FALSE, FALSE, TRUE),
    ('reject', 'Reject', 'Reject pending requests or submissions', FALSE, FALSE, TRUE),
    ('moderate', 'Moderate', 'Moderate content and user submissions', FALSE, FALSE, TRUE),
    ('verify', 'Verify', 'Verify entities for authenticity', FALSE, FALSE, TRUE),
    ('suspend', 'Suspend', 'Temporarily suspend entities or access', TRUE, TRUE, TRUE),
    ('restore', 'Restore', 'Restore suspended entities or access', FALSE, FALSE, TRUE),
    ('transfer', 'Transfer', 'Transfer ownership or control', TRUE, TRUE, TRUE),
    ('configure', 'Configure', 'Configure settings and preferences', FALSE, FALSE, TRUE),
    ('monitor', 'Monitor', 'Monitor system health and performance', FALSE, FALSE, TRUE),
    ('audit', 'Audit', 'Access audit logs and compliance data', FALSE, FALSE, TRUE),
    ('backup', 'Backup', 'Perform backup operations', FALSE, FALSE, TRUE),
    ('impersonate', 'Impersonate', 'Act on behalf of another user', TRUE, TRUE, TRUE),
    ('override', 'Override', 'Override system restrictions or rules', TRUE, TRUE, TRUE)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description;

-- Create enhanced permissions by combining resources and actions
INSERT INTO public.enhanced_permissions (resource_id, action_id, display_name, description, is_system_permission)
SELECT 
    r.id as resource_id,
    a.id as action_id,
    r.display_name || ' - ' || a.display_name as display_name,
    'Permission to ' || LOWER(a.name) || ' ' || LOWER(r.display_name) as description,
    TRUE as is_system_permission
FROM public.permission_resources r
CROSS JOIN public.permission_actions a
WHERE r.is_system_resource = TRUE 
    AND a.is_system_action = TRUE
    AND NOT EXISTS (
        SELECT 1 FROM public.enhanced_permissions ep 
        WHERE ep.resource_id = r.id AND ep.action_id = a.id
    );

-- Insert role templates for common permission sets
INSERT INTO public.role_templates (name, display_name, description, permissions, is_system_template) VALUES
    ('business_owner_full', 'Business Owner (Full Access)', 'Complete business management permissions',
     '[
        {"resource": "businesses", "actions": ["create", "read", "update", "delete", "configure"]},
        {"resource": "businesses.listings", "actions": ["create", "read", "update", "delete"]},
        {"resource": "businesses.analytics", "actions": ["read", "export"]},
        {"resource": "reviews", "actions": ["read", "moderate"], "scope": "business_owned"}
     ]'::jsonb, TRUE),
    
    ('business_manager', 'Business Manager', 'Business management with limited administrative access',
     '[
        {"resource": "businesses", "actions": ["read", "update"]},
        {"resource": "businesses.listings", "actions": ["read", "update"]},
        {"resource": "businesses.analytics", "actions": ["read"]},
        {"resource": "reviews", "actions": ["read"], "scope": "business_assigned"}
     ]'::jsonb, TRUE),
     
    ('content_moderator', 'Content Moderator', 'Content moderation and review management',
     '[
        {"resource": "reviews", "actions": ["read", "moderate", "approve", "reject"]},
        {"resource": "businesses", "actions": ["read", "moderate"]},
        {"resource": "content", "actions": ["read", "moderate", "approve", "reject"]}
     ]'::jsonb, TRUE),
     
    ('analytics_viewer', 'Analytics Viewer', 'Read-only analytics and reporting access',
     '[
        {"resource": "analytics", "actions": ["read"]},
        {"resource": "businesses.analytics", "actions": ["read"]},
        {"resource": "users", "actions": ["read"], "fields": ["aggregate_only"]}
     ]'::jsonb, TRUE)
ON CONFLICT (name) DO UPDATE SET
    permissions = EXCLUDED.permissions,
    updated_at = NOW();

-- Set up role hierarchy relationships
INSERT INTO public.role_hierarchy (parent_role_id, child_role_id, inheritance_type, hierarchy_depth)
SELECT 
    p.id as parent_role_id,
    c.id as child_role_id,
    'full' as inheritance_type,
    1 as hierarchy_depth
FROM public.roles p
CROSS JOIN public.roles c
WHERE (p.name = 'super_admin' AND c.name IN ('admin', 'moderator', 'business_owner', 'user'))
   OR (p.name = 'admin' AND c.name IN ('moderator', 'business_owner', 'user'))
   OR (p.name = 'moderator' AND c.name IN ('user'))
   OR (p.name = 'business_owner' AND c.name IN ('user'))
   AND NOT EXISTS (
       SELECT 1 FROM public.role_hierarchy rh 
       WHERE rh.parent_role_id = p.id AND rh.child_role_id = c.id
   );

COMMIT;

-- =====================================================
-- HIGH-PERFORMANCE RBAC FUNCTIONS
-- =====================================================

-- Enhanced permission evaluation function with caching
CREATE OR REPLACE FUNCTION public.evaluate_user_permissions(
    p_user_id UUID,
    p_context JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(
    resource_name VARCHAR(100),
    action_name VARCHAR(50),
    permission_name VARCHAR(150),
    grant_type VARCHAR(20),
    scope_type VARCHAR(50),
    scope_constraints JSONB,
    is_inherited BOOLEAN,
    source_role VARCHAR(50)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cache_key VARCHAR(500);
    context_hash VARCHAR(64);
    cached_result RECORD;
    start_time TIMESTAMPTZ;
    computation_time INTEGER;
BEGIN
    start_time := NOW();
    
    -- Generate cache key and context hash
    cache_key := 'permissions:' || p_user_id::text;
    context_hash := encode(sha256(p_context::text::bytea), 'hex');
    
    -- Check cache first
    SELECT * INTO cached_result
    FROM permission_cache
    WHERE user_id = p_user_id 
        AND cache_key = cache_key
        AND context_hash = context_hash
        AND expires_at > NOW();
    
    IF FOUND THEN
        -- Update cache hit count
        UPDATE permission_cache 
        SET cache_hit_count = cache_hit_count + 1
        WHERE id = cached_result.id;
        
        -- Return cached permissions
        RETURN QUERY
        SELECT 
            (perm->>'resource_name')::VARCHAR(100),
            (perm->>'action_name')::VARCHAR(50),
            (perm->>'permission_name')::VARCHAR(150),
            (perm->>'grant_type')::VARCHAR(20),
            (perm->>'scope_type')::VARCHAR(50),
            (perm->'scope_constraints')::JSONB,
            (perm->>'is_inherited')::BOOLEAN,
            (perm->>'source_role')::VARCHAR(50)
        FROM jsonb_array_elements(cached_result.permissions) AS perm;
        
        RETURN;
    END IF;
    
    -- Compute permissions from scratch
    RETURN QUERY
    WITH RECURSIVE role_hierarchy_expanded AS (
        -- Start with direct user roles
        SELECT 
            ur.role_id,
            r.name as role_name,
            0 as inheritance_level,
            r.name as source_role_name
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = p_user_id 
            AND ur.is_active = true
            AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        
        UNION ALL
        
        -- Add inherited roles through hierarchy
        SELECT 
            rh.parent_role_id as role_id,
            pr.name as role_name,
            rhe.inheritance_level + 1,
            rhe.source_role_name
        FROM role_hierarchy_expanded rhe
        JOIN role_hierarchy rh ON rhe.role_id = rh.child_role_id
        JOIN roles pr ON rh.parent_role_id = pr.id
        WHERE rh.is_active = true
            AND rhe.inheritance_level < 5 -- Prevent infinite recursion
    ),
    user_permissions AS (
        SELECT DISTINCT
            pr.name as resource_name,
            pa.name as action_name,
            ep.name as permission_name,
            erp.grant_type,
            erp.scope_type,
            erp.scope_constraints,
            (rhe.inheritance_level > 0) as is_inherited,
            rhe.source_role_name as source_role
        FROM role_hierarchy_expanded rhe
        JOIN enhanced_role_permissions erp ON rhe.role_id = erp.role_id
        JOIN enhanced_permissions ep ON erp.permission_id = ep.id
        JOIN permission_resources pr ON ep.resource_id = pr.id
        JOIN permission_actions pa ON ep.action_id = pa.id
        WHERE erp.is_active = true
            AND ep.is_active = true
            AND pr.is_active = true
            AND pa.is_active = true
            AND (erp.expires_at IS NULL OR erp.expires_at > NOW())
            -- Apply context filters if provided
            AND (
                p_context = '{}'::jsonb 
                OR erp.scope_constraints @> p_context 
                OR erp.scope_type = 'global'
            )
    ),
    business_context_permissions AS (
        SELECT DISTINCT
            'businesses' as resource_name,
            bp_actions.action_name,
            'businesses:' || bp_actions.action_name as permission_name,
            'allow' as grant_type,
            'business' as scope_type,
            jsonb_build_object('business_id', bp.business_id) as scope_constraints,
            false as is_inherited,
            bp.business_role as source_role
        FROM business_permissions bp
        CROSS JOIN (
            SELECT unnest(ARRAY['read', 'update', 'manage']) as action_name
            WHERE bp.permission_level IN ('admin', 'full')
            UNION ALL
            SELECT unnest(ARRAY['read']) as action_name
            WHERE bp.permission_level IN ('basic', 'advanced', 'admin', 'full')
        ) bp_actions
        WHERE bp.user_id = p_user_id
            AND bp.is_active = true
            AND bp.employment_status = 'active'
            AND (bp.effective_until IS NULL OR bp.effective_until > NOW())
    )
    SELECT * FROM user_permissions
    UNION ALL
    SELECT * FROM business_context_permissions
    ORDER BY resource_name, action_name;
    
    -- Calculate computation time
    computation_time := EXTRACT(milliseconds FROM (NOW() - start_time))::INTEGER;
    
    -- Cache the results
    INSERT INTO permission_cache (
        user_id, cache_key, context_hash, 
        permissions, computation_time_ms
    ) VALUES (
        p_user_id, 
        cache_key, 
        context_hash,
        (SELECT jsonb_agg(
            jsonb_build_object(
                'resource_name', resource_name,
                'action_name', action_name,
                'permission_name', permission_name,
                'grant_type', grant_type,
                'scope_type', scope_type,
                'scope_constraints', scope_constraints,
                'is_inherited', is_inherited,
                'source_role', source_role
            )
        ) FROM (
            SELECT * FROM user_permissions
            UNION ALL
            SELECT * FROM business_context_permissions
        ) all_perms),
        computation_time
    )
    ON CONFLICT (user_id, cache_key) DO UPDATE SET
        context_hash = EXCLUDED.context_hash,
        permissions = EXCLUDED.permissions,
        computed_at = NOW(),
        expires_at = NOW() + INTERVAL '1 hour',
        computation_time_ms = EXCLUDED.computation_time_ms,
        cache_version = permission_cache.cache_version + 1;
        
END;
$$;

-- Fast permission check function (< 10ms target)
CREATE OR REPLACE FUNCTION public.user_has_enhanced_permission(
    p_user_id UUID,
    p_resource VARCHAR(100),
    p_action VARCHAR(50),
    p_context JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    has_permission BOOLEAN := FALSE;
    cache_key VARCHAR(500);
    context_hash VARCHAR(64);
    cached_result JSONB;
BEGIN
    -- Generate cache key for this specific permission check
    cache_key := 'permission:' || p_user_id::text || ':' || p_resource || ':' || p_action;
    context_hash := encode(sha256(p_context::text::bytea), 'hex');
    
    -- Check cache first for this specific permission
    SELECT permissions->(p_resource||':'||p_action) INTO cached_result
    FROM permission_cache
    WHERE user_id = p_user_id 
        AND cache_key LIKE 'permissions:' || p_user_id::text || '%'
        AND context_hash = context_hash
        AND expires_at > NOW()
    LIMIT 1;
    
    IF cached_result IS NOT NULL THEN
        RETURN (cached_result->>'allowed')::BOOLEAN;
    END IF;
    
    -- Direct permission check without full evaluation
    SELECT EXISTS(
        WITH user_roles_active AS (
            SELECT ur.role_id
            FROM user_roles ur
            WHERE ur.user_id = p_user_id 
                AND ur.is_active = true
                AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        ),
        inherited_roles AS (
            SELECT DISTINCT rh.parent_role_id as role_id
            FROM user_roles_active ura
            JOIN role_hierarchy rh ON ura.role_id = rh.child_role_id
            WHERE rh.is_active = true
            
            UNION
            
            SELECT role_id FROM user_roles_active
        )
        SELECT 1
        FROM inherited_roles ir
        JOIN enhanced_role_permissions erp ON ir.role_id = erp.role_id
        JOIN enhanced_permissions ep ON erp.permission_id = ep.id
        JOIN permission_resources pr ON ep.resource_id = pr.id
        JOIN permission_actions pa ON ep.action_id = pa.id
        WHERE pr.name = p_resource
            AND pa.name = p_action
            AND erp.grant_type = 'allow'
            AND erp.is_active = true
            AND ep.is_active = true
            AND (erp.expires_at IS NULL OR erp.expires_at > NOW())
            AND (
                p_context = '{}'::jsonb 
                OR erp.scope_constraints @> p_context 
                OR erp.scope_type = 'global'
            )
        
        UNION
        
        -- Check business context permissions
        SELECT 1
        FROM business_permissions bp
        WHERE bp.user_id = p_user_id
            AND bp.is_active = true
            AND bp.employment_status = 'active'
            AND (bp.effective_until IS NULL OR bp.effective_until > NOW())
            AND p_resource = 'businesses'
            AND (
                (p_action = 'read' AND bp.permission_level IN ('basic', 'advanced', 'admin', 'full')) OR
                (p_action IN ('update', 'manage') AND bp.permission_level IN ('admin', 'full'))
            )
            AND (
                p_context = '{}'::jsonb OR
                (p_context->>'business_id')::UUID = bp.business_id
            )
    ) INTO has_permission;
    
    RETURN has_permission;
END;
$$;

-- Bulk permission evaluation for API endpoints
CREATE OR REPLACE FUNCTION public.evaluate_bulk_permissions(
    p_user_id UUID,
    p_permissions TEXT[], -- Array of 'resource:action' strings
    p_context JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(
    permission TEXT,
    allowed BOOLEAN,
    reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    perm TEXT;
    resource_name VARCHAR(100);
    action_name VARCHAR(50);
    is_allowed BOOLEAN;
BEGIN
    FOREACH perm IN ARRAY p_permissions
    LOOP
        -- Parse permission string
        resource_name := split_part(perm, ':', 1);
        action_name := split_part(perm, ':', 2);
        
        -- Check permission
        SELECT user_has_enhanced_permission(p_user_id, resource_name, action_name, p_context)
        INTO is_allowed;
        
        RETURN QUERY SELECT 
            perm, 
            is_allowed,
            CASE 
                WHEN is_allowed THEN 'Granted'
                ELSE 'Access denied'
            END;
    END LOOP;
END;
$$;

-- Administrative function to assign enhanced roles with approval workflow
CREATE OR REPLACE FUNCTION public.assign_enhanced_role(
    p_target_user_id UUID,
    p_role_name VARCHAR(50),
    p_scope_type VARCHAR(50) DEFAULT 'global',
    p_scope_constraints JSONB DEFAULT '{}'::jsonb,
    p_justification TEXT DEFAULT NULL,
    p_expires_in INTERVAL DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    role_record RECORD;
    assignment_id UUID;
    requires_approval BOOLEAN := FALSE;
    approval_id UUID;
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    
    -- Check if current user can assign roles
    IF NOT user_has_enhanced_permission(current_user_id, 'users', 'manage') THEN
        RAISE EXCEPTION 'Insufficient permissions to assign roles';
    END IF;
    
    -- Get role information
    SELECT * INTO role_record
    FROM roles
    WHERE name = p_role_name AND is_assignable = true;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Role % not found or not assignable', p_role_name;
    END IF;
    
    -- Check if assignment requires approval
    requires_approval := (
        role_record.name IN ('admin', 'super_admin') OR
        role_record.requires_mfa = true
    );
    
    IF requires_approval THEN
        -- Create approval request
        INSERT INTO permission_approvals (
            request_type, requested_for_user_id, requested_by_user_id,
            request_data, justification
        ) VALUES (
            'role_assignment', p_target_user_id, current_user_id,
            jsonb_build_object(
                'role_name', p_role_name,
                'scope_type', p_scope_type,
                'scope_constraints', p_scope_constraints,
                'expires_in', extract(epoch from p_expires_in)
            ),
            COALESCE(p_justification, 'Role assignment request')
        ) RETURNING id INTO approval_id;
        
        -- Log the approval request
        INSERT INTO auth_audit_logs (
            event_type, event_category, user_id, target_user_id,
            event_data, success
        ) VALUES (
            'role_assignment_requested', 'permission', current_user_id, p_target_user_id,
            jsonb_build_object(
                'role', p_role_name, 
                'approval_id', approval_id,
                'scope_type', p_scope_type
            ),
            true
        );
        
        RETURN approval_id;
    ELSE
        -- Direct assignment
        INSERT INTO user_roles (
            user_id, role_id, granted_by, scope_type, scope_id, expires_at
        ) VALUES (
            p_target_user_id,
            role_record.id,
            current_user_id,
            p_scope_type,
            (p_scope_constraints->>'id')::UUID,
            CASE WHEN p_expires_in IS NOT NULL THEN NOW() + p_expires_in ELSE NULL END
        ) RETURNING id INTO assignment_id;
        
        -- Invalidate user's permission cache
        DELETE FROM permission_cache WHERE user_id = p_target_user_id;
        
        -- Log the assignment
        INSERT INTO auth_audit_logs (
            event_type, event_category, user_id, target_user_id,
            event_data, success
        ) VALUES (
            'role_assigned', 'permission', current_user_id, p_target_user_id,
            jsonb_build_object(
                'role', p_role_name,
                'assignment_id', assignment_id,
                'scope_type', p_scope_type
            ),
            true
        );
        
        RETURN assignment_id;
    END IF;
END;
$$;

-- Business context permission management
CREATE OR REPLACE FUNCTION public.assign_business_permission(
    p_user_id UUID,
    p_business_id UUID,
    p_business_role VARCHAR(50),
    p_relationship_type VARCHAR(30),
    p_permission_level VARCHAR(20) DEFAULT 'basic',
    p_assigned_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    permission_id UUID;
    assigner_user_id UUID;
    can_assign BOOLEAN := FALSE;
BEGIN
    assigner_user_id := COALESCE(p_assigned_by, auth.uid());
    
    IF assigner_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    
    -- Check if assigner can assign business permissions
    SELECT (
        -- Is business owner
        EXISTS(
            SELECT 1 FROM businesses 
            WHERE id = p_business_id AND owner_id = assigner_user_id
        ) OR
        -- Has business management permissions
        user_has_enhanced_permission(
            assigner_user_id, 
            'businesses', 
            'manage',
            jsonb_build_object('business_id', p_business_id)
        ) OR
        -- Has admin role
        user_has_enhanced_permission(assigner_user_id, 'users', 'manage')
    ) INTO can_assign;
    
    IF NOT can_assign THEN
        RAISE EXCEPTION 'Insufficient permissions to assign business permissions';
    END IF;
    
    -- Insert or update business permission
    INSERT INTO business_permissions (
        user_id, business_id, business_role, relationship_type,
        permission_level, assigned_by
    ) VALUES (
        p_user_id, p_business_id, p_business_role, p_relationship_type,
        p_permission_level, assigner_user_id
    )
    ON CONFLICT (user_id, business_id, business_role, relationship_type)
    DO UPDATE SET
        permission_level = EXCLUDED.permission_level,
        assigned_by = EXCLUDED.assigned_by,
        assigned_at = NOW(),
        is_active = true,
        updated_at = NOW()
    RETURNING id INTO permission_id;
    
    -- Invalidate user's permission cache
    DELETE FROM permission_cache WHERE user_id = p_user_id;
    
    -- Log the assignment
    INSERT INTO auth_audit_logs (
        event_type, event_category, user_id, target_user_id,
        event_data, success
    ) VALUES (
        'business_permission_assigned', 'permission', assigner_user_id, p_user_id,
        jsonb_build_object(
            'business_id', p_business_id,
            'business_role', p_business_role,
            'relationship_type', p_relationship_type,
            'permission_level', p_permission_level
        ),
        true
    );
    
    RETURN permission_id;
END;
$$;

-- Cache invalidation function
CREATE OR REPLACE FUNCTION public.invalidate_permission_cache(
    p_user_id UUID DEFAULT NULL,
    p_cache_pattern VARCHAR(500) DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    IF p_user_id IS NOT NULL THEN
        DELETE FROM permission_cache WHERE user_id = p_user_id;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
    ELSIF p_cache_pattern IS NOT NULL THEN
        DELETE FROM permission_cache WHERE cache_key LIKE p_cache_pattern;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
    ELSE
        DELETE FROM permission_cache WHERE expires_at <= NOW();
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
    END IF;
    
    RETURN deleted_count;
END;
$$;

-- Performance monitoring function
CREATE OR REPLACE FUNCTION public.get_rbac_performance_metrics()
RETURNS TABLE(
    metric_name TEXT,
    metric_value NUMERIC,
    metric_unit TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 'cache_hit_ratio'::TEXT, 
           ROUND(
               (SELECT AVG(cache_hit_count) FROM permission_cache WHERE cache_hit_count > 0) /
               NULLIF((SELECT COUNT(*) FROM permission_cache WHERE computed_at >= NOW() - INTERVAL '1 hour'), 0) * 100,
               2
           ), 
           'percentage'::TEXT
    UNION ALL
    SELECT 'avg_computation_time'::TEXT,
           (SELECT AVG(computation_time_ms) FROM permission_cache WHERE computed_at >= NOW() - INTERVAL '1 hour'),
           'milliseconds'::TEXT
    UNION ALL
    SELECT 'cache_size'::TEXT,
           (SELECT COUNT(*) FROM permission_cache WHERE expires_at > NOW()),
           'entries'::TEXT
    UNION ALL
    SELECT 'active_sessions'::TEXT,
           (SELECT COUNT(DISTINCT user_id) FROM permission_cache WHERE computed_at >= NOW() - INTERVAL '1 hour'),
           'users'::TEXT;
END;
$$;

-- =====================================================
-- GRANT PERMISSIONS FOR ENHANCED RBAC FUNCTIONS
-- =====================================================

-- Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.evaluate_user_permissions TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_enhanced_permission TO authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_bulk_permissions TO authenticated;

-- Grant permissions to service role for admin functions
GRANT EXECUTE ON FUNCTION public.assign_enhanced_role TO service_role;
GRANT EXECUTE ON FUNCTION public.assign_business_permission TO service_role;
GRANT EXECUTE ON FUNCTION public.invalidate_permission_cache TO service_role;
GRANT EXECUTE ON FUNCTION public.get_rbac_performance_metrics TO service_role;

-- Grant to specific admin roles
GRANT EXECUTE ON FUNCTION public.assign_enhanced_role TO authenticated; -- Will be filtered by permission checks
GRANT EXECUTE ON FUNCTION public.assign_business_permission TO authenticated; -- Will be filtered by permission checks

