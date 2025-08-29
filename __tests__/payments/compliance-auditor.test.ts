/**
 * EPIC 5 STORY 5.10: Payment Security & Compliance
 * Compliance Auditor Tests
 * 
 * Comprehensive test coverage for compliance auditing including PCI DSS assessments,
 * audit trail validation, policy compliance monitoring, and regulatory reporting.
 */

import complianceAuditor, { 
  ComplianceAuditor,
  ComplianceFramework,
  ReportType,
  AuditEventType,
  ComplianceStatus
} from '@/lib/payments/compliance-auditor';

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null })),
          gte: jest.fn(() => ({
            lte: jest.fn(() => ({
              order: jest.fn(() => ({
                in: jest.fn(() => Promise.resolve({ data: [] })),
                single: jest.fn(() => Promise.resolve({ data: null }))
              })),
              in: jest.fn(() => Promise.resolve({ data: [] }))
            }))
          }))
        }))
      })),
      insert: jest.fn(() => Promise.resolve({ data: {}, error: null })),
      update: jest.fn(() => Promise.resolve({ data: {}, error: null }))
    }))
  }))
}));

describe('ComplianceAuditor', () => {
  let auditor: ComplianceAuditor;

  beforeEach(() => {
    auditor = new ComplianceAuditor();
    jest.clearAllMocks();
  });

  describe('Compliance Assessment', () => {
    test('should perform PCI DSS compliance assessment', async () => {
      const assessment = await auditor.performComplianceAssessment(
        ComplianceFramework.PCI_DSS
      );

      expect(assessment).toBeDefined();
      expect(assessment.id).toBeDefined();
      expect(assessment.framework).toBe(ComplianceFramework.PCI_DSS);
      expect(assessment.version).toBe('4.0');
      expect(assessment.assessmentDate).toBeInstanceOf(Date);
      expect(assessment.assessor).toBe('system');
      expect(assessment.status).toBeOneOf(Object.values(ComplianceStatus));
      expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
      expect(assessment.overallScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(assessment.requirements)).toBe(true);
      expect(Array.isArray(assessment.findings)).toBe(true);
      expect(Array.isArray(assessment.recommendations)).toBe(true);
      expect(assessment.evidencePackage).toBeDefined();
      expect(assessment.nextAssessment).toBeInstanceOf(Date);
    });

    test('should perform SOC 2 Type II assessment', async () => {
      const assessment = await auditor.performComplianceAssessment(
        ComplianceFramework.SOC2_TYPE2
      );

      expect(assessment).toBeDefined();
      expect(assessment.framework).toBe(ComplianceFramework.SOC2_TYPE2);
      expect(assessment.version).toBe('2017');
    });

    test('should perform GDPR compliance assessment', async () => {
      const assessment = await auditor.performComplianceAssessment(
        ComplianceFramework.GDPR
      );

      expect(assessment).toBeDefined();
      expect(assessment.framework).toBe(ComplianceFramework.GDPR);
      expect(assessment.version).toBe('2018');
    });

    test('should include custom assessment scope', async () => {
      const customScope = {
        systems: ['payment_gateway', 'database', 'api'],
        dataTypes: ['cardholder_data', 'authentication_data'],
        processes: ['payment_processing', 'data_storage'],
        locations: ['primary_datacenter', 'backup_site']
      };

      const assessment = await auditor.performComplianceAssessment(
        ComplianceFramework.PCI_DSS,
        customScope
      );

      expect(assessment.scope).toEqual(customScope);
    });

    test('should generate compliance report automatically', async () => {
      const assessment = await auditor.performComplianceAssessment(
        ComplianceFramework.PCI_DSS
      );

      expect(assessment.reportGenerated).toBe(true);
      expect(assessment.reportPath).toBeDefined();
      expect(typeof assessment.reportPath).toBe('string');
    });

    test('should handle assessment errors gracefully', async () => {
      // Test with invalid framework (forcing error)
      const invalidFramework = 'INVALID_FRAMEWORK' as ComplianceFramework;
      
      await expect(auditor.performComplianceAssessment(invalidFramework))
        .rejects.toThrow('Compliance assessment failed');
    });
  });

  describe('Audit Trail Validation', () => {
    test('should validate audit trail integrity', async () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-31T23:59:59Z');

      const validation = await auditor.validateAuditTrail(startDate, endDate);

      expect(validation).toBeDefined();
      expect(validation.period.start).toEqual(startDate);
      expect(validation.period.end).toEqual(endDate);
      expect(validation.totalEvents).toBeGreaterThanOrEqual(0);
      expect(validation.validationResults).toBeDefined();
      expect(validation.validationResults.integrityCheck).toBeDefined();
      expect(validation.validationResults.completenessCheck).toBeDefined();
      expect(validation.validationResults.chronologyCheck).toBeDefined();
      expect(validation.validationResults.encryptionCheck).toBeDefined();
      expect(validation.complianceScore).toBeGreaterThanOrEqual(0);
      expect(validation.complianceScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(validation.findings)).toBe(true);
      expect(Array.isArray(validation.recommendations)).toBe(true);
    });

    test('should filter audit trail by event types', async () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-31T23:59:59Z');
      const eventTypes = [AuditEventType.PAYMENT_PROCESSING, AuditEventType.DATA_ACCESS];

      const validation = await auditor.validateAuditTrail(startDate, endDate, eventTypes);

      expect(validation).toBeDefined();
      expect(validation.totalEvents).toBeGreaterThanOrEqual(0);
    });

    test('should detect audit trail integrity issues', async () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-31T23:59:59Z');

      const validation = await auditor.validateAuditTrail(startDate, endDate);

      // Check validation structure
      expect(validation.validationResults.integrityCheck.passed).toBeDefined();
      expect(validation.validationResults.completenessCheck.passed).toBeDefined();
      expect(validation.validationResults.chronologyCheck.passed).toBeDefined();
      expect(validation.validationResults.encryptionCheck.passed).toBeDefined();

      // If there are findings, they should be properly structured
      validation.findings.forEach(finding => {
        expect(finding).toBeDefined();
      });
    });

    test('should handle invalid date ranges', async () => {
      const startDate = new Date('2024-01-31T00:00:00Z');
      const endDate = new Date('2024-01-01T00:00:00Z'); // End before start

      await expect(auditor.validateAuditTrail(startDate, endDate))
        .rejects.toThrow('Audit trail validation failed');
    });
  });

  describe('Policy Compliance Monitoring', () => {
    test('should monitor policy compliance', async () => {
      const complianceReport = await auditor.monitorPolicyCompliance();

      expect(complianceReport).toBeDefined();
      expect(complianceReport.generatedAt).toBeInstanceOf(Date);
      expect(complianceReport.totalPolicies).toBeGreaterThanOrEqual(0);
      expect(complianceReport.compliantPolicies).toBeGreaterThanOrEqual(0);
      expect(complianceReport.nonCompliantPolicies).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(complianceReport.policyDetails)).toBe(true);
      expect(complianceReport.overallScore).toBeGreaterThanOrEqual(0);
      expect(complianceReport.overallScore).toBeLessThanOrEqual(100);
      expect(complianceReport.criticalViolations).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(complianceReport.recommendations)).toBe(true);
    });

    test('should calculate overall compliance score correctly', async () => {
      const complianceReport = await auditor.monitorPolicyCompliance();

      // Overall score should be reasonable
      if (complianceReport.totalPolicies > 0) {
        const expectedScore = Math.round(
          (complianceReport.compliantPolicies / complianceReport.totalPolicies) * 100
        );
        expect(complianceReport.overallScore).toBe(expectedScore);
      }
    });

    test('should provide policy recommendations', async () => {
      const complianceReport = await auditor.monitorPolicyCompliance();

      if (complianceReport.nonCompliantPolicies > 0) {
        expect(complianceReport.recommendations.length).toBeGreaterThan(0);
        complianceReport.recommendations.forEach(recommendation => {
          expect(typeof recommendation).toBe('string');
          expect(recommendation.length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('Compliance Report Generation', () => {
    test('should generate compliance report', async () => {
      const assessment = await auditor.performComplianceAssessment(
        ComplianceFramework.PCI_DSS
      );

      const report = await auditor.generateComplianceReport(
        assessment,
        ReportType.COMPLIANCE_ASSESSMENT
      );

      expect(report).toBeDefined();
      expect(report.id).toBeDefined();
      expect(report.type).toBe(ReportType.COMPLIANCE_ASSESSMENT);
      expect(report.framework).toBe(ComplianceFramework.PCI_DSS);
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.generatedBy).toBe('system');
      expect(report.assessmentId).toBe(assessment.id);
      expect(report.executiveSummary).toBeDefined();
      expect(Array.isArray(report.detailedFindings)).toBe(true);
      expect(report.riskAssessment).toBeDefined();
      expect(report.remediation).toBeDefined();
      expect(Array.isArray(report.appendices)).toBe(true);
      expect(report.filePath).toBeDefined();
      expect(report.digitalSignature).toBeDefined();
    });

    test('should generate audit report', async () => {
      const assessment = await auditor.performComplianceAssessment(
        ComplianceFramework.PCI_DSS
      );

      const report = await auditor.generateComplianceReport(
        assessment,
        ReportType.AUDIT_REPORT
      );

      expect(report.type).toBe(ReportType.AUDIT_REPORT);
    });

    test('should generate risk assessment report', async () => {
      const assessment = await auditor.performComplianceAssessment(
        ComplianceFramework.PCI_DSS
      );

      const report = await auditor.generateComplianceReport(
        assessment,
        ReportType.RISK_ASSESSMENT
      );

      expect(report.type).toBe(ReportType.RISK_ASSESSMENT);
    });

    test('should include digital signature', async () => {
      const assessment = await auditor.performComplianceAssessment(
        ComplianceFramework.PCI_DSS
      );

      const report = await auditor.generateComplianceReport(assessment);

      expect(report.digitalSignature).toBeDefined();
      expect(typeof report.digitalSignature).toBe('string');
      expect(report.digitalSignature.length).toBeGreaterThan(0);
    });
  });

  describe('Regulatory Requirements Tracking', () => {
    test('should track regulatory requirements', async () => {
      const tracker = await auditor.trackRegulatoryRequirements();

      expect(tracker).toBeDefined();
      expect(tracker.lastUpdated).toBeInstanceOf(Date);
      expect(Array.isArray(tracker.frameworks)).toBe(true);
      expect(Array.isArray(tracker.upcomingDeadlines)).toBe(true);
      expect(Array.isArray(tracker.complianceGaps)).toBe(true);
      expect(tracker.riskExposure).toBeOneOf(['low', 'medium', 'high', 'critical']);
    });

    test('should identify upcoming compliance deadlines', async () => {
      const tracker = await auditor.trackRegulatoryRequirements();

      tracker.upcomingDeadlines.forEach(deadline => {
        expect(deadline.framework).toBeOneOf(Object.values(ComplianceFramework));
        expect(deadline.requirement).toBeDefined();
        expect(deadline.deadline).toBeInstanceOf(Date);
        expect(deadline.daysRemaining).toBeGreaterThanOrEqual(0);
        expect(deadline.severity).toBeDefined();
      });
    });

    test('should identify compliance gaps', async () => {
      const tracker = await auditor.trackRegulatoryRequirements();

      tracker.complianceGaps.forEach(gap => {
        expect(gap.framework).toBeOneOf(Object.values(ComplianceFramework));
        expect(gap.gap).toBeDefined();
        expect(gap.impact).toBeDefined();
        expect(gap.recommendedAction).toBeDefined();
      });
    });
  });

  describe('Audit Entry Recording', () => {
    test('should record audit entry successfully', async () => {
      const auditEntry = {
        eventType: AuditEventType.PAYMENT_PROCESSING,
        userId: 'user_123',
        resource: 'payment_transaction',
        action: 'process_payment',
        beforeState: { status: 'pending' },
        afterState: { status: 'completed' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 test',
        timestamp: new Date(),
        success: true,
        complianceRelevant: true,
        retentionPeriod: 2555
      };

      await expect(auditor.recordAuditEntry(auditEntry)).resolves.not.toThrow();
    });

    test('should record different types of audit events', async () => {
      const eventTypes = Object.values(AuditEventType);

      for (const eventType of eventTypes) {
        const auditEntry = {
          eventType,
          userId: 'user_123',
          resource: 'test_resource',
          action: 'test_action',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 test',
          timestamp: new Date(),
          success: true,
          complianceRelevant: true,
          retentionPeriod: 2555
        };

        await expect(auditor.recordAuditEntry(auditEntry)).resolves.not.toThrow();
      }
    });

    test('should handle audit entry errors gracefully', async () => {
      const invalidAuditEntry = {
        eventType: AuditEventType.PAYMENT_PROCESSING,
        userId: '',
        resource: '',
        action: '',
        ipAddress: '',
        userAgent: '',
        timestamp: new Date(),
        success: true,
        complianceRelevant: true,
        retentionPeriod: 0
      };

      // Should not throw error, but might log warning
      await expect(auditor.recordAuditEntry(invalidAuditEntry)).resolves.not.toThrow();
    });
  });

  describe('Performance', () => {
    test('should complete compliance assessment within reasonable time', async () => {
      const startTime = Date.now();
      const assessment = await auditor.performComplianceAssessment(
        ComplianceFramework.PCI_DSS
      );
      const endTime = Date.now();

      expect(assessment).toBeDefined();
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    test('should complete audit trail validation efficiently', async () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-07T23:59:59Z'); // One week

      const startTime = Date.now();
      const validation = await auditor.validateAuditTrail(startDate, endDate);
      const endTime = Date.now();

      expect(validation).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle concurrent assessments', async () => {
      const frameworks = [
        ComplianceFramework.PCI_DSS,
        ComplianceFramework.SOC2_TYPE2,
        ComplianceFramework.GDPR
      ];

      const startTime = Date.now();
      const promises = frameworks.map(framework => 
        auditor.performComplianceAssessment(framework)
      );
      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.overallScore).toBeGreaterThanOrEqual(0);
      });

      expect(endTime - startTime).toBeLessThan(15000); // Should complete within 15 seconds
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty assessment scope', async () => {
      const emptyScope = {
        systems: [],
        dataTypes: [],
        processes: [],
        locations: []
      };

      const assessment = await auditor.performComplianceAssessment(
        ComplianceFramework.PCI_DSS,
        emptyScope
      );

      expect(assessment).toBeDefined();
      expect(assessment.scope).toEqual(emptyScope);
    });

    test('should handle very short audit trail periods', async () => {
      const startDate = new Date('2024-01-01T10:00:00Z');
      const endDate = new Date('2024-01-01T10:01:00Z'); // 1 minute

      const validation = await auditor.validateAuditTrail(startDate, endDate);

      expect(validation).toBeDefined();
      expect(validation.totalEvents).toBeGreaterThanOrEqual(0);
    });

    test('should handle policy compliance with no policies', async () => {
      const complianceReport = await auditor.monitorPolicyCompliance();

      expect(complianceReport).toBeDefined();
      if (complianceReport.totalPolicies === 0) {
        expect(complianceReport.compliantPolicies).toBe(0);
        expect(complianceReport.nonCompliantPolicies).toBe(0);
        expect(complianceReport.overallScore).toBe(0);
      }
    });
  });

  describe('Data Integrity', () => {
    test('should maintain assessment data consistency', async () => {
      const assessment = await auditor.performComplianceAssessment(
        ComplianceFramework.PCI_DSS
      );

      // Requirements count should match findings and recommendations logic
      const compliantRequirements = assessment.requirements.filter(r => 
        r.status === 'compliant'
      ).length;
      const nonCompliantRequirements = assessment.requirements.filter(r => 
        r.status === 'non_compliant'
      ).length;

      expect(compliantRequirements + nonCompliantRequirements)
        .toBeLessThanOrEqual(assessment.requirements.length);

      // Findings should correlate with non-compliant requirements
      if (nonCompliantRequirements > 0) {
        expect(assessment.findings.length).toBeGreaterThan(0);
      }
    });

    test('should generate consistent report data', async () => {
      const assessment = await auditor.performComplianceAssessment(
        ComplianceFramework.PCI_DSS
      );

      const report = await auditor.generateComplianceReport(assessment);

      expect(report.assessmentId).toBe(assessment.id);
      expect(report.framework).toBe(assessment.framework);
    });
  });
});

// Helper function for custom matcher
expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected.join(', ')}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected.join(', ')}`,
        pass: false,
      };
    }
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R;
    }
  }
}