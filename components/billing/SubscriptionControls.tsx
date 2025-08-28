/**
 * EPIC 5 STORY 5.5: Subscription Controls Component
 * Plan upgrades/downgrades, billing frequency changes, cancellation flow
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface SubscriptionData {
  id: string;
  planId: string;
  planName: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused';
  price: number;
  currency: string;
  interval: 'month' | 'year';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd: boolean;
  features: string[];
  usage?: {
    [key: string]: {
      current: number;
      limit: number;
      unit: string;
    };
  };
}

export interface PlanOption {
  id: string;
  name: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
  };
  currency: string;
  features: string[];
  popular?: boolean;
  currentPlan?: boolean;
}

export interface SubscriptionControlsProps {
  className?: string;
  showPreviewOnly?: boolean;
  onSubscriptionChange?: (subscription: SubscriptionData) => void;
}

export interface PlanChangePreview {
  newPlan: PlanOption;
  newInterval: 'month' | 'year';
  prorationAmount: number;
  effectiveDate: Date;
  nextBillingDate: Date;
  nextBillingAmount: number;
}

// =============================================
// SUBSCRIPTION CONTROLS COMPONENT
// =============================================

export function SubscriptionControls({ 
  className, 
  showPreviewOnly = false,
  onSubscriptionChange 
}: SubscriptionControlsProps) {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [availablePlans, setAvailablePlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showPlanChange, setShowPlanChange] = useState(false);
  const [showCancellation, setShowCancellation] = useState(false);
  const [showPauseOptions, setShowPauseOptions] = useState(false);
  const [planChangePreview, setPlanChangePreview] = useState<PlanChangePreview | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<'month' | 'year'>('month');

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [subscriptionRes, plansRes] = await Promise.all([
        fetch('/api/billing/subscription'),
        fetch('/api/billing/plans'),
      ]);

      if (subscriptionRes.ok) {
        const subscriptionData = await subscriptionRes.json();
        setSubscription(subscriptionData);
        setSelectedInterval(subscriptionData.interval);
      }

      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setAvailablePlans(plansData);
      }

    } catch (err: any) {
      console.error('Error fetching subscription data:', err);
      setError(err.message || 'Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanChange = async (planId: string, interval: 'month' | 'year') => {
    setActionLoading('change-plan');
    
    try {
      // First get the change preview
      const previewResponse = await fetch('/api/billing/subscription/preview-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPlanId: planId,
          newInterval: interval,
        }),
      });

      if (!previewResponse.ok) {
        throw new Error('Failed to preview plan change');
      }

      const preview = await previewResponse.json();
      setPlanChangePreview(preview);

    } catch (err: any) {
      console.error('Error previewing plan change:', err);
      setError(err.message || 'Failed to preview plan change');
    } finally {
      setActionLoading(null);
    }
  };

  const confirmPlanChange = async () => {
    if (!planChangePreview) return;

    setActionLoading('confirm-plan-change');
    
    try {
      const response = await fetch('/api/billing/subscription/change-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPlanId: planChangePreview.newPlan.id,
          newInterval: planChangePreview.newInterval,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to change subscription plan');
      }

      const updatedSubscription = await response.json();
      setSubscription(updatedSubscription);
      setShowPlanChange(false);
      setPlanChangePreview(null);
      onSubscriptionChange?.(updatedSubscription);

    } catch (err: any) {
      console.error('Error changing plan:', err);
      setError(err.message || 'Failed to change subscription plan');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelSubscription = async (cancelImmediately: boolean = false) => {
    setActionLoading('cancel-subscription');
    
    try {
      const response = await fetch('/api/billing/subscription/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cancelImmediately,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      const updatedSubscription = await response.json();
      setSubscription(updatedSubscription);
      setShowCancellation(false);
      onSubscriptionChange?.(updatedSubscription);

    } catch (err: any) {
      console.error('Error canceling subscription:', err);
      setError(err.message || 'Failed to cancel subscription');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivateSubscription = async () => {
    setActionLoading('reactivate-subscription');
    
    try {
      const response = await fetch('/api/billing/subscription/reactivate', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to reactivate subscription');
      }

      const updatedSubscription = await response.json();
      setSubscription(updatedSubscription);
      onSubscriptionChange?.(updatedSubscription);

    } catch (err: any) {
      console.error('Error reactivating subscription:', err);
      setError(err.message || 'Failed to reactivate subscription');
    } finally {
      setActionLoading(null);
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

  if (loading) {
    return (
      <Card className={cn("subscription-controls p-6 bg-glass-light backdrop-blur-md border-glass", className)}>
        <div className="animate-pulse">
          <div className="h-6 bg-teal-20/30 rounded w-48 mb-4"></div>
          <div className="space-y-4">
            <div className="h-24 bg-teal-20/30 rounded"></div>
            <div className="h-16 bg-teal-20/30 rounded"></div>
          </div>
        </div>
      </Card>
    );
  }

  if (showPreviewOnly && subscription) {
    return (
      <Card className={cn("subscription-controls p-4 bg-glass-light backdrop-blur-md border-glass", className)}>
        <h3 className="text-lg font-semibold text-cream mb-3">Subscription Management</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Current Plan:</span>
            <span className="font-medium text-cream">{subscription.planName}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Status:</span>
            <Badge className={cn("text-xs", getStatusColor(subscription.status))}>
              {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Next Billing:</span>
            <span className="text-cream">{formatDate(subscription.currentPeriodEnd)}</span>
          </div>
          
          <div className="flex space-x-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPlanChange(true)}
              className="flex-1"
            >
              Change Plan
            </Button>
            
            {!subscription.cancelAtPeriodEnd && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCancellation(true)}
                className="text-red-warning hover:text-red-warning/80"
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Card className={cn("subscription-controls p-8 text-center bg-glass-light backdrop-blur-md border-glass", className)}>
        <div className="w-16 h-16 mx-auto bg-teal-20 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-text-secondary" fill="currentColor" viewBox="0 0 20 20">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
          </svg>
        </div>
        
        <h3 className="text-lg font-medium text-cream mb-2">
          No Active Subscription
        </h3>
        <p className="text-text-secondary mb-6">
          You're currently on the free plan. Upgrade to unlock premium features.
        </p>

        <Button className="bg-gradient-premium">
          View Pricing Plans
        </Button>
      </Card>
    );
  }

  return (
    <div className={cn("subscription-controls space-y-6", className)}>
      {/* Current Subscription Status */}
      <Card className="p-6 bg-glass-light backdrop-blur-md border-glass">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-cream mb-2">
              Subscription Management
            </h2>
            <p className="text-text-secondary">
              Manage your plan, billing, and subscription preferences
            </p>
          </div>
          
          <Badge className={cn("text-sm", getStatusColor(subscription.status))}>
            {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
          </Badge>
        </div>

        {/* Current Plan Details */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-4">
            <div>
              <div className="text-sm text-text-secondary mb-1">Current Plan</div>
              <div className="text-xl font-semibold text-cream">{subscription.planName}</div>
            </div>
            
            <div>
              <div className="text-sm text-text-secondary mb-1">Billing Amount</div>
              <div className="text-lg font-medium text-gold-primary">
                {formatCurrency(subscription.price, subscription.currency)} / {subscription.interval}
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="text-sm text-text-secondary mb-1">Current Period</div>
              <div className="text-sm text-cream">
                {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
              </div>
            </div>
            
            <div>
              <div className="text-sm text-text-secondary mb-1">
                {subscription.cancelAtPeriodEnd ? 'Expires' : 'Next Billing'}
              </div>
              <div className="text-sm text-cream">
                {formatDate(subscription.currentPeriodEnd)}
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </Alert>
        )}

        {/* Subscription Actions */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => setShowPlanChange(true)}
            disabled={!!actionLoading}
            className="bg-gold-primary hover:bg-gold-primary/90"
          >
            Change Plan
          </Button>
          
          {subscription.cancelAtPeriodEnd ? (
            <Button
              onClick={handleReactivateSubscription}
              disabled={!!actionLoading}
              variant="outline"
              className="border-sage text-sage hover:bg-sage/10"
            >
              {actionLoading === 'reactivate-subscription' ? 'Reactivating...' : 'Reactivate'}
            </Button>
          ) : (
            <>
              <Button
                onClick={() => setShowPauseOptions(true)}
                disabled={!!actionLoading}
                variant="outline"
              >
                Pause Subscription
              </Button>
              
              <Button
                onClick={() => setShowCancellation(true)}
                disabled={!!actionLoading}
                variant="ghost"
                className="text-red-warning hover:text-red-warning/80"
              >
                Cancel Subscription
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* Current Plan Features */}
      <Card className="p-6 bg-glass-light backdrop-blur-md border-glass">
        <h3 className="text-lg font-semibold text-cream mb-4">Current Plan Features</h3>
        
        <div className="grid md:grid-cols-2 gap-3">
          {subscription.features.map((feature, index) => (
            <div key={index} className="flex items-center">
              <svg className="w-4 h-4 text-sage mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-text-secondary">{feature}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Plan Change Modal */}
      <Dialog open={showPlanChange} onOpenChange={setShowPlanChange}>
        <DialogContent className="bg-glass-dark backdrop-blur-md border-glass max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-cream">Change Subscription Plan</DialogTitle>
            <DialogDescription className="text-text-secondary">
              Choose a new plan and billing frequency. Changes take effect immediately with prorated billing.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Billing Frequency Toggle */}
            <div className="flex items-center justify-center space-x-4">
              <span className={cn("text-sm", selectedInterval === 'month' ? 'text-cream' : 'text-text-secondary')}>
                Monthly
              </span>
              <Switch
                checked={selectedInterval === 'year'}
                onCheckedChange={(checked) => setSelectedInterval(checked ? 'year' : 'month')}
              />
              <span className={cn("text-sm", selectedInterval === 'year' ? 'text-cream' : 'text-text-secondary')}>
                Yearly (Save 17%)
              </span>
            </div>

            {/* Available Plans */}
            <div className="grid gap-4">
              {availablePlans.map((plan) => (
                <Card key={plan.id} className={cn(
                  "p-4 bg-glass-light border-glass transition-all cursor-pointer hover:border-gold-primary/50",
                  plan.currentPlan && "border-gold-primary/50 bg-gold-primary/5",
                  plan.popular && "ring-2 ring-gold-primary/30"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-semibold text-cream">{plan.name}</h4>
                        {plan.popular && (
                          <Badge className="bg-gold-primary/20 text-gold-primary text-xs">
                            Most Popular
                          </Badge>
                        )}
                        {plan.currentPlan && (
                          <Badge className="bg-sage/20 text-sage text-xs">
                            Current Plan
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-sm text-text-secondary mb-3">{plan.description}</p>
                      
                      <div className="text-2xl font-bold text-gold-primary">
                        {formatCurrency(
                          selectedInterval === 'year' ? plan.price.yearly : plan.price.monthly,
                          plan.currency
                        )}
                        <span className="text-sm text-text-secondary font-normal">
                          /{selectedInterval}
                        </span>
                      </div>
                    </div>
                    
                    <div className="ml-4">
                      {!plan.currentPlan ? (
                        <Button
                          onClick={() => handlePlanChange(plan.id, selectedInterval)}
                          disabled={!!actionLoading}
                          className="bg-gold-primary hover:bg-gold-primary/90"
                        >
                          {actionLoading === 'change-plan' ? 'Loading...' : 'Select Plan'}
                        </Button>
                      ) : (
                        <Button disabled variant="outline">
                          Current Plan
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Plan Change Preview Modal */}
      {planChangePreview && (
        <Dialog open={!!planChangePreview} onOpenChange={() => setPlanChangePreview(null)}>
          <DialogContent className="bg-glass-dark backdrop-blur-md border-glass max-w-md">
            <DialogHeader>
              <DialogTitle className="text-cream">Confirm Plan Change</DialogTitle>
              <DialogDescription className="text-text-secondary">
                Review the changes to your subscription before confirming.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="p-4 bg-teal-20/20 rounded-lg border border-glass">
                <div className="text-sm font-medium text-cream mb-2">Plan Change Summary</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">New Plan:</span>
                    <span className="text-cream">{planChangePreview.newPlan.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Billing Frequency:</span>
                    <span className="text-cream">
                      {planChangePreview.newInterval.charAt(0).toUpperCase() + planChangePreview.newInterval.slice(1)}ly
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Effective Date:</span>
                    <span className="text-cream">{formatDate(planChangePreview.effectiveDate)}</span>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-gold-primary/20 rounded-lg border border-gold-primary/30">
                <div className="text-sm font-medium text-cream mb-2">Billing Impact</div>
                <div className="space-y-2 text-sm">
                  {planChangePreview.prorationAmount !== 0 && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">
                        {planChangePreview.prorationAmount > 0 ? 'Additional Charge:' : 'Credit Applied:'}
                      </span>
                      <span className="text-cream">
                        {formatCurrency(Math.abs(planChangePreview.prorationAmount), subscription.currency)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Next Billing Date:</span>
                    <span className="text-cream">{formatDate(planChangePreview.nextBillingDate)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-cream">Next Billing Amount:</span>
                    <span className="text-gold-primary">
                      {formatCurrency(planChangePreview.nextBillingAmount, subscription.currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setPlanChangePreview(null)}
                disabled={!!actionLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmPlanChange}
                disabled={!!actionLoading}
                className="bg-gold-primary hover:bg-gold-primary/90"
              >
                {actionLoading === 'confirm-plan-change' ? 'Updating...' : 'Confirm Change'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Cancellation Modal */}
      <Dialog open={showCancellation} onOpenChange={setShowCancellation}>
        <DialogContent className="bg-glass-dark backdrop-blur-md border-glass max-w-md">
          <DialogHeader>
            <DialogTitle className="text-cream">Cancel Subscription</DialogTitle>
            <DialogDescription className="text-text-secondary">
              We're sorry to see you go. Choose how you'd like to cancel your subscription.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-red-warning/20 rounded-lg border border-red-warning/30">
              <div className="text-sm text-red-warning font-medium mb-2">
                What happens when you cancel:
              </div>
              <ul className="text-sm text-text-secondary space-y-1">
                <li>• You'll lose access to premium features</li>
                <li>• Your data will be preserved for 30 days</li>
                <li>• You can reactivate anytime before {formatDate(subscription.currentPeriodEnd)}</li>
              </ul>
            </div>
            
            <div className="flex flex-col space-y-3">
              <Button
                onClick={() => handleCancelSubscription(false)}
                disabled={!!actionLoading}
                variant="outline"
                className="border-red-warning text-red-warning hover:bg-red-warning/10"
              >
                {actionLoading === 'cancel-subscription' ? 'Canceling...' : 'Cancel at Period End'}
              </Button>
              
              <Button
                onClick={() => handleCancelSubscription(true)}
                disabled={!!actionLoading}
                variant="destructive"
              >
                {actionLoading === 'cancel-subscription' ? 'Canceling...' : 'Cancel Immediately'}
              </Button>
              
              <Button
                variant="ghost"
                onClick={() => setShowCancellation(false)}
              >
                Keep Subscription
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SubscriptionControls;