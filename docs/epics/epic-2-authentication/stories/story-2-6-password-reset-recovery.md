# Story 2.6: Password Reset & Account Recovery

**Epic:** Epic 2 - Authentication & Authorization Layer  
**Story ID:** 2.6  
**Story Points:** 13  
**Priority:** P1 (High Security Priority)  
**Assignee:** Frontend Developer Agent  
**Sprint:** 2

## User Story

As a user who has forgotten my password or lost access to my account, I want secure and user-friendly recovery options so that I can regain access to my account safely while maintaining account security.

## Story Overview

This story implements a comprehensive password reset and account recovery system with multiple recovery methods, secure token validation, progress tracking, and user-friendly recovery flows that maintain security while providing excellent user experience.

## Detailed Acceptance Criteria

### Password Reset Flow
- **Given** a user who has forgotten their password
- **When** initiating password reset
- **Then** provide a secure recovery process:

**Reset Initiation:**
- Password reset request form with email input validation
- Email validation and user existence verification
- Rate limiting to prevent abuse (3 attempts per hour)
- Clear instructions sent via branded email template
- Alternative contact options if email is unavailable
- Progress tracking throughout the reset process

**Reset Email System:**
- Secure reset token generation with 1-hour expiration
- Branded email template with clear instructions and security tips
- Reset link with single-use tokens for enhanced security
- Mobile-friendly email design with accessibility considerations
- Fallback instructions for email access issues
- Multiple language support for email templates

**Password Reset Completion:**
- Secure password reset page with token validation
- New password creation with strength requirements
- Password confirmation validation with real-time feedback
- Automatic login after successful reset
- Security notification email to confirm password change
- Account security recommendations post-reset

### Account Recovery Options
- **Given** users with various access issues
- **When** they need account recovery
- **Then** provide multiple recovery paths:

**Email-Based Recovery:**
- Primary email address recovery with verification
- Secondary email address options for backup recovery
- Email address change verification process
- Recovery email setup encouragement during onboarding

**Phone-Based Recovery:**
- SMS verification for phone-verified accounts
- Phone number update process with security checks
- Backup phone number options for redundancy
- Voice call fallback for SMS delivery issues

**Alternative Recovery Methods:**
- Security question recovery (future enhancement)
- Account recovery through customer support
- Identity verification for high-value accounts
- Social recovery through trusted contacts (future)

### Password Reset Request Implementation

```typescript
// components/auth/PasswordResetRequest.tsx
const resetRequestSchema = z.object({
  email: z.string().email('Please enter a valid email address')
})

interface ResetRequestState {
  step: 'request' | 'sent' | 'expired' | 'error'
  email: string
  attemptCount: number
  lastAttempt: Date | null
}

export const PasswordResetRequest: React.FC = () => {
  const [state, setState] = useState<ResetRequestState>({
    step: 'request',
    email: '',
    attemptCount: 0,
    lastAttempt: null
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { register, handleSubmit, formState: { errors }, watch } = useForm({
    resolver: zodResolver(resetRequestSchema)
  })

  const watchedEmail = watch('email')

  const onSubmit = async (data: { email: string }) => {
    // Rate limiting check
    if (state.attemptCount >= 3 && state.lastAttempt) {
      const timeSinceLastAttempt = Date.now() - state.lastAttempt.getTime()
      if (timeSinceLastAttempt < 3600000) { // 1 hour
        toast.error('Too many reset attempts. Please wait an hour before trying again.')
        return
      }
    }

    setIsSubmitting(true)
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      })
      
      if (error) {
        setState(prev => ({
          ...prev,
          step: 'error',
          attemptCount: prev.attemptCount + 1,
          lastAttempt: new Date()
        }))
        toast.error('Failed to send reset email. Please try again or contact support.')
      } else {
        setState(prev => ({
          ...prev,
          step: 'sent',
          email: data.email,
          attemptCount: prev.attemptCount + 1,
          lastAttempt: new Date()
        }))
        
        // Track analytics
        trackEvent('password_reset_requested', {
          email_domain: data.email.split('@')[1]
        })
      }
    } catch (error) {
      console.error('Password reset error:', error)
      setState(prev => ({
        ...prev,
        step: 'error',
        attemptCount: prev.attemptCount + 1,
        lastAttempt: new Date()
      }))
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resendResetEmail = async () => {
    if (state.email) {
      await onSubmit({ email: state.email })
    }
  }

  if (state.step === 'sent') {
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
            <p className="text-cream font-medium mt-1 break-all">{state.email}</p>
          </div>
          
          <div className="p-4 bg-navy-50/20 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-teal-primary mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm text-cream font-medium mb-1">
                  Reset link expires in 1 hour
                </p>
                <p className="text-xs text-sage/70">
                  For security, this link can only be used once and expires quickly.
                </p>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <p className="text-sm text-sage/60">
              Didn't receive the email? Check your spam folder or try the options below.
            </p>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={resendResetEmail}
                disabled={isSubmitting}
                className="px-4 py-2 bg-teal-primary/20 hover:bg-teal-primary/30 text-teal-primary rounded-lg transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Sending...' : 'Resend email'}
              </button>
              
              <button
                onClick={() => setState(prev => ({ ...prev, step: 'request' }))}
                className="text-sm text-sage/70 hover:text-sage transition-colors"
              >
                Try different email address
              </button>
              
              <Link
                href="/auth/login"
                className="text-sm text-sage/70 hover:text-sage transition-colors"
              >
                Back to sign in
              </Link>
              
              <Link
                href="/contact"
                className="text-sm text-teal-primary hover:text-teal-secondary transition-colors"
              >
                Contact support
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
          Enter your email address and we'll send you a secure reset link
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
            placeholder="Enter your email address"
            className={cn(
              'w-full px-4 py-3 rounded-lg',
              'bg-navy-50/20 border text-cream placeholder-sage/50',
              'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
              'transition-colors duration-200',
              errors.email ? 'border-red-error' : 'border-sage/20'
            )}
          />
          {errors.email && (
            <p className="text-sm text-red-error flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {errors.email.message}
            </p>
          )}
        </div>

        {state.attemptCount > 0 && (
          <div className="p-3 bg-gold-primary/10 border border-gold-primary/20 rounded-lg">
            <p className="text-sm text-gold-primary">
              Reset attempts: {state.attemptCount}/3
              {state.attemptCount >= 3 && ' (Rate limited for 1 hour)'}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || (state.attemptCount >= 3 && state.lastAttempt && Date.now() - state.lastAttempt.getTime() < 3600000)}
          className={cn(
            'w-full px-6 py-3 rounded-lg font-medium transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
            'bg-gradient-to-r from-teal-primary to-teal-secondary text-cream',
            'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
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

      <div className="text-center mt-8 space-y-3">
        <Link
          href="/auth/login"
          className="block text-sm text-sage/70 hover:text-sage transition-colors"
        >
          Remember your password? Sign in
        </Link>
        
        <Link
          href="/contact"
          className="block text-sm text-teal-primary hover:text-teal-secondary transition-colors"
        >
          Need help? Contact support
        </Link>
      </div>
    </GlassMorphism>
  )
}
```

### Password Reset Confirmation

```typescript
// components/auth/PasswordResetConfirm.tsx
const resetConfirmSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/(?=.*[a-z])/, 'Password must contain a lowercase letter')
    .regex(/(?=.*[A-Z])/, 'Password must contain an uppercase letter')
    .regex(/(?=.*\d)/, 'Password must contain a number')
    .regex(/(?=.*[@$!%*?&])/, 'Password must contain a special character'),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
})

export const PasswordResetConfirm: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const accessToken = searchParams.get('access_token')
  const refreshToken = searchParams.get('refresh_token')

  const { register, handleSubmit, formState: { errors, isValid }, watch } = useForm({
    resolver: zodResolver(resetConfirmSchema),
    mode: 'onChange'
  })

  const watchedPassword = watch('password')

  useEffect(() => {
    validateResetToken()
  }, [])

  const validateResetToken = async () => {
    if (!accessToken || !refreshToken) {
      setTokenValid(false)
      return
    }

    try {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      })
      
      setTokenValid(!error)
    } catch {
      setTokenValid(false)
    }
  }

  const onSubmit = async (data: { password: string; confirmPassword: string }) => {
    if (!tokenValid) return
    
    setIsSubmitting(true)
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password
      })
      
      if (error) {
        toast.error('Failed to update password. Please try again.')
      } else {
        // Send security notification email
        await sendSecurityNotification('password_changed')
        
        toast.success('Password updated successfully! You are now logged in.')
        
        // Track analytics
        trackEvent('password_reset_completed')
        
        // Redirect to dashboard
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Password update error:', error)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (tokenValid === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-dark via-teal-primary to-navy-dark flex items-center justify-center p-4">
        <GlassMorphism variant="medium" className="p-8 text-center">
          <LoadingSpinner size="lg" />
          <p className="text-sage/70 mt-4">Validating reset link...</p>
        </GlassMorphism>
      </div>
    )
  }

  if (tokenValid === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-dark via-teal-primary to-navy-dark flex items-center justify-center p-4">
        <GlassMorphism variant="medium" className="p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-red-error/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-error" />
          </div>
          
          <h2 className="text-xl font-heading font-semibold text-cream mb-2">
            Invalid Reset Link
          </h2>
          <p className="text-sage/70 mb-6">
            This password reset link is invalid or has expired. Reset links expire after 1 hour for security.
          </p>
          
          <div className="space-y-3">
            <Link
              href="/auth/forgot-password"
              className="block w-full px-6 py-3 bg-teal-primary hover:bg-teal-secondary text-cream rounded-lg transition-colors"
            >
              Request New Reset Link
            </Link>
            
            <Link
              href="/auth/login"
              className="block text-sm text-sage/70 hover:text-sage transition-colors"
            >
              Back to Sign In
            </Link>
          </div>
        </GlassMorphism>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-dark via-teal-primary to-navy-dark flex items-center justify-center p-4">
      <GlassMorphism variant="medium" className="p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-teal-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Key className="w-8 h-8 text-teal-primary" />
          </div>
          
          <h2 className="text-2xl font-heading font-semibold text-cream mb-2">
            Create New Password
          </h2>
          <p className="text-sage/70">
            Choose a strong password for your account
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* New Password Field */}
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-cream">
              New Password
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
              Confirm New Password
            </label>
            <div className="relative">
              <input
                {...register('confirmPassword')}
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                autoComplete="new-password"
                placeholder="Re-enter your new password"
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

          {/* Security Tips */}
          <div className="p-4 bg-teal-primary/10 border border-teal-primary/20 rounded-lg">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-teal-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-cream font-medium mb-2">Security Tips</p>
                <ul className="text-xs text-sage/70 space-y-1">
                  <li>• Use a unique password you haven't used elsewhere</li>
                  <li>• Consider using a password manager</li>
                  <li>• Enable two-factor authentication for extra security</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className={cn(
              'w-full px-6 py-3 rounded-lg font-medium transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
              isValid && !isSubmitting
                ? 'bg-gradient-to-r from-teal-primary to-teal-secondary text-cream hover:shadow-lg hover:scale-[1.02]'
                : 'bg-navy-50/20 text-sage/50 cursor-not-allowed'
            )}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center gap-2">
                <LoadingSpinner size="sm" />
                <span>Updating password...</span>
              </div>
            ) : (
              'Update Password & Sign In'
            )}
          </button>
        </form>
      </GlassMorphism>
    </div>
  )
}
```

## Technical Implementation Notes

### Security Implementation
- Cryptographically secure token generation with short expiration times
- Single-use tokens to prevent replay attacks
- Rate limiting and abuse prevention mechanisms
- Comprehensive audit logging for all recovery attempts

### Email Integration
- Custom branded email templates with mobile-responsive design
- Email delivery monitoring and fallback mechanisms
- Support for multiple email providers and delivery channels
- Email verification for recovery method changes

### User Experience Optimization
- Clear error messages with actionable guidance
- Progress indication throughout the recovery process
- Mobile-optimized recovery flows with touch-friendly interfaces
- Accessibility compliance for screen readers and keyboard navigation

## Dependencies
- Story 2.3 (Authentication UI components)
- Story 2.1 (Email system configuration)
- Email service provider setup and templates
- Security token generation and validation system

## Testing Requirements

### Recovery Flow Tests
- Complete password reset process validation
- Token security and expiration testing
- Rate limiting and abuse prevention validation
- Email delivery and template rendering tests
- Multi-device recovery flow testing

### Security Tests
- Token generation and validation security audit
- Recovery process vulnerability assessment
- Rate limiting effectiveness validation
- Audit logging accuracy and completeness tests
- Prevention of password reset bypass attempts

### User Experience Tests
- Recovery flow usability testing across devices
- Error handling and user guidance effectiveness
- Accessibility compliance validation for all flows
- Performance testing for email delivery and page loading

## Definition of Done

### Password Reset Implementation
- [ ] Password reset flow complete and secure with token validation
- [ ] Email-based recovery system functional with branded templates
- [ ] Rate limiting and abuse prevention active and tested
- [ ] Security token system properly implemented with expiration
- [ ] Password strength validation with real-time feedback

### Account Recovery Features
- [ ] Multiple recovery method support (email, phone, support)
- [ ] Recovery method verification and security checks
- [ ] Fallback options for delivery failures
- [ ] Security notifications for account changes
- [ ] User education about account security

### User Experience
- [ ] Mobile-friendly recovery interface with responsive design
- [ ] Clear progress indication and status updates
- [ ] Helpful error messages with recovery guidance
- [ ] Accessibility compliance for all recovery flows
- [ ] Performance optimization for quick recovery completion

### Security & Compliance
- [ ] Comprehensive audit logging for all recovery events
- [ ] Token security preventing replay and timing attacks
- [ ] Rate limiting preventing automated abuse
- [ ] Security best practices in recovery communications
- [ ] Privacy compliance for recovery data handling

### Testing Coverage
- [ ] All recovery methods tested with various scenarios
- [ ] Security penetration testing for reset vulnerabilities
- [ ] User experience testing with positive feedback
- [ ] Performance testing for email delivery and page loading
- [ ] Cross-browser and device compatibility validation

### Documentation
- [ ] Password reset flow documentation for users
- [ ] Security implementation guide for developers
- [ ] Recovery troubleshooting guide for support
- [ ] Email template customization documentation

## Acceptance Validation

### Recovery Success Metrics
- [ ] Password reset completion rate > 90%
- [ ] Email delivery success rate > 98%
- [ ] Token validation accuracy 100%
- [ ] User recovery satisfaction score > 4.0/5
- [ ] Average recovery completion time < 5 minutes

### Security Validation
- [ ] Zero successful recovery bypass attempts
- [ ] Token security audit passed with no vulnerabilities
- [ ] Rate limiting blocks 100% of abuse attempts
- [ ] Recovery audit log completeness 100%
- [ ] Privacy compliance verification passed

### Performance Metrics
- [ ] Password reset page load time < 2 seconds
- [ ] Email delivery time < 30 seconds (95th percentile)
- [ ] Token validation response time < 100ms
- [ ] Recovery form submission time < 500ms
- [ ] Mobile recovery experience optimized

## Risk Assessment

**Medium Risk:** Email deliverability affecting recovery success rates
- *Mitigation:* Multiple email providers, delivery monitoring, and alternative recovery methods

**Medium Risk:** Security vulnerabilities in password reset token handling
- *Mitigation:* Comprehensive security testing, short token lifespans, and single-use tokens

**Low Risk:** User confusion during recovery process
- *Mitigation:* Clear UI design, helpful error messages, and user testing

**Low Risk:** Recovery process abuse and spam
- *Mitigation:* Rate limiting, abuse detection, and account lockout mechanisms

## Success Metrics

- **Recovery Success:** Password reset completion rate > 90%
- **Security:** Zero successful recovery bypass attempts
- **User Experience:** Recovery satisfaction score > 4.0/5
- **Performance:** Email delivery success rate > 98%
- **Support Reduction:** Account recovery support tickets < 5% of users

This story provides users with secure, reliable, and user-friendly account recovery options while maintaining the highest security standards to protect user accounts from unauthorized access attempts.