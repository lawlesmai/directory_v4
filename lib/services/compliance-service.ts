/**
 * Compliance Monitoring Service
 * Epic 2 Story 2.9: Business Owner Verification & KYC
 * Comprehensive compliance monitoring, reporting, and audit system
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { riskAssessmentService } from './risk-assessment-service';

type SupabaseClient = ReturnType<typeof createClientComponentClient>;

export interface ComplianceMetrics {
  period: {
    start: string;
    end: string;
    days: number;
  };
  verificationStats: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    approvalRate: number;
    rejectionRate: number;
  };
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  processingMetrics: {
    averageProcessingHours: number;
    slaComplianceRate: number;
    autoApprovalRate: number;
    escalationRate: number;
  };
  complianceAlerts: {
    amlAlerts: number;
    sanctionsHits: number;
    pepMatches: number;
    adverseMediaAlerts: number;
    highRiskCases: number;
  };
  documentMetrics: {
    totalDocuments: number;
    averageQualityScore: number;
    fraudAttempts: number;
    duplicateDocuments: number;
  };
}

export interface ComplianceAlert {
  id: string;
  type: 'aml' | 'sanctions' | 'pep' | 'adverse_media' | 'high_risk' | 'fraud_detected' | 'sla_breach';
  severity: 'low' | 'medium' | 'high' | 'critical';
  verificationId: string;
  userId: string;
  businessId?: string;
  title: string;
  description: string;
  evidence: any;
  requiresAction: boolean;
  assignedTo?: string;
  status: 'new' | 'investigating' | 'resolved' | 'false_positive';
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  eventType: string;
  category: 'kyc_verification' | 'document_upload' | 'risk_assessment' | 'compliance_check' | 'admin_action';
  userId: string;
  targetUserId?: string;
  verificationId?: string;
  businessId?: string;
  eventData: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  success: boolean;
}

export interface ComplianceReport {
  id: string;
  reportType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'suspicious_activity' | 'regulatory_filing';
  periodStart: string;
  periodEnd: string;
  metrics: ComplianceMetrics;
  executiveSummary: string;
  recommendations: string[];
  riskTrends: Array<{
    date: string;
    riskLevel: string;
    count: number;
  }>;
  complianceScore: number;
  generatedAt: string;
  generatedBy: string;
  status: 'draft' | 'final' | 'filed';
}

export class ComplianceService {
  private supabase: SupabaseClient;
  private alertThresholds = {
    highRiskVerifications: 5,
    fraudAttempts: 3,
    slaBreaches: 10,
    duplicateDocuments: 2
  };

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase || createClientComponentClient();
  }

  /**
   * Generate comprehensive compliance metrics for a given period
   */
  async generateComplianceMetrics(startDate: string, endDate: string): Promise<ComplianceMetrics> {
    try {
      // Get verification statistics
      const { data: verifications } = await this.supabase
        .from('kyc_verifications')
        .select(`
          id, status, decision, risk_level, risk_score,
          initiated_at, decided_at, created_at
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Get document statistics
      const { data: documents } = await this.supabase
        .from('kyc_documents')
        .select(`
          id, document_quality_score, validation_status,
          fraud_indicators, file_hash, created_at
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .is('deleted_at', null);

      // Get risk assessments
      const { data: riskAssessments } = await this.supabase
        .from('kyc_risk_assessments')
        .select('risk_category, overall_risk_score, created_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Calculate metrics
      const totalVerifications = verifications?.length || 0;
      const approvedVerifications = verifications?.filter((v: any) => v.decision === 'approved').length || 0;
      const rejectedVerifications = verifications?.filter((v: any) => v.decision === 'rejected').length || 0;
      const pendingVerifications = verifications?.filter((v: any) => !v.decision || v.decision === 'pending').length || 0;

      const approvalRate = totalVerifications > 0 ? (approvedVerifications / totalVerifications) * 100 : 0;
      const rejectionRate = totalVerifications > 0 ? (rejectedVerifications / totalVerifications) * 100 : 0;

      // Risk distribution
      const lowRisk = riskAssessments?.filter((r: any) => r.risk_category === 'low').length || 0;
      const mediumRisk = riskAssessments?.filter((r: any) => r.risk_category === 'medium').length || 0;
      const highRisk = riskAssessments?.filter((r: any) => r.risk_category === 'high').length || 0;
      const criticalRisk = riskAssessments?.filter((r: any) => r.risk_category === 'critical').length || 0;

      // Processing metrics
      const completedVerifications = verifications?.filter((v: any) => v.decided_at) || [];
      let totalProcessingTime = 0;
      let slaCompliantCount = 0;
      let autoApprovedCount = 0;

      completedVerifications.forEach((v: any) => {
        if (v.initiated_at && v.decided_at) {
          const processingTime = new Date(v.decided_at).getTime() - new Date(v.initiated_at).getTime();
          totalProcessingTime += processingTime;
          
          // SLA is 24 hours
          if (processingTime <= 24 * 60 * 60 * 1000) {
            slaCompliantCount++;
          }
        }
      });

      const averageProcessingHours = completedVerifications.length > 0 
        ? (totalProcessingTime / completedVerifications.length) / (1000 * 60 * 60) 
        : 0;
      const slaComplianceRate = completedVerifications.length > 0 
        ? (slaCompliantCount / completedVerifications.length) * 100 
        : 0;

      // Document metrics
      const totalDocuments = documents?.length || 0;
      const averageQualityScore = documents && documents.length > 0
        ? documents.reduce((sum: number, d: any) => sum + (d.document_quality_score || 0), 0) / documents.length
        : 0;

      const fraudAttempts = documents?.filter((d: any) => 
        d.validation_status === 'suspicious' || 
        (d.fraud_indicators && Array.isArray(d.fraud_indicators) && d.fraud_indicators.length > 0)
      ).length || 0;

      // Find duplicate documents by hash
      const fileHashes = documents?.map((d: any) => d.file_hash).filter(Boolean) || [];
      const duplicateHashes = fileHashes.filter((hash: string, index: number) => fileHashes.indexOf(hash) !== index);
      const duplicateDocuments = [...new Set(duplicateHashes)].length;

      const periodDays = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));

      return {
        period: {
          start: startDate,
          end: endDate,
          days: periodDays
        },
        verificationStats: {
          total: totalVerifications,
          approved: approvedVerifications,
          rejected: rejectedVerifications,
          pending: pendingVerifications,
          approvalRate: Math.round(approvalRate * 100) / 100,
          rejectionRate: Math.round(rejectionRate * 100) / 100
        },
        riskDistribution: {
          low: lowRisk,
          medium: mediumRisk,
          high: highRisk,
          critical: criticalRisk
        },
        processingMetrics: {
          averageProcessingHours: Math.round(averageProcessingHours * 100) / 100,
          slaComplianceRate: Math.round(slaComplianceRate * 100) / 100,
          autoApprovalRate: 0, // Would be calculated based on reviewer assignment
          escalationRate: 0 // Would be calculated based on escalation data
        },
        complianceAlerts: {
          amlAlerts: 0, // Would come from watchlist screening results
          sanctionsHits: 0,
          pepMatches: 0,
          adverseMediaAlerts: 0,
          highRiskCases: highRisk + criticalRisk
        },
        documentMetrics: {
          totalDocuments,
          averageQualityScore: Math.round(averageQualityScore * 100) / 100,
          fraudAttempts,
          duplicateDocuments
        }
      };

    } catch (error) {
      throw new Error(`Failed to generate compliance metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create compliance alert
   */
  async createAlert(alert: Omit<ComplianceAlert, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from('compliance_alerts')
        .insert([{
          alert_type: alert.type,
          severity: alert.severity,
          verification_id: alert.verificationId,
          user_id: alert.userId,
          business_id: alert.businessId,
          title: alert.title,
          description: alert.description,
          evidence: alert.evidence,
          requires_action: alert.requiresAction,
          assigned_to: alert.assignedTo,
          status: alert.status
        }])
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to create compliance alert: ${error.message}`);
      }

      return data.id;

    } catch (error) {
      throw new Error(`Failed to create compliance alert: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Monitor for compliance violations and create alerts
   */
  async monitorCompliance(): Promise<ComplianceAlert[]> {
    const alerts: ComplianceAlert[] = [];

    try {
      // Monitor high-risk verifications
      const { data: highRiskVerifications } = await this.supabase
        .from('kyc_verifications')
        .select('id, user_id, business_id, risk_level, created_at')
        .in('risk_level', ['high', 'critical'])
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .limit(50);

      if (highRiskVerifications && highRiskVerifications.length >= this.alertThresholds.highRiskVerifications) {
        const alertId = await this.createAlert({
          type: 'high_risk',
          severity: 'high',
          verificationId: highRiskVerifications[0].id,
          userId: 'system',
          title: 'High Volume of High-Risk Verifications',
          description: `${highRiskVerifications.length} high-risk verifications detected in the last 24 hours`,
          evidence: { count: highRiskVerifications.length, verifications: highRiskVerifications.map(v => v.id) },
          requiresAction: true,
          status: 'new'
        });

        alerts.push({
          id: alertId,
          type: 'high_risk',
          severity: 'high',
          verificationId: highRiskVerifications[0].id,
          userId: 'system',
          title: 'High Volume of High-Risk Verifications',
          description: `${highRiskVerifications.length} high-risk verifications detected in the last 24 hours`,
          evidence: { count: highRiskVerifications.length },
          requiresAction: true,
          status: 'new',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      // Monitor SLA breaches
      const { data: slaBreaches } = await this.supabase
        .from('kyc_review_queue')
        .select('verification_id, deadline, created_at')
        .eq('is_overdue', true)
        .in('status', ['queued', 'assigned', 'in_review'])
        .limit(20);

      if (slaBreaches && slaBreaches.length >= this.alertThresholds.slaBreaches) {
        const alertId = await this.createAlert({
          type: 'sla_breach',
          severity: 'medium',
          verificationId: slaBreaches[0].verification_id,
          userId: 'system',
          title: 'Multiple SLA Breaches Detected',
          description: `${slaBreaches.length} verifications have exceeded their review deadlines`,
          evidence: { count: slaBreaches.length, breaches: slaBreaches },
          requiresAction: true,
          status: 'new'
        });

        alerts.push({
          id: alertId,
          type: 'sla_breach',
          severity: 'medium',
          verificationId: slaBreaches[0].verification_id,
          userId: 'system',
          title: 'Multiple SLA Breaches Detected',
          description: `${slaBreaches.length} verifications have exceeded their review deadlines`,
          evidence: { count: slaBreaches.length },
          requiresAction: true,
          status: 'new',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      // Monitor fraud attempts
      const { data: fraudAttempts } = await this.supabase
        .from('kyc_documents')
        .select('verification_id, fraud_indicators, created_at')
        .neq('fraud_indicators', '[]')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(20);

      if (fraudAttempts && fraudAttempts.length >= this.alertThresholds.fraudAttempts) {
        const alertId = await this.createAlert({
          type: 'fraud_detected',
          severity: 'critical',
          verificationId: fraudAttempts[0].verification_id,
          userId: 'system',
          title: 'Multiple Fraud Indicators Detected',
          description: `${fraudAttempts.length} documents with fraud indicators uploaded in the last 24 hours`,
          evidence: { count: fraudAttempts.length, attempts: fraudAttempts },
          requiresAction: true,
          status: 'new'
        });

        alerts.push({
          id: alertId,
          type: 'fraud_detected',
          severity: 'critical',
          verificationId: fraudAttempts[0].verification_id,
          userId: 'system',
          title: 'Multiple Fraud Indicators Detected',
          description: `${fraudAttempts.length} documents with fraud indicators uploaded in the last 24 hours`,
          evidence: { count: fraudAttempts.length },
          requiresAction: true,
          status: 'new',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      return alerts;

    } catch (error) {
      console.error('Compliance monitoring failed:', error);
      return alerts;
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    reportType: ComplianceReport['reportType'],
    startDate: string,
    endDate: string,
    generatedBy: string
  ): Promise<ComplianceReport> {
    try {
      const metrics = await this.generateComplianceMetrics(startDate, endDate);

      // Calculate compliance score (0-100)
      let complianceScore = 100;

      // Deduct points for high rejection rate
      if (metrics.verificationStats.rejectionRate > 20) {
        complianceScore -= (metrics.verificationStats.rejectionRate - 20) * 2;
      }

      // Deduct points for SLA breaches
      if (metrics.processingMetrics.slaComplianceRate < 95) {
        complianceScore -= (95 - metrics.processingMetrics.slaComplianceRate) * 2;
      }

      // Deduct points for high-risk cases
      const totalRiskCases = metrics.riskDistribution.low + metrics.riskDistribution.medium + 
                            metrics.riskDistribution.high + metrics.riskDistribution.critical;
      if (totalRiskCases > 0) {
        const highRiskRatio = (metrics.riskDistribution.high + metrics.riskDistribution.critical) / totalRiskCases;
        if (highRiskRatio > 0.1) { // More than 10% high/critical risk
          complianceScore -= (highRiskRatio - 0.1) * 200;
        }
      }

      // Deduct points for compliance alerts
      const totalAlerts = metrics.complianceAlerts.amlAlerts + metrics.complianceAlerts.sanctionsHits +
                         metrics.complianceAlerts.pepMatches + metrics.complianceAlerts.adverseMediaAlerts;
      complianceScore -= totalAlerts * 5;

      complianceScore = Math.max(Math.round(complianceScore), 0);

      // Generate executive summary
      const executiveSummary = this.generateExecutiveSummary(metrics, complianceScore);

      // Generate recommendations
      const recommendations = this.generateRecommendations(metrics, complianceScore);

      // Generate risk trends (placeholder)
      const riskTrends = this.generateRiskTrends(startDate, endDate);

      // Save report to database (placeholder - RPC function needs to be created)
      // const { data: reportData, error } = await this.supabase.rpc('generate_kyc_compliance_report', {
      //   p_report_type: reportType,
      //   p_start_date: startDate,
      //   p_end_date: endDate,
      //   p_generated_by: generatedBy
      // });

      // if (error) {
      //   throw new Error(`Failed to save compliance report: ${error.message}`);
      // }
      
      const reportData = `report_${Date.now()}`; // Placeholder until RPC function is implemented

      return {
        id: reportData,
        reportType,
        periodStart: startDate,
        periodEnd: endDate,
        metrics,
        executiveSummary,
        recommendations,
        riskTrends,
        complianceScore,
        generatedAt: new Date().toISOString(),
        generatedBy,
        status: 'final'
      };

    } catch (error) {
      throw new Error(`Failed to generate compliance report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Log audit event
   */
  async logAuditEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    try {
      await this.supabase
        .from('kyc_audit_logs')
        .insert([{
          event_type: event.eventType,
          category: event.category,
          user_id: event.userId,
          target_user_id: event.targetUserId,
          verification_id: event.verificationId,
          business_id: event.businessId,
          event_data: event.eventData,
          ip_address: event.ipAddress,
          user_agent: event.userAgent,
          success: event.success
        }]);

    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw here as audit logging failure shouldn't break the main flow
    }
  }

  /**
   * Get compliance alerts
   */
  async getComplianceAlerts(filters: {
    type?: ComplianceAlert['type'];
    severity?: ComplianceAlert['severity'];
    status?: ComplianceAlert['status'];
    assignedTo?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ alerts: ComplianceAlert[]; total: number }> {
    try {
      let query = this.supabase
        .from('compliance_alerts')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (filters.type) query = query.eq('alert_type', filters.type);
      if (filters.severity) query = query.eq('severity', filters.severity);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo);

      if (filters.limit) query = query.limit(filters.limit);
      if (filters.offset) query = query.range(filters.offset, (filters.offset || 0) + (filters.limit || 50) - 1);

      const { data: alerts, error, count } = await query;

      if (error) {
        throw new Error(`Failed to fetch compliance alerts: ${error.message}`);
      }

      return {
        alerts: (alerts || []).map(alert => ({
          id: alert.id,
          type: alert.alert_type,
          severity: alert.severity,
          verificationId: alert.verification_id,
          userId: alert.user_id,
          businessId: alert.business_id,
          title: alert.title,
          description: alert.description,
          evidence: alert.evidence,
          requiresAction: alert.requires_action,
          assignedTo: alert.assigned_to,
          status: alert.status,
          createdAt: alert.created_at,
          updatedAt: alert.updated_at
        })),
        total: count || 0
      };

    } catch (error) {
      throw new Error(`Failed to get compliance alerts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update compliance alert status
   */
  async updateAlertStatus(alertId: string, status: ComplianceAlert['status'], notes?: string): Promise<void> {
    try {
      const updateData: any = { status, updated_at: new Date().toISOString() };
      if (notes) updateData.resolution_notes = notes;

      const { error } = await this.supabase
        .from('compliance_alerts')
        .update(updateData)
        .eq('id', alertId);

      if (error) {
        throw new Error(`Failed to update alert status: ${error.message}`);
      }

    } catch (error) {
      throw new Error(`Failed to update alert status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Private helper methods
   */
  private generateExecutiveSummary(metrics: ComplianceMetrics, complianceScore: number): string {
    const { verificationStats, processingMetrics, complianceAlerts } = metrics;
    
    let summary = `During the reporting period of ${metrics.period.days} days, `;
    summary += `${verificationStats.total} KYC verifications were processed with an approval rate of ${verificationStats.approvalRate}%. `;
    
    if (complianceScore >= 90) {
      summary += 'The organization demonstrates excellent compliance standards with ';
    } else if (complianceScore >= 80) {
      summary += 'The organization shows good compliance performance with ';
    } else if (complianceScore >= 70) {
      summary += 'The organization has acceptable compliance levels but with ';
    } else {
      summary += 'The organization shows concerning compliance issues with ';
    }
    
    summary += `an SLA compliance rate of ${processingMetrics.slaComplianceRate}% and `;
    summary += `${complianceAlerts.highRiskCases} high-risk cases identified. `;
    
    if (complianceAlerts.amlAlerts + complianceAlerts.sanctionsHits + complianceAlerts.pepMatches > 0) {
      summary += 'Critical compliance alerts require immediate attention. ';
    }
    
    return summary;
  }

  private generateRecommendations(metrics: ComplianceMetrics, complianceScore: number): string[] {
    const recommendations: string[] = [];

    if (metrics.verificationStats.rejectionRate > 15) {
      recommendations.push('Review rejection reasons and provide better guidance to applicants');
    }

    if (metrics.processingMetrics.slaComplianceRate < 95) {
      recommendations.push('Increase reviewer capacity or optimize verification processes to improve SLA compliance');
    }

    if (metrics.documentMetrics.fraudAttempts > 0) {
      recommendations.push('Enhance fraud detection algorithms and consider additional document validation checks');
    }

    if (complianceScore < 80) {
      recommendations.push('Implement additional compliance controls and increase monitoring frequency');
    }

    if (metrics.complianceAlerts.highRiskCases > 10) {
      recommendations.push('Review risk assessment criteria and consider enhanced due diligence procedures');
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue monitoring current compliance procedures and maintain existing standards');
    }

    return recommendations;
  }

  private generateRiskTrends(startDate: string, endDate: string): Array<{ date: string; riskLevel: string; count: number }> {
    // This would generate actual risk trend data from the database
    // For now, return placeholder data
    return [
      { date: startDate, riskLevel: 'low', count: 10 },
      { date: startDate, riskLevel: 'medium', count: 5 },
      { date: startDate, riskLevel: 'high', count: 2 },
      { date: startDate, riskLevel: 'critical', count: 0 }
    ];
  }
}

// Export singleton instance
export const complianceService = new ComplianceService();