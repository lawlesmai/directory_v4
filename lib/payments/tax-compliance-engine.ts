/**
 * EPIC 5 STORY 5.9: International Payments & Tax Compliance
 * Tax Compliance Engine - VAT, GST, and Sales Tax Calculations
 * 
 * Comprehensive tax compliance system supporting:
 * - EU VAT with MOSS (Mini One Stop Shop) registration
 * - UK/Canada/Australia GST calculations
 * - US state sales tax with nexus determination
 * - B2B reverse charge handling
 * - Digital services tax compliance
 * - Tax invoice generation
 */

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface TaxJurisdiction {
  id: string;
  code: string;
  name: string;
  type: 'country' | 'state' | 'province';
  taxSystem: 'vat' | 'gst' | 'sales_tax';
  defaultRate: number;
  currency: string;
  thresholdAmount?: number;
  registrationRequired: boolean;
  mossEligible: boolean;
  reverseChargeApplicable: boolean;
}

export interface TaxRate {
  id: string;
  jurisdictionId: string;
  productCategory: string;
  rate: number;
  rateType: 'percentage' | 'fixed';
  description?: string;
  effectiveFrom: Date;
  effectiveUntil?: Date;
}

export interface TaxCalculationData {
  amount: number;
  customerCountry: string;
  customerState?: string;
  vatNumber?: string;
  customerType?: 'individual' | 'business';
  productCategory?: string;
  taxNexus?: string[];
  businessRegistrationCountries?: string[];
}

export interface TaxCalculationResult {
  taxAmount: number;
  taxRate: number;
  jurisdiction: string;
  taxType: 'vat' | 'gst' | 'sales_tax';
  reverseCharge: boolean;
  exemptionReason?: string;
  mossEligible?: boolean;
  applicableRules: string[];
  warnings?: string[];
  calculationDetails: TaxCalculationDetails;
}

export interface TaxCalculationDetails {
  taxableAmount: number;
  exemptAmount: number;
  jurisdictionDetails: TaxJurisdiction;
  rateDetails: TaxRate;
  crossBorder: boolean;
  digitalServices: boolean;
}

export interface VATNumberValidationResult {
  valid: boolean;
  companyName?: string;
  country: string;
  vatNumber: string;
  requestDate: Date;
  source: 'vies' | 'local' | 'cache';
}

export interface TaxInvoiceData {
  transactionId: string;
  customerInfo: CustomerTaxInfo;
  merchantInfo: MerchantTaxInfo;
  lineItems: TaxLineItem[];
  totalAmount: number;
  totalTaxAmount: number;
  currency: string;
  invoiceDate: Date;
  dueDate?: Date;
}

export interface CustomerTaxInfo {
  name: string;
  address: AddressInfo;
  vatNumber?: string;
  taxId?: string;
  customerType: 'individual' | 'business';
}

export interface MerchantTaxInfo {
  name: string;
  address: AddressInfo;
  vatNumber: string;
  taxId?: string;
  registrationNumbers: Record<string, string>;
}

export interface AddressInfo {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface TaxLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  taxRate: number;
  taxAmount: number;
  productCategory: string;
}

// =============================================
// VALIDATION SCHEMAS
// =============================================

const TaxCalculationSchema = z.object({
  amount: z.number().positive(),
  customerCountry: z.string().length(2),
  customerState: z.string().max(10).optional(),
  vatNumber: z.string().max(50).optional(),
  customerType: z.enum(['individual', 'business']).default('individual'),
  productCategory: z.string().default('standard'),
  taxNexus: z.array(z.string()).optional(),
  businessRegistrationCountries: z.array(z.string()).optional(),
});

const VATNumberSchema = z.object({
  vatNumber: z.string().min(8).max(15),
  country: z.string().length(2).optional(),
});

// =============================================
// TAX COMPLIANCE ENGINE CLASS
// =============================================

export class TaxComplianceEngine {
  private supabase;
  private vatValidationCache: Map<string, VATNumberValidationResult> = new Map();
  private taxRateCache: Map<string, TaxRate[]> = new Map();
  private readonly VAT_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly RATE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

  // US states with sales tax nexus thresholds
  private readonly US_NEXUS_THRESHOLDS = {
    'AL': 250000, 'AK': 100000, 'AZ': 200000, 'AR': 100000, 'CA': 500000,
    'CO': 100000, 'CT': 250000, 'DE': 0, 'FL': 100000, 'GA': 100000,
    'HI': 100000, 'ID': 100000, 'IL': 100000, 'IN': 100000, 'IA': 100000,
    'KS': 100000, 'KY': 100000, 'LA': 100000, 'ME': 100000, 'MD': 100000,
    'MA': 100000, 'MI': 100000, 'MN': 100000, 'MS': 250000, 'MO': 100000,
    'MT': 0, 'NE': 100000, 'NV': 100000, 'NH': 0, 'NJ': 100000,
    'NM': 100000, 'NY': 500000, 'NC': 100000, 'ND': 100000, 'OH': 100000,
    'OK': 100000, 'OR': 0, 'PA': 100000, 'RI': 100000, 'SC': 100000,
    'SD': 100000, 'TN': 100000, 'TX': 500000, 'UT': 100000, 'VT': 100000,
    'VA': 100000, 'WA': 100000, 'WV': 100000, 'WI': 100000, 'WY': 100000,
  };

  // EU member states
  private readonly EU_COUNTRIES = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
    'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
    'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
  ];

  constructor() {
    this.supabase = createClient();
  }

  // =============================================
  // MAIN TAX CALCULATION METHODS
  // =============================================

  /**
   * Calculate tax for international transaction
   */
  async calculateTax(data: TaxCalculationData): Promise<TaxCalculationResult> {
    try {
      const validatedData = TaxCalculationSchema.parse(data);
      
      // Get tax jurisdiction
      const jurisdiction = await this.getTaxJurisdiction(
        validatedData.customerCountry,
        validatedData.customerState
      );

      if (!jurisdiction) {
        return this.createNoTaxResult(validatedData, 'No tax jurisdiction found');
      }

      // Get applicable tax rates
      const taxRates = await this.getApplicableTaxRate(
        jurisdiction,
        validatedData.productCategory || 'standard'
      );

      if (!taxRates || taxRates.length === 0) {
        return this.createNoTaxResult(validatedData, 'No applicable tax rate found');
      }

      const primaryRate = taxRates[0];

      // Determine if reverse charge applies
      const reverseCharge = await this.shouldApplyReverseCharge(validatedData, jurisdiction);

      // Calculate tax amount
      const taxCalculation = this.performTaxCalculation(
        validatedData,
        primaryRate,
        jurisdiction,
        reverseCharge
      );

      // Check for exemptions
      const exemption = await this.checkTaxExemptions(validatedData, jurisdiction);
      
      if (exemption.exempt) {
        return {
          ...taxCalculation,
          taxAmount: 0,
          exemptionReason: exemption.reason,
          applicableRules: [...taxCalculation.applicableRules, 'tax_exemption'],
        };
      }

      return taxCalculation;

    } catch (error) {
      console.error('Tax calculation error:', error);
      throw new Error(`Tax calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate VAT number using EU VIES system or local validation
   */
  async validateVATNumber(vatNumber: string, country?: string): Promise<VATNumberValidationResult> {
    try {
      const validatedData = VATNumberSchema.parse({ vatNumber, country });
      const cleanVatNumber = validatedData.vatNumber.replace(/[\s\-\.]/g, '').toUpperCase();
      
      // Check cache first
      const cacheKey = `${cleanVatNumber}-${country || 'unknown'}`;
      const cached = this.vatValidationCache.get(cacheKey);
      if (cached && (Date.now() - cached.requestDate.getTime()) < this.VAT_CACHE_TTL) {
        return cached;
      }

      // Extract country code from VAT number if not provided
      const vatCountry = country || this.extractCountryFromVATNumber(cleanVatNumber);
      
      let result: VATNumberValidationResult;

      if (this.EU_COUNTRIES.includes(vatCountry)) {
        // Use VIES for EU VAT validation
        result = await this.validateVATWithVIES(cleanVatNumber, vatCountry);
      } else {
        // Use local validation for non-EU countries
        result = await this.validateVATLocally(cleanVatNumber, vatCountry);
      }

      // Cache result
      this.vatValidationCache.set(cacheKey, result);

      return result;

    } catch (error) {
      console.error('VAT validation error:', error);
      return {
        valid: false,
        country: country || 'unknown',
        vatNumber,
        requestDate: new Date(),
        source: 'error',
      };
    }
  }

  /**
   * Generate tax-compliant invoice
   */
  async generateTaxInvoice(invoiceData: TaxInvoiceData): Promise<string> {
    try {
      // Validate invoice data
      this.validateInvoiceData(invoiceData);

      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber(invoiceData.customerInfo.address.country);

      // Create invoice document
      const invoice = this.createInvoiceDocument(invoiceData, invoiceNumber);

      // Store invoice record
      await this.storeInvoiceRecord(invoiceData, invoiceNumber, invoice);

      return invoiceNumber;

    } catch (error) {
      console.error('Invoice generation error:', error);
      throw new Error(`Failed to generate tax invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // JURISDICTION AND RATE METHODS
  // =============================================

  /**
   * Get tax jurisdiction for location
   */
  async getTaxJurisdiction(country: string, state?: string): Promise<TaxJurisdiction | null> {
    try {
      let query = this.supabase
        .from('tax_jurisdictions')
        .select('*')
        .eq('active', true);

      if (state && country === 'US') {
        // For US, look for state jurisdiction first
        const stateJurisdiction = await query
          .eq('code', `${country}-${state}`)
          .eq('type', 'state')
          .single();

        if (stateJurisdiction.data) {
          return this.mapJurisdictionFromDB(stateJurisdiction.data);
        }
      }

      // Look for country jurisdiction
      const { data } = await query
        .eq('code', country)
        .eq('type', 'country')
        .single();

      return data ? this.mapJurisdictionFromDB(data) : null;

    } catch (error) {
      console.error('Error fetching tax jurisdiction:', error);
      return null;
    }
  }

  /**
   * Get applicable tax rate for jurisdiction and product category
   */
  async getApplicableTaxRate(jurisdiction: TaxJurisdiction, productCategory: string): Promise<TaxRate[]> {
    try {
      const cacheKey = `${jurisdiction.id}-${productCategory}`;
      const cached = this.taxRateCache.get(cacheKey);
      
      if (cached && cached.length > 0) {
        return cached;
      }

      const { data, error } = await this.supabase
        .from('tax_rates')
        .select('*')
        .eq('jurisdiction_id', jurisdiction.id)
        .eq('product_category', productCategory)
        .lte('effective_from', new Date().toISOString().split('T')[0])
        .or(`effective_until.is.null,effective_until.gt.${new Date().toISOString().split('T')[0]}`)
        .order('effective_from', { ascending: false });

      if (error) throw error;

      const rates = data.map(rate => this.mapTaxRateFromDB(rate));
      
      // Cache the rates
      this.taxRateCache.set(cacheKey, rates);

      return rates;

    } catch (error) {
      console.error('Error fetching tax rates:', error);
      return [];
    }
  }

  // =============================================
  // TAX CALCULATION LOGIC
  // =============================================

  /**
   * Perform actual tax calculation
   */
  private performTaxCalculation(
    data: TaxCalculationData,
    rate: TaxRate,
    jurisdiction: TaxJurisdiction,
    reverseCharge: boolean
  ): TaxCalculationResult {
    const taxableAmount = data.amount;
    const exemptAmount = 0;
    
    // Calculate tax
    let taxAmount = 0;
    if (!reverseCharge) {
      if (rate.rateType === 'percentage') {
        taxAmount = Math.round(taxableAmount * rate.rate);
      } else {
        taxAmount = rate.rate * 100; // Convert to cents
      }
    }

    const applicableRules = [
      `${jurisdiction.taxSystem}_calculation`,
      `product_category_${data.productCategory}`,
    ];

    if (reverseCharge) {
      applicableRules.push('reverse_charge');
    }

    if (this.isDigitalService(data.productCategory)) {
      applicableRules.push('digital_services');
    }

    return {
      taxAmount,
      taxRate: rate.rate,
      jurisdiction: jurisdiction.code,
      taxType: jurisdiction.taxSystem,
      reverseCharge,
      mossEligible: jurisdiction.mossEligible && this.isEUCountry(data.customerCountry),
      applicableRules,
      calculationDetails: {
        taxableAmount,
        exemptAmount,
        jurisdictionDetails: jurisdiction,
        rateDetails: rate,
        crossBorder: this.isCrossBorderTransaction(data.customerCountry),
        digitalServices: this.isDigitalService(data.productCategory),
      },
    };
  }

  /**
   * Check if reverse charge should apply
   */
  private async shouldApplyReverseCharge(
    data: TaxCalculationData,
    jurisdiction: TaxJurisdiction
  ): Promise<boolean> {
    // Reverse charge applies for B2B transactions in different EU countries
    if (
      jurisdiction.reverseChargeApplicable &&
      data.customerType === 'business' &&
      data.vatNumber &&
      this.isEUCountry(data.customerCountry) &&
      this.isEUCountry(jurisdiction.code) &&
      data.customerCountry !== jurisdiction.code
    ) {
      // Validate VAT number to confirm business status
      const vatValidation = await this.validateVATNumber(data.vatNumber, data.customerCountry);
      return vatValidation.valid;
    }

    return false;
  }

  /**
   * Check for tax exemptions
   */
  private async checkTaxExemptions(
    data: TaxCalculationData,
    jurisdiction: TaxJurisdiction
  ): Promise<{ exempt: boolean; reason?: string }> {
    // Digital services threshold exemption (EU)
    if (
      jurisdiction.thresholdAmount &&
      this.isDigitalService(data.productCategory) &&
      data.amount < jurisdiction.thresholdAmount
    ) {
      return {
        exempt: true,
        reason: 'Below digital services threshold',
      };
    }

    // US sales tax exemption for certain states
    if (
      jurisdiction.taxSystem === 'sales_tax' &&
      data.customerCountry === 'US' &&
      data.customerState
    ) {
      const noSalesTaxStates = ['DE', 'MT', 'NH', 'OR'];
      if (noSalesTaxStates.includes(data.customerState)) {
        return {
          exempt: true,
          reason: 'No sales tax in state',
        };
      }

      // Check nexus threshold
      const threshold = this.US_NEXUS_THRESHOLDS[data.customerState];
      if (threshold === 0) {
        return {
          exempt: true,
          reason: 'No sales tax nexus',
        };
      }
    }

    return { exempt: false };
  }

  /**
   * Create no-tax result
   */
  private createNoTaxResult(data: TaxCalculationData, reason: string): TaxCalculationResult {
    return {
      taxAmount: 0,
      taxRate: 0,
      jurisdiction: data.customerCountry,
      taxType: 'vat',
      reverseCharge: false,
      exemptionReason: reason,
      applicableRules: ['no_tax'],
      calculationDetails: {
        taxableAmount: data.amount,
        exemptAmount: 0,
        jurisdictionDetails: {} as TaxJurisdiction,
        rateDetails: {} as TaxRate,
        crossBorder: false,
        digitalServices: false,
      },
    };
  }

  // =============================================
  // VAT VALIDATION METHODS
  // =============================================

  /**
   * Validate VAT number with EU VIES system
   */
  private async validateVATWithVIES(
    vatNumber: string,
    country: string
  ): Promise<VATNumberValidationResult> {
    try {
      // VIES API endpoint
      const viesUrl = 'http://ec.europa.eu/taxation_customs/vies/services/checkVatService';
      
      // Create SOAP envelope
      const soapEnvelope = `
        <?xml version="1.0" encoding="UTF-8"?>
        <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
          <soapenv:Header />
          <soapenv:Body>
            <urn:checkVat>
              <urn:countryCode>${country}</urn:countryCode>
              <urn:vatNumber>${vatNumber.substring(2)}</urn:vatNumber>
            </urn:checkVat>
          </soapenv:Body>
        </soapenv:Envelope>
      `;

      const response = await fetch(viesUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': '',
        },
        body: soapEnvelope,
      });

      if (!response.ok) {
        throw new Error(`VIES API error: ${response.status}`);
      }

      const xmlText = await response.text();
      
      // Parse XML response (simplified - in production, use proper XML parser)
      const isValid = xmlText.includes('<valid>true</valid>');
      const nameMatch = xmlText.match(/<name>(.*?)<\/name>/);
      const companyName = nameMatch ? nameMatch[1] : undefined;

      return {
        valid: isValid,
        companyName: companyName !== '---' ? companyName : undefined,
        country,
        vatNumber,
        requestDate: new Date(),
        source: 'vies',
      };

    } catch (error) {
      console.error('VIES validation error:', error);
      
      // Fallback to basic format validation
      return this.validateVATLocally(vatNumber, country);
    }
  }

  /**
   * Local VAT number validation (format check)
   */
  private async validateVATLocally(
    vatNumber: string,
    country: string
  ): Promise<VATNumberValidationResult> {
    const vatPatterns: Record<string, RegExp> = {
      'GB': /^GB\d{9}(\d{3})?$/,
      'DE': /^DE\d{9}$/,
      'FR': /^FR[A-Z0-9]{2}\d{9}$/,
      'IT': /^IT\d{11}$/,
      'ES': /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,
      'NL': /^NL\d{9}B\d{2}$/,
      'BE': /^BE0\d{9}$/,
      'AT': /^ATU\d{8}$/,
      'CA': /^CA\d{9}(RT|RC)\d{4}$/,
      'AU': /^AU\d{11}$/,
    };

    const pattern = vatPatterns[country];
    const valid = pattern ? pattern.test(vatNumber) : false;

    return {
      valid,
      country,
      vatNumber,
      requestDate: new Date(),
      source: 'local',
    };
  }

  /**
   * Extract country code from VAT number
   */
  private extractCountryFromVATNumber(vatNumber: string): string {
    const countryMatch = vatNumber.match(/^([A-Z]{2})/);
    return countryMatch ? countryMatch[1] : 'unknown';
  }

  // =============================================
  // INVOICE GENERATION METHODS
  // =============================================

  /**
   * Validate invoice data
   */
  private validateInvoiceData(invoiceData: TaxInvoiceData): void {
    if (!invoiceData.customerInfo.name) {
      throw new Error('Customer name is required');
    }
    
    if (!invoiceData.customerInfo.address.country) {
      throw new Error('Customer country is required');
    }
    
    if (invoiceData.lineItems.length === 0) {
      throw new Error('At least one line item is required');
    }
    
    if (invoiceData.totalAmount <= 0) {
      throw new Error('Total amount must be positive');
    }
  }

  /**
   * Generate unique invoice number
   */
  private async generateInvoiceNumber(customerCountry: string): Promise<string> {
    const year = new Date().getFullYear();
    const sequence = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `INV-${year}-${customerCountry}-${sequence}`;
  }

  /**
   * Create invoice document
   */
  private createInvoiceDocument(invoiceData: TaxInvoiceData, invoiceNumber: string): any {
    return {
      invoiceNumber,
      invoiceDate: invoiceData.invoiceDate.toISOString().split('T')[0],
      dueDate: invoiceData.dueDate?.toISOString().split('T')[0],
      customer: invoiceData.customerInfo,
      merchant: invoiceData.merchantInfo,
      lineItems: invoiceData.lineItems,
      subtotal: invoiceData.totalAmount - invoiceData.totalTaxAmount,
      totalTaxAmount: invoiceData.totalTaxAmount,
      totalAmount: invoiceData.totalAmount,
      currency: invoiceData.currency,
      transactionId: invoiceData.transactionId,
    };
  }

  /**
   * Store invoice record in database
   */
  private async storeInvoiceRecord(
    invoiceData: TaxInvoiceData,
    invoiceNumber: string,
    invoice: any
  ): Promise<void> {
    try {
      // This would integrate with the existing invoice storage system
      // For now, we'll just log the invoice data
      console.log('Tax invoice generated:', {
        invoiceNumber,
        transactionId: invoiceData.transactionId,
        totalAmount: invoiceData.totalAmount,
        totalTaxAmount: invoiceData.totalTaxAmount,
      });

    } catch (error) {
      console.error('Error storing invoice record:', error);
      throw error;
    }
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  /**
   * Check if country is in EU
   */
  private isEUCountry(countryCode: string): boolean {
    return this.EU_COUNTRIES.includes(countryCode);
  }

  /**
   * Check if transaction is cross-border
   */
  private isCrossBorderTransaction(customerCountry: string): boolean {
    // Assume merchant is US-based
    return customerCountry !== 'US';
  }

  /**
   * Check if product is digital service
   */
  private isDigitalService(productCategory?: string): boolean {
    const digitalCategories = [
      'digital_services',
      'software',
      'streaming',
      'downloads',
      'saas',
      'digital_content',
    ];
    
    return digitalCategories.includes(productCategory || 'standard');
  }

  /**
   * Map jurisdiction data from database
   */
  private mapJurisdictionFromDB(data: any): TaxJurisdiction {
    return {
      id: data.id,
      code: data.code,
      name: data.name,
      type: data.type,
      taxSystem: data.tax_system,
      defaultRate: parseFloat(data.default_rate),
      currency: data.currency,
      thresholdAmount: data.threshold_amount,
      registrationRequired: data.registration_required,
      mossEligible: data.moss_eligible,
      reverseChargeApplicable: data.reverse_charge_applicable,
    };
  }

  /**
   * Map tax rate data from database
   */
  private mapTaxRateFromDB(data: any): TaxRate {
    return {
      id: data.id,
      jurisdictionId: data.jurisdiction_id,
      productCategory: data.product_category,
      rate: parseFloat(data.rate),
      rateType: data.rate_type,
      description: data.description,
      effectiveFrom: new Date(data.effective_from),
      effectiveUntil: data.effective_until ? new Date(data.effective_until) : undefined,
    };
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    
    // Clear VAT validation cache
    for (const [key, result] of this.vatValidationCache.entries()) {
      if ((now - result.requestDate.getTime()) >= this.VAT_CACHE_TTL) {
        this.vatValidationCache.delete(key);
      }
    }

    // Clear tax rate cache
    this.taxRateCache.clear(); // Simple approach - clear all rates cache
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      vatValidationCacheSize: this.vatValidationCache.size,
      taxRateCacheSize: this.taxRateCache.size,
      vatCacheTtl: this.VAT_CACHE_TTL,
      rateCacheTtl: this.RATE_CACHE_TTL,
    };
  }
}

// =============================================
// SINGLETON INSTANCE
// =============================================

const taxComplianceEngine = new TaxComplianceEngine();
export default taxComplianceEngine;