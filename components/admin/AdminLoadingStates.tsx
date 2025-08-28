'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  Shield,
  Users,
  Database,
  Settings,
  BarChart3,
  Search,
  Upload,
  Download,
  Trash2,
  Edit3,
  Eye,
  Lock,
  Unlock,
  UserPlus,
  FileText,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '@/components/GlassMorphism';

// Base loading spinner component
export const AdminLoadingSpinner: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'accent';
  className?: string;
}> = ({ 
  size = 'md', 
  variant = 'primary',
  className 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6', 
    lg: 'w-8 h-8'
  };

  const colorClasses = {
    primary: 'text-teal-primary',
    secondary: 'text-sage/70',
    accent: 'text-red-400'
  };

  return (
    <Loader2 
      className={cn(
        'animate-spin',
        sizeClasses[size],
        colorClasses[variant],
        className
      )} 
    />
  );
};

// Skeleton loader component
export const AdminSkeleton: React.FC<{
  className?: string;
  variant?: 'text' | 'rect' | 'circle' | 'card';
  lines?: number;
  animated?: boolean;
}> = ({ 
  className,
  variant = 'rect',
  lines = 1,
  animated = true
}) => {
  const baseClasses = 'bg-navy-dark/30 border border-sage/10';
  const animationClasses = animated ? 'animate-pulse' : '';

  if (variant === 'text') {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              baseClasses,
              animationClasses,
              'h-4 rounded',
              i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full',
              className
            )}
          />
        ))}
      </div>
    );
  }

  if (variant === 'circle') {
    return (
      <div
        className={cn(
          baseClasses,
          animationClasses,
          'w-12 h-12 rounded-full',
          className
        )}
      />
    );
  }

  if (variant === 'card') {
    return (
      <div className={cn(baseClasses, animationClasses, 'p-4 rounded-lg', className)}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-navy-dark/50 rounded-full" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-navy-dark/50 rounded w-1/3" />
              <div className="h-3 bg-navy-dark/50 rounded w-1/2" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-navy-dark/50 rounded" />
            <div className="h-3 bg-navy-dark/50 rounded w-4/5" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        baseClasses,
        animationClasses,
        'h-20 rounded-lg',
        className
      )}
    />
  );
};

// Full page loading overlay
export const AdminPageLoading: React.FC<{
  message?: string;
  submessage?: string;
  icon?: React.ComponentType<{ className?: string }>;
  progress?: number;
  className?: string;
}> = ({ 
  message = 'Loading admin portal...',
  submessage,
  icon: Icon = Shield,
  progress,
  className
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        'fixed inset-0 bg-navy-dark/95 backdrop-blur-sm flex items-center justify-center z-50',
        className
      )}
    >
      <GlassMorphism variant="medium" className="p-8 max-w-md mx-4">
        <div className="text-center space-y-6">
          <motion.div
            animate={{ 
              rotate: 360,
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              rotate: { duration: 2, repeat: Infinity, ease: 'linear' },
              scale: { duration: 1.5, repeat: Infinity }
            }}
            className="inline-flex p-4 bg-teal-primary/10 rounded-full border border-teal-primary/20"
          >
            <Icon className="w-12 h-12 text-teal-primary" />
          </motion.div>

          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-cream">
              {message}
            </h3>
            {submessage && (
              <p className="text-sage/70 text-sm">
                {submessage}
              </p>
            )}
          </div>

          {progress !== undefined && (
            <div className="w-full space-y-2">
              <div className="flex justify-between text-xs text-sage/60">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-navy-dark/50 rounded-full h-2 border border-sage/10">
                <motion.div
                  className="bg-gradient-to-r from-teal-primary to-teal-secondary h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-center">
            <AdminLoadingSpinner size="md" />
          </div>
        </div>
      </GlassMorphism>
    </motion.div>
  );
};

// Button loading states
export const AdminLoadingButton: React.FC<{
  isLoading: boolean;
  children: React.ReactNode;
  loadingText?: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}> = ({
  isLoading,
  children,
  loadingText,
  icon: Icon,
  disabled,
  variant = 'primary',
  size = 'md',
  className,
  onClick
}) => {
  const variantClasses = {
    primary: 'bg-gradient-to-r from-teal-primary to-teal-secondary text-cream',
    secondary: 'bg-sage/10 border border-sage/20 text-sage/70 hover:bg-sage/20 hover:text-cream',
    danger: 'bg-gradient-to-r from-red-500 to-red-600 text-white',
    success: 'bg-gradient-to-r from-green-500 to-green-600 text-white'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <motion.button
      whileHover={{ scale: disabled || isLoading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        'flex items-center justify-center gap-2 rounded-lg font-medium transition-all',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {isLoading ? (
        <>
          <AdminLoadingSpinner size="sm" variant="secondary" />
          {loadingText || 'Loading...'}
        </>
      ) : (
        <>
          {Icon && <Icon className="w-4 h-4" />}
          {children}
        </>
      )}
    </motion.button>
  );
};

// Table loading state
export const AdminTableLoading: React.FC<{
  columns: number;
  rows?: number;
  showHeader?: boolean;
  className?: string;
}> = ({ 
  columns,
  rows = 5,
  showHeader = true,
  className
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      {showHeader && (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, i) => (
            <AdminSkeleton key={i} variant="text" className="h-6" />
          ))}
        </div>
      )}
      
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div 
            key={i}
            className="grid gap-4 p-4 bg-navy-dark/20 border border-sage/10 rounded-lg"
            style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
          >
            {Array.from({ length: columns }).map((_, j) => (
              <AdminSkeleton key={j} variant="text" className="h-4" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// Card loading state
export const AdminCardLoading: React.FC<{
  count?: number;
  className?: string;
}> = ({ 
  count = 3,
  className
}) => {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <AdminSkeleton key={i} variant="card" />
      ))}
    </div>
  );
};

// Dashboard stats loading
export const AdminStatsLoading: React.FC<{
  count?: number;
  className?: string;
}> = ({ 
  count = 4,
  className
}) => {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <GlassMorphism key={i} variant="medium" className="p-4">
          <div className="flex items-center gap-3">
            <AdminSkeleton variant="circle" className="w-10 h-10" />
            <div className="space-y-2 flex-1">
              <AdminSkeleton variant="text" className="h-6 w-16" />
              <AdminSkeleton variant="text" className="h-4 w-20" />
            </div>
          </div>
        </GlassMorphism>
      ))}
    </div>
  );
};

// Form loading state
export const AdminFormLoading: React.FC<{
  fields?: number;
  className?: string;
}> = ({ 
  fields = 4,
  className
}) => {
  return (
    <div className={cn('space-y-6', className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <AdminSkeleton variant="text" className="h-4 w-24" />
          <AdminSkeleton variant="rect" className="h-10 w-full rounded-lg" />
        </div>
      ))}
      
      <div className="flex gap-3 pt-4">
        <AdminSkeleton variant="rect" className="h-10 w-24 rounded-lg" />
        <AdminSkeleton variant="rect" className="h-10 w-20 rounded-lg" />
      </div>
    </div>
  );
};

// Operation feedback component
export const AdminOperationFeedback: React.FC<{
  type: 'loading' | 'success' | 'error';
  message: string;
  details?: string;
  onClose?: () => void;
  autoClose?: boolean;
  duration?: number;
  className?: string;
}> = ({
  type,
  message,
  details,
  onClose,
  autoClose = false,
  duration = 5000,
  className
}) => {
  React.useEffect(() => {
    if (autoClose && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, duration, onClose]);

  const icons = {
    loading: Loader2,
    success: CheckCircle,
    error: AlertTriangle
  };

  const colors = {
    loading: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    success: 'text-green-400 bg-green-500/10 border-green-500/20',
    error: 'text-red-400 bg-red-500/10 border-red-500/20'
  };

  const Icon = icons[type];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          'flex items-start gap-3 p-4 rounded-lg border',
          colors[type],
          className
        )}
      >
        <Icon className={cn(
          'w-5 h-5 flex-shrink-0 mt-0.5',
          type === 'loading' && 'animate-spin'
        )} />
        
        <div className="flex-1 min-w-0">
          <p className="font-medium text-cream">
            {message}
          </p>
          {details && (
            <p className="text-sm text-sage/60 mt-1">
              {details}
            </p>
          )}
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="text-sage/50 hover:text-cream transition-colors"
          >
            ×
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default {
  AdminLoadingSpinner,
  AdminSkeleton,
  AdminPageLoading,
  AdminLoadingButton,
  AdminTableLoading,
  AdminCardLoading,
  AdminStatsLoading,
  AdminFormLoading,
  AdminOperationFeedback
};