-- Migration: 007_auth_functions_rbac
-- Epic 2 Story 2.1: Authentication Functions and RBAC Implementation
-- Description: JWT custom claims, helper functions, and RBAC utilities
-- Date: 2025-01-25
-- Author: Backend Architecture Expert

BEGIN;

-- =====================================================
-- JWT CUSTOM CLAIMS FUNCTION
-- =====================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS auth.custom_jwt_claims() CASCADE;

-- Custom JWT claims function for RBAC
CREATE OR REPLACE FUNCTION auth.custom_jwt_claims()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    claims JSONB;
    user_roles TEXT[];
    user_permissions TEXT[];
    owned_businesses UUID[];
    subscription_info JSONB;
    profile_data JSONB;
BEGIN
    -- Get user roles
    SELECT COALESCE(array_agg(DISTINCT r.name), ARRAY[]::TEXT[])
    INTO user_roles
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW());
    
    -- Get user permissions based on roles
    SELECT COALESCE(array_agg(DISTINCT p.resource || ':' || p.action), ARRAY[]::TEXT[])
    INTO user_permissions
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW());
    
    -- Get owned businesses
    SELECT COALESCE(array_agg(id), ARRAY[]::UUID[])
    INTO owned_businesses
    FROM businesses
    WHERE owner_id = auth.uid()
        AND status = 'active';
    
    -- Get subscription information
    SELECT jsonb_build_object(
        'tier', COALESCE(subscription_tier, 'free'),
        'valid_until', subscription_valid_until,
        'features', COALESCE(premium_features, '{}'::jsonb)
    )
    INTO subscription_info
    FROM businesses
    WHERE owner_id = auth.uid()
        AND status = 'active'
    ORDER BY 
        CASE subscription_tier 
            WHEN 'enterprise' THEN 1
            WHEN 'elite' THEN 2
            WHEN 'premium' THEN 3
            WHEN 'starter' THEN 4
            ELSE 5
        END
    LIMIT 1;
    
    -- Get profile information
    SELECT jsonb_build_object(
        'username', username,
        'display_name', display_name,
        'avatar_url', avatar_url,
        'email_verified', email_verified,
        'phone_verified', phone_verified,
        'account_status', account_status
    )
    INTO profile_data
    FROM profiles
    WHERE id = auth.uid();
    
    -- Build claims object
    SELECT jsonb_build_object(
        -- User identification
        'user_id', auth.uid(),
        'email', auth.email(),
        
        -- Profile data
        'profile', COALESCE(profile_data, '{}'::jsonb),
        
        -- RBAC data
        'roles', user_roles,
        'permissions', user_permissions,
        
        -- Business ownership
        'owned_businesses', owned_businesses,
        'business_count', array_length(owned_businesses, 1),
        
        -- Subscription data
        'subscription', COALESCE(subscription_info, jsonb_build_object('tier', 'free')),
        
        -- Security metadata
        'metadata', jsonb_build_object(
            'issued_at', extract(epoch from NOW())::integer,
            'session_id', gen_random_uuid(),
            'ip_address', inet_client_addr(),
            'user_agent', current_setting('request.headers', true)::jsonb->>'user-agent'
        )
    ) INTO claims;
    
    RETURN claims;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION auth.custom_jwt_claims() TO authenticated;

-- =====================================================
-- USER ROLE MANAGEMENT FUNCTIONS
-- =====================================================

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.user_has_role(
    check_user_id UUID,
    role_name VARCHAR(50),
    scope_type VARCHAR(50) DEFAULT 'global',
    scope_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = check_user_id
            AND r.name = role_name
            AND ur.is_active = true
            AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
            AND (
                (scope_type = 'global' AND ur.scope_type IS NULL) OR
                (ur.scope_type = scope_type AND ur.scope_id = scope_id)
            )
    );
END;
$$;

-- Function to check if user has a specific permission
CREATE OR REPLACE FUNCTION public.user_has_permission(
    check_user_id UUID,
    resource VARCHAR(100),
    action VARCHAR(50)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = check_user_id
            AND p.resource = resource
            AND p.action = action
            AND ur.is_active = true
            AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    );
END;
$$;

-- Function to assign a role to a user
CREATE OR REPLACE FUNCTION public.assign_user_role(
    target_user_id UUID,
    role_name VARCHAR(50),
    scope_type VARCHAR(50) DEFAULT 'global',
    scope_id UUID DEFAULT NULL,
    expires_in INTERVAL DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    role_record RECORD;
    new_role_id UUID;
BEGIN
    -- Check if the executing user has permission to assign roles
    IF NOT user_has_permission(auth.uid(), 'roles', 'manage') THEN
        RAISE EXCEPTION 'Insufficient permissions to assign roles';
    END IF;
    
    -- Get the role
    SELECT * INTO role_record
    FROM roles
    WHERE name = role_name AND is_assignable = true;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Role % not found or not assignable', role_name;
    END IF;
    
    -- Insert the role assignment
    INSERT INTO user_roles (
        user_id, role_id, granted_by, scope_type, scope_id, expires_at
    ) VALUES (
        target_user_id, 
        role_record.id, 
        auth.uid(), 
        scope_type, 
        scope_id,
        CASE WHEN expires_in IS NOT NULL THEN NOW() + expires_in ELSE NULL END
    )
    RETURNING id INTO new_role_id;
    
    -- Log the action
    INSERT INTO auth_audit_logs (
        event_type, event_category, user_id, target_user_id,
        event_data, success
    ) VALUES (
        'role_assigned', 'permission', auth.uid(), target_user_id,
        jsonb_build_object('role', role_name, 'scope_type', scope_type, 'scope_id', scope_id),
        true
    );
    
    RETURN new_role_id;
END;
$$;

-- =====================================================
-- AUTHENTICATION HELPER FUNCTIONS
-- =====================================================

-- Function to handle user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    default_role_id UUID;
BEGIN
    -- Create profile for new user
    INSERT INTO public.profiles (id, email_verified)
    VALUES (NEW.id, COALESCE(NEW.email_verified, false));
    
    -- Assign default 'user' role
    SELECT id INTO default_role_id FROM public.roles WHERE name = 'user';
    
    IF default_role_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role_id)
        VALUES (NEW.id, default_role_id);
    END IF;
    
    -- Log the registration
    INSERT INTO public.auth_audit_logs (
        event_type, event_category, user_id, event_data, success
    ) VALUES (
        'user_registered', 'login', NEW.id,
        jsonb_build_object('email', NEW.email, 'provider', NEW.aud),
        true
    );
    
    RETURN NEW;
END;
$$;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Function to update profile timestamps
CREATE OR REPLACE FUNCTION public.update_profile_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Create trigger for profile updates
DROP TRIGGER IF EXISTS update_profiles_timestamp ON public.profiles;
CREATE TRIGGER update_profiles_timestamp
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_profile_timestamp();

-- =====================================================
-- SESSION MANAGEMENT FUNCTIONS
-- =====================================================

-- Function to create a new session
CREATE OR REPLACE FUNCTION public.create_user_session(
    p_user_id UUID,
    p_device_info JSONB DEFAULT '{}'::jsonb,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE(session_id UUID, session_token VARCHAR(255), refresh_token VARCHAR(255))
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id UUID;
    v_session_token VARCHAR(255);
    v_refresh_token VARCHAR(255);
BEGIN
    -- Generate tokens
    v_session_id := gen_random_uuid();
    v_session_token := encode(gen_random_bytes(32), 'hex');
    v_refresh_token := encode(gen_random_bytes(32), 'hex');
    
    -- Insert session
    INSERT INTO public.user_sessions (
        id, user_id, session_token, refresh_token,
        device_id, device_type, device_name,
        browser, os, ip_address, user_agent
    ) VALUES (
        v_session_id, p_user_id, v_session_token, v_refresh_token,
        p_device_info->>'device_id',
        p_device_info->>'device_type',
        p_device_info->>'device_name',
        p_device_info->>'browser',
        p_device_info->>'os',
        p_ip_address,
        p_user_agent
    );
    
    -- Update last login in profile
    UPDATE public.profiles
    SET last_login_at = NOW(), last_login_ip = p_ip_address
    WHERE id = p_user_id;
    
    -- Log the login
    INSERT INTO public.auth_audit_logs (
        event_type, event_category, user_id, session_id,
        event_data, ip_address, user_agent, success
    ) VALUES (
        'user_login', 'login', p_user_id, v_session_id,
        p_device_info, p_ip_address, p_user_agent, true
    );
    
    RETURN QUERY SELECT v_session_id, v_session_token, v_refresh_token;
END;
$$;

-- Function to validate and refresh session
CREATE OR REPLACE FUNCTION public.refresh_user_session(
    p_refresh_token VARCHAR(255)
)
RETURNS TABLE(session_token VARCHAR(255), refresh_token VARCHAR(255))
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session RECORD;
    v_new_session_token VARCHAR(255);
    v_new_refresh_token VARCHAR(255);
BEGIN
    -- Find the session
    SELECT * INTO v_session
    FROM public.user_sessions
    WHERE refresh_token = p_refresh_token
        AND is_active = true
        AND expires_at > NOW();
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired refresh token';
    END IF;
    
    -- Generate new tokens
    v_new_session_token := encode(gen_random_bytes(32), 'hex');
    v_new_refresh_token := encode(gen_random_bytes(32), 'hex');
    
    -- Update session
    UPDATE public.user_sessions
    SET session_token = v_new_session_token,
        refresh_token = v_new_refresh_token,
        last_activity_at = NOW(),
        expires_at = NOW() + INTERVAL '7 days'
    WHERE id = v_session.id;
    
    RETURN QUERY SELECT v_new_session_token, v_new_refresh_token;
END;
$$;

-- =====================================================
-- MFA FUNCTIONS
-- =====================================================

-- Function to enable MFA for a user
CREATE OR REPLACE FUNCTION public.enable_mfa(
    p_user_id UUID,
    p_mfa_type VARCHAR(20),
    p_secret TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_secret TEXT;
    v_backup_codes TEXT[];
BEGIN
    -- Generate secret if not provided
    IF p_secret IS NULL THEN
        v_secret := encode(gen_random_bytes(20), 'base32');
    ELSE
        v_secret := p_secret;
    END IF;
    
    -- Generate backup codes
    SELECT array_agg(encode(gen_random_bytes(4), 'hex'))
    INTO v_backup_codes
    FROM generate_series(1, 10);
    
    -- Update or insert MFA config
    INSERT INTO public.auth_mfa_config (
        user_id, mfa_enabled,
        totp_enabled, totp_secret_encrypted,
        backup_codes_encrypted, backup_codes_generated_at
    ) VALUES (
        p_user_id, true,
        CASE WHEN p_mfa_type = 'totp' THEN true ELSE false END,
        CASE WHEN p_mfa_type = 'totp' THEN pgp_sym_encrypt(v_secret, current_setting('app.encryption_key')) ELSE NULL END,
        ARRAY(SELECT pgp_sym_encrypt(code, current_setting('app.encryption_key')) FROM unnest(v_backup_codes) AS code),
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        mfa_enabled = true,
        totp_enabled = CASE WHEN p_mfa_type = 'totp' THEN true ELSE auth_mfa_config.totp_enabled END,
        totp_secret_encrypted = CASE WHEN p_mfa_type = 'totp' THEN pgp_sym_encrypt(v_secret, current_setting('app.encryption_key')) ELSE auth_mfa_config.totp_secret_encrypted END,
        backup_codes_encrypted = ARRAY(SELECT pgp_sym_encrypt(code, current_setting('app.encryption_key')) FROM unnest(v_backup_codes) AS code),
        backup_codes_generated_at = NOW();
    
    -- Log the action
    INSERT INTO public.auth_audit_logs (
        event_type, event_category, user_id, event_data, success
    ) VALUES (
        'mfa_enabled', 'mfa', p_user_id,
        jsonb_build_object('mfa_type', p_mfa_type),
        true
    );
    
    RETURN jsonb_build_object(
        'secret', v_secret,
        'backup_codes', v_backup_codes,
        'qr_code', 'otpauth://totp/LawlessDirectory:' || auth.email() || '?secret=' || v_secret || '&issuer=LawlessDirectory'
    );
END;
$$;

-- Function to verify MFA code
CREATE OR REPLACE FUNCTION public.verify_mfa_code(
    p_user_id UUID,
    p_code VARCHAR(10),
    p_challenge_type VARCHAR(20)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_challenge RECORD;
    v_is_valid BOOLEAN := false;
BEGIN
    -- Get active challenge
    SELECT * INTO v_challenge
    FROM public.auth_mfa_challenges
    WHERE user_id = p_user_id
        AND challenge_type = p_challenge_type
        AND verified = false
        AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Check attempts
    IF v_challenge.attempts >= v_challenge.max_attempts THEN
        RAISE EXCEPTION 'Maximum attempts exceeded';
    END IF;
    
    -- Increment attempts
    UPDATE public.auth_mfa_challenges
    SET attempts = attempts + 1
    WHERE id = v_challenge.id;
    
    -- Verify code (simplified - in production use proper TOTP library)
    IF p_code = v_challenge.challenge_code THEN
        v_is_valid := true;
        
        -- Mark as verified
        UPDATE public.auth_mfa_challenges
        SET verified = true, verified_at = NOW()
        WHERE id = v_challenge.id;
        
        -- Update MFA config
        UPDATE public.auth_mfa_config
        SET last_used_method = p_challenge_type, last_used_at = NOW()
        WHERE user_id = p_user_id;
        
        -- Log success
        INSERT INTO public.auth_audit_logs (
            event_type, event_category, user_id, event_data, success
        ) VALUES (
            'mfa_verified', 'mfa', p_user_id,
            jsonb_build_object('challenge_type', p_challenge_type),
            true
        );
    ELSE
        -- Log failure
        INSERT INTO public.auth_audit_logs (
            event_type, event_category, user_id, event_data, success
        ) VALUES (
            'mfa_failed', 'mfa', p_user_id,
            jsonb_build_object('challenge_type', p_challenge_type, 'attempts', v_challenge.attempts + 1),
            false
        );
    END IF;
    
    RETURN v_is_valid;
END;
$$;

-- =====================================================
-- RATE LIMITING FUNCTIONS
-- =====================================================

-- Function to check and update rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_identifier VARCHAR(255),
    p_identifier_type VARCHAR(50),
    p_action VARCHAR(100),
    p_max_attempts INTEGER,
    p_window_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_attempts INTEGER;
    v_window_start TIMESTAMPTZ;
    v_is_allowed BOOLEAN := true;
BEGIN
    v_window_start := NOW() - (p_window_minutes || ' minutes')::INTERVAL;
    
    -- Get current attempts in window
    SELECT COALESCE(SUM(attempts), 0)
    INTO v_current_attempts
    FROM public.rate_limits
    WHERE identifier = p_identifier
        AND identifier_type = p_identifier_type
        AND action = p_action
        AND window_start >= v_window_start
        AND is_blocked = false;
    
    -- Check if limit exceeded
    IF v_current_attempts >= p_max_attempts THEN
        v_is_allowed := false;
        
        -- Block the identifier
        UPDATE public.rate_limits
        SET is_blocked = true,
            blocked_until = NOW() + (p_window_minutes || ' minutes')::INTERVAL
        WHERE identifier = p_identifier
            AND identifier_type = p_identifier_type
            AND action = p_action
            AND window_start >= v_window_start;
        
        -- Log security event
        INSERT INTO public.security_events (
            event_type, severity, description, details
        ) VALUES (
            'rate_limit_exceeded', 'medium',
            'Rate limit exceeded for ' || p_action,
            jsonb_build_object(
                'identifier', p_identifier,
                'identifier_type', p_identifier_type,
                'action', p_action,
                'attempts', v_current_attempts
            )
        );
    ELSE
        -- Record the attempt
        INSERT INTO public.rate_limits (
            identifier, identifier_type, action, attempts, max_attempts,
            window_start, window_end
        ) VALUES (
            p_identifier, p_identifier_type, p_action, 1, p_max_attempts,
            NOW(), NOW() + (p_window_minutes || ' minutes')::INTERVAL
        )
        ON CONFLICT (identifier, action, window_start) DO UPDATE
        SET attempts = rate_limits.attempts + 1;
    END IF;
    
    RETURN v_is_allowed;
END;
$$;

-- =====================================================
-- SECURITY MONITORING FUNCTIONS
-- =====================================================

-- Function to detect suspicious activity
CREATE OR REPLACE FUNCTION public.detect_suspicious_activity(
    p_user_id UUID,
    p_ip_address INET,
    p_user_agent TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_suspicious BOOLEAN := false;
    v_recent_ips INTEGER;
    v_failed_attempts INTEGER;
BEGIN
    -- Check for multiple IPs in short time
    SELECT COUNT(DISTINCT ip_address)
    INTO v_recent_ips
    FROM public.user_sessions
    WHERE user_id = p_user_id
        AND created_at >= NOW() - INTERVAL '1 hour';
    
    IF v_recent_ips > 3 THEN
        v_is_suspicious := true;
    END IF;
    
    -- Check failed login attempts
    SELECT COUNT(*)
    INTO v_failed_attempts
    FROM public.auth_audit_logs
    WHERE user_id = p_user_id
        AND event_type = 'login_failed'
        AND created_at >= NOW() - INTERVAL '30 minutes';
    
    IF v_failed_attempts > 5 THEN
        v_is_suspicious := true;
    END IF;
    
    -- Log if suspicious
    IF v_is_suspicious THEN
        INSERT INTO public.security_events (
            event_type, severity, user_id, description, details, ip_address, user_agent
        ) VALUES (
            'suspicious_activity', 'high', p_user_id,
            'Suspicious activity detected',
            jsonb_build_object(
                'recent_ips', v_recent_ips,
                'failed_attempts', v_failed_attempts
            ),
            p_ip_address, p_user_agent
        );
    END IF;
    
    RETURN v_is_suspicious;
END;
$$;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant necessary permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.user_has_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_permission TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_user_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.enable_mfa TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_mfa_code TO authenticated;

-- Grant permissions to service role for admin functions
GRANT EXECUTE ON FUNCTION public.assign_user_role TO service_role;
GRANT EXECUTE ON FUNCTION public.detect_suspicious_activity TO service_role;
GRANT EXECUTE ON FUNCTION public.check_rate_limit TO service_role;

COMMIT;
