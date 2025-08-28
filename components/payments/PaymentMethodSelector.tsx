/**
 * EPIC 5 STORY 5.4: Payment Method Selector
 * Multiple payment method options with Apple Pay, Google Pay, PayPal integration
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface PaymentMethod {
  id: string;
  type: 'card' | 'apple_pay' | 'google_pay' | 'paypal' | 'ach' | 'bank_transfer';
  name: string;
  description?: string;
  icon: React.ReactNode;
  available: boolean;
  fees?: string;
  processingTime?: string;
  recommended?: boolean;
  enterprise?: boolean;
}

export interface PaymentMethodSelectorProps {
  selectedMethod?: string;
  onMethodSelect: (methodId: string) => void;
  showEnterpriseMethods?: boolean;
  amount?: number;
  currency?: string;
  className?: string;
}

const PaymentMethods: PaymentMethod[] = [
  {
    id: 'card',
    type: 'card',
    name: 'Credit or Debit Card',
    description: 'Visa, Mastercard, American Express, Discover',
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
      </svg>
    ),
    available: true,
    fees: '2.9% + 30¢',
    processingTime: 'Instant',
    recommended: true,
  },
  {
    id: 'apple_pay',
    type: 'apple_pay',
    name: 'Apple Pay',
    description: 'Touch ID or Face ID',
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
      </svg>
    ),
    available: typeof window !== 'undefined' && 'ApplePaySession' in window,
    fees: '2.9% + 30¢',
    processingTime: 'Instant',
  },
  {
    id: 'google_pay',
    type: 'google_pay',
    name: 'Google Pay',
    description: 'Fast and secure',
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
    available: typeof window !== 'undefined' && 'google' in window,
    fees: '2.9% + 30¢',
    processingTime: 'Instant',
  },
  {
    id: 'paypal',
    type: 'paypal',
    name: 'PayPal',
    description: 'Pay with your PayPal account',
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.26-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.75.75 0 0 0-.741.63L7.29 19.288c-.045.283.207.52.486.52h4.92a.624.624 0 0 0 .615-.536l.072-.45 1.35-8.58.086-.553a.624.624 0 0 1 .615-.536h2.42c2.282 0 4.058-.835 4.58-3.252.218-.991.055-1.82-.615-2.404z"/>
      </svg>
    ),
    available: true,
    fees: '3.49% + 49¢',
    processingTime: 'Instant',
  },
  {
    id: 'ach',
    type: 'ach',
    name: 'Bank Transfer (ACH)',
    description: 'Direct bank account transfer',
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M11.5 1L2 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9.5-5z"/>
        <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm-1.5 8L9 13.5l1.41-1.41L12 13.67l3.18-3.18L16.59 12 11.5 15z" fill="white"/>
      </svg>
    ),
    available: true,
    fees: '0.8% (max $5)',
    processingTime: '1-3 business days',
    enterprise: true,
  },
  {
    id: 'wire_transfer',
    type: 'bank_transfer',
    name: 'Wire Transfer',
    description: 'For large enterprise payments',
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
    ),
    available: true,
    fees: 'Custom rates',
    processingTime: '1-2 business days',
    enterprise: true,
  },
];

export function PaymentMethodSelector({
  selectedMethod,
  onMethodSelect,
  showEnterpriseMethods = false,
  amount = 0,
  currency = 'USD',
  className,
}: PaymentMethodSelectorProps) {
  const [availableMethods, setAvailableMethods] = useState<PaymentMethod[]>([]);

  useEffect(() => {
    // Filter methods based on availability and enterprise settings
    const filtered = PaymentMethods.filter(method => {
      if (!method.available) return false;
      if (method.enterprise && !showEnterpriseMethods) return false;
      return true;
    });
    
    setAvailableMethods(filtered);
  }, [showEnterpriseMethods]);

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const calculateFee = (method: PaymentMethod, amount: number): string => {
    if (!method.fees || method.fees === 'Custom rates') return method.fees || '';
    
    // Parse percentage and fixed fee
    const feeMatch = method.fees.match(/([0-9.]+)%.*?([0-9.]+)¢/);
    if (feeMatch) {
      const percentage = parseFloat(feeMatch[1]) / 100;
      const fixedFee = parseFloat(feeMatch[2]);
      const totalFee = (amount * percentage) + fixedFee;
      return `$${(totalFee / 100).toFixed(2)}`;
    }
    
    // Parse percentage only (ACH)
    const percentMatch = method.fees.match(/([0-9.]+)%/);
    if (percentMatch) {
      const percentage = parseFloat(percentMatch[1]) / 100;
      const maxMatch = method.fees.match(/max \$([0-9.]+)/);
      const maxFee = maxMatch ? parseFloat(maxMatch[1]) * 100 : Infinity;
      const fee = Math.min(amount * percentage, maxFee);
      return `$${(fee / 100).toFixed(2)}`;
    }
    
    return method.fees;
  };

  return (
    <div className={cn("payment-method-selector space-y-4", className)}>
      <div className="header">
        <h3 className="text-lg font-semibold text-cream mb-2">
          Choose Payment Method
        </h3>
        {amount > 0 && (
          <p className="text-sm text-text-secondary">
            Total: {formatAmount(amount, currency)}
          </p>
        )}
      </div>

      <div className="payment-methods grid gap-3">
        {availableMethods.map((method) => {
          const isSelected = selectedMethod === method.id;
          const fee = amount > 0 ? calculateFee(method, amount) : method.fees;
          
          return (
            <Card
              key={method.id}
              className={cn(
                "payment-method-card p-4 cursor-pointer transition-all duration-200 border-2",
                isSelected
                  ? "border-gold-primary bg-gradient-to-br from-gold-primary/10 to-gold-secondary/5 shadow-glow"
                  : "border-border bg-teal-20/50 hover:border-sage hover:bg-teal-20",
                !method.available && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => method.available && onMethodSelect(method.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  {/* Payment method icon */}
                  <div className={cn(
                    "payment-method-icon p-2 rounded-lg flex-shrink-0",
                    isSelected ? "bg-gold-primary/20 text-gold-primary" : "bg-teal-secondary/20 text-teal-secondary"
                  )}>
                    {method.icon}
                  </div>
                  
                  {/* Payment method details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className={cn(
                        "font-medium",
                        isSelected ? "text-gold-primary" : "text-cream"
                      )}>
                        {method.name}
                      </h4>
                      
                      {/* Badges */}
                      <div className="flex gap-1">
                        {method.recommended && (
                          <Badge variant="secondary" className="text-xs bg-sage/20 text-sage border-sage/30">
                            Recommended
                          </Badge>
                        )}
                        {method.enterprise && (
                          <Badge variant="outline" className="text-xs border-gold-primary/30 text-gold-primary">
                            Enterprise
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {method.description && (
                      <p className="text-sm text-text-secondary mb-2">
                        {method.description}
                      </p>
                    )}
                    
                    {/* Payment method details */}
                    <div className="payment-method-details space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-text-muted">Processing Time:</span>
                        <span className="text-text-secondary">{method.processingTime}</span>
                      </div>
                      
                      {fee && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-text-muted">
                            {amount > 0 ? 'Fee:' : 'Rate:'}
                          </span>
                          <span className={cn(
                            "font-medium",
                            amount > 0 && fee.startsWith('$') ? "text-gold-primary" : "text-text-secondary"
                          )}>
                            {fee}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Selection indicator */}
                <div className={cn(
                  "selection-indicator w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                  isSelected 
                    ? "border-gold-primary bg-gold-primary" 
                    : "border-border bg-transparent"
                )}>
                  {isSelected && (
                    <svg className="w-3 h-3 text-navy-dark" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Express payment buttons for Apple Pay / Google Pay */}
              {isSelected && (method.type === 'apple_pay' || method.type === 'google_pay') && (
                <div className="mt-4 pt-4 border-t border-border">
                  <Button
                    className={cn(
                      "w-full h-10 font-medium rounded-lg",
                      method.type === 'apple_pay' 
                        ? "bg-black text-white hover:bg-gray-800" 
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    )}
                  >
                    {method.type === 'apple_pay' ? '🍎 Pay with Apple Pay' : '🔵 Pay with Google Pay'}
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Enterprise payment methods info */}
      {!showEnterpriseMethods && (
        <div className="enterprise-info p-4 bg-teal-20/30 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-gold-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="font-medium text-cream">Need enterprise payment options?</h4>
              <p className="text-sm text-text-secondary">
                Contact sales for ACH, wire transfers, and custom billing terms.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Security notice */}
      <div className="security-notice text-center text-xs text-text-muted space-y-1 pt-4 border-t border-border">
        <div className="flex items-center justify-center gap-4">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            256-bit SSL
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            PCI Compliant
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Secured by Stripe
          </span>
        </div>
        <p>All payments are processed securely. We never store your payment information.</p>
      </div>
    </div>
  );
}

export default PaymentMethodSelector;