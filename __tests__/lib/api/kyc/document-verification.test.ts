import { describe, it, expect } from '@jest/globals';
import { DocumentVerificationService } from '@/services/kyc/document-verification';
import { mockDocumentUpload, generateMockDocuments } from '@/mocks/kyc-mocks';

describe('KYC Document Verification', () => {
  const documentService = new DocumentVerificationService();

  describe('Document Upload Validation', () => {
    it('should validate supported document types', async () => {
      const supportedTypes = ['passport', 'driver_license', 'national_id'];
      const validDocuments = generateMockDocuments(supportedTypes);

      for (const doc of validDocuments) {
        const result = await documentService.validateDocumentType(doc);
        expect(result.isValid).toBeTruthy();
      }
    });

    it('should reject unsupported document types', async () => {
      const invalidDocuments = [
        { type: 'fake_document', data: Buffer.from('invalid') },
        { type: 'expired_passport', data: Buffer.from('outdated') }
      ];

      for (const doc of invalidDocuments) {
        const result = await documentService.validateDocumentType(doc);
        expect(result.isValid).toBeFalsy();
        expect(result.error).toBeDefined();
      }
    });

    it('should enforce document file size limits', async () => {
      const largeDocument = mockDocumentUpload('passport', 20 * 1024 * 1024); // 20MB
      const result = await documentService.validateDocumentSize(largeDocument);
      
      expect(result.isValid).toBeFalsy();
      expect(result.error).toContain('File size exceeds maximum limit');
    });
  });

  describe('OCR Processing', () => {
    it('should accurately extract text from clear documents', async () => {
      const clearDocument = mockDocumentUpload('driver_license');
      const ocrResult = await documentService.extractDocumentText(clearDocument);
      
      expect(ocrResult.confidence).toBeGreaterThan(0.85);
      expect(ocrResult.extractedFields).toHaveProperty('name');
      expect(ocrResult.extractedFields).toHaveProperty('documentNumber');
    });

    it('should handle low-quality document images', async () => {
      const blurryDocument = mockDocumentUpload('passport', undefined, true);
      const ocrResult = await documentService.extractDocumentText(blurryDocument);
      
      expect(ocrResult.confidence).toBeLessThan(0.7);
      expect(ocrResult.warnings).toContain('Low image quality');
    });
  });

  describe('Document Authenticity', () => {
    it('should detect potential document forgeries', async () => {
      const suspiciousDocument = mockDocumentUpload('national_id', undefined, false, true);
      const authenticityResult = await documentService.checkDocumentAuthenticity(suspiciousDocument);
      
      expect(authenticityResult.isSuspicious).toBeTruthy();
      expect(authenticityResult.suspicionReasons).toHaveLength(1);
    });

    it('should validate document security features', async () => {
      const validDocument = mockDocumentUpload('passport');
      const securityCheck = await documentService.validateSecurityFeatures(validDocument);
      
      expect(securityCheck.hasValidHologram).toBeTruthy();
      expect(securityCheck.hasValidWatermark).toBeTruthy();
    });
  });

  describe('Document Storage Security', () => {
    it('should encrypt documents before storage', async () => {
      const document = mockDocumentUpload('driver_license');
      const storedDocument = await documentService.storeDocument(document);
      
      expect(storedDocument.isEncrypted).toBeTruthy();
      expect(storedDocument.encryptionMethod).toBe('AES-256-GCM');
    });

    it('should securely delete documents after verification', async () => {
      const document = mockDocumentUpload('national_id');
      await documentService.storeDocument(document);
      
      const deletionResult = await documentService.securelyDeleteDocument(document.id);
      expect(deletionResult.isDeleted).toBeTruthy();
      expect(deletionResult.overwriteMethod).toBe('multi-pass');
    });
  });
});
