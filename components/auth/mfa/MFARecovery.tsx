'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  HelpCircle,
  Key,
  Mail,
  HeadphonesIcon,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  Lock,
  FileText,
  Phone
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '@/components/GlassMorphism';
import { MFARecoveryProps } from './types';

// Recovery method card
const RecoveryMethodCard: React.FC<{
  method: 'backup_code' | 'email' | 'support';
  title: string;
  description: string;
  icon: React.ElementType;
  available: boolean;
  recommended?: boolean;
  onClick: () => void;
}> = ({ method, title, description, icon: Icon, available, recommended, onClick }) => {
  return (
    <motion.button
      whileHover={available ? { scale: 1.02 } : {}}
      whileTap={available ? { scale: 0.98 } : {}}
      onClick={onClick}
      disabled={!available}
      className={cn(
        'w-full p-4 rounded-lg transition-all duration-200',
        'border text-left group relative',
        {
          'bg-navy-dark/30 border-sage/20 hover:bg-navy-dark/40 hover:border-sage/30': available,
          'bg-navy-dark/10 border-sage/10 opacity-50 cursor-not-allowed': !available,
          'ring-2 ring-teal-primary/30': recommended
        }
      )}
    >
      {recommended && (
        <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-teal-primary rounded-full">
          <span className="text-xs font-medium text-navy-dark">Recommended</span>
        </div>
      )}
      
      <div className="flex items-start gap-4">
        <div className={cn(
          'p-3 rounded-lg transition-colors',
          available ? 'bg-navy-dark/50 group-hover:bg-navy-dark/60' : 'bg-navy-dark/20'
        )}>
          <Icon className={cn(
            'w-6 h-6',
            available ? 'text-teal-primary' : 'text-sage/30'
          )} />
        </div>
        
        <div className="flex-1 space-y-1">
          <h3 className={cn(
            'font-medium',
            available ? 'text-cream' : 'text-sage/50'
          )}>
            {title}
          </h3>
          <p className={cn(
            'text-sm',
            available ? 'text-sage/70' : 'text-sage/40'
          )}>
            {description}
          </p>
          {!available && (
            <p className="text-xs text-sage/40 mt-2">
              This option is not available
            </p>
          )}
        </div>
        
        {available && (
          <ArrowRight className="w-5 h-5 text-sage/30 group-hover:text-sage/50 group-hover:translate-x-1 transition-all" />
        )}
      </div>
    </motion.button>
  );
};

// Recovery steps display
const RecoverySteps: React.FC<{
  method: 'backup_code' | 'email' | 'support';
  onBack: () => void;
}> = ({ method, onBack }) => {
  const [currentStep, setCurrentStep] = useState(0);
  
  const steps = {
    backup_code: [
      {
        title: 'Locate Your Backup Codes',
        description: 'Find the backup codes you saved when setting up MFA',
        icon: FileText
      },
      {
        title: 'Enter a Backup Code',
        description: 'Use one of your unused backup codes to verify',
        icon: Key
      },
      {
        title: 'Regain Access',
        description: 'Once verified, you can manage your MFA settings',
        icon: CheckCircle
      }
    ],
    email: [
      {
        title: 'Verify Email Address',
        description: 'We\'ll send a verification link to your registered email',
        icon: Mail
      },
      {
        title: 'Complete Identity Verification',
        description: 'Answer security questions or provide additional information',
        icon: Lock
      },
      {
        title: 'Reset MFA Settings',
        description: 'Disable existing MFA and set up new methods',
        icon: CheckCircle
      }
    ],
    support: [
      {
        title: 'Gather Information',
        description: 'Have your account details and ID ready',
        icon: FileText
      },
      {
        title: 'Contact Support',
        description: 'Reach out via phone or live chat',
        icon: HeadphonesIcon
      },
      {
        title: 'Verify Identity',
        description: 'Complete verification with support agent',
        icon: Lock
      },
      {
        title: 'Account Recovery',
        description: 'Support will help restore your account access',
        icon: CheckCircle
      }
    ]
  };
  
  const currentSteps = steps[method];
  
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-cream">
          Recovery Steps
        </h3>
        <button
          onClick={onBack}
          className="text-sm text-sage/70 hover:text-cream transition-colors"
        >
          Choose Different Method
        </button>
      </div>
      
      <div className="space-y-3">
        {currentSteps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                'flex gap-4 p-4 rounded-lg transition-all duration-200',
                {
                  'bg-teal-primary/10 border border-teal-primary/30': isActive,
                  'bg-navy-dark/20': !isActive
                }
              )}
            >
              <div className={cn(
                'p-2 rounded-lg',
                {
                  'bg-teal-primary/20': isActive || isCompleted,
                  'bg-navy-dark/30': !isActive && !isCompleted
                }
              )}>
                <Icon className={cn(
                  'w-5 h-5',
                  {
                    'text-teal-primary': isActive || isCompleted,
                    'text-sage/30': !isActive && !isCompleted
                  }
                )} />
              </div>
              
              <div className="flex-1">
                <h4 className={cn(
                  'font-medium',
                  isActive ? 'text-cream' : 'text-cream/70'
                )}>
                  Step {index + 1}: {step.title}
                </h4>
                <p className={cn(
                  'text-sm mt-1',
                  isActive ? 'text-sage/70' : 'text-sage/50'
                )}>
                  {step.description}
                </p>
              </div>
              
              {isCompleted && (
                <CheckCircle className="w-5 h-5 text-teal-primary" />
              )}
            </motion.div>
          );
        })}
      </div>
      
      {method === 'support' && (
        <div className="space-y-4 p-4 bg-navy-dark/30 rounded-lg">
          <h4 className="font-medium text-cream">Contact Information</h4>
          <div className="space-y-3">
            <a
              href="tel:1-800-SUPPORT"
              className="flex items-center gap-3 text-sm text-sage/70 hover:text-cream transition-colors"
            >
              <Phone className="w-4 h-4" />
              <span>1-800-SUPPORT (24/7)</span>
            </a>
            <a
              href="/support/chat"
              className="flex items-center gap-3 text-sm text-sage/70 hover:text-cream transition-colors"
            >
              <HeadphonesIcon className="w-4 h-4" />
              <span>Live Chat Support</span>
            </a>
            <a
              href="mailto:support@lawlessdirectory.com"
              className="flex items-center gap-3 text-sm text-sage/70 hover:text-cream transition-colors"
            >
              <Mail className="w-4 h-4" />
              <span>support@lawlessdirectory.com</span>
            </a>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export const MFARecovery: React.FC<MFARecoveryProps> = ({
  onRecoveryMethodSelect,
  showBackupCode = true,
  showEmailRecovery = true,
  showSupportContact = true,
  className = ''
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'backup_code' | 'email' | 'support' | null>(null);
  
  const handleMethodSelect = (method: 'backup_code' | 'email' | 'support') => {
    setSelectedMethod(method);
    onRecoveryMethodSelect(method);
  };
  
  return (
    <GlassMorphism
      variant="medium"
      className={cn('p-6 sm:p-8 max-w-lg mx-auto', className)}
      animated
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-amber-500/10 rounded-full mb-2">
            <HelpCircle className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-2xl font-bold text-cream">
            Account Recovery
          </h2>
          <p className="text-sage/70 text-sm">
            Can't access your two-factor authentication? Choose a recovery method below.
          </p>
        </div>
        
        {/* Warning */}
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <div className="flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm text-amber-200">
                Recovery Process
              </p>
              <p className="text-xs text-amber-200/70">
                Account recovery may take time and requires identity verification for security.
              </p>
            </div>
          </div>
        </div>
        
        <AnimatePresence mode="wait">
          {!selectedMethod ? (
            <motion.div
              key="methods"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {/* Recovery Methods */}
              {showBackupCode && (
                <RecoveryMethodCard
                  method="backup_code"
                  title="Use Backup Code"
                  description="Enter one of your saved backup recovery codes"
                  icon={Key}
                  available={true}
                  recommended={true}
                  onClick={() => handleMethodSelect('backup_code')}
                />
              )}
              
              {showEmailRecovery && (
                <RecoveryMethodCard
                  method="email"
                  title="Email Recovery"
                  description="Verify your identity through your registered email"
                  icon={Mail}
                  available={true}
                  onClick={() => handleMethodSelect('email')}
                />
              )}
              
              {showSupportContact && (
                <RecoveryMethodCard
                  method="support"
                  title="Contact Support"
                  description="Get help from our support team to recover your account"
                  icon={HeadphonesIcon}
                  available={true}
                  onClick={() => handleMethodSelect('support')}
                />
              )}
            </motion.div>
          ) : (
            <RecoverySteps
              method={selectedMethod}
              onBack={() => setSelectedMethod(null)}
            />
          )}
        </AnimatePresence>
        
        {/* Help Link */}
        <div className="text-center pt-4 border-t border-sage/10">
          <p className="text-xs text-sage/50 mb-2">
            Need additional help?
          </p>
          <a
            href="/help/account-recovery"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-teal-primary hover:text-teal-secondary transition-colors"
          >
            View Account Recovery Guide
          </a>
        </div>
      </div>
    </GlassMorphism>
  );
};

export default MFARecovery;