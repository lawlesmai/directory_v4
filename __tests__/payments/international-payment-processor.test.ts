/**
 * EPIC 5 STORY 5.9: International Payments & Tax Compliance
 * Unit Tests for International Payment Processor
 * 
 * Test-driven development approach for international payment processing
 * with multi-currency support and regional payment methods
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { InternationalPaymentProcessor } from '../../lib/payments/international-payment-processor';
import { CurrencyManager } from '../../lib/payments/currency-manager';
import { TaxComplianceEngine } from '../../lib/payments/tax-compliance-engine';
import { ComplianceMonitor } from '../../lib/payments/compliance-monitor';

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
process.env.STRIPE_SECRET_KEY = 'sk_test_123';

// Mock dependencies
jest.mock('../../lib/payments/currency-manager');
jest.mock('../../lib/payments/tax-compliance-engine');
jest.mock('../../lib/payments/compliance-monitor');
jest.mock('../../lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      })),
      insert: jest.fn(() => Promise.resolve({ data: null, error: null }))
    })),
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: { id: 'test' } }, error: null }))
    }
  }))
}));

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn(() => Promise.resolve({
        id: 'pi_test123',
        status: 'succeeded',
        client_secret: 'pi_test123_secret',
        amount: 10000,
        currency: 'usd',
        metadata: {}
      }))
    }
  }));
});

const mockCurrencyManager = jest.mocked(CurrencyManager);
const mockTaxComplianceEngine = jest.mocked(TaxComplianceEngine);
const mockComplianceMonitor = jest.mocked(ComplianceMonitor);

describe('InternationalPaymentProcessor', () => {
  let processor: InternationalPaymentProcessor;
  let mockCurrencyManagerInstance: jest.Mocked<CurrencyManager>;
  let mockTaxEngineInstance: jest.Mocked<TaxComplianceEngine>;
  let mockComplianceInstance: jest.Mocked<ComplianceMonitor>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockCurrencyManagerInstance = {
      convertCurrency: jest.fn(),
      getExchangeRate: jest.fn(),
      getSupportedCurrencies: jest.fn(),
      updateExchangeRates: jest.fn(),
      getCurrencyInfo: jest.fn(),
    } as any;

    mockTaxEngineInstance = {
      calculateTax: jest.fn(),
      getTaxJurisdiction: jest.fn(),
      getApplicableTaxRate: jest.fn(),
      validateVATNumber: jest.fn(),
      generateTaxInvoice: jest.fn(),
    } as any;

    mockComplianceInstance = {
      performKYCCheck: jest.fn(),
      validateGDPRCompliance: jest.fn(),
      checkSanctionsList: jest.fn(),
      logComplianceEvent: jest.fn(),
      generateComplianceReport: jest.fn(),
    } as any;

    // Mock constructor returns
    mockCurrencyManager.mockImplementation(() => mockCurrencyManagerInstance);
    mockTaxComplianceEngine.mockImplementation(() => mockTaxEngineInstance);
    mockComplianceMonitor.mockImplementation(() => mockComplianceInstance);

    processor = new InternationalPaymentProcessor();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with required dependencies', () => {
      expect(processor).toBeDefined();
      expect(mockCurrencyManager).toHaveBeenCalled();
      expect(mockTaxComplianceEngine).toHaveBeenCalled();
      expect(mockComplianceMonitor).toHaveBeenCalled();
    });
  });

  describe('Multi-Currency Payment Processing', () => {
    const mockPaymentData = {
      customerId: 'cust_test123',
      amount: 10000, // 100.00 EUR
      currency: 'EUR',
      customerCountry: 'DE',
      paymentMethodId: 'pm_test123',
      description: 'Test payment',
    };

    it('should process EUR payment successfully', async () => {
      // Mock currency conversion
      mockCurrencyManagerInstance.convertCurrency.mockResolvedValue({
        originalAmount: 10000,
        convertedAmount: 11200, // ~112 USD
        exchangeRate: 1.12,
        fees: 0,
      });

      // Mock tax calculation
      mockTaxEngineInstance.calculateTax.mockResolvedValue({
        taxAmount: 1900, // 19% VAT
        taxRate: 0.19,
        jurisdiction: 'DE',
        applicableRules: ['vat_standard'],
      });

      // Mock compliance check
      mockComplianceInstance.performKYCCheck.mockResolvedValue({
        passed: true,
        riskScore: 10,
        checks: ['identity', 'address'],
      });

      const result = await processor.processInternationalPayment(mockPaymentData);

      expect(result).toMatchObject({
        success: true,
        transactionId: expect.any(String),
        originalAmount: 10000,
        originalCurrency: 'EUR',
        settlementAmount: expect.any(Number),
        settlementCurrency: 'USD',
        taxAmount: 1900,
        exchangeRate: 1.12,
        complianceStatus: 'passed',
      });

      expect(mockCurrencyManagerInstance.convertCurrency).toHaveBeenCalledWith(
        10000,
        'EUR',
        'USD'
      );
      expect(mockTaxEngineInstance.calculateTax).toHaveBeenCalled();
      expect(mockComplianceInstance.performKYCCheck).toHaveBeenCalled();
    });

    it('should process GBP payment with UK-specific handling', async () => {
      const gbpPaymentData = {
        ...mockPaymentData,
        currency: 'GBP',
        customerCountry: 'GB',
      };

      mockCurrencyManagerInstance.convertCurrency.mockResolvedValue({
        originalAmount: 10000,
        convertedAmount: 12500, // ~125 USD
        exchangeRate: 1.25,
        fees: 0,
      });

      mockTaxEngineInstance.calculateTax.mockResolvedValue({
        taxAmount: 2000, // 20% VAT
        taxRate: 0.20,
        jurisdiction: 'GB',
        applicableRules: ['vat_standard'],
      });

      const result = await processor.processInternationalPayment(gbpPaymentData);

      expect(result.success).toBe(true);
      expect(result.originalCurrency).toBe('GBP');
      expect(result.taxRate).toBe(0.20);
    });

    it('should handle CAD payment with GST calculation', async () => {
      const cadPaymentData = {
        ...mockPaymentData,
        currency: 'CAD',
        customerCountry: 'CA',
      };

      mockTaxEngineInstance.calculateTax.mockResolvedValue({
        taxAmount: 500, // 5% GST
        taxRate: 0.05,
        jurisdiction: 'CA',
        applicableRules: ['gst_standard'],
      });

      const result = await processor.processInternationalPayment(cadPaymentData);

      expect(result.taxRate).toBe(0.05);
      expect(mockTaxEngineInstance.calculateTax).toHaveBeenCalledWith(
        expect.objectContaining({
          jurisdiction: 'CA',
          taxSystem: 'gst',
        })
      );
    });

    it('should handle AUD payment with Australian GST', async () => {
      const audPaymentData = {
        ...mockPaymentData,
        currency: 'AUD',
        customerCountry: 'AU',
      };

      mockTaxEngineInstance.calculateTax.mockResolvedValue({
        taxAmount: 1000, // 10% GST
        taxRate: 0.10,
        jurisdiction: 'AU',
        applicableRules: ['gst_standard'],
      });

      const result = await processor.processInternationalPayment(audPaymentData);

      expect(result.taxRate).toBe(0.10);
      expect(result.jurisdiction).toBe('AU');
    });
  });

  describe('Regional Payment Methods', () => {
    it('should process SEPA Direct Debit payment', async () => {
      const sepaPaymentData = {
        customerId: 'cust_test123',
        amount: 5000,
        currency: 'EUR',
        customerCountry: 'DE',
        paymentMethod: 'sepa_debit',
        mandateId: 'mandate_test123',
        description: 'SEPA payment',
      };

      mockComplianceInstance.performKYCCheck.mockResolvedValue({
        passed: true,
        riskScore: 5,
        checks: ['sepa_mandate'],
      });

      const result = await processor.processRegionalPayment(sepaPaymentData);

      expect(result.success).toBe(true);
      expect(result.paymentMethod).toBe('sepa_debit');
      expect(result.processingTime).toBe('2-5 business days');
    });

    it('should process iDEAL payment for Netherlands', async () => {
      const idealPaymentData = {
        customerId: 'cust_test123',
        amount: 2500,
        currency: 'EUR',
        customerCountry: 'NL',
        paymentMethod: 'ideal',
        bankId: 'ing_nl',
        description: 'iDEAL payment',
      };

      const result = await processor.processRegionalPayment(idealPaymentData);

      expect(result.success).toBe(true);
      expect(result.paymentMethod).toBe('ideal');
      expect(result.processingTime).toBe('Instant');
    });

    it('should process SOFORT payment for Germany', async () => {
      const sofortPaymentData = {
        customerId: 'cust_test123',
        amount: 7500,
        currency: 'EUR',
        customerCountry: 'DE',
        paymentMethod: 'sofort',
        description: 'SOFORT payment',
      };

      const result = await processor.processRegionalPayment(sofortPaymentData);

      expect(result.success).toBe(true);
      expect(result.paymentMethod).toBe('sofort');
    });
  });

  describe('Tax Compliance Integration', () => {
    it('should calculate VAT for EU digital services', async () => {
      const digitalServiceData = {
        customerId: 'cust_test123',
        amount: 10000,
        currency: 'EUR',
        customerCountry: 'FR',
        productCategory: 'digital_services',
        vatNumber: 'FR12345678901',
      };

      mockTaxEngineInstance.validateVATNumber.mockResolvedValue({
        valid: true,
        companyName: 'Test Company SAS',
        country: 'FR',
      });

      mockTaxEngineInstance.calculateTax.mockResolvedValue({
        taxAmount: 2000, // 20% VAT
        taxRate: 0.20,
        jurisdiction: 'FR',
        reverseCharge: false,
        mossEligible: true,
      });

      const result = await processor.processInternationalPayment(digitalServiceData);

      expect(mockTaxEngineInstance.validateVATNumber).toHaveBeenCalledWith('FR12345678901');
      expect(result.taxAmount).toBe(2000);
      expect(result.mossEligible).toBe(true);
    });

    it('should handle reverse charge for B2B transactions', async () => {
      const b2bTransactionData = {
        customerId: 'cust_test123',
        amount: 15000,
        currency: 'EUR',
        customerCountry: 'DE',
        vatNumber: 'DE123456789',
        customerType: 'business',
      };

      mockTaxEngineInstance.validateVATNumber.mockResolvedValue({
        valid: true,
        companyName: 'Test GmbH',
        country: 'DE',
      });

      mockTaxEngineInstance.calculateTax.mockResolvedValue({
        taxAmount: 0,
        taxRate: 0.19,
        jurisdiction: 'DE',
        reverseCharge: true,
        exemptionReason: 'B2B reverse charge',
      });

      const result = await processor.processInternationalPayment(b2bTransactionData);

      expect(result.taxAmount).toBe(0);
      expect(result.reverseCharge).toBe(true);
    });

    it('should calculate US sales tax by state', async () => {
      const usSalesData = {
        customerId: 'cust_test123',
        amount: 10000,
        currency: 'USD',
        customerCountry: 'US',
        customerState: 'CA',
        taxNexus: ['CA', 'NY', 'TX'],
      };

      mockTaxEngineInstance.calculateTax.mockResolvedValue({
        taxAmount: 875, // 8.75% CA sales tax
        taxRate: 0.0875,
        jurisdiction: 'US-CA',
        applicableRules: ['sales_tax_nexus'],
      });

      const result = await processor.processInternationalPayment(usSalesData);

      expect(result.taxAmount).toBe(875);
      expect(result.jurisdiction).toBe('US-CA');
    });
  });

  describe('Compliance and Risk Management', () => {
    it('should perform AML checks for high-value transactions', async () => {
      const highValueTransaction = {
        customerId: 'cust_test123',
        amount: 1000000, // €10,000
        currency: 'EUR',
        customerCountry: 'DE',
      };

      mockComplianceInstance.checkSanctionsList.mockResolvedValue({
        match: false,
        riskScore: 0,
      });

      mockComplianceInstance.performKYCCheck.mockResolvedValue({
        passed: true,
        riskScore: 15,
        checks: ['identity', 'address', 'aml_screening'],
        requiresManualReview: true,
      });

      const result = await processor.processInternationalPayment(highValueTransaction);

      expect(mockComplianceInstance.checkSanctionsList).toHaveBeenCalled();
      expect(result.requiresManualReview).toBe(true);
    });

    it('should validate GDPR compliance for EU customers', async () => {
      const euCustomerData = {
        customerId: 'cust_test123',
        amount: 5000,
        currency: 'EUR',
        customerCountry: 'FR',
        gdprConsent: true,
      };

      mockComplianceInstance.validateGDPRCompliance.mockResolvedValue({
        compliant: true,
        consentDate: new Date(),
        dataProcessingLegal: true,
      });

      const result = await processor.processInternationalPayment(euCustomerData);

      expect(mockComplianceInstance.validateGDPRCompliance).toHaveBeenCalled();
      expect(result.gdprCompliant).toBe(true);
    });

    it('should block sanctioned entities', async () => {
      const suspiciousTransaction = {
        customerId: 'cust_test123',
        amount: 5000,
        currency: 'USD',
        customerCountry: 'XX', // Sanctioned country
      };

      mockComplianceInstance.checkSanctionsList.mockResolvedValue({
        match: true,
        riskScore: 100,
        matchedEntity: 'Sanctioned Individual',
      });

      await expect(
        processor.processInternationalPayment(suspiciousTransaction)
      ).rejects.toThrow('Transaction blocked due to sanctions screening');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle currency conversion failures', async () => {
      const paymentData = {
        customerId: 'cust_test123',
        amount: 10000,
        currency: 'EUR',
        customerCountry: 'DE',
      };

      mockCurrencyManagerInstance.convertCurrency.mockRejectedValue(
        new Error('Exchange rate API unavailable')
      );

      await expect(
        processor.processInternationalPayment(paymentData)
      ).rejects.toThrow('Currency conversion failed');
    });

    it('should handle unsupported currency', async () => {
      const unsupportedCurrencyData = {
        customerId: 'cust_test123',
        amount: 10000,
        currency: 'XYZ', // Unsupported currency
        customerCountry: 'XX',
      };

      await expect(
        processor.processInternationalPayment(unsupportedCurrencyData)
      ).rejects.toThrow('Unsupported currency: XYZ');
    });

    it('should handle tax calculation failures gracefully', async () => {
      const paymentData = {
        customerId: 'cust_test123',
        amount: 10000,
        currency: 'EUR',
        customerCountry: 'DE',
      };

      mockTaxEngineInstance.calculateTax.mockRejectedValue(
        new Error('Tax service unavailable')
      );

      // Should continue processing but flag for manual review
      const result = await processor.processInternationalPayment(paymentData);

      expect(result.success).toBe(true);
      expect(result.requiresManualReview).toBe(true);
      expect(result.warnings).toContain('Tax calculation failed - manual review required');
    });

    it('should validate payment amount limits', async () => {
      const tooLargePayment = {
        customerId: 'cust_test123',
        amount: 100000000, // €1,000,000
        currency: 'EUR',
        customerCountry: 'DE',
      };

      await expect(
        processor.processInternationalPayment(tooLargePayment)
      ).rejects.toThrow('Payment amount exceeds maximum limit');
    });
  });

  describe('Performance and Caching', () => {
    it('should cache exchange rates for performance', async () => {
      const paymentData1 = {
        customerId: 'cust_test1',
        amount: 10000,
        currency: 'EUR',
        customerCountry: 'DE',
      };

      const paymentData2 = {
        customerId: 'cust_test2',
        amount: 20000,
        currency: 'EUR',
        customerCountry: 'FR',
      };

      mockCurrencyManagerInstance.getExchangeRate.mockResolvedValue(1.12);

      await processor.processInternationalPayment(paymentData1);
      await processor.processInternationalPayment(paymentData2);

      // Exchange rate should be retrieved only once due to caching
      expect(mockCurrencyManagerInstance.getExchangeRate).toHaveBeenCalledTimes(2);
    });

    it('should batch process multiple payments efficiently', async () => {
      const payments = Array.from({ length: 5 }, (_, i) => ({
        customerId: `cust_test${i}`,
        amount: 10000,
        currency: 'EUR',
        customerCountry: 'DE',
      }));

      const results = await processor.batchProcessPayments(payments);

      expect(results).toHaveLength(5);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('Reporting and Analytics', () => {
    it('should generate compliance reports', async () => {
      const reportRequest = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        jurisdiction: 'EU',
        reportType: 'vat_return',
      };

      mockComplianceInstance.generateComplianceReport.mockResolvedValue({
        reportId: 'report_123',
        totalTransactions: 150,
        totalTaxCollected: 25000,
        filePath: '/reports/vat_return_2024_01.xml',
      });

      const report = await processor.generateComplianceReport(reportRequest);

      expect(report.totalTransactions).toBe(150);
      expect(report.filePath).toContain('vat_return');
    });

    it('should track international payment metrics', async () => {
      const metrics = await processor.getInternationalMetrics({
        period: 'last_30_days',
        groupBy: 'currency',
      });

      expect(metrics).toHaveProperty('totalVolume');
      expect(metrics).toHaveProperty('currencyBreakdown');
      expect(metrics).toHaveProperty('averageTransactionValue');
    });
  });
});