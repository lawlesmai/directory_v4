import { z } from 'zod';
import type { PasswordRequirement, PasswordStrengthResult } from './types';

// Common validation patterns
const email = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .max(255, 'Email is too long');

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  );

const confirmPassword = (passwordField: string = 'password') =>
  z.string().min(1, 'Please confirm your password');

const name = z
  .string()
  .min(1, 'This field is required')
  .max(50, 'Name is too long')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes');

const phone = z
  .string()
  .optional()
  .refine(
    (val) => !val || /^[\+]?[1-9][\d]{0,15}$/.test(val),
    'Please enter a valid phone number'
  );

// Login form schema
export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false)
});

export type LoginFormData = z.infer<typeof loginSchema>;

// Registration form schema
export const registerSchema = z
  .object({
    firstName: name,
    lastName: name,
    email,
    phone,
    password,
    confirmPassword: confirmPassword(),
    businessType: z.enum(['customer', 'business_owner', 'service_provider'], {
      required_error: 'Please select your account type'
    }),
    acceptTerms: z.boolean().refine(val => val === true, {
      message: 'You must accept the terms and conditions'
    }),
    subscribeNewsletter: z.boolean().default(false)
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  });

export type RegisterFormData = z.infer<typeof registerSchema>;

// Password reset form schema
export const passwordResetSchema = z.object({
  email
});

export type PasswordResetFormData = z.infer<typeof passwordResetSchema>;

// New password form schema (for reset flow)
export const newPasswordSchema = z
  .object({
    password,
    confirmPassword: confirmPassword()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  });

export type NewPasswordFormData = z.infer<typeof newPasswordSchema>;

// Email verification form schema
export const emailVerificationSchema = z.object({
  code: z
    .string()
    .length(6, 'Verification code must be 6 digits')
    .regex(/^\d+$/, 'Verification code must contain only numbers')
});

export type EmailVerificationFormData = z.infer<typeof emailVerificationSchema>;

// Profile update form schema
export const profileUpdateSchema = z.object({
  firstName: name,
  lastName: name,
  phone,
  avatar: z.string().url('Please provide a valid URL').optional().or(z.literal('')),
  location: z.object({
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().min(1, 'Country is required')
  }).optional()
});

export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>;

// Change password form schema
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: password,
    confirmPassword: confirmPassword('newPassword')
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword']
  });

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

// Magic link form schema
export const magicLinkSchema = z.object({
  email
});

export type MagicLinkFormData = z.infer<typeof magicLinkSchema>;

// Two-factor authentication setup schema
export const twoFactorSetupSchema = z.object({
  code: z
    .string()
    .length(6, 'Authentication code must be 6 digits')
    .regex(/^\d+$/, 'Authentication code must contain only numbers'),
  backupCodes: z.array(z.string()).optional()
});

export type TwoFactorSetupFormData = z.infer<typeof twoFactorSetupSchema>;

// Field validation state utility
export type ValidationState = 'default' | 'success' | 'error' | 'warning';

export const getFieldValidationState = (
  hasError: boolean,
  isTouched?: boolean,
  value?: string
): ValidationState => {
  if (hasError) return 'error';
  if (isTouched && value && value.length > 0) return 'success';
  return 'default';
};

// Password strength checker
export const checkPasswordStrength = (password: string) => {
  const checks = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumbers: /\d/.test(password),
    hasSpecialChar: /[@$!%*?&]/.test(password),
    maxLength: password.length <= 128
  };

  const score = Object.values(checks).filter(Boolean).length;
  const percentage = Math.round((score / Object.keys(checks).length) * 100);

  let label: 'Weak' | 'Fair' | 'Good' | 'Strong';
  let color: string;

  if (percentage < 50) {
    label = 'Weak';
    color = 'text-red-error';
  } else if (percentage < 75) {
    label = 'Fair';
    color = 'text-yellow-500';
  } else if (percentage < 90) {
    label = 'Good';
    color = 'text-blue-400';
  } else {
    label = 'Strong';
    color = 'text-green-500';
  }

  return {
    score,
    percentage,
    label,
    color,
    checks
  };
};

// Email validation utility
export const isValidEmail = (email: string): boolean => {
  return loginSchema.shape.email.safeParse(email).success;
};

// Phone validation utility
export const isValidPhone = (phoneNumber: string): boolean => {
  return phone.safeParse(phoneNumber).success;
};

// Common validation messages
export const ValidationMessages = {
  required: 'This field is required',
  email: 'Please enter a valid email address',
  password: {
    required: 'Password is required',
    minLength: 'Password must be at least 8 characters',
    strength: 'Password must contain uppercase, lowercase, number, and special character'
  },
  confirmPassword: {
    required: 'Please confirm your password',
    mismatch: 'Passwords do not match'
  },
  name: {
    required: 'Name is required',
    invalid: 'Name can only contain letters, spaces, hyphens, and apostrophes',
    tooLong: 'Name is too long'
  },
  phone: 'Please enter a valid phone number',
  terms: 'You must accept the terms and conditions',
  code: {
    required: 'Verification code is required',
    invalid: 'Please enter a valid 6-digit code'
  }
} as const;

// Password requirement helpers
export const getPasswordRequirements = (password: string): PasswordRequirement[] => {
  return [
    {
      label: 'At least 8 characters',
      met: password.length >= 8,
      icon: 'hash'
    },
    {
      label: 'Contains uppercase letter',
      met: /[A-Z]/.test(password),
      icon: 'type'
    },
    {
      label: 'Contains lowercase letter',
      met: /[a-z]/.test(password),
      icon: 'type'
    },
    {
      label: 'Contains a number',
      met: /\d/.test(password),
      icon: 'hash'
    },
    {
      label: 'Contains special character',
      met: /[@$!%*?&]/.test(password),
      icon: 'key'
    }
  ];
};

// Get password strength with detailed scoring
export const getPasswordStrength = (password: string): PasswordStrengthResult => {
  const requirements = getPasswordRequirements(password);
  const metCount = requirements.filter(req => req.met).length;
  const totalRequirements = requirements.length;
  
  // Additional scoring factors
  let bonusScore = 0;
  if (password.length >= 12) bonusScore += 10;
  if (password.length >= 16) bonusScore += 10;
  if (/[^A-Za-z0-9@$!%*?&]/.test(password)) bonusScore += 5; // Uncommon special chars
  
  const basePercentage = (metCount / totalRequirements) * 80;
  const percentage = Math.min(basePercentage + bonusScore, 100);
  
  let label: 'Weak' | 'Fair' | 'Good' | 'Strong';
  let color: string;
  
  if (percentage < 40) {
    label = 'Weak';
    color = 'text-red-error';
  } else if (percentage < 60) {
    label = 'Fair';
    color = 'text-gold-primary';
  } else if (percentage < 80) {
    label = 'Good';
    color = 'text-teal-primary';
  } else {
    label = 'Strong';
    color = 'text-sage';
  }
  
  return {
    score: metCount,
    percentage,
    label,
    color,
    requirements
  };
};

// Check if password has been breached (mock implementation - replace with actual breach API)
export const checkPasswordBreach = async (password: string): Promise<boolean> => {
  // In production, use haveibeenpwned API or similar service
  const commonPasswords = ['password', '123456', 'password123', 'admin', 'letmein'];
  return commonPasswords.some(common => password.toLowerCase().includes(common));
};

// Generate secure password
export const generateSecurePassword = (length: number = 16): string => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '@$!%*?&';
  const all = uppercase + lowercase + numbers + special;
  
  let password = '';
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill remaining length
  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  
  // Shuffle password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};