/**
 * RBAC React Hooks
 * Epic 2 Story 2.8: React hooks for permission checking and role management
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useUser } from '@supabase/auth-helpers-react'
import { rbacChecker, UserPermission, Role, PermissionContext } from '@/lib/rbac/utils'

export interface UsePermissionOptions {
  context?: PermissionContext
  refreshInterval?: number
  enabled?: boolean
}

export interface UsePermissionResult {
  hasPermission: boolean
  loading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

/**
 * Hook to check if user has a specific permission
 */
export function usePermission(
  resource: string,
  action: string,
  options: UsePermissionOptions = {}
): UsePermissionResult {
  const { context = {}, refreshInterval, enabled = true } = options
  const user = useUser()
  
  const [hasPermission, setHasPermission] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const checkPermission = useCallback(async () => {
    if (!enabled || !user) {
      setHasPermission(false)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const result = await rbacChecker.hasPermission(resource, action, context)
      setHasPermission(result)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Permission check failed'))
      setHasPermission(false)
    } finally {
      setLoading(false)
    }
  }, [resource, action, JSON.stringify(context), enabled, user?.id])

  useEffect(() => {
    checkPermission()
  }, [checkPermission])

  // Set up refresh interval if specified
  useEffect(() => {
    if (!refreshInterval || !enabled) return

    const interval = setInterval(checkPermission, refreshInterval)
    return () => clearInterval(interval)
  }, [checkPermission, refreshInterval, enabled])

  return {
    hasPermission,
    loading,
    error,
    refresh: checkPermission
  }
}

/**
 * Hook to check multiple permissions at once
 */
export function usePermissions(
  permissions: { resource: string; action: string; context?: PermissionContext }[],
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options
  const user = useUser()
  
  const [permissionResults, setPermissionResults] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const checkPermissions = useCallback(async () => {
    if (!enabled || !user || permissions.length === 0) {
      setPermissionResults({})
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const results: Record<string, boolean> = {}
      
      // Check each permission individually
      for (const permission of permissions) {
        const key = `${permission.resource}:${permission.action}`
        results[key] = await rbacChecker.hasPermission(
          permission.resource,
          permission.action,
          permission.context
        )
      }
      
      setPermissionResults(results)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Permissions check failed'))
      setPermissionResults({})
    } finally {
      setLoading(false)
    }
  }, [JSON.stringify(permissions), enabled, user?.id])

  useEffect(() => {
    checkPermissions()
  }, [checkPermissions])

  const hasPermission = useCallback((resource: string, action: string): boolean => {
    return permissionResults[`${resource}:${action}`] || false
  }, [permissionResults])

  const hasAllPermissions = useCallback((): boolean => {
    return permissions.every(p => hasPermission(p.resource, p.action))
  }, [permissions, hasPermission])

  const hasAnyPermission = useCallback((): boolean => {
    return permissions.some(p => hasPermission(p.resource, p.action))
  }, [permissions, hasPermission])

  return {
    permissionResults,
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    loading,
    error,
    refresh: checkPermissions
  }
}

/**
 * Hook to get all user permissions
 */
export function useUserPermissions(
  userId?: string,
  context: PermissionContext = {}
) {
  const user = useUser()
  const [permissions, setPermissions] = useState<UserPermission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchPermissions = useCallback(async () => {
    if (!user && !userId) {
      setPermissions([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const userPermissions = await rbacChecker.getUserPermissions(
        userId || user?.id,
        context
      )
      setPermissions(userPermissions)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch permissions'))
      setPermissions([])
    } finally {
      setLoading(false)
    }
  }, [userId, user?.id, JSON.stringify(context)])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  const groupedPermissions = useMemo(() => {
    return permissions.reduce((groups, permission) => {
      const resource = permission.resourceName
      if (!groups[resource]) {
        groups[resource] = []
      }
      groups[resource].push(permission)
      return groups
    }, {} as Record<string, UserPermission[]>)
  }, [permissions])

  const permissionsByRole = useMemo(() => {
    return permissions.reduce((groups, permission) => {
      const role = permission.sourceRole
      if (!groups[role]) {
        groups[role] = []
      }
      groups[role].push(permission)
      return groups
    }, {} as Record<string, UserPermission[]>)
  }, [permissions])

  return {
    permissions,
    groupedPermissions,
    permissionsByRole,
    loading,
    error,
    refresh: fetchPermissions
  }
}

/**
 * Hook for role-based conditional rendering
 */
export function useRoleBasedAccess() {
  const user = useUser()

  const hasRole = useCallback(async (roleName: string): Promise<boolean> => {
    if (!user) return false
    
    try {
      const response = await fetch(`/api/rbac/roles?userId=${user.id}`)
      if (!response.ok) return false
      
      const result = await response.json()
      const userRoles = result.data?.userRoles || []
      
      return userRoles.some((ur: any) => ur.role?.name === roleName)
    } catch {
      return false
    }
  }, [user?.id])

  const hasAnyRole = useCallback(async (roleNames: string[]): Promise<boolean> => {
    if (!user) return false
    
    try {
      const response = await fetch(`/api/rbac/roles?userId=${user.id}`)
      if (!response.ok) return false
      
      const result = await response.json()
      const userRoles = result.data?.userRoles || []
      const userRoleNames = userRoles.map((ur: any) => ur.role?.name)
      
      return roleNames.some(role => userRoleNames.includes(role))
    } catch {
      return false
    }
  }, [user?.id])

  return {
    hasRole,
    hasAnyRole
  }
}

/**
 * Hook for business-specific permissions
 */
export function useBusinessPermissions(businessId: string) {
  const { hasPermission: hasGeneralPermission, loading: generalLoading } = usePermission(
    'businesses',
    'read',
    { context: { businessId } }
  )
  
  const { hasPermission: canManage, loading: manageLoading } = usePermission(
    'businesses',
    'manage',
    { context: { businessId } }
  )

  const { hasPermission: canUpdate, loading: updateLoading } = usePermission(
    'businesses',
    'update',
    { context: { businessId } }
  )

  const loading = generalLoading || manageLoading || updateLoading

  return {
    canRead: hasGeneralPermission,
    canManage,
    canUpdate,
    loading,
    isOwner: canManage, // Business owners have manage permissions
    isEmployee: hasGeneralPermission && !canManage, // Can read but not manage
  }
}

/**
 * Higher-order component for permission-based rendering
 */
export function withPermission(
  resource: string,
  action: string,
  context?: PermissionContext
) {
  return function <P extends object>(
    Component: React.ComponentType<P>
  ): React.ComponentType<P & { fallback?: React.ReactNode }> {
    return function PermissionGuard(props: P & { fallback?: React.ReactNode }) {
      const { hasPermission, loading } = usePermission(resource, action, { context })
      const { fallback, ...componentProps } = props

      if (loading) {
        return null // or a loading spinner
      }

      if (!hasPermission) {
        return fallback as React.ReactElement || null
      }

      return React.createElement(Component, componentProps as P)
    }
  }
}

/**
 * Permission Guard component for conditional rendering
 */
interface PermissionGuardProps {
  resource: string
  action: string
  context?: PermissionContext
  fallback?: React.ReactNode
  loadingComponent?: React.ReactNode
  children: React.ReactNode
}

export function PermissionGuard({
  resource,
  action,
  context,
  fallback = null,
  loadingComponent = null,
  children
}: PermissionGuardProps) {
  const { hasPermission, loading } = usePermission(resource, action, { context })

  if (loading) {
    return loadingComponent as React.ReactElement || null
  }

  if (!hasPermission) {
    return fallback as React.ReactElement || null
  }

  return children as React.ReactElement
}

/**
 * Hook for invalidating RBAC cache
 */
export function useRBACCache() {
  const invalidateCache = useCallback((resource?: string, action?: string) => {
    rbacChecker.invalidateCache(resource, action)
  }, [])

  const refreshUserPermissions = useCallback(async () => {
    const user = useUser()
    if (!user) return

    try {
      await fetch('/api/rbac/permissions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id })
      })
      
      // Invalidate local cache
      invalidateCache()
    } catch (error) {
      console.error('Failed to refresh permissions cache:', error)
    }
  }, [invalidateCache])

  return {
    invalidateCache,
    refreshUserPermissions
  }
}
