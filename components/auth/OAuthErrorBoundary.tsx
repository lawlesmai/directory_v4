'use client';

import React, { Component, ErrorInfo, ReactNode, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  RefreshCw, 
  ArrowLeft, 
  ExternalLink, 
  Copy,
  CheckCircle,
  Mail,
  MessageSquare,
  Bug,
  Wifi,
  Shield,
  Clock,
  Settings,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '../GlassMorphism';
import { LoadingSpinner } from './LoadingStates';
import type { AuthProvider, AuthError } from './types';

// Error boundary props
interface OAuthErrorBoundaryProps {
  children: ReactNode;
  fallback?: (props: ErrorFallbackProps) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  provider?: AuthProvider;
  isolate?: boolean;
}

// Error boundary state
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

// Error fallback props
export interface ErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  resetError: () => void;
  provider?: AuthProvider;
  errorId: string;
}

// OAuth specific error types
export type OAuthErrorType = 
  | 'access_denied'
  | 'invalid_request'
  | 'unauthorized_client'
  | 'unsupported_response_type'
  | 'invalid_scope'
  | 'server_error'
  | 'temporarily_unavailable'
  | 'network_error'
  | 'popup_blocked'
  | 'popup_closed'
  | 'configuration_error'
  | 'rate_limited'
  | 'account_disabled'
  | 'email_not_verified'
  | 'unknown_error';

// OAuth error details
interface OAuthErrorDetails {
  type: OAuthErrorType;
  title: string;
  description: string;
  userMessage: string;
  icon: React.ComponentType<any>;
  color: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  actionable: boolean;
  contactSupport: boolean;
  troubleshooting: string[];
  retryable: boolean;
}

// OAuth error configurations
const oauthErrorConfigs: Record<OAuthErrorType, OAuthErrorDetails> = {
  access_denied: {
    type: 'access_denied',
    title: 'Access Denied',
    description: 'You denied access to the authentication request',
    userMessage: 'Access was denied during authentication. This is normal if you chose not to continue.',
    icon: Shield,
    color: 'text-yellow-500',
    severity: 'low',
    recoverable: true,
    actionable: true,
    contactSupport: false,
    troubleshooting: [
      'Click "Try Again" to restart the authentication process',
      'Make sure you accept the permissions when prompted',
      'Check that you\'re signed in to the correct account'
    ],
    retryable: true
  },
  invalid_request: {
    type: 'invalid_request',
    title: 'Invalid Request',
    description: 'The authentication request was malformed or invalid',
    userMessage: 'There was a problem with the authentication request. Please try again.',
    icon: AlertTriangle,
    color: 'text-orange-500',
    severity: 'medium',
    recoverable: true,
    actionable: true,
    contactSupport: true,
    troubleshooting: [
      'Clear your browser cache and cookies',
      'Try using an incognito/private browsing window',
      'Ensure your browser is up to date'
    ],
    retryable: true
  },
  popup_blocked: {
    type: 'popup_blocked',
    title: 'Popup Blocked',
    description: 'Your browser blocked the authentication popup window',
    userMessage: 'Authentication popup was blocked. Please allow popups for this site and try again.',
    icon: ExternalLink,
    color: 'text-blue-500',
    severity: 'medium',
    recoverable: true,
    actionable: true,
    contactSupport: false,
    troubleshooting: [
      'Enable popups for this website in your browser settings',
      'Look for a popup blocker icon in your address bar',
      'Try using redirect authentication instead',
      'Temporarily disable browser extensions that block popups'
    ],
    retryable: true
  },
  network_error: {
    type: 'network_error',
    title: 'Network Error',
    description: 'Unable to connect to the authentication service',
    userMessage: 'There was a network problem. Please check your connection and try again.',
    icon: Wifi,
    color: 'text-red-500',
    severity: 'medium',
    recoverable: true,
    actionable: true,
    contactSupport: false,
    troubleshooting: [
      'Check your internet connection',
      'Try again in a few moments',
      'Disable VPN if you\'re using one',
      'Try using a different network'
    ],
    retryable: true
  },
  server_error: {
    type: 'server_error',
    title: 'Server Error',
    description: 'The authentication server encountered an error',
    userMessage: 'The authentication service is experiencing issues. Please try again later.',
    icon: AlertTriangle,
    color: 'text-red-500',
    severity: 'high',
    recoverable: true,
    actionable: false,
    contactSupport: true,
    troubleshooting: [
      'Wait a few minutes and try again',
      'The issue is on our end and should be resolved soon',
      'Try using a different authentication method'
    ],
    retryable: true
  },
  temporarily_unavailable: {
    type: 'temporarily_unavailable',
    title: 'Service Unavailable',
    description: 'The authentication service is temporarily unavailable',
    userMessage: 'The authentication service is temporarily down. Please try again in a few minutes.',
    icon: Clock,
    color: 'text-yellow-500',
    severity: 'medium',
    recoverable: true,
    actionable: false,
    contactSupport: false,
    troubleshooting: [
      'Wait 5-10 minutes and try again',
      'Check the service status page',
      'Try using a different authentication method'
    ],
    retryable: true
  },
  rate_limited: {
    type: 'rate_limited',
    title: 'Too Many Attempts',
    description: 'Too many authentication attempts in a short period',
    userMessage: 'You\'ve tried to authenticate too many times. Please wait before trying again.',
    icon: Clock,
    color: 'text-orange-500',
    severity: 'medium',
    recoverable: true,
    actionable: false,
    contactSupport: false,
    troubleshooting: [
      'Wait 15-30 minutes before trying again',
      'Avoid rapid repeated attempts',
      'Clear your browser data if the issue persists'
    ],
    retryable: true
  },
  account_disabled: {
    type: 'account_disabled',
    title: 'Account Disabled',
    description: 'The account has been disabled by the provider',
    userMessage: 'This account has been disabled. Please contact support or try a different account.',
    icon: Shield,
    color: 'text-red-500',
    severity: 'high',
    recoverable: false,
    actionable: true,
    contactSupport: true,
    troubleshooting: [
      'Contact the account provider (Google, Facebook, etc.) to resolve account issues',
      'Try using a different account',
      'Use email/password authentication instead'
    ],
    retryable: false
  },
  unknown_error: {
    type: 'unknown_error',
    title: 'Unknown Error',
    description: 'An unexpected error occurred during authentication',
    userMessage: 'Something unexpected went wrong. Please try again or contact support.',
    icon: Bug,
    color: 'text-purple-500',
    severity: 'high',
    recoverable: true,
    actionable: true,
    contactSupport: true,
    troubleshooting: [
      'Try again in a few minutes',
      'Clear your browser cache and cookies',
      'Try using a different browser or device',
      'Use a different authentication method'
    ],
    retryable: true
  },
  unauthorized_client: {
    type: 'unauthorized_client',
    title: 'Unauthorized Client',
    description: 'The client is not authorized to make this request',
    userMessage: 'There was an authorization issue. Please try again.',
    icon: Shield,
    color: 'text-red-500',
    severity: 'high',
    recoverable: true,
    actionable: true,
    contactSupport: true,
    troubleshooting: ['Try logging in again', 'Contact support if the issue persists'],
    retryable: true
  },
  unsupported_response_type: {
    type: 'unsupported_response_type',
    title: 'Unsupported Response Type',
    description: 'The server does not support this response type',
    userMessage: 'This authentication method is not supported. Please try a different method.',
    icon: AlertTriangle,
    color: 'text-yellow-500',
    severity: 'medium',
    recoverable: true,
    actionable: true,
    contactSupport: false,
    troubleshooting: ['Try a different authentication method'],
    retryable: false
  },
  invalid_scope: {
    type: 'invalid_scope',
    title: 'Invalid Scope',
    description: 'The requested scope is invalid or unknown',
    userMessage: 'There was a configuration issue. Please contact support.',
    icon: Settings,
    color: 'text-orange-500',
    severity: 'medium',
    recoverable: false,
    actionable: false,
    contactSupport: true,
    troubleshooting: ['Contact support for assistance'],
    retryable: false
  },
  popup_closed: {
    type: 'popup_closed',
    title: 'Authentication Cancelled',
    description: 'The authentication window was closed before completing',
    userMessage: 'Authentication was cancelled. Click "Try Again" to restart.',
    icon: X,
    color: 'text-gray-500',
    severity: 'low',
    recoverable: true,
    actionable: true,
    contactSupport: false,
    troubleshooting: ['Click "Try Again" to restart authentication', 'Make sure to complete the authentication process'],
    retryable: true
  },
  configuration_error: {
    type: 'configuration_error',
    title: 'Configuration Error',
    description: 'There is a configuration problem with the authentication system',
    userMessage: 'There is a system configuration issue. Please contact support.',
    icon: Settings,
    color: 'text-red-500',
    severity: 'high',
    recoverable: false,
    actionable: false,
    contactSupport: true,
    troubleshooting: ['Contact support for technical assistance'],
    retryable: false
  },
  email_not_verified: {
    type: 'email_not_verified',
    title: 'Email Not Verified',
    description: 'Your email address has not been verified',
    userMessage: 'Please verify your email address before continuing.',
    icon: Mail,
    color: 'text-blue-500',
    severity: 'medium',
    recoverable: true,
    actionable: true,
    contactSupport: false,
    troubleshooting: ['Check your email for verification link', 'Resend verification email if needed'],
    retryable: true
  }
};

// Helper function to determine error type from error message/code
const determineErrorType = (error: Error): OAuthErrorType => {
  const message = error.message.toLowerCase();
  const name = error.name?.toLowerCase();

  if (message.includes('access_denied') || message.includes('access denied')) {
    return 'access_denied';
  }
  if (message.includes('popup') && message.includes('block')) {
    return 'popup_blocked';
  }
  if (message.includes('popup') && message.includes('closed')) {
    return 'popup_closed';
  }
  if (message.includes('network') || name === 'networkerror') {
    return 'network_error';
  }
  if (message.includes('server error') || message.includes('500')) {
    return 'server_error';
  }
  if (message.includes('temporarily unavailable') || message.includes('503')) {
    return 'temporarily_unavailable';
  }
  if (message.includes('rate limit') || message.includes('too many')) {
    return 'rate_limited';
  }
  if (message.includes('invalid_request')) {
    return 'invalid_request';
  }
  if (message.includes('account') && message.includes('disabled')) {
    return 'account_disabled';
  }

  return 'unknown_error';
};

// Error boundary class component
export class OAuthErrorBoundary extends Component<OAuthErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: OAuthErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `oauth-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      errorInfo
    });

    // Track error
    if (typeof window !== 'undefined') {
      window.gtag?.('event', 'oauth_error_boundary', {
        error_type: determineErrorType(error),
        error_message: error.message,
        provider: this.props.provider,
        component_stack: errorInfo.componentStack
      });
    }

    // Call custom error handler
    this.props.onError?.(error, errorInfo);
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const fallbackProps: ErrorFallbackProps = {
        error: this.state.error,
        errorInfo: this.state.errorInfo,
        resetError: this.resetError,
        provider: this.props.provider,
        errorId: this.state.errorId
      };

      if (this.props.fallback) {
        return this.props.fallback(fallbackProps);
      }

      return <DefaultOAuthErrorFallback {...fallbackProps} />;
    }

    return this.props.children;
  }
}

// Default error fallback component
export const DefaultOAuthErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorInfo,
  resetError,
  provider,
  errorId
}) => {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const errorType = determineErrorType(error);
  const config = oauthErrorConfigs[errorType];

  const handleCopyError = async () => {
    const errorText = `
Error ID: ${errorId}
Provider: ${provider || 'unknown'}
Type: ${errorType}
Message: ${error.message}
Stack: ${error.stack}
Component Stack: ${errorInfo?.componentStack}
    `.trim();

    try {
      await navigator.clipboard.writeText(errorText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy to clipboard');
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    resetError();
  };

  const getProviderName = () => {
    if (!provider) return 'authentication service';
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  };

  const IconComponent = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto p-4"
    >
      <GlassMorphism variant="strong" className="p-8">
        <div className="text-center space-y-6">
          {/* Error Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className={cn(
              'w-20 h-20 rounded-full flex items-center justify-center mx-auto',
              config.severity === 'critical' ? 'bg-red-500/20' :
              config.severity === 'high' ? 'bg-orange-500/20' :
              config.severity === 'medium' ? 'bg-yellow-500/20' : 'bg-blue-500/20'
            )}
          >
            <IconComponent className={cn('w-10 h-10', config.color)} />
          </motion.div>

          {/* Error Title */}
          <div>
            <h2 className="text-2xl font-bold text-cream mb-2">
              {config.title}
            </h2>
            <p className="text-sage/70 text-lg">
              {config.userMessage}
            </p>
          </div>

          {/* Provider Context */}
          {provider && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-sage/10 rounded-lg text-sm text-sage">
              <span>Authentication with {getProviderName()}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {config.retryable && (
              <button
                onClick={handleRetry}
                className={cn(
                  'px-6 py-3 rounded-lg font-medium transition-all duration-200',
                  'bg-gradient-to-r from-teal-primary to-teal-secondary text-cream',
                  'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
                  'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                  'flex items-center justify-center gap-2'
                )}
              >
                <RefreshCw className="w-4 h-4" />
                Try Again {retryCount > 0 && `(${retryCount + 1})`}
              </button>
            )}

            <button
              onClick={() => window.history.back()}
              className={cn(
                'px-6 py-3 rounded-lg font-medium transition-all duration-200',
                'bg-transparent border border-sage/30 text-sage',
                'hover:bg-sage/10 hover:border-sage/50',
                'focus:outline-none focus:ring-2 focus:ring-sage/50',
                'flex items-center justify-center gap-2'
              )}
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </button>
          </div>

          {/* Alternative Actions */}
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <button
              onClick={() => window.location.href = '/login'}
              className="text-teal-primary hover:text-teal-secondary flex items-center gap-1"
            >
              Try Different Method
            </button>

            {config.contactSupport && (
              <button
                onClick={() => window.location.href = '/support'}
                className="text-sage/70 hover:text-sage flex items-center gap-1"
              >
                <MessageSquare className="w-3 h-3" />
                Contact Support
              </button>
            )}
          </div>

          {/* Troubleshooting */}
          {config.troubleshooting.length > 0 && (
            <div className="text-left bg-sage/5 rounded-lg p-4">
              <h4 className="font-medium text-cream mb-3 flex items-center gap-2">
                <Bug className="w-4 h-4" />
                Troubleshooting Tips
              </h4>
              <ul className="space-y-2 text-sm text-sage/70">
                {config.troubleshooting.map((tip, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-teal-primary mt-1">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Error Details Toggle */}
          <div className="text-left">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-sage/50 hover:text-sage flex items-center gap-1"
            >
              Technical Details
              <motion.div
                animate={{ rotate: showDetails ? 180 : 0 }}
                className="w-3 h-3"
              >
                ▼
              </motion.div>
            </button>

            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 p-4 bg-navy-dark/50 rounded-lg text-left overflow-hidden"
                >
                  <div className="space-y-3 text-sm font-mono">
                    <div>
                      <span className="text-sage/50">Error ID:</span>
                      <span className="ml-2 text-cream">{errorId}</span>
                    </div>
                    <div>
                      <span className="text-sage/50">Type:</span>
                      <span className="ml-2 text-cream">{errorType}</span>
                    </div>
                    <div>
                      <span className="text-sage/50">Message:</span>
                      <span className="ml-2 text-cream break-all">{error.message}</span>
                    </div>
                    {provider && (
                      <div>
                        <span className="text-sage/50">Provider:</span>
                        <span className="ml-2 text-cream">{provider}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleCopyError}
                    className={cn(
                      'mt-4 px-3 py-1.5 text-xs rounded border transition-all',
                      'border-sage/30 text-sage/70 hover:border-sage/50 hover:text-sage',
                      'flex items-center gap-2'
                    )}
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="w-3 h-3" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy Error Details
                      </>
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </GlassMorphism>
    </motion.div>
  );
};

// Hook for handling OAuth errors in components
export const useOAuthErrorHandler = () => {
  const [error, setError] = useState<AuthError | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  const handleError = (authError: AuthError) => {
    setError(authError);

    // Track error
    if (typeof window !== 'undefined') {
      window.gtag?.('event', 'oauth_error_handled', {
        error_code: authError.code,
        error_message: authError.message,
        provider: authError.provider
      });
    }
  };

  const clearError = () => {
    setError(null);
    setIsRecovering(false);
  };

  const retryWithRecovery = async (recoveryFn: () => Promise<void>) => {
    setIsRecovering(true);
    try {
      await recoveryFn();
      clearError();
    } catch (err: any) {
      handleError({
        message: err.message || 'Recovery failed',
        code: err.code || 'recovery_failed',
        provider: error?.provider
      });
    } finally {
      setIsRecovering(false);
    }
  };

  return {
    error,
    isRecovering,
    handleError,
    clearError,
    retryWithRecovery
  };
};

export default OAuthErrorBoundary;