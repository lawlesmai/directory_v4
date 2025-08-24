import { describe, it, expect } from '@jest/globals';
import { testUserProfileManagement } from '@/tests/utils/profile-testing';
import { supabaseClient } from '@/lib/supabase/client';

describe('User Profile Management & Settings', () => {
  describe('Profile Update Validation', () => {
    it('should update user profile with valid information', async () => {
      const updateProfileTest = await testUserProfileManagement(supabaseClient, {
        userId: 'user123',
        profileUpdates: {
          firstName: 'John',
          lastName: 'Doe',
          phoneNumber: '+1234567890',
          avatar: 'https://example.com/avatar.jpg'
        }
      });

      expect(updateProfileTest.updateSuccessful).toBe(true);
      expect(updateProfileTest.profileDataValidated).toBe(true);
    });

    it('should prevent invalid profile updates', async () => {
      const invalidUpdateCases = [
        { phoneNumber: 'invalid-phone' },
        { email: 'invalidemail' },
        { avatar: 'not-a-url' }
      ];

      for (const invalidUpdate of invalidUpdateCases) {
        const invalidUpdateTest = await testUserProfileManagement(supabaseClient, {
          userId: 'user123',
          profileUpdates: invalidUpdate
        });

        expect(invalidUpdateTest.updateSuccessful).toBe(false);
        expect(invalidUpdateTest.validationErrors).toHaveLength(1);
      }
    });
  });

  describe('Privacy & Consent Management', () => {
    it('should manage user privacy settings and consents', async () => {
      const privacySettingsTest = await testUserProfileManagement(supabaseClient, {
        userId: 'user123',
        testPrivacySettings: true,
        consents: {
          marketing: false,
          dataSharing: false,
          analytics: true
        }
      });

      expect(privacySettingsTest.settingsUpdated).toBe(true);
      expect(privacySettingsTest.consentLogged).toBe(true);
    });
  });

  describe('Security Settings', () => {
    it('should allow secure two-factor authentication setup', async () => {
      const twoFactorSetupTest = await testUserProfileManagement(supabaseClient, {
        userId: 'user123',
        setupTwoFactor: true,
        method: 'authenticator'
      });

      expect(twoFactorSetupTest.setupSuccessful).toBe(true);
      expect(twoFactorSetupTest.backupCodesGenerated).toBe(true);
    });

    it('should manage linked authentication providers', async () => {
      const providerLinkTest = await testUserProfileManagement(supabaseClient, {
        userId: 'user123',
        linkProviders: ['google', 'apple']
      });

      expect(providerLinkTest.providersLinked).toHaveLength(2);
      expect(providerLinkTest.linkingSecure).toBe(true);
    });
  });

  describe('Profile Management Performance', () => {
    it('should complete profile operations within performance thresholds', async () => {
      const performanceMetrics = await testUserProfileManagement(supabaseClient, {
        measurePerformance: true
      });

      expect(performanceMetrics.profileUpdateTime).toBeLessThanOrEqual(200); // ms
      expect(performanceMetrics.settingsRetrievalTime).toBeLessThanOrEqual(100); // ms
    });
  });

  describe('Compliance & Data Protection', () => {
    it('should support GDPR data export and deletion requests', async () => {
      const gdprComplianceTest = await testUserProfileManagement(supabaseClient, {
        userId: 'user123',
        testGDPRCompliance: true
      });

      expect(gdprComplianceTest.dataExportGenerated).toBe(true);
      expect(gdprComplianceTest.accountDeletionSupported).toBe(true);
    });
  });
});
