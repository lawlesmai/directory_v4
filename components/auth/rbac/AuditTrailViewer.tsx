'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Search, Filter, Calendar, Download, RefreshCw,
  ChevronLeft, ChevronRight, Eye, EyeOff, Shield, Users,
  AlertTriangle, CheckCircle, XCircle, Clock, MapPin,
  Monitor, Smartphone, Globe, User, Crown, Building2,
  Tool, Zap, Star, Settings, Trash2, Edit3, Plus
} from 'lucide-react';
import { GlassMorphism } from '../../GlassMorphism';
import { cn } from '@/lib/utils';
import type { 
  AuditTrailViewerProps, 
  RBACEvent, 
  BusinessContext 
} from './types';

// Event type configurations
const eventTypeConfig = {
  role_assigned: {
    icon: Shield,
    color: 'text-sage',
    bgColor: 'bg-sage/10',
    borderColor: 'border-sage/30',
    label: 'Role Assigned'
  },
  role_revoked: {
    icon: XCircle,
    color: 'text-red-error',
    bgColor: 'bg-red-error/10',
    borderColor: 'border-red-error/30',
    label: 'Role Revoked'
  },
  permission_granted: {
    icon: CheckCircle,
    color: 'text-sage',
    bgColor: 'bg-sage/10',
    borderColor: 'border-sage/30',
    label: 'Permission Granted'
  },
  permission_revoked: {
    icon: XCircle,
    color: 'text-red-error',
    bgColor: 'bg-red-error/10',
    borderColor: 'border-red-error/30',
    label: 'Permission Revoked'
  },
  role_created: {
    icon: Star,
    color: 'text-teal-primary',
    bgColor: 'bg-teal-primary/10',
    borderColor: 'border-teal-primary/30',
    label: 'Role Created'
  },
  role_updated: {
    icon: Edit3,
    color: 'text-gold-primary',
    bgColor: 'bg-gold-primary/10',
    borderColor: 'border-gold-primary/30',
    label: 'Role Updated'
  },
  role_deleted: {
    icon: Trash2,
    color: 'text-red-error',
    bgColor: 'bg-red-error/10',
    borderColor: 'border-red-error/30',
    label: 'Role Deleted'
  },
  permission_test: {
    icon: Eye,
    color: 'text-teal-primary',
    bgColor: 'bg-teal-primary/10',
    borderColor: 'border-teal-primary/30',
    label: 'Permission Test'
  },
  bulk_operation: {
    icon: Users,
    color: 'text-gold-primary',
    bgColor: 'bg-gold-primary/10',
    borderColor: 'border-gold-primary/30',
    label: 'Bulk Operation'
  },
  security_violation: {
    icon: AlertTriangle,
    color: 'text-red-error',
    bgColor: 'bg-red-error/10',
    borderColor: 'border-red-error/30',
    label: 'Security Violation'
  }
} as const;

// Risk level colors
const riskLevelColors = {
  low: 'text-sage',
  medium: 'text-teal-primary',
  high: 'text-gold-primary',
  critical: 'text-red-error'
} as const;

// Role icons
const roleIcons = {
  customer: User,
  business_owner: Building2,
  service_provider: Tool,
  moderator: Shield,
  admin: Crown,
  super_admin: Zap
} as const;

interface AuditEventItemProps {
  event: RBACEvent;
  expanded: boolean;
  onToggleExpand: () => void;
  onViewDetails?: () => void;
}

const AuditEventItem: React.FC<AuditEventItemProps> = ({
  event,
  expanded,
  onToggleExpand,
  onViewDetails
}) => {
  const config = eventTypeConfig[event.eventType];
  const EventIcon = config.icon;

  const formatDateTime = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getRiskBadge = () => {
    if (event.riskScore >= 80) return { label: 'Critical', color: 'bg-red-error text-cream' };
    if (event.riskScore >= 60) return { label: 'High', color: 'bg-gold-primary text-navy-dark' };
    if (event.riskScore >= 40) return { label: 'Medium', color: 'bg-teal-primary text-navy-dark' };
    return { label: 'Low', color: 'bg-sage text-navy-dark' };
  };

  const riskBadge = getRiskBadge();

  const getDeviceIcon = () => {
    const userAgent = event.metadata.userAgent?.toLowerCase() || '';
    if (userAgent.includes('mobile') || userAgent.includes('android') || userAgent.includes('iphone')) {
      return Smartphone;
    }
    return Monitor;
  };

  const DeviceIcon = getDeviceIcon();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'p-4 rounded-lg border transition-all duration-200',
        config.bgColor,
        config.borderColor,
        'hover:shadow-md'
      )}
    >
      {/* Event Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={cn('p-2 rounded-full', config.bgColor, config.borderColor, 'border')}>
            <EventIcon className={cn('w-4 h-4', config.color)} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-cream">{config.label}</h3>
              <span className={cn('px-2 py-0.5 text-xs rounded-full', riskBadge.color)}>
                {riskBadge.label}
              </span>
              {event.details.batchId && (
                <span className="px-2 py-0.5 text-xs bg-teal-primary/20 text-teal-primary rounded-full">
                  Batch
                </span>
              )}
            </div>
            
            <p className="text-sm text-sage/70 mb-2">
              Resource: {event.resourceType} • Risk Score: {event.riskScore}/100
            </p>
            
            <div className="flex items-center gap-4 text-xs text-sage/50">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{formatDateTime(event.timestamp)}</span>
              </div>
              
              {event.metadata.ipAddress && (
                <div className="flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  <span>{event.metadata.ipAddress}</span>
                </div>
              )}
              
              <div className="flex items-center gap-1">
                <DeviceIcon className="w-3 h-3" />
                <span>
                  {event.metadata.userAgent ? 
                    event.metadata.userAgent.split(' ')[0] : 
                    'Unknown Device'
                  }
                </span>
              </div>
            </div>
            
            {event.details.reason && (
              <p className="text-sm text-cream mt-2 italic">
                "{event.details.reason}"
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onViewDetails && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onViewDetails}
              className="p-1.5 text-sage/70 hover:text-cream hover:bg-white/20 rounded transition-colors"
              title="View full details"
            >
              <Eye className="w-4 h-4" />
            </motion.button>
          )}
          
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onToggleExpand}
            className="p-1.5 text-sage/70 hover:text-cream hover:bg-white/20 rounded transition-colors"
          >
            {expanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </motion.button>
        </div>
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
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-3">
                <div>
                  <p className="text-sage/50 text-xs uppercase tracking-wide mb-1">Event Details</p>
                  <div className="space-y-1">
                    <p className="text-cream">
                      <span className="text-sage/70">Type:</span> {event.eventType.replace('_', ' ')}
                    </p>
                    <p className="text-cream">
                      <span className="text-sage/70">Resource ID:</span> {event.resourceId}
                    </p>
                    <p className="text-cream">
                      <span className="text-sage/70">Resource Type:</span> {event.resourceType}
                    </p>
                    {event.targetUserId && (
                      <p className="text-cream">
                        <span className="text-sage/70">Target User:</span> {event.targetUserId}
                      </p>
                    )}
                  </div>
                </div>
                
                {event.businessContext && (
                  <div>
                    <p className="text-sage/50 text-xs uppercase tracking-wide mb-1">Business Context</p>
                    <div className="space-y-1">
                      <p className="text-cream">
                        <span className="text-sage/70">Name:</span> {event.businessContext.name}
                      </p>
                      <p className="text-cream">
                        <span className="text-sage/70">Type:</span> {event.businessContext.type}
                      </p>
                      {event.businessContext.businessId && (
                        <p className="text-cream">
                          <span className="text-sage/70">Business ID:</span> {event.businessContext.businessId}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-3">
                <div>
                  <p className="text-sage/50 text-xs uppercase tracking-wide mb-1">Session Info</p>
                  <div className="space-y-1">
                    <p className="text-cream">
                      <span className="text-sage/70">User ID:</span> {event.userId}
                    </p>
                    <p className="text-cream">
                      <span className="text-sage/70">Session ID:</span> {event.metadata.sessionId}
                    </p>
                    {event.metadata.requestId && (
                      <p className="text-cream">
                        <span className="text-sage/70">Request ID:</span> {event.metadata.requestId}
                      </p>
                    )}
                  </div>
                </div>
                
                {(event.details.oldValue || event.details.newValue) && (
                  <div>
                    <p className="text-sage/50 text-xs uppercase tracking-wide mb-1">Changes</p>
                    <div className="space-y-2">
                      {event.details.oldValue && (
                        <div className="p-2 bg-red-error/10 rounded border border-red-error/30">
                          <p className="text-xs text-red-error mb-1">Old Value:</p>
                          <code className="text-xs text-cream bg-navy-dark/50 p-1 rounded">
                            {typeof event.details.oldValue === 'object' 
                              ? JSON.stringify(event.details.oldValue, null, 2)
                              : event.details.oldValue
                            }
                          </code>
                        </div>
                      )}
                      
                      {event.details.newValue && (
                        <div className="p-2 bg-sage/10 rounded border border-sage/30">
                          <p className="text-xs text-sage mb-1">New Value:</p>
                          <code className="text-xs text-cream bg-navy-dark/50 p-1 rounded">
                            {typeof event.details.newValue === 'object' 
                              ? JSON.stringify(event.details.newValue, null, 2)
                              : event.details.newValue
                            }
                          </code>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

interface FilterPanelProps {
  filters: AuditTrailViewerProps['filters'];
  onFiltersChange: (filters: AuditTrailViewerProps['filters']) => void;
  onReset: () => void;
  isOpen: boolean;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFiltersChange,
  onReset,
  isOpen
}) => {
  const eventTypes = Object.keys(eventTypeConfig);
  const riskLevels = ['low', 'medium', 'high'];
  
  const updateFilter = <K extends keyof typeof filters>(
    key: K,
    value: typeof filters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleEventType = (eventType: string) => {
    const current = filters.eventTypes || [];
    const updated = current.includes(eventType)
      ? current.filter(t => t !== eventType)
      : [...current, eventType];
    updateFilter('eventTypes', updated);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mb-6"
    >
      <GlassMorphism variant="subtle" className="p-4" border>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Event Types */}
          <div>
            <label className="block text-sm font-medium text-cream mb-2">
              Event Types
            </label>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {eventTypes.map(eventType => (
                <label key={eventType} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.eventTypes?.includes(eventType) || false}
                    onChange={() => toggleEventType(eventType)}
                    className="w-4 h-4 text-teal-primary rounded focus:ring-teal-primary/50"
                  />
                  <span className="text-sm text-cream capitalize">
                    {eventType.replace('_', ' ')}
                  </span>
                </label>
              ))}
            </div>
          </div>
          
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-cream mb-2">
              Date Range
            </label>
            <div className="space-y-2">
              <input
                type="date"
                value={filters.dateRange?.start ? filters.dateRange.start.toISOString().split('T')[0] : ''}
                onChange={(e) => updateFilter('dateRange', {
                  start: e.target.value ? new Date(e.target.value) : undefined,
                  end: filters.dateRange?.end
                } as any)}
                className="w-full px-3 py-2 bg-navy-dark/50 border border-sage/30 rounded text-cream text-sm
                           focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
                placeholder="Start date"
              />
              <input
                type="date"
                value={filters.dateRange?.end ? filters.dateRange.end.toISOString().split('T')[0] : ''}
                onChange={(e) => updateFilter('dateRange', {
                  start: filters.dateRange?.start,
                  end: e.target.value ? new Date(e.target.value) : undefined
                } as any)}
                className="w-full px-3 py-2 bg-navy-dark/50 border border-sage/30 rounded text-cream text-sm
                           focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
                placeholder="End date"
              />
            </div>
          </div>
          
          {/* Risk Level */}
          <div>
            <label className="block text-sm font-medium text-cream mb-2">
              Minimum Risk Level
            </label>
            <select
              value={filters.riskLevel || 'low'}
              onChange={(e) => updateFilter('riskLevel', e.target.value as any)}
              className="w-full px-3 py-2 bg-navy-dark/50 border border-sage/30 rounded text-cream text-sm
                         focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
            >
              <option value="">All Levels</option>
              <option value="low">Low and above</option>
              <option value="medium">Medium and above</option>
              <option value="high">High only</option>
            </select>
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-sage/10">
          <button
            onClick={onReset}
            className="px-4 py-2 text-sage/70 hover:text-cream hover:bg-sage/20 rounded transition-colors"
          >
            Reset Filters
          </button>
          <span className="text-sm text-sage/50">
            Filters applied: {[
              filters.eventTypes?.length && 'Event Types',
              filters.dateRange?.start && 'Start Date',
              filters.dateRange?.end && 'End Date',
              filters.riskLevel && 'Risk Level',
              filters.userIds?.length && 'Users'
            ].filter(Boolean).length}
          </span>
        </div>
      </GlassMorphism>
    </motion.div>
  );
};

export const AuditTrailViewer: React.FC<AuditTrailViewerProps> = ({
  events,
  totalCount,
  filters,
  onFiltersChange,
  onLoadMore,
  onExport,
  loading = false,
  className = ''
}) => {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());

  // Filter events by search query
  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return events;
    
    const query = searchQuery.toLowerCase();
    return events.filter(event => 
      event.eventType.toLowerCase().includes(query) ||
      event.resourceType.toLowerCase().includes(query) ||
      event.userId.toLowerCase().includes(query) ||
      event.details.reason?.toLowerCase().includes(query) ||
      event.metadata.ipAddress?.includes(query)
    );
  }, [events, searchQuery]);

  const toggleEventExpand = useCallback((eventId: string) => {
    setExpandedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  }, []);

  const toggleEventSelect = useCallback((eventId: string) => {
    setSelectedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  }, []);

  const selectAllEvents = () => {
    if (selectedEvents.size === filteredEvents.length) {
      setSelectedEvents(new Set());
    } else {
      setSelectedEvents(new Set(filteredEvents.map(e => e.id)));
    }
  };

  const expandAllEvents = () => {
    setExpandedEvents(new Set(filteredEvents.map(e => e.id)));
  };

  const collapseAllEvents = () => {
    setExpandedEvents(new Set());
  };

  const resetFilters = () => {
    onFiltersChange({});
    setSearchQuery('');
  };

  const handleExport = async (format: 'csv' | 'json' | 'pdf') => {
    const eventsToExport = selectedEvents.size > 0 
      ? filteredEvents.filter(e => selectedEvents.has(e.id))
      : filteredEvents;
    
    await onExport(format);
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const eventTypeCounts = filteredEvents.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const riskDistribution = filteredEvents.reduce((acc, event) => {
      if (event.riskScore >= 80) acc.critical++;
      else if (event.riskScore >= 60) acc.high++;
      else if (event.riskScore >= 40) acc.medium++;
      else acc.low++;
      return acc;
    }, { critical: 0, high: 0, medium: 0, low: 0 });

    return {
      totalDisplayed: filteredEvents.length,
      totalFiltered: events.length,
      eventTypeCounts,
      riskDistribution
    };
  }, [filteredEvents, events]);

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
            <FileText className="w-6 h-6 text-sage" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-cream">Audit Trail</h2>
            <p className="text-sm text-sage/70">
              Track all RBAC changes and security events
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Export Menu */}
          <div className="relative group">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1 px-3 py-2 text-sage/70 hover:text-cream hover:bg-sage/20 
                         rounded transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </motion.button>
            <div className="absolute right-0 top-full mt-1 w-32 bg-navy-dark/90 backdrop-blur-sm border 
                           border-sage/20 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 
                           group-hover:visible transition-all z-10">
              <div className="p-2 space-y-1">
                {(['csv', 'json', 'pdf'] as const).map(format => (
                  <button
                    key={format}
                    onClick={() => handleExport(format)}
                    className="w-full text-left px-3 py-2 text-sm text-sage/70 hover:text-cream 
                               hover:bg-sage/20 rounded uppercase transition-colors"
                  >
                    {format}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-1 px-3 py-2 rounded transition-colors',
              showFilters
                ? 'bg-teal-primary/20 text-teal-primary'
                : 'text-sage/70 hover:text-cream hover:bg-sage/20'
            )}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.reload()}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-2 bg-gradient-to-r from-teal-primary to-teal-secondary
                       text-cream rounded hover:shadow-lg transition-all disabled:opacity-50"
          >
            <motion.div
              animate={loading ? { rotate: 360 } : {}}
              transition={loading ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
            >
              <RefreshCw className="w-4 h-4" />
            </motion.div>
            <span className="hidden sm:inline">
              {loading ? 'Loading...' : 'Refresh'}
            </span>
          </motion.button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search events by type, user, resource, or reason..."
          className="w-full pl-10 pr-4 py-3 bg-navy-dark/50 border border-sage/30 rounded-lg text-cream
                     focus:outline-none focus:ring-2 focus:ring-teal-primary/50 focus:border-teal-primary/50"
        />
        <Search className="absolute left-3 top-3.5 w-4 h-4 text-sage/50" />
      </div>

      {/* Filter Panel */}
      <FilterPanel
        filters={filters}
        onFiltersChange={onFiltersChange}
        onReset={resetFilters}
        isOpen={showFilters}
      />

      {/* Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <GlassMorphism variant="subtle" className="p-4 text-center" border>
          <p className="text-2xl font-bold text-cream">{stats.totalDisplayed}</p>
          <p className="text-sm text-sage/70">Showing</p>
        </GlassMorphism>
        <GlassMorphism variant="subtle" className="p-4 text-center" border>
          <p className="text-2xl font-bold text-sage">{stats.riskDistribution.low}</p>
          <p className="text-sm text-sage/70">Low Risk</p>
        </GlassMorphism>
        <GlassMorphism variant="subtle" className="p-4 text-center" border>
          <p className="text-2xl font-bold text-gold-primary">{stats.riskDistribution.high}</p>
          <p className="text-sm text-sage/70">High Risk</p>
        </GlassMorphism>
        <GlassMorphism variant="subtle" className="p-4 text-center" border>
          <p className="text-2xl font-bold text-red-error">{stats.riskDistribution.critical}</p>
          <p className="text-sm text-sage/70">Critical</p>
        </GlassMorphism>
      </div>

      {/* Bulk Actions */}
      {selectedEvents.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 bg-teal-primary/10 border border-teal-primary/30 rounded-lg"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-cream">
              {selectedEvents.size} event{selectedEvents.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedEvents(new Set())}
                className="text-sm text-sage/70 hover:text-cream transition-colors"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Event Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedEvents.size === filteredEvents.length && filteredEvents.length > 0}
              onChange={selectAllEvents}
              className="w-4 h-4 text-teal-primary rounded focus:ring-teal-primary/50"
            />
            <span className="text-sm text-cream">Select All</span>
          </label>
          <span className="text-sm text-sage/70">
            {stats.totalDisplayed} of {totalCount} events
          </span>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={expandAllEvents}
            className="p-2 text-sage/70 hover:text-cream hover:bg-sage/20 rounded transition-colors"
            title="Expand All"
          >
            <Eye className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={collapseAllEvents}
            className="p-2 text-sage/70 hover:text-cream hover:bg-sage/20 rounded transition-colors"
            title="Collapse All"
          >
            <EyeOff className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-4 min-h-[400px]">
        {loading && filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 border-2 border-teal-primary/30 border-t-teal-primary rounded-full mb-4"
            />
            <p className="text-sage/70">Loading audit events...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-sage/30 mb-4" />
            <p className="text-sage/70 text-center">
              {searchQuery || Object.keys(filters).length > 0
                ? 'No events match your search or filters'
                : 'No audit events found'}
            </p>
            {(searchQuery || Object.keys(filters).length > 0) && (
              <button
                onClick={resetFilters}
                className="mt-3 px-4 py-2 text-teal-primary hover:text-teal-secondary transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence>
            {filteredEvents.map(event => (
              <div key={event.id} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedEvents.has(event.id)}
                  onChange={() => toggleEventSelect(event.id)}
                  className="mt-4 w-4 h-4 text-teal-primary rounded focus:ring-teal-primary/50"
                />
                <div className="flex-1">
                  <AuditEventItem
                    event={event}
                    expanded={expandedEvents.has(event.id)}
                    onToggleExpand={() => toggleEventExpand(event.id)}
                  />
                </div>
              </div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Load More */}
      {filteredEvents.length < totalCount && (
        <div className="flex items-center justify-center mt-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onLoadMore}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-primary to-teal-secondary
                       text-cream rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-cream/30 border-t-cream rounded-full"
                />
                Loading more...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Load More Events
              </>
            )}
          </motion.button>
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-sage/10">
        <div className="flex items-center justify-between text-sm text-sage/70">
          <div className="flex items-center gap-4">
            <span>Showing {stats.totalDisplayed} of {totalCount} events</span>
            {searchQuery && (
              <span>Search: "{searchQuery}"</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-sage rounded-full" />
              <span>Low Risk</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-gold-primary rounded-full" />
              <span>High Risk</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-error rounded-full" />
              <span>Critical</span>
            </div>
          </div>
        </div>
      </div>
    </GlassMorphism>
  );
};

export default AuditTrailViewer;