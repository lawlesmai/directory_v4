/**
 * EPIC 5 STORY 5.8: Enterprise Sales & Custom Billing
 * Enterprise Payment API Endpoints - REST API for enterprise billing and sales operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import enterpriseSalesManager from '@/lib/payments/enterprise-sales-manager';
import customBillingEngine from '@/lib/payments/custom-billing-engine';
import contractManager from '@/lib/payments/contract-manager';
import enterpriseAnalytics from '@/lib/analytics/enterprise-analytics';
import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

// =============================================
// REQUEST/RESPONSE SCHEMAS
// =============================================

const CreateLeadSchema = z.object({
  companyName: z.string().min(2).max(255),
  contactName: z.string().min(2).max(255),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  industry: z.string().min(2).max(100),
  locationCount: z.number().min(1),
  estimatedMonthlyVolume: z.number().min(0),
  currentSolution: z.string().optional(),
  budgetRange: z.string().optional(),
  decisionTimeframe: z.string(),
  leadSource: z.string(),
});

const GenerateCustomPricingSchema = z.object({
  leadId: z.string().uuid(),
  pricingTier: z.enum(['volume_50', 'volume_100', 'volume_500', 'volume_1000', 'custom']),
  discountPercentage: z.number().min(0).max(100),
  contractLength: z.number().min(12).max(60),
  paymentTerms: z.enum(['net_30', 'net_60', 'net_90', 'annual_prepaid']),
  customFeatures: z.array(z.string()).optional(),
  supportLevel: z.enum(['standard', 'premium', 'enterprise']),
});

const CreateContractSchema = z.object({
  customerId: z.string().uuid(),
  companyName: z.string().min(2).max(255),
  contractType: z.enum(['msa', 'dpa', 'baa', 'service_agreement', 'amendment']),
  terms: z.object({
    effectiveDate: z.string().transform(str => new Date(str)),
    expirationDate: z.string().transform(str => new Date(str)),
    autoRenewal: z.boolean().default(true),
    renewalPeriod: z.number().min(12).max(60).default(12),
    terminationNotice: z.number().min(30).max(180).default(90),
    minimumCommitment: z.object({
      duration: z.number().min(12).max(60),
      value: z.number().positive(),
      locations: z.number().positive(),
    }),
  }),
  pricing: z.object({
    basePrice: z.number().positive(),
    setupFees: z.number().min(0).default(0),
    currency: z.string().length(3).default('USD'),
    paymentTerms: z.enum(['net_30', 'net_60', 'net_90', 'annual_prepaid']),
  }),
  assignedLegal: z.string().email(),
  assignedSales: z.string().email(),
});

// =============================================
// AUTHENTICATION MIDDLEWARE
// =============================================

async function authenticateRequest(request: NextRequest): Promise<{
  isAuthenticated: boolean;
  userId?: string;
  role?: string;
  error?: string;
}> {
  const supabase = createClient();
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return { isAuthenticated: false, error: 'Unauthorized' };
    }

    // Check if user has enterprise role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select(`
        roles (
          name,
          permissions
        )
      `)
      .eq('user_id', user.id)
      .single();

    const roleName = userRole?.roles?.name;
    if (!['admin', 'super_admin', 'enterprise_sales'].includes(roleName)) {
      return { isAuthenticated: false, error: 'Insufficient permissions' };
    }

    return {
      isAuthenticated: true,
      userId: user.id,
      role: roleName,
    };
  } catch (error) {
    return { isAuthenticated: false, error: 'Authentication failed' };
  }
}

// =============================================
// POST - Create Enterprise Lead
// =============================================

export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: auth.error },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Determine the operation based on the action parameter
    const action = body.action;

    switch (action) {
      case 'create_lead':
        return await handleCreateLead(body);
      
      case 'generate_pricing':
        return await handleGenerateCustomPricing(body);
      
      case 'create_contract':
        return await handleCreateContract(body);
      
      case 'generate_invoice':
        return await handleGenerateCustomInvoice(body);
      
      case 'process_po':
        return await handleProcessPurchaseOrder(body);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Enterprise API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================
// GET - Retrieve Enterprise Data
// =============================================

export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: auth.error },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'leads':
        return await handleGetLeads(searchParams);
      
      case 'lead_details':
        return await handleGetLeadDetails(searchParams);
      
      case 'contracts':
        return await handleGetContracts(searchParams);
      
      case 'analytics':
        return await handleGetAnalytics(searchParams);
      
      case 'sla_metrics':
        return await handleGetSLAMetrics(searchParams);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Enterprise API GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================
// PUT - Update Enterprise Data
// =============================================

export async function PUT(request: NextRequest) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: auth.error },
        { status: 401 }
      );
    }

    const body = await request.json();
    const action = body.action;

    switch (action) {
      case 'update_sales_stage':
        return await handleUpdateSalesStage(body);
      
      case 'approve_contract':
        return await handleApproveContract(body);
      
      case 'approve_po':
        return await handleApprovePurchaseOrder(body);
      
      case 'record_incident':
        return await handleRecordIncident(body);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Enterprise API PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================
// HANDLER FUNCTIONS - POST ACTIONS
// =============================================

async function handleCreateLead(body: any) {
  try {
    const validatedData = CreateLeadSchema.parse(body);
    const lead = await enterpriseSalesManager.createLead(validatedData);
    
    return NextResponse.json({
      success: true,
      data: lead,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create lead' },
      { status: 400 }
    );
  }
}

async function handleGenerateCustomPricing(body: any) {
  try {
    const validatedData = GenerateCustomPricingSchema.parse(body);
    const pricing = await enterpriseSalesManager.generateCustomPricing(validatedData);
    
    return NextResponse.json({
      success: true,
      data: pricing,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate pricing' },
      { status: 400 }
    );
  }
}

async function handleCreateContract(body: any) {
  try {
    const validatedData = CreateContractSchema.parse(body);
    const contract = await contractManager.createContract(validatedData);
    
    return NextResponse.json({
      success: true,
      data: contract,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create contract' },
      { status: 400 }
    );
  }
}

async function handleGenerateCustomInvoice(body: any) {
  try {
    const { enterpriseCustomerId, billingPeriodStart, billingPeriodEnd, locations, purchaseOrder } = body;
    
    const invoice = await customBillingEngine.generateCustomInvoice({
      enterpriseCustomerId,
      billingPeriodStart: new Date(billingPeriodStart),
      billingPeriodEnd: new Date(billingPeriodEnd),
      locations,
      purchaseOrder,
    });
    
    return NextResponse.json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate invoice' },
      { status: 400 }
    );
  }
}

async function handleProcessPurchaseOrder(body: any) {
  try {
    const { poNumber, enterpriseCustomerId, description, amount, costCenter, requestorEmail, department } = body;
    
    const po = await customBillingEngine.processPurchaseOrder({
      poNumber,
      enterpriseCustomerId,
      description,
      amount,
      costCenter,
      requestorEmail,
      department,
    });
    
    return NextResponse.json({
      success: true,
      data: po,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process purchase order' },
      { status: 400 }
    );
  }
}

// =============================================
// HANDLER FUNCTIONS - GET ACTIONS
// =============================================

async function handleGetLeads(searchParams: URLSearchParams) {
  try {
    const qualificationTier = searchParams.get('qualificationTier') || undefined;
    const salesStage = searchParams.get('salesStage') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const result = await enterpriseSalesManager.getLeads({
      qualificationTier,
      salesStage,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get leads' },
      { status: 400 }
    );
  }
}

async function handleGetLeadDetails(searchParams: URLSearchParams) {
  try {
    const leadId = searchParams.get('leadId');
    if (!leadId) {
      return NextResponse.json(
        { error: 'leadId is required' },
        { status: 400 }
      );
    }

    const lead = await enterpriseSalesManager.getLead(leadId);
    const activities = await enterpriseSalesManager.getSalesActivities(leadId);

    return NextResponse.json({
      success: true,
      data: {
        lead,
        activities,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get lead details' },
      { status: 400 }
    );
  }
}

async function handleGetContracts(searchParams: URLSearchParams) {
  try {
    const customerId = searchParams.get('customerId');
    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId is required' },
        { status: 400 }
      );
    }

    const contracts = await contractManager.getCustomerContracts(customerId);

    return NextResponse.json({
      success: true,
      data: contracts,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get contracts' },
      { status: 400 }
    );
  }
}

async function handleGetAnalytics(searchParams: URLSearchParams) {
  try {
    const customerId = searchParams.get('customerId');
    const reportType = searchParams.get('reportType') || 'usage';
    const periodStart = new Date(searchParams.get('periodStart') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const periodEnd = new Date(searchParams.get('periodEnd') || new Date());

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId is required' },
        { status: 400 }
      );
    }

    let analytics;
    switch (reportType) {
      case 'usage':
        analytics = await enterpriseAnalytics.generateUsageAnalytics(customerId, periodStart, periodEnd);
        break;
      case 'sla':
        analytics = await enterpriseAnalytics.generateSLAMetrics(customerId, periodStart, periodEnd);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid report type' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get analytics' },
      { status: 400 }
    );
  }
}

async function handleGetSLAMetrics(searchParams: URLSearchParams) {
  try {
    const customerId = searchParams.get('customerId');
    const periodStart = new Date(searchParams.get('periodStart') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const periodEnd = new Date(searchParams.get('periodEnd') || new Date());

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId is required' },
        { status: 400 }
      );
    }

    const slaMetrics = await enterpriseAnalytics.generateSLAMetrics(customerId, periodStart, periodEnd);

    return NextResponse.json({
      success: true,
      data: slaMetrics,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get SLA metrics' },
      { status: 400 }
    );
  }
}

// =============================================
// HANDLER FUNCTIONS - PUT ACTIONS
// =============================================

async function handleUpdateSalesStage(body: any) {
  try {
    const { leadId, salesStage, notes, nextAction, nextActionDate } = body;
    
    await enterpriseSalesManager.updateSalesStage({
      leadId,
      salesStage,
      notes,
      nextAction,
      nextActionDate: nextActionDate ? new Date(nextActionDate) : undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Sales stage updated successfully',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update sales stage' },
      { status: 400 }
    );
  }
}

async function handleApproveContract(body: any) {
  try {
    const { contractId, approverEmail, action, comments, changesRequested } = body;
    
    await contractManager.approveContract({
      contractId,
      approverEmail,
      action,
      comments,
      changesRequested,
    });

    return NextResponse.json({
      success: true,
      message: 'Contract approval processed successfully',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process contract approval' },
      { status: 400 }
    );
  }
}

async function handleApprovePurchaseOrder(body: any) {
  try {
    const { poId, approverId, notes } = body;
    
    await customBillingEngine.approvePurchaseOrder(poId, approverId, notes);

    return NextResponse.json({
      success: true,
      message: 'Purchase order approved successfully',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to approve purchase order' },
      { status: 400 }
    );
  }
}

async function handleRecordIncident(body: any) {
  try {
    const { customerId, severity, cause, affectedServices, startTime, endTime, customerImpact } = body;
    
    await enterpriseAnalytics.recordIncident({
      customerId,
      severity,
      cause,
      affectedServices,
      startTime: new Date(startTime),
      endTime: endTime ? new Date(endTime) : undefined,
      customerImpact,
    });

    return NextResponse.json({
      success: true,
      message: 'Incident recorded successfully',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to record incident' },
      { status: 400 }
    );
  }
}