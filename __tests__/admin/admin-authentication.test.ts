import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

// Mock environment setup
const mockSupabase = {
  auth: {
    signInWithPassword: jest.fn(),
    signOut: jest.fn(),
    getUser: jest.fn()
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn()
      }))
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn()
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn()
    }))
  })),
  rpc: jest.fn()
};

// Mock createClient
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

// Mock rate limiting
jest.mock('@/lib/api/rate-limit', () => {
  return jest.fn(() => ({
    check: jest.fn(() => Promise.resolve({ success: true }))
  }));
});

describe('Admin Authentication System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Admin Login Endpoint', () => {
    test('should successfully authenticate valid admin user', async () => {
      // Mock successful auth response
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'test-user-id', email: 'admin@test.com' }
        },
        error: null
      });

      // Mock admin user lookup
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-user-id',
                admin_level: 'platform_admin',
                requires_mfa: false,
                account_locked: false,
                failed_login_attempts: 0,
                ip_whitelist_enabled: false,
                ip_whitelist: null,
                mfa_grace_period: null
              },
              error: null
            })
          }))
        }))
      });

      // Mock session creation
      mockSupabase.from.mockReturnValue({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: { id: 'test-session-id' },
              error: null
            })
          }))
        }))
      });

      const { POST } = await import('@/app/api/admin/auth/login/route');
      
      const request = new NextRequest('http://localhost:3000/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'admin@test.com',
          password: 'validpassword123'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.id).toBe('test-user-id');
      expect(data.sessionId).toBeDefined();
    });

    test('should reject authentication for non-admin users', async () => {
      // Mock successful Supabase auth but user is not admin
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'regular-user-id', email: 'user@test.com' }
        },
        error: null
      });

      // Mock admin user lookup failure
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'No rows found' }
            })
          }))
        }))
      });

      const { POST } = await import('@/app/api/admin/auth/login/route');
      
      const request = new NextRequest('http://localhost:3000/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'user@test.com',
          password: 'validpassword123'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Access denied');
      expect(data.message).toBe('Administrative access required');
    });

    test('should enforce MFA for admin users requiring it', async () => {
      // Mock successful auth response
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'test-user-id', email: 'admin@test.com' }
        },
        error: null
      });

      // Mock admin user with MFA required
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-user-id',
                admin_level: 'super_admin',
                requires_mfa: true,
                account_locked: false,
                failed_login_attempts: 0,
                ip_whitelist_enabled: false,
                ip_whitelist: null,
                mfa_grace_period: null
              },
              error: null
            })
          }))
        }))
      });

      // Mock MFA config lookup
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: {
                mfa_enabled: true,
                totp_enabled: true,
                sms_enabled: false,
                email_enabled: false
              },
              error: null
            })
          }))
        }))
      });

      const { POST } = await import('@/app/api/admin/auth/login/route');
      
      const request = new NextRequest('http://localhost:3000/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'admin@test.com',
          password: 'validpassword123'
          // No MFA code provided
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.requiresMFA).toBe(true);
      expect(data.challengeId).toBeDefined();
      expect(data.availableMethods.totp).toBe(true);
    });

    test('should reject login for locked admin accounts', async () => {
      // Mock successful auth response
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'test-user-id', email: 'admin@test.com' }
        },
        error: null
      });

      // Mock locked admin user
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-user-id',
                admin_level: 'platform_admin',
                requires_mfa: false,
                account_locked: true,
                failed_login_attempts: 5,
                ip_whitelist_enabled: false,
                ip_whitelist: null,
                mfa_grace_period: null
              },
              error: null
            })
          }))
        }))
      });

      const { POST } = await import('@/app/api/admin/auth/login/route');
      
      const request = new NextRequest('http://localhost:3000/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'admin@test.com',
          password: 'validpassword123'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(423);
      expect(data.error).toBe('Account locked');
    });

    test('should validate IP whitelist if enabled', async () => {
      // Mock successful auth response
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'test-user-id', email: 'admin@test.com' }
        },
        error: null
      });

      // Mock admin user with IP whitelist enabled
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-user-id',
                admin_level: 'platform_admin',
                requires_mfa: false,
                account_locked: false,
                failed_login_attempts: 0,
                ip_whitelist_enabled: true,
                ip_whitelist: ['192.168.1.100'],
                mfa_grace_period: null
              },
              error: null
            })
          }))
        }))
      });

      // Mock IP validation function returning false
      mockSupabase.rpc.mockResolvedValue({
        data: false,
        error: null
      });

      const { POST } = await import('@/app/api/admin/auth/login/route');
      
      const request = new NextRequest('http://localhost:3000/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'admin@test.com',
          password: 'validpassword123'
        }),
        headers: {
          'x-forwarded-for': '10.0.0.1' // Different IP
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Access denied');
      expect(data.message).toBe('Access from this IP address is not permitted');
    });

    test('should handle rate limiting correctly', async () => {
      // Mock rate limiting failure
      const mockRateLimit = require('@/lib/api/rate-limit');
      mockRateLimit.mockReturnValue({
        check: jest.fn(() => Promise.resolve({ success: false }))
      });

      const { POST } = await import('@/app/api/admin/auth/login/route');
      
      const request = new NextRequest('http://localhost:3000/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'admin@test.com',
          password: 'validpassword123'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Too many login attempts');
    });
  });

  describe('Session Management', () => {
    test('should validate active admin sessions correctly', async () => {
      // Mock session validation
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gt: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'test-session-id',
                  admin_id: 'test-user-id',
                  ip_address: '192.168.1.100',
                  expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                  is_suspicious: false,
                  suspicion_score: 0,
                  mfa_verified: true,
                  admin_users: {
                    id: 'test-user-id',
                    admin_level: 'platform_admin',
                    account_locked: false,
                    profiles: {
                      display_name: 'Test Admin',
                      email: 'admin@test.com'
                    }
                  }
                },
                error: null
              })
            }))
          }))
        }))
      });

      const { GET } = await import('@/app/api/admin/auth/session/route');
      
      const request = new NextRequest('http://localhost:3000/api/admin/auth/session', {
        method: 'GET',
        headers: {
          'Cookie': 'admin-session=valid-session-token'
        }
      });

      // Mock cookies
      jest.mock('next/headers', () => ({
        cookies: () => ({
          get: (name: string) => name === 'admin-session' ? { value: 'valid-session-token' } : null
        })
      }));

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.authenticated).toBe(true);
      expect(data.user.id).toBe('test-user-id');
    });

    test('should reject expired sessions', async () => {
      // Mock expired session
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gt: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'No rows found' }
              })
            }))
          }))
        }))
      });

      const { GET } = await import('@/app/api/admin/auth/session/route');
      
      const request = new NextRequest('http://localhost:3000/api/admin/auth/session', {
        method: 'GET',
        headers: {
          'Cookie': 'admin-session=expired-session-token'
        }
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.authenticated).toBe(false);
      expect(data.error).toBe('Invalid or expired session');
    });

    test('should handle suspicious sessions appropriately', async () => {
      // Mock suspicious session
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gt: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'test-session-id',
                  admin_id: 'test-user-id',
                  ip_address: '192.168.1.100',
                  expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                  is_suspicious: true,
                  suspicion_score: 85,
                  mfa_verified: true,
                  admin_users: {
                    id: 'test-user-id',
                    admin_level: 'platform_admin',
                    account_locked: false,
                    profiles: {
                      display_name: 'Test Admin',
                      email: 'admin@test.com'
                    }
                  }
                },
                error: null
              })
            }))
          }))
        }))
      });

      const { GET } = await import('@/app/api/admin/auth/session/route');
      
      const request = new NextRequest('http://localhost:3000/api/admin/auth/session', {
        method: 'GET',
        headers: {
          'Cookie': 'admin-session=suspicious-session-token'
        }
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.authenticated).toBe(true);
      expect(data.session.isSuspicious).toBe(true);
      expect(data.session.suspicionScore).toBe(85);
      expect(data.session.requiresReauth).toBe(true);
    });
  });

  describe('MFA Setup and Verification', () => {
    test('should setup TOTP MFA correctly', async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'admin@test.com' } },
        error: null
      });

      // Mock admin user verification
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-user-id',
                admin_level: 'platform_admin',
                requires_mfa: true
              },
              error: null
            })
          }))
        }))
      });

      const { POST } = await import('@/app/api/admin/auth/mfa/setup/route');
      
      const request = new NextRequest('http://localhost:3000/api/admin/auth/mfa/setup', {
        method: 'POST',
        body: JSON.stringify({
          method: 'totp'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.method).toBe('totp');
      expect(data.secret).toBeDefined();
      expect(data.qrCode).toBeDefined();
      expect(data.backupCodes).toBeDefined();
    });

    test('should verify TOTP codes correctly', async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'admin@test.com' } },
        error: null
      });

      // Mock TOTP verification
      mockSupabase.rpc.mockResolvedValue({
        data: true,
        error: null
      });

      const { PUT } = await import('@/app/api/admin/auth/mfa/setup/route');
      
      const request = new NextRequest('http://localhost:3000/api/admin/auth/mfa/setup', {
        method: 'PUT',
        body: JSON.stringify({
          method: 'totp',
          code: '123456'
        })
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('TOTP MFA successfully configured');
    });

    test('should reject invalid TOTP codes', async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'admin@test.com' } },
        error: null
      });

      // Mock TOTP verification failure
      mockSupabase.rpc.mockResolvedValue({
        data: false,
        error: null
      });

      const { PUT } = await import('@/app/api/admin/auth/mfa/setup/route');
      
      const request = new NextRequest('http://localhost:3000/api/admin/auth/mfa/setup', {
        method: 'PUT',
        body: JSON.stringify({
          method: 'totp',
          code: 'invalid'
        })
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid verification code');
    });
  });

  describe('Admin Logout', () => {
    test('should logout admin successfully', async () => {
      // Mock session lookup and termination
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-session-id',
                admin_id: 'test-user-id'
              },
              error: null
            })
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        }))
      });

      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      const { POST } = await import('@/app/api/admin/auth/logout/route');
      
      const request = new NextRequest('http://localhost:3000/api/admin/auth/logout', {
        method: 'POST',
        headers: {
          'Cookie': 'admin-session=valid-session-token'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Successfully logged out');
    });
  });
});

describe('Admin Authorization Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should authorize admin with sufficient permissions', async () => {
    const { withAdminAuth } = await import('@/lib/auth/admin-middleware');

    // Mock successful session validation
    mockSupabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'test-session-id',
              admin_id: 'test-user-id',
              expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
              is_suspicious: false,
              admin_users: {
                id: 'test-user-id',
                admin_level: 'platform_admin',
                account_locked: false,
                profiles: {
                  display_name: 'Test Admin',
                  email: 'admin@test.com'
                }
              }
            },
            error: null
          })
        }))
      }))
    });

    // Mock permissions evaluation
    mockSupabase.rpc.mockResolvedValue({
      data: [
        { resource_name: 'admin_users', action_name: 'read' },
        { resource_name: 'admin_users', action_name: 'create' }
      ],
      error: null
    });

    const request = new NextRequest('http://localhost:3000/api/admin/test', {
      method: 'GET',
      headers: {
        'Cookie': 'admin-session=valid-session-token'
      }
    });

    const result = await withAdminAuth(request, {
      requiredPermissions: ['admin_users:read']
    });

    expect(result.success).toBe(true);
    expect(result.context?.isAuthenticated).toBe(true);
    expect(result.context?.user?.id).toBe('test-user-id');
  });

  test('should reject access for insufficient permissions', async () => {
    const { withAdminAuth } = await import('@/lib/auth/admin-middleware');

    // Mock successful session validation
    mockSupabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'test-session-id',
              admin_id: 'test-user-id',
              expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
              is_suspicious: false,
              admin_users: {
                id: 'test-user-id',
                admin_level: 'support_admin',
                account_locked: false,
                profiles: {
                  display_name: 'Test Admin',
                  email: 'admin@test.com'
                }
              }
            },
            error: null
          })
        }))
      }))
    });

    // Mock limited permissions
    mockSupabase.rpc.mockResolvedValue({
      data: [
        { resource_name: 'users', action_name: 'read' }
      ],
      error: null
    });

    const request = new NextRequest('http://localhost:3000/api/admin/test', {
      method: 'GET',
      headers: {
        'Cookie': 'admin-session=valid-session-token'
      }
    });

    const result = await withAdminAuth(request, {
      requiredPermissions: ['admin_users:delete']
    });

    expect(result.success).toBe(false);
    expect(result.response?.status).toBe(403);
  });

  test('should enforce admin level requirements', async () => {
    const { withAdminAuth } = await import('@/lib/auth/admin-middleware');

    // Mock session with lower admin level
    mockSupabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'test-session-id',
              admin_id: 'test-user-id',
              expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
              is_suspicious: false,
              admin_users: {
                id: 'test-user-id',
                admin_level: 'support_admin', // Lower level
                account_locked: false,
                profiles: {
                  display_name: 'Test Admin',
                  email: 'admin@test.com'
                }
              }
            },
            error: null
          })
        }))
      }))
    });

    const request = new NextRequest('http://localhost:3000/api/admin/test', {
      method: 'GET',
      headers: {
        'Cookie': 'admin-session=valid-session-token'
      }
    });

    const result = await withAdminAuth(request, {
      requiredAdminLevel: 'platform_admin' // Higher level required
    });

    expect(result.success).toBe(false);
    expect(result.response?.status).toBe(403);
  });
});

describe('IP Access Control', () => {
  test('should validate IP addresses correctly', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: true,
      error: null
    });

    const { validateAdminIPAccess } = await import('@/app/api/admin/security/ip-access/route');
    
    const result = await mockSupabase.rpc('validate_admin_ip_access', {
      p_admin_id: 'test-user-id',
      p_ip_address: '192.168.1.100'
    });

    expect(result.data).toBe(true);
  });

  test('should block non-whitelisted IP addresses', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: false,
      error: null
    });

    const result = await mockSupabase.rpc('validate_admin_ip_access', {
      p_admin_id: 'test-user-id',
      p_ip_address: '10.0.0.1'
    });

    expect(result.data).toBe(false);
  });
});

describe('Audit Logging', () => {
  test('should log admin actions correctly', async () => {
    const { logAdminAction } = await import('@/lib/auth/admin-middleware');

    const context = {
      isAuthenticated: true,
      user: { id: 'test-user-id' },
      session: { id: 'test-session-id' },
      permissions: []
    };

    mockSupabase.rpc.mockResolvedValue({
      data: 'test-audit-id',
      error: null
    });

    await logAdminAction(context, 'test_action', 'test_category', {
      success: true,
      resourceType: 'test_resource',
      resourceId: 'test-id'
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('log_admin_action', {
      p_admin_id: 'test-user-id',
      p_session_id: 'test-session-id',
      p_action: 'test_action',
      p_action_category: 'test_category',
      p_resource_type: 'test_resource',
      p_resource_id: 'test-id',
      p_old_values: undefined,
      p_new_values: undefined,
      p_success: true,
      p_error_message: undefined
    });
  });
});

describe('Rate Limiting', () => {
  test('should enforce rate limits correctly', async () => {
    const { checkAdminRateLimit } = await import('@/lib/auth/admin-middleware');

    // Mock rate limit exceeded
    mockSupabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          gte: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'rate-limit-id',
                attempt_count: 100,
                max_attempts: 50,
                is_blocked: true,
                blocked_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                window_end: new Date(Date.now() + 60 * 60 * 1000).toISOString()
              },
              error: null
            })
          }))
        }))
      }))
    });

    const result = await checkAdminRateLimit('test-user-id', 'test_operation', 50, 60);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});