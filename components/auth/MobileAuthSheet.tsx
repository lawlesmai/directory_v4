'use client';

import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import type { AuthModalProps } from './types';

interface MobileAuthSheetProps extends AuthModalProps {
  maxHeight?: number;
}

export const MobileAuthSheet: React.FC<MobileAuthSheetProps> = ({
  isOpen,
  onClose,
  mode,
  onModeChange,
  maxHeight = 90,
  className = ''
}) => {
  const [dragProgress, setDragProgress] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);

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
      // Prevent bounce scrolling on iOS
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen, handleEscapeKey]);

  // Handle drag to dismiss
  const handleDrag = useCallback((_: any, info: PanInfo) => {
    const progress = Math.max(0, info.offset.y) / 200;
    setDragProgress(progress);
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    setIsDragging(false);
    if (info.offset.y > 150 || info.velocity.y > 500) {
      onClose();
    }
    setDragProgress(0);
  }, [onClose]);

  const sheetRef = React.useRef<HTMLDivElement>(null);

  // Focus management
  useEffect(() => {
    if (isOpen && sheetRef.current) {
      const focusableElements = sheetRef.current.querySelectorAll(
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

  const renderSheetContent = () => {
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
            className="bg-transparent backdrop-blur-none border-none shadow-none p-0"
          />
        );

      case 'register':
        return (
          <RegisterForm
            onSuccess={handleAuthSuccess}
            onError={handleAuthError}
            showSocialLogin={true}
            className="bg-transparent backdrop-blur-none border-none shadow-none p-0"
          />
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
            'fixed inset-0 z-50',
            'bg-navy-dark/80 backdrop-blur-sm',
            className
          )}
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sheet-title"
        >
          <motion.div
            ref={sheetRef}
            initial={{ y: '100%' }}
            animate={{ 
              y: 0,
              opacity: isDragging ? 1 - dragProgress * 0.5 : 1,
              scale: isDragging ? 1 - dragProgress * 0.05 : 1
            }}
            exit={{ y: '100%' }}
            transition={{ 
              type: 'spring', 
              damping: 30, 
              stiffness: 400,
              duration: 0.4
            }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            className={cn(
              'fixed bottom-0 left-0 right-0',
              'bg-navy-dark/95 backdrop-blur-xl',
              'rounded-t-2xl border-t border-sage/20',
              'shadow-2xl shadow-black/50'
            )}
            style={{ 
              maxHeight: `${maxHeight}vh`,
              minHeight: '50vh'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle */}
            <div className="sticky top-0 z-10 bg-navy-dark/95 backdrop-blur-xl rounded-t-2xl">
              <div className="flex items-center justify-center py-3">
                <motion.div 
                  className="w-12 h-1 bg-sage/30 rounded-full cursor-grab active:cursor-grabbing"
                  animate={{ 
                    backgroundColor: isDragging ? 'rgba(148, 210, 189, 0.5)' : 'rgba(148, 210, 189, 0.3)' 
                  }}
                />
              </div>
              
              {/* Header */}
              <div className="flex items-center justify-between px-6 pb-4">
                <div className="flex items-center gap-2">
                  <ChevronDown className="w-5 h-5 text-sage/70" />
                  <h2 id="sheet-title" className="text-lg font-semibold text-cream">
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                  </h2>
                </div>
                
                <button
                  onClick={onClose}
                  className="p-2 text-sage/70 hover:text-cream hover:bg-sage/10 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 pb-8 overflow-y-auto max-h-full">
              <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {renderSheetContent()}
                </motion.div>
              </AnimatePresence>

              {/* Mode Switch Links */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-8 text-center space-y-3"
              >
                {mode === 'login' && (
                  <p className="text-sage/70 text-sm">
                    Don't have an account?{' '}
                    <button
                      onClick={() => onModeChange('register')}
                      className="text-teal-primary hover:text-teal-secondary transition-colors font-medium"
                    >
                      Sign up now
                    </button>
                  </p>
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

                {/* Safe area bottom padding for iOS */}
                <div className="h-8" />
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Hook for managing mobile auth sheet
export const useMobileAuthSheet = () => {
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
    close,
    changeMode
  };
};

export default MobileAuthSheet;