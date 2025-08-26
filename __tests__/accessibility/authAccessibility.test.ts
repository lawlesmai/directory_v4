import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Authentication Accessibility', () => {
  test('Login page meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/login');
    await injectAxe(page);
    
    const results = await checkA11y(page, {
      rules: {
        'color-contrast': { enabled: true },
        'landmark-one-main': { enabled: true },
        'page-has-heading-one': { enabled: true }
      }
    });

    expect(results.violations.length).toBe(0);
  });

  test('Registration page keyboard navigation', async ({ page }) => {
    await page.goto('/register');
    
    const inputs = [
      'input[name="email"]',
      'input[name="password"]',
      'input[name="confirmPassword"]',
      'button[type="submit"]'
    ];

    for (const selector of inputs) {
      const element = await page.;
      await element?.focus();
      
      expect(await page.evaluate((el) => document.activeElement === el, element))
        .toBeTruthy();
    }
  });

  test('Password reset form aria attributes', async ({ page }) => {
    await page.goto('/forgot-password');
    
    const emailInput = await page.;
    const submitButton = await page.;

    expect(await emailInput?.getAttribute('aria-label')).toBeTruthy();
    expect(await submitButton?.getAttribute('aria-label')).toBeTruthy();
  });
});
