import { test, expect } from '@playwright/test';
import { AdminAuthPage } from '../pages/admin-auth-page';
import { SecurityService } from '../../services/security-service';

test.describe('Admin Authentication System', () => {
  let authPage: AdminAuthPage;
  let securityService: SecurityService;

  test.beforeEach(async ({ page }) => {
    authPage = new AdminAuthPage(page);
    securityService = new SecurityService();
  });

  test('Login Flow with Rate Limiting', async ({ page }) => {
    // Test successful login
    await test.step('Successful Login', async () => {
      const result = await authPage.loginWithValidCredentials();
      expect(result.success).toBeTruthy();
      expect(result.token).toBeDefined();
    });

    // Test rate limiting
    await test.step('Rate Limiting Protection', async () => {
      const rateLimitResult = await securityService.testRateLimiting(authPage);
      expect(rateLimitResult.blocked).toBeTruthy();
      expect(rateLimitResult.blockDuration).toBeGreaterThan(0);
    });
  });

  test('Multi-Factor Authentication', async ({ page }) => {
    await test.step('TOTP Setup and Validation', async () => {
      const totpSetup = await authPage.setupTOTP();
      expect(totpSetup.configured).toBeTruthy();
      
      const totpVerification = await authPage.verifyTOTP(totpSetup.secret);
      expect(totpVerification.verified).toBeTruthy();
    });

    await test.step('Backup Code Recovery', async () => {
      const backupCodeRecovery = await authPage.testBackupCodeRecovery();
      expect(backupCodeRecovery.recovered).toBeTruthy();
    });
  });

  test('Session Management', async ({ page }) => {
    await test.step('Session Creation and Extension', async () => {
      const sessionData = await authPage.createAndExtendSession();
      expect(sessionData.initial).toBeDefined();
      expect(sessionData.extended).toBeDefined();
      expect(sessionData.extended.expiresAt).toBeGreaterThan(sessionData.initial.expiresAt);
    });

    await test.step('Secure Logout', async () => {
      const logoutResult = await authPage.secureLogout();
      expect(logoutResult.loggedOut).toBeTruthy();
      expect(logoutResult.sessionTerminated).toBeTruthy();
    });
  });
});
