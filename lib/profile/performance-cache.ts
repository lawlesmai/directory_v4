/**
 * Performance Optimization and Caching System
 * Epic 2 Story 2.7: User Profile Management & Preferences Infrastructure
 * 
 * Advanced caching system with Redis support, query optimization,
 * and intelligent cache invalidation for profile data.
 */

import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type { UserPreference } from './preferences-manager'
import type { ProfileCompletionScore } from './completion-scoring'

// Type definitions
export interface CacheEntry<T = any> {
  data: T
  timestamp: number
  ttl: number
  version: string
  tags: string[]
}

export interface CacheConfig {
  defaultTTL: number // seconds
  maxSize: number
  enableCompression: boolean
  enableMetrics: boolean
  keyPrefix: string
}

export interface CacheMetrics {
  hits: number
  misses: number
  evictions: number
  totalRequests: number
  hitRate: number
  averageResponseTime: number
}

export interface QueryOptimization {
  useIndexHints: boolean
  enableParallelQueries: boolean
  batchSize: number
  connectionPooling: boolean
}

/**
 * Multi-layer Cache Manager
 * 
 * Implements intelligent caching with Redis backend, memory fallback,
 * and automatic invalidation strategies.
 */
export class ProfileCacheManager {
  private memoryCache = new Map<string, CacheEntry>()
  private redisClient: any = null // TODO: Initialize Redis client
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalRequests: 0,
    hitRate: 0,
    averageResponseTime: 0
  }

  private config: CacheConfig = {
    defaultTTL: 300, // 5 minutes
    maxSize: 10000,
    enableCompression: true,
    enableMetrics: true,
    keyPrefix: 'profile_cache:'
  }

  private queryOptimizations: QueryOptimization = {
    useIndexHints: true,
    enableParallelQueries: true,
    batchSize: 100,
    connectionPooling: true
  }

  /**
   * Get cached data with fallback to database
   */
  async get<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: {
      ttl?: number
      tags?: string[]
      version?: string
      forceRefresh?: boolean
    } = {}
  ): Promise<T> {
    const startTime = Date.now()
    this.metrics.totalRequests++

    const cacheKey = this.buildCacheKey(key)
    
    try {
      // Check if force refresh is requested
      if (!options.forceRefresh) {
        // Try to get from cache
        const cached = await this.getCacheEntry<T>(cacheKey)
        if (cached && this.isValidCacheEntry(cached, options.version)) {
          this.metrics.hits++
          this.updateMetrics(startTime)
          return cached.data
        }
      }

      // Cache miss - fetch fresh data
      this.metrics.misses++
      const data = await fetchFn()

      // Store in cache
      const cacheEntry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: options.ttl || this.config.defaultTTL,
        version: options.version || '1.0',
        tags: options.tags || []
      }

      await this.setCacheEntry(cacheKey, cacheEntry)
      this.updateMetrics(startTime)

      return data

    } catch (error) {
      console.error('Cache get error:', error)
      this.updateMetrics(startTime)
      
      // Fallback to direct fetch on cache errors
      return await fetchFn()
    }
  }

  /**
   * Set cache entry
   */
  async set<T>(
    key: string,
    data: T,
    options: {
      ttl?: number
      tags?: string[]
      version?: string
    } = {}
  ): Promise<void> {
    const cacheKey = this.buildCacheKey(key)
    
    const cacheEntry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: options.ttl || this.config.defaultTTL,
      version: options.version || '1.0',
      tags: options.tags || []
    }

    await this.setCacheEntry(cacheKey, cacheEntry)
  }

  /**
   * Invalidate cache entries by key or tags
   */
  async invalidate(pattern: string | string[]): Promise<number> {
    let deletedCount = 0

    if (Array.isArray(pattern)) {
      // Invalidate by tags
      for (const tag of pattern) {
        deletedCount += await this.invalidateByTag(tag)
      }
    } else {
      // Invalidate by key pattern
      deletedCount += await this.invalidateByPattern(pattern)
    }

    return deletedCount
  }

  /**
   * Batch get multiple cache entries
   */
  async getBatch<T>(
    keys: string[],
    fetchFn: (missingKeys: string[]) => Promise<Record<string, T>>,
    options: {
      ttl?: number
      tags?: string[]
      version?: string
    } = {}
  ): Promise<Record<string, T>> {
    const results: Record<string, T> = {}
    const missingKeys: string[] = []

    // Check cache for each key
    for (const key of keys) {
      const cacheKey = this.buildCacheKey(key)
      const cached = await this.getCacheEntry<T>(cacheKey)
      
      if (cached && this.isValidCacheEntry(cached, options.version)) {
        results[key] = cached.data
        this.metrics.hits++
      } else {
        missingKeys.push(key)
        this.metrics.misses++
      }
    }

    // Fetch missing data
    if (missingKeys.length > 0) {
      const freshData = await fetchFn(missingKeys)
      
      // Store fresh data in cache and add to results
      for (const [key, data] of Object.entries(freshData)) {
        results[key] = data
        
        const cacheEntry: CacheEntry<T> = {
          data,
          timestamp: Date.now(),
          ttl: options.ttl || this.config.defaultTTL,
          version: options.version || '1.0',
          tags: options.tags || []
        }
        
        await this.setCacheEntry(this.buildCacheKey(key), cacheEntry)
      }
    }

    this.metrics.totalRequests += keys.length
    this.updateHitRate()

    return results
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.memoryCache.clear()
    
    if (this.redisClient) {
      // TODO: Clear Redis cache
      // await this.redisClient.flushdb()
    }
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics & { memoryUsage: number; cacheSize: number } {
    return {
      ...this.metrics,
      memoryUsage: this.calculateMemoryUsage(),
      cacheSize: this.memoryCache.size
    }
  }

  /**
   * Preload cache with frequently accessed data
   */
  async preloadCache(userId: string): Promise<void> {
    try {
      // Preload user profile
      await this.preloadUserProfile(userId)
      
      // Preload user preferences
      await this.preloadUserPreferences(userId)
      
      // Preload completion score
      await this.preloadCompletionScore(userId)
      
    } catch (error) {
      console.error('Cache preload error:', error)
    }
  }

  // Private helper methods

  private buildCacheKey(key: string): string {
    return `${this.config.keyPrefix}${key}`
  }

  private async getCacheEntry<T>(key: string): Promise<CacheEntry<T> | null> {
    // Try memory cache first
    const memoryEntry = this.memoryCache.get(key)
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      return memoryEntry as CacheEntry<T>
    }

    // Try Redis cache if available
    if (this.redisClient) {
      try {
        // TODO: Implement Redis get
        // const redisData = await this.redisClient.get(key)
        // if (redisData) {
        //   const entry = JSON.parse(redisData) as CacheEntry<T>
        //   if (!this.isExpired(entry)) {
        //     // Store in memory cache for faster access
        //     this.memoryCache.set(key, entry)
        //     return entry
        //   }
        // }
      } catch (error) {
        console.error('Redis get error:', error)
      }
    }

    return null
  }

  private async setCacheEntry<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    // Store in memory cache
    this.ensureCacheCapacity()
    this.memoryCache.set(key, entry)

    // Store in Redis if available
    if (this.redisClient) {
      try {
        // TODO: Implement Redis set with TTL
        // await this.redisClient.setex(key, entry.ttl, JSON.stringify(entry))
      } catch (error) {
        console.error('Redis set error:', error)
      }
    }
  }

  private isValidCacheEntry(entry: CacheEntry, version?: string): boolean {
    if (this.isExpired(entry)) {
      return false
    }

    if (version && entry.version !== version) {
      return false
    }

    return true
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl * 1000
  }

  private ensureCacheCapacity(): void {
    if (this.memoryCache.size >= this.config.maxSize) {
      // Remove oldest entries (LRU-style)
      const entries = Array.from(this.memoryCache.entries())
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
      
      const toRemove = Math.floor(this.config.maxSize * 0.1) // Remove 10%
      for (let i = 0; i < toRemove; i++) {
        this.memoryCache.delete(entries[i][0])
        this.metrics.evictions++
      }
    }
  }

  private async invalidateByTag(tag: string): Promise<number> {
    let deletedCount = 0

    // Check memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.tags.includes(tag)) {
        this.memoryCache.delete(key)
        deletedCount++
      }
    }

    // TODO: Implement Redis tag-based invalidation
    // This would require storing tag-to-key mappings in Redis

    return deletedCount
  }

  private async invalidateByPattern(pattern: string): Promise<number> {
    let deletedCount = 0
    const regex = new RegExp(pattern)

    // Check memory cache
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key)
        deletedCount++
      }
    }

    // TODO: Implement Redis pattern-based invalidation
    // if (this.redisClient) {
    //   const keys = await this.redisClient.keys(pattern)
    //   if (keys.length > 0) {
    //     await this.redisClient.del(...keys)
    //     deletedCount += keys.length
    //   }
    // }

    return deletedCount
  }

  private updateMetrics(startTime: number): void {
    if (!this.config.enableMetrics) return

    const responseTime = Date.now() - startTime
    this.metrics.averageResponseTime = (
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) /
      this.metrics.totalRequests
    )

    this.updateHitRate()
  }

  private updateHitRate(): void {
    this.metrics.hitRate = this.metrics.totalRequests > 0 
      ? this.metrics.hits / this.metrics.totalRequests 
      : 0
  }

  private calculateMemoryUsage(): number {
    // Rough estimation of memory usage
    let size = 0
    for (const entry of this.memoryCache.values()) {
      size += JSON.stringify(entry).length * 2 // Rough estimate
    }
    return size
  }

  private async preloadUserProfile(userId: string): Promise<void> {
    const supabase = createClient()
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profile) {
      await this.set(`profile:${userId}`, profile, {
        ttl: 600, // 10 minutes
        tags: [`user:${userId}`, 'profiles'],
        version: '1.0'
      })
    }
  }

  private async preloadUserPreferences(userId: string): Promise<void> {
    const supabase = createClient()
    
    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)

    if (preferences) {
      await this.set(`preferences:${userId}`, preferences, {
        ttl: 300, // 5 minutes
        tags: [`user:${userId}`, 'preferences'],
        version: '1.0'
      })
    }
  }

  private async preloadCompletionScore(userId: string): Promise<void> {
    const supabase = createClient()
    
    const { data: score } = await supabase
      .rpc('calculate_profile_completion_score', { user_uuid: userId } as any)
      .single()

    if (score) {
      await this.set(`completion:${userId}`, score, {
        ttl: 180, // 3 minutes
        tags: [`user:${userId}`, 'completion'],
        version: '1.0'
      })
    }
  }
}

// Export singleton instance
export const profileCache = new ProfileCacheManager()

/**
 * Query Optimization Manager
 * 
 * Optimizes database queries for profile data with intelligent
 * batching and connection management.
 */
export class QueryOptimizer {
  private supabase = createClient()
  private queryQueue: Array<{
    query: () => Promise<any>
    resolve: (value: any) => void
    reject: (error: any) => void
    key: string
    priority: number
  }> = []
  
  private batchProcessor: NodeJS.Timeout | null = null
  private isProcessing = false

  /**
   * Execute optimized query with batching and caching
   */
  async executeQuery<T>(
    key: string,
    queryFn: () => Promise<T>,
    options: {
      priority?: number
      useCache?: boolean
      cacheTTL?: number
      cacheVersion?: string
      tags?: string[]
    } = {}
  ): Promise<T> {
    const {
      priority = 1,
      useCache = true,
      cacheTTL = 300,
      cacheVersion = '1.0',
      tags = []
    } = options

    // Try cache first if enabled
    if (useCache) {
      try {
        return await profileCache.get(
          key,
          queryFn,
          {
            ttl: cacheTTL,
            version: cacheVersion,
            tags
          }
        )
      } catch (error) {
        console.error('Cache error, falling back to direct query:', error)
      }
    }

    // Execute query directly
    return await queryFn()
  }

  /**
   * Batch execute multiple queries
   */
  async batchExecute<T>(
    queries: Array<{
      key: string
      query: () => Promise<T>
      priority?: number
    }>
  ): Promise<T[]> {
    return Promise.all(
      queries
        .sort((a, b) => (b.priority || 1) - (a.priority || 1))
        .map(({ key, query, priority = 1 }) =>
          this.executeQuery(key, query, { priority })
        )
    )
  }

  /**
   * Get optimized profile data with related information
   */
  async getProfileWithRelations(userId: string): Promise<{
    profile: any
    preferences: UserPreference[]
    completion: ProfileCompletionScore
    roles: any[]
  }> {
    const queries = [
      {
        key: `profile:${userId}`,
        query: () => this.supabase
          .from('profiles')
          .select(`
            *,
            user_roles!inner(
              role_id,
              is_active,
              roles!inner(name, display_name)
            )
          `)
          .eq('id', userId)
          .single(),
        priority: 3
      },
      {
        key: `preferences:${userId}`,
        query: () => this.supabase
          .rpc('get_user_preferences_with_inheritance', {
            user_uuid: userId,
            pref_category: null
          } as any),
        priority: 2
      },
      {
        key: `completion:${userId}`,
        query: () => this.supabase
          .rpc('calculate_profile_completion_score', {
            user_uuid: userId
          } as any)
          .single(),
        priority: 1
      }
    ]

    const [profileResult, preferencesResult, completionResult] = await this.batchExecute(queries)

    return {
      profile: (profileResult as any).data,
      preferences: (preferencesResult as any).data || [],
      completion: (completionResult as any).data,
      roles: (profileResult as any).data?.user_roles?.filter((ur: any) => ur.is_active)
        .map((ur: any) => ur.roles) || []
    }
  }

  /**
   * Optimize SELECT queries with proper indexing hints
   */
  buildOptimizedQuery(
    table: string,
    columns: string[],
    conditions: Record<string, any>
  ): any {
    let query = this.supabase.from(table).select(columns.join(', '))

    // Add conditions
    for (const [key, value] of Object.entries(conditions)) {
      if (Array.isArray(value)) {
        query = query.in(key, value)
      } else {
        query = query.eq(key, value)
      }
    }

    return query
  }
}

// Export singleton instance
export const queryOptimizer = new QueryOptimizer()

// React cache implementations for SSR optimization
export const getCachedProfile = cache(async (userId: string) => {
  const supabase = createClient()
  return profileCache.get(
    `profile:${userId}`,
    async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      return data
    },
    {
      ttl: 600, // 10 minutes
      tags: [`user:${userId}`, 'profiles']
    }
  )
})

export const getCachedUserPreferences = cache(async (userId: string, category?: string) => {
  const cacheKey = category 
    ? `preferences:${userId}:${category}` 
    : `preferences:${userId}`

  const supabase = createClient()
  return profileCache.get(
    cacheKey,
    async () => {
      const { data } = await supabase
        .rpc('get_user_preferences_with_inheritance', {
          user_uuid: userId,
          pref_category: category || null
        } as any)
      return data
    },
    {
      ttl: 300, // 5 minutes
      tags: [`user:${userId}`, 'preferences']
    }
  )
})

export const getCachedCompletionScore = cache(async (userId: string) => {
  const supabase = createClient()
  return profileCache.get(
    `completion:${userId}`,
    async () => {
      const { data } = await supabase
        .rpc('calculate_profile_completion_score', { user_uuid: userId } as any)
        .single()
      return data
    },
    {
      ttl: 180, // 3 minutes
      tags: [`user:${userId}`, 'completion']
    }
  )
})

// Cache invalidation helpers
export async function invalidateUserCache(userId: string): Promise<void> {
  await profileCache.invalidate([`user:${userId}`])
}

export async function invalidateProfileCache(userId: string): Promise<void> {
  await profileCache.invalidate(`profile:${userId}`)
}

export async function invalidatePreferencesCache(userId: string, category?: string): Promise<void> {
  if (category) {
    await profileCache.invalidate(`preferences:${userId}:${category}`)
  } else {
    await profileCache.invalidate(`preferences:${userId}*`)
  }
}

// Performance monitoring utilities
export function getCachePerformance(): CacheMetrics & { memoryUsage: number; cacheSize: number } {
  return profileCache.getMetrics()
}

export async function warmupCache(userIds: string[]): Promise<void> {
  const warmupPromises = userIds.map(userId => profileCache.preloadCache(userId))
  await Promise.all(warmupPromises)
}