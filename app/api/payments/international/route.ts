/**
 * EPIC 5 STORY 5.9: International Payments & Tax Compliance
 * International Payments API Routes
 * 
 * Main API endpoints for international payment processing including:
 * - Multi-currency payment processing
 * - Regional payment methods
 * - Tax compliance calculations
 * - Currency conversion
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import internationalPaymentProcessor from '@/lib/payments/international-payment-processor';
import { z } from 'zod';

// =============================================
// VALIDATION SCHEMAS
// =============================================

const ProcessPaymentSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().positive().max(100000000),
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

const RegionalPaymentSchema = ProcessPaymentSchema.extend({
  paymentMethod: z.string(),
  mandateId: z.string().optional(),
  bankId: z.string().optional(),
  iban: z.string().optional(),
});

const BatchPaymentSchema = z.object({
  payments: z.array(ProcessPaymentSchema).min(1).max(100),
  batchId: z.string().optional(),
});

// =============================================
// API ROUTE HANDLERS
// =============================================

/**
 * POST /api/payments/international
 * Process international payment with multi-currency support
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
    const validatedData = ProcessPaymentSchema.parse(body);

    // Process international payment
    const result = await internationalPaymentProcessor.processInternationalPayment(validatedData);

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('International payment processing error:', error);
    
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
 * GET /api/payments/international
 * Get international payment capabilities and supported currencies
 */
export async function GET() {
  try {
    const supportedCurrencies = internationalPaymentProcessor.getSupportedCurrencies();
    const supportedPaymentMethods = internationalPaymentProcessor.getSupportedRegionalPaymentMethods();

    return NextResponse.json({
      success: true,
      data: {
        supportedCurrencies,
        supportedPaymentMethods,
        capabilities: {
          multiCurrency: true,
          regionalPaymentMethods: true,
          taxCompliance: true,
          gdprCompliant: true,
          pciDssCompliant: true,
        },
      },
    });

  } catch (error) {
    console.error('Error fetching international payment capabilities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}