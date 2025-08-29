import { test, expect } from '@playwright/test';
import { SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Test Suite for EPIC 5: Sales & Payment Funnel
describe('Payment System Integration Tests', () => {
  let supabase;
  let stripe;
  let testUser;

  // Setup before all tests
  beforeAll(async () => {
    // Initialize Supabase and Stripe clients with test credentials
    supabase = new SupabaseClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    // Create a test user for payment testing
    testUser = await supabase.auth.signUp({
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!'
    });
  });

  // Test Payment Flow End-to-End
  test('Complete Payment Flow', async ({ page }) => {
    // Navigate to signup/payment page
    await page.goto('/signup');
    
    // Fill out signup form
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    
    // Select subscription plan
    await page.click('button[data-testid="plan-pro"]');
    
    // Enter payment details
    await page.fill('input[name="cardNumber"]', '4242424242424242');
    await page.fill('input[name="cardExpiry"]', '12/25');
    await page.fill('input[name="cardCVC"]', '123');
    await page.click('button[type="submit"]');
    
    // Verify subscription creation
    const subscription = await stripe.subscriptions.list({
      customer: testUser.user.id,
      limit: 1
    });
    
    expect(subscription.data.length).toBeGreaterThan(0);
    expect(subscription.data[0].status).toBe('active');
  });

  // Test International Payment
  test('International Payment Processing', async () => {
    // Simulate international customer payment
    const internationalCustomer = await stripe.customers.create({
      email: `international-${Date.now()}@example.com`,
      address: {
        country: 'GB', // UK example
        line1: '123 International St',
        postal_code: 'SW1A 1AA'
      }
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 5000, // 50.00 in cents
      currency: 'gbp',
      customer: internationalCustomer.id
    });

    expect(paymentIntent.status).toBe('requires_payment_method');
  });

  // Test Subscription Management
  test('Subscription Upgrade and Downgrade', async () => {
    // Create initial subscription
    const initialSubscription = await stripe.subscriptions.create({
      customer: testUser.user.id,
      items: [{ price: 'price_basic' }]
    });

    // Upgrade subscription
    const upgradedSubscription = await stripe.subscriptions.update(
      initialSubscription.id,
      { items: [{ price: 'price_pro' }] }
    );

    expect(upgradedSubscription.items.data[0].price.id).toBe('price_pro');
  });

  // Teardown after tests
  afterAll(async () => {
    // Clean up test data
    await supabase.auth.signOut();
  });
});
