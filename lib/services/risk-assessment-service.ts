/**
 * Risk Assessment Service
 * Epic 2 Story 2.9: Business Owner Verification & KYC
 * Advanced risk scoring and fraud detection algorithms
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';

type SupabaseClient = ReturnType<typeof createClientComponentClient<Database>>;

export interface RiskFactor {
  type: string;
  category: 'identity' | 'document' | 'business' | 'behavioral' | 'geographic';
  impact: number; // 0-100
  confidence: number; // 0-100
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
}

export interface RiskAssessmentResult {
  overallScore: number; // 0-100, lower is better
  riskCategory: 'low' | 'medium' | 'high' | 'critical';
  componentScores: {
    identity: number;
    document: number;
    business: number;
    behavioral: number;
    geographic: number;
  };
  riskFactors: RiskFactor[];
  recommendations: string[];
  requiresManualReview: boolean;
  autoApprovalEligible: boolean;
  confidence: number;
}

export interface FraudIndicator {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  description: string;
  evidence: any;
  detectionMethod: string;
}

export interface ComplianceFlag {
  type: 'aml' | 'sanctions' | 'pep' | 'adverse_media';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  source: string;
  requiresEscalation: boolean;
}

export class RiskAssessmentService {
  private supabase: SupabaseClient;
  private mlModels: Map<string, any> = new Map();
  
  // Risk scoring weights
  private readonly COMPONENT_WEIGHTS = {
    identity: 0.25,
    document: 0.35,
    business: 0.20,
    behavioral: 0.10,
    geographic: 0.10
  };

  // Risk thresholds
  private readonly RISK_THRESHOLDS = {
    low: 25,
    medium: 60,
    high: 80
  };

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase || createClientComponentClient<Database>();
  }

  /**
   * Perform comprehensive risk assessment
   */
  async assessVerificationRisk(verificationId: string): Promise<RiskAssessmentResult> {
    try {
      // Get verification details
      const { data: verification, error } = await this.supabase
        .from('kyc_verifications')
        .select(`
          *,
          kyc_documents(*),
          businesses(*),
          auth_users:user_id(*)
        `)
        .eq('id', verificationId)
        .single();

      if (error || !verification) {
        throw new Error('Verification not found');
      }

      // Calculate component risk scores
      const identityScore = await this.calculateIdentityRisk(verification);
      const documentScore = await this.calculateDocumentRisk(verification.kyc_documents || []);
      const businessScore = verification.businesses ? 
        await this.calculateBusinessRisk(verification.businesses) : 0;
      const behavioralScore = await this.calculateBehavioralRisk(verification);
      const geographicScore = await this.calculateGeographicRisk(verification);

      // Calculate weighted overall score
      const overallScore = (
        identityScore * this.COMPONENT_WEIGHTS.identity +
        documentScore * this.COMPONENT_WEIGHTS.document +
        businessScore * this.COMPONENT_WEIGHTS.business +
        behavioralScore * this.COMPONENT_WEIGHTS.behavioral +
        geographicScore * this.COMPONENT_WEIGHTS.geographic
      );

      // Determine risk category
      const riskCategory = this.categorizeRisk(overallScore);

      // Collect all risk factors
      const riskFactors: RiskFactor[] = [];
      
      // Add identity risk factors
      riskFactors.push(...await this.getIdentityRiskFactors(verification));
      
      // Add document risk factors
      riskFactors.push(...await this.getDocumentRiskFactors(verification.kyc_documents || []));
      
      // Add business risk factors
      if (verification.businesses) {
        riskFactors.push(...await this.getBusinessRiskFactors(verification.businesses));
      }

      // Generate recommendations
      const recommendations = this.generateRecommendations(overallScore, riskFactors);

      // Determine review requirements
      const requiresManualReview = this.shouldRequireManualReview(overallScore, riskFactors);
      const autoApprovalEligible = this.isAutoApprovalEligible(overallScore, riskFactors);

      // Calculate overall confidence
      const confidence = this.calculateAssessmentConfidence(riskFactors);

      return {
        overallScore: Math.round(overallScore * 100) / 100,
        riskCategory,
        componentScores: {
          identity: Math.round(identityScore * 100) / 100,
          document: Math.round(documentScore * 100) / 100,
          business: Math.round(businessScore * 100) / 100,
          behavioral: Math.round(behavioralScore * 100) / 100,
          geographic: Math.round(geographicScore * 100) / 100
        },
        riskFactors,
        recommendations,
        requiresManualReview,
        autoApprovalEligible,
        confidence: Math.round(confidence * 100) / 100
      };

    } catch (error) {
      throw new Error(`Risk assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect fraud indicators in verification
   */
  async detectFraudIndicators(verificationId: string): Promise<FraudIndicator[]> {
    const indicators: FraudIndicator[] = [];

    try {
      // Get verification with related data
      const { data: verification } = await this.supabase
        .from('kyc_verifications')
        .select(`
          *,
          kyc_documents(*),
          auth_users:user_id(*)
        `)
        .eq('id', verificationId)
        .single();

      if (!verification) {
        return indicators;
      }

      // Check for duplicate documents
      indicators.push(...await this.checkDuplicateDocuments(verification.kyc_documents || []));

      // Check for suspicious document patterns
      indicators.push(...await this.checkSuspiciousDocumentPatterns(verification.kyc_documents || []));

      // Check for velocity abuse (too many verifications)
      indicators.push(...await this.checkVelocityAbuse(verification.user_id));

      // Check for synthetic identity indicators
      indicators.push(...await this.checkSyntheticIdentity(verification));

      // Check for document tampering
      indicators.push(...await this.checkDocumentTampering(verification.kyc_documents || []));

      // Check for inconsistent information
      indicators.push(...await this.checkInformationConsistency(verification));

      return indicators.sort((a, b) => this.getSeverityScore(b.severity) - this.getSeverityScore(a.severity));

    } catch (error) {
      console.error('Fraud detection failed:', error);
      return indicators;
    }
  }

  /**
   * Screen against compliance watchlists
   */
  async performComplianceScreening(verificationId: string): Promise<ComplianceFlag[]> {
    const flags: ComplianceFlag[] = [];

    try {
      const { data: verification } = await this.supabase
        .from('kyc_verifications')
        .select(`
          *,
          kyc_documents(*),
          businesses(*),
          auth_users:user_id(*)
        `)
        .eq('id', verificationId)
        .single();

      if (!verification) {
        return flags;
      }

      // AML screening
      flags.push(...await this.performAMLScreening(verification));

      // Sanctions screening
      flags.push(...await this.performSanctionsScreening(verification));

      // PEP screening
      flags.push(...await this.performPEPScreening(verification));

      // Adverse media screening
      flags.push(...await this.performAdverseMediaScreening(verification));

      return flags;

    } catch (error) {
      console.error('Compliance screening failed:', error);
      return flags;
    }
  }

  /**
   * Calculate identity risk score (0-100, higher = riskier)
   */
  private async calculateIdentityRisk(verification: any): Promise<number> {
    let score = 10; // Base score

    // Check account age
    const accountAge = Date.now() - new Date(verification.auth_users?.created_at || verification.created_at).getTime();
    const ageInDays = accountAge / (1000 * 60 * 60 * 24);

    if (ageInDays < 1) {
      score += 40; // Very new account
    } else if (ageInDays < 7) {
      score += 25; // New account
    } else if (ageInDays < 30) {
      score += 15; // Recent account
    }

    // Check email verification
    if (!verification.auth_users?.email_confirmed_at) {
      score += 20;
    }

    // Check for multiple verifications
    const { data: verificationCount } = await this.supabase
      .from('kyc_verifications')
      .select('id', { count: 'exact' })
      .eq('user_id', verification.user_id);

    if ((verificationCount?.length || 0) > 3) {
      score += 15; // Multiple verification attempts
    }

    return Math.min(score, 100);
  }

  /**
   * Calculate document risk score
   */
  private async calculateDocumentRisk(documents: any[]): Promise<number> {
    if (documents.length === 0) {
      return 80; // No documents is high risk
    }

    let score = 5; // Base score
    let totalDocuments = documents.length;
    let suspiciousDocuments = 0;
    let lowQualityDocuments = 0;

    for (const doc of documents) {
      // Check validation status
      if (doc.validation_status === 'suspicious') {
        suspiciousDocuments++;
        score += 25;
      } else if (doc.validation_status === 'invalid') {
        suspiciousDocuments++;
        score += 30;
      } else if (doc.validation_status === 'expired') {
        score += 20;
      }

      // Check document quality
      if (doc.document_quality_score && doc.document_quality_score < 50) {
        lowQualityDocuments++;
        score += 15;
      } else if (doc.document_quality_score && doc.document_quality_score < 70) {
        score += 8;
      }

      // Check OCR confidence
      if (doc.ocr_confidence && doc.ocr_confidence < 70) {
        score += 10;
      }

      // Check for fraud indicators
      if (doc.fraud_indicators && Array.isArray(doc.fraud_indicators) && doc.fraud_indicators.length > 0) {
        score += doc.fraud_indicators.length * 5;
      }
    }

    // Apply penalties based on ratios
    const suspiciousRatio = suspiciousDocuments / totalDocuments;
    if (suspiciousRatio > 0.5) {
      score += 20; // More than half are suspicious
    }

    const lowQualityRatio = lowQualityDocuments / totalDocuments;
    if (lowQualityRatio > 0.3) {
      score += 15; // More than 30% are low quality
    }

    return Math.min(score, 100);
  }

  /**
   * Calculate business risk score
   */
  private async calculateBusinessRisk(business: any): Promise<number> {
    let score = 5; // Base score

    // Check business age
    const businessAge = Date.now() - new Date(business.created_at).getTime();
    const ageInDays = businessAge / (1000 * 60 * 60 * 24);

    if (ageInDays < 30) {
      score += 25; // Very new business
    } else if (ageInDays < 90) {
      score += 15; // New business
    }

    // Check verification status
    if (business.verification_status === 'rejected') {
      score += 35;
    } else if (business.verification_status === 'pending') {
      score += 10;
    }

    // Check business completeness
    let completenessScore = 0;
    const requiredFields = ['name', 'description', 'phone', 'email', 'address_line_1', 'city', 'state'];
    
    for (const field of requiredFields) {
      if (!business[field] || business[field].trim() === '') {
        completenessScore += 5;
      }
    }
    
    score += completenessScore;

    // Check for suspicious patterns
    if (business.name && business.name.match(/test|fake|dummy|example/i)) {
      score += 20;
    }

    return Math.min(score, 100);
  }

  /**
   * Calculate behavioral risk score
   */
  private async calculateBehavioralRisk(verification: any): Promise<number> {
    let score = 5; // Base score

    // Check verification submission speed (too fast might be suspicious)
    if (verification.submitted_at && verification.initiated_at) {
      const submissionTime = new Date(verification.submitted_at).getTime() - new Date(verification.initiated_at).getTime();
      const submissionMinutes = submissionTime / (1000 * 60);
      
      if (submissionMinutes < 5) {
        score += 15; // Suspiciously fast
      }
    }

    // Check for multiple failed attempts
    const { data: failedAttempts } = await this.supabase
      .from('kyc_verifications')
      .select('id')
      .eq('user_id', verification.user_id)
      .eq('decision', 'rejected');

    if (failedAttempts && failedAttempts.length > 1) {
      score += failedAttempts.length * 10;
    }

    return Math.min(score, 100);
  }

  /**
   * Calculate geographic risk score
   */
  private async calculateGeographicRisk(verification: any): Promise<number> {
    let score = 5; // Base score for US operations

    // This would integrate with IP geolocation and business address analysis
    // For now, we'll use placeholder logic
    
    // Check if business location matches expected patterns
    if (verification.businesses?.country && verification.businesses.country !== 'United States') {
      score += 10; // International business
    }

    // High-risk geographic indicators would be added here
    // e.g., certain states or regions with higher fraud rates

    return Math.min(score, 100);
  }

  /**
   * Check for duplicate documents across verifications
   */
  private async checkDuplicateDocuments(documents: any[]): Promise<FraudIndicator[]> {
    const indicators: FraudIndicator[] = [];

    for (const doc of documents) {
      if (!doc.file_hash) continue;

      const { data: duplicates } = await this.supabase
        .from('kyc_documents')
        .select('id, verification_id')
        .eq('file_hash', doc.file_hash)
        .neq('id', doc.id)
        .is('deleted_at', null)
        .limit(5);

      if (duplicates && duplicates.length > 0) {
        indicators.push({
          type: 'duplicate_document',
          severity: 'high',
          score: 30,
          description: `Document file has been submitted ${duplicates.length} other times`,
          evidence: { duplicateVerifications: duplicates.map(d => d.verification_id) },
          detectionMethod: 'file_hash_comparison'
        });
      }
    }

    return indicators;
  }

  /**
   * Check for suspicious document patterns
   */
  private async checkSuspiciousDocumentPatterns(documents: any[]): Promise<FraudIndicator[]> {
    const indicators: FraudIndicator[] = [];

    // Check for documents uploaded too quickly
    const sortedDocs = documents.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    for (let i = 1; i < sortedDocs.length; i++) {
      const timeDiff = new Date(sortedDocs[i].created_at).getTime() - new Date(sortedDocs[i-1].created_at).getTime();
      const diffSeconds = timeDiff / 1000;
      
      if (diffSeconds < 10) { // Less than 10 seconds between uploads
        indicators.push({
          type: 'rapid_document_upload',
          severity: 'medium',
          score: 15,
          description: 'Documents uploaded in rapid succession',
          evidence: { uploadInterval: diffSeconds },
          detectionMethod: 'temporal_analysis'
        });
        break;
      }
    }

    // Check for identical file names (possible copy-paste)
    const fileNames = documents.map(d => d.original_file_name || d.file_name);
    const duplicateNames = fileNames.filter((name, index) => fileNames.indexOf(name) !== index);
    
    if (duplicateNames.length > 0) {
      indicators.push({
        type: 'identical_file_names',
        severity: 'medium',
        score: 12,
        description: 'Multiple documents with identical file names',
        evidence: { duplicateNames: [...new Set(duplicateNames)] },
        detectionMethod: 'filename_analysis'
      });
    }

    return indicators;
  }

  /**
   * Check for velocity abuse
   */
  private async checkVelocityAbuse(userId: string): Promise<FraudIndicator[]> {
    const indicators: FraudIndicator[] = [];

    // Check for multiple verifications in short time period
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentVerifications } = await this.supabase
      .from('kyc_verifications')
      .select('id, created_at')
      .eq('user_id', userId)
      .gte('created_at', oneWeekAgo);

    if (recentVerifications && recentVerifications.length > 3) {
      indicators.push({
        type: 'velocity_abuse',
        severity: 'high',
        score: 25,
        description: `${recentVerifications.length} verifications initiated within one week`,
        evidence: { verificationCount: recentVerifications.length, timeWindow: '7_days' },
        detectionMethod: 'velocity_analysis'
      });
    }

    return indicators;
  }

  /**
   * Check for synthetic identity indicators
   */
  private async checkSyntheticIdentity(verification: any): Promise<FraudIndicator[]> {
    const indicators: FraudIndicator[] = [];

    // This would integrate with credit bureau data and identity verification services
    // For now, we'll use placeholder logic based on available data

    // Check for inconsistent information across documents
    const documents = verification.kyc_documents || [];
    const extractedNames: string[] = [];
    const extractedDOBs: string[] = [];

    for (const doc of documents) {
      if (doc.extracted_data) {
        const data = typeof doc.extracted_data === 'string' ? JSON.parse(doc.extracted_data) : doc.extracted_data;
        
        if (data.first_name && data.last_name) {
          extractedNames.push(`${data.first_name} ${data.last_name}`.toLowerCase());
        }
        
        if (data.date_of_birth) {
          extractedDOBs.push(data.date_of_birth);
        }
      }
    }

    // Check for name inconsistencies
    const uniqueNames = [...new Set(extractedNames)];
    if (uniqueNames.length > 1) {
      indicators.push({
        type: 'name_inconsistency',
        severity: 'high',
        score: 30,
        description: 'Inconsistent names found across documents',
        evidence: { names: uniqueNames },
        detectionMethod: 'cross_document_analysis'
      });
    }

    // Check for DOB inconsistencies
    const uniqueDOBs = [...new Set(extractedDOBs)];
    if (uniqueDOBs.length > 1) {
      indicators.push({
        type: 'dob_inconsistency',
        severity: 'critical',
        score: 40,
        description: 'Inconsistent dates of birth found across documents',
        evidence: { dobs: uniqueDOBs },
        detectionMethod: 'cross_document_analysis'
      });
    }

    return indicators;
  }

  /**
   * Check for document tampering
   */
  private async checkDocumentTampering(documents: any[]): Promise<FraudIndicator[]> {
    const indicators: FraudIndicator[] = [];

    for (const doc of documents) {
      // Check document quality score
      if (doc.document_quality_score && doc.document_quality_score < 30) {
        indicators.push({
          type: 'poor_document_quality',
          severity: 'medium',
          score: 15,
          description: 'Document quality is suspiciously low, may indicate tampering',
          evidence: { qualityScore: doc.document_quality_score, documentId: doc.id },
          detectionMethod: 'quality_analysis'
        });
      }

      // Check for low OCR confidence
      if (doc.ocr_confidence && doc.ocr_confidence < 60) {
        indicators.push({
          type: 'low_ocr_confidence',
          severity: 'medium',
          score: 12,
          description: 'Low OCR confidence may indicate altered or poor quality document',
          evidence: { ocrConfidence: doc.ocr_confidence, documentId: doc.id },
          detectionMethod: 'ocr_analysis'
        });
      }
    }

    return indicators;
  }

  /**
   * Check information consistency
   */
  private async checkInformationConsistency(verification: any): Promise<FraudIndicator[]> {
    const indicators: FraudIndicator[] = [];

    // This would perform comprehensive cross-validation of information
    // across documents, business details, and user profile
    
    // Placeholder for consistency checks
    return indicators;
  }

  /**
   * Perform AML screening
   */
  private async performAMLScreening(verification: any): Promise<ComplianceFlag[]> {
    const flags: ComplianceFlag[] = [];

    // Screen against AML watchlists
    const { data: amlMatches } = await this.supabase.rpc('screen_against_watchlists', {
      p_entity_type: 'person',
      p_entity_value: verification.auth_users?.email || '',
      p_verification_id: verification.id
    });

    if (amlMatches && amlMatches.high_risk_matches > 0) {
      flags.push({
        type: 'aml',
        severity: 'critical',
        description: 'Found matches in AML watchlists',
        source: 'internal_watchlist',
        requiresEscalation: true
      });
    }

    return flags;
  }

  /**
   * Perform sanctions screening
   */
  private async performSanctionsScreening(verification: any): Promise<ComplianceFlag[]> {
    const flags: ComplianceFlag[] = [];

    // This would integrate with OFAC, EU, UN sanctions lists
    // For now, placeholder implementation
    
    return flags;
  }

  /**
   * Perform PEP screening
   */
  private async performPEPScreening(verification: any): Promise<ComplianceFlag[]> {
    const flags: ComplianceFlag[] = [];

    // This would screen against Politically Exposed Persons lists
    // Placeholder implementation
    
    return flags;
  }

  /**
   * Perform adverse media screening
   */
  private async performAdverseMediaScreening(verification: any): Promise<ComplianceFlag[]> {
    const flags: ComplianceFlag[] = [];

    // This would screen against adverse media sources
    // Placeholder implementation
    
    return flags;
  }

  /**
   * Helper methods
   */
  private categorizeRisk(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score <= this.RISK_THRESHOLDS.low) return 'low';
    if (score <= this.RISK_THRESHOLDS.medium) return 'medium';
    if (score <= this.RISK_THRESHOLDS.high) return 'high';
    return 'critical';
  }

  private getSeverityScore(severity: string): number {
    const scores = { low: 1, medium: 2, high: 3, critical: 4 };
    return scores[severity as keyof typeof scores] || 0;
  }

  private generateRecommendations(score: number, riskFactors: RiskFactor[]): string[] {
    const recommendations: string[] = [];

    if (score > this.RISK_THRESHOLDS.high) {
      recommendations.push('Requires manual review by senior compliance officer');
      recommendations.push('Consider requesting additional documentation');
    } else if (score > this.RISK_THRESHOLDS.medium) {
      recommendations.push('Requires manual review');
      recommendations.push('Verify document authenticity');
    }

    // Add specific recommendations based on risk factors
    const documentRisks = riskFactors.filter(f => f.category === 'document');
    if (documentRisks.length > 0) {
      recommendations.push('Review document quality and validation results');
    }

    const identityRisks = riskFactors.filter(f => f.category === 'identity');
    if (identityRisks.length > 0) {
      recommendations.push('Perform additional identity verification checks');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  private shouldRequireManualReview(score: number, riskFactors: RiskFactor[]): boolean {
    if (score > this.RISK_THRESHOLDS.medium) return true;
    
    const criticalFactors = riskFactors.filter(f => f.severity === 'critical');
    if (criticalFactors.length > 0) return true;

    const highFactors = riskFactors.filter(f => f.severity === 'high');
    if (highFactors.length > 2) return true;

    return false;
  }

  private isAutoApprovalEligible(score: number, riskFactors: RiskFactor[]): boolean {
    if (score > this.RISK_THRESHOLDS.low) return false;
    
    const highOrCriticalFactors = riskFactors.filter(f => 
      f.severity === 'high' || f.severity === 'critical'
    );
    
    return highOrCriticalFactors.length === 0;
  }

  private calculateAssessmentConfidence(riskFactors: RiskFactor[]): number {
    if (riskFactors.length === 0) return 50; // Low confidence with no data

    const avgConfidence = riskFactors.reduce((sum, factor) => sum + factor.confidence, 0) / riskFactors.length;
    
    // Boost confidence if multiple factors agree
    const consistencyBoost = Math.min(riskFactors.length * 2, 20);
    
    return Math.min(avgConfidence + consistencyBoost, 100);
  }

  private async getIdentityRiskFactors(verification: any): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    const accountAge = Date.now() - new Date(verification.auth_users?.created_at || verification.created_at).getTime();
    const ageInDays = accountAge / (1000 * 60 * 60 * 24);

    if (ageInDays < 1) {
      factors.push({
        type: 'new_account',
        category: 'identity',
        impact: 40,
        confidence: 95,
        description: 'User account created within 24 hours',
        severity: 'high',
        source: 'account_analysis'
      });
    }

    return factors;
  }

  private async getDocumentRiskFactors(documents: any[]): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    if (documents.length === 0) {
      factors.push({
        type: 'no_documents',
        category: 'document',
        impact: 80,
        confidence: 100,
        description: 'No documents submitted for verification',
        severity: 'critical',
        source: 'document_analysis'
      });
    }

    return factors;
  }

  private async getBusinessRiskFactors(business: any): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    const businessAge = Date.now() - new Date(business.created_at).getTime();
    const ageInDays = businessAge / (1000 * 60 * 60 * 24);

    if (ageInDays < 30) {
      factors.push({
        type: 'new_business',
        category: 'business',
        impact: 25,
        confidence: 90,
        description: 'Business created within 30 days',
        severity: 'medium',
        source: 'business_analysis'
      });
    }

    return factors;
  }
}

// Export singleton instance
export const riskAssessmentService = new RiskAssessmentService();