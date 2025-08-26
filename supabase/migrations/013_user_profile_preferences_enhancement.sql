-- Migration: 013_user_profile_preferences_enhancement
-- Epic 2 Story 2.7: User Profile Management & Preferences Infrastructure
-- Description: Comprehensive user profile enhancement with preferences, file management, and GDPR compliance
-- Date: 2025-01-25
-- Author: Backend Developer Agent

BEGIN;

-- =====================================================
-- USER PROFILE ENHANCEMENTS
-- =====================================================

-- Add new columns to existing profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS 
    -- Profile completion and gamification
    profile_completion_score INTEGER DEFAULT 0 CHECK (profile_completion_score >= 0 AND profile_completion_score <= 100),
    profile_completion_level VARCHAR(20) DEFAULT 'basic' CHECK (profile_completion_level IN ('basic', 'intermediate', 'advanced', 'complete')),
    profile_completion_rewards JSONB DEFAULT '[]'::jsonb,
    profile_badges JSONB DEFAULT '[]'::jsonb,
    
    -- Enhanced personal information
    middle_name VARCHAR(100),
    preferred_name VARCHAR(100),
    title VARCHAR(50),
    company VARCHAR(200),
    job_title VARCHAR(200),
    
    -- Extended location data
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    postal_code VARCHAR(20),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    
    -- Profile visibility and privacy
    profile_visibility VARCHAR(20) DEFAULT 'public' CHECK (profile_visibility IN ('public', 'private', 'friends', 'business')),
    profile_searchable BOOLEAN DEFAULT TRUE,
    profile_indexable BOOLEAN DEFAULT TRUE,
    show_contact_info BOOLEAN DEFAULT FALSE,
    show_social_links BOOLEAN DEFAULT TRUE,
    show_location BOOLEAN DEFAULT TRUE,
    show_activity BOOLEAN DEFAULT TRUE,
    
    -- Profile verification
    profile_verified BOOLEAN DEFAULT FALSE,
    profile_verification_date TIMESTAMPTZ,
    profile_verification_level VARCHAR(20) DEFAULT 'none' CHECK (profile_verification_level IN ('none', 'email', 'phone', 'document', 'business')),
    
    -- Account preferences with GDPR compliance
    data_processing_purposes TEXT[],
    legitimate_interests JSONB DEFAULT '{}'::jsonb,
    consent_categories JSONB DEFAULT '{}'::jsonb,
    data_retention_preferences JSONB DEFAULT '{}'::jsonb,
    
    -- Activity and usage tracking
    last_profile_update TIMESTAMPTZ,
    profile_views_count INTEGER DEFAULT 0,
    profile_views_last_month INTEGER DEFAULT 0,
    activity_status VARCHAR(20) DEFAULT 'active' CHECK (activity_status IN ('active', 'inactive', 'away', 'busy', 'hidden')),
    
    -- Business owner specific fields
    is_business_owner BOOLEAN DEFAULT FALSE,
    business_owner_verified BOOLEAN DEFAULT FALSE,
    business_verification_documents JSONB DEFAULT '[]'::jsonb,
    business_categories TEXT[],
    
    -- Custom fields support
    custom_fields JSONB DEFAULT '{}'::jsonb,
    profile_tags TEXT[],
    
    -- Profile sync tracking
    last_social_sync TIMESTAMPTZ,
    social_sync_enabled BOOLEAN DEFAULT TRUE,
    sync_conflicts_count INTEGER DEFAULT 0,
    
    -- Security and privacy flags
    profile_locked BOOLEAN DEFAULT FALSE,
    profile_lock_reason TEXT,
    profile_lock_date TIMESTAMPTZ,
    two_factor_required BOOLEAN DEFAULT FALSE;

-- =====================================================
-- HIERARCHICAL PREFERENCES SYSTEM
-- =====================================================

-- User preferences with hierarchical inheritance
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Preference hierarchy
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    preference_key VARCHAR(150) NOT NULL,
    preference_value JSONB NOT NULL,
    
    -- Inheritance and overrides
    inherits_from UUID REFERENCES public.user_preferences(id),
    is_inherited BOOLEAN DEFAULT FALSE,
    is_system_default BOOLEAN DEFAULT FALSE,
    can_be_inherited BOOLEAN DEFAULT TRUE,
    
    -- Preference metadata
    preference_type VARCHAR(50) DEFAULT 'user' CHECK (preference_type IN ('user', 'system', 'business', 'inherited')),
    data_type VARCHAR(20) DEFAULT 'json' CHECK (data_type IN ('string', 'number', 'boolean', 'json', 'array')),
    is_sensitive BOOLEAN DEFAULT FALSE,
    is_encrypted BOOLEAN DEFAULT FALSE,
    
    -- Validation
    validation_schema JSONB,
    default_value JSONB,
    allowed_values JSONB,
    
    -- Privacy and consent
    requires_consent BOOLEAN DEFAULT FALSE,
    consent_given BOOLEAN DEFAULT FALSE,
    consent_date TIMESTAMPTZ,
    gdpr_category VARCHAR(50),
    retention_period INTERVAL,
    
    -- Versioning and audit
    version INTEGER DEFAULT 1,
    previous_value JSONB,
    changed_by UUID REFERENCES auth.users(id),
    change_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT unique_user_preference UNIQUE(user_id, category, subcategory, preference_key),
    CONSTRAINT valid_inheritance CHECK (
        (inherits_from IS NULL AND is_inherited = FALSE) OR 
        (inherits_from IS NOT NULL AND is_inherited = TRUE)
    )
);

-- Default preference templates
CREATE TABLE IF NOT EXISTS public.preference_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Template identification
    template_name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    
    -- Template definition
    preference_key VARCHAR(150) NOT NULL,
    default_value JSONB NOT NULL,
    data_type VARCHAR(20) DEFAULT 'json',
    validation_schema JSONB,
    allowed_values JSONB,
    
    -- Template properties
    is_required BOOLEAN DEFAULT FALSE,
    is_user_configurable BOOLEAN DEFAULT TRUE,
    requires_consent BOOLEAN DEFAULT FALSE,
    is_sensitive BOOLEAN DEFAULT FALSE,
    gdpr_category VARCHAR(50),
    retention_period INTERVAL,
    
    -- Business logic
    applies_to_roles TEXT[],
    applies_to_user_types TEXT[],
    conditional_logic JSONB,
    
    -- UI configuration
    ui_component VARCHAR(50),
    ui_props JSONB DEFAULT '{}'::jsonb,
    display_order INTEGER DEFAULT 0,
    is_visible BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    is_system_template BOOLEAN DEFAULT FALSE,
    
    CONSTRAINT unique_template_key UNIQUE(category, subcategory, preference_key)
);

-- =====================================================
-- FILE UPLOAD AND AVATAR MANAGEMENT
-- =====================================================

-- Enhanced file management for avatars and documents
CREATE TABLE IF NOT EXISTS public.user_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- File identification
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_category VARCHAR(50) NOT NULL CHECK (file_category IN ('avatar', 'document', 'verification', 'business', 'other')),
    
    -- File storage
    storage_path VARCHAR(500) NOT NULL,
    storage_bucket VARCHAR(100) NOT NULL DEFAULT 'user-uploads',
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    
    -- File metadata
    file_hash SHA256 NOT NULL, -- For duplicate detection
    dimensions JSONB, -- For images: {width, height}
    duration INTEGER, -- For audio/video files in seconds
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Security and validation
    is_validated BOOLEAN DEFAULT FALSE,
    is_quarantined BOOLEAN DEFAULT FALSE,
    validation_status VARCHAR(20) DEFAULT 'pending' CHECK (validation_status IN ('pending', 'passed', 'failed', 'quarantined')),
    validation_details JSONB DEFAULT '{}'::jsonb,
    virus_scan_result VARCHAR(20) DEFAULT 'pending' CHECK (virus_scan_result IN ('pending', 'clean', 'infected', 'suspicious')),
    virus_scan_date TIMESTAMPTZ,
    
    -- Processing status
    is_processed BOOLEAN DEFAULT FALSE,
    processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    processing_details JSONB DEFAULT '{}'::jsonb,
    
    -- File variants (thumbnails, compressed versions, etc.)
    variants JSONB DEFAULT '{}'::jsonb,
    thumbnail_path VARCHAR(500),
    compressed_path VARCHAR(500),
    
    -- Usage tracking
    download_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMPTZ,
    is_public BOOLEAN DEFAULT FALSE,
    public_url VARCHAR(500),
    
    -- Privacy and compliance
    is_sensitive BOOLEAN DEFAULT FALSE,
    requires_consent BOOLEAN DEFAULT FALSE,
    consent_given BOOLEAN DEFAULT FALSE,
    gdpr_category VARCHAR(50),
    retention_policy VARCHAR(50) DEFAULT 'standard',
    scheduled_deletion TIMESTAMPTZ,
    
    -- Audit trail
    uploaded_by UUID REFERENCES auth.users(id),
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    last_modified TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES auth.users(id),
    deletion_reason TEXT,
    
    -- Constraints
    CONSTRAINT unique_file_hash UNIQUE(file_hash, user_id),
    CONSTRAINT valid_file_size CHECK (file_size <= 52428800) -- 50MB max
);

-- File access logs for audit
CREATE TABLE IF NOT EXISTS public.file_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES public.user_files(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    
    -- Access details
    access_type VARCHAR(50) NOT NULL CHECK (access_type IN ('view', 'download', 'upload', 'delete', 'modify')),
    access_method VARCHAR(50) DEFAULT 'web',
    ip_address INET,
    user_agent TEXT,
    referer TEXT,
    
    -- Result
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    
    -- Timing
    accessed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Context
    request_id UUID,
    session_id UUID
);

-- =====================================================
-- PROFILE SYNCHRONIZATION ENHANCEMENTS
-- =====================================================

-- Enhanced profile sync history
CREATE TABLE IF NOT EXISTS public.profile_sync_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Sync details
    provider VARCHAR(50) NOT NULL,
    sync_type VARCHAR(20) DEFAULT 'auto' CHECK (sync_type IN ('auto', 'manual', 'scheduled')),
    trigger_event VARCHAR(50),
    
    -- Sync data
    synced_fields TEXT[],
    sync_data JSONB DEFAULT '{}'::jsonb,
    
    -- Conflicts and resolution
    conflicts_detected INTEGER DEFAULT 0,
    conflicts_resolved INTEGER DEFAULT 0,
    conflicts_data JSONB DEFAULT '[]'::jsonb,
    
    -- Results
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    warnings TEXT[],
    
    -- Performance metrics
    processing_time_ms INTEGER,
    data_size_bytes INTEGER,
    
    -- Timestamps
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profile conflict resolutions
CREATE TABLE IF NOT EXISTS public.profile_conflict_resolutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Conflict details
    field_name VARCHAR(100) NOT NULL,
    conflict_type VARCHAR(50) NOT NULL,
    provider VARCHAR(50),
    
    -- Values
    current_value JSONB,
    provider_value JSONB,
    resolved_value JSONB,
    
    -- Resolution
    resolution_type VARCHAR(50) NOT NULL CHECK (resolution_type IN ('keep_current', 'use_provider', 'manual', 'merge', 'skip')),
    resolution_method VARCHAR(20) DEFAULT 'auto' CHECK (resolution_method IN ('auto', 'manual', 'rule')),
    resolved_by UUID REFERENCES auth.users(id),
    resolution_rule VARCHAR(100),
    
    -- Timestamps
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- GDPR COMPLIANCE SYSTEM
-- =====================================================

-- Data processing activities log
CREATE TABLE IF NOT EXISTS public.data_processing_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Activity details
    activity_type VARCHAR(100) NOT NULL,
    activity_category VARCHAR(50) NOT NULL,
    processing_purpose VARCHAR(200) NOT NULL,
    legal_basis VARCHAR(100) NOT NULL,
    
    -- Data involved
    data_categories TEXT[],
    data_sources TEXT[],
    data_recipients TEXT[],
    
    -- Processing details
    processing_location VARCHAR(100),
    retention_period INTERVAL,
    automated_decision_making BOOLEAN DEFAULT FALSE,
    profiling_involved BOOLEAN DEFAULT FALSE,
    
    -- Consent and authorization
    requires_consent BOOLEAN DEFAULT FALSE,
    consent_given BOOLEAN DEFAULT FALSE,
    consent_date TIMESTAMPTZ,
    consent_withdrawn_date TIMESTAMPTZ,
    
    -- Audit trail
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'suspended', 'terminated')),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- GDPR data export requests
CREATE TABLE IF NOT EXISTS public.gdpr_data_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Request details
    request_type VARCHAR(50) DEFAULT 'full' CHECK (request_type IN ('full', 'partial', 'profile', 'activity', 'files')),
    requested_categories TEXT[],
    
    -- Export details
    format VARCHAR(20) DEFAULT 'json' CHECK (format IN ('json', 'csv', 'xml', 'pdf')),
    include_metadata BOOLEAN DEFAULT TRUE,
    include_system_data BOOLEAN DEFAULT FALSE,
    
    -- Processing
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    processing_time_seconds INTEGER,
    
    -- Export file
    export_file_id UUID REFERENCES public.user_files(id),
    export_size_bytes BIGINT,
    download_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
    
    -- Security
    download_token VARCHAR(255),
    access_ip_restrictions INET[],
    
    -- Audit
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    requested_by UUID REFERENCES auth.users(id),
    error_message TEXT,
    
    CONSTRAINT valid_expiry CHECK (expires_at > requested_at)
);

-- GDPR data deletion requests (Right to be forgotten)
CREATE TABLE IF NOT EXISTS public.gdpr_data_deletions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Request details
    deletion_type VARCHAR(20) DEFAULT 'account' CHECK (deletion_type IN ('account', 'profile', 'activity', 'files', 'specific')),
    deletion_scope TEXT[],
    keep_anonymized BOOLEAN DEFAULT FALSE,
    
    -- Legal basis for deletion
    legal_basis VARCHAR(100) NOT NULL,
    justification TEXT,
    
    -- Processing details
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'rejected')),
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    
    -- Deletion results
    items_deleted INTEGER DEFAULT 0,
    items_anonymized INTEGER DEFAULT 0,
    items_retained INTEGER DEFAULT 0,
    retention_reasons JSONB DEFAULT '[]'::jsonb,
    
    -- Verification
    verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMPTZ,
    verification_method VARCHAR(50),
    
    -- Audit trail
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    requested_by UUID REFERENCES auth.users(id),
    processed_by UUID REFERENCES auth.users(id),
    deletion_summary JSONB DEFAULT '{}'::jsonb,
    
    -- Appeals and reversals (if within legal window)
    can_be_reversed BOOLEAN DEFAULT FALSE,
    reversal_deadline TIMESTAMPTZ,
    reversed_at TIMESTAMPTZ,
    reversal_reason TEXT
);

-- Audit log for GDPR compliance activities
CREATE TABLE IF NOT EXISTS public.gdpr_compliance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Activity details
    activity_type VARCHAR(100) NOT NULL,
    activity_description TEXT NOT NULL,
    compliance_requirement VARCHAR(100),
    
    -- Data involved
    data_categories TEXT[],
    data_volume INTEGER,
    personal_data_involved BOOLEAN DEFAULT TRUE,
    sensitive_data_involved BOOLEAN DEFAULT FALSE,
    
    -- Processing details
    automated BOOLEAN DEFAULT FALSE,
    processing_time_ms INTEGER,
    
    -- Results and impact
    success BOOLEAN DEFAULT TRUE,
    impact_assessment JSONB DEFAULT '{}'::jsonb,
    privacy_impact_score INTEGER CHECK (privacy_impact_score >= 0 AND privacy_impact_score <= 10),
    
    -- Documentation
    documentation_links TEXT[],
    evidence_file_ids UUID[],
    
    -- Audit information
    performed_by UUID REFERENCES auth.users(id),
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Compliance verification
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    compliance_status VARCHAR(20) DEFAULT 'compliant' CHECK (compliance_status IN ('compliant', 'non-compliant', 'pending-review', 'requires-action'))
);

-- =====================================================
-- PERFORMANCE OPTIMIZATIONS
-- =====================================================

-- Materialized view for profile completion scoring
CREATE MATERIALIZED VIEW public.profile_completion_scores AS
SELECT 
    p.id as user_id,
    p.display_name,
    -- Calculate completion score based on filled fields
    (
        CASE WHEN p.first_name IS NOT NULL THEN 5 ELSE 0 END +
        CASE WHEN p.last_name IS NOT NULL THEN 5 ELSE 0 END +
        CASE WHEN p.avatar_url IS NOT NULL AND p.avatar_url != '' THEN 10 ELSE 0 END +
        CASE WHEN p.bio IS NOT NULL AND LENGTH(p.bio) > 10 THEN 10 ELSE 0 END +
        CASE WHEN p.phone_number IS NOT NULL THEN 8 ELSE 0 END +
        CASE WHEN p.phone_verified = true THEN 7 ELSE 0 END +
        CASE WHEN p.email_verified = true THEN 10 ELSE 0 END +
        CASE WHEN p.city IS NOT NULL THEN 5 ELSE 0 END +
        CASE WHEN p.state IS NOT NULL THEN 5 ELSE 0 END +
        CASE WHEN p.country IS NOT NULL THEN 5 ELSE 0 END +
        CASE WHEN p.website IS NOT NULL THEN 5 ELSE 0 END +
        CASE WHEN p.social_links::text != '{"twitter": null, "linkedin": null, "facebook": null, "instagram": null, "github": null}' THEN 10 ELSE 0 END +
        CASE WHEN p.preferences IS NOT NULL THEN 5 ELSE 0 END +
        CASE WHEN p.marketing_consent = true THEN 3 ELSE 0 END +
        CASE WHEN p.data_processing_consent = true THEN 7 ELSE 0 END +
        CASE WHEN p.is_business_owner = true AND p.business_owner_verified = true THEN 10 ELSE 0 END
    ) as completion_score,
    -- Determine completion level
    CASE 
        WHEN (
            CASE WHEN p.first_name IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN p.last_name IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN p.avatar_url IS NOT NULL AND p.avatar_url != '' THEN 10 ELSE 0 END +
            CASE WHEN p.bio IS NOT NULL AND LENGTH(p.bio) > 10 THEN 10 ELSE 0 END +
            CASE WHEN p.phone_number IS NOT NULL THEN 8 ELSE 0 END +
            CASE WHEN p.phone_verified = true THEN 7 ELSE 0 END +
            CASE WHEN p.email_verified = true THEN 10 ELSE 0 END +
            CASE WHEN p.city IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN p.state IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN p.country IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN p.website IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN p.social_links::text != '{"twitter": null, "linkedin": null, "facebook": null, "instagram": null, "github": null}' THEN 10 ELSE 0 END +
            CASE WHEN p.preferences IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN p.marketing_consent = true THEN 3 ELSE 0 END +
            CASE WHEN p.data_processing_consent = true THEN 7 ELSE 0 END +
            CASE WHEN p.is_business_owner = true AND p.business_owner_verified = true THEN 10 ELSE 0 END
        ) >= 90 THEN 'complete'
        WHEN (
            CASE WHEN p.first_name IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN p.last_name IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN p.avatar_url IS NOT NULL AND p.avatar_url != '' THEN 10 ELSE 0 END +
            CASE WHEN p.bio IS NOT NULL AND LENGTH(p.bio) > 10 THEN 10 ELSE 0 END +
            CASE WHEN p.phone_number IS NOT NULL THEN 8 ELSE 0 END +
            CASE WHEN p.phone_verified = true THEN 7 ELSE 0 END +
            CASE WHEN p.email_verified = true THEN 10 ELSE 0 END +
            CASE WHEN p.city IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN p.state IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN p.country IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN p.website IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN p.social_links::text != '{"twitter": null, "linkedin": null, "facebook": null, "instagram": null, "github": null}' THEN 10 ELSE 0 END +
            CASE WHEN p.preferences IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN p.marketing_consent = true THEN 3 ELSE 0 END +
            CASE WHEN p.data_processing_consent = true THEN 7 ELSE 0 END +
            CASE WHEN p.is_business_owner = true AND p.business_owner_verified = true THEN 10 ELSE 0 END
        ) >= 65 THEN 'advanced'
        WHEN (
            CASE WHEN p.first_name IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN p.last_name IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN p.avatar_url IS NOT NULL AND p.avatar_url != '' THEN 10 ELSE 0 END +
            CASE WHEN p.bio IS NOT NULL AND LENGTH(p.bio) > 10 THEN 10 ELSE 0 END +
            CASE WHEN p.phone_number IS NOT NULL THEN 8 ELSE 0 END +
            CASE WHEN p.phone_verified = true THEN 7 ELSE 0 END +
            CASE WHEN p.email_verified = true THEN 10 ELSE 0 END +
            CASE WHEN p.city IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN p.state IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN p.country IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN p.website IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN p.social_links::text != '{"twitter": null, "linkedin": null, "facebook": null, "instagram": null, "github": null}' THEN 10 ELSE 0 END +
            CASE WHEN p.preferences IS NOT NULL THEN 5 ELSE 0 END +
            CASE WHEN p.marketing_consent = true THEN 3 ELSE 0 END +
            CASE WHEN p.data_processing_consent = true THEN 7 ELSE 0 END +
            CASE WHEN p.is_business_owner = true AND p.business_owner_verified = true THEN 10 ELSE 0 END
        ) >= 35 THEN 'intermediate'
        ELSE 'basic'
    END as completion_level,
    p.updated_at
FROM public.profiles p
WHERE p.deleted_at IS NULL;

-- Index for materialized view
CREATE UNIQUE INDEX idx_profile_completion_scores_user_id ON public.profile_completion_scores(user_id);
CREATE INDEX idx_profile_completion_scores_level ON public.profile_completion_scores(completion_level);
CREATE INDEX idx_profile_completion_scores_score ON public.profile_completion_scores(completion_score DESC);

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

-- Profile enhancement indexes
CREATE INDEX IF NOT EXISTS idx_profiles_completion_score ON public.profiles(profile_completion_score DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_visibility ON public.profiles(profile_visibility) WHERE profile_visibility != 'private';
CREATE INDEX IF NOT EXISTS idx_profiles_business_owner ON public.profiles(is_business_owner) WHERE is_business_owner = true;
CREATE INDEX IF NOT EXISTS idx_profiles_verification ON public.profiles(profile_verified, profile_verification_level) WHERE profile_verified = true;
CREATE INDEX IF NOT EXISTS idx_profiles_activity_status ON public.profiles(activity_status) WHERE activity_status = 'active';
CREATE INDEX IF NOT EXISTS idx_profiles_social_sync ON public.profiles(last_social_sync) WHERE social_sync_enabled = true;

-- User preferences indexes
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_category ON public.user_preferences(user_id, category);
CREATE INDEX IF NOT EXISTS idx_user_preferences_key ON public.user_preferences(category, preference_key);
CREATE INDEX IF NOT EXISTS idx_user_preferences_inheritance ON public.user_preferences(inherits_from) WHERE inherits_from IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_preferences_sensitive ON public.user_preferences(is_sensitive) WHERE is_sensitive = true;
CREATE INDEX IF NOT EXISTS idx_user_preferences_consent ON public.user_preferences(requires_consent, consent_given) WHERE requires_consent = true;
CREATE INDEX IF NOT EXISTS idx_user_preferences_expiry ON public.user_preferences(expires_at) WHERE expires_at IS NOT NULL;

-- File management indexes
CREATE INDEX IF NOT EXISTS idx_user_files_user_category ON public.user_files(user_id, file_category);
CREATE INDEX IF NOT EXISTS idx_user_files_hash ON public.user_files(file_hash);
CREATE INDEX IF NOT EXISTS idx_user_files_validation ON public.user_files(validation_status, virus_scan_result);
CREATE INDEX IF NOT EXISTS idx_user_files_processing ON public.user_files(processing_status) WHERE processing_status != 'completed';
CREATE INDEX IF NOT EXISTS idx_user_files_scheduled_deletion ON public.user_files(scheduled_deletion) WHERE scheduled_deletion IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_files_public ON public.user_files(is_public) WHERE is_public = true;

-- GDPR compliance indexes
CREATE INDEX IF NOT EXISTS idx_gdpr_exports_status ON public.gdpr_data_exports(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_gdpr_exports_user ON public.gdpr_data_exports(user_id, status);
CREATE INDEX IF NOT EXISTS idx_gdpr_deletions_status ON public.gdpr_data_deletions(status);
CREATE INDEX IF NOT EXISTS idx_gdpr_deletions_processing ON public.gdpr_data_deletions(processing_started_at) WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS idx_gdpr_compliance_logs_user ON public.gdpr_compliance_logs(user_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_gdpr_compliance_logs_activity ON public.gdpr_compliance_logs(activity_type, performed_at DESC);

-- Profile sync indexes
CREATE INDEX IF NOT EXISTS idx_profile_sync_history_user ON public.profile_sync_history(user_id, synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_sync_history_provider ON public.profile_sync_history(provider, synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_conflict_resolutions_user ON public.profile_conflict_resolutions(user_id, resolved_at DESC);

-- =====================================================
-- INSERT DEFAULT PREFERENCE TEMPLATES
-- =====================================================

-- Notification preferences
INSERT INTO public.preference_templates (
    template_name, display_name, description, category, subcategory, preference_key,
    default_value, data_type, validation_schema, ui_component, display_order, applies_to_roles
) VALUES
    ('email_notifications', 'Email Notifications', 'Enable/disable email notifications', 'notifications', 'email', 'enabled', 
     'true'::jsonb, 'boolean', '{"type": "boolean"}'::jsonb, 'switch', 1, ARRAY['user', 'business_owner']),
     
    ('push_notifications', 'Push Notifications', 'Enable/disable push notifications', 'notifications', 'push', 'enabled',
     'false'::jsonb, 'boolean', '{"type": "boolean"}'::jsonb, 'switch', 2, ARRAY['user', 'business_owner']),
     
    ('sms_notifications', 'SMS Notifications', 'Enable/disable SMS notifications', 'notifications', 'sms', 'enabled',
     'false'::jsonb, 'boolean', '{"type": "boolean"}'::jsonb, 'switch', 3, ARRAY['user', 'business_owner']),
     
    ('marketing_emails', 'Marketing Emails', 'Receive marketing and promotional emails', 'notifications', 'email', 'marketing',
     'false'::jsonb, 'boolean', '{"type": "boolean"}'::jsonb, 'switch', 4, ARRAY['user', 'business_owner']),

-- Privacy preferences
    ('profile_visibility', 'Profile Visibility', 'Control who can see your profile', 'privacy', 'profile', 'visibility',
     '"public"'::jsonb, 'string', '{"type": "string", "enum": ["public", "private", "friends", "business"]}'::jsonb, 'select', 5, ARRAY['user', 'business_owner']),
     
    ('show_contact_info', 'Show Contact Information', 'Display contact information on profile', 'privacy', 'profile', 'show_contact',
     'false'::jsonb, 'boolean', '{"type": "boolean"}'::jsonb, 'switch', 6, ARRAY['user', 'business_owner']),
     
    ('data_processing_consent', 'Data Processing Consent', 'Consent for data processing activities', 'privacy', 'gdpr', 'processing_consent',
     'false'::jsonb, 'boolean', '{"type": "boolean"}'::jsonb, 'switch', 7, ARRAY['user', 'business_owner']),

-- UI/UX preferences  
    ('theme', 'Theme', 'Color theme preference', 'ui', 'appearance', 'theme',
     '"light"'::jsonb, 'string', '{"type": "string", "enum": ["light", "dark", "auto"]}'::jsonb, 'select', 8, ARRAY['user', 'business_owner']),
     
    ('language', 'Language', 'Interface language', 'ui', 'localization', 'language',
     '"en"'::jsonb, 'string', '{"type": "string", "enum": ["en", "es", "fr", "de", "it", "pt", "ja", "ko", "zh"]}'::jsonb, 'select', 9, ARRAY['user', 'business_owner']),
     
    ('timezone', 'Timezone', 'Timezone preference', 'ui', 'localization', 'timezone',
     '"UTC"'::jsonb, 'string', '{"type": "string"}'::jsonb, 'timezone-select', 10, ARRAY['user', 'business_owner']),

-- Business owner specific preferences
    ('business_notifications', 'Business Notifications', 'Notifications for business activities', 'business', 'notifications', 'enabled',
     'true'::jsonb, 'boolean', '{"type": "boolean"}'::jsonb, 'switch', 11, ARRAY['business_owner']),
     
    ('auto_respond_reviews', 'Auto-respond to Reviews', 'Automatically respond to new reviews', 'business', 'automation', 'auto_respond',
     'false'::jsonb, 'boolean', '{"type": "boolean"}'::jsonb, 'switch', 12, ARRAY['business_owner'])

ON CONFLICT (template_name) DO NOTHING;

-- =====================================================
-- DATABASE FUNCTIONS FOR PROFILE MANAGEMENT
-- =====================================================

-- Function to calculate profile completion score
CREATE OR REPLACE FUNCTION calculate_profile_completion_score(user_uuid UUID)
RETURNS TABLE(score INTEGER, level VARCHAR(20), missing_fields TEXT[]) AS $$
DECLARE
    profile_record RECORD;
    calculated_score INTEGER := 0;
    completion_level VARCHAR(20);
    missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Get profile data
    SELECT * INTO profile_record FROM public.profiles WHERE id = user_uuid;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT 0, 'basic'::VARCHAR(20), ARRAY['profile_not_found']::TEXT[];
        RETURN;
    END IF;
    
    -- Calculate score based on profile completeness
    IF profile_record.first_name IS NOT NULL THEN 
        calculated_score := calculated_score + 5;
    ELSE 
        missing := array_append(missing, 'first_name');
    END IF;
    
    IF profile_record.last_name IS NOT NULL THEN 
        calculated_score := calculated_score + 5;
    ELSE 
        missing := array_append(missing, 'last_name');
    END IF;
    
    IF profile_record.avatar_url IS NOT NULL AND profile_record.avatar_url != '' THEN 
        calculated_score := calculated_score + 10;
    ELSE 
        missing := array_append(missing, 'avatar_url');
    END IF;
    
    IF profile_record.bio IS NOT NULL AND LENGTH(profile_record.bio) > 10 THEN 
        calculated_score := calculated_score + 10;
    ELSE 
        missing := array_append(missing, 'bio');
    END IF;
    
    IF profile_record.phone_number IS NOT NULL THEN 
        calculated_score := calculated_score + 8;
    ELSE 
        missing := array_append(missing, 'phone_number');
    END IF;
    
    IF profile_record.phone_verified = true THEN 
        calculated_score := calculated_score + 7;
    ELSE 
        missing := array_append(missing, 'phone_verified');
    END IF;
    
    IF profile_record.email_verified = true THEN 
        calculated_score := calculated_score + 10;
    ELSE 
        missing := array_append(missing, 'email_verified');
    END IF;
    
    IF profile_record.city IS NOT NULL THEN 
        calculated_score := calculated_score + 5;
    ELSE 
        missing := array_append(missing, 'city');
    END IF;
    
    IF profile_record.state IS NOT NULL THEN 
        calculated_score := calculated_score + 5;
    ELSE 
        missing := array_append(missing, 'state');
    END IF;
    
    IF profile_record.country IS NOT NULL THEN 
        calculated_score := calculated_score + 5;
    ELSE 
        missing := array_append(missing, 'country');
    END IF;
    
    IF profile_record.website IS NOT NULL THEN 
        calculated_score := calculated_score + 5;
    ELSE 
        missing := array_append(missing, 'website');
    END IF;
    
    IF profile_record.social_links::text != '{"twitter": null, "linkedin": null, "facebook": null, "instagram": null, "github": null}' THEN 
        calculated_score := calculated_score + 10;
    ELSE 
        missing := array_append(missing, 'social_links');
    END IF;
    
    IF profile_record.data_processing_consent = true THEN 
        calculated_score := calculated_score + 7;
    ELSE 
        missing := array_append(missing, 'data_processing_consent');
    END IF;
    
    IF profile_record.is_business_owner = true AND profile_record.business_owner_verified = true THEN 
        calculated_score := calculated_score + 10;
    END IF;
    
    -- Determine completion level
    IF calculated_score >= 90 THEN 
        completion_level := 'complete';
    ELSIF calculated_score >= 65 THEN 
        completion_level := 'advanced';
    ELSIF calculated_score >= 35 THEN 
        completion_level := 'intermediate';
    ELSE 
        completion_level := 'basic';
    END IF;
    
    -- Update profile with calculated score
    UPDATE public.profiles 
    SET 
        profile_completion_score = calculated_score,
        profile_completion_level = completion_level,
        updated_at = NOW()
    WHERE id = user_uuid;
    
    RETURN QUERY SELECT calculated_score, completion_level, missing;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to refresh profile completion materialized view
CREATE OR REPLACE FUNCTION refresh_profile_completion_scores()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.profile_completion_scores;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user preferences with inheritance
CREATE OR REPLACE FUNCTION get_user_preferences_with_inheritance(user_uuid UUID, pref_category VARCHAR DEFAULT NULL)
RETURNS TABLE(
    category VARCHAR(100),
    subcategory VARCHAR(100), 
    preference_key VARCHAR(150),
    preference_value JSONB,
    is_inherited BOOLEAN,
    source VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE preference_hierarchy AS (
        -- Direct user preferences
        SELECT 
            up.category,
            up.subcategory,
            up.preference_key,
            up.preference_value,
            up.is_inherited,
            'user'::VARCHAR(20) as source,
            1 as priority
        FROM public.user_preferences up
        WHERE up.user_id = user_uuid
          AND (pref_category IS NULL OR up.category = pref_category)
          AND up.expires_at IS NULL OR up.expires_at > NOW()
        
        UNION
        
        -- Inherited preferences
        SELECT 
            parent.category,
            parent.subcategory,
            parent.preference_key,
            parent.preference_value,
            true as is_inherited,
            'inherited'::VARCHAR(20) as source,
            2 as priority
        FROM public.user_preferences up
        JOIN public.user_preferences parent ON up.inherits_from = parent.id
        WHERE up.user_id = user_uuid
          AND (pref_category IS NULL OR parent.category = pref_category)
          AND parent.expires_at IS NULL OR parent.expires_at > NOW()
        
        UNION
        
        -- System defaults from templates
        SELECT 
            pt.category,
            pt.subcategory,
            pt.preference_key,
            pt.default_value as preference_value,
            true as is_inherited,
            'default'::VARCHAR(20) as source,
            3 as priority
        FROM public.preference_templates pt
        WHERE (pref_category IS NULL OR pt.category = pref_category)
          AND NOT EXISTS (
              SELECT 1 FROM public.user_preferences up2 
              WHERE up2.user_id = user_uuid 
                AND up2.category = pt.category 
                AND up2.subcategory = pt.subcategory 
                AND up2.preference_key = pt.preference_key
          )
    )
    SELECT DISTINCT ON (ph.category, ph.subcategory, ph.preference_key)
        ph.category,
        ph.subcategory,
        ph.preference_key,
        ph.preference_value,
        ph.is_inherited,
        ph.source
    FROM preference_hierarchy ph
    ORDER BY ph.category, ph.subcategory, ph.preference_key, ph.priority;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to securely delete user data (GDPR)
CREATE OR REPLACE FUNCTION gdpr_delete_user_data(
    user_uuid UUID,
    deletion_type VARCHAR DEFAULT 'account',
    keep_anonymized BOOLEAN DEFAULT false
) RETURNS JSONB AS $$
DECLARE
    deletion_summary JSONB := '{}'::jsonb;
    items_deleted INTEGER := 0;
    items_anonymized INTEGER := 0;
BEGIN
    -- Create deletion record
    INSERT INTO public.gdpr_data_deletions (
        user_id, deletion_type, keep_anonymized, 
        status, processing_started_at, legal_basis
    ) VALUES (
        user_uuid, deletion_type, keep_anonymized,
        'processing', NOW(), 'user_request'
    );
    
    -- Delete or anonymize based on deletion_type
    IF deletion_type = 'account' THEN
        -- Full account deletion
        
        -- Delete user files
        DELETE FROM public.user_files WHERE user_id = user_uuid;
        GET DIAGNOSTICS items_deleted = ROW_COUNT;
        deletion_summary := jsonb_set(deletion_summary, '{files_deleted}', items_deleted::text::jsonb);
        
        -- Delete preferences
        DELETE FROM public.user_preferences WHERE user_id = user_uuid;
        GET DIAGNOSTICS items_deleted = ROW_COUNT;
        deletion_summary := jsonb_set(deletion_summary, '{preferences_deleted}', items_deleted::text::jsonb);
        
        -- Delete or anonymize profile
        IF keep_anonymized THEN
            -- Anonymize profile data
            UPDATE public.profiles SET
                display_name = 'Deleted User',
                username = NULL,
                first_name = NULL,
                last_name = NULL,
                bio = NULL,
                phone_number = NULL,
                city = NULL,
                state = NULL,
                country = NULL,
                website = NULL,
                social_links = '{}'::jsonb,
                avatar_url = NULL,
                custom_fields = '{}'::jsonb,
                deleted_at = NOW()
            WHERE id = user_uuid;
            items_anonymized := items_anonymized + 1;
        ELSE
            -- Full deletion
            DELETE FROM public.profiles WHERE id = user_uuid;
            GET DIAGNOSTICS items_deleted = ROW_COUNT;
        END IF;
        
        deletion_summary := jsonb_set(deletion_summary, '{profiles_anonymized}', items_anonymized::text::jsonb);
    END IF;
    
    -- Update deletion record
    UPDATE public.gdpr_data_deletions SET
        status = 'completed',
        processing_completed_at = NOW(),
        items_deleted = (deletion_summary->>'files_deleted')::INTEGER + 
                       (deletion_summary->>'preferences_deleted')::INTEGER +
                       CASE WHEN NOT keep_anonymized THEN 1 ELSE 0 END,
        items_anonymized = items_anonymized,
        deletion_summary = deletion_summary
    WHERE user_id = user_uuid AND status = 'processing';
    
    RETURN deletion_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Trigger to automatically update profile completion score
CREATE OR REPLACE FUNCTION trigger_update_profile_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate and update completion score
    PERFORM calculate_profile_completion_score(NEW.id);
    
    -- Refresh materialized view periodically (every 100 updates)
    IF random() < 0.01 THEN
        PERFORM refresh_profile_completion_scores();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_completion_update
    AFTER UPDATE ON public.profiles
    FOR EACH ROW
    WHEN (OLD.* IS DISTINCT FROM NEW.*)
    EXECUTE FUNCTION trigger_update_profile_completion();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER user_preferences_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER preference_templates_updated_at
    BEFORE UPDATE ON public.preference_templates
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preference_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_sync_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_conflict_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_processing_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gdpr_data_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gdpr_data_deletions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gdpr_compliance_logs ENABLE ROW LEVEL SECURITY;

-- User preferences policies
CREATE POLICY user_preferences_own_data ON public.user_preferences
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY user_preferences_admin_access ON public.user_preferences
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('super_admin', 'admin')
              AND ur.is_active = true
        )
    );

-- Preference templates policies
CREATE POLICY preference_templates_read_all ON public.preference_templates
    FOR SELECT USING (true);

CREATE POLICY preference_templates_admin_manage ON public.preference_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('super_admin', 'admin')
              AND ur.is_active = true
        )
    );

-- User files policies  
CREATE POLICY user_files_own_data ON public.user_files
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY user_files_public_read ON public.user_files
    FOR SELECT USING (is_public = true AND validation_status = 'passed');

CREATE POLICY user_files_admin_access ON public.user_files
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('super_admin', 'admin')
              AND ur.is_active = true
        )
    );

-- GDPR policies
CREATE POLICY gdpr_exports_own_data ON public.gdpr_data_exports
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY gdpr_deletions_own_data ON public.gdpr_data_deletions
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY gdpr_compliance_admin_only ON public.gdpr_compliance_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('super_admin', 'admin')
              AND ur.is_active = true
        )
    );

-- Profile sync policies
CREATE POLICY profile_sync_own_data ON public.profile_sync_history
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY profile_conflicts_own_data ON public.profile_conflict_resolutions
    FOR ALL USING (user_id = auth.uid());

COMMIT;