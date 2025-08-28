/**
 * EPIC 5 STORY 5.4: Payment Success Page
 * Confirmation page for successful payments with next steps
 */

'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface PaymentDetails {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  customer?: {
    name?: string;
    email?: string;
  };
}

interface PlanDetails {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  trial_days?: number;
}

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [planDetails, setPlanDetails] = useState<PlanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receiptDownloading, setReceiptDownloading] = useState(false);

  useEffect(() => {
    const paymentIntentId = searchParams.get('payment_intent');
    const planId = searchParams.get('plan');

    if (!paymentIntentId) {
      setError('Payment information not found');
      setLoading(false);
      return;
    }

    fetchPaymentDetails(paymentIntentId, planId);
  }, [searchParams]);

  const fetchPaymentDetails = async (paymentIntentId: string, planId: string | null) => {
    try {
      // Fetch payment details
      const paymentResponse = await fetch(`/api/payments/payment-intent/${paymentIntentId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!paymentResponse.ok) {
        throw new Error('Failed to fetch payment details');
      }

      const payment = await paymentResponse.json();
      setPaymentDetails(payment);

      // Fetch plan details if available
      if (planId) {
        const planResponse = await fetch(`/api/payments/plans/${planId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (planResponse.ok) {
          const plan = await planResponse.json();
          setPlanDetails(plan);
        }
      }

    } catch (err: any) {
      console.error('Error fetching payment details:', err);
      setError(err.message || 'Failed to load payment details');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!paymentDetails) return;
    
    setReceiptDownloading(true);
    
    try {
      const response = await fetch(`/api/payments/receipt/${paymentDetails.id}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate receipt');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${paymentDetails.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (err: any) {
      console.error('Error downloading receipt:', err);
      // You could show a toast notification here
    } finally {
      setReceiptDownloading(false);
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-bg flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto bg-teal-20 rounded-full flex items-center justify-center mb-4">
            <svg className="animate-spin w-8 h-8 text-teal-secondary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-text-secondary">Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-bg flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-6 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto bg-red-warning/20 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-warning" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-cream mb-2">Unable to Load Payment Details</h2>
            <p className="text-text-secondary mb-6">{error}</p>
          </div>
          
          <div className="space-y-3">
            <Button 
              onClick={() => window.location.reload()} 
              className="w-full bg-gradient-premium"
            >
              Try Again
            </Button>
            <Button 
              variant="outline" 
              onClick={() => router.push('/dashboard')} 
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-bg py-12">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl mx-auto">
          {/* Success Header */}
          <Card className="p-8 text-center mb-8">
            <div className="success-animation mb-6">
              <div className="w-20 h-20 mx-auto bg-sage rounded-full flex items-center justify-center mb-4 animate-pulse">
                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              
              <div className="confetti-animation">
                <span className="text-4xl animate-bounce inline-block" style={{animationDelay: '0s'}}>🎉</span>
                <span className="text-3xl animate-bounce inline-block" style={{animationDelay: '0.1s'}}>✨</span>
                <span className="text-4xl animate-bounce inline-block" style={{animationDelay: '0.2s'}}>🎊</span>
              </div>
            </div>

            <h1 className="text-3xl font-bold text-cream mb-4">
              Payment Successful!
            </h1>
            
            <p className="text-xl text-text-secondary mb-6">
              Thank you for your purchase. Your subscription is now active!
            </p>

            {paymentDetails && (
              <div className="payment-amount mb-6">
                <div className="text-4xl font-bold text-gold-primary mb-2">
                  {formatAmount(paymentDetails.amount, paymentDetails.currency)}
                </div>
                <div className="text-sm text-text-secondary">
                  Payment ID: {paymentDetails.id}
                </div>
              </div>
            )}

            {/* Plan Details */}
            {planDetails && (
              <div className="plan-info p-6 bg-gradient-to-br from-gold-primary/10 to-gold-secondary/5 border border-gold-primary/30 rounded-lg mb-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <h3 className="text-xl font-semibold text-cream">
                    {planDetails.name} Plan
                  </h3>
                  <Badge className="bg-sage text-white">Active</Badge>
                </div>
                
                {planDetails.trial_days && (
                  <Alert className="mt-4 bg-sage/20 border-sage/30">
                    <div className="flex items-center gap-2 text-sage">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium">
                        🆓 Your {planDetails.trial_days}-day free trial has started!
                      </span>
                    </div>
                    <p className="text-sm text-sage/80 mt-1">
                      You won't be charged again until your trial period ends.
                    </p>
                  </Alert>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="action-buttons space-y-3">
              <Button 
                onClick={() => router.push('/dashboard')} 
                className="w-full h-12 bg-gradient-premium font-semibold text-lg"
              >
                Access Your Dashboard
              </Button>
              
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={handleDownloadReceipt}
                  disabled={receiptDownloading}
                  className="flex items-center gap-2"
                >
                  {receiptDownloading ? (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span>Download Receipt</span>
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => router.push('/billing')}
                >
                  Manage Billing
                </Button>
              </div>
            </div>
          </Card>

          {/* Payment Details */}
          {paymentDetails && (
            <Card className="p-6 mb-8">
              <h3 className="text-lg font-semibold text-cream mb-4">
                Payment Details
              </h3>
              
              <div className="payment-details space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-text-secondary">Transaction ID</span>
                  <span className="text-cream font-mono text-sm">{paymentDetails.id}</span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-text-secondary">Amount Paid</span>
                  <span className="text-cream font-semibold">
                    {formatAmount(paymentDetails.amount, paymentDetails.currency)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-text-secondary">Payment Status</span>
                  <Badge className="bg-sage text-white">
                    {paymentDetails.status.charAt(0).toUpperCase() + paymentDetails.status.slice(1)}
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center py-2">
                  <span className="text-text-secondary">Payment Date</span>
                  <span className="text-cream">
                    {formatDate(paymentDetails.created)}
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* Next Steps */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-cream mb-4">
              What's Next?
            </h3>
            
            <div className="next-steps space-y-4">
              <div className="step flex items-start gap-4">
                <div className="step-number w-8 h-8 bg-gold-primary rounded-full flex items-center justify-center text-navy-dark font-bold text-sm flex-shrink-0">
                  1
                </div>
                <div>
                  <h4 className="font-medium text-cream">Set Up Your Business Profile</h4>
                  <p className="text-sm text-text-secondary">
                    Complete your business information to get discovered by customers.
                  </p>
                </div>
              </div>
              
              <div className="step flex items-start gap-4">
                <div className="step-number w-8 h-8 bg-gold-primary rounded-full flex items-center justify-center text-navy-dark font-bold text-sm flex-shrink-0">
                  2
                </div>
                <div>
                  <h4 className="font-medium text-cream">Explore Your Dashboard</h4>
                  <p className="text-sm text-text-secondary">
                    View analytics, manage listings, and track your business performance.
                  </p>
                </div>
              </div>
              
              <div className="step flex items-start gap-4">
                <div className="step-number w-8 h-8 bg-gold-primary rounded-full flex items-center justify-center text-navy-dark font-bold text-sm flex-shrink-0">
                  3
                </div>
                <div>
                  <h4 className="font-medium text-cream">Get Support</h4>
                  <p className="text-sm text-text-secondary">
                    Need help? Our support team is available 24/7 to assist you.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Support Information */}
          <div className="text-center mt-8 text-sm text-text-muted">
            <p>
              Questions about your payment or subscription?{' '}
              <button 
                onClick={() => router.push('/support')}
                className="text-gold-primary hover:text-gold-secondary underline"
              >
                Contact our support team
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense 
      fallback={
        <div className="min-h-screen bg-gradient-bg flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto bg-teal-20 rounded-full flex items-center justify-center mb-4">
              <svg className="animate-spin w-8 h-8 text-teal-secondary" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <p className="text-text-secondary">Loading...</p>
          </div>
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}