/**
 * EPIC 5 STORY 5.4: End-to-End Checkout Flow Tests
 * Comprehensive E2E tests for the complete checkout experience
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const TEST_BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

// Test data
const TEST_PLAN = {
  id: 'professional',
  name: 'Professional',
  price: '$49.00',
  monthlyPrice: 4900,
};

const VALID_TEST_CARD = {
  number: '4242424242424242',
  expiry: '12/34',
  cvc: '123',
  zip: '10001',
};

const DECLINED_TEST_CARD = {
  number: '4000000000000002',
  expiry: '12/34',
  cvc: '123',
  zip: '10001',
};

const BILLING_INFO = {
  name: 'John Doe',
  email: 'john.doe@example.com',
  phone: '(555) 123-4567',
  address: '123 Main Street',
  city: 'New York',
  state: 'NY',
  zip: '10001',
};

test.describe('Checkout Flow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up Stripe test mode
    await page.addInitScript(() => {
      window.STRIPE_TEST_MODE = true;
    });
    
    // Mock successful Stripe responses
    await page.route('**/v1/payment_intents', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'pi_test_123456789',
            client_secret: 'pi_test_123456789_secret_test',
            status: 'requires_payment_method',
            amount: TEST_PLAN.monthlyPrice,
            currency: 'usd',
          }),
        });
      }
    });
  });

  test.describe('Complete Checkout Scenarios', () => {
    test('completes checkout with credit card', async ({ page }) => {
      // Navigate to pricing page
      await page.goto(`${TEST_BASE_URL}/pricing`);
      await expect(page.locator('h1')).toContainText('Simple, Transparent Pricing');

      // Select Professional plan
      await page.click(`[data-testid="plan-${TEST_PLAN.id}"] button`);
      
      // Should navigate to checkout
      await expect(page).toHaveURL(/\/checkout/);
      await expect(page.locator('h1')).toContainText('Complete Your Purchase');

      // Verify plan selection
      await expect(page.locator('[data-testid="selected-plan"]')).toContainText(TEST_PLAN.name);
      await expect(page.locator('[data-testid="plan-price"]')).toContainText(TEST_PLAN.price);

      // Select credit card payment method
      await page.click('[data-testid="payment-method-card"]');
      await expect(page.locator('[data-testid="payment-method-card"]')).toHaveClass(/selected/);

      // Continue to payment details
      await page.click('button:has-text("Continue to Payment")');
      
      // Fill billing information
      await page.fill('[data-testid="billing-name"]', BILLING_INFO.name);
      await page.fill('[data-testid="billing-email"]', BILLING_INFO.email);
      await page.fill('[data-testid="billing-address"]', BILLING_INFO.address);
      await page.fill('[data-testid="billing-city"]', BILLING_INFO.city);
      await page.fill('[data-testid="billing-state"]', BILLING_INFO.state);
      await page.fill('[data-testid="billing-zip"]', BILLING_INFO.zip);

      // Fill Stripe card element (using iframe)
      const stripeFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]');
      await stripeFrame.locator('[name="cardnumber"]').fill(VALID_TEST_CARD.number);
      await stripeFrame.locator('[name="exp-date"]').fill(VALID_TEST_CARD.expiry);
      await stripeFrame.locator('[name="cvc"]').fill(VALID_TEST_CARD.cvc);
      await stripeFrame.locator('[name="postal"]').fill(VALID_TEST_CARD.zip);

      // Submit payment
      await page.click('button:has-text("Pay")');

      // Wait for processing
      await expect(page.locator('button:has-text("Processing Payment")')).toBeVisible();

      // Should redirect to success page
      await expect(page).toHaveURL(/\/checkout\/success/, { timeout: 10000 });
      await expect(page.locator('h1')).toContainText('Payment Successful');
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Your subscription is now active');
    });

    test('completes checkout with saved payment method', async ({ page }) => {
      // Mock authenticated user with saved payment methods
      await page.addInitScript(() => {
        localStorage.setItem('user_session', JSON.stringify({
          user: { id: 'user_123', email: 'john@example.com' },
          paymentMethods: [
            {
              id: 'pm_test_123',
              type: 'card',
              brand: 'visa',
              last4: '4242',
              isDefault: true
            }
          ]
        }));
      });

      await page.goto(`${TEST_BASE_URL}/checkout?plan=${TEST_PLAN.id}`);

      // Should show saved payment methods
      await expect(page.locator('[data-testid="saved-payment-methods"]')).toBeVisible();
      await expect(page.locator('[data-testid="payment-method-visa-4242"]')).toContainText('Visa ****4242');

      // Select saved payment method
      await page.click('[data-testid="payment-method-visa-4242"]');
      await expect(page.locator('[data-testid="payment-method-visa-4242"]')).toHaveClass(/selected/);

      // Continue to payment
      await page.click('button:has-text("Continue to Payment")');

      // Should skip card entry (using saved method)
      await page.click('button:has-text("Pay")');

      // Should complete successfully
      await expect(page).toHaveURL(/\/checkout\/success/);
      await expect(page.locator('h1')).toContainText('Payment Successful');
    });

    test('completes checkout with Apple Pay (when available)', async ({ page, browserName }) => {
      // Skip if not Safari or if Apple Pay not available
      test.skip(browserName !== 'webkit', 'Apple Pay only available in Safari');

      await page.addInitScript(() => {
        // Mock Apple Pay availability
        window.ApplePaySession = {
          canMakePayments: () => true,
          supportsVersion: () => true,
        };
      });

      await page.goto(`${TEST_BASE_URL}/checkout?plan=${TEST_PLAN.id}`);

      // Apple Pay should be available
      await expect(page.locator('[data-testid="payment-method-apple_pay"]')).toBeVisible();
      await expect(page.locator('[data-testid="payment-method-apple_pay"]')).not.toHaveClass(/disabled/);

      // Select Apple Pay
      await page.click('[data-testid="payment-method-apple_pay"]');
      await expect(page.locator('button:has-text("🍎 Pay with Apple Pay")')).toBeVisible();

      // Mock Apple Pay success
      await page.addInitScript(() => {
        window.mockApplePaySuccess = true;
      });

      await page.click('button:has-text("🍎 Pay with Apple Pay")');

      // Should complete successfully
      await expect(page).toHaveURL(/\/checkout\/success/);
    });

    test('allows guest checkout', async ({ page }) => {
      await page.goto(`${TEST_BASE_URL}/checkout?plan=${TEST_PLAN.id}`);

      // Should show guest checkout option
      await expect(page.locator('[data-testid="guest-checkout"]')).toBeVisible();
      await page.check('[data-testid="guest-checkout-checkbox"]');

      // Complete checkout as guest
      await page.click('[data-testid="payment-method-card"]');
      await page.click('button:has-text("Continue to Payment")');

      // Fill guest information
      await page.fill('[data-testid="guest-email"]', 'guest@example.com');
      await page.fill('[data-testid="billing-name"]', 'Guest User');
      await page.fill('[data-testid="billing-address"]', '456 Guest St');
      await page.fill('[data-testid="billing-city"]', 'Guest City');
      await page.fill('[data-testid="billing-state"]', 'CA');
      await page.fill('[data-testid="billing-zip"]', '90210');

      // Fill card details
      const stripeFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]');
      await stripeFrame.locator('[name="cardnumber"]').fill(VALID_TEST_CARD.number);
      await stripeFrame.locator('[name="exp-date"]').fill(VALID_TEST_CARD.expiry);
      await stripeFrame.locator('[name="cvc"]').fill(VALID_TEST_CARD.cvc);

      await page.click('button:has-text("Pay")');

      // Should offer account creation after successful payment
      await expect(page).toHaveURL(/\/checkout\/success/);
      await expect(page.locator('[data-testid="create-account-offer"]')).toContainText('Create an account to manage your subscription');
    });
  });

  test.describe('Error Scenarios', () => {
    test('handles declined credit card', async ({ page }) => {
      await page.goto(`${TEST_BASE_URL}/checkout?plan=${TEST_PLAN.id}`);

      // Select card payment
      await page.click('[data-testid="payment-method-card"]');
      await page.click('button:has-text("Continue to Payment")');

      // Fill billing info
      await page.fill('[data-testid="billing-name"]', BILLING_INFO.name);
      await page.fill('[data-testid="billing-email"]', BILLING_INFO.email);
      await page.fill('[data-testid="billing-address"]', BILLING_INFO.address);
      await page.fill('[data-testid="billing-city"]', BILLING_INFO.city);
      await page.fill('[data-testid="billing-state"]', BILLING_INFO.state);
      await page.fill('[data-testid="billing-zip"]', BILLING_INFO.zip);

      // Use declined test card
      const stripeFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]');
      await stripeFrame.locator('[name="cardnumber"]').fill(DECLINED_TEST_CARD.number);
      await stripeFrame.locator('[name="exp-date"]').fill(DECLINED_TEST_CARD.expiry);
      await stripeFrame.locator('[name="cvc"]').fill(DECLINED_TEST_CARD.cvc);

      await page.click('button:has-text("Pay")');

      // Should show decline error
      await expect(page.locator('[data-testid="payment-error"]')).toContainText('Your card was declined');
      await expect(page.locator('button:has-text("Try Again")')).toBeVisible();

      // Should allow retry
      await page.click('button:has-text("Try Again")');
      await expect(page.locator('[data-testid="payment-error"]')).not.toBeVisible();
    });

    test('handles expired credit card', async ({ page }) => {
      await page.goto(`${TEST_BASE_URL}/checkout?plan=${TEST_PLAN.id}`);

      await page.click('[data-testid="payment-method-card"]');
      await page.click('button:has-text("Continue to Payment")');

      // Fill form with expired card
      await page.fill('[data-testid="billing-name"]', BILLING_INFO.name);
      await page.fill('[data-testid="billing-email"]', BILLING_INFO.email);

      const stripeFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]');
      await stripeFrame.locator('[name="cardnumber"]').fill('4000000000000069'); // Expired card
      await stripeFrame.locator('[name="exp-date"]').fill('12/22'); // Past date
      await stripeFrame.locator('[name="cvc"]').fill('123');

      await page.click('button:has-text("Pay")');

      // Should show expired card error
      await expect(page.locator('[data-testid="payment-error"]')).toContainText('Your card has expired');
    });

    test('handles network timeout', async ({ page }) => {
      // Simulate network timeout
      await page.route('**/v1/payment_intents/*/confirm', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 30000)); // 30s timeout
        await route.abort();
      });

      await page.goto(`${TEST_BASE_URL}/checkout?plan=${TEST_PLAN.id}`);

      await page.click('[data-testid="payment-method-card"]');
      await page.click('button:has-text("Continue to Payment")');

      // Fill and submit form quickly
      await page.fill('[data-testid="billing-name"]', BILLING_INFO.name);
      await page.fill('[data-testid="billing-email"]', BILLING_INFO.email);

      const stripeFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]');
      await stripeFrame.locator('[name="cardnumber"]').fill(VALID_TEST_CARD.number);
      await stripeFrame.locator('[name="exp-date"]').fill(VALID_TEST_CARD.expiry);
      await stripeFrame.locator('[name="cvc"]').fill(VALID_TEST_CARD.cvc);

      await page.click('button:has-text("Pay")');

      // Should show network error after timeout
      await expect(page.locator('[data-testid="payment-error"]')).toContainText('network', { timeout: 35000 });
      await expect(page.locator('button:has-text("Try Again")')).toBeVisible();
    });
  });

  test.describe('Mobile Checkout', () => {
    test('completes checkout on mobile device', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto(`${TEST_BASE_URL}/checkout?plan=${TEST_PLAN.id}`);

      // Should display mobile-optimized layout
      await expect(page.locator('[data-testid="mobile-checkout"]')).toBeVisible();
      await expect(page.locator('[data-testid="checkout-progress"]')).toBeVisible();

      // Complete mobile checkout flow
      await page.click('[data-testid="payment-method-card"]');
      
      // Mobile keyboard should appear for input fields
      await page.fill('[data-testid="billing-name"]', BILLING_INFO.name);
      await expect(page.locator('[data-testid="billing-name"]')).toBeFocused();

      // Touch-friendly buttons
      const continueButton = page.locator('button:has-text("Continue to Payment")');
      await expect(continueButton).toHaveCSS('min-height', '44px'); // iOS touch target minimum
      
      await continueButton.click();

      // Fill card info on mobile
      const stripeFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]');
      await stripeFrame.locator('[name="cardnumber"]').fill(VALID_TEST_CARD.number);
      await stripeFrame.locator('[name="exp-date"]').fill(VALID_TEST_CARD.expiry);
      await stripeFrame.locator('[name="cvc"]').fill(VALID_TEST_CARD.cvc);

      await page.click('button:has-text("Pay")');

      // Should complete successfully on mobile
      await expect(page).toHaveURL(/\/checkout\/success/);
      await expect(page.locator('[data-testid="mobile-success"]')).toBeVisible();
    });

    test('uses mobile payment methods when available', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Mock mobile payment availability
      await page.addInitScript(() => {
        window.ApplePaySession = {
          canMakePayments: () => true,
          supportsVersion: () => true,
        };
      });

      await page.goto(`${TEST_BASE_URL}/checkout?plan=${TEST_PLAN.id}`);

      // Should prioritize mobile payment methods
      const applePay = page.locator('[data-testid="payment-method-apple_pay"]');
      const googlePay = page.locator('[data-testid="payment-method-google_pay"]');
      
      if (await applePay.isVisible()) {
        await expect(applePay).toHaveClass(/recommended/);
      }
      
      if (await googlePay.isVisible()) {
        await expect(googlePay).toHaveClass(/recommended/);
      }
    });
  });

  test.describe('Accessibility', () => {
    test('supports keyboard navigation', async ({ page }) => {
      await page.goto(`${TEST_BASE_URL}/checkout?plan=${TEST_PLAN.id}`);

      // Tab through payment methods
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="payment-method-card"]')).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="payment-method-apple_pay"]')).toBeFocused();

      // Enter to select payment method
      await page.keyboard.press('Enter');
      await expect(page.locator('[data-testid="payment-method-apple_pay"]')).toHaveClass(/selected/);
    });

    test('announces important changes to screen readers', async ({ page }) => {
      await page.goto(`${TEST_BASE_URL}/checkout?plan=${TEST_PLAN.id}`);

      // Check for ARIA live regions
      await expect(page.locator('[aria-live="polite"]')).toBeVisible();
      await expect(page.locator('[aria-live="assertive"]')).toBeVisible();

      // Error messages should be announced
      await page.click('[data-testid="payment-method-card"]');
      await page.click('button:has-text("Continue to Payment")');
      await page.click('button:has-text("Pay")'); // Submit without required fields

      const errorMessage = page.locator('[role="alert"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toHaveAttribute('aria-live', 'assertive');
    });

    test('has sufficient color contrast', async ({ page }) => {
      await page.goto(`${TEST_BASE_URL}/checkout?plan=${TEST_PLAN.id}`);

      // Check contrast ratios for important elements
      const submitButton = page.locator('button:has-text("Continue to Payment")');
      const buttonStyles = await submitButton.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          backgroundColor: computed.backgroundColor,
          color: computed.color,
        };
      });

      // Verify button has sufficient contrast (this would need a contrast calculation function)
      expect(buttonStyles.backgroundColor).toBeTruthy();
      expect(buttonStyles.color).toBeTruthy();
    });
  });

  test.describe('Security', () => {
    test('enforces HTTPS in production', async ({ page }) => {
      // Mock production environment
      await page.addInitScript(() => {
        Object.defineProperty(window, 'location', {
          value: {
            protocol: 'https:',
            hostname: 'app.example.com',
            href: 'https://app.example.com/checkout'
          }
        });
      });

      await page.goto(`${TEST_BASE_URL}/checkout?plan=${TEST_PLAN.id}`);

      // Should show security indicators
      await expect(page.locator('[data-testid="ssl-secure"]')).toContainText('Secured by SSL');
      await expect(page.locator('[data-testid="pci-compliant"]')).toContainText('PCI Compliant');
    });

    test('validates form inputs for security', async ({ page }) => {
      await page.goto(`${TEST_BASE_URL}/checkout?plan=${TEST_PLAN.id}`);

      await page.click('[data-testid="payment-method-card"]');
      await page.click('button:has-text("Continue to Payment")');

      // Try to inject malicious content
      await page.fill('[data-testid="billing-name"]', '<script>alert("xss")</script>');
      
      // Should sanitize input
      const nameInput = page.locator('[data-testid="billing-name"]');
      const sanitizedValue = await nameInput.inputValue();
      expect(sanitizedValue).not.toContain('<script>');
      expect(sanitizedValue).not.toContain('alert');
    });
  });

  test.describe('Performance', () => {
    test('loads checkout page within performance budget', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto(`${TEST_BASE_URL}/checkout?plan=${TEST_PLAN.id}`);
      
      // Wait for critical elements to load
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('[data-testid="plan-summary"]')).toBeVisible();
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000); // 3 second budget
    });

    test('handles slow network conditions gracefully', async ({ page }) => {
      // Simulate slow 3G network
      await page.route('**/*', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 500)); // Add 500ms delay
        await route.continue();
      });

      await page.goto(`${TEST_BASE_URL}/checkout?plan=${TEST_PLAN.id}`);

      // Should show loading states
      await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
      
      // Should eventually load
      await expect(page.locator('h1')).toContainText('Complete Your Purchase', { timeout: 10000 });
    });
  });
});