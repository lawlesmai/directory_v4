'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, Lock, Shield, Check, X, AlertCircle, ArrowLeft,
  ChevronRight, RefreshCw, Key, Phone, MessageSquare,
  CheckCircle, ArrowRight, Clock
} from 'lucide-react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { GlassMorphism } from '../GlassMorphism';
import { PasswordStrengthWithTips } from './PasswordStrength';
import { 
  passwordResetSchema, 
  newPasswordSchema,
  type PasswordResetFormData,
  type NewPasswordFormData,
  checkPasswordBreach
} from './validations';
import { cn } from '@/lib/utils';

type ResetStep = 'request' | 'verify' | 'reset' | 'success';
type VerificationMethod = 'email' | 'sms' | 'security-question';

interface PasswordResetFlowProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

export const PasswordResetFlow: React.FC<PasswordResetFlowProps> = ({
  onSuccess,
  onCancel,
  className = ''
}) => {
  const [currentStep, setCurrentStep] = useState<ResetStep>('request');
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>('email');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [userEmail, setUserEmail] = useState('');
  const [breachWarning, setBreachWarning] = useState(false);

  // Request form
  const requestForm = useForm<PasswordResetFormData>({
    resolver: zodResolver(passwordResetSchema),
    mode: 'onChange'
  });

  // New password form
  const resetForm = useForm<NewPasswordFormData>({
    resolver: zodResolver(newPasswordSchema),
    mode: 'onChange'
  });

  const newPassword = resetForm.watch('password');

  // Check for password breach
  useEffect(() => {
    if (newPassword && newPassword.length >= 8) {
      const checkBreach = async () => {
        const isBreached = await checkPasswordBreach(newPassword);
        setBreachWarning(isBreached);
      };
      const debounced = setTimeout(checkBreach, 500);
      return () => clearTimeout(debounced);
    }
  }, [newPassword]);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleRequestSubmit = async (data: PasswordResetFormData) => {
    setIsSubmitting(true);
    try {
      // API call to request password reset
      await new Promise(resolve => setTimeout(resolve, 1500));
      setUserEmail(data.email);
      setCurrentStep('verify');
      setResendTimer(60);
    } catch (error) {
      console.error('Request failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerificationSubmit = async () => {
    if (verificationCode.length !== 6) return;
    
    setIsSubmitting(true);
    try {
      // API call to verify code
      await new Promise(resolve => setTimeout(resolve, 1500));
      setCurrentStep('reset');
    } catch (error) {
      console.error('Verification failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async (data: NewPasswordFormData) => {
    setIsSubmitting(true);
    try {
      // API call to reset password
      await new Promise(resolve => setTimeout(resolve, 2000));
      setCurrentStep('success');
    } catch (error) {
      console.error('Reset failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = useCallback(() => {
    if (resendTimer > 0) return;
    setResendTimer(60);
    // API call to resend verification code
  }, [resendTimer]);

  const renderStepIndicator = () => {
    const steps = [
      { key: 'request', label: 'Request' },
      { key: 'verify', label: 'Verify' },
      { key: 'reset', label: 'Reset' },
      { key: 'success', label: 'Complete' }
    ];

    const currentIndex = steps.findIndex(s => s.key === currentStep);

    return (
      <div className="flex items-center justify-center mb-8">
        {steps.map((step, index) => (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center">
              <motion.div
                initial={false}
                animate={{
                  scale: index === currentIndex ? 1.1 : 1,
                  opacity: index <= currentIndex ? 1 : 0.5
                }}
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  'transition-all duration-300',
                  index <= currentIndex
                    ? 'bg-gradient-to-br from-teal-primary to-teal-secondary'
                    : 'bg-navy-50/30 border border-sage/20'
                )}
              >
                {index < currentIndex ? (
                  <Check className="w-5 h-5 text-white" />
                ) : (
                  <span className={cn(
                    'text-sm font-medium',
                    index <= currentIndex ? 'text-white' : 'text-sage/50'
                  )}>
                    {index + 1}
                  </span>
                )}
              </motion.div>
              <span className={cn(
                'text-xs mt-2',
                index === currentIndex ? 'text-cream' : 'text-sage/50'
              )}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={cn(
                'w-12 h-0.5 mx-2 mb-6 transition-all duration-300',
                index < currentIndex
                  ? 'bg-gradient-to-r from-teal-primary to-teal-secondary'
                  : 'bg-navy-50/30'
              )} />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <GlassMorphism
      variant="medium"
      className={cn('w-full max-w-lg mx-auto p-6', className)}
      animated
      border
      shadow
    >
      {renderStepIndicator()}

      <AnimatePresence mode="wait">
        {/* Step 1: Request Reset */}
        {currentStep === 'request' && (
          <motion.div
            key="request"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <form onSubmit={requestForm.handleSubmit(handleRequestSubmit)} className="space-y-6">
              <div className="text-center mb-6">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-gradient-to-br from-teal-primary/20 to-sage/20 rounded-full">
                    <Key className="w-8 h-8 text-sage" />
                  </div>
                </div>
                <h2 className="text-2xl font-semibold text-cream mb-2">
                  Reset Your Password
                </h2>
                <p className="text-sm text-sage/70">
                  Enter your email to receive a verification code
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-cream/90">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    {...requestForm.register('email')}
                    type="email"
                    className={cn(
                      'w-full px-4 py-3 pl-12',
                      'bg-navy-50/20 backdrop-blur-md',
                      'border rounded-lg transition-all duration-200',
                      'text-cream placeholder-sage/40',
                      'focus:outline-none focus:ring-2',
                      requestForm.formState.errors.email
                        ? 'border-red-error/50 focus:ring-red-error/30'
                        : 'border-sage/20 focus:ring-teal-primary/30'
                    )}
                    placeholder="you@example.com"
                  />
                  <Mail className="absolute left-4 top-3.5 w-5 h-5 text-sage/50" />
                </div>
                {requestForm.formState.errors.email && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-red-error/90 flex items-center gap-1"
                  >
                    <AlertCircle className="w-3 h-3" />
                    {requestForm.formState.errors.email.message}
                  </motion.p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-3 text-sm font-medium text-sage 
                           bg-navy-50/20 border border-sage/20 rounded-lg
                           hover:bg-navy-50/30 transition-all duration-200"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  type="submit"
                  disabled={!requestForm.formState.isValid || isSubmitting}
                  className={cn(
                    'flex-1 px-4 py-3 text-sm font-medium rounded-lg',
                    'flex items-center justify-center gap-2',
                    'transition-all duration-200',
                    requestForm.formState.isValid
                      ? 'bg-gradient-to-r from-teal-primary to-teal-secondary text-white hover:shadow-lg'
                      : 'bg-navy-50/20 text-sage/50 cursor-not-allowed'
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Sending Code...
                    </>
                  ) : (
                    <>
                      Continue
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Step 2: Verify */}
        {currentStep === 'verify' && (
          <motion.div
            key="verify"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-gradient-to-br from-teal-primary/20 to-sage/20 rounded-full">
                  <Shield className="w-8 h-8 text-sage" />
                </div>
              </div>
              <h2 className="text-2xl font-semibold text-cream mb-2">
                Verify Your Identity
              </h2>
              <p className="text-sm text-sage/70">
                We sent a verification code to {userEmail}
              </p>
            </div>

            {/* Verification Method Selector */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {[
                { method: 'email' as VerificationMethod, icon: Mail, label: 'Email' },
                { method: 'sms' as VerificationMethod, icon: Phone, label: 'SMS' },
                { method: 'security-question' as VerificationMethod, icon: MessageSquare, label: 'Question' }
              ].map(({ method, icon: Icon, label }) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setVerificationMethod(method)}
                  className={cn(
                    'p-3 rounded-lg transition-all duration-200',
                    'flex flex-col items-center gap-1',
                    verificationMethod === method
                      ? 'bg-teal-primary/20 border border-teal-primary/30 text-teal-primary'
                      : 'bg-navy-50/20 border border-sage/10 text-sage/50 hover:bg-navy-50/30'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>

            {/* Verification Code Input */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-cream/90">
                Enter Verification Code
              </label>
              <div className="flex gap-2 justify-center">
                {[...Array(6)].map((_, index) => (
                  <input
                    key={index}
                    type="text"
                    maxLength={1}
                    value={verificationCode[index] || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^\d*$/.test(value)) {
                        const newCode = verificationCode.split('');
                        newCode[index] = value;
                        setVerificationCode(newCode.join(''));
                        
                        // Auto-focus next input
                        if (value && index < 5) {
                          const nextInput = e.target.nextSibling as HTMLInputElement;
                          nextInput?.focus();
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
                        const prevInput = e.currentTarget.previousSibling as HTMLInputElement;
                        prevInput?.focus();
                      }
                    }}
                    className={cn(
                      'w-12 h-12 text-center text-lg font-semibold',
                      'bg-navy-50/20 backdrop-blur-md',
                      'border rounded-lg transition-all duration-200',
                      'text-cream placeholder-sage/40',
                      'focus:outline-none focus:ring-2',
                      'border-sage/20 focus:ring-teal-primary/30'
                    )}
                  />
                ))}
              </div>

              {/* Resend Code */}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendTimer > 0}
                  className={cn(
                    'text-sm transition-colors',
                    resendTimer > 0
                      ? 'text-sage/40 cursor-not-allowed'
                      : 'text-teal-primary hover:text-teal-secondary'
                  )}
                >
                  {resendTimer > 0 ? (
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Resend in {resendTimer}s
                    </span>
                  ) : (
                    'Resend verification code'
                  )}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep('request')}
                className="px-4 py-3 text-sm font-medium text-sage 
                         bg-navy-50/20 border border-sage/20 rounded-lg
                         hover:bg-navy-50/30 transition-all duration-200"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleVerificationSubmit}
                disabled={verificationCode.length !== 6 || isSubmitting}
                className={cn(
                  'flex-1 px-4 py-3 text-sm font-medium rounded-lg',
                  'flex items-center justify-center gap-2',
                  'transition-all duration-200',
                  verificationCode.length === 6
                    ? 'bg-gradient-to-r from-teal-primary to-teal-secondary text-white hover:shadow-lg'
                    : 'bg-navy-50/20 text-sage/50 cursor-not-allowed'
                )}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Reset Password */}
        {currentStep === 'reset' && (
          <motion.div
            key="reset"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <form onSubmit={resetForm.handleSubmit(handlePasswordReset)} className="space-y-6">
              <div className="text-center mb-6">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-gradient-to-br from-teal-primary/20 to-sage/20 rounded-full">
                    <Lock className="w-8 h-8 text-sage" />
                  </div>
                </div>
                <h2 className="text-2xl font-semibold text-cream mb-2">
                  Create New Password
                </h2>
                <p className="text-sm text-sage/70">
                  Choose a strong password to secure your account
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-cream/90">
                  New Password
                </label>
                <div className="relative">
                  <input
                    {...resetForm.register('password')}
                    type="password"
                    className={cn(
                      'w-full px-4 py-3 pl-12',
                      'bg-navy-50/20 backdrop-blur-md',
                      'border rounded-lg transition-all duration-200',
                      'text-cream placeholder-sage/40',
                      'focus:outline-none focus:ring-2',
                      resetForm.formState.errors.password
                        ? 'border-red-error/50 focus:ring-red-error/30'
                        : 'border-sage/20 focus:ring-teal-primary/30'
                    )}
                    placeholder="Enter new password"
                  />
                  <Lock className="absolute left-4 top-3.5 w-5 h-5 text-sage/50" />
                </div>
              </div>

              {newPassword && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <PasswordStrengthWithTips
                    password={newPassword}
                    showRequirements
                    showTips
                  />
                </motion.div>
              )}

              {/* Breach Warning */}
              <AnimatePresence>
                {breachWarning && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-3 bg-red-error/10 border border-red-error/30 rounded-lg"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-error flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-red-error/90">
                        <p className="font-medium mb-1">Password may be compromised</p>
                        <p className="text-red-error/70">
                          This password appears in known data breaches.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-cream/90">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    {...resetForm.register('confirmPassword')}
                    type="password"
                    className={cn(
                      'w-full px-4 py-3 pl-12',
                      'bg-navy-50/20 backdrop-blur-md',
                      'border rounded-lg transition-all duration-200',
                      'text-cream placeholder-sage/40',
                      'focus:outline-none focus:ring-2',
                      resetForm.formState.errors.confirmPassword
                        ? 'border-red-error/50 focus:ring-red-error/30'
                        : 'border-sage/20 focus:ring-teal-primary/30'
                    )}
                    placeholder="Confirm new password"
                  />
                  <Check className="absolute left-4 top-3.5 w-5 h-5 text-sage/50" />
                </div>
                {resetForm.formState.errors.confirmPassword && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-red-error/90 flex items-center gap-1"
                  >
                    <AlertCircle className="w-3 h-3" />
                    {resetForm.formState.errors.confirmPassword.message}
                  </motion.p>
                )}
              </div>

              <button
                type="submit"
                disabled={!resetForm.formState.isValid || isSubmitting || breachWarning}
                className={cn(
                  'w-full px-4 py-3 text-sm font-medium rounded-lg',
                  'flex items-center justify-center gap-2',
                  'transition-all duration-200',
                  resetForm.formState.isValid && !breachWarning
                    ? 'bg-gradient-to-r from-teal-primary to-teal-secondary text-white hover:shadow-lg'
                    : 'bg-navy-50/20 text-sage/50 cursor-not-allowed'
                )}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Resetting Password...
                  </>
                ) : (
                  <>
                    Reset Password
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}

        {/* Step 4: Success */}
        {currentStep === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="text-center py-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="flex justify-center mb-6"
            >
              <div className="p-4 bg-gradient-to-br from-teal-primary/20 to-sage/20 rounded-full">
                <CheckCircle className="w-12 h-12 text-sage" />
              </div>
            </motion.div>

            <h2 className="text-2xl font-semibold text-cream mb-2">
              Password Reset Complete!
            </h2>
            <p className="text-sm text-sage/70 mb-8">
              Your password has been successfully reset. You can now sign in with your new password.
            </p>

            <button
              onClick={onSuccess}
              className="px-6 py-3 text-sm font-medium text-white rounded-lg
                       bg-gradient-to-r from-teal-primary to-teal-secondary
                       hover:shadow-lg transition-all duration-200"
            >
              Continue to Sign In
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassMorphism>
  );
};

export default PasswordResetFlow;