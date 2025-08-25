/**
 * Business API Tests
 * The Lawless Directory - Data Access Layer Testing
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals'
import { businessServerApi, businessClientApi, BusinessAPIError } from '../../../lib/api/businesses'

// Mock Supabase
jest.mock('../../../lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          is: jest.fn(() => ({
            order: jest.fn(() => ({
              range: jest.fn(() => Promise.resolve({ data: [], error: null, count: 0 }))
            }))
          }))
        }))
      }))
    })),
    rpc: jest.fn(() => Promise.resolve({ data: [], error: null }))
  }
}))

jest.mock('../../../lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          is: jest.fn(() => ({
            order: jest.fn(() => ({
              range: jest.fn(() => Promise.resolve({ data: [], error: null, count: 0 }))
            }))
          }))
        }))
      }))
    })),
    rpc: jest.fn(() => Promise.resolve({ data: [], error: null }))
  })),
  createServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          is: jest.fn(() => ({
            order: jest.fn(() => ({
              range: jest.fn(() => Promise.resolve({ data: [], error: null, count: 0 }))
            }))
          }))
        }))
      }))
    })),
    rpc: jest.fn(() => Promise.resolve({ data: [], error: null }))
  }))
}))

describe('Business API - Server-side Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getBusinesses', () => {
    it('should return empty list when no businesses found', async () => {
      const result = await businessServerApi.getBusinesses()
      
      expect(result).toEqual({
        businesses: [],
        total: 0,
        hasMore: false,
        page: 1,
        limit: 20
      })
    })

    it('should handle search parameters correctly', async () => {
      const searchParams = {
        query: 'restaurant',
        category: 'food',
        limit: 10,
        offset: 0,
        sortBy: 'name' as const,
        sortOrder: 'asc' as const
      }

      const result = await businessServerApi.getBusinesses(searchParams)
      
      expect(result.limit).toBe(10)
      expect(result.page).toBe(1)
    })

    it('should handle location-based search', async () => {
      const searchParams = {
        location: { lat: 37.7749, lng: -122.4194 },
        radius: 5000,
        limit: 10
      }

      const result = await businessServerApi.getBusinesses(searchParams)
      
      expect(result).toBeDefined()
      expect(result.businesses).toEqual([])
    })

    it('should apply filters correctly', async () => {
      const searchParams = {
        filters: {
          rating: 4,
          verifiedOnly: true,
          premiumOnly: true
        }
      }

      const result = await businessServerApi.getBusinesses(searchParams)
      
      expect(result).toBeDefined()
    })
  })

  describe('getBusinessBySlug', () => {
    it('should throw error for non-existent business', async () => {
      const { createClient } = require('../../../lib/supabase/server')
      const mockClient = createClient()
      
      // Mock the RPC call to return empty result
      mockClient.rpc.mockResolvedValueOnce({ data: [], error: null })

      await expect(businessServerApi.getBusinessBySlug('non-existent')).rejects.toThrow(BusinessAPIError)
    })

    it('should return business details for valid slug', async () => {
      const { createClient } = require('../../../lib/supabase/server')
      const mockClient = createClient()
      
      const mockBusinessData = [{
        business: {
          id: '1',
          slug: 'test-business',
          name: 'Test Business',
          city: 'San Francisco',
          state: 'CA'
        },
        reviews: [],
        stats: { count: 0, averageRating: 0 }
      }]
      
      mockClient.rpc.mockResolvedValueOnce({ data: mockBusinessData, error: null })

      const result = await businessServerApi.getBusinessBySlug('test-business')
      
      expect(result.id).toBe('1')
      expect(result.name).toBe('Test Business')
    })
  })

  describe('getFeaturedBusinesses', () => {
    it('should return featured businesses with proper limit', async () => {
      const result = await businessServerApi.getFeaturedBusinesses(5)
      
      expect(result).toEqual([])
    })
  })

  describe('getBusinessCategories', () => {
    it('should return active categories', async () => {
      const result = await businessServerApi.getBusinessCategories()
      
      expect(result).toEqual([])
    })
  })
})

describe('Business API - Client-side Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('searchBusinesses', () => {
    it('should return empty array for queries less than 2 characters', async () => {
      const result = await businessClientApi.searchBusinesses('a')
      
      expect(result).toEqual([])
    })

    it('should perform search for valid queries', async () => {
      const { supabase } = require('../../../lib/supabase/client')
      supabase.rpc.mockResolvedValueOnce({ data: [], error: null })

      const result = await businessClientApi.searchBusinesses('restaurant')
      
      expect(result).toEqual([])
      expect(supabase.rpc).toHaveBeenCalledWith('search_businesses', expect.any(Object))
    })
  })

  describe('filterBusinesses', () => {
    it('should apply filters correctly', async () => {
      const filters = {
        categoryId: 'food',
        filters: { rating: 4, verifiedOnly: true }
      }

      const result = await businessClientApi.filterBusinesses(filters)
      
      expect(result.businesses).toEqual([])
      expect(result.total).toBe(0)
    })
  })

  describe('getNearbyBusinesses', () => {
    it('should find nearby businesses', async () => {
      const { supabase } = require('../../../lib/supabase/client')
      supabase.rpc.mockResolvedValueOnce({ data: [], error: null })

      const result = await businessClientApi.getNearbyBusinesses(37.7749, -122.4194, 5000)
      
      expect(result).toEqual([])
      expect(supabase.rpc).toHaveBeenCalledWith('find_nearby_businesses', expect.any(Object))
    })
  })

  describe('getBusinessReviews', () => {
    it('should fetch business reviews', async () => {
      const { supabase } = require('../../../lib/supabase/client')
      const mockChain = {
        eq: jest.fn(() => mockChain),
        is: jest.fn(() => mockChain),
        order: jest.fn(() => mockChain),
        range: jest.fn(() => Promise.resolve({ data: [], error: null }))
      }
      
      supabase.from.mockReturnValue({
        select: jest.fn(() => mockChain)
      })

      const result = await businessClientApi.getBusinessReviews('business-id', 10, 0)
      
      expect(result).toEqual([])
    })
  })
})

describe('Error Handling', () => {
  it('should handle database connection errors', async () => {
    const { createClient } = require('../../../lib/supabase/server')
    const mockClient = createClient()
    
    mockClient.rpc.mockResolvedValueOnce({ 
      data: null, 
      error: { message: 'connection failed', code: 'CONNECTION_ERROR' }
    })

    await expect(businessServerApi.getBusinessBySlug('test')).rejects.toThrow(BusinessAPIError)
  })

  it('should handle not found errors correctly', async () => {
    const { createClient } = require('../../../lib/supabase/server')
    const mockClient = createClient()
    
    mockClient.rpc.mockResolvedValueOnce({ 
      data: null, 
      error: { message: 'not found', code: 'PGRST116' }
    })

    await expect(businessServerApi.getBusinessBySlug('not-found')).rejects.toThrow('Resource not found')
  })
})

describe('Performance Tests', () => {
  it('should complete basic query within reasonable time', async () => {
    const startTime = Date.now()
    await businessServerApi.getBusinesses({ limit: 1 })
    const duration = Date.now() - startTime
    
    // Should complete within 1 second for mocked data
    expect(duration).toBeLessThan(1000)
  })

  it('should handle retry logic correctly', async () => {
    const { createClient } = require('../../../lib/supabase/server')
    const mockClient = createClient()
    
    // First call fails, second succeeds
    mockClient.rpc
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ data: [], error: null })

    const result = await businessClientApi.searchBusinesses('test')
    
    expect(result).toEqual([])
    expect(mockClient.rpc).toHaveBeenCalledTimes(2)
  })
})

describe('Integration Tests', () => {
  it('should properly serialize and deserialize business data', async () => {
    const mockBusiness = {
      id: '1',
      slug: 'test-business',
      name: 'Test Business',
      city: 'San Francisco',
      state: 'CA',
      location: null,
      quality_score: 4.5,
      subscription_tier: 'premium',
      verification_status: 'verified'
    }

    const { createClient } = require('../../../lib/supabase/server')
    const mockClient = createClient()
    
    mockClient.rpc.mockResolvedValueOnce({ 
      data: [{ business: mockBusiness, reviews: [], stats: null }], 
      error: null 
    })

    const result = await businessServerApi.getBusinessBySlug('test-business')
    
    expect(result.name).toBe('Test Business')
    expect(result.quality_score).toBe(4.5)
    expect(result.subscription_tier).toBe('premium')
  })
})

// Helper functions for testing
export const testHelpers = {
  createMockBusiness: (overrides = {}) => ({
    id: '1',
    slug: 'mock-business',
    name: 'Mock Business',
    short_description: 'A mock business for testing',
    city: 'Test City',
    state: 'TS',
    quality_score: 4.0,
    subscription_tier: 'free',
    verification_status: 'pending',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  }),

  createMockCategory: (overrides = {}) => ({
    id: '1',
    slug: 'mock-category',
    name: 'Mock Category',
    active: true,
    sort_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  }),

  createMockSearchParams: (overrides = {}) => ({
    limit: 20,
    offset: 0,
    sortBy: 'name' as const,
    sortOrder: 'asc' as const,
    ...overrides
  })
}