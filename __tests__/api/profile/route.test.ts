/**
 * API Integration Tests for Profile Management
 * Epic 2 Story 2.7: User Profile Management & Preferences Infrastructure
 * 
 * Tests for profile management API endpoints including
 * CRUD operations, validation, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, jest, beforeAll, afterAll } from '@jest/globals'
import { NextRequest, NextResponse } from 'next/server'
import { GET, PUT, PATCH, DELETE } from '@/app/api/profile/route'

// Mock dependencies
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn()
}))

jest.mock('@/lib/profile/completion-scoring', () => ({
  profileCompletionManager: {
    calculateProfileCompletion: jest.fn(),
    updateCompletionAndCheckAchievements: jest.fn(),
    getCompletionAnalytics: jest.fn()
  },
  quickProfileCheck: jest.fn()
}))

describe('/api/profile API Tests', () => {
  let mockSupabase: any
  let mockSession: any
  let mockUser: any

  beforeAll(() => {
    // Mock Supabase client
    mockSupabase = {
      auth: {
        getSession: jest.fn()
      },
      from: jest.fn()
    }

    // Mock session and user
    mockUser = {
      id: 'test-user-123',
      email: 'test@example.com',
      email_confirmed_at: '2025-01-01T00:00:00Z'
    }

    mockSession = {
      user: mockUser,
      access_token: 'test-token',
      token_type: 'bearer'
    }

    // Mock query builder
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      then: jest.fn()
    }

    mockSupabase.from.mockReturnValue(mockQuery)
    ;(require('@/lib/supabase/server').createClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default successful auth mock
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null
    })
  })

  describe('GET /api/profile', () => {
    let mockProfile: any

    beforeEach(() => {
      mockProfile = {
        id: mockUser.id,
        display_name: 'Test User',
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User',
        email_verified: true,
        avatar_url: 'https://example.com/avatar.jpg',
        bio: 'Test bio',
        profile_completion_score: 75,
        profile_completion_level: 'advanced',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        user_roles: [
          {
            role_id: 'role-1',
            is_active: true,
            roles: {
              name: 'user',
              display_name: 'User'
            }
          }
        ]
      }
    })

    it('should return user profile successfully', async () => {
      const mockQuery = mockSupabase.from('profiles')
      mockQuery.single.mockResolvedValue({
        data: mockProfile,
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/profile')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.profile).toBeDefined()
      expect(data.profile.id).toBe(mockUser.id)
      expect(data.profile.displayName).toBe('Test User')
      expect(data.profile.roles).toHaveLength(1)
      expect(data.profile.roles[0].name).toBe('user')
    })

    it('should include completion data when requested', async () => {
      const mockQuery = mockSupabase.from('profiles')
      mockQuery.single.mockResolvedValue({
        data: mockProfile,
        error: null
      })

      const mockCompletion = {
        totalScore: 75,
        completionPercentage: 75,
        level: 'advanced'
      }

      const { profileCompletionManager } = require('@/lib/profile/completion-scoring')
      profileCompletionManager.calculateProfileCompletion.mockResolvedValue(mockCompletion)

      const request = new NextRequest('http://localhost:3000/api/profile?includeCompletion=true')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.completion).toEqual(mockCompletion)
      expect(profileCompletionManager.calculateProfileCompletion).toHaveBeenCalledWith(mockUser.id)
    })

    it('should include analytics when requested', async () => {
      const mockQuery = mockSupabase.from('profiles')
      mockQuery.single.mockResolvedValue({
        data: mockProfile,
        error: null
      })

      const mockAnalytics = {
        averageCompletionTime: 1000,
        completionTrend: 'improving'
      }

      const { profileCompletionManager } = require('@/lib/profile/completion-scoring')
      profileCompletionManager.getCompletionAnalytics.mockResolvedValue(mockAnalytics)

      const request = new NextRequest('http://localhost:3000/api/profile?includeAnalytics=true')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.analytics).toEqual(mockAnalytics)
    })

    it('should include recommendations when requested', async () => {
      const mockQuery = mockSupabase.from('profiles')
      mockQuery.single.mockResolvedValue({
        data: mockProfile,
        error: null
      })

      const mockRecommendations = [
        {
          type: 'quick_win',
          title: 'Add bio',
          description: 'Complete your bio to earn points'
        }
      ]

      const { quickProfileCheck } = require('@/lib/profile/completion-scoring')
      quickProfileCheck.mockResolvedValue({
        score: 75,
        level: 'advanced',
        topRecommendations: mockRecommendations
      })

      const request = new NextRequest('http://localhost:3000/api/profile?includeRecommendations=true')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.recommendations).toEqual(mockRecommendations)
    })

    it('should handle authentication failure', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/profile')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
      expect(data.code).toBe('AUTH_REQUIRED')
    })

    it('should handle profile fetch errors', async () => {
      const mockQuery = mockSupabase.from('profiles')
      mockQuery.single.mockResolvedValue({
        data: null,
        error: { message: 'Profile not found' }
      })

      const request = new NextRequest('http://localhost:3000/api/profile')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch profile')
      expect(data.code).toBe('PROFILE_FETCH_FAILED')
    })
  })

  describe('PUT /api/profile', () => {
    let mockProfile: any

    beforeEach(() => {
      mockProfile = {
        id: mockUser.id,
        display_name: 'Updated User',
        first_name: 'Updated',
        last_name: 'User',
        bio: 'Updated bio',
        updated_at: '2025-01-01T12:00:00Z'
      }
    })

    it('should update profile successfully', async () => {
      const mockQuery = mockSupabase.from('profiles')
      mockQuery.single.mockResolvedValue({
        data: mockProfile,
        error: null
      })

      const mockCompletion = {
        completion: { totalScore: 80 },
        newBadges: [],
        newMilestones: []
      }

      const { profileCompletionManager } = require('@/lib/profile/completion-scoring')
      profileCompletionManager.updateCompletionAndCheckAchievements.mockResolvedValue(mockCompletion)

      const auditQuery = mockSupabase.from('auth_audit_logs')
      auditQuery.insert.mockResolvedValue({ error: null })

      const updateData = {
        display_name: 'Updated User',
        first_name: 'Updated',
        last_name: 'User',
        bio: 'Updated bio'
      }

      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.profile).toEqual(mockProfile)
      expect(data.completion).toBeDefined()
      expect(mockQuery.update).toHaveBeenCalled()
    })

    it('should validate allowed fields', async () => {
      const updateData = {
        display_name: 'Updated User',
        invalid_field: 'should be ignored',
        another_invalid: 'also ignored'
      }

      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      // Should only update valid fields, ignoring invalid ones
      expect(mockSupabase.from('profiles').update).toHaveBeenCalledWith(
        expect.not.objectContaining({
          invalid_field: expect.anything(),
          another_invalid: expect.anything()
        })
      )
    })

    it('should handle empty update data', async () => {
      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'PUT',
        body: JSON.stringify({})
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('No valid fields provided')
      expect(data.code).toBe('NO_VALID_FIELDS')
    })

    it('should check username uniqueness', async () => {
      const mockQuery = mockSupabase.from('profiles')
      
      // Mock existing user with same username
      mockQuery.single
        .mockResolvedValueOnce({
          data: { id: 'other-user-id' },
          error: null
        })

      const updateData = {
        username: 'existinguser'
      }

      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toBe('Username already taken')
      expect(data.code).toBe('USERNAME_TAKEN')
    })

    it('should handle database update errors', async () => {
      const mockQuery = mockSupabase.from('profiles')
      mockQuery.single
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }) // Username check
        .mockResolvedValueOnce({ data: null, error: { message: 'Update failed' } }) // Update

      const updateData = {
        display_name: 'Updated User'
      }

      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to update profile')
      expect(data.code).toBe('UPDATE_FAILED')
    })
  })

  describe('PATCH /api/profile', () => {
    it('should update single field successfully', async () => {
      const mockQuery = mockSupabase.from('profiles')
      mockQuery.single.mockResolvedValue({
        data: {
          id: mockUser.id,
          display_name: 'New Display Name'
        },
        error: null
      })

      const mockCompletion = {
        completion: { totalScore: 80, level: 'advanced' }
      }

      const { profileCompletionManager } = require('@/lib/profile/completion-scoring')
      profileCompletionManager.updateCompletionAndCheckAchievements.mockResolvedValue(mockCompletion)

      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          field: 'display_name',
          value: 'New Display Name'
        })
      })

      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.field).toBe('display_name')
      expect(data.value).toBe('New Display Name')
      expect(data.completionScore).toBe(80)
    })

    it('should validate field name', async () => {
      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          field: 'invalid_field',
          value: 'some value'
        })
      })

      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid field name')
      expect(data.code).toBe('INVALID_FIELD')
    })

    it('should require field parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          value: 'some value'
        })
      })

      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Field name is required')
      expect(data.code).toBe('FIELD_REQUIRED')
    })

    it('should validate username format', async () => {
      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          field: 'username',
          value: 'a' // Too short
        })
      })

      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Username must be 3-50 characters')
      expect(data.code).toBe('INVALID_USERNAME')
    })

    it('should check username uniqueness for PATCH', async () => {
      const mockQuery = mockSupabase.from('profiles')
      mockQuery.single.mockResolvedValue({
        data: { id: 'other-user-id' },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          field: 'username',
          value: 'existinguser'
        })
      })

      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toBe('Username already taken')
      expect(data.code).toBe('USERNAME_TAKEN')
    })
  })

  describe('DELETE /api/profile', () => {
    it('should soft delete profile (anonymize)', async () => {
      const mockQuery = mockSupabase.from('profiles')
      mockQuery.mockResolvedValue({ error: null })

      const auditQuery = mockSupabase.from('auth_audit_logs')
      auditQuery.insert.mockResolvedValue({ error: null })

      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'DELETE',
        body: JSON.stringify({
          reason: 'User requested deletion',
          keepAnonymized: true
        })
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Profile anonymized successfully')
      expect(data.deletionType).toBe('anonymized')
      expect(mockQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          display_name: 'Deleted User',
          account_status: 'deleted'
        })
      )
    })

    it('should mark for hard deletion', async () => {
      const mockQuery = mockSupabase.from('profiles')
      mockQuery.mockResolvedValue({ error: null })

      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'DELETE',
        body: JSON.stringify({
          reason: 'GDPR request',
          keepAnonymized: false
        })
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Profile marked for deletion')
      expect(data.deletionType).toBe('marked_for_deletion')
      expect(mockQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          account_status: 'pending_deletion'
        })
      )
    })

    it('should handle deletion errors', async () => {
      const mockQuery = mockSupabase.from('profiles')
      mockQuery.mockResolvedValue({
        error: { message: 'Deletion failed' }
      })

      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'DELETE',
        body: JSON.stringify({
          keepAnonymized: true
        })
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
      expect(data.code).toBe('INTERNAL_ERROR')
    })
  })

  describe('Authentication and Authorization', () => {
    it('should handle missing session', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/profile')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
      expect(data.code).toBe('AUTH_REQUIRED')
    })

    it('should handle auth errors', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Auth service unavailable' }
      })

      const request = new NextRequest('http://localhost:3000/api/profile')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
      expect(data.code).toBe('AUTH_REQUIRED')
    })

    it('should handle invalid session user', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { 
          session: {
            access_token: 'token',
            user: null
          }
        },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/profile')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/profile', {
        method: 'PUT',
        body: 'invalid json'
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
      expect(data.code).toBe('INTERNAL_ERROR')
    })

    it('should handle database connection failures', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Database connection failed')
      })

      const request = new NextRequest('http://localhost:3000/api/profile')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
      expect(data.code).toBe('INTERNAL_ERROR')
    })

    it('should handle completion scoring service failures', async () => {
      const mockQuery = mockSupabase.from('profiles')
      mockQuery.single.mockResolvedValue({
        data: { id: mockUser.id },
        error: null
      })

      const { profileCompletionManager } = require('@/lib/profile/completion-scoring')
      profileCompletionManager.calculateProfileCompletion.mockRejectedValue(
        new Error('Completion service failed')
      )

      const request = new NextRequest('http://localhost:3000/api/profile?includeCompletion=true')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })
})