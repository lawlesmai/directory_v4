'use client';

import React, { useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Eye,
  EyeOff,
  Lock,
  Globe,
  Users,
  MapPin,
  Mail,
  Phone,
  Activity,
  Search,
  Info,
  AlertTriangle,
  Check,
  ExternalLink,
  Download,
  Trash2,
  Settings,
  ChevronDown,
  ChevronUp,
  HelpCircle
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { GlassMorphism } from '@/components/GlassMorphism';
import { cn } from '@/lib/utils';

// Privacy settings schema
const privacySchema = z.object({
  profileVisibility: z.enum(['public', 'business_only', 'private']),
  showEmail: z.boolean(),
  showPhone: z.boolean(),
  showLocation: z.enum(['exact', 'city', 'region', 'hidden']),
  showActivity: z.boolean(),
  searchable: z.boolean(),
  allowDirectMessages: z.boolean(),
  allowBusinessContact: z.boolean(),
  dataSharing: z.object({
    analytics: z.boolean(),
    personalization: z.boolean(),
    marketing: z.boolean(),
    thirdParty: z.boolean(),
  }),
  cookiePreferences: z.object({
    necessary: z.boolean(),
    functional: z.boolean(),
    analytics: z.boolean(),
    marketing: z.boolean(),
  }),
});

type PrivacyFormData = z.infer<typeof privacySchema>;

// Privacy level indicator
const PrivacyLevelIndicator: React.FC<{
  level: 'low' | 'medium' | 'high';
  className?: string;
}> = ({ level, className }) => {
  const levelConfig = {
    low: {
      color: 'text-red-error',
      bg: 'bg-red-error/20',
      border: 'border-red-error/30',
      label: 'Low Privacy',
      bars: [true, false, false],
    },
    medium: {
      color: 'text-gold-primary',
      bg: 'bg-gold-primary/20',
      border: 'border-gold-primary/30',
      label: 'Medium Privacy',
      bars: [true, true, false],
    },
    high: {
      color: 'text-teal-primary',
      bg: 'bg-teal-primary/20',
      border: 'border-teal-primary/30',
      label: 'High Privacy',
      bars: [true, true, true],
    },
  };

  const config = levelConfig[level];

  return (
    <div className={cn('flex items-center gap-3 p-3 rounded-lg border', config.bg, config.border, className)}>
      <div className="flex gap-1">
        {config.bars.map((active, index) => (
          <div
            key={index}
            className={cn(
              'w-1 h-4 rounded-full',
              active ? config.color.replace('text-', 'bg-') : 'bg-sage/20'
            )}
          />
        ))}
      </div>
      <span className={cn('text-sm font-medium', config.color)}>
        {config.label}
      </span>
    </div>
  );
};

// Privacy explanation component
const PrivacyExplanation: React.FC<{
  setting: string;
  value: any;
  className?: string;
}> = ({ setting, value, className }) => {
  const explanations: Record<string, Record<string, { text: string; impact: 'positive' | 'neutral' | 'warning' }>} = {
    profileVisibility: {
      public: { text: 'Anyone can view your profile and basic information', impact: 'warning' },
      business_only: { text: 'Only verified business owners can see your profile', impact: 'neutral' },
      private: { text: 'Only you can see your profile information', impact: 'positive' },
    },
    showEmail: {
      true: { text: 'Your email address will be visible to others', impact: 'warning' },
      false: { text: 'Your email address is kept private', impact: 'positive' },
    },
    showPhone: {
      true: { text: 'Your phone number will be visible to others', impact: 'warning' },
      false: { text: 'Your phone number is kept private', impact: 'positive' },
    },
    showLocation: {
      exact: { text: 'Your exact location is shown to others', impact: 'warning' },
      city: { text: 'Only your city is visible to others', impact: 'neutral' },
      region: { text: 'Only your general region is visible', impact: 'neutral' },
      hidden: { text: 'Your location is completely hidden', impact: 'positive' },
    },
    allowDirectMessages: {
      true: { text: 'Anyone can send you direct messages', impact: 'neutral' },
      false: { text: 'Direct messages are disabled', impact: 'positive' },
    },
  };

  const explanation = explanations[setting]?.[String(value)];
  if (!explanation) return null;

  const impactColors = {
    positive: 'text-teal-primary',
    neutral: 'text-sage/70',
    warning: 'text-gold-primary',
  };

  return (
    <motion.p
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={cn('text-sm flex items-start gap-2 mt-2', impactColors[explanation.impact], className)}
    >
      <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
      {explanation.text}
    </motion.p>
  );
};

// Toggle with explanation
const PrivacyToggle: React.FC<{
  label: string;
  description: string;
  icon?: React.ComponentType<any>;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  warning?: string;
  settingKey?: string;
}> = ({
  label,
  description,
  icon: Icon,
  checked,
  onChange,
  disabled = false,
  warning,
  settingKey,
}) => {
  const [showExplanation, setShowExplanation] = useState(false);

  return (
    <div className="py-4 border-b border-sage/10 last:border-0">
      <div className="flex items-start justify-between">
        <div className="flex-1 pr-4">
          <div className="flex items-center gap-2 mb-1">
            {Icon && <Icon className="w-4 h-4 text-sage/70" />}
            <span className="font-medium text-cream">{label}</span>
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="p-1 text-sage/50 hover:text-sage/70 transition-colors"
            >
              <HelpCircle className="w-3 h-3" />
            </button>
          </div>
          <p className="text-sm text-sage/70">{description}</p>
          
          {warning && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-sm text-gold-primary mt-2"
            >
              <AlertTriangle className="w-3 h-3" />
              {warning}
            </motion.div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-sm text-sage/60">
            {checked ? 'On' : 'Off'}
          </span>
          <motion.button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => !disabled && onChange(!checked)}
            className={cn(
              'relative inline-flex items-center w-12 h-6 rounded-full transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
              checked ? 'bg-teal-primary' : 'bg-sage/20',
              disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            )}
            whileTap={{ scale: disabled ? 1 : 0.95 }}
          >
            <motion.span
              className="inline-block w-5 h-5 bg-cream rounded-full shadow-sm"
              animate={{ x: checked ? 24 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {showExplanation && settingKey && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 p-3 bg-navy-50/20 rounded-lg border border-sage/10"
          >
            <PrivacyExplanation setting={settingKey} value={checked} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Radio group component
const PrivacyRadioGroup: React.FC<{
  label: string;
  description: string;
  options: Array<{ value: string; label: string; description: string; icon?: React.ComponentType<any> }>;
  value: string;
  onChange: (value: string) => void;
  settingKey?: string;
}> = ({ label, description, options, value, onChange, settingKey }) => {
  const [showExplanations, setShowExplanations] = useState(false);

  return (
    <div className="py-6 border-b border-sage/10 last:border-0">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-cream">{label}</h4>
            <button
              onClick={() => setShowExplanations(!showExplanations)}
              className="p-1 text-sage/50 hover:text-sage/70 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-sage/70">{description}</p>
        </div>
      </div>

      <div className="space-y-3">
        {options.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.value;

          return (
            <div key={option.value}>
              <motion.label
                whileHover={{ scale: 1.01 }}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                  isSelected
                    ? 'border-teal-primary/50 bg-teal-primary/10'
                    : 'border-sage/20 hover:border-sage/30 hover:bg-navy-50/20'
                )}
              >
                <input
                  type="radio"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => onChange(option.value)}
                  className="sr-only"
                />
                <div className={cn(
                  'w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5',
                  isSelected ? 'border-teal-primary bg-teal-primary' : 'border-sage/30'
                )}>
                  {isSelected && (
                    <div className="w-2 h-2 bg-cream rounded-full" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {Icon && <Icon className="w-4 h-4 text-sage/70" />}
                    <span className="font-medium text-cream">{option.label}</span>
                  </div>
                  <p className="text-sm text-sage/70">{option.description}</p>
                </div>
              </motion.label>

              <AnimatePresence>
                {showExplanations && isSelected && settingKey && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="ml-7 mt-2 p-2 bg-navy-50/20 rounded border border-sage/10"
                  >
                    <PrivacyExplanation setting={settingKey} value={option.value} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Profile preview component
const ProfilePreview: React.FC<{
  settings: PrivacyFormData;
  className?: string;
}> = ({ settings, className }) => {
  const { profile } = useAuth();

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'public': return Globe;
      case 'business_only': return Users;
      case 'private': return Lock;
      default: return Eye;
    }
  };

  const VisibilityIcon = getVisibilityIcon(settings.profileVisibility);

  return (
    <GlassMorphism variant="medium" className={cn('p-6', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-heading text-cream">Profile Preview</h3>
        <div className="flex items-center gap-2 text-sm text-sage/70">
          <VisibilityIcon className="w-4 h-4" />
          <span className="capitalize">{settings.profileVisibility.replace('_', ' ')}</span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Profile header */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-teal-primary/20 rounded-full flex items-center justify-center">
            <span className="text-xl font-bold text-teal-primary">
              {profile?.firstName?.[0] || 'U'}
            </span>
          </div>
          <div>
            <h4 className="font-semibold text-cream">
              {profile?.fullName || 'Your Name'}
            </h4>
            <p className="text-sm text-sage/70 capitalize">
              {profile?.businessType?.replace('_', ' ') || 'Customer'}
            </p>
          </div>
        </div>

        {/* Contact information */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-sage/50" />
            <span className={cn(
              settings.showEmail ? 'text-cream' : 'text-sage/40 line-through'
            )}>
              {settings.showEmail ? (profile?.email || 'your@email.com') : 'Hidden'}
            </span>
            {!settings.showEmail && <Lock className="w-3 h-3 text-sage/40" />}
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-sage/50" />
            <span className={cn(
              settings.showPhone ? 'text-cream' : 'text-sage/40 line-through'
            )}>
              {settings.showPhone ? (profile?.phone || '+1 (555) 000-0000') : 'Hidden'}
            </span>
            {!settings.showPhone && <Lock className="w-3 h-3 text-sage/40" />}
          </div>

          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-sage/50" />
            <span className="text-cream">
              {settings.showLocation === 'hidden' ? 'Hidden' :
               settings.showLocation === 'exact' ? 'San Francisco, CA 94102' :
               settings.showLocation === 'city' ? 'San Francisco, CA' :
               'California, USA'}
            </span>
            {settings.showLocation === 'hidden' && <Lock className="w-3 h-3 text-sage/40" />}
          </div>
        </div>

        {/* Activity section */}
        <div className="pt-4 border-t border-sage/10">
          <div className="flex items-center gap-2 text-sm text-sage/70 mb-2">
            <Activity className="w-4 h-4" />
            <span>Recent Activity</span>
          </div>
          {settings.showActivity ? (
            <div className="space-y-1 text-sm text-sage/60">
              <p>• Reviewed Coffee Shop A - 4 stars</p>
              <p>• Added Bakery B to favorites</p>
              <p>• Joined Local Foodie group</p>
            </div>
          ) : (
            <p className="text-sm text-sage/40">Activity is private</p>
          )}
        </div>
      </div>
    </GlassMorphism>
  );
};

// Main privacy controls component
export const PrivacyControls: React.FC<{
  className?: string;
  onSave?: (privacy: PrivacyFormData) => Promise<void>;
}> = ({ className, onSave }) => {
  const { profile, updateProfile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const form = useForm<PrivacyFormData>({
    resolver: zodResolver(privacySchema),
    mode: 'onChange',
    defaultValues: {
      profileVisibility: 'public',
      showEmail: false,
      showPhone: false,
      showLocation: 'city',
      showActivity: true,
      searchable: true,
      allowDirectMessages: true,
      allowBusinessContact: true,
      dataSharing: {
        analytics: true,
        personalization: true,
        marketing: false,
        thirdParty: false,
      },
      cookiePreferences: {
        necessary: true,
        functional: true,
        analytics: true,
        marketing: false,
      },
    },
  });

  const {
    control,
    handleSubmit,
    formState: { isDirty },
    watch,
    setValue,
    reset,
  } = form;

  const settings = watch();

  // Calculate privacy level
  const privacyLevel = (() => {
    let score = 0;
    if (settings.profileVisibility === 'private') score += 3;
    else if (settings.profileVisibility === 'business_only') score += 2;
    else score += 1;

    if (!settings.showEmail) score += 1;
    if (!settings.showPhone) score += 1;
    if (settings.showLocation === 'hidden') score += 2;
    else if (settings.showLocation === 'region') score += 1;
    
    if (!settings.showActivity) score += 1;
    if (!settings.allowDirectMessages) score += 1;
    if (!settings.dataSharing.thirdParty) score += 1;

    if (score >= 8) return 'high';
    if (score >= 5) return 'medium';
    return 'low';
  })();

  const onSubmit = useCallback(async (data: PrivacyFormData) => {
    setIsSaving(true);
    
    try {
      if (onSave) {
        await onSave(data);
      } else {
        // Update profile with privacy settings
        await updateProfile({
          preferences: {
            ...profile?.preferences,
            privacy: {
              profileVisible: data.profileVisibility === 'public',
              allowDirectMessages: data.allowDirectMessages,
            },
          },
        });
      }

      reset(data);
    } catch (error) {
      console.error('Failed to save privacy settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [onSave, updateProfile, profile, reset]);

  return (
    <div className={cn('max-w-6xl mx-auto space-y-8', className)}>
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-heading font-semibold text-cream mb-2">
          Privacy & Security
        </h1>
        <p className="text-sage/70">
          Control who can see your information and how your data is used
        </p>
      </div>

      {/* Privacy Level Indicator */}
      <div className="flex justify-center">
        <PrivacyLevelIndicator level={privacyLevel} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Privacy Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Visibility */}
          <GlassMorphism variant="medium" className="p-6">
            <h3 className="text-lg font-heading text-cream mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Profile Visibility
            </h3>

            <Controller
              name="profileVisibility"
              control={control}
              render={({ field }) => (
                <PrivacyRadioGroup
                  label="Who can see your profile"
                  description="Control who has access to your profile information"
                  settingKey="profileVisibility"
                  options={[
                    {
                      value: 'public',
                      label: 'Public',
                      description: 'Anyone can view your profile',
                      icon: Globe,
                    },
                    {
                      value: 'business_only',
                      label: 'Business Contacts Only',
                      description: 'Only verified business owners can see your profile',
                      icon: Users,
                    },
                    {
                      value: 'private',
                      label: 'Private',
                      description: 'Only you can see your profile',
                      icon: Lock,
                    },
                  ]}
                  {...field}
                />
              )}
            />
          </GlassMorphism>

          {/* Contact Information */}
          <GlassMorphism variant="medium" className="p-6">
            <h3 className="text-lg font-heading text-cream mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Contact Information
            </h3>

            <div className="space-y-1">
              <Controller
                name="showEmail"
                control={control}
                render={({ field }) => (
                  <PrivacyToggle
                    label="Show Email Address"
                    description="Allow others to see your email address"
                    icon={Mail}
                    settingKey="showEmail"
                    warning="Your email may be used for spam"
                    {...field}
                  />
                )}
              />

              <Controller
                name="showPhone"
                control={control}
                render={({ field }) => (
                  <PrivacyToggle
                    label="Show Phone Number"
                    description="Allow others to see your phone number"
                    icon={Phone}
                    settingKey="showPhone"
                    warning="Your phone may receive unwanted calls"
                    {...field}
                  />
                )}
              />
            </div>
          </GlassMorphism>

          {/* Location Sharing */}
          <GlassMorphism variant="medium" className="p-6">
            <h3 className="text-lg font-heading text-cream mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Location Sharing
            </h3>

            <Controller
              name="showLocation"
              control={control}
              render={({ field }) => (
                <PrivacyRadioGroup
                  label="Location precision"
                  description="Choose how much of your location to share"
                  settingKey="showLocation"
                  options={[
                    {
                      value: 'exact',
                      label: 'Exact Location',
                      description: 'Show your complete address',
                      icon: MapPin,
                    },
                    {
                      value: 'city',
                      label: 'City Only',
                      description: 'Show only your city and state',
                      icon: MapPin,
                    },
                    {
                      value: 'region',
                      label: 'Region Only',
                      description: 'Show only your state or region',
                      icon: MapPin,
                    },
                    {
                      value: 'hidden',
                      label: 'Hidden',
                      description: 'Don\'t show any location information',
                      icon: Lock,
                    },
                  ]}
                  {...field}
                />
              )}
            />
          </GlassMorphism>

          {/* Activity & Communication */}
          <GlassMorphism variant="medium" className="p-6">
            <h3 className="text-lg font-heading text-cream mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Activity & Communication
            </h3>

            <div className="space-y-1">
              <Controller
                name="showActivity"
                control={control}
                render={({ field }) => (
                  <PrivacyToggle
                    label="Show Activity"
                    description="Allow others to see your reviews and interactions"
                    icon={Activity}
                    settingKey="allowDirectMessages"
                    {...field}
                  />
                )}
              />

              <Controller
                name="allowDirectMessages"
                control={control}
                render={({ field }) => (
                  <PrivacyToggle
                    label="Allow Direct Messages"
                    description="Let other users send you private messages"
                    icon={MessageSquare}
                    {...field}
                  />
                )}
              />

              <Controller
                name="searchable"
                control={control}
                render={({ field }) => (
                  <PrivacyToggle
                    label="Appear in Search"
                    description="Allow your profile to appear in search results"
                    icon={Search}
                    {...field}
                  />
                )}
              />
            </div>
          </GlassMorphism>

          {/* Data Usage */}
          <GlassMorphism variant="medium" className="p-6">
            <h3 className="text-lg font-heading text-cream mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Data Usage & Sharing
            </h3>

            <div className="space-y-1">
              <Controller
                name="dataSharing.analytics"
                control={control}
                render={({ field }) => (
                  <PrivacyToggle
                    label="Analytics Data"
                    description="Help improve our service with anonymous usage data"
                    {...field}
                  />
                )}
              />

              <Controller
                name="dataSharing.personalization"
                control={control}
                render={({ field }) => (
                  <PrivacyToggle
                    label="Personalization"
                    description="Use your data to personalize recommendations"
                    {...field}
                  />
                )}
              />

              <Controller
                name="dataSharing.thirdParty"
                control={control}
                render={({ field }) => (
                  <PrivacyToggle
                    label="Third-party Sharing"
                    description="Share anonymized data with trusted partners"
                    warning="This may affect your privacy"
                    {...field}
                  />
                )}
              />
            </div>
          </GlassMorphism>
        </div>

        {/* Profile Preview Sidebar */}
        <div className="space-y-6">
          <ProfilePreview settings={settings} />

          {/* Quick Actions */}
          <GlassMorphism variant="medium" className="p-4">
            <h4 className="font-medium text-cream mb-3">Quick Actions</h4>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-2 p-2 text-left text-sm text-sage/70 hover:text-cream hover:bg-navy-50/20 rounded transition-colors">
                <Download className="w-4 h-4" />
                Export my data
              </button>
              <button className="w-full flex items-center gap-2 p-2 text-left text-sm text-sage/70 hover:text-cream hover:bg-navy-50/20 rounded transition-colors">
                <ExternalLink className="w-4 h-4" />
                Privacy policy
              </button>
              <button className="w-full flex items-center gap-2 p-2 text-left text-sm text-red-error hover:bg-red-error/10 rounded transition-colors">
                <Trash2 className="w-4 h-4" />
                Delete account
              </button>
            </div>
          </GlassMorphism>
        </div>
      </div>

      {/* Save Button */}
      {isDirty && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 right-6 z-40"
        >
          <GlassMorphism variant="medium" className="p-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-sage/70">You have unsaved changes</span>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSubmit(onSubmit)}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-teal-primary hover:bg-teal-secondary text-cream rounded-lg transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>{isSaving ? 'Saving...' : 'Save Privacy Settings'}</span>
              </motion.button>
            </div>
          </GlassMorphism>
        </motion.div>
      )}
    </div>
  );
};