'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  Check, 
  AlertCircle, 
  RefreshCw,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  FolderOpen,
  UserPlus,
  Clock,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOnboarding } from './OnboardingWizard';

export const EmailVerificationStep: React.FC = () => {
  const { data, updateData, nextStep } = useOnboarding();
  const [code, setCode] = useState<string[]>(Array(6).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [resendCount, setResendCount] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Start resend cooldown on mount
  useEffect(() => {
    setResendCooldown(30);
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleCodeChange = useCallback((index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError(null);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (newCode.every(digit => digit) && newCode.length === 6) {
      handleVerification(newCode.join(''));
    }
  }, [code]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [code]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const digits = pastedData.replace(/\D/g, '').slice(0, 6);
    
    if (digits) {
      const newCode = digits.split('').concat(Array(6 - digits.length).fill(''));
      setCode(newCode);
      
      // Focus last input or next empty one
      const nextEmptyIndex = newCode.findIndex(d => !d);
      const focusIndex = nextEmptyIndex === -1 ? 5 : nextEmptyIndex;
      inputRefs.current[focusIndex]?.focus();
      
      // Auto-submit if complete
      if (digits.length === 6) {
        handleVerification(digits);
      }
    }
  }, []);

  const handleVerification = async (verificationCode: string) => {
    setIsVerifying(true);
    setError(null);

    try {
      // Simulate verification API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Mock verification logic
      if (verificationCode === '123456') {
        updateData({ 
          emailVerified: true, 
          verificationCode 
        });
        
        // Success animation before proceeding
        setTimeout(() => {
          nextStep();
        }, 1000);
      } else {
        setError('Invalid verification code. Please try again.');
        // Clear code on error
        setCode(Array(6).fill(''));
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    try {
      // Simulate resend API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setResendCount(prev => prev + 1);
      
      // Progressive cooldown
      const cooldownTime = Math.min(60 * Math.pow(2, resendCount), 300);
      setResendCooldown(cooldownTime);
      
      // Show success message
      setError(null);
    } catch (err) {
      setError('Failed to resend code. Please try again.');
    }
  };

  const handleChangeEmail = () => {
    // Would navigate back to email input step
    console.log('Change email requested');
  };

  const troubleshootingItems = [
    {
      icon: <FolderOpen className="w-4 h-4" />,
      title: 'Check your spam folder',
      description: 'Sometimes our emails end up in spam. Mark it as "Not Spam" to receive future emails.',
    },
    {
      icon: <UserPlus className="w-4 h-4" />,
      title: 'Add us to your contacts',
      description: 'Add noreply@platform.com to your email contacts to ensure delivery.',
    },
    {
      icon: <Clock className="w-4 h-4" />,
      title: 'Wait a few minutes',
      description: 'Email delivery can sometimes take up to 5 minutes during peak times.',
    },
    {
      icon: <Shield className="w-4 h-4" />,
      title: 'Check email filters',
      description: 'Ensure your email provider isn\'t blocking our domain.',
    }
  ];

  return (
    <div className="space-y-6">
      {/* Email Display */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto bg-teal-primary/10 rounded-full flex items-center justify-center mb-4">
          <Mail className="w-8 h-8 text-teal-primary" />
        </div>
        
        <h3 className="text-lg font-semibold text-cream">
          Check Your Email
        </h3>
        
        <p className="text-sage/70">
          We sent a verification code to:
        </p>
        
        <p className="text-cream font-medium">
          {data.email || 'user@example.com'}
        </p>
        
        <button
          onClick={handleChangeEmail}
          className="text-sm text-teal-primary hover:text-teal-secondary transition-colors"
        >
          Change email address
        </button>
      </div>

      {/* Code Input */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-cream text-center">
          Enter your 6-digit code
        </label>
        
        <div className="flex items-center justify-center gap-2">
          {code.map((digit, index) => (
            <input
              key={index}
              ref={el => inputRefs.current[index] = el}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleCodeChange(index, e.target.value)}
              onKeyDown={e => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              disabled={isVerifying}
              className={cn(
                'w-12 h-14 text-center text-xl font-mono rounded-lg transition-all duration-200',
                'bg-navy-dark/50 backdrop-blur-sm border text-cream',
                'focus:outline-none focus:ring-2 focus:ring-teal-primary/50 focus:border-teal-primary',
                error ? 'border-red-error animate-shake' : 'border-sage/30 hover:border-sage/50',
                isVerifying && 'opacity-50 cursor-not-allowed'
              )}
              aria-label={`Digit ${index + 1}`}
            />
          ))}
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center justify-center gap-2 text-red-error text-sm"
            >
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success State */}
        <AnimatePresence>
          {data.emailVerified && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-center gap-2 text-sage text-sm"
            >
              <div className="w-5 h-5 bg-sage/20 rounded-full flex items-center justify-center">
                <Check className="w-3 h-3" />
              </div>
              <span>Email verified successfully!</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Resend Section */}
      <div className="flex items-center justify-center gap-4">
        <span className="text-sm text-sage/70">
          Didn't receive it?
        </span>
        
        <button
          onClick={handleResendCode}
          disabled={resendCooldown > 0}
          className={cn(
            'flex items-center gap-2 text-sm font-medium transition-colors',
            resendCooldown > 0
              ? 'text-sage/50 cursor-not-allowed'
              : 'text-teal-primary hover:text-teal-secondary'
          )}
        >
          <RefreshCw className={cn(
            'w-4 h-4',
            resendCooldown > 0 && 'animate-pulse'
          )} />
          {resendCooldown > 0 ? (
            `Resend in ${resendCooldown}s`
          ) : (
            'Resend code'
          )}
        </button>
      </div>

      {/* Troubleshooting */}
      <div className="border border-sage/20 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowTroubleshooting(!showTroubleshooting)}
          className="w-full px-4 py-3 flex items-center justify-between text-sm hover:bg-sage/5 transition-colors"
        >
          <span className="flex items-center gap-2 text-sage/70">
            <MessageSquare className="w-4 h-4" />
            Having trouble receiving the email?
          </span>
          {showTroubleshooting ? (
            <ChevronUp className="w-4 h-4 text-sage/50" />
          ) : (
            <ChevronDown className="w-4 h-4 text-sage/50" />
          )}
        </button>
        
        <AnimatePresence>
          {showTroubleshooting && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 space-y-3 bg-sage/5 border-t border-sage/20">
                {troubleshootingItems.map((item, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-sage/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-cream mb-1">
                        {item.title}
                      </h4>
                      <p className="text-xs text-sage/60">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
                
                <div className="pt-3 border-t border-sage/20">
                  <button className="text-sm text-teal-primary hover:text-teal-secondary transition-colors">
                    Contact support for help →
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pro Tip */}
      <div className="flex items-start gap-2 p-3 bg-teal-primary/5 border border-teal-primary/20 rounded-lg">
        <Clock className="w-4 h-4 text-teal-primary mt-0.5" />
        <div className="text-xs text-teal-primary/80">
          <strong className="text-teal-primary">Pro tip:</strong> Verification codes expire after 10 minutes for security. Request a new one if yours has expired.
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationStep;