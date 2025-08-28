/**
 * EPIC 5 STORY 5.9: International Payments & Tax Compliance
 * Currency Management API Routes
 * 
 * API endpoints for currency operations including:
 * - Real-time currency conversion
 * - Exchange rate retrieval
 * - Supported currencies list
 * - Historical rate data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import currencyManager from '@/lib/payments/currency-manager';
import { z } from 'zod';

// =============================================
// VALIDATION SCHEMAS
// =============================================

const ConversionSchema = z.object({
  amount: z.number().positive(),
  fromCurrency: z.string().length(3),
  toCurrency: z.string().length(3),
});

const ExchangeRateSchema = z.object({
  baseCurrency: z.string().length(3),
  targetCurrency: z.string().length(3),
});

const HistoricalRateSchema = z.object({
  baseCurrency: z.string().length(3),
  targetCurrency: z.string().length(3),
  days: z.number().positive().max(365).default(30),
});

// =============================================
// API ROUTE HANDLERS
// =============================================

/**
 * POST /api/payments/international/currency
 * Convert currency amounts with real-time rates
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
    const validatedData = ConversionSchema.parse(body);

    // Perform currency conversion
    const result = await currencyManager.convertCurrency(
      validatedData.amount,
      validatedData.fromCurrency,
      validatedData.toCurrency
    );

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('Currency conversion error:', error);
    
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
 * GET /api/payments/international/currency
 * Get supported currencies or exchange rates
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const baseCurrency = searchParams.get('baseCurrency');
    const targetCurrency = searchParams.get('targetCurrency');
    const days = searchParams.get('days');
    const action = searchParams.get('action'); // 'rates', 'history', 'currencies'

    switch (action) {
      case 'rates':
        if (!baseCurrency || !targetCurrency) {
          return NextResponse.json(
            { error: 'baseCurrency and targetCurrency parameters are required for rates' },
            { status: 400 }
          );
        }

        const rateData = ExchangeRateSchema.parse({
          baseCurrency,
          targetCurrency,
        });

        const exchangeRate = await currencyManager.getExchangeRate(
          rateData.baseCurrency,
          rateData.targetCurrency
        );

        return NextResponse.json({
          success: true,
          data: exchangeRate,
        });

      case 'history':
        if (!baseCurrency || !targetCurrency) {
          return NextResponse.json(
            { error: 'baseCurrency and targetCurrency parameters are required for history' },
            { status: 400 }
          );
        }

        const historyData = HistoricalRateSchema.parse({
          baseCurrency,
          targetCurrency,
          days: days ? parseInt(days) : 30,
        });

        const history = await currencyManager.getExchangeRateHistory(
          historyData.baseCurrency,
          historyData.targetCurrency,
          historyData.days
        );

        return NextResponse.json({
          success: true,
          data: {
            baseCurrency: historyData.baseCurrency,
            targetCurrency: historyData.targetCurrency,
            period: historyData.days,
            history,
          },
        });

      case 'currencies':
      default:
        const currencies = await currencyManager.getSupportedCurrencies();

        return NextResponse.json({
          success: true,
          data: currencies,
        });
    }

  } catch (error) {
    console.error('Currency API error:', error);
    
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