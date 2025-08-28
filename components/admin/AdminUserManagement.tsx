'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Shield,
  Crown,
  Eye,
  Edit3,
  Lock,
  Unlock,
  Search,
  Filter,
  Download,
  MoreVertical,
  Mail,
  Calendar,
  MapPin,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Key,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '@/components/GlassMorphism';
import { AdminTypes } from './types';
import { useAdminDataService } from './AdminDataService';
import { useAdminNotificationHelpers } from './AdminNotificationSystem';
import { AdminLoadingSpinner, AdminOperationFeedback } from './AdminLoadingStates';

// Use the proper types from the types file
type AdminUser = AdminTypes.User;

interface AdminUserManagementProps {
  className?: string;
}

// Mock admin users data
const mockAdminUsers: AdminUser[] = [
  {
    id: 'admin-1',
    email: 'admin@lawlessdirectory.com',
    name: 'System Administrator',
    role: 'super_admin',
    status: 'active',
    permissions: ['read:all', 'write:all', 'admin:all'],
    createdAt: new Date('2024-01-01'),
    lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000),
    loginCount: 1243,
    ipWhitelist: ['192.168.1.100', '203.0.113.45'],
    mfaEnabled: true,
    trustedDevices: 3,
    failedAttempts: 0,
    location: 'San Francisco, CA',
    createdBy: 'system'
  },
  {
    id: 'admin-2',
    email: 'platform@lawlessdirectory.com',
    name: 'Platform Manager',
    role: 'platform_admin',
    status: 'active',
    permissions: ['read:users', 'write:users', 'read:businesses', 'write:businesses'],
    createdAt: new Date('2024-02-15'),
    lastLogin: new Date(Date.now() - 45 * 60 * 1000),
    loginCount: 456,
    ipWhitelist: ['198.51.100.23'],
    mfaEnabled: true,
    trustedDevices: 2,
    failedAttempts: 0,
    location: 'New York, NY',
    createdBy: 'admin-1'
  },
  {
    id: 'admin-3',
    email: 'support@lawlessdirectory.com',
    name: 'Support Lead',
    role: 'support_admin',
    status: 'active',
    permissions: ['read:users', 'read:businesses', 'write:support'],
    createdAt: new Date('2024-03-10'),
    lastLogin: new Date(Date.now() - 8 * 60 * 60 * 1000),
    loginCount: 234,
    ipWhitelist: [],
    mfaEnabled: true,
    trustedDevices: 1,
    failedAttempts: 1,
    location: 'Austin, TX',
    createdBy: 'admin-1'
  },
  {
    id: 'admin-4',
    email: 'moderator@lawlessdirectory.com',
    name: 'Content Moderator',
    role: 'content_moderator',
    status: 'suspended',
    permissions: ['read:content', 'write:content'],
    createdAt: new Date('2024-04-20'),
    lastLogin: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    loginCount: 89,
    ipWhitelist: [],
    mfaEnabled: false,
    trustedDevices: 0,
    failedAttempts: 5,
    location: 'Remote',
    createdBy: 'admin-2'
  }
];

const getRoleIcon = (role: AdminUser['role']) => {
  switch (role) {
    case 'super_admin': return Crown;
    case 'platform_admin': return Shield;
    case 'support_admin': return UserCheck;
    case 'content_moderator': return Eye;
    default: return Users;
  }
};

const getRoleColor = (role: AdminUser['role']) => {
  switch (role) {
    case 'super_admin': return 'text-red-400';
    case 'platform_admin': return 'text-purple-400';
    case 'support_admin': return 'text-blue-400';
    case 'content_moderator': return 'text-green-400';
    default: return 'text-sage/60';
  }
};

const getStatusIcon = (status: AdminUser['status']) => {
  switch (status) {
    case 'active': return CheckCircle;
    case 'inactive': return Clock;
    case 'suspended': return XCircle;
    case 'locked': return Lock;
    default: return AlertTriangle;
  }
};

const getStatusColor = (status: AdminUser['status']) => {
  switch (status) {
    case 'active': return 'text-green-400';
    case 'inactive': return 'text-yellow-400';
    case 'suspended': return 'text-red-400';
    case 'locked': return 'text-red-500';
    default: return 'text-sage/60';
  }
};

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
};

const AdminUserCard: React.FC<{
  user: AdminUser;
  onEdit: (user: AdminUser) => void;
  onViewDetails: (user: AdminUser) => void;
  onChangeStatus: (userId: string, status: AdminUser['status']) => void;
  onImpersonate: (userId: string) => void;
}> = ({ user, onEdit, onViewDetails, onChangeStatus, onImpersonate }) => {
  const [showMenu, setShowMenu] = useState(false);
  const RoleIcon = getRoleIcon(user.role);
  const StatusIcon = getStatusIcon(user.status);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        'p-6 rounded-lg border transition-all duration-200',
        user.status === 'active'
          ? 'bg-teal-primary/5 border-teal-primary/20'
          : user.status === 'suspended' || user.status === 'locked'
          ? 'bg-red-500/5 border-red-500/20'
          : 'bg-navy-dark/30 border-sage/20'
      )}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="relative">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 bg-teal-primary/20 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-teal-primary" />
                </div>
              )}
              
              {/* MFA indicator */}
              {user.mfaEnabled && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <Key className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </div>

            {/* User info */}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-cream">{user.name}</h3>
                <div className={cn('flex items-center gap-1', getStatusColor(user.status))}>
                  <StatusIcon className="w-4 h-4" />
                  <span className="text-xs font-medium capitalize">{user.status}</span>
                </div>
              </div>
              <p className="text-sage/60">{user.email}</p>
              
              <div className="flex items-center gap-4 mt-2 text-sm">
                <div className={cn('flex items-center gap-1', getRoleColor(user.role))}>
                  <RoleIcon className="w-4 h-4" />
                  <span className="capitalize">{user.role.replace('_', ' ')}</span>
                </div>
                
                {user.location && (
                  <div className="flex items-center gap-1 text-sage/50">
                    <MapPin className="w-3 h-3" />
                    <span>{user.location}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 hover:bg-sage/10 rounded-lg transition-colors"
            >
              <MoreVertical className="w-4 h-4 text-sage/70" />
            </button>

            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="absolute right-0 top-full mt-2 w-48 z-10"
                  onMouseLeave={() => setShowMenu(false)}
                >
                  <GlassMorphism variant="medium" className="py-2">
                    <button
                      onClick={() => {
                        onViewDetails(user);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-sage/70 hover:text-cream hover:bg-teal-primary/10 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                    
                    <button
                      onClick={() => {
                        onEdit(user);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-sage/70 hover:text-cream hover:bg-teal-primary/10 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit User
                    </button>

                    {user.status === 'active' && (
                      <button
                        onClick={() => {
                          onImpersonate(user.id);
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/10 transition-colors"
                      >
                        <UserCheck className="w-4 h-4" />
                        Impersonate
                      </button>
                    )}

                    <div className="border-t border-sage/10 my-2" />

                    {user.status === 'active' ? (
                      <button
                        onClick={() => {
                          onChangeStatus(user.id, 'suspended');
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Lock className="w-4 h-4" />
                        Suspend User
                      </button>
                    ) : user.status === 'suspended' ? (
                      <button
                        onClick={() => {
                          onChangeStatus(user.id, 'active');
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-green-400 hover:bg-green-500/10 transition-colors"
                      >
                        <Unlock className="w-4 h-4" />
                        Reactivate User
                      </button>
                    ) : null}
                  </GlassMorphism>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-cream">{user.loginCount}</p>
            <p className="text-xs text-sage/60">Total Logins</p>
          </div>
          
          <div className="text-center">
            <p className="text-2xl font-bold text-cream">{user.trustedDevices}</p>
            <p className="text-xs text-sage/60">Trusted Devices</p>
          </div>
          
          <div className="text-center">
            <p className="text-2xl font-bold text-cream">{user.ipWhitelist.length}</p>
            <p className="text-xs text-sage/60">Whitelisted IPs</p>
          </div>
          
          <div className="text-center">
            <p className={cn('text-2xl font-bold', user.failedAttempts > 0 ? 'text-red-400' : 'text-cream')}>
              {user.failedAttempts}
            </p>
            <p className="text-xs text-sage/60">Failed Attempts</p>
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between pt-4 border-t border-sage/10 text-sm text-sage/60">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Created {formatTimeAgo(user.createdAt)}
            </span>
            
            {user.lastLogin && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Last login {formatTimeAgo(user.lastLogin)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {user.mfaEnabled && (
              <div className="flex items-center gap-1 text-green-400">
                <Key className="w-3 h-3" />
                <span className="text-xs">MFA</span>
              </div>
            )}
            
            <span className="text-xs">
              {user.permissions.length} permissions
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const AdminUserManagement: React.FC<AdminUserManagementProps> = ({
  className = ''
}) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<AdminUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | AdminUser['role']>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | AdminUser['status']>('all');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use admin services
  const { getUsers, updateUser, deleteUser } = useAdminDataService();
  const { 
    showUserActionSuccess, 
    showUserActionError, 
    showSystemError 
  } = useAdminNotificationHelpers();

  // Load users on component mount
  useEffect(() => {
    const loadUsers = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const userData = await getUsers();
        setUsers(userData);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load users';
        setError(errorMessage);
        showSystemError('Failed to load user data', errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    loadUsers();
  }, [getUsers, showSystemError]);

  // Filter users based on search and filters
  useEffect(() => {
    let filtered = users;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Role filter
    if (filterRole !== 'all') {
      filtered = filtered.filter(user => user.role === filterRole);
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(user => user.status === filterStatus);
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, filterRole, filterStatus]);

  const handleChangeStatus = async (userId: string, status: AdminUser['status']) => {
    try {
      const updatedUser = await updateUser(userId, { status });
      
      setUsers(prev => 
        prev.map(user => 
          user.id === userId ? updatedUser : user
        )
      );
      
      const statusAction = status === 'suspended' ? 'suspended' : 'activated';
      showUserActionSuccess(
        `User ${statusAction} successfully`,
        `${updatedUser.name} has been ${statusAction}`
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update user status';
      showUserActionError('Failed to update user status', errorMessage);
    }
  };

  const handleEdit = (user: AdminUser) => {
    setSelectedUser(user);
    // Open edit modal - implementation would go here
  };

  const handleViewDetails = (user: AdminUser) => {
    setSelectedUser(user);
    // Open details modal - implementation would go here
  };

  const handleImpersonate = (userId: string) => {
    // Implementation for user impersonation
    console.log('Impersonating user:', userId);
    // In production, this would switch context to impersonate the user
  };

  const exportUsers = () => {
    const csvContent = [
      ['Name', 'Email', 'Role', 'Status', 'MFA Enabled', 'Login Count', 'Last Login', 'Created At'],
      ...filteredUsers.map(user => [
        user.name,
        user.email,
        user.role,
        user.status,
        user.mfaEnabled ? 'Yes' : 'No',
        user.loginCount.toString(),
        user.lastLogin?.toISOString() || 'Never',
        user.createdAt.toISOString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-users-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const stats = {
    total: filteredUsers.length,
    active: filteredUsers.filter(u => u.status === 'active').length,
    suspended: filteredUsers.filter(u => u.status === 'suspended').length,
    mfaEnabled: filteredUsers.filter(u => u.mfaEnabled).length
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-cream">Admin User Management</h1>
          <p className="text-sage/70 mt-1">
            Manage administrator accounts and permissions
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={exportUsers}
            className="flex items-center gap-2 px-4 py-2 bg-sage/10 border border-sage/20 text-sage/70 rounded-lg hover:bg-sage/20 hover:text-cream transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-primary to-teal-secondary text-cream rounded-lg hover:shadow-lg transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Add Admin User
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassMorphism variant="medium" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cream">{stats.total}</p>
              <p className="text-sm text-sage/60">Total Admins</p>
            </div>
          </div>
        </GlassMorphism>

        <GlassMorphism variant="medium" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cream">{stats.active}</p>
              <p className="text-sm text-sage/60">Active</p>
            </div>
          </div>
        </GlassMorphism>

        <GlassMorphism variant="medium" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <XCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cream">{stats.suspended}</p>
              <p className="text-sm text-sage/60">Suspended</p>
            </div>
          </div>
        </GlassMorphism>

        <GlassMorphism variant="medium" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-primary/10 rounded-lg">
              <Key className="w-5 h-5 text-teal-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cream">{stats.mfaEnabled}</p>
              <p className="text-sm text-sage/60">MFA Enabled</p>
            </div>
          </div>
        </GlassMorphism>
      </div>

      {/* Filters */}
      <GlassMorphism variant="medium" className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-sage/50" />
            </div>
            <input
              type="text"
              placeholder="Search by name, email, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-navy-dark/30 border border-sage/20 rounded-lg text-cream placeholder-sage/50 focus:outline-none focus:ring-2 focus:ring-teal-primary focus:border-transparent"
            />
          </div>

          {/* Role filter */}
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as any)}
            className="px-4 py-2 bg-navy-dark/30 border border-sage/20 rounded-lg text-cream focus:outline-none focus:ring-2 focus:ring-teal-primary"
          >
            <option value="all">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="platform_admin">Platform Admin</option>
            <option value="support_admin">Support Admin</option>
            <option value="content_moderator">Content Moderator</option>
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-4 py-2 bg-navy-dark/30 border border-sage/20 rounded-lg text-cream focus:outline-none focus:ring-2 focus:ring-teal-primary"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
            <option value="locked">Locked</option>
          </select>
        </div>
      </GlassMorphism>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <AdminLoadingSpinner size="lg" />
          <span className="ml-3 text-sage/70">Loading users...</span>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <AdminOperationFeedback
          type="error"
          message="Failed to load users"
          details={error}
          onClose={() => setError(null)}
        />
      )}

      {/* Users list */}
      {!isLoading && !error && (
        <div className="space-y-4">
          <AnimatePresence>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <AdminUserCard
                  key={user.id}
                  user={user}
                  onEdit={handleEdit}
                  onViewDetails={handleViewDetails}
                  onChangeStatus={handleChangeStatus}
                  onImpersonate={handleImpersonate}
                />
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <Users className="w-12 h-12 text-sage/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-sage/70">No admin users found</h3>
                <p className="text-sage/50 mt-1">
                  Try adjusting your search criteria or filters
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default AdminUserManagement;