/**
 * EPIC 5 STORY 5.6: Revenue Analytics & Business Intelligence
 * Analytics API Integration Test Suite
 * 
 * Comprehensive tests for analytics API endpoints and integration
 */

import { NextRequest } from 'next/server';
import { GET as revenueGET, POST as revenuePOST } from '@/app/api/analytics/revenue/route';
import { GET as customersGET, POST as customersPOST } from '@/app/api/analytics/customers/route';
import { GET as executiveGET } from '@/app/api/analytics/executive/route';

// Mock Supabase
jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
  }),
}));

// Mock analytics modules
jest.mock('@/lib/analytics/revenue-calculator', () => ({
  __esModule: true,
  default: {
    calculateRevenueMetrics: jest.fn(),
    calculateRevenueAttribution: jest.fn(),
    getRevenueTrend: jest.fn(),
    getRevenueSegmentation: jest.fn(),
    getRevenueCohorts: jest.fn(),
  },
}));

jest.mock('@/lib/analytics/customer-analytics', () => ({
  __esModule: true,
  default: {
    analyzeCustomerAcquisition: jest.fn(),
    calculateCustomerLifetimeValue: jest.fn(),
    analyzeChurn: jest.fn(),
    generateCohortAnalysis: jest.fn(),
    segmentCustomers: jest.fn(),
    analyzeCustomerJourney: jest.fn(),
  },
}));

jest.mock('@/lib/analytics/forecasting-engine', () => ({
  __esModule: true,
  default: {
    forecastRevenue: jest.fn(),
    forecastCustomerGrowth: jest.fn(),
    predictChurn: jest.fn(),
    generateScenarioAnalysis: jest.fn(),
  },
}));

describe('Revenue Analytics API', () => {
  let mockSupabase: any;
  let mockRevenueCalculator: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Set up common mocks
    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnValue({
        data: [{ role: { name: 'admin' } }],
      }),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
    };

    mockRevenueCalculator = require('@/lib/analytics/revenue-calculator').default;
  });

  describe('GET /api/analytics/revenue', () => {
    test('should return current revenue metrics', async () => {
      mockRevenueCalculator.calculateRevenueMetrics.mockResolvedValue({
        current: { mrr: 31780, arr: 381360, customers: 125, arpu: 254.24 },
        previous: { mrr: 28000, arr: 336000, customers: 120, arpu: 233.33 },
        growth: { mrrGrowthRate: 13.5, arrGrowthRate: 13.5, customerGrowthRate: 4.2, arpuGrowthRate: 8.9 },
      });

      mockRevenueCalculator.calculateRevenueAttribution.mockResolvedValue({
        newRevenue: 5000,
        expansionRevenue: 1200,
        contractionRevenue: 800,
        churnedRevenue: 1620,
        netNewRevenue: 3780,
        reactivationRevenue: 0,
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/revenue?period=current');
      const response = await revenueGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('metrics');
      expect(data.data).toHaveProperty('attribution');
      expect(data.data.metrics.current.mrr).toBe(31780);
    });

    test('should return revenue trend data', async () => {
      mockRevenueCalculator.getRevenueTrend.mockResolvedValue([
        { period: '2024-01', mrr: 25000, arr: 300000, customers: 100, growthRate: 0 },
        { period: '2024-02', mrr: 28000, arr: 336000, customers: 110, growthRate: 12 },
        { period: '2024-03', mrr: 31780, arr: 381360, customers: 125, growthRate: 13.5 },
      ]);

      const request = new NextRequest('http://localhost:3000/api/analytics/revenue?period=trend&months=3');
      const response = await revenueGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.trend).toHaveLength(3);
      expect(data.data.statistics).toHaveProperty('totalGrowth');
      expect(data.data.statistics).toHaveProperty('averageGrowthRate');
    });

    test('should handle unauthorized access', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/revenue');
      const response = await revenueGET(request);

      expect(response.status).toBe(401);
    });

    test('should handle non-admin users', async () => {
      mockSupabase.select.mockReturnValue({
        data: [{ role: { name: 'user' } }],
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/revenue');
      const response = await revenueGET(request);

      expect(response.status).toBe(403);
    });

    test('should validate query parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/analytics/revenue?period=invalid');
      const response = await revenueGET(request);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/analytics/revenue', () => {
    test('should handle metrics recalculation request', async () => {
      const requestBody = {
        action: 'recalculate',
        config: {
          period: {
            start: '2024-01-01T00:00:00Z',
            end: '2024-01-31T23:59:59Z',
          },
          forceRefresh: true,
        },
      };

      const request = new NextRequest('http://localhost:3000/api/analytics/revenue', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await revenuePOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveProperty('jobId');
      expect(data.data.status).toBe('started');
    });

    test('should handle custom analysis request', async () => {
      const requestBody = {
        action: 'custom_analysis',
        config: {
          analysisType: 'growth_attribution',
          parameters: { includeSegmentation: true },
          dateRange: {
            start: '2024-01-01T00:00:00Z',
            end: '2024-01-31T23:59:59Z',
          },
        },
      };

      const request = new NextRequest('http://localhost:3000/api/analytics/revenue', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await revenuePOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveProperty('analysisType');
      expect(data.data).toHaveProperty('result');
    });
  });
});

describe('Customer Analytics API', () => {
  let mockCustomerAnalytics: any;

  beforeEach(() => {
    mockCustomerAnalytics = require('@/lib/analytics/customer-analytics').default;
  });

  describe('GET /api/analytics/customers', () => {
    test('should return customer acquisition metrics', async () => {
      mockCustomerAnalytics.analyzeCustomerAcquisition.mockResolvedValue({
        totalCustomers: 1000,
        newCustomersThisPeriod: 50,
        customerGrowthRate: 5.2,
        acquisitionCost: {
          average: 125,
          median: 95,
          byChannel: [
            { channel: 'organic', cost: 0, customers: 20, costPerCustomer: 0 },
            { channel: 'paid_search', cost: 3000, customers: 30, costPerCustomer: 100 },
          ],
        },
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/customers?analysis=acquisition');
      const response = await customersGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.metrics.totalCustomers).toBe(1000);
      expect(data.data.metrics.acquisitionCost.byChannel).toHaveLength(2);
    });

    test('should return customer LTV metrics', async () => {
      mockCustomerAnalytics.calculateCustomerLifetimeValue.mockResolvedValue({
        overall: {
          averageLTV: 1250,
          medianLTV: 950,
          totalCustomers: 1000,
          ltvcacRatio: 4.2,
          paybackPeriodMonths: 8,
        },
        bySegment: [
          { segment: 'high_value', averageLTV: 2500, customers: 200 },
          { segment: 'low_value', averageLTV: 650, customers: 800 },
        ],
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/customers?analysis=ltv');
      const response = await customersGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.metrics.overall.averageLTV).toBe(1250);
      expect(data.data.metrics.overall.ltvcacRatio).toBe(4.2);
    });

    test('should return churn analysis', async () => {
      mockCustomerAnalytics.analyzeChurn.mockResolvedValue({
        overview: {
          customerChurnRate: 4.2,
          revenueChurnRate: 3.8,
          netRevenueChurnRate: 2.1,
          churnedCustomers: 42,
          churnedRevenue: 3800,
          averageDaysToChurn: 185,
        },
        churnPrediction: {
          atRiskCustomers: 85,
          highRiskCustomers: 23,
          predictedChurn30Days: 12,
          predictedChurn90Days: 28,
        },
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/customers?analysis=churn&includePredictions=true');
      const response = await customersGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.analysis.overview.customerChurnRate).toBe(4.2);
      expect(data.data.analysis.churnPrediction.atRiskCustomers).toBe(85);
    });

    test('should return customer overview', async () => {
      // Mock all required analytics calls
      mockCustomerAnalytics.analyzeCustomerAcquisition.mockResolvedValue({
        totalCustomers: 1000,
        customerGrowthRate: 5.2,
      });

      mockCustomerAnalytics.calculateCustomerLifetimeValue.mockResolvedValue({
        overall: { averageLTV: 1250, ltvcacRatio: 4.2 },
      });

      mockCustomerAnalytics.analyzeChurn.mockResolvedValue({
        overview: { customerChurnRate: 4.2 },
        churnPrediction: { atRiskCustomers: 85 },
      });

      mockCustomerAnalytics.segmentCustomers.mockResolvedValue({
        healthScoring: { healthy: 700, atRisk: 200, critical: 50, champion: 50 },
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/customers?analysis=overview');
      const response = await customersGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveProperty('summary');
      expect(data.data).toHaveProperty('metrics');
      expect(data.data.summary.overview.totalCustomers).toBe(1000);
    });
  });

  describe('POST /api/analytics/customers', () => {
    test('should handle churn prediction update request', async () => {
      const requestBody = {
        action: 'update_churn_predictions',
        config: {
          modelType: 'logistic',
          riskThreshold: 0.7,
        },
      };

      const request = new NextRequest('http://localhost:3000/api/analytics/customers', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await customersPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveProperty('jobId');
      expect(data.data.modelType).toBe('logistic');
    });
  });
});

describe('Executive Dashboard API', () => {
  let mockRevenueCalculator: any;
  let mockCustomerAnalytics: any;
  let mockForecastingEngine: any;

  beforeEach(() => {
    mockRevenueCalculator = require('@/lib/analytics/revenue-calculator').default;
    mockCustomerAnalytics = require('@/lib/analytics/customer-analytics').default;
    mockForecastingEngine = require('@/lib/analytics/forecasting-engine').default;
  });

  describe('GET /api/analytics/executive', () => {
    test('should return executive overview', async () => {
      // Mock all required data
      mockRevenueCalculator.calculateRevenueMetrics.mockResolvedValue({
        current: { mrr: 31780, arr: 381360, customers: 125 },
        previous: { mrr: 28000, arr: 336000, customers: 120 },
        growth: { mrrGrowthRate: 13.5, arrGrowthRate: 13.5, customerGrowthRate: 4.2 },
      });

      mockCustomerAnalytics.analyzeCustomerAcquisition.mockResolvedValue({
        customerGrowthRate: 5.2,
      });

      mockCustomerAnalytics.analyzeChurn.mockResolvedValue({
        overview: { customerChurnRate: 4.2 },
        churnPrediction: { atRiskCustomers: 85 },
      });

      mockForecastingEngine.forecastRevenue.mockResolvedValue({
        predictions: [
          { period: '2024-04', predicted: 35000, confidence: 85 },
          { period: '2024-05', predicted: 38500, confidence: 82 },
          { period: '2024-06', predicted: 42350, confidence: 78 },
        ],
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/executive?view=overview');
      const response = await executiveGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveProperty('kpis');
      expect(data.data).toHaveProperty('healthScore');
      expect(data.data).toHaveProperty('insights');
      expect(data.data).toHaveProperty('forecasts');
      
      expect(data.data.kpis).toBeInstanceOf(Array);
      expect(data.data.healthScore).toHaveProperty('overall');
      expect(data.data.forecasts.revenue).toHaveLength(3);
    });

    test('should return detailed analytics', async () => {
      // Mock comprehensive analytics data
      mockRevenueCalculator.calculateRevenueMetrics.mockResolvedValue({
        current: { mrr: 31780, arr: 381360 },
        growth: { mrrGrowthRate: 13.5 },
      });

      mockRevenueCalculator.getRevenueSegmentation.mockResolvedValue({
        byPlan: [
          { planName: 'Starter', mrr: 15000, customers: 50 },
          { planName: 'Pro', mrr: 16780, customers: 75 },
        ],
      });

      mockCustomerAnalytics.analyzeCustomerAcquisition.mockResolvedValue({
        totalCustomers: 1000,
      });

      mockCustomerAnalytics.segmentCustomers.mockResolvedValue({
        segments: [
          { name: 'high_value', customers: 200, averageRevenue: 250 },
        ],
      });

      mockCustomerAnalytics.generateCohortAnalysis.mockResolvedValue({
        retentionCohorts: [
          { month: '2024-01', size: 100, retentionRates: [85, 78, 72] },
        ],
      });

      mockCustomerAnalytics.analyzeChurn.mockResolvedValue({
        overview: { customerChurnRate: 4.2 },
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/executive?view=detailed');
      const response = await executiveGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveProperty('revenue');
      expect(data.data).toHaveProperty('customers');
      expect(data.data).toHaveProperty('churn');
      
      expect(data.data.revenue).toHaveProperty('metrics');
      expect(data.data.revenue).toHaveProperty('segmentation');
      expect(data.data.customers).toHaveProperty('cohorts');
    });

    test('should return forecasts', async () => {
      mockForecastingEngine.forecastRevenue.mockResolvedValue({
        predictions: [
          { period: '2024-04', predicted: 35000, confidence: 85, lowerBound: 32000, upperBound: 38000 },
        ],
        scenarios: {
          conservative: [32000],
          base: [35000],
          optimistic: [38500],
        },
      });

      mockForecastingEngine.forecastCustomerGrowth.mockResolvedValue({
        totalCustomers: [
          { period: '2024-04', predicted: 135, confidence: 88 },
        ],
      });

      mockForecastingEngine.predictChurn.mockResolvedValue({
        model: { accuracy: 0.78, precision: 0.75 },
        predictions: [
          { customerId: 'cust-1', churnProbability: 0.8, riskLevel: 'high' },
        ],
      });

      mockForecastingEngine.generateScenarioAnalysis.mockResolvedValue({
        scenarios: [
          { name: 'base', results: { revenueImpact: 0, probability: 0.6 } },
        ],
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/executive?view=forecasts');
      const response = await executiveGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveProperty('forecasts');
      expect(data.data).toHaveProperty('scenarios');
      expect(data.data).toHaveProperty('confidence');
      
      expect(data.data.forecasts.revenue.predictions).toHaveLength(1);
      expect(data.data.scenarios.scenarios).toHaveLength(1);
    });

    test('should return alerts', async () => {
      // Mock data that would trigger alerts
      mockRevenueCalculator.calculateRevenueMetrics.mockResolvedValue({
        growth: { mrrGrowthRate: -8 }, // Negative growth should trigger alert
      });

      mockCustomerAnalytics.analyzeCustomerAcquisition.mockResolvedValue({
        customerGrowthRate: -2,
      });

      mockCustomerAnalytics.analyzeChurn.mockResolvedValue({
        overview: { customerChurnRate: 12 }, // High churn should trigger alert
        churnPrediction: { atRiskCustomers: 150 },
      });

      mockCustomerAnalytics.segmentCustomers.mockResolvedValue({
        healthScoring: { critical: 25, healthy: 400, atRisk: 100, champion: 75 },
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/executive?view=alerts');
      const response = await executiveGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveProperty('alerts');
      expect(data.data).toHaveProperty('summary');
      
      expect(data.data.alerts.length).toBeGreaterThan(0);
      expect(data.data.summary).toHaveProperty('critical');
      expect(data.data.summary).toHaveProperty('high');
      
      // Should have critical alerts for negative growth and high churn
      expect(data.data.summary.critical).toBeGreaterThan(0);
    });
  });
});

describe('API Error Handling', () => {
  test('should handle analytics service errors', async () => {
    const mockRevenueCalculator = require('@/lib/analytics/revenue-calculator').default;
    mockRevenueCalculator.calculateRevenueMetrics.mockRejectedValue(
      new Error('Database connection failed')
    );

    const request = new NextRequest('http://localhost:3000/api/analytics/revenue');
    const response = await revenueGET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Internal Server Error');
  });

  test('should handle malformed JSON in POST requests', async () => {
    const request = new NextRequest('http://localhost:3000/api/analytics/revenue', {
      method: 'POST',
      body: 'invalid json',
    });

    const response = await revenuePOST(request);
    expect(response.status).toBe(500);
  });
});

describe('API Performance', () => {
  test('should complete revenue analytics requests within reasonable time', async () => {
    const mockRevenueCalculator = require('@/lib/analytics/revenue-calculator').default;
    
    // Simulate slow database response
    mockRevenueCalculator.calculateRevenueMetrics.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({
        current: { mrr: 31780, arr: 381360, customers: 125 },
        previous: { mrr: 28000, arr: 336000, customers: 120 },
        growth: { mrrGrowthRate: 13.5 },
      }), 100))
    );

    mockRevenueCalculator.calculateRevenueAttribution.mockResolvedValue({
      newRevenue: 5000,
      expansionRevenue: 1200,
      contractionRevenue: 800,
      churnedRevenue: 1620,
      netNewRevenue: 3780,
    });

    const startTime = Date.now();
    const request = new NextRequest('http://localhost:3000/api/analytics/revenue?period=current');
    const response = await revenueGET(request);
    const endTime = Date.now();

    expect(response.status).toBe(200);
    expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
  });
});