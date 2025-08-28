import { test, expect } from '@playwright/test';
import { APIService } from '../../services/api-service';
import { SecurityService } from '../../services/security-service';
import { PerformanceMonitor } from '../../services/performance-monitor';

test.describe('Admin Portal API Endpoint Validation', () => {
  let apiService: APIService;
  let securityService: SecurityService;
  let performanceMonitor: PerformanceMonitor;

  test.beforeEach(() => {
    apiService = new APIService();
    securityService = new SecurityService();
    performanceMonitor = new PerformanceMonitor();
  });

  test('API Response Formats and Error Handling', async () => {
    await test.step('Consistent Response Structures', async () => {
      const responseFormatTests = await apiService.validateAdminAPIResponseFormats();
      expect(responseFormatTests.consistent).toBeTruthy();
      expect(responseFormatTests.errorResponsesStandardized).toBeTruthy();
    });

    await test.step('Comprehensive Error Scenarios', async () => {
      const errorHandlingResults = await apiService.testErrorScenarios();
      expect(errorHandlingResults.userFriendlyMessages).toBeTruthy();
      expect(errorHandlingResults.appropriateStatusCodes).toBeTruthy();
    });
  });

  test('Security Headers and CORS Configuration', async () => {
    await test.step('Security Header Validation', async () => {
      const securityHeaderResults = await securityService.validateSecurityHeaders();
      expect(securityHeaderResults.allHeadersPresent).toBeTruthy();
      expect(securityHeaderResults.noVulnerableHeaders).toBeTruthy();
    });

    await test.step('CORS Configuration', async () => {
      const corsResults = await securityService.validateCORSConfiguration();
      expect(corsResults.configured).toBeTruthy();
      expect(corsResults.restrictedOrigins).toBeTruthy();
    });
  });

  test('API Performance Benchmarks', async () => {
    await test.step('Response Time Validation', async () => {
      const performanceResults = await performanceMonitor.measureAdminAPIPerformance();
      expect(performanceResults.averageResponseTime).toBeLessThan(200); // ms
      expect(performanceResults.p95ResponseTime).toBeLessThan(500); // ms
      expect(performanceResults.errorRate).toBeLessThan(0.01); // 1%
    });
  });
});
