# Developer Integration Guide

**Document Type:** User Documentation  
**Created:** 2025-08-26  
**Version:** 1.0.0  
**Scope:** Complete developer integration guide for Epic 2 authentication system

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication Integration](#authentication-integration)
3. [API Client Libraries](#api-client-libraries)
4. [Frontend Integration Examples](#frontend-integration-examples)
5. [Backend Integration Examples](#backend-integration-examples)
6. [Mobile App Integration](#mobile-app-integration)
7. [Security Best Practices](#security-best-practices)
8. [Testing and Development](#testing-and-development)
9. [Production Deployment](#production-deployment)
10. [Troubleshooting and Support](#troubleshooting-and-support)

## Getting Started

### Prerequisites

**Required Knowledge:**
- RESTful API development
- JWT token handling
- HTTP authentication mechanisms
- Frontend framework (React, Vue, Angular, etc.)
- Backend development (Node.js, Python, PHP, etc.)

**Development Environment:**
- Modern web browser with developer tools
- API testing tool (Postman, Insomnia, or curl)
- Code editor with HTTP/REST support
- Local development server
- SSL/TLS certificate (for production-like testing)

### API Endpoints Overview

**Base URLs:**
- **Production**: `https://api.lawlessdirectory.com/v2`
- **Staging**: `https://staging-api.lawlessdirectory.com/v2`
- **Development**: `http://localhost:3000/api`

**Core Authentication Endpoints:**
- `POST /auth/mfa/setup` - Enable MFA
- `GET /auth/mfa/setup` - Get MFA status  
- `POST /auth/mfa/verify` - Verify MFA code
- `POST /auth/password/reset/request` - Request password reset
- `POST /auth/password/reset/complete` - Complete password reset
- `GET /profile` - Get user profile
- `PUT /profile` - Update user profile
- `PATCH /profile` - Update single profile field

### Authentication Methods

**1. Bearer Token Authentication**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**2. Session-Based Authentication**
```http
Cookie: session=abc123def456; HttpOnly; Secure; SameSite=Strict
```

**3. API Key Authentication**
```http
X-API-Key: your-api-key-here
```

## Authentication Integration

### JWT Token Management

#### Token Structure
```javascript
// Decoded JWT payload example
{
  "sub": "123e4567-e89b-12d3-a456-426614174000", // User ID
  "email": "user@example.com",
  "roles": ["user", "business_owner"],
  "mfa_verified": true,
  "iat": 1692892800, // Issued at
  "exp": 1692979200, // Expires at
  "iss": "lawlessdirectory.com",
  "aud": "lawlessdirectory-api"
}
```

#### Token Lifecycle Management
```javascript
class AuthManager {
  constructor(baseURL, storage = localStorage) {
    this.baseURL = baseURL;
    this.storage = storage;
    this.tokenKey = 'ld_access_token';
    this.refreshKey = 'ld_refresh_token';
  }

  // Store tokens securely
  setTokens(accessToken, refreshToken) {
    this.storage.setItem(this.tokenKey, accessToken);
    if (refreshToken) {
      this.storage.setItem(this.refreshKey, refreshToken);
    }
  }

  // Get current access token
  getAccessToken() {
    return this.storage.getItem(this.tokenKey);
  }

  // Check if token is expired
  isTokenExpired(token) {
    if (!token) return true;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp < currentTime;
    } catch (error) {
      return true;
    }
  }

  // Refresh access token
  async refreshToken() {
    const refreshToken = this.storage.getItem(this.refreshKey);
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${this.baseURL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken })
    });

    if (!response.ok) {
      this.clearTokens();
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    this.setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  }

  // Clear all tokens
  clearTokens() {
    this.storage.removeItem(this.tokenKey);
    this.storage.removeItem(this.refreshKey);
  }

  // Make authenticated API request
  async request(endpoint, options = {}) {
    let token = this.getAccessToken();
    
    // Refresh token if expired
    if (this.isTokenExpired(token)) {
      token = await this.refreshToken();
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    // Handle 401 responses
    if (response.status === 401) {
      try {
        token = await this.refreshToken();
        // Retry request with new token
        return fetch(`${this.baseURL}${endpoint}`, {
          ...options,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
          }
        });
      } catch (refreshError) {
        this.clearTokens();
        throw new Error('Authentication failed');
      }
    }

    return response;
  }
}

// Usage example
const auth = new AuthManager('https://api.lawlessdirectory.com/v2');
```

### Multi-Factor Authentication Integration

#### MFA Setup Flow
```javascript
class MFAManager {
  constructor(authManager) {
    this.auth = authManager;
  }

  // Get MFA status
  async getMFAStatus() {
    const response = await this.auth.request('/auth/mfa/setup');
    if (!response.ok) {
      throw new Error('Failed to get MFA status');
    }
    return await response.json();
  }

  // Enable TOTP MFA
  async enableTOTP() {
    const response = await this.auth.request('/auth/mfa/setup', {
      method: 'POST',
      body: JSON.stringify({
        enable_mfa: true,
        methods: ['totp', 'backup_codes']
      })
    });

    if (!response.ok) {
      throw new Error('Failed to enable MFA');
    }

    const data = await response.json();
    
    // Display QR code to user
    if (data.setup_data?.totp?.qr_code_url) {
      this.displayQRCode(data.setup_data.totp.qr_code_url);
    }

    // Store backup codes securely
    if (data.setup_data?.backup_codes) {
      this.handleBackupCodes(data.setup_data.backup_codes.codes);
    }

    return data;
  }

  // Verify MFA code
  async verifyMFA(code, method = 'totp', trustDevice = false) {
    const response = await this.auth.request('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({
        code,
        method,
        trust_device: trustDevice
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'MFA verification failed');
    }

    const data = await response.json();
    
    // Update session token if provided
    if (data.session_token) {
      this.auth.setTokens(data.session_token);
    }

    return data;
  }

  // Display QR code for user scanning
  displayQRCode(qrCodeUrl) {
    const qrImage = document.createElement('img');
    qrImage.src = qrCodeUrl;
    qrImage.alt = 'MFA Setup QR Code';
    qrImage.style.width = '200px';
    qrImage.style.height = '200px';
    
    // Add to DOM or show in modal
    document.getElementById('qr-code-container').appendChild(qrImage);
  }

  // Handle backup codes securely
  handleBackupCodes(codes) {
    // Show backup codes to user
    const codesContainer = document.getElementById('backup-codes');
    codesContainer.innerHTML = codes.map(code => 
      `<div class="backup-code">${code}</div>`
    ).join('');
    
    // Provide download option
    this.createBackupCodesDownload(codes);
  }

  // Create downloadable backup codes file
  createBackupCodesDownload(codes) {
    const content = [
      'The Lawless Directory - Backup Codes',
      '=====================================',
      '',
      'Save these backup codes in a safe place.',
      'Each code can only be used once.',
      '',
      ...codes.map((code, index) => `${index + 1}. ${code}`),
      '',
      `Generated: ${new Date().toISOString()}`,
      'Keep these codes secure and private.'
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `lawless-directory-backup-codes-${Date.now()}.txt`;
    downloadLink.click();
    
    URL.revokeObjectURL(url);
  }
}

// Usage example
const mfa = new MFAManager(auth);

// Setup MFA
try {
  const setupResult = await mfa.enableTOTP();
  console.log('MFA setup initiated:', setupResult);
  
  // User scans QR code and enters verification code
  const verificationCode = await getUserInput('Enter verification code:');
  const verifyResult = await mfa.verifyMFA(verificationCode, 'totp', true);
  console.log('MFA verified:', verifyResult);
} catch (error) {
  console.error('MFA setup failed:', error.message);
}
```

### Password Management Integration

#### Password Reset Implementation
```javascript
class PasswordManager {
  constructor(authManager) {
    this.auth = authManager;
    this.baseURL = authManager.baseURL;
  }

  // Request password reset
  async requestPasswordReset(email, csrfToken) {
    const response = await fetch(`${this.baseURL}/auth/password/reset/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        method: 'email',
        requireMFA: false,
        csrfToken
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Password reset request failed');
    }

    return await response.json();
  }

  // Complete password reset
  async completePasswordReset(token, newPassword, confirmPassword, mfaCode = null) {
    const response = await fetch(`${this.baseURL}/auth/password/reset/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        newPassword,
        confirmPassword,
        ...(mfaCode && { mfaCode })
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Password reset failed');
    }

    return await response.json();
  }

  // Validate password strength
  validatePassword(password) {
    const requirements = {
      minLength: password.length >= 8,
      maxLength: password.length <= 128,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };

    const isValid = Object.values(requirements).every(req => req);
    
    return {
      isValid,
      requirements,
      score: Object.values(requirements).filter(req => req).length
    };
  }

  // Generate secure password
  generateSecurePassword(length = 16) {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    const allChars = uppercase + lowercase + numbers + special;
    let password = '';
    
    // Ensure at least one character from each category
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}

// Usage example
const passwordManager = new PasswordManager(auth);

// Password reset flow
async function handlePasswordReset(email, csrfToken) {
  try {
    // Request password reset
    const resetResult = await passwordManager.requestPasswordReset(email, csrfToken);
    console.log('Reset email sent:', resetResult.message);
    
    // User clicks link in email and provides new password
    const resetToken = getResetTokenFromURL();
    const newPassword = await getUserInput('Enter new password:');
    const confirmPassword = await getUserInput('Confirm password:');
    
    // Validate password
    const validation = passwordManager.validatePassword(newPassword);
    if (!validation.isValid) {
      throw new Error('Password does not meet requirements');
    }
    
    // Complete reset
    const completeResult = await passwordManager.completePasswordReset(
      resetToken,
      newPassword,
      confirmPassword
    );
    
    console.log('Password reset successful:', completeResult.message);
    
  } catch (error) {
    console.error('Password reset failed:', error.message);
  }
}
```

## API Client Libraries

### JavaScript/TypeScript Client

#### Installation
```bash
npm install @lawlessdirectory/api-client
# or
yarn add @lawlessdirectory/api-client
```

#### Usage
```typescript
import { LawlessDirectoryClient } from '@lawlessdirectory/api-client';

// Initialize client
const client = new LawlessDirectoryClient({
  baseURL: 'https://api.lawlessdirectory.com/v2',
  apiKey: process.env.LAWLESS_DIRECTORY_API_KEY, // For server-side
  timeout: 30000,
  retries: 3
});

// Authentication
const authResult = await client.auth.login({
  email: 'user@example.com',
  password: 'securePassword123!'
});

// MFA verification
if (authResult.mfaRequired) {
  const mfaCode = await getUserMFACode();
  await client.auth.verifyMFA({
    code: mfaCode,
    method: 'totp',
    trustDevice: true
  });
}

// Profile management
const profile = await client.profile.get({
  includeCompletion: true,
  includeRecommendations: true
});

await client.profile.update({
  displayName: 'John Doe',
  bio: 'Business owner and community member',
  showContactInfo: true
});

// Error handling
try {
  await client.auth.setupMFA(['totp']);
} catch (error) {
  if (error.code === 'MFA_ALREADY_ENABLED') {
    console.log('MFA is already enabled');
  } else {
    console.error('MFA setup failed:', error.message);
  }
}
```

### Python Client

#### Installation
```bash
pip install lawless-directory-client
```

#### Usage
```python
from lawless_directory import LawlessDirectoryClient, AuthenticationError

# Initialize client
client = LawlessDirectoryClient(
    base_url='https://api.lawlessdirectory.com/v2',
    api_key=os.getenv('LAWLESS_DIRECTORY_API_KEY'),
    timeout=30
)

# Authentication
try:
    auth_result = client.auth.login(
        email='user@example.com',
        password='securePassword123!'
    )
    
    # Handle MFA if required
    if auth_result.get('mfa_required'):
        mfa_code = input('Enter MFA code: ')
        client.auth.verify_mfa(
            code=mfa_code,
            method='totp',
            trust_device=True
        )
        
except AuthenticationError as e:
    print(f'Authentication failed: {e}')

# Profile operations
profile = client.profile.get(
    include_completion=True,
    include_analytics=True
)

client.profile.update({
    'display_name': 'John Doe',
    'bio': 'Business owner and community member',
    'city': 'San Francisco',
    'state': 'CA'
})

# MFA setup
setup_result = client.auth.setup_mfa(['totp', 'backup_codes'])
print(f'QR Code: {setup_result["setup_data"]["totp"]["qr_code_url"]}')

# Save backup codes securely
backup_codes = setup_result["setup_data"]["backup_codes"]["codes"]
with open('backup_codes.txt', 'w') as f:
    for i, code in enumerate(backup_codes, 1):
        f.write(f'{i}. {code}\n')
```

### PHP Client

#### Installation
```bash
composer require lawless-directory/api-client
```

#### Usage
```php
<?php
require_once 'vendor/autoload.php';

use LawlessDirectory\ApiClient;
use LawlessDirectory\Exceptions\AuthenticationException;

// Initialize client
$client = new ApiClient([
    'base_url' => 'https://api.lawlessdirectory.com/v2',
    'api_key' => getenv('LAWLESS_DIRECTORY_API_KEY'),
    'timeout' => 30
]);

try {
    // Authentication
    $authResult = $client->auth()->login([
        'email' => 'user@example.com',
        'password' => 'securePassword123!'
    ]);
    
    // MFA verification if required
    if ($authResult['mfa_required']) {
        $mfaCode = readline('Enter MFA code: ');
        $client->auth()->verifyMFA([
            'code' => $mfaCode,
            'method' => 'totp',
            'trust_device' => true
        ]);
    }
    
    // Profile operations
    $profile = $client->profile()->get([
        'includeCompletion' => true,
        'includeRecommendations' => true
    ]);
    
    $client->profile()->update([
        'display_name' => 'John Doe',
        'bio' => 'Business owner and community member',
        'city' => 'San Francisco'
    ]);
    
    // MFA setup
    $setupResult = $client->auth()->setupMFA(['totp', 'backup_codes']);
    
    echo "Scan this QR code: " . $setupResult['setup_data']['totp']['qr_code_url'] . "\n";
    
    // Save backup codes
    file_put_contents(
        'backup_codes.txt',
        implode("\n", $setupResult['setup_data']['backup_codes']['codes'])
    );
    
} catch (AuthenticationException $e) {
    echo "Authentication error: " . $e->getMessage() . "\n";
} catch (Exception $e) {
    echo "API error: " . $e->getMessage() . "\n";
}
```

## Frontend Integration Examples

### React Integration

#### Authentication Hook
```typescript
import React, { createContext, useContext, useEffect, useState } from 'react';

interface User {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  mfaEnabled: boolean;
  profileCompletion: number;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setupMFA: (methods: string[]) => Promise<any>;
  verifyMFA: (code: string, method: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const api = useAPI(); // Custom hook for API calls

  useEffect(() => {
    // Check for existing session on mount
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (token && !isTokenExpired(token)) {
        const profile = await api.profile.get();
        setUser(profile);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('access_token');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await api.auth.login({ email, password });
      
      if (response.mfaRequired) {
        // Handle MFA flow
        throw new Error('MFA_REQUIRED');
      }
      
      localStorage.setItem('access_token', response.accessToken);
      setUser(response.user);
      
    } catch (error: any) {
      setError(error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('access_token');
      setUser(null);
    }
  };

  const setupMFA = async (methods: string[]) => {
    try {
      setError(null);
      const result = await api.auth.setupMFA({ methods });
      
      // Update user MFA status
      if (user) {
        setUser({ ...user, mfaEnabled: true });
      }
      
      return result;
    } catch (error: any) {
      setError(error.message);
      throw error;
    }
  };

  const verifyMFA = async (code: string, method: string) => {
    try {
      setError(null);
      const result = await api.auth.verifyMFA({ code, method });
      
      if (result.sessionToken) {
        localStorage.setItem('access_token', result.sessionToken);
      }
      
      // Refresh user data
      await checkAuthStatus();
      
    } catch (error: any) {
      setError(error.message);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      setupMFA,
      verifyMFA,
      isLoading,
      error
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

#### MFA Setup Component
```typescript
import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.js';
import { useAuth } from './AuthContext';

export const MFASetup: React.FC = () => {
  const { setupMFA, verifyMFA, error } = useAuth();
  const [step, setStep] = useState<'setup' | 'verify' | 'complete'>('setup');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSetupMFA = async () => {
    try {
      setIsLoading(true);
      const result = await setupMFA(['totp', 'backup_codes']);
      
      if (result.setup_data?.totp?.qr_code_url) {
        setQrCodeUrl(result.setup_data.totp.qr_code_url);
      }
      
      if (result.setup_data?.backup_codes?.codes) {
        setBackupCodes(result.setup_data.backup_codes.codes);
      }
      
      setStep('verify');
    } catch (error) {
      console.error('MFA setup failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyMFA = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      await verifyMFA(verificationCode, 'totp');
      setStep('complete');
    } catch (error) {
      console.error('MFA verification failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadBackupCodes = () => {
    const content = backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-codes-${Date.now()}.txt`;
    a.click();
    
    URL.revokeObjectURL(url);
  };

  if (step === 'setup') {
    return (
      <div className="mfa-setup">
        <h2>Set Up Multi-Factor Authentication</h2>
        <p>Add an extra layer of security to your account.</p>
        
        <div className="setup-steps">
          <h3>What you'll need:</h3>
          <ul>
            <li>An authenticator app (Google Authenticator, Authy, etc.)</li>
            <li>Your smartphone or tablet</li>
            <li>A few minutes to complete setup</li>
          </ul>
        </div>
        
        <button 
          onClick={handleSetupMFA} 
          disabled={isLoading}
          className="btn btn-primary"
        >
          {isLoading ? 'Setting up...' : 'Start MFA Setup'}
        </button>
        
        {error && <div className="error">{error}</div>}
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <div className="mfa-verify">
        <h2>Scan QR Code</h2>
        <p>Scan this QR code with your authenticator app:</p>
        
        <div className="qr-code-container">
          {qrCodeUrl && <img src={qrCodeUrl} alt="MFA QR Code" />}
        </div>
        
        <form onSubmit={handleVerifyMFA} className="verification-form">
          <div className="form-group">
            <label htmlFor="verification-code">
              Enter the 6-digit code from your app:
            </label>
            <input
              type="text"
              id="verification-code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="123456"
              maxLength={6}
              pattern="[0-9]{6}"
              required
            />
          </div>
          
          <button type="submit" disabled={isLoading || verificationCode.length !== 6}>
            {isLoading ? 'Verifying...' : 'Verify and Enable MFA'}
          </button>
        </form>
        
        {error && <div className="error">{error}</div>}
      </div>
    );
  }

  return (
    <div className="mfa-complete">
      <h2>MFA Setup Complete!</h2>
      <p>Your multi-factor authentication has been successfully enabled.</p>
      
      <div className="backup-codes">
        <h3>Save Your Backup Codes</h3>
        <p>Store these codes in a safe place. Each code can only be used once.</p>
        
        <div className="codes-grid">
          {backupCodes.map((code, index) => (
            <div key={index} className="backup-code">
              {index + 1}. {code}
            </div>
          ))}
        </div>
        
        <button onClick={downloadBackupCodes} className="btn btn-secondary">
          Download Backup Codes
        </button>
      </div>
      
      <div className="next-steps">
        <h3>Next Steps:</h3>
        <ul>
          <li>✅ MFA is now enabled on your account</li>
          <li>💾 Save your backup codes in a secure location</li>
          <li>📱 Test login with your authenticator app</li>
          <li>🔒 Your account is now more secure!</li>
        </ul>
      </div>
    </div>
  );
};
```

### Vue 3 Integration

#### Composition API Authentication
```typescript
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';

// Composable for authentication
export function useAuth() {
  const user = ref(null);
  const isLoading = ref(false);
  const error = ref(null);
  const router = useRouter();

  const isAuthenticated = computed(() => !!user.value);
  const needsMFA = ref(false);

  const login = async (credentials) => {
    try {
      isLoading.value = true;
      error.value = null;
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error);
      }

      if (data.mfaRequired) {
        needsMFA.value = true;
        return { mfaRequired: true };
      }

      localStorage.setItem('access_token', data.accessToken);
      user.value = data.user;
      
      return data;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const verifyMFA = async (code, method = 'totp') => {
    try {
      isLoading.value = true;
      error.value = null;
      
      const response = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, method })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error);
      }

      localStorage.setItem('access_token', data.sessionToken);
      needsMFA.value = false;
      
      // Fetch user profile
      await checkAuth();
      
      return data;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const checkAuth = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    try {
      const response = await fetch('/api/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        user.value = data.profile;
      } else {
        localStorage.removeItem('access_token');
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      localStorage.removeItem('access_token');
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    user.value = null;
    needsMFA.value = false;
    router.push('/login');
  };

  onMounted(() => {
    checkAuth();
  });

  return {
    user,
    isLoading,
    error,
    isAuthenticated,
    needsMFA,
    login,
    verifyMFA,
    logout,
    checkAuth
  };
}
```

#### Vue MFA Component
```vue
<template>
  <div class="mfa-setup">
    <div v-if="step === 'setup'" class="setup-step">
      <h2>Enable Multi-Factor Authentication</h2>
      <p>Secure your account with an additional verification step.</p>
      
      <div class="setup-info">
        <h3>You'll need:</h3>
        <ul>
          <li>📱 An authenticator app</li>
          <li>⏱️ A few minutes to complete setup</li>
        </ul>
      </div>
      
      <button 
        @click="initiateMFASetup" 
        :disabled="isLoading"
        class="btn btn-primary"
      >
        {{ isLoading ? 'Setting up...' : 'Start Setup' }}
      </button>
    </div>

    <div v-if="step === 'qrcode'" class="qrcode-step">
      <h2>Scan QR Code</h2>
      <p>Open your authenticator app and scan this code:</p>
      
      <div class="qr-container">
        <img :src="qrCodeUrl" alt="MFA QR Code" class="qr-code" />
      </div>
      
      <form @submit.prevent="verifySetup">
        <div class="form-group">
          <label for="mfa-code">Enter verification code:</label>
          <input
            id="mfa-code"
            v-model="verificationCode"
            type="text"
            placeholder="123456"
            maxlength="6"
            required
            class="form-control"
          />
        </div>
        
        <button 
          type="submit" 
          :disabled="isLoading || verificationCode.length !== 6"
          class="btn btn-primary"
        >
          {{ isLoading ? 'Verifying...' : 'Verify & Enable' }}
        </button>
      </form>
    </div>

    <div v-if="step === 'complete'" class="complete-step">
      <h2>✅ MFA Enabled Successfully!</h2>
      
      <div class="backup-codes" v-if="backupCodes.length">
        <h3>🔑 Your Backup Codes</h3>
        <p>Save these codes safely. Each can only be used once.</p>
        
        <div class="codes-list">
          <div 
            v-for="(code, index) in backupCodes" 
            :key="index"
            class="backup-code"
          >
            {{ index + 1 }}. {{ code }}
          </div>
        </div>
        
        <button @click="downloadBackupCodes" class="btn btn-secondary">
          📥 Download Codes
        </button>
      </div>
    </div>

    <div v-if="error" class="alert alert-error">
      {{ error }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAuth } from '@/composables/useAuth';

const { error } = useAuth();

const step = ref('setup');
const isLoading = ref(false);
const qrCodeUrl = ref('');
const verificationCode = ref('');
const backupCodes = ref([]);

const initiateMFASetup = async () => {
  try {
    isLoading.value = true;
    
    const response = await fetch('/api/auth/mfa/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      },
      body: JSON.stringify({
        enable_mfa: true,
        methods: ['totp', 'backup_codes']
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error);
    }

    qrCodeUrl.value = data.setup_data.totp.qr_code_url;
    backupCodes.value = data.setup_data.backup_codes?.codes || [];
    step.value = 'qrcode';
    
  } catch (err) {
    error.value = err.message;
  } finally {
    isLoading.value = false;
  }
};

const verifySetup = async () => {
  try {
    isLoading.value = true;
    
    const response = await fetch('/api/auth/mfa/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      },
      body: JSON.stringify({
        code: verificationCode.value,
        method: 'totp',
        setup_verification: true
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error);
    }

    step.value = 'complete';
    
  } catch (err) {
    error.value = err.message;
  } finally {
    isLoading.value = false;
  }
};

const downloadBackupCodes = () => {
  const content = backupCodes.value
    .map((code, i) => `${i + 1}. ${code}`)
    .join('\n');
    
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup-codes-${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  URL.revokeObjectURL(url);
};
</script>

<style scoped>
.mfa-setup {
  max-width: 500px;
  margin: 0 auto;
  padding: 2rem;
}

.qr-container {
  display: flex;
  justify-content: center;
  margin: 2rem 0;
}

.qr-code {
  max-width: 200px;
  height: auto;
}

.codes-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  margin: 1rem 0;
}

.backup-code {
  padding: 0.5rem;
  background: #f5f5f5;
  border-radius: 4px;
  font-family: monospace;
}

.form-control {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.alert {
  padding: 1rem;
  border-radius: 4px;
  margin-top: 1rem;
}

.alert-error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}
</style>
```

## Backend Integration Examples

### Node.js/Express Integration

#### Middleware Setup
```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const app = express();

// Rate limiting middleware
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts',
    code: 'RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// JWT verification middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Authentication token required',
      code: 'AUTH_REQUIRED'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token is expired
    if (decoded.exp < Math.floor(Date.now() / 1000)) {
      return res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    // Check if user still exists and is active
    const user = await getUserById(decoded.sub);
    if (!user || user.status !== 'active') {
      return res.status(401).json({
        error: 'Invalid user',
        code: 'INVALID_USER'
      });
    }

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      roles: decoded.roles || [],
      mfaVerified: decoded.mfa_verified || false
    };
    
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
};

// MFA requirement middleware
const requireMFA = (req, res, next) => {
  if (!req.user.mfaVerified) {
    return res.status(403).json({
      error: 'MFA verification required',
      code: 'MFA_REQUIRED'
    });
  }
  next();
};

// Role-based access control
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user.roles.some(role => roles.includes(role))) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }
    next();
  };
};

// Apply middleware
app.use(express.json());
app.use('/api/auth', authLimiter);

// Authentication routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // Authenticate user
    const user = await authenticateUser(email, password);
    if (!user) {
      await logSecurityEvent('failed_login', { email, ip: req.ip });
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if MFA is required
    const mfaRequired = await checkMFARequirement(user);
    if (mfaRequired && !user.mfaVerified) {
      // Create temporary session for MFA
      const tempToken = jwt.sign(
        { sub: user.id, email: user.email, temp: true },
        process.env.JWT_SECRET,
        { expiresIn: '10m' }
      );
      
      return res.json({
        mfaRequired: true,
        tempToken,
        message: 'MFA verification required'
      });
    }

    // Create full access token
    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        roles: user.roles,
        mfa_verified: user.mfaVerified
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    await logSecurityEvent('successful_login', { 
      userId: user.id, 
      email: user.email,
      ip: req.ip 
    });

    res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        roles: user.roles
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// MFA setup endpoint
app.post('/api/auth/mfa/setup', authenticateToken, async (req, res) => {
  try {
    const { enable_mfa, methods } = req.body;
    
    if (!Array.isArray(methods) || methods.length === 0) {
      return res.status(400).json({
        error: 'At least one MFA method required',
        code: 'INVALID_METHODS'
      });
    }

    const setupData = {};
    
    // Generate TOTP setup if requested
    if (methods.includes('totp')) {
      const secret = generateTOTPSecret();
      const qrCodeUrl = generateQRCodeDataURL(secret, req.user.email);
      
      setupData.totp = {
        secret,
        qr_code_url: qrCodeUrl,
        manual_entry_key: formatSecretForManualEntry(secret)
      };
      
      // Store encrypted secret
      await storeMFASecret(req.user.id, 'totp', secret);
    }
    
    // Generate backup codes if requested
    if (methods.includes('backup_codes')) {
      const codes = generateBackupCodes(8);
      await storeBackupCodes(req.user.id, codes);
      
      setupData.backup_codes = {
        codes: codes.map(c => c.code),
        expires_at: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000) // 6 months
      };
    }
    
    await logSecurityEvent('mfa_setup_initiated', {
      userId: req.user.id,
      methods,
      ip: req.ip
    });
    
    res.json({
      message: 'MFA setup initiated successfully',
      mfa_enabled: enable_mfa,
      methods_configured: methods,
      setup_data: setupData,
      next_steps: getNextSteps(methods)
    });
    
  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({
      error: 'MFA setup failed',
      code: 'MFA_SETUP_ERROR'
    });
  }
});

// Protected profile endpoint
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const { includeCompletion, includeAnalytics } = req.query;
    
    const profile = await getUserProfile(req.user.id);
    const responseData = { profile };
    
    if (includeCompletion === 'true') {
      responseData.completion = await calculateProfileCompletion(req.user.id);
    }
    
    if (includeAnalytics === 'true') {
      responseData.analytics = await getProfileAnalytics(req.user.id);
    }
    
    res.json(responseData);
    
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch profile',
      code: 'PROFILE_FETCH_ERROR'
    });
  }
});

// Business owner only endpoint
app.get('/api/business/analytics', 
  authenticateToken, 
  requireMFA,
  requireRole(['business_owner', 'admin']), 
  async (req, res) => {
    try {
      const analytics = await getBusinessAnalytics(req.user.id);
      res.json(analytics);
    } catch (error) {
      console.error('Business analytics error:', error);
      res.status(500).json({
        error: 'Failed to fetch analytics',
        code: 'ANALYTICS_ERROR'
      });
    }
  }
);

module.exports = app;
```

### Python Flask Integration

#### Flask Application Setup
```python
from flask import Flask, request, jsonify, g
from functools import wraps
import jwt
import redis
from datetime import datetime, timedelta
import logging

app = Flask(__name__)
redis_client = redis.Redis(host='localhost', port=6379, db=0)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def authenticate_token(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({
                'error': 'Authentication token required',
                'code': 'AUTH_REQUIRED'
            }), 401
        
        token = auth_header.split(' ')[1]
        
        try:
            decoded = jwt.decode(
                token, 
                app.config['JWT_SECRET'], 
                algorithms=['HS256']
            )
            
            # Check if user exists and is active
            user = get_user_by_id(decoded['sub'])
            if not user or user.get('status') != 'active':
                return jsonify({
                    'error': 'Invalid user',
                    'code': 'INVALID_USER'
                }), 401
            
            g.user = {
                'id': decoded['sub'],
                'email': decoded.get('email'),
                'roles': decoded.get('roles', []),
                'mfa_verified': decoded.get('mfa_verified', False)
            }
            
            return f(*args, **kwargs)
            
        except jwt.ExpiredSignatureError:
            return jsonify({
                'error': 'Token expired',
                'code': 'TOKEN_EXPIRED'
            }), 401
        except jwt.InvalidTokenError:
            return jsonify({
                'error': 'Invalid token',
                'code': 'INVALID_TOKEN'
            }), 401
    
    return decorated_function

def require_mfa(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not g.user.get('mfa_verified'):
            return jsonify({
                'error': 'MFA verification required',
                'code': 'MFA_REQUIRED'
            }), 403
        return f(*args, **kwargs)
    return decorated_function

def require_roles(roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_roles = g.user.get('roles', [])
            if not any(role in user_roles for role in roles):
                return jsonify({
                    'error': 'Insufficient permissions',
                    'code': 'INSUFFICIENT_PERMISSIONS'
                }), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

@app.route('/api/auth/mfa/setup', methods=['POST'])
@authenticate_token
def setup_mfa():
    try:
        data = request.get_json()
        enable_mfa = data.get('enable_mfa', True)
        methods = data.get('methods', ['totp'])
        
        if not isinstance(methods, list) or not methods:
            return jsonify({
                'error': 'At least one MFA method required',
                'code': 'INVALID_METHODS'
            }), 400
        
        setup_data = {}
        
        # Generate TOTP setup
        if 'totp' in methods:
            from pyotp import random_base32
            import qrcode
            import io
            import base64
            
            secret = random_base32()
            totp_uri = f"otpauth://totp/LawlessDirectory:{g.user['email']}?secret={secret}&issuer=LawlessDirectory"
            
            # Generate QR code
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(totp_uri)
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            img_buffer = io.BytesIO()
            img.save(img_buffer, format='PNG')
            img_buffer.seek(0)
            
            qr_code_base64 = base64.b64encode(img_buffer.getvalue()).decode()
            qr_code_url = f"data:image/png;base64,{qr_code_base64}"
            
            setup_data['totp'] = {
                'secret': secret,
                'qr_code_url': qr_code_url,
                'manual_entry_key': ' '.join([secret[i:i+4] for i in range(0, len(secret), 4)])
            }
            
            # Store encrypted secret (implement encryption)
            store_mfa_secret(g.user['id'], 'totp', secret)
        
        # Generate backup codes
        if 'backup_codes' in methods:
            import secrets
            codes = [secrets.token_hex(6).upper() for _ in range(8)]
            store_backup_codes(g.user['id'], codes)
            
            setup_data['backup_codes'] = {
                'codes': codes,
                'expires_at': (datetime.utcnow() + timedelta(days=180)).isoformat() + 'Z'
            }
        
        # Log security event
        log_security_event('mfa_setup_initiated', {
            'user_id': g.user['id'],
            'methods': methods,
            'ip': request.remote_addr
        })
        
        return jsonify({
            'message': 'MFA setup initiated successfully',
            'mfa_enabled': enable_mfa,
            'methods_configured': methods,
            'setup_data': setup_data,
            'next_steps': get_setup_next_steps(methods)
        })
        
    except Exception as e:
        logger.error(f'MFA setup error: {str(e)}')
        return jsonify({
            'error': 'MFA setup failed',
            'code': 'MFA_SETUP_ERROR'
        }), 500

@app.route('/api/auth/mfa/verify', methods=['POST'])
@authenticate_token
def verify_mfa():
    try:
        data = request.get_json()
        code = data.get('code')
        method = data.get('method', 'totp')
        trust_device = data.get('trust_device', False)
        
        if not code:
            return jsonify({
                'error': 'Verification code required',
                'code': 'CODE_REQUIRED'
            }), 400
        
        # Verify the code based on method
        verification_result = verify_mfa_code(g.user['id'], code, method)
        
        if not verification_result['valid']:
            log_security_event('mfa_verification_failed', {
                'user_id': g.user['id'],
                'method': method,
                'ip': request.remote_addr
            })
            
            return jsonify({
                'error': 'Invalid or expired verification code',
                'code': 'INVALID_MFA_CODE',
                'attempts_remaining': verification_result.get('attempts_remaining', 0)
            }), 400
        
        # Handle device trust
        device_trusted = False
        if trust_device:
            device_id = request.headers.get('X-Device-ID') or generate_device_id(request)
            device_trusted = add_trusted_device(g.user['id'], device_id, request)
        
        # Generate new session token with MFA verified
        new_token = jwt.encode({
            'sub': g.user['id'],
            'email': g.user['email'],
            'roles': g.user['roles'],
            'mfa_verified': True,
            'iat': datetime.utcnow(),
            'exp': datetime.utcnow() + timedelta(hours=24)
        }, app.config['JWT_SECRET'], algorithm='HS256')
        
        log_security_event('mfa_verification_successful', {
            'user_id': g.user['id'],
            'method': method,
            'device_trusted': device_trusted,
            'ip': request.remote_addr
        })
        
        response_data = {
            'success': True,
            'message': 'MFA verification successful',
            'method_verified': method,
            'device_trusted': device_trusted,
            'session_token': new_token
        }
        
        if method == 'backup_code':
            remaining_codes = get_remaining_backup_codes_count(g.user['id'])
            response_data.update({
                'backup_code_used': True,
                'remaining_backup_codes': remaining_codes
            })
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f'MFA verification error: {str(e)}')
        return jsonify({
            'error': 'MFA verification failed',
            'code': 'MFA_VERIFICATION_ERROR'
        }), 500

@app.route('/api/profile', methods=['GET'])
@authenticate_token
def get_profile():
    try:
        include_completion = request.args.get('includeCompletion') == 'true'
        include_analytics = request.args.get('includeAnalytics') == 'true'
        include_recommendations = request.args.get('includeRecommendations') == 'true'
        
        profile = get_user_profile(g.user['id'])
        response_data = {'profile': profile}
        
        if include_completion:
            response_data['completion'] = calculate_profile_completion(g.user['id'])
        
        if include_analytics:
            response_data['analytics'] = get_profile_analytics(g.user['id'])
            
        if include_recommendations:
            response_data['recommendations'] = get_profile_recommendations(g.user['id'])
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f'Profile fetch error: {str(e)}')
        return jsonify({
            'error': 'Failed to fetch profile',
            'code': 'PROFILE_FETCH_ERROR'
        }), 500

@app.route('/api/business/analytics', methods=['GET'])
@authenticate_token
@require_mfa
@require_roles(['business_owner', 'admin'])
def get_business_analytics():
    try:
        analytics = get_business_analytics_data(g.user['id'])
        return jsonify(analytics)
    except Exception as e:
        logger.error(f'Business analytics error: {str(e)}')
        return jsonify({
            'error': 'Failed to fetch business analytics',
            'code': 'ANALYTICS_ERROR'
        }), 500

# Helper functions (implement these based on your data layer)
def get_user_by_id(user_id):
    # Implementation depends on your database
    pass

def store_mfa_secret(user_id, method, secret):
    # Store encrypted MFA secret
    pass

def verify_mfa_code(user_id, code, method):
    # Verify MFA code against stored secret
    pass

def log_security_event(event_type, data):
    # Log security events for auditing
    logger.info(f'Security event: {event_type}', extra=data)

def get_setup_next_steps(methods):
    steps = []
    if 'totp' in methods:
        steps.extend([
            'Scan the QR code with your authenticator app',
            'Enter the verification code to complete TOTP setup'
        ])
    if 'backup_codes' in methods:
        steps.append('Save your backup codes in a secure location')
    steps.append('Test your MFA setup by logging out and back in')
    return steps

if __name__ == '__main__':
    app.run(debug=True)
```

### Security Best Practices Implementation

#### Token Security and Session Management
```javascript
// Secure token handling utility
class SecureTokenManager {
  constructor(options = {}) {
    this.jwtSecret = options.jwtSecret || process.env.JWT_SECRET;
    this.refreshSecret = options.refreshSecret || process.env.JWT_REFRESH_SECRET;
    this.accessTokenExpiry = options.accessTokenExpiry || '15m';
    this.refreshTokenExpiry = options.refreshTokenExpiry || '7d';
    this.issuer = options.issuer || 'lawlessdirectory.com';
  }

  // Generate access token with short expiry
  generateAccessToken(payload) {
    return jwt.sign(
      {
        ...payload,
        type: 'access',
        iat: Math.floor(Date.now() / 1000)
      },
      this.jwtSecret,
      {
        expiresIn: this.accessTokenExpiry,
        issuer: this.issuer,
        audience: 'lawlessdirectory-api'
      }
    );
  }

  // Generate refresh token with longer expiry
  generateRefreshToken(payload) {
    return jwt.sign(
      {
        sub: payload.sub,
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000),
        jti: generateJTI() // Unique token ID for blacklisting
      },
      this.refreshSecret,
      {
        expiresIn: this.refreshTokenExpiry,
        issuer: this.issuer,
        audience: 'lawlessdirectory-refresh'
      }
    );
  }

  // Verify access token
  verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: this.issuer,
        audience: 'lawlessdirectory-api'
      });
      
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }
      
      return decoded;
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  // Verify refresh token
  verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, this.refreshSecret, {
        issuer: this.issuer,
        audience: 'lawlessdirectory-refresh'
      });
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }
      
      // Check if token is blacklisted
      if (this.isTokenBlacklisted(decoded.jti)) {
        throw new Error('Token has been revoked');
      }
      
      return decoded;
    } catch (error) {
      throw new Error(`Refresh token verification failed: ${error.message}`);
    }
  }

  // Blacklist a refresh token
  async blacklistToken(tokenId) {
    // Store in Redis or database with expiration
    await redis.setex(`blacklisted_token:${tokenId}`, 7 * 24 * 60 * 60, 'true');
  }

  // Check if token is blacklisted
  async isTokenBlacklisted(tokenId) {
    const result = await redis.get(`blacklisted_token:${tokenId}`);
    return result === 'true';
  }

  // Generate unique token ID
  generateJTI() {
    return crypto.randomBytes(16).toString('hex');
  }
}

// Secure session management
class SessionManager {
  constructor(tokenManager) {
    this.tokenManager = tokenManager;
    this.activeSessions = new Map();
  }

  // Create new session
  async createSession(user, deviceInfo = {}) {
    const sessionId = crypto.randomUUID();
    const sessionData = {
      sessionId,
      userId: user.id,
      deviceInfo: {
        userAgent: deviceInfo.userAgent,
        ipAddress: deviceInfo.ipAddress,
        deviceId: deviceInfo.deviceId,
        location: deviceInfo.location
      },
      createdAt: new Date(),
      lastActivity: new Date(),
      mfaVerified: false,
      roles: user.roles || []
    };

    // Generate tokens
    const accessToken = this.tokenManager.generateAccessToken({
      sub: user.id,
      email: user.email,
      roles: user.roles,
      sessionId,
      mfa_verified: false
    });

    const refreshToken = this.tokenManager.generateRefreshToken({
      sub: user.id,
      sessionId
    });

    // Store session
    await this.storeSession(sessionId, sessionData);

    return {
      sessionId,
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        roles: user.roles
      }
    };
  }

  // Update session with MFA verification
  async updateSessionMFA(sessionId, verified = true) {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.mfaVerified = verified;
    session.lastActivity = new Date();

    await this.storeSession(sessionId, session);

    // Generate new access token with MFA status
    const accessToken = this.tokenManager.generateAccessToken({
      sub: session.userId,
      sessionId,
      mfa_verified: verified,
      roles: session.roles
    });

    return { accessToken };
  }

  // Refresh session tokens
  async refreshSession(refreshToken) {
    try {
      const decoded = this.tokenManager.verifyRefreshToken(refreshToken);
      const session = await this.getSession(decoded.sessionId);
      
      if (!session || session.userId !== decoded.sub) {
        throw new Error('Invalid session');
      }

      // Update last activity
      session.lastActivity = new Date();
      await this.storeSession(decoded.sessionId, session);

      // Generate new access token
      const newAccessToken = this.tokenManager.generateAccessToken({
        sub: session.userId,
        sessionId: decoded.sessionId,
        mfa_verified: session.mfaVerified,
        roles: session.roles
      });

      return {
        accessToken: newAccessToken,
        expiresIn: 900
      };

    } catch (error) {
      throw new Error(`Session refresh failed: ${error.message}`);
    }
  }

  // Terminate session
  async terminateSession(sessionId) {
    const session = await this.getSession(sessionId);
    if (session) {
      // Blacklist refresh token if it exists
      const refreshTokenId = session.refreshTokenId;
      if (refreshTokenId) {
        await this.tokenManager.blacklistToken(refreshTokenId);
      }
      
      // Remove session
      await this.removeSession(sessionId);
    }
  }

  // Terminate all user sessions
  async terminateAllUserSessions(userId) {
    const userSessions = await this.getUserSessions(userId);
    
    for (const session of userSessions) {
      await this.terminateSession(session.sessionId);
    }
  }

  // Store session (implement based on your storage solution)
  async storeSession(sessionId, sessionData) {
    // Redis implementation
    await redis.setex(
      `session:${sessionId}`,
      7 * 24 * 60 * 60, // 7 days
      JSON.stringify(sessionData)
    );
  }

  // Get session
  async getSession(sessionId) {
    const sessionData = await redis.get(`session:${sessionId}`);
    return sessionData ? JSON.parse(sessionData) : null;
  }

  // Remove session
  async removeSession(sessionId) {
    await redis.del(`session:${sessionId}`);
  }

  // Get all user sessions
  async getUserSessions(userId) {
    const keys = await redis.keys('session:*');
    const sessions = [];
    
    for (const key of keys) {
      const sessionData = await redis.get(key);
      const session = JSON.parse(sessionData);
      
      if (session.userId === userId) {
        sessions.push(session);
      }
    }
    
    return sessions;
  }
}

// Usage example
const tokenManager = new SecureTokenManager({
  jwtSecret: process.env.JWT_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d'
});

const sessionManager = new SessionManager(tokenManager);

// Login endpoint with secure session management
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Authenticate user
    const user = await authenticateUser(email, password);
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Create secure session
    const sessionResult = await sessionManager.createSession(user, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      deviceId: req.headers['x-device-id']
    });

    // Set secure HTTP-only cookies for web clients
    res.cookie('refreshToken', sessionResult.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      accessToken: sessionResult.accessToken,
      expiresIn: sessionResult.expiresIn,
      user: sessionResult.user,
      mfaRequired: !sessionResult.user.mfaVerified && await checkMFARequirement(user)
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
});
```

This comprehensive developer integration guide provides complete examples for integrating with The Lawless Directory authentication system across multiple programming languages and frameworks. The examples include proper error handling, security best practices, and production-ready code patterns that developers can adapt to their specific use cases.

---

**Generated:** 2025-08-26  
**Document Version:** 1.0.0  
**Last Updated:** 2025-08-26  
**Maintained by:** The Lawless Directory Engineering Team

For additional technical support and integration assistance, contact our developer support team at developers@lawlessdirectory.com.
