/**
 * EPIC 5 STORY 5.10: Payment Security & Compliance
 * Security API Endpoints Tests
 * 
 * Comprehensive test coverage for security API endpoints including
 * monitoring, compliance, incident management, and fraud detection APIs.
 */

import { NextRequest } from 'next/server';
import { GET as MonitoringGET, POST as MonitoringPOST, PUT as MonitoringPUT } from '@/app/api/payments/security/monitoring/route';
import { GET as ComplianceGET, POST as CompliancePOST, PUT as CompliancePUT, PATCH as CompliancePATCH } from '@/app/api/payments/security/compliance/route';
import { GET as IncidentsGET, POST as IncidentsPOST, PUT as IncidentsPUT, PATCH as IncidentsPATCH } from '@/app/api/payments/security/incidents/route';
import { GET as FraudGET, POST as FraudPOST, PUT as FraudPUT, PATCH as FraudPATCH, DELETE as FraudDELETE } from '@/app/api/payments/security/fraud/route';
import { SecurityEventType, SecuritySeverity } from '@/lib/payments/security-monitor';
import { ComplianceFramework } from '@/lib/payments/compliance-auditor';

// Mock all the security modules
jest.mock('@/lib/payments/security-monitor', () => ({
  __esModule: true,
  default: {
    getSecurityDashboard: jest.fn(() => Promise.resolve({
      timestamp: new Date(),
      metrics: { systemHealth: { securityPosture: { score: 95 }, overallStatus: 'healthy' } },
      activeAlerts: [],
      recentEvents: [],
      systemHealth: { overallStatus: 'healthy' },
      threatSummary: {},
      activeIncidents: []
    })),
    getSecurityMetrics: jest.fn(() => Promise.resolve({
      systemHealth: { securityPosture: { score: 95 }, overallStatus: 'healthy' },
      threatsBlocked: 25,
      responseTime: { average: 150 }
    })),
    reportSecurityEvent: jest.fn(() => Promise.resolve({
      id: 'evt_test_001',
      timestamp: new Date(),
      responseActions: []
    })),
    createIncident: jest.fn(() => Promise.resolve({
      incidentId: 'inc_test_001',
      status: 'open',
      severity: 'high',
      createdAt: new Date()
    }))
  },
  SecurityEventType: {
    FRAUD_DETECTED: 'fraud_detected',
    PAYMENT_ANOMALY: 'payment_anomaly',
    AUTHENTICATION_FAILURE: 'authentication_failure'
  },
  SecuritySeverity: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
  }
}));

jest.mock('@/lib/payments/fraud-detection', () => ({
  __esModule: true,
  default: {
    analyzeTransaction: jest.fn(() => Promise.resolve({
      transactionId: 'txn_test_001',
      overallScore: 65,
      riskLevel: 'medium',
      decision: 'review',
      confidence: 0.8,
      timestamp: new Date(),
      factors: [
        { type: 'amount', score: 70, weight: 0.3, description: 'High amount transaction', severity: 'medium' }
      ],
      recommendations: [{ action: 'review', reason: 'Elevated risk detected' }]
    })),
    generateDeviceFingerprint: jest.fn(() => Promise.resolve({
      id: 'fp_test_001',
      trustScore: 0.75,
      riskIndicators: [],
      browserInfo: { userAgent: 'test' },
      screenInfo: { width: 1920, height: 1080 },
      firstSeen: new Date(),
      lastSeen: new Date()
    })),
    checkVelocity: jest.fn(() => Promise.resolve([
      {
        userId: 'user_123',
        timeWindow: '1h',
        transactionCount: 5,
        totalAmount: 50000,
        uniqueDevices: 1,
        uniqueLocations: 1,
        riskScore: 45,
        exceeded: false,
        thresholds: { transactions: 10, amount: 100000, devices: 3, locations: 2 }
      }
    ])),
    updateFraudModel: jest.fn(() => Promise.resolve())
  }
}));

jest.mock('@/lib/payments/compliance-auditor', () => ({
  __esModule: true,
  default: {
    performComplianceAssessment: jest.fn(() => Promise.resolve({
      id: 'assess_test_001',
      framework: 'PCI_DSS',
      status: 'compliant',
      overallScore: 92,
      assessmentDate: new Date(),
      nextAssessment: new Date(),
      reportGenerated: true,
      reportPath: '/reports/test.pdf',
      requirements: [{ status: 'compliant' }],
      findings: [],
      recommendations: []
    })),
    monitorPolicyCompliance: jest.fn(() => Promise.resolve({
      totalPolicies: 10,
      compliantPolicies: 8,
      overallScore: 80,
      criticalViolations: 1,
      recommendations: ['Update policy documentation']
    })),
    trackRegulatoryRequirements: jest.fn(() => Promise.resolve({
      riskExposure: 'low',
      upcomingDeadlines: [],
      complianceGaps: [],
      lastUpdated: new Date()
    })),
    generateComplianceReport: jest.fn(() => Promise.resolve({
      id: 'report_test_001',
      type: 'compliance_assessment',
      framework: 'PCI_DSS',
      generatedAt: new Date(),
      filePath: '/reports/test.pdf',
      confidentiality: 'confidential',
      digitalSignature: 'signature_hash',
      detailedFindings: [],
      remediation: { prioritizedActions: [], timeline: '30 days' }
    })),
    validateAuditTrail: jest.fn(() => Promise.resolve({
      period: { start: new Date(), end: new Date() },
      totalEvents: 150,
      validationResults: {
        integrityCheck: { passed: true, details: 'All checks passed' },
        completenessCheck: { passed: true, details: 'Complete' },
        chronologyCheck: { passed: true, details: 'Chronologically valid' },
        encryptionCheck: { passed: true, details: 'Properly encrypted' }
      },
      complianceScore: 95,
      findings: [],
      recommendations: []
    })),
    recordAuditEntry: jest.fn(() => Promise.resolve())
  },
  ComplianceFramework: {
    PCI_DSS: 'PCI_DSS',
    SOC2_TYPE2: 'SOC2_TYPE2',
    GDPR: 'GDPR'
  },
  ReportType: {
    COMPLIANCE_ASSESSMENT: 'compliance_assessment',
    AUDIT_REPORT: 'audit_report'
  },
  AuditEventType: {
    PAYMENT_PROCESSING: 'payment_processing',
    DATA_ACCESS: 'data_access'
  }
}));

jest.mock('@/lib/payments/security-middleware', () => ({
  __esModule: true,
  default: {
    validatePaymentRequest: jest.fn(() => Promise.resolve({
      context: {
        userId: 'user_123',
        userRole: 'admin',
        isAdmin: true,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test'
      }
    })),
    logPaymentEvent: jest.fn(() => Promise.resolve())
  }
}));

// Helper function to create mock NextRequest
function createMockRequest(method: string, url: string, body?: any): NextRequest {
  const request = new NextRequest(new Request(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    }
  }));
  return request;
}

describe('Security Monitoring API', () => {
  describe('GET /api/payments/security/monitoring', () => {
    test('should return security dashboard data', async () => {
      const request = createMockRequest('GET', 'http://localhost:3000/api/payments/security/monitoring?timeWindow=24h');
      const response = await MonitoringGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(data.timeWindow).toBe('24h');
      expect(data.dashboard).toBeDefined();
      expect(data.metrics).toBeDefined();
      expect(data.summary).toBeDefined();
      expect(data.summary.overallSecurityScore).toBe(95);
    });

    test('should validate timeWindow parameter', async () => {
      const request = createMockRequest('GET', 'http://localhost:3000/api/payments/security/monitoring?timeWindow=invalid');
      const response = await MonitoringGET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid parameters');
    });

    test('should include fraud metrics', async () => {
      const request = createMockRequest('GET', 'http://localhost:3000/api/payments/security/monitoring');
      const response = await MonitoringGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metrics.fraud).toBeDefined();
      expect(data.metrics.fraud.averageRiskScore).toBeDefined();
    });
  });

  describe('POST /api/payments/security/monitoring', () => {
    test('should report security event successfully', async () => {
      const eventData = {
        type: SecurityEventType.FRAUD_DETECTED,
        severity: SecuritySeverity.HIGH,
        source: 'payment_gateway',
        userId: 'user_123',
        details: {
          action: 'payment_processing',
          description: 'Suspicious payment pattern detected',
          evidence: { transactionId: 'txn_001' }
        }
      };

      const request = createMockRequest('POST', 'http://localhost:3000/api/payments/security/monitoring', eventData);
      const response = await MonitoringPOST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.eventId).toBe('evt_test_001');
      expect(data.status).toBe('reported');
      expect(data.timestamp).toBeDefined();
    });

    test('should validate event data', async () => {
      const invalidEventData = {
        type: 'invalid_type',
        severity: 'invalid_severity',
        details: {}
      };

      const request = createMockRequest('POST', 'http://localhost:3000/api/payments/security/monitoring', invalidEventData);
      const response = await MonitoringPOST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid security event data');
    });
  });

  describe('PUT /api/payments/security/monitoring', () => {
    test('should create security incident successfully', async () => {
      const incidentData = {
        severity: SecuritySeverity.HIGH,
        title: 'Suspicious Payment Activity',
        description: 'Multiple failed payment attempts detected',
        relatedEvents: ['evt_001', 'evt_002']
      };

      const request = createMockRequest('PUT', 'http://localhost:3000/api/payments/security/monitoring', incidentData);
      const response = await MonitoringPUT(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.incidentId).toBe('inc_test_001');
      expect(data.status).toBe('open');
      expect(data.severity).toBe('high');
    });
  });
});

describe('Compliance API', () => {
  describe('GET /api/payments/security/compliance', () => {
    test('should return compliance status', async () => {
      const request = createMockRequest('GET', 'http://localhost:3000/api/payments/security/compliance?framework=PCI_DSS');
      const response = await ComplianceGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.framework).toBe('PCI_DSS');
      expect(data.complianceStatus).toBeDefined();
      expect(data.policyCompliance).toBeDefined();
      expect(data.regulatoryStatus).toBeDefined();
      expect(data.recentAssessments).toBeDefined();
    });

    test('should validate framework parameter', async () => {
      const request = createMockRequest('GET', 'http://localhost:3000/api/payments/security/compliance?framework=INVALID');
      const response = await ComplianceGET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid compliance framework');
    });
  });

  describe('POST /api/payments/security/compliance', () => {
    test('should perform compliance assessment', async () => {
      const assessmentData = {
        framework: ComplianceFramework.PCI_DSS,
        scope: {
          systems: ['payment_gateway'],
          dataTypes: ['cardholder_data']
        }
      };

      const request = createMockRequest('POST', 'http://localhost:3000/api/payments/security/compliance', assessmentData);
      const response = await CompliancePOST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.assessmentId).toBe('assess_test_001');
      expect(data.framework).toBe('PCI_DSS');
      expect(data.overallScore).toBe(92);
      expect(data.reportGenerated).toBe(true);
    });
  });

  describe('PUT /api/payments/security/compliance', () => {
    test('should generate compliance report', async () => {
      const reportData = {
        reportType: 'compliance_assessment',
        framework: ComplianceFramework.PCI_DSS
      };

      const request = createMockRequest('PUT', 'http://localhost:3000/api/payments/security/compliance', reportData);
      const response = await CompliancePUT(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.reportId).toBe('report_test_001');
      expect(data.reportType).toBe('compliance_assessment');
      expect(data.framework).toBe('PCI_DSS');
      expect(data.filePath).toBeDefined();
      expect(data.digitalSignature).toBeDefined();
    });
  });

  describe('PATCH /api/payments/security/compliance', () => {
    test('should validate audit trail', async () => {
      const validationData = {
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z',
        eventTypes: ['payment_processing']
      };

      const request = createMockRequest('PATCH', 'http://localhost:3000/api/payments/security/compliance', validationData);
      const response = await CompliancePATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.validationId).toBeDefined();
      expect(data.totalEvents).toBe(150);
      expect(data.complianceScore).toBe(95);
      expect(data.validationResults).toBeDefined();
      expect(data.summary.overallPassed).toBe(true);
    });

    test('should validate date range', async () => {
      const invalidData = {
        startDate: '2024-01-31T00:00:00Z',
        endDate: '2024-01-01T00:00:00Z' // End before start
      };

      const request = createMockRequest('PATCH', 'http://localhost:3000/api/payments/security/compliance', invalidData);
      const response = await CompliancePATCH(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Start date must be before end date');
    });
  });
});

describe('Incident Management API', () => {
  beforeEach(() => {
    // Mock incident-related functions
    (require('@/app/api/payments/security/incidents/route') as any).searchIncidents = jest.fn(() => Promise.resolve([
      {
        incidentId: 'inc_001',
        severity: 'high',
        status: 'investigating',
        title: 'Test Incident',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]));
    
    (require('@/app/api/payments/security/incidents/route') as any).getIncidentCount = jest.fn(() => Promise.resolve(1));
    (require('@/app/api/payments/security/incidents/route') as any).getIncidentStatistics = jest.fn(() => Promise.resolve({
      total: 1,
      byStatus: { investigating: 1 },
      bySeverity: { high: 1 }
    }));
  });

  describe('GET /api/payments/security/incidents', () => {
    test('should list incidents with pagination', async () => {
      const request = createMockRequest('GET', 'http://localhost:3000/api/payments/security/incidents?limit=25&offset=0');
      const response = await IncidentsGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.incidents)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.limit).toBe(25);
      expect(data.pagination.offset).toBe(0);
      expect(data.statistics).toBeDefined();
    });

    test('should filter incidents by status', async () => {
      const request = createMockRequest('GET', 'http://localhost:3000/api/payments/security/incidents?status=open,investigating');
      const response = await IncidentsGET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.incidents)).toBe(true);
    });
  });
});

describe('Fraud Detection API', () => {
  describe('GET /api/payments/security/fraud', () => {
    test('should return fraud detection metrics', async () => {
      const request = createMockRequest('GET', 'http://localhost:3000/api/payments/security/fraud?timeWindow=24h');
      const response = await FraudGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.timeWindow).toBe('24h');
      expect(data.metrics).toBeDefined();
      expect(data.modelStats).toBeDefined();
      expect(data.summary).toBeDefined();
      expect(data.thresholds).toBeDefined();
      expect(data.systemHealth).toBeDefined();
    });
  });

  describe('POST /api/payments/security/fraud', () => {
    test('should analyze transaction for fraud', async () => {
      const transactionData = {
        transactionId: 'txn_test_001',
        userId: 'user_123',
        amount: 10000,
        currency: 'USD',
        paymentMethodId: 'pm_test_001',
        ipAddress: '192.168.1.1'
      };

      const request = createMockRequest('POST', 'http://localhost:3000/api/payments/security/fraud', transactionData);
      const response = await FraudPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.transactionId).toBe('txn_test_001');
      expect(data.riskScore).toBe(65);
      expect(data.riskLevel).toBe('medium');
      expect(data.decision).toBe('review');
      expect(data.confidence).toBe(0.8);
      expect(Array.isArray(data.factors)).toBe(true);
      expect(Array.isArray(data.recommendations)).toBe(true);
      expect(data.nextAction).toBeDefined();
    });

    test('should validate transaction data', async () => {
      const invalidData = {
        transactionId: '',
        amount: -100,
        currency: 'INVALID'
      };

      const request = createMockRequest('POST', 'http://localhost:3000/api/payments/security/fraud', invalidData);
      const response = await FraudPOST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid transaction data');
    });
  });

  describe('PUT /api/payments/security/fraud', () => {
    test('should generate device fingerprint', async () => {
      const deviceData = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        screenWidth: 1920,
        screenHeight: 1080,
        language: 'en-US',
        timezone: 'America/New_York'
      };

      const request = createMockRequest('PUT', 'http://localhost:3000/api/payments/security/fraud', deviceData);
      const response = await FraudPUT(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.fingerprintId).toBe('fp_test_001');
      expect(data.trustScore).toBe(0.75);
      expect(data.deviceInfo).toBeDefined();
      expect(Array.isArray(data.recommendations)).toBe(true);
    });
  });

  describe('PATCH /api/payments/security/fraud', () => {
    test('should check velocity limits', async () => {
      const velocityData = {
        userId: 'user_123',
        customerId: 'cust_456',
        timeWindows: ['1h', '24h']
      };

      const request = createMockRequest('PATCH', 'http://localhost:3000/api/payments/security/fraud', velocityData);
      const response = await FraudPATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.userId).toBe('user_123');
      expect(data.overallRisk).toBeDefined();
      expect(data.exceedsLimits).toBe(false);
      expect(Array.isArray(data.checks)).toBe(true);
      expect(Array.isArray(data.recommendations)).toBe(true);
    });
  });

  describe('DELETE /api/payments/security/fraud', () => {
    test('should update fraud model', async () => {
      const modelData = {
        trainingData: [
          {
            transactionId: 'txn_train_001',
            features: [],
            actualOutcome: 'fraud' as const,
            confidence: 0.95
          }
        ],
        modelVersion: '2.1',
        description: 'Monthly model update'
      };

      const request = createMockRequest('DELETE', 'http://localhost:3000/api/payments/security/fraud', modelData);
      const response = await FraudDELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.modelVersion).toBeDefined();
      expect(data.trainingDataProcessed).toBe(1);
      expect(data.deployment).toBeDefined();
      expect(data.performance).toBeDefined();
    });
  });
});

describe('API Security', () => {
  test('should require authentication for all endpoints', async () => {
    // This would test the middleware validation
    // Since we're mocking the middleware to always succeed,
    // we verify it's called correctly
    const request = createMockRequest('GET', 'http://localhost:3000/api/payments/security/monitoring');
    await MonitoringGET(request);

    const paymentSecurity = require('@/lib/payments/security-middleware').default;
    expect(paymentSecurity.validatePaymentRequest).toHaveBeenCalled();
  });

  test('should validate request parameters', async () => {
    const request = createMockRequest('GET', 'http://localhost:3000/api/payments/security/monitoring?timeWindow=invalid');
    const response = await MonitoringGET(request);

    expect(response.status).toBe(400);
  });

  test('should handle authorization errors', async () => {
    // Mock authorization failure
    const paymentSecurity = require('@/lib/payments/security-middleware').default;
    paymentSecurity.validatePaymentRequest.mockResolvedValueOnce({
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    });

    const request = createMockRequest('GET', 'http://localhost:3000/api/payments/security/monitoring');
    const response = await MonitoringGET(request);

    expect(response.status).toBe(401);
  });
});

describe('Error Handling', () => {
  test('should handle service errors gracefully', async () => {
    // Mock service error
    const securityMonitor = require('@/lib/payments/security-monitor').default;
    securityMonitor.getSecurityDashboard.mockRejectedValueOnce(new Error('Service unavailable'));

    const request = createMockRequest('GET', 'http://localhost:3000/api/payments/security/monitoring');
    const response = await MonitoringGET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Security monitoring failed');
  });

  test('should validate JSON payload', async () => {
    // Test with invalid JSON would be handled by Next.js framework
    // but we can test our validation logic
    const invalidData = { type: 'invalid' };
    const request = createMockRequest('POST', 'http://localhost:3000/api/payments/security/monitoring', invalidData);
    const response = await MonitoringPOST(request);

    expect(response.status).toBe(400);
  });
});

describe('Performance', () => {
  test('should complete API calls within reasonable time', async () => {
    const startTime = Date.now();
    const request = createMockRequest('GET', 'http://localhost:3000/api/payments/security/monitoring');
    const response = await MonitoringGET(request);
    const endTime = Date.now();

    expect(response.status).toBe(200);
    expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
  });

  test('should handle concurrent requests', async () => {
    const requests = Array.from({ length: 5 }, () => 
      createMockRequest('GET', 'http://localhost:3000/api/payments/security/monitoring')
    );

    const startTime = Date.now();
    const promises = requests.map(request => MonitoringGET(request));
    const responses = await Promise.all(promises);
    const endTime = Date.now();

    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
    expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
  });
});