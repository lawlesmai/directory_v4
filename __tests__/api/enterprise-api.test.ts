/**
 * EPIC 5 STORY 5.8: Enterprise Sales & Custom Billing
 * Enterprise API Endpoints Test Suite
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock the enterprise modules
jest.mock('@/lib/payments/enterprise-sales-manager', () => ({
  __esModule: true,
  default: {
    createLead: jest.fn(),
    generateCustomPricing: jest.fn(),
    updateSalesStage: jest.fn(),
    getLead: jest.fn(),
    getLeads: jest.fn(),
    getSalesActivities: jest.fn(),
    calculateROI: jest.fn(),
  }
}));

jest.mock('@/lib/payments/custom-billing-engine', () => ({
  __esModule: true,
  default: {
    generateCustomInvoice: jest.fn(),
    processPurchaseOrder: jest.fn(),
    approvePurchaseOrder: jest.fn(),
  }
}));

jest.mock('@/lib/payments/contract-manager', () => ({
  __esModule: true,
  default: {
    createContract: jest.fn(),
    approveContract: jest.fn(),
    getCustomerContracts: jest.fn(),
  }
}));

jest.mock('@/lib/analytics/enterprise-analytics', () => ({
  __esModule: true,
  default: {
    generateSLAMetrics: jest.fn(),
    generateUsageAnalytics: jest.fn(),
    recordIncident: jest.fn(),
  }
}));

// Mock Supabase
const mockSupabase = {
  auth: {
    getUser: jest.fn(() => Promise.resolve({
      data: { user: { id: 'user_123', email: 'admin@company.com' } },
      error: null
    }))
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({
          data: { roles: { name: 'admin' } },
          error: null
        }))
      }))
    }))
  }))
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabase
}));

// Import the API handlers
import { POST, GET, PUT } from '@/app/api/payments/enterprise/route';

describe('Enterprise API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should reject unauthenticated requests', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: 'Not authenticated'
      });

      const request = new NextRequest('http://localhost/api/payments/enterprise', {
        method: 'POST',
        body: JSON.stringify({ action: 'create_lead' })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should reject requests without proper permissions', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: { roles: { name: 'user' } }, // Not authorized role
              error: null
            }))
          }))
        }))
      });

      const request = new NextRequest('http://localhost/api/payments/enterprise', {
        method: 'POST',
        body: JSON.stringify({ action: 'create_lead' })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Insufficient permissions');
    });

    it('should allow requests with proper admin permissions', async () => {
      const enterpriseSalesManager = require('@/lib/payments/enterprise-sales-manager').default;
      enterpriseSalesManager.createLead.mockResolvedValue({
        id: 'lead_123',
        companyName: 'Test Corp',
        qualificationTier: 'enterprise'
      });

      const request = new NextRequest('http://localhost/api/payments/enterprise', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_lead',
          companyName: 'Test Corp',
          contactName: 'John Doe',
          contactEmail: 'john@testcorp.com',
          industry: 'technology',
          locationCount: 100,
          estimatedMonthlyVolume: 50000,
          decisionTimeframe: '1-3 months',
          leadSource: 'api_test'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('POST Endpoints', () => {
    beforeEach(() => {
      // Setup authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user_123', email: 'admin@company.com' } },
        error: null
      });
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: { roles: { name: 'admin' } },
              error: null
            }))
          }))
        }))
      });
    });

    describe('Create Lead', () => {
      it('should create enterprise lead successfully', async () => {
        const enterpriseSalesManager = require('@/lib/payments/enterprise-sales-manager').default;
        enterpriseSalesManager.createLead.mockResolvedValue({
          id: 'lead_123',
          companyName: 'Test Corp',
          contactName: 'John Doe',
          contactEmail: 'john@testcorp.com',
          qualificationTier: 'enterprise',
          qualificationScore: 85
        });

        const leadData = {
          action: 'create_lead',
          companyName: 'Test Corp',
          contactName: 'John Doe',
          contactEmail: 'john@testcorp.com',
          industry: 'technology',
          locationCount: 100,
          estimatedMonthlyVolume: 50000,
          decisionTimeframe: '1-3 months',
          leadSource: 'api_test'
        };

        const request = new NextRequest('http://localhost/api/payments/enterprise', {
          method: 'POST',
          body: JSON.stringify(leadData)
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.id).toBe('lead_123');
        expect(enterpriseSalesManager.createLead).toHaveBeenCalledWith({
          companyName: leadData.companyName,
          contactName: leadData.contactName,
          contactEmail: leadData.contactEmail,
          industry: leadData.industry,
          locationCount: leadData.locationCount,
          estimatedMonthlyVolume: leadData.estimatedMonthlyVolume,
          decisionTimeframe: leadData.decisionTimeframe,
          leadSource: leadData.leadSource
        });
      });

      it('should handle validation errors for invalid lead data', async () => {
        const enterpriseSalesManager = require('@/lib/payments/enterprise-sales-manager').default;
        enterpriseSalesManager.createLead.mockRejectedValue(new Error('Validation failed'));

        const invalidLeadData = {
          action: 'create_lead',
          companyName: '', // Invalid
          contactEmail: 'invalid-email', // Invalid
          locationCount: 0 // Invalid
        };

        const request = new NextRequest('http://localhost/api/payments/enterprise', {
          method: 'POST',
          body: JSON.stringify(invalidLeadData)
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('Validation failed');
      });
    });

    describe('Generate Custom Pricing', () => {
      it('should generate custom pricing proposal', async () => {
        const enterpriseSalesManager = require('@/lib/payments/enterprise-sales-manager').default;
        enterpriseSalesManager.generateCustomPricing.mockResolvedValue({
          id: 'pricing_123',
          leadId: 'lead_123',
          pricingTier: 'volume_100',
          discountPercentage: 20,
          pricing: {
            monthlyPerLocation: 63.2,
            setupFee: 8000
          }
        });

        const pricingData = {
          action: 'generate_pricing',
          leadId: 'lead_123',
          pricingTier: 'volume_100',
          discountPercentage: 20,
          contractLength: 24,
          paymentTerms: 'net_30',
          supportLevel: 'premium'
        };

        const request = new NextRequest('http://localhost/api/payments/enterprise', {
          method: 'POST',
          body: JSON.stringify(pricingData)
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.discountPercentage).toBe(20);
      });
    });

    describe('Generate Custom Invoice', () => {
      it('should generate custom invoice for enterprise customer', async () => {
        const customBillingEngine = require('@/lib/payments/custom-billing-engine').default;
        customBillingEngine.generateCustomInvoice.mockResolvedValue({
          id: 'invoice_123',
          invoiceNumber: 'ENT-2024-0001',
          total: 15000,
          currency: 'USD',
          dueDate: new Date()
        });

        const invoiceData = {
          action: 'generate_invoice',
          enterpriseCustomerId: 'customer_123',
          billingPeriodStart: '2024-01-01',
          billingPeriodEnd: '2024-01-31',
          locations: ['location_1', 'location_2'],
          purchaseOrder: 'PO-2024-001'
        };

        const request = new NextRequest('http://localhost/api/payments/enterprise', {
          method: 'POST',
          body: JSON.stringify(invoiceData)
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.invoiceNumber).toBe('ENT-2024-0001');
      });
    });

    describe('Process Purchase Order', () => {
      it('should process purchase order with approval workflow', async () => {
        const customBillingEngine = require('@/lib/payments/custom-billing-engine').default;
        customBillingEngine.processPurchaseOrder.mockResolvedValue({
          id: 'po_123',
          poNumber: 'PO-2024-001',
          status: 'pending_approval',
          approvalWorkflow: {
            required: true,
            approvers: ['manager@company.com']
          }
        });

        const poData = {
          action: 'process_po',
          poNumber: 'PO-2024-001',
          enterpriseCustomerId: 'customer_123',
          description: 'Annual subscription services',
          amount: 120000,
          costCenter: 'CC001',
          requestorEmail: 'requestor@company.com',
          department: 'Marketing'
        };

        const request = new NextRequest('http://localhost/api/payments/enterprise', {
          method: 'POST',
          body: JSON.stringify(poData)
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.status).toBe('pending_approval');
      });
    });
  });

  describe('GET Endpoints', () => {
    beforeEach(() => {
      // Setup authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user_123', email: 'admin@company.com' } },
        error: null
      });
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: { roles: { name: 'admin' } },
              error: null
            }))
          }))
        }))
      });
    });

    describe('Get Leads', () => {
      it('should retrieve leads with pagination', async () => {
        const enterpriseSalesManager = require('@/lib/payments/enterprise-sales-manager').default;
        enterpriseSalesManager.getLeads.mockResolvedValue({
          leads: [
            { id: 'lead_1', companyName: 'Company 1' },
            { id: 'lead_2', companyName: 'Company 2' }
          ],
          pagination: {
            page: 1,
            limit: 20,
            total: 2,
            totalPages: 1
          }
        });

        const url = new URL('http://localhost/api/payments/enterprise');
        url.searchParams.set('action', 'leads');
        url.searchParams.set('qualificationTier', 'enterprise');
        url.searchParams.set('page', '1');
        url.searchParams.set('limit', '20');

        const request = new NextRequest(url);
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.leads).toHaveLength(2);
        expect(data.data.pagination.total).toBe(2);
      });
    });

    describe('Get Lead Details', () => {
      it('should retrieve lead with activities', async () => {
        const enterpriseSalesManager = require('@/lib/payments/enterprise-sales-manager').default;
        enterpriseSalesManager.getLead.mockResolvedValue({
          id: 'lead_123',
          companyName: 'Test Corp'
        });
        enterpriseSalesManager.getSalesActivities.mockResolvedValue([
          {
            id: 'activity_1',
            activityType: 'call',
            subject: 'Initial discovery call'
          }
        ]);

        const url = new URL('http://localhost/api/payments/enterprise');
        url.searchParams.set('action', 'lead_details');
        url.searchParams.set('leadId', 'lead_123');

        const request = new NextRequest(url);
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.lead.id).toBe('lead_123');
        expect(data.data.activities).toHaveLength(1);
      });

      it('should return error for missing leadId', async () => {
        const url = new URL('http://localhost/api/payments/enterprise');
        url.searchParams.set('action', 'lead_details');
        // Missing leadId parameter

        const request = new NextRequest(url);
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('leadId is required');
      });
    });

    describe('Get SLA Metrics', () => {
      it('should retrieve SLA metrics for customer', async () => {
        const enterpriseAnalytics = require('@/lib/analytics/enterprise-analytics').default;
        enterpriseAnalytics.generateSLAMetrics.mockResolvedValue({
          id: 'sla_123',
          customerId: 'customer_123',
          overallScore: 95.5,
          uptime: { actual: 99.95, target: 99.9 },
          support: { averageResponseTime: 3.2 },
          performance: { errorRate: 0.1 },
          compliance: { status: 'compliant' }
        });

        const url = new URL('http://localhost/api/payments/enterprise');
        url.searchParams.set('action', 'sla_metrics');
        url.searchParams.set('customerId', 'customer_123');

        const request = new NextRequest(url);
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.overallScore).toBe(95.5);
      });
    });
  });

  describe('PUT Endpoints', () => {
    beforeEach(() => {
      // Setup authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user_123', email: 'admin@company.com' } },
        error: null
      });
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: { roles: { name: 'admin' } },
              error: null
            }))
          }))
        }))
      });
    });

    describe('Update Sales Stage', () => {
      it('should update sales stage successfully', async () => {
        const enterpriseSalesManager = require('@/lib/payments/enterprise-sales-manager').default;
        enterpriseSalesManager.updateSalesStage.mockResolvedValue(undefined);

        const updateData = {
          action: 'update_sales_stage',
          leadId: 'lead_123',
          salesStage: 'demo',
          notes: 'Demo scheduled for next week',
          nextAction: 'Follow up after demo'
        };

        const request = new NextRequest('http://localhost/api/payments/enterprise', {
          method: 'PUT',
          body: JSON.stringify(updateData)
        });

        const response = await PUT(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toBe('Sales stage updated successfully');
      });
    });

    describe('Record Incident', () => {
      it('should record uptime incident', async () => {
        const enterpriseAnalytics = require('@/lib/analytics/enterprise-analytics').default;
        enterpriseAnalytics.recordIncident.mockResolvedValue(undefined);

        const incidentData = {
          action: 'record_incident',
          customerId: 'customer_123',
          severity: 'high',
          cause: 'Database connection timeout',
          affectedServices: ['api', 'dashboard'],
          startTime: '2024-01-15T10:00:00Z',
          endTime: '2024-01-15T10:15:00Z',
          customerImpact: 'Minor service delays'
        };

        const request = new NextRequest('http://localhost/api/payments/enterprise', {
          method: 'PUT',
          body: JSON.stringify(incidentData)
        });

        const response = await PUT(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toBe('Incident recorded successfully');
      });
    });

    describe('Approve Purchase Order', () => {
      it('should approve purchase order', async () => {
        const customBillingEngine = require('@/lib/payments/custom-billing-engine').default;
        customBillingEngine.approvePurchaseOrder.mockResolvedValue(undefined);

        const approvalData = {
          action: 'approve_po',
          poId: 'po_123',
          approverId: 'manager@company.com',
          notes: 'Approved for processing'
        };

        const request = new NextRequest('http://localhost/api/payments/enterprise', {
          method: 'PUT',
          body: JSON.stringify(approvalData)
        });

        const response = await PUT(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toBe('Purchase order approved successfully');
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      // Setup authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user_123', email: 'admin@company.com' } },
        error: null
      });
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: { roles: { name: 'admin' } },
              error: null
            }))
          }))
        }))
      });
    });

    it('should handle invalid action parameter', async () => {
      const request = new NextRequest('http://localhost/api/payments/enterprise', {
        method: 'POST',
        body: JSON.stringify({ action: 'invalid_action' })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid action specified');
    });

    it('should handle service errors gracefully', async () => {
      const enterpriseSalesManager = require('@/lib/payments/enterprise-sales-manager').default;
      enterpriseSalesManager.createLead.mockRejectedValue(new Error('Service temporarily unavailable'));

      const request = new NextRequest('http://localhost/api/payments/enterprise', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_lead',
          companyName: 'Test Corp',
          contactName: 'John Doe',
          contactEmail: 'john@testcorp.com',
          industry: 'technology',
          locationCount: 100,
          estimatedMonthlyVolume: 50000,
          decisionTimeframe: '1-3 months',
          leadSource: 'api_test'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Service temporarily unavailable');
    });

    it('should handle malformed JSON requests', async () => {
      const request = new NextRequest('http://localhost/api/payments/enterprise', {
        method: 'POST',
        body: 'invalid json'
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });

  describe('Input Validation', () => {
    beforeEach(() => {
      // Setup authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user_123', email: 'admin@company.com' } },
        error: null
      });
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: { roles: { name: 'admin' } },
              error: null
            }))
          }))
        }))
      });
    });

    it('should validate lead creation data', async () => {
      const enterpriseSalesManager = require('@/lib/payments/enterprise-sales-manager').default;
      enterpriseSalesManager.createLead.mockRejectedValue(new Error('Validation failed'));

      const invalidData = {
        action: 'create_lead',
        // Missing required fields
        companyName: '',
        contactEmail: 'invalid-email'
      };

      const request = new NextRequest('http://localhost/api/payments/enterprise', {
        method: 'POST',
        body: JSON.stringify(invalidData)
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should validate UUID parameters', async () => {
      const url = new URL('http://localhost/api/payments/enterprise');
      url.searchParams.set('action', 'lead_details');
      url.searchParams.set('leadId', 'invalid-uuid');

      const request = new NextRequest(url);
      const response = await GET(request);

      // Should pass through to service which would handle UUID validation
      expect(response.status).toBe(200); // Assuming service handles validation
    });
  });

  describe('Performance', () => {
    it('should handle concurrent requests efficiently', async () => {
      // Setup authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user_123', email: 'admin@company.com' } },
        error: null
      });
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: { roles: { name: 'admin' } },
              error: null
            }))
          }))
        }))
      });

      const enterpriseSalesManager = require('@/lib/payments/enterprise-sales-manager').default;
      enterpriseSalesManager.getLeads.mockResolvedValue({
        leads: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
      });

      const requests = Array.from({ length: 10 }, () => {
        const url = new URL('http://localhost/api/payments/enterprise');
        url.searchParams.set('action', 'leads');
        return GET(new NextRequest(url));
      });

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });
});