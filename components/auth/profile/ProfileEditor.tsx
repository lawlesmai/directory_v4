'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Globe, 
  Save, 
  X, 
  Check, 
  AlertCircle,
  Info,
  Camera,
  Link as LinkIcon,
  Building,
  Calendar
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { GlassMorphism } from '@/components/GlassMorphism';
import { cn } from '@/lib/utils';
import type { UserProfile } from '../types';

// Enhanced validation schema for profile editing
const profileEditSchema = z.object({
  firstName: z.string()
    .min(1, 'First name is required')
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be less than 50 characters')
    .regex(/^[a-zA-Z\s-']+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes'),
  
  lastName: z.string()
    .min(1, 'Last name is required')
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be less than 50 characters')
    .regex(/^[a-zA-Z\s-']+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes'),
  
  displayName: z.string()
    .min(2, 'Display name must be at least 2 characters')
    .max(30, 'Display name must be less than 30 characters')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Display name can only contain letters, numbers, underscores, periods, and hyphens'),
  
  email: z.string()
    .email('Please enter a valid email address'),
  
  phone: z.string()
    .optional()
    .refine((phone) => !phone || /^\+?[\d\s-()]+$/.test(phone), 'Please enter a valid phone number'),
  
  bio: z.string()
    .max(500, 'Bio must be less than 500 characters')
    .optional(),
  
  location: z.string()
    .max(100, 'Location must be less than 100 characters')
    .optional(),
  
  website: z.string()
    .optional()
    .refine((url) => {
      if (!url) return true;
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    }, 'Please enter a valid website URL'),
  
  socialLinks: z.object({
    twitter: z.string().optional(),
    linkedin: z.string().optional(),
    instagram: z.string().optional(),
    facebook: z.string().optional(),
  }),
  
  businessType: z.enum(['customer', 'business_owner', 'service_provider', 'other']),
  
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'system']),
    notifications: z.object({
      email: z.boolean(),
      push: z.boolean(),
      marketing: z.boolean(),
    }),
    privacy: z.object({
      profileVisible: z.boolean(),
      allowDirectMessages: z.boolean(),
    }),
    accessibility: z.object({
      reducedMotion: z.boolean(),
      highContrast: z.boolean(),
      largeText: z.boolean(),
    }),
  }),
});

type ProfileFormData = z.infer<typeof profileEditSchema>;

// Tab configuration
const PROFILE_TABS = [
  { id: 'basic', label: 'Basic Info', icon: User },
  { id: 'contact', label: 'Contact', icon: Mail },
  { id: 'professional', label: 'Professional', icon: Building },
  { id: 'social', label: 'Social Links', icon: LinkIcon },
] as const;

type ProfileTabId = typeof PROFILE_TABS[number]['id'];

interface ProfileEditorProps {
  onSave?: (data: Partial<UserProfile>) => Promise<void>;
  onCancel?: () => void;
  className?: string;
}

// Field validation component
const FieldValidation: React.FC<{
  isValid?: boolean;
  isValidating?: boolean;
  error?: string;
  success?: string;
  info?: string;
}> = ({ isValid, isValidating, error, success, info }) => {
  if (isValidating) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-2 text-sm text-sage/70 mt-1"
      >
        <div className="w-4 h-4 border-2 border-teal-primary/30 border-t-teal-primary rounded-full animate-spin" />
        <span>Checking availability...</span>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 text-sm text-red-error mt-1"
      >
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span>{error}</span>
      </motion.div>
    );
  }

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 text-sm text-teal-primary mt-1"
      >
        <Check className="w-4 h-4 flex-shrink-0" />
        <span>{success}</span>
      </motion.div>
    );
  }

  if (info) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 text-sm text-sage/60 mt-1"
      >
        <Info className="w-4 h-4 flex-shrink-0" />
        <span>{info}</span>
      </motion.div>
    );
  }

  return null;
};

// Character counter component
const CharacterCounter: React.FC<{
  current: number;
  max: number;
  className?: string;
}> = ({ current, max, className }) => {
  const percentage = (current / max) * 100;
  const isNearLimit = percentage >= 80;
  const isOverLimit = percentage >= 100;

  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      <span className={cn(
        'transition-colors',
        isOverLimit ? 'text-red-error' : isNearLimit ? 'text-gold-primary' : 'text-sage/60'
      )}>
        {current}/{max}
      </span>
      <div className="flex-1 h-1 bg-navy-50/20 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percentage, 100)}%` }}
          className={cn(
            'h-full transition-colors rounded-full',
            isOverLimit ? 'bg-red-error' : isNearLimit ? 'bg-gold-primary' : 'bg-teal-primary'
          )}
        />
      </div>
    </div>
  );
};

// Custom input component with enhanced styling
const FormInput: React.FC<{
  label: string;
  type?: string;
  placeholder?: string;
  icon?: React.ComponentType<any>;
  maxLength?: number;
  showCounter?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  success?: string;
  info?: string;
  isValidating?: boolean;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}> = ({
  label,
  type = 'text',
  placeholder,
  icon: Icon,
  maxLength,
  showCounter = false,
  value = '',
  onChange,
  error,
  success,
  info,
  isValidating,
  required,
  disabled,
  className
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
          maxLength={maxLength}
          disabled={disabled}
          className={cn(
            'w-full px-4 py-3 bg-navy-50/20 border rounded-lg transition-all duration-200',
            'placeholder:text-sage/40 text-cream',
            'focus:outline-none focus:ring-2 focus:ring-teal-primary/50 focus:border-teal-primary/50',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            Icon ? 'pl-12' : '',
            error ? 'border-red-error/50 bg-red-error/5' : 
            success ? 'border-teal-primary/50 bg-teal-primary/5' : 
            'border-sage/20 hover:border-sage/30'
          )}
        />
        {isValidating && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-teal-primary/30 border-t-teal-primary rounded-full animate-spin" />
          </div>
        )}
      </div>

      {showCounter && maxLength && (
        <CharacterCounter current={value.length} max={maxLength} />
      )}

      <FieldValidation
        error={error}
        success={success}
        info={info}
        isValidating={isValidating}
      />
    </div>
  );
};

// Textarea component
const FormTextarea: React.FC<{
  label: string;
  placeholder?: string;
  maxLength?: number;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  rows?: number;
  required?: boolean;
  className?: string;
}> = ({
  label,
  placeholder,
  maxLength,
  value = '',
  onChange,
  error,
  rows = 4,
  required,
  className
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      <label className="block text-sm font-medium text-cream">
        {label}
        {required && <span className="text-red-error ml-1">*</span>}
      </label>
      
      <div className="relative">
        <textarea
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          maxLength={maxLength}
          rows={rows}
          className={cn(
            'w-full px-4 py-3 bg-navy-50/20 border rounded-lg transition-all duration-200 resize-none',
            'placeholder:text-sage/40 text-cream',
            'focus:outline-none focus:ring-2 focus:ring-teal-primary/50 focus:border-teal-primary/50',
            error ? 'border-red-error/50 bg-red-error/5' : 'border-sage/20 hover:border-sage/30'
          )}
        />
      </div>

      {maxLength && (
        <CharacterCounter current={value.length} max={maxLength} />
      )}

      <FieldValidation error={error} />
    </div>
  );
};

// Select component
const FormSelect: React.FC<{
  label: string;
  options: Array<{ value: string; label: string }>;
  value?: string;
  onChange?: (value: string) => void;
  icon?: React.ComponentType<any>;
  required?: boolean;
  className?: string;
}> = ({
  label,
  options,
  value,
  onChange,
  icon: Icon,
  required,
  className
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
        <select
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className={cn(
            'w-full px-4 py-3 bg-navy-50/20 border border-sage/20 rounded-lg transition-all duration-200',
            'text-cream appearance-none cursor-pointer',
            'focus:outline-none focus:ring-2 focus:ring-teal-primary/50 focus:border-teal-primary/50',
            'hover:border-sage/30',
            Icon ? 'pl-12' : ''
          )}
        >
          {options.map(option => (
            <option key={option.value} value={option.value} className="bg-navy-dark text-cream">
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <svg className="w-4 h-4 text-sage/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export const ProfileEditor: React.FC<ProfileEditorProps> = ({
  onSave,
  onCancel,
  className
}) => {
  const { user, profile, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTabId>('basic');
  const [isSaving, setIsSaving] = useState(false);
  const [displayNameValidation, setDisplayNameValidation] = useState<{
    isValidating: boolean;
    isAvailable?: boolean;
    message?: string;
  }>({ isValidating: false });

  // Initialize form with current profile data
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileEditSchema),
    mode: 'onChange',
    defaultValues: useMemo(() => ({
      firstName: profile?.firstName || '',
      lastName: profile?.lastName || '',
      displayName: profile?.fullName || '',
      email: user?.email || '',
      phone: profile?.phone || '',
      bio: profile?.bio || '',
      location: profile?.location?.city || '',
      website: profile?.website || '',
      socialLinks: profile?.socialLinks || {
        twitter: '',
        linkedin: '',
        instagram: '',
        facebook: '',
      },
      businessType: profile?.businessType || 'customer',
      preferences: profile?.preferences || {
        theme: 'system',
        notifications: {
          email: true,
          push: true,
          marketing: false,
        },
        privacy: {
          profileVisible: true,
          allowDirectMessages: true,
        },
        accessibility: {
          reducedMotion: false,
          highContrast: false,
          largeText: false,
        },
      },
    }), [profile, user]),
  });

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty, isValid },
    watch,
    setValue,
    reset
  } = form;

  const watchedDisplayName = watch('displayName');
  const watchedBio = watch('bio');

  // Display name availability check with debounce
  useEffect(() => {
    if (!watchedDisplayName || watchedDisplayName === profile?.fullName) {
      setDisplayNameValidation({ isValidating: false });
      return;
    }

    const timeoutId = setTimeout(async () => {
      setDisplayNameValidation({ isValidating: true });
      
      try {
        // Simulate API call to check display name availability
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Mock validation logic
        const isAvailable = !['admin', 'test', 'demo'].includes(watchedDisplayName.toLowerCase());
        
        setDisplayNameValidation({
          isValidating: false,
          isAvailable,
          message: isAvailable ? 'Display name is available' : 'Display name is already taken'
        });
      } catch {
        setDisplayNameValidation({
          isValidating: false,
          message: 'Could not check availability'
        });
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [watchedDisplayName, profile?.fullName]);

  // Handle form submission
  const onSubmit = useCallback(async (data: ProfileFormData) => {
    setIsSaving(true);
    
    try {
      const profileData: Partial<UserProfile> = {
        firstName: data.firstName,
        lastName: data.lastName,
        fullName: data.displayName,
        phone: data.phone || undefined,
        bio: data.bio || undefined,
        location: data.location ? { city: data.location, country: 'US' } : undefined,
        website: data.website || undefined,
        socialLinks: data.socialLinks,
        businessType: data.businessType,
        preferences: data.preferences,
      };

      if (onSave) {
        await onSave(profileData);
      } else {
        await updateProfile(profileData);
      }

      // Reset form dirty state
      reset(data);
      
    } catch (error) {
      console.error('Profile update failed:', error);
      // Error handling would be done by the parent component or context
    } finally {
      setIsSaving(false);
    }
  }, [onSave, updateProfile, reset]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
    } else {
      reset();
    }
  }, [onCancel, reset]);

  // Tab content components
  const BasicInfoTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Controller
          name="firstName"
          control={control}
          render={({ field }) => (
            <FormInput
              label="First Name"
              icon={User}
              placeholder="Enter your first name"
              required
              {...field}
              error={errors.firstName?.message}
            />
          )}
        />

        <Controller
          name="lastName"
          control={control}
          render={({ field }) => (
            <FormInput
              label="Last Name"
              icon={User}
              placeholder="Enter your last name"
              required
              {...field}
              error={errors.lastName?.message}
            />
          )}
        />
      </div>

      <Controller
        name="displayName"
        control={control}
        render={({ field }) => (
          <FormInput
            label="Display Name"
            icon={User}
            placeholder="How you want to appear to others"
            required
            maxLength={30}
            showCounter
            {...field}
            error={errors.displayName?.message}
            success={displayNameValidation.isAvailable ? displayNameValidation.message : undefined}
            isValidating={displayNameValidation.isValidating}
            info="This is how other users will see your name"
          />
        )}
      />

      <Controller
        name="bio"
        control={control}
        render={({ field }) => (
          <FormTextarea
            label="Bio"
            placeholder="Tell others about yourself..."
            maxLength={500}
            rows={4}
            {...field}
            error={errors.bio?.message}
          />
        )}
      />

      <Controller
        name="businessType"
        control={control}
        render={({ field }) => (
          <FormSelect
            label="Account Type"
            icon={Building}
            required
            options={[
              { value: 'customer', label: 'Customer' },
              { value: 'business_owner', label: 'Business Owner' },
              { value: 'service_provider', label: 'Service Provider' },
              { value: 'other', label: 'Other' },
            ]}
            {...field}
          />
        )}
      />
    </div>
  );

  const ContactTab = () => (
    <div className="space-y-6">
      <Controller
        name="email"
        control={control}
        render={({ field }) => (
          <FormInput
            label="Email Address"
            type="email"
            icon={Mail}
            placeholder="Enter your email address"
            required
            disabled
            {...field}
            info="Contact support to change your email address"
          />
        )}
      />

      <Controller
        name="phone"
        control={control}
        render={({ field }) => (
          <FormInput
            label="Phone Number"
            type="tel"
            icon={Phone}
            placeholder="Enter your phone number"
            {...field}
            error={errors.phone?.message}
            info="Used for account security and business verification"
          />
        )}
      />

      <Controller
        name="location"
        control={control}
        render={({ field }) => (
          <FormInput
            label="Location"
            icon={MapPin}
            placeholder="City, State"
            maxLength={100}
            {...field}
            error={errors.location?.message}
            info="Helps local businesses find you"
          />
        )}
      />

      <Controller
        name="website"
        control={control}
        render={({ field }) => (
          <FormInput
            label="Website"
            type="url"
            icon={Globe}
            placeholder="https://yourwebsite.com"
            {...field}
            error={errors.website?.message}
            info="Your personal or business website"
          />
        )}
      />
    </div>
  );

  const ProfessionalTab = () => (
    <div className="space-y-6">
      <div className="text-center py-8">
        <Building className="w-12 h-12 text-sage/50 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-cream mb-2">Professional Information</h3>
        <p className="text-sage/70 mb-6">
          Additional professional details will be available in future updates
        </p>
        <div className="bg-teal-primary/10 border border-teal-primary/20 rounded-lg p-4">
          <Calendar className="w-6 h-6 text-teal-primary mx-auto mb-2" />
          <p className="text-sm text-teal-primary">Coming Soon</p>
        </div>
      </div>
    </div>
  );

  const SocialLinksTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Controller
          name="socialLinks.twitter"
          control={control}
          render={({ field }) => (
            <FormInput
              label="Twitter"
              placeholder="@username or full URL"
              {...field}
              info="Your Twitter profile"
            />
          )}
        />

        <Controller
          name="socialLinks.linkedin"
          control={control}
          render={({ field }) => (
            <FormInput
              label="LinkedIn"
              placeholder="LinkedIn profile URL"
              {...field}
              info="Your LinkedIn profile"
            />
          )}
        />

        <Controller
          name="socialLinks.instagram"
          control={control}
          render={({ field }) => (
            <FormInput
              label="Instagram"
              placeholder="@username or full URL"
              {...field}
              info="Your Instagram profile"
            />
          )}
        />

        <Controller
          name="socialLinks.facebook"
          control={control}
          render={({ field }) => (
            <FormInput
              label="Facebook"
              placeholder="Facebook profile URL"
              {...field}
              info="Your Facebook profile"
            />
          )}
        />
      </div>
    </div>
  );

  return (
    <div className={cn('max-w-4xl mx-auto space-y-8', className)}>
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-heading font-semibold text-cream mb-2">
          Edit Profile
        </h1>
        <p className="text-sage/70">
          Update your profile information and preferences
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex justify-center">
        <div className="flex bg-navy-50/20 rounded-lg p-1 overflow-x-auto">
          {PROFILE_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap',
                  'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                  activeTab === tab.id
                    ? 'bg-teal-primary text-cream shadow-sm'
                    : 'text-sage/70 hover:text-sage hover:bg-navy-50/20'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <GlassMorphism variant="medium" className="p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {activeTab === 'basic' && <BasicInfoTab />}
              {activeTab === 'contact' && <ContactTab />}
              {activeTab === 'professional' && <ProfessionalTab />}
              {activeTab === 'social' && <SocialLinksTab />}
            </motion.div>
          </AnimatePresence>

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-8 mt-8 border-t border-sage/10">
            <div className="flex items-center gap-2 text-sm text-sage/60">
              {isDirty && (
                <>
                  <div className="w-2 h-2 bg-gold-primary rounded-full animate-pulse" />
                  <span>You have unsaved changes</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSaving}
                className="px-6 py-3 text-sage/70 hover:text-cream transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              <motion.button
                whileHover={{ scale: isDirty && isValid ? 1.02 : 1 }}
                whileTap={{ scale: isDirty && isValid ? 0.98 : 1 }}
                type="submit"
                disabled={!isDirty || !isValid || isSaving}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                  isDirty && isValid && !isSaving
                    ? 'bg-teal-primary hover:bg-teal-secondary text-cream shadow-lg'
                    : 'bg-sage/20 text-sage/50 cursor-not-allowed'
                )}
              >
                {isSaving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    <span>Save Changes</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </GlassMorphism>
      </form>
    </div>
  );
};