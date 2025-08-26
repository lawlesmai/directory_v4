'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle, 
  HelpCircle, 
  Shield, 
  Clock,
  FileText,
  User,
  Building,
  Eye,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '../GlassMorphism';
import { DocumentUploader } from './DocumentUploader';
import { IdentityVerification } from './IdentityVerification';
import { BusinessVerification } from './BusinessVerification';
import { VerificationDashboard } from './VerificationDashboard';
import { ComplianceEducation } from './ComplianceEducation';
import { useKYCVerification } from '@/hooks/useKYCVerification';

export interface KYCWizardProps {
  businessId?: string;
  onComplete?: (result: VerificationResult) => void;
  onCancel?: () => void;
  className?: string;
}

export interface VerificationStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  component: React.ComponentType<any>;
  required: boolean;
  estimatedMinutes: number;
  canSkip: boolean;
  skipConditions?: string[];
}

export interface VerificationResult {
  success: boolean;
  workflowId: string;
  status: 'approved' | 'pending' | 'rejected' | 'additional_info_required';
  completionPercentage: number;
  nextSteps: string[];
}

export interface StepData {
  [stepId: string]: any;
}

const VERIFICATION_STEPS: VerificationStep[] = [
  {
    id: 'education',
    title: 'Verification Overview',
    description: 'Learn why verification is required and what to expect',
    icon: Shield,
    component: ComplianceEducation,
    required: true,
    estimatedMinutes: 2,
    canSkip: false,
  },
  {
    id: 'business_documents',
    title: 'Business Documents',
    description: 'Upload your business license and registration documents',
    icon: FileText,
    component: DocumentUploader,
    required: true,
    estimatedMinutes: 5,
    canSkip: false,
  },
  {
    id: 'identity_verification',
    title: 'Identity Verification',
    description: 'Verify your identity with photo ID and selfie',
    icon: User,
    component: IdentityVerification,
    required: true,
    estimatedMinutes: 3,
    canSkip: false,
  },
  {
    id: 'business_information',
    title: 'Business Information',
    description: 'Complete your business profile and contact details',
    icon: Building,
    component: BusinessVerification,
    required: true,
    estimatedMinutes: 4,
    canSkip: false,
  },
  {
    id: 'review_submit',
    title: 'Review & Submit',
    description: 'Review your information and submit for verification',
    icon: Eye,
    component: VerificationDashboard,
    required: true,
    estimatedMinutes: 2,
    canSkip: false,
  }
];

export const KYCWizard: React.FC<KYCWizardProps> = ({
  businessId,
  onComplete,
  onCancel,
  className
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [stepData, setStepData] = useState<StepData>({});
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [sessionStartTime] = useState(Date.now());
  
  const wizardRef = useRef<HTMLDivElement>(null);
  const currentStep = VERIFICATION_STEPS[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === VERIFICATION_STEPS.length - 1;

  const {
    workflowId,
    verificationStatus,
    initializeVerification,
    submitStepData,
    uploadDocument,
    submitForReview
  } = useKYCVerification(businessId);

  // Initialize verification workflow on mount
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      try {
        await initializeVerification();
      } catch (error) {
        console.error('Failed to initialize verification:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [initializeVerification]);

  // Auto-save step data
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (Object.keys(stepData).length > 0) {
        // Auto-save current progress
        localStorage.setItem('kyc_verification_progress', JSON.stringify({
          currentStepIndex,
          completedSteps: Array.from(completedSteps),
          stepData,
          timestamp: Date.now()
        }));
      }
    }, 30000); // Save every 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [currentStepIndex, completedSteps, stepData]);

  // Restore progress on mount
  useEffect(() => {
    const savedProgress = localStorage.getItem('kyc_verification_progress');
    if (savedProgress) {
      try {
        const progress = JSON.parse(savedProgress);
        const timeDiff = Date.now() - progress.timestamp;
        
        // Only restore if saved within last 24 hours
        if (timeDiff < 24 * 60 * 60 * 1000) {
          setCurrentStepIndex(progress.currentStepIndex || 0);
          setCompletedSteps(new Set(progress.completedSteps || []));
          setStepData(progress.stepData || {});
        }
      } catch (error) {
        console.error('Failed to restore progress:', error);
      }
    }
  }, []);

  // Calculate completion percentage
  const completionPercentage = Math.round((completedSteps.size / VERIFICATION_STEPS.length) * 100);

  // Calculate estimated time remaining
  const estimatedTimeRemaining = VERIFICATION_STEPS
    .slice(currentStepIndex)
    .reduce((total, step) => total + step.estimatedMinutes, 0);

  const handleStepComplete = useCallback(async (data: any, isSkipped: boolean = false) => {
    if (!currentStep) return;

    setIsLoading(true);
    try {
      // Update step data
      const newStepData = {
        ...stepData,
        [currentStep.id]: data
      };
      setStepData(newStepData);

      // Submit step data to backend
      if (!isSkipped && workflowId) {
        await submitStepData(currentStep.id, data);
      }

      // Mark step as completed
      const newCompletedSteps = new Set(completedSteps);
      newCompletedSteps.add(currentStepIndex);
      setCompletedSteps(newCompletedSteps);

      // Clear errors for this step
      const newErrors = { ...errors };
      delete newErrors[currentStep.id];
      setErrors(newErrors);

      // Move to next step or complete wizard
      if (isLastStep) {
        await handleWizardComplete(newStepData);
      } else {
        setCurrentStepIndex(currentStepIndex + 1);
      }
    } catch (error) {
      console.error('Error completing step:', error);
      setErrors({
        ...errors,
        [currentStep.id]: ['Failed to save step data. Please try again.']
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    currentStep,
    stepData,
    workflowId,
    completedSteps,
    errors,
    currentStepIndex,
    isLastStep,
    submitStepData
  ]);

  const handleWizardComplete = useCallback(async (finalStepData: StepData) => {
    if (!workflowId) return;

    try {
      const result = await submitForReview(finalStepData);
      
      // Clear saved progress
      localStorage.removeItem('kyc_verification_progress');
      
      onComplete?.(result);
    } catch (error) {
      console.error('Error completing verification:', error);
      setErrors({
        ...errors,
        wizard: ['Failed to submit verification. Please try again.']
      });
    }
  }, [workflowId, submitForReview, onComplete, errors]);

  const handleStepError = useCallback((stepId: string, errorMessages: string[]) => {
    setErrors({
      ...errors,
      [stepId]: errorMessages
    });
  }, [errors]);

  const handlePreviousStep = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  }, [isFirstStep, currentStepIndex]);

  const handleSkipStep = useCallback(() => {
    if (currentStep?.canSkip) {
      handleStepComplete({}, true);
    }
  }, [currentStep, handleStepComplete]);

  const handleCancel = useCallback(() => {
    // Clear saved progress
    localStorage.removeItem('kyc_verification_progress');
    onCancel?.();
  }, [onCancel]);

  const renderProgressBar = () => (
    <div className="w-full bg-navy-dark/30 rounded-full h-2 mb-8">
      <motion.div
        className="h-2 bg-gradient-to-r from-teal-primary to-teal-secondary rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${(currentStepIndex / VERIFICATION_STEPS.length) * 100}%` }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      />
      <div className="flex justify-between mt-2 text-xs text-sage/70">
        <span>Step {currentStepIndex + 1} of {VERIFICATION_STEPS.length}</span>
        <span>{completionPercentage}% Complete</span>
      </div>
    </div>
  );

  const renderStepIndicators = () => (
    <div className="flex justify-between items-center mb-8">
      {VERIFICATION_STEPS.map((step, index) => {
        const isCompleted = completedSteps.has(index);
        const isCurrent = index === currentStepIndex;
        const isPast = index < currentStepIndex;
        const IconComponent = step.icon;

        return (
          <div key={step.id} className="flex flex-col items-center">
            <motion.div
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center border-2 mb-2',
                'transition-all duration-300',
                isCompleted && 'bg-teal-primary border-teal-primary text-cream',
                isCurrent && !isCompleted && 'border-teal-primary text-teal-primary bg-teal-primary/10',
                !isCurrent && !isCompleted && !isPast && 'border-sage/30 text-sage/50',
                isPast && !isCompleted && 'border-sage/50 text-sage/70'
              )}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isCompleted ? (
                <CheckCircle className="w-6 h-6" />
              ) : (
                <IconComponent className="w-6 h-6" />
              )}
            </motion.div>
            <span className={cn(
              'text-xs text-center max-w-20',
              isCurrent ? 'text-cream font-medium' : 'text-sage/70'
            )}>
              {step.title}
            </span>
          </div>
        );
      })}
    </div>
  );

  const renderCurrentStep = () => {
    if (!currentStep) return null;

    const StepComponent = currentStep.component;
    const stepErrors = errors[currentStep.id] || [];

    return (
      <motion.div
        key={currentStep.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3 }}
        className="min-h-96"
      >
        {stepErrors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg"
          >
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-red-300 font-medium mb-1">Error</p>
                <ul className="text-red-200 text-sm space-y-1">
                  {stepErrors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}

        <StepComponent
          workflowId={workflowId}
          businessId={businessId}
          stepData={stepData[currentStep.id] || {}}
          onComplete={handleStepComplete}
          onError={(errors: string[]) => handleStepError(currentStep.id, errors)}
          isLoading={isLoading}
        />
      </motion.div>
    );
  };

  const renderNavigationButtons = () => (
    <div className="flex justify-between items-center pt-6 border-t border-sage/20">
      <div className="flex space-x-3">
        {!isFirstStep && (
          <motion.button
            type="button"
            onClick={handlePreviousStep}
            disabled={isLoading}
            className={cn(
              'px-6 py-3 rounded-lg font-medium transition-all duration-200',
              'border border-sage/30 text-sage hover:text-cream',
              'hover:border-sage/50 hover:bg-sage/10',
              'focus:outline-none focus:ring-2 focus:ring-sage/50',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </motion.button>
        )}

        <motion.button
          type="button"
          onClick={() => setShowHelp(true)}
          className={cn(
            'px-4 py-3 rounded-lg font-medium transition-all duration-200',
            'border border-sage/30 text-sage hover:text-cream',
            'hover:border-sage/50 hover:bg-sage/10',
            'focus:outline-none focus:ring-2 focus:ring-sage/50'
          )}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <HelpCircle className="w-4 h-4" />
        </motion.button>
      </div>

      <div className="flex items-center space-x-3">
        <div className="flex items-center text-sage/70 text-sm">
          <Clock className="w-4 h-4 mr-1" />
          ~{estimatedTimeRemaining} min remaining
        </div>

        {currentStep?.canSkip && (
          <motion.button
            type="button"
            onClick={handleSkipStep}
            disabled={isLoading}
            className={cn(
              'px-4 py-3 rounded-lg font-medium transition-all duration-200',
              'text-sage/70 hover:text-sage',
              'focus:outline-none focus:ring-2 focus:ring-sage/50',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Skip
          </motion.button>
        )}

        <motion.button
          type="button"
          onClick={handleCancel}
          disabled={isLoading}
          className={cn(
            'px-6 py-3 rounded-lg font-medium transition-all duration-200',
            'border border-red-500/30 text-red-400 hover:text-red-300',
            'hover:border-red-500/50 hover:bg-red-500/10',
            'focus:outline-none focus:ring-2 focus:ring-red-500/50',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Cancel
        </motion.button>
      </div>
    </div>
  );

  const renderHelpModal = () => (
    <AnimatePresence>
      {showHelp && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-dark/80 backdrop-blur-sm p-4"
          onClick={() => setShowHelp(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md"
          >
            <GlassMorphism variant="medium" className="p-6">
              <h3 className="text-lg font-semibold text-cream mb-4">
                {currentStep?.title} Help
              </h3>
              <p className="text-sage/90 text-sm mb-6">
                {currentStep?.description}
              </p>
              <div className="space-y-3">
                <div className="text-sm">
                  <p className="text-sage/70 mb-1">Estimated time:</p>
                  <p className="text-cream">{currentStep?.estimatedMinutes} minutes</p>
                </div>
                {currentStep?.canSkip && (
                  <div className="text-sm">
                    <p className="text-sage/70 mb-1">This step can be skipped</p>
                    <p className="text-orange-300 text-xs">
                      Note: Skipping may affect verification approval
                    </p>
                  </div>
                )}
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowHelp(false)}
                  className="px-4 py-2 text-teal-primary hover:text-teal-secondary transition-colors"
                >
                  Close
                </button>
              </div>
            </GlassMorphism>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (isLoading && currentStepIndex === 0) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-8 h-8 border-2 border-teal-primary border-t-transparent rounded-full mb-4 mx-auto"
          />
          <p className="text-sage/70">Initializing verification...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={wizardRef} className={cn('w-full max-w-4xl mx-auto', className)}>
      <GlassMorphism variant="medium" className="p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-cream mb-2">
            Business Verification
          </h1>
          <p className="text-sage/70">
            Complete your business verification to unlock all features
          </p>
        </div>

        {/* Progress Bar */}
        {renderProgressBar()}

        {/* Step Indicators */}
        <div className="hidden md:block">
          {renderStepIndicators()}
        </div>

        {/* Current Step */}
        <div className="mb-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-cream mb-2">
              {currentStep?.title}
            </h2>
            <p className="text-sage/70">
              {currentStep?.description}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {renderCurrentStep()}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        {renderNavigationButtons()}
      </GlassMorphism>

      {/* Help Modal */}
      {renderHelpModal()}

      {/* Session timeout warning could go here */}
    </div>
  );
};

export default KYCWizard;