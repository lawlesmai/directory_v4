/**
 * EPIC 5 STORY 5.9: International Payments & Tax Compliance
 * Tax Compliance API Routes
 * 
 * API endpoints for tax compliance operations including:
 * - Tax calculation by jurisdiction
 * - VAT number validation
 * - Tax rate retrieval
 * - Tax invoice generation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import taxComplianceEngine from '@/lib/payments/tax-compliance-engine';
import { z } from 'zod';

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
});

const VATValidationSchema = z.object({
  vatNumber: z.string().min(8).max(15),
  country: z.string().length(2).optional(),
});

const TaxRateQuerySchema = z.object({
  country: z.string().length(2),
  state: z.string().max(10).optional(),
  productCategory: z.string().default('standard'),
});

const TaxInvoiceSchema = z.object({
  transactionId: z.string(),
  customerInfo: z.object({
    name: z.string(),
    address: z.object({
      line1: z.string(),
      line2: z.string().optional(),
      city: z.string(),
      state: z.string().optional(),
      postalCode: z.string(),
      country: z.string().length(2),
    }),
    vatNumber: z.string().optional(),
    customerType: z.enum(['individual', 'business']),
  }),
  lineItems: z.array(z.object({
    description: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    totalAmount: z.number().positive(),
    taxRate: z.number().min(0).max(1),
    taxAmount: z.number().min(0),
    productCategory: z.string(),
  })).min(1),
  totalAmount: z.number().positive(),
  totalTaxAmount: z.number().min(0),
  currency: z.string().length(3),
  invoiceDate: z.string().datetime(),
  dueDate: z.string().datetime().optional(),
});

// =============================================
// API ROUTE HANDLERS
// =============================================

/**
 * POST /api/payments/international/tax
 * Calculate tax for international transaction
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const action = body.action || 'calculate';

    switch (action) {
      case 'calculate':
        const calculationData = TaxCalculationSchema.parse(body);
        const taxResult = await taxComplianceEngine.calculateTax(calculationData);

        return NextResponse.json({
          success: true,
          data: taxResult,
        });

      case 'validate_vat':
        const vatData = VATValidationSchema.parse(body);
        const vatResult = await taxComplianceEngine.validateVATNumber(
          vatData.vatNumber,
          vatData.country
        );

        return NextResponse.json({
          success: true,
          data: vatResult,
        });

      case 'generate_invoice':
        const invoiceData = TaxInvoiceSchema.parse(body);
        
        // Convert string dates to Date objects
        const invoiceRequest = {
          ...invoiceData,
          invoiceDate: new Date(invoiceData.invoiceDate),
          dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : undefined,
          merchantInfo: {
            name: 'Your Business Name', // Should come from business settings
            address: {
              line1: '123 Business St',
              city: 'Business City',
              state: 'BC',
              postalCode: '12345',
              country: 'US',
            },
            vatNumber: 'US123456789',
            registrationNumbers: {
              ein: '12-3456789',
            },
          },
        };

        const invoiceNumber = await taxComplianceEngine.generateTaxInvoice(invoiceRequest);

        return NextResponse.json({
          success: true,
          data: {
            invoiceNumber,
            generated: true,
          },
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: calculate, validate_vat, generate_invoice' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Tax compliance API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/payments/international/tax
 * Get tax rates and jurisdiction information
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country');
    const state = searchParams.get('state');
    const productCategory = searchParams.get('productCategory') || 'standard';
    const action = searchParams.get('action') || 'rates';

    switch (action) {
      case 'rates':
        if (!country) {
          return NextResponse.json(
            { error: 'Country parameter is required for tax rates' },
            { status: 400 }
          );
        }

        const rateQuery = TaxRateQuerySchema.parse({
          country,
          state: state || undefined,
          productCategory,
        });

        // Get tax jurisdiction
        const jurisdiction = await taxComplianceEngine.getTaxJurisdiction(
          rateQuery.country,
          rateQuery.state
        );

        if (!jurisdiction) {
          return NextResponse.json({
            success: true,
            data: {
              jurisdiction: null,
              taxRate: 0,
              taxType: 'none',
              message: 'No tax jurisdiction found',
            },
          });
        }

        // Get applicable tax rates
        const taxRates = await taxComplianceEngine.getApplicableTaxRate(
          jurisdiction,
          rateQuery.productCategory
        );

        const primaryRate = taxRates.length > 0 ? taxRates[0] : null;

        return NextResponse.json({
          success: true,
          data: {
            jurisdiction: {
              code: jurisdiction.code,
              name: jurisdiction.name,
              type: jurisdiction.type,
              taxSystem: jurisdiction.taxSystem,
              currency: jurisdiction.currency,
              mossEligible: jurisdiction.mossEligible,
            },
            taxRate: primaryRate?.rate || jurisdiction.defaultRate,
            taxType: jurisdiction.taxSystem,
            rateDetails: primaryRate ? {
              productCategory: primaryRate.productCategory,
              effectiveFrom: primaryRate.effectiveFrom,
              effectiveUntil: primaryRate.effectiveUntil,
              description: primaryRate.description,
            } : null,
          },
        });

      case 'jurisdictions':
        // This could return all available tax jurisdictions
        return NextResponse.json({
          success: true,
          data: {
            message: 'Use specific country/state parameters to get jurisdiction details',
            supportedCountries: [
              'US', 'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'CA', 'AU', 'CH'
            ],
          },
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: rates, jurisdictions' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Tax information API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}