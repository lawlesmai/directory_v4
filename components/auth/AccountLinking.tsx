'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, Unlink, Shield, CheckCircle, AlertTriangle, Settings, Crown, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '../GlassMorphism';
import { LoadingSpinner } from './LoadingStates';
import { SocialLoginButton, SocialLoginIconButton } from './SocialLoginButton';
import { useAuth } from '@/contexts/AuthContext';
import type { AuthProvider, AuthError, UserProfile } from './types';

// Linked account interface
interface LinkedAccount {
  provider: AuthProvider;
  providerId: string;
  email: string;
  displayName?: string;
  avatar?: string;
  isPrimary: boolean;
  linkedAt: string;
  lastUsed?: string;
  metadata?: {
    username?: string;
    profileUrl?: string;
  };
}

interface AccountLinkingProps {
  user?: UserProfile | null;
  linkedAccounts?: LinkedAccount[];
  onLink?: (provider: AuthProvider) => Promise<void>;
  onUnlink?: (provider: AuthProvider) => Promise<void>;
  onSetPrimary?: (provider: AuthProvider) => Promise<void>;
  onRefresh?: () => Promise<void>;
  className?: string;
  availableProviders?: AuthProvider[];
  showAddAccount?: boolean;
}

interface LinkingState {
  isLinking: AuthProvider | null;
  isUnlinking: AuthProvider | null;
  isSettingPrimary: AuthProvider | null;
  error: AuthError | null;
  confirmUnlink: AuthProvider | null;
}

export const AccountLinking: React.FC<AccountLinkingProps> = ({
  user,
  linkedAccounts = [],
  onLink,
  onUnlink,
  onSetPrimary,
  onRefresh,
  className = '',
  availableProviders = ['google', 'apple', 'facebook', 'github'],
  showAddAccount = true
}) => {
  const { user: currentUser, signInWithProvider } = useAuth();
  const [state, setState] = useState<LinkingState>({
    isLinking: null,
    isUnlinking: null,
    isSettingPrimary: null,
    error: null,
    confirmUnlink: null
  });

  const connectedProviders = linkedAccounts.map(account => account.provider);
  const unconnectedProviders = availableProviders.filter(
    provider => !connectedProviders.includes(provider)
  );

  const handleLink = async (provider: AuthProvider) => {
    if (state.isLinking) return;

    setState(prev => ({ ...prev, isLinking: provider, error: null }));

    try {
      if (onLink) {
        await onLink(provider);
      } else {
        // Default linking behavior
        const result = await signInWithProvider(provider, {
          redirectTo: `/account/link?provider=${provider}`
        });

        if (result.error) {
          throw result.error;
        }
      }

      await onRefresh?.();
      
      // Track success
      if (typeof window !== 'undefined') {
        window.gtag?.('event', 'account_link_success', {
          provider,
          user_id: currentUser?.id
        });
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: {
          message: error.message || `Failed to link ${provider} account`,
          code: error.code || 'link_error',
          provider
        }
      }));

      // Track error
      if (typeof window !== 'undefined') {
        window.gtag?.('event', 'account_link_error', {
          provider,
          error_code: error.code,
          user_id: currentUser?.id
        });
      }
    } finally {
      setState(prev => ({ ...prev, isLinking: null }));
    }
  };

  const handleUnlink = async (provider: AuthProvider) => {
    if (state.isUnlinking) return;

    setState(prev => ({ ...prev, isUnlinking: provider, error: null }));

    try {
      if (onUnlink) {
        await onUnlink(provider);
      } else {
        // Default unlinking behavior
        const response = await fetch('/api/auth/unlink', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to unlink account');
        }
      }

      await onRefresh?.();
      
      // Track success
      if (typeof window !== 'undefined') {
        window.gtag?.('event', 'account_unlink_success', {
          provider,
          user_id: currentUser?.id
        });
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: {
          message: error.message || `Failed to unlink ${provider} account`,
          code: error.code || 'unlink_error',
          provider
        }
      }));
    } finally {
      setState(prev => ({ ...prev, isUnlinking: null, confirmUnlink: null }));
    }
  };

  const handleSetPrimary = async (provider: AuthProvider) => {
    if (state.isSettingPrimary) return;

    setState(prev => ({ ...prev, isSettingPrimary: provider, error: null }));

    try {
      if (onSetPrimary) {
        await onSetPrimary(provider);
      } else {
        // Default set primary behavior
        const response = await fetch('/api/auth/set-primary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to set primary account');
        }
      }

      await onRefresh?.();
      
      // Track success
      if (typeof window !== 'undefined') {
        window.gtag?.('event', 'account_set_primary_success', {
          provider,
          user_id: currentUser?.id
        });
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: {
          message: error.message || `Failed to set ${provider} as primary`,
          code: error.code || 'set_primary_error',
          provider
        }
      }));
    } finally {
      setState(prev => ({ ...prev, isSettingPrimary: null }));
    }
  };

  const getProviderIcon = (provider: AuthProvider) => {
    const iconMap = {
      google: '🟦',
      apple: '🍎',
      facebook: '📘',
      github: '⚫'
    };
    return iconMap[provider] || '🔗';
  };

  const getProviderColor = (provider: AuthProvider) => {
    const colorMap = {
      google: 'from-blue-500 to-red-500',
      apple: 'from-gray-800 to-black',
      facebook: 'from-blue-600 to-blue-700',
      github: 'from-gray-700 to-gray-900'
    };
    return colorMap[provider] || 'from-gray-500 to-gray-600';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const canUnlink = (account: LinkedAccount) => {
    // Can't unlink if it's the only account or if it's the primary and there are others
    if (linkedAccounts.length === 1) return false;
    if (account.isPrimary && linkedAccounts.length > 1) return false;
    return true;
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-cream flex items-center gap-2">
            <Link2 className="w-5 h-5 text-teal-primary" />
            Linked Accounts
          </h3>
          <p className="text-sage/70 text-sm mt-1">
            Manage your connected social accounts and authentication methods
          </p>
        </div>
        
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 text-sage/70 hover:text-sage hover:bg-sage/10 rounded-lg transition-all"
            aria-label="Refresh linked accounts"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Error Alert */}
      <AnimatePresence>
        {state.error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-red-error/10 border border-red-error/20 rounded-lg p-4"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-error flex-shrink-0" />
              <div className="flex-1">
                <p className="text-red-error font-medium">
                  {state.error.message}
                </p>
                {state.error.code && (
                  <p className="text-red-error/70 text-sm mt-1">
                    Error code: {state.error.code}
                  </p>
                )}
              </div>
              <button
                onClick={() => setState(prev => ({ ...prev, error: null }))}
                className="text-red-error/70 hover:text-red-error p-1"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connected Accounts */}
      <GlassMorphism variant="medium" className="p-6">
        <h4 className="text-lg font-semibold text-cream mb-4 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-sage" />
          Connected Accounts ({linkedAccounts.length})
        </h4>

        {linkedAccounts.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-sage/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Link2 className="w-8 h-8 text-sage/50" />
            </div>
            <p className="text-sage/70">No accounts connected yet</p>
            <p className="text-sage/50 text-sm mt-1">
              Link your social accounts for easier sign-in
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {linkedAccounts.map((account) => (
              <motion.div
                key={account.provider}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'flex items-center justify-between p-4 rounded-lg border',
                  account.isPrimary 
                    ? 'bg-teal-primary/10 border-teal-primary/30' 
                    : 'bg-navy-50/5 border-sage/20'
                )}
              >
                <div className="flex items-center gap-4">
                  {/* Provider Icon */}
                  <div className={cn(
                    'w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl',
                    `bg-gradient-to-br ${getProviderColor(account.provider)}`
                  )}>
                    {getProviderIcon(account.provider)}
                  </div>

                  {/* Account Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h5 className="font-medium text-cream capitalize">
                        {account.provider}
                      </h5>
                      {account.isPrimary && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-primary/20 text-teal-primary text-xs rounded-full">
                          <Crown className="w-3 h-3" />
                          Primary
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sage/70 text-sm truncate">
                      {account.email}
                    </p>
                    
                    {account.displayName && (
                      <p className="text-sage/50 text-xs">
                        {account.displayName}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-4 mt-1 text-xs text-sage/50">
                      <span>Linked {formatDate(account.linkedAt)}</span>
                      {account.lastUsed && (
                        <span>Last used {formatDate(account.lastUsed)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {!account.isPrimary && linkedAccounts.length > 1 && (
                    <button
                      onClick={() => handleSetPrimary(account.provider)}
                      disabled={state.isSettingPrimary === account.provider}
                      className={cn(
                        'px-3 py-1.5 text-xs rounded-lg border transition-all',
                        'border-teal-primary/30 text-teal-primary hover:bg-teal-primary/10',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'flex items-center gap-1'
                      )}
                    >
                      {state.isSettingPrimary === account.provider ? (
                        <LoadingSpinner size="sm" className="text-current" />
                      ) : (
                        <Crown className="w-3 h-3" />
                      )}
                      Set Primary
                    </button>
                  )}

                  {canUnlink(account) && (
                    <button
                      onClick={() => setState(prev => ({ 
                        ...prev, 
                        confirmUnlink: account.provider 
                      }))}
                      disabled={state.isUnlinking === account.provider}
                      className={cn(
                        'px-3 py-1.5 text-xs rounded-lg border transition-all',
                        'border-red-error/30 text-red-error hover:bg-red-error/10',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'flex items-center gap-1'
                      )}
                    >
                      {state.isUnlinking === account.provider ? (
                        <LoadingSpinner size="sm" className="text-current" />
                      ) : (
                        <Unlink className="w-3 h-3" />
                      )}
                      Unlink
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </GlassMorphism>

      {/* Add Account Section */}
      {showAddAccount && unconnectedProviders.length > 0 && (
        <GlassMorphism variant="medium" className="p-6">
          <h4 className="text-lg font-semibold text-cream mb-4">
            Add Account
          </h4>
          
          <p className="text-sage/70 text-sm mb-6">
            Link additional accounts to make signing in easier and more secure.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {unconnectedProviders.map((provider) => (
              <SocialLoginButton
                key={provider}
                provider={provider}
                variant="outline"
                size="md"
                disabled={state.isLinking === provider}
                onSuccess={() => handleLink(provider)}
                onError={(error) => setState(prev => ({ ...prev, error }))}
                className="justify-start"
              />
            ))}
          </div>

          <div className="mt-4 p-4 bg-teal-primary/5 border border-teal-primary/20 rounded-lg">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-teal-primary flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="font-medium text-teal-primary mb-1">
                  Security Note
                </h5>
                <p className="text-sage/70 text-sm">
                  Linking multiple accounts provides backup authentication methods and 
                  helps keep your account secure. You can always unlink accounts later.
                </p>
              </div>
            </div>
          </div>
        </GlassMorphism>
      )}

      {/* Unlink Confirmation Modal */}
      <AnimatePresence>
        {state.confirmUnlink && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-navy-dark/80 backdrop-blur-sm p-4"
            onClick={() => setState(prev => ({ ...prev, confirmUnlink: null }))}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <GlassMorphism variant="strong" className="p-6">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-red-error/20 rounded-full flex items-center justify-center mx-auto">
                    <Unlink className="w-8 h-8 text-red-error" />
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-bold text-cream mb-2">
                      Unlink Account?
                    </h3>
                    <p className="text-sage/70">
                      Are you sure you want to unlink your {state.confirmUnlink} account? 
                      You won't be able to sign in using this account anymore.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setState(prev => ({ ...prev, confirmUnlink: null }))}
                      className={cn(
                        'flex-1 px-4 py-2 rounded-lg border border-sage/30',
                        'text-sage hover:bg-sage/10 transition-colors'
                      )}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleUnlink(state.confirmUnlink!)}
                      disabled={state.isUnlinking === state.confirmUnlink}
                      className={cn(
                        'flex-1 px-4 py-2 rounded-lg',
                        'bg-red-error text-white hover:bg-red-error/90',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'transition-colors'
                      )}
                    >
                      {state.isUnlinking === state.confirmUnlink ? (
                        <LoadingSpinner size="sm" className="text-current mx-auto" />
                      ) : (
                        'Unlink Account'
                      )}
                    </button>
                  </div>
                </div>
              </GlassMorphism>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Compact account linking widget for settings pages
export const AccountLinkingWidget: React.FC<{
  linkedAccounts: LinkedAccount[];
  onManage: () => void;
  className?: string;
}> = ({ linkedAccounts, onManage, className = '' }) => {
  return (
    <GlassMorphism variant="subtle" className={cn('p-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link2 className="w-5 h-5 text-teal-primary" />
          <div>
            <h4 className="font-medium text-cream">Linked Accounts</h4>
            <p className="text-sage/70 text-sm">
              {linkedAccounts.length} account{linkedAccounts.length !== 1 ? 's' : ''} connected
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Account icons */}
          <div className="flex -space-x-2">
            {linkedAccounts.slice(0, 3).map((account) => (
              <div
                key={account.provider}
                className={cn(
                  'w-8 h-8 rounded-full border-2 border-navy-dark',
                  'flex items-center justify-center text-xs text-white',
                  `bg-gradient-to-br ${getProviderColor(account.provider)}`
                )}
              >
                {getProviderIcon(account.provider)}
              </div>
            ))}
            {linkedAccounts.length > 3 && (
              <div className="w-8 h-8 rounded-full border-2 border-navy-dark bg-sage/20 flex items-center justify-center text-xs text-sage">
                +{linkedAccounts.length - 3}
              </div>
            )}
          </div>

          <button
            onClick={onManage}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg',
              'text-teal-primary border border-teal-primary/30',
              'hover:bg-teal-primary/10 transition-colors'
            )}
          >
            Manage
          </button>
        </div>
      </div>
    </GlassMorphism>
  );
};

// Helper function to get provider color (used in widget)
const getProviderColor = (provider: AuthProvider) => {
  const colorMap = {
    google: 'from-blue-500 to-red-500',
    apple: 'from-gray-800 to-black',
    facebook: 'from-blue-600 to-blue-700',
    github: 'from-gray-700 to-gray-900'
  };
  return colorMap[provider] || 'from-gray-500 to-gray-600';
};

// Helper function to get provider icon (used in widget)
const getProviderIcon = (provider: AuthProvider) => {
  const iconMap = {
    google: '🟦',
    apple: '🍎',
    facebook: '📘',
    github: '⚫'
  };
  return iconMap[provider] || '🔗';
};

export default AccountLinking;