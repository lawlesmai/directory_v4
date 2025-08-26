/**
 * Advanced Password Policy Engine
 * Epic 2 Story 2.6: Password Management and Account Security
 * 
 * Implements NIST 800-63B compliant password policies with dynamic strength calculation,
 * breach checking, history tracking, and comprehensive security validation.
 */

import { createClient } from '@/lib/supabase/server'
import { hashPassword, verifyPassword, validatePasswordStrength } from '@/lib/security/server'
import { WebFetch } from '@/lib/utils/web-fetch'

export interface PasswordPolicy {
  // NIST 800-63B Requirements
  minLength: number
  maxLength: number
  requireComplexity: boolean
  allowPassphrases: boolean
  
  // Security Features
  checkBreaches: boolean
  preventReuse: number // Last N passwords to check
  enforceExpiration: boolean
  expirationDays?: number
  
  // Role-based policies
  role?: 'user' | 'business_owner' | 'admin'
  enforceStronger?: boolean
  
  // Dictionary checks
  preventCommon: boolean
  preventPersonalInfo: boolean
}

export interface PasswordStrengthResult {
  score: number // 0-100
  level: 'very_weak' | 'weak' | 'fair' | 'good' | 'strong' | 'very_strong'
  feedback: PasswordFeedback
  compliant: boolean
  timeToBreak?: string
}

export interface PasswordFeedback {
  suggestions: string[]
  warnings: string[]
  requirements: RequirementCheck[]
  entropy: number
  estimatedCrackTime: number
}

export interface RequirementCheck {
  name: string
  description: string
  met: boolean
  required: boolean
  weight: number
}

export interface BreachCheckResult {
  isBreached: boolean
  occurrences?: number
  breachSources?: string[]
  lastSeen?: Date
}

export interface PasswordHistoryEntry {
  id: string
  user_id: string
  password_hash: string
  created_at: string
  algorithm: 'argon2id' | 'bcrypt'
}

/**
 * Advanced Password Policy Engine
 */
export class PasswordPolicyEngine {
  private supabase = createClient()
  private commonPasswords: Set<string> = new Set()
  
  // Default NIST 800-63B compliant policy
  private readonly defaultPolicy: PasswordPolicy = {
    minLength: 8,
    maxLength: 128,
    requireComplexity: false, // NIST discourages complexity requirements
    allowPassphrases: true,
    checkBreaches: true,
    preventReuse: 12,
    enforceExpiration: false, // NIST discourages forced expiration
    preventCommon: true,
    preventPersonalInfo: true
  }

  // Role-based policies
  private readonly rolePolicies: Record<string, Partial<PasswordPolicy>> = {
    user: {
      minLength: 8,
      preventReuse: 5,
      enforceStronger: false
    },
    business_owner: {
      minLength: 10,
      preventReuse: 8,
      enforceStronger: true,
      checkBreaches: true
    },
    admin: {
      minLength: 12,
      preventReuse: 12,
      enforceStronger: true,
      checkBreaches: true,
      requireComplexity: true
    }
  }

  constructor() {
    this.loadCommonPasswords()
  }

  /**
   * Get password policy for user role
   */
  getPolicyForRole(role: string = 'user'): PasswordPolicy {
    const basePolicy = { ...this.defaultPolicy }
    const rolePolicy = this.rolePolicies[role] || {}
    
    return {
      ...basePolicy,
      ...rolePolicy,
      role: role as PasswordPolicy['role']
    }
  }

  /**
   * Comprehensive password strength validation
   */
  async validatePassword(
    password: string, 
    userId?: string,
    role: string = 'user',
    personalInfo?: { email?: string; firstName?: string; lastName?: string }
  ): Promise<PasswordStrengthResult> {
    const policy = this.getPolicyForRole(role)
    const requirements = this.buildRequirements(policy)
    const feedback: PasswordFeedback = {
      suggestions: [],
      warnings: [],
      requirements: [],
      entropy: 0,
      estimatedCrackTime: 0
    }

    // Basic validation checks
    const basicChecks = await this.performBasicChecks(password, policy, personalInfo)
    feedback.requirements.push(...basicChecks.requirements)
    feedback.suggestions.push(...basicChecks.suggestions)
    feedback.warnings.push(...basicChecks.warnings)

    // Entropy calculation
    const entropy = this.calculateEntropy(password)
    feedback.entropy = entropy
    feedback.estimatedCrackTime = this.estimateCrackTime(entropy)

    // Breach checking
    if (policy.checkBreaches) {
      const breachCheck = await this.checkPasswordBreach(password)
      if (breachCheck.isBreached) {
        feedback.warnings.push(`Password found in ${breachCheck.occurrences} data breaches`)
        feedback.requirements.push({
          name: 'not_breached',
          description: 'Password not found in known breaches',
          met: false,
          required: true,
          weight: 20
        })
      }
    }

    // Password reuse check
    if (userId && policy.preventReuse > 0) {
      const reuseCheck = await this.checkPasswordReuse(password, userId, policy.preventReuse)
      if (reuseCheck) {
        feedback.warnings.push(`Password was used within the last ${policy.preventReuse} passwords`)
        feedback.requirements.push({
          name: 'not_reused',
          description: `Not used in last ${policy.preventReuse} passwords`,
          met: false,
          required: true,
          weight: 15
        })
      }
    }

    // Calculate final score
    const score = this.calculatePasswordScore(feedback, entropy)
    const level = this.determineStrengthLevel(score, policy)
    const compliant = this.isCompliant(feedback, policy)

    return {
      score,
      level,
      feedback,
      compliant,
      timeToBreak: this.formatCrackTime(feedback.estimatedCrackTime)
    }
  }

  /**
   * Check password against breach databases
   */
  async checkPasswordBreach(password: string): Promise<BreachCheckResult> {
    try {
      // Use HaveIBeenPwned API with k-anonymity
      const sha1Hash = await this.sha1Hash(password)
      const prefix = sha1Hash.substring(0, 5)
      const suffix = sha1Hash.substring(5).toUpperCase()

      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: {
          'User-Agent': 'Lawless Directory Password Security Check',
          'Add-Padding': 'true'
        }
      })

      if (!response.ok) {
        console.warn('Breach check failed, allowing password')
        return { isBreached: false }
      }

      const data = await response.text()
      const lines = data.split('\n')
      
      for (const line of lines) {
        const [hashSuffix, count] = line.split(':')
        if (hashSuffix === suffix) {
          return {
            isBreached: true,
            occurrences: parseInt(count, 10),
            breachSources: ['HaveIBeenPwned'],
            lastSeen: new Date()
          }
        }
      }

      return { isBreached: false }
    } catch (error) {
      console.error('Breach check error:', error)
      // Fail open for availability
      return { isBreached: false }
    }
  }

  /**
   * Check if password was used recently
   */
  async checkPasswordReuse(password: string, userId: string, historyCount: number): Promise<boolean> {
    try {
      const { data: history, error } = await this.supabase
        .from('user_password_history')
        .select('password_hash, algorithm')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(historyCount)

      if (error || !history) {
        console.error('Password history check failed:', error)
        return false
      }

      const bcrypt = await import('bcryptjs')
      const argon2 = await import('argon2')
      
      for (const entry of history) {
        if (entry.algorithm === 'bcrypt') {
          const matches = await bcrypt.compare(password, entry.password_hash)
          if (matches) return true
        } else if (entry.algorithm === 'argon2id') {
          const matches = await argon2.verify(entry.password_hash, password)
          if (matches) return true
        }
      }

      return false
    } catch (error) {
      console.error('Password reuse check error:', error)
      return false
    }
  }

  /**
   * Store password in history
   */
  async storePasswordHistory(userId: string, passwordHash: string, algorithm: 'argon2id' | 'bcrypt' = 'argon2id'): Promise<void> {
    try {
      // Add new entry
      await this.supabase
        .from('user_password_history')
        .insert({
          user_id: userId,
          password_hash: passwordHash,
          algorithm,
          created_at: new Date().toISOString()
        })

      // Clean up old entries (keep only last 15 for safety margin)
      const { data: oldEntries } = await this.supabase
        .from('user_password_history')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(15, 1000)

      if (oldEntries && oldEntries.length > 0) {
        const idsToDelete = oldEntries.map(entry => entry.id)
        await this.supabase
          .from('user_password_history')
          .delete()
          .in('id', idsToDelete)
      }
    } catch (error) {
      console.error('Password history storage error:', error)
    }
  }

  /**
   * Perform basic password validation checks
   */
  private async performBasicChecks(
    password: string,
    policy: PasswordPolicy,
    personalInfo?: { email?: string; firstName?: string; lastName?: string }
  ) {
    const requirements: RequirementCheck[] = []
    const suggestions: string[] = []
    const warnings: string[] = []

    // Length checks
    requirements.push({
      name: 'min_length',
      description: `At least ${policy.minLength} characters`,
      met: password.length >= policy.minLength,
      required: true,
      weight: 10
    })

    requirements.push({
      name: 'max_length',
      description: `No more than ${policy.maxLength} characters`,
      met: password.length <= policy.maxLength,
      required: true,
      weight: 5
    })

    // Character variety checks (only if complexity required)
    if (policy.requireComplexity) {
      requirements.push({
        name: 'has_lowercase',
        description: 'Contains lowercase letters',
        met: /[a-z]/.test(password),
        required: true,
        weight: 5
      })

      requirements.push({
        name: 'has_uppercase',
        description: 'Contains uppercase letters',
        met: /[A-Z]/.test(password),
        required: true,
        weight: 5
      })

      requirements.push({
        name: 'has_numbers',
        description: 'Contains numbers',
        met: /\d/.test(password),
        required: true,
        weight: 5
      })

      requirements.push({
        name: 'has_special',
        description: 'Contains special characters',
        met: /[!@#$%^&*(),.?":{}|<>]/.test(password),
        required: true,
        weight: 5
      })
    }

    // Common password check
    if (policy.preventCommon && this.isCommonPassword(password)) {
      warnings.push('This is a commonly used password')
      requirements.push({
        name: 'not_common',
        description: 'Not a commonly used password',
        met: false,
        required: true,
        weight: 15
      })
    }

    // Personal information check
    if (policy.preventPersonalInfo && personalInfo) {
      const containsPersonalInfo = this.containsPersonalInfo(password, personalInfo)
      if (containsPersonalInfo.length > 0) {
        warnings.push(`Contains personal information: ${containsPersonalInfo.join(', ')}`)
        requirements.push({
          name: 'no_personal_info',
          description: 'Does not contain personal information',
          met: false,
          required: true,
          weight: 10
        })
      }
    }

    // Suggestions based on analysis
    if (password.length < 12) {
      suggestions.push('Consider using a longer password (12+ characters)')
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password) && !policy.requireComplexity) {
      suggestions.push('Consider adding special characters for better security')
    }

    if (this.hasRepeatingPatterns(password)) {
      warnings.push('Contains repeating patterns')
      suggestions.push('Avoid repeating characters or patterns')
    }

    return { requirements, suggestions, warnings }
  }

  /**
   * Calculate password entropy
   */
  private calculateEntropy(password: string): number {
    let charsetSize = 0
    
    // Character set analysis
    if (/[a-z]/.test(password)) charsetSize += 26
    if (/[A-Z]/.test(password)) charsetSize += 26
    if (/\d/.test(password)) charsetSize += 10
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) charsetSize += 32
    if (/[^a-zA-Z\d!@#$%^&*(),.?":{}|<>]/.test(password)) charsetSize += 20
    
    // Calculate entropy
    const entropy = Math.log2(Math.pow(charsetSize, password.length))
    
    // Adjust for patterns and repetition
    const patternPenalty = this.calculatePatternPenalty(password)
    
    return Math.max(0, entropy - patternPenalty)
  }

  /**
   * Estimate crack time based on entropy
   */
  private estimateCrackTime(entropy: number): number {
    // Assume 100 billion guesses per second (modern GPU)
    const guessesPerSecond = 100_000_000_000
    const searchSpace = Math.pow(2, entropy)
    const averageCrackTime = searchSpace / (2 * guessesPerSecond)
    
    return averageCrackTime
  }

  /**
   * Format crack time for human reading
   */
  private formatCrackTime(seconds: number): string {
    if (seconds < 1) return 'Less than 1 second'
    if (seconds < 60) return `${Math.round(seconds)} seconds`
    if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`
    if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`
    if (seconds < 31536000) return `${Math.round(seconds / 86400)} days`
    if (seconds < 31536000 * 100) return `${Math.round(seconds / 31536000)} years`
    return 'Centuries'
  }

  /**
   * Calculate overall password score
   */
  private calculatePasswordScore(feedback: PasswordFeedback, entropy: number): number {
    let score = 0
    
    // Base score from entropy
    if (entropy >= 60) score += 40
    else if (entropy >= 40) score += 30
    else if (entropy >= 25) score += 20
    else score += 10
    
    // Score from requirements
    const totalWeight = feedback.requirements.reduce((sum, req) => sum + req.weight, 0)
    const metWeight = feedback.requirements
      .filter(req => req.met)
      .reduce((sum, req) => sum + req.weight, 0)
    
    if (totalWeight > 0) {
      score += (metWeight / totalWeight) * 60
    }
    
    // Penalty for warnings
    score -= feedback.warnings.length * 10
    
    return Math.max(0, Math.min(100, score))
  }

  /**
   * Determine password strength level
   */
  private determineStrengthLevel(score: number, policy: PasswordPolicy): PasswordStrengthResult['level'] {
    if (score >= 90) return 'very_strong'
    if (score >= 75) return 'strong'
    if (score >= 60) return 'good'
    if (score >= 40) return 'fair'
    if (score >= 20) return 'weak'
    return 'very_weak'
  }

  /**
   * Check if password is compliant with policy
   */
  private isCompliant(feedback: PasswordFeedback, policy: PasswordPolicy): boolean {
    const requiredChecks = feedback.requirements.filter(req => req.required)
    return requiredChecks.every(req => req.met)
  }

  /**
   * Utility methods
   */
  private async sha1Hash(input: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(input)
    const hashBuffer = await crypto.subtle.digest('SHA-1', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  private isCommonPassword(password: string): boolean {
    return this.commonPasswords.has(password.toLowerCase())
  }

  private containsPersonalInfo(
    password: string,
    personalInfo: { email?: string; firstName?: string; lastName?: string }
  ): string[] {
    const found: string[] = []
    const lowerPassword = password.toLowerCase()
    
    if (personalInfo.email) {
      const emailParts = personalInfo.email.toLowerCase().split('@')
      if (lowerPassword.includes(emailParts[0])) found.push('email')
    }
    
    if (personalInfo.firstName && lowerPassword.includes(personalInfo.firstName.toLowerCase())) {
      found.push('first name')
    }
    
    if (personalInfo.lastName && lowerPassword.includes(personalInfo.lastName.toLowerCase())) {
      found.push('last name')
    }
    
    return found
  }

  private hasRepeatingPatterns(password: string): boolean {
    // Check for character repetition
    if (/(.)\1{2,}/.test(password)) return true
    
    // Check for keyboard patterns
    const keyboardPatterns = [
      'qwerty', 'asdf', 'zxcv', '1234', 'abcd'
    ]
    
    return keyboardPatterns.some(pattern => 
      password.toLowerCase().includes(pattern)
    )
  }

  private calculatePatternPenalty(password: string): number {
    let penalty = 0
    
    // Repetition penalty
    const repetitionMatch = password.match(/(.)\1+/g)
    if (repetitionMatch) {
      penalty += repetitionMatch.length * 5
    }
    
    // Sequential patterns
    if (/123|234|345|456|567|678|789|890/.test(password)) penalty += 10
    if (/abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i.test(password)) penalty += 10
    
    return penalty
  }

  private buildRequirements(policy: PasswordPolicy): RequirementCheck[] {
    const requirements: RequirementCheck[] = [
      {
        name: 'min_length',
        description: `At least ${policy.minLength} characters`,
        met: false,
        required: true,
        weight: 10
      }
    ]

    if (policy.requireComplexity) {
      requirements.push(
        {
          name: 'has_lowercase',
          description: 'Contains lowercase letters',
          met: false,
          required: true,
          weight: 5
        },
        {
          name: 'has_uppercase',
          description: 'Contains uppercase letters',
          met: false,
          required: true,
          weight: 5
        },
        {
          name: 'has_numbers',
          description: 'Contains numbers',
          met: false,
          required: true,
          weight: 5
        },
        {
          name: 'has_special',
          description: 'Contains special characters',
          met: false,
          required: true,
          weight: 5
        }
      )
    }

    return requirements
  }

  private async loadCommonPasswords(): Promise<void> {
    // Load common passwords from a secure source
    // In production, this would be loaded from a database or secure file
    const commonList = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey',
      'dragon', 'master', 'superman', 'password1', '123123'
    ]
    
    this.commonPasswords = new Set(commonList)
  }
}

// Global instance
export const passwordPolicyEngine = new PasswordPolicyEngine()

// Convenience functions
export async function validatePasswordSecurity(
  password: string,
  userId?: string,
  role?: string,
  personalInfo?: { email?: string; firstName?: string; lastName?: string }
): Promise<PasswordStrengthResult> {
  return await passwordPolicyEngine.validatePassword(password, userId, role, personalInfo)
}

export async function checkPasswordBreach(password: string): Promise<BreachCheckResult> {
  return await passwordPolicyEngine.checkPasswordBreach(password)
}

export function getPasswordPolicyForRole(role: string): PasswordPolicy {
  return passwordPolicyEngine.getPolicyForRole(role)
}