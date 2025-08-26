import { EmailVerificationService } from '../../../utils/auth';

describe('EmailVerificationService', () => {
  const testEmail = 'test@example.com';

  describe('Token Generation', () => {
    it('should generate a valid verification token', () => {
      const token = EmailVerificationService.generateVerificationToken(testEmail);
      
      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate different tokens for different emails', () => {
      const token1 = EmailVerificationService.generateVerificationToken(testEmail);
      const token2 = EmailVerificationService.generateVerificationToken('another@example.com');
      
      expect(token1).not.toEqual(token2);
    });
  });

  describe('Token Validation', () => {
    it('should validate a generated token', () => {
      const token = EmailVerificationService.generateVerificationToken(testEmail);
      
      const isValid = EmailVerificationService.validateVerificationToken(testEmail, token);
      expect(isValid).toBeTruthy();
    });

    it('should invalidate tokens for different emails', () => {
      const token = EmailVerificationService.generateVerificationToken(testEmail);
      
      const isValid = EmailVerificationService.validateVerificationToken('wrong@example.com', token);
      expect(isValid).toBeFalsy();
    });
  });

  describe('Token Expiration', () => {
    it('should calculate remaining token validity', () => {
      const token = EmailVerificationService.generateVerificationToken(testEmail);
      
      const remainingValidity = EmailVerificationService.getRemainingTokenValidity(token);
      expect(remainingValidity).toBeGreaterThan(0);
      expect(remainingValidity).toBeLessThanOrEqual(15 * 60 * 1000); // 15 minutes in milliseconds
    });
  });
});
