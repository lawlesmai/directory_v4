import { test, expect } from '@playwright/test';

test.describe('Interactive Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3001');
  });

  test('Search Functionality', async ({ page }) => {
    const searchInput = page.getByTestId('search-input');
    const clearButton = page.getByTestId('clear-button');
    const suggestions = page.getByTestId('search-suggestions');

    // Test basic search
    await searchInput.fill('Tech');
    await expect(suggestions).toBeVisible();
    await expect(suggestions.getByRole('option')).toHaveCount(3); // Assuming 3 suggestions

    // Test keyboard navigation
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(searchInput.inputValue()).toContain('Suggestion');

    // Test clear functionality
    await expect(clearButton).toBeVisible();
    await clearButton.click();
    await expect(searchInput.inputValue()).toBe('');
  });

  test('Keyboard Shortcuts', async ({ page }) => {
    // Test Cmd/Ctrl+K to focus search
    await page.keyboard.press('Meta+K'); // macOS
    const searchInput = page.getByTestId('search-input');
    await expect(searchInput).toBeFocused();

    // Test Escape to clear/blur
    await page.keyboard.press('Escape');
    await expect(searchInput).not.toBeFocused();
  });

  test('Filter System', async ({ page }) => {
    const filtersToggle = page.getByTestId('filters-toggle');
    await filtersToggle.click();

    // Check for smooth transitions and animation
    await expect(filtersToggle).toHaveClass(/bg-blue-100/);
    await expect(page.getByTestId('advanced-filters')).toBeVisible();
  });

  test('Business Card Interactions', async ({ page }) => {
    const businessCards = page.getByTestId('business-card');
    
    // Check hover effects
    await businessCards.first().hover();
    await expect(businessCards.first()).toHaveClass(/hover:scale-105/);

    // Check modal system
    await businessCards.first().click();
    const modal = page.getByTestId('business-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveClass(/backdrop-blur/);
  });

  test('Performance and Optimization', async ({ page }) => {
    // Measure page load time
    const loadTime = await page.evaluate(() => {
      return performance.now();
    });
    await expect(loadTime).toBeLessThan(2000); // Load under 2 seconds

    // Check for smooth animations
    const cards = page.getByTestId('business-card');
    await cards.first().waitFor({ state: 'visible' });
    
    const animationPerformance = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="business-card"]');
      return card ? window.getComputedStyle(card).transition : null;
    });
    
    expect(animationPerformance).toContain('transform');
  });
});
