import { test, expect } from '@playwright/test';
import { PaymentPage } from '../../pages/payment-page';
import { PaymentService } from '../../services/payment-service';

test.describe('EPIC 5: Payment Flow Integration', () => {
  let paymentPage: PaymentPage;
  let paymentService: PaymentService;

  test.beforeEach(async ({ page }) => {
    paymentPage = new PaymentPage(page);
    paymentService = new PaymentService();
    await paymentPage.navigateToCheckout();
  });

  test('Complete Payment Flow', async () => {
    // Create test customer
    const customer = await paymentService.createTestCustomer(`test-${Date.now()}@example.com`);
    
    // Create test subscription
    const subscription = await paymentService.createSubscription(
      customer.id, 
      process.env.TEST_PRICE_ID || 'price_standard'
    );

    // Fill payment details
    await paymentPage.fillPaymentDetails(
      '4242424242424242', // Test card number
      '12/25', 
      '123'
    );

    // Submit payment
    await paymentPage.submitPayment();

    // Verify payment success
    const isSuccessful = await paymentPage.isPaymentSuccessful();
    expect(isSuccessful).toBeTruthy();

    // Verify subscription details
    const subscriptionDetails = await paymentService.getSubscriptionDetails(subscription.id);
    expect(subscriptionDetails.status).toBe('active');
  });

  test('International Payment Processing', async () => {
    // Test payment intent for international transaction
    const paymentIntent = await paymentService.validatePaymentIntent(5000, 'gbp');
    
    expect(paymentIntent.amount).toBe(5000);
    expect(paymentIntent.currency).toBe('gbp');
  });
});
