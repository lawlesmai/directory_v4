/**
 * EPIC 5 STORY 5.2: Subscription Management & Billing System Tests
 * Billing Service Tests
 * 
 * Comprehensive test suite for billing automation and invoice management
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import billingService from '@/lib/payments/billing-service';
import stripeService from '@/lib/payments/stripe-service';

// Mock dependencies
jest.mock('@/lib/payments/stripe-service');
jest.mock('@/lib/supabase/server');

const mockStripeService = stripeService as jest.Mocked<typeof stripeService>;

// Mock data
const mockCustomer = {
  id: 'cust_123',
  stripeCustomerId: 'cus_stripe123',
  email: 'test@example.com',
  name: 'Test User',
};

const mockInvoice = {
  id: 'inv_123',
  stripe_invoice_id: 'in_stripe123',
  customer_id: 'cust_123',
  subscription_id: 'sub_123',
  status: 'open',
  amount_due: 7900,
  amount_paid: 0,
  amount_remaining: 7900,
  subtotal: 7900,
  tax: 0,
  total: 7900,
  currency: 'USD',
  due_date: null,
  paid_at: null,
  invoice_pdf: null,
  hosted_invoice_url: 'https://invoice.stripe.com/i/123',
  receipt_number: null,
  finalized_at: new Date().toISOString(),
  metadata: {},
};

const mockStripeInvoice = {
  id: 'in_stripe123',
  status: 'open',
  amount_due: 7900,
  amount_paid: 0,
  amount_remaining: 7900,
  subtotal: 7900,
  tax: 0,
  total: 7900,
  currency: 'usd',
  due_date: null,
  auto_advance: true,
  billing_reason: 'subscription_cycle',
  collection_method: 'charge_automatically',
  invoice_pdf: 'https://pay.stripe.com/invoice/123/pdf',
  hosted_invoice_url: 'https://invoice.stripe.com/i/123',
  created: Math.floor(Date.now() / 1000),
  lines: {
    data: [
      {
        id: 'il_123',
        description: 'Professional Plan',
        amount: 7900,
        quantity: 1,
        period: {
          start: Math.floor(Date.now() / 1000),
          end: Math.floor(Date.now() / 1000) + 2592000, // +30 days
        },
      },
    ],
  },
};

const mockFailedInvoice = {
  ...mockInvoice,
  status: 'open',
  attempt_count: 1,
  next_payment_attempt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
  customer: mockCustomer,
  subscription: {
    id: 'sub_123',
    stripe_subscription_id: 'sub_stripe123',
  },
};

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: mockInvoice, error: null }),
        lt: jest.fn().mockResolvedValue({ data: [mockFailedInvoice], error: null }),
      }),
      in: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          range: jest.fn().mockResolvedValue({ data: [mockInvoice], error: null }),
        }),
      }),
      count: jest.fn().mockResolvedValue({ count: 1 }),
    }),
    insert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: mockInvoice, error: null }),
      }),
    }),
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockInvoice, error: null }),
        }),
      }),
    }),
  }),
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

describe('Billing Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Stripe service methods
    mockStripeService.getCustomer = jest.fn().mockResolvedValue(mockCustomer);
    mockStripeService.getStripeInstance = jest.fn().mockReturnValue({
      invoices: {
        create: jest.fn().mockResolvedValue(mockStripeInvoice),
        finalizeInvoice: jest.fn().mockResolvedValue(mockStripeInvoice),
        retrieve: jest.fn().mockResolvedValue(mockStripeInvoice),
        pay: jest.fn().mockResolvedValue({ ...mockStripeInvoice, status: 'paid', amount_paid: 7900 }),
        sendInvoice: jest.fn().mockResolvedValue(mockStripeInvoice),
      },
      invoiceItems: {
        create: jest.fn().mockResolvedValue({
          id: 'ii_123',
          amount: 1000,
          currency: 'usd',
        }),
      },
      refunds: {
        create: jest.fn().mockResolvedValue({
          id: 'refund_123',
          amount: 1000,
          currency: 'usd',
          status: 'succeeded',
          reason: 'requested_by_customer',
          receipt_number: 'receipt_123',
          metadata: {},
        }),
      },
      taxRates: {
        list: jest.fn().mockResolvedValue({
          data: [{ id: 'txr_123', percentage: 8.5 }],
        }),
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createInvoice', () => {
    it('should successfully create and finalize an invoice', async () => {
      const invoiceData = {
        customerId: 'cust_123',
        description: 'Monthly subscription',
        currency: 'USD',
        autoAdvance: true,
        collectionMethod: 'charge_automatically',
      };

      const result = await billingService.createInvoice(invoiceData);

      expect(result).toMatchObject({
        id: 'inv_123',
        stripeInvoiceId: 'in_stripe123',
        customerId: 'cust_123',
        status: 'open',
        amountDue: 7900,
        total: 7900,
        currency: 'USD',
      });

      expect(mockStripeService.getCustomer).toHaveBeenCalledWith('cust_123');
      expect(mockStripeService.getStripeInstance().invoices.create).toHaveBeenCalled();
      expect(mockStripeService.getStripeInstance().invoices.finalizeInvoice).toHaveBeenCalled();
      expect(mockSupabase.from).toHaveBeenCalledWith('invoices');
    });

    it('should handle customer not found error', async () => {
      mockStripeService.getCustomer = jest.fn().mockResolvedValue(null);

      const invoiceData = {
        customerId: 'invalid_customer',
      };

      await expect(billingService.createInvoice(invoiceData))
        .rejects.toThrow('Customer not found');
    });

    it('should create invoice with subscription', async () => {
      const invoiceData = {
        customerId: 'cust_123',
        subscriptionId: 'sub_123',
      };

      // Mock getting Stripe subscription ID
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: { stripe_subscription_id: 'sub_stripe123' }, 
              error: null 
            }),
          }),
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockInvoice, error: null }),
          }),
        }),
      });

      await billingService.createInvoice(invoiceData);

      expect(mockStripeService.getStripeInstance().invoices.create)
        .toHaveBeenCalledWith(expect.objectContaining({
          subscription: 'sub_stripe123',
        }));
    });
  });

  describe('addInvoiceItem', () => {
    it('should successfully add line item to invoice', async () => {
      const itemData = {
        customerId: 'cust_123',
        amount: 1000,
        currency: 'USD',
        description: 'Additional service',
        quantity: 1,
      };

      await billingService.addInvoiceItem(itemData);

      expect(mockStripeService.getCustomer).toHaveBeenCalledWith('cust_123');
      expect(mockStripeService.getStripeInstance().invoiceItems.create)
        .toHaveBeenCalledWith(expect.objectContaining({
          customer: 'cus_stripe123',
          amount: 1000,
          currency: 'USD',
          description: 'Additional service',
          quantity: 1,
        }));
    });
  });

  describe('getInvoiceDetails', () => {
    it('should retrieve invoice with full details', async () => {
      const mockInvoiceWithCustomer = {
        ...mockInvoice,
        customer: mockCustomer,
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: mockInvoiceWithCustomer, 
              error: null 
            }),
          }),
        }),
      });

      const result = await billingService.getInvoiceDetails('inv_123');

      expect(result).toMatchObject({
        id: 'inv_123',
        stripeInvoiceId: 'in_stripe123',
        customerId: 'cust_123',
        status: 'open',
        customer: expect.objectContaining({
          email: 'test@example.com',
        }),
        lineItems: expect.arrayContaining([
          expect.objectContaining({
            description: 'Professional Plan',
            amount: 7900,
          }),
        ]),
      });

      expect(mockStripeService.getStripeInstance().invoices.retrieve)
        .toHaveBeenCalledWith('in_stripe123', { expand: ['lines'] });
    });

    it('should return null for non-existent invoice', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const result = await billingService.getInvoiceDetails('invalid_invoice');

      expect(result).toBeNull();
    });
  });

  describe('getCustomerInvoices', () => {
    it('should retrieve paginated customer invoices', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockImplementation((query) => {
          if (query.includes('count')) {
            return {
              eq: jest.fn().mockReturnValue({
                count: jest.fn().mockResolvedValue({ count: 1 }),
              }),
            };
          }
          return {
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                range: jest.fn().mockResolvedValue({ 
                  data: [{ ...mockInvoice, customer: mockCustomer }], 
                  error: null 
                }),
              }),
            }),
          };
        }),
      });

      const result = await billingService.getCustomerInvoices('cust_123', 1, 10);

      expect(result.invoices).toHaveLength(1);
      expect(result.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });
  });

  describe('processFailedPayments', () => {
    it('should successfully process failed payments with retry logic', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lt: jest.fn().mockResolvedValue({ 
              data: [mockFailedInvoice], 
              error: null 
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({}),
        }),
      });

      const result = await billingService.processFailedPayments();

      expect(result).toMatchObject({
        processedSubscriptions: 1,
        successfulBillings: 1,
        failedBillings: 0,
        retryScheduled: 0,
        errors: [],
      });

      expect(mockStripeService.getStripeInstance().invoices.pay)
        .toHaveBeenCalledWith('in_stripe123');
    });

    it('should handle failed payment retry with scheduling', async () => {
      // Mock failed retry
      mockStripeService.getStripeInstance().invoices.pay = jest.fn()
        .mockRejectedValue(new Error('Payment failed'));

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lt: jest.fn().mockResolvedValue({ 
              data: [{ ...mockFailedInvoice, attempt_count: 0 }], 
              error: null 
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({}),
        }),
      });

      const result = await billingService.processFailedPayments();

      expect(result.failedBillings).toBe(1);
      expect(result.retryScheduled).toBe(1);
    });

    it('should apply grace period after max retries', async () => {
      const maxRetriesFailedInvoice = {
        ...mockFailedInvoice,
        attempt_count: 3,
      };

      mockStripeService.getStripeInstance().invoices.pay = jest.fn()
        .mockRejectedValue(new Error('Payment failed'));

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lt: jest.fn().mockResolvedValue({ 
              data: [maxRetriesFailedInvoice], 
              error: null 
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({}),
        }),
      });

      const result = await billingService.processFailedPayments();

      expect(result.failedBillings).toBe(1);
      expect(result.retryScheduled).toBe(0);
    });
  });

  describe('retryInvoicePayment', () => {
    it('should successfully retry invoice payment', async () => {
      const result = await billingService.retryInvoicePayment('in_stripe123');

      expect(result).toMatchObject({
        success: true,
        amountPaid: 7900,
      });

      expect(mockStripeService.getStripeInstance().invoices.pay)
        .toHaveBeenCalledWith('in_stripe123');
    });

    it('should handle payment retry failure', async () => {
      mockStripeService.getStripeInstance().invoices.pay = jest.fn()
        .mockRejectedValue(new Error('Payment method declined'));

      const result = await billingService.retryInvoicePayment('in_stripe123');

      expect(result).toMatchObject({
        success: false,
        amountPaid: 0,
        error: 'Payment method declined',
      });
    });
  });

  describe('suspendOverdueSubscriptions', () => {
    it('should suspend subscriptions past grace period', async () => {
      const overdueSubscription = {
        id: 'sub_123',
        stripe_subscription_id: 'sub_stripe123',
        status: 'past_due',
        metadata: {
          grace_period_end: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        },
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            filter: jest.fn().mockResolvedValue({ 
              data: [overdueSubscription], 
              error: null 
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({}),
        }),
      });

      mockStripeService.getStripeInstance().subscriptions = {
        update: jest.fn().mockResolvedValue({}),
      };

      const suspendedCount = await billingService.suspendOverdueSubscriptions();

      expect(suspendedCount).toBe(1);
      expect(mockStripeService.getStripeInstance().subscriptions.update)
        .toHaveBeenCalledWith('sub_stripe123', {
          pause_collection: { behavior: 'void' },
        });
    });
  });

  describe('processRefund', () => {
    it('should successfully process refund', async () => {
      const mockTransaction = {
        id: 'txn_123',
        stripe_charge_id: 'ch_123',
        status: 'succeeded',
        refund_amount: 0,
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: mockTransaction, 
              error: null 
            }),
          }),
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: { id: 'refund_123' }, 
              error: null 
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({}),
        }),
      });

      const refundData = {
        paymentTransactionId: 'txn_123',
        reason: 'requested_by_customer' as const,
      };

      const result = await billingService.processRefund(refundData);

      expect(result.id).toBe('refund_123');
      expect(mockStripeService.getStripeInstance().refunds.create)
        .toHaveBeenCalledWith(expect.objectContaining({
          charge: 'ch_123',
          reason: 'requested_by_customer',
        }));
    });

    it('should reject refund for unsuccessful payment', async () => {
      const unsuccessfulTransaction = {
        id: 'txn_123',
        stripe_charge_id: 'ch_123',
        status: 'failed',
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: unsuccessfulTransaction, 
              error: null 
            }),
          }),
        }),
      });

      await expect(billingService.processRefund({
        paymentTransactionId: 'txn_123',
        reason: 'requested_by_customer',
      })).rejects.toThrow('Cannot refund unsuccessful payment');
    });
  });

  describe('calculateTax', () => {
    it('should calculate tax for US customers', async () => {
      const customerWithAddress = {
        ...mockCustomer,
        billingAddress: { country: 'US', state: 'CA' },
      };

      mockStripeService.getCustomer = jest.fn().mockResolvedValue(customerWithAddress);

      const tax = await billingService.calculateTax('cust_123', 10000, 'USD');

      expect(tax).toBe(850); // 8.5% of $100.00
    });

    it('should return zero tax for customers without billing address', async () => {
      const customerWithoutAddress = {
        ...mockCustomer,
        billingAddress: null,
      };

      mockStripeService.getCustomer = jest.fn().mockResolvedValue(customerWithoutAddress);

      const tax = await billingService.calculateTax('cust_123', 10000, 'USD');

      expect(tax).toBe(0);
    });
  });

  describe('sendInvoiceByEmail', () => {
    it('should successfully send invoice by email', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: { stripe_invoice_id: 'in_stripe123' }, 
              error: null 
            }),
          }),
        }),
      });

      await billingService.sendInvoiceByEmail('inv_123');

      expect(mockStripeService.getStripeInstance().invoices.sendInvoice)
        .toHaveBeenCalledWith('in_stripe123');
    });
  });

  describe('generateInvoicePdf', () => {
    it('should generate and return PDF URL', async () => {
      const invoiceWithPdf = {
        stripe_invoice_id: 'in_stripe123',
        invoice_pdf: null,
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: invoiceWithPdf, 
              error: null 
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({}),
        }),
      });

      const pdfUrl = await billingService.generateInvoicePdf('inv_123');

      expect(pdfUrl).toBe('https://pay.stripe.com/invoice/123/pdf');
      expect(mockStripeService.getStripeInstance().invoices.retrieve)
        .toHaveBeenCalledWith('in_stripe123');
    });

    it('should return cached PDF URL if available', async () => {
      const invoiceWithCachedPdf = {
        stripe_invoice_id: 'in_stripe123',
        invoice_pdf: 'https://cached-pdf-url.com',
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: invoiceWithCachedPdf, 
              error: null 
            }),
          }),
        }),
      });

      const pdfUrl = await billingService.generateInvoicePdf('inv_123');

      expect(pdfUrl).toBe('https://cached-pdf-url.com');
      expect(mockStripeService.getStripeInstance().invoices.retrieve)
        .not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle Stripe API errors gracefully', async () => {
      const stripeError = new Error('Stripe API Error');
      mockStripeService.getStripeInstance().invoices.create = jest.fn().mockRejectedValue(stripeError);

      await expect(billingService.createInvoice({
        customerId: 'cust_123',
      })).rejects.toThrow('Failed to create invoice');
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: null, 
              error: { message: 'Database connection failed' }
            }),
          }),
        }),
      });

      await expect(billingService.createInvoice({
        customerId: 'cust_123',
      })).rejects.toThrow('Failed to create invoice');
    });
  });

  describe('Grace Period Management', () => {
    it('should apply grace period for failed payments', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: { id: 'sub_123', metadata: {} }, 
              error: null 
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({}),
        }),
      });

      await billingService['applyGracePeriodOrSuspend']('sub_123', {
        maxRetries: 3,
        retryIntervals: [24, 72, 168],
        gracePeriodDays: 3,
        suspensionDays: 10,
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('subscriptions');
    });

    it('should remove grace period after successful payment', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: { 
                id: 'sub_123', 
                metadata: { 
                  grace_period_end: '2024-02-01T00:00:00Z',
                  payment_failed: true
                } 
              }, 
              error: null 
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({}),
        }),
      });

      await billingService['removeGracePeriod']('sub_123');

      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        status: 'active',
        metadata: {},
      });
    });
  });
});