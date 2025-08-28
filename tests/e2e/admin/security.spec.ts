import { test, expect } from '@playwright/test';
import { SecurityService } from '../../services/security-service';
import { AdminSecurityPage } from '../pages/admin-security-page';

test.describe('Admin Security Features', () => {
  let securityService: SecurityService;
  let securityPage: AdminSecurityPage;

  test.beforeEach(async ({ page }) => {
    securityService = new SecurityService();
    securityPage = new AdminSecurityPage(page);
  });

  test('Input Validation and Injection Prevention', async () => {
    await test.step('SQL Injection Protection', async () => {
      const sqlInjectionTests = await securityService.testSQLInjectionProtection();
      expect(sqlInjectionTests.vulnerable).toBeFalsy();
    });

    await test.step('XSS Prevention', async () => {
      const xssTests = await securityService.testXSSProtection();
      expect(xssTests.vulnerable).toBeFalsy();
    });
  });

  test('Threat Monitoring and IP Restrictions', async () => {
    await test.step('IP Whitelisting', async () => {
      const ipWhitelistResult = await securityService.testIPWhitelisting();
      expect(ipWhitelistResult.allowed).toBeTruthy();
      expect(ipWhitelistResult.blockedUnauthorized).toBeTruthy();
    });

    await test.step('Suspicious Activity Detection', async () => {
      const suspiciousActivityResult = await securityService.simulateSuspiciousActivity();
      expect(suspiciousActivityResult.detected).toBeTruthy();
      expect(suspiciousActivityResult.incidentRecorded).toBeTruthy();
    });
  });

  test('Audit Logging and Compliance', async () => {
    await test.step('Comprehensive Action Logging', async () => {
      const auditLogResult = await securityPage.performAdminActions();
      expect(auditLogResult.logged.length).toBeGreaterThan(0);
      expect(auditLogResult.compliant).toBeTruthy();
    });
  });
});
