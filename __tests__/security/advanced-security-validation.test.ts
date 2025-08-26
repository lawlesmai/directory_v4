import { SecurityValidator } from '../../utils/security-validator';
import { supabase } from '../../lib/supabaseClient';

describe('Advanced Security Validation', () => {
  it('should validate CSRF protection', async () => {
    const csrfToken = await SecurityValidator.generateCSRFToken();
    const isValid = await SecurityValidator.validateCSRFToken(csrfToken);
    
    expect(isValid).toBeTruthy();
  });

  it('should prevent brute-force login attempts', async () => {
    const testEmail = `security_${Date.now()}@example.com`;
    
    // Simulate multiple failed login attempts
    const failedAttempts = Array(10).fill(null).map(async () => {
      return supabase.auth.signInWithPassword({
        email: testEmail,
        password: 'WrongPassword'
      });
    });

    await Promise.all(failedAttempts);

    // Check if account is locked
    const { error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: 'AnyPassword'
    });

    expect(error?.message).toContain('Account locked');
  });

  it('should validate password complexity', () => {
    const validPasswords = [
      'Str0ngP@ssw0rd!',
      'Complex123!@#Password',
      'L0ngP@sswordWith_Special_Chars'
    ];

    const invalidPasswords = [
      'short',
      'nostrongchars',
      '12345678',
      'PASSWORD'
    ];

    validPasswords.forEach(password => {
      expect(SecurityValidator.isPasswordComplex(password)).toBeTruthy();
    });

    invalidPasswords.forEach(password => {
      expect(SecurityValidator.isPasswordComplex(password)).toBeFalsy();
    });
  });
});
