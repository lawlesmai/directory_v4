import { User } from '@supabase/supabase-js';
import { UserProfile } from '../types';

// Core RBAC Types
export type UserRole = 
  | 'customer' 
  | 'business_owner' 
  | 'service_provider' 
  | 'moderator'
  | 'admin' 
  | 'super_admin';

export type Permission = 
  | 'read:businesses' 
  | 'write:businesses' 
  | 'delete:businesses'
  | 'read:users' 
  | 'write:users' 
  | 'delete:users'
  | 'read:reviews' 
  | 'write:reviews' 
  | 'moderate:reviews'
  | 'read:analytics' 
  | 'write:analytics'
  | 'manage:roles' 
  | 'manage:permissions'
  | 'manage:system' 
  | 'audit:logs';

export type ResourceType = 
  | 'business' 
  | 'user' 
  | 'review' 
  | 'category' 
  | 'analytics' 
  | 'system';

export type ActionType = 
  | 'create' 
  | 'read' 
  | 'update' 
  | 'delete' 
  | 'manage' 
  | 'moderate' 
  | 'audit';

// Role Definition
export interface RoleDefinition {
  id: string;
  name: string;
  displayName: string;
  description: string;
  level: number; // Hierarchy level (0 = lowest, 100 = highest)
  parentRole?: string; // For role hierarchy
  childRoles?: string[]; // Sub-roles
  permissions: Permission[];
  inheritedPermissions?: Permission[]; // From parent roles
  contexts: BusinessContext[]; // Where this role can be applied
  isSystemRole: boolean; // Cannot be deleted/modified
  isActive: boolean;
  metadata: {
    color: string;
    icon: string;
    category: 'system' | 'business' | 'user' | 'custom';
  };
  constraints: {
    maxUsers?: number;
    requiresApproval: boolean;
    autoExpiry?: Date;
    ipRestrictions?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Permission Definition
export interface PermissionDefinition {
  id: string;
  name: Permission;
  displayName: string;
  description: string;
  resource: ResourceType;
  action: ActionType;
  category: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  dependencies?: Permission[]; // Permissions that must also be granted
  conflicts?: Permission[]; // Permissions that cannot be granted together
  contexts: BusinessContext[]; // Where this permission applies
  isSystemPermission: boolean;
  metadata: {
    icon: string;
    color: string;
  };
  auditRequired: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Business Context for role/permission scoping
export interface BusinessContext {
  id: string;
  name: string;
  type: 'global' | 'business' | 'location' | 'department';
  businessId?: string; // For business-specific contexts
  parentContext?: string;
  isActive: boolean;
}

// User Role Assignment
export interface UserRoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  businessContext: BusinessContext;
  assignedBy: string;
  assignedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
  reason?: string;
  metadata: {
    source: 'manual' | 'system' | 'api' | 'import';
    approvedBy?: string;
    approvedAt?: Date;
  };
}

// Permission Grant (specific permission to user)
export interface PermissionGrant {
  id: string;
  userId: string;
  permission: Permission;
  businessContext: BusinessContext;
  source: 'role' | 'direct' | 'inherited';
  sourceId: string; // Role ID or grant ID
  grantedBy: string;
  grantedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
  constraints?: {
    conditions?: string[];
    timeRestrictions?: {
      startTime: string;
      endTime: string;
      days: string[];
    };
    ipRestrictions?: string[];
  };
}

// Role Template for common role configurations
export interface RoleTemplate {
  id: string;
  name: string;
  description: string;
  category: 'business' | 'system' | 'custom';
  targetRole: UserRole;
  permissions: Permission[];
  contexts: BusinessContext[];
  isPublic: boolean;
  usageCount: number;
  metadata: {
    tags: string[];
    industry?: string;
    businessSize?: 'small' | 'medium' | 'large' | 'enterprise';
  };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Audit Trail
export interface RBACEvent {
  id: string;
  eventType: 
    | 'role_assigned' 
    | 'role_revoked' 
    | 'permission_granted' 
    | 'permission_revoked'
    | 'role_created' 
    | 'role_updated' 
    | 'role_deleted'
    | 'permission_test' 
    | 'bulk_operation'
    | 'security_violation';
  userId: string; // Who performed the action
  targetUserId?: string; // Who was affected (for assignments)
  resourceId: string; // Role ID, Permission ID, etc.
  resourceType: 'role' | 'permission' | 'assignment' | 'template';
  businessContext?: BusinessContext;
  details: {
    oldValue?: any;
    newValue?: any;
    reason?: string;
    batchId?: string; // For bulk operations
  };
  metadata: {
    ipAddress: string;
    userAgent: string;
    sessionId: string;
    requestId?: string;
  };
  riskScore: number; // 0-100, calculated risk of this action
  timestamp: Date;
}

// RBAC Analytics
export interface RBACAnalytics {
  userCount: {
    total: number;
    byRole: Record<string, number>;
    active: number;
    inactive: number;
  };
  roleUsage: {
    mostUsed: Array<{ roleId: string; count: number }>;
    leastUsed: Array<{ roleId: string; count: number }>;
    trending: Array<{ roleId: string; change: number }>;
  };
  permissionUsage: {
    mostGranted: Array<{ permission: Permission; count: number }>;
    riskiest: Array<{ permission: Permission; riskScore: number }>;
  };
  violations: {
    count: number;
    recent: RBACEvent[];
    trends: Array<{ date: string; count: number }>;
  };
  compliance: {
    score: number;
    issues: Array<{
      type: 'orphaned_permission' | 'excessive_privileges' | 'inactive_role' | 'expired_assignment';
      count: number;
      severity: 'low' | 'medium' | 'high';
    }>;
  };
}

// Component Props Types
export interface RoleHierarchyManagerProps {
  roles: RoleDefinition[];
  onRoleUpdate: (roleId: string, updates: Partial<RoleDefinition>) => Promise<void>;
  onRoleCreate: (role: Omit<RoleDefinition, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onRoleDelete: (roleId: string) => Promise<void>;
  onHierarchyChange: (changes: Array<{ roleId: string; newParent?: string }>) => Promise<void>;
  readonly?: boolean;
  className?: string;
}

export interface PermissionMatrixProps {
  roles: RoleDefinition[];
  permissions: PermissionDefinition[];
  assignments: UserRoleAssignment[];
  onPermissionToggle: (roleId: string, permission: Permission, grant: boolean) => Promise<void>;
  onBulkPermissionUpdate: (updates: Array<{
    roleId: string;
    permissions: Permission[];
    operation: 'grant' | 'revoke';
  }>) => Promise<void>;
  businessContext: BusinessContext;
  readonly?: boolean;
  className?: string;
}

export interface UserRoleAssignerProps {
  users: Array<UserProfile & { roleAssignments: UserRoleAssignment[] }>;
  roles: RoleDefinition[];
  businessContexts: BusinessContext[];
  onRoleAssign: (userId: string, roleId: string, context: BusinessContext, options?: {
    expiresAt?: Date;
    reason?: string;
  }) => Promise<void>;
  onRoleRevoke: (assignmentId: string, reason?: string) => Promise<void>;
  onBulkAssign: (assignments: Array<{
    userId: string;
    roleId: string;
    context: BusinessContext;
  }>) => Promise<void>;
  readonly?: boolean;
  className?: string;
}

export interface RoleTemplateManagerProps {
  templates: RoleTemplate[];
  roles: RoleDefinition[];
  permissions: PermissionDefinition[];
  onTemplateCreate: (template: Omit<RoleTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => Promise<void>;
  onTemplateUpdate: (templateId: string, updates: Partial<RoleTemplate>) => Promise<void>;
  onTemplateDelete: (templateId: string) => Promise<void>;
  onTemplateApply: (templateId: string, targetUsers: string[], context: BusinessContext) => Promise<void>;
  className?: string;
}

export interface PermissionTesterProps {
  roles: RoleDefinition[];
  permissions: PermissionDefinition[];
  users: UserProfile[];
  businessContexts: BusinessContext[];
  onTest: (config: {
    userId?: string;
    roleIds?: string[];
    permissions?: Permission[];
    context: BusinessContext;
  }) => Promise<{
    granted: Permission[];
    denied: Permission[];
    conflicts: Array<{ permission: Permission; reason: string }>;
    recommendations: Array<{ type: 'grant' | 'revoke'; permission: Permission; reason: string }>;
  }>;
  className?: string;
}

export interface RBACDashboardProps {
  analytics: RBACAnalytics;
  recentEvents: RBACEvent[];
  onRefresh: () => Promise<void>;
  onExportData: (type: 'users' | 'roles' | 'permissions' | 'audit') => Promise<void>;
  onViewDetails: (type: 'violations' | 'compliance' | 'usage', filters?: any) => void;
  className?: string;
}

export interface AuditTrailViewerProps {
  events: RBACEvent[];
  totalCount: number;
  filters: {
    eventTypes?: string[];
    userIds?: string[];
    dateRange?: { start: Date; end: Date };
    businessContext?: BusinessContext;
    riskLevel?: 'low' | 'medium' | 'high';
  };
  onFiltersChange: (filters: AuditTrailViewerProps['filters']) => void;
  onLoadMore: () => Promise<void>;
  onExport: (format: 'csv' | 'json' | 'pdf') => Promise<void>;
  loading?: boolean;
  className?: string;
}

// Utility Types
export interface RBACError {
  type: 'validation' | 'permission' | 'system' | 'network';
  message: string;
  details?: any;
  code?: string;
}

export interface RBACValidationResult {
  valid: boolean;
  errors: RBACError[];
  warnings: Array<{ type: string; message: string; severity: 'low' | 'medium' | 'high' }>;
}

export interface BulkOperationResult<T> {
  successful: T[];
  failed: Array<{ item: T; error: RBACError }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

// Search and Filter Types
export interface RBACSearchFilters {
  query?: string;
  roles?: string[];
  permissions?: Permission[];
  businessContexts?: string[];
  dateRange?: { start: Date; end: Date };
  status?: 'active' | 'inactive' | 'expired';
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}

export interface RBACPaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Configuration Types
export interface RBACConfiguration {
  features: {
    hierarchicalRoles: boolean;
    temporaryAssignments: boolean;
    bulkOperations: boolean;
    auditLogging: boolean;
    riskScoring: boolean;
    autoExpiry: boolean;
  };
  limits: {
    maxRolesPerUser: number;
    maxPermissionsPerRole: number;
    maxHierarchyDepth: number;
    bulkOperationLimit: number;
  };
  security: {
    requireApprovalForHighRisk: boolean;
    auditAllChanges: boolean;
    sessionTimeout: number;
    ipWhitelisting: boolean;
  };
  notifications: {
    roleAssignment: boolean;
    permissionGrant: boolean;
    violations: boolean;
    expiry: boolean;
  };
}

// State Management Types
export interface RBACState {
  roles: RoleDefinition[];
  permissions: PermissionDefinition[];
  userAssignments: UserRoleAssignment[];
  businessContexts: BusinessContext[];
  templates: RoleTemplate[];
  auditEvents: RBACEvent[];
  analytics: RBACAnalytics | null;
  loading: {
    roles: boolean;
    permissions: boolean;
    assignments: boolean;
    analytics: boolean;
  };
  errors: {
    roles: RBACError | null;
    permissions: RBACError | null;
    assignments: RBACError | null;
    analytics: RBACError | null;
  };
}

export interface RBACActions {
  // Roles
  loadRoles: () => Promise<void>;
  createRole: (role: Omit<RoleDefinition, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateRole: (roleId: string, updates: Partial<RoleDefinition>) => Promise<void>;
  deleteRole: (roleId: string) => Promise<void>;
  
  // Permissions
  loadPermissions: () => Promise<void>;
  toggleRolePermission: (roleId: string, permission: Permission, grant: boolean) => Promise<void>;
  
  // Assignments
  loadUserAssignments: () => Promise<void>;
  assignRole: (userId: string, roleId: string, context: BusinessContext, options?: any) => Promise<void>;
  revokeRole: (assignmentId: string, reason?: string) => Promise<void>;
  
  // Analytics
  loadAnalytics: () => Promise<void>;
  
  // Utility
  clearError: (errorType: keyof RBACState['errors']) => void;
  reset: () => void;
}

// Export utility type for role checks
export type RoleCheckFunction = (requiredRole: UserRole) => boolean;
export type PermissionCheckFunction = (requiredPermission: Permission, context?: BusinessContext) => boolean;