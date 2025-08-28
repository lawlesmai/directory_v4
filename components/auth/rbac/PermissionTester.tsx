'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TestTube, Play, RotateCcw, Check, X, AlertTriangle,
  User, Users, Shield, Crown, Building2, Wrench, Zap,
  ChevronRight, ChevronDown, Info, CheckCircle, XCircle,
  AlertCircle, Lightbulb, ArrowRight, Copy, Download
} from 'lucide-react';
import { GlassMorphism } from '../../GlassMorphism';
import { cn } from '@/lib/utils';
import type { 
  PermissionTesterProps, 
  RoleDefinition, 
  PermissionDefinition,
  BusinessContext,
  Permission,
  UserRole
} from './types';
import type { UserProfile } from '../types';

// Role icons
const roleIcons = {
  customer: User,
  business_owner: Building2,
  service_provider: Wrench,
  moderator: Shield,
  admin: Crown,
  super_admin: Zap
} as const;

// Permission risk level colors
const riskLevelColors = {
  low: 'text-sage',
  medium: 'text-teal-primary',
  high: 'text-gold-primary',
  critical: 'text-red-error'
} as const;

interface TestConfiguration {
  userId?: string;
  roleIds: string[];
  permissions: Permission[];
  context: BusinessContext;
}

interface TestResult {
  granted: Permission[];
  denied: Permission[];
  conflicts: Array<{ permission: Permission; reason: string }>;
  recommendations: Array<{ 
    type: 'grant' | 'revoke'; 
    permission: Permission; 
    reason: string;
  }>;
}

interface PermissionResultItemProps {
  permission: PermissionDefinition | undefined;
  status: 'granted' | 'denied' | 'conflict';
  reason?: string;
  expanded: boolean;
  onToggleExpand: () => void;
}

const PermissionResultItem: React.FC<PermissionResultItemProps> = ({
  permission,
  status,
  reason,
  expanded,
  onToggleExpand
}) => {
  if (!permission) return null;

  const StatusIcon = {
    granted: CheckCircle,
    denied: XCircle,
    conflict: AlertCircle
  }[status];

  const statusColor = {
    granted: 'text-sage',
    denied: 'text-red-error',
    conflict: 'text-gold-primary'
  }[status];

  const statusBg = {
    granted: 'bg-sage/10 border-sage/30',
    denied: 'bg-red-error/10 border-red-error/30',
    conflict: 'bg-gold-primary/10 border-gold-primary/30'
  }[status];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'p-3 rounded-lg border transition-all duration-200',
        statusBg
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={cn('p-1.5 rounded-full', statusBg)}>
            <StatusIcon className={cn('w-4 h-4', statusColor)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-cream truncate">
                {permission.displayName}
              </p>
              <div className={cn(
                'w-2 h-2 rounded-full',
                riskLevelColors[permission.riskLevel]?.replace('text-', 'bg-') || 'bg-sage'
              )} />
              <span className="text-xs text-sage/50 capitalize">
                {permission.riskLevel}
              </span>
            </div>
            <p className="text-sm text-sage/70 mt-1">{permission.description}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-sage/50">
              <span>{permission.resource} • {permission.action}</span>
              {permission.dependencies && permission.dependencies.length > 0 && (
                <span title="Has dependencies">
                  {permission.dependencies.length} dependencies
                </span>
              )}
            </div>
            {reason && (
              <p className="text-sm text-sage/60 mt-2 italic">{reason}</p>
            )}
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onToggleExpand}
          className="p-1 text-sage/50 hover:text-sage transition-colors"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </motion.button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-3 pt-3 border-t border-white/10"
          >
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sage/50 text-xs uppercase tracking-wide">Resource</p>
                  <p className="text-cream capitalize">{permission.resource}</p>
                </div>
                <div>
                  <p className="text-sage/50 text-xs uppercase tracking-wide">Action</p>
                  <p className="text-cream capitalize">{permission.action}</p>
                </div>
                <div>
                  <p className="text-sage/50 text-xs uppercase tracking-wide">Risk Level</p>
                  <p className={cn('capitalize font-medium', riskLevelColors[permission.riskLevel])}>
                    {permission.riskLevel}
                  </p>
                </div>
                <div>
                  <p className="text-sage/50 text-xs uppercase tracking-wide">Category</p>
                  <p className="text-cream">{permission.category}</p>
                </div>
              </div>
              
              {permission.dependencies && permission.dependencies.length > 0 && (
                <div>
                  <p className="text-sage/50 text-xs uppercase tracking-wide mb-1">Dependencies</p>
                  <div className="flex flex-wrap gap-1">
                    {permission.dependencies.map(dep => (
                      <span
                        key={dep}
                        className="px-2 py-0.5 text-xs bg-teal-primary/20 text-teal-primary rounded"
                      >
                        {dep}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {permission.conflicts && permission.conflicts.length > 0 && (
                <div>
                  <p className="text-sage/50 text-xs uppercase tracking-wide mb-1">Conflicts</p>
                  <div className="flex flex-wrap gap-1">
                    {permission.conflicts.map(conflict => (
                      <span
                        key={conflict}
                        className="px-2 py-0.5 text-xs bg-red-error/20 text-red-error rounded"
                      >
                        {conflict}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

interface RecommendationItemProps {
  recommendation: {
    type: 'grant' | 'revoke';
    permission: Permission;
    reason: string;
  };
  permission: PermissionDefinition | undefined;
}

const RecommendationItem: React.FC<RecommendationItemProps> = ({
  recommendation,
  permission
}) => {
  if (!permission) return null;

  const ActionIcon = recommendation.type === 'grant' ? Check : X;
  const actionColor = recommendation.type === 'grant' ? 'text-sage' : 'text-red-error';
  const actionBg = recommendation.type === 'grant' ? 'bg-sage/10' : 'bg-red-error/10';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 p-3 bg-navy-50/10 rounded-lg"
    >
      <div className={cn('p-1.5 rounded-full', actionBg)}>
        <ActionIcon className={cn('w-4 h-4', actionColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-cream">
            {recommendation.type === 'grant' ? 'Grant' : 'Revoke'} {permission.displayName}
          </p>
          <div className={cn(
            'w-2 h-2 rounded-full',
            riskLevelColors[permission.riskLevel]?.replace('text-', 'bg-') || 'bg-sage'
          )} />
        </div>
        <p className="text-sm text-sage/70 mt-1">{recommendation.reason}</p>
        <p className="text-xs text-sage/50 mt-1">
          {permission.resource} • {permission.action} • {permission.riskLevel} risk
        </p>
      </div>
    </motion.div>
  );
};

export const PermissionTester: React.FC<PermissionTesterProps> = ({
  roles,
  permissions,
  users,
  businessContexts,
  onTest,
  className = ''
}) => {
  const [testConfig, setTestConfig] = useState<TestConfiguration>({
    userId: undefined,
    roleIds: [],
    permissions: [],
    context: businessContexts[0]
  });

  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'granted' | 'denied' | 'conflicts' | 'recommendations'>('granted');

  // Get available permissions for testing
  const availablePermissions = useMemo(() => {
    return permissions.filter(permission =>
      permission.contexts.some(ctx => ctx.id === testConfig.context.id)
    ).sort((a, b) => {
      if (a.resource !== b.resource) {
        return a.resource.localeCompare(b.resource);
      }
      return a.displayName.localeCompare(b.displayName);
    });
  }, [permissions, testConfig.context]);

  // Group permissions by resource
  const permissionsByResource = useMemo(() => {
    const groups = new Map<string, PermissionDefinition[]>();
    availablePermissions.forEach(permission => {
      const existing = groups.get(permission.resource) || [];
      existing.push(permission);
      groups.set(permission.resource, existing);
    });
    return groups;
  }, [availablePermissions]);

  // Get available roles for the context
  const availableRoles = useMemo(() => {
    return roles.filter(role =>
      role.isActive &&
      role.contexts.some(ctx => ctx.id === testConfig.context.id)
    ).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [roles, testConfig.context]);

  // Get selected user's current roles (if any)
  const selectedUserRoles = useMemo(() => {
    if (!testConfig.userId) return [];
    const user = users.find(u => u.id === testConfig.userId);
    return user?.roleAssignments?.filter(assignment =>
      assignment.businessContext.id === testConfig.context.id &&
      assignment.isActive
    ).map(assignment => assignment.roleId) || [];
  }, [testConfig.userId, users, testConfig.context]);

  const runTest = async () => {
    setLoading(true);
    try {
      const result = await onTest({
        userId: testConfig.userId,
        roleIds: testConfig.roleIds,
        permissions: testConfig.permissions,
        context: testConfig.context
      });
      setTestResult(result);
      setActiveTab('granted');
    } catch (error) {
      console.error('Permission test failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetTest = () => {
    setTestConfig({
      userId: undefined,
      roleIds: [],
      permissions: [],
      context: businessContexts[0]
    });
    setTestResult(null);
    setExpandedResults(new Set());
  };

  const togglePermissionExpand = useCallback((permissionName: string) => {
    setExpandedResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(permissionName)) {
        newSet.delete(permissionName);
      } else {
        newSet.add(permissionName);
      }
      return newSet;
    });
  }, []);

  const toggleRole = (roleId: string) => {
    setTestConfig(prev => ({
      ...prev,
      roleIds: prev.roleIds.includes(roleId)
        ? prev.roleIds.filter(id => id !== roleId)
        : [...prev.roleIds, roleId]
    }));
  };

  const togglePermission = (permission: Permission) => {
    setTestConfig(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  const selectAllPermissions = (resource: string) => {
    const resourcePermissions = availablePermissions
      .filter(p => p.resource === resource)
      .map(p => p.name);
    
    setTestConfig(prev => ({
      ...prev,
      permissions: [...new Set([...prev.permissions, ...resourcePermissions])]
    }));
  };

  const deselectAllPermissions = (resource: string) => {
    const resourcePermissions = availablePermissions
      .filter(p => p.resource === resource)
      .map(p => p.name);
    
    setTestConfig(prev => ({
      ...prev,
      permissions: prev.permissions.filter(p => !resourcePermissions.includes(p))
    }));
  };

  const exportResults = () => {
    if (!testResult) return;

    const data = {
      testConfiguration: testConfig,
      results: testResult,
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `permission-test-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyResults = () => {
    if (!testResult) return;

    const summary = `Permission Test Results
======================

Granted: ${testResult.granted.length} permissions
Denied: ${testResult.denied.length} permissions
Conflicts: ${testResult.conflicts.length} issues
Recommendations: ${testResult.recommendations.length} suggestions

Test Configuration:
- User: ${testConfig.userId ? users.find(u => u.id === testConfig.userId)?.fullName : 'None selected'}
- Roles: ${testConfig.roleIds.map(id => roles.find(r => r.id === id)?.displayName).join(', ')}
- Context: ${testConfig.context.name}
- Tested Permissions: ${testConfig.permissions.length}

Generated: ${new Date().toLocaleString()}`;

    navigator.clipboard.writeText(summary);
    // Could add a toast notification here
  };

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
            <TestTube className="w-6 h-6 text-sage" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-cream">Permission Tester</h2>
            <p className="text-sm text-sage/70">
              Test permission combinations and role inheritance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={resetTest}
            className="flex items-center gap-1 px-3 py-2 text-sage/70 hover:text-cream hover:bg-sage/20 
                       rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Reset</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={runTest}
            disabled={loading || (testConfig.roleIds.length === 0 && testConfig.permissions.length === 0)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-primary to-teal-secondary
                       text-cream rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-cream/30 border-t-cream rounded-full"
                />
                Testing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Test
              </>
            )}
          </motion.button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 space-y-4">
          <GlassMorphism variant="subtle" className="p-4" border>
            <h3 className="text-lg font-semibold text-cream mb-4">Test Configuration</h3>

            {/* Business Context */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-cream">
                Business Context
              </label>
              <select
                value={testConfig.context.id}
                onChange={(e) => {
                  const context = businessContexts.find(ctx => ctx.id === e.target.value);
                  if (context) {
                    setTestConfig(prev => ({ ...prev, context }));
                  }
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

            {/* User Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-cream">
                Test User (optional)
              </label>
              <select
                value={testConfig.userId || ''}
                onChange={(e) => setTestConfig(prev => ({
                  ...prev,
                  userId: e.target.value || undefined
                }))}
                className="w-full px-3 py-2 bg-navy-dark/50 border border-sage/30 rounded text-cream
                           focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
              >
                <option value="">Select a user...</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.fullName} ({user.email})
                  </option>
                ))}
              </select>
              {testConfig.userId && selectedUserRoles.length > 0 && (
                <p className="text-xs text-sage/70">
                  Current roles: {selectedUserRoles.map(roleId => 
                    roles.find(r => r.id === roleId)?.displayName
                  ).join(', ')}
                </p>
              )}
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-cream">
                Test Roles ({testConfig.roleIds.length} selected)
              </label>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {availableRoles.map(role => {
                  const RoleIcon = roleIcons[role.name as UserRole] || Shield;
                  return (
                    <label key={role.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={testConfig.roleIds.includes(role.id)}
                        onChange={() => toggleRole(role.id)}
                        className="w-4 h-4 text-teal-primary rounded focus:ring-teal-primary/50"
                      />
                      <RoleIcon className="w-4 h-4 text-sage/50" />
                      <span className="text-sm text-cream">{role.displayName}</span>
                      <span className="text-xs text-sage/50">
                        ({role.permissions.length} perms)
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Permission Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-cream">
                Test Permissions ({testConfig.permissions.length} selected)
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {Array.from(permissionsByResource.entries()).map(([resource, resourcePermissions]) => (
                  <div key={resource} className="bg-navy-50/10 rounded-lg p-2">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs font-medium text-sage/80 uppercase tracking-wide">
                        {resource} ({resourcePermissions.length})
                      </h4>
                      <div className="flex gap-1">
                        <button
                          onClick={() => selectAllPermissions(resource)}
                          className="px-1 py-0.5 text-xs text-teal-primary hover:bg-teal-primary/20 rounded"
                        >
                          All
                        </button>
                        <button
                          onClick={() => deselectAllPermissions(resource)}
                          className="px-1 py-0.5 text-xs text-red-error hover:bg-red-error/20 rounded"
                        >
                          None
                        </button>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      {resourcePermissions.map(permission => (
                        <label key={permission.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={testConfig.permissions.includes(permission.name)}
                            onChange={() => togglePermission(permission.name)}
                            className="w-3 h-3 text-teal-primary rounded focus:ring-teal-primary/50"
                          />
                          <div className={cn(
                            'w-2 h-2 rounded-full flex-shrink-0',
                            riskLevelColors[permission.riskLevel]?.replace('text-', 'bg-') || 'bg-sage'
                          )} />
                          <span className="text-xs text-cream truncate">{permission.displayName}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </GlassMorphism>

          {/* Test Summary */}
          <GlassMorphism variant="subtle" className="p-4" border>
            <h4 className="text-sm font-medium text-cream mb-3">Test Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-sage/70">Context:</span>
                <span className="text-cream">{testConfig.context.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sage/70">User:</span>
                <span className="text-cream">
                  {testConfig.userId 
                    ? users.find(u => u.id === testConfig.userId)?.fullName || 'Unknown'
                    : 'None'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sage/70">Roles:</span>
                <span className="text-cream">{testConfig.roleIds.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sage/70">Permissions:</span>
                <span className="text-cream">{testConfig.permissions.length}</span>
              </div>
            </div>
          </GlassMorphism>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2">
          {!testResult ? (
            <GlassMorphism variant="subtle" className="p-12 text-center" border>
              <TestTube className="w-12 h-12 text-sage/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-cream mb-2">Ready to Test</h3>
              <p className="text-sage/70 mb-6">
                Configure your test parameters and click "Run Test" to see permission results.
              </p>
              <div className="flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-sage/30 rounded-full" />
                  <span className="text-sage/70">Roles: {testConfig.roleIds.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-teal-primary/30 rounded-full" />
                  <span className="text-sage/70">Permissions: {testConfig.permissions.length}</span>
                </div>
              </div>
            </GlassMorphism>
          ) : (
            <div className="space-y-4">
              {/* Results Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-cream">Test Results</h3>
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={copyResults}
                    className="p-2 text-sage/70 hover:text-cream hover:bg-sage/20 rounded transition-colors"
                    title="Copy results summary"
                  >
                    <Copy className="w-4 h-4" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={exportResults}
                    className="p-2 text-sage/70 hover:text-cream hover:bg-sage/20 rounded transition-colors"
                    title="Export results"
                  >
                    <Download className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>

              {/* Results Summary */}
              <div className="grid grid-cols-4 gap-4">
                <GlassMorphism variant="subtle" className="p-4 text-center" border>
                  <p className="text-2xl font-bold text-sage">{testResult.granted.length}</p>
                  <p className="text-sm text-sage/70">Granted</p>
                </GlassMorphism>
                <GlassMorphism variant="subtle" className="p-4 text-center" border>
                  <p className="text-2xl font-bold text-red-error">{testResult.denied.length}</p>
                  <p className="text-sm text-sage/70">Denied</p>
                </GlassMorphism>
                <GlassMorphism variant="subtle" className="p-4 text-center" border>
                  <p className="text-2xl font-bold text-gold-primary">{testResult.conflicts.length}</p>
                  <p className="text-sm text-sage/70">Conflicts</p>
                </GlassMorphism>
                <GlassMorphism variant="subtle" className="p-4 text-center" border>
                  <p className="text-2xl font-bold text-teal-primary">{testResult.recommendations.length}</p>
                  <p className="text-sm text-sage/70">Suggestions</p>
                </GlassMorphism>
              </div>

              {/* Results Tabs */}
              <div className="flex gap-1 p-1 bg-navy-50/20 rounded-lg">
                {[
                  { key: 'granted' as const, label: 'Granted', count: testResult.granted.length },
                  { key: 'denied' as const, label: 'Denied', count: testResult.denied.length },
                  { key: 'conflicts' as const, label: 'Conflicts', count: testResult.conflicts.length },
                  { key: 'recommendations' as const, label: 'Suggestions', count: testResult.recommendations.length }
                ].map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium',
                      'transition-all duration-200',
                      activeTab === key
                        ? 'bg-gradient-to-r from-teal-primary/30 to-sage/30 text-cream'
                        : 'text-sage/70 hover:text-cream hover:bg-navy-50/20'
                    )}
                  >
                    <span>{label}</span>
                    <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs">
                      {count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Results Content */}
              <GlassMorphism variant="subtle" className="p-4 min-h-[300px]" border>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {activeTab === 'granted' && (
                      <div className="space-y-3">
                        {testResult.granted.length === 0 ? (
                          <div className="text-center py-8">
                            <CheckCircle className="w-8 h-8 text-sage/30 mx-auto mb-2" />
                            <p className="text-sage/70">No permissions granted</p>
                          </div>
                        ) : (
                          testResult.granted.map(permissionName => {
                            const permission = permissions.find(p => p.name === permissionName);
                            return (
                              <PermissionResultItem
                                key={permissionName}
                                permission={permission}
                                status="granted"
                                expanded={expandedResults.has(permissionName)}
                                onToggleExpand={() => togglePermissionExpand(permissionName)}
                              />
                            );
                          })
                        )}
                      </div>
                    )}

                    {activeTab === 'denied' && (
                      <div className="space-y-3">
                        {testResult.denied.length === 0 ? (
                          <div className="text-center py-8">
                            <XCircle className="w-8 h-8 text-red-error/30 mx-auto mb-2" />
                            <p className="text-sage/70">No permissions denied</p>
                          </div>
                        ) : (
                          testResult.denied.map(permissionName => {
                            const permission = permissions.find(p => p.name === permissionName);
                            return (
                              <PermissionResultItem
                                key={permissionName}
                                permission={permission}
                                status="denied"
                                expanded={expandedResults.has(permissionName)}
                                onToggleExpand={() => togglePermissionExpand(permissionName)}
                              />
                            );
                          })
                        )}
                      </div>
                    )}

                    {activeTab === 'conflicts' && (
                      <div className="space-y-3">
                        {testResult.conflicts.length === 0 ? (
                          <div className="text-center py-8">
                            <AlertCircle className="w-8 h-8 text-gold-primary/30 mx-auto mb-2" />
                            <p className="text-sage/70">No conflicts detected</p>
                          </div>
                        ) : (
                          testResult.conflicts.map(conflict => {
                            const permission = permissions.find(p => p.name === conflict.permission);
                            return (
                              <PermissionResultItem
                                key={conflict.permission}
                                permission={permission}
                                status="conflict"
                                reason={conflict.reason}
                                expanded={expandedResults.has(conflict.permission)}
                                onToggleExpand={() => togglePermissionExpand(conflict.permission)}
                              />
                            );
                          })
                        )}
                      </div>
                    )}

                    {activeTab === 'recommendations' && (
                      <div className="space-y-3">
                        {testResult.recommendations.length === 0 ? (
                          <div className="text-center py-8">
                            <Lightbulb className="w-8 h-8 text-teal-primary/30 mx-auto mb-2" />
                            <p className="text-sage/70">No recommendations available</p>
                          </div>
                        ) : (
                          testResult.recommendations.map((recommendation, index) => {
                            const permission = permissions.find(p => p.name === recommendation.permission);
                            return (
                              <RecommendationItem
                                key={`${recommendation.permission}-${index}`}
                                recommendation={recommendation}
                                permission={permission}
                              />
                            );
                          })
                        )}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </GlassMorphism>
            </div>
          )}
        </div>
      </div>
    </GlassMorphism>
  );
};

export default PermissionTester;