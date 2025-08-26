-- Password Security Infrastructure
-- Epic 2 Story 2.6: Advanced Password Management and Account Security
-- Migration: 012_password_security_infrastructure.sql
-- 
-- This migration creates the database infrastructure for:
-- - Password history tracking
-- - Account lockout mechanisms
-- - Security events and monitoring
-- - Password reset tokens with enhanced security
-- - Compliance audit logging

BEGIN;

-- =====================================================================================
-- PASSWORD HISTORY TRACKING
-- =====================================================================================

-- Table to track password history for preventing reuse
CREATE TABLE user_password_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    algorithm TEXT NOT NULL DEFAULT 'bcrypt' CHECK (algorithm IN ('bcrypt', 'argon2id')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by_ip INET,
    user_agent TEXT,
    
    -- Ensure we don't store duplicate hashes for same user
    UNIQUE(user_id, password_hash)
);

-- Index for efficient password history lookups
CREATE INDEX idx_user_password_history_user_id_created ON user_password_history(user_id, created_at DESC);

-- RLS for password history
ALTER TABLE user_password_history ENABLE ROW LEVEL SECURITY;

-- Only allow users to read their own password history (for reuse checking)
CREATE POLICY "Users can access own password history" ON user_password_history
    FOR SELECT USING (auth.uid() = user_id);

-- Only system can insert password history
CREATE POLICY "Service role can manage password history" ON user_password_history
    FOR ALL USING (auth.role() = 'service_role');

-- =====================================================================================
-- ACCOUNT LOCKOUT AND SECURITY
-- =====================================================================================

-- Table to track failed authentication attempts and account lockouts
CREATE TABLE account_security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'failed_login', 'successful_login', 'password_reset_request', 
        'password_changed', 'account_locked', 'account_unlocked',
        'suspicious_activity', 'rate_limit_exceeded', 'breach_detected'
    )),
    ip_address INET NOT NULL,
    user_agent TEXT,
    country_code TEXT,
    city TEXT,
    
    -- Event details
    failure_reason TEXT,
    success_method TEXT, -- password, oauth, mfa, etc.
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    
    -- Lockout information
    lockout_until TIMESTAMPTZ,
    lockout_reason TEXT,
    attempt_count INTEGER DEFAULT 1,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for efficient security event queries
CREATE INDEX idx_account_security_events_user_id_created ON account_security_events(user_id, created_at DESC);
CREATE INDEX idx_account_security_events_ip_created ON account_security_events(ip_address, created_at DESC);
CREATE INDEX idx_account_security_events_type_created ON account_security_events(event_type, created_at DESC);
CREATE INDEX idx_account_security_events_lockout ON account_security_events(lockout_until) WHERE lockout_until IS NOT NULL;

-- RLS for security events
ALTER TABLE account_security_events ENABLE ROW LEVEL SECURITY;

-- Users can read their own security events (for security dashboard)
CREATE POLICY "Users can view own security events" ON account_security_events
    FOR SELECT USING (auth.uid() = user_id);

-- Only service role can manage security events
CREATE POLICY "Service role can manage security events" ON account_security_events
    FOR ALL USING (auth.role() = 'service_role');

-- =====================================================================================
-- PASSWORD RESET TOKENS
-- =====================================================================================

-- Enhanced password reset tokens with security features
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of the actual token
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Security tracking
    requested_ip INET NOT NULL,
    requested_user_agent TEXT,
    used_ip INET,
    used_user_agent TEXT,
    
    -- Rate limiting and abuse prevention
    attempt_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    
    -- Token verification method
    verification_method TEXT DEFAULT 'email' CHECK (verification_method IN ('email', 'sms', 'admin')),
    
    -- Additional security
    requires_mfa BOOLEAN DEFAULT FALSE,
    risk_assessment JSONB DEFAULT '{}',
    
    CONSTRAINT valid_expiry CHECK (expires_at > created_at),
    CONSTRAINT no_future_usage CHECK (used_at IS NULL OR used_at >= created_at)
);

-- Indexes for password reset tokens
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);
CREATE INDEX idx_password_reset_tokens_created ON password_reset_tokens(created_at);

-- Clean up expired tokens automatically
CREATE INDEX idx_password_reset_tokens_cleanup ON password_reset_tokens(expires_at) WHERE used_at IS NULL;

-- RLS for password reset tokens
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can manage reset tokens
CREATE POLICY "Service role can manage reset tokens" ON password_reset_tokens
    FOR ALL USING (auth.role() = 'service_role');

-- =====================================================================================
-- SECURITY MONITORING AND ALERTS
-- =====================================================================================

-- Table for security incidents and monitoring
CREATE TABLE security_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_type TEXT NOT NULL CHECK (incident_type IN (
        'brute_force', 'credential_stuffing', 'suspicious_login_pattern',
        'account_takeover_attempt', 'password_breach_detected', 
        'multiple_failed_resets', 'location_anomaly', 'device_anomaly',
        'rapid_password_changes', 'admin_intervention_required'
    )),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Affected entities
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    
    -- Incident details
    description TEXT NOT NULL,
    evidence JSONB DEFAULT '{}',
    automated_response TEXT, -- Actions taken automatically
    
    -- Resolution tracking
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    resolution_notes TEXT,
    
    -- Notification tracking
    admin_notified BOOLEAN DEFAULT FALSE,
    user_notified BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for security incidents
CREATE INDEX idx_security_incidents_user_id ON security_incidents(user_id);
CREATE INDEX idx_security_incidents_severity ON security_incidents(severity);
CREATE INDEX idx_security_incidents_status ON security_incidents(status);
CREATE INDEX idx_security_incidents_type ON security_incidents(incident_type);
CREATE INDEX idx_security_incidents_created ON security_incidents(created_at DESC);

-- RLS for security incidents
ALTER TABLE security_incidents ENABLE ROW LEVEL SECURITY;

-- Admins can see all incidents
CREATE POLICY "Admins can manage security incidents" ON security_incidents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'security_admin')
        )
    );

-- Users can see incidents related to them
CREATE POLICY "Users can view own security incidents" ON security_incidents
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all incidents
CREATE POLICY "Service role can manage security incidents" ON security_incidents
    FOR ALL USING (auth.role() = 'service_role');

-- =====================================================================================
-- COMPLIANCE AUDIT LOGGING
-- =====================================================================================

-- Enhanced audit log for compliance (extends existing auth_audit_logs)
CREATE TABLE password_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'password_created', 'password_changed', 'password_reset_requested',
        'password_reset_completed', 'password_policy_violation',
        'breach_check_performed', 'history_check_performed',
        'strength_validation', 'admin_password_reset'
    )),
    
    -- Policy and compliance details
    policy_version TEXT,
    compliance_status TEXT CHECK (compliance_status IN ('compliant', 'non_compliant', 'warning')),
    policy_violations TEXT[], -- Array of violated policy rules
    
    -- Password characteristics (no actual password data)
    password_length INTEGER,
    password_strength_score INTEGER CHECK (password_strength_score >= 0 AND password_strength_score <= 100),
    entropy_bits NUMERIC(5,2),
    breach_detected BOOLEAN DEFAULT FALSE,
    reuse_detected BOOLEAN DEFAULT FALSE,
    
    -- Context information
    ip_address INET NOT NULL,
    user_agent TEXT,
    country_code TEXT,
    triggered_by TEXT, -- user, system, admin, policy
    
    -- Compliance metadata
    retention_period INTERVAL DEFAULT '7 years', -- Compliance requirement
    classification TEXT DEFAULT 'confidential',
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for password audit logs
CREATE INDEX idx_password_audit_logs_user_id ON password_audit_logs(user_id, created_at DESC);
CREATE INDEX idx_password_audit_logs_event_type ON password_audit_logs(event_type, created_at DESC);
CREATE INDEX idx_password_audit_logs_compliance ON password_audit_logs(compliance_status, created_at DESC);
CREATE INDEX idx_password_audit_logs_created ON password_audit_logs(created_at DESC);

-- RLS for audit logs
ALTER TABLE password_audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can see their own audit logs
CREATE POLICY "Users can view own password audit logs" ON password_audit_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Admins can see all audit logs
CREATE POLICY "Admins can view password audit logs" ON password_audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'security_admin', 'compliance_officer')
        )
    );

-- Only service role can insert audit logs
CREATE POLICY "Service role can manage password audit logs" ON password_audit_logs
    FOR INSERT USING (auth.role() = 'service_role');

-- =====================================================================================
-- STORED FUNCTIONS FOR PASSWORD SECURITY
-- =====================================================================================

-- Function to check account lockout status
CREATE OR REPLACE FUNCTION check_account_lockout(p_user_id UUID, p_ip_address INET DEFAULT NULL)
RETURNS TABLE (
    is_locked BOOLEAN,
    lockout_until TIMESTAMPTZ,
    reason TEXT,
    attempt_count INTEGER
) AS $$
DECLARE
    v_record RECORD;
    v_ip_attempts INTEGER := 0;
    v_user_attempts INTEGER := 0;
BEGIN
    -- Check for active user lockout
    SELECT ase.lockout_until, ase.lockout_reason, ase.attempt_count
    INTO v_record
    FROM account_security_events ase
    WHERE ase.user_id = p_user_id
        AND ase.lockout_until > NOW()
        AND ase.event_type = 'account_locked'
    ORDER BY ase.created_at DESC
    LIMIT 1;

    IF FOUND THEN
        RETURN QUERY SELECT TRUE, v_record.lockout_until, v_record.lockout_reason, v_record.attempt_count;
        RETURN;
    END IF;

    -- Check recent failed attempts for progressive lockout
    SELECT COUNT(*)
    INTO v_user_attempts
    FROM account_security_events ase
    WHERE ase.user_id = p_user_id
        AND ase.event_type = 'failed_login'
        AND ase.created_at > NOW() - INTERVAL '15 minutes';

    -- Check IP-based attempts if provided
    IF p_ip_address IS NOT NULL THEN
        SELECT COUNT(*)
        INTO v_ip_attempts
        FROM account_security_events ase
        WHERE ase.ip_address = p_ip_address
            AND ase.event_type = 'failed_login'
            AND ase.created_at > NOW() - INTERVAL '15 minutes';
    END IF;

    -- Return lockout status based on attempt counts
    RETURN QUERY SELECT 
        (v_user_attempts >= 5 OR v_ip_attempts >= 10) AS is_locked,
        CASE 
            WHEN v_user_attempts >= 5 THEN NOW() + INTERVAL '15 minutes'
            WHEN v_ip_attempts >= 10 THEN NOW() + INTERVAL '30 minutes'
            ELSE NULL
        END AS lockout_until,
        CASE 
            WHEN v_user_attempts >= 5 THEN 'Too many failed login attempts'
            WHEN v_ip_attempts >= 10 THEN 'Too many attempts from this IP'
            ELSE NULL
        END AS reason,
        GREATEST(v_user_attempts, v_ip_attempts) AS attempt_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record security event
CREATE OR REPLACE FUNCTION record_security_event(
    p_user_id UUID,
    p_event_type TEXT,
    p_ip_address INET,
    p_user_agent TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
    v_risk_score INTEGER := 0;
    v_country_code TEXT;
BEGIN
    -- Generate event ID
    v_event_id := gen_random_uuid();
    
    -- Calculate basic risk score
    CASE p_event_type
        WHEN 'failed_login' THEN v_risk_score := 30;
        WHEN 'suspicious_activity' THEN v_risk_score := 70;
        WHEN 'breach_detected' THEN v_risk_score := 90;
        ELSE v_risk_score := 10;
    END CASE;

    -- Insert security event
    INSERT INTO account_security_events (
        id, user_id, event_type, ip_address, user_agent,
        risk_score, metadata, created_at
    ) VALUES (
        v_event_id, p_user_id, p_event_type, p_ip_address, p_user_agent,
        v_risk_score, p_metadata, NOW()
    );

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired tokens and old data
CREATE OR REPLACE FUNCTION cleanup_password_security_data()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER := 0;
    v_temp_count INTEGER;
BEGIN
    -- Clean up expired password reset tokens
    DELETE FROM password_reset_tokens
    WHERE expires_at < NOW() - INTERVAL '24 hours';
    
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_deleted_count := v_deleted_count + v_temp_count;

    -- Clean up old security events (keep 6 months)
    DELETE FROM account_security_events
    WHERE created_at < NOW() - INTERVAL '6 months'
        AND event_type NOT IN ('account_locked', 'suspicious_activity');
    
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_deleted_count := v_deleted_count + v_temp_count;

    -- Clean up very old password history (keep 2 years max)
    DELETE FROM user_password_history
    WHERE created_at < NOW() - INTERVAL '2 years';
    
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_deleted_count := v_deleted_count + v_temp_count;

    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get password policy for user role
CREATE OR REPLACE FUNCTION get_password_policy(p_user_id UUID)
RETURNS TABLE (
    min_length INTEGER,
    max_length INTEGER,
    require_complexity BOOLEAN,
    check_breaches BOOLEAN,
    prevent_reuse INTEGER,
    role_name TEXT
) AS $$
DECLARE
    v_user_role TEXT;
BEGIN
    -- Get user's primary role
    SELECT ur.role INTO v_user_role
    FROM user_roles ur
    WHERE ur.user_id = p_user_id
        AND ur.is_primary = TRUE
    LIMIT 1;

    -- Default to 'user' if no role found
    v_user_role := COALESCE(v_user_role, 'user');

    -- Return policy based on role
    RETURN QUERY SELECT
        CASE v_user_role
            WHEN 'admin' THEN 12
            WHEN 'business_owner' THEN 10
            ELSE 8
        END AS min_length,
        128 AS max_length,
        CASE v_user_role
            WHEN 'admin' THEN TRUE
            ELSE FALSE
        END AS require_complexity,
        TRUE AS check_breaches,
        CASE v_user_role
            WHEN 'admin' THEN 12
            WHEN 'business_owner' THEN 8
            ELSE 5
        END AS prevent_reuse,
        v_user_role AS role_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================================
-- TRIGGERS AND AUTOMATION
-- =====================================================================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_security_incidents_updated_at
    BEFORE UPDATE ON security_incidents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically log password events
CREATE OR REPLACE FUNCTION log_password_event() 
RETURNS TRIGGER AS $$
BEGIN
    -- Log password changes to audit table
    IF TG_OP = 'UPDATE' AND OLD.encrypted_password != NEW.encrypted_password THEN
        INSERT INTO password_audit_logs (
            user_id, event_type, ip_address, user_agent,
            triggered_by, created_at
        ) VALUES (
            NEW.id, 'password_changed', 
            COALESCE(current_setting('app.current_ip', true)::INET, '0.0.0.0'::INET),
            current_setting('app.current_user_agent', true),
            'user', NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users for password changes
CREATE TRIGGER log_password_changes
    AFTER UPDATE OF encrypted_password ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION log_password_event();

COMMIT;

-- =====================================================================================
-- COMMENTS AND DOCUMENTATION
-- =====================================================================================

COMMENT ON TABLE user_password_history IS 'Tracks password history to prevent reuse of recent passwords';
COMMENT ON TABLE account_security_events IS 'Logs security events for monitoring and account lockout management';
COMMENT ON TABLE password_reset_tokens IS 'Manages secure password reset tokens with enhanced security features';
COMMENT ON TABLE security_incidents IS 'Records and tracks security incidents requiring investigation';
COMMENT ON TABLE password_audit_logs IS 'Comprehensive audit logging for password-related events and compliance';

COMMENT ON FUNCTION check_account_lockout IS 'Checks if an account is locked due to security policies';
COMMENT ON FUNCTION record_security_event IS 'Records a security event for monitoring and analysis';
COMMENT ON FUNCTION cleanup_password_security_data IS 'Periodic cleanup of expired and old security data';
COMMENT ON FUNCTION get_password_policy IS 'Returns password policy requirements based on user role';