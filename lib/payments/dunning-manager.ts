/**
 * EPIC 5 STORY 5.7: Payment Failure Recovery & Dunning Management
 * Dunning Management System - Multi-channel communication sequences and A/B testing
 * 
 * This service manages customer communication sequences for payment recovery,
 * including personalized messaging, A/B testing, and recovery offer management.
 */

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import type { PaymentFailure } from './payment-failure-handler';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface DunningCampaign {
  id: string;
  customerId: string;
  paymentFailureId: string;
  campaignType: 'standard' | 'high_value' | 'at_risk';
  sequenceStep: number;
  status: 'active' | 'paused' | 'completed' | 'canceled';
  currentStepStatus: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed';
  totalSteps: number;
  startedAt: Date;
  completedAt?: Date;
  nextCommunicationAt?: Date;
  lastCommunicationAt?: Date;
  communicationChannels: string[];
  personalizationData: Record<string, any>;
  abTestGroup?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DunningCommunication {
  id: string;
  campaignId: string;
  customerId: string;
  communicationType: 'email' | 'sms' | 'in_app' | 'push';
  templateId?: string;
  subject?: string;
  content: string;
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
  sentAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  bouncedAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  trackingId?: string;
  externalMessageId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignTemplate {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'in_app';
  sequenceStep: number;
  campaignType: string;
  subject?: string;
  content: string;
  variables: string[];
  abTestVariant?: string;
  active: boolean;
  metadata?: Record<string, any>;
}

export interface CampaignPerformance {
  campaignId: string;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  totalFailed: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  conversionRate: number;
  revenueRecovered: number;
}

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

const SendCommunicationSchema = z.object({
  campaignId: z.string().uuid(),
  communicationType: z.enum(['email', 'sms', 'in_app', 'push']),
  templateId: z.string().optional(),
  subject: z.string().optional(),
  content: z.string(),
  metadata: z.record(z.any()).optional(),
});

// =============================================
// DUNNING MANAGER CLASS
// =============================================

class DunningManager {
  private supabase;

  // Campaign sequence configuration
  private readonly SEQUENCE_STEPS = {
    standard: [
      { day: 1, channels: ['email'], urgency: 'low' },
      { day: 3, channels: ['email'], urgency: 'medium' },
      { day: 7, channels: ['email', 'sms'], urgency: 'high' },
      { day: 10, channels: ['email', 'sms'], urgency: 'critical' },
      { day: 30, channels: ['email'], urgency: 'final' },
    ],
    high_value: [
      { day: 1, channels: ['email'], urgency: 'low' },
      { day: 2, channels: ['email', 'sms'], urgency: 'medium' },
      { day: 5, channels: ['email', 'sms'], urgency: 'high' },
      { day: 8, channels: ['email', 'sms', 'in_app'], urgency: 'critical' },
      { day: 14, channels: ['email', 'sms'], urgency: 'final' },
    ],
    at_risk: [
      { day: 0, channels: ['email', 'in_app'], urgency: 'immediate' },
      { day: 1, channels: ['email', 'sms'], urgency: 'high' },
      { day: 3, channels: ['email', 'sms', 'in_app'], urgency: 'critical' },
      { day: 7, channels: ['email', 'sms'], urgency: 'final' },
    ],
  };

  constructor() {
    this.supabase = createClient();
  }

  // =============================================
  // CAMPAIGN MANAGEMENT
  // =============================================

  /**
   * Create and start a new dunning campaign
   */
  async createCampaign(data: z.infer<typeof CreateCampaignSchema>): Promise<DunningCampaign> {
    try {
      const validatedData = CreateCampaignSchema.parse(data);

      // Check if campaign already exists for this failure
      const existingCampaign = await this.findExistingCampaign(validatedData.paymentFailureId);
      if (existingCampaign && existingCampaign.status === 'active') {
        return existingCampaign;
      }

      // Get customer information for personalization
      const customer = await this.getCustomerById(validatedData.customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Determine A/B test group if not specified
      const abTestGroup = validatedData.abTestGroup || this.assignABTestGroup();

      // Get sequence configuration
      const sequence = this.SEQUENCE_STEPS[validatedData.campaignType];
      const firstStep = sequence[0];

      // Calculate next communication time
      const nextCommunicationAt = new Date();
      nextCommunicationAt.setHours(nextCommunicationAt.getHours() + (firstStep.day * 24));

      // Create campaign record
      const { data: campaign, error } = await this.supabase
        .from('dunning_campaigns')
        .insert({
          customer_id: validatedData.customerId,
          payment_failure_id: validatedData.paymentFailureId,
          campaign_type: validatedData.campaignType,
          sequence_step: 1,
          status: 'active',
          current_step_status: 'pending',
          total_steps: sequence.length,
          next_communication_at: nextCommunicationAt.toISOString(),
          communication_channels: validatedData.communicationChannels,
          personalization_data: {
            ...this.buildPersonalizationData(customer),
            ...validatedData.personalizationData,
          },
          ab_test_group: abTestGroup,
          metadata: validatedData.metadata,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Schedule first communication if immediate
      if (firstStep.day === 0) {
        await this.sendStepCommunications(this.mapCampaignFromDB(campaign));
      }

      return this.mapCampaignFromDB(campaign);
    } catch (error) {
      console.error('Create campaign error:', error);
      throw new Error(`Failed to create campaign: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process pending communications (called by background job)
   */
  async processPendingCommunications(): Promise<{
    processed: number;
    sent: number;
    failed: number;
  }> {
    try {
      // Get campaigns ready for next communication
      const { data: campaigns } = await this.supabase
        .from('dunning_campaigns')
        .select('*')
        .eq('status', 'active')
        .eq('current_step_status', 'pending')
        .lte('next_communication_at', new Date().toISOString())
        .order('created_at')
        .limit(100); // Process in batches

      if (!campaigns || campaigns.length === 0) {
        return { processed: 0, sent: 0, failed: 0 };
      }

      let sent = 0;
      let failed = 0;

      for (const campaignData of campaigns) {
        try {
          const campaign = this.mapCampaignFromDB(campaignData);
          await this.sendStepCommunications(campaign);
          sent++;
        } catch (error) {
          console.error(`Failed to send communications for campaign ${campaignData.id}:`, error);
          failed++;
          
          // Mark campaign step as failed
          await this.supabase
            .from('dunning_campaigns')
            .update({ current_step_status: 'failed' })
            .eq('id', campaignData.id);
        }
      }

      return {
        processed: campaigns.length,
        sent,
        failed,
      };
    } catch (error) {
      console.error('Process pending communications error:', error);
      throw new Error(`Failed to process pending communications: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send communications for current campaign step
   */
  private async sendStepCommunications(campaign: DunningCampaign): Promise<void> {
    try {
      const sequence = this.SEQUENCE_STEPS[campaign.campaignType];
      const currentStep = sequence[campaign.sequenceStep - 1];

      if (!currentStep) {
        throw new Error('Invalid sequence step');
      }

      // Get available channels for this step
      const channels = currentStep.channels.filter(channel => 
        campaign.communicationChannels.includes(channel)
      );

      const communications = [];

      // Send communication on each available channel
      for (const channel of channels) {
        try {
          const template = await this.getTemplate(
            campaign.campaignType,
            campaign.sequenceStep,
            channel as 'email' | 'sms' | 'in_app',
            campaign.abTestGroup
          );

          if (template) {
            const personalizedContent = this.personalizeContent(
              template.content,
              campaign.personalizationData
            );

            const personalizedSubject = template.subject ? 
              this.personalizeContent(template.subject, campaign.personalizationData) : 
              undefined;

            const communication = await this.sendCommunication({
              campaignId: campaign.id,
              communicationType: channel as 'email' | 'sms' | 'in_app' | 'push',
              templateId: template.id,
              subject: personalizedSubject,
              content: personalizedContent,
              metadata: {
                sequence_step: campaign.sequenceStep,
                urgency_level: currentStep.urgency,
                ab_test_group: campaign.abTestGroup,
              },
            });

            communications.push(communication);
          }
        } catch (channelError) {
          console.error(`Failed to send ${channel} communication:`, channelError);
        }
      }

      // Update campaign status
      const nextStep = campaign.sequenceStep + 1;
      const isLastStep = nextStep > campaign.totalSteps;

      let updates: any = {
        current_step_status: 'sent',
        last_communication_at: new Date().toISOString(),
      };

      if (isLastStep) {
        updates.status = 'completed';
        updates.completed_at = new Date().toISOString();
      } else {
        const nextStepConfig = sequence[nextStep - 1];
        const nextCommunicationAt = new Date();
        nextCommunicationAt.setHours(nextCommunicationAt.getHours() + (nextStepConfig.day * 24));

        updates.sequence_step = nextStep;
        updates.current_step_status = 'pending';
        updates.next_communication_at = nextCommunicationAt.toISOString();
      }

      await this.supabase
        .from('dunning_campaigns')
        .update(updates)
        .eq('id', campaign.id);

    } catch (error) {
      console.error('Send step communications error:', error);
      throw error;
    }
  }

  // =============================================
  // COMMUNICATION MANAGEMENT
  // =============================================

  /**
   * Send individual communication
   */
  async sendCommunication(data: z.infer<typeof SendCommunicationSchema>): Promise<DunningCommunication> {
    try {
      const validatedData = SendCommunicationSchema.parse(data);

      // Get campaign and customer information
      const campaign = await this.getCampaignById(validatedData.campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      const customer = await this.getCustomerById(campaign.customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Create communication record
      const { data: communication, error } = await this.supabase
        .from('dunning_communications')
        .insert({
          campaign_id: validatedData.campaignId,
          customer_id: campaign.customerId,
          communication_type: validatedData.communicationType,
          template_id: validatedData.templateId,
          subject: validatedData.subject,
          content: validatedData.content,
          status: 'pending',
          metadata: validatedData.metadata,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Send the actual communication
      const success = await this.sendActualCommunication(
        validatedData.communicationType,
        customer,
        validatedData.subject,
        validatedData.content,
        communication.id
      );

      // Update communication status
      const status = success ? 'sent' : 'failed';
      const sentAt = success ? new Date().toISOString() : null;
      
      const { data: updatedCommunication, error: updateError } = await this.supabase
        .from('dunning_communications')
        .update({
          status,
          sent_at: sentAt,
          failure_reason: success ? null : 'Send failed',
        })
        .eq('id', communication.id)
        .select()
        .single();

      if (updateError) {
        console.error('Failed to update communication status:', updateError);
      }

      return this.mapCommunicationFromDB(updatedCommunication || communication);
    } catch (error) {
      console.error('Send communication error:', error);
      throw new Error(`Failed to send communication: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send actual communication via external service
   */
  private async sendActualCommunication(
    type: string,
    customer: any,
    subject: string | undefined,
    content: string,
    communicationId: string
  ): Promise<boolean> {
    try {
      switch (type) {
        case 'email':
          return await this.sendEmail(customer.email, subject || 'Payment Update Required', content, communicationId);
        
        case 'sms':
          if (customer.phone) {
            return await this.sendSMS(customer.phone, content, communicationId);
          }
          return false;
        
        case 'in_app':
          return await this.sendInAppNotification(customer.user_id, content, communicationId);
        
        case 'push':
          return await this.sendPushNotification(customer.user_id, subject || 'Payment Required', content, communicationId);
        
        default:
          console.error(`Unsupported communication type: ${type}`);
          return false;
      }
    } catch (error) {
      console.error(`Failed to send ${type} communication:`, error);
      return false;
    }
  }

  /**
   * Send email communication
   */
  private async sendEmail(email: string, subject: string, content: string, trackingId: string): Promise<boolean> {
    try {
      // Integration with email service (e.g., SendGrid, Mailgun, etc.)
      // This is a placeholder implementation
      console.log(`Sending email to ${email}: ${subject}`);
      console.log(`Content: ${content.substring(0, 100)}...`);
      console.log(`Tracking ID: ${trackingId}`);
      
      // Simulate email sending
      return new Promise((resolve) => {
        setTimeout(() => resolve(true), 100);
      });
    } catch (error) {
      console.error('Email send error:', error);
      return false;
    }
  }

  /**
   * Send SMS communication
   */
  private async sendSMS(phone: string, content: string, trackingId: string): Promise<boolean> {
    try {
      // Integration with SMS service (e.g., Twilio, AWS SNS, etc.)
      // This is a placeholder implementation
      console.log(`Sending SMS to ${phone}: ${content.substring(0, 50)}...`);
      console.log(`Tracking ID: ${trackingId}`);
      
      return new Promise((resolve) => {
        setTimeout(() => resolve(true), 100);
      });
    } catch (error) {
      console.error('SMS send error:', error);
      return false;
    }
  }

  /**
   * Send in-app notification
   */
  private async sendInAppNotification(userId: string, content: string, trackingId: string): Promise<boolean> {
    try {
      // Store notification in database for in-app display
      // This would integrate with your notification system
      console.log(`Sending in-app notification to user ${userId}: ${content.substring(0, 50)}...`);
      console.log(`Tracking ID: ${trackingId}`);
      
      return new Promise((resolve) => {
        setTimeout(() => resolve(true), 100);
      });
    } catch (error) {
      console.error('In-app notification error:', error);
      return false;
    }
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(userId: string, title: string, content: string, trackingId: string): Promise<boolean> {
    try {
      // Integration with push notification service (e.g., Firebase, APNs, etc.)
      console.log(`Sending push notification to user ${userId}: ${title}`);
      console.log(`Content: ${content.substring(0, 50)}...`);
      console.log(`Tracking ID: ${trackingId}`);
      
      return new Promise((resolve) => {
        setTimeout(() => resolve(true), 100);
      });
    } catch (error) {
      console.error('Push notification error:', error);
      return false;
    }
  }

  // =============================================
  // PERSONALIZATION AND TEMPLATES
  // =============================================

  /**
   * Build personalization data from customer information
   */
  private buildPersonalizationData(customer: any): Record<string, any> {
    return {
      customer_name: customer.name || customer.email.split('@')[0],
      customer_email: customer.email,
      customer_first_name: customer.name ? customer.name.split(' ')[0] : customer.email.split('@')[0],
      support_email: process.env.SUPPORT_EMAIL || 'support@example.com',
      support_phone: process.env.SUPPORT_PHONE || '1-800-555-0123',
      company_name: process.env.COMPANY_NAME || 'Your Company',
      login_url: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
      billing_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
    };
  }

  /**
   * Personalize content with customer data
   */
  private personalizeContent(template: string, data: Record<string, any>): string {
    let personalizedContent = template;

    // Replace variables in format {{variable_name}}
    Object.entries(data).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      personalizedContent = personalizedContent.replace(regex, String(value));
    });

    return personalizedContent;
  }

  /**
   * Get template for specific step and channel
   */
  private async getTemplate(
    campaignType: string,
    step: number,
    channel: 'email' | 'sms' | 'in_app',
    abTestGroup?: string
  ): Promise<CampaignTemplate | null> {
    try {
      // This would typically load templates from database or configuration
      // For now, returning hardcoded templates
      const templates = this.getDefaultTemplates();
      
      const templateKey = `${campaignType}_${channel}_step${step}${abTestGroup ? `_${abTestGroup}` : ''}`;
      return templates[templateKey] || templates[`${campaignType}_${channel}_step${step}`] || null;
    } catch (error) {
      console.error('Get template error:', error);
      return null;
    }
  }

  /**
   * Get default campaign templates
   */
  private getDefaultTemplates(): Record<string, CampaignTemplate> {
    return {
      // Standard campaign email templates
      'standard_email_step1': {
        id: 'std_email_1',
        name: 'Standard Day 1 Email',
        type: 'email',
        sequenceStep: 1,
        campaignType: 'standard',
        subject: 'Payment Update Required - {{company_name}}',
        content: `Hi {{customer_first_name}},

We had trouble processing your payment for your {{company_name}} subscription. This can happen for various reasons, such as an expired card or insufficient funds.

To keep your account active, please update your payment information:
👉 {{billing_url}}

If you have any questions, we're here to help at {{support_email}}.

Best regards,
The {{company_name}} Team`,
        variables: ['customer_first_name', 'company_name', 'billing_url', 'support_email'],
        active: true,
      },

      'standard_email_step2': {
        id: 'std_email_2',
        name: 'Standard Day 3 Email',
        type: 'email',
        sequenceStep: 2,
        campaignType: 'standard',
        subject: 'Reminder: Payment Required - {{company_name}}',
        content: `Hi {{customer_first_name}},

We're following up on our previous email about your payment issue. Your {{company_name}} account will be suspended soon if we don't receive payment.

Please update your payment method immediately:
👉 {{billing_url}}

Need assistance? Contact us:
📧 {{support_email}}
📞 {{support_phone}}

Best regards,
The {{company_name}} Team`,
        variables: ['customer_first_name', 'company_name', 'billing_url', 'support_email', 'support_phone'],
        active: true,
      },

      // High value customer templates
      'high_value_email_step1': {
        id: 'hv_email_1',
        name: 'High Value Day 1 Email',
        type: 'email',
        sequenceStep: 1,
        campaignType: 'high_value',
        subject: 'Priority Support: Payment Issue - {{company_name}}',
        content: `Dear {{customer_name}},

As a valued {{company_name}} customer, we wanted to personally reach out about a payment issue with your account.

We're here to help resolve this quickly:
👉 {{billing_url}}

Or contact your dedicated support specialist:
📧 {{support_email}}
📞 {{support_phone}}

We appreciate your business and want to ensure uninterrupted service.

Best regards,
Customer Success Team
{{company_name}}`,
        variables: ['customer_name', 'company_name', 'billing_url', 'support_email', 'support_phone'],
        active: true,
      },

      // SMS templates
      'standard_sms_step3': {
        id: 'std_sms_3',
        name: 'Standard Day 7 SMS',
        type: 'sms',
        sequenceStep: 3,
        campaignType: 'standard',
        content: `{{company_name}}: Your account will be suspended soon due to payment failure. Update your payment: {{billing_url}} or reply HELP for assistance.`,
        variables: ['company_name', 'billing_url'],
        active: true,
      },
    };
  }

  /**
   * Assign A/B test group
   */
  private assignABTestGroup(): string {
    const groups = ['control', 'variant_a', 'variant_b'];
    return groups[Math.floor(Math.random() * groups.length)];
  }

  // =============================================
  // CAMPAIGN ANALYTICS
  // =============================================

  /**
   * Get campaign performance metrics
   */
  async getCampaignPerformance(campaignId: string): Promise<CampaignPerformance> {
    try {
      const { data: communications } = await this.supabase
        .from('dunning_communications')
        .select('status')
        .eq('campaign_id', campaignId);

      if (!communications) {
        return {
          campaignId,
          totalSent: 0,
          totalDelivered: 0,
          totalOpened: 0,
          totalClicked: 0,
          totalBounced: 0,
          totalFailed: 0,
          deliveryRate: 0,
          openRate: 0,
          clickRate: 0,
          bounceRate: 0,
          conversionRate: 0,
          revenueRecovered: 0,
        };
      }

      const totalSent = communications.filter(c => ['sent', 'delivered', 'opened', 'clicked'].includes(c.status)).length;
      const totalDelivered = communications.filter(c => ['delivered', 'opened', 'clicked'].includes(c.status)).length;
      const totalOpened = communications.filter(c => ['opened', 'clicked'].includes(c.status)).length;
      const totalClicked = communications.filter(c => c.status === 'clicked').length;
      const totalBounced = communications.filter(c => c.status === 'bounced').length;
      const totalFailed = communications.filter(c => c.status === 'failed').length;

      return {
        campaignId,
        totalSent,
        totalDelivered,
        totalOpened,
        totalClicked,
        totalBounced,
        totalFailed,
        deliveryRate: totalSent > 0 ? totalDelivered / totalSent : 0,
        openRate: totalDelivered > 0 ? totalOpened / totalDelivered : 0,
        clickRate: totalOpened > 0 ? totalClicked / totalOpened : 0,
        bounceRate: totalSent > 0 ? totalBounced / totalSent : 0,
        conversionRate: 0, // Would need to track actual conversions
        revenueRecovered: 0, // Would need to track recovered payments
      };
    } catch (error) {
      console.error('Get campaign performance error:', error);
      throw new Error(`Failed to get campaign performance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // DATABASE OPERATIONS
  // =============================================

  /**
   * Find existing campaign for payment failure
   */
  private async findExistingCampaign(paymentFailureId: string): Promise<DunningCampaign | null> {
    try {
      const { data: campaign } = await this.supabase
        .from('dunning_campaigns')
        .select('*')
        .eq('payment_failure_id', paymentFailureId)
        .neq('status', 'completed')
        .neq('status', 'canceled')
        .single();

      return campaign ? this.mapCampaignFromDB(campaign) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get campaign by ID
   */
  private async getCampaignById(campaignId: string): Promise<DunningCampaign | null> {
    try {
      const { data: campaign } = await this.supabase
        .from('dunning_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      return campaign ? this.mapCampaignFromDB(campaign) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get customer by ID
   */
  private async getCustomerById(customerId: string): Promise<any> {
    const { data: customer } = await this.supabase
      .from('stripe_customers')
      .select('*')
      .eq('id', customerId)
      .single();

    return customer;
  }

  /**
   * Map database campaign to interface
   */
  private mapCampaignFromDB(campaign: any): DunningCampaign {
    return {
      id: campaign.id,
      customerId: campaign.customer_id,
      paymentFailureId: campaign.payment_failure_id,
      campaignType: campaign.campaign_type,
      sequenceStep: campaign.sequence_step,
      status: campaign.status,
      currentStepStatus: campaign.current_step_status,
      totalSteps: campaign.total_steps,
      startedAt: new Date(campaign.started_at),
      completedAt: campaign.completed_at ? new Date(campaign.completed_at) : undefined,
      nextCommunicationAt: campaign.next_communication_at ? new Date(campaign.next_communication_at) : undefined,
      lastCommunicationAt: campaign.last_communication_at ? new Date(campaign.last_communication_at) : undefined,
      communicationChannels: campaign.communication_channels,
      personalizationData: campaign.personalization_data,
      abTestGroup: campaign.ab_test_group,
      metadata: campaign.metadata,
      createdAt: new Date(campaign.created_at),
      updatedAt: new Date(campaign.updated_at),
    };
  }

  /**
   * Map database communication to interface
   */
  private mapCommunicationFromDB(communication: any): DunningCommunication {
    return {
      id: communication.id,
      campaignId: communication.campaign_id,
      customerId: communication.customer_id,
      communicationType: communication.communication_type,
      templateId: communication.template_id,
      subject: communication.subject,
      content: communication.content,
      status: communication.status,
      sentAt: communication.sent_at ? new Date(communication.sent_at) : undefined,
      deliveredAt: communication.delivered_at ? new Date(communication.delivered_at) : undefined,
      openedAt: communication.opened_at ? new Date(communication.opened_at) : undefined,
      clickedAt: communication.clicked_at ? new Date(communication.clicked_at) : undefined,
      bouncedAt: communication.bounced_at ? new Date(communication.bounced_at) : undefined,
      failedAt: communication.failed_at ? new Date(communication.failed_at) : undefined,
      failureReason: communication.failure_reason,
      trackingId: communication.tracking_id,
      externalMessageId: communication.external_message_id,
      metadata: communication.metadata,
      createdAt: new Date(communication.created_at),
      updatedAt: new Date(communication.updated_at),
    };
  }
}

// =============================================
// SINGLETON INSTANCE
// =============================================

const dunningManager = new DunningManager();

export default dunningManager;
export { DunningManager };
export type { DunningCampaign, DunningCommunication, CampaignTemplate, CampaignPerformance };