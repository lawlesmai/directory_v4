const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright');

test.describe('Profile Management Accessibility', () => {
  test('Profile Setup Page Accessibility', async ({ page }) => {
    await page.goto('/profile/setup');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .exclude('.optional-section') // Exclude any optional sections if needed
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Privacy Settings Accessibility', async ({ page }) => {
    await page.goto('/profile/settings/privacy');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Keyboard Navigation in Profile Management', async ({ page }) => {
    await page.goto('/profile/settings');
    
    // Test keyboard navigation through form elements
    const formElements = await page.$$('input, button, select');
    
    for (const element of formElements) {
      await element.focus();
      const isFocused = await page.evaluate(el => document.activeElement === el, element);
      expect(isFocused).toBe(true);
    }
  });

  test('Screen Reader Compatibility', async ({ page }) => {
    await page.goto('/profile/setup');
    
    // Check for proper aria labels and semantic HTML
    const ariaElementsCount = await page.evaluate(() => {
      return document.querySelectorAll('[aria-label], [aria-describedby]').length;
    });
    
    expect(ariaElementsCount).toBeGreaterThan(5);
  });

  test('Color Contrast Compliance', async ({ page }) => {
    await page.goto('/profile/settings');
    
    const contrastViolations = await page.evaluate(() => {
      const contrastChecker = (element) => {
        const style = window.getComputedStyle(element);
        const backgroundColor = style.backgroundColor;
        const color = style.color;
        
        // Basic contrast ratio calculation (simplified)
        const luminance = (color) => {
          const rgb = color.match(/\d+/g).map(Number);
          return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
        };
        
        const bgLuminance = luminance(backgroundColor);
        const textLuminance = luminance(color);
        
        return Math.abs(bgLuminance - textLuminance) < 0.5;
      };
      
      return Array.from(document.querySelectorAll('*'))
        .filter(el => !contrastChecker(el))
        .map(el => el.tagName);
    });
    
    expect(contrastViolations.length).toBe(0);
  });
});
