/**
 * EPIC 5 STORY 5.9: International Payments & Tax Compliance
 * Compliance Monitor - GDPR, PCI DSS & Regulatory Compliance
 * 
 * Comprehensive compliance monitoring system including:
 * - GDPR data protection and consent management
 * - PCI DSS payment security compliance
 * - AML (Anti-Money Laundering) screening
 * - Sanctions list checking
 * - KYC (Know Your Customer) verification
 * - Audit trail maintenance
 * - Regulatory reporting
 */

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import crypto from 'crypto';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface ComplianceEvent {
  eventType: string;
  entityType: 'customer' | 'transaction' | 'payment_method' | 'business';
  entityId: string;
  userId?: string;
  complianceRule: string;
  status: 'passed' | 'failed' | 'pending' | 'manual_review';
  details: Record<string, any>;
  externalReference?: string;
  riskScore?: number;
  reviewedBy?: string;
  reviewedAt?: Date;
}

export interface KYCCheckData {
  customerId: string;
  amount: number;
  country: string;
  documentType?: string;
  documentNumber?: string;
  customerType?: 'individual' | 'business';
}

export interface KYCCheckResult {
  passed: boolean;
  riskScore: number;
  checks: string[];
  requiresManualReview?: boolean;
  failureReasons?: string[];
  documentVerification?: DocumentVerificationResult;
}

export interface DocumentVerificationResult {
  documentValid: boolean;
  documentType: string;
  extractedData?: Record<string, any>;
  confidenceScore?: number;
}

export interface SanctionsCheckData {
  customerId: string;
  customerName?: string;
  country: string;
  businessName?: string;
  addresses?: AddressInfo[];
}

export interface SanctionsCheckResult {
  match: boolean;
  riskScore: number;
  matchedEntity?: string;
  sanctionsList?: string;
  confidence?: number;
}

export interface GDPRComplianceData {
  customerId: string;
  consentGiven?: boolean;
  dataProcessingPurpose?: string;
  retentionPeriod?: number;
  rightToErasure?: boolean;
}

export interface GDPRComplianceResult {
  compliant: boolean;
  consentDate?: Date;
  dataProcessingLegal: boolean;
  retentionCompliant: boolean;
  issues?: string[];
}

export interface DataExportRequest {
  customerId: string;
  requestType: 'export' | 'deletion' | 'rectification' | 'portability';
  requesterEmail: string;
  verificationMethod: 'email' | 'document';
  requestReason?: string;
}

export interface ComplianceReportData {
  reportType: 'vat_return' | 'moss_report' | 'aml_suspicious_activity' | 'gdpr_compliance';
  jurisdiction?: string;
  periodStart: Date;
  periodEnd: Date;
  includeTransactionDetails?: boolean;
}

export interface ComplianceReportResult {
  reportId: string;
  totalTransactions: number;
  totalTaxCollected: number;
  suspiciousActivities?: number;
  gdprRequests?: number;
  filePath: string;
  format: 'xml' | 'csv' | 'pdf';
  generatedAt: Date;
}

interface AddressInfo {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

// =============================================
// VALIDATION SCHEMAS
// =============================================

const KYCCheckSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().positive(),
  country: z.string().length(2),
  documentType: z.string().optional(),
  documentNumber: z.string().optional(),
  customerType: z.enum(['individual', 'business']).default('individual'),
});

const SanctionsCheckSchema = z.object({
  customerId: z.string().uuid(),
  customerName: z.string().optional(),
  country: z.string().length(2),
  businessName: z.string().optional(),
});

const GDPRComplianceSchema = z.object({
  customerId: z.string().uuid(),
  consentGiven: z.boolean().default(false),
  dataProcessingPurpose: z.string().default('payment_processing'),
  retentionPeriod: z.number().default(2555), // 7 years in days
  rightToErasure: z.boolean().default(true),
});

// =============================================
// COMPLIANCE MONITOR CLASS
// =============================================

export class ComplianceMonitor {
  private supabase;
  private sanctionsCache: Map<string, SanctionsCheckResult> = new Map();
  private kycCache: Map<string, KYCCheckResult> = new Map();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  // High-risk countries (simplified list)
  private readonly HIGH_RISK_COUNTRIES = [
    'AF', 'BY', 'CF', 'CN', 'CU', 'IR', 'IQ', 'KP', 'LY', 'MM',
    'RU', 'SO', 'SS', 'SD', 'SY', 'VE', 'YE', 'ZW'
  ];

  // PEP (Politically Exposed Person) indicators
  private readonly PEP_KEYWORDS = [
    'president', 'minister', 'ambassador', 'general', 'colonel',
    'director', 'governor', 'mayor', 'senator', 'deputy'
  ];

  constructor() {
    this.supabase = createClient();
  }

  // =============================================
  // MAIN COMPLIANCE METHODS
  // =============================================

  /**
   * Perform comprehensive KYC check
   */
  async performKYCCheck(data: KYCCheckData): Promise<KYCCheckResult> {
    try {
      const validatedData = KYCCheckSchema.parse(data);
      
      // Check cache first
      const cacheKey = `kyc-${validatedData.customerId}-${validatedData.amount}`;
      const cached = this.kycCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      let riskScore = 0;
      const checks: string[] = [];
      const failureReasons: string[] = [];
      let requiresManualReview = false;

      // 1. Country risk assessment
      if (this.HIGH_RISK_COUNTRIES.includes(validatedData.country)) {
        riskScore += 30;
        checks.push('high_risk_country');
        requiresManualReview = true;
      }

      // 2. Transaction amount risk
      if (validatedData.amount > 1000000) { // €10,000
        riskScore += 25;
        checks.push('high_value_transaction');
        requiresManualReview = true;
      } else if (validatedData.amount > 500000) { // €5,000
        riskScore += 15;
        checks.push('medium_value_transaction');
      }

      // 3. Customer verification
      const customerVerification = await this.verifyCustomerIdentity(validatedData);
      riskScore += customerVerification.riskScore;
      checks.push(...customerVerification.checks);
      
      if (!customerVerification.passed) {
        failureReasons.push(...(customerVerification.failureReasons || []));
      }

      // 4. Document verification (if provided)
      let documentVerification: DocumentVerificationResult | undefined;
      if (validatedData.documentType && validatedData.documentNumber) {
        documentVerification = await this.verifyDocument(
          validatedData.documentType,
          validatedData.documentNumber,
          validatedData.country
        );
        
        if (documentVerification.documentValid) {
          riskScore -= 10; // Reduce risk for valid documents
          checks.push('document_verified');
        } else {
          riskScore += 20;
          checks.push('document_invalid');
          failureReasons.push('Document verification failed');
        }
      }

      // 5. Business-specific checks
      if (validatedData.customerType === 'business') {
        const businessVerification = await this.verifyBusinessEntity(validatedData.customerId);
        riskScore += businessVerification.riskScore;
        checks.push(...businessVerification.checks);
      }

      // Determine if manual review is required
      if (riskScore > 50 || failureReasons.length > 0) {
        requiresManualReview = true;
      }

      const result: KYCCheckResult = {
        passed: failureReasons.length === 0,
        riskScore: Math.min(riskScore, 100),
        checks,
        requiresManualReview,
        failureReasons: failureReasons.length > 0 ? failureReasons : undefined,
        documentVerification,
      };

      // Cache result
      this.kycCache.set(cacheKey, result);

      // Log compliance event
      await this.logComplianceEvent({
        eventType: 'kyc_check',
        entityType: 'customer',
        entityId: validatedData.customerId,
        complianceRule: 'kyc_verification',
        status: result.passed ? 'passed' : 'failed',
        details: {
          riskScore: result.riskScore,
          checks: result.checks,
          amount: validatedData.amount,
          country: validatedData.country,
          requiresManualReview,
        },
        riskScore: result.riskScore,
      });

      return result;

    } catch (error) {
      console.error('KYC check error:', error);
      throw new Error(`KYC check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check against sanctions lists
   */
  async checkSanctionsList(data: SanctionsCheckData): Promise<SanctionsCheckResult> {
    try {
      const validatedData = SanctionsCheckSchema.parse(data);
      
      // Check cache first
      const cacheKey = `sanctions-${validatedData.customerId}-${validatedData.country}`;
      const cached = this.sanctionsCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      let match = false;
      let riskScore = 0;
      let matchedEntity: string | undefined;
      let sanctionsList: string | undefined;

      // 1. Country sanctions check
      if (this.HIGH_RISK_COUNTRIES.includes(validatedData.country)) {
        match = true;
        riskScore = 100;
        matchedEntity = `High-risk country: ${validatedData.country}`;
        sanctionsList = 'OFAC Country List';
      }

      // 2. Name-based sanctions screening
      if (!match && validatedData.customerName) {
        const nameCheck = await this.checkNameAgainstSanctionsDB(validatedData.customerName);
        if (nameCheck.match) {
          match = true;
          riskScore = nameCheck.confidence || 80;
          matchedEntity = nameCheck.matchedEntity;
          sanctionsList = nameCheck.sanctionsList;
        }
      }

      // 3. Business name screening
      if (!match && validatedData.businessName) {
        const businessCheck = await this.checkNameAgainstSanctionsDB(validatedData.businessName);
        if (businessCheck.match) {
          match = true;
          riskScore = businessCheck.confidence || 80;
          matchedEntity = businessCheck.matchedEntity;
          sanctionsList = businessCheck.sanctionsList;
        }
      }

      // 4. PEP (Politically Exposed Person) screening
      if (!match && validatedData.customerName) {
        const pepCheck = this.checkPEPIndicators(validatedData.customerName);
        if (pepCheck.match) {
          riskScore = Math.max(riskScore, 60);
          // Don't set as sanctioned, but flag for enhanced due diligence
        }
      }

      const result: SanctionsCheckResult = {
        match,
        riskScore,
        matchedEntity,
        sanctionsList,
        confidence: riskScore,
      };

      // Cache result
      this.sanctionsCache.set(cacheKey, result);

      // Log compliance event
      await this.logComplianceEvent({
        eventType: 'sanctions_check',
        entityType: 'customer',
        entityId: validatedData.customerId,
        complianceRule: 'sanctions_screening',
        status: match ? 'failed' : 'passed',
        details: {
          riskScore,
          country: validatedData.country,
          matchedEntity,
          sanctionsList,
        },
        riskScore,
      });

      return result;

    } catch (error) {
      console.error('Sanctions check error:', error);
      throw new Error(`Sanctions check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate GDPR compliance
   */
  async validateGDPRCompliance(data: GDPRComplianceData): Promise<GDPRComplianceResult> {
    try {
      const validatedData = GDPRComplianceSchema.parse(data);
      
      const issues: string[] = [];
      let compliant = true;
      let consentDate: Date | undefined;
      
      // Check consent status
      const consentRecord = await this.getCustomerConsent(validatedData.customerId);
      
      if (!consentRecord || !consentRecord.gdpr_consent) {
        issues.push('Missing or invalid GDPR consent');
        compliant = false;
      } else {
        consentDate = new Date(consentRecord.gdpr_consent_date);
      }

      // Check data processing lawfulness
      const dataProcessingLegal = this.validateDataProcessingLawfulness(
        validatedData.dataProcessingPurpose,
        !!consentRecord?.gdpr_consent
      );
      
      if (!dataProcessingLegal) {
        issues.push('Data processing lacks legal basis');
        compliant = false;
      }

      // Check data retention compliance
      const retentionCompliant = await this.validateDataRetention(
        validatedData.customerId,
        validatedData.retentionPeriod
      );
      
      if (!retentionCompliant) {
        issues.push('Data retention period exceeded');
        compliant = false;
      }

      const result: GDPRComplianceResult = {
        compliant,
        consentDate,
        dataProcessingLegal,
        retentionCompliant,
        issues: issues.length > 0 ? issues : undefined,
      };

      // Log compliance event
      await this.logComplianceEvent({
        eventType: 'gdpr_compliance_check',
        entityType: 'customer',
        entityId: validatedData.customerId,
        complianceRule: 'gdpr_compliance',
        status: compliant ? 'passed' : 'failed',
        details: {
          consentGiven: !!consentRecord?.gdpr_consent,
          dataProcessingPurpose: validatedData.dataProcessingPurpose,
          issues,
        },
      });

      return result;

    } catch (error) {
      console.error('GDPR compliance validation error:', error);
      throw new Error(`GDPR compliance validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Log compliance events
   */
  async logComplianceEvent(event: ComplianceEvent): Promise<void> {
    try {
      await this.supabase
        .from('compliance_audit_log')
        .insert({
          event_type: event.eventType,
          entity_type: event.entityType,
          entity_id: event.entityId,
          user_id: event.userId,
          compliance_rule: event.complianceRule,
          status: event.status,
          details: event.details,
          external_reference: event.externalReference,
          risk_score: event.riskScore,
          reviewed_by: event.reviewedBy,
          reviewed_at: event.reviewedAt?.toISOString(),
        });

    } catch (error) {
      console.error('Error logging compliance event:', error);
      // Don't throw - logging failure shouldn't stop processing
    }
  }

  /**
   * Generate compliance reports
   */
  async generateComplianceReport(data: ComplianceReportData): Promise<ComplianceReportResult> {
    try {
      const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      let totalTransactions = 0;
      let totalTaxCollected = 0;
      let suspiciousActivities = 0;
      let gdprRequests = 0;

      // Query transaction data
      const { data: transactions } = await this.supabase
        .from('international_transactions')
        .select('*')
        .gte('created_at', data.periodStart.toISOString())
        .lte('created_at', data.periodEnd.toISOString());

      if (transactions) {
        totalTransactions = transactions.length;
        totalTaxCollected = transactions.reduce((sum, t) => sum + (t.tax_amount || 0), 0);
      }

      // Query compliance events
      const { data: complianceEvents } = await this.supabase
        .from('compliance_audit_log')
        .select('*')
        .gte('created_at', data.periodStart.toISOString())
        .lte('created_at', data.periodEnd.toISOString());

      if (complianceEvents) {
        suspiciousActivities = complianceEvents.filter(e => 
          e.event_type.includes('aml') || e.risk_score > 70
        ).length;
      }

      // Query GDPR requests
      const { data: gdprData } = await this.supabase
        .from('gdpr_data_requests')
        .select('*')
        .gte('created_at', data.periodStart.toISOString())
        .lte('created_at', data.periodEnd.toISOString());

      if (gdprData) {
        gdprRequests = gdprData.length;
      }

      // Generate report file (simplified - would create actual XML/PDF)
      const filePath = `/reports/${reportId}.xml`;
      
      // Store report record
      await this.supabase
        .from('regulatory_reports')
        .insert({
          report_type: data.reportType,
          jurisdiction_id: data.jurisdiction ? 
            (await this.getJurisdictionId(data.jurisdiction)) : null,
          period_start: data.periodStart.toISOString().split('T')[0],
          period_end: data.periodEnd.toISOString().split('T')[0],
          total_transactions: totalTransactions,
          total_amount: transactions?.reduce((sum, t) => sum + t.settlement_amount, 0) || 0,
          total_tax_collected: totalTaxCollected,
          file_path: filePath,
          file_format: 'xml',
        });

      return {
        reportId,
        totalTransactions,
        totalTaxCollected,
        suspiciousActivities,
        gdprRequests,
        filePath,
        format: 'xml',
        generatedAt: new Date(),
      };

    } catch (error) {
      console.error('Error generating compliance report:', error);
      throw new Error(`Failed to generate compliance report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // HELPER METHODS
  // =============================================

  /**
   * Verify customer identity
   */
  private async verifyCustomerIdentity(data: KYCCheckData): Promise<{
    passed: boolean;
    riskScore: number;
    checks: string[];
    failureReasons?: string[];
  }> {
    let riskScore = 0;
    const checks: string[] = [];
    const failureReasons: string[] = [];

    try {
      // Get customer data
      const { data: customer } = await this.supabase
        .from('international_customers')
        .select('*')
        .eq('stripe_customer_id', data.customerId)
        .single();

      if (!customer) {
        return {
          passed: false,
          riskScore: 100,
          checks: ['customer_not_found'],
          failureReasons: ['Customer not found in database'],
        };
      }

      // Check verification status
      if (customer.compliance_status === 'verified') {
        riskScore -= 15;
        checks.push('previously_verified');
      } else if (customer.compliance_status === 'rejected') {
        riskScore += 50;
        checks.push('previously_rejected');
        failureReasons.push('Customer previously rejected');
      }

      // Check required fields
      if (!customer.vat_number && data.customerType === 'business') {
        riskScore += 10;
        checks.push('missing_vat_number');
      }

      checks.push('identity_verification');

    } catch (error) {
      console.error('Customer identity verification error:', error);
      riskScore += 20;
      checks.push('verification_error');
    }

    return {
      passed: failureReasons.length === 0,
      riskScore,
      checks,
      failureReasons: failureReasons.length > 0 ? failureReasons : undefined,
    };
  }

  /**
   * Verify document authenticity (mock implementation)
   */
  private async verifyDocument(
    documentType: string,
    documentNumber: string,
    country: string
  ): Promise<DocumentVerificationResult> {
    try {
      // Mock document verification - in production, integrate with document verification service
      const documentValid = documentNumber.length >= 8 && /^[A-Z0-9]+$/i.test(documentNumber);
      
      return {
        documentValid,
        documentType,
        extractedData: documentValid ? {
          documentNumber,
          country,
          issueDate: new Date(),
        } : undefined,
        confidenceScore: documentValid ? 85 : 0,
      };

    } catch (error) {
      console.error('Document verification error:', error);
      return {
        documentValid: false,
        documentType,
      };
    }
  }

  /**
   * Verify business entity
   */
  private async verifyBusinessEntity(customerId: string): Promise<{
    riskScore: number;
    checks: string[];
  }> {
    // Mock business verification
    return {
      riskScore: 5,
      checks: ['business_entity_check'],
    };
  }

  /**
   * Check name against sanctions database (mock)
   */
  private async checkNameAgainstSanctionsDB(name: string): Promise<{
    match: boolean;
    confidence?: number;
    matchedEntity?: string;
    sanctionsList?: string;
  }> {
    // Mock sanctions check - in production, integrate with OFAC, EU sanctions, etc.
    const suspiciousNames = ['test sanctioned person', 'blocked entity'];
    const nameMatch = suspiciousNames.some(suspName => 
      name.toLowerCase().includes(suspName.toLowerCase())
    );

    return {
      match: nameMatch,
      confidence: nameMatch ? 95 : 0,
      matchedEntity: nameMatch ? name : undefined,
      sanctionsList: nameMatch ? 'OFAC SDN List' : undefined,
    };
  }

  /**
   * Check for PEP indicators
   */
  private checkPEPIndicators(name: string): { match: boolean } {
    const nameWords = name.toLowerCase().split(' ');
    const hasPEPKeyword = this.PEP_KEYWORDS.some(keyword => 
      nameWords.some(word => word.includes(keyword))
    );

    return { match: hasPEPKeyword };
  }

  /**
   * Get customer consent record
   */
  private async getCustomerConsent(customerId: string) {
    try {
      const { data } = await this.supabase
        .from('international_customers')
        .select('gdpr_consent, gdpr_consent_date, marketing_consent')
        .eq('stripe_customer_id', customerId)
        .single();

      return data;

    } catch (error) {
      console.error('Error fetching customer consent:', error);
      return null;
    }
  }

  /**
   * Validate data processing lawfulness
   */
  private validateDataProcessingLawfulness(purpose: string, hasConsent: boolean): boolean {
    // Legal bases under GDPR Article 6
    const legitimatePurposes = [
      'payment_processing', // Necessary for contract performance
      'fraud_prevention', // Legitimate interest
      'legal_compliance', // Legal obligation
    ];

    return legitimatePurposes.includes(purpose) || hasConsent;
  }

  /**
   * Validate data retention compliance
   */
  private async validateDataRetention(customerId: string, retentionPeriod: number): Promise<boolean> {
    try {
      const { data } = await this.supabase
        .from('international_customers')
        .select('created_at')
        .eq('stripe_customer_id', customerId)
        .single();

      if (!data) return false;

      const customerAge = Date.now() - new Date(data.created_at).getTime();
      const retentionLimit = retentionPeriod * 24 * 60 * 60 * 1000; // Convert days to milliseconds

      return customerAge <= retentionLimit;

    } catch (error) {
      console.error('Error validating data retention:', error);
      return false;
    }
  }

  /**
   * Get jurisdiction ID by code
   */
  private async getJurisdictionId(jurisdictionCode: string): Promise<string | null> {
    try {
      const { data } = await this.supabase
        .from('tax_jurisdictions')
        .select('id')
        .eq('code', jurisdictionCode)
        .single();

      return data?.id || null;

    } catch (error) {
      console.error('Error fetching jurisdiction ID:', error);
      return null;
    }
  }

  /**
   * Clear expired cache
   */
  clearExpiredCache(): void {
    // Clear sanctions cache
    this.sanctionsCache.clear();
    
    // Clear KYC cache
    this.kycCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      sanctionsCacheSize: this.sanctionsCache.size,
      kycCacheSize: this.kycCache.size,
      cacheTtl: this.CACHE_TTL,
    };
  }
}

// =============================================
// SINGLETON INSTANCE
// =============================================

const complianceMonitor = new ComplianceMonitor();
export default complianceMonitor;