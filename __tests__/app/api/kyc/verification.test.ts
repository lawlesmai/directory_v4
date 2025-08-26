/**
 * KYC API Integration Test Suite
 * Epic 2 Story 2.9: Business Owner Verification & KYC
 * Comprehensive test coverage for KYC API endpoints
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { POST as initiateVerification, GET as getVerificationStatus } from '@/app/api/kyc/verification/initiate/route';

// Mock dependencies
jest.mock('@supabase/auth-helpers-nextjs');
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({}))
}));
jest.mock('@/lib/api/rate-limit');
jest.mock('@/lib/api/csrf');
jest.mock('@/lib/api/security-monitoring');

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn()
  },
  from: jest.fn(),
  rpc: jest.fn()
};

const mockQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis()
};

// Mock rate limiting and security functions
const mockRateLimit = require('@/lib/api/rate-limit').rateLimit;
const mockValidateCSRF = require('@/lib/api/csrf').validateCSRF;
const mockLogSecurityEvent = require('@/lib/api/security-monitoring').logSecurityEvent;

describe('/api/kyc/verification/initiate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createRouteHandlerClient as jest.Mock).mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.from.mockReturnValue(mockQuery);
    
    // Default successful mocks
    mockRateLimit.mockResolvedValue({ success: true, remaining: 2 });
    mockValidateCSRF.mockResolvedValue(true);
    mockLogSecurityEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('POST /api/kyc/verification/initiate', () => {
    const validRequestBody = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      businessId: '456e7890-e89b-12d3-a456-426614174001',
      verificationType: 'business_owner',
      verificationLevel: 'basic',
      csrfToken: 'valid-csrf-token'
    };

    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com'
    };

    it('should successfully initiate KYC verification for authenticated user', async () => {
      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // Mock no existing verification
      mockQuery.single.mockResolvedValueOnce({ data: null, error: null });

      // Mock business exists and user owns it
      const mockBusiness = {
        id: validRequestBody.businessId,
        owner_id: mockUser.id,
        name: 'Test Business'
      };
      mockQuery.single.mockResolvedValueOnce({
        data: mockBusiness,
        error: null
      });

      // Mock successful RPC call
      const mockVerificationId = 'verification-123';
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: mockVerificationId,
        error: null
      });

      // Mock verification details
      const mockVerificationDetails = {
        id: mockVerificationId,
        status: 'initiated',
        verification_type: 'business_owner',
        verification_level: 'basic',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        business_verification_workflows: [{
          id: 'workflow-123',
          current_step: 'identity_verification',
          progress_percentage: 0,
          identity_verification_required: true,
          business_license_required: true,
          tax_verification_required: true,
          address_verification_required: true
        }]
      };
      mockQuery.single.mockResolvedValueOnce({
        data: mockVerificationDetails,
        error: null
      });

      const request = new NextRequest('http://localhost:3000/api/kyc/verification/initiate', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.1'
        }
      });

      const response = await initiateVerification(request);
      const responseData = await response.json();

      expect(response.status).toBe(201);
      expect(responseData.success).toBe(true);
      expect(responseData.verificationId).toBe(mockVerificationId);
      expect(responseData.status).toBe('initiated');
      expect(Array.isArray(responseData.nextSteps)).toBe(true);
      expect(responseData.nextSteps.length).toBeGreaterThan(0);
    });

    it('should fail with invalid user ID format', async () => {
      const invalidRequest = {
        ...validRequestBody,
        userId: 'invalid-uuid'
      };

      const request = new NextRequest('http://localhost:3000/api/kyc/verification/initiate', {
        method: 'POST',
        body: JSON.stringify(invalidRequest),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await initiateVerification(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('Invalid request data');
      expect(responseData.code).toBe('INVALID_REQUEST');
    });

    it('should fail when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' }
      });

      const request = new NextRequest('http://localhost:3000/api/kyc/verification/initiate', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await initiateVerification(request);
      const responseData = await response.json();

      expect(response.status).toBe(401);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Authentication required');
      expect(responseData.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('should fail when CSRF token is invalid', async () => {
      mockValidateCSRF.mockResolvedValue(false);

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const request = new NextRequest('http://localhost:3000/api/kyc/verification/initiate', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await initiateVerification(request);
      const responseData = await response.json();

      expect(response.status).toBe(403);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Invalid CSRF token');
      expect(responseData.code).toBe('CSRF_VALIDATION_FAILED');
    });

    it('should fail when user tries to initiate verification for another user without permissions', async () => {
      const otherUserId = '999e9999-e89b-12d3-a456-426614174999';
      const unauthorizedRequest = {
        ...validRequestBody,
        userId: otherUserId
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // Mock user doesn't have admin permissions
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: false,
        error: null
      });

      const request = new NextRequest('http://localhost:3000/api/kyc/verification/initiate', {
        method: 'POST',
        body: JSON.stringify(unauthorizedRequest),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await initiateVerification(request);
      const responseData = await response.json();

      expect(response.status).toBe(403);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Insufficient permissions to initiate KYC for other users');
      expect(responseData.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should fail when business is not found', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // Mock no existing verification
      mockQuery.single.mockResolvedValueOnce({ data: null, error: null });

      // Mock business not found
      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Business not found' }
      });

      const request = new NextRequest('http://localhost:3000/api/kyc/verification/initiate', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await initiateVerification(request);
      const responseData = await response.json();

      expect(response.status).toBe(404);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Business not found');
      expect(responseData.code).toBe('BUSINESS_NOT_FOUND');
    });

    it('should fail when user does not own the business', async () => {
      const otherUserId = '999e9999-e89b-12d3-a456-426614174999';
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // Mock no existing verification
      mockQuery.single.mockResolvedValueOnce({ data: null, error: null });

      // Mock business owned by another user
      const mockBusiness = {
        id: validRequestBody.businessId,
        owner_id: otherUserId, // Different owner
        name: 'Other User Business'
      };
      mockQuery.single.mockResolvedValueOnce({
        data: mockBusiness,
        error: null
      });

      // Mock user doesn't have business management permissions
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: false,
        error: null
      });

      const request = new NextRequest('http://localhost:3000/api/kyc/verification/initiate', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await initiateVerification(request);
      const responseData = await response.json();

      expect(response.status).toBe(403);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Insufficient permissions to initiate KYC for this business');
      expect(responseData.code).toBe('BUSINESS_PERMISSION_DENIED');
    });

    it('should fail when active verification already exists', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // Mock existing active verification
      mockQuery.single.mockResolvedValueOnce({
        data: { id: 'existing-verification', status: 'under_review' },
        error: null
      });

      const request = new NextRequest('http://localhost:3000/api/kyc/verification/initiate', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await initiateVerification(request);
      const responseData = await response.json();

      expect(response.status).toBe(409);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('An active KYC verification process is already in progress');
      expect(responseData.code).toBe('VERIFICATION_IN_PROGRESS');
    });

    it('should handle rate limiting', async () => {
      mockRateLimit.mockResolvedValue({ success: false, remaining: 0 });

      const request = new NextRequest('http://localhost:3000/api/kyc/verification/initiate', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await initiateVerification(request);
      const responseData = await response.json();

      expect(response.status).toBe(429);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Too many KYC initiation attempts. Please try again later.');
      expect(responseData.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should handle database errors gracefully', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // Mock no existing verification
      mockQuery.single.mockResolvedValueOnce({ data: null, error: null });

      // Mock business check passes
      mockQuery.single.mockResolvedValueOnce({
        data: { id: validRequestBody.businessId, owner_id: mockUser.id },
        error: null
      });

      // Mock RPC failure
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' }
      });

      const request = new NextRequest('http://localhost:3000/api/kyc/verification/initiate', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await initiateVerification(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Failed to initiate KYC verification process');
      expect(responseData.code).toBe('KYC_INITIATION_FAILED');
    });

    it('should log security events', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      mockQuery.single.mockResolvedValueOnce({ data: null, error: null });
      mockQuery.single.mockResolvedValueOnce({
        data: { id: validRequestBody.businessId, owner_id: mockUser.id },
        error: null
      });

      const mockVerificationId = 'verification-123';
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: mockVerificationId,
        error: null
      });

      mockQuery.single.mockResolvedValueOnce({
        data: {
          id: mockVerificationId,
          status: 'initiated',
          business_verification_workflows: []
        },
        error: null
      });

      const request = new NextRequest('http://localhost:3000/api/kyc/verification/initiate', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.1'
        }
      });

      await initiateVerification(request);

      expect(mockLogSecurityEvent).toHaveBeenCalledWith('kyc_verification_initiated_success', {
        clientIP: '192.168.1.1',
        userId: mockUser.id,
        verificationId: mockVerificationId,
        verificationType: 'business_owner',
        businessId: validRequestBody.businessId,
        processingTime: expect.any(Number)
      });
    });
  });

  describe('GET method handling', () => {
    it('should return method not allowed for GET requests', async () => {
      const response = await getVerificationStatus();

      expect(response.status).toBe(405);
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Method not allowed');
      expect(responseData.code).toBe('METHOD_NOT_ALLOWED');
    });
  });
});

describe('/api/kyc/verification/status', () => {
  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com'
  };

  const mockVerification = {
    id: 'verification-123',
    user_id: mockUser.id,
    business_id: 'business-123',
    verification_type: 'business_owner',
    verification_level: 'basic',
    status: 'under_review',
    decision: null,
    decision_confidence: null,
    risk_level: 'medium',
    risk_score: 45.5,
    initiated_at: '2023-01-01T00:00:00Z',
    submitted_at: '2023-01-01T01:00:00Z',
    reviewed_at: null,
    decided_at: null,
    expires_at: '2023-02-01T00:00:00Z',
    assigned_reviewer_id: null,
    estimated_completion: null,
    auth_users_assigned_reviewer: null
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createRouteHandlerClient as jest.Mock).mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.from.mockReturnValue(mockQuery);
    
    mockRateLimit.mockResolvedValue({ success: true, remaining: 59 });
    mockLogSecurityEvent.mockResolvedValue(undefined);
  });

  it('should return verification status for authenticated user', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    });

    mockQuery.single.mockResolvedValueOnce({
      data: mockVerification,
      error: null
    });

    const request = new NextRequest(
      'http://localhost:3000/api/kyc/verification/status?verificationId=verification-123',
      { method: 'GET' }
    );

    // Import the GET handler dynamically
    const { GET } = await import('@/app/api/kyc/verification/status/route');
    const response = await GET(request);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData.success).toBe(true);
    expect(responseData.verification).toBeDefined();
    expect(responseData.verification.id).toBe('verification-123');
    expect(responseData.verification.status).toBe('under_review');
    expect(responseData.verification.userId).toBe(mockUser.id);
  });

  it('should fail with invalid verification ID format', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    });

    const request = new NextRequest(
      'http://localhost:3000/api/kyc/verification/status?verificationId=invalid-uuid',
      { method: 'GET' }
    );

    const { GET } = await import('@/app/api/kyc/verification/status/route');
    const response = await GET(request);
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData.success).toBe(false);
    expect(responseData.error).toBe('Invalid request parameters');
    expect(responseData.code).toBe('INVALID_REQUEST');
  });

  it('should handle verification not found', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    });

    mockQuery.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' }
    });

    const request = new NextRequest(
      'http://localhost:3000/api/kyc/verification/status?verificationId=verification-123',
      { method: 'GET' }
    );

    const { GET } = await import('@/app/api/kyc/verification/status/route');
    const response = await GET(request);
    const responseData = await response.json();

    expect(response.status).toBe(404);
    expect(responseData.success).toBe(false);
    expect(responseData.error).toBe('KYC verification not found');
    expect(responseData.code).toBe('VERIFICATION_NOT_FOUND');
  });

  it('should handle unauthorized access', async () => {
    const otherUser = { id: 'other-user-id', email: 'other@example.com' };
    
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: otherUser },
      error: null
    });

    mockQuery.single.mockResolvedValueOnce({
      data: mockVerification, // Belongs to different user
      error: null
    });

    // Mock user doesn't have admin permissions
    mockSupabaseClient.rpc.mockResolvedValueOnce({
      data: false,
      error: null
    });

    const request = new NextRequest(
      'http://localhost:3000/api/kyc/verification/status?verificationId=verification-123',
      { method: 'GET' }
    );

    const { GET } = await import('@/app/api/kyc/verification/status/route');
    const response = await GET(request);
    const responseData = await response.json();

    expect(response.status).toBe(403);
    expect(responseData.success).toBe(false);
    expect(responseData.error).toBe('Insufficient permissions to view this verification status');
    expect(responseData.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('should include documents when requested', async () => {
    const mockDocuments = [{
      id: 'doc-1',
      verification_id: 'verification-123',
      file_name: 'document.pdf',
      created_at: '2023-01-01T02:00:00Z',
      ocr_status: 'completed',
      validation_status: 'valid',
      review_status: 'approved',
      document_quality_score: 85,
      kyc_document_types: {
        type_code: 'drivers_license',
        display_name: 'Driver\'s License'
      }
    }];

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    });

    // Mock verification query
    mockQuery.single.mockResolvedValueOnce({
      data: mockVerification,
      error: null
    });

    // Mock documents query
    mockQuery.single.mockResolvedValueOnce({
      data: mockDocuments,
      error: null
    });

    const request = new NextRequest(
      'http://localhost:3000/api/kyc/verification/status?verificationId=verification-123&includeDocuments=true',
      { method: 'GET' }
    );

    const { GET } = await import('@/app/api/kyc/verification/status/route');
    const response = await GET(request);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData.success).toBe(true);
    expect(responseData.verification.documents).toBeDefined();
    expect(responseData.verification.documents).toHaveLength(1);
    expect(responseData.verification.documents[0].documentType).toBe('Driver\'s License');
  });
});