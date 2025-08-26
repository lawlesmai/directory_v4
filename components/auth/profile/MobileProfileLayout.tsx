'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Home,
  Settings,
  Shield,
  User,
  Bell,
  Camera,
  MoreHorizontal
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { GlassMorphism } from '@/components/GlassMorphism';

// Mobile navigation configuration
interface MobileNavItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  badge?: number;
  href?: string;
  onClick?: () => void;
}

const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'privacy', label: 'Privacy', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell, badge: 3 },
];

// Mobile bottom navigation
const MobileBottomNav: React.FC<{
  activeTab: string;
  onTabChange: (tab: string) => void;
  items: MobileNavItem[];
}> = ({ activeTab, onTabChange, items }) => {
  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 z-40 bg-navy-dark/95 backdrop-blur-lg border-t border-sage/10"
    >
      <div className="flex items-center justify-around py-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => onTabChange(item.id)}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-0',
                isActive ? 'text-teal-primary' : 'text-sage/70'
              )}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {item.badge && item.badge > 0 && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-error text-cream text-xs rounded-full flex items-center justify-center">
                    {item.badge}
                  </div>
                )}
              </div>
              <span className="text-xs font-medium truncate">{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId="mobile-nav-active"
                  className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-teal-primary rounded-full"
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
};

// Mobile header
const MobileHeader: React.FC<{
  title: string;
  onBack?: () => void;
  onMenuToggle?: () => void;
  actions?: React.ReactNode;
  showBackButton?: boolean;
}> = ({ title, onBack, onMenuToggle, actions, showBackButton = false }) => {
  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="sticky top-0 z-40 bg-navy-dark/95 backdrop-blur-lg border-b border-sage/10"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {showBackButton && onBack ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onBack}
              className="p-2 -ml-2 text-sage/70 hover:text-cream transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </motion.button>
          ) : onMenuToggle ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onMenuToggle}
              className="p-2 -ml-2 text-sage/70 hover:text-cream transition-colors"
            >
              <Menu className="w-5 h-5" />
            </motion.button>
          ) : null}
          
          <h1 className="text-lg font-semibold text-cream truncate">{title}</h1>
        </div>

        <div className="flex items-center gap-2">
          {actions}
        </div>
      </div>
    </motion.header>
  );
};

// Mobile slide drawer
const MobileDrawer: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}> = ({ isOpen, onClose, children, title }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-navy-dark/80 backdrop-blur-sm z-50"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className="fixed right-0 top-0 h-full w-80 max-w-[85vw] bg-navy-dark/95 backdrop-blur-xl border-l border-sage/10 z-50 overflow-y-auto"
          >
            {title && (
              <div className="flex items-center justify-between p-4 border-b border-sage/10">
                <h2 className="text-lg font-semibold text-cream">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-2 text-sage/70 hover:text-cream transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
            <div className="p-4">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Mobile modal
const MobileModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  fullHeight?: boolean;
}> = ({ isOpen, onClose, children, title, fullHeight = false }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-navy-dark/80 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className={cn(
              'fixed bottom-0 left-0 right-0 bg-navy-dark/95 backdrop-blur-xl border-t border-sage/10 z-50',
              fullHeight ? 'top-0' : 'max-h-[80vh] rounded-t-2xl'
            )}
          >
            {/* Handle bar */}
            {!fullHeight && (
              <div className="flex justify-center py-3">
                <div className="w-10 h-1 bg-sage/30 rounded-full" />
              </div>
            )}

            {/* Header */}
            {title && (
              <div className="flex items-center justify-between px-4 py-3 border-b border-sage/10">
                <h2 className="text-lg font-semibold text-cream">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-2 text-sage/70 hover:text-cream transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Content */}
            <div className={cn('overflow-y-auto', fullHeight ? 'flex-1' : 'max-h-[60vh]')}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Touch gesture handler
const useTouchGestures = (onSwipeLeft?: () => void, onSwipeRight?: () => void) => {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = Math.abs(touch.clientY - touchStart.y);

    // Only trigger swipe if horizontal movement is greater than vertical
    if (Math.abs(deltaX) > deltaY && Math.abs(deltaX) > 50) {
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }

    setTouchStart(null);
  };

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
  };
};

// Main mobile layout component
export const MobileProfileLayout: React.FC<{
  children: React.ReactNode;
  title: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
  showBottomNav?: boolean;
  showHeader?: boolean;
  headerActions?: React.ReactNode;
  onBack?: () => void;
  enableSwipeNavigation?: boolean;
  className?: string;
}> = ({
  children,
  title,
  activeTab,
  onTabChange,
  showBottomNav = true,
  showHeader = true,
  headerActions,
  onBack,
  enableSwipeNavigation = true,
  className,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Touch gesture navigation
  const touchGestures = useTouchGestures(
    enableSwipeNavigation ? () => {
      // Swipe left - next tab
      const currentIndex = MOBILE_NAV_ITEMS.findIndex(item => item.id === activeTab);
      if (currentIndex < MOBILE_NAV_ITEMS.length - 1) {
        onTabChange(MOBILE_NAV_ITEMS[currentIndex + 1].id);
      }
    } : undefined,
    enableSwipeNavigation ? () => {
      // Swipe right - previous tab
      const currentIndex = MOBILE_NAV_ITEMS.findIndex(item => item.id === activeTab);
      if (currentIndex > 0) {
        onTabChange(MOBILE_NAV_ITEMS[currentIndex - 1].id);
      }
    } : undefined
  );

  return (
    <div className={cn('min-h-screen bg-navy-dark', className)}>
      {/* Mobile Header */}
      {showHeader && (
        <MobileHeader
          title={title}
          onBack={onBack}
          onMenuToggle={() => setIsMenuOpen(true)}
          actions={headerActions}
          showBackButton={!!onBack}
        />
      )}

      {/* Main Content */}
      <main
        className={cn(
          'flex-1',
          showBottomNav ? 'pb-20' : 'pb-4',
          showHeader ? 'pt-4' : 'pt-8'
        )}
        {...touchGestures}
      >
        <div className="px-4">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      {showBottomNav && (
        <MobileBottomNav
          activeTab={activeTab}
          onTabChange={onTabChange}
          items={MOBILE_NAV_ITEMS}
        />
      )}

      {/* Mobile Menu Drawer */}
      <MobileDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        title="Profile Menu"
      >
        <div className="space-y-2">
          {MOBILE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <motion.button
                key={item.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  onTabChange(item.id);
                  setIsMenuOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all',
                  isActive
                    ? 'bg-teal-primary/20 text-teal-primary border border-teal-primary/30'
                    : 'text-sage/70 hover:text-cream hover:bg-navy-50/20'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <div className="ml-auto w-5 h-5 bg-red-error text-cream text-xs rounded-full flex items-center justify-center">
                    {item.badge}
                  </div>
                )}
                {isActive && (
                  <motion.div
                    layoutId="mobile-menu-active"
                    className="absolute left-0 w-1 h-8 bg-teal-primary rounded-r-full"
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Menu Footer */}
        <div className="mt-8 pt-6 border-t border-sage/10">
          <button className="w-full flex items-center gap-3 px-4 py-3 text-sage/70 hover:text-cream transition-colors">
            <Home className="w-5 h-5" />
            <span>Back to Directory</span>
          </button>
        </div>
      </MobileDrawer>
    </div>
  );
};

// Mobile-optimized card component
export const MobileCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onClick?: () => void;
}> = ({ children, className, padding = 'md', interactive = false, onClick }) => {
  const paddingClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  return (
    <motion.div
      whileTap={interactive ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={cn(
        'w-full rounded-lg border border-sage/20 bg-navy-50/20',
        paddingClasses[padding],
        interactive && 'cursor-pointer hover:border-sage/30 active:bg-navy-50/30',
        className
      )}
    >
      {children}
    </motion.div>
  );
};

// Mobile-optimized form input
export const MobileInput: React.FC<{
  label: string;
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  icon?: React.ComponentType<any>;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}> = ({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  icon: Icon,
  required,
  disabled,
  className,
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      <label className="block text-sm font-medium text-cream">
        {label}
        {required && <span className="text-red-error ml-1">*</span>}
      </label>
      
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-sage/50 z-10" />
        )}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          className={cn(
            'w-full px-4 py-4 text-base bg-navy-50/20 border rounded-lg transition-all duration-200',
            'placeholder:text-sage/40 text-cream',
            'focus:outline-none focus:ring-2 focus:ring-teal-primary/50 focus:border-teal-primary/50',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            Icon ? 'pl-12' : '',
            error ? 'border-red-error/50 bg-red-error/5' : 'border-sage/20 hover:border-sage/30'
          )}
        />
      </div>

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-red-error text-sm"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
};

// Export mobile utilities
export { MobileDrawer, MobileModal, useTouchGestures };