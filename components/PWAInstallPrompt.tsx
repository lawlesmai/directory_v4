'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePWA } from '@/hooks/usePWA';

interface PWAInstallPromptProps {
  className?: string;
}

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({ className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenDismissed, setHasBeenDismissed] = useState(false);
  const [installStep, setInstallStep] = useState<'prompt' | 'installing' | 'success'>('prompt');
  
  const {
    isInstallable,
    isInstalled,
    canInstall,
    showInstallPrompt
  } = usePWA({
    onInstallPrompt: () => {
      // Only show if not previously dismissed and not installed
      if (!hasBeenDismissed && !isInstalled) {
        setIsVisible(true);
      }
    },
    onInstallSuccess: () => {
      setInstallStep('success');
      setTimeout(() => {
        setIsVisible(false);
      }, 2000);
    },
    onInstallDeclined: () => {
      setIsVisible(false);
      setHasBeenDismissed(true);
      localStorage.setItem('pwa-install-dismissed', 'true');
    }
  });

  // Check if user previously dismissed the prompt
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      setHasBeenDismissed(true);
    }
  }, []);

  // Show prompt after a delay if installable and not dismissed
  useEffect(() => {
    if (isInstallable && !hasBeenDismissed && !isInstalled) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 5000); // Show after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [isInstallable, hasBeenDismissed, isInstalled]);

  const handleInstall = async () => {
    setInstallStep('installing');
    await showInstallPrompt();
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setHasBeenDismissed(true);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  const handleTryLater = () => {
    setIsVisible(false);
    // Don't mark as permanently dismissed, just hide for this session
  };

  if (!canInstall || isInstalled || !isVisible) {
    return null;
  }

  const variants = {
    hidden: {
      opacity: 0,
      y: 100,
      scale: 0.9
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 25
      }
    },
    exit: {
      opacity: 0,
      y: 100,
      scale: 0.9,
      transition: {
        duration: 0.2
      }
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className={`
          fixed bottom-4 left-4 right-4 z-50
          bg-white dark:bg-gray-800 
          rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700
          overflow-hidden
          ${className}
        `}
        variants={variants}
        initial="hidden"
        animate="visible"
        exit="exit"
        style={{
          marginBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
      >
        {installStep === 'prompt' && (
          <div className="p-6">
            <div className="flex items-start space-x-4">
              {/* App Icon */}
              <div className="flex-shrink-0">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  Install Lawless Directory
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                  Get the full app experience with offline access, faster loading, and push notifications.
                </p>

                {/* Features */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                    <svg className="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Offline access
                  </div>
                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                    <svg className="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Faster loading
                  </div>
                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                    <svg className="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Push notifications
                  </div>
                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                    <svg className="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Home screen access
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <button
                    onClick={handleInstall}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Install App
                  </button>
                  <button
                    onClick={handleTryLater}
                    className="px-4 py-2.5 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 font-medium transition-colors"
                  >
                    Later
                  </button>
                </div>
              </div>

              {/* Dismiss Button */}
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {installStep === 'installing' && (
          <div className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Installing...
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Please wait while we set up the app for you.
            </p>
          </div>
        )}

        {installStep === 'success' && (
          <div className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Successfully Installed!
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              The app is now available on your home screen.
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default PWAInstallPrompt;