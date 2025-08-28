'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye,
  Filter,
  Download,
  Search,
  Calendar,
  User,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Settings,
  Lock,
  Unlock,
  UserPlus,
  UserMinus,
  Globe,
  Activity,
  Clock,
  MapPin,
  Monitor,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Database,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '@/components/GlassMorphism';

interface AuditLogEntry {
  id: string;
  timestamp: Date;
  adminId: string;
  adminEmail: string;
  adminRole: 'super_admin' | 'platform_admin' | 'support_admin' | 'content_moderator';
  action: string;
  category: 'user_management' | 'security' | 'settings' | 'business_management' | 'content_moderation' | 'system';
  resourceType: string;
  resourceId?: string;
  details: Record<string, any>;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  location?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  success: boolean;
  duration?: number; // in ms
  errorMessage?: string;
}

interface AuditLogViewerProps {
  className?: string;
  realTime?: boolean;
}

// Mock audit log data
const mockAuditLogs: AuditLogEntry[] = [
  {
    id: 'audit-1',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    adminId: 'admin-1',
    adminEmail: 'admin@lawlessdirectory.com',
    adminRole: 'super_admin',
    action: 'user_suspended',
    category: 'user_management',
    resourceType: 'user',
    resourceId: 'user-123',
    details: { reason: 'Policy violation', duration: '30 days' },
    oldValues: { status: 'active' },
    newValues: { status: 'suspended' },
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    location: 'San Francisco, CA',
    severity: 'high',
    success: true,
    duration: 1234
  },
  {
    id: 'audit-2',
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    adminId: 'admin-2',
    adminEmail: 'platform@lawlessdirectory.com',
    adminRole: 'platform_admin',
    action: 'business_verified',
    category: 'business_management',
    resourceType: 'business',
    resourceId: 'biz-456',
    details: { businessName: 'Acme Corp', verificationLevel: 'premium' },
    oldValues: { verificationStatus: 'pending' },
    newValues: { verificationStatus: 'verified' },
    ipAddress: '203.0.113.45',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    location: 'New York, NY',
    severity: 'medium',
    success: true,
    duration: 890
  },
  {
    id: 'audit-3',
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    adminId: 'admin-3',
    adminEmail: 'support@lawlessdirectory.com',
    adminRole: 'support_admin',
    action: 'login_attempt',
    category: 'security',
    resourceType: 'session',
    details: { mfaUsed: true, deviceTrusted: false },
    ipAddress: '198.51.100.23',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X)',
    location: 'Austin, TX',
    severity: 'low',
    success: false,
    errorMessage: 'MFA code expired',
    duration: 5432
  },
  {
    id: 'audit-4',
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    adminId: 'admin-1',
    adminEmail: 'admin@lawlessdirectory.com',
    adminRole: 'super_admin',
    action: 'settings_updated',
    category: 'settings',
    resourceType: 'security_config',
    details: { setting: 'session_timeout', operation: 'update' },
    oldValues: { sessionTimeout: 60 },
    newValues: { sessionTimeout: 30 },
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    location: 'San Francisco, CA',
    severity: 'medium',
    success: true,
    duration: 678
  },
  {
    id: 'audit-5',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    adminId: 'admin-4',
    adminEmail: 'moderator@lawlessdirectory.com',
    adminRole: 'content_moderator',
    action: 'content_flagged',
    category: 'content_moderation',
    resourceType: 'review',
    resourceId: 'review-789',
    details: { flagReason: 'inappropriate_language', autoFlag: false },
    oldValues: { status: 'published' },
    newValues: { status: 'flagged' },
    ipAddress: '10.0.0.42',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
    severity: 'low',
    success: true,
    duration: 2341
  }
];

const getActionIcon = (action: string) => {
  if (action.includes('login') || action.includes('auth')) return Shield;
  if (action.includes('user')) return User;
  if (action.includes('business')) return Database;
  if (action.includes('content')) return Eye;
  if (action.includes('settings')) return Settings;
  if (action.includes('suspended') || action.includes('banned')) return Lock;
  if (action.includes('verified') || action.includes('approved')) return CheckCircle;
  if (action.includes('deleted') || action.includes('removed')) return Trash2;
  if (action.includes('updated') || action.includes('modified')) return Edit;
  return Activity;
};

const getCategoryColor = (category: AuditLogEntry['category']) => {
  switch (category) {
    case 'security': return 'text-red-400';
    case 'user_management': return 'text-blue-400';
    case 'business_management': return 'text-green-400';
    case 'content_moderation': return 'text-purple-400';
    case 'settings': return 'text-yellow-400';
    case 'system': return 'text-teal-400';
    default: return 'text-sage/60';
  }
};

const getSeverityColor = (severity: AuditLogEntry['severity']) => {
  switch (severity) {
    case 'critical': return 'text-red-500';
    case 'high': return 'text-red-400';
    case 'medium': return 'text-yellow-400';
    case 'low': return 'text-green-400';
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

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

const AuditLogCard: React.FC<{
  entry: AuditLogEntry;
  onViewDetails: (entry: AuditLogEntry) => void;
}> = ({ entry, onViewDetails }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const ActionIcon = getActionIcon(entry.action);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        'p-4 rounded-lg border transition-all duration-200 cursor-pointer',
        entry.success
          ? 'bg-teal-primary/5 border-teal-primary/20 hover:bg-teal-primary/10'
          : 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10',
        entry.severity === 'critical' || entry.severity === 'high'
          ? 'ring-1 ring-red-500/30'
          : ''
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              entry.success ? 'bg-teal-primary/10' : 'bg-red-500/10'
            )}>
              <ActionIcon className={cn(
                'w-4 h-4',
                entry.success ? 'text-teal-primary' : 'text-red-400'
              )} />
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-medium text-cream">{entry.action.replace(/_/g, ' ')}</h3>
                <span className={cn(
                  'px-2 py-1 rounded text-xs font-medium capitalize',
                  getCategoryColor(entry.category),
                  'bg-navy-dark/30'
                )}>
                  {entry.category.replace(/_/g, ' ')}
                </span>
                <span className={cn(
                  'px-2 py-1 rounded text-xs font-medium',
                  entry.success
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-red-500/10 text-red-400'
                )}>
                  {entry.success ? 'Success' : 'Failed'}
                </span>
              </div>
              
              <div className="flex items-center gap-4 mt-1 text-sm text-sage/60">
                <span>{entry.adminEmail}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {entry.location || 'Unknown'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTimeAgo(entry.timestamp)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-medium', getSeverityColor(entry.severity))}>
              {entry.severity.toUpperCase()}
            </span>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(entry);
              }}
              className="p-1 hover:bg-teal-primary/10 rounded transition-colors"
            >
              <Eye className="w-4 h-4 text-sage/70 hover:text-teal-primary" />
            </button>
            
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-sage/50" />
            ) : (
              <ChevronDown className="w-4 h-4 text-sage/50" />
            )}
          </div>
        </div>

        {/* Quick details */}
        <div className="flex items-center gap-4 text-sm text-sage/60">
          <span className="flex items-center gap-1">
            <Globe className="w-3 h-3" />
            {entry.ipAddress}
          </span>
          
          {entry.resourceType && (
            <>
              <span>•</span>
              <span>{entry.resourceType}</span>
              {entry.resourceId && (
                <span className="font-mono text-xs">#{entry.resourceId.slice(-6)}</span>
              )}
            </>
          )}
          
          {entry.duration && (
            <>
              <span>•</span>
              <span>{formatDuration(entry.duration)}</span>
            </>
          )}
        </div>

        {/* Expanded details */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3 border-t border-sage/10 space-y-4">
                {/* Error message */}
                {entry.errorMessage && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="flex gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-red-400 font-medium">Error</p>
                        <p className="text-sm text-red-400/70">{entry.errorMessage}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Details */}
                {Object.keys(entry.details).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-cream mb-2">Details</h4>
                    <div className="space-y-1 text-sm">
                      {Object.entries(entry.details).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-sage/60 capitalize">{key.replace(/_/g, ' ')}:</span>
                          <span className="text-cream font-mono">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Changes */}
                {entry.oldValues && entry.newValues && (
                  <div>
                    <h4 className="text-sm font-medium text-cream mb-2">Changes</h4>
                    <div className="space-y-1 text-sm">
                      {Object.keys({ ...entry.oldValues, ...entry.newValues }).map((key) => {
                        const oldValue = entry.oldValues?.[key];
                        const newValue = entry.newValues?.[key];
                        
                        if (oldValue === newValue) return null;
                        
                        return (
                          <div key={key} className="flex justify-between items-center">
                            <span className="text-sage/60 capitalize">{key.replace(/_/g, ' ')}:</span>
                            <div className="flex items-center gap-2 font-mono text-xs">
                              {oldValue && (
                                <span className="px-2 py-1 bg-red-500/10 text-red-400 rounded">
                                  {String(oldValue)}
                                </span>
                              )}
                              <span className="text-sage/50">→</span>
                              {newValue && (
                                <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded">
                                  {String(newValue)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Technical details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-sage/10 text-xs text-sage/50">
                  <div>
                    <p><span className="font-medium">User Agent:</span></p>
                    <p className="mt-1 font-mono break-all">{entry.userAgent}</p>
                  </div>
                  <div>
                    <p><span className="font-medium">Timestamp:</span> {entry.timestamp.toISOString()}</p>
                    <p><span className="font-medium">Entry ID:</span> {entry.id}</p>
                    {entry.resourceId && (
                      <p><span className="font-medium">Resource:</span> {entry.resourceId}</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

const FilterPanel: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  filters: {
    category: string;
    severity: string;
    success: string;
    admin: string;
    dateRange: string;
  };
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
}> = ({ isOpen, onClose, filters, onFilterChange, onClearFilters }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-navy-dark/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <GlassMorphism variant="medium" className="p-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-cream">Filter Audit Logs</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-sage/10 rounded-lg transition-colors"
                >
                  <XCircle className="w-5 h-5 text-sage/70" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-cream mb-2">
                    Category
                  </label>
                  <select
                    value={filters.category}
                    onChange={(e) => onFilterChange('category', e.target.value)}
                    className="w-full px-4 py-2 bg-navy-dark/30 border border-sage/20 rounded-lg text-cream focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  >
                    <option value="">All Categories</option>
                    <option value="security">Security</option>
                    <option value="user_management">User Management</option>
                    <option value="business_management">Business Management</option>
                    <option value="content_moderation">Content Moderation</option>
                    <option value="settings">Settings</option>
                    <option value="system">System</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-cream mb-2">
                    Severity
                  </label>
                  <select
                    value={filters.severity}
                    onChange={(e) => onFilterChange('severity', e.target.value)}
                    className="w-full px-4 py-2 bg-navy-dark/30 border border-sage/20 rounded-lg text-cream focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  >
                    <option value="">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-cream mb-2">
                    Status
                  </label>
                  <select
                    value={filters.success}
                    onChange={(e) => onFilterChange('success', e.target.value)}
                    className="w-full px-4 py-2 bg-navy-dark/30 border border-sage/20 rounded-lg text-cream focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  >
                    <option value="">All Statuses</option>
                    <option value="true">Success</option>
                    <option value="false">Failed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-cream mb-2">
                    Date Range
                  </label>
                  <select
                    value={filters.dateRange}
                    onChange={(e) => onFilterChange('dateRange', e.target.value)}
                    className="w-full px-4 py-2 bg-navy-dark/30 border border-sage/20 rounded-lg text-cream focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  >
                    <option value="">All Time</option>
                    <option value="1h">Last Hour</option>
                    <option value="24h">Last 24 Hours</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={onClearFilters}
                  className="flex-1 px-4 py-2 border border-sage/20 text-sage/70 rounded-lg hover:bg-sage/10 hover:text-cream transition-colors"
                >
                  Clear Filters
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-teal-primary to-teal-secondary text-cream rounded-lg hover:shadow-lg transition-all"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </GlassMorphism>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({
  className = '',
  realTime = false
}) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>(mockAuditLogs);
  const [filteredLogs, setFilteredLogs] = useState<AuditLogEntry[]>(mockAuditLogs);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(realTime);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [filters, setFilters] = useState({
    category: '',
    severity: '',
    success: '',
    admin: '',
    dateRange: ''
  });

  // Filter logs based on search and filters
  useEffect(() => {
    let filtered = logs;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.adminEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.resourceType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.ipAddress.includes(searchTerm)
      );
    }

    // Category filter
    if (filters.category) {
      filtered = filtered.filter(log => log.category === filters.category);
    }

    // Severity filter
    if (filters.severity) {
      filtered = filtered.filter(log => log.severity === filters.severity);
    }

    // Success filter
    if (filters.success) {
      filtered = filtered.filter(log => log.success === (filters.success === 'true'));
    }

    // Date range filter
    if (filters.dateRange) {
      const now = new Date();
      let cutoff: Date;
      
      switch (filters.dateRange) {
        case '1h':
          cutoff = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoff = new Date(0);
      }
      
      filtered = filtered.filter(log => log.timestamp >= cutoff);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    setFilteredLogs(filtered);
  }, [logs, searchTerm, filters]);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        // Simulate new logs arriving
        const newLog: AuditLogEntry = {
          id: `audit-${Date.now()}`,
          timestamp: new Date(),
          adminId: 'admin-1',
          adminEmail: 'admin@lawlessdirectory.com',
          adminRole: 'super_admin',
          action: 'page_viewed',
          category: 'system',
          resourceType: 'audit_log',
          details: { page: 'audit_logs' },
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          location: 'San Francisco, CA',
          severity: 'low',
          success: true,
          duration: Math.floor(Math.random() * 1000)
        };

        setLogs(prev => [newLog, ...prev.slice(0, 49)]); // Keep only last 50 logs
      }, 30000); // Every 30 seconds
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      category: '',
      severity: '',
      success: '',
      admin: '',
      dateRange: ''
    });
    setSearchTerm('');
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      // Simulate API call to refresh logs
      await new Promise(resolve => setTimeout(resolve, 1000));
      // In production, this would fetch fresh data
    } finally {
      setIsLoading(false);
    }
  };

  const exportLogs = () => {
    const csvContent = [
      ['Timestamp', 'Admin', 'Action', 'Category', 'Resource', 'Success', 'Severity', 'IP Address', 'Details'],
      ...filteredLogs.map(log => [
        log.timestamp.toISOString(),
        log.adminEmail,
        log.action,
        log.category,
        log.resourceType,
        log.success ? 'Success' : 'Failed',
        log.severity,
        log.ipAddress,
        JSON.stringify(log.details)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const stats = {
    total: filteredLogs.length,
    failed: filteredLogs.filter(log => !log.success).length,
    critical: filteredLogs.filter(log => log.severity === 'critical' || log.severity === 'high').length
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-cream">Audit Log Viewer</h1>
          <p className="text-sage/70 mt-1">
            Real-time monitoring of admin activities and system events
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sage/70">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 text-teal-primary bg-navy-dark/30 border-sage/30 rounded focus:ring-teal-primary focus:ring-2"
            />
            <span className="text-sm">Auto-refresh</span>
          </label>
          
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-teal-primary/10 border border-teal-primary/20 text-teal-primary rounded-lg hover:bg-teal-primary/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading ? 'animate-spin' : '')} />
            Refresh
          </button>
          
          <button
            onClick={exportLogs}
            className="flex items-center gap-2 px-4 py-2 bg-sage/10 border border-sage/20 text-sage/70 rounded-lg hover:bg-sage/20 hover:text-cream transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassMorphism variant="medium" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cream">{stats.total}</p>
              <p className="text-sm text-sage/60">Total Events</p>
            </div>
          </div>
        </GlassMorphism>

        <GlassMorphism variant="medium" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <XCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cream">{stats.failed}</p>
              <p className="text-sm text-sage/60">Failed Actions</p>
            </div>
          </div>
        </GlassMorphism>

        <GlassMorphism variant="medium" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cream">{stats.critical}</p>
              <p className="text-sm text-sage/60">High Risk Events</p>
            </div>
          </div>
        </GlassMorphism>
      </div>

      {/* Search and filters */}
      <GlassMorphism variant="medium" className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-sage/50" />
            </div>
            <input
              type="text"
              placeholder="Search logs by admin, action, or IP address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-navy-dark/30 border border-sage/20 rounded-lg text-cream placeholder-sage/50 focus:outline-none focus:ring-2 focus:ring-teal-primary focus:border-transparent"
            />
          </div>

          <button
            onClick={() => setShowFilters(true)}
            className="flex items-center gap-2 px-4 py-2 bg-navy-dark/30 border border-sage/20 text-sage/70 rounded-lg hover:bg-sage/10 hover:text-cream transition-colors"
          >
            <Filter className="w-4 h-4" />
            Advanced Filters
          </button>
        </div>
      </GlassMorphism>

      {/* Logs list */}
      <div className="space-y-3">
        <AnimatePresence>
          {filteredLogs.length > 0 ? (
            filteredLogs.map((log) => (
              <AuditLogCard
                key={log.id}
                entry={log}
                onViewDetails={setSelectedLog}
              />
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <Eye className="w-12 h-12 text-sage/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-sage/70">No audit logs found</h3>
              <p className="text-sage/50 mt-1">
                Try adjusting your search criteria or filters
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Live indicator */}
      {autoRefresh && (
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 text-green-400 rounded-full"
        >
          <Zap className="w-4 h-4" />
          <span className="text-sm font-medium">Live</span>
        </motion.div>
      )}

      <FilterPanel
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
      />
    </div>
  );
};

export default AuditLogViewer;