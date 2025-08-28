/**
 * EPIC 5 STORY 5.4: Payment Method Display
 * Secure display of saved payment methods with masked details
 */

'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export interface SavedPaymentMethod {
  id: string;
  type: 'card' | 'bank_account' | 'paypal';
  isDefault: boolean;
  // Card details (masked)
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  // Bank account details (masked)
  bankName?: string;
  accountLast4?: string;
  accountType?: 'checking' | 'savings';
  // PayPal details
  paypalEmail?: string;
  // Common fields
  billingDetails?: {
    name?: string;
    email?: string;
    address?: {
      city?: string;
      state?: string;
      country?: string;
    };
  };
  createdAt: string;
  lastUsed?: string;
  status: 'active' | 'expired' | 'requires_action';
}

export interface PaymentMethodDisplayProps {
  paymentMethods: SavedPaymentMethod[];
  selectedMethodId?: string;
  onSelect?: (methodId: string) => void;
  onSetDefault?: (methodId: string) => void;
  onDelete?: (methodId: string) => void;
  onEdit?: (methodId: string) => void;
  onAddNew?: () => void;
  showActions?: boolean;
  selectable?: boolean;
  className?: string;
}

const getCardIcon = (brand: string) => {
  switch (brand.toLowerCase()) {
    case 'visa':
      return '💳';
    case 'mastercard':
      return '💳';
    case 'amex':
    case 'american_express':
      return '💎';
    case 'discover':
      return '💳';
    case 'diners':
      return '💳';
    case 'jcb':
      return '💳';
    default:
      return '💳';
  }
};

const getBankIcon = (accountType: string) => {
  return accountType === 'savings' ? '🏦' : '🏛️';
};

const formatCardBrand = (brand: string) => {
  const brandMap: Record<string, string> = {
    'amex': 'American Express',
    'diners': 'Diners Club',
    'jcb': 'JCB',
    'unionpay': 'UnionPay',
  };
  return brandMap[brand.toLowerCase()] || brand.charAt(0).toUpperCase() + brand.slice(1);
};

const formatExpiryDate = (month: number, year: number) => {
  return `${month.toString().padStart(2, '0')}/${year.toString().slice(-2)}`;
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'text-sage';
    case 'expired':
      return 'text-red-warning';
    case 'requires_action':
      return 'text-gold-primary';
    default:
      return 'text-text-secondary';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'active':
      return 'Active';
    case 'expired':
      return 'Expired';
    case 'requires_action':
      return 'Action Required';
    default:
      return status;
  }
};

export function PaymentMethodDisplay({
  paymentMethods,
  selectedMethodId,
  onSelect,
  onSetDefault,
  onDelete,
  onEdit,
  onAddNew,
  showActions = true,
  selectable = false,
  className,
}: PaymentMethodDisplayProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (action: string, methodId: string, callback?: (id: string) => void) => {
    if (!callback) return;
    
    setLoadingAction(`${action}-${methodId}`);
    setError(null);
    
    try {
      await callback(methodId);
    } catch (err: any) {
      setError(err.message || 'Action failed');
    } finally {
      setLoadingAction(null);
    }
  };

  const renderPaymentMethodCard = (method: SavedPaymentMethod) => {
    const isSelected = selectedMethodId === method.id;
    const isLoading = loadingAction?.includes(method.id);

    return (
      <Card
        key={method.id}
        className={cn(
          "payment-method-card p-4 transition-all duration-200 cursor-pointer",
          isSelected && selectable 
            ? "border-gold-primary bg-gradient-to-br from-gold-primary/10 to-gold-secondary/5 shadow-glow"
            : "border-border bg-teal-20/30 hover:border-sage hover:bg-teal-20/50",
          method.status === 'expired' && "opacity-60",
          isLoading && "opacity-50 pointer-events-none"
        )}
        onClick={() => selectable && onSelect?.(method.id)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4 flex-1">
            {/* Payment Method Icon */}
            <div className={cn(
              "payment-icon p-3 rounded-lg text-2xl bg-gradient-to-br flex-shrink-0",
              method.type === 'card' 
                ? "from-blue-600/20 to-blue-800/20" 
                : method.type === 'bank_account'
                ? "from-green-600/20 to-green-800/20"
                : "from-blue-500/20 to-purple-600/20"
            )}>
              {method.type === 'card' && method.brand && getCardIcon(method.brand)}
              {method.type === 'bank_account' && method.accountType && getBankIcon(method.accountType)}
              {method.type === 'paypal' && '💙'}
            </div>

            {/* Payment Method Details */}
            <div className="payment-details flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-cream">
                  {method.type === 'card' && method.brand && `${formatCardBrand(method.brand)} ****${method.last4}`}
                  {method.type === 'bank_account' && `${method.bankName || 'Bank Account'} ****${method.accountLast4}`}
                  {method.type === 'paypal' && method.paypalEmail && `PayPal (${method.paypalEmail})`}
                </h4>

                {/* Badges */}
                <div className="flex gap-1">
                  {method.isDefault && (
                    <Badge variant="secondary" className="text-xs bg-gold-primary/20 text-gold-primary border-gold-primary/30">
                      Default
                    </Badge>
                  )}
                  
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs border-current",
                      getStatusColor(method.status)
                    )}
                  >
                    {getStatusLabel(method.status)}
                  </Badge>
                </div>
              </div>

              {/* Additional Details */}
              <div className="payment-meta space-y-1 text-sm text-text-secondary">
                {method.type === 'card' && method.expMonth && method.expYear && (
                  <div className="flex items-center justify-between">
                    <span>Expires {formatExpiryDate(method.expMonth, method.expYear)}</span>
                    {method.status === 'expired' && (
                      <span className="text-red-warning font-medium">Expired</span>
                    )}
                  </div>
                )}
                
                {method.type === 'bank_account' && method.accountType && (
                  <div>
                    {method.accountType.charAt(0).toUpperCase() + method.accountType.slice(1)} Account
                  </div>
                )}

                {method.billingDetails?.name && (
                  <div>{method.billingDetails.name}</div>
                )}

                {method.billingDetails?.address && (
                  <div className="text-xs text-text-muted">
                    {method.billingDetails.address.city && `${method.billingDetails.address.city}, `}
                    {method.billingDetails.address.state}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>Added {new Date(method.createdAt).toLocaleDateString()}</span>
                  {method.lastUsed && (
                    <span>Last used {new Date(method.lastUsed).toLocaleDateString()}</span>
                  )}
                </div>
              </div>

              {/* Action Required Notice */}
              {method.status === 'requires_action' && (
                <Alert className="mt-3 bg-gold-primary/10 border-gold-primary/30">
                  <div className="flex items-center gap-2 text-gold-primary">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">Payment method needs attention</span>
                  </div>
                </Alert>
              )}
            </div>
          </div>

          {/* Actions */}
          {showActions && (
            <div className="payment-actions flex flex-col gap-2 ml-4">
              {selectable && (
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
              )}

              {!selectable && (
                <div className="action-buttons flex gap-1">
                  {!method.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs px-2 py-1 h-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction('set-default', method.id, onSetDefault);
                      }}
                      disabled={isLoading}
                    >
                      Set Default
                    </Button>
                  )}

                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs px-2 py-1 h-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(method.id);
                      }}
                      disabled={isLoading}
                    >
                      Edit
                    </Button>
                  )}

                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs px-2 py-1 h-auto text-red-warning hover:text-red-error"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction('delete', method.id, onDelete);
                      }}
                      disabled={isLoading}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    );
  };

  if (paymentMethods.length === 0) {
    return (
      <div className={cn("payment-methods-empty text-center py-8", className)}>
        <div className="empty-state mb-6">
          <div className="w-16 h-16 mx-auto bg-teal-20 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
            </svg>
          </div>
          
          <h3 className="text-lg font-medium text-cream mb-2">
            No Payment Methods
          </h3>
          <p className="text-text-secondary mb-6">
            Add a payment method to get started with secure, fast checkouts.
          </p>

          {onAddNew && (
            <Button onClick={onAddNew} className="bg-gradient-premium">
              Add Payment Method
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("payment-methods-display", className)}>
      {error && (
        <Alert variant="destructive" className="mb-4">
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

      <div className="payment-methods-header flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-cream">
          {selectable ? 'Select Payment Method' : 'Saved Payment Methods'}
        </h3>
        
        {onAddNew && (
          <Button variant="outline" size="sm" onClick={onAddNew}>
            Add New Method
          </Button>
        )}
      </div>

      <div className="payment-methods-grid space-y-4">
        {paymentMethods.map(renderPaymentMethodCard)}
      </div>

      {/* Security Notice */}
      <div className="security-notice mt-6 p-4 bg-teal-20/30 rounded-lg border border-border">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <div>
            <h4 className="font-medium text-cream text-sm">Your Payment Methods Are Secure</h4>
            <p className="text-xs text-text-secondary mt-1">
              All payment information is encrypted and stored securely by our PCI-compliant payment processor. 
              We never store your full card numbers or sensitive payment data on our servers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaymentMethodDisplay;