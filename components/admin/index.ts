// Admin Portal Components - Main Export File
// This file provides a clean interface for importing all admin portal components

// Main wrapper and layout components
export { AdminPortalWrapper, useAdminPortal } from './AdminPortalWrapper';
export { AdminDashboardLayout } from './AdminDashboardLayout';
export { AdminLoginForm } from './AdminLoginForm';
export { AdminUserManagement } from './AdminUserManagement';
export { AuditLogViewer } from './AuditLogViewer';

// Error handling and boundaries
export { 
  default as AdminErrorBoundary, 
  AdminErrorProvider, 
  useErrorHandler,
  AdminErrorBoundaryComponent
} from './AdminErrorBoundary';

// Loading states and UI components
export {
  AdminLoadingSpinner,
  AdminSkeleton,
  AdminPageLoading,
  AdminLoadingButton,
  AdminTableLoading,
  AdminCardLoading,
  AdminStatsLoading,
  AdminFormLoading,
  AdminOperationFeedback
} from './AdminLoadingStates';

// Notification system
export {
  AdminNotificationProvider,
  AdminNotificationContainer,
  useAdminNotifications,
  useAdminNotificationHelpers
} from './AdminNotificationSystem';

// Data service for API integration
export {
  AdminDataServiceProvider,
  useAdminDataService
} from './AdminDataService';

// TypeScript definitions
export * from './types';
export type { AdminTypes } from './types';

// Re-export specific component types for convenience
export type {
  AdminUser,
  AdminUserFilters,
  AdminAuditLog,
  AdminSecurityAlert,
  AdminSystemMetrics,
  AdminNotification,
  NotificationType,
  NotificationCategory,
  AdminRole,
  UserStatus,
  AlertSeverity
} from './types';

// Default export - recommended way to use the admin portal
export { AdminPortalWrapper as main } from './AdminPortalWrapper';
