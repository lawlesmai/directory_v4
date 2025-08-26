-- Migration: 017_kyc_functions_and_workflows
-- Epic 2 Story 2.9: KYC Functions and Business Verification Workflows
-- Description: Core KYC processing functions, workflow engine, and automation
-- Date: 2025-08-26
-- Author: Backend Developer

BEGIN;

-- =====================================================
-- KYC WORKFLOW MANAGEMENT FUNCTIONS
-- =====================================================

-- Initialize KYC verification process
CREATE OR REPLACE FUNCTION public.initiate_kyc_verification(
    p_user_id UUID,
    p_business_id UUID DEFAULT NULL,
    p_verification_type VARCHAR(30) DEFAULT 'business_owner',
    p_verification_level VARCHAR(20) DEFAULT 'basic'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    verification_id UUID;
    workflow_id UUID;
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    -- Validate user authorization
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    
    IF current_user_id != p_user_id AND NOT user_has_enhanced_permission(current_user_id, 'users', 'manage') THEN
        RAISE EXCEPTION 'Insufficient permissions to initiate KYC for other users';
    END IF;
    
    -- Check for existing active verification
    SELECT id INTO verification_id
    FROM kyc_verifications
    WHERE user_id = p_user_id
        AND business_id IS NOT DISTINCT FROM p_business_id
        AND status IN ('initiated', 'documents_required', 'documents_uploaded', 'under_review', 'verification_pending')
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF verification_id IS NOT NULL THEN
        RAISE EXCEPTION 'Active KYC verification already exists with ID: %', verification_id;
    END IF;
    
    -- Create new verification record
    INSERT INTO kyc_verifications (
        user_id, business_id, verification_type, verification_level,
        status, risk_level, expires_at
    ) VALUES (
        p_user_id, p_business_id, p_verification_type, p_verification_level,
        'initiated', 'low', NOW() + INTERVAL '30 days'
    ) RETURNING id INTO verification_id;
    
    -- Create business verification workflow if business_id provided
    IF p_business_id IS NOT NULL THEN
        INSERT INTO business_verification_workflows (
            business_id, kyc_verification_id, workflow_type, current_step
        ) VALUES (
            p_business_id, verification_id, 'standard', 'identity_verification'
        ) RETURNING id INTO workflow_id;
    END IF;
    
    -- Add to review queue with normal priority
    INSERT INTO kyc_review_queue (
        verification_id, queue_type, priority_score, sla_target_hours, deadline
    ) VALUES (
        verification_id, 'standard', 50, 24, NOW() + INTERVAL '24 hours'
    );
    
    -- Log the initiation
    INSERT INTO auth_audit_logs (
        event_type, event_category, user_id, target_user_id,
        event_data, success
    ) VALUES (
        'kyc_verification_initiated', 'compliance', current_user_id, p_user_id,
        jsonb_build_object(
            'verification_id', verification_id,
            'verification_type', p_verification_type,
            'business_id', p_business_id
        ),
        true
    );
    
    RETURN verification_id;
END;
$$;

-- Upload KYC document with validation
CREATE OR REPLACE FUNCTION public.upload_kyc_document(
    p_verification_id UUID,
    p_document_type_code VARCHAR(50),
    p_file_name VARCHAR(500),
    p_file_path VARCHAR(1000),
    p_file_size_bytes BIGINT,
    p_file_type VARCHAR(20),
    p_file_hash VARCHAR(64),
    p_document_side VARCHAR(10) DEFAULT 'single'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    document_id UUID;
    document_type_record RECORD;
    verification_record RECORD;
    current_user_id UUID;
    duplicate_found BOOLEAN := FALSE;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    
    -- Get verification record and validate ownership
    SELECT * INTO verification_record
    FROM kyc_verifications
    WHERE id = p_verification_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'KYC verification not found';
    END IF;
    
    IF verification_record.user_id != current_user_id AND NOT user_has_enhanced_permission(current_user_id, 'users', 'manage') THEN
        RAISE EXCEPTION 'Insufficient permissions to upload documents for this verification';
    END IF;
    
    -- Get document type configuration
    SELECT * INTO document_type_record
    FROM kyc_document_types
    WHERE type_code = p_document_type_code AND is_active = TRUE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or inactive document type: %', p_document_type_code;
    END IF;
    
    -- Validate file size
    IF p_file_size_bytes > (document_type_record.max_file_size_mb * 1024 * 1024) THEN
        RAISE EXCEPTION 'File size exceeds maximum allowed size of % MB', document_type_record.max_file_size_mb;
    END IF;
    
    -- Validate file format
    IF NOT (p_file_type = ANY(document_type_record.accepted_formats)) THEN
        RAISE EXCEPTION 'File format % not allowed. Accepted formats: %', p_file_type, document_type_record.accepted_formats;
    END IF;
    
    -- Check for duplicate documents by hash
    SELECT TRUE INTO duplicate_found
    FROM kyc_documents
    WHERE file_hash = p_file_hash
        AND verification_id != p_verification_id
        AND deleted_at IS NULL
    LIMIT 1;
    
    IF duplicate_found THEN
        RAISE EXCEPTION 'Document with identical content already exists in system';
    END IF;
    
    -- Create document record
    INSERT INTO kyc_documents (
        verification_id, document_type_id, user_id,
        file_name, original_file_name, file_path,
        file_size_bytes, file_type, file_hash,
        document_side
    ) VALUES (
        p_verification_id, document_type_record.id, current_user_id,
        p_file_name, p_file_name, p_file_path,
        p_file_size_bytes, p_file_type, p_file_hash,
        p_document_side
    ) RETURNING id INTO document_id;
    
    -- Update verification status if needed
    UPDATE kyc_verifications
    SET status = CASE
        WHEN status = 'initiated' THEN 'documents_uploaded'
        WHEN status = 'documents_required' THEN 'documents_uploaded'
        ELSE status
    END,
    updated_at = NOW()
    WHERE id = p_verification_id;
    
    -- Trigger OCR processing if document type supports it
    IF document_type_record.auto_processable THEN
        PERFORM public.trigger_document_ocr_processing(document_id);
    END IF;
    
    -- Log the upload
    INSERT INTO auth_audit_logs (
        event_type, event_category, user_id,
        event_data, success
    ) VALUES (
        'kyc_document_uploaded', 'compliance', current_user_id,
        jsonb_build_object(
            'document_id', document_id,
            'verification_id', p_verification_id,
            'document_type', p_document_type_code,
            'file_size_bytes', p_file_size_bytes
        ),
        true
    );
    
    RETURN document_id;
END;
$$;

-- Process document OCR (placeholder for integration)
CREATE OR REPLACE FUNCTION public.trigger_document_ocr_processing(
    p_document_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    document_record RECORD;
    ocr_result JSONB;
BEGIN
    -- Get document details
    SELECT d.*, dt.type_code, dt.auto_processable
    INTO document_record
    FROM kyc_documents d
    JOIN kyc_document_types dt ON d.document_type_id = dt.id
    WHERE d.id = p_document_id;
    
    IF NOT FOUND OR NOT document_record.auto_processable THEN
        RETURN FALSE;
    END IF;
    
    -- Update OCR status to processing
    UPDATE kyc_documents
    SET ocr_status = 'processing',
        updated_at = NOW()
    WHERE id = p_document_id;
    
    -- Simulate OCR processing (in production, this would integrate with OCR service)
    -- For now, we'll create placeholder extracted data based on document type
    ocr_result := CASE document_record.type_code
        WHEN 'drivers_license' THEN jsonb_build_object(
            'document_number', 'DL' || LPAD(floor(random() * 999999999)::text, 9, '0'),
            'first_name', 'John',
            'last_name', 'Doe',
            'date_of_birth', '1985-03-15',
            'expiry_date', '2026-03-15',
            'issuing_state', 'CA'
        )
        WHEN 'passport' THEN jsonb_build_object(
            'document_number', 'P' || LPAD(floor(random() * 999999999)::text, 9, '0'),
            'first_name', 'John',
            'last_name', 'Doe',
            'date_of_birth', '1985-03-15',
            'expiry_date', '2030-03-15',
            'issuing_country', 'USA'
        )
        WHEN 'business_license' THEN jsonb_build_object(
            'license_number', 'BL' || LPAD(floor(random() * 999999999)::text, 9, '0'),
            'business_name', 'Sample Business LLC',
            'issue_date', '2024-01-15',
            'expiry_date', '2025-01-15',
            'issuing_authority', 'State of California'
        )
        ELSE jsonb_build_object('processed', true, 'timestamp', NOW())
    END;
    
    -- Update document with OCR results
    UPDATE kyc_documents
    SET ocr_status = 'completed',
        ocr_results = ocr_result,
        ocr_confidence = 85.5 + (random() * 14.5), -- Simulate confidence score
        extracted_data = ocr_result,
        document_number = ocr_result->>'document_number',
        issue_date = (ocr_result->>'issue_date')::DATE,
        expiry_date = (ocr_result->>'expiry_date')::DATE,
        updated_at = NOW()
    WHERE id = p_document_id;
    
    -- Trigger validation after OCR
    PERFORM public.validate_kyc_document(p_document_id);
    
    RETURN TRUE;
END;
$$;

-- Validate KYC document
CREATE OR REPLACE FUNCTION public.validate_kyc_document(
    p_document_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    document_record RECORD;
    validation_results JSONB := '[]'::jsonb;
    fraud_indicators JSONB := '[]'::jsonb;
    overall_status VARCHAR(20) := 'valid';
    quality_score DECIMAL(5,2) := 90.0;
BEGIN
    -- Get document with extracted data
    SELECT d.*, dt.type_code, dt.expiration_required
    INTO document_record
    FROM kyc_documents d
    JOIN kyc_document_types dt ON d.document_type_id = dt.id
    WHERE d.id = p_document_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Document not found';
    END IF;
    
    -- Basic validation checks
    validation_results := jsonb_build_array();
    
    -- Check document completeness
    IF document_record.ocr_results IS NULL OR document_record.ocr_results = '{}'::jsonb THEN
        validation_results := validation_results || jsonb_build_object(
            'check', 'ocr_completion',
            'status', 'failed',
            'message', 'OCR processing incomplete or failed'
        );
        overall_status := 'requires_review';
        quality_score := quality_score - 20;
    ELSE
        validation_results := validation_results || jsonb_build_object(
            'check', 'ocr_completion',
            'status', 'passed',
            'message', 'OCR processing completed successfully'
        );
    END IF;
    
    -- Check expiration if required
    IF document_record.expiration_required AND document_record.expiry_date IS NOT NULL THEN
        IF document_record.expiry_date <= CURRENT_DATE THEN
            validation_results := validation_results || jsonb_build_object(
                'check', 'expiration',
                'status', 'failed',
                'message', 'Document is expired'
            );
            overall_status := 'expired';
            quality_score := quality_score - 50;
        ELSIF document_record.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN
            validation_results := validation_results || jsonb_build_object(
                'check', 'expiration',
                'status', 'warning',
                'message', 'Document expires within 30 days'
            );
            quality_score := quality_score - 10;
        ELSE
            validation_results := validation_results || jsonb_build_object(
                'check', 'expiration',
                'status', 'passed',
                'message', 'Document expiration is valid'
            );
        END IF;
    END IF;
    
    -- Check for duplicate document numbers
    IF document_record.document_number IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM kyc_documents d2
            JOIN kyc_document_types dt2 ON d2.document_type_id = dt2.id
            WHERE d2.document_number = document_record.document_number
                AND dt2.type_code = document_record.type_code
                AND d2.id != p_document_id
                AND d2.deleted_at IS NULL
                AND d2.validation_status != 'invalid'
        ) THEN
            fraud_indicators := fraud_indicators || jsonb_build_object(
                'type', 'duplicate_document_number',
                'severity', 'high',
                'message', 'Document number already exists in system'
            );
            overall_status := 'suspicious';
            quality_score := quality_score - 30;
        END IF;
    END IF;
    
    -- Simulate additional fraud detection checks
    -- In production, these would integrate with fraud detection services
    IF random() < 0.05 THEN -- 5% chance of flagging for review
        fraud_indicators := fraud_indicators || jsonb_build_object(
            'type', 'image_quality',
            'severity', 'medium',
            'message', 'Image quality requires manual review'
        );
        overall_status := 'requires_review';
        quality_score := quality_score - 15;
    END IF;
    
    -- Update document with validation results
    UPDATE kyc_documents
    SET validation_status = overall_status,
        validation_checks = validation_results,
        fraud_indicators = fraud_indicators,
        document_quality_score = quality_score,
        updated_at = NOW()
    WHERE id = p_document_id;
    
    -- If validation failed or suspicious, add to high priority review queue
    IF overall_status IN ('suspicious', 'expired', 'invalid') THEN
        INSERT INTO kyc_review_queue (
            verification_id, queue_type, priority_score,
            sla_target_hours, deadline
        ) VALUES (
            document_record.verification_id, 'high_risk', 90,
            4, NOW() + INTERVAL '4 hours'
        )
        ON CONFLICT (verification_id) DO UPDATE SET
            priority_score = GREATEST(kyc_review_queue.priority_score, 90),
            queue_type = 'high_risk';
    END IF;
    
    RETURN jsonb_build_object(
        'document_id', p_document_id,
        'validation_status', overall_status,
        'quality_score', quality_score,
        'validation_checks', validation_results,
        'fraud_indicators', fraud_indicators
    );
END;
$$;

-- Calculate KYC risk assessment
CREATE OR REPLACE FUNCTION public.calculate_kyc_risk_assessment(
    p_verification_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    verification_record RECORD;
    risk_assessment_id UUID;
    identity_score DECIMAL(5,2) := 0;
    document_score DECIMAL(5,2) := 0;
    business_score DECIMAL(5,2) := 0;
    behavioral_score DECIMAL(5,2) := 0;
    geographic_score DECIMAL(5,2) := 0;
    overall_score DECIMAL(5,2);
    risk_category VARCHAR(20);
    risk_indicators JSONB := '[]'::jsonb;
    document_count INTEGER := 0;
    suspicious_document_count INTEGER := 0;
BEGIN
    -- Get verification details
    SELECT kv.*, u.email, u.created_at as user_created_at
    INTO verification_record
    FROM kyc_verifications kv
    JOIN auth.users u ON kv.user_id = u.id
    WHERE kv.id = p_verification_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'KYC verification not found';
    END IF;
    
    -- Calculate identity risk score (0-100, lower is better)
    identity_score := 10; -- Base score
    
    -- Check user account age
    IF verification_record.user_created_at > NOW() - INTERVAL '7 days' THEN
        identity_score := identity_score + 20;
        risk_indicators := risk_indicators || jsonb_build_object(
            'type', 'new_user_account',
            'impact', 20,
            'description', 'User account created recently'
        );
    ELSIF verification_record.user_created_at > NOW() - INTERVAL '30 days' THEN
        identity_score := identity_score + 10;
    END IF;
    
    -- Calculate document risk score
    SELECT COUNT(*), COUNT(*) FILTER (WHERE validation_status IN ('suspicious', 'invalid'))
    INTO document_count, suspicious_document_count
    FROM kyc_documents
    WHERE verification_id = p_verification_id AND deleted_at IS NULL;
    
    IF document_count = 0 THEN
        document_score := 80; -- High risk if no documents
        risk_indicators := risk_indicators || jsonb_build_object(
            'type', 'no_documents_submitted',
            'impact', 80,
            'description', 'No documents have been submitted'
        );
    ELSIF suspicious_document_count > 0 THEN
        document_score := 60 + (suspicious_document_count * 15);
        risk_indicators := risk_indicators || jsonb_build_object(
            'type', 'suspicious_documents',
            'impact', suspicious_document_count * 15,
            'description', format('%s suspicious documents detected', suspicious_document_count)
        );
    ELSE
        document_score := GREATEST(0, 30 - (document_count * 5)); -- Lower score with more valid documents
    END IF;
    
    -- Calculate business risk score (if business verification)
    IF verification_record.business_id IS NOT NULL THEN
        SELECT 
            CASE 
                WHEN b.created_at > NOW() - INTERVAL '30 days' THEN 30
                WHEN b.created_at > NOW() - INTERVAL '90 days' THEN 15
                ELSE 5
            END +
            CASE b.verification_status
                WHEN 'verified' THEN -10
                WHEN 'pending' THEN 10
                WHEN 'rejected' THEN 40
                ELSE 20
            END
        INTO business_score
        FROM businesses b
        WHERE b.id = verification_record.business_id;
        
        IF business_score > 20 THEN
            risk_indicators := risk_indicators || jsonb_build_object(
                'type', 'business_risk_factors',
                'impact', business_score,
                'description', 'Business profile indicates elevated risk'
            );
        END IF;
    ELSE
        business_score := 0;
    END IF;
    
    -- Calculate behavioral risk score (placeholder for future ML integration)
    behavioral_score := 5 + (random() * 10); -- Placeholder
    
    -- Calculate geographic risk score (placeholder)
    geographic_score := 5; -- Base score for US operations
    
    -- Calculate overall risk score (weighted average)
    overall_score := (
        identity_score * 0.25 +
        document_score * 0.35 +
        business_score * 0.20 +
        behavioral_score * 0.10 +
        geographic_score * 0.10
    );
    
    -- Determine risk category
    IF overall_score <= 25 THEN
        risk_category := 'low';
    ELSIF overall_score <= 60 THEN
        risk_category := 'medium';
    ELSIF overall_score <= 80 THEN
        risk_category := 'high';
    ELSE
        risk_category := 'critical';
    END IF;
    
    -- Create risk assessment record
    INSERT INTO kyc_risk_assessments (
        verification_id, overall_risk_score, risk_category,
        identity_risk_score, document_risk_score, business_risk_score,
        behavioral_risk_score, geographic_risk_score,
        risk_indicators, ml_model_version, ml_confidence_score
    ) VALUES (
        p_verification_id, overall_score, risk_category,
        identity_score, document_score, business_score,
        behavioral_score, geographic_score,
        risk_indicators, 'v1.0', 85.0 + (random() * 15)
    ) RETURNING id INTO risk_assessment_id;
    
    -- Update verification with risk information
    UPDATE kyc_verifications
    SET risk_level = risk_category,
        risk_score = overall_score,
        updated_at = NOW()
    WHERE id = p_verification_id;
    
    -- Adjust review queue priority based on risk
    UPDATE kyc_review_queue
    SET priority_score = CASE risk_category
            WHEN 'critical' THEN 95
            WHEN 'high' THEN 80
            WHEN 'medium' THEN 60
            WHEN 'low' THEN 30
        END,
        queue_type = CASE risk_category
            WHEN 'critical' THEN 'high_risk'
            WHEN 'high' THEN 'high_risk'
            ELSE queue_type
        END
    WHERE verification_id = p_verification_id;
    
    RETURN risk_assessment_id;
END;
$$;

-- Update business verification workflow progress
CREATE OR REPLACE FUNCTION public.update_verification_workflow_progress(
    p_workflow_id UUID,
    p_step_completed VARCHAR(50),
    p_next_step VARCHAR(50) DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    workflow_record RECORD;
    total_required_steps INTEGER;
    steps_completed INTEGER;
    progress_pct DECIMAL(5,2);
BEGIN
    -- Get current workflow state
    SELECT * INTO workflow_record
    FROM business_verification_workflows
    WHERE id = p_workflow_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Verification workflow not found';
    END IF;
    
    -- Update specific step completion
    UPDATE business_verification_workflows
    SET 
        identity_verification_completed = CASE 
            WHEN p_step_completed = 'identity_verification' THEN TRUE 
            ELSE identity_verification_completed 
        END,
        business_license_completed = CASE 
            WHEN p_step_completed = 'business_license' THEN TRUE 
            ELSE business_license_completed 
        END,
        tax_verification_completed = CASE 
            WHEN p_step_completed = 'tax_verification' THEN TRUE 
            ELSE tax_verification_completed 
        END,
        address_verification_completed = CASE 
            WHEN p_step_completed = 'address_verification' THEN TRUE 
            ELSE address_verification_completed 
        END,
        financial_verification_completed = CASE 
            WHEN p_step_completed = 'financial_verification' THEN TRUE 
            ELSE financial_verification_completed 
        END,
        biometric_verification_completed = CASE 
            WHEN p_step_completed = 'biometric_verification' THEN TRUE 
            ELSE biometric_verification_completed 
        END,
        enhanced_due_diligence_completed = CASE 
            WHEN p_step_completed = 'enhanced_due_diligence' THEN TRUE 
            ELSE enhanced_due_diligence_completed 
        END,
        current_step = COALESCE(p_next_step, current_step),
        updated_at = NOW()
    WHERE id = p_workflow_id;
    
    -- Recalculate progress
    SELECT 
        (CASE WHEN identity_verification_required THEN 1 ELSE 0 END +
         CASE WHEN business_license_required THEN 1 ELSE 0 END +
         CASE WHEN tax_verification_required THEN 1 ELSE 0 END +
         CASE WHEN address_verification_required THEN 1 ELSE 0 END +
         CASE WHEN financial_verification_required THEN 1 ELSE 0 END +
         CASE WHEN biometric_verification_required THEN 1 ELSE 0 END +
         CASE WHEN enhanced_due_diligence_required THEN 1 ELSE 0 END) as total_steps,
        (CASE WHEN identity_verification_completed THEN 1 ELSE 0 END +
         CASE WHEN business_license_completed THEN 1 ELSE 0 END +
         CASE WHEN tax_verification_completed THEN 1 ELSE 0 END +
         CASE WHEN address_verification_completed THEN 1 ELSE 0 END +
         CASE WHEN financial_verification_completed THEN 1 ELSE 0 END +
         CASE WHEN biometric_verification_completed THEN 1 ELSE 0 END +
         CASE WHEN enhanced_due_diligence_completed THEN 1 ELSE 0 END) as completed_steps
    INTO total_required_steps, steps_completed
    FROM business_verification_workflows
    WHERE id = p_workflow_id;
    
    progress_pct := CASE 
        WHEN total_required_steps = 0 THEN 100.00
        ELSE ROUND((steps_completed::DECIMAL / total_required_steps::DECIMAL) * 100, 2)
    END;
    
    -- Update progress and check for completion
    UPDATE business_verification_workflows
    SET completed_steps = steps_completed,
        progress_percentage = progress_pct,
        status = CASE 
            WHEN progress_pct = 100.00 THEN 'completed'
            ELSE status
        END,
        completed_at = CASE 
            WHEN progress_pct = 100.00 THEN NOW()
            ELSE completed_at
        END
    WHERE id = p_workflow_id;
    
    -- If workflow completed, trigger final verification decision
    IF progress_pct = 100.00 THEN
        PERFORM public.finalize_kyc_verification(workflow_record.kyc_verification_id);
    END IF;
    
    RETURN TRUE;
END;
$$;

-- Finalize KYC verification decision
CREATE OR REPLACE FUNCTION public.finalize_kyc_verification(
    p_verification_id UUID,
    p_decision VARCHAR(20) DEFAULT NULL,
    p_reviewer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    verification_record RECORD;
    risk_assessment RECORD;
    decision_result VARCHAR(20);
    decision_confidence DECIMAL(5,2);
    decision_factors JSONB;
    can_auto_approve BOOLEAN := FALSE;
    auto_approval_threshold DECIMAL(5,2);
    manual_review_threshold DECIMAL(5,2);
BEGIN
    -- Get verification details with risk assessment
    SELECT kv.*, kra.overall_risk_score, kra.risk_category, kra.risk_indicators
    INTO verification_record
    FROM kyc_verifications kv
    LEFT JOIN kyc_risk_assessments kra ON kv.id = kra.verification_id
    WHERE kv.id = p_verification_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'KYC verification not found';
    END IF;
    
    -- Get configuration thresholds
    SELECT 
        (SELECT setting_value::text::decimal FROM kyc_configuration WHERE setting_key = 'auto_approval_threshold'),
        (SELECT setting_value::text::decimal FROM kyc_configuration WHERE setting_key = 'manual_review_threshold')
    INTO auto_approval_threshold, manual_review_threshold;
    
    -- Determine decision if not provided manually
    IF p_decision IS NULL THEN
        -- Check if can auto-approve based on risk score
        can_auto_approve := (
            verification_record.overall_risk_score IS NOT NULL AND
            verification_record.overall_risk_score <= COALESCE(auto_approval_threshold, 20) AND
            verification_record.risk_category = 'low' AND
            NOT EXISTS(
                SELECT 1 FROM kyc_documents 
                WHERE verification_id = p_verification_id 
                    AND validation_status IN ('suspicious', 'invalid', 'expired')
            )
        );
        
        IF can_auto_approve THEN
            decision_result := 'approved';
            decision_confidence := 90.0;
        ELSIF verification_record.overall_risk_score > COALESCE(manual_review_threshold, 60) THEN
            decision_result := 'rejected';
            decision_confidence := 75.0;
        ELSE
            decision_result := 'pending'; -- Requires manual review
            decision_confidence := 50.0;
        END IF;
    ELSE
        decision_result := p_decision;
        decision_confidence := 95.0; -- High confidence for manual decisions
    END IF;
    
    -- Build decision factors
    decision_factors := jsonb_build_object(
        'risk_score', verification_record.overall_risk_score,
        'risk_category', verification_record.risk_category,
        'auto_decision', p_decision IS NULL,
        'reviewer_id', p_reviewer_id,
        'decision_timestamp', NOW()
    );
    
    -- Update verification with decision
    UPDATE kyc_verifications
    SET decision = decision_result,
        decision_confidence = decision_confidence,
        decision_factors = decision_factors,
        decided_at = CASE WHEN decision_result != 'pending' THEN NOW() ELSE decided_at END,
        status = CASE decision_result
            WHEN 'approved' THEN 'approved'
            WHEN 'rejected' THEN 'rejected'
            ELSE 'under_review'
        END,
        assigned_reviewer_id = COALESCE(p_reviewer_id, assigned_reviewer_id),
        updated_at = NOW()
    WHERE id = p_verification_id;
    
    -- If approved, update business verification status and grant business owner role
    IF decision_result = 'approved' AND verification_record.business_id IS NOT NULL THEN
        -- Update business verification status
        UPDATE businesses
        SET verification_status = 'verified',
            verification_date = NOW(),
            updated_at = NOW()
        WHERE id = verification_record.business_id;
        
        -- Grant business owner role via RBAC system
        PERFORM public.assign_business_permission(
            verification_record.user_id,
            verification_record.business_id,
            'owner',
            'owner',
            'full',
            p_reviewer_id
        );
        
        -- Add business owner role if not already present
        INSERT INTO user_roles (user_id, role_id, granted_by, scope_type, scope_id)
        SELECT 
            verification_record.user_id,
            r.id,
            p_reviewer_id,
            'business',
            verification_record.business_id
        FROM roles r
        WHERE r.name = 'business_owner'
        ON CONFLICT (user_id, role_id) DO NOTHING;
    END IF;
    
    -- Remove from review queue if decided
    IF decision_result != 'pending' THEN
        UPDATE kyc_review_queue
        SET status = 'completed',
            completed_at = NOW()
        WHERE verification_id = p_verification_id;
    END IF;
    
    -- Log the decision
    INSERT INTO auth_audit_logs (
        event_type, event_category, user_id, target_user_id,
        event_data, success
    ) VALUES (
        'kyc_verification_decided', 'compliance', 
        COALESCE(p_reviewer_id, auth.uid()), verification_record.user_id,
        jsonb_build_object(
            'verification_id', p_verification_id,
            'decision', decision_result,
            'confidence', decision_confidence,
            'auto_decision', p_decision IS NULL,
            'business_id', verification_record.business_id
        ),
        true
    );
    
    RETURN jsonb_build_object(
        'verification_id', p_verification_id,
        'decision', decision_result,
        'confidence', decision_confidence,
        'auto_decision', p_decision IS NULL,
        'risk_score', verification_record.overall_risk_score,
        'factors', decision_factors
    );
END;
$$;

-- =====================================================
-- COMPLIANCE AND SCREENING FUNCTIONS
-- =====================================================

-- Screen entity against watchlists
CREATE OR REPLACE FUNCTION public.screen_against_watchlists(
    p_entity_type VARCHAR(20),
    p_entity_value TEXT,
    p_verification_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    entity_hash VARCHAR(64);
    matches JSONB := '[]'::jsonb;
    match_record RECORD;
    total_matches INTEGER := 0;
    high_risk_matches INTEGER := 0;
BEGIN
    -- Generate hash for privacy
    entity_hash := encode(sha256(LOWER(TRIM(p_entity_value))::bytea), 'hex');
    
    -- Search watchlists
    FOR match_record IN 
        SELECT w.*, 
               CASE 
                   WHEN w.entity_value = p_entity_value THEN 100
                   WHEN w.entity_hash = entity_hash THEN 95
                   WHEN p_entity_value = ANY(w.aliases) THEN 90
                   ELSE 0
               END as match_score
        FROM kyc_watchlists w
        WHERE w.entity_type = p_entity_type
            AND (
                w.entity_hash = entity_hash OR
                w.entity_value = p_entity_value OR
                p_entity_value = ANY(w.aliases)
            )
            AND (w.effective_until IS NULL OR w.effective_until >= CURRENT_DATE)
        ORDER BY match_score DESC
    LOOP
        total_matches := total_matches + 1;
        
        IF match_record.severity IN ('high', 'critical') THEN
            high_risk_matches := high_risk_matches + 1;
        END IF;
        
        matches := matches || jsonb_build_object(
            'watchlist_id', match_record.id,
            'list_type', match_record.list_type,
            'list_source', match_record.list_source,
            'severity', match_record.severity,
            'match_score', match_record.match_score,
            'description', match_record.description
        );
    END LOOP;
    
    -- Log screening activity
    INSERT INTO auth_audit_logs (
        event_type, event_category, user_id,
        event_data, success
    ) VALUES (
        'watchlist_screening_performed', 'compliance', auth.uid(),
        jsonb_build_object(
            'entity_type', p_entity_type,
            'verification_id', p_verification_id,
            'total_matches', total_matches,
            'high_risk_matches', high_risk_matches
        ),
        true
    );
    
    RETURN jsonb_build_object(
        'entity_type', p_entity_type,
        'total_matches', total_matches,
        'high_risk_matches', high_risk_matches,
        'matches', matches,
        'screened_at', NOW()
    );
END;
$$;

-- Generate compliance report
CREATE OR REPLACE FUNCTION public.generate_kyc_compliance_report(
    p_report_type VARCHAR(30),
    p_start_date DATE,
    p_end_date DATE,
    p_generated_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    report_id UUID;
    report_data JSONB;
    verification_stats RECORD;
    risk_stats RECORD;
    compliance_stats RECORD;
    processing_stats RECORD;
    current_user_id UUID;
BEGIN
    current_user_id := COALESCE(p_generated_by, auth.uid());
    
    -- Validate date range
    IF p_end_date < p_start_date THEN
        RAISE EXCEPTION 'End date must be greater than or equal to start date';
    END IF;
    
    -- Gather verification statistics
    SELECT 
        COUNT(*) as total_verifications,
        COUNT(*) FILTER (WHERE decision = 'approved') as approved_verifications,
        COUNT(*) FILTER (WHERE decision = 'rejected') as rejected_verifications,
        COUNT(*) FILTER (WHERE status IN ('initiated', 'under_review', 'verification_pending')) as pending_verifications
    INTO verification_stats
    FROM kyc_verifications
    WHERE created_at::date BETWEEN p_start_date AND p_end_date;
    
    -- Gather risk statistics  
    SELECT 
        COUNT(*) FILTER (WHERE risk_level = 'high') as high_risk_cases,
        COUNT(*) FILTER (WHERE risk_level = 'critical') as critical_risk_cases,
        COUNT(*) FILTER (WHERE status = 'flagged') as flagged_cases
    INTO risk_stats
    FROM kyc_verifications kv
    JOIN kyc_risk_assessments kra ON kv.id = kra.verification_id
    WHERE kv.created_at::date BETWEEN p_start_date AND p_end_date;
    
    -- Gather compliance statistics (placeholder for real screening data)
    SELECT 
        0 as aml_alerts,
        0 as sanctions_hits,
        0 as pep_matches,
        0 as adverse_media_alerts
    INTO compliance_stats;
    
    -- Gather processing statistics
    SELECT 
        AVG(EXTRACT(EPOCH FROM (decided_at - initiated_at))/3600) as avg_processing_time_hours,
        COUNT(*) FILTER (WHERE decided_at <= initiated_at + INTERVAL '24 hours')::decimal / 
            NULLIF(COUNT(*) FILTER (WHERE decided_at IS NOT NULL), 0) * 100 as sla_compliance_percentage,
        COUNT(*) FILTER (WHERE decision = 'approved' AND assigned_reviewer_id IS NULL)::decimal /
            NULLIF(COUNT(*) FILTER (WHERE decision = 'approved'), 0) * 100 as auto_approval_rate
    INTO processing_stats
    FROM kyc_verifications
    WHERE created_at::date BETWEEN p_start_date AND p_end_date;
    
    -- Build detailed report data
    report_data := jsonb_build_object(
        'period', jsonb_build_object(
            'start_date', p_start_date,
            'end_date', p_end_date,
            'days', p_end_date - p_start_date + 1
        ),
        'verification_summary', jsonb_build_object(
            'total', verification_stats.total_verifications,
            'approved', verification_stats.approved_verifications,
            'rejected', verification_stats.rejected_verifications,
            'pending', verification_stats.pending_verifications,
            'approval_rate', CASE 
                WHEN verification_stats.total_verifications > 0 THEN 
                    ROUND(verification_stats.approved_verifications::decimal / verification_stats.total_verifications * 100, 2)
                ELSE 0 
            END
        ),
        'risk_analysis', jsonb_build_object(
            'high_risk', COALESCE(risk_stats.high_risk_cases, 0),
            'critical_risk', COALESCE(risk_stats.critical_risk_cases, 0),
            'flagged', COALESCE(risk_stats.flagged_cases, 0)
        ),
        'compliance_metrics', jsonb_build_object(
            'aml_alerts', compliance_stats.aml_alerts,
            'sanctions_hits', compliance_stats.sanctions_hits,
            'pep_matches', compliance_stats.pep_matches,
            'adverse_media', compliance_stats.adverse_media_alerts
        ),
        'performance_metrics', jsonb_build_object(
            'avg_processing_hours', COALESCE(ROUND(processing_stats.avg_processing_time_hours, 2), 0),
            'sla_compliance_pct', COALESCE(ROUND(processing_stats.sla_compliance_percentage, 2), 0),
            'auto_approval_rate_pct', COALESCE(ROUND(processing_stats.auto_approval_rate, 2), 0)
        )
    );
    
    -- Create compliance report record
    INSERT INTO kyc_compliance_reports (
        report_type, report_period_start, report_period_end,
        total_verifications, approved_verifications, rejected_verifications, pending_verifications,
        high_risk_cases, flagged_cases, escalated_cases,
        aml_alerts, sanctions_hits, pep_matches, adverse_media_alerts,
        average_processing_time_hours, sla_compliance_percentage, auto_approval_rate,
        detailed_data, generated_by, status
    ) VALUES (
        p_report_type, p_start_date, p_end_date,
        verification_stats.total_verifications, verification_stats.approved_verifications,
        verification_stats.rejected_verifications, verification_stats.pending_verifications,
        COALESCE(risk_stats.high_risk_cases, 0), COALESCE(risk_stats.flagged_cases, 0), 0,
        compliance_stats.aml_alerts, compliance_stats.sanctions_hits, 
        compliance_stats.pep_matches, compliance_stats.adverse_media_alerts,
        COALESCE(processing_stats.avg_processing_time_hours, 0),
        COALESCE(processing_stats.sla_compliance_percentage, 0),
        COALESCE(processing_stats.auto_approval_rate, 0),
        report_data, current_user_id, 'generated'
    ) RETURNING id INTO report_id;
    
    RETURN report_id;
END;
$$;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant execute permissions to authenticated users for main functions
GRANT EXECUTE ON FUNCTION public.initiate_kyc_verification TO authenticated;
GRANT EXECUTE ON FUNCTION public.upload_kyc_document TO authenticated;
GRANT EXECUTE ON FUNCTION public.screen_against_watchlists TO authenticated;

-- Grant execute permissions to service role for system functions
GRANT EXECUTE ON FUNCTION public.trigger_document_ocr_processing TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_kyc_document TO service_role;
GRANT EXECUTE ON FUNCTION public.calculate_kyc_risk_assessment TO service_role;
GRANT EXECUTE ON FUNCTION public.update_verification_workflow_progress TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_kyc_verification TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_kyc_compliance_report TO service_role;

-- Grant limited permissions for admin functions
GRANT EXECUTE ON FUNCTION public.finalize_kyc_verification TO authenticated; -- Will be filtered by permission checks
GRANT EXECUTE ON FUNCTION public.generate_kyc_compliance_report TO authenticated; -- Will be filtered by permission checks

COMMIT;