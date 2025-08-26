'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  Shield, ChevronRight, ChevronDown, Plus, Edit3, Trash2,
  Users, Settings, AlertTriangle, Eye, EyeOff, Save, X,
  Move, Grip, Crown, Star, User, Building2, Tool, Zap
} from 'lucide-react';
import { GlassMorphism } from '../../GlassMorphism';
import { cn } from '@/lib/utils';
import type { RoleHierarchyManagerProps, RoleDefinition, UserRole } from './types';

// Role icon mapping
const roleIcons = {
  customer: User,
  business_owner: Building2,
  service_provider: Tool,
  moderator: Shield,
  admin: Crown,
  super_admin: Zap
} as const;

// Role color mapping
const roleColors = {
  customer: 'from-sage/20 to-teal-primary/20',
  business_owner: 'from-gold-primary/20 to-gold-secondary/20',
  service_provider: 'from-teal-primary/20 to-teal-secondary/20',
  moderator: 'from-navy-dark/20 to-sage/20',
  admin: 'from-red-error/20 to-red-warning/20',
  super_admin: 'from-gold-primary/20 to-red-error/20'
} as const;

interface RoleNodeProps {
  role: RoleDefinition;
  childRoles: RoleDefinition[];
  expandedNodes: Set<string>;
  selectedNode: string | null;
  draggedNode: string | null;
  onToggleExpand: (roleId: string) => void;
  onSelectNode: (roleId: string) => void;
  onDragStart: (roleId: string) => void;
  onDragEnd: () => void;
  onDrop: (draggedId: string, targetId: string) => void;
  onEdit: (roleId: string) => void;
  onDelete: (roleId: string) => void;
  readonly?: boolean;
  level?: number;
}

const RoleNode: React.FC<RoleNodeProps> = ({
  role,
  childRoles,
  expandedNodes,
  selectedNode,
  draggedNode,
  onToggleExpand,
  onSelectNode,
  onDragStart,
  onDragEnd,
  onDrop,
  onEdit,
  onDelete,
  readonly = false,
  level = 0
}) => {
  const isExpanded = expandedNodes.has(role.id);
  const isSelected = selectedNode === role.id;
  const isDragged = draggedNode === role.id;
  const hasChildren = childRoles.length > 0;
  
  const RoleIcon = roleIcons[role.name as UserRole] || Shield;
  const colorClass = roleColors[role.name as UserRole] || 'from-sage/20 to-teal-primary/20';

  const handleDragStart = (e: React.DragEvent) => {
    if (readonly) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', role.id);
    onDragStart(role.id);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (readonly) return;
    onDragEnd();
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (readonly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    if (readonly) return;
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId !== role.id) {
      onDrop(draggedId, role.id);
    }
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ 
          opacity: isDragged ? 0.5 : 1, 
          x: 0,
          scale: isDragged ? 0.95 : 1
        }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2 }}
        style={{ marginLeft: `${level * 24}px` }}
        className={cn(
          'relative group mb-2',
          isDragged && 'z-10'
        )}
      >
        {/* Connection Lines */}
        {level > 0 && (
          <div className="absolute left-[-12px] top-4 w-3 h-px bg-sage/30" />
        )}
        {level > 0 && hasChildren && isExpanded && (
          <div className="absolute left-[-12px] top-4 bottom-[-8px] w-px bg-sage/30" />
        )}

        <div
          draggable={!readonly}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => onSelectNode(role.id)}
          className={cn(
            'relative flex items-center gap-3 p-3 rounded-lg transition-all duration-200',
            'cursor-pointer hover:shadow-md',
            isSelected 
              ? 'bg-gradient-to-r from-teal-primary/30 to-sage/30 border border-teal-primary/50'
              : 'bg-gradient-to-r ' + colorClass + ' hover:shadow-lg',
            !readonly && 'hover:scale-[1.02]',
            isDragged && 'shadow-2xl ring-2 ring-teal-primary/50'
          )}
        >
          {/* Drag Handle */}
          {!readonly && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
              <Grip className="w-4 h-4 text-sage/50" />
            </div>
          )}

          {/* Expand/Collapse Button */}
          {hasChildren && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(role.id);
              }}
              className="p-1 rounded-full hover:bg-white/20 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-sage" />
              ) : (
                <ChevronRight className="w-4 h-4 text-sage" />
              )}
            </motion.button>
          )}

          {/* Role Icon */}
          <div className={cn(
            'p-2 rounded-full bg-gradient-to-br',
            role.metadata.color || 'from-teal-primary/20 to-sage/20'
          )}>
            <RoleIcon className="w-4 h-4 text-sage" />
          </div>

          {/* Role Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-cream truncate">{role.displayName}</h4>
              {role.isSystemRole && (
                <Shield className="w-3 h-3 text-gold-primary" />
              )}
              {!role.isActive && (
                <EyeOff className="w-3 h-3 text-red-error" />
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-xs text-sage/70 truncate">{role.description}</p>
              <span className="text-xs text-sage/50">Level {role.level}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-sage/20 text-sage rounded">
                <Users className="w-3 h-3" />
                {role.permissions.length} permissions
              </span>
              <span className={cn(
                'px-2 py-0.5 text-xs rounded',
                role.metadata.category === 'system' 
                  ? 'bg-red-error/20 text-red-error'
                  : role.metadata.category === 'business'
                  ? 'bg-teal-primary/20 text-teal-primary'
                  : 'bg-sage/20 text-sage'
              )}>
                {role.metadata.category}
              </span>
            </div>
          </div>

          {/* Actions */}
          {!readonly && (
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(role.id);
                }}
                className="p-1.5 text-sage/70 hover:text-teal-primary hover:bg-teal-primary/20 rounded"
              >
                <Edit3 className="w-3 h-3" />
              </motion.button>
              {!role.isSystemRole && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(role.id);
                  }}
                  className="p-1.5 text-sage/70 hover:text-red-error hover:bg-red-error/20 rounded"
                >
                  <Trash2 className="w-3 h-3" />
                </motion.button>
              )}
            </div>
          )}

          {/* Risk Indicator */}
          {role.permissions.length > 10 && (
            <div className="absolute top-2 right-2">
              <AlertTriangle className="w-3 h-3 text-gold-primary" />
            </div>
          )}
        </div>

        {/* Child Roles */}
        <AnimatePresence>
          {hasChildren && isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-2"
            >
              {childRoles.map(childRole => (
                <RoleNode
                  key={childRole.id}
                  role={childRole}
                  childRoles={[]} // Will be populated by parent
                  expandedNodes={expandedNodes}
                  selectedNode={selectedNode}
                  draggedNode={draggedNode}
                  onToggleExpand={onToggleExpand}
                  onSelectNode={onSelectNode}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDrop={onDrop}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  readonly={readonly}
                  level={level + 1}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
};

interface RoleEditorProps {
  role: RoleDefinition | null;
  allRoles: RoleDefinition[];
  onSave: (role: Omit<RoleDefinition, 'id' | 'createdAt' | 'updatedAt'> | Partial<RoleDefinition>) => Promise<void>;
  onCancel: () => void;
  isNew: boolean;
}

const RoleEditor: React.FC<RoleEditorProps> = ({
  role,
  allRoles,
  onSave,
  onCancel,
  isNew
}) => {
  const [formData, setFormData] = useState({
    name: role?.name || '',
    displayName: role?.displayName || '',
    description: role?.description || '',
    level: role?.level || 0,
    parentRole: role?.parentRole || '',
    isActive: role?.isActive ?? true,
    category: role?.metadata.category || 'custom',
    color: role?.metadata.color || 'from-sage/20 to-teal-primary/20'
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Role name is required';
    } else if (isNew && allRoles.some(r => r.name === formData.name)) {
      newErrors.name = 'Role name already exists';
    }
    
    if (!formData.displayName.trim()) {
      newErrors.displayName = 'Display name is required';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    if (formData.level < 0 || formData.level > 100) {
      newErrors.level = 'Level must be between 0 and 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    
    setLoading(true);
    try {
      const roleData = {
        ...(isNew ? {} : { id: role!.id }),
        name: formData.name as UserRole,
        displayName: formData.displayName,
        description: formData.description,
        level: formData.level,
        parentRole: formData.parentRole || undefined,
        permissions: role?.permissions || [],
        inheritedPermissions: role?.inheritedPermissions || [],
        contexts: role?.contexts || [],
        isSystemRole: role?.isSystemRole || false,
        isActive: formData.isActive,
        metadata: {
          color: formData.color,
          icon: role?.metadata.icon || 'shield',
          category: formData.category as any
        },
        constraints: role?.constraints || {
          requiresApproval: false
        },
        ...(isNew ? {
          childRoles: [],
          createdBy: 'current-user' // Will be set by backend
        } : {})
      };

      await onSave(roleData);
    } catch (error) {
      console.error('Failed to save role:', error);
    }
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-cream">
          {isNew ? 'Create New Role' : 'Edit Role'}
        </h3>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onCancel}
            disabled={loading}
            className="p-2 text-sage/70 hover:text-cream hover:bg-sage/20 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Basic Info */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-cream mb-1">
              Role Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={!isNew || loading}
              className={cn(
                'w-full px-3 py-2 bg-navy-dark/50 border rounded-lg text-cream',
                'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                errors.name ? 'border-red-error' : 'border-sage/30',
                (!isNew || loading) && 'opacity-50 cursor-not-allowed'
              )}
              placeholder="e.g., content_manager"
            />
            {errors.name && (
              <p className="text-sm text-red-error mt-1">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-cream mb-1">
              Display Name *
            </label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              disabled={loading}
              className={cn(
                'w-full px-3 py-2 bg-navy-dark/50 border rounded-lg text-cream',
                'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                errors.displayName ? 'border-red-error' : 'border-sage/30'
              )}
              placeholder="e.g., Content Manager"
            />
            {errors.displayName && (
              <p className="text-sm text-red-error mt-1">{errors.displayName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-cream mb-1">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={loading}
              rows={3}
              className={cn(
                'w-full px-3 py-2 bg-navy-dark/50 border rounded-lg text-cream resize-none',
                'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                errors.description ? 'border-red-error' : 'border-sage/30'
              )}
              placeholder="Describe what this role does..."
            />
            {errors.description && (
              <p className="text-sm text-red-error mt-1">{errors.description}</p>
            )}
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-cream mb-1">
              Hierarchy Level
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={formData.level}
              onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 0 })}
              disabled={loading}
              className={cn(
                'w-full px-3 py-2 bg-navy-dark/50 border rounded-lg text-cream',
                'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                errors.level ? 'border-red-error' : 'border-sage/30'
              )}
            />
            {errors.level && (
              <p className="text-sm text-red-error mt-1">{errors.level}</p>
            )}
            <p className="text-xs text-sage/50 mt-1">0 = lowest, 100 = highest</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-cream mb-1">
              Parent Role
            </label>
            <select
              value={formData.parentRole}
              onChange={(e) => setFormData({ ...formData, parentRole: e.target.value })}
              disabled={loading}
              className="w-full px-3 py-2 bg-navy-dark/50 border border-sage/30 rounded-lg text-cream
                         focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
            >
              <option value="">No parent (top-level role)</option>
              {allRoles
                .filter(r => r.id !== role?.id && r.level < formData.level)
                .map(r => (
                  <option key={r.id} value={r.id}>{r.displayName}</option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-cream mb-1">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              disabled={loading}
              className="w-full px-3 py-2 bg-navy-dark/50 border border-sage/30 rounded-lg text-cream
                         focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
            >
              <option value="system">System</option>
              <option value="business">Business</option>
              <option value="user">User</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                disabled={loading}
                className="w-4 h-4 text-teal-primary rounded focus:ring-teal-primary/50"
              />
              <span className="text-sm text-cream">Active</span>
            </label>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-sage/10">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 text-sage/70 hover:text-cream hover:bg-sage/20 rounded-lg transition-colors"
        >
          Cancel
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          disabled={loading}
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
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {isNew ? 'Create Role' : 'Save Changes'}
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
};

export const RoleHierarchyManager: React.FC<RoleHierarchyManagerProps> = ({
  roles,
  onRoleUpdate,
  onRoleCreate,
  onRoleDelete,
  onHierarchyChange,
  readonly = false,
  className = ''
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Build role hierarchy
  const roleHierarchy = useMemo(() => {
    const roleMap = new Map(roles.map(role => [role.id, { ...role, children: [] as RoleDefinition[] }]));
    const roots: RoleDefinition[] = [];

    // Build parent-child relationships
    roles.forEach(role => {
      const roleWithChildren = roleMap.get(role.id)!;
      if (role.parentRole && roleMap.has(role.parentRole)) {
        roleMap.get(role.parentRole)!.children.push(roleWithChildren);
      } else {
        roots.push(roleWithChildren);
      }
    });

    // Sort by level and name
    const sortRoles = (roles: RoleDefinition[]) => {
      roles.sort((a, b) => {
        if (a.level !== b.level) return b.level - a.level;
        return a.displayName.localeCompare(b.displayName);
      });
      roles.forEach(role => sortRoles(role.children || []));
    };

    sortRoles(roots);
    return roots;
  }, [roles]);

  // Filter roles based on search
  const filteredRoles = useMemo(() => {
    if (!searchQuery.trim()) return roleHierarchy;
    
    const query = searchQuery.toLowerCase();
    const matchesSearch = (role: RoleDefinition): boolean => {
      return (
        role.name.toLowerCase().includes(query) ||
        role.displayName.toLowerCase().includes(query) ||
        role.description.toLowerCase().includes(query)
      );
    };

    const filterHierarchy = (roles: RoleDefinition[]): RoleDefinition[] => {
      return roles.filter(role => {
        if (matchesSearch(role)) return true;
        const hasMatchingChildren = role.children && filterHierarchy(role.children).length > 0;
        if (hasMatchingChildren) {
          role.children = filterHierarchy(role.children!);
          return true;
        }
        return false;
      });
    };

    return filterHierarchy(roleHierarchy);
  }, [roleHierarchy, searchQuery]);

  const handleToggleExpand = useCallback((roleId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roleId)) {
        newSet.delete(roleId);
      } else {
        newSet.add(roleId);
      }
      return newSet;
    });
  }, []);

  const handleDrop = useCallback(async (draggedId: string, targetId: string) => {
    if (draggedId === targetId || readonly) return;
    
    try {
      await onHierarchyChange([{ roleId: draggedId, newParent: targetId }]);
    } catch (error) {
      console.error('Failed to update role hierarchy:', error);
    }
  }, [onHierarchyChange, readonly]);

  const handleSaveRole = async (roleData: any) => {
    try {
      if (editingRole) {
        await onRoleUpdate(editingRole, roleData);
        setEditingRole(null);
      } else {
        await onRoleCreate(roleData);
        setShowCreateForm(false);
      }
    } catch (error) {
      console.error('Failed to save role:', error);
      throw error;
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (readonly) return;
    
    const role = roles.find(r => r.id === roleId);
    if (!role) return;

    if (role.isSystemRole) {
      alert('Cannot delete system roles');
      return;
    }

    if (confirm(`Are you sure you want to delete the role "${role.displayName}"? This action cannot be undone.`)) {
      try {
        await onRoleDelete(roleId);
      } catch (error) {
        console.error('Failed to delete role:', error);
      }
    }
  };

  const expandAll = () => {
    setExpandedNodes(new Set(roles.map(r => r.id)));
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const currentEditingRole = editingRole ? roles.find(r => r.id === editingRole) : null;

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
            <Shield className="w-6 h-6 text-sage" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-cream">Role Hierarchy</h2>
            <p className="text-sm text-sage/70">
              Manage roles and their inheritance relationships
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
              placeholder="Search roles..."
              className="pl-8 pr-3 py-2 w-48 bg-navy-dark/50 border border-sage/30 rounded-lg text-cream text-sm
                         focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
            />
            <Search className="absolute left-2.5 top-2.5 w-3 h-3 text-sage/50" />
          </div>

          {/* Actions */}
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

          {!readonly && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-teal-primary to-teal-secondary
                         text-cream rounded-lg hover:shadow-lg transition-all"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Role</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {(showCreateForm || editingRole) && (
          <GlassMorphism variant="subtle" className="p-4 mb-6" border>
            <RoleEditor
              role={currentEditingRole}
              allRoles={roles}
              onSave={handleSaveRole}
              onCancel={() => {
                setEditingRole(null);
                setShowCreateForm(false);
              }}
              isNew={showCreateForm}
            />
          </GlassMorphism>
        )}

        {filteredRoles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Shield className="w-12 h-12 text-sage/30 mb-4" />
            <p className="text-sage/70 text-center">
              {searchQuery ? 'No roles match your search' : 'No roles configured yet'}
            </p>
            {!readonly && !searchQuery && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCreateForm(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-primary to-teal-secondary
                           text-cream rounded-lg hover:shadow-lg transition-all"
              >
                <Plus className="w-4 h-4" />
                Create First Role
              </motion.button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {filteredRoles.map(role => (
                <RoleNode
                  key={role.id}
                  role={role}
                  childRoles={role.children || []}
                  expandedNodes={expandedNodes}
                  selectedNode={selectedNode}
                  draggedNode={draggedNode}
                  onToggleExpand={handleToggleExpand}
                  onSelectNode={setSelectedNode}
                  onDragStart={setDraggedNode}
                  onDragEnd={() => setDraggedNode(null)}
                  onDrop={handleDrop}
                  onEdit={setEditingRole}
                  onDelete={handleDeleteRole}
                  readonly={readonly}
                  level={0}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="mt-6 pt-4 border-t border-sage/10">
        <div className="flex items-center justify-between text-sm text-sage/70">
          <div className="flex items-center gap-4">
            <span>{roles.length} total roles</span>
            <span>{roles.filter(r => r.isActive).length} active</span>
            <span>{roles.filter(r => r.isSystemRole).length} system roles</span>
          </div>
          {!readonly && (
            <div className="flex items-center gap-2 text-xs">
              <Move className="w-3 h-3" />
              <span>Drag roles to change hierarchy</span>
            </div>
          )}
        </div>
      </div>
    </GlassMorphism>
  );
};

export default RoleHierarchyManager;