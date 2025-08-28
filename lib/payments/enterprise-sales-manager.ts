/**
 * EPIC 5 STORY 5.8: Enterprise Sales & Custom Billing
 * Enterprise Sales Manager - Lead qualification and management for high-value B2B customers
 * 
 * This service provides comprehensive enterprise sales automation including:
 * - Lead qualification based on size/volume criteria
 * - Custom pricing with volume discounts
 * - Dedicated account management routing
 * - ROI calculation and proposal generation
 * - Contract negotiation support
 */

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface EnterpriseLeadProfile {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  industry: string;
  locationCount: number;
  estimatedMonthlyVolume: number;
  currentSolution?: string;
  budgetRange?: string;
  decisionTimeframe: string;
  qualificationScore: number;
  qualificationTier: 'prospect' | 'qualified' | 'enterprise';
  salesStage: 'discovery' | 'demo' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  assignedSalesRep?: string;
  customPricingTier?: string;
  estimatedArrValue: number;
  leadSource: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnterpriseCustomPricing {
  id: string;
  leadId: string;
  customerId?: string;
  pricingTier: 'volume_50' | 'volume_100' | 'volume_500' | 'volume_1000' | 'custom';
  basePrice: number; // per location per month
  discountPercentage: number;
  minimumCommitment: number; // minimum locations
  contractLength: number; // months
  paymentTerms: 'net_30' | 'net_60' | 'net_90' | 'annual_prepaid';
  customFeatures: string[];
  supportLevel: 'standard' | 'premium' | 'enterprise';
  slaGuarantees: {
    uptime: number;
    supportResponseTime: number; // hours
    implementationTime: number; // days
  };
  pricing: {
    setupFee: number;
    monthlyPerLocation: number;
    annualDiscount: number;
    overageRate: number;
    professionalServices: number;
  };
  validUntil: Date;
  approvedBy?: string;
  createdAt: Date;
}

export interface EnterpriseSalesActivity {
  id: string;
  leadId: string;
  activityType: 'call' | 'email' | 'demo' | 'proposal' | 'meeting' | 'contract_review';
  subject: string;
  description: string;
  outcome?: string;
  nextAction?: string;
  nextActionDate?: Date;
  salesRepId: string;
  attachments?: string[];
  createdAt: Date;
}

export interface EnterpriseROICalculation {
  currentCosts: {
    platformFees: number;
    maintenanceCosts: number;
    staffTime: number;
    opportunityCosts: number;
  };
  projectedSavings: {
    platformEfficiency: number;
    reducedMaintenance: number;
    timeReduction: number;
    increasedRevenue: number;
  };
  implementation: {
    oneTimeCosts: number;
    trainingCosts: number;
    migrationCosts: number;
  };
  roiMetrics: {
    monthlyRoi: number;
    paybackPeriod: number; // months
    threeYearRoi: number;
    netPresentValue: number;
  };
}

// =============================================
// VALIDATION SCHEMAS
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

const UpdateSalesStageSchema = z.object({
  leadId: z.string().uuid(),
  salesStage: z.enum(['discovery', 'demo', 'proposal', 'negotiation', 'closed_won', 'closed_lost']),
  notes: z.string().optional(),
  nextAction: z.string().optional(),
  nextActionDate: z.date().optional(),
});

const CreateCustomPricingSchema = z.object({
  leadId: z.string().uuid(),
  pricingTier: z.enum(['volume_50', 'volume_100', 'volume_500', 'volume_1000', 'custom']),
  discountPercentage: z.number().min(0).max(100),
  contractLength: z.number().min(12).max(60),
  paymentTerms: z.enum(['net_30', 'net_60', 'net_90', 'annual_prepaid']),
  customFeatures: z.array(z.string()).optional(),
  supportLevel: z.enum(['standard', 'premium', 'enterprise']),
  validityDays: z.number().min(30).max(365).default(90),
});

// =============================================
// ENTERPRISE SALES MANAGER CLASS
// =============================================

class EnterpriseSalesManager {
  private supabase;

  // Lead qualification thresholds
  private readonly QUALIFICATION_THRESHOLDS = {
    PROSPECT: { minLocations: 5, minVolume: 1000, minScore: 30 },
    QUALIFIED: { minLocations: 25, minVolume: 5000, minScore: 60 },
    ENTERPRISE: { minLocations: 50, minVolume: 10000, minScore: 80 },
  };

  // Volume pricing tiers
  private readonly VOLUME_PRICING = {
    volume_50: { 
      minLocations: 50, 
      basePrice: 45, 
      discount: 15, 
      setupFee: 5000,
      supportLevel: 'premium' 
    },
    volume_100: { 
      minLocations: 100, 
      basePrice: 42, 
      discount: 20, 
      setupFee: 8000,
      supportLevel: 'premium' 
    },
    volume_500: { 
      minLocations: 500, 
      basePrice: 38, 
      discount: 25, 
      setupFee: 15000,
      supportLevel: 'enterprise' 
    },
    volume_1000: { 
      minLocations: 1000, 
      basePrice: 35, 
      discount: 30, 
      setupFee: 25000,
      supportLevel: 'enterprise' 
    },
    custom: { 
      minLocations: 2000, 
      basePrice: 0, 
      discount: 0, 
      setupFee: 0,
      supportLevel: 'enterprise' 
    },
  };

  constructor() {
    this.supabase = createClient();
  }

  // =============================================
  // LEAD QUALIFICATION & MANAGEMENT
  // =============================================

  /**
   * Create new enterprise lead with automatic qualification
   */
  async createLead(data: z.infer<typeof CreateLeadSchema>): Promise<EnterpriseLeadProfile> {
    try {
      const validatedData = CreateLeadSchema.parse(data);

      // Calculate qualification score
      const qualificationScore = this.calculateQualificationScore(validatedData);
      const qualificationTier = this.determineQualificationTier(qualificationScore, validatedData.locationCount);
      const estimatedArrValue = this.calculateEstimatedArrValue(validatedData.locationCount, validatedData.estimatedMonthlyVolume);

      // Create lead record
      const { data: lead, error } = await this.supabase
        .from('enterprise_leads')
        .insert({
          company_name: validatedData.companyName,
          contact_name: validatedData.contactName,
          contact_email: validatedData.contactEmail,
          contact_phone: validatedData.contactPhone,
          industry: validatedData.industry,
          location_count: validatedData.locationCount,
          estimated_monthly_volume: validatedData.estimatedMonthlyVolume,
          current_solution: validatedData.currentSolution,
          budget_range: validatedData.budgetRange,
          decision_timeframe: validatedData.decisionTimeframe,
          qualification_score: qualificationScore,
          qualification_tier: qualificationTier,
          sales_stage: 'discovery',
          estimated_arr_value: estimatedArrValue,
          lead_source: validatedData.leadSource,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Auto-assign sales rep based on qualification tier
      await this.autoAssignSalesRep(lead.id, qualificationTier);

      // Create initial qualification activity
      await this.createSalesActivity({
        leadId: lead.id,
        activityType: 'email',
        subject: 'Enterprise Lead Qualification',
        description: `New enterprise lead qualified as ${qualificationTier} with score ${qualificationScore}`,
        salesRepId: lead.assigned_sales_rep || 'system',
      });

      return this.mapToLeadProfile(lead);
    } catch (error) {
      console.error('Create lead error:', error);
      throw new Error(`Failed to create lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate lead qualification score based on multiple factors
   */
  private calculateQualificationScore(lead: z.infer<typeof CreateLeadSchema>): number {
    let score = 0;

    // Location count scoring (40% weight)
    if (lead.locationCount >= 1000) score += 40;
    else if (lead.locationCount >= 500) score += 35;
    else if (lead.locationCount >= 100) score += 30;
    else if (lead.locationCount >= 50) score += 25;
    else if (lead.locationCount >= 25) score += 20;
    else if (lead.locationCount >= 10) score += 15;
    else if (lead.locationCount >= 5) score += 10;

    // Volume scoring (30% weight)
    if (lead.estimatedMonthlyVolume >= 100000) score += 30;
    else if (lead.estimatedMonthlyVolume >= 50000) score += 25;
    else if (lead.estimatedMonthlyVolume >= 25000) score += 20;
    else if (lead.estimatedMonthlyVolume >= 10000) score += 15;
    else if (lead.estimatedMonthlyVolume >= 5000) score += 10;
    else if (lead.estimatedMonthlyVolume >= 1000) score += 5;

    // Industry scoring (20% weight)
    const highValueIndustries = ['healthcare', 'finance', 'retail', 'hospitality', 'automotive'];
    const mediumValueIndustries = ['professional_services', 'real_estate', 'education', 'manufacturing'];
    
    if (highValueIndustries.includes(lead.industry.toLowerCase())) score += 20;
    else if (mediumValueIndustries.includes(lead.industry.toLowerCase())) score += 15;
    else score += 10;

    // Decision timeframe scoring (10% weight)
    switch (lead.decisionTimeframe.toLowerCase()) {
      case 'immediate':
      case '0-30 days':
        score += 10;
        break;
      case '1-3 months':
        score += 8;
        break;
      case '3-6 months':
        score += 6;
        break;
      case '6-12 months':
        score += 4;
        break;
      default:
        score += 2;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Determine qualification tier based on score and criteria
   */
  private determineQualificationTier(score: number, locationCount: number): 'prospect' | 'qualified' | 'enterprise' {
    if (locationCount >= this.QUALIFICATION_THRESHOLDS.ENTERPRISE.minLocations && 
        score >= this.QUALIFICATION_THRESHOLDS.ENTERPRISE.minScore) {
      return 'enterprise';
    } else if (locationCount >= this.QUALIFICATION_THRESHOLDS.QUALIFIED.minLocations && 
               score >= this.QUALIFICATION_THRESHOLDS.QUALIFIED.minScore) {
      return 'qualified';
    } else {
      return 'prospect';
    }
  }

  /**
   * Calculate estimated Annual Recurring Revenue value
   */
  private calculateEstimatedArrValue(locationCount: number, monthlyVolume: number): number {
    let basePrice = 79; // Standard professional price
    
    // Apply volume discounts
    if (locationCount >= 1000) basePrice = 35;
    else if (locationCount >= 500) basePrice = 38;
    else if (locationCount >= 100) basePrice = 42;
    else if (locationCount >= 50) basePrice = 45;
    else if (locationCount >= 25) basePrice = 55;

    return basePrice * locationCount * 12;
  }

  /**
   * Auto-assign sales rep based on qualification tier
   */
  private async autoAssignSalesRep(leadId: string, qualificationTier: string): Promise<void> {
    try {
      // Get available sales reps for the tier
      const { data: salesReps } = await this.supabase
        .from('sales_representatives')
        .select('*')
        .eq('active', true)
        .contains('specialties', [qualificationTier])
        .order('current_lead_count', { ascending: true })
        .limit(1);

      if (salesReps && salesReps.length > 0) {
        const assignedRep = salesReps[0];
        
        await this.supabase
          .from('enterprise_leads')
          .update({ 
            assigned_sales_rep: assignedRep.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', leadId);

        // Update rep's lead count
        await this.supabase
          .from('sales_representatives')
          .update({ 
            current_lead_count: assignedRep.current_lead_count + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', assignedRep.id);

        console.log(`Assigned lead ${leadId} to sales rep ${assignedRep.name}`);
      }
    } catch (error) {
      console.error('Auto-assign sales rep error:', error);
      // Continue without assignment - can be manually assigned later
    }
  }

  // =============================================
  // SALES STAGE MANAGEMENT
  // =============================================

  /**
   * Update lead sales stage with activity tracking
   */
  async updateSalesStage(data: z.infer<typeof UpdateSalesStageSchema>): Promise<void> {
    try {
      const validatedData = UpdateSalesStageSchema.parse(data);

      // Update lead stage
      const { error } = await this.supabase
        .from('enterprise_leads')
        .update({
          sales_stage: validatedData.salesStage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', validatedData.leadId);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Create stage change activity
      await this.createSalesActivity({
        leadId: validatedData.leadId,
        activityType: 'call',
        subject: `Sales Stage Updated to ${validatedData.salesStage}`,
        description: validatedData.notes || `Lead moved to ${validatedData.salesStage} stage`,
        nextAction: validatedData.nextAction,
        nextActionDate: validatedData.nextActionDate,
        salesRepId: await this.getAssignedSalesRep(validatedData.leadId),
      });

      console.log(`Updated lead ${validatedData.leadId} to stage ${validatedData.salesStage}`);
    } catch (error) {
      console.error('Update sales stage error:', error);
      throw new Error(`Failed to update sales stage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // CUSTOM PRICING GENERATION
  // =============================================

  /**
   * Generate custom pricing proposal for enterprise lead
   */
  async generateCustomPricing(data: z.infer<typeof CreateCustomPricingSchema>): Promise<EnterpriseCustomPricing> {
    try {
      const validatedData = CreateCustomPricingSchema.parse(data);

      // Get lead details
      const { data: lead } = await this.supabase
        .from('enterprise_leads')
        .select('*')
        .eq('id', validatedData.leadId)
        .single();

      if (!lead) {
        throw new Error('Lead not found');
      }

      // Calculate pricing based on tier and volume
      const pricingConfig = this.VOLUME_PRICING[validatedData.pricingTier];
      const customPricing = this.calculateCustomPricing(lead, pricingConfig, validatedData);

      // Create pricing record
      const { data: pricingRecord, error } = await this.supabase
        .from('enterprise_custom_pricing')
        .insert({
          lead_id: validatedData.leadId,
          pricing_tier: validatedData.pricingTier,
          base_price: pricingConfig.basePrice,
          discount_percentage: validatedData.discountPercentage,
          minimum_commitment: lead.location_count,
          contract_length: validatedData.contractLength,
          payment_terms: validatedData.paymentTerms,
          custom_features: validatedData.customFeatures || [],
          support_level: validatedData.supportLevel,
          sla_guarantees: {
            uptime: validatedData.supportLevel === 'enterprise' ? 99.9 : 99.5,
            supportResponseTime: validatedData.supportLevel === 'enterprise' ? 4 : 8,
            implementationTime: validatedData.supportLevel === 'enterprise' ? 30 : 45,
          },
          pricing: customPricing,
          valid_until: new Date(Date.now() + validatedData.validityDays * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Create pricing activity
      await this.createSalesActivity({
        leadId: validatedData.leadId,
        activityType: 'proposal',
        subject: 'Custom Pricing Proposal Generated',
        description: `Generated ${validatedData.pricingTier} pricing proposal with ${validatedData.discountPercentage}% discount`,
        salesRepId: await this.getAssignedSalesRep(validatedData.leadId),
      });

      return this.mapToCustomPricing(pricingRecord);
    } catch (error) {
      console.error('Generate custom pricing error:', error);
      throw new Error(`Failed to generate custom pricing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate custom pricing structure
   */
  private calculateCustomPricing(lead: any, config: any, data: any): any {
    const baseMonthlyPrice = config.basePrice * lead.location_count;
    const discountAmount = baseMonthlyPrice * (data.discountPercentage / 100);
    const monthlyPrice = baseMonthlyPrice - discountAmount;
    
    let annualDiscount = 0;
    if (data.paymentTerms === 'annual_prepaid') {
      annualDiscount = monthlyPrice * 12 * 0.15; // 15% annual discount
    }

    return {
      setupFee: config.setupFee,
      monthlyPerLocation: config.basePrice - (config.basePrice * data.discountPercentage / 100),
      annualDiscount: annualDiscount,
      overageRate: Math.max(10, config.basePrice * 0.5),
      professionalServices: Math.max(5000, config.setupFee * 0.3),
    };
  }

  // =============================================
  // ROI CALCULATION
  // =============================================

  /**
   * Calculate ROI for enterprise prospect
   */
  async calculateROI(leadId: string, currentCosts: any): Promise<EnterpriseROICalculation> {
    try {
      const { data: lead } = await this.supabase
        .from('enterprise_leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (!lead) {
        throw new Error('Lead not found');
      }

      // Get latest pricing proposal
      const { data: pricing } = await this.supabase
        .from('enterprise_custom_pricing')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!pricing) {
        throw new Error('No pricing proposal found for ROI calculation');
      }

      // Calculate ROI metrics
      const monthlyPlatformCost = pricing.pricing.monthlyPerLocation * lead.location_count;
      const annualPlatformCost = monthlyPlatformCost * 12 - (pricing.pricing.annualDiscount || 0);

      const projectedSavings = {
        platformEfficiency: currentCosts.platformFees - annualPlatformCost,
        reducedMaintenance: currentCosts.maintenanceCosts * 0.6, // 60% reduction
        timeReduction: currentCosts.staffTime * 0.4, // 40% time savings
        increasedRevenue: lead.estimated_monthly_volume * 12 * 0.15, // 15% revenue increase
      };

      const totalSavings = Object.values(projectedSavings).reduce((sum, saving) => sum + saving, 0);
      const totalImplementationCosts = pricing.pricing.setupFee + currentCosts.opportunityCosts;

      const roiMetrics = {
        monthlyRoi: (totalSavings / 12 - monthlyPlatformCost) / monthlyPlatformCost * 100,
        paybackPeriod: totalImplementationCosts / (totalSavings / 12),
        threeYearRoi: ((totalSavings * 3 - totalImplementationCosts - annualPlatformCost * 3) / totalImplementationCosts) * 100,
        netPresentValue: this.calculateNPV(totalSavings, annualPlatformCost, totalImplementationCosts, 0.10),
      };

      return {
        currentCosts,
        projectedSavings,
        implementation: {
          oneTimeCosts: pricing.pricing.setupFee,
          trainingCosts: pricing.pricing.professionalServices * 0.3,
          migrationCosts: pricing.pricing.professionalServices * 0.7,
        },
        roiMetrics,
      };
    } catch (error) {
      console.error('Calculate ROI error:', error);
      throw new Error(`Failed to calculate ROI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate Net Present Value
   */
  private calculateNPV(annualSavings: number, annualCosts: number, initialInvestment: number, discountRate: number): number {
    const cashFlows = Array(5).fill(annualSavings - annualCosts); // 5 year projection
    let npv = -initialInvestment;

    cashFlows.forEach((cashFlow, year) => {
      npv += cashFlow / Math.pow(1 + discountRate, year + 1);
    });

    return npv;
  }

  // =============================================
  // SALES ACTIVITY TRACKING
  // =============================================

  /**
   * Create sales activity record
   */
  async createSalesActivity(activity: Omit<EnterpriseSalesActivity, 'id' | 'createdAt'>): Promise<EnterpriseSalesActivity> {
    try {
      const { data, error } = await this.supabase
        .from('enterprise_sales_activities')
        .insert({
          lead_id: activity.leadId,
          activity_type: activity.activityType,
          subject: activity.subject,
          description: activity.description,
          outcome: activity.outcome,
          next_action: activity.nextAction,
          next_action_date: activity.nextActionDate?.toISOString(),
          sales_rep_id: activity.salesRepId,
          attachments: activity.attachments,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return this.mapToSalesActivity(data);
    } catch (error) {
      console.error('Create sales activity error:', error);
      throw new Error(`Failed to create sales activity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get sales activities for lead
   */
  async getSalesActivities(leadId: string): Promise<EnterpriseSalesActivity[]> {
    try {
      const { data, error } = await this.supabase
        .from('enterprise_sales_activities')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return data?.map(activity => this.mapToSalesActivity(activity)) || [];
    } catch (error) {
      console.error('Get sales activities error:', error);
      return [];
    }
  }

  // =============================================
  // LEAD MANAGEMENT
  // =============================================

  /**
   * Get enterprise lead by ID
   */
  async getLead(leadId: string): Promise<EnterpriseLeadProfile | null> {
    try {
      const { data, error } = await this.supabase
        .from('enterprise_leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapToLeadProfile(data);
    } catch (error) {
      console.error('Get lead error:', error);
      return null;
    }
  }

  /**
   * Get leads with filtering and pagination
   */
  async getLeads(filters: {
    qualificationTier?: string;
    salesStage?: string;
    assignedSalesRep?: string;
    industry?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    leads: EnterpriseLeadProfile[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const offset = (page - 1) * limit;

      let query = this.supabase
        .from('enterprise_leads')
        .select('*', { count: 'exact' });

      // Apply filters
      if (filters.qualificationTier) {
        query = query.eq('qualification_tier', filters.qualificationTier);
      }
      if (filters.salesStage) {
        query = query.eq('sales_stage', filters.salesStage);
      }
      if (filters.assignedSalesRep) {
        query = query.eq('assigned_sales_rep', filters.assignedSalesRep);
      }
      if (filters.industry) {
        query = query.eq('industry', filters.industry);
      }

      const { data, count, error } = await query
        .order('qualification_score', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      const leads = data?.map(lead => this.mapToLeadProfile(lead)) || [];

      return {
        leads,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      };
    } catch (error) {
      console.error('Get leads error:', error);
      return {
        leads: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
    }
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  /**
   * Get assigned sales rep for lead
   */
  private async getAssignedSalesRep(leadId: string): Promise<string> {
    try {
      const { data } = await this.supabase
        .from('enterprise_leads')
        .select('assigned_sales_rep')
        .eq('id', leadId)
        .single();

      return data?.assigned_sales_rep || 'system';
    } catch {
      return 'system';
    }
  }

  /**
   * Map database record to lead profile
   */
  private mapToLeadProfile(data: any): EnterpriseLeadProfile {
    return {
      id: data.id,
      companyName: data.company_name,
      contactName: data.contact_name,
      contactEmail: data.contact_email,
      contactPhone: data.contact_phone,
      industry: data.industry,
      locationCount: data.location_count,
      estimatedMonthlyVolume: data.estimated_monthly_volume,
      currentSolution: data.current_solution,
      budgetRange: data.budget_range,
      decisionTimeframe: data.decision_timeframe,
      qualificationScore: data.qualification_score,
      qualificationTier: data.qualification_tier,
      salesStage: data.sales_stage,
      assignedSalesRep: data.assigned_sales_rep,
      customPricingTier: data.custom_pricing_tier,
      estimatedArrValue: data.estimated_arr_value,
      leadSource: data.lead_source,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Map database record to custom pricing
   */
  private mapToCustomPricing(data: any): EnterpriseCustomPricing {
    return {
      id: data.id,
      leadId: data.lead_id,
      customerId: data.customer_id,
      pricingTier: data.pricing_tier,
      basePrice: data.base_price,
      discountPercentage: data.discount_percentage,
      minimumCommitment: data.minimum_commitment,
      contractLength: data.contract_length,
      paymentTerms: data.payment_terms,
      customFeatures: data.custom_features || [],
      supportLevel: data.support_level,
      slaGuarantees: data.sla_guarantees,
      pricing: data.pricing,
      validUntil: new Date(data.valid_until),
      approvedBy: data.approved_by,
      createdAt: new Date(data.created_at),
    };
  }

  /**
   * Map database record to sales activity
   */
  private mapToSalesActivity(data: any): EnterpriseSalesActivity {
    return {
      id: data.id,
      leadId: data.lead_id,
      activityType: data.activity_type,
      subject: data.subject,
      description: data.description,
      outcome: data.outcome,
      nextAction: data.next_action,
      nextActionDate: data.next_action_date ? new Date(data.next_action_date) : undefined,
      salesRepId: data.sales_rep_id,
      attachments: data.attachments,
      createdAt: new Date(data.created_at),
    };
  }
}

// =============================================
// SINGLETON INSTANCE
// =============================================

const enterpriseSalesManager = new EnterpriseSalesManager();

export default enterpriseSalesManager;
export { EnterpriseSalesManager };