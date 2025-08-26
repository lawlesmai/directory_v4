'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Filter, 
  Star, 
  Bookmark, 
  UserCircle, 
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  X,
  PlayCircle,
  SkipForward,
  Trophy,
  Sparkles,
  Target,
  Map,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';
import type { TourStep } from './types';

interface WelcomeTourProps {
  onComplete?: () => void;
  onSkip?: () => void;
  className?: string;
}

const tourSteps: TourStep[] = [
  {
    id: 'search',
    target: '[data-tour="search-bar"]',
    title: 'Find Any Business',
    content: 'Search for restaurants, services, shops, and more. Just type what you\'re looking for!',
    placement: 'bottom'
  },
  {
    id: 'filters',
    target: '[data-tour="filter-button"]',
    title: 'Refine Your Results',
    content: 'Use filters to narrow down by rating, price, distance, and business type.',
    placement: 'bottom'
  },
  {
    id: 'business-card',
    target: '[data-tour="business-card"]',
    title: 'Business Details',
    content: 'Click any business card to see photos, reviews, hours, and contact information.',
    placement: 'right'
  },
  {
    id: 'save',
    target: '[data-tour="save-button"]',
    title: 'Save Your Favorites',
    content: 'Build collections of your favorite places. Access them anytime from your profile.',
    placement: 'left'
  },
  {
    id: 'profile',
    target: '[data-tour="profile-menu"]',
    title: 'Your Profile',
    content: 'Manage your account, view saved places, and track your reviews and activity.',
    placement: 'bottom'
  },
  {
    id: 'help',
    target: '[data-tour="help-center"]',
    title: 'Need Help?',
    content: 'Access our help center anytime for guides, FAQs, and support.',
    placement: 'bottom'
  }
];

export const WelcomeTour: React.FC<WelcomeTourProps> = ({
  onComplete,
  onSkip,
  className
}) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const currentTourStep = tourSteps[currentStep];

  const calculatePosition = useCallback(() => {
    if (!targetElement || !tooltipRef.current) return;

    const targetRect = targetElement.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const padding = 16;

    setSpotlightRect(targetRect);

    let top = 0;
    let left = 0;

    switch (currentTourStep.placement) {
      case 'bottom':
        top = targetRect.bottom + padding;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'top':
        top = targetRect.top - tooltipRect.height - padding;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.left - tooltipRect.width - padding;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.right + padding;
        break;
      case 'center':
        top = window.innerHeight / 2 - tooltipRect.height / 2;
        left = window.innerWidth / 2 - tooltipRect.width / 2;
        break;
    }

    // Ensure tooltip stays within viewport
    const maxLeft = window.innerWidth - tooltipRect.width - padding;
    const maxTop = window.innerHeight - tooltipRect.height - padding;

    left = Math.max(padding, Math.min(left, maxLeft));
    top = Math.max(padding, Math.min(top, maxTop));

    setTooltipPosition({ top, left });
  }, [targetElement, currentTourStep]);

  useEffect(() => {
    if (!isActive) return;

    const element = document.querySelector(currentTourStep.target) as HTMLElement;
    
    if (element) {
      setTargetElement(element);
      
      // Scroll element into view
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      });

      // Add highlight class
      element.classList.add('tour-highlight');
      
      // Calculate position after scroll
      setTimeout(calculatePosition, 500);
    } else {
      // If element not found, show in center
      setTargetElement(null);
      setSpotlightRect(null);
    }

    return () => {
      if (element) {
        element.classList.remove('tour-highlight');
      }
    };
  }, [isActive, currentStep, calculatePosition, currentTourStep]);

  useEffect(() => {
    if (isActive) {
      window.addEventListener('resize', calculatePosition);
      window.addEventListener('scroll', calculatePosition);

      return () => {
        window.removeEventListener('resize', calculatePosition);
        window.removeEventListener('scroll', calculatePosition);
      };
    }
  }, [isActive, calculatePosition]);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    setIsActive(false);
    onSkip?.();
  };

  const handleComplete = () => {
    setIsActive(false);
    
    // Save tour completion to localStorage
    localStorage.setItem('tourCompleted', 'true');
    localStorage.setItem('tourCompletedAt', new Date().toISOString());
    
    onComplete?.();
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isActive) return;

    switch (e.key) {
      case 'Escape':
        handleSkip();
        break;
      case 'ArrowRight':
        handleNext();
        break;
      case 'ArrowLeft':
        handlePrevious();
        break;
    }
  }, [isActive, currentStep]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const startTour = () => {
    setIsActive(true);
    setCurrentStep(0);
  };

  if (!isActive) {
    return (
      <div className={cn('text-center space-y-6', className)}>
        <div className="space-y-4">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-teal-primary/20 to-teal-secondary/20 rounded-full flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-teal-primary" />
          </div>
          
          <div>
            <h2 className="text-2xl font-bold text-cream mb-2">
              Welcome to Your Directory!
            </h2>
            <p className="text-sage/70">
              Take a quick tour to discover all the features that will help you find and connect with local businesses.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-sage/5 rounded-lg border border-sage/20">
            <Search className="w-8 h-8 text-teal-primary mb-2" />
            <h3 className="font-medium text-cream mb-1">Smart Search</h3>
            <p className="text-xs text-sage/60">Find exactly what you need</p>
          </div>
          
          <div className="p-4 bg-sage/5 rounded-lg border border-sage/20">
            <Star className="w-8 h-8 text-gold-primary mb-2" />
            <h3 className="font-medium text-cream mb-1">Reviews</h3>
            <p className="text-xs text-sage/60">Read and write reviews</p>
          </div>
          
          <div className="p-4 bg-sage/5 rounded-lg border border-sage/20">
            <Bookmark className="w-8 h-8 text-teal-primary mb-2" />
            <h3 className="font-medium text-cream mb-1">Save Places</h3>
            <p className="text-xs text-sage/60">Build your favorites list</p>
          </div>
          
          <div className="p-4 bg-sage/5 rounded-lg border border-sage/20">
            <Map className="w-8 h-8 text-sage mb-2" />
            <h3 className="font-medium text-cream mb-1">Local Focus</h3>
            <p className="text-xs text-sage/60">Discover nearby gems</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={startTour}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-primary to-teal-secondary text-cream rounded-lg font-medium hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
          >
            <PlayCircle className="w-5 h-5" />
            Start Tour
          </button>
          
          <button
            onClick={handleSkip}
            className="flex-1 px-6 py-3 text-sage hover:bg-sage/10 rounded-lg font-medium transition-all duration-200"
          >
            Skip to Dashboard
          </button>
        </div>

        <p className="text-xs text-sage/50">
          You can always restart the tour from the help menu
        </p>
      </div>
    );
  }

  const tourOverlay = (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999]"
        >
          {/* Backdrop with spotlight */}
          <div 
            className="absolute inset-0 bg-navy-dark/80 backdrop-blur-sm"
            onClick={handleSkip}
          >
            {spotlightRect && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute bg-transparent border-2 border-teal-primary/50 rounded-lg"
                style={{
                  top: spotlightRect.top - 4,
                  left: spotlightRect.left - 4,
                  width: spotlightRect.width + 8,
                  height: spotlightRect.height + 8,
                  boxShadow: '0 0 0 9999px rgba(8, 27, 44, 0.8)',
                }}
              />
            )}
          </div>

          {/* Tooltip */}
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute z-10 w-80 p-6 bg-navy-dark/95 backdrop-blur-md border border-sage/20 rounded-xl shadow-2xl"
            style={{
              top: tooltipPosition.top,
              left: tooltipPosition.left,
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleSkip}
              className="absolute top-3 right-3 p-1 hover:bg-sage/10 rounded-lg transition-colors"
              aria-label="Close tour"
            >
              <X className="w-4 h-4 text-sage/50" />
            </button>

            {/* Content */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-cream mb-2">
                  {currentTourStep.title}
                </h3>
                <p className="text-sm text-sage/80">
                  {currentTourStep.content}
                </p>
              </div>

              {/* Progress */}
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {tourSteps.map((_, index) => (
                    <div
                      key={index}
                      className={cn(
                        'w-1.5 h-1.5 rounded-full transition-all duration-300',
                        index === currentStep
                          ? 'w-4 bg-teal-primary'
                          : index < currentStep
                          ? 'bg-teal-primary/50'
                          : 'bg-sage/30'
                      )}
                    />
                  ))}
                </div>
                
                <span className="text-xs text-sage/50">
                  {currentStep + 1} of {tourSteps.length}
                </span>
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all duration-200',
                    currentStep === 0
                      ? 'bg-sage/10 text-sage/30 cursor-not-allowed'
                      : 'bg-sage/10 text-sage hover:bg-sage/20'
                  )}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
                
                <button
                  onClick={handleNext}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-teal-primary text-cream rounded-lg hover:bg-teal-secondary transition-colors"
                >
                  {currentStep === tourSteps.length - 1 ? 'Finish' : 'Next'}
                  {currentStep < tourSteps.length - 1 && <ChevronRight className="w-4 h-4" />}
                </button>
              </div>

              <button
                onClick={handleSkip}
                className="w-full text-center text-xs text-sage/50 hover:text-sage/70 transition-colors"
              >
                Skip tour (ESC)
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Render overlay in portal
  if (typeof document !== 'undefined') {
    return createPortal(tourOverlay, document.body);
  }

  return null;
};

export default WelcomeTour;