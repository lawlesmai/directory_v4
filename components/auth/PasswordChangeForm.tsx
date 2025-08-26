'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, Eye, EyeOff, Shield, Check, X, AlertCircle, 
  ChevronRight, RefreshCw, Key, Sparkles
} from 'lucide-react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { GlassMorphism } from '../GlassMorphism';
import { PasswordStrengthWithTips } from './PasswordStrength';
import { 
  changePasswordSchema, 
  type ChangePasswordFormData,
  generateSecurePassword,
  checkPasswordBreach
} from './validations';
import { cn } from '@/lib/utils';

interface PasswordChangeFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

export const PasswordChangeForm: React.FC<PasswordChangeFormProps> = ({
  onSuccess,
  onCancel,
  className = ''
}) => {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [breachWarning, setBreachWarning] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showGeneratedPassword, setShowGeneratedPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
    trigger
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    mode: 'onChange'
  });

  const newPassword = watch('newPassword');

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

  const handlePasswordGeneration = useCallback(() => {
    const generated = generateSecurePassword(16);
    setGeneratedPassword(generated);
    setShowGeneratedPassword(true);
    setValue('newPassword', generated);
    setValue('confirmPassword', generated);
    trigger(['newPassword', 'confirmPassword']);
  }, [setValue, trigger]);

  const copyGeneratedPassword = useCallback(() => {
    if (generatedPassword) {
      navigator.clipboard.writeText(generatedPassword);
      // Show toast notification here
    }
  }, [generatedPassword]);

  const onSubmit = async (data: ChangePasswordFormData) => {
    setIsSubmitting(true);
    try {
      // API call to change password
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulated delay
      onSuccess?.();
    } catch (error) {
      console.error('Password change failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <GlassMorphism
      variant="medium"
      className={cn('w-full max-w-md mx-auto p-6', className)}
      animated
      border
      shadow
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-gradient-to-br from-teal-primary/20 to-sage/20 rounded-full">
              <Shield className="w-8 h-8 text-sage" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-cream mb-2">
            Change Your Password
          </h2>
          <p className="text-sm text-sage/70">
            Keep your account secure with a strong password
          </p>
        </div>

        {/* Current Password Field */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-cream/90">
            Current Password
          </label>
          <div className="relative">
            <input
              {...register('currentPassword')}
              type={showCurrentPassword ? 'text' : 'password'}
              className={cn(
                'w-full px-4 py-3 pl-12 pr-12',
                'bg-navy-50/20 backdrop-blur-md',
                'border rounded-lg transition-all duration-200',
                'text-cream placeholder-sage/40',
                'focus:outline-none focus:ring-2',
                errors.currentPassword
                  ? 'border-red-error/50 focus:ring-red-error/30'
                  : 'border-sage/20 focus:ring-teal-primary/30'
              )}
              placeholder="Enter your current password"
            />
            <Lock className="absolute left-4 top-3.5 w-5 h-5 text-sage/50" />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-4 top-3.5 text-sage/50 hover:text-sage transition-colors"
            >
              {showCurrentPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
          {errors.currentPassword && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-red-error/90 flex items-center gap-1"
            >
              <AlertCircle className="w-3 h-3" />
              {errors.currentPassword.message}
            </motion.p>
          )}
        </div>

        {/* Password Generation Tool */}
        <GlassMorphism
          variant="subtle"
          className="p-4 border border-teal-primary/20"
          tint="cool"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-primary" />
              <span className="text-sm font-medium text-cream/90">
                Need a strong password?
              </span>
            </div>
            <button
              type="button"
              onClick={handlePasswordGeneration}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium 
                       text-teal-primary bg-teal-primary/10 rounded-lg
                       hover:bg-teal-primary/20 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Generate
            </button>
          </div>

          <AnimatePresence>
            {generatedPassword && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <div className="p-2 bg-navy-dark/50 rounded-lg font-mono text-xs text-sage break-all">
                  {showGeneratedPassword ? generatedPassword : '••••••••••••••••'}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowGeneratedPassword(!showGeneratedPassword)}
                    className="flex-1 px-2 py-1 text-xs bg-navy-50/20 text-sage 
                             rounded hover:bg-navy-50/30 transition-colors"
                  >
                    {showGeneratedPassword ? 'Hide' : 'Show'}
                  </button>
                  <button
                    type="button"
                    onClick={copyGeneratedPassword}
                    className="flex-1 px-2 py-1 text-xs bg-teal-primary/20 text-teal-primary 
                             rounded hover:bg-teal-primary/30 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassMorphism>

        {/* New Password Field */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-cream/90">
            New Password
          </label>
          <div className="relative">
            <input
              {...register('newPassword')}
              type={showNewPassword ? 'text' : 'password'}
              className={cn(
                'w-full px-4 py-3 pl-12 pr-12',
                'bg-navy-50/20 backdrop-blur-md',
                'border rounded-lg transition-all duration-200',
                'text-cream placeholder-sage/40',
                'focus:outline-none focus:ring-2',
                errors.newPassword
                  ? 'border-red-error/50 focus:ring-red-error/30'
                  : 'border-sage/20 focus:ring-teal-primary/30'
              )}
              placeholder="Enter your new password"
            />
            <Key className="absolute left-4 top-3.5 w-5 h-5 text-sage/50" />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-4 top-3.5 text-sage/50 hover:text-sage transition-colors"
            >
              {showNewPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
          {errors.newPassword && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-red-error/90 flex items-center gap-1"
            >
              <AlertCircle className="w-3 h-3" />
              {errors.newPassword.message}
            </motion.p>
          )}
        </div>

        {/* Password Strength Indicator */}
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
                    This password appears in known data breaches. Please choose a different password.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirm Password Field */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-cream/90">
            Confirm New Password
          </label>
          <div className="relative">
            <input
              {...register('confirmPassword')}
              type={showConfirmPassword ? 'text' : 'password'}
              className={cn(
                'w-full px-4 py-3 pl-12 pr-12',
                'bg-navy-50/20 backdrop-blur-md',
                'border rounded-lg transition-all duration-200',
                'text-cream placeholder-sage/40',
                'focus:outline-none focus:ring-2',
                errors.confirmPassword
                  ? 'border-red-error/50 focus:ring-red-error/30'
                  : 'border-sage/20 focus:ring-teal-primary/30'
              )}
              placeholder="Confirm your new password"
            />
            <Check className="absolute left-4 top-3.5 w-5 h-5 text-sage/50" />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-3.5 text-sage/50 hover:text-sage transition-colors"
            >
              {showConfirmPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-red-error/90 flex items-center gap-1"
            >
              <AlertCircle className="w-3 h-3" />
              {errors.confirmPassword.message}
            </motion.p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-3 text-sm font-medium text-sage 
                     bg-navy-50/20 border border-sage/20 rounded-lg
                     hover:bg-navy-50/30 transition-all duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isValid || isSubmitting || breachWarning}
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium rounded-lg',
              'flex items-center justify-center gap-2',
              'transition-all duration-200',
              isValid && !breachWarning
                ? 'bg-gradient-to-r from-teal-primary to-teal-secondary text-white hover:shadow-lg'
                : 'bg-navy-50/20 text-sage/50 cursor-not-allowed'
            )}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Changing Password...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                Change Password
              </>
            )}
          </button>
        </div>
      </form>
    </GlassMorphism>
  );
};

export default PasswordChangeForm;