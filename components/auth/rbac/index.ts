// RBAC Component Exports
export { RoleHierarchyManager } from './RoleHierarchyManager';
export { PermissionMatrix } from './PermissionMatrix';
export { UserRoleAssigner } from './UserRoleAssigner';
export { RoleTemplateManager } from './RoleTemplateManager';
export { PermissionTester } from './PermissionTester';
export { RBACDashboard } from './RBACDashboard';
export { AuditTrailViewer } from './AuditTrailViewer';

// Type Exports
export type {
  // Core Types
  UserRole,
  Permission,
  ResourceType,
  ActionType,
  
  // Entity Types
  RoleDefinition,
  PermissionDefinition,
  BusinessContext,
  UserRoleAssignment,
  PermissionGrant,
  RoleTemplate,
  RBACEvent,
  RBACAnalytics,
  
  // Component Props
  RoleHierarchyManagerProps,
  PermissionMatrixProps,
  UserRoleAssignerProps,
  RoleTemplateManagerProps,
  PermissionTesterProps,
  RBACDashboardProps,
  AuditTrailViewerProps,
  
  // Utility Types
  RBACError,
  RBACValidationResult,
  BulkOperationResult,
  RBACSearchFilters,
  RBACPaginationParams,
  RBACConfiguration,
  RBACState,
  RBACActions,
  RoleCheckFunction,
  PermissionCheckFunction
} from './types';