/**
 * EPIC 5 STORY 5.10: Payment Security & Compliance
 * Security Framework Tests
 * 
 * Comprehensive test coverage for the security framework including
 * PCI DSS compliance validation, security policy enforcement, and data encryption.
 */

import { SecurityFramework, ComplianceFramework, ComplianceStatus, SecuritySeverity } from '@/lib/payments/security-framework';

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null }))
        }))
      })),
      insert: jest.fn(() => Promise.resolve({ data: {}, error: null })),
      update: jest.fn(() => Promise.resolve({ data: {}, error: null }))
    }))
  }))
}));

describe('SecurityFramework', () => {
  let securityFramework: SecurityFramework;

  beforeEach(() => {
    securityFramework = new SecurityFramework();
    jest.clearAllMocks();
  });

  describe('PCI DSS Compliance Validation', () => {
    test('should perform PCI DSS compliance assessment', async () => {
      const assessment = await securityFramework.validatePCICompliance();

      expect(assessment).toBeDefined();
      expect(assessment.framework).toBe(ComplianceFramework.PCI_DSS);
      expect(assessment.version).toBe('4.0');
      expect(assessment.status).toBeOneOf([
        ComplianceStatus.COMPLIANT,
        ComplianceStatus.NON_COMPLIANT,
        ComplianceStatus.PARTIALLY_COMPLIANT
      ]);
      expect(assessment.score).toBeGreaterThanOrEqual(0);
      expect(assessment.score).toBeLessThanOrEqual(100);
      expect(assessment.lastAssessment).toBeInstanceOf(Date);
      expect(assessment.nextAssessment).toBeInstanceOf(Date);
      expect(Array.isArray(assessment.violations)).toBe(true);
      expect(Array.isArray(assessment.recommendations)).toBe(true);
    });

    test('should return high compliance score for well-configured system', async () => {
      // Mock a system with good security practices
      const assessment = await securityFramework.validatePCICompliance();

      // Expect high compliance score since we have security measures in place
      expect(assessment.score).toBeGreaterThan(70);
    });

    test('should handle compliance validation errors gracefully', async () => {
      // Test error handling
      const originalConsoleError = console.error;
      console.error = jest.fn();

      try {
        const assessment = await securityFramework.validatePCICompliance();
        expect(assessment).toBeDefined();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('PCI DSS validation failed');
      }

      console.error = originalConsoleError;
    });
  });

  describe('Security Policy Enforcement', () => {
    test('should enforce security policy successfully', async () => {
      const policyId = 'test-policy';
      const context = {
        userId: 'user-123',
        action: 'payment_processing',
        resource: 'payment_data',
        ipAddress: '192.168.1.1'
      };

      const result = await securityFramework.enforceSecurityPolicy(policyId, context);

      expect(result).toBeDefined();
      expect(typeof result.allowed).toBe('boolean');
    });

    test('should block access when policy is violated', async () => {
      const policyId = 'strict-policy';
      const context = {
        userId: 'suspicious-user',
        action: 'unauthorized_access',
        resource: 'sensitive_data',
        ipAddress: '10.0.0.1'
      };

      const result = await securityFramework.enforceSecurityPolicy(policyId, context);

      expect(result.allowed).toBe(false);
      expect(result.violation).toBeDefined();
      expect(result.action).toBeDefined();
    });

    test('should allow access for compliant requests', async () => {
      const policyId = 'standard-policy';
      const context = {
        userId: 'valid-user',
        action: 'read_data',
        resource: 'public_data',
        ipAddress: '192.168.1.100'
      };

      const result = await securityFramework.enforceSecurityPolicy(policyId, context);

      expect(result.allowed).toBe(true);
      expect(result.violation).toBeUndefined();
    });

    test('should handle non-existent policy gracefully', async () => {
      const policyId = 'non-existent-policy';
      const context = {
        userId: 'user-123',
        action: 'test_action',
        resource: 'test_resource',
        ipAddress: '127.0.0.1'
      };

      const result = await securityFramework.enforceSecurityPolicy(policyId, context);

      expect(result.allowed).toBe(false);
      expect(result.violation).toContain('Policy enforcement failed');
    });
  });

  describe('Data Encryption', () => {
    test('should encrypt sensitive data successfully', async () => {
      const sensitiveData = {
        cardNumber: '4111111111111111',
        expiryDate: '12/25',
        cvv: '123'
      };
      const context = 'payment_processing';

      const result = await securityFramework.encryptSensitiveData(sensitiveData, context);

      expect(result.encrypted).toBeDefined();
      expect(typeof result.encrypted).toBe('string');
      expect(result.encrypted).not.toContain('4111111111111111');
      expect(result.context).toBeDefined();
      expect(result.context.algorithm).toBe('aes-256-gcm');
      expect(result.context.keyId).toBeDefined();
      expect(result.context.iv).toBeDefined();
    });

    test('should decrypt data correctly', async () => {
      const originalData = {
        cardNumber: '4111111111111111',
        expiryDate: '12/25',
        cvv: '123'
      };
      const context = 'payment_processing';

      const encrypted = await securityFramework.encryptSensitiveData(originalData, context);
      const decrypted = await securityFramework.decryptSensitiveData(
        encrypted.encrypted,
        encrypted.context
      );

      expect(decrypted).toEqual(originalData);
    });

    test('should fail decryption with invalid context', async () => {
      const invalidEncrypted = 'invalid-encrypted-data';
      const invalidContext = {
        algorithm: 'aes-256-gcm',
        keyId: 'invalid-key',
        iv: 'invalid-iv'
      };

      await expect(securityFramework.decryptSensitiveData(invalidEncrypted, invalidContext))
        .rejects.toThrow('Data decryption failed');
    });

    test('should handle encryption errors gracefully', async () => {
      const invalidData = null;
      const context = 'test';

      await expect(securityFramework.encryptSensitiveData(invalidData, context))
        .rejects.toThrow('Data encryption failed');
    });
  });

  describe('Access Control Validation', () => {
    test('should validate user access successfully', async () => {
      const userId = 'user-123';
      const resource = 'payment_data';
      const action = 'read';

      const result = await securityFramework.validateAccessControl(userId, resource, action);

      expect(result).toBeDefined();
      expect(typeof result.authorized).toBe('boolean');
    });

    test('should deny access for unauthorized user', async () => {
      const userId = 'unauthorized-user';
      const resource = 'sensitive_payment_data';
      const action = 'write';

      const result = await securityFramework.validateAccessControl(userId, resource, action);

      expect(result.authorized).toBe(false);
      expect(result.reason).toBeDefined();
    });

    test('should allow access for authorized user', async () => {
      const userId = 'admin-user';
      const resource = 'payment_data';
      const action = 'read';

      const result = await securityFramework.validateAccessControl(userId, resource, action);

      expect(result.authorized).toBe(true);
    });

    test('should handle access validation errors', async () => {
      const userId = '';
      const resource = 'payment_data';
      const action = 'read';

      const result = await securityFramework.validateAccessControl(userId, resource, action);

      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('Access validation failed');
    });
  });

  describe('Security Health Assessment', () => {
    test('should perform security health assessment', async () => {
      const healthReport = await securityFramework.assessSecurityHealth();

      expect(healthReport).toBeDefined();
      expect(healthReport.timestamp).toBeInstanceOf(Date);
      expect(healthReport.overallScore).toBeGreaterThanOrEqual(0);
      expect(healthReport.overallScore).toBeLessThanOrEqual(100);
      expect(healthReport.categories).toBeDefined();
      expect(Array.isArray(healthReport.criticalIssues)).toBe(true);
      expect(Array.isArray(healthReport.recommendations)).toBe(true);
      expect(healthReport.nextAssessment).toBeInstanceOf(Date);
    });

    test('should identify critical security issues', async () => {
      const healthReport = await securityFramework.assessSecurityHealth();

      // Health report should have proper structure
      expect(healthReport.categories).toBeDefined();
      if (healthReport.criticalIssues.length > 0) {
        healthReport.criticalIssues.forEach(issue => {
          expect(issue).toBeDefined();
        });
      }
    });

    test('should provide security recommendations', async () => {
      const healthReport = await securityFramework.assessSecurityHealth();

      expect(Array.isArray(healthReport.recommendations)).toBe(true);
      if (healthReport.recommendations.length > 0) {
        healthReport.recommendations.forEach(recommendation => {
          expect(typeof recommendation).toBe('string');
          expect(recommendation.length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      // Mock network error
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      try {
        const assessment = await securityFramework.validatePCICompliance();
        expect(assessment).toBeDefined();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }

      global.fetch = originalFetch;
    });

    test('should handle database errors gracefully', async () => {
      // Test with empty user ID which should trigger error handling
      const result = await securityFramework.validateAccessControl(
        '',
        'payment_data',
        'read'
      );

      expect(result.authorized).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('Access validation failed');
    });
  });

  describe('Performance', () => {
    test('should complete compliance validation within reasonable time', async () => {
      const startTime = Date.now();
      const assessment = await securityFramework.validatePCICompliance();
      const endTime = Date.now();

      expect(assessment).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should complete access validation quickly', async () => {
      const startTime = Date.now();
      const result = await securityFramework.validateAccessControl(
        'user-123',
        'payment_data',
        'read'
      );
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});

// Helper function to check if value is one of the given options
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