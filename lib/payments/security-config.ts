/**
 * EPIC 5 STORY 5.1: Stripe Integration & Payment Infrastructure
 * Security Configuration - PCI DSS compliant security settings
 * 
 * Centralizes all payment security configurations, environment variables,
 * and compliance settings for the payment infrastructure.
 */

// =============================================
// ENVIRONMENT VALIDATION
// =============================================

const requiredEnvVars = [
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
];

const optionalEnvVars = [
  'STRIPE_WEBHOOK_SECRET_CONNECT',
  'STRIPE_CLIENT_ID',
  'PAYMENT_SUCCESS_URL',
  'PAYMENT_CANCEL_URL'
];

// Validate required environment variables
function validateEnvironment(): void {
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for payment processing: ${missing.join(', ')}\n` +
      'Please ensure all payment-related environment variables are properly configured.'
    );
  }

  // Validate Stripe key format
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY!;
  const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY!;
  
  if (!stripeSecretKey.startsWith('sk_')) {
    throw new Error('Invalid Stripe secret key format. Must start with "sk_"');
  }
  
  if (!stripePublishableKey.startsWith('pk_')) {
    throw new Error('Invalid Stripe publishable key format. Must start with "pk_"');
  }

  // Check if we're in test mode vs live mode
  const isTestMode = stripeSecretKey.includes('_test_');
  const isLiveMode = stripeSecretKey.includes('_live_');
  
  if (!isTestMode && !isLiveMode) {
    throw new Error('Invalid Stripe key format. Unable to determine test/live mode');
  }

  // Warn if using test keys in production
  if (process.env.NODE_ENV === 'production' && isTestMode) {
    console.warn('⚠️  WARNING: Using Stripe test keys in production environment!');
  }

  // Warn if using live keys in development
  if (process.env.NODE_ENV === 'development' && isLiveMode) {
    console.warn('⚠️  WARNING: Using Stripe live keys in development environment!');
  }
}

// Run validation on import
if (typeof window === 'undefined') {
  validateEnvironment();
}

// =============================================
// SECURITY CONFIGURATION
// =============================================

export const SECURITY_CONFIG = {
  // Rate limiting settings
  RATE_LIMITS: {
    PAYMENT_API: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 50, // 50 requests per window
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    },
    WEBHOOK_API: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100, // 100 webhooks per minute
      skipSuccessfulRequests: true,
      skipFailedRequests: false,
    },
    CUSTOMER_API: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 20, // 20 customer operations per minute
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    },
    SUBSCRIPTION_API: {
      windowMs: 5 * 60 * 1000, // 5 minutes
      maxRequests: 10, // 10 subscription operations per 5 minutes
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    }
  },

  // Payment validation limits
  PAYMENT_LIMITS: {
    MIN_AMOUNT: 50, // $0.50 minimum
    MAX_AMOUNT: 999999999, // $9,999,999.99 maximum
    SUPPORTED_CURRENCIES: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'],
    MAX_DESCRIPTION_LENGTH: 500,
    MAX_METADATA_ENTRIES: 20,
    MAX_METADATA_KEY_LENGTH: 40,
    MAX_METADATA_VALUE_LENGTH: 500,
  },

  // Customer validation limits
  CUSTOMER_LIMITS: {
    MAX_NAME_LENGTH: 255,
    MAX_EMAIL_LENGTH: 255,
    MAX_PHONE_LENGTH: 50,
    MAX_ADDRESS_LINE_LENGTH: 100,
    MAX_CITY_LENGTH: 100,
    MAX_STATE_LENGTH: 100,
    MAX_POSTAL_CODE_LENGTH: 20,
    SUPPORTED_COUNTRIES: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'JP'],
  },

  // Security headers
  SECURITY_HEADERS: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self' https://api.stripe.com https://js.stripe.com; script-src 'self' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline'",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  },

  // Audit logging configuration
  AUDIT_CONFIG: {
    ENABLED: true,
    LOG_SUCCESS: true,
    LOG_FAILURES: true,
    RETENTION_DAYS: 2555, // 7 years for PCI compliance
    SENSITIVE_FIELDS: [
      'card_number',
      'cvc',
      'ssn',
      'tax_id',
      'bank_account',
      'routing_number'
    ],
  },

  // Webhook security
  WEBHOOK_CONFIG: {
    TOLERANCE: 300, // 5 minutes tolerance for webhook timestamps
    REQUIRED_HEADERS: ['stripe-signature'],
    IP_WHITELIST_ENABLED: true,
    RETRY_CONFIG: {
      MAX_RETRIES: 3,
      INITIAL_DELAY: 1000, // 1 second
      MAX_DELAY: 30000, // 30 seconds
      EXPONENTIAL_BASE: 2,
    },
  },

  // Session and token security
  SESSION_CONFIG: {
    TOKEN_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours
    REFRESH_THRESHOLD: 60 * 60 * 1000, // 1 hour before expiry
    MAX_CONCURRENT_SESSIONS: 3,
    REQUIRE_FRESH_LOGIN_FOR_PAYMENTS: true,
    PAYMENT_SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  },

  // PCI DSS compliance settings
  PCI_COMPLIANCE: {
    ENCRYPTION_ALGORITHM: 'aes-256-gcm',
    KEY_ROTATION_DAYS: 90,
    AUDIT_LOG_ENCRYPTION: true,
    DATA_RETENTION_POLICY: {
      PAYMENT_DATA: 2555, // 7 years
      AUDIT_LOGS: 2555, // 7 years
      SESSION_DATA: 90, // 3 months
      TEMP_DATA: 1, // 1 day
    },
    REQUIRED_COMPLIANCE_CHECKS: [
      'firewall_protection',
      'default_passwords_changed',
      'cardholder_data_protection',
      'encrypted_transmission',
      'antivirus_software',
      'secure_systems',
      'access_control',
      'unique_user_ids',
      'physical_access_restriction',
      'network_monitoring',
      'regular_security_testing',
      'security_policy_maintenance'
    ],
  }
};

// =============================================
// STRIPE CONFIGURATION
// =============================================

export const STRIPE_CONFIG = {
  // API Configuration
  API: {
    VERSION: '2024-06-20' as const,
    TIMEOUT: 30000, // 30 seconds
    MAX_RETRIES: 3,
    TELEMETRY: false, // Disabled for security
  },

  // Supported payment methods
  PAYMENT_METHODS: {
    CARDS: ['visa', 'mastercard', 'amex', 'discover', 'diners', 'jcb'],
    DIGITAL_WALLETS: ['apple_pay', 'google_pay', 'samsung_pay'],
    BANK_TRANSFERS: ['ach_debit', 'sepa_debit'],
    BUY_NOW_PAY_LATER: ['klarna', 'afterpay_clearpay'],
  },

  // Features configuration
  FEATURES: {
    SETUP_FUTURE_USAGE: true,
    SAVE_PAYMENT_METHOD: true,
    AUTOMATIC_CONFIRMATION: true,
    CAPTURE_METHOD: 'automatic' as const,
    CONFIRM_PAYMENT_INTENT: true,
    USE_STRIPE_SDK: true,
    ENABLE_PAYMENT_ELEMENT: true,
  },

  // Subscription configuration
  SUBSCRIPTIONS: {
    DEFAULT_COLLECTION_METHOD: 'charge_automatically' as const,
    PRORATION_BEHAVIOR: 'create_prorations' as const,
    PAYMENT_BEHAVIOR: 'default_incomplete' as const,
    BILLING_CYCLE_ANCHOR: 'now' as const,
    DEFAULT_TRIAL_DAYS: 14,
  },

  // International settings
  INTERNATIONAL: {
    DEFAULT_CURRENCY: 'USD',
    SUPPORTED_LOCALES: ['en', 'es', 'fr', 'de', 'it', 'ja', 'zh'],
    TAX_CALCULATION: true,
    CURRENCY_CONVERSION: true,
  }
};

// =============================================
// ENVIRONMENT-SPECIFIC CONFIGURATION
// =============================================

export const ENV_CONFIG = {
  // Environment detection
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_TEST: process.env.NODE_ENV === 'test',

  // Stripe environment
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY!,
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY!,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET!,
  STRIPE_WEBHOOK_SECRET_CONNECT: process.env.STRIPE_WEBHOOK_SECRET_CONNECT,
  STRIPE_CLIENT_ID: process.env.STRIPE_CLIENT_ID,

  // URLs
  BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
  PAYMENT_SUCCESS_URL: process.env.PAYMENT_SUCCESS_URL || '/payment/success',
  PAYMENT_CANCEL_URL: process.env.PAYMENT_CANCEL_URL || '/payment/cancel',

  // Database
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,

  // Feature flags
  ENABLE_WEBHOOKS: process.env.ENABLE_PAYMENT_WEBHOOKS !== 'false',
  ENABLE_ANALYTICS: process.env.ENABLE_PAYMENT_ANALYTICS !== 'false',
  ENABLE_AUDIT_LOGGING: process.env.ENABLE_PAYMENT_AUDIT_LOGGING !== 'false',
  STRICT_SSL: process.env.NODE_ENV === 'production',
};

// =============================================
// VALIDATION FUNCTIONS
// =============================================

export function validateAmount(amount: number, currency: string = 'USD'): boolean {
  if (typeof amount !== 'number' || !Number.isInteger(amount)) {
    return false;
  }

  return amount >= SECURITY_CONFIG.PAYMENT_LIMITS.MIN_AMOUNT && 
         amount <= SECURITY_CONFIG.PAYMENT_LIMITS.MAX_AMOUNT;
}

export function validateCurrency(currency: string): boolean {
  return SECURITY_CONFIG.PAYMENT_LIMITS.SUPPORTED_CURRENCIES.includes(currency.toUpperCase());
}

export function validateCountry(country: string): boolean {
  return SECURITY_CONFIG.CUSTOMER_LIMITS.SUPPORTED_COUNTRIES.includes(country.toUpperCase());
}

export function sanitizeMetadata(metadata: Record<string, any>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  const entries = Object.entries(metadata || {});

  // Limit number of entries
  const limitedEntries = entries.slice(0, SECURITY_CONFIG.PAYMENT_LIMITS.MAX_METADATA_ENTRIES);

  for (const [key, value] of limitedEntries) {
    // Validate and truncate key
    const sanitizedKey = String(key)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, SECURITY_CONFIG.PAYMENT_LIMITS.MAX_METADATA_KEY_LENGTH);

    // Validate and truncate value
    const sanitizedValue = String(value || '')
      .slice(0, SECURITY_CONFIG.PAYMENT_LIMITS.MAX_METADATA_VALUE_LENGTH);

    if (sanitizedKey && sanitizedValue) {
      sanitized[sanitizedKey] = sanitizedValue;
    }
  }

  return sanitized;
}

export function maskSensitiveData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const masked = { ...data };
  const sensitiveFields = SECURITY_CONFIG.AUDIT_CONFIG.SENSITIVE_FIELDS;

  for (const field of sensitiveFields) {
    if (field in masked) {
      if (typeof masked[field] === 'string' && masked[field].length > 4) {
        masked[field] = '****' + masked[field].slice(-4);
      } else {
        masked[field] = '****';
      }
    }
  }

  return masked;
}

// =============================================
// SECURITY UTILITIES
// =============================================

export function generateSecureHeaders(): Record<string, string> {
  return {
    ...SECURITY_CONFIG.SECURITY_HEADERS,
    'X-Request-ID': generateRequestId(),
    'X-Timestamp': new Date().toISOString(),
  };
}

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function isValidStripeId(id: string, type: string): boolean {
  const patterns = {
    customer: /^cus_[a-zA-Z0-9]{14,}$/,
    payment_intent: /^pi_[a-zA-Z0-9]{14,}$/,
    payment_method: /^pm_[a-zA-Z0-9]{14,}$/,
    subscription: /^sub_[a-zA-Z0-9]{14,}$/,
    invoice: /^in_[a-zA-Z0-9]{14,}$/,
    price: /^price_[a-zA-Z0-9]{14,}$/,
    product: /^prod_[a-zA-Z0-9]{14,}$/,
  };

  const pattern = patterns[type as keyof typeof patterns];
  return pattern ? pattern.test(id) : false;
}

// =============================================
// EXPORT CONFIGURATION OBJECT
// =============================================

export default {
  SECURITY: SECURITY_CONFIG,
  STRIPE: STRIPE_CONFIG,
  ENV: ENV_CONFIG,
  validate: {
    amount: validateAmount,
    currency: validateCurrency,
    country: validateCountry,
    stripeId: isValidStripeId,
  },
  utils: {
    sanitizeMetadata,
    maskSensitiveData,
    generateSecureHeaders,
    generateRequestId,
  }
};