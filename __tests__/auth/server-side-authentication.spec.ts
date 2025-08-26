import { test, expect, describe } from '@playwright/test'
import { 
  createServerSupabaseClient, 
  getServerUser, 
  requireAuth, 
  requireRole, 
  requirePermission,
  validateAndRefreshSession
} from '@/lib/auth/server-utils'
import { SessionManager, SESSION_CONFIG } from '@/lib/auth/session-manager'
import { createServiceRoleClient } from '@/lib/auth/server'

describe('Server-Side Authentication System', () => {
  // Test server Supabase client creation
  test('Create server Supabase client', async () => {
    const supabase = await createServerSupabaseClient()
    expect(supabase).toBeTruthy()
    expect(supabase.auth).toBeTruthy()
  })

  // Test user retrieval
  test('Get server user with comprehensive data', async () => {
    // Create test user first
    const serviceClient = createServiceRoleClient()
    const { data: testUser } = await serviceClient.auth.signUp({
      email: 'test-server-user@example.com',
      password: 'TestPassword123!'
    })

    const user = await getServerUser()
    
    expect(user).toBeTruthy()
    expect(user?.email).toBe(testUser.user?.email)
    expect(user?.roles).toBeDefined()
    expect(user?.permissions).toBeDefined()
    expect(user?.profile).toBeDefined()
  })

  // Test authentication requirements
  test('Require authentication flow', async () => {
    // Positive test with authenticated user
    const authenticatedUser = await requireAuth()
    expect(authenticatedUser).toBeTruthy()
    expect(authenticatedUser.id).toBeDefined()

    // Negative test (would typically mock no authentication)
    // This is harder to test directly in Playwright
  })

  // Test role-based access control
  test('Require role enforcement', async () => {
    // Positive test: User has required role
    const userWithAdminRole = await requireRole('admin')
    expect(userWithAdminRole).toBeTruthy()
    expect(userWithAdminRole.roles).toContain('admin')

    // Negative test: User lacks required role
    await expect(requireRole('non_existent_role')).rejects.toThrow()
  })

  // Test permission-based access control
  test('Require permission enforcement', async () => {
    // Positive test: User has required permission
    const userWithPermission = await requirePermission('business', 'edit')
    expect(userWithPermission).toBeTruthy()
    expect(userWithPermission.permissions).toContain('business:edit')

    // Negative test: User lacks required permission
    await expect(requirePermission('system', 'admin')).rejects.toThrow()
  })

  // Test session validation and refresh
  test('Session validation and refresh', async () => {
    const sessionResult = await validateAndRefreshSession()
    
    expect(sessionResult.user).toBeTruthy()
    expect(sessionResult.session).toBeTruthy()
    
    // Check refresh timing
    const sessionManager = new SessionManager()
    const refreshResult = await sessionManager.refreshSession()
    
    expect(refreshResult.success).toBe(true)
    expect(refreshResult.session).toBeTruthy()
  })

  // Performance benchmarks
  test('Authentication performance benchmarks', async () => {
    const startTime = Date.now()
    await getServerUser()
    const processingTime = Date.now() - startTime
    
    expect(processingTime).toBeLessThan(50) // ms
  })

  // Security configuration checks
  test('Session security configuration', () => {
    expect(SESSION_CONFIG.MAX_CONCURRENT_SESSIONS).toBe(5)
    expect(SESSION_CONFIG.DEFAULT_TIMEOUT).toBe(2 * 60 * 60 * 1000) // 2 hours
    expect(SESSION_CONFIG.TRACK_DEVICE_CHANGES).toBe(true)
  })
})
