import { test, expect } from '@playwright/test';

const MOBILE_DEVICES = [
  { name: 'iPhone 12', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1' },
  { name: 'Samsung Galaxy S21', userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.105 Mobile Safari/537.36' },
  { name: 'iPad Pro', userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1' }
];

const OAUTH_PROVIDERS = ['Google', 'Apple', 'Facebook'];

MOBILE_DEVICES.forEach(device => {
  test.describe(`Mobile Authentication Flow - ${device.name}`, () => {
    test.use({ 
      userAgent: device.userAgent,
      viewport: { width: 375, height: 812 } // iPhone 12 dimensions
    });

    test('Authentication Modal Responsiveness', async ({ page }) => {
      await page.goto('/');
      const authModal = await page.getByTestId('authentication-modal');
      
      expect(await authModal.isVisible()).toBeTruthy();
      expect(await authModal.evaluate(el => window.getComputedStyle(el).display)).not.toBe('none');
    });

    OAUTH_PROVIDERS.forEach(provider => {
      test(`${provider} OAuth Flow on Mobile`, async ({ page, context }) => {
        // Mock OAuth redirect simulation
        await page.route('**/oauth/redirect', async route => {
          await route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: '<html><body>OAuth Redirect Successful</body></html>'
          });
        });

        await page.goto('/login');
        const oauthButton = await page.getByTestId(`${provider.toLowerCase()}-oauth-button`);
        
        expect(oauthButton).toBeTruthy();
        await oauthButton.click();

        // Validate OAuth flow
        await page.waitForSelector('[data-testid="oauth-success"]');
        const successElement = await page.getByTestId('oauth-success');
        
        expect(await successElement.isVisible()).toBeTruthy();
      });
    });

    test('Touch Interaction Authentication', async ({ page }) => {
      await page.goto('/login');
      const emailInput = await page.getByTestId('email-input');
      const passwordInput = await page.getByTestId('password-input');
      const submitButton = await page.getByTestId('login-submit');

      // Simulate touch interactions
      await emailInput.dispatchEvent('touchstart');
      await emailInput.fill('test@example.com');
      
      await passwordInput.dispatchEvent('touchstart');
      await passwordInput.fill('SecurePassword123!');
      
      await submitButton.dispatchEvent('touchend');
      
      // Validate successful authentication
      await page.waitForSelector('[data-testid="user-dashboard"]');
      const dashboardElement = await page.getByTestId('user-dashboard');
      
      expect(await dashboardElement.isVisible()).toBeTruthy();
    });
  });
});
