import { test, expect } from '@playwright/test';

test.describe('Authentication User Journeys', () => {
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = 'SecurePassword123!';

  test('Complete Registration Flow', async ({ page, context }) => {
    await page.goto('/register');
    
    // Fill registration form
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.fill('input[name="confirmPassword"]', testPassword);
    
    await page.click('button[type="submit"]');
    
    // Verify email verification step
    await expect(page.getByText(/Verify Your Email/i)).toBeVisible();
    
    // Simulate email verification (mock)
    const verificationToken = await page.evaluate(() => {
      return localStorage.getItem('verification_token');
    });
    
    expect(verificationToken).toBeTruthy();
  });

  test('Login with Multi-Factor Authentication', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    
    // MFA Challenge
    await expect(page.getByText(/Enter Authentication Code/i)).toBeVisible();
    
    // Simulate TOTP code entry
    const totpCode = await page.evaluate(() => {
      return window.generateTOTPCode(); // Assuming a global method
    });
    
    await page.fill('input[name="mfa_code"]', totpCode);
    await page.click('button[type="submit"]');
    
    // Verify successful login
    await expect(page.getByText(/Welcome/i)).toBeVisible();
  });

  test('Password Reset Flow', async ({ page }) => {
    await page.goto('/forgot-password');
    
    await page.fill('input[name="email"]', testEmail);
    await page.click('button[type="submit"]');
    
    // Verify reset instructions
    await expect(page.getByText(/Password Reset Instructions/i)).toBeVisible();
  });
});
