/**
 * Business Owner Verification Workflow
 * Epic 2 Story 2.5: User Onboarding and Email Verification Infrastructure
 * 
 * Comprehensive business verification with document upload, KYC compliance, and workflow management
 */

import { createHash } from 'crypto';
import { supabase } from '@/lib/supabase/server';
import { Database } from '@/lib/supabase/database.types';

// TODO: Add these types to database.types.ts when tables are created
type BusinessVerificationDocument = any;
type BusinessVerificationDocumentInsert = any;
type BusinessVerificationWorkflow = any;
type BusinessVerificationWorkflowInsert = any;

export interface DocumentUploadResult {
  success: boolean;
  documentId?: string;
  error?: string;
  requiresAdditional?: string[];
}

export interface VerificationRequirements {
  businessLicense: boolean;
  taxId: boolean;
  proofOfAddress: boolean;
  identityVerification: boolean;
  phoneVerification: boolean;
  emailVerification: boolean;
  additionalDocuments?: string[];
}

export interface KYCData {
  businessName: string;
  businessType: string;
  registrationNumber?: string;
  taxIdNumber?: string;
  incorporationDate?: string;
  businessAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  ownerInformation: {
    fullName: string;
    dateOfBirth?: string;
    idNumber?: string;
    idType?: string;
  };
  contactInformation: {
    phone: string;
    email: string;
    website?: string;
  };
  businessDescription?: string;
  industryCategory: string;
  estimatedRevenue?: string;
}

export interface VerificationWorkflowStatus {
  workflowId: string;
  status: 'not_started' | 'document_upload' | 'under_review' | 'additional_info_required' | 'approved' | 'rejected' | 'suspended';
  currentStep: string;
  completionPercentage: number;
  requirementsMet: VerificationRequirements;
  uploadedDocuments: BusinessVerificationDocument[];
  reviewNotes?: string;
  estimatedProcessingTime: string;
  nextSteps: string[];
}

export class BusinessVerificationService {
  private readonly allowedFileTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB

  /**
   * Initialize business verification workflow
   */
  async initializeVerificationWorkflow(
    userId: string,
    businessId?: string
  ): Promise<{
    success: boolean;
    workflowId?: string;
    status?: VerificationWorkflowStatus;
    error?: string;
  }> {
    try {
      // Check if workflow already exists
      const { data: existingWorkflow, error: checkError } = await supabase
        .from('business_verification_workflows')
        .select('*')
        .eq('user_id', userId)
        .eq('business_id', businessId || null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingWorkflow && existingWorkflow.status !== 'rejected') {
        const status = await this.getVerificationStatus(existingWorkflow.id);
        return {
          success: true,
          workflowId: existingWorkflow.id,
          status,
        };
      }

      // Create new workflow
      const workflowData: BusinessVerificationWorkflowInsert = {
        user_id: userId,
        business_id: businessId || null,
        status: 'not_started',
        current_step: 'document_upload',
        completion_percentage: 0,
        requirements_met: {
          business_license: false,
          tax_id: false,
          proof_of_address: false,
          identity_verification: false,
          phone_verification: false,
          email_verification: false,
        },
        kyc_status: 'not_started',
        started_at: new Date().toISOString(),
        priority_level: 3,
      };

      const { data: newWorkflow, error: insertError } = await supabase
        .from('business_verification_workflows')
        .insert(workflowData)
        .select()
        .single();

      if (insertError) throw insertError;

      const status = await this.getVerificationStatus(newWorkflow.id);

      return {
        success: true,
        workflowId: newWorkflow.id,
        status,
      };

    } catch (error) {
      console.error('Error initializing verification workflow:', error);
      return {
        success: false,
        error: 'Failed to initialize verification workflow.',
      };
    }
  }

  /**
   * Upload verification document
   */
  async uploadVerificationDocument(
    userId: string,
    workflowId: string,
    documentType: 'business_license' | 'tax_id' | 'registration_certificate' | 'incorporation_docs' | 'operating_agreement' | 'insurance' | 'other',
    file: {
      name: string;
      type: string;
      size: number;
      buffer: Buffer;
    },
    businessId?: string
  ): Promise<DocumentUploadResult> {
    try {
      // Validate file
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      // Generate file path and hash
      const fileHash = createHash('sha256').update(file.buffer).digest('hex');
      const fileName = `${userId}/${workflowId}/${documentType}/${Date.now()}_${file.name}`;
      
      // Check if document with same hash already exists
      const { data: existingDoc, error: checkError } = await supabase
        .from('business_verification_documents')
        .select('id')
        .eq('user_id', userId)
        .eq('file_hash', fileHash)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingDoc) {
        return {
          success: false,
          error: 'This document has already been uploaded.',
        };
      }

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('business-verification-documents')
        .upload(fileName, file.buffer, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Store document record
      const documentData: BusinessVerificationDocumentInsert = {
        user_id: userId,
        business_id: businessId || null,
        document_type: documentType,
        file_name: file.name,
        file_path: uploadData.path,
        file_size_bytes: file.size,
        mime_type: file.type,
        file_hash: fileHash,
        verification_status: 'pending',
        document_metadata: {
          uploadedAt: new Date().toISOString(),
          originalFileName: file.name,
          workflowId,
        },
        is_sensitive: true,
        access_log: [
          {
            action: 'uploaded',
            timestamp: new Date().toISOString(),
            userId,
          }
        ],
      };

      const { data: newDocument, error: docError } = await supabase
        .from('business_verification_documents')
        .insert(documentData)
        .select()
        .single();

      if (docError) throw docError;

      // Update workflow requirements
      await this.updateVerificationRequirements(workflowId, documentType, true);

      // Check if additional documents are needed
      const additionalRequired = await this.getAdditionalRequiredDocuments(
        userId,
        documentType
      );

      return {
        success: true,
        documentId: newDocument.id,
        requiresAdditional: additionalRequired,
      };

    } catch (error) {
      console.error('Error uploading verification document:', error);
      return {
        success: false,
        error: 'Failed to upload document.',
      };
    }
  }

  /**
   * Submit KYC information
   */
  async submitKYCInformation(
    userId: string,
    workflowId: string,
    kycData: KYCData
  ): Promise<{
    success: boolean;
    kycScore?: number;
    risk_flags?: string[];
    error?: string;
  }> {
    try {
      // Validate KYC data
      const validation = this.validateKYCData(kycData);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join(', '),
        };
      }

      // Calculate KYC score and identify risk flags
      const kycAssessment = this.assessKYCData(kycData);

      // Update workflow with KYC data
      const { error: updateError } = await supabase
        .from('business_verification_workflows')
        .update({
          kyc_data: kycData,
          kyc_status: 'completed',
          kyc_score: kycAssessment.score,
          current_step: 'under_review',
          status: 'under_review',
          submitted_for_review_at: new Date().toISOString(),
          completion_percentage: this.calculateCompletionPercentage(workflowId),
        })
        .eq('id', workflowId)
        .eq('user_id', userId);

      if (updateError) throw updateError;

      // Auto-approve low-risk applications
      if (kycAssessment.score >= 0.8 && kycAssessment.riskFlags.length === 0) {
        await this.autoApproveVerification(workflowId, userId);
      } else {
        // Assign to reviewer for manual review
        await this.assignToReviewer(workflowId, kycAssessment.riskFlags);
      }

      return {
        success: true,
        kycScore: kycAssessment.score,
        risk_flags: kycAssessment.riskFlags,
      };

    } catch (error) {
      console.error('Error submitting KYC information:', error);
      return {
        success: false,
        error: 'Failed to submit KYC information.',
      };
    }
  }

  /**
   * Get verification workflow status
   */
  async getVerificationStatus(workflowId: string): Promise<VerificationWorkflowStatus> {
    try {
      const { data: workflow, error: workflowError } = await supabase
        .from('business_verification_workflows')
        .select('*')
        .eq('id', workflowId)
        .single();

      if (workflowError) throw workflowError;

      const { data: documents, error: docsError } = await supabase
        .from('business_verification_documents')
        .select('*')
        .eq('user_id', workflow.user_id)
        .order('uploaded_at', { ascending: false });

      if (docsError) throw docsError;

      const estimatedProcessingTime = this.calculateProcessingTime(
        workflow.status as any,
        workflow.priority_level
      );

      const nextSteps = this.getNextSteps(workflow.status as any, workflow.requirements_met as any);

      return {
        workflowId: workflow.id,
        status: workflow.status as any,
        currentStep: workflow.current_step || 'document_upload',
        completionPercentage: workflow.completion_percentage || 0,
        requirementsMet: workflow.requirements_met as any,
        uploadedDocuments: documents || [],
        reviewNotes: workflow.processing_notes,
        estimatedProcessingTime,
        nextSteps,
      };

    } catch (error) {
      console.error('Error getting verification status:', error);
      throw error;
    }
  }

  /**
   * Validate uploaded file
   */
  private validateFile(file: {
    name: string;
    type: string;
    size: number;
    buffer: Buffer;
  }): { isValid: boolean; error?: string } {
    // Check file size
    if (file.size > this.maxFileSize) {
      return {
        isValid: false,
        error: `File size must be less than ${this.maxFileSize / 1024 / 1024}MB`,
      };
    }

    // Check file type
    if (!this.allowedFileTypes.includes(file.type)) {
      return {
        isValid: false,
        error: 'File type not allowed. Please upload PDF, JPG, PNG, or DOC files.',
      };
    }

    // Check for malicious content (basic check)
    const fileName = file.name.toLowerCase();
    const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.js', '.vbs'];
    
    if (suspiciousExtensions.some(ext => fileName.includes(ext))) {
      return {
        isValid: false,
        error: 'File type not allowed for security reasons.',
      };
    }

    return { isValid: true };
  }

  /**
   * Validate KYC data
   */
  private validateKYCData(kycData: KYCData): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Required fields validation
    if (!kycData.businessName?.trim()) {
      errors.push('Business name is required');
    }

    if (!kycData.businessType?.trim()) {
      errors.push('Business type is required');
    }

    if (!kycData.industryCategory?.trim()) {
      errors.push('Industry category is required');
    }

    // Address validation
    if (!kycData.businessAddress?.street?.trim()) {
      errors.push('Business address is required');
    }

    if (!kycData.businessAddress?.city?.trim()) {
      errors.push('City is required');
    }

    if (!kycData.businessAddress?.state?.trim()) {
      errors.push('State is required');
    }

    // Contact information validation
    if (!kycData.contactInformation?.phone?.trim()) {
      errors.push('Phone number is required');
    }

    if (!kycData.contactInformation?.email?.trim()) {
      errors.push('Email is required');
    }

    // Owner information validation
    if (!kycData.ownerInformation?.fullName?.trim()) {
      errors.push('Owner full name is required');
    }

    // Format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (kycData.contactInformation?.email && 
        !emailRegex.test(kycData.contactInformation.email)) {
      errors.push('Invalid email format');
    }

    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (kycData.contactInformation?.phone && 
        !phoneRegex.test(kycData.contactInformation.phone.replace(/\s|-/g, ''))) {
      errors.push('Invalid phone number format');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Assess KYC data and calculate risk score
   */
  private assessKYCData(kycData: KYCData): {
    score: number;
    riskFlags: string[];
  } {
    let score = 0.5; // Base score
    const riskFlags: string[] = [];

    // Business completeness score
    if (kycData.registrationNumber) score += 0.1;
    if (kycData.taxIdNumber) score += 0.1;
    if (kycData.incorporationDate) score += 0.05;
    if (kycData.businessDescription) score += 0.05;

    // Contact verification
    if (kycData.contactInformation.website) score += 0.05;

    // Owner information completeness
    if (kycData.ownerInformation.dateOfBirth) score += 0.05;
    if (kycData.ownerInformation.idNumber) score += 0.1;

    // Risk factors
    const riskKeywords = ['cash', 'crypto', 'adult', 'gambling', 'loan'];
    const businessDesc = (kycData.businessDescription || '').toLowerCase();
    
    if (riskKeywords.some(keyword => businessDesc.includes(keyword))) {
      score -= 0.2;
      riskFlags.push('high_risk_industry');
    }

    // Address validation (simplified)
    if (!kycData.businessAddress.zipCode) {
      score -= 0.1;
      riskFlags.push('incomplete_address');
    }

    // Ensure score is between 0 and 1
    score = Math.max(0, Math.min(1, score));

    return { score, riskFlags };
  }

  /**
   * Update verification requirements
   */
  private async updateVerificationRequirements(
    workflowId: string,
    documentType: string,
    isMet: boolean
  ): Promise<void> {
    const { data: workflow, error: getError } = await supabase
      .from('business_verification_workflows')
      .select('requirements_met')
      .eq('id', workflowId)
      .single();

    if (getError) throw getError;

    const requirements = workflow.requirements_met as any || {};

    // Map document types to requirement keys
    const typeMap: Record<string, string> = {
      business_license: 'business_license',
      tax_id: 'tax_id',
      registration_certificate: 'proof_of_address',
      incorporation_docs: 'identity_verification',
    };

    const requirementKey = typeMap[documentType];
    if (requirementKey) {
      requirements[requirementKey] = isMet;

      const { error: updateError } = await supabase
        .from('business_verification_workflows')
        .update({
          requirements_met: requirements,
          completion_percentage: this.calculateCompletionPercentage(workflowId),
        })
        .eq('id', workflowId);

      if (updateError) throw updateError;
    }
  }

  /**
   * Calculate completion percentage
   */
  private calculateCompletionPercentage(workflowId: string): number {
    // This is a simplified version - in reality, you'd fetch the workflow
    // and calculate based on actual requirements met
    return 75; // Placeholder
  }

  /**
   * Get additional required documents based on business type
   */
  private async getAdditionalRequiredDocuments(
    userId: string,
    uploadedType: string
  ): Promise<string[]> {
    // This would be more sophisticated based on business type and regulations
    const additionalDocs: string[] = [];

    if (uploadedType === 'business_license') {
      additionalDocs.push('tax_id', 'proof_of_address');
    }

    return additionalDocs;
  }

  /**
   * Auto-approve low-risk verification
   */
  private async autoApproveVerification(
    workflowId: string,
    userId: string
  ): Promise<void> {
    await supabase
      .from('business_verification_workflows')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        completion_percentage: 100,
        processing_notes: 'Auto-approved based on low risk assessment',
      })
      .eq('id', workflowId);

    // Update user role to business owner
    const { data: businessOwnerRole } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'business_owner')
      .single();

    if (businessOwnerRole) {
      await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role_id: businessOwnerRole.id,
          granted_at: new Date().toISOString(),
          is_active: true,
        });
    }
  }

  /**
   * Assign workflow to reviewer
   */
  private async assignToReviewer(
    workflowId: string,
    riskFlags: string[]
  ): Promise<void> {
    // Get available reviewers (simplified - in reality would use load balancing)
    const { data: reviewers } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role_id', (await supabase.from('roles').select('id').eq('name', 'admin').single()).data?.id)
      .limit(1);

    const reviewerId = reviewers?.[0]?.user_id;

    if (reviewerId) {
      await supabase
        .from('business_verification_workflows')
        .update({
          assigned_reviewer: reviewerId,
          assigned_at: new Date().toISOString(),
          priority_level: riskFlags.length > 2 ? 1 : 3,
        })
        .eq('id', workflowId);
    }
  }

  /**
   * Calculate estimated processing time
   */
  private calculateProcessingTime(
    status: string,
    priorityLevel: number
  ): string {
    const baseTimes: Record<string, number> = {
      'document_upload': 0,
      'under_review': 3,
      'additional_info_required': 5,
      'approved': 0,
      'rejected': 0,
    };

    const baseTime = baseTimes[status] || 3;
    const adjustedTime = baseTime * (priorityLevel / 3);

    if (adjustedTime === 0) return 'Complete';
    if (adjustedTime <= 1) return '1 business day';
    if (adjustedTime <= 3) return '2-3 business days';
    if (adjustedTime <= 7) return '3-7 business days';
    
    return '7-14 business days';
  }

  /**
   * Get next steps based on current status
   */
  private getNextSteps(status: string, requirements: any): string[] {
    const steps: Record<string, string[]> = {
      'not_started': ['Upload required business documents'],
      'document_upload': [
        'Upload business license',
        'Upload tax identification',
        'Provide business address proof',
        'Complete business information form'
      ],
      'under_review': ['Wait for review completion', 'Check email for updates'],
      'additional_info_required': ['Provide requested additional information'],
      'approved': ['Complete business profile setup'],
      'rejected': ['Review rejection reasons', 'Resubmit with corrections'],
    };

    return steps[status] || ['Contact support for assistance'];
  }
}

// Export singleton instance
export const businessVerificationService = new BusinessVerificationService();

// Export utility functions
export const getRequiredDocumentsForBusinessType = (businessType: string): string[] => {
  const commonDocs = ['business_license', 'tax_id', 'proof_of_address'];
  
  const typeSpecificDocs: Record<string, string[]> = {
    'corporation': [...commonDocs, 'incorporation_docs'],
    'llc': [...commonDocs, 'operating_agreement'],
    'partnership': [...commonDocs, 'partnership_agreement'],
    'sole_proprietorship': commonDocs,
  };

  return typeSpecificDocs[businessType.toLowerCase()] || commonDocs;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};