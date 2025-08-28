'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAdminNotifications } from './AdminNotificationSystem';

// Base interfaces for admin data
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'platform_admin' | 'support_admin' | 'content_moderator';
  status: 'active' | 'inactive' | 'suspended' | 'locked';
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
}

export interface AdminAuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

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
}

export interface AdminSecurityAlert {
  id: string;
  type: 'failed_login' | 'suspicious_activity' | 'privilege_escalation' | 'data_breach' | 'system_intrusion';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedResources: string[];
  sourceIp?: string;
  userId?: string;
  timestamp: Date;
  status: 'new' | 'investigating' | 'resolved' | 'false_positive';
}

// API Response types
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

interface DataServiceState {
  isOnline: boolean;
  lastSync: Date | null;
  pendingOperations: Map<string, any>;
  cache: Map<string, { data: any; timestamp: Date; ttl: number }>;
}

interface AdminDataServiceContext {
  // State
  state: DataServiceState;
  
  // User Management
  getUsers: (filters?: any) => Promise<AdminUser[]>;
  getUser: (id: string) => Promise<AdminUser | null>;
  createUser: (userData: Partial<AdminUser>) => Promise<AdminUser>;
  updateUser: (id: string, updates: Partial<AdminUser>) => Promise<AdminUser>;
  deleteUser: (id: string) => Promise<boolean>;
  
  // Audit Logs
  getAuditLogs: (filters?: any) => Promise<AdminAuditLog[]>;
  createAuditLog: (logData: Omit<AdminAuditLog, 'id' | 'timestamp'>) => Promise<void>;
  
  // System Metrics
  getSystemMetrics: () => Promise<AdminSystemMetrics>;
  
  // Security
  getSecurityAlerts: (filters?: any) => Promise<AdminSecurityAlert[]>;
  markAlertResolved: (alertId: string) => Promise<boolean>;
  
  // Cache Management
  clearCache: (key?: string) => void;
  refreshData: (key: string) => Promise<any>;
  
  // Real-time subscriptions
  subscribe: (key: string, callback: (data: any) => void) => () => void;
}

const AdminDataServiceContext = createContext<AdminDataServiceContext | null>(null);

export const useAdminDataService = () => {
  const context = useContext(AdminDataServiceContext);
  if (!context) {
    throw new Error('useAdminDataService must be used within AdminDataServiceProvider');
  }
  return context;
};

// Mock data for development/demo
const mockUsers: AdminUser[] = [
  {
    id: 'admin-1',
    email: 'admin@lawlessdirectory.com',
    name: 'System Administrator',
    role: 'super_admin',
    status: 'active',
    permissions: ['read:all', 'write:all', 'admin:all'],
    createdAt: new Date('2024-01-01'),
    lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000),
    loginCount: 1243,
    ipWhitelist: ['192.168.1.100', '203.0.113.45'],
    mfaEnabled: true,
    trustedDevices: 3,
    failedAttempts: 0,
    location: 'San Francisco, CA',
    createdBy: 'system'
  },
  {
    id: 'admin-2',
    email: 'platform@lawlessdirectory.com',
    name: 'Platform Manager',
    role: 'platform_admin',
    status: 'active',
    permissions: ['read:users', 'write:users', 'read:businesses', 'write:businesses'],
    createdAt: new Date('2024-02-15'),
    lastLogin: new Date(Date.now() - 45 * 60 * 1000),
    loginCount: 456,
    ipWhitelist: ['198.51.100.23'],
    mfaEnabled: true,
    trustedDevices: 2,
    failedAttempts: 0,
    location: 'New York, NY',
    createdBy: 'admin-1'
  }
];

const mockSystemMetrics: AdminSystemMetrics = {
  activeUsers: 234,
  totalUsers: 12453,
  systemLoad: 45.2,
  memoryUsage: 67.8,
  diskUsage: 34.1,
  responseTime: 145,
  errorRate: 0.02,
  uptime: 99.97,
  lastUpdated: new Date()
};

// Helper function to simulate API calls
const simulateApiCall = async <T,>(
  data: T,
  delay: number = 500,
  failureRate: number = 0.1
): Promise<ApiResponse<T>> => {
  await new Promise(resolve => setTimeout(resolve, delay));
  
  if (Math.random() < failureRate) {
    throw new Error('Simulated API failure');
  }
  
  return {
    success: true,
    data
  };
};

export const AdminDataServiceProvider: React.FC<{
  children: React.ReactNode;
  apiBaseUrl?: string;
  enableRealTime?: boolean;
  cacheEnabled?: boolean;
  cacheTTL?: number;
}> = ({
  children,
  apiBaseUrl = '/api/admin',
  enableRealTime = true,
  cacheEnabled = true,
  cacheTTL = 5 * 60 * 1000 // 5 minutes
}) => {
  const [state, setState] = useState<DataServiceState>({
    isOnline: navigator.onLine,
    lastSync: null,
    pendingOperations: new Map(),
    cache: new Map()
  });

  const { showApiError, showSystemError } = useAdminNotifications();
  const subscriptions = new Map<string, Set<(data: any) => void>>();

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => setState(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setState(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cache management
  const getCachedData = useCallback((key: string) => {
    if (!cacheEnabled) return null;
    
    const cached = state.cache.get(key);
    if (cached && Date.now() - cached.timestamp.getTime() < cached.ttl) {
      return cached.data;
    }
    
    // Remove expired cache
    if (cached) {
      setState(prev => {
        const newCache = new Map(prev.cache);
        newCache.delete(key);
        return { ...prev, cache: newCache };
      });
    }
    
    return null;
  }, [cacheEnabled, state.cache]);

  const setCachedData = useCallback((key: string, data: any, ttl: number = cacheTTL) => {
    if (!cacheEnabled) return;
    
    setState(prev => {
      const newCache = new Map(prev.cache);
      newCache.set(key, { data, timestamp: new Date(), ttl });
      return { ...prev, cache: newCache };
    });
  }, [cacheEnabled, cacheTTL]);

  const clearCache = useCallback((key?: string) => {
    setState(prev => {
      if (key) {
        const newCache = new Map(prev.cache);
        newCache.delete(key);
        return { ...prev, cache: newCache };
      } else {
        return { ...prev, cache: new Map() };
      }
    });
  }, []);

  // API call wrapper with caching and error handling
  const apiCall = useCallback(async <T,>(
    endpoint: string,
    options: RequestInit = {},
    cacheKey?: string
  ): Promise<T> => {
    // Check cache first
    if (cacheKey) {
      const cached = getCachedData(cacheKey);
      if (cached) return cached;
    }

    try {
      // In development, use mock data
      if (process.env.NODE_ENV === 'development') {
        // Route to appropriate mock data
        if (endpoint.includes('/users')) {
          const result = await simulateApiCall(mockUsers);
          const data = result.data as T;
          if (cacheKey) setCachedData(cacheKey, data);
          return data;
        }
        
        if (endpoint.includes('/metrics')) {
          const result = await simulateApiCall(mockSystemMetrics);
          const data = result.data as T;
          if (cacheKey) setCachedData(cacheKey, data);
          return data;
        }
      }

      // Production API call
      const response = await fetch(`${apiBaseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          // Add authentication headers here
        },
        ...options
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const result: ApiResponse<T> = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'API operation failed');
      }

      const data = result.data!;
      if (cacheKey) setCachedData(cacheKey, data);
      
      setState(prev => ({ ...prev, lastSync: new Date() }));
      return data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown API error';
      showApiError(
        'API request failed',
        errorMessage,
        {
          label: 'Retry',
          onClick: () => apiCall(endpoint, options, cacheKey)
        }
      );
      throw error;
    }
  }, [apiBaseUrl, getCachedData, setCachedData, showApiError]);

  // User Management Methods
  const getUsers = useCallback(async (filters?: any): Promise<AdminUser[]> => {
    return apiCall<AdminUser[]>('/users', { method: 'GET' }, 'admin-users');
  }, [apiCall]);

  const getUser = useCallback(async (id: string): Promise<AdminUser | null> => {
    try {
      return await apiCall<AdminUser>(`/users/${id}`, { method: 'GET' }, `admin-user-${id}`);
    } catch (error) {
      return null;
    }
  }, [apiCall]);

  const createUser = useCallback(async (userData: Partial<AdminUser>): Promise<AdminUser> => {
    const newUser = await apiCall<AdminUser>('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    
    // Invalidate users cache
    clearCache('admin-users');
    
    // Notify subscribers
    const callbacks = subscriptions.get('users');
    if (callbacks) {
      callbacks.forEach(callback => callback({ type: 'user-created', data: newUser }));
    }
    
    return newUser;
  }, [apiCall, clearCache]);

  const updateUser = useCallback(async (id: string, updates: Partial<AdminUser>): Promise<AdminUser> => {
    const updatedUser = await apiCall<AdminUser>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
    
    // Update caches
    clearCache('admin-users');
    clearCache(`admin-user-${id}`);
    
    // Notify subscribers
    const callbacks = subscriptions.get('users');
    if (callbacks) {
      callbacks.forEach(callback => callback({ type: 'user-updated', data: updatedUser }));
    }
    
    return updatedUser;
  }, [apiCall, clearCache]);

  const deleteUser = useCallback(async (id: string): Promise<boolean> => {
    await apiCall<void>(`/users/${id}`, { method: 'DELETE' });
    
    // Clear caches
    clearCache('admin-users');
    clearCache(`admin-user-${id}`);
    
    // Notify subscribers
    const callbacks = subscriptions.get('users');
    if (callbacks) {
      callbacks.forEach(callback => callback({ type: 'user-deleted', data: { id } }));
    }
    
    return true;
  }, [apiCall, clearCache]);

  // Audit Logs
  const getAuditLogs = useCallback(async (filters?: any): Promise<AdminAuditLog[]> => {
    return apiCall<AdminAuditLog[]>('/audit-logs', { method: 'GET' }, 'admin-audit-logs');
  }, [apiCall]);

  const createAuditLog = useCallback(async (logData: Omit<AdminAuditLog, 'id' | 'timestamp'>): Promise<void> => {
    await apiCall<void>('/audit-logs', {
      method: 'POST',
      body: JSON.stringify({
        ...logData,
        timestamp: new Date().toISOString()
      })
    });
    
    clearCache('admin-audit-logs');
  }, [apiCall, clearCache]);

  // System Metrics
  const getSystemMetrics = useCallback(async (): Promise<AdminSystemMetrics> => {
    return apiCall<AdminSystemMetrics>('/metrics', { method: 'GET' }, 'admin-metrics');
  }, [apiCall]);

  // Security Alerts
  const getSecurityAlerts = useCallback(async (filters?: any): Promise<AdminSecurityAlert[]> => {
    return apiCall<AdminSecurityAlert[]>('/security/alerts', { method: 'GET' }, 'admin-security-alerts');
  }, [apiCall]);

  const markAlertResolved = useCallback(async (alertId: string): Promise<boolean> => {
    await apiCall<void>(`/security/alerts/${alertId}/resolve`, { method: 'PATCH' });
    clearCache('admin-security-alerts');
    return true;
  }, [apiCall, clearCache]);

  // Real-time subscriptions
  const subscribe = useCallback((key: string, callback: (data: any) => void): (() => void) => {
    if (!subscriptions.has(key)) {
      subscriptions.set(key, new Set());
    }
    subscriptions.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = subscriptions.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          subscriptions.delete(key);
        }
      }
    };
  }, []);

  const refreshData = useCallback(async (key: string): Promise<any> => {
    clearCache(key);
    
    // Map cache keys to API calls
    switch (key) {
      case 'admin-users':
        return await getUsers();
      case 'admin-metrics':
        return await getSystemMetrics();
      case 'admin-audit-logs':
        return await getAuditLogs();
      case 'admin-security-alerts':
        return await getSecurityAlerts();
      default:
        throw new Error(`Unknown refresh key: ${key}`);
    }
  }, [clearCache, getUsers, getSystemMetrics, getAuditLogs, getSecurityAlerts]);

  // WebSocket connection for real-time updates (when enabled)
  useEffect(() => {
    if (!enableRealTime || !state.isOnline) return;

    let ws: WebSocket | null = null;
      const wsRef = { current: ws as WebSocket | null };

    try {
      // In production, connect to WebSocket endpoint
      // ws = new WebSocket(`${apiBaseUrl.replace('http', 'ws')}/websocket`);
      
      // For development, simulate real-time updates
      const interval = setInterval(() => {
        // Simulate random updates
        if (Math.random() < 0.1) { // 10% chance every 5 seconds
          const callbacks = subscriptions.get('metrics');
          if (callbacks) {
            const updatedMetrics = {
              ...mockSystemMetrics,
              systemLoad: Math.random() * 100,
              memoryUsage: Math.random() * 100,
              lastUpdated: new Date()
            };
            callbacks.forEach(callback => callback({ type: 'metrics-updated', data: updatedMetrics }));
          }
        }
      }, 5000);

      return () => {
        clearInterval(interval);
        wsRef.current?.close();
      };
    } catch (error) {
      showSystemError('Failed to establish real-time connection', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [enableRealTime, state.isOnline, showSystemError]);

  const contextValue: AdminDataServiceContext = {
    state,
    getUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser,
    getAuditLogs,
    createAuditLog,
    getSystemMetrics,
    getSecurityAlerts,
    markAlertResolved,
    clearCache,
    refreshData,
    subscribe
  };

  return (
    <AdminDataServiceContext.Provider value={contextValue}>
      {children}
    </AdminDataServiceContext.Provider>
  );
};

export default AdminDataServiceProvider;