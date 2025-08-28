'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { 
  hasPermission, 
  hasAnyPermission, 
  hasAllPermissions,
  getUserRole as getProfileUserRole,
  type Permission,
  type UserRole
} from './ProtectedRoute';
import type { UserProfile } from './types';

// Props for RequireRole component
export interface RequireRoleProps {
  children: React.ReactNode;
  roles?: UserRole[];
  permissions?: Permission[];
  requireAll?: boolean; // For permissions: true = all required, false = any required
  requireAllRoles?: boolean; // For roles: true = all roles required, false = any role required
  fallback?: React.ReactNode;
  showAnimation?: boolean;
  className?: string;
  onUnauthorized?: (profile: UserProfile | null, missingRoles?: UserRole[], missingPermissions?: Permission[]) => void;
}

// Get user role from profile
const getUserRole = (profile: UserProfile | null): UserRole => {
  if (!profile) return 'customer';
  
  // Check for admin roles first
  if (profile.email?.endsWith('@lawless.directory')) {
    return profile.businessType === 'admin' ? 'super_admin' : 'admin';
  }
  
  return profile.businessType as UserRole || 'customer';
};

// Check if user has required role
const hasRole = (profile: UserProfile | null, role: UserRole): boolean => {
  const userRole = getUserRole(profile);
  
  // Role hierarchy (higher roles include lower ones)
  const roleHierarchy: Record<UserRole, number> = {
    customer: 0,
    service_provider: 1,
    business_owner: 1,
    admin: 2,
    super_admin: 3
  };

  // Super admin has access to everything
  if (userRole === 'super_admin') return true;
  
  // Admin has access to non-super-admin roles
  if (userRole === 'admin' && role !== 'super_admin') return true;
  
  // Exact role match
  return userRole === role;
};

// Check if user has any of the required roles
const hasAnyRole = (profile: UserProfile | null, roles: UserRole[]): boolean => {
  return roles.some(role => hasRole(profile, role));
};

// Check if user has all required roles (unusual but possible)
const hasAllRoles = (profile: UserProfile | null, roles: UserRole[]): boolean => {
  return roles.every(role => hasRole(profile, role));
};

// Animation variants
const animationVariants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 }
};

// Main RequireRole component
export const RequireRole: React.FC<RequireRoleProps> = ({
  children,
  roles = [],
  permissions = [],
  requireAll = false,
  requireAllRoles = false,
  fallback = null,
  showAnimation = true,
  className = '',
  onUnauthorized
}) => {
  const { profile, user } = useAuth();

  // If no requirements specified, render children
  if (roles.length === 0 && permissions.length === 0) {
    return (
      <div className={className}>
        {children}
      </div>
    );
  }

  let hasAccess = true;
  const missingRoles: UserRole[] = [];
  const missingPermissions: Permission[] = [];

  // Check role requirements
  if (roles.length > 0) {
    const roleCheck = requireAllRoles 
      ? hasAllRoles(profile, roles)
      : hasAnyRole(profile, roles);
    
    if (!roleCheck) {
      hasAccess = false;
      // Find missing roles
      roles.forEach(role => {
        if (!hasRole(profile, role)) {
          missingRoles.push(role);
        }
      });
    }
  }

  // Check permission requirements
  if (permissions.length > 0) {
    const permissionCheck = requireAll
      ? hasAllPermissions(profile, permissions)
      : hasAnyPermission(profile, permissions);
    
    if (!permissionCheck) {
      hasAccess = false;
      // Find missing permissions
      permissions.forEach(permission => {
        if (!hasPermission(profile, permission)) {
          missingPermissions.push(permission);
        }
      });
    }
  }

  // Call unauthorized callback if provided
  if (!hasAccess && onUnauthorized) {
    onUnauthorized(profile, missingRoles, missingPermissions);
  }

  // Render based on access check
  const content = hasAccess ? children : fallback;

  if (!showAnimation) {
    return (
      <div className={className}>
        {content}
      </div>
    );
  }

  return (
    <div className={className}>
      <AnimatePresence mode="wait">
        {hasAccess ? (
          <motion.div
            key="authorized"
            variants={animationVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        ) : (
          fallback && (
            <motion.div
              key="unauthorized"
              variants={animationVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2 }}
            >
              {fallback}
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  );
};

// Hook for checking roles and permissions
export const useRoleCheck = () => {
  const { profile, user } = useAuth();

  const checkRole = React.useCallback((role: UserRole): boolean => {
    return hasRole(profile, role);
  }, [profile]);

  const checkRoles = React.useCallback((
    roles: UserRole[], 
    requireAll: boolean = false
  ): boolean => {
    return requireAll ? hasAllRoles(profile, roles) : hasAnyRole(profile, roles);
  }, [profile]);

  const checkPermission = React.useCallback((permission: Permission): boolean => {
    return hasPermission(profile, permission);
  }, [profile]);

  const checkPermissions = React.useCallback((
    permissions: Permission[], 
    requireAll: boolean = false
  ): boolean => {
    return requireAll ? hasAllPermissions(profile, permissions) : hasAnyPermission(profile, permissions);
  }, [profile]);

  const currentUserRole = React.useCallback((): UserRole => {
    return getProfileUserRole(profile);
  }, [profile]);

  const isAuthenticated = !!user;

  return {
    checkRole,
    checkRoles,
    checkPermission,
    checkPermissions,
    getUserRole: currentUserRole,
    isAuthenticated,
    profile,
    user
  };
};

// Higher-order component for role-based rendering
export const withRoleCheck = <P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<RequireRoleProps, 'children'>
) => {
  const RoleCheckedComponent: React.FC<P> = (props) => (
    <RequireRole {...options}>
      <Component {...props} />
    </RequireRole>
  );

  RoleCheckedComponent.displayName = `withRoleCheck(${Component.displayName || Component.name})`;
  
  return RoleCheckedComponent;
};

// Convenience components for common role checks
export const RequireAuthentication: React.FC<Omit<RequireRoleProps, 'roles' | 'permissions'>> = (props) => {
  const { user } = useAuth();
  
  if (!user) {
    return <>{props.fallback}</>;
  }

  return (
    <div className={props.className}>
      {props.showAnimation ? (
        <motion.div
          variants={animationVariants}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.2 }}
        >
          {props.children}
        </motion.div>
      ) : (
        props.children
      )}
    </div>
  );
};

export const RequireAdmin: React.FC<Omit<RequireRoleProps, 'roles'>> = (props) => (
  <RequireRole {...props} roles={['admin', 'super_admin']} />
);

export const RequireSuperAdmin: React.FC<Omit<RequireRoleProps, 'roles'>> = (props) => (
  <RequireRole {...props} roles={['super_admin']} />
);

export const RequireBusinessOwner: React.FC<Omit<RequireRoleProps, 'roles'>> = (props) => (
  <RequireRole {...props} roles={['business_owner', 'admin', 'super_admin']} />
);

export const RequireServiceProvider: React.FC<Omit<RequireRoleProps, 'roles'>> = (props) => (
  <RequireRole {...props} roles={['service_provider', 'admin', 'super_admin']} />
);

// Component for showing different content based on role
export const RoleBasedContent: React.FC<{
  customerContent?: React.ReactNode;
  businessOwnerContent?: React.ReactNode;
  serviceProviderContent?: React.ReactNode;
  adminContent?: React.ReactNode;
  superAdminContent?: React.ReactNode;
  defaultContent?: React.ReactNode;
  className?: string;
  showAnimation?: boolean;
}> = ({
  customerContent,
  businessOwnerContent,
  serviceProviderContent,
  adminContent,
  superAdminContent,
  defaultContent,
  className = '',
  showAnimation = true
}) => {
  const { checkRole } = useRoleCheck();

  let content = defaultContent;

  if (checkRole('super_admin') && superAdminContent) {
    content = superAdminContent;
  } else if (checkRole('admin') && adminContent) {
    content = adminContent;
  } else if (checkRole('business_owner') && businessOwnerContent) {
    content = businessOwnerContent;
  } else if (checkRole('service_provider') && serviceProviderContent) {
    content = serviceProviderContent;
  } else if (checkRole('customer') && customerContent) {
    content = customerContent;
  }

  if (!showAnimation) {
    return <div className={className}>{content}</div>;
  }

  return (
    <div className={className}>
      <AnimatePresence mode="wait">
        <motion.div
          key={content ? 'content' : 'default'}
          variants={animationVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.2 }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default RequireRole;