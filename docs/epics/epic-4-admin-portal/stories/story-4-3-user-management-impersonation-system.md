# Story 4.3: User Management & Impersonation System

**Epic:** Epic 4 - Platform Admin Portal  
**User Story:** As a platform administrator, I want comprehensive user management tools including secure impersonation capabilities so that I can efficiently support users and resolve account issues.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 34  
**Sprint:** 2

## Detailed Acceptance Criteria

### Comprehensive User Search & Management

**Given** the need to efficiently find and manage users  
**When** using the user management system  
**Then** provide powerful search and management tools:

**Advanced User Search:**
- Search by email, name, phone number, or user ID
- Filter by user role, subscription status, verification level
- Filter by registration date, last login, activity level
- Filter by geographic location or business ownership status
- Search by associated businesses or review activity
- Bulk user operations with multi-select functionality
- Export user lists with customizable data fields

**User Profile Management:**
- Complete user profile viewing with all associated data
- User activity timeline with login, actions, and engagement
- Account status management (active, suspended, banned)
- Role assignment and permission management
- Subscription history and billing information overview
- Associated businesses and ownership verification status
- Review activity and content contribution history

### Secure User Impersonation System

**Given** the need for customer support and troubleshooting  
**When** implementing user impersonation  
**Then** create a secure impersonation system:

**Impersonation Security & Controls:**
- Multi-factor authentication required before impersonation
- Admin approval workflow for sensitive account access
- Time-limited impersonation sessions (max 2 hours)
- Comprehensive audit logging of all impersonation activities
- Restricted actions during impersonation (no password changes, billing modifications)
- User notification system for account access by support
- Emergency termination of impersonation sessions

**Impersonation Interface:**
- Clear visual indicators when in impersonation mode
- Impersonation control panel with session management
- Quick exit from impersonation with confirmation
- Impersonation activity log visible to impersonating admin
- Support note system for documenting impersonation actions
- Seamless switching between admin and user views
- Session recording for quality assurance and training

### User Account Operations

**Given** various user account management needs  
**When** performing account operations  
**Then** provide comprehensive account management:

**Account Status Management:**
- Account suspension with reason documentation
- Account ban management with appeal process
- Account deletion with data retention compliance
- Account restoration with approval workflows
- Email verification status management
- Phone number verification and updating
- Password reset initiation for user support

**User Data Management:**
- GDPR-compliant data export for user requests
- Data anonymization for account deletion requests
- User consent management and tracking
- Privacy settings review and modification
- User-reported content and issue tracking
- Communication preference management
- Account merge operations for duplicate accounts

### User Support Integration

**Given** customer support workflow requirements  
**When** handling user support requests  
**Then** integrate support tools:

**Support Ticket Integration:**
- Direct ticket creation from user profile
- Support history and previous interaction tracking
- Internal notes and admin communication system
- Escalation workflows for complex user issues
- User satisfaction tracking for support interactions
- Knowledge base integration for common issues
- Support macro system for efficient responses

## Frontend Implementation

### User Management Dashboard

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

      {/* Advanced Search and Filters */}
      <GlassMorphism variant="subtle" className="p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <UserSearchInput
              value={filters.search}
              onChange={(search) => setFilters(prev => ({ ...prev, search }))}
              placeholder="Search by name, email, phone, or ID..."
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
            
            <LocationFilter
              value={filters.location}
              onChange={(location) => setFilters(prev => ({ ...prev, location }))}
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
                    action="export"
                    onClick={() => handleBulkAction('export')}
                    disabled={bulkUserMutation.isLoading}
                  >
                    Export
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
```

### Secure User Impersonation System

```typescript
// components/admin/users/UserImpersonation.tsx
interface ImpersonationControlsProps {
  user: User
  onImpersonate: (userId: string) => Promise<void>
  onEndImpersonation: () => Promise<void>
  isImpersonating: boolean
  impersonationSession?: ImpersonationSession
}

export const UserImpersonationControls: React.FC<ImpersonationControlsProps> = ({
  user,
  onImpersonate,
  onEndImpersonation,
  isImpersonating,
  impersonationSession
}) => {
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  
  const { hasPermission } = useAdminPermissions()
  const canImpersonate = hasPermission('admin.users.impersonate')

  const handleImpersonate = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for impersonation')
      return
    }

    try {
      await onImpersonate(user.id)
      
      // Log impersonation start
      auditLogger.log('user_impersonation_started', {
        targetUserId: user.id,
        reason,
        notes
      })
      
      setShowConfirmation(false)
      setReason('')
      setNotes('')
    } catch (error) {
      toast.error('Failed to start impersonation')
    }
  }

  const handleEndImpersonation = async () => {
    try {
      await onEndImpersonation()
      
      // Log impersonation end
      auditLogger.log('user_impersonation_ended', {
        targetUserId: user.id,
        duration: impersonationSession?.duration
      })
    } catch (error) {
      toast.error('Failed to end impersonation')
    }
  }

  if (!canImpersonate) return null

  return (
    <div className="space-y-4">
      {isImpersonating && impersonationSession ? (
        <div className="bg-red-error/20 border border-red-error/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-red-error" />
              <span className="font-medium text-red-error">
                Impersonating {user.name}
              </span>
            </div>
            
            <div className="text-sm text-sage/70">
              Started {formatDistanceToNow(impersonationSession.startedAt)} ago
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-sm text-sage/70">
              Session expires in {formatDistanceToNow(impersonationSession.expiresAt)}
            </div>
            
            <button
              onClick={handleEndImpersonation}
              className="px-4 py-2 bg-red-error text-cream rounded-lg hover:bg-red-critical transition-colors"
            >
              End Impersonation
            </button>
          </div>
          
          <div className="mt-3 pt-3 border-t border-red-error/20">
            <p className="text-xs text-sage/60">
              Reason: {impersonationSession.reason}
            </p>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowConfirmation(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-primary/20 text-teal-primary rounded-lg hover:bg-teal-primary/30 transition-colors"
        >
          <Eye className="w-4 h-4" />
          Impersonate User
        </button>
      )}

      {/* Impersonation Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Impersonate User</DialogTitle>
            <DialogDescription>
              You are about to impersonate {user.name}. This action will be fully audited.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-cream mb-2">
                Reason for Impersonation *
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 bg-navy-dark border border-sage/30 rounded-lg text-cream"
                required
              >
                <option value="">Select a reason</option>
                <option value="customer_support">Customer Support</option>
                <option value="technical_issue">Technical Issue</option>
                <option value="billing_inquiry">Billing Inquiry</option>
                <option value="account_verification">Account Verification</option>
                <option value="security_investigation">Security Investigation</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-cream mb-2">
                Additional Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional additional context..."
                className="w-full px-3 py-2 bg-navy-dark border border-sage/30 rounded-lg text-cream resize-none"
                rows={3}
              />
            </div>
            
            <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
                <div className="text-sm">
                  <p className="text-yellow-500 font-medium">Security Notice</p>
                  <ul className="mt-1 text-sage/70 space-y-1">
                    <li>• Session will expire in 2 hours</li>
                    <li>• All actions will be logged and audited</li>
                    <li>• User will be notified of impersonation</li>
                    <li>• Password and billing changes are restricted</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <button
              onClick={() => setShowConfirmation(false)}
              className="px-4 py-2 text-sage/70 hover:text-sage transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImpersonate}
              disabled={!reason.trim()}
              className="px-4 py-2 bg-red-error text-cream rounded-lg hover:bg-red-critical transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Impersonation
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

## Technical Implementation Notes

**Impersonation Security Architecture:**
- Separate impersonation tokens with limited scope and time
- Audit trail for all impersonation activities
- IP tracking and session monitoring during impersonation
- Automated impersonation session termination

**User Data Architecture:**
- Efficient user search indexing and queries
- User activity aggregation for quick profile loading
- Data privacy controls and access logging
- Real-time user status updates across systems

**Performance Optimization:**
- Lazy loading of user data components
- Efficient pagination for large user lists
- Search result caching for common queries
- Background processing for bulk operations

## Dependencies

- Story 4.1 (Admin portal foundation and access control)
- Epic 2 Story 2.7 (User profile management system)

## Testing Requirements

**User Management Tests:**
- User search and filtering functionality tests
- User profile management operation tests
- Bulk user operations accuracy and performance tests
- User data export and privacy compliance tests

**Impersonation Security Tests:**
- Impersonation access control and permission tests
- Impersonation session security and timeout tests
- Impersonation audit logging accuracy and completeness
- Unauthorized impersonation prevention tests

**Support Integration Tests:**
- Support ticket integration and workflow tests
- User communication and notification tests
- Account operation effectiveness and safety tests
- GDPR compliance validation for data operations

## Definition of Done

- [ ] Comprehensive user search and management system
- [ ] Secure user impersonation with full audit logging
- [ ] User account operations with proper security controls
- [ ] Support ticket integration and workflow management
- [ ] GDPR-compliant user data management and export
- [ ] Performance optimization for large user datasets
- [ ] Mobile-responsive user management interface
- [ ] All security tests passed for impersonation system
- [ ] User support workflow integration complete
- [ ] Documentation complete for admin user management procedures

## Risk Assessment

- **High Risk:** User impersonation security vulnerabilities
- **Medium Risk:** Performance impact of complex user search operations
- **Mitigation:** Comprehensive security testing and query optimization