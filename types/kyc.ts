export interface DocumentUpload {
  type: string;
  data: Buffer | string;
  isBlurry?: boolean;
  isSuspicious?: boolean;
}

export interface DocumentVerificationResult {
  isValid: boolean;
  error?: string;
  confidence?: number;
}