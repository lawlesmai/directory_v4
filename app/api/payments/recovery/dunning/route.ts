/**
 * EPIC 5 STORY 5.7: Payment Failure Recovery & Dunning Management
 * Dunning Campaign API - Campaign management and analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import dunningManager from '@/lib/payments/dunning-manager';
import { withAuth } from '@/lib/api/middleware';

// =============================================
// VALIDATION SCHEMAS
// =============================================

const CreateCampaignSchema = z.object({
  customerId: z.string().uuid(),
  paymentFailureId: z.string().uuid(),
  campaignType: z.enum(['standard', 'high_value', 'at_risk']).default('standard'),
  communicationChannels: z.array(z.string()).default(['email']),
  personalizationData: z.record(z.any()).default({}),
  abTestGroup: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const GetCampaignsSchema = z.object({
  customerId: z.string().uuid().optional(),
  paymentFailureId: z.string().uuid().optional(),
  status: z.enum(['active', 'paused', 'completed', 'canceled']).optional(),
  campaignType: z.enum(['standard', 'high_value', 'at_risk']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

const UpdateCampaignSchema = z.object({
  campaignId: z.string().uuid(),
  status: z.enum(['active', 'paused', 'completed', 'canceled']).optional(),
  communicationChannels: z.array(z.string()).optional(),
  personalizationData: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

// =============================================
// API HANDLERS
// =============================================

/**
 * POST /api/payments/recovery/dunning
 * Create a new dunning campaign
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const body = await req.json();
      const data = CreateCampaignSchema.parse(body);

      const supabase = createClient();

      // Verify user has access to the customer/failure
      const { data: customer, error: customerError } = await supabase
        .from('stripe_customers')
        .select('user_id, business_id')
        .eq('id', data.customerId)
        .single();

      if (customerError || !customer) {
        return NextResponse.json(
          { error: 'Customer not found' },
          { status: 404 }
        );
      }

      // Check access permissions
      const hasAccess = customer.user_id === user.id ||
        (customer.business_id && await checkBusinessAccess(
          user.id,
          customer.business_id,
          supabase
        ));

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }

      // Create the campaign
      const campaign = await dunningManager.createCampaign(data);

      return NextResponse.json({
        campaign: {
          id: campaign.id,
          customerId: campaign.customerId,
          paymentFailureId: campaign.paymentFailureId,
          campaignType: campaign.campaignType,
          sequenceStep: campaign.sequenceStep,
          status: campaign.status,
          currentStepStatus: campaign.currentStepStatus,
          totalSteps: campaign.totalSteps,
          startedAt: campaign.startedAt,
          nextCommunicationAt: campaign.nextCommunicationAt,
          communicationChannels: campaign.communicationChannels,
          abTestGroup: campaign.abTestGroup,
          createdAt: campaign.createdAt,
          updatedAt: campaign.updatedAt,
        },
      });
    } catch (error) {
      console.error('Create dunning campaign API error:', error);
      
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request data', details: error.errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to create campaign' },
        { status: 500 }
      );
    }
  });
}

/**
 * GET /api/payments/recovery/dunning
 * Get dunning campaigns with filtering and pagination
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const { searchParams } = new URL(req.url);
      const query = {
        customerId: searchParams.get('customerId') || undefined,
        paymentFailureId: searchParams.get('paymentFailureId') || undefined,
        status: searchParams.get('status') as any || undefined,
        campaignType: searchParams.get('campaignType') as any || undefined,
        limit: parseInt(searchParams.get('limit') || '20'),
        offset: parseInt(searchParams.get('offset') || '0'),
      };

      const { customerId, paymentFailureId, status, campaignType, limit, offset } = GetCampaignsSchema.parse(query);

      const supabase = createClient();

      // Build query
      let dbQuery = supabase
        .from('dunning_campaigns')
        .select(`
          *,
          stripe_customers!inner(
            id,
            user_id,
            business_id,
            email,
            name
          ),
          payment_failures(
            id,
            failure_reason,
            amount,
            currency
          )
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Add filters
      if (customerId) {
        dbQuery = dbQuery.eq('customer_id', customerId);
      }

      if (paymentFailureId) {
        dbQuery = dbQuery.eq('payment_failure_id', paymentFailureId);
      }

      if (status) {
        dbQuery = dbQuery.eq('status', status);
      }

      if (campaignType) {
        dbQuery = dbQuery.eq('campaign_type', campaignType);
      }

      const { data: campaigns, error } = await dbQuery;

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      if (!campaigns) {
        return NextResponse.json({ campaigns: [], total: 0 });
      }

      // Filter results based on user access
      const accessibleCampaigns = [];
      for (const campaign of campaigns) {
        const hasAccess = campaign.stripe_customers.user_id === user.id ||
          (campaign.stripe_customers.business_id && await checkBusinessAccess(
            user.id,
            campaign.stripe_customers.business_id,
            supabase
          ));

        if (hasAccess) {
          accessibleCampaigns.push({
            id: campaign.id,
            customerId: campaign.customer_id,
            paymentFailureId: campaign.payment_failure_id,
            customer: {
              id: campaign.stripe_customers.id,
              email: campaign.stripe_customers.email,
              name: campaign.stripe_customers.name,
            },
            paymentFailure: campaign.payment_failures ? {
              id: campaign.payment_failures.id,
              failureReason: campaign.payment_failures.failure_reason,
              amount: campaign.payment_failures.amount,
              currency: campaign.payment_failures.currency,
            } : undefined,
            campaignType: campaign.campaign_type,
            sequenceStep: campaign.sequence_step,
            status: campaign.status,
            currentStepStatus: campaign.current_step_status,
            totalSteps: campaign.total_steps,
            startedAt: campaign.started_at,
            completedAt: campaign.completed_at,
            nextCommunicationAt: campaign.next_communication_at,
            lastCommunicationAt: campaign.last_communication_at,
            communicationChannels: campaign.communication_channels,
            abTestGroup: campaign.ab_test_group,
            createdAt: campaign.created_at,
            updatedAt: campaign.updated_at,
          });
        }
      }

      return NextResponse.json({
        campaigns: accessibleCampaigns,
        total: accessibleCampaigns.length,
        hasMore: campaigns.length === limit,
      });
    } catch (error) {
      console.error('Get dunning campaigns API error:', error);
      
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request parameters', details: error.errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to get campaigns' },
        { status: 500 }
      );
    }
  });
}

/**
 * PUT /api/payments/recovery/dunning
 * Update a dunning campaign
 */
export async function PUT(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const body = await req.json();
      const { campaignId, ...updates } = UpdateCampaignSchema.parse(body);

      const supabase = createClient();

      // Verify user has access to this campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('dunning_campaigns')
        .select(`
          *,
          stripe_customers!inner(user_id, business_id)
        `)
        .eq('id', campaignId)
        .single();

      if (campaignError || !campaign) {
        return NextResponse.json(
          { error: 'Campaign not found' },
          { status: 404 }
        );
      }

      // Check access permissions
      const hasAccess = campaign.stripe_customers.user_id === user.id ||
        (campaign.stripe_customers.business_id && await checkBusinessAccess(
          user.id,
          campaign.stripe_customers.business_id,
          supabase
        ));

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }

      // Update campaign
      const { data: updatedCampaign, error: updateError } = await supabase
        .from('dunning_campaigns')
        .update({
          status: updates.status,
          communication_channels: updates.communicationChannels,
          personalization_data: updates.personalizationData,
          metadata: {
            ...campaign.metadata,
            ...updates.metadata,
          },
        })
        .eq('id', campaignId)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Database error: ${updateError.message}`);
      }

      return NextResponse.json({
        campaign: {
          id: updatedCampaign.id,
          customerId: updatedCampaign.customer_id,
          paymentFailureId: updatedCampaign.payment_failure_id,
          campaignType: updatedCampaign.campaign_type,
          sequenceStep: updatedCampaign.sequence_step,
          status: updatedCampaign.status,
          currentStepStatus: updatedCampaign.current_step_status,
          totalSteps: updatedCampaign.total_steps,
          startedAt: updatedCampaign.started_at,
          completedAt: updatedCampaign.completed_at,
          nextCommunicationAt: updatedCampaign.next_communication_at,
          lastCommunicationAt: updatedCampaign.last_communication_at,
          communicationChannels: updatedCampaign.communication_channels,
          abTestGroup: updatedCampaign.ab_test_group,
          createdAt: updatedCampaign.created_at,
          updatedAt: updatedCampaign.updated_at,
        },
      });
    } catch (error) {
      console.error('Update dunning campaign API error:', error);
      
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request data', details: error.errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to update campaign' },
        { status: 500 }
      );
    }
  });
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Check if user has access to business
 */
async function checkBusinessAccess(
  userId: string,
  businessId: string,
  supabase: any
): Promise<boolean> {
  try {
    const { data: member } = await supabase
      .from('business_members')
      .select('role')
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .in('role', ['owner', 'admin', 'billing'])
      .single();

    return !!member;
  } catch (error) {
    return false;
  }
}