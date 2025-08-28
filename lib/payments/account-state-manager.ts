/**
 * EPIC 5 STORY 5.7: Payment Failure Recovery & Dunning Management
 * Account State Management - Graceful degradation and feature restrictions
 * 
 * This service manages account states during payment recovery, implementing
 * grace periods, progressive feature restrictions, and smooth reactivation flows.
 */

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import type { PaymentFailure } from './payment-failure-handler';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface AccountState {
  id: string;
  customerId: string;
  subscriptionId?: string;
  state: 'active' | 'grace_period' | 'restricted' | 'suspended' | 'canceled';
  previousState?: string;
  reason: string;
  gracePeriodEnd?: Date;
  suspensionDate?: Date;
  reactivationDate?: Date;
  featureRestrictions: string[];
  dataRetentionPeriod: number;
  automatedActions: Record<string, any>;
  manualOverride: boolean;
  overrideReason?: string;
  overrideBy?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureAccess {
  feature: string;
  allowed: boolean;
  reason?: string;
  gracePeriodEnd?: Date;
}

export interface StateTransition {
  from: string;
  to: string;
  reason: string;
  triggeredBy: 'system' | 'manual' | 'payment_success' | 'payment_failure';
  metadata?: Record<string, any>;
}

// =============================================
// VALIDATION SCHEMAS
// =============================================

const CreateAccountStateSchema = z.object({
  customerId: z.string().uuid(),
  subscriptionId: z.string().uuid().optional(),
  state: z.enum(['active', 'grace_period', 'restricted', 'suspended', 'canceled']),
  reason: z.string(),
  gracePeriodDays: z.number().optional().default(3),
  featureRestrictions: z.array(z.string()).default([]),
  dataRetentionPeriod: z.number().default(90),
  automatedActions: z.record(z.any()).default({}),
  metadata: z.record(z.any()).optional(),
});

const UpdateAccountStateSchema = z.object({
  accountStateId: z.string().uuid(),
  state: z.enum(['active', 'grace_period', 'restricted', 'suspended', 'canceled']),
  reason: z.string(),
  manualOverride: z.boolean().default(false),
  overrideReason: z.string().optional(),
  overrideBy: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
});

const CheckFeatureAccessSchema = z.object({
  customerId: z.string().uuid(),
  feature: z.string(),
});

// =============================================
// ACCOUNT STATE MANAGER CLASS
// =============================================

class AccountStateManager {
  private supabase;

  // Feature restriction configurations
  private readonly FEATURE_RESTRICTIONS = {
    grace_period: {
      restrictions: [],
      gracePeriodDays: 3,
      allowedFeatures: ['basic_access', 'data_export', 'billing_update'],
    },
    restricted: {
      restrictions: ['new_data_creation', 'advanced_features', 'api_access'],
      gracePeriodDays: 0,
      allowedFeatures: ['read_only_access', 'billing_update', 'data_export'],
    },
    suspended: {
      restrictions: ['all_features'],
      gracePeriodDays: 0,
      allowedFeatures: ['billing_update', 'account_reactivation'],
    },
    canceled: {
      restrictions: ['all_features'],
      gracePeriodDays: 0,
      allowedFeatures: ['data_export', 'account_reactivation'],
    },
  };

  // Grace period configuration by customer segment
  private readonly GRACE_PERIODS = {
    new: 3, // 3 days for new customers
    existing: 5, // 5 days for existing customers
    high_value: 7, // 7 days for high-value customers
    at_risk: 1, // 1 day for at-risk customers
  };

  constructor() {
    this.supabase = createClient();
  }

  // =============================================
  // ACCOUNT STATE MANAGEMENT
  // =============================================

  /**
   * Create or update account state based on payment failure
   */
  async processPaymentFailure(failure: PaymentFailure): Promise<AccountState> {
    try {
      // Get current account state
      const currentState = await this.getCurrentAccountState(failure.customerId);
      
      // Determine customer segment for grace period calculation
      const customerSegment = await this.getCustomerSegment(failure.customerId);
      
      // Calculate appropriate state transition
      const newState = this.calculateStateFromFailure(failure, currentState, customerSegment);
      
      if (currentState) {
        // Update existing state
        return await this.updateAccountState({
          accountStateId: currentState.id,
          state: newState.state,
          reason: newState.reason,
          metadata: {
            payment_failure_id: failure.id,
            failure_reason: failure.failureReason,
            failure_count: failure.retryCount + 1,
          },
        });
      } else {
        // Create new account state
        return await this.createAccountState({
          customerId: failure.customerId,
          subscriptionId: failure.subscriptionId,
          state: newState.state,
          reason: newState.reason,
          gracePeriodDays: newState.gracePeriodDays,
          featureRestrictions: newState.featureRestrictions,
          metadata: {
            payment_failure_id: failure.id,
            failure_reason: failure.failureReason,
            failure_count: failure.retryCount + 1,
          },
        });
      }
    } catch (error) {
      console.error('Process payment failure error:', error);
      throw new Error(`Failed to process payment failure: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create new account state
   */
  async createAccountState(data: z.infer<typeof CreateAccountStateSchema>): Promise<AccountState> {
    try {
      const validatedData = CreateAccountStateSchema.parse(data);

      // Calculate grace period end if applicable
      let gracePeriodEnd: string | undefined;
      if (validatedData.state === 'grace_period' && validatedData.gracePeriodDays) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + validatedData.gracePeriodDays);
        gracePeriodEnd = endDate.toISOString();
      }

      // Create account state record
      const { data: accountState, error } = await this.supabase
        .from('account_states')
        .insert({
          customer_id: validatedData.customerId,
          subscription_id: validatedData.subscriptionId,
          state: validatedData.state,
          reason: validatedData.reason,
          grace_period_end: gracePeriodEnd,
          feature_restrictions: validatedData.featureRestrictions,
          data_retention_period: validatedData.dataRetentionPeriod,
          automated_actions: validatedData.automatedActions,
          metadata: validatedData.metadata,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      const mappedState = this.mapAccountStateFromDB(accountState);

      // Execute state transition actions
      await this.executeStateTransitionActions(mappedState, 'system');

      return mappedState;
    } catch (error) {
      console.error('Create account state error:', error);
      throw new Error(`Failed to create account state: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update existing account state
   */
  async updateAccountState(data: z.infer<typeof UpdateAccountStateSchema>): Promise<AccountState> {
    try {
      const validatedData = UpdateAccountStateSchema.parse(data);

      // Get current state for transition tracking
      const currentState = await this.getAccountStateById(validatedData.accountStateId);
      if (!currentState) {
        throw new Error('Account state not found');
      }

      // Calculate grace period end if transitioning to grace period
      let gracePeriodEnd: string | undefined = undefined;
      if (validatedData.state === 'grace_period') {
        const customerSegment = await this.getCustomerSegment(currentState.customerId);
        const gracePeriodDays = this.GRACE_PERIODS[customerSegment] || this.GRACE_PERIODS.existing;
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + gracePeriodDays);
        gracePeriodEnd = endDate.toISOString();
      }

      // Determine feature restrictions for new state
      const config = this.FEATURE_RESTRICTIONS[validatedData.state];
      const featureRestrictions = config ? config.restrictions : [];

      // Update account state record
      const { data: accountState, error } = await this.supabase
        .from('account_states')
        .update({
          previous_state: currentState.state,
          state: validatedData.state,
          reason: validatedData.reason,
          grace_period_end: gracePeriodEnd,
          feature_restrictions: featureRestrictions,
          manual_override: validatedData.manualOverride,
          override_reason: validatedData.overrideReason,
          override_by: validatedData.overrideBy,
          metadata: {
            ...currentState.metadata,
            ...validatedData.metadata,
          },
        })
        .eq('id', validatedData.accountStateId)
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      const mappedState = this.mapAccountStateFromDB(accountState);

      // Execute state transition actions
      await this.executeStateTransitionActions(
        mappedState,
        validatedData.manualOverride ? 'manual' : 'system'
      );

      return mappedState;
    } catch (error) {
      console.error('Update account state error:', error);
      throw new Error(`Failed to update account state: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process successful payment and potentially reactivate account
   */
  async processPaymentSuccess(customerId: string, paymentIntentId: string): Promise<AccountState | null> {
    try {
      const currentState = await this.getCurrentAccountState(customerId);
      
      if (!currentState || currentState.state === 'active') {
        return currentState; // No action needed
      }

      // Reactivate account if payment was successful
      return await this.updateAccountState({
        accountStateId: currentState.id,
        state: 'active',
        reason: 'payment_recovered',
        metadata: {
          payment_intent_id: paymentIntentId,
          reactivated_from: currentState.state,
          reactivated_at: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Process payment success error:', error);
      throw new Error(`Failed to process payment success: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // FEATURE ACCESS CONTROL
  // =============================================

  /**
   * Check if customer has access to a specific feature
   */
  async checkFeatureAccess(data: z.infer<typeof CheckFeatureAccessSchema>): Promise<FeatureAccess> {
    try {
      const validatedData = CheckFeatureAccessSchema.parse(data);

      const accountState = await this.getCurrentAccountState(validatedData.customerId);
      
      if (!accountState || accountState.state === 'active') {
        return {
          feature: validatedData.feature,
          allowed: true,
        };
      }

      // Check if feature is explicitly allowed for current state
      const config = this.FEATURE_RESTRICTIONS[accountState.state];
      if (config && config.allowedFeatures.includes(validatedData.feature)) {
        return {
          feature: validatedData.feature,
          allowed: true,
          reason: `Feature allowed in ${accountState.state} state`,
          gracePeriodEnd: accountState.gracePeriodEnd,
        };
      }

      // Check if feature is restricted
      const isRestricted = accountState.featureRestrictions.includes(validatedData.feature) ||
                          accountState.featureRestrictions.includes('all_features');

      if (isRestricted) {
        return {
          feature: validatedData.feature,
          allowed: false,
          reason: `Feature restricted due to account state: ${accountState.state}`,
          gracePeriodEnd: accountState.gracePeriodEnd,
        };
      }

      // Feature not explicitly restricted, allow access
      return {
        feature: validatedData.feature,
        allowed: true,
        reason: 'Feature not restricted',
      };
    } catch (error) {
      console.error('Check feature access error:', error);
      // Fail open for security - allow access if there's an error
      return {
        feature: data.feature,
        allowed: true,
        reason: 'Error checking access - defaulting to allow',
      };
    }
  }

  /**
   * Get all feature restrictions for customer
   */
  async getFeatureRestrictions(customerId: string): Promise<{
    accountState: string;
    restrictions: string[];
    allowedFeatures: string[];
    gracePeriodEnd?: Date;
  }> {
    try {
      const accountState = await this.getCurrentAccountState(customerId);
      
      if (!accountState || accountState.state === 'active') {
        return {
          accountState: 'active',
          restrictions: [],
          allowedFeatures: ['all_features'],
        };
      }

      const config = this.FEATURE_RESTRICTIONS[accountState.state];
      
      return {
        accountState: accountState.state,
        restrictions: accountState.featureRestrictions,
        allowedFeatures: config ? config.allowedFeatures : [],
        gracePeriodEnd: accountState.gracePeriodEnd,
      };
    } catch (error) {
      console.error('Get feature restrictions error:', error);
      return {
        accountState: 'error',
        restrictions: [],
        allowedFeatures: ['all_features'],
      };
    }
  }

  // =============================================
  // GRACE PERIOD MANAGEMENT
  // =============================================

  /**
   * Process expired grace periods (called by background job)
   */
  async processExpiredGracePeriods(): Promise<{
    processed: number;
    suspended: number;
    errors: number;
  }> {
    try {
      // Get accounts with expired grace periods
      const { data: expiredStates } = await this.supabase
        .from('account_states')
        .select('*')
        .eq('state', 'grace_period')
        .lte('grace_period_end', new Date().toISOString())
        .order('grace_period_end')
        .limit(100); // Process in batches

      if (!expiredStates || expiredStates.length === 0) {
        return { processed: 0, suspended: 0, errors: 0 };
      }

      let suspended = 0;
      let errors = 0;

      for (const stateData of expiredStates) {
        try {
          const state = this.mapAccountStateFromDB(stateData);
          
          // Transition to suspended state
          await this.updateAccountState({
            accountStateId: state.id,
            state: 'suspended',
            reason: 'grace_period_expired',
            metadata: {
              grace_period_expired_at: new Date().toISOString(),
              previous_grace_period_end: state.gracePeriodEnd?.toISOString(),
            },
          });

          suspended++;
        } catch (error) {
          console.error(`Failed to suspend account ${stateData.id}:`, error);
          errors++;
        }
      }

      return {
        processed: expiredStates.length,
        suspended,
        errors,
      };
    } catch (error) {
      console.error('Process expired grace periods error:', error);
      throw new Error(`Failed to process expired grace periods: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // HELPER METHODS
  // =============================================

  /**
   * Calculate new state from payment failure
   */
  private calculateStateFromFailure(
    failure: PaymentFailure,
    currentState: AccountState | null,
    customerSegment: string
  ): {
    state: 'active' | 'grace_period' | 'restricted' | 'suspended' | 'canceled';
    reason: string;
    gracePeriodDays: number;
    featureRestrictions: string[];
  } {
    // First failure - start grace period
    if (!currentState || currentState.state === 'active') {
      return {
        state: 'grace_period',
        reason: 'payment_failure',
        gracePeriodDays: this.GRACE_PERIODS[customerSegment] || this.GRACE_PERIODS.existing,
        featureRestrictions: this.FEATURE_RESTRICTIONS.grace_period.restrictions,
      };
    }

    // Already in grace period - check retry count and failure severity
    if (currentState.state === 'grace_period') {
      if (failure.retryCount >= 2) {
        return {
          state: 'restricted',
          reason: 'multiple_payment_failures',
          gracePeriodDays: 0,
          featureRestrictions: this.FEATURE_RESTRICTIONS.restricted.restrictions,
        };
      }
      // Stay in grace period but extend if needed
      return {
        state: 'grace_period',
        reason: 'payment_failure_retry',
        gracePeriodDays: this.GRACE_PERIODS[customerSegment] || this.GRACE_PERIODS.existing,
        featureRestrictions: this.FEATURE_RESTRICTIONS.grace_period.restrictions,
      };
    }

    // Already restricted - move to suspended
    if (currentState.state === 'restricted') {
      return {
        state: 'suspended',
        reason: 'continued_payment_failure',
        gracePeriodDays: 0,
        featureRestrictions: this.FEATURE_RESTRICTIONS.suspended.restrictions,
      };
    }

    // Default to current state
    return {
      state: currentState.state,
      reason: 'payment_failure_no_change',
      gracePeriodDays: 0,
      featureRestrictions: currentState.featureRestrictions,
    };
  }

  /**
   * Get customer segment for grace period calculation
   */
  private async getCustomerSegment(customerId: string): Promise<'new' | 'existing' | 'high_value' | 'at_risk'> {
    try {
      // Get customer and subscription information
      const { data: customer } = await this.supabase
        .from('stripe_customers')
        .select(`
          *,
          subscriptions (
            created_at,
            status,
            plan_id,
            subscription_plans (amount)
          )
        `)
        .eq('id', customerId)
        .single();

      if (!customer) {
        return 'existing'; // Default
      }

      const customerAge = new Date().getTime() - new Date(customer.created_at).getTime();
      const ageInDays = customerAge / (1000 * 60 * 60 * 24);

      // New customer (less than 30 days)
      if (ageInDays < 30) {
        return 'new';
      }

      // High value customer (subscription > $100/month)
      if (customer.subscriptions && customer.subscriptions.length > 0) {
        const activeSubscription = customer.subscriptions.find((sub: any) => sub.status === 'active');
        if (activeSubscription && activeSubscription.subscription_plans?.amount > 10000) { // $100 in cents
          return 'high_value';
        }
      }

      // At risk customer (multiple payment failures in past)
      const { count } = await this.supabase
        .from('payment_failures')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', customerId)
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()); // Last 90 days

      if (count && count > 3) {
        return 'at_risk';
      }

      return 'existing';
    } catch (error) {
      console.error('Get customer segment error:', error);
      return 'existing'; // Default fallback
    }
  }

  /**
   * Execute actions when transitioning account states
   */
  private async executeStateTransitionActions(accountState: AccountState, triggeredBy: string): Promise<void> {
    try {
      const actions = [];

      switch (accountState.state) {
        case 'grace_period':
          actions.push('send_grace_period_notification');
          actions.push('schedule_grace_period_reminder');
          break;

        case 'restricted':
          actions.push('send_restriction_notification');
          actions.push('disable_advanced_features');
          break;

        case 'suspended':
          actions.push('send_suspension_notification');
          actions.push('disable_all_features');
          actions.push('schedule_data_retention_warning');
          break;

        case 'active':
          actions.push('send_reactivation_notification');
          actions.push('restore_all_features');
          break;

        case 'canceled':
          actions.push('send_cancellation_notification');
          actions.push('schedule_data_deletion');
          break;
      }

      // Record automated actions
      await this.supabase
        .from('account_states')
        .update({
          automated_actions: {
            ...accountState.automatedActions,
            [accountState.state]: {
              actions,
              executed_at: new Date().toISOString(),
              triggered_by: triggeredBy,
            },
          },
        })
        .eq('id', accountState.id);

      // Execute actions (placeholder implementations)
      for (const action of actions) {
        await this.executeAction(action, accountState);
      }
    } catch (error) {
      console.error('Execute state transition actions error:', error);
      // Don't throw to avoid blocking main flow
    }
  }

  /**
   * Execute individual action
   */
  private async executeAction(action: string, accountState: AccountState): Promise<void> {
    // Placeholder implementations for various actions
    console.log(`Executing action: ${action} for account ${accountState.customerId}`);

    switch (action) {
      case 'send_grace_period_notification':
        // Would integrate with notification system
        break;
      
      case 'disable_advanced_features':
        // Would update feature flags or permissions
        break;
      
      case 'schedule_data_deletion':
        // Would schedule background job for data deletion
        break;
      
      default:
        console.log(`Unknown action: ${action}`);
    }
  }

  // =============================================
  // DATABASE OPERATIONS
  // =============================================

  /**
   * Get current account state for customer
   */
  private async getCurrentAccountState(customerId: string): Promise<AccountState | null> {
    try {
      const { data: accountState } = await this.supabase
        .from('account_states')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return accountState ? this.mapAccountStateFromDB(accountState) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get account state by ID
   */
  private async getAccountStateById(accountStateId: string): Promise<AccountState | null> {
    try {
      const { data: accountState } = await this.supabase
        .from('account_states')
        .select('*')
        .eq('id', accountStateId)
        .single();

      return accountState ? this.mapAccountStateFromDB(accountState) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Map database account state to interface
   */
  private mapAccountStateFromDB(accountState: any): AccountState {
    return {
      id: accountState.id,
      customerId: accountState.customer_id,
      subscriptionId: accountState.subscription_id,
      state: accountState.state,
      previousState: accountState.previous_state,
      reason: accountState.reason,
      gracePeriodEnd: accountState.grace_period_end ? new Date(accountState.grace_period_end) : undefined,
      suspensionDate: accountState.suspension_date ? new Date(accountState.suspension_date) : undefined,
      reactivationDate: accountState.reactivation_date ? new Date(accountState.reactivation_date) : undefined,
      featureRestrictions: accountState.feature_restrictions || [],
      dataRetentionPeriod: accountState.data_retention_period,
      automatedActions: accountState.automated_actions || {},
      manualOverride: accountState.manual_override,
      overrideReason: accountState.override_reason,
      overrideBy: accountState.override_by,
      metadata: accountState.metadata,
      createdAt: new Date(accountState.created_at),
      updatedAt: new Date(accountState.updated_at),
    };
  }
}

// =============================================
// SINGLETON INSTANCE
// =============================================

const accountStateManager = new AccountStateManager();

export default accountStateManager;
export { AccountStateManager };
export type { AccountState, FeatureAccess, StateTransition };