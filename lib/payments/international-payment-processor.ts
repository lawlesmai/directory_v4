/**
 * EPIC 5 STORY 5.9: International Payments & Tax Compliance
 * International Payment Processor - Multi-Currency & Regional Payment Methods
 * 
 * Comprehensive international payment processing with support for:
 * - Multi-currency transactions (USD, EUR, GBP, CAD, AUD)
 * - Regional payment methods (SEPA, iDEAL, SOFORT, etc.)
 * - Tax compliance (VAT, GST, sales tax)
 * - Regulatory compliance (GDPR, PCI DSS)
 */

import { createClient } from '@/lib/supabase/server';
import { CurrencyManager } from './currency-manager';
import { TaxComplianceEngine } from './tax-compliance-engine';
import { ComplianceMonitor } from './compliance-monitor';
import { z } from 'zod';
import Stripe from 'stripe';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface InternationalPaymentData {
  customerId: string;
  amount: number;
  currency: string;
  customerCountry: string;
  customerState?: string;
  paymentMethodId?: string;
  description?: string;
  vatNumber?: string;
  customerType?: 'individual' | 'business';
  productCategory?: string;
  taxNexus?: string[];
  gdprConsent?: boolean;
  metadata?: Record<string, any>;
}

export interface RegionalPaymentData extends InternationalPaymentData {
  paymentMethod: string;
  mandateId?: string;
  bankId?: string;
  iban?: string;
}

export interface PaymentProcessingResult {
  success: boolean;
  transactionId: string;
  originalAmount: number;
  originalCurrency: string;
  settlementAmount: number;
  settlementCurrency: string;
  exchangeRate?: number;
  taxAmount: number;
  taxRate: number;
  jurisdiction: string;
  paymentMethod?: string;
  processingTime?: string;
  complianceStatus: string;
  requiresManualReview?: boolean;
  reverseCharge?: boolean;
  mossEligible?: boolean;
  gdprCompliant?: boolean;
  warnings?: string[];
  metadata?: Record<string, any>;
}

export interface ComplianceReportRequest {
  startDate: Date;
  endDate: Date;
  jurisdiction?: string;
  reportType: 'vat_return' | 'moss_report' | 'aml_suspicious_activity' | 'gdpr_compliance';
}

export interface InternationalMetricsRequest {
  period: 'last_7_days' | 'last_30_days' | 'last_90_days' | 'custom';
  startDate?: Date;
  endDate?: Date;
  groupBy?: 'currency' | 'country' | 'payment_method';
}

// =============================================
// VALIDATION SCHEMAS
// =============================================

const InternationalPaymentSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().positive().max(100000000), // Max €1M equivalent
  currency: z.string().length(3),
  customerCountry: z.string().length(2),
  customerState: z.string().max(10).optional(),
  paymentMethodId: z.string().optional(),
  description: z.string().max(500).optional(),
  vatNumber: z.string().max(50).optional(),
  customerType: z.enum(['individual', 'business']).default('individual'),
  productCategory: z.string().default('standard'),
  taxNexus: z.array(z.string()).optional(),
  gdprConsent: z.boolean().default(false),
  metadata: z.record(z.any()).optional(),
});

const RegionalPaymentSchema = InternationalPaymentSchema.extend({
  paymentMethod: z.string(),
  mandateId: z.string().optional(),
  bankId: z.string().optional(),
  iban: z.string().optional(),
});

// =============================================
// SUPPORTED CURRENCIES AND REGIONS
// =============================================

const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK'
] as const;

const REGIONAL_PAYMENT_METHODS = {
  sepa_debit: {
    regions: ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'],
    currencies: ['EUR'],
    processingTime: '2-5 business days',
    requiresMandate: true,
  },
  ideal: {
    regions: ['NL'],
    currencies: ['EUR'],
    processingTime: 'Instant',
    requiresMandate: false,
  },
  sofort: {
    regions: ['AT', 'BE', 'DE', 'IT', 'NL', 'ES'],
    currencies: ['EUR'],
    processingTime: 'Instant',
    requiresMandate: false,
  },
  bancontact: {
    regions: ['BE'],
    currencies: ['EUR'],
    processingTime: 'Instant',
    requiresMandate: false,
  },
  acss_debit: {
    regions: ['CA'],
    currencies: ['CAD'],
    processingTime: '2-7 business days',
    requiresMandate: true,
  },
  au_becs_debit: {
    regions: ['AU'],
    currencies: ['AUD'],
    processingTime: '2-3 business days',
    requiresMandate: true,
  },
  bacs_debit: {
    regions: ['GB'],
    currencies: ['GBP'],
    processingTime: '3 business days',
    requiresMandate: true,
  },
};

// =============================================
// INTERNATIONAL PAYMENT PROCESSOR CLASS
// =============================================

export class InternationalPaymentProcessor {
  private supabase;
  private stripe: Stripe;
  private currencyManager: CurrencyManager;
  private taxEngine: TaxComplianceEngine;
  private complianceMonitor: ComplianceMonitor;
  private exchangeRateCache: Map<string, { rate: number; timestamp: number }> = new Map();
  
  constructor() {
    this.supabase = createClient();
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-06-20',
      typescript: true,
    });
    
    this.currencyManager = new CurrencyManager();
    this.taxEngine = new TaxComplianceEngine();
    this.complianceMonitor = new ComplianceMonitor();
  }

  // =============================================
  // MAIN PAYMENT PROCESSING METHODS
  // =============================================

  /**
   * Process international payment with multi-currency support
   */
  async processInternationalPayment(paymentData: InternationalPaymentData): Promise<PaymentProcessingResult> {
    try {
      const validatedData = InternationalPaymentSchema.parse(paymentData);
      
      // Validate supported currency
      if (!SUPPORTED_CURRENCIES.includes(validatedData.currency as any)) {
        throw new Error(`Unsupported currency: ${validatedData.currency}`);
      }

      // Generate transaction ID
      const transactionId = `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Step 1: Perform compliance checks
      const complianceResult = await this.performComplianceChecks(validatedData);
      if (complianceResult.blocked) {
        throw new Error(complianceResult.reason || 'Transaction blocked due to compliance checks');
      }

      // Step 2: Calculate currency conversion
      const conversionResult = await this.handleCurrencyConversion(
        validatedData.amount,
        validatedData.currency,
        'USD' // Default settlement currency
      );

      // Step 3: Calculate applicable taxes
      const taxResult = await this.calculateTaxes(validatedData, conversionResult.convertedAmount);

      // Step 4: Process payment with Stripe
      const paymentResult = await this.processStripePayment(validatedData, conversionResult, taxResult);

      // Step 5: Store international transaction record
      await this.storeInternationalTransaction(validatedData, conversionResult, taxResult, paymentResult);

      // Step 6: Log compliance event
      await this.complianceMonitor.logComplianceEvent({
        eventType: 'international_payment_processed',
        entityType: 'transaction',
        entityId: transactionId,
        complianceRule: 'international_payment_processing',
        status: 'passed',
        details: {
          currency: validatedData.currency,
          country: validatedData.customerCountry,
          amount: validatedData.amount,
          taxAmount: taxResult.taxAmount,
        },
      });

      return {
        success: true,
        transactionId,
        originalAmount: validatedData.amount,
        originalCurrency: validatedData.currency,
        settlementAmount: conversionResult.convertedAmount + taxResult.taxAmount,
        settlementCurrency: 'USD',
        exchangeRate: conversionResult.exchangeRate,
        taxAmount: taxResult.taxAmount,
        taxRate: taxResult.taxRate,
        jurisdiction: taxResult.jurisdiction,
        complianceStatus: 'passed',
        requiresManualReview: complianceResult.requiresManualReview,
        reverseCharge: taxResult.reverseCharge,
        mossEligible: taxResult.mossEligible,
        gdprCompliant: complianceResult.gdprCompliant,
        warnings: [...(complianceResult.warnings || []), ...(taxResult.warnings || [])],
        metadata: validatedData.metadata,
      };

    } catch (error) {
      console.error('International payment processing error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Currency conversion failed')) {
          throw error;
        }
        if (error.message.includes('Transaction blocked')) {
          throw error;
        }
        if (error.message.includes('Unsupported currency')) {
          throw error;
        }
        if (error.message.includes('exceeds maximum limit')) {
          throw error;
        }
      }

      // For tax calculation failures, continue with manual review flag
      if (error instanceof Error && error.message.includes('Tax service unavailable')) {
        return {
          success: true,
          transactionId: `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          originalAmount: paymentData.amount,
          originalCurrency: paymentData.currency,
          settlementAmount: paymentData.amount, // Fallback without conversion
          settlementCurrency: paymentData.currency,
          taxAmount: 0,
          taxRate: 0,
          jurisdiction: paymentData.customerCountry,
          complianceStatus: 'passed',
          requiresManualReview: true,
          warnings: ['Tax calculation failed - manual review required'],
        };
      }

      throw new Error(`Failed to process international payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process regional payment methods (SEPA, iDEAL, etc.)
   */
  async processRegionalPayment(paymentData: RegionalPaymentData): Promise<PaymentProcessingResult> {
    try {
      const validatedData = RegionalPaymentSchema.parse(paymentData);
      
      // Validate regional payment method
      const methodConfig = REGIONAL_PAYMENT_METHODS[validatedData.paymentMethod as keyof typeof REGIONAL_PAYMENT_METHODS];
      if (!methodConfig) {
        throw new Error(`Unsupported payment method: ${validatedData.paymentMethod}`);
      }

      // Validate region and currency compatibility
      if (!methodConfig.regions.includes(validatedData.customerCountry)) {
        throw new Error(`Payment method ${validatedData.paymentMethod} not available in ${validatedData.customerCountry}`);
      }
      
      if (!methodConfig.currencies.includes(validatedData.currency)) {
        throw new Error(`Payment method ${validatedData.paymentMethod} does not support currency ${validatedData.currency}`);
      }

      // Check mandate requirement
      if (methodConfig.requiresMandate && !validatedData.mandateId) {
        throw new Error(`Mandate required for payment method ${validatedData.paymentMethod}`);
      }

      // Process as international payment with regional specifics
      const baseResult = await this.processInternationalPayment(validatedData);

      return {
        ...baseResult,
        paymentMethod: validatedData.paymentMethod,
        processingTime: methodConfig.processingTime,
      };

    } catch (error) {
      console.error('Regional payment processing error:', error);
      throw error;
    }
  }

  /**
   * Batch process multiple payments efficiently
   */
  async batchProcessPayments(payments: InternationalPaymentData[]): Promise<PaymentProcessingResult[]> {
    const results: PaymentProcessingResult[] = [];
    const batchSize = 10; // Process in batches to avoid overwhelming external APIs

    for (let i = 0; i < payments.length; i += batchSize) {
      const batch = payments.slice(i, i + batchSize);
      const batchPromises = batch.map(payment => 
        this.processInternationalPayment(payment).catch(error => ({
          success: false,
          error: error.message,
          transactionId: '',
          originalAmount: payment.amount,
          originalCurrency: payment.currency,
          settlementAmount: 0,
          settlementCurrency: 'USD',
          taxAmount: 0,
          taxRate: 0,
          jurisdiction: payment.customerCountry,
          complianceStatus: 'failed',
        }))
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  // =============================================
  // COMPLIANCE AND TAX METHODS
  // =============================================

  /**
   * Perform comprehensive compliance checks
   */
  private async performComplianceChecks(paymentData: InternationalPaymentData) {
    const warnings: string[] = [];
    let requiresManualReview = false;
    
    try {
      // Sanctions screening
      const sanctionsResult = await this.complianceMonitor.checkSanctionsList({
        customerId: paymentData.customerId,
        country: paymentData.customerCountry,
      });

      if (sanctionsResult.match) {
        return {
          blocked: true,
          reason: 'Transaction blocked due to sanctions screening',
          riskScore: 100,
        };
      }

      // KYC checks
      const kycResult = await this.complianceMonitor.performKYCCheck({
        customerId: paymentData.customerId,
        amount: paymentData.amount,
        country: paymentData.customerCountry,
      });

      if (!kycResult.passed) {
        return {
          blocked: true,
          reason: 'KYC verification failed',
          riskScore: kycResult.riskScore,
        };
      }

      if (kycResult.riskScore > 50) {
        requiresManualReview = true;
        warnings.push('High risk score - manual review required');
      }

      // GDPR compliance for EU customers
      let gdprCompliant = true;
      if (this.isEUCountry(paymentData.customerCountry)) {
        const gdprResult = await this.complianceMonitor.validateGDPRCompliance({
          customerId: paymentData.customerId,
          consentGiven: paymentData.gdprConsent,
        });

        gdprCompliant = gdprResult.compliant;
        if (!gdprCompliant) {
          warnings.push('GDPR consent missing or invalid');
        }
      }

      return {
        blocked: false,
        passed: true,
        riskScore: kycResult.riskScore,
        requiresManualReview,
        gdprCompliant,
        warnings,
      };

    } catch (error) {
      console.error('Compliance check error:', error);
      return {
        blocked: false,
        passed: true,
        riskScore: 0,
        requiresManualReview: true,
        warnings: ['Compliance check failed - manual review required'],
      };
    }
  }

  /**
   * Handle currency conversion with caching
   */
  private async handleCurrencyConversion(amount: number, fromCurrency: string, toCurrency: string) {
    try {
      if (fromCurrency === toCurrency) {
        return {
          originalAmount: amount,
          convertedAmount: amount,
          exchangeRate: 1,
          fees: 0,
        };
      }

      return await this.currencyManager.convertCurrency(amount, fromCurrency, toCurrency);

    } catch (error) {
      console.error('Currency conversion error:', error);
      throw new Error('Currency conversion failed');
    }
  }

  /**
   * Calculate applicable taxes based on jurisdiction
   */
  private async calculateTaxes(paymentData: InternationalPaymentData, settlementAmount: number) {
    try {
      const taxCalculationData = {
        amount: settlementAmount,
        customerCountry: paymentData.customerCountry,
        customerState: paymentData.customerState,
        vatNumber: paymentData.vatNumber,
        customerType: paymentData.customerType,
        productCategory: paymentData.productCategory,
        taxNexus: paymentData.taxNexus,
      };

      return await this.taxEngine.calculateTax(taxCalculationData);

    } catch (error) {
      console.error('Tax calculation error:', error);
      throw new Error('Tax service unavailable');
    }
  }

  /**
   * Process payment with Stripe
   */
  private async processStripePayment(
    paymentData: InternationalPaymentData, 
    conversionResult: any, 
    taxResult: any
  ) {
    try {
      const totalAmount = conversionResult.convertedAmount + taxResult.taxAmount;

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: totalAmount,
        currency: 'usd', // Settlement currency
        customer: paymentData.customerId,
        payment_method: paymentData.paymentMethodId,
        confirmation_method: 'automatic',
        confirm: true,
        metadata: {
          originalCurrency: paymentData.currency,
          originalAmount: paymentData.amount.toString(),
          exchangeRate: conversionResult.exchangeRate?.toString(),
          taxAmount: taxResult.taxAmount.toString(),
          jurisdiction: taxResult.jurisdiction,
          ...paymentData.metadata,
        },
      });

      return {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        clientSecret: paymentIntent.client_secret,
      };

    } catch (error) {
      console.error('Stripe payment error:', error);
      throw new Error(`Payment processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store international transaction record
   */
  private async storeInternationalTransaction(
    paymentData: InternationalPaymentData,
    conversionResult: any,
    taxResult: any,
    paymentResult: any
  ) {
    try {
      // Get customer and payment transaction IDs
      const { data: customer } = await this.supabase
        .from('stripe_customers')
        .select('id')
        .eq('stripe_customer_id', paymentData.customerId)
        .single();

      const { data: transaction } = await this.supabase
        .from('payment_transactions')
        .select('id')
        .eq('stripe_payment_intent_id', paymentResult.paymentIntentId)
        .single();

      // Store international transaction record
      await this.supabase
        .from('international_transactions')
        .insert({
          payment_transaction_id: transaction?.id,
          customer_country: paymentData.customerCountry,
          merchant_country: 'US',
          original_currency: paymentData.currency,
          settlement_currency: 'USD',
          original_amount: paymentData.amount,
          exchange_rate: conversionResult.exchangeRate,
          settlement_amount: conversionResult.convertedAmount,
          tax_amount: taxResult.taxAmount,
          payment_processor: 'stripe',
          processor_fee: Math.round(conversionResult.convertedAmount * 0.029), // 2.9% Stripe fee
          fx_fee: conversionResult.fees || 0,
        });

    } catch (error) {
      console.error('Error storing international transaction:', error);
      // Don't throw - transaction already processed
    }
  }

  // =============================================
  // REPORTING AND ANALYTICS
  // =============================================

  /**
   * Generate compliance reports
   */
  async generateComplianceReport(request: ComplianceReportRequest) {
    try {
      return await this.complianceMonitor.generateComplianceReport(request);
    } catch (error) {
      console.error('Error generating compliance report:', error);
      throw new Error(`Failed to generate compliance report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get international payment metrics
   */
  async getInternationalMetrics(request: InternationalMetricsRequest) {
    try {
      let startDate: Date;
      let endDate = new Date();

      // Calculate date range
      switch (request.period) {
        case 'last_7_days':
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'last_30_days':
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'last_90_days':
          startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'custom':
          startDate = request.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          endDate = request.endDate || new Date();
          break;
        default:
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }

      // Query international transactions
      const { data: transactions } = await this.supabase
        .from('international_transactions')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      // Calculate metrics
      const totalVolume = transactions?.reduce((sum, t) => sum + t.settlement_amount, 0) || 0;
      const totalTransactions = transactions?.length || 0;
      const averageTransactionValue = totalTransactions > 0 ? totalVolume / totalTransactions : 0;

      // Group by requested dimension
      let groupedData = {};
      if (request.groupBy && transactions) {
        groupedData = transactions.reduce((groups: any, transaction) => {
          const key = transaction[`${request.groupBy === 'currency' ? 'original_currency' : 
                                   request.groupBy === 'country' ? 'customer_country' : 
                                   'payment_processor'}`];
          
          if (!groups[key]) {
            groups[key] = { count: 0, volume: 0 };
          }
          groups[key].count += 1;
          groups[key].volume += transaction.settlement_amount;
          return groups;
        }, {});
      }

      return {
        totalVolume,
        totalTransactions,
        averageTransactionValue,
        currencyBreakdown: request.groupBy === 'currency' ? groupedData : undefined,
        countryBreakdown: request.groupBy === 'country' ? groupedData : undefined,
        paymentMethodBreakdown: request.groupBy === 'payment_method' ? groupedData : undefined,
        period: {
          startDate,
          endDate,
        },
      };

    } catch (error) {
      console.error('Error getting international metrics:', error);
      throw new Error(`Failed to get international metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  /**
   * Check if country is in EU
   */
  private isEUCountry(countryCode: string): boolean {
    const euCountries = [
      'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
      'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
      'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
    ];
    return euCountries.includes(countryCode);
  }

  /**
   * Get supported currencies
   */
  getSupportedCurrencies() {
    return SUPPORTED_CURRENCIES;
  }

  /**
   * Get supported regional payment methods
   */
  getSupportedRegionalPaymentMethods() {
    return REGIONAL_PAYMENT_METHODS;
  }

  /**
   * Validate payment amount limits
   */
  private validatePaymentLimits(amount: number, currency: string) {
    const maxLimits: Record<string, number> = {
      USD: 100000000, // $1,000,000
      EUR: 100000000, // €1,000,000
      GBP: 100000000, // £1,000,000
      CAD: 100000000, // C$1,000,000
      AUD: 100000000, // A$1,000,000
    };

    const limit = maxLimits[currency] || 100000000;
    if (amount > limit) {
      throw new Error('Payment amount exceeds maximum limit');
    }
  }
}

// =============================================
// SINGLETON INSTANCE
// =============================================

const internationalPaymentProcessor = new InternationalPaymentProcessor();
export default internationalPaymentProcessor;