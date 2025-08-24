# Frontend Epic 2: Authentication UI & Error Handling - Comprehensive Implementation Stories

**Date:** 2024-08-23  
**Epic Lead:** Frontend Developer Agent  
**Priority:** P0 (Critical Security Foundation)  
**Duration:** 3 Sprints (9 weeks)  
**Story Points Total:** 147 points

## Epic Mission Statement

Create a sophisticated authentication user interface system that seamlessly integrates with Supabase Auth while maintaining the premium glassmorphism aesthetics. Implement comprehensive error handling, loading states, and user feedback systems that provide exceptional user experience during authentication flows.

## Authentication UI Architecture Context

**Current Integration Requirements:**
- Supabase Auth integration with SSR support
- Role-based access control (Public, Business Owner, Admin)
- Business ownership verification system
- Social authentication providers (Google, Apple, Facebook)
- Multi-factor authentication support
- Password reset and account recovery flows

**UI Design Philosophy:**
- Maintain existing glassmorphism design language
- Implement micro-interactions for premium feel
- Provide clear feedback for all authentication states
- Support accessibility standards (WCAG 2.1 AA)
- Mobile-first responsive design
- Progressive enhancement for offline scenarios

**Technical Architecture:**
- Next.js App Router with Supabase SSR
- React Hook Form with Zod validation
- Framer Motion for smooth transitions
- Zustand for authentication state management
- React Query for server state synchronization
- Toast notifications for user feedback

---

## Story F2.1: Authentication Form Components & Validation System

**User Story:** As a frontend developer, I want to create comprehensive authentication form components with advanced validation, error handling, and accessibility features so that users can securely authenticate with an exceptional user experience.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 21  
**Sprint:** 1

### Detailed Acceptance Criteria

**Login Form Component:**
- **Given** user authentication requirements
- **When** implementing login form
- **Then** create:

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

type LoginFormData = z.infer<typeof loginSchema>

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onError,
  redirectTo,
  className
}) => {
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { login } = useAuthStore()
  
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
  
  const watchedFields = watch()
  
  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true)
    clearErrors()
    
    try {
      const { user, error } = await login(data.email, data.password, {
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
                watchedFields.rememberMe
                  ? 'bg-teal-primary border-teal-primary'
                  : 'border-sage/30 hover:border-sage/50'
              )}
            >
              {watchedFields.rememberMe && (
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

        {/* Form Error */}
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

**Registration Form Component:**
- **Given** user registration requirements
- **When** implementing registration form
- **Then** create comprehensive validation with:
  - Email validation with domain checking
  - Password strength indicator
  - Terms of service acceptance
  - Business owner identification
  - Progressive disclosure for business details

**Form Validation Patterns:**
- **Given** form validation requirements
- **When** implementing validation logic
- **Then** ensure:
  - Real-time validation with debounced feedback
  - Accessibility-compliant error messaging
  - Progressive enhancement for offline scenarios
  - Clear success states and micro-interactions

### Technical Implementation Requirements

**Password Strength Component:**
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

### Testing Requirements

**Form Testing:**
- Input validation testing with various scenarios
- Accessibility compliance testing
- Error message display and timing
- Password strength calculation accuracy
- Social login integration testing

**User Experience Testing:**
- Form completion flow testing
- Error recovery user journeys
- Mobile form interaction testing
- Keyboard navigation validation

---

## Story F2.2: Social Authentication & Provider Integration

**User Story:** As a frontend developer, I want to implement seamless social authentication with Google, Apple, and Facebook providers while maintaining consistent UI patterns and comprehensive error handling.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 18  
**Sprint:** 1

### Detailed Acceptance Criteria

**Social Login Component System:**
- **Given** social authentication requirements
- **When** implementing provider integrations
- **Then** create:

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
  const { signInWithProvider } = useAuthStore()
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

**Social Provider Error Handling:**
- **Given** social authentication error scenarios
- **When** handling provider-specific errors
- **Then** implement comprehensive error recovery:

```typescript
// utils/socialAuthErrors.ts
export const socialAuthErrorHandler = {
  handleProviderError: (provider: string, error: any) => {
    const errorMappings = {
      // Google-specific errors
      'popup_closed_by_user': {
        message: 'Sign-in was cancelled. Please try again.',
        action: 'retry'
      },
      'access_blocked': {
        message: 'Access was blocked. Please check your browser settings.',
        action: 'redirect_help'
      },
      'popup_blocked': {
        message: 'Popup was blocked. Please allow popups and try again.',
        action: 'show_instructions'
      },
      
      // Apple-specific errors
      'user_cancelled_authorize': {
        message: 'Sign-in was cancelled.',
        action: 'retry'
      },
      'invalid_client': {
        message: 'Configuration error. Please contact support.',
        action: 'contact_support'
      },
      
      // Facebook-specific errors
      'access_denied': {
        message: 'Access was denied. Please grant permissions and try again.',
        action: 'retry'
      },
      'server_error': {
        message: 'Facebook is temporarily unavailable. Please try again later.',
        action: 'retry_later'
      },
      
      // Generic errors
      'network_error': {
        message: 'Network connection error. Please check your internet.',
        action: 'check_connection'
      }
    }
    
    const errorKey = error.code || error.message || 'unknown_error'
    const errorInfo = errorMappings[errorKey] || {
      message: `Something went wrong with ${provider} login. Please try again.`,
      action: 'retry'
    }
    
    return errorInfo
  },
  
  showErrorToast: (provider: string, error: any) => {
    const errorInfo = socialAuthErrorHandler.handleProviderError(provider, error)
    
    toast.error(errorInfo.message, {
      action: errorInfo.action === 'retry' ? {
        label: 'Try Again',
        onClick: () => window.location.reload()
      } : undefined
    })
  }
}
```

**OAuth Callback Handling:**
- **Given** OAuth redirect flow requirements
- **When** implementing callback page
- **Then** create secure callback processing:

```typescript
// app/auth/callback/page.tsx
export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Callback error:', error)
          setStatus('error')
          setErrorMessage(error.message)
          
          // Redirect to login with error
          setTimeout(() => {
            router.push(`/auth/login?error=${encodeURIComponent(error.message)}`)
          }, 3000)
          return
        }
        
        if (data?.session) {
          setStatus('success')
          
          // Get redirect URL from state or default
          const redirectTo = searchParams.get('redirect_to') || '/dashboard'
          
          // Small delay to show success state
          setTimeout(() => {
            router.push(redirectTo)
          }, 1500)
        } else {
          setStatus('error')
          setErrorMessage('No session found')
          
          setTimeout(() => {
            router.push('/auth/login')
          }, 3000)
        }
      } catch (error) {
        console.error('Unexpected callback error:', error)
        setStatus('error')
        setErrorMessage('Something went wrong')
        
        setTimeout(() => {
          router.push('/auth/login')
        }, 3000)
      }
    }

    handleAuthCallback()
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-dark via-teal-primary to-navy-dark flex items-center justify-center p-4">
      <GlassMorphism variant="medium" className="p-8 text-center max-w-md w-full">
        {status === 'loading' && (
          <div className="space-y-4">
            <LoadingSpinner size="lg" />
            <h2 className="text-xl font-heading text-cream">
              Completing sign in...
            </h2>
            <p className="text-sage/70">
              Please wait while we verify your account.
            </p>
          </div>
        )}
        
        {status === 'success' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4"
          >
            <div className="w-16 h-16 bg-sage/20 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-sage" />
            </div>
            <h2 className="text-xl font-heading text-cream">
              Sign in successful!
            </h2>
            <p className="text-sage/70">
              Redirecting you to your dashboard...
            </p>
          </motion.div>
        )}
        
        {status === 'error' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4"
          >
            <div className="w-16 h-16 bg-red-error/20 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-red-error" />
            </div>
            <h2 className="text-xl font-heading text-cream">
              Sign in failed
            </h2>
            <p className="text-sage/70">
              {errorMessage}
            </p>
            <p className="text-xs text-sage/50">
              Redirecting to login page...
            </p>
          </motion.div>
        )}
      </GlassMorphism>
    </div>
  )
}
```

### Testing Requirements

**Social Authentication Testing:**
- Provider integration testing with mocked responses
- Error scenario testing for each provider
- Callback URL handling validation
- Cross-browser compatibility testing

**Security Testing:**
- OAuth flow security validation
- CSRF protection testing
- Token handling security review

---

## Story F2.3: Loading States & User Feedback Systems

**User Story:** As a frontend developer, I want to implement sophisticated loading states, progress indicators, and user feedback systems that provide clear communication during all authentication processes while maintaining premium aesthetics.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 15  
**Sprint:** 1

### Detailed Acceptance Criteria

**Loading State Components:**
- **Given** authentication loading requirements
- **When** implementing loading indicators
- **Then** create:

```typescript
// components/ui/LoadingStates.tsx
interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  color?: 'primary' | 'secondary' | 'accent'
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className,
  color = 'primary'
}) => {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4', 
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  }
  
  const colorClasses = {
    primary: 'text-teal-primary',
    secondary: 'text-sage',
    accent: 'text-gold-primary'
  }

  return (
    <motion.div
      className={cn(
        'inline-block',
        sizeClasses[size],
        colorClasses[color],
        className
      )}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: 'linear'
      }}
    >
      <svg
        className="w-full h-full"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </motion.div>
  )
}

// Progress bar component for multi-step processes
interface ProgressBarProps {
  progress: number // 0-100
  className?: string
  animated?: boolean
  showPercentage?: boolean
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ 
  progress, 
  className,
  animated = true,
  showPercentage = false
}) => {
  const clampedProgress = Math.max(0, Math.min(100, progress))
  
  return (
    <div className={cn('space-y-2', className)}>
      {showPercentage && (
        <div className="flex justify-between items-center">
          <span className="text-sm text-sage/70">Progress</span>
          <span className="text-sm text-cream font-medium">
            {Math.round(clampedProgress)}%
          </span>
        </div>
      )}
      
      <div className="w-full bg-navy-50/20 rounded-full h-2 overflow-hidden">
        <motion.div
          className={cn(
            'h-full bg-gradient-to-r from-teal-primary to-teal-secondary',
            animated && 'relative overflow-hidden'
          )}
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          {animated && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              animate={{
                x: ['-100%', '100%']
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            />
          )}
        </motion.div>
      </div>
    </div>
  )
}
```

**Authentication Flow Status Component:**
- **Given** multi-step authentication processes
- **When** implementing status tracking
- **Then** create:

```typescript
// components/auth/AuthFlowStatus.tsx
interface AuthFlowStep {
  id: string
  title: string
  description: string
  status: 'pending' | 'active' | 'completed' | 'error'
  icon: React.ReactNode
}

interface AuthFlowStatusProps {
  steps: AuthFlowStep[]
  currentStepId: string
  className?: string
}

export const AuthFlowStatus: React.FC<AuthFlowStatusProps> = ({ 
  steps, 
  currentStepId, 
  className 
}) => {
  const currentStepIndex = steps.findIndex(step => step.id === currentStepId)
  
  return (
    <div className={cn('space-y-4', className)}>
      {steps.map((step, index) => {
        const isActive = step.id === currentStepId
        const isCompleted = index < currentStepIndex || step.status === 'completed'
        const hasError = step.status === 'error'
        
        return (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              'flex items-center gap-4 p-4 rounded-lg transition-all duration-200',
              isActive && 'bg-teal-primary/10 border border-teal-primary/30',
              isCompleted && !hasError && 'bg-sage/10 border border-sage/30',
              hasError && 'bg-red-error/10 border border-red-error/30'
            )}
          >
            {/* Step Icon */}
            <div
              className={cn(
                'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200',
                isActive && 'bg-teal-primary text-cream',
                isCompleted && !hasError && 'bg-sage text-navy-dark',
                hasError && 'bg-red-error text-cream',
                !isActive && !isCompleted && !hasError && 'bg-navy-50/20 text-sage/50'
              )}
            >
              {hasError ? (
                <AlertTriangle className="w-5 h-5" />
              ) : isCompleted ? (
                <Check className="w-5 h-5" />
              ) : isActive ? (
                <LoadingSpinner size="sm" />
              ) : (
                step.icon
              )}
            </div>
            
            {/* Step Content */}
            <div className="flex-1 min-w-0">
              <h4 className={cn(
                'font-medium transition-colors',
                isActive && 'text-cream',
                isCompleted && !hasError && 'text-sage',
                hasError && 'text-red-error',
                !isActive && !isCompleted && !hasError && 'text-sage/70'
              )}>
                {step.title}
              </h4>
              <p className={cn(
                'text-sm mt-1 transition-colors',
                isActive && 'text-sage/80',
                isCompleted && !hasError && 'text-sage/60',
                hasError && 'text-red-error/80',
                !isActive && !isCompleted && !hasError && 'text-sage/50'
              )}>
                {step.description}
              </p>
            </div>
            
            {/* Connection Line */}
            {index < steps.length - 1 && (
              <div className="absolute left-9 top-16 w-px h-8 bg-sage/20" />
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
```

**Toast Notification System:**
- **Given** user feedback requirements
- **When** implementing notification system
- **Then** create:

```typescript
// components/ui/Toast.tsx
interface ToastProps {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  onClose: (id: string) => void
  autoClose?: number // milliseconds
}

export const Toast: React.FC<ToastProps> = ({
  id,
  type,
  title,
  description,
  action,
  onClose,
  autoClose = 5000
}) => {
  const [isExiting, setIsExiting] = useState(false)
  
  const typeConfig = {
    success: {
      icon: <Check className="w-5 h-5" />,
      bgColor: 'bg-sage/20 border-sage/30',
      iconColor: 'text-sage',
      textColor: 'text-cream'
    },
    error: {
      icon: <AlertTriangle className="w-5 h-5" />,
      bgColor: 'bg-red-error/20 border-red-error/30',
      iconColor: 'text-red-error',
      textColor: 'text-cream'
    },
    warning: {
      icon: <AlertCircle className="w-5 h-5" />,
      bgColor: 'bg-gold-primary/20 border-gold-primary/30',
      iconColor: 'text-gold-primary',
      textColor: 'text-cream'
    },
    info: {
      icon: <Info className="w-5 h-5" />,
      bgColor: 'bg-teal-primary/20 border-teal-primary/30',
      iconColor: 'text-teal-primary',
      textColor: 'text-cream'
    }
  }
  
  const config = typeConfig[type]
  
  // Auto close timer
  useEffect(() => {
    if (autoClose > 0) {
      const timer = setTimeout(() => {
        handleClose()
      }, autoClose)
      
      return () => clearTimeout(timer)
    }
  }, [autoClose])
  
  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => onClose(id), 300)
  }

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          className={cn(
            'relative p-4 rounded-lg border backdrop-blur-lg shadow-lg max-w-sm w-full',
            config.bgColor
          )}
        >
          <div className="flex items-start gap-3">
            <div className={cn('flex-shrink-0 mt-0.5', config.iconColor)}>
              {config.icon}
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className={cn('font-medium', config.textColor)}>
                {title}
              </h4>
              {description && (
                <p className={cn('text-sm mt-1 opacity-90', config.textColor)}>
                  {description}
                </p>
              )}
              
              {action && (
                <button
                  onClick={action.onClick}
                  className={cn(
                    'text-sm font-medium mt-2 hover:underline',
                    config.iconColor
                  )}
                >
                  {action.label}
                </button>
              )}
            </div>
            
            <button
              onClick={handleClose}
              className="flex-shrink-0 p-1 hover:bg-navy-50/20 rounded transition-colors"
              aria-label="Close notification"
            >
              <X className="w-4 h-4 text-sage/70" />
            </button>
          </div>
          
          {/* Progress bar for auto-close */}
          {autoClose > 0 && (
            <motion.div
              className="absolute bottom-0 left-0 h-1 bg-current opacity-30 rounded-b-lg"
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: autoClose / 1000, ease: 'linear' }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Toast container and provider
export const ToastContainer: React.FC = () => {
  const { toasts } = useToastStore()
  
  return (
    <div className="fixed top-4 right-4 z-50 space-y-3">
      {toasts.map(toast => (
        <Toast key={toast.id} {...toast} />
      ))}
    </div>
  )
}
```

### Testing Requirements

**Loading State Testing:**
- Loading spinner render testing
- Progress bar accuracy testing
- Toast notification timing validation
- User interaction during loading states

**User Experience Testing:**
- Loading state accessibility
- Progress indication clarity
- Error message comprehension
- Recovery action effectiveness

---

## Story F2.4: User Profile & Account Management Interface

**User Story:** As a frontend developer, I want to create a comprehensive user profile and account management interface that allows users to update their information, manage security settings, and handle account preferences with elegant UI interactions.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 19  
**Sprint:** 2

### Detailed Acceptance Criteria

**Profile Management Component:**
- **Given** user profile editing requirements
- **When** implementing profile interface
- **Then** create:

```typescript
// components/profile/ProfileManagement.tsx
interface UserProfile {
  id: string
  email: string
  firstName: string
  lastName: string
  phoneNumber?: string
  avatar?: string
  businessOwner: boolean
  emailNotifications: boolean
  marketingEmails: boolean
  twoFactorEnabled: boolean
  lastLogin: string
  createdAt: string
}

export const ProfileManagement: React.FC = () => {
  const { user, updateProfile } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences'>('profile')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  const profileForm = useForm<Partial<UserProfile>>({
    resolver: zodResolver(profileSchema),
    mode: 'onChange',
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phoneNumber: user?.phoneNumber || '',
      emailNotifications: user?.emailNotifications ?? true,
      marketingEmails: user?.marketingEmails ?? false
    }
  })
  
  const { register, handleSubmit, formState: { errors, isDirty }, reset } = profileForm

  const onSubmitProfile = async (data: Partial<UserProfile>) => {
    setIsSaving(true)
    
    try {
      await updateProfile(data)
      toast.success('Profile updated successfully!')
      setIsEditing(false)
      reset(data)
    } catch (error) {
      toast.error('Failed to update profile. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    reset()
    setIsEditing(false)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Profile Header */}
      <div className="text-center">
        <h1 className="text-3xl font-heading font-semibold text-cream mb-2">
          Account Settings
        </h1>
        <p className="text-sage/70">
          Manage your account information and preferences
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex justify-center">
        <div className="flex bg-navy-50/20 rounded-lg p-1">
          {(['profile', 'security', 'preferences'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-6 py-2 rounded-md text-sm font-medium transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                activeTab === tab
                  ? 'bg-teal-primary text-cream shadow-sm'
                  : 'text-sage/70 hover:text-sage hover:bg-navy-50/20'
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'profile' && (
            <ProfileTab
              user={user}
              isEditing={isEditing}
              isSaving={isSaving}
              onEdit={() => setIsEditing(true)}
              onCancel={handleCancelEdit}
              onSubmit={handleSubmit(onSubmitProfile)}
              form={profileForm}
              errors={errors}
              isDirty={isDirty}
            />
          )}
          
          {activeTab === 'security' && (
            <SecurityTab user={user} />
          )}
          
          {activeTab === 'preferences' && (
            <PreferencesTab user={user} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// Profile tab component
const ProfileTab: React.FC<ProfileTabProps> = ({
  user,
  isEditing,
  isSaving,
  onEdit,
  onCancel,
  onSubmit,
  form,
  errors,
  isDirty
}) => {
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <GlassMorphism variant="medium" className="p-8">
      <div className="space-y-8">
        {/* Avatar Section */}
        <div className="flex items-center gap-6">
          <div className="relative">
            <Avatar
              src={avatarPreview || user?.avatar}
              alt={user?.firstName || 'User'}
              size="xl"
              fallback={`${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`}
            />
            {isEditing && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-2 -right-2 p-2 bg-teal-primary rounded-full hover:bg-teal-secondary transition-colors"
                aria-label="Change avatar"
              >
                <Camera className="w-4 h-4 text-cream" />
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          
          <div>
            <h3 className="text-xl font-heading text-cream">
              {user?.firstName} {user?.lastName}
            </h3>
            <p className="text-sage/70">{user?.email}</p>
            {user?.businessOwner && (
              <div className="flex items-center gap-2 mt-2">
                <Building className="w-4 h-4 text-gold-primary" />
                <span className="text-sm text-gold-primary font-medium">
                  Business Owner
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Profile Form */}
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* First Name */}
            <div className="space-y-2">
              <label htmlFor="firstName" className="block text-sm font-medium text-cream">
                First Name
              </label>
              <input
                {...form.register('firstName')}
                type="text"
                id="firstName"
                disabled={!isEditing}
                className={cn(
                  'w-full px-4 py-3 rounded-lg transition-colors',
                  'bg-navy-50/20 border text-cream placeholder-sage/50',
                  'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                  !isEditing && 'cursor-not-allowed opacity-70',
                  errors.firstName ? 'border-red-error' : 'border-sage/20'
                )}
              />
              {errors.firstName && (
                <p className="text-sm text-red-error">{errors.firstName.message}</p>
              )}
            </div>

            {/* Last Name */}
            <div className="space-y-2">
              <label htmlFor="lastName" className="block text-sm font-medium text-cream">
                Last Name
              </label>
              <input
                {...form.register('lastName')}
                type="text"
                id="lastName"
                disabled={!isEditing}
                className={cn(
                  'w-full px-4 py-3 rounded-lg transition-colors',
                  'bg-navy-50/20 border text-cream placeholder-sage/50',
                  'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                  !isEditing && 'cursor-not-allowed opacity-70',
                  errors.lastName ? 'border-red-error' : 'border-sage/20'
                )}
              />
              {errors.lastName && (
                <p className="text-sm text-red-error">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          {/* Email (Read-only) */}
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-cream">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                id="email"
                value={user?.email}
                disabled
                className="w-full px-4 py-3 rounded-lg bg-navy-50/10 border border-sage/10 text-sage/70 cursor-not-allowed"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Lock className="w-4 h-4 text-sage/50" />
              </div>
            </div>
            <p className="text-xs text-sage/50">
              Email cannot be changed. Contact support if you need to update it.
            </p>
          </div>

          {/* Phone Number */}
          <div className="space-y-2">
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-cream">
              Phone Number
            </label>
            <input
              {...form.register('phoneNumber')}
              type="tel"
              id="phoneNumber"
              disabled={!isEditing}
              placeholder="+1 (555) 123-4567"
              className={cn(
                'w-full px-4 py-3 rounded-lg transition-colors',
                'bg-navy-50/20 border text-cream placeholder-sage/50',
                'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                !isEditing && 'cursor-not-allowed opacity-70',
                errors.phoneNumber ? 'border-red-error' : 'border-sage/20'
              )}
            />
            {errors.phoneNumber && (
              <p className="text-sm text-red-error">{errors.phoneNumber.message}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-4 pt-6 border-t border-sage/20">
            {!isEditing ? (
              <button
                type="button"
                onClick={onEdit}
                className="px-6 py-2 bg-teal-primary hover:bg-teal-secondary text-cream rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
              >
                Edit Profile
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-6 py-2 text-sage/70 hover:text-sage transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isDirty || isSaving}
                  className={cn(
                    'px-6 py-2 rounded-lg font-medium transition-all',
                    'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                    isDirty && !isSaving
                      ? 'bg-teal-primary hover:bg-teal-secondary text-cream'
                      : 'bg-navy-50/20 text-sage/50 cursor-not-allowed'
                  )}
                >
                  {isSaving ? (
                    <div className="flex items-center gap-2">
                      <LoadingSpinner size="sm" />
                      <span>Saving...</span>
                    </div>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </GlassMorphism>
  )
}
```

**Security Settings Component:**
- **Given** security management requirements
- **When** implementing security interface
- **Then** create comprehensive security controls including:
  - Password change functionality
  - Two-factor authentication setup
  - Login session management
  - Account deletion options

**Notification Preferences:**
- **Given** user preference management
- **When** implementing preference controls
- **Then** create granular notification settings with real-time preview

### Testing Requirements

**Profile Management Testing:**
- Form validation and submission testing
- Avatar upload functionality testing
- Security settings change validation
- Preference persistence testing

**User Experience Testing:**
- Profile editing workflow testing
- Security change confirmation flows
- Error handling and recovery testing

---

## Story F2.5: Password Reset & Account Recovery System

**User Story:** As a frontend developer, I want to implement a comprehensive password reset and account recovery system with secure token validation, progress tracking, and user-friendly recovery flows.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 16  
**Sprint:** 2

### Detailed Acceptance Criteria

**Password Reset Request Form:**
- **Given** password recovery requirements
- **When** implementing reset request interface
- **Then** create:

```typescript
// components/auth/PasswordResetRequest.tsx
const resetRequestSchema = z.object({
  email: z.string().email('Please enter a valid email address')
})

export const PasswordResetRequest: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [email, setEmail] = useState('')
  
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(resetRequestSchema)
  })

  const onSubmit = async (data: { email: string }) => {
    setIsSubmitting(true)
    setEmail(data.email)
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      })
      
      if (error) {
        toast.error('Failed to send reset email. Please try again.')
      } else {
        setIsSubmitted(true)
      }
    } catch (error) {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <GlassMorphism variant="medium" className="p-8 max-w-md mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-6"
        >
          <div className="w-16 h-16 bg-teal-primary/20 rounded-full flex items-center justify-center mx-auto">
            <Mail className="w-8 h-8 text-teal-primary" />
          </div>
          
          <div>
            <h2 className="text-xl font-heading font-semibold text-cream mb-2">
              Check your email
            </h2>
            <p className="text-sage/70">
              We've sent a password reset link to
            </p>
            <p className="text-cream font-medium mt-1">{email}</p>
          </div>
          
          <div className="space-y-4">
            <p className="text-sm text-sage/60">
              Didn't receive the email? Check your spam folder or try again.
            </p>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setIsSubmitted(false)}
                className="text-sm text-teal-primary hover:text-teal-secondary transition-colors"
              >
                Try different email address
              </button>
              
              <Link
                href="/auth/login"
                className="text-sm text-sage/70 hover:text-sage transition-colors"
              >
                Back to sign in
              </Link>
            </div>
          </div>
        </motion.div>
      </GlassMorphism>
    )
  }

  return (
    <GlassMorphism variant="medium" className="p-8 max-w-md mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-heading font-semibold text-cream mb-2">
          Reset Password
        </h2>
        <p className="text-sage/70">
          Enter your email address and we'll send you a reset link
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-cream">
            Email Address
          </label>
          <input
            {...register('email')}
            type="email"
            id="email"
            autoComplete="email"
            placeholder="Enter your email"
            className={cn(
              'w-full px-4 py-3 rounded-lg',
              'bg-navy-50/20 border text-cream placeholder-sage/50',
              'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
              'transition-colors duration-200',
              errors.email ? 'border-red-error' : 'border-sage/20'
            )}
          />
          {errors.email && (
            <p className="text-sm text-red-error">{errors.email.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            'w-full px-6 py-3 rounded-lg font-medium transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
            'bg-gradient-to-r from-teal-primary to-teal-secondary text-cream',
            'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
            isSubmitting && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center gap-2">
              <LoadingSpinner size="sm" />
              <span>Sending reset email...</span>
            </div>
          ) : (
            'Send Reset Link'
          )}
        </button>
      </form>

      <div className="text-center mt-8">
        <Link
          href="/auth/login"
          className="text-sm text-sage/70 hover:text-sage transition-colors"
        >
          Back to sign in
        </Link>
      </div>
    </GlassMorphism>
  )
}
```

**Password Reset Confirmation:**
- **Given** secure password reset requirements
- **When** implementing reset confirmation
- **Then** create token validation and new password setting with comprehensive security measures

**Account Recovery Flow:**
- **Given** comprehensive account recovery needs
- **When** implementing recovery system
- **Then** include multiple recovery methods and fallback options

### Testing Requirements

**Password Reset Testing:**
- Email delivery testing (mocked)
- Token validation testing
- Password strength requirements validation
- Recovery flow completion testing

**Security Testing:**
- Token expiration handling
- Invalid token scenarios
- Rate limiting validation
- Recovery attempt logging

---

## Story F2.6: Multi-Factor Authentication (MFA) Interface

**User Story:** As a frontend developer, I want to implement a user-friendly multi-factor authentication interface with QR code setup, backup codes management, and recovery options that maintains security while providing excellent user experience.

**Assignee:** Frontend Developer Agent  
**Priority:** P1  
**Story Points:** 21  
**Sprint:** 3

### Detailed Acceptance Criteria

**MFA Setup Interface:**
- **Given** two-factor authentication setup requirements
- **When** implementing MFA configuration
- **Then** create comprehensive setup flow with QR codes, manual entry options, and verification steps

**MFA Verification Component:**
- **Given** authentication verification needs
- **When** implementing MFA verification
- **Then** create user-friendly code input with auto-advance, paste support, and clear error handling

**Backup Codes Management:**
- **Given** account recovery requirements
- **When** implementing backup codes
- **Then** provide secure generation, display, and usage tracking

### Testing Requirements

**MFA Testing:**
- QR code generation and scanning simulation
- Verification code validation testing
- Backup code functionality testing
- Recovery flow testing

**Security Testing:**
- TOTP algorithm validation
- Code reuse prevention testing
- Rate limiting on verification attempts

---

## Story F2.7: Business Owner Verification Interface

**User Story:** As a frontend developer, I want to create an intuitive business owner verification interface that guides users through the verification process with document upload, progress tracking, and status updates.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 18  
**Sprint:** 3

### Detailed Acceptance Criteria

**Business Verification Wizard:**
- **Given** business ownership verification requirements
- **When** implementing verification flow
- **Then** create step-by-step wizard with:
  - Business information validation
  - Document upload capabilities
  - Progress tracking and status updates
  - Verification result notifications

**Document Upload System:**
- **Given** document verification needs
- **When** implementing upload interface
- **Then** support multiple file formats, image compression, and upload progress

**Verification Status Dashboard:**
- **Given** verification tracking requirements
- **When** implementing status interface
- **Then** provide real-time updates and next steps guidance

### Testing Requirements

**Verification Testing:**
- Wizard flow completion testing
- Document upload validation
- Status update accuracy testing
- Error handling during verification

**Business Logic Testing:**
- Business matching algorithm testing
- Verification criteria validation
- Status transition testing

---

## Epic 2 Summary & Success Metrics

### Completion Criteria

**Technical Deliverables:**
- ✅ Comprehensive authentication form components with advanced validation
- ✅ Social authentication integration (Google, Apple, Facebook)
- ✅ Sophisticated loading states and user feedback systems
- ✅ Complete user profile and account management interface
- ✅ Secure password reset and account recovery flows
- ✅ Multi-factor authentication implementation
- ✅ Business owner verification system

**Security Standards:**
- All forms use secure validation with Zod schemas
- Social authentication follows OAuth 2.0 best practices
- Password requirements meet NIST guidelines
- MFA implementation uses TOTP standards
- All sensitive operations require re-authentication

**User Experience Standards:**
- Form validation provides real-time feedback
- Loading states inform users of progress
- Error messages are clear and actionable
- Accessibility standards (WCAG 2.1 AA) met
- Mobile-optimized interfaces across all components

**Performance Targets:**
- Form submission response time < 500ms
- Social authentication redirect < 2s
- Document upload progress tracking accuracy > 99%
- MFA verification response time < 200ms

**Testing Coverage:**
- Unit test coverage > 85% for all auth components
- Integration testing for all authentication flows
- Security penetration testing for auth endpoints
- Accessibility testing for all user interfaces
- Cross-browser compatibility validation

This comprehensive frontend Epic 2 establishes the complete authentication user interface system that seamlessly integrates with the backend authentication infrastructure while maintaining the premium user experience and security standards required for the business directory platform.

**File Path:** `/Users/michaellawless/Documents/Vibe/Repo/directory_v4/docs/planning/frontend-epic-2-stories.md`