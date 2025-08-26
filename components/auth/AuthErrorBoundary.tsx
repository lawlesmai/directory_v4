'use client';

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  RefreshCw,
  Home,
  LogOut,
  Shield,
  Bug,
  ArrowLeft,
  Mail,
  ExternalLink
} from 'lucide-react';
import { GlassMorphism } from '@/components/GlassMorphism';
import { cn } from '@/lib/utils';

// Error types specific to authentication
export enum AuthErrorType {
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  RATE_LIMITED = 'RATE_LIMITED',
  ACCOUNT_DISABLED = 'ACCOUNT_DISABLED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface AuthError extends Error {
  type?: AuthErrorType;
  code?: string;
  status?: number;
  details?: any;
  retryable?: boolean;
  timestamp?: Date;
}

// Error boundary state
interface ErrorBoundaryState {
  hasError: boolean;
  error: AuthError | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  isRetrying: boolean;
}

// Props for AuthErrorBoundary
interface AuthErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: AuthError, errorInfo: ErrorInfo) => void;
  onRetry?: () => void;
  onReset?: () => void;
  maxRetries?: number;
  showErrorDetails?: boolean;
  className?: string;
}

// Error classification utility
const classifyError = (error: Error): AuthError => {
  const authError = error as AuthError;
  
  // If already classified, return as-is
  if (authError.type) {
    return {
      ...authError,
      timestamp: authError.timestamp || new Date()
    };
  }

  // Classify based on error message or other properties
  let type = AuthErrorType.UNKNOWN_ERROR;
  let retryable = false;

  if (error.message.includes('session') || error.message.includes('expired')) {
    type = AuthErrorType.SESSION_EXPIRED;
    retryable = true;
  } else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
    type = AuthErrorType.PERMISSION_DENIED;
    retryable = false;
  } else if (error.message.includes('network') || error.message.includes('fetch')) {
    type = AuthErrorType.NETWORK_ERROR;
    retryable = true;
  } else if (error.message.includes('server') || error.message.includes('500')) {
    type = AuthErrorType.SERVER_ERROR;
    retryable = true;
  } else if (error.message.includes('rate') || error.message.includes('limit')) {
    type = AuthErrorType.RATE_LIMITED;
    retryable = true;
  } else if (error.message.includes('disabled') || error.message.includes('suspended')) {
    type = AuthErrorType.ACCOUNT_DISABLED;
    retryable = false;
  } else if (error.message.includes('token') || error.message.includes('invalid')) {
    type = AuthErrorType.INVALID_TOKEN;
    retryable = true;
  }

  return {
    ...authError,
    type,
    retryable,
    timestamp: new Date()
  };
};

// Error details component
const ErrorDetails: React.FC<{
  error: AuthError;
  errorInfo: ErrorInfo;
  isVisible: boolean;
  onToggle: () => void;
  className?: string;
}> = ({ error, errorInfo, isVisible, onToggle, className }) => (
  <div className={className}>
    <button
      onClick={onToggle}
      className="flex items-center gap-2 text-sm text-sage/70 hover:text-cream transition-colors"
    >
      <Bug className="w-4 h-4" />
      {isVisible ? 'Hide' : 'Show'} Technical Details
    </button>

    {isVisible && (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="mt-4 p-4 bg-navy-dark/50 rounded-lg border border-red-error/20"
      >
        <div className="space-y-3 text-sm">
          <div>
            <span className="text-sage/50">Error Type:</span>
            <span className="ml-2 text-red-error font-mono">{error.type}</span>
          </div>
          
          {error.code && (
            <div>
              <span className="text-sage/50">Error Code:</span>
              <span className="ml-2 text-red-error font-mono">{error.code}</span>
            </div>
          )}
          
          {error.status && (
            <div>
              <span className="text-sage/50">Status Code:</span>
              <span className="ml-2 text-red-error font-mono">{error.status}</span>
            </div>
          )}
          
          <div>
            <span className="text-sage/50">Message:</span>
            <p className="ml-2 text-cream break-words">{error.message}</p>
          </div>
          
          {error.timestamp && (
            <div>
              <span className="text-sage/50">Timestamp:</span>
              <span className="ml-2 text-sage/70">{error.timestamp.toISOString()}</span>
            </div>
          )}
          
          <details className="mt-4">
            <summary className="cursor-pointer text-sage/50 hover:text-sage">
              Component Stack
            </summary>
            <pre className="mt-2 p-2 bg-navy-dark/70 rounded text-xs text-sage/70 overflow-x-auto">
              {errorInfo.componentStack}
            </pre>
          </details>
        </div>
      </motion.div>
    )}
  </div>
);

// Error message component based on error type
const ErrorMessage: React.FC<{
  error: AuthError;
  className?: string;
}> = ({ error, className }) => {
  const getErrorConfig = (type: AuthErrorType) => {
    switch (type) {
      case AuthErrorType.SESSION_EXPIRED:
        return {
          title: 'Session Expired',
          description: 'Your session has expired for security reasons. Please sign in again to continue.',
          icon: Shield,
          color: 'text-yellow-500'
        };
      
      case AuthErrorType.PERMISSION_DENIED:
        return {
          title: 'Access Denied',
          description: 'You don\'t have permission to access this resource. Contact support if you believe this is an error.',
          icon: Shield,
          color: 'text-red-error'
        };
      
      case AuthErrorType.NETWORK_ERROR:
        return {
          title: 'Connection Problem',
          description: 'Unable to connect to our servers. Please check your internet connection and try again.',
          icon: RefreshCw,
          color: 'text-blue-400'
        };
      
      case AuthErrorType.SERVER_ERROR:
        return {
          title: 'Server Error',
          description: 'Our servers are experiencing issues. We\'re working to fix this. Please try again in a few minutes.',
          icon: AlertTriangle,
          color: 'text-orange-500'
        };
      
      case AuthErrorType.RATE_LIMITED:
        return {
          title: 'Too Many Attempts',
          description: 'You\'ve made too many requests. Please wait a few minutes before trying again.',
          icon: AlertTriangle,
          color: 'text-yellow-500'
        };
      
      case AuthErrorType.ACCOUNT_DISABLED:
        return {
          title: 'Account Disabled',
          description: 'Your account has been disabled. Please contact support for assistance.',
          icon: Shield,
          color: 'text-red-error'
        };
      
      case AuthErrorType.INVALID_TOKEN:
        return {
          title: 'Authentication Error',
          description: 'Your authentication token is invalid. Please sign in again.',
          icon: Shield,
          color: 'text-yellow-500'
        };
      
      default:
        return {
          title: 'Something Went Wrong',
          description: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
          icon: AlertTriangle,
          color: 'text-red-error'
        };
    }
  };

  const config = getErrorConfig(error.type || AuthErrorType.UNKNOWN_ERROR);
  const Icon = config.icon;

  return (
    <div className={cn('text-center space-y-4', className)}>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className={cn('w-16 h-16 mx-auto rounded-full flex items-center justify-center', 
          config.color.includes('red') ? 'bg-red-error/10' :
          config.color.includes('yellow') ? 'bg-yellow-500/10' :
          config.color.includes('blue') ? 'bg-blue-400/10' :
          'bg-orange-500/10'
        )}
      >
        <Icon className={cn('w-8 h-8', config.color)} />
      </motion.div>
      
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-cream">{config.title}</h3>
        <p className="text-sage/70 max-w-md mx-auto">{config.description}</p>
      </div>
    </div>
  );
};

// Action buttons component
const ErrorActions: React.FC<{
  error: AuthError;
  retryCount: number;
  maxRetries: number;
  isRetrying: boolean;
  onRetry: () => void;
  onReset: () => void;
  onGoHome: () => void;
  onSignOut: () => void;
  onContactSupport: () => void;
  className?: string;
}> = ({ 
  error, 
  retryCount, 
  maxRetries, 
  isRetrying, 
  onRetry, 
  onReset, 
  onGoHome, 
  onSignOut,
  onContactSupport,
  className 
}) => {
  const canRetry = error.retryable && retryCount < maxRetries;

  return (
    <div className={cn('flex flex-wrap justify-center gap-3', className)}>
      {canRetry && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onRetry}
          disabled={isRetrying}
          className={cn(
            'flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all',
            'bg-gradient-to-r from-teal-primary to-teal-secondary text-cream',
            'hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
            isRetrying && 'opacity-50 cursor-not-allowed'
          )}
        >
          <RefreshCw className={cn('w-4 h-4', isRetrying && 'animate-spin')} />
          {isRetrying ? 'Retrying...' : `Retry (${maxRetries - retryCount} left)`}
        </motion.button>
      )}

      <button
        onClick={onReset}
        className="flex items-center gap-2 px-6 py-3 rounded-lg border border-sage/30 text-sage/70 hover:text-cream hover:border-sage/50 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Reset
      </button>

      <button
        onClick={onGoHome}
        className="flex items-center gap-2 px-6 py-3 rounded-lg border border-sage/30 text-sage/70 hover:text-cream hover:border-sage/50 transition-colors"
      >
        <Home className="w-4 h-4" />
        Go Home
      </button>

      {[AuthErrorType.SESSION_EXPIRED, AuthErrorType.INVALID_TOKEN, AuthErrorType.AUTH_REQUIRED].includes(error.type!) && (
        <button
          onClick={onSignOut}
          className="flex items-center gap-2 px-6 py-3 rounded-lg bg-red-error/10 text-red-error hover:bg-red-error/20 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      )}

      <button
        onClick={onContactSupport}
        className="flex items-center gap-2 px-4 py-2 text-sm text-sage/50 hover:text-teal-primary transition-colors"
      >
        <Mail className="w-4 h-4" />
        Contact Support
        <ExternalLink className="w-3 h-3" />
      </button>
    </div>
  );
};

// Main AuthErrorBoundary class component
export class AuthErrorBoundary extends Component<AuthErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: AuthErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRetrying: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const authError = classifyError(error);
    return {
      hasError: true,
      error: authError
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const authError = classifyError(error);
    
    this.setState({
      error: authError,
      errorInfo
    });

    // Call onError callback
    this.props.onError?.(authError, errorInfo);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('AuthErrorBoundary caught an error:', authError);
      console.error('Error info:', errorInfo);
    }

    // In production, you might want to send this to an error reporting service
    // Analytics.trackError('auth_error_boundary', authError, errorInfo);
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    
    if (this.state.retryCount >= maxRetries) {
      return;
    }

    this.setState({ isRetrying: true });

    // Add delay for retries to prevent overwhelming the server
    const retryDelay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000);
    
    this.retryTimeoutId = setTimeout(() => {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1,
        isRetrying: false
      }));

      this.props.onRetry?.();
    }, retryDelay);
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRetrying: false
    });

    this.props.onReset?.();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleSignOut = () => {
    // Clear any stored auth data
    localStorage.clear();
    sessionStorage.clear();
    
    // Redirect to home or login
    window.location.href = '/';
  };

  handleContactSupport = () => {
    const subject = `Auth Error: ${this.state.error?.type || 'Unknown'}`;
    const body = `Hello,\n\nI encountered an authentication error:\n\nError: ${this.state.error?.message}\nType: ${this.state.error?.type}\nTimestamp: ${this.state.error?.timestamp}\n\nPlease help me resolve this issue.\n\nThanks!`;
    
    window.open(`mailto:support@lawless.directory?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Show custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const [showDetails, setShowDetails] = React.useState(false);

      // Render error UI
      return (
        <div className={cn('min-h-screen flex items-center justify-center p-4', this.props.className)}>
          <GlassMorphism variant="medium" className="max-w-2xl w-full p-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <ErrorMessage error={this.state.error} />

              <ErrorActions
                error={this.state.error}
                retryCount={this.state.retryCount}
                maxRetries={this.props.maxRetries || 3}
                isRetrying={this.state.isRetrying}
                onRetry={this.handleRetry}
                onReset={this.handleReset}
                onGoHome={this.handleGoHome}
                onSignOut={this.handleSignOut}
                onContactSupport={this.handleContactSupport}
              />

              {this.props.showErrorDetails && this.state.errorInfo && (
                <ErrorDetails
                  error={this.state.error}
                  errorInfo={this.state.errorInfo}
                  isVisible={showDetails}
                  onToggle={() => setShowDetails(!showDetails)}
                />
              )}
            </motion.div>
          </GlassMorphism>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for manually triggering auth errors
export const useAuthErrorHandler = () => {
  const throwAuthError = React.useCallback((
    message: string,
    type: AuthErrorType = AuthErrorType.UNKNOWN_ERROR,
    options: Partial<AuthError> = {}
  ) => {
    const error: AuthError = new Error(message) as AuthError;
    error.type = type;
    error.timestamp = new Date();
    Object.assign(error, options);
    
    throw error;
  }, []);

  const handleAsyncError = React.useCallback(async (
    asyncFn: () => Promise<any>,
    errorType: AuthErrorType = AuthErrorType.UNKNOWN_ERROR
  ) => {
    try {
      return await asyncFn();
    } catch (error) {
      const authError = classifyError(error as Error);
      if (!authError.type) {
        authError.type = errorType;
      }
      throw authError;
    }
  }, []);

  return {
    throwAuthError,
    handleAsyncError
  };
};

export default AuthErrorBoundary;