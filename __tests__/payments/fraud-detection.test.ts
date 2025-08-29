/**
 * EPIC 5 STORY 5.10: Payment Security & Compliance
 * Fraud Detection Engine Tests
 * 
 * Comprehensive test coverage for fraud detection including transaction analysis,
 * device fingerprinting, velocity checking, and ML-based risk scoring.
 */

import fraudDetection, { 
  FraudDetectionEngine, 
  TransactionContext, 
  RiskLevel, 
  FraudDecision,
  RiskFactorType 
} from '@/lib/payments/fraud-detection';

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null })),
          gte: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: [] }))
          }))
        }))
      })),
      insert: jest.fn(() => Promise.resolve({ data: {}, error: null })),
      update: jest.fn(() => Promise.resolve({ data: {}, error: null }))
    }))
  }))
}));

describe('FraudDetectionEngine', () => {
  let fraudEngine: FraudDetectionEngine;

  beforeEach(() => {
    fraudEngine = new FraudDetectionEngine();
    jest.clearAllMocks();
  });

  describe('Transaction Analysis', () => {
    test('should analyze transaction and return risk score', async () => {
      const transactionContext: TransactionContext = {
        transactionId: 'txn_test_001',
        userId: 'user_123',
        customerId: 'cust_456',
        amount: 10000, // $100.00
        currency: 'USD',
        paymentMethodId: 'pm_test_001',
        timestamp: new Date(),
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        deviceFingerprint: 'fp_test_001',
        billingAddress: {
          line1: '123 Test St',
          city: 'Test City',
          state: 'TS',
          postal_code: '12345',
          country: 'US'
        }
      };

      const riskScore = await fraudEngine.analyzeTransaction(transactionContext);

      expect(riskScore).toBeDefined();
      expect(riskScore.transactionId).toBe(transactionContext.transactionId);
      expect(riskScore.overallScore).toBeGreaterThanOrEqual(0);
      expect(riskScore.overallScore).toBeLessThanOrEqual(100);
      expect(riskScore.riskLevel).toBeOneOf(Object.values(RiskLevel));
      expect(riskScore.decision).toBeOneOf(Object.values(FraudDecision));
      expect(riskScore.confidence).toBeGreaterThanOrEqual(0);
      expect(riskScore.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(riskScore.factors)).toBe(true);
      expect(Array.isArray(riskScore.recommendations)).toBe(true);
    });

    test('should assign higher risk to large amounts', async () => {
      const highAmountContext: TransactionContext = {
        transactionId: 'txn_high_001',
        userId: 'user_123',
        amount: 500000, // $5,000.00
        currency: 'USD',
        paymentMethodId: 'pm_test_001',
        timestamp: new Date(),
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };

      const lowAmountContext: TransactionContext = {
        transactionId: 'txn_low_001',
        userId: 'user_123',
        amount: 2000, // $20.00
        currency: 'USD',
        paymentMethodId: 'pm_test_001',
        timestamp: new Date(),
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };

      const highRisk = await fraudEngine.analyzeTransaction(highAmountContext);
      const lowRisk = await fraudEngine.analyzeTransaction(lowAmountContext);

      // High amount transaction should have higher risk
      const highAmountRisk = highRisk.factors.find(f => f.type === RiskFactorType.AMOUNT);
      const lowAmountRisk = lowRisk.factors.find(f => f.type === RiskFactorType.AMOUNT);

      if (highAmountRisk && lowAmountRisk) {
        expect(highAmountRisk.score).toBeGreaterThan(lowAmountRisk.score);
      }
    });

    test('should handle transaction analysis errors gracefully', async () => {
      const invalidContext = {
        transactionId: '',
        userId: '',
        amount: -100, // Invalid amount
        currency: 'INVALID',
        paymentMethodId: '',
        timestamp: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'test'
      } as TransactionContext;

      const riskScore = await fraudEngine.analyzeTransaction(invalidContext);

      expect(riskScore).toBeDefined();
      expect(riskScore.decision).toBe(FraudDecision.REVIEW);
      expect(riskScore.confidence).toBeLessThan(0.5);
    });

    test('should provide meaningful risk factors', async () => {
      const transactionContext: TransactionContext = {
        transactionId: 'txn_test_002',
        userId: 'user_456',
        amount: 25000, // $250.00
        currency: 'USD',
        paymentMethodId: 'pm_test_002',
        timestamp: new Date(),
        ipAddress: '10.0.0.1',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      };

      const riskScore = await fraudEngine.analyzeTransaction(transactionContext);

      expect(riskScore.factors.length).toBeGreaterThan(0);
      riskScore.factors.forEach(factor => {
        expect(factor.type).toBeOneOf(Object.values(RiskFactorType));
        expect(factor.score).toBeGreaterThanOrEqual(0);
        expect(factor.score).toBeLessThanOrEqual(100);
        expect(factor.weight).toBeGreaterThanOrEqual(0);
        expect(factor.weight).toBeLessThanOrEqual(1);
        expect(factor.description).toBeDefined();
        expect(typeof factor.description).toBe('string');
      });
    });
  });

  describe('Device Fingerprinting', () => {
    test('should generate device fingerprint', async () => {
      const deviceData = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        language: 'en-US',
        timezone: 'America/New_York',
        platform: 'Win32',
        screenWidth: 1920,
        screenHeight: 1080,
        colorDepth: 24,
        pixelRatio: 1,
        cookiesEnabled: true,
        doNotTrack: false
      };

      const fingerprint = await fraudEngine.generateDeviceFingerprint(deviceData);

      expect(fingerprint).toBeDefined();
      expect(fingerprint.id).toBeDefined();
      expect(typeof fingerprint.id).toBe('string');
      expect(fingerprint.trustScore).toBeGreaterThanOrEqual(0);
      expect(fingerprint.trustScore).toBeLessThanOrEqual(1);
      expect(fingerprint.browserInfo).toBeDefined();
      expect(fingerprint.screenInfo).toBeDefined();
      expect(fingerprint.firstSeen).toBeInstanceOf(Date);
      expect(fingerprint.lastSeen).toBeInstanceOf(Date);
      expect(Array.isArray(fingerprint.riskIndicators)).toBe(true);
    });

    test('should assign consistent fingerprint ID for same device', async () => {
      const deviceData = {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)',
        language: 'en-US',
        timezone: 'America/Los_Angeles',
        platform: 'iPhone',
        screenWidth: 375,
        screenHeight: 812,
        colorDepth: 24,
        pixelRatio: 3
      };

      const fingerprint1 = await fraudEngine.generateDeviceFingerprint(deviceData);
      const fingerprint2 = await fraudEngine.generateDeviceFingerprint(deviceData);

      expect(fingerprint1.id).toBe(fingerprint2.id);
    });

    test('should assign different fingerprint IDs for different devices', async () => {
      const device1Data = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        platform: 'Win32',
        screenWidth: 1920,
        screenHeight: 1080
      };

      const device2Data = {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        platform: 'MacIntel',
        screenWidth: 1440,
        screenHeight: 900
      };

      const fingerprint1 = await fraudEngine.generateDeviceFingerprint(device1Data);
      const fingerprint2 = await fraudEngine.generateDeviceFingerprint(device2Data);

      expect(fingerprint1.id).not.toBe(fingerprint2.id);
    });

    test('should handle invalid device data', async () => {
      const invalidDeviceData = {};

      const fingerprint = await fraudEngine.generateDeviceFingerprint(invalidDeviceData);

      expect(fingerprint).toBeDefined();
      expect(fingerprint.trustScore).toBeLessThan(0.8); // Should have lower trust for incomplete data
    });
  });

  describe('Velocity Checking', () => {
    test('should check velocity limits', async () => {
      const userId = 'user_velocity_test';
      const customerId = 'cust_velocity_test';
      const paymentMethodId = 'pm_velocity_test';

      const velocityChecks = await fraudEngine.checkVelocity(userId, customerId, paymentMethodId);

      expect(Array.isArray(velocityChecks)).toBe(true);
      expect(velocityChecks.length).toBeGreaterThan(0);

      velocityChecks.forEach(check => {
        expect(check.userId).toBe(userId);
        expect(check.customerId).toBe(customerId);
        expect(check.paymentMethodId).toBe(paymentMethodId);
        expect(check.timeWindow).toMatch(/^\d+[hmwd]$/);
        expect(check.transactionCount).toBeGreaterThanOrEqual(0);
        expect(check.totalAmount).toBeGreaterThanOrEqual(0);
        expect(check.uniqueDevices).toBeGreaterThanOrEqual(0);
        expect(check.uniqueLocations).toBeGreaterThanOrEqual(0);
        expect(check.riskScore).toBeGreaterThanOrEqual(0);
        expect(check.riskScore).toBeLessThanOrEqual(100);
        expect(typeof check.exceeded).toBe('boolean');
        expect(check.thresholds).toBeDefined();
      });
    });

    test('should detect velocity violations', async () => {
      const userId = 'high_velocity_user';
      const customerId = 'high_velocity_customer';
      const paymentMethodId = 'high_velocity_pm';

      const velocityChecks = await fraudEngine.checkVelocity(userId, customerId, paymentMethodId);

      // At least one check should be performed
      expect(velocityChecks.length).toBeGreaterThan(0);

      // Check that velocity calculations are reasonable
      velocityChecks.forEach(check => {
        expect(check.riskScore).toBeGreaterThanOrEqual(0);
        if (check.exceeded) {
          expect(check.riskScore).toBeGreaterThan(50);
        }
      });
    });

    test('should handle velocity check errors', async () => {
      const invalidUserId = '';
      const invalidCustomerId = '';
      const invalidPaymentMethodId = '';

      await expect(fraudEngine.checkVelocity(invalidUserId, invalidCustomerId, invalidPaymentMethodId))
        .rejects.toThrow('Velocity check failed');
    });
  });

  describe('ML Model Operations', () => {
    test('should update fraud model with training data', async () => {
      const trainingData = [
        {
          transactionId: 'txn_train_001',
          features: [
            { type: RiskFactorType.AMOUNT, score: 80, weight: 0.3 },
            { type: RiskFactorType.VELOCITY, score: 90, weight: 0.25 }
          ],
          actualOutcome: 'fraud' as const,
          confidence: 0.95
        },
        {
          transactionId: 'txn_train_002',
          features: [
            { type: RiskFactorType.AMOUNT, score: 20, weight: 0.3 },
            { type: RiskFactorType.DEVICE, score: 15, weight: 0.2 }
          ],
          actualOutcome: 'legitimate' as const,
          confidence: 0.88
        }
      ];

      await expect(fraudEngine.updateFraudModel(trainingData)).resolves.not.toThrow();
    });

    test('should handle model update errors', async () => {
      const invalidTrainingData: any[] = [
        {
          transactionId: '',
          features: [],
          actualOutcome: 'invalid_outcome',
          confidence: 2.0 // Invalid confidence > 1
        }
      ];

      await expect(fraudEngine.updateFraudModel(invalidTrainingData))
        .rejects.toThrow('Model update failed');
    });
  });

  describe('Risk Scoring Algorithm', () => {
    test('should produce consistent risk scores for identical transactions', async () => {
      const transactionContext: TransactionContext = {
        transactionId: 'txn_consistent_001',
        userId: 'user_consistent',
        amount: 15000,
        currency: 'USD',
        paymentMethodId: 'pm_consistent',
        timestamp: new Date(),
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (consistent test)'
      };

      const score1 = await fraudEngine.analyzeTransaction(transactionContext);
      const score2 = await fraudEngine.analyzeTransaction({
        ...transactionContext,
        transactionId: 'txn_consistent_002'
      });

      // Scores should be very similar (allowing for small variations due to timing)
      expect(Math.abs(score1.overallScore - score2.overallScore)).toBeLessThan(5);
    });

    test('should assign appropriate confidence levels', async () => {
      const transactionContext: TransactionContext = {
        transactionId: 'txn_confidence_001',
        userId: 'user_confidence',
        amount: 50000,
        currency: 'USD',
        paymentMethodId: 'pm_confidence',
        timestamp: new Date(),
        ipAddress: '192.168.1.200',
        userAgent: 'Mozilla/5.0 (confidence test)'
      };

      const riskScore = await fraudEngine.analyzeTransaction(transactionContext);

      expect(riskScore.confidence).toBeGreaterThan(0.1);
      expect(riskScore.confidence).toBeLessThanOrEqual(1.0);

      // Higher risk scores should generally have higher confidence when multiple factors agree
      if (riskScore.overallScore > 70 && riskScore.factors.length > 3) {
        expect(riskScore.confidence).toBeGreaterThan(0.5);
      }
    });
  });

  describe('Performance', () => {
    test('should analyze transaction within reasonable time', async () => {
      const transactionContext: TransactionContext = {
        transactionId: 'txn_perf_001',
        userId: 'user_perf',
        amount: 25000,
        currency: 'USD',
        paymentMethodId: 'pm_perf',
        timestamp: new Date(),
        ipAddress: '192.168.1.50',
        userAgent: 'Mozilla/5.0 (performance test)'
      };

      const startTime = Date.now();
      const riskScore = await fraudEngine.analyzeTransaction(transactionContext);
      const endTime = Date.now();

      expect(riskScore).toBeDefined();
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    test('should handle multiple concurrent analyses', async () => {
      const contexts = Array.from({ length: 5 }, (_, i) => ({
        transactionId: `txn_concurrent_${i}`,
        userId: `user_concurrent_${i}`,
        amount: 10000 + i * 5000,
        currency: 'USD',
        paymentMethodId: `pm_concurrent_${i}`,
        timestamp: new Date(),
        ipAddress: `192.168.1.${10 + i}`,
        userAgent: 'Mozilla/5.0 (concurrent test)'
      }));

      const startTime = Date.now();
      const promises = contexts.map(context => fraudEngine.analyzeTransaction(context));
      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.overallScore).toBeGreaterThanOrEqual(0);
        expect(result.overallScore).toBeLessThanOrEqual(100);
      });

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Edge Cases', () => {
    test('should handle unusual transaction times', async () => {
      const nightTransaction: TransactionContext = {
        transactionId: 'txn_night_001',
        userId: 'user_night',
        amount: 10000,
        currency: 'USD',
        paymentMethodId: 'pm_night',
        timestamp: new Date('2024-01-01T03:30:00Z'), // 3:30 AM
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (night test)'
      };

      const dayTransaction: TransactionContext = {
        transactionId: 'txn_day_001',
        userId: 'user_day',
        amount: 10000,
        currency: 'USD',
        paymentMethodId: 'pm_day',
        timestamp: new Date('2024-01-01T14:30:00Z'), // 2:30 PM
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (day test)'
      };

      const nightScore = await fraudEngine.analyzeTransaction(nightTransaction);
      const dayScore = await fraudEngine.analyzeTransaction(dayTransaction);

      expect(nightScore).toBeDefined();
      expect(dayScore).toBeDefined();

      // Night transaction might have slightly higher risk due to unusual timing
      const nightTimeRisk = nightScore.factors.find(f => f.type === RiskFactorType.TIME_PATTERN);
      const dayTimeRisk = dayScore.factors.find(f => f.type === RiskFactorType.TIME_PATTERN);

      if (nightTimeRisk && dayTimeRisk) {
        expect(nightTimeRisk.score).toBeGreaterThanOrEqual(dayTimeRisk.score);
      }
    });

    test('should handle missing optional fields', async () => {
      const minimalContext: TransactionContext = {
        transactionId: 'txn_minimal_001',
        userId: 'user_minimal',
        amount: 5000,
        currency: 'USD',
        paymentMethodId: 'pm_minimal',
        timestamp: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'minimal test'
      };

      const riskScore = await fraudEngine.analyzeTransaction(minimalContext);

      expect(riskScore).toBeDefined();
      expect(riskScore.overallScore).toBeGreaterThanOrEqual(0);
      expect(riskScore.overallScore).toBeLessThanOrEqual(100);
      expect(riskScore.factors.length).toBeGreaterThan(0);
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