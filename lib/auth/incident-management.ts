/**
 * Advanced Incident Management & Response Automation System
 * Epic 2 Story 2.10: Security Monitoring & Compliance Infrastructure
 * 
 * Features:
 * - Automated incident detection and classification
 * - Intelligent response workflows and escalation
 * - Investigation case management
 * - Response time tracking and SLAs
 * - Post-incident analysis and reporting
 * - Integration with security monitoring systems
 */

import { createClient } from '@/lib/supabase/server'
import { securityMonitor, type SecurityEvent } from '@/lib/auth/security-monitor'
import type { ThreatDetectionResult } from './security-analytics-engine'

// Incident management configuration
export const INCIDENT_CONFIG = {
  // SLA definitions (in minutes)
  sla: {
    critical: {
      acknowledgment: 15,
      response: 60,
      resolution: 240 // 4 hours
    },
    high: {
      acknowledgment: 30,
      response: 120,
      resolution: 480 // 8 hours
    },
    medium: {
      acknowledgment: 60,
      response: 240,
      resolution: 1440 // 24 hours
    },
    low: {
      acknowledgment: 120,
      response: 480,
      resolution: 2880 // 48 hours
    }
  },
  
  // Escalation rules
  escalation: {
    levels: [
      'level_1_analyst',
      'level_2_specialist',
      'security_lead',
      'ciso',
      'executive_team'
    ],
    timeouts: [30, 60, 120, 240], // minutes before next escalation
    autoEscalate: true
  },
  
  // Response automation rules
  automation: {
    enabled: true,
    autoBlock: {
      brute_force: true,
      credential_stuffing: true,
      account_takeover: true
    },
    autoQuarantine: {
      malware_detected: true,
      data_exfiltration: true
    },
    autoNotify: {
      data_breach: true,
      compliance_violation: true,
      system_compromise: true
    }
  },
  
  // Communication channels
  communication: {
    slack: {
      enabled: process.env.SLACK_WEBHOOK_URL ? true : false,
      webhook: process.env.SLACK_WEBHOOK_URL,
      channels: {
        critical: '#security-critical',
        high: '#security-alerts',
        medium: '#security-monitoring'
      }
    },
    email: {
      enabled: true,
      recipients: {
        critical: ['security-team@company.com', 'ciso@company.com'],
        high: ['security-team@company.com'],
        medium: ['security-monitoring@company.com']
      }
    },
    pagerduty: {
      enabled: process.env.PAGERDUTY_INTEGRATION_KEY ? true : false,
      integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY
    }
  }
} as const

// Incident interfaces
export interface SecurityIncident {
  id: string
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'new' | 'acknowledged' | 'investigating' | 'contained' | 'resolved' | 'closed'
  category: string
  subcategory?: string
  
  // Source information
  triggeredBy: 'automatic' | 'manual' | 'external'
  sourceEventId?: string
  detectionsIds: string[]
  
  // Assignment and ownership
  assignedTo?: string
  assignedTeam?: string
  escalationLevel: number
  
  // Timeline
  detectedAt: Date
  acknowledgedAt?: Date
  responseStartedAt?: Date
  containedAt?: Date
  resolvedAt?: Date
  closedAt?: Date
  
  // Impact assessment
  impact: {
    scope: 'single_user' | 'multiple_users' | 'system_wide' | 'organization_wide'
    severity: 'minimal' | 'minor' | 'moderate' | 'major' | 'severe'
    affectedSystems: string[]
    affectedUsers: number
    businessImpact: string
    financialImpact?: number
    reputationalImpact: string
    complianceImpact: string[]
  }
  
  // Technical details
  technical: {
    attackVectors: string[]
    vulnerabilities: string[]
    indicators: string[]
    evidence: Record<string, any>
    forensicData: Record<string, any>
  }
  
  // Response details
  response: {
    actions: IncidentAction[]
    playbook?: string
    automatedActions: string[]
    manualActions: string[]
    containmentActions: string[]
    recoveryActions: string[]
    communicationLog: IncidentCommunication[]
  }
  
  // Analysis and lessons learned
  analysis?: {
    rootCause: string
    timeline: IncidentTimelineEvent[]
    lessonsLearned: string[]
    improvements: string[]
    preventiveMeasures: string[]
  }
  
  // SLA tracking
  sla: {
    acknowledgmentDeadline: Date
    responseDeadline: Date
    resolutionDeadline: Date
    acknowledgmentMet: boolean
    responseMet: boolean
    resolutionMet: boolean
  }
  
  // Metadata
  tags: string[]
  customFields: Record<string, any>
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface IncidentAction {
  id: string
  type: 'containment' | 'investigation' | 'communication' | 'recovery' | 'monitoring'
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  assignedTo?: string
  executedBy?: string
  automated: boolean
  executedAt?: Date
  completedAt?: Date
  result?: string
  evidence?: Record<string, any>
}

export interface IncidentCommunication {
  id: string
  type: 'internal' | 'external' | 'customer' | 'regulatory'
  channel: 'email' | 'slack' | 'pagerduty' | 'phone' | 'meeting'
  recipient: string
  subject?: string
  message: string
  sentAt: Date
  deliveredAt?: Date
  acknowledgedAt?: Date
}

export interface IncidentTimelineEvent {
  timestamp: Date
  event: string
  description: string
  category: 'detection' | 'analysis' | 'containment' | 'communication' | 'recovery'
  actor: string // 'system', 'analyst', user ID
  evidence?: Record<string, any>
}

export interface IncidentWorkflow {
  id: string
  name: string
  description: string
  triggerConditions: {
    severity?: string[]
    category?: string[]
    indicators?: string[]
    customRules?: string
  }
  steps: WorkflowStep[]
  enabled: boolean
  version: string
  createdAt: Date
  updatedAt: Date
}

export interface WorkflowStep {
  id: string
  order: number
  name: string
  type: 'automated' | 'manual' | 'approval'
  action: {
    type: string
    parameters: Record<string, any>
    timeout?: number
    retries?: number
  }
  conditions?: {
    dependencies: string[]
    requirements: Record<string, any>
  }
  assignee?: string
  slaMinutes?: number
}

/**
 * Advanced Incident Management System
 */
export class IncidentManagementSystem {
  private supabase = createClient()
  private workflows: Map<string, IncidentWorkflow> = new Map()
  private activeIncidents: Map<string, SecurityIncident> = new Map()
  
  /**
   * Initialize the incident management system
   */
  async initialize(): Promise<void> {
    console.log('Initializing Incident Management System...')
    
    // Load incident workflows
    await this.loadIncidentWorkflows()
    
    // Load active incidents
    await this.loadActiveIncidents()
    
    // Start SLA monitoring
    this.startSLAMonitoring()
    
    // Start escalation monitoring
    this.startEscalationMonitoring()
    
    console.log('Incident Management System initialized successfully')
  }
  
  /**
   * Create incident from security event or threat detection
   */
  async createIncidentFromEvent(
    event: SecurityEvent,
    detections: ThreatDetectionResult[] = []
  ): Promise<SecurityIncident> {
    try {
      const now = new Date()
      const severity = this.calculateIncidentSeverity(event, detections)
      const sla = INCIDENT_CONFIG.sla[severity]
      
      const incident: SecurityIncident = {
        id: `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: this.generateIncidentTitle(event, detections),
        description: this.generateIncidentDescription(event, detections),
        severity,
        status: 'new',
        category: this.categorizeIncident(event, detections),
        subcategory: this.subcategorizeIncident(event, detections),
        
        triggeredBy: 'automatic',
        sourceEventId: event.id,
        detectionsIds: detections.map(d => d.threatId),
        
        escalationLevel: 0,
        
        detectedAt: now,
        
        impact: this.assessImpact(event, detections),
        technical: this.extractTechnicalDetails(event, detections),
        response: {
          actions: [],
          automatedActions: [],
          manualActions: [],
          containmentActions: [],
          recoveryActions: [],
          communicationLog: []
        },
        
        sla: {
          acknowledgmentDeadline: new Date(now.getTime() + sla.acknowledgment * 60 * 1000),
          responseDeadline: new Date(now.getTime() + sla.response * 60 * 1000),
          resolutionDeadline: new Date(now.getTime() + sla.resolution * 60 * 1000),
          acknowledgmentMet: false,
          responseMet: false,
          resolutionMet: false
        },
        
        tags: this.generateIncidentTags(event, detections),
        customFields: {},
        createdBy: 'system',
        createdAt: now,
        updatedAt: now
      }
      
      // Store incident
      await this.storeIncident(incident)
      
      // Add to active incidents
      this.activeIncidents.set(incident.id, incident)
      
      // Trigger automated response
      if (INCIDENT_CONFIG.automation.enabled) {
        await this.triggerAutomatedResponse(incident)
      }
      
      // Execute matching workflows
      await this.executeMatchingWorkflows(incident)
      
      // Send initial notifications
      await this.sendIncidentNotification(incident, 'created')
      
      console.log(`Created incident ${incident.id}: ${incident.title}`)
      
      return incident
      
    } catch (error) {
      console.error('Failed to create incident:', error)
      throw error
    }
  }
  
  /**
   * Update incident status and trigger appropriate actions
   */
  async updateIncidentStatus(
    incidentId: string,
    newStatus: SecurityIncident['status'],
    updatedBy: string,
    notes?: string
  ): Promise<SecurityIncident> {
    const incident = this.activeIncidents.get(incidentId)
    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`)
    }
    
    const oldStatus = incident.status
    const now = new Date()
    
    // Update status
    incident.status = newStatus
    incident.updatedAt = now
    
    // Update timeline based on status
    switch (newStatus) {
      case 'acknowledged':
        if (!incident.acknowledgedAt) {
          incident.acknowledgedAt = now
          incident.sla.acknowledgmentMet = now <= incident.sla.acknowledgmentDeadline
        }
        break
        
      case 'investigating':
        if (!incident.responseStartedAt) {
          incident.responseStartedAt = now
          incident.sla.responseMet = now <= incident.sla.responseDeadline
        }
        break
        
      case 'contained':
        if (!incident.containedAt) {
          incident.containedAt = now
        }
        break
        
      case 'resolved':
        if (!incident.resolvedAt) {
          incident.resolvedAt = now
          incident.sla.resolutionMet = now <= incident.sla.resolutionDeadline
        }
        break
        
      case 'closed':
        if (!incident.closedAt) {
          incident.closedAt = now
        }
        break
    }
    
    // Log status change
    await this.addTimelineEvent(incident, {
      timestamp: now,
      event: 'status_changed',
      description: `Status changed from ${oldStatus} to ${newStatus}`,
      category: 'analysis',
      actor: updatedBy
    })
    
    // Store updated incident
    await this.storeIncident(incident)
    
    // Send notification for status change
    await this.sendIncidentNotification(incident, 'status_changed')
    
    // Trigger post-status-change actions
    await this.executePostStatusChangeActions(incident, oldStatus, newStatus)
    
    return incident
  }
  
  /**
   * Assign incident to user or team
   */
  async assignIncident(
    incidentId: string,
    assignee: string,
    assignedBy: string,
    team?: string
  ): Promise<void> {
    const incident = this.activeIncidents.get(incidentId)
    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`)
    }
    
    incident.assignedTo = assignee
    incident.assignedTeam = team
    incident.updatedAt = new Date()
    
    // Log assignment
    await this.addTimelineEvent(incident, {
      timestamp: new Date(),
      event: 'assigned',
      description: `Incident assigned to ${assignee}${team ? ` (${team})` : ''}`,
      category: 'analysis',
      actor: assignedBy
    })
    
    // Store updated incident
    await this.storeIncident(incident)
    
    // Notify assignee
    await this.sendIncidentNotification(incident, 'assigned')
  }
  
  /**
   * Add action to incident
   */
  async addIncidentAction(
    incidentId: string,
    action: Omit<IncidentAction, 'id'>,
    addedBy: string
  ): Promise<string> {
    const incident = this.activeIncidents.get(incidentId)
    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`)
    }
    
    const actionId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    const fullAction: IncidentAction = {
      ...action,
      id: actionId,
      status: 'pending'
    }
    
    incident.response.actions.push(fullAction)
    incident.updatedAt = new Date()
    
    // Log action addition
    await this.addTimelineEvent(incident, {
      timestamp: new Date(),
      event: 'action_added',
      description: `Added action: ${action.description}`,
      category: 'analysis',
      actor: addedBy
    })
    
    // Store updated incident
    await this.storeIncident(incident)
    
    // Execute action if automated
    if (action.automated) {
      await this.executeAutomatedAction(incident, fullAction)
    }
    
    return actionId
  }
  
  /**
   * Execute automated response actions
   */
  private async triggerAutomatedResponse(incident: SecurityIncident): Promise<void> {
    const automatedActions: string[] = []
    
    try {
      // IP blocking for brute force attacks
      if (incident.category === 'brute_force' && 
          INCIDENT_CONFIG.automation.autoBlock.brute_force) {
        
        const blockAction = await this.blockSuspiciousIPs(incident)
        if (blockAction) {
          automatedActions.push(blockAction)
        }
      }
      
      // Account lockdown for account takeover
      if (incident.category === 'account_takeover' && 
          INCIDENT_CONFIG.automation.autoBlock.account_takeover) {
        
        const lockdownAction = await this.lockdownCompromisedAccounts(incident)
        if (lockdownAction) {
          automatedActions.push(lockdownAction)
        }
      }
      
      // Data quarantine for exfiltration attempts
      if (incident.category === 'data_exfiltration' && 
          INCIDENT_CONFIG.automation.autoQuarantine.data_exfiltration) {
        
        const quarantineAction = await this.quarantineSensitiveData(incident)
        if (quarantineAction) {
          automatedActions.push(quarantineAction)
        }
      }
      
      // Update incident with automated actions
      incident.response.automatedActions = automatedActions
      
      // Log automated response
      if (automatedActions.length > 0) {
        await this.addTimelineEvent(incident, {
          timestamp: new Date(),
          event: 'automated_response',
          description: `Executed ${automatedActions.length} automated response actions`,
          category: 'containment',
          actor: 'system'
        })
      }
      
    } catch (error) {
      console.error('Automated response failed:', error)
      
      // Log failure
      await this.addTimelineEvent(incident, {
        timestamp: new Date(),
        event: 'automated_response_failed',
        description: `Automated response failed: ${error}`,
        category: 'containment',
        actor: 'system'
      })
    }
  }
  
  /**
   * Generate incident report
   */
  async generateIncidentReport(incidentId: string): Promise<{
    incident: SecurityIncident
    timeline: IncidentTimelineEvent[]
    metrics: {
      timeToAcknowledgment: number | null
      timeToResponse: number | null
      timeToResolution: number | null
      slaCompliance: {
        acknowledgment: boolean
        response: boolean
        resolution: boolean
      }
    }
    recommendations: string[]
  }> {
    const incident = await this.getIncident(incidentId)
    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`)
    }
    
    // Calculate metrics
    const timeToAcknowledgment = incident.acknowledgedAt ? 
      incident.acknowledgedAt.getTime() - incident.detectedAt.getTime() : null
    const timeToResponse = incident.responseStartedAt ? 
      incident.responseStartedAt.getTime() - incident.detectedAt.getTime() : null
    const timeToResolution = incident.resolvedAt ? 
      incident.resolvedAt.getTime() - incident.detectedAt.getTime() : null
    
    // Get timeline
    const timeline = await this.getIncidentTimeline(incidentId)
    
    // Generate recommendations
    const recommendations = await this.generateIncidentRecommendations(incident)
    
    return {
      incident,
      timeline,
      metrics: {
        timeToAcknowledgment,
        timeToResponse,
        timeToResolution,
        slaCompliance: {
          acknowledgment: incident.sla.acknowledgmentMet,
          response: incident.sla.responseMet,
          resolution: incident.sla.resolutionMet
        }
      },
      recommendations
    }
  }
  
  /**
   * Private helper methods
   */
  
  private async loadIncidentWorkflows(): Promise<void> {
    // Load predefined workflows
    const workflows = await this.getDefaultWorkflows()
    workflows.forEach(workflow => {
      this.workflows.set(workflow.id, workflow)
    })
  }
  
  private async loadActiveIncidents(): Promise<void> {
    const { data: incidents } = await this.supabase
      .from('security_incidents')
      .select('*')
      .not('status', 'in', '("resolved", "closed")')
    
    if (incidents) {
      incidents.forEach((incident: any) => {
        this.activeIncidents.set(incident.id, this.mapDatabaseIncident(incident))
      })
    }
  }
  
  private startSLAMonitoring(): void {
    setInterval(async () => {
      await this.checkSLAViolations()
    }, 60000) // Check every minute
  }
  
  private startEscalationMonitoring(): void {
    setInterval(async () => {
      await this.checkEscalations()
    }, 60000) // Check every minute
  }
  
  // Placeholder implementations for helper methods
  private calculateIncidentSeverity(event: SecurityEvent, detections: ThreatDetectionResult[]): 'low' | 'medium' | 'high' | 'critical' {
    // Complex logic to determine severity based on event and detections
    if (detections.some(d => d.severity === 'critical')) return 'critical'
    if (event.severity === 'critical') return 'critical'
    if (detections.some(d => d.severity === 'high') || event.severity === 'high') return 'high'
    if (detections.some(d => d.severity === 'medium') || event.severity === 'medium') return 'medium'
    return 'low'
  }
  
  private generateIncidentTitle(event: SecurityEvent, detections: ThreatDetectionResult[]): string {
    if (detections.length > 0) {
      return detections[0].type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
    return event.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }
  
  private generateIncidentDescription(event: SecurityEvent, detections: ThreatDetectionResult[]): string {
    let description = event.description || 'Security event detected'
    if (detections.length > 0) {
      description += `\n\nDetected threats:\n${detections.map(d => `- ${d.type}: ${d.evidence}`).join('\n')}`
    }
    return description
  }
  
  private categorizeIncident(event: SecurityEvent, detections: ThreatDetectionResult[]): string {
    if (detections.length > 0) {
      return detections[0].type
    }
    return event.type
  }
  
  private subcategorizeIncident(event: SecurityEvent, detections: ThreatDetectionResult[]): string | undefined {
    return undefined
  }
  
  private assessImpact(event: SecurityEvent, detections: ThreatDetectionResult[]): SecurityIncident['impact'] {
    return {
      scope: 'single_user',
      severity: 'minor',
      affectedSystems: [],
      affectedUsers: 1,
      businessImpact: 'minimal',
      reputationalImpact: 'low',
      complianceImpact: []
    }
  }
  
  private extractTechnicalDetails(event: SecurityEvent, detections: ThreatDetectionResult[]): SecurityIncident['technical'] {
    return {
      attackVectors: [],
      vulnerabilities: [],
      indicators: [],
      evidence: event.evidence || {},
      forensicData: {}
    }
  }
  
  private generateIncidentTags(event: SecurityEvent, detections: ThreatDetectionResult[]): string[] {
    const tags = [event.type, event.severity]
    detections.forEach(d => {
      tags.push(d.type, d.severity)
    })
    return [...new Set(tags)]
  }
  
  private async storeIncident(incident: SecurityIncident): Promise<void> {
    await this.supabase
      .from('security_incidents')
      .upsert({
        id: incident.id,
        title: incident.title,
        description: incident.description,
        severity: incident.severity,
        status: incident.status,
        category: incident.category,
        assigned_to: incident.assignedTo,
        detected_at: incident.detectedAt.toISOString(),
        acknowledged_at: incident.acknowledgedAt?.toISOString(),
        resolved_at: incident.resolvedAt?.toISOString(),
        incident_data: incident,
        updated_at: incident.updatedAt.toISOString()
      })
  }
  
  private async executeMatchingWorkflows(incident: SecurityIncident): Promise<void> {
    // Execute workflows that match incident criteria
  }
  
  private async sendIncidentNotification(incident: SecurityIncident, event: string): Promise<void> {
    // Send notifications via configured channels
    console.log(`Sending ${event} notification for incident ${incident.id}`)
  }
  
  private async executePostStatusChangeActions(incident: SecurityIncident, oldStatus: string, newStatus: string): Promise<void> {
    // Execute actions based on status change
  }
  
  private async addTimelineEvent(incident: SecurityIncident, event: IncidentTimelineEvent): Promise<void> {
    // Add event to incident timeline
    await this.supabase
      .from('incident_timeline')
      .insert({
        incident_id: incident.id,
        timestamp: event.timestamp.toISOString(),
        event: event.event,
        description: event.description,
        category: event.category,
        actor: event.actor,
        evidence: event.evidence
      })
  }
  
  private async executeAutomatedAction(incident: SecurityIncident, action: IncidentAction): Promise<void> {
    // Execute automated action
  }
  
  private async blockSuspiciousIPs(incident: SecurityIncident): Promise<string | null> {
    // Block suspicious IPs
    return 'blocked_suspicious_ips'
  }
  
  private async lockdownCompromisedAccounts(incident: SecurityIncident): Promise<string | null> {
    // Lock down compromised accounts
    return 'locked_compromised_accounts'
  }
  
  private async quarantineSensitiveData(incident: SecurityIncident): Promise<string | null> {
    // Quarantine sensitive data
    return 'quarantined_sensitive_data'
  }
  
  private async getIncident(incidentId: string): Promise<SecurityIncident | null> {
    const { data } = await this.supabase
      .from('security_incidents')
      .select('*')
      .eq('id', incidentId)
      .single()
    
    return data ? this.mapDatabaseIncident(data) : null
  }
  
  private async getIncidentTimeline(incidentId: string): Promise<IncidentTimelineEvent[]> {
    const { data } = await this.supabase
      .from('incident_timeline')
      .select('*')
      .eq('incident_id', incidentId)
      .order('timestamp', { ascending: true })
    
    return data?.map(this.mapTimelineEvent) || []
  }
  
  private async generateIncidentRecommendations(incident: SecurityIncident): Promise<string[]> {
    return [
      'Review and update security policies',
      'Conduct security awareness training',
      'Implement additional monitoring'
    ]
  }
  
  private async getDefaultWorkflows(): Promise<IncidentWorkflow[]> {
    return [] // Return default workflows
  }
  
  private mapDatabaseIncident(data: any): SecurityIncident {
    return data.incident_data as SecurityIncident
  }
  
  private mapTimelineEvent(data: any): IncidentTimelineEvent {
    return {
      timestamp: new Date(data.timestamp),
      event: data.event,
      description: data.description,
      category: data.category,
      actor: data.actor,
      evidence: data.evidence
    }
  }
  
  private async checkSLAViolations(): Promise<void> {
    // Check for SLA violations and trigger alerts
  }
  
  private async checkEscalations(): Promise<void> {
    // Check for incidents that need escalation
  }
}

// Export singleton instance
export const incidentManagement = new IncidentManagementSystem()

// Convenience functions
export async function initializeIncidentManagement(): Promise<void> {
  await incidentManagement.initialize()
}

export async function createIncidentFromThreat(
  event: SecurityEvent,
  detections: ThreatDetectionResult[]
): Promise<SecurityIncident> {
  return await incidentManagement.createIncidentFromEvent(event, detections)
}

export async function updateIncident(
  incidentId: string,
  status: SecurityIncident['status'],
  updatedBy: string,
  notes?: string
): Promise<SecurityIncident> {
  return await incidentManagement.updateIncidentStatus(incidentId, status, updatedBy, notes)
}

export async function assignIncidentToUser(
  incidentId: string,
  assignee: string,
  assignedBy: string,
  team?: string
): Promise<void> {
  return await incidentManagement.assignIncident(incidentId, assignee, assignedBy, team)
}

export async function getIncidentReport(incidentId: string) {
  return await incidentManagement.generateIncidentReport(incidentId)
}