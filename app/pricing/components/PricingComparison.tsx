/**
 * EPIC 5 STORY 5.4: Pricing Comparison Component
 * Feature comparison matrix for all plans
 */

'use client';

import React, { useState } from 'react';
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

interface PricingComparisonProps {
  plans: PricingPlan[];
  billingCycle: 'monthly' | 'yearly';
  onPlanSelect: (planId: string) => void;
  className?: string;
}

interface ComparisonFeature {
  name: string;
  category: string;
  description?: string;
  plans: {
    [planId: string]: boolean | string | number;
  };
}

const COMPARISON_FEATURES: ComparisonFeature[] = [
  // Listings Features
  {
    name: 'Business Listings',
    category: 'Listings',
    description: 'Number of businesses you can list',
    plans: {
      starter: 3,
      professional: 10,
      enterprise: '∞'
    }
  },
  {
    name: 'Photo Uploads',
    category: 'Listings',
    description: 'Photos per business listing',
    plans: {
      starter: '10 per listing',
      professional: 'Unlimited',
      enterprise: 'Unlimited'
    }
  },
  {
    name: 'Video Showcase',
    category: 'Listings',
    description: 'Add videos to your business profile',
    plans: {
      starter: false,
      professional: true,
      enterprise: true
    }
  },
  {
    name: 'Custom Branding',
    category: 'Listings',
    description: 'Customize colors, logos, and styling',
    plans: {
      starter: false,
      professional: 'Basic',
      enterprise: 'Advanced'
    }
  },
  {
    name: 'Multiple Locations',
    category: 'Listings',
    description: 'Manage multiple business locations',
    plans: {
      starter: false,
      professional: true,
      enterprise: true
    }
  },
  {
    name: 'Bulk Import/Export',
    category: 'Listings',
    description: 'Import and export listings in bulk',
    plans: {
      starter: false,
      professional: false,
      enterprise: true
    }
  },
  
  // Discovery Features
  {
    name: 'Search Optimization',
    category: 'Discovery',
    description: 'How your listings appear in search',
    plans: {
      starter: 'Basic SEO',
      professional: 'Advanced SEO',
      enterprise: 'Priority + Consultation'
    }
  },
  {
    name: 'Featured Placement',
    category: 'Discovery',
    description: 'Premium positioning in search results',
    plans: {
      starter: false,
      professional: 'Category Featured',
      enterprise: 'Directory Featured'
    }
  },
  {
    name: 'Social Media Integration',
    category: 'Discovery',
    description: 'Connect and sync with social platforms',
    plans: {
      starter: false,
      professional: true,
      enterprise: true
    }
  },
  {
    name: 'Review Management',
    category: 'Discovery',
    description: 'Tools to manage customer reviews',
    plans: {
      starter: 'Basic',
      professional: 'Advanced',
      enterprise: 'Enterprise'
    }
  },
  {
    name: 'API Access',
    category: 'Discovery',
    description: 'Programmatic access to listings',
    plans: {
      starter: false,
      professional: false,
      enterprise: true
    }
  },

  // Analytics Features
  {
    name: 'Analytics Dashboard',
    category: 'Analytics',
    description: 'View your business performance',
    plans: {
      starter: 'Basic',
      professional: 'Advanced',
      enterprise: 'Enterprise'
    }
  },
  {
    name: 'Customer Insights',
    category: 'Analytics',
    description: 'Understand your customer demographics',
    plans: {
      starter: false,
      professional: true,
      enterprise: true
    }
  },
  {
    name: 'Conversion Tracking',
    category: 'Analytics',
    description: 'Track leads and conversions',
    plans: {
      starter: false,
      professional: true,
      enterprise: true
    }
  },
  {
    name: 'Custom Reports',
    category: 'Analytics',
    description: 'Build your own analytics reports',
    plans: {
      starter: false,
      professional: false,
      enterprise: true
    }
  },
  {
    name: 'Data Export',
    category: 'Analytics',
    description: 'Export your analytics data',
    plans: {
      starter: false,
      professional: 'Manual',
      enterprise: 'Automated'
    }
  },
  {
    name: 'Real-time Data',
    category: 'Analytics',
    description: 'Live updates on your metrics',
    plans: {
      starter: false,
      professional: false,
      enterprise: true
    }
  },

  // Marketing Features
  {
    name: 'Lead Capture Forms',
    category: 'Marketing',
    description: 'Capture potential customer information',
    plans: {
      starter: false,
      professional: true,
      enterprise: true
    }
  },
  {
    name: 'Email Marketing',
    category: 'Marketing',
    description: 'Send marketing emails to customers',
    plans: {
      starter: false,
      professional: 'Basic',
      enterprise: 'Advanced'
    }
  },
  {
    name: 'Promotional Campaigns',
    category: 'Marketing',
    description: 'Run targeted marketing campaigns',
    plans: {
      starter: false,
      professional: true,
      enterprise: true
    }
  },
  {
    name: 'Marketing Automation',
    category: 'Marketing',
    description: 'Automate your marketing workflows',
    plans: {
      starter: false,
      professional: false,
      enterprise: true
    }
  },
  {
    name: 'CRM Integration',
    category: 'Marketing',
    description: 'Connect with your CRM system',
    plans: {
      starter: false,
      professional: false,
      enterprise: true
    }
  },

  // Support Features
  {
    name: 'Email Support',
    category: 'Support',
    description: 'Get help via email',
    plans: {
      starter: true,
      professional: 'Priority',
      enterprise: '24/7'
    }
  },
  {
    name: 'Chat Support',
    category: 'Support',
    description: 'Live chat with our team',
    plans: {
      starter: false,
      professional: true,
      enterprise: true
    }
  },
  {
    name: 'Phone Support',
    category: 'Support',
    description: 'Direct phone access to support',
    plans: {
      starter: false,
      professional: 'Business Hours',
      enterprise: '24/7'
    }
  },
  {
    name: 'Account Manager',
    category: 'Support',
    description: 'Dedicated account management',
    plans: {
      starter: false,
      professional: false,
      enterprise: true
    }
  },
  {
    name: 'Training & Onboarding',
    category: 'Support',
    description: 'Personalized training sessions',
    plans: {
      starter: 'Self-service',
      professional: 'Group Sessions',
      enterprise: 'Dedicated'
    }
  }
];

export default function PricingComparison({
  plans,
  billingCycle,
  onPlanSelect,
  className,
}: PricingComparisonProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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

  const categories = Array.from(new Set(COMPARISON_FEATURES.map(f => f.category)));

  const getFeatureValue = (feature: ComparisonFeature, planId: string) => {
    const value = feature.plans[planId];
    
    if (typeof value === 'boolean') {
      return value ? '✓' : '✗';
    }
    
    return value;
  };

  const getFeatureValueColor = (feature: ComparisonFeature, planId: string) => {
    const value = feature.plans[planId];
    
    if (typeof value === 'boolean') {
      return value ? 'text-sage' : 'text-red-warning';
    }
    
    if (value === 'Basic') return 'text-gold-primary';
    if (value === 'Advanced' || value === 'Priority') return 'text-sage';
    if (value === 'Enterprise' || value === '∞') return 'text-teal-secondary';
    
    return 'text-cream';
  };

  const filteredFeatures = selectedCategory
    ? COMPARISON_FEATURES.filter(f => f.category === selectedCategory)
    : COMPARISON_FEATURES;

  return (
    <div className={cn("pricing-comparison space-y-8", className)}>
      {/* Header */}
      <div className="comparison-header text-center">
        <h2 className="text-3xl font-bold text-cream mb-4">
          Compare Plans Side by Side
        </h2>
        <p className="text-text-secondary max-w-2xl mx-auto">
          See exactly what's included in each plan and choose the one that's right for your business.
        </p>
      </div>

      {/* Category Filter */}
      <div className="category-filter flex flex-wrap items-center justify-center gap-3">
        <Button
          variant={selectedCategory === null ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedCategory(null)}
          className={selectedCategory === null ? "bg-gradient-premium" : ""}
        >
          All Features
        </Button>
        {categories.map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(category)}
            className={selectedCategory === category ? "bg-gradient-premium" : ""}
          >
            {category}
          </Button>
        ))}
      </div>

      {/* Comparison Table */}
      <Card className="comparison-table p-6 overflow-x-auto bg-teal-20/30 border-border">
        <div className="table-container min-w-[800px]">
          {/* Table Header - Plan Names and Pricing */}
          <div className="table-header grid grid-cols-4 gap-4 mb-8 pb-6 border-b border-border">
            <div className="feature-column">
              <h3 className="text-lg font-semibold text-cream">Features</h3>
            </div>
            
            {plans.map((plan) => (
              <div key={plan.id} className="plan-column text-center">
                <div className="plan-header mb-4">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <h4 className="text-xl font-bold text-cream">{plan.name}</h4>
                    {plan.popular && (
                      <Badge className="bg-gradient-premium text-navy-dark text-xs">
                        Popular
                      </Badge>
                    )}
                  </div>
                  
                  <div className="plan-pricing mb-3">
                    <div className="text-2xl font-bold text-gold-primary">
                      {formatPrice(getMonthlyEquivalent(plan), plan.currency)}
                    </div>
                    <div className="text-sm text-text-secondary">per month</div>
                    {plan.trial_days && (
                      <div className="text-xs text-teal-secondary mt-1">
                        {plan.trial_days}-day free trial
                      </div>
                    )}
                  </div>

                  <Button
                    size="sm"
                    className={cn(
                      "w-full",
                      plan.popular
                        ? "bg-gradient-premium"
                        : plan.id === 'enterprise'
                        ? "bg-sage hover:bg-sage/90"
                        : "bg-gradient-trust"
                    )}
                    onClick={() => onPlanSelect(plan.id)}
                  >
                    {plan.cta}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Feature Rows */}
          <div className="feature-rows space-y-6">
            {categories.map((category) => {
              const categoryFeatures = filteredFeatures.filter(f => f.category === category);
              
              if (categoryFeatures.length === 0) return null;
              
              return (
                <div key={category} className="category-section">
                  <div className="category-header mb-4">
                    <h4 className="text-lg font-semibold text-cream bg-gradient-to-r from-gold-primary/20 to-transparent px-4 py-2 rounded">
                      {category}
                    </h4>
                  </div>
                  
                  {categoryFeatures.map((feature, index) => (
                    <div key={index} className="feature-row grid grid-cols-4 gap-4 py-3 border-b border-border/30 hover:bg-teal-20/20 transition-colors">
                      <div className="feature-name">
                        <div className="font-medium text-cream">{feature.name}</div>
                        {feature.description && (
                          <div className="text-xs text-text-muted mt-1">
                            {feature.description}
                          </div>
                        )}
                      </div>
                      
                      {plans.map((plan) => (
                        <div key={plan.id} className="feature-value text-center">
                          <span className={cn(
                            "font-medium",
                            getFeatureValueColor(feature, plan.id)
                          )}>
                            {getFeatureValue(feature, plan.id)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Bottom CTA */}
      <div className="bottom-cta text-center">
        <Card className="p-8 bg-gradient-to-br from-gold-primary/10 to-gold-secondary/5 border-gold-primary/30">
          <h3 className="text-2xl font-bold text-cream mb-4">
            Still have questions?
          </h3>
          <p className="text-text-secondary mb-6 max-w-2xl mx-auto">
            Our team is here to help you choose the right plan for your business needs.
            Get personalized recommendations and answers to all your questions.
          </p>
          
          <div className="cta-buttons flex items-center justify-center gap-4">
            <Button 
              size="lg"
              className="bg-gradient-premium"
              onClick={() => onPlanSelect('professional')}
            >
              Start Free Trial
            </Button>
            <Button 
              variant="outline"
              size="lg"
            >
              Contact Sales
            </Button>
          </div>
        </Card>
      </div>

      {/* Legend */}
      <div className="comparison-legend">
        <Card className="p-4 bg-navy-dark/30 border-border">
          <div className="legend-content grid md:grid-cols-4 gap-4 text-sm">
            <div className="legend-item flex items-center gap-2">
              <span className="text-sage text-lg">✓</span>
              <span className="text-text-secondary">Included</span>
            </div>
            <div className="legend-item flex items-center gap-2">
              <span className="text-red-warning text-lg">✗</span>
              <span className="text-text-secondary">Not included</span>
            </div>
            <div className="legend-item flex items-center gap-2">
              <span className="text-gold-primary">●</span>
              <span className="text-text-secondary">Basic version</span>
            </div>
            <div className="legend-item flex items-center gap-2">
              <span className="text-sage">●</span>
              <span className="text-text-secondary">Advanced version</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}