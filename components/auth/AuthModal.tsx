'use client';

import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '../GlassMorphism';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { PasswordResetForm } from './PasswordResetForm';
import { EmailVerificationForm } from './EmailVerificationForm';
import type { AuthModalProps } from './types';

// Password Reset Form Component
const PasswordResetForm: React.FC<{
  onSuccess?: () => void;
  onError?: (error: any) => void;
  onBackToLogin?: () => void;
  className?: string;
}> = ({ onSuccess, onError, onBackToLogin, className = '' }) => {
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

// Email Verification Form Component
const EmailVerificationForm: React.FC<{
  onSuccess?: () => void;
  onError?: (error: any) => void;
  onResend?: () => void;
  className?: string;
}> = ({ onSuccess, onError, onResend, className = '' }) => {
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

// Main AuthModal Component
export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  mode,
  onModeChange,
  className = ''
}) => {
  // Handle escape key
  const handleEscapeKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // Add/remove event listeners
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleEscapeKey]);

  // Prevent scroll on mount if open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen]);

  // Focus management
  const modalRef = React.useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (isOpen && modalRef.current) {
      // Focus the modal when it opens
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      firstElement?.focus();
    }
  }, [isOpen, mode]);

  const handleAuthSuccess = (user: any) => {
    console.log('Auth success:', user);
    onClose();
  };

  const handleAuthError = (error: any) => {
    console.error('Auth error:', error);
  };

  const renderModalContent = () => {
    switch (mode) {
      case 'login':
        return (
          <LoginForm
            onSuccess={handleAuthSuccess}
            onError={handleAuthError}
            showSocialLogin={true}
            showRememberMe={true}
            showForgotPassword={true}
            showSignUpLink={false}
          />
        );

      case 'register':
        return (
          <RegisterForm
            onSuccess={handleAuthSuccess}
            onError={handleAuthError}
            showSocialLogin={true}
          />
        );

      case 'forgot-password':
        return (
          <GlassMorphism variant="medium" className="p-8 w-full max-w-md mx-auto">
            <PasswordResetForm
              onSuccess={() => onModeChange('login')}
              onError={handleAuthError}
              onBackToLogin={() => onModeChange('login')}
            />
          </GlassMorphism>
        );

      case 'verify-email':
        return (
          <GlassMorphism variant="medium" className="p-8 w-full max-w-md mx-auto">
            <EmailVerificationForm
              onSuccess={handleAuthSuccess}
              onError={handleAuthError}
              onResend={() => console.log('Resend verification code')}
            />
          </GlassMorphism>
        );

      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn(
            'fixed inset-0 z-50 flex items-center justify-center',
            'bg-navy-dark/80 backdrop-blur-sm p-4',
            className
          )}
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 text-sage/70 hover:text-cream hover:bg-navy-dark/50 rounded-lg transition-all duration-200"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Navigation for different modes */}
            <div className="absolute top-4 left-4 z-10">
              <div className="flex gap-2">
                {mode === 'forgot-password' && (
                  <button
                    onClick={() => onModeChange('login')}
                    className="p-2 text-sage/70 hover:text-cream hover:bg-navy-dark/50 rounded-lg transition-all duration-200"
                    aria-label="Back to login"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Modal Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {renderModalContent()}
              </motion.div>
            </AnimatePresence>

            {/* Mode Switch Links */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-6 text-center space-y-2"
            >
              {mode === 'login' && (
                <>
                  <p className="text-sage/70 text-sm">
                    Don't have an account?{' '}
                    <button
                      onClick={() => onModeChange('register')}
                      className="text-teal-primary hover:text-teal-secondary transition-colors font-medium"
                    >
                      Sign up now
                    </button>
                  </p>
                  <button
                    onClick={() => onModeChange('forgot-password')}
                    className="block mx-auto text-sage/50 hover:text-sage transition-colors text-xs"
                  >
                    Forgot your password?
                  </button>
                </>
              )}

              {mode === 'register' && (
                <p className="text-sage/70 text-sm">
                  Already have an account?{' '}
                  <button
                    onClick={() => onModeChange('login')}
                    className="text-teal-primary hover:text-teal-secondary transition-colors font-medium"
                  >
                    Sign in
                  </button>
                </p>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Hook for managing auth modal state
export const useAuthModal = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [mode, setMode] = React.useState<AuthModalProps['mode']>('login');

  const openLogin = () => {
    setMode('login');
    setIsOpen(true);
  };

  const openRegister = () => {
    setMode('register');
    setIsOpen(true);
  };

  const openForgotPassword = () => {
    setMode('forgot-password');
    setIsOpen(true);
  };

  const openEmailVerification = () => {
    setMode('verify-email');
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
  };

  const changeMode = (newMode: AuthModalProps['mode']) => {
    setMode(newMode);
  };

  return {
    isOpen,
    mode,
    openLogin,
    openRegister,
    openForgotPassword,
    openEmailVerification,
    close,
    changeMode
  };
};

export default AuthModal;