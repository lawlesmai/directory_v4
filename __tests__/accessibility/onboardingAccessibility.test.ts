import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Onboarding Accessibility Tests', () => {
  test('Signup page accessibility', async ({ page }) => {
    await page.goto('/signup');
    
    // Inject Axe accessibility testing library
    await injectAxe(page);
    
    // Run accessibility checks
    const results = await checkA11y(page);
    
    // Log violations for debugging
    if (results.violations.length > 0) {
      console.log('Accessibility Violations:');
      results.violations.forEach(violation => {
        console.log(`- ${violation.description}`);
      });
    }

    // Expect no critical accessibility issues
    expect(results.violations.filter(v => v.impact === 'critical').length).toBe(0);
  });

  test('Keyboard navigation in onboarding flow', async ({ page }) => {
    await page.goto('/signup');

    // Test tabbing through form elements
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');
    const submitButton = page.locator('button[type="submit"]');

    await emailInput.focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement === document.querySelector('input[name="password"]'))).toBeTruthy();

    await passwordInput.focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement === document.querySelector('button[type="submit"]'))).toBeTruthy();
  });

  test('Screen reader compatibility', async ({ page }) => {
    await page.goto('/signup');

    // Check for proper ARIA labels and semantic HTML
    const formHeading = page.locator('h1[role="heading"]');
    expect(await formHeading.getAttribute('aria-level')).toBe('1');

    const emailLabel = page.locator('label[for="email"]');
    expect(await emailLabel.textContent()).toBeTruthy();

    const inputs = page.locator('input[aria-required="true"]');
    const requiredInputs = await inputs.count();
    expect(requiredInputs).toBeGreaterThan(0);
  });
});
