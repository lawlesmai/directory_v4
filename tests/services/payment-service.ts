import Stripe from 'stripe';
import { SupabaseClient } from '@supabase/supabase-js';

export class PaymentService {
  private stripe: Stripe;
  private supabase: SupabaseClient;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2023-08-16'
    });
    this.supabase = new SupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );
  }

  async createTestCustomer(email: string) {
    return this.stripe.customers.create({ email });
  }

  async createSubscription(customerId: string, priceId: string) {
    return this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }]
    });
  }

  async validatePaymentIntent(amount: number, currency: string = 'usd') {
    return this.stripe.paymentIntents.create({
      amount,
      currency,
      payment_method_types: ['card']
    });
  }

  async getSubscriptionDetails(subscriptionId: string) {
    return this.stripe.subscriptions.retrieve(subscriptionId);
  }
}
