/**
 * Onboarding Progress Tracking and Analytics System
 * Epic 2 Story 2.5: User Onboarding and Email Verification Infrastructure
 * 
 * Comprehensive analytics and progress tracking for onboarding workflows
 */

import { supabase } from '@/lib/supabase/server';
import { Database } from '@/lib/supabase/database.types';

// Temporary type workarounds for missing database tables
type OnboardingAnalytics = any;
type UserOnboardingProgress = any;
type OnboardingStepCompletion = any;

export interface OnboardingMetrics {
  totalUsers: number;
  usersStarted: number;
  usersCompleted: number;
  usersAbandoned: number;
  completionRate: number;
  averageCompletionTime: number;
  medianCompletionTime: number;
  dropoffRate: number;
  engagementScore: number;
}

export interface StepAnalytics {
  stepName: string;
  stepIndex: number;
  stepType: string;
  completionRate: number;
  averageTime: number;
  dropoffRate: number;
  errorRate: number;
  skipRate: number;
  topErrors: Array<{ error: string; count: number }>;
}

export interface FlowAnalytics {
  flowId: string;
  flowName: string;
  metrics: OnboardingMetrics;
  stepAnalytics: StepAnalytics[];
  conversionFunnel: Array<{
    stepIndex: number;
    stepName: string;
    usersReached: number;
    usersCompleted: number;
    conversionRate: number;
  }>;
  timeToComplete: {
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
  deviceBreakdown: Record<string, number>;
  trafficSourceBreakdown: Record<string, number>;
}

export interface UserEngagementData {
  userId: string;
  totalSessions: number;
  totalTimeSpent: number;
  averageSessionDuration: number;
  completionRate: number;
  stepsCompleted: number;
  stepsSkipped: number;
  lastActivityAt: string;
  engagementScore: number;
  riskOfAbandonment: number;
}

export interface OnboardingInsights {
  keyMetrics: {
    overallCompletionRate: number;
    averageTimeToComplete: number;
    dropoffPoint: { stepName: string; dropoffRate: number };
    engagementTrend: 'improving' | 'declining' | 'stable';
  };
  recommendations: Array<{
    type: 'optimization' | 'content' | 'ux' | 'technical';
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    impact: string;
  }>;
  riskUsers: Array<{
    userId: string;
    riskScore: number;
    reasons: string[];
    suggestedActions: string[];
  }>;
}

export class OnboardingAnalyticsService {
  /**
   * Generate comprehensive onboarding analytics for a flow
   */
  async generateFlowAnalytics(
    flowId: string,
    dateRange: { from: Date; to: Date }
  ): Promise<FlowAnalytics | null> {
    try {
      // Get flow information
      const { data: flow, error: flowError } = await supabase
        .from('onboarding_flows')
        .select('*')
        .eq('id', flowId)
        .single();

      if (flowError) throw flowError;

      const steps = flow.steps as any[];

      // Get all progress records for the flow in date range
      const { data: progressRecords, error: progressError } = await supabase
        .from('user_onboarding_progress')
        .select('*')
        .eq('flow_id', flowId)
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString());

      if (progressError) throw progressError;

      // Get step completions for detailed analysis
      const progressIds = progressRecords?.map((p: any) => p.id) || [];
      
      const { data: stepCompletions, error: stepsError } = await supabase
        .from('onboarding_step_completions')
        .select('*')
        .in('progress_id', progressIds);

      if (stepsError) throw stepsError;

      // Calculate metrics
      const metrics = this.calculateOnboardingMetrics(progressRecords || []);
      
      // Calculate step analytics
      const stepAnalytics = this.calculateStepAnalytics(
        steps,
        progressRecords || [],
        stepCompletions || []
      );

      // Calculate conversion funnel
      const conversionFunnel = this.calculateConversionFunnel(
        steps,
        progressRecords || [],
        stepCompletions || []
      );

      // Calculate time percentiles
      const timeToComplete = this.calculateTimePercentiles(
        progressRecords?.filter((p: any) => p.status === 'completed') || []
      );

      return {
        flowId,
        flowName: flow.display_name,
        metrics,
        stepAnalytics,
        conversionFunnel,
        timeToComplete,
        deviceBreakdown: {}, // Would be populated from session data
        trafficSourceBreakdown: {}, // Would be populated from utm parameters
      };

    } catch (error) {
      console.error('Error generating flow analytics:', error);
      return null;
    }
  }

  /**
   * Calculate basic onboarding metrics
   */
  private calculateOnboardingMetrics(progressRecords: UserOnboardingProgress[]): OnboardingMetrics {
    const totalUsers = progressRecords.length;
    const usersStarted = progressRecords.filter(p => 
      p.status !== 'not_started'
    ).length;
    const usersCompleted = progressRecords.filter(p => p.status === 'completed').length;
    const usersAbandoned = progressRecords.filter(p => p.status === 'abandoned').length;

    const completionRate = usersStarted > 0 ? (usersCompleted / usersStarted) * 100 : 0;
    const dropoffRate = usersStarted > 0 ? (usersAbandoned / usersStarted) * 100 : 0;

    const completedRecords = progressRecords.filter(p => 
      p.status === 'completed' && p.total_time_spent_minutes
    );
    
    const averageCompletionTime = completedRecords.length > 0
      ? completedRecords.reduce((sum, p) => sum + (p.total_time_spent_minutes || 0), 0) / completedRecords.length
      : 0;

    const sortedTimes = completedRecords
      .map(p => p.total_time_spent_minutes || 0)
      .sort((a, b) => a - b);
    
    const medianCompletionTime = sortedTimes.length > 0
      ? sortedTimes[Math.floor(sortedTimes.length / 2)]
      : 0;

    const engagementScore = progressRecords.length > 0
      ? progressRecords.reduce((sum, p) => sum + (p.engagement_score || 0), 0) / progressRecords.length
      : 0;

    return {
      totalUsers,
      usersStarted,
      usersCompleted,
      usersAbandoned,
      completionRate,
      averageCompletionTime,
      medianCompletionTime,
      dropoffRate,
      engagementScore,
    };
  }

  /**
   * Calculate step-by-step analytics
   */
  private calculateStepAnalytics(
    steps: any[],
    progressRecords: UserOnboardingProgress[],
    stepCompletions: OnboardingStepCompletion[]
  ): StepAnalytics[] {
    return steps.map((step, index) => {
      const stepCompletionsForStep = stepCompletions.filter(sc => sc.step_index === index);
      const usersReachedStep = progressRecords.filter(p => 
        p.current_step_index >= index || (p.completed_steps || []).includes(index)
      ).length;

      const completedCount = stepCompletionsForStep.filter(sc => sc.status === 'completed').length;
      const skippedCount = stepCompletionsForStep.filter(sc => sc.status === 'skipped').length;
      const failedCount = stepCompletionsForStep.filter(sc => sc.status === 'failed').length;

      const completionRate = usersReachedStep > 0 ? (completedCount / usersReachedStep) * 100 : 0;
      const dropoffRate = usersReachedStep > 0 ? 
        (progressRecords.filter(p => p.current_step_index === index && p.status === 'abandoned').length / usersReachedStep) * 100 : 0;
      const errorRate = usersReachedStep > 0 ? (failedCount / usersReachedStep) * 100 : 0;
      const skipRate = usersReachedStep > 0 ? (skippedCount / usersReachedStep) * 100 : 0;

      const completedSteps = stepCompletionsForStep.filter(sc => 
        sc.status === 'completed' && sc.duration_seconds
      );
      
      const averageTime = completedSteps.length > 0
        ? completedSteps.reduce((sum, sc) => sum + (sc.duration_seconds || 0), 0) / completedSteps.length
        : 0;

      // Get top errors for this step
      const errors: Record<string, number> = {};
      stepCompletionsForStep
        .filter(sc => sc.error_message)
        .forEach(sc => {
          errors[sc.error_message!] = (errors[sc.error_message!] || 0) + 1;
        });

      const topErrors = Object.entries(errors)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([error, count]) => ({ error, count }));

      return {
        stepName: step.name,
        stepIndex: index,
        stepType: step.type,
        completionRate,
        averageTime,
        dropoffRate,
        errorRate,
        skipRate,
        topErrors,
      };
    });
  }

  /**
   * Calculate conversion funnel data
   */
  private calculateConversionFunnel(
    steps: any[],
    progressRecords: UserOnboardingProgress[],
    stepCompletions: OnboardingStepCompletion[]
  ): Array<{
    stepIndex: number;
    stepName: string;
    usersReached: number;
    usersCompleted: number;
    conversionRate: number;
  }> {
    return steps.map((step, index) => {
      const usersReached = progressRecords.filter(p => 
        p.current_step_index >= index || (p.completed_steps || []).includes(index)
      ).length;

      const usersCompleted = stepCompletions.filter(sc => 
        sc.step_index === index && sc.status === 'completed'
      ).length;

      const conversionRate = usersReached > 0 ? (usersCompleted / usersReached) * 100 : 0;

      return {
        stepIndex: index,
        stepName: step.name,
        usersReached,
        usersCompleted,
        conversionRate,
      };
    });
  }

  /**
   * Calculate time percentiles for completion
   */
  private calculateTimePercentiles(completedRecords: UserOnboardingProgress[]): {
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  } {
    const times = completedRecords
      .map(p => p.total_time_spent_minutes || 0)
      .sort((a, b) => a - b);

    if (times.length === 0) {
      return { p25: 0, p50: 0, p75: 0, p95: 0 };
    }

    const p25 = times[Math.floor(times.length * 0.25)];
    const p50 = times[Math.floor(times.length * 0.50)];
    const p75 = times[Math.floor(times.length * 0.75)];
    const p95 = times[Math.floor(times.length * 0.95)];

    return { p25, p50, p75, p95 };
  }

  /**
   * Track user engagement and calculate risk scores
   */
  async getUserEngagementData(
    userId: string
  ): Promise<UserEngagementData | null> {
    try {
      const { data: progressRecords, error } = await supabase
        .from('user_onboarding_progress')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      if (!progressRecords || progressRecords.length === 0) {
        return null;
      }

      const totalSessions = progressRecords.reduce((sum: number, p: any) => sum + (p.sessions_count || 0), 0);
      const totalTimeSpent = progressRecords.reduce((sum: number, p: any) => sum + (p.total_time_spent_minutes || 0), 0);
      
      const averageSessionDuration = totalSessions > 0 ? totalTimeSpent / totalSessions : 0;
      
      const totalFlows = progressRecords.length;
      const completedFlows = progressRecords.filter((p: any) => p.status === 'completed').length;
      const completionRate = totalFlows > 0 ? (completedFlows / totalFlows) * 100 : 0;

      const stepsCompleted = progressRecords.reduce(
        (sum: number, p: any) => sum + (p.completed_steps?.length || 0), 0
      );
      
      const stepsSkipped = progressRecords.reduce(
        (sum: number, p: any) => sum + (p.skipped_steps?.length || 0), 0
      );

      const latestActivity = progressRecords
        .map((p: any) => new Date(p.last_activity_at))
        .sort((a: any, b: any) => b.getTime() - a.getTime())[0];

      const engagementScore = progressRecords.length > 0
        ? progressRecords.reduce((sum: number, p: any) => sum + (p.engagement_score || 0), 0) / progressRecords.length
        : 0;

      // Calculate risk of abandonment
      const riskOfAbandonment = this.calculateAbandonmentRisk(progressRecords);

      return {
        userId,
        totalSessions,
        totalTimeSpent,
        averageSessionDuration,
        completionRate,
        stepsCompleted,
        stepsSkipped,
        lastActivityAt: latestActivity.toISOString(),
        engagementScore,
        riskOfAbandonment,
      };

    } catch (error) {
      console.error('Error getting user engagement data:', error);
      return null;
    }
  }

  /**
   * Calculate risk of abandonment based on user behavior
   */
  private calculateAbandonmentRisk(progressRecords: UserOnboardingProgress[]): number {
    let riskScore = 0;

    const activeRecords = progressRecords.filter(p => p.status === 'in_progress');
    
    for (const record of activeRecords) {
      // Time since last activity (higher risk with more time)
      const daysSinceActivity = Math.floor(
        (Date.now() - new Date(record.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceActivity > 7) riskScore += 0.3;
      else if (daysSinceActivity > 3) riskScore += 0.2;
      else if (daysSinceActivity > 1) riskScore += 0.1;

      // Low engagement score
      if (record.engagement_score && record.engagement_score < 0.3) {
        riskScore += 0.2;
      }

      // High skip rate
      const totalSteps = (record.completed_steps?.length || 0) + (record.skipped_steps?.length || 0);
      const skipRate = totalSteps > 0 ? (record.skipped_steps?.length || 0) / totalSteps : 0;
      
      if (skipRate > 0.5) riskScore += 0.2;

      // Low session count relative to time spent
      if (record.sessions_count && record.sessions_count < 2) {
        riskScore += 0.1;
      }

      // Stuck on the same step for a while
      if (record.current_step_index === 0 && daysSinceActivity > 2) {
        riskScore += 0.2;
      }
    }

    return Math.min(1, riskScore); // Cap at 1.0
  }

  /**
   * Generate actionable insights from onboarding data
   */
  async generateOnboardingInsights(
    flowId: string,
    dateRange: { from: Date; to: Date }
  ): Promise<OnboardingInsights> {
    try {
      const analytics = await this.generateFlowAnalytics(flowId, dateRange);
      
      if (!analytics) {
        throw new Error('Unable to generate analytics');
      }

      // Find the biggest dropoff point
      const dropoffPoint = analytics.stepAnalytics
        .sort((a, b) => b.dropoffRate - a.dropoffRate)[0];

      // Determine engagement trend (would need historical data)
      const engagementTrend: 'improving' | 'declining' | 'stable' = 'stable';

      // Generate recommendations based on analytics
      const recommendations = this.generateRecommendations(analytics);

      // Get users at risk
      const { data: progressRecords, error } = await supabase
        .from('user_onboarding_progress')
        .select('*')
        .eq('flow_id', flowId)
        .eq('status', 'in_progress')
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString());

      if (error) throw error;

      const riskUsers = await Promise.all(
        (progressRecords || []).map(async (record: any) => {
          const engagement = await this.getUserEngagementData(record.user_id);
          if (!engagement) return null;

          const riskScore = engagement.riskOfAbandonment;
          
          if (riskScore > 0.5) {
            const reasons = this.identifyRiskReasons(record, engagement);
            const suggestedActions = this.suggestActions(reasons);

            return {
              userId: record.user_id,
              riskScore,
              reasons,
              suggestedActions,
            };
          }

          return null;
        })
      );

      return {
        keyMetrics: {
          overallCompletionRate: analytics.metrics.completionRate,
          averageTimeToComplete: analytics.metrics.averageCompletionTime,
          dropoffPoint: {
            stepName: dropoffPoint?.stepName || 'Unknown',
            dropoffRate: dropoffPoint?.dropoffRate || 0,
          },
          engagementTrend,
        },
        recommendations,
        riskUsers: riskUsers.filter((u: any) => u !== null) as any[],
      };

    } catch (error) {
      console.error('Error generating onboarding insights:', error);
      
      // Return empty insights on error
      return {
        keyMetrics: {
          overallCompletionRate: 0,
          averageTimeToComplete: 0,
          dropoffPoint: { stepName: 'Unknown', dropoffRate: 0 },
          engagementTrend: 'stable',
        },
        recommendations: [],
        riskUsers: [],
      };
    }
  }

  /**
   * Generate recommendations based on analytics
   */
  private generateRecommendations(analytics: FlowAnalytics): Array<{
    type: 'optimization' | 'content' | 'ux' | 'technical';
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    impact: string;
  }> {
    const recommendations: Array<{
      type: 'optimization' | 'content' | 'ux' | 'technical';
      priority: 'high' | 'medium' | 'low';
      title: string;
      description: string;
      impact: string;
    }> = [];

    // Check completion rate
    if (analytics.metrics.completionRate < 60) {
      recommendations.push({
        type: 'optimization' as const,
        priority: 'high' as const,
        title: 'Improve Overall Completion Rate',
        description: 'The current completion rate is below 60%, indicating significant user dropoff.',
        impact: 'Could improve user activation by 20-30%',
      });
    }

    // Check for high dropoff steps
    const highDropoffSteps = analytics.stepAnalytics.filter(s => s.dropoffRate > 30);
    for (const step of highDropoffSteps) {
      recommendations.push({
        type: 'ux' as const,
        priority: 'high' as const,
        title: `Optimize "${step.stepName}" Step`,
        description: `This step has a ${step.dropoffRate.toFixed(1)}% dropoff rate, which is unusually high.`,
        impact: 'Reducing dropoff could improve completion by 10-15%',
      });
    }

    // Check for slow steps
    const slowSteps = analytics.stepAnalytics.filter(s => s.averageTime > 300); // 5+ minutes
    for (const step of slowSteps) {
      recommendations.push({
        type: 'content' as const,
        priority: 'medium' as const,
        title: `Simplify "${step.stepName}" Step`,
        description: `Users spend an average of ${Math.round(step.averageTime / 60)} minutes on this step.`,
        impact: 'Reducing complexity could improve completion time by 20%',
      });
    }

    // Check error rates
    const errorProneSteps = analytics.stepAnalytics.filter(s => s.errorRate > 10);
    for (const step of errorProneSteps) {
      recommendations.push({
        type: 'technical' as const,
        priority: 'medium' as const,
        title: `Fix Errors in "${step.stepName}" Step`,
        description: `This step has a ${step.errorRate.toFixed(1)}% error rate.`,
        impact: 'Fixing technical issues could reduce abandonment by 5-10%',
      });
    }

    return recommendations.slice(0, 5); // Return top 5 recommendations
  }

  /**
   * Identify reasons for user risk
   */
  private identifyRiskReasons(
    record: UserOnboardingProgress,
    engagement: UserEngagementData
  ): string[] {
    const reasons: string[] = [];

    if (engagement.riskOfAbandonment > 0.7) {
      reasons.push('High abandonment risk score');
    }

    const daysSinceActivity = Math.floor(
      (Date.now() - new Date(record.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceActivity > 7) {
      reasons.push('No activity for over a week');
    }

    if (engagement.engagementScore < 0.3) {
      reasons.push('Low engagement score');
    }

    if (engagement.completionRate < 20) {
      reasons.push('Very low completion rate');
    }

    return reasons;
  }

  /**
   * Suggest actions for at-risk users
   */
  private suggestActions(reasons: string[]): string[] {
    const actions: string[] = [];

    if (reasons.includes('No activity for over a week')) {
      actions.push('Send re-engagement email');
    }

    if (reasons.includes('Low engagement score')) {
      actions.push('Offer personalized assistance');
    }

    if (reasons.includes('Very low completion rate')) {
      actions.push('Provide onboarding tutorial');
    }

    actions.push('Schedule follow-up reminder');

    return actions;
  }

  /**
   * Store analytics data for historical tracking
   */
  async storeAnalyticsData(analytics: FlowAnalytics): Promise<boolean> {
    try {
      const analyticsData = {
        date: new Date().toISOString().split('T')[0],
        hour: new Date().getHours(),
        flow_id: analytics.flowId,
        flow_name: analytics.flowName,
        users_started: analytics.metrics.usersStarted,
        users_completed: analytics.metrics.usersCompleted,
        users_abandoned: analytics.metrics.usersAbandoned,
        completion_rate: analytics.metrics.completionRate,
        average_completion_time_minutes: analytics.metrics.averageCompletionTime,
        median_completion_time_minutes: analytics.metrics.medianCompletionTime,
        step_completion_rates: Object.fromEntries(
          analytics.stepAnalytics.map(s => [s.stepName, s.completionRate])
        ),
      };

      const { error } = await supabase
        .from('onboarding_analytics')
        .upsert(analyticsData, {
          onConflict: 'date,hour,flow_id',
        });

      if (error) throw error;

      return true;

    } catch (error) {
      console.error('Error storing analytics data:', error);
      return false;
    }
  }
}

// Export singleton instance
export const onboardingAnalyticsService = new OnboardingAnalyticsService();

// Export utility functions
export const calculateEngagementScore = (
  sessionsCount: number,
  totalTimeSpent: number,
  stepsCompleted: number,
  stepsSkipped: number
): number => {
  // Normalize metrics and calculate weighted score
  const sessionScore = Math.min(1, sessionsCount / 5) * 0.2;
  const timeScore = Math.min(1, totalTimeSpent / 60) * 0.3;
  const completionScore = stepsCompleted > 0 ? Math.min(1, stepsCompleted / 10) * 0.4 : 0;
  const skipPenalty = stepsSkipped > 0 ? Math.min(0.2, stepsSkipped / 10) : 0;

  return Math.max(0, sessionScore + timeScore + completionScore - skipPenalty);
};

export const formatAnalyticsForDisplay = (analytics: FlowAnalytics) => {
  return {
    completionRate: `${analytics.metrics.completionRate.toFixed(1)}%`,
    averageTime: `${Math.round(analytics.metrics.averageCompletionTime)} min`,
    dropoffRate: `${analytics.metrics.dropoffRate.toFixed(1)}%`,
    engagementScore: analytics.metrics.engagementScore.toFixed(2),
  };
};