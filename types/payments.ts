/**
 * EPIC 5 STORY 5.4: Payment System TypeScript Types
 * Comprehensive type definitions for the payment system
 */

// Stripe-related types
export interface StripeConfiguration {
  publishableKey: string;
  apiVersion: string;
  locale?: string;
  appearance?: {
    theme: 'stripe' | 'night' | 'flat';
    variables?: Record<string, string>;
  };
}

// Payment Method Types
export type PaymentMethodType = 'card' | 'apple_pay' | 'google_pay' | 'paypal' | 'ach' | 'bank_transfer';

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  name: string;
  description?: string;
  icon: React.ReactNode;
  available: boolean;
  fees?: string;
  processingTime?: string;
  recommended?: boolean;
  enterprise?: boolean;
}

export interface SavedPaymentMethod {
  id: string;
  type: PaymentMethodType;
  isDefault: boolean;
  // Card details (masked)
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  // Bank account details (masked)
  bankName?: string;
  accountLast4?: string;
  accountType?: 'checking' | 'savings';
  // PayPal details
  paypalEmail?: string;
  // Common fields
  billingDetails?: BillingDetails;
  createdAt: string;
  lastUsed?: string;
  status: 'active' | 'expired' | 'requires_action';
}

// Billing and Address Types
export interface BillingDetails {
  name?: string;
  email?: string;
  phone?: string;
  address?: Address;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

// Payment Intent Types
export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'succeeded' | 'canceled';
  clientSecret: string;
  customerId: string;
  paymentMethodId?: string;
  metadata?: Record<string, string>;
  created: number;
  lastPaymentError?: PaymentError;
}

export interface PaymentError {
  type: 'card_error' | 'validation_error' | 'api_error';
  code: string;
  message: string;
  declineCode?: string;
  param?: string;
}

// Subscription Types
export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  popular?: boolean;
  trial_days?: number;
  features: PlanFeature[];
  limits: PlanLimits;
  cta: string;
}

export interface PlanFeature {
  category: string;
  items: string[];
}

export interface PlanLimits {
  listings: number | 'unlimited';
  analytics: string;
  support: string;
  users: number | 'unlimited';
}

export interface Subscription {
  id: string;
  stripeSubscriptionId: string;
  customerId: string;
  planId: string;
  planName: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused' | 'incomplete' | 'incomplete_expired' | 'unpaid';
  price: number;
  currency: string;
  interval: 'month' | 'year';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  endedAt?: Date;
  features: string[];
  metadata?: Record<string, string>;
}

// Invoice Types
export interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: 'paid' | 'open' | 'void' | 'draft' | 'uncollectible';
  created: Date;
  dueDate?: Date;
  paidAt?: Date;
  description: string;
  downloadUrl?: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  tax?: number;
  total: number;
  customerId: string;
  subscriptionId?: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  amount: number;
  quantity: number;
  unitAmount: number;
  period?: {
    start: Date;
    end: Date;
  };
}

// Customer Types
export interface StripeCustomer {
  id: string;
  userId?: string;
  businessId?: string;
  stripeCustomerId: string;
  email: string;
  name?: string;
  phone?: string;
  billingAddress?: Address;
  shippingAddress?: Address;
  defaultPaymentMethod?: string;
  metadata?: Record<string, string>;
  created: Date;
  balance: number;
}

// Checkout Types
export interface CheckoutStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  current: boolean;
}

export interface CheckoutSession {
  id: string;
  clientSecret: string;
  customerId: string;
  planId?: string;
  amount: number;
  currency: string;
  paymentMethodTypes: PaymentMethodType[];
  status: 'open' | 'complete' | 'expired';
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

// Pricing Calculator Types
export interface CalculatorInputs {
  businessType: string;
  currentCustomers: number;
  averageOrderValue: number;
  conversionRate: number;
  marketingBudget: number;
  timeSpentMarketing: number;
  expectedGrowth: number;
}

export interface ROIProjection {
  planId: string;
  planName: string;
  currentMonthlyRevenue: number;
  newMonthlyRevenue: number;
  monthlyRevenueIncrease: number;
  annualRevenueIncrease: number;
  timeSavingsHours: number;
  annualTimeSavings: number;
  annualMarketingEfficiency: number;
  totalAnnualValue: number;
  annualPlanCost: number;
  roi: number;
  paybackPeriod: number;
  customerIncrease: number;
  conversionImprovement: number;
}

// Security Types
export interface SecurityCheckResult {
  isSecure: boolean;
  issues: string[];
  recommendations: string[];
}

export interface PaymentSecurityContext {
  securityCheck: SecurityCheckResult;
  isValidEnvironment: boolean;
  encryptionSupported: boolean;
  browserSupported: boolean;
  validateCardInput: (input: string) => boolean;
  sanitizeInput: (input: string) => string;
  checkCSP: () => boolean;
}

// Error Types
export interface PaymentErrorInfo {
  errorId: string;
  type: 'payment_error' | 'validation_error' | 'network_error' | 'system_error';
  message: string;
  code?: string;
  details?: Record<string, any>;
  timestamp: string;
  context?: {
    component: string;
    action: string;
    userId?: string;
    sessionId?: string;
  };
}

// API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  metadata?: {
    requestId: string;
    timestamp: string;
  };
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Webhook Types
export interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
    previous_attributes?: any;
  };
  created: number;
  livemode: boolean;
  pending_webhooks: number;
  request?: {
    id: string;
    idempotency_key?: string;
  };
}

// Component Props Types
export interface PaymentFormProps {
  clientSecret: string;
  onSuccess?: (paymentIntent: PaymentIntent) => void;
  onError?: (error: PaymentError) => void;
  onProcessing?: (processing: boolean) => void;
  amount: number;
  currency?: string;
  showBillingAddress?: boolean;
  showPaymentMethodSave?: boolean;
  className?: string;
}

export interface PaymentMethodSelectorProps {
  selectedMethod?: string;
  onMethodSelect: (methodId: string) => void;
  showEnterpriseMethods?: boolean;
  amount?: number;
  currency?: string;
  className?: string;
}

export interface CheckoutFormProps {
  plan: SubscriptionPlan;
  onSuccess?: (data: any) => void;
  onCancel?: () => void;
  onStepChange?: (step: string) => void;
  showGuestCheckout?: boolean;
  className?: string;
}

export interface PaymentMethodDisplayProps {
  paymentMethods: SavedPaymentMethod[];
  selectedMethodId?: string;
  onSelect?: (methodId: string) => void;
  onSetDefault?: (methodId: string) => void;
  onDelete?: (methodId: string) => void;
  onEdit?: (methodId: string) => void;
  onAddNew?: () => void;
  showActions?: boolean;
  selectable?: boolean;
  className?: string;
}

// Billing Dashboard Types
export interface BillingDashboardProps {
  className?: string;
}

export interface SubscriptionManagerProps {
  currentSubscription?: Subscription;
  onSubscriptionChange?: (subscription: Subscription) => void;
  className?: string;
}

export interface PaymentMethodManagerProps {
  onPaymentMethodsChange?: (methods: SavedPaymentMethod[]) => void;
  className?: string;
}

export interface InvoiceHistoryProps {
  limit?: number;
  showSearch?: boolean;
  showFilters?: boolean;
  className?: string;
}

// Pricing Components Types
export interface PricingCardProps {
  plan: SubscriptionPlan;
  billingCycle: 'monthly' | 'yearly';
  onSelect: () => void;
  loading?: boolean;
  className?: string;
}

export interface PricingComparisonProps {
  plans: SubscriptionPlan[];
  billingCycle: 'monthly' | 'yearly';
  onPlanSelect: (planId: string) => void;
  className?: string;
}

export interface PricingCalculatorProps {
  plans: SubscriptionPlan[];
  onPlanSelect: (planId: string) => void;
  className?: string;
}

// Validation Types
export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

export interface CardValidation {
  number: ValidationResult;
  expiry: ValidationResult;
  cvc: ValidationResult;
  name: ValidationResult;
  postalCode: ValidationResult;
}

// Event Types
export interface PaymentEvent {
  type: 'payment_started' | 'payment_succeeded' | 'payment_failed' | 'payment_canceled';
  data: {
    amount: number;
    currency: string;
    paymentMethodType: PaymentMethodType;
    timestamp: number;
    metadata?: Record<string, any>;
  };
}

export interface SubscriptionEvent {
  type: 'subscription_created' | 'subscription_updated' | 'subscription_canceled' | 'subscription_reactivated';
  data: {
    subscriptionId: string;
    planId: string;
    timestamp: number;
    metadata?: Record<string, any>;
  };
}