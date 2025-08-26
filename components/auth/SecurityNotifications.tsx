'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, Shield, AlertTriangle, CheckCircle, Info, X,
  Lock, Key, Smartphone, Mail, Clock, TrendingUp,
  Award, ShieldCheck, AlertCircle, XCircle
} from 'lucide-react';
import { GlassMorphism } from '../GlassMorphism';
import { cn } from '@/lib/utils';

type NotificationType = 'success' | 'warning' | 'error' | 'info' | 'achievement';

interface SecurityNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  icon?: React.ComponentType<any>;
  actionLabel?: string;
  onAction?: () => void;
  persistent?: boolean;
  priority?: 'low' | 'medium' | 'high';
}

interface SecurityNotificationsProps {
  notifications?: SecurityNotification[];
  onDismiss?: (id: string) => void;
  className?: string;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  maxVisible?: number;
}

export const SecurityNotifications: React.FC<SecurityNotificationsProps> = ({
  notifications: externalNotifications,
  onDismiss,
  className = '',
  position = 'top-right',
  maxVisible = 3
}) => {
  const [notifications, setNotifications] = useState<SecurityNotification[]>(
    externalNotifications || []
  );
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Sample notifications for demonstration
  useEffect(() => {
    if (!externalNotifications) {
      // Simulate incoming notifications
      const sampleNotifications: SecurityNotification[] = [
        {
          id: '1',
          type: 'warning',
          title: 'Password Expiring Soon',
          message: 'Your password will expire in 7 days. Update it to maintain account security.',
          timestamp: new Date(),
          icon: Lock,
          actionLabel: 'Update Now',
          priority: 'high',
          persistent: true
        },
        {
          id: '2',
          type: 'info',
          title: 'New Security Feature',
          message: 'Biometric authentication is now available for your account.',
          timestamp: new Date(Date.now() - 60000),
          icon: Shield,
          actionLabel: 'Learn More',
          priority: 'medium'
        },
        {
          id: '3',
          type: 'achievement',
          title: 'Security Milestone',
          message: 'You\'ve maintained a perfect security score for 30 days!',
          timestamp: new Date(Date.now() - 120000),
          icon: Award,
          priority: 'low'
        }
      ];
      
      // Stagger notification appearance
      sampleNotifications.forEach((notification, index) => {
        setTimeout(() => {
          setNotifications(prev => [...prev, notification]);
        }, index * 500);
      });
    }
  }, [externalNotifications]);

  useEffect(() => {
    if (externalNotifications) {
      setNotifications(externalNotifications);
    }
  }, [externalNotifications]);

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
      onDismiss?.(id);
    }, 300);
  };

  const visibleNotifications = notifications
    .filter(n => !dismissedIds.has(n.id))
    .sort((a, b) => {
      // Sort by priority then by timestamp
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const aPriority = priorityOrder[a.priority || 'low'];
      const bPriority = priorityOrder[b.priority || 'low'];
      if (aPriority !== bPriority) return aPriority - bPriority;
      return b.timestamp.getTime() - a.timestamp.getTime();
    })
    .slice(0, maxVisible);

  const getNotificationConfig = (type: NotificationType) => {
    const configs = {
      success: {
        icon: CheckCircle,
        bgColor: 'from-sage/20 to-teal-primary/20',
        borderColor: 'border-sage/30',
        iconColor: 'text-sage',
        titleColor: 'text-sage'
      },
      warning: {
        icon: AlertTriangle,
        bgColor: 'from-gold-primary/20 to-gold-secondary/20',
        borderColor: 'border-gold-primary/30',
        iconColor: 'text-gold-primary',
        titleColor: 'text-gold-primary'
      },
      error: {
        icon: XCircle,
        bgColor: 'from-red-error/20 to-red-warning/20',
        borderColor: 'border-red-error/30',
        iconColor: 'text-red-error',
        titleColor: 'text-red-error'
      },
      info: {
        icon: Info,
        bgColor: 'from-teal-primary/20 to-teal-secondary/20',
        borderColor: 'border-teal-primary/30',
        iconColor: 'text-teal-primary',
        titleColor: 'text-teal-primary'
      },
      achievement: {
        icon: Award,
        bgColor: 'from-cream/20 to-gold-primary/20',
        borderColor: 'border-cream/30',
        iconColor: 'text-cream',
        titleColor: 'text-cream'
      }
    };
    return configs[type];
  };

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4'
  };

  // Auto-dismiss non-persistent notifications
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    
    notifications.forEach(notification => {
      if (!notification.persistent && !dismissedIds.has(notification.id)) {
        const timer = setTimeout(() => {
          handleDismiss(notification.id);
        }, 5000);
        timers.push(timer);
      }
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [notifications, dismissedIds]);

  return (
    <div className={cn(
      'fixed z-50 pointer-events-none',
      positionClasses[position],
      className
    )}>
      <div className="space-y-3 pointer-events-auto">
        <AnimatePresence>
          {visibleNotifications.map((notification) => {
            const config = getNotificationConfig(notification.type);
            const Icon = notification.icon || config.icon;

            return (
              <motion.div
                key={notification.id}
                layout
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              >
                <GlassMorphism
                  variant="strong"
                  className={cn(
                    'w-80 p-4 border',
                    config.borderColor
                  )}
                  animated
                  interactive
                  shadow
                >
                  <div className={cn(
                    'absolute inset-0 bg-gradient-to-br opacity-30 rounded-lg',
                    config.bgColor
                  )} />
                  
                  <div className="relative">
                    {/* Header */}
                    <div className="flex items-start gap-3 mb-2">
                      <div className={cn(
                        'p-2 rounded-full bg-navy-50/20',
                        'flex-shrink-0'
                      )}>
                        <Icon className={cn('w-4 h-4', config.iconColor)} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className={cn(
                          'text-sm font-semibold',
                          config.titleColor
                        )}>
                          {notification.title}
                        </h4>
                        <p className="text-xs text-sage/70 mt-1">
                          {notification.message}
                        </p>
                      </div>

                      <button
                        onClick={() => handleDismiss(notification.id)}
                        className="p-1 rounded hover:bg-navy-50/20 transition-colors"
                      >
                        <X className="w-3 h-3 text-sage/50 hover:text-sage" />
                      </button>
                    </div>

                    {/* Action Button */}
                    {notification.actionLabel && (
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-sage/50 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(notification.timestamp)}
                        </span>
                        <button
                          onClick={() => {
                            notification.onAction?.();
                            handleDismiss(notification.id);
                          }}
                          className={cn(
                            'px-3 py-1.5 text-xs font-medium rounded',
                            'transition-all duration-200',
                            notification.type === 'warning'
                              ? 'bg-gold-primary/20 text-gold-primary hover:bg-gold-primary/30'
                              : notification.type === 'error'
                              ? 'bg-red-error/20 text-red-error hover:bg-red-error/30'
                              : 'bg-teal-primary/20 text-teal-primary hover:bg-teal-primary/30'
                          )}
                        >
                          {notification.actionLabel}
                        </button>
                      </div>
                    )}

                    {/* Priority Indicator */}
                    {notification.priority === 'high' && (
                      <motion.div
                        className="absolute -top-1 -right-1"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-error opacity-75" />
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-error" />
                        </span>
                      </motion.div>
                    )}
                  </div>
                </GlassMorphism>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Inline notification component for embedding in forms
export const InlineSecurityNotification: React.FC<{
  type: NotificationType;
  title?: string;
  message: string;
  onDismiss?: () => void;
  className?: string;
}> = ({ type, title, message, onDismiss, className = '' }) => {
  const config = {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-sage/10',
      borderColor: 'border-sage/30',
      iconColor: 'text-sage'
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-gold-primary/10',
      borderColor: 'border-gold-primary/30',
      iconColor: 'text-gold-primary'
    },
    error: {
      icon: AlertCircle,
      bgColor: 'bg-red-error/10',
      borderColor: 'border-red-error/30',
      iconColor: 'text-red-error'
    },
    info: {
      icon: Info,
      bgColor: 'bg-teal-primary/10',
      borderColor: 'border-teal-primary/30',
      iconColor: 'text-teal-primary'
    },
    achievement: {
      icon: Award,
      bgColor: 'bg-cream/10',
      borderColor: 'border-cream/30',
      iconColor: 'text-cream'
    }
  }[type];

  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'p-3 rounded-lg border',
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      <div className="flex items-start gap-2">
        <Icon className={cn('w-4 h-4 flex-shrink-0 mt-0.5', config.iconColor)} />
        <div className="flex-1">
          {title && (
            <p className={cn('text-sm font-medium mb-1', config.iconColor)}>
              {title}
            </p>
          )}
          <p className={cn(
            'text-xs',
            title ? 'text-sage/70' : config.iconColor
          )}>
            {message}
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 hover:bg-navy-50/20 rounded transition-colors"
          >
            <X className="w-3 h-3 text-sage/50 hover:text-sage" />
          </button>
        )}
      </div>
    </motion.div>
  );
};

// Security activity component
export const SecurityActivity: React.FC<{
  activities: Array<{
    id: string;
    type: 'login' | 'logout' | 'password_change' | 'settings_update' | 'suspicious';
    description: string;
    timestamp: Date;
    location?: string;
    device?: string;
  }>;
  className?: string;
}> = ({ activities, className = '' }) => {
  const getActivityIcon = (type: string) => {
    const icons = {
      login: Smartphone,
      logout: Smartphone,
      password_change: Lock,
      settings_update: Shield,
      suspicious: AlertTriangle
    };
    return icons[type as keyof typeof icons] || Shield;
  };

  const getActivityColor = (type: string) => {
    const colors = {
      login: 'text-sage',
      logout: 'text-cream',
      password_change: 'text-teal-primary',
      settings_update: 'text-cream',
      suspicious: 'text-gold-primary'
    };
    return colors[type as keyof typeof colors] || 'text-sage';
  };

  return (
    <GlassMorphism
      variant="subtle"
      className={cn('p-4', className)}
      border
    >
      <h3 className="text-sm font-semibold text-cream mb-3">Recent Activity</h3>
      <div className="space-y-3">
        {activities.map((activity) => {
          const Icon = getActivityIcon(activity.type);
          const color = getActivityColor(activity.type);

          return (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-3"
            >
              <div className="p-1.5 bg-navy-50/20 rounded-full">
                <Icon className={cn('w-3 h-3', color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-cream/80">{activity.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-sage/50">
                    {formatTimeAgo(activity.timestamp)}
                  </span>
                  {activity.location && (
                    <>
                      <span className="text-xs text-sage/30">•</span>
                      <span className="text-xs text-sage/50">{activity.location}</span>
                    </>
                  )}
                  {activity.device && (
                    <>
                      <span className="text-xs text-sage/30">•</span>
                      <span className="text-xs text-sage/50">{activity.device}</span>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </GlassMorphism>
  );
};

// Helper function to format time ago
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default SecurityNotifications;