// Authentication Context and Hooks
export { AuthProvider, useAuth, useAuthState, useUser, useSession } from '@/contexts/AuthContext';

// Components
export { default as AuthModal, useAuthModal } from './AuthModal';
export { default as LoginForm } from './LoginForm';
export { default as RegisterForm } from './RegisterForm';
export { default as ProtectedRoute, withProtectedRoute } from './ProtectedRoute';
export { 
  default as RequireRole, 
  useRoleCheck, 
  withRoleCheck,
  RequireAuthentication,
  RequireAdmin,
  RequireSuperAdmin,
  RequireBusinessOwner,
  RequireServiceProvider,
  RoleBasedContent
} from './RequireRole';
export { default as AuthLayout } from './AuthLayout';
export { 
  default as UserProfileButton, 
  QuickProfileButton 
} from './UserProfileButton';
export { 
  default as AuthStatus,
  FloatingAuthStatus,
  AuthStatusBadge 
} from './AuthStatus';
export { 
  default as SessionManager,
  SessionStatus 
} from './SessionManager';
export { 
  AuthErrorBoundary,
  AuthErrorType,
  useAuthErrorHandler 
} from './AuthErrorBoundary';

// Enhanced Social Authentication Components
export { 
  SocialLoginButton,
  SocialLoginGroup,
  SocialLoginDivider,
  SocialLoginIconButton 
} from './SocialLoginButton';
export { 
  OAuthCallback, 
  OAuthCallbackPage, 
  useOAuthCallback 
} from './OAuthCallback';
export { 
  AccountLinking, 
  AccountLinkingWidget 
} from './AccountLinking';
export { SocialProfileSync } from './SocialProfileSync';
export { 
  SocialAuthModal, 
  useSocialAuthModal 
} from './SocialAuthModal';
export { 
  ProviderSelection, 
  QuickProviderSelect 
} from './ProviderSelection';
export { 
  OAuthErrorBoundary, 
  DefaultOAuthErrorFallback,
  useOAuthErrorHandler 
} from './OAuthErrorBoundary';
export { 
  LoadingState,
  LoadingSpinner,
  LoadingDots,
  LoadingPulse,
  ProgressBar,
  ButtonWithLoading,
  FormFieldSkeleton,
  LoadingOverlay,
  StepProgress
} from './LoadingStates';
export { 
  FieldError,
  AuthError,
  ErrorAlert 
} from './ErrorMessages';
export { 
  default as PasswordStrength,
  PasswordStrengthCompact,
  PasswordStrengthWithTips
} from './PasswordStrength';
export { default as MobileAuthSheet } from './MobileAuthSheet';

// Password Management Components
export { default as PasswordChangeForm } from './PasswordChangeForm';
export { default as PasswordResetFlow } from './PasswordResetFlow';

// Security Management Components
export { default as SecurityDashboard } from './SecurityDashboard';
export { default as AccountRecovery } from './AccountRecovery';
export { 
  default as SecurityNotifications,
  InlineSecurityNotification,
  SecurityActivity
} from './SecurityNotifications';

// Utilities and Types
export * from './types';
export * from './validations';
export { 
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  type Permission,
  type UserRole 
} from './ProtectedRoute';

// Re-export Supabase client for convenience
export { createClient } from '@/lib/supabase/client';