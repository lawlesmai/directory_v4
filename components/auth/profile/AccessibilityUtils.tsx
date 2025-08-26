'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Check, Info, X } from 'lucide-react';

// WCAG 2.1 AA Accessibility utilities and hooks

// Screen reader announcements
export const useScreenReader = () => {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, []);

  return { announce };
};

// Focus management hook
export const useFocusManagement = () => {
  const focusableElementsSelector = [
    'a[href]',
    'area[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'button:not([disabled])',
    'iframe',
    'object',
    'embed',
    '[contenteditable]',
    '[tabindex]:not([tabindex^="-"])',
  ].join(',');

  const getFocusableElements = useCallback((container: HTMLElement): HTMLElement[] => {
    return Array.from(container.querySelectorAll(focusableElementsSelector));
  }, [focusableElementsSelector]);

  const trapFocus = useCallback((container: HTMLElement) => {
    const focusableElements = getFocusableElements(container);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);
    
    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }, [getFocusableElements]);

  const restoreFocus = useCallback((element: HTMLElement | null) => {
    if (element && element.focus) {
      element.focus();
    }
  }, []);

  return { getFocusableElements, trapFocus, restoreFocus };
};

// Keyboard navigation hook
export const useKeyboardNavigation = (
  onEscape?: () => void,
  onEnter?: () => void,
  onArrowUp?: () => void,
  onArrowDown?: () => void,
  onArrowLeft?: () => void,
  onArrowRight?: () => void
) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onEscape?.();
          break;
        case 'Enter':
          if (e.target instanceof HTMLButtonElement || 
              (e.target instanceof HTMLElement && e.target.getAttribute('role') === 'button')) {
            e.preventDefault();
            onEnter?.();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          onArrowUp?.();
          break;
        case 'ArrowDown':
          e.preventDefault();
          onArrowDown?.();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onArrowLeft?.();
          break;
        case 'ArrowRight':
          e.preventDefault();
          onArrowRight?.();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onEscape, onEnter, onArrowUp, onArrowDown, onArrowLeft, onArrowRight]);
};

// Reduced motion hook
export const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
};

// High contrast mode detection
export const useHighContrast = () => {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    // Check for Windows high contrast mode
    const checkHighContrast = () => {
      const testElement = document.createElement('div');
      testElement.style.color = 'rgb(31, 31, 31)';
      testElement.style.backgroundColor = 'rgb(31, 31, 31)';
      document.body.appendChild(testElement);

      const computedStyle = window.getComputedStyle(testElement);
      const isHighContrast = computedStyle.color !== computedStyle.backgroundColor;

      document.body.removeChild(testElement);
      setIsHighContrast(isHighContrast);
    };

    checkHighContrast();
    
    // Also check for forced-colors media query
    const mediaQuery = window.matchMedia('(forced-colors: active)');
    const handleChange = () => {
      setIsHighContrast(mediaQuery.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isHighContrast;
};

// Skip link component
export const SkipLink: React.FC<{
  href: string;
  children: React.ReactNode;
}> = ({ href, children }) => {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 
                 px-4 py-2 bg-teal-primary text-cream rounded-lg font-medium
                 focus:outline-none focus:ring-2 focus:ring-cream"
    >
      {children}
    </a>
  );
};

// Accessible form field wrapper
export const AccessibleField: React.FC<{
  id: string;
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ id, label, description, error, required, children, className }) => {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const ariaDescribedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-cream mb-1">
        {label}
        {required && (
          <span className="text-red-error ml-1" aria-label="required">
            *
          </span>
        )}
      </label>

      {description && (
        <p id={descriptionId} className="text-sm text-sage/70 mb-2">
          {description}
        </p>
      )}

      <div aria-describedby={ariaDescribedBy}>
        {children}
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          id={errorId}
          role="alert"
          aria-live="polite"
          className="mt-1 flex items-center gap-2 text-sm text-red-error"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}
    </div>
  );
};

// Accessible button component
export const AccessibleButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  className?: string;
}> = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  ariaLabel,
  ariaDescribedBy,
  className,
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-navy-dark disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: 'bg-teal-primary hover:bg-teal-secondary text-cream focus:ring-teal-primary',
    secondary: 'bg-sage/20 hover:bg-sage/30 text-sage/70 hover:text-sage focus:ring-sage',
    danger: 'bg-red-error hover:bg-red-error/90 text-cream focus:ring-red-error',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm min-h-[36px]',
    md: 'px-4 py-2 text-base min-h-[44px]',
    lg: 'px-6 py-3 text-lg min-h-[48px]',
  };

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-busy={loading}
      whileHover={!disabled && !loading ? { scale: 1.02 } : undefined}
      whileTap={!disabled && !loading ? { scale: 0.98 } : undefined}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className || ''}`}
    >
      {loading && (
        <div className="w-4 h-4 border-2 border-cream/30 border-t-cream rounded-full animate-spin mr-2" />
      )}
      {children}
    </motion.button>
  );
};

// Accessible toggle switch
export const AccessibleToggle: React.FC<{
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}> = ({ id, label, description, checked, onChange, disabled, size = 'md', className }) => {
  const sizeClasses = {
    sm: { container: 'w-10 h-5', thumb: 'w-4 h-4', translate: 'translate-x-5' },
    md: { container: 'w-12 h-6', thumb: 'w-5 h-5', translate: 'translate-x-6' },
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <div className="flex-1 mr-4">
          <label htmlFor={id} className="block font-medium text-cream cursor-pointer">
            {label}
          </label>
          {description && (
            <p className="text-sm text-sage/70 mt-1">{description}</p>
          )}
        </div>

        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={`
            relative inline-flex items-center rounded-full transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-teal-primary focus:ring-offset-2 focus:ring-offset-navy-dark
            disabled:opacity-50 disabled:cursor-not-allowed
            ${sizeClasses[size].container}
            ${checked ? 'bg-teal-primary' : 'bg-sage/20'}
          `}
        >
          <span
            className={`
              inline-block rounded-full bg-cream shadow-sm transition-transform duration-200
              ${sizeClasses[size].thumb}
              ${checked ? sizeClasses[size].translate : 'translate-x-0.5'}
            `}
          />
          <span className="sr-only">{checked ? 'Disable' : 'Enable'} {label}</span>
        </button>
      </div>
    </div>
  );
};

// Accessible status message
export const StatusMessage: React.FC<{
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  children: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}> = ({ type, title, children, dismissible, onDismiss, className }) => {
  const typeConfig = {
    success: { icon: Check, color: 'text-teal-primary', bg: 'bg-teal-primary/10', border: 'border-teal-primary/30' },
    error: { icon: AlertTriangle, color: 'text-red-error', bg: 'bg-red-error/10', border: 'border-red-error/30' },
    warning: { icon: AlertTriangle, color: 'text-gold-primary', bg: 'bg-gold-primary/10', border: 'border-gold-primary/30' },
    info: { icon: Info, color: 'text-sage', bg: 'bg-sage/10', border: 'border-sage/30' },
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className={`
        flex items-start gap-3 p-4 rounded-lg border
        ${config.bg} ${config.border} ${className || ''}
      `}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.color}`} />
      
      <div className="flex-1">
        {title && (
          <h3 className={`font-medium ${config.color} mb-1`}>{title}</h3>
        )}
        <div className="text-sm text-cream">{children}</div>
      </div>

      {dismissible && onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss message"
          className={`flex-shrink-0 ${config.color} hover:opacity-70 transition-opacity`}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
};

// Progress indicator with screen reader support
export const AccessibleProgress: React.FC<{
  value: number;
  max: number;
  label: string;
  description?: string;
  showPercentage?: boolean;
  className?: string;
}> = ({ value, max, label, description, showPercentage = true, className }) => {
  const percentage = Math.round((value / max) * 100);
  const progressId = `progress-${Math.random().toString(36).substr(2, 9)}`;
  const descriptionId = description ? `${progressId}-description` : undefined;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <label htmlFor={progressId} className="font-medium text-cream">
          {label}
        </label>
        {showPercentage && (
          <span className="text-sm text-sage/70" aria-hidden="true">
            {percentage}%
          </span>
        )}
      </div>

      {description && (
        <p id={descriptionId} className="text-sm text-sage/70 mb-2">
          {description}
        </p>
      )}

      <div className="relative">
        <div className="h-2 bg-sage/20 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="h-full bg-teal-primary rounded-full"
          />
        </div>

        <div
          id={progressId}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuetext={`${value} of ${max} complete (${percentage}%)`}
          aria-describedby={descriptionId}
          className="sr-only"
        >
          {percentage}% complete
        </div>
      </div>
    </div>
  );
};

// Live region for dynamic content updates
export const LiveRegion: React.FC<{
  children: React.ReactNode;
  politeness?: 'polite' | 'assertive';
  atomic?: boolean;
  className?: string;
}> = ({ children, politeness = 'polite', atomic = true, className }) => {
  return (
    <div
      aria-live={politeness}
      aria-atomic={atomic}
      className={className}
    >
      {children}
    </div>
  );
};

// Accessible modal with proper focus management
export const AccessibleModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  closeOnEscape?: boolean;
  closeOnOverlay?: boolean;
  className?: string;
}> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  closeOnEscape = true,
  closeOnOverlay = true,
  className,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const { trapFocus, restoreFocus } = useFocusManagement();

  useKeyboardNavigation(
    closeOnEscape ? onClose : undefined
  );

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      
      setTimeout(() => {
        const firstFocusable = modalRef.current?.querySelector('[tabindex]:not([tabindex^="-"]), button, input, select, textarea') as HTMLElement;
        firstFocusable?.focus();
      }, 100);

      if (modalRef.current) {
        const cleanup = trapFocus(modalRef.current);
        return cleanup;
      }
    } else {
      restoreFocus(previousFocusRef.current);
    }
  }, [isOpen, trapFocus, restoreFocus]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      aria-describedby={description ? "modal-description" : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-navy-dark/80 backdrop-blur-sm transition-opacity"
          onClick={closeOnOverlay ? onClose : undefined}
          aria-hidden="true"
        />

        <div
          ref={modalRef}
          className={`relative bg-navy-dark border border-sage/20 rounded-lg shadow-xl max-w-lg w-full ${className || ''}`}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 id="modal-title" className="text-xl font-semibold text-cream">
                {title}
              </h2>
              <button
                onClick={onClose}
                aria-label="Close modal"
                className="p-1 text-sage/70 hover:text-cream transition-colors focus:outline-none focus:ring-2 focus:ring-teal-primary rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {description && (
              <p id="modal-description" className="text-sage/70 mb-4">
                {description}
              </p>
            )}

            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default {
  useScreenReader,
  useFocusManagement,
  useKeyboardNavigation,
  useReducedMotion,
  useHighContrast,
  SkipLink,
  AccessibleField,
  AccessibleButton,
  AccessibleToggle,
  StatusMessage,
  AccessibleProgress,
  LiveRegion,
  AccessibleModal,
};