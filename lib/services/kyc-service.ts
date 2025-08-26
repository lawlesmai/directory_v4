/**
 * KYC Service Layer
 * Epic 2 Story 2.9: Business Owner Verification & KYC
 * Centralized service for KYC operations and business logic
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';
import { z } from 'zod';

// Types
type SupabaseClient = ReturnType<typeof createClientComponentClient<Database>>;

export interface KYCVerification {
  id: string;
  userId: string;
  businessId?: string;
  verificationType: 'personal_identity' | 'business_owner' | 'business_entity' | 'enhanced_due_diligence';
  verificationLevel: 'basic' | 'enhanced' | 'premium' | 'institutional';
  status: string;
  decision?: string;
  riskLevel: string;
  riskScore?: number;
  initiatedAt: string;
  decidedAt?: string;
  expiresAt?: string;
}

export interface KYCDocument {
  id: string;
  verificationId: string;
  documentType: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  ocrStatus: string;
  validationStatus: string;
  reviewStatus: string;
  qualityScore?: number;
}

export interface VerificationWorkflow {
  id: string;
  businessId: string;
  currentStep: string;
  progressPercentage: number;
  completedSteps: number;
  totalSteps: number;
  requirements: {
    [key: string]: { required: boolean; completed: boolean };
  };
}

export interface RiskAssessment {
  id: string;
  verificationId: string;
  overallScore: number;
  riskCategory: string;
  riskIndicators: Array<{
    type: string;
    impact: number;
    description: string;
  }>;
  assessedAt: string;
}

// Validation schemas
const initiateVerificationSchema = z.object({
  userId: z.string().uuid(),
  businessId: z.string().uuid().optional(),
  verificationType: z.enum(['personal_identity', 'business_owner', 'business_entity', 'enhanced_due_diligence']),
  verificationLevel: z.enum(['basic', 'enhanced', 'premium', 'institutional'])
});

const documentUploadSchema = z.object({
  verificationId: z.string().uuid(),
  documentType: z.string(),
  file: z.instanceof(File),
  documentSide: z.enum(['front', 'back', 'both', 'single']).optional()
});

export class KYCService {
  private supabase: SupabaseClient;
  private cache: Map<string, any> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase || createClientComponentClient<Database>();
  }

  /**
   * Initialize KYC verification process
   */
  async initiateVerification(params: {
    userId: string;
    businessId?: string;
    verificationType: string;
    verificationLevel: string;
  }): Promise<{ success: boolean; verificationId?: string; error?: string }> {
    try {
      // Validate parameters
      const validated = initiateVerificationSchema.parse(params);

      // Check for existing active verification
      const { data: existingVerification } = await this.supabase
        .from('kyc_verifications')
        .select('id, status')
        .eq('user_id', validated.userId)
        .eq('business_id', validated.businessId || null)
        .in('status', ['initiated', 'documents_required', 'documents_uploaded', 'under_review'])
        .limit(1)
        .single();

      if (existingVerification) {
        return {
          success: false,
          error: 'An active KYC verification process already exists'
        };
      }

      // Call database function to initiate verification
      const { data: verificationId, error } = await this.supabase.rpc('initiate_kyc_verification', {
        p_user_id: validated.userId,
        p_business_id: validated.businessId || null,
        p_verification_type: validated.verificationType,
        p_verification_level: validated.verificationLevel
      });

      if (error) {
        throw new Error(`Failed to initiate KYC verification: ${error.message}`);
      }

      // Clear relevant caches
      this.clearCache(`verification_${validated.userId}`);
      this.clearCache(`user_verifications_${validated.userId}`);

      return {
        success: true,
        verificationId
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get KYC verification status and details
   */
  async getVerificationStatus(
    verificationId: string,
    options: {
      includeDocuments?: boolean;
      includeWorkflow?: boolean;
      includeRiskAssessment?: boolean;
    } = {}
  ): Promise<{ 
    success: boolean; 
    verification?: KYCVerification & {
      documents?: KYCDocument[];
      workflow?: VerificationWorkflow;
      riskAssessment?: RiskAssessment;
    };
    error?: string;
  }> {
    try {
      const cacheKey = `verification_${verificationId}_${JSON.stringify(options)}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      // Get basic verification details
      const { data: verification, error: verificationError } = await this.supabase
        .from('kyc_verifications')
        .select(`
          id, user_id, business_id, verification_type, verification_level,
          status, decision, risk_level, risk_score,
          initiated_at, decided_at, expires_at
        `)
        .eq('id', verificationId)
        .single();

      if (verificationError || !verification) {
        return {
          success: false,
          error: 'KYC verification not found'
        };
      }

      const result: any = {
        success: true,
        verification: {
          id: verification.id,
          userId: verification.user_id,
          businessId: verification.business_id,
          verificationType: verification.verification_type,
          verificationLevel: verification.verification_level,
          status: verification.status,
          decision: verification.decision,
          riskLevel: verification.risk_level,
          riskScore: verification.risk_score,
          initiatedAt: verification.initiated_at,
          decidedAt: verification.decided_at,
          expiresAt: verification.expires_at
        }
      };

      // Include documents if requested
      if (options.includeDocuments) {
        const { data: documents } = await this.supabase
          .from('kyc_documents')
          .select(`
            id, verification_id, file_name, file_size_bytes,
            ocr_status, validation_status, review_status,
            document_quality_score, created_at,
            kyc_document_types(type_code, display_name)
          `)
          .eq('verification_id', verificationId)
          .is('deleted_at', null);

        if (documents) {
          result.verification.documents = documents.map(doc => ({
            id: doc.id,
            verificationId: doc.verification_id,
            documentType: doc.kyc_document_types?.display_name || doc.kyc_document_types?.type_code || 'Unknown',
            fileName: doc.file_name,
            fileSize: doc.file_size_bytes,
            uploadedAt: doc.created_at,
            ocrStatus: doc.ocr_status,
            validationStatus: doc.validation_status,
            reviewStatus: doc.review_status,
            qualityScore: doc.document_quality_score
          }));
        }
      }

      // Include workflow if requested
      if (options.includeWorkflow && verification.business_id) {
        const { data: workflow } = await this.supabase
          .from('business_verification_workflows')
          .select('*')
          .eq('kyc_verification_id', verificationId)
          .single();

        if (workflow) {
          result.verification.workflow = {
            id: workflow.id,
            businessId: workflow.business_id,
            currentStep: workflow.current_step,
            progressPercentage: workflow.progress_percentage,
            completedSteps: workflow.completed_steps,
            totalSteps: workflow.total_steps,
            requirements: {
              identityVerification: {
                required: workflow.identity_verification_required,
                completed: workflow.identity_verification_completed
              },
              businessLicense: {
                required: workflow.business_license_required,
                completed: workflow.business_license_completed
              },
              taxVerification: {
                required: workflow.tax_verification_required,
                completed: workflow.tax_verification_completed
              },
              addressVerification: {
                required: workflow.address_verification_required,
                completed: workflow.address_verification_completed
              }
            }
          };
        }
      }

      // Include risk assessment if requested
      if (options.includeRiskAssessment) {
        const { data: riskAssessment } = await this.supabase
          .from('kyc_risk_assessments')
          .select('*')
          .eq('verification_id', verificationId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (riskAssessment) {
          result.verification.riskAssessment = {
            id: riskAssessment.id,
            verificationId: riskAssessment.verification_id,
            overallScore: riskAssessment.overall_risk_score,
            riskCategory: riskAssessment.risk_category,
            riskIndicators: riskAssessment.risk_indicators || [],
            assessedAt: riskAssessment.created_at
          };
        }
      }

      // Cache the result
      this.setCache(cacheKey, result);

      return result;

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get user's KYC verifications
   */
  async getUserVerifications(userId: string, options: {
    includeExpired?: boolean;
    limit?: number;
  } = {}): Promise<{ success: boolean; verifications?: KYCVerification[]; error?: string }> {
    try {
      const cacheKey = `user_verifications_${userId}_${JSON.stringify(options)}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      let query = this.supabase
        .from('kyc_verifications')
        .select(`
          id, user_id, business_id, verification_type, verification_level,
          status, decision, risk_level, risk_score,
          initiated_at, decided_at, expires_at
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!options.includeExpired) {
        query = query.or('expires_at.is.null,expires_at.gte.' + new Date().toISOString());
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data: verifications, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch user verifications: ${error.message}`);
      }

      const result = {
        success: true,
        verifications: (verifications || []).map(v => ({
          id: v.id,
          userId: v.user_id,
          businessId: v.business_id,
          verificationType: v.verification_type as any,
          verificationLevel: v.verification_level as any,
          status: v.status,
          decision: v.decision,
          riskLevel: v.risk_level,
          riskScore: v.risk_score,
          initiatedAt: v.initiated_at,
          decidedAt: v.decided_at,
          expiresAt: v.expires_at
        }))
      };

      // Cache the result
      this.setCache(cacheKey, result);

      return result;

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get document types available for KYC
   */
  async getDocumentTypes(category?: string): Promise<{
    success: boolean;
    documentTypes?: Array<{
      typeCode: string;
      displayName: string;
      description: string;
      category: string;
      required: boolean;
      acceptedFormats: string[];
      maxFileSizeMB: number;
    }>;
    error?: string;
  }> {
    try {
      const cacheKey = `document_types_${category || 'all'}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      let query = this.supabase
        .from('kyc_document_types')
        .select('*')
        .eq('is_active', true)
        .order('display_name');

      if (category) {
        query = query.eq('category', category);
      }

      const { data: documentTypes, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch document types: ${error.message}`);
      }

      const result = {
        success: true,
        documentTypes: (documentTypes || []).map(dt => ({
          typeCode: dt.type_code,
          displayName: dt.display_name,
          description: dt.description || '',
          category: dt.category,
          required: dt.required_for_verification,
          acceptedFormats: dt.accepted_formats || [],
          maxFileSizeMB: dt.max_file_size_mb
        }))
      };

      // Cache the result for 1 hour
      this.setCache(cacheKey, result, 60 * 60 * 1000);

      return result;

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Upload KYC document
   */
  async uploadDocument(params: {
    verificationId: string;
    documentType: string;
    file: File;
    documentSide?: string;
  }): Promise<{ success: boolean; documentId?: string; error?: string }> {
    try {
      // Validate parameters
      const validated = documentUploadSchema.parse(params);

      // Prepare form data
      const formData = new FormData();
      formData.append('verificationId', validated.verificationId);
      formData.append('documentType', validated.documentType);
      formData.append('file', validated.file);
      if (validated.documentSide) {
        formData.append('documentSide', validated.documentSide);
      }

      // Get CSRF token
      const { data: csrfToken } = await this.supabase.rpc('get_csrf_token');
      if (csrfToken) {
        formData.append('csrfToken', csrfToken);
      }

      // Upload via API
      const response = await fetch('/api/kyc/documents/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      // Clear relevant caches
      this.clearCache(`verification_${validated.verificationId}`);
      this.clearCache(`documents_${validated.verificationId}`);

      return {
        success: true,
        documentId: result.documentId
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * Check KYC status for business ownership
   */
  async checkBusinessOwnershipEligibility(userId: string, businessId: string): Promise<{
    success: boolean;
    eligible?: boolean;
    reason?: string;
    verificationRequired?: boolean;
    existingVerificationId?: string;
  }> {
    try {
      // Check if user has completed KYC for this business
      const { data: verification } = await this.supabase
        .from('kyc_verifications')
        .select('id, status, decision')
        .eq('user_id', userId)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!verification) {
        return {
          success: true,
          eligible: false,
          reason: 'KYC verification required for business ownership',
          verificationRequired: true
        };
      }

      if (verification.status === 'approved' && verification.decision === 'approved') {
        return {
          success: true,
          eligible: true,
          reason: 'KYC verification completed successfully'
        };
      }

      if (['initiated', 'documents_required', 'documents_uploaded', 'under_review'].includes(verification.status)) {
        return {
          success: true,
          eligible: false,
          reason: 'KYC verification in progress',
          existingVerificationId: verification.id
        };
      }

      return {
        success: true,
        eligible: false,
        reason: 'KYC verification was rejected or expired',
        verificationRequired: true
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get KYC statistics for admin dashboard
   */
  async getKYCStatistics(dateRange?: { start: string; end: string }): Promise<{
    success: boolean;
    statistics?: {
      totalVerifications: number;
      approvedVerifications: number;
      rejectedVerifications: number;
      pendingVerifications: number;
      averageProcessingTime: number;
      approvalRate: number;
    };
    error?: string;
  }> {
    try {
      let query = this.supabase
        .from('kyc_verifications')
        .select('status, decision, initiated_at, decided_at');

      if (dateRange) {
        query = query
          .gte('initiated_at', dateRange.start)
          .lte('initiated_at', dateRange.end);
      }

      const { data: verifications, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch KYC statistics: ${error.message}`);
      }

      if (!verifications) {
        return { success: true, statistics: {
          totalVerifications: 0,
          approvedVerifications: 0,
          rejectedVerifications: 0,
          pendingVerifications: 0,
          averageProcessingTime: 0,
          approvalRate: 0
        }};
      }

      const totalVerifications = verifications.length;
      const approvedVerifications = verifications.filter(v => v.decision === 'approved').length;
      const rejectedVerifications = verifications.filter(v => v.decision === 'rejected').length;
      const pendingVerifications = verifications.filter(v => !v.decision || v.decision === 'pending').length;
      
      // Calculate average processing time for completed verifications
      const completedVerifications = verifications.filter(v => v.decided_at);
      const totalProcessingTime = completedVerifications.reduce((acc, v) => {
        const start = new Date(v.initiated_at).getTime();
        const end = new Date(v.decided_at!).getTime();
        return acc + (end - start);
      }, 0);
      
      const averageProcessingTime = completedVerifications.length > 0 
        ? totalProcessingTime / completedVerifications.length / (1000 * 60 * 60) // Convert to hours
        : 0;

      const approvalRate = totalVerifications > 0 
        ? (approvedVerifications / totalVerifications) * 100 
        : 0;

      return {
        success: true,
        statistics: {
          totalVerifications,
          approvedVerifications,
          rejectedVerifications,
          pendingVerifications,
          averageProcessingTime: Math.round(averageProcessingTime * 100) / 100,
          approvalRate: Math.round(approvalRate * 100) / 100
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Cache management methods
   */
  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any, timeout?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    // Clean up expired entries
    setTimeout(() => {
      this.cache.delete(key);
    }, timeout || this.cacheTimeout);
  }

  private clearCache(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  public clearAllCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const kycService = new KYCService();