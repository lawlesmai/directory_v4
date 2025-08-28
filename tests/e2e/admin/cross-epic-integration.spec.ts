import { test, expect } from '@playwright/test';
import { IntegrationService } from '../../services/integration-service';

test.describe('Cross-Epic Integration Validation', () => {
  let integrationService: IntegrationService;

  test.beforeEach(() => {
    integrationService = new IntegrationService();
  });

  test('Epic 1 Business Directory Management', async () => {
    await test.step('Admin Business Oversight', async () => {
      const businessManagementResults = await integrationService.testBusinessDirectoryAdminControls();
      expect(businessManagementResults.verified).toBeTruthy();
      expect(businessManagementResults.adminActionsLogged).toBeTruthy();
    });
  });

  test('Epic 2 RBAC Integration', async () => {
    await test.step('Permission Synchronization', async () => {
      const rbacIntegrationResults = await integrationService.validateRBACIntegration();
      expect(rbacIntegrationResults.permissionsSynchronized).toBeTruthy();
      expect(rbacIntegrationResults.noPermissionConflicts).toBeTruthy();
    });
  });

  test('Epic 3 Business Verification Workflows', async () => {
    await test.step('Verification Process Management', async () => {
      const verificationWorkflowResults = await integrationService.testBusinessVerificationAdminWorkflows();
      expect(verificationWorkflowResults.adminCanManageVerifications).toBeTruthy();
      expect(verificationWorkflowResults.subscriptionManagementIntegrated).toBeTruthy();
    });
  });
});
