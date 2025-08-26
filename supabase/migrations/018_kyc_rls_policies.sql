-- Migration: 018_kyc_rls_policies
-- Epic 2 Story 2.9: KYC Row Level Security and RBAC Integration
-- Description: Comprehensive RLS policies for KYC system with RBAC integration
-- Date: 2025-08-26
-- Author: Backend Developer

BEGIN;

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_verification_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_verification_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_configuration ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- KYC VERIFICATIONS POLICIES
-- =====================================================

-- Users can view their own verifications
CREATE POLICY "Users can view their own KYC verifications"
ON public.kyc_verifications
FOR SELECT
USING (
    auth.uid() = user_id OR
    public.user_has_enhanced_permission(auth.uid(), 'businesses', 'verify') OR
    public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
);

-- Users can create their own verifications
CREATE POLICY "Users can create their own KYC verifications"
ON public.kyc_verifications
FOR INSERT
WITH CHECK (
    auth.uid() = user_id OR
    public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
);

-- Only authorized users can update verifications (reviewers, admins)
CREATE POLICY "Authorized users can update KYC verifications"
ON public.kyc_verifications
FOR UPDATE
USING (
    auth.uid() = user_id OR
    auth.uid() = assigned_reviewer_id OR
    public.user_has_enhanced_permission(auth.uid(), 'businesses', 'verify') OR
    public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
);

-- Only system admins can delete verifications
CREATE POLICY "System admins can delete KYC verifications"
ON public.kyc_verifications
FOR DELETE
USING (
    public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
);

-- =====================================================
-- KYC DOCUMENTS POLICIES
-- =====================================================

-- Users can view documents for their own verifications
CREATE POLICY "Users can view their own KYC documents"
ON public.kyc_documents
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.kyc_verifications kv
        WHERE kv.id = kyc_documents.verification_id
        AND (
            kv.user_id = auth.uid() OR
            kv.assigned_reviewer_id = auth.uid() OR
            public.user_has_enhanced_permission(auth.uid(), 'businesses', 'verify') OR
            public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
        )
    )
    AND deleted_at IS NULL
);

-- Users can upload documents for their own verifications
CREATE POLICY "Users can upload documents for their own verifications"
ON public.kyc_documents
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.kyc_verifications kv
        WHERE kv.id = verification_id
        AND (
            kv.user_id = auth.uid() OR
            public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
        )
        AND kv.status IN ('initiated', 'documents_required', 'documents_uploaded', 'additional_info_required')
    )
);

-- Only reviewers and document owners can update documents
CREATE POLICY "Authorized users can update KYC documents"
ON public.kyc_documents
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.kyc_verifications kv
        WHERE kv.id = verification_id
        AND (
            kv.user_id = auth.uid() OR
            kv.assigned_reviewer_id = auth.uid() OR
            public.user_has_enhanced_permission(auth.uid(), 'businesses', 'verify') OR
            public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
        )
    )
);

-- Users can soft delete their own documents, admins can hard delete
CREATE POLICY "Users can delete their own KYC documents"
ON public.kyc_documents
FOR DELETE
USING (
    (
        user_id = auth.uid() AND deleted_at IS NULL
    ) OR
    public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
);

-- =====================================================
-- BUSINESS VERIFICATION WORKFLOWS POLICIES
-- =====================================================

-- Users can view workflows for their businesses or verifications
CREATE POLICY "Users can view their business verification workflows"
ON public.business_verification_workflows
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.kyc_verifications kv
        WHERE kv.id = business_verification_workflows.kyc_verification_id
        AND (
            kv.user_id = auth.uid() OR
            public.user_has_enhanced_permission(auth.uid(), 'businesses', 'verify') OR
            public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
        )
    ) OR
    EXISTS (
        SELECT 1 FROM public.business_permissions bp
        WHERE bp.business_id = business_verification_workflows.business_id
        AND bp.user_id = auth.uid()
        AND bp.is_active = true
        AND bp.permission_level IN ('admin', 'full')
    )
);

-- System creates workflows automatically
CREATE POLICY "System can manage business verification workflows"
ON public.business_verification_workflows
FOR ALL
USING (
    public.user_has_enhanced_permission(auth.uid(), 'businesses', 'verify') OR
    public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
);

-- =====================================================
-- RISK ASSESSMENTS POLICIES
-- =====================================================

-- Users can view risk assessments for their own verifications
CREATE POLICY "Users can view risk assessments for their verifications"
ON public.kyc_risk_assessments
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.kyc_verifications kv
        WHERE kv.id = kyc_risk_assessments.verification_id
        AND (
            kv.user_id = auth.uid() OR
            public.user_has_enhanced_permission(auth.uid(), 'businesses', 'verify') OR
            public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
        )
    )
);

-- Only system can create/update risk assessments
CREATE POLICY "System can manage risk assessments"
ON public.kyc_risk_assessments
FOR ALL
USING (
    public.user_has_enhanced_permission(auth.uid(), 'businesses', 'verify') OR
    public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
);

-- =====================================================
-- APPEALS POLICIES
-- =====================================================

-- Users can view their own appeals
CREATE POLICY "Users can view their own appeals"
ON public.kyc_appeals
FOR SELECT
USING (
    appellant_id = auth.uid() OR
    assigned_reviewer_id = auth.uid() OR
    public.user_has_enhanced_permission(auth.uid(), 'businesses', 'verify') OR
    public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
);

-- Users can create appeals for their own rejected verifications
CREATE POLICY "Users can create appeals for their verifications"
ON public.kyc_appeals
FOR INSERT
WITH CHECK (
    appellant_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.kyc_verifications kv
        WHERE kv.id = verification_id
        AND kv.user_id = auth.uid()
        AND kv.decision = 'rejected'
        AND kv.decided_at IS NOT NULL
    )
);

-- Only reviewers and admins can update appeals
CREATE POLICY "Authorized users can update appeals"
ON public.kyc_appeals
FOR UPDATE
USING (
    assigned_reviewer_id = auth.uid() OR
    public.user_has_enhanced_permission(auth.uid(), 'businesses', 'verify') OR
    public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
);

-- Only admins can delete appeals
CREATE POLICY "Admins can delete appeals"
ON public.kyc_appeals
FOR DELETE
USING (
    public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
);

-- =====================================================
-- REVIEW QUEUE POLICIES
-- =====================================================

-- Reviewers can view their assigned queue items
CREATE POLICY "Reviewers can view assigned queue items"
ON public.kyc_review_queue
FOR SELECT
USING (
    assigned_to = auth.uid() OR
    public.user_has_enhanced_permission(auth.uid(), 'businesses', 'verify') OR
    public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
);

-- System can manage queue items
CREATE POLICY "System can manage review queue"
ON public.kyc_review_queue
FOR ALL
USING (
    public.user_has_enhanced_permission(auth.uid(), 'businesses', 'verify') OR
    public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
);

-- =====================================================
-- COMPLIANCE REPORTS POLICIES
-- =====================================================

-- Only authorized users can view compliance reports
CREATE POLICY "Authorized users can view compliance reports"
ON public.kyc_compliance_reports
FOR SELECT
USING (
    public.user_has_enhanced_permission(auth.uid(), 'analytics', 'read') OR
    public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
);

-- Only authorized users can create compliance reports
CREATE POLICY "Authorized users can create compliance reports"
ON public.kyc_compliance_reports
FOR INSERT
WITH CHECK (
    public.user_has_enhanced_permission(auth.uid(), 'analytics', 'read') OR
    public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
);

-- Only report creators and admins can update reports
CREATE POLICY "Report creators can update compliance reports"
ON public.kyc_compliance_reports
FOR UPDATE
USING (
    generated_by = auth.uid() OR
    public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
);

-- Only admins can delete reports
CREATE POLICY "Admins can delete compliance reports"
ON public.kyc_compliance_reports
FOR DELETE
USING (
    public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
);

-- =====================================================
-- DOCUMENT TYPES POLICIES (READ-ONLY FOR MOST USERS)
-- =====================================================

-- All authenticated users can view active document types
CREATE POLICY "Authenticated users can view document types"
ON public.kyc_document_types
FOR SELECT
USING (
    is_active = true OR
    public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
);

-- Only admins can modify document types
CREATE POLICY "Admins can manage document types"
ON public.kyc_document_types
FOR ALL
USING (
    public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
);

-- =====================================================
-- IDENTITY VERIFICATION PROVIDERS POLICIES
-- =====================================================

-- Only system can view/manage providers
CREATE POLICY "System can manage identity verification providers"
ON public.identity_verification_providers
FOR ALL
USING (
    public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
);

-- =====================================================
-- WATCHLISTS POLICIES
-- =====================================================

-- Only authorized users can view watchlists
CREATE POLICY "Authorized users can view watchlists"
ON public.kyc_watchlists
FOR SELECT
USING (
    public.user_has_enhanced_permission(auth.uid(), 'businesses', 'verify') OR
    public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
);

-- Only admins can manage watchlists
CREATE POLICY "Admins can manage watchlists"
ON public.kyc_watchlists
FOR ALL
USING (
    public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
);

-- =====================================================
-- CONFIGURATION POLICIES
-- =====================================================

-- Authorized users can view configuration
CREATE POLICY "Authorized users can view KYC configuration"
ON public.kyc_configuration
FOR SELECT
USING (
    public.user_has_enhanced_permission(auth.uid(), 'businesses', 'verify') OR
    public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
);

-- Only admins can modify configuration
CREATE POLICY "Admins can manage KYC configuration"
ON public.kyc_configuration
FOR ALL
USING (
    public.user_has_enhanced_permission(auth.uid(), 'users', 'manage')
);

-- =====================================================
-- BUSINESS PERMISSIONS INTEGRATION
-- =====================================================

-- Function to check if user can manage business verification
CREATE OR REPLACE FUNCTION public.user_can_manage_business_verification(
    p_user_id UUID,
    p_business_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if user is business owner
    IF EXISTS (
        SELECT 1 FROM businesses 
        WHERE id = p_business_id AND owner_id = p_user_id
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Check business permissions
    IF EXISTS (
        SELECT 1 FROM business_permissions bp
        WHERE bp.user_id = p_user_id
        AND bp.business_id = p_business_id
        AND bp.is_active = true
        AND bp.employment_status = 'active'
        AND bp.permission_level IN ('admin', 'full')
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Check enhanced RBAC permissions
    IF public.user_has_enhanced_permission(p_user_id, 'businesses', 'manage') THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$;

-- =====================================================
-- AUDIT AND LOGGING POLICIES
-- =====================================================

-- Create audit trigger function for KYC operations
CREATE OR REPLACE FUNCTION public.kyc_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    audit_data JSONB;
    event_type TEXT;
BEGIN
    -- Determine event type
    IF TG_OP = 'INSERT' THEN
        event_type := 'kyc_' || TG_TABLE_NAME || '_created';
        audit_data := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        event_type := 'kyc_' || TG_TABLE_NAME || '_updated';
        audit_data := jsonb_build_object(
            'old', to_jsonb(OLD),
            'new', to_jsonb(NEW),
            'changes', (
                SELECT jsonb_object_agg(key, value)
                FROM jsonb_each(to_jsonb(NEW))
                WHERE value != COALESCE(to_jsonb(OLD) -> key, 'null'::jsonb)
            )
        );
    ELSIF TG_OP = 'DELETE' THEN
        event_type := 'kyc_' || TG_TABLE_NAME || '_deleted';
        audit_data := to_jsonb(OLD);
    END IF;
    
    -- Insert audit log
    INSERT INTO auth_audit_logs (
        event_type,
        event_category,
        user_id,
        event_data,
        success,
        ip_address,
        user_agent
    ) VALUES (
        event_type,
        'kyc_operation',
        auth.uid(),
        audit_data,
        true,
        current_setting('request.headers', true)::json->>'x-forwarded-for',
        current_setting('request.headers', true)::json->>'user-agent'
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create audit triggers for key tables
CREATE TRIGGER kyc_verifications_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.kyc_verifications
    FOR EACH ROW EXECUTE FUNCTION public.kyc_audit_trigger();

CREATE TRIGGER kyc_documents_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.kyc_documents
    FOR EACH ROW EXECUTE FUNCTION public.kyc_audit_trigger();

CREATE TRIGGER kyc_appeals_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.kyc_appeals
    FOR EACH ROW EXECUTE FUNCTION public.kyc_audit_trigger();

-- =====================================================
-- RBAC INTEGRATION FUNCTIONS
-- =====================================================

-- Function to automatically assign business owner role after KYC approval
CREATE OR REPLACE FUNCTION public.handle_kyc_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only process when verification is approved
    IF NEW.decision = 'approved' AND NEW.status = 'approved' AND OLD.decision IS DISTINCT FROM 'approved' THEN
        
        -- If this is a business verification, assign business owner role
        IF NEW.business_id IS NOT NULL THEN
            -- Assign business owner role via RBAC system
            PERFORM public.assign_business_permission(
                NEW.user_id,
                NEW.business_id,
                'owner',
                'owner',
                'full',
                NEW.assigned_reviewer_id
            );
            
            -- Update business verification status
            UPDATE businesses
            SET verification_status = 'verified',
                verification_date = NOW(),
                updated_at = NOW()
            WHERE id = NEW.business_id;
            
            -- Add user to business owner role if not already present
            INSERT INTO user_roles (user_id, role_id, granted_by, scope_type, scope_id)
            SELECT 
                NEW.user_id,
                r.id,
                NEW.assigned_reviewer_id,
                'business',
                NEW.business_id
            FROM roles r
            WHERE r.name = 'business_owner'
            ON CONFLICT (user_id, role_id) DO UPDATE SET
                is_active = true,
                scope_type = 'business',
                scope_id = NEW.business_id,
                updated_at = NOW();
        END IF;
        
        -- Invalidate user's permission cache
        DELETE FROM permission_cache WHERE user_id = NEW.user_id;
        
        -- Log the role assignment
        INSERT INTO auth_audit_logs (
            event_type, event_category, user_id, target_user_id,
            event_data, success
        ) VALUES (
            'kyc_approval_role_assigned', 'permission', 
            NEW.assigned_reviewer_id, NEW.user_id,
            jsonb_build_object(
                'verification_id', NEW.id,
                'business_id', NEW.business_id,
                'role_assigned', 'business_owner'
            ),
            true
        );
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for automatic role assignment
CREATE TRIGGER kyc_approval_role_assignment_trigger
    AFTER UPDATE ON public.kyc_verifications
    FOR EACH ROW
    WHEN (NEW.decision = 'approved' AND NEW.status = 'approved')
    EXECUTE FUNCTION public.handle_kyc_approval();

-- =====================================================
-- PERFORMANCE INDEXES FOR RLS
-- =====================================================

-- Indexes to support RLS policy performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_verifications_user_status 
    ON kyc_verifications(user_id, status) WHERE status IN ('initiated', 'under_review', 'approved', 'rejected');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_verifications_reviewer 
    ON kyc_verifications(assigned_reviewer_id) WHERE assigned_reviewer_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_documents_verification_user 
    ON kyc_documents(verification_id, user_id) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_appeals_appellant 
    ON kyc_appeals(appellant_id, status) WHERE status IN ('submitted', 'under_review');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_verification_workflows_business 
    ON business_verification_workflows(business_id, status) WHERE status = 'active';

-- =====================================================
-- GRANT PERMISSIONS FOR RLS FUNCTIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION public.user_can_manage_business_verification TO authenticated;
GRANT EXECUTE ON FUNCTION public.kyc_audit_trigger TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_kyc_approval TO authenticated;

COMMIT;