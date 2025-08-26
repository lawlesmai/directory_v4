import { User } from '@supabase/supabase-js';

// Authentication provider types
export type AuthProvider = 'google' | 'apple' | 'facebook' | 'github';

// Authentication error types
export interface AuthError {
  message: string;
  status?: number;
  code?: string;
  details?: any;
}

// Authentication state
export type AuthState = 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'error';

// User profile types
export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string;
  avatar?: string;
  location?: {
    city?: string;
    state?: string;
    country: string;
  };
  businessType: 'customer' | 'business_owner' | 'service_provider' | 'other';
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: {
    email: boolean;
    push: boolean;
    marketing: boolean;
  };
  privacy: {
    profileVisible: boolean;
    allowDirectMessages: boolean;
  };
  accessibility: {
    reducedMotion: boolean;
    highContrast: boolean;
    largeText: boolean;
  };
}

// Authentication context type
export interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  state: AuthState;
  signIn: (
    email: string, 
    password: string, 
    options?: { rememberMe?: boolean; redirectTo?: string }
  ) => Promise<{ user: User | null; error: AuthError | null }>;
  signUp: (
    email: string, 
    password: string, 
    userData: Partial<UserProfile>
  ) => Promise<{ user: User | null; error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  signInWithProvider: (
    provider: AuthProvider,
    options?: { redirectTo?: string }
  ) => Promise<{ user: User | null; error: AuthError | null }>;
  sendMagicLink: (
    email: string,
    options?: { redirectTo?: string }
  ) => Promise<{ error: AuthError | null }>;
  sendPasswordReset: (email: string) => Promise<{ error: AuthError | null }>;
  resetPassword: (
    password: string,
    token: string
  ) => Promise<{ error: AuthError | null }>;
  verifyEmail: (token: string) => Promise<{ error: AuthError | null }>;
  resendVerification: () => Promise<{ error: AuthError | null }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: AuthError | null }>;
  deleteAccount: () => Promise<{ error: AuthError | null }>;
  refreshSession: () => Promise<{ error: AuthError | null }>;
}

// Form component props
export interface BaseFormProps {
  onSuccess?: (user: User) => void;
  onError?: (error: AuthError) => void;
  className?: string;
  disabled?: boolean;
}

export interface LoginFormProps extends BaseFormProps {
  redirectTo?: string;
  showSocialLogin?: boolean;
  showRememberMe?: boolean;
  showForgotPassword?: boolean;
  showSignUpLink?: boolean;
}

export interface RegisterFormProps extends BaseFormProps {
  redirectTo?: string;
  showSocialLogin?: boolean;
  initialStep?: number;
  onStepChange?: (step: number) => void;
}

export interface PasswordResetFormProps extends BaseFormProps {
  showBackToLogin?: boolean;
}

export interface SocialLoginButtonProps extends BaseFormProps {
  provider: AuthProvider;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

// Modal props
export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'login' | 'register' | 'forgot-password' | 'verify-email';
  onModeChange: (mode: AuthModalProps['mode']) => void;
  className?: string;
}

// Loading state types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface LoadingStateProps {
  state: LoadingState;
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Error display types
export interface ErrorDisplayProps {
  error: AuthError | string | null;
  onDismiss?: () => void;
  variant?: 'inline' | 'toast' | 'modal';
  className?: string;
}

// Field validation state
export type ValidationState = 'default' | 'success' | 'error' | 'warning';

export interface FormFieldProps {
  label: string;
  error?: string;
  success?: string;
  warning?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

// Password strength types
export interface PasswordStrengthProps {
  password: string;
  showRequirements?: boolean;
  className?: string;
}

export interface PasswordRequirement {
  label: string;
  met: boolean;
  icon: 'hash' | 'type' | 'key';
}

export interface PasswordStrengthResult {
  score: number;
  percentage: number;
  label: 'Weak' | 'Fair' | 'Good' | 'Strong';
  color: string;
  requirements: PasswordRequirement[];
}

// Registration step types
export type RegistrationStep = 1 | 2 | 3;

export interface RegistrationStepProps {
  currentStep: RegistrationStep;
  totalSteps: number;
  onNext?: () => void;
  onPrevious?: () => void;
  onComplete?: () => void;
  canProceed?: boolean;
}

// Social provider configuration
export interface SocialProviderConfig {
  name: string;
  icon: React.ComponentType<any>;
  bgColor: string;
  textColor: string;
  borderColor: string;
  hoverColor: string;
  focusRing: string;
  brandGuidelines?: {
    minimumWidth: number;
    cornerRadius: number;
    fontFamily: string;
    fontSize: string;
    fontWeight: string;
  };
}

// Animation variants for form elements
export interface AnimationVariants {
  initial: Record<string, any>;
  animate: Record<string, any>;
  exit: Record<string, any>;
  transition?: Record<string, any>;
}

// Accessibility props
export interface AccessibilityProps {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
  role?: string;
}

// Toast notification types
export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
  duration?: number;
  actions?: Array<{
    label: string;
    action: () => void;
    variant?: 'default' | 'destructive';
  }>;
}

// Form validation context
export interface FormValidationContext {
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
  setFieldError: (field: string, error: string) => void;
  clearFieldError: (field: string) => void;
  setFieldTouched: (field: string, touched: boolean) => void;
  clearAllErrors: () => void;
}

// Device and platform detection
export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  platform: 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'unknown';
  supportsWebAuthn: boolean;
  supportsTouchID: boolean;
  supportsFaceID: boolean;
}

// Security and compliance
export interface SecurityContext {
  sessionExpiry: Date;
  lastActivity: Date;
  deviceId: string;
  ipAddress: string;
  userAgent: string;
  isSecureContext: boolean;
  hasActiveSession: boolean;
}

// Feature flags for authentication
export interface AuthFeatureFlags {
  socialLogin: {
    google: boolean;
    apple: boolean;
    facebook: boolean;
    github: boolean;
  };
  magicLink: boolean;
  phoneAuth: boolean;
  webAuthn: boolean;
  twoFactor: boolean;
  passwordless: boolean;
  guestMode: boolean;
}

// Analytics events for authentication
export interface AuthAnalyticsEvent {
  event: 'auth_started' | 'auth_completed' | 'auth_failed' | 'social_auth_clicked' | 'form_validation_error';
  properties?: {
    provider?: AuthProvider;
    method?: 'email' | 'phone' | 'social' | 'magic_link';
    step?: number;
    error_code?: string;
    time_to_complete?: number;
  };
  timestamp: Date;
}

// Export all types for easy importing
export type {
  User
} from '@supabase/supabase-js';