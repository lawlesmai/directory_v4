# OAuth Production Setup Guide

## Overview

This guide provides comprehensive instructions for configuring OAuth authentication in production for the Lawless Directory application. The system supports Google, Apple, Facebook, and GitHub authentication with enterprise-grade security features.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Security Key Generation](#security-key-generation)
3. [Provider Setup](#provider-setup)
4. [Environment Configuration](#environment-configuration)
5. [Security Configuration](#security-configuration)
6. [Testing & Validation](#testing--validation)
7. [Troubleshooting](#troubleshooting)
8. [Compliance & Monitoring](#compliance--monitoring)

## Prerequisites

### Required Accounts
- **Google Cloud Console** - For Google OAuth
- **Apple Developer Program** - For Apple Sign-In ($99/year)
- **Facebook Developers** - For Facebook Login  
- **GitHub Developer Settings** - For GitHub OAuth
- **Production Domain** - HTTPS required for all providers

### System Requirements
- OpenSSL for key generation
- Production domain with valid SSL certificate
- Access to environment variable configuration
- Database admin access for provider configuration

## Security Key Generation

Generate all security keys using cryptographically secure methods:

```bash
# Token encryption key (64-character hex)
openssl rand -hex 32

# Configuration encryption key (64-character hex)  
openssl rand -hex 32

# OAuth HMAC key for state parameter signing (64-character)
openssl rand -base64 48 | tr -d "=+/" | cut -c1-64
```

**Critical Security Notes:**
- Generate unique keys for each environment (dev, staging, production)
- Store keys securely (never in code or logs)
- Rotate keys every 90 days
- Use a secrets management system in production

## Provider Setup

### 1. Google OAuth Configuration

#### Setup Steps:
1. Go to [Google Cloud Console](https://console.developers.google.com/)
2. Create new project or select existing project
3. Enable Google+ API and Google Identity services
4. Navigate to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Select "Web application" as application type

#### Configuration:
```
Application Type: Web Application
Name: Lawless Directory Production
Authorized JavaScript Origins: 
  - https://yourdomain.com
Authorized Redirect URIs:
  - https://yourdomain.com/api/auth/oauth/google/callback
```

#### Required Environment Variables:
```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secure-google-client-secret
GOOGLE_ENABLED=true
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/oauth/google/callback
```

#### Scopes Requested:
- `openid` - Basic authentication
- `email` - User email address
- `profile` - Basic profile information

### 2. Apple Sign-In Configuration

#### Prerequisites:
- Active Apple Developer Program membership ($99/year)
- Verified domain ownership
- App ID with Sign In with Apple capability

#### Setup Steps:
1. Go to [Apple Developer Console](https://developer.apple.com/account/resources/identifiers/)
2. Create new App ID:
   - Description: "Lawless Directory"
   - Bundle ID: `com.yourdomain.app`
   - Capabilities: Enable "Sign In with Apple"
3. Create Service ID for web authentication:
   - Identifier: `com.yourdomain.app.web`
   - Description: "Lawless Directory Web"
   - Configure Sign In with Apple:
     - Primary App ID: Select your App ID from step 2
     - Web Domain: `yourdomain.com`
     - Return URLs: `https://yourdomain.com/api/auth/oauth/apple/callback`
4. Generate private key:
   - Keys section → Create new key
   - Key Name: "Lawless Directory Apple Auth"
   - Enable "Sign In with Apple"
   - Download `AuthKey_XXXXXXXXXX.p8` file
   - Store securely - cannot be re-downloaded!

#### Apple Client Secret Generation:
Apple requires a JWT token as the client secret, generated using your private key:

```javascript
// Use this helper or implement JWT generation
const jwt = require('jsonwebtoken');
const fs = require('fs');

const privateKey = fs.readFileSync('/path/to/AuthKey_XXXXXXXXXX.p8', 'utf8');

const clientSecret = jwt.sign({
  iss: 'YOUR_TEAM_ID',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 15777000, // 6 months
  aud: 'https://appleid.apple.com',
  sub: 'com.yourdomain.app.web'
}, privateKey, { 
  algorithm: 'ES256',
  keyid: 'YOUR_KEY_ID'
});
```

#### Required Environment Variables:
```env
APPLE_CLIENT_ID=com.yourdomain.app.web
APPLE_CLIENT_SECRET=your-generated-jwt-token
APPLE_TEAM_ID=your-10-char-team-id
APPLE_KEY_ID=your-10-char-key-id
APPLE_PRIVATE_KEY_PATH=/secure/path/to/AuthKey_XXXXXXXXXX.p8
APPLE_ENABLED=true
APPLE_REDIRECT_URI=https://yourdomain.com/api/auth/oauth/apple/callback
```

### 3. Facebook OAuth Configuration

#### Setup Steps:
1. Go to [Facebook Developers](https://developers.facebook.com/apps/)
2. Create new app:
   - App Type: "Consumer"
   - App Name: "Lawless Directory"
   - Purpose: "Provide login functionality for business directory"
3. Add "Facebook Login" product
4. Configure Facebook Login settings:
   - Valid OAuth Redirect URIs: `https://yourdomain.com/api/auth/oauth/facebook/callback`
   - Client OAuth Settings:
     - Web OAuth Login: Yes
     - Enforce HTTPS: Yes
     - Valid OAuth Redirect URIs: Add your callback URL

#### App Review Requirements:
- For production use, Facebook requires app review for additional permissions
- Basic profile and email are available without review
- Submit for review if you need additional permissions

#### Required Environment Variables:
```env
FACEBOOK_CLIENT_ID=your-facebook-app-id
FACEBOOK_CLIENT_SECRET=your-secure-facebook-app-secret
FACEBOOK_ENABLED=true
FACEBOOK_REDIRECT_URI=https://yourdomain.com/api/auth/oauth/facebook/callback
```

#### Permissions Requested:
- `email` - User email address
- `public_profile` - Basic public profile information

### 4. GitHub OAuth Configuration

#### Setup Steps:
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in application details:
   - Application Name: "Lawless Directory"
   - Homepage URL: `https://yourdomain.com`
   - Application Description: "Business directory and networking platform"
   - Authorization Callback URL: `https://yourdomain.com/api/auth/oauth/github/callback`
4. Generate client secret and store securely

#### Required Environment Variables:
```env
GITHUB_CLIENT_ID=Iv1.your-github-client-id
GITHUB_CLIENT_SECRET=your-secure-github-client-secret
GITHUB_ENABLED=true
GITHUB_REDIRECT_URI=https://yourdomain.com/api/auth/oauth/github/callback
```

#### Scopes Requested:
- `read:user` - Read user profile information
- `user:email` - Access user email addresses

## Environment Configuration

### Production Environment File

Create `.env.local` with all required variables (see `.env.example` for complete template):

```env
# Core settings
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_SITE_URL=https://yourdomain.com

# Security keys (generate unique keys!)
TOKEN_ENCRYPTION_KEY=your-64-char-hex-key
CONFIG_ENCRYPTION_KEY=your-64-char-hex-key  
OAUTH_HMAC_KEY=your-64-char-hmac-key

# OAuth providers (configure all enabled providers)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
# ... (continue for all providers)
```

### File Security

```bash
# Set restrictive permissions
chmod 600 .env.local

# Ensure it's in .gitignore
echo ".env.local" >> .gitignore
```

## Security Configuration

### OAuth Security Features

The application implements comprehensive OAuth security measures:

#### 1. PKCE (Proof Key for Code Exchange)
- Automatically enabled for Google and GitHub
- Protects against authorization code interception
- Uses SHA256 code challenge method

#### 2. State Parameter Validation
- HMAC-signed state parameters prevent CSRF attacks
- State includes provider and redirect information
- Automatic validation on callback

#### 3. Rate Limiting
- Configurable rate limits per IP and provider
- Automatic blocking on suspicious activity
- Exponential backoff for repeated failures

#### 4. Redirect URI Validation
- Whitelist-based redirect URI validation
- Prevents open redirect vulnerabilities
- Configurable allowed origins

### Security Configuration Options

```env
# Rate limiting
OAUTH_RATE_LIMIT_ENABLED=true
OAUTH_MAX_ATTEMPTS_PER_MINUTE=5
OAUTH_BLOCK_DURATION_MINUTES=15

# Security enforcement
OAUTH_ENFORCE_HTTPS=true
OAUTH_ENFORCE_PKCE=true
OAUTH_REQUIRE_STATE_VALIDATION=true

# Account linking security
ACCOUNT_LINKING_REQUIRE_REAUTH=true
ACCOUNT_LINKING_REQUIRE_EMAIL_VERIFICATION=true
```

## Testing & Validation

### Pre-Production Testing Checklist

#### 1. OAuth Flow Testing
- [ ] Test Google OAuth flow end-to-end
- [ ] Test Apple Sign-In flow end-to-end
- [ ] Test Facebook OAuth flow end-to-end
- [ ] Test GitHub OAuth flow end-to-end
- [ ] Verify user profile data synchronization
- [ ] Test account linking for existing users

#### 2. Security Testing
- [ ] Verify HTTPS enforcement
- [ ] Test rate limiting functionality
- [ ] Validate state parameter protection
- [ ] Test redirect URI validation
- [ ] Verify token encryption
- [ ] Test error handling flows

#### 3. Integration Testing
- [ ] Test user registration via OAuth
- [ ] Test user login via OAuth
- [ ] Test profile updates from OAuth providers
- [ ] Test account disconnection
- [ ] Verify audit logging

### Test Commands

```bash
# Test OAuth initiation URLs
curl -i "https://yourdomain.com/api/auth/oauth/google"
curl -i "https://yourdomain.com/api/auth/oauth/apple"
curl -i "https://yourdomain.com/api/auth/oauth/facebook"
curl -i "https://yourdomain.com/api/auth/oauth/github"

# Test rate limiting (should block after configured attempts)
for i in {1..10}; do
  curl -i "https://yourdomain.com/api/auth/oauth/google"
done
```

### Manual Testing Steps

1. **Google OAuth Test:**
   - Navigate to your app's login page
   - Click "Continue with Google"
   - Verify redirect to Google
   - Complete Google authentication
   - Verify successful return to your app
   - Check user profile creation/update

2. **Repeat for Each Provider:**
   - Test with new user accounts
   - Test with existing user accounts  
   - Test account linking scenarios
   - Test error conditions

## Troubleshooting

### Common Issues and Solutions

#### 1. "Invalid Client ID" Error
**Cause:** Incorrect client ID or client not properly configured
**Solution:**
- Verify client ID in provider console matches environment variable
- Ensure OAuth app is published/approved if required
- Check for trailing spaces or special characters

#### 2. "Redirect URI Mismatch" Error
**Cause:** Callback URL not registered with OAuth provider
**Solution:**
- Add exact callback URL to provider configuration
- Ensure HTTPS is used in production
- Check for trailing slashes or case sensitivity

#### 3. "Invalid Client Secret" Error
**Cause:** Incorrect or expired client secret
**Solution:**
- Regenerate client secret in provider console
- Update environment variable
- For Apple: Regenerate JWT token with correct parameters

#### 4. "Rate Limit Exceeded" Error
**Cause:** Too many OAuth attempts from same IP/user
**Solution:**
- Wait for rate limit window to reset
- Adjust rate limiting configuration if needed
- Check for bot activity or automated testing

### Debug Mode

Enable debug logging for troubleshooting:

```env
OAUTH_DEBUG_MODE=true
OAUTH_SECURITY_LOGGING=true
```

### Log Analysis

Monitor these log events:
- `oauth_initiation` - OAuth flow started
- `oauth_callback_error` - Callback processing failed
- `oauth_success` - Successful authentication
- `oauth_rate_limit_exceeded` - Rate limiting triggered
- `oauth_security_incident` - Security violation detected

## Compliance & Monitoring

### GDPR Compliance

For EU users, ensure compliance with GDPR requirements:

```env
GDPR_COMPLIANCE_ENABLED=true
DATA_RETENTION_DAYS=2555  # 7 years for business compliance
```

#### GDPR Features Implemented:
- User consent for data processing
- Right to data portability
- Right to erasure (account deletion)
- Data processing transparency
- Secure data handling

### Security Monitoring

Configure security monitoring and alerting:

```env
OAUTH_SECURITY_LOGGING=true
OAUTH_AUDIT_RETENTION_DAYS=90
OAUTH_ALERT_ON_SUSPICIOUS_ACTIVITY=true
OAUTH_SECURITY_WEBHOOK_URL=https://yourdomain.com/api/webhooks/security-alerts
```

#### Monitored Security Events:
- Multiple failed OAuth attempts
- Invalid state parameters (CSRF attempts)
- Unusual geographic access patterns
- Token manipulation attempts
- Rate limit violations

### Regular Maintenance

#### Monthly Tasks:
- [ ] Review OAuth provider security advisories
- [ ] Check rate limiting effectiveness
- [ ] Review security incident logs
- [ ] Verify backup authentication methods

#### Quarterly Tasks:
- [ ] Rotate security keys
- [ ] Update OAuth provider configurations
- [ ] Security audit of OAuth flows
- [ ] Performance optimization review

#### Annual Tasks:
- [ ] Comprehensive security penetration testing
- [ ] OAuth provider relationship review
- [ ] Compliance audit (GDPR, CCPA, etc.)
- [ ] Disaster recovery testing

## Production Deployment Checklist

### Pre-Deployment
- [ ] All environment variables configured
- [ ] Security keys generated and stored securely
- [ ] OAuth providers configured with production URLs
- [ ] Rate limiting configured appropriately
- [ ] Security monitoring enabled
- [ ] Backup authentication methods tested

### Post-Deployment
- [ ] Test all OAuth flows in production
- [ ] Verify security monitoring alerts
- [ ] Check audit logging functionality
- [ ] Monitor error rates and performance
- [ ] Validate user registration and login flows

### Rollback Plan
- [ ] Previous environment configuration backup
- [ ] Database rollback procedures documented
- [ ] OAuth provider rollback configurations ready
- [ ] Monitoring and alerting for rollback scenarios

## Support and Resources

### Documentation Links
- [Google OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [Apple Sign-In Documentation](https://developer.apple.com/sign-in-with-apple/)
- [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login/)
- [GitHub OAuth Documentation](https://docs.github.com/en/apps/oauth-apps)

### Security Resources
- [OAuth 2.1 Security Best Practices](https://tools.ietf.org/html/draft-ietf-oauth-security-topics)
- [PKCE RFC 7636](https://tools.ietf.org/html/rfc7636)
- [OAuth 2.0 Threat Model](https://tools.ietf.org/html/rfc6819)

### Emergency Contacts
- Security Team: security@yourdomain.com
- Development Team: dev@yourdomain.com
- Infrastructure Team: ops@yourdomain.com

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-25  
**Next Review:** 2025-04-25