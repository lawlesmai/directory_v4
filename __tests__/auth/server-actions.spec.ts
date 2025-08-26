import { test, expect, describe } from '@playwright/test'
import { 
  updateUserProfile, 
  changePassword,
  updateBusiness,
  manageUser,
  revokeSession,
  revokeAllOtherSessions
} from '@/lib/auth/server-actions'
import { createServiceRoleClient } from '@/lib/auth/server'

describe('Authentication Server Actions', () => {
  let testUserId: string
  let testBusinessId: string
  let serviceClient = createServiceRoleClient()

  // Setup before tests
  test.beforeAll(async () => {
    // Create test user
    const { data: { user } } = await serviceClient.auth.signUp({
      email: 'serveraction-test@example.com',
      password: 'TestPassword123!'
    })
    testUserId = user?.id || ''

    // Create test business
    const { data: businessData, error: businessError } = await serviceClient
      .from('businesses')
      .insert({
        name: 'Test Business',
        owner_id: testUserId,
        status: 'active'
      })
      .select()

    if (businessError) throw businessError
    testBusinessId = businessData[0].id
  })

  // Test profile update
  test('Update user profile', async () => {
    const result = await updateUserProfile({
      username: 'testuser',
      display_name: 'Test User'
    }, { 
      user: { id: testUserId } as any, 
      permissions: [], 
      roles: [] 
    })

    expect(result.success).toBe(true)
    expect(result.data.username).toBe('testuser')
  })

  // Test password change
  test('Change password', async () => {
    const result = await changePassword({
      currentPassword: 'TestPassword123!',
      newPassword: 'NewTestPassword456!',
      confirmPassword: 'NewTestPassword456!'
    }, { 
      user: { id: testUserId } as any, 
      permissions: [], 
      roles: [] 
    })

    expect(result.success).toBe(true)
  })

  // Test business update
  test('Update business', async () => {
    const result = await updateBusiness({
      businessId: testBusinessId,
      name: 'Updated Test Business',
      description: 'Updated description'
    }, { 
      user: { id: testUserId } as any, 
      permissions: [], 
      roles: ['business_owner'] 
    })

    expect(result.success).toBe(true)
    expect(result.data.name).toBe('Updated Test Business')
  })

  // Test user management (admin action)
  test('Manage user (suspend)', async () => {
    const result = await manageUser({
      userId: testUserId,
      action: 'suspend',
      reason: 'Test suspension reason'
    }, { 
      user: { id: testUserId } as any, 
      permissions: [], 
      roles: ['admin'] 
    })

    expect(result.success).toBe(true)
    expect(result.data.account_status).toBe('suspended')
  })

  // Test session revocation
  test('Revoke session', async () => {
    // First get active session
    const { data: { session } } = await serviceClient.auth.getSession()
    
    const result = await revokeSession(session?.access_token || '', { 
      user: { id: testUserId } as any, 
      permissions: [], 
      roles: [] 
    })

    expect(result.success).toBe(true)
  })

  // Test revoking all other sessions
  test('Revoke all other sessions', async () => {
    const result = await revokeAllOtherSessions(undefined, { 
      user: { id: testUserId } as any, 
      permissions: [], 
      roles: [] 
    })

    expect(result.success).toBe(true)
    expect(result.data.revokedCount).toBeGreaterThanOrEqual(0)
  })

  // Negative test scenarios
  describe('Authentication Failure Scenarios', () => {
    // Test unauthorized profile update
    test('Unauthorized profile update', async () => {
      const result = await updateUserProfile({
        username: 'unauthorized'
      }, { 
        user: null as any, 
        permissions: [], 
        roles: [] 
      })

      expect(result.success).toBe(false)
      expect(result.redirect).toBe('/auth/login')
    })

    // Test password change with invalid current password
    test('Invalid password change', async () => {
      const result = await changePassword({
        currentPassword: 'WrongPassword',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!'
      }, { 
        user: { id: testUserId } as any, 
        permissions: [], 
        roles: [] 
      })

      expect(result.success).toBe(false)
      expect(result.fieldErrors?.currentPassword).toBeTruthy()
    })

    // Test business update without authorization
    test('Unauthorized business update', async () => {
      const result = await updateBusiness({
        businessId: testBusinessId,
        name: 'Unauthorized Update'
      }, { 
        user: { id: 'wrong-user-id' } as any, 
        permissions: [], 
        roles: [] 
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Not authorized')
    })
  })
})
