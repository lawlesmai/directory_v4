'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader2,
  Wifi,
  WifiOff,
  Clock,
  User,
  Eye,
  EyeOff,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { useAuth, useAuthState, useSession } from '@/contexts/AuthContext';
import { useRoleCheck } from './RequireRole';
import { cn } from '@/lib/utils';
import type { AuthState } from './types';

// Props for AuthStatus component
export interface AuthStatusProps {
  variant?: 'default' | 'compact' | 'minimal' | 'detailed';
  showSessionInfo?: boolean;
  showUserInfo?: boolean;
  showConnectionStatus?: boolean;
  className?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'inline';
  hideWhenAuthenticated?: boolean;
  refreshable?: boolean;
  onClick?: () => void;
}

// Connection status hook
const useConnectionStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [connectionType, setConnectionType] = useState<'unknown' | 'slow' | 'fast'>('unknown');

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    const updateConnectionType = () => {
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        if (connection) {
          const effectiveType = connection.effectiveType;
          setConnectionType(
            effectiveType === '4g' || effectiveType === '3g' ? 'fast' : 'slow'
          );
        }
      }
    };

    // Initial check
    updateOnlineStatus();
    updateConnectionType();

    // Event listeners
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    if ('connection' in navigator) {
      (navigator as any).connection?.addEventListener('change', updateConnectionType);
    }

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      if ('connection' in navigator) {
        (navigator as any).connection?.removeEventListener('change', updateConnectionType);
      }
    };
  }, []);

  return { isOnline, connectionType };
};

// Status indicator component
const StatusIndicator: React.FC<{
  status: AuthState;
  isOnline: boolean;
  className?: string;
}> = ({ status, isOnline, className }) => {
  const getStatusConfig = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        color: 'text-red-error',
        bgColor: 'bg-red-error/10',
        pulse: false,
        label: 'Offline'
      };
    }

    switch (status) {
      case 'loading':
        return {
          icon: Loader2,
          color: 'text-blue-400',
          bgColor: 'bg-blue-400/10',
          pulse: true,
          label: 'Loading'
        };
      case 'authenticated':
        return {
          icon: CheckCircle,
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
          pulse: false,
          label: 'Authenticated'
        };
      case 'unauthenticated':
        return {
          icon: AlertCircle,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
          pulse: false,
          label: 'Unauthenticated'
        };
      case 'error':
        return {
          icon: XCircle,
          color: 'text-red-error',
          bgColor: 'bg-red-error/10',
          pulse: false,
          label: 'Error'
        };
      default:
        return {
          icon: Shield,
          color: 'text-sage',
          bgColor: 'bg-sage/10',
          pulse: false,
          label: 'Unknown'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-2 rounded-lg',
      config.bgColor,
      className
    )}>
      <motion.div
        animate={config.pulse ? { rotate: 360 } : {}}
        transition={config.pulse ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
      >
        <Icon className={cn('w-4 h-4', config.color)} />
      </motion.div>
      <span className={cn('text-sm font-medium', config.color)}>
        {config.label}
      </span>
    </div>
  );
};

// Session timer component
const SessionTimer: React.FC<{
  className?: string;
}> = ({ className }) => {
  const { user } = useAuth();
  const [sessionTime, setSessionTime] = useState<string>('--:--');

  useEffect(() => {
    if (!user?.created_at) return;

    const updateSessionTime = () => {
      const now = new Date();
      const sessionStart = new Date(user.created_at);
      const diff = now.getTime() - sessionStart.getTime();
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      setSessionTime(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
    };

    updateSessionTime();
    const interval = setInterval(updateSessionTime, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [user]);

  return (
    <div className={cn('flex items-center gap-2 text-xs text-sage/70', className)}>
      <Clock className="w-3 h-3" />
      <span>Session: {sessionTime}</span>
    </div>
  );
};

// Detailed auth info component
const DetailedAuthInfo: React.FC<{
  className?: string;
}> = ({ className }) => {
  const { user, profile } = useAuth();
  const { getUserRole } = useRoleCheck();
  const { isActive } = useSession();
  const [isVisible, setIsVisible] = useState(false);

  if (!user) return null;

  return (
    <div className={cn('space-y-2 p-3 bg-navy-dark/50 rounded-lg', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-cream">Auth Details</span>
        <button
          onClick={() => setIsVisible(!isVisible)}
          className="p-1 hover:bg-sage/10 rounded transition-colors"
        >
          {isVisible ? (
            <EyeOff className="w-3 h-3 text-sage/50" />
          ) : (
            <Eye className="w-3 h-3 text-sage/50" />
          )}
        </button>
      </div>

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2 text-xs text-sage/70"
          >
            <div className="flex justify-between">
              <span>User ID:</span>
              <span className="font-mono text-teal-primary">
                {user.id?.slice(-8) || 'N/A'}...
              </span>
            </div>
            
            <div className="flex justify-between">
              <span>Role:</span>
              <span className="capitalize text-green-400">
                {getUserRole().replace('_', ' ')}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span>Email Verified:</span>
              <span className={cn(
                profile?.isEmailVerified ? 'text-green-500' : 'text-yellow-500'
              )}>
                {profile?.isEmailVerified ? 'Yes' : 'No'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span>Session:</span>
              <span className={cn(
                isActive ? 'text-green-500' : 'text-red-error'
              )}>
                {isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span>Last Sign In:</span>
              <span>
                {user.last_sign_in_at 
                  ? new Date(user.last_sign_in_at).toLocaleString()
                  : 'Never'
                }
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Main AuthStatus component
export const AuthStatus: React.FC<AuthStatusProps> = ({
  variant = 'default',
  showSessionInfo = false,
  showUserInfo = false,
  showConnectionStatus = true,
  className = '',
  position = 'inline',
  hideWhenAuthenticated = false,
  refreshable = false,
  onClick
}) => {
  const { state, isAuthenticated, user } = useAuthState();
  const { profile, refreshSession } = useAuth();
  const { isOnline, connectionType } = useConnectionStatus();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Hide when authenticated if requested
  if (hideWhenAuthenticated && isAuthenticated) {
    return null;
  }

  // Handle refresh
  const handleRefresh = async () => {
    if (!refreshable) return;
    
    setIsRefreshing(true);
    try {
      await refreshSession();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Position classes
  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'fixed top-4 left-4 z-50';
      case 'top-right':
        return 'fixed top-4 right-4 z-50';
      case 'bottom-left':
        return 'fixed bottom-4 left-4 z-50';
      case 'bottom-right':
        return 'fixed bottom-4 right-4 z-50';
      default:
        return '';
    }
  };

  // Render based on variant
  const renderContent = () => {
    switch (variant) {
      case 'minimal':
        return (
          <motion.div
            whileHover={{ scale: 1.05 }}
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-full',
              state === 'authenticated' ? 'bg-green-500/20' : 'bg-red-error/20'
            )}
          >
            <div className={cn(
              'w-3 h-3 rounded-full',
              state === 'authenticated' ? 'bg-green-500' : 'bg-red-error'
            )} />
          </motion.div>
        );

      case 'compact':
        return (
          <div className="flex items-center gap-2">
            <StatusIndicator status={state} isOnline={isOnline} />
            {refreshable && (
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-1 text-sage/50 hover:text-teal-primary transition-colors disabled:cursor-not-allowed"
              >
                <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
              </button>
            )}
          </div>
        );

      case 'detailed':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <StatusIndicator status={state} isOnline={isOnline} />
              {refreshable && (
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="p-2 text-sage/50 hover:text-teal-primary transition-colors disabled:cursor-not-allowed rounded-lg hover:bg-sage/5"
                >
                  <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
                </button>
              )}
            </div>

            {showConnectionStatus && (
              <div className="flex items-center gap-2 text-xs text-sage/70">
                {isOnline ? (
                  <Wifi className="w-3 h-3 text-green-500" />
                ) : (
                  <WifiOff className="w-3 h-3 text-red-error" />
                )}
                <span>
                  {isOnline ? `Online (${connectionType})` : 'Offline'}
                </span>
              </div>
            )}

            {showSessionInfo && isAuthenticated && (
              <SessionTimer />
            )}

            {showUserInfo && (
              <DetailedAuthInfo />
            )}
          </div>
        );

      default: // 'default'
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <StatusIndicator status={state} isOnline={isOnline} />
              {refreshable && (
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="p-1 text-sage/50 hover:text-teal-primary transition-colors disabled:cursor-not-allowed"
                >
                  <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
                </button>
              )}
            </div>

            {showSessionInfo && isAuthenticated && (
              <SessionTimer />
            )}

            {showConnectionStatus && !isOnline && (
              <div className="flex items-center gap-2 text-xs text-red-error">
                <AlertTriangle className="w-3 h-3" />
                <span>Connection lost</span>
              </div>
            )}
          </div>
        );
    }
  };

  const content = (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'bg-navy-dark/90 backdrop-blur-sm border border-sage/20 rounded-lg p-3',
        onClick && 'cursor-pointer hover:border-teal-primary/30 transition-colors',
        getPositionClasses(),
        className
      )}
      onClick={onClick}
    >
      {renderContent()}
    </motion.div>
  );

  return content;
};

// Floating auth status component
export const FloatingAuthStatus: React.FC<{
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
}> = ({ position = 'top-right', className }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={cn(
        'fixed z-50',
        position === 'top-left' && 'top-4 left-4',
        position === 'top-right' && 'top-4 right-4',
        position === 'bottom-left' && 'bottom-4 left-4',
        position === 'bottom-right' && 'bottom-4 right-4',
        className
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <AuthStatus
        variant={isExpanded ? 'detailed' : 'minimal'}
        showSessionInfo={isExpanded}
        showConnectionStatus={isExpanded}
        position="inline"
        refreshable={isExpanded}
        className="transition-all duration-300"
      />
    </motion.div>
  );
};

// Status badge component for inline use
export const AuthStatusBadge: React.FC<{
  className?: string;
  showLabel?: boolean;
}> = ({ className, showLabel = true }) => {
  const { state, isAuthenticated } = useAuthState();

  const getStatusColor = () => {
    switch (state) {
      case 'authenticated':
        return 'bg-green-500';
      case 'loading':
        return 'bg-blue-400 animate-pulse';
      case 'error':
        return 'bg-red-error';
      default:
        return 'bg-yellow-500';
    }
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('w-2 h-2 rounded-full', getStatusColor())} />
      {showLabel && (
        <span className="text-xs text-sage/70 capitalize">
          {state === 'authenticated' ? 'Authenticated' : state}
        </span>
      )}
    </div>
  );
};

export default AuthStatus;