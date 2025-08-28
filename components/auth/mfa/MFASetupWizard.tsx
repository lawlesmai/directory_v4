'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield,
  Smartphone,
  MessageSquare,
  Key,
  ChevronRight,
  ChevronLeft,
  Check,
  CheckCircle,
  AlertCircle,
  Lock,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '@/components/GlassMorphism';
import TOTPSetup from './TOTPSetup';
import SMSSetup from './SMSSetup';
import BackupCodes from './BackupCodes';
import { 
  MFASetupWizardProps, 
  MFASetupWizardState, 
  MFAMethod,
  BackupCodesData 
} from './types';

// Progress indicator component
const ProgressIndicator: React.FC<{
  currentStep: number;
  totalSteps: number;
  steps: Array<{ label: string; icon: React.ElementType }>;
}> = ({ currentStep, totalSteps, steps }) => {
  return (
    <div className="relative">
      {/* Progress bar */}
      <div className="absolute top-5 left-0 right-0 h-0.5 bg-sage/20">
        <motion.div
          className="h-full bg-gradient-to-r from-teal-primary to-teal-secondary"
          initial={{ width: '0%' }}
          animate={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />
      </div>
      
      {/* Step indicators */}
      <div className="relative flex justify-between">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;
          const Icon = step.icon;
          
          return (
            <div
              key={index}
              className="flex flex-col items-center"
            >
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ 
                  scale: isActive ? 1.1 : 1,
                  backgroundColor: isCompleted 
                    ? 'rgb(45, 212, 191)' 
                    : isActive 
                    ? 'rgb(20, 30, 48)'
                    : 'rgb(20, 30, 48)'
                }}
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  'border-2 transition-all duration-300',
                  {
                    'border-teal-primary': isActive || isCompleted,
                    'border-sage/30': !isActive && !isCompleted,
                    'shadow-lg shadow-teal-primary/30': isActive
                  }
                )}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5 text-navy-dark" />
                ) : (
                  <Icon className={cn(
                    'w-5 h-5',
                    isActive ? 'text-teal-primary' : 'text-sage/50'
                  )} />
                )}
              </motion.div>
              
              <span className={cn(
                'mt-2 text-xs font-medium',
                isActive ? 'text-cream' : 'text-sage/60'
              )}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Method selection component
const MethodSelection: React.FC<{
  availableMethods: MFAMethod[];
  onSelect: (method: MFAMethod) => void;
}> = ({ availableMethods, onSelect }) => {
  const methodDetails = {
    totp: {
      icon: Smartphone,
      title: 'Authenticator App',
      description: 'Use apps like Google Authenticator or Authy',
      benefits: ['Most secure option', 'Works offline', 'No SMS fees'],
      recommended: true
    },
    sms: {
      icon: MessageSquare,
      title: 'Text Message (SMS)',
      description: 'Receive codes via text message',
      benefits: ['Easy to set up', 'No app required', 'Quick verification'],
      recommended: false
    },
    backup_codes: {
      icon: Key,
      title: 'Backup Codes',
      description: 'One-time use recovery codes',
      benefits: ['Emergency access', 'Works offline', 'Print or save digitally'],
      recommended: false
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-medium text-cream mb-2">
          Choose Your Security Method
        </h3>
        <p className="text-sm text-sage/70">
          Select how you want to secure your account
        </p>
      </div>
      
      <div className="space-y-3">
        {availableMethods.filter(m => m !== 'backup_codes').map((method) => {
          const details = methodDetails[method];
          const Icon = details.icon;
          
          return (
            <motion.button
              key={method}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(method)}
              className={cn(
                'w-full p-4 rounded-lg transition-all duration-200',
                'border text-left group relative',
                'bg-navy-dark/30 border-sage/20',
                'hover:bg-navy-dark/40 hover:border-sage/30'
              )}
            >
              {details.recommended && (
                <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-teal-primary rounded-full">
                  <span className="text-xs font-medium text-navy-dark">Recommended</span>
                </div>
              )}
              
              <div className="flex gap-4">
                <div className="p-3 rounded-lg bg-navy-dark/50 group-hover:bg-navy-dark/60 transition-colors">
                  <Icon className="w-6 h-6 text-teal-primary" />
                </div>
                
                <div className="flex-1 space-y-2">
                  <h4 className="font-medium text-cream">
                    {details.title}
                  </h4>
                  <p className="text-sm text-sage/70">
                    {details.description}
                  </p>
                  <ul className="flex flex-wrap gap-2 mt-2">
                    {details.benefits.map((benefit, index) => (
                      <li
                        key={index}
                        className="text-xs px-2 py-1 bg-navy-dark/50 rounded text-sage/60"
                      >
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <ChevronRight className="w-5 h-5 text-sage/30 group-hover:text-sage/50 group-hover:translate-x-1 transition-all" />
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

// Setup complete component
const SetupComplete: React.FC<{
  method: MFAMethod;
  hasBackupCodes: boolean;
  onFinish: () => void;
}> = ({ method, hasBackupCodes, onFinish }) => {
  const methodLabels = {
    totp: 'Authenticator App',
    sms: 'SMS Verification',
    backup_codes: 'Backup Codes'
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center space-y-6"
    >
      <div className="inline-flex p-4 bg-teal-primary/10 rounded-full">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', bounce: 0.5 }}
        >
          <CheckCircle className="w-12 h-12 text-teal-primary" />
        </motion.div>
      </div>
      
      <div className="space-y-2">
        <h3 className="text-2xl font-bold text-cream">
          MFA Setup Complete!
        </h3>
        <p className="text-sage/70">
          Your account is now protected with {methodLabels[method]}
        </p>
      </div>
      
      <div className="p-4 bg-teal-primary/10 border border-teal-primary/20 rounded-lg">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-teal-primary flex-shrink-0 mt-0.5" />
          <div className="text-left space-y-1">
            <p className="text-sm font-medium text-cream">
              Security Status: Active
            </p>
            <p className="text-xs text-sage/70">
              Two-factor authentication is now enabled for your account.
              {hasBackupCodes && ' Your backup codes have been saved.'}
            </p>
          </div>
        </div>
      </div>
      
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-cream">What's Next?</h4>
        <ul className="text-left space-y-2 text-sm text-sage/70">
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-teal-primary flex-shrink-0 mt-0.5" />
            <span>You'll be asked to verify with MFA on your next login</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-teal-primary flex-shrink-0 mt-0.5" />
            <span>You can add additional MFA methods for extra security</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-teal-primary flex-shrink-0 mt-0.5" />
            <span>Manage your MFA settings anytime from your account</span>
          </li>
        </ul>
      </div>
      
      <button
        onClick={onFinish}
        className={cn(
          'w-full px-6 py-3 rounded-lg font-medium transition-all duration-200',
          'bg-gradient-to-r from-teal-primary to-teal-secondary text-cream',
          'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
          'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
          'focus:ring-offset-2 focus:ring-offset-navy-dark'
        )}
      >
        Finish Setup
      </button>
    </motion.div>
  );
};

export const MFASetupWizard: React.FC<MFASetupWizardProps> = ({
  userId,
  onComplete,
  onCancel,
  availableMethods = ['totp', 'sms'],
  className = ''
}) => {
  const [wizardState, setWizardState] = useState<MFASetupWizardState>({
    currentStep: 1,
    totalSteps: 4,
    selectedMethod: undefined,
    isVerified: false
  });
  
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [setupFactorId, setSetupFactorId] = useState<string>('');
  
  // Generate backup codes
  const generateBackupCodes = (): string[] => {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const code = `${Math.random().toString(36).substr(2, 4).toUpperCase()}-${
        Math.random().toString(36).substr(2, 4).toUpperCase()}-${
        Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      codes.push(code);
    }
    return codes;
  };
  
  // Handle method selection
  const handleMethodSelect = (method: MFAMethod) => {
    setWizardState(prev => ({
      ...prev,
      selectedMethod: method,
      currentStep: 2
    }));
  };
  
  // Handle setup completion
  const handleSetupComplete = (factorId: string) => {
    setSetupFactorId(factorId);
    const codes = generateBackupCodes();
    setBackupCodes(codes);
    setWizardState(prev => ({
      ...prev,
      currentStep: 3,
      isVerified: true,
      backupCodes: {
        codes,
        generatedAt: new Date(),
        usedCodes: [],
        remainingCodes: codes.length
      }
    }));
  };
  
  // Handle backup codes confirmation
  const handleBackupCodesConfirm = () => {
    setWizardState(prev => ({
      ...prev,
      currentStep: 4
    }));
  };
  
  // Handle completion
  const handleComplete = () => {
    if (wizardState.selectedMethod) {
      onComplete({
        id: setupFactorId,
        userId,
        type: wizardState.selectedMethod,
        status: 'enabled',
        createdAt: new Date(),
        isDefault: true
      });
    }
  };
  
  // Define wizard steps
  const wizardSteps = [
    { label: 'Choose', icon: Shield },
    { label: 'Setup', icon: wizardState.selectedMethod === 'sms' ? MessageSquare : Smartphone },
    { label: 'Backup', icon: Key },
    { label: 'Complete', icon: Check }
  ];
  
  return (
    <GlassMorphism
      variant="medium"
      className={cn('p-6 sm:p-8 max-w-2xl mx-auto', className)}
      animated
    >
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-cream">
              Secure Your Account
            </h2>
            <p className="text-sm text-sage/70 mt-1">
              Set up two-factor authentication for enhanced security
            </p>
          </div>
          
          <button
            onClick={onCancel}
            className="p-2 hover:bg-navy-dark/30 rounded-lg transition-colors"
            aria-label="Cancel setup"
          >
            <X className="w-5 h-5 text-sage/50" />
          </button>
        </div>
        
        {/* Progress Indicator */}
        <ProgressIndicator
          currentStep={wizardState.currentStep}
          totalSteps={wizardState.totalSteps}
          steps={wizardSteps}
        />
        
        {/* Step Content */}
        <AnimatePresence mode="wait">
          {/* Step 1: Method Selection */}
          {wizardState.currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <MethodSelection
                availableMethods={availableMethods}
                onSelect={handleMethodSelect}
              />
            </motion.div>
          )}
          
          {/* Step 2: Method Setup */}
          {wizardState.currentStep === 2 && wizardState.selectedMethod && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {wizardState.selectedMethod === 'totp' && (
                <TOTPSetup
                  userId={userId}
                  onSetupComplete={handleSetupComplete}
                  onError={(error) => console.error(error)}
                  showManualEntry
                />
              )}
              {wizardState.selectedMethod === 'sms' && (
                <SMSSetup
                  userId={userId}
                  onSetupComplete={handleSetupComplete}
                  onError={(error) => console.error(error)}
                />
              )}
            </motion.div>
          )}
          
          {/* Step 3: Backup Codes */}
          {wizardState.currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <BackupCodes
                codes={backupCodes}
                onConfirm={handleBackupCodesConfirm}
                onDownload={() => console.log('Downloaded backup codes')}
                onPrint={() => console.log('Printed backup codes')}
              />
            </motion.div>
          )}
          
          {/* Step 4: Complete */}
          {wizardState.currentStep === 4 && wizardState.selectedMethod && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <SetupComplete
                method={wizardState.selectedMethod}
                hasBackupCodes={backupCodes.length > 0}
                onFinish={handleComplete}
              />
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Navigation (for steps 1-2) */}
        {wizardState.currentStep < 3 && (
          <div className="flex justify-between pt-4 border-t border-sage/10">
            <button
              onClick={() => {
                if (wizardState.currentStep === 1) {
                  onCancel();
                } else {
                  setWizardState(prev => ({
                    ...prev,
                    currentStep: prev.currentStep - 1
                  }));
                }
              }}
              className="flex items-center gap-2 px-4 py-2 text-sage/70 hover:text-cream transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              {wizardState.currentStep === 1 ? 'Cancel' : 'Back'}
            </button>
            
            {wizardState.currentStep === 1 && (
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sage/70 hover:text-cream transition-colors"
              >
                Set Up Later
              </button>
            )}
          </div>
        )}
      </div>
    </GlassMorphism>
  );
};

export default MFASetupWizard;