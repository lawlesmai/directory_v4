import { test, expect } from '@playwright/test';

test('homepage loads successfully', async ({ page }) => {
  await page.goto('/');
  
  // Basic content checks
  const pageTitle = await page.title();
  expect(pageTitle).toContain('Lawless Directory');
  
  // Check for key design system elements
  const bodyClass = await page.locator('body').getAttribute('class');
  const htmlClass = await page.locator('html').getAttribute('class');

  expect(bodyClass).toContain('font-body');
  expect(htmlClass).toMatch(/__variable_/);
});
