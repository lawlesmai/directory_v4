'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Settings,
  LogOut,
  Shield,
  Clock,
  Monitor,
  Smartphone,
  ChevronDown,
  Edit,
  Crown,
  AlertTriangle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { useAuth, useSession } from '@/contexts/AuthContext';
import { useRoleCheck } from './RequireRole';
import { GlassMorphism } from '@/components/GlassMorphism';
import { cn } from '@/lib/utils';
import type { UserProfile } from './types';

// Props for UserProfileButton
export interface UserProfileButtonProps {
  variant?: 'default' | 'compact' | 'minimal';
  showDropdown?: boolean;
  showSessionInfo?: boolean;
  className?: string;
  dropdownClassName?: string;
  onMenuToggle?: (isOpen: boolean) => void;
}

// Session info component
const SessionInfo: React.FC<{
  profile: UserProfile | null;
  className?: string;
}> = ({ profile, className }) => {
  const { isActive, refresh } = useSession();
  const [lastActivity, setLastActivity] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Update last activity timestamp
  useEffect(() => {
    const interval = setInterval(() => {
      setLastActivity(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const handleRefreshSession = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } catch (error) {
      console.error('Session refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className={cn('px-4 py-3 border-t border-sage/10 bg-navy-dark/30', className)}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-sage/50">Session Status</span>
          <div className={cn(
            'flex items-center gap-1 text-xs',
            isActive ? 'text-green-500' : 'text-red-error'
          )}>
            <div className={cn(
              'w-2 h-2 rounded-full',
              isActive ? 'bg-green-500' : 'bg-red-error'
            )} />
            {isActive ? 'Active' : 'Inactive'}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-sage/50">Last Activity</span>
          <span className="text-xs text-sage/70">
            {lastActivity.toLocaleTimeString()}
          </span>
        </div>

        {profile?.isEmailVerified !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-sage/50">Email Verified</span>
            <div className={cn(
              'flex items-center gap-1 text-xs',
              profile.isEmailVerified ? 'text-green-500' : 'text-yellow-500'
            )}>
              {profile.isEmailVerified ? (
                <CheckCircle className="w-3 h-3" />
              ) : (
                <AlertTriangle className="w-3 h-3" />
              )}
              {profile.isEmailVerified ? 'Verified' : 'Pending'}
            </div>
          </div>
        )}

        <button
          onClick={handleRefreshSession}
          disabled={isRefreshing}
          className={cn(
            'flex items-center gap-2 text-xs text-sage/70 hover:text-teal-primary transition-colors mt-2',
            isRefreshing && 'cursor-not-allowed opacity-50'
          )}
        >
          <RefreshCw className={cn('w-3 h-3', isRefreshing && 'animate-spin')} />
          {isRefreshing ? 'Refreshing...' : 'Refresh Session'}
        </button>
      </div>
    </div>
  );
};

// User role badge component
const UserRoleBadge: React.FC<{
  profile: UserProfile | null;
  className?: string;
}> = ({ profile, className }) => {
  const { getUserRole } = useRoleCheck();
  const role = getUserRole();

  const getRoleConfig = (role: string) => {
    switch (role) {
      case 'super_admin':
        return {
          label: 'Super Admin',
          icon: Crown,
          color: 'text-purple-400',
          bgColor: 'bg-purple-400/10',
          borderColor: 'border-purple-400/20'
        };
      case 'admin':
        return {
          label: 'Admin',
          icon: Shield,
          color: 'text-blue-400',
          bgColor: 'bg-blue-400/10',
          borderColor: 'border-blue-400/20'
        };
      case 'business_owner':
        return {
          label: 'Business Owner',
          icon: User,
          color: 'text-green-400',
          bgColor: 'bg-green-400/10',
          borderColor: 'border-green-400/20'
        };
      case 'service_provider':
        return {
          label: 'Service Provider',
          icon: Settings,
          color: 'text-orange-400',
          bgColor: 'bg-orange-400/10',
          borderColor: 'border-orange-400/20'
        };
      default:
        return {
          label: 'Customer',
          icon: User,
          color: 'text-sage',
          bgColor: 'bg-sage/10',
          borderColor: 'border-sage/20'
        };
    }
  };

  const config = getRoleConfig(role);
  const Icon = config.icon;

  return (
    <div className={cn(
      'flex items-center gap-2 px-2 py-1 rounded-md border text-xs',
      config.color,
      config.bgColor,
      config.borderColor,
      className
    )}>
      <Icon className="w-3 h-3" />
      {config.label}
    </div>
  );
};

// Dropdown menu items
const dropdownMenuItems = [
  {
    label: 'View Profile',
    href: '/profile',
    icon: User,
    description: 'Manage your personal information'
  },
  {
    label: 'Edit Profile',
    href: '/profile/edit',
    icon: Edit,
    description: 'Update your profile details'
  },
  {
    label: 'Account Settings',
    href: '/settings',
    icon: Settings,
    description: 'Privacy, notifications, and preferences'
  },
  {
    label: 'Security',
    href: '/settings/security',
    icon: Shield,
    description: 'Password and security settings'
  }
];

// Main UserProfileButton component
export const UserProfileButton: React.FC<UserProfileButtonProps> = ({
  variant = 'default',
  showDropdown = true,
  showSessionInfo = true,
  className = '',
  dropdownClassName = '',
  onMenuToggle
}) => {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current &&
        dropdownRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle menu toggle
  const handleToggle = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    onMenuToggle?.(newIsOpen);
  };

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOut();
      setIsOpen(false);
      router.push('/');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  // Don't render if no user
  if (!user || !profile) return null;

  // Render based on variant
  const renderButton = () => {
    const baseClasses = 'flex items-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-primary/50';
    
    switch (variant) {
      case 'compact':
        return (
          <motion.button
            ref={buttonRef}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleToggle}
            className={cn(
              baseClasses,
              'gap-2 px-3 py-2 rounded-lg hover:bg-navy-dark/50',
              isOpen && 'bg-navy-dark/70',
              className
            )}
          >
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt={profile.fullName}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-teal-primary/20 flex items-center justify-center">
                <User className="w-4 h-4 text-teal-primary" />
              </div>
            )}
            {showDropdown && <ChevronDown className={cn(
              'w-4 h-4 text-sage/50 transition-transform',
              isOpen && 'rotate-180'
            )} />}
          </motion.button>
        );

      case 'minimal':
        return (
          <motion.button
            ref={buttonRef}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleToggle}
            className={cn(
              baseClasses,
              'p-1 rounded-full hover:bg-navy-dark/30',
              className
            )}
          >
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt={profile.fullName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-teal-primary/20 flex items-center justify-center">
                <User className="w-5 h-5 text-teal-primary" />
              </div>
            )}
          </motion.button>
        );

      default: // 'default'
        return (
          <motion.button
            ref={buttonRef}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleToggle}
            className={cn(
              baseClasses,
              'gap-3 px-4 py-3 rounded-lg border border-sage/20 hover:border-sage/30 hover:bg-navy-dark/30',
              isOpen && 'bg-navy-dark/50 border-teal-primary/50',
              className
            )}
          >
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt={profile.fullName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-teal-primary/20 flex items-center justify-center">
                <User className="w-5 h-5 text-teal-primary" />
              </div>
            )}
            
            <div className="text-left flex-1">
              <p className="text-sm font-medium text-cream">{profile.fullName}</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-sage/70">{user.email}</p>
                <UserRoleBadge profile={profile} />
              </div>
            </div>

            {showDropdown && (
              <ChevronDown className={cn(
                'w-5 h-5 text-sage/50 transition-transform flex-shrink-0',
                isOpen && 'rotate-180'
              )} />
            )}
          </motion.button>
        );
    }
  };

  return (
    <div className="relative">
      {renderButton()}

      {/* Dropdown menu */}
      {showDropdown && (
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'absolute right-0 top-full mt-2 w-80 z-50',
                dropdownClassName
              )}
            >
              <GlassMorphism variant="medium" className="overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-sage/10">
                  <div className="flex items-center gap-3">
                    {profile.avatar ? (
                      <img
                        src={profile.avatar}
                        alt={profile.fullName}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-teal-primary/20 flex items-center justify-center">
                        <User className="w-6 h-6 text-teal-primary" />
                      </div>
                    )}
                    
                    <div className="flex-1">
                      <p className="font-semibold text-cream">{profile.fullName}</p>
                      <p className="text-sm text-sage/70">{user.email}</p>
                      <UserRoleBadge profile={profile} className="mt-1" />
                    </div>
                  </div>
                </div>

                {/* Menu items */}
                <div className="py-2">
                  {dropdownMenuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-teal-primary/10 transition-colors group"
                      >
                        <Icon className="w-5 h-5 text-sage/70 group-hover:text-teal-primary mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-cream group-hover:text-teal-primary">
                            {item.label}
                          </p>
                          <p className="text-xs text-sage/50 mt-0.5">
                            {item.description}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* Session info */}
                {showSessionInfo && (
                  <SessionInfo profile={profile} />
                )}

                {/* Sign out */}
                <div className="border-t border-sage/10">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 w-full px-4 py-3 text-red-error hover:bg-red-error/10 transition-colors group"
                  >
                    <LogOut className="w-5 h-5" />
                    <div>
                      <p className="text-sm font-medium">Sign Out</p>
                      <p className="text-xs text-red-error/70">End your session</p>
                    </div>
                  </button>
                </div>
              </GlassMorphism>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

// Quick access profile button (minimal variant)
export const QuickProfileButton: React.FC<{
  className?: string;
  onClick?: () => void;
}> = ({ className, onClick }) => {
  const { user, profile } = useAuth();

  if (!user || !profile) return null;

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 p-2 rounded-lg hover:bg-navy-dark/30 transition-colors',
        className
      )}
    >
      {profile.avatar ? (
        <img
          src={profile.avatar}
          alt={profile.fullName}
          className="w-8 h-8 rounded-full object-cover"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-teal-primary/20 flex items-center justify-center">
          <User className="w-4 h-4 text-teal-primary" />
        </div>
      )}
      <span className="text-sm font-medium text-cream truncate max-w-24">
        {profile.firstName || 'User'}
      </span>
    </motion.button>
  );
};

export default UserProfileButton;