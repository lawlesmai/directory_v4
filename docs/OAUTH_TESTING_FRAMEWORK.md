# OAuth Testing Framework

## Overview

Comprehensive testing framework for OAuth authentication in the Lawless Directory application. This framework covers unit tests, integration tests, security validation, and end-to-end testing for all supported OAuth providers.

## Table of Contents

1. [Testing Strategy](#testing-strategy)
2. [Test Environment Setup](#test-environment-setup)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [Security Testing](#security-testing)
6. [End-to-End Testing](#end-to-end-testing)
7. [Performance Testing](#performance-testing)
8. [Manual Testing Procedures](#manual-testing-procedures)
9. [Test Data Management](#test-data-management)
10. [Continuous Integration](#continuous-integration)

## Testing Strategy

### Test Pyramid Structure

```
        E2E Tests
      (Comprehensive OAuth Flows)
    
    Integration Tests
  (API Endpoints & Database)

Unit Tests
(Individual Functions & Components)
```

### Coverage Goals
- **Unit Tests**: 90%+ coverage for OAuth utilities
- **Integration Tests**: All API endpoints and database operations
- **Security Tests**: All security features and edge cases
- **E2E Tests**: Complete user journeys for each provider

### Test Categories

1. **Functional Tests**: Core OAuth functionality
2. **Security Tests**: Authentication, authorization, and protection mechanisms
3. **Error Handling Tests**: Error scenarios and recovery
4. **Performance Tests**: Load testing and response times
5. **Compliance Tests**: GDPR, security standards
6. **Cross-browser Tests**: Browser compatibility
7. **Mobile Tests**: Mobile device compatibility

## Test Environment Setup

### Environment Configuration

Create dedicated test environments:

```bash
# Test environment variables (.env.test)
NODE_ENV=test
NEXT_PUBLIC_APP_URL=https://test.yourdomain.com
NEXT_PUBLIC_SITE_URL=https://test.yourdomain.com

# Test OAuth credentials (sandbox/test accounts)
GOOGLE_CLIENT_ID=test-google-client-id
GOOGLE_CLIENT_SECRET=test-google-client-secret
APPLE_CLIENT_ID=com.yourdomain.app.test
FACEBOOK_CLIENT_ID=test-facebook-app-id
GITHUB_CLIENT_ID=test-github-client-id

# Test security keys (different from production!)
TOKEN_ENCRYPTION_KEY=test-token-encryption-key-64-chars
CONFIG_ENCRYPTION_KEY=test-config-encryption-key-64-chars
OAUTH_HMAC_KEY=test-oauth-hmac-key-64-chars

# Test database configuration
SUPABASE_TEST_URL=https://test-project.supabase.co
SUPABASE_TEST_ANON_KEY=test-anon-key
SUPABASE_TEST_SERVICE_KEY=test-service-key
```

### Test Database Setup

```sql
-- Create test database schema
CREATE SCHEMA IF NOT EXISTS test_oauth;

-- Test OAuth providers table
CREATE TABLE test_oauth.oauth_providers AS 
SELECT * FROM public.oauth_providers LIMIT 0;

-- Test user OAuth connections table
CREATE TABLE test_oauth.user_oauth_connections AS 
SELECT * FROM public.user_oauth_connections LIMIT 0;

-- Test profiles table
CREATE TABLE test_oauth.profiles AS 
SELECT * FROM public.profiles LIMIT 0;
```

### Mock Services Setup

```javascript
// Mock OAuth provider responses
export const mockOAuthResponses = {
  google: {
    userInfo: {
      id: 'test-google-user-id',
      email: 'test@gmail.com',
      name: 'Test Google User',
      picture: 'https://example.com/avatar.jpg',
      verified_email: true
    },
    tokenResponse: {
      access_token: 'mock-google-access-token',
      refresh_token: 'mock-google-refresh-token',
      expires_in: 3600,
      token_type: 'Bearer'
    }
  },
  apple: {
    userInfo: {
      sub: 'test-apple-user-id',
      email: 'test@privaterelay.appleid.com',
      name: { firstName: 'Test', lastName: 'Apple User' },
      email_verified: 'true'
    },
    tokenResponse: {
      access_token: 'mock-apple-access-token',
      expires_in: 3600,
      id_token: 'mock-apple-id-token',
      token_type: 'Bearer'
    }
  },
  facebook: {
    userInfo: {
      id: 'test-facebook-user-id',
      email: 'test@facebook.com',
      name: 'Test Facebook User',
      picture: { data: { url: 'https://example.com/fb-avatar.jpg' } }
    },
    tokenResponse: {
      access_token: 'mock-facebook-access-token',
      expires_in: 5184000,
      token_type: 'bearer'
    }
  },
  github: {
    userInfo: {
      id: 12345,
      login: 'testuser',
      name: 'Test GitHub User',
      email: 'test@github.com',
      avatar_url: 'https://example.com/gh-avatar.jpg'
    },
    tokenResponse: {
      access_token: 'mock-github-access-token',
      token_type: 'bearer',
      scope: 'read:user,user:email'
    }
  }
};
```

## Unit Testing

### OAuth Configuration Tests

```typescript
// __tests__/lib/auth/oauth-config.test.ts
import { OAuthConfigManager, isValidOAuthProvider } from '@/lib/auth/oauth-config';

describe('OAuth Configuration', () => {
  let configManager: OAuthConfigManager;

  beforeEach(() => {
    configManager = new OAuthConfigManager();
  });

  describe('Provider Validation', () => {
    test('should validate supported providers', () => {
      expect(isValidOAuthProvider('google')).toBe(true);
      expect(isValidOAuthProvider('apple')).toBe(true);
      expect(isValidOAuthProvider('facebook')).toBe(true);
      expect(isValidOAuthProvider('github')).toBe(true);
      expect(isValidOAuthProvider('invalid')).toBe(false);
    });

    test('should reject invalid provider formats', () => {
      expect(isValidOAuthProvider('')).toBe(false);
      expect(isValidOAuthProvider('GOOGLE')).toBe(false);
      expect(isValidOAuthProvider('google ')).toBe(false);
    });
  });

  describe('Authorization URL Generation', () => {
    test('should generate valid Google OAuth URL', async () => {
      const url = await configManager.generateAuthorizationURL(
        'google',
        'https://test.com/callback',
        'test-state',
        ['email', 'profile']
      );

      expect(url).toContain('accounts.google.com');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=email%20profile');
      expect(url).toContain('state=test-state');
    });

    test('should include PKCE parameters for supported providers', async () => {
      const url = await configManager.generateAuthorizationURL(
        'google',
        'https://test.com/callback',
        'test-state'
      );

      expect(url).toContain('code_challenge');
      expect(url).toContain('code_challenge_method=S256');
    });
  });

  describe('OAuth Callback Validation', () => {
    test('should validate authorization code format', async () => {
      const result = await configManager.validateOAuthCallback(
        'google',
        'valid-auth-code',
        'test-state',
        'test-state'
      );

      expect(result.valid).toBe(true);
    });

    test('should reject invalid authorization codes', async () => {
      const result = await configManager.validateOAuthCallback(
        'google',
        'short',
        'test-state',
        'test-state'
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid Google authorization code format');
    });

    test('should reject state parameter mismatches', async () => {
      const result = await configManager.validateOAuthCallback(
        'google',
        'valid-auth-code',
        'state-1',
        'state-2'
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid state parameter');
    });
  });
});
```

### State Validation Tests

```typescript
// __tests__/lib/auth/state-validation.test.ts
import { generateSecureState, validateSecureState } from '@/lib/auth/state-validation';

describe('State Validation', () => {
  beforeEach(() => {
    process.env.OAUTH_HMAC_KEY = 'test-hmac-key-must-be-at-least-32-characters-long';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://test.com';
  });

  describe('State Generation', () => {
    test('should generate valid state parameter', () => {
      const payload = {
        provider: 'google',
        redirectTo: '/dashboard',
        timestamp: Date.now(),
        nonce: 'test-nonce'
      };

      const state = generateSecureState(payload);
      expect(state).toBeTruthy();
      expect(typeof state).toBe('string');
    });

    test('should include timestamp and nonce in payload', () => {
      const payload = {
        provider: 'google',
        redirectTo: '/dashboard',
        timestamp: Date.now(),
        nonce: 'test-nonce'
      };

      const state = generateSecureState(payload);
      const validation = validateSecureState(state, 'google');
      
      expect(validation.valid).toBe(true);
      expect(validation.payload?.provider).toBe('google');
      expect(validation.payload?.redirectTo).toBe('/dashboard');
    });
  });

  describe('State Validation', () => {
    test('should validate correctly signed state', () => {
      const payload = {
        provider: 'google',
        redirectTo: '/dashboard',
        timestamp: Date.now(),
        nonce: 'test-nonce'
      };

      const state = generateSecureState(payload);
      const validation = validateSecureState(state, 'google');
      
      expect(validation.valid).toBe(true);
      expect(validation.payload?.provider).toBe('google');
    });

    test('should reject expired state parameters', () => {
      const payload = {
        provider: 'google',
        redirectTo: '/dashboard',
        timestamp: Date.now() - (15 * 60 * 1000), // 15 minutes ago
        nonce: 'test-nonce'
      };

      const state = generateSecureState(payload);
      const validation = validateSecureState(state, 'google');
      
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('expired');
    });

    test('should reject tampered state parameters', () => {
      const payload = {
        provider: 'google',
        redirectTo: '/dashboard',
        timestamp: Date.now(),
        nonce: 'test-nonce'
      };

      const state = generateSecureState(payload);
      const tamperedState = state.slice(0, -10) + 'tampered123';
      const validation = validateSecureState(tamperedState, 'google');
      
      expect(validation.valid).toBe(false);
    });

    test('should reject provider mismatches', () => {
      const payload = {
        provider: 'google',
        redirectTo: '/dashboard',
        timestamp: Date.now(),
        nonce: 'test-nonce'
      };

      const state = generateSecureState(payload);
      const validation = validateSecureState(state, 'facebook');
      
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('Provider mismatch');
    });
  });

  describe('Redirect URL Validation', () => {
    test('should allow same-origin redirects', () => {
      const payload = {
        provider: 'google',
        redirectTo: '/dashboard',
        timestamp: Date.now(),
        nonce: 'test-nonce'
      };

      const state = generateSecureState(payload);
      const validation = validateSecureState(state, 'google');
      
      expect(validation.valid).toBe(true);
    });

    test('should reject external redirects', () => {
      const payload = {
        provider: 'google',
        redirectTo: 'https://malicious.com/steal-data',
        timestamp: Date.now(),
        nonce: 'test-nonce'
      };

      const state = generateSecureState(payload);
      const validation = validateSecureState(state, 'google');
      
      expect(validation.valid).toBe(false);
    });
  });
});
```

### Token Encryption Tests

```typescript
// __tests__/lib/auth/token-encryption.test.ts
import { encryptToken, decryptToken, validateEncryptionKey } from '@/lib/auth/token-encryption';

describe('Token Encryption', () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64); // 64-char hex key
  });

  describe('Token Encryption/Decryption', () => {
    test('should encrypt and decrypt tokens correctly', async () => {
      const originalToken = 'test-oauth-access-token';
      
      const encrypted = await encryptToken(originalToken);
      const decrypted = await decryptToken(encrypted);
      
      expect(decrypted).toBe(originalToken);
    });

    test('should generate different ciphertext for same token', async () => {
      const token = 'test-token';
      
      const encrypted1 = await encryptToken(token);
      const encrypted2 = await encryptToken(token);
      
      expect(encrypted1).not.toBe(encrypted2);
    });

    test('should reject tampered encrypted tokens', async () => {
      const token = 'test-token';
      const encrypted = await encryptToken(token);
      
      // Tamper with encrypted data
      const parsed = JSON.parse(encrypted);
      parsed.encrypted = parsed.encrypted.slice(0, -2) + '00';
      const tamperedEncrypted = JSON.stringify(parsed);
      
      await expect(decryptToken(tamperedEncrypted)).rejects.toThrow();
    });
  });

  describe('Key Validation', () => {
    test('should validate correct encryption key format', () => {
      expect(validateEncryptionKey('a'.repeat(64))).toBe(true);
      expect(validateEncryptionKey('0123456789abcdef'.repeat(4))).toBe(true);
    });

    test('should reject invalid key formats', () => {
      expect(validateEncryptionKey('short')).toBe(false);
      expect(validateEncryptionKey('g'.repeat(64))).toBe(false); // Invalid hex
      expect(validateEncryptionKey('a'.repeat(63))).toBe(false); // Wrong length
    });
  });
});
```

## Integration Testing

### API Endpoint Tests

```typescript
// __tests__/api/auth/oauth/[provider]/route.test.ts
import { GET } from '@/app/api/auth/oauth/[provider]/route';
import { NextRequest } from 'next/server';

describe('OAuth Initiation API', () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    mockRequest = new NextRequest('http://localhost:3000/api/auth/oauth/google');
  });

  describe('Provider Validation', () => {
    test('should accept valid providers', async () => {
      const response = await GET(mockRequest, { params: { provider: 'google' } });
      expect(response.status).toBe(302); // Redirect to OAuth provider
    });

    test('should reject invalid providers', async () => {
      const response = await GET(mockRequest, { params: { provider: 'invalid' } });
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain('Invalid OAuth provider');
    });
  });

  describe('Rate Limiting', () => {
    test('should allow normal request rates', async () => {
      const response = await GET(mockRequest, { params: { provider: 'google' } });
      expect(response.status).not.toBe(429);
    });

    test('should block excessive requests', async () => {
      // Simulate multiple requests from same IP
      for (let i = 0; i < 10; i++) {
        await GET(mockRequest, { params: { provider: 'google' } });
      }
      
      const response = await GET(mockRequest, { params: { provider: 'google' } });
      expect(response.status).toBe(429);
      
      const data = await response.json();
      expect(data.error).toContain('Rate limit');
    });
  });

  describe('State Parameter Generation', () => {
    test('should set secure state cookie', async () => {
      const response = await GET(mockRequest, { params: { provider: 'google' } });
      
      const setCookieHeader = response.headers.get('set-cookie');
      expect(setCookieHeader).toContain('oauth_state_google');
      expect(setCookieHeader).toContain('HttpOnly');
      expect(setCookieHeader).toContain('SameSite=lax');
    });
  });
});
```

### Callback API Tests

```typescript
// __tests__/api/auth/oauth/[provider]/callback/route.test.ts
import { GET } from '@/app/api/auth/oauth/[provider]/callback/route';
import { NextRequest } from 'next/server';

describe('OAuth Callback API', () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    // Mock successful OAuth callback
    mockRequest = new NextRequest(
      'http://localhost:3000/api/auth/oauth/google/callback?code=test-auth-code&state=test-state'
    );
    
    // Mock stored state cookie
    mockRequest.cookies.set('oauth_state_google', 'test-state');
  });

  describe('Callback Processing', () => {
    test('should process valid OAuth callback', async () => {
      const response = await GET(mockRequest, { params: { provider: 'google' } });
      expect(response.status).toBe(302); // Redirect after successful auth
    });

    test('should handle OAuth errors', async () => {
      const errorRequest = new NextRequest(
        'http://localhost:3000/api/auth/oauth/google/callback?error=access_denied&state=test-state'
      );
      
      const response = await GET(errorRequest, { params: { provider: 'google' } });
      expect(response.status).toBe(302); // Redirect to error page
    });

    test('should validate state parameter', async () => {
      const invalidStateRequest = new NextRequest(
        'http://localhost:3000/api/auth/oauth/google/callback?code=test-code&state=invalid-state'
      );
      
      const response = await GET(invalidStateRequest, { params: { provider: 'google' } });
      expect(response.status).toBe(302); // Redirect to error page
    });
  });

  describe('User Account Processing', () => {
    test('should create new user account', async () => {
      // Mock new user scenario
      const response = await GET(mockRequest, { params: { provider: 'google' } });
      expect(response.status).toBe(302);
      
      // Verify user was created in database
      // Note: This requires mocking the Supabase client
    });

    test('should link to existing user account', async () => {
      // Mock existing user scenario
      // Test account linking functionality
    });
  });
});
```

## Security Testing

### CSRF Protection Tests

```typescript
// __tests__/security/csrf-protection.test.ts
describe('CSRF Protection', () => {
  test('should reject requests without state parameter', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/auth/oauth/google/callback?code=test-code'
    );
    
    const response = await GET(request, { params: { provider: 'google' } });
    expect(response.status).toBe(400);
  });

  test('should reject requests with invalid state signature', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/auth/oauth/google/callback?code=test-code&state=tampered-state'
    );
    
    const response = await GET(request, { params: { provider: 'google' } });
    expect(response.status).toBe(400);
  });

  test('should prevent state parameter reuse', async () => {
    // Use the same state parameter twice
    const state = generateValidState();
    
    const request1 = createCallbackRequest(state);
    await GET(request1, { params: { provider: 'google' } });
    
    const request2 = createCallbackRequest(state);
    const response = await GET(request2, { params: { provider: 'google' } });
    
    expect(response.status).toBe(400);
  });
});
```

### Authorization Code Security Tests

```typescript
// __tests__/security/authorization-code.test.ts
describe('Authorization Code Security', () => {
  test('should validate code format per provider', async () => {
    const testCases = [
      { provider: 'google', validCode: 'valid-google-code-format', invalidCode: 'short' },
      { provider: 'github', validCode: '12345678901234567890', invalidCode: '123' },
      { provider: 'facebook', validCode: 'AQvalid-facebook-code', invalidCode: 'invalid' }
    ];

    for (const testCase of testCases) {
      // Test valid code
      const validResult = await validateOAuthCallback(
        testCase.provider as any,
        testCase.validCode,
        'state',
        'state'
      );
      expect(validResult.valid).toBe(true);

      // Test invalid code
      const invalidResult = await validateOAuthCallback(
        testCase.provider as any,
        testCase.invalidCode,
        'state',
        'state'
      );
      expect(invalidResult.valid).toBe(false);
    }
  });
});
```

### Token Security Tests

```typescript
// __tests__/security/token-security.test.ts
describe('Token Security', () => {
  test('should encrypt tokens before database storage', async () => {
    const plainToken = 'sensitive-access-token';
    const encrypted = await encryptToken(plainToken);
    
    expect(encrypted).not.toContain(plainToken);
    expect(encrypted).toMatch(/^[a-zA-Z0-9+\/=]+$/); // Base64-like format
  });

  test('should use unique IV for each encryption', async () => {
    const token = 'test-token';
    const encrypted1 = await encryptToken(token);
    const encrypted2 = await encryptToken(token);
    
    const parsed1 = JSON.parse(encrypted1);
    const parsed2 = JSON.parse(encrypted2);
    
    expect(parsed1.iv).not.toBe(parsed2.iv);
    expect(parsed1.encrypted).not.toBe(parsed2.encrypted);
  });

  test('should validate authentication tags', async () => {
    const token = 'test-token';
    const encrypted = await encryptToken(token);
    const parsed = JSON.parse(encrypted);
    
    // Tamper with authentication tag
    parsed.tag = 'tampered-tag';
    const tamperedEncrypted = JSON.stringify(parsed);
    
    await expect(decryptToken(tamperedEncrypted)).rejects.toThrow();
  });
});
```

## End-to-End Testing

### Playwright E2E Tests

```typescript
// tests/e2e/oauth-flows.spec.ts
import { test, expect } from '@playwright/test';

test.describe('OAuth Authentication Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
  });

  test('Google OAuth flow', async ({ page }) => {
    // Click Google sign-in button
    await page.click('[data-testid="google-login-button"]');
    
    // Should redirect to Google OAuth
    await expect(page).toHaveURL(/accounts\.google\.com/);
    
    // Mock Google authentication (for testing)
    await page.route('**/oauth2/v2/userinfo', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-google-user',
          email: 'test@gmail.com',
          name: 'Test User',
          picture: 'https://example.com/avatar.jpg'
        })
      });
    });
    
    // Complete OAuth flow
    await page.fill('[name="email"]', 'test@gmail.com');
    await page.fill('[name="password"]', 'testpassword');
    await page.click('[type="submit"]');
    
    // Should redirect back to app
    await expect(page).toHaveURL('/dashboard');
    
    // Should show user profile
    await expect(page.locator('[data-testid="user-name"]')).toContainText('Test User');
  });

  test('Apple Sign-In flow', async ({ page }) => {
    await page.click('[data-testid="apple-login-button"]');
    
    await expect(page).toHaveURL(/appleid\.apple\.com/);
    
    // Mock Apple authentication
    await page.route('**/auth/token', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-apple-token',
          id_token: 'mock-apple-id-token',
          expires_in: 3600
        })
      });
    });
    
    // Complete Apple sign-in
    await page.fill('[name="accountName"]', 'test@privaterelay.appleid.com');
    await page.fill('[name="password"]', 'testpassword');
    await page.click('[name="signIn"]');
    
    await expect(page).toHaveURL('/dashboard');
  });

  test('OAuth error handling', async ({ page }) => {
    // Mock OAuth error response
    await page.route('**/api/auth/oauth/google', async route => {
      const url = new URL(route.request().url());
      const redirectUri = url.searchParams.get('redirect_uri');
      
      // Redirect with error
      await route.fulfill({
        status: 302,
        headers: {
          'Location': `${redirectUri}?error=access_denied&state=test-state`
        }
      });
    });
    
    await page.click('[data-testid="google-login-button"]');
    
    // Should show error message
    await expect(page.locator('[data-testid="error-message"]'))
      .toContainText('You cancelled the authorization');
    
    // Should show retry button
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test('Rate limiting protection', async ({ page }) => {
    // Make multiple rapid requests
    for (let i = 0; i < 6; i++) {
      await page.click('[data-testid="google-login-button"]');
      await page.goBack();
    }
    
    // Should show rate limit message
    await expect(page.locator('[data-testid="rate-limit-message"]'))
      .toContainText('Too many sign-in attempts');
  });
});
```

### Cross-Browser Testing

```typescript
// tests/e2e/cross-browser.spec.ts
import { test, devices } from '@playwright/test';

const browsers = [
  'chromium',
  'firefox', 
  'webkit'
];

const devices_list = [
  devices['Desktop Chrome'],
  devices['Desktop Firefox'],
  devices['Desktop Safari'],
  devices['iPhone 12'],
  devices['Pixel 5']
];

for (const device of devices_list) {
  test.describe(`OAuth on ${device.name}`, () => {
    test.use({ ...device });
    
    test('Google OAuth works across devices', async ({ page }) => {
      await page.goto('/auth/login');
      await page.click('[data-testid="google-login-button"]');
      
      // Device-specific OAuth flow testing
      // Account for mobile vs desktop differences
    });
  });
}
```

## Performance Testing

### Load Testing with Artillery

```yaml
# artillery-config.yml
config:
  target: 'https://test.yourdomain.com'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 50
    - duration: 60
      arrivalRate: 100

scenarios:
  - name: "OAuth Initiation Load Test"
    flow:
      - get:
          url: "/api/auth/oauth/google"
          followRedirects: false
      - think: 2
      
  - name: "OAuth Callback Load Test"
    flow:
      - get:
          url: "/api/auth/oauth/google/callback?code=test-code&state=test-state"
          followRedirects: false
      - think: 1
```

### Response Time Testing

```typescript
// __tests__/performance/response-times.test.ts
describe('OAuth Performance', () => {
  test('OAuth initiation should respond within 500ms', async () => {
    const start = Date.now();
    
    const response = await fetch('/api/auth/oauth/google');
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
    expect(response.status).toBe(302);
  });

  test('OAuth callback should process within 2 seconds', async () => {
    const start = Date.now();
    
    const response = await fetch(
      '/api/auth/oauth/google/callback?code=test-code&state=valid-state'
    );
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(2000);
  });
});
```

## Manual Testing Procedures

### Production Readiness Checklist

#### Pre-Production Testing
1. **Environment Setup**
   - [ ] All OAuth providers configured with production credentials
   - [ ] Security keys generated and stored securely
   - [ ] Database migrations applied
   - [ ] Rate limiting configured
   - [ ] Monitoring and logging enabled

2. **Functional Testing**
   - [ ] Google OAuth complete flow
   - [ ] Apple Sign-In complete flow  
   - [ ] Facebook OAuth complete flow
   - [ ] GitHub OAuth complete flow
   - [ ] New user registration via OAuth
   - [ ] Existing user login via OAuth
   - [ ] Account linking functionality
   - [ ] Profile synchronization
   - [ ] Account disconnection

3. **Security Testing**
   - [ ] CSRF protection working
   - [ ] State parameter validation
   - [ ] Token encryption/decryption
   - [ ] Rate limiting enforcement
   - [ ] Redirect URI validation
   - [ ] Error handling security

4. **Error Scenarios**
   - [ ] User cancels OAuth flow
   - [ ] Provider returns error
   - [ ] Network timeouts
   - [ ] Invalid credentials
   - [ ] Rate limit exceeded
   - [ ] Security violations

#### Manual Test Scripts

**Google OAuth Test Script:**
```
1. Navigate to /auth/login
2. Click "Continue with Google"
3. Verify redirect to accounts.google.com
4. Complete Google authentication
5. Verify redirect back to application
6. Check user profile data populated
7. Test logout and re-login
8. Verify session persistence
```

**Error Handling Test Script:**
```
1. Navigate to /auth/login
2. Click OAuth provider button
3. Cancel authentication at provider
4. Verify error message shown
5. Click "Try Again" button
6. Complete authentication successfully
7. Verify recovery works
```

**Rate Limiting Test Script:**
```
1. Open multiple browser tabs
2. Rapidly click OAuth buttons in each tab
3. Verify rate limiting kicks in
4. Wait for rate limit to reset
5. Verify normal operation resumes
```

## Test Data Management

### Test User Accounts

Create dedicated test accounts for each provider:

```javascript
// Test user accounts for OAuth providers
export const testAccounts = {
  google: {
    email: 'oauth-test@yourdomain.com',
    password: 'SecureTestPass123!',
    expectedData: {
      name: 'OAuth Test User',
      email: 'oauth-test@yourdomain.com',
      verified: true
    }
  },
  apple: {
    appleId: 'oauth.test@yourdomain.com',
    password: 'SecureTestPass123!',
    expectedData: {
      email: 'oauth.test@privaterelay.appleid.com',
      verified: true
    }
  },
  facebook: {
    email: 'oauth_test@yourdomain.com',
    password: 'SecureTestPass123!',
    expectedData: {
      name: 'OAuth Test User',
      email: 'oauth_test@yourdomain.com'
    }
  },
  github: {
    username: 'oauth-test-user',
    email: 'oauth-test@yourdomain.com',
    password: 'SecureTestPass123!',
    expectedData: {
      login: 'oauth-test-user',
      name: 'OAuth Test User',
      email: 'oauth-test@yourdomain.com'
    }
  }
};
```

### Database Test Data

```sql
-- Test data setup script
-- OAuth providers test configuration
INSERT INTO oauth_providers (id, provider_name, display_name, enabled) VALUES
('test-google-id', 'google', 'Google', true),
('test-apple-id', 'apple', 'Apple', true),
('test-facebook-id', 'facebook', 'Facebook', true),
('test-github-id', 'github', 'GitHub', true);

-- Test user profiles
INSERT INTO profiles (id, email, display_name, created_at) VALUES
('test-user-1', 'test1@example.com', 'Test User 1', NOW()),
('test-user-2', 'test2@example.com', 'Test User 2', NOW());

-- Test OAuth connections
INSERT INTO user_oauth_connections (
  id, user_id, provider_id, provider_user_id, provider_email,
  access_token_encrypted, is_verified, connected_at
) VALUES
(
  'test-connection-1', 'test-user-1', 'test-google-id', 'google-test-id', 
  'test1@gmail.com', 'encrypted-test-token', true, NOW()
);
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/oauth-tests.yml
name: OAuth Testing Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install
        
      - name: Run unit tests
        run: npm run test:unit
        env:
          NODE_ENV: test
          TOKEN_ENCRYPTION_KEY: ${{ secrets.TEST_TOKEN_ENCRYPTION_KEY }}
          OAUTH_HMAC_KEY: ${{ secrets.TEST_OAUTH_HMAC_KEY }}
          
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
          
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          TEST_GOOGLE_CLIENT_ID: ${{ secrets.TEST_GOOGLE_CLIENT_ID }}
          TEST_GOOGLE_CLIENT_SECRET: ${{ secrets.TEST_GOOGLE_CLIENT_SECRET }}

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        
      - name: Install Playwright
        run: npx playwright install
        
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          PLAYWRIGHT_BASE_URL: https://test.yourdomain.com
          
      - name: Upload Playwright report
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/

  security-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        
      - name: Run security tests
        run: npm run test:security
        
      - name: Run OWASP ZAP scan
        uses: zaproxy/action-full-scan@v0.4.0
        with:
          target: 'https://test.yourdomain.com'
```

### Test Scripts in package.json

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=__tests__/lib",
    "test:integration": "jest --testPathPattern=__tests__/api",
    "test:security": "jest --testPathPattern=__tests__/security",
    "test:e2e": "playwright test",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch",
    "test:oauth": "jest --testPathPattern=oauth"
  }
}
```

## Monitoring and Alerting

### Test Result Monitoring

```typescript
// Monitor test results and alert on failures
export const testMonitoring = {
  async reportTestResults(results: TestResults) {
    const metrics = {
      totalTests: results.numTotalTests,
      passedTests: results.numPassedTests,
      failedTests: results.numFailedTests,
      coverage: results.coverageMap?.getCoverageSummary(),
      duration: results.testResults.reduce((acc, result) => 
        acc + (result.perfStats?.end - result.perfStats?.start), 0
      )
    };

    // Send to monitoring service
    await sendToDatadog('oauth.test.results', metrics);
    
    // Alert on failures
    if (results.numFailedTests > 0) {
      await sendSlackAlert(`OAuth tests failed: ${results.numFailedTests} failures`);
    }
  }
};
```

This comprehensive OAuth testing framework ensures production readiness and maintains high quality standards for the authentication system.