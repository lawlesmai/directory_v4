'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  Smartphone, 
  Key, 
  Shield, 
  Star, 
  Clock, 
  Users,
  Zap,
  CheckCircle,
  ChevronRight,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '../GlassMorphism';
import { SocialLoginIconButton } from './SocialLoginButton';
import type { AuthProvider } from './types';

// Authentication method types
type AuthMethod = AuthProvider | 'email' | 'phone' | 'magic_link' | 'webauthn';

// Provider/method configuration
interface MethodConfig {
  id: AuthMethod;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  type: 'social' | 'traditional' | 'passwordless' | 'biometric';
  difficulty: 'easy' | 'medium' | 'advanced';
  security: 'standard' | 'high' | 'highest';
  speed: 'instant' | 'fast' | 'normal';
  availability: number; // 0-100 percentage
  popular: boolean;
  recommended?: boolean;
  requiresSetup?: boolean;
  beta?: boolean;
}

interface ProviderSelectionProps {
  providers: AuthMethod[];
  onSelect: (method: AuthMethod) => void;
  recommended?: AuthMethod;
  className?: string;
  title?: string;
  subtitle?: string;
  showCategories?: boolean;
  showMetrics?: boolean;
  showDescription?: boolean;
  layout?: 'grid' | 'list' | 'compact';
  filterType?: 'all' | 'social' | 'traditional' | 'passwordless' | 'biometric';
  sortBy?: 'popularity' | 'security' | 'speed' | 'name';
  maxItems?: number;
}

// Method configurations
const methodConfigs: Record<AuthMethod, MethodConfig> = {
  google: {
    id: 'google',
    name: 'Google',
    description: 'Sign in with your Google account - quick and secure',
    icon: ({ className }) => (
      <div className={cn('text-xl', className)}>🟦</div>
    ),
    type: 'social',
    difficulty: 'easy',
    security: 'high',
    speed: 'instant',
    availability: 99,
    popular: true,
    recommended: true
  },
  apple: {
    id: 'apple',
    name: 'Apple',
    description: 'Use Apple ID with privacy-focused authentication',
    icon: ({ className }) => (
      <div className={cn('text-xl', className)}>🍎</div>
    ),
    type: 'social',
    difficulty: 'easy',
    security: 'highest',
    speed: 'instant',
    availability: 95,
    popular: true
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    description: 'Connect with your Facebook account',
    icon: ({ className }) => (
      <div className={cn('text-xl', className)}>📘</div>
    ),
    type: 'social',
    difficulty: 'easy',
    security: 'standard',
    speed: 'fast',
    availability: 98,
    popular: true
  },
  github: {
    id: 'github',
    name: 'GitHub',
    description: 'Developer-friendly authentication via GitHub',
    icon: ({ className }) => (
      <div className={cn('text-xl', className)}>⚫</div>
    ),
    type: 'social',
    difficulty: 'easy',
    security: 'high',
    speed: 'fast',
    availability: 99,
    popular: false
  },
  email: {
    id: 'email',
    name: 'Email & Password',
    description: 'Traditional email and password authentication',
    icon: Mail,
    type: 'traditional',
    difficulty: 'medium',
    security: 'standard',
    speed: 'normal',
    availability: 100,
    popular: true
  },
  phone: {
    id: 'phone',
    name: 'Phone Number',
    description: 'Verify your identity with SMS code',
    icon: Smartphone,
    type: 'traditional',
    difficulty: 'medium',
    security: 'high',
    speed: 'fast',
    availability: 95,
    popular: false,
    requiresSetup: true
  },
  magic_link: {
    id: 'magic_link',
    name: 'Magic Link',
    description: 'Passwordless login via email link',
    icon: Zap,
    type: 'passwordless',
    difficulty: 'easy',
    security: 'high',
    speed: 'fast',
    availability: 100,
    popular: false
  },
  webauthn: {
    id: 'webauthn',
    name: 'Biometric',
    description: 'Use fingerprint, face, or security key',
    icon: Shield,
    type: 'biometric',
    difficulty: 'advanced',
    security: 'highest',
    speed: 'instant',
    availability: 60,
    popular: false,
    requiresSetup: true,
    beta: true
  }
};

export const ProviderSelection: React.FC<ProviderSelectionProps> = ({
  providers,
  onSelect,
  recommended,
  className = '',
  title = 'Choose your sign-in method',
  subtitle = 'Select how you\'d like to authenticate',
  showCategories = true,
  showMetrics = false,
  showDescription = true,
  layout = 'grid',
  filterType = 'all',
  sortBy = 'popularity',
  maxItems
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [hoveredMethod, setHoveredMethod] = useState<AuthMethod | null>(null);

  // Filter and sort methods
  const availableMethods = providers
    .map(p => methodConfigs[p])
    .filter(method => {
      if (filterType === 'all') return true;
      return method.type === filterType;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'popularity':
          return (b.popular ? 1 : 0) - (a.popular ? 1 : 0);
        case 'security':
          const securityOrder = { 'standard': 1, 'high': 2, 'highest': 3 };
          return securityOrder[b.security] - securityOrder[a.security];
        case 'speed':
          const speedOrder = { 'normal': 1, 'fast': 2, 'instant': 3 };
          return speedOrder[b.speed] - speedOrder[a.speed];
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    })
    .slice(0, maxItems);

  // Group methods by type
  const methodsByType = availableMethods.reduce((acc, method) => {
    if (!acc[method.type]) acc[method.type] = [];
    acc[method.type].push(method);
    return acc;
  }, {} as Record<string, MethodConfig[]>);

  const getSecurityColor = (level: string) => {
    switch (level) {
      case 'standard': return 'text-yellow-500';
      case 'high': return 'text-green-500';
      case 'highest': return 'text-teal-primary';
      default: return 'text-sage/50';
    }
  };

  const getSpeedColor = (speed: string) => {
    switch (speed) {
      case 'normal': return 'text-sage/50';
      case 'fast': return 'text-blue-400';
      case 'instant': return 'text-teal-primary';
      default: return 'text-sage/50';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-500';
      case 'medium': return 'text-yellow-500';
      case 'advanced': return 'text-red-400';
      default: return 'text-sage/50';
    }
  };

  const renderMethodCard = (method: MethodConfig, isRecommended = false) => {
    const isSocial = method.type === 'social';
    const IconComponent = method.icon;

    return (
      <motion.button
        key={method.id}
        onClick={() => onSelect(method.id)}
        onMouseEnter={() => setHoveredMethod(method.id)}
        onMouseLeave={() => setHoveredMethod(null)}
        className={cn(
          'relative w-full p-4 rounded-xl border transition-all duration-300',
          'text-left hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-navy-dark',
          isRecommended
            ? 'bg-teal-primary/10 border-teal-primary/50 focus:ring-teal-primary/50 ring-2 ring-teal-primary/30'
            : 'bg-navy-50/5 border-sage/20 hover:border-sage/40 focus:ring-sage/50 hover:bg-sage/5',
          layout === 'compact' && 'p-3',
          hoveredMethod === method.id && 'scale-[1.02] shadow-xl'
        )}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Recommended Badge */}
        {isRecommended && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute -top-2 -right-2 bg-gradient-to-r from-teal-primary to-teal-secondary text-cream text-xs px-2 py-1 rounded-full flex items-center gap-1"
          >
            <Star className="w-3 h-3" />
            Recommended
          </motion.div>
        )}

        {/* Beta Badge */}
        {method.beta && (
          <div className="absolute top-2 right-2 bg-purple-500/20 text-purple-400 text-xs px-2 py-0.5 rounded">
            Beta
          </div>
        )}

        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn(
            'flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center',
            isSocial 
              ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20' 
              : 'bg-sage/10',
            layout === 'compact' && 'w-8 h-8'
          )}>
            {isSocial ? (
              <SocialLoginIconButton
                provider={method.id as AuthProvider}
                size={layout === 'compact' ? 'sm' : 'md'}
                onSuccess={() => {}}
                onError={() => {}}
              />
            ) : (
              <IconComponent className={cn(
                'text-sage',
                layout === 'compact' ? 'w-4 h-4' : 'w-6 h-6'
              )} />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className={cn(
                'font-semibold text-cream',
                layout === 'compact' ? 'text-sm' : 'text-base'
              )}>
                {method.name}
              </h3>
              
              {method.popular && (
                <span className="inline-flex items-center gap-1 text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded">
                  <Users className="w-3 h-3" />
                  Popular
                </span>
              )}

              {method.requiresSetup && (
                <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                  Setup Required
                </span>
              )}
            </div>

            {showDescription && (
              <p className={cn(
                'text-sage/70 mb-3',
                layout === 'compact' ? 'text-xs' : 'text-sm'
              )}>
                {method.description}
              </p>
            )}

            {/* Metrics */}
            {showMetrics && layout !== 'compact' && (
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="text-center">
                  <div className={cn('font-medium', getSecurityColor(method.security))}>
                    <Shield className="w-3 h-3 inline mr-1" />
                    {method.security}
                  </div>
                  <div className="text-sage/50">Security</div>
                </div>
                
                <div className="text-center">
                  <div className={cn('font-medium', getSpeedColor(method.speed))}>
                    <Zap className="w-3 h-3 inline mr-1" />
                    {method.speed}
                  </div>
                  <div className="text-sage/50">Speed</div>
                </div>
                
                <div className="text-center">
                  <div className={cn('font-medium', getDifficultyColor(method.difficulty))}>
                    <Key className="w-3 h-3 inline mr-1" />
                    {method.difficulty}
                  </div>
                  <div className="text-sage/50">Setup</div>
                </div>
              </div>
            )}

            {/* Availability indicator */}
            {method.availability < 100 && (
              <div className="mt-2 flex items-center gap-2 text-xs text-yellow-500">
                <Info className="w-3 h-3" />
                {method.availability}% availability
              </div>
            )}
          </div>

          {/* Arrow */}
          <ChevronRight className={cn(
            'flex-shrink-0 text-sage/30 transition-transform',
            layout === 'compact' ? 'w-4 h-4' : 'w-5 h-5',
            hoveredMethod === method.id && 'transform translate-x-1'
          )} />
        </div>
      </motion.button>
    );
  };

  const renderGrid = () => (
    <div className={cn(
      'grid gap-4',
      layout === 'compact' 
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' 
        : 'grid-cols-1 sm:grid-cols-2 gap-6'
    )}>
      {availableMethods.map(method => 
        renderMethodCard(method, method.id === recommended)
      )}
    </div>
  );

  const renderList = () => (
    <div className="space-y-3">
      {availableMethods.map(method => 
        renderMethodCard(method, method.id === recommended)
      )}
    </div>
  );

  const renderByCategory = () => (
    <div className="space-y-8">
      {Object.entries(methodsByType).map(([type, methods]) => (
        <div key={type}>
          <h3 className="text-lg font-semibold text-cream mb-4 capitalize flex items-center gap-2">
            {type === 'social' && <Users className="w-5 h-5 text-teal-primary" />}
            {type === 'traditional' && <Mail className="w-5 h-5 text-blue-400" />}
            {type === 'passwordless' && <Zap className="w-5 h-5 text-purple-400" />}
            {type === 'biometric' && <Shield className="w-5 h-5 text-green-400" />}
            {type.replace('_', ' ')} Methods
          </h3>
          
          <div className={cn(
            'grid gap-4',
            layout === 'compact' 
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' 
              : 'grid-cols-1 sm:grid-cols-2'
          )}>
            {methods.map(method => 
              renderMethodCard(method, method.id === recommended)
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <GlassMorphism variant="medium" className={cn('p-6', className)}>
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-cream mb-2">
          {title}
        </h2>
        <p className="text-sage/70">
          {subtitle}
        </p>
      </div>

      {/* Quick Stats */}
      {showMetrics && availableMethods.length > 1 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="text-center p-3 bg-sage/5 rounded-lg">
            <div className="text-2xl font-bold text-teal-primary">
              {availableMethods.filter(m => m.popular).length}
            </div>
            <div className="text-xs text-sage/70">Popular Options</div>
          </div>
          
          <div className="text-center p-3 bg-sage/5 rounded-lg">
            <div className="text-2xl font-bold text-green-400">
              {availableMethods.filter(m => m.security === 'highest').length}
            </div>
            <div className="text-xs text-sage/70">Highest Security</div>
          </div>
          
          <div className="text-center p-3 bg-sage/5 rounded-lg">
            <div className="text-2xl font-bold text-blue-400">
              {availableMethods.filter(m => m.speed === 'instant').length}
            </div>
            <div className="text-xs text-sage/70">Instant Access</div>
          </div>
        </div>
      )}

      {/* Methods */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${layout}-${filterType}-${sortBy}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          {showCategories && Object.keys(methodsByType).length > 1
            ? renderByCategory()
            : layout === 'list'
              ? renderList()
              : renderGrid()
          }
        </motion.div>
      </AnimatePresence>

      {/* Footer Info */}
      {availableMethods.length > 0 && (
        <div className="mt-8 pt-6 border-t border-sage/20 text-center text-xs text-sage/50">
          <p>
            All methods are secured with industry-standard encryption. 
            Choose the option that works best for you.
          </p>
          {recommended && (
            <p className="mt-2 text-teal-primary">
              <Star className="w-3 h-3 inline mr-1" />
              We recommend {methodConfigs[recommended]?.name} for the best experience
            </p>
          )}
        </div>
      )}
    </GlassMorphism>
  );
};

// Quick selection component for common use cases
export const QuickProviderSelect: React.FC<{
  onSelect: (method: AuthMethod) => void;
  className?: string;
}> = ({ onSelect, className = '' }) => {
  const quickMethods: AuthMethod[] = ['google', 'apple', 'email', 'magic_link'];

  return (
    <div className={cn('flex flex-wrap gap-2 justify-center', className)}>
      {quickMethods.map(method => {
        const config = methodConfigs[method];
        const IconComponent = config.icon;
        
        return (
          <motion.button
            key={method}
            onClick={() => onSelect(method)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg border',
              'bg-navy-50/5 border-sage/20 text-sage hover:border-sage/40 hover:bg-sage/5',
              'transition-all duration-200 text-sm font-medium'
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {config.type === 'social' ? (
              <SocialLoginIconButton
                provider={method as AuthProvider}
                size="sm"
                onSuccess={() => {}}
                onError={() => {}}
              />
            ) : (
              <IconComponent className="w-4 h-4" />
            )}
            {config.name}
          </motion.button>
        );
      })}
    </div>
  );
};

export default ProviderSelection;