'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LoadingState, LoadingStateProps } from './types';

// Basic loading spinner component
export const LoadingSpinner: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  color?: string;
}> = ({ 
  size = 'md', 
  className = '',
  color = 'text-teal-primary'
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <Loader2 
      className={cn(
        'animate-spin',
        sizeClasses[size],
        color,
        className
      )}
      aria-label="Loading"
    />
  );
};

// Animated loading dots
export const LoadingDots: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ 
  size = 'md', 
  className = '' 
}) => {
  const dotSizes = {
    sm: 'w-1 h-1',
    md: 'w-1.5 h-1.5', 
    lg: 'w-2 h-2'
  };

  return (
    <div className={cn('flex space-x-1', className)} aria-label="Loading">
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className={cn(
            'bg-current rounded-full',
            dotSizes[size]
          )}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: index * 0.2
          }}
        />
      ))}
    </div>
  );
};

// Pulsing loading indicator
export const LoadingPulse: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ 
  size = 'md', 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  return (
    <motion.div
      className={cn(
        'bg-teal-primary/20 rounded-full',
        sizeClasses[size],
        className
      )}
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.3, 0.8, 0.3]
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }}
      aria-label="Loading"
    />
  );
};

// Progress bar component
export const ProgressBar: React.FC<{
  progress: number;
  variant?: 'default' | 'success' | 'error' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  className?: string;
}> = ({
  progress,
  variant = 'default',
  size = 'md',
  showPercentage = false,
  className = ''
}) => {
  const heightClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  const colorClasses = {
    default: 'bg-gradient-to-r from-teal-primary to-teal-secondary',
    success: 'bg-gradient-to-r from-sage to-teal-primary',
    error: 'bg-gradient-to-r from-red-error to-red-warning',
    warning: 'bg-gradient-to-r from-gold-secondary to-gold-primary'
  };

  return (
    <div className={cn('w-full', className)}>
      <div className={cn(
        'w-full bg-navy-50/20 rounded-full overflow-hidden',
        heightClasses[size]
      )}>
        <motion.div
          className={cn('h-full', colorClasses[variant])}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      {showPercentage && (
        <div className="flex justify-end mt-1">
          <span className="text-xs text-sage/70">
            {Math.round(progress)}%
          </span>
        </div>
      )}
    </div>
  );
};

// Comprehensive loading state component
export const LoadingState: React.FC<LoadingStateProps> = ({
  state,
  message,
  size = 'md',
  className = ''
}) => {
  const renderStateContent = () => {
    switch (state) {
      case 'loading':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-3"
          >
            <LoadingSpinner size={size} />
            {message && (
              <p className="text-sm text-sage/70 text-center">
                {message}
              </p>
            )}
          </motion.div>
        );

      case 'success':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-3"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            >
              <CheckCircle className={cn(
                'text-sage',
                size === 'sm' && 'w-6 h-6',
                size === 'md' && 'w-8 h-8',
                size === 'lg' && 'w-10 h-10'
              )} />
            </motion.div>
            {message && (
              <p className="text-sm text-sage text-center">
                {message}
              </p>
            )}
          </motion.div>
        );

      case 'error':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-3"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            >
              <AlertCircle className={cn(
                'text-red-error',
                size === 'sm' && 'w-6 h-6',
                size === 'md' && 'w-8 h-8',
                size === 'lg' && 'w-10 h-10'
              )} />
            </motion.div>
            {message && (
              <p className="text-sm text-red-error text-center">
                {message}
              </p>
            )}
          </motion.div>
        );

      default:
        return null;
    }
  };

  if (state === 'idle') return null;

  return (
    <AnimatePresence>
      <div className={cn(
        'flex items-center justify-center p-4',
        className
      )}>
        {renderStateContent()}
      </div>
    </AnimatePresence>
  );
};

// Button loading state wrapper
export const ButtonWithLoading: React.FC<{
  isLoading: boolean;
  loadingText?: string;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}> = ({
  isLoading,
  loadingText,
  children,
  disabled,
  className = '',
  onClick,
  type = 'button',
  variant = 'primary'
}) => {
  const baseClasses = 'px-6 py-3 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-navy-dark';
  
  const variantClasses = {
    primary: 'bg-gradient-to-r from-teal-primary to-teal-secondary text-cream hover:shadow-lg disabled:from-navy-50/20 disabled:to-navy-50/20 disabled:text-sage/50 focus:ring-teal-primary/50',
    secondary: 'bg-sage/10 border border-sage/30 text-sage hover:bg-sage/20 disabled:bg-navy-50/20 disabled:border-sage/20 disabled:text-sage/50 focus:ring-sage/50',
    ghost: 'text-sage hover:bg-sage/10 disabled:text-sage/50 focus:ring-sage/50',
    danger: 'bg-gradient-to-r from-red-error to-red-warning text-cream hover:shadow-lg disabled:from-navy-50/20 disabled:to-navy-50/20 disabled:text-sage/50 focus:ring-red-error/50'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        baseClasses,
        variantClasses[variant],
        (disabled || isLoading) && 'cursor-not-allowed',
        !disabled && !isLoading && 'hover:scale-[1.02] active:scale-[0.98]',
        className
      )}
    >
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-2"
          >
            <LoadingSpinner size="sm" color="text-current" />
            <span>{loadingText || 'Loading...'}</span>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
};

// Skeleton loading for form fields
export const FormFieldSkeleton: React.FC<{
  label?: boolean;
  error?: boolean;
  className?: string;
}> = ({
  label = true,
  error = false,
  className = ''
}) => (
  <div className={cn('space-y-2', className)}>
    {label && (
      <div className="h-4 w-20 bg-sage/20 rounded animate-pulse" />
    )}
    <div className="h-12 w-full bg-sage/20 rounded-lg animate-pulse" />
    {error && (
      <div className="h-3 w-32 bg-red-error/20 rounded animate-pulse" />
    )}
  </div>
);

// Loading overlay for modal/form content
export const LoadingOverlay: React.FC<{
  isVisible: boolean;
  message?: string;
  className?: string;
}> = ({
  isVisible,
  message = 'Loading...',
  className = ''
}) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={cn(
          'absolute inset-0 bg-navy-dark/80 backdrop-blur-sm',
          'flex items-center justify-center z-50',
          className
        )}
      >
        <div className="bg-navy-50/20 backdrop-blur-md border border-sage/20 rounded-lg p-6">
          <LoadingState state="loading" message={message} size="md" />
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

// Authentication step progress indicator
export const StepProgress: React.FC<{
  currentStep: number;
  totalSteps: number;
  className?: string;
}> = ({
  currentStep,
  totalSteps,
  className = ''
}) => {
  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      {Array.from({ length: totalSteps }, (_, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === currentStep;
        const isCompleted = stepNumber < currentStep;
        
        return (
          <React.Fragment key={stepNumber}>
            <motion.div
              className={cn(
                'w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-medium transition-colors',
                isCompleted && 'bg-sage border-sage text-navy-dark',
                isActive && 'border-teal-primary text-teal-primary bg-teal-primary/10',
                !isActive && !isCompleted && 'border-sage/30 text-sage/50'
              )}
              initial={false}
              animate={{
                scale: isActive ? 1.1 : 1,
                backgroundColor: isCompleted ? '#94D2BD' : isActive ? 'rgba(10, 147, 150, 0.1)' : 'transparent'
              }}
              transition={{ duration: 0.2 }}
            >
              {isCompleted ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                stepNumber
              )}
            </motion.div>
            
            {stepNumber < totalSteps && (
              <motion.div
                className={cn(
                  'w-8 h-0.5 transition-colors',
                  stepNumber < currentStep ? 'bg-sage' : 'bg-sage/20'
                )}
                initial={false}
                animate={{
                  backgroundColor: stepNumber < currentStep ? '#94D2BD' : 'rgba(148, 210, 189, 0.2)'
                }}
                transition={{ duration: 0.3, delay: 0.1 }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default LoadingState;