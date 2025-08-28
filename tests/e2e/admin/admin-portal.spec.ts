import { test, expect } from '@playwright/test';
import { AdminLoginPage } from '../pages/admin-login.page';
import { AdminDashboardPage } from '../pages/admin-dashboard.page';
import { UserManagementPage } from '../pages/user-management.page';
import { SecuritySettingsPage } from '../pages/security-settings.page';
import { AuditLogPage } from '../pages/audit-log.page';

test.describe('Admin Portal Foundation', () => {
  let adminLoginPage: AdminLoginPage;
  let adminDashboardPage: AdminDashboardPage;
  let userManagementPage: UserManagementPage;
  let securitySettingsPage: SecuritySettingsPage;
  let auditLogPage: AuditLogPage;

  test.beforeEach(async ({ page }) => {
    adminLoginPage = new AdminLoginPage(page);
    adminDashboardPage = new AdminDashboardPage(page);
    userManagementPage = new UserManagementPage(page);
    securitySettingsPage = new SecuritySettingsPage(page);
    auditLogPage = new AuditLogPage(page);

    await page.goto('/admin/login');
  });

  // Admin Login Flow Tests
  test.describe('Login Flow', () => {
    test('Successful MFA Login', async () => {
      await adminLoginPage.login('admin@company.com', 'validPassword');
      await adminLoginPage.completeMFA('123456');
      expect(await adminDashboardPage.isVisible()).toBeTruthy();
    });

    test('Invalid Credentials', async () => {
      await adminLoginPage.login('invalid@email.com', 'wrongPassword');
      expect(await adminLoginPage.getErrorMessage()).toContain('Invalid credentials');
    });

    test('MFA Lockout', async () => {
      await adminLoginPage.login('admin@company.com', 'validPassword');
      for (let i = 0; i < 5; i++) {
        await adminLoginPage.completeMFA('incorrectCode');
      }
      expect(await adminLoginPage.getMFALockoutMessage()).toContain('Account temporarily locked');
    });
  });

  // Dashboard Layout Tests
  test.describe('Dashboard Layout', () => {
    test('Navigation Accessibility', async () => {
      await adminLoginPage.login('admin@company.com', 'validPassword');
      await adminLoginPage.completeMFA('123456');
      
      const navItems = await adminDashboardPage.getNavigationItems();
      for (const item of navItems) {
        expect(item.ariaLabel).toBeTruthy();
        expect(item.isKeyboardAccessible).toBeTruthy();
      }
    });

    test('Responsive Design', async ({ page }) => {
      const viewports = [
        { width: 375, height: 812 },   // Mobile
        { width: 1024, height: 768 },  // Tablet
        { width: 1920, height: 1080 }  // Desktop
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await adminLoginPage.login('admin@company.com', 'validPassword');
        await adminLoginPage.completeMFA('123456');

        expect(await adminDashboardPage.isResponsive()).toBeTruthy();
      }
    });
  });

  // User Management Tests
  test.describe('User Management', () => {
    test('Create User with Different Roles', async () => {
      await adminLoginPage.login('admin@company.com', 'validPassword');
      await adminLoginPage.completeMFA('123456');
      
      const roles = ['Admin', 'Editor', 'Viewer'];
      for (const role of roles) {
        const newUser = await userManagementPage.createUser({
          email: `test-${role.toLowerCase()}@company.com`,
          role: role
        });
        expect(newUser.role).toBe(role);
      }
    });

    test('Role-Based Access Control', async () => {
      const testScenarios = [
        { role: 'Admin', expectedAccess: ['UserManagement', 'SecuritySettings', 'AuditLog'] },
        { role: 'Editor', expectedAccess: ['UserManagement'] },
        { role: 'Viewer', expectedAccess: [] }
      ];

      for (const scenario of testScenarios) {
        await adminLoginPage.login(`${scenario.role.toLowerCase()}@company.com`, 'validPassword');
        await adminLoginPage.completeMFA('123456');

        for (const feature of ['UserManagement', 'SecuritySettings', 'AuditLog']) {
          const hasAccess = await adminDashboardPage.hasFeatureAccess(feature);
          const expectedResult = scenario.expectedAccess.includes(feature);
          expect(hasAccess).toBe(expectedResult);
        }
      }
    });
  });

  // Security Settings Tests
  test.describe('Security Settings', () => {
    test('IP Whitelisting Configuration', async () => {
      await adminLoginPage.login('admin@company.com', 'validPassword');
      await adminLoginPage.completeMFA('123456');
      
      const ipAddresses = ['192.168.1.100', '10.0.0.1', '172.16.0.1'];
      await securitySettingsPage.configureIPWhitelist(ipAddresses);
      
      const currentWhitelist = await securitySettingsPage.getWhitelistedIPs();
      expect(currentWhitelist).toEqual(expect.arrayContaining(ipAddresses));
    });

    test('MFA Configuration', async () => {
      await adminLoginPage.login('admin@company.com', 'validPassword');
      await adminLoginPage.completeMFA('123456');
      
      const mfaMethods = ['SMS', 'Authenticator App', 'Email'];
      for (const method of mfaMethods) {
        await securitySettingsPage.configureMFAMethod(method);
        expect(await securitySettingsPage.isMFAMethodEnabled(method)).toBeTruthy();
      }
    });
  });

  // Session Management Tests
  test.describe('Session Management', () => {
    test('Active Session Monitoring', async () => {
      await adminLoginPage.login('admin@company.com', 'validPassword');
      await adminLoginPage.completeMFA('123456');
      
      const activeSessions = await adminDashboardPage.getActiveSessions();
      expect(activeSessions.length).toBeGreaterThan(0);
      
      for (const session of activeSessions) {
        expect(session).toHaveProperty('ipAddress');
        expect(session).toHaveProperty('loginTime');
        expect(session).toHaveProperty('browser');
      }
    });

    test('Session Termination', async () => {
      await adminLoginPage.login('admin@company.com', 'validPassword');
      await adminLoginPage.completeMFA('123456');
      
      const activeSessions = await adminDashboardPage.getActiveSessions();
      const sessionToTerminate = activeSessions[0];
      
      await adminDashboardPage.terminateSession(sessionToTerminate.id);
      const updatedSessions = await adminDashboardPage.getActiveSessions();
      
      expect(updatedSessions).not.toContain(sessionToTerminate);
    });
  });

  // Audit Log Tests
  test.describe('Audit Log', () => {
    test('Log Entry Filtering', async () => {
      await adminLoginPage.login('admin@company.com', 'validPassword');
      await adminLoginPage.completeMFA('123456');
      
      const filterOptions = [
        { type: 'User Management', action: 'User Created' },
        { type: 'Security', action: 'MFA Configuration Changed' },
        { type: 'Session', action: 'Session Terminated' }
      ];

      for (const filter of filterOptions) {
        const filteredLogs = await auditLogPage.filterLogs(filter);
        expect(filteredLogs.length).toBeGreaterThan(0);
        
        for (const log of filteredLogs) {
          expect(log.type).toBe(filter.type);
          expect(log.action).toBe(filter.action);
        }
      }
    });

    test('Log Export Functionality', async () => {
      await adminLoginPage.login('admin@company.com', 'validPassword');
      await adminLoginPage.completeMFA('123456');
      
      const exportFormats = ['CSV', 'JSON', 'PDF'];
      for (const format of exportFormats) {
        const exportedFile = await auditLogPage.exportLogs(format);
        expect(exportedFile).toBeTruthy();
        expect(exportedFile.extension).toBe(format.toLowerCase());
      }
    });
  });

  // Security Vulnerability Tests
  test.describe('Security Vulnerability Checks', () => {
    test('Authentication Bypass Prevention', async () => {
      const bypassAttempts = [
        '/admin/dashboard',
        '/admin/user-management',
        '/admin/security-settings'
      ];

      for (const route of bypassAttempts) {
        await adminLoginPage.navigateDirectly(route);
        expect(await adminLoginPage.isLoginPageVisible()).toBeTruthy();
      }
    });

    test('Input Sanitization', async () => {
      const maliciousInputs = [
        '<script>alert("XSS")</script>',
        '../../etc/passwd',
        'OR 1=1--'
      ];

      await adminLoginPage.login('admin@company.com', 'validPassword');
      await adminLoginPage.completeMFA('123456');

      for (const input of maliciousInputs) {
        const sanitizationResult = await userManagementPage.testInputSanitization(input);
        expect(sanitizationResult.sanitized).toBeTruthy();
        expect(sanitizationResult.originalInput).not.toContain(input);
      }
    });
  });
});
