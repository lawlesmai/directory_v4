import { test, expect } from '@playwright/test';

test.describe('Onboarding Performance Tests', () => {
  test('Signup page load time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/signup');
    const loadTime = Date.now() - startTime;

    // Performance budget: page should load in under 2 seconds
    expect(loadTime).toBeLessThan(2000);
  });

  test('Email verification token generation performance', async () => {
    const { EmailVerificationService } = await import('../../../utils/auth');
    
    const startTime = Date.now();
    const token = EmailVerificationService.generateVerificationToken('test@example.com');
    const generationTime = Date.now() - startTime;

    // Token generation should be fast (under 50ms)
    expect(generationTime).toBeLessThan(50);
    expect(token).toBeDefined();
  });

  test('Onboarding form submission performance', async ({ page }) => {
    await page.goto('/signup');

    const startTime = Date.now();
    await page.fill('input[name="email"]', `test_${Date.now()}@example.com`);
    await page.fill('input[name="password"]', 'SecurePassword123!');
    await page.click('button[type="submit"]');

    // Wait for navigation or success message
    await page.waitForSelector('text=Verify Your Email');
    
    const submissionTime = Date.now() - startTime;

    // Form submission should complete in under 3 seconds
    expect(submissionTime).toBeLessThan(3000);
  });
});
