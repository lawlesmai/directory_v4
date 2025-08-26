/**
 * Profile Completion and Gamification API
 * Epic 2 Story 2.7: User Profile Management & Preferences Infrastructure
 * 
 * API endpoints for profile completion scoring, gamification features,
 * achievements, and user engagement analytics.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { profileCompletionManager } from '@/lib/profile/completion-scoring'

/**
 * GET /api/profile/completion - Get profile completion score and recommendations
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Verify authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session?.user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const includeAnalytics = searchParams.get('includeAnalytics') === 'true'
    const includeRecommendations = searchParams.get('includeRecommendations') !== 'false'
    const includeBadges = searchParams.get('includeBadges') === 'true'
    const includeStreaks = searchParams.get('includeStreaks') === 'true'
    const detailed = searchParams.get('detailed') === 'true'

    // Get profile completion data
    const completion = await profileCompletionManager.calculateProfileCompletion(userId)

    // Build response data
    const responseData: any = {
      userId: completion.userId,
      score: {
        total: completion.totalScore,
        max: completion.maxScore,
        percentage: completion.completionPercentage,
        level: completion.level
      },
      lastUpdated: completion.lastUpdated
    }

    // Add recommendations unless explicitly excluded
    if (includeRecommendations) {
      responseData.recommendations = completion.recommendations.map(rec => ({
        id: rec.id,
        type: rec.type,
        priority: rec.priority,
        title: rec.title,
        description: rec.description,
        estimatedTime: rec.estimatedTime,
        potentialPoints: rec.potentialPoints,
        actionUrl: rec.actionUrl,
        actionText: rec.actionText,
        category: rec.category,
        difficulty: rec.difficulty,
        dependencies: rec.dependencies
      }))
    }

    // Add detailed section information if requested
    if (detailed) {
      responseData.sections = {
        completed: completion.completedSections.map(section => ({
          id: section.id,
          name: section.name,
          description: section.description,
          category: section.category,
          points: section.currentPoints,
          maxPoints: section.maxPoints,
          completionPercentage: Math.round((section.currentPoints / section.maxPoints) * 100)
        })),
        missing: completion.missingSections.map(section => ({
          id: section.id,
          name: section.name,
          description: section.description,
          category: section.category,
          points: section.currentPoints,
          maxPoints: section.maxPoints,
          potentialPoints: section.maxPoints - section.currentPoints,
          missingFields: section.fields
            .filter(field => !field.isCompleted)
            .map(field => ({
              id: field.id,
              name: field.displayName,
              type: field.type,
              points: field.points,
              isRequired: field.isRequired,
              validationStatus: field.validationStatus
            }))
        }))
      }

      // Add next milestone information
      if (completion.nextMilestone) {
        responseData.nextMilestone = {
          id: completion.nextMilestone.id,
          name: completion.nextMilestone.name,
          description: completion.nextMilestone.description,
          requiredScore: completion.nextMilestone.requiredScore,
          currentScore: completion.totalScore,
          pointsNeeded: completion.nextMilestone.requiredScore - completion.totalScore,
          progress: Math.round((completion.totalScore / completion.nextMilestone.requiredScore) * 100),
          rewards: completion.nextMilestone.rewards
        }
      }
    }

    // Add badges if requested
    if (includeBadges) {
      responseData.badges = completion.badges.map(badge => ({
        id: badge.id,
        name: badge.name,
        description: badge.description,
        iconUrl: badge.iconUrl,
        category: badge.category,
        rarity: badge.rarity,
        earnedAt: badge.earnedAt,
        isVisible: badge.isVisible
      }))
    }

    // Add streaks if requested
    if (includeStreaks) {
      responseData.streaks = completion.streaks.map(streak => ({
        id: streak.id,
        type: streak.type,
        currentStreak: streak.currentStreak,
        bestStreak: streak.bestStreak,
        lastActivityDate: streak.lastActivityDate,
        isActive: streak.isActive,
        nextReward: streak.nextReward
      }))
    }

    // Add analytics if requested
    if (includeAnalytics) {
      const analytics = await profileCompletionManager.getCompletionAnalytics(userId)
      responseData.analytics = {
        averageCompletionTime: analytics.averageCompletionTime,
        mostImprovedSection: analytics.mostImprovedSection,
        completionTrend: analytics.completionTrend,
        weeklyProgress: analytics.weeklyProgress,
        sectionProgress: analytics.sectionProgress,
        engagementScore: analytics.engagementScore,
        benchmarkComparison: analytics.benchmarkComparison
      }
    }

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('Completion API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/profile/completion - Manually trigger completion recalculation
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Verify authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session?.user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Recalculate completion and check for achievements
    const result = await profileCompletionManager.updateCompletionAndCheckAchievements(userId)

    // Log manual completion update
    await supabase.from('auth_audit_logs').insert({
      event_type: 'manual_completion_update',
      event_category: 'profile',
      user_id: userId,
      success: true,
      event_data: {
        completion_score: result.completion.totalScore,
        completion_level: result.completion.level,
        new_badges_count: result.newBadges.length,
        new_milestones_count: result.newMilestones.length
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Profile completion updated',
      completion: {
        score: result.completion.totalScore,
        level: result.completion.level,
        percentage: result.completion.completionPercentage
      },
      achievements: {
        newBadges: result.newBadges.map(badge => ({
          id: badge.id,
          name: badge.name,
          description: badge.description,
          category: badge.category,
          rarity: badge.rarity
        })),
        newMilestones: result.newMilestones.map(milestone => ({
          id: milestone.id,
          name: milestone.name,
          description: milestone.description,
          rewards: milestone.rewards
        }))
      }
    })

  } catch (error) {
    console.error('Manual completion update API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}