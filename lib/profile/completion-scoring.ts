/**
 * Profile Completion Scoring and Gamification System
 * Epic 2 Story 2.7: User Profile Management & Preferences Infrastructure
 * 
 * Comprehensive profile completion scoring with gamification elements,
 * achievement tracking, and intelligent recommendations.
 */

import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'

// Type definitions
export interface ProfileCompletionScore {
  userId: string
  totalScore: number
  maxScore: number
  completionPercentage: number
  level: 'basic' | 'intermediate' | 'advanced' | 'complete' | 'expert'
  completedSections: ProfileSection[]
  missingSections: ProfileSection[]
  nextMilestone: CompletionMilestone | null
  recommendations: CompletionRecommendation[]
  badges: ProfileBadge[]
  streaks: CompletionStreak[]
  lastUpdated: string
}

export interface ProfileSection {
  id: string
  name: string
  description: string
  category: 'basic' | 'personal' | 'contact' | 'social' | 'verification' | 'business' | 'preferences'
  weight: number
  maxPoints: number
  currentPoints: number
  isCompleted: boolean
  fields: ProfileField[]
  requirements?: SectionRequirement[]
}

export interface ProfileField {
  id: string
  name: string
  displayName: string
  type: 'text' | 'email' | 'phone' | 'url' | 'image' | 'boolean' | 'select' | 'date'
  points: number
  isRequired: boolean
  isCompleted: boolean
  hasValue: boolean
  validationStatus: 'valid' | 'invalid' | 'pending' | 'not_validated'
  lastUpdated?: string
}

export interface SectionRequirement {
  type: 'min_fields' | 'specific_fields' | 'verification' | 'custom'
  description: string
  isMet: boolean
  details?: any
}

export interface CompletionMilestone {
  id: string
  name: string
  description: string
  requiredScore: number
  requiredLevel: string
  rewards: MilestoneReward[]
  isAchieved: boolean
  achievedAt?: string
}

export interface MilestoneReward {
  type: 'badge' | 'points' | 'feature_unlock' | 'discount' | 'recognition'
  name: string
  description: string
  value?: number
  metadata?: any
}

export interface CompletionRecommendation {
  id: string
  type: 'quick_win' | 'high_impact' | 'verification' | 'engagement' | 'business'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  title: string
  description: string
  estimatedTime: string // e.g., "2 minutes", "5 minutes"
  potentialPoints: number
  actionUrl?: string
  actionText?: string
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
  dependencies?: string[]
}

export interface ProfileBadge {
  id: string
  name: string
  description: string
  iconUrl: string
  category: 'completion' | 'engagement' | 'verification' | 'social' | 'business' | 'achievement'
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  earnedAt: string
  displayOrder: number
  isVisible: boolean
  metadata?: any
}

export interface CompletionStreak {
  id: string
  type: 'daily_update' | 'weekly_improvement' | 'monthly_milestone'
  currentStreak: number
  bestStreak: number
  lastActivityDate: string
  isActive: boolean
  nextReward?: MilestoneReward
}

export interface CompletionAnalytics {
  userId: string
  averageCompletionTime: number
  mostImprovedSection: string
  completionTrend: 'improving' | 'stable' | 'declining'
  weeklyProgress: number[]
  sectionProgress: Record<string, number>
  engagementScore: number
  benchmarkComparison: {
    percentile: number
    category: 'new_user' | 'active_user' | 'power_user'
  }
}

/**
 * Profile Completion Scoring Manager
 * 
 * Handles profile completion scoring, gamification, and user engagement
 * through intelligent recommendations and achievement tracking.
 */
export class ProfileCompletionManager {
  private supabase = createClient()

  // Profile completion configuration
  private static readonly COMPLETION_CONFIG = {
    maxScore: 100,
    levels: {
      basic: { minScore: 0, maxScore: 24 },
      intermediate: { minScore: 25, maxScore: 49 },
      advanced: { minScore: 50, maxScore: 74 },
      complete: { minScore: 75, maxScore: 94 },
      expert: { minScore: 95, maxScore: 100 }
    },
    sections: {
      basic: {
        name: 'Basic Information',
        weight: 1.5,
        maxPoints: 25,
        fields: {
          first_name: { points: 5, required: true },
          last_name: { points: 5, required: true },
          display_name: { points: 3, required: false },
          bio: { points: 8, required: false, minLength: 10 },
          avatar_url: { points: 4, required: false }
        }
      },
      contact: {
        name: 'Contact Information',
        weight: 1.2,
        maxPoints: 20,
        fields: {
          email_verified: { points: 10, required: true },
          phone_number: { points: 5, required: false },
          phone_verified: { points: 5, required: false }
        }
      },
      location: {
        name: 'Location',
        weight: 1.0,
        maxPoints: 15,
        fields: {
          city: { points: 5, required: false },
          state: { points: 3, required: false },
          country: { points: 5, required: false },
          timezone: { points: 2, required: false }
        }
      },
      social: {
        name: 'Social Presence',
        weight: 0.8,
        maxPoints: 15,
        fields: {
          website: { points: 5, required: false },
          social_links: { points: 10, required: false, minLinks: 1 }
        }
      },
      preferences: {
        name: 'Preferences & Privacy',
        weight: 1.0,
        maxPoints: 15,
        fields: {
          data_processing_consent: { points: 5, required: false },
          marketing_consent: { points: 3, required: false },
          privacy_settings: { points: 7, required: false }
        }
      },
      business: {
        name: 'Business Information',
        weight: 1.3,
        maxPoints: 10,
        fields: {
          is_business_owner: { points: 3, required: false },
          business_owner_verified: { points: 7, required: false }
        },
        conditions: ['is_business_owner']
      }
    }
  }

  /**
   * Calculate comprehensive profile completion score
   */
  async calculateProfileCompletion(userId: string): Promise<ProfileCompletionScore> {
    try {
      // Get user profile data
      const { data: profile, error: profileError } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (profileError || !profile) {
        throw new Error('Profile not found')
      }

      // Get user preferences
      const { data: preferences } = await this.supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)

      // Calculate section scores
      const sections = await this.calculateSectionScores(profile, preferences || [])
      
      // Calculate total score
      const totalScore = sections.reduce((sum, section) => sum + section.currentPoints, 0)
      const maxScore = ProfileCompletionManager.COMPLETION_CONFIG.maxScore
      const completionPercentage = Math.round((totalScore / maxScore) * 100)
      
      // Determine completion level
      const level = this.determineCompletionLevel(totalScore)
      
      // Get completed and missing sections
      const completedSections = sections.filter(s => s.isCompleted)
      const missingSections = sections.filter(s => !s.isCompleted)
      
      // Get next milestone
      const nextMilestone = await this.getNextMilestone(userId, totalScore, level)
      
      // Generate recommendations
      const recommendations = await this.generateRecommendations(
        userId,
        sections,
        profile,
        preferences || []
      )
      
      // Get user badges
      const badges = await this.getUserBadges(userId)
      
      // Get completion streaks
      const streaks = await this.getCompletionStreaks(userId)

      // Update profile completion in database
      await this.updateProfileCompletionScore(userId, totalScore, level)

      return {
        userId,
        totalScore,
        maxScore,
        completionPercentage,
        level,
        completedSections,
        missingSections,
        nextMilestone,
        recommendations,
        badges,
        streaks,
        lastUpdated: new Date().toISOString()
      }

    } catch (error) {
      console.error('Failed to calculate profile completion:', error)
      throw new Error('Profile completion calculation failed')
    }
  }

  /**
   * Update profile completion and check for achievements
   */
  async updateCompletionAndCheckAchievements(userId: string): Promise<{
    completion: ProfileCompletionScore
    newBadges: ProfileBadge[]
    newMilestones: CompletionMilestone[]
  }> {
    try {
      const completion = await this.calculateProfileCompletion(userId)
      
      // Check for new badges
      const newBadges = await this.checkForNewBadges(userId, completion)
      
      // Check for new milestones
      const newMilestones = await this.checkForNewMilestones(userId, completion)
      
      // Update streaks
      await this.updateCompletionStreaks(userId)
      
      return {
        completion,
        newBadges,
        newMilestones
      }

    } catch (error) {
      console.error('Failed to update completion and check achievements:', error)
      throw new Error('Achievement check failed')
    }
  }

  /**
   * Get profile completion analytics
   */
  async getCompletionAnalytics(userId: string): Promise<CompletionAnalytics> {
    try {
      // Get completion history
      const { data: completionHistory } = await this.supabase
        .from('profile_completion_history')
        .select('*')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: true })
        .limit(30)

      // Calculate analytics
      const analytics = this.calculateCompletionAnalytics(userId, completionHistory || [])
      
      return analytics

    } catch (error) {
      console.error('Failed to get completion analytics:', error)
      throw new Error('Analytics calculation failed')
    }
  }

  /**
   * Get completion leaderboard
   */
  async getCompletionLeaderboard(
    limit: number = 50,
    category?: 'overall' | 'business_owners' | 'new_users'
  ): Promise<Array<{
    userId: string
    displayName: string
    avatarUrl?: string
    completionScore: number
    completionLevel: string
    badgeCount: number
    rank: number
  }>> {
    try {
      let query = this.supabase
        .from('profile_completion_scores')
        .select(`
          user_id,
          completion_score,
          completion_level,
          profiles!inner(display_name, avatar_url, is_business_owner, created_at)
        `)
        .order('completion_score', { ascending: false })
        .limit(limit)

      // Apply category filter
      if (category === 'business_owners') {
        query = query.eq('profiles.is_business_owner', true)
      } else if (category === 'new_users') {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        query = query.gte('profiles.created_at', thirtyDaysAgo)
      }

      const { data: leaderboard, error } = await query

      if (error) throw error

      // Get badge counts
      const userIds = leaderboard?.map(entry => entry.user_id) || []
      const { data: badgeCounts } = await this.supabase
        .from('user_badges')
        .select('user_id')
        .in('user_id', userIds)
        
      const badgeCountMap = badgeCounts?.reduce((acc, badge) => {
        acc[badge.user_id] = (acc[badge.user_id] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {}

      return leaderboard?.map((entry, index) => ({
        userId: entry.user_id,
        displayName: entry.profiles.display_name || 'Anonymous User',
        avatarUrl: entry.profiles.avatar_url,
        completionScore: entry.completion_score,
        completionLevel: entry.completion_level,
        badgeCount: badgeCountMap[entry.user_id] || 0,
        rank: index + 1
      })) || []

    } catch (error) {
      console.error('Failed to get completion leaderboard:', error)
      return []
    }
  }

  // Private helper methods

  private async calculateSectionScores(
    profile: any,
    preferences: any[]
  ): Promise<ProfileSection[]> {
    const sections: ProfileSection[] = []
    const config = ProfileCompletionManager.COMPLETION_CONFIG.sections

    for (const [sectionId, sectionConfig] of Object.entries(config)) {
      // Check if section applies to user
      if (sectionConfig.conditions && !this.checkSectionConditions(profile, sectionConfig.conditions)) {
        continue
      }

      const fields: ProfileField[] = []
      let sectionPoints = 0

      for (const [fieldId, fieldConfig] of Object.entries(sectionConfig.fields)) {
        const fieldValue = this.getFieldValue(profile, preferences, fieldId)
        const isCompleted = this.evaluateFieldCompletion(fieldValue, fieldConfig)
        const points = isCompleted ? fieldConfig.points : 0

        fields.push({
          id: fieldId,
          name: fieldId,
          displayName: this.getFieldDisplayName(fieldId),
          type: this.inferFieldType(fieldId),
          points: fieldConfig.points,
          isRequired: fieldConfig.required,
          isCompleted,
          hasValue: fieldValue !== null && fieldValue !== undefined && fieldValue !== '',
          validationStatus: this.getFieldValidationStatus(profile, fieldId),
          lastUpdated: profile.updated_at
        })

        sectionPoints += points
      }

      // Check section requirements
      const requirements = this.checkSectionRequirements(sectionId, fields, profile)
      const isCompleted = requirements.every(req => req.isMet) && 
                         sectionPoints >= sectionConfig.maxPoints * 0.8 // 80% threshold

      sections.push({
        id: sectionId,
        name: sectionConfig.name,
        description: this.getSectionDescription(sectionId),
        category: this.getSectionCategory(sectionId),
        weight: sectionConfig.weight,
        maxPoints: sectionConfig.maxPoints,
        currentPoints: Math.round(sectionPoints * sectionConfig.weight),
        isCompleted,
        fields,
        requirements
      })
    }

    return sections
  }

  private checkSectionConditions(profile: any, conditions: string[]): boolean {
    return conditions.every(condition => {
      switch (condition) {
        case 'is_business_owner':
          return profile.is_business_owner === true
        default:
          return true
      }
    })
  }

  private getFieldValue(profile: any, preferences: any[], fieldId: string): any {
    // Check profile fields
    if (profile.hasOwnProperty(fieldId)) {
      return profile[fieldId]
    }

    // Check preferences
    const preference = preferences.find(p => 
      p.preference_key === fieldId || 
      p.preference_key.endsWith(fieldId)
    )
    
    return preference?.preference_value
  }

  private evaluateFieldCompletion(value: any, fieldConfig: any): boolean {
    if (value === null || value === undefined || value === '') {
      return false
    }

    // Special field validations
    if (fieldConfig.minLength && typeof value === 'string') {
      return value.length >= fieldConfig.minLength
    }

    if (fieldConfig.minLinks && typeof value === 'object') {
      const links = Object.values(value).filter(v => v !== null && v !== '')
      return links.length >= fieldConfig.minLinks
    }

    // Boolean fields
    if (typeof value === 'boolean') {
      return value === true
    }

    return true
  }

  private getFieldValidationStatus(profile: any, fieldId: string): 'valid' | 'invalid' | 'pending' | 'not_validated' {
    switch (fieldId) {
      case 'email_verified':
        return profile.email_verified ? 'valid' : 'invalid'
      case 'phone_verified':
        return profile.phone_verified ? 'valid' : 'invalid'
      default:
        return 'not_validated'
    }
  }

  private checkSectionRequirements(
    sectionId: string,
    fields: ProfileField[],
    profile: any
  ): SectionRequirement[] {
    const requirements: SectionRequirement[] = []

    switch (sectionId) {
      case 'basic':
        requirements.push({
          type: 'min_fields',
          description: 'Complete at least 3 basic fields',
          isMet: fields.filter(f => f.isCompleted).length >= 3
        })
        break

      case 'contact':
        requirements.push({
          type: 'verification',
          description: 'Verify email address',
          isMet: profile.email_verified === true
        })
        break

      case 'business':
        if (profile.is_business_owner) {
          requirements.push({
            type: 'verification',
            description: 'Complete business owner verification',
            isMet: profile.business_owner_verified === true
          })
        }
        break
    }

    return requirements
  }

  private determineCompletionLevel(score: number): 'basic' | 'intermediate' | 'advanced' | 'complete' | 'expert' {
    const levels = ProfileCompletionManager.COMPLETION_CONFIG.levels

    for (const [level, range] of Object.entries(levels)) {
      if (score >= range.minScore && score <= range.maxScore) {
        return level as any
      }
    }

    return 'basic'
  }

  private async getNextMilestone(
    userId: string,
    currentScore: number,
    currentLevel: string
  ): Promise<CompletionMilestone | null> {
    // Get user's achieved milestones
    const { data: achievedMilestones } = await this.supabase
      .from('user_milestones')
      .select('milestone_id')
      .eq('user_id', userId)

    const achievedIds = achievedMilestones?.map(m => m.milestone_id) || []

    // Get next available milestone
    const { data: nextMilestone } = await this.supabase
      .from('completion_milestones')
      .select('*')
      .gt('required_score', currentScore)
      .not('id', 'in', `(${achievedIds.join(',')})`)
      .order('required_score', { ascending: true })
      .limit(1)
      .single()

    return nextMilestone ? {
      id: nextMilestone.id,
      name: nextMilestone.name,
      description: nextMilestone.description,
      requiredScore: nextMilestone.required_score,
      requiredLevel: nextMilestone.required_level,
      rewards: nextMilestone.rewards || [],
      isAchieved: false
    } : null
  }

  private async generateRecommendations(
    userId: string,
    sections: ProfileSection[],
    profile: any,
    preferences: any[]
  ): Promise<CompletionRecommendation[]> {
    const recommendations: CompletionRecommendation[] = []

    // Quick wins - easy high-value fields
    const incompleteFields = sections
      .flatMap(s => s.fields)
      .filter(f => !f.isCompleted)
      .sort((a, b) => b.points - a.points)

    for (const field of incompleteFields.slice(0, 3)) {
      if (field.points >= 5) {
        recommendations.push({
          id: `quick_win_${field.id}`,
          type: 'quick_win',
          priority: 'high',
          title: `Add ${field.displayName}`,
          description: `Complete your ${field.displayName.toLowerCase()} to earn ${field.points} points`,
          estimatedTime: '2 minutes',
          potentialPoints: field.points,
          actionUrl: `/settings/profile`,
          actionText: 'Update Profile',
          category: 'profile',
          difficulty: 'easy'
        })
      }
    }

    // Verification recommendations
    if (!profile.email_verified) {
      recommendations.push({
        id: 'verify_email',
        type: 'verification',
        priority: 'high',
        title: 'Verify Your Email',
        description: 'Verify your email address to earn 10 points and unlock additional features',
        estimatedTime: '3 minutes',
        potentialPoints: 10,
        actionUrl: '/settings/verification',
        actionText: 'Verify Email',
        category: 'verification',
        difficulty: 'easy'
      })
    }

    if (profile.phone_number && !profile.phone_verified) {
      recommendations.push({
        id: 'verify_phone',
        type: 'verification',
        priority: 'medium',
        title: 'Verify Your Phone',
        description: 'Verify your phone number to earn 5 points and improve security',
        estimatedTime: '2 minutes',
        potentialPoints: 5,
        actionUrl: '/settings/verification',
        actionText: 'Verify Phone',
        category: 'verification',
        difficulty: 'easy'
      })
    }

    // Business owner recommendations
    if (profile.is_business_owner && !profile.business_owner_verified) {
      recommendations.push({
        id: 'verify_business',
        type: 'business',
        priority: 'high',
        title: 'Complete Business Verification',
        description: 'Complete your business owner verification to earn 7 points and unlock business features',
        estimatedTime: '10 minutes',
        potentialPoints: 7,
        actionUrl: '/business/verification',
        actionText: 'Verify Business',
        category: 'business',
        difficulty: 'medium'
      })
    }

    return recommendations.slice(0, 5) // Limit to top 5 recommendations
  }

  private async getUserBadges(userId: string): Promise<ProfileBadge[]> {
    const { data: userBadges } = await this.supabase
      .from('user_badges')
      .select(`
        *,
        badges(*)
      `)
      .eq('user_id', userId)
      .order('earned_at', { ascending: false })

    return userBadges?.map(ub => ({
      id: ub.badges.id,
      name: ub.badges.name,
      description: ub.badges.description,
      iconUrl: ub.badges.icon_url,
      category: ub.badges.category,
      rarity: ub.badges.rarity,
      earnedAt: ub.earned_at,
      displayOrder: ub.badges.display_order,
      isVisible: ub.is_visible,
      metadata: ub.badges.metadata
    })) || []
  }

  private async getCompletionStreaks(userId: string): Promise<CompletionStreak[]> {
    const { data: streaks } = await this.supabase
      .from('completion_streaks')
      .select('*')
      .eq('user_id', userId)
      .order('last_activity_date', { ascending: false })

    return streaks?.map(streak => ({
      id: streak.id,
      type: streak.streak_type,
      currentStreak: streak.current_streak,
      bestStreak: streak.best_streak,
      lastActivityDate: streak.last_activity_date,
      isActive: streak.is_active,
      nextReward: streak.next_reward
    })) || []
  }

  private async updateProfileCompletionScore(
    userId: string,
    totalScore: number,
    level: string
  ): Promise<void> {
    await this.supabase
      .from('profiles')
      .update({
        profile_completion_score: totalScore,
        profile_completion_level: level,
        last_profile_update: new Date().toISOString()
      })
      .eq('id', userId)

    // Record completion history
    await this.supabase
      .from('profile_completion_history')
      .insert({
        user_id: userId,
        completion_score: totalScore,
        completion_level: level,
        recorded_at: new Date().toISOString()
      })
  }

  private async checkForNewBadges(
    userId: string,
    completion: ProfileCompletionScore
  ): Promise<ProfileBadge[]> {
    // TODO: Implement badge checking logic
    return []
  }

  private async checkForNewMilestones(
    userId: string,
    completion: ProfileCompletionScore
  ): Promise<CompletionMilestone[]> {
    // TODO: Implement milestone checking logic
    return []
  }

  private async updateCompletionStreaks(userId: string): Promise<void> {
    // TODO: Implement streak updating logic
  }

  private calculateCompletionAnalytics(
    userId: string,
    history: any[]
  ): CompletionAnalytics {
    // TODO: Implement analytics calculation
    return {
      userId,
      averageCompletionTime: 0,
      mostImprovedSection: '',
      completionTrend: 'stable',
      weeklyProgress: [],
      sectionProgress: {},
      engagementScore: 0,
      benchmarkComparison: {
        percentile: 50,
        category: 'active_user'
      }
    }
  }

  // Utility methods for field metadata
  private getFieldDisplayName(fieldId: string): string {
    const displayNames: Record<string, string> = {
      first_name: 'First Name',
      last_name: 'Last Name',
      display_name: 'Display Name',
      bio: 'Bio',
      avatar_url: 'Profile Picture',
      email_verified: 'Email Verification',
      phone_number: 'Phone Number',
      phone_verified: 'Phone Verification',
      city: 'City',
      state: 'State/Province',
      country: 'Country',
      timezone: 'Timezone',
      website: 'Website',
      social_links: 'Social Links',
      data_processing_consent: 'Data Processing Consent',
      marketing_consent: 'Marketing Consent',
      is_business_owner: 'Business Owner Status',
      business_owner_verified: 'Business Verification'
    }

    return displayNames[fieldId] || fieldId.replace('_', ' ')
  }

  private inferFieldType(fieldId: string): ProfileField['type'] {
    const typeMap: Record<string, ProfileField['type']> = {
      first_name: 'text',
      last_name: 'text',
      display_name: 'text',
      bio: 'text',
      avatar_url: 'image',
      email_verified: 'boolean',
      phone_number: 'phone',
      phone_verified: 'boolean',
      city: 'text',
      state: 'text',
      country: 'select',
      timezone: 'select',
      website: 'url',
      social_links: 'text',
      data_processing_consent: 'boolean',
      marketing_consent: 'boolean',
      is_business_owner: 'boolean',
      business_owner_verified: 'boolean'
    }

    return typeMap[fieldId] || 'text'
  }

  private getSectionDescription(sectionId: string): string {
    const descriptions: Record<string, string> = {
      basic: 'Essential profile information like your name, bio, and profile picture',
      contact: 'Contact details and verification status',
      location: 'Your geographic information and timezone',
      social: 'Website and social media links',
      preferences: 'Privacy settings and consent preferences',
      business: 'Business owner information and verification'
    }

    return descriptions[sectionId] || ''
  }

  private getSectionCategory(sectionId: string): ProfileSection['category'] {
    const categoryMap: Record<string, ProfileSection['category']> = {
      basic: 'basic',
      contact: 'contact',
      location: 'personal',
      social: 'social',
      preferences: 'preferences',
      business: 'business'
    }

    return categoryMap[sectionId] || 'basic'
  }
}

// Export singleton instance
export const profileCompletionManager = new ProfileCompletionManager()

// Cached completion functions
export const getCachedProfileCompletion = cache(async (userId: string) => {
  return profileCompletionManager.calculateProfileCompletion(userId)
})

export const getCachedCompletionAnalytics = cache(async (userId: string) => {
  return profileCompletionManager.getCompletionAnalytics(userId)
})

// Utility functions for common operations
export async function quickProfileCheck(userId: string): Promise<{
  score: number
  level: string
  topRecommendations: CompletionRecommendation[]
}> {
  const completion = await getCachedProfileCompletion(userId)
  
  return {
    score: completion.totalScore,
    level: completion.level,
    topRecommendations: completion.recommendations.slice(0, 3)
  }
}