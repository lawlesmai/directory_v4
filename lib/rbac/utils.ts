/**
 * RBAC Utility Functions
 * Epic 2 Story 2.8: Utility functions for permission checking and role management
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { PermissionContext, PermissionResult } from './middleware'

export interface UserPermission {
  resourceName: string
  actionName: string
  permissionName: string
  grantType: 'allow' | 'deny' | 'conditional'
  scopeType: string
  scopeConstraints: Record<string, any>
  isInherited: boolean
  sourceRole: string
}

export interface Role {
  id: string
  name: string
  displayName: string
  description: string
  hierarchyLevel: number
  isSystemRole: boolean
  isAssignable: boolean
  requiresMfa: boolean
}

/**
 * Client-side permission checker
 */
export class ClientRBACChecker {
  private supabase = createClientComponentClient()
  private permissionCache = new Map<string, { result: boolean; expires: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Check if current user has permission
   */
  async hasPermission(
    resource: string,
    action: string,
    context: PermissionContext = {}
  ): Promise<boolean> {
    const cacheKey = this.buildCacheKey(resource, action, context)
    
    // Check cache first
    const cached = this.permissionCache.get(cacheKey)
    if (cached && cached.expires > Date.now()) {
      return cached.result
    }

    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) return false

      const response = await fetch('/api/rbac/permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          permissions: [`${resource}:${action}`],
          context
        })
      })

      if (!response.ok) return false

      const result = await response.json()
      const allowed = result.data?.results?.[0]?.allowed || false

      // Cache the result
      this.permissionCache.set(cacheKey, {
        result: allowed,
        expires: Date.now() + this.CACHE_TTL
      })

      return allowed
    } catch (error) {
      console.error('Permission check failed:', error)
      return false
    }
  }

  /**
   * Invalidate permission cache
   */
  invalidateCache(resource?: string, action?: string): void {
    if (resource && action) {
      const keys = Array.from(this.permissionCache.keys())
      keys.forEach(key => {
        if (key.includes(`${resource}:${action}`)) {
          this.permissionCache.delete(key)
        }
      })
    } else {
      this.permissionCache.clear()
    }
  }

  private buildCacheKey(
    resource: string,
    action: string,
    context: PermissionContext
  ): string {
    const contextStr = JSON.stringify(context)
    return `${resource}:${action}:${contextStr}`
  }
}

// Create a singleton instance for use across the application
export const rbacChecker = new ClientRBACChecker()
