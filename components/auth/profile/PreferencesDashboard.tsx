'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  User,
  Shield,
  Bell,
  Eye,
  Smartphone,
  Palette,
  Search,
  ChevronRight,
  Check,
  X,
  Info,
  Download,
  Trash2,
  Globe,
  Mail,
  MessageSquare,
  Phone,
  Lock,
  Database,
  Accessibility,
  Monitor,
  Moon,
  Sun,
  Volume2,
  VolumeX
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { GlassMorphism } from '@/components/GlassMorphism';
import { cn } from '@/lib/utils';
import type { UserProfile } from '../types';

// Preferences schema
const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  notifications: z.object({
    email: z.boolean(),
    push: z.boolean(),
    marketing: z.boolean(),
    reviews: z.boolean(),
    messages: z.boolean(),
    business_updates: z.boolean(),
    platform_announcements: z.boolean(),
  }),
  privacy: z.object({
    profileVisible: z.boolean(),
    allowDirectMessages: z.boolean(),
    showEmail: z.boolean(),
    showPhone: z.boolean(),
    showLocation: z.enum(['exact', 'city', 'region', 'hidden']),
    showActivity: z.boolean(),
    searchable: z.boolean(),
  }),
  accessibility: z.object({
    reducedMotion: z.boolean(),
    highContrast: z.boolean(),
    largeText: z.boolean(),
    soundEnabled: z.boolean(),
    keyboardNavigation: z.boolean(),
  }),
  business: z.object({
    autoRespond: z.boolean(),
    showBusinessHours: z.boolean(),
    allowBookings: z.boolean(),
    publicAnalytics: z.boolean(),
  }).optional(),
  data: z.object({
    allowAnalytics: z.boolean(),
    allowPersonalization: z.boolean(),
    allowThirdPartySharing: z.boolean(),
    allowMarketing: z.boolean(),
  }),
});

type PreferencesFormData = z.infer<typeof preferencesSchema>;

// Settings categories
interface SettingsCategory {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  settings: string[];
}

const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    id: 'account',
    label: 'Account & Profile',
    description: 'Basic account settings and profile preferences',
    icon: User,
    color: 'teal',
    settings: ['theme', 'profile_visibility', 'display_preferences'],
  },
  {
    id: 'privacy',
    label: 'Privacy & Security',
    description: 'Control your data and privacy settings',
    icon: Shield,
    color: 'blue',
    settings: ['privacy_controls', 'data_sharing', 'security_settings'],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Manage email, push, and SMS notifications',
    icon: Bell,
    color: 'yellow',
    settings: ['email_notifications', 'push_notifications', 'sms_preferences'],
  },
  {
    id: 'accessibility',
    label: 'Accessibility',
    description: 'Customize the interface for your needs',
    icon: Accessibility,
    color: 'green',
    settings: ['motion_preferences', 'visual_accessibility', 'keyboard_navigation'],
  },
  {
    id: 'business',
    label: 'Business Settings',
    description: 'Enhanced options for business owners',
    icon: Globe,
    color: 'purple',
    settings: ['business_profile', 'customer_interactions', 'analytics'],
  },
  {
    id: 'data',
    label: 'Data & Privacy',
    description: 'GDPR controls and data management',
    icon: Database,
    color: 'red',
    settings: ['data_controls', 'export_data', 'delete_account'],
  },
];

// Toggle switch component
const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}> = ({ checked, onChange, disabled = false, size = 'md' }) => {
  const sizeClasses = {
    sm: { container: 'w-10 h-5', thumb: 'w-4 h-4', translate: 'translate-x-5' },
    md: { container: 'w-12 h-6', thumb: 'w-5 h-5', translate: 'translate-x-6' },
  };

  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'relative inline-flex items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
        sizeClasses[size].container,
        checked ? 'bg-teal-primary' : 'bg-sage/20',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      )}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
    >
      <motion.span
        className={cn(
          'inline-block rounded-full bg-cream shadow-sm transition-transform',
          sizeClasses[size].thumb,
          checked ? sizeClasses[size].translate : 'translate-x-0.5'
        )}
        layout
      />
    </motion.button>
  );
};

// Setting row component
const SettingRow: React.FC<{
  label: string;
  description?: string;
  children: React.ReactNode;
  icon?: React.ComponentType<any>;
  warning?: string;
  info?: string;
}> = ({ label, description, children, icon: Icon, warning, info }) => {
  return (
    <div className="flex items-start justify-between py-4 border-b border-sage/10 last:border-0">
      <div className="flex-1 pr-4">
        <div className="flex items-center gap-2 mb-1">
          {Icon && <Icon className="w-4 h-4 text-sage/70" />}
          <span className="font-medium text-cream">{label}</span>
        </div>
        {description && (
          <p className="text-sm text-sage/70">{description}</p>
        )}
        {warning && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-gold-primary mt-1 flex items-center gap-1"
          >
            <Info className="w-3 h-3" />
            {warning}
          </motion.p>
        )}
        {info && (
          <p className="text-xs text-sage/50 mt-1">{info}</p>
        )}
      </div>
      <div className="flex-shrink-0">
        {children}
      </div>
    </div>
  );
};

// Category card component
const CategoryCard: React.FC<{
  category: SettingsCategory;
  isActive: boolean;
  onClick: () => void;
  pendingChanges?: number;
}> = ({ category, isActive, onClick, pendingChanges }) => {
  const Icon = category.icon;

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'w-full p-6 rounded-lg text-left transition-all duration-200 relative overflow-hidden',
        'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
        isActive
          ? 'bg-teal-primary/20 border-2 border-teal-primary/50'
          : 'bg-navy-50/10 border border-sage/20 hover:bg-navy-50/20 hover:border-sage/30'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className={cn(
              'p-2 rounded-lg',
              `bg-${category.color}-primary/20`
            )}>
              <Icon className={cn('w-5 h-5', `text-${category.color}-primary`)} />
            </div>
            <h3 className="font-semibold text-cream">{category.label}</h3>
          </div>
          <p className="text-sm text-sage/70">{category.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingChanges && pendingChanges > 0 && (
            <span className="px-2 py-1 bg-gold-primary/20 text-gold-primary text-xs rounded-full">
              {pendingChanges}
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-sage/50" />
        </div>
      </div>
    </motion.button>
  );
};

// Quick settings component
const QuickSettings: React.FC<{
  preferences: PreferencesFormData;
  onChange: (field: keyof PreferencesFormData, value: any) => void;
}> = ({ preferences, onChange }) => {
  return (
    <GlassMorphism variant="medium" className="p-6">
      <h3 className="text-lg font-heading text-cream mb-4 flex items-center gap-2">
        <Settings className="w-5 h-5" />
        Quick Settings
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SettingRow
          label="Dark Mode"
          description="Switch between light and dark themes"
          icon={preferences.theme === 'dark' ? Moon : Sun}
        >
          <select
            value={preferences.theme}
            onChange={(e) => onChange('theme', e.target.value)}
            className="bg-navy-50/20 border border-sage/20 rounded-lg px-3 py-1 text-cream text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </SettingRow>

        <SettingRow
          label="Email Notifications"
          description="Receive updates via email"
          icon={Mail}
        >
          <ToggleSwitch
            checked={preferences.notifications.email}
            onChange={(checked) => onChange('notifications', {
              ...preferences.notifications,
              email: checked
            })}
          />
        </SettingRow>

        <SettingRow
          label="Profile Visibility"
          description="Make your profile public"
          icon={Eye}
        >
          <ToggleSwitch
            checked={preferences.privacy.profileVisible}
            onChange={(checked) => onChange('privacy', {
              ...preferences.privacy,
              profileVisible: checked
            })}
          />
        </SettingRow>

        <SettingRow
          label="Reduced Motion"
          description="Minimize animations"
          icon={Accessibility}
        >
          <ToggleSwitch
            checked={preferences.accessibility.reducedMotion}
            onChange={(checked) => onChange('accessibility', {
              ...preferences.accessibility,
              reducedMotion: checked
            })}
          />
        </SettingRow>

        <SettingRow
          label="Sound Effects"
          description="Enable interface sounds"
          icon={preferences.accessibility.soundEnabled ? Volume2 : VolumeX}
        >
          <ToggleSwitch
            checked={preferences.accessibility.soundEnabled}
            onChange={(checked) => onChange('accessibility', {
              ...preferences.accessibility,
              soundEnabled: checked
            })}
          />
        </SettingRow>

        <SettingRow
          label="Marketing Emails"
          description="Promotional communications"
          icon={Mail}
        >
          <ToggleSwitch
            checked={preferences.notifications.marketing}
            onChange={(checked) => onChange('notifications', {
              ...preferences.notifications,
              marketing: checked
            })}
          />
        </SettingRow>
      </div>
    </GlassMorphism>
  );
};

// Main preferences dashboard component
export const PreferencesDashboard: React.FC<{
  className?: string;
  onSave?: (preferences: PreferencesFormData) => Promise<void>;
}> = ({ className, onSave }) => {
  const { profile, updateProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const form = useForm<PreferencesFormData>({
    resolver: zodResolver(preferencesSchema),
    mode: 'onChange',
    defaultValues: {
      theme: profile?.preferences?.theme || 'system',
      notifications: {
        email: profile?.preferences?.notifications?.email ?? true,
        push: profile?.preferences?.notifications?.push ?? true,
        marketing: profile?.preferences?.notifications?.marketing ?? false,
        reviews: true,
        messages: true,
        business_updates: true,
        platform_announcements: false,
      },
      privacy: {
        profileVisible: profile?.preferences?.privacy?.profileVisible ?? true,
        allowDirectMessages: profile?.preferences?.privacy?.allowDirectMessages ?? true,
        showEmail: false,
        showPhone: false,
        showLocation: 'city',
        showActivity: true,
        searchable: true,
      },
      accessibility: {
        reducedMotion: profile?.preferences?.accessibility?.reducedMotion ?? false,
        highContrast: profile?.preferences?.accessibility?.highContrast ?? false,
        largeText: profile?.preferences?.accessibility?.largeText ?? false,
        soundEnabled: true,
        keyboardNavigation: false,
      },
      business: profile?.businessType === 'business_owner' ? {
        autoRespond: false,
        showBusinessHours: true,
        allowBookings: false,
        publicAnalytics: false,
      } : undefined,
      data: {
        allowAnalytics: true,
        allowPersonalization: true,
        allowThirdPartySharing: false,
        allowMarketing: false,
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

  const preferences = watch();

  // Filter categories based on search
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return SETTINGS_CATEGORIES;
    
    return SETTINGS_CATEGORIES.filter(category =>
      category.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      category.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  // Handle preference changes
  const handlePreferenceChange = useCallback((field: keyof PreferencesFormData, value: any) => {
    setValue(field, value, { shouldDirty: true });
  }, [setValue]);

  // Handle form submission
  const onSubmit = useCallback(async (data: PreferencesFormData) => {
    setIsSaving(true);
    
    try {
      const updatedPreferences = {
        theme: data.theme,
        notifications: data.notifications,
        privacy: data.privacy,
        accessibility: data.accessibility,
      };

      if (onSave) {
        await onSave(data);
      } else {
        await updateProfile({ preferences: updatedPreferences });
      }

      reset(data);
    } catch (error) {
      console.error('Failed to save preferences:', error);
    } finally {
      setIsSaving(false);
    }
  }, [onSave, updateProfile, reset]);

  if (selectedCategory) {
    // Show detailed category settings (this would be implemented as separate components)
    return (
      <div className={cn('max-w-4xl mx-auto space-y-8', className)}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedCategory(null)}
            className="p-2 text-sage/70 hover:text-cream transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-heading text-cream">
            {SETTINGS_CATEGORIES.find(c => c.id === selectedCategory)?.label}
          </h2>
        </div>
        
        <GlassMorphism variant="medium" className="p-8">
          <p className="text-sage/70">
            Detailed settings for {selectedCategory} will be implemented here.
          </p>
        </GlassMorphism>
      </div>
    );
  }

  return (
    <div className={cn('max-w-6xl mx-auto space-y-8', className)}>
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-heading font-semibold text-cream mb-2">
          Settings & Preferences
        </h1>
        <p className="text-sage/70">
          Customize your experience and manage your account preferences
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md mx-auto">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-sage/50" />
        <input
          type="text"
          placeholder="Search settings..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-navy-50/20 border border-sage/20 rounded-lg text-cream placeholder:text-sage/40 focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
        />
      </div>

      {/* Quick Settings */}
      <QuickSettings
        preferences={preferences}
        onChange={handlePreferenceChange}
      />

      {/* Settings Categories */}
      <div>
        <h2 className="text-xl font-heading text-cream mb-6">All Settings</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCategories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              isActive={false}
              onClick={() => setSelectedCategory(category.id)}
            />
          ))}
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
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </motion.button>
            </div>
          </GlassMorphism>
        </motion.div>
      )}

      {/* Data Controls */}
      <GlassMorphism variant="medium" className="p-6">
        <h3 className="text-lg font-heading text-cream mb-4 flex items-center gap-2">
          <Database className="w-5 h-5" />
          Data Controls
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-navy-50/20 rounded-lg">
            <div>
              <h4 className="font-medium text-cream mb-1">Export Your Data</h4>
              <p className="text-sm text-sage/70">Download a copy of your account data</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 text-teal-primary hover:bg-teal-primary/10 rounded-lg transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-red-error/10 border border-red-error/20 rounded-lg">
            <div>
              <h4 className="font-medium text-cream mb-1">Delete Account</h4>
              <p className="text-sm text-sage/70">Permanently delete your account and data</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 text-red-error hover:bg-red-error/10 rounded-lg transition-colors">
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      </GlassMorphism>
    </div>
  );
};