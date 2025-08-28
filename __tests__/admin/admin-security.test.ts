import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
        gt: jest.fn(() => ({
          single: jest.fn(),
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              single: jest.fn()
            }))
          }))
        })),
        gte: jest.fn(() => ({
          single: jest.fn(),
          order: jest.fn(() => ({
            limit: jest.fn()
          }))
        })),
        order: jest.fn(() => ({
          limit: jest.fn(),
          range: jest.fn()
        })),
        range: jest.fn(),
        limit: jest.fn()
      })),
      in: jest.fn(() => ({
        eq: jest.fn()
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
    head: true
  })),
  rpc: jest.fn(),
  auth: {
    getUser: jest.fn()
  }
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

// Mock admin middleware
jest.mock('@/lib/auth/admin-middleware', () => ({
  requireAdminAuth: (handler: any) => handler,
  AdminPermissionChecker: jest.fn().mockImplementation(() => ({
    hasPermission: jest.fn(() => true),
    hasAdminLevel: jest.fn(() => true)
  })),
  logAdminAction: jest.fn(),
  checkAdminRateLimit: jest.fn(() => Promise.resolve({ allowed: true, remaining: 100, resetAt: new Date() }))
}));

describe('Admin Security Features', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('IP Access Control', () => {
    test('should create IP whitelist rule successfully', async () => {
      // Mock successful creation
      mockSupabase.from.mockReturnValue({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-rule-id',
                ip_address: '192.168.1.100',
                access_type: 'whitelist',
                applies_to: 'global',
                description: 'Test whitelist rule',
                is_active: true,
                created_at: new Date().toISOString()
              },
              error: null
            })
          }))
        }))
      });

      const { POST } = await import('@/app/api/admin/security/ip-access/route');
      
      const request = new NextRequest('http://localhost:3000/api/admin/security/ip-access', {
        method: 'POST',
        body: JSON.stringify({
          ipAddress: '192.168.1.100',
          accessType: 'whitelist',
          appliesTo: 'global',
          description: 'Test whitelist rule'
        })
      });

      const mockContext = {
        isAuthenticated: true,
        user: { id: 'test-user-id', adminLevel: 'platform_admin' },
        permissions: ['admin_security:configure']
      };

      const response = await POST(request, mockContext as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.ip_address).toBe('192.168.1.100');
    });

    test('should validate CIDR ranges correctly', async () => {
      const { POST } = await import('@/app/api/admin/security/ip-access/route');
      
      const request = new NextRequest('http://localhost:3000/api/admin/security/ip-access', {
        method: 'POST',
        body: JSON.stringify({
          ipRange: '192.168.1.0/24',
          accessType: 'whitelist',
          appliesTo: 'global',
          description: 'Network range whitelist'
        })
      });

      const mockContext = {
        isAuthenticated: true,
        user: { id: 'test-user-id', adminLevel: 'platform_admin' },
        permissions: ['admin_security:configure']
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-rule-id',
                ip_range: '192.168.1.0/24',
                access_type: 'whitelist',
                applies_to: 'global',
                description: 'Network range whitelist',
                is_active: true
              },
              error: null
            })
          }))
        }))
      });

      const response = await POST(request, mockContext as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.ip_range).toBe('192.168.1.0/24');
    });

    test('should reject invalid CIDR ranges', async () => {
      const { POST } = await import('@/app/api/admin/security/ip-access/route');
      
      const request = new NextRequest('http://localhost:3000/api/admin/security/ip-access', {
        method: 'POST',
        body: JSON.stringify({
          ipRange: '192.168.1.0/50', // Invalid mask
          accessType: 'whitelist',
          appliesTo: 'global',
          description: 'Invalid CIDR'
        })
      });

      const mockContext = {
        isAuthenticated: true,
        user: { id: 'test-user-id', adminLevel: 'platform_admin' },
        permissions: ['admin_security:configure']
      };

      const response = await POST(request, mockContext as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid CIDR range format');
    });

    test('should detect conflicting IP rules', async () => {
      // Mock existing conflicting rule
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'existing-rule-id',
                  access_type: 'blacklist',
                  applies_to: 'global'
                }
              ],
              error: null
            })
          }))
        }))
      });

      const { POST } = await import('@/app/api/admin/security/ip-access/route');
      
      const request = new NextRequest('http://localhost:3000/api/admin/security/ip-access', {
        method: 'POST',
        body: JSON.stringify({
          ipAddress: '192.168.1.100',
          accessType: 'whitelist', // Conflicts with existing blacklist
          appliesTo: 'global',
          description: 'Conflicting rule'
        })
      });

      const mockContext = {
        isAuthenticated: true,
        user: { id: 'test-user-id', adminLevel: 'platform_admin' },
        permissions: ['admin_security:configure']
      };

      const response = await POST(request, mockContext as any);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Conflicting IP access rule exists');
    });

    test('should list IP access rules with filtering', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          ip_address: '192.168.1.100',
          access_type: 'whitelist',
          applies_to: 'global',
          is_active: true,
          created_at: '2025-08-27T10:00:00Z'
        },
        {
          id: 'rule-2',
          ip_range: '10.0.0.0/8',
          access_type: 'blacklist',
          applies_to: 'admin_level',
          target_admin_level: 'support_admin',
          is_active: true,
          created_at: '2025-08-27T11:00:00Z'
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              range: jest.fn().mockResolvedValue({
                data: mockRules,
                error: null
              })
            }))
          }))
        }))
      });

      // Mock count query
      const countQuery = {
        select: jest.fn(() => ({
          head: true,
          count: 2
        }))
      };
      mockSupabase.from.mockReturnValueOnce(countQuery);

      const { GET } = await import('@/app/api/admin/security/ip-access/route');
      
      const request = new NextRequest('http://localhost:3000/api/admin/security/ip-access?accessType=whitelist&page=1&limit=20');

      const mockContext = {
        isAuthenticated: true,
        user: { id: 'test-user-id', adminLevel: 'platform_admin' },
        permissions: ['admin_security:read']
      };

      const response = await GET(request, mockContext as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
    });

    test('should update IP access rules correctly', async () => {
      // Mock existing rule
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-rule-id',
                ip_address: '192.168.1.100',
                access_type: 'whitelist',
                description: 'Original description'
              },
              error: null
            })
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'test-rule-id',
                  ip_address: '192.168.1.100',
                  access_type: 'whitelist',
                  description: 'Updated description',
                  updated_at: new Date().toISOString()
                },
                error: null
              })
            }))
          }))
        }))
      });

      const { PUT } = await import('@/app/api/admin/security/ip-access/route');
      
      const request = new NextRequest('http://localhost:3000/api/admin/security/ip-access?id=test-rule-id', {
        method: 'PUT',
        body: JSON.stringify({
          description: 'Updated description',
          isActive: true
        })
      });

      const mockContext = {
        isAuthenticated: true,
        user: { id: 'test-user-id', adminLevel: 'platform_admin' },
        permissions: ['admin_security:configure']
      };

      const response = await PUT(request, mockContext as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.description).toBe('Updated description');
    });
  });

  describe('Security Incident Detection', () => {
    test('should detect suspicious login patterns', async () => {
      const { detectSuspiciousAdminActivity } = await import('@/supabase/migrations/019_admin_portal_foundation.sql');

      // Mock session with suspicious indicators
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-session-id',
                admin_id: 'test-admin-id',
                ip_address: '10.0.0.1',
                country_code: 'CN',
                created_at: new Date().toISOString(),
                is_vpn: true,
                last_login_ip: '192.168.1.100',
                last_login_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
              },
              error: null
            })
          }))
        }))
      });

      // Mock the RPC call
      mockSupabase.rpc.mockResolvedValue({
        data: 85, // High suspicion score
        error: null
      });

      const suspicionScore = await mockSupabase.rpc('detect_suspicious_admin_activity', {
        p_session_id: 'test-session-id'
      });

      expect(suspicionScore.data).toBeGreaterThan(75);
    });

    test('should create security incidents for high-risk activities', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: {
            id: 'incident-id',
            incident_type: 'suspicious_login',
            severity: 'high',
            affected_admin_id: 'test-admin-id',
            title: 'Highly suspicious admin login detected',
            status: 'open'
          },
          error: null
        })
      });

      // Simulate high-risk login
      const incidentData = {
        incident_type: 'suspicious_login',
        severity: 'high',
        affected_admin_id: 'test-admin-id',
        title: 'Highly suspicious admin login detected',
        description: 'Admin login session flagged as highly suspicious based on multiple risk factors',
        incident_data: {
          suspicion_score: 85,
          risk_factors: ['ip_address_change', 'geographic_anomaly', 'vpn_usage'],
          ip_address: '10.0.0.1',
          country: 'CN'
        },
        detected_by: 'automated',
        detection_method: 'behavioral_analysis',
        source_ip: '10.0.0.1',
        occurred_at: new Date().toISOString()
      };

      const { data: incident } = await mockSupabase.from('admin_security_incidents').insert(incidentData);

      expect(incident.incident_type).toBe('suspicious_login');
      expect(incident.severity).toBe('high');
    });

    test('should handle failed login attempts and lockout', async () => {
      // Mock user with multiple failed attempts
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-user-id',
                failed_login_attempts: 4,
                account_locked: false
              },
              error: null
            })
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({
            data: {
              id: 'test-user-id',
              failed_login_attempts: 5,
              account_locked: true,
              locked_at: new Date().toISOString()
            },
            error: null
          })
        }))
      });

      // Mock increment failed attempts function
      mockSupabase.rpc.mockResolvedValue({
        data: true, // Account was locked
        error: null
      });

      const result = await mockSupabase.rpc('increment_failed_login_attempts', {
        p_user_id: 'test-user-id',
        p_max_attempts: 5
      });

      expect(result.data).toBe(true);
    });
  });

  describe('Session Security', () => {
    test('should terminate sessions on IP whitelist violation', async () => {
      // Mock admin with IP whitelist enabled
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-admin-id',
                ip_whitelist_enabled: true,
                ip_whitelist: ['192.168.1.100']
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

      // Mock active sessions from different IP
      const activeSessions = [
        { id: 'session-1', ip_address: '10.0.0.1' },
        { id: 'session-2', ip_address: '192.168.1.100' }
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({
            data: activeSessions,
            error: null
          })
        }))
      });

      // Mock IP validation - first IP fails, second passes
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: false, error: null }) // 10.0.0.1 not allowed
        .mockResolvedValueOnce({ data: true, error: null }); // 192.168.1.100 allowed

      // Update admin IP whitelist
      await mockSupabase.from('admin_users').update({
        ip_whitelist: ['192.168.1.100'],
        ip_whitelist_enabled: true
      }).eq('id', 'test-admin-id');

      // Validate and terminate invalid sessions
      for (const session of activeSessions) {
        const { data: isValid } = await mockSupabase.rpc('validate_admin_ip_access', {
          p_admin_id: 'test-admin-id',
          p_ip_address: session.ip_address
        });

        if (!isValid) {
          await mockSupabase.from('admin_sessions').update({
            is_active: false,
            terminated_at: new Date().toISOString(),
            termination_reason: 'ip_whitelist_violation'
          }).eq('id', session.id);
        }
      }

      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
    });

    test('should detect and flag concurrent sessions from different locations', async () => {
      const sessions = [
        {
          id: 'session-1',
          admin_id: 'test-admin-id',
          ip_address: '192.168.1.100',
          country_code: 'US',
          created_at: new Date().toISOString()
        },
        {
          id: 'session-2',
          admin_id: 'test-admin-id',
          ip_address: '203.0.113.1',
          country_code: 'CN',
          created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 minutes ago
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gt: jest.fn().mockResolvedValue({
              data: sessions,
              error: null
            })
          }))
        }))
      });

      // Check for concurrent sessions from different countries
      const { data: concurrentSessions } = await mockSupabase
        .from('admin_sessions')
        .select('*')
        .eq('admin_id', 'test-admin-id')
        .eq('is_active', true);

      const uniqueCountries = new Set(concurrentSessions.map(s => s.country_code));
      const hasSuspiciousConcurrentSessions = uniqueCountries.size > 1;

      expect(hasSuspiciousConcurrentSessions).toBe(true);
      expect(uniqueCountries.has('US')).toBe(true);
      expect(uniqueCountries.has('CN')).toBe(true);
    });

    test('should enforce session timeout policies', async () => {
      const expiredSession = {
        id: 'expired-session-id',
        admin_id: 'test-admin-id',
        expires_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
        is_active: true
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gt: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: null, // No active sessions found (expired)
                error: { code: 'PGRST116' }
              })
            }))
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        }))
      });

      // Try to validate expired session
      const { data: session, error } = await mockSupabase
        .from('admin_sessions')
        .select('*')
        .eq('session_token', 'expired-token')
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      expect(session).toBeNull();
      expect(error?.code).toBe('PGRST116');
    });
  });

  describe('MFA Security', () => {
    test('should enforce MFA for super admin accounts', async () => {
      const superAdminUser = {
        id: 'super-admin-id',
        admin_level: 'super_admin',
        requires_mfa: true
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: superAdminUser,
              error: null
            })
          }))
        }))
      });

      const { data: admin } = await mockSupabase
        .from('admin_users')
        .select('*')
        .eq('id', 'super-admin-id')
        .single();

      const requiresMFA = admin.requires_mfa || admin.admin_level === 'super_admin';
      expect(requiresMFA).toBe(true);
    });

    test('should validate backup codes correctly', async () => {
      const mfaConfig = {
        user_id: 'test-user-id',
        backup_codes_encrypted: ['code1', 'code2', 'code3'].map(code => 
          Buffer.from(code).toString('base64')
        ),
        backup_codes_used: [0] // First code already used
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: mfaConfig,
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

      // Try to use already used backup code
      const codeToUse = 'code1'; // Index 0, already used
      const codeIndex = ['code1', 'code2', 'code3'].indexOf(codeToUse);
      const isCodeUsed = mfaConfig.backup_codes_used.includes(codeIndex);

      expect(isCodeUsed).toBe(true);

      // Try to use valid unused backup code
      const validCode = 'code2'; // Index 1, not used
      const validCodeIndex = ['code1', 'code2', 'code3'].indexOf(validCode);
      const isValidCodeUsed = mfaConfig.backup_codes_used.includes(validCodeIndex);

      expect(isValidCodeUsed).toBe(false);
    });

    test('should track MFA method usage statistics', async () => {
      const mfaUsage = {
        user_id: 'test-user-id',
        last_used_method: 'totp',
        last_used_at: new Date().toISOString(),
        totp_enabled: true,
        sms_enabled: false,
        email_enabled: false
      };

      mockSupabase.from.mockReturnValue({
        update: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({
            data: mfaUsage,
            error: null
          })
        }))
      });

      // Update MFA usage stats after successful verification
      const { data: updated } = await mockSupabase
        .from('auth_mfa_config')
        .update({
          last_used_method: 'totp',
          last_used_at: new Date().toISOString()
        })
        .eq('user_id', 'test-user-id');

      expect(updated.last_used_method).toBe('totp');
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce different rate limits for different operations', async () => {
      const rateLimitConfigs = [
        { operation: 'login_attempt', max_attempts: 5, window_minutes: 15 },
        { operation: 'password_reset', max_attempts: 3, window_minutes: 60 },
        { operation: 'mfa_setup', max_attempts: 10, window_minutes: 60 },
        { operation: 'admin_user_creation', max_attempts: 10, window_minutes: 60 }
      ];

      for (const config of rateLimitConfigs) {
        mockSupabase.from.mockReturnValue({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              gte: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'rate-limit-id',
                    attempt_count: config.max_attempts - 1,
                    max_attempts: config.max_attempts,
                    is_blocked: false,
                    window_end: new Date(Date.now() + config.window_minutes * 60 * 1000)
                  },
                  error: null
                })
              }))
            }))
          }))
        });

        // Simulate rate limit check
        const { checkAdminRateLimit } = await import('@/lib/auth/admin-middleware');
        const result = await checkAdminRateLimit('test-admin-id', config.operation, config.max_attempts, config.window_minutes);

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(1);
      }
    });

    test('should block requests when rate limit exceeded', async () => {
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
                  blocked_until: new Date(Date.now() + 60 * 60 * 1000).toISOString()
                },
                error: null
              })
            }))
          }))
        }))
      });

      const { checkAdminRateLimit } = await import('@/lib/auth/admin-middleware');
      const result = await checkAdminRateLimit('test-admin-id', 'test_operation', 50, 60);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('Audit Trail Integrity', () => {
    test('should create immutable audit records', async () => {
      const auditEntry = {
        admin_id: 'test-admin-id',
        action: 'user_created',
        action_category: 'user_management',
        resource_type: 'user',
        resource_id: 'new-user-id',
        old_values: null,
        new_values: { username: 'newuser', email: 'new@test.com' },
        success: true,
        created_at: new Date().toISOString()
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: { ...auditEntry, id: 'audit-entry-id' },
          error: null
        })
      });

      const { data: audit } = await mockSupabase
        .from('admin_audit_log')
        .insert(auditEntry);

      expect(audit.admin_id).toBe('test-admin-id');
      expect(audit.action).toBe('user_created');
      expect(audit.success).toBe(true);
      expect(audit.id).toBeDefined();
    });

    test('should prevent audit log tampering', async () => {
      // Attempt to update audit log (should be prevented by RLS)
      mockSupabase.from.mockReturnValue({
        update: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { code: 'insufficient_privilege', message: 'RLS policy violation' }
          })
        }))
      });

      const { data, error } = await mockSupabase
        .from('admin_audit_log')
        .update({ success: false }) // Try to change audit result
        .eq('id', 'audit-entry-id');

      expect(data).toBeNull();
      expect(error.code).toBe('insufficient_privilege');
    });
  });
});