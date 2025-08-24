# Story 2.3: Authentication UI Components & Design Integration

**Epic:** Epic 2 - Authentication & Authorization Layer  
**Story ID:** 2.3  
**Story Points:** 34  
**Priority:** P0 (Critical Security Foundation)  
**Assignee:** Frontend Developer Agent  
**Sprint:** 2

## User Story

As a user, I want beautiful and intuitive authentication interfaces that match the platform's sophisticated glassmorphism design so that signing up and logging in feels premium and trustworthy while providing comprehensive form validation and accessibility features.

## Story Overview

This story implements sophisticated authentication UI components that seamlessly integrate with the platform's glassmorphism design system. It includes comprehensive form validation, social authentication, accessibility compliance, and premium user experience patterns with advanced error handling and loading states.

## Detailed Acceptance Criteria

### Authentication Modal System
- **Given** the existing glassmorphism design system
- **When** creating authentication modals
- **Then** implement comprehensive modal components:

**Login Modal Features:**
- Glassmorphism modal with backdrop blur effect
- Email/password login form with real-time validation
- "Remember me" checkbox for extended sessions
- Social login buttons (Google, Apple) with branded styling
- "Forgot password?" link with inline recovery
- "Create account" link to switch to registration
- Loading states with animated spinner
- Error handling with user-friendly messages

**Registration Modal Features:**
- Multi-step registration process with progress indicator
- Step 1: Email, password, confirm password
- Step 2: Profile information (name, location, preferences)
- Step 3: Email verification with resend functionality
- Password strength indicator with real-time feedback
- Terms of service and privacy policy agreement
- Marketing consent checkbox (GDPR compliance)
- Smooth transitions between steps

### Login Form Component Implementation

```typescript
// components/auth/LoginForm.tsx
interface LoginFormProps {
  onSuccess?: (user: User) => void
  onError?: (error: AuthError) => void
  redirectTo?: string
  className?: string
}

const loginSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .min(1, 'Email is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
  rememberMe: z.boolean().default(false)
})

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onError,
  redirectTo,
  className
}) => {
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { signIn } = useAuth()
  
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
  })
  
  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true)
    clearErrors()
    
    try {
      const { user, error } = await signIn(data.email, data.password, {
        rememberMe: data.rememberMe,
        redirectTo
      })
      
      if (error) {
        // Handle specific auth errors
        switch (error.message) {
          case 'Invalid login credentials':
            setError('root', { 
              message: 'Invalid email or password. Please try again.' 
            })
            break
          case 'Email not confirmed':
            setError('root', { 
              message: 'Please check your email and click the confirmation link.' 
            })
            break
          case 'Too many requests':
            setError('root', { 
              message: 'Too many login attempts. Please try again in a few minutes.' 
            })
            break
          default:
            setError('root', { 
              message: 'Something went wrong. Please try again.' 
            })
        }
        onError?.(error)
      } else if (user) {
        toast.success('Successfully logged in!')
        onSuccess?.(user)
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('root', { 
        message: 'Network error. Please check your connection and try again.' 
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <GlassMorphism 
      variant="medium" 
      className={cn('p-8 w-full max-w-md', className)}
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-heading font-semibold text-cream mb-2">
          Welcome Back
        </h2>
        <p className="text-sage/70">
          Sign in to access your business directory
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Email Field with validation and animation */}
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
              className={cn(
                'w-full px-4 py-3 rounded-lg',
                'bg-navy-50/20 border',
                'text-cream placeholder-sage/50',
                'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                'transition-colors duration-200',
                errors.email 
                  ? 'border-red-error' 
                  : touchedFields.email && !errors.email
                  ? 'border-sage/50'
                  : 'border-sage/20'
              )}
              placeholder="Enter your email"
              aria-invalid={errors.email ? 'true' : 'false'}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            <AnimatePresence>
              {touchedFields.email && !errors.email && (
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
          <AnimatePresence>
            {errors.email && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                id="email-error"
                className="text-sm text-red-error flex items-center gap-2"
                role="alert"
              >
                <AlertCircle className="w-4 h-4" />
                {errors.email.message}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Password Field with show/hide toggle */}
        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-cream">
            Password
          </label>
          <div className="relative">
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="current-password"
              className={cn(
                'w-full px-4 py-3 pr-12 rounded-lg',
                'bg-navy-50/20 border',
                'text-cream placeholder-sage/50',
                'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                'transition-colors duration-200',
                errors.password 
                  ? 'border-red-error' 
                  : touchedFields.password && !errors.password
                  ? 'border-sage/50'
                  : 'border-sage/20'
              )}
              placeholder="Enter your password"
              aria-invalid={errors.password ? 'true' : 'false'}
              aria-describedby={errors.password ? 'password-error' : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-navy-50/20 rounded transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4 text-sage/70" />
              ) : (
                <Eye className="w-4 h-4 text-sage/70" />
              )}
            </button>
          </div>
          <AnimatePresence>
            {errors.password && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                id="password-error"
                className="text-sm text-red-error flex items-center gap-2"
                role="alert"
              >
                <AlertCircle className="w-4 h-4" />
                {errors.password.message}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Remember Me & Forgot Password */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              {...register('rememberMe')}
              type="checkbox"
              className="sr-only"
            />
            <div
              className={cn(
                'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                watch('rememberMe')
                  ? 'bg-teal-primary border-teal-primary'
                  : 'border-sage/30 hover:border-sage/50'
              )}
            >
              {watch('rememberMe') && (
                <Check className="w-3 h-3 text-cream" />
              )}
            </div>
            <span className="text-sm text-sage/70">Remember me</span>
          </label>
          
          <Link
            href="/auth/forgot-password"
            className="text-sm text-teal-primary hover:text-teal-secondary transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        {/* Form Error Display */}
        <AnimatePresence>
          {errors.root && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-lg bg-red-error/10 border border-red-error/20"
              role="alert"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-error" />
                <span className="text-sm text-red-error font-medium">
                  {errors.root.message}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className={cn(
            'w-full px-6 py-3 rounded-lg font-medium transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-teal-primary/50 focus:ring-offset-2 focus:ring-offset-navy-dark',
            isValid && !isSubmitting
              ? 'bg-gradient-to-r from-teal-primary to-teal-secondary text-cream hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-navy-50/20 text-sage/50 cursor-not-allowed'
          )}
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center gap-2">
              <LoadingSpinner size="sm" />
              <span>Signing in...</span>
            </div>
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      {/* Social Login Divider */}
      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-sage/20"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-navy-dark px-4 text-sage/70">Or continue with</span>
        </div>
      </div>

      {/* Social Login Buttons */}
      <div className="grid grid-cols-1 gap-3">
        <SocialLoginButton provider="google" />
        <SocialLoginButton provider="apple" />
      </div>

      {/* Sign Up Link */}
      <div className="text-center mt-8">
        <p className="text-sage/70">
          Don't have an account?{' '}
          <Link
            href="/auth/register"
            className="text-teal-primary hover:text-teal-secondary transition-colors font-medium"
          >
            Sign up now
          </Link>
        </p>
      </div>
    </GlassMorphism>
  )
}
```

### Password Strength Component

```typescript
// components/auth/PasswordStrength.tsx
interface PasswordStrengthProps {
  password: string
  className?: string
}

export const PasswordStrength: React.FC<PasswordStrengthProps> = ({ 
  password, 
  className 
}) => {
  const requirements = useMemo(() => [
    {
      label: 'At least 8 characters',
      met: password.length >= 8,
      icon: <Hash className="w-4 h-4" />
    },
    {
      label: 'One uppercase letter',
      met: /[A-Z]/.test(password),
      icon: <Type className="w-4 h-4" />
    },
    {
      label: 'One lowercase letter',
      met: /[a-z]/.test(password),
      icon: <Type className="w-4 h-4" />
    },
    {
      label: 'One number',
      met: /\d/.test(password),
      icon: <Hash className="w-4 h-4" />
    },
    {
      label: 'One special character',
      met: /[@$!%*?&]/.test(password),
      icon: <Key className="w-4 h-4" />
    }
  ], [password])

  const strength = requirements.filter(req => req.met).length
  const strengthPercentage = (strength / requirements.length) * 100
  
  const getStrengthColor = () => {
    if (strength <= 2) return 'from-red-error to-red-warning'
    if (strength <= 3) return 'from-gold-secondary to-gold-primary'
    if (strength <= 4) return 'from-teal-secondary to-teal-primary'
    return 'from-sage to-teal-primary'
  }
  
  const getStrengthLabel = () => {
    if (strength <= 2) return 'Weak'
    if (strength <= 3) return 'Fair'
    if (strength <= 4) return 'Good'
    return 'Strong'
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-cream">Password Strength</span>
        <span className={cn(
          'text-sm font-medium',
          strength <= 2 ? 'text-red-error' :
          strength <= 3 ? 'text-gold-primary' :
          strength <= 4 ? 'text-teal-primary' : 'text-sage'
        )}>
          {getStrengthLabel()}
        </span>
      </div>
      
      <div className="w-full bg-navy-50/20 rounded-full h-2 overflow-hidden">
        <motion.div
          className={cn('h-full bg-gradient-to-r', getStrengthColor())}
          initial={{ width: 0 }}
          animate={{ width: `${strengthPercentage}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>
      
      <div className="grid grid-cols-1 gap-2">
        {requirements.map((req, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={cn(
              'flex items-center gap-2 text-xs transition-colors',
              req.met ? 'text-sage' : 'text-sage/50'
            )}
          >
            <div className={cn(
              'flex-shrink-0',
              req.met ? 'text-sage' : 'text-sage/30'
            )}>
              {req.met ? <Check className="w-3 h-3" /> : req.icon}
            </div>
            <span>{req.label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
```

### Social Login Component System

```typescript
// components/auth/SocialLoginButton.tsx
interface SocialLoginButtonProps {
  provider: 'google' | 'apple' | 'facebook'
  onSuccess?: (user: User) => void
  onError?: (error: AuthError) => void
  className?: string
  disabled?: boolean
}

const providerConfig = {
  google: {
    name: 'Google',
    icon: <GoogleIcon className="w-5 h-5" />,
    bgColor: 'bg-white hover:bg-gray-50',
    textColor: 'text-gray-900',
    borderColor: 'border-gray-200'
  },
  apple: {
    name: 'Apple',
    icon: <AppleIcon className="w-5 h-5" />,
    bgColor: 'bg-black hover:bg-gray-900',
    textColor: 'text-white',
    borderColor: 'border-gray-800'
  },
  facebook: {
    name: 'Facebook',
    icon: <FacebookIcon className="w-5 h-5" />,
    bgColor: 'bg-blue-600 hover:bg-blue-700',
    textColor: 'text-white',
    borderColor: 'border-blue-600'
  }
}

export const SocialLoginButton: React.FC<SocialLoginButtonProps> = ({
  provider,
  onSuccess,
  onError,
  className,
  disabled = false
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const { signInWithProvider } = useAuth()
  const config = providerConfig[provider]

  const handleSocialLogin = async () => {
    if (disabled || isLoading) return
    
    setIsLoading(true)
    
    try {
      const { user, error } = await signInWithProvider(provider, {
        redirectTo: `${window.location.origin}/auth/callback`
      })
      
      if (error) {
        switch (error.message) {
          case 'Popup blocked':
            toast.error('Please allow popups for social login to work')
            break
          case 'Access denied':
            toast.error('Access was denied. Please try again.')
            break
          case 'Network error':
            toast.error('Network error. Please check your connection.')
            break
          default:
            toast.error(`Failed to sign in with ${config.name}`)
        }
        onError?.(error)
      } else if (user) {
        toast.success(`Successfully signed in with ${config.name}!`)
        onSuccess?.(user)
      }
    } catch (error) {
      console.error(`${provider} login error:`, error)
      toast.error(`Something went wrong with ${config.name} login`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleSocialLogin}
      disabled={disabled || isLoading}
      className={cn(
        'w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg',
        'border transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-navy-dark',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        config.bgColor,
        config.textColor,
        config.borderColor,
        provider === 'google' && 'focus:ring-gray-300',
        provider === 'apple' && 'focus:ring-gray-500',
        provider === 'facebook' && 'focus:ring-blue-400',
        !disabled && 'hover:scale-[1.02] active:scale-[0.98]',
        className
      )}
      aria-label={`Sign in with ${config.name}`}
    >
      {isLoading ? (
        <LoadingSpinner size="sm" className={config.textColor} />
      ) : (
        config.icon
      )}
      <span className="font-medium">
        {isLoading ? 'Signing in...' : `Continue with ${config.name}`}
      </span>
    </button>
  )
}
```

### Form Validation & User Experience

**Alternative Authentication Methods:**
- Magic link login with email-only form
- Phone number authentication with SMS verification
- Social provider login with proper OAuth flow
- "Continue as guest" option for basic features
- Account linking for users with multiple auth methods

**Authentication State UI:**
- User avatar and name display in header
- Authentication status indicators
- Role-based UI element visibility
- Login/logout button state management
- Account dropdown menu with profile access
- Notification system for authentication events

**Accessibility Features:**
- Screen reader support for all authentication flows
- Keyboard navigation for modal interactions
- Proper focus management during auth processes
- High contrast mode compatibility
- ARIA labels and descriptions for form fields
- Clear error messaging with proper roles

## Technical Implementation Notes

### Component Architecture
- Create reusable form components with validation
- Implement modal context for authentication flows
- Use React Hook Form for form state management
- Integrate with design system components

### Design System Integration
- Maintain glassmorphism aesthetic for auth components
- Use existing color palette and typography
- Implement consistent spacing and sizing
- Ensure mobile-responsive design patterns

### Performance Optimizations
- Lazy load authentication modals
- Debounced validation for better UX
- Optimized re-renders with React.memo
- Efficient form state management

## Dependencies
- Story 2.2 (Auth middleware and server components)
- Epic 1 Story 1.2 (Component architecture foundation)
- Design system components (GlassMorphism, etc.)

## Testing Requirements

### Component Tests
- Authentication form functionality tests
- Modal interaction and navigation tests
- Validation and error handling tests
- Social login integration tests
- Password strength calculation accuracy

### Accessibility Tests
- Screen reader compatibility tests
- Keyboard navigation validation
- Color contrast compliance tests
- Focus management tests
- ARIA attribute validation

### User Experience Tests
- Form completion user journey tests
- Error recovery scenario tests
- Mobile authentication flow tests
- Cross-browser compatibility tests
- Loading state and feedback tests

### Integration Tests
- Full authentication flow testing
- Social provider integration testing
- Form validation with backend services
- Error handling with various scenarios

## Definition of Done

### UI Components
- [ ] Complete authentication modal system with glassmorphism design
- [ ] Login form with comprehensive validation and error handling
- [ ] Registration form with multi-step process and progress tracking
- [ ] Password strength component with real-time feedback
- [ ] Social login integration with proper error handling

### User Experience
- [ ] Form validation provides real-time feedback
- [ ] Loading states inform users of progress during all operations
- [ ] Error messages are clear, actionable, and contextual
- [ ] Smooth animations and micro-interactions throughout
- [ ] Mobile-optimized authentication interface

### Accessibility & Compliance
- [ ] Accessibility compliance for all authentication flows (WCAG 2.1 AA)
- [ ] Keyboard navigation support for all interactive elements
- [ ] Screen reader compatibility with proper ARIA labels
- [ ] High contrast mode support
- [ ] GDPR-compliant consent mechanisms

### Design Integration
- [ ] Integration with existing glassmorphism design system
- [ ] Consistent typography and color usage
- [ ] Responsive design patterns across all screen sizes
- [ ] Proper spacing and layout according to design guidelines

### Security & Validation
- [ ] Client-side validation prevents invalid submissions
- [ ] Password strength requirements enforced
- [ ] Social authentication follows OAuth 2.0 best practices
- [ ] Form data sanitization and validation

### Testing Coverage
- [ ] Unit test coverage > 85% for all auth components
- [ ] Integration testing for all authentication flows
- [ ] Accessibility testing with automated tools
- [ ] Cross-browser compatibility validation
- [ ] Mobile device testing across platforms

### Documentation
- [ ] Component usage documentation
- [ ] Design system integration guidelines
- [ ] Accessibility implementation notes
- [ ] Testing procedures and examples

## Acceptance Validation

### User Experience Validation
- [ ] Authentication flows complete in < 30 seconds for new users
- [ ] Error recovery paths are intuitive and effective
- [ ] Form validation provides immediate, helpful feedback
- [ ] Social login works seamlessly across all supported providers
- [ ] Mobile experience is optimized and touch-friendly

### Security Validation
- [ ] No sensitive data exposed in client-side code
- [ ] Form validation prevents malicious input
- [ ] Password requirements meet security standards
- [ ] Social authentication tokens handled securely

### Performance Validation
- [ ] Form submission response time < 500ms
- [ ] Social authentication redirect < 2s
- [ ] Component rendering performance optimized
- [ ] No memory leaks in authentication flows

## Risk Assessment

**Medium Risk:** Complex modal state management across authentication flows
- *Mitigation:* Comprehensive testing and state management validation

**Medium Risk:** Social authentication provider integration complexity
- *Mitigation:* Thorough testing with each provider and error handling

**Low Risk:** Design system integration and consistency
- *Mitigation:* Regular design reviews and automated visual testing

**Low Risk:** Form validation complexity and edge cases
- *Mitigation:* Comprehensive validation testing and user feedback integration

## Success Metrics

- **User Experience:** 95% successful authentication completion rate
- **Performance:** Form validation response < 100ms
- **Accessibility:** 100% WCAG 2.1 AA compliance score
- **Design Consistency:** 95% design system component usage
- **Error Handling:** < 5% user confusion rate on authentication errors

This story establishes the complete authentication UI foundation that provides users with a premium, accessible, and intuitive authentication experience while maintaining the platform's sophisticated design language.