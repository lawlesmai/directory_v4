/**
 * EPIC 5 STORY 5.8: Enterprise Sales & Custom Billing
 * Enterprise Sales Manager Test Suite
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock Supabase with hoisted function
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: {
              id: 'lead_123',
              company_name: 'Test Corp',
              contact_name: 'John Doe',
              contact_email: 'john@testcorp.com',
              industry: 'technology',
              location_count: 100,
              qualification_score: 85,
              qualification_tier: 'enterprise',
              estimated_arr_value: 960000,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null
          }))
        }))
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: {
              id: 'lead_123',
              company_name: 'Test Corp',
              qualification_tier: 'enterprise',
            },
            error: null
          })),
          contains: jest.fn(() => ({
            lt: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => Promise.resolve({
                    data: [],
                    error: null
                  }))
                }))
              }))
            }))
          }))
        })),
        order: jest.fn(() => ({
          range: jest.fn(() => Promise.resolve({
            data: [],
            count: 0,
            error: null
          })),
          limit: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: null,
              error: null
            }))
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
  }))
}));

import enterpriseSalesManager from '@/lib/payments/enterprise-sales-manager';

const mockSupabase = (require('@/lib/supabase/server').createClient as jest.Mock)();

describe('Enterprise Sales Manager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Lead Creation', () => {
    it('should create a new enterprise lead with proper qualification scoring', async () => {
      const leadData = {
        companyName: 'Test Corp',
        contactName: 'John Doe',
        contactEmail: 'john@testcorp.com',
        industry: 'technology',
        locationCount: 100,
        estimatedMonthlyVolume: 50000,
        decisionTimeframe: '1-3 months',
        leadSource: 'website',
      };

      const result = await enterpriseSalesManager.createLead(leadData);

      expect(result).toBeDefined();
      expect(result.companyName).toBe(leadData.companyName);
      expect(result.qualificationTier).toBe('enterprise');
      expect(mockSupabase.from).toHaveBeenCalledWith('enterprise_leads');
    });

    it('should calculate qualification score correctly based on criteria', async () => {
      const leadData = {
        companyName: 'Small Business',
        contactName: 'Jane Smith',
        contactEmail: 'jane@smallbiz.com',
        industry: 'retail',
        locationCount: 25,
        estimatedMonthlyVolume: 5000,
        decisionTimeframe: '3-6 months',
        leadSource: 'referral',
      };

      // Mock the private method access for testing
      const salesManager = new (enterpriseSalesManager.constructor as any)();
      const score = salesManager.calculateQualificationScore(leadData);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should handle validation errors for invalid lead data', async () => {
      const invalidLeadData = {
        companyName: '', // Invalid: too short
        contactName: 'John Doe',
        contactEmail: 'invalid-email', // Invalid: not email format
        industry: 'technology',
        locationCount: 0, // Invalid: must be > 0
        estimatedMonthlyVolume: 50000,
        decisionTimeframe: '1-3 months',
        leadSource: 'website',
      };

      await expect(enterpriseSalesManager.createLead(invalidLeadData as any))
        .rejects.toThrow('Failed to create lead');
    });
  });

  describe('Custom Pricing Generation', () => {
    it('should generate custom pricing with volume discounts', async () => {
      // Mock successful pricing generation
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: {
                id: 'pricing_123',
                lead_id: 'lead_123',
                pricing_tier: 'volume_100',
                discount_percentage: 20,
                pricing: {
                  monthlyPerLocation: 63.2,
                  setupFee: 8000,
                },
                created_at: new Date().toISOString(),
              },
              error: null
            }))
          }))
        }))
      });

      const pricingData = {
        leadId: 'lead_123',
        pricingTier: 'volume_100' as const,
        discountPercentage: 20,
        contractLength: 24,
        paymentTerms: 'net_30' as const,
        supportLevel: 'premium' as const,
      };

      const result = await enterpriseSalesManager.generateCustomPricing(pricingData);

      expect(result).toBeDefined();
      expect(result.leadId).toBe(pricingData.leadId);
      expect(result.discountPercentage).toBe(20);
    });

    it('should apply appropriate volume discount tiers', async () => {
      const testCases = [
        { locations: 75, expectedTier: 'volume_50' },
        { locations: 150, expectedTier: 'volume_100' },
        { locations: 750, expectedTier: 'volume_500' },
        { locations: 1500, expectedTier: 'volume_1000' },
      ];

      testCases.forEach(({ locations, expectedTier }) => {
        const salesManager = new (enterpriseSalesManager.constructor as any)();
        const discounts = salesManager.calculateVolumeDiscounts(locations);
        
        expect(discounts.length).toBeGreaterThan(0);
        expect(discounts.some((discount: any) => discount.id === expectedTier.replace('volume_', 'tier_')))
          .toBeTruthy();
      });
    });
  });

  describe('ROI Calculation', () => {
    it('should calculate ROI metrics accurately', async () => {
      // Mock lead and pricing data
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: {
                id: 'lead_123',
                location_count: 100,
                estimated_monthly_volume: 50000,
              },
              error: null
            }))
          }))
        }))
      }).mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: {
                    pricing: {
                      monthlyPerLocation: 60,
                      setupFee: 8000,
                      professionalServices: 15000,
                    },
                  },
                  error: null
                }))
              }))
            }))
          }))
        }))
      });

      const currentCosts = {
        platformFees: 120000,
        maintenanceCosts: 24000,
        staffTime: 36000,
        opportunityCosts: 18000,
      };

      const roiResult = await enterpriseSalesManager.calculateROI('lead_123', currentCosts);

      expect(roiResult).toBeDefined();
      expect(roiResult.roiMetrics.threeYearRoi).toBeGreaterThan(0);
      expect(roiResult.roiMetrics.paybackPeriod).toBeGreaterThan(0);
    });
  });

  describe('Sales Stage Management', () => {
    it('should update sales stage and create activity record', async () => {
      const updateData = {
        leadId: 'lead_123',
        salesStage: 'demo' as const,
        notes: 'Demo scheduled for next week',
        nextAction: 'Follow up after demo',
        nextActionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      // Mock the getAssignedSalesRep method
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: { assigned_sales_rep: 'sales_rep_1' },
              error: null
            }))
          }))
        }))
      });

      await enterpriseSalesManager.updateSalesStage(updateData);

      expect(mockSupabase.from).toHaveBeenCalledWith('enterprise_leads');
    });
  });

  describe('Lead Qualification', () => {
    it('should qualify leads based on comprehensive scoring criteria', () => {
      const salesManager = new (enterpriseSalesManager.constructor as any)();
      
      // High-value enterprise lead
      const enterpriseLead = {
        locationCount: 500,
        estimatedMonthlyVolume: 100000,
        industry: 'healthcare',
        decisionTimeframe: 'immediate',
      };

      const enterpriseScore = salesManager.calculateQualificationScore(enterpriseLead);
      const enterpriseTier = salesManager.determineQualificationTier(enterpriseScore, enterpriseLead.locationCount);

      expect(enterpriseScore).toBeGreaterThan(80);
      expect(enterpriseTier).toBe('enterprise');

      // Mid-tier qualified lead
      const qualifiedLead = {
        locationCount: 50,
        estimatedMonthlyVolume: 10000,
        industry: 'professional_services',
        decisionTimeframe: '1-3 months',
      };

      const qualifiedScore = salesManager.calculateQualificationScore(qualifiedLead);
      const qualifiedTier = salesManager.determineQualificationTier(qualifiedScore, qualifiedLead.locationCount);

      expect(qualifiedTier).toBe('qualified');

      // Lower-tier prospect
      const prospectLead = {
        locationCount: 10,
        estimatedMonthlyVolume: 1000,
        industry: 'other',
        decisionTimeframe: '6-12 months',
      };

      const prospectScore = salesManager.calculateQualificationScore(prospectLead);
      const prospectTier = salesManager.determineQualificationTier(prospectScore, prospectLead.locationCount);

      expect(prospectTier).toBe('prospect');
    });
  });

  describe('Sales Activity Tracking', () => {
    it('should create sales activity records', async () => {
      const activityData = {
        leadId: 'lead_123',
        activityType: 'call' as const,
        subject: 'Initial discovery call',
        description: 'Discussed business needs and timeline',
        salesRepId: 'sales_rep_1',
      };

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: {
                id: 'activity_123',
                ...activityData,
                created_at: new Date().toISOString(),
              },
              error: null
            }))
          }))
        }))
      });

      const result = await enterpriseSalesManager.createSalesActivity(activityData);

      expect(result).toBeDefined();
      expect(result.leadId).toBe(activityData.leadId);
      expect(result.activityType).toBe(activityData.activityType);
    });

    it('should retrieve sales activities for a lead', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({
              data: [
                {
                  id: 'activity_1',
                  lead_id: 'lead_123',
                  activity_type: 'call',
                  subject: 'Discovery call',
                  created_at: new Date().toISOString(),
                },
              ],
              error: null
            }))
          }))
        }))
      });

      const activities = await enterpriseSalesManager.getSalesActivities('lead_123');

      expect(activities).toBeDefined();
      expect(activities.length).toBeGreaterThan(0);
      expect(activities[0].leadId).toBe('lead_123');
    });
  });

  describe('Lead Retrieval', () => {
    it('should get lead by ID', async () => {
      const leadId = 'lead_123';
      
      const result = await enterpriseSalesManager.getLead(leadId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(leadId);
    });

    it('should get leads with filtering and pagination', async () => {
      const filters = {
        qualificationTier: 'enterprise',
        salesStage: 'proposal',
        page: 1,
        limit: 10,
      };

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                range: jest.fn(() => Promise.resolve({
                  data: [],
                  count: 0,
                  error: null
                }))
              }))
            }))
          }))
        }))
      });

      const result = await enterpriseSalesManager.getLeads(filters);

      expect(result).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(filters.page);
      expect(result.pagination.limit).toBe(filters.limit);
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

      const leadData = {
        companyName: 'Test Corp',
        contactName: 'John Doe',
        contactEmail: 'john@testcorp.com',
        industry: 'technology',
        locationCount: 100,
        estimatedMonthlyVolume: 50000,
        decisionTimeframe: '1-3 months',
        leadSource: 'website',
      };

      await expect(enterpriseSalesManager.createLead(leadData))
        .rejects.toThrow('Failed to create lead');
    });

    it('should handle missing lead data gracefully', async () => {
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

      const result = await enterpriseSalesManager.getLead('nonexistent_lead');

      expect(result).toBeNull();
    });
  });

  describe('Performance', () => {
    it('should handle large lead datasets efficiently', async () => {
      const startTime = Date.now();
      
      // Mock large dataset
      const mockLeads = Array.from({ length: 1000 }, (_, i) => ({
        id: `lead_${i}`,
        company_name: `Company ${i}`,
        qualification_score: Math.floor(Math.random() * 100),
      }));

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          order: jest.fn(() => ({
            range: jest.fn(() => Promise.resolve({
              data: mockLeads.slice(0, 20),
              count: 1000,
              error: null
            }))
          }))
        }))
      });

      const result = await enterpriseSalesManager.getLeads({ page: 1, limit: 20 });
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.leads.length).toBe(20);
      expect(result.pagination.total).toBe(1000);
    });
  });
});

describe('Enterprise Sales Manager Integration', () => {
  it('should integrate with custom billing engine for pricing', async () => {
    // This would test the integration between sales manager and billing engine
    // Mock the billing engine methods
    const mockBillingEngine = {
      generateCustomPricing: jest.fn(() => Promise.resolve({
        id: 'pricing_123',
        monthlyTotal: 6000,
        annualTotal: 72000,
        discountAmount: 14400,
      }))
    };

    // Test integration flow
    const leadData = {
      companyName: 'Integration Test Corp',
      contactName: 'Test User',
      contactEmail: 'test@integration.com',
      industry: 'technology',
      locationCount: 100,
      estimatedMonthlyVolume: 50000,
      decisionTimeframe: '1-3 months',
      leadSource: 'integration_test',
    };

    const lead = await enterpriseSalesManager.createLead(leadData);
    expect(lead).toBeDefined();

    // Verify lead can be used for pricing generation
    expect(lead.locationCount).toBe(100);
    expect(lead.qualificationTier).toBe('enterprise');
  });
});