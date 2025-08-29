/**
 * EPIC 5 STORY 5.8: Enterprise Sales & Custom Billing
 * Enterprise Analytics Test Suite
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock Supabase - define before imports
const mockSupabase = {
  from: jest.fn(() => ({
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({
          data: {
            id: 'sla_metrics_123',
            customer_id: 'customer_123',
            overall_score: 95.5,
            uptime: { actual: 99.95, target: 99.9 },
            support: { averageResponseTime: 3.2, customerSatisfaction: 4.8 },
            performance: { errorRate: 0.1 },
            compliance: { status: 'compliant' },
            created_at: new Date().toISOString(),
          },
          error: null
        }))
      }))
    })),
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => ({
          gte: jest.fn(() => ({
            lte: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({
                data: [
                  {
                    id: 'incident_1',
                    severity: 'high',
                    duration: 15,
                    customer_impact: 'Minimal service degradation',
                  },
                ],
                error: null
              }))
            }))
          }))
        })),
        order: jest.fn(() => Promise.resolve({
          data: [],
          error: null
        })),
        limit: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: {
              terms: {
                serviceLevel: {
                  uptime: 99.9,
                  supportResponseTime: 4,
                  implementationTime: 30,
                }
              }
            },
            error: null
          }))
        }))
      }))
    }))
  }))
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabase
}));

import enterpriseAnalytics from '@/lib/analytics/enterprise-analytics';

describe('Enterprise Analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SLA Metrics Generation', () => {
    it('should generate comprehensive SLA metrics report', async () => {
      const customerId = 'customer_123';
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');

      const result = await enterpriseAnalytics.generateSLAMetrics(customerId, periodStart, periodEnd);

      expect(result).toBeDefined();
      expect(result.customerId).toBe(customerId);
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      expect(result.uptime).toBeDefined();
      expect(result.support).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.compliance).toBeDefined();
    });

    it('should calculate uptime metrics correctly', async () => {
      const analytics = new (enterpriseAnalytics.constructor as any)();
      
      // Mock incident data
      const incidents = [
        { duration: 15, severity: 'high' },
        { duration: 5, severity: 'medium' },
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              lte: jest.fn(() => Promise.resolve({
                data: incidents,
                error: null
              }))
            }))
          }))
        }))
      });

      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');
      const totalMinutes = (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60);
      const downtimeMinutes = 20; // 15 + 5
      const expectedUptime = ((totalMinutes - downtimeMinutes) / totalMinutes) * 100;

      const uptimeMetrics = await analytics.calculateUptimeMetrics(
        'customer_123',
        periodStart,
        periodEnd,
        99.9
      );

      expect(uptimeMetrics.target).toBe(99.9);
      expect(uptimeMetrics.downtime).toBe(downtimeMinutes);
      expect(uptimeMetrics.incidents.length).toBe(2);
    });

    it('should calculate support metrics with response times', async () => {
      const analytics = new (enterpriseAnalytics.constructor as any)();
      
      const mockTickets = [
        {
          id: 'ticket_1',
          priority: 'high',
          first_response_time: 2.5,
          resolution_time: 8.0,
          escalated: false,
          satisfaction_rating: 5,
        },
        {
          id: 'ticket_2',
          priority: 'medium',
          first_response_time: 4.0,
          resolution_time: 12.0,
          escalated: true,
          satisfaction_rating: 4,
        },
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              lte: jest.fn(() => Promise.resolve({
                data: mockTickets,
                error: null
              }))
            }))
          }))
        }))
      });

      const supportMetrics = await analytics.calculateSupportMetrics(
        'customer_123',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        4 // target response time
      );

      expect(supportMetrics.averageResponseTime).toBe(3.25); // (2.5 + 4.0) / 2
      expect(supportMetrics.escalations).toBe(1);
      expect(supportMetrics.customerSatisfaction).toBe(4.5); // (5 + 4) / 2
    });

    it('should calculate overall SLA score with weighted factors', () => {
      const analytics = new (enterpriseAnalytics.constructor as any)();
      
      const uptimeMetrics = { actual: 99.95, target: 99.9 };
      const supportMetrics = { 
        averageResponseTime: 3.2, 
        responseTimeTarget: 4.0,
        customerSatisfaction: 4.8 
      };
      const performanceMetrics = { errorRate: 0.1 };
      const complianceMetrics = { status: 'compliant' };

      const overallScore = analytics.calculateOverallSLAScore(
        uptimeMetrics,
        supportMetrics,
        performanceMetrics,
        complianceMetrics
      );

      expect(overallScore).toBeGreaterThan(90);
      expect(overallScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Usage Analytics Generation', () => {
    it('should generate comprehensive usage analytics', async () => {
      // Mock locations data
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({
            data: [
              { id: 'location_1', name: 'Location 1' },
              { id: 'location_2', name: 'Location 2' },
            ],
            error: null
          }))
        }))
      }).mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: {
                id: 'usage_analytics_123',
                customer_id: 'customer_123',
                locations: [],
                features: [],
                engagement: {},
                business: {},
                trends: {},
                created_at: new Date().toISOString(),
              },
              error: null
            }))
          }))
        }))
      });

      const customerId = 'customer_123';
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');

      const result = await enterpriseAnalytics.generateUsageAnalytics(customerId, periodStart, periodEnd);

      expect(result).toBeDefined();
      expect(result.customerId).toBe(customerId);
      expect(result.locations).toBeDefined();
      expect(result.features).toBeDefined();
      expect(result.engagement).toBeDefined();
      expect(result.business).toBeDefined();
      expect(result.trends).toBeDefined();
    });

    it('should calculate location usage metrics', async () => {
      const analytics = new (enterpriseAnalytics.constructor as any)();
      
      const locationUsage = await analytics.calculateLocationUsage(
        'location_123',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(locationUsage.profileViews).toBeGreaterThan(0);
      expect(locationUsage.searchAppearances).toBeGreaterThan(0);
      expect(locationUsage.customerInquiries).toBeGreaterThanOrEqual(0);
      expect(locationUsage.overallEngagement).toBeBetween(70, 100);
    });

    it('should generate feature usage analytics', async () => {
      const analytics = new (enterpriseAnalytics.constructor as any)();
      
      const featureUsage = await analytics.calculateFeatureUsage(
        'customer_123',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(featureUsage).toBeInstanceOf(Array);
      expect(featureUsage.length).toBeGreaterThan(0);
      
      featureUsage.forEach(feature => {
        expect(feature.featureName).toBeDefined();
        expect(feature.category).toBeOneOf(['core', 'premium', 'enterprise']);
        expect(feature.adoptionRate).toBeBetween(0, 100);
        expect(feature.satisfaction).toBeBetween(1, 5);
      });
    });
  });

  describe('Incident Recording', () => {
    it('should record uptime incidents with proper validation', async () => {
      const incidentData = {
        customerId: 'customer_123',
        severity: 'high' as const,
        cause: 'Database connection timeout causing service degradation',
        affectedServices: ['api', 'dashboard'],
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T10:15:00Z'),
        customerImpact: 'Minor service delays for dashboard access',
      };

      await enterpriseAnalytics.recordIncident(incidentData);

      expect(mockSupabase.from).toHaveBeenCalledWith('uptime_incidents');
    });

    it('should validate incident data properly', async () => {
      const invalidIncidentData = {
        customerId: 'customer_123',
        severity: 'invalid' as any, // Invalid severity
        cause: 'Short', // Too short
        affectedServices: [], // Empty array
        startTime: new Date(),
        customerImpact: 'Test impact',
      };

      await expect(enterpriseAnalytics.recordIncident(invalidIncidentData))
        .rejects.toThrow();
    });
  });

  describe('Report Generation', () => {
    it('should generate SLA report', async () => {
      const reportData = {
        customerId: 'customer_123',
        reportType: 'sla' as const,
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
        deliveryMethod: 'portal' as const,
      };

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: {
                id: 'report_123',
                customer_id: 'customer_123',
                report_type: 'sla',
                status: 'generated',
                created_at: new Date().toISOString(),
              },
              error: null
            }))
          }))
        }))
      });

      const result = await enterpriseAnalytics.generateReport(reportData);

      expect(result).toBeDefined();
      expect(result.reportType).toBe('sla');
      expect(result.slaMetrics).toBeDefined();
    });

    it('should generate usage analytics report', async () => {
      const reportData = {
        customerId: 'customer_123',
        reportType: 'usage' as const,
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
        deliveryMethod: 'email' as const,
        recipients: ['manager@customer.com'],
      };

      const result = await enterpriseAnalytics.generateReport(reportData);

      expect(result).toBeDefined();
      expect(result.reportType).toBe('usage');
      expect(result.usageAnalytics).toBeDefined();
    });

    it('should generate executive summary report', async () => {
      const reportData = {
        customerId: 'customer_123',
        reportType: 'executive_summary' as const,
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
        deliveryMethod: 'portal' as const,
      };

      const result = await enterpriseAnalytics.generateReport(reportData);

      expect(result).toBeDefined();
      expect(result.reportType).toBe('executive_summary');
      expect(result.executiveSummary).toBeDefined();
      expect(result.executiveSummary.keyMetrics).toBeDefined();
      expect(result.executiveSummary.achievements).toBeDefined();
      expect(result.executiveSummary.recommendations).toBeDefined();
    });
  });

  describe('Compliance Metrics', () => {
    it('should calculate compliance status correctly', async () => {
      const analytics = new (enterpriseAnalytics.constructor as any)();
      
      // Mock contract with compliance requirements
      const mockContract = {
        compliance: {
          required: [
            { type: 'soc2', status: 'compliant' },
            { type: 'gdpr', status: 'compliant' },
            { type: 'hipaa', status: 'at_risk' },
          ]
        }
      };

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: mockContract,
              error: null
            }))
          }))
        }))
      });

      const complianceMetrics = await analytics.calculateComplianceMetrics(
        'customer_123',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(complianceMetrics.status).toBe('at_risk'); // Due to HIPAA at_risk
      expect(complianceMetrics.requirements.length).toBe(3);
      expect(complianceMetrics.requirements.some(req => req.requirement === 'soc2')).toBeTruthy();
    });
  });

  describe('Performance Metrics', () => {
    it('should calculate performance metrics from database data', async () => {
      const analytics = new (enterpriseAnalytics.constructor as any)();
      
      const mockPerformanceData = [
        {
          page_load_time: 1500,
          api_response_time: 250,
          search_response_time: 800,
          total_requests: 10000,
          error_count: 5,
        },
        {
          page_load_time: 1800,
          api_response_time: 300,
          search_response_time: 900,
          total_requests: 12000,
          error_count: 8,
        },
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              lte: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({
                  data: mockPerformanceData,
                  error: null
                }))
              }))
            }))
          }))
        }))
      });

      const performanceMetrics = await analytics.calculatePerformanceMetrics(
        'customer_123',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(performanceMetrics.pageLoadTime).toBe(1650); // Average of 1500 and 1800
      expect(performanceMetrics.apiResponseTime).toBe(275); // Average of 250 and 300
      expect(performanceMetrics.errorRate).toBeCloseTo(0.059); // (5+8)/(10000+12000)*100
    });

    it('should handle empty performance data gracefully', async () => {
      const analytics = new (enterpriseAnalytics.constructor as any)();
      
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              lte: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({
                  data: [],
                  error: null
                }))
              }))
            }))
          }))
        }))
      });

      const performanceMetrics = await analytics.calculatePerformanceMetrics(
        'customer_123',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(performanceMetrics.pageLoadTime).toBe(0);
      expect(performanceMetrics.apiResponseTime).toBe(0);
      expect(performanceMetrics.errorRate).toBe(0);
    });
  });

  describe('Executive Summary Generation', () => {
    it('should generate comprehensive executive summary', () => {
      const analytics = new (enterpriseAnalytics.constructor as any)();
      
      const mockSLAMetrics = {
        overallScore: 95.5,
        uptime: { actual: 99.95, target: 99.9 },
        support: { customerSatisfaction: 4.8 },
      };

      const mockUsageAnalytics = {
        engagement: { totalSessions: 2450 },
      };

      const executiveSummary = analytics.generateExecutiveSummary(mockSLAMetrics, mockUsageAnalytics);

      expect(executiveSummary.keyMetrics).toBeInstanceOf(Array);
      expect(executiveSummary.keyMetrics.length).toBeGreaterThan(0);
      expect(executiveSummary.achievements).toBeInstanceOf(Array);
      expect(executiveSummary.recommendations).toBeInstanceOf(Array);
      expect(executiveSummary.nextSteps).toBeInstanceOf(Array);

      // Verify key metrics structure
      executiveSummary.keyMetrics.forEach(metric => {
        expect(metric.name).toBeDefined();
        expect(metric.value).toBeDefined();
        expect(metric.unit).toBeDefined();
        expect(metric.trend).toBeOneOf(['up', 'down', 'stable']);
        expect(metric.status).toBeOneOf(['on_track', 'at_risk', 'behind']);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: null,
              error: { message: 'Database connection failed' }
            }))
          }))
        }))
      });

      await expect(enterpriseAnalytics.generateSLAMetrics(
        'customer_123',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      )).rejects.toThrow('Active contract not found');
    });

    it('should handle missing contract data', async () => {
      // Mock no contract found
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

      await expect(enterpriseAnalytics.generateSLAMetrics(
        'customer_123',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      )).rejects.toThrow('Active contract not found');
    });
  });

  describe('Data Mapping', () => {
    it('should correctly map database records to SLA metrics', () => {
      const analytics = new (enterpriseAnalytics.constructor as any)();
      
      const dbRecord = {
        id: 'sla_123',
        customer_id: 'customer_123',
        contract_id: 'contract_123',
        reporting_period_start: '2024-01-01T00:00:00Z',
        reporting_period_end: '2024-01-31T23:59:59Z',
        uptime: { actual: 99.95 },
        support: { averageResponseTime: 3.2 },
        performance: { errorRate: 0.1 },
        compliance: { status: 'compliant' },
        overall_score: 95.5,
        created_at: '2024-02-01T00:00:00Z',
      };

      const mapped = analytics.mapToSLAMetrics(dbRecord);

      expect(mapped.id).toBe('sla_123');
      expect(mapped.customerId).toBe('customer_123');
      expect(mapped.reportingPeriod.start).toBeInstanceOf(Date);
      expect(mapped.reportingPeriod.end).toBeInstanceOf(Date);
      expect(mapped.overallScore).toBe(95.5);
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', async () => {
      const startTime = Date.now();
      
      // Mock large dataset
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: `metric_${i}`,
        page_load_time: Math.random() * 3000,
        api_response_time: Math.random() * 1000,
        total_requests: Math.floor(Math.random() * 1000),
        error_count: Math.floor(Math.random() * 10),
      }));

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              lte: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({
                  data: largeDataset,
                  error: null
                }))
              }))
            }))
          }))
        }))
      });

      const analytics = new (enterpriseAnalytics.constructor as any)();
      await analytics.calculatePerformanceMetrics(
        'customer_123',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });
});

// Helper function for testing ranges
expect.extend({
  toBeBetween(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    return {
      message: () => `expected ${received} to be between ${floor} and ${ceiling}`,
      pass,
    };
  },
  toBeOneOf(received: any, expectedValues: any[]) {
    const pass = expectedValues.includes(received);
    return {
      message: () => `expected ${received} to be one of [${expectedValues.join(', ')}]`,
      pass,
    };
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeBetween(floor: number, ceiling: number): R;
      toBeOneOf(expectedValues: any[]): R;
    }
  }
}