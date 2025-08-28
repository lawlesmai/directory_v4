'use client';

import React, { useState, useCallback, useContext, createContext, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  Shield,
  X,
  Bell,
  AlertCircle,
  Lock,
  Users,
  Database,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '@/components/GlassMorphism';

// Notification types
export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'security';

// Notification priority levels
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

// Notification categories for admin operations
export type NotificationCategory = 
  | 'auth' 
  | 'user_management' 
  | 'system' 
  | 'security' 
  | 'data' 
  | 'api' 
  | 'general';

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
  duration?: number; // Auto-dismiss after milliseconds (0 = no auto-dismiss)
  persistent?: boolean; // Survives page navigation
  timestamp: Date;
  userId?: string;
  component?: string; // Which component triggered the notification
}

interface NotificationContextType {
  showApiError: (message: string, details?: string, action?: AdminNotification["action"]) => string;
  showSystemError: (message: string, details?: string, action?: AdminNotification["action"]) => string;
  showAuthError: (message: string, details?: string) => string;
  showSecurityAlert: (message: string, details?: string) => string;
  notifications: AdminNotification[];
  addNotification: (notification: Omit<AdminNotification, 'id' | 'timestamp'>) => string;
  removeNotification: (id: string) => void;
  clearNotifications: (category?: NotificationCategory) => void;
  markAsRead: (id: string) => void;
  getUnreadCount: () => number;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

// Custom hook to use notifications
export const useAdminNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useAdminNotifications must be used within AdminNotificationProvider');
  }
  return context;
};

// Helper functions for common notification types
export const useAdminNotificationHelpers = () => {
  const { addNotification } = useAdminNotifications();

  return {
    // Authentication notifications
    showAuthSuccess: (message: string, details?: string) =>
      addNotification({
        type: 'success',
        priority: 'medium',
        category: 'auth',
        title: 'Authentication Success',
        message,
        details,
        duration: 5000
      }),

    showAuthError: (message: string, details?: string) =>
      addNotification({
        type: 'error',
        priority: 'high',
        category: 'auth',
        title: 'Authentication Failed',
        message,
        details,
        duration: 0 // Manual dismiss for errors
      }),

    // Security notifications
    showSecurityAlert: (message: string, details?: string) =>
      addNotification({
        type: 'security',
        priority: 'critical',
        category: 'security',
        title: 'Security Alert',
        message,
        details,
        duration: 0,
        persistent: true
      }),

    showSecurityWarning: (message: string, details?: string) =>
      addNotification({
        type: 'warning',
        priority: 'high',
        category: 'security',
        title: 'Security Warning',
        message,
        details,
        duration: 10000
      }),

    // System notifications
    showSystemError: (message: string, details?: string, action?: AdminNotification['action']) =>
      addNotification({
        type: 'error',
        priority: 'high',
        category: 'system',
        title: 'System Error',
        message,
        details,
        action,
        duration: 0
      }),

    showSystemSuccess: (message: string, details?: string) =>
      addNotification({
        type: 'success',
        priority: 'medium',
        category: 'system',
        title: 'Operation Successful',
        message,
        details,
        duration: 5000
      }),

    // User management notifications
    showUserActionSuccess: (message: string, details?: string) =>
      addNotification({
        type: 'success',
        priority: 'medium',
        category: 'user_management',
        title: 'User Action Completed',
        message,
        details,
        duration: 5000
      }),

    showUserActionError: (message: string, details?: string) =>
      addNotification({
        type: 'error',
        priority: 'high',
        category: 'user_management',
        title: 'User Action Failed',
        message,
        details,
        duration: 0
      }),

    // Data operations
    showDataError: (message: string, details?: string) =>
      addNotification({
        type: 'error',
        priority: 'high',
        category: 'data',
        title: 'Data Operation Failed',
        message,
        details,
        duration: 0
      }),

    // API notifications
    showApiError: (message: string, details?: string, action?: AdminNotification['action']) =>
      addNotification({
        type: 'error',
        priority: 'medium',
        category: 'api',
        title: 'API Error',
        message,
        details,
        action,
        duration: 8000
      })
  };
};

// Individual notification component
const AdminNotificationItem: React.FC<{
  notification: AdminNotification;
  onDismiss: (id: string) => void;
  onAction?: (id: string) => void;
}> = ({ notification, onDismiss, onAction }) => {
  const [isHovered, setIsHovered] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
    security: Shield
  };

  const colors = {
    success: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      text: 'text-green-400',
      accent: 'bg-green-500'
    },
    error: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      text: 'text-red-400',
      accent: 'bg-red-500'
    },
    warning: {
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      text: 'text-yellow-400',
      accent: 'bg-yellow-500'
    },
    info: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
      accent: 'bg-blue-500'
    },
    security: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      text: 'text-red-400',
      accent: 'bg-red-500'
    }
  };

  const priorityBorders = {
    low: '',
    medium: 'border-l-4',
    high: 'border-l-4 shadow-md',
    critical: 'border-l-4 shadow-lg animate-pulse'
  };

  const Icon = icons[notification.type];
  const colorScheme = colors[notification.type];

  // Auto-dismiss logic
  useEffect(() => {
    if (notification.duration && notification.duration > 0 && !isHovered) {
      timeoutRef.current = setTimeout(() => {
        onDismiss(notification.id);
      }, notification.duration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [notification.duration, notification.id, onDismiss, isHovered]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'relative p-4 rounded-lg border backdrop-blur-sm',
        colorScheme.bg,
        colorScheme.border,
        priorityBorders[notification.priority]
      )}
      style={{
        borderLeftColor: notification.priority !== 'low' ? colorScheme.accent.replace('bg-', '') : undefined
      }}
    >
      {/* Priority indicator */}
      {notification.priority === 'critical' && (
        <motion.div
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className={cn('absolute top-2 right-2 w-2 h-2 rounded-full', colorScheme.accent)}
        />
      )}

      <div className="flex items-start gap-3">
        <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', colorScheme.text)} />
        
        <div className="flex-1 min-w-0 space-y-1">
          {/* Title */}
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-cream text-sm">
              {notification.title}
            </h4>
            <div className="flex items-center gap-2">
              {/* Category badge */}
              <span className="text-xs px-2 py-0.5 rounded-full bg-sage/20 text-sage/70 capitalize">
                {notification.category.replace('_', ' ')}
              </span>
              
              {/* Close button */}
              <button
                onClick={() => onDismiss(notification.id)}
                className="text-sage/50 hover:text-cream transition-colors p-0.5 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Message */}
          <p className="text-sm text-sage/80">
            {notification.message}
          </p>

          {/* Details */}
          {notification.details && (
            <p className="text-xs text-sage/60 mt-1">
              {notification.details}
            </p>
          )}

          {/* Action button */}
          {notification.action && (
            <button
              onClick={() => {
                notification.action?.onClick();
                onAction?.(notification.id);
              }}
              className={cn(
                'text-xs font-medium px-3 py-1.5 rounded-md transition-colors mt-2',
                'hover:bg-cream/10 border border-sage/20',
                colorScheme.text
              )}
            >
              {notification.action.label}
            </button>
          )}

          {/* Timestamp */}
          <div className="flex items-center justify-between text-xs text-sage/50 pt-1">
            <span>
              {notification.timestamp.toLocaleTimeString()}
            </span>
            {notification.component && (
              <span className="font-mono">
                {notification.component}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Main notification container
export const AdminNotificationContainer: React.FC<{
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  maxNotifications?: number;
  className?: string;
}> = ({
  position = 'top-right',
  maxNotifications = 5,
  className
}) => {
  const { notifications, removeNotification } = useAdminNotifications();

  const positionClasses = {
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6',
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6'
  };

  const visibleNotifications = notifications
    .slice(-maxNotifications)
    .sort((a, b) => {
      // Sort by priority first, then by timestamp
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

  if (visibleNotifications.length === 0) return null;

  return (
    <div className={cn(
      'fixed z-50 space-y-3 w-96 max-w-[calc(100vw-2rem)]',
      positionClasses[position],
      className
    )}>
      <AnimatePresence>
        {visibleNotifications.map((notification) => (
          <AdminNotificationItem
            key={notification.id}
            notification={notification}
            onDismiss={removeNotification}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

// Provider component
export const AdminNotificationProvider: React.FC<{
  children: React.ReactNode;
  maxNotifications?: number;
  persistentStorage?: boolean;
}> = ({ 
  children, 
  maxNotifications = 50,
  persistentStorage = true
}) => {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);

  // Load persistent notifications from localStorage on mount
  useEffect(() => {
    if (persistentStorage) {
      try {
        const stored = localStorage.getItem('admin-notifications');
        if (stored) {
          const parsed = JSON.parse(stored).map((n: any) => ({
            ...n,
            timestamp: new Date(n.timestamp)
          }));
          const persistentNotifications = parsed.filter((n: AdminNotification) => n.persistent);
          setNotifications(persistentNotifications);
        }
      } catch (error) {
        console.error('Failed to load persistent notifications:', error);
      }
    }
  }, [persistentStorage]);

  // Save persistent notifications to localStorage
  useEffect(() => {
    if (persistentStorage) {
      const persistentNotifications = notifications.filter(n => n.persistent);
      try {
        localStorage.setItem('admin-notifications', JSON.stringify(persistentNotifications));
      } catch (error) {
        console.error('Failed to save persistent notifications:', error);
      }
    }
  }, [notifications, persistentStorage]);

  const addNotification = useCallback((
    notificationData: Omit<AdminNotification, 'id' | 'timestamp'>
  ): string => {
    const id = `admin-notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const notification: AdminNotification = {
      ...notificationData,
      id,
      timestamp: new Date()
    };

    setNotifications(prev => {
      const newNotifications = [...prev, notification];
      // Keep only the most recent notifications
      return newNotifications.slice(-maxNotifications);
    });

    return id;
  }, [maxNotifications]);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearNotifications = useCallback((category?: NotificationCategory) => {
    if (category) {
      setNotifications(prev => prev.filter(n => n.category !== category));
    } else {
      setNotifications([]);
    }
  }, []);

  const markAsRead = useCallback((id: string) => {
    // For now, we'll just remove read notifications
    // In a full implementation, you might have a 'read' flag
    removeNotification(id);
  }, [removeNotification]);

  const getUnreadCount = useCallback(() => {
    return notifications.length;
  }, [notifications]);

  const contextValue: NotificationContextType = {
    showApiError: (message: string, details?: string, action?: AdminNotification["action"]) =>
      addNotification({
        type: "error",
        priority: "medium",
        category: "api",
        title: "API Error",
        message,
        details,
        action,
        duration: 8000
      }),
    showSystemError: (message: string, details?: string, action?: AdminNotification["action"]) =>
      addNotification({
        type: "error",
        priority: "high",
        category: "system",
        title: "System Error",
        message,
        details,
        action,
        duration: 0
      }),
    showAuthError: (message: string, details?: string) =>
      addNotification({
        type: "error",
        priority: "high",
        category: "auth",
        title: "Authentication Failed",
        message,
        details,
        duration: 0
      }),
    showSecurityAlert: (message: string, details?: string) =>
      addNotification({
        type: "security",
        priority: "critical",
        category: "security",
        title: "Security Alert",
        message,
        details,
        duration: 0,
        persistent: true
      }),
    notifications,
    addNotification,
    removeNotification,
    clearNotifications,
    markAsRead,
    getUnreadCount
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <AdminNotificationContainer />
    </NotificationContext.Provider>
  );
};

export default AdminNotificationProvider;