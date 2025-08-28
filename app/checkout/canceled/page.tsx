/**
 * EPIC 5 STORY 5.4: Payment Canceled Page
 * Handles payment cancellation and provides recovery options
 */

'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

function PaymentCanceledContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [planId, setPlanId] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    const plan = searchParams.get('plan');
    const cancelReason = searchParams.get('reason');
    
    setPlanId(plan);
    setReason(cancelReason);
  }, [searchParams]);

  const handleRetryPayment = () => {
    if (planId) {
      router.push(`/checkout?plan=${planId}`);
    } else {
      router.push('/pricing');
    }
  };

  const handleContactSupport = () => {
    // You could open a support widget/modal here
    router.push('/support?topic=payment-issues');
  };

  const getReason = () => {
    switch (reason) {
      case 'user_canceled':
        return 'You canceled the payment process.';
      case 'payment_failed':
        return 'Your payment could not be processed.';
      case 'insufficient_funds':
        return 'Your payment method has insufficient funds.';
      case 'card_declined':
        return 'Your card was declined by your bank.';
      case 'expired_card':
        return 'Your payment method has expired.';
      case 'authentication_failed':
        return 'Payment authentication failed.';
      default:
        return 'Your payment was not completed.';
    }
  };

  const getHelpText = () => {
    switch (reason) {
      case 'insufficient_funds':
        return 'Please check your account balance or try a different payment method.';
      case 'card_declined':
        return 'Contact your bank or try a different payment method.';
      case 'expired_card':
        return 'Please update your payment method with a valid card.';
      case 'authentication_failed':
        return 'Try the payment again or contact your bank for assistance.';
      default:
        return 'You can try again or contact our support team for assistance.';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-bg py-12">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl mx-auto">
          {/* Canceled Header */}
          <Card className="p-8 text-center mb-8">
            <div className="canceled-animation mb-6">
              <div className="w-20 h-20 mx-auto bg-red-warning/20 rounded-full flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-red-warning" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            <h1 className="text-3xl font-bold text-cream mb-4">
              Payment Canceled
            </h1>
            
            <p className="text-xl text-text-secondary mb-6">
              {getReason()}
            </p>

            <Alert className="mb-6 bg-gold-primary/10 border-gold-primary/30 text-left">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-gold-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h4 className="font-medium text-gold-primary mb-1">Don't worry!</h4>
                  <p className="text-sm text-text-secondary">
                    {getHelpText()} No charges were made to your account.
                  </p>
                </div>
              </div>
            </Alert>

            {/* Action Buttons */}
            <div className="action-buttons space-y-4">
              <Button 
                onClick={handleRetryPayment}
                className="w-full h-12 bg-gradient-premium font-semibold text-lg"
              >
                Try Payment Again
              </Button>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() => router.push('/pricing')}
                >
                  View All Plans
                </Button>
                
                <Button
                  variant="outline"
                  onClick={handleContactSupport}
                >
                  Contact Support
                </Button>
              </div>
            </div>
          </Card>

          {/* Common Issues & Solutions */}
          <Card className="p-6 mb-8">
            <h3 className="text-lg font-semibold text-cream mb-4">
              Common Payment Issues & Solutions
            </h3>
            
            <div className="issues-list space-y-4">
              <div className="issue-item p-4 bg-teal-20/30 rounded-lg border border-border">
                <div className="flex items-start gap-3">
                  <div className="issue-icon w-8 h-8 bg-red-warning/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-red-warning" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v2H4V6zm0 4h12v4H4v-4z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-cream mb-1">Card Declined</h4>
                    <p className="text-sm text-text-secondary mb-2">
                      Your bank declined the transaction for security reasons.
                    </p>
                    <ul className="text-xs text-text-muted space-y-1">
                      <li>• Contact your bank to authorize the payment</li>
                      <li>• Check if international payments are enabled</li>
                      <li>• Verify your card details are correct</li>
                      <li>• Try a different payment method</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="issue-item p-4 bg-teal-20/30 rounded-lg border border-border">
                <div className="flex items-start gap-3">
                  <div className="issue-icon w-8 h-8 bg-gold-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-gold-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-cream mb-1">Payment Timeout</h4>
                    <p className="text-sm text-text-secondary mb-2">
                      The payment process took too long to complete.
                    </p>
                    <ul className="text-xs text-text-muted space-y-1">
                      <li>• Check your internet connection</li>
                      <li>• Try refreshing the page and starting over</li>
                      <li>• Clear your browser cache and cookies</li>
                      <li>• Use a different browser or device</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="issue-item p-4 bg-teal-20/30 rounded-lg border border-border">
                <div className="flex items-start gap-3">
                  <div className="issue-icon w-8 h-8 bg-sage/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-sage" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-cream mb-1">Authentication Required</h4>
                    <p className="text-sm text-text-secondary mb-2">
                      Your bank requires additional authentication for this payment.
                    </p>
                    <ul className="text-xs text-text-muted space-y-1">
                      <li>• Complete 3D Secure authentication</li>
                      <li>• Check for SMS or email from your bank</li>
                      <li>• Use your banking app to approve the payment</li>
                      <li>• Contact your bank if you're not receiving codes</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Alternative Options */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-cream mb-4">
              Alternative Options
            </h3>
            
            <div className="alternatives-grid grid md:grid-cols-2 gap-4">
              <div className="alternative-option p-4 bg-gradient-to-br from-teal-secondary/10 to-teal-primary/5 border border-teal-secondary/30 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-teal-secondary/20 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-teal-secondary" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    </svg>
                  </div>
                  <h4 className="font-medium text-cream">Try Digital Wallets</h4>
                </div>
                <p className="text-sm text-text-secondary mb-3">
                  Use Apple Pay, Google Pay, or PayPal for faster, more secure payments.
                </p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full border-teal-secondary/30"
                  onClick={handleRetryPayment}
                >
                  Try Different Method
                </Button>
              </div>

              <div className="alternative-option p-4 bg-gradient-to-br from-gold-primary/10 to-gold-secondary/5 border border-gold-primary/30 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gold-primary/20 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-gold-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                  </div>
                  <h4 className="font-medium text-cream">Get Help</h4>
                </div>
                <p className="text-sm text-text-secondary mb-3">
                  Our payment specialists can help you complete your purchase.
                </p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full border-gold-primary/30"
                  onClick={handleContactSupport}
                >
                  Contact Support
                </Button>
              </div>
            </div>
          </Card>

          {/* Free Options */}
          <div className="text-center mt-8 p-6 bg-sage/10 rounded-lg border border-sage/30">
            <h4 className="font-medium text-cream mb-2">
              Not ready to upgrade? No problem!
            </h4>
            <p className="text-sm text-text-secondary mb-4">
              You can always start with our free plan and upgrade later when you're ready.
            </p>
            <Button 
              variant="outline" 
              onClick={() => router.push('/dashboard')}
              className="border-sage/30 text-sage hover:bg-sage/10"
            >
              Continue with Free Plan
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentCanceledPage() {
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
      <PaymentCanceledContent />
    </Suspense>
  );
}