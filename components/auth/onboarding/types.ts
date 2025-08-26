export interface OnboardingData {
  // Account Creation
  email: string;
  password: string;
  authMethod: 'email' | 'google' | 'apple';
  
  // Email Verification
  emailVerified: boolean;
  verificationCode?: string;
  
  // Profile Basics
  firstName: string;
  lastName: string;
  userType: 'customer' | 'business_owner' | 'service_provider' | 'other';
  location?: {
    city: string;
    state: string;
    country: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  phone?: string;
  avatar?: string;
  
  // Preferences
  notificationPreferences?: {
    email: boolean;
    push: boolean;
    sms: boolean;
    marketing: boolean;
  };
  privacySettings?: {
    profileVisibility: 'public' | 'friends' | 'private';
    showLocation: boolean;
    allowMessages: boolean;
  };
  
  // Personalization
  interests?: string[];
  favoriteCategories?: string[];
  searchRadius?: number;
  communicationLanguage?: string;
  
  // Business-specific (if business owner)
  businessInfo?: {
    businessName: string;
    businessType: string;
    taxId?: string;
    website?: string;
    documents?: {
      type: string;
      url: string;
      status: 'pending' | 'approved' | 'rejected';
    }[];
    verificationStatus?: 'pending' | 'verified' | 'rejected';
  };
  
  // Meta
  completedAt?: Date;
  skippedSteps?: number[];
  tourCompleted?: boolean;
}

export interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  component: React.ComponentType;
  required: boolean;
  validation?: (data: Partial<OnboardingData>) => boolean;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  points: number;
  unlockedAt?: Date;
  progress?: number;
  maxProgress?: number;
}

export interface TourStep {
  id: string;
  target: string; // CSS selector for spotlight
  title: string;
  content: string;
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface VerificationStatus {
  sent: boolean;
  verified: boolean;
  attempts: number;
  lastAttempt?: Date;
  resendAvailableAt?: Date;
  expiresAt?: Date;
}

export interface ProfileCompletionMetrics {
  percentage: number;
  requiredFields: {
    field: string;
    label: string;
    completed: boolean;
    points: number;
  }[];
  optionalFields: {
    field: string;
    label: string;
    completed: boolean;
    points: number;
  }[];
  totalPoints: number;
  earnedPoints: number;
  nextReward?: {
    name: string;
    description: string;
    pointsRequired: number;
  };
}

export interface BusinessVerification {
  step: 'info' | 'documents' | 'review' | 'complete';
  status: 'pending' | 'in_review' | 'approved' | 'rejected';
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewer?: string;
  comments?: string;
  requiredDocuments: {
    type: string;
    label: string;
    required: boolean;
    uploaded: boolean;
    status?: 'pending' | 'approved' | 'rejected';
  }[];
  estimatedReviewTime?: string;
}

export interface OnboardingAnalytics {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  completionTime?: number;
  steps: {
    stepId: number;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    completed: boolean;
    skipped?: boolean;
    errors?: string[];
  }[];
  dropOffStep?: number;
  conversionRate?: number;
  userAgent: string;
  device: 'mobile' | 'tablet' | 'desktop';
}