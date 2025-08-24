# Story 2.5: Login & Session Management Implementation

**Epic:** Epic 2 - Authentication & Authorization Layer  
**Story ID:** 2.5  
**Story Points:** 17  
**Priority:** P0 (Critical Security Foundation)  
**Assignee:** Frontend Developer Agent  
**Sprint:** 2

## User Story

As a returning user, I want secure and convenient login options with reliable session management so that I can access my account safely and maintain my session across devices while having control over my active sessions.

## Story Overview

This story implements comprehensive login functionality with multiple authentication methods and robust session management. It includes device tracking, session security, cross-device synchronization, and user-friendly session controls.

## Detailed Acceptance Criteria

### Login Interface Implementation
- **Given** a returning user needing to authenticate
- **When** accessing the login interface
- **Then** provide multiple convenient authentication options:

**Standard Login Features:**
- Email and password form with real-time validation
- "Remember me" option for extended sessions (30 days)
- Loading states during authentication with progress feedback
- Clear error messages for failed attempts with specific guidance
- Account lockout notification after failed attempts
- Direct link to password reset functionality

**Alternative Login Methods:**
- Magic link login via email (passwordless authentication)
- Social login with Google OAuth integration
- Phone number login with SMS verification
- SSO preparation for future enterprise features
- Biometric authentication support (where available)

### Session Management System
- **Given** the need for secure session handling
- **When** managing user sessions
- **Then** implement comprehensive session features:

**Session Security Features:**
- Automatic session refresh before expiration
- Secure session token storage (httpOnly cookies)
- Device fingerprinting for security monitoring
- IP address change detection and verification
- Simultaneous session limits (5 active sessions per user)
- Remote session termination capability

**Session Persistence Options:**
- "Remember me" extending sessions to 30 days
- Cross-device session synchronization
- Graceful handling of expired sessions
- Automatic logout on suspicious activity
- Session activity logging and monitoring

### Login Component Implementation

```typescript
// components/auth/LoginInterface.tsx
interface LoginInterfaceProps {
  redirectTo?: string
  showSocialLogin?: boolean
  onSuccess?: (user: User) => void
  onError?: (error: AuthError) => void
}

export const LoginInterface: React.FC<LoginInterfaceProps> = ({
  redirectTo = '/dashboard',
  showSocialLogin = true,
  onSuccess,
  onError
}) => {
  const [loginMethod, setLoginMethod] = useState<'password' | 'magic' | 'phone'>('password')
  const [isLoading, setIsLoading] = useState(false)
  const [lastLoginAttempt, setLastLoginAttempt] = useState<Date | null>(null)
  const [failedAttempts, setFailedAttempts] = useState(0)
  
  const { signIn, signInWithMagicLink, signInWithPhone } = useAuth()
  const router = useRouter()

  const handlePasswordLogin = async (data: LoginFormData) => {
    setIsLoading(true)
    setLastLoginAttempt(new Date())
    
    try {
      const { user, error } = await signIn(data.email, data.password, {
        rememberMe: data.rememberMe,
        deviceInfo: {
          name: navigator.userAgent,
          type: /Mobile/.test(navigator.userAgent) ? 'mobile' : 'desktop',
          fingerprint: await generateDeviceFingerprint()
        }
      })
      
      if (error) {
        setFailedAttempts(prev => prev + 1)
        handleLoginError(error)
        onError?.(error)
      } else if (user) {
        setFailedAttempts(0)
        toast.success('Welcome back!')
        onSuccess?.(user)
        router.push(redirectTo)
      }
    } catch (error) {
      console.error('Login error:', error)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMagicLinkLogin = async (email: string) => {
    setIsLoading(true)
    
    try {
      const { error } = await signInWithMagicLink(email, {
        redirectTo: `${window.location.origin}/auth/callback?redirect_to=${encodeURIComponent(redirectTo)}`
      })
      
      if (error) {
        handleLoginError(error)
        onError?.(error)
      } else {
        toast.success('Check your email for the magic link!')
      }
    } catch (error) {
      console.error('Magic link error:', error)
      toast.error('Failed to send magic link. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLoginError = (error: AuthError) => {
    const errorMappings = {
      'Invalid login credentials': 'Invalid email or password. Please check your credentials and try again.',
      'Email not confirmed': 'Please verify your email address before signing in.',
      'Too many requests': 'Too many login attempts. Please wait a few minutes before trying again.',
      'Account locked': 'Your account has been temporarily locked for security. Please reset your password or contact support.',
      'User not found': 'No account found with this email address. Please check your email or create an account.',
      'Weak password': 'Your password needs to be updated for security. Please reset your password.',
    }
    
    const message = errorMappings[error.message] || 'Login failed. Please try again.'
    toast.error(message)
    
    // Show additional help for repeated failures
    if (failedAttempts >= 3) {
      toast.info('Having trouble? Try resetting your password or contact support.')
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <GlassMorphism variant="medium" className="p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-heading font-semibold text-cream mb-2">
            Welcome Back
          </h2>
          <p className="text-sage/70">
            Choose your preferred sign-in method
          </p>
        </div>

        {/* Login Method Selector */}
        <div className="flex bg-navy-50/20 rounded-lg p-1 mb-6">
          {[
            { id: 'password', label: 'Password', icon: <Key className="w-4 h-4" /> },
            { id: 'magic', label: 'Magic Link', icon: <Mail className="w-4 h-4" /> },
            { id: 'phone', label: 'SMS', icon: <Phone className="w-4 h-4" /> }
          ].map((method) => (
            <button
              key={method.id}
              onClick={() => setLoginMethod(method.id as any)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all',
                'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                loginMethod === method.id
                  ? 'bg-teal-primary text-cream shadow-sm'
                  : 'text-sage/70 hover:text-sage hover:bg-navy-50/20'
              )}
            >
              {method.icon}
              <span className="hidden sm:inline">{method.label}</span>
            </button>
          ))}
        </div>

        {/* Login Forms */}
        <AnimatePresence mode="wait">
          <motion.div
            key={loginMethod}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {loginMethod === 'password' && (
              <PasswordLoginForm
                onSubmit={handlePasswordLogin}
                isLoading={isLoading}
                failedAttempts={failedAttempts}
              />
            )}
            
            {loginMethod === 'magic' && (
              <MagicLinkForm
                onSubmit={handleMagicLinkLogin}
                isLoading={isLoading}
              />
            )}
            
            {loginMethod === 'phone' && (
              <PhoneLoginForm
                onSubmit={handlePhoneLogin}
                isLoading={isLoading}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Social Login */}
        {showSocialLogin && (
          <>
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-sage/20"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-navy-dark px-4 text-sage/70">Or continue with</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              <SocialLoginButton
                provider="google"
                onSuccess={onSuccess}
                onError={onError}
              />
              <SocialLoginButton
                provider="apple"
                onSuccess={onSuccess}
                onError={onError}
              />
            </div>
          </>
        )}

        {/* Additional Links */}
        <div className="text-center mt-8 space-y-3">
          <Link
            href="/auth/register"
            className="block text-sm text-sage/70 hover:text-sage transition-colors"
          >
            Don't have an account? <span className="text-teal-primary font-medium">Sign up</span>
          </Link>
          
          <Link
            href="/auth/forgot-password"
            className="block text-sm text-sage/70 hover:text-sage transition-colors"
          >
            Forgot your password?
          </Link>
        </div>
      </GlassMorphism>
    </div>
  )
}
```

### Multi-Device Session Management

```typescript
// components/auth/SessionManager.tsx
interface UserSession {
  id: string
  deviceName: string
  deviceType: 'mobile' | 'desktop' | 'tablet'
  location: string
  ipAddress: string
  lastActive: Date
  current: boolean
  trusted: boolean
}

export const SessionManager: React.FC = () => {
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  const { user } = useAuth()

  useEffect(() => {
    loadUserSessions()
  }, [])

  const loadUserSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', user?.id)
        .eq('active', true)
        .order('last_activity_at', { ascending: false })
      
      if (error) throw error
      
      const formattedSessions = data.map(session => ({
        id: session.id,
        deviceName: session.device_name || 'Unknown Device',
        deviceType: session.device_type,
        location: `${session.city || 'Unknown'}, ${session.country_code || 'Unknown'}`,
        ipAddress: session.ip_address,
        lastActive: new Date(session.last_activity_at),
        current: session.session_token === getCurrentSessionToken(),
        trusted: session.trusted
      }))
      
      setSessions(formattedSessions)
    } catch (error) {
      console.error('Error loading sessions:', error)
      toast.error('Failed to load sessions')
    } finally {
      setIsLoading(false)
    }
  }

  const terminateSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({
          revoked_at: new Date().toISOString(),
          revoke_reason: 'User terminated'
        })
        .eq('id', sessionId)
      
      if (error) throw error
      
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      toast.success('Session terminated successfully')
    } catch (error) {
      console.error('Error terminating session:', error)
      toast.error('Failed to terminate session')
    }
  }

  const terminateAllOtherSessions = async () => {
    try {
      const currentSessionToken = getCurrentSessionToken()
      
      const { error } = await supabase
        .from('user_sessions')
        .update({
          revoked_at: new Date().toISOString(),
          revoke_reason: 'User terminated all others'
        })
        .eq('user_id', user?.id)
        .neq('session_token', currentSessionToken)
      
      if (error) throw error
      
      setSessions(prev => prev.filter(s => s.current))
      toast.success('All other sessions terminated')
    } catch (error) {
      console.error('Error terminating sessions:', error)
      toast.error('Failed to terminate sessions')
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <GlassMorphism variant="medium" className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-heading text-cream">Active Sessions</h3>
          <p className="text-sm text-sage/70">
            Manage your account sessions across devices
          </p>
        </div>
        
        {sessions.length > 1 && (
          <button
            onClick={terminateAllOtherSessions}
            className="px-4 py-2 text-sm bg-red-error/20 hover:bg-red-error/30 text-red-error rounded-lg transition-colors"
          >
            End All Other Sessions
          </button>
        )}
      </div>

      <div className="space-y-4">
        {sessions.map((session) => (
          <motion.div
            key={session.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'p-4 rounded-lg border transition-all',
              session.current
                ? 'bg-teal-primary/10 border-teal-primary/30'
                : 'bg-navy-50/20 border-sage/20 hover:border-sage/30'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  session.current ? 'bg-teal-primary/20' : 'bg-sage/20'
                )}>
                  {session.deviceType === 'mobile' ? (
                    <Smartphone className="w-5 h-5 text-sage" />
                  ) : session.deviceType === 'tablet' ? (
                    <Tablet className="w-5 h-5 text-sage" />
                  ) : (
                    <Monitor className="w-5 h-5 text-sage" />
                  )}
                </div>
                
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-cream">
                      {session.deviceName}
                    </h4>
                    {session.current && (
                      <span className="px-2 py-1 text-xs bg-teal-primary/20 text-teal-primary rounded-full">
                        Current
                      </span>
                    )}
                    {session.trusted && (
                      <Shield className="w-4 h-4 text-sage" />
                    )}
                  </div>
                  <div className="text-sm text-sage/70">
                    {session.location} • Last active {formatRelativeTime(session.lastActive)}
                  </div>
                  <div className="text-xs text-sage/50">
                    {session.ipAddress}
                  </div>
                </div>
              </div>
              
              {!session.current && (
                <button
                  onClick={() => terminateSession(session.id)}
                  className="p-2 hover:bg-red-error/20 text-sage/70 hover:text-red-error rounded-lg transition-colors"
                  title="Terminate session"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
      
      {sessions.length === 0 && (
        <div className="text-center py-8">
          <Shield className="w-12 h-12 text-sage/30 mx-auto mb-3" />
          <p className="text-sage/70">No active sessions found</p>
        </div>
      )}
    </GlassMorphism>
  )
}
```

### Session Security Features

**Device Trust Scoring:**
```typescript
// utils/deviceTrust.ts
export const calculateDeviceTrustScore = (deviceData: DeviceInfo): number => {
  let score = 0.5 // Base score
  
  // Location consistency
  if (deviceData.previousLocations?.length > 0) {
    const locationConsistency = calculateLocationConsistency(deviceData.previousLocations)
    score += locationConsistency * 0.2
  }
  
  // Usage patterns
  if (deviceData.usageFrequency === 'daily') {
    score += 0.2
  } else if (deviceData.usageFrequency === 'weekly') {
    score += 0.1
  }
  
  // Time since first use
  const daysSinceFirstUse = (Date.now() - deviceData.firstSeen.getTime()) / (1000 * 60 * 60 * 24)
  score += Math.min(daysSinceFirstUse / 30, 0.2) // Up to 0.2 for 30+ days
  
  // Security indicators
  if (deviceData.hasSecureConnection) score += 0.1
  if (deviceData.biometricEnabled) score += 0.1
  if (deviceData.hasRecentSecurityUpdate) score += 0.05
  
  // Risk factors
  if (deviceData.hasBeenCompromised) score -= 0.5
  if (deviceData.unusualActivityDetected) score -= 0.2
  
  return Math.max(0, Math.min(1, score))
}

export const shouldRequireMFA = (trustScore: number, riskFactors: RiskFactor[]): boolean => {
  if (trustScore < 0.3) return true
  if (riskFactors.some(factor => factor.severity === 'high')) return true
  if (riskFactors.filter(factor => factor.severity === 'medium').length >= 2) return true
  
  return false
}
```

## Technical Implementation Notes

### Session Storage Strategy
- Use Supabase session management with custom enhancements
- Implement secure cookie-based session storage
- Add Redis for session data caching (if needed)
- Create session synchronization mechanisms

### Security Implementation
- CSRF protection for all authenticated requests
- Rate limiting for login attempts
- Suspicious activity detection and alerts
- Session hijacking prevention measures

### Performance Optimization
- Minimize authentication checks where possible
- Cache session data appropriately
- Optimize token refresh timing
- Implement efficient session cleanup

## Dependencies
- Story 2.3 (Authentication UI components)
- Story 2.2 (Auth middleware and server components)
- Session management infrastructure
- Device fingerprinting capabilities

## Testing Requirements

### Login Functionality Tests
- All login method validation tests
- Session creation and persistence tests
- Multi-device login scenario tests
- Error handling and recovery tests
- Social login integration tests

### Security Tests
- Session hijacking prevention tests
- CSRF protection validation
- Rate limiting functionality tests
- Suspicious activity detection tests
- Device trust scoring accuracy

### Performance Tests
- Login response time measurements
- Session management performance tests
- Multi-device synchronization tests
- Memory usage during session handling
- Token refresh timing optimization

### User Experience Tests
- Login flow completion testing
- Session management interface usability
- Error message clarity and helpfulness
- Multi-device experience validation

## Definition of Done

### Login Implementation
- [ ] All login methods implemented and functional (password, magic link, phone, social)
- [ ] Real-time form validation with helpful error messages
- [ ] Loading states and progress feedback for all authentication methods
- [ ] Account lockout protection and user notifications
- [ ] "Remember me" functionality with extended session duration

### Session Management
- [ ] Secure session management with automatic refresh
- [ ] Multi-device session synchronization working reliably
- [ ] Device tracking and trust scoring implemented
- [ ] Session termination capabilities (individual and bulk)
- [ ] Cross-device session activity monitoring

### Security Features
- [ ] Session security measures active and tested
- [ ] Device fingerprinting for anomaly detection
- [ ] IP address monitoring and suspicious activity alerts
- [ ] CSRF protection implementation
- [ ] Rate limiting for authentication attempts

### User Experience
- [ ] Intuitive session management interface
- [ ] Clear session status and device information
- [ ] Smooth login experience across all methods
- [ ] Helpful error recovery guidance
- [ ] Mobile-optimized authentication flows

### Performance & Reliability
- [ ] Performance optimization for session operations (< 50ms response time)
- [ ] Session persistence across browser restarts
- [ ] Graceful handling of network interruptions
- [ ] Efficient memory usage during session management

### Testing Coverage
- [ ] All login methods tested with various scenarios
- [ ] Session management functionality thoroughly tested
- [ ] Security tests passing for all authentication flows
- [ ] Cross-browser and cross-device compatibility validated
- [ ] Load testing for concurrent session management

### Documentation
- [ ] Login flow documentation for users and developers
- [ ] Session management best practices guide
- [ ] Security implementation documentation
- [ ] Troubleshooting guide for authentication issues

## Acceptance Validation

### Login Success Metrics
- [ ] Login success rate > 98% for valid credentials
- [ ] Average login time < 2 seconds across all methods
- [ ] Social login completion rate > 95%
- [ ] Magic link delivery success rate > 98%
- [ ] User satisfaction with login experience > 4.5/5

### Session Management Metrics
- [ ] Session synchronization success rate > 99%
- [ ] Device trust scoring accuracy > 95%
- [ ] Session termination response time < 500ms
- [ ] Multi-device experience consistency > 98%
- [ ] Suspicious activity detection accuracy > 90%

### Security Metrics
- [ ] Zero successful session hijacking attempts
- [ ] Account takeover prevention effectiveness 100%
- [ ] Rate limiting blocking 100% of brute force attempts
- [ ] CSRF attack prevention 100%
- [ ] Device anomaly detection false positive rate < 5%

## Risk Assessment

**Medium Risk:** Complex session synchronization across devices may introduce latency
- *Mitigation:* Efficient caching strategies and optimized synchronization algorithms

**Medium Risk:** Device fingerprinting may impact privacy-conscious users
- *Mitigation:* Clear privacy policy and opt-out options for enhanced tracking

**Low Risk:** Multiple login methods may confuse some users
- *Mitigation:* Clear UI design and user education through onboarding

**Low Risk:** Session management complexity affecting performance
- *Mitigation:* Performance monitoring and optimization throughout development

## Success Metrics

- **Security:** Zero authentication bypass vulnerabilities
- **Performance:** Login response time < 2 seconds (P95)
- **Reliability:** Session management uptime > 99.9%
- **User Experience:** Login completion rate > 95%
- **Device Management:** Multi-device session accuracy > 99%

This story establishes comprehensive login and session management capabilities that provide users with secure, convenient, and reliable authentication while maintaining enterprise-grade security standards across all devices and platforms.