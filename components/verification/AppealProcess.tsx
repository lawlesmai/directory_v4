'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Upload,
  FileText,
  MessageSquare,
  CheckCircle,
  Clock,
  User,
  Calendar,
  Mail,
  Phone,
  Send,
  X,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '../GlassMorphism';

export interface AppealProcessProps {
  workflowId: string;
  rejectionReason: string;
  rejectionDetails?: string[];
  appealDeadline: string;
  onAppealSubmitted?: (appealData: AppealData) => void;
  onCancel?: () => void;
  className?: string;
}

export interface AppealData {
  appealType: AppealType[];
  explanation: string;
  supportingDocuments: File[];
  contactMethod: 'email' | 'phone' | 'both';
  urgentRequest: boolean;
  submittedAt: string;
}

export type AppealType = 
  | 'document_quality'
  | 'technical_error'
  | 'incorrect_rejection'
  | 'missing_information'
  | 'other';

interface AppealOption {
  type: AppealType;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
}

const APPEAL_OPTIONS: AppealOption[] = [
  {
    type: 'document_quality',
    label: 'Document Quality Issue',
    description: 'My documents were clear and readable',
    icon: FileText
  },
  {
    type: 'technical_error',
    label: 'Technical Error',
    description: 'There was a system or processing error',
    icon: AlertTriangle
  },
  {
    type: 'incorrect_rejection',
    label: 'Incorrect Rejection',
    description: 'The rejection was based on incorrect information',
    icon: X
  },
  {
    type: 'missing_information',
    label: 'Missing Information',
    description: 'I can provide additional required information',
    icon: Info
  },
  {
    type: 'other',
    label: 'Other Reason',
    description: 'My appeal reason is not listed above',
    icon: MessageSquare
  }
];

export const AppealProcess: React.FC<AppealProcessProps> = ({
  workflowId,
  rejectionReason,
  rejectionDetails = [],
  appealDeadline,
  onAppealSubmitted,
  onCancel,
  className
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [appealTypes, setAppealTypes] = useState<AppealType[]>([]);
  const [explanation, setExplanation] = useState('');
  const [supportingDocuments, setSupportingDocuments] = useState<File[]>([]);
  const [contactMethod, setContactMethod] = useState<'email' | 'phone' | 'both'>('email');
  const [urgentRequest, setUrgentRequest] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const steps = [
    { id: 'reason', title: 'Appeal Reason', description: 'Why are you appealing this decision?' },
    { id: 'explanation', title: 'Explanation', description: 'Provide details about your appeal' },
    { id: 'documents', title: 'Supporting Documents', description: 'Upload additional evidence (optional)' },
    { id: 'contact', title: 'Contact Preferences', description: 'How should we contact you?' },
    { id: 'review', title: 'Review & Submit', description: 'Review your appeal before submitting' }
  ];

  const daysUntilDeadline = Math.ceil(
    (new Date(appealDeadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  const toggleAppealType = (type: AppealType) => {
    setAppealTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;

    const validFiles = Array.from(files).filter(file => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      return file.size <= maxSize && allowedTypes.includes(file.type);
    });

    setSupportingDocuments(prev => [...prev, ...validFiles]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const removeDocument = (index: number) => {
    setSupportingDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const canProceed = (step: number) => {
    switch (step) {
      case 0: return appealTypes.length > 0;
      case 1: return explanation.trim().length >= 50;
      case 2: return true; // Documents are optional
      case 3: return true; // Contact method is always selected (defaults to 'email')
      default: return true;
    }
  };

  const handleSubmitAppeal = async () => {
    setIsSubmitting(true);
    
    try {
      const appealData: AppealData = {
        appealType: appealTypes,
        explanation: explanation.trim(),
        supportingDocuments,
        contactMethod,
        urgentRequest,
        submittedAt: new Date().toISOString()
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      onAppealSubmitted?.(appealData);
    } catch (error) {
      console.error('Failed to submit appeal:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center space-x-2 mb-8">
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
            index <= currentStep 
              ? 'bg-teal-primary text-cream' 
              : 'bg-sage/20 text-sage/50'
          )}>
            {index < currentStep ? '✓' : index + 1}
          </div>
          {index < steps.length - 1 && (
            <div className={cn(
              'h-0.5 w-8 transition-all',
              index < currentStep ? 'bg-teal-primary' : 'bg-sage/20'
            )} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderRejectionSummary = () => (
    <GlassMorphism variant="medium" className="p-6 mb-6">
      <div className="flex items-start space-x-3">
        <AlertTriangle className="w-6 h-6 text-red-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-cream mb-2">Verification Rejected</h3>
          <p className="text-red-200 mb-3">{rejectionReason}</p>
          
          {rejectionDetails.length > 0 && (
            <div>
              <p className="text-sage/70 text-sm mb-2">Specific issues:</p>
              <ul className="space-y-1">
                {rejectionDetails.map((detail, index) => (
                  <li key={index} className="text-red-200 text-sm flex items-start space-x-2">
                    <span className="text-red-400 mt-1">•</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-orange-400" />
              <span className="text-orange-200 text-sm">
                Appeal deadline: {daysUntilDeadline} day{daysUntilDeadline !== 1 ? 's' : ''} remaining
              </span>
            </div>
          </div>
        </div>
      </div>
    </GlassMorphism>
  );

  const renderAppealReasonStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-cream mb-2">Select Appeal Reason(s)</h3>
        <p className="text-sage/70">Choose all reasons that apply to your appeal</p>
      </div>

      <div className="space-y-3">
        {APPEAL_OPTIONS.map((option) => {
          const IconComponent = option.icon;
          const isSelected = appealTypes.includes(option.type);

          return (
            <motion.button
              key={option.type}
              onClick={() => toggleAppealType(option.type)}
              className={cn(
                'w-full p-4 rounded-lg border-2 transition-all duration-200 text-left',
                isSelected 
                  ? 'border-teal-primary bg-teal-primary/10' 
                  : 'border-sage/20 hover:border-sage/40'
              )}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="flex items-start space-x-3">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  isSelected ? 'bg-teal-primary/20 text-teal-primary' : 'bg-sage/20 text-sage'
                )}>
                  <IconComponent className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-cream font-medium">{option.label}</h4>
                    {isSelected && <CheckCircle className="w-4 h-4 text-teal-primary" />}
                  </div>
                  <p className="text-sage/70 text-sm mt-1">{option.description}</p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );

  const renderExplanationStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-cream mb-2">Explain Your Appeal</h3>
        <p className="text-sage/70">Provide a detailed explanation of why you believe the decision should be reversed</p>
      </div>

      <div>
        <label htmlFor="explanation" className="block text-sm font-medium text-cream mb-2">
          Appeal Explanation *
        </label>
        <textarea
          id="explanation"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows={6}
          className={cn(
            'w-full py-3 px-4 rounded-lg bg-navy-dark/50 backdrop-blur-sm border text-cream',
            'placeholder-sage/50 focus:outline-none focus:ring-2',
            explanation.length >= 50
              ? 'border-sage/20 focus:ring-teal-primary/50 focus:border-teal-primary/50'
              : 'border-orange-500/50 focus:ring-orange-500/50 focus:border-orange-500/50'
          )}
          placeholder="Please explain in detail why you believe your verification was incorrectly rejected. Include any relevant circumstances, additional context, or corrections to the information reviewed."
        />
        <div className="flex justify-between mt-2">
          <p className={cn(
            'text-sm',
            explanation.length >= 50 ? 'text-sage/70' : 'text-orange-400'
          )}>
            {explanation.length < 50 ? `${50 - explanation.length} more characters required` : 'Minimum length met'}
          </p>
          <p className="text-sage/50 text-sm">{explanation.length}/1000</p>
        </div>
      </div>

      <div className="p-4 bg-teal-primary/10 border border-teal-primary/20 rounded-lg">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-teal-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-teal-200 font-medium mb-1">Tips for a successful appeal:</p>
            <ul className="text-teal-100/80 text-sm space-y-1">
              <li>• Be specific about which part of the rejection you're disputing</li>
              <li>• Provide factual corrections to any incorrect assessments</li>
              <li>• Explain any circumstances that may have affected document quality</li>
              <li>• Reference specific documents or information if relevant</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDocumentsStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-cream mb-2">Supporting Documents</h3>
        <p className="text-sage/70">Upload additional documents that support your appeal (optional)</p>
      </div>

      <GlassMorphism variant="subtle" className="p-6">
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200',
            dragActive ? 'border-teal-primary bg-teal-primary/10' : 'border-sage/30',
            'hover:border-sage/50 hover:bg-sage/5'
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Upload className="w-12 h-12 text-sage/50 mx-auto mb-4" />
          <p className="text-cream mb-2">
            {dragActive ? 'Drop your documents here' : 'Drag and drop documents here'}
          </p>
          <p className="text-sage/70 text-sm mb-4">or</p>
          
          <motion.button
            type="button"
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.multiple = true;
              input.accept = '.pdf,.jpg,.jpeg,.png,.webp';
              input.onchange = (e) => handleFileSelect((e.target as HTMLInputElement).files);
              input.click();
            }}
            className={cn(
              'px-6 py-3 bg-teal-primary hover:bg-teal-secondary',
              'text-cream font-medium rounded-lg transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-teal-primary/50'
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Browse Files
          </motion.button>
        </div>

        {supportingDocuments.length > 0 && (
          <div className="mt-6">
            <h4 className="font-medium text-cream mb-3">Uploaded Documents</h4>
            <div className="space-y-2">
              {supportingDocuments.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 border border-sage/20 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-sage" />
                    <div>
                      <p className="text-cream text-sm">{file.name}</p>
                      <p className="text-sage/70 text-xs">{Math.round(file.size / 1024)} KB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeDocument(index)}
                    className="p-1 text-red-400 hover:text-red-300 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-sage/50 text-xs mt-4">
          Accepted formats: PDF, JPG, PNG, WEBP • Max size: 10MB per file
        </p>
      </GlassMorphism>
    </div>
  );

  const renderContactStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-cream mb-2">Contact Preferences</h3>
        <p className="text-sage/70">How should we contact you about your appeal?</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-cream mb-3">Preferred Contact Method *</label>
          <div className="space-y-3">
            {[
              { value: 'email', label: 'Email Only', icon: Mail, description: 'Receive updates via email' },
              { value: 'phone', label: 'Phone Only', icon: Phone, description: 'Receive updates via phone calls' },
              { value: 'both', label: 'Email and Phone', icon: MessageSquare, description: 'Receive updates via both methods' }
            ].map((option) => {
              const IconComponent = option.icon;
              const isSelected = contactMethod === option.value;

              return (
                <motion.button
                  key={option.value}
                  onClick={() => setContactMethod(option.value as any)}
                  className={cn(
                    'w-full p-4 rounded-lg border-2 transition-all duration-200 text-left',
                    isSelected 
                      ? 'border-teal-primary bg-teal-primary/10' 
                      : 'border-sage/20 hover:border-sage/40'
                  )}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div className="flex items-center space-x-3">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      isSelected ? 'bg-teal-primary/20 text-teal-primary' : 'bg-sage/20 text-sage'
                    )}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-cream font-medium">{option.label}</h4>
                        {isSelected && <CheckCircle className="w-4 h-4 text-teal-primary" />}
                      </div>
                      <p className="text-sage/70 text-sm">{option.description}</p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-sage/20">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={urgentRequest}
              onChange={(e) => setUrgentRequest(e.target.checked)}
              className="w-4 h-4 text-teal-primary bg-transparent border-2 border-sage/30 rounded focus:ring-teal-primary focus:ring-2"
            />
            <div>
              <p className="text-cream font-medium">Mark as urgent</p>
              <p className="text-sage/70 text-sm">
                Request priority processing (additional review may be required)
              </p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-cream mb-2">Review Your Appeal</h3>
        <p className="text-sage/70">Please review your appeal details before submitting</p>
      </div>

      <div className="space-y-4">
        <GlassMorphism variant="subtle" className="p-4">
          <h4 className="font-medium text-cream mb-2">Appeal Reasons</h4>
          <div className="flex flex-wrap gap-2">
            {appealTypes.map((type) => {
              const option = APPEAL_OPTIONS.find(o => o.type === type);
              return (
                <span key={type} className="px-3 py-1 bg-teal-primary/20 text-teal-200 rounded-full text-sm">
                  {option?.label}
                </span>
              );
            })}
          </div>
        </GlassMorphism>

        <GlassMorphism variant="subtle" className="p-4">
          <h4 className="font-medium text-cream mb-2">Explanation</h4>
          <p className="text-sage/90 text-sm">{explanation}</p>
        </GlassMorphism>

        {supportingDocuments.length > 0 && (
          <GlassMorphism variant="subtle" className="p-4">
            <h4 className="font-medium text-cream mb-2">Supporting Documents</h4>
            <div className="space-y-2">
              {supportingDocuments.map((file, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-sage" />
                  <span className="text-sage/90 text-sm">{file.name}</span>
                </div>
              ))}
            </div>
          </GlassMorphism>
        )}

        <GlassMorphism variant="subtle" className="p-4">
          <h4 className="font-medium text-cream mb-2">Contact Preferences</h4>
          <div className="space-y-1">
            <p className="text-sage/90 text-sm">Method: {contactMethod}</p>
            {urgentRequest && (
              <p className="text-orange-300 text-sm">⚡ Marked as urgent</p>
            )}
          </div>
        </GlassMorphism>
      </div>

      <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-yellow-200 font-medium mb-1">Before You Submit</p>
            <ul className="text-yellow-100/80 text-sm space-y-1">
              <li>• Appeals are typically reviewed within 3-5 business days</li>
              <li>• You will receive email confirmation once your appeal is submitted</li>
              <li>• Additional information may be requested during the review process</li>
              <li>• Appeal decisions are final and cannot be appealed again</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: return renderAppealReasonStep();
      case 1: return renderExplanationStep();
      case 2: return renderDocumentsStep();
      case 3: return renderContactStep();
      case 4: return renderReviewStep();
      default: return null;
    }
  };

  const renderNavigation = () => (
    <div className="flex justify-between items-center pt-6 border-t border-sage/20">
      <motion.button
        onClick={() => currentStep === 0 ? onCancel?.() : setCurrentStep(currentStep - 1)}
        className={cn(
          'px-6 py-3 rounded-lg font-medium transition-all duration-200',
          'border border-sage/30 text-sage hover:text-cream',
          'hover:border-sage/50 hover:bg-sage/10',
          'focus:outline-none focus:ring-2 focus:ring-sage/50'
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {currentStep === 0 ? 'Cancel' : 'Back'}
      </motion.button>

      <motion.button
        onClick={() => {
          if (currentStep === steps.length - 1) {
            handleSubmitAppeal();
          } else {
            setCurrentStep(currentStep + 1);
          }
        }}
        disabled={!canProceed(currentStep) || isSubmitting}
        className={cn(
          'px-6 py-3 rounded-lg font-medium transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
          canProceed(currentStep) && !isSubmitting
            ? 'bg-teal-primary hover:bg-teal-secondary text-cream'
            : 'bg-sage/20 text-sage/50 cursor-not-allowed'
        )}
        whileHover={canProceed(currentStep) && !isSubmitting ? { scale: 1.02 } : {}}
        whileTap={canProceed(currentStep) && !isSubmitting ? { scale: 0.98 } : {}}
      >
        {isSubmitting ? (
          <div className="flex items-center space-x-2">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-4 h-4 border-2 border-cream border-t-transparent rounded-full"
            />
            <span>Submitting...</span>
          </div>
        ) : currentStep === steps.length - 1 ? (
          <div className="flex items-center space-x-2">
            <Send className="w-4 h-4" />
            <span>Submit Appeal</span>
          </div>
        ) : (
          'Next'
        )}
      </motion.button>
    </div>
  );

  return (
    <div className={cn('w-full max-w-3xl mx-auto', className)}>
      <GlassMorphism variant="medium" className="p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-cream mb-2">Appeal Verification Decision</h1>
          <p className="text-sage/70">
            Contest the verification decision by providing additional information
          </p>
        </div>

        {/* Rejection Summary */}
        {renderRejectionSummary()}

        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Step Content */}
        <div className="mb-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-cream mb-2">
              {steps[currentStep].title}
            </h2>
            <p className="text-sage/70">
              {steps[currentStep].description}
            </p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        {renderNavigation()}
      </GlassMorphism>
    </div>
  );
};

export default AppealProcess;