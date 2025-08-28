/**
 * EPIC 5 STORY 5.4: Pricing Page
 * Subscription tier comparison and selection with ROI calculator
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import PricingCard from './components/PricingCard';
import PricingComparison from './components/PricingComparison';
import PricingCalculator from './components/PricingCalculator';
import { cn } from '@/lib/utils';

interface PricingPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  popular?: boolean;
  trial_days?: number;
  features: {
    category: string;
    items: string[];
  }[];
  limits: {
    listings: number | 'unlimited';
    analytics: string;
    support: string;
    users: number;
  };
  cta: string;
}

const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for individual business owners getting started',
    monthlyPrice: 2900, // $29.00
    yearlyPrice: 24000, // $240.00 (2 months free)
    currency: 'USD',
    trial_days: 14,
    features: [
      {
        category: 'Listings',
        items: [
          'Up to 3 business listings',
          'Basic business profile',
          'Standard photo uploads (up to 10)',
          'Business hours management',
          'Contact information display'
        ]
      },
      {
        category: 'Discovery',
        items: [
          'Local search optimization',
          'Category-based listing',
          'Basic SEO features',
          'Mobile-friendly listings'
        ]
      },
      {
        category: 'Analytics',
        items: [
          'Basic analytics dashboard',
          'View and click tracking',
          'Monthly performance reports'
        ]
      },
      {
        category: 'Support',
        items: [
          'Email support',
          'Help center access',
          'Getting started guide'
        ]
      }
    ],
    limits: {
      listings: 3,
      analytics: 'Basic',
      support: 'Email',
      users: 1
    },
    cta: 'Start Free Trial'
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Advanced features for growing businesses',
    monthlyPrice: 4900, // $49.00
    yearlyPrice: 42000, // $420.00 (2.5 months free)
    currency: 'USD',
    trial_days: 14,
    popular: true,
    features: [
      {
        category: 'Listings',
        items: [
          'Up to 10 business listings',
          'Enhanced business profiles',
          'Unlimited photo uploads',
          'Video showcase capability',
          'Custom branding options',
          'Multiple location support'
        ]
      },
      {
        category: 'Discovery',
        items: [
          'Premium search placement',
          'Featured listing badges',
          'Advanced SEO tools',
          'Social media integration',
          'Review management tools'
        ]
      },
      {
        category: 'Analytics',
        items: [
          'Advanced analytics suite',
          'Customer insights dashboard',
          'Conversion tracking',
          'Weekly detailed reports',
          'Export data capabilities'
        ]
      },
      {
        category: 'Marketing',
        items: [
          'Promotional campaigns',
          'Email marketing integration',
          'Lead capture forms',
          'Customer messaging system'
        ]
      },
      {
        category: 'Support',
        items: [
          'Priority email & chat support',
          'Phone support available',
          'Dedicated onboarding',
          'Marketing consultation'
        ]
      }
    ],
    limits: {
      listings: 10,
      analytics: 'Advanced',
      support: 'Priority',
      users: 3
    },
    cta: 'Start Free Trial'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Complete solution for large businesses and franchises',
    monthlyPrice: 9900, // $99.00
    yearlyPrice: 84000, // $840.00 (3 months free)
    currency: 'USD',
    trial_days: 30,
    features: [
      {
        category: 'Listings',
        items: [
          'Unlimited business listings',
          'White-label solutions',
          'Custom domain options',
          'Advanced multimedia support',
          'Bulk import/export tools',
          'Multi-location management hub'
        ]
      },
      {
        category: 'Discovery',
        items: [
          'Priority search placement',
          'Featured directory placement',
          'Advanced SEO consultation',
          'Custom integration support',
          'API access for listings'
        ]
      },
      {
        category: 'Analytics',
        items: [
          'Enterprise analytics suite',
          'Custom reporting dashboards',
          'Real-time data streaming',
          'Advanced customer insights',
          'ROI tracking and attribution',
          'Data export automation'
        ]
      },
      {
        category: 'Marketing',
        items: [
          'Full marketing automation',
          'Custom campaign management',
          'Lead scoring and nurturing',
          'Advanced segmentation',
          'Integration with CRM systems'
        ]
      },
      {
        category: 'Enterprise Features',
        items: [
          'Dedicated account manager',
          'Custom onboarding program',
          'Training and workshops',
          'Priority feature requests',
          'SLA guarantees'
        ]
      },
      {
        category: 'Support',
        items: [
          '24/7 phone & chat support',
          'Dedicated success manager',
          'Custom integrations support',
          'Training and education',
          'Priority bug fixes'
        ]
      }
    ],
    limits: {
      listings: 'unlimited',
      analytics: 'Enterprise',
      support: 'Dedicated',
      users: 'unlimited' as any
    },
    cta: 'Contact Sales'
  }
];

export default function PricingPage() {
  const router = useRouter();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [activeTab, setActiveTab] = useState('plans');
  const [loading, setLoading] = useState(false);

  const handlePlanSelect = async (planId: string) => {
    if (planId === 'enterprise') {
      // Redirect to contact sales
      router.push('/contact?topic=enterprise-sales');
      return;
    }

    setLoading(true);
    
    // Add a small delay for better UX
    setTimeout(() => {
      router.push(`/checkout?plan=${planId}&billing=${billingCycle}`);
    }, 500);
  };

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price / 100);
  };

  const getPrice = (plan: PricingPlan) => {
    return billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
  };

  const getMonthlyEquivalent = (plan: PricingPlan) => {
    return billingCycle === 'yearly' ? plan.yearlyPrice / 12 : plan.monthlyPrice;
  };

  const getSavingsAmount = (plan: PricingPlan) => {
    if (billingCycle === 'monthly') return 0;
    const monthlyTotal = plan.monthlyPrice * 12;
    return monthlyTotal - plan.yearlyPrice;
  };

  const getSavingsPercentage = (plan: PricingPlan) => {
    if (billingCycle === 'monthly') return 0;
    const monthlyTotal = plan.monthlyPrice * 12;
    return Math.round(((monthlyTotal - plan.yearlyPrice) / monthlyTotal) * 100);
  };

  return (
    <div className="pricing-page min-h-screen bg-gradient-bg py-12">
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="pricing-header text-center mb-16">
          <h1 className="text-5xl font-bold text-cream mb-6">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-text-secondary max-w-3xl mx-auto mb-8">
            Choose the perfect plan for your business. Start with a free trial, 
            upgrade anytime, and cancel without penalties.
          </p>

          {/* Billing Toggle */}
          <div className="billing-toggle flex items-center justify-center gap-4 mb-8">
            <span className={cn(
              "text-lg font-medium transition-colors",
              billingCycle === 'monthly' ? "text-cream" : "text-text-secondary"
            )}>
              Monthly
            </span>
            
            <Switch
              checked={billingCycle === 'yearly'}
              onCheckedChange={(checked) => setBillingCycle(checked ? 'yearly' : 'monthly')}
              className="data-[state=checked]:bg-gold-primary"
            />
            
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-lg font-medium transition-colors",
                billingCycle === 'yearly' ? "text-cream" : "text-text-secondary"
              )}>
                Yearly
              </span>
              <Badge className="bg-sage text-white text-xs">
                Save up to 30%
              </Badge>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="trust-indicators flex items-center justify-center gap-8 text-sm text-text-secondary">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-sage" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>14-30 day free trials</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-sage" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-sage" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>30-day money back guarantee</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-7xl mx-auto">
          <TabsList className="grid w-full grid-cols-3 mb-12 max-w-md mx-auto">
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="compare">Compare</TabsTrigger>
            <TabsTrigger value="calculator">ROI Calculator</TabsTrigger>
          </TabsList>

          {/* Pricing Plans Tab */}
          <TabsContent value="plans">
            <div className="pricing-plans grid lg:grid-cols-3 gap-8 mb-16">
              {PRICING_PLANS.map((plan) => (
                <PricingCard
                  key={plan.id}
                  plan={plan}
                  billingCycle={billingCycle}
                  onSelect={() => handlePlanSelect(plan.id)}
                  loading={loading}
                />
              ))}
            </div>
          </TabsContent>

          {/* Comparison Tab */}
          <TabsContent value="compare">
            <PricingComparison 
              plans={PRICING_PLANS}
              billingCycle={billingCycle}
              onPlanSelect={handlePlanSelect}
            />
          </TabsContent>

          {/* ROI Calculator Tab */}
          <TabsContent value="calculator">
            <PricingCalculator 
              plans={PRICING_PLANS}
              onPlanSelect={handlePlanSelect}
            />
          </TabsContent>
        </Tabs>

        {/* FAQ Section */}
        <div className="faq-section max-w-4xl mx-auto mt-20">
          <h2 className="text-3xl font-bold text-cream text-center mb-12">
            Frequently Asked Questions
          </h2>
          
          <div className="faqs grid md:grid-cols-2 gap-8">
            <Card className="faq-card p-6 bg-teal-20/30 border-border">
              <h3 className="font-semibold text-cream mb-3">
                What happens during the free trial?
              </h3>
              <p className="text-text-secondary text-sm">
                You get full access to all plan features during your trial period. 
                No credit card required to start, and you can cancel anytime without charges.
              </p>
            </Card>

            <Card className="faq-card p-6 bg-teal-20/30 border-border">
              <h3 className="font-semibold text-cream mb-3">
                Can I change my plan later?
              </h3>
              <p className="text-text-secondary text-sm">
                Yes! You can upgrade or downgrade your plan at any time. 
                Changes take effect immediately, and we'll prorate your billing.
              </p>
            </Card>

            <Card className="faq-card p-6 bg-teal-20/30 border-border">
              <h3 className="font-semibold text-cream mb-3">
                What payment methods do you accept?
              </h3>
              <p className="text-text-secondary text-sm">
                We accept all major credit cards, PayPal, Apple Pay, Google Pay, 
                and ACH bank transfers for enterprise customers.
              </p>
            </Card>

            <Card className="faq-card p-6 bg-teal-20/30 border-border">
              <h3 className="font-semibold text-cream mb-3">
                Is there a setup fee or contract?
              </h3>
              <p className="text-text-secondary text-sm">
                No setup fees, no long-term contracts. You pay monthly or yearly, 
                and you can cancel your subscription at any time.
              </p>
            </Card>

            <Card className="faq-card p-6 bg-teal-20/30 border-border">
              <h3 className="font-semibold text-cream mb-3">
                Do you offer refunds?
              </h3>
              <p className="text-text-secondary text-sm">
                Yes! We offer a 30-day money-back guarantee on all paid plans. 
                If you're not satisfied, we'll refund your payment in full.
              </p>
            </Card>

            <Card className="faq-card p-6 bg-teal-20/30 border-border">
              <h3 className="font-semibold text-cream mb-3">
                Can I get a custom plan for my business?
              </h3>
              <p className="text-text-secondary text-sm">
                Absolutely! Our Enterprise plan includes custom solutions. 
                Contact our sales team to discuss your specific requirements.
              </p>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        <div className="cta-section text-center mt-20">
          <Card className="p-12 bg-gradient-to-br from-gold-primary/10 to-gold-secondary/5 border-gold-primary/30">
            <h2 className="text-3xl font-bold text-cream mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-text-secondary mb-8 max-w-2xl mx-auto">
              Join thousands of businesses already growing with our platform. 
              Start your free trial today and see the difference.
            </p>
            
            <div className="cta-buttons flex items-center justify-center gap-4">
              <Button 
                size="lg"
                className="bg-gradient-premium text-lg px-8 py-6 h-auto"
                onClick={() => handlePlanSelect('professional')}
              >
                Start Free Trial
              </Button>
              <Button 
                variant="outline"
                size="lg"
                className="text-lg px-8 py-6 h-auto"
                onClick={() => router.push('/contact')}
              >
                Contact Sales
              </Button>
            </div>

            <div className="trust-footer mt-8 text-sm text-text-muted">
              <div className="flex items-center justify-center gap-6">
                <span>✓ No credit card required</span>
                <span>✓ Cancel anytime</span>
                <span>✓ 30-day money back guarantee</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}