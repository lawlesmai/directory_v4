/**
 * EPIC 5 STORY 5.4: Payment Error Boundary
 * Error boundary specifically for payment-related errors
 */

'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

interface PaymentErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorId: string;
}

interface PaymentErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<PaymentErrorFallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface PaymentErrorFallbackProps {
  error: Error;
  errorInfo: React.ErrorInfo | null;
  resetError: () => void;
  errorId: string;
}

class PaymentErrorBoundary extends React.Component<
  PaymentErrorBoundaryProps,
  PaymentErrorBoundaryState
> {
  constructor(props: PaymentErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<PaymentErrorBoundaryState> {
    // Generate a unique error ID for tracking
    const errorId = `payment_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Log error for monitoring
    console.error('Payment Error Boundary caught an error:', error, errorInfo);
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // In production, you would send this to your error monitoring service
    this.logErrorToService(error, errorInfo, this.state.errorId);
  }

  private logErrorToService = async (
    error: Error, 
    errorInfo: React.ErrorInfo, 
    errorId: string
  ) => {
    try {
      // In production, replace this with your actual error logging service
      await fetch('/api/errors/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          errorId,
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        }),
      });
    } catch (logError) {
      console.error('Failed to log payment error:', logError);
    }
  };

  private resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultPaymentErrorFallback;
      
      return (
        <FallbackComponent
          error={this.state.error!}
          errorInfo={this.state.errorInfo}
          resetError={this.resetError}
          errorId={this.state.errorId}
        />
      );
    }

    return this.props.children;
  }
}

// Default error fallback component
function DefaultPaymentErrorFallback({ 
  error, 
  errorInfo, 
  resetError, 
  errorId 
}: PaymentErrorFallbackProps) {
  const [supportTicketSent, setSupportTicketSent] = React.useState(false);
  const [sendingTicket, setSendingTicket] = React.useState(false);

  const isPaymentError = error.message.toLowerCase().includes('payment') ||
                        error.message.toLowerCase().includes('stripe') ||
                        error.message.toLowerCase().includes('card');

  const getErrorMessage = () => {
    if (isPaymentError) {
      return {
        title: 'Payment Processing Error',
        message: 'We encountered an issue while processing your payment. Don\'t worry - your card was not charged.',
        recommendation: 'Please try again or contact our support team for assistance.'
      };
    }

    return {
      title: 'Something Went Wrong',
      message: 'We encountered an unexpected error in the payment system.',
      recommendation: 'Please refresh the page and try again. If the issue persists, contact our support team.'
    };
  };

  const sendSupportTicket = async () => {
    setSendingTicket(true);
    
    try {
      await fetch('/api/support/payment-error-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          errorId,
          errorMessage: error.message,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
      });
      
      setSupportTicketSent(true);
    } catch (err) {
      console.error('Failed to send support ticket:', err);
    } finally {
      setSendingTicket(false);
    }
  };

  const errorDetails = getErrorMessage();

  return (
    <div className="payment-error-boundary min-h-[400px] flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="error-icon mb-6">
          <div className="w-16 h-16 mx-auto bg-red-warning/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-warning" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        <div className="error-content mb-8">
          <h2 className="text-xl font-semibold text-cream mb-3">
            {errorDetails.title}
          </h2>
          <p className="text-text-secondary mb-4">
            {errorDetails.message}
          </p>
          <p className="text-sm text-text-muted">
            {errorDetails.recommendation}
          </p>
        </div>

        {/* Error ID for support reference */}
        <div className="error-id mb-6 p-3 bg-navy-dark/50 rounded-lg">
          <div className="text-xs text-text-muted mb-1">Error ID (for support)</div>
          <div className="text-xs font-mono text-cream break-all">
            {errorId}
          </div>
        </div>

        <div className="error-actions space-y-3">
          <Button
            onClick={resetError}
            className="w-full bg-gradient-premium"
          >
            Try Again
          </Button>
          
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </Button>
            
            <Button
              variant="outline"
              onClick={sendSupportTicket}
              disabled={sendingTicket || supportTicketSent}
            >
              {sendingTicket ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Sending...</span>
                </div>
              ) : supportTicketSent ? (
                <div className="flex items-center gap-2 text-sage">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Sent</span>
                </div>
              ) : (
                'Get Help'
              )}
            </Button>
          </div>
        </div>

        {/* Success message for support ticket */}
        {supportTicketSent && (
          <Alert className="mt-4 bg-sage/20 border-sage/30">
            <div className="flex items-center gap-2 text-sage">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Support ticket created! We'll contact you shortly.</span>
            </div>
          </Alert>
        )}

        {/* Security notice */}
        <div className="security-notice mt-6 text-xs text-text-muted">
          <div className="flex items-center justify-center gap-2 mb-2">
            <svg className="w-3 h-3 text-sage" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span>Your payment information is secure</span>
          </div>
          <p>
            No payment was processed due to this error. 
            Your card information is protected by bank-level encryption.
          </p>
        </div>
      </Card>
    </div>
  );
}

// Hook for manual error reporting
export function usePaymentErrorReporting() {
  const reportError = React.useCallback(async (error: Error, context?: any) => {
    const errorId = `manual_payment_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      await fetch('/api/errors/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          errorId,
          message: error.message,
          stack: error.stack,
          context,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          type: 'manual_report',
        }),
      });
      
      return errorId;
    } catch (logError) {
      console.error('Failed to report payment error:', logError);
      return null;
    }
  }, []);

  return { reportError };
}

export default PaymentErrorBoundary;
export type { PaymentErrorBoundaryProps, PaymentErrorFallbackProps };