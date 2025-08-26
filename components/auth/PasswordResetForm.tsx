'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordResetFormProps {
  onSuccess?: () => void;
  onError?: (error: any) => void;
  onBackToLogin?: () => void;
  className?: string;
}

export const PasswordResetForm: React.FC<PasswordResetFormProps> = ({
  onSuccess,
  onError,
  onBackToLogin,
  className = ''
}) => {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [resetSent, setResetSent] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setResetSent(true);
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
          Reset Password
        </h2>
        <p className="text-sage/70">
          Enter your email address and we'll send you a link to reset your password.
        </p>
      </div>

      {resetSent ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <div className="w-16 h-16 bg-teal-primary/10 rounded-full flex items-center justify-center mx-auto">
            <X className="w-8 h-8 text-teal-primary" />
          </div>
          <h3 className="text-lg font-semibold text-cream">Check Your Email</h3>
          <p className="text-sage/70 text-sm">
            We've sent a password reset link to your email address.
          </p>
          <button
            onClick={onBackToLogin}
            className="text-teal-primary hover:text-teal-secondary transition-colors text-sm"
          >
            Back to Login
          </button>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="reset-email" className="block text-sm font-medium text-cream">
              Email Address
            </label>
            <input
              type="email"
              id="reset-email"
              required
              className="w-full py-3 px-4 rounded-lg bg-navy-dark/50 backdrop-blur-sm border border-sage/20 text-cream placeholder-sage/50 focus:outline-none focus:ring-2 focus:ring-teal-primary/50 focus:border-teal-primary/50"
              placeholder="Enter your email"
            />
          </div>

          <div className="space-y-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                'w-full px-6 py-3 rounded-lg font-medium transition-all duration-200',
                'bg-gradient-to-r from-teal-primary to-teal-secondary text-cream',
                'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
                'focus:outline-none focus:ring-2 focus:ring-teal-primary/50 focus:ring-offset-2 focus:ring-offset-navy-dark',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
              )}
            >
              {isSubmitting ? 'Sending...' : 'Send Reset Link'}
            </button>
            
            <button
              type="button"
              onClick={onBackToLogin}
              className="w-full text-sage/70 hover:text-sage transition-colors text-sm"
            >
              Back to Login
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default PasswordResetForm;
