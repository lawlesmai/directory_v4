'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface EmailVerificationFormProps {
  onSuccess?: () => void;
  onError?: (error: any) => void;
  onResend?: () => void;
  className?: string;
}

export const EmailVerificationForm: React.FC<EmailVerificationFormProps> = ({
  onSuccess,
  onError,
  onResend,
  className = ''
}) => {
  const [code, setCode] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    
    setIsSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      onSuccess?.();
    } catch (error) {
      onError?.(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={className}>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-cream mb-2">
          Verify Your Email
        </h2>
        <p className="text-sage/70">
          Enter the 6-digit code we sent to your email address.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex justify-center">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            className="w-32 py-3 text-center text-lg font-mono rounded-lg bg-navy-dark/50 backdrop-blur-sm border border-sage/20 text-cream placeholder-sage/50 focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
            placeholder="123456"
          />
        </div>

        <div className="space-y-3">
          <button
            type="submit"
            disabled={isSubmitting || code.length !== 6}
            className={cn(
              'w-full px-6 py-3 rounded-lg font-medium transition-all duration-200',
              'bg-gradient-to-r from-teal-primary to-teal-secondary text-cream',
              'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
              'focus:outline-none focus:ring-2 focus:ring-teal-primary/50 focus:ring-offset-2 focus:ring-offset-navy-dark',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
            )}
          >
            {isSubmitting ? 'Verifying...' : 'Verify Email'}
          </button>
          
          <button
            type="button"
            onClick={onResend}
            className="w-full text-sage/70 hover:text-sage transition-colors text-sm"
          >
            Resend Code
          </button>
        </div>
      </form>
    </div>
  );
};

export default EmailVerificationForm;
