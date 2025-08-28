/**
 * Authentication React Hooks
 * Epic 2 Story 2.1: React hooks for authentication state management
 * Provides hooks for authentication in React components
 */

import { useEffect, useState, createContext, useContext, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Session, User } from '@supabase/supabase-js'
import { authService, type AuthUser, type AuthState } from './client'

// Authentication context type
interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, metadata?: Record<string, any>) => Promise<void>
  signOut: () => Promise<void>
  signInWithOAuth: (provider: 'google' | 'apple' | 'facebook' | 'github') => Promise<void>
  signInWithMagicLink: (email: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (newPassword: string) => Promise<void>
  updateProfile: (updates: any) => Promise<void>
  refreshSession: () => Promise<void>
  hasRole: (role: string) => boolean
  hasPermission: (resource: string, action: string) => boolean
}

// Create auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Authentication Provider Component
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    error: null
  })

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        const session = await authService.getSession()
        if (session) {
          const user = await authService.getCurrentUser()
          setState({
            user,
            session,
            isLoading: false,
            error: null
          })
        } else {
          setState(prev => ({ ...prev, isLoading: false }))
        }
      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error as Error
        }))
      }
    }

    initAuth()

    // Listen to auth state changes
    const { data: { subscription } } = authService.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          const user = await authService.getCurrentUser()
          setState({
            user,
            session,
            isLoading: false,
            error: null
          })
        } else if (event === 'SIGNED_OUT') {
          setState({
            user: null,
            session: null,
            isLoading: false,
            error: null
          })
        } else if (event === 'TOKEN_REFRESHED' && session) {
          const user = await authService.getCurrentUser()
          setState(prev => ({
            ...prev,
            user,
            session
          }))
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Sign in
  const signIn = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const { session } = await authService.signIn(email, password)
      const user = await authService.getCurrentUser()
      setState({
        user,
        session,
        isLoading: false,
        error: null
      })
      router.push('/dashboard')
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error as Error
      }))
      throw error
    }
  }, [router])

  // Sign up
  const signUp = useCallback(async (
    email: string,
    password: string,
    metadata?: Record<string, any>
  ) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      await authService.signUp(email, password, metadata)
      setState(prev => ({ ...prev, isLoading: false }))
      router.push('/auth/verify-email')
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error as Error
      }))
      throw error
    }
  }, [router])

  // Sign out
  const signOut = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }))
    try {
      await authService.signOut()
      setState({
        user: null,
        session: null,
        isLoading: false,
        error: null
      })
      router.push('/')
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error as Error
      }))
      throw error
    }
  }, [router])

  // OAuth sign in
  const signInWithOAuth = useCallback(async (
    provider: 'google' | 'apple' | 'facebook' | 'github'
  ) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      await authService.signInWithOAuth(provider)
      // OAuth redirects, so we don't need to handle the response here
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error as Error
      }))
      throw error
    }
  }, [])

  // Magic link sign in
  const signInWithMagicLink = useCallback(async (email: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      await authService.signInWithMagicLink(email)
      setState(prev => ({ ...prev, isLoading: false }))
      router.push('/auth/check-email')
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error as Error
      }))
      throw error
    }
  }, [router])

  // Reset password
  const resetPassword = useCallback(async (email: string) => {
    try {
      await authService.resetPassword(email)
      router.push('/auth/check-email')
    } catch (error) {
      throw error
    }
  }, [router])

  // Update password
  const updatePassword = useCallback(async (newPassword: string) => {
    try {
      await authService.updatePassword(newPassword)
      router.push('/dashboard')
    } catch (error) {
      throw error
    }
  }, [router])

  // Update profile
  const updateProfile = useCallback(async (updates: any) => {
    try {
      const profile = await authService.updateProfile(updates)
      setState(prev => ({
        ...prev,
        user: prev.user ? { ...prev.user, profile } : null
      }))
    } catch (error) {
      throw error
    }
  }, [])

  // Refresh session
  const refreshSession = useCallback(async () => {
    try {
      const session = await authService.getSession()
      const user = await authService.getCurrentUser()
      setState(prev => ({
        ...prev,
        user,
        session
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error as Error
      }))
      throw error
    }
  }, [])

  // Check role
  const hasRole = useCallback((role: string): boolean => {
    return state.user?.roles?.includes(role) || false
  }, [state.user])

  // Check permission
  const hasPermission = useCallback((resource: string, action: string): boolean => {
    return state.user?.permissions?.includes(`${resource}:${action}`) || false
  }, [state.user])

  const value: AuthContextType = {
    ...state,
    signIn,
    signUp,
    signOut,
    signInWithOAuth,
    signInWithMagicLink,
    resetPassword,
    updatePassword,
    updateProfile,
    refreshSession,
    hasRole,
    hasPermission
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Hook to use authentication context
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/**
 * Hook to require authentication
 */
export function useRequireAuth(redirectUrl: string = '/auth/login') {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push(redirectUrl)
    }
  }, [user, isLoading, router, redirectUrl])

  return { user, isLoading }
}

/**
 * Hook to require specific role
 */
export function useRequireRole(role: string, redirectUrl: string = '/unauthorized') {
  const { user, hasRole, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && user && !hasRole(role)) {
      router.push(redirectUrl)
    }
  }, [user, hasRole, role, isLoading, router, redirectUrl])

  return { user, isLoading }
}

/**
 * Hook for MFA management
 */
export function useMFA() {
  const { user } = useAuth()
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const checkMFAStatus = async () => {
      if (!user) return
      
      setIsLoading(true)
      try {
        // Check MFA status from database
        const response = await fetch('/api/auth/mfa/status')
        const data = await response.json()
        setMfaEnabled(data.enabled)
      } catch (error) {
        console.error('Failed to check MFA status:', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkMFAStatus()
  }, [user])

  const enableMFA = async (type: 'totp' | 'sms' = 'totp') => {
    setIsLoading(true)
    try {
      const data = await authService.enableMFA(type)
      setMfaEnabled(true)
      return data
    } catch (error) {
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const verifyMFA = async (code: string, type: 'totp' | 'sms' | 'backup_code' = 'totp') => {
    setIsLoading(true)
    try {
      const isValid = await authService.verifyMFA(code, type)
      return isValid
    } catch (error) {
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const disableMFA = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/mfa/disable', {
        method: 'POST'
      })
      if (!response.ok) throw new Error('Failed to disable MFA')
      setMfaEnabled(false)
    } catch (error) {
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  return {
    mfaEnabled,
    isLoading,
    enableMFA,
    verifyMFA,
    disableMFA
  }
}

/**
 * Hook for session management
 */
export function useSessions() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const fetchSessions = async () => {
      if (!user) return
      
      setIsLoading(true)
      try {
        const response = await fetch('/api/auth/sessions')
        const data = await response.json()
        setSessions(data.sessions || [])
      } catch (error) {
        console.error('Failed to fetch sessions:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSessions()
  }, [user])

  const revokeSession = async (sessionId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/auth/sessions/${sessionId}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to revoke session')
      setSessions(prev => prev.filter(s => s.id !== sessionId))
    } catch (error) {
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const revokeAllSessions = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/sessions', {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to revoke sessions')
      setSessions([])
    } catch (error) {
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  return {
    sessions,
    isLoading,
    revokeSession,
    revokeAllSessions
  }
}
