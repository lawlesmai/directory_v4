'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Mail, 
  Image as ImageIcon, 
  MapPin, 
  Phone, 
  Globe, 
  Shield, 
  Eye, 
  EyeOff,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Download,
  Upload
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '../GlassMorphism';
import { LoadingSpinner } from './LoadingStates';
import { useAuth } from '@/contexts/AuthContext';
import type { AuthProvider, UserProfile } from './types';

// Social profile data interface
interface SocialProfileData {
  provider: AuthProvider;
  id: string;
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  phone?: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  bio?: string;
  website?: string;
  username?: string;
  verified?: boolean;
  lastUpdated?: string;
  profileUrl?: string;
}

// Sync settings interface
interface SyncSettings {
  syncName: boolean;
  syncEmail: boolean;
  syncAvatar: boolean;
  syncPhone: boolean;
  syncLocation: boolean;
  syncBio: boolean;
  syncWebsite: boolean;
  autoSync: boolean;
  overwriteExisting: boolean;
}

interface SocialProfileSyncProps {
  socialProfile: SocialProfileData;
  currentProfile?: UserProfile;
  onSync?: (data: Partial<UserProfile>, settings: SyncSettings) => Promise<void>;
  onPreview?: (data: Partial<UserProfile>) => void;
  onCancel?: () => void;
  className?: string;
  showPrivacyControls?: boolean;
  allowAutoSync?: boolean;
}

interface SyncState {
  isLoading: boolean;
  isPreviewMode: boolean;
  syncedFields: Set<string>;
  error: string | null;
  success: boolean;
}

export const SocialProfileSync: React.FC<SocialProfileSyncProps> = ({
  socialProfile,
  currentProfile,
  onSync,
  onPreview,
  onCancel,
  className = '',
  showPrivacyControls = true,
  allowAutoSync = true
}) => {
  const { user, updateProfile } = useAuth();
  
  const [syncSettings, setSyncSettings] = useState<SyncSettings>({
    syncName: true,
    syncEmail: false, // Email usually shouldn't be overwritten
    syncAvatar: true,
    syncPhone: false,
    syncLocation: true,
    syncBio: true,
    syncWebsite: true,
    autoSync: false,
    overwriteExisting: false
  });

  const [state, setState] = useState<SyncState>({
    isLoading: false,
    isPreviewMode: false,
    syncedFields: new Set(),
    error: null,
    success: false
  });

  const [previewProfile, setPreviewProfile] = useState<Partial<UserProfile> | null>(null);

  // Generate preview data based on sync settings
  const generatePreviewData = useCallback((): Partial<UserProfile> => {
    const previewData: Partial<UserProfile> = {};

    if (syncSettings.syncName && socialProfile.name) {
      previewData.fullName = socialProfile.name;
      previewData.firstName = socialProfile.firstName || socialProfile.name.split(' ')[0] || '';
      previewData.lastName = socialProfile.lastName || socialProfile.name.split(' ').slice(1).join(' ') || '';
    }

    if (syncSettings.syncEmail && socialProfile.email) {
      previewData.email = socialProfile.email;
    }

    if (syncSettings.syncAvatar && socialProfile.avatar) {
      previewData.avatar = socialProfile.avatar;
    }

    if (syncSettings.syncPhone && socialProfile.phone) {
      previewData.phone = socialProfile.phone;
    }

    if (syncSettings.syncLocation && socialProfile.location && socialProfile.location.country) {
      previewData.location = {
        city: socialProfile.location.city,
        state: socialProfile.location.state,
        country: socialProfile.location.country
      };
    }

    return previewData;
  }, [socialProfile, syncSettings]);

  // Update preview when settings change
  useEffect(() => {
    const preview = generatePreviewData();
    setPreviewProfile(preview);
    onPreview?.(preview);
  }, [generatePreviewData, onPreview]);

  const handleSyncSettingChange = (setting: keyof SyncSettings, value: boolean) => {
    setSyncSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  const handleSync = async () => {
    if (!previewProfile) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      if (onSync) {
        await onSync(previewProfile, syncSettings);
      } else {
        // Default sync behavior
        await updateProfile(previewProfile);
      }

      setState(prev => ({ 
        ...prev, 
        success: true,
        syncedFields: new Set(Object.keys(previewProfile))
      }));

      // Track success
      if (typeof window !== 'undefined') {
        window.gtag?.('event', 'social_profile_sync_success', {
          provider: socialProfile.provider,
          fields_synced: Object.keys(previewProfile).length,
          user_id: user?.id
        });
      }

      // Auto-close after success
      setTimeout(() => {
        onCancel?.();
      }, 2000);

    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to sync profile data'
      }));

      // Track error
      if (typeof window !== 'undefined') {
        window.gtag?.('event', 'social_profile_sync_error', {
          provider: socialProfile.provider,
          error_message: error.message,
          user_id: user?.id
        });
      }
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const getProviderName = () => {
    return socialProfile.provider.charAt(0).toUpperCase() + socialProfile.provider.slice(1);
  };

  const getProviderIcon = () => {
    const iconMap = {
      google: '🟦',
      apple: '🍎',
      facebook: '📘',
      github: '⚫'
    };
    return iconMap[socialProfile.provider] || '🔗';
  };

  const hasConflicts = (field: keyof UserProfile): boolean => {
    if (!currentProfile || !previewProfile) return false;
    return currentProfile[field] !== undefined && 
           currentProfile[field] !== previewProfile[field] &&
           !syncSettings.overwriteExisting;
  };

  const renderFieldComparison = (
    field: keyof UserProfile,
    label: string,
    icon: React.ReactNode,
    currentValue?: string,
    newValue?: string
  ) => {
    const hasConflict = hasConflicts(field);
    const isEmpty = !currentValue;
    
    return (
      <div className={cn(
        'p-4 rounded-lg border transition-all',
        hasConflict ? 'bg-yellow-500/5 border-yellow-500/30' : 'bg-navy-50/5 border-sage/20',
        isEmpty && 'bg-teal-primary/5 border-teal-primary/30'
      )}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1 text-sage/70">
            {icon}
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-cream mb-2 flex items-center gap-2">
              {label}
              {hasConflict && (
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
              )}
              {isEmpty && (
                <span className="text-xs bg-teal-primary/20 text-teal-primary px-2 py-0.5 rounded">
                  New
                </span>
              )}
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Current Value */}
              <div>
                <p className="text-xs font-medium text-sage/70 uppercase tracking-wide mb-1">
                  Current
                </p>
                <p className="text-sm text-sage/90 bg-navy-dark/30 p-2 rounded">
                  {currentValue || <span className="italic text-sage/50">Not set</span>}
                </p>
              </div>
              
              {/* New Value */}
              <div>
                <p className="text-xs font-medium text-teal-primary uppercase tracking-wide mb-1">
                  From {getProviderName()}
                </p>
                <p className="text-sm text-cream bg-teal-primary/10 p-2 rounded">
                  {newValue || <span className="italic text-sage/50">No data</span>}
                </p>
              </div>
            </div>
            
            {hasConflict && (
              <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded text-sm">
                <div className="flex items-center gap-2 text-yellow-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">Conflict detected</span>
                </div>
                <p className="text-yellow-700 mt-1">
                  Enable "Overwrite existing data" to replace the current value.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (state.success) {
    return (
      <GlassMorphism variant="medium" className={cn('p-8 text-center', className)}>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-4"
        >
          <div className="w-16 h-16 bg-sage/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-sage" />
          </div>
          
          <div>
            <h3 className="text-xl font-bold text-cream mb-2">
              Profile Synced!
            </h3>
            <p className="text-sage/70">
              Your profile has been updated with data from {getProviderName()}.
            </p>
            <p className="text-sage/50 text-sm mt-2">
              {state.syncedFields.size} field{state.syncedFields.size !== 1 ? 's' : ''} updated
            </p>
          </div>
        </motion.div>
      </GlassMorphism>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-red-500 rounded-lg flex items-center justify-center text-white text-xl">
            {getProviderIcon()}
          </div>
          <div>
            <h3 className="text-xl font-bold text-cream">
              Sync Profile Data
            </h3>
            <p className="text-sage/70">
              Import information from your {getProviderName()} account
            </p>
          </div>
        </div>
        
        {socialProfile.profileUrl && (
          <a
            href={socialProfile.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sage/70 hover:text-sage p-2 hover:bg-sage/10 rounded-lg transition-all"
          >
            <Globe className="w-4 h-4" />
          </a>
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
              <p className="text-red-error">{state.error}</p>
              <button
                onClick={() => setState(prev => ({ ...prev, error: null }))}
                className="text-red-error/70 hover:text-red-error p-1 ml-auto"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Privacy Controls */}
      {showPrivacyControls && (
        <GlassMorphism variant="subtle" className="p-6">
          <h4 className="text-lg font-semibold text-cream mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-teal-primary" />
            Privacy Settings
          </h4>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Sync Controls */}
              {[
                { key: 'syncName' as keyof SyncSettings, label: 'Name', available: !!socialProfile.name },
                { key: 'syncEmail' as keyof SyncSettings, label: 'Email', available: !!socialProfile.email },
                { key: 'syncAvatar' as keyof SyncSettings, label: 'Profile Picture', available: !!socialProfile.avatar },
                { key: 'syncPhone' as keyof SyncSettings, label: 'Phone Number', available: !!socialProfile.phone },
                { key: 'syncLocation' as keyof SyncSettings, label: 'Location', available: !!socialProfile.location },
                { key: 'syncBio' as keyof SyncSettings, label: 'Bio', available: !!socialProfile.bio },
                { key: 'syncWebsite' as keyof SyncSettings, label: 'Website', available: !!socialProfile.website }
              ].filter(item => item.available).map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-sage/5 cursor-pointer"
                >
                  <span className="text-sage/90">{item.label}</span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={syncSettings[item.key] as boolean}
                      onChange={(e) => handleSyncSettingChange(item.key, e.target.checked)}
                      className="sr-only"
                    />
                    <div className={cn(
                      'w-5 h-5 rounded border-2 transition-all',
                      syncSettings[item.key] 
                        ? 'bg-teal-primary border-teal-primary' 
                        : 'border-sage/30 hover:border-sage/50'
                    )}>
                      {syncSettings[item.key] && (
                        <CheckCircle className="w-3 h-3 text-white m-0.5" />
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {/* Additional Settings */}
            <div className="pt-4 border-t border-sage/20 space-y-3">
              <label className="flex items-center justify-between p-3 rounded-lg hover:bg-sage/5 cursor-pointer">
                <div>
                  <span className="text-sage/90">Overwrite existing data</span>
                  <p className="text-xs text-sage/60 mt-1">Replace current profile information even if it exists</p>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={syncSettings.overwriteExisting}
                    onChange={(e) => handleSyncSettingChange('overwriteExisting', e.target.checked)}
                    className="sr-only"
                  />
                  <div className={cn(
                    'w-5 h-5 rounded border-2 transition-all',
                    syncSettings.overwriteExisting 
                      ? 'bg-yellow-500 border-yellow-500' 
                      : 'border-sage/30 hover:border-sage/50'
                  )}>
                    {syncSettings.overwriteExisting && (
                      <CheckCircle className="w-3 h-3 text-white m-0.5" />
                    )}
                  </div>
                </div>
              </label>

              {allowAutoSync && (
                <label className="flex items-center justify-between p-3 rounded-lg hover:bg-sage/5 cursor-pointer">
                  <div>
                    <span className="text-sage/90">Auto-sync in future</span>
                    <p className="text-xs text-sage/60 mt-1">Automatically update profile when signing in with {getProviderName()}</p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={syncSettings.autoSync}
                      onChange={(e) => handleSyncSettingChange('autoSync', e.target.checked)}
                      className="sr-only"
                    />
                    <div className={cn(
                      'w-5 h-5 rounded border-2 transition-all',
                      syncSettings.autoSync 
                        ? 'bg-teal-primary border-teal-primary' 
                        : 'border-sage/30 hover:border-sage/50'
                    )}>
                      {syncSettings.autoSync && (
                        <CheckCircle className="w-3 h-3 text-white m-0.5" />
                      )}
                    </div>
                  </div>
                </label>
              )}
            </div>
          </div>
        </GlassMorphism>
      )}

      {/* Data Preview */}
      <GlassMorphism variant="medium" className="p-6">
        <h4 className="text-lg font-semibold text-cream mb-4 flex items-center gap-2">
          <Download className="w-5 h-5 text-teal-primary" />
          Data Preview
        </h4>
        
        <div className="space-y-4">
          {socialProfile.name && syncSettings.syncName && (
            renderFieldComparison(
              'fullName',
              'Full Name',
              <User className="w-4 h-4" />,
              currentProfile?.fullName,
              socialProfile.name
            )
          )}

          {socialProfile.email && syncSettings.syncEmail && (
            renderFieldComparison(
              'email',
              'Email Address',
              <Mail className="w-4 h-4" />,
              currentProfile?.email,
              socialProfile.email
            )
          )}

          {socialProfile.avatar && syncSettings.syncAvatar && (
            <div className="p-4 rounded-lg border bg-navy-50/5 border-sage/20">
              <div className="flex items-start gap-3">
                <ImageIcon className="w-4 h-4 text-sage/70 mt-1" />
                <div className="flex-1">
                  <h4 className="font-medium text-cream mb-3">Profile Picture</h4>
                  <div className="flex items-center gap-4">
                    {currentProfile?.avatar && (
                      <div className="text-center">
                        <div className="w-16 h-16 rounded-full overflow-hidden mb-2">
                          <img 
                            src={currentProfile.avatar} 
                            alt="Current avatar"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <p className="text-xs text-sage/70">Current</p>
                      </div>
                    )}
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full overflow-hidden mb-2">
                        <img 
                          src={socialProfile.avatar} 
                          alt="New avatar"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-xs text-teal-primary">From {getProviderName()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {socialProfile.location && syncSettings.syncLocation && (
            renderFieldComparison(
              'location',
              'Location',
              <MapPin className="w-4 h-4" />,
              currentProfile?.location ? 
                `${currentProfile.location.city || ''} ${currentProfile.location.state || ''} ${currentProfile.location.country || ''}`.trim() : 
                undefined,
              `${socialProfile.location.city || ''} ${socialProfile.location.state || ''} ${socialProfile.location.country || ''}`.trim()
            )
          )}
        </div>
      </GlassMorphism>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={onCancel}
          disabled={state.isLoading}
          className={cn(
            'flex-1 px-6 py-3 rounded-lg font-medium transition-all duration-200',
            'bg-transparent border border-sage/30 text-sage',
            'hover:bg-sage/10 hover:border-sage/50',
            'focus:outline-none focus:ring-2 focus:ring-sage/50 focus:ring-offset-2 focus:ring-offset-navy-dark',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          Cancel
        </button>

        <button
          onClick={handleSync}
          disabled={state.isLoading || !previewProfile || Object.keys(previewProfile).length === 0}
          className={cn(
            'flex-1 px-6 py-3 rounded-lg font-medium transition-all duration-200',
            'bg-gradient-to-r from-teal-primary to-teal-secondary text-cream',
            'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
            'focus:outline-none focus:ring-2 focus:ring-teal-primary/50 focus:ring-offset-2 focus:ring-offset-navy-dark',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
            'flex items-center justify-center gap-2'
          )}
        >
          {state.isLoading ? (
            <>
              <LoadingSpinner size="sm" className="text-current" />
              Syncing...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Sync Profile
            </>
          )}
        </button>
      </div>

      {/* Data Source Info */}
      <div className="text-center text-xs text-sage/50">
        <p>
          Data from {getProviderName()} • Last updated{' '}
          {socialProfile.lastUpdated ? 
            new Date(socialProfile.lastUpdated).toLocaleDateString() : 
            'recently'
          }
        </p>
        {socialProfile.verified && (
          <p className="mt-1 flex items-center justify-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Verified {getProviderName()} account
          </p>
        )}
      </div>
    </div>
  );
};

export default SocialProfileSync;