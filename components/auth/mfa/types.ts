// MFA (Multi-Factor Authentication) Type Definitions

export type MFAMethod = 'totp' | 'sms' | 'backup_codes';
export type MFAStatus = 'enabled' | 'disabled' | 'pending_setup';

// MFA Factor Configuration
export interface MFAFactor {
  id: string;
  userId: string;
  type: MFAMethod;
  status: MFAStatus;
  friendlyName?: string;
  createdAt: Date;
  lastUsedAt?: Date;
  phoneNumber?: string; // For SMS
  isDefault?: boolean;
}

// TOTP (Time-based One-Time Password) Setup
export interface TOTPSetupData {
  secret: string;
  qrCodeUrl: string;
  manualEntryKey: string;
  issuer: string;
  accountName: string;
}

// SMS Setup
export interface SMSSetupData {
  phoneNumber: string;
  countryCode: string;
  isVerified: boolean;
  verificationId?: string;
}

// Backup Codes
export interface BackupCodesData {
  codes: string[];
  generatedAt: Date;
  usedCodes: string[];
  remainingCodes: number;
}

// Device Trust
export interface TrustedDevice {
  id: string;
  name: string;
  deviceType: 'mobile' | 'desktop' | 'tablet';
  browser: string;
  os: string;
  lastUsed: Date;
  trustedAt: Date;
  ipAddress: string;
  isCurrentDevice: boolean;
}

// MFA Verification Challenge
export interface MFAChallenge {
  id: string;
  userId: string;
  factors: MFAFactor[];
  requiredFactors: number;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  isLocked: boolean;
}

// MFA Verification Response
export interface MFAVerificationResponse {
  success: boolean;
  factorId?: string;
  deviceTrustToken?: string;
  error?: {
    code: string;
    message: string;
    remainingAttempts?: number;
  };
}

// MFA Setup Wizard State
export interface MFASetupWizardState {
  currentStep: number;
  totalSteps: number;
  selectedMethod?: MFAMethod;
  totpData?: TOTPSetupData;
  smsData?: SMSSetupData;
  backupCodes?: BackupCodesData;
  isVerified: boolean;
}

// MFA Management State
export interface MFAManagementState {
  factors: MFAFactor[];
  trustedDevices: TrustedDevice[];
  backupCodesRemaining: number;
  lastBackupCodeGeneration?: Date;
  enforcementLevel: 'optional' | 'required' | 'admin_only';
  gracePeriodEnds?: Date;
}

// Component Props Interfaces
export interface MFASetupWizardProps {
  userId: string;
  onComplete: (factor: MFAFactor) => void;
  onCancel: () => void;
  availableMethods?: MFAMethod[];
  className?: string;
}

export interface TOTPSetupProps {
  userId: string;
  onSetupComplete: (factorId: string) => void;
  onError: (error: string) => void;
  showManualEntry?: boolean;
  className?: string;
}

export interface SMSSetupProps {
  userId: string;
  onSetupComplete: (factorId: string) => void;
  onError: (error: string) => void;
  defaultCountryCode?: string;
  className?: string;
}

export interface BackupCodesProps {
  codes: string[];
  onConfirm: () => void;
  onDownload?: () => void;
  onPrint?: () => void;
  className?: string;
}

export interface MFAVerificationProps {
  challenge: MFAChallenge;
  onSuccess: (response: MFAVerificationResponse) => void;
  onError: (error: string) => void;
  onCancel?: () => void;
  showTrustDevice?: boolean;
  className?: string;
}

export interface CodeInputProps {
  length: number;
  onComplete: (code: string) => void;
  onChange?: (code: string) => void;
  onPaste?: (code: string) => void;
  autoFocus?: boolean;
  autoAdvance?: boolean;
  masked?: boolean;
  disabled?: boolean;
  error?: boolean;
  className?: string;
}

export interface DeviceTrustProps {
  devices: TrustedDevice[];
  onRevoke: (deviceId: string) => void;
  onRevokeAll?: () => void;
  currentDeviceId?: string;
  className?: string;
}

export interface MFARecoveryProps {
  onRecoveryMethodSelect: (method: 'backup_code' | 'email' | 'support') => void;
  showBackupCode?: boolean;
  showEmailRecovery?: boolean;
  showSupportContact?: boolean;
  className?: string;
}

// Utility Types
export interface MFAValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface MFAStatistics {
  totalFactors: number;
  enabledFactors: number;
  lastVerification?: Date;
  verificationCount: number;
  failedAttempts: number;
  trustedDevices: number;
}

// Event Types for Analytics
export interface MFAAnalyticsEvent {
  event: 
    | 'mfa_setup_started'
    | 'mfa_setup_completed'
    | 'mfa_setup_failed'
    | 'mfa_verification_started'
    | 'mfa_verification_success'
    | 'mfa_verification_failed'
    | 'mfa_factor_removed'
    | 'mfa_backup_codes_generated'
    | 'mfa_device_trusted'
    | 'mfa_device_revoked';
  properties?: {
    method?: MFAMethod;
    factorId?: string;
    deviceId?: string;
    errorCode?: string;
    duration?: number;
  };
  timestamp: Date;
}

// Configuration Options
export interface MFAConfiguration {
  enabledMethods: MFAMethod[];
  totpOptions?: {
    issuer: string;
    digits: 6 | 8;
    period: 30 | 60;
    algorithm: 'SHA1' | 'SHA256' | 'SHA512';
  };
  smsOptions?: {
    supportedCountries: string[];
    messageTemplate: string;
    resendDelay: number; // in seconds
    codeExpiry: number; // in seconds
  };
  backupCodesOptions?: {
    count: number;
    length: number;
    format: 'numeric' | 'alphanumeric';
    grouping?: number; // e.g., 4 for XXXX-XXXX
  };
  deviceTrustOptions?: {
    enabled: boolean;
    duration: number; // in days
    maxDevices: number;
  };
  verificationOptions?: {
    maxAttempts: number;
    lockoutDuration: number; // in minutes
    challengeExpiry: number; // in minutes
  };
}