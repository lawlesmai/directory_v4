import { DocumentUpload } from '@/types/kyc';
import crypto from 'crypto';

export function mockDocumentUpload(
  type: string, 
  size?: number, 
  isBlurry?: boolean, 
  isSuspicious?: boolean
): DocumentUpload {
  return {
    id: crypto.randomBytes(16).toString('hex'),
    type,
    data: Buffer.from(crypto.randomBytes(size || 1024 * 1024)),
    isBlurry: isBlurry || false,
    isSuspicious: isSuspicious || false
  };
}

export function generateMockDocuments(types: string[]) {
  return types.map(type => mockDocumentUpload(type));
}
