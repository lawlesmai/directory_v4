/**
 * Security Monitoring Integration Layer
 * Epic 2 Story 2.10: Security Monitoring & Compliance Infrastructure
 * 
 * Integrates with all authentication systems from Stories 2.1-2.9:
 * - Supabase Auth Infrastructure (2.1)
 * - Next.js Auth Middleware (2.2)
 * - Authentication UI Components (2.3)
 * - User Registration & Onboarding (2.4)
 * - Login & Session Management (2.5)
 * - Password Reset & Recovery (2.6)
 * - User Profile Management (2.7)
 * - RBAC System (2.8)
 * - Business Owner Verification (2.9)
 */

import { createClient } from '@/lib/supabase/server'
import { sessionManager } from '@/lib/auth/session-manager'
import { securityAnalyticsEngine, type SecurityEventStream } from './security-analytics-engine'
import { complianceEngine } from './compliance-engine'
import { incidentManagement } from './incident-management'
import type { NextRequest } from 'next/server'

// Integration configuration
export const INTEGRATION_CONFIG = {
  // Event capture settings
  eventCapture: {
    enabled: true,
    batchSize: 100,
    flushInterval: 5000, // ms
    includeDeviceFingerprinting: true,
    includeGeolocation: true,
    includeBehaviorAnalysis: true
  },
  
  // Monitoring scopes
  monitoring: {
    authentication: true,
    authorization: true,
    sessionManagement: true,
    userProfile: true,
    businessVerification: true,
    passwordManagement: true,
    mfaOperations: true,
    rbacOperations: true
  },
  
  // Real-time processing
  realTime: {
    criticalEventProcessing: true,
    immediateThreatResponse: true,
    complianceViolationAlert: true,
    incidentCreation: true
  },
  
  // Data enrichment
  enrichment: {
    ipGeolocation: true,
    deviceFingerprinting: true,
    userBehaviorAnalysis: true,
    threatIntelligence: true,
    riskScoring: true
  }
} as const

/**
 * Security Monitoring Integration Layer
 * Centralizes security event collection and processing from all auth systems
 */
export class SecurityIntegrationLayer {
  private supabase = createClient()
  private eventQueue: SecurityEventStream[] = []
  private flushInterval: NodeJS.Timeout | null = null
  private isInitialized = false
  
  /**
   * Initialize the integration layer
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return
    
    console.log('Initializing Security Integration Layer...')
    
    // Initialize dependent systems
    await securityAnalyticsEngine.initialize()
    await complianceEngine.initialize()
    await incidentManagement.initialize()
    
    // Setup event processing
    this.startEventProcessing()
    
    // Setup monitoring hooks
    await this.setupMonitoringHooks()
    
    this.isInitialized = true
    console.log('Security Integration Layer initialized successfully')
  }
  
  /**
   * Capture and process security event from any auth system
   */
  async captureSecurityEvent(
    eventType: string,
    eventData: {
      userId?: string
      sessionId?: string
      ipAddress: string
      userAgent: string
      success: boolean
      error?: string
      metadata?: Record<string, any>
    },
    httpRequest?: NextRequest
  ): Promise<void> {
    try {
      // Create enriched security event
      const event: Partial<SecurityEventStream> = {
        type: eventType,
        userId: eventData.userId,
        sessionId: eventData.sessionId,
        ipAddress: eventData.ipAddress,
        userAgent: eventData.userAgent,
        timestamp: new Date(),
        severity: this.determineSeverity(eventType, eventData)
      }
      
      // Enrich with additional context if enabled
      if (INTEGRATION_CONFIG.enrichment.ipGeolocation) {
        event.geoLocation = await this.getGeolocation(eventData.ipAddress)
      }
      
      if (INTEGRATION_CONFIG.enrichment.deviceFingerprinting) {
        event.deviceFingerprint = await this.generateDeviceFingerprint(eventData.userAgent, httpRequest)
      }
      
      if (INTEGRATION_CONFIG.enrichment.userBehaviorAnalysis && eventData.userId) {
        event.behaviorProfile = await this.analyzeBehavior(eventData.userId)
      }
      
      if (INTEGRATION_CONFIG.enrichment.threatIntelligence) {
        event.threatIntelligence = await this.getThreatIntelligence(eventData.ipAddress)
      }
      
      if (INTEGRATION_CONFIG.enrichment.riskScoring) {
        event.mlPredictions = await this.calculateRiskScore(event)
      }
      
      // Add compliance context
      event.complianceData = {
        gdprRelevant: this.isGDPRRelevant(eventType, eventData),
        piiAccessed: this.involvesPII(eventType, eventData),
        auditRequired: this.requiresAudit(eventType, eventData),
        retentionPeriod: this.getRetentionPeriod(eventType)
      }
      
      // Process immediately if critical
      if (event.severity === 'critical' || event.severity === 'high') {
        await this.processEventImmediate(event)
      } else {
        // Add to batch queue
        this.eventQueue.push(event as SecurityEventStream)
      }
      
    } catch (error) {
      console.error('Failed to capture security event:', error)
    }
  }
  
  /**
   * Integration methods for each authentication system
   */
  
  // Story 2.1: Supabase Auth Infrastructure Integration
  async monitorSupabaseAuth(
    operation: string,
    userId?: string,
    metadata?: Record<string, any>,
    httpRequest?: NextRequest
  ): Promise<void> {
    await this.captureSecurityEvent(`supabase_auth_${operation}`, {
      userId,
      ipAddress: this.getClientIP(httpRequest),
      userAgent: httpRequest?.headers.get('user-agent') || 'unknown',
      success: !metadata?.error,
      error: metadata?.error,
      metadata
    }, httpRequest)
  }
  
  // Story 2.2: Next.js Auth Middleware Integration
  async monitorMiddlewareAuth(
    operation: string,
    request: NextRequest,
    result: { success: boolean; userId?: string; error?: string }
  ): Promise<void> {
    await this.captureSecurityEvent(`middleware_${operation}`, {
      userId: result.userId,
      ipAddress: this.getClientIP(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      success: result.success,
      error: result.error,
      metadata: {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries())
      }
    }, request)
  }
  
  // Story 2.3: Authentication UI Components Integration
  async monitorAuthUI(
    component: string,
    action: string,
    userId?: string,
    result?: { success: boolean; error?: string },
    clientInfo?: { ipAddress: string; userAgent: string }
  ): Promise<void> {
    await this.captureSecurityEvent(`auth_ui_${component}_${action}`, {
      userId,
      ipAddress: clientInfo?.ipAddress || 'unknown',
      userAgent: clientInfo?.userAgent || 'unknown',
      success: result?.success ?? true,
      error: result?.error,
      metadata: { component, action }
    })
  }
  
  // Story 2.4: User Registration & Onboarding Integration
  async monitorUserRegistration(
    stage: string,
    userId?: string,
    email?: string,
    result?: { success: boolean; error?: string },
    httpRequest?: NextRequest
  ): Promise<void> {
    await this.captureSecurityEvent(`registration_${stage}`, {
      userId,
      ipAddress: this.getClientIP(httpRequest),
      userAgent: httpRequest?.headers.get('user-agent') || 'unknown',
      success: result?.success ?? true,
      error: result?.error,
      metadata: { stage, email: email ? this.hashEmail(email) : undefined }
    }, httpRequest)
  }
  
  // Story 2.5: Login & Session Management Integration
  async monitorSessionActivity(
    activity: string,
    userId?: string,
    sessionId?: string,
    result?: { success: boolean; error?: string },
    httpRequest?: NextRequest
  ): Promise<void> {
    await this.captureSecurityEvent(`session_${activity}`, {
      userId,
      sessionId,
      ipAddress: this.getClientIP(httpRequest),
      userAgent: httpRequest?.headers.get('user-agent') || 'unknown',
      success: result?.success ?? true,
      error: result?.error,
      metadata: { activity }
    }, httpRequest)
  }
  
  // Story 2.6: Password Reset & Recovery Integration
  async monitorPasswordOperations(
    operation: string,
    userId?: string,
    email?: string,
    result?: { success: boolean; error?: string },
    httpRequest?: NextRequest
  ): Promise<void> {
    await this.captureSecurityEvent(`password_${operation}`, {
      userId,
      ipAddress: this.getClientIP(httpRequest),
      userAgent: httpRequest?.headers.get('user-agent') || 'unknown',
      success: result?.success ?? true,
      error: result?.error,
      metadata: { 
        operation, 
        email: email ? this.hashEmail(email) : undefined,
        high_risk: this.isHighRiskPasswordOperation(operation)
      }
    }, httpRequest)
  }
  
  // Story 2.7: User Profile Management Integration
  async monitorProfileOperations(
    operation: string,
    userId: string,
    changes?: Record<string, any>,
    result?: { success: boolean; error?: string },
    httpRequest?: NextRequest
  ): Promise<void> {
    await this.captureSecurityEvent(`profile_${operation}`, {
      userId,
      ipAddress: this.getClientIP(httpRequest),
      userAgent: httpRequest?.headers.get('user-agent') || 'unknown',
      success: result?.success ?? true,
      error: result?.error,
      metadata: { 
        operation, 
        changes: changes ? Object.keys(changes) : undefined,
        sensitive_data_changed: this.involvesSensitiveProfileData(changes)
      }
    }, httpRequest)
  }
  
  // Story 2.8: RBAC System Integration
  async monitorRBACOperations(
    operation: string,
    actorUserId: string,
    targetUserId?: string,
    roleChanges?: Record<string, any>,
    result?: { success: boolean; error?: string },
    httpRequest?: NextRequest
  ): Promise<void> {
    await this.captureSecurityEvent(`rbac_${operation}`, {
      userId: actorUserId,
      ipAddress: this.getClientIP(httpRequest),
      userAgent: httpRequest?.headers.get('user-agent') || 'unknown',
      success: result?.success ?? true,
      error: result?.error,
      metadata: { 
        operation, 
        target_user_id: targetUserId,
        role_changes: roleChanges,
        privilege_elevation: this.isPrivilegeElevation(operation, roleChanges)
      }
    }, httpRequest)
  }
  
  // Story 2.9: Business Owner Verification Integration
  async monitorBusinessVerification(
    stage: string,
    userId: string,
    businessId?: string,
    verificationType?: string,
    result?: { success: boolean; error?: string },
    httpRequest?: NextRequest
  ): Promise<void> {
    await this.captureSecurityEvent(`business_verification_${stage}`, {
      userId,
      ipAddress: this.getClientIP(httpRequest),
      userAgent: httpRequest?.headers.get('user-agent') || 'unknown',
      success: result?.success ?? true,
      error: result?.error,
      metadata: { 
        stage, 
        business_id: businessId,
        verification_type: verificationType,
        kyc_relevant: true
      }
    }, httpRequest)
  }
  
  // MFA Operations Integration (from existing MFA system)
  async monitorMFAOperations(
    operation: string,
    userId: string,
    method?: string,
    deviceId?: string,
    result?: { success: boolean; error?: string },
    httpRequest?: NextRequest
  ): Promise<void> {
    await this.captureSecurityEvent(`mfa_${operation}`, {
      userId,
      ipAddress: this.getClientIP(httpRequest),
      userAgent: httpRequest?.headers.get('user-agent') || 'unknown',
      success: result?.success ?? true,
      error: result?.error,
      metadata: { 
        operation, 
        method,
        device_id: deviceId,
        high_security_event: true
      }
    }, httpRequest)
  }
  
  /**
   * Process critical events immediately
   */
  private async processEventImmediate(event: Partial<SecurityEventStream>): Promise<void> {
    try {
      // Process through analytics engine
      const result = await securityAnalyticsEngine.processSecurityEvent(event)
      
      // Check compliance
      const violations = await complianceEngine.monitorSecurityEvent(event as SecurityEventStream)
      
      // Create incidents if necessary
      if (result.threatDetections.length > 0 && result.threatDetections.some(t => t.automaticResponse)) {
        await incidentManagement.createIncidentFromEvent(
          { 
            id: event.id || `event_${Date.now()}`,
            type: event.type || 'unknown',
            severity: event.severity || 'medium',
            ipAddress: event.ipAddress || 'unknown',
            description: 'Critical security event detected',
            evidence: {}
          },
          result.threatDetections
        )
      }
      
      // Log processing result
      console.log(`Processed critical event ${event.type}: ${result.threatDetections.length} threats, ${violations.length} violations`)
      
    } catch (error) {
      console.error('Failed to process critical event:', error)
    }
  }
  
  /**
   * Batch process queued events
   */
  private async processBatchEvents(): Promise<void> {
    if (this.eventQueue.length === 0) return
    
    const batch = this.eventQueue.splice(0, INTEGRATION_CONFIG.eventCapture.batchSize)
    
    try {
      // Process batch through analytics engine
      const results = await Promise.all(
        batch.map(event => securityAnalyticsEngine.processSecurityEvent(event))
      )
      
      // Check compliance for all events
      const allViolations = await Promise.all(
        batch.map(event => complianceEngine.monitorSecurityEvent(event))
      )
      
      // Create incidents for high-risk events
      const incidents = []
      for (let i = 0; i < batch.length; i++) {
        const event = batch[i]
        const result = results[i]
        const violations = allViolations[i]
        
        if (result.threatDetections.length > 0 || violations.length > 0) {
          const incident = await incidentManagement.createIncidentFromEvent(
            {
              id: event.id,
              type: event.type,
              severity: event.severity,
              ipAddress: event.ipAddress,
              description: event.type,
              evidence: {}
            },
            result.threatDetections
          )
          incidents.push(incident)
        }
      }
      
      console.log(`Processed batch: ${batch.length} events, ${incidents.length} incidents created`)
      
    } catch (error) {
      console.error('Failed to process event batch:', error)
    }
  }
  
  /**
   * Start periodic event processing
   */
  private startEventProcessing(): void {
    if (this.flushInterval) return
    
    this.flushInterval = setInterval(async () => {
      await this.processBatchEvents()
    }, INTEGRATION_CONFIG.eventCapture.flushInterval)
  }
  
  /**
   * Setup monitoring hooks for existing authentication systems
   */
  private async setupMonitoringHooks(): Promise<void> {
    // In a real implementation, this would setup hooks/listeners
    // for each authentication system to automatically capture events
    console.log('Setting up monitoring hooks for all authentication systems...')
  }
  
  /**
   * Helper methods
   */
  
  private determineSeverity(eventType: string, eventData: any): 'low' | 'medium' | 'high' | 'critical' {
    // Critical events
    const criticalEvents = [
      'account_takeover_attempt',
      'privilege_escalation',
      'data_exfiltration',
      'admin_override',
      'emergency_access'
    ]
    
    // High severity events
    const highSeverityEvents = [
      'brute_force_attack',
      'impossible_travel',
      'multiple_failed_logins',
      'suspicious_device',
      'mfa_bypass_attempt'
    ]
    
    // Medium severity events
    const mediumSeverityEvents = [
      'failed_login',
      'password_reset',
      'profile_change',
      'role_change',
      'new_device_login'
    ]
    
    if (criticalEvents.some(event => eventType.includes(event))) return 'critical'
    if (highSeverityEvents.some(event => eventType.includes(event))) return 'high'
    if (mediumSeverityEvents.some(event => eventType.includes(event))) return 'medium'
    
    return 'low'
  }
  
  private getClientIP(request?: NextRequest): string {
    if (!request) return 'unknown'
    
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')
    const clientIP = request.headers.get('x-client-ip')
    
    return forwardedFor?.split(',')[0] || realIP || clientIP || 'unknown'
  }
  
  private hashEmail(email: string): string {
    // Simple hash for privacy (in production, use proper hashing)
    return Buffer.from(email).toString('base64').substring(0, 12)
  }
  
  private isHighRiskPasswordOperation(operation: string): boolean {
    return ['admin_reset', 'emergency_reset', 'bypass_verification'].includes(operation)
  }
  
  private involvesSensitiveProfileData(changes?: Record<string, any>): boolean {
    if (!changes) return false
    const sensitiveFields = ['email', 'phone', 'payment_info', 'ssn', 'tax_id']
    return Object.keys(changes).some(key => sensitiveFields.includes(key))
  }
  
  private isPrivilegeElevation(operation: string, roleChanges?: Record<string, any>): boolean {
    if (operation.includes('elevate') || operation.includes('promote')) return true
    if (roleChanges?.new_roles?.includes('admin') || roleChanges?.new_roles?.includes('super_admin')) return true
    return false
  }
  
  private isGDPRRelevant(eventType: string, eventData: any): boolean {
    const gdprEvents = ['profile_', 'data_', 'consent_', 'deletion_', 'export_']
    return gdprEvents.some(event => eventType.includes(event)) || eventData.metadata?.pii_involved
  }
  
  private involvesPII(eventType: string, eventData: any): boolean {
    const piiEvents = ['profile_', 'registration_', 'verification_', 'kyc_']
    return piiEvents.some(event => eventType.includes(event))
  }
  
  private requiresAudit(eventType: string, eventData: any): boolean {
    const auditEvents = ['rbac_', 'admin_', 'privilege_', 'financial_', 'compliance_']
    return auditEvents.some(event => eventType.includes(event))
  }
  
  private getRetentionPeriod(eventType: string): number {
    // Security events: 7 years, Regular events: 3 years, System events: 1 year
    if (eventType.includes('security') || eventType.includes('admin')) return 2555
    if (eventType.includes('compliance') || eventType.includes('audit')) return 2555
    if (eventType.includes('profile') || eventType.includes('rbac')) return 1095
    return 365
  }
  
  // Placeholder implementations for enrichment functions
  private async getGeolocation(ipAddress: string): Promise<any> {
    // Implement IP geolocation lookup
    return null
  }
  
  private async generateDeviceFingerprint(userAgent: string, request?: NextRequest): Promise<any> {
    // Implement device fingerprinting
    return null
  }
  
  private async analyzeBehavior(userId: string): Promise<any> {
    // Implement user behavior analysis
    return null
  }
  
  private async getThreatIntelligence(ipAddress: string): Promise<any> {
    // Implement threat intelligence lookup
    return null
  }
  
  private async calculateRiskScore(event: Partial<SecurityEventStream>): Promise<any> {
    // Implement ML-based risk scoring
    return null
  }
}

// Export singleton instance
export const securityIntegrationLayer = new SecurityIntegrationLayer()

// Convenience functions for each authentication system integration
export async function initializeSecurityIntegration(): Promise<void> {
  await securityIntegrationLayer.initialize()
}

// Story 2.1: Supabase Auth Integration
export const monitorSupabaseAuth = (
  operation: string,
  userId?: string,
  metadata?: Record<string, any>,
  httpRequest?: NextRequest
) => securityIntegrationLayer.monitorSupabaseAuth(operation, userId, metadata, httpRequest)

// Story 2.2: Middleware Integration
export const monitorMiddleware = (
  operation: string,
  request: NextRequest,
  result: { success: boolean; userId?: string; error?: string }
) => securityIntegrationLayer.monitorMiddlewareAuth(operation, request, result)

// Story 2.3: UI Components Integration
export const monitorAuthUI = (
  component: string,
  action: string,
  userId?: string,
  result?: { success: boolean; error?: string },
  clientInfo?: { ipAddress: string; userAgent: string }
) => securityIntegrationLayer.monitorAuthUI(component, action, userId, result, clientInfo)

// Story 2.4: Registration Integration
export const monitorRegistration = (
  stage: string,
  userId?: string,
  email?: string,
  result?: { success: boolean; error?: string },
  httpRequest?: NextRequest
) => securityIntegrationLayer.monitorUserRegistration(stage, userId, email, result, httpRequest)

// Story 2.5: Session Integration
export const monitorSession = (
  activity: string,
  userId?: string,
  sessionId?: string,
  result?: { success: boolean; error?: string },
  httpRequest?: NextRequest
) => securityIntegrationLayer.monitorSessionActivity(activity, userId, sessionId, result, httpRequest)

// Story 2.6: Password Integration
export const monitorPassword = (
  operation: string,
  userId?: string,
  email?: string,
  result?: { success: boolean; error?: string },
  httpRequest?: NextRequest
) => securityIntegrationLayer.monitorPasswordOperations(operation, userId, email, result, httpRequest)

// Story 2.7: Profile Integration
export const monitorProfile = (
  operation: string,
  userId: string,
  changes?: Record<string, any>,
  result?: { success: boolean; error?: string },
  httpRequest?: NextRequest
) => securityIntegrationLayer.monitorProfileOperations(operation, userId, changes, result, httpRequest)

// Story 2.8: RBAC Integration
export const monitorRBAC = (
  operation: string,
  actorUserId: string,
  targetUserId?: string,
  roleChanges?: Record<string, any>,
  result?: { success: boolean; error?: string },
  httpRequest?: NextRequest
) => securityIntegrationLayer.monitorRBACOperations(operation, actorUserId, targetUserId, roleChanges, result, httpRequest)

// Story 2.9: Business Verification Integration
export const monitorBusinessVerification = (
  stage: string,
  userId: string,
  businessId?: string,
  verificationType?: string,
  result?: { success: boolean; error?: string },
  httpRequest?: NextRequest
) => securityIntegrationLayer.monitorBusinessVerification(stage, userId, businessId, verificationType, result, httpRequest)

// MFA Integration
export const monitorMFA = (
  operation: string,
  userId: string,
  method?: string,
  deviceId?: string,
  result?: { success: boolean; error?: string },
  httpRequest?: NextRequest
) => securityIntegrationLayer.monitorMFAOperations(operation, userId, method, deviceId, result, httpRequest)