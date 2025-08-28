/**
 * EPIC 5 STORY 5.5: Payment Method Manager Component
 * Secure add/edit/delete payment methods with default selection
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface PaymentMethodData {
  id: string;
  type: 'card' | 'bank_account';
  last4?: string;
  brand?: string;
  isDefault: boolean;
  isExpiring?: boolean;
  expirationWarningDays?: number;
  hasDeclineHistory?: boolean;
  lastUsed?: Date;
  createdAt: Date;
}

export interface PaymentMethodManagerProps {
  className?: string;
  showPreviewOnly?: boolean;
  onPaymentMethodChange?: (method: PaymentMethodData) => void;
}

export interface AddPaymentMethodFormData {
  type: 'card' | 'bank_account';
  cardNumber?: string;
  expiryMonth?: string;
  expiryYear?: string;
  cvc?: string;
  name: string;
  email?: string;
  setAsDefault: boolean;
}

// =============================================
// PAYMENT METHOD MANAGER COMPONENT
// =============================================

export function PaymentMethodManager({ 
  className, 
  showPreviewOnly = false,
  onPaymentMethodChange 
}: PaymentMethodManagerProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  const fetchPaymentMethods = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/billing/payment-methods');
      if (!response.ok) {
        throw new Error('Failed to fetch payment methods');
      }

      const methods = await response.json();
      setPaymentMethods(methods);
    } catch (err: any) {
      console.error('Error fetching payment methods:', err);
      setError(err.message || 'Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (methodId: string) => {
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

      // Update local state
      setPaymentMethods(prev => 
        prev.map(method => ({
          ...method,
          isDefault: method.id === methodId
        }))
      );

      const updatedMethod = paymentMethods.find(m => m.id === methodId);
      if (updatedMethod) {
        onPaymentMethodChange?.({...updatedMethod, isDefault: true});
      }

    } catch (err: any) {
      console.error('Error setting default payment method:', err);
      setError(err.message || 'Failed to update payment method');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (methodId: string) => {
    setActionLoading(`delete-${methodId}`);
    
    try {
      const response = await fetch(`/api/billing/payment-methods/${methodId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete payment method');
      }

      // Remove from local state
      setPaymentMethods(prev => prev.filter(method => method.id !== methodId));
      setShowDeleteConfirm(null);

    } catch (err: any) {
      console.error('Error deleting payment method:', err);
      setError(err.message || 'Failed to delete payment method');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddPaymentMethod = async (formData: AddPaymentMethodFormData) => {
    setActionLoading('add-payment-method');
    
    try {
      const response = await fetch('/api/billing/payment-methods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add payment method');
      }

      const newMethod = await response.json();
      setPaymentMethods(prev => [...prev, newMethod]);
      setShowAddModal(false);
      
      onPaymentMethodChange?.(newMethod);

    } catch (err: any) {
      console.error('Error adding payment method:', err);
      setError(err.message || 'Failed to add payment method');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getPaymentMethodIcon = (type: string, brand?: string) => {
    if (type === 'card') {
      switch (brand?.toLowerCase()) {
        case 'visa':
          return (
            <div className="w-8 h-5 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">
              VISA
            </div>
          );
        case 'mastercard':
          return (
            <div className="w-8 h-5 bg-red-500 rounded flex items-center justify-center text-white text-xs font-bold">
              MC
            </div>
          );
        case 'amex':
          return (
            <div className="w-8 h-5 bg-green-600 rounded flex items-center justify-center text-white text-xs font-bold">
              AMEX
            </div>
          );
        default:
          return (
            <div className="w-8 h-5 bg-gray-400 rounded flex items-center justify-center text-white text-xs">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v2H4V6zm0 4h12v4H4v-4z" />
              </svg>
            </div>
          );
      }
    } else if (type === 'bank_account') {
      return (
        <div className="w-8 h-5 bg-teal-600 rounded flex items-center justify-center text-white text-xs">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
        </div>
      );
    }
    
    return (
      <div className="w-8 h-5 bg-gray-400 rounded flex items-center justify-center text-white text-xs">
        ?
      </div>
    );
  };

  if (loading) {
    return (
      <Card className={cn("payment-method-manager p-6 bg-glass-light backdrop-blur-md border-glass", className)}>
        <div className="animate-pulse">
          <div className="h-6 bg-teal-20/30 rounded w-48 mb-4"></div>
          <div className="space-y-4">
            <div className="h-16 bg-teal-20/30 rounded"></div>
            <div className="h-16 bg-teal-20/30 rounded"></div>
          </div>
        </div>
      </Card>
    );
  }

  if (showPreviewOnly) {
    const defaultMethod = paymentMethods.find(method => method.isDefault);
    
    return (
      <Card className={cn("payment-method-manager p-4 bg-glass-light backdrop-blur-md border-glass", className)}>
        <h3 className="text-lg font-semibold text-cream mb-3">Default Payment Method</h3>
        
        {defaultMethod ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getPaymentMethodIcon(defaultMethod.type, defaultMethod.brand)}
              <div>
                <div className="font-medium text-cream">
                  •••• {defaultMethod.last4} {defaultMethod.brand?.toUpperCase()}
                </div>
                <div className="text-sm text-text-secondary">
                  {defaultMethod.type === 'card' ? 'Credit Card' : 'Bank Account'}
                </div>
              </div>
            </div>
            
            {defaultMethod.isExpiring && (
              <Badge variant="destructive" className="text-xs">
                Expiring Soon
              </Badge>
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
              onClick={() => setShowAddModal(true)}
            >
              Add Payment Method
            </Button>
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className={cn("payment-method-manager space-y-6", className)}>
      {/* Header */}
      <Card className="p-6 bg-glass-light backdrop-blur-md border-glass">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-cream mb-1">
              Payment Methods
            </h2>
            <p className="text-text-secondary">
              Manage your payment methods and billing preferences
            </p>
          </div>
          
          <Button
            onClick={() => setShowAddModal(true)}
            disabled={!!actionLoading}
            className="bg-gold-primary hover:bg-gold-primary/90 text-cream"
          >
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Payment Method
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <span>{error}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setError(null)}
                className="ml-2"
              >
                ×
              </Button>
            </div>
          </Alert>
        )}
      </Card>

      {/* Payment Methods List */}
      {paymentMethods.length > 0 ? (
        <div className="space-y-4">
          {paymentMethods.map((method) => (
            <Card 
              key={method.id} 
              className={cn(
                "p-4 bg-glass-light backdrop-blur-md border-glass transition-all",
                method.isDefault && "border-gold-primary/50 bg-gold-primary/5"
              )}
            >
              <div className="flex items-center justify-between">
                {/* Payment Method Info */}
                <div className="flex items-center space-x-4">
                  {getPaymentMethodIcon(method.type, method.brand)}
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-cream">
                        •••• {method.last4}
                      </span>
                      {method.brand && (
                        <span className="text-sm text-text-secondary">
                          {method.brand.toUpperCase()}
                        </span>
                      )}
                      {method.isDefault && (
                        <Badge className="bg-gold-primary/20 text-gold-primary text-xs">
                          Default
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-text-secondary">
                        {method.type === 'card' ? 'Credit Card' : 'Bank Account'}
                      </span>
                      
                      {method.lastUsed && (
                        <span className="text-xs text-text-secondary">
                          Last used {formatDate(method.lastUsed)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status and Actions */}
                <div className="flex items-center space-x-2">
                  {/* Status Indicators */}
                  <div className="flex flex-col items-end space-y-1">
                    {method.isExpiring && (
                      <Badge variant="destructive" className="text-xs">
                        Expires in {method.expirationWarningDays} days
                      </Badge>
                    )}
                    
                    {method.hasDeclineHistory && (
                      <Badge variant="secondary" className="text-xs">
                        Recent declines
                      </Badge>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2">
                    {!method.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(method.id)}
                        disabled={!!actionLoading}
                        className="text-sage hover:text-sage/80"
                      >
                        {actionLoading === `set-default-${method.id}` ? 'Setting...' : 'Set Default'}
                      </Button>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(method.id)}
                      disabled={!!actionLoading}
                      className="text-red-warning hover:text-red-warning/80"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center bg-glass-light backdrop-blur-md border-glass">
          <div className="w-16 h-16 mx-auto bg-teal-20 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-text-secondary" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v2H4V6zm0 4h12v4H4v-4z" />
            </svg>
          </div>
          
          <h3 className="text-lg font-medium text-cream mb-2">
            No Payment Methods
          </h3>
          <p className="text-text-secondary mb-6">
            Add a payment method to ensure uninterrupted service and manage your billing easily.
          </p>

          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-gradient-premium"
          >
            Add Your First Payment Method
          </Button>
        </Card>
      )}

      {/* Add Payment Method Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-glass-dark backdrop-blur-md border-glass max-w-md">
          <DialogHeader>
            <DialogTitle className="text-cream">Add Payment Method</DialogTitle>
            <DialogDescription className="text-text-secondary">
              Add a secure payment method for your subscription billing.
            </DialogDescription>
          </DialogHeader>
          
          <AddPaymentMethodForm 
            onSubmit={handleAddPaymentMethod}
            onCancel={() => setShowAddModal(false)}
            loading={actionLoading === 'add-payment-method'}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent className="bg-glass-dark backdrop-blur-md border-glass max-w-md">
          <DialogHeader>
            <DialogTitle className="text-cream">Delete Payment Method</DialogTitle>
            <DialogDescription className="text-text-secondary">
              Are you sure you want to delete this payment method? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-end space-x-3 mt-6">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(null)}
              disabled={!!actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
              disabled={!!actionLoading}
            >
              {actionLoading?.startsWith('delete-') ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================
// ADD PAYMENT METHOD FORM COMPONENT
// =============================================

interface AddPaymentMethodFormProps {
  onSubmit: (data: AddPaymentMethodFormData) => void;
  onCancel: () => void;
  loading: boolean;
}

function AddPaymentMethodForm({ onSubmit, onCancel, loading }: AddPaymentMethodFormProps) {
  const [formData, setFormData] = useState<AddPaymentMethodFormData>({
    type: 'card',
    name: '',
    setAsDefault: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Payment Method Type */}
      <div>
        <label className="block text-sm font-medium text-cream mb-2">
          Payment Method Type
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, type: 'card' }))}
            className={cn(
              "p-3 border rounded-lg text-center transition-colors",
              formData.type === 'card'
                ? "border-gold-primary bg-gold-primary/20 text-gold-primary"
                : "border-glass text-text-secondary hover:border-gold-primary/50"
            )}
          >
            Credit Card
          </button>
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, type: 'bank_account' }))}
            className={cn(
              "p-3 border rounded-lg text-center transition-colors",
              formData.type === 'bank_account'
                ? "border-gold-primary bg-gold-primary/20 text-gold-primary"
                : "border-glass text-text-secondary hover:border-gold-primary/50"
            )}
          >
            Bank Account
          </button>
        </div>
      </div>

      {/* Stripe Elements would go here in real implementation */}
      <div className="p-4 bg-teal-20/20 rounded-lg border border-glass">
        <div className="text-sm text-text-secondary text-center">
          🔒 Secure payment form powered by Stripe
          <br />
          <em>(Stripe Elements integration would be implemented here)</em>
        </div>
      </div>

      {/* Cardholder Name */}
      <div>
        <label className="block text-sm font-medium text-cream mb-2">
          {formData.type === 'card' ? 'Cardholder Name' : 'Account Holder Name'}
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          className="w-full p-3 bg-glass-light border border-glass rounded-lg text-cream placeholder-text-secondary focus:outline-none focus:border-gold-primary"
          placeholder="Enter full name"
          required
        />
      </div>

      {/* Set as Default */}
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="setAsDefault"
          checked={formData.setAsDefault}
          onChange={(e) => setFormData(prev => ({ ...prev, setAsDefault: e.target.checked }))}
          className="rounded border-glass"
        />
        <label htmlFor="setAsDefault" className="text-sm text-cream">
          Set as default payment method
        </label>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3 mt-6">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading || !formData.name.trim()}
          className="bg-gold-primary hover:bg-gold-primary/90"
        >
          {loading ? 'Adding...' : 'Add Payment Method'}
        </Button>
      </div>
    </form>
  );
}

export default PaymentMethodManager;