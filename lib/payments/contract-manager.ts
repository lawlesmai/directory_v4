/**
 * EPIC 5 STORY 5.8: Enterprise Sales & Custom Billing
 * Contract Manager - Enterprise agreement and contract lifecycle management
 * 
 * This service provides comprehensive contract management including:
 * - Contract creation and approval workflows
 * - Term modification and versioning
 * - Renewal notifications and processing
 * - Compliance tracking and reporting
 * - Master Service Agreements (MSA) and Data Processing Agreements (DPA)
 */

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface EnterpriseContract {
  id: string;
  contractNumber: string;
  customerId: string;
  companyName: string;
  contractType: 'msa' | 'dpa' | 'baa' | 'service_agreement' | 'amendment';
  status: 'draft' | 'under_review' | 'pending_signature' | 'active' | 'expired' | 'terminated';
  version: string;
  parentContractId?: string; // For amendments and versions
  
  // Contract Terms
  terms: {
    effectiveDate: Date;
    expirationDate: Date;
    autoRenewal: boolean;
    renewalPeriod: number; // months
    terminationNotice: number; // days
    minimumCommitment: {
      duration: number; // months
      value: number; // minimum annual spend
      locations: number; // minimum location count
    };
    serviceLevel: {
      uptime: number; // percentage
      supportResponseTime: number; // hours
      implementationTime: number; // days
    };
    liability: {
      limitationType: 'unlimited' | 'capped' | 'mutual';
      capAmount?: number;
      exclusions: string[];
    };
    dataProcessing: {
      dataTypes: string[];
      retentionPeriod: number; // days
      deletionRequirements: string;
      subProcessors: string[];
    };
  };

  // Financial Terms
  pricing: {
    basePrice: number; // per location per month
    volumeDiscounts: VolumeDiscountSchedule[];
    setupFees: number;
    professionalServices: number;
    currency: string;
    paymentTerms: 'net_30' | 'net_60' | 'net_90' | 'annual_prepaid';
    escalationClause: {
      enabled: boolean;
      rate: number; // annual percentage increase
      capPercentage: number; // maximum increase per year
    };
  };

  // Compliance Requirements
  compliance: {
    required: ComplianceRequirement[];
    certifications: ComplianceCertification[];
    auditSchedule: AuditSchedule;
    reportingRequirements: ReportingRequirement[];
  };

  // Approval Workflow
  approvalWorkflow: {
    requiredApprovals: ApprovalRequirement[];
    currentStage: string;
    approvalHistory: ApprovalHistory[];
    finalApprover: string;
  };

  // Contract Documents
  documents: {
    mainContract: DocumentReference;
    amendments: DocumentReference[];
    exhibits: DocumentReference[];
    signatures: SignatureRecord[];
  };

  // Metadata
  createdBy: string;
  assignedLegal: string;
  assignedSales: string;
  tags: string[];
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VolumeDiscountSchedule {
  minLocations: number;
  maxLocations?: number;
  discountPercentage: number;
  additionalBenefits: string[];
}

export interface ComplianceRequirement {
  type: 'soc2' | 'iso27001' | 'hipaa' | 'gdpr' | 'ccpa' | 'pci_dss';
  description: string;
  deadline: Date;
  responsible: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  evidence: string[];
}

export interface ComplianceCertification {
  type: string;
  certifyingBody: string;
  validFrom: Date;
  validUntil: Date;
  certificateUrl: string;
  scope: string;
}

export interface AuditSchedule {
  frequency: 'quarterly' | 'semi_annually' | 'annually';
  nextAuditDate: Date;
  auditType: 'internal' | 'third_party' | 'customer';
  auditor: string;
}

export interface ReportingRequirement {
  type: 'sla_performance' | 'usage_metrics' | 'security_incidents' | 'compliance_status';
  frequency: 'weekly' | 'monthly' | 'quarterly';
  deliveryMethod: 'email' | 'portal' | 'api';
  recipients: string[];
}

export interface ApprovalRequirement {
  role: 'legal' | 'finance' | 'security' | 'executive' | 'customer_legal';
  name: string;
  email: string;
  required: boolean;
  order: number;
}

export interface ApprovalHistory {
  approver: string;
  approverRole: string;
  action: 'approved' | 'rejected' | 'requested_changes';
  timestamp: Date;
  comments: string;
  changesRequested?: string[];
}

export interface DocumentReference {
  filename: string;
  url: string;
  version: string;
  uploadedBy: string;
  uploadedAt: Date;
  fileType: string;
  fileSize: number;
}

export interface SignatureRecord {
  signatory: string;
  signatoryRole: string;
  signatoryCompany: string;
  signedAt: Date;
  signatureMethod: 'docusign' | 'hellosign' | 'adobe_sign' | 'wet_signature';
  ipAddress: string;
  documentHash: string;
}

export interface ContractRenewal {
  id: string;
  contractId: string;
  renewalType: 'automatic' | 'manual';
  renewalDate: Date;
  newTerms: Partial<EnterpriseContract['terms']>;
  status: 'pending' | 'approved' | 'declined' | 'expired';
  notificationsSent: Date[];
  customerResponse?: string;
  createdAt: Date;
}

export interface ContractAmendment {
  id: string;
  contractId: string;
  amendmentType: 'pricing' | 'terms' | 'scope' | 'compliance' | 'other';
  description: string;
  changes: ContractChange[];
  effectiveDate: Date;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  approvalWorkflow: ApprovalRequirement[];
  createdBy: string;
  createdAt: Date;
}

export interface ContractChange {
  field: string;
  oldValue: any;
  newValue: any;
  reason: string;
}

// =============================================
// VALIDATION SCHEMAS
// =============================================

const CreateContractSchema = z.object({
  customerId: z.string().uuid(),
  companyName: z.string().min(2).max(255),
  contractType: z.enum(['msa', 'dpa', 'baa', 'service_agreement', 'amendment']),
  terms: z.object({
    effectiveDate: z.date(),
    expirationDate: z.date(),
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
  effectiveDate: z.date(),
});

const ApproveContractSchema = z.object({
  contractId: z.string().uuid(),
  approverEmail: z.string().email(),
  action: z.enum(['approved', 'rejected', 'requested_changes']),
  comments: z.string().optional(),
  changesRequested: z.array(z.string()).optional(),
});

// =============================================
// CONTRACT MANAGER CLASS
// =============================================

class ContractManager {
  private supabase;

  // Standard contract templates
  private readonly CONTRACT_TEMPLATES = {
    msa: {
      standardTerms: {
        renewalPeriod: 12,
        terminationNotice: 90,
        defaultLiability: 'capped',
        defaultUptime: 99.5,
      },
      requiredApprovals: ['legal', 'finance', 'executive'],
    },
    dpa: {
      standardTerms: {
        dataRetention: 2555, // 7 years in days
        subProcessorNotification: 30, // days
      },
      requiredApprovals: ['legal', 'security'],
    },
    baa: {
      standardTerms: {
        dataRetention: 2555, // 7 years
        breachNotification: 1, // days
      },
      requiredApprovals: ['legal', 'security', 'compliance'],
    },
  };

  constructor() {
    this.supabase = createClient();
  }

  // =============================================
  // CONTRACT CREATION & MANAGEMENT
  // =============================================

  /**
   * Create new enterprise contract
   */
  async createContract(data: z.infer<typeof CreateContractSchema>): Promise<EnterpriseContract> {
    try {
      const validatedData = CreateContractSchema.parse(data);

      // Generate contract number
      const contractNumber = await this.generateContractNumber(validatedData.contractType);

      // Get template defaults for contract type
      const template = this.CONTRACT_TEMPLATES[validatedData.contractType as keyof typeof this.CONTRACT_TEMPLATES];

      // Build contract terms with defaults
      const contractTerms = {
        ...validatedData.terms,
        serviceLevel: {
          uptime: template?.standardTerms?.defaultUptime || 99.5,
          supportResponseTime: 4, // hours
          implementationTime: 30, // days
        },
        liability: {
          limitationType: template?.standardTerms?.defaultLiability || 'capped',
          capAmount: validatedData.pricing.basePrice * validatedData.terms.minimumCommitment.locations * 12,
          exclusions: ['gross negligence', 'willful misconduct', 'data breach'],
        },
        dataProcessing: {
          dataTypes: ['business information', 'customer data', 'usage analytics'],
          retentionPeriod: template?.standardTerms?.dataRetention || 2555,
          deletionRequirements: 'Secure deletion within 30 days of contract termination',
          subProcessors: ['AWS', 'Stripe', 'SendGrid'],
        },
      };

      // Setup approval workflow
      const approvalWorkflow = {
        requiredApprovals: this.buildApprovalRequirements(validatedData.contractType, validatedData.pricing.basePrice),
        currentStage: 'legal_review',
        approvalHistory: [],
        finalApprover: 'executive',
      };

      // Create contract record
      const { data: contract, error } = await this.supabase
        .from('enterprise_contracts')
        .insert({
          contract_number: contractNumber,
          customer_id: validatedData.customerId,
          company_name: validatedData.companyName,
          contract_type: validatedData.contractType,
          status: 'draft',
          version: '1.0',
          terms: contractTerms,
          pricing: {
            ...validatedData.pricing,
            volumeDiscounts: this.generateVolumeDiscounts(validatedData.terms.minimumCommitment.locations),
            professionalServices: Math.max(5000, validatedData.pricing.setupFees * 0.3),
            escalationClause: {
              enabled: true,
              rate: 3.0, // 3% annual increase
              capPercentage: 5.0, // max 5% per year
            },
          },
          compliance: this.generateComplianceRequirements(validatedData.contractType),
          approval_workflow: approvalWorkflow,
          documents: {
            mainContract: null,
            amendments: [],
            exhibits: [],
            signatures: [],
          },
          assigned_legal: validatedData.assignedLegal,
          assigned_sales: validatedData.assignedSales,
          tags: [validatedData.contractType, 'enterprise'],
          notes: `Contract created for ${validatedData.companyName}`,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Create initial contract activity
      await this.createContractActivity({
        contractId: contract.id,
        activityType: 'created',
        description: `Contract ${contractNumber} created for ${validatedData.companyName}`,
        performedBy: 'system',
      });

      // Notify legal team for review
      await this.sendContractNotification(contract.id, 'legal_review_requested');

      return this.mapToContract(contract);
    } catch (error) {
      console.error('Create contract error:', error);
      throw new Error(`Failed to create contract: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate volume discount schedule based on location count
   */
  private generateVolumeDiscounts(baseLocations: number): VolumeDiscountSchedule[] {
    const discounts: VolumeDiscountSchedule[] = [];

    if (baseLocations >= 50) {
      discounts.push({
        minLocations: 50,
        maxLocations: 99,
        discountPercentage: 15,
        additionalBenefits: ['Priority Support', 'Monthly Business Reviews'],
      });
    }

    if (baseLocations >= 100) {
      discounts.push({
        minLocations: 100,
        maxLocations: 499,
        discountPercentage: 20,
        additionalBenefits: ['Dedicated CSM', 'API Access', 'Custom Integrations'],
      });
    }

    if (baseLocations >= 500) {
      discounts.push({
        minLocations: 500,
        maxLocations: 999,
        discountPercentage: 25,
        additionalBenefits: ['White-label Options', 'Advanced Analytics', 'SLA Guarantees'],
      });
    }

    if (baseLocations >= 1000) {
      discounts.push({
        minLocations: 1000,
        discountPercentage: 30,
        additionalBenefits: ['Custom Development', 'Dedicated Infrastructure', 'Strategic Planning'],
      });
    }

    return discounts;
  }

  /**
   * Generate compliance requirements based on contract type
   */
  private generateComplianceRequirements(contractType: string): any {
    const baseRequirements: ComplianceRequirement[] = [
      {
        type: 'soc2',
        description: 'SOC 2 Type II compliance certification',
        deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        responsible: 'security',
        status: 'pending',
        evidence: [],
      },
    ];

    if (contractType === 'dpa' || contractType === 'baa') {
      baseRequirements.push({
        type: 'gdpr',
        description: 'GDPR compliance for data processing',
        deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        responsible: 'legal',
        status: 'pending',
        evidence: [],
      });
    }

    if (contractType === 'baa') {
      baseRequirements.push({
        type: 'hipaa',
        description: 'HIPAA compliance for healthcare data',
        deadline: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000), // 120 days
        responsible: 'compliance',
        status: 'pending',
        evidence: [],
      });
    }

    return {
      required: baseRequirements,
      certifications: [],
      auditSchedule: {
        frequency: 'annually',
        nextAuditDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        auditType: 'third_party',
        auditor: 'External Auditor TBD',
      },
      reportingRequirements: [
        {
          type: 'sla_performance',
          frequency: 'monthly',
          deliveryMethod: 'portal',
          recipients: ['customer_success@customer.com'],
        },
      ],
    };
  }

  /**
   * Build approval requirements based on contract type and value
   */
  private buildApprovalRequirements(contractType: string, contractValue: number): ApprovalRequirement[] {
    const approvals: ApprovalRequirement[] = [];

    // Legal always reviews
    approvals.push({
      role: 'legal',
      name: 'Legal Team',
      email: 'legal@company.com',
      required: true,
      order: 1,
    });

    // Finance for high-value contracts
    if (contractValue > 50000) {
      approvals.push({
        role: 'finance',
        name: 'Finance Director',
        email: 'finance@company.com',
        required: true,
        order: 2,
      });
    }

    // Security for data processing contracts
    if (contractType === 'dpa' || contractType === 'baa') {
      approvals.push({
        role: 'security',
        name: 'Security Officer',
        email: 'security@company.com',
        required: true,
        order: approvals.length + 1,
      });
    }

    // Executive for large contracts
    if (contractValue > 100000) {
      approvals.push({
        role: 'executive',
        name: 'CEO',
        email: 'ceo@company.com',
        required: true,
        order: approvals.length + 1,
      });
    }

    return approvals;
  }

  // =============================================
  // CONTRACT APPROVAL WORKFLOW
  // =============================================

  /**
   * Process contract approval
   */
  async approveContract(data: z.infer<typeof ApproveContractSchema>): Promise<void> {
    try {
      const validatedData = ApproveContractSchema.parse(data);

      // Get current contract
      const { data: contract, error: fetchError } = await this.supabase
        .from('enterprise_contracts')
        .select('*')
        .eq('id', validatedData.contractId)
        .single();

      if (fetchError || !contract) {
        throw new Error('Contract not found');
      }

      // Verify approver is authorized
      const approver = contract.approval_workflow.requiredApprovals.find(
        (req: any) => req.email === validatedData.approverEmail
      );

      if (!approver) {
        throw new Error('Unauthorized approver');
      }

      // Add to approval history
      const approvalRecord: ApprovalHistory = {
        approver: validatedData.approverEmail,
        approverRole: approver.role,
        action: validatedData.action,
        timestamp: new Date(),
        comments: validatedData.comments || '',
        changesRequested: validatedData.changesRequested,
      };

      contract.approval_workflow.approvalHistory.push(approvalRecord);

      let newStatus = contract.status;
      let currentStage = contract.approval_workflow.currentStage;

      if (validatedData.action === 'approved') {
        // Check if all required approvals are complete
        const requiredApprovers = contract.approval_workflow.requiredApprovals
          .filter((req: any) => req.required)
          .map((req: any) => req.email);

        const completedApprovals = contract.approval_workflow.approvalHistory
          .filter((history: any) => history.action === 'approved')
          .map((history: any) => history.approver);

        const allApproved = requiredApprovers.every(email => completedApprovals.includes(email));

        if (allApproved) {
          newStatus = 'pending_signature';
          currentStage = 'signature';
        } else {
          // Move to next approval stage
          const nextApprover = requiredApprovers.find(email => !completedApprovals.includes(email));
          if (nextApprover) {
            const nextApproverReq = contract.approval_workflow.requiredApprovals.find(
              (req: any) => req.email === nextApprover
            );
            currentStage = `${nextApproverReq.role}_review`;
          }
        }
      } else if (validatedData.action === 'rejected') {
        newStatus = 'draft';
        currentStage = 'revision_required';
      }

      // Update contract
      const { error } = await this.supabase
        .from('enterprise_contracts')
        .update({
          status: newStatus,
          approval_workflow: {
            ...contract.approval_workflow,
            currentStage,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', validatedData.contractId);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Create activity record
      await this.createContractActivity({
        contractId: validatedData.contractId,
        activityType: 'approval',
        description: `Contract ${validatedData.action} by ${approver.role}`,
        performedBy: validatedData.approverEmail,
        notes: validatedData.comments,
      });

      // Send notifications
      if (newStatus === 'pending_signature') {
        await this.sendContractNotification(validatedData.contractId, 'ready_for_signature');
      }

      console.log(`Contract ${validatedData.contractId} ${validatedData.action} by ${validatedData.approverEmail}`);
    } catch (error) {
      console.error('Approve contract error:', error);
      throw new Error(`Failed to approve contract: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // CONTRACT AMENDMENTS
  // =============================================

  /**
   * Create contract amendment
   */
  async createAmendment(data: z.infer<typeof CreateAmendmentSchema>): Promise<ContractAmendment> {
    try {
      const validatedData = CreateAmendmentSchema.parse(data);

      // Verify parent contract exists
      const { data: parentContract } = await this.supabase
        .from('enterprise_contracts')
        .select('id, contract_number, company_name')
        .eq('id', validatedData.contractId)
        .single();

      if (!parentContract) {
        throw new Error('Parent contract not found');
      }

      // Create amendment
      const { data: amendment, error } = await this.supabase
        .from('contract_amendments')
        .insert({
          contract_id: validatedData.contractId,
          amendment_type: validatedData.amendmentType,
          description: validatedData.description,
          changes: validatedData.changes,
          effective_date: validatedData.effectiveDate.toISOString(),
          status: 'draft',
          approval_workflow: this.buildApprovalRequirements(validatedData.amendmentType, 0),
          created_by: 'system', // In production, get from auth context
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Create activity
      await this.createContractActivity({
        contractId: validatedData.contractId,
        activityType: 'amendment_created',
        description: `Amendment created for ${validatedData.amendmentType} changes`,
        performedBy: 'system',
      });

      return this.mapToAmendment(amendment);
    } catch (error) {
      console.error('Create amendment error:', error);
      throw new Error(`Failed to create amendment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // CONTRACT RENEWAL
  // =============================================

  /**
   * Process contract renewal
   */
  async processRenewal(contractId: string, newTerms?: Partial<EnterpriseContract['terms']>): Promise<ContractRenewal> {
    try {
      const { data: contract } = await this.supabase
        .from('enterprise_contracts')
        .select('*')
        .eq('id', contractId)
        .single();

      if (!contract) {
        throw new Error('Contract not found');
      }

      // Calculate renewal date
      const currentExpiration = new Date(contract.terms.expirationDate);
      const renewalDate = new Date(currentExpiration);
      renewalDate.setMonth(renewalDate.getMonth() + contract.terms.renewalPeriod);

      // Create renewal record
      const { data: renewal, error } = await this.supabase
        .from('contract_renewals')
        .insert({
          contract_id: contractId,
          renewal_type: contract.terms.autoRenewal ? 'automatic' : 'manual',
          renewal_date: renewalDate.toISOString(),
          new_terms: newTerms || {},
          status: 'pending',
          notifications_sent: [],
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Send renewal notification
      await this.sendRenewalNotification(contractId, renewal.id);

      return this.mapToRenewal(renewal);
    } catch (error) {
      console.error('Process renewal error:', error);
      throw new Error(`Failed to process renewal: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send renewal notification
   */
  private async sendRenewalNotification(contractId: string, renewalId: string): Promise<void> {
    // In production, this would integrate with email service
    console.log(`Renewal notification sent for contract ${contractId}, renewal ${renewalId}`);
    
    // Update notification sent timestamp
    const { error } = await this.supabase
      .from('contract_renewals')
      .update({
        notifications_sent: [new Date().toISOString()],
        updated_at: new Date().toISOString(),
      })
      .eq('id', renewalId);

    if (error) {
      console.error('Error updating renewal notification:', error);
    }
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  /**
   * Generate contract number
   */
  private async generateContractNumber(contractType: string): Promise<string> {
    const prefix = contractType.toUpperCase();
    const year = new Date().getFullYear();
    
    // Get next sequence number
    const { data, error } = await this.supabase
      .from('contract_sequences')
      .select('next_number')
      .eq('prefix', `${prefix}-${year}`)
      .single();

    let nextNumber = 1;
    if (data) {
      nextNumber = data.next_number;
      await this.supabase
        .from('contract_sequences')
        .update({ next_number: nextNumber + 1 })
        .eq('prefix', `${prefix}-${year}`);
    } else {
      await this.supabase
        .from('contract_sequences')
        .insert({
          prefix: `${prefix}-${year}`,
          next_number: 2,
        });
    }

    return `${prefix}-${year}-${String(nextNumber).padStart(4, '0')}`;
  }

  /**
   * Create contract activity record
   */
  private async createContractActivity(activity: {
    contractId: string;
    activityType: string;
    description: string;
    performedBy: string;
    notes?: string;
  }): Promise<void> {
    try {
      await this.supabase
        .from('contract_activities')
        .insert({
          contract_id: activity.contractId,
          activity_type: activity.activityType,
          description: activity.description,
          performed_by: activity.performedBy,
          notes: activity.notes,
        });
    } catch (error) {
      console.error('Create contract activity error:', error);
    }
  }

  /**
   * Send contract notification
   */
  private async sendContractNotification(contractId: string, notificationType: string): Promise<void> {
    // In production, this would integrate with email service
    console.log(`Contract notification sent: ${notificationType} for contract ${contractId}`);
  }

  /**
   * Map database record to contract
   */
  private mapToContract(data: any): EnterpriseContract {
    return {
      id: data.id,
      contractNumber: data.contract_number,
      customerId: data.customer_id,
      companyName: data.company_name,
      contractType: data.contract_type,
      status: data.status,
      version: data.version,
      parentContractId: data.parent_contract_id,
      terms: data.terms,
      pricing: data.pricing,
      compliance: data.compliance,
      approvalWorkflow: data.approval_workflow,
      documents: data.documents,
      createdBy: data.created_by || 'system',
      assignedLegal: data.assigned_legal,
      assignedSales: data.assigned_sales,
      tags: data.tags || [],
      notes: data.notes || '',
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Map database record to amendment
   */
  private mapToAmendment(data: any): ContractAmendment {
    return {
      id: data.id,
      contractId: data.contract_id,
      amendmentType: data.amendment_type,
      description: data.description,
      changes: data.changes,
      effectiveDate: new Date(data.effective_date),
      status: data.status,
      approvalWorkflow: data.approval_workflow,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
    };
  }

  /**
   * Map database record to renewal
   */
  private mapToRenewal(data: any): ContractRenewal {
    return {
      id: data.id,
      contractId: data.contract_id,
      renewalType: data.renewal_type,
      renewalDate: new Date(data.renewal_date),
      newTerms: data.new_terms,
      status: data.status,
      notificationsSent: data.notifications_sent.map((date: string) => new Date(date)),
      customerResponse: data.customer_response,
      createdAt: new Date(data.created_at),
    };
  }

  // =============================================
  // CONTRACT QUERIES
  // =============================================

  /**
   * Get contract by ID
   */
  async getContract(contractId: string): Promise<EnterpriseContract | null> {
    try {
      const { data, error } = await this.supabase
        .from('enterprise_contracts')
        .select('*')
        .eq('id', contractId)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapToContract(data);
    } catch (error) {
      console.error('Get contract error:', error);
      return null;
    }
  }

  /**
   * Get contracts for customer
   */
  async getCustomerContracts(customerId: string): Promise<EnterpriseContract[]> {
    try {
      const { data, error } = await this.supabase
        .from('enterprise_contracts')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) {
        return [];
      }

      return data?.map(contract => this.mapToContract(contract)) || [];
    } catch (error) {
      console.error('Get customer contracts error:', error);
      return [];
    }
  }

  /**
   * Get contracts pending approval
   */
  async getContractsPendingApproval(approverEmail: string): Promise<EnterpriseContract[]> {
    try {
      // This would need a more complex query in production
      // For now, returning empty array
      return [];
    } catch (error) {
      console.error('Get contracts pending approval error:', error);
      return [];
    }
  }
}

// =============================================
// SINGLETON INSTANCE
// =============================================

const contractManager = new ContractManager();

export default contractManager;
export { ContractManager };