/**
 * EPIC 5 STORY 5.9: International Payments & Tax Compliance
 * Currency Manager - Real-time Currency Conversion & Management
 * 
 * Provides comprehensive currency management including:
 * - Real-time exchange rate fetching from multiple providers
 * - Currency conversion with caching for performance
 * - Historical rate tracking and fallback mechanisms
 * - Multi-provider redundancy for reliability
 */

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  active: boolean;
  primaryRegions: string[];
  paymentMethods: string[];
  stripeSupported: boolean;
}

export interface ExchangeRate {
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  provider: string;
  timestamp: Date;
  validUntil: Date;
}

export interface ConversionResult {
  originalAmount: number;
  convertedAmount: number;
  exchangeRate: number;
  fees: number;
  provider: string;
  timestamp: Date;
}

export interface ExchangeRateProvider {
  name: string;
  url: string;
  apiKey?: string;
  rateLimit: number;
  reliability: number;
}

// =============================================
// VALIDATION SCHEMAS
// =============================================

const ConversionSchema = z.object({
  amount: z.number().positive(),
  fromCurrency: z.string().length(3),
  toCurrency: z.string().length(3),
});

// =============================================
// EXCHANGE RATE PROVIDERS
// =============================================

const EXCHANGE_RATE_PROVIDERS: ExchangeRateProvider[] = [
  {
    name: 'exchangerate-api',
    url: 'https://v6.exchangerate-api.com/v6',
    apiKey: process.env.EXCHANGE_RATE_API_KEY,
    rateLimit: 1500, // requests per month
    reliability: 95,
  },
  {
    name: 'fixer',
    url: 'https://api.fixer.io/v1',
    apiKey: process.env.FIXER_API_KEY,
    rateLimit: 1000,
    reliability: 90,
  },
  {
    name: 'currencyapi',
    url: 'https://api.currencyapi.com/v3',
    apiKey: process.env.CURRENCY_API_KEY,
    rateLimit: 300,
    reliability: 85,
  },
  {
    name: 'ecb',
    url: 'https://api.exchangerate.host/v1',
    rateLimit: 1000,
    reliability: 80,
  },
];

// =============================================
// CURRENCY MANAGER CLASS
// =============================================

export class CurrencyManager {
  private supabase;
  private exchangeRateCache: Map<string, ExchangeRate> = new Map();
  private providerFailureCount: Map<string, number> = new Map();
  private lastCacheUpdate: Date = new Date(0);
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_PROVIDER_FAILURES = 3;

  constructor() {
    this.supabase = createClient();
  }

  // =============================================
  // MAIN CONVERSION METHODS
  // =============================================

  /**
   * Convert currency with automatic fallback and caching
   */
  async convertCurrency(
    amount: number, 
    fromCurrency: string, 
    toCurrency: string
  ): Promise<ConversionResult> {
    try {
      const validatedData = ConversionSchema.parse({
        amount,
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
      });

      // Same currency - no conversion needed
      if (validatedData.fromCurrency === validatedData.toCurrency) {
        return {
          originalAmount: validatedData.amount,
          convertedAmount: validatedData.amount,
          exchangeRate: 1,
          fees: 0,
          provider: 'none',
          timestamp: new Date(),
        };
      }

      // Get exchange rate
      const exchangeRate = await this.getExchangeRate(
        validatedData.fromCurrency,
        validatedData.toCurrency
      );

      // Calculate conversion
      const convertedAmount = Math.round(validatedData.amount * exchangeRate.rate);
      
      // Calculate fees (0.5% for currency conversion)
      const fees = Math.round(convertedAmount * 0.005);

      return {
        originalAmount: validatedData.amount,
        convertedAmount,
        exchangeRate: exchangeRate.rate,
        fees,
        provider: exchangeRate.provider,
        timestamp: exchangeRate.timestamp,
      };

    } catch (error) {
      console.error('Currency conversion error:', error);
      throw new Error(`Currency conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get exchange rate with caching and fallback
   */
  async getExchangeRate(baseCurrency: string, targetCurrency: string): Promise<ExchangeRate> {
    const cacheKey = `${baseCurrency}-${targetCurrency}`;
    const now = new Date();

    // Check cache first
    const cachedRate = this.exchangeRateCache.get(cacheKey);
    if (cachedRate && cachedRate.validUntil > now) {
      return cachedRate;
    }

    try {
      // Try to get rate from database (for recent rates)
      const dbRate = await this.getExchangeRateFromDB(baseCurrency, targetCurrency);
      if (dbRate && dbRate.validUntil > now) {
        this.exchangeRateCache.set(cacheKey, dbRate);
        return dbRate;
      }

      // Fetch fresh rate from providers
      const freshRate = await this.fetchExchangeRateFromProviders(baseCurrency, targetCurrency);
      
      // Cache the fresh rate
      this.exchangeRateCache.set(cacheKey, freshRate);
      
      // Store in database
      await this.storeExchangeRateInDB(freshRate);
      
      return freshRate;

    } catch (error) {
      console.error('Exchange rate fetch error:', error);
      
      // Try fallback to cached rate even if expired
      if (cachedRate) {
        console.warn(`Using expired exchange rate for ${baseCurrency}/${targetCurrency}`);
        return cachedRate;
      }

      // Try historical rate from database
      const historicalRate = await this.getHistoricalExchangeRate(baseCurrency, targetCurrency);
      if (historicalRate) {
        console.warn(`Using historical exchange rate for ${baseCurrency}/${targetCurrency}`);
        return {
          ...historicalRate,
          validUntil: new Date(Date.now() + this.CACHE_TTL),
        };
      }

      throw new Error(`Unable to get exchange rate for ${baseCurrency}/${targetCurrency}`);
    }
  }

  /**
   * Update all exchange rates from providers
   */
  async updateExchangeRates(): Promise<void> {
    try {
      const supportedCurrencies = await this.getSupportedCurrencies();
      const baseCurrency = 'USD'; // Use USD as base for all rates
      
      for (const currency of supportedCurrencies) {
        if (currency.code === baseCurrency) continue;

        try {
          const rate = await this.fetchExchangeRateFromProviders(baseCurrency, currency.code);
          await this.storeExchangeRateInDB(rate);
          
          // Also get reverse rate
          const reverseRate = await this.fetchExchangeRateFromProviders(currency.code, baseCurrency);
          await this.storeExchangeRateInDB(reverseRate);

        } catch (error) {
          console.error(`Failed to update rate for ${currency.code}:`, error);
        }
      }

      this.lastCacheUpdate = new Date();
      console.log('Exchange rates updated successfully');

    } catch (error) {
      console.error('Failed to update exchange rates:', error);
    }
  }

  // =============================================
  // PROVIDER INTEGRATION METHODS
  // =============================================

  /**
   * Fetch exchange rate from multiple providers with fallback
   */
  private async fetchExchangeRateFromProviders(
    baseCurrency: string, 
    targetCurrency: string
  ): Promise<ExchangeRate> {
    const availableProviders = EXCHANGE_RATE_PROVIDERS.filter(
      provider => (this.providerFailureCount.get(provider.name) || 0) < this.MAX_PROVIDER_FAILURES
    ).sort((a, b) => b.reliability - a.reliability);

    for (const provider of availableProviders) {
      try {
        const rate = await this.fetchFromProvider(provider, baseCurrency, targetCurrency);
        
        // Reset failure count on success
        this.providerFailureCount.delete(provider.name);
        
        return rate;

      } catch (error) {
        console.error(`Provider ${provider.name} failed:`, error);
        
        // Increment failure count
        const failures = this.providerFailureCount.get(provider.name) || 0;
        this.providerFailureCount.set(provider.name, failures + 1);
        
        // Continue to next provider
        continue;
      }
    }

    throw new Error('All exchange rate providers failed');
  }

  /**
   * Fetch rate from specific provider
   */
  private async fetchFromProvider(
    provider: ExchangeRateProvider,
    baseCurrency: string,
    targetCurrency: string
  ): Promise<ExchangeRate> {
    const now = new Date();
    const validUntil = new Date(now.getTime() + this.CACHE_TTL);

    try {
      let rate: number;

      switch (provider.name) {
        case 'exchangerate-api':
          rate = await this.fetchFromExchangeRateAPI(provider, baseCurrency, targetCurrency);
          break;
        
        case 'fixer':
          rate = await this.fetchFromFixer(provider, baseCurrency, targetCurrency);
          break;
        
        case 'currencyapi':
          rate = await this.fetchFromCurrencyAPI(provider, baseCurrency, targetCurrency);
          break;
        
        case 'ecb':
          rate = await this.fetchFromECB(provider, baseCurrency, targetCurrency);
          break;
        
        default:
          throw new Error(`Unsupported provider: ${provider.name}`);
      }

      return {
        baseCurrency,
        targetCurrency,
        rate,
        provider: provider.name,
        timestamp: now,
        validUntil,
      };

    } catch (error) {
      throw new Error(`Provider ${provider.name} request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch from ExchangeRate-API
   */
  private async fetchFromExchangeRateAPI(
    provider: ExchangeRateProvider,
    baseCurrency: string,
    targetCurrency: string
  ): Promise<number> {
    const url = `${provider.url}/${provider.apiKey}/pair/${baseCurrency}/${targetCurrency}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.result !== 'success') {
      throw new Error(data['error-type'] || 'API error');
    }

    return data.conversion_rate;
  }

  /**
   * Fetch from Fixer.io
   */
  private async fetchFromFixer(
    provider: ExchangeRateProvider,
    baseCurrency: string,
    targetCurrency: string
  ): Promise<number> {
    const url = `${provider.url}/latest?access_key=${provider.apiKey}&base=${baseCurrency}&symbols=${targetCurrency}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error?.info || 'API error');
    }

    return data.rates[targetCurrency];
  }

  /**
   * Fetch from CurrencyAPI
   */
  private async fetchFromCurrencyAPI(
    provider: ExchangeRateProvider,
    baseCurrency: string,
    targetCurrency: string
  ): Promise<number> {
    const url = `${provider.url}/latest?apikey=${provider.apiKey}&base_currency=${baseCurrency}&currencies=${targetCurrency}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.data[targetCurrency].value;
  }

  /**
   * Fetch from ECB (European Central Bank) - free but EUR only
   */
  private async fetchFromECB(
    provider: ExchangeRateProvider,
    baseCurrency: string,
    targetCurrency: string
  ): Promise<number> {
    const url = `${provider.url}/latest`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // ECB uses EUR as base, so we need to calculate cross rates
    const eurToTarget = data.rates[targetCurrency];
    const eurToBase = data.rates[baseCurrency];
    
    if (baseCurrency === 'EUR') {
      return eurToTarget;
    } else if (targetCurrency === 'EUR') {
      return 1 / eurToBase;
    } else {
      // Cross rate: Base -> EUR -> Target
      return eurToTarget / eurToBase;
    }
  }

  // =============================================
  // DATABASE METHODS
  // =============================================

  /**
   * Get exchange rate from database
   */
  private async getExchangeRateFromDB(
    baseCurrency: string,
    targetCurrency: string
  ): Promise<ExchangeRate | null> {
    try {
      const { data } = await this.supabase
        .from('exchange_rates')
        .select('*')
        .eq('base_currency', baseCurrency)
        .eq('target_currency', targetCurrency)
        .gte('valid_until', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        return {
          baseCurrency: data.base_currency,
          targetCurrency: data.target_currency,
          rate: parseFloat(data.rate),
          provider: data.provider,
          timestamp: new Date(data.valid_from),
          validUntil: new Date(data.valid_until),
        };
      }

      return null;

    } catch (error) {
      console.error('Database exchange rate fetch error:', error);
      return null;
    }
  }

  /**
   * Store exchange rate in database
   */
  private async storeExchangeRateInDB(exchangeRate: ExchangeRate): Promise<void> {
    try {
      await this.supabase
        .from('exchange_rates')
        .upsert({
          base_currency: exchangeRate.baseCurrency,
          target_currency: exchangeRate.targetCurrency,
          rate: exchangeRate.rate,
          provider: exchangeRate.provider,
          valid_from: exchangeRate.timestamp.toISOString(),
          valid_until: exchangeRate.validUntil.toISOString(),
        }, {
          onConflict: 'base_currency,target_currency,valid_from'
        });

    } catch (error) {
      console.error('Error storing exchange rate:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Get historical exchange rate as fallback
   */
  private async getHistoricalExchangeRate(
    baseCurrency: string,
    targetCurrency: string
  ): Promise<ExchangeRate | null> {
    try {
      const { data } = await this.supabase
        .from('exchange_rates')
        .select('*')
        .eq('base_currency', baseCurrency)
        .eq('target_currency', targetCurrency)
        .order('valid_from', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        return {
          baseCurrency: data.base_currency,
          targetCurrency: data.target_currency,
          rate: parseFloat(data.rate),
          provider: data.provider,
          timestamp: new Date(data.valid_from),
          validUntil: new Date(data.valid_until),
        };
      }

      return null;

    } catch (error) {
      console.error('Historical exchange rate fetch error:', error);
      return null;
    }
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  /**
   * Get all supported currencies
   */
  async getSupportedCurrencies(): Promise<CurrencyInfo[]> {
    try {
      const { data, error } = await this.supabase
        .from('supported_currencies')
        .select('*')
        .eq('active', true)
        .order('code');

      if (error) throw error;

      return data.map(currency => ({
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
        decimalPlaces: currency.decimal_places,
        active: currency.active,
        primaryRegions: currency.primary_regions || [],
        paymentMethods: currency.payment_methods || [],
        stripeSupported: currency.stripe_supported,
      }));

    } catch (error) {
      console.error('Error fetching supported currencies:', error);
      throw new Error('Failed to fetch supported currencies');
    }
  }

  /**
   * Get currency information
   */
  async getCurrencyInfo(currencyCode: string): Promise<CurrencyInfo | null> {
    try {
      const { data } = await this.supabase
        .from('supported_currencies')
        .select('*')
        .eq('code', currencyCode.toUpperCase())
        .eq('active', true)
        .single();

      if (data) {
        return {
          code: data.code,
          name: data.name,
          symbol: data.symbol,
          decimalPlaces: data.decimal_places,
          active: data.active,
          primaryRegions: data.primary_regions || [],
          paymentMethods: data.payment_methods || [],
          stripeSupported: data.stripe_supported,
        };
      }

      return null;

    } catch (error) {
      console.error('Error fetching currency info:', error);
      return null;
    }
  }

  /**
   * Format amount according to currency
   */
  formatAmount(amount: number, currencyCode: string): string {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount / 100); // Convert from cents

    } catch (error) {
      // Fallback formatting
      return `${amount / 100} ${currencyCode}`;
    }
  }

  /**
   * Get exchange rate history for analytics
   */
  async getExchangeRateHistory(
    baseCurrency: string,
    targetCurrency: string,
    days: number = 30
  ): Promise<ExchangeRate[]> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const { data, error } = await this.supabase
        .from('exchange_rates')
        .select('*')
        .eq('base_currency', baseCurrency)
        .eq('target_currency', targetCurrency)
        .gte('valid_from', startDate.toISOString())
        .order('valid_from', { ascending: true });

      if (error) throw error;

      return data.map(rate => ({
        baseCurrency: rate.base_currency,
        targetCurrency: rate.target_currency,
        rate: parseFloat(rate.rate),
        provider: rate.provider,
        timestamp: new Date(rate.valid_from),
        validUntil: new Date(rate.valid_until),
      }));

    } catch (error) {
      console.error('Error fetching exchange rate history:', error);
      return [];
    }
  }

  /**
   * Clear expired rates from cache
   */
  clearExpiredCache(): void {
    const now = new Date();
    for (const [key, rate] of this.exchangeRateCache.entries()) {
      if (rate.validUntil <= now) {
        this.exchangeRateCache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const now = new Date();
    const totalEntries = this.exchangeRateCache.size;
    let validEntries = 0;
    let expiredEntries = 0;

    for (const rate of this.exchangeRateCache.values()) {
      if (rate.validUntil > now) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries,
      validEntries,
      expiredEntries,
      lastUpdate: this.lastCacheUpdate,
      providerFailures: Object.fromEntries(this.providerFailureCount),
    };
  }
}

// =============================================
// SINGLETON INSTANCE
// =============================================

const currencyManager = new CurrencyManager();
export default currencyManager;