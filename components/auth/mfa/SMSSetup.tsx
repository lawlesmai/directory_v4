'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, MessageSquare, Globe, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '@/components/GlassMorphism';
import { SMSCodeInput } from './CodeInput';
import { SMSSetupProps, SMSSetupData } from './types';

// Country code selector
const CountryCodeSelector: React.FC<{
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}> = ({ value, onChange, disabled, className }) => {
  const countryCodes = [
    { code: '+1', country: 'US/CA', flag: '🇺🇸' },
    { code: '+44', country: 'UK', flag: '🇬🇧' },
    { code: '+61', country: 'AU', flag: '🇦🇺' },
    { code: '+49', country: 'DE', flag: '🇩🇪' },
    { code: '+33', country: 'FR', flag: '🇫🇷' },
    { code: '+81', country: 'JP', flag: '🇯🇵' },
    { code: '+86', country: 'CN', flag: '🇨🇳' },
    { code: '+91', country: 'IN', flag: '🇮🇳' },
    { code: '+34', country: 'ES', flag: '🇪🇸' },
    { code: '+39', country: 'IT', flag: '🇮🇹' },
  ];

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        'px-3 py-3 rounded-lg bg-navy-dark/50 backdrop-blur-sm',
        'border border-sage/20 text-cream',
        'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
        'focus:border-teal-primary/50 transition-all duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      aria-label="Country code"
    >
      {countryCodes.map(({ code, country, flag }) => (
        <option key={code} value={code} className="bg-navy-dark">
          {flag} {code} ({country})
        </option>
      ))}
    </select>
  );
};

export const SMSSetup: React.FC<SMSSetupProps> = ({
  userId,
  onSetupComplete,
  onError,
  defaultCountryCode = '+1',
  className = ''
}) => {
  const [step, setStep] = useState<'input' | 'verify'>('input');
  const [countryCode, setCountryCode] = useState(defaultCountryCode);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationId, setVerificationId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [verificationError, setVerificationError] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [attempts, setAttempts] = useState(0);

  // Format phone number as user types
  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    let formatted = cleaned;
    
    // US phone number formatting
    if (countryCode === '+1' && cleaned.length > 0) {
      if (cleaned.length <= 3) {
        formatted = cleaned;
      } else if (cleaned.length <= 6) {
        formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
      } else {
        formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
      }
    }
    
    return formatted;
  };

  // Handle phone number input
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  // Validate phone number
  const isPhoneValid = () => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    // Basic validation - adjust based on country
    return cleaned.length >= 10;
  };

  // Send verification code
  const sendVerificationCode = async () => {
    if (!isPhoneValid()) {
      onError('Please enter a valid phone number');
      return;
    }

    setIsLoading(true);
    try {
      // In production, this would be an API call to send SMS
      // For demo purposes, we'll simulate it
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setVerificationId('mock-verification-id');
      setStep('verify');
      startResendCountdown();
    } catch (error) {
      onError('Failed to send verification code');
    } finally {
      setIsLoading(false);
    }
  };

  // Start resend countdown
  const startResendCountdown = () => {
    setResendCountdown(60);
  };

  // Handle countdown timer
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => {
        setResendCountdown(resendCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  // Resend verification code
  const resendCode = async () => {
    if (resendCountdown > 0) return;
    
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      startResendCountdown();
      setVerificationError(false);
      setAttempts(0);
    } catch (error) {
      onError('Failed to resend code');
    } finally {
      setIsLoading(false);
    }
  };

  // Verify SMS code
  const handleVerification = async (code: string) => {
    setIsLoading(true);
    setVerificationError(false);
    
    try {
      // In production, verify the SMS code with the backend
      // For demo, accept '123456'
      if (code === '123456') {
        await new Promise(resolve => setTimeout(resolve, 500));
        onSetupComplete('mock-sms-factor-id');
      } else {
        setVerificationError(true);
        setAttempts(prev => prev + 1);
        
        if (attempts >= 2) {
          onError('Too many failed attempts. Please request a new code.');
        }
      }
    } catch (error) {
      onError('Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <GlassMorphism
      variant="medium"
      className={cn('p-6 sm:p-8 max-w-md mx-auto', className)}
      animated
    >
      <AnimatePresence mode="wait">
        {step === 'input' ? (
          <motion.div
            key="input"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-teal-primary/10 rounded-full mb-2">
                <Phone className="w-8 h-8 text-teal-primary" />
              </div>
              <h2 className="text-2xl font-bold text-cream">
                Add Phone Number
              </h2>
              <p className="text-sage/70 text-sm">
                We'll send you a verification code via SMS
              </p>
            </div>

            {/* Phone Input */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-cream">
                  Phone Number
                </label>
                <div className="flex gap-2">
                  <CountryCodeSelector
                    value={countryCode}
                    onChange={setCountryCode}
                    disabled={isLoading}
                    className="w-32"
                  />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    placeholder={countryCode === '+1' ? '555-123-4567' : 'Enter phone number'}
                    disabled={isLoading}
                    className={cn(
                      'flex-1 px-4 py-3 rounded-lg',
                      'bg-navy-dark/50 backdrop-blur-sm',
                      'border border-sage/20 text-cream placeholder-sage/30',
                      'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                      'focus:border-teal-primary/50 transition-all duration-200',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                    aria-label="Phone number"
                  />
                </div>
              </div>

              {/* Privacy Notice */}
              <div className="flex items-start gap-2 p-3 bg-navy-dark/30 rounded-lg">
                <AlertCircle className="w-4 h-4 text-sage/50 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-sage/70">
                  Your phone number will be used for authentication purposes only. 
                  Standard SMS rates may apply.
                </p>
              </div>
            </div>

            {/* Send Code Button */}
            <button
              onClick={sendVerificationCode}
              disabled={!isPhoneValid() || isLoading}
              className={cn(
                'w-full px-6 py-3 rounded-lg font-medium transition-all duration-200',
                'bg-gradient-to-r from-teal-primary to-teal-secondary text-cream',
                'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
                'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                'focus:ring-offset-2 focus:ring-offset-navy-dark',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
              )}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </motion.span>
                  Sending...
                </span>
              ) : (
                'Send Verification Code'
              )}
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="verify"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-teal-primary/10 rounded-full mb-2">
                <MessageSquare className="w-8 h-8 text-teal-primary" />
              </div>
              <h2 className="text-2xl font-bold text-cream">
                Verify Phone Number
              </h2>
              <p className="text-sage/70 text-sm">
                We sent a code to {countryCode} {phoneNumber}
              </p>
            </div>

            {/* Code Input */}
            <div className="py-4">
              <SMSCodeInput
                onComplete={handleVerification}
                onResend={resendCode}
                error={verificationError}
                disabled={isLoading}
                canResend={resendCountdown === 0}
                resendCountdown={resendCountdown}
              />
            </div>

            {/* Error Message */}
            <AnimatePresence>
              {verificationError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                >
                  <p className="text-sm text-red-400 text-center">
                    Invalid code. Please try again.
                    {attempts > 1 && (
                      <span className="block mt-1 text-xs">
                        {3 - attempts} attempts remaining
                      </span>
                    )}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep('input');
                  setVerificationError(false);
                  setAttempts(0);
                }}
                disabled={isLoading}
                className="flex-1 px-4 py-3 rounded-lg border border-sage/20 text-sage/70 hover:text-cream hover:border-sage/40 transition-colors disabled:opacity-50"
              >
                Change Number
              </button>
            </div>

            {/* Help Text */}
            <div className="text-center space-y-2">
              <p className="text-xs text-sage/50">
                Didn't receive the code? Check your phone's SMS inbox
              </p>
              <button
                onClick={() => window.open('/help/sms-troubleshooting', '_blank')}
                className="text-xs text-teal-primary hover:text-teal-secondary transition-colors"
              >
                Troubleshooting Help
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassMorphism>
  );
};

export default SMSSetup;