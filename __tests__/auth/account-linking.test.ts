/**
 * Account Linking Tests
 * Epic 2 Story 2.3: Social Media Login Integration
 * 
 * Tests for OAuth account linking, unlinking, and management functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { 
  AccountLinkingManager,
  hasMultipleAuthMethods,
  getPrimaryAuthMethod
} from '@/lib/auth/account-linking'

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
        eq: vi.fn(() => ({
          single: vi.fn(),
          maybeSingle: vi.fn(),
          neq: vi.fn(() => ({
            eq: vi.fn(() => ({}))
          })),
          order: vi.fn(() => ({}))
        })),
        neq: vi.fn(() => ({
          eq: vi.fn(() => ({}))
        })),
        is: vi.fn(() => ({
          order: vi.fn(() => ({}))
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({}))
      }))
    }))
  })),
  auth: {
    admin: {
      getUserById: vi.fn()
    }
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabaseClient
}))

describe('Account Linking Manager', () => {
  let accountLinking: AccountLinkingManager

  beforeEach(() => {
    accountLinking = new AccountLinkingManager()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('OAuth Account Linking', () => {
    const mockUser = {
      id: 'user-123',
      account_status: 'active'
    }

    const mockProviderConfig = {
      id: 'provider-456',
      provider_name: 'google',
      auto_link_accounts: true,
      require_email_verification: false
    }

    const mockConnectionData = {
      provider_user_id: 'google-123',
      provider_email: 'user@example.com',
      provider_username: 'testuser',
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      id_token: 'id-token',
      expires_in: 3600,
      provider_data: {
        id: 'google-123',
        email: 'user@example.com',
        name: 'Test User'
      }
    }

    beforeEach(() => {
      // Mock successful user validation
      mockSupabaseClient.from.mockImplementation((table) => {
        switch (table) {
          case 'profiles':
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(() => Promise.resolve({
                    data: mockUser,
                    error: null
                  }))
                }))
              }))
            }
          
          case 'oauth_providers':
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    single: vi.fn(() => Promise.resolve({
                      data: mockProviderConfig,
                      error: null
                    }))
                  }))
                }))
              }))
            }
          
          case 'user_oauth_connections':
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(() => Promise.resolve({
                      data: null, // No existing connection
                      error: null
                    }))
                  }))
                }))
              })),
              insert: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(() => Promise.resolve({
                    data: { id: 'connection-789' },
                    error: null
                  }))
                }))
              }))
            }
          
          default:
            return {
              select: vi.fn(() => ({})),
              insert: vi.fn(() => ({}))
            }
        }
      })
    })

    it('should successfully link a new OAuth account', async () => {
      const result = await accountLinking.linkOAuthAccount('user-123', 'google', mockConnectionData)

      expect(result.success).toBe(true)
      expect(result.connectionId).toBe('connection-789')
      expect(result.error).toBeUndefined()
    })

    it('should reject linking for inactive users', async () => {
      // Mock inactive user
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({
                  data: { ...mockUser, account_status: 'suspended' },
                  error: null
                }))
              }))
            }))
          }
        }
        return { select: vi.fn(() => ({})) }
      })

      const result = await accountLinking.linkOAuthAccount('user-123', 'google', mockConnectionData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('User account is not active')
    })

    it('should reject linking already connected OAuth accounts', async () => {
      // Mock existing connection
      mockSupabaseClient.from.mockImplementation((table) => {
        switch (table) {
          case 'profiles':
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(() => Promise.resolve({
                    data: mockUser,
                    error: null
                  }))
                }))
              }))
            }
          
          case 'oauth_providers':
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    single: vi.fn(() => Promise.resolve({
                      data: mockProviderConfig,
                      error: null
                    }))
                  }))
                }))
              }))
            }
          
          case 'user_oauth_connections':
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(() => Promise.resolve({
                      data: { user_id: 'other-user', provider_id: 'provider-456' },
                      error: null
                    }))
                  }))
                }))
              }))
            }
          
          default:
            return { select: vi.fn(() => ({})) }
        }
      })

      const result = await accountLinking.linkOAuthAccount('user-123', 'google', mockConnectionData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('OAuth account already linked to another user')
    })

    it('should handle disabled auto-linking with conflicts', async () => {
      const configWithoutAutoLink = {
        ...mockProviderConfig,
        auto_link_accounts: false
      }

      mockSupabaseClient.from.mockImplementation((table) => {
        switch (table) {
          case 'profiles':
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(() => Promise.resolve({
                    data: mockUser,
                    error: null
                  }))
                }))
              }))
            }
          
          case 'oauth_providers':
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    single: vi.fn(() => Promise.resolve({
                      data: configWithoutAutoLink,
                      error: null
                    }))
                  }))
                }))
              }))
            }
          
          case 'user_oauth_connections':
            return {
              select: vi.fn(() => ({
                eq: vi.fn((field) => {
                  if (field === 'provider_id') {
                    return {
                      eq: vi.fn(() => ({
                        maybeSingle: vi.fn(() => Promise.resolve({
                          data: null,
                          error: null
                        }))
                      }))
                    }
                  }
                  return {
                    eq: vi.fn(() => ({
                      neq: vi.fn(() => Promise.resolve({
                        data: [{ provider_id: 'other-provider' }], // Email conflict
                        error: null
                      }))
                    }))
                  }
                })
              }))
            }
          
          default:
            return { select: vi.fn(() => ({})) }
        }
      })

      const result = await accountLinking.linkOAuthAccount('user-123', 'google', mockConnectionData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Account linking requires manual confirmation')
      expect(result.conflicts).toBeDefined()
    })
  })

  describe('OAuth Account Unlinking', () => {
    const mockConnection = {
      id: 'connection-123',
      user_id: 'user-123',
      is_primary: false,
      provider_user_id: 'google-456',
      oauth_providers: {
        provider_name: 'google'
      }
    }

    beforeEach(() => {
      mockSupabaseClient.from.mockImplementation((table) => {
        switch (table) {
          case 'user_oauth_connections':
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    single: vi.fn(() => Promise.resolve({
                      data: mockConnection,
                      error: null
                    })),
                    neq: vi.fn(() => Promise.resolve({
                      data: [{ id: 'other-connection' }], // Other connections exist
                      error: null
                    }))
                  }))
                }))
              })),
              update: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({
                  data: {},
                  error: null
                }))
              }))
            }
          
          case 'profiles':
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(() => Promise.resolve({
                    data: { email: 'user@example.com' },
                    error: null
                  }))
                }))
              }))
            }
          
          default:
            return { select: vi.fn(() => ({})) }
        }
      })

      // Mock user has password auth
      mockSupabaseClient.auth.admin.getUserById.mockResolvedValue({
        user: { encrypted_password: 'hashed-password' }
      })
    })

    it('should successfully unlink OAuth account', async () => {
      const result = await accountLinking.unlinkOAuthAccount('user-123', 'connection-123', 'User requested')

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should prevent unlinking the only authentication method', async () => {
      // Mock no other connections and no password auth
      mockSupabaseClient.from.mockImplementation((table) => {
        switch (table) {
          case 'user_oauth_connections':
            return {
              select: vi.fn(() => ({
                eq: vi.fn((field) => {
                  if (field === 'id') {
                    return {
                      eq: vi.fn(() => ({
                        single: vi.fn(() => Promise.resolve({
                          data: mockConnection,
                          error: null
                        }))
                      }))
                    }
                  } else {
                    return {
                      eq: vi.fn(() => ({
                        neq: vi.fn(() => Promise.resolve({
                          data: [], // No other connections
                          error: null
                        }))
                      }))
                    }
                  }
                })
              }))
            }
          
          case 'profiles':
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(() => Promise.resolve({
                    data: { email: 'user@example.com' },
                    error: null
                  }))
                }))
              }))
            }
          
          default:
            return { select: vi.fn(() => ({})) }
        }
      })

      // Mock no password auth
      mockSupabaseClient.auth.admin.getUserById.mockResolvedValue({
        user: { encrypted_password: null }
      })

      const result = await accountLinking.unlinkOAuthAccount('user-123', 'connection-123')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Cannot unlink the only authentication method')
    })

    it('should prevent unlinking primary authentication method', async () => {
      const primaryConnection = {
        ...mockConnection,
        is_primary: true
      }

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'user_oauth_connections') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((field) => {
                if (field === 'id') {
                  return {
                    eq: vi.fn(() => ({
                      single: vi.fn(() => Promise.resolve({
                        data: primaryConnection,
                        error: null
                      }))
                    }))
                  }
                } else {
                  return {
                    eq: vi.fn(() => ({
                      neq: vi.fn(() => Promise.resolve({
                        data: [{ id: 'other-connection' }],
                        error: null
                      }))
                    }))
                  }
                }
              })
            }))
          }
        }
        return { select: vi.fn(() => ({})) }
      })

      const result = await accountLinking.unlinkOAuthAccount('user-123', 'connection-123')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Cannot unlink primary authentication method')
    })

    it('should reject unlinking non-existent connections', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'user_oauth_connections') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(() => Promise.resolve({
                    data: null,
                    error: { message: 'Connection not found' }
                  }))
                }))
              }))
            }))
          }
        }
        return { select: vi.fn(() => ({})) }
      })

      const result = await accountLinking.unlinkOAuthAccount('user-123', 'non-existent')

      expect(result.success).toBe(false)
      expect(result.error).toBe('OAuth connection not found')
    })
  })

  describe('Linked Accounts Retrieval', () => {
    const mockConnections = [
      {
        id: 'connection-1',
        provider_user_id: 'google-123',
        provider_email: 'user@example.com',
        provider_username: null,
        provider_data: { name: 'Test User' },
        is_primary: true,
        is_verified: true,
        connected_at: '2024-01-01T00:00:00Z',
        last_used_at: '2024-01-15T12:00:00Z',
        oauth_providers: { provider_name: 'google' }
      },
      {
        id: 'connection-2',
        provider_user_id: 'github-456',
        provider_email: 'user@example.com',
        provider_username: 'testuser',
        provider_data: { login: 'testuser' },
        is_primary: false,
        is_verified: true,
        connected_at: '2024-01-02T00:00:00Z',
        last_used_at: null,
        oauth_providers: { provider_name: 'github' }
      }
    ]

    beforeEach(() => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'user_oauth_connections') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  order: vi.fn(() => Promise.resolve({
                    data: mockConnections,
                    error: null
                  }))
                }))
              }))
            }))
          }
        }
        return { select: vi.fn(() => ({})) }
      })
    })

    it('should retrieve all linked accounts for a user', async () => {
      const linkedAccounts = await accountLinking.getLinkedAccounts('user-123')

      expect(linkedAccounts).toHaveLength(2)
      expect(linkedAccounts[0].provider).toBe('google')
      expect(linkedAccounts[0].is_primary).toBe(true)
      expect(linkedAccounts[1].provider).toBe('github')
      expect(linkedAccounts[1].is_primary).toBe(false)
    })

    it('should return empty array when no connections exist', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'user_oauth_connections') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  order: vi.fn(() => Promise.resolve({
                    data: [],
                    error: null
                  }))
                }))
              }))
            }))
          }
        }
        return { select: vi.fn(() => ({})) }
      })

      const linkedAccounts = await accountLinking.getLinkedAccounts('user-123')

      expect(linkedAccounts).toHaveLength(0)
    })

    it('should handle database errors gracefully', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'user_oauth_connections') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  order: vi.fn(() => Promise.resolve({
                    data: null,
                    error: { message: 'Database error' }
                  }))
                }))
              }))
            }))
          }
        }
        return { select: vi.fn(() => ({})) }
      })

      const linkedAccounts = await accountLinking.getLinkedAccounts('user-123')

      expect(linkedAccounts).toHaveLength(0)
    })
  })

  describe('Primary Authentication Method Management', () => {
    beforeEach(() => {
      mockSupabaseClient.from.mockImplementation((table) => {
        switch (table) {
          case 'user_oauth_connections':
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    is: vi.fn(() => ({
                      single: vi.fn(() => Promise.resolve({
                        data: {
                          id: 'connection-123',
                          oauth_providers: { provider_name: 'google' }
                        },
                        error: null
                      }))
                    }))
                  }))
                }))
              })),
              update: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({
                  data: {},
                  error: null
                })),
                neq: vi.fn(() => Promise.resolve({
                  data: {},
                  error: null
                }))
              }))
            }
          
          default:
            return { select: vi.fn(() => ({})) }
        }
      })
    })

    it('should set OAuth connection as primary', async () => {
      const result = await accountLinking.setPrimaryAuthMethod('user-123', 'connection-123')

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should set email/password as primary when connectionId is null', async () => {
      const result = await accountLinking.setPrimaryAuthMethod('user-123', undefined)

      expect(result.success).toBe(true)
    })

    it('should reject setting non-existent connection as primary', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'user_oauth_connections') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  is: vi.fn(() => ({
                    single: vi.fn(() => Promise.resolve({
                      data: null,
                      error: { message: 'Connection not found' }
                    }))
                  }))
                }))
              }))
            }))
          }
        }
        return { select: vi.fn(() => ({})) }
      })

      const result = await accountLinking.setPrimaryAuthMethod('user-123', 'non-existent')

      expect(result.success).toBe(false)
      expect(result.error).toBe('OAuth connection not found')
    })
  })
})

describe('Account Linking Utility Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('hasMultipleAuthMethods', () => {
    it('should return true when user has multiple auth methods', async () => {
      // Mock OAuth connections
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'user_oauth_connections') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => Promise.resolve({
                  data: [{ id: 'connection-1' }, { id: 'connection-2' }],
                  error: null
                }))
              }))
            }))
          }
        }
        return { select: vi.fn(() => ({})) }
      })

      // Mock password auth
      mockSupabaseClient.auth.admin.getUserById.mockResolvedValue({
        user: { encrypted_password: 'hashed-password' }
      })

      const result = await hasMultipleAuthMethods('user-123')

      expect(result).toBe(true)
    })

    it('should return false when user has only one auth method', async () => {
      // Mock single OAuth connection
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'user_oauth_connections') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => Promise.resolve({
                  data: [{ id: 'connection-1' }],
                  error: null
                }))
              }))
            }))
          }
        }
        return { select: vi.fn(() => ({})) }
      })

      // Mock no password auth
      mockSupabaseClient.auth.admin.getUserById.mockResolvedValue({
        user: { encrypted_password: null }
      })

      const result = await hasMultipleAuthMethods('user-123')

      expect(result).toBe(false)
    })
  })

  describe('getPrimaryAuthMethod', () => {
    it('should return primary OAuth method when exists', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'user_oauth_connections') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  is: vi.fn(() => ({
                    maybeSingle: vi.fn(() => Promise.resolve({
                      data: {
                        id: 'connection-123',
                        oauth_providers: { provider_name: 'google' }
                      },
                      error: null
                    }))
                  }))
                }))
              }))
            }))
          }
        }
        return { select: vi.fn(() => ({})) }
      })

      const result = await getPrimaryAuthMethod('user-123')

      expect(result?.type).toBe('oauth')
      expect(result?.provider).toBe('google')
      expect(result?.connectionId).toBe('connection-123')
    })

    it('should return email method when no primary OAuth exists but has password', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'user_oauth_connections') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  is: vi.fn(() => ({
                    maybeSingle: vi.fn(() => Promise.resolve({
                      data: null,
                      error: null
                    }))
                  }))
                }))
              }))
            }))
          }
        }
        return { select: vi.fn(() => ({})) }
      })

      mockSupabaseClient.auth.admin.getUserById.mockResolvedValue({
        user: { encrypted_password: 'hashed-password' }
      })

      const result = await getPrimaryAuthMethod('user-123')

      expect(result?.type).toBe('email')
      expect(result?.provider).toBeUndefined()
    })

    it('should return null when no authentication methods exist', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'user_oauth_connections') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  is: vi.fn(() => ({
                    maybeSingle: vi.fn(() => Promise.resolve({
                      data: null,
                      error: null
                    }))
                  }))
                }))
              }))
            }))
          }
        }
        return { select: vi.fn(() => ({})) }
      })

      mockSupabaseClient.auth.admin.getUserById.mockResolvedValue({
        user: { encrypted_password: null }
      })

      const result = await getPrimaryAuthMethod('user-123')

      expect(result).toBeNull()
    })
  })
})