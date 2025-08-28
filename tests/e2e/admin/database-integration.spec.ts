import { test, expect } from '@playwright/test';
import { DatabaseService } from '../../services/database-service';
import { PerformanceMonitor } from '../../services/performance-monitor';

test.describe('Admin Database Integration', () => {
  let dbService: DatabaseService;
  let performanceMonitor: PerformanceMonitor;

  test.beforeEach(() => {
    dbService = new DatabaseService();
    performanceMonitor = new PerformanceMonitor();
  });

  test('RPC Function Validation', async () => {
    await test.step('Test Admin RPC Functions', async () => {
      const rpcTestResults = await dbService.testAdminRPCFunctions();
      expect(rpcTestResults.allPassed).toBeTruthy();
      expect(rpcTestResults.failedFunctions.length).toBe(0);
    });
  });

  test('Database Performance and Error Handling', async () => {
    await test.step('Query Performance Optimization', async () => {
      const performanceResults = await performanceMonitor.measureDatabaseQueries();
      expect(performanceResults.averageResponseTime).toBeLessThan(100); // ms
      expect(performanceResults.slowQueries.length).toBe(0);
    });

    await test.step('Graceful Error Handling', async () => {
      const errorHandlingTests = await dbService.testErrorScenarios();
      expect(errorHandlingTests.gracefulFailure).toBeTruthy();
      expect(errorHandlingTests.userFriendlyMessages).toBeTruthy();
    });
  });

  test('Session Management Database Interactions', async () => {
    await test.step('Automated Session Cleanup', async () => {
      const sessionCleanupResults = await dbService.testSessionCleanup();
      expect(sessionCleanupResults.expiredSessionsRemoved).toBeTruthy();
      expect(sessionCleanupResults.activeSessionsPreserved).toBeTruthy();
    });
  });
});
