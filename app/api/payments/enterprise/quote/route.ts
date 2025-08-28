/**
 * EPIC 5 STORY 5.8: Enterprise Sales & Custom Billing
 * Enterprise Pricing Quote API - Generate custom pricing quotes for enterprise prospects
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import enterpriseSalesManager from '@/lib/payments/enterprise-sales-manager';
import { createClient } from '@/lib/supabase/server';

// =============================================
// REQUEST SCHEMAS
// =============================================

const GenerateQuoteSchema = z.object({
  leadId: z.string().uuid(),
  pricingTier: z.enum(['volume_50', 'volume_100', 'volume_500', 'volume_1000', 'custom']),
  locationCount: z.number().min(50),
  discountPercentage: z.number().min(0).max(50),
  contractLength: z.number().min(12).max(60),
  paymentTerms: z.enum(['net_30', 'net_60', 'net_90', 'annual_prepaid', 'quarterly_prepaid']),
  supportLevel: z.enum(['standard', 'premium', 'enterprise']),
  customFeatures: z.array(z.string()).default([]),
  includeImplementation: z.boolean().default(true),
  includeProfessionalServices: z.boolean().default(false),
  validityDays: z.number().min(30).max(365).default(90),
});

const ROICalculationSchema = z.object({
  leadId: z.string().uuid(),
  currentCosts: z.object({
    platformFees: z.number().min(0),
    maintenanceCosts: z.number().min(0),
    staffTime: z.number().min(0),
    opportunityCosts: z.number().min(0),
  }),
});

// =============================================
// AUTHENTICATION
// =============================================

async function authenticateRequest(request: NextRequest) {
  const supabase = createClient();
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return { isAuthenticated: false, error: 'Unauthorized' };
    }

    // Check for enterprise sales or admin role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select(`roles(name)`)
      .eq('user_id', user.id)
      .single();

    const roleName = userRole?.roles?.name;
    if (!['admin', 'super_admin', 'enterprise_sales', 'sales_manager'].includes(roleName)) {
      return { isAuthenticated: false, error: 'Insufficient permissions' };
    }

    return { isAuthenticated: true, userId: user.id, role: roleName };
  } catch {
    return { isAuthenticated: false, error: 'Authentication failed' };
  }
}

// =============================================
// POST - Generate Custom Quote
// =============================================

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const auth = await authenticateRequest(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: auth.error },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = GenerateQuoteSchema.parse(body);

    // Generate custom pricing
    const pricing = await enterpriseSalesManager.generateCustomPricing({
      leadId: validatedData.leadId,
      pricingTier: validatedData.pricingTier,
      discountPercentage: validatedData.discountPercentage,
      contractLength: validatedData.contractLength,
      paymentTerms: validatedData.paymentTerms,
      customFeatures: validatedData.customFeatures,
      supportLevel: validatedData.supportLevel,
      validityDays: validatedData.validityDays,
    });

    // Calculate detailed quote breakdown
    const quote = await calculateQuoteBreakdown(
      validatedData,
      pricing,
      validatedData.locationCount
    );

    // Log quote generation activity
    await logQuoteActivity(validatedData.leadId, quote, auth.userId);

    return NextResponse.json({
      success: true,
      data: quote,
    });

  } catch (error) {
    console.error('Generate quote error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate quote' },
      { status: 400 }
    );
  }
}

// =============================================
// PUT - Calculate ROI
// =============================================

export async function PUT(request: NextRequest) {
  try {
    // Authenticate
    const auth = await authenticateRequest(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: auth.error },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = ROICalculationSchema.parse(body);

    // Calculate ROI
    const roiCalculation = await enterpriseSalesManager.calculateROI(
      validatedData.leadId,
      validatedData.currentCosts
    );

    return NextResponse.json({
      success: true,
      data: roiCalculation,
    });

  } catch (error) {
    console.error('Calculate ROI error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate ROI' },
      { status: 400 }
    );
  }
}

// =============================================
// GET - Retrieve Quote History
// =============================================

export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const auth = await authenticateRequest(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: auth.error },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');

    if (!leadId) {
      return NextResponse.json(
        { error: 'leadId is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();
    const { data: quotes, error } = await supabase
      .from('enterprise_custom_pricing')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: quotes || [],
    });

  } catch (error) {
    console.error('Get quote history error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get quote history' },
      { status: 400 }
    );
  }
}

// =============================================
// HELPER FUNCTIONS
// =============================================

async function calculateQuoteBreakdown(
  quoteData: z.infer<typeof GenerateQuoteSchema>,
  pricing: any,
  locationCount: number
) {
  const baseMonthlyPrice = pricing.pricing.monthlyPerLocation * locationCount;
  const annualPrice = baseMonthlyPrice * 12;
  const discountAmount = annualPrice * (quoteData.discountPercentage / 100);
  const discountedAnnualPrice = annualPrice - discountAmount;

  // Calculate additional costs
  const setupFee = pricing.pricing.setupFee || 0;
  const professionalServices = quoteData.includeProfessionalServices 
    ? pricing.pricing.professionalServices 
    : 0;

  // Support level pricing
  const supportPremium = quoteData.supportLevel === 'premium' 
    ? baseMonthlyPrice * 0.15 * 12 // 15% premium
    : quoteData.supportLevel === 'enterprise' 
    ? baseMonthlyPrice * 0.25 * 12 // 25% premium
    : 0;

  // Total costs
  const firstYearCost = discountedAnnualPrice + setupFee + professionalServices + supportPremium;
  const recurringAnnualCost = discountedAnnualPrice + supportPremium;

  // Payment terms impact
  let paymentTermsDiscount = 0;
  if (quoteData.paymentTerms === 'annual_prepaid') {
    paymentTermsDiscount = recurringAnnualCost * 0.05; // 5% discount for annual prepaid
  }

  const finalAnnualCost = recurringAnnualCost - paymentTermsDiscount;

  return {
    quoteId: `QUOTE-${Date.now()}`,
    leadId: quoteData.leadId,
    validUntil: new Date(Date.now() + quoteData.validityDays * 24 * 60 * 60 * 1000),
    
    // Pricing breakdown
    pricing: {
      basePrice: {
        monthlyPerLocation: pricing.pricing.monthlyPerLocation,
        totalLocations: locationCount,
        monthlyTotal: baseMonthlyPrice,
        annualTotal: annualPrice,
      },
      discount: {
        percentage: quoteData.discountPercentage,
        amount: discountAmount,
        reason: `Volume discount for ${locationCount} locations`,
      },
      support: {
        level: quoteData.supportLevel,
        annualCost: supportPremium,
        benefits: getSupportBenefits(quoteData.supportLevel),
      },
      additionalCosts: {
        setupFee,
        professionalServices,
        implementation: quoteData.includeImplementation ? Math.max(5000, setupFee * 0.5) : 0,
      },
      paymentTerms: {
        terms: quoteData.paymentTerms,
        discount: paymentTermsDiscount,
        discountReason: quoteData.paymentTerms === 'annual_prepaid' 
          ? '5% discount for annual prepaid' 
          : null,
      },
    },

    // Summary
    summary: {
      firstYearTotal: firstYearCost - paymentTermsDiscount,
      recurringAnnualCost: finalAnnualCost,
      monthlyEquivalent: Math.round(finalAnnualCost / 12 * 100) / 100,
      totalSavings: discountAmount + paymentTermsDiscount,
      effectiveDiscountPercentage: Math.round(
        ((discountAmount + paymentTermsDiscount) / annualPrice) * 100 * 100
      ) / 100,
    },

    // Contract terms
    terms: {
      contractLength: quoteData.contractLength,
      paymentTerms: quoteData.paymentTerms,
      supportLevel: quoteData.supportLevel,
      customFeatures: quoteData.customFeatures,
    },

    // Implementation timeline
    implementation: {
      kickoffTime: '1-2 weeks after contract signing',
      implementationDuration: `${Math.max(30, Math.ceil(locationCount / 50) * 15)} days`,
      goLiveDate: `${Math.max(45, Math.ceil(locationCount / 50) * 20)} days from kickoff`,
      milestones: getImplementationMilestones(locationCount),
    },

    createdAt: new Date(),
    createdBy: 'enterprise_sales',
  };
}

function getSupportBenefits(supportLevel: string): string[] {
  const benefits = {
    standard: [
      'Business hours support (9 AM - 5 PM)',
      'Email support',
      'Knowledge base access',
      '24-48 hour response time',
    ],
    premium: [
      'Extended hours support (7 AM - 7 PM)',
      'Email and phone support',
      'Priority support queue',
      '4-8 hour response time',
      'Dedicated support specialist',
      'Monthly health checks',
    ],
    enterprise: [
      '24/7 support availability',
      'Email, phone, and chat support',
      'Highest priority support queue',
      '1-4 hour response time',
      'Dedicated customer success manager',
      'Weekly business reviews',
      'Custom SLA agreements',
      'Emergency escalation process',
    ],
  };

  return benefits[supportLevel as keyof typeof benefits] || benefits.standard;
}

function getImplementationMilestones(locationCount: number): string[] {
  const baseMilestones = [
    'Contract execution and project kickoff',
    'Technical requirements gathering',
    'System configuration and setup',
    'Data migration and integration',
    'User training and documentation',
    'Testing and quality assurance',
    'Go-live and launch support',
  ];

  if (locationCount >= 500) {
    return [
      ...baseMilestones.slice(0, 3),
      'Pilot program with 10% of locations',
      'Pilot evaluation and optimization',
      ...baseMilestones.slice(3),
      'Phased rollout to remaining locations',
      'Post-launch optimization and support',
    ];
  }

  return baseMilestones;
}

async function logQuoteActivity(leadId: string, quote: any, userId: string) {
  try {
    await enterpriseSalesManager.createSalesActivity({
      leadId,
      activityType: 'proposal',
      subject: `Custom Quote Generated - ${quote.quoteId}`,
      description: `Generated custom pricing quote for ${quote.pricing.basePrice.totalLocations} locations with ${quote.pricing.discount.percentage}% discount`,
      salesRepId: userId,
    });
  } catch (error) {
    console.error('Failed to log quote activity:', error);
    // Don't throw - quote generation should succeed even if logging fails
  }
}