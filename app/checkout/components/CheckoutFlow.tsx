/**
 * EPIC 5 STORY 5.4: Multi-step Checkout Flow Component
 * Orchestrates the complete checkout process with state management
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert } from '@/components/ui/alert';
import { PaymentMethodSelector, PaymentForm } from '@/components/payments';
import type { PlanDetails } from '@/components/payments';
import { cn } from '@/lib/utils';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export interface CheckoutFlowProps {
  plan: PlanDetails;
  onSuccess?: (data: any) => void;
  onCancel?: () => void;
  className?: string;
}

export interface CheckoutState {
  currentStep: 'method' | 'payment' | 'processing' | 'complete';
  paymentMethod: string | null;
  clientSecret: string | null;
  customerInfo: {
    email?: string;
    name?: string;
    phone?: string;
  };
  billingAddress: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  errors: string[];
  processing: boolean;
}

const initialState: CheckoutState = {
  currentStep: 'method',
  paymentMethod: null,
  clientSecret: null,
  customerInfo: {},
  billingAddress: {},
  errors: [],
  processing: false,
};

export function CheckoutFlow({
  plan,
  onSuccess,
  onCancel,
  className,
}: CheckoutFlowProps) {
  const router = useRouter();
  const [state, setState] = useState<CheckoutState>(initialState);

  // Calculate totals
  const subtotal = plan.price;
  const tax = Math.round(subtotal * 0.08); // 8% tax
  const total = plan.trial_days ? tax : subtotal + tax; // Only tax during trial

  const formatAmount = useCallback((amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  }, []);

  const updateState = useCallback((updates: Partial<CheckoutState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const addError = useCallback((error: string) => {
    setState(prev => ({
      ...prev,
      errors: [...prev.errors.filter(e => e !== error), error]
    }));
  }, []);

  const clearErrors = useCallback(() => {
    setState(prev => ({ ...prev, errors: [] }));
  }, []);

  // Initialize payment intent when payment method is selected
  useEffect(() => {
    if (state.currentStep === 'payment' && state.paymentMethod && !state.clientSecret) {
      initializePayment();
    }
  }, [state.currentStep, state.paymentMethod, state.clientSecret]);

  const initializePayment = async () => {
    updateState({ processing: true });
    clearErrors();

    try {
      const response = await fetch('/api/payments/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: total,
          currency: plan.currency,
          planId: plan.id,
          paymentMethodType: state.paymentMethod,
          customerInfo: state.customerInfo,
          metadata: {
            plan_id: plan.id,
            plan_name: plan.name,
            trial_days: plan.trial_days,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to initialize payment');
      }

      const data = await response.json();
      updateState({ 
        clientSecret: data.clientSecret,
        processing: false
      });

    } catch (error: any) {
      console.error('Payment initialization error:', error);
      addError(error.message || 'Failed to initialize payment');
      updateState({ processing: false });
    }
  };

  const handlePaymentMethodSelect = (methodId: string) => {
    updateState({ paymentMethod: methodId });
  };

  const proceedToPayment = () => {
    if (!state.paymentMethod) {
      addError('Please select a payment method');
      return;
    }
    
    clearErrors();
    updateState({ currentStep: 'payment' });
  };

  const handlePaymentSuccess = (paymentIntent: any) => {
    updateState({ 
      currentStep: 'complete',
      processing: false 
    });

    // Call success callback
    onSuccess?.({
      paymentIntent,
      plan,
      total,
      paymentMethod: state.paymentMethod,
      customerInfo: state.customerInfo,
    });
  };

  const handlePaymentError = (error: any) => {
    addError(error.message || 'Payment failed');
    updateState({ processing: false });
  };

  const handleBackToMethod = () => {
    updateState({ 
      currentStep: 'method',
      clientSecret: null,
      processing: false
    });
    clearErrors();
  };

  const getStepProgress = () => {
    switch (state.currentStep) {
      case 'method':
        return 25;
      case 'payment':
        return 50;
      case 'processing':
        return 75;
      case 'complete':
        return 100;
      default:
        return 0;
    }
  };

  return (
    <div className={cn("checkout-flow max-w-4xl mx-auto", className)}>
      {/* Progress Header */}
      <div className="checkout-header mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-cream">
            Complete Your Purchase
          </h1>
          <div className="text-right">
            <div className="text-sm text-text-secondary">Total</div>
            <div className="text-xl font-bold text-gold-primary">
              {plan.trial_days ? 
                `${formatAmount(total, plan.currency)} today` :
                formatAmount(total, plan.currency)
              }
            </div>
          </div>
        </div>
        
        <Progress value={getStepProgress()} className="h-2" />
        
        <div className="flex justify-between mt-2 text-sm">
          <span className={cn(
            "transition-colors",
            state.currentStep === 'method' ? "text-gold-primary font-medium" : "text-text-secondary"
          )}>
            Payment Method
          </span>
          <span className={cn(
            "transition-colors",
            state.currentStep === 'payment' ? "text-gold-primary font-medium" : "text-text-secondary"
          )}>
            Payment Details
          </span>
          <span className={cn(
            "transition-colors",
            state.currentStep === 'complete' ? "text-gold-primary font-medium" : "text-text-secondary"
          )}>
            Complete
          </span>
        </div>
      </div>

      <div className="checkout-content grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="checkout-main lg:col-span-2">
          {/* Error Alerts */}
          {state.errors.length > 0 && (
            <div className="errors-container mb-6 space-y-2">
              {state.errors.map((error, index) => (
                <Alert key={index} variant="destructive">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>{error}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setState(prev => ({
                        ...prev,
                        errors: prev.errors.filter((_, i) => i !== index)
                      }));
                    }}
                    className="ml-auto"
                  >
                    ×
                  </Button>
                </Alert>
              ))}
            </div>
          )}

          {/* Step Content */}
          {state.currentStep === 'method' && (
            <Card className="p-6">
              <PaymentMethodSelector
                selectedMethod={state.paymentMethod || undefined}
                onMethodSelect={handlePaymentMethodSelect}
                amount={total}
                currency={plan.currency}
                showEnterpriseMethods={plan.id === 'enterprise'}
              />
              
              <div className="flex justify-between mt-6 pt-6 border-t border-border">
                <Button 
                  variant="outline" 
                  onClick={onCancel}
                  disabled={state.processing}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={proceedToPayment}
                  disabled={!state.paymentMethod || state.processing}
                  className="bg-gradient-premium"
                >
                  {state.processing ? (
                    <div className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Setting up...</span>
                    </div>
                  ) : (
                    'Continue to Payment'
                  )}
                </Button>
              </div>
            </Card>
          )}

          {state.currentStep === 'payment' && state.clientSecret && (
            <Elements stripe={stripePromise} options={{ clientSecret: state.clientSecret }}>
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBackToMethod}
                    className="px-0 text-gold-primary hover:text-gold-secondary"
                  >
                    ← Back to Payment Methods
                  </Button>
                </div>
                
                <PaymentForm
                  clientSecret={state.clientSecret}
                  amount={total}
                  currency={plan.currency}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                  onProcessing={(processing) => updateState({ processing })}
                  showBillingAddress={true}
                  showPaymentMethodSave={true}
                />
              </div>
            </Elements>
          )}

          {state.currentStep === 'complete' && (
            <Card className="p-8 text-center">
              <div className="success-animation mb-6">
                <div className="w-20 h-20 mx-auto bg-sage rounded-full flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-cream mb-4">
                🎉 Payment Successful!
              </h2>
              <p className="text-text-secondary mb-6">
                Your subscription to {plan.name} is now active.
              </p>
              
              {plan.trial_days && (
                <Alert className="mb-6 bg-sage/20 border-sage/30">
                  <div className="flex items-center gap-2 text-sage">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Your {plan.trial_days}-day free trial has started!</span>
                  </div>
                </Alert>
              )}
              
              <div className="actions space-y-3">
                <Button 
                  className="w-full bg-gradient-premium" 
                  onClick={() => router.push('/dashboard')}
                >
                  Go to Dashboard
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => router.push('/checkout/success?plan=' + plan.id)}
                >
                  View Receipt
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar - Order Summary */}
        <div className="checkout-sidebar">
          <Card className="p-6 sticky top-6">
            <h3 className="text-lg font-semibold text-cream mb-4">
              Order Summary
            </h3>
            
            {/* Plan Details */}
            <div className="plan-summary mb-6 p-4 bg-gradient-to-br from-gold-primary/10 to-gold-secondary/5 border border-gold-primary/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-cream">{plan.name} Plan</h4>
                {plan.popular && (
                  <span className="text-xs bg-gold-primary/20 text-gold-primary px-2 py-1 rounded-full">
                    Popular
                  </span>
                )}
              </div>
              
              <div className="text-sm text-text-secondary mb-3">
                Billed {plan.interval}ly
              </div>
              
              {plan.trial_days && (
                <div className="trial-badge mb-3 p-2 bg-sage/20 border border-sage/30 rounded text-center">
                  <span className="text-sage text-sm font-medium">
                    🆓 {plan.trial_days}-Day Free Trial
                  </span>
                </div>
              )}
            </div>

            {/* Pricing Breakdown */}
            <div className="pricing-breakdown space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">
                  {plan.name} ({plan.interval}ly)
                </span>
                <span className="text-cream">
                  {formatAmount(subtotal, plan.currency)}
                </span>
              </div>
              
              {plan.trial_days && (
                <div className="flex justify-between text-sm">
                  <span className="text-sage">
                    Trial discount
                  </span>
                  <span className="text-sage">
                    -{formatAmount(subtotal, plan.currency)}
                  </span>
                </div>
              )}
              
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Tax</span>
                <span className="text-cream">
                  {formatAmount(tax, plan.currency)}
                </span>
              </div>
              
              <div className="border-t border-border pt-3">
                <div className="flex justify-between">
                  <span className="font-semibold text-cream">
                    {plan.trial_days ? 'Due Today' : 'Total'}
                  </span>
                  <span className="font-bold text-xl text-gold-primary">
                    {formatAmount(total, plan.currency)}
                  </span>
                </div>
                {plan.trial_days && (
                  <p className="text-xs text-text-muted mt-1">
                    Then {formatAmount(subtotal + tax, plan.currency)} per {plan.interval}
                  </p>
                )}
              </div>
            </div>

            {/* Security & Trust */}
            <div className="security-section space-y-3 text-xs text-text-muted">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-sage" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                <span>256-bit SSL encryption</span>
              </div>
              
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-sage" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>30-day money-back guarantee</span>
              </div>
              
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-sage" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v2H4V6zm0 4h12v4H4v-4z" />
                </svg>
                <span>Cancel anytime</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default CheckoutFlow;