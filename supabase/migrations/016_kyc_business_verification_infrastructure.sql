-- Migration: 016_kyc_business_verification_infrastructure
-- Epic 2 Story 2.9: Comprehensive Business Owner Verification & KYC System
-- Description: Complete KYC and business verification infrastructure with compliance monitoring
-- Date: 2025-08-26
-- Author: Backend Developer

BEGIN;

-- =====================================================
-- CORE KYC TABLES
-- =====================================================

-- Document types for KYC verification
CREATE TABLE IF NOT EXISTS public.kyc_document_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_code VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Document configuration
    category VARCHAR(30) NOT NULL CHECK (category IN (
        'identity', 'business_license', 'tax_document', 'address_verification',
        'financial_document', 'professional_license', 'other'
    )),
    required_for_verification BOOLEAN DEFAULT FALSE,
    auto_processable BOOLEAN DEFAULT FALSE, -- Can be processed via OCR/API
    
    -- Validation rules
    accepted_formats TEXT[] DEFAULT ARRAY['pdf', 'jpg', 'jpeg', 'png', 'tiff'],
    max_file_size_mb INTEGER DEFAULT 10,
    min_resolution_dpi INTEGER DEFAULT 300,
    expiration_required BOOLEAN DEFAULT FALSE,
    
    -- Compliance settings
    retention_years INTEGER DEFAULT 7,
    requires_manual_review BOOLEAN DEFAULT FALSE,
    fraud_detection_enabled BOOLEAN DEFAULT TRUE,
    
    -- System flags
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Identity verification providers
CREATE TABLE IF NOT EXISTS public.identity_verification_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_code VARCHAR(50) UNIQUE NOT NULL,
    provider_name VARCHAR(100) NOT NULL,
    
    -- Provider configuration
    api_endpoint VARCHAR(500),
    api_version VARCHAR(20),
    supported_countries TEXT[] DEFAULT ARRAY['US'],
    supported_document_types TEXT[],
    
    -- Capabilities
    supports_biometric BOOLEAN DEFAULT FALSE,
    supports_liveness_check BOOLEAN DEFAULT FALSE,
    supports_document_ocr BOOLEAN DEFAULT TRUE,
    supports_real_time_verification BOOLEAN DEFAULT TRUE,
    
    -- Performance metrics
    average_processing_time_seconds INTEGER DEFAULT 30,
    success_rate_percentage DECIMAL(5,2) DEFAULT 95.00,
    
    -- Cost and limits
    cost_per_verification DECIMAL(6,4), -- In USD
    monthly_quota INTEGER,
    rate_limit_per_minute INTEGER DEFAULT 60,
    
    -- Configuration and credentials (encrypted)
    configuration JSONB DEFAULT '{}'::jsonb,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Main KYC verification records
CREATE TABLE IF NOT EXISTS public.kyc_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    
    -- Verification details
    verification_type VARCHAR(30) NOT NULL CHECK (verification_type IN (
        'personal_identity', 'business_owner', 'business_entity', 'enhanced_due_diligence'
    )),
    verification_level VARCHAR(20) NOT NULL DEFAULT 'basic' CHECK (verification_level IN (
        'basic', 'enhanced', 'premium', 'institutional'
    )),
    
    -- Status tracking
    status VARCHAR(30) NOT NULL DEFAULT 'initiated' CHECK (status IN (
        'initiated', 'documents_required', 'documents_uploaded', 'under_review',
        'verification_pending', 'additional_info_required', 'approved',
        'rejected', 'expired', 'appealed', 'suspended'
    )),
    
    -- Workflow tracking
    initiated_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    decided_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    -- Decision making
    decision VARCHAR(20) CHECK (decision IN ('approved', 'rejected', 'pending')),
    decision_confidence DECIMAL(5,2) CHECK (decision_confidence BETWEEN 0 AND 100),
    decision_reason TEXT,
    decision_factors JSONB DEFAULT '{}'::jsonb,
    
    -- Risk assessment
    risk_level VARCHAR(20) DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    risk_score DECIMAL(5,2) CHECK (risk_score BETWEEN 0 AND 100),
    risk_factors JSONB DEFAULT '[]'::jsonb,
    
    -- Compliance requirements
    aml_status VARCHAR(20) DEFAULT 'pending' CHECK (aml_status IN ('pending', 'clear', 'flagged', 'escalated')),
    sanctions_check_status VARCHAR(20) DEFAULT 'pending' CHECK (sanctions_check_status IN ('pending', 'clear', 'flagged', 'escalated')),
    pep_check_status VARCHAR(20) DEFAULT 'pending' CHECK (pep_check_status IN ('pending', 'clear', 'flagged', 'escalated')),
    
    -- Processing metadata
    assigned_reviewer_id UUID REFERENCES auth.users(id),
    review_priority VARCHAR(10) DEFAULT 'normal' CHECK (review_priority IN ('low', 'normal', 'high', 'urgent')),
    estimated_completion TIMESTAMPTZ,
    
    -- Integration data
    external_verification_id VARCHAR(255),
    provider_id UUID REFERENCES identity_verification_providers(id),
    provider_response JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps and audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT kyc_valid_dates CHECK (
        (submitted_at IS NULL OR submitted_at >= initiated_at) AND
        (reviewed_at IS NULL OR reviewed_at >= submitted_at) AND
        (decided_at IS NULL OR decided_at >= reviewed_at)
    )
);

-- KYC document submissions
CREATE TABLE IF NOT EXISTS public.kyc_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id UUID NOT NULL REFERENCES kyc_verifications(id) ON DELETE CASCADE,
    document_type_id UUID NOT NULL REFERENCES kyc_document_types(id),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- Document information
    file_name VARCHAR(500) NOT NULL,
    original_file_name VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
    file_type VARCHAR(20) NOT NULL,
    file_hash VARCHAR(64) NOT NULL, -- SHA256 hash
    
    -- Document metadata
    upload_method VARCHAR(20) DEFAULT 'web' CHECK (upload_method IN ('web', 'mobile', 'api')),
    document_side VARCHAR(10) CHECK (document_side IN ('front', 'back', 'both', 'single')),
    document_quality_score DECIMAL(5,2) CHECK (document_quality_score BETWEEN 0 AND 100),
    
    -- OCR and processing results
    ocr_status VARCHAR(20) DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'processing', 'completed', 'failed')),
    ocr_results JSONB DEFAULT '{}'::jsonb,
    ocr_confidence DECIMAL(5,2) CHECK (ocr_confidence BETWEEN 0 AND 100),
    
    -- Extracted information
    extracted_data JSONB DEFAULT '{}'::jsonb,
    document_number VARCHAR(100),
    issuing_authority VARCHAR(200),
    issue_date DATE,
    expiry_date DATE,
    
    -- Validation results
    validation_status VARCHAR(20) DEFAULT 'pending' CHECK (validation_status IN (
        'pending', 'valid', 'invalid', 'expired', 'suspicious', 'requires_review'
    )),
    validation_checks JSONB DEFAULT '[]'::jsonb,
    fraud_indicators JSONB DEFAULT '[]'::jsonb,
    
    -- Review and approval
    review_status VARCHAR(20) DEFAULT 'pending' CHECK (review_status IN (
        'pending', 'approved', 'rejected', 'requires_resubmission'
    )),
    reviewer_id UUID REFERENCES auth.users(id),
    review_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    
    -- Security and encryption
    is_encrypted BOOLEAN DEFAULT TRUE,
    encryption_key_id VARCHAR(100),
    
    -- Audit trail
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Business verification workflow states
CREATE TABLE IF NOT EXISTS public.business_verification_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    kyc_verification_id UUID NOT NULL REFERENCES kyc_verifications(id),
    
    -- Workflow configuration
    workflow_type VARCHAR(30) NOT NULL DEFAULT 'standard' CHECK (workflow_type IN (
        'standard', 'expedited', 'enhanced', 'high_risk', 'manual_only'
    )),
    current_step VARCHAR(50) NOT NULL,
    total_steps INTEGER NOT NULL DEFAULT 7,
    completed_steps INTEGER DEFAULT 0,
    
    -- Required verifications checklist
    identity_verification_required BOOLEAN DEFAULT TRUE,
    identity_verification_completed BOOLEAN DEFAULT FALSE,
    
    business_license_required BOOLEAN DEFAULT TRUE,
    business_license_completed BOOLEAN DEFAULT FALSE,
    
    tax_verification_required BOOLEAN DEFAULT TRUE,
    tax_verification_completed BOOLEAN DEFAULT FALSE,
    
    address_verification_required BOOLEAN DEFAULT TRUE,
    address_verification_completed BOOLEAN DEFAULT FALSE,
    
    financial_verification_required BOOLEAN DEFAULT FALSE,
    financial_verification_completed BOOLEAN DEFAULT FALSE,
    
    -- Advanced verification steps
    biometric_verification_required BOOLEAN DEFAULT FALSE,
    biometric_verification_completed BOOLEAN DEFAULT FALSE,
    
    enhanced_due_diligence_required BOOLEAN DEFAULT FALSE,
    enhanced_due_diligence_completed BOOLEAN DEFAULT FALSE,
    
    -- Progress tracking
    progress_percentage DECIMAL(5,2) DEFAULT 0.00 CHECK (progress_percentage BETWEEN 0 AND 100),
    estimated_completion_time INTERVAL,
    next_action_required VARCHAR(200),
    next_action_due_date TIMESTAMPTZ,
    
    -- Workflow status
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN (
        'active', 'completed', 'failed', 'expired', 'cancelled', 'on_hold'
    )),
    
    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Risk assessment and scoring
CREATE TABLE IF NOT EXISTS public.kyc_risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id UUID NOT NULL REFERENCES kyc_verifications(id) ON DELETE CASCADE,
    
    -- Risk scoring
    overall_risk_score DECIMAL(5,2) NOT NULL CHECK (overall_risk_score BETWEEN 0 AND 100),
    risk_category VARCHAR(20) NOT NULL CHECK (risk_category IN ('low', 'medium', 'high', 'critical')),
    
    -- Component scores
    identity_risk_score DECIMAL(5,2) CHECK (identity_risk_score BETWEEN 0 AND 100),
    document_risk_score DECIMAL(5,2) CHECK (document_risk_score BETWEEN 0 AND 100),
    business_risk_score DECIMAL(5,2) CHECK (business_risk_score BETWEEN 0 AND 100),
    behavioral_risk_score DECIMAL(5,2) CHECK (behavioral_risk_score BETWEEN 0 AND 100),
    geographic_risk_score DECIMAL(5,2) CHECK (geographic_risk_score BETWEEN 0 AND 100),
    
    -- Risk factors
    risk_indicators JSONB NOT NULL DEFAULT '[]'::jsonb,
    mitigation_measures JSONB DEFAULT '[]'::jsonb,
    
    -- Compliance flags
    aml_risk_level VARCHAR(20) CHECK (aml_risk_level IN ('low', 'medium', 'high', 'critical')),
    sanctions_risk_detected BOOLEAN DEFAULT FALSE,
    pep_risk_detected BOOLEAN DEFAULT FALSE,
    adverse_media_found BOOLEAN DEFAULT FALSE,
    
    -- Machine learning insights
    ml_model_version VARCHAR(20),
    ml_confidence_score DECIMAL(5,2) CHECK (ml_confidence_score BETWEEN 0 AND 100),
    feature_importance JSONB DEFAULT '{}'::jsonb,
    
    -- Assessment metadata
    assessed_by VARCHAR(20) DEFAULT 'system' CHECK (assessed_by IN ('system', 'manual', 'hybrid')),
    assessor_id UUID REFERENCES auth.users(id),
    assessment_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance monitoring and reporting
CREATE TABLE IF NOT EXISTS public.kyc_compliance_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Report details
    report_type VARCHAR(30) NOT NULL CHECK (report_type IN (
        'daily_summary', 'weekly_summary', 'monthly_summary',
        'suspicious_activity', 'regulatory_filing', 'audit_report', 'custom'
    )),
    report_period_start DATE NOT NULL,
    report_period_end DATE NOT NULL,
    
    -- Report content
    total_verifications INTEGER DEFAULT 0,
    approved_verifications INTEGER DEFAULT 0,
    rejected_verifications INTEGER DEFAULT 0,
    pending_verifications INTEGER DEFAULT 0,
    
    -- Risk statistics
    high_risk_cases INTEGER DEFAULT 0,
    flagged_cases INTEGER DEFAULT 0,
    escalated_cases INTEGER DEFAULT 0,
    
    -- Compliance metrics
    aml_alerts INTEGER DEFAULT 0,
    sanctions_hits INTEGER DEFAULT 0,
    pep_matches INTEGER DEFAULT 0,
    adverse_media_alerts INTEGER DEFAULT 0,
    
    -- Processing metrics
    average_processing_time_hours DECIMAL(8,2),
    sla_compliance_percentage DECIMAL(5,2),
    auto_approval_rate DECIMAL(5,2),
    
    -- Report data
    detailed_data JSONB DEFAULT '{}'::jsonb,
    
    -- Generation info
    generated_by UUID REFERENCES auth.users(id),
    generation_method VARCHAR(20) DEFAULT 'automated' CHECK (generation_method IN ('automated', 'manual', 'scheduled')),
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'reviewed', 'filed', 'archived')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_report_period CHECK (report_period_end >= report_period_start)
);

-- Appeals and escalation management
CREATE TABLE IF NOT EXISTS public.kyc_appeals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id UUID NOT NULL REFERENCES kyc_verifications(id) ON DELETE CASCADE,
    appellant_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- Appeal details
    appeal_reason VARCHAR(50) NOT NULL CHECK (appeal_reason IN (
        'document_quality', 'processing_error', 'incorrect_rejection',
        'technical_issue', 'discrimination_claim', 'data_accuracy', 'other'
    )),
    appeal_description TEXT NOT NULL,
    supporting_evidence JSONB DEFAULT '[]'::jsonb,
    
    -- Appeal status
    status VARCHAR(20) DEFAULT 'submitted' CHECK (status IN (
        'submitted', 'under_review', 'additional_info_requested',
        'upheld', 'overturned', 'partially_upheld', 'dismissed'
    )),
    
    -- Review assignment
    assigned_reviewer_id UUID REFERENCES auth.users(id),
    review_priority VARCHAR(10) DEFAULT 'normal' CHECK (review_priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Timeline
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    review_started_at TIMESTAMPTZ,
    decision_at TIMESTAMPTZ,
    resolution_deadline TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
    
    -- Decision
    decision VARCHAR(20) CHECK (decision IN ('upheld', 'overturned', 'partially_upheld', 'dismissed')),
    decision_reason TEXT,
    corrective_actions JSONB DEFAULT '[]'::jsonb,
    
    -- Communication
    correspondence_log JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Administrative review queue
CREATE TABLE IF NOT EXISTS public.kyc_review_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id UUID NOT NULL REFERENCES kyc_verifications(id) ON DELETE CASCADE,
    
    -- Queue management
    queue_type VARCHAR(20) NOT NULL CHECK (queue_type IN (
        'standard', 'priority', 'high_risk', 'appeal', 'escalated', 'compliance'
    )),
    priority_score INTEGER DEFAULT 50 CHECK (priority_score BETWEEN 1 AND 100),
    
    -- Assignment
    assigned_to UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ,
    assignment_method VARCHAR(15) DEFAULT 'automatic' CHECK (assignment_method IN ('automatic', 'manual', 'escalated')),
    
    -- SLA tracking
    sla_target_hours INTEGER DEFAULT 24,
    deadline TIMESTAMPTZ,
    is_overdue BOOLEAN GENERATED ALWAYS AS (
        deadline IS NOT NULL AND deadline < NOW()
    ) STORED,
    
    -- Review tracking
    status VARCHAR(20) DEFAULT 'queued' CHECK (status IN (
        'queued', 'assigned', 'in_review', 'completed', 'escalated', 'cancelled'
    )),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Review notes
    reviewer_notes TEXT,
    review_actions JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SUPPORTING TABLES
-- =====================================================

-- Blacklisted entities and watchlists
CREATE TABLE IF NOT EXISTS public.kyc_watchlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Entity information
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('person', 'business', 'address', 'document', 'phone', 'email')),
    entity_value TEXT NOT NULL,
    entity_hash VARCHAR(64) NOT NULL, -- For privacy and fast lookup
    
    -- Watchlist details
    list_type VARCHAR(20) NOT NULL CHECK (list_type IN (
        'sanctions', 'pep', 'adverse_media', 'internal_blacklist', 'high_risk', 'fraud'
    )),
    list_source VARCHAR(100) NOT NULL,
    severity VARCHAR(10) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Additional information
    description TEXT,
    aliases TEXT[],
    associated_entities JSONB DEFAULT '[]'::jsonb,
    
    -- Effective period
    effective_from DATE DEFAULT CURRENT_DATE,
    effective_until DATE,
    
    -- Metadata
    added_by UUID REFERENCES auth.users(id),
    verification_required BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_entity_list UNIQUE (entity_hash, list_type)
);

-- KYC configuration and business rules
CREATE TABLE IF NOT EXISTS public.kyc_configuration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Configuration category
    category VARCHAR(30) NOT NULL CHECK (category IN (
        'verification_rules', 'risk_thresholds', 'processing_limits',
        'compliance_settings', 'automation_rules', 'notification_rules'
    )),
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB NOT NULL,
    
    -- Configuration metadata
    description TEXT,
    is_system_setting BOOLEAN DEFAULT FALSE,
    requires_restart BOOLEAN DEFAULT FALSE,
    
    -- Validation
    validation_schema JSONB,
    
    -- Environment and versioning
    environment VARCHAR(20) DEFAULT 'production' CHECK (environment IN ('development', 'staging', 'production')),
    version INTEGER DEFAULT 1,
    
    -- Audit
    modified_by UUID REFERENCES auth.users(id),
    modified_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_category_key UNIQUE (category, setting_key, environment)
);

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

-- KYC verifications indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_verifications_user 
    ON kyc_verifications(user_id) WHERE status != 'expired';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_verifications_business 
    ON kyc_verifications(business_id) WHERE business_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_verifications_status 
    ON kyc_verifications(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_verifications_risk 
    ON kyc_verifications(risk_level) WHERE risk_level IN ('high', 'critical');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_verifications_reviewer 
    ON kyc_verifications(assigned_reviewer_id) WHERE assigned_reviewer_id IS NOT NULL;

-- Documents indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_documents_verification 
    ON kyc_documents(verification_id) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_documents_hash 
    ON kyc_documents(file_hash);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_documents_review_status 
    ON kyc_documents(review_status) WHERE review_status = 'pending';

-- Workflow indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_verification_workflows_business 
    ON business_verification_workflows(business_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_verification_workflows_status 
    ON business_verification_workflows(status) WHERE status = 'active';

-- Review queue indexes  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_review_queue_assigned 
    ON kyc_review_queue(assigned_to) WHERE status = 'assigned';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_review_queue_priority 
    ON kyc_review_queue(priority_score DESC) WHERE status IN ('queued', 'assigned');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_review_queue_overdue 
    ON kyc_review_queue(deadline) WHERE is_overdue = true;

-- Risk assessments indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_risk_assessments_verification 
    ON kyc_risk_assessments(verification_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_risk_assessments_score 
    ON kyc_risk_assessments(overall_risk_score DESC);

-- Appeals indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_appeals_verification 
    ON kyc_appeals(verification_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_appeals_status 
    ON kyc_appeals(status) WHERE status IN ('submitted', 'under_review');

-- Watchlist indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_watchlists_hash 
    ON kyc_watchlists(entity_hash);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_watchlists_type 
    ON kyc_watchlists(list_type) WHERE effective_until IS NULL OR effective_until > CURRENT_DATE;

-- =====================================================
-- INITIAL DATA SETUP
-- =====================================================

-- Insert standard KYC document types
INSERT INTO kyc_document_types (type_code, display_name, description, category, required_for_verification, auto_processable, expiration_required) VALUES
    -- Identity documents
    ('drivers_license', 'Driver''s License', 'State-issued driver license', 'identity', true, true, true),
    ('passport', 'Passport', 'Government-issued passport', 'identity', true, true, true),
    ('state_id', 'State ID Card', 'State-issued identification card', 'identity', true, true, true),
    ('military_id', 'Military ID', 'Military identification card', 'identity', true, true, true),
    
    -- Business documents
    ('business_license', 'Business License', 'State business license or registration', 'business_license', true, true, false),
    ('articles_incorporation', 'Articles of Incorporation', 'Corporate formation documents', 'business_license', true, false, false),
    ('dba_certificate', 'DBA Certificate', 'Doing Business As certificate', 'business_license', false, true, false),
    ('operating_agreement', 'Operating Agreement', 'LLC operating agreement', 'business_license', false, false, false),
    
    -- Tax documents
    ('ein_letter', 'EIN Confirmation Letter', 'IRS Employer Identification Number letter', 'tax_document', true, true, false),
    ('tax_return_business', 'Business Tax Return', 'Business tax return (Form 1120, 1065, etc.)', 'tax_document', false, false, false),
    ('tax_return_personal', 'Personal Tax Return', 'Personal tax return (Form 1040)', 'tax_document', false, false, false),
    ('sales_tax_permit', 'Sales Tax Permit', 'State sales tax permit or license', 'tax_document', false, true, true),
    
    -- Address verification
    ('utility_bill', 'Utility Bill', 'Recent utility bill showing business address', 'address_verification', true, true, false),
    ('bank_statement', 'Bank Statement', 'Recent bank statement showing business address', 'address_verification', true, true, false),
    ('lease_agreement', 'Lease Agreement', 'Business premises lease agreement', 'address_verification', false, false, false),
    ('property_deed', 'Property Deed', 'Property ownership documents', 'address_verification', false, false, false),
    
    -- Financial documents
    ('bank_letter', 'Bank Reference Letter', 'Letter from business bank', 'financial_document', false, false, false),
    ('financial_statement', 'Financial Statement', 'Audited financial statements', 'financial_document', false, false, false),
    ('insurance_certificate', 'Insurance Certificate', 'Business insurance certificate', 'financial_document', false, true, true),
    
    -- Professional licenses
    ('professional_license', 'Professional License', 'Industry-specific professional license', 'professional_license', false, true, true),
    ('certification', 'Professional Certification', 'Professional certifications and credentials', 'professional_license', false, true, true)
ON CONFLICT (type_code) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Insert identity verification providers (placeholder configurations)
INSERT INTO identity_verification_providers (provider_code, provider_name, supported_countries, supported_document_types, supports_biometric, supports_liveness_check, is_active) VALUES
    ('jumio', 'Jumio', ARRAY['US', 'CA', 'GB', 'EU'], ARRAY['drivers_license', 'passport', 'state_id'], true, true, true),
    ('onfido', 'Onfido', ARRAY['US', 'CA', 'GB', 'EU', 'AU'], ARRAY['drivers_license', 'passport', 'state_id'], true, true, true),
    ('shufti_pro', 'Shufti Pro', ARRAY['US', 'CA', 'GB', 'EU', 'AS'], ARRAY['drivers_license', 'passport', 'state_id', 'military_id'], true, true, true),
    ('veriff', 'Veriff', ARRAY['US', 'CA', 'GB', 'EU'], ARRAY['drivers_license', 'passport', 'state_id'], true, true, true),
    ('trulioo', 'Trulioo', ARRAY['US', 'CA', 'GB', 'EU', 'AS', 'AF', 'SA'], ARRAY['drivers_license', 'passport', 'state_id'], false, false, true)
ON CONFLICT (provider_code) DO UPDATE SET
    provider_name = EXCLUDED.provider_name,
    updated_at = NOW();

-- Insert default KYC configuration settings
INSERT INTO kyc_configuration (category, setting_key, setting_value, description) VALUES
    ('verification_rules', 'min_documents_required', '2', 'Minimum number of documents required for verification'),
    ('verification_rules', 'identity_document_required', 'true', 'Whether identity document is mandatory'),
    ('verification_rules', 'business_license_required', 'true', 'Whether business license is mandatory'),
    ('verification_rules', 'address_verification_required', 'true', 'Whether address verification is mandatory'),
    ('verification_rules', 'max_resubmission_attempts', '3', 'Maximum document resubmission attempts'),
    
    ('risk_thresholds', 'low_risk_threshold', '25', 'Risk score threshold for low risk classification'),
    ('risk_thresholds', 'medium_risk_threshold', '60', 'Risk score threshold for medium risk classification'),
    ('risk_thresholds', 'high_risk_threshold', '80', 'Risk score threshold for high risk classification'),
    ('risk_thresholds', 'auto_approval_threshold', '20', 'Risk score threshold for automatic approval'),
    ('risk_thresholds', 'manual_review_threshold', '60', 'Risk score threshold requiring manual review'),
    
    ('processing_limits', 'max_file_size_mb', '10', 'Maximum file size for document uploads in MB'),
    ('processing_limits', 'supported_formats', '["pdf", "jpg", "jpeg", "png", "tiff"]', 'Supported file formats for document uploads'),
    ('processing_limits', 'max_daily_verifications', '100', 'Maximum verifications processed per day'),
    ('processing_limits', 'processing_timeout_minutes', '30', 'Timeout for verification processing'),
    
    ('compliance_settings', 'retention_period_years', '7', 'Document retention period in years'),
    ('compliance_settings', 'aml_screening_enabled', 'true', 'Enable AML screening'),
    ('compliance_settings', 'sanctions_screening_enabled', 'true', 'Enable sanctions list screening'),
    ('compliance_settings', 'pep_screening_enabled', 'true', 'Enable PEP screening'),
    ('compliance_settings', 'adverse_media_screening_enabled', 'true', 'Enable adverse media screening'),
    
    ('automation_rules', 'auto_ocr_enabled', 'true', 'Enable automatic OCR processing'),
    ('automation_rules', 'auto_verification_enabled', 'true', 'Enable automatic verification for low-risk cases'),
    ('automation_rules', 'fraud_detection_enabled', 'true', 'Enable automatic fraud detection'),
    ('automation_rules', 'duplicate_detection_enabled', 'true', 'Enable duplicate document detection'),
    
    ('notification_rules', 'notify_on_approval', 'true', 'Send notification on verification approval'),
    ('notification_rules', 'notify_on_rejection', 'true', 'Send notification on verification rejection'),
    ('notification_rules', 'notify_on_document_required', 'true', 'Send notification when additional documents are required'),
    ('notification_rules', 'escalation_notification_enabled', 'true', 'Enable escalation notifications'),
    ('notification_rules', 'sla_breach_notification_enabled', 'true', 'Enable SLA breach notifications')
ON CONFLICT (category, setting_key, environment) DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    modified_at = NOW();

COMMIT;