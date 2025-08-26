/**
 * Real-time Preference Update System
 * Epic 2 Story 2.7: User Profile Management & Preferences Infrastructure
 * 
 * Real-time synchronization system for user preferences using Supabase
 * real-time subscriptions with conflict resolution and offline support.
 */

import { createClient } from '@/lib/supabase/client'
import { preferencesManager } from './preferences-manager'
import type { UserPreference } from './preferences-manager'

// Type definitions
export interface PreferenceUpdateEvent {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  old?: UserPreference
  new?: UserPreference
  timestamp: string
  userId: string
  source: 'local' | 'remote'
}

export interface PreferenceConflict {
  preferenceKey: string
  category: string
  subcategory?: string
  localValue: any
  remoteValue: any
  localTimestamp: string
  remoteTimestamp: string
  conflictId: string
}

export interface RealtimePreferencesConfig {
  userId: string
  categories?: string[]
  enableConflictResolution: boolean
  conflictStrategy: 'local_wins' | 'remote_wins' | 'timestamp_wins' | 'manual'
  offlineSupport: boolean
  syncInterval: number // milliseconds
  maxRetries: number
}

export interface PreferenceSubscriptionOptions {
  categories?: string[]
  includeInherited?: boolean
  onUpdate?: (event: PreferenceUpdateEvent) => void
  onConflict?: (conflict: PreferenceConflict) => void
  onError?: (error: Error) => void
  onSync?: (syncedCount: number) => void
}

export type PreferenceSubscription = {
  unsubscribe: () => void
  isActive: () => boolean
  getStatus: () => 'connected' | 'disconnected' | 'error' | 'syncing'
  forceSync: () => Promise<void>
}

/**
 * Real-time Preferences Manager
 * 
 * Handles real-time synchronization of user preferences across multiple
 * clients/sessions with conflict resolution and offline support.
 */
export class RealtimePreferencesManager {
  private supabase = createClient()
  private subscriptions = new Map<string, any>()
  private conflicts = new Map<string, PreferenceConflict>()
  private pendingUpdates = new Map<string, any>()
  private isOnline = true
  private syncQueue: Array<{ action: string; data: any; timestamp: string }> = []

  /**
   * Subscribe to real-time preference updates
   */
  subscribeToPreferences(
    userId: string,
    options: PreferenceSubscriptionOptions = {}
  ): PreferenceSubscription {
    const subscriptionId = `pref_${userId}_${Date.now()}`
    
    let isActive = true
    let status: 'connected' | 'disconnected' | 'error' | 'syncing' = 'connected'

    // Build subscription query
    let query = this.supabase
      .channel(`preferences:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_preferences',
          filter: `user_id=eq.${userId}`
        },
        async (payload) => {
          if (!isActive) return

          try {
            const event: PreferenceUpdateEvent = {
              eventType: payload.eventType as any,
              old: payload.old as UserPreference,
              new: payload.new as UserPreference,
              timestamp: new Date().toISOString(),
              userId,
              source: 'remote'
            }

            // Filter by categories if specified
            if (options.categories && event.new) {
              if (!options.categories.includes(event.new.category)) {
                return
              }
            }

            // Check for conflicts with pending local changes
            await this.handlePotentialConflict(event, options)

            // Notify subscriber
            options.onUpdate?.(event)

          } catch (error) {
            console.error('Realtime preference update error:', error)
            status = 'error'
            options.onError?.(error instanceof Error ? error : new Error('Unknown error'))
          }
        }
      )

    // Subscribe to the channel
    query.subscribe((status_) => {
      switch (status_) {
        case 'SUBSCRIBED':
          status = 'connected'
          break
        case 'CLOSED':
          status = 'disconnected'
          break
        case 'CHANNEL_ERROR':
          status = 'error'
          break
      }
    })

    // Store subscription
    this.subscriptions.set(subscriptionId, {
      channel: query,
      userId,
      options,
      isActive: () => isActive,
      status: () => status
    })

    // Set up offline/online detection
    this.setupOfflineDetection()

    return {
      unsubscribe: () => {
        isActive = false
        const subscription = this.subscriptions.get(subscriptionId)
        if (subscription) {
          subscription.channel.unsubscribe()
          this.subscriptions.delete(subscriptionId)
        }
      },
      isActive: () => isActive,
      getStatus: () => status,
      forceSync: async () => {
        status = 'syncing'
        try {
          await this.syncPendingUpdates(userId)
          options.onSync?.(this.syncQueue.length)
          this.syncQueue = []
          status = 'connected'
        } catch (error) {
          status = 'error'
          throw error
        }
      }
    }
  }

  /**
   * Update preference with real-time synchronization
   */
  async updatePreferenceRealtime(
    userId: string,
    category: string,
    preferenceKey: string,
    value: any,
    options: {
      subcategory?: string
      optimisticUpdate?: boolean
      conflictStrategy?: 'local_wins' | 'remote_wins' | 'timestamp_wins'
    } = {}
  ): Promise<{
    success: boolean
    error?: string
    conflict?: PreferenceConflict
    pendingSync?: boolean
  }> {
    const updateId = `${category}_${preferenceKey}_${options.subcategory || 'default'}`
    const timestamp = new Date().toISOString()

    try {
      // If offline, queue the update
      if (!this.isOnline) {
        this.syncQueue.push({
          action: 'update_preference',
          data: {
            userId,
            category,
            preferenceKey,
            value,
            options,
            timestamp
          },
          timestamp
        })

        // Apply optimistic update if enabled
        if (options.optimisticUpdate) {
          this.pendingUpdates.set(updateId, {
            value,
            timestamp,
            status: 'pending'
          })
        }

        return {
          success: true,
          pendingSync: true
        }
      }

      // Check for existing pending updates (conflict detection)
      const pendingUpdate = this.pendingUpdates.get(updateId)
      if (pendingUpdate && pendingUpdate.timestamp > timestamp) {
        // Newer pending update exists, create conflict
        const conflict: PreferenceConflict = {
          preferenceKey,
          category,
          subcategory: options.subcategory,
          localValue: value,
          remoteValue: pendingUpdate.value,
          localTimestamp: timestamp,
          remoteTimestamp: pendingUpdate.timestamp,
          conflictId: `conflict_${updateId}_${Date.now()}`
        }

        this.conflicts.set(conflict.conflictId, conflict)
        
        return {
          success: false,
          conflict
        }
      }

      // Apply optimistic update
      if (options.optimisticUpdate) {
        this.pendingUpdates.set(updateId, {
          value,
          timestamp,
          status: 'updating'
        })
      }

      // Perform the actual update
      const result = await preferencesManager.updateUserPreference(
        userId,
        category,
        preferenceKey,
        value,
        {
          subcategory: options.subcategory,
          changeReason: 'Real-time update'
        }
      )

      if (result.success) {
        // Clear pending update on success
        this.pendingUpdates.delete(updateId)
        
        return {
          success: true
        }
      } else {
        // Handle failure - keep as pending if optimistic update was applied
        if (options.optimisticUpdate) {
          const pending = this.pendingUpdates.get(updateId)
          if (pending) {
            pending.status = 'failed'
            pending.error = result.error
          }
        }

        return {
          success: false,
          error: result.error
        }
      }

    } catch (error) {
      console.error('Real-time preference update error:', error)
      
      // Mark pending update as failed
      if (options.optimisticUpdate) {
        const pending = this.pendingUpdates.get(updateId)
        if (pending) {
          pending.status = 'failed'
          pending.error = error instanceof Error ? error.message : 'Unknown error'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Update failed'
      }
    }
  }

  /**
   * Resolve preference conflicts
   */
  async resolveConflict(
    conflictId: string,
    resolution: 'use_local' | 'use_remote' | 'custom',
    customValue?: any
  ): Promise<{ success: boolean; error?: string }> {
    const conflict = this.conflicts.get(conflictId)
    if (!conflict) {
      return { success: false, error: 'Conflict not found' }
    }

    try {
      let resolvedValue: any

      switch (resolution) {
        case 'use_local':
          resolvedValue = conflict.localValue
          break
        case 'use_remote':
          resolvedValue = conflict.remoteValue
          break
        case 'custom':
          if (customValue === undefined) {
            return { success: false, error: 'Custom value required' }
          }
          resolvedValue = customValue
          break
      }

      // Apply the resolved value
      const result = await preferencesManager.updateUserPreference(
        conflict.category.split('_')[0], // Extract userId from category if needed
        conflict.category,
        conflict.preferenceKey,
        resolvedValue,
        {
          subcategory: conflict.subcategory,
          changeReason: `Conflict resolution: ${resolution}`
        }
      )

      if (result.success) {
        // Remove conflict
        this.conflicts.delete(conflictId)
        
        // Clear any pending updates for this preference
        const updateId = `${conflict.category}_${conflict.preferenceKey}_${conflict.subcategory || 'default'}`
        this.pendingUpdates.delete(updateId)

        return { success: true }
      } else {
        return { success: false, error: result.error }
      }

    } catch (error) {
      console.error('Conflict resolution error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Resolution failed'
      }
    }
  }

  /**
   * Get all pending conflicts
   */
  getPendingConflicts(): PreferenceConflict[] {
    return Array.from(this.conflicts.values())
  }

  /**
   * Get pending updates (for offline sync)
   */
  getPendingUpdates(): Array<{
    id: string
    value: any
    timestamp: string
    status: 'pending' | 'updating' | 'failed'
    error?: string
  }> {
    return Array.from(this.pendingUpdates.entries()).map(([id, update]) => ({
      id,
      value: update.value,
      timestamp: update.timestamp,
      status: update.status,
      error: update.error
    }))
  }

  /**
   * Clear all pending updates
   */
  clearPendingUpdates(): void {
    this.pendingUpdates.clear()
    this.syncQueue = []
  }

  /**
   * Get subscription status
   */
  getSubscriptionStatus(): {
    activeSubscriptions: number
    isOnline: boolean
    pendingUpdates: number
    pendingConflicts: number
    queuedSyncs: number
  } {
    return {
      activeSubscriptions: this.subscriptions.size,
      isOnline: this.isOnline,
      pendingUpdates: this.pendingUpdates.size,
      pendingConflicts: this.conflicts.size,
      queuedSyncs: this.syncQueue.length
    }
  }

  // Private helper methods

  private async handlePotentialConflict(
    event: PreferenceUpdateEvent,
    options: PreferenceSubscriptionOptions
  ): Promise<void> {
    if (!event.new || event.source === 'local') return

    const updateId = `${event.new.category}_${event.new.preference_key}_${event.new.subcategory || 'default'}`
    const pendingUpdate = this.pendingUpdates.get(updateId)

    if (pendingUpdate) {
      // Potential conflict detected
      const conflict: PreferenceConflict = {
        preferenceKey: event.new.preference_key,
        category: event.new.category,
        subcategory: event.new.subcategory,
        localValue: pendingUpdate.value,
        remoteValue: event.new.preference_value,
        localTimestamp: pendingUpdate.timestamp,
        remoteTimestamp: event.new.updated_at,
        conflictId: `conflict_${updateId}_${Date.now()}`
      }

      this.conflicts.set(conflict.conflictId, conflict)
      options.onConflict?.(conflict)
    }
  }

  private setupOfflineDetection(): void {
    if (typeof window !== 'undefined') {
      const updateOnlineStatus = () => {
        const wasOffline = !this.isOnline
        this.isOnline = navigator.onLine

        // If coming back online, sync pending updates
        if (wasOffline && this.isOnline && this.syncQueue.length > 0) {
          this.syncAllPendingUpdates()
        }
      }

      window.addEventListener('online', updateOnlineStatus)
      window.addEventListener('offline', updateOnlineStatus)
      
      // Initial status
      this.isOnline = navigator.onLine
    }
  }

  private async syncPendingUpdates(userId: string): Promise<void> {
    const userSyncs = this.syncQueue.filter(sync => 
      sync.data.userId === userId
    )

    for (const sync of userSyncs) {
      try {
        if (sync.action === 'update_preference') {
          const { data } = sync
          await preferencesManager.updateUserPreference(
            data.userId,
            data.category,
            data.preferenceKey,
            data.value,
            {
              subcategory: data.options.subcategory,
              changeReason: 'Offline sync'
            }
          )
        }
      } catch (error) {
        console.error('Sync error for update:', sync, error)
        // Keep failed syncs in queue for retry
        continue
      }

      // Remove successfully synced updates
      const index = this.syncQueue.indexOf(sync)
      if (index > -1) {
        this.syncQueue.splice(index, 1)
      }
    }
  }

  private async syncAllPendingUpdates(): Promise<void> {
    const userIds = [...new Set(this.syncQueue.map(sync => sync.data.userId))]
    
    for (const userId of userIds) {
      try {
        await this.syncPendingUpdates(userId)
      } catch (error) {
        console.error('Sync error for user:', userId, error)
      }
    }
  }
}

// Export singleton instance
export const realtimePreferencesManager = new RealtimePreferencesManager()

// Utility functions for common real-time operations
export function subscribeToUserPreferences(
  userId: string,
  onUpdate: (event: PreferenceUpdateEvent) => void,
  options: Omit<PreferenceSubscriptionOptions, 'onUpdate'> = {}
): PreferenceSubscription {
  return realtimePreferencesManager.subscribeToPreferences(userId, {
    ...options,
    onUpdate
  })
}

export function updatePreferenceOptimistic(
  userId: string,
  category: string,
  preferenceKey: string,
  value: any,
  subcategory?: string
) {
  return realtimePreferencesManager.updatePreferenceRealtime(
    userId,
    category,
    preferenceKey,
    value,
    {
      subcategory,
      optimisticUpdate: true,
      conflictStrategy: 'timestamp_wins'
    }
  )
}

// React hooks for preference subscriptions (if using React)
// React hooks for preference subscriptions (if using React)
export function useRealtimePreferences(
  userId: string,
  categories?: string[]
) {
  const [preferences, setPreferences] = useState<UserPreference[]>([])
  const [conflicts, setConflicts] = useState<PreferenceConflict[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !userId) return

    const subscription = subscribeToUserPreferences(
      userId,
      (event) => {
        // Update preferences based on event
        setPreferences(prev => {
          switch (event.eventType) {
            case 'INSERT':
              return event.new ? [...prev, event.new] : prev
            case 'UPDATE':
              return event.new 
                ? prev.map(p => p.id === event.new!.id ? event.new! : p)
                : prev
            case 'DELETE':
              return event.old ? prev.filter(p => p.id !== event.old!.id) : prev
            default:
              return prev
          }
        })
      },
      {
        categories,
        onConflict: (conflict) => {
          setConflicts(prev => [...prev, conflict])
        },
        onError: (err) => {
          setError(err)
        }
      }
    )

    // Load initial preferences
    preferencesManager.getUserPreferences(userId, categories?.[0])
      .then(prefs => {
        setPreferences(prefs)
        setIsLoading(false)
      })
      .catch(err => {
        setError(err)
        setIsLoading(false)
      })

    return () => {
      subscription.unsubscribe()
    }
  }, [userId, categories])

  if (typeof window === 'undefined') return null

  return {
    preferences,
    conflicts,
    isLoading,
    error,
    resolveConflict: (conflictId: string, resolution: 'use_local' | 'use_remote', customValue?: any) =>
      realtimePreferencesManager.resolveConflict(conflictId, resolution, customValue),
    updatePreference: (category: string, key: string, value: any, subcategory?: string) =>
      updatePreferenceOptimistic(userId, category, key, value, subcategory)
  }
}

// Conditional React hooks support
try {
  const React = require('react')
  useState = React.useState
  useEffect = React.useEffect
} catch {
  // React not available, hooks will be undefined
}