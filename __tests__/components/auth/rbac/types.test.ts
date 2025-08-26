import type {
  UserRole,
  Permission,
  RoleDefinition,
  PermissionDefinition,
  BusinessContext,
  UserRoleAssignment,
  RBACEvent,
  RBACAnalytics,
  RBACValidationResult,
  BulkOperationResult,
  RBACError
} from '@/components/auth/rbac/types';

describe('RBAC Types', () => {
  describe('UserRole', () => {
    test('includes all expected roles', () => {
      const validRoles: UserRole[] = [
        'customer',
        'business_owner',
        'service_provider',
        'moderator',
        'admin',
        'super_admin'
      ];

      validRoles.forEach(role => {
        expect(typeof role).toBe('string');
      });
    });
  });

  describe('Permission', () => {
    test('follows resource:action pattern', () => {
      const validPermissions: Permission[] = [
        'read:businesses',
        'write:businesses',
        'delete:businesses',
        'manage:system',
        'audit:logs'
      ];

      validPermissions.forEach(permission => {
        expect(permission).toMatch(/^[a-z_]+:[a-z_]+$/);
      });
    });
  });

  describe('RoleDefinition', () => {
    test('creates valid role definition', () => {
      const mockBusinessContext: BusinessContext = {
        id: 'ctx-1',
        name: 'Test Context',
        type: 'global',
        isActive: true
      };

      const roleDefinition: RoleDefinition = {
        id: 'role-1',
        name: 'admin',
        displayName: 'Administrator',
        description: 'System administrator role',
        level: 90,
        permissions: ['manage:system', 'read:businesses'],
        inheritedPermissions: [],
        contexts: [mockBusinessContext],
        isSystemRole: true,
        isActive: true,
        metadata: {
          color: 'red',
          icon: 'crown',
          category: 'system'
        },
        constraints: {
          requiresApproval: true
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system'
      };

      expect(roleDefinition.id).toBe('role-1');
      expect(roleDefinition.name).toBe('admin');
      expect(roleDefinition.level).toBe(90);
      expect(roleDefinition.permissions).toContain('manage:system');
      expect(roleDefinition.isSystemRole).toBe(true);
      expect(roleDefinition.metadata.category).toBe('system');
    });

    test('supports role hierarchy', () => {
      const parentRole: RoleDefinition = {
        id: 'parent-role',
        name: 'admin',
        displayName: 'Admin',
        description: 'Parent role',
        level: 80,
        permissions: ['manage:users'],
        inheritedPermissions: [],
        contexts: [],
        isSystemRole: false,
        isActive: true,
        metadata: { color: 'blue', icon: 'shield', category: 'system' },
        constraints: { requiresApproval: false },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system'
      };

      const childRole: RoleDefinition = {
        ...parentRole,
        id: 'child-role',
        name: 'moderator',
        displayName: 'Moderator',
        level: 60,
        parentRole: 'parent-role',
        inheritedPermissions: ['manage:users'],
        permissions: ['moderate:content']
      };

      expect(childRole.parentRole).toBe('parent-role');
      expect(childRole.inheritedPermissions).toContain('manage:users');
      expect(childRole.level).toBeLessThan(parentRole.level);
    });
  });

  describe('PermissionDefinition', () => {
    test('creates valid permission definition', () => {
      const mockContext: BusinessContext = {
        id: 'ctx-1',
        name: 'Test Context',
        type: 'business',
        isActive: true
      };

      const permissionDefinition: PermissionDefinition = {
        id: 'perm-1',
        name: 'read:businesses',
        displayName: 'Read Businesses',
        description: 'Allows reading business information',
        resource: 'business',
        action: 'read',
        category: 'Basic Operations',
        riskLevel: 'low',
        contexts: [mockContext],
        isSystemPermission: false,
        metadata: {
          icon: 'building',
          color: 'green'
        },
        auditRequired: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(permissionDefinition.name).toBe('read:businesses');
      expect(permissionDefinition.resource).toBe('business');
      expect(permissionDefinition.action).toBe('read');
      expect(permissionDefinition.riskLevel).toBe('low');
    });

    test('supports dependencies and conflicts', () => {
      const permission: PermissionDefinition = {
        id: 'perm-advanced',
        name: 'delete:businesses',
        displayName: 'Delete Businesses',
        description: 'Delete business records',
        resource: 'business',
        action: 'delete',
        category: 'Advanced',
        riskLevel: 'critical',
        dependencies: ['read:businesses', 'write:businesses'],
        conflicts: ['read_only:businesses'],
        contexts: [],
        isSystemPermission: false,
        metadata: { icon: 'trash', color: 'red' },
        auditRequired: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(permission.dependencies).toContain('read:businesses');
      expect(permission.conflicts).toContain('read_only:businesses');
      expect(permission.riskLevel).toBe('critical');
      expect(permission.auditRequired).toBe(true);
    });
  });

  describe('BusinessContext', () => {
    test('creates valid business contexts', () => {
      const globalContext: BusinessContext = {
        id: 'global',
        name: 'Global Context',
        type: 'global',
        isActive: true
      };

      const businessContext: BusinessContext = {
        id: 'business-1',
        name: 'Business Store',
        type: 'business',
        businessId: 'biz-123',
        parentContext: 'global',
        isActive: true
      };

      expect(globalContext.type).toBe('global');
      expect(businessContext.businessId).toBe('biz-123');
      expect(businessContext.parentContext).toBe('global');
    });
  });

  describe('UserRoleAssignment', () => {
    test('creates valid role assignment', () => {
      const assignment: UserRoleAssignment = {
        id: 'assignment-1',
        userId: 'user-123',
        roleId: 'role-456',
        businessContext: {
          id: 'ctx-1',
          name: 'Test Context',
          type: 'business',
          isActive: true
        },
        assignedBy: 'admin-user',
        assignedAt: new Date(),
        isActive: true,
        metadata: {
          source: 'manual',
          approvedBy: 'admin-user',
          approvedAt: new Date()
        }
      };

      expect(assignment.userId).toBe('user-123');
      expect(assignment.roleId).toBe('role-456');
      expect(assignment.isActive).toBe(true);
      expect(assignment.metadata.source).toBe('manual');
    });

    test('supports expiry and reasons', () => {
      const temporaryAssignment: UserRoleAssignment = {
        id: 'temp-assignment',
        userId: 'user-123',
        roleId: 'temp-role',
        businessContext: {
          id: 'ctx-1',
          name: 'Temp Context',
          type: 'business',
          isActive: true
        },
        assignedBy: 'admin',
        assignedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        isActive: true,
        reason: 'Temporary project assignment',
        metadata: {
          source: 'system'
        }
      };

      expect(temporaryAssignment.expiresAt).toBeInstanceOf(Date);
      expect(temporaryAssignment.reason).toBe('Temporary project assignment');
    });
  });

  describe('RBACEvent', () => {
    test('creates valid audit event', () => {
      const event: RBACEvent = {
        id: 'event-1',
        eventType: 'role_assigned',
        userId: 'admin-user',
        targetUserId: 'target-user',
        resourceId: 'role-123',
        resourceType: 'role',
        details: {
          reason: 'User promotion',
          oldValue: null,
          newValue: { roleId: 'role-123', active: true }
        },
        metadata: {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
          sessionId: 'session-123'
        },
        riskScore: 45,
        timestamp: new Date()
      };

      expect(event.eventType).toBe('role_assigned');
      expect(event.riskScore).toBe(45);
      expect(event.details.reason).toBe('User promotion');
      expect(event.metadata.ipAddress).toBe('192.168.1.1');
    });

    test('supports different event types', () => {
      const eventTypes = [
        'role_assigned',
        'role_revoked',
        'permission_granted',
        'permission_revoked',
        'role_created',
        'role_updated',
        'role_deleted',
        'permission_test',
        'bulk_operation',
        'security_violation'
      ] as const;

      eventTypes.forEach(eventType => {
        const event: RBACEvent = {
          id: `event-${eventType}`,
          eventType,
          userId: 'user-1',
          resourceId: 'resource-1',
          resourceType: 'role',
          details: {},
          metadata: {
            ipAddress: '127.0.0.1',
            userAgent: 'test',
            sessionId: 'session'
          },
          riskScore: 0,
          timestamp: new Date()
        };

        expect(event.eventType).toBe(eventType);
      });
    });
  });

  describe('RBACAnalytics', () => {
    test('creates valid analytics object', () => {
      const analytics: RBACAnalytics = {
        userCount: {
          total: 1000,
          byRole: {
            customer: 800,
            business_owner: 150,
            admin: 50
          },
          active: 950,
          inactive: 50
        },
        roleUsage: {
          mostUsed: [
            { roleId: 'role-customer', count: 800 },
            { roleId: 'role-business', count: 150 }
          ],
          leastUsed: [
            { roleId: 'role-admin', count: 50 }
          ],
          trending: [
            { roleId: 'role-business', change: 15 }
          ]
        },
        permissionUsage: {
          mostGranted: [
            { permission: 'read:businesses', count: 1000 }
          ],
          riskiest: [
            { permission: 'manage:system', riskScore: 95 }
          ]
        },
        violations: {
          count: 25,
          recent: [],
          trends: [
            { date: '2024-01-01', count: 10 },
            { date: '2024-01-02', count: 15 }
          ]
        },
        compliance: {
          score: 88,
          issues: [
            { type: 'orphaned_permission', count: 5, severity: 'low' },
            { type: 'excessive_privileges', count: 2, severity: 'high' }
          ]
        }
      };

      expect(analytics.userCount.total).toBe(1000);
      expect(analytics.compliance.score).toBe(88);
      expect(analytics.violations.count).toBe(25);
      expect(analytics.roleUsage.mostUsed).toHaveLength(2);
    });
  });

  describe('RBACError', () => {
    test('creates valid error objects', () => {
      const validationError: RBACError = {
        type: 'validation',
        message: 'Invalid role configuration',
        code: 'INVALID_ROLE',
        details: { field: 'permissions', value: null }
      };

      const systemError: RBACError = {
        type: 'system',
        message: 'Database connection failed'
      };

      expect(validationError.type).toBe('validation');
      expect(validationError.code).toBe('INVALID_ROLE');
      expect(systemError.type).toBe('system');
      expect(systemError.details).toBeUndefined();
    });
  });

  describe('RBACValidationResult', () => {
    test('creates valid validation results', () => {
      const validResult: RBACValidationResult = {
        valid: true,
        errors: [],
        warnings: []
      };

      const invalidResult: RBACValidationResult = {
        valid: false,
        errors: [
          { type: 'validation', message: 'Missing required field' }
        ],
        warnings: [
          { type: 'security', message: 'High risk permission', severity: 'medium' }
        ]
      };

      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toHaveLength(1);
      expect(invalidResult.warnings).toHaveLength(1);
    });
  });

  describe('BulkOperationResult', () => {
    test('creates valid bulk operation results', () => {
      const mockRoles = [
        { id: 'role-1', name: 'admin' },
        { id: 'role-2', name: 'user' },
        { id: 'role-3', name: 'guest' }
      ];

      const result: BulkOperationResult<typeof mockRoles[0]> = {
        successful: [mockRoles[0], mockRoles[1]],
        failed: [
          {
            item: mockRoles[2],
            error: { type: 'validation', message: 'Invalid role name' }
          }
        ],
        summary: {
          total: 3,
          successful: 2,
          failed: 1
        }
      };

      expect(result.summary.total).toBe(3);
      expect(result.summary.successful).toBe(2);
      expect(result.summary.failed).toBe(1);
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
    });
  });

  describe('Type Constraints', () => {
    test('enforces proper role hierarchy levels', () => {
      const roles = [
        { name: 'customer', level: 10 },
        { name: 'business_owner', level: 30 },
        { name: 'admin', level: 80 },
        { name: 'super_admin', level: 100 }
      ];

      roles.forEach((role, index) => {
        if (index > 0) {
          expect(role.level).toBeGreaterThan(roles[index - 1].level);
        }
      });
    });

    test('validates permission naming convention', () => {
      const validPermissions = [
        'read:businesses',
        'write:users',
        'delete:reviews',
        'manage:system'
      ];

      const invalidPermissions = [
        'readBusinesses',      // No colon
        'read_businesses',     // Underscore instead of colon
        'read:',              // Missing action
        ':businesses'         // Missing resource
      ];

      validPermissions.forEach(permission => {
        expect(permission).toMatch(/^[a-z_]+:[a-z_]+$/);
      });

      invalidPermissions.forEach(permission => {
        expect(permission).not.toMatch(/^[a-z_]+:[a-z_]+$/);
      });
    });

    test('validates risk levels', () => {
      const validRiskLevels = ['low', 'medium', 'high', 'critical'];
      
      validRiskLevels.forEach(level => {
        expect(['low', 'medium', 'high', 'critical']).toContain(level);
      });
    });

    test('validates business context types', () => {
      const validContextTypes = ['global', 'business', 'location', 'department'];
      
      validContextTypes.forEach(type => {
        expect(['global', 'business', 'location', 'department']).toContain(type);
      });
    });
  });

  describe('Complex Scenarios', () => {
    test('role inheritance chain', () => {
      const superAdminRole: RoleDefinition = {
        id: 'super-admin',
        name: 'super_admin',
        displayName: 'Super Admin',
        description: 'Ultimate access',
        level: 100,
        permissions: ['manage:system'],
        inheritedPermissions: [],
        contexts: [],
        isSystemRole: true,
        isActive: true,
        metadata: { color: 'red', icon: 'crown', category: 'system' },
        constraints: { requiresApproval: false },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system'
      };

      const adminRole: RoleDefinition = {
        ...superAdminRole,
        id: 'admin',
        name: 'admin',
        displayName: 'Admin',
        level: 80,
        parentRole: 'super-admin',
        permissions: ['manage:users'],
        inheritedPermissions: ['manage:system']
      };

      const moderatorRole: RoleDefinition = {
        ...adminRole,
        id: 'moderator',
        name: 'moderator',
        displayName: 'Moderator',
        level: 60,
        parentRole: 'admin',
        permissions: ['moderate:content'],
        inheritedPermissions: ['manage:system', 'manage:users']
      };

      // Verify inheritance chain
      expect(moderatorRole.parentRole).toBe('admin');
      expect(adminRole.parentRole).toBe('super-admin');
      expect(superAdminRole.parentRole).toBeUndefined();

      // Verify permission inheritance
      expect(moderatorRole.inheritedPermissions).toContain('manage:system');
      expect(moderatorRole.inheritedPermissions).toContain('manage:users');
      expect(adminRole.inheritedPermissions).toContain('manage:system');
    });

    test('permission dependency resolution', () => {
      const readPerm: PermissionDefinition = {
        id: 'read-perm',
        name: 'read:businesses',
        displayName: 'Read',
        description: 'Read access',
        resource: 'business',
        action: 'read',
        category: 'basic',
        riskLevel: 'low',
        contexts: [],
        isSystemPermission: false,
        metadata: { icon: 'eye', color: 'green' },
        auditRequired: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const writePerm: PermissionDefinition = {
        ...readPerm,
        id: 'write-perm',
        name: 'write:businesses',
        displayName: 'Write',
        action: 'update',
        riskLevel: 'medium',
        dependencies: ['read:businesses']
      };

      const deletePerm: PermissionDefinition = {
        ...writePerm,
        id: 'delete-perm',
        name: 'delete:businesses',
        displayName: 'Delete',
        action: 'delete',
        riskLevel: 'critical',
        dependencies: ['read:businesses', 'write:businesses']
      };

      // Verify dependency chain
      expect(deletePerm.dependencies).toContain('read:businesses');
      expect(deletePerm.dependencies).toContain('write:businesses');
      expect(writePerm.dependencies).toContain('read:businesses');
      expect(readPerm.dependencies).toBeUndefined();
    });
  });
});