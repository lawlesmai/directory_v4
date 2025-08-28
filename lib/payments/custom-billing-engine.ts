/**
 * EPIC 5 STORY 5.8: Enterprise Sales & Custom Billing
 * Custom Billing Engine - Advanced billing for enterprise customers with flexible terms
 * 
 * This service provides enterprise-grade billing capabilities including:
 * - Multi-location consolidated billing
 * - Custom payment terms (Net 30/60/90, PO processing, wire transfers)
 * - Volume discounts and tiered pricing
 * - Purchase order processing and tracking
 * - Enterprise-level payment methods (wire, ACH, bank transfer)
 */

import { createClient } from '@/lib/supabase/server';
import stripeService from './stripe-service';
import billingService from './billing-service';
import { z } from 'zod';
import Stripe from 'stripe';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface EnterpriseBillingProfile {
  id: string;
  customerId: string;
  companyName: string;
  billingType: 'consolidated' | 'location_based' | 'department_based';
  paymentTerms: 'net_30' | 'net_60' | 'net_90' | 'annual_prepaid' | 'quarterly_prepaid';
  preferredPaymentMethod: 'credit_card' | 'ach' | 'wire_transfer' | 'check' | 'purchase_order';
  billingFrequency: 'monthly' | 'quarterly' | 'annually';
  consolidatedBilling: boolean;
  costCenterAllocation: boolean;
  purchaseOrderRequired: boolean;
  customInvoiceFormat: boolean;
  taxExemptStatus: boolean;
  billingContact: {
    name: string;
    email: string;
    phone?: string;
    department?: string;
  };
  approvalWorkflow: {
    enabled: boolean;
    approvers: string[];
    approvalThreshold: number;
  };
  volumeDiscounts: VolumeDiscountTier[];
  contractTerms: {
    minimumCommitment: number; // months
    minimumSpend: number; // annual minimum
    escalationClause: boolean;
    renewalTerms: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface VolumeDiscountTier {
  id: string;
  tierName: string;
  minimumLocations: number;
  maximumLocations?: number;
  discountPercentage: number;
  additionalBenefits: string[];
  effectiveDate: Date;
  expirationDate?: Date;
}

export interface CustomInvoice {
  id: string;
  enterpriseCustomerId: string;
  invoiceNumber: string;
  billingPeriod: {
    start: Date;
    end: Date;
  };
  locations: InvoiceLocationDetail[];
  costCenters: InvoiceCostCenter[];
  lineItems: CustomInvoiceLineItem[];
  subtotal: number;
  discounts: InvoiceDiscount[];
  taxes: InvoiceTax[];
  total: number;
  currency: string;
  paymentTerms: string;
  dueDate: Date;
  purchaseOrder?: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  paymentStatus: 'pending' | 'processing' | 'paid' | 'overdue' | 'failed';
  paymentMethod: string;
  wireInstructions?: WireTransferInstructions;
  customFormatting: CustomInvoiceFormatting;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceLocationDetail {
  locationId: string;
  locationName: string;
  address: string;
  costCenter: string;
  usageMetrics: {
    profileViews: number;
    searchAppearances: number;
    customerInquiries: number;
    premiumFeatureUsage: number;
  };
  charges: {
    baseSubscription: number;
    usageCharges: number;
    additionalFeatures: number;
    discount: number;
  };
}

export interface InvoiceCostCenter {
  costCenterCode: string;
  costCenterName: string;
  department: string;
  locationCount: number;
  totalAmount: number;
  budgetOwner: string;
}

export interface CustomInvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  period: {
    start: Date;
    end: Date;
  };
  costCenter: string;
  category: 'subscription' | 'usage' | 'setup' | 'professional_services' | 'addon';
}

export interface InvoiceDiscount {
  type: 'volume' | 'contract' | 'promotional' | 'loyalty';
  description: string;
  amount: number;
  percentage?: number;
}

export interface InvoiceTax {
  jurisdiction: string;
  rate: number;
  amount: number;
  exemptionNumber?: string;
}

export interface WireTransferInstructions {
  bankName: string;
  routingNumber: string;
  accountNumber: string;
  swiftCode?: string;
  beneficiaryName: string;
  beneficiaryAddress: string;
  reference: string;
}

export interface CustomInvoiceFormatting {
  logoUrl?: string;
  headerColor: string;
  accentColor: string;
  footerText: string;
  customFields: Record<string, string>;
  includeCostCenters: boolean;
  includeLocationDetails: boolean;
  includeUsageMetrics: boolean;
}

export interface PurchaseOrderRequest {
  id: string;
  enterpriseCustomerId: string;
  poNumber: string;
  vendorName: string;
  requestorName: string;
  requestorEmail: string;
  department: string;
  costCenter: string;
  description: string;
  amount: number;
  currency: string;
  requestedDeliveryDate: Date;
  approvalWorkflow: {
    required: boolean;
    approvers: string[];
    currentApprover: string;
    approvalNotes: string[];
  };
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'processed';
  attachments: string[];
  createdAt: Date;
  updatedAt: Date;
}

// =============================================
// VALIDATION SCHEMAS
// =============================================

const CreateBillingProfileSchema = z.object({
  customerId: z.string().uuid(),
  companyName: z.string().min(2).max(255),
  billingType: z.enum(['consolidated', 'location_based', 'department_based']),
  paymentTerms: z.enum(['net_30', 'net_60', 'net_90', 'annual_prepaid', 'quarterly_prepaid']),
  preferredPaymentMethod: z.enum(['credit_card', 'ach', 'wire_transfer', 'check', 'purchase_order']),
  billingFrequency: z.enum(['monthly', 'quarterly', 'annually']),
  purchaseOrderRequired: z.boolean().default(false),
  taxExemptStatus: z.boolean().default(false),
  billingContact: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().optional(),
    department: z.string().optional(),
  }),
});

const CreateCustomInvoiceSchema = z.object({
  enterpriseCustomerId: z.string().uuid(),
  billingPeriodStart: z.date(),
  billingPeriodEnd: z.date(),
  locations: z.array(z.string().uuid()).min(1),
  purchaseOrder: z.string().optional(),
  customFormatting: z.object({
    includeCostCenters: z.boolean().default(true),
    includeLocationDetails: z.boolean().default(true),
    includeUsageMetrics: z.boolean().default(true),
  }).optional(),
});

const ProcessPurchaseOrderSchema = z.object({
  poNumber: z.string().min(3).max(50),
  enterpriseCustomerId: z.string().uuid(),
  description: z.string().min(10),
  amount: z.number().positive(),
  costCenter: z.string().min(2),
  requestorEmail: z.string().email(),
  department: z.string().min(2),
});

// =============================================
// CUSTOM BILLING ENGINE CLASS
// =============================================

class CustomBillingEngine {
  private supabase;
  private stripe: Stripe;

  // Standard volume discount tiers
  private readonly VOLUME_DISCOUNTS: VolumeDiscountTier[] = [
    {
      id: 'tier_50',
      tierName: 'Growth',
      minimumLocations: 50,
      maximumLocations: 99,
      discountPercentage: 15,
      additionalBenefits: ['Priority Support', 'Monthly Business Reviews'],
      effectiveDate: new Date(),
    },
    {
      id: 'tier_100',
      tierName: 'Professional',
      minimumLocations: 100,
      maximumLocations: 499,
      discountPercentage: 20,
      additionalBenefits: ['Dedicated CSM', 'API Access', 'Custom Integrations'],
      effectiveDate: new Date(),
    },
    {
      id: 'tier_500',
      tierName: 'Enterprise',
      minimumLocations: 500,
      maximumLocations: 999,
      discountPercentage: 25,
      additionalBenefits: ['White-label Options', 'Advanced Analytics', 'SLA Guarantees'],
      effectiveDate: new Date(),
    },
    {
      id: 'tier_1000',
      tierName: 'Enterprise Plus',
      minimumLocations: 1000,
      discountPercentage: 30,
      additionalBenefits: ['Custom Development', 'Dedicated Infrastructure', 'Strategic Planning'],
      effectiveDate: new Date(),
    },
  ];

  constructor() {
    this.supabase = createClient();
    this.stripe = stripeService.getStripeInstance();
  }

  // =============================================
  // BILLING PROFILE MANAGEMENT
  // =============================================

  /**
   * Create enterprise billing profile
   */
  async createBillingProfile(data: z.infer<typeof CreateBillingProfileSchema>): Promise<EnterpriseBillingProfile> {
    try {
      const validatedData = CreateBillingProfileSchema.parse(data);

      // Determine volume discounts based on customer locations
      const { data: customer } = await this.supabase
        .from('stripe_customers')
        .select(`
          *,
          businesses(location_count)
        `)
        .eq('id', validatedData.customerId)
        .single();

      if (!customer) {
        throw new Error('Customer not found');
      }

      const locationCount = customer.businesses?.location_count || 1;
      const applicableDiscounts = this.calculateVolumeDiscounts(locationCount);

      // Create billing profile
      const { data: profile, error } = await this.supabase
        .from('enterprise_billing_profiles')
        .insert({
          customer_id: validatedData.customerId,
          company_name: validatedData.companyName,
          billing_type: validatedData.billingType,
          payment_terms: validatedData.paymentTerms,
          preferred_payment_method: validatedData.preferredPaymentMethod,
          billing_frequency: validatedData.billingFrequency,
          consolidated_billing: validatedData.billingType === 'consolidated',
          cost_center_allocation: validatedData.billingType === 'department_based',
          purchase_order_required: validatedData.purchaseOrderRequired,
          tax_exempt_status: validatedData.taxExemptStatus,
          billing_contact: validatedData.billingContact,
          volume_discounts: applicableDiscounts,
          contract_terms: {
            minimumCommitment: 12,
            minimumSpend: this.calculateMinimumSpend(locationCount, applicableDiscounts[0]),
            escalationClause: true,
            renewalTerms: 'Auto-renew unless cancelled 90 days prior',
          },
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return this.mapToBillingProfile(profile);
    } catch (error) {
      console.error('Create billing profile error:', error);
      throw new Error(`Failed to create billing profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate applicable volume discounts
   */
  private calculateVolumeDiscounts(locationCount: number): VolumeDiscountTier[] {
    return this.VOLUME_DISCOUNTS.filter(tier => 
      locationCount >= tier.minimumLocations && 
      (!tier.maximumLocations || locationCount <= tier.maximumLocations)
    );
  }

  /**
   * Calculate minimum annual spend
   */
  private calculateMinimumSpend(locationCount: number, discountTier?: VolumeDiscountTier): number {
    const basePrice = 79; // Standard monthly price
    const discountedPrice = discountTier 
      ? basePrice * (1 - discountTier.discountPercentage / 100)
      : basePrice;
    
    return Math.floor(discountedPrice * locationCount * 12);
  }

  // =============================================
  // CUSTOM INVOICE GENERATION
  // =============================================

  /**
   * Generate consolidated custom invoice
   */
  async generateCustomInvoice(data: z.infer<typeof CreateCustomInvoiceSchema>): Promise<CustomInvoice> {
    try {
      const validatedData = CreateCustomInvoiceSchema.parse(data);

      // Get billing profile
      const { data: billingProfile } = await this.supabase
        .from('enterprise_billing_profiles')
        .select('*')
        .eq('customer_id', validatedData.enterpriseCustomerId)
        .single();

      if (!billingProfile) {
        throw new Error('Billing profile not found');
      }

      // Get location details and usage data
      const locationDetails = await this.getLocationBillingDetails(
        validatedData.locations,
        validatedData.billingPeriodStart,
        validatedData.billingPeriodEnd
      );

      // Calculate line items and totals
      const lineItems = await this.generateInvoiceLineItems(locationDetails, billingProfile);
      const costCenters = this.groupByCostCenter(locationDetails);
      
      // Apply volume discounts
      const discounts = this.calculateApplicableDiscounts(
        locationDetails.length,
        lineItems,
        billingProfile.volume_discounts
      );

      // Calculate taxes
      const taxes = await this.calculateInvoiceTaxes(
        validatedData.enterpriseCustomerId,
        lineItems,
        discounts,
        billingProfile.tax_exempt_status
      );

      const subtotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const totalDiscounts = discounts.reduce((sum, discount) => sum + discount.amount, 0);
      const totalTaxes = taxes.reduce((sum, tax) => sum + tax.amount, 0);
      const total = subtotal - totalDiscounts + totalTaxes;

      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber();

      // Calculate due date based on payment terms
      const dueDate = this.calculateDueDate(new Date(), billingProfile.payment_terms);

      // Create custom invoice record
      const { data: invoice, error } = await this.supabase
        .from('enterprise_custom_invoices')
        .insert({
          enterprise_customer_id: validatedData.enterpriseCustomerId,
          invoice_number: invoiceNumber,
          billing_period_start: validatedData.billingPeriodStart.toISOString(),
          billing_period_end: validatedData.billingPeriodEnd.toISOString(),
          locations: locationDetails,
          cost_centers: costCenters,
          line_items: lineItems,
          subtotal,
          discounts,
          taxes,
          total,
          currency: 'USD',
          payment_terms: billingProfile.payment_terms,
          due_date: dueDate.toISOString(),
          purchase_order: validatedData.purchaseOrder,
          approval_status: billingProfile.purchase_order_required ? 'pending' : 'approved',
          payment_status: 'pending',
          payment_method: billingProfile.preferred_payment_method,
          wire_instructions: billingProfile.preferred_payment_method === 'wire_transfer' 
            ? await this.getWireInstructions() : null,
          custom_formatting: {
            ...validatedData.customFormatting,
            headerColor: '#1f2937',
            accentColor: '#3b82f6',
            footerText: 'Thank you for your business',
            customFields: {},
          },
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return this.mapToCustomInvoice(invoice);
    } catch (error) {
      console.error('Generate custom invoice error:', error);
      throw new Error(`Failed to generate custom invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get location billing details with usage metrics
   */
  private async getLocationBillingDetails(
    locationIds: string[], 
    periodStart: Date, 
    periodEnd: Date
  ): Promise<InvoiceLocationDetail[]> {
    try {
      const { data: locations } = await this.supabase
        .from('businesses')
        .select(`
          id,
          name,
          address,
          cost_center,
          subscription_id,
          subscriptions(
            id,
            plan_id,
            quantity,
            current_period_start,
            current_period_end
          )
        `)
        .in('id', locationIds);

      if (!locations) return [];

      // Get usage metrics for each location
      const locationDetails: InvoiceLocationDetail[] = [];

      for (const location of locations) {
        const usageMetrics = await this.getLocationUsageMetrics(
          location.id,
          periodStart,
          periodEnd
        );

        const charges = await this.calculateLocationCharges(
          location,
          usageMetrics,
          periodStart,
          periodEnd
        );

        locationDetails.push({
          locationId: location.id,
          locationName: location.name,
          address: location.address || '',
          costCenter: location.cost_center || 'Default',
          usageMetrics,
          charges,
        });
      }

      return locationDetails;
    } catch (error) {
      console.error('Get location billing details error:', error);
      return [];
    }
  }

  /**
   * Get usage metrics for a location during billing period
   */
  private async getLocationUsageMetrics(
    locationId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<any> {
    // This would integrate with analytics system to get real usage data
    // For now, returning mock data
    return {
      profileViews: Math.floor(Math.random() * 10000) + 1000,
      searchAppearances: Math.floor(Math.random() * 50000) + 5000,
      customerInquiries: Math.floor(Math.random() * 500) + 50,
      premiumFeatureUsage: Math.floor(Math.random() * 2000) + 200,
    };
  }

  /**
   * Calculate charges for a location
   */
  private async calculateLocationCharges(
    location: any,
    usageMetrics: any,
    periodStart: Date,
    periodEnd: Date
  ): Promise<any> {
    const baseSubscription = 79; // Standard monthly rate
    const usageCharges = Math.max(0, (usageMetrics.premiumFeatureUsage - 1000) * 0.05); // Overage charges
    const additionalFeatures = 0; // No additional features for this period
    
    // Volume discount will be applied at invoice level
    const discount = 0;

    return {
      baseSubscription,
      usageCharges,
      additionalFeatures,
      discount,
    };
  }

  /**
   * Generate invoice line items from location details
   */
  private async generateInvoiceLineItems(
    locationDetails: InvoiceLocationDetail[],
    billingProfile: any
  ): Promise<CustomInvoiceLineItem[]> {
    const lineItems: CustomInvoiceLineItem[] = [];
    let itemId = 1;

    for (const location of locationDetails) {
      // Base subscription line item
      lineItems.push({
        id: `item_${itemId++}`,
        description: `Professional Plan - ${location.locationName}`,
        quantity: 1,
        unitPrice: location.charges.baseSubscription,
        totalPrice: location.charges.baseSubscription,
        period: {
          start: new Date(),
          end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
        costCenter: location.costCenter,
        category: 'subscription',
      });

      // Usage charges if any
      if (location.charges.usageCharges > 0) {
        lineItems.push({
          id: `item_${itemId++}`,
          description: `Usage Overage - ${location.locationName}`,
          quantity: 1,
          unitPrice: location.charges.usageCharges,
          totalPrice: location.charges.usageCharges,
          period: {
            start: new Date(),
            end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          costCenter: location.costCenter,
          category: 'usage',
        });
      }
    }

    return lineItems;
  }

  /**
   * Group locations by cost center
   */
  private groupByCostCenter(locationDetails: InvoiceLocationDetail[]): InvoiceCostCenter[] {
    const costCenterMap = new Map<string, InvoiceCostCenter>();

    locationDetails.forEach(location => {
      const costCenter = location.costCenter || 'Default';
      const totalAmount = Object.values(location.charges).reduce((sum: number, charge: number) => sum + charge, 0);

      if (costCenterMap.has(costCenter)) {
        const existing = costCenterMap.get(costCenter)!;
        existing.locationCount += 1;
        existing.totalAmount += totalAmount;
      } else {
        costCenterMap.set(costCenter, {
          costCenterCode: costCenter,
          costCenterName: costCenter,
          department: 'Operations', // Could be enhanced to get real department
          locationCount: 1,
          totalAmount,
          budgetOwner: 'Budget Manager', // Could be enhanced to get real owner
        });
      }
    });

    return Array.from(costCenterMap.values());
  }

  /**
   * Calculate applicable discounts
   */
  private calculateApplicableDiscounts(
    locationCount: number,
    lineItems: CustomInvoiceLineItem[],
    volumeDiscounts: VolumeDiscountTier[]
  ): InvoiceDiscount[] {
    const discounts: InvoiceDiscount[] = [];
    const subscriptionTotal = lineItems
      .filter(item => item.category === 'subscription')
      .reduce((sum, item) => sum + item.totalPrice, 0);

    // Apply volume discount if applicable
    const applicableDiscount = volumeDiscounts.find(discount => 
      locationCount >= discount.minimumLocations &&
      (!discount.maximumLocations || locationCount <= discount.maximumLocations)
    );

    if (applicableDiscount) {
      const discountAmount = subscriptionTotal * (applicableDiscount.discountPercentage / 100);
      discounts.push({
        type: 'volume',
        description: `Volume Discount - ${applicableDiscount.tierName} (${applicableDiscount.discountPercentage}%)`,
        amount: discountAmount,
        percentage: applicableDiscount.discountPercentage,
      });
    }

    return discounts;
  }

  /**
   * Calculate invoice taxes
   */
  private async calculateInvoiceTaxes(
    customerId: string,
    lineItems: CustomInvoiceLineItem[],
    discounts: InvoiceDiscount[],
    taxExempt: boolean
  ): Promise<InvoiceTax[]> {
    if (taxExempt) {
      return [];
    }

    // Get customer billing address for tax calculation
    const { data: customer } = await this.supabase
      .from('stripe_customers')
      .select('billing_address')
      .eq('id', customerId)
      .single();

    if (!customer?.billing_address) {
      return [];
    }

    const taxableAmount = lineItems.reduce((sum, item) => sum + item.totalPrice, 0) -
                         discounts.reduce((sum, discount) => sum + discount.amount, 0);

    // Simplified tax calculation - in production, use proper tax service
    const taxes: InvoiceTax[] = [];
    
    if (customer.billing_address.country === 'US') {
      // Add state sales tax if applicable
      const statesTaxRates: Record<string, number> = {
        'CA': 0.0875, 'NY': 0.08, 'TX': 0.0625, 'FL': 0.06,
        // Add more states as needed
      };

      const state = customer.billing_address.state;
      const taxRate = statesTaxRates[state] || 0;

      if (taxRate > 0) {
        taxes.push({
          jurisdiction: `${state} State Sales Tax`,
          rate: taxRate,
          amount: Math.round(taxableAmount * taxRate),
        });
      }
    }

    return taxes;
  }

  // =============================================
  // PURCHASE ORDER PROCESSING
  // =============================================

  /**
   * Process purchase order request
   */
  async processPurchaseOrder(data: z.infer<typeof ProcessPurchaseOrderSchema>): Promise<PurchaseOrderRequest> {
    try {
      const validatedData = ProcessPurchaseOrderSchema.parse(data);

      // Get billing profile to check approval requirements
      const { data: billingProfile } = await this.supabase
        .from('enterprise_billing_profiles')
        .select('*')
        .eq('customer_id', validatedData.enterpriseCustomerId)
        .single();

      if (!billingProfile) {
        throw new Error('Billing profile not found');
      }

      // Determine approval workflow
      const approvalRequired = billingProfile.approval_workflow?.enabled && 
                              validatedData.amount >= (billingProfile.approval_workflow?.approval_threshold || 1000);

      // Create PO request
      const { data: poRequest, error } = await this.supabase
        .from('purchase_order_requests')
        .insert({
          enterprise_customer_id: validatedData.enterpriseCustomerId,
          po_number: validatedData.poNumber,
          vendor_name: 'The Lawless Directory',
          requestor_name: validatedData.requestorEmail.split('@')[0], // Extract name from email
          requestor_email: validatedData.requestorEmail,
          department: validatedData.department,
          cost_center: validatedData.costCenter,
          description: validatedData.description,
          amount: validatedData.amount,
          currency: 'USD',
          requested_delivery_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          approval_workflow: {
            required: approvalRequired,
            approvers: billingProfile.approval_workflow?.approvers || [],
            currentApprover: approvalRequired ? billingProfile.approval_workflow?.approvers[0] : null,
            approvalNotes: [],
          },
          status: approvalRequired ? 'pending_approval' : 'approved',
          attachments: [],
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return this.mapToPurchaseOrderRequest(poRequest);
    } catch (error) {
      console.error('Process purchase order error:', error);
      throw new Error(`Failed to process purchase order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Approve purchase order
   */
  async approvePurchaseOrder(poId: string, approverId: string, notes?: string): Promise<void> {
    try {
      const { data: po, error: fetchError } = await this.supabase
        .from('purchase_order_requests')
        .select('*')
        .eq('id', poId)
        .single();

      if (fetchError || !po) {
        throw new Error('Purchase order not found');
      }

      const approvalWorkflow = po.approval_workflow;
      const currentApproverIndex = approvalWorkflow.approvers.indexOf(approverId);
      
      if (currentApproverIndex === -1) {
        throw new Error('Unauthorized approver');
      }

      // Add approval notes
      approvalWorkflow.approvalNotes.push(`${approverId}: ${notes || 'Approved'}`);

      // Check if this is the final approver
      const isLastApprover = currentApproverIndex === approvalWorkflow.approvers.length - 1;
      const newStatus = isLastApprover ? 'approved' : 'pending_approval';
      const nextApprover = isLastApprover ? null : approvalWorkflow.approvers[currentApproverIndex + 1];

      // Update PO status
      const { error } = await this.supabase
        .from('purchase_order_requests')
        .update({
          approval_workflow: {
            ...approvalWorkflow,
            currentApprover: nextApprover,
          },
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', poId);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      console.log(`Purchase order ${poId} approved by ${approverId}`);
    } catch (error) {
      console.error('Approve purchase order error:', error);
      throw new Error(`Failed to approve purchase order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // WIRE TRANSFER PROCESSING
  // =============================================

  /**
   * Process wire transfer payment
   */
  async processWireTransfer(invoiceId: string, wireDetails: any): Promise<void> {
    try {
      // Update invoice with wire transfer details
      const { error } = await this.supabase
        .from('enterprise_custom_invoices')
        .update({
          payment_status: 'processing',
          payment_method: 'wire_transfer',
          wire_transfer_details: wireDetails,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Create wire transfer processing record for manual reconciliation
      await this.supabase
        .from('wire_transfer_processing')
        .insert({
          invoice_id: invoiceId,
          reference_number: wireDetails.referenceNumber,
          amount: wireDetails.amount,
          sender_bank: wireDetails.senderBank,
          received_date: wireDetails.receivedDate || new Date().toISOString(),
          status: 'pending_verification',
          reconciliation_notes: [],
        });

      console.log(`Wire transfer initiated for invoice ${invoiceId}`);
    } catch (error) {
      console.error('Process wire transfer error:', error);
      throw new Error(`Failed to process wire transfer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get wire transfer instructions
   */
  private async getWireInstructions(): Promise<WireTransferInstructions> {
    // In production, this would fetch from configuration
    return {
      bankName: 'Chase Bank',
      routingNumber: '021000021',
      accountNumber: '1234567890', // This would be encrypted in production
      swiftCode: 'CHASUS33',
      beneficiaryName: 'The Lawless Directory Inc.',
      beneficiaryAddress: '123 Business St, Suite 100, Business City, BC 12345',
      reference: 'Please include invoice number in wire reference',
    };
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  /**
   * Generate unique invoice number
   */
  private async generateInvoiceNumber(): Promise<string> {
    const prefix = 'ENT';
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Get next sequence number
    const { data, error } = await this.supabase
      .from('invoice_sequences')
      .select('next_number')
      .eq('prefix', `${prefix}-${year}${month}`)
      .single();

    let nextNumber = 1;
    if (data) {
      nextNumber = data.next_number;
      // Update sequence
      await this.supabase
        .from('invoice_sequences')
        .update({ next_number: nextNumber + 1 })
        .eq('prefix', `${prefix}-${year}${month}`);
    } else {
      // Create new sequence
      await this.supabase
        .from('invoice_sequences')
        .insert({
          prefix: `${prefix}-${year}${month}`,
          next_number: 2,
        });
    }

    return `${prefix}-${year}${month}-${String(nextNumber).padStart(4, '0')}`;
  }

  /**
   * Calculate due date based on payment terms
   */
  private calculateDueDate(invoiceDate: Date, paymentTerms: string): Date {
    const dueDate = new Date(invoiceDate);
    
    switch (paymentTerms) {
      case 'net_30':
        dueDate.setDate(dueDate.getDate() + 30);
        break;
      case 'net_60':
        dueDate.setDate(dueDate.getDate() + 60);
        break;
      case 'net_90':
        dueDate.setDate(dueDate.getDate() + 90);
        break;
      case 'quarterly_prepaid':
        dueDate.setDate(dueDate.getDate() + 7); // 7 days for prepaid
        break;
      case 'annual_prepaid':
        dueDate.setDate(dueDate.getDate() + 14); // 14 days for annual prepaid
        break;
      default:
        dueDate.setDate(dueDate.getDate() + 30);
    }

    return dueDate;
  }

  /**
   * Map database record to billing profile
   */
  private mapToBillingProfile(data: any): EnterpriseBillingProfile {
    return {
      id: data.id,
      customerId: data.customer_id,
      companyName: data.company_name,
      billingType: data.billing_type,
      paymentTerms: data.payment_terms,
      preferredPaymentMethod: data.preferred_payment_method,
      billingFrequency: data.billing_frequency,
      consolidatedBilling: data.consolidated_billing,
      costCenterAllocation: data.cost_center_allocation,
      purchaseOrderRequired: data.purchase_order_required,
      customInvoiceFormat: data.custom_invoice_format,
      taxExemptStatus: data.tax_exempt_status,
      billingContact: data.billing_contact,
      approvalWorkflow: data.approval_workflow || { enabled: false, approvers: [], approvalThreshold: 1000 },
      volumeDiscounts: data.volume_discounts || [],
      contractTerms: data.contract_terms,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Map database record to custom invoice
   */
  private mapToCustomInvoice(data: any): CustomInvoice {
    return {
      id: data.id,
      enterpriseCustomerId: data.enterprise_customer_id,
      invoiceNumber: data.invoice_number,
      billingPeriod: {
        start: new Date(data.billing_period_start),
        end: new Date(data.billing_period_end),
      },
      locations: data.locations || [],
      costCenters: data.cost_centers || [],
      lineItems: data.line_items || [],
      subtotal: data.subtotal,
      discounts: data.discounts || [],
      taxes: data.taxes || [],
      total: data.total,
      currency: data.currency,
      paymentTerms: data.payment_terms,
      dueDate: new Date(data.due_date),
      purchaseOrder: data.purchase_order,
      approvalStatus: data.approval_status,
      paymentStatus: data.payment_status,
      paymentMethod: data.payment_method,
      wireInstructions: data.wire_instructions,
      customFormatting: data.custom_formatting,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Map database record to purchase order request
   */
  private mapToPurchaseOrderRequest(data: any): PurchaseOrderRequest {
    return {
      id: data.id,
      enterpriseCustomerId: data.enterprise_customer_id,
      poNumber: data.po_number,
      vendorName: data.vendor_name,
      requestorName: data.requestor_name,
      requestorEmail: data.requestor_email,
      department: data.department,
      costCenter: data.cost_center,
      description: data.description,
      amount: data.amount,
      currency: data.currency,
      requestedDeliveryDate: new Date(data.requested_delivery_date),
      approvalWorkflow: data.approval_workflow,
      status: data.status,
      attachments: data.attachments || [],
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}

// =============================================
// SINGLETON INSTANCE
// =============================================

const customBillingEngine = new CustomBillingEngine();

export default customBillingEngine;
export { CustomBillingEngine };