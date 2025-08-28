/**
 * EPIC 5 STORY 5.4: ROI Pricing Calculator
 * Interactive calculator to show return on investment
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

interface PricingCalculatorProps {
  plans: PricingPlan[];
  onPlanSelect: (planId: string) => void;
  className?: string;
}

interface CalculatorInputs {
  businessType: string;
  currentCustomers: number;
  averageOrderValue: number;
  conversionRate: number;
  marketingBudget: number;
  timeSpentMarketing: number;
  expectedGrowth: number;
}

const BUSINESS_TYPES = [
  { id: 'restaurant', name: 'Restaurant', multiplier: 1.2 },
  { id: 'retail', name: 'Retail Store', multiplier: 1.0 },
  { id: 'service', name: 'Service Business', multiplier: 1.3 },
  { id: 'healthcare', name: 'Healthcare', multiplier: 1.4 },
  { id: 'automotive', name: 'Automotive', multiplier: 1.1 },
  { id: 'beauty', name: 'Beauty & Wellness', multiplier: 1.2 },
  { id: 'professional', name: 'Professional Services', multiplier: 1.5 },
  { id: 'other', name: 'Other', multiplier: 1.0 }
];

export default function PricingCalculator({
  plans,
  onPlanSelect,
  className,
}: PricingCalculatorProps) {
  const [inputs, setInputs] = useState<CalculatorInputs>({
    businessType: 'retail',
    currentCustomers: 100,
    averageOrderValue: 50,
    conversionRate: 5,
    marketingBudget: 500,
    timeSpentMarketing: 10,
    expectedGrowth: 25
  });

  const [results, setResults] = useState<any>(null);
  const [recommendedPlan, setRecommendedPlan] = useState<string>('professional');

  useEffect(() => {
    calculateROI();
  }, [inputs]);

  const calculateROI = () => {
    const businessType = BUSINESS_TYPES.find(bt => bt.id === inputs.businessType);
    const multiplier = businessType?.multiplier || 1.0;

    // Current monthly revenue
    const currentMonthlyRevenue = inputs.currentCustomers * inputs.averageOrderValue * (inputs.conversionRate / 100);

    // Expected improvements with our platform
    const improvementFactors = {
      starter: {
        customerIncrease: 0.15, // 15% more customers
        conversionImprovement: 0.10, // 10% better conversion
        timeReduction: 0.30 // 30% less time spent on marketing
      },
      professional: {
        customerIncrease: 0.35, // 35% more customers
        conversionImprovement: 0.20, // 20% better conversion
        timeReduction: 0.50 // 50% less time spent on marketing
      },
      enterprise: {
        customerIncrease: 0.60, // 60% more customers
        conversionImprovement: 0.30, // 30% better conversion
        timeReduction: 0.70 // 70% less time spent on marketing
      }
    };

    const planResults = plans.map(plan => {
      const factors = improvementFactors[plan.id as keyof typeof improvementFactors];
      
      // Calculate improved metrics
      const newCustomers = inputs.currentCustomers * (1 + factors.customerIncrease * multiplier);
      const newConversionRate = inputs.conversionRate * (1 + factors.conversionImprovement);
      const newMonthlyRevenue = newCustomers * inputs.averageOrderValue * (newConversionRate / 100);
      
      // Revenue increase
      const monthlyRevenueIncrease = newMonthlyRevenue - currentMonthlyRevenue;
      const annualRevenueIncrease = monthlyRevenueIncrease * 12;
      
      // Time savings
      const timeSavingsHours = inputs.timeSpentMarketing * factors.timeReduction;
      const timeSavingsValue = timeSavingsHours * 25; // Assuming $25/hour value
      const annualTimeSavings = timeSavingsValue * 52; // Weekly savings
      
      // Marketing efficiency
      const marketingEfficiencyGain = inputs.marketingBudget * (factors.conversionImprovement / 2);
      const annualMarketingEfficiency = marketingEfficiencyGain * 12;
      
      // Total annual value
      const totalAnnualValue = annualRevenueIncrease + annualTimeSavings + annualMarketingEfficiency;
      
      // Plan cost
      const annualPlanCost = plan.yearlyPrice / 100;
      
      // ROI calculation
      const roi = ((totalAnnualValue - annualPlanCost) / annualPlanCost) * 100;
      const paybackPeriod = annualPlanCost / (totalAnnualValue / 12);

      return {
        planId: plan.id,
        planName: plan.name,
        currentMonthlyRevenue,
        newMonthlyRevenue,
        monthlyRevenueIncrease,
        annualRevenueIncrease,
        timeSavingsHours,
        annualTimeSavings,
        annualMarketingEfficiency,
        totalAnnualValue,
        annualPlanCost,
        roi,
        paybackPeriod: Math.max(0.1, paybackPeriod), // Minimum 0.1 months
        customerIncrease: newCustomers - inputs.currentCustomers,
        conversionImprovement: newConversionRate - inputs.conversionRate
      };
    });

    setResults(planResults);

    // Determine recommended plan based on business size and growth expectations
    const monthlyRevenue = currentMonthlyRevenue;
    let recommended = 'professional';

    if (monthlyRevenue < 2000 || inputs.currentCustomers < 50) {
      recommended = 'starter';
    } else if (monthlyRevenue > 10000 || inputs.currentCustomers > 500 || inputs.expectedGrowth > 50) {
      recommended = 'enterprise';
    }

    setRecommendedPlan(recommended);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (percent: number) => {
    return `${Math.round(percent)}%`;
  };

  const getBestROIPlan = () => {
    if (!results) return null;
    return results.reduce((best: any, current: any) => 
      current.roi > best.roi ? current : best
    );
  };

  return (
    <div className={cn("pricing-calculator space-y-8", className)}>
      {/* Header */}
      <div className="calculator-header text-center">
        <h2 className="text-3xl font-bold text-cream mb-4">
          ROI Calculator
        </h2>
        <p className="text-text-secondary max-w-2xl mx-auto">
          See how much value our platform can bring to your business. 
          Adjust the inputs below to get a personalized ROI calculation.
        </p>
      </div>

      <div className="calculator-content grid lg:grid-cols-2 gap-8">
        {/* Input Panel */}
        <Card className="input-panel p-6 bg-teal-20/30 border-border">
          <h3 className="text-xl font-semibold text-cream mb-6">
            Tell Us About Your Business
          </h3>
          
          <div className="calculator-inputs space-y-6">
            {/* Business Type */}
            <div className="input-group">
              <Label htmlFor="businessType" className="text-cream mb-2 block">
                Business Type
              </Label>
              <Select 
                value={inputs.businessType} 
                onValueChange={(value) => setInputs(prev => ({ ...prev, businessType: value }))}
              >
                <SelectTrigger className="bg-teal-20 border-border text-cream">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_TYPES.map(type => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Current Customers */}
            <div className="input-group">
              <Label htmlFor="currentCustomers" className="text-cream mb-2 block">
                Current Monthly Customers: {inputs.currentCustomers}
              </Label>
              <Slider
                value={[inputs.currentCustomers]}
                onValueChange={(value) => setInputs(prev => ({ ...prev, currentCustomers: value[0] }))}
                max={1000}
                min={10}
                step={10}
                className="mt-2"
              />
              <div className="flex justify-between text-xs text-text-muted mt-1">
                <span>10</span>
                <span>1,000+</span>
              </div>
            </div>

            {/* Average Order Value */}
            <div className="input-group">
              <Label htmlFor="averageOrderValue" className="text-cream mb-2 block">
                Average Order Value
              </Label>
              <Input
                type="number"
                value={inputs.averageOrderValue}
                onChange={(e) => setInputs(prev => ({ ...prev, averageOrderValue: Number(e.target.value) }))}
                className="bg-teal-20 border-border text-cream"
                placeholder="$50"
              />
            </div>

            {/* Conversion Rate */}
            <div className="input-group">
              <Label htmlFor="conversionRate" className="text-cream mb-2 block">
                Current Conversion Rate: {inputs.conversionRate}%
              </Label>
              <Slider
                value={[inputs.conversionRate]}
                onValueChange={(value) => setInputs(prev => ({ ...prev, conversionRate: value[0] }))}
                max={20}
                min={1}
                step={0.5}
                className="mt-2"
              />
              <div className="flex justify-between text-xs text-text-muted mt-1">
                <span>1%</span>
                <span>20%</span>
              </div>
            </div>

            {/* Marketing Budget */}
            <div className="input-group">
              <Label htmlFor="marketingBudget" className="text-cream mb-2 block">
                Monthly Marketing Budget
              </Label>
              <Input
                type="number"
                value={inputs.marketingBudget}
                onChange={(e) => setInputs(prev => ({ ...prev, marketingBudget: Number(e.target.value) }))}
                className="bg-teal-20 border-border text-cream"
                placeholder="$500"
              />
            </div>

            {/* Time Spent Marketing */}
            <div className="input-group">
              <Label htmlFor="timeSpentMarketing" className="text-cream mb-2 block">
                Hours/Week on Marketing: {inputs.timeSpentMarketing}
              </Label>
              <Slider
                value={[inputs.timeSpentMarketing]}
                onValueChange={(value) => setInputs(prev => ({ ...prev, timeSpentMarketing: value[0] }))}
                max={40}
                min={1}
                step={1}
                className="mt-2"
              />
              <div className="flex justify-between text-xs text-text-muted mt-1">
                <span>1 hour</span>
                <span>40+ hours</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Results Panel */}
        <Card className="results-panel p-6 bg-gradient-to-br from-gold-primary/10 to-gold-secondary/5 border-gold-primary/30">
          <h3 className="text-xl font-semibold text-cream mb-6">
            Your ROI Projection
          </h3>
          
          {results && (
            <div className="calculator-results space-y-6">
              {/* Current Situation */}
              <div className="current-situation p-4 bg-navy-dark/50 rounded-lg">
                <h4 className="font-semibold text-cream mb-3">Current Situation</h4>
                <div className="metrics grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-text-muted">Monthly Revenue</div>
                    <div className="font-semibold text-cream">
                      {formatCurrency(results[0]?.currentMonthlyRevenue || 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-text-muted">Annual Revenue</div>
                    <div className="font-semibold text-cream">
                      {formatCurrency((results[0]?.currentMonthlyRevenue || 0) * 12)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Best Plan Recommendation */}
              {getBestROIPlan() && (
                <div className="recommended-plan p-4 bg-sage/20 border border-sage/30 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-cream">Recommended Plan</h4>
                    <div className="text-sage font-bold text-lg">
                      {getBestROIPlan()?.planName}
                    </div>
                  </div>
                  
                  <div className="recommendation-metrics grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-text-muted">Annual ROI</div>
                      <div className="font-bold text-sage text-xl">
                        {formatPercent(getBestROIPlan()?.roi || 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-text-muted">Payback Period</div>
                      <div className="font-semibold text-cream">
                        {(getBestROIPlan()?.paybackPeriod || 0).toFixed(1)} months
                      </div>
                    </div>
                  </div>

                  <Button
                    className="w-full mt-4 bg-sage hover:bg-sage/90"
                    onClick={() => onPlanSelect(getBestROIPlan()?.planId)}
                  >
                    Choose {getBestROIPlan()?.planName}
                  </Button>
                </div>
              )}

              {/* All Plans Comparison */}
              <div className="all-plans space-y-4">
                <h4 className="font-semibold text-cream">All Plans Comparison</h4>
                
                {results.map((result: any, index: number) => {
                  const plan = plans[index];
                  const isRecommended = result.planId === recommendedPlan;
                  
                  return (
                    <div
                      key={result.planId}
                      className={cn(
                        "plan-result p-4 rounded-lg border transition-all duration-200",
                        isRecommended
                          ? "bg-gold-primary/20 border-gold-primary/50"
                          : "bg-teal-20/30 border-border hover:bg-teal-20/50"
                      )}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h5 className="font-semibold text-cream flex items-center gap-2">
                            {result.planName}
                            {isRecommended && (
                              <span className="text-xs bg-gold-primary text-navy-dark px-2 py-1 rounded-full">
                                Recommended
                              </span>
                            )}
                          </h5>
                          <div className="text-sm text-text-secondary">
                            {formatCurrency(result.annualPlanCost)}/year
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gold-primary">
                            {formatPercent(result.roi)}
                          </div>
                          <div className="text-xs text-text-muted">ROI</div>
                        </div>
                      </div>

                      <div className="result-details grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-text-muted">Revenue Increase</div>
                          <div className="font-semibold text-sage">
                            +{formatCurrency(result.annualRevenueIncrease)}
                          </div>
                        </div>
                        <div>
                          <div className="text-text-muted">Time Savings</div>
                          <div className="font-semibold text-teal-secondary">
                            +{formatCurrency(result.annualTimeSavings)}
                          </div>
                        </div>
                        <div>
                          <div className="text-text-muted">New Customers</div>
                          <div className="font-semibold text-cream">
                            +{Math.round(result.customerIncrease)}
                          </div>
                        </div>
                        <div>
                          <div className="text-text-muted">Payback</div>
                          <div className="font-semibold text-cream">
                            {result.paybackPeriod.toFixed(1)} months
                          </div>
                        </div>
                      </div>

                      <Button
                        variant={isRecommended ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "w-full mt-3",
                          isRecommended && "bg-gradient-premium"
                        )}
                        onClick={() => onPlanSelect(result.planId)}
                      >
                        Choose {result.planName}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Disclaimer */}
      <Card className="disclaimer p-4 bg-navy-dark/30 border-border text-center">
        <p className="text-xs text-text-muted">
          <strong>Disclaimer:</strong> These projections are estimates based on industry averages and your inputs. 
          Actual results may vary depending on your specific business, market conditions, and implementation. 
          Past performance does not guarantee future results.
        </p>
      </Card>
    </div>
  );
}