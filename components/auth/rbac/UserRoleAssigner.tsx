'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, UserPlus, UserMinus, Search, Filter, Calendar,
  Clock, Shield, Crown, Building2, MapPin, AlertTriangle,
  Check, X, Eye, EyeOff, ChevronDown, ChevronRight,
  MoreHorizontal, Edit3, Trash2, RefreshCw, Download,
  Upload, Settings, Info, Zap, Wrench, User
} from 'lucide-react';
import { GlassMorphism } from '../../GlassMorphism';
import { cn } from '@/lib/utils';
import type { 
  UserRoleAssignerProps, 
  RoleDefinition, 
  UserRoleAssignment,
  BusinessContext,
  UserRole
} from './types';
import type { UserProfile } from '../types';

// Role icons (consistent with other components)
const roleIcons = {
  customer: User,
  business_owner: Building2,
  service_provider: Wrench,
  moderator: Shield,
  admin: Crown,
  super_admin: Zap
} as const;

// Role colors
const roleColors = {
  customer: 'bg-sage/20 text-sage border-sage/30',
  business_owner: 'bg-gold-primary/20 text-gold-primary border-gold-primary/30',
  service_provider: 'bg-teal-primary/20 text-teal-primary border-teal-primary/30',
  moderator: 'bg-navy-dark/20 text-sage border-sage/30',
  admin: 'bg-red-error/20 text-red-error border-red-error/30',
  super_admin: 'bg-gradient-to-r from-gold-primary/20 to-red-error/20 text-gold-primary border-gold-primary/30'
} as const;

interface UserCardProps {
  user: UserProfile & { roleAssignments: UserRoleAssignment[] };
  roles: RoleDefinition[];
  businessContexts: BusinessContext[];
  selectedContext: BusinessContext;
  onRoleAssign: (roleId: string, options?: any) => Promise<void>;
  onRoleRevoke: (assignmentId: string, reason?: string) => Promise<void>;
  readonly: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
}

const UserCard: React.FC<UserCardProps> = ({
  user,
  roles,
  businessContexts,
  selectedContext,
  onRoleAssign,
  onRoleRevoke,
  readonly,
  expanded,
  onToggleExpand
}) => {
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [assignmentOptions, setAssignmentOptions] = useState({
    expiresAt: '',
    reason: ''
  });
  const [loading, setLoading] = useState<string | null>(null);

  // Get active assignments for the selected context
  const contextAssignments = user.roleAssignments.filter(
    assignment => 
      assignment.businessContext.id === selectedContext.id && 
      assignment.isActive &&
      (!assignment.expiresAt || new Date(assignment.expiresAt) > new Date())
  );

  // Get available roles for assignment
  const availableRoles = roles.filter(role => 
    role.isActive &&
    role.contexts.some(ctx => ctx.id === selectedContext.id) &&
    !contextAssignments.some(assignment => assignment.roleId === role.id)
  );

  const handleAssignRole = async () => {
    if (!selectedRole || loading) return;

    setLoading('assign');
    try {
      const options: any = {};
      if (assignmentOptions.expiresAt) {
        options.expiresAt = new Date(assignmentOptions.expiresAt);
      }
      if (assignmentOptions.reason.trim()) {
        options.reason = assignmentOptions.reason.trim();
      }

      await onRoleAssign(selectedRole, options);
      setShowAssignMenu(false);
      setSelectedRole('');
      setAssignmentOptions({ expiresAt: '', reason: '' });
    } catch (error) {
      console.error('Failed to assign role:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleRevokeRole = async (assignmentId: string, roleName: string) => {
    if (loading) return;

    const reason = prompt(`Why are you revoking the "${roleName}" role?`);
    if (reason === null) return; // User cancelled

    setLoading('revoke-' + assignmentId);
    try {
      await onRoleRevoke(assignmentId, reason);
    } catch (error) {
      console.error('Failed to revoke role:', error);
    } finally {
      setLoading(null);
    }
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'p-4 rounded-lg border transition-all duration-200',
        expanded 
          ? 'bg-gradient-to-r from-teal-primary/10 to-sage/10 border-teal-primary/30' 
          : 'bg-navy-50/10 border-sage/10 hover:border-sage/30'
      )}
    >
      {/* User Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onToggleExpand}
            className="p-1 rounded hover:bg-white/10 transition-colors"
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-sage" />
            ) : (
              <ChevronRight className="w-4 h-4 text-sage" />
            )}
          </motion.button>

          {/* Avatar */}
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.fullName}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-primary/20 to-sage/20 
                           flex items-center justify-center">
              <User className="w-5 h-5 text-sage" />
            </div>
          )}

          {/* User Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-cream truncate">{user.fullName}</h3>
              {!user.isEmailVerified && (
                <AlertTriangle className="w-4 h-4 text-gold-primary" aria-label="Email not verified" />
              )}
            </div>
            <p className="text-sm text-sage/70 truncate">{user.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-sage/50 capitalize">
                {user.businessType?.replace('_', ' ')}
              </span>
              {user.location && (
                <>
                  <span className="text-xs text-sage/30">•</span>
                  <span className="text-xs text-sage/50 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {user.location.city}, {user.location.state}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quick Role Status */}
        <div className="flex items-center gap-2">
          {contextAssignments.slice(0, 3).map(assignment => {
            const role = roles.find(r => r.id === assignment.roleId);
            if (!role) return null;

            const RoleIcon = roleIcons[role.name as UserRole] || Shield;
            const colorClass = roleColors[role.name as UserRole] || roleColors.customer;

            return (
              <div
                key={assignment.id}
                className={cn('px-2 py-1 rounded text-xs border', colorClass)}
                title={role.displayName}
              >
                <RoleIcon className="w-3 h-3" />
              </div>
            );
          })}
          {contextAssignments.length > 3 && (
            <div className="px-2 py-1 rounded text-xs bg-sage/20 text-sage border border-sage/30">
              +{contextAssignments.length - 3}
            </div>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-4 space-y-4"
          >
            {/* Current Roles */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-cream">
                  Current Roles in {selectedContext.name}
                </h4>
                {!readonly && availableRoles.length > 0 && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowAssignMenu(!showAssignMenu)}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-teal-primary/20 text-teal-primary 
                             rounded hover:bg-teal-primary/30 transition-colors"
                  >
                    <UserPlus className="w-3 h-3" />
                    Assign Role
                  </motion.button>
                )}
              </div>

              {contextAssignments.length === 0 ? (
                <p className="text-sm text-sage/50 italic">No roles assigned in this context</p>
              ) : (
                <div className="space-y-2">
                  {contextAssignments.map(assignment => {
                    const role = roles.find(r => r.id === assignment.roleId);
                    if (!role) return null;

                    const RoleIcon = roleIcons[role.name as UserRole] || Shield;
                    const isExpiring = assignment.expiresAt && 
                      new Date(assignment.expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

                    return (
                      <motion.div
                        key={assignment.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between p-3 bg-navy-50/10 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 bg-gradient-to-br from-teal-primary/20 to-sage/20 rounded-full">
                            <RoleIcon className="w-4 h-4 text-sage" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-cream">{role.displayName}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-sage/70">
                              <span>Assigned {formatTimeAgo(new Date(assignment.assignedAt))}</span>
                              {assignment.expiresAt && (
                                <>
                                  <span>•</span>
                                  <span className={isExpiring ? 'text-gold-primary' : 'text-sage/70'}>
                                    Expires {new Date(assignment.expiresAt).toLocaleDateString()}
                                  </span>
                                </>
                              )}
                              {assignment.reason && (
                                <>
                                  <span>•</span>
                                  <span title={assignment.reason}>
                                    {assignment.reason.length > 20 
                                      ? assignment.reason.substring(0, 20) + '...'
                                      : assignment.reason}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {!readonly && !role.isSystemRole && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleRevokeRole(assignment.id, role.displayName)}
                            disabled={loading === 'revoke-' + assignment.id}
                            className="p-1.5 text-sage/70 hover:text-red-error hover:bg-red-error/20 rounded 
                                     transition-colors disabled:opacity-50"
                          >
                            {loading === 'revoke-' + assignment.id ? (
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                className="w-4 h-4 border-2 border-sage/30 border-t-sage rounded-full"
                              />
                            ) : (
                              <UserMinus className="w-4 h-4" />
                            )}
                          </motion.button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Role Assignment Form */}
            <AnimatePresence>
              {showAssignMenu && availableRoles.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 bg-teal-primary/10 border border-teal-primary/30 rounded-lg"
                >
                  <h5 className="text-sm font-medium text-cream mb-3">Assign New Role</h5>
                  <div className="space-y-3">
                    {/* Role Selection */}
                    <div>
                      <label className="block text-xs text-sage/70 mb-1">Select Role</label>
                      <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        className="w-full px-3 py-2 bg-navy-dark/50 border border-sage/30 rounded text-cream text-sm
                                   focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
                      >
                        <option value="">Choose a role...</option>
                        {availableRoles.map(role => (
                          <option key={role.id} value={role.id}>
                            {role.displayName} - {role.permissions.length} permissions
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Expiry Date */}
                    <div>
                      <label className="block text-xs text-sage/70 mb-1">
                        Expiry Date (optional)
                      </label>
                      <input
                        type="date"
                        value={assignmentOptions.expiresAt}
                        onChange={(e) => setAssignmentOptions({
                          ...assignmentOptions,
                          expiresAt: e.target.value
                        })}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2 bg-navy-dark/50 border border-sage/30 rounded text-cream text-sm
                                   focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
                      />
                    </div>

                    {/* Reason */}
                    <div>
                      <label className="block text-xs text-sage/70 mb-1">
                        Reason for Assignment (optional)
                      </label>
                      <input
                        type="text"
                        value={assignmentOptions.reason}
                        onChange={(e) => setAssignmentOptions({
                          ...assignmentOptions,
                          reason: e.target.value
                        })}
                        placeholder="e.g., Project manager for Q1 campaign"
                        className="w-full px-3 py-2 bg-navy-dark/50 border border-sage/30 rounded text-cream text-sm
                                   focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        onClick={() => setShowAssignMenu(false)}
                        className="px-3 py-1.5 text-sm text-sage/70 hover:text-cream transition-colors"
                      >
                        Cancel
                      </button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleAssignRole}
                        disabled={!selectedRole || loading === 'assign'}
                        className="flex items-center gap-1 px-3 py-1.5 bg-teal-primary text-cream rounded text-sm
                                   hover:bg-teal-secondary transition-colors disabled:opacity-50"
                      >
                        {loading === 'assign' ? (
                          <>
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                              className="w-3 h-3 border border-cream/30 border-t-cream rounded-full"
                            />
                            Assigning...
                          </>
                        ) : (
                          <>
                            <Check className="w-3 h-3" />
                            Assign Role
                          </>
                        )}
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

interface BulkAssignmentProps {
  selectedUsers: Set<string>;
  roles: RoleDefinition[];
  businessContexts: BusinessContext[];
  selectedContext: BusinessContext;
  onBulkAssign: (assignments: Array<{
    userId: string;
    roleId: string;
    context: BusinessContext;
  }>) => Promise<void>;
  onClose: () => void;
}

const BulkAssignmentModal: React.FC<BulkAssignmentProps> = ({
  selectedUsers,
  roles,
  businessContexts,
  selectedContext,
  onBulkAssign,
  onClose
}) => {
  const [selectedRole, setSelectedRole] = useState('');
  const [loading, setLoading] = useState(false);

  const availableRoles = roles.filter(role => 
    role.isActive &&
    role.contexts.some(ctx => ctx.id === selectedContext.id)
  );

  const handleBulkAssign = async () => {
    if (!selectedRole) return;

    setLoading(true);
    try {
      const assignments = Array.from(selectedUsers).map(userId => ({
        userId,
        roleId: selectedRole,
        context: selectedContext
      }));

      await onBulkAssign(assignments);
      onClose();
    } catch (error) {
      console.error('Bulk assignment failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-navy-dark/80 backdrop-blur-sm z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md mx-4"
      >
        <GlassMorphism variant="medium" className="p-6" border shadow>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-cream">Bulk Role Assignment</h3>
            <button
              onClick={onClose}
              className="p-1 text-sage/70 hover:text-cream transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-sage/70 mb-2">
                Assigning role to {selectedUsers.size} user{selectedUsers.size !== 1 ? 's' : ''} 
                in context: <span className="text-cream font-medium">{selectedContext.name}</span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-cream mb-2">
                Select Role to Assign
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2 bg-navy-dark/50 border border-sage/30 rounded text-cream
                           focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
              >
                <option value="">Choose a role...</option>
                {availableRoles.map(role => (
                  <option key={role.id} value={role.id}>
                    {role.displayName} ({role.permissions.length} permissions)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sage/70 hover:text-cream transition-colors"
              >
                Cancel
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleBulkAssign}
                disabled={!selectedRole || loading}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-primary to-teal-secondary
                           text-cream rounded hover:shadow-lg transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-4 h-4 border-2 border-cream/30 border-t-cream rounded-full"
                    />
                    Assigning...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Assign to All
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </GlassMorphism>
      </motion.div>
    </motion.div>
  );
};

export const UserRoleAssigner: React.FC<UserRoleAssignerProps> = ({
  users,
  roles,
  businessContexts,
  onRoleAssign,
  onRoleRevoke,
  onBulkAssign,
  readonly = false,
  className = ''
}) => {
  const [selectedContext, setSelectedContext] = useState<BusinessContext>(
    businessContexts.find(ctx => ctx.type === 'global') || businessContexts[0]
  );
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Filter users based on search and role filter
  const filteredUsers = useMemo(() => {
    let filtered = users;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user =>
        user.fullName.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.businessType?.toLowerCase().includes(query)
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(user =>
        user.roleAssignments.some(assignment =>
          assignment.businessContext.id === selectedContext.id &&
          assignment.roleId === roleFilter &&
          assignment.isActive
        )
      );
    }

    return filtered.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [users, searchQuery, roleFilter, selectedContext]);

  const handleToggleExpand = useCallback((userId: string) => {
    setExpandedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  }, []);

  const handleToggleSelect = useCallback((userId: string) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const expandAll = () => {
    setExpandedUsers(new Set(filteredUsers.map(u => u.id)));
  };

  const collapseAll = () => {
    setExpandedUsers(new Set());
  };

  const contextRoles = roles.filter(role =>
    role.contexts.some(ctx => ctx.id === selectedContext.id)
  );

  return (
    <GlassMorphism
      variant="medium"
      className={cn('w-full p-6', className)}
      animated
      border
      shadow
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-teal-primary/20 to-sage/20 rounded-full">
            <Users className="w-6 h-6 text-sage" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-cream">User Role Assignment</h2>
            <p className="text-sm text-sage/70">
              Manage user roles across different business contexts
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Context Selector */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-cream mb-1">
            Business Context
          </label>
          <select
            value={selectedContext.id}
            onChange={(e) => {
              const context = businessContexts.find(ctx => ctx.id === e.target.value);
              if (context) setSelectedContext(context);
            }}
            className="w-full px-3 py-2 bg-navy-dark/50 border border-sage/30 rounded text-cream
                       focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
          >
            {businessContexts.map(context => (
              <option key={context.id} value={context.id}>
                {context.name} ({context.type})
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-cream mb-1">
            Search Users
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-8 pr-3 py-2 bg-navy-dark/50 border border-sage/30 rounded text-cream
                         focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
            />
            <Search className="absolute left-2.5 top-2.5 w-3 h-3 text-sage/50" />
          </div>
        </div>

        {/* Role Filter */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-cream mb-1">
            Filter by Role
          </label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-3 py-2 bg-navy-dark/50 border border-sage/30 rounded text-cream
                       focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
          >
            <option value="all">All Roles</option>
            {contextRoles.map(role => (
              <option key={role.id} value={role.id}>
                {role.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bulk Actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
              onChange={handleSelectAll}
              className="w-4 h-4 text-teal-primary rounded focus:ring-teal-primary/50"
            />
            <span className="text-sm text-cream">
              Select All ({selectedUsers.size} selected)
            </span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          {selectedUsers.size > 0 && !readonly && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowBulkModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-teal-primary/20 text-teal-primary rounded
                         hover:bg-teal-primary/30 transition-colors text-sm"
            >
              <UserPlus className="w-3 h-3" />
              Bulk Assign ({selectedUsers.size})
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={expandAll}
            className="p-1.5 text-sage/70 hover:text-cream hover:bg-sage/20 rounded transition-colors"
            title="Expand All"
          >
            <Eye className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={collapseAll}
            className="p-1.5 text-sage/70 hover:text-cream hover:bg-sage/20 rounded transition-colors"
            title="Collapse All"
          >
            <EyeOff className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* User List */}
      <div className="space-y-3 min-h-[400px]">
        {filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Users className="w-12 h-12 text-sage/30 mb-4" />
            <p className="text-sage/70 text-center">
              {searchQuery || roleFilter !== 'all' 
                ? 'No users match your filters' 
                : 'No users found in this context'}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredUsers.map(user => (
              <div key={user.id} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedUsers.has(user.id)}
                  onChange={() => handleToggleSelect(user.id)}
                  className="mt-4 w-4 h-4 text-teal-primary rounded focus:ring-teal-primary/50"
                />
                <div className="flex-1">
                  <UserCard
                    user={user}
                    roles={roles}
                    businessContexts={businessContexts}
                    selectedContext={selectedContext}
                    onRoleAssign={(roleId, options) => onRoleAssign(user.id, roleId, selectedContext, options)}
                    onRoleRevoke={onRoleRevoke}
                    readonly={readonly}
                    expanded={expandedUsers.has(user.id)}
                    onToggleExpand={() => handleToggleExpand(user.id)}
                  />
                </div>
              </div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Stats */}
      <div className="mt-6 pt-4 border-t border-sage/10 grid grid-cols-4 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold text-cream">{filteredUsers.length}</p>
          <p className="text-xs text-sage/70">Total Users</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-teal-primary">{selectedUsers.size}</p>
          <p className="text-xs text-sage/70">Selected</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-sage">{contextRoles.length}</p>
          <p className="text-xs text-sage/70">Available Roles</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gold-primary">
            {filteredUsers.reduce((acc, user) => 
              acc + user.roleAssignments.filter(a => 
                a.businessContext.id === selectedContext.id && a.isActive
              ).length, 0)}
          </p>
          <p className="text-xs text-sage/70">Active Assignments</p>
        </div>
      </div>

      {/* Bulk Assignment Modal */}
      <AnimatePresence>
        {showBulkModal && (
          <BulkAssignmentModal
            selectedUsers={selectedUsers}
            roles={roles}
            businessContexts={businessContexts}
            selectedContext={selectedContext}
            onBulkAssign={onBulkAssign}
            onClose={() => setShowBulkModal(false)}
          />
        )}
      </AnimatePresence>
    </GlassMorphism>
  );
};

export default UserRoleAssigner;