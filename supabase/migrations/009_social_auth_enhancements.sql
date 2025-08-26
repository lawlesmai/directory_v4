-- Migration: 009_social_auth_enhancements
-- Epic 2 Story 2.3: Social Media Login Integration
-- Description: Additional tables and functions for social authentication, profile sync, and account management
-- Date: 2025-01-25
-- Author: Backend Architecture Expert

BEGIN;

-- =====================================================
-- PROFILE SYNC HISTORY AND CONFLICT RESOLUTION
-- =====================================================

-- Profile sync history table
CREATE TABLE IF NOT EXISTS public.profile_sync_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Sync details
    provider VARCHAR(50) NOT NULL,
    sync_data JSONB DEFAULT '{}'::jsonb,
    
    -- Results
    synced_fields TEXT[],
    conflicts_count INTEGER DEFAULT 0,
    auto_resolved_count INTEGER DEFAULT 0,
    
    -- Status
    sync_status VARCHAR(20) DEFAULT 'completed' CHECK (
        sync_status IN ('completed', 'partial', 'failed')
    ),
    error_message TEXT,
    
    -- Timestamps
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_sync_data CHECK (jsonb_typeof(sync_data) = 'object')
);

-- Profile conflict resolutions table
CREATE TABLE IF NOT EXISTS public.profile_conflict_resolutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Conflict details
    field_name VARCHAR(100) NOT NULL,
    current_value JSONB,
    provider_value JSONB,
    provider VARCHAR(50) NOT NULL,
    
    -- Resolution
    resolution_type VARCHAR(20) NOT NULL CHECK (
        resolution_type IN ('keep_current', 'use_provider', 'manual_merge')
    ),
    resolved_value JSONB,
    
    -- Metadata
    resolved_by UUID REFERENCES auth.users(id), -- NULL for auto-resolution
    resolved_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexing
    CONSTRAINT unique_user_field_resolution UNIQUE(user_id, field_name, resolved_at)
);

-- User sync preferences (extends profile preferences)
-- This is handled in the profiles.preferences JSONB field with structure:
-- {
--   "profile_sync": {
--     "overwrite_existing": boolean,
--     "preserve_user_changes": boolean,
--     "sync_fields": string[],
--     "exclude_fields": string[]
--   }
-- }

-- =====================================================
-- OAUTH PROVIDER RATE LIMITING AND SECURITY
-- =====================================================

-- OAuth request rate limiting
CREATE TABLE IF NOT EXISTS public.oauth_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identifier (IP, user_id, or combination)
    identifier VARCHAR(255) NOT NULL,
    identifier_type VARCHAR(20) NOT NULL CHECK (
        identifier_type IN ('ip', 'user', 'combined')
    ),
    
    -- Provider and action
    provider VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'initiation', 'callback', 'token_refresh'
    
    -- Rate limiting
    attempts INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    window_duration_minutes INTEGER DEFAULT 60,
    max_attempts INTEGER DEFAULT 10,
    
    -- Blocking
    is_blocked BOOLEAN DEFAULT FALSE,
    blocked_until TIMESTAMPTZ,
    block_reason VARCHAR(255),
    
    CONSTRAINT unique_rate_limit_window UNIQUE(identifier, provider, action, window_start)
);

-- OAuth security incidents
CREATE TABLE IF NOT EXISTS public.oauth_security_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Incident details
    incident_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (
        severity IN ('low', 'medium', 'high', 'critical')
    ),
    
    -- Context
    provider VARCHAR(50) NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    ip_address INET,
    user_agent TEXT,
    
    -- Incident data
    description TEXT NOT NULL,
    raw_data JSONB DEFAULT '{}'::jsonb,
    
    -- Response
    auto_blocked BOOLEAN DEFAULT FALSE,
    admin_notified BOOLEAN DEFAULT FALSE,
    resolved BOOLEAN DEFAULT FALSE,
    resolution_notes TEXT,
    
    -- Timestamps
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

-- =====================================================
-- ENHANCED USER PROFILE FIELDS
-- =====================================================

-- Add social authentication specific fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_oauth_sync TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS oauth_primary_provider VARCHAR(50),
ADD COLUMN IF NOT EXISTS profile_completion_score INTEGER DEFAULT 0 CHECK (profile_completion_score BETWEEN 0 AND 100),
ADD COLUMN IF NOT EXISTS sync_preferences JSONB DEFAULT '{
    "auto_sync": true,
    "sync_avatar": true,
    "sync_name": true,
    "sync_bio": false,
    "conflict_resolution": "manual"
}'::jsonb;

-- Add computed field for profile completeness
CREATE OR REPLACE FUNCTION public.calculate_profile_completion(profile_row public.profiles)
RETURNS INTEGER AS $$
DECLARE
    completion_score INTEGER := 0;
    total_fields INTEGER := 12; -- Adjust based on important fields
BEGIN
    -- Basic info (30 points max)
    IF profile_row.display_name IS NOT NULL AND LENGTH(profile_row.display_name) > 0 THEN
        completion_score := completion_score + 10;
    END IF;
    
    IF profile_row.first_name IS NOT NULL AND profile_row.last_name IS NOT NULL THEN
        completion_score := completion_score + 10;
    END IF;
    
    IF profile_row.avatar_url IS NOT NULL AND LENGTH(profile_row.avatar_url) > 0 THEN
        completion_score := completion_score + 10;
    END IF;
    
    -- Contact info (20 points max)
    IF profile_row.phone_number IS NOT NULL AND profile_row.phone_verified THEN
        completion_score := completion_score + 10;
    END IF;
    
    IF profile_row.email_verified THEN
        completion_score := completion_score + 10;
    END IF;
    
    -- Location and bio (20 points max)
    IF profile_row.city IS NOT NULL AND profile_row.state IS NOT NULL THEN
        completion_score := completion_score + 10;
    END IF;
    
    IF profile_row.bio IS NOT NULL AND LENGTH(profile_row.bio) > 20 THEN
        completion_score := completion_score + 10;
    END IF;
    
    -- Social and external (20 points max)
    IF profile_row.website IS NOT NULL AND LENGTH(profile_row.website) > 0 THEN
        completion_score := completion_score + 10;
    END IF;
    
    IF profile_row.social_links IS NOT NULL AND jsonb_array_length(jsonb_object_keys(profile_row.social_links)) > 0 THEN
        completion_score := completion_score + 10;
    END IF;
    
    -- Preferences and settings (10 points max)
    IF profile_row.timezone IS NOT NULL AND profile_row.timezone != 'UTC' THEN
        completion_score := completion_score + 5;
    END IF;
    
    IF profile_row.preferences IS NOT NULL AND jsonb_object_keys(profile_row.preferences) IS NOT NULL THEN
        completion_score := completion_score + 5;
    END IF;
    
    RETURN LEAST(completion_score, 100); -- Cap at 100%
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- DATABASE FUNCTIONS FOR SOCIAL AUTH
-- =====================================================

-- Function to ensure profile sync history table exists (for backwards compatibility)
CREATE OR REPLACE FUNCTION public.ensure_profile_sync_history_table()
RETURNS void AS $$
BEGIN
    -- This function is called from the profile sync manager
    -- The table is already created above, so this is just a stub
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's active OAuth providers
CREATE OR REPLACE FUNCTION public.get_user_oauth_providers(user_uuid UUID)
RETURNS TABLE (
    provider_name VARCHAR(50),
    is_primary BOOLEAN,
    is_verified BOOLEAN,
    connected_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        op.provider_name,
        uoc.is_primary,
        uoc.is_verified,
        uoc.connected_at,
        uoc.last_used_at
    FROM public.user_oauth_connections uoc
    JOIN public.oauth_providers op ON uoc.provider_id = op.id
    WHERE uoc.user_id = user_uuid 
    AND uoc.disconnected_at IS NULL
    ORDER BY uoc.is_primary DESC, uoc.connected_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to check OAuth rate limits
CREATE OR REPLACE FUNCTION public.check_oauth_rate_limit(
    p_identifier VARCHAR(255),
    p_identifier_type VARCHAR(20),
    p_provider VARCHAR(50),
    p_action VARCHAR(50),
    p_max_attempts INTEGER DEFAULT 10,
    p_window_minutes INTEGER DEFAULT 60
)
RETURNS TABLE (
    allowed BOOLEAN,
    current_attempts INTEGER,
    window_end TIMESTAMPTZ,
    blocked_until TIMESTAMPTZ
) AS $$
DECLARE
    current_window_start TIMESTAMPTZ;
    rate_limit_record RECORD;
BEGIN
    current_window_start := date_trunc('hour', NOW());
    
    -- Get or create rate limit record
    SELECT * INTO rate_limit_record
    FROM public.oauth_rate_limits orl
    WHERE orl.identifier = p_identifier
    AND orl.identifier_type = p_identifier_type
    AND orl.provider = p_provider
    AND orl.action = p_action
    AND orl.window_start = current_window_start;
    
    IF NOT FOUND THEN
        -- Create new rate limit record
        INSERT INTO public.oauth_rate_limits (
            identifier, identifier_type, provider, action,
            attempts, window_start, window_duration_minutes, max_attempts
        ) VALUES (
            p_identifier, p_identifier_type, p_provider, p_action,
            1, current_window_start, p_window_minutes, p_max_attempts
        );
        
        RETURN QUERY SELECT TRUE, 1, current_window_start + (p_window_minutes || ' minutes')::INTERVAL, NULL::TIMESTAMPTZ;
    ELSE
        -- Check if blocked
        IF rate_limit_record.is_blocked AND rate_limit_record.blocked_until > NOW() THEN
            RETURN QUERY SELECT FALSE, rate_limit_record.attempts, 
                current_window_start + (p_window_minutes || ' minutes')::INTERVAL,
                rate_limit_record.blocked_until;
            RETURN;
        END IF;
        
        -- Increment attempts
        UPDATE public.oauth_rate_limits
        SET attempts = attempts + 1,
            is_blocked = CASE WHEN attempts + 1 >= p_max_attempts THEN TRUE ELSE FALSE END,
            blocked_until = CASE WHEN attempts + 1 >= p_max_attempts THEN NOW() + INTERVAL '1 hour' ELSE NULL END
        WHERE id = rate_limit_record.id;
        
        RETURN QUERY SELECT 
            (rate_limit_record.attempts + 1) < p_max_attempts,
            rate_limit_record.attempts + 1,
            current_window_start + (p_window_minutes || ' minutes')::INTERVAL,
            CASE WHEN (rate_limit_record.attempts + 1) >= p_max_attempts THEN NOW() + INTERVAL '1 hour' ELSE NULL END;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired OAuth rate limits
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_rate_limits()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.oauth_rate_limits
    WHERE window_start + (window_duration_minutes || ' minutes')::INTERVAL < NOW() - INTERVAL '24 hours';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update profile completion score
CREATE OR REPLACE FUNCTION public.update_profile_completion_score()
RETURNS TRIGGER AS $$
BEGIN
    NEW.profile_completion_score := public.calculate_profile_completion(NEW);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger to update profile completion score
DROP TRIGGER IF EXISTS update_profile_completion_trigger ON public.profiles;
CREATE TRIGGER update_profile_completion_trigger
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_profile_completion_score();

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Profile sync history indexes
CREATE INDEX IF NOT EXISTS idx_profile_sync_history_user ON public.profile_sync_history(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_sync_history_provider ON public.profile_sync_history(provider);
CREATE INDEX IF NOT EXISTS idx_profile_sync_history_synced_at ON public.profile_sync_history(synced_at DESC);

-- Profile conflict resolutions indexes
CREATE INDEX IF NOT EXISTS idx_profile_conflict_resolutions_user ON public.profile_conflict_resolutions(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_conflict_resolutions_field ON public.profile_conflict_resolutions(field_name);
CREATE INDEX IF NOT EXISTS idx_profile_conflict_resolutions_resolved_at ON public.profile_conflict_resolutions(resolved_at DESC);

-- OAuth rate limits indexes
CREATE INDEX IF NOT EXISTS idx_oauth_rate_limits_identifier ON public.oauth_rate_limits(identifier, provider, action);
CREATE INDEX IF NOT EXISTS idx_oauth_rate_limits_window ON public.oauth_rate_limits(window_start) WHERE is_blocked = false;
CREATE INDEX IF NOT EXISTS idx_oauth_rate_limits_blocked ON public.oauth_rate_limits(blocked_until) WHERE is_blocked = true;

-- OAuth security incidents indexes
CREATE INDEX IF NOT EXISTS idx_oauth_security_incidents_severity ON public.oauth_security_incidents(severity) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_oauth_security_incidents_provider ON public.oauth_security_incidents(provider);
CREATE INDEX IF NOT EXISTS idx_oauth_security_incidents_detected_at ON public.oauth_security_incidents(detected_at DESC);

-- Enhanced profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_oauth_provider ON public.profiles(oauth_primary_provider) WHERE oauth_primary_provider IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_completion_score ON public.profiles(profile_completion_score DESC) WHERE profile_completion_score > 0;
CREATE INDEX IF NOT EXISTS idx_profiles_last_oauth_sync ON public.profiles(last_oauth_sync DESC) WHERE last_oauth_sync IS NOT NULL;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE public.profile_sync_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_conflict_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_security_incidents ENABLE ROW LEVEL SECURITY;

-- Profile sync history policies
CREATE POLICY "Users can view their own sync history" ON public.profile_sync_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sync history" ON public.profile_sync_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all sync history" ON public.profile_sync_history
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin')
            AND ur.is_active = true
        )
    );

-- Profile conflict resolutions policies
CREATE POLICY "Users can manage their own conflict resolutions" ON public.profile_conflict_resolutions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all conflict resolutions" ON public.profile_conflict_resolutions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin')
            AND ur.is_active = true
        )
    );

-- OAuth rate limits policies (service-level access)
CREATE POLICY "Service access to rate limits" ON public.oauth_rate_limits
    FOR ALL USING (true); -- This table is managed by the service

-- OAuth security incidents policies
CREATE POLICY "Admins can manage security incidents" ON public.oauth_security_incidents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin')
            AND ur.is_active = true
        )
    );

CREATE POLICY "Users can view incidents related to them" ON public.oauth_security_incidents
    FOR SELECT USING (auth.uid() = user_id);

-- =====================================================
-- INITIAL DATA AND CLEANUP
-- =====================================================

-- Clean up any orphaned OAuth connections
DELETE FROM public.user_oauth_connections
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Update existing profiles with completion scores
UPDATE public.profiles 
SET profile_completion_score = public.calculate_profile_completion(profiles.*)
WHERE profile_completion_score IS NULL OR profile_completion_score = 0;

COMMIT;