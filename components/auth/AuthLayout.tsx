'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Settings,
  Shield,
  LogOut,
  Menu,
  X,
  Home,
  Building2,
  Star,
  MessageSquare,
  Search,
  Plus,
  Bell,
  HelpCircle
} from 'lucide-react';
import { useAuth, useAuthState } from '@/contexts/AuthContext';
import { useRoleCheck, RequireRole, RequireAuthentication } from './RequireRole';
import { useAuthModal } from './AuthModal';
import { GlassMorphism } from '@/components/GlassMorphism';
import { cn } from '@/lib/utils';

// Navigation item types
interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<any>;
  requiredRoles?: string[];
  requiredPermissions?: string[];
  exact?: boolean;
}

// Main navigation items
const mainNavItems: NavItem[] = [
  {
    label: 'Home',
    href: '/',
    icon: Home,
    exact: true
  },
  {
    label: 'Businesses',
    href: '/businesses',
    icon: Building2
  },
  {
    label: 'Reviews',
    href: '/reviews',
    icon: Star
  },
  {
    label: 'Messages',
    href: '/messages',
    icon: MessageSquare,
    requiredPermissions: ['read:messages']
  }
];

// Admin navigation items
const adminNavItems: NavItem[] = [
  {
    label: 'Admin Dashboard',
    href: '/admin',
    icon: Shield,
    requiredRoles: ['admin', 'super_admin']
  },
  {
    label: 'User Management',
    href: '/admin/users',
    icon: User,
    requiredRoles: ['admin', 'super_admin']
  },
  {
    label: 'Content Management',
    href: '/admin/content',
    icon: Settings,
    requiredRoles: ['admin', 'super_admin']
  }
];

// User menu items
const userMenuItems = [
  {
    label: 'Profile',
    href: '/profile',
    icon: User
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings
  },
  {
    label: 'Help & Support',
    href: '/help',
    icon: HelpCircle
  }
];

// Props for AuthLayout
export interface AuthLayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
  showFooter?: boolean;
  showSidebar?: boolean;
  className?: string;
  requireAuth?: boolean;
}

// Navigation link component
const NavLink: React.FC<{
  item: NavItem;
  isActive: boolean;
  isMobile?: boolean;
  onClick?: () => void;
}> = ({ item, isActive, isMobile, onClick }) => {
  const { checkRole, checkPermissions } = useRoleCheck();

  // Check if user has access to this nav item
  const hasAccess = React.useMemo(() => {
    if (item.requiredRoles && item.requiredRoles.length > 0) {
      const hasRole = item.requiredRoles.some(role => checkRole(role as any));
      if (!hasRole) return false;
    }

    if (item.requiredPermissions && item.requiredPermissions.length > 0) {
      const hasPermission = checkPermissions(item.requiredPermissions as any, false);
      if (!hasPermission) return false;
    }

    return true;
  }, [item.requiredRoles, item.requiredPermissions, checkRole, checkPermissions]);

  if (!hasAccess) return null;

  const Icon = item.icon;

  return (
    <Link href={item.href} onClick={onClick}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
          'hover:bg-teal-primary/10 hover:text-teal-primary',
          isActive 
            ? 'bg-teal-primary/20 text-teal-primary border border-teal-primary/30' 
            : 'text-sage/70 hover:text-cream',
          isMobile ? 'w-full' : ''
        )}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span className="font-medium">{item.label}</span>
        {isActive && (
          <motion.div
            layoutId={isMobile ? 'mobile-active-nav' : 'desktop-active-nav'}
            className="absolute left-0 w-1 h-8 bg-teal-primary rounded-r-full"
          />
        )}
      </motion.div>
    </Link>
  );
};

// User profile button component
const UserProfileButton: React.FC<{
  isOpen: boolean;
  onToggle: () => void;
}> = ({ isOpen, onToggle }) => {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (!user || !profile) return null;

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onToggle}
        className={cn(
          'flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200',
          'hover:bg-navy-dark/50 border border-sage/20',
          isOpen ? 'bg-navy-dark/70 border-teal-primary/50' : ''
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
        <div className="text-left hidden sm:block">
          <p className="text-sm font-medium text-cream">{profile.fullName}</p>
          <p className="text-xs text-sage/70">{user.email}</p>
        </div>
      </motion.button>

      {/* User menu dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-full mt-2 w-64 z-50"
          >
            <GlassMorphism variant="medium" className="py-2">
              <div className="px-4 py-3 border-b border-sage/10">
                <p className="font-medium text-cream">{profile.fullName}</p>
                <p className="text-sm text-sage/70">{user.email}</p>
                <p className="text-xs text-teal-primary capitalize mt-1">
                  {profile.businessType?.replace('_', ' ')}
                </p>
              </div>

              <nav className="py-2">
                {userMenuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onToggle}
                      className="flex items-center gap-3 px-4 py-2 text-sage/70 hover:text-cream hover:bg-teal-primary/10 transition-colors"
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="border-t border-sage/10 pt-2 mt-2">
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 w-full px-4 py-2 text-red-error hover:bg-red-error/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </GlassMorphism>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Header component
const Header: React.FC<{
  onMobileMenuToggle: () => void;
  isMobileMenuOpen: boolean;
}> = ({ onMobileMenuToggle, isMobileMenuOpen }) => {
  const { isAuthenticated } = useAuthState();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { openLogin, openRegister } = useAuthModal();

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuOpen && !(event.target as Element).closest('.user-menu-container')) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  return (
    <header className="sticky top-0 z-40 backdrop-blur-sm bg-navy-dark/90 border-b border-sage/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <motion.div
              whileHover={{ rotate: 10 }}
              className="w-8 h-8 bg-gradient-to-br from-teal-primary to-teal-secondary rounded-lg flex items-center justify-center"
            >
              <Search className="w-4 h-4 text-cream" />
            </motion.div>
            <span className="font-bold text-lg text-cream">Lawless Directory</span>
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {mainNavItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={false} // We'll implement active state detection
              />
            ))}
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <RequireRole roles={['business_owner', 'admin', 'super_admin']}>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-primary to-teal-secondary text-cream rounded-lg hover:shadow-lg transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Add Business
                  </motion.button>
                </RequireRole>

                <button className="p-2 text-sage/70 hover:text-cream transition-colors relative">
                  <Bell className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-error rounded-full text-xs"></span>
                </button>

                <div className="user-menu-container">
                  <UserProfileButton
                    isOpen={userMenuOpen}
                    onToggle={() => setUserMenuOpen(!userMenuOpen)}
                  />
                </div>
              </>
            ) : (
              <div className="hidden sm:flex items-center gap-3">
                <button
                  onClick={openLogin}
                  className="px-4 py-2 text-sage/70 hover:text-cream transition-colors"
                >
                  Sign In
                </button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={openRegister}
                  className="px-4 py-2 bg-gradient-to-r from-teal-primary to-teal-secondary text-cream rounded-lg hover:shadow-lg transition-all"
                >
                  Get Started
                </motion.button>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={onMobileMenuToggle}
              className="md:hidden p-2 text-sage/70 hover:text-cream transition-colors"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

// Mobile menu component
const MobileMenu: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { isAuthenticated } = useAuthState();
  const { openLogin, openRegister } = useAuthModal();
  const pathname = usePathname();

  const isActiveLink = (href: string, exact?: boolean) => {
    if (exact) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-navy-dark/80 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Menu */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className="fixed right-0 top-0 h-full w-80 max-w-sm bg-navy-dark/95 backdrop-blur-xl border-l border-sage/10 z-50"
          >
            <div className="p-6 space-y-6">
              {/* Auth actions */}
              {!isAuthenticated && (
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      openLogin();
                      onClose();
                    }}
                    className="w-full px-4 py-3 text-left text-sage/70 hover:text-cream hover:bg-teal-primary/10 rounded-lg transition-colors"
                  >
                    Sign In
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      openRegister();
                      onClose();
                    }}
                    className="w-full px-4 py-3 bg-gradient-to-r from-teal-primary to-teal-secondary text-cream rounded-lg hover:shadow-lg transition-all"
                  >
                    Get Started
                  </motion.button>
                </div>
              )}

              {/* Main navigation */}
              <nav className="space-y-2">
                <h3 className="text-xs font-medium text-sage/50 uppercase tracking-wide mb-4">
                  Navigation
                </h3>
                {mainNavItems.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    isActive={isActiveLink(item.href, item.exact)}
                    isMobile
                    onClick={onClose}
                  />
                ))}
              </nav>

              {/* Admin navigation */}
              <RequireRole roles={['admin', 'super_admin']}>
                <nav className="space-y-2">
                  <h3 className="text-xs font-medium text-sage/50 uppercase tracking-wide mb-4">
                    Administration
                  </h3>
                  {adminNavItems.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      isActive={isActiveLink(item.href, item.exact)}
                      isMobile
                      onClick={onClose}
                    />
                  ))}
                </nav>
              </RequireRole>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Main AuthLayout component
export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  showHeader = true,
  showFooter = false,
  showSidebar = false,
  className = '',
  requireAuth = false
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated } = useAuthState();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [usePathname()]);

  const content = (
    <div className={cn('min-h-screen flex flex-col bg-navy-dark', className)}>
      {showHeader && (
        <Header
          onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
          isMobileMenuOpen={mobileMenuOpen}
        />
      )}

      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <main className="flex-1">
        {children}
      </main>

      {showFooter && (
        <footer className="border-t border-sage/10 bg-navy-dark/50 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center text-sage/70">
              <p>&copy; 2024 Lawless Directory. All rights reserved.</p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );

  if (requireAuth) {
    return (
      <RequireAuthentication fallback={content}>
        {content}
      </RequireAuthentication>
    );
  }

  return content;
};

export default AuthLayout;