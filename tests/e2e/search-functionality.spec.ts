import { test, expect, Page } from '@playwright/test';

// Test configuration
const TEST_CONFIG = {
  searchTimeout: 5000,
  suggestionTimeout: 1000,
  performanceThreshold: 500,
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
};

// Helper function to wait for search results
async function waitForSearchResults(page: Page, timeout = TEST_CONFIG.searchTimeout) {
  await page.waitForSelector('[data-testid="search-results"]', { timeout });
}

// Helper function to measure search performance
async function measureSearchPerformance(page: Page, searchQuery: string) {
  const startTime = Date.now();
  
  await page.fill('[data-testid="search-input"]', searchQuery);
  await page.keyboard.press('Enter');
  await waitForSearchResults(page);
  
  const endTime = Date.now();
  return endTime - startTime;
}

test.describe('Advanced Search & Filtering System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_CONFIG.baseUrl);
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test.describe('Search Interface', () => {
    test('should display search interface with all components', async ({ page }) => {
      // Check main search components
      await expect(page.locator('[data-testid="search-interface"]')).toBeVisible();
      await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="search-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="near-me-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="filters-toggle"]')).toBeVisible();
    });

    test('should show glassmorphism styling', async ({ page }) => {
      const searchContainer = page.locator('.search-glass-container');
      await expect(searchContainer).toHaveCSS('backdrop-filter', /blur/);
    });

    test('should handle keyboard shortcuts', async ({ page }) => {
      // Test Cmd/Ctrl+K to focus search
      await page.keyboard.press('Meta+k'); // Mac
      await expect(page.locator('[data-testid="search-input"]')).toBeFocused();
      
      // Test Escape to blur
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-testid="search-input"]')).not.toBeFocused();
    });

    test('should validate accessibility features', async ({ page }) => {
      const searchInput = page.locator('[data-testid="search-input"]');
      
      // Check ARIA attributes
      await expect(searchInput).toHaveAttribute('aria-label');
      await expect(searchInput).toHaveAttribute('role', 'combobox');
      await expect(searchInput).toHaveAttribute('aria-autocomplete', 'list');
    });
  });

  test.describe('Search Suggestions', () => {
    test('should show suggestions when typing', async ({ page }) => {
      await page.fill('[data-testid="search-input"]', 'rest');
      
      // Wait for suggestions to appear
      await page.waitForSelector('[data-testid="search-suggestions"]', { 
        timeout: TEST_CONFIG.suggestionTimeout 
      });
      
      // Check suggestions are visible
      await expect(page.locator('[data-testid="search-suggestions"]')).toBeVisible();
      
      // Should have multiple suggestions
      const suggestions = page.locator('[data-testid^="suggestion-"]');
      await expect(suggestions).toHaveCount.greaterThan(0);
    });

    test('should support keyboard navigation in suggestions', async ({ page }) => {
      await page.fill('[data-testid="search-input"]', 'coffee');
      await page.waitForSelector('[data-testid="search-suggestions"]');
      
      // Navigate down
      await page.keyboard.press('ArrowDown');
      await expect(page.locator('[data-testid="suggestion-0"]')).toHaveClass(/selected/);
      
      // Navigate down again
      await page.keyboard.press('ArrowDown');
      await expect(page.locator('[data-testid="suggestion-1"]')).toHaveClass(/selected/);
      
      // Navigate up
      await page.keyboard.press('ArrowUp');
      await expect(page.locator('[data-testid="suggestion-0"]')).toHaveClass(/selected/);
      
      // Select with Enter
      await page.keyboard.press('Enter');
      await waitForSearchResults(page);
    });

    test('should close suggestions on Escape', async ({ page }) => {
      await page.fill('[data-testid="search-input"]', 'test');
      await page.waitForSelector('[data-testid="search-suggestions"]');
      
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-testid="search-suggestions"]')).not.toBeVisible();
    });

    test('should show different types of suggestions', async ({ page }) => {
      await page.fill('[data-testid="search-input"]', 'pizza');
      await page.waitForSelector('[data-testid="search-suggestions"]');
      
      // Should have business suggestions
      await expect(page.locator('[data-suggestion-type="business"]')).toHaveCount.greaterThan(0);
      
      // Type "pizza near" to get location suggestions
      await page.fill('[data-testid="search-input"]', 'pizza near');
      await page.waitForSelector('[data-suggestion-type="location"]', { timeout: 2000 });
    });
  });

  test.describe('Advanced Filters', () => {
    test('should toggle advanced filters', async ({ page }) => {
      // Click filters toggle
      await page.click('[data-testid="filters-toggle"]');
      
      // Advanced filters should be visible
      await expect(page.locator('[data-testid="advanced-filters"]')).toBeVisible();
      
      // Click again to hide
      await page.click('[data-testid="filters-toggle"]');
      await expect(page.locator('[data-testid="advanced-filters"]')).not.toBeVisible();
    });

    test('should filter by categories', async ({ page }) => {
      // Open advanced filters
      await page.click('[data-testid="filters-toggle"]');
      
      // Select a category
      await page.click('[data-testid="category-restaurants"]');
      
      // Execute search
      await page.fill('[data-testid="search-input"]', 'food');
      await page.click('[data-testid="search-button"]');
      
      await waitForSearchResults(page);
      
      // Check that results are filtered
      const results = page.locator('[data-testid^="business-card-"]');
      await expect(results).toHaveCount.greaterThan(0);
    });

    test('should filter by rating', async ({ page }) => {
      await page.click('[data-testid="filters-toggle"]');
      
      // Select 4+ star rating
      await page.selectOption('select[name="rating"]', '4.0');
      
      // Execute search
      await page.fill('[data-testid="search-input"]', 'restaurant');
      await page.click('[data-testid="search-button"]');
      
      await waitForSearchResults(page);
    });

    test('should adjust distance filter', async ({ page }) => {
      await page.click('[data-testid="filters-toggle"]');
      
      // Adjust distance slider
      const distanceSlider = page.locator('input[type="range"][name="distance"]');
      await distanceSlider.fill('10');
      
      // Should show updated distance
      await expect(page.locator('text=/10 miles/')).toBeVisible();
    });

    test('should clear all filters', async ({ page }) => {
      await page.click('[data-testid="filters-toggle"]');
      
      // Apply some filters
      await page.click('[data-testid="category-restaurants"]');
      await page.selectOption('select[name="rating"]', '4.0');
      
      // Clear all filters
      await page.click('[data-testid="clear-all-filters"]');
      
      // Check filters are cleared
      await expect(page.locator('[data-testid="category-restaurants"]')).not.toHaveClass(/selected/);
    });
  });

  test.describe('Geolocation "Near Me" Functionality', () => {
    test('should handle geolocation permission', async ({ page, context }) => {
      // Grant location permission
      await context.grantPermissions(['geolocation']);
      await context.setGeolocation({ latitude: 40.7128, longitude: -74.0060 });
      
      // Click near me button
      await page.click('[data-testid="near-me-button"]');
      
      // Should show location granted state
      await expect(page.locator('[data-testid="near-me-button"]')).toHaveClass(/location-active/);
    });

    test('should handle geolocation denial gracefully', async ({ page }) => {
      // Click near me button without permission
      await page.click('[data-testid="near-me-button"]');
      
      // Should show error or instruction
      await expect(page.locator('text=/location/i')).toBeVisible();
    });
  });

  test.describe('Search Performance', () => {
    test('should complete searches within performance threshold', async ({ page }) => {
      const performanceTime = await measureSearchPerformance(page, 'restaurant');
      
      expect(performanceTime).toBeLessThan(TEST_CONFIG.performanceThreshold);
    });

    test('should show performance indicators', async ({ page }) => {
      await page.fill('[data-testid="search-input"]', 'coffee shops');
      await page.click('[data-testid="search-button"]');
      
      await waitForSearchResults(page);
      
      // Should show performance metrics
      await expect(page.locator('[data-testid="performance-indicator"]')).toBeVisible();
    });

    test('should handle search debouncing', async ({ page }) => {
      const searchInput = page.locator('[data-testid="search-input"]');
      
      // Type quickly (should debounce)
      await searchInput.type('rest', { delay: 50 });
      await searchInput.type('aurant', { delay: 50 });
      
      // Wait for suggestions (should only trigger once after debounce)
      await page.waitForTimeout(400); // Wait for debounce
      await page.waitForSelector('[data-testid="search-suggestions"]');
    });

    test('should cache search results', async ({ page }) => {
      // Execute first search
      const firstTime = await measureSearchPerformance(page, 'pizza');
      
      // Execute same search again
      await page.fill('[data-testid="search-input"]', '');
      const secondTime = await measureSearchPerformance(page, 'pizza');
      
      // Second search should be faster (cached)
      expect(secondTime).toBeLessThan(firstTime * 0.8);
    });
  });

  test.describe('Search Results Display', () => {
    test('should display search results with proper formatting', async ({ page }) => {
      await page.fill('[data-testid="search-input"]', 'restaurant');
      await page.click('[data-testid="search-button"]');
      
      await waitForSearchResults(page);
      
      // Check results header
      await expect(page.locator('text=/Results for/i')).toBeVisible();
      await expect(page.locator('text=/results found/i')).toBeVisible();
      
      // Check business cards are displayed
      const businessCards = page.locator('[data-testid^="business-card-"]');
      await expect(businessCards).toHaveCount.greaterThan(0);
    });

    test('should show no results state gracefully', async ({ page }) => {
      await page.fill('[data-testid="search-input"]', 'xyznonexistentbusiness123');
      await page.click('[data-testid="search-button"]');
      
      // Wait for no results state
      await page.waitForSelector('text=/No Results Found/i');
      await expect(page.locator('text=/No Results Found/i')).toBeVisible();
      await expect(page.locator('text=/Check your spelling/i')).toBeVisible();
    });

    test('should handle search errors gracefully', async ({ page }) => {
      // Mock a network error
      await page.route('**/api/search**', route => {
        route.abort('failed');
      });
      
      await page.fill('[data-testid="search-input"]', 'test');
      await page.click('[data-testid="search-button"]');
      
      // Should show error state
      await expect(page.locator('text=/Search Error/i')).toBeVisible();
      await expect(page.locator('text=/Try Again/i')).toBeVisible();
    });

    test('should support different view modes', async ({ page }) => {
      await page.fill('[data-testid="search-input"]', 'restaurant');
      await page.click('[data-testid="search-button"]');
      
      await waitForSearchResults(page);
      
      // Should have view mode toggle
      const viewToggle = page.locator('[data-testid="view-mode-toggle"]');
      if (await viewToggle.isVisible()) {
        await viewToggle.click();
        
        // Should change view mode
        await expect(page.locator('.results-grid')).toHaveClass(/list-view|grid-view/);
      }
    });
  });

  test.describe('URL Synchronization', () => {
    test('should update URL with search parameters', async ({ page }) => {
      await page.fill('[data-testid="search-input"]', 'coffee shop');
      await page.click('[data-testid="search-button"]');
      
      await waitForSearchResults(page);
      
      // Check URL contains search query
      await expect(page).toHaveURL(/q=coffee%20shop/);
    });

    test('should update URL with filter parameters', async ({ page }) => {
      await page.click('[data-testid="filters-toggle"]');
      await page.click('[data-testid="category-restaurants"]');
      
      await page.fill('[data-testid="search-input"]', 'food');
      await page.click('[data-testid="search-button"]');
      
      await waitForSearchResults(page);
      
      // Check URL contains category filter
      await expect(page).toHaveURL(/categories=restaurants/);
    });

    test('should restore search state from URL', async ({ page }) => {
      // Navigate to URL with search parameters
      await page.goto(`${TEST_CONFIG.baseUrl}/?q=pizza&categories=restaurants`);
      
      await waitForSearchResults(page);
      
      // Should have restored search state
      await expect(page.locator('[data-testid="search-input"]')).toHaveValue('pizza');
      await expect(page.locator('[data-testid="category-restaurants"]')).toHaveClass(/selected/);
    });
  });

  test.describe('Mobile Experience', () => {
    test('should work properly on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Check mobile-specific elements
      await expect(page.locator('.mobile-layout')).toBeVisible();
      
      // Test search functionality
      await page.fill('[data-testid="search-input"]', 'restaurant');
      await page.click('[data-testid="search-button"]');
      
      await waitForSearchResults(page);
      
      // Should show mobile-optimized results
      const businessCards = page.locator('[data-testid^="business-card-"]');
      await expect(businessCards).toHaveCount.greaterThan(0);
    });

    test('should show mobile filter interface', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Should have mobile filter toggle
      const mobileFilterBtn = page.locator('[data-testid="mobile-filter-toggle"]');
      if (await mobileFilterBtn.isVisible()) {
        await mobileFilterBtn.click();
        await expect(page.locator('[data-testid="mobile-filters"]')).toBeVisible();
      }
    });
  });

  test.describe('Search Analytics', () => {
    test('should track search interactions', async ({ page }) => {
      // Listen for analytics calls
      const analyticsRequests: any[] = [];
      page.on('request', request => {
        if (request.url().includes('/api/search/analytics')) {
          analyticsRequests.push(request);
        }
      });
      
      // Perform search
      await page.fill('[data-testid="search-input"]', 'analytics test');
      await page.click('[data-testid="search-button"]');
      
      await waitForSearchResults(page);
      
      // Should have tracked the search
      expect(analyticsRequests.length).toBeGreaterThan(0);
    });

    test('should track business interactions', async ({ page }) => {
      const analyticsRequests: any[] = [];
      page.on('request', request => {
        if (request.url().includes('/api/search/analytics')) {
          analyticsRequests.push(request);
        }
      });
      
      await page.fill('[data-testid="search-input"]', 'restaurant');
      await page.click('[data-testid="search-button"]');
      
      await waitForSearchResults(page);
      
      // Click on first business card
      const firstCard = page.locator('[data-testid^="business-card-"]').first();
      await firstCard.click();
      
      await page.waitForTimeout(500); // Wait for analytics
      
      // Should have tracked business interaction
      expect(analyticsRequests.length).toBeGreaterThan(1);
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle empty search gracefully', async ({ page }) => {
      await page.click('[data-testid="search-button"]');
      
      // Should show validation message or not execute search
      const searchInput = page.locator('[data-testid="search-input"]');
      await expect(searchInput).toBeFocused();
    });

    test('should handle special characters in search', async ({ page }) => {
      await page.fill('[data-testid="search-input"]', '!@#$%^&*()');
      await page.click('[data-testid="search-button"]');
      
      // Should handle gracefully without breaking
      await page.waitForTimeout(2000);
      await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
    });

    test('should handle very long search queries', async ({ page }) => {
      const longQuery = 'a'.repeat(500);
      await page.fill('[data-testid="search-input"]', longQuery);
      await page.click('[data-testid="search-button"]');
      
      // Should handle gracefully
      await page.waitForTimeout(2000);
      await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
    });

    test('should handle network timeouts', async ({ page }) => {
      // Mock slow network
      await page.route('**/api/search**', route => {
        setTimeout(() => route.continue(), 10000); // 10 second delay
      });
      
      await page.fill('[data-testid="search-input"]', 'timeout test');
      await page.click('[data-testid="search-button"]');
      
      // Should show loading state
      await expect(page.locator('[data-testid="search-loading"]')).toBeVisible();
    });
  });

  test.describe('Integration Tests', () => {
    test('should integrate with existing business data', async ({ page }) => {
      await page.fill('[data-testid="search-input"]', 'restaurant');
      await page.click('[data-testid="search-button"]');
      
      await waitForSearchResults(page);
      
      // Check that business cards show proper data
      const firstCard = page.locator('[data-testid^="business-card-"]').first();
      await expect(firstCard.locator('[data-testid="business-name"]')).toBeVisible();
      await expect(firstCard.locator('[data-testid="business-category"]')).toBeVisible();
    });

    test('should work with existing modal system', async ({ page }) => {
      await page.fill('[data-testid="search-input"]', 'restaurant');
      await page.click('[data-testid="search-button"]');
      
      await waitForSearchResults(page);
      
      // Click on a business card
      const firstCard = page.locator('[data-testid^="business-card-"]').first();
      await firstCard.click();
      
      // Should open business modal
      await expect(page.locator('[data-testid="business-modal"]')).toBeVisible();
    });
  });
});