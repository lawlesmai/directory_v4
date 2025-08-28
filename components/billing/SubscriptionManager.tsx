/**
 * EPIC 5 STORY 5.4: Subscription Manager
 * Plan changes, cancellation, and subscription management
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  popular?: boolean;
  trial_days?: number;
}

export interface Subscription {
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
}

export interface SubscriptionManagerProps {
  currentSubscription?: Subscription;
  onSubscriptionChange?: (subscription: Subscription) => void;
  className?: string;
}

export function SubscriptionManager({
  currentSubscription,
  onSubscriptionChange,
  className,
}: SubscriptionManagerProps) {
  const router = useRouter();
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Dialog states
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [showDowngradeDialog, setShowDowngradeDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  useEffect(() => {
    fetchAvailablePlans();
  }, []);

  const fetchAvailablePlans = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/billing/plans');
      
      if (!response.ok) {
        throw new Error('Failed to fetch available plans');
      }

      const plans = await response.json();
      setAvailablePlans(plans);

    } catch (err: any) {
      console.error('Error fetching plans:', err);
      setError(err.message || 'Failed to load available plans');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanChange = async (newPlan: Plan) => {
    if (!currentSubscription) {
      // No current subscription, redirect to checkout
      router.push(`/checkout?plan=${newPlan.id}`);
      return;
    }

    setActionLoading(`change-plan-${newPlan.id}`);
    
    try {
      const response = await fetch('/api/billing/subscription/change-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: currentSubscription.id,
          newPlanId: newPlan.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to change subscription plan');
      }

      const updatedSubscription = await response.json();
      onSubscriptionChange?.(updatedSubscription);
      
      setShowUpgradeDialog(false);
      setShowDowngradeDialog(false);
      setSelectedPlan(null);

    } catch (err: any) {
      console.error('Error changing plan:', err);
      setError(err.message || 'Failed to change subscription plan');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelSubscription = async (cancelAtPeriodEnd: boolean = true) => {
    if (!currentSubscription) return;

    setActionLoading('cancel-subscription');
    
    try {
      const response = await fetch('/api/billing/subscription/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: currentSubscription.id,
          cancelAtPeriodEnd,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      const updatedSubscription = await response.json();
      onSubscriptionChange?.(updatedSubscription);
      setShowCancelDialog(false);

    } catch (err: any) {
      console.error('Error canceling subscription:', err);
      setError(err.message || 'Failed to cancel subscription');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivateSubscription = async () => {
    if (!currentSubscription) return;

    setActionLoading('reactivate-subscription');
    
    try {
      const response = await fetch('/api/billing/subscription/reactivate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: currentSubscription.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to reactivate subscription');
      }

      const updatedSubscription = await response.json();
      onSubscriptionChange?.(updatedSubscription);

    } catch (err: any) {
      console.error('Error reactivating subscription:', err);
      setError(err.message || 'Failed to reactivate subscription');
    } finally {
      setActionLoading(null);
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-sage bg-sage/20 border-sage/30';
      case 'trialing':
        return 'text-teal-secondary bg-teal-secondary/20 border-teal-secondary/30';
      case 'canceled':
        return 'text-red-warning bg-red-warning/20 border-red-warning/30';
      case 'past_due':
        return 'text-gold-primary bg-gold-primary/20 border-gold-primary/30';
      default:
        return 'text-text-secondary bg-teal-20/50 border-border';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'trialing':
        return 'Free Trial';
      case 'past_due':
        return 'Past Due';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const getCurrentPlan = () => {
    return availablePlans.find(plan => plan.id === currentSubscription?.planId);
  };

  const isUpgrade = (plan: Plan) => {
    const currentPlan = getCurrentPlan();
    return currentPlan && plan.price > currentPlan.price;
  };

  const isDowngrade = (plan: Plan) => {
    const currentPlan = getCurrentPlan();
    return currentPlan && plan.price < currentPlan.price;
  };

  if (loading) {
    return (
      <div className={cn("subscription-manager", className)}>
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto bg-teal-20 rounded-full flex items-center justify-center mb-4">
            <svg className="animate-spin w-8 h-8 text-teal-secondary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-text-secondary">Loading subscription plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("subscription-manager space-y-8", className)}>
      {/* Header */}
      <div className="subscription-header">
        <h2 className="text-2xl font-bold text-cream mb-2">
          Manage Your Subscription
        </h2>
        <p className="text-text-secondary">
          Change your plan, cancel, or upgrade your subscription.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setError(null)}
            className="ml-auto"
          >
            ×
          </Button>
        </Alert>
      )}

      {/* Current Subscription */}
      {currentSubscription && (
        <Card className="current-subscription p-6">
          <div className="subscription-header flex items-start justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-cream mb-2">
                Current Plan: {currentSubscription.planName}
              </h3>
              <div className="flex items-center gap-3 mb-2">
                <Badge className={cn("text-xs", getStatusColor(currentSubscription.status))}>
                  {getStatusLabel(currentSubscription.status)}
                </Badge>
                <span className="text-text-secondary">
                  {formatAmount(currentSubscription.price, currentSubscription.currency)}/{currentSubscription.interval}
                </span>
              </div>
            </div>
            
            <div className="subscription-actions space-x-2">
              {currentSubscription.cancelAtPeriodEnd ? (
                <Button
                  onClick={handleReactivateSubscription}
                  disabled={!!actionLoading}
                  className="bg-sage hover:bg-sage/90"
                >
                  {actionLoading === 'reactivate-subscription' ? 'Reactivating...' : 'Reactivate'}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setShowCancelDialog(true)}
                  disabled={!!actionLoading}
                  className="border-red-warning text-red-warning hover:bg-red-warning/10"
                >
                  Cancel Subscription
                </Button>
              )}
            </div>
          </div>

          {/* Subscription Details */}
          <div className="subscription-details grid md:grid-cols-3 gap-4 p-4 bg-teal-20/30 rounded-lg">
            <div>
              <div className="text-sm text-text-secondary mb-1">Current Period</div>
              <div className="font-medium text-cream">
                {formatDate(currentSubscription.currentPeriodStart)} - {formatDate(currentSubscription.currentPeriodEnd)}
              </div>
            </div>
            
            <div>
              <div className="text-sm text-text-secondary mb-1">
                {currentSubscription.cancelAtPeriodEnd ? 'Expires' : 'Next Billing'}
              </div>
              <div className="font-medium text-cream">
                {formatDate(currentSubscription.currentPeriodEnd)}
              </div>
            </div>
            
            {currentSubscription.trialEnd && (
              <div>
                <div className="text-sm text-text-secondary mb-1">Trial Ends</div>
                <div className="font-medium text-cream">
                  {formatDate(currentSubscription.trialEnd)}
                </div>
              </div>
            )}
          </div>

          {/* Warnings */}
          {currentSubscription.cancelAtPeriodEnd && (
            <Alert className="mt-4 bg-red-warning/20 border-red-warning/30">
              <div className="flex items-center gap-2 text-red-warning">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>
                  Your subscription will be canceled on {formatDate(currentSubscription.currentPeriodEnd)}
                </span>
              </div>
            </Alert>
          )}
        </Card>
      )}

      {/* Available Plans */}
      <div className="available-plans">
        <h3 className="text-xl font-semibold text-cream mb-6">
          {currentSubscription ? 'Change Your Plan' : 'Choose a Plan'}
        </h3>
        
        <div className="plans-grid grid md:grid-cols-3 gap-6">
          {availablePlans.map((plan) => {
            const isCurrent = currentSubscription?.planId === plan.id;
            const planIsUpgrade = isUpgrade(plan);
            const planIsDowngrade = isDowngrade(plan);
            
            return (
              <Card
                key={plan.id}
                className={cn(
                  "plan-card p-6 relative transition-all duration-300",
                  isCurrent 
                    ? "border-gold-primary bg-gradient-to-br from-gold-primary/10 to-gold-secondary/5"
                    : "border-border bg-teal-20/30 hover:border-sage hover:bg-teal-20/50",
                  plan.popular && !isCurrent && "border-gold-primary/50"
                )}
              >
                {/* Popular Badge */}
                {plan.popular && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-gradient-premium text-navy-dark px-3 py-1 text-xs font-semibold">
                      Most Popular
                    </Badge>
                  </div>
                )}

                {/* Current Badge */}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-sage text-white px-3 py-1 text-xs font-semibold">
                      Current Plan
                    </Badge>
                  </div>
                )}

                {/* Plan Header */}
                <div className="plan-header text-center mb-6">
                  <h4 className="text-xl font-bold text-cream mb-2">
                    {plan.name}
                  </h4>
                  
                  <div className="plan-price mb-4">
                    <div className="text-3xl font-bold text-gold-primary mb-1">
                      {formatAmount(plan.price, plan.currency)}
                    </div>
                    <div className="text-sm text-text-secondary">
                      per {plan.interval}
                    </div>
                  </div>

                  {plan.trial_days && !currentSubscription && (
                    <div className="trial-badge mb-4">
                      <Badge className="bg-teal-secondary/20 text-teal-secondary border-teal-secondary/30">
                        {plan.trial_days}-day free trial
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Plan Features */}
                <div className="plan-features space-y-3 mb-6">
                  {plan.features.slice(0, 5).map((feature, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <svg 
                        className="w-4 h-4 text-sage flex-shrink-0" 
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
                  {plan.features.length > 5 && (
                    <div className="text-xs text-text-muted text-center">
                      +{plan.features.length - 5} more features
                    </div>
                  )}
                </div>

                {/* Plan Actions */}
                <div className="plan-actions">
                  {isCurrent ? (
                    <Button disabled className="w-full" variant="outline">
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      className={cn(
                        "w-full",
                        planIsUpgrade 
                          ? "bg-gradient-premium hover:shadow-glow"
                          : planIsDowngrade
                          ? "bg-gradient-trust"
                          : "bg-gradient-premium hover:shadow-glow"
                      )}
                      onClick={() => {
                        setSelectedPlan(plan);
                        if (currentSubscription) {
                          if (planIsUpgrade) {
                            setShowUpgradeDialog(true);
                          } else if (planIsDowngrade) {
                            setShowDowngradeDialog(true);
                          } else {
                            handlePlanChange(plan);
                          }
                        } else {
                          handlePlanChange(plan);
                        }
                      }}
                      disabled={!!actionLoading}
                    >
                      {actionLoading === `change-plan-${plan.id}` ? (
                        <div className="flex items-center gap-2">
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Updating...</span>
                        </div>
                      ) : currentSubscription ? (
                        planIsUpgrade ? 'Upgrade' : planIsDowngrade ? 'Downgrade' : 'Switch Plan'
                      ) : (
                        plan.trial_days ? 'Start Free Trial' : 'Choose Plan'
                      )}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Cancel Subscription Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your subscription? You'll lose access to premium features at the end of your current billing period.
            </DialogDescription>
          </DialogHeader>
          
          <div className="dialog-content space-y-4">
            <Alert className="bg-red-warning/20 border-red-warning/30">
              <div className="flex items-start gap-2 text-red-warning">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-medium mb-1">What you'll lose:</p>
                  <ul className="text-sm space-y-1">
                    <li>• Access to premium features</li>
                    <li>• Priority customer support</li>
                    <li>• Advanced analytics and reporting</li>
                    <li>• Custom integrations</li>
                  </ul>
                </div>
              </div>
            </Alert>
            
            {currentSubscription && (
              <div className="cancellation-info p-4 bg-teal-20/30 rounded-lg">
                <p className="text-sm text-text-secondary">
                  Your subscription will remain active until{' '}
                  <span className="font-medium text-cream">
                    {formatDate(currentSubscription.currentPeriodEnd)}
                  </span>.
                  You can reactivate anytime before this date.
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              disabled={!!actionLoading}
            >
              Keep Subscription
            </Button>
            <Button
              onClick={() => handleCancelSubscription(true)}
              disabled={!!actionLoading}
              className="bg-red-warning hover:bg-red-warning/90"
            >
              {actionLoading === 'cancel-subscription' ? 'Canceling...' : 'Cancel Subscription'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upgrade Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade Your Plan</DialogTitle>
            <DialogDescription>
              Upgrade to {selectedPlan?.name} to unlock more features and capabilities.
            </DialogDescription>
          </DialogHeader>
          
          <div className="dialog-content space-y-4">
            {selectedPlan && currentSubscription && (
              <div className="upgrade-comparison">
                <div className="current-plan p-4 bg-teal-20/30 rounded-lg mb-4">
                  <h4 className="font-medium text-cream mb-2">Current: {currentSubscription.planName}</h4>
                  <p className="text-text-secondary">
                    {formatAmount(currentSubscription.price, currentSubscription.currency)}/{currentSubscription.interval}
                  </p>
                </div>
                
                <div className="new-plan p-4 bg-gradient-to-br from-gold-primary/10 to-gold-secondary/5 border border-gold-primary/30 rounded-lg">
                  <h4 className="font-medium text-cream mb-2">New: {selectedPlan.name}</h4>
                  <p className="text-gold-primary font-semibold">
                    {formatAmount(selectedPlan.price, selectedPlan.currency)}/{selectedPlan.interval}
                  </p>
                  
                  <div className="upgrade-benefits mt-3">
                    <p className="text-sm text-text-secondary mb-2">Additional features:</p>
                    <ul className="text-sm text-sage space-y-1">
                      {selectedPlan.features.slice(0, 3).map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            
            <Alert className="bg-sage/20 border-sage/30">
              <div className="flex items-center gap-2 text-sage">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Changes take effect immediately. You'll be prorated for the difference.</span>
              </div>
            </Alert>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUpgradeDialog(false)}
              disabled={!!actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedPlan && handlePlanChange(selectedPlan)}
              disabled={!!actionLoading}
              className="bg-gradient-premium"
            >
              {actionLoading ? 'Upgrading...' : 'Upgrade Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Downgrade Dialog */}
      <Dialog open={showDowngradeDialog} onOpenChange={setShowDowngradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Downgrade Your Plan</DialogTitle>
            <DialogDescription>
              Are you sure you want to downgrade to {selectedPlan?.name}? You may lose access to some features.
            </DialogDescription>
          </DialogHeader>
          
          <div className="dialog-content space-y-4">
            <Alert className="bg-gold-primary/20 border-gold-primary/30">
              <div className="flex items-start gap-2 text-gold-primary">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-medium mb-1">Downgrading will take effect at the end of your current billing period.</p>
                  <p className="text-sm">You'll retain access to all features until then.</p>
                </div>
              </div>
            </Alert>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDowngradeDialog(false)}
              disabled={!!actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedPlan && handlePlanChange(selectedPlan)}
              disabled={!!actionLoading}
              variant="outline"
              className="border-gold-primary text-gold-primary"
            >
              {actionLoading ? 'Processing...' : 'Confirm Downgrade'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SubscriptionManager;