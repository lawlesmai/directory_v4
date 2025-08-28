'use client';

import React, { useState, useCallback } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  Star,
  Users,
  Camera,
  Plus,
  Minus,
  X,
  Check,
  AlertCircle,
  Badge,
  Verified,
  TrendingUp,
  Calendar,
  CreditCard,
  Settings,
  Eye,
  Link as LinkIcon,
  Facebook,
  Instagram,
  Twitter,
  Linkedin,
  Youtube,
  Image as ImageIcon,
  Upload
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { GlassMorphism } from '@/components/GlassMorphism';
import { cn } from '@/lib/utils';
import { AvatarUpload } from './AvatarUpload';

// Business profile schema
const businessProfileSchema = z.object({
  businessName: z.string()
    .min(2, 'Business name must be at least 2 characters')
    .max(100, 'Business name must be less than 100 characters'),
  
  businessDescription: z.string()
    .min(20, 'Description must be at least 20 characters')
    .max(1000, 'Description must be less than 1000 characters'),
  
  category: z.string().min(1, 'Please select a business category'),
  
  subcategories: z.array(z.string()).optional(),
  
  address: z.object({
    street: z.string().min(5, 'Street address is required'),
    city: z.string().min(2, 'City is required'),
    state: z.string().min(2, 'State is required'),
    zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code'),
    country: z.string().optional().default('United States'),
  }),
  
  contact: z.object({
    phone: z.string()
      .regex(/^\+?[\d\s-()]+$/, 'Invalid phone number'),
    email: z.string().email('Invalid email address'),
    website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  }),
  
  hours: z.array(z.object({
    day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
    isOpen: z.boolean(),
    openTime: z.string().optional(),
    closeTime: z.string().optional(),
    isAllDay: z.boolean().default(false),
  })),
  
  socialMedia: z.object({
    facebook: z.string().optional(),
    instagram: z.string().optional(),
    twitter: z.string().optional(),
    linkedin: z.string().optional(),
    youtube: z.string().optional(),
  }),
  
  services: z.array(z.object({
    name: z.string().min(1, 'Service name is required'),
    description: z.string().optional(),
    price: z.string().optional(),
  })).optional(),
  
  images: z.array(z.object({
    url: z.string(),
    caption: z.string().optional(),
    isPrimary: z.boolean().default(false),
  })).optional(),
  
  amenities: z.array(z.string()).optional(),
  
  businessSettings: z.object({
    acceptsOnlineBookings: z.boolean().default(false),
    acceptsPayments: z.boolean().default(false),
    allowsReviews: z.boolean().default(true),
    autoRespond: z.boolean().default(false),
    showPricing: z.boolean().default(false),
    requiresReservation: z.boolean().default(false),
  }),
  
  verification: z.object({
    isVerified: z.boolean().default(false),
    verificationMethod: z.enum(['phone', 'email', 'document', 'in_person']).optional(),
    verificationDate: z.string().optional(),
  }).optional(),
});

type BusinessProfileData = z.infer<typeof businessProfileSchema>;

// Business categories
const BUSINESS_CATEGORIES = [
  { value: 'restaurant', label: 'Restaurant & Food' },
  { value: 'retail', label: 'Retail & Shopping' },
  { value: 'services', label: 'Professional Services' },
  { value: 'health', label: 'Health & Wellness' },
  { value: 'entertainment', label: 'Entertainment & Events' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'beauty', label: 'Beauty & Spa' },
  { value: 'fitness', label: 'Fitness & Recreation' },
  { value: 'education', label: 'Education & Training' },
  { value: 'technology', label: 'Technology & IT' },
  { value: 'other', label: 'Other' },
];

// Common amenities
const COMMON_AMENITIES = [
  'WiFi', 'Parking', 'Wheelchair Accessible', 'Pet Friendly', 'Outdoor Seating',
  'Delivery Available', 'Takeout', 'Credit Cards Accepted', 'Cash Only',
  'Reservations Required', 'Walk-ins Welcome', 'Air Conditioning', 'Heating',
];

// Days of the week
const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
] as const;

// Verification badge component
const VerificationBadge: React.FC<{
  isVerified: boolean;
  className?: string;
}> = ({ isVerified, className }) => {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className={cn(
        'flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium',
        isVerified 
          ? 'bg-teal-primary/20 text-teal-primary border border-teal-primary/30'
          : 'bg-sage/20 text-sage/70 border border-sage/30',
        className
      )}
    >
      {isVerified ? (
        <>
          <Verified className="w-4 h-4" />
          <span>Verified Business</span>
        </>
      ) : (
        <>
          <Badge className="w-4 h-4" />
          <span>Unverified</span>
        </>
      )}
    </motion.div>
  );
};

// Business hours component
const BusinessHoursEditor: React.FC<{
  control: any;
  errors: any;
}> = ({ control, errors }) => {
  return (
    <div className="space-y-4">
      <h4 className="font-medium text-cream">Business Hours</h4>
      
      <div className="space-y-3">
        {DAYS_OF_WEEK.map((day, index) => (
          <div key={day.value} className="flex items-center gap-4 p-3 bg-navy-50/20 rounded-lg">
            <div className="w-20 text-sm text-sage/70 capitalize">
              {day.label}
            </div>
            
            <Controller
              name={`hours.${index}.isOpen`}
              control={control}
              render={({ field }) => (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={field.onChange}
                    className="sr-only"
                  />
                  <div className={cn(
                    'w-5 h-5 rounded border-2 flex items-center justify-center',
                    field.value ? 'bg-teal-primary border-teal-primary' : 'border-sage/30'
                  )}>
                    {field.value && <Check className="w-3 h-3 text-cream" />}
                  </div>
                  <span className="text-sm text-sage/70">Open</span>
                </label>
              )}
            />
            
            <Controller
              name={`hours.${index}.isOpen`}
              control={control}
              render={({ field: openField }) => (
                openField.value && (
                  <div className="flex items-center gap-2 flex-1">
                    <Controller
                      name={`hours.${index}.openTime`}
                      control={control}
                      render={({ field }) => (
                        <input
                          type="time"
                          {...field}
                          className="px-3 py-1 bg-navy-50/20 border border-sage/20 rounded text-cream text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
                        />
                      )}
                    />
                    <span className="text-sage/70">to</span>
                    <Controller
                      name={`hours.${index}.closeTime`}
                      control={control}
                      render={({ field }) => (
                        <input
                          type="time"
                          {...field}
                          className="px-3 py-1 bg-navy-50/20 border border-sage/20 rounded text-cream text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
                        />
                      )}
                    />
                    
                    <Controller
                      name={`hours.${index}.isAllDay`}
                      control={control}
                      render={({ field }) => (
                        <label className="flex items-center gap-2 cursor-pointer text-sm text-sage/70">
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="sr-only"
                          />
                          <div className={cn(
                            'w-4 h-4 rounded border flex items-center justify-center',
                            field.value ? 'bg-teal-primary border-teal-primary' : 'border-sage/30'
                          )}>
                            {field.value && <Check className="w-2 h-2 text-cream" />}
                          </div>
                          24hrs
                        </label>
                      )}
                    />
                  </div>
                )
              )}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// Services editor component
const ServicesEditor: React.FC<{
  control: any;
  register: any;
  errors: any;
}> = ({ control, register, errors }) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'services',
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-cream">Services Offered</h4>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={() => append({ name: '', description: '', price: '' })}
          className="flex items-center gap-2 px-3 py-1 bg-teal-primary hover:bg-teal-secondary text-cream rounded text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Service
        </motion.button>
      </div>

      <div className="space-y-3">
        {fields.map((field, index) => (
          <motion.div
            key={field.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 bg-navy-50/20 rounded-lg border border-sage/20"
          >
            <div className="flex items-start justify-between mb-3">
              <h5 className="font-medium text-cream">Service {index + 1}</h5>
              <button
                type="button"
                onClick={() => remove(index)}
                className="text-red-error hover:text-red-error/80 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-sage/70 mb-1">
                  Service Name
                </label>
                <input
                  {...register(`services.${index}.name`)}
                  className="w-full px-3 py-2 bg-navy-50/20 border border-sage/20 rounded text-cream placeholder:text-sage/40 focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
                  placeholder="e.g., Haircut, Oil Change"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-sage/70 mb-1">
                  Price (Optional)
                </label>
                <input
                  {...register(`services.${index}.price`)}
                  className="w-full px-3 py-2 bg-navy-50/20 border border-sage/20 rounded text-cream placeholder:text-sage/40 focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
                  placeholder="e.g., $25, Contact for quote"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-sage/70 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  {...register(`services.${index}.description`)}
                  rows={2}
                  className="w-full px-3 py-2 bg-navy-50/20 border border-sage/20 rounded text-cream placeholder:text-sage/40 focus:outline-none focus:ring-2 focus:ring-teal-primary/50 resize-none"
                  placeholder="Describe this service..."
                />
              </div>
            </div>
          </motion.div>
        ))}

        {fields.length === 0 && (
          <div className="text-center py-8 text-sage/60">
            <div className="text-4xl mb-2">🛠️</div>
            <p>No services added yet</p>
            <p className="text-sm">Click "Add Service" to get started</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Main business profile component
export const BusinessProfile: React.FC<{
  className?: string;
  onSave?: (data: BusinessProfileData) => Promise<void>;
}> = ({ className, onSave }) => {
  const { profile, updateProfile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'contact' | 'hours' | 'services' | 'media' | 'settings'>('basic');

  const form = useForm({
    resolver: zodResolver(businessProfileSchema),
    mode: 'onChange',
    defaultValues: {
      businessName: '',
      businessDescription: '',
      category: '',
      subcategories: [],
      address: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'United States',
      },
      contact: {
        phone: '',
        email: profile?.email || '',
        website: '',
      },
      hours: DAYS_OF_WEEK.map(day => ({
        day: day.value,
        isOpen: true,
        openTime: '09:00',
        closeTime: '17:00',
        isAllDay: false,
      })),
      socialMedia: {
        facebook: '',
        instagram: '',
        twitter: '',
        linkedin: '',
        youtube: '',
      },
      services: [],
      images: [],
      amenities: [],
      businessSettings: {
        acceptsOnlineBookings: false,
        acceptsPayments: false,
        allowsReviews: true,
        autoRespond: false,
        showPricing: false,
        requiresReservation: false,
      },
    },
  });

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
    setValue,
    reset,
  } = form;

  const watchedData = watch();

  const onSubmit = useCallback(async (data: BusinessProfileData) => {
    setIsSaving(true);
    
    try {
      if (onSave) {
        await onSave(data);
      } else {
        // Update profile with business type (business data would be stored separately)
        await updateProfile({
          businessType: 'business_owner' as const,
        });
        // In a real implementation, business data would be saved to a separate business profile table
        console.log('Business data would be saved:', data);
      }

      reset(data);
    } catch (error) {
      console.error('Failed to save business profile:', error);
    } finally {
      setIsSaving(false);
    }
  }, [onSave, updateProfile, reset]);

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: Building2 },
    { id: 'contact', label: 'Contact', icon: Phone },
    { id: 'hours', label: 'Hours', icon: Clock },
    { id: 'services', label: 'Services', icon: Star },
    { id: 'media', label: 'Photos', icon: Camera },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <div className={cn('max-w-6xl mx-auto space-y-8', className)}>
      {/* Header */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="inline-block p-4 bg-gradient-to-br from-teal-primary/20 to-gold-primary/20 rounded-full mb-4"
        >
          <Building2 className="w-8 h-8 text-teal-primary" />
        </motion.div>
        <h1 className="text-3xl font-heading font-semibold text-cream mb-2">
          Business Profile
        </h1>
        <p className="text-sage/70">
          Create and manage your business presence on Lawless Directory
        </p>

        {/* Verification Status */}
        <div className="flex justify-center mt-4">
          <VerificationBadge isVerified={false} />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex justify-center">
        <div className="flex bg-navy-50/20 rounded-lg p-1 overflow-x-auto">
          {tabs.map((tab) => {
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
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-cream mb-2">
                        Business Name *
                      </label>
                      <input
                        {...register('businessName')}
                        className="w-full px-4 py-3 bg-navy-50/20 border border-sage/20 rounded-lg text-cream placeholder:text-sage/40 focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
                        placeholder="Enter your business name"
                      />
                      {errors.businessName && (
                        <p className="text-red-error text-sm mt-1">{errors.businessName.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-cream mb-2">
                        Category *
                      </label>
                      <select
                        {...register('category')}
                        className="w-full px-4 py-3 bg-navy-50/20 border border-sage/20 rounded-lg text-cream focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
                      >
                        <option value="">Select a category</option>
                        {BUSINESS_CATEGORIES.map(category => (
                          <option key={category.value} value={category.value}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                      {errors.category && (
                        <p className="text-red-error text-sm mt-1">{errors.category.message}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-cream mb-2">
                      Business Description *
                    </label>
                    <textarea
                      {...register('businessDescription')}
                      rows={4}
                      className="w-full px-4 py-3 bg-navy-50/20 border border-sage/20 rounded-lg text-cream placeholder:text-sage/40 focus:outline-none focus:ring-2 focus:ring-teal-primary/50 resize-none"
                      placeholder="Describe your business, services, and what makes you unique..."
                    />
                    <div className="flex justify-between items-center mt-1">
                      {errors.businessDescription && (
                        <p className="text-red-error text-sm">{errors.businessDescription.message}</p>
                      )}
                      <p className="text-sage/60 text-sm">
                        {watchedData.businessDescription?.length || 0}/1000 characters
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-cream mb-2">
                        Street Address *
                      </label>
                      <input
                        {...register('address.street')}
                        className="w-full px-4 py-3 bg-navy-50/20 border border-sage/20 rounded-lg text-cream placeholder:text-sage/40 focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
                        placeholder="123 Main Street"
                      />
                      {errors.address?.street && (
                        <p className="text-red-error text-sm mt-1">{errors.address.street.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-cream mb-2">
                        City *
                      </label>
                      <input
                        {...register('address.city')}
                        className="w-full px-4 py-3 bg-navy-50/20 border border-sage/20 rounded-lg text-cream placeholder:text-sage/40 focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
                        placeholder="San Francisco"
                      />
                      {errors.address?.city && (
                        <p className="text-red-error text-sm mt-1">{errors.address.city.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-cream mb-2">
                        State *
                      </label>
                      <input
                        {...register('address.state')}
                        className="w-full px-4 py-3 bg-navy-50/20 border border-sage/20 rounded-lg text-cream placeholder:text-sage/40 focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
                        placeholder="CA"
                      />
                      {errors.address?.state && (
                        <p className="text-red-error text-sm mt-1">{errors.address.state.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-cream mb-2">
                        ZIP Code *
                      </label>
                      <input
                        {...register('address.zipCode')}
                        className="w-full px-4 py-3 bg-navy-50/20 border border-sage/20 rounded-lg text-cream placeholder:text-sage/40 focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
                        placeholder="94102"
                      />
                      {errors.address?.zipCode && (
                        <p className="text-red-error text-sm mt-1">{errors.address.zipCode.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'contact' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-cream mb-2">
                        Business Phone *
                      </label>
                      <input
                        type="tel"
                        {...register('contact.phone')}
                        className="w-full px-4 py-3 bg-navy-50/20 border border-sage/20 rounded-lg text-cream placeholder:text-sage/40 focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
                        placeholder="(555) 123-4567"
                      />
                      {errors.contact?.phone && (
                        <p className="text-red-error text-sm mt-1">{errors.contact.phone.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-cream mb-2">
                        Business Email *
                      </label>
                      <input
                        type="email"
                        {...register('contact.email')}
                        className="w-full px-4 py-3 bg-navy-50/20 border border-sage/20 rounded-lg text-cream placeholder:text-sage/40 focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
                        placeholder="business@example.com"
                      />
                      {errors.contact?.email && (
                        <p className="text-red-error text-sm mt-1">{errors.contact.email.message}</p>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-cream mb-2">
                        Website
                      </label>
                      <input
                        type="url"
                        {...register('contact.website')}
                        className="w-full px-4 py-3 bg-navy-50/20 border border-sage/20 rounded-lg text-cream placeholder:text-sage/40 focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
                        placeholder="https://yourbusiness.com"
                      />
                    </div>
                  </div>

                  {/* Social Media */}
                  <div>
                    <h4 className="font-medium text-cream mb-4">Social Media</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-sage/70 mb-1">
                          Facebook
                        </label>
                        <div className="relative">
                          <Facebook className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-sage/50" />
                          <input
                            {...register('socialMedia.facebook')}
                            className="w-full pl-10 pr-4 py-2 bg-navy-50/20 border border-sage/20 rounded text-cream placeholder:text-sage/40 focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
                            placeholder="Facebook page URL"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-sage/70 mb-1">
                          Instagram
                        </label>
                        <div className="relative">
                          <Instagram className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-sage/50" />
                          <input
                            {...register('socialMedia.instagram')}
                            className="w-full pl-10 pr-4 py-2 bg-navy-50/20 border border-sage/20 rounded text-cream placeholder:text-sage/40 focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
                            placeholder="Instagram profile URL"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-sage/70 mb-1">
                          Twitter
                        </label>
                        <div className="relative">
                          <Twitter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-sage/50" />
                          <input
                            {...register('socialMedia.twitter')}
                            className="w-full pl-10 pr-4 py-2 bg-navy-50/20 border border-sage/20 rounded text-cream placeholder:text-sage/40 focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
                            placeholder="Twitter profile URL"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-sage/70 mb-1">
                          LinkedIn
                        </label>
                        <div className="relative">
                          <Linkedin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-sage/50" />
                          <input
                            {...register('socialMedia.linkedin')}
                            className="w-full pl-10 pr-4 py-2 bg-navy-50/20 border border-sage/20 rounded text-cream placeholder:text-sage/40 focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
                            placeholder="LinkedIn company URL"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'hours' && (
                <BusinessHoursEditor control={control} errors={errors} />
              )}

              {activeTab === 'services' && (
                <ServicesEditor 
                  control={control}
                  register={register}
                  errors={errors}
                />
              )}

              {activeTab === 'media' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium text-cream mb-4">Business Photos</h4>
                    <div className="text-center py-12 border-2 border-dashed border-sage/30 rounded-lg">
                      <ImageIcon className="w-12 h-12 text-sage/50 mx-auto mb-4" />
                      <h5 className="text-lg font-medium text-cream mb-2">Upload Business Photos</h5>
                      <p className="text-sage/70 mb-4">
                        Showcase your business with high-quality photos
                      </p>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-teal-primary hover:bg-teal-secondary text-cream rounded-lg transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                        Upload Photos
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="space-y-6">
                  <h4 className="font-medium text-cream">Business Settings</h4>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-navy-50/20 rounded-lg">
                      <div>
                        <h5 className="font-medium text-cream">Online Bookings</h5>
                        <p className="text-sm text-sage/70">Allow customers to book appointments online</p>
                      </div>
                      <Controller
                        name="businessSettings.acceptsOnlineBookings"
                        control={control}
                        render={({ field }) => (
                          <button
                            type="button"
                            onClick={() => field.onChange(!field.value)}
                            className={cn(
                              'relative inline-flex items-center w-12 h-6 rounded-full transition-colors',
                              field.value ? 'bg-teal-primary' : 'bg-sage/20'
                            )}
                          >
                            <span
                              className={cn(
                                'inline-block w-5 h-5 bg-cream rounded-full shadow-sm transition-transform',
                                field.value ? 'translate-x-6' : 'translate-x-0.5'
                              )}
                            />
                          </button>
                        )}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-navy-50/20 rounded-lg">
                      <div>
                        <h5 className="font-medium text-cream">Accept Reviews</h5>
                        <p className="text-sm text-sage/70">Allow customers to leave reviews</p>
                      </div>
                      <Controller
                        name="businessSettings.allowsReviews"
                        control={control}
                        render={({ field }) => (
                          <button
                            type="button"
                            onClick={() => field.onChange(!field.value)}
                            className={cn(
                              'relative inline-flex items-center w-12 h-6 rounded-full transition-colors',
                              field.value ? 'bg-teal-primary' : 'bg-sage/20'
                            )}
                          >
                            <span
                              className={cn(
                                'inline-block w-5 h-5 bg-cream rounded-full shadow-sm transition-transform',
                                field.value ? 'translate-x-6' : 'translate-x-0.5'
                              )}
                            />
                          </button>
                        )}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-navy-50/20 rounded-lg">
                      <div>
                        <h5 className="font-medium text-cream">Show Pricing</h5>
                        <p className="text-sm text-sage/70">Display service prices publicly</p>
                      </div>
                      <Controller
                        name="businessSettings.showPricing"
                        control={control}
                        render={({ field }) => (
                          <button
                            type="button"
                            onClick={() => field.onChange(!field.value)}
                            className={cn(
                              'relative inline-flex items-center w-12 h-6 rounded-full transition-colors',
                              field.value ? 'bg-teal-primary' : 'bg-sage/20'
                            )}
                          >
                            <span
                              className={cn(
                                'inline-block w-5 h-5 bg-cream rounded-full shadow-sm transition-transform',
                                field.value ? 'translate-x-6' : 'translate-x-0.5'
                              )}
                            />
                          </button>
                        )}
                      />
                    </div>
                  </div>
                </div>
              )}
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
                onClick={() => reset()}
                disabled={isSaving}
                className="px-6 py-3 text-sage/70 hover:text-cream transition-colors disabled:opacity-50"
              >
                Reset
              </button>

              <motion.button
                whileHover={{ scale: isDirty ? 1.02 : 1 }}
                whileTap={{ scale: isDirty ? 0.98 : 1 }}
                type="submit"
                disabled={!isDirty || isSaving}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                  isDirty && !isSaving
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
                    <Check className="w-5 h-5" />
                    <span>Save Business Profile</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </GlassMorphism>
      </form>

      {/* Verification CTA */}
      <GlassMorphism variant="medium" className="p-6 text-center">
        <Badge className="w-12 h-12 text-teal-primary mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-cream mb-2">Get Verified</h3>
        <p className="text-sage/70 mb-4 max-w-2xl mx-auto">
          Verified businesses get 5x more visibility and customer trust.
          Complete your profile and verify your business today.
        </p>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="px-6 py-2 bg-gradient-to-r from-teal-primary to-gold-primary text-cream rounded-lg font-medium"
        >
          Start Verification Process
        </motion.button>
      </GlassMorphism>
    </div>
  );
};