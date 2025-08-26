/**
 * Protected Server Components
 * Epic 2 Story 2.2: Server-side authentication component examples
 * Demonstrates proper SSR authentication patterns and role-based rendering
 * Performance Goals: Component auth checks < 20ms
 */

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { 
  getServerUser, 
  requireAuth, 
  requireRole, 
  requirePermission,
  hasRole,
  hasPermission,
  getUserFromHeaders,
  type ServerAuthUser 
} from '@/lib/auth/server-utils'
import { getCurrentSession } from '@/lib/auth/session-manager'

// Component wrapper types
interface ProtectedComponentProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  redirectTo?: string
}

interface RoleBasedProps extends ProtectedComponentProps {
  role: string | string[]
  requireAll?: boolean
}

interface PermissionBasedProps extends ProtectedComponentProps {
  resource: string
  action: string
}

/**
 * Protected Component Wrapper
 * Requires authentication to render children
 */
export async function ProtectedComponent({ 
  children, 
  fallback, 
  redirectTo = '/auth/login' 
}: ProtectedComponentProps) {
  const user = await getServerUser()
  
  if (!user) {
    if (fallback) {
      return <>{fallback}</>
    }
    redirect(redirectTo)
  }

  return <>{children}</>
}

/**
 * Role-Based Component Wrapper
 * Requires specific role(s) to render children
 */
export async function RoleProtectedComponent({ 
  children, 
  fallback, 
  role, 
  requireAll = false, 
  redirectTo = '/unauthorized' 
}: RoleBasedProps) {
  const user = await getServerUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  const requiredRoles = Array.isArray(role) ? role : [role]
  const userHasRole = requireAll 
    ? requiredRoles.every(r => user.roles.includes(r))
    : requiredRoles.some(r => user.roles.includes(r))

  if (!userHasRole) {
    if (fallback) {
      return <>{fallback}</>
    }
    redirect(redirectTo)
  }

  return <>{children}</>
}

/**
 * Permission-Based Component Wrapper
 * Requires specific permission to render children
 */
export async function PermissionProtectedComponent({ 
  children, 
  fallback, 
  resource, 
  action, 
  redirectTo = '/unauthorized' 
}: PermissionBasedProps) {
  const permissionCheck = await hasPermission(resource, action)
  
  if (!permissionCheck.user) {
    redirect('/auth/login')
  }

  if (!permissionCheck.hasPermission) {
    if (fallback) {
      return <>{fallback}</>
    }
    redirect(redirectTo)
  }

  return <>{children}</>
}

/**
 * Conditional Role Rendering
 * Shows different content based on user roles without redirecting
 */
interface ConditionalRoleProps {
  roles: string | string[]
  requireAll?: boolean
  children: React.ReactNode
  fallback?: React.ReactNode
}

export async function ConditionalRole({ 
  roles, 
  requireAll = false, 
  children, 
  fallback 
}: ConditionalRoleProps) {
  const user = await getServerUser()
  
  if (!user) {
    return fallback ? <>{fallback}</> : null
  }

  const requiredRoles = Array.isArray(roles) ? roles : [roles]
  const userHasRole = requireAll 
    ? requiredRoles.every(r => user.roles.includes(r))
    : requiredRoles.some(r => user.roles.includes(r))

  if (!userHasRole) {
    return fallback ? <>{fallback}</> : null
  }

  return <>{children}</>
}

/**
 * User Context Component
 * Provides user data to child components
 */
interface UserContextProps {
  children: (user: ServerAuthUser) => React.ReactNode
  fallback?: React.ReactNode
}

export async function UserContext({ children, fallback }: UserContextProps) {
  const user = await getServerUser()
  
  if (!user) {
    return fallback ? <>{fallback}</> : null
  }

  return <>{children(user)}</>
}

// Example protected server components

/**
 * Protected Dashboard Component
 * Requires authentication to view
 */
export async function ProtectedDashboard() {
  // Using requireAuth for automatic redirect
  const user = await requireAuth()
  
  const session = await getCurrentSession()
  
  return (
    <div className="protected-dashboard">
      <header className="dashboard-header">
        <h1>Welcome, {user.profile?.display_name || user.email}!</h1>
        <div className="session-info">
          <span>Last activity: {session?.last_activity}</span>
          <span>Session ID: {session?.id}</span>
        </div>
      </header>
      
      <div className="dashboard-content">
        <div className="user-stats">
          <div className="stat">
            <span>Account Type</span>
            <span>{user.roles.join(', ')}</span>
          </div>
          <div className="stat">
            <span>Subscription</span>
            <span>{user.subscription?.tier || 'Free'}</span>
          </div>
          {user.owned_businesses?.length && (
            <div className="stat">
              <span>Owned Businesses</span>
              <span>{user.owned_businesses.length}</span>
            </div>
          )}
        </div>

        <Suspense fallback={<div>Loading dashboard content...</div>}>
          <DashboardContent user={user} />
        </Suspense>
      </div>
    </div>
  )
}

/**
 * Business Management Component
 * Requires business_owner, admin, or super_admin role
 */
export async function BusinessManagement() {
  const user = await requireRole(['business_owner', 'admin', 'super_admin'])
  
  return (
    <div className="business-management">
      <header>
        <h1>Business Management</h1>
        <p>Managing businesses for: {user.email}</p>
      </header>

      <div className="management-sections">
        {/* Show different sections based on role */}
        <ConditionalRole roles={['business_owner']}>
          <section className="owned-businesses">
            <h2>Your Businesses</h2>
            <Suspense fallback={<div>Loading businesses...</div>}>
              <OwnedBusinessesList userId={user.id} />
            </Suspense>
          </section>
        </ConditionalRole>

        <ConditionalRole roles={['admin', 'super_admin']}>
          <section className="admin-businesses">
            <h2>All Businesses (Admin)</h2>
            <Suspense fallback={<div>Loading all businesses...</div>}>
              <AllBusinessesList />
            </Suspense>
          </section>
        </ConditionalRole>
      </div>
    </div>
  )
}

/**
 * Admin Panel Component
 * Requires admin or super_admin role
 */
export async function AdminPanel() {
  const user = await requireRole(['admin', 'super_admin'])
  
  return (
    <div className="admin-panel">
      <header>
        <h1>Admin Panel</h1>
        <p>Administrative access for: {user.email}</p>
        <div className="admin-info">
          <span>Role: {user.roles.join(', ')}</span>
          <span>Permissions: {user.permissions.length}</span>
        </div>
      </header>

      <div className="admin-sections">
        {/* User Management - Admin and Super Admin */}
        <PermissionProtectedComponent 
          resource="users" 
          action="manage"
          fallback={<div>You don't have user management permissions</div>}
        >
          <section className="user-management">
            <h2>User Management</h2>
            <Suspense fallback={<div>Loading user management...</div>}>
              <UserManagement />
            </Suspense>
          </section>
        </PermissionProtectedComponent>

        {/* System Settings - Super Admin only */}
        <ConditionalRole 
          roles={['super_admin']}
          fallback={<div>System settings require super admin role</div>}
        >
          <section className="system-settings">
            <h2>System Settings</h2>
            <Suspense fallback={<div>Loading system settings...</div>}>
              <SystemSettings />
            </Suspense>
          </section>
        </ConditionalRole>

        {/* Security Monitoring */}
        <PermissionProtectedComponent resource="security" action="monitor">
          <section className="security-monitoring">
            <h2>Security Monitoring</h2>
            <Suspense fallback={<div>Loading security data...</div>}>
              <SecurityMonitoring />
            </Suspense>
          </section>
        </PermissionProtectedComponent>
      </div>
    </div>
  )
}

/**
 * Fast User Header Component
 * Uses headers for quick user info without database calls
 */
export async function FastUserHeader() {
  const headerUser = await getUserFromHeaders()
  
  if (!headerUser) {
    return (
      <header className="user-header guest">
        <nav>
          <a href="/auth/login">Sign In</a>
          <a href="/auth/register">Sign Up</a>
        </nav>
      </header>
    )
  }

  return (
    <header className="user-header authenticated">
      <div className="user-info">
        <span>Welcome, {headerUser.email}</span>
        <span className="roles">{headerUser.roles?.join(', ')}</span>
      </div>
      
      <nav>
        <a href="/dashboard">Dashboard</a>
        {headerUser.roles?.includes('business_owner') && (
          <a href="/business/manage">Manage Business</a>
        )}
        {headerUser.roles?.some(role => ['admin', 'super_admin'].includes(role)) && (
          <a href="/admin">Admin</a>
        )}
        <a href="/profile">Profile</a>
      </nav>
    </header>
  )
}

// Example child components (would typically be in separate files)

async function DashboardContent({ user }: { user: ServerAuthUser }) {
  // Simulate loading dashboard content
  return (
    <div className="dashboard-main">
      <h2>Dashboard Content</h2>
      <p>Welcome back! Here's what's happening with your account.</p>
      
      <div className="quick-actions">
        {user.roles.includes('business_owner') && (
          <a href="/business/manage" className="action-button">
            Manage Businesses
          </a>
        )}
        <a href="/profile" className="action-button">
          Update Profile
        </a>
      </div>
    </div>
  )
}

async function OwnedBusinessesList({ userId }: { userId: string }) {
  // This would typically fetch businesses owned by the user
  return (
    <div className="businesses-list">
      <p>Your businesses will appear here...</p>
      {/* Business list implementation */}
    </div>
  )
}

async function AllBusinessesList() {
  // This would typically fetch all businesses for admin view
  return (
    <div className="all-businesses-list">
      <p>All businesses (admin view) will appear here...</p>
      {/* Admin business list implementation */}
    </div>
  )
}

async function UserManagement() {
  return (
    <div className="user-management-content">
      <p>User management interface will appear here...</p>
      {/* User management implementation */}
    </div>
  )
}

async function SystemSettings() {
  return (
    <div className="system-settings-content">
      <p>System settings interface will appear here...</p>
      {/* System settings implementation */}
    </div>
  )
}

async function SecurityMonitoring() {
  return (
    <div className="security-monitoring-content">
      <p>Security monitoring dashboard will appear here...</p>
      {/* Security monitoring implementation */}
    </div>
  )
}

// Loading components for better UX
export function AuthLoadingSkeleton() {
  return (
    <div className="auth-loading-skeleton">
      <div className="skeleton-header">
        <div className="skeleton-line skeleton-line-short"></div>
      </div>
      <div className="skeleton-content">
        <div className="skeleton-line"></div>
        <div className="skeleton-line"></div>
        <div className="skeleton-line skeleton-line-short"></div>
      </div>
    </div>
  )
}

export function DashboardLoadingSkeleton() {
  return (
    <div className="dashboard-loading-skeleton">
      <div className="skeleton-header">
        <div className="skeleton-line skeleton-line-long"></div>
        <div className="skeleton-line skeleton-line-short"></div>
      </div>
      <div className="skeleton-grid">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton-card">
            <div className="skeleton-line"></div>
            <div className="skeleton-line skeleton-line-short"></div>
          </div>
        ))}
      </div>
    </div>
  )
}

// CSS classes would typically be in a separate file
const styles = `
.protected-dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.dashboard-header {
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 1rem;
  margin-bottom: 2rem;
}

.session-info {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: #6b7280;
  margin-top: 0.5rem;
}

.user-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat {
  display: flex;
  justify-content: space-between;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
}

.skeleton-line {
  height: 1rem;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 0.25rem;
  margin-bottom: 0.5rem;
}

.skeleton-line-short {
  width: 60%;
}

.skeleton-line-long {
  width: 80%;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`