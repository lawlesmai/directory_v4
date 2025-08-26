/**
 * Account Lockout and Progressive Delay System
 * Epic 2 Story 2.6: Password Management and Account Security
 * 
 * Implements intelligent account lockout mechanisms with:
 * - Progressive delay algorithms
 * - Multiple lockout triggers (failed attempts, suspicious activity)
 * - Automatic recovery with exponential backoff
 * - IP-based and user-based lockouts
 * - Security incident escalation
 */

import { createClient } from '@/lib/supabase/server'
import { createSecurityEvent, getClientIP } from '@/lib/security/server'
import { NextRequest } from 'next/server'

export interface LockoutPolicy {
  // Attempt thresholds
  maxFailedAttempts: number
  maxIPAttempts: number
  maxGlobalAttempts: number
  
  // Time windows
  attemptWindowMinutes: number
  baseDelay: number // milliseconds
  maxDelay: number // milliseconds
  
  // Progressive lockout
  useProgressiveDelay: boolean
  exponentialFactor: number
  
  // Recovery
  autoUnlockAfterMinutes: number
  requireAdminUnlock: boolean
  
  // Role-based policies
  role?: 'user' | 'business_owner' | 'admin'
}

export interface LockoutStatus {
  isLocked: boolean
  lockoutType?: 'user' | 'ip' | 'global' | 'admin' | 'suspicious'
  lockedUntil?: Date
  reason?: string
  attemptCount: number
  maxAttempts: number
  nextAttemptDelay?: number
  canUnlock: boolean
  requiresAdminIntervention: boolean
  securityIncidents: number
}

export interface LockoutEvent {
  userId?: string
  ipAddress: string
  userAgent?: string
  eventType: 'failed_login' | 'suspicious_activity' | 'brute_force_detected' | 'manual_lock'
  reason: string
  metadata?: Record<string, any>
}

export interface UnlockRequest {
  userId?: string
  ipAddress?: string
  method: 'automatic' | 'admin' | 'time_based' | 'verification'
  adminUserId?: string
  verificationToken?: string
  reason?: string
}

/**
 * Account Lockout Manager
 */
export class AccountLockoutManager {
  private supabase = createClient()

  // Role-based lockout policies
  private readonly policies: Record<string, LockoutPolicy> = {
    user: {
      maxFailedAttempts: 5,
      maxIPAttempts: 15,
      maxGlobalAttempts: 100,
      attemptWindowMinutes: 15,
      baseDelay: 1000, // 1 second
      maxDelay: 300000, // 5 minutes
      useProgressiveDelay: true,
      exponentialFactor: 2,
      autoUnlockAfterMinutes: 30,
      requireAdminUnlock: false
    },
    business_owner: {
      maxFailedAttempts: 3,
      maxIPAttempts: 10,
      maxGlobalAttempts: 50,
      attemptWindowMinutes: 15,
      baseDelay: 2000, // 2 seconds
      maxDelay: 600000, // 10 minutes
      useProgressiveDelay: true,
      exponentialFactor: 2.5,
      autoUnlockAfterMinutes: 60,
      requireAdminUnlock: false
    },
    admin: {
      maxFailedAttempts: 3,
      maxIPAttempts: 5,
      maxGlobalAttempts: 20,
      attemptWindowMinutes: 10,
      baseDelay: 5000, // 5 seconds
      maxDelay: 1800000, // 30 minutes
      useProgressiveDelay: true,
      exponentialFactor: 3,
      autoUnlockAfterMinutes: 120,
      requireAdminUnlock: true
    }
  }

  /**
   * Check if account/IP is locked
   */
  async checkLockoutStatus(
    userId?: string,
    ipAddress?: string,
    role: string = 'user'
  ): Promise<LockoutStatus> {
    try {
      const policy = this.getPolicyForRole(role)
      
      // Check database for existing lockout
      const { data: lockoutData } = await this.supabase
        .rpc('check_account_lockout', {
          p_user_id: userId,
          p_ip_address: ipAddress
        })

      if (lockoutData?.[0]?.is_locked) {
        const lockout = lockoutData[0]
        return {
          isLocked: true,
          lockoutType: this.determineLockoutType(lockout.reason),
          lockedUntil: new Date(lockout.lockout_until),
          reason: lockout.reason,
          attemptCount: lockout.attempt_count,
          maxAttempts: policy.maxFailedAttempts,
          canUnlock: false,
          requiresAdminIntervention: policy.requireAdminUnlock || lockout.attempt_count > 10,
          securityIncidents: await this.getSecurityIncidentCount(userId, ipAddress)
        }
      }

      // Check recent failed attempts for progressive lockout
      const recentAttempts = await this.getRecentFailedAttempts(userId, ipAddress, policy)
      
      if (recentAttempts.userAttempts >= policy.maxFailedAttempts ||
          recentAttempts.ipAttempts >= policy.maxIPAttempts) {
        
        // Calculate progressive delay
        const delay = this.calculateProgressiveDelay(
          Math.max(recentAttempts.userAttempts, recentAttempts.ipAttempts),
          policy
        )

        // Determine if this should trigger a lockout
        const shouldLock = recentAttempts.userAttempts >= policy.maxFailedAttempts ||
                          recentAttempts.ipAttempts >= policy.maxIPAttempts

        if (shouldLock) {
          await this.applyLockout({
            userId,
            ipAddress: ipAddress!,
            eventType: 'brute_force_detected',
            reason: `Too many failed attempts: ${Math.max(recentAttempts.userAttempts, recentAttempts.ipAttempts)}`
          })
        }

        return {
          isLocked: shouldLock,
          lockoutType: recentAttempts.userAttempts >= policy.maxFailedAttempts ? 'user' : 'ip',
          attemptCount: Math.max(recentAttempts.userAttempts, recentAttempts.ipAttempts),
          maxAttempts: policy.maxFailedAttempts,
          nextAttemptDelay: delay,
          canUnlock: !policy.requireAdminUnlock,
          requiresAdminIntervention: false,
          securityIncidents: await this.getSecurityIncidentCount(userId, ipAddress)
        }
      }

      return {
        isLocked: false,
        attemptCount: Math.max(recentAttempts.userAttempts, recentAttempts.ipAttempts),
        maxAttempts: policy.maxFailedAttempts,
        canUnlock: true,
        requiresAdminIntervention: false,
        securityIncidents: await this.getSecurityIncidentCount(userId, ipAddress)
      }

    } catch (error) {
      console.error('Lockout status check error:', error)
      // Fail safe - don't lock on errors
      return {
        isLocked: false,
        attemptCount: 0,
        maxAttempts: 5,
        canUnlock: true,
        requiresAdminIntervention: false,
        securityIncidents: 0
      }
    }
  }

  /**
   * Record failed authentication attempt
   */
  async recordFailedAttempt(
    event: LockoutEvent,
    httpRequest?: NextRequest
  ): Promise<{ locked: boolean; delayMs: number; lockoutStatus: LockoutStatus }> {
    try {
      const userAgent = httpRequest?.headers.get('user-agent') || event.userAgent || 'unknown'
      const role = await this.getUserRole(event.userId)
      const policy = this.getPolicyForRole(role)

      // Record the security event
      await this.supabase
        .rpc('record_security_event', {
          p_user_id: event.userId,
          p_event_type: event.eventType,
          p_ip_address: event.ipAddress,
          p_user_agent: userAgent,
          p_metadata: {
            reason: event.reason,
            ...event.metadata
          }
        })

      // Check if this triggers a lockout
      const lockoutStatus = await this.checkLockoutStatus(event.userId, event.ipAddress, role)
      
      let delayMs = 0
      if (policy.useProgressiveDelay) {
        delayMs = this.calculateProgressiveDelay(lockoutStatus.attemptCount + 1, policy)
      }

      // Check for suspicious patterns
      const suspiciousActivity = await this.detectSuspiciousActivity(event.userId, event.ipAddress)
      if (suspiciousActivity) {
        await this.escalateSecurityIncident(event, suspiciousActivity)
      }

      return {
        locked: lockoutStatus.isLocked,
        delayMs,
        lockoutStatus: await this.checkLockoutStatus(event.userId, event.ipAddress, role)
      }

    } catch (error) {
      console.error('Failed attempt recording error:', error)
      return {
        locked: false,
        delayMs: 1000,
        lockoutStatus: {
          isLocked: false,
          attemptCount: 0,
          maxAttempts: 5,
          canUnlock: true,
          requiresAdminIntervention: false,
          securityIncidents: 0
        }
      }
    }
  }

  /**
   * Apply lockout to account or IP
   */
  async applyLockout(event: LockoutEvent): Promise<boolean> {
    try {
      const role = await this.getUserRole(event.userId)
      const policy = this.getPolicyForRole(role)
      const lockoutUntil = new Date(Date.now() + policy.autoUnlockAfterMinutes * 60 * 1000)

      // Insert lockout record
      const { error } = await this.supabase
        .from('account_security_events')
        .insert({
          user_id: event.userId,
          event_type: 'account_locked',
          ip_address: event.ipAddress,
          user_agent: event.userAgent,
          lockout_until: lockoutUntil.toISOString(),
          lockout_reason: event.reason,
          risk_score: 80,
          metadata: {
            policy_used: role,
            auto_unlock_minutes: policy.autoUnlockAfterMinutes,
            requires_admin_unlock: policy.requireAdminUnlock,
            ...event.metadata
          }
        })

      if (error) {
        console.error('Lockout application error:', error)
        return false
      }

      // Create security incident if high-risk
      await this.createSecurityIncident(event, 'high')

      // Notify user about lockout (if user-specific)
      if (event.userId) {
        await this.notifyUserLockout(event.userId, lockoutUntil, event.reason)
      }

      // Notify security team for admin accounts
      if (role === 'admin') {
        await this.notifySecurityTeam(event)
      }

      return true

    } catch (error) {
      console.error('Lockout application error:', error)
      return false
    }
  }

  /**
   * Unlock account
   */
  async unlockAccount(request: UnlockRequest): Promise<{ success: boolean; error?: string }> {
    try {
      // Verify unlock authorization
      if (request.method === 'admin' && !request.adminUserId) {
        return { success: false, error: 'Admin user ID required for admin unlock' }
      }

      if (request.method === 'verification' && !request.verificationToken) {
        return { success: false, error: 'Verification token required' }
      }

      // Clear lockout records
      const { error: clearError } = await this.supabase
        .from('account_security_events')
        .update({
          lockout_until: null,
          resolved_at: new Date().toISOString(),
          resolved_by: request.adminUserId,
          resolution_notes: request.reason
        })
        .or(`user_id.eq.${request.userId},ip_address.eq.${request.ipAddress}`)
        .not('lockout_until', 'is', null)

      if (clearError) {
        console.error('Unlock error:', clearError)
        return { success: false, error: 'Failed to unlock account' }
      }

      // Record unlock event
      await this.supabase
        .from('account_security_events')
        .insert({
          user_id: request.userId,
          event_type: 'account_unlocked',
          ip_address: request.ipAddress || '0.0.0.0',
          metadata: {
            unlock_method: request.method,
            admin_user_id: request.adminUserId,
            reason: request.reason
          }
        })

      // Notify user of unlock
      if (request.userId && request.method === 'admin') {
        await this.notifyUserUnlock(request.userId, request.method)
      }

      return { success: true }

    } catch (error) {
      console.error('Account unlock error:', error)
      return { success: false, error: 'Unlock operation failed' }
    }
  }

  /**
   * Calculate progressive delay
   */
  private calculateProgressiveDelay(attemptCount: number, policy: LockoutPolicy): number {
    if (!policy.useProgressiveDelay) {
      return policy.baseDelay
    }

    const delay = policy.baseDelay * Math.pow(policy.exponentialFactor, attemptCount - 1)
    return Math.min(delay, policy.maxDelay)
  }

  /**
   * Get recent failed attempts
   */
  private async getRecentFailedAttempts(
    userId?: string,
    ipAddress?: string,
    policy: LockoutPolicy
  ): Promise<{ userAttempts: number; ipAttempts: number }> {
    const windowStart = new Date(Date.now() - policy.attemptWindowMinutes * 60 * 1000)

    const queries = []

    // User-based attempts
    if (userId) {
      queries.push(
        this.supabase
          .from('account_security_events')
          .select('id')
          .eq('user_id', userId)
          .eq('event_type', 'failed_login')
          .gte('created_at', windowStart.toISOString())
      )
    } else {
      queries.push(Promise.resolve({ data: [] }))
    }

    // IP-based attempts
    if (ipAddress) {
      queries.push(
        this.supabase
          .from('account_security_events')
          .select('id')
          .eq('ip_address', ipAddress)
          .eq('event_type', 'failed_login')
          .gte('created_at', windowStart.toISOString())
      )
    } else {
      queries.push(Promise.resolve({ data: [] }))
    }

    const [userResult, ipResult] = await Promise.all(queries)

    return {
      userAttempts: userResult.data?.length || 0,
      ipAttempts: ipResult.data?.length || 0
    }
  }

  /**
   * Detect suspicious activity patterns
   */
  private async detectSuspiciousActivity(
    userId?: string,
    ipAddress?: string
  ): Promise<{ detected: boolean; patterns: string[] }> {
    const patterns: string[] = []
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    try {
      // Pattern 1: Rapid attempts from multiple IPs (if userId provided)
      if (userId) {
        const { data: ipData } = await this.supabase
          .from('account_security_events')
          .select('ip_address')
          .eq('user_id', userId)
          .eq('event_type', 'failed_login')
          .gte('created_at', oneHourAgo.toISOString())

        const uniqueIPs = new Set(ipData?.map(d => d.ip_address))
        if (uniqueIPs.size > 5) {
          patterns.push('multiple_ip_attack')
        }
      }

      // Pattern 2: High frequency from single IP
      if (ipAddress) {
        const { data: frequencyData } = await this.supabase
          .from('account_security_events')
          .select('created_at')
          .eq('ip_address', ipAddress)
          .eq('event_type', 'failed_login')
          .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()) // Last 10 minutes
          .order('created_at', { ascending: true })

        if (frequencyData && frequencyData.length > 10) {
          patterns.push('high_frequency_attack')
        }
      }

      // Pattern 3: User enumeration attempts
      const { data: enumerationData } = await this.supabase
        .from('account_security_events')
        .select('metadata')
        .eq('ip_address', ipAddress)
        .eq('event_type', 'password_reset_nonexistent_user')
        .gte('created_at', oneHourAgo.toISOString())

      if (enumerationData && enumerationData.length > 5) {
        patterns.push('user_enumeration_attack')
      }

      return {
        detected: patterns.length > 0,
        patterns
      }

    } catch (error) {
      console.error('Suspicious activity detection error:', error)
      return { detected: false, patterns: [] }
    }
  }

  /**
   * Escalate security incident
   */
  private async escalateSecurityIncident(
    event: LockoutEvent,
    suspiciousActivity: { detected: boolean; patterns: string[] }
  ): Promise<void> {
    try {
      await this.supabase
        .from('security_incidents')
        .insert({
          incident_type: 'brute_force',
          severity: 'high',
          user_id: event.userId,
          ip_address: event.ipAddress,
          user_agent: event.userAgent,
          description: `Suspicious authentication activity detected: ${suspiciousActivity.patterns.join(', ')}`,
          evidence: {
            event_type: event.eventType,
            patterns: suspiciousActivity.patterns,
            reason: event.reason,
            metadata: event.metadata
          },
          automated_response: 'Account lockout applied',
          admin_notified: true
        })

      // Notify security team
      await this.notifySecurityTeam(event)

    } catch (error) {
      console.error('Security incident escalation error:', error)
    }
  }

  /**
   * Create security incident
   */
  private async createSecurityIncident(event: LockoutEvent, severity: 'low' | 'medium' | 'high' | 'critical'): Promise<void> {
    try {
      await this.supabase
        .from('security_incidents')
        .insert({
          incident_type: event.eventType === 'manual_lock' ? 'admin_intervention_required' : 'brute_force',
          severity,
          user_id: event.userId,
          ip_address: event.ipAddress,
          user_agent: event.userAgent,
          description: `Account lockout triggered: ${event.reason}`,
          evidence: {
            event_type: event.eventType,
            reason: event.reason,
            metadata: event.metadata
          },
          automated_response: 'Account lockout applied'
        })
    } catch (error) {
      console.error('Security incident creation error:', error)
    }
  }

  /**
   * Utility methods
   */
  private getPolicyForRole(role: string): LockoutPolicy {
    return { ...this.policies[role] || this.policies.user, role: role as LockoutPolicy['role'] }
  }

  private async getUserRole(userId?: string): Promise<string> {
    if (!userId) return 'user'

    try {
      const { data } = await this.supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .single()

      return data?.role || 'user'
    } catch {
      return 'user'
    }
  }

  private determineLockoutType(reason: string): LockoutStatus['lockoutType'] {
    if (reason.includes('admin')) return 'admin'
    if (reason.includes('suspicious')) return 'suspicious'
    if (reason.includes('IP')) return 'ip'
    if (reason.includes('global')) return 'global'
    return 'user'
  }

  private async getSecurityIncidentCount(userId?: string, ipAddress?: string): Promise<number> {
    try {
      const query = this.supabase
        .from('security_incidents')
        .select('id', { count: 'exact' })
        .eq('status', 'open')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

      if (userId) {
        query.eq('user_id', userId)
      } else if (ipAddress) {
        query.eq('ip_address', ipAddress)
      }

      const { count } = await query
      return count || 0
    } catch {
      return 0
    }
  }

  private async notifyUserLockout(userId: string, lockoutUntil: Date, reason: string): Promise<void> {
    try {
      // Implementation would send email/SMS notification
      console.log(`User ${userId} locked until ${lockoutUntil}: ${reason}`)
    } catch (error) {
      console.error('User lockout notification error:', error)
    }
  }

  private async notifyUserUnlock(userId: string, method: string): Promise<void> {
    try {
      // Implementation would send email/SMS notification
      console.log(`User ${userId} unlocked via ${method}`)
    } catch (error) {
      console.error('User unlock notification error:', error)
    }
  }

  private async notifySecurityTeam(event: LockoutEvent): Promise<void> {
    try {
      // Implementation would notify security team
      console.log('Security team notified:', event)
    } catch (error) {
      console.error('Security team notification error:', error)
    }
  }
}

// Global instance
export const accountLockoutManager = new AccountLockoutManager()

// Convenience functions
export async function checkAccountLockout(
  userId?: string,
  ipAddress?: string,
  role?: string
): Promise<LockoutStatus> {
  return await accountLockoutManager.checkLockoutStatus(userId, ipAddress, role)
}

export async function recordAuthFailure(
  event: LockoutEvent,
  httpRequest?: NextRequest
): Promise<{ locked: boolean; delayMs: number; lockoutStatus: LockoutStatus }> {
  return await accountLockoutManager.recordFailedAttempt(event, httpRequest)
}

export async function unlockAccount(request: UnlockRequest): Promise<{ success: boolean; error?: string }> {
  return await accountLockoutManager.unlockAccount(request)
}