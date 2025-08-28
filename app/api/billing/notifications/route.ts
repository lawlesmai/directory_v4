/**
 * EPIC 5 STORY 5.5: Billing Notifications API Route
 * Provides real-time billing alerts and notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// =============================================
// TYPES AND INTERFACES
// =============================================

interface BillingNotification {
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

// =============================================
// API HANDLER
// =============================================

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    // Get user's subscription and payment data
    const [subscriptionResult, paymentMethodsResult, recentTransactionsResult] = await Promise.all([
      supabase
        .from('subscriptions')
        .select(`
          *,
          plan:subscription_plans(*)
        `)
        .eq('user_id', user.id)
        .single(),
      
      supabase
        .from('stripe_payment_methods')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      
      supabase
        .from('payment_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)
    ]);

    const subscription = subscriptionResult.data;
    const paymentMethods = paymentMethodsResult.data || [];
    const recentTransactions = recentTransactionsResult.data || [];

    const notifications: BillingNotification[] = [];

    // Generate notifications based on subscription status
    if (subscription) {
      // Trial ending notifications
      if (subscription.status === 'trialing' && subscription.trial_end) {
        const trialEndDate = new Date(subscription.trial_end);
        const daysRemaining = Math.ceil((trialEndDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysRemaining <= 7 && daysRemaining > 0) {
          notifications.push({
            id: `trial-ending-${subscription.id}`,
            type: 'trial_ending',
            severity: daysRemaining <= 3 ? 'error' : 'warning',
            title: 'Trial Ending Soon',
            message: `Your free trial ends in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}. Add a payment method to continue with premium features.`,
            actionLabel: 'Add Payment Method',
            actionUrl: '/dashboard/billing?tab=payment-methods',
            dismissible: true,
            createdAt: new Date(),
            expiresAt: trialEndDate,
            metadata: {
              daysRemaining,
              planName: subscription.plan?.name,
            },
          });
        }
      }

      // Subscription ending notifications
      if (subscription.cancel_at_period_end && subscription.current_period_end) {
        const endDate = new Date(subscription.current_period_end);
        const daysRemaining = Math.ceil((endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysRemaining <= 14) {
          notifications.push({
            id: `subscription-ending-${subscription.id}`,
            type: 'subscription_ending',
            severity: daysRemaining <= 3 ? 'error' : 'warning',
            title: 'Subscription Ending',
            message: `Your subscription will be canceled in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}. Reactivate to maintain access to premium features.`,
            actionLabel: 'Reactivate Subscription',
            actionUrl: '/dashboard/billing?tab=subscription',
            dismissible: true,
            createdAt: new Date(),
            expiresAt: endDate,
            metadata: {
              daysRemaining,
              planName: subscription.plan?.name,
            },
          });
        }
      }

      // Past due notifications
      if (subscription.status === 'past_due') {
        notifications.push({
          id: `past-due-${subscription.id}`,
          type: 'payment_failed',
          severity: 'error',
          title: 'Payment Failed',
          message: 'Your last payment was unsuccessful. Please update your payment method to avoid service interruption.',
          actionLabel: 'Update Payment Method',
          actionUrl: '/dashboard/billing?tab=payment-methods',
          dismissible: false,
          createdAt: new Date(),
          metadata: {
            amount: subscription.plan?.amount,
            currency: subscription.plan?.currency,
            planName: subscription.plan?.name,
          },
        });
      }
    }

    // Payment method expiring notifications
    paymentMethods.forEach(method => {
      if (method.type === 'card' && method.card_exp_month && method.card_exp_year) {
        const expiryDate = new Date(method.card_exp_year, method.card_exp_month - 1);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
          notifications.push({
            id: `payment-method-expiring-${method.id}`,
            type: 'payment_method_expiring',
            severity: daysUntilExpiry <= 7 ? 'error' : 'warning',
            title: 'Payment Method Expiring',
            message: `Your ${method.card_brand} card ending in ${method.card_last4} expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}.`,
            actionLabel: 'Update Card',
            actionUrl: '/dashboard/billing?tab=payment-methods',
            dismissible: true,
            createdAt: new Date(),
            expiresAt: expiryDate,
            metadata: {
              daysRemaining: daysUntilExpiry,
              paymentMethodLast4: method.card_last4,
            },
          });
        }
      }
    });

    // Recent successful payment notifications (last 24 hours)
    const recentSuccessfulPayments = recentTransactions
      .filter(transaction => 
        transaction.status === 'succeeded' && 
        new Date(transaction.created_at).getTime() > Date.now() - (24 * 60 * 60 * 1000)
      );

    recentSuccessfulPayments.forEach(transaction => {
      notifications.push({
        id: `payment-success-${transaction.id}`,
        type: 'payment_success',
        severity: 'success',
        title: 'Payment Successful',
        message: `Your payment has been processed successfully.`,
        actionLabel: 'View Invoice',
        actionUrl: `/dashboard/billing?tab=invoices`,
        dismissible: true,
        createdAt: new Date(transaction.created_at),
        expiresAt: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)), // Expires in 7 days
        metadata: {
          amount: transaction.amount,
          currency: transaction.currency,
        },
      });
    });

    // Usage limit notifications (mock data - in production would come from usage tracking)
    if (subscription) {
      const mockUsage = [
        { name: 'Photo Uploads', current: 47, limit: 100, percentage: 47 },
        { name: 'API Calls', current: 890, limit: 1000, percentage: 89 },
      ];

      mockUsage.forEach(usage => {
        if (usage.percentage >= 90) {
          notifications.push({
            id: `usage-limit-${usage.name.toLowerCase().replace(' ', '-')}`,
            type: 'usage_limit',
            severity: usage.percentage >= 95 ? 'error' : 'warning',
            title: `${usage.name} Limit`,
            message: `You've used ${usage.percentage}% of your ${usage.name.toLowerCase()} limit.`,
            actionLabel: 'Upgrade Plan',
            actionUrl: '/dashboard/billing?tab=subscription',
            dismissible: true,
            createdAt: new Date(),
            metadata: {
              usagePercentage: usage.percentage,
            },
          });
        }
      });
    }

    // Sort notifications by priority (severity and creation date)
    const sortedNotifications = notifications.sort((a, b) => {
      const severityOrder = { 'error': 0, 'warning': 1, 'info': 2, 'success': 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      
      if (severityDiff !== 0) return severityDiff;
      
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Filter out expired notifications
    const activeNotifications = sortedNotifications.filter(notification => 
      !notification.expiresAt || new Date(notification.expiresAt) > new Date()
    );

    return NextResponse.json(activeNotifications);

  } catch (error) {
    console.error('Billing notifications error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================
// DISMISS NOTIFICATION ENDPOINT
// =============================================

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const body = await request.json();
    
    const { notificationId } = z.object({
      notificationId: z.string(),
    }).parse(body);

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    // In a production system, you would store dismissed notifications in the database
    // For now, we'll just acknowledge the dismissal
    
    // Store dismissal in user preferences or a separate table
    const { error: insertError } = await supabase
      .from('dismissed_notifications')
      .insert({
        user_id: user.id,
        notification_id: notificationId,
        dismissed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error storing notification dismissal:', insertError);
      // Don't fail the request if we can't store the dismissal
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Dismiss notification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}