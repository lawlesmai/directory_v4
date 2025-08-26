-- Migration: 011_onboarding_email_verification
-- Epic 2 Story 2.5: User Onboarding and Email Verification Infrastructure
-- Description: Comprehensive email verification and user onboarding system
-- Date: 2025-08-26
-- Author: Backend Developer

BEGIN;

-- =====================================================
-- EMAIL VERIFICATION SYSTEM
-- =====================================================

-- Email verification tokens and requests
CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Token details
    token VARCHAR(255) UNIQUE NOT NULL,
    token_hash TEXT NOT NULL, -- SHA-256 hash for security
    
    -- Email context
    email_address VARCHAR(255) NOT NULL,
    verification_type VARCHAR(20) NOT NULL DEFAULT 'registration' CHECK (
        verification_type IN ('registration', 'email_change', 'password_reset', 'account_recovery')
    ),
    
    -- Verification status
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    verification_ip INET,
    verification_user_agent TEXT,
    
    -- Security and rate limiting
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    
    -- Lifecycle
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
    resent_count INTEGER DEFAULT 0,
    last_resent_at TIMESTAMPTZ,
    
    -- Tracking
    clicked_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    bounced BOOLEAN DEFAULT FALSE,
    bounce_reason TEXT,
    
    INDEX idx_email_verification_user (user_id),
    INDEX idx_email_verification_token (token),
    INDEX idx_email_verification_email (email_address),
    INDEX idx_email_verification_expires (expires_at) WHERE is_verified = FALSE
);

-- Email delivery tracking and analytics
CREATE TABLE IF NOT EXISTS public.email_delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_token_id UUID REFERENCES public.email_verification_tokens(id) ON DELETE CASCADE,
    
    -- Email details
    recipient_email VARCHAR(255) NOT NULL,
    email_type VARCHAR(50) NOT NULL,
    email_template VARCHAR(100) NOT NULL,
    
    -- Delivery tracking
    status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (
        status IN ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'spam')
    ),
    
    -- Provider details
    provider VARCHAR(50) DEFAULT 'supabase', -- 'supabase', 'sendgrid', 'ses', etc.
    provider_message_id VARCHAR(255),
    provider_response JSONB DEFAULT '{}'::jsonb,
    
    -- Timing
    queued_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    
    -- Error handling
    error_code VARCHAR(50),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    
    -- Analytics
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    unique_opens INTEGER DEFAULT 0,
    unique_clicks INTEGER DEFAULT 0,
    
    INDEX idx_email_delivery_recipient (recipient_email),
    INDEX idx_email_delivery_status (status),
    INDEX idx_email_delivery_type (email_type),
    INDEX idx_email_delivery_created (queued_at DESC)
);

-- =====================================================
-- USER ONBOARDING WORKFLOW SYSTEM
-- =====================================================

-- Onboarding flow definitions (configurable workflows)
CREATE TABLE IF NOT EXISTS public.onboarding_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Flow identification
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Flow configuration
    flow_type VARCHAR(30) NOT NULL DEFAULT 'standard' CHECK (
        flow_type IN ('standard', 'business_owner', 'admin', 'custom')
    ),
    
    -- Flow settings
    is_active BOOLEAN DEFAULT TRUE,
    is_required BOOLEAN DEFAULT FALSE,
    allow_skip BOOLEAN DEFAULT TRUE,
    completion_required_for_access BOOLEAN DEFAULT FALSE,
    
    -- Steps configuration
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_steps INTEGER GENERATED ALWAYS AS (jsonb_array_length(steps)) STORED,
    
    -- Role and condition targeting
    target_roles TEXT[] DEFAULT '{}',
    target_conditions JSONB DEFAULT '{}'::jsonb,
    
    -- Completion tracking
    estimated_duration_minutes INTEGER DEFAULT 10,
    success_criteria JSONB DEFAULT '{}'::jsonb,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    INDEX idx_onboarding_flows_type (flow_type),
    INDEX idx_onboarding_flows_active (is_active)
);

-- User onboarding progress tracking
CREATE TABLE IF NOT EXISTS public.user_onboarding_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    flow_id UUID NOT NULL REFERENCES public.onboarding_flows(id) ON DELETE CASCADE,
    
    -- Progress tracking
    status VARCHAR(20) NOT NULL DEFAULT 'not_started' CHECK (
        status IN ('not_started', 'in_progress', 'completed', 'skipped', 'abandoned')
    ),
    
    -- Step tracking
    current_step_index INTEGER DEFAULT 0,
    completed_steps INTEGER[] DEFAULT '{}',
    skipped_steps INTEGER[] DEFAULT '{}',
    failed_steps JSONB DEFAULT '{}'::jsonb, -- step_index: failure_reason
    
    -- Progress calculation
    completion_percentage DECIMAL(5,2) DEFAULT 0.00 CHECK (completion_percentage BETWEEN 0 AND 100),
    
    -- Timing tracking
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    abandoned_at TIMESTAMPTZ,
    
    -- Session tracking
    sessions_count INTEGER DEFAULT 0,
    total_time_spent_minutes INTEGER DEFAULT 0,
    
    -- User engagement
    engagement_score DECIMAL(3,2) DEFAULT 0.50 CHECK (engagement_score BETWEEN 0 AND 1),
    
    -- Step-specific data storage
    step_data JSONB DEFAULT '{}'::jsonb,
    
    -- Completion requirements
    requirements_met JSONB DEFAULT '{}'::jsonb,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_user_flow UNIQUE(user_id, flow_id),
    INDEX idx_onboarding_progress_user (user_id),
    INDEX idx_onboarding_progress_flow (flow_id),
    INDEX idx_onboarding_progress_status (status),
    INDEX idx_onboarding_progress_completion (completion_percentage DESC)
);

-- Individual onboarding step completions (detailed tracking)
CREATE TABLE IF NOT EXISTS public.onboarding_step_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    progress_id UUID NOT NULL REFERENCES public.user_onboarding_progress(id) ON DELETE CASCADE,
    
    -- Step identification
    step_index INTEGER NOT NULL,
    step_name VARCHAR(100) NOT NULL,
    step_type VARCHAR(50) NOT NULL,
    
    -- Completion details
    status VARCHAR(20) NOT NULL CHECK (
        status IN ('completed', 'skipped', 'failed', 'attempted')
    ),
    
    -- Step data
    input_data JSONB DEFAULT '{}'::jsonb,
    validation_results JSONB DEFAULT '{}'::jsonb,
    
    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER GENERATED ALWAYS AS (
        EXTRACT(epoch FROM (completed_at - started_at))::integer
    ) STORED,
    
    -- Attempts tracking
    attempt_number INTEGER DEFAULT 1,
    total_attempts INTEGER DEFAULT 1,
    
    -- Error handling
    error_message TEXT,
    error_code VARCHAR(50),
    
    INDEX idx_step_completions_progress (progress_id),
    INDEX idx_step_completions_step (step_index, step_name),
    INDEX idx_step_completions_status (status)
);

-- =====================================================
-- WELCOME AND ENGAGEMENT SYSTEM
-- =====================================================

-- Welcome email sequences and campaigns
CREATE TABLE IF NOT EXISTS public.welcome_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Campaign details
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Campaign configuration
    campaign_type VARCHAR(30) NOT NULL DEFAULT 'welcome_series' CHECK (
        campaign_type IN ('welcome_series', 'onboarding_tips', 'feature_introduction', 'engagement_boost')
    ),
    
    -- Targeting
    target_audience VARCHAR(50) NOT NULL DEFAULT 'new_users' CHECK (
        target_audience IN ('new_users', 'business_owners', 'inactive_users', 'all_users')
    ),
    target_conditions JSONB DEFAULT '{}'::jsonb,
    
    -- Timing configuration
    emails JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of email configs with delays
    total_emails INTEGER GENERATED ALWAYS AS (jsonb_array_length(emails)) STORED,
    
    -- Campaign settings
    is_active BOOLEAN DEFAULT TRUE,
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    
    -- Performance tracking
    enrollment_count INTEGER DEFAULT 0,
    completion_count INTEGER DEFAULT 0,
    opt_out_count INTEGER DEFAULT 0,
    
    -- A/B testing
    is_test_campaign BOOLEAN DEFAULT FALSE,
    test_group VARCHAR(20), -- 'A', 'B', 'control'
    test_percentage DECIMAL(5,2) DEFAULT 100.00,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    INDEX idx_welcome_campaigns_active (is_active),
    INDEX idx_welcome_campaigns_audience (target_audience)
);

-- User enrollment in welcome campaigns
CREATE TABLE IF NOT EXISTS public.user_campaign_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES public.welcome_campaigns(id) ON DELETE CASCADE,
    
    -- Enrollment details
    status VARCHAR(20) NOT NULL DEFAULT 'enrolled' CHECK (
        status IN ('enrolled', 'active', 'completed', 'paused', 'opted_out', 'failed')
    ),
    
    -- Progress tracking
    current_email_index INTEGER DEFAULT 0,
    emails_sent INTEGER DEFAULT 0,
    emails_opened INTEGER DEFAULT 0,
    emails_clicked INTEGER DEFAULT 0,
    
    -- Scheduling
    next_email_scheduled_at TIMESTAMPTZ,
    last_email_sent_at TIMESTAMPTZ,
    
    -- Engagement tracking
    total_engagement_score DECIMAL(3,2) DEFAULT 0.00,
    
    -- Lifecycle
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    opted_out_at TIMESTAMPTZ,
    opt_out_reason VARCHAR(100),
    
    -- A/B testing assignment
    test_group VARCHAR(20),
    
    CONSTRAINT unique_user_campaign UNIQUE(user_id, campaign_id),
    INDEX idx_campaign_enrollments_user (user_id),
    INDEX idx_campaign_enrollments_campaign (campaign_id),
    INDEX idx_campaign_enrollments_status (status),
    INDEX idx_campaign_enrollments_scheduled (next_email_scheduled_at) WHERE next_email_scheduled_at IS NOT NULL
);

-- =====================================================
-- ACHIEVEMENT AND MILESTONE SYSTEM
-- =====================================================

-- Achievement definitions
CREATE TABLE IF NOT EXISTS public.achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Achievement details
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    
    -- Achievement type and category
    achievement_type VARCHAR(50) NOT NULL CHECK (
        achievement_type IN ('onboarding', 'engagement', 'social', 'business', 'milestone', 'special')
    ),
    category VARCHAR(50),
    
    -- Achievement criteria
    criteria JSONB NOT NULL, -- JSON definition of achievement requirements
    point_value INTEGER DEFAULT 0,
    
    -- Visual elements
    icon_url VARCHAR(500),
    badge_color VARCHAR(7) DEFAULT '#007bff',
    
    -- Rarity and difficulty
    rarity VARCHAR(20) DEFAULT 'common' CHECK (
        rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')
    ),
    difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 10),
    
    -- Unlock requirements
    prerequisite_achievements UUID[] DEFAULT '{}',
    minimum_user_level INTEGER DEFAULT 0,
    
    -- Settings
    is_active BOOLEAN DEFAULT TRUE,
    is_hidden BOOLEAN DEFAULT FALSE, -- Hidden until unlocked
    is_repeatable BOOLEAN DEFAULT FALSE,
    
    -- Statistics
    unlock_count INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    INDEX idx_achievements_type (achievement_type),
    INDEX idx_achievements_category (category),
    INDEX idx_achievements_active (is_active)
);

-- User achievements and progress
CREATE TABLE IF NOT EXISTS public.user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
    
    -- Achievement status
    status VARCHAR(20) NOT NULL DEFAULT 'locked' CHECK (
        status IN ('locked', 'in_progress', 'unlocked', 'completed')
    ),
    
    -- Progress tracking
    progress_data JSONB DEFAULT '{}'::jsonb,
    progress_percentage DECIMAL(5,2) DEFAULT 0.00 CHECK (progress_percentage BETWEEN 0 AND 100),
    
    -- Completion details
    unlocked_at TIMESTAMPTZ,
    points_earned INTEGER DEFAULT 0,
    
    -- Repeat tracking (for repeatable achievements)
    completion_count INTEGER DEFAULT 0,
    last_completed_at TIMESTAMPTZ,
    
    -- Notification status
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_seen BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_user_achievement UNIQUE(user_id, achievement_id),
    INDEX idx_user_achievements_user (user_id),
    INDEX idx_user_achievements_status (status),
    INDEX idx_user_achievements_unlocked (unlocked_at DESC) WHERE status = 'unlocked'
);

-- =====================================================
-- BUSINESS OWNER ONBOARDING AND VERIFICATION
-- =====================================================

-- Business verification documents and requirements
CREATE TABLE IF NOT EXISTS public.business_verification_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    
    -- Document details
    document_type VARCHAR(50) NOT NULL CHECK (
        document_type IN ('business_license', 'tax_id', 'registration_certificate', 
                         'incorporation_docs', 'operating_agreement', 'insurance', 'other')
    ),
    
    -- File information
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size_bytes INTEGER,
    mime_type VARCHAR(100),
    file_hash VARCHAR(64), -- SHA-256 hash for integrity
    
    -- Verification status
    verification_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
        verification_status IN ('pending', 'under_review', 'approved', 'rejected', 'expired')
    ),
    
    -- Review details
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    rejection_reason TEXT,
    
    -- Document metadata
    document_metadata JSONB DEFAULT '{}'::jsonb,
    expiry_date DATE,
    
    -- Security
    is_sensitive BOOLEAN DEFAULT TRUE,
    access_log JSONB DEFAULT '[]'::jsonb,
    
    -- Lifecycle
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX idx_business_docs_user (user_id),
    INDEX idx_business_docs_business (business_id),
    INDEX idx_business_docs_status (verification_status),
    INDEX idx_business_docs_type (document_type)
);

-- Business verification workflow tracking
CREATE TABLE IF NOT EXISTS public.business_verification_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    
    -- Workflow status
    status VARCHAR(30) NOT NULL DEFAULT 'not_started' CHECK (
        status IN ('not_started', 'document_upload', 'under_review', 'additional_info_required', 
                  'approved', 'rejected', 'suspended')
    ),
    
    -- Progress tracking
    steps_completed JSONB DEFAULT '{}'::jsonb,
    current_step VARCHAR(100),
    completion_percentage DECIMAL(5,2) DEFAULT 0.00,
    
    -- Requirements checklist
    requirements_met JSONB DEFAULT '{
        "business_license": false,
        "tax_id": false,
        "proof_of_address": false,
        "identity_verification": false,
        "phone_verification": false,
        "email_verification": false
    }'::jsonb,
    
    -- KYC (Know Your Customer) compliance
    kyc_status VARCHAR(20) DEFAULT 'not_started' CHECK (
        kyc_status IN ('not_started', 'in_progress', 'completed', 'failed')
    ),
    kyc_data JSONB DEFAULT '{}'::jsonb,
    kyc_score DECIMAL(3,2),
    
    -- Verification timeline
    started_at TIMESTAMPTZ,
    submitted_for_review_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    
    -- Review assignments
    assigned_reviewer UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ,
    priority_level INTEGER DEFAULT 3 CHECK (priority_level BETWEEN 1 AND 5),
    
    -- Communication log
    communications_log JSONB DEFAULT '[]'::jsonb,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_user_business_verification UNIQUE(user_id, business_id),
    INDEX idx_business_verification_user (user_id),
    INDEX idx_business_verification_business (business_id),
    INDEX idx_business_verification_status (status),
    INDEX idx_business_verification_reviewer (assigned_reviewer) WHERE assigned_reviewer IS NOT NULL
);

-- =====================================================
-- ANALYTICS AND REPORTING
-- =====================================================

-- Onboarding analytics aggregations
CREATE TABLE IF NOT EXISTS public.onboarding_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Time period
    date DATE NOT NULL,
    hour INTEGER CHECK (hour BETWEEN 0 AND 23),
    
    -- Flow metrics
    flow_id UUID REFERENCES public.onboarding_flows(id),
    flow_name VARCHAR(100),
    
    -- User metrics
    users_started INTEGER DEFAULT 0,
    users_completed INTEGER DEFAULT 0,
    users_abandoned INTEGER DEFAULT 0,
    completion_rate DECIMAL(5,2) DEFAULT 0.00,
    
    -- Step metrics
    step_completion_rates JSONB DEFAULT '{}'::jsonb,
    average_completion_time_minutes INTEGER,
    median_completion_time_minutes INTEGER,
    
    -- Engagement metrics
    total_sessions INTEGER DEFAULT 0,
    average_session_duration_minutes INTEGER,
    bounce_rate DECIMAL(5,2) DEFAULT 0.00,
    
    -- Conversion metrics
    email_to_registration_rate DECIMAL(5,2) DEFAULT 0.00,
    registration_to_completion_rate DECIMAL(5,2) DEFAULT 0.00,
    
    -- Device and source analytics
    device_breakdown JSONB DEFAULT '{}'::jsonb,
    traffic_source_breakdown JSONB DEFAULT '{}'::jsonb,
    
    -- A/B testing results
    test_variant_performance JSONB DEFAULT '{}'::jsonb,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_onboarding_analytics_period UNIQUE(date, hour, flow_id)
);

-- =====================================================
-- RATE LIMITING FOR ONBOARDING ACTIONS
-- =====================================================

-- Onboarding-specific rate limits
CREATE TABLE IF NOT EXISTS public.onboarding_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Target identification
    identifier VARCHAR(255) NOT NULL, -- user_id, email, or IP
    identifier_type VARCHAR(20) NOT NULL CHECK (
        identifier_type IN ('user_id', 'email', 'ip_address')
    ),
    
    -- Action being limited
    action VARCHAR(50) NOT NULL CHECK (
        action IN ('email_verification_send', 'email_resend', 'onboarding_step_attempt', 
                  'business_document_upload', 'verification_request')
    ),
    
    -- Limit tracking
    attempts INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    window_duration_minutes INTEGER NOT NULL,
    max_attempts INTEGER NOT NULL,
    
    -- Status
    is_blocked BOOLEAN DEFAULT FALSE,
    blocked_until TIMESTAMPTZ,
    
    -- Escalation handling
    escalation_level INTEGER DEFAULT 1,
    escalation_actions TEXT[] DEFAULT '{}',
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_onboarding_rate_limit UNIQUE(identifier, action, window_start)
);

-- =====================================================
-- INSERT DEFAULT DATA
-- =====================================================

-- Insert default onboarding flows
INSERT INTO public.onboarding_flows (name, display_name, description, flow_type, steps, target_roles) VALUES
    ('standard_user', 'Standard User Onboarding', 'Basic onboarding flow for new users', 'standard', 
     '[
        {"step": "welcome", "name": "Welcome", "type": "info", "required": true},
        {"step": "email_verification", "name": "Verify Email", "type": "verification", "required": true},
        {"step": "profile_setup", "name": "Complete Profile", "type": "form", "required": false},
        {"step": "preferences", "name": "Set Preferences", "type": "settings", "required": false},
        {"step": "tour", "name": "Platform Tour", "type": "tutorial", "required": false}
     ]'::jsonb, ARRAY['user']),
    
    ('business_owner', 'Business Owner Onboarding', 'Comprehensive onboarding for business owners', 'business_owner', 
     '[
        {"step": "welcome", "name": "Welcome Business Owner", "type": "info", "required": true},
        {"step": "email_verification", "name": "Verify Email", "type": "verification", "required": true},
        {"step": "business_profile", "name": "Business Information", "type": "form", "required": true},
        {"step": "verification_docs", "name": "Upload Verification Documents", "type": "upload", "required": true},
        {"step": "payment_setup", "name": "Payment Setup", "type": "form", "required": false},
        {"step": "business_tour", "name": "Business Features Tour", "type": "tutorial", "required": false}
     ]'::jsonb, ARRAY['business_owner'])
ON CONFLICT (name) DO NOTHING;

-- Insert default welcome campaigns
INSERT INTO public.welcome_campaigns (name, display_name, description, emails, target_audience) VALUES
    ('new_user_welcome', 'New User Welcome Series', 'Welcome series for new users',
     '[
        {"subject": "Welcome to the platform!", "template": "welcome_intro", "delay_hours": 0},
        {"subject": "Get started with your first review", "template": "first_steps", "delay_hours": 24},
        {"subject": "Discover local businesses", "template": "explore_features", "delay_hours": 72}
     ]'::jsonb, 'new_users'),
    
    ('business_owner_welcome', 'Business Owner Welcome Series', 'Welcome series for business owners',
     '[
        {"subject": "Welcome, Business Owner!", "template": "business_welcome", "delay_hours": 0},
        {"subject": "Complete your business verification", "template": "verification_reminder", "delay_hours": 12},
        {"subject": "Optimize your business listing", "template": "listing_tips", "delay_hours": 48}
     ]'::jsonb, 'business_owners')
ON CONFLICT (name) DO NOTHING;

-- Insert default achievements
INSERT INTO public.achievements (name, display_name, description, achievement_type, criteria, point_value) VALUES
    ('email_verified', 'Email Verified', 'Successfully verified your email address', 'onboarding', 
     '{"action": "email_verification", "required": true}'::jsonb, 10),
    ('profile_completed', 'Profile Complete', 'Completed your user profile', 'onboarding', 
     '{"profile_completion_percentage": 80}'::jsonb, 25),
    ('first_review', 'First Review', 'Posted your first business review', 'engagement', 
     '{"reviews_count": 1}'::jsonb, 50),
    ('onboarding_champion', 'Onboarding Champion', 'Completed the full onboarding process', 'milestone', 
     '{"onboarding_completion": 100}'::jsonb, 100)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- TRIGGERS AND FUNCTIONS
-- =====================================================

-- Function to update onboarding progress
CREATE OR REPLACE FUNCTION update_onboarding_progress()
RETURNS TRIGGER AS $$
BEGIN
    -- Update completion percentage based on completed steps
    UPDATE public.user_onboarding_progress 
    SET 
        completion_percentage = (array_length(completed_steps, 1) * 100.0) / 
            (SELECT total_steps FROM public.onboarding_flows WHERE id = flow_id),
        updated_at = NOW(),
        last_activity_at = NOW()
    WHERE id = NEW.progress_id;
    
    -- Check if onboarding is complete
    UPDATE public.user_onboarding_progress 
    SET 
        status = CASE 
            WHEN completion_percentage >= 100 THEN 'completed'
            WHEN completion_percentage > 0 THEN 'in_progress'
            ELSE status 
        END,
        completed_at = CASE 
            WHEN completion_percentage >= 100 AND completed_at IS NULL THEN NOW()
            ELSE completed_at 
        END
    WHERE id = NEW.progress_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update progress on step completion
CREATE TRIGGER update_onboarding_progress_trigger
    AFTER INSERT OR UPDATE ON public.onboarding_step_completions
    FOR EACH ROW EXECUTE FUNCTION update_onboarding_progress();

-- Function to generate onboarding analytics
CREATE OR REPLACE FUNCTION generate_onboarding_analytics()
RETURNS void AS $$
DECLARE
    current_date DATE := CURRENT_DATE;
    current_hour INTEGER := EXTRACT(hour FROM NOW());
    flow_record RECORD;
BEGIN
    -- Generate analytics for each active flow
    FOR flow_record IN SELECT id, name FROM public.onboarding_flows WHERE is_active = true LOOP
        INSERT INTO public.onboarding_analytics (
            date, hour, flow_id, flow_name,
            users_started, users_completed, users_abandoned,
            completion_rate, average_completion_time_minutes
        )
        SELECT 
            current_date, current_hour, flow_record.id, flow_record.name,
            COUNT(*) FILTER (WHERE status IN ('in_progress', 'completed')),
            COUNT(*) FILTER (WHERE status = 'completed'),
            COUNT(*) FILTER (WHERE status = 'abandoned'),
            CASE 
                WHEN COUNT(*) FILTER (WHERE status IN ('in_progress', 'completed')) > 0 THEN
                    (COUNT(*) FILTER (WHERE status = 'completed') * 100.0) / 
                    COUNT(*) FILTER (WHERE status IN ('in_progress', 'completed'))
                ELSE 0 
            END,
            AVG(EXTRACT(epoch FROM (completed_at - started_at)) / 60) FILTER (WHERE status = 'completed')
        FROM public.user_onboarding_progress
        WHERE flow_id = flow_record.id
        AND created_at >= current_date + (current_hour || ' hours')::interval 
        AND created_at < current_date + ((current_hour + 1) || ' hours')::interval
        ON CONFLICT (date, hour, flow_id) DO UPDATE SET
            users_started = EXCLUDED.users_started,
            users_completed = EXCLUDED.users_completed,
            users_abandoned = EXCLUDED.users_abandoned,
            completion_rate = EXCLUDED.completion_rate,
            average_completion_time_minutes = EXCLUDED.average_completion_time_minutes;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically enroll users in welcome campaigns
CREATE OR REPLACE FUNCTION auto_enroll_welcome_campaigns()
RETURNS TRIGGER AS $$
DECLARE
    campaign_record RECORD;
    user_role TEXT;
BEGIN
    -- Get user's primary role
    SELECT r.name INTO user_role
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = NEW.id AND ur.is_active = true
    ORDER BY r.hierarchy_level ASC
    LIMIT 1;
    
    -- Enroll user in appropriate welcome campaigns
    FOR campaign_record IN 
        SELECT * FROM public.welcome_campaigns 
        WHERE is_active = true 
        AND start_date <= NOW() 
        AND (end_date IS NULL OR end_date > NOW())
        AND (
            target_audience = 'all_users' OR
            (target_audience = 'new_users' AND user_role = 'user') OR
            (target_audience = 'business_owners' AND user_role = 'business_owner')
        )
    LOOP
        INSERT INTO public.user_campaign_enrollments (user_id, campaign_id, next_email_scheduled_at)
        VALUES (NEW.id, campaign_record.id, NOW())
        ON CONFLICT (user_id, campaign_id) DO NOTHING;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-enroll users in welcome campaigns (triggers on profile creation)
CREATE TRIGGER auto_enroll_welcome_campaigns_trigger
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION auto_enroll_welcome_campaigns();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_step_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.welcome_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_campaign_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_verification_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_rate_limits ENABLE ROW LEVEL SECURITY;

-- Email verification tokens - users can only see their own
CREATE POLICY email_verification_user_policy ON public.email_verification_tokens
    FOR ALL USING (user_id = auth.uid());

-- User onboarding progress - users can see their own, admins can see all
CREATE POLICY onboarding_progress_policy ON public.user_onboarding_progress
    FOR SELECT USING (
        user_id = auth.uid() OR 
        auth.uid() IN (
            SELECT ur.user_id FROM public.user_roles ur 
            JOIN public.roles r ON r.id = ur.role_id 
            WHERE r.name IN ('admin', 'super_admin') AND ur.is_active = true
        )
    );

-- Step completions follow progress policy
CREATE POLICY step_completions_policy ON public.onboarding_step_completions
    FOR SELECT USING (
        progress_id IN (
            SELECT id FROM public.user_onboarding_progress 
            WHERE user_id = auth.uid()
        ) OR 
        auth.uid() IN (
            SELECT ur.user_id FROM public.user_roles ur 
            JOIN public.roles r ON r.id = ur.role_id 
            WHERE r.name IN ('admin', 'super_admin') AND ur.is_active = true
        )
    );

-- User achievements - users can see their own
CREATE POLICY user_achievements_policy ON public.user_achievements
    FOR ALL USING (user_id = auth.uid());

-- Business verification documents - business owners can see their own, admins can see all
CREATE POLICY business_docs_policy ON public.business_verification_documents
    FOR ALL USING (
        user_id = auth.uid() OR 
        auth.uid() IN (
            SELECT ur.user_id FROM public.user_roles ur 
            JOIN public.roles r ON r.id = ur.role_id 
            WHERE r.name IN ('admin', 'super_admin') AND ur.is_active = true
        )
    );

-- Campaign enrollments - users can see their own
CREATE POLICY campaign_enrollments_policy ON public.user_campaign_enrollments
    FOR ALL USING (user_id = auth.uid());

-- Public read access for flows, campaigns, and achievements
CREATE POLICY onboarding_flows_read_policy ON public.onboarding_flows
    FOR SELECT USING (is_active = true);

CREATE POLICY welcome_campaigns_read_policy ON public.welcome_campaigns
    FOR SELECT USING (is_active = true);

CREATE POLICY achievements_read_policy ON public.achievements
    FOR SELECT USING (is_active = true);

-- Analytics - only admins can access
CREATE POLICY analytics_admin_policy ON public.onboarding_analytics
    FOR ALL USING (
        auth.uid() IN (
            SELECT ur.user_id FROM public.user_roles ur 
            JOIN public.roles r ON r.id = ur.role_id 
            WHERE r.name IN ('admin', 'super_admin') AND ur.is_active = true
        )
    );

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Additional performance indexes
CREATE INDEX idx_user_onboarding_progress_user_status ON public.user_onboarding_progress(user_id, status);
CREATE INDEX idx_user_onboarding_progress_updated ON public.user_onboarding_progress(updated_at DESC);
CREATE INDEX idx_email_verification_tokens_expires ON public.email_verification_tokens(expires_at) WHERE is_verified = FALSE;
CREATE INDEX idx_business_verification_workflows_assigned ON public.business_verification_workflows(assigned_reviewer, status) WHERE assigned_reviewer IS NOT NULL;
CREATE INDEX idx_user_campaign_enrollments_scheduled ON public.user_campaign_enrollments(next_email_scheduled_at) WHERE status = 'active';
CREATE INDEX idx_onboarding_step_completions_timing ON public.onboarding_step_completions(completed_at, duration_seconds);

COMMIT;