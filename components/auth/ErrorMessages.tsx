'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  X,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '../GlassMorphism';
import type { AuthError as IAuthError, ErrorDisplayProps } from './types';

// Base error message component
export const ErrorMessage: React.FC<{
  message?: string;
  variant?: 'error' | 'warning' | 'info';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onDismiss?: () => void;
  showIcon?: boolean;
}> = ({
  message,
  variant = 'error',
  size = 'md',
  className = '',
  onDismiss,
  showIcon = true
}) => {
  if (!message) return null;

  const variants = {
    error: {
      icon: AlertCircle,
      bgColor: 'bg-red-error/10',
      borderColor: 'border-red-error/20',
      textColor: 'text-red-error',
      iconColor: 'text-red-error'
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-gold-primary/10',
      borderColor: 'border-gold-primary/20',
      textColor: 'text-gold-primary',
      iconColor: 'text-gold-primary'
    },
    info: {
      icon: Info,
      bgColor: 'bg-teal-primary/10',
      borderColor: 'border-teal-primary/20',
      textColor: 'text-teal-primary',
      iconColor: 'text-teal-primary'
    }
  };

  const sizeClasses = {
    sm: 'p-2 text-xs',
    md: 'p-3 text-sm',
    lg: 'p-4 text-base'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const config = variants[variant];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'rounded-lg border flex items-start gap-3',
        config.bgColor,
        config.borderColor,
        sizeClasses[size],
        className
      )}
      role="alert"
      aria-live="polite"
    >
      {showIcon && (
        <Icon className={cn(
          'flex-shrink-0 mt-0.5',
          iconSizes[size],
          config.iconColor
        )} />
      )}
      
      <div className="flex-1 min-w-0">
        <p className={cn('break-words', config.textColor)}>
          {message}
        </p>
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className={cn(
            'flex-shrink-0 p-1 rounded-md transition-colors hover:bg-white/10',
            config.textColor
          )}
          aria-label="Dismiss error"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
};

// Field-specific error display
export const FieldError: React.FC<{
  error?: string;
  className?: string;
}> = ({ error, className = '' }) => (
  <AnimatePresence>
    {error && (
      <motion.p
        initial={{ opacity: 0, y: -5, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -5, height: 0 }}
        className={cn(
          'text-sm text-red-error flex items-start gap-2 mt-1',
          className
        )}
        role="alert"
        aria-live="polite"
      >
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span className="break-words">{error}</span>
      </motion.p>
    )}
  </AnimatePresence>
);

// Success message for field validation
export const FieldSuccess: React.FC<{
  message?: string;
  className?: string;
}> = ({ message, className = '' }) => (
  <AnimatePresence>
    {message && (
      <motion.p
        initial={{ opacity: 0, y: -5, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -5, height: 0 }}
        className={cn(
          'text-sm text-sage flex items-start gap-2 mt-1',
          className
        )}
        role="status"
        aria-live="polite"
      >
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span className="break-words">{message}</span>
      </motion.p>
    )}
  </AnimatePresence>
);

// Comprehensive error display with actions
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onDismiss,
  variant = 'inline',
  className = ''
}) => {
  if (!error) return null;

  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorCode = typeof error === 'object' && error.code ? error.code : undefined;

  const getErrorDetails = (error: IAuthError | string) => {
    if (typeof error === 'string') return { message: error, suggestions: [] };

    const suggestions: Array<{ label: string; action?: () => void }> = [];

    // Provide contextual suggestions based on error type
    switch (error.message) {
      case 'Invalid login credentials':
        suggestions.push(
          { label: 'Check your email and password' },
          { label: 'Reset your password', action: () => {/* Navigate to reset */} }
        );
        break;
      case 'Email not confirmed':
        suggestions.push(
          { label: 'Check your email inbox' },
          { label: 'Resend confirmation email', action: () => {/* Resend email */} }
        );
        break;
      case 'Too many requests':
        suggestions.push(
          { label: 'Wait a few minutes before trying again' },
          { label: 'Clear browser cache and cookies' }
        );
        break;
      case 'Network error':
        suggestions.push(
          { label: 'Check your internet connection' },
          { label: 'Try refreshing the page', action: () => window.location.reload() }
        );
        break;
      default:
        suggestions.push(
          { label: 'Try again in a moment' },
          { label: 'Contact support if the issue persists' }
        );
    }

    return { message: error.message, suggestions };
  };

  const { message, suggestions } = getErrorDetails(error);

  // Inline variant (default)
  if (variant === 'inline') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          'p-4 rounded-lg bg-red-error/10 border border-red-error/20',
          className
        )}
        role="alert"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-error flex-shrink-0 mt-0.5" />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-red-error">
                  {message}
                </p>
                {errorCode && (
                  <p className="text-xs text-red-error/70 mt-1">
                    Error code: {errorCode}
                  </p>
                )}
              </div>
              
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="p-1 text-red-error hover:bg-red-error/10 rounded transition-colors"
                  aria-label="Dismiss error"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {suggestions.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs font-medium text-red-error/80">
                  Suggestions:
                </p>
                <ul className="space-y-1">
                  {suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-red-error/60 rounded-full flex-shrink-0" />
                      {suggestion.action ? (
                        <button
                          onClick={suggestion.action}
                          className="text-xs text-red-error hover:text-red-error/80 underline transition-colors"
                        >
                          {suggestion.label}
                        </button>
                      ) : (
                        <span className="text-xs text-red-error/70">
                          {suggestion.label}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // Modal variant
  if (variant === 'modal') {
    return (
      <GlassMorphism variant="medium" className="p-6 max-w-md mx-auto">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-error/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-error" />
          </div>
          
          <h3 className="text-lg font-semibold text-cream mb-2">
            Something went wrong
          </h3>
          
          <p className="text-sm text-red-error mb-4">
            {message}
          </p>

          {errorCode && (
            <p className="text-xs text-sage/70 mb-4">
              Error code: {errorCode}
            </p>
          )}

          {suggestions.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-medium text-cream mb-2">
                Try these solutions:
              </p>
              <ul className="space-y-2 text-left">
                {suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-teal-primary rounded-full flex-shrink-0 mt-1.5" />
                    {suggestion.action ? (
                      <button
                        onClick={suggestion.action}
                        className="text-sm text-teal-primary hover:text-teal-secondary underline transition-colors text-left"
                      >
                        {suggestion.label}
                      </button>
                    ) : (
                      <span className="text-sm text-sage/70">
                        {suggestion.label}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="flex-1 px-4 py-2 text-sage hover:bg-sage/10 rounded-lg transition-colors"
              >
                Dismiss
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-teal-primary to-teal-secondary text-cream rounded-lg hover:shadow-lg transition-all"
            >
              <RefreshCw className="w-4 h-4 inline mr-2" />
              Try Again
            </button>
          </div>
        </div>
      </GlassMorphism>
    );
  }

  return null;
};

// Network error specific component
export const NetworkError: React.FC<{
  onRetry?: () => void;
  className?: string;
}> = ({ onRetry, className = '' }) => (
  <div className={cn(
    'text-center p-6 bg-red-error/10 border border-red-error/20 rounded-lg',
    className
  )}>
    <AlertTriangle className="w-12 h-12 text-red-error mx-auto mb-4" />
    <h3 className="text-lg font-semibold text-red-error mb-2">
      Connection Problem
    </h3>
    <p className="text-sm text-red-error/80 mb-4">
      Please check your internet connection and try again.
    </p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-red-error text-cream rounded-lg hover:bg-red-error/90 transition-colors"
      >
        <RefreshCw className="w-4 h-4 inline mr-2" />
        Retry
      </button>
    )}
  </div>
);

// Authentication-specific error messages
export const AuthError: React.FC<{
  error: IAuthError | string | null;
  onDismiss?: () => void;
  showSuggestions?: boolean;
  className?: string;
}> = ({ 
  error, 
  onDismiss, 
  showSuggestions = true,
  className = '' 
}) => {
  if (!error) return null;

  const errorMessage = typeof error === 'string' ? error : error.message;

  // Map common auth errors to user-friendly messages
  const getDisplayMessage = (message: string): string => {
    const errorMap: Record<string, string> = {
      'Invalid login credentials': 'The email or password you entered is incorrect.',
      'Email not confirmed': 'Please check your email and click the confirmation link.',
      'User not found': 'No account found with this email address.',
      'Too many requests': 'Too many attempts. Please wait before trying again.',
      'Weak password': 'Please choose a stronger password.',
      'Email already registered': 'An account with this email already exists.',
      'Network error': 'Unable to connect. Please check your internet connection.',
      'Popup blocked': 'Please allow popups to continue with social login.'
    };

    return errorMap[message] || message;
  };

  return (
    <ErrorMessage
      message={getDisplayMessage(errorMessage)}
      variant="error"
      onDismiss={onDismiss}
      className={className}
    />
  );
};

// Success message component
export const SuccessMessage: React.FC<{
  message: string;
  onDismiss?: () => void;
  className?: string;
}> = ({ message, onDismiss, className = '' }) => (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    className={cn(
      'p-4 rounded-lg bg-sage/10 border border-sage/20 flex items-center gap-3',
      className
    )}
    role="status"
    aria-live="polite"
  >
    <Info className="w-5 h-5 text-sage flex-shrink-0" />
    <p className="text-sm text-sage flex-1">{message}</p>
    {onDismiss && (
      <button
        onClick={onDismiss}
        className="p-1 text-sage hover:bg-sage/10 rounded transition-colors"
        aria-label="Dismiss message"
      >
        <X className="w-4 h-4" />
      </button>
    )}
  </motion.div>
);

export default ErrorMessage;