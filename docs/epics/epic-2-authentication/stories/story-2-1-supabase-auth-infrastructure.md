# Story 2.1: Supabase Auth Configuration & Security Infrastructure

**Epic:** Epic 2 - Authentication & Authorization Layer  
**Story ID:** 2.1  
**Story Points:** 13  
**Priority:** P0 (Critical Security Foundation)  
**Assignee:** Backend Architect Agent  
**Sprint:** 1

## User Story

As a platform developer, I want to establish secure Supabase authentication infrastructure with proper SSR configuration so that all user authentication follows security best practices and enterprise-grade security standards.

## Story Overview

This foundational story establishes the complete authentication architecture using Supabase Auth with comprehensive security policies, database schema, and compliance frameworks. It serves as the security foundation for all subsequent authentication features.

## Detailed Acceptance Criteria

### Supabase Auth Project Setup
- **Given** production-ready authentication requirements
- **When** configuring Supabase authentication
- **Then** implement comprehensive authentication providers and security policies:

**Authentication Providers:**
- Email/password authentication with secure password policies
- Google OAuth integration for social login
- Apple Sign-In for iOS users (future-proofing)
- Magic link authentication for passwordless login
- Phone/SMS authentication for enhanced security

**Security Policies:**
- Minimum password requirements: 12+ characters, special characters, numbers
- Account lockout after 5 failed login attempts
- Password reset rate limiting (max 3 per hour)
- Email verification required for new accounts
- Session timeout configuration (7 days inactive)
- IP-based rate limiting for authentication endpoints

### Database Schema for Authentication

**Custom JWT Claims Function:**
```sql
-- Custom JWT claims for RBAC
CREATE OR REPLACE FUNCTION auth.custom_jwt_claims()
RETURNS JSONB AS $$
DECLARE
  claims JSONB;
BEGIN
  SELECT jsonb_build_object(
    'user_id', auth.uid(),
    'email', auth.email(),
    'roles', COALESCE(
      (SELECT array_agg(role) 
       FROM user_roles 
       WHERE user_id = auth.uid() 
       AND (expires_at IS NULL OR expires_at > NOW())),
      ARRAY[]::TEXT[]
    ),
    'permissions', COALESCE(
      (SELECT array_agg(DISTINCT p.permission)
       FROM user_roles ur
       JOIN role_permissions rp ON ur.role = rp.role
       JOIN permissions p ON rp.permission_id = p.id
       WHERE ur.user_id = auth.uid()
       AND (ur.expires_at IS NULL OR ur.expires_at > NOW())),
      ARRAY[]::TEXT[]
    ),
    'owned_businesses', COALESCE(
      (SELECT array_agg(id)
       FROM businesses
       WHERE owner_id = auth.uid()),
      ARRAY[]::UUID[]
    ),
    'subscription_tier', COALESCE(
      (SELECT subscription_tier
       FROM user_subscriptions
       WHERE user_id = auth.uid()
       AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1),
      'free'
    ),
    'metadata', jsonb_build_object(
      'last_login', NOW(),
      'ip_address', inet_client_addr(),
      'user_agent', current_setting('request.headers', true)::json->>'user-agent'
    )
  ) INTO claims;
  
  RETURN claims;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Hook into Supabase Auth JWT generation
ALTER ROLE authenticator SET pgrst.jwt_claims TO 'auth.custom_jwt_claims()';
```

**User Profiles Table:**
```sql
profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  display_name VARCHAR(255),
  avatar_url VARCHAR(255),
  bio TEXT,
  location VARCHAR(255),
  website VARCHAR(255),
  social_links JSONB,
  preferences JSONB DEFAULT '{}'::jsonb,
  marketing_consent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

**User Roles Table (RBAC System):**
```sql
user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'business_owner', 'admin')),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMP WITH TIME ZONE,
  active BOOLEAN DEFAULT TRUE
)
```

**Multi-Factor Authentication Configuration:**
```sql
-- MFA configuration table
CREATE TABLE auth_mfa_config (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_method VARCHAR(20) CHECK (mfa_method IN ('totp', 'sms', 'email')),
  mfa_secret TEXT, -- encrypted
  backup_codes TEXT[], -- encrypted
  phone_number VARCHAR(20),
  phone_verified BOOLEAN DEFAULT FALSE,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MFA verification tracking
CREATE TABLE auth_mfa_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  challenge_type VARCHAR(20),
  challenge_code VARCHAR(10),
  attempts INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '10 minutes',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security (RLS) Policies
- **Given** security requirements
- **When** implementing RLS policies
- **Then** create comprehensive access control:

**Profile Access Policies:**
- Users can read their own profiles
- Users can update their own profiles
- Public read access to basic profile information
- Admin read/write access to all profiles

**Business Ownership Policies:**
- Business owners can manage only their claimed businesses
- Admins have full access to all businesses
- Public read access to approved business information

### OAuth Provider Configuration
```sql
-- OAuth provider settings
CREATE TABLE oauth_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name VARCHAR(50) UNIQUE NOT NULL,
  client_id VARCHAR(255) NOT NULL,
  client_secret_encrypted TEXT NOT NULL,
  redirect_uri VARCHAR(500),
  scopes TEXT[],
  enabled BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User OAuth connections
CREATE TABLE user_oauth_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  provider VARCHAR(50) REFERENCES oauth_providers(provider_name),
  provider_user_id VARCHAR(255),
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  provider_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, provider_user_id)
);
```

### Session Management Architecture
```sql
-- Extended session tracking
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  session_token VARCHAR(255) UNIQUE NOT NULL,
  refresh_token VARCHAR(255) UNIQUE,
  
  -- Session metadata
  ip_address INET,
  user_agent TEXT,
  device_id VARCHAR(255),
  device_type VARCHAR(50),
  device_name VARCHAR(255),
  
  -- Geographic data
  country_code VARCHAR(2),
  region VARCHAR(100),
  city VARCHAR(100),
  timezone VARCHAR(50),
  
  -- Session lifecycle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  revoked_at TIMESTAMPTZ,
  revoke_reason VARCHAR(100),
  
  -- Security flags
  is_suspicious BOOLEAN DEFAULT FALSE,
  requires_mfa BOOLEAN DEFAULT FALSE,
  mfa_verified BOOLEAN DEFAULT FALSE
);

-- Session activity logging
CREATE TABLE session_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES user_sessions(id),
  activity_type VARCHAR(50),
  activity_data JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Environment Configuration
- **Given** multiple deployment environments
- **When** configuring authentication
- **Then** set up proper environment variables:
  - Development, staging, and production Supabase projects
  - Proper CORS configuration for all environments
  - Secure secret management for API keys
  - JWT secret configuration and rotation procedures

## Technical Implementation Notes

### SSR Configuration Requirements
- Use Supabase SSR package (@supabase/ssr)
- Implement proper cookie handling for authentication
- Server-side session validation for all protected routes
- Automatic token refresh without client-side exposure

### Security Monitoring
- Authentication event logging
- Failed login attempt tracking
- Suspicious activity detection
- Regular security audit procedures

### Password Policy Configuration
```typescript
export const authConfig = {
  // Token lifetimes
  jwt_expiry: 3600, // 1 hour
  refresh_token_expiry: 604800, // 7 days
  
  // Security settings
  password_min_length: 12,
  password_require_uppercase: true,
  password_require_numbers: true,
  password_require_symbols: true,
  
  // Rate limiting
  max_login_attempts: 5,
  lockout_duration: 900, // 15 minutes
  
  // Session settings
  concurrent_sessions_limit: 5,
  session_timeout_minutes: 60,
  remember_me_duration_days: 30,
  
  // MFA settings
  mfa_enrollment_required: ['admin', 'business_owner'],
  mfa_grace_period_days: 7
};
```

## Dependencies
- Epic 1 Story 1.4 (Database foundation must exist)
- Supabase project setup and configuration
- Environment configuration for all deployment stages

## Testing Requirements

### Security Tests
- Authentication flow penetration testing
- SQL injection prevention validation
- Cross-site request forgery (CSRF) protection
- Session hijacking prevention tests

### Unit Tests
- RLS policy validation tests
- User role assignment tests
- Password policy enforcement tests
- Rate limiting functionality tests

### Integration Tests
- OAuth provider integration tests
- Email verification flow tests
- Password reset functionality tests
- Multi-environment configuration tests

### Compliance Tests
- GDPR compliance validation
- Data protection regulations verification
- Audit trail completeness testing
- Privacy policy implementation confirmation

## Definition of Done

### Security Infrastructure
- [ ] Supabase Auth configured for all environments (dev, staging, production)
- [ ] Complete database schema with RLS policies implemented and tested
- [ ] All authentication providers (email, Google, Apple, magic link) configured and tested
- [ ] Security policies enforced and validated through penetration testing
- [ ] JWT custom claims function operational with role-based permissions

### Database & Schema
- [ ] User profiles table with proper constraints and indexing
- [ ] User roles table with RBAC implementation
- [ ] MFA configuration tables with encrypted storage
- [ ] OAuth provider configuration with secure credential storage
- [ ] Session management tables with comprehensive tracking

### Security & Compliance
- [ ] Row Level Security policies comprehensive and performance-tested
- [ ] Password policies enforced according to NIST guidelines
- [ ] Environment-specific configuration completed and documented
- [ ] Security monitoring and logging configured
- [ ] Audit logging for all authentication events implemented

### Testing & Validation
- [ ] Comprehensive security testing passed with zero critical vulnerabilities
- [ ] All authentication providers tested in each environment
- [ ] Performance testing completed (authentication response < 100ms)
- [ ] Compliance requirements met and validated (GDPR, data protection)
- [ ] Backup and recovery procedures documented and tested

### Documentation
- [ ] Authentication architecture documentation complete
- [ ] Security implementation guide created
- [ ] Environment setup documentation for all deployment stages
- [ ] API documentation for authentication endpoints
- [ ] Incident response procedures documented

## Acceptance Validation

### Security Validation Checklist
- [ ] Zero authentication bypass vulnerabilities
- [ ] All RLS policies prevent unauthorized data access
- [ ] Password policies cannot be circumvented
- [ ] Session management prevents hijacking and fixation
- [ ] Rate limiting prevents brute force attacks

### Performance Validation
- [ ] Authentication queries execute in < 50ms (P95)
- [ ] JWT token generation/validation < 20ms (P95)
- [ ] Database connection pooling optimized for auth workloads
- [ ] RLS policy execution does not impact query performance

### Compliance Validation
- [ ] User consent tracking for GDPR compliance
- [ ] Data retention policies implemented and automated
- [ ] Privacy controls accessible to end users
- [ ] Audit trail captures all required events

## Risk Assessment

**High Risk:** Complex RLS policies may impact performance
- *Mitigation:* Extensive performance testing and query optimization

**Medium Risk:** OAuth provider configuration complexity
- *Mitigation:* Comprehensive testing across all providers and environments

**Medium Risk:** Multi-environment configuration synchronization
- *Mitigation:* Infrastructure as Code approach with automated deployments

**Low Risk:** JWT custom claims function complexity
- *Mitigation:* Thorough unit testing and performance monitoring

## Success Metrics

- **Security:** Zero critical vulnerabilities in security audit
- **Performance:** Authentication response time < 100ms (P95)
- **Reliability:** 99.9% authentication service uptime
- **Compliance:** 100% GDPR compliance score
- **User Experience:** < 3 clicks for social authentication

This story establishes the foundational security infrastructure that all subsequent authentication features will build upon, ensuring enterprise-grade security from day one.