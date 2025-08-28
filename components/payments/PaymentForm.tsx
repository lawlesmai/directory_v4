/**
 * EPIC 5 STORY 5.4: Payment UI Components - Secure Payment Form
 * Stripe Elements integration with real-time validation and PCI compliance
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { 
  useStripe, 
  useElements, 
  CardElement,
  PaymentElement,
  ElementsConsumer 
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface PaymentFormProps {
  clientSecret: string;
  onSuccess?: (paymentIntent: any) => void;
  onError?: (error: any) => void;
  onProcessing?: (processing: boolean) => void;
  amount: number;
  currency?: string;
  showBillingAddress?: boolean;
  showPaymentMethodSave?: boolean;
  className?: string;
}

export interface BillingAddress {
  name: string;
  email: string;
  phone?: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
}

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#E9D8A6',
      fontFamily: 'var(--font-inter), Inter, -apple-system, sans-serif',
      fontSmoothing: 'antialiased',
      '::placeholder': {
        color: 'rgba(233, 216, 166, 0.7)',
      },
      backgroundColor: 'rgba(0, 95, 115, 0.3)',
    },
    invalid: {
      color: '#BB3E03',
      iconColor: '#BB3E03',
    },
    complete: {
      color: '#94D2BD',
      iconColor: '#94D2BD',
    },
  },
  hidePostalCode: false,
  iconStyle: 'solid' as const,
};

export function PaymentForm({
  clientSecret,
  onSuccess,
  onError,
  onProcessing,
  amount,
  currency = 'USD',
  showBillingAddress = true,
  showPaymentMethodSave = true,
  className,
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [savePaymentMethod, setSavePaymentMethod] = useState(false);
  const [billingAddress, setBillingAddress] = useState<BillingAddress>({
    name: '',
    email: '',
    phone: '',
    address: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'US',
    },
  });

  // Format amount for display
  const formatAmount = useCallback((amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  }, []);

  // Handle card element changes
  const handleCardChange = useCallback((event: any) => {
    setError(event.error ? event.error.message : null);
    setCardComplete(event.complete);
  }, []);

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!stripe || !elements) {
      setError('Payment system not loaded. Please refresh and try again.');
      return;
    }

    if (!cardComplete) {
      setError('Please complete your card information.');
      return;
    }

    if (showBillingAddress && (!billingAddress.name || !billingAddress.email)) {
      setError('Please complete the billing information.');
      return;
    }

    setProcessing(true);
    setError(null);
    onProcessing?.(true);

    try {
      const cardElement = elements.getElement(CardElement);
      
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      // Confirm payment with billing details
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: showBillingAddress ? {
              name: billingAddress.name,
              email: billingAddress.email,
              phone: billingAddress.phone,
              address: billingAddress.address,
            } : undefined,
          },
          setup_future_usage: savePaymentMethod ? 'off_session' : undefined,
        }
      );

      if (confirmError) {
        throw confirmError;
      }

      if (paymentIntent?.status === 'succeeded') {
        onSuccess?.(paymentIntent);
      } else {
        throw new Error('Payment was not successful');
      }

    } catch (err: any) {
      console.error('Payment error:', err);
      const errorMessage = err.message || 'An unexpected error occurred during payment processing.';
      setError(errorMessage);
      onError?.(err);
    } finally {
      setProcessing(false);
      onProcessing?.(false);
    }
  };

  // Handle billing address changes
  const handleBillingAddressChange = (field: string, value: string) => {
    if (field.startsWith('address.')) {
      const addressField = field.replace('address.', '');
      setBillingAddress(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value,
        },
      }));
    } else {
      setBillingAddress(prev => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  return (
    <Card className={cn("payment-form-container", className)}>
      <div className="payment-form-header p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-cream">
            Complete Your Payment
          </h3>
          <div className="text-2xl font-bold text-gold-primary">
            {formatAmount(amount, currency)}
          </div>
        </div>
        
        {/* Security badges */}
        <div className="flex items-center gap-3 mt-4 text-sm text-text-secondary">
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4 text-sage" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span>Secured by Stripe</span>
          </div>
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4 text-sage" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>PCI Compliant</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          </Alert>
        )}

        {/* Billing Address */}
        {showBillingAddress && (
          <div className="billing-address-section space-y-4">
            <h4 className="text-lg font-medium text-cream flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" />
              </svg>
              Billing Information
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="billing-name">Full Name *</Label>
                <Input
                  id="billing-name"
                  type="text"
                  value={billingAddress.name}
                  onChange={(e) => handleBillingAddressChange('name', e.target.value)}
                  placeholder="John Doe"
                  required
                  className="bg-teal-20 border-border text-cream placeholder:text-text-muted"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="billing-email">Email Address *</Label>
                <Input
                  id="billing-email"
                  type="email"
                  value={billingAddress.email}
                  onChange={(e) => handleBillingAddressChange('email', e.target.value)}
                  placeholder="john@example.com"
                  required
                  className="bg-teal-20 border-border text-cream placeholder:text-text-muted"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="billing-address-line1">Street Address *</Label>
              <Input
                id="billing-address-line1"
                type="text"
                value={billingAddress.address.line1}
                onChange={(e) => handleBillingAddressChange('address.line1', e.target.value)}
                placeholder="123 Main Street"
                required
                className="bg-teal-20 border-border text-cream placeholder:text-text-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="billing-address-line2">Apt, Suite, etc. (Optional)</Label>
              <Input
                id="billing-address-line2"
                type="text"
                value={billingAddress.address.line2}
                onChange={(e) => handleBillingAddressChange('address.line2', e.target.value)}
                placeholder="Apt 4B"
                className="bg-teal-20 border-border text-cream placeholder:text-text-muted"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="billing-city">City *</Label>
                <Input
                  id="billing-city"
                  type="text"
                  value={billingAddress.address.city}
                  onChange={(e) => handleBillingAddressChange('address.city', e.target.value)}
                  placeholder="New York"
                  required
                  className="bg-teal-20 border-border text-cream placeholder:text-text-muted"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="billing-state">State *</Label>
                <Input
                  id="billing-state"
                  type="text"
                  value={billingAddress.address.state}
                  onChange={(e) => handleBillingAddressChange('address.state', e.target.value)}
                  placeholder="NY"
                  required
                  className="bg-teal-20 border-border text-cream placeholder:text-text-muted"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="billing-postal-code">ZIP Code *</Label>
                <Input
                  id="billing-postal-code"
                  type="text"
                  value={billingAddress.address.postal_code}
                  onChange={(e) => handleBillingAddressChange('address.postal_code', e.target.value)}
                  placeholder="10001"
                  required
                  className="bg-teal-20 border-border text-cream placeholder:text-text-muted"
                />
              </div>
            </div>
          </div>
        )}

        {/* Card Element */}
        <div className="card-section space-y-4">
          <h4 className="text-lg font-medium text-cream flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v2H4V6zm0 4h12v4H4v-4z" />
            </svg>
            Payment Method
          </h4>
          
          <div className="card-element-container p-4 border border-border rounded-lg bg-teal-20">
            <CardElement
              options={CARD_ELEMENT_OPTIONS}
              onChange={handleCardChange}
            />
          </div>
          
          {/* Accepted payment methods */}
          <div className="flex items-center gap-3 text-sm text-text-secondary">
            <span>We accept:</span>
            <div className="flex gap-2">
              <div className="payment-method-icon">💳 Visa</div>
              <div className="payment-method-icon">💳 Mastercard</div>
              <div className="payment-method-icon">💳 Amex</div>
              <div className="payment-method-icon">💳 Discover</div>
            </div>
          </div>
        </div>

        {/* Save Payment Method */}
        {showPaymentMethodSave && (
          <div className="save-payment-method">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={savePaymentMethod}
                onChange={(e) => setSavePaymentMethod(e.target.checked)}
                className="w-4 h-4 text-gold-primary bg-teal-20 border-border rounded focus:ring-gold-primary focus:ring-2"
              />
              <span className="text-sm text-text-secondary">
                Save payment method for future purchases
              </span>
            </label>
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={!stripe || processing || !cardComplete}
          className="w-full h-12 text-lg font-semibold bg-gradient-premium hover:shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? (
            <div className="flex items-center gap-2">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Processing Payment...</span>
            </div>
          ) : (
            <span>Pay {formatAmount(amount, currency)}</span>
          )}
        </Button>

        {/* Trust indicators */}
        <div className="trust-indicators text-center text-xs text-text-muted space-y-2">
          <div className="flex items-center justify-center gap-4">
            <span>🔒 256-bit SSL Encryption</span>
            <span>🛡️ PCI DSS Compliant</span>
            <span>✅ Money-Back Guarantee</span>
          </div>
          <p>
            Your payment information is secure and encrypted. 
            We never store your card details on our servers.
          </p>
        </div>
      </form>
    </Card>
  );
}

export default PaymentForm;