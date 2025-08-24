# Story 2.4: User Registration & Onboarding Flow

**Epic:** Epic 2 - Authentication & Authorization Layer  
**Story ID:** 2.4  
**Story Points:** 21  
**Priority:** P0 (Critical Security Foundation)  
**Assignee:** Frontend Developer Agent  
**Sprint:** 2

## User Story

As a new user, I want a smooth and welcoming registration and onboarding process that helps me understand the platform's value while collecting necessary information efficiently, so that I can quickly start using the business directory with confidence.

## Story Overview

This story implements a comprehensive user registration and onboarding system that guides new users through account creation, profile setup, email verification, and platform orientation. It emphasizes user experience optimization, progressive information collection, and engagement-focused onboarding.

## Detailed Acceptance Criteria

### Registration Process Design
- **Given** a new user visiting the platform
- **When** they decide to register
- **Then** guide them through an optimized multi-step flow:

**Step 1: Account Creation**
- Email address with real-time validation and domain checking
- Password creation with strength requirements and visual feedback
- Password confirmation with match validation
- Captcha verification for spam prevention
- Clear privacy policy and terms acceptance with expandable content
- Marketing email consent (optional, GDPR compliant)

**Step 2: Profile Setup**
- Display name with availability checking against existing users
- Profile photo upload with image cropping and optimization
- Location selection with autocomplete and geolocation option
- Bio/description (optional, 150 character limit with counter)
- Interests/preferences selection from business categories
- Notification preferences setup with clear explanations

**Step 3: Email Verification**
- Immediate verification email sending with branded template
- Clear instructions for email verification process
- Resend verification option (rate limited to prevent abuse)
- Alternative contact method if email fails
- Progress indication for verification status
- Skip option with limited access until verified

### Registration Form Implementation

```typescript
// components/auth/RegistrationWizard.tsx
interface RegistrationData {
  // Step 1: Account
  email: string
  password: string
  confirmPassword: string
  acceptTerms: boolean
  marketingConsent: boolean
  
  // Step 2: Profile
  firstName: string
  lastName: string
  displayName: string
  avatar?: File
  location: string
  bio?: string
  interests: string[]
  
  // Step 3: Verification
  emailVerified: boolean
}

const registrationSteps = [
  {
    id: 'account',
    title: 'Create Account',
    description: 'Set up your login credentials',
    icon: <UserPlus className="w-5 h-5" />
  },
  {
    id: 'profile',
    title: 'Build Profile',
    description: 'Tell us about yourself',
    icon: <User className="w-5 h-5" />
  },
  {
    id: 'verification',
    title: 'Verify Email',
    description: 'Confirm your email address',
    icon: <Mail className="w-5 h-5" />
  }
]

export const RegistrationWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [registrationData, setRegistrationData] = useState<Partial<RegistrationData>>({})
  
  const { signUp } = useAuth()
  const router = useRouter()

  const updateRegistrationData = (data: Partial<RegistrationData>) => {
    setRegistrationData(prev => ({ ...prev, ...data }))
  }

  const nextStep = () => {
    if (currentStep < registrationSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const submitRegistration = async (stepData: Partial<RegistrationData>) => {
    setIsSubmitting(true)
    
    try {
      const finalData = { ...registrationData, ...stepData }
      
      // Create account with Supabase
      const { user, error } = await signUp(
        finalData.email!,
        finalData.password!,
        {
          data: {
            first_name: finalData.firstName,
            last_name: finalData.lastName,
            display_name: finalData.displayName,
            location: finalData.location,
            bio: finalData.bio,
            interests: finalData.interests,
            marketing_consent: finalData.marketingConsent
          }
        }
      )
      
      if (error) {
        throw error
      }
      
      if (user) {
        // Move to verification step
        nextStep()
        toast.success('Account created! Please check your email to verify.')
      }
    } catch (error) {
      console.error('Registration error:', error)
      toast.error('Failed to create account. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-dark via-teal-primary to-navy-dark flex items-center justify-center p-4">
      <GlassMorphism variant="large" className="p-8 w-full max-w-2xl">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-heading font-semibold text-cream">
              Join The Lawless Directory
            </h1>
            <div className="text-sm text-sage/70">
              Step {currentStep + 1} of {registrationSteps.length}
            </div>
          </div>
          
          {/* Progress Steps */}
          <div className="flex items-center justify-between mb-2">
            {registrationSteps.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg transition-all',
                  index === currentStep
                    ? 'bg-teal-primary/20 border border-teal-primary/30'
                    : index < currentStep
                    ? 'bg-sage/20 border border-sage/30'
                    : 'bg-navy-50/10 border border-sage/10'
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                    index === currentStep
                      ? 'bg-teal-primary text-cream'
                      : index < currentStep
                      ? 'bg-sage text-navy-dark'
                      : 'bg-sage/20 text-sage/50'
                  )}
                >
                  {index < currentStep ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    step.icon
                  )}
                </div>
                <div className="hidden md:block">
                  <div className={cn(
                    'font-medium text-sm',
                    index === currentStep
                      ? 'text-cream'
                      : index < currentStep
                      ? 'text-sage'
                      : 'text-sage/50'
                  )}>
                    {step.title}
                  </div>
                  <div className={cn(
                    'text-xs mt-1',
                    index === currentStep
                      ? 'text-teal-secondary'
                      : 'text-sage/60'
                  )}>
                    {step.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-navy-50/20 rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-teal-primary to-teal-secondary"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / registrationSteps.length) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="min-h-[400px]"
          >
            {currentStep === 0 && (
              <AccountCreationStep
                data={registrationData}
                onUpdate={updateRegistrationData}
                onNext={nextStep}
                isSubmitting={isSubmitting}
              />
            )}
            
            {currentStep === 1 && (
              <ProfileSetupStep
                data={registrationData}
                onUpdate={updateRegistrationData}
                onNext={() => submitRegistration(registrationData)}
                onPrevious={prevStep}
                isSubmitting={isSubmitting}
              />
            )}
            
            {currentStep === 2 && (
              <EmailVerificationStep
                email={registrationData.email}
                onComplete={() => router.push('/onboarding')}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </GlassMorphism>
    </div>
  )
}
```

### Account Creation Step

```typescript
// components/auth/AccountCreationStep.tsx
interface AccountCreationStepProps {
  data: Partial<RegistrationData>
  onUpdate: (data: Partial<RegistrationData>) => void
  onNext: () => void
  isSubmitting: boolean
}

const accountSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/(?=.*[a-z])/, 'Password must contain a lowercase letter')
    .regex(/(?=.*[A-Z])/, 'Password must contain an uppercase letter')
    .regex(/(?=.*\d)/, 'Password must contain a number')
    .regex(/(?=.*[@$!%*?&])/, 'Password must contain a special character'),
  confirmPassword: z.string(),
  acceptTerms: z.boolean().refine(val => val, 'You must accept the terms'),
  marketingConsent: z.boolean().default(false)
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
})

export const AccountCreationStep: React.FC<AccountCreationStepProps> = ({
  data,
  onUpdate,
  onNext,
  isSubmitting
}) => {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null)
  
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    setValue,
    trigger
  } = useForm({
    resolver: zodResolver(accountSchema),
    mode: 'onChange',
    defaultValues: {
      email: data.email || '',
      password: data.password || '',
      confirmPassword: '',
      acceptTerms: data.acceptTerms || false,
      marketingConsent: data.marketingConsent || false
    }
  })

  const watchedPassword = watch('password')
  const watchedEmail = watch('email')

  // Email availability check with debounce
  const debouncedEmailCheck = useMemo(
    () => debounce(async (email: string) => {
      if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        try {
          // Check if email is already registered
          const { data } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .single()
          
          setEmailAvailable(!data)
        } catch {
          setEmailAvailable(true) // Email not found, so it's available
        }
      }
    }, 500),
    []
  )

  useEffect(() => {
    if (watchedEmail) {
      debouncedEmailCheck(watchedEmail)
    }
  }, [watchedEmail, debouncedEmailCheck])

  const onSubmit = (stepData: any) => {
    onUpdate(stepData)
    onNext()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h3 className="text-xl font-heading text-cream mb-2">
          Create Your Account
        </h3>
        <p className="text-sage/70 mb-6">
          Start your journey with The Lawless Directory
        </p>
      </div>

      {/* Email Field */}
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-cream">
          Email Address
        </label>
        <div className="relative">
          <input
            {...register('email')}
            type="email"
            id="email"
            autoComplete="email"
            placeholder="Enter your email address"
            className={cn(
              'w-full px-4 py-3 rounded-lg',
              'bg-navy-50/20 border text-cream placeholder-sage/50',
              'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
              'transition-colors duration-200',
              errors.email
                ? 'border-red-error'
                : emailAvailable === false
                ? 'border-gold-warning'
                : emailAvailable === true
                ? 'border-sage'
                : 'border-sage/20'
            )}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {emailAvailable === true && (
              <Check className="w-4 h-4 text-sage" />
            )}
            {emailAvailable === false && (
              <AlertCircle className="w-4 h-4 text-gold-warning" />
            )}
          </div>
        </div>
        {errors.email && (
          <p className="text-sm text-red-error">{errors.email.message}</p>
        )}
        {emailAvailable === false && (
          <p className="text-sm text-gold-warning">
            This email is already registered. Try signing in instead.
          </p>
        )}
      </div>

      {/* Password Field */}
      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium text-cream">
          Password
        </label>
        <div className="relative">
          <input
            {...register('password')}
            type={showPassword ? 'text' : 'password'}
            id="password"
            autoComplete="new-password"
            placeholder="Create a strong password"
            className={cn(
              'w-full px-4 py-3 pr-12 rounded-lg',
              'bg-navy-50/20 border text-cream placeholder-sage/50',
              'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
              'transition-colors duration-200',
              errors.password ? 'border-red-error' : 'border-sage/20'
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-navy-50/20 rounded transition-colors"
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4 text-sage/70" />
            ) : (
              <Eye className="w-4 h-4 text-sage/70" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-sm text-red-error">{errors.password.message}</p>
        )}
        
        {/* Password Strength Indicator */}
        {watchedPassword && (
          <PasswordStrength password={watchedPassword} className="mt-3" />
        )}
      </div>

      {/* Confirm Password Field */}
      <div className="space-y-2">
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-cream">
          Confirm Password
        </label>
        <div className="relative">
          <input
            {...register('confirmPassword')}
            type={showConfirmPassword ? 'text' : 'password'}
            id="confirmPassword"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            className={cn(
              'w-full px-4 py-3 pr-12 rounded-lg',
              'bg-navy-50/20 border text-cream placeholder-sage/50',
              'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
              'transition-colors duration-200',
              errors.confirmPassword ? 'border-red-error' : 'border-sage/20'
            )}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-navy-50/20 rounded transition-colors"
          >
            {showConfirmPassword ? (
              <EyeOff className="w-4 h-4 text-sage/70" />
            ) : (
              <Eye className="w-4 h-4 text-sage/70" />
            )}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-sm text-red-error">{errors.confirmPassword.message}</p>
        )}
      </div>

      {/* Terms and Marketing Consent */}
      <div className="space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            {...register('acceptTerms')}
            type="checkbox"
            className="sr-only"
          />
          <div className={cn(
            'w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 transition-colors',
            watch('acceptTerms')
              ? 'bg-teal-primary border-teal-primary'
              : 'border-sage/30 hover:border-sage/50'
          )}>
            {watch('acceptTerms') && (
              <Check className="w-3 h-3 text-cream" />
            )}
          </div>
          <span className="text-sm text-sage/80 leading-relaxed">
            I accept the{' '}
            <Link href="/terms" className="text-teal-primary hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-teal-primary hover:underline">
              Privacy Policy
            </Link>
          </span>
        </label>
        {errors.acceptTerms && (
          <p className="text-sm text-red-error ml-8">{errors.acceptTerms.message}</p>
        )}

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            {...register('marketingConsent')}
            type="checkbox"
            className="sr-only"
          />
          <div className={cn(
            'w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 transition-colors',
            watch('marketingConsent')
              ? 'bg-teal-primary border-teal-primary'
              : 'border-sage/30 hover:border-sage/50'
          )}>
            {watch('marketingConsent') && (
              <Check className="w-3 h-3 text-cream" />
            )}
          </div>
          <span className="text-sm text-sage/80 leading-relaxed">
            I'd like to receive updates about new businesses and platform features (optional)
          </span>
        </label>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!isValid || emailAvailable === false || isSubmitting}
        className={cn(
          'w-full px-6 py-3 rounded-lg font-medium transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
          isValid && emailAvailable !== false && !isSubmitting
            ? 'bg-gradient-to-r from-teal-primary to-teal-secondary text-cream hover:shadow-lg hover:scale-[1.02]'
            : 'bg-navy-50/20 text-sage/50 cursor-not-allowed'
        )}
      >
        {isSubmitting ? (
          <div className="flex items-center justify-center gap-2">
            <LoadingSpinner size="sm" />
            <span>Creating account...</span>
          </div>
        ) : (
          'Continue to Profile Setup'
        )}
      </button>

      {/* Sign In Link */}
      <div className="text-center">
        <p className="text-sage/70 text-sm">
          Already have an account?{' '}
          <Link
            href="/auth/login"
            className="text-teal-primary hover:text-teal-secondary transition-colors font-medium"
          >
            Sign in here
          </Link>
        </p>
      </div>
    </form>
  )
}
```

### Onboarding Experience
- **Given** a newly registered and verified user
- **When** they first access their account
- **Then** provide comprehensive onboarding:

**Welcome Tour:**
- Interactive platform feature introduction
- Guided tour of business discovery features
- Search and filtering demonstration
- Review system explanation
- Business claiming process overview
- Skip option for experienced users

**Personalization Setup:**
- Location-based business recommendations
- Favorite category selection
- Search preference configuration
- Notification settings customization
- Privacy settings review and setup

### Profile Completion System

**User Profile Completion:**
- Profile completion progress indicator (0-100%)
- Gentle reminders for incomplete sections
- Benefits explanation for completed profiles
- Easy profile editing access
- Social media linking options
- Achievement system for engagement

**Gamification Elements:**
- Progress badges for profile completion
- Points system for platform engagement
- Achievement unlocks for various activities
- Leaderboard for active community members

## Technical Implementation Notes

### Registration Flow Implementation
- Use React Hook Form for multi-step form management
- Implement form persistence across browser sessions
- Create reusable validation schemas with Zod
- Handle file uploads for profile photos with compression

### Email Verification System
- Integrate with Supabase email verification
- Custom email templates with brand styling
- Fallback verification methods
- Anti-spam measures for verification requests

### Onboarding Analytics
- Track onboarding completion rates
- Identify dropout points in the flow
- A/B test different onboarding approaches
- Measure user engagement post-onboarding

### Performance Optimizations
- Lazy load onboarding components
- Optimize image uploads and processing
- Implement efficient form state management
- Cache user preferences locally

## Dependencies
- Story 2.3 (Authentication UI components)
- Story 2.1 (Database schema for user profiles)
- Email service configuration
- File upload and image processing services

## Testing Requirements

### Registration Flow Tests
- Complete registration process validation
- Form validation and error handling tests
- Email verification process tests
- Profile photo upload functionality tests
- Multi-step form persistence tests

### Onboarding Tests
- Welcome tour interaction tests
- Personalization setup functionality
- Skip option and alternative flow tests
- Progress tracking and completion tests
- Analytics event tracking validation

### User Experience Tests
- Registration abandonment point analysis
- Mobile registration flow optimization
- Accessibility compliance for onboarding
- Performance testing for image uploads
- Cross-browser compatibility testing

### Integration Tests
- End-to-end registration and onboarding flow
- Email verification integration testing
- Database profile creation validation
- Authentication state after registration

## Definition of Done

### Registration System
- [ ] Multi-step registration process complete and tested
- [ ] Email verification system functional with branded templates
- [ ] Profile photo upload with cropping and optimization
- [ ] Real-time email availability checking
- [ ] Password strength validation with visual feedback

### Onboarding Experience
- [ ] Interactive onboarding tour implemented
- [ ] Profile completion system with progress tracking
- [ ] Personalization setup for new users
- [ ] Welcome tour with skip functionality
- [ ] Achievement system for engagement

### User Experience
- [ ] Mobile-optimized registration and onboarding
- [ ] Form persistence across browser sessions
- [ ] Clear progress indicators throughout the flow
- [ ] Accessible design with proper ARIA labels
- [ ] Smooth animations and transitions

### Analytics & Monitoring
- [ ] Analytics tracking for registration and onboarding flows
- [ ] Dropout point identification and monitoring
- [ ] Conversion rate tracking for each step
- [ ] User engagement metrics post-onboarding

### Performance & Security
- [ ] Performance optimization for profile photo uploads
- [ ] Form validation prevents malicious input
- [ ] Rate limiting for email verification requests
- [ ] GDPR-compliant consent mechanisms

### Testing Coverage
- [ ] Unit tests for all registration components
- [ ] Integration tests for complete registration flow
- [ ] User experience testing with positive feedback
- [ ] Accessibility compliance testing
- [ ] Performance testing under load

### Documentation
- [ ] Registration flow documentation
- [ ] Onboarding best practices guide
- [ ] Analytics tracking implementation
- [ ] User engagement optimization strategies

## Acceptance Validation

### Registration Success Metrics
- [ ] Registration completion rate > 75%
- [ ] Email verification rate > 80%
- [ ] Form abandonment rate < 25%
- [ ] Average registration time < 3 minutes
- [ ] Email availability check response < 500ms

### Onboarding Engagement Metrics
- [ ] Onboarding tour completion rate > 60%
- [ ] Profile completion rate > 85%
- [ ] User retention after onboarding > 60%
- [ ] Average time to first business interaction < 5 minutes
- [ ] User satisfaction score > 4.0/5.0

### Technical Performance Metrics
- [ ] Registration form response time < 500ms
- [ ] Photo upload processing time < 3 seconds
- [ ] Form validation response time < 100ms
- [ ] Email verification delivery time < 30 seconds
- [ ] Onboarding component loading time < 1 second

## Risk Assessment

**Medium Risk:** Multi-step form complexity may increase abandonment rates
- *Mitigation:* A/B testing different flow lengths, progress saving, and user feedback integration

**Medium Risk:** Email deliverability affecting verification rates
- *Mitigation:* Multiple email providers, fallback verification methods, and delivery monitoring

**Low Risk:** Profile photo upload performance and storage costs
- *Mitigation:* Image compression, CDN integration, and storage optimization

**Low Risk:** Onboarding tour engagement and effectiveness
- *Mitigation:* User testing, analytics-driven optimization, and personalization

## Success Metrics

- **Conversion:** Registration completion rate > 75%
- **Engagement:** Onboarding tour completion > 60%
- **Retention:** 7-day user retention > 60%
- **Performance:** Registration flow completion < 3 minutes
- **Satisfaction:** User onboarding rating > 4.0/5.0

This story establishes a comprehensive user registration and onboarding system that maximizes user conversion, engagement, and long-term retention while providing a premium user experience aligned with the platform's sophisticated design.