'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Grid3X3, Check, X, AlertTriangle, Eye, EyeOff, Filter,
  Search, Download, Upload, Save, RefreshCw, Lock, Unlock,
  Shield, Crown, User, Building2, Tool, Zap, ChevronDown,
  ChevronRight, Info, Plus, Minus, RotateCcw, Settings,
  TrendingUp, Star
} from 'lucide-react';
import { GlassMorphism } from '../../GlassMorphism';
import { cn } from '@/lib/utils';
import type { 
  PermissionMatrixProps, 
  RoleDefinition, 
  PermissionDefinition, 
  Permission, 
  UserRole, 
  ResourceType 
} from './types';

// Resource icons mapping
const resourceIcons = {
  business: Building2,
  user: User,
  review: Star,
  category: Grid3X3,
  analytics: TrendingUp,
  system: Settings
} as const;

// Permission risk level colors
const riskLevelColors = {
  low: 'text-sage',
  medium: 'text-teal-primary',
  high: 'text-gold-primary',
  critical: 'text-red-error'
} as const;

// Role icons (reused from RoleHierarchyManager)
const roleIcons = {
  customer: User,
  business_owner: Building2,
  service_provider: Tool,
  moderator: Shield,
  admin: Crown,
  super_admin: Zap
} as const;

interface PermissionCellProps {
  role: RoleDefinition;
  permission: PermissionDefinition;
  hasPermission: boolean;
  isInherited: boolean;
  isDisabled: boolean;
  onToggle: (grant: boolean) => Promise<void>;
  showDetails: boolean;
}

const PermissionCell: React.FC<PermissionCellProps> = ({
  role,
  permission,
  hasPermission,
  isInherited,
  isDisabled,
  onToggle,
  showDetails
}) => {
  const [loading, setLoading] = useState(false);
  
  const handleClick = async () => {
    if (isDisabled || loading) return;
    
    setLoading(true);
    try {
      await onToggle(!hasPermission);
    } catch (error) {
      console.error('Failed to toggle permission:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = () => {
    if (loading) {
      return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-4 h-4 border-2 border-sage/30 border-t-sage rounded-full"
        />
      );
    }
    
    if (hasPermission) {
      return isInherited ? (
        <Shield className="w-4 h-4 text-teal-primary" />
      ) : (
        <Check className="w-4 h-4 text-sage" />
      );
    }
    
    return <X className="w-4 h-4 text-sage/30" />;
  };

  const getCellColor = () => {
    if (isDisabled) return 'bg-navy-50/10';
    if (hasPermission) {
      return isInherited 
        ? 'bg-teal-primary/20 hover:bg-teal-primary/30'
        : 'bg-sage/20 hover:bg-sage/30';
    }
    return 'bg-navy-50/10 hover:bg-navy-50/20';
  };

  return (
    <motion.div
      whileHover={!isDisabled ? { scale: 1.05 } : undefined}
      whileTap={!isDisabled ? { scale: 0.95 } : undefined}
      onClick={handleClick}
      className={cn(
        'relative p-3 rounded-lg border transition-all duration-200 cursor-pointer',
        'flex items-center justify-center min-h-[48px]',
        getCellColor(),
        hasPermission 
          ? 'border-sage/30' 
          : 'border-sage/10',
        isDisabled && 'cursor-not-allowed opacity-50',
        permission.riskLevel === 'critical' && hasPermission && 'ring-1 ring-red-error/50',
        permission.riskLevel === 'high' && hasPermission && 'ring-1 ring-gold-primary/50'
      )}
      title={`${permission.displayName} for ${role.displayName}${isInherited ? ' (inherited)' : ''}${isDisabled ? ' (read-only)' : ''}`}
    >
      {getStatusIcon()}
      
      {/* Risk indicator for high-risk permissions */}
      {hasPermission && (permission.riskLevel === 'critical' || permission.riskLevel === 'high') && (
        <div className="absolute top-1 right-1">
          <AlertTriangle className={cn(
            'w-3 h-3',
            permission.riskLevel === 'critical' ? 'text-red-error' : 'text-gold-primary'
          )} />
        </div>
      )}
      
      {/* Inherited indicator */}
      {isInherited && (
        <div className="absolute bottom-1 left-1">
          <div className="w-2 h-2 bg-teal-primary rounded-full" />
        </div>
      )}

      {/* Dependency indicator */}
      {permission.dependencies && permission.dependencies.length > 0 && hasPermission && (
        <div className="absolute bottom-1 right-1">
          <div className="w-2 h-2 bg-gold-primary rounded-full" />
        </div>
      )}
    </motion.div>
  );
};

interface ResourceGroupProps {
  resource: ResourceType;
  permissions: PermissionDefinition[];
  roles: RoleDefinition[];
  permissionMatrix: Map<string, Set<Permission>>;
  inheritedMatrix: Map<string, Set<Permission>>;
  onPermissionToggle: (roleId: string, permission: Permission, grant: boolean) => Promise<void>;
  readonly: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
}

const ResourceGroup: React.FC<ResourceGroupProps> = ({
  resource,
  permissions,
  roles,
  permissionMatrix,
  inheritedMatrix,
  onPermissionToggle,
  readonly,
  expanded,
  onToggleExpand
}) => {
  const ResourceIcon = resourceIcons[resource] || Grid3X3;
  
  const resourcePermissions = permissions.filter(p => p.resource === resource);
  const resourceStats = useMemo(() => {
    const total = resourcePermissions.length * roles.length;
    let granted = 0;
    let inherited = 0;
    
    roles.forEach(role => {
      const rolePerms = permissionMatrix.get(role.id) || new Set();
      const roleInherited = inheritedMatrix.get(role.id) || new Set();
      
      resourcePermissions.forEach(permission => {
        if (rolePerms.has(permission.name)) granted++;
        if (roleInherited.has(permission.name)) inherited++;
      });
    });
    
    return { total, granted, inherited };
  }, [resourcePermissions, roles, permissionMatrix, inheritedMatrix]);

  return (
    <div className="mb-6">
      {/* Resource Header */}
      <motion.div
        whileHover={{ scale: 1.01 }}
        onClick={onToggleExpand}
        className="flex items-center justify-between p-4 bg-gradient-to-r from-navy-dark/50 to-sage/10 
                   rounded-lg cursor-pointer hover:shadow-md transition-all mb-4"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-sage" />
          ) : (
            <ChevronRight className="w-5 h-5 text-sage" />
          )}
          <div className="p-2 bg-gradient-to-br from-teal-primary/20 to-sage/20 rounded-full">
            <ResourceIcon className="w-5 h-5 text-sage" />
          </div>
          <div>
            <h3 className="font-semibold text-cream capitalize">{resource} Permissions</h3>
            <p className="text-xs text-sage/70">
              {resourcePermissions.length} permissions • {resourceStats.granted} granted • {resourceStats.inherited} inherited
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-sage/50 rounded-full" />
            <span className="text-xs text-sage/70">Direct</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-teal-primary/50 rounded-full" />
            <span className="text-xs text-sage/70">Inherited</span>
          </div>
        </div>
      </motion.div>

      {/* Permission Matrix */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <GlassMorphism variant="subtle" className="p-4" border>
              {/* Column Headers (Roles) */}
              <div className="grid grid-cols-12 gap-2 mb-4">
                <div className="col-span-3">
                  <h4 className="font-medium text-cream text-sm">Permission</h4>
                </div>
                <div className="col-span-9">
                  <div className="grid grid-cols-6 gap-2">
                    {roles.slice(0, 6).map(role => {
                      const RoleIcon = roleIcons[role.name as UserRole] || Shield;
                      return (
                        <div key={role.id} className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <div className="p-1.5 bg-gradient-to-br from-teal-primary/20 to-sage/20 rounded-full">
                              <RoleIcon className="w-3 h-3 text-sage" />
                            </div>
                            <span className="text-xs text-sage/70 truncate w-full" title={role.displayName}>
                              {role.displayName}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Permission Rows */}
              <div className="space-y-2">
                {resourcePermissions.map(permission => (
                  <motion.div
                    key={permission.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="grid grid-cols-12 gap-2 items-center"
                  >
                    {/* Permission Info */}
                    <div className="col-span-3">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'w-2 h-2 rounded-full',
                          riskLevelColors[permission.riskLevel]?.replace('text-', 'bg-') || 'bg-sage'
                        )} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-cream truncate" title={permission.displayName}>
                            {permission.displayName}
                          </p>
                          <p className="text-xs text-sage/50 truncate" title={permission.description}>
                            {permission.description}
                          </p>
                        </div>
                        {(permission.dependencies?.length || 0) > 0 && (
                          <Info className="w-3 h-3 text-gold-primary" title="Has dependencies" />
                        )}
                      </div>
                    </div>

                    {/* Permission Cells */}
                    <div className="col-span-9">
                      <div className="grid grid-cols-6 gap-2">
                        {roles.slice(0, 6).map(role => {
                          const rolePerms = permissionMatrix.get(role.id) || new Set();
                          const inheritedPerms = inheritedMatrix.get(role.id) || new Set();
                          const hasPermission = rolePerms.has(permission.name);
                          const isInherited = inheritedPerms.has(permission.name);
                          const isDisabled = readonly || role.isSystemRole;

                          return (
                            <PermissionCell
                              key={`${role.id}-${permission.id}`}
                              role={role}
                              permission={permission}
                              hasPermission={hasPermission}
                              isInherited={isInherited}
                              isDisabled={isDisabled}
                              onToggle={(grant) => onPermissionToggle(role.id, permission.name, grant)}
                              showDetails={true}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </GlassMorphism>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const PermissionMatrix: React.FC<PermissionMatrixProps> = ({
  roles,
  permissions,
  assignments,
  onPermissionToggle,
  onBulkPermissionUpdate,
  businessContext,
  readonly = false,
  className = ''
}) => {
  const [expandedResources, setExpandedResources] = useState<Set<ResourceType>>(new Set(['business', 'user']));
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [selectedPermissions, setSelectedPermissions] = useState<Set<Permission>>(new Set());
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showInheritedOnly, setShowInheritedOnly] = useState(false);

  // Build permission matrices
  const { permissionMatrix, inheritedMatrix } = useMemo(() => {
    const directMatrix = new Map<string, Set<Permission>>();
    const inheritedMatrix = new Map<string, Set<Permission>>();

    roles.forEach(role => {
      directMatrix.set(role.id, new Set(role.permissions));
      inheritedMatrix.set(role.id, new Set(role.inheritedPermissions || []));
    });

    return {
      permissionMatrix: directMatrix,
      inheritedMatrix
    };
  }, [roles]);

  // Filter permissions
  const filteredPermissions = useMemo(() => {
    let filtered = permissions;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.displayName.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.name.toLowerCase().includes(query)
      );
    }

    if (filterRisk !== 'all') {
      filtered = filtered.filter(p => p.riskLevel === filterRisk);
    }

    return filtered;
  }, [permissions, searchQuery, filterRisk]);

  // Group permissions by resource
  const groupedPermissions = useMemo(() => {
    const groups = new Map<ResourceType, PermissionDefinition[]>();
    
    filteredPermissions.forEach(permission => {
      const existing = groups.get(permission.resource) || [];
      existing.push(permission);
      groups.set(permission.resource, existing);
    });

    // Sort permissions within each group
    groups.forEach(perms => {
      perms.sort((a, b) => {
        if (a.riskLevel !== b.riskLevel) {
          const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return riskOrder[b.riskLevel] - riskOrder[a.riskLevel];
        }
        return a.displayName.localeCompare(b.displayName);
      });
    });

    return groups;
  }, [filteredPermissions]);

  const handleToggleResource = useCallback((resource: ResourceType) => {
    setExpandedResources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(resource)) {
        newSet.delete(resource);
      } else {
        newSet.add(resource);
      }
      return newSet;
    });
  }, []);

  const handleBulkToggle = async (operation: 'grant' | 'revoke') => {
    if (selectedRoles.size === 0 || selectedPermissions.size === 0) return;
    
    const updates = Array.from(selectedRoles).map(roleId => ({
      roleId,
      permissions: Array.from(selectedPermissions),
      operation
    }));

    try {
      await onBulkPermissionUpdate(updates);
      setSelectedRoles(new Set());
      setSelectedPermissions(new Set());
    } catch (error) {
      console.error('Bulk permission update failed:', error);
    }
  };

  const expandAll = () => {
    setExpandedResources(new Set(Array.from(groupedPermissions.keys())));
  };

  const collapseAll = () => {
    setExpandedResources(new Set());
  };

  const stats = useMemo(() => {
    const totalCells = roles.length * permissions.length;
    let grantedCount = 0;
    let inheritedCount = 0;

    roles.forEach(role => {
      const rolePerms = permissionMatrix.get(role.id) || new Set();
      const roleInherited = inheritedMatrix.get(role.id) || new Set();
      grantedCount += rolePerms.size;
      inheritedCount += roleInherited.size;
    });

    return { totalCells, grantedCount, inheritedCount };
  }, [roles, permissions, permissionMatrix, inheritedMatrix]);

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
            <Grid3X3 className="w-6 h-6 text-sage" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-cream">Permission Matrix</h2>
            <p className="text-sm text-sage/70">
              Manage role permissions across {businessContext.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search permissions..."
              className="pl-8 pr-3 py-2 w-48 bg-navy-dark/50 border border-sage/30 rounded-lg text-cream text-sm
                         focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
            />
            <Search className="absolute left-2.5 top-2.5 w-3 h-3 text-sage/50" />
          </div>

          {/* Risk Filter */}
          <select
            value={filterRisk}
            onChange={(e) => setFilterRisk(e.target.value)}
            className="px-3 py-2 bg-navy-dark/50 border border-sage/30 rounded-lg text-cream text-sm
                       focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
          >
            <option value="all">All Risk Levels</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* View Controls */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={expandAll}
            className="p-2 text-sage/70 hover:text-cream hover:bg-sage/20 rounded-lg transition-colors"
            title="Expand All"
          >
            <Eye className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={collapseAll}
            className="p-2 text-sage/70 hover:text-cream hover:bg-sage/20 rounded-lg transition-colors"
            title="Collapse All"
          >
            <EyeOff className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Bulk Actions */}
      {!readonly && (selectedRoles.size > 0 || selectedPermissions.size > 0) && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-gradient-to-r from-teal-primary/10 to-sage/10 rounded-lg border border-teal-primary/30"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-cream">
                Bulk Actions: {selectedRoles.size} roles, {selectedPermissions.size} permissions
              </span>
              <button
                onClick={() => {
                  setSelectedRoles(new Set());
                  setSelectedPermissions(new Set());
                }}
                className="text-xs text-sage/70 hover:text-cream transition-colors"
              >
                Clear Selection
              </button>
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleBulkToggle('grant')}
                className="flex items-center gap-1 px-3 py-1.5 bg-sage/20 text-sage rounded text-sm
                           hover:bg-sage/30 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Grant All
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleBulkToggle('revoke')}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-error/20 text-red-error rounded text-sm
                           hover:bg-red-error/30 transition-colors"
              >
                <Minus className="w-3 h-3" />
                Revoke All
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Permission Matrix by Resource */}
      <div className="space-y-6">
        {Array.from(groupedPermissions.entries()).map(([resource, resourcePermissions]) => (
          <ResourceGroup
            key={resource}
            resource={resource}
            permissions={resourcePermissions}
            roles={roles}
            permissionMatrix={permissionMatrix}
            inheritedMatrix={inheritedMatrix}
            onPermissionToggle={onPermissionToggle}
            readonly={readonly}
            expanded={expandedResources.has(resource)}
            onToggleExpand={() => handleToggleResource(resource)}
          />
        ))}
      </div>

      {/* Stats */}
      <div className="mt-6 pt-4 border-t border-sage/10">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-cream">{stats.grantedCount}</p>
            <p className="text-xs text-sage/70">Direct Permissions</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-teal-primary">{stats.inheritedCount}</p>
            <p className="text-xs text-sage/70">Inherited Permissions</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-sage">{roles.length}</p>
            <p className="text-xs text-sage/70">Active Roles</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gold-primary">{permissions.length}</p>
            <p className="text-xs text-sage/70">Total Permissions</p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 p-3 bg-navy-50/10 rounded-lg">
        <h4 className="text-sm font-medium text-cream mb-2">Legend</h4>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Check className="w-3 h-3 text-sage" />
              <span className="text-sage/70">Direct Permission</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-3 h-3 text-teal-primary" />
              <span className="text-sage/70">Inherited Permission</span>
            </div>
            <div className="flex items-center gap-2">
              <X className="w-3 h-3 text-sage/30" />
              <span className="text-sage/70">No Permission</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-error rounded-full" />
              <span className="text-sage/70">Critical Risk</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gold-primary rounded-full" />
              <span className="text-sage/70">High Risk</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-gold-primary" />
              <span className="text-sage/70">Risk Warning</span>
            </div>
          </div>
        </div>
      </div>
    </GlassMorphism>
  );
};

export default PermissionMatrix;