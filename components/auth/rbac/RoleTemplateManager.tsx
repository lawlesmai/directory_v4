'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Template, Plus, Search, Filter, Star, Copy, Edit3, Trash2,
  Download, Upload, Save, X, Check, Eye, EyeOff, Users,
  Settings, Building2, Crown, Shield, Zap, Tool, User,
  Tag, Calendar, TrendingUp, Award, BookOpen, Sparkles
} from 'lucide-react';
import { GlassMorphism } from '../../GlassMorphism';
import { cn } from '@/lib/utils';
import type { 
  RoleTemplateManagerProps, 
  RoleTemplate, 
  RoleDefinition, 
  PermissionDefinition,
  BusinessContext,
  Permission,
  UserRole
} from './types';

// Template category icons
const categoryIcons = {
  business: Building2,
  system: Settings,
  custom: Sparkles
} as const;

// Template category colors
const categoryColors = {
  business: 'from-teal-primary/20 to-teal-secondary/20 border-teal-primary/30',
  system: 'from-red-error/20 to-red-warning/20 border-red-error/30',
  custom: 'from-gold-primary/20 to-gold-secondary/20 border-gold-primary/30'
} as const;

// Role icons (consistent with other components)
const roleIcons = {
  customer: User,
  business_owner: Building2,
  service_provider: Tool,
  moderator: Shield,
  admin: Crown,
  super_admin: Zap
} as const;

interface TemplateCardProps {
  template: RoleTemplate;
  roles: RoleDefinition[];
  permissions: PermissionDefinition[];
  onEdit: () => void;
  onDelete: () => void;
  onApply: () => void;
  onDuplicate: () => void;
  readonly?: boolean;
}

const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  roles,
  permissions,
  onEdit,
  onDelete,
  onApply,
  onDuplicate,
  readonly = false
}) => {
  const [expanded, setExpanded] = useState(false);

  const CategoryIcon = categoryIcons[template.category] || Sparkles;
  const RoleIcon = roleIcons[template.targetRole] || Shield;
  const categoryColorClass = categoryColors[template.category] || categoryColors.custom;

  const templatePermissions = permissions.filter(p => 
    template.permissions.includes(p.name)
  );

  const permissionsByResource = useMemo(() => {
    const grouped = new Map<string, PermissionDefinition[]>();
    templatePermissions.forEach(permission => {
      const existing = grouped.get(permission.resource) || [];
      existing.push(permission);
      grouped.set(permission.resource, existing);
    });
    return grouped;
  }, [templatePermissions]);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'p-4 rounded-lg border transition-all duration-200 hover:shadow-md',
        'bg-gradient-to-br',
        categoryColorClass
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="p-2 bg-gradient-to-br from-white/20 to-white/10 rounded-full">
            <CategoryIcon className="w-5 h-5 text-sage" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-cream truncate">{template.name}</h3>
              {template.isPublic && (
                <Star className="w-4 h-4 text-gold-primary" title="Public template" />
              )}
            </div>
            <p className="text-sm text-sage/70 line-clamp-2 mt-1">
              {template.description}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1">
                <RoleIcon className="w-3 h-3 text-sage/50" />
                <span className="text-xs text-sage/70 capitalize">
                  {template.targetRole.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-sage/50" />
                <span className="text-xs text-sage/70">
                  {template.permissions.length} permissions
                </span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-sage/50" />
                <span className="text-xs text-sage/70">
                  Used {template.usageCount} times
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-sage/70 hover:text-cream hover:bg-white/20 rounded transition-colors"
          >
            {expanded ? (
              <EyeOff className="w-3 h-3" />
            ) : (
              <Eye className="w-3 h-3" />
            )}
          </motion.button>

          {!readonly && (
            <>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onDuplicate}
                className="p-1.5 text-sage/70 hover:text-teal-primary hover:bg-teal-primary/20 rounded transition-colors"
                title="Duplicate template"
              >
                <Copy className="w-3 h-3" />
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onApply}
                className="p-1.5 text-sage/70 hover:text-sage hover:bg-sage/20 rounded transition-colors"
                title="Apply to users"
              >
                <Users className="w-3 h-3" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onEdit}
                className="p-1.5 text-sage/70 hover:text-teal-primary hover:bg-teal-primary/20 rounded transition-colors"
                title="Edit template"
              >
                <Edit3 className="w-3 h-3" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onDelete}
                className="p-1.5 text-sage/70 hover:text-red-error hover:bg-red-error/20 rounded transition-colors"
                title="Delete template"
              >
                <Trash2 className="w-3 h-3" />
              </motion.button>
            </>
          )}
        </div>
      </div>

      {/* Tags */}
      {template.metadata.tags && template.metadata.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {template.metadata.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-white/20 text-sage/80 rounded-full"
            >
              <Tag className="w-2 h-2" />
              {tag}
            </span>
          ))}
          {template.metadata.tags.length > 3 && (
            <span className="text-xs text-sage/50">
              +{template.metadata.tags.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Metadata */}
      <div className="flex items-center justify-between text-xs text-sage/50">
        <div className="flex items-center gap-3">
          <span>Created {formatDate(template.createdAt)}</span>
          {template.metadata.industry && (
            <>
              <span>•</span>
              <span className="capitalize">{template.metadata.industry}</span>
            </>
          )}
          {template.metadata.businessSize && (
            <>
              <span>•</span>
              <span className="capitalize">{template.metadata.businessSize}</span>
            </>
          )}
        </div>
        <span className="capitalize font-medium text-sage/70">
          {template.category}
        </span>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-4 pt-4 border-t border-white/10"
          >
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-cream">
                Included Permissions ({templatePermissions.length})
              </h4>
              
              <div className="space-y-2">
                {Array.from(permissionsByResource.entries()).map(([resource, resourcePermissions]) => (
                  <div key={resource} className="bg-navy-50/10 rounded-lg p-3">
                    <h5 className="text-xs font-medium text-sage/80 uppercase tracking-wide mb-2">
                      {resource} ({resourcePermissions.length})
                    </h5>
                    <div className="grid grid-cols-2 gap-1">
                      {resourcePermissions.map(permission => (
                        <div
                          key={permission.id}
                          className="flex items-center gap-2 text-xs text-sage/70"
                        >
                          <div className={cn(
                            'w-2 h-2 rounded-full',
                            permission.riskLevel === 'critical' && 'bg-red-error',
                            permission.riskLevel === 'high' && 'bg-gold-primary',
                            permission.riskLevel === 'medium' && 'bg-teal-primary',
                            permission.riskLevel === 'low' && 'bg-sage'
                          )} />
                          <span className="truncate">{permission.displayName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Contexts */}
              {template.contexts.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-sage/80 uppercase tracking-wide mb-2">
                    Available Contexts
                  </h5>
                  <div className="flex flex-wrap gap-1">
                    {template.contexts.map(context => (
                      <span
                        key={context.id}
                        className="px-2 py-0.5 text-xs bg-teal-primary/20 text-teal-primary rounded"
                      >
                        {context.name}
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

interface TemplateEditorProps {
  template: RoleTemplate | null;
  roles: RoleDefinition[];
  permissions: PermissionDefinition[];
  businessContexts: BusinessContext[];
  onSave: (template: any) => Promise<void>;
  onCancel: () => void;
  isNew: boolean;
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  roles,
  permissions,
  businessContexts,
  onSave,
  onCancel,
  isNew
}) => {
  const [formData, setFormData] = useState({
    name: template?.name || '',
    description: template?.description || '',
    category: template?.category || 'custom',
    targetRole: template?.targetRole || 'customer',
    permissions: new Set(template?.permissions || []),
    contexts: new Set(template?.contexts.map(c => c.id) || []),
    isPublic: template?.isPublic ?? false,
    tags: template?.metadata.tags?.join(', ') || '',
    industry: template?.metadata.industry || '',
    businessSize: template?.metadata.businessSize || ''
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [permissionFilter, setPermissionFilter] = useState('all');

  const filteredPermissions = useMemo(() => {
    let filtered = permissions;
    
    if (permissionFilter !== 'all') {
      filtered = filtered.filter(p => p.resource === permissionFilter);
    }

    return filtered.sort((a, b) => {
      if (a.resource !== b.resource) {
        return a.resource.localeCompare(b.resource);
      }
      return a.displayName.localeCompare(b.displayName);
    });
  }, [permissions, permissionFilter]);

  const resourceGroups = useMemo(() => {
    const groups = new Map<string, PermissionDefinition[]>();
    filteredPermissions.forEach(permission => {
      const existing = groups.get(permission.resource) || [];
      existing.push(permission);
      groups.set(permission.resource, existing);
    });
    return groups;
  }, [filteredPermissions]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Template name is required';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    if (formData.permissions.size === 0) {
      newErrors.permissions = 'At least one permission must be selected';
    }

    if (formData.contexts.size === 0) {
      newErrors.contexts = 'At least one context must be selected';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    
    setLoading(true);
    try {
      const templateData = {
        ...(isNew ? {} : { id: template!.id }),
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category,
        targetRole: formData.targetRole as UserRole,
        permissions: Array.from(formData.permissions),
        contexts: Array.from(formData.contexts).map(id => 
          businessContexts.find(ctx => ctx.id === id)!
        ),
        isPublic: formData.isPublic,
        metadata: {
          tags: formData.tags.split(',').map(t => t.trim()).filter(t => t.length > 0),
          industry: formData.industry || undefined,
          businessSize: formData.businessSize || undefined
        },
        ...(isNew ? {
          usageCount: 0,
          createdBy: 'current-user' // Will be set by backend
        } : {})
      };

      await onSave(templateData);
    } catch (error) {
      console.error('Failed to save template:', error);
    }
    setLoading(false);
  };

  const togglePermission = (permission: Permission) => {
    setFormData(prev => {
      const newPermissions = new Set(prev.permissions);
      if (newPermissions.has(permission)) {
        newPermissions.delete(permission);
      } else {
        newPermissions.add(permission);
      }
      return { ...prev, permissions: newPermissions };
    });
  };

  const toggleContext = (contextId: string) => {
    setFormData(prev => {
      const newContexts = new Set(prev.contexts);
      if (newContexts.has(contextId)) {
        newContexts.delete(contextId);
      } else {
        newContexts.add(contextId);
      }
      return { ...prev, contexts: newContexts };
    });
  };

  const selectAllPermissions = (resource: string) => {
    const resourcePermissions = permissions.filter(p => p.resource === resource);
    setFormData(prev => {
      const newPermissions = new Set(prev.permissions);
      resourcePermissions.forEach(p => newPermissions.add(p.name));
      return { ...prev, permissions: newPermissions };
    });
  };

  const deselectAllPermissions = (resource: string) => {
    const resourcePermissions = permissions.filter(p => p.resource === resource);
    setFormData(prev => {
      const newPermissions = new Set(prev.permissions);
      resourcePermissions.forEach(p => newPermissions.delete(p.name));
      return { ...prev, permissions: newPermissions };
    });
  };

  return (
    <GlassMorphism variant="medium" className="p-6" border>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-cream">
          {isNew ? 'Create Role Template' : 'Edit Role Template'}
        </h3>
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

      <div className="grid grid-cols-2 gap-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-cream mb-1">
              Template Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={loading}
              className={cn(
                'w-full px-3 py-2 bg-navy-dark/50 border rounded-lg text-cream',
                'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                errors.name ? 'border-red-error' : 'border-sage/30'
              )}
              placeholder="e.g., Store Manager Template"
            />
            {errors.name && (
              <p className="text-sm text-red-error mt-1">{errors.name}</p>
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
              placeholder="Describe what this template is for..."
            />
            {errors.description && (
              <p className="text-sm text-red-error mt-1">{errors.description}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
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
                <option value="business">Business</option>
                <option value="system">System</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-cream mb-1">
                Target Role
              </label>
              <select
                value={formData.targetRole}
                onChange={(e) => setFormData({ ...formData, targetRole: e.target.value })}
                disabled={loading}
                className="w-full px-3 py-2 bg-navy-dark/50 border border-sage/30 rounded-lg text-cream
                           focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
              >
                <option value="customer">Customer</option>
                <option value="business_owner">Business Owner</option>
                <option value="service_provider">Service Provider</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-cream mb-1">
                Industry (optional)
              </label>
              <input
                type="text"
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                disabled={loading}
                className="w-full px-3 py-2 bg-navy-dark/50 border border-sage/30 rounded-lg text-cream
                           focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
                placeholder="e.g., retail, healthcare"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-cream mb-1">
                Business Size (optional)
              </label>
              <select
                value={formData.businessSize}
                onChange={(e) => setFormData({ ...formData, businessSize: e.target.value })}
                disabled={loading}
                className="w-full px-3 py-2 bg-navy-dark/50 border border-sage/30 rounded-lg text-cream
                           focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
              >
                <option value="">Any size</option>
                <option value="small">Small (1-50)</option>
                <option value="medium">Medium (51-200)</option>
                <option value="large">Large (201-1000)</option>
                <option value="enterprise">Enterprise (1000+)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-cream mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              disabled={loading}
              className="w-full px-3 py-2 bg-navy-dark/50 border border-sage/30 rounded-lg text-cream
                         focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
              placeholder="e.g., manager, sales, customer-service"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPublic"
              checked={formData.isPublic}
              onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
              disabled={loading}
              className="w-4 h-4 text-teal-primary rounded focus:ring-teal-primary/50"
            />
            <label htmlFor="isPublic" className="text-sm text-cream cursor-pointer">
              Make this template public for others to use
            </label>
          </div>

          {/* Business Contexts */}
          <div>
            <label className="block text-sm font-medium text-cream mb-2">
              Available Contexts *
            </label>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {businessContexts.map(context => (
                <label key={context.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.contexts.has(context.id)}
                    onChange={() => toggleContext(context.id)}
                    disabled={loading}
                    className="w-4 h-4 text-teal-primary rounded focus:ring-teal-primary/50"
                  />
                  <span className="text-sm text-cream">{context.name}</span>
                  <span className="text-xs text-sage/50 capitalize">({context.type})</span>
                </label>
              ))}
            </div>
            {errors.contexts && (
              <p className="text-sm text-red-error mt-1">{errors.contexts}</p>
            )}
          </div>
        </div>

        {/* Permissions Selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-cream">
              Permissions * ({formData.permissions.size} selected)
            </label>
            <select
              value={permissionFilter}
              onChange={(e) => setPermissionFilter(e.target.value)}
              className="px-2 py-1 text-xs bg-navy-dark/50 border border-sage/30 rounded text-cream
                         focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
            >
              <option value="all">All Resources</option>
              {Array.from(new Set(permissions.map(p => p.resource))).map(resource => (
                <option key={resource} value={resource} className="capitalize">
                  {resource}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {Array.from(resourceGroups.entries()).map(([resource, resourcePermissions]) => (
              <div key={resource} className="bg-navy-50/10 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-cream capitalize">
                    {resource} ({resourcePermissions.length})
                  </h4>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => selectAllPermissions(resource)}
                      className="px-2 py-0.5 text-xs text-teal-primary hover:bg-teal-primary/20 rounded transition-colors"
                    >
                      All
                    </button>
                    <button
                      onClick={() => deselectAllPermissions(resource)}
                      className="px-2 py-0.5 text-xs text-red-error hover:bg-red-error/20 rounded transition-colors"
                    >
                      None
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {resourcePermissions.map(permission => (
                    <label
                      key={permission.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={formData.permissions.has(permission.name)}
                        onChange={() => togglePermission(permission.name)}
                        disabled={loading}
                        className="w-3 h-3 text-teal-primary rounded focus:ring-teal-primary/50"
                      />
                      <div className={cn(
                        'w-2 h-2 rounded-full flex-shrink-0',
                        permission.riskLevel === 'critical' && 'bg-red-error',
                        permission.riskLevel === 'high' && 'bg-gold-primary',
                        permission.riskLevel === 'medium' && 'bg-teal-primary',
                        permission.riskLevel === 'low' && 'bg-sage'
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-cream truncate">
                          {permission.displayName}
                        </p>
                        <p className="text-xs text-sage/50 truncate">
                          {permission.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {errors.permissions && (
            <p className="text-sm text-red-error">{errors.permissions}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-sage/10">
        <button
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 text-sage/70 hover:text-cream hover:bg-sage/20 rounded-lg transition-colors"
        >
          Cancel
        </button>
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
              {isNew ? 'Create Template' : 'Save Changes'}
            </>
          )}
        </motion.button>
      </div>
    </GlassMorphism>
  );
};

export const RoleTemplateManager: React.FC<RoleTemplateManagerProps> = ({
  templates,
  roles,
  permissions,
  onTemplateCreate,
  onTemplateUpdate,
  onTemplateDelete,
  onTemplateApply,
  className = ''
}) => {
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [targetRoleFilter, setTargetRoleFilter] = useState<string>('all');

  // Mock business contexts for demo
  const businessContexts: BusinessContext[] = [
    { id: 'global', name: 'Global', type: 'global', isActive: true },
    { id: 'store-1', name: 'Main Store', type: 'business', businessId: 'store-1', isActive: true }
  ];

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.metadata.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(template => template.category === categoryFilter);
    }

    if (targetRoleFilter !== 'all') {
      filtered = filtered.filter(template => template.targetRole === targetRoleFilter);
    }

    return filtered.sort((a, b) => {
      // Sort by usage count (most used first), then by name
      if (a.usageCount !== b.usageCount) {
        return b.usageCount - a.usageCount;
      }
      return a.name.localeCompare(b.name);
    });
  }, [templates, searchQuery, categoryFilter, targetRoleFilter]);

  const handleSaveTemplate = async (templateData: any) => {
    try {
      if (editingTemplate) {
        await onTemplateUpdate(editingTemplate, templateData);
        setEditingTemplate(null);
      } else {
        await onTemplateCreate(templateData);
        setShowCreateForm(false);
      }
    } catch (error) {
      console.error('Failed to save template:', error);
      throw error;
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    if (confirm(`Are you sure you want to delete the template "${template.name}"? This action cannot be undone.`)) {
      try {
        await onTemplateDelete(templateId);
      } catch (error) {
        console.error('Failed to delete template:', error);
      }
    }
  };

  const handleDuplicateTemplate = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    const duplicateData = {
      name: `${template.name} (Copy)`,
      description: template.description,
      category: template.category,
      targetRole: template.targetRole,
      permissions: template.permissions,
      contexts: template.contexts,
      isPublic: false,
      metadata: { ...template.metadata }
    };

    try {
      await onTemplateCreate(duplicateData);
    } catch (error) {
      console.error('Failed to duplicate template:', error);
    }
  };

  const handleApplyTemplate = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    // For demo purposes, we'll simulate applying to random users
    const targetUsers = ['user-1', 'user-2', 'user-3'];
    const context = businessContexts[0];

    try {
      await onTemplateApply(templateId, targetUsers, context);
      alert(`Template "${template.name}" applied to ${targetUsers.length} users successfully!`);
    } catch (error) {
      console.error('Failed to apply template:', error);
    }
  };

  const currentEditingTemplate = editingTemplate ? templates.find(t => t.id === editingTemplate) : null;

  const stats = useMemo(() => {
    return {
      total: templates.length,
      byCategory: {
        business: templates.filter(t => t.category === 'business').length,
        system: templates.filter(t => t.category === 'system').length,
        custom: templates.filter(t => t.category === 'custom').length
      },
      public: templates.filter(t => t.isPublic).length,
      mostUsed: templates.reduce((max, template) => 
        template.usageCount > max ? template.usageCount : max, 0
      )
    };
  }, [templates]);

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
            <Template className="w-6 h-6 text-sage" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-cream">Role Templates</h2>
            <p className="text-sm text-sage/70">
              Create and manage reusable role configurations
            </p>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-teal-primary to-teal-secondary
                     text-cream rounded-lg hover:shadow-lg transition-all"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Template</span>
        </motion.button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-8 pr-3 py-2 bg-navy-dark/50 border border-sage/30 rounded-lg text-cream
                       focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
          />
          <Search className="absolute left-2.5 top-2.5 w-3 h-3 text-sage/50" />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-navy-dark/50 border border-sage/30 rounded-lg text-cream
                     focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
        >
          <option value="all">All Categories</option>
          <option value="business">Business</option>
          <option value="system">System</option>
          <option value="custom">Custom</option>
        </select>

        <select
          value={targetRoleFilter}
          onChange={(e) => setTargetRoleFilter(e.target.value)}
          className="px-3 py-2 bg-navy-dark/50 border border-sage/30 rounded-lg text-cream
                     focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
        >
          <option value="all">All Roles</option>
          <option value="customer">Customer</option>
          <option value="business_owner">Business Owner</option>
          <option value="service_provider">Service Provider</option>
          <option value="moderator">Moderator</option>
          <option value="admin">Admin</option>
          <option value="super_admin">Super Admin</option>
        </select>
      </div>

      {/* Content */}
      {(showCreateForm || editingTemplate) && (
        <div className="mb-6">
          <TemplateEditor
            template={currentEditingTemplate}
            roles={roles}
            permissions={permissions}
            businessContexts={businessContexts}
            onSave={handleSaveTemplate}
            onCancel={() => {
              setEditingTemplate(null);
              setShowCreateForm(false);
            }}
            isNew={showCreateForm}
          />
        </div>
      )}

      {/* Templates Grid */}
      <div className="min-h-[400px]">
        {filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Template className="w-12 h-12 text-sage/30 mb-4" />
            <p className="text-sage/70 text-center">
              {searchQuery || categoryFilter !== 'all' || targetRoleFilter !== 'all'
                ? 'No templates match your filters'
                : 'No role templates created yet'}
            </p>
            {!searchQuery && categoryFilter === 'all' && targetRoleFilter === 'all' && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCreateForm(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-primary to-teal-secondary
                           text-cream rounded-lg hover:shadow-lg transition-all"
              >
                <Plus className="w-4 h-4" />
                Create First Template
              </motion.button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnimatePresence>
              {filteredTemplates.map(template => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  roles={roles}
                  permissions={permissions}
                  onEdit={() => setEditingTemplate(template.id)}
                  onDelete={() => handleDeleteTemplate(template.id)}
                  onApply={() => handleApplyTemplate(template.id)}
                  onDuplicate={() => handleDuplicateTemplate(template.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="mt-6 pt-4 border-t border-sage/10">
        <div className="grid grid-cols-5 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-cream">{stats.total}</p>
            <p className="text-xs text-sage/70">Total Templates</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-teal-primary">{stats.byCategory.business}</p>
            <p className="text-xs text-sage/70">Business</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-error">{stats.byCategory.system}</p>
            <p className="text-xs text-sage/70">System</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gold-primary">{stats.byCategory.custom}</p>
            <p className="text-xs text-sage/70">Custom</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-sage">{stats.public}</p>
            <p className="text-xs text-sage/70">Public</p>
          </div>
        </div>
      </div>
    </GlassMorphism>
  );
};

export default RoleTemplateManager;