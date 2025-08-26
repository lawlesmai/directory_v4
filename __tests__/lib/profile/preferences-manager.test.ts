/**
 * Comprehensive Test Suite for Preferences Manager
 * Epic 2 Story 2.7: User Profile Management & Preferences Infrastructure
 * 
 * Tests for hierarchical preferences management with inheritance,
 * validation, and GDPR compliance features.
 */

import { describe, it, expect, beforeEach, afterEach, jest, beforeAll, afterAll } from '@jest/globals'
import { createClient } from '@supabase/supabase-js'
import { PreferencesManager } from '@/lib/profile/preferences-manager'

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn()
}))

describe('PreferencesManager', () => {
  let preferencesManager: PreferencesManager
  let mockSupabase: any
  let mockUserId: string

  beforeAll(() => {
    // Mock Supabase methods
    mockSupabase = {
      from: jest.fn(),
      rpc: jest.fn()
    }

    // Mock the query builder chain
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
      then: jest.fn()
    }

    mockSupabase.from.mockReturnValue(mockQuery)
    ;(require('@/lib/supabase/server').createClient as jest.Mock).mockReturnValue(mockSupabase)

    preferencesManager = new PreferencesManager()
    mockUserId = 'test-user-id-123'
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getUserPreferences', () => {
    it('should get user preferences with inheritance', async () => {
      const mockPreferences = [
        {
          id: 'pref-1',
          user_id: mockUserId,
          category: 'notifications',
          subcategory: 'email',
          preference_key: 'enabled',
          preference_value: true,
          is_inherited: false,
          data_type: 'boolean',
          created_at: '2025-01-01T00:00:00Z'
        },
        {
          id: 'pref-2',
          user_id: mockUserId,
          category: 'ui',
          subcategory: 'theme',
          preference_key: 'mode',
          preference_value: 'dark',
          is_inherited: true,
          data_type: 'string',
          created_at: '2025-01-01T00:00:00Z'
        }
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: mockPreferences.map(p => ({
          category: p.category,
          subcategory: p.subcategory,
          preference_key: p.preference_key,
          preference_value: p.preference_value,
          is_inherited: p.is_inherited,
          source: p.is_inherited ? 'inherited' : 'user'
        })),
        error: null
      })

      const result = await preferencesManager.getUserPreferences(mockUserId)

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'get_user_preferences_with_inheritance',
        {
          user_uuid: mockUserId,
          pref_category: null
        }
      )
      expect(result).toHaveLength(2)
      expect(result[0].category).toBe('notifications')
      expect(result[1].is_inherited).toBe(true)
    })

    it('should filter by category when specified', async () => {
      const mockPreferences = [
        {
          category: 'notifications',
          subcategory: 'email',
          preference_key: 'enabled',
          preference_value: true,
          is_inherited: false,
          source: 'user'
        }
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: mockPreferences,
        error: null
      })

      await preferencesManager.getUserPreferences(mockUserId, 'notifications')

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'get_user_preferences_with_inheritance',
        {
          user_uuid: mockUserId,
          pref_category: 'notifications'
        }
      )
    })

    it('should handle database errors gracefully', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      })

      await expect(preferencesManager.getUserPreferences(mockUserId))
        .rejects.toThrow('Failed to retrieve user preferences')
    })
  })

  describe('getUserPreference', () => {
    it('should get a specific preference value', async () => {
      const mockPreferences = [
        {
          category: 'notifications',
          subcategory: 'email',
          preference_key: 'enabled',
          preference_value: true,
          is_inherited: false,
          source: 'user'
        }
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: mockPreferences,
        error: null
      })

      const result = await preferencesManager.getUserPreference(
        mockUserId,
        'notifications',
        'enabled',
        'email'
      )

      expect(result).toBe(true)
    })

    it('should return default value from template when preference not found', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null
      })

      const mockQuery = mockSupabase.from('preference_templates')
      mockQuery.single.mockResolvedValue({
        data: {
          default_value: false,
          data_type: 'boolean'
        },
        error: null
      })

      const result = await preferencesManager.getUserPreference(
        mockUserId,
        'notifications',
        'marketing',
        'email'
      )

      expect(result).toBe(false)
    })

    it('should return null when no preference or template found', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null
      })

      const mockQuery = mockSupabase.from('preference_templates')
      mockQuery.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' } // No rows found
      })

      const result = await preferencesManager.getUserPreference(
        mockUserId,
        'notifications',
        'nonexistent'
      )

      expect(result).toBeNull()
    })
  })

  describe('updateUserPreference', () => {
    let mockTemplate: any

    beforeEach(() => {
      mockTemplate = {
        id: 'template-1',
        template_name: 'email_notifications',
        category: 'notifications',
        preference_key: 'enabled',
        default_value: true,
        data_type: 'boolean',
        validation_schema: { type: 'boolean' },
        allowed_values: null,
        is_required: false,
        is_user_configurable: true,
        requires_consent: false,
        is_sensitive: false
      }
    })

    it('should create new preference when none exists', async () => {
      const mockQuery = mockSupabase.from('preference_templates')
      mockQuery.single.mockResolvedValue({
        data: mockTemplate,
        error: null
      })

      const prefsQuery = mockSupabase.from('user_preferences')
      prefsQuery.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      })

      const insertResult = {
        id: 'new-pref-1',
        user_id: mockUserId,
        category: 'notifications',
        preference_key: 'enabled',
        preference_value: true,
        version: 1
      }

      prefsQuery.select.mockReturnValue(prefsQuery)
      prefsQuery.single.mockResolvedValue({
        data: insertResult,
        error: null
      })

      const result = await preferencesManager.updateUserPreference(
        mockUserId,
        'notifications',
        'enabled',
        true
      )

      expect(result.success).toBe(true)
      expect(result.updatedPreference?.preference_value).toBe(true)
      expect(mockSupabase.from).toHaveBeenCalledWith('user_preferences')
    })

    it('should update existing preference', async () => {
      const mockQuery = mockSupabase.from('preference_templates')
      mockQuery.single.mockResolvedValue({
        data: mockTemplate,
        error: null
      })

      const existingPref = {
        id: 'existing-pref-1',
        user_id: mockUserId,
        category: 'notifications',
        preference_key: 'enabled',
        preference_value: false,
        version: 1
      }

      const prefsQuery = mockSupabase.from('user_preferences')
      prefsQuery.single.mockResolvedValue({
        data: existingPref,
        error: null
      })

      const updateResult = {
        ...existingPref,
        preference_value: true,
        version: 2
      }

      prefsQuery.select.mockReturnValue(prefsQuery)
      prefsQuery.single.mockResolvedValue({
        data: updateResult,
        error: null
      })

      const result = await preferencesManager.updateUserPreference(
        mockUserId,
        'notifications',
        'enabled',
        true
      )

      expect(result.success).toBe(true)
      expect(result.updatedPreference?.version).toBe(2)
    })

    it('should validate preference value against template', async () => {
      const restrictiveTemplate = {
        ...mockTemplate,
        data_type: 'string',
        allowed_values: ['light', 'dark', 'auto']
      }

      const mockQuery = mockSupabase.from('preference_templates')
      mockQuery.single.mockResolvedValue({
        data: restrictiveTemplate,
        error: null
      })

      const result = await preferencesManager.updateUserPreference(
        mockUserId,
        'ui',
        'theme',
        'invalid_theme'
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Validation failed')
    })

    it('should require consent when template specifies', async () => {
      const consentTemplate = {
        ...mockTemplate,
        requires_consent: true
      }

      const mockQuery = mockSupabase.from('preference_templates')
      mockQuery.single.mockResolvedValue({
        data: consentTemplate,
        error: null
      })

      const result = await preferencesManager.updateUserPreference(
        mockUserId,
        'privacy',
        'marketing_emails',
        true
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('requires explicit consent')
    })

    it('should handle template not found', async () => {
      const mockQuery = mockSupabase.from('preference_templates')
      mockQuery.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      })

      const result = await preferencesManager.updateUserPreference(
        mockUserId,
        'nonexistent',
        'preference',
        'value'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Preference template not found')
    })
  })

  describe('bulkUpdateUserPreferences', () => {
    it('should update multiple preferences successfully', async () => {
      const updates = [
        {
          category: 'notifications',
          preferences: {
            'email_enabled': true,
            'push_enabled': false
          }
        },
        {
          category: 'ui',
          subcategory: 'theme',
          preferences: {
            'mode': 'dark'
          }
        }
      ]

      // Mock successful individual updates
      jest.spyOn(preferencesManager, 'updateUserPreference')
        .mockResolvedValue({
          success: true,
          updatedPreference: {} as any
        })

      const result = await preferencesManager.bulkUpdateUserPreferences(
        mockUserId,
        updates
      )

      expect(result.success).toBe(true)
      expect(result.results).toHaveLength(3) // 2 + 1 preferences
      expect(result.errors).toHaveLength(0)
      expect(preferencesManager.updateUserPreference).toHaveBeenCalledTimes(3)
    })

    it('should handle partial failures gracefully', async () => {
      const updates = [
        {
          category: 'notifications',
          preferences: {
            'email_enabled': true,
            'invalid_pref': 'invalid_value'
          }
        }
      ]

      jest.spyOn(preferencesManager, 'updateUserPreference')
        .mockResolvedValueOnce({
          success: true,
          updatedPreference: {} as any
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Invalid preference'
        })

      const result = await preferencesManager.bulkUpdateUserPreferences(
        mockUserId,
        updates
      )

      expect(result.success).toBe(false)
      expect(result.results).toHaveLength(2)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('invalid_pref')
    })

    it('should validate input parameters', async () => {
      const result = await preferencesManager.bulkUpdateUserPreferences(
        mockUserId,
        []
      )

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('deleteUserPreference', () => {
    it('should delete preference successfully', async () => {
      const mockQuery = mockSupabase.from('user_preferences')
      mockQuery.mockResolvedValue({
        error: null
      })

      const result = await preferencesManager.deleteUserPreference(
        mockUserId,
        'notifications',
        'enabled'
      )

      expect(result.success).toBe(true)
      expect(mockQuery.delete).toHaveBeenCalled()
    })

    it('should handle deletion errors', async () => {
      const mockQuery = mockSupabase.from('user_preferences')
      mockQuery.mockResolvedValue({
        error: { message: 'Delete failed' }
      })

      const result = await preferencesManager.deleteUserPreference(
        mockUserId,
        'notifications',
        'enabled'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Delete failed')
    })
  })

  describe('exportUserPreferences', () => {
    it('should export user preferences for GDPR compliance', async () => {
      const mockPreferences = [
        {
          id: 'pref-1',
          user_id: mockUserId,
          category: 'notifications',
          preference_key: 'enabled',
          preference_value: true,
          gdpr_category: 'user_preferences'
        }
      ]

      const mockTemplates = [
        {
          id: 'template-1',
          category: 'notifications',
          preference_key: 'enabled',
          default_value: false
        }
      ]

      // Mock getUserPreferences
      jest.spyOn(preferencesManager, 'getUserPreferences')
        .mockResolvedValue(mockPreferences as any)

      // Mock getPreferenceTemplates
      jest.spyOn(preferencesManager, 'getPreferenceTemplates')
        .mockResolvedValue(mockTemplates as any)

      const result = await preferencesManager.exportUserPreferences(mockUserId)

      expect(result.preferences).toEqual(mockPreferences)
      expect(result.templates).toEqual(mockTemplates)
      expect(result.exportMetadata.userId).toBe(mockUserId)
      expect(result.exportMetadata.totalPreferences).toBe(1)
      expect(result.exportMetadata.categories).toContain('notifications')
      expect(result.exportMetadata.gdprCategories).toContain('user_preferences')
    })

    it('should handle export errors', async () => {
      jest.spyOn(preferencesManager, 'getUserPreferences')
        .mockRejectedValue(new Error('Export failed'))

      await expect(preferencesManager.exportUserPreferences(mockUserId))
        .rejects.toThrow('Failed to export user preferences')
    })
  })

  describe('deleteUserPreferences', () => {
    it('should delete all user preferences for GDPR compliance', async () => {
      const mockQuery = mockSupabase.from('user_preferences')
      mockQuery.mockResolvedValue({
        error: null,
        count: 5
      })

      const gdprQuery = mockSupabase.from('gdpr_compliance_logs')
      gdprQuery.insert.mockResolvedValue({
        error: null
      })

      const result = await preferencesManager.deleteUserPreferences(mockUserId)

      expect(result.success).toBe(true)
      expect(result.deletedCount).toBe(5)
      expect(mockQuery.delete).toHaveBeenCalled()
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', mockUserId)
    })

    it('should delete specific categories when provided', async () => {
      const categories = ['notifications', 'ui']
      const mockQuery = mockSupabase.from('user_preferences')
      mockQuery.mockResolvedValue({
        error: null,
        count: 3
      })

      const result = await preferencesManager.deleteUserPreferences(
        mockUserId,
        categories
      )

      expect(result.success).toBe(true)
      expect(result.deletedCount).toBe(3)
      expect(mockQuery.in).toHaveBeenCalledWith('category', categories)
    })

    it('should handle deletion errors', async () => {
      const mockQuery = mockSupabase.from('user_preferences')
      mockQuery.mockResolvedValue({
        error: { message: 'Deletion failed' },
        count: 0
      })

      const result = await preferencesManager.deleteUserPreferences(mockUserId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Deletion failed')
    })
  })

  describe('Data type validation', () => {
    let preferencesManagerInstance: any

    beforeEach(() => {
      preferencesManagerInstance = preferencesManager as any
    })

    it('should validate string data type', () => {
      const result = preferencesManagerInstance.validateDataType('test', 'string')
      expect(result.isValid).toBe(true)
      expect(result.sanitizedValue).toBe('test')
    })

    it('should validate and convert number data type', () => {
      const result = preferencesManagerInstance.validateDataType('42', 'number')
      expect(result.isValid).toBe(true)
      expect(result.sanitizedValue).toBe(42)
    })

    it('should validate boolean data type', () => {
      const result = preferencesManagerInstance.validateDataType(true, 'boolean')
      expect(result.isValid).toBe(true)
      expect(result.sanitizedValue).toBe(true)
    })

    it('should validate JSON data type', () => {
      const testObj = { key: 'value' }
      const result = preferencesManagerInstance.validateDataType(testObj, 'json')
      expect(result.isValid).toBe(true)
      expect(result.sanitizedValue).toEqual(testObj)
    })

    it('should validate array data type', () => {
      const testArray = ['item1', 'item2']
      const result = preferencesManagerInstance.validateDataType(testArray, 'array')
      expect(result.isValid).toBe(true)
      expect(result.sanitizedValue).toEqual(testArray)
    })

    it('should reject invalid number', () => {
      const result = preferencesManagerInstance.validateDataType('not-a-number', 'number')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Value must be a valid number')
    })

    it('should reject invalid JSON string', () => {
      const result = preferencesManagerInstance.validateDataType('invalid-json', 'json')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Value must be valid JSON')
    })
  })

  describe('Preference inheritance', () => {
    it('should handle inherited preferences correctly', async () => {
      const inheritedPreferences = [
        {
          category: 'notifications',
          subcategory: 'email',
          preference_key: 'enabled',
          preference_value: true,
          is_inherited: true,
          source: 'default'
        }
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: inheritedPreferences,
        error: null
      })

      const result = await preferencesManager.getUserPreferences(mockUserId)

      expect(result).toHaveLength(1)
      expect(result[0].is_inherited).toBe(true)
    })
  })
})

describe('PreferencesManager Integration Tests', () => {
  // These would be integration tests that actually connect to a test database
  // For brevity, I'm including a few example structures

  describe('Real database operations', () => {
    it.skip('should perform full preference lifecycle', async () => {
      // This would test create -> read -> update -> delete with real database
      // Skipped in unit tests, would run in integration test suite
    })

    it.skip('should handle concurrent preference updates', async () => {
      // Test for race conditions and data consistency
    })

    it.skip('should enforce foreign key constraints', async () => {
      // Test database constraints and referential integrity
    })
  })
})