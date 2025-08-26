import { supabase } from '../../../lib/supabaseClient'; // Adjust path as needed
import { EmailVerificationService } from '../../../utils/auth';

describe('Authentication System Integration', () => {
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = 'SecurePassword123!';

  it('should create a new user account', async () => {
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    expect(error).toBeNull();
    expect(data.user).toBeDefined();
    expect(data.user?.email).toBe(testEmail);
  });

  it('should generate and validate email verification token', async () => {
    // Generate token
    const token = EmailVerificationService.generateVerificationToken(testEmail);

    // Validate token
    const isValid = EmailVerificationService.validateVerificationToken(testEmail, token);
    expect(isValid).toBeTruthy();
  });

  it('should handle email verification process', async () => {
    // Simulate email verification
    const { data, error } = await supabase.auth.updateUser({
      data: { email_verified: true }
    });

    expect(error).toBeNull();
    expect(data.user?.email_verified).toBeTruthy();
  });

  it('should prevent login for unverified users', async () => {
    // Temporarily set user as unverified
    await supabase.auth.updateUser({
      data: { email_verified: false }
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    // Depending on your implementation, this might return an error or a specific response
    expect(data.user).toBeNull();
    expect(error).toBeDefined();
  });
});
