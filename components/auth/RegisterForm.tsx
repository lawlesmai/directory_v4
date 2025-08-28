'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Eye, 
  EyeOff, 
  Check, 
  Mail,
  Lock,
  User,
  Phone,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Building,
  Briefcase,
  Home,
  Settings,
  Shield,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '../GlassMorphism';
import { ButtonWithLoading, StepProgress } from './LoadingStates';
import { FieldError, AuthError } from './ErrorMessages';
import { PasswordStrengthWithTips } from './PasswordStrength';
import { SocialLoginButton, SocialLoginDivider } from './SocialLoginButton';
import { 
  registerStep1Schema, 
  registerStep2Schema, 
  registerStep3Schema,
  type RegisterStep1Data,
  type RegisterStep2Data,
  type RegisterStep3Data,
  getFieldValidationState 
} from './validations';
import type { RegisterFormProps, RegistrationStep } from './types';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSuccess,
  onError,
  redirectTo,
  showSocialLogin = true,
  initialStep = 1,
  onStepChange,
  className = '',
  disabled = false
}) => {
  const [currentStep, setCurrentStep] = useState<RegistrationStep>(initialStep as RegistrationStep);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Form data storage for multi-step
  const [formData, setFormData] = useState<{
    step1?: RegisterStep1Data;
    step2?: RegisterStep2Data;
    step3?: RegisterStep3Data;
  }>({});

  // Step 1 form (Email & Password)
  const step1Form = useForm<RegisterStep1Data>({
    resolver: zodResolver(registerStep1Schema),
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: ''
    }
  });

  // Step 2 form (Profile Information)
  const step2Form = useForm<RegisterStep2Data>({
    resolver: zodResolver(registerStep2Schema),
    mode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      location: {
        city: '',
        state: '',
        country: 'United States'
      },
      businessType: 'customer'
    }
  });

  // Step 3 form (Verification & Agreements)
  const step3Form = useForm<RegisterStep3Data>({
    resolver: zodResolver(registerStep3Schema),
    mode: 'onChange',
    defaultValues: {
      emailVerificationCode: '',
      termsAccepted: false,
      privacyAccepted: false,
      subscribeNewsletter: false
    }
  });

  const handleStepChange = (step: RegistrationStep) => {
    setCurrentStep(step);
    onStepChange?.(step);
    setAuthError(null);
  };

  const handleStep1Submit = async (data: RegisterStep1Data) => {
    setFormData(prev => ({ ...prev, step1: data }));
    
    try {
      // Mock email existence check
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (data.email.includes('exists')) {
        step1Form.setError('email', { message: 'An account with this email already exists' });
        return;
      }
      
      handleStepChange(2);
    } catch (error) {
      setAuthError('Failed to validate email. Please try again.');
    }
  };

  const handleStep2Submit = async (data: RegisterStep2Data) => {
    setFormData(prev => ({ ...prev, step2: data }));
    
    // Send verification email
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setVerificationSent(true);
      handleStepChange(3);
    } catch (error) {
      setAuthError('Failed to send verification email. Please try again.');
    }
  };

  const handleStep3Submit = async (data: RegisterStep3Data) => {
    if (disabled) return;
    
    setIsSubmitting(true);
    setAuthError(null);
    setFormData(prev => ({ ...prev, step3: data }));

    try {
      // Combine all form data
      const completeData = {
        ...formData.step1!,
        ...formData.step2!,
        ...data
      };

      // Mock registration
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (data.emailVerificationCode !== '123456') {
        step3Form.setError('emailVerificationCode', { 
          message: 'Invalid verification code. Please try again.' 
        });
        return;
      }

      const mockUser = {
        id: 'new-user-id',
        email: completeData.email,
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        app_metadata: {},
        user_metadata: {
          full_name: `${completeData.firstName} ${completeData.lastName}`,
          business_type: completeData.businessType
        }
      } as SupabaseUser;

      onSuccess?.(mockUser);
    } catch (error: any) {
      setAuthError(error.message || 'Registration failed. Please try again.');
      onError?.({ message: error.message || 'Registration failed', code: 'registration_error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendVerificationCode = async () => {
    if (resendCooldown > 0) return;
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setResendCooldown(60);
      
      // Countdown timer
      const timer = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
    } catch (error) {
      setAuthError('Failed to resend verification code. Please try again.');
    }
  };

  const handleSocialSuccess = (user: any) => {
    onSuccess?.(user);
  };

  const handleSocialError = (error: any) => {
    setAuthError(error.message);
    onError?.(error);
  };

  const renderStep1 = () => {
    const { register, handleSubmit, formState: { errors, isValid, touchedFields }, watch } = step1Form;
    const watchedValues = watch();

    return (
      <motion.div
        key="step1"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-6"
      >
        {/* Social Login */}
        {showSocialLogin && (
          <div>
            <div className="space-y-3 mb-6">
              <SocialLoginButton
                provider="google"
                onSuccess={handleSocialSuccess}
                onError={handleSocialError}
              />
              <SocialLoginButton
                provider="apple"
                onSuccess={handleSocialSuccess}
                onError={handleSocialError}
              />
            </div>
            <SocialLoginDivider />
          </div>
        )}

        <form onSubmit={handleSubmit(handleStep1Submit)} className="space-y-4">
          {/* Email Field */}
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-cream">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sage/50" />
              <input
                {...register('email')}
                type="email"
                id="email"
                autoComplete="email"
                disabled={disabled}
                className={cn(
                  'w-full pl-10 pr-10 py-3 rounded-lg transition-all duration-200',
                  'bg-navy-dark/50 backdrop-blur-sm border text-cream placeholder-sage/50',
                  'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                  getFieldValidationState(!!errors.email, touchedFields.email, watchedValues.email) === 'error' 
                    ? 'border-red-error focus:ring-red-error/50'
                    : getFieldValidationState(!!errors.email, touchedFields.email, watchedValues.email) === 'success'
                    ? 'border-sage/50 focus:ring-sage/50'
                    : 'border-sage/20 hover:border-sage/30'
                )}
                placeholder="Enter your email"
              />
              {touchedFields.email && !errors.email && watchedValues.email && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sage" />
              )}
            </div>
            <FieldError error={errors.email?.message} />
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-cream">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sage/50" />
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                id="password"
                autoComplete="new-password"
                disabled={disabled}
                className={cn(
                  'w-full pl-10 pr-10 py-3 rounded-lg transition-all duration-200',
                  'bg-navy-dark/50 backdrop-blur-sm border text-cream placeholder-sage/50',
                  'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                  errors.password ? 'border-red-error' : 'border-sage/20 hover:border-sage/30'
                )}
                placeholder="Create a strong password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-sage/10 rounded"
              >
                {showPassword ? <EyeOff className="w-4 h-4 text-sage/70" /> : <Eye className="w-4 h-4 text-sage/70" />}
              </button>
            </div>
            <FieldError error={errors.password?.message} />
          </div>

          {/* Password Strength */}
          <PasswordStrengthWithTips password={watchedValues.password || ''} />

          {/* Confirm Password Field */}
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-cream">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sage/50" />
              <input
                {...register('confirmPassword')}
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                autoComplete="new-password"
                disabled={disabled}
                className={cn(
                  'w-full pl-10 pr-10 py-3 rounded-lg transition-all duration-200',
                  'bg-navy-dark/50 backdrop-blur-sm border text-cream placeholder-sage/50',
                  'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                  errors.confirmPassword ? 'border-red-error' : 'border-sage/20 hover:border-sage/30'
                )}
                placeholder="Confirm your password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-sage/10 rounded"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4 text-sage/70" /> : <Eye className="w-4 h-4 text-sage/70" />}
              </button>
            </div>
            <FieldError error={errors.confirmPassword?.message} />
          </div>

          <ButtonWithLoading
            type="submit"
            isLoading={false}
            disabled={!isValid}
            variant="primary"
            className="w-full"
          >
            <span className="flex items-center justify-center gap-2">
              Continue
              <ArrowRight className="w-4 h-4" />
            </span>
          </ButtonWithLoading>
        </form>
      </motion.div>
    );
  };

  const renderStep2 = () => {
    const { register, handleSubmit, formState: { errors, isValid }, watch } = step2Form;

    return (
      <motion.div
        key="step2"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-6"
      >
        <form onSubmit={handleSubmit(handleStep2Submit)} className="space-y-4">
          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="firstName" className="block text-sm font-medium text-cream">
                First Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sage/50" />
                <input
                  {...register('firstName')}
                  type="text"
                  id="firstName"
                  autoComplete="given-name"
                  className={cn(
                    'w-full pl-10 py-3 rounded-lg transition-all duration-200',
                    'bg-navy-dark/50 backdrop-blur-sm border text-cream placeholder-sage/50',
                    'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                    errors.firstName ? 'border-red-error' : 'border-sage/20 hover:border-sage/30'
                  )}
                  placeholder="First name"
                />
              </div>
              <FieldError error={errors.firstName?.message} />
            </div>

            <div className="space-y-2">
              <label htmlFor="lastName" className="block text-sm font-medium text-cream">
                Last Name
              </label>
              <input
                {...register('lastName')}
                type="text"
                id="lastName"
                autoComplete="family-name"
                className={cn(
                  'w-full py-3 px-3 rounded-lg transition-all duration-200',
                  'bg-navy-dark/50 backdrop-blur-sm border text-cream placeholder-sage/50',
                  'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                  errors.lastName ? 'border-red-error' : 'border-sage/20 hover:border-sage/30'
                )}
                placeholder="Last name"
              />
              <FieldError error={errors.lastName?.message} />
            </div>
          </div>

          {/* Phone Field */}
          <div className="space-y-2">
            <label htmlFor="phone" className="block text-sm font-medium text-cream">
              Phone Number <span className="text-sage/50">(optional)</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sage/50" />
              <input
                {...register('phone')}
                type="tel"
                id="phone"
                autoComplete="tel"
                className={cn(
                  'w-full pl-10 py-3 rounded-lg transition-all duration-200',
                  'bg-navy-dark/50 backdrop-blur-sm border text-cream placeholder-sage/50',
                  'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                  errors.phone ? 'border-red-error' : 'border-sage/20 hover:border-sage/30'
                )}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            <FieldError error={errors.phone?.message} />
          </div>

          {/* Business Type */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-cream">
              I am a...
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'customer', label: 'Customer', icon: Home },
                { value: 'business_owner', label: 'Business Owner', icon: Building },
                { value: 'service_provider', label: 'Service Provider', icon: Briefcase },
                { value: 'other', label: 'Other', icon: Settings }
              ].map(({ value, label, icon: Icon }) => (
                <label key={value} className="flex items-center gap-3 p-3 rounded-lg border border-sage/20 hover:border-sage/30 cursor-pointer transition-colors">
                  <input
                    {...register('businessType')}
                    type="radio"
                    value={value}
                    className="sr-only"
                  />
                  <Icon className="w-4 h-4 text-sage/70" />
                  <span className="text-sm text-cream">{label}</span>
                  <div className={cn(
                    'ml-auto w-3 h-3 rounded-full border transition-colors',
                    watch('businessType') === value 
                      ? 'bg-teal-primary border-teal-primary' 
                      : 'border-sage/30'
                  )} />
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => handleStepChange(1)}
              className="flex-1 px-4 py-3 text-sage hover:bg-sage/10 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <ButtonWithLoading
              type="submit"
              isLoading={false}
              disabled={!isValid}
              variant="primary"
              className="flex-1"
            >
              Continue
            </ButtonWithLoading>
          </div>
        </form>
      </motion.div>
    );
  };

  const renderStep3 = () => {
    const { register, handleSubmit, formState: { errors, isValid }, watch } = step3Form;
    
    return (
      <motion.div
        key="step3"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-6"
      >
        {verificationSent && (
          <div className="p-4 bg-teal-primary/10 border border-teal-primary/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-4 h-4 text-teal-primary" />
              <span className="text-sm font-medium text-teal-primary">Verification Email Sent</span>
            </div>
            <p className="text-xs text-teal-primary/80">
              We've sent a 6-digit code to {formData.step1?.email}. Please enter it below.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit(handleStep3Submit)} className="space-y-6">
          {/* Verification Code */}
          <div className="space-y-2">
            <label htmlFor="emailVerificationCode" className="block text-sm font-medium text-cream">
              Verification Code
            </label>
            <div className="flex gap-2 items-center">
              <input
                {...register('emailVerificationCode')}
                type="text"
                id="emailVerificationCode"
                maxLength={6}
                className={cn(
                  'flex-1 py-3 px-4 text-center text-lg font-mono rounded-lg transition-all duration-200',
                  'bg-navy-dark/50 backdrop-blur-sm border text-cream placeholder-sage/50',
                  'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                  errors.emailVerificationCode ? 'border-red-error' : 'border-sage/20 hover:border-sage/30'
                )}
                placeholder="123456"
              />
              <button
                type="button"
                onClick={resendVerificationCode}
                disabled={resendCooldown > 0}
                className="px-4 py-3 text-sm text-teal-primary hover:text-teal-secondary disabled:text-sage/50 transition-colors"
              >
                {resendCooldown > 0 ? (
                  <span className="flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    {resendCooldown}s
                  </span>
                ) : (
                  'Resend'
                )}
              </button>
            </div>
            <FieldError error={errors.emailVerificationCode?.message} />
          </div>

          {/* Agreements */}
          <div className="space-y-4">
            {/* Terms & Privacy */}
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <div className="relative mt-1">
                  <input
                    {...register('termsAccepted')}
                    type="checkbox"
                    className="sr-only"
                  />
                  <div className={cn(
                    'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                    watch('termsAccepted') 
                      ? 'bg-teal-primary border-teal-primary' 
                      : 'border-sage/30 hover:border-sage/50'
                  )}>
                    {watch('termsAccepted') && <Check className="w-3 h-3 text-cream" />}
                  </div>
                </div>
                <div className="text-sm text-sage/70">
                  I accept the{' '}
                  <button type="button" className="text-teal-primary hover:underline">
                    Terms of Service
                  </button>
                </div>
              </label>
              <FieldError error={errors.termsAccepted?.message} />

              <label className="flex items-start gap-3 cursor-pointer">
                <div className="relative mt-1">
                  <input
                    {...register('privacyAccepted')}
                    type="checkbox"
                    className="sr-only"
                  />
                  <div className={cn(
                    'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                    watch('privacyAccepted') 
                      ? 'bg-teal-primary border-teal-primary' 
                      : 'border-sage/30 hover:border-sage/50'
                  )}>
                    {watch('privacyAccepted') && <Check className="w-3 h-3 text-cream" />}
                  </div>
                </div>
                <div className="text-sm text-sage/70">
                  I accept the{' '}
                  <button type="button" className="text-teal-primary hover:underline">
                    Privacy Policy
                  </button>
                </div>
              </label>
              <FieldError error={errors.privacyAccepted?.message} />
            </div>

            {/* Marketing Consent */}
            <label className="flex items-start gap-3 cursor-pointer">
              <div className="relative mt-1">
                <input
                  {...register('subscribeNewsletter')}
                  type="checkbox"
                  className="sr-only"
                />
                <div className={cn(
                  'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                  watch('subscribeNewsletter') 
                    ? 'bg-teal-primary border-teal-primary' 
                    : 'border-sage/30 hover:border-sage/50'
                )}>
                  {watch('subscribeNewsletter') && <Check className="w-3 h-3 text-cream" />}
                </div>
              </div>
              <div className="text-sm text-sage/70">
                I'd like to receive marketing emails about new features and updates{' '}
                <span className="text-sage/50">(optional)</span>
              </div>
            </label>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => handleStepChange(2)}
              className="flex-1 px-4 py-3 text-sage hover:bg-sage/10 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <ButtonWithLoading
              type="submit"
              isLoading={isSubmitting}
              loadingText="Creating Account..."
              disabled={!isValid}
              variant="primary"
              className="flex-1"
            >
              Create Account
            </ButtonWithLoading>
          </div>
        </form>
      </motion.div>
    );
  };

  const stepTitles = {
    1: 'Create Your Account',
    2: 'Tell Us About Yourself', 
    3: 'Verify Your Email'
  };

  const stepDescriptions = {
    1: 'Choose your email and password',
    2: 'Help us personalize your experience',
    3: 'Confirm your email address to get started'
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
          key={currentStep}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold text-cream mb-2"
        >
          {stepTitles[currentStep]}
        </motion.h2>
        <motion.p 
          key={`desc-${currentStep}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sage/70 mb-6"
        >
          {stepDescriptions[currentStep]}
        </motion.p>
        
        <StepProgress 
          currentStep={currentStep} 
          totalSteps={3} 
        />
      </div>

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

      {/* Form Steps */}
      <AnimatePresence mode="wait">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </AnimatePresence>

      {/* Login Link */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center mt-8"
      >
        <p className="text-sage/70">
          Already have an account?{' '}
          <button
            type="button"
            className="text-teal-primary hover:text-teal-secondary transition-colors font-medium"
            onClick={() => {
              // Handle navigation to login
              console.log('Navigate to login');
            }}
          >
            Sign in
          </button>
        </p>
      </motion.div>
    </GlassMorphism>
  );
};

export default RegisterForm;