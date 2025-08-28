// Admin Portal TypeScript definitions
// This file contains all type definitions for the admin portal

import { ReactNode } from 'react';

// Base utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Common enum types
export type AdminRole = 'super_admin' | 'platform_admin' | 'support_admin' | 'content_moderator';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'locked';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';
export type OperationStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

// Admin User Types
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  status: UserStatus;
  permissions: string[];
  avatar?: string;
  createdAt: Date;
  lastLogin?: Date;
  loginCount: number;
  ipWhitelist: string[];
  mfaEnabled: boolean;
  trustedDevices: number;
  failedAttempts: number;
  location?: string;
  createdBy?: string;
  metadata?: Record<string, any>;
}

export interface AdminUserFilters {
  role?: AdminRole | 'all';
  status?: UserStatus | 'all';
  search?: string;
  mfaEnabled?: boolean;
  hasFailedAttempts?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  lastLoginAfter?: Date;
  lastLoginBefore?: Date;
  page?: number;
  limit?: number;
  sortBy?: keyof AdminUser;
  sortOrder?: 'asc' | 'desc';
}

export interface AdminUserCreateData {
  email: string;
  name: string;
  role: AdminRole;
  permissions: string[];
  ipWhitelist?: string[];
  location?: string;
  sendInvitation?: boolean;
  temporaryPassword?: boolean;
}

export interface AdminUserUpdateData {
  name?: string;
  role?: AdminRole;
  status?: UserStatus;
  permissions?: string[];
  ipWhitelist?: string[];
  location?: string;
  mfaEnabled?: boolean;
  avatar?: string;
  metadata?: Record<string, any>;
}

// Audit Log Types
export interface AdminAuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  severity: AlertSeverity;
  outcome: 'success' | 'failure' | 'partial';
  duration?: number; // in milliseconds
}

export interface AdminAuditLogFilters {
  userId?: string;
  action?: string;
  resource?: string;
  severity?: AlertSeverity | 'all';
  outcome?: 'success' | 'failure' | 'partial' | 'all';
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  page?: number;
  limit?: number;
}

// Security Alert Types
export type SecurityAlertType = 
  | 'failed_login' 
  | 'suspicious_activity' 
  | 'privilege_escalation' 
  | 'data_breach' 
  | 'system_intrusion'
  | 'unauthorized_access'
  | 'malware_detected'
  | 'ddos_attack';

export type SecurityAlertStatus = 'new' | 'investigating' | 'resolved' | 'false_positive';

export interface AdminSecurityAlert {
  id: string;
  type: SecurityAlertType;
  severity: AlertSeverity;
  status: SecurityAlertStatus;
  title: string;
  description: string;
  affectedResources: string[];
  sourceIp?: string;
  userId?: string;
  userName?: string;
  timestamp: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
  attachments?: string[];
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface AdminSecurityAlertFilters {
  type?: SecurityAlertType | 'all';
  severity?: AlertSeverity | 'all';
  status?: SecurityAlertStatus | 'all';
  startDate?: Date;
  endDate?: Date;
  sourceIp?: string;
  userId?: string;
  page?: number;
  limit?: number;
}

// System Metrics Types
export interface AdminSystemMetrics {
  activeUsers: number;
  totalUsers: number;
  systemLoad: number;
  memoryUsage: number;
  diskUsage: number;
  responseTime: number;
  errorRate: number;
  uptime: number;
  lastUpdated: Date;
  networkLatency?: number;
  activeConnections?: number;
  queuedJobs?: number;
}

export interface AdminPerformanceMetrics {
  id: string;
  endpoint: string;
  method: string;
  avgResponseTime: number;
  requestCount: number;
  errorCount: number;
  errorRate: number;
  timestamp: Date;
}

// Business Management Types
export interface AdminBusiness {
  id: string;
  name: string;
  slug: string;
  category: string;
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  verificationStatus: 'verified' | 'pending' | 'rejected' | 'unverified';
  ownerId: string;
  ownerEmail: string;
  createdAt: Date;
  updatedAt: Date;
  location: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  contactInfo: {
    phone?: string;
    email?: string;
    website?: string;
  };
  reviewCount: number;
  averageRating: number;
  subscriptionTier?: string;
  metadata?: Record<string, any>;
}

export interface AdminBusinessFilters {
  status?: 'active' | 'inactive' | 'pending' | 'suspended' | 'all';
  verificationStatus?: 'verified' | 'pending' | 'rejected' | 'unverified' | 'all';
  category?: string;
  city?: string;
  state?: string;
  subscriptionTier?: string;
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  page?: number;
  limit?: number;
  sortBy?: keyof AdminBusiness;
  sortOrder?: 'asc' | 'desc';
}

// Notification Types
export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'security';
export type NotificationCategory = 
  | 'auth' 
  | 'user_management' 
  | 'system' 
  | 'security' 
  | 'data' 
  | 'api' 
  | 'general'
  | 'business_management'
  | 'content_moderation';

export interface AdminNotification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  category: NotificationCategory;
  title: string;
  message: string;
  details?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
  persistent?: boolean;
  timestamp: Date;
  userId?: string;
  component?: string;
  metadata?: Record<string, any>;
}

// Component Props Types
export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
}

export interface AdminDashboardLayoutProps extends BaseComponentProps {
  user?: AdminUser;
}

export interface AdminErrorBoundaryProps extends BaseComponentProps {
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  showDetails?: boolean;
}

export interface AdminLoadingProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'accent';
  message?: string;
  progress?: number;
}

export interface AdminTableProps<T = any> extends BaseComponentProps {
  data: T[];
  columns: AdminTableColumn<T>[];
  loading?: boolean;
  error?: string | null;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
  };
  sorting?: {
    sortBy?: keyof T;
    sortOrder?: 'asc' | 'desc';
    onSortChange: (sortBy: keyof T, sortOrder: 'asc' | 'desc') => void;
  };
  selection?: {
    selectedIds: string[];
    onSelectionChange: (selectedIds: string[]) => void;
  };
  actions?: AdminTableAction<T>[];
}

export interface AdminTableColumn<T = any> {
  key: keyof T;
  title: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  render?: (value: any, record: T, index: number) => ReactNode;
  align?: 'left' | 'center' | 'right';
}

export interface AdminTableAction<T = any> {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  condition?: (record: T) => boolean;
  onClick: (record: T) => void;
}

export interface AdminModalProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  footer?: ReactNode;
}

export interface AdminFormProps<T = any> extends BaseComponentProps {
  initialData?: Partial<T>;
  onSubmit: (data: T) => Promise<void> | void;
  onCancel?: () => void;
  loading?: boolean;
  disabled?: boolean;
  validationSchema?: any; // Could be Zod schema or similar
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  path?: string;
}

// Service Types
export interface AdminDataServiceConfig {
  apiBaseUrl: string;
  enableRealTime: boolean;
  cacheEnabled: boolean;
  cacheTTL: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface AdminDataServiceState {
  isOnline: boolean;
  lastSync: Date | null;
  pendingOperations: Map<string, any>;
  cache: Map<string, CacheEntry>;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
}

export interface CacheEntry {
  data: any;
  timestamp: Date;
  ttl: number;
  tags?: string[];
}

// Permission Types
export type Permission = 
  | 'read:users'
  | 'write:users'
  | 'delete:users'
  | 'read:businesses'
  | 'write:businesses'
  | 'delete:businesses'
  | 'read:system'
  | 'write:system'
  | 'read:security'
  | 'write:security'
  | 'read:audit'
  | 'write:audit'
  | 'read:analytics'
  | 'admin:all'
  | 'impersonate:users';

export interface AdminRoleDefinition {
  id: AdminRole;
  name: string;
  description: string;
  permissions: Permission[];
  hierarchy: number; // Higher number = more privileged
  canCreateUsers: boolean;
  canModifyRoles: boolean;
}

// Event Types for real-time updates
export type AdminEventType = 
  | 'user-created'
  | 'user-updated'
  | 'user-deleted'
  | 'user-login'
  | 'user-logout'
  | 'security-alert'
  | 'system-metric-update'
  | 'business-updated'
  | 'audit-log-created';

export interface AdminEvent<T = any> {
  type: AdminEventType;
  data: T;
  timestamp: Date;
  userId?: string;
  metadata?: Record<string, any>;
}

// Form validation types
export interface ValidationRule {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
}

export interface ValidationErrors {
  [field: string]: string[];
}

export interface FormField {
  name: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'checkbox' | 'textarea' | 'date';
  label: string;
  placeholder?: string;
  required?: boolean;
  validation?: ValidationRule;
  options?: { value: string; label: string }[]; // For select fields
  disabled?: boolean;
  help?: string;
}

// Dashboard widget types
export interface AdminWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'alert' | 'activity';
  title: string;
  position: { x: number; y: number; width: number; height: number };
  config: Record<string, any>;
  permissions?: Permission[];
  refreshInterval?: number;
}

export interface AdminDashboardConfig {
  widgets: AdminWidget[];
  layout: 'grid' | 'flexible';
  refreshInterval: number;
  theme: 'dark' | 'light' | 'auto';
}

// Export grouped types for easier imports
export namespace AdminTypes {
  export type User = AdminUser;
  export type UserFilters = AdminUserFilters;
  export type UserCreateData = AdminUserCreateData;
  export type UserUpdateData = AdminUserUpdateData;
  
  export type AuditLog = AdminAuditLog;
  export type AuditLogFilters = AdminAuditLogFilters;
  
  export type SecurityAlert = AdminSecurityAlert;
  export type SecurityAlertFilters = AdminSecurityAlertFilters;
  
  export type SystemMetrics = AdminSystemMetrics;
  export type PerformanceMetrics = AdminPerformanceMetrics;
  
  export type Business = AdminBusiness;
  export type BusinessFilters = AdminBusinessFilters;
  
  export type Notification = AdminNotification;
  export type Event<T = any> = AdminEvent<T>;
  
  export type Role = AdminRole;
  export type RoleDefinition = AdminRoleDefinition;
}