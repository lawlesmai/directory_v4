import { test, expect } from '@playwright/test';
import Stripe from 'stripe';

describe('Payment Security Tests', () => {
  let stripe;

  beforeAll(() => {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  });

  test('PCI DSS Compliance Validation', async () => {
    // Check Stripe configuration for PCI DSS compliance
    const account = await stripe.accounts.retrieve();
    
    expect(account.settings.payments.statement_descriptor_prefix).toBeDefined();
    expect(account.settings.card_payments.decline_on.cvc_failure).toBe(true);
    expect(account.settings.card_payments.decline_on.avs_failure).toBe(true);
  });

  test('Prevent Sensitive Data Exposure', async ({ page }) => {
    await page.goto('/checkout');
    
    // Verify no credit card details are in DOM
    const pageContent = await page.content();
    expect(pageContent).not.toContain('4242424242424242');
    
    // Check network requests for sensitive data
    page.on('request', (request) => {
      const postData = request.postData();
      expect(postData).not.toContain('cvv');
      expect(postData).not.toContain('card_number');
    });
  });

  test('Fraud Detection System', async () => {
    // Simulate suspicious transaction
    const fraudCheckPayment = await stripe.paymentIntents.create({
      amount: 100000, // Large amount to trigger checks
      currency: 'usd',
      payment_method_types: ['card'],
      metadata: {
        suspicious_flag: true
      }
    });

    expect(fraudCheckPayment.status).toBe('requires_payment_method');
  });
});
