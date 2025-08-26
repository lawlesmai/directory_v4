-- Migration: 010_mfa_enhancement
-- Epic 2 Story 2.4: Comprehensive Multi-Factor Authentication Infrastructure
-- Description: Complete MFA system with TOTP, SMS, backup codes, device trust, and recovery
-- Date: 2025-08-26
-- Author: Backend Developer

BEGIN;

-- =====================================================
-- ENHANCE EXISTING MFA TABLES
-- =====================================================

-- Add missing columns to auth_mfa_config
ALTER TABLE public.auth_mfa_config ADD COLUMN IF NOT EXISTS 
    -- Enhanced security settings
    mfa_grace_period_expires TIMESTAMPTZ,
    require_mfa_for_admin_actions BOOLEAN DEFAULT TRUE,
    
    -- Device trust settings
    trust_device_enabled BOOLEAN DEFAULT TRUE,
    trusted_device_duration_days INTEGER DEFAULT 30,
    max_trusted_devices INTEGER DEFAULT 5,
    
    -- Rate limiting settings
    max_failed_attempts INTEGER DEFAULT 5,
    lockout_duration_minutes INTEGER DEFAULT 30,
    failed_attempts_count INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    
    -- Recovery settings
    recovery_codes_count INTEGER DEFAULT 8,
    recovery_method_preference VARCHAR(20) DEFAULT 'email' CHECK (
        recovery_method_preference IN ('email', 'sms', 'both')
    ),
    
    -- Admin override settings
    admin_bypass_enabled BOOLEAN DEFAULT FALSE,
    admin_bypass_expires TIMESTAMPTZ,
    admin_bypass_granted_by UUID REFERENCES auth.users(id),
    
    -- Enhanced metadata
    enrollment_started_at TIMESTAMPTZ,
    enrollment_completed_at TIMESTAMPTZ,
    last_backup_codes_view TIMESTAMPTZ,
    last_method_change TIMESTAMPTZ;

-- =====================================================
-- DEVICE FINGERPRINTING AND TRUST ENHANCEMENT
-- =====================================================

-- Enhanced device trust scoring
CREATE TABLE IF NOT EXISTS public.device_trust_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Fingerprint components
    canvas_fingerprint TEXT,
    webgl_fingerprint TEXT,
    audio_fingerprint TEXT,
    font_fingerprint TEXT,
    screen_resolution VARCHAR(50),
    timezone_offset INTEGER,
    language_preference VARCHAR(10),
    platform_details JSONB DEFAULT '{}'::jsonb,
    
    -- Behavioral signals
    typing_pattern JSONB DEFAULT '{}'::jsonb,
    mouse_movement_pattern JSONB DEFAULT '{}'::jsonb,
    interaction_patterns JSONB DEFAULT '{}'::jsonb,
    
    -- Trust calculation
    base_trust_score DECIMAL(3,2) DEFAULT 0.50 CHECK (base_trust_score BETWEEN 0 AND 1),
    behavioral_trust_score DECIMAL(3,2) DEFAULT 0.50 CHECK (behavioral_trust_score BETWEEN 0 AND 1),
    final_trust_score DECIMAL(3,2) GENERATED ALWAYS AS (
        GREATEST(0, LEAST(1, (base_trust_score + behavioral_trust_score) / 2))
    ) STORED,
    
    -- Trust factors
    successful_authentications INTEGER DEFAULT 0,
    failed_authentications INTEGER DEFAULT 0,
    suspicious_activities INTEGER DEFAULT 0,
    
    -- Geographic consistency
    consistent_location BOOLEAN DEFAULT TRUE,
    location_variance_km DECIMAL(8,2),
    
    -- Network consistency
    consistent_network BOOLEAN DEFAULT TRUE,
    isp_consistency_score DECIMAL(3,2) DEFAULT 1.00,
    
    -- Time pattern consistency
    consistent_usage_time BOOLEAN DEFAULT TRUE,
    usage_time_variance_hours INTEGER,
    
    -- Risk indicators
    risk_flags TEXT[] DEFAULT '{}',
    risk_score DECIMAL(3,2) DEFAULT 0.00 CHECK (risk_score BETWEEN 0 AND 1),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_device_user UNIQUE(device_id, user_id)
);

-- MFA challenge tracking with enhanced security
CREATE TABLE IF NOT EXISTS public.mfa_verification_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES public.auth_mfa_challenges(id) ON DELETE CASCADE,
    
    -- Attempt details
    verification_method VARCHAR(20) NOT NULL CHECK (
        verification_method IN ('totp', 'sms', 'email', 'backup_code', 'recovery_code', 'admin_override')
    ),
    
    -- Input tracking
    provided_code VARCHAR(50), -- Hashed for security
    code_hash TEXT, -- SHA-256 of provided code
    is_valid BOOLEAN NOT NULL,
    
    -- Device and network context
    device_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    geolocation JSONB DEFAULT '{}'::jsonb,
    
    -- Timing analysis
    response_time_ms INTEGER, -- Time to enter code
    server_processing_time_ms INTEGER,
    
    -- Security indicators
    is_suspicious BOOLEAN DEFAULT FALSE,
    suspicion_reasons TEXT[],
    fraud_score DECIMAL(3,2) DEFAULT 0.00,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_mfa_attempts_user_method (user_id, verification_method),
    INDEX idx_mfa_attempts_challenge (challenge_id),
    INDEX idx_mfa_attempts_created (created_at DESC)
);

-- =====================================================
-- BACKUP CODES ENHANCEMENT
-- =====================================================

-- Detailed backup codes tracking
CREATE TABLE IF NOT EXISTS public.mfa_backup_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Code details
    code_hash TEXT NOT NULL, -- SHA-256 hash of the actual code
    code_partial VARCHAR(8) NOT NULL, -- First 4 chars for identification
    
    -- Usage tracking
    is_used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMPTZ,
    used_ip INET,
    used_device_id VARCHAR(255),
    
    -- Security
    generation_batch UUID NOT NULL, -- Group codes generated together
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 year',
    
    CONSTRAINT unique_user_code_hash UNIQUE(user_id, code_hash)
);

-- =====================================================
-- RECOVERY AND ADMIN OVERRIDE SYSTEM
-- =====================================================

-- MFA recovery requests
CREATE TABLE IF NOT EXISTS public.mfa_recovery_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Request details
    recovery_method VARCHAR(20) NOT NULL CHECK (
        recovery_method IN ('email', 'sms', 'identity_verification', 'admin_assisted')
    ),
    
    -- Verification data
    verification_token VARCHAR(255) UNIQUE NOT NULL,
    verification_code VARCHAR(10),
    
    -- Contact information used
    recovery_email VARCHAR(255),
    recovery_phone VARCHAR(20),
    
    -- Identity verification (for high-security recovery)
    identity_documents JSONB DEFAULT '[]'::jsonb,
    identity_verification_status VARCHAR(20) DEFAULT 'pending' CHECK (
        identity_verification_status IN ('pending', 'in_review', 'verified', 'rejected')
    ),
    
    -- Request status
    status VARCHAR(20) DEFAULT 'pending' CHECK (
        status IN ('pending', 'in_progress', 'completed', 'rejected', 'expired')
    ),
    
    -- Processing details
    processed_by UUID REFERENCES auth.users(id),
    processing_notes TEXT,
    rejection_reason TEXT,
    
    -- Security context
    request_ip INET,
    request_user_agent TEXT,
    request_geolocation JSONB DEFAULT '{}'::jsonb,
    
    -- Lifecycle
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
    completed_at TIMESTAMPTZ,
    
    INDEX idx_recovery_requests_user (user_id),
    INDEX idx_recovery_requests_token (verification_token),
    INDEX idx_recovery_requests_status (status)
);

-- Admin MFA override tracking
CREATE TABLE IF NOT EXISTS public.mfa_admin_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    admin_user_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- Override details
    override_type VARCHAR(30) NOT NULL CHECK (
        override_type IN ('temporary_disable', 'reset_mfa', 'emergency_access', 'trust_device')
    ),
    
    -- Duration and scope
    expires_at TIMESTAMPTZ,
    scope VARCHAR(50) DEFAULT 'full', -- 'full', 'specific_action', 'single_session'
    
    -- Justification
    reason VARCHAR(500) NOT NULL,
    emergency_justification TEXT,
    
    -- Approval process (for sensitive overrides)
    requires_approval BOOLEAN DEFAULT FALSE,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    approval_notes TEXT,
    
    -- Usage tracking
    times_used INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    -- Security
    is_active BOOLEAN DEFAULT TRUE,
    revoked_at TIMESTAMPTZ,
    revoke_reason TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX idx_admin_overrides_target (target_user_id),
    INDEX idx_admin_overrides_admin (admin_user_id),
    INDEX idx_admin_overrides_active (is_active, expires_at)
);

-- =====================================================
-- ENHANCED RATE LIMITING FOR MFA
-- =====================================================

-- MFA-specific rate limiting
CREATE TABLE IF NOT EXISTS public.mfa_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Target identification
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ip_address INET,
    device_id VARCHAR(255),
    
    -- Limit type
    limit_type VARCHAR(30) NOT NULL CHECK (
        limit_type IN ('totp_attempts', 'sms_requests', 'backup_code_attempts', 'recovery_requests')
    ),
    
    -- Tracking
    attempts INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    window_duration_minutes INTEGER NOT NULL,
    max_attempts INTEGER NOT NULL,
    
    -- Escalation
    escalation_level INTEGER DEFAULT 1,
    escalation_actions TEXT[] DEFAULT '{}',
    
    -- Status
    is_blocked BOOLEAN DEFAULT FALSE,
    blocked_until TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX idx_mfa_rate_limits_user (user_id),
    INDEX idx_mfa_rate_limits_ip (ip_address),
    INDEX idx_mfa_rate_limits_type (limit_type),
    INDEX idx_mfa_rate_limits_blocked (is_blocked, blocked_until)
);

-- =====================================================
-- NOTIFICATION PREFERENCES FOR MFA
-- =====================================================

-- User notification preferences for MFA events
CREATE TABLE IF NOT EXISTS public.mfa_notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Email notifications
    notify_mfa_enabled BOOLEAN DEFAULT TRUE,
    notify_mfa_disabled BOOLEAN DEFAULT TRUE,
    notify_new_trusted_device BOOLEAN DEFAULT TRUE,
    notify_suspicious_login BOOLEAN DEFAULT TRUE,
    notify_backup_codes_generated BOOLEAN DEFAULT TRUE,
    notify_recovery_initiated BOOLEAN DEFAULT TRUE,
    
    -- SMS notifications
    sms_notify_login_attempts BOOLEAN DEFAULT FALSE,
    sms_notify_mfa_disabled BOOLEAN DEFAULT TRUE,
    
    -- Push notifications (for mobile apps)
    push_notify_login_attempts BOOLEAN DEFAULT TRUE,
    push_notify_mfa_changes BOOLEAN DEFAULT TRUE,
    
    -- Notification frequency
    digest_frequency VARCHAR(20) DEFAULT 'immediate' CHECK (
        digest_frequency IN ('immediate', 'hourly', 'daily', 'weekly', 'never')
    ),
    
    -- Security alert settings
    security_alert_threshold VARCHAR(20) DEFAULT 'medium' CHECK (
        security_alert_threshold IN ('low', 'medium', 'high', 'critical_only')
    ),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- MFA ANALYTICS AND REPORTING
-- =====================================================

-- MFA usage analytics
CREATE TABLE IF NOT EXISTS public.mfa_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Time period
    date DATE NOT NULL,
    hour INTEGER CHECK (hour BETWEEN 0 AND 23),
    
    -- Method usage stats
    totp_attempts INTEGER DEFAULT 0,
    totp_successes INTEGER DEFAULT 0,
    sms_requests INTEGER DEFAULT 0,
    sms_successes INTEGER DEFAULT 0,
    backup_code_usage INTEGER DEFAULT 0,
    recovery_requests INTEGER DEFAULT 0,
    
    -- User segments
    new_users_enrolled INTEGER DEFAULT 0,
    total_mfa_users INTEGER DEFAULT 0,
    admin_users_with_mfa INTEGER DEFAULT 0,
    business_owners_with_mfa INTEGER DEFAULT 0,
    
    -- Security metrics
    suspicious_attempts INTEGER DEFAULT 0,
    blocked_attempts INTEGER DEFAULT 0,
    device_trust_failures INTEGER DEFAULT 0,
    
    -- Performance metrics
    avg_verification_time_ms INTEGER,
    p95_verification_time_ms INTEGER,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_mfa_analytics_period UNIQUE(date, hour)
);

-- =====================================================
-- TRIGGERS AND FUNCTIONS
-- =====================================================

-- Function to update device trust score
CREATE OR REPLACE FUNCTION update_device_trust_score()
RETURNS TRIGGER AS $$
BEGIN
    -- Update trust score based on successful/failed authentications
    UPDATE public.device_trust_scores 
    SET 
        successful_authentications = CASE 
            WHEN NEW.is_valid = true THEN successful_authentications + 1
            ELSE successful_authentications 
        END,
        failed_authentications = CASE 
            WHEN NEW.is_valid = false THEN failed_authentications + 1
            ELSE failed_authentications 
        END,
        suspicious_activities = CASE 
            WHEN NEW.is_suspicious = true THEN suspicious_activities + 1
            ELSE suspicious_activities 
        END,
        updated_at = NOW()
    WHERE device_id = NEW.device_id AND user_id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for device trust score updates
CREATE TRIGGER update_device_trust_on_mfa_attempt
    AFTER INSERT ON public.mfa_verification_attempts
    FOR EACH ROW EXECUTE FUNCTION update_device_trust_score();

-- Function to clean up expired MFA challenges
CREATE OR REPLACE FUNCTION cleanup_expired_mfa_challenges()
RETURNS void AS $$
BEGIN
    DELETE FROM public.auth_mfa_challenges 
    WHERE expires_at < NOW() - INTERVAL '1 hour';
    
    DELETE FROM public.mfa_recovery_requests 
    WHERE expires_at < NOW() - INTERVAL '1 day';
    
    UPDATE public.mfa_rate_limits 
    SET is_blocked = false 
    WHERE is_blocked = true AND blocked_until < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to generate MFA analytics
CREATE OR REPLACE FUNCTION generate_mfa_analytics()
RETURNS void AS $$
DECLARE
    current_date DATE := CURRENT_DATE;
    current_hour INTEGER := EXTRACT(hour FROM NOW());
BEGIN
    INSERT INTO public.mfa_analytics (
        date, hour,
        totp_attempts, totp_successes,
        sms_requests, sms_successes,
        backup_code_usage, recovery_requests,
        new_users_enrolled, total_mfa_users,
        admin_users_with_mfa, business_owners_with_mfa,
        suspicious_attempts, blocked_attempts
    )
    SELECT 
        current_date, current_hour,
        COUNT(*) FILTER (WHERE verification_method = 'totp'),
        COUNT(*) FILTER (WHERE verification_method = 'totp' AND is_valid = true),
        COUNT(*) FILTER (WHERE verification_method = 'sms'),
        COUNT(*) FILTER (WHERE verification_method = 'sms' AND is_valid = true),
        COUNT(*) FILTER (WHERE verification_method = 'backup_code' AND is_valid = true),
        (SELECT COUNT(*) FROM public.mfa_recovery_requests 
         WHERE created_at >= current_date + (current_hour || ' hours')::interval 
         AND created_at < current_date + ((current_hour + 1) || ' hours')::interval),
        0, -- Will be calculated separately
        (SELECT COUNT(*) FROM public.auth_mfa_config WHERE mfa_enabled = true),
        0, -- Will be calculated with role joins
        0, -- Will be calculated with role joins
        COUNT(*) FILTER (WHERE is_suspicious = true),
        0  -- Will be calculated from rate limits
    FROM public.mfa_verification_attempts
    WHERE created_at >= current_date + (current_hour || ' hours')::interval 
    AND created_at < current_date + ((current_hour + 1) || ' hours')::interval
    ON CONFLICT (date, hour) DO UPDATE SET
        totp_attempts = EXCLUDED.totp_attempts,
        totp_successes = EXCLUDED.totp_successes,
        sms_requests = EXCLUDED.sms_requests,
        sms_successes = EXCLUDED.sms_successes,
        backup_code_usage = EXCLUDED.backup_code_usage,
        recovery_requests = EXCLUDED.recovery_requests,
        total_mfa_users = EXCLUDED.total_mfa_users,
        suspicious_attempts = EXCLUDED.suspicious_attempts;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SECURITY ENHANCEMENTS
-- =====================================================

-- Add RLS policies for new MFA tables
ALTER TABLE public.device_trust_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_verification_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_backup_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_recovery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_admin_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Device trust scores - users can only see their own
CREATE POLICY device_trust_user_policy ON public.device_trust_scores
    FOR ALL USING (user_id = auth.uid());

-- MFA verification attempts - users can only see their own, admins can see all
CREATE POLICY mfa_attempts_user_policy ON public.mfa_verification_attempts
    FOR SELECT USING (
        user_id = auth.uid() OR 
        auth.uid() IN (
            SELECT ur.user_id FROM public.user_roles ur 
            JOIN public.roles r ON r.id = ur.role_id 
            WHERE r.name IN ('admin', 'super_admin') AND ur.is_active = true
        )
    );

-- Backup codes - users can only see their own
CREATE POLICY backup_codes_user_policy ON public.mfa_backup_codes
    FOR ALL USING (user_id = auth.uid());

-- Recovery requests - users can see their own, admins can see all
CREATE POLICY recovery_requests_policy ON public.mfa_recovery_requests
    FOR SELECT USING (
        user_id = auth.uid() OR 
        auth.uid() IN (
            SELECT ur.user_id FROM public.user_roles ur 
            JOIN public.roles r ON r.id = ur.role_id 
            WHERE r.name IN ('admin', 'super_admin') AND ur.is_active = true
        )
    );

-- Admin overrides - only admins can access
CREATE POLICY admin_overrides_policy ON public.mfa_admin_overrides
    FOR ALL USING (
        auth.uid() IN (
            SELECT ur.user_id FROM public.user_roles ur 
            JOIN public.roles r ON r.id = ur.role_id 
            WHERE r.name IN ('admin', 'super_admin') AND ur.is_active = true
        )
    );

-- Notification preferences - users can only see/modify their own
CREATE POLICY notification_preferences_policy ON public.mfa_notification_preferences
    FOR ALL USING (user_id = auth.uid());

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

-- Device trust scores indexes
CREATE INDEX idx_device_trust_scores_user ON public.device_trust_scores(user_id);
CREATE INDEX idx_device_trust_scores_device ON public.device_trust_scores(device_id);
CREATE INDEX idx_device_trust_scores_trust ON public.device_trust_scores(final_trust_score DESC);

-- MFA verification attempts indexes
CREATE INDEX idx_mfa_attempts_user_created ON public.mfa_verification_attempts(user_id, created_at DESC);
CREATE INDEX idx_mfa_attempts_method_valid ON public.mfa_verification_attempts(verification_method, is_valid);
CREATE INDEX idx_mfa_attempts_suspicious ON public.mfa_verification_attempts(is_suspicious, created_at DESC);

-- Backup codes indexes
CREATE INDEX idx_backup_codes_user_unused ON public.mfa_backup_codes(user_id) WHERE is_used = false;
CREATE INDEX idx_backup_codes_batch ON public.mfa_backup_codes(generation_batch);

-- Recovery requests indexes
CREATE INDEX idx_recovery_requests_status ON public.mfa_recovery_requests(status, created_at DESC);
CREATE INDEX idx_recovery_requests_expires ON public.mfa_recovery_requests(expires_at) WHERE status = 'pending';

-- Admin overrides indexes
CREATE INDEX idx_admin_overrides_expires ON public.mfa_admin_overrides(expires_at) WHERE is_active = true;
CREATE INDEX idx_admin_overrides_type ON public.mfa_admin_overrides(override_type, is_active);

-- Rate limiting indexes
CREATE INDEX idx_mfa_rate_limits_user_type ON public.mfa_rate_limits(user_id, limit_type);
CREATE INDEX idx_mfa_rate_limits_cleanup ON public.mfa_rate_limits(blocked_until) WHERE is_blocked = true;

-- Analytics indexes
CREATE INDEX idx_mfa_analytics_date ON public.mfa_analytics(date DESC, hour DESC);

COMMIT;