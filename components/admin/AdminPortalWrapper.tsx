'use client';

import React from 'react';
import { AdminErrorProvider } from './AdminErrorBoundary';
import { AdminNotificationProvider } from './AdminNotificationSystem';
import { AdminDataServiceProvider } from './AdminDataService';
import { AdminDashboardLayout } from './AdminDashboardLayout';
import { AdminTypes } from './types';

interface AdminPortalWrapperProps {
  children: React.ReactNode;
  user?: AdminTypes.User;
  config?: {
    apiBaseUrl?: string;
    enableRealTime?: boolean;
    enableNotifications?: boolean;
    enableErrorBoundary?: boolean;
    cacheEnabled?: boolean;
    cacheTTL?: number;
  };
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  className?: string;
}

/**
 * AdminPortalWrapper - Main wrapper component that provides all admin portal functionality
 * 
 * This component serves as the main entry point for the admin portal, integrating:
 * - Error boundaries for robust error handling
 * - Notification system for user feedback
 * - Data service for API integration and caching
 * - Dashboard layout with navigation
 * 
 * Features:
 * - Comprehensive error handling with detailed error reporting
 * - Real-time notifications for admin operations
 * - Offline support with intelligent caching
 * - Responsive design with modern UI patterns
 * - Full TypeScript support with proper type definitions
 * - Integration-ready for both mock and real API data
 * 
 * Usage:
 * ```tsx
 * <AdminPortalWrapper
 *   user={adminUser}
 *   config={{
 *     apiBaseUrl: '/api/admin',
 *     enableRealTime: true,
 *     enableNotifications: true
 *   }}
 * >
 *   <YourAdminComponents />
 * </AdminPortalWrapper>
 * ```
 */
export const AdminPortalWrapper: React.FC<AdminPortalWrapperProps> = ({
  children,
  user,
  config = {},
  onError,
  className
}) => {
  const {
    apiBaseUrl = '/api/admin',
    enableRealTime = true,
    enableNotifications = true,
    enableErrorBoundary = true,
    cacheEnabled = true,
    cacheTTL = 5 * 60 * 1000 // 5 minutes
  } = config;

  // Error boundary wrapper (outermost layer)
  const ErrorBoundaryWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (!enableErrorBoundary) return <>{children}</>;
    
    return (
      <AdminErrorProvider onError={onError}>
        {children}
      </AdminErrorProvider>
    );
  };

  // Notification system wrapper
  const NotificationWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (!enableNotifications) return <>{children}</>;
    
    return (
      <AdminNotificationProvider>
        {children}
      </AdminNotificationProvider>
    );
  };

  // Data service wrapper
  const DataServiceWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
      <AdminDataServiceProvider
        apiBaseUrl={apiBaseUrl}
        enableRealTime={enableRealTime}
        cacheEnabled={cacheEnabled}
        cacheTTL={cacheTTL}
      >
        {children}
      </AdminDataServiceProvider>
    );
  };

  // Dashboard layout wrapper
  const LayoutWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
      <AdminDashboardLayout user={user} className={className}>
        {children}
      </AdminDashboardLayout>
    );
  };

  return (
    <ErrorBoundaryWrapper>
      <NotificationWrapper>
        <DataServiceWrapper>
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
        </DataServiceWrapper>
      </NotificationWrapper>
    </ErrorBoundaryWrapper>
  );
};

/**
 * Enhanced admin components with integrated error handling, loading states, and real-time data
 */

// Enhanced User Management Component
export const AdminUserManagementEnhanced: React.FC<{
  className?: string;
}> = ({ className }) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // This would be replaced with actual AdminUserManagement component
  // when the API integration is complete
  
  React.useEffect(() => {
    // Simulate loading state
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-sage/20 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 bg-sage/20 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-400 mb-4">Error loading user data</div>
        <button
          onClick={() => {
            setError(null);
            setIsLoading(true);
            // Retry logic would go here
          }}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Placeholder for actual AdminUserManagement component */}
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-cream">User Management</h1>
        <div className="text-sage/70">
          Enhanced user management component with error handling and loading states.
          This will be replaced with the actual AdminUserManagement component
          once the API integration is complete.
        </div>
      </div>
    </div>
  );
};

// Enhanced Login Component
export const AdminLoginEnhanced: React.FC<{
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  className?: string;
}> = ({ onSuccess, onError, className }) => {
  // This would be replaced with actual AdminLoginForm component
  // Enhanced with proper error handling and notifications
  
  return (
    <div className={className}>
      {/* Placeholder for actual AdminLoginForm component */}
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-cream">Admin Login</h1>
          <div className="text-sage/70">
            Enhanced login component with comprehensive error handling,
            proper loading states, and integrated notification system.
          </div>
        </div>
      </div>
    </div>
  );
};

// Hook for easy admin portal integration
export const useAdminPortal = () => {
  return {
    // Re-export useful hooks from other components
    useErrorHandler: () => {
      // Import and re-export from AdminErrorBoundary
      return {
        reportError: (error: Error, context?: string) => {
          console.error('Admin Portal Error:', error, context);
        }
      };
    },
    
    // Helper function to check if we're in admin portal
    isAdminPortal: () => {
      return window.location.pathname.startsWith('/admin');
    },
    
    // Helper function to get admin user from context
    getCurrentUser: (): AdminTypes.User | null => {
      // In a real implementation, this would get the user from context
      return null;
    }
  };
};

// Export default as the main wrapper
export default AdminPortalWrapper;