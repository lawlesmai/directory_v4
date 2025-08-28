'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Users,
  Settings,
  BarChart3,
  AlertTriangle,
  Bell,
  LogOut,
  Menu,
  X,
  Home,
  Search,
  Database,
  Lock,
  FileText,
  Headphones,
  Zap,
  Eye,
  Clock,
  Globe,
  ChevronDown,
  UserCheck
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '@/components/GlassMorphism';

// Admin navigation items
const adminNavItems = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: Home,
    exact: true
  },
  {
    label: 'User Management',
    href: '/admin/users',
    icon: Users,
    submenu: [
      { label: 'All Users', href: '/admin/users' },
      { label: 'Business Owners', href: '/admin/users/business-owners' },
      { label: 'Suspended Users', href: '/admin/users/suspended' },
      { label: 'User Impersonation', href: '/admin/users/impersonation' }
    ]
  },
  {
    label: 'Business Management',
    href: '/admin/businesses',
    icon: Database,
    submenu: [
      { label: 'All Businesses', href: '/admin/businesses' },
      { label: 'Pending Verification', href: '/admin/businesses/pending' },
      { label: 'Verification Workflows', href: '/admin/businesses/verification' },
      { label: 'Subscription Management', href: '/admin/businesses/subscriptions' }
    ]
  },
  {
    label: 'Content Moderation',
    href: '/admin/content',
    icon: FileText,
    submenu: [
      { label: 'Review Moderation', href: '/admin/content/reviews' },
      { label: 'Media Approval', href: '/admin/content/media' },
      { label: 'Spam Reports', href: '/admin/content/spam' },
      { label: 'Community Guidelines', href: '/admin/content/guidelines' }
    ]
  },
  {
    label: 'Analytics & Reports',
    href: '/admin/analytics',
    icon: BarChart3,
    submenu: [
      { label: 'Platform Overview', href: '/admin/analytics' },
      { label: 'User Engagement', href: '/admin/analytics/engagement' },
      { label: 'Revenue Reports', href: '/admin/analytics/revenue' },
      { label: 'Performance Metrics', href: '/admin/analytics/performance' }
    ]
  },
  {
    label: 'Security Monitoring',
    href: '/admin/security',
    icon: Shield,
    submenu: [
      { label: 'Audit Logs', href: '/admin/security/audit' },
      { label: 'Failed Logins', href: '/admin/security/failed-logins' },
      { label: 'IP Whitelist', href: '/admin/security/ip-whitelist' },
      { label: 'Session Management', href: '/admin/security/sessions' }
    ]
  },
  {
    label: 'Customer Support',
    href: '/admin/support',
    icon: Headphones,
    submenu: [
      { label: 'Ticket Dashboard', href: '/admin/support' },
      { label: 'Live Chat', href: '/admin/support/chat' },
      { label: 'Knowledge Base', href: '/admin/support/knowledge-base' },
      { label: 'Escalations', href: '/admin/support/escalations' }
    ]
  },
  {
    label: 'System Settings',
    href: '/admin/settings',
    icon: Settings,
    submenu: [
      { label: 'Platform Config', href: '/admin/settings/platform' },
      { label: 'Feature Flags', href: '/admin/settings/features' },
      { label: 'Email Templates', href: '/admin/settings/email' },
      { label: 'Integrations', href: '/admin/settings/integrations' }
    ]
  }
];

interface AdminUser {
  id: string;
  email: string;
  role: 'super_admin' | 'platform_admin' | 'support_admin' | 'content_moderator';
  permissions: string[];
  name?: string;
  avatar?: string;
  lastLogin?: Date;
  ipAddress?: string;
  location?: string;
}

interface AdminDashboardLayoutProps {
  children: React.ReactNode;
  user?: AdminUser;
  className?: string;
}

interface AlertItem {
  id: string;
  type: 'security' | 'system' | 'user' | 'business';
  title: string;
  message: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  read: boolean;
}

// Mock admin user for demo
const mockAdminUser: AdminUser = {
  id: 'admin-1',
  email: 'admin@lawlessdirectory.com',
  role: 'super_admin',
  permissions: ['read:all', 'write:all', 'admin:all'],
  name: 'System Administrator',
  lastLogin: new Date(),
  ipAddress: '192.168.1.100',
  location: 'San Francisco, CA'
};

// Mock alerts
const mockAlerts: AlertItem[] = [
  {
    id: '1',
    type: 'security',
    title: 'Failed Login Attempts',
    message: '15 failed admin login attempts from unknown IP',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    severity: 'high',
    read: false
  },
  {
    id: '2',
    type: 'system',
    title: 'High Server Load',
    message: 'Server load above 80% for the last 10 minutes',
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    severity: 'medium',
    read: false
  },
  {
    id: '3',
    type: 'user',
    title: 'New Business Verification',
    message: '5 businesses pending verification approval',
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    severity: 'low',
    read: true
  }
];

const NavItem: React.FC<{
  item: typeof adminNavItems[0];
  isActive: boolean;
  isMobile?: boolean;
  onNavigate?: () => void;
}> = ({ item, isActive, isMobile = false, onNavigate }) => {
  const [isExpanded, setIsExpanded] = useState(isActive);
  const pathname = usePathname();
  const Icon = item.icon;

  // Check if any submenu item is active
  const hasActiveSubmenu = item.submenu?.some(sub => pathname.startsWith(sub.href));

  useEffect(() => {
    if (hasActiveSubmenu) {
      setIsExpanded(true);
    }
  }, [hasActiveSubmenu]);

  return (
    <div className="space-y-1">
      <Link
        href={item.href}
        onClick={() => {
          if (item.submenu) {
            setIsExpanded(!isExpanded);
          }
          onNavigate?.();
        }}
        className={cn(
          'flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200',
          'hover:bg-red-500/10 hover:text-red-400',
          {
            'bg-red-500/20 text-red-400 border border-red-500/30': isActive || hasActiveSubmenu,
            'text-sage/70': !isActive && !hasActiveSubmenu
          }
        )}
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium">{item.label}</span>
        </div>
        {item.submenu && (
          <ChevronDown
            className={cn(
              'w-4 h-4 transition-transform duration-200',
              isExpanded ? 'rotate-180' : ''
            )}
          />
        )}
      </Link>

      {/* Submenu */}
      {item.submenu && (
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="ml-4 space-y-1">
                {item.submenu.map((subItem) => {
                  const isSubActive = pathname === subItem.href;
                  return (
                    <Link
                      key={subItem.href}
                      href={subItem.href}
                      onClick={onNavigate}
                      className={cn(
                        'block px-4 py-2 rounded-lg text-sm transition-colors',
                        'hover:bg-red-500/10 hover:text-red-400',
                        {
                          'bg-red-500/20 text-red-400': isSubActive,
                          'text-sage/60': !isSubActive
                        }
                      )}
                    >
                      {subItem.label}
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

const AdminHeader: React.FC<{
  user: AdminUser;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}> = ({ user, onToggleSidebar, isSidebarOpen }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [alerts] = useState(mockAlerts);
  const router = useRouter();

  const unreadAlerts = alerts.filter(alert => !alert.read);

  const handleSignOut = () => {
    // In production, clear admin session
    router.push('/admin/login');
  };

  const getSeverityColor = (severity: AlertItem['severity']) => {
    switch (severity) {
      case 'critical': return 'text-red-500';
      case 'high': return 'text-red-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-blue-400';
      default: return 'text-sage/70';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return `${Math.floor(minutes / 1440)}d ago`;
  };

  return (
    <header className="bg-navy-dark/95 backdrop-blur-sm border-b border-red-500/20 sticky top-0 z-30">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left side - Menu toggle and branding */}
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleSidebar}
            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors lg:hidden"
          >
            {isSidebarOpen ? (
              <X className="w-5 h-5 text-sage/70" />
            ) : (
              <Menu className="w-5 h-5 text-sage/70" />
            )}
          </button>
          
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
              <Shield className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-cream">Admin Portal</h1>
              <p className="text-xs text-sage/60">Lawless Directory</p>
            </div>
          </div>
        </div>

        {/* Right side - Actions and user menu */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 hover:bg-red-500/10 rounded-lg transition-colors relative"
            >
              <Bell className="w-5 h-5 text-sage/70" />
              {unreadAlerts.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadAlerts.length}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="absolute right-0 top-full mt-2 w-80 z-40"
                >
                  <GlassMorphism variant="medium" className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-cream">Notifications</h3>
                        <span className="text-xs text-sage/60">{unreadAlerts.length} unread</span>
                      </div>

                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {alerts.slice(0, 5).map((alert) => (
                          <div
                            key={alert.id}
                            className={cn(
                              'p-3 rounded-lg transition-colors cursor-pointer',
                              alert.read ? 'bg-navy-dark/30' : 'bg-red-500/10 border border-red-500/20'
                            )}
                          >
                            <div className="flex items-start gap-2">
                              <AlertTriangle className={cn('w-4 h-4 flex-shrink-0 mt-0.5', getSeverityColor(alert.severity))} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-cream truncate">
                                  {alert.title}
                                </p>
                                <p className="text-xs text-sage/60 mt-1">
                                  {alert.message}
                                </p>
                                <p className="text-xs text-sage/50 mt-1">
                                  {formatTimestamp(alert.timestamp)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <Link
                        href="/admin/notifications"
                        className="block text-center text-sm text-teal-primary hover:text-teal-secondary transition-colors"
                      >
                        View all notifications
                      </Link>
                    </div>
                  </GlassMorphism>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 px-3 py-2 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                <UserCheck className="w-4 h-4 text-red-400" />
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium text-cream">{user.name || 'Admin'}</p>
                <p className="text-xs text-sage/60 capitalize">{user.role.replace('_', ' ')}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-sage/50" />
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="absolute right-0 top-full mt-2 w-64 z-40"
                >
                  <GlassMorphism variant="medium" className="p-4">
                    <div className="space-y-4">
                      {/* User info */}
                      <div className="pb-3 border-b border-sage/10">
                        <p className="font-medium text-cream">{user.name}</p>
                        <p className="text-sm text-sage/70">{user.email}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-sage/60">
                          <span className="flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            {user.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimestamp(user.lastLogin || new Date())}
                          </span>
                        </div>
                      </div>

                      {/* Menu items */}
                      <div className="space-y-1">
                        <Link
                          href="/admin/profile"
                          className="flex items-center gap-2 px-3 py-2 text-sm text-sage/70 hover:text-cream hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                          Admin Profile
                        </Link>
                        <Link
                          href="/admin/security/sessions"
                          className="flex items-center gap-2 px-3 py-2 text-sm text-sage/70 hover:text-cream hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Lock className="w-4 h-4" />
                          Security Settings
                        </Link>
                        <Link
                          href="/admin/audit-logs"
                          className="flex items-center gap-2 px-3 py-2 text-sm text-sage/70 hover:text-cream hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          My Activity Log
                        </Link>
                      </div>

                      <div className="pt-2 border-t border-sage/10">
                        <button
                          onClick={handleSignOut}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </GlassMorphism>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
};

const AdminSidebar: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const pathname = usePathname();

  const isActiveLink = (href: string, exact?: boolean) => {
    if (exact) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-navy-dark/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          x: isOpen ? 0 : '-100%'
        }}
        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
        className="fixed top-0 left-0 h-full w-80 bg-navy-dark/95 backdrop-blur-xl border-r border-red-500/20 z-50 lg:relative lg:translate-x-0 lg:z-auto"
      >
        <div className="p-6 h-full overflow-y-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
              <Shield className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-cream">Admin Portal</h2>
              <p className="text-xs text-sage/60">Navigation</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-2">
            {adminNavItems.map((item) => (
              <NavItem
                key={item.href}
                item={item}
                isActive={isActiveLink(item.href, item.exact)}
                onNavigate={onClose}
              />
            ))}
          </nav>

          {/* Quick stats */}
          <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <h3 className="text-sm font-semibold text-cream mb-3">Quick Stats</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-sage/60">Active Users</span>
                <span className="text-cream">2,341</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sage/60">Pending Reviews</span>
                <span className="text-red-400">23</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sage/60">System Health</span>
                <span className="text-green-400">98.5%</span>
              </div>
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
};

export const AdminDashboardLayout: React.FC<AdminDashboardLayoutProps> = ({
  children,
  user = mockAdminUser,
  className = ''
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={cn('min-h-screen bg-navy-dark flex', className)}>
      {/* Sidebar */}
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <AdminHeader
          user={user}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          isSidebarOpen={sidebarOpen}
        />

        {/* Page content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboardLayout;