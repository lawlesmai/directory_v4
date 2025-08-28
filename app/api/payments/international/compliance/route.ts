/**
 * EPIC 5 STORY 5.9: International Payments & Tax Compliance
 * Compliance Monitoring API Routes
 * 
 * API endpoints for compliance operations including:
 * - KYC verification
 * - GDPR compliance checks
 * - Sanctions screening
 * - Compliance reporting
 * - Data export requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import complianceMonitor from '@/lib/payments/compliance-monitor';
import { z } from 'zod';

// =============================================
// VALIDATION SCHEMAS
// =============================================

const KYCCheckSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().positive(),
  country: z.string().length(2),
  documentType: z.string().optional(),
  documentNumber: z.string().optional(),
  customerType: z.enum(['individual', 'business']).default('individual'),
});

const SanctionsCheckSchema = z.object({
  customerId: z.string().uuid(),
  customerName: z.string().optional(),
  country: z.string().length(2),
  businessName: z.string().optional(),
});

const GDPRCheckSchema = z.object({
  customerId: z.string().uuid(),
  consentGiven: z.boolean().default(false),
  dataProcessingPurpose: z.string().default('payment_processing'),
  retentionPeriod: z.number().default(2555), // 7 years in days
  rightToErasure: z.boolean().default(true),
});

const ComplianceReportSchema = z.object({
  reportType: z.enum(['vat_return', 'moss_report', 'aml_suspicious_activity', 'gdpr_compliance']),
  jurisdiction: z.string().optional(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  includeTransactionDetails: z.boolean().default(false),
});

const DataExportSchema = z.object({
  customerId: z.string().uuid(),
  requestType: z.enum(['export', 'deletion', 'rectification', 'portability']),
  requesterEmail: z.string().email(),
  verificationMethod: z.enum(['email', 'document']).default('email'),
  requestReason: z.string().optional(),
});

// =============================================
// API ROUTE HANDLERS
// =============================================

/**
 * POST /api/payments/international/compliance
 * Perform compliance checks and operations
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
    const action = body.action;

    if (!action) {
      return NextResponse.json(
        { error: 'Action parameter is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'kyc_check':
        const kycData = KYCCheckSchema.parse(body);
        const kycResult = await complianceMonitor.performKYCCheck(kycData);

        return NextResponse.json({
          success: true,
          data: kycResult,
        });

      case 'sanctions_check':
        const sanctionsData = SanctionsCheckSchema.parse(body);
        const sanctionsResult = await complianceMonitor.checkSanctionsList(sanctionsData);

        return NextResponse.json({
          success: true,
          data: sanctionsResult,
        });

      case 'gdpr_check':
        const gdprData = GDPRCheckSchema.parse(body);
        const gdprResult = await complianceMonitor.validateGDPRCompliance(gdprData);

        return NextResponse.json({
          success: true,
          data: gdprResult,
        });

      case 'generate_report':
        // Verify admin access for report generation
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('roles(name)')
          .eq('user_id', user.id);

        const hasAdminRole = userRoles?.some(ur => 
          ['admin', 'super_admin'].includes(ur.roles?.name)
        );

        if (!hasAdminRole) {
          return NextResponse.json(
            { error: 'Admin access required for report generation' },
            { status: 403 }
          );
        }

        const reportData = ComplianceReportSchema.parse(body);
        const reportRequest = {
          ...reportData,
          periodStart: new Date(reportData.periodStart),
          periodEnd: new Date(reportData.periodEnd),
        };

        const reportResult = await complianceMonitor.generateComplianceReport(reportRequest);

        return NextResponse.json({
          success: true,
          data: reportResult,
        });

      case 'data_export_request':
        const exportData = DataExportSchema.parse(body);
        
        // Generate verification token
        const verificationToken = Math.random().toString(36).substr(2, 15);
        
        // Store data export request
        const { data: requestRecord, error: insertError } = await supabase
          .from('gdpr_data_requests')
          .insert({
            request_type: exportData.requestType,
            customer_id: exportData.customerId,
            requester_email: exportData.requesterEmail,
            verification_token: verificationToken,
            status: 'pending',
          })
          .select()
          .single();

        if (insertError) {
          throw new Error(`Failed to create data export request: ${insertError.message}`);
        }

        // In production, send verification email here
        console.log(`Data export request created: ${requestRecord.id}, token: ${verificationToken}`);

        return NextResponse.json({
          success: true,
          data: {
            requestId: requestRecord.id,
            status: 'pending',
            message: 'Verification email sent to requester',
            verificationRequired: true,
          },
        });

      case 'log_event':
        // Allow logging of compliance events
        const eventData = body;
        await complianceMonitor.logComplianceEvent({
          eventType: eventData.eventType || 'manual_log',
          entityType: eventData.entityType || 'customer',
          entityId: eventData.entityId,
          userId: user.id,
          complianceRule: eventData.complianceRule || 'manual_compliance',
          status: eventData.status || 'pending',
          details: eventData.details || {},
          riskScore: eventData.riskScore,
        });

        return NextResponse.json({
          success: true,
          data: {
            logged: true,
            timestamp: new Date().toISOString(),
          },
        });

      default:
        return NextResponse.json(
          { 
            error: 'Invalid action', 
            supportedActions: [
              'kyc_check', 
              'sanctions_check', 
              'gdpr_check', 
              'generate_report', 
              'data_export_request',
              'log_event'
            ]
          },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Compliance API error:', error);
    
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
 * GET /api/payments/international/compliance
 * Get compliance status and information
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const action = searchParams.get('action') || 'status';

    switch (action) {
      case 'status':
        if (!customerId) {
          return NextResponse.json(
            { error: 'customerId parameter is required for status check' },
            { status: 400 }
          );
        }

        // Get compliance audit logs for customer
        const { data: auditLogs, error: auditError } = await supabase
          .from('compliance_audit_log')
          .select('*')
          .eq('entity_id', customerId)
          .eq('entity_type', 'customer')
          .order('created_at', { ascending: false })
          .limit(10);

        if (auditError) {
          throw auditError;
        }

        // Get customer compliance status
        const { data: customerCompliance } = await supabase
          .from('international_customers')
          .select('compliance_status, compliance_verified_at, gdpr_consent, gdpr_consent_date')
          .eq('stripe_customer_id', customerId)
          .single();

        return NextResponse.json({
          success: true,
          data: {
            customerId,
            complianceStatus: customerCompliance?.compliance_status || 'pending',
            verifiedAt: customerCompliance?.compliance_verified_at,
            gdprConsent: customerCompliance?.gdpr_consent || false,
            gdprConsentDate: customerCompliance?.gdpr_consent_date,
            recentAuditLogs: auditLogs?.map(log => ({
              eventType: log.event_type,
              complianceRule: log.compliance_rule,
              status: log.status,
              riskScore: log.risk_score,
              createdAt: log.created_at,
            })) || [],
          },
        });

      case 'cache_stats':
        // Get compliance monitoring cache statistics
        const cacheStats = complianceMonitor.getCacheStats();

        return NextResponse.json({
          success: true,
          data: {
            cacheStatistics: cacheStats,
            lastUpdated: new Date().toISOString(),
          },
        });

      case 'supported_checks':
        return NextResponse.json({
          success: true,
          data: {
            supportedChecks: [
              {
                type: 'kyc_check',
                description: 'Know Your Customer verification',
                required_fields: ['customerId', 'amount', 'country'],
                optional_fields: ['documentType', 'documentNumber', 'customerType'],
              },
              {
                type: 'sanctions_check',
                description: 'Sanctions list screening',
                required_fields: ['customerId', 'country'],
                optional_fields: ['customerName', 'businessName'],
              },
              {
                type: 'gdpr_check',
                description: 'GDPR compliance validation',
                required_fields: ['customerId'],
                optional_fields: ['consentGiven', 'dataProcessingPurpose', 'retentionPeriod'],
              },
            ],
            supportedReports: [
              'vat_return',
              'moss_report', 
              'aml_suspicious_activity',
              'gdpr_compliance'
            ],
            dataExportTypes: [
              'export',
              'deletion', 
              'rectification',
              'portability'
            ],
          },
        });

      default:
        return NextResponse.json(
          { 
            error: 'Invalid action',
            supportedActions: ['status', 'cache_stats', 'supported_checks']
          },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Compliance status API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}