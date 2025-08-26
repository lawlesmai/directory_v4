'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, Shield, Zap, Users, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '../GlassMorphism';
import { SocialLoginButton, SocialLoginGroup, SocialLoginDivider } from './SocialLoginButton';
import { LoadingSpinner } from './LoadingStates';
import { useAuth } from '@/contexts/AuthContext';
import type { AuthProvider, AuthError, UserProfile } from './types';

// Modal modes
type SocialAuthMode = 'login' | 'register' | 'link' | 'select';

// OAuth flow types
type OAuthMode = 'popup' | 'redirect';

interface SocialAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: SocialAuthMode;
  providers?: AuthProvider[];
  onSuccess?: (user: any, provider: AuthProvider) => void;
  onError?: (error: AuthError) => void;
  onRegister?: (data: { provider: AuthProvider; action: string }) => void;
  onModeChange?: (mode: SocialAuthMode) => void;
  className?: string;
  title?: string;
  subtitle?: string;
  oauthMode?: OAuthMode;
  showBenefits?: boolean;
  showPrivacyNote?: boolean;
  redirectTo?: string;
  allowModeSwitch?: boolean;
  customContent?: React.ReactNode;
}

interface ModalState {
  isProcessing: boolean;
  currentProvider: AuthProvider | null;
  error: AuthError | null;
  step: 'selection' | 'processing' | 'success' | 'error';
  user: any;
}

// Benefits of social login
const socialBenefits = [
  {
    icon: Zap,
    title: 'Quick & Easy',
    description: 'Sign in with just one click using your existing account'
  },
  {
    icon: Shield,
    title: 'Secure',
    description: 'No need to create or remember another password'
  },
  {
    icon: Users,
    title: 'Trusted',
    description: 'Use accounts you already know and trust'
  }
];

export const SocialAuthModal: React.FC<SocialAuthModalProps> = ({
  isOpen,
  onClose,
  mode = 'login',
  providers = ['google', 'apple', 'facebook', 'github'],
  onSuccess,
  onError,
  onRegister,
  onModeChange,
  className = '',
  title,
  subtitle,
  oauthMode = 'redirect',
  showBenefits = true,
  showPrivacyNote = true,
  redirectTo = '/',
  allowModeSwitch = true,
  customContent
}) => {
  const { signInWithProvider, state: authState } = useAuth();
  
  const [modalState, setModalState] = useState<ModalState>({
    isProcessing: false,
    currentProvider: null,
    error: null,
    step: 'selection',
    user: null
  });

  // Handle escape key
  const handleEscapeKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && !modalState.isProcessing) {
      onClose();
    }
  }, [onClose, modalState.isProcessing]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((event: React.MouseEvent) => {
    if (event.target === event.currentTarget && !modalState.isProcessing) {
      onClose();
    }
  }, [onClose, modalState.isProcessing]);

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

  // Reset modal state when closed
  useEffect(() => {
    if (!isOpen) {
      setModalState({
        isProcessing: false,
        currentProvider: null,
        error: null,
        step: 'selection',
        user: null
      });
    }
  }, [isOpen]);

  const handleSocialLogin = async (provider: AuthProvider) => {
    setModalState(prev => ({
      ...prev,
      isProcessing: true,
      currentProvider: provider,
      error: null,
      step: 'processing'
    }));

    try {
      // Track attempt
      if (typeof window !== 'undefined') {
        window.gtag?.('event', 'social_auth_modal_attempt', {
          provider,
          mode,
          oauth_mode: oauthMode
        });
      }

      let result;

      if (oauthMode === 'popup') {
        // Popup OAuth flow
        result = await handlePopupOAuth(provider);
      } else {
        // Redirect OAuth flow
        result = await signInWithProvider(provider, {
          redirectTo: redirectTo
        });
      }

      if (result.error) {
        throw result.error;
      }

      setModalState(prev => ({
        ...prev,
        step: 'success',
        user: result.user
      }));

      // Handle different modes
      if (mode === 'register') {
        onRegister?.({ provider, action: 'register' });
      }

      onSuccess?.(result.user, provider);

      // Track success
      if (typeof window !== 'undefined') {
        window.gtag?.('event', 'social_auth_modal_success', {
          provider,
          mode,
          user_id: result.user?.id
        });
      }

      // Auto-close after success (redirect mode)
      if (oauthMode === 'redirect') {
        setTimeout(() => {
          onClose();
        }, 1500);
      }

    } catch (error: any) {
      const authError: AuthError = {
        message: error.message || `Failed to sign in with ${provider}`,
        code: error.code || 'social_auth_error',
        provider
      };

      setModalState(prev => ({
        ...prev,
        error: authError,
        step: 'error'
      }));

      onError?.(authError);

      // Track error
      if (typeof window !== 'undefined') {
        window.gtag?.('event', 'social_auth_modal_error', {
          provider,
          mode,
          error_code: authError.code,
          error_message: authError.message
        });
      }
    } finally {
      setModalState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const handlePopupOAuth = async (provider: AuthProvider): Promise<{ user: any; error?: AuthError }> => {
    return new Promise((resolve, reject) => {
      const popup = window.open(
        `/api/auth/oauth?provider=${provider}&mode=popup`,
        `${provider}-oauth`,
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        reject(new Error('Failed to open popup window. Please check your popup blocker.'));
        return;
      }

      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        const { type, data } = event.data;

        if (type === 'oauth-success') {
          window.removeEventListener('message', handleMessage);
          popup.close();
          resolve({ user: data.user });
        } else if (type === 'oauth-error') {
          window.removeEventListener('message', handleMessage);
          popup.close();
          reject(new Error(data.message || 'OAuth authentication failed'));
        }
      };

      window.addEventListener('message', handleMessage);

      // Handle popup closed manually
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          reject(new Error('Authentication was cancelled'));
        }
      }, 1000);
    });
  };

  const getModalTitle = () => {
    if (title) return title;

    switch (mode) {
      case 'login':
        return 'Sign in to your account';
      case 'register':
        return 'Create your account';
      case 'link':
        return 'Link your accounts';
      case 'select':
        return 'Choose your sign-in method';
      default:
        return 'Authenticate';
    }
  };

  const getModalSubtitle = () => {
    if (subtitle) return subtitle;

    switch (mode) {
      case 'login':
        return 'Continue with your preferred social account';
      case 'register':
        return 'Get started quickly with social registration';
      case 'link':
        return 'Connect additional accounts for easier access';
      case 'select':
        return 'Select how you\'d like to proceed';
      default:
        return 'Choose your preferred authentication method';
    }
  };

  const renderModalContent = () => {
    switch (modalState.step) {
      case 'selection':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="text-center">
              <h2 className="text-2xl font-bold text-cream mb-2">
                {getModalTitle()}
              </h2>
              <p className="text-sage/70">
                {getModalSubtitle()}
              </p>
            </div>

            {/* Social Login Buttons */}
            <SocialLoginGroup
              providers={providers}
              variant="default"
              size="md"
              layout="vertical"
              onSuccess={(user) => handleSocialLogin}
              onError={(error) => setModalState(prev => ({ ...prev, error }))}
              priorityOrder={['google', 'apple', 'facebook', 'github']}
            />

            {/* Custom Content */}
            {customContent}

            {/* Benefits Section */}
            {showBenefits && (
              <div className="space-y-4">
                <SocialLoginDivider text="Why use social login?" />
                
                <div className="grid grid-cols-1 gap-3">
                  {socialBenefits.map((benefit, index) => (
                    <motion.div
                      key={benefit.title}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center gap-3 p-3 rounded-lg bg-sage/5"
                    >
                      <div className="w-8 h-8 bg-teal-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <benefit.icon className="w-4 h-4 text-teal-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-cream text-sm">
                          {benefit.title}
                        </h4>
                        <p className="text-sage/70 text-xs">
                          {benefit.description}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Mode Switch */}
            {allowModeSwitch && (
              <div className="text-center space-y-2">
                {mode === 'login' && (
                  <p className="text-sage/70 text-sm">
                    Don't have an account?{' '}
                    <button
                      onClick={() => onModeChange?.('register')}
                      className="text-teal-primary hover:text-teal-secondary font-medium"
                    >
                      Sign up instead
                    </button>
                  </p>
                )}

                {mode === 'register' && (
                  <p className="text-sage/70 text-sm">
                    Already have an account?{' '}
                    <button
                      onClick={() => onModeChange?.('login')}
                      className="text-teal-primary hover:text-teal-secondary font-medium"
                    >
                      Sign in instead
                    </button>
                  </p>
                )}
              </div>
            )}

            {/* Privacy Note */}
            {showPrivacyNote && (
              <div className="text-center text-xs text-sage/50">
                <p>
                  By continuing, you agree to our{' '}
                  <a href="/privacy" className="text-teal-primary hover:underline">
                    Privacy Policy
                  </a>{' '}
                  and{' '}
                  <a href="/terms" className="text-teal-primary hover:underline">
                    Terms of Service
                  </a>
                </p>
              </div>
            )}
          </motion.div>
        );

      case 'processing':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8 space-y-6"
          >
            <div className="w-20 h-20 mx-auto relative">
              <div className="absolute inset-0 bg-gradient-to-r from-teal-primary to-teal-secondary rounded-full animate-pulse" />
              <div className="absolute inset-2 bg-navy-dark rounded-full flex items-center justify-center">
                <LoadingSpinner size="md" className="text-teal-primary" />
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-cream mb-2">
                {oauthMode === 'popup' ? 'Opening authentication...' : 'Redirecting...'}
              </h3>
              <p className="text-sage/70">
                {modalState.currentProvider && (
                  <>
                    Signing you in with {modalState.currentProvider.charAt(0).toUpperCase() + modalState.currentProvider.slice(1)}
                  </>
                )}
              </p>
            </div>

            {oauthMode === 'popup' && (
              <div className="text-sm text-sage/50">
                <p>A popup window will open for authentication.</p>
                <p>Please complete the sign-in process there.</p>
              </div>
            )}
          </motion.div>
        );

      case 'success':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8 space-y-6"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-20 h-20 bg-sage/20 rounded-full flex items-center justify-center mx-auto"
            >
              <CheckCircle className="w-12 h-12 text-sage" />
            </motion.div>

            <div>
              <h3 className="text-xl font-bold text-cream mb-2">
                {mode === 'register' ? 'Account created!' : 'Welcome back!'}
              </h3>
              <p className="text-sage/70">
                You've successfully {mode === 'register' ? 'created your account' : 'signed in'} with {modalState.currentProvider}.
              </p>
              {modalState.user?.user_metadata?.full_name && (
                <p className="text-teal-primary font-medium mt-2">
                  Hello, {modalState.user.user_metadata.full_name}!
                </p>
              )}
            </div>

            {oauthMode === 'redirect' && (
              <div className="flex items-center justify-center gap-2 text-sm text-sage/60">
                <LoadingSpinner size="sm" />
                <span>Taking you to your account...</span>
              </div>
            )}
          </motion.div>
        );

      case 'error':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-6"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-20 h-20 bg-red-error/20 rounded-full flex items-center justify-center mx-auto"
            >
              <AlertTriangle className="w-12 h-12 text-red-error" />
            </motion.div>

            <div>
              <h3 className="text-xl font-bold text-cream mb-2">
                Authentication Failed
              </h3>
              <p className="text-red-error">
                {modalState.error?.message || 'An error occurred during authentication'}
              </p>
              {modalState.error?.code && (
                <p className="text-sage/50 text-sm mt-2">
                  Error Code: {modalState.error.code}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setModalState(prev => ({ 
                  ...prev, 
                  step: 'selection', 
                  error: null,
                  currentProvider: null
                }))}
                className={cn(
                  'w-full px-6 py-3 rounded-lg font-medium transition-all duration-200',
                  'bg-gradient-to-r from-teal-primary to-teal-secondary text-cream',
                  'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
                  'focus:outline-none focus:ring-2 focus:ring-teal-primary/50'
                )}
              >
                Try Again
              </button>

              <button
                onClick={onClose}
                className={cn(
                  'w-full px-6 py-3 rounded-lg font-medium transition-all duration-200',
                  'bg-transparent border border-sage/30 text-sage',
                  'hover:bg-sage/10 hover:border-sage/50'
                )}
              >
                Cancel
              </button>
            </div>

            <div className="text-left">
              <details className="text-sm text-sage/60">
                <summary className="cursor-pointer hover:text-sage">
                  Troubleshooting tips
                </summary>
                <div className="mt-2 space-y-1 ml-4">
                  <p>• Make sure pop-ups are enabled in your browser</p>
                  <p>• Clear your browser cache and cookies</p>
                  <p>• Try a different browser or incognito mode</p>
                  <p>• Check your internet connection</p>
                </div>
              </details>
            </div>
          </motion.div>
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
          aria-labelledby="social-auth-modal-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <GlassMorphism variant="strong" className="p-8">
              {/* Close Button */}
              {!modalState.isProcessing && (
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 text-sage/70 hover:text-cream hover:bg-navy-dark/50 rounded-lg transition-all duration-200"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              )}

              {/* Back Button */}
              {modalState.step === 'error' && (
                <button
                  onClick={() => setModalState(prev => ({ 
                    ...prev, 
                    step: 'selection', 
                    error: null 
                  }))}
                  className="absolute top-4 left-4 p-2 text-sage/70 hover:text-cream hover:bg-navy-dark/50 rounded-lg transition-all duration-200"
                  aria-label="Go back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}

              {/* Modal Content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={modalState.step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {renderModalContent()}
                </motion.div>
              </AnimatePresence>
            </GlassMorphism>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Hook for managing social auth modal state
export const useSocialAuthModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<SocialAuthMode>('login');

  const openLogin = (providers?: AuthProvider[]) => {
    setMode('login');
    setIsOpen(true);
  };

  const openRegister = (providers?: AuthProvider[]) => {
    setMode('register');
    setIsOpen(true);
  };

  const openLink = (providers?: AuthProvider[]) => {
    setMode('link');
    setIsOpen(true);
  };

  const openSelect = (providers?: AuthProvider[]) => {
    setMode('select');
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
  };

  const changeMode = (newMode: SocialAuthMode) => {
    setMode(newMode);
  };

  return {
    isOpen,
    mode,
    openLogin,
    openRegister,
    openLink,
    openSelect,
    close,
    changeMode
  };
};

export default SocialAuthModal;