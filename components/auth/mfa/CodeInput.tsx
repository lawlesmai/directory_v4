'use client';

import React, { useRef, useState, useEffect, KeyboardEvent, ClipboardEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CodeInputProps } from './types';

export const CodeInput: React.FC<CodeInputProps> = ({
  length = 6,
  onComplete,
  onChange,
  onPaste,
  autoFocus = true,
  autoAdvance = true,
  masked = false,
  disabled = false,
  error = false,
  className = ''
}) => {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first input on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  // Handle value changes
  const handleChange = (index: number, value: string) => {
    // Only allow digits
    const sanitizedValue = value.replace(/\D/g, '');
    
    if (sanitizedValue.length <= 1) {
      const newValues = [...values];
      newValues[index] = sanitizedValue;
      setValues(newValues);

      // Call onChange callback
      const code = newValues.join('');
      onChange?.(code);

      // Auto-advance to next input
      if (sanitizedValue && autoAdvance && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      // Check if complete
      if (newValues.every(v => v !== '') && newValues.join('').length === length) {
        onComplete(newValues.join(''));
      }
    }
  };

  // Handle paste event
  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain');
    const sanitizedData = pastedData.replace(/\D/g, '').slice(0, length);
    
    if (sanitizedData) {
      const newValues = [...values];
      for (let i = 0; i < sanitizedData.length && i < length; i++) {
        newValues[i] = sanitizedData[i];
      }
      setValues(newValues);
      
      // Call onPaste callback
      onPaste?.(sanitizedData);
      
      // Focus last filled input or next empty one
      const lastFilledIndex = sanitizedData.length - 1;
      const nextIndex = Math.min(lastFilledIndex + 1, length - 1);
      inputRefs.current[nextIndex]?.focus();
      
      // Check if complete
      const code = newValues.join('');
      onChange?.(code);
      if (code.length === length) {
        onComplete(code);
      }
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Backspace':
        if (!values[index] && index > 0) {
          // Move to previous input if current is empty
          inputRefs.current[index - 1]?.focus();
        } else {
          // Clear current input
          const newValues = [...values];
          newValues[index] = '';
          setValues(newValues);
          onChange?.(newValues.join(''));
        }
        break;
      
      case 'Delete':
        const newValues = [...values];
        newValues[index] = '';
        setValues(newValues);
        onChange?.(newValues.join(''));
        break;
      
      case 'ArrowLeft':
        if (index > 0) {
          inputRefs.current[index - 1]?.focus();
        }
        break;
      
      case 'ArrowRight':
        if (index < length - 1) {
          inputRefs.current[index + 1]?.focus();
        }
        break;
      
      case 'Home':
        inputRefs.current[0]?.focus();
        break;
      
      case 'End':
        inputRefs.current[length - 1]?.focus();
        break;
    }
  };

  // Handle focus
  const handleFocus = (index: number) => {
    setFocusedIndex(index);
    // Select all text on focus for easy replacement
    inputRefs.current[index]?.select();
  };

  // Handle blur
  const handleBlur = () => {
    setFocusedIndex(null);
  };

  // Reset function
  const reset = () => {
    setValues(Array(length).fill(''));
    inputRefs.current[0]?.focus();
  };

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className="flex gap-2 sm:gap-3">
        {values.map((value, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className="relative"
          >
            <input
              ref={el => inputRefs.current[index] = el}
              type={masked ? 'password' : 'text'}
              inputMode="numeric"
              pattern="[0-9]*"
              value={masked && value ? '•' : value}
              onChange={(e: ChangeEvent<HTMLInputElement>) => 
                handleChange(index, e.target.value)
              }
              onKeyDown={(e) => handleKeyDown(index, e)}
              onFocus={() => handleFocus(index)}
              onBlur={handleBlur}
              onPaste={index === 0 ? handlePaste : undefined}
              disabled={disabled}
              maxLength={1}
              className={cn(
                'w-12 h-14 sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-mono',
                'rounded-lg transition-all duration-200',
                'bg-navy-dark/50 backdrop-blur-sm',
                'border-2 border-sage/20',
                'text-cream placeholder-sage/30',
                'focus:outline-none focus:ring-2 focus:ring-offset-2',
                'focus:ring-offset-navy-dark',
                {
                  'focus:ring-teal-primary/50 focus:border-teal-primary': !error,
                  'focus:ring-red-500/50 focus:border-red-500': error,
                  'border-red-500': error && !focusedIndex,
                  'hover:border-sage/40': !disabled && !error,
                  'opacity-50 cursor-not-allowed': disabled,
                  'bg-teal-primary/10 border-teal-primary': value && !error && !masked,
                  'animate-pulse': focusedIndex === index
                }
              )}
              aria-label={`Digit ${index + 1} of ${length}`}
              aria-invalid={error}
              aria-disabled={disabled}
            />
            
            {/* Visual indicator for filled status */}
            <AnimatePresence>
              {value && !masked && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-teal-primary rounded-full"
                />
              )}
            </AnimatePresence>
            
            {/* Focus indicator */}
            {focusedIndex === index && (
              <motion.div
                layoutId="code-input-focus"
                className="absolute inset-0 rounded-lg border-2 border-teal-primary pointer-events-none"
                transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
              />
            )}
          </motion.div>
        ))}
      </div>
      
      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute -bottom-6 left-0 right-0 text-center text-xs text-red-500"
          >
            Invalid verification code
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Specialized variant for TOTP codes
export const TOTPCodeInput: React.FC<{
  onComplete: (code: string) => void;
  error?: boolean;
  disabled?: boolean;
  className?: string;
}> = ({ onComplete, error, disabled, className }) => {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="text-center">
        <p className="text-sm text-sage/70 mb-4">
          Enter the 6-digit code from your authenticator app
        </p>
      </div>
      <CodeInput
        length={6}
        onComplete={onComplete}
        error={error}
        disabled={disabled}
        autoFocus
        autoAdvance
      />
      <div className="text-center">
        <p className="text-xs text-sage/50">
          Code changes every 30 seconds
        </p>
      </div>
    </div>
  );
};

// Specialized variant for SMS codes
export const SMSCodeInput: React.FC<{
  onComplete: (code: string) => void;
  onResend?: () => void;
  error?: boolean;
  disabled?: boolean;
  canResend?: boolean;
  resendCountdown?: number;
  className?: string;
}> = ({ 
  onComplete, 
  onResend, 
  error, 
  disabled, 
  canResend = true,
  resendCountdown = 0,
  className 
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="text-center">
        <p className="text-sm text-sage/70 mb-4">
          Enter the verification code sent to your phone
        </p>
      </div>
      <CodeInput
        length={6}
        onComplete={onComplete}
        error={error}
        disabled={disabled}
        autoFocus
        autoAdvance
      />
      <div className="text-center">
        {canResend && resendCountdown === 0 ? (
          <button
            onClick={onResend}
            className="text-sm text-teal-primary hover:text-teal-secondary transition-colors"
          >
            Didn't receive a code? Resend
          </button>
        ) : resendCountdown > 0 ? (
          <p className="text-xs text-sage/50">
            Resend code in {resendCountdown} seconds
          </p>
        ) : null}
      </div>
    </div>
  );
};

// Specialized variant for backup codes
export const BackupCodeInput: React.FC<{
  onComplete: (code: string) => void;
  error?: boolean;
  disabled?: boolean;
  className?: string;
}> = ({ onComplete, error, disabled, className }) => {
  const [code, setCode] = useState('');
  
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    setCode(value);
    
    // Check if complete (format: XXXX-XXXX-XXXX)
    if (value.replace(/-/g, '').length === 12) {
      onComplete(value);
    }
  };
  
  return (
    <div className={cn('space-y-4', className)}>
      <div className="text-center">
        <p className="text-sm text-sage/70 mb-4">
          Enter one of your backup codes
        </p>
      </div>
      <input
        type="text"
        value={code}
        onChange={handleChange}
        placeholder="XXXX-XXXX-XXXX"
        disabled={disabled}
        className={cn(
          'w-full py-3 px-4 text-center text-lg font-mono',
          'rounded-lg transition-all duration-200',
          'bg-navy-dark/50 backdrop-blur-sm',
          'border-2 border-sage/20',
          'text-cream placeholder-sage/30',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          'focus:ring-offset-navy-dark',
          {
            'focus:ring-teal-primary/50 focus:border-teal-primary': !error,
            'focus:ring-red-500/50 focus:border-red-500': error,
            'border-red-500': error,
            'opacity-50 cursor-not-allowed': disabled
          }
        )}
        aria-label="Backup code input"
        aria-invalid={error}
        aria-disabled={disabled}
      />
      <div className="text-center">
        <p className="text-xs text-sage/50">
          Each backup code can only be used once
        </p>
      </div>
    </div>
  );
};

export default CodeInput;