'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner, ButtonWithLoading } from './LoadingStates';
import type { AuthProvider, SocialLoginButtonProps, SocialProviderConfig } from './types';

// Social provider icons (using SVG for better control)
const GoogleIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const AppleIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
  </svg>
);

const FacebookIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const GithubIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

// Enhanced provider configuration with brand compliance
const providerConfig: Record<AuthProvider, SocialProviderConfig> = {
  google: {
    name: 'Google',
    icon: GoogleIcon,
    bgColor: 'bg-white hover:bg-gray-50',
    textColor: 'text-gray-900',
    borderColor: 'border-gray-200',
    hoverColor: 'hover:bg-gray-50',
    focusRing: 'focus:ring-gray-300',
    brandGuidelines: {
      minimumWidth: 120,
      cornerRadius: 8,
      fontFamily: 'Roboto, -apple-system, sans-serif',
      fontSize: '14px',
      fontWeight: '500'
    }
  },
  apple: {
    name: 'Apple',
    icon: AppleIcon,
    bgColor: 'bg-black hover:bg-gray-900',
    textColor: 'text-white',
    borderColor: 'border-black',
    hoverColor: 'hover:bg-gray-900',
    focusRing: 'focus:ring-gray-500',
    brandGuidelines: {
      minimumWidth: 140,
      cornerRadius: 6,
      fontFamily: 'SF Pro Display, -apple-system, sans-serif',
      fontSize: '16px',
      fontWeight: '600'
    }
  },
  facebook: {
    name: 'Facebook',
    icon: FacebookIcon,
    bgColor: 'bg-[#1877F2] hover:bg-[#166FE5]',
    textColor: 'text-white',
    borderColor: 'border-[#1877F2]',
    hoverColor: 'hover:bg-[#166FE5]',
    focusRing: 'focus:ring-blue-400',
    brandGuidelines: {
      minimumWidth: 120,
      cornerRadius: 6,
      fontFamily: 'Helvetica, Arial, sans-serif',
      fontSize: '14px',
      fontWeight: '600'
    }
  },
  github: {
    name: 'GitHub',
    icon: GithubIcon,
    bgColor: 'bg-gray-900 hover:bg-gray-800',
    textColor: 'text-white',
    borderColor: 'border-gray-900',
    hoverColor: 'hover:bg-gray-800',
    focusRing: 'focus:ring-gray-500',
    brandGuidelines: {
      minimumWidth: 120,
      cornerRadius: 6,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '14px',
      fontWeight: '500'
    }
  }
};

// Main social login button component
export const SocialLoginButton: React.FC<SocialLoginButtonProps> = ({
  provider,
  onSuccess,
  onError,
  className = '',
  disabled = false,
  variant = 'default',
  size = 'md',
  fullWidth = true
}) => {
  const { signInWithProvider, state } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const config = providerConfig[provider];
  const isAuthLoading = state === 'loading';

  const handleSocialLogin = async () => {
    if (disabled || isLoading || isAuthLoading) return;
    
    setIsLoading(true);
    
    try {
      // Track analytics event
      if (typeof window !== 'undefined') {
        window.gtag?.('event', 'social_login_attempt', {
          provider,
          method: 'social_oauth'
        });
      }
      
      const result = await signInWithProvider(provider);
      if (result.error) {
        throw result.error;
      }
      
      if (result.user) {
        await onSuccess?.(result.user);
      }
      
      // Track success
      if (typeof window !== 'undefined') {
        window.gtag?.('event', 'social_login_success', {
          provider,
          user_id: result.user?.id
        });
      }
    } catch (error: any) {
      const authError = {
        message: error.message || `Failed to sign in with ${config.name}`,
        code: error.code || 'social_login_error',
        provider
      };
      
      // Track error
      if (typeof window !== 'undefined') {
        window.gtag?.('event', 'social_login_error', {
          provider,
          error_code: authError.code,
          error_message: authError.message
        });
      }
      
      onError?.(authError);
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-6 py-4 text-lg'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5', 
    lg: 'w-6 h-6'
  };

  // Base button classes
  const baseClasses = cn(
    'flex items-center justify-center gap-3 rounded-lg font-medium transition-all duration-200',
    'border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-navy-dark',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    sizeClasses[size],
    fullWidth ? 'w-full' : 'w-auto'
  );

  // Variant-specific classes
  const getVariantClasses = () => {
    switch (variant) {
      case 'outline':
        return cn(
          'bg-transparent border-2',
          config.textColor === 'text-white' ? 'text-cream border-cream/30 hover:border-cream/50 hover:bg-cream/5' : `${config.textColor} ${config.borderColor} hover:bg-gray-50/5`,
          config.focusRing
        );
      
      case 'ghost':
        return cn(
          'bg-transparent border-none',
          config.textColor === 'text-white' ? 'text-cream hover:bg-cream/5' : `${config.textColor} hover:bg-gray-50/10`,
          config.focusRing
        );
      
      default: // 'default'
        return cn(
          config.bgColor,
          config.textColor,
          config.borderColor,
          config.focusRing,
          !disabled && !isLoading && 'hover:scale-[1.02] active:scale-[0.98]'
        );
    }
  };

  const IconComponent = config.icon;

  return (
    <motion.button
      onClick={handleSocialLogin}
      disabled={disabled || isLoading}
      className={cn(
        baseClasses,
        getVariantClasses(),
        className
      )}
      whileHover={!disabled && !isLoading ? { y: -1 } : {}}
      whileTap={!disabled && !isLoading ? { scale: 0.98 } : {}}
      aria-label={`Sign in with ${config.name}`}
    >
      <div className={cn('flex-shrink-0', iconSizes[size])}>
        {(isLoading || isAuthLoading) ? (
          <LoadingSpinner 
            size={size === 'lg' ? 'md' : 'sm'} 
            className="text-current" 
          />
        ) : (
          <IconComponent className="w-full h-full" />
        )}
      </div>
      
      <span className="truncate">
        {(isLoading || isAuthLoading) ? 'Signing in...' : `Continue with ${config.name}`}
      </span>
    </motion.button>
  );
};

// Social login group component
export const SocialLoginGroup: React.FC<{
  providers: AuthProvider[];
  onSuccess?: (user: any) => void;
  onError?: (error: any) => void;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  layout?: 'vertical' | 'horizontal' | 'grid';
}> = ({
  providers,
  onSuccess,
  onError,
  className = '',
  variant = 'default',
  size = 'md',
  layout = 'vertical'
}) => {
  const layoutClasses = {
    vertical: 'flex flex-col gap-3',
    horizontal: 'flex gap-3',
    grid: providers.length > 2 ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-3'
  };

  return (
    <div className={cn(layoutClasses[layout], className)}>
      {providers.map((provider) => (
        <SocialLoginButton
          key={provider}
          provider={provider}
          variant={variant}
          size={size}
          onSuccess={onSuccess}
          onError={onError}
          fullWidth={layout === 'vertical' || layout === 'grid'}
        />
      ))}
    </div>
  );
};

// Divider component for separating social login from other methods
export const SocialLoginDivider: React.FC<{
  text?: string;
  className?: string;
}> = ({ 
  text = 'Or continue with', 
  className = '' 
}) => (
  <div className={cn('relative my-6', className)}>
    <div className="absolute inset-0 flex items-center">
      <div className="w-full border-t border-sage/20"></div>
    </div>
    <div className="relative flex justify-center text-sm">
      <span className="bg-navy-dark px-4 text-sage/70">
        {text}
      </span>
    </div>
  </div>
);

// Compact social login buttons (icon only)
export const SocialLoginIconButton: React.FC<{
  provider: AuthProvider;
  onSuccess?: (user: any) => void;
  onError?: (error: any) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}> = ({
  provider,
  onSuccess,
  onError,
  className = '',
  size = 'md'
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const config = providerConfig[provider];

  const handleClick = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      // Mock authentication - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockUser = {
        id: 'mock-user-id',
        email: `user@${provider}.com`,
        user_metadata: {
          full_name: `${config.name} User`
        }
      } as any;

      onSuccess?.(mockUser);
    } catch (error) {
      onError?.({ message: `Failed to sign in with ${config.name}`, code: 'social_login_error' });
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const IconComponent = config.icon;

  return (
    <motion.button
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        'flex items-center justify-center rounded-lg border transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-navy-dark',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        config.bgColor,
        config.textColor,
        config.borderColor,
        config.focusRing,
        sizeClasses[size],
        !isLoading && 'hover:scale-105 active:scale-95',
        className
      )}
      whileHover={!isLoading ? { y: -1 } : {}}
      whileTap={!isLoading ? { scale: 0.95 } : {}}
      aria-label={`Sign in with ${config.name}`}
    >
      {isLoading ? (
        <LoadingSpinner size="sm" className="text-current" />
      ) : (
        <IconComponent className={iconSizes[size]} />
      )}
    </motion.button>
  );
};

export default SocialLoginButton;