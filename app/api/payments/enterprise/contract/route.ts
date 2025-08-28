/**
 * EPIC 5 STORY 5.8: Enterprise Sales & Custom Billing
 * Enterprise Contract API - Contract lifecycle management for enterprise agreements
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import contractManager from '@/lib/payments/contract-manager';
import { createClient } from '@/lib/supabase/server';

// =============================================
// REQUEST SCHEMAS
// =============================================

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

const ApproveContractSchema = z.object({
  contractId: z.string().uuid(),
  approverEmail: z.string().email(),
  action: z.enum(['approved', 'rejected', 'requested_changes']),
  comments: z.string().optional(),
  changesRequested: z.array(z.string()).optional(),
});

const CreateAmendmentSchema = z.object({
  contractId: z.string().uuid(),
  amendmentType: z.enum(['pricing', 'terms', 'scope', 'compliance', 'other']),
  description: z.string().min(10),
  changes: z.array(z.object({
    field: z.string(),
    oldValue: z.any(),
    newValue: z.any(),
    reason: z.string(),
  })).min(1),
  effectiveDate: z.string().transform(str => new Date(str)),
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

    // Check for appropriate role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select(`roles(name, permissions)`)
      .eq('user_id', user.id)
      .single();

    const roleName = userRole?.roles?.name;
    if (!['admin', 'super_admin', 'legal', 'enterprise_sales', 'contracts_manager'].includes(roleName)) {
      return { isAuthenticated: false, error: 'Insufficient permissions' };
    }

    return { isAuthenticated: true, userId: user.id, role: roleName };
  } catch {
    return { isAuthenticated: false, error: 'Authentication failed' };
  }
}

// =============================================
// POST - Create New Contract
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
    const action = body.action;

    switch (action) {
      case 'create':
        return await handleCreateContract(body);
      
      case 'create_amendment':
        return await handleCreateAmendment(body);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Contract API POST error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Contract operation failed' },
      { status: 500 }
    );
  }
}

// =============================================
// GET - Retrieve Contracts
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
    const action = searchParams.get('action');

    switch (action) {
      case 'list':
        return await handleListContracts(searchParams);
      
      case 'details':
        return await handleGetContractDetails(searchParams);
      
      case 'pending_approval':
        return await handleGetPendingApprovals(searchParams, auth.userId);
      
      case 'renewals':
        return await handleGetRenewals(searchParams);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Contract API GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retrieve contracts' },
      { status: 500 }
    );
  }
}

// =============================================
// PUT - Update Contract Status
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
    const action = body.action;

    switch (action) {
      case 'approve':
        return await handleApproveContract(body);
      
      case 'process_renewal':
        return await handleProcessRenewal(body);
      
      case 'sign':
        return await handleSignContract(body);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Contract API PUT error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Contract update failed' },
      { status: 500 }
    );
  }
}

// =============================================
// HANDLER FUNCTIONS - POST ACTIONS
// =============================================

async function handleCreateContract(body: any) {
  const validatedData = CreateContractSchema.parse(body);
  const contract = await contractManager.createContract(validatedData);
  
  return NextResponse.json({
    success: true,
    data: contract,
    message: 'Contract created successfully and sent for approval',
  });
}

async function handleCreateAmendment(body: any) {
  const validatedData = CreateAmendmentSchema.parse(body);
  const amendment = await contractManager.createAmendment(validatedData);
  
  return NextResponse.json({
    success: true,
    data: amendment,
    message: 'Amendment created successfully',
  });
}

// =============================================
// HANDLER FUNCTIONS - GET ACTIONS
// =============================================

async function handleListContracts(searchParams: URLSearchParams) {
  const customerId = searchParams.get('customerId');
  const status = searchParams.get('status');
  const contractType = searchParams.get('contractType');
  
  const supabase = createClient();
  let query = supabase
    .from('enterprise_contracts')
    .select(`
      *,
      customer:stripe_customers(
        id,
        email,
        name
      )
    `)
    .order('created_at', { ascending: false });

  // Apply filters
  if (customerId) {
    query = query.eq('customer_id', customerId);
  }
  if (status) {
    query = query.eq('status', status);
  }
  if (contractType) {
    query = query.eq('contract_type', contractType);
  }

  const { data: contracts, error } = await query;

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  return NextResponse.json({
    success: true,
    data: contracts || [],
  });
}

async function handleGetContractDetails(searchParams: URLSearchParams) {
  const contractId = searchParams.get('contractId');
  
  if (!contractId) {
    return NextResponse.json(
      { error: 'contractId is required' },
      { status: 400 }
    );
  }

  const contract = await contractManager.getContract(contractId);
  
  if (!contract) {
    return NextResponse.json(
      { error: 'Contract not found' },
      { status: 404 }
    );
  }

  // Get contract activities
  const supabase = createClient();
  const { data: activities } = await supabase
    .from('contract_activities')
    .select('*')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    success: true,
    data: {
      contract,
      activities: activities || [],
    },
  });
}

async function handleGetPendingApprovals(searchParams: URLSearchParams, userId: string) {
  const supabase = createClient();
  
  // Get user email for approval matching
  const { data: user } = await supabase.auth.getUser();
  const userEmail = user.user?.email;

  if (!userEmail) {
    return NextResponse.json(
      { error: 'User email not found' },
      { status: 400 }
    );
  }

  // Get contracts pending approval for this user
  const { data: contracts, error } = await supabase
    .from('enterprise_contracts')
    .select('*')
    .in('status', ['draft', 'under_review'])
    .contains('approval_workflow', { requiredApprovals: [{ email: userEmail }] });

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  // Filter contracts where user hasn't approved yet
  const pendingContracts = contracts?.filter(contract => {
    const approvalHistory = contract.approval_workflow?.approvalHistory || [];
    return !approvalHistory.some((approval: any) => approval.approver === userEmail);
  }) || [];

  return NextResponse.json({
    success: true,
    data: pendingContracts,
  });
}

async function handleGetRenewals(searchParams: URLSearchParams) {
  const supabase = createClient();
  const status = searchParams.get('status') || 'pending';
  
  const { data: renewals, error } = await supabase
    .from('contract_renewals')
    .select(`
      *,
      contract:enterprise_contracts(
        id,
        contract_number,
        company_name,
        terms
      )
    `)
    .eq('status', status)
    .order('renewal_date', { ascending: true });

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  return NextResponse.json({
    success: true,
    data: renewals || [],
  });
}

// =============================================
// HANDLER FUNCTIONS - PUT ACTIONS
// =============================================

async function handleApproveContract(body: any) {
  const validatedData = ApproveContractSchema.parse(body);
  
  await contractManager.approveContract(validatedData);
  
  return NextResponse.json({
    success: true,
    message: `Contract ${validatedData.action} successfully`,
  });
}

async function handleProcessRenewal(body: any) {
  const { contractId, newTerms } = body;
  
  if (!contractId) {
    return NextResponse.json(
      { error: 'contractId is required' },
      { status: 400 }
    );
  }

  const renewal = await contractManager.processRenewal(contractId, newTerms);
  
  return NextResponse.json({
    success: true,
    data: renewal,
    message: 'Renewal processed successfully',
  });
}

async function handleSignContract(body: any) {
  const { contractId, signatoryInfo, signatureMethod } = body;
  
  if (!contractId) {
    return NextResponse.json(
      { error: 'contractId is required' },
      { status: 400 }
    );
  }

  // In production, this would integrate with DocuSign, HelloSign, etc.
  const supabase = createClient();
  const { error } = await supabase
    .from('enterprise_contracts')
    .update({
      status: 'active',
      documents: {
        signatures: [{
          signatory: signatoryInfo.name,
          signatoryRole: signatoryInfo.role,
          signatoryCompany: signatoryInfo.company,
          signedAt: new Date().toISOString(),
          signatureMethod: signatureMethod || 'digital',
          ipAddress: '0.0.0.0', // Would get real IP in production
          documentHash: 'sha256_hash_placeholder',
        }],
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', contractId);

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  return NextResponse.json({
    success: true,
    message: 'Contract signed successfully',
  });
}