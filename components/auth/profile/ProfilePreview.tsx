'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Globe,
  Calendar,
  Star,
  Eye,
  EyeOff,
  Lock,
  Users,
  Building2,
  Clock,
  Shield,
  Activity,
  MessageSquare,
  ExternalLink,
  Badge,
  Verified,
  Camera,
  Edit3,
  Share2
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { GlassMorphism } from '@/components/GlassMorphism';
import { cn } from '@/lib/utils';
import type { UserProfile } from '../types';

// Preview mode types
type PreviewMode = 'public' | 'business' | 'private' | 'owner';

interface ViewModeConfig {
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
}

const VIEW_MODES: Record<PreviewMode, ViewModeConfig> = {
  public: {
    label: 'Public View',
    description: 'What anyone can see',
    icon: Globe,
    color: 'blue',
  },
  business: {
    label: 'Business View',
    description: 'What business owners see',
    icon: Building2,
    color: 'purple',
  },
  private: {
    label: 'Private View',
    description: 'What only you can see',
    icon: Lock,
    color: 'red',
  },
  owner: {
    label: 'Your View',
    description: 'Your complete profile',
    icon: User,
    color: 'teal',
  },
};

// Mock privacy settings for demonstration
interface PrivacySettings {
  profileVisibility: 'public' | 'business_only' | 'private';
  showEmail: boolean;
  showPhone: boolean;
  showLocation: 'exact' | 'city' | 'region' | 'hidden';
  showActivity: boolean;
  allowDirectMessages: boolean;
}

// Profile visibility checker
const useProfileVisibility = (profile: UserProfile | null, privacySettings: PrivacySettings, viewMode: PreviewMode) => {
  return useMemo(() => {
    if (!profile) return { visible: false, fields: {} };

    const isOwner = viewMode === 'owner';
    const isPrivateView = viewMode === 'private';
    const isBusinessView = viewMode === 'business';
    const isPublicView = viewMode === 'public';

    // Check profile visibility
    let visible = true;
    if (privacySettings.profileVisibility === 'private' && !isOwner) {
      visible = false;
    } else if (privacySettings.profileVisibility === 'business_only' && !isBusinessView && !isOwner) {
      visible = false;
    }

    // Field-level visibility
    const fields = {
      avatar: visible,
      name: visible,
      businessType: visible,
      bio: visible,
      joinDate: visible,
      email: isOwner || privacySettings.showEmail,
      phone: isOwner || privacySettings.showPhone,
      location: visible && privacySettings.showLocation !== 'hidden',
      locationPrecision: privacySettings.showLocation,
      website: visible,
      socialLinks: visible,
      activity: visible && privacySettings.showActivity,
      directMessages: privacySettings.allowDirectMessages,
      verificationStatus: visible,
    };

    return { visible, fields };
  }, [profile, privacySettings, viewMode]);
};

// Social links component
const SocialLinks: React.FC<{
  socialLinks: UserProfile['socialLinks'];
  visible: boolean;
}> = ({ socialLinks, visible }) => {
  if (!visible || !socialLinks) return null;

  const links = [
    { key: 'twitter' as const, icon: '🐦', label: 'Twitter' },
    { key: 'linkedin' as const, icon: '💼', label: 'LinkedIn' },
    { key: 'instagram' as const, icon: '📷', label: 'Instagram' },
    { key: 'facebook' as const, icon: '📘', label: 'Facebook' },
  ].filter(link => socialLinks[link.key]);

  if (links.length === 0) return null;

  return (
    <div className="flex gap-2">
      {links.map(link => (
        <motion.a
          key={link.key}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          href={socialLinks[link.key]}
          target="_blank"
          rel="noopener noreferrer"
          className="w-8 h-8 bg-sage/20 hover:bg-sage/30 rounded-full flex items-center justify-center text-sm transition-colors"
          title={link.label}
        >
          {link.icon}
        </motion.a>
      ))}
    </div>
  );
};

// Activity feed component
const ActivityFeed: React.FC<{
  visible: boolean;
}> = ({ visible }) => {
  if (!visible) {
    return (
      <div className="text-center py-4">
        <Lock className="w-8 h-8 text-sage/40 mx-auto mb-2" />
        <p className="text-sm text-sage/60">Activity is private</p>
      </div>
    );
  }

  const activities = [
    { type: 'review', text: 'Reviewed Coffee Shop A', rating: 4, time: '2 days ago' },
    { type: 'favorite', text: 'Added Bakery B to favorites', time: '1 week ago' },
    { type: 'join', text: 'Joined Local Foodie group', time: '2 weeks ago' },
  ];

  return (
    <div className="space-y-3">
      {activities.map((activity, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="flex items-center gap-3 p-3 bg-navy-50/20 rounded-lg"
        >
          <div className="w-8 h-8 bg-teal-primary/20 rounded-full flex items-center justify-center">
            {activity.type === 'review' && <Star className="w-4 h-4 text-teal-primary" />}
            {activity.type === 'favorite' && <span className="text-gold-primary">❤️</span>}
            {activity.type === 'join' && <Users className="w-4 h-4 text-teal-primary" />}
          </div>
          <div className="flex-1">
            <p className="text-sm text-cream">{activity.text}</p>
            <div className="flex items-center gap-2">
              {activity.rating && (
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'w-3 h-3',
                        i < activity.rating ? 'text-gold-primary fill-current' : 'text-sage/30'
                      )}
                    />
                  ))}
                </div>
              )}
              <span className="text-xs text-sage/60">{activity.time}</span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// Profile stats component
const ProfileStats: React.FC<{
  visible: boolean;
}> = ({ visible }) => {
  if (!visible) return null;

  const stats = [
    { label: 'Reviews', value: 23 },
    { label: 'Favorites', value: 156 },
    { label: 'Check-ins', value: 89 },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="text-center p-3 bg-navy-50/20 rounded-lg"
        >
          <div className="text-xl font-bold text-cream">{stat.value}</div>
          <div className="text-xs text-sage/70">{stat.label}</div>
        </motion.div>
      ))}
    </div>
  );
};

// Business verification badge
const VerificationBadge: React.FC<{
  isVerified: boolean;
  businessType?: string;
}> = ({ isVerified, businessType }) => {
  if (!isVerified) return null;

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="flex items-center gap-1 px-2 py-1 bg-teal-primary/20 text-teal-primary rounded-full text-xs font-medium"
    >
      <Verified className="w-3 h-3" />
      <span>Verified {businessType === 'business_owner' ? 'Business' : 'User'}</span>
    </motion.div>
  );
};

// View mode selector
const ViewModeSelector: React.FC<{
  currentMode: PreviewMode;
  onModeChange: (mode: PreviewMode) => void;
  availableModes: PreviewMode[];
}> = ({ currentMode, onModeChange, availableModes }) => {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {availableModes.map((mode) => {
        const config = VIEW_MODES[mode];
        const Icon = config.icon;
        const isActive = currentMode === mode;

        return (
          <motion.button
            key={mode}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onModeChange(mode)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
              'border focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
              isActive
                ? 'bg-teal-primary/20 border-teal-primary/50 text-teal-primary'
                : 'bg-navy-50/20 border-sage/20 text-sage/70 hover:border-sage/30 hover:text-sage'
            )}
          >
            <Icon className="w-4 h-4" />
            <span>{config.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
};

// Privacy indicator
const PrivacyIndicator: React.FC<{
  field: string;
  visible: boolean;
  reason?: string;
}> = ({ field, visible, reason }) => {
  if (visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="inline-flex items-center gap-1 px-2 py-0.5 bg-sage/20 text-sage/60 rounded text-xs"
      title={reason || `${field} is private`}
    >
      <Lock className="w-3 h-3" />
      <span>Hidden</span>
    </motion.div>
  );
};

// Main profile preview component
export const ProfilePreview: React.FC<{
  className?: string;
  profile?: UserProfile | null;
  initialMode?: PreviewMode;
  showModeSelector?: boolean;
  compact?: boolean;
}> = ({
  className,
  profile: propProfile,
  initialMode = 'public',
  showModeSelector = true,
  compact = false,
}) => {
  const { profile: authProfile } = useAuth();
  const profile = propProfile || authProfile;
  const [viewMode, setViewMode] = useState<PreviewMode>(initialMode);

  // Mock privacy settings - in real app this would come from the profile
  const privacySettings: PrivacySettings = {
    profileVisibility: 'public',
    showEmail: false,
    showPhone: false,
    showLocation: 'city',
    showActivity: true,
    allowDirectMessages: true,
  };

  const { visible, fields } = useProfileVisibility(profile, privacySettings, viewMode);

  // Available view modes
  const availableModes: PreviewMode[] = ['public', 'business', 'private', 'owner'];

  if (!profile) {
    return (
      <GlassMorphism variant="medium" className={cn('p-8 text-center', className)}>
        <User className="w-12 h-12 text-sage/50 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-cream mb-2">No Profile Data</h3>
        <p className="text-sage/70">Profile information is not available</p>
      </GlassMorphism>
    );
  }

  if (!visible) {
    return (
      <GlassMorphism variant="medium" className={cn('p-8 text-center', className)}>
        {showModeSelector && (
          <ViewModeSelector
            currentMode={viewMode}
            onModeChange={setViewMode}
            availableModes={availableModes}
          />
        )}
        
        <Lock className="w-12 h-12 text-sage/50 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-cream mb-2">Private Profile</h3>
        <p className="text-sage/70">
          This profile is not visible to {VIEW_MODES[viewMode].label.toLowerCase()}
        </p>
      </GlassMorphism>
    );
  }

  if (compact) {
    return (
      <GlassMorphism variant="medium" className={cn('p-4', className)}>
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-sage/20 flex items-center justify-center">
              {fields.avatar && profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt={profile.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-8 h-8 text-sage/50" />
              )}
            </div>
            {viewMode === 'owner' && (
              <button className="absolute -bottom-1 -right-1 w-6 h-6 bg-teal-primary hover:bg-teal-secondary text-cream rounded-full flex items-center justify-center transition-colors">
                <Camera className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Basic Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {fields.name ? (
                <h3 className="font-semibold text-cream">{profile.fullName}</h3>
              ) : (
                <span className="text-sage/60">Private User</span>
              )}
              <VerificationBadge
                isVerified={profile.isEmailVerified || false}
                businessType={profile.businessType}
              />
            </div>
            
            {fields.businessType && (
              <p className="text-sm text-sage/70 capitalize mb-2">
                {profile.businessType.replace('_', ' ')}
              </p>
            )}

            <div className="flex items-center gap-4 text-sm text-sage/60">
              {fields.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  <span>
                    {fields.locationPrecision === 'city' && profile.location?.city}
                    {fields.locationPrecision === 'region' && profile.location?.state}
                    {fields.locationPrecision === 'exact' && 
                      `${profile.location?.city}, ${profile.location?.state}`}
                  </span>
                </div>
              )}
              
              {profile.createdAt && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>Joined {new Date(profile.createdAt).getFullYear()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {fields.directMessages && viewMode !== 'owner' && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 bg-teal-primary/20 hover:bg-teal-primary/30 text-teal-primary rounded-lg transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
              </motion.button>
            )}
            
            {viewMode === 'owner' && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 bg-sage/20 hover:bg-sage/30 text-sage/70 hover:text-sage rounded-lg transition-colors"
              >
                <Edit3 className="w-4 h-4" />
              </motion.button>
            )}
          </div>
        </div>
      </GlassMorphism>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {showModeSelector && (
        <ViewModeSelector
          currentMode={viewMode}
          onModeChange={setViewMode}
          availableModes={availableModes}
        />
      )}

      <GlassMorphism variant="medium" className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Header */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-sage/20 flex items-center justify-center">
                  {fields.avatar && profile.avatar ? (
                    <img
                      src={profile.avatar}
                      alt={profile.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-12 h-12 text-sage/50" />
                  )}
                </div>
                {viewMode === 'owner' && (
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="absolute -bottom-2 -right-2 w-8 h-8 bg-teal-primary hover:bg-teal-secondary text-cream rounded-full flex items-center justify-center shadow-lg transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                  </motion.button>
                )}
              </div>

              {/* Basic Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  {fields.name ? (
                    <h2 className="text-2xl font-bold text-cream">{profile.fullName}</h2>
                  ) : (
                    <span className="text-xl text-sage/60">Private User</span>
                  )}
                  <VerificationBadge
                    isVerified={profile.isEmailVerified || false}
                    businessType={profile.businessType}
                  />
                </div>

                {fields.businessType && (
                  <p className="text-lg text-sage/70 capitalize mb-3">
                    {profile.businessType.replace('_', ' ')}
                  </p>
                )}

                {fields.bio && profile.bio && (
                  <p className="text-sage/80 mb-4 leading-relaxed">{profile.bio}</p>
                )}

                {/* Contact Information */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-sage/50" />
                    {fields.email ? (
                      <span className="text-cream">{profile.email}</span>
                    ) : (
                      <PrivacyIndicator field="email" visible={false} />
                    )}
                  </div>

                  {profile.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-sage/50" />
                      {fields.phone ? (
                        <span className="text-cream">{profile.phone}</span>
                      ) : (
                        <PrivacyIndicator field="phone" visible={false} />
                      )}
                    </div>
                  )}

                  {profile.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-sage/50" />
                      {fields.location ? (
                        <span className="text-cream">
                          {fields.locationPrecision === 'city' && profile.location.city}
                          {fields.locationPrecision === 'region' && profile.location.state}
                          {fields.locationPrecision === 'exact' && 
                            `${profile.location.city}, ${profile.location.state}`}
                        </span>
                      ) : (
                        <PrivacyIndicator field="location" visible={false} />
                      )}
                    </div>
                  )}

                  {profile.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-sage/50" />
                      <a
                        href={profile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-primary hover:text-teal-secondary transition-colors flex items-center gap-1"
                      >
                        {profile.website}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {profile.createdAt && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-sage/50" />
                      <span className="text-sage/70">
                        Joined {new Date(profile.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Social Links */}
                <div className="mt-4">
                  <SocialLinks socialLinks={profile.socialLinks} visible={fields.socialLinks} />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-6">
                  {fields.directMessages && viewMode !== 'owner' && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-2 px-4 py-2 bg-teal-primary hover:bg-teal-secondary text-cream rounded-lg transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Send Message
                    </motion.button>
                  )}
                  
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-4 py-2 bg-sage/20 hover:bg-sage/30 text-sage/70 hover:text-sage rounded-lg transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    Share Profile
                  </motion.button>

                  {viewMode === 'owner' && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-2 px-4 py-2 bg-gold-primary/20 hover:bg-gold-primary/30 text-gold-primary rounded-lg transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit Profile
                    </motion.button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Profile Stats */}
            <div>
              <h3 className="font-medium text-cream mb-4">Profile Stats</h3>
              <ProfileStats visible={fields.activity} />
            </div>

            {/* Privacy Status */}
            <div>
              <h3 className="font-medium text-cream mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Privacy Status
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sage/70">Profile</span>
                  <span className="text-teal-primary capitalize">
                    {privacySettings.profileVisibility.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sage/70">Contact Info</span>
                  <span className={privacySettings.showEmail || privacySettings.showPhone ? 'text-gold-primary' : 'text-teal-primary'}>
                    {privacySettings.showEmail || privacySettings.showPhone ? 'Partially Visible' : 'Private'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sage/70">Activity</span>
                  <span className={privacySettings.showActivity ? 'text-gold-primary' : 'text-teal-primary'}>
                    {privacySettings.showActivity ? 'Visible' : 'Private'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="mt-8 pt-8 border-t border-sage/10">
          <h3 className="font-medium text-cream mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Recent Activity
          </h3>
          <ActivityFeed visible={fields.activity} />
        </div>
      </GlassMorphism>
    </div>
  );
};