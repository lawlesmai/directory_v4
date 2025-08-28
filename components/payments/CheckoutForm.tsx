/**
 * EPIC 5 STORY 5.4: Complete Checkout Flow
 * Multi-step checkout process with progress indicators and trust badges
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert } from '@/components/ui/alert';
import PaymentMethodSelector from './PaymentMethodSelector';
import PaymentForm from './PaymentForm';
import { cn } from '@/lib/utils';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export interface CheckoutStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  current: boolean;
}

export interface PlanDetails {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  popular?: boolean;
  trial_days?: number;
}

export interface CheckoutFormProps {
  plan: PlanDetails;
  onSuccess?: (data: any) => void;
  onCancel?: () => void;
  onStepChange?: (step: string) => void;
  showGuestCheckout?: boolean;
  className?: string;
}

const CHECKOUT_STEPS: CheckoutStep[] = [
  {
    id: 'plan',
    title: 'Plan Selection',
    description: 'Choose your subscription',
    completed: false,
    current: false,
  },
  {
    id: 'method',
    title: 'Payment Method',
    description: 'Select how to pay',
    completed: false,
    current: false,
  },
  {
    id: 'details',
    title: 'Payment Details',
    description: 'Complete your payment',
    completed: false,
    current: false,
  },
  {
    id: 'confirmation',
    title: 'Confirmation',
    description: 'Order complete',
    completed: false,
    current: false,
  },
];

export function CheckoutForm({
  plan,
  onSuccess,
  onCancel,
  onStepChange,
  showGuestCheckout = true,
  className,
}: CheckoutFormProps) {
  const [currentStep, setCurrentStep] = useState('method');
  const [steps, setSteps] = useState<CheckoutStep[]>(
    CHECKOUT_STEPS.map(step => ({
      ...step,
      completed: step.id === 'plan',
      current: step.id === 'method',
    }))
  );
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('card');
  const [clientSecret, setClientSecret] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate totals
  const subtotal = plan.price;
  const tax = Math.round(subtotal * 0.08); // 8% tax example
  const total = subtotal + tax;

  // Format currency
  const formatAmount = useCallback((amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  }, []);

  // Initialize payment intent
  useEffect(() => {
    if (currentStep === 'details' && selectedPaymentMethod) {
      initializePayment();
    }
  }, [currentStep, selectedPaymentMethod]);

  const initializePayment = async () => {
    try {
      setProcessing(true);
      setError(null);

      const response = await fetch('/api/payments/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: total,
          currency: plan.currency,
          planId: plan.id,
          paymentMethodType: selectedPaymentMethod,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to initialize payment');
      }

      const data = await response.json();
      setClientSecret(data.clientSecret);
    } catch (err: any) {
      console.error('Payment initialization error:', err);
      setError(err.message || 'Failed to initialize payment');
    } finally {
      setProcessing(false);
    }
  };

  // Step navigation
  const goToStep = (stepId: string) => {
    if (stepId === 'plan') return; // Plan already selected
    
    const stepIndex = CHECKOUT_STEPS.findIndex(step => step.id === stepId);
    const currentStepIndex = CHECKOUT_STEPS.findIndex(step => step.id === currentStep);
    
    // Only allow moving forward or to completed steps
    if (stepIndex <= currentStepIndex + 1) {
      setCurrentStep(stepId);
      updateSteps(stepId);
      onStepChange?.(stepId);
    }
  };

  const updateSteps = (newCurrentStep: string) => {
    const newSteps = CHECKOUT_STEPS.map(step => {
      const stepIndex = CHECKOUT_STEPS.findIndex(s => s.id === step.id);
      const currentStepIndex = CHECKOUT_STEPS.findIndex(s => s.id === newCurrentStep);
      
      return {
        ...step,
        completed: stepIndex < currentStepIndex || step.id === 'plan',
        current: step.id === newCurrentStep,
      };
    });
    
    setSteps(newSteps);
  };

  const handlePaymentMethodSelect = (methodId: string) => {
    setSelectedPaymentMethod(methodId);
  };

  const proceedToPayment = () => {
    if (!selectedPaymentMethod) {
      setError('Please select a payment method');
      return;
    }
    goToStep('details');
  };

  const handlePaymentSuccess = (paymentIntent: any) => {
    goToStep('confirmation');
    onSuccess?.({
      paymentIntent,
      plan,
      total,
      paymentMethod: selectedPaymentMethod,
    });
  };

  const handlePaymentError = (error: any) => {
    setError(error.message || 'Payment failed');
    console.error('Payment error:', error);
  };

  const calculateProgress = () => {
    const completedSteps = steps.filter(step => step.completed).length;
    const currentStepWeight = 0.5; // Give partial credit for current step
    return ((completedSteps + currentStepWeight) / steps.length) * 100;
  };

  return (
    <div className={cn("checkout-form max-w-4xl mx-auto", className)}>
      {/* Progress Header */}
      <div className="progress-header mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-cream">Complete Your Purchase</h1>
          <Badge variant="outline" className="border-gold-primary text-gold-primary">
            {plan.popular && '🔥 Most Popular'}
          </Badge>
        </div>
        
        {/* Progress Bar */}
        <div className="progress-section mb-6">
          <Progress value={calculateProgress()} className="h-2 mb-4" />
          
          <div className="grid grid-cols-4 gap-4">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  "step-item text-center cursor-pointer transition-all duration-200",
                  step.completed && "opacity-60",
                  step.current && "transform scale-105"
                )}
                onClick={() => goToStep(step.id)}
              >
                <div className={cn(
                  "step-indicator w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-sm font-semibold transition-colors",
                  step.completed 
                    ? "bg-sage text-navy-dark" 
                    : step.current 
                    ? "bg-gold-primary text-navy-dark" 
                    : "bg-teal-20 text-text-secondary border border-border"
                )}>
                  {step.completed ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                
                <div className={cn(
                  "step-label",
                  step.current ? "text-gold-primary" : "text-text-secondary"
                )}>
                  <div className="font-medium text-xs">{step.title}</div>
                  <div className="text-xs opacity-70">{step.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="checkout-content grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="checkout-main lg:col-span-2">
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

          {/* Step Content */}
          {currentStep === 'method' && (
            <Card className="p-6">
              <PaymentMethodSelector
                selectedMethod={selectedPaymentMethod}
                onMethodSelect={handlePaymentMethodSelect}
                amount={total}
                currency={plan.currency}
              />
              
              <div className="flex justify-between mt-6 pt-6 border-t border-border">
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button onClick={proceedToPayment} className="bg-gradient-premium">
                  Continue to Payment
                </Button>
              </div>
            </Card>
          )}

          {currentStep === 'details' && clientSecret && (
            <Elements stripe={stripePromise}>
              <PaymentForm
                clientSecret={clientSecret}
                amount={total}
                currency={plan.currency}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                onProcessing={setProcessing}
                showBillingAddress={true}
                showPaymentMethodSave={true}
              />
            </Elements>
          )}

          {currentStep === 'confirmation' && (
            <Card className="p-8 text-center">
              <div className="success-animation mb-6">
                <div className="w-16 h-16 mx-auto bg-sage rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-cream mb-2">
                Payment Successful! 🎉
              </h2>
              <p className="text-text-secondary mb-6">
                Welcome to {plan.name}! Your subscription is now active.
              </p>
              
              {plan.trial_days && (
                <div className="trial-info mb-6 p-4 bg-gold-primary/10 border border-gold-primary/30 rounded-lg">
                  <p className="text-gold-primary">
                    🆓 Your {plan.trial_days}-day free trial starts now!
                  </p>
                  <p className="text-sm text-text-secondary mt-1">
                    You won't be charged until your trial ends.
                  </p>
                </div>
              )}
              
              <div className="actions space-y-3">
                <Button className="w-full bg-gradient-premium">
                  Access Your Dashboard
                </Button>
                <Button variant="outline" className="w-full">
                  Download Receipt
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
            
            {/* Selected Plan */}
            <div className="plan-summary mb-6 p-4 bg-teal-20/30 rounded-lg border border-border">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-cream">{plan.name}</h4>
                {plan.popular && (
                  <Badge variant="secondary" className="text-xs bg-gold-primary/20 text-gold-primary">
                    Popular
                  </Badge>
                )}
              </div>
              
              <div className="text-sm text-text-secondary mb-3">
                Billed {plan.interval}ly
              </div>
              
              <div className="features space-y-1">
                {plan.features.slice(0, 3).map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-text-secondary">
                    <svg className="w-3 h-3 text-sage flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>{feature}</span>
                  </div>
                ))}
                {plan.features.length > 3 && (
                  <div className="text-xs text-text-muted">
                    +{plan.features.length - 3} more features
                  </div>
                )}
              </div>
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
                    {plan.trial_days}-day free trial
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
                  <span className="font-semibold text-cream">Total</span>
                  <span className="font-bold text-xl text-gold-primary">
                    {plan.trial_days ? 
                      `${formatAmount(tax, plan.currency)} today` : 
                      formatAmount(total, plan.currency)
                    }
                  </span>
                </div>
                {plan.trial_days && (
                  <p className="text-xs text-text-muted mt-1">
                    Then {formatAmount(total, plan.currency)} per {plan.interval}
                  </p>
                )}
              </div>
            </div>

            {/* Trust Indicators */}
            <div className="trust-indicators space-y-3 text-xs text-text-muted">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-sage" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                <span>Secured with 256-bit SSL encryption</span>
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
                <span>Cancel anytime, no long-term contracts</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default CheckoutForm;