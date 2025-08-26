/**
 * Risk Assessment Service Test Suite
 * Epic 2 Story 2.9: Business Owner Verification & KYC
 * Comprehensive test coverage for risk assessment and fraud detection
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { RiskAssessmentService } from '@/lib/services/risk-assessment-service';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Mock Supabase client
jest.mock('@supabase/auth-helpers-nextjs');
const mockSupabase = {
  from: jest.fn(),
  rpc: jest.fn()
};

const mockFrom = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn()
};

describe('RiskAssessmentService', () => {
  let riskAssessmentService: RiskAssessmentService;

  beforeEach(() => {
    jest.clearAllMocks();
    (createClientComponentClient as jest.Mock).mockReturnValue(mockSupabase);
    mockSupabase.from.mockReturnValue(mockFrom);
    riskAssessmentService = new RiskAssessmentService(mockSupabase as any);
  });

  describe('assessVerificationRisk', () => {
    const mockVerificationData = {
      id: 'test-verification-id',
      user_id: 'test-user-id',
      business_id: 'test-business-id',
      verification_type: 'business_owner',
      status: 'under_review',
      created_at: '2023-01-15T00:00:00Z',
      kyc_documents: [
        {
          id: 'doc-1',
          file_hash: 'test-hash-1',
          validation_status: 'valid',
          document_quality_score: 85,
          ocr_confidence: 90,
          fraud_indicators: [],
          created_at: '2023-01-15T01:00:00Z'
        }
      ],
      businesses: {
        id: 'test-business-id',
        name: 'Test Business',
        created_at: '2023-01-01T00:00:00Z',
        verification_status: 'pending'
      },
      auth_users: {
        id: 'test-user-id',
        email: 'test@example.com',
        created_at: '2023-01-10T00:00:00Z'
      }
    };

    it('should calculate comprehensive risk assessment', async () => {
      mockFrom.single.mockResolvedValueOnce({
        data: mockVerificationData,
        error: null
      });

      const result = await riskAssessmentService.assessVerificationRisk('test-verification-id');

      expect(result).toBeDefined();
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      expect(result.riskCategory).toMatch(/^(low|medium|high|critical)$/);
      expect(result.componentScores).toHaveProperty('identity');
      expect(result.componentScores).toHaveProperty('document');
      expect(result.componentScores).toHaveProperty('business');
      expect(result.componentScores).toHaveProperty('behavioral');
      expect(result.componentScores).toHaveProperty('geographic');
      expect(Array.isArray(result.riskFactors)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(typeof result.requiresManualReview).toBe('boolean');
      expect(typeof result.autoApprovalEligible).toBe('boolean');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('should classify risk correctly based on score', async () => {
      mockFrom.single.mockResolvedValueOnce({
        data: mockVerificationData,
        error: null
      });

      const result = await riskAssessmentService.assessVerificationRisk('test-verification-id');

      if (result.overallScore <= 25) {
        expect(result.riskCategory).toBe('low');
      } else if (result.overallScore <= 60) {
        expect(result.riskCategory).toBe('medium');
      } else if (result.overallScore <= 80) {
        expect(result.riskCategory).toBe('high');
      } else {
        expect(result.riskCategory).toBe('critical');
      }
    });

    it('should handle high-risk new account', async () => {
      const newAccountData = {
        ...mockVerificationData,
        auth_users: {
          ...mockVerificationData.auth_users,
          created_at: new Date().toISOString() // Very new account
        }
      };

      mockFrom.single.mockResolvedValueOnce({
        data: newAccountData,
        error: null
      });

      const result = await riskAssessmentService.assessVerificationRisk('test-verification-id');

      expect(result.overallScore).toBeGreaterThan(25);
      expect(result.riskFactors.some(factor => factor.type === 'new_account')).toBe(true);
      expect(result.requiresManualReview).toBe(true);
      expect(result.autoApprovalEligible).toBe(false);
    });

    it('should handle missing documents as high risk', async () => {
      const noDocumentsData = {
        ...mockVerificationData,
        kyc_documents: []
      };

      mockFrom.single.mockResolvedValueOnce({
        data: noDocumentsData,
        error: null
      });

      const result = await riskAssessmentService.assessVerificationRisk('test-verification-id');

      expect(result.overallScore).toBeGreaterThan(50);
      expect(result.riskFactors.some(factor => factor.type === 'no_documents')).toBe(true);
      expect(result.requiresManualReview).toBe(true);
    });

    it('should handle verification not found', async () => {
      mockFrom.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' }
      });

      await expect(riskAssessmentService.assessVerificationRisk('non-existent-id'))
        .rejects.toThrow('Verification not found');
    });

    it('should weight component scores correctly', async () => {
      mockFrom.single.mockResolvedValueOnce({
        data: mockVerificationData,
        error: null
      });

      const result = await riskAssessmentService.assessVerificationRisk('test-verification-id');

      // Overall score should be weighted average
      const expectedScore = 
        result.componentScores.identity * 0.25 +
        result.componentScores.document * 0.35 +
        result.componentScores.business * 0.20 +
        result.componentScores.behavioral * 0.10 +
        result.componentScores.geographic * 0.10;

      expect(Math.abs(result.overallScore - expectedScore)).toBeLessThan(0.1);
    });
  });

  describe('detectFraudIndicators', () => {
    it('should detect duplicate documents', async () => {
      const mockVerification = {
        id: 'test-verification-id',
        user_id: 'test-user-id',
        kyc_documents: [
          {
            id: 'doc-1',
            file_hash: 'duplicate-hash',
            created_at: '2023-01-15T00:00:00Z'
          }
        ]
      };

      mockFrom.single.mockResolvedValueOnce({
        data: mockVerification,
        error: null
      });

      // Mock duplicate document found
      const mockDuplicateQuery = { ...mockFrom };
      mockDuplicateQuery.single.mockResolvedValue({
        data: [{ id: 'other-doc', verification_id: 'other-verification' }],
        error: null
      });

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'kyc_documents') {
          return mockDuplicateQuery;
        }
        return mockFrom;
      });

      const indicators = await riskAssessmentService.detectFraudIndicators('test-verification-id');

      expect(indicators.length).toBeGreaterThan(0);
      expect(indicators.some(indicator => indicator.type === 'duplicate_document')).toBe(true);
    });

    it('should detect rapid document uploads', async () => {
      const mockVerification = {
        id: 'test-verification-id',
        user_id: 'test-user-id',
        kyc_documents: [
          {
            id: 'doc-1',
            created_at: '2023-01-15T00:00:00Z',
            original_file_name: 'doc1.pdf'
          },
          {
            id: 'doc-2',
            created_at: '2023-01-15T00:00:05Z', // 5 seconds later
            original_file_name: 'doc2.pdf'
          }
        ]
      };

      mockFrom.single.mockResolvedValueOnce({
        data: mockVerification,
        error: null
      });

      const indicators = await riskAssessmentService.detectFraudIndicators('test-verification-id');

      expect(indicators.some(indicator => indicator.type === 'rapid_document_upload')).toBe(true);
    });

    it('should detect identical file names', async () => {
      const mockVerification = {
        id: 'test-verification-id',
        user_id: 'test-user-id',
        kyc_documents: [
          {
            id: 'doc-1',
            original_file_name: 'document.pdf',
            created_at: '2023-01-15T00:00:00Z'
          },
          {
            id: 'doc-2',
            original_file_name: 'document.pdf', // Same name
            created_at: '2023-01-15T00:01:00Z'
          }
        ]
      };

      mockFrom.single.mockResolvedValueOnce({
        data: mockVerification,
        error: null
      });

      const indicators = await riskAssessmentService.detectFraudIndicators('test-verification-id');

      expect(indicators.some(indicator => indicator.type === 'identical_file_names')).toBe(true);
    });

    it('should detect velocity abuse', async () => {
      const mockVerification = {
        id: 'test-verification-id',
        user_id: 'test-user-id',
        kyc_documents: []
      };

      mockFrom.single.mockResolvedValueOnce({
        data: mockVerification,
        error: null
      });

      // Mock multiple recent verifications
      const mockRecentVerifications = [
        { id: 'v1', created_at: '2023-01-15T00:00:00Z' },
        { id: 'v2', created_at: '2023-01-14T00:00:00Z' },
        { id: 'v3', created_at: '2023-01-13T00:00:00Z' },
        { id: 'v4', created_at: '2023-01-12T00:00:00Z' }
      ];

      const mockVelocityQuery = { ...mockFrom };
      mockVelocityQuery.single.mockResolvedValue({
        data: mockRecentVerifications,
        error: null
      });

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'kyc_verifications') {
          return mockVelocityQuery;
        }
        return mockFrom;
      });

      const indicators = await riskAssessmentService.detectFraudIndicators('test-verification-id');

      expect(indicators.some(indicator => indicator.type === 'velocity_abuse')).toBe(true);
    });

    it('should detect synthetic identity indicators', async () => {
      const mockVerification = {
        id: 'test-verification-id',
        user_id: 'test-user-id',
        kyc_documents: [
          {
            id: 'doc-1',
            extracted_data: {
              first_name: 'John',
              last_name: 'Doe',
              date_of_birth: '1985-01-01'
            }
          },
          {
            id: 'doc-2',
            extracted_data: {
              first_name: 'Jane', // Different name
              last_name: 'Smith',
              date_of_birth: '1990-01-01' // Different DOB
            }
          }
        ]
      };

      mockFrom.single.mockResolvedValueOnce({
        data: mockVerification,
        error: null
      });

      const indicators = await riskAssessmentService.detectFraudIndicators('test-verification-id');

      expect(indicators.some(indicator => indicator.type === 'name_inconsistency')).toBe(true);
      expect(indicators.some(indicator => indicator.type === 'dob_inconsistency')).toBe(true);
    });

    it('should sort indicators by severity', async () => {
      const mockVerification = {
        id: 'test-verification-id',
        user_id: 'test-user-id',
        kyc_documents: [
          {
            id: 'doc-1',
            document_quality_score: 25, // Poor quality
            ocr_confidence: 50 // Low confidence
          }
        ]
      };

      mockFrom.single.mockResolvedValueOnce({
        data: mockVerification,
        error: null
      });

      const indicators = await riskAssessmentService.detectFraudIndicators('test-verification-id');

      if (indicators.length > 1) {
        const severityOrder = ['critical', 'high', 'medium', 'low'];
        for (let i = 0; i < indicators.length - 1; i++) {
          const currentSeverityIndex = severityOrder.indexOf(indicators[i].severity);
          const nextSeverityIndex = severityOrder.indexOf(indicators[i + 1].severity);
          expect(currentSeverityIndex).toBeLessThanOrEqual(nextSeverityIndex);
        }
      }
    });

    it('should handle empty verification data', async () => {
      mockFrom.single.mockResolvedValueOnce({
        data: null,
        error: null
      });

      const indicators = await riskAssessmentService.detectFraudIndicators('test-verification-id');

      expect(Array.isArray(indicators)).toBe(true);
      expect(indicators.length).toBe(0);
    });
  });

  describe('performComplianceScreening', () => {
    const mockVerification = {
      id: 'test-verification-id',
      user_id: 'test-user-id',
      auth_users: {
        email: 'test@example.com'
      },
      kyc_documents: [],
      businesses: {
        name: 'Test Business'
      }
    };

    it('should perform AML screening', async () => {
      mockFrom.single.mockResolvedValueOnce({
        data: mockVerification,
        error: null
      });

      mockSupabase.rpc.mockResolvedValueOnce({
        data: { high_risk_matches: 1 },
        error: null
      });

      const flags = await riskAssessmentService.performComplianceScreening('test-verification-id');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('screen_against_watchlists', {
        p_entity_type: 'person',
        p_entity_value: 'test@example.com',
        p_verification_id: 'test-verification-id'
      });

      expect(flags.some(flag => flag.type === 'aml')).toBe(true);
    });

    it('should handle screening errors gracefully', async () => {
      mockFrom.single.mockRejectedValueOnce(new Error('Database error'));

      const flags = await riskAssessmentService.performComplianceScreening('test-verification-id');

      expect(Array.isArray(flags)).toBe(true);
      expect(flags.length).toBe(0);
    });

    it('should return empty flags for no matches', async () => {
      mockFrom.single.mockResolvedValueOnce({
        data: mockVerification,
        error: null
      });

      mockSupabase.rpc.mockResolvedValueOnce({
        data: { high_risk_matches: 0 },
        error: null
      });

      const flags = await riskAssessmentService.performComplianceScreening('test-verification-id');

      expect(flags.filter(flag => flag.type === 'aml')).toHaveLength(0);
    });
  });

  describe('component risk calculations', () => {
    it('should calculate identity risk based on account age', async () => {
      const service = new RiskAssessmentService(mockSupabase as any);
      
      // Access private method via any cast for testing
      const calculateIdentityRisk = (service as any).calculateIdentityRisk;

      // New account (< 1 day)
      const newAccountVerification = {
        auth_users: { created_at: new Date().toISOString() }
      };
      const newAccountScore = await calculateIdentityRisk.call(service, newAccountVerification);
      expect(newAccountScore).toBeGreaterThan(40);

      // Old account (> 30 days)
      const oldAccountVerification = {
        auth_users: { created_at: '2022-01-01T00:00:00Z' }
      };
      const oldAccountScore = await calculateIdentityRisk.call(service, oldAccountVerification);
      expect(oldAccountScore).toBeLessThan(newAccountScore);
    });

    it('should calculate document risk based on document count and quality', async () => {
      const service = new RiskAssessmentService(mockSupabase as any);
      const calculateDocumentRisk = (service as any).calculateDocumentRisk;

      // No documents
      const noDocsScore = await calculateDocumentRisk.call(service, []);
      expect(noDocsScore).toBe(80);

      // Good quality documents
      const goodDocs = [
        {
          validation_status: 'valid',
          document_quality_score: 90,
          ocr_confidence: 95,
          fraud_indicators: []
        }
      ];
      const goodDocsScore = await calculateDocumentRisk.call(service, goodDocs);
      expect(goodDocsScore).toBeLessThan(noDocsScore);

      // Poor quality documents
      const poorDocs = [
        {
          validation_status: 'suspicious',
          document_quality_score: 30,
          ocr_confidence: 40,
          fraud_indicators: ['poor_quality', 'tampering']
        }
      ];
      const poorDocsScore = await calculateDocumentRisk.call(service, poorDocs);
      expect(poorDocsScore).toBeGreaterThan(goodDocsScore);
    });

    it('should calculate business risk based on business age and status', async () => {
      const service = new RiskAssessmentService(mockSupabase as any);
      const calculateBusinessRisk = (service as any).calculateBusinessRisk;

      // New business
      const newBusiness = {
        created_at: new Date().toISOString(),
        verification_status: 'pending',
        name: 'Legitimate Business Name'
      };
      const newBusinessScore = await calculateBusinessRisk.call(service, newBusiness);
      expect(newBusinessScore).toBeGreaterThan(20);

      // Established business
      const establishedBusiness = {
        created_at: '2020-01-01T00:00:00Z',
        verification_status: 'verified',
        name: 'Established Company LLC'
      };
      const establishedBusinessScore = await calculateBusinessRisk.call(service, establishedBusiness);
      expect(establishedBusinessScore).toBeLessThan(newBusinessScore);

      // Suspicious business name
      const suspiciousBusiness = {
        created_at: '2020-01-01T00:00:00Z',
        verification_status: 'pending',
        name: 'Test Fake Business'
      };
      const suspiciousBusinessScore = await calculateBusinessRisk.call(service, suspiciousBusiness);
      expect(suspiciousBusinessScore).toBeGreaterThan(establishedBusinessScore);
    });
  });

  describe('decision logic', () => {
    const service = new RiskAssessmentService(mockSupabase as any);
    
    it('should require manual review for high-risk scores', () => {
      const shouldRequireManualReview = (service as any).shouldRequireManualReview;
      
      expect(shouldRequireManualReview.call(service, 70, [])).toBe(true);
      expect(shouldRequireManualReview.call(service, 50, [])).toBe(false);
    });

    it('should require manual review for critical factors', () => {
      const shouldRequireManualReview = (service as any).shouldRequireManualReview;
      
      const criticalFactors = [{ severity: 'critical' }];
      expect(shouldRequireManualReview.call(service, 20, criticalFactors)).toBe(true);
    });

    it('should not allow auto-approval for high scores', () => {
      const isAutoApprovalEligible = (service as any).isAutoApprovalEligible;
      
      expect(isAutoApprovalEligible.call(service, 30, [])).toBe(false);
      expect(isAutoApprovalEligible.call(service, 20, [])).toBe(true);
    });

    it('should not allow auto-approval with high/critical factors', () => {
      const isAutoApprovalEligible = (service as any).isAutoApprovalEligible;
      
      const highFactors = [{ severity: 'high' }];
      expect(isAutoApprovalEligible.call(service, 20, highFactors)).toBe(false);
    });
  });

  describe('helper methods', () => {
    const service = new RiskAssessmentService(mockSupabase as any);

    it('should categorize risk scores correctly', () => {
      const categorizeRisk = (service as any).categorizeRisk;

      expect(categorizeRisk.call(service, 20)).toBe('low');
      expect(categorizeRisk.call(service, 40)).toBe('medium');
      expect(categorizeRisk.call(service, 70)).toBe('high');
      expect(categorizeRisk.call(service, 90)).toBe('critical');
    });

    it('should calculate severity scores correctly', () => {
      const getSeverityScore = (service as any).getSeverityScore;

      expect(getSeverityScore.call(service, 'low')).toBe(1);
      expect(getSeverityScore.call(service, 'medium')).toBe(2);
      expect(getSeverityScore.call(service, 'high')).toBe(3);
      expect(getSeverityScore.call(service, 'critical')).toBe(4);
    });

    it('should generate appropriate recommendations', () => {
      const generateRecommendations = (service as any).generateRecommendations;

      const highRiskFactors = [
        { category: 'document', severity: 'high' },
        { category: 'identity', severity: 'medium' }
      ];

      const recommendations = generateRecommendations.call(service, 75, highRiskFactors);

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(rec => rec.includes('manual review'))).toBe(true);
    });

    it('should calculate assessment confidence', () => {
      const calculateAssessmentConfidence = (service as any).calculateAssessmentConfidence;

      const factorsWithHighConfidence = [
        { confidence: 90 },
        { confidence: 85 },
        { confidence: 95 }
      ];

      const confidence = calculateAssessmentConfidence.call(service, factorsWithHighConfidence);
      expect(confidence).toBeGreaterThan(80);
      expect(confidence).toBeLessThanOrEqual(100);

      // No factors should return lower confidence
      const noFactorsConfidence = calculateAssessmentConfidence.call(service, []);
      expect(noFactorsConfidence).toBe(50);
    });
  });
});