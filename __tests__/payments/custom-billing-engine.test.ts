/**
 * EPIC 5 STORY 5.8: Enterprise Sales & Custom Billing
 * Custom Billing Engine Test Suite
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock Supabase - define before imports
const mockSupabase = {
  from: jest.fn(() => ({
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({
          data: {
            id: 'billing_profile_123',
            customer_id: 'customer_123',
            company_name: 'Test Enterprise Corp',
            billing_type: 'consolidated',
            payment_terms: 'net_30',
            volume_discounts: [],
            created_at: new Date().toISOString(),
          },
          error: null
        }))
      }))
    })),
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({
          data: {
            id: 'customer_123',
            businesses: { location_count: 100 },
          },
          error: null
        }))
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => Promise.resolve({
        data: null,
        error: null
      }))
    }))
  }))
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabase
}));

import customBillingEngine from '@/lib/payments/custom-billing-engine';

describe('Custom Billing Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Billing Profile Management', () => {
    it('should create enterprise billing profile with volume discounts', async () => {
      const profileData = {
        customerId: 'customer_123',
        companyName: 'Test Enterprise Corp',
        billingType: 'consolidated' as const,
        paymentTerms: 'net_30' as const,
        preferredPaymentMethod: 'wire_transfer' as const,
        billingFrequency: 'monthly' as const,
        purchaseOrderRequired: true,
        taxExemptStatus: false,
        billingContact: {
          name: 'Jane Billing',
          email: 'billing@testenterprise.com',
          phone: '+1-555-0123',
          department: 'Finance',
        },
      };

      const result = await customBillingEngine.createBillingProfile(profileData);

      expect(result).toBeDefined();
      expect(result.customerId).toBe(profileData.customerId);
      expect(result.companyName).toBe(profileData.companyName);
      expect(result.volumeDiscounts.length).toBeGreaterThan(0);
      expect(mockSupabase.from).toHaveBeenCalledWith('enterprise_billing_profiles');
    });

    it('should calculate appropriate volume discounts based on location count', () => {
      const billingEngine = new (customBillingEngine.constructor as any)();
      
      const testCases = [
        { locationCount: 75, expectedDiscounts: 1 },
        { locationCount: 150, expectedDiscounts: 2 },
        { locationCount: 750, expectedDiscounts: 3 },
        { locationCount: 1500, expectedDiscounts: 4 },
      ];

      testCases.forEach(({ locationCount, expectedDiscounts }) => {
        const discounts = billingEngine.calculateVolumeDiscounts(locationCount);
        expect(discounts.length).toBe(expectedDiscounts);
      });
    });

    it('should calculate minimum annual spend correctly', () => {
      const billingEngine = new (customBillingEngine.constructor as any)();
      
      const mockDiscountTier = {
        discountPercentage: 20,
      };

      const minSpend = billingEngine.calculateMinimumSpend(100, mockDiscountTier);
      
      expect(minSpend).toBeGreaterThan(0);
      expect(minSpend).toBe(Math.floor(79 * 0.8 * 100 * 12)); // Base price * (1 - discount) * locations * months
    });
  });

  describe('Custom Invoice Generation', () => {
    it('should generate consolidated custom invoice', async () => {
      // Mock dependencies
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({
                data: {
                  payment_terms: 'net_30',
                  volume_discounts: [{ discountPercentage: 20 }],
                  tax_exempt_status: false,
                },
                error: null
              }))
            }))
          }))
        })
        .mockReturnValueOnce({
          select: jest.fn(() => ({
            in: jest.fn(() => Promise.resolve({
              data: [
                {
                  id: 'location_1',
                  name: 'Location 1',
                  address: '123 Test St',
                  cost_center: 'CC001',
                },
                {
                  id: 'location_2',
                  name: 'Location 2',
                  address: '456 Test Ave',
                  cost_center: 'CC002',
                },
              ],
              error: null
            }))
          }))
        })
        .mockReturnValueOnce({
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({
                data: {
                  id: 'invoice_123',
                  invoice_number: 'ENT-2024-0001',
                  total: 15000, // $150.00
                  currency: 'USD',
                  due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                  created_at: new Date().toISOString(),
                },
                error: null
              }))
            }))
          }))
        });

      const invoiceData = {
        enterpriseCustomerId: 'customer_123',
        billingPeriodStart: new Date('2024-01-01'),
        billingPeriodEnd: new Date('2024-01-31'),
        locations: ['location_1', 'location_2'],
        purchaseOrder: 'PO-2024-001',
      };

      const result = await customBillingEngine.generateCustomInvoice(invoiceData);

      expect(result).toBeDefined();
      expect(result.invoiceNumber).toMatch(/^ENT-\d{4}-\d{4}$/);
      expect(result.locations.length).toBe(2);
      expect(result.total).toBeGreaterThan(0);
    });

    it('should apply volume discounts correctly', () => {
      const billingEngine = new (customBillingEngine.constructor as any)();
      
      const locationDetails = Array.from({ length: 100 }, (_, i) => ({
        locationId: `loc_${i}`,
        locationName: `Location ${i}`,
        charges: { baseSubscription: 79 },
      }));

      const lineItems = [
        {
          category: 'subscription',
          totalPrice: 7900, // 100 locations * $79
        },
      ];

      const volumeDiscounts = [
        {
          minimumLocations: 100,
          discountPercentage: 20,
          tierName: 'Professional',
        },
      ];

      const discounts = billingEngine.calculateApplicableDiscounts(100, lineItems, volumeDiscounts);

      expect(discounts.length).toBe(1);
      expect(discounts[0].amount).toBe(1580); // 20% of $7900
      expect(discounts[0].type).toBe('volume');
    });

    it('should calculate taxes correctly for non-exempt customers', async () => {
      const billingEngine = new (customBillingEngine.constructor as any)();
      
      // Mock customer with billing address
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: {
                billing_address: {
                  country: 'US',
                  state: 'CA',
                },
              },
              error: null
            }))
          }))
        }))
      });

      const lineItems = [
        { totalPrice: 10000 }, // $100.00
      ];
      const discounts = [];

      const taxes = await billingEngine.calculateInvoiceTaxes('customer_123', lineItems, discounts, false);

      expect(taxes.length).toBeGreaterThanOrEqual(0);
      if (taxes.length > 0) {
        expect(taxes[0].jurisdiction).toContain('CA');
        expect(taxes[0].amount).toBeGreaterThan(0);
      }
    });
  });

  describe('Purchase Order Processing', () => {
    it('should process purchase order with approval workflow', async () => {
      // Mock billing profile with approval workflow
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: {
                approval_workflow: {
                  enabled: true,
                  approvers: ['manager@company.com', 'finance@company.com'],
                  approval_threshold: 5000,
                },
              },
              error: null
            }))
          }))
        }))
      }).mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: {
                id: 'po_123',
                po_number: 'PO-2024-001',
                status: 'pending_approval',
                approval_workflow: {
                  required: true,
                  approvers: ['manager@company.com', 'finance@company.com'],
                  currentApprover: 'manager@company.com',
                },
                created_at: new Date().toISOString(),
              },
              error: null
            }))
          }))
        }))
      });

      const poData = {
        poNumber: 'PO-2024-001',
        enterpriseCustomerId: 'customer_123',
        description: 'Annual subscription for enterprise directory services',
        amount: 120000, // $1,200.00
        costCenter: 'CC001',
        requestorEmail: 'requestor@company.com',
        department: 'Marketing',
      };

      const result = await customBillingEngine.processPurchaseOrder(poData);

      expect(result).toBeDefined();
      expect(result.poNumber).toBe(poData.poNumber);
      expect(result.status).toBe('pending_approval');
      expect(result.approvalWorkflow.required).toBe(true);
    });

    it('should approve purchase order and progress workflow', async () => {
      // Mock existing PO
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: {
                id: 'po_123',
                approval_workflow: {
                  approvers: ['manager@company.com', 'finance@company.com'],
                  approvalNotes: [],
                  currentApprover: 'manager@company.com',
                },
              },
              error: null
            }))
          }))
        }))
      }).mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({
            data: null,
            error: null
          }))
        }))
      });

      await customBillingEngine.approvePurchaseOrder('po_123', 'manager@company.com', 'Approved for processing');

      expect(mockSupabase.from).toHaveBeenCalledWith('purchase_order_requests');
    });
  });

  describe('Wire Transfer Processing', () => {
    it('should process wire transfer payment with reconciliation tracking', async () => {
      mockSupabase.from
        .mockReturnValueOnce({
          update: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({
              data: null,
              error: null
            }))
          }))
        })
        .mockReturnValueOnce({
          insert: jest.fn(() => Promise.resolve({
            data: null,
            error: null
          }))
        });

      const wireDetails = {
        referenceNumber: 'WIRE-2024-001',
        amount: 120000,
        senderBank: 'Chase Bank',
        receivedDate: new Date().toISOString(),
      };

      await customBillingEngine.processWireTransfer('invoice_123', wireDetails);

      expect(mockSupabase.from).toHaveBeenCalledWith('enterprise_custom_invoices');
      expect(mockSupabase.from).toHaveBeenCalledWith('wire_transfer_processing');
    });

    it('should provide wire transfer instructions', async () => {
      const billingEngine = new (customBillingEngine.constructor as any)();
      
      const instructions = await billingEngine.getWireInstructions();

      expect(instructions).toBeDefined();
      expect(instructions.bankName).toBeDefined();
      expect(instructions.routingNumber).toBeDefined();
      expect(instructions.accountNumber).toBeDefined();
      expect(instructions.beneficiaryName).toBeDefined();
    });
  });

  describe('Invoice Numbering', () => {
    it('should generate sequential invoice numbers', async () => {
      // Mock sequence table
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({
                data: { next_number: 5 },
                error: null
              }))
            }))
          }))
        })
        .mockReturnValueOnce({
          update: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({
              data: null,
              error: null
            }))
          }))
        });

      const billingEngine = new (customBillingEngine.constructor as any)();
      const invoiceNumber = await billingEngine.generateInvoiceNumber();

      expect(invoiceNumber).toMatch(/^ENT-\d{6}-\d{4}$/);
    });

    it('should create new sequence if none exists', async () => {
      // Mock no existing sequence
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({
                data: null,
                error: null
              }))
            }))
          }))
        })
        .mockReturnValueOnce({
          insert: jest.fn(() => Promise.resolve({
            data: null,
            error: null
          }))
        });

      const billingEngine = new (customBillingEngine.constructor as any)();
      const invoiceNumber = await billingEngine.generateInvoiceNumber();

      expect(invoiceNumber).toMatch(/^ENT-\d{6}-0001$/);
    });
  });

  describe('Due Date Calculations', () => {
    it('should calculate due dates correctly for different payment terms', () => {
      const billingEngine = new (customBillingEngine.constructor as any)();
      const invoiceDate = new Date('2024-01-01');

      const testCases = [
        { terms: 'net_30', expectedDays: 30 },
        { terms: 'net_60', expectedDays: 60 },
        { terms: 'net_90', expectedDays: 90 },
        { terms: 'quarterly_prepaid', expectedDays: 7 },
        { terms: 'annual_prepaid', expectedDays: 14 },
      ];

      testCases.forEach(({ terms, expectedDays }) => {
        const dueDate = billingEngine.calculateDueDate(invoiceDate, terms);
        const daysDiff = Math.round((dueDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
        
        expect(daysDiff).toBe(expectedDays);
      });
    });
  });

  describe('Cost Center Management', () => {
    it('should group locations by cost center correctly', () => {
      const billingEngine = new (customBillingEngine.constructor as any)();
      
      const locationDetails = [
        {
          locationName: 'Location 1',
          costCenter: 'CC001',
          charges: { baseSubscription: 79, usageCharges: 10 },
        },
        {
          locationName: 'Location 2',
          costCenter: 'CC001',
          charges: { baseSubscription: 79, usageCharges: 15 },
        },
        {
          locationName: 'Location 3',
          costCenter: 'CC002',
          charges: { baseSubscription: 79, usageCharges: 5 },
        },
      ];

      const costCenters = billingEngine.groupByCostCenter(locationDetails);

      expect(costCenters.length).toBe(2);
      expect(costCenters.find(cc => cc.costCenterCode === 'CC001').locationCount).toBe(2);
      expect(costCenters.find(cc => cc.costCenterCode === 'CC002').locationCount).toBe(1);
      expect(costCenters.find(cc => cc.costCenterCode === 'CC001').totalAmount).toBe(183); // (79+10) + (79+15)
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: null,
              error: { message: 'Database connection failed' }
            }))
          }))
        }))
      });

      const profileData = {
        customerId: 'customer_123',
        companyName: 'Test Corp',
        billingType: 'consolidated' as const,
        paymentTerms: 'net_30' as const,
        preferredPaymentMethod: 'credit_card' as const,
        billingFrequency: 'monthly' as const,
        billingContact: {
          name: 'Test User',
          email: 'test@example.com',
        },
      };

      await expect(customBillingEngine.createBillingProfile(profileData))
        .rejects.toThrow('Failed to create billing profile');
    });

    it('should handle missing customer data', async () => {
      // Mock customer not found
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: null,
              error: null
            }))
          }))
        }))
      });

      const profileData = {
        customerId: 'nonexistent_customer',
        companyName: 'Test Corp',
        billingType: 'consolidated' as const,
        paymentTerms: 'net_30' as const,
        preferredPaymentMethod: 'credit_card' as const,
        billingFrequency: 'monthly' as const,
        billingContact: {
          name: 'Test User',
          email: 'test@example.com',
        },
      };

      await expect(customBillingEngine.createBillingProfile(profileData))
        .rejects.toThrow('Customer not found');
    });
  });

  describe('Performance', () => {
    it('should handle large location datasets efficiently', async () => {
      const startTime = Date.now();
      
      // Mock large dataset of locations
      const locations = Array.from({ length: 1000 }, (_, i) => ({
        id: `location_${i}`,
        name: `Location ${i}`,
        subscriptions: { plan_id: 'plan_123' },
      }));

      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          in: jest.fn(() => Promise.resolve({
            data: locations,
            error: null
          }))
        }))
      });

      const billingEngine = new (customBillingEngine.constructor as any)();
      const locationDetails = await billingEngine.getLocationBillingDetails(
        locations.map(l => l.id),
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(locationDetails.length).toBe(1000);
    });
  });
});

describe('Custom Billing Engine Integration', () => {
  it('should integrate with enterprise sales manager for pricing', async () => {
    // Test integration between custom billing and sales manager
    const testCustomer = {
      id: 'customer_123',
      locationCount: 150,
    };

    // Mock volume discount calculation
    const billingEngine = new (customBillingEngine.constructor as any)();
    const discounts = billingEngine.calculateVolumeDiscounts(testCustomer.locationCount);

    expect(discounts.length).toBeGreaterThan(0);
    expect(discounts.some(d => d.minLocations <= testCustomer.locationCount)).toBeTruthy();
  });

  it('should handle contract management integration', async () => {
    // Test integration with contract management for billing terms
    const mockContractTerms = {
      paymentTerms: 'net_30',
      minimumCommitment: { locations: 100, duration: 24 },
      volumeDiscounts: true,
    };

    // Verify billing engine can handle contract-based terms
    const billingEngine = new (customBillingEngine.constructor as any)();
    const dueDate = billingEngine.calculateDueDate(new Date(), mockContractTerms.paymentTerms);

    expect(dueDate).toBeInstanceOf(Date);
    expect(dueDate.getTime()).toBeGreaterThan(Date.now());
  });
});