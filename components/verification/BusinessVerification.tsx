'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building,
  MapPin,
  Phone,
  Mail,
  Globe,
  Calendar,
  Hash,
  User,
  CheckCircle,
  AlertCircle,
  Search,
  ExternalLink,
  Info,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '../GlassMorphism';
import { KYCData } from '@/lib/auth/business-verification';

export interface BusinessVerificationProps {
  workflowId?: string;
  businessId?: string;
  stepData?: BusinessVerificationData;
  onComplete?: (data: BusinessVerificationData) => void;
  onError?: (errors: string[]) => void;
  isLoading?: boolean;
}

export interface BusinessVerificationData extends KYCData {
  completionPercentage: number;
  validationErrors: Record<string, string>;
  isComplete: boolean;
  autoFilledFields: string[];
}

interface FormSection {
  id: string;
  title: string;
  description: string;
  required: boolean;
  completed: boolean;
}

interface BusinessType {
  value: string;
  label: string;
  description: string;
  requiredDocuments: string[];
}

interface IndustryCategory {
  value: string;
  label: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  complianceRequirements?: string[];
}

const BUSINESS_TYPES: BusinessType[] = [
  {
    value: 'corporation',
    label: 'Corporation',
    description: 'C-Corp or S-Corp with shareholders',
    requiredDocuments: ['Articles of Incorporation', 'Bylaws', 'Stock Certificates']
  },
  {
    value: 'llc',
    label: 'Limited Liability Company (LLC)',
    description: 'LLC with operating agreement',
    requiredDocuments: ['Articles of Organization', 'Operating Agreement']
  },
  {
    value: 'partnership',
    label: 'Partnership',
    description: 'General or Limited Partnership',
    requiredDocuments: ['Partnership Agreement', 'Registration Certificate']
  },
  {
    value: 'sole_proprietorship',
    label: 'Sole Proprietorship',
    description: 'Individual business owner',
    requiredDocuments: ['DBA Filing', 'Business License']
  }
];

const INDUSTRY_CATEGORIES: IndustryCategory[] = [
  {
    value: 'retail',
    label: 'Retail & E-commerce',
    description: 'Selling products to consumers',
    riskLevel: 'low'
  },
  {
    value: 'restaurant',
    label: 'Restaurant & Food Service',
    description: 'Food preparation and service',
    riskLevel: 'low'
  },
  {
    value: 'professional_services',
    label: 'Professional Services',
    description: 'Consulting, legal, accounting, etc.',
    riskLevel: 'low'
  },
  {
    value: 'healthcare',
    label: 'Healthcare & Medical',
    description: 'Medical services and facilities',
    riskLevel: 'medium',
    complianceRequirements: ['HIPAA Compliance', 'Medical Licenses']
  },
  {
    value: 'financial_services',
    label: 'Financial Services',
    description: 'Banking, investment, insurance',
    riskLevel: 'high',
    complianceRequirements: ['SEC Registration', 'Financial Licenses']
  },
  {
    value: 'real_estate',
    label: 'Real Estate',
    description: 'Property sales and management',
    riskLevel: 'medium'
  },
  {
    value: 'construction',
    label: 'Construction & Contracting',
    description: 'Building and construction services',
    riskLevel: 'medium'
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Other business type',
    riskLevel: 'medium'
  }
];

const REVENUE_RANGES = [
  { value: 'under_100k', label: 'Under $100,000' },
  { value: '100k_500k', label: '$100,000 - $500,000' },
  { value: '500k_1m', label: '$500,000 - $1,000,000' },
  { value: '1m_5m', label: '$1,000,000 - $5,000,000' },
  { value: '5m_10m', label: '$5,000,000 - $10,000,000' },
  { value: 'over_10m', label: 'Over $10,000,000' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' }
];

export const BusinessVerification: React.FC<BusinessVerificationProps> = ({
  workflowId,
  businessId,
  stepData,
  onComplete,
  onError,
  isLoading = false
}) => {
  const [formData, setFormData] = useState<KYCData>({
    businessName: stepData?.businessName || '',
    businessType: stepData?.businessType || '',
    industryCategory: stepData?.industryCategory || '',
    registrationNumber: stepData?.registrationNumber || '',
    taxIdNumber: stepData?.taxIdNumber || '',
    incorporationDate: stepData?.incorporationDate || '',
    businessAddress: stepData?.businessAddress || {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'US'
    },
    ownerInformation: stepData?.ownerInformation || {
      fullName: '',
      dateOfBirth: '',
      idNumber: '',
      idType: ''
    },
    contactInformation: stepData?.contactInformation || {
      phone: '',
      email: '',
      website: ''
    },
    businessDescription: stepData?.businessDescription || '',
    estimatedRevenue: stepData?.estimatedRevenue || ''
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isValidating, setIsValidating] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState<string[]>([]);
  const [showBusinessLookup, setShowBusinessLookup] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [currentSection, setCurrentSection] = useState(0);

  const formSections: FormSection[] = [
    {
      id: 'business_info',
      title: 'Business Information',
      description: 'Basic details about your business',
      required: true,
      completed: !!(formData.businessName && formData.businessType && formData.industryCategory)
    },
    {
      id: 'business_address',
      title: 'Business Address',
      description: 'Your business operating address',
      required: true,
      completed: !!(
        formData.businessAddress.street &&
        formData.businessAddress.city &&
        formData.businessAddress.state &&
        formData.businessAddress.zipCode
      )
    },
    {
      id: 'owner_info',
      title: 'Owner Information',
      description: 'Information about the business owner',
      required: true,
      completed: !!formData.ownerInformation.fullName
    },
    {
      id: 'contact_info',
      title: 'Contact Information',
      description: 'How customers can reach your business',
      required: true,
      completed: !!(formData.contactInformation.phone && formData.contactInformation.email)
    }
  ];

  const completedSections = formSections.filter(section => section.completed).length;
  const completionPercentage = Math.round((completedSections / formSections.length) * 100);
  const isComplete = completedSections === formSections.length;

  // Real-time validation
  useEffect(() => {
    validateForm();
  }, [formData]);

  // Update parent component when complete
  useEffect(() => {
    if (isComplete) {
      const businessVerificationData: BusinessVerificationData = {
        ...formData,
        completionPercentage,
        validationErrors,
        isComplete,
        autoFilledFields
      };
      onComplete?.(businessVerificationData);
    }
  }, [isComplete, formData, completionPercentage, validationErrors, autoFilledFields, onComplete]);

  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};

    // Business name validation
    if (!formData.businessName.trim()) {
      errors.businessName = 'Business name is required';
    } else if (formData.businessName.length < 2) {
      errors.businessName = 'Business name must be at least 2 characters';
    }

    // Business type validation
    if (!formData.businessType) {
      errors.businessType = 'Business type is required';
    }

    // Industry category validation
    if (!formData.industryCategory) {
      errors.industryCategory = 'Industry category is required';
    }

    // Address validation
    if (!formData.businessAddress.street.trim()) {
      errors.street = 'Street address is required';
    }
    if (!formData.businessAddress.city.trim()) {
      errors.city = 'City is required';
    }
    if (!formData.businessAddress.state.trim()) {
      errors.state = 'State is required';
    }
    if (!formData.businessAddress.zipCode.trim()) {
      errors.zipCode = 'ZIP code is required';
    } else if (!/^\d{5}(-\d{4})?$/.test(formData.businessAddress.zipCode)) {
      errors.zipCode = 'Please enter a valid ZIP code';
    }

    // Owner information validation
    if (!formData.ownerInformation.fullName.trim()) {
      errors.ownerFullName = 'Owner full name is required';
    }

    // Contact information validation
    if (!formData.contactInformation.phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (!/^\+?[1-9]\d{1,14}$/.test(formData.contactInformation.phone.replace(/\s|-/g, ''))) {
      errors.phone = 'Please enter a valid phone number';
    }

    if (!formData.contactInformation.email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactInformation.email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Website validation (optional)
    if (formData.contactInformation.website && 
        !/^https?:\/\/.+\..+/.test(formData.contactInformation.website)) {
      errors.website = 'Please enter a valid website URL (include http:// or https://)';
    }

    setValidationErrors(errors);
  }, [formData]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev };
      
      // Handle nested objects
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        (newData as any)[parent] = {
          ...(newData as any)[parent],
          [child]: value
        };
      } else {
        (newData as any)[field] = value;
      }
      
      return newData;
    });
  };

  const lookupBusinessInformation = useCallback(async (businessName: string) => {
    if (!businessName || businessName.length < 3) return;

    setIsValidating(true);
    try {
      // Mock business lookup API call
      // In reality, this would integrate with services like:
      // - OpenCorporates API
      // - SEC Edgar database
      // - State business registries
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay
      
      // Mock auto-filled data
      const mockData = {
        registrationNumber: 'ABC123456789',
        taxIdNumber: '12-3456789',
        incorporationDate: '2020-01-15',
        businessAddress: {
          ...formData.businessAddress,
          street: '123 Business St',
          city: 'Business City',
          state: 'CA',
          zipCode: '90210'
        }
      };

      // Update form data with auto-filled information
      setFormData(prev => ({
        ...prev,
        ...mockData
      }));

      // Track auto-filled fields
      setAutoFilledFields(['registrationNumber', 'taxIdNumber', 'incorporationDate', 'businessAddress']);
      
    } catch (error) {
      console.error('Business lookup failed:', error);
    } finally {
      setIsValidating(false);
      setShowBusinessLookup(false);
    }
  }, [formData.businessAddress]);

  const searchAddresses = useCallback(async (query: string) => {
    if (query.length < 5) {
      setAddressSuggestions([]);
      return;
    }

    try {
      // Mock address lookup
      // In reality, this would use Google Places API, HERE API, etc.
      const mockSuggestions = [
        {
          description: `${query}, Business City, CA 90210`,
          structured_formatting: {
            main_text: query,
            secondary_text: 'Business City, CA 90210'
          }
        }
      ];

      setAddressSuggestions(mockSuggestions);
    } catch (error) {
      console.error('Address search failed:', error);
    }
  }, []);

  const selectAddress = (suggestion: any) => {
    const parts = suggestion.structured_formatting.secondary_text.split(', ');
    handleInputChange('businessAddress.street', suggestion.structured_formatting.main_text);
    handleInputChange('businessAddress.city', parts[0] || '');
    handleInputChange('businessAddress.state', parts[1] || '');
    handleInputChange('businessAddress.zipCode', parts[2] || '');
    setAddressSuggestions([]);
  };

  const renderSectionIndicators = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-cream">Business Information</h3>
        <span className="text-sage/70 text-sm">{completionPercentage}% Complete</span>
      </div>
      
      <div className="w-full bg-navy-dark/30 rounded-full h-2 mb-6">
        <motion.div
          className="h-2 bg-gradient-to-r from-teal-primary to-teal-secondary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${completionPercentage}%` }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {formSections.map((section, index) => {
          const isCurrent = index === currentSection;
          const isCompleted = section.completed;
          
          return (
            <motion.button
              key={section.id}
              onClick={() => setCurrentSection(index)}
              className={cn(
                'p-3 rounded-lg border transition-all duration-200 text-left',
                isCompleted && 'border-green-500/50 bg-green-500/10',
                isCurrent && !isCompleted && 'border-teal-primary/50 bg-teal-primary/10',
                !isCurrent && !isCompleted && 'border-sage/20 hover:border-sage/40'
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center space-x-2 mb-2">
                {isCompleted ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <div className={cn(
                    'w-4 h-4 rounded-full border-2',
                    isCurrent ? 'border-teal-primary' : 'border-sage/50'
                  )} />
                )}
                <span className="font-medium text-cream text-sm">{section.title}</span>
              </div>
              <p className="text-sage/70 text-xs">{section.description}</p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );

  const renderBusinessInformation = () => (
    <div className="space-y-6">
      {/* Business Lookup */}
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-cream">Business Information</h4>
        <motion.button
          onClick={() => setShowBusinessLookup(true)}
          className="px-3 py-2 text-sm text-teal-primary hover:text-teal-secondary transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Search className="w-4 h-4 mr-1" />
          Auto-fill from registry
        </motion.button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Business Name */}
        <div className="md:col-span-2">
          <label htmlFor="businessName" className="block text-sm font-medium text-cream mb-2">
            Business Name *
          </label>
          <div className="relative">
            <input
              type="text"
              id="businessName"
              value={formData.businessName}
              onChange={(e) => handleInputChange('businessName', e.target.value)}
              className={cn(
                'w-full py-3 px-4 rounded-lg bg-navy-dark/50 backdrop-blur-sm border text-cream',
                'placeholder-sage/50 focus:outline-none focus:ring-2',
                validationErrors.businessName 
                  ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50'
                  : 'border-sage/20 focus:ring-teal-primary/50 focus:border-teal-primary/50'
              )}
              placeholder="Enter your legal business name"
            />
            {autoFilledFields.includes('businessName') && (
              <div className="absolute right-3 top-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
            )}
          </div>
          {validationErrors.businessName && (
            <p className="text-red-400 text-sm mt-1">{validationErrors.businessName}</p>
          )}
        </div>

        {/* Business Type */}
        <div>
          <label htmlFor="businessType" className="block text-sm font-medium text-cream mb-2">
            Business Type *
          </label>
          <select
            id="businessType"
            value={formData.businessType}
            onChange={(e) => handleInputChange('businessType', e.target.value)}
            className={cn(
              'w-full py-3 px-4 rounded-lg bg-navy-dark/50 backdrop-blur-sm border text-cream',
              'focus:outline-none focus:ring-2',
              validationErrors.businessType
                ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50'
                : 'border-sage/20 focus:ring-teal-primary/50 focus:border-teal-primary/50'
            )}
          >
            <option value="">Select business type</option>
            {BUSINESS_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          {validationErrors.businessType && (
            <p className="text-red-400 text-sm mt-1">{validationErrors.businessType}</p>
          )}
          {formData.businessType && (
            <div className="mt-2 p-3 bg-teal-primary/10 border border-teal-primary/20 rounded text-sm">
              <p className="text-teal-200">
                {BUSINESS_TYPES.find(t => t.value === formData.businessType)?.description}
              </p>
            </div>
          )}
        </div>

        {/* Industry Category */}
        <div>
          <label htmlFor="industryCategory" className="block text-sm font-medium text-cream mb-2">
            Industry Category *
          </label>
          <select
            id="industryCategory"
            value={formData.industryCategory}
            onChange={(e) => handleInputChange('industryCategory', e.target.value)}
            className={cn(
              'w-full py-3 px-4 rounded-lg bg-navy-dark/50 backdrop-blur-sm border text-cream',
              'focus:outline-none focus:ring-2',
              validationErrors.industryCategory
                ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50'
                : 'border-sage/20 focus:ring-teal-primary/50 focus:border-teal-primary/50'
            )}
          >
            <option value="">Select industry</option>
            {INDUSTRY_CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
          {validationErrors.industryCategory && (
            <p className="text-red-400 text-sm mt-1">{validationErrors.industryCategory}</p>
          )}
          {formData.industryCategory && (() => {
            const category = INDUSTRY_CATEGORIES.find(c => c.value === formData.industryCategory);
            return category && (
              <div className={cn(
                'mt-2 p-3 border rounded text-sm',
                category.riskLevel === 'high' && 'bg-red-500/10 border-red-500/20 text-red-200',
                category.riskLevel === 'medium' && 'bg-orange-500/10 border-orange-500/20 text-orange-200',
                category.riskLevel === 'low' && 'bg-green-500/10 border-green-500/20 text-green-200'
              )}>
                <p>{category.description}</p>
                {category.complianceRequirements && (
                  <p className="mt-1 text-xs">
                    Additional requirements may apply: {category.complianceRequirements.join(', ')}
                  </p>
                )}
              </div>
            );
          })()}
        </div>

        {/* Registration Number */}
        <div>
          <label htmlFor="registrationNumber" className="block text-sm font-medium text-cream mb-2">
            Registration Number
          </label>
          <div className="relative">
            <input
              type="text"
              id="registrationNumber"
              value={formData.registrationNumber || ''}
              onChange={(e) => handleInputChange('registrationNumber', e.target.value)}
              className="w-full py-3 px-4 rounded-lg bg-navy-dark/50 backdrop-blur-sm border border-sage/20 text-cream placeholder-sage/50 focus:outline-none focus:ring-2 focus:ring-teal-primary/50 focus:border-teal-primary/50"
              placeholder="Business registration number"
            />
            {autoFilledFields.includes('registrationNumber') && (
              <div className="absolute right-3 top-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
            )}
          </div>
        </div>

        {/* Tax ID */}
        <div>
          <label htmlFor="taxIdNumber" className="block text-sm font-medium text-cream mb-2">
            Tax ID (EIN)
          </label>
          <div className="relative">
            <input
              type="text"
              id="taxIdNumber"
              value={formData.taxIdNumber || ''}
              onChange={(e) => handleInputChange('taxIdNumber', e.target.value)}
              className="w-full py-3 px-4 rounded-lg bg-navy-dark/50 backdrop-blur-sm border border-sage/20 text-cream placeholder-sage/50 focus:outline-none focus:ring-2 focus:ring-teal-primary/50 focus:border-teal-primary/50"
              placeholder="XX-XXXXXXX"
            />
            {autoFilledFields.includes('taxIdNumber') && (
              <div className="absolute right-3 top-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Business Description */}
      <div>
        <label htmlFor="businessDescription" className="block text-sm font-medium text-cream mb-2">
          Business Description
        </label>
        <textarea
          id="businessDescription"
          value={formData.businessDescription || ''}
          onChange={(e) => handleInputChange('businessDescription', e.target.value)}
          rows={3}
          className="w-full py-3 px-4 rounded-lg bg-navy-dark/50 backdrop-blur-sm border border-sage/20 text-cream placeholder-sage/50 focus:outline-none focus:ring-2 focus:ring-teal-primary/50 focus:border-teal-primary/50"
          placeholder="Briefly describe what your business does..."
        />
      </div>

      {/* Estimated Revenue */}
      <div>
        <label htmlFor="estimatedRevenue" className="block text-sm font-medium text-cream mb-2">
          Estimated Annual Revenue
        </label>
        <select
          id="estimatedRevenue"
          value={formData.estimatedRevenue || ''}
          onChange={(e) => handleInputChange('estimatedRevenue', e.target.value)}
          className="w-full py-3 px-4 rounded-lg bg-navy-dark/50 backdrop-blur-sm border border-sage/20 text-cream focus:outline-none focus:ring-2 focus:ring-teal-primary/50 focus:border-teal-primary/50"
        >
          <option value="">Select revenue range</option>
          {REVENUE_RANGES.map((range) => (
            <option key={range.value} value={range.value}>
              {range.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  const renderBusinessAddress = () => (
    <div className="space-y-6">
      <h4 className="font-medium text-cream">Business Address</h4>
      
      <div className="space-y-4">
        {/* Street Address */}
        <div>
          <label htmlFor="street" className="block text-sm font-medium text-cream mb-2">
            Street Address *
          </label>
          <div className="relative">
            <input
              type="text"
              id="street"
              value={formData.businessAddress.street}
              onChange={(e) => {
                handleInputChange('businessAddress.street', e.target.value);
                searchAddresses(e.target.value);
              }}
              className={cn(
                'w-full py-3 px-4 rounded-lg bg-navy-dark/50 backdrop-blur-sm border text-cream',
                'placeholder-sage/50 focus:outline-none focus:ring-2',
                validationErrors.street
                  ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50'
                  : 'border-sage/20 focus:ring-teal-primary/50 focus:border-teal-primary/50'
              )}
              placeholder="Enter street address"
            />
            {autoFilledFields.includes('businessAddress') && (
              <div className="absolute right-3 top-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
            )}
          </div>
          {validationErrors.street && (
            <p className="text-red-400 text-sm mt-1">{validationErrors.street}</p>
          )}
          
          {/* Address Suggestions */}
          {addressSuggestions.length > 0 && (
            <div className="mt-2 border border-sage/20 rounded-lg bg-navy-dark/50 backdrop-blur-sm">
              {addressSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => selectAddress(suggestion)}
                  className="w-full p-3 text-left hover:bg-sage/10 transition-colors first:rounded-t-lg last:rounded-b-lg"
                >
                  <p className="text-cream text-sm">{suggestion.structured_formatting.main_text}</p>
                  <p className="text-sage/70 text-xs">{suggestion.structured_formatting.secondary_text}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* City */}
          <div>
            <label htmlFor="city" className="block text-sm font-medium text-cream mb-2">
              City *
            </label>
            <input
              type="text"
              id="city"
              value={formData.businessAddress.city}
              onChange={(e) => handleInputChange('businessAddress.city', e.target.value)}
              className={cn(
                'w-full py-3 px-4 rounded-lg bg-navy-dark/50 backdrop-blur-sm border text-cream',
                'placeholder-sage/50 focus:outline-none focus:ring-2',
                validationErrors.city
                  ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50'
                  : 'border-sage/20 focus:ring-teal-primary/50 focus:border-teal-primary/50'
              )}
              placeholder="City"
            />
            {validationErrors.city && (
              <p className="text-red-400 text-sm mt-1">{validationErrors.city}</p>
            )}
          </div>

          {/* State */}
          <div>
            <label htmlFor="state" className="block text-sm font-medium text-cream mb-2">
              State *
            </label>
            <input
              type="text"
              id="state"
              value={formData.businessAddress.state}
              onChange={(e) => handleInputChange('businessAddress.state', e.target.value)}
              className={cn(
                'w-full py-3 px-4 rounded-lg bg-navy-dark/50 backdrop-blur-sm border text-cream',
                'placeholder-sage/50 focus:outline-none focus:ring-2',
                validationErrors.state
                  ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50'
                  : 'border-sage/20 focus:ring-teal-primary/50 focus:border-teal-primary/50'
              )}
              placeholder="State"
            />
            {validationErrors.state && (
              <p className="text-red-400 text-sm mt-1">{validationErrors.state}</p>
            )}
          </div>

          {/* ZIP Code */}
          <div>
            <label htmlFor="zipCode" className="block text-sm font-medium text-cream mb-2">
              ZIP Code *
            </label>
            <input
              type="text"
              id="zipCode"
              value={formData.businessAddress.zipCode}
              onChange={(e) => handleInputChange('businessAddress.zipCode', e.target.value)}
              className={cn(
                'w-full py-3 px-4 rounded-lg bg-navy-dark/50 backdrop-blur-sm border text-cream',
                'placeholder-sage/50 focus:outline-none focus:ring-2',
                validationErrors.zipCode
                  ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50'
                  : 'border-sage/20 focus:ring-teal-primary/50 focus:border-teal-primary/50'
              )}
              placeholder="12345"
            />
            {validationErrors.zipCode && (
              <p className="text-red-400 text-sm mt-1">{validationErrors.zipCode}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderOwnerInformation = () => (
    <div className="space-y-6">
      <h4 className="font-medium text-cream">Owner Information</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Full Name */}
        <div className="md:col-span-2">
          <label htmlFor="ownerFullName" className="block text-sm font-medium text-cream mb-2">
            Full Name *
          </label>
          <input
            type="text"
            id="ownerFullName"
            value={formData.ownerInformation.fullName}
            onChange={(e) => handleInputChange('ownerInformation.fullName', e.target.value)}
            className={cn(
              'w-full py-3 px-4 rounded-lg bg-navy-dark/50 backdrop-blur-sm border text-cream',
              'placeholder-sage/50 focus:outline-none focus:ring-2',
              validationErrors.ownerFullName
                ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50'
                : 'border-sage/20 focus:ring-teal-primary/50 focus:border-teal-primary/50'
            )}
            placeholder="Business owner's full name"
          />
          {validationErrors.ownerFullName && (
            <p className="text-red-400 text-sm mt-1">{validationErrors.ownerFullName}</p>
          )}
        </div>

        {/* Date of Birth */}
        <div>
          <label htmlFor="dateOfBirth" className="block text-sm font-medium text-cream mb-2">
            Date of Birth
          </label>
          <input
            type="date"
            id="dateOfBirth"
            value={formData.ownerInformation.dateOfBirth || ''}
            onChange={(e) => handleInputChange('ownerInformation.dateOfBirth', e.target.value)}
            className="w-full py-3 px-4 rounded-lg bg-navy-dark/50 backdrop-blur-sm border border-sage/20 text-cream focus:outline-none focus:ring-2 focus:ring-teal-primary/50 focus:border-teal-primary/50"
          />
        </div>

        {/* ID Type */}
        <div>
          <label htmlFor="idType" className="block text-sm font-medium text-cream mb-2">
            ID Type
          </label>
          <select
            id="idType"
            value={formData.ownerInformation.idType || ''}
            onChange={(e) => handleInputChange('ownerInformation.idType', e.target.value)}
            className="w-full py-3 px-4 rounded-lg bg-navy-dark/50 backdrop-blur-sm border border-sage/20 text-cream focus:outline-none focus:ring-2 focus:ring-teal-primary/50 focus:border-teal-primary/50"
          >
            <option value="">Select ID type</option>
            <option value="drivers_license">Driver's License</option>
            <option value="passport">Passport</option>
            <option value="state_id">State ID</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderContactInformation = () => (
    <div className="space-y-6">
      <h4 className="font-medium text-cream">Contact Information</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Phone */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-cream mb-2">
            Phone Number *
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-3 w-5 h-5 text-sage/50" />
            <input
              type="tel"
              id="phone"
              value={formData.contactInformation.phone}
              onChange={(e) => handleInputChange('contactInformation.phone', e.target.value)}
              className={cn(
                'w-full py-3 pl-10 pr-4 rounded-lg bg-navy-dark/50 backdrop-blur-sm border text-cream',
                'placeholder-sage/50 focus:outline-none focus:ring-2',
                validationErrors.phone
                  ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50'
                  : 'border-sage/20 focus:ring-teal-primary/50 focus:border-teal-primary/50'
              )}
              placeholder="+1 (555) 123-4567"
            />
          </div>
          {validationErrors.phone && (
            <p className="text-red-400 text-sm mt-1">{validationErrors.phone}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-cream mb-2">
            Email Address *
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 w-5 h-5 text-sage/50" />
            <input
              type="email"
              id="email"
              value={formData.contactInformation.email}
              onChange={(e) => handleInputChange('contactInformation.email', e.target.value)}
              className={cn(
                'w-full py-3 pl-10 pr-4 rounded-lg bg-navy-dark/50 backdrop-blur-sm border text-cream',
                'placeholder-sage/50 focus:outline-none focus:ring-2',
                validationErrors.email
                  ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50'
                  : 'border-sage/20 focus:ring-teal-primary/50 focus:border-teal-primary/50'
              )}
              placeholder="business@example.com"
            />
          </div>
          {validationErrors.email && (
            <p className="text-red-400 text-sm mt-1">{validationErrors.email}</p>
          )}
        </div>

        {/* Website */}
        <div className="md:col-span-2">
          <label htmlFor="website" className="block text-sm font-medium text-cream mb-2">
            Website (Optional)
          </label>
          <div className="relative">
            <Globe className="absolute left-3 top-3 w-5 h-5 text-sage/50" />
            <input
              type="url"
              id="website"
              value={formData.contactInformation.website || ''}
              onChange={(e) => handleInputChange('contactInformation.website', e.target.value)}
              className={cn(
                'w-full py-3 pl-10 pr-4 rounded-lg bg-navy-dark/50 backdrop-blur-sm border text-cream',
                'placeholder-sage/50 focus:outline-none focus:ring-2',
                validationErrors.website
                  ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50'
                  : 'border-sage/20 focus:ring-teal-primary/50 focus:border-teal-primary/50'
              )}
              placeholder="https://www.yourwebsite.com"
            />
          </div>
          {validationErrors.website && (
            <p className="text-red-400 text-sm mt-1">{validationErrors.website}</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderCurrentSection = () => {
    switch (currentSection) {
      case 0:
        return renderBusinessInformation();
      case 1:
        return renderBusinessAddress();
      case 2:
        return renderOwnerInformation();
      case 3:
        return renderContactInformation();
      default:
        return null;
    }
  };

  const renderBusinessLookupModal = () => (
    <AnimatePresence>
      {showBusinessLookup && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-dark/80 backdrop-blur-sm p-4"
          onClick={() => setShowBusinessLookup(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md"
          >
            <GlassMorphism variant="medium" className="p-6">
              <h3 className="text-lg font-semibold text-cream mb-4">
                Business Registry Lookup
              </h3>
              <p className="text-sage/90 text-sm mb-6">
                Search for your business in public registries to auto-fill information.
              </p>
              
              <div className="space-y-4">
                <input
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => handleInputChange('businessName', e.target.value)}
                  placeholder="Enter exact business name"
                  className="w-full py-3 px-4 rounded-lg bg-navy-dark/50 backdrop-blur-sm border border-sage/20 text-cream placeholder-sage/50 focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
                />
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowBusinessLookup(false)}
                    className="flex-1 px-4 py-2 text-sage/70 hover:text-sage transition-colors"
                  >
                    Cancel
                  </button>
                  <motion.button
                    onClick={() => lookupBusinessInformation(formData.businessName)}
                    disabled={isValidating || !formData.businessName}
                    className={cn(
                      'flex-1 px-4 py-2 bg-teal-primary hover:bg-teal-secondary',
                      'text-cream font-medium rounded-lg transition-colors',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isValidating ? 'Searching...' : 'Search'}
                  </motion.button>
                </div>
              </div>
            </GlassMorphism>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="space-y-6">
      {renderSectionIndicators()}
      
      <GlassMorphism variant="light" className="p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSection}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderCurrentSection()}
          </motion.div>
        </AnimatePresence>
      </GlassMorphism>

      {/* Navigation */}
      <div className="flex justify-between">
        <motion.button
          onClick={() => setCurrentSection(Math.max(0, currentSection - 1))}
          disabled={currentSection === 0}
          className={cn(
            'px-6 py-3 rounded-lg font-medium transition-all duration-200',
            'border border-sage/30 text-sage hover:text-cream',
            'hover:border-sage/50 hover:bg-sage/10',
            'focus:outline-none focus:ring-2 focus:ring-sage/50',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          whileHover={{ scale: currentSection === 0 ? 1 : 1.02 }}
          whileTap={{ scale: currentSection === 0 ? 1 : 0.98 }}
        >
          Previous
        </motion.button>

        <motion.button
          onClick={() => {
            if (currentSection < formSections.length - 1) {
              setCurrentSection(currentSection + 1);
            }
          }}
          disabled={currentSection >= formSections.length - 1}
          className={cn(
            'px-6 py-3 bg-teal-primary hover:bg-teal-secondary',
            'text-cream font-medium rounded-lg transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          whileHover={{ scale: currentSection >= formSections.length - 1 ? 1 : 1.02 }}
          whileTap={{ scale: currentSection >= formSections.length - 1 ? 1 : 0.98 }}
        >
          Next
        </motion.button>
      </div>

      {/* Continue Button */}
      {isComplete && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-end mt-6"
        >
          <motion.button
            onClick={() => onComplete?.({
              ...formData,
              completionPercentage,
              validationErrors,
              isComplete,
              autoFilledFields
            })}
            className={cn(
              'px-8 py-3 bg-green-500 hover:bg-green-600',
              'text-cream font-medium rounded-lg transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-green-500/50'
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Continue to Review'}
          </motion.button>
        </motion.div>
      )}

      {/* Auto-fill Success Message */}
      {autoFilledFields.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg"
        >
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-green-300 font-medium mb-1">Information Auto-filled</p>
              <p className="text-green-200 text-sm">
                We've automatically filled some fields from public records. Please review and update as needed.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Business Lookup Modal */}
      {renderBusinessLookupModal()}
    </div>
  );
};

export default BusinessVerification;