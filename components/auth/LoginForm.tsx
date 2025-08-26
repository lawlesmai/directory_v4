'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Eye, 
  EyeOff, 
  Check, 
  AlertCircle, 
  Mail,
  Lock,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { GlassMorphism } from '../GlassMorphism';
import { LoadingSpinner, ButtonWithLoading } from './LoadingStates';
import { FieldError, AuthError } from './ErrorMessages';
import { SocialLoginButton, SocialLoginDivider } from './SocialLoginButton';
import { loginSchema, type LoginFormData, getFieldValidationState } from './validations';
import type { LoginFormProps, AuthProvider } from './types';

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onError,
  redirectTo,
  showSocialLogin = true,
  showRememberMe = true,
  showForgotPassword = true,
  showSignUpLink = true,
  className = '',
  disabled = false
}) => {
  const { signIn, signInWithProvider, state } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const isSubmitting = state === 'loading';

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, touchedFields },
    setError,
    clearErrors,
    watch
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false
    }
  });

  const watchedValues = watch();

  const onSubmit = async (data: LoginFormData) => {
    if (disabled || isSubmitting) return;
    
    setAuthError(null);
    clearErrors();

    try {
      const { user, error } = await signIn(data.email, data.password, {
        rememberMe: data.rememberMe,
        redirectTo
      });
      
      if (error) {
        setAuthError(error.message);
        onError?.(error);
      } else if (user) {
        onSuccess?.(user);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Something went wrong. Please try again.';
      setAuthError(errorMessage);
      onError?.({ message: errorMessage, code: 'auth_error' });
    }
  };

  const handleSocialAuth = async (provider: AuthProvider) => {
    setAuthError(null);
    
    try {
      const { user, error } = await signInWithProvider(provider, { redirectTo });
      
      if (error) {
        setAuthError(error.message);
        onError?.(error);
      } else if (user) {
        onSuccess?.(user);
      }
      // Note: OAuth redirects, so we might not get a user immediately
    } catch (error: any) {
      const errorMessage = error.message || 'Social authentication failed. Please try again.';
      setAuthError(errorMessage);
      onError?.({ message: errorMessage, code: 'social_auth_error' });
    }
  };

  return (
    <GlassMorphism 
      variant="medium" 
      className={cn('p-8 w-full max-w-md mx-auto', className)}
      animated
      interactive
    >
      {/* Header */}
      <div className="text-center mb-8">
        <motion.h2 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold text-cream mb-2"
        >
          Welcome Back
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-sage/70"
        >
          Sign in to access your business directory
        </motion.p>
      </div>

      {/* Social Login Section */}
      {showSocialLogin && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="space-y-3 mb-6">
            <SocialLoginButton
              provider="google"
              onSuccess={() => handleSocialAuth('google')}
              disabled={isSubmitting}
            />
            <SocialLoginButton
              provider="apple"
              onSuccess={() => handleSocialAuth('apple')}
              disabled={isSubmitting}
            />
          </div>
          <SocialLoginDivider />
        </motion.div>
      )}

      {/* Error Display */}
      <AnimatePresence>
        {authError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6"
          >
            <AuthError 
              error={authError} 
              onDismiss={() => setAuthError(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Login Form */}
      <motion.form
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: showSocialLogin ? 0.4 : 0.2 }}
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6"
      >
        {/* Email Field */}
        <div className="space-y-2">
          <label 
            htmlFor="email" 
            className="block text-sm font-medium text-cream"
          >
            Email Address
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sage/50">
              <Mail className="w-4 h-4" />
            </div>
            <input
              {...register('email')}
              type="email"
              id="email"
              autoComplete="email"
              disabled={disabled || isSubmitting}
              className={cn(
                'w-full pl-10 pr-10 py-3 rounded-lg transition-all duration-200',
                'bg-navy-dark/50 backdrop-blur-sm border text-cream placeholder-sage/50',
                'focus:outline-none focus:ring-2 focus:ring-teal-primary/50 focus:border-teal-primary/50',
                getFieldValidationState(!!errors.email, touchedFields.email, watchedValues.email) === 'error' && 
                  'border-red-error focus:ring-red-error/50 focus:border-red-error',
                getFieldValidationState(!!errors.email, touchedFields.email, watchedValues.email) === 'success' && 
                  'border-sage/50 focus:ring-sage/50 focus:border-sage',
                getFieldValidationState(!!errors.email, touchedFields.email, watchedValues.email) === 'default' &&
                  'border-sage/20 hover:border-sage/30'
              )}
              placeholder="Enter your email"
              aria-invalid={errors.email ? 'true' : 'false'}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            
            {/* Success checkmark */}
            <AnimatePresence>
              {touchedFields.email && !errors.email && watchedValues.email && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <Check className="w-4 h-4 text-sage" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <FieldError error={errors.email?.message} />
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <label 
            htmlFor="password" 
            className="block text-sm font-medium text-cream"
          >
            Password
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sage/50">
              <Lock className="w-4 h-4" />
            </div>
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="current-password"
              disabled={disabled || isSubmitting}
              className={cn(
                'w-full pl-10 pr-10 py-3 rounded-lg transition-all duration-200',
                'bg-navy-dark/50 backdrop-blur-sm border text-cream placeholder-sage/50',
                'focus:outline-none focus:ring-2 focus:ring-teal-primary/50 focus:border-teal-primary/50',
                errors.password
                  ? 'border-red-error focus:ring-red-error/50 focus:border-red-error'
                  : 'border-sage/20 hover:border-sage/30'
              )}
              placeholder="Enter your password"
              aria-invalid={errors.password ? 'true' : 'false'}
              aria-describedby={errors.password ? 'password-error' : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={disabled || isSubmitting}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-sage/10 rounded transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4 text-sage/70" />
              ) : (
                <Eye className="w-4 h-4 text-sage/70" />
              )}
            </button>
          </div>
          <FieldError error={errors.password?.message} />
        </div>

        {/* Remember Me & Forgot Password */}
        <div className="flex items-center justify-between">
          {showRememberMe && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div className="relative">
                <input
                  {...register('rememberMe')}
                  type="checkbox"
                  disabled={disabled || isSubmitting}
                  className="sr-only"
                />
                <div
                  className={cn(
                    'w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-200',
                    watchedValues.rememberMe
                      ? 'bg-teal-primary border-teal-primary'
                      : 'border-sage/30 hover:border-sage/50'
                  )}
                >
                  <AnimatePresence>
                    {watchedValues.rememberMe && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                      >
                        <Check className="w-3 h-3 text-cream" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <span className="text-sm text-sage/70">Remember me</span>
            </label>
          )}
          
          {showForgotPassword && (
            <button
              type="button"
              className="text-sm text-teal-primary hover:text-teal-secondary transition-colors"
              onClick={() => {
                // Handle forgot password navigation
                console.log('Navigate to forgot password');
              }}
            >
              Forgot password?
            </button>
          )}
        </div>

        {/* Submit Button */}
        <ButtonWithLoading
          type="submit"
          isLoading={isSubmitting}
          loadingText="Signing in..."
          disabled={disabled || !isValid}
          variant="primary"
          className="w-full"
        >
          <span className="flex items-center justify-center gap-2">
            Sign In
            <ArrowRight className="w-4 h-4" />
          </span>
        </ButtonWithLoading>
      </motion.form>

      {/* Sign Up Link */}
      {showSignUpLink && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center mt-8"
        >
          <p className="text-sage/70">
            Don't have an account?{' '}
            <button
              type="button"
              className="text-teal-primary hover:text-teal-secondary transition-colors font-medium"
              onClick={() => {
                // Handle navigation to sign up
                console.log('Navigate to sign up');
              }}
            >
              Sign up now
            </button>
          </p>
        </motion.div>
      )}
    </GlassMorphism>
  );
};

export default LoginForm;