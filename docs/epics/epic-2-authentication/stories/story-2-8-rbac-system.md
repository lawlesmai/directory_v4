# Story 2.8: Role-Based Access Control (RBAC) System

**Epic:** Epic 2 - Authentication & Authorization Layer  
**Story ID:** 2.8  
**Story Points:** 34  
**Priority:** P0 (Critical Security Foundation)  
**Assignee:** Backend Architect Agent  
**Sprint:** 3

## User Story

As a platform administrator, I want a comprehensive role-based access control system so that different user types have appropriate permissions and access levels throughout the platform, ensuring security and proper access management.

## Story Overview

This story implements a comprehensive RBAC system that controls access to resources based on user roles and permissions. It includes role hierarchy, permission inheritance, dynamic permission checking, and efficient access control mechanisms that scale with the platform's needs.

## Detailed Acceptance Criteria

### Role Hierarchy Implementation
- **Given** the need for different user permission levels
- **When** implementing the RBAC system
- **Then** create a comprehensive role structure:

**Role Definitions:**
```
Public (Unauthenticated)
├── View business listings and details
├── Use search and filtering features
├── View reviews and ratings
└── Access basic contact information

User (Authenticated)
├── All Public permissions +
├── Write and manage reviews
├── Create and edit profile
├── Save favorite businesses
├── Claim business ownership
└── Access personalized recommendations

Business Owner (Verified)
├── All User permissions +
├── Manage owned business profiles
├── Respond to reviews
├── Access business analytics
├── Use marketing tools
├── Manage subscription billing
└── Invite team members (multi-location)

Platform Admin (Elevated)
├── All Business Owner permissions +
├── User management and impersonation
├── Business verification and moderation
├── Content management and moderation
├── Platform configuration access
├── Analytics and reporting access
└── System maintenance capabilities
```

### Database Schema for RBAC

```sql
-- Roles table with hierarchy
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  description TEXT,
  parent_role VARCHAR(50) REFERENCES roles(role_name),
  
  -- Role metadata
  role_type VARCHAR(20) CHECK (role_type IN ('system', 'custom', 'dynamic')),
  priority INTEGER DEFAULT 0, -- for conflict resolution
  
  -- Permissions
  can_be_assigned BOOLEAN DEFAULT TRUE,
  requires_mfa BOOLEAN DEFAULT FALSE,
  requires_verification BOOLEAN DEFAULT FALSE,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Status
  active BOOLEAN DEFAULT TRUE
);

-- Core system roles
INSERT INTO roles (role_name, display_name, role_type, priority, requires_mfa, requires_verification) VALUES
  ('super_admin', 'Super Administrator', 'system', 100, TRUE, TRUE),
  ('admin', 'Administrator', 'system', 90, TRUE, TRUE),
  ('moderator', 'Content Moderator', 'system', 80, TRUE, FALSE),
  ('support', 'Customer Support', 'system', 70, FALSE, FALSE),
  ('business_owner', 'Business Owner', 'system', 50, FALSE, TRUE),
  ('verified_user', 'Verified User', 'system', 30, FALSE, FALSE),
  ('user', 'Regular User', 'system', 10, FALSE, FALSE),
  ('guest', 'Guest', 'system', 0, FALSE, FALSE);

-- Permissions table
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permission VARCHAR(100) UNIQUE NOT NULL,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT,
  permission_group VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sample permissions
INSERT INTO permissions (permission, resource, action, permission_group, description) VALUES
  ('businesses.create', 'businesses', 'create', 'business_management', 'Create new business listings'),
  ('businesses.read', 'businesses', 'read', 'business_management', 'View business information'),
  ('businesses.update', 'businesses', 'update', 'business_management', 'Update business information'),
  ('businesses.delete', 'businesses', 'delete', 'business_management', 'Delete business listings'),
  ('businesses.verify', 'businesses', 'verify', 'moderation', 'Verify business authenticity'),
  ('businesses.suspend', 'businesses', 'suspend', 'moderation', 'Suspend business listings'),
  ('reviews.create', 'reviews', 'create', 'content', 'Write reviews'),
  ('reviews.update', 'reviews', 'update', 'content', 'Edit own reviews'),
  ('reviews.delete', 'reviews', 'delete', 'content', 'Delete own reviews'),
  ('reviews.moderate', 'reviews', 'moderate', 'moderation', 'Moderate all reviews'),
  ('users.manage', 'users', 'manage', 'user_management', 'Manage user accounts'),
  ('users.impersonate', 'users', 'impersonate', 'admin', 'Impersonate other users'),
  ('analytics.view', 'analytics', 'view', 'analytics', 'View analytics dashboards'),
  ('analytics.export', 'analytics', 'export', 'analytics', 'Export analytics data'),
  ('payments.manage', 'payments', 'manage', 'financial', 'Manage payment processing'),
  ('system.configure', 'system', 'configure', 'admin', 'Configure system settings');

-- Role-Permission mapping
CREATE TABLE role_permissions (
  role VARCHAR(50) REFERENCES roles(role_name),
  permission_id UUID REFERENCES permissions(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id),
  conditions JSONB DEFAULT '{}',
  PRIMARY KEY (role, permission_id)
);

-- User-Role assignments
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  role VARCHAR(50) REFERENCES roles(role_name),
  
  -- Scoped roles (e.g., admin of specific business)
  scope_type VARCHAR(50), -- 'global', 'business', 'category'
  scope_id UUID, -- ID of the scoped resource
  
  -- Assignment metadata
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  -- Assignment reason/notes
  assignment_reason TEXT,
  assignment_metadata JSONB DEFAULT '{}',
  
  -- Status
  active BOOLEAN DEFAULT TRUE,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  revoke_reason TEXT,
  
  UNIQUE(user_id, role, scope_type, scope_id)
);
```

### Permission System Implementation

```sql
-- Dynamic permission checks
CREATE OR REPLACE FUNCTION check_permission(
  user_uuid UUID,
  required_permission VARCHAR,
  resource_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  has_permission BOOLEAN;
BEGIN
  -- Check global permissions
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role = rp.role
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = user_uuid
    AND p.permission = required_permission
    AND ur.active = TRUE
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    AND (ur.scope_type = 'global' OR ur.scope_type IS NULL)
  ) INTO has_permission;
  
  IF has_permission THEN
    RETURN TRUE;
  END IF;
  
  -- Check scoped permissions
  IF resource_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN role_permissions rp ON ur.role = rp.role
      JOIN permissions p ON rp.permission_id = p.id
      WHERE ur.user_id = user_uuid
      AND p.permission = required_permission
      AND ur.active = TRUE
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      AND ur.scope_type IS NOT NULL
      AND ur.scope_id = resource_id
    ) INTO has_permission;
  END IF;
  
  RETURN COALESCE(has_permission, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Role hierarchy with inheritance
CREATE OR REPLACE FUNCTION get_inherited_permissions(role_name VARCHAR)
RETURNS TABLE(permission VARCHAR) AS $$
WITH RECURSIVE role_tree AS (
  -- Start with the given role
  SELECT role_name as current_role, parent_role
  FROM roles
  WHERE role_name = $1
  
  UNION ALL
  
  -- Recursively get parent roles
  SELECT r.role_name, r.parent_role
  FROM roles r
  JOIN role_tree rt ON r.role_name = rt.parent_role
)
SELECT DISTINCT p.permission
FROM role_tree rt
JOIN role_permissions rp ON rt.current_role = rp.role
JOIN permissions p ON rp.permission_id = p.id;
$$ LANGUAGE sql;

-- Effective permissions for a user
CREATE OR REPLACE FUNCTION get_user_permissions(user_uuid UUID)
RETURNS TABLE(
  permission VARCHAR,
  resource VARCHAR,
  action VARCHAR,
  scope_type VARCHAR,
  scope_id UUID
) AS $$
SELECT DISTINCT
  p.permission,
  p.resource,
  p.action,
  ur.scope_type,
  ur.scope_id
FROM user_roles ur
CROSS JOIN LATERAL get_inherited_permissions(ur.role) AS inherited(permission)
JOIN permissions p ON inherited.permission = p.permission
WHERE ur.user_id = user_uuid
AND ur.active = TRUE
AND (ur.expires_at IS NULL OR ur.expires_at > NOW());
$$ LANGUAGE sql;
```

### Frontend Permission Integration

```typescript
// hooks/usePermissions.ts
export const usePermissions = () => {
  const { user } = useAuth()
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadUserPermissions()
    } else {
      setPermissions([])
      setLoading(false)
    }
  }, [user])

  const loadUserPermissions = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_user_permissions', { user_uuid: user.id })
      
      if (error) throw error
      
      setPermissions(data || [])
    } catch (error) {
      console.error('Error loading permissions:', error)
      setPermissions([])
    } finally {
      setLoading(false)
    }
  }

  const hasPermission = useCallback((permission: string, resourceId?: string) => {
    if (loading) return false
    
    return permissions.some(p => {
      if (p.permission !== permission) return false
      
      // Global permission
      if (!p.scope_type || p.scope_type === 'global') return true
      
      // Scoped permission
      if (resourceId && p.scope_id === resourceId) return true
      
      return false
    })
  }, [permissions, loading])

  const hasAnyPermission = useCallback((permissionList: string[]) => {
    return permissionList.some(permission => hasPermission(permission))
  }, [hasPermission])

  const hasAllPermissions = useCallback((permissionList: string[]) => {
    return permissionList.every(permission => hasPermission(permission))
  }, [hasPermission])

  const getResourcePermissions = useCallback((resourceType: string) => {
    return permissions.filter(p => p.resource === resourceType)
  }, [permissions])

  return {
    permissions,
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    getResourcePermissions
  }
}

// Permission Guard Component
interface PermissionGuardProps {
  permission: string | string[]
  resourceId?: string
  fallback?: React.ReactNode
  children: React.ReactNode
  requireAll?: boolean
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  resourceId,
  fallback = null,
  children,
  requireAll = false
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading } = usePermissions()

  if (loading) {
    return <LoadingSpinner size="sm" />
  }

  const permissions = Array.isArray(permission) ? permission : [permission]
  
  let hasAccess = false
  
  if (Array.isArray(permission)) {
    hasAccess = requireAll 
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions)
  } else {
    hasAccess = hasPermission(permission, resourceId)
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>
}
```

### Role Management Interface

```typescript
// components/admin/RoleManagement.tsx
export const RoleManagement: React.FC = () => {
  const [users, setUsers] = useState<UserWithRoles[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null)
  const [isAssigning, setIsAssigning] = useState(false)

  const assignRole = async (userId: string, roleName: string, scopeType?: string, scopeId?: string) => {
    setIsAssigning(true)
    
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: roleName,
          scope_type: scopeType || 'global',
          scope_id: scopeId,
          assigned_by: user.id,
          assignment_reason: 'Admin assignment'
        })
      
      if (error) throw error
      
      toast.success('Role assigned successfully')
      await loadUsers()
    } catch (error) {
      console.error('Error assigning role:', error)
      toast.error('Failed to assign role')
    } finally {
      setIsAssigning(false)
    }
  }

  const revokeRole = async (userRoleId: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({
          active: false,
          revoked_at: new Date().toISOString(),
          revoked_by: user.id,
          revoke_reason: 'Admin revocation'
        })
        .eq('id', userRoleId)
      
      if (error) throw error
      
      toast.success('Role revoked successfully')
      await loadUsers()
    } catch (error) {
      console.error('Error revoking role:', error)
      toast.error('Failed to revoke role')
    }
  }

  return (
    <PermissionGuard permission="users.manage">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-heading text-cream">Role Management</h2>
          <button
            onClick={() => setSelectedUser(null)}
            className="px-4 py-2 bg-teal-primary hover:bg-teal-secondary text-cream rounded-lg"
          >
            Assign Role
          </button>
        </div>

        <GlassMorphism variant="medium" className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-sage/20">
                  <th className="text-left py-3 text-cream">User</th>
                  <th className="text-left py-3 text-cream">Roles</th>
                  <th className="text-left py-3 text-cream">Scope</th>
                  <th className="text-left py-3 text-cream">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-sage/10">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <Avatar src={user.avatar} size="sm" />
                        <div>
                          <div className="text-cream font-medium">{user.name}</div>
                          <div className="text-sage/70 text-sm">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex flex-wrap gap-2">
                        {user.roles.map((role) => (
                          <span
                            key={role.id}
                            className="px-2 py-1 bg-teal-primary/20 text-teal-primary rounded text-sm"
                          >
                            {role.display_name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="text-sage/70 text-sm">
                        {user.roles.map(role => 
                          role.scope_type !== 'global' ? `${role.scope_type}: ${role.scope_id}` : 'Global'
                        ).join(', ')}
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="px-3 py-1 bg-teal-primary/20 hover:bg-teal-primary/30 text-teal-primary rounded text-sm"
                        >
                          Manage
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassMorphism>
      </div>
    </PermissionGuard>
  )
}
```

## Technical Implementation Notes

### Database-Level Security
- Row Level Security policies for all permission-based access
- Efficient permission lookup with proper indexing
- Permission caching for frequently checked permissions
- Audit logging for all permission changes

### Application-Level Integration
- Middleware-based permission checking for API routes
- Component-level permission guards for UI elements
- Hook-based permission checking for React components
- Server action permission validation

### Performance Optimization
- Permission result caching with Redis (if needed)
- Efficient database queries for permission checks
- Lazy loading of permissions when not immediately needed
- Background permission synchronization

## Dependencies
- Story 2.1 (Database foundation and RLS)
- Story 2.2 (Server components and middleware)
- User management system
- Business management system

## Testing Requirements

### Permission Logic Tests
- All role permission combinations tested
- Resource-specific permission validation
- Permission inheritance testing
- Edge case permission scenarios

### Security Tests
- Permission bypass attempt testing
- Privilege escalation prevention tests
- Resource access boundary validation
- Admin impersonation security tests

### Performance Tests
- Permission check response time validation
- Database query optimization for permissions
- Cache effectiveness testing
- Large-scale permission testing

## Definition of Done

### RBAC Implementation
- [ ] Complete role hierarchy implemented and tested
- [ ] Granular permission system operational
- [ ] Database schema optimized for permission checking
- [ ] Permission inheritance working correctly
- [ ] Dynamic permission checking functions operational

### Security & Access Control
- [ ] All API endpoints protected with appropriate permissions
- [ ] UI components respect role-based visibility
- [ ] Resource-level access control implemented
- [ ] Scoped permission system functional
- [ ] Permission escalation prevention validated

### Performance & Scalability
- [ ] Permission caching system implemented
- [ ] Database queries optimized for large user bases
- [ ] Permission check response time < 10ms (P95)
- [ ] Efficient permission synchronization
- [ ] Scalable role assignment system

### Management Interface
- [ ] Role management interface for administrators
- [ ] User role assignment and revocation system
- [ ] Permission audit trail and logging
- [ ] Bulk role management capabilities
- [ ] Role conflict resolution mechanisms

### Testing & Validation
- [ ] Comprehensive security testing passed
- [ ] Performance benchmarks met for permission checks
- [ ] All permission scenarios tested
- [ ] Integration testing with business logic
- [ ] Load testing for concurrent permission checks

### Documentation
- [ ] RBAC system documentation complete
- [ ] Permission reference guide created
- [ ] Role management procedures documented
- [ ] Security best practices guide
- [ ] API documentation for permission checking

## Acceptance Validation

### Security Validation
- [ ] No permission bypass possible through any method
- [ ] All resource access properly controlled
- [ ] Role inheritance working without conflicts
- [ ] Scoped permissions enforced correctly
- [ ] Admin permissions properly isolated

### Performance Validation
- [ ] Permission checks complete in < 10ms (P95)
- [ ] Database queries optimized for permission lookups
- [ ] Cache hit rate > 90% for frequent permission checks
- [ ] Role assignment operations < 100ms
- [ ] Bulk operations scale efficiently

### Usability Validation
- [ ] Role management interface intuitive for administrators
- [ ] Permission errors provide clear guidance
- [ ] Role conflicts resolved automatically
- [ ] Audit trail provides sufficient detail
- [ ] User experience unaffected by permission checks

## Risk Assessment

**High Risk:** Complex permission logic may impact performance
- *Mitigation:* Comprehensive performance testing and query optimization

**Medium Risk:** Permission checking consistency across application
- *Mitigation:* Centralized permission checking and extensive testing

**Medium Risk:** Role hierarchy conflicts and inheritance issues
- *Mitigation:* Clear role hierarchy rules and conflict resolution mechanisms

**Low Risk:** Permission management UI complexity
- *Mitigation:* User testing and iterative interface improvements

## Success Metrics

- **Security:** Zero permission bypass vulnerabilities
- **Performance:** Permission checks < 10ms (P95)
- **Scalability:** System supports 100,000+ users efficiently
- **Usability:** Role management completion rate > 95%
- **Reliability:** Permission accuracy 100% across all resources

This story establishes a comprehensive RBAC system that provides granular, secure, and scalable access control throughout The Lawless Directory platform while maintaining high performance and administrative flexibility.