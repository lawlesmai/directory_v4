/**
 * OAuth Security Validation and Monitoring System
 * Epic 2 Story 2.3: Social Media Login Integration
 * 
 * Provides comprehensive security validation, threat detection,
 * and incident response for OAuth authentication flows.
 */

import { createClient } from '@/lib/supabase/server'
import { OAuthProvider } from './oauth-config'
import { NextRequest } from 'next/server'
import { headers } from 'next/headers'

export interface SecurityValidationResult {
  allowed: boolean
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  reasons: string[]
  actionRequired?: 'block' | 'mfa_required' | 'admin_review' | 'rate_limit'
  metadata?: Record<string, any>
}

export interface RateLimitCheck {
  allowed: boolean
  attemptsRemaining: number
  resetTime: Date
  blockedUntil?: Date
}

export interface SecurityIncident {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  provider?: OAuthProvider
  userId?: string
  ipAddress?: string
  userAgent?: string
  rawData?: any
  autoResolved?: boolean
}

/**
 * OAuth Security Validator
 */
export class OAuthSecurityValidator {
  private supabase = createClient()

  /**
   * Validate OAuth authentication request for security
   */
  async validateOAuthRequest(
    provider: OAuthProvider,
    request: NextRequest,
    userId?: string
  ): Promise<SecurityValidationResult> {
    const validationResults: SecurityValidationResult[] = []
    
    // Get request metadata
    const metadata = await this.extractRequestMetadata(request)
    
    // Check rate limits
    const rateLimitCheck = await this.checkRateLimit(
      metadata.ipAddress,
      provider,
      'initiation',
      userId
    )
    
    if (!rateLimitCheck.allowed) {
      return {
        allowed: false,
        riskLevel: 'high',
        reasons: ['Rate limit exceeded'],
        actionRequired: 'rate_limit',
        metadata: { resetTime: rateLimitCheck.resetTime }
      }
    }

    // Validate IP reputation
    const ipValidation = await this.validateIPAddress(metadata.ipAddress, provider)
    validationResults.push(ipValidation)

    // Validate user agent and detect bots
    const userAgentValidation = await this.validateUserAgent(metadata.userAgent, provider)
    validationResults.push(userAgentValidation)

    // Check for suspicious patterns
    const patternValidation = await this.checkSuspiciousPatterns(metadata, provider, userId)
    validationResults.push(patternValidation)

    // Check geolocation anomalies (if user exists)
    if (userId) {
      const geoValidation = await this.validateGeolocation(userId, metadata, provider)
      validationResults.push(geoValidation)
    }

    // Combine results
    const combinedResult = this.combineValidationResults(validationResults)
    
    // Log security check
    await this.logSecurityCheck({
      provider,
      userId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      result: combinedResult,
      checks: validationResults.map(r => ({ riskLevel: r.riskLevel, reasons: r.reasons }))
    })

    return combinedResult
  }

  /**
   * Check OAuth rate limits
   */
  async checkRateLimit(
    identifier: string,
    provider: OAuthProvider,
    action: 'initiation' | 'callback' | 'token_refresh',
    userId?: string
  ): Promise<RateLimitCheck> {
    try {
      const identifierType = userId ? 'user' : 'ip'
      const finalIdentifier = userId ? `${userId}:${identifier}` : identifier
      
      const { data, error } = await this.supabase
        .rpc('check_oauth_rate_limit', {
          p_identifier: finalIdentifier,
          p_identifier_type: identifierType,
          p_provider: provider,
          p_action: action,
          p_max_attempts: this.getRateLimitMax(action),
          p_window_minutes: this.getRateLimitWindow(action)
        })

      if (error || !data || data.length === 0) {
        console.error('Rate limit check failed:', error)
        // Fail open for now, but log the incident
        await this.reportSecurityIncident({
          type: 'rate_limit_check_failed',
          severity: 'medium',
          description: 'Failed to check OAuth rate limits',
          provider,
          userId,
          ipAddress: identifier,
          rawData: { error: error?.message }
        })
        
        return {
          allowed: true,
          attemptsRemaining: 10,
          resetTime: new Date(Date.now() + 60 * 60 * 1000)
        }
      }

      const result = data[0]
      return {
        allowed: result.allowed,
        attemptsRemaining: Math.max(0, this.getRateLimitMax(action) - result.current_attempts),
        resetTime: new Date(result.window_end),
        blockedUntil: result.blocked_until ? new Date(result.blocked_until) : undefined
      }

    } catch (error) {
      console.error('Rate limit check error:', error)
      return {
        allowed: true, // Fail open
        attemptsRemaining: 10,
        resetTime: new Date(Date.now() + 60 * 60 * 1000)
      }
    }
  }

  /**
   * Validate IP address reputation and geolocation
   */
  async validateIPAddress(ipAddress: string, provider: OAuthProvider): Promise<SecurityValidationResult> {
    const reasons: string[] = []
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'

    try {
      // Check if IP is in blocklist
      const { data: blockedIP } = await this.supabase
        .from('security_events')
        .select('id')
        .eq('ip_address', ipAddress)
        .eq('event_type', 'blocked_ip')
        .eq('resolved', false)
        .maybeSingle()

      if (blockedIP) {
        return {
          allowed: false,
          riskLevel: 'critical',
          reasons: ['IP address is blocked'],
          actionRequired: 'block'
        }
      }

      // Check for VPN/Proxy (basic detection)
      if (await this.isVPNOrProxy(ipAddress)) {
        reasons.push('VPN or proxy detected')
        riskLevel = 'medium'
      }

      // Check for Tor exit nodes (if implemented)
      if (await this.isTorExitNode(ipAddress)) {
        reasons.push('Tor exit node detected')
        riskLevel = 'high'
      }

      // Check recent failed attempts from this IP
      const { data: recentFailures, error } = await this.supabase
        .from('auth_audit_logs')
        .select('id')
        .eq('ip_address', ipAddress)
        .eq('success', false)
        .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // Last 30 minutes
        .limit(10)

      if (!error && recentFailures && recentFailures.length >= 5) {
        reasons.push('Multiple recent failed attempts from IP')
        riskLevel = riskLevel === 'low' ? 'medium' : riskLevel
      }

      return {
        allowed: riskLevel !== 'critical',
        riskLevel,
        reasons,
        actionRequired: riskLevel === 'high' ? 'mfa_required' : undefined
      }

    } catch (error) {
      console.error('IP validation error:', error)
      return {
        allowed: true,
        riskLevel: 'low',
        reasons: ['IP validation check failed']
      }
    }
  }

  /**
   * Validate user agent for bot detection
   */
  async validateUserAgent(userAgent: string, provider: OAuthProvider): Promise<SecurityValidationResult> {
    const reasons: string[] = []
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'

    // Check for missing or suspicious user agents
    if (!userAgent || userAgent.length < 10) {
      reasons.push('Missing or too short user agent')
      riskLevel = 'medium'
    }

    // Check for known bot patterns
    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /node/i,
      /go-http/i
    ]

    const isBot = botPatterns.some(pattern => pattern.test(userAgent))
    if (isBot) {
      reasons.push('Bot or automated tool detected')
      riskLevel = 'high'
    }

    // Check for very old browsers (potential security risk)
    const oldBrowserPatterns = [
      /MSIE [1-9]\./,
      /Firefox\/[1-3]\d\./,
      /Chrome\/[1-4]\d\./
    ]

    const isOldBrowser = oldBrowserPatterns.some(pattern => pattern.test(userAgent))
    if (isOldBrowser) {
      reasons.push('Outdated browser detected')
      riskLevel = riskLevel === 'low' ? 'medium' : riskLevel
    }

    return {
      allowed: riskLevel !== 'critical',
      riskLevel,
      reasons,
      actionRequired: riskLevel === 'high' ? 'admin_review' : undefined
    }
  }

  /**
   * Check for suspicious authentication patterns
   */
  async checkSuspiciousPatterns(
    metadata: any,
    provider: OAuthProvider,
    userId?: string
  ): Promise<SecurityValidationResult> {
    const reasons: string[] = []
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'

    try {
      // Check for rapid provider switching (if user exists)
      if (userId) {
        const { data: recentSwitches } = await this.supabase
          .from('auth_audit_logs')
          .select('event_data')
          .eq('user_id', userId)
          .eq('event_category', 'oauth')
          .eq('success', true)
          .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()) // Last 10 minutes
          .order('created_at', { ascending: false })
          .limit(5)

        if (recentSwitches && recentSwitches.length > 2) {
          const uniqueProviders = new Set(
            recentSwitches.map(log => log.event_data?.provider).filter(Boolean)
          )
          if (uniqueProviders.size > 2) {
            reasons.push('Rapid OAuth provider switching detected')
            riskLevel = 'medium'
          }
        }
      }

      // Check for OAuth state parameter manipulation attempts
      const stateParam = metadata.state
      if (stateParam) {
        try {
          const decodedState = JSON.parse(atob(stateParam))
          
          // Check for suspicious timestamp (too old or in future)
          const stateTimestamp = decodedState.timestamp
          const now = Date.now()
          if (stateTimestamp && (now - stateTimestamp > 15 * 60 * 1000 || stateTimestamp > now)) {
            reasons.push('Suspicious OAuth state timestamp')
            riskLevel = 'high'
          }
          
        } catch {
          reasons.push('Malformed OAuth state parameter')
          riskLevel = 'high'
        }
      }

      // Check for timing-based attacks (too fast completion)
      const requestTime = Date.now()
      if (metadata.initiationTime) {
        const completionTime = requestTime - metadata.initiationTime
        if (completionTime < 2000) { // Less than 2 seconds
          reasons.push('Suspiciously fast OAuth completion')
          riskLevel = 'high'
        }
      }

      return {
        allowed: riskLevel !== 'critical',
        riskLevel,
        reasons,
        actionRequired: riskLevel === 'high' ? 'mfa_required' : undefined
      }

    } catch (error) {
      console.error('Pattern validation error:', error)
      return {
        allowed: true,
        riskLevel: 'low',
        reasons: ['Pattern validation check failed']
      }
    }
  }

  /**
   * Validate geolocation for existing users
   */
  async validateGeolocation(
    userId: string,
    metadata: any,
    provider: OAuthProvider
  ): Promise<SecurityValidationResult> {
    const reasons: string[] = []
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'

    try {
      // Get user's recent successful logins for geolocation comparison
      const { data: recentLogins } = await this.supabase
        .from('user_sessions')
        .select('country_code, city')
        .eq('user_id', userId)
        .not('country_code', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5)

      if (recentLogins && recentLogins.length > 0) {
        const currentCountry = metadata.country_code
        const recentCountries = new Set(recentLogins.map(login => login.country_code))
        
        // Check for new country
        if (currentCountry && !recentCountries.has(currentCountry)) {
          reasons.push('Login from new country')
          riskLevel = 'medium'
          
          // Check for high-risk countries (simplified example)
          const highRiskCountries = ['CN', 'RU', 'KP', 'IR'] // Add more as needed
          if (highRiskCountries.includes(currentCountry)) {
            reasons.push('Login from high-risk country')
            riskLevel = 'high'
          }
        }

        // Check for impossible travel (very basic check)
        const mostRecentLogin = recentLogins[0]
        if (mostRecentLogin && mostRecentLogin.country_code !== currentCountry) {
          // This is a simplified check - in production, you'd use proper geolocation
          // and calculate actual distances and travel times
          reasons.push('Rapid geolocation change detected')
          riskLevel = riskLevel === 'low' ? 'medium' : riskLevel
        }
      }

      return {
        allowed: riskLevel !== 'critical',
        riskLevel,
        reasons,
        actionRequired: riskLevel === 'high' ? 'mfa_required' : undefined
      }

    } catch (error) {
      console.error('Geolocation validation error:', error)
      return {
        allowed: true,
        riskLevel: 'low',
        reasons: ['Geolocation validation check failed']
      }
    }
  }

  /**
   * Report security incident
   */
  async reportSecurityIncident(incident: SecurityIncident): Promise<void> {
    try {
      await this.supabase
        .from('oauth_security_incidents')
        .insert({
          incident_type: incident.type,
          severity: incident.severity,
          description: incident.description,
          provider: incident.provider,
          user_id: incident.userId,
          ip_address: incident.ipAddress,
          user_agent: incident.userAgent,
          raw_data: incident.rawData || {},
          auto_blocked: incident.autoResolved || false,
          admin_notified: incident.severity === 'critical',
          detected_at: new Date().toISOString()
        })

      // Auto-notify admins for critical incidents
      if (incident.severity === 'critical') {
        await this.notifySecurityTeam(incident)
      }

    } catch (error) {
      console.error('Failed to report security incident:', error)
    }
  }

  // Private utility methods

  private async extractRequestMetadata(request: NextRequest): Promise<any> {
    const headersList = headers()
    const userAgent = headersList.get('user-agent') || 'unknown'
    const forwardedFor = headersList.get('x-forwarded-for')
    const realIp = headersList.get('x-real-ip')
    const ipAddress = forwardedFor?.split(',')[0].trim() || realIp || 'unknown'
    const country = headersList.get('cf-ipcountry') || headersList.get('x-country-code')
    
    const { searchParams } = new URL(request.url)
    const state = searchParams.get('state')

    return {
      userAgent,
      ipAddress,
      country_code: country,
      state,
      timestamp: Date.now()
    }
  }

  private combineValidationResults(results: SecurityValidationResult[]): SecurityValidationResult {
    const allReasons = results.flatMap(r => r.reasons)
    const highestRisk = results.reduce((highest, current) => {
      const riskLevels = { low: 1, medium: 2, high: 3, critical: 4 }
      return riskLevels[current.riskLevel] > riskLevels[highest] ? current.riskLevel : highest
    }, 'low' as SecurityValidationResult['riskLevel'])

    const requiresAction = results.find(r => r.actionRequired)?.actionRequired

    return {
      allowed: !results.some(r => !r.allowed),
      riskLevel: highestRisk,
      reasons: [...new Set(allReasons)],
      actionRequired: requiresAction
    }
  }

  private getRateLimitMax(action: string): number {
    switch (action) {
      case 'initiation': return 10
      case 'callback': return 5
      case 'token_refresh': return 20
      default: return 10
    }
  }

  private getRateLimitWindow(action: string): number {
    switch (action) {
      case 'initiation': return 60
      case 'callback': return 15
      case 'token_refresh': return 60
      default: return 60
    }
  }

  private async isVPNOrProxy(ipAddress: string): Promise<boolean> {
    // In production, integrate with IP intelligence services
    // For now, basic check for common VPN IP ranges
    const vpnRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^127\./
    ]

    // This is overly simplistic - private IPs are not necessarily VPNs
    return vpnRanges.some(range => range.test(ipAddress))
  }

  private async isTorExitNode(ipAddress: string): Promise<boolean> {
    // In production, integrate with Tor exit node lists
    // For now, return false as this requires external service
    return false
  }

  private async notifySecurityTeam(incident: SecurityIncident): Promise<void> {
    // In production, implement notification system (email, Slack, etc.)
    console.error('CRITICAL SECURITY INCIDENT:', incident)
  }

  private async logSecurityCheck(data: {
    provider: OAuthProvider
    userId?: string
    ipAddress: string
    userAgent: string
    result: SecurityValidationResult
    checks: any[]
  }): Promise<void> {
    try {
      await this.supabase.from('auth_audit_logs').insert({
        event_type: 'oauth_security_check',
        event_category: 'security',
        user_id: data.userId,
        success: data.result.allowed,
        failure_reason: data.result.allowed ? null : data.result.reasons.join(', '),
        event_data: {
          provider: data.provider,
          risk_level: data.result.riskLevel,
          reasons: data.result.reasons,
          action_required: data.result.actionRequired,
          checks: data.checks
        },
        ip_address: data.ipAddress,
        user_agent: data.userAgent
      })
    } catch (error) {
      console.error('Failed to log security check:', error)
    }
  }
}

/**
 * Global security validator instance
 */
export const securityValidator = new OAuthSecurityValidator()

/**
 * Middleware function for OAuth security validation
 */
export async function validateOAuthSecurity(
  provider: OAuthProvider,
  request: NextRequest,
  userId?: string
): Promise<SecurityValidationResult> {
  return await securityValidator.validateOAuthRequest(provider, request, userId)
}