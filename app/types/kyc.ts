export interface DocumentUpload {
  id: string;
  type: string;
  data: Buffer;
  isBlurry?: boolean;
  isSuspicious?: boolean;
}

export interface DocumentVerificationResult {
  isValid: boolean;
  error?: string;
}
