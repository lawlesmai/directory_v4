// Main KYC Wizard Component
export { KYCWizard, type KYCWizardProps, type VerificationResult } from './KYCWizard';

// Individual Step Components
export { DocumentUploader, type DocumentUploaderProps, type DocumentUploadData, type UploadedDocument, type DocumentType } from './DocumentUploader';
export { IdentityVerification, type IdentityVerificationProps, type IdentityVerificationData, type LivenessData, type ExtractedIdData } from './IdentityVerification';
export { BusinessVerification, type BusinessVerificationProps, type BusinessVerificationData } from './BusinessVerification';
export { VerificationDashboard, type VerificationDashboardProps, type VerificationDashboardData, type VerificationStatus, type SubmittedDocument, type TimelineEvent } from './VerificationDashboard';

// Support Components
export { ComplianceEducation, type ComplianceEducationProps, type ComplianceEducationData } from './ComplianceEducation';
export { AppealProcess, type AppealProcessProps, type AppealData } from './AppealProcess';

// Type Exports
export type {
  VerificationStep,
  StepData
} from './KYCWizard';