'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertTriangle, RefreshCw, ArrowLeft, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '../GlassMorphism';
import { LoadingSpinner, StepProgress } from './LoadingStates';
import { useAuth } from '@/contexts/AuthContext';
import type { AuthProvider, AuthError } from './types';

// OAuth flow steps
type OAuthStep = 'validating' | 'exchanging' | 'completing' | 'success' | 'error';

interface OAuthCallbackProps {
  provider?: AuthProvider;
  onSuccess?: (user: any) => void;
  onError?: (error: AuthError) => void;
  className?: string;
  showProgress?: boolean;
  redirectTo?: string;
}

interface OAuthState {
  step: OAuthStep;
  progress: number;
  message: string;
  error?: AuthError;
  user?: any;
}

export const OAuthCallback: React.FC<OAuthCallbackProps> = ({
  provider,
  onSuccess,
  onError,
  className = '',
  showProgress = true,
  redirectTo = '/'
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInWithProvider, state: authState } = useAuth();
  
  const [oauthState, setOauthState] = useState<OAuthState>({
    step: 'validating',
    progress: 0,
    message: 'Validating authentication request...'
  });

  // Extract OAuth parameters from URL
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const detectedProvider = provider || searchParams.get('provider') as AuthProvider;

  const handleOAuthFlow = useCallback(async () => {
    try {
      // Step 1: Validate request
      setOauthState({
        step: 'validating',
        progress: 25,
        message: 'Validating authentication request...'
      });

      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate validation

      if (error) {
        throw new Error(errorDescription || `OAuth error: ${error}`);
      }

      if (!code || !detectedProvider) {
        throw new Error('Missing required OAuth parameters');
      }

      // Step 2: Exchange code for tokens
      setOauthState({
        step: 'exchanging',
        progress: 50,
        message: 'Exchanging authorization code...'
      });

      const response = await fetch('/api/auth/oauth/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: detectedProvider,
          code,
          state,
          redirectUri: `${window.location.origin}/auth/callback/${detectedProvider}`
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to exchange authorization code');
      }

      const { user, session } = await response.json();

      // Step 3: Complete authentication
      setOauthState({
        step: 'completing',
        progress: 75,
        message: 'Completing sign in...'
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 4: Success
      setOauthState({
        step: 'success',
        progress: 100,
        message: 'Sign in successful!',
        user
      });

      // Track success
      if (typeof window !== 'undefined') {
        window.gtag?.('event', 'oauth_callback_success', {
          provider: detectedProvider,
          user_id: user?.id
        });
      }

      onSuccess?.(user);

      // Redirect after short delay
      setTimeout(() => {
        router.push(redirectTo);
      }, 2000);

    } catch (err: any) {
      const authError: AuthError = {
        message: err.message || 'Authentication failed',
        code: err.code || 'oauth_callback_error',
        provider: detectedProvider
      };

      setOauthState({
        step: 'error',
        progress: 0,
        message: authError.message,
        error: authError
      });

      // Track error
      if (typeof window !== 'undefined') {
        window.gtag?.('event', 'oauth_callback_error', {
          provider: detectedProvider,
          error_code: authError.code,
          error_message: authError.message
        });
      }

      onError?.(authError);
    }
  }, [code, state, error, errorDescription, detectedProvider, onSuccess, onError, redirectTo, router]);

  useEffect(() => {
    handleOAuthFlow();
  }, [handleOAuthFlow]);

  const handleRetry = () => {
    setOauthState({
      step: 'validating',
      progress: 0,
      message: 'Retrying authentication...'
    });
    handleOAuthFlow();
  };

  const handleBackToLogin = () => {
    router.push('/login');
  };

  const getStepNumber = (step: OAuthStep): number => {
    switch (step) {
      case 'validating': return 1;
      case 'exchanging': return 2;
      case 'completing': return 3;
      case 'success': return 4;
      case 'error': return 1;
      default: return 1;
    }
  };

  const getProviderName = () => {
    if (!detectedProvider) return 'your account';
    return detectedProvider.charAt(0).toUpperCase() + detectedProvider.slice(1);
  };

  const renderStepContent = () => {
    switch (oauthState.step) {
      case 'validating':
      case 'exchanging':
      case 'completing':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-6"
          >
            <div className="w-20 h-20 mx-auto relative">
              <div className="absolute inset-0 bg-gradient-to-r from-teal-primary to-teal-secondary rounded-full animate-pulse" />
              <div className="absolute inset-2 bg-navy-dark rounded-full flex items-center justify-center">
                <LoadingSpinner size="md" className="text-teal-primary" />
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-cream">
                Completing Sign In
              </h2>
              <p className="text-sage/70 text-lg">
                {oauthState.message}
              </p>
            </div>

            {showProgress && (
              <div className="space-y-3">
                <StepProgress 
                  currentStep={getStepNumber(oauthState.step)} 
                  totalSteps={4}
                />
                <div className="text-sm text-sage/60">
                  Step {getStepNumber(oauthState.step)} of 4
                </div>
              </div>
            )}

            <div className="text-sm text-sage/50">
              Please wait while we complete your {getProviderName()} sign in...
            </div>
          </motion.div>
        );

      case 'success':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ 
                delay: 0.2, 
                type: 'spring', 
                stiffness: 200,
                damping: 10 
              }}
              className="w-20 h-20 mx-auto bg-sage/20 rounded-full flex items-center justify-center"
            >
              <CheckCircle className="w-12 h-12 text-sage" />
            </motion.div>

            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-cream">
                Welcome!
              </h2>
              <p className="text-sage/70 text-lg">
                You've successfully signed in with {getProviderName()}
              </p>
              {oauthState.user?.user_metadata?.full_name && (
                <p className="text-teal-primary font-medium">
                  Hello, {oauthState.user.user_metadata.full_name}!
                </p>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-sage/60">
              <LoadingSpinner size="sm" />
              <span>Redirecting you now...</span>
            </div>
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
              transition={{ 
                delay: 0.2, 
                type: 'spring', 
                stiffness: 200 
              }}
              className="w-20 h-20 mx-auto bg-red-error/20 rounded-full flex items-center justify-center"
            >
              <AlertTriangle className="w-12 h-12 text-red-error" />
            </motion.div>

            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-cream">
                Sign In Failed
              </h2>
              <p className="text-red-error">
                {oauthState.error?.message || 'An error occurred during authentication'}
              </p>
              {oauthState.error?.code && (
                <p className="text-sage/50 text-sm">
                  Error Code: {oauthState.error.code}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <button
                onClick={handleRetry}
                className={cn(
                  'w-full px-6 py-3 rounded-lg font-medium transition-all duration-200',
                  'bg-gradient-to-r from-teal-primary to-teal-secondary text-cream',
                  'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
                  'focus:outline-none focus:ring-2 focus:ring-teal-primary/50 focus:ring-offset-2 focus:ring-offset-navy-dark',
                  'flex items-center justify-center gap-2'
                )}
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>

              <button
                onClick={handleBackToLogin}
                className={cn(
                  'w-full px-6 py-3 rounded-lg font-medium transition-all duration-200',
                  'bg-transparent border border-sage/30 text-sage',
                  'hover:bg-sage/10 hover:border-sage/50',
                  'focus:outline-none focus:ring-2 focus:ring-sage/50 focus:ring-offset-2 focus:ring-offset-navy-dark',
                  'flex items-center justify-center gap-2'
                )}
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </button>
            </div>

            <div className="pt-4 border-t border-sage/20">
              <details className="text-left">
                <summary className="text-sage/70 hover:text-sage cursor-pointer text-sm">
                  Need help? Show troubleshooting options
                </summary>
                <div className="mt-3 space-y-2 text-sm text-sage/60">
                  <p>If you continue to experience issues:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Clear your browser cache and cookies</li>
                    <li>Try using a different browser or incognito mode</li>
                    <li>Ensure {getProviderName()} allows sign-ins from this domain</li>
                    <li>Check if you have pop-up blockers enabled</li>
                  </ul>
                  <button
                    onClick={() => window.open('/support', '_blank')}
                    className="inline-flex items-center gap-1 text-teal-primary hover:text-teal-secondary"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Contact Support
                  </button>
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
    <div className={cn(
      'min-h-screen bg-gradient-to-br from-navy-dark via-navy-light to-navy-dark',
      'flex items-center justify-center p-4',
      className
    )}>
      <GlassMorphism 
        variant="strong" 
        className="w-full max-w-md mx-auto p-8"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={oauthState.step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>

        {/* Provider indicator */}
        {detectedProvider && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="absolute top-4 right-4 text-sage/50 text-sm"
          >
            via {getProviderName()}
          </motion.div>
        )}
      </GlassMorphism>

      {/* Background pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(10,147,150,0.1),transparent)]" />
        <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,transparent,rgba(148,210,189,0.1),transparent)]" />
      </div>
    </div>
  );
};

// OAuth callback page wrapper for Next.js pages
export const OAuthCallbackPage: React.FC<{
  params: { provider: string };
}> = ({ params }) => {
  const provider = params.provider as AuthProvider;
  
  const handleSuccess = (user: any) => {
    console.log('OAuth success:', user);
  };

  const handleError = (error: AuthError) => {
    console.error('OAuth error:', error);
  };

  return (
    <OAuthCallback
      provider={provider}
      onSuccess={handleSuccess}
      onError={handleError}
      showProgress={true}
    />
  );
};

// Hook for handling OAuth callbacks in components
export const useOAuthCallback = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ user?: any; error?: AuthError } | null>(null);

  const processCallback = async (
    provider: AuthProvider,
    code: string,
    state?: string
  ) => {
    setIsProcessing(true);
    setResult(null);

    try {
      const response = await fetch('/api/auth/oauth/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          code,
          state,
          redirectUri: `${window.location.origin}/auth/callback/${provider}`
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'OAuth callback failed');
      }

      const data = await response.json();
      setResult({ user: data.user });
      return { user: data.user, error: null };
    } catch (error: any) {
      const authError: AuthError = {
        message: error.message || 'OAuth callback failed',
        code: error.code || 'oauth_callback_error',
        provider
      };
      setResult({ error: authError });
      return { user: null, error: authError };
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    processCallback,
    isProcessing,
    result
  };
};

export default OAuthCallback;