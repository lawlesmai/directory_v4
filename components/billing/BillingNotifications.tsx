/**
 * EPIC 5 STORY 5.5: Billing Notifications Component
 * Payment alerts, trial expiration, renewal reminders
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface BillingNotification {
  id: string;
  type: 'payment_failed' | 'payment_method_expiring' | 'trial_ending' | 'subscription_ending' | 'usage_limit' | 'payment_success' | 'plan_changed';
  severity: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
  dismissible: boolean;
  createdAt: Date;
  expiresAt?: Date;
  metadata?: {
    amount?: number;
    currency?: string;
    daysRemaining?: number;
    planName?: string;
    usagePercentage?: number;
    paymentMethodLast4?: string;
  };
}

export interface BillingNotificationsProps {
  className?: string;
  maxVisible?: number;
  showDismissed?: boolean;
}

// =============================================
// BILLING NOTIFICATIONS COMPONENT
// =============================================

export function BillingNotifications({ 
  className, 
  maxVisible = 3,
  showDismissed = false 
}: BillingNotificationsProps) {
  const [notifications, setNotifications] = useState<BillingNotification[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNotifications();
    
    // Set up real-time updates (in production, this would use WebSocket or Server-Sent Events)
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      setError(null);
      
      const response = await fetch('/api/billing/notifications');
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const notificationsData = await response.json();
      setNotifications(notificationsData);
    } catch (err: any) {
      console.error('Error fetching notifications:', err);
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/billing/notifications/${notificationId}/dismiss`, {
        method: 'POST',
      });

      if (response.ok) {
        setDismissedIds(prev => new Set([...prev, notificationId]));
      }
    } catch (err) {
      console.error('Error dismissing notification:', err);
    }
  };

  const handleAction = (notification: BillingNotification) => {
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getNotificationIcon = (type: string, severity: string) => {
    switch (type) {
      case 'payment_failed':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'payment_method_expiring':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v2H4V6zm0 4h12v4H4v-4z" />
          </svg>
        );
      case 'trial_ending':
      case 'subscription_ending':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        );
      case 'usage_limit':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'payment_success':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      case 'plan_changed':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const getAlertVariant = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'default';
      case 'success':
        return 'default';
      case 'info':
      default:
        return 'default';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'text-red-warning bg-red-warning/20 border-red-warning/30';
      case 'warning':
        return 'text-gold-primary bg-gold-primary/20 border-gold-primary/30';
      case 'success':
        return 'text-sage bg-sage/20 border-sage/30';
      case 'info':
      default:
        return 'text-teal-secondary bg-teal-secondary/20 border-teal-secondary/30';
    }
  };

  // Filter notifications
  const activeNotifications = notifications.filter(notification => {
    // Check if dismissed and should show dismissed
    if (dismissedIds.has(notification.id) && !showDismissed) {
      return false;
    }

    // Check if expired
    if (notification.expiresAt && new Date(notification.expiresAt) < new Date()) {
      return false;
    }

    return true;
  });

  const visibleNotifications = activeNotifications.slice(0, maxVisible);

  if (loading) {
    return null; // Don't show loading state for notifications
  }

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <div className="flex items-center justify-between">
          <span className="text-sm">Failed to load notifications</span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchNotifications}
            className="text-xs"
          >
            Retry
          </Button>
        </div>
      </Alert>
    );
  }

  if (visibleNotifications.length === 0) {
    return null; // Don't render anything if no notifications
  }

  return (
    <div className={cn("billing-notifications space-y-3", className)}>
      {visibleNotifications.map((notification) => (
        <Alert
          key={notification.id}
          variant={getAlertVariant(notification.severity)}
          className={cn(
            "relative",
            getSeverityColor(notification.severity)
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {getNotificationIcon(notification.type, notification.severity)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h4 className="font-semibold text-sm mb-1">
                    {notification.title}
                    {notification.metadata?.daysRemaining && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {notification.metadata.daysRemaining} days
                      </Badge>
                    )}
                  </h4>
                  
                  <p className="text-sm opacity-90">
                    {notification.message}
                    {notification.metadata?.amount && notification.metadata?.currency && (
                      <span className="font-semibold ml-1">
                        {formatCurrency(notification.metadata.amount, notification.metadata.currency)}
                      </span>
                    )}
                    {notification.metadata?.usagePercentage && (
                      <span className="font-semibold ml-1">
                        ({notification.metadata.usagePercentage}% used)
                      </span>
                    )}
                  </p>
                  
                  {notification.metadata?.planName && (
                    <p className="text-xs opacity-75 mt-1">
                      Plan: {notification.metadata.planName}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {notification.actionLabel && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAction(notification)}
                      className="text-xs h-7 px-2"
                    >
                      {notification.actionLabel}
                    </Button>
                  )}
                  
                  {notification.dismissible && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDismiss(notification.id)}
                      className="text-xs h-7 w-7 p-0"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-xs opacity-60 mt-2">
            {formatDate(notification.createdAt)}
          </div>
        </Alert>
      ))}
      
      {activeNotifications.length > maxVisible && (
        <div className="text-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-text-secondary hover:text-cream"
          >
            View {activeNotifications.length - maxVisible} more notifications
          </Button>
        </div>
      )}
    </div>
  );
}

export default BillingNotifications;