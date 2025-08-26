import { test, expect } from '@playwright/test';
import { generateTestUser } from '../../utils/test-helpers';

test.describe('User Profile Management E2E', () => {
  let testUser;

  test.beforeEach(async ({ page }) => {
    testUser = generateTestUser();
    await page.goto('/auth/signup');
    
    // Complete signup process
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');
    
    // Wait for profile setup page
    await page.waitForSelector('form[data-testid="profile-setup"]');
  });

  test('Complete Profile Setup Flow', async ({ page }) => {
    // Fill out profile details
    await page.fill('input[name="firstName"]', testUser.firstName);
    await page.fill('input[name="lastName"]', testUser.lastName);
    await page.fill('input[name="businessName"]', testUser.businessName);
    
    // Upload avatar
    const fileInput = await page.locator('input[type="file"][data-testid="avatar-upload"]');
    await fileInput.setInputFiles('./test-assets/test-avatar.png');
    
    // Submit profile
    await page.click('button[data-testid="submit-profile"]');
    
    // Verify profile completion
    await page.waitForSelector('div[data-testid="profile-complete"]');
    const completionScore = await page.textContent('span[data-testid="profile-completion-score"]');
    expect(parseInt(completionScore)).toBeGreaterThan(80);
  });

  test('Profile Privacy Controls', async ({ page }) => {
    // Navigate to privacy settings
    await page.goto('/profile/settings/privacy');
    
    // Toggle privacy settings
    const publicProfileToggle = await page.locator('input[data-testid="public-profile-toggle"]');
    await publicProfileToggle.click();
    
    // Verify setting persistence
    await page.reload();
    const isPublicProfileDisabled = await page.isChecked('input[data-testid="public-profile-toggle"]');
    expect(isPublicProfileDisabled).toBe(false);
  });

  test('Social Profile Synchronization', async ({ page }) => {
    // Trigger social login sync
    await page.goto('/profile/social-sync');
    await page.click('button[data-testid="sync-linkedin"]');
    
    // Mock social login flow
    await page.fill('input[name="social-email"]', testUser.email);
    await page.click('button[type="submit"]');
    
    // Verify sync success
    await page.waitForSelector('div[data-testid="social-sync-success"]');
    const syncedProfiles = await page.textContent('ul[data-testid="synced-profiles"]');
    expect(syncedProfiles).toContain('LinkedIn');
  });

  test('Business Owner Profile Verification', async ({ page }) => {
    // Navigate to business verification
    await page.goto('/profile/business-verification');
    
    // Upload business documents
    const documentInput = await page.locator('input[type="file"][data-testid="business-doc-upload"]');
    await documentInput.setInputFiles('./test-assets/business-license.pdf');
    
    // Fill verification details
    await page.fill('input[name="businessTaxId"]', testUser.taxId);
    await page.click('button[data-testid="submit-verification"]');
    
    // Verify verification status
    await page.waitForSelector('div[data-testid="verification-pending"]');
    const verificationStatus = await page.textContent('span[data-testid="verification-status"]');
    expect(verificationStatus).toBe('Pending Review');
  });
});
