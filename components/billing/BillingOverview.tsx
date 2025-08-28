/**
 * EPIC 5 STORY 5.5: Billing Overview Component
 * Comprehensive subscription and billing summary with status indicators
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface BillingStatus {
  isActive: boolean;
  nextBillingDate: Date;
  daysUntilBilling: number;
  currentAmount: number;
  currency: string;
  status: 'active' | 'past_due' | 'trialing' | 'canceled' | 'paused';
  trialEndsAt?: Date;
  cancelAtPeriodEnd: boolean;
}

export interface UsageMetric {
  name: string;
  current: number;
  limit: number;
  unit: string;
  percentage: number;
  isNearLimit: boolean;
  isOverLimit: boolean;
}

export interface PaymentMethodHealth {
  id: string;
  type: 'card' | 'bank_account' | 'paypal';
  last4?: string;
  brand?: string;
  isDefault: boolean;
  isExpiring: boolean;
  expiryDate?: Date;
  hasIssues: boolean;
  issueType?: 'expired' | 'declined' | 'verification_needed';
}

export interface BillingOverviewData {
  billingStatus: BillingStatus;
  usageMetrics: UsageMetric[];
  paymentMethodHealth: PaymentMethodHealth[];
  recentAlerts: Array<{
    id: string;
    type: 'warning' | 'error' | 'info' | 'success';
    message: string;
    action?: string;
    timestamp: Date;
  }>;
}

export interface BillingOverviewProps {
  className?: string;
  onQuickAction?: (action: string) => void;
}

// =============================================
// BILLING OVERVIEW COMPONENT
// =============================================

export function BillingOverview({ className, onQuickAction }: BillingOverviewProps) {
  const [data, setData] = useState<BillingOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBillingOverview();
  }, []);

  const fetchBillingOverview = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/billing/overview');
      if (!response.ok) {
        throw new Error('Failed to fetch billing overview');
      }

      const overviewData = await response.json();
      setData(overviewData);
    } catch (err: any) {
      console.error('Error fetching billing overview:', err);
      setError(err.message || 'Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-sage/20 text-sage border-sage/30';
      case 'trialing':
        return 'bg-teal-secondary/20 text-teal-secondary border-teal-secondary/30';
      case 'past_due':
        return 'bg-red-warning/20 text-red-warning border-red-warning/30';
      case 'canceled':
        return 'bg-text-secondary/20 text-text-secondary border-border';
      case 'paused':
        return 'bg-gold-primary/20 text-gold-primary border-gold-primary/30';
      default:
        return 'bg-teal-20/20 text-text-secondary border-border';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'trialing':
        return 'Free Trial';
      case 'past_due':
        return 'Past Due';
      case 'canceled':
        return 'Canceled';
      case 'paused':
        return 'Paused';
      default:
        return 'Unknown';
    }
  };

  const handleQuickAction = (action: string) => {
    onQuickAction?.(action);
  };

  if (loading) {
    return (
      <Card className={cn("billing-overview p-6 bg-glass-light backdrop-blur-md border-glass", className)}>
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="h-6 bg-teal-20/30 rounded w-48 mb-2"></div>
              <div className="h-4 bg-teal-20/30 rounded w-32"></div>
            </div>
            <div className="h-8 bg-teal-20/30 rounded w-20"></div>
          </div>
          
          <div className="space-y-4">
            <div className="h-16 bg-teal-20/30 rounded"></div>
            <div className="h-24 bg-teal-20/30 rounded"></div>
            <div className="h-20 bg-teal-20/30 rounded"></div>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("billing-overview p-6 bg-glass-light backdrop-blur-md border-glass", className)}>
        <Alert variant="destructive">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <h4 className="font-medium mb-1">Error Loading Billing Data</h4>
            <p className="text-sm">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchBillingOverview}
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        </Alert>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const { billingStatus, usageMetrics, paymentMethodHealth, recentAlerts } = data;

  return (
    <Card className={cn("billing-overview bg-glass-light backdrop-blur-md border-glass", className)}>
      {/* Header */}
      <div className="p-6 border-b border-glass">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-cream mb-1">
              Billing Overview
            </h2>
            <p className="text-text-secondary">
              Your subscription and billing status at a glance
            </p>
          </div>
          
          <Badge className={cn("text-sm", getStatusColor(billingStatus?.status || 'unknown'))}>
            {getStatusLabel(billingStatus?.status || 'unknown')}
          </Badge>
        </div>

        {/* Recent Alerts */}
        {recentAlerts.length > 0 && (
          <div className="space-y-2">
            {recentAlerts.slice(0, 2).map((alert) => (
              <Alert 
                key={alert.id} 
                variant={alert.type === 'error' ? 'destructive' : 'default'}
                className="text-sm"
              >
                <div className="flex items-center justify-between">
                  <span>{alert.message}</span>
                  {alert.action && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleQuickAction(alert.action!)}
                      className="text-xs ml-2"
                    >
                      {alert.action}
                    </Button>
                  )}
                </div>
              </Alert>
            ))}
          </div>
        )}
      </div>

      {/* Billing Status Section */}
      <div className="p-6 border-b border-glass">
        <h3 className="text-lg font-semibold text-cream mb-4">Current Billing Status</h3>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Next Billing Information */}
          <div className="billing-period bg-teal-20/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-text-secondary">
                {billingStatus.cancelAtPeriodEnd ? 'Expires' : 'Next Billing'}
              </div>
              <div className="text-xs text-text-secondary">
                {billingStatus?.daysUntilBilling || 0} days
              </div>
            </div>
            
            <div className="text-2xl font-bold text-cream mb-2">
              {billingStatus?.nextBillingDate ? formatDate(billingStatus.nextBillingDate) : 'N/A'}
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Amount Due</span>
              <span className="font-semibold text-gold-primary">
                {formatCurrency(billingStatus?.currentAmount || 0, billingStatus?.currency || 'usd')}
              </span>
            </div>
          </div>

          {/* Payment Method Health */}
          <div className="payment-health bg-teal-20/20 rounded-lg p-4">
            <div className="text-sm font-medium text-text-secondary mb-3">
              Payment Method Status
            </div>
            
            {paymentMethodHealth.length > 0 ? (
              <div className="space-y-2">
                {paymentMethodHealth.slice(0, 1).map((method) => (
                  <div key={method.id} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={cn(
                        "w-2 h-2 rounded-full mr-2",
                        method.hasIssues ? "bg-red-warning" : "bg-sage"
                      )}></div>
                      <span className="text-sm text-cream">
                        •••• {method.last4} {method.brand?.toUpperCase()}
                      </span>
                      {method.isDefault && (
                        <Badge variant="secondary" className="ml-2 text-xs">Default</Badge>
                      )}
                    </div>
                    
                    {method.hasIssues && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleQuickAction('update-payment-method')}
                        className="text-xs text-red-warning hover:text-red-warning/80"
                      >
                        Update
                      </Button>
                    )}
                  </div>
                ))}
                
                {paymentMethodHealth.length > 1 && (
                  <div className="text-xs text-text-secondary">
                    +{paymentMethodHealth.length - 1} more payment method(s)
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="text-sm text-text-secondary mb-2">
                  No payment methods added
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction('add-payment-method')}
                >
                  Add Payment Method
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Trial Information */}
        {billingStatus?.status === 'trialing' && billingStatus?.trialEndsAt && (
          <div className="mt-4 p-4 bg-teal-secondary/20 rounded-lg border border-teal-secondary/30">
            <div className="flex items-center gap-2 text-teal-secondary mb-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Free Trial Active</span>
            </div>
            <p className="text-sm text-text-secondary">
              Your trial ends on {formatDate(billingStatus.trialEndsAt!)}. 
              Add a payment method to continue with premium features.
            </p>
          </div>
        )}

        {/* Cancellation Warning */}
        {billingStatus.cancelAtPeriodEnd && (
          <div className="mt-4 p-4 bg-red-warning/20 rounded-lg border border-red-warning/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-red-warning mb-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Subscription Ending</span>
                </div>
                <p className="text-sm text-text-secondary">
                  Your subscription will be canceled on {formatDate(billingStatus?.nextBillingDate || new Date())}
                </p>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction('reactivate-subscription')}
                className="border-sage text-sage hover:bg-sage/10"
              >
                Reactivate
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Usage Metrics Section */}
      <div className="p-6 border-b border-glass">
        <h3 className="text-lg font-semibold text-cream mb-4">Usage Overview</h3>
        
        <div className="space-y-4">
          {usageMetrics.map((metric, index) => (
            <div key={index} className="usage-metric">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-cream">{metric.name}</span>
                <span className="text-sm text-text-secondary">
                  {metric.current.toLocaleString()} / {metric.limit.toLocaleString()} {metric.unit}
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                <Progress 
                  value={Math.min(metric.percentage, 100)} 
                  className={cn(
                    "flex-1 h-2",
                    metric.isOverLimit 
                      ? "[&>div]:bg-red-warning" 
                      : metric.isNearLimit 
                        ? "[&>div]:bg-gold-primary" 
                        : "[&>div]:bg-sage"
                  )}
                />
                <span className={cn(
                  "text-xs font-medium",
                  metric.isOverLimit 
                    ? "text-red-warning" 
                    : metric.isNearLimit 
                      ? "text-gold-primary" 
                      : "text-sage"
                )}>
                  {metric.percentage.toFixed(0)}%
                </span>
              </div>
              
              {(metric.isNearLimit || metric.isOverLimit) && (
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className={cn(
                    metric.isOverLimit ? "text-red-warning" : "text-gold-primary"
                  )}>
                    {metric.isOverLimit ? 'Usage limit exceeded' : 'Approaching limit'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleQuickAction('upgrade-plan')}
                    className="text-xs h-6"
                  >
                    Upgrade Plan
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-6">
        <h3 className="text-lg font-semibold text-cream mb-4">Quick Actions</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickAction('add-payment-method')}
            className="flex flex-col items-center py-3 h-auto"
          >
            <svg className="w-5 h-5 mb-1" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v2H4V6zm0 4h12v4H4v-4z" />
            </svg>
            <span className="text-xs">Add Card</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickAction('download-invoice')}
            className="flex flex-col items-center py-3 h-auto"
          >
            <svg className="w-5 h-5 mb-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            <span className="text-xs">Download</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickAction('upgrade-plan')}
            className="flex flex-col items-center py-3 h-auto"
          >
            <svg className="w-5 h-5 mb-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-xs">Upgrade</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickAction('contact-support')}
            className="flex flex-col items-center py-3 h-auto"
          >
            <svg className="w-5 h-5 mb-1" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
            </svg>
            <span className="text-xs">Support</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default BillingOverview;