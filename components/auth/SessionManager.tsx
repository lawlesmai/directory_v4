'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Shield,
  Monitor,
  Smartphone,
  Globe,
  RefreshCw,
  LogOut,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Settings,
  Trash2,
  MapPin,
  Calendar,
  Activity,
  WifiOff,
  Wifi,
  Lock,
  Unlock
} from 'lucide-react';
import { useAuth, useSession } from '@/contexts/AuthContext';
import { GlassMorphism } from '@/components/GlassMorphism';
import { cn } from '@/lib/utils';

// Mock session data - in real app this would come from server
interface SessionData {
  id: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  location: {
    city: string;
    country: string;
    ip: string;
  };
  lastActivity: Date;
  createdAt: Date;
  isCurrent: boolean;
  isActive: boolean;
}

// Props for SessionManager
export interface SessionManagerProps {
  variant?: 'default' | 'compact' | 'detailed';
  showDevices?: boolean;
  showSecurity?: boolean;
  showActivity?: boolean;
  allowTermination?: boolean;
  className?: string;
  onSessionTerminated?: (sessionId: string) => void;
  onAllSessionsTerminated?: () => void;
}

// Mock sessions data
const generateMockSessions = (): SessionData[] => [
  {
    id: 'current',
    deviceType: 'desktop',
    browser: 'Chrome 120',
    os: 'macOS 14.2',
    location: {
      city: 'San Francisco',
      country: 'United States',
      ip: '192.168.1.100'
    },
    lastActivity: new Date(),
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    isCurrent: true,
    isActive: true
  },
  {
    id: 'mobile-session',
    deviceType: 'mobile',
    browser: 'Safari',
    os: 'iOS 17.1',
    location: {
      city: 'San Francisco',
      country: 'United States',
      ip: '192.168.1.101'
    },
    lastActivity: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    isCurrent: false,
    isActive: true
  },
  {
    id: 'old-session',
    deviceType: 'desktop',
    browser: 'Firefox 119',
    os: 'Windows 11',
    location: {
      city: 'New York',
      country: 'United States',
      ip: '10.0.0.50'
    },
    lastActivity: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 2 weeks ago
    isCurrent: false,
    isActive: false
  }
];

// Session activity timeline
const SessionTimeline: React.FC<{
  className?: string;
}> = ({ className }) => {
  const activities = [
    { time: new Date(), action: 'Profile updated', type: 'info' },
    { time: new Date(Date.now() - 15 * 60 * 1000), action: 'Password changed', type: 'security' },
    { time: new Date(Date.now() - 2 * 60 * 60 * 1000), action: 'Signed in', type: 'auth' },
    { time: new Date(Date.now() - 24 * 60 * 60 * 1000), action: 'Failed login attempt', type: 'warning' }
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'security':
        return <Shield className="w-3 h-3" />;
      case 'auth':
        return <CheckCircle className="w-3 h-3" />;
      case 'warning':
        return <AlertTriangle className="w-3 h-3" />;
      default:
        return <Activity className="w-3 h-3" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'security':
        return 'text-blue-400';
      case 'auth':
        return 'text-green-500';
      case 'warning':
        return 'text-yellow-500';
      default:
        return 'text-sage';
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      <h4 className="text-sm font-medium text-cream mb-3">Recent Activity</h4>
      <div className="space-y-3">
        {activities.map((activity, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-start gap-3"
          >
            <div className={cn(
              'flex items-center justify-center w-6 h-6 rounded-full bg-navy-dark/50 flex-shrink-0 mt-0.5',
              getActivityColor(activity.type)
            )}>
              {getActivityIcon(activity.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-cream">{activity.action}</p>
              <p className="text-xs text-sage/50">
                {activity.time.toLocaleString()}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// Session card component
const SessionCard: React.FC<{
  session: SessionData;
  onTerminate?: (sessionId: string) => void;
  showDetails?: boolean;
  className?: string;
}> = ({ session, onTerminate, showDetails = true, className }) => {
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);

  const handleTerminate = async () => {
    if (!onTerminate || session.isCurrent) return;
    
    setIsTerminating(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      onTerminate(session.id);
    } catch (error) {
      console.error('Failed to terminate session:', error);
    } finally {
      setIsTerminating(false);
    }
  };

  const getDeviceIcon = (deviceType: SessionData['deviceType']) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="w-4 h-4" />;
      case 'tablet':
        return <Monitor className="w-4 h-4" />;
      default:
        return <Monitor className="w-4 h-4" />;
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'p-4 rounded-lg border transition-all duration-200',
        session.isCurrent
          ? 'bg-teal-primary/5 border-teal-primary/30'
          : session.isActive
          ? 'bg-navy-dark/30 border-sage/20'
          : 'bg-navy-dark/20 border-sage/10',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          {/* Device icon */}
          <div className={cn(
            'flex items-center justify-center w-10 h-10 rounded-lg',
            session.isActive ? 'bg-teal-primary/10' : 'bg-sage/10'
          )}>
            {getDeviceIcon(session.deviceType)}
          </div>

          {/* Session info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-medium text-cream">
                {session.browser} on {session.os}
              </p>
              {session.isCurrent && (
                <span className="px-2 py-0.5 text-xs bg-teal-primary/20 text-teal-primary rounded-full">
                  Current
                </span>
              )}
              {session.isActive && !session.isCurrent && (
                <div className="w-2 h-2 bg-green-500 rounded-full" />
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-sage/70">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {session.location.city}, {session.location.country}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTimeAgo(session.lastActivity)}
              </span>
            </div>

            {/* Expandable details */}
            <AnimatePresence>
              {showDetails && showFullDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 pt-3 border-t border-sage/10 space-y-2 text-xs text-sage/70"
                >
                  <div className="flex justify-between">
                    <span>IP Address:</span>
                    <span className="font-mono">{session.location.ip}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span>{session.createdAt.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Session ID:</span>
                    <span className="font-mono">{session.id.slice(-8)}...</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4">
          {showDetails && (
            <button
              onClick={() => setShowFullDetails(!showFullDetails)}
              className="p-1 text-sage/50 hover:text-cream transition-colors rounded"
            >
              {showFullDetails ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          )}

          {!session.isCurrent && onTerminate && (
            <button
              onClick={handleTerminate}
              disabled={isTerminating}
              className={cn(
                'p-2 text-red-error hover:bg-red-error/10 transition-colors rounded-lg',
                isTerminating && 'cursor-not-allowed opacity-50'
              )}
              title="Terminate session"
            >
              {isTerminating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// Security overview component
const SecurityOverview: React.FC<{
  className?: string;
}> = ({ className }) => {
  const { profile } = useAuth();
  const { isActive } = useSession();

  const securityItems = [
    {
      label: 'Two-Factor Authentication',
      status: false, // This would come from user profile
      icon: Shield,
      action: 'Enable'
    },
    {
      label: 'Email Verification',
      status: profile?.isEmailVerified || false,
      icon: CheckCircle,
      action: profile?.isEmailVerified ? 'Verified' : 'Verify'
    },
    {
      label: 'Active Session',
      status: isActive,
      icon: isActive ? Unlock : Lock,
      action: isActive ? 'Active' : 'Inactive'
    },
    {
      label: 'Password Strength',
      status: true, // This would be calculated
      icon: Shield,
      action: 'Strong'
    }
  ];

  return (
    <div className={cn('space-y-3', className)}>
      <h4 className="text-sm font-medium text-cream mb-3">Security Status</h4>
      <div className="space-y-2">
        {securityItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="flex items-center justify-between p-3 bg-navy-dark/30 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Icon className={cn(
                  'w-4 h-4',
                  item.status ? 'text-green-500' : 'text-yellow-500'
                )} />
                <span className="text-sm text-cream">{item.label}</span>
              </div>
              <span className={cn(
                'text-xs px-2 py-1 rounded-full',
                item.status
                  ? 'bg-green-500/10 text-green-500'
                  : 'bg-yellow-500/10 text-yellow-500'
              )}>
                {item.action}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Main SessionManager component
export const SessionManager: React.FC<SessionManagerProps> = ({
  variant = 'default',
  showDevices = true,
  showSecurity = true,
  showActivity = true,
  allowTermination = true,
  className = '',
  onSessionTerminated,
  onAllSessionsTerminated
}) => {
  const { signOut, refreshSession } = useAuth();
  const [sessions, setSessions] = useState<SessionData[]>(generateMockSessions());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTerminatingAll, setIsTerminatingAll] = useState(false);

  // Handle session termination
  const handleSessionTerminate = (sessionId: string) => {
    setSessions(prev => prev.filter(session => session.id !== sessionId));
    onSessionTerminated?.(sessionId);
  };

  // Handle terminate all sessions
  const handleTerminateAll = async () => {
    setIsTerminatingAll(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call
      setSessions(prev => prev.filter(session => session.isCurrent));
      onAllSessionsTerminated?.();
    } catch (error) {
      console.error('Failed to terminate sessions:', error);
    } finally {
      setIsTerminatingAll(false);
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshSession();
      // In a real app, you'd also refresh session data from server
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const activeSessions = sessions.filter(s => s.isActive);
  const inactiveSessions = sessions.filter(s => !s.isActive);

  // Compact variant
  if (variant === 'compact') {
    return (
      <GlassMorphism variant="medium" className={cn('p-4', className)}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-cream">Sessions</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-sage/70">
                {activeSessions.length} active
              </span>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-1 text-sage/50 hover:text-teal-primary transition-colors"
              >
                <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {sessions.slice(0, 3).map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onTerminate={allowTermination ? handleSessionTerminate : undefined}
                showDetails={false}
              />
            ))}
          </div>
        </div>
      </GlassMorphism>
    );
  }

  // Default and detailed variants
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-cream">Session Management</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg border border-sage/20 text-sage/70 hover:text-cream hover:border-sage/40 transition-colors',
              isRefreshing && 'cursor-not-allowed opacity-50'
            )}
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 bg-red-error/10 text-red-error hover:bg-red-error/20 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sessions list */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active sessions */}
          {showDevices && (
            <GlassMorphism variant="medium" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-cream">
                  Active Sessions ({activeSessions.length})
                </h3>
                {allowTermination && activeSessions.length > 1 && (
                  <button
                    onClick={handleTerminateAll}
                    disabled={isTerminatingAll}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 text-sm bg-red-error/10 text-red-error hover:bg-red-error/20 rounded-lg transition-colors',
                      isTerminatingAll && 'cursor-not-allowed opacity-50'
                    )}
                  >
                    {isTerminatingAll ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    {isTerminatingAll ? 'Terminating...' : 'End All Others'}
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {activeSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onTerminate={allowTermination ? handleSessionTerminate : undefined}
                  />
                ))}
              </div>
            </GlassMorphism>
          )}

          {/* Inactive sessions */}
          {inactiveSessions.length > 0 && (
            <GlassMorphism variant="medium" className="p-6">
              <h3 className="text-lg font-semibold text-cream mb-4">
                Recent Sessions ({inactiveSessions.length})
              </h3>
              <div className="space-y-3">
                {inactiveSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onTerminate={allowTermination ? handleSessionTerminate : undefined}
                  />
                ))}
              </div>
            </GlassMorphism>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Security overview */}
          {showSecurity && (
            <GlassMorphism variant="medium" className="p-6">
              <SecurityOverview />
            </GlassMorphism>
          )}

          {/* Activity timeline */}
          {showActivity && variant === 'detailed' && (
            <GlassMorphism variant="medium" className="p-6">
              <SessionTimeline />
            </GlassMorphism>
          )}
        </div>
      </div>
    </div>
  );
};

// Quick session status component
export const SessionStatus: React.FC<{
  className?: string;
  onClick?: () => void;
}> = ({ className, onClick }) => {
  const { isActive } = useSession();
  const [sessions] = useState<SessionData[]>(generateMockSessions());
  const activeSessions = sessions.filter(s => s.isActive);

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border border-sage/20 hover:border-sage/40 transition-all',
        'bg-navy-dark/30 hover:bg-navy-dark/50',
        className
      )}
    >
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center',
        isActive ? 'bg-green-500/20' : 'bg-red-error/20'
      )}>
        {isActive ? (
          <CheckCircle className="w-4 h-4 text-green-500" />
        ) : (
          <XCircle className="w-4 h-4 text-red-error" />
        )}
      </div>
      
      <div className="text-left flex-1">
        <p className="text-sm font-medium text-cream">
          {activeSessions.length} Active Session{activeSessions.length !== 1 ? 's' : ''}
        </p>
        <p className="text-xs text-sage/70">
          {isActive ? 'Session is secure' : 'Session expired'}
        </p>
      </div>

      <Settings className="w-4 h-4 text-sage/50" />
    </motion.button>
  );
};

export default SessionManager;