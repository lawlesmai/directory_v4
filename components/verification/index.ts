// Main KYC Wizard Component
export { KYCWizard, type KYCWizardProps, type VerificationResult } from './KYCWizard';

// Individual Step Components
export { DocumentUploader, type DocumentUploaderProps, type DocumentUploadData, type UploadedDocument } from './DocumentUploader';
export { IdentityVerification, type IdentityVerificationProps, type IdentityVerificationData, type LivenessData } from './IdentityVerification';
export { BusinessVerification, type BusinessVerificationProps, type BusinessVerificationData } from './BusinessVerification';
export { VerificationDashboard, type VerificationDashboardProps, type VerificationDashboardData } from './VerificationDashboard';

// Support Components
export { ComplianceEducation, type ComplianceEducationProps, type ComplianceEducationData } from './ComplianceEducation';
export { AppealProcess, type AppealProcessProps, type AppealData } from './AppealProcess';

// Type Exports
export type {
  VerificationStep,
  StepData,
  DocumentType,
  VerificationStatus,
  ExtractedIdData,
  SubmittedDocument,
  TimelineEvent
} from './KYCWizard';