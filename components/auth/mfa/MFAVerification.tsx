'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Smartphone, 
  MessageSquare, 
  Key,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronRight,
  Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '@/components/GlassMorphism';
import { TOTPCodeInput, SMSCodeInput, BackupCodeInput } from './CodeInput';
import { MFAVerificationProps, MFAChallenge, MFAMethod, MFAFactor } from './types';

// Method selector for choosing verification method
const MethodSelector: React.FC<{
  factors: MFAFactor[];
  selectedMethod: MFAMethod | null;
  onSelect: (method: MFAMethod) => void;
  disabled?: boolean;
}> = ({ factors, selectedMethod, onSelect, disabled }) => {
  const methodInfo = {
    totp: {
      icon: Smartphone,
      label: 'Authenticator App',
      description: 'Use your authenticator app'
    },
    sms: {
      icon: MessageSquare,
      label: 'Text Message',
      description: 'Get a code via SMS'
    },
    backup_codes: {
      icon: Key,
      label: 'Backup Code',
      description: 'Use a recovery code'
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-cream mb-2">
        Choose Verification Method
      </h3>
      {factors.map((factor) => {
        const info = methodInfo[factor.type];
        const Icon = info.icon;
        const isSelected = selectedMethod === factor.type;
        
        return (
          <button
            key={factor.id}
            onClick={() => onSelect(factor.type)}
            disabled={disabled || factor.status !== 'enabled'}
            className={cn(
              'w-full p-4 rounded-lg transition-all duration-200',
              'flex items-center justify-between group',
              'border',
              {
                'bg-teal-primary/10 border-teal-primary/50': isSelected,
                'bg-navy-dark/30 border-sage/20 hover:bg-navy-dark/40 hover:border-sage/30': !isSelected,
                'opacity-50 cursor-not-allowed': disabled || factor.status !== 'enabled'
              }
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                'p-2 rounded-lg transition-colors',
                isSelected ? 'bg-teal-primary/20' : 'bg-navy-dark/50'
              )}>
                <Icon className={cn(
                  'w-5 h-5',
                  isSelected ? 'text-teal-primary' : 'text-sage/50'
                )} />
              </div>
              <div className="text-left">
                <p className={cn(
                  'font-medium text-sm',
                  isSelected ? 'text-cream' : 'text-cream/80'
                )}>
                  {info.label}
                </p>
                <p className="text-xs text-sage/60">
                  {info.description}
                  {factor.friendlyName && ` • ${factor.friendlyName}`}
                </p>
              </div>
            </div>
            <ChevronRight className={cn(
              'w-4 h-4 transition-transform',
              isSelected ? 'text-teal-primary translate-x-1' : 'text-sage/30',
              'group-hover:translate-x-1'
            )} />
          </button>
        );
      })}
    </div>
  );
};

// Trust device checkbox
const TrustDeviceOption: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}> = ({ checked, onChange, disabled }) => {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
        />
        <div className={cn(
          'w-5 h-5 rounded border-2 transition-all duration-200',
          checked 
            ? 'bg-teal-primary border-teal-primary' 
            : 'bg-navy-dark/30 border-sage/30 group-hover:border-sage/50'
        )}>
          <AnimatePresence>
            {checked && (
              <motion.svg
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="w-full h-full"
                viewBox="0 0 20 20"
                fill="none"
              >
                <path
                  d="M7 10l2 2 4-4"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </motion.svg>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="flex-1">
        <p className="text-sm text-cream">
          Trust this device for 30 days
        </p>
        <p className="text-xs text-sage/60 mt-0.5">
          You won't need to verify again on this device
        </p>
      </div>
    </label>
  );
};

export const MFAVerification: React.FC<MFAVerificationProps> = ({
  challenge,
  onSuccess,
  onError,
  onCancel,
  showTrustDevice = true,
  className = ''
}) => {
  const [selectedMethod, setSelectedMethod] = useState<MFAMethod | null>(null);
  const [trustDevice, setTrustDevice] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(300); // 5 minutes

  // Auto-select first available method
  useEffect(() => {
    if (!selectedMethod && challenge.factors.length > 0) {
      const firstEnabled = challenge.factors.find(f => f.status === 'enabled');
      if (firstEnabled) {
        setSelectedMethod(firstEnabled.type);
      }
    }
  }, [challenge.factors, selectedMethod]);

  // Countdown timer for challenge expiry
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 0) {
          onError('Verification session expired. Please try again.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onError]);

  // Format time remaining
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle verification
  const handleVerification = async (code: string) => {
    setIsVerifying(true);
    setVerificationError(null);

    try {
      // In production, verify with backend
      // For demo, accept specific codes
      const isValid = code === '123456' || code === 'TEST-TEST-TEST';
      
      if (isValid) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const response = {
          success: true,
          factorId: challenge.factors.find(f => f.type === selectedMethod)?.id,
          deviceTrustToken: trustDevice ? 'mock-trust-token' : undefined
        };
        
        onSuccess(response);
      } else {
        setVerificationError('Invalid code. Please try again.');
      }
    } catch (error) {
      setVerificationError('Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Send SMS code
  const sendSMSCode = async () => {
    setResendCountdown(60);
    // In production, trigger SMS send
    console.log('Sending SMS code...');
  };

  // Handle resend countdown
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => {
        setResendCountdown(resendCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  return (
    <GlassMorphism
      variant="medium"
      className={cn('p-6 sm:p-8 max-w-md mx-auto', className)}
      animated
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-teal-primary/10 rounded-full mb-2">
            <Shield className="w-8 h-8 text-teal-primary" />
          </div>
          <h2 className="text-2xl font-bold text-cream">
            Two-Factor Authentication
          </h2>
          <p className="text-sage/70 text-sm">
            Verify your identity to continue
          </p>
        </div>

        {/* Session Timer */}
        <div className="flex items-center justify-center gap-2 text-xs text-sage/60">
          <Clock className="w-3.5 h-3.5" />
          <span>Session expires in {formatTime(timeRemaining)}</span>
        </div>

        {/* Security Info */}
        {challenge.isLocked && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
          >
            <div className="flex gap-2">
              <Lock className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-400">
                  Account temporarily locked
                </p>
                <p className="text-xs text-red-400/70 mt-1">
                  Too many failed attempts. Please try again later.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Method Selection or Verification */}
        {challenge.factors.length > 1 && !selectedMethod ? (
          <MethodSelector
            factors={challenge.factors}
            selectedMethod={selectedMethod}
            onSelect={setSelectedMethod}
            disabled={isVerifying || challenge.isLocked}
          />
        ) : (
          <AnimatePresence mode="wait">
            {selectedMethod === 'totp' && (
              <motion.div
                key="totp"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <TOTPCodeInput
                  onComplete={handleVerification}
                  error={!!verificationError}
                  disabled={isVerifying || challenge.isLocked}
                />
              </motion.div>
            )}

            {selectedMethod === 'sms' && (
              <motion.div
                key="sms"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <SMSCodeInput
                  onComplete={handleVerification}
                  onResend={sendSMSCode}
                  error={!!verificationError}
                  disabled={isVerifying || challenge.isLocked}
                  canResend={resendCountdown === 0}
                  resendCountdown={resendCountdown}
                />
              </motion.div>
            )}

            {selectedMethod === 'backup_codes' && (
              <motion.div
                key="backup"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <BackupCodeInput
                  onComplete={handleVerification}
                  error={!!verificationError}
                  disabled={isVerifying || challenge.isLocked}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Error Message */}
        <AnimatePresence>
          {verificationError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
            >
              <div className="flex gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-red-400">
                    {verificationError}
                  </p>
                  {challenge.attempts > 0 && (
                    <p className="text-xs text-red-400/70 mt-1">
                      {challenge.maxAttempts - challenge.attempts} attempts remaining
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Trust Device Option */}
        {showTrustDevice && !challenge.isLocked && (
          <div className="pt-2">
            <TrustDeviceOption
              checked={trustDevice}
              onChange={setTrustDevice}
              disabled={isVerifying}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {challenge.factors.length > 1 && selectedMethod && (
            <button
              onClick={() => setSelectedMethod(null)}
              disabled={isVerifying}
              className="px-4 py-3 rounded-lg border border-sage/20 text-sage/70 hover:text-cream hover:border-sage/40 transition-colors disabled:opacity-50"
            >
              Try Another Method
            </button>
          )}
          
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={isVerifying}
              className="flex-1 px-4 py-3 rounded-lg border border-sage/20 text-sage/70 hover:text-cream hover:border-sage/40 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Help Link */}
        <div className="text-center">
          <button
            onClick={() => window.open('/help/mfa-troubleshooting', '_blank')}
            className="text-xs text-teal-primary hover:text-teal-secondary transition-colors"
          >
            Having trouble? Get help
          </button>
        </div>
      </div>
    </GlassMorphism>
  );
};

export default MFAVerification;