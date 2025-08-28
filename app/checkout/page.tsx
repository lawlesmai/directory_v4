/**
 * EPIC 5 STORY 5.4: Main Checkout Page
 * Complete checkout flow with subscription selection and payment processing
 */

'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { CheckoutForm } from '@/components/payments';
import type { PlanDetails } from '@/components/payments';
import { cn } from '@/lib/utils';

// Sample subscription plans - would normally come from API
const SUBSCRIPTION_PLANS: PlanDetails[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 2900, // $29.00
    currency: 'USD',
    interval: 'month',
    trial_days: 14,
    features: [
      'Up to 3 business listings',
      'Basic analytics dashboard',
      'Email support',
      'Mobile app access',
      'Standard listing features',
      'Customer reviews management'
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 4900, // $49.00
    currency: 'USD',
    interval: 'month',
    trial_days: 14,
    popular: true,
    features: [
      'Up to 10 business listings',
      'Advanced analytics & insights',
      'Priority email & chat support',
      'Custom branding options',
      'Advanced listing features',
      'Review response tools',
      'Social media integration',
      'SEO optimization tools'
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 9900, // $99.00
    currency: 'USD',
    interval: 'month',
    trial_days: 30,
    features: [
      'Unlimited business listings',
      'Enterprise analytics suite',
      'Dedicated account manager',
      'White-label solutions',
      'API access',
      'Custom integrations',
      'Priority phone support',
      'Advanced security features',
      'Multi-location management',
      'Team collaboration tools'
    ],
  },
];

function CheckoutPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [selectedPlan, setSelectedPlan] = useState<PlanDetails | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get plan from URL parameter
  useEffect(() => {
    const planId = searchParams.get('plan');
    if (planId) {
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
      if (plan) {
        setSelectedPlan(plan);
        setShowCheckout(true);
      } else {
        setError('Invalid plan selected');
      }
    }
  }, [searchParams]);

  const handlePlanSelect = (plan: PlanDetails) => {
    setSelectedPlan(plan);
    setShowCheckout(true);
    
    // Update URL without triggering navigation
    const url = new URL(window.location.href);
    url.searchParams.set('plan', plan.id);
    window.history.replaceState({}, '', url.toString());
  };

  const handleCheckoutSuccess = (data: any) => {
    console.log('Payment successful:', data);
    
    // Redirect to success page with payment details
    router.push(`/checkout/success?payment_intent=${data.paymentIntent.id}&plan=${selectedPlan?.id}`);
  };

  const handleCheckoutCancel = () => {
    setShowCheckout(false);
    setSelectedPlan(null);
    
    // Clear URL parameters
    const url = new URL(window.location.href);
    url.searchParams.delete('plan');
    window.history.replaceState({}, '', url.toString());
  };

  const formatPrice = (price: number, currency: string, interval: string) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(price / 100);
    
    return `${formatted}/${interval}`;
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-bg flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-6 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto bg-red-warning/20 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-warning" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-cream mb-2">Oops! Something went wrong</h2>
            <p className="text-text-secondary">{error}</p>
          </div>
          
          <Button onClick={() => router.push('/pricing')} className="w-full">
            View Pricing Plans
          </Button>
        </Card>
      </div>
    );
  }

  if (showCheckout && selectedPlan) {
    return (
      <div className="min-h-screen bg-gradient-bg py-8">
        <div className="container mx-auto px-6">
          <CheckoutForm
            plan={selectedPlan}
            onSuccess={handleCheckoutSuccess}
            onCancel={handleCheckoutCancel}
            showGuestCheckout={true}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-bg py-12">
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-cream mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Start your free trial today. No credit card required for the trial period.
          </p>
        </div>

        {/* Plan Selection */}
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {SUBSCRIPTION_PLANS.map((plan) => (
              <Card
                key={plan.id}
                className={cn(
                  "plan-card p-6 relative transition-all duration-300 cursor-pointer border-2",
                  plan.popular 
                    ? "border-gold-primary bg-gradient-to-br from-gold-primary/10 to-gold-secondary/5 transform scale-105 shadow-glow"
                    : "border-border bg-teal-20/30 hover:border-sage hover:bg-teal-20/50 hover:transform hover:scale-102"
                )}
                onClick={() => handlePlanSelect(plan)}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-premium text-navy-dark px-4 py-1 rounded-full text-sm font-semibold">
                      🔥 Most Popular
                    </div>
                  </div>
                )}

                {/* Plan Header */}
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-cream mb-2">
                    {plan.name}
                  </h3>
                  
                  <div className="price-section mb-4">
                    <div className="text-4xl font-bold text-gold-primary mb-1">
                      {formatPrice(plan.price, plan.currency, plan.interval)}
                    </div>
                    {plan.trial_days && (
                      <div className="text-sm text-sage">
                        {plan.trial_days}-day free trial
                      </div>
                    )}
                  </div>
                  
                  <Button 
                    className={cn(
                      "w-full h-12 font-semibold",
                      plan.popular 
                        ? "bg-gradient-premium hover:shadow-glow" 
                        : "bg-gradient-trust"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlanSelect(plan);
                    }}
                  >
                    {plan.trial_days ? 'Start Free Trial' : 'Get Started'}
                  </Button>
                </div>

                {/* Features List */}
                <div className="features-list space-y-3">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <svg 
                        className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" 
                        fill="currentColor" 
                        viewBox="0 0 20 20"
                      >
                        <path 
                          fillRule="evenodd" 
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                          clipRule="evenodd" 
                        />
                      </svg>
                      <span className="text-text-secondary text-sm">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Plan Footer */}
                <div className="mt-6 pt-4 border-t border-border text-center">
                  <p className="text-xs text-text-muted">
                    Cancel anytime. No long-term contracts.
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Trust Section */}
        <div className="max-w-4xl mx-auto mt-16">
          <Card className="p-8 bg-teal-20/30 border-border">
            <h3 className="text-2xl font-bold text-cream text-center mb-8">
              Why Choose Us?
            </h3>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto bg-sage/20 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-sage" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <h4 className="font-semibold text-cream mb-2">Secure & Reliable</h4>
                <p className="text-sm text-text-secondary">
                  Bank-level security with 99.9% uptime guarantee
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 mx-auto bg-gold-primary/20 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gold-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-cream mb-2">30-Day Guarantee</h4>
                <p className="text-sm text-text-secondary">
                  Not satisfied? Get your money back, no questions asked
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 mx-auto bg-teal-secondary/20 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-teal-secondary" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v6.114a4 4 0 10.114 7.886 4 4 0 103.886-7.886V8a1 1 0 01.8-.98l8-1.6A1 1 0 0020 6V4a1 1 0 00-2 0v1.382l-8 1.6V7a1 1 0 00-2 0v4.114a4 4 0 10.114 7.886 4 4 0 103.886-7.886V3z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-cream mb-2">24/7 Support</h4>
                <p className="text-sm text-text-secondary">
                  Our expert team is here to help whenever you need it
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* FAQs */}
        <div className="max-w-3xl mx-auto mt-16">
          <h3 className="text-2xl font-bold text-cream text-center mb-8">
            Frequently Asked Questions
          </h3>
          
          <div className="space-y-4">
            <Card className="p-6 bg-teal-20/30 border-border">
              <h4 className="font-semibold text-cream mb-2">
                Can I change my plan later?
              </h4>
              <p className="text-text-secondary">
                Yes! You can upgrade or downgrade your plan at any time. 
                Changes take effect immediately and we'll prorate the billing.
              </p>
            </Card>
            
            <Card className="p-6 bg-teal-20/30 border-border">
              <h4 className="font-semibold text-cream mb-2">
                What payment methods do you accept?
              </h4>
              <p className="text-text-secondary">
                We accept all major credit cards, PayPal, Apple Pay, Google Pay, 
                and ACH bank transfers for enterprise customers.
              </p>
            </Card>
            
            <Card className="p-6 bg-teal-20/30 border-border">
              <h4 className="font-semibold text-cream mb-2">
                Is my data secure?
              </h4>
              <p className="text-text-secondary">
                Absolutely. We use bank-level encryption and are PCI DSS compliant. 
                Your payment information is processed securely by Stripe and never stored on our servers.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense 
      fallback={
        <div className="min-h-screen bg-gradient-bg flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto bg-teal-20 rounded-full flex items-center justify-center mb-4">
              <svg className="animate-spin w-8 h-8 text-teal-secondary" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <p className="text-text-secondary">Loading checkout...</p>
          </div>
        </div>
      }
    >
      <CheckoutPageContent />
    </Suspense>
  );
}