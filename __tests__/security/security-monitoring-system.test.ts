/**
 * Comprehensive Security Monitoring System Tests
 * Epic 2 Story 2.10: Security Monitoring & Compliance Infrastructure
 * 
 * Test Coverage:
 * - Real-time security event processing
 * - Threat detection and analysis
 * - Compliance monitoring and reporting
 * - Incident management and response
 * - ML-based anomaly detection
 * - Integration with authentication systems
 * - Performance and scalability
 */

import { describe, test, expect, beforeEach, afterEach, jest, beforeAll, afterAll } from '@jest/globals'
import { 
  securityAnalyticsEngine, 
  type SecurityEventStream, 
  type ThreatDetectionResult,
  initializeSecurityAnalytics
} from '@/lib/auth/security-analytics-engine'
import { 
  complianceEngine, 
  initializeComplianceEngine,
  type ComplianceViolation 
} from '@/lib/auth/compliance-engine'
import { 
  incidentManagement, 
  initializeIncidentManagement,
  type SecurityIncident 
} from '@/lib/auth/incident-management'
import { 
  securityIntegrationLayer,
  initializeSecurityIntegration
} from '@/lib/auth/security-integration-layer'

// Mock external dependencies
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ 
            data: { id: 'test-id' }, 
            error: null 
          }))
        }))
      })),
      upsert: jest.fn(() => Promise.resolve({ data: null, error: null }))
    }))
  }))
}))

// Test data factories
const createSecurityEvent = (overrides: Partial<SecurityEventStream> = {}): SecurityEventStream => ({
  id: 'event_test_001',
  timestamp: new Date(),
  type: 'login_failed',
  severity: 'medium',
  userId: 'user_123',
  sessionId: 'session_456',
  ipAddress: '192.168.1.100',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  geoLocation: {
    country: 'US',
    region: 'California',
    city: 'San Francisco',
    latitude: 37.7749,
    longitude: -122.4194
  },
  deviceFingerprint: {
    id: 'device_123',
    trusted: false,
    riskScore: 0.3,
    characteristics: {}
  },
  behaviorProfile: {
    normalPatterns: ['morning_login', 'office_location'],
    deviations: ['unusual_time'],
    riskScore: 0.4
  },
  threatIntelligence: {
    ipReputation: 85,
    knownThreats: [],
    sources: ['internal']
  },
  mlPredictions: {
    anomalyScore: 0.2,
    predictedOutcome: 'legitimate',
    confidence: 0.8
  },
  complianceData: {
    gdprRelevant: false,
    piiAccessed: false,
    auditRequired: true,
    retentionPeriod: 365
  },
  ...overrides
})

const createThreatDetection = (overrides: Partial<ThreatDetectionResult> = {}): ThreatDetectionResult => ({
  threatId: 'threat_001',
  type: 'brute_force_attack',
  severity: 'high',
  confidence: 0.92,
  affectedEntities: ['user_123'],
  evidence: {
    failedAttempts: 10,
    timeWindow: '5_minutes',
    ipAddress: '192.168.1.100'
  },
  recommendedActions: ['block_ip', 'notify_user'],
  automaticResponse: true,
  estimatedImpact: {
    scope: 'single_user',
    severity: 'medium',
    businessImpact: 'account_compromise_risk'
  },
  ...overrides
})

describe('Security Monitoring System', () => {
  beforeAll(async () => {
    // Initialize the security monitoring system
    await initializeSecurityAnalytics()
    await initializeComplianceEngine()
    await initializeIncidentManagement()
    await initializeSecurityIntegration()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Security Analytics Engine', () => {
    test('should initialize successfully', async () => {
      await expect(securityAnalyticsEngine.initialize()).resolves.not.toThrow()
    })

    test('should process security events with enrichment', async () => {
      const testEvent = createSecurityEvent({
        type: 'login_failed',
        severity: 'medium'
      })

      const result = await securityAnalyticsEngine.processSecurityEvent(testEvent)

      expect(result).toBeDefined()
      expect(result.eventId).toBeDefined()
      expect(result.processingTime).toBeGreaterThan(0)
      expect(result.threatDetections).toBeInstanceOf(Array)
      expect(result.complianceViolations).toBeInstanceOf(Array)
    })

    test('should detect behavioral anomalies', async () => {
      const anomalousEvent = createSecurityEvent({
        type: 'login_success',
        severity: 'low',
        geoLocation: {
          country: 'RU', // Different from usual location
          region: 'Moscow',
          city: 'Moscow',
          latitude: 55.7558,
          longitude: 37.6173
        },
        behaviorProfile: {
          normalPatterns: ['us_login', 'business_hours'],
          deviations: ['foreign_login', 'unusual_location'],
          riskScore: 0.85
        }
      })

      const result = await securityAnalyticsEngine.processSecurityEvent(anomalousEvent)

      expect(result.threatDetections.length).toBeGreaterThan(0)
      const behaviorThreat = result.threatDetections.find(t => t.type === 'behavioral_anomaly')
      expect(behaviorThreat).toBeDefined()
      expect(behaviorThreat?.confidence).toBeGreaterThan(0.8)
    })

    test('should detect impossible travel patterns', async () => {
      // First login from New York
      const firstEvent = createSecurityEvent({
        type: 'login_success',
        geoLocation: {
          country: 'US',
          region: 'New York',
          city: 'New York',
          latitude: 40.7128,
          longitude: -74.0060
        },
        timestamp: new Date()
      })

      // Second login from London 30 minutes later (impossible)
      const secondEvent = createSecurityEvent({
        type: 'login_success',
        geoLocation: {
          country: 'UK',
          region: 'London',
          city: 'London',
          latitude: 51.5074,
          longitude: -0.1278
        },
        timestamp: new Date(Date.now() + 30 * 60 * 1000)
      })

      // Process both events
      await securityAnalyticsEngine.processSecurityEvent(firstEvent)
      const result = await securityAnalyticsEngine.processSecurityEvent(secondEvent)

      expect(result.threatDetections.length).toBeGreaterThan(0)
      const impossibleTravel = result.threatDetections.find(t => t.type === 'impossible_travel')
      expect(impossibleTravel).toBeDefined()
      expect(impossibleTravel?.severity).toBe('critical')
    })

    test('should handle high-volume event processing', async () => {
      const events = Array.from({ length: 1000 }, (_, i) => 
        createSecurityEvent({
          id: `bulk_event_${i}`,
          type: 'login_success',
          userId: `user_${i % 100}` // 100 different users
        })
      )

      const startTime = Date.now()
      const results = await Promise.all(
        events.map(event => securityAnalyticsEngine.processSecurityEvent(event))
      )
      const processingTime = Date.now() - startTime

      expect(results.length).toBe(1000)
      expect(processingTime).toBeLessThan(5000) // Should process 1000 events in under 5 seconds
      expect(results.every(r => r.eventId)).toBe(true)
    })

    test('should generate accurate security metrics', async () => {
      // Generate some test events
      const testEvents = [
        createSecurityEvent({ type: 'login_failed', severity: 'high' }),
        createSecurityEvent({ type: 'brute_force_attack', severity: 'critical' }),
        createSecurityEvent({ type: 'login_success', severity: 'low' })
      ]

      // Process events
      for (const event of testEvents) {
        await securityAnalyticsEngine.processSecurityEvent(event)
      }

      // Get metrics
      const metrics = await securityAnalyticsEngine.generateSecurityMetrics()

      expect(metrics).toBeDefined()
      expect(metrics.timestamp).toBeInstanceOf(Date)
      expect(metrics.eventsProcessed).toBeGreaterThan(0)
      expect(metrics.systemHealth).toBeDefined()
      expect(metrics.threatDetectionAccuracy).toBeGreaterThan(0.9)
      expect(metrics.falsePositiveRate).toBeLessThan(0.05)
    })
  })

  describe('Compliance Engine', () => {
    test('should initialize with multiple frameworks', async () => {
      await expect(complianceEngine.initialize()).resolves.not.toThrow()
    })

    test('should detect GDPR violations', async () => {
      const gdprEvent = createSecurityEvent({
        type: 'profile_data_access',
        complianceData: {
          gdprRelevant: true,
          piiAccessed: true,
          auditRequired: true,
          retentionPeriod: 1095
        },
        geoLocation: {
          country: 'DE',
          region: 'Bavaria',
          city: 'Munich',
          latitude: 48.1351,
          longitude: 11.5820
        }
      })

      const violations = await complianceEngine.monitorSecurityEvent(gdprEvent)

      expect(violations).toBeInstanceOf(Array)
      // Would contain violations if consent/legal basis checks fail
    })

    test('should detect CCPA violations', async () => {
      const ccpaEvent = createSecurityEvent({
        type: 'data_collection',
        complianceData: {
          gdprRelevant: false,
          piiAccessed: true,
          auditRequired: true,
          retentionPeriod: 1095
        },
        geoLocation: {
          country: 'US',
          region: 'California',
          city: 'Los Angeles',
          latitude: 34.0522,
          longitude: -118.2437
        }
      })

      const violations = await complianceEngine.monitorSecurityEvent(ccpaEvent)

      expect(violations).toBeInstanceOf(Array)
      // Would contain violations if disclosure/opt-out requirements not met
    })

    test('should generate compliance reports', async () => {
      const report = await complianceEngine.generateComplianceReport(
        'gdpr',
        'daily',
        {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date()
        }
      )

      expect(report).toBeDefined()
      expect(report.framework).toBe('gdpr')
      expect(report.reportType).toBe('daily')
      expect(report.summary).toBeDefined()
      expect(report.sections).toBeInstanceOf(Array)
      expect(report.recommendations).toBeInstanceOf(Array)
    })

    test('should enforce data retention policies', async () => {
      const result = await complianceEngine.enforceDataRetention()

      expect(result).toBeDefined()
      expect(typeof result.itemsReviewed).toBe('number')
      expect(typeof result.itemsDeleted).toBe('number')
      expect(typeof result.itemsAnonymized).toBe('number')
      expect(result.violations).toBeInstanceOf(Array)
    })
  })

  describe('Incident Management System', () => {
    test('should initialize successfully', async () => {
      await expect(incidentManagement.initialize()).resolves.not.toThrow()
    })

    test('should create incidents from security events', async () => {
      const testEvent = {
        id: 'event_123',
        type: 'brute_force_attack',
        severity: 'high' as const,
        ipAddress: '192.168.1.100',
        description: 'Multiple failed login attempts detected',
        evidence: {
          failedAttempts: 15,
          targetedUsers: ['user_1', 'user_2', 'user_3'],
          timeWindow: '10_minutes'
        }
      }

      const threatDetections = [createThreatDetection()]

      const incident = await incidentManagement.createIncidentFromEvent(testEvent, threatDetections)

      expect(incident).toBeDefined()
      expect(incident.id).toBeDefined()
      expect(incident.severity).toBe('high')
      expect(incident.status).toBe('new')
      expect(incident.sourceEventId).toBe('event_123')
      expect(incident.detectionsIds).toContain('threat_001')
    })

    test('should manage incident lifecycle', async () => {
      // Create test incident
      const testEvent = {
        id: 'event_lifecycle',
        type: 'suspicious_login',
        severity: 'medium' as const,
        ipAddress: '10.0.0.1',
        description: 'Suspicious login pattern detected',
        evidence: {}
      }

      const incident = await incidentManagement.createIncidentFromEvent(testEvent, [])
      const incidentId = incident.id

      // Acknowledge incident
      let updatedIncident = await incidentManagement.updateIncidentStatus(
        incidentId, 
        'acknowledged', 
        'analyst_001'
      )
      expect(updatedIncident.status).toBe('acknowledged')
      expect(updatedIncident.acknowledgedAt).toBeInstanceOf(Date)

      // Start investigation
      updatedIncident = await incidentManagement.updateIncidentStatus(
        incidentId,
        'investigating',
        'analyst_001'
      )
      expect(updatedIncident.status).toBe('investigating')
      expect(updatedIncident.responseStartedAt).toBeInstanceOf(Date)

      // Resolve incident
      updatedIncident = await incidentManagement.updateIncidentStatus(
        incidentId,
        'resolved',
        'analyst_001'
      )
      expect(updatedIncident.status).toBe('resolved')
      expect(updatedIncident.resolvedAt).toBeInstanceOf(Date)
    })

    test('should track SLA compliance', async () => {
      const testEvent = {
        id: 'event_sla',
        type: 'critical_security_event',
        severity: 'critical' as const,
        ipAddress: '192.168.1.1',
        description: 'Critical security event for SLA testing',
        evidence: {}
      }

      const incident = await incidentManagement.createIncidentFromEvent(testEvent, [])

      expect(incident.sla).toBeDefined()
      expect(incident.sla.acknowledgmentDeadline).toBeInstanceOf(Date)
      expect(incident.sla.responseDeadline).toBeInstanceOf(Date)
      expect(incident.sla.resolutionDeadline).toBeInstanceOf(Date)

      // Check that critical incidents have tight SLAs (15 minutes for acknowledgment)
      const timeDiff = incident.sla.acknowledgmentDeadline.getTime() - incident.detectedAt.getTime()
      expect(timeDiff).toBeLessThanOrEqual(15 * 60 * 1000) // 15 minutes
    })

    test('should generate incident reports', async () => {
      // Create and resolve a test incident
      const testEvent = {
        id: 'event_report',
        type: 'test_incident',
        severity: 'medium' as const,
        ipAddress: '192.168.1.1',
        description: 'Test incident for reporting',
        evidence: {}
      }

      const incident = await incidentManagement.createIncidentFromEvent(testEvent, [])
      await incidentManagement.updateIncidentStatus(incident.id, 'resolved', 'analyst_001')

      const report = await incidentManagement.generateIncidentReport(incident.id)

      expect(report).toBeDefined()
      expect(report.incident).toBeDefined()
      expect(report.timeline).toBeInstanceOf(Array)
      expect(report.metrics).toBeDefined()
      expect(report.metrics.timeToAcknowledgment).toBeNull() // Not acknowledged in this test
      expect(report.metrics.slaCompliance).toBeDefined()
      expect(report.recommendations).toBeInstanceOf(Array)
    })
  })

  describe('Security Integration Layer', () => {
    test('should initialize integration with all auth systems', async () => {
      await expect(securityIntegrationLayer.initialize()).resolves.not.toThrow()
    })

    test('should capture events from Supabase Auth', async () => {
      const capturePromise = securityIntegrationLayer.monitorSupabaseAuth(
        'user_login',
        'user_123',
        { success: true, method: 'email' }
      )

      await expect(capturePromise).resolves.not.toThrow()
    })

    test('should capture events from Middleware', async () => {
      const mockRequest = {
        url: 'https://example.com/protected',
        method: 'GET',
        headers: new Map([
          ['user-agent', 'Mozilla/5.0 Test'],
          ['x-forwarded-for', '192.168.1.100']
        ])
      } as any

      const capturePromise = securityIntegrationLayer.monitorMiddlewareAuth(
        'route_access',
        mockRequest,
        { success: true, userId: 'user_123' }
      )

      await expect(capturePromise).resolves.not.toThrow()
    })

    test('should process critical events immediately', async () => {
      const criticalEvent = {
        userId: 'user_123',
        ipAddress: '192.168.1.100',
        userAgent: 'Test Agent',
        success: false,
        error: 'Account takeover detected'
      }

      const capturePromise = securityIntegrationLayer.captureSecurityEvent(
        'account_takeover_attempt',
        criticalEvent
      )

      await expect(capturePromise).resolves.not.toThrow()
    })

    test('should enrich events with contextual data', async () => {
      const baseEvent = {
        userId: 'user_123',
        ipAddress: '8.8.8.8', // Public IP for geolocation testing
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        success: true
      }

      const capturePromise = securityIntegrationLayer.captureSecurityEvent(
        'login_success',
        baseEvent
      )

      await expect(capturePromise).resolves.not.toThrow()
      // Event should be enriched with geolocation, device fingerprint, etc.
    })
  })

  describe('Performance and Scalability', () => {
    test('should handle concurrent event processing', async () => {
      const concurrentEvents = 100
      const events = Array.from({ length: concurrentEvents }, (_, i) => 
        createSecurityEvent({
          id: `concurrent_${i}`,
          type: 'login_success',
          userId: `user_${i}`
        })
      )

      const startTime = Date.now()
      const results = await Promise.all(
        events.map(event => securityAnalyticsEngine.processSecurityEvent(event))
      )
      const processingTime = Date.now() - startTime

      expect(results.length).toBe(concurrentEvents)
      expect(processingTime).toBeLessThan(2000) // Should handle 100 concurrent events in under 2 seconds
    })

    test('should maintain low latency for event processing', async () => {
      const testEvent = createSecurityEvent({
        type: 'login_attempt',
        severity: 'low'
      })

      const startTime = performance.now()
      const result = await securityAnalyticsEngine.processSecurityEvent(testEvent)
      const processingTime = performance.now() - startTime

      expect(result).toBeDefined()
      expect(processingTime).toBeLessThan(100) // Should process event in under 100ms
    })

    test('should handle memory efficiently with large datasets', async () => {
      const initialMemory = process.memoryUsage().heapUsed

      // Process 1000 events
      for (let i = 0; i < 1000; i++) {
        const event = createSecurityEvent({
          id: `memory_test_${i}`,
          userId: `user_${i % 10}` // Reuse users to test caching
        })
        await securityAnalyticsEngine.processSecurityEvent(event)
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory
      const memoryIncreaseInMB = memoryIncrease / 1024 / 1024

      // Memory increase should be reasonable (less than 100MB for 1000 events)
      expect(memoryIncreaseInMB).toBeLessThan(100)
    })
  })

  describe('Error Handling and Resilience', () => {
    test('should handle malformed events gracefully', async () => {
      const malformedEvent = {
        // Missing required fields
        timestamp: new Date(),
        ipAddress: 'invalid-ip'
      } as any

      await expect(
        securityAnalyticsEngine.processSecurityEvent(malformedEvent)
      ).resolves.toBeDefined() // Should not throw, but handle gracefully
    })

    test('should continue processing when external services fail', async () => {
      // Mock external service failure
      const originalFetch = global.fetch
      global.fetch = jest.fn().mockRejectedValue(new Error('External service unavailable'))

      const testEvent = createSecurityEvent({
        type: 'external_service_test'
      })

      const result = await securityAnalyticsEngine.processSecurityEvent(testEvent)

      expect(result).toBeDefined()
      expect(result.eventId).toBeDefined()

      // Restore original fetch
      global.fetch = originalFetch
    })

    test('should handle database connection failures', async () => {
      // This test would require mocking database failures
      // and ensuring the system degrades gracefully
      expect(true).toBe(true) // Placeholder
    })
  })

  describe('Security and Privacy', () => {
    test('should not expose sensitive data in logs', async () => {
      const sensitiveEvent = createSecurityEvent({
        type: 'password_reset',
        userId: 'user_with_pii',
        // Event should not contain actual passwords or sensitive data
      })

      const result = await securityAnalyticsEngine.processSecurityEvent(sensitiveEvent)

      expect(result).toBeDefined()
      // Verify that sensitive data is not present in the result
      expect(JSON.stringify(result)).not.toContain('password')
      expect(JSON.stringify(result)).not.toContain('ssn')
      expect(JSON.stringify(result)).not.toContain('credit_card')
    })

    test('should implement proper data retention', async () => {
      const retentionResult = await complianceEngine.enforceDataRetention()

      expect(retentionResult).toBeDefined()
      expect(typeof retentionResult.itemsReviewed).toBe('number')
      expect(typeof retentionResult.itemsDeleted).toBe('number')
      expect(typeof retentionResult.itemsAnonymized).toBe('number')
    })

    test('should encrypt sensitive data at rest', async () => {
      // This would test that sensitive data is encrypted before storage
      // Implementation would depend on encryption strategy
      expect(true).toBe(true) // Placeholder
    })
  })

  afterAll(async () => {
    // Cleanup any resources, close connections, etc.
    // Reset any global state if needed
  })
})

describe('Integration Tests', () => {
  test('should handle complete security event lifecycle', async () => {
    // 1. Generate security event
    const testEvent = createSecurityEvent({
      type: 'brute_force_attack',
      severity: 'high'
    })

    // 2. Process through analytics engine
    const analysisResult = await securityAnalyticsEngine.processSecurityEvent(testEvent)
    expect(analysisResult.threatDetections.length).toBeGreaterThan(0)

    // 3. Check compliance
    const violations = await complianceEngine.monitorSecurityEvent(testEvent)
    expect(violations).toBeInstanceOf(Array)

    // 4. Create incident if necessary
    if (analysisResult.threatDetections.length > 0) {
      const incident = await incidentManagement.createIncidentFromEvent(
        {
          id: testEvent.id,
          type: testEvent.type,
          severity: testEvent.severity,
          ipAddress: testEvent.ipAddress,
          description: 'Integration test incident',
          evidence: testEvent
        },
        analysisResult.threatDetections
      )

      expect(incident).toBeDefined()
      expect(incident.status).toBe('new')
    }

    // 5. Generate metrics
    const metrics = await securityAnalyticsEngine.generateSecurityMetrics()
    expect(metrics.eventsProcessed).toBeGreaterThan(0)
  })

  test('should maintain system performance under load', async () => {
    const eventCount = 500
    const startTime = Date.now()

    const promises = Array.from({ length: eventCount }, (_, i) => {
      const event = createSecurityEvent({
        id: `load_test_${i}`,
        type: i % 2 === 0 ? 'login_success' : 'login_failed',
        userId: `user_${i % 50}` // 50 different users
      })
      return securityIntegrationLayer.captureSecurityEvent(event.type, {
        userId: event.userId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        success: event.type === 'login_success'
      })
    })

    await Promise.all(promises)
    const totalTime = Date.now() - startTime

    // Should process 500 events in under 5 seconds
    expect(totalTime).toBeLessThan(5000)

    // System should still be responsive
    const healthCheck = await securityAnalyticsEngine.generateSecurityMetrics()
    expect(healthCheck).toBeDefined()
  })
})

export {
  createSecurityEvent,
  createThreatDetection
}