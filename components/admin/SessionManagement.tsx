'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor,
  Smartphone,
  Tablet,
  Chrome,
  Shield,
  MapPin,
  Clock,
  AlertTriangle,
  X,
  Eye,
  Ban,
  RefreshCw,
  Filter,
  Search,
  Download,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '@/components/GlassMorphism';

interface AdminSession {
  id: string;
  adminId: string;
  adminEmail: string;
  adminRole: 'super_admin' | 'platform_admin' | 'support_admin' | 'content_moderator';
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  browserVersion: string;
  os: string;
  ipAddress: string;
  location: string;
  country: string;
  city: string;
  loginTime: Date;
  lastActivity: Date;
  isActive: boolean;
  isTrusted: boolean;
  sessionDuration: number; // in minutes
  actionsCount: number;
  riskScore: 'low' | 'medium' | 'high' | 'critical';
  userAgent: string;
}

interface SessionManagementProps {
  className?: string;
}

// Mock session data
const mockSessions: AdminSession[] = [
  {
    id: 'session-1',
    adminId: 'admin-1',
    adminEmail: 'admin@lawlessdirectory.com',
    adminRole: 'super_admin',
    deviceType: 'desktop',
    browser: 'Chrome',
    browserVersion: '118.0.0.0',
    os: 'macOS',
    ipAddress: '192.168.1.100',
    location: 'San Francisco, CA',
    country: 'United States',
    city: 'San Francisco',
    loginTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    lastActivity: new Date(Date.now() - 5 * 60 * 1000),
    isActive: true,
    isTrusted: true,
    sessionDuration: 120,
    actionsCount: 45,
    riskScore: 'low',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  },
  {
    id: 'session-2',
    adminId: 'admin-2',
    adminEmail: 'support@lawlessdirectory.com',
    adminRole: 'support_admin',
    deviceType: 'mobile',
    browser: 'Safari',
    browserVersion: '17.1',
    os: 'iOS',
    ipAddress: '203.0.113.45',
    location: 'New York, NY',
    country: 'United States',
    city: 'New York',
    loginTime: new Date(Date.now() - 45 * 60 * 1000),
    lastActivity: new Date(Date.now() - 2 * 60 * 1000),
    isActive: true,
    isTrusted: false,
    sessionDuration: 45,
    actionsCount: 12,
    riskScore: 'medium',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15'
  },
  {
    id: 'session-3',
    adminId: 'admin-3',
    adminEmail: 'moderator@lawlessdirectory.com',
    adminRole: 'content_moderator',
    deviceType: 'desktop',
    browser: 'Firefox',
    browserVersion: '119.0',
    os: 'Windows',
    ipAddress: '198.51.100.23',
    location: 'Unknown',
    country: 'Unknown',
    city: 'Unknown',
    loginTime: new Date(Date.now() - 8 * 60 * 60 * 1000),
    lastActivity: new Date(Date.now() - 6 * 60 * 60 * 1000),
    isActive: false,
    isTrusted: false,
    sessionDuration: 480,
    actionsCount: 8,
    riskScore: 'high',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:119.0) Gecko/20100101 Firefox/119.0'
  }
];

const getDeviceIcon = (deviceType: AdminSession['deviceType']) => {
  switch (deviceType) {
    case 'desktop': return Monitor;
    case 'mobile': return Smartphone;
    case 'tablet': return Tablet;
    default: return Monitor;
  }
};

const getRiskScoreColor = (riskScore: AdminSession['riskScore']) => {
  switch (riskScore) {
    case 'low': return 'text-green-400';
    case 'medium': return 'text-yellow-400';
    case 'high': return 'text-orange-400';
    case 'critical': return 'text-red-400';
    default: return 'text-sage/60';
  }
};

const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
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

const SessionCard: React.FC<{
  session: AdminSession;
  onTerminate: (sessionId: string) => void;
  onViewDetails: (session: AdminSession) => void;
}> = ({ session, onTerminate, onViewDetails }) => {
  const DeviceIcon = getDeviceIcon(session.deviceType);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'p-4 rounded-lg border transition-all duration-200',
        session.isActive
          ? 'bg-teal-primary/10 border-teal-primary/20'
          : 'bg-navy-dark/30 border-sage/20',
        session.riskScore === 'high' || session.riskScore === 'critical'
          ? 'ring-1 ring-red-500/30'
          : ''
      )}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              session.isActive ? 'bg-teal-primary/20' : 'bg-sage/10'
            )}>
              <DeviceIcon className={cn(
                'w-5 h-5',
                session.isActive ? 'text-teal-primary' : 'text-sage/50'
              )} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-cream">{session.adminEmail}</h3>
                <span className={cn(
                  'px-2 py-1 rounded text-xs font-medium',
                  session.isActive
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-sage/10 text-sage/60'
                )}>
                  {session.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-sm text-sage/60 capitalize">
                {session.adminRole.replace('_', ' ')}
              </p>
              <div className="flex items-center gap-4 mt-1 text-xs text-sage/50">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {session.location}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTimeAgo(session.lastActivity)}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {session.riskScore !== 'low' && (
              <div className={cn(
                'px-2 py-1 rounded text-xs font-medium',
                'bg-red-500/10 text-red-400'
              )}>
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                {session.riskScore.toUpperCase()}
              </div>
            )}
            
            {session.isTrusted && (
              <Shield className="w-4 h-4 text-teal-primary" />
            )}
          </div>
        </div>

        {/* Session details */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-sage/50">Browser</p>
            <p className="text-cream">{session.browser} {session.browserVersion}</p>
          </div>
          <div>
            <p className="text-sage/50">OS</p>
            <p className="text-cream">{session.os}</p>
          </div>
          <div>
            <p className="text-sage/50">IP Address</p>
            <p className="text-cream font-mono">{session.ipAddress}</p>
          </div>
          <div>
            <p className="text-sage/50">Duration</p>
            <p className="text-cream">{formatDuration(session.sessionDuration)}</p>
          </div>
        </div>

        {/* Risk assessment */}
        <div className="flex items-center justify-between pt-2 border-t border-sage/10">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-sage/50">
              Risk Score: <span className={getRiskScoreColor(session.riskScore)}>
                {session.riskScore.toUpperCase()}
              </span>
            </span>
            <span className="text-sage/50">
              Actions: <span className="text-cream">{session.actionsCount}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onViewDetails(session)}
              className="p-2 hover:bg-teal-primary/10 rounded-lg transition-colors"
              title="View Details"
            >
              <Eye className="w-4 h-4 text-sage/70 hover:text-teal-primary" />
            </button>
            
            {session.isActive && (
              <button
                onClick={() => onTerminate(session.id)}
                className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Terminate Session"
              >
                <Ban className="w-4 h-4 text-sage/70 hover:text-red-400" />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const SessionDetailsModal: React.FC<{
  session: AdminSession;
  isOpen: boolean;
  onClose: () => void;
}> = ({ session, isOpen, onClose }) => {
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
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-cream">Session Details</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-sage/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-sage/70" />
                </button>
              </div>

              {/* Session info grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-cream mb-3">User Information</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-sage/60">Email:</span>
                        <span className="text-cream">{session.adminEmail}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sage/60">Role:</span>
                        <span className="text-cream capitalize">{session.adminRole.replace('_', ' ')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sage/60">User ID:</span>
                        <span className="text-cream font-mono">{session.adminId}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-cream mb-3">Device Information</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-sage/60">Device:</span>
                        <span className="text-cream capitalize">{session.deviceType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sage/60">Browser:</span>
                        <span className="text-cream">{session.browser} {session.browserVersion}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sage/60">OS:</span>
                        <span className="text-cream">{session.os}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-cream mb-3">Location & Network</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-sage/60">IP Address:</span>
                        <span className="text-cream font-mono">{session.ipAddress}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sage/60">Location:</span>
                        <span className="text-cream">{session.location}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sage/60">Country:</span>
                        <span className="text-cream">{session.country}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sage/60">City:</span>
                        <span className="text-cream">{session.city}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-cream mb-3">Session Activity</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-sage/60">Login Time:</span>
                        <span className="text-cream">{session.loginTime.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sage/60">Last Activity:</span>
                        <span className="text-cream">{session.lastActivity.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sage/60">Duration:</span>
                        <span className="text-cream">{formatDuration(session.sessionDuration)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sage/60">Actions Count:</span>
                        <span className="text-cream">{session.actionsCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* User Agent */}
              <div>
                <h3 className="text-lg font-semibold text-cream mb-3">User Agent</h3>
                <p className="text-sm text-sage/60 font-mono bg-navy-dark/30 p-3 rounded-lg break-all">
                  {session.userAgent}
                </p>
              </div>

              {/* Security Status */}
              <div className="flex items-center justify-between p-4 bg-navy-dark/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-2 rounded-lg',
                    session.riskScore === 'low' ? 'bg-green-500/10' : 'bg-red-500/10'
                  )}>
                    {session.riskScore === 'low' ? (
                      <Shield className="w-5 h-5 text-green-400" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-cream font-medium">Security Status</p>
                    <p className={cn('text-sm', getRiskScoreColor(session.riskScore))}>
                      Risk Level: {session.riskScore.toUpperCase()}
                    </p>
                  </div>
                </div>
                
                {session.isTrusted ? (
                  <div className="flex items-center gap-2 text-teal-primary">
                    <Shield className="w-4 h-4" />
                    <span className="text-sm">Trusted Device</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm">Untrusted Device</span>
                  </div>
                )}
              </div>
            </div>
          </GlassMorphism>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export const SessionManagement: React.FC<SessionManagementProps> = ({
  className = ''
}) => {
  const [sessions, setSessions] = useState<AdminSession[]>(mockSessions);
  const [filteredSessions, setFilteredSessions] = useState<AdminSession[]>(mockSessions);
  const [selectedSession, setSelectedSession] = useState<AdminSession | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterRisk, setFilterRisk] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
  const [isLoading, setIsLoading] = useState(false);

  // Filter sessions based on search and filters
  useEffect(() => {
    let filtered = sessions;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(session =>
        session.adminEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.ipAddress.includes(searchTerm) ||
        session.location.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(session =>
        filterStatus === 'active' ? session.isActive : !session.isActive
      );
    }

    // Risk filter
    if (filterRisk !== 'all') {
      filtered = filtered.filter(session => session.riskScore === filterRisk);
    }

    setFilteredSessions(filtered);
  }, [sessions, searchTerm, filterStatus, filterRisk]);

  const handleTerminateSession = async (sessionId: string) => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSessions(prev => 
        prev.map(session => 
          session.id === sessionId 
            ? { ...session, isActive: false }
            : session
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDetails = (session: AdminSession) => {
    setSelectedSession(session);
    setShowDetailsModal(true);
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      // Simulate API call to refresh data
      await new Promise(resolve => setTimeout(resolve, 1000));
      // In production, this would fetch fresh data
    } finally {
      setIsLoading(false);
    }
  };

  const exportSessions = () => {
    const csvContent = [
      ['Admin Email', 'Role', 'Device', 'IP Address', 'Location', 'Status', 'Risk Score', 'Login Time', 'Last Activity'],
      ...filteredSessions.map(session => [
        session.adminEmail,
        session.adminRole,
        session.deviceType,
        session.ipAddress,
        session.location,
        session.isActive ? 'Active' : 'Inactive',
        session.riskScore,
        session.loginTime.toISOString(),
        session.lastActivity.toISOString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-sessions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const activeSessions = filteredSessions.filter(s => s.isActive).length;
  const highRiskSessions = filteredSessions.filter(s => s.riskScore === 'high' || s.riskScore === 'critical').length;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-cream">Session Management</h1>
          <p className="text-sage/70 mt-1">
            Monitor and manage active admin sessions
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-teal-primary/10 border border-teal-primary/20 text-teal-primary rounded-lg hover:bg-teal-primary/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading ? 'animate-spin' : '')} />
            Refresh
          </button>
          
          <button
            onClick={exportSessions}
            className="flex items-center gap-2 px-4 py-2 bg-sage/10 border border-sage/20 text-sage/70 rounded-lg hover:bg-sage/20 hover:text-cream transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassMorphism variant="medium" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-primary/10 rounded-lg">
              <Zap className="w-5 h-5 text-teal-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cream">{activeSessions}</p>
              <p className="text-sm text-sage/60">Active Sessions</p>
            </div>
          </div>
        </GlassMorphism>

        <GlassMorphism variant="medium" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Monitor className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cream">{filteredSessions.length}</p>
              <p className="text-sm text-sage/60">Total Sessions</p>
            </div>
          </div>
        </GlassMorphism>

        <GlassMorphism variant="medium" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cream">{highRiskSessions}</p>
              <p className="text-sm text-sage/60">High Risk</p>
            </div>
          </div>
        </GlassMorphism>

        <GlassMorphism variant="medium" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-primary/10 rounded-lg">
              <Shield className="w-5 h-5 text-teal-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cream">
                {filteredSessions.filter(s => s.isTrusted).length}
              </p>
              <p className="text-sm text-sage/60">Trusted Devices</p>
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
              placeholder="Search by email, IP, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-navy-dark/30 border border-sage/20 rounded-lg text-cream placeholder-sage/50 focus:outline-none focus:ring-2 focus:ring-teal-primary focus:border-transparent"
            />
          </div>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-4 py-2 bg-navy-dark/30 border border-sage/20 rounded-lg text-cream focus:outline-none focus:ring-2 focus:ring-teal-primary"
          >
            <option value="all">All Sessions</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          {/* Risk filter */}
          <select
            value={filterRisk}
            onChange={(e) => setFilterRisk(e.target.value as any)}
            className="px-4 py-2 bg-navy-dark/30 border border-sage/20 rounded-lg text-cream focus:outline-none focus:ring-2 focus:ring-teal-primary"
          >
            <option value="all">All Risk Levels</option>
            <option value="low">Low Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="high">High Risk</option>
            <option value="critical">Critical Risk</option>
          </select>
        </div>
      </GlassMorphism>

      {/* Sessions list */}
      <div className="space-y-4">
        <AnimatePresence>
          {filteredSessions.length > 0 ? (
            filteredSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onTerminate={handleTerminateSession}
                onViewDetails={handleViewDetails}
              />
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <Monitor className="w-12 h-12 text-sage/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-sage/70">No sessions found</h3>
              <p className="text-sage/50 mt-1">
                Try adjusting your search criteria or filters
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Session details modal */}
      {selectedSession && (
        <SessionDetailsModal
          session={selectedSession}
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedSession(null);
          }}
        />
      )}
    </div>
  );
};

export default SessionManagement;