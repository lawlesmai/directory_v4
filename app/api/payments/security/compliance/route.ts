/**
 * EPIC 5 STORY 5.10: Payment Security & Compliance
 * Compliance API Endpoints
 * 
 * Provides compliance assessment, audit trail management,
 * regulatory reporting, and compliance monitoring endpoints.
 */

import { NextRequest, NextResponse } from 'next/server';
import complianceAuditor, { ComplianceFramework, ReportType, AuditEventType } from '@/lib/payments/compliance-auditor';
import securityFramework, { ComplianceStatus } from '@/lib/payments/security-framework';
import paymentSecurity from '@/lib/payments/security-middleware';
import { z } from 'zod';

// =============================================
// REQUEST VALIDATION SCHEMAS
// =============================================

const PerformAssessmentSchema = z.object({
  framework: z.nativeEnum(ComplianceFramework).default(ComplianceFramework.PCI_DSS),
  scope: z.object({
    systems: z.array(z.string()).optional(),
    dataTypes: z.array(z.string()).optional(),
    processes: z.array(z.string()).optional(),
    locations: z.array(z.string()).optional()
  }).optional()
});

const GenerateReportSchema = z.object({
  assessmentId: z.string().optional(),
  reportType: z.nativeEnum(ReportType).default(ReportType.COMPLIANCE_ASSESSMENT),
  framework: z.nativeEnum(ComplianceFramework).default(ComplianceFramework.PCI_DSS),
  period: z.object({
    startDate: z.string().refine((date) => !isNaN(Date.parse(date))),
    endDate: z.string().refine((date) => !isNaN(Date.parse(date)))
  }).optional()
});

const ValidateAuditTrailSchema = z.object({
  startDate: z.string().refine((date) => !isNaN(Date.parse(date))),
  endDate: z.string().refine((date) => !isNaN(Date.parse(date))),
  eventTypes: z.array(z.nativeEnum(AuditEventType)).optional()
});

const RecordAuditEntrySchema = z.object({
  eventType: z.nativeEnum(AuditEventType),
  userId: z.string(),
  resource: z.string(),
  action: z.string(),
  beforeState: z.any().optional(),
  afterState: z.any().optional(),
  success: z.boolean(),
  error: z.string().optional(),
  complianceRelevant: z.boolean().default(true),
  retentionPeriod: z.number().min(1).max(2555).default(2555) // Default 7 years for PCI compliance
});

// =============================================
// GET - Compliance Status and Metrics
// =============================================

export async function GET(request: NextRequest) {
  try {
    // Validate security permissions
    const { context, response } = await paymentSecurity.validatePaymentRequest(
      request,
      ['admin', 'compliance_officer', 'security_analyst'],
      false
    );

    if (response) {
      return response;
    }

    const url = new URL(request.url);
    const framework = url.searchParams.get('framework') as ComplianceFramework || ComplianceFramework.PCI_DSS;

    // Validate framework parameter
    if (!Object.values(ComplianceFramework).includes(framework)) {
      return NextResponse.json(
        { error: 'Invalid compliance framework' },
        { status: 400 }
      );
    }

    // Get current compliance status
    const [complianceValidation, policyCompliance, regulatoryTracker] = await Promise.all([
      securityFramework.validatePCICompliance(),
      complianceAuditor.monitorPolicyCompliance(),
      complianceAuditor.trackRegulatoryRequirements()
    ]);

    // Get recent assessments
    const recentAssessments = await getRecentAssessments(framework);

    const response_data = {
      timestamp: new Date().toISOString(),
      framework,
      complianceStatus: {
        overall: complianceValidation.status,
        score: complianceValidation.score,
        lastAssessment: complianceValidation.lastAssessment,
        nextAssessment: complianceValidation.nextAssessment,
        certificationExpiry: complianceValidation.certificationExpiry
      },
      policyCompliance: {
        totalPolicies: policyCompliance.totalPolicies,
        compliantPolicies: policyCompliance.compliantPolicies,
        overallScore: policyCompliance.overallScore,
        criticalViolations: policyCompliance.criticalViolations
      },
      regulatoryStatus: {
        overallRisk: regulatoryTracker.riskExposure,
        upcomingDeadlines: regulatoryTracker.upcomingDeadlines.length,
        complianceGaps: regulatoryTracker.complianceGaps.length,
        lastUpdated: regulatoryTracker.lastUpdated
      },
      recentAssessments,
      recommendations: [
        ...complianceValidation.recommendations.slice(0, 5),
        ...policyCompliance.recommendations.slice(0, 3)
      ].slice(0, 8),
      violations: complianceValidation.violations.filter(v => 
        v.severity === 'critical' || v.severity === 'high'
      ).slice(0, 10)
    };

    // Log successful request
    await paymentSecurity.logPaymentEvent(
      context,
      'compliance_status_retrieved',
      'compliance_api',
      true,
      { framework }
    );

    return NextResponse.json(response_data, { 
      status: 200,
      headers: {
        'Cache-Control': 'private, max-age=300', // Cache for 5 minutes
        'X-Compliance-Framework': framework
      }
    });
  } catch (error) {
    console.error('Compliance status API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Compliance status retrieval failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// =============================================
// POST - Perform Compliance Assessment
// =============================================

export async function POST(request: NextRequest) {
  try {
    // Validate security permissions - only compliance officers and admins can trigger assessments
    const { context, response } = await paymentSecurity.validatePaymentRequest(
      request,
      ['admin', 'compliance_officer'],
      false
    );

    if (response) {
      return response;
    }

    // Parse request body
    const body = await request.json();

    // Validate request data
    const validation = PerformAssessmentSchema.safeParse(body);
    if (!validation.success) {
      await paymentSecurity.logPaymentEvent(
        context,
        'compliance_assessment_validation_error',
        'compliance_api',
        false,
        { errors: validation.error.errors },
        'Invalid assessment parameters'
      );

      return NextResponse.json(
        { error: 'Invalid assessment parameters', details: validation.error.errors },
        { status: 400 }
      );
    }

    const assessmentData = validation.data;

    // Perform compliance assessment
    const assessment = await complianceAuditor.performComplianceAssessment(
      assessmentData.framework,
      assessmentData.scope
    );

    // Record audit entry for the assessment
    await complianceAuditor.recordAuditEntry({
      eventType: AuditEventType.SYSTEM_CONFIGURATION,
      userId: context.userId,
      resource: 'compliance_assessment',
      action: 'assessment_performed',
      afterState: {
        assessmentId: assessment.id,
        framework: assessment.framework,
        score: assessment.overallScore,
        status: assessment.status
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
      success: true,
      complianceRelevant: true,
      retentionPeriod: 2555 // 7 years
    });

    // Log successful assessment
    await paymentSecurity.logPaymentEvent(
      context,
      'compliance_assessment_performed',
      'compliance_api',
      true,
      { 
        assessmentId: assessment.id,
        framework: assessmentData.framework,
        score: assessment.overallScore,
        status: assessment.status
      }
    );

    return NextResponse.json(
      {
        assessmentId: assessment.id,
        framework: assessment.framework,
        status: assessment.status,
        overallScore: assessment.overallScore,
        assessmentDate: assessment.assessmentDate,
        nextAssessment: assessment.nextAssessment,
        reportGenerated: assessment.reportGenerated,
        reportPath: assessment.reportPath,
        summary: {
          totalRequirements: assessment.requirements.length,
          compliantRequirements: assessment.requirements.filter(r => r.status === 'compliant').length,
          criticalFindings: assessment.findings.filter(f => f.severity === 'critical').length,
          highFindings: assessment.findings.filter(f => f.severity === 'high').length,
          recommendations: assessment.recommendations.length
        }
      },
      { 
        status: 201,
        headers: {
          'X-Assessment-ID': assessment.id,
          'X-Compliance-Score': assessment.overallScore.toString()
        }
      }
    );
  } catch (error) {
    console.error('Compliance assessment API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Compliance assessment failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// =============================================
// PUT - Generate Compliance Report
// =============================================

export async function PUT(request: NextRequest) {
  try {
    // Validate security permissions
    const { context, response } = await paymentSecurity.validatePaymentRequest(
      request,
      ['admin', 'compliance_officer', 'security_analyst'],
      false
    );

    if (response) {
      return response;
    }

    // Parse request body
    const body = await request.json();

    // Validate request data
    const validation = GenerateReportSchema.safeParse(body);
    if (!validation.success) {
      await paymentSecurity.logPaymentEvent(
        context,
        'compliance_report_validation_error',
        'compliance_api',
        false,
        { errors: validation.error.errors },
        'Invalid report generation parameters'
      );

      return NextResponse.json(
        { error: 'Invalid report parameters', details: validation.error.errors },
        { status: 400 }
      );
    }

    const reportData = validation.data;

    // Get assessment if ID provided, otherwise create new assessment
    let assessment;
    if (reportData.assessmentId) {
      assessment = await getAssessmentById(reportData.assessmentId);
      if (!assessment) {
        return NextResponse.json(
          { error: 'Assessment not found' },
          { status: 404 }
        );
      }
    } else {
      // Perform new assessment for report
      assessment = await complianceAuditor.performComplianceAssessment(reportData.framework);
    }

    // Generate compliance report
    const report = await complianceAuditor.generateComplianceReport(
      assessment,
      reportData.reportType
    );

    // Record audit entry for report generation
    await complianceAuditor.recordAuditEntry({
      eventType: AuditEventType.DATA_ACCESS,
      userId: context.userId,
      resource: 'compliance_report',
      action: 'report_generated',
      afterState: {
        reportId: report.id,
        reportType: report.type,
        framework: report.framework,
        assessmentId: assessment.id
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
      success: true,
      complianceRelevant: true,
      retentionPeriod: 2555 // 7 years
    });

    // Log successful report generation
    await paymentSecurity.logPaymentEvent(
      context,
      'compliance_report_generated',
      'compliance_api',
      true,
      { 
        reportId: report.id,
        reportType: reportData.reportType,
        framework: reportData.framework,
        assessmentId: assessment.id
      }
    );

    return NextResponse.json(
      {
        reportId: report.id,
        reportType: report.type,
        framework: report.framework,
        generatedAt: report.generatedAt,
        filePath: report.filePath,
        confidentiality: report.confidentiality,
        digitalSignature: report.digitalSignature,
        assessmentId: assessment.id,
        summary: {
          complianceScore: assessment.overallScore,
          criticalFindings: report.detailedFindings.filter(f => f.finding.severity === 'critical').length,
          totalRecommendations: report.remediation.prioritizedActions.length,
          estimatedRemediationTime: report.remediation.timeline
        }
      },
      { 
        status: 201,
        headers: {
          'X-Report-ID': report.id,
          'X-Report-Type': report.type,
          'Content-Disposition': `attachment; filename="compliance-report-${report.id}.pdf"`
        }
      }
    );
  } catch (error) {
    console.error('Compliance report generation API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Compliance report generation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// =============================================
// PATCH - Validate Audit Trail
// =============================================

export async function PATCH(request: NextRequest) {
  try {
    // Validate security permissions
    const { context, response } = await paymentSecurity.validatePaymentRequest(
      request,
      ['admin', 'compliance_officer', 'auditor'],
      false
    );

    if (response) {
      return response;
    }

    // Parse request body
    const body = await request.json();

    // Validate request data
    const validation = ValidateAuditTrailSchema.safeParse(body);
    if (!validation.success) {
      await paymentSecurity.logPaymentEvent(
        context,
        'audit_trail_validation_error',
        'compliance_api',
        false,
        { errors: validation.error.errors },
        'Invalid audit trail validation parameters'
      );

      return NextResponse.json(
        { error: 'Invalid validation parameters', details: validation.error.errors },
        { status: 400 }
      );
    }

    const validationData = validation.data;
    const startDate = new Date(validationData.startDate);
    const endDate = new Date(validationData.endDate);

    // Validate date range
    if (startDate >= endDate) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      );
    }

    // Validate audit trail
    const auditValidation = await complianceAuditor.validateAuditTrail(
      startDate,
      endDate,
      validationData.eventTypes
    );

    // Record audit entry for validation
    await complianceAuditor.recordAuditEntry({
      eventType: AuditEventType.SYSTEM_CONFIGURATION,
      userId: context.userId,
      resource: 'audit_trail',
      action: 'audit_trail_validated',
      afterState: {
        period: auditValidation.period,
        totalEvents: auditValidation.totalEvents,
        complianceScore: auditValidation.complianceScore,
        findings: auditValidation.findings.length
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
      success: true,
      complianceRelevant: true,
      retentionPeriod: 2555 // 7 years
    });

    // Log successful validation
    await paymentSecurity.logPaymentEvent(
      context,
      'audit_trail_validated',
      'compliance_api',
      true,
      { 
        period: auditValidation.period,
        totalEvents: auditValidation.totalEvents,
        complianceScore: auditValidation.complianceScore
      }
    );

    return NextResponse.json(
      {
        validationId: generateValidationId(),
        period: auditValidation.period,
        totalEvents: auditValidation.totalEvents,
        validationResults: auditValidation.validationResults,
        complianceScore: auditValidation.complianceScore,
        findings: auditValidation.findings,
        recommendations: auditValidation.recommendations,
        summary: {
          integrityPassed: auditValidation.validationResults.integrityCheck.passed,
          completenessPassed: auditValidation.validationResults.completenessCheck.passed,
          chronologyPassed: auditValidation.validationResults.chronologyCheck.passed,
          encryptionPassed: auditValidation.validationResults.encryptionCheck.passed,
          overallPassed: Object.values(auditValidation.validationResults).every(result => result.passed)
        }
      },
      { 
        status: 200,
        headers: {
          'X-Validation-Score': auditValidation.complianceScore.toString(),
          'X-Events-Validated': auditValidation.totalEvents.toString()
        }
      }
    );
  } catch (error) {
    console.error('Audit trail validation API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Audit trail validation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// =============================================
// HELPER FUNCTIONS
// =============================================

async function getRecentAssessments(framework: ComplianceFramework, limit: number = 5) {
  try {
    // This would typically query recent assessments from the database
    // For now, returning mock data structure
    return [
      {
        id: 'assess_1',
        framework,
        assessmentDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        status: ComplianceStatus.COMPLIANT,
        score: 92,
        assessor: 'system'
      },
      {
        id: 'assess_2',
        framework,
        assessmentDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        status: ComplianceStatus.PARTIALLY_COMPLIANT,
        score: 78,
        assessor: 'manual'
      }
    ];
  } catch (error) {
    console.error('Error getting recent assessments:', error);
    return [];
  }
}

async function getAssessmentById(assessmentId: string) {
  try {
    // This would typically query the assessment from the database
    // For now, returning null to indicate not implemented
    return null;
  } catch (error) {
    console.error('Error getting assessment by ID:', error);
    return null;
  }
}

function generateValidationId(): string {
  return `val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}