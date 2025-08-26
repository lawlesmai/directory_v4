/**
 * KYC Service Test Suite
 * Epic 2 Story 2.9: Business Owner Verification & KYC
 * Comprehensive test coverage for KYC service functionality
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { KYCService } from '@/lib/services/kyc-service';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Mock Supabase client
jest.mock('@supabase/auth-helpers-nextjs');
const mockSupabase = {
  from: jest.fn(),
  rpc: jest.fn(),
  auth: {
    getUser: jest.fn()
  }
};

const mockFrom = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  filter: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn(),
  range: jest.fn().mockReturnThis()
};

describe('KYCService', () => {
  let kycService: KYCService;

  beforeEach(() => {
    jest.clearAllMocks();
    (createClientComponentClient as jest.Mock).mockReturnValue(mockSupabase);
    mockSupabase.from.mockReturnValue(mockFrom);
    kycService = new KYCService(mockSupabase as any);
  });

  afterEach(() => {
    kycService.clearAllCache();
  });

  describe('initiateVerification', () => {
    it('should successfully initiate KYC verification for new user', async () => {
      const mockVerificationId = 'test-verification-id';
      
      // Mock no existing verification
      mockFrom.single.mockResolvedValueOnce({ data: null, error: null });
      
      // Mock successful RPC call
      mockSupabase.rpc.mockResolvedValueOnce({
        data: mockVerificationId,
        error: null
      });

      const result = await kycService.initiateVerification({
        userId: 'test-user-id',
        businessId: 'test-business-id',
        verificationType: 'business_owner',
        verificationLevel: 'basic'
      });

      expect(result.success).toBe(true);
      expect(result.verificationId).toBe(mockVerificationId);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('initiate_kyc_verification', {
        p_user_id: 'test-user-id',
        p_business_id: 'test-business-id',
        p_verification_type: 'business_owner',
        p_verification_level: 'basic'
      });
    });

    it('should fail when user already has active verification', async () => {
      // Mock existing verification
      mockFrom.single.mockResolvedValueOnce({
        data: { id: 'existing-id', status: 'initiated' },
        error: null
      });

      const result = await kycService.initiateVerification({
        userId: 'test-user-id',
        verificationType: 'business_owner',
        verificationLevel: 'basic'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('An active KYC verification process already exists');
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockFrom.single.mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' }
      });

      const result = await kycService.initiateVerification({
        userId: 'test-user-id',
        verificationType: 'business_owner',
        verificationLevel: 'basic'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to initiate KYC verification: Database error');
    });

    it('should validate input parameters', async () => {
      const result = await kycService.initiateVerification({
        userId: 'invalid-uuid',
        verificationType: 'business_owner',
        verificationLevel: 'basic'
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid uuid');
    });
  });

  describe('getVerificationStatus', () => {
    const mockVerification = {
      id: 'test-verification-id',
      user_id: 'test-user-id',
      business_id: 'test-business-id',
      verification_type: 'business_owner',
      verification_level: 'basic',
      status: 'under_review',
      decision: null,
      risk_level: 'medium',
      risk_score: 45.5,
      initiated_at: '2023-01-01T00:00:00Z',
      decided_at: null,
      expires_at: '2023-02-01T00:00:00Z'
    };

    it('should return verification status successfully', async () => {
      mockFrom.single.mockResolvedValueOnce({
        data: mockVerification,
        error: null
      });

      const result = await kycService.getVerificationStatus('test-verification-id');

      expect(result.success).toBe(true);
      expect(result.verification).toBeDefined();
      expect(result.verification!.id).toBe('test-verification-id');
      expect(result.verification!.status).toBe('under_review');
    });

    it('should include documents when requested', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          verification_id: 'test-verification-id',
          file_name: 'test-doc.pdf',
          file_size_bytes: 1024,
          ocr_status: 'completed',
          validation_status: 'valid',
          review_status: 'approved',
          document_quality_score: 85,
          created_at: '2023-01-01T00:00:00Z',
          kyc_document_types: {
            type_code: 'drivers_license',
            display_name: 'Driver\'s License'
          }
        }
      ];

      mockFrom.single.mockResolvedValueOnce({
        data: mockVerification,
        error: null
      });

      // Mock documents query
      const mockDocumentsQuery = { ...mockFrom };
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'kyc_documents') {
          mockDocumentsQuery.single = jest.fn().mockResolvedValue({
            data: mockDocuments,
            error: null
          });
          return mockDocumentsQuery;
        }
        return mockFrom;
      });

      const result = await kycService.getVerificationStatus('test-verification-id', {
        includeDocuments: true
      });

      expect(result.success).toBe(true);
      expect(result.verification!.documents).toBeDefined();
      expect(result.verification!.documents!).toHaveLength(1);
      expect(result.verification!.documents![0].documentType).toBe('Driver\'s License');
    });

    it('should handle verification not found', async () => {
      mockFrom.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' }
      });

      const result = await kycService.getVerificationStatus('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('KYC verification not found');
    });

    it('should use cache for repeated requests', async () => {
      mockFrom.single.mockResolvedValueOnce({
        data: mockVerification,
        error: null
      });

      // First request
      const result1 = await kycService.getVerificationStatus('test-verification-id');
      expect(result1.success).toBe(true);

      // Second request should use cache
      const result2 = await kycService.getVerificationStatus('test-verification-id');
      expect(result2.success).toBe(true);

      // Database should only be called once
      expect(mockFrom.single).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUserVerifications', () => {
    it('should return user verifications successfully', async () => {
      const mockVerifications = [
        {
          id: 'verification-1',
          user_id: 'test-user-id',
          business_id: null,
          verification_type: 'personal_identity',
          verification_level: 'basic',
          status: 'approved',
          decision: 'approved',
          risk_level: 'low',
          risk_score: 15,
          initiated_at: '2023-01-01T00:00:00Z',
          decided_at: '2023-01-02T00:00:00Z',
          expires_at: null
        }
      ];

      const mockQuery = { ...mockFrom };
      mockQuery.single = jest.fn().mockResolvedValue({
        data: mockVerifications,
        error: null
      });
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await kycService.getUserVerifications('test-user-id');

      expect(result.success).toBe(true);
      expect(result.verifications).toBeDefined();
      expect(result.verifications!).toHaveLength(1);
      expect(result.verifications![0].userId).toBe('test-user-id');
    });

    it('should filter out expired verifications by default', async () => {
      const result = await kycService.getUserVerifications('test-user-id');

      expect(mockFrom.or).toHaveBeenCalledWith(
        expect.stringContaining('expires_at.is.null,expires_at.gte.')
      );
    });

    it('should include expired verifications when requested', async () => {
      mockFrom.single.mockResolvedValueOnce({ data: [], error: null });

      await kycService.getUserVerifications('test-user-id', {
        includeExpired: true
      });

      expect(mockFrom.or).not.toHaveBeenCalled();
    });

    it('should limit results when specified', async () => {
      mockFrom.single.mockResolvedValueOnce({ data: [], error: null });

      await kycService.getUserVerifications('test-user-id', {
        limit: 5
      });

      expect(mockFrom.limit).toHaveBeenCalledWith(5);
    });
  });

  describe('getDocumentTypes', () => {
    it('should return all document types', async () => {
      const mockDocumentTypes = [
        {
          type_code: 'drivers_license',
          display_name: 'Driver\'s License',
          description: 'State-issued driver license',
          category: 'identity',
          required_for_verification: true,
          accepted_formats: ['jpg', 'pdf'],
          max_file_size_mb: 10
        }
      ];

      mockFrom.single.mockResolvedValueOnce({
        data: mockDocumentTypes,
        error: null
      });

      const result = await kycService.getDocumentTypes();

      expect(result.success).toBe(true);
      expect(result.documentTypes).toBeDefined();
      expect(result.documentTypes!).toHaveLength(1);
      expect(result.documentTypes![0].typeCode).toBe('drivers_license');
    });

    it('should filter by category when specified', async () => {
      mockFrom.single.mockResolvedValueOnce({ data: [], error: null });

      await kycService.getDocumentTypes('identity');

      expect(mockFrom.eq).toHaveBeenCalledWith('category', 'identity');
    });

    it('should cache document types for performance', async () => {
      mockFrom.single.mockResolvedValueOnce({ data: [], error: null });

      // First request
      await kycService.getDocumentTypes();
      // Second request should use cache
      await kycService.getDocumentTypes();

      // Database should only be called once
      expect(mockFrom.single).toHaveBeenCalledTimes(1);
    });
  });

  describe('uploadDocument', () => {
    const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

    beforeEach(() => {
      // Mock fetch
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('should successfully upload document', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: 'csrf-token',
        error: null
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          documentId: 'new-document-id'
        })
      });

      const result = await kycService.uploadDocument({
        verificationId: 'test-verification-id',
        documentType: 'drivers_license',
        file: mockFile
      });

      expect(result.success).toBe(true);
      expect(result.documentId).toBe('new-document-id');
      expect(global.fetch).toHaveBeenCalledWith('/api/kyc/documents/upload', {
        method: 'POST',
        body: expect.any(FormData)
      });
    });

    it('should handle upload API errors', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: 'csrf-token',
        error: null
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          error: 'File too large'
        })
      });

      const result = await kycService.uploadDocument({
        verificationId: 'test-verification-id',
        documentType: 'drivers_license',
        file: mockFile
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('File too large');
    });

    it('should validate input parameters', async () => {
      const result = await kycService.uploadDocument({
        verificationId: 'invalid-uuid',
        documentType: 'drivers_license',
        file: mockFile
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid uuid');
    });
  });

  describe('checkBusinessOwnershipEligibility', () => {
    it('should return eligible for approved verification', async () => {
      mockFrom.single.mockResolvedValueOnce({
        data: {
          id: 'test-verification-id',
          status: 'approved',
          decision: 'approved'
        },
        error: null
      });

      const result = await kycService.checkBusinessOwnershipEligibility(
        'test-user-id',
        'test-business-id'
      );

      expect(result.success).toBe(true);
      expect(result.eligible).toBe(true);
      expect(result.reason).toBe('KYC verification completed successfully');
    });

    it('should return ineligible for no verification', async () => {
      mockFrom.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' }
      });

      const result = await kycService.checkBusinessOwnershipEligibility(
        'test-user-id',
        'test-business-id'
      );

      expect(result.success).toBe(true);
      expect(result.eligible).toBe(false);
      expect(result.verificationRequired).toBe(true);
      expect(result.reason).toBe('KYC verification required for business ownership');
    });

    it('should handle verification in progress', async () => {
      mockFrom.single.mockResolvedValueOnce({
        data: {
          id: 'test-verification-id',
          status: 'under_review',
          decision: null
        },
        error: null
      });

      const result = await kycService.checkBusinessOwnershipEligibility(
        'test-user-id',
        'test-business-id'
      );

      expect(result.success).toBe(true);
      expect(result.eligible).toBe(false);
      expect(result.existingVerificationId).toBe('test-verification-id');
      expect(result.reason).toBe('KYC verification in progress');
    });

    it('should handle rejected verification', async () => {
      mockFrom.single.mockResolvedValueOnce({
        data: {
          id: 'test-verification-id',
          status: 'rejected',
          decision: 'rejected'
        },
        error: null
      });

      const result = await kycService.checkBusinessOwnershipEligibility(
        'test-user-id',
        'test-business-id'
      );

      expect(result.success).toBe(true);
      expect(result.eligible).toBe(false);
      expect(result.verificationRequired).toBe(true);
      expect(result.reason).toBe('KYC verification was rejected or expired');
    });
  });

  describe('getKYCStatistics', () => {
    it('should calculate statistics correctly', async () => {
      const mockVerifications = [
        {
          status: 'approved',
          decision: 'approved',
          initiated_at: '2023-01-01T00:00:00Z',
          decided_at: '2023-01-02T00:00:00Z'
        },
        {
          status: 'rejected',
          decision: 'rejected',
          initiated_at: '2023-01-01T06:00:00Z',
          decided_at: '2023-01-01T18:00:00Z'
        },
        {
          status: 'under_review',
          decision: null,
          initiated_at: '2023-01-02T00:00:00Z',
          decided_at: null
        }
      ];

      mockFrom.single.mockResolvedValueOnce({
        data: mockVerifications,
        error: null
      });

      const result = await kycService.getKYCStatistics();

      expect(result.success).toBe(true);
      expect(result.statistics).toBeDefined();
      expect(result.statistics!.totalVerifications).toBe(3);
      expect(result.statistics!.approvedVerifications).toBe(1);
      expect(result.statistics!.rejectedVerifications).toBe(1);
      expect(result.statistics!.pendingVerifications).toBe(1);
      expect(result.statistics!.approvalRate).toBe(33.33);
    });

    it('should handle empty data gracefully', async () => {
      mockFrom.single.mockResolvedValueOnce({
        data: null,
        error: null
      });

      const result = await kycService.getKYCStatistics();

      expect(result.success).toBe(true);
      expect(result.statistics!.totalVerifications).toBe(0);
      expect(result.statistics!.approvalRate).toBe(0);
    });

    it('should filter by date range when provided', async () => {
      const dateRange = {
        start: '2023-01-01',
        end: '2023-01-31'
      };

      mockFrom.single.mockResolvedValueOnce({ data: [], error: null });

      await kycService.getKYCStatistics(dateRange);

      expect(mockFrom.gte).toHaveBeenCalledWith('initiated_at', '2023-01-01');
      expect(mockFrom.lte).toHaveBeenCalledWith('initiated_at', '2023-01-31');
    });
  });

  describe('cache management', () => {
    it('should clear cache when patterns match', async () => {
      // Set up a cached response
      mockFrom.single.mockResolvedValueOnce({
        data: { id: 'test-id' },
        error: null
      });

      // First call should hit database and cache result
      await kycService.getVerificationStatus('test-verification-id');
      expect(mockFrom.single).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await kycService.getVerificationStatus('test-verification-id');
      expect(mockFrom.single).toHaveBeenCalledTimes(1);

      // Clear all cache
      kycService.clearAllCache();

      // Third call should hit database again
      mockFrom.single.mockResolvedValueOnce({
        data: { id: 'test-id' },
        error: null
      });
      await kycService.getVerificationStatus('test-verification-id');
      expect(mockFrom.single).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockFrom.single.mockRejectedValueOnce(new Error('Network error'));

      const result = await kycService.getVerificationStatus('test-verification-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle Supabase RPC errors', async () => {
      mockFrom.single.mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.rpc.mockRejectedValueOnce(new Error('RPC failed'));

      const result = await kycService.initiateVerification({
        userId: 'test-user-id',
        verificationType: 'business_owner',
        verificationLevel: 'basic'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('RPC failed');
    });

    it('should handle malformed data gracefully', async () => {
      mockFrom.single.mockResolvedValueOnce({
        data: { invalid: 'data' },
        error: null
      });

      const result = await kycService.getVerificationStatus('test-verification-id');

      // Should not throw, but return error
      expect(result.success).toBe(true);
      expect(result.verification).toBeDefined();
    });
  });
});