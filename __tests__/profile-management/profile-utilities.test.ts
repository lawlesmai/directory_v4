import { 
  calculateProfileCompleteness, 
  validateAvatarUpload, 
  generatePrivacyToken 
} from '../../utils/profile-utils';

describe('Profile Utility Functions', () => {
  describe('Profile Completeness Calculation', () => {
    test('Calculates completeness correctly', () => {
      const partialProfile = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        avatar: null,
        businessDetails: null
      };

      const completeProfile = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        avatar: 'http://example.com/avatar.jpg',
        businessDetails: {
          name: 'Acme Inc',
          verified: true
        }
      };

      expect(calculateProfileCompleteness(partialProfile)).toBe(60);
      expect(calculateProfileCompleteness(completeProfile)).toBe(100);
    });
  });

  describe('Avatar Upload Validation', () => {
    test('Validates avatar upload constraints', () => {
      const validAvatar = {
        file: Buffer.from('test image data'),
        type: 'image/jpeg',
        size: 500 * 1024 // 500 KB
      };

      const invalidSizeAvatar = {
        file: Buffer.from('test image data'),
        type: 'image/jpeg',
        size: 10 * 1024 * 1024 // 10 MB
      };

      const invalidTypeAvatar = {
        file: Buffer.from('test executable data'),
        type: 'application/exe',
        size: 100 * 1024
      };

      expect(validateAvatarUpload(validAvatar)).toBe(true);
      expect(validateAvatarUpload(invalidSizeAvatar)).toBe(false);
      expect(validateAvatarUpload(invalidTypeAvatar)).toBe(false);
    });
  });

  describe('Privacy Token Generation', () => {
    test('Generates unique privacy tokens', () => {
      const userEmail = 'test@example.com';
      const token1 = generatePrivacyToken(userEmail);
      const token2 = generatePrivacyToken(userEmail);

      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64);
      expect(/^[a-f0-9]{64}$/.test(token1)).toBe(true);
    });
  });
});
