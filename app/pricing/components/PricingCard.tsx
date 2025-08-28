/**
 * EPIC 5 STORY 5.4: Pricing Card Component
 * Individual plan display with features and pricing
 */

'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    users: number | 'unlimited';
  };
  cta: string;
}

interface PricingCardProps {
  plan: PricingPlan;
  billingCycle: 'monthly' | 'yearly';
  onSelect: () => void;
  loading?: boolean;
  className?: string;
}

export default function PricingCard({
  plan,
  billingCycle,
  onSelect,
  loading = false,
  className,
}: PricingCardProps) {
  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price / 100);
  };

  const getPrice = () => {
    return billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
  };

  const getMonthlyEquivalent = () => {
    return billingCycle === 'yearly' ? plan.yearlyPrice / 12 : plan.monthlyPrice;
  };

  const getSavingsAmount = () => {
    if (billingCycle === 'monthly') return 0;
    const monthlyTotal = plan.monthlyPrice * 12;
    return monthlyTotal - plan.yearlyPrice;
  };

  const getSavingsPercentage = () => {
    if (billingCycle === 'monthly') return 0;
    const monthlyTotal = plan.monthlyPrice * 12;
    return Math.round(((monthlyTotal - plan.yearlyPrice) / monthlyTotal) * 100);
  };

  const getAllFeatures = () => {
    // Flatten all features for display
    return plan.features.reduce((acc, category) => {
      return [...acc, ...category.items];
    }, [] as string[]);
  };

  return (
    <Card
      className={cn(
        "pricing-card relative p-8 transition-all duration-300 cursor-pointer border-2 h-full flex flex-col",
        plan.popular
          ? "border-gold-primary bg-gradient-to-br from-gold-primary/10 to-gold-secondary/5 transform scale-105 shadow-glow"
          : "border-border bg-teal-20/30 hover:border-sage hover:bg-teal-20/50 hover:transform hover:scale-102",
        plan.id === 'enterprise' && "bg-gradient-to-br from-sage/10 to-teal-secondary/5 border-sage/50",
        className
      )}
      onClick={onSelect}
    >
      {/* Popular Badge */}
      {plan.popular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <Badge className="bg-gradient-premium text-navy-dark px-4 py-2 text-sm font-bold shadow-lg">
            🔥 Most Popular
          </Badge>
        </div>
      )}

      {/* Enterprise Badge */}
      {plan.id === 'enterprise' && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <Badge className="bg-sage text-white px-4 py-2 text-sm font-bold shadow-lg">
            🚀 Enterprise
          </Badge>
        </div>
      )}

      {/* Plan Header */}
      <div className="plan-header text-center mb-8">
        <h3 className="text-2xl font-bold text-cream mb-2">
          {plan.name}
        </h3>
        <p className="text-text-secondary text-sm mb-6">
          {plan.description}
        </p>

        {/* Pricing */}
        <div className="pricing mb-6">
          <div className="price-main flex items-baseline justify-center mb-2">
            <span className="text-5xl font-bold text-gold-primary">
              {formatPrice(getMonthlyEquivalent(), plan.currency)}
            </span>
            <span className="text-lg text-text-secondary ml-2">
              /month
            </span>
          </div>

          {/* Yearly savings */}
          {billingCycle === 'yearly' && getSavingsAmount() > 0 && (
            <div className="savings mb-2">
              <div className="text-sm text-sage font-medium">
                Save {formatPrice(getSavingsAmount(), plan.currency)} 
                ({getSavingsPercentage()}% off)
              </div>
              <div className="text-xs text-text-muted">
                Billed {formatPrice(getPrice(), plan.currency)} annually
              </div>
            </div>
          )}

          {/* Monthly billing */}
          {billingCycle === 'monthly' && (
            <div className="text-xs text-text-muted">
              Billed {formatPrice(getPrice(), plan.currency)} monthly
            </div>
          )}
        </div>

        {/* Trial Badge */}
        {plan.trial_days && (
          <div className="trial-badge mb-6">
            <Badge className="bg-teal-secondary/20 text-teal-secondary border-teal-secondary/30">
              {plan.trial_days}-day free trial
            </Badge>
          </div>
        )}

        {/* CTA Button */}
        <Button
          className={cn(
            "w-full h-12 text-lg font-semibold mb-6",
            plan.popular
              ? "bg-gradient-premium hover:shadow-glow"
              : plan.id === 'enterprise'
              ? "bg-sage hover:bg-sage/90"
              : "bg-gradient-trust"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          disabled={loading}
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Loading...</span>
            </div>
          ) : (
            plan.cta
          )}
        </Button>
      </div>

      {/* Plan Limits Quick Stats */}
      <div className="plan-limits mb-6 p-4 bg-navy-dark/30 rounded-lg">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="limit-item">
            <div className="text-text-muted">Listings</div>
            <div className="font-semibold text-cream">
              {plan.limits.listings === 'unlimited' ? '∞' : plan.limits.listings}
            </div>
          </div>
          <div className="limit-item">
            <div className="text-text-muted">Users</div>
            <div className="font-semibold text-cream">
              {plan.limits.users === 'unlimited' ? '∞' : plan.limits.users}
            </div>
          </div>
          <div className="limit-item">
            <div className="text-text-muted">Analytics</div>
            <div className="font-semibold text-cream">
              {plan.limits.analytics}
            </div>
          </div>
          <div className="limit-item">
            <div className="text-text-muted">Support</div>
            <div className="font-semibold text-cream">
              {plan.limits.support}
            </div>
          </div>
        </div>
      </div>

      {/* Features List */}
      <div className="features-list flex-1">
        <h4 className="font-semibold text-cream mb-4 text-center">
          What's Included
        </h4>
        
        <div className="features space-y-3">
          {getAllFeatures().slice(0, 8).map((feature, index) => (
            <div key={index} className="feature-item flex items-start gap-3">
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
              <span className="text-sm text-text-secondary">
                {feature}
              </span>
            </div>
          ))}
          
          {getAllFeatures().length > 8 && (
            <div className="more-features text-center">
              <span className="text-xs text-text-muted">
                +{getAllFeatures().length - 8} more features
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Plan Footer */}
      <div className="plan-footer mt-8 pt-6 border-t border-border text-center">
        <div className="footer-benefits space-y-2 text-xs text-text-muted">
          <div className="flex items-center justify-center gap-1">
            <svg className="w-3 h-3 text-sage" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>Cancel anytime</span>
          </div>
          <div className="flex items-center justify-center gap-1">
            <svg className="w-3 h-3 text-sage" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>No setup fees</span>
          </div>
          <div className="flex items-center justify-center gap-1">
            <svg className="w-3 h-3 text-sage" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>30-day money back</span>
          </div>
        </div>
      </div>

      {/* Hover Effect Overlay */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-transparent via-transparent to-sage/5 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </Card>
  );
}