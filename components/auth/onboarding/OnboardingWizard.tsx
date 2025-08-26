'use client';

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  User, 
  Mail, 
  Settings, 
  Award,
  Sparkles,
  Info,
  X,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '@/components/GlassMorphism';
import { AccountCreationStep } from './AccountCreationStep';
import { EmailVerificationStep } from './EmailVerificationStep';
import { ProfileBasicsStep } from './ProfileBasicsStep';
import { PreferencesStep } from './PreferencesStep';
import { PersonalizationStep } from './PersonalizationStep';
import { WelcomeStep } from './WelcomeStep';
import type { OnboardingData, OnboardingStep } from './types';

interface OnboardingContextType {
  currentStep: number;
  totalSteps: number;
  data: Partial<OnboardingData>;
  updateData: (stepData: Partial<OnboardingData>) => void;
  goToStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  canSkip: boolean;
  skipStep: () => void;
  completedSteps: Set<number>;
  markStepComplete: (step: number) => void;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
};

interface OnboardingWizardProps {
  onComplete: (data: OnboardingData) => void;
  onSkip?: () => void;
  initialStep?: number;
  initialData?: Partial<OnboardingData>;
  className?: string;
}

const steps: OnboardingStep[] = [
  {
    id: 1,
    title: 'Create Your Account',
    description: 'Choose your email and password',
    icon: <User className="w-5 h-5" />,
    component: AccountCreationStep,
    required: true
  },
  {
    id: 2,
    title: 'Verify Your Email',
    description: 'Confirm your email address',
    icon: <Mail className="w-5 h-5" />,
    component: EmailVerificationStep,
    required: true
  },
  {
    id: 3,
    title: 'Complete Your Profile',
    description: 'Tell us about yourself',
    icon: <User className="w-5 h-5" />,
    component: ProfileBasicsStep,
    required: true
  },
  {
    id: 4,
    title: 'Set Your Preferences',
    description: 'Customize your experience',
    icon: <Settings className="w-5 h-5" />,
    component: PreferencesStep,
    required: false
  },
  {
    id: 5,
    title: 'Personalize Your Feed',
    description: 'Choose your interests',
    icon: <Sparkles className="w-5 h-5" />,
    component: PersonalizationStep,
    required: false
  },
  {
    id: 6,
    title: 'Welcome Aboard!',
    description: "Let's get started",
    icon: <Award className="w-5 h-5" />,
    component: WelcomeStep,
    required: true
  }
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  onComplete,
  onSkip,
  initialStep = 1,
  initialData = {},
  className
}) => {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [data, setData] = useState<Partial<OnboardingData>>(initialData);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [showHelp, setShowHelp] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const currentStepData = steps[currentStep - 1];
  const totalSteps = steps.length;
  const canSkip = !currentStepData.required && currentStep < totalSteps;
  const progressPercentage = (currentStep / totalSteps) * 100;

  const updateData = useCallback((stepData: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...stepData }));
  }, []);

  const markStepComplete = useCallback((step: number) => {
    setCompletedSteps(prev => new Set(prev).add(step));
  }, []);

  const goToStep = useCallback((step: number) => {
    if (step < 1 || step > totalSteps || isAnimating) return;
    setIsAnimating(true);
    setCurrentStep(step);
    setTimeout(() => setIsAnimating(false), 400);
  }, [totalSteps, isAnimating]);

  const nextStep = useCallback(() => {
    if (currentStep < totalSteps) {
      markStepComplete(currentStep);
      goToStep(currentStep + 1);
    } else {
      markStepComplete(currentStep);
      onComplete(data as OnboardingData);
    }
  }, [currentStep, totalSteps, data, onComplete, markStepComplete, goToStep]);

  const previousStep = useCallback(() => {
    if (currentStep > 1) {
      goToStep(currentStep - 1);
    }
  }, [currentStep, goToStep]);

  const skipStep = useCallback(() => {
    if (canSkip) {
      const nextRequiredStep = steps.findIndex(
        (step, index) => index > currentStep - 1 && step.required
      );
      if (nextRequiredStep !== -1) {
        goToStep(nextRequiredStep + 1);
      } else {
        goToStep(totalSteps);
      }
    }
  }, [canSkip, currentStep, totalSteps, goToStep]);

  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && showHelp) {
      setShowHelp(false);
    }
  }, [showHelp]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  const contextValue: OnboardingContextType = {
    currentStep,
    totalSteps,
    data,
    updateData,
    goToStep,
    nextStep,
    previousStep,
    canSkip,
    skipStep,
    completedSteps,
    markStepComplete
  };

  const CurrentStepComponent = currentStepData.component;

  return (
    <OnboardingContext.Provider value={contextValue}>
      <GlassMorphism
        variant="heavy"
        className={cn('w-full max-w-2xl mx-auto p-8', className)}
        animated
      >
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <motion.h1
                key={`title-${currentStep}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="text-2xl font-bold text-cream mb-2"
              >
                {currentStepData.title}
              </motion.h1>
              <motion.p
                key={`desc-${currentStep}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="text-sage/70"
              >
                {currentStepData.description}
              </motion.p>
            </div>
            
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="p-2 hover:bg-sage/10 rounded-lg transition-colors"
              aria-label="Help and information"
            >
              <Info className="w-5 h-5 text-sage/70" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-sage/70">
                Step {currentStep} of {totalSteps}
              </span>
              <span className="text-teal-primary font-medium">
                {Math.round(progressPercentage)}% Complete
              </span>
            </div>
            
            <div className="relative h-2 bg-navy-dark/50 rounded-full overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-teal-primary to-teal-secondary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
              
              {/* Step Indicators */}
              <div className="absolute inset-0 flex items-center justify-between px-1">
                {steps.map((step, index) => (
                  <div
                    key={step.id}
                    className={cn(
                      'w-1.5 h-1.5 rounded-full transition-all duration-300',
                      completedSteps.has(index + 1)
                        ? 'bg-teal-primary'
                        : index + 1 === currentStep
                        ? 'bg-cream'
                        : 'bg-sage/30'
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="min-h-[400px]"
          >
            <CurrentStepComponent />
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-sage/20">
          <div className="flex items-center gap-3">
            {currentStep > 1 && (
              <button
                onClick={previousStep}
                disabled={isAnimating}
                className="flex items-center gap-2 px-4 py-2 text-sage hover:bg-sage/10 rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
            
            {canSkip && (
              <button
                onClick={skipStep}
                className="px-4 py-2 text-sage/70 hover:text-sage hover:bg-sage/10 rounded-lg transition-all duration-200"
              >
                Skip for now
              </button>
            )}
          </div>

          <button
            onClick={nextStep}
            disabled={isAnimating}
            className={cn(
              'flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200',
              'bg-gradient-to-r from-teal-primary to-teal-secondary text-cream',
              'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {currentStep === totalSteps ? (
              <>
                Complete
                <Check className="w-4 h-4" />
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Help Modal */}
        <AnimatePresence>
          {showHelp && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-navy-dark/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowHelp(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-navy-dark/90 backdrop-blur-md border border-sage/20 rounded-xl p-6 max-w-md w-full"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-cream">
                    Why do we need this?
                  </h3>
                  <button
                    onClick={() => setShowHelp(false)}
                    className="p-1 hover:bg-sage/10 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-sage/70" />
                  </button>
                </div>

                <div className="space-y-3 text-sm text-sage/80">
                  {currentStep === 1 && (
                    <>
                      <p>Creating an account allows you to:</p>
                      <ul className="space-y-2 ml-4">
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-teal-primary mt-0.5" />
                          <span>Save your favorite businesses</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-teal-primary mt-0.5" />
                          <span>Write reviews and ratings</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-teal-primary mt-0.5" />
                          <span>Get personalized recommendations</span>
                        </li>
                      </ul>
                    </>
                  )}

                  {currentStep === 2 && (
                    <>
                      <p>Email verification helps us:</p>
                      <ul className="space-y-2 ml-4">
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-teal-primary mt-0.5" />
                          <span>Protect your account security</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-teal-primary mt-0.5" />
                          <span>Prevent spam and fake accounts</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-teal-primary mt-0.5" />
                          <span>Enable password recovery</span>
                        </li>
                      </ul>
                    </>
                  )}

                  {currentStep === 3 && (
                    <>
                      <p>Your profile information helps us:</p>
                      <ul className="space-y-2 ml-4">
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-teal-primary mt-0.5" />
                          <span>Show relevant local businesses</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-teal-primary mt-0.5" />
                          <span>Connect you with your community</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-teal-primary mt-0.5" />
                          <span>Personalize your experience</span>
                        </li>
                      </ul>
                    </>
                  )}

                  {(currentStep === 4 || currentStep === 5) && (
                    <>
                      <p>These optional preferences help us:</p>
                      <ul className="space-y-2 ml-4">
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-teal-primary mt-0.5" />
                          <span>Show you relevant content first</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-teal-primary mt-0.5" />
                          <span>Send useful notifications only</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-teal-primary mt-0.5" />
                          <span>Improve your search results</span>
                        </li>
                      </ul>
                      <p className="text-teal-primary">
                        You can skip these and set them up later in your profile settings.
                      </p>
                    </>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step Dots for Mobile */}
        <div className="flex items-center justify-center gap-2 mt-6 md:hidden">
          {steps.map((step, index) => (
            <button
              key={step.id}
              onClick={() => goToStep(index + 1)}
              disabled={!completedSteps.has(index) && index + 1 !== currentStep}
              className={cn(
                'w-2 h-2 rounded-full transition-all duration-300',
                index + 1 === currentStep
                  ? 'w-8 bg-teal-primary'
                  : completedSteps.has(index + 1)
                  ? 'bg-teal-primary/50'
                  : 'bg-sage/30'
              )}
              aria-label={`Go to step ${index + 1}: ${step.title}`}
            />
          ))}
        </div>
      </GlassMorphism>
    </OnboardingContext.Provider>
  );
};

export default OnboardingWizard;