/**
 * EPIC 5 STORY 5.5: Usage Analytics Component
 * Feature usage insights showing ROI and upgrade recommendations
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface UsageMetric {
  name: string;
  category: string;
  current: number;
  limit: number;
  unit: string;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
  isNearLimit: boolean;
  isOverLimit: boolean;
  description: string;
}

export interface ROIMetric {
  name: string;
  value: number;
  unit: string;
  description: string;
  comparison: {
    period: string;
    value: number;
    change: number;
  };
}

export interface UpgradeRecommendation {
  reason: string;
  benefit: string;
  estimatedValue: number;
  planSuggestion: {
    name: string;
    price: number;
    features: string[];
  };
}

export interface UsageAnalyticsProps {
  className?: string;
  compact?: boolean;
  detailed?: boolean;
  showUpgradeRecommendations?: boolean;
}

export interface AnalyticsData {
  usageMetrics: UsageMetric[];
  roiMetrics: ROIMetric[];
  upgradeRecommendations: UpgradeRecommendation[];
  summary: {
    totalValue: number;
    efficiency: number;
    growthRate: number;
  };
}

// =============================================
// USAGE ANALYTICS COMPONENT
// =============================================

export function UsageAnalytics({ 
  className, 
  compact = false, 
  detailed = false,
  showUpgradeRecommendations = false
}: UsageAnalyticsProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  useEffect(() => {
    fetchAnalytics();
  }, [selectedPeriod]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/billing/usage-analytics?period=${selectedPeriod}`);
      if (!response.ok) {
        throw new Error('Failed to fetch usage analytics');
      }

      const analyticsData = await response.json();
      setAnalytics(analyticsData);
    } catch (err: any) {
      console.error('Error fetching usage analytics:', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (value: number, unit: string) => {
    if (unit === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(value);
    }
    
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    
    return value.toLocaleString();
  };

  const getTrendColor = (trend: string, trendPercentage: number) => {
    if (trend === 'up') return trendPercentage > 0 ? 'text-sage' : 'text-red-warning';
    if (trend === 'down') return trendPercentage < 0 ? 'text-red-warning' : 'text-sage';
    return 'text-text-secondary';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        );
      case 'down':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  if (loading) {
    return (
      <Card className={cn("usage-analytics p-6 bg-glass-light backdrop-blur-md border-glass", className)}>
        <div className="animate-pulse">
          <div className="h-6 bg-teal-20/30 rounded w-48 mb-4"></div>
          <div className="space-y-4">
            <div className="h-24 bg-teal-20/30 rounded"></div>
            {!compact && (
              <>
                <div className="h-16 bg-teal-20/30 rounded"></div>
                <div className="h-16 bg-teal-20/30 rounded"></div>
              </>
            )}
          </div>
        </div>
      </Card>
    );
  }

  if (error || !analytics) {
    return (
      <Card className={cn("usage-analytics p-6 bg-glass-light backdrop-blur-md border-glass", className)}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto bg-teal-20 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-text-secondary" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-cream mb-2">
            Analytics Unavailable
          </h3>
          <p className="text-text-secondary mb-4">
            {error || 'Unable to load usage analytics at this time.'}
          </p>
          <Button variant="outline" onClick={fetchAnalytics}>
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card className={cn("usage-analytics p-4 bg-glass-light backdrop-blur-md border-glass", className)}>
        <h3 className="text-lg font-semibold text-cream mb-4">Usage Summary</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Platform Value</span>
            <span className="font-semibold text-gold-primary">
              {formatNumber(analytics.summary.totalValue, 'currency')}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Efficiency</span>
            <span className="font-semibold text-sage">
              {analytics.summary.efficiency.toFixed(1)}%
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Growth Rate</span>
            <div className={cn(
              "flex items-center text-sm font-semibold",
              analytics.summary.growthRate > 0 ? "text-sage" : "text-red-warning"
            )}>
              {analytics.summary.growthRate > 0 ? '+' : ''}{analytics.summary.growthRate.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Top Usage Metrics */}
        <div className="mt-4 pt-4 border-t border-glass">
          <div className="space-y-3">
            {analytics.usageMetrics.slice(0, 2).map((metric, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-cream">{metric.name}</span>
                  <span className="text-text-secondary">
                    {metric.current.toLocaleString()} / {metric.limit.toLocaleString()}
                  </span>
                </div>
                <Progress 
                  value={Math.min(metric.percentage, 100)} 
                  className={cn(
                    "h-2",
                    metric.isOverLimit 
                      ? "[&>div]:bg-red-warning" 
                      : metric.isNearLimit 
                        ? "[&>div]:bg-gold-primary" 
                        : "[&>div]:bg-sage"
                  )}
                />
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className={cn("usage-analytics space-y-6", className)}>
      {/* Header */}
      <Card className="p-6 bg-glass-light backdrop-blur-md border-glass">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6">
          <div className="mb-4 lg:mb-0">
            <h2 className="text-2xl font-bold text-cream mb-1">
              Usage Analytics
            </h2>
            <p className="text-text-secondary">
              Track your platform usage, ROI, and optimization opportunities
            </p>
          </div>
          
          {/* Period Selector */}
          <div className="flex items-center space-x-1 bg-glass-dark rounded-lg p-1">
            {(['week', 'month', 'quarter'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={cn(
                  "px-3 py-1 text-sm rounded transition-colors",
                  selectedPeriod === period
                    ? "bg-gold-primary text-cream"
                    : "text-text-secondary hover:text-cream"
                )}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gradient-to-r from-gold-primary/20 to-gold-primary/10 rounded-lg border border-gold-primary/30">
            <div className="text-sm text-text-secondary mb-1">Total Platform Value</div>
            <div className="text-2xl font-bold text-gold-primary">
              {formatNumber(analytics.summary.totalValue, 'currency')}
            </div>
          </div>
          
          <div className="p-4 bg-gradient-to-r from-sage/20 to-sage/10 rounded-lg border border-sage/30">
            <div className="text-sm text-text-secondary mb-1">Usage Efficiency</div>
            <div className="text-2xl font-bold text-sage">
              {analytics.summary.efficiency.toFixed(1)}%
            </div>
          </div>
          
          <div className="p-4 bg-gradient-to-r from-teal-secondary/20 to-teal-secondary/10 rounded-lg border border-teal-secondary/30">
            <div className="text-sm text-text-secondary mb-1">Growth Rate</div>
            <div className={cn(
              "text-2xl font-bold",
              analytics.summary.growthRate > 0 ? "text-sage" : "text-red-warning"
            )}>
              {analytics.summary.growthRate > 0 ? '+' : ''}{analytics.summary.growthRate.toFixed(1)}%
            </div>
          </div>
        </div>
      </Card>

      {detailed ? (
        <Tabs defaultValue="usage" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-glass-light/50 backdrop-blur-md">
            <TabsTrigger value="usage">Usage Metrics</TabsTrigger>
            <TabsTrigger value="roi">ROI Analysis</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          </TabsList>

          {/* Usage Metrics Tab */}
          <TabsContent value="usage">
            <div className="grid gap-4">
              {analytics.usageMetrics.map((metric, index) => (
                <Card key={index} className="p-4 bg-glass-light backdrop-blur-md border-glass">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-cream">{metric.name}</h4>
                      <p className="text-sm text-text-secondary">{metric.description}</p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {metric.isOverLimit && (
                        <Badge variant="destructive" className="text-xs">Over Limit</Badge>
                      )}
                      {metric.isNearLimit && !metric.isOverLimit && (
                        <Badge className="bg-gold-primary/20 text-gold-primary text-xs">Near Limit</Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-secondary">Current Usage</span>
                      <span className="font-medium text-cream">
                        {formatNumber(metric.current, metric.unit)} / {formatNumber(metric.limit, metric.unit)}
                      </span>
                    </div>
                    
                    <Progress 
                      value={Math.min(metric.percentage, 100)} 
                      className={cn(
                        "h-2",
                        metric.isOverLimit 
                          ? "[&>div]:bg-red-warning" 
                          : metric.isNearLimit 
                            ? "[&>div]:bg-gold-primary" 
                            : "[&>div]:bg-sage"
                      )}
                    />
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-secondary">{metric.percentage.toFixed(1)}% used</span>
                      <div className={cn(
                        "flex items-center space-x-1",
                        getTrendColor(metric.trend, metric.trendPercentage)
                      )}>
                        {getTrendIcon(metric.trend)}
                        <span>{Math.abs(metric.trendPercentage).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ROI Analysis Tab */}
          <TabsContent value="roi">
            <div className="grid gap-4">
              {analytics.roiMetrics.map((roi, index) => (
                <Card key={index} className="p-4 bg-glass-light backdrop-blur-md border-glass">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-cream">{roi.name}</h4>
                      <p className="text-sm text-text-secondary">{roi.description}</p>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gold-primary">
                        {formatNumber(roi.value, roi.unit)}
                      </div>
                      <div className="text-sm text-text-secondary">
                        Current Value
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-teal-20/20 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-secondary">{roi.comparison.period} Comparison</span>
                      <div className={cn(
                        "font-medium",
                        roi.comparison.change >= 0 ? "text-sage" : "text-red-warning"
                      )}>
                        {roi.comparison.change >= 0 ? '+' : ''}{roi.comparison.change.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-xs text-text-secondary mt-1">
                      Previous: {formatNumber(roi.comparison.value, roi.unit)}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Recommendations Tab */}
          <TabsContent value="recommendations">
            <div className="space-y-4">
              {analytics.upgradeRecommendations.length > 0 ? (
                analytics.upgradeRecommendations.map((rec, index) => (
                  <Card key={index} className="p-6 bg-glass-light backdrop-blur-md border-glass">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h4 className="font-semibold text-cream mb-2">{rec.reason}</h4>
                        <p className="text-sm text-text-secondary mb-3">{rec.benefit}</p>
                        
                        <div className="text-lg font-bold text-gold-primary mb-3">
                          Estimated Value: {formatNumber(rec.estimatedValue, 'currency')}
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-gradient-to-r from-gold-primary/10 to-transparent rounded-lg border border-gold-primary/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-cream">{rec.planSuggestion.name}</div>
                          <div className="text-sm text-text-secondary">
                            {formatNumber(rec.planSuggestion.price, 'currency')}/month
                          </div>
                        </div>
                        
                        <Button className="bg-gold-primary hover:bg-gold-primary/90">
                          Upgrade Now
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <Card className="p-8 text-center bg-glass-light backdrop-blur-md border-glass">
                  <div className="w-16 h-16 mx-auto bg-sage/20 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-sage" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  
                  <h3 className="text-lg font-medium text-cream mb-2">
                    Optimal Usage
                  </h3>
                  <p className="text-text-secondary">
                    You're making excellent use of your current plan! No upgrade recommendations at this time.
                  </p>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        /* Simple View */
        <div className="grid gap-4">
          {analytics.usageMetrics.slice(0, showUpgradeRecommendations ? 3 : 5).map((metric, index) => (
            <Card key={index} className="p-4 bg-glass-light backdrop-blur-md border-glass">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-cream">{metric.name}</span>
                <span className="text-sm text-text-secondary">
                  {formatNumber(metric.current, metric.unit)} / {formatNumber(metric.limit, metric.unit)}
                </span>
              </div>
              
              <Progress 
                value={Math.min(metric.percentage, 100)} 
                className={cn(
                  "h-2 mb-2",
                  metric.isOverLimit 
                    ? "[&>div]:bg-red-warning" 
                    : metric.isNearLimit 
                      ? "[&>div]:bg-gold-primary" 
                      : "[&>div]:bg-sage"
                )}
              />
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">{metric.percentage.toFixed(0)}% used</span>
                {(metric.isNearLimit || metric.isOverLimit) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-gold-primary hover:text-gold-primary/80"
                  >
                    Upgrade
                  </Button>
                )}
              </div>
            </Card>
          ))}

          {/* Upgrade Recommendations */}
          {showUpgradeRecommendations && analytics.upgradeRecommendations.length > 0 && (
            <Card className="p-4 bg-gradient-to-r from-gold-primary/10 to-transparent border-gold-primary/30">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-cream">Upgrade Recommended</h4>
                  <p className="text-sm text-text-secondary">
                    {analytics.upgradeRecommendations[0].reason}
                  </p>
                </div>
                
                <Button
                  size="sm"
                  className="bg-gold-primary hover:bg-gold-primary/90"
                >
                  View Plans
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default UsageAnalytics;