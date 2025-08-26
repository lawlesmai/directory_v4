import { test, expect } from '@playwright/test';

test.describe('User Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to signup page
    await page.goto('/signup');
  });

  test('Complete basic user onboarding', async ({ page }) => {
    // Fill out signup form
    await page.fill('input[name="email"]', `test_${Date.now()}@example.com`);
    await page.fill('input[name="password"]', 'SecurePassword123!');
    await page.click('button[type="submit"]');

    // Wait for email verification page
    await expect(page.locator('text=Verify Your Email')).toBeVisible();

    // Simulate email verification (in a real test, you'd interact with email service)
    await page.click('button[name="verify-email"]');

    // Complete profile step
    await page.fill('input[name="firstName"]', 'Test');
    await page.fill('input[name="lastName"]', 'User');
    await page.click('button[name="continue"]');

    // Verify onboarding completion
    await expect(page.locator('text=Welcome to Platform')).toBeVisible();
  });

  test('Business owner onboarding flow', async ({ page }) => {
    // Navigate to business signup
    await page.goto('/signup/business');

    // Fill out business details
    await page.fill('input[name="businessName"]', 'Test Business');
    await page.fill('input[name="email"]', `business_${Date.now()}@example.com`);
    await page.click('button[name="continue"]');

    // Upload business documents
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles('./test-files/business-document.pdf');

    // Complete verification
    await page.click('button[name="submit-verification"]');

    // Verify business profile creation
    await expect(page.locator('text=Business Profile Created')).toBeVisible();
  });

  test('Email verification resend functionality', async ({ page }) => {
    // Trigger signup
    await page.fill('input[name="email"]', `resend_${Date.now()}@example.com`);
    await page.click('button[type="submit"]');

    // Wait for email verification page
    await expect(page.locator('text=Verify Your Email')).toBeVisible();

    // Resend verification email
    await page.click('button[name="resend-verification"]');

    // Verify resend confirmation
    await expect(page.locator('text=Verification Email Resent')).toBeVisible();
  });

  test('Onboarding error handling', async ({ page }) => {
    // Attempt signup with invalid email
    await page.fill('input[name="email"]', 'invalid-email');
    await page.click('button[type="submit"]');

    // Verify error message
    await expect(page.locator('text=Invalid Email Format')).toBeVisible();
  });
});
