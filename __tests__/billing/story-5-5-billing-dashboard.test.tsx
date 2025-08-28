/**
 * EPIC 5 STORY 5.5: Billing Dashboard & Payment Management Tests
 * Comprehensive test suite for billing dashboard functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BillingOverview } from '@/components/billing/BillingOverview';
import { PaymentMethodManager } from '@/components/billing/PaymentMethodManager';
import { InvoiceManager } from '@/components/billing/InvoiceManager';
import { SubscriptionControls } from '@/components/billing/SubscriptionControls';
import { UsageAnalytics } from '@/components/billing/UsageAnalytics';
import { BillingNotifications } from '@/components/billing/BillingNotifications';

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}));

describe('Story 5.5: Billing Dashboard & Payment Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================
  // BILLING OVERVIEW TESTS
  // =============================================

  describe('BillingOverview Component', () => {
    const mockBillingData = {
      billingStatus: {
        isActive: true,
        nextBillingDate: new Date('2025-09-28'),
        daysUntilBilling: 31,
        currentAmount: 4900,
        currency: 'usd',
        status: 'active',
        cancelAtPeriodEnd: false,
      },
      usageMetrics: [
        {
          name: 'Business Listings',
          current: 3,
          limit: 10,
          unit: 'listings',
          percentage: 30,
          isNearLimit: false,
          isOverLimit: false,
        },
      ],
      paymentMethodHealth: [
        {
          id: 'pm_test123',
          type: 'card',
          last4: '4242',
          brand: 'visa',
          isDefault: true,
          isExpiring: false,
          hasIssues: false,
        },
      ],
      recentAlerts: [],
    };

    it('displays billing overview with subscription status', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBillingData),
      });

      await act(async () => {
        render(<BillingOverview />);
      });

      await waitFor(() => {
        expect(screen.getByText('Billing Overview')).toBeInTheDocument();
      });

      // Check if billing status is displayed
      expect(screen.getByText('Current Billing Status')).toBeInTheDocument();
      // Format date the same way as component does
      const expectedDate = new Date('2025-09-28').toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      expect(screen.getByText(expectedDate)).toBeInTheDocument();
      expect(screen.getByText('$49.00')).toBeInTheDocument();
    });

    it('displays usage metrics with progress bars', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBillingData),
      });

      await act(async () => {
        render(<BillingOverview />);
      });

      await waitFor(() => {
        expect(screen.getByText('Usage Overview')).toBeInTheDocument();
      });

      expect(screen.getByText('Business Listings')).toBeInTheDocument();
      expect(screen.getByText('3 / 10 listings')).toBeInTheDocument();
    });

    it('shows payment method health indicators', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBillingData),
      });

      await act(async () => {
        render(<BillingOverview />);
      });

      await waitFor(() => {
        expect(screen.getByText('Payment Method Status')).toBeInTheDocument();
      });

      expect(screen.getByText('•••• 4242 VISA')).toBeInTheDocument();
    });

    it('handles quick actions correctly', async () => {
      const mockOnQuickAction = jest.fn();
      
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBillingData),
      });

      await act(async () => {
        render(<BillingOverview onQuickAction={mockOnQuickAction} />);
      });

      await waitFor(() => {
        expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      });

      // Click add card button
      const addCardButton = screen.getByRole('button', { name: /add card/i });
      await act(async () => {
        fireEvent.click(addCardButton);
      });

      expect(mockOnQuickAction).toHaveBeenCalledWith('add-payment-method');
    });
  });

  // =============================================
  // PAYMENT METHOD MANAGER TESTS
  // =============================================

  describe('PaymentMethodManager Component', () => {
    const mockPaymentMethods = [
      {
        id: 'pm_test123',
        type: 'card',
        last4: '4242',
        brand: 'visa',
        isDefault: true,
        isExpiring: false,
        hasDeclineHistory: false,
        createdAt: new Date('2025-08-01'),
      },
    ];

    it('displays payment methods list', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPaymentMethods),
      });

      await act(async () => {
        render(<PaymentMethodManager />);
      });

      await waitFor(() => {
        expect(screen.getByText('Payment Methods')).toBeInTheDocument();
      });

      expect(screen.getByText('•••• 4242')).toBeInTheDocument();
      expect(screen.getAllByText('VISA')).toHaveLength(2); // Header and card display
      expect(screen.getByText('Default')).toBeInTheDocument();
    });

    it('opens add payment method modal', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPaymentMethods),
      });

      await act(async () => {
        render(<PaymentMethodManager />);
      });

      await waitFor(() => {
        expect(screen.getByText('Payment Methods')).toBeInTheDocument();
      });

      // Click add payment method button
      const addButton = screen.getByRole('button', { name: /add payment method/i });
      await act(async () => {
        fireEvent.click(addButton);
      });

      expect(screen.getByText('Add Payment Method')).toBeInTheDocument();
      expect(screen.getByText('Add a secure payment method for your subscription billing.')).toBeInTheDocument();
    });

    it('handles payment method deletion', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPaymentMethods),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        });

      await act(async () => {
        render(<PaymentMethodManager />);
      });

      await waitFor(() => {
        expect(screen.getByText('Payment Methods')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await act(async () => {
        fireEvent.click(deleteButton);
      });

      expect(screen.getByText('Delete Payment Method')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to delete this payment method?')).toBeInTheDocument();
    });
  });

  // =============================================
  // INVOICE MANAGER TESTS
  // =============================================

  describe('InvoiceManager Component', () => {
    const mockInvoices = [
      {
        id: 'in_test123',
        invoiceNumber: 'INV-001',
        amount: 4900,
        currency: 'usd',
        status: 'paid',
        createdAt: new Date('2025-08-01'),
        description: 'Premium Plan - August 2025',
        subtotal: 4900,
        lineItems: [
          {
            description: 'Premium Plan',
            amount: 4900,
            quantity: 1,
            period: {
              start: new Date('2025-08-01'),
              end: new Date('2025-08-31'),
            },
          },
        ],
      },
    ];

    it('displays invoice history', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInvoices),
      });

      await act(async () => {
        render(<InvoiceManager />);
      });

      await waitFor(() => {
        expect(screen.getByText('Invoices & Payment History')).toBeInTheDocument();
      });

      expect(screen.getByText('INV-001')).toBeInTheDocument();
      expect(screen.getByText('$49.00')).toBeInTheDocument();
      expect(screen.getByText('Paid')).toBeInTheDocument();
    });

    it('filters invoices by status', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInvoices),
      });

      await act(async () => {
        render(<InvoiceManager />);
      });

      await waitFor(() => {
        expect(screen.getByText('Invoices & Payment History')).toBeInTheDocument();
      });

      // Find and interact with status filter
      const statusFilter = screen.getByRole('combobox');
      await act(async () => {
        fireEvent.click(statusFilter);
      });

      // Filter options should be available
      expect(screen.getByText('All Statuses')).toBeInTheDocument();
    });

    it('expands invoice details', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInvoices),
      });

      await act(async () => {
        render(<InvoiceManager />);
      });

      await waitFor(() => {
        expect(screen.getByText('INV-001')).toBeInTheDocument();
      });

      // Click on invoice row to expand
      const invoiceRow = screen.getByRole('row', { name: /INV-001/ });
      await act(async () => {
        fireEvent.click(invoiceRow);
      });

      expect(screen.getByText('Invoice Details')).toBeInTheDocument();
      expect(screen.getByText('Premium Plan - August 2025')).toBeInTheDocument();
    });
  });

  // =============================================
  // SUBSCRIPTION CONTROLS TESTS
  // =============================================

  describe('SubscriptionControls Component', () => {
    const mockSubscription = {
      id: 'sub_test123',
      planId: 'premium',
      planName: 'Premium',
      status: 'active',
      price: 4900,
      currency: 'usd',
      interval: 'month',
      currentPeriodStart: new Date('2025-08-01'),
      currentPeriodEnd: new Date('2025-09-01'),
      cancelAtPeriodEnd: false,
      features: [
        '25 Business Listings',
        '250 Photo Uploads',
        'Priority Support',
      ],
    };

    it('displays current subscription details', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSubscription),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

      await act(async () => {
        render(<SubscriptionControls />);
      });

      await waitFor(() => {
        expect(screen.getByText('Subscription Management')).toBeInTheDocument();
      }, { timeout: 3000 });

      expect(screen.getByText('Premium')).toBeInTheDocument();
      expect(screen.getByText('$49.00 / month')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('shows plan features', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSubscription),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

      await act(async () => {
        render(<SubscriptionControls />);
      });

      await waitFor(() => {
        expect(screen.getByText('Current Plan Features')).toBeInTheDocument();
      }, { timeout: 3000 });

      expect(screen.getByText('25 Business Listings')).toBeInTheDocument();
      expect(screen.getByText('250 Photo Uploads')).toBeInTheDocument();
      expect(screen.getByText('Priority Support')).toBeInTheDocument();
    });

    it('opens plan change modal', async () => {
      const mockPlans = [
        {
          id: 'starter',
          name: 'Starter',
          description: 'Basic plan',
          price: { monthly: 1900, yearly: 18900 },
          currency: 'usd',
          features: ['5 Listings'],
        },
      ];

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSubscription),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPlans),
        });

      await act(async () => {
        render(<SubscriptionControls />);
      });

      await waitFor(() => {
        expect(screen.getByText('Subscription Management')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Click change plan button
      const changePlanButton = screen.getByRole('button', { name: /change plan/i });
      await act(async () => {
        fireEvent.click(changePlanButton);
      });

      expect(screen.getByText('Change Subscription Plan')).toBeInTheDocument();
    });
  });

  // =============================================
  // USAGE ANALYTICS TESTS
  // =============================================

  describe('UsageAnalytics Component', () => {
    const mockAnalytics = {
      usageMetrics: [
        {
          name: 'Business Listings',
          category: 'Content',
          current: 3,
          limit: 10,
          unit: 'listings',
          percentage: 30,
          trend: 'up',
          trendPercentage: 15.3,
          isNearLimit: false,
          isOverLimit: false,
          description: 'Total business listings created',
        },
      ],
      roiMetrics: [
        {
          name: 'Customer Acquisition Cost',
          value: 45.50,
          unit: 'currency',
          description: 'Average cost to acquire a customer',
          comparison: {
            period: 'Previous month',
            value: 52.30,
            change: -13.0,
          },
        },
      ],
      upgradeRecommendations: [],
      summary: {
        totalValue: 320.50,
        efficiency: 65.8,
        growthRate: 12.4,
      },
    };

    it('displays usage summary', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAnalytics),
      });

      await act(async () => {
        render(<UsageAnalytics compact={true} />);
      });

      await waitFor(() => {
        expect(screen.getByText('Usage Summary')).toBeInTheDocument();
      }, { timeout: 3000 });

      expect(screen.getByText('$320.50')).toBeInTheDocument();
      expect(screen.getByText('65.8%')).toBeInTheDocument();
      expect(screen.getByText('+12.4%')).toBeInTheDocument();
    });

    it('displays detailed analytics', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAnalytics),
      });

      await act(async () => {
        render(<UsageAnalytics detailed={true} />);
      });

      await waitFor(() => {
        expect(screen.getByText('Usage Analytics')).toBeInTheDocument();
      });

      // Should show tabs for detailed view
      expect(screen.getByText('Usage Metrics')).toBeInTheDocument();
      expect(screen.getByText('ROI Analysis')).toBeInTheDocument();
      expect(screen.getByText('Recommendations')).toBeInTheDocument();
    });
  });

  // =============================================
  // BILLING NOTIFICATIONS TESTS
  // =============================================

  describe('BillingNotifications Component', () => {
    const mockNotifications = [
      {
        id: 'trial-ending',
        type: 'trial_ending',
        severity: 'warning',
        title: 'Trial Ending Soon',
        message: 'Your free trial ends in 3 days.',
        actionLabel: 'Add Payment Method',
        actionUrl: '/billing',
        dismissible: true,
        createdAt: new Date('2025-08-28'),
        metadata: {
          daysRemaining: 3,
        },
      },
    ];

    it('displays billing notifications', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNotifications),
      });

      await act(async () => {
        render(<BillingNotifications />);
      });

      await waitFor(() => {
        expect(screen.getByText('Trial Ending Soon')).toBeInTheDocument();
      }, { timeout: 3000 });

      expect(screen.getByText('Your free trial ends in 3 days.')).toBeInTheDocument();
      expect(screen.getByText('3 days')).toBeInTheDocument();
    });

    it('handles notification dismissal', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockNotifications),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      await act(async () => {
        render(<BillingNotifications />);
      });

      await waitFor(() => {
        expect(screen.getByText('Trial Ending Soon')).toBeInTheDocument();
      });

      // Click dismiss button (use more specific selector)
      const dismissButton = screen.getByLabelText('Dismiss notification');
      await act(async () => {
        fireEvent.click(dismissButton);
      });

      await waitFor(() => {
        expect(fetch).toHaveBeenLastCalledWith(
          '/api/billing/notifications/trial-ending/dismiss',
          expect.objectContaining({ method: 'POST' })
        );
      });
    });
  });

  // =============================================
  // INTEGRATION TESTS
  // =============================================

  describe('Integration Tests', () => {
    it('handles API errors gracefully', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        render(<BillingOverview />);
      });

      await waitFor(() => {
        expect(screen.getByText('Error Loading Billing Data')).toBeInTheDocument();
      }, { timeout: 3000 });

      expect(screen.getByText('Failed to load billing information')).toBeInTheDocument();
    });

    it('shows loading states appropriately', async () => {
      (fetch as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves

      await act(async () => {
        render(<BillingOverview />);
      });

      expect(screen.getByText('Loading billing information...')).toBeInTheDocument();
    });

    it('handles empty data states', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await act(async () => {
        render(<InvoiceManager />);
      });

      await waitFor(() => {
        expect(screen.getByText('No Invoices Found')).toBeInTheDocument();
      });
    });
  });
});

// =============================================
// TEST UTILITIES
// =============================================

export const createMockBillingData = (overrides = {}) => ({
  billingStatus: {
    isActive: true,
    nextBillingDate: new Date('2025-09-28'),
    daysUntilBilling: 31,
    currentAmount: 4900,
    currency: 'usd',
    status: 'active',
    cancelAtPeriodEnd: false,
  },
  usageMetrics: [
    {
      name: 'Business Listings',
      current: 3,
      limit: 10,
      unit: 'listings',
      percentage: 30,
      isNearLimit: false,
      isOverLimit: false,
    },
  ],
  paymentMethodHealth: [],
  recentAlerts: [],
  ...overrides,
});

export const createMockPaymentMethod = (overrides = {}) => ({
  id: 'pm_test123',
  type: 'card',
  last4: '4242',
  brand: 'visa',
  isDefault: true,
  isExpiring: false,
  hasDeclineHistory: false,
  createdAt: new Date('2025-08-01'),
  ...overrides,
});