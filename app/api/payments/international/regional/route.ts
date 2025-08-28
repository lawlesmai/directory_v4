/**
 * EPIC 5 STORY 5.9: International Payments & Tax Compliance
 * Regional Payment Methods API Routes
 * 
 * API endpoints for regional payment methods including:
 * - SEPA Direct Debit (EU)
 * - iDEAL (Netherlands)
 * - SOFORT (Germany/Austria)
 * - Bancontact (Belgium)
 * - ACSS Debit (Canada)
 * - BECS Direct Debit (Australia)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import internationalPaymentProcessor from '@/lib/payments/international-payment-processor';
import { z } from 'zod';

// =============================================
// VALIDATION SCHEMAS
// =============================================

const RegionalPaymentSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().positive().max(100000000),
  currency: z.string().length(3),
  customerCountry: z.string().length(2),
  paymentMethod: z.string(),
  mandateId: z.string().optional(),
  bankId: z.string().optional(),
  iban: z.string().optional(),
  description: z.string().max(500).optional(),
  metadata: z.record(z.any()).optional(),
});

const PaymentMethodAvailabilitySchema = z.object({
  country: z.string().length(2),
  currency: z.string().length(3).optional(),
  amount: z.number().positive().optional(),
});

// =============================================
// API ROUTE HANDLERS
// =============================================

/**
 * POST /api/payments/international/regional
 * Process regional payment (SEPA, iDEAL, etc.)
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
    const validatedData = RegionalPaymentSchema.parse(body);

    // Process regional payment
    const result = await internationalPaymentProcessor.processRegionalPayment(validatedData);

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('Regional payment processing error:', error);
    
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
 * GET /api/payments/international/regional
 * Get available regional payment methods for country/currency
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country');
    const currency = searchParams.get('currency');
    const amount = searchParams.get('amount');

    if (!country) {
      return NextResponse.json(
        { error: 'Country parameter is required' },
        { status: 400 }
      );
    }

    const validatedData = PaymentMethodAvailabilitySchema.parse({
      country,
      currency: currency || undefined,
      amount: amount ? parseInt(amount) : undefined,
    });

    // Get supported payment methods
    const allMethods = internationalPaymentProcessor.getSupportedRegionalPaymentMethods();
    
    // Filter by country and currency
    const availableMethods = Object.entries(allMethods)
      .filter(([_, config]) => {
        const regionMatch = config.regions.includes(validatedData.country);
        const currencyMatch = !validatedData.currency || 
          config.currencies.includes(validatedData.currency);
        
        // Check amount limits if specified
        let amountValid = true;
        if (validatedData.amount && config.minAmount) {
          amountValid = validatedData.amount >= config.minAmount;
        }
        if (validatedData.amount && config.maxAmount) {
          amountValid = amountValid && validatedData.amount <= config.maxAmount;
        }

        return regionMatch && currencyMatch && amountValid;
      })
      .map(([methodCode, config]) => ({
        code: methodCode,
        name: config.name || methodCode,
        currencies: config.currencies,
        processingTime: config.processingTime,
        requiresMandate: config.requiresMandate,
        type: config.payment_type || 'unknown',
      }));

    return NextResponse.json({
      success: true,
      data: {
        country: validatedData.country,
        currency: validatedData.currency,
        availableMethods,
      },
    });

  } catch (error) {
    console.error('Error fetching regional payment methods:', error);
    
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