# Frontend Epic 4: Admin Interface & Management Tools - Comprehensive Implementation Stories

**Date:** 2024-08-23  
**Epic Lead:** Frontend Developer Agent  
**Priority:** P1 (Platform Operations Excellence)  
**Duration:** 4 Sprints (12 weeks)  
**Story Points Total:** 156 points

## Epic Mission Statement

Create a sophisticated administrative interface that empowers platform administrators to efficiently manage users, businesses, content moderation, system health, and platform operations. The interface should provide comprehensive oversight capabilities while maintaining security, usability, and performance standards that enable effective platform governance.

## Admin Interface Architecture Context

**Administrative Requirements:**
- Comprehensive user and business management capabilities
- Advanced content moderation and verification workflows
- Real-time system monitoring and health dashboards
- Customer support integration with ticketing system
- Platform configuration and settings management
- Security monitoring and audit trail systems
- Analytics and reporting for platform-wide metrics

**Security Considerations:**
- Role-based access control with granular permissions
- Multi-factor authentication for admin access
- Audit logging for all administrative actions
- Secure user impersonation with strict controls
- Data encryption for sensitive operations
- Session management with automatic timeouts

**Technical Architecture:**
- Isolated admin interface with separate routing
- Advanced data tables with server-side processing
- Real-time dashboards with WebSocket connections
- Bulk operation capabilities with progress tracking
- Export/import functionality for data management
- Advanced search and filtering across all entities

**Performance Targets:**
- Admin dashboard load time < 2s
- User management operations < 500ms
- Bulk operations progress feedback < 100ms
- System monitoring updates < 200ms
- Search operations < 300ms
- Report generation < 5s

---

## Story F4.1: Admin Dashboard Foundation & Navigation Architecture

**User Story:** As a frontend developer, I want to create a secure admin dashboard foundation with comprehensive navigation, access control, and audit logging that provides administrators with efficient platform oversight capabilities.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 20  
**Sprint:** 1

### Detailed Acceptance Criteria

**Admin Dashboard Layout:**
- **Given** administrative interface requirements
- **When** implementing admin dashboard foundation
- **Then** create:

```typescript
// components/admin/AdminLayout.tsx
interface AdminLayoutProps {
  children: React.ReactNode
  user: AdminUser
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, user }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { permissions, hasPermission } = useAdminPermissions(user)
  const { notifications, markAsRead } = useAdminNotifications()
  const router = useRouter()
  
  // Security: Auto-logout on inactivity
  useIdleTimer({
    timeout: 30 * 60 * 1000, // 30 minutes
    onIdle: () => {
      toast.warning('Session expired due to inactivity')
      router.push('/admin/login')
    }
  })

  // Audit logging for page navigation
  useEffect(() => {
    auditLogger.log('admin_page_access', {
      userId: user.id,
      page: router.pathname,
      timestamp: new Date().toISOString()
    })
  }, [router.pathname, user.id])

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-dark via-red-critical/5 to-navy-dark">
      {/* Security Banner */}
      <AdminSecurityBanner />
      
      <div className="flex h-screen">
        {/* Admin Sidebar */}
        <motion.aside
          animate={{ width: sidebarCollapsed ? 64 : 280 }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="relative flex flex-col bg-red-critical/90 backdrop-blur-xl border-r border-red-error/20"
        >
          <AdminSidebar
            collapsed={sidebarCollapsed}
            user={user}
            permissions={permissions}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </motion.aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Admin Header */}
          <AdminHeader
            user={user}
            notifications={notifications}
            onNotificationClick={markAsRead}
          />

          {/* Content */}
          <main className="flex-1 overflow-auto bg-navy-dark/50">
            <div className="h-full">
              <ErrorBoundary>
                <Suspense fallback={<AdminPageSkeleton />}>
                  {children}
                </Suspense>
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </div>

      {/* System Status Indicator */}
      <SystemStatusIndicator />
      
      {/* Emergency Actions Panel */}
      <EmergencyActionsPanel user={user} />
    </div>
  )
}

// Admin Sidebar with Security-First Design
const AdminSidebar: React.FC<AdminSidebarProps> = ({
  collapsed,
  user,
  permissions,
  onToggleCollapse
}) => {
  const pathname = usePathname()
  
  const adminNavigation: AdminNavigationItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      href: '/admin/dashboard',
      permission: 'admin.dashboard.view'
    },
    {
      id: 'users',
      label: 'User Management',
      icon: Users,
      href: '/admin/users',
      permission: 'admin.users.view',
      badge: user.pendingUserActions || 0
    },
    {
      id: 'businesses',
      label: 'Business Management',
      icon: Building,
      href: '/admin/businesses',
      permission: 'admin.businesses.view',
      badge: user.pendingBusinessActions || 0
    },
    {
      id: 'moderation',
      label: 'Content Moderation',
      icon: Shield,
      href: '/admin/moderation',
      permission: 'admin.moderation.view',
      badge: user.pendingModerationItems || 0,
      urgent: (user.pendingModerationItems || 0) > 0
    },
    {
      id: 'verification',
      label: 'Business Verification',
      icon: CheckCircle,
      href: '/admin/verification',
      permission: 'admin.verification.view',
      badge: user.pendingVerifications || 0
    },
    {
      id: 'support',
      label: 'Customer Support',
      icon: Headphones,
      href: '/admin/support',
      permission: 'admin.support.view',
      badge: user.openTickets || 0
    },
    {
      id: 'analytics',
      label: 'Platform Analytics',
      icon: BarChart3,
      href: '/admin/analytics',
      permission: 'admin.analytics.view'
    },
    {
      id: 'security',
      label: 'Security & Audit',
      icon: Lock,
      href: '/admin/security',
      permission: 'admin.security.view',
      children: [
        {
          id: 'audit-logs',
          label: 'Audit Logs',
          icon: FileText,
          href: '/admin/security/audit',
          permission: 'admin.audit.view'
        },
        {
          id: 'security-monitoring',
          label: 'Security Monitoring',
          icon: Eye,
          href: '/admin/security/monitoring',
          permission: 'admin.security.monitor'
        }
      ]
    },
    {
      id: 'system',
      label: 'System Management',
      icon: Server,
      href: '/admin/system',
      permission: 'admin.system.view',
      children: [
        {
          id: 'system-health',
          label: 'System Health',
          icon: Heart,
          href: '/admin/system/health',
          permission: 'admin.system.health'
        },
        {
          id: 'configuration',
          label: 'Configuration',
          icon: Settings,
          href: '/admin/system/config',
          permission: 'admin.system.config'
        }
      ]
    }
  ]

  const renderNavigationItem = (item: AdminNavigationItem, level = 0) => {
    if (!hasPermission(item.permission)) return null

    const isActive = pathname === item.href
    const hasChildren = item.children && item.children.length > 0
    const Icon = item.icon

    return (
      <div key={item.id}>
        <Tooltip content={item.label} disabled={!collapsed} side="right">
          <div
            className={cn(
              'group relative flex items-center gap-3 rounded-lg transition-all duration-200',
              level === 0 ? 'px-3 py-2.5 mx-2' : 'px-3 py-2 mx-2 ml-6',
              isActive && 'bg-red-error/20 text-red-error border border-red-error/30',
              !isActive && 'text-cream/80 hover:bg-red-error/10 hover:text-cream'
            )}
          >
            {item.href ? (
              <Link href={item.href} className="flex items-center gap-3 flex-1 min-w-0">
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && (
                  <span className="font-medium truncate">{item.label}</span>
                )}
              </Link>
            ) : (
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && (
                  <span className="font-medium truncate">{item.label}</span>
                )}
              </div>
            )}

            {/* Notification Badges */}
            {!collapsed && item.badge && item.badge > 0 && (
              <span className={cn(
                'flex items-center justify-center min-w-[20px] h-5 text-xs rounded-full px-1.5 font-medium',
                item.urgent 
                  ? 'bg-red-error text-cream animate-pulse' 
                  : 'bg-gold-primary text-navy-dark'
              )}>
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </div>
        </Tooltip>

        {/* Children Navigation */}
        {!collapsed && hasChildren && (
          <div className="mt-1 space-y-1">
            {item.children!.map(child => renderNavigationItem(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className={cn(
        'flex items-center gap-3 p-4 border-b border-red-error/20',
        collapsed && 'justify-center px-2'
      )}>
        {!collapsed && (
          <>
            <div className="w-8 h-8 bg-red-error rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-cream" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-heading font-semibold text-cream truncate">
                Admin Portal
              </h2>
              <p className="text-xs text-cream/60 truncate">
                Platform Management
              </p>
            </div>
          </>
        )}
        
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg hover:bg-red-error/20 transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelRightOpen className="w-5 h-5 text-cream/70" />
          ) : (
            <PanelRightClose className="w-5 h-5 text-cream/70" />
          )}
        </button>
      </div>

      {/* User Info */}
      {!collapsed && (
        <div className="p-4 border-b border-red-error/20">
          <div className="flex items-center gap-3">
            <Avatar
              src={user.avatar}
              alt={user.name}
              size="sm"
              fallback={user.name.charAt(0)}
              className="border-2 border-red-error/30"
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-cream truncate">{user.name}</p>
              <p className="text-xs text-cream/60 truncate">{user.role}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {adminNavigation.map(item => renderNavigationItem(item))}
      </nav>

      {/* Emergency Contact */}
      {!collapsed && (
        <div className="p-4 border-t border-red-error/20">
          <EmergencyContactCard />
        </div>
      )}
    </>
  )
}
```

**Admin Security Banner:**
- **Given** security awareness requirements
- **When** implementing security banner
- **Then** create:

```typescript
// components/admin/AdminSecurityBanner.tsx
export const AdminSecurityBanner: React.FC = () => {
  const { securityStatus, lastSecurityCheck } = useAdminSecurity()
  const [isDismissed, setIsDismissed] = useState(false)
  
  if (securityStatus === 'secure' || isDismissed) return null

  return (
    <motion.div
      initial={{ y: -48 }}
      animate={{ y: 0 }}
      className={cn(
        'fixed top-0 left-0 right-0 z-50 px-4 py-3 text-center text-sm font-medium',
        securityStatus === 'warning' && 'bg-gold-primary text-navy-dark',
        securityStatus === 'critical' && 'bg-red-error text-cream animate-pulse'
      )}
    >
      <div className="flex items-center justify-center gap-2 max-w-screen-xl mx-auto">
        {securityStatus === 'warning' && <AlertTriangle className="w-4 h-4" />}
        {securityStatus === 'critical' && <AlertOctagon className="w-4 h-4" />}
        
        <span>
          {securityStatus === 'warning' && 'Security Notice: Please review security settings'}
          {securityStatus === 'critical' && 'CRITICAL: Immediate security attention required'}
        </span>
        
        <button
          onClick={() => setIsDismissed(true)}
          className="ml-4 p-1 hover:bg-black/20 rounded transition-colors"
          aria-label="Dismiss security banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  )
}
```

**Permission Management System:**
- **Given** role-based access control requirements
- **When** implementing permission system
- **Then** create:

```typescript
// hooks/useAdminPermissions.ts
export const useAdminPermissions = (user: AdminUser) => {
  const permissions = useMemo(() => {
    // Aggregate permissions from user role and additional grants
    const rolePermissions = user.role.permissions || []
    const grantedPermissions = user.additionalPermissions || []
    return [...rolePermissions, ...grantedPermissions]
  }, [user.role.permissions, user.additionalPermissions])

  const hasPermission = useCallback((permission: string): boolean => {
    // Super admin has all permissions
    if (user.role.name === 'super_admin') return true
    
    // Check exact match
    if (permissions.includes(permission)) return true
    
    // Check wildcard permissions
    const wildcardPermission = permission.split('.').slice(0, -1).join('.') + '.*'
    if (permissions.includes(wildcardPermission)) return true
    
    // Check broader wildcard
    const rootPermission = permission.split('.')[0] + '.*'
    if (permissions.includes(rootPermission)) return true
    
    return false
  }, [permissions, user.role.name])

  const hasAnyPermission = useCallback((permissionList: string[]): boolean => {
    return permissionList.some(permission => hasPermission(permission))
  }, [hasPermission])

  const hasAllPermissions = useCallback((permissionList: string[]): boolean => {
    return permissionList.every(permission => hasPermission(permission))
  }, [hasPermission])

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions
  }
}
```

### Technical Implementation Requirements

**Audit Logging System:**
- Comprehensive action logging for all admin operations
- Secure audit trail storage with integrity verification
- Real-time audit event streaming for security monitoring
- Export capabilities for compliance reporting

**Session Management:**
- Automatic session timeout with configurable duration
- Secure session storage with encryption
- Multi-factor authentication integration
- Session activity monitoring and alerting

### Testing Requirements

**Admin Foundation Testing:**
- Permission system validation and edge cases
- Session timeout and security feature testing
- Audit logging accuracy and integrity verification
- Navigation and access control validation

---

## Story F4.2: Advanced User Management Interface

**User Story:** As a frontend developer, I want to create a comprehensive user management interface that allows administrators to efficiently search, filter, manage, and moderate platform users with bulk operations and detailed user insights.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 22  
**Sprint:** 1

### Detailed Acceptance Criteria

**User Management Dashboard:**
- **Given** user management requirements
- **When** implementing user management interface
- **Then** create:

```typescript
// components/admin/users/UserManagementDashboard.tsx
export const UserManagementDashboard: React.FC = () => {
  const [filters, setFilters] = useState<UserFilters>(defaultUserFilters)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'created_at',
    direction: 'desc'
  })
  const [view, setView] = useState<'table' | 'cards'>('table')
  
  const {
    data: usersData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['admin-users', filters, sortConfig],
    queryFn: () => adminApi.getUsers({ filters, sort: sortConfig }),
    keepPreviousData: true
  })

  const bulkUserMutation = useMutation({
    mutationFn: adminApi.bulkUserAction,
    onSuccess: () => {
      refetch()
      setSelectedUsers([])
      toast.success('Bulk action completed successfully')
    },
    onError: (error) => {
      toast.error(`Bulk action failed: ${error.message}`)
    }
  })

  const handleBulkAction = async (action: BulkUserAction) => {
    if (selectedUsers.length === 0) return
    
    const confirmed = await confirmDialog({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} Users`,
      description: `Are you sure you want to ${action} ${selectedUsers.length} user(s)?`,
      confirmText: action.charAt(0).toUpperCase() + action.slice(1),
      variant: action === 'delete' ? 'destructive' : 'default'
    })
    
    if (confirmed) {
      bulkUserMutation.mutate({
        action,
        userIds: selectedUsers
      })
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-cream">
            User Management
          </h1>
          <p className="text-sage/70 mt-1">
            Manage platform users, permissions, and accounts
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <UserExportButton filters={filters} />
          <CreateUserButton onSuccess={refetch} />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Users"
          value={usersData?.stats.totalUsers}
          change={usersData?.stats.totalUsersChange}
          icon={Users}
        />
        <StatCard
          title="Active Users"
          value={usersData?.stats.activeUsers}
          change={usersData?.stats.activeUsersChange}
          icon={UserCheck}
        />
        <StatCard
          title="New This Month"
          value={usersData?.stats.newUsersThisMonth}
          change={usersData?.stats.newUsersChange}
          icon={UserPlus}
        />
        <StatCard
          title="Suspended Users"
          value={usersData?.stats.suspendedUsers}
          change={usersData?.stats.suspendedUsersChange}
          icon={UserX}
          variant="warning"
        />
      </div>

      {/* Filters and Search */}
      <GlassMorphism variant="subtle" className="p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <UserSearchInput
              value={filters.search}
              onChange={(search) => setFilters(prev => ({ ...prev, search }))}
              placeholder="Search by name, email, or ID..."
            />
          </div>
          
          {/* Filter Controls */}
          <div className="flex items-center gap-4">
            <UserStatusFilter
              value={filters.status}
              onChange={(status) => setFilters(prev => ({ ...prev, status }))}
            />
            
            <UserRoleFilter
              value={filters.roles}
              onChange={(roles) => setFilters(prev => ({ ...prev, roles }))}
            />
            
            <DateRangeFilter
              value={filters.dateRange}
              onChange={(dateRange) => setFilters(prev => ({ ...prev, dateRange }))}
            />
            
            <button
              onClick={() => setFilters(defaultUserFilters)}
              className="px-3 py-2 text-sage/70 hover:text-sage transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
        
        {/* Active Filters Display */}
        <ActiveFiltersDisplay
          filters={filters}
          onRemoveFilter={(key) => setFilters(prev => ({ ...prev, [key]: undefined }))}
        />
      </GlassMorphism>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <GlassMorphism variant="medium" className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-cream font-medium">
                    {selectedUsers.length} user(s) selected
                  </span>
                  <button
                    onClick={() => setSelectedUsers([])}
                    className="text-sage/70 hover:text-sage transition-colors"
                  >
                    Clear selection
                  </button>
                </div>
                
                <div className="flex items-center gap-2">
                  <BulkActionButton
                    action="activate"
                    onClick={() => handleBulkAction('activate')}
                    disabled={bulkUserMutation.isLoading}
                  >
                    Activate
                  </BulkActionButton>
                  
                  <BulkActionButton
                    action="suspend"
                    onClick={() => handleBulkAction('suspend')}
                    disabled={bulkUserMutation.isLoading}
                    variant="warning"
                  >
                    Suspend
                  </BulkActionButton>
                  
                  <BulkActionButton
                    action="delete"
                    onClick={() => handleBulkAction('delete')}
                    disabled={bulkUserMutation.isLoading}
                    variant="destructive"
                  >
                    Delete
                  </BulkActionButton>
                </div>
              </div>
            </GlassMorphism>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Users Table/Cards */}
      <GlassMorphism variant="subtle" className="overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-sage/20">
          <div className="flex items-center gap-4">
            <span className="text-cream font-medium">
              {usersData?.pagination.total} users found
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <ViewToggle value={view} onChange={setView} />
            
            <SortDropdown
              value={sortConfig}
              onChange={setSortConfig}
              options={userSortOptions}
            />
          </div>
        </div>

        {isLoading ? (
          <UserTableSkeleton />
        ) : error ? (
          <ErrorState
            title="Failed to load users"
            description={error.message}
            action={{ label: 'Retry', onClick: () => refetch() }}
          />
        ) : view === 'table' ? (
          <UsersTable
            users={usersData?.users || []}
            selectedUsers={selectedUsers}
            onSelectionChange={setSelectedUsers}
            sortConfig={sortConfig}
            onSortChange={setSortConfig}
          />
        ) : (
          <UsersCardGrid
            users={usersData?.users || []}
            selectedUsers={selectedUsers}
            onSelectionChange={setSelectedUsers}
          />
        )}

        {/* Pagination */}
        <div className="p-4 border-t border-sage/20">
          <Pagination
            currentPage={usersData?.pagination.currentPage || 1}
            totalPages={usersData?.pagination.totalPages || 1}
            totalItems={usersData?.pagination.total || 0}
            pageSize={usersData?.pagination.pageSize || 25}
            onPageChange={(page) => setFilters(prev => ({ ...prev, page }))}
            onPageSizeChange={(pageSize) => setFilters(prev => ({ ...prev, pageSize }))}
          />
        </div>
      </GlassMorphism>
    </div>
  )
}

// Advanced Users Table Component
const UsersTable: React.FC<UsersTableProps> = ({
  users,
  selectedUsers,
  onSelectionChange,
  sortConfig,
  onSortChange
}) => {
  const handleSelectAll = (checked: boolean) => {
    onSelectionChange(checked ? users.map(u => u.id) : [])
  }

  const handleSelectUser = (userId: string, checked: boolean) => {
    onSelectionChange(
      checked
        ? [...selectedUsers, userId]
        : selectedUsers.filter(id => id !== userId)
    )
  }

  const isAllSelected = users.length > 0 && selectedUsers.length === users.length
  const isIndeterminate = selectedUsers.length > 0 && selectedUsers.length < users.length

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-navy-50/10 border-b border-sage/20">
          <tr>
            <th className="w-12 p-4">
              <Checkbox
                checked={isAllSelected}
                indeterminate={isIndeterminate}
                onChange={handleSelectAll}
                aria-label="Select all users"
              />
            </th>
            
            <SortableTableHeader
              field="name"
              sortConfig={sortConfig}
              onSort={onSortChange}
              className="text-left p-4"
            >
              User
            </SortableTableHeader>
            
            <SortableTableHeader
              field="email"
              sortConfig={sortConfig}
              onSort={onSortChange}
              className="text-left p-4"
            >
              Email
            </SortableTableHeader>
            
            <SortableTableHeader
              field="role"
              sortConfig={sortConfig}
              onSort={onSortChange}
              className="text-left p-4"
            >
              Role
            </SortableTableHeader>
            
            <SortableTableHeader
              field="status"
              sortConfig={sortConfig}
              onSort={onSortChange}
              className="text-left p-4"
            >
              Status
            </SortableTableHeader>
            
            <SortableTableHeader
              field="last_login"
              sortConfig={sortConfig}
              onSort={onSortChange}
              className="text-left p-4"
            >
              Last Login
            </SortableTableHeader>
            
            <SortableTableHeader
              field="created_at"
              sortConfig={sortConfig}
              onSort={onSortChange}
              className="text-left p-4"
            >
              Created
            </SortableTableHeader>
            
            <th className="w-32 p-4 text-left">Actions</th>
          </tr>
        </thead>
        
        <tbody>
          {users.map((user) => (
            <UserTableRow
              key={user.id}
              user={user}
              selected={selectedUsers.includes(user.id)}
              onSelect={(checked) => handleSelectUser(user.id, checked)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// User Table Row Component
const UserTableRow: React.FC<UserTableRowProps> = ({ user, selected, onSelect }) => {
  const [showDetails, setShowDetails] = useState(false)
  const { hasPermission } = useAdminPermissions()

  return (
    <>
      <motion.tr
        className={cn(
          'border-b border-sage/10 hover:bg-navy-50/5 transition-colors',
          selected && 'bg-teal-primary/10'
        )}
        whileHover={{ backgroundColor: 'rgba(148, 210, 189, 0.05)' }}
      >
        <td className="p-4">
          <Checkbox
            checked={selected}
            onChange={onSelect}
            aria-label={`Select ${user.name}`}
          />
        </td>
        
        <td className="p-4">
          <div className="flex items-center gap-3">
            <Avatar
              src={user.avatar}
              alt={user.name}
              size="sm"
              fallback={user.name.charAt(0)}
            />
            <div>
              <p className="font-medium text-cream">{user.name}</p>
              <p className="text-sm text-sage/70">ID: {user.id.slice(0, 8)}</p>
            </div>
          </div>
        </td>
        
        <td className="p-4">
          <div>
            <p className="text-cream">{user.email}</p>
            {!user.emailVerified && (
              <p className="text-xs text-gold-primary">Unverified</p>
            )}
          </div>
        </td>
        
        <td className="p-4">
          <UserRoleBadge role={user.role} />
        </td>
        
        <td className="p-4">
          <UserStatusBadge status={user.status} />
        </td>
        
        <td className="p-4 text-sage/70">
          {user.lastLogin ? (
            <RelativeTime date={user.lastLogin} />
          ) : (
            'Never'
          )}
        </td>
        
        <td className="p-4 text-sage/70">
          <RelativeTime date={user.createdAt} />
        </td>
        
        <td className="p-4">
          <UserActionsDropdown
            user={user}
            onShowDetails={() => setShowDetails(true)}
          />
        </td>
      </motion.tr>
      
      {/* Expandable Details Row */}
      <AnimatePresence>
        {showDetails && (
          <UserDetailsExpandedRow
            user={user}
            onClose={() => setShowDetails(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
```

**User Impersonation System:**
- **Given** user support requirements
- **When** implementing user impersonation
- **Then** create secure impersonation with audit trails and time limits

### Testing Requirements

**User Management Testing:**
- Bulk action functionality and error handling
- Search and filter accuracy validation
- Permission-based access control testing
- User impersonation security and audit testing

---

## Story F4.3: Business Management & Verification Interface

**User Story:** As a frontend developer, I want to create comprehensive business management tools that allow administrators to efficiently manage business listings, handle verification processes, and maintain business data quality across the platform.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 20  
**Sprint:** 2

### Detailed Acceptance Criteria

**Business Management Dashboard:**
- **Given** business management requirements
- **When** implementing business management interface
- **Then** create comprehensive business oversight with verification workflows and data quality controls

### Testing Requirements

**Business Management Testing:**
- Business verification workflow testing
- Data quality validation and enforcement
- Business owner communication testing
- Bulk operation accuracy validation

---

## Story F4.4: Content Moderation & Safety Tools

**User Story:** As a frontend developer, I want to create sophisticated content moderation tools that enable administrators to efficiently review, moderate, and maintain platform content safety with automated detection and manual review capabilities.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 25  
**Sprint:** 2

### Detailed Acceptance Criteria

**Content Moderation Dashboard:**
- **Given** content safety requirements
- **When** implementing moderation tools
- **Then** create comprehensive content review system with AI-assisted detection and human oversight

### Testing Requirements

**Content Moderation Testing:**
- Automated detection accuracy validation
- Manual review workflow testing
- Content action audit trail verification
- Appeal process functionality testing

---

## Story F4.5: System Health & Monitoring Dashboard

**User Story:** As a frontend developer, I want to create real-time system health monitoring dashboards that provide administrators with comprehensive insights into platform performance, security status, and operational metrics.

**Assignee:** Frontend Developer Agent  
**Priority:** P1  
**Story Points:** 18  
**Sprint:** 3

### Detailed Acceptance Criteria

**System Monitoring Interface:**
- **Given** system health monitoring requirements
- **When** implementing monitoring dashboard
- **Then** create real-time system status displays with alerting and historical analysis

### Testing Requirements

**System Monitoring Testing:**
- Real-time data accuracy validation
- Alert system functionality testing
- Performance metrics accuracy verification
- Historical data visualization testing

---

## Story F4.6: Customer Support Integration & Ticketing

**User Story:** As a frontend developer, I want to create integrated customer support tools that allow administrators to efficiently manage support tickets, user communications, and issue resolution workflows.

**Assignee:** Frontend Developer Agent  
**Priority:** P1  
**Story Points:** 21  
**Sprint:** 3

### Detailed Acceptance Criteria

**Support Management Interface:**
- **Given** customer support requirements
- **When** implementing support tools
- **Then** create comprehensive ticketing system with communication tracking and resolution workflows

### Testing Requirements

**Support System Testing:**
- Ticket workflow and status management testing
- Communication thread integrity validation
- SLA tracking and alerting verification
- Integration with external support tools testing

---

## Story F4.7: Platform Analytics & Reporting

**User Story:** As a frontend developer, I want to create comprehensive platform analytics and reporting tools that provide administrators with business intelligence, usage insights, and operational reporting capabilities.

**Assignee:** Frontend Developer Agent  
**Priority:** P1  
**Story Points:** 19  
**Sprint:** 4

### Detailed Acceptance Criteria

**Analytics Dashboard:**
- **Given** platform analytics requirements
- **When** implementing analytics interface
- **Then** create comprehensive reporting system with customizable dashboards and export capabilities

### Testing Requirements

**Analytics Testing:**
- Data aggregation accuracy validation
- Report generation and export testing
- Custom dashboard functionality verification
- Performance testing with large datasets

---

## Story F4.8: Security Management & Audit Tools

**User Story:** As a frontend developer, I want to create security management interfaces that provide administrators with comprehensive security oversight, audit trail management, and threat monitoring capabilities.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 17  
**Sprint:** 4

### Detailed Acceptance Criteria

**Security Management Interface:**
- **Given** security oversight requirements
- **When** implementing security tools
- **Then** create comprehensive security monitoring with audit logs and threat analysis

### Testing Requirements

**Security Tools Testing:**
- Audit log integrity and search functionality
- Security alert accuracy and response testing
- Access control enforcement validation
- Compliance reporting verification

---

## Epic 4 Summary & Success Metrics

### Completion Criteria

**Technical Deliverables:**
- ✅ Secure admin dashboard foundation with role-based access control
- ✅ Comprehensive user management with bulk operations and impersonation
- ✅ Business management and verification workflow tools
- ✅ Advanced content moderation and safety systems
- ✅ Real-time system health monitoring and alerting
- ✅ Integrated customer support and ticketing system
- ✅ Platform analytics and business intelligence reporting
- ✅ Security management and audit trail systems

**Security Standards:**
- Multi-factor authentication required for all admin access
- Comprehensive audit logging for all administrative actions
- Secure user impersonation with time limits and full audit trails
- Role-based access control with granular permission management
- Automated security monitoring and threat detection

**Performance Standards:**
- Admin dashboard load time < 2s
- User management operations < 500ms
- Bulk operations with progress tracking and cancellation
- Real-time monitoring updates < 200ms
- Report generation < 5s for standard reports

**Operational Efficiency:**
- Admin task completion time reduced by 60%
- User management efficiency improved by 75%
- Content moderation processing time reduced by 50%
- Support ticket resolution time improved by 40%
- System issue detection and response time < 5 minutes

**Compliance & Audit:**
- 100% audit coverage for administrative actions
- Compliance report generation automation
- Data retention policy enforcement
- GDPR and privacy regulation compliance tools

**Testing Coverage:**
- Unit test coverage > 90% for all admin functionality
- Integration testing for all admin workflows
- Security penetration testing for admin interfaces
- Performance testing under high administrative load
- Accessibility compliance (WCAG 2.1 AA) for admin tools

This comprehensive frontend Epic 4 creates a powerful administrative interface that enables effective platform governance while maintaining the highest security and usability standards. The admin tools provide the necessary oversight capabilities to ensure platform quality, user safety, and operational excellence.

**File Path:** `/Users/michaellawless/Documents/Vibe/Repo/directory_v4/docs/planning/frontend-epic-4-stories.md`