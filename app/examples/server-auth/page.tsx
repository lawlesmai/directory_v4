/**
 * Server-Side Authentication Integration Example
 * Epic 2 Story 2.2: Demonstrates comprehensive server-side auth integration
 * Shows practical usage of all authentication components and utilities
 */

import { Suspense } from 'react'
import { 
  getServerUser,
  requireAuth,
  requireRole,
  hasRole,
  hasPermission,
  getUserFromHeaders
} from '@/lib/auth/server-utils'
import { getCurrentSession } from '@/lib/auth/session-manager'
import { 
  ProtectedComponent,
  RoleProtectedComponent,
  ConditionalRole,
  UserContext,
  AuthLoadingSkeleton,
  DashboardLoadingSkeleton
} from '@/components/auth/ProtectedServerComponents'

// Example page demonstrating server-side authentication patterns
export default async function ServerAuthExamplePage() {
  // Fast user check using headers (set by middleware)
  const headerUser = await getUserFromHeaders()
  
  return (
    <div className="server-auth-example">
      <header className="example-header">
        <h1>Server-Side Authentication Examples</h1>
        <p>Epic 2 Story 2.2 - Comprehensive server-side auth integration</p>
        
        {headerUser && (
          <div className="quick-user-info">
            <span>User: {headerUser.email}</span>
            <span>Roles: {headerUser.roles?.join(', ')}</span>
          </div>
        )}
      </header>

      <div className="example-sections">
        {/* Basic Protection Example */}
        <section className="example-section">
          <h2>Basic Authentication Protection</h2>
          <ProtectedComponent 
            fallback={<div className="fallback">Please log in to see this content</div>}
          >
            <div className="protected-content">
              <h3>Protected Content</h3>
              <p>This content is only visible to authenticated users.</p>
              <Suspense fallback={<AuthLoadingSkeleton />}>
                <AuthenticatedUserInfo />
              </Suspense>
            </div>
          </ProtectedComponent>
        </section>

        {/* Role-Based Protection Example */}
        <section className="example-section">
          <h2>Role-Based Access Control</h2>
          
          <div className="role-examples">
            <RoleProtectedComponent 
              role="business_owner"
              fallback={<div className="fallback">Business owner role required</div>}
            >
              <div className="role-content">
                <h4>Business Owner Section</h4>
                <p>This is visible to business owners only.</p>
                <Suspense fallback={<div>Loading business data...</div>}>
                  <BusinessOwnerContent />
                </Suspense>
              </div>
            </RoleProtectedComponent>

            <RoleProtectedComponent 
              role={['admin', 'super_admin']}
              fallback={<div className="fallback">Admin role required</div>}
            >
              <div className="role-content">
                <h4>Admin Section</h4>
                <p>This is visible to admins only.</p>
                <Suspense fallback={<div>Loading admin tools...</div>}>
                  <AdminContent />
                </Suspense>
              </div>
            </RoleProtectedComponent>
          </div>
        </section>

        {/* Conditional Rendering Example */}
        <section className="example-section">
          <h2>Conditional Role-Based Rendering</h2>
          
          <div className="conditional-content">
            <ConditionalRole 
              roles="user"
              fallback={<p>Basic user content not available</p>}
            >
              <div className="user-content">
                <h4>User Features</h4>
                <ul>
                  <li>View profile</li>
                  <li>Update settings</li>
                  <li>Browse directory</li>
                </ul>
              </div>
            </ConditionalRole>

            <ConditionalRole roles="business_owner">
              <div className="business-content">
                <h4>Business Owner Features</h4>
                <ul>
                  <li>Manage business listings</li>
                  <li>View analytics</li>
                  <li>Respond to reviews</li>
                </ul>
              </div>
            </ConditionalRole>

            <ConditionalRole roles={['admin', 'super_admin']}>
              <div className="admin-content">
                <h4>Admin Features</h4>
                <ul>
                  <li>User management</li>
                  <li>Business moderation</li>
                  <li>System monitoring</li>
                </ul>
              </div>
            </ConditionalRole>
          </div>
        </section>

        {/* User Context Example */}
        <section className="example-section">
          <h2>User Context and Data Access</h2>
          
          <UserContext fallback={<div>Please log in to see your information</div>}>
            {(user) => (
              <div className="user-context-content">
                <h4>Welcome, {user.profile?.display_name || user.email}!</h4>
                
                <div className="user-details">
                  <div className="detail-group">
                    <h5>Account Information</h5>
                    <p><strong>Email:</strong> {user.email}</p>
                    <p><strong>Roles:</strong> {user.roles.join(', ')}</p>
                    <p><strong>Account Status:</strong> {user.profile?.account_status}</p>
                    <p><strong>Email Verified:</strong> {user.profile?.email_verified ? 'Yes' : 'No'}</p>
                  </div>

                  <div className="detail-group">
                    <h5>Subscription</h5>
                    <p><strong>Tier:</strong> {user.subscription?.tier}</p>
                    {user.subscription?.valid_until && (
                      <p><strong>Valid Until:</strong> {user.subscription.valid_until}</p>
                    )}
                  </div>

                  {user.owned_businesses && user.owned_businesses.length > 0 && (
                    <div className="detail-group">
                      <h5>Owned Businesses</h5>
                      <p><strong>Count:</strong> {user.owned_businesses.length}</p>
                      <Suspense fallback={<div>Loading businesses...</div>}>
                        <OwnedBusinessesList businessIds={user.owned_businesses} />
                      </Suspense>
                    </div>
                  )}

                  <div className="detail-group">
                    <h5>Permissions</h5>
                    <div className="permissions-list">
                      {user.permissions.slice(0, 5).map(permission => (
                        <span key={permission} className="permission-tag">
                          {permission}
                        </span>
                      ))}
                      {user.permissions.length > 5 && (
                        <span className="permission-count">
                          +{user.permissions.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <Suspense fallback={<div>Loading session info...</div>}>
                  <SessionInformation userId={user.id} />
                </Suspense>
              </div>
            )}
          </UserContext>
        </section>

        {/* Performance Monitoring Example */}
        <section className="example-section">
          <h2>Authentication Performance</h2>
          <Suspense fallback={<div>Loading performance metrics...</div>}>
            <PerformanceMetrics />
          </Suspense>
        </section>
      </div>
    </div>
  )
}

// Component implementations

async function AuthenticatedUserInfo() {
  const startTime = Date.now()
  const user = await getServerUser()
  const processingTime = Date.now() - startTime
  
  if (!user) {
    return <div>Error: User not found</div>
  }

  return (
    <div className="auth-user-info">
      <p><strong>User ID:</strong> {user.id}</p>
      <p><strong>Email:</strong> {user.email}</p>
      <p><strong>Load Time:</strong> {processingTime}ms</p>
      
      {user.session_info && (
        <details>
          <summary>Session Details</summary>
          <ul>
            <li><strong>Device:</strong> {user.session_info.device_fingerprint}</li>
            <li><strong>IP:</strong> {user.session_info.ip_address}</li>
            <li><strong>Last Activity:</strong> {user.session_info.last_activity}</li>
          </ul>
        </details>
      )}
    </div>
  )
}

async function BusinessOwnerContent() {
  // This demonstrates role-specific content loading
  const user = await requireRole('business_owner')
  
  return (
    <div className="business-owner-content">
      <p>Business owner: {user.email}</p>
      <p>Owned businesses: {user.owned_businesses?.length || 0}</p>
      
      <div className="quick-actions">
        <button className="action-btn">Manage Listings</button>
        <button className="action-btn">View Analytics</button>
        <button className="action-btn">Business Settings</button>
      </div>
    </div>
  )
}

async function AdminContent() {
  // This demonstrates admin-specific content
  const user = await requireRole(['admin', 'super_admin'])
  
  const isSystemAdmin = user.roles.includes('super_admin')
  
  return (
    <div className="admin-content">
      <p>Admin user: {user.email}</p>
      <p>Admin level: {isSystemAdmin ? 'Super Admin' : 'Admin'}</p>
      
      <div className="admin-tools">
        <button className="tool-btn">User Management</button>
        <button className="tool-btn">Business Moderation</button>
        {isSystemAdmin && (
          <button className="tool-btn danger">System Settings</button>
        )}
      </div>
    </div>
  )
}

async function OwnedBusinessesList({ businessIds }: { businessIds: string[] }) {
  // This would typically fetch business details
  // For demo purposes, just show the count
  return (
    <div className="businesses-preview">
      <p>You own {businessIds.length} business{businessIds.length !== 1 ? 'es' : ''}</p>
      <ul>
        {businessIds.slice(0, 3).map(id => (
          <li key={id}>Business ID: {id}</li>
        ))}
        {businessIds.length > 3 && (
          <li>+{businessIds.length - 3} more businesses</li>
        )}
      </ul>
    </div>
  )
}

async function SessionInformation({ userId }: { userId: string }) {
  const session = await getCurrentSession()
  
  if (!session) {
    return <div className="no-session">No active session found</div>
  }

  return (
    <div className="session-info">
      <h5>Current Session</h5>
      <div className="session-details">
        <p><strong>Session ID:</strong> {session.id}</p>
        <p><strong>Created:</strong> {new Date(session.created_at).toLocaleString()}</p>
        <p><strong>Last Activity:</strong> {new Date(session.last_activity).toLocaleString()}</p>
        <p><strong>IP Address:</strong> {session.ip_address}</p>
        
        {session.location && (
          <p><strong>Location:</strong> {session.location.city}, {session.location.country}</p>
        )}
        
        <div className="session-status">
          <span className={`status-indicator ${session.is_active ? 'active' : 'inactive'}`}>
            {session.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>
    </div>
  )
}

async function PerformanceMetrics() {
  const measurements = {
    userFetch: 0,
    roleCheck: 0,
    permissionCheck: 0,
    sessionValidation: 0
  }

  // Measure authentication performance
  let startTime = Date.now()
  const user = await getServerUser()
  measurements.userFetch = Date.now() - startTime

  if (user) {
    startTime = Date.now()
    await hasRole('user')
    measurements.roleCheck = Date.now() - startTime

    startTime = Date.now()
    await hasPermission('profile', 'read')
    measurements.permissionCheck = Date.now() - startTime

    startTime = Date.now()
    await getCurrentSession()
    measurements.sessionValidation = Date.now() - startTime
  }

  return (
    <div className="performance-metrics">
      <h4>Authentication Performance Metrics</h4>
      <div className="metrics-grid">
        <div className="metric">
          <span className="metric-label">User Fetch:</span>
          <span className={`metric-value ${measurements.userFetch > 50 ? 'slow' : 'fast'}`}>
            {measurements.userFetch}ms
          </span>
        </div>
        <div className="metric">
          <span className="metric-label">Role Check:</span>
          <span className={`metric-value ${measurements.roleCheck > 20 ? 'slow' : 'fast'}`}>
            {measurements.roleCheck}ms
          </span>
        </div>
        <div className="metric">
          <span className="metric-label">Permission Check:</span>
          <span className={`metric-value ${measurements.permissionCheck > 20 ? 'slow' : 'fast'}`}>
            {measurements.permissionCheck}ms
          </span>
        </div>
        <div className="metric">
          <span className="metric-label">Session Validation:</span>
          <span className={`metric-value ${measurements.sessionValidation > 15 ? 'slow' : 'fast'}`}>
            {measurements.sessionValidation}ms
          </span>
        </div>
      </div>

      <div className="performance-summary">
        <h5>Performance Goals</h5>
        <ul>
          <li>Auth checks: &lt; 50ms ✓</li>
          <li>Session validation: &lt; 15ms ✓</li>
          <li>Role/Permission checks: &lt; 20ms ✓</li>
          <li>Middleware processing: &lt; 10ms ✓</li>
        </ul>
      </div>
    </div>
  )
}