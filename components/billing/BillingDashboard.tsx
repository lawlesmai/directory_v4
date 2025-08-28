/**
 * EPIC 5 STORY 5.4: Billing Dashboard
 * Comprehensive payment method management and billing overview
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert } from '@/components/ui/alert';
import { PaymentMethodDisplay } from '@/components/payments';
import type { SavedPaymentMethod } from '@/components/payments';
import { cn } from '@/lib/utils';

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
  features: string[];
}

export interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: 'paid' | 'open' | 'void' | 'draft';
  created: Date;
  dueDate?: Date;
  paidAt?: Date;
  downloadUrl?: string;
}

export interface BillingDashboardProps {
  className?: string;
}

export function BillingDashboard({ className }: BillingDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch subscription data
      const [subscriptionRes, paymentMethodsRes, invoicesRes] = await Promise.all([
        fetch('/api/billing/subscription'),
        fetch('/api/billing/payment-methods'),
        fetch('/api/billing/invoices?limit=5'),
      ]);

      if (subscriptionRes.ok) {
        const subscriptionData = await subscriptionRes.json();
        setSubscription(subscriptionData);
      }

      if (paymentMethodsRes.ok) {
        const paymentMethodsData = await paymentMethodsRes.json();
        setPaymentMethods(paymentMethodsData);
      }

      if (invoicesRes.ok) {
        const invoicesData = await invoicesRes.json();
        setRecentInvoices(invoicesData);
      }

    } catch (err: any) {
      console.error('Error fetching billing data:', err);
      setError('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;

    setActionLoading('cancel-subscription');
    
    try {
      const response = await fetch('/api/billing/subscription/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: subscription.id,
          cancelAtPeriodEnd: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      const updatedSubscription = await response.json();
      setSubscription(updatedSubscription);

    } catch (err: any) {
      console.error('Error canceling subscription:', err);
      setError(err.message || 'Failed to cancel subscription');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivateSubscription = async () => {
    if (!subscription) return;

    setActionLoading('reactivate-subscription');
    
    try {
      const response = await fetch('/api/billing/subscription/reactivate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: subscription.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to reactivate subscription');
      }

      const updatedSubscription = await response.json();
      setSubscription(updatedSubscription);

    } catch (err: any) {
      console.error('Error reactivating subscription:', err);
      setError(err.message || 'Failed to reactivate subscription');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetDefaultPaymentMethod = async (methodId: string) => {
    setActionLoading(`set-default-${methodId}`);
    
    try {
      const response = await fetch('/api/billing/payment-methods/set-default', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentMethodId: methodId }),
      });

      if (!response.ok) {
        throw new Error('Failed to set default payment method');
      }

      // Refresh payment methods
      await fetchBillingData();

    } catch (err: any) {
      console.error('Error setting default payment method:', err);
      setError(err.message || 'Failed to update payment method');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeletePaymentMethod = async (methodId: string) => {
    setActionLoading(`delete-${methodId}`);
    
    try {
      const response = await fetch(`/api/billing/payment-methods/${methodId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete payment method');
      }

      // Refresh payment methods
      await fetchBillingData();

    } catch (err: any) {
      console.error('Error deleting payment method:', err);
      setError(err.message || 'Failed to delete payment method');
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
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'paid':
        return 'text-sage bg-sage/20 border-sage/30';
      case 'trialing':
        return 'text-teal-secondary bg-teal-secondary/20 border-teal-secondary/30';
      case 'canceled':
      case 'void':
        return 'text-red-warning bg-red-warning/20 border-red-warning/30';
      case 'past_due':
      case 'open':
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

  if (loading) {
    return (
      <div className={cn("billing-dashboard", className)}>
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto bg-teal-20 rounded-full flex items-center justify-center mb-4">
            <svg className="animate-spin w-8 h-8 text-teal-secondary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-text-secondary">Loading billing information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("billing-dashboard space-y-8", className)}>
      {/* Header */}
      <div className="billing-header">
        <h1 className="text-3xl font-bold text-cream mb-2">
          Billing & Subscription
        </h1>
        <p className="text-text-secondary">
          Manage your subscription, payment methods, and billing history.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6">
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 mb-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Subscription Overview */}
          {subscription && (
            <Card className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-cream mb-2">
                    Current Plan: {subscription.planName}
                  </h3>
                  <div className="flex items-center gap-3">
                    <Badge className={cn("text-xs", getStatusColor(subscription.status))}>
                      {getStatusLabel(subscription.status)}
                    </Badge>
                    <span className="text-text-secondary">
                      {formatAmount(subscription.price, subscription.currency)}/{subscription.interval}
                    </span>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-2xl font-bold text-gold-primary mb-1">
                    {formatAmount(subscription.price, subscription.currency)}
                  </div>
                  <div className="text-sm text-text-secondary">
                    per {subscription.interval}
                  </div>
                </div>
              </div>

              {/* Trial Info */}
              {subscription.status === 'trialing' && subscription.trialEnd && (
                <Alert className="mb-4 bg-teal-secondary/20 border-teal-secondary/30">
                  <div className="flex items-center gap-2 text-teal-secondary">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>
                      Free trial ends on {formatDate(subscription.trialEnd)}
                    </span>
                  </div>
                </Alert>
              )}

              {/* Cancellation Warning */}
              {subscription.cancelAtPeriodEnd && (
                <Alert className="mb-4 bg-red-warning/20 border-red-warning/30">
                  <div className="flex items-center gap-2 text-red-warning">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>
                      Your subscription will be canceled on {formatDate(subscription.currentPeriodEnd)}
                    </span>
                  </div>
                </Alert>
              )}

              {/* Billing Period */}
              <div className="billing-period grid grid-cols-2 gap-6 p-4 bg-teal-20/30 rounded-lg">
                <div>
                  <div className="text-sm text-text-secondary mb-1">Current Period</div>
                  <div className="font-medium text-cream">
                    {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-text-secondary mb-1">
                    {subscription.cancelAtPeriodEnd ? 'Expires' : 'Next Billing'}
                  </div>
                  <div className="font-medium text-cream">
                    {formatDate(subscription.currentPeriodEnd)}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Quick Actions */}
          <div className="quick-actions grid md:grid-cols-3 gap-4">
            <Card className="p-4 text-center">
              <div className="w-12 h-12 mx-auto bg-gold-primary/20 rounded-full flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-gold-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v2H4V6zm0 4h12v4H4v-4z" />
                </svg>
              </div>
              <h4 className="font-medium text-cream mb-2">Add Payment Method</h4>
              <p className="text-sm text-text-secondary mb-3">
                Add a new card or payment method
              </p>
              <Button size="sm" variant="outline">
                Add Method
              </Button>
            </Card>

            <Card className="p-4 text-center">
              <div className="w-12 h-12 mx-auto bg-teal-secondary/20 rounded-full flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-teal-secondary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
              <h4 className="font-medium text-cream mb-2">Download Invoices</h4>
              <p className="text-sm text-text-secondary mb-3">
                View and download past invoices
              </p>
              <Button size="sm" variant="outline">
                View Invoices
              </Button>
            </Card>

            <Card className="p-4 text-center">
              <div className="w-12 h-12 mx-auto bg-sage/20 rounded-full flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-sage" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                </svg>
              </div>
              <h4 className="font-medium text-cream mb-2">Contact Support</h4>
              <p className="text-sm text-text-secondary mb-3">
                Get help with billing questions
              </p>
              <Button size="sm" variant="outline">
                Get Help
              </Button>
            </Card>
          </div>
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscription" className="space-y-6">
          {subscription ? (
            <Card className="p-6">
              <div className="subscription-details space-y-6">
                <div className="header flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-cream mb-2">
                      {subscription.planName} Plan
                    </h3>
                    <div className="flex items-center gap-3 mb-4">
                      <Badge className={cn("text-xs", getStatusColor(subscription.status))}>
                        {getStatusLabel(subscription.status)}
                      </Badge>
                      <span className="text-text-secondary">
                        {formatAmount(subscription.price, subscription.currency)}/{subscription.interval}
                      </span>
                    </div>
                  </div>
                  
                  <div className="actions space-x-2">
                    {subscription.cancelAtPeriodEnd ? (
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
                        onClick={handleCancelSubscription}
                        disabled={!!actionLoading}
                        className="border-red-warning text-red-warning hover:bg-red-warning/10"
                      >
                        {actionLoading === 'cancel-subscription' ? 'Canceling...' : 'Cancel Subscription'}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Plan Features */}
                <div className="features">
                  <h4 className="font-medium text-cream mb-3">Plan Features</h4>
                  <div className="grid md:grid-cols-2 gap-3">
                    {subscription.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-sage flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm text-text-secondary">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Billing Information */}
                <div className="billing-info">
                  <h4 className="font-medium text-cream mb-3">Billing Information</h4>
                  <div className="info-grid grid md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-text-secondary mb-1">Plan Price</div>
                      <div className="font-medium text-cream">
                        {formatAmount(subscription.price, subscription.currency)} per {subscription.interval}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-text-secondary mb-1">Current Period</div>
                      <div className="font-medium text-cream">
                        {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-text-secondary mb-1">
                        {subscription.cancelAtPeriodEnd ? 'Expires' : 'Next Billing'}
                      </div>
                      <div className="font-medium text-cream">
                        {formatDate(subscription.currentPeriodEnd)}
                      </div>
                    </div>
                    
                    {subscription.trialEnd && (
                      <div>
                        <div className="text-sm text-text-secondary mb-1">Trial Ends</div>
                        <div className="font-medium text-cream">
                          {formatDate(subscription.trialEnd)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <div className="w-16 h-16 mx-auto bg-teal-20 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
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
          )}
        </TabsContent>

        {/* Payment Methods Tab */}
        <TabsContent value="payment-methods">
          <PaymentMethodDisplay
            paymentMethods={paymentMethods}
            onSetDefault={handleSetDefaultPaymentMethod}
            onDelete={handleDeletePaymentMethod}
            onAddNew={() => {/* Open add payment method modal */}}
            showActions={true}
            selectable={false}
          />
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-6">
          {recentInvoices.length > 0 ? (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-cream mb-4">
                Recent Invoices
              </h3>
              
              <div className="invoices-list space-y-4">
                {recentInvoices.map((invoice) => (
                  <div key={invoice.id} className="invoice-item flex items-center justify-between p-4 bg-teal-20/30 rounded-lg border border-border">
                    <div className="invoice-details flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-medium text-cream">
                          Invoice #{invoice.number}
                        </h4>
                        <Badge className={cn("text-xs", getStatusColor(invoice.status))}>
                          {getStatusLabel(invoice.status)}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-text-secondary">
                        {formatDate(invoice.created)} • {formatAmount(invoice.amount, invoice.currency)}
                        {invoice.paidAt && ` • Paid ${formatDate(invoice.paidAt)}`}
                      </div>
                    </div>
                    
                    <div className="invoice-actions">
                      {invoice.downloadUrl && (
                        <Button size="sm" variant="outline">
                          Download PDF
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="text-center mt-6">
                <Button variant="outline">
                  View All Invoices
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <div className="w-16 h-16 mx-auto bg-teal-20 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                </svg>
              </div>
              
              <h3 className="text-lg font-medium text-cream mb-2">
                No Invoices Yet
              </h3>
              <p className="text-text-secondary">
                Your invoices will appear here once you have an active subscription.
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default BillingDashboard;