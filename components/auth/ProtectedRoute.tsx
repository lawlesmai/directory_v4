'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth, useAuthState } from '@/contexts/AuthContext';
import { GlassMorphism } from '@/components/GlassMorphism';
import { cn } from '@/lib/utils';
import type { UserProfile } from '@/components/auth/types';

// Permission types
export type Permission = 
  | 'read:businesses' 
  | 'write:businesses' 
  | 'read:reviews' 
  | 'write:reviews'
  | 'admin:users'
  | 'admin:content'
  | 'admin:system';

export type UserRole = 'customer' | 'business_owner' | 'service_provider' | 'admin' | 'super_admin';

// Role-based permissions mapping
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  customer: ['read:businesses', 'read:reviews', 'write:reviews'],
  business_owner: ['read:businesses', 'write:businesses', 'read:reviews', 'write:reviews'],
  service_provider: ['read:businesses', 'write:businesses', 'read:reviews', 'write:reviews'],
  admin: [
    'read:businesses', 'write:businesses', 'read:reviews', 'write:reviews',
    'admin:users', 'admin:content'
  ],
  super_admin: [
    'read:businesses', 'write:businesses', 'read:reviews', 'write:reviews',
    'admin:users', 'admin:content', 'admin:system'
  ]
};

// Get user role from profile
const getUserRole = (profile: UserProfile | null): UserRole => {
  if (!profile) return 'customer';
  
  // Check for admin roles first
  if (profile.email?.endsWith('@lawless.directory')) {
    return profile.businessType === 'admin' ? 'super_admin' : 'admin';
  }
  
  return profile.businessType as UserRole || 'customer';
};

// Check if user has permission
export const hasPermission = (profile: UserProfile | null, permission: Permission): boolean => {
  const role = getUserRole(profile);
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
};

// Check if user has any of the required permissions
export const hasAnyPermission = (profile: UserProfile | null, permissions: Permission[]): boolean => {
  return permissions.some(permission => hasPermission(profile, permission));
};

// Check if user has all required permissions
export const hasAllPermissions = (profile: UserProfile | null, permissions: Permission[]): boolean => {
  return permissions.every(permission => hasPermission(profile, permission));
};

// Protected Route Props
export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermissions?: Permission[];
  requireAll?: boolean; // true = all permissions required, false = any permission required
  fallbackComponent?: React.ReactNode;
  redirectTo?: string;
  showLoadingState?: boolean;
  className?: string;
}

// Loading component
const AuthLoadingState: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('min-h-screen flex items-center justify-center', className)}>
    <GlassMorphism variant="medium" className="p-8 max-w-md mx-4">
      <div className="text-center space-y-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 mx-auto"
        >
          <Loader2 className="w-12 h-12 text-teal-primary" />
        </motion.div>
        <h3 className="text-lg font-semibold text-cream">Verifying Access</h3>
        <p className="text-sage/70 text-sm">Please wait while we verify your authentication...</p>
      </div>
    </GlassMorphism>
  </div>
);

// Unauthorized access component
const UnauthorizedAccess: React.FC<{ 
  requiredPermissions?: Permission[];
  className?: string;
  onRetry?: () => void;
}> = ({ requiredPermissions, className, onRetry }) => (
  <div className={cn('min-h-screen flex items-center justify-center', className)}>
    <GlassMorphism variant="medium" className="p-8 max-w-md mx-4">
      <div className="text-center space-y-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="w-16 h-16 mx-auto bg-red-error/10 rounded-full flex items-center justify-center"
        >
          <Lock className="w-8 h-8 text-red-error" />
        </motion.div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-cream">Access Denied</h3>
          <p className="text-sage/70">
            You don't have the required permissions to access this page.
          </p>
        </div>

        {requiredPermissions && requiredPermissions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-sage/50 uppercase font-medium">Required Permissions:</p>
            <div className="space-y-1">
              {requiredPermissions.map((permission) => (
                <div
                  key={permission}
                  className="flex items-center gap-2 text-sm text-sage/70 bg-navy-dark/30 rounded-lg px-3 py-2"
                >
                  <Shield className="w-3 h-3" />
                  {permission.replace(/_/g, ' ').replace(/:/g, ' → ')}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => window.history.back()}
            className="flex-1 px-4 py-2 text-sage/70 hover:text-cream transition-colors rounded-lg border border-sage/20 hover:border-sage/40"
          >
            Go Back
          </button>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex-1 px-4 py-2 bg-teal-primary hover:bg-teal-secondary text-cream rounded-lg transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </GlassMorphism>
  </div>
);

// Unauthenticated component
const UnauthenticatedState: React.FC<{
  className?: string;
  onSignIn?: () => void;
}> = ({ className, onSignIn }) => (
  <div className={cn('min-h-screen flex items-center justify-center', className)}>
    <GlassMorphism variant="medium" className="p-8 max-w-md mx-4">
      <div className="text-center space-y-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="w-16 h-16 mx-auto bg-teal-primary/10 rounded-full flex items-center justify-center"
        >
          <AlertCircle className="w-8 h-8 text-teal-primary" />
        </motion.div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-cream">Authentication Required</h3>
          <p className="text-sage/70">
            Please sign in to access this page.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => window.history.back()}
            className="flex-1 px-4 py-2 text-sage/70 hover:text-cream transition-colors rounded-lg border border-sage/20 hover:border-sage/40"
          >
            Go Back
          </button>
          <button
            onClick={onSignIn}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-teal-primary to-teal-secondary text-cream rounded-lg transition-colors hover:shadow-lg"
          >
            Sign In
          </button>
        </div>
      </div>
    </GlassMorphism>
  </div>
);

// Main ProtectedRoute component
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermissions = [],
  requireAll = false,
  fallbackComponent,
  redirectTo,
  showLoadingState = true,
  className = ''
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, isAuthenticated, user } = useAuthState();
  const { profile } = useAuth();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  // Handle redirect after auth check
  useEffect(() => {
    if (shouldRedirect && redirectTo) {
      const currentPath = window.location.pathname + window.location.search;
      const redirectUrl = redirectTo.includes('?') 
        ? `${redirectTo}&returnTo=${encodeURIComponent(currentPath)}`
        : `${redirectTo}?returnTo=${encodeURIComponent(currentPath)}`;
      
      router.push(redirectUrl);
    }
  }, [shouldRedirect, redirectTo, router]);

  // Loading state
  if (state === 'loading' || state === 'idle') {
    return showLoadingState ? <AuthLoadingState className={className} /> : null;
  }

  // Error state
  if (state === 'error') {
    return (
      <UnauthorizedAccess
        requiredPermissions={requiredPermissions}
        className={className}
        onRetry={() => window.location.reload()}
      />
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    if (redirectTo && !shouldRedirect) {
      setShouldRedirect(true);
      return showLoadingState ? <AuthLoadingState className={className} /> : null;
    }

    return fallbackComponent || (
      <UnauthenticatedState 
        className={className}
        onSignIn={() => {
          const currentPath = window.location.pathname + window.location.search;
          router.push(`/auth/login?returnTo=${encodeURIComponent(currentPath)}`);
        }}
      />
    );
  }

  // Check permissions if required
  if (requiredPermissions.length > 0) {
    const hasRequiredPermission = requireAll
      ? hasAllPermissions(profile, requiredPermissions)
      : hasAnyPermission(profile, requiredPermissions);

    if (!hasRequiredPermission) {
      return fallbackComponent || (
        <UnauthorizedAccess
          requiredPermissions={requiredPermissions}
          className={className}
        />
      );
    }
  }

  // Render children if all checks pass
  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

// Higher-order component for protecting routes
export const withProtectedRoute = <P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<ProtectedRouteProps, 'children'>
) => {
  const ProtectedComponent: React.FC<P> = (props) => (
    <ProtectedRoute {...options}>
      <Component {...props} />
    </ProtectedRoute>
  );

  ProtectedComponent.displayName = `withProtectedRoute(${Component.displayName || Component.name})`;
  
  return ProtectedComponent;
};

export default ProtectedRoute;