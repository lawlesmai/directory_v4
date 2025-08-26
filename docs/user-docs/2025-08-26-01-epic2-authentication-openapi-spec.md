# Epic 2 Authentication System - OpenAPI 3.0 Specification

**Document Type:** User Documentation  
**Created:** 2025-08-26  
**Version:** 1.0.0  
**Scope:** Complete API specification for Epic 2 authentication endpoints

## Table of Contents

1. [OpenAPI Specification](#openapi-specification)
2. [Authentication Overview](#authentication-overview)
3. [Security Schemes](#security-schemes)
4. [Error Responses](#error-responses)
5. [Implementation Examples](#implementation-examples)

## OpenAPI Specification

```yaml
openapi: 3.0.3
info:
  title: The Lawless Directory - Authentication API
  description: |
    Complete authentication and user management API for The Lawless Directory.
    
    This API provides comprehensive authentication services including:
    - User registration and onboarding
    - Login and session management  
    - Multi-factor authentication (TOTP, SMS, Email)
    - Password reset and recovery
    - Profile management and preferences
    - Role-based access control (RBAC)
    - Business owner verification and KYC
    - Security monitoring and audit logging
    
    ## Authentication
    
    All protected endpoints require authentication via:
    - Bearer token in Authorization header
    - Session-based authentication for web clients
    - API key authentication for server-to-server
    
    ## Rate Limiting
    
    All endpoints are rate-limited to prevent abuse:
    - Authentication endpoints: 5 requests per minute per IP
    - Password reset: 3 requests per hour per email
    - Profile updates: 30 requests per hour per user
    
    ## Security
    
    - All endpoints use HTTPS in production
    - CSRF protection for state-changing operations
    - Comprehensive audit logging for security events
    - Progressive account lockout for failed attempts
  version: 2.0.0
  contact:
    name: The Lawless Directory API Support
    email: api-support@lawlessdirectory.com
  license:
    name: Proprietary
    url: https://lawlessdirectory.com/license

servers:
  - url: https://api.lawlessdirectory.com/v2
    description: Production server
  - url: https://staging-api.lawlessdirectory.com/v2  
    description: Staging server
  - url: http://localhost:3000/api
    description: Development server

security:
  - BearerAuth: []
  - SessionAuth: []
  - ApiKeyAuth: []

paths:
  /auth/mfa/setup:
    get:
      summary: Get MFA setup status
      description: |
        Retrieves the current MFA configuration status for the authenticated user.
        
        Returns information about:
        - Whether MFA is enabled/enforced
        - Available and configured MFA methods  
        - Backup code status
        - Grace period for required roles
        - Trusted device settings
      tags:
        - Multi-Factor Authentication
      security:
        - BearerAuth: []
        - SessionAuth: []
      responses:
        '200':
          description: MFA setup status retrieved successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  mfa_enabled:
                    type: boolean
                    description: Whether MFA is currently enabled for the user
                  mfa_enforced:
                    type: boolean  
                    description: Whether MFA is enforced by policy
                  mfa_required:
                    type: boolean
                    description: Whether MFA is required for the user's role
                  grace_period_expires:
                    type: string
                    format: date-time
                    nullable: true
                    description: When the MFA grace period expires (if applicable)
                  methods:
                    type: object
                    properties:
                      totp:
                        $ref: '#/components/schemas/MFAMethodStatus'
                      sms:
                        allOf:
                          - $ref: '#/components/schemas/MFAMethodStatus'
                          - type: object
                            properties:
                              phone_number:
                                type: string
                                description: Masked phone number
                              phone_verified:
                                type: boolean
                      email:
                        allOf:
                          - $ref: '#/components/schemas/MFAMethodStatus'
                          - type: object
                            properties:
                              email_address:
                                type: string
                                description: Masked email address
                      backup_codes:
                        type: object
                        properties:
                          enabled:
                            type: boolean
                          total_codes:
                            type: integer
                          used_codes:
                            type: integer
                          remaining_codes:
                            type: integer
                          expires_at:
                            type: string
                            format: date-time
                          near_expiry:
                            type: boolean
                  trusted_devices_enabled:
                    type: boolean
                  max_trusted_devices:
                    type: integer
              examples:
                mfa_enabled:
                  summary: User with MFA enabled
                  value:
                    mfa_enabled: true
                    mfa_enforced: false
                    mfa_required: true
                    grace_period_expires: null
                    methods:
                      totp:
                        enabled: true
                        verified: true
                        available: true
                      sms:
                        enabled: false
                        phone_number: "+1***-***-1234"
                        phone_verified: false
                        available: true
                      email:
                        enabled: false
                        email_address: "user@*****.com"
                        available: true
                      backup_codes:
                        enabled: true
                        total_codes: 8
                        used_codes: 2
                        remaining_codes: 6
                        expires_at: "2025-12-26T10:30:00Z"
                        near_expiry: false
                    trusted_devices_enabled: true
                    max_trusted_devices: 5
                mfa_not_enabled:
                  summary: User without MFA in grace period
                  value:
                    mfa_enabled: false
                    mfa_enforced: false  
                    mfa_required: true
                    grace_period_expires: "2025-09-25T10:30:00Z"
                    methods:
                      totp:
                        enabled: false
                        verified: false
                        available: true
                      sms:
                        enabled: false
                        phone_number: null
                        phone_verified: false
                        available: true
                      email:
                        enabled: false
                        email_address: "user@example.com"
                        available: true
                      backup_codes:
                        enabled: false
                        total_codes: 0
                        used_codes: 0
                        remaining_codes: 0
                        expires_at: null
                        near_expiry: false
                    trusted_devices_enabled: true
                    max_trusted_devices: 5
        '401':
          $ref: '#/components/responses/Unauthorized'
        '500':
          $ref: '#/components/responses/InternalServerError'

    post:
      summary: Enable MFA for user account
      description: |
        Enables multi-factor authentication for the user account with specified methods.
        
        This endpoint:
        - Creates/updates MFA configuration
        - Generates setup data for requested methods (TOTP secrets, QR codes)
        - Provides backup codes if requested
        - Returns setup instructions and next steps
        
        **Note:** Methods must be verified separately after setup.
      tags:
        - Multi-Factor Authentication
      security:
        - BearerAuth: []
        - SessionAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                enable_mfa:
                  type: boolean
                  default: true
                  description: Whether to enable MFA
                methods:
                  type: array
                  items:
                    type: string
                    enum: [totp, sms, email]
                  default: ["totp"]
                  description: MFA methods to enable
                  example: ["totp", "backup_codes"]
              required:
                - methods
            examples:
              enable_totp:
                summary: Enable TOTP authentication
                value:
                  enable_mfa: true
                  methods: ["totp"]
              enable_multiple:
                summary: Enable multiple methods
                value:
                  enable_mfa: true
                  methods: ["totp", "sms", "backup_codes"]
      responses:
        '200':
          description: MFA setup initiated successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  message:
                    type: string
                  mfa_enabled:
                    type: boolean
                  methods_configured:
                    type: array
                    items:
                      type: string
                  setup_data:
                    type: object
                    properties:
                      totp:
                        type: object
                        properties:
                          secret:
                            type: string
                            description: Base32 encoded TOTP secret
                          qr_code_url:
                            type: string
                            description: QR code data URL for easy setup
                          manual_entry_key:
                            type: string
                            description: Formatted secret for manual entry
                      backup_codes:
                        type: object
                        properties:
                          codes:
                            type: array
                            items:
                              type: string
                            description: One-time backup codes
                          expires_at:
                            type: string
                            format: date-time
                  next_steps:
                    type: array
                    items:
                      type: string
                    description: Instructions for completing setup
              examples:
                totp_setup:
                  summary: TOTP setup response
                  value:
                    message: "MFA setup initiated successfully"
                    mfa_enabled: true
                    methods_configured: ["totp"]
                    setup_data:
                      totp:
                        secret: "JBSWY3DPEHPK3PXP"
                        qr_code_url: "data:image/png;base64,iVBORw0KGgo..."
                        manual_entry_key: "JBSW Y3DP EHPK 3PXP"
                    next_steps:
                      - "Scan the QR code with your authenticator app"
                      - "Enter the verification code to complete TOTP setup"
                      - "Generate and save your backup codes"
                      - "Test your MFA setup by logging out and back in"
        '400':
          description: Invalid request parameters
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                invalid_methods:
                  summary: Invalid MFA methods specified
                  value:
                    error: "Invalid MFA methods: invalid_method"
                    code: "INVALID_METHODS"
        '401':
          $ref: '#/components/responses/Unauthorized'
        '500':
          $ref: '#/components/responses/InternalServerError'

    delete:
      summary: Disable MFA for user account
      description: |
        Disables multi-factor authentication for the user account.
        
        **Security Note:** MFA cannot be disabled for users with roles that require it
        (super_admin, admin, business_owner) without administrative override.
        
        When MFA is disabled:
        - All MFA methods are deactivated
        - TOTP secrets and phone numbers are cleared
        - All backup codes are invalidated
        - All trusted devices are revoked
      tags:
        - Multi-Factor Authentication
      security:
        - BearerAuth: []
        - SessionAuth: []
      responses:
        '200':
          description: MFA disabled successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  message:
                    type: string
                  mfa_enabled:
                    type: boolean
                  backup_codes_invalidated:
                    type: boolean
                  trusted_devices_revoked:
                    type: boolean
              examples:
                success:
                  summary: MFA disabled successfully
                  value:
                    message: "MFA has been disabled successfully"
                    mfa_enabled: false
                    backup_codes_invalidated: true
                    trusted_devices_revoked: true
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          description: MFA cannot be disabled for user's role
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                role_restriction:
                  summary: Role requires MFA
                  value:
                    error: "MFA cannot be disabled for your role without admin override"
                    code: "MFA_REQUIRED_BY_ROLE"
        '500':
          $ref: '#/components/responses/InternalServerError'

  /auth/mfa/verify:
    post:
      summary: Verify MFA code
      description: |
        Verifies a multi-factor authentication code during login or for completing
        MFA setup.
        
        Supports verification of:
        - TOTP codes from authenticator apps
        - SMS verification codes
        - Email verification codes  
        - Backup codes
        
        **Rate Limiting:** Maximum 5 attempts per 5 minutes per user.
      tags:
        - Multi-Factor Authentication
      security:
        - BearerAuth: []
        - SessionAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                code:
                  type: string
                  description: The MFA verification code
                  example: "123456"
                method:
                  type: string
                  enum: [totp, sms, email, backup_code]
                  description: The MFA method being verified
                  example: "totp"
                trust_device:
                  type: boolean
                  default: false
                  description: Whether to mark this device as trusted
                setup_verification:
                  type: boolean
                  default: false
                  description: Whether this is verifying initial setup
              required:
                - code
                - method
            examples:
              totp_verification:
                summary: Verify TOTP code
                value:
                  code: "123456"
                  method: "totp"
                  trust_device: true
              backup_code:
                summary: Use backup code
                value:
                  code: "abc123def456"
                  method: "backup_code"
                  trust_device: false
              setup_verification:
                summary: Complete TOTP setup
                value:
                  code: "123456"
                  method: "totp"
                  setup_verification: true
      responses:
        '200':
          description: MFA verification successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  message:
                    type: string
                  method_verified:
                    type: string
                  device_trusted:
                    type: boolean
                  backup_code_used:
                    type: boolean
                  remaining_backup_codes:
                    type: integer
                    nullable: true
                  session_token:
                    type: string
                    description: New session token (if applicable)
              examples:
                totp_success:
                  summary: TOTP verification successful
                  value:
                    success: true
                    message: "MFA verification successful"
                    method_verified: "totp"
                    device_trusted: true
                    backup_code_used: false
                    remaining_backup_codes: null
                    session_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                backup_code_success:
                  summary: Backup code used successfully
                  value:
                    success: true
                    message: "Backup code accepted"
                    method_verified: "backup_code"
                    device_trusted: false
                    backup_code_used: true
                    remaining_backup_codes: 5
                    session_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        '400':
          description: Invalid or expired code
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                invalid_code:
                  summary: Invalid verification code
                  value:
                    error: "Invalid or expired verification code"
                    code: "INVALID_MFA_CODE"
                    attempts_remaining: 3
        '401':
          $ref: '#/components/responses/Unauthorized'
        '429':
          description: Too many verification attempts
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                rate_limited:
                  summary: Too many attempts
                  value:
                    error: "Too many verification attempts. Please try again later."
                    code: "MFA_RATE_LIMITED"
                    retry_after: 300
        '500':
          $ref: '#/components/responses/InternalServerError'

  /auth/password/reset/request:
    post:
      summary: Request password reset
      description: |
        Initiates a password reset process by sending a secure reset link.
        
        **Security Features:**
        - Rate limited to prevent abuse (3 requests per hour per email)
        - CSRF token validation required
        - Cryptographically secure reset tokens
        - Comprehensive audit logging
        - Generic response to prevent email enumeration
        
        **Process:**
        1. Validates email format and CSRF token
        2. Generates secure reset token
        3. Sends reset link via email (if account exists)
        4. Returns generic success message
      tags:
        - Password Management
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                email:
                  type: string
                  format: email
                  description: Email address for password reset
                  example: "user@example.com"
                method:
                  type: string
                  enum: [email, sms, admin]
                  default: email
                  description: Reset method (email is most common)
                requireMFA:
                  type: boolean
                  default: false
                  description: Whether to require MFA for reset completion
                csrfToken:
                  type: string
                  description: CSRF protection token
                  example: "abc123def456ghi789"
              required:
                - email
                - csrfToken
            examples:
              basic_request:
                summary: Basic password reset request
                value:
                  email: "user@example.com"
                  method: "email"
                  requireMFA: false
                  csrfToken: "abc123def456ghi789"
              mfa_required:
                summary: Reset requiring MFA verification
                value:
                  email: "admin@example.com"
                  method: "email"
                  requireMFA: true
                  csrfToken: "abc123def456ghi789"
      responses:
        '200':
          description: Reset request processed (generic response for security)
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  message:
                    type: string
                  expiresAt:
                    type: string
                    format: date-time
                    description: When the reset token expires
                  method:
                    type: string
                  processingTime:
                    type: integer
                    description: Request processing time in milliseconds
              examples:
                success:
                  summary: Reset request processed
                  value:
                    success: true
                    message: "If an account with this email exists, a password reset link has been sent."
                    expiresAt: "2025-08-26T16:30:00Z"
                    method: "email"
                    processingTime: 145
        '400':
          description: Invalid request format
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                invalid_email:
                  summary: Invalid email format
                  value:
                    error: "Invalid request format"
                    code: "INVALID_REQUEST"
                    details:
                      - path: ["email"]
                        message: "Valid email address required"
        '403':
          description: Invalid CSRF token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                csrf_error:
                  summary: CSRF token validation failed
                  value:
                    error: "Invalid security token"
                    code: "CSRF_TOKEN_INVALID"
        '429':
          description: Rate limit exceeded
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                rate_limited:
                  summary: Too many reset requests
                  value:
                    error: "Too many reset requests"
                    code: "RATE_LIMITED"
                    rateLimited: true
                    details: ["Maximum 3 requests per hour per email"]
        '500':
          $ref: '#/components/responses/InternalServerError'

  /auth/password/reset/complete:
    post:
      summary: Complete password reset
      description: |
        Completes the password reset process using a valid reset token.
        
        **Security Features:**
        - Token validation with timing-safe comparison
        - Password strength validation
        - Account lockout checking
        - MFA requirement enforcement (if configured)
        - Comprehensive audit logging
        
        **Process:**
        1. Validates reset token and expiration
        2. Checks password strength requirements
        3. Verifies MFA if required
        4. Updates password with Argon2id hashing
        5. Invalidates all existing sessions
        6. Logs security event
      tags:
        - Password Management
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                token:
                  type: string
                  description: Password reset token from email
                  example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                newPassword:
                  type: string
                  format: password
                  description: New password (8-128 characters)
                  example: "NewSecurePassword123!"
                confirmPassword:
                  type: string
                  format: password
                  description: Password confirmation
                  example: "NewSecurePassword123!"
                mfaCode:
                  type: string
                  description: MFA code (required if MFA is enforced)
                  example: "123456"
              required:
                - token
                - newPassword
                - confirmPassword
            examples:
              basic_reset:
                summary: Basic password reset
                value:
                  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  newPassword: "NewSecurePassword123!"
                  confirmPassword: "NewSecurePassword123!"
              mfa_reset:
                summary: Password reset with MFA
                value:
                  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  newPassword: "NewSecurePassword123!"
                  confirmPassword: "NewSecurePassword123!"
                  mfaCode: "123456"
      responses:
        '200':
          description: Password reset completed successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  message:
                    type: string
                  passwordUpdated:
                    type: boolean
                  sessionsInvalidated:
                    type: boolean
                  loginRequired:
                    type: boolean
                    description: Whether user needs to login again
              examples:
                success:
                  summary: Password reset successful
                  value:
                    success: true
                    message: "Password has been reset successfully"
                    passwordUpdated: true
                    sessionsInvalidated: true
                    loginRequired: true
        '400':
          description: Invalid request or weak password
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                weak_password:
                  summary: Password doesn't meet requirements
                  value:
                    error: "Password does not meet security requirements"
                    code: "WEAK_PASSWORD"
                    details:
                      - "Password must be at least 8 characters long"
                      - "Password must contain at least one special character"
                password_mismatch:
                  summary: Password confirmation mismatch
                  value:
                    error: "Password confirmation does not match"
                    code: "PASSWORD_MISMATCH"
        '401':
          description: Invalid or expired reset token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                invalid_token:
                  summary: Reset token invalid or expired
                  value:
                    error: "Invalid or expired reset token"
                    code: "INVALID_RESET_TOKEN"
        '403':
          description: Account locked or MFA required
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                account_locked:
                  summary: Account is locked
                  value:
                    error: "Account is temporarily locked"
                    code: "ACCOUNT_LOCKED"
                    lockoutEnds: "2025-08-26T15:30:00Z"
                mfa_required:
                  summary: MFA verification required
                  value:
                    error: "MFA verification required"
                    code: "MFA_REQUIRED"
        '500':
          $ref: '#/components/responses/InternalServerError'

  /profile:
    get:
      summary: Get user profile
      description: |
        Retrieves the authenticated user's profile information with optional
        completion scoring, analytics, and recommendations.
        
        **Query Parameters:**
        - `includeCompletion`: Include profile completion analysis
        - `includeAnalytics`: Include profile engagement analytics
        - `includeRecommendations`: Include profile improvement recommendations
        
        **Profile Completion Scoring:**
        The system calculates a comprehensive completion score based on:
        - Basic information (name, email, phone)
        - Profile details (bio, avatar, location)  
        - Account verification status
        - Business owner verification (if applicable)
        - Privacy settings configuration
      tags:
        - Profile Management
      security:
        - BearerAuth: []
        - SessionAuth: []
      parameters:
        - name: includeCompletion
          in: query
          description: Include profile completion analysis
          schema:
            type: boolean
            default: false
        - name: includeAnalytics
          in: query
          description: Include profile analytics
          schema:
            type: boolean
            default: false
        - name: includeRecommendations
          in: query
          description: Include improvement recommendations
          schema:
            type: boolean
            default: false
      responses:
        '200':
          description: Profile retrieved successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  profile:
                    $ref: '#/components/schemas/UserProfile'
                  completion:
                    $ref: '#/components/schemas/ProfileCompletion'
                  analytics:
                    $ref: '#/components/schemas/ProfileAnalytics'
                  recommendations:
                    type: array
                    items:
                      $ref: '#/components/schemas/ProfileRecommendation'
              examples:
                basic_profile:
                  summary: Basic profile response
                  value:
                    profile:
                      id: "123e4567-e89b-12d3-a456-426614174000"
                      displayName: "John Doe"
                      username: "johndoe"
                      firstName: "John"
                      lastName: "Doe"
                      email: "john@example.com"
                      avatarUrl: "https://example.com/avatar.jpg"
                      bio: "Business owner and community member"
                      phoneNumber: "+1-555-123-4567"
                      phoneVerified: true
                      emailVerified: true
                      city: "San Francisco"
                      state: "CA"
                      country: "US"
                      timezone: "America/Los_Angeles"
                      website: "https://johndoe.com"
                      profileCompletionScore: 85
                      profileCompletionLevel: "Expert"
                      accountStatus: "active"
                      isBusinessOwner: true
                      businessOwnerVerified: true
                      roles:
                        - id: "role_business_owner"
                          name: "business_owner"
                          displayName: "Business Owner"
                complete_profile:
                  summary: Profile with completion analysis
                  value:
                    profile:
                      id: "123e4567-e89b-12d3-a456-426614174000"
                      displayName: "John Doe"
                      username: "johndoe"
                      firstName: "John"
                      lastName: "Doe"
                      email: "john@example.com"
                      profileCompletionScore: 85
                      profileCompletionLevel: "Expert"
                    completion:
                      totalScore: 85
                      level: "Expert"
                      categories:
                        basic_info:
                          score: 95
                          weight: 30
                          completed: ["name", "email", "phone"]
                          missing: []
                        profile_details:
                          score: 80
                          weight: 25
                          completed: ["bio", "avatar", "location"]
                          missing: ["website"]
                        verification:
                          score: 90
                          weight: 20
                          completed: ["email_verified", "phone_verified", "business_verified"]
                          missing: []
                        privacy_settings:
                          score: 75
                          weight: 15
                          completed: ["visibility_set", "contact_info_set"]
                          missing: ["activity_sharing"]
                        engagement:
                          score: 70
                          weight: 10
                          completed: ["login_activity"]
                          missing: ["business_interactions", "reviews"]
                    recommendations:
                      - category: "profile_details"
                        priority: "medium"
                        title: "Add your website"
                        description: "Including your website helps customers find and trust your business"
                        points: 5
                        estimated_time: "2 minutes"
        '401':
          $ref: '#/components/responses/Unauthorized'
        '500':
          $ref: '#/components/responses/InternalServerError'

    put:
      summary: Update user profile
      description: |
        Updates the authenticated user's profile information.
        
        **Validation:**
        - Username must be unique and 3-50 characters
        - Email format validation (if provided)
        - Phone number format validation
        - Website URL validation
        - Bio length limits (500 characters)
        
        **Features:**
        - Automatic profile completion score recalculation
        - Achievement badge checking
        - Comprehensive audit logging
        - Privacy settings validation
      tags:
        - Profile Management
      security:
        - BearerAuth: []
        - SessionAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                display_name:
                  type: string
                  maxLength: 100
                  description: Display name for the user
                username:
                  type: string
                  pattern: '^[a-zA-Z0-9_]{3,50}$'
                  description: Unique username (3-50 characters, letters, numbers, underscores only)
                first_name:
                  type: string
                  maxLength: 50
                last_name:
                  type: string
                  maxLength: 50
                bio:
                  type: string
                  maxLength: 500
                  description: User biography/description
                phone_number:
                  type: string
                  pattern: '^\+?[\d\s\-\(\)]{10,}$'
                  description: Phone number in international format
                city:
                  type: string
                  maxLength: 100
                state:
                  type: string
                  maxLength: 100
                country:
                  type: string
                  maxLength: 100
                timezone:
                  type: string
                  description: IANA timezone identifier
                website:
                  type: string
                  format: uri
                  description: Personal or business website URL
                social_links:
                  type: object
                  properties:
                    twitter:
                      type: string
                    linkedin:
                      type: string
                    facebook:
                      type: string
                    instagram:
                      type: string
                  description: Social media profile links
                profile_visibility:
                  type: string
                  enum: [public, private, business_only]
                  default: public
                profile_searchable:
                  type: boolean
                  default: true
                show_contact_info:
                  type: boolean
                  default: false
                show_social_links:
                  type: boolean
                  default: true
                show_location:
                  type: boolean
                  default: true
                show_activity:
                  type: boolean
                  default: false
            examples:
              basic_update:
                summary: Update basic profile information
                value:
                  display_name: "John Doe"
                  username: "johndoe_updated"
                  first_name: "John"
                  last_name: "Doe"
                  bio: "Passionate business owner helping the local community"
                  city: "San Francisco"
                  state: "California"
                  country: "United States"
              privacy_update:
                summary: Update privacy settings
                value:
                  profile_visibility: "business_only"
                  show_contact_info: true
                  show_social_links: false
                  show_location: true
                  show_activity: false
      responses:
        '200':
          description: Profile updated successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  message:
                    type: string
                  profile:
                    $ref: '#/components/schemas/UserProfile'
                  completion:
                    $ref: '#/components/schemas/ProfileCompletion'
                  newBadges:
                    type: array
                    items:
                      type: object
                      properties:
                        id:
                          type: string
                        name:
                          type: string
                        description:
                          type: string
                  newMilestones:
                    type: array
                    items:
                      type: object
                      properties:
                        id:
                          type: string
                        name:
                          type: string
                        achievement_date:
                          type: string
                          format: date-time
              examples:
                success_with_badges:
                  summary: Update with new achievement badges
                  value:
                    success: true
                    message: "Profile updated successfully"
                    profile:
                      id: "123e4567-e89b-12d3-a456-426614174000"
                      displayName: "John Doe"
                      profileCompletionScore: 90
                      profileCompletionLevel: "Expert"
                    completion:
                      totalScore: 90
                      level: "Expert"
                      levelUp: true
                      previousScore: 85
                    newBadges:
                      - id: "completionist"
                        name: "Profile Completionist"
                        description: "Completed 90% of your profile"
                    newMilestones:
                      - id: "expert_level"
                        name: "Expert Level Reached"
                        achievement_date: "2025-08-26T12:30:00Z"
        '400':
          description: Invalid profile data
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                validation_error:
                  summary: Profile validation failed
                  value:
                    error: "Profile validation failed"
                    code: "VALIDATION_ERROR"
                    details:
                      - field: "username"
                        message: "Username must be 3-50 characters and contain only letters, numbers, and underscores"
                      - field: "bio"
                        message: "Bio must be less than 500 characters"
        '401':
          $ref: '#/components/responses/Unauthorized'
        '409':
          description: Username already taken
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                username_taken:
                  summary: Username already exists
                  value:
                    error: "Username already taken"
                    code: "USERNAME_TAKEN"
        '500':
          $ref: '#/components/responses/InternalServerError'

    patch:
      summary: Update specific profile field
      description: |
        Updates a single profile field with validation and completion scoring.
        
        **Use Cases:**
        - Quick single-field updates from UI
        - Real-time profile editing
        - Targeted field validation
        - Minimal API calls for better performance
        
        **Supported Fields:**
        All standard profile fields plus privacy settings.
        Username changes include uniqueness validation.
      tags:
        - Profile Management
      security:
        - BearerAuth: []
        - SessionAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                field:
                  type: string
                  description: The profile field to update
                  enum:
                    - display_name
                    - username
                    - first_name
                    - last_name
                    - bio
                    - phone_number
                    - city
                    - state
                    - country
                    - timezone
                    - website
                    - social_links
                    - profile_visibility
                    - profile_searchable
                    - show_contact_info
                    - show_social_links
                    - show_location
                    - show_activity
                value:
                  description: The new value for the field
                metadata:
                  type: object
                  description: Additional metadata for the update
              required:
                - field
                - value
            examples:
              update_username:
                summary: Update username
                value:
                  field: "username"
                  value: "new_username"
              update_bio:
                summary: Update biography
                value:
                  field: "bio"
                  value: "Updated bio with new information about my business"
              update_privacy:
                summary: Update privacy setting
                value:
                  field: "show_contact_info"
                  value: true
                  metadata:
                    reason: "business_verification"
      responses:
        '200':
          description: Field updated successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  message:
                    type: string
                  field:
                    type: string
                  value:
                    description: The updated value
                  completionScore:
                    type: integer
                    description: Updated profile completion score
                  completionLevel:
                    type: string
                    description: Updated completion level
              examples:
                field_updated:
                  summary: Field update successful
                  value:
                    success: true
                    message: "username updated successfully"
                    field: "username"
                    value: "new_username"
                    completionScore: 87
                    completionLevel: "Expert"
        '400':
          description: Invalid field or value
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                invalid_field:
                  summary: Invalid field name
                  value:
                    error: "Invalid field name"
                    code: "INVALID_FIELD"
                invalid_username:
                  summary: Invalid username format
                  value:
                    error: "Username must be 3-50 characters and contain only letters, numbers, and underscores"
                    code: "INVALID_USERNAME"
        '401':
          $ref: '#/components/responses/Unauthorized'
        '409':
          description: Field value conflicts (e.g., username taken)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                username_taken:
                  summary: Username already exists
                  value:
                    error: "Username already taken"
                    code: "USERNAME_TAKEN"
        '500':
          $ref: '#/components/responses/InternalServerError'

    delete:
      summary: Delete user profile
      description: |
        Deletes or anonymizes the user's profile based on GDPR requirements.
        
        **Deletion Options:**
        - **Soft Delete (keepAnonymized: true)**: Anonymizes profile data but retains records
        - **Hard Delete (keepAnonymized: false)**: Marks for complete deletion
        
        **GDPR Compliance:**
        - Right to erasure implementation
        - Data retention policy enforcement
        - Audit trail preservation
        - Third-party data handling
        
        **Security:**
        - Requires active authenticated session
        - Comprehensive audit logging
        - Immediate session invalidation
      tags:
        - Profile Management
      security:
        - BearerAuth: []
        - SessionAuth: []
      requestBody:
        required: false
        content:
          application/json:
            schema:
              type: object
              properties:
                reason:
                  type: string
                  description: Reason for account deletion
                  maxLength: 500
                keepAnonymized:
                  type: boolean
                  default: true
                  description: Whether to anonymize data or mark for complete deletion
            examples:
              soft_delete:
                summary: Anonymize profile data
                value:
                  reason: "No longer need account"
                  keepAnonymized: true
              hard_delete:
                summary: Request complete deletion
                value:
                  reason: "GDPR data deletion request"
                  keepAnonymized: false
      responses:
        '200':
          description: Profile deletion initiated successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  message:
                    type: string
                  deletionType:
                    type: string
                    enum: [anonymized, marked_for_deletion]
              examples:
                anonymized:
                  summary: Profile anonymized successfully
                  value:
                    success: true
                    message: "Profile anonymized successfully"
                    deletionType: "anonymized"
                marked_for_deletion:
                  summary: Marked for complete deletion
                  value:
                    success: true
                    message: "Profile marked for deletion"
                    deletionType: "marked_for_deletion"
        '401':
          $ref: '#/components/responses/Unauthorized'
        '500':
          $ref: '#/components/responses/InternalServerError'

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: |
        JWT Bearer token authentication for API access.
        
        Include in Authorization header: `Authorization: Bearer <token>`
        
        Tokens are issued during login and have a 24-hour expiration.
        
    SessionAuth:
      type: apiKey
      in: cookie
      name: session
      description: |
        Session-based authentication using secure HTTP-only cookies.
        
        Sessions are established during login and maintained automatically
        by the browser. Ideal for web application integration.
        
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
      description: |
        API key authentication for server-to-server communication.
        
        Contact support to obtain API keys for your application.

  schemas:
    Error:
      type: object
      properties:
        error:
          type: string
          description: Human-readable error message
        code:
          type: string
          description: Machine-readable error code
        details:
          description: Additional error details (format varies)
        timestamp:
          type: string
          format: date-time
          description: When the error occurred
      required:
        - error
        - code

    MFAMethodStatus:
      type: object
      properties:
        enabled:
          type: boolean
          description: Whether this MFA method is enabled
        verified:
          type: boolean
          description: Whether this MFA method has been verified
        available:
          type: boolean
          description: Whether this MFA method is available for use
      required:
        - enabled
        - verified
        - available

    UserProfile:
      type: object
      properties:
        id:
          type: string
          format: uuid
          description: Unique user identifier
        displayName:
          type: string
          description: User's display name
        username:
          type: string
          description: Unique username
        firstName:
          type: string
        lastName:
          type: string
        email:
          type: string
          format: email
        avatarUrl:
          type: string
          format: uri
          nullable: true
        bio:
          type: string
          nullable: true
        phoneNumber:
          type: string
          nullable: true
        phoneVerified:
          type: boolean
        emailVerified:
          type: boolean
        city:
          type: string
          nullable: true
        state:
          type: string
          nullable: true
        country:
          type: string
          nullable: true
        timezone:
          type: string
          nullable: true
        website:
          type: string
          format: uri
          nullable: true
        socialLinks:
          type: object
          nullable: true
        preferences:
          type: object
          nullable: true
        profileVisibility:
          type: string
          enum: [public, private, business_only]
        profileSearchable:
          type: boolean
        showContactInfo:
          type: boolean
        showSocialLinks:
          type: boolean
        showLocation:
          type: boolean
        showActivity:
          type: boolean
        isBusinessOwner:
          type: boolean
        businessOwnerVerified:
          type: boolean
        profileCompletionScore:
          type: integer
          minimum: 0
          maximum: 100
        profileCompletionLevel:
          type: string
          enum: [Beginner, Intermediate, Advanced, Expert, Master]
        accountStatus:
          type: string
          enum: [active, inactive, suspended, deleted, pending_verification]
        lastLoginAt:
          type: string
          format: date-time
          nullable: true
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
        roles:
          type: array
          items:
            type: object
            properties:
              id:
                type: string
              name:
                type: string
              displayName:
                type: string
      required:
        - id
        - email
        - profileCompletionScore
        - accountStatus
        - createdAt
        - updatedAt

    ProfileCompletion:
      type: object
      properties:
        totalScore:
          type: integer
          minimum: 0
          maximum: 100
          description: Overall profile completion percentage
        level:
          type: string
          enum: [Beginner, Intermediate, Advanced, Expert, Master]
          description: Completion level based on score
        levelUp:
          type: boolean
          description: Whether user leveled up with this update
        previousScore:
          type: integer
          description: Previous completion score (if updated)
        categories:
          type: object
          description: Breakdown by completion categories
          properties:
            basic_info:
              $ref: '#/components/schemas/CompletionCategory'
            profile_details:
              $ref: '#/components/schemas/CompletionCategory'
            verification:
              $ref: '#/components/schemas/CompletionCategory'
            privacy_settings:
              $ref: '#/components/schemas/CompletionCategory'
            engagement:
              $ref: '#/components/schemas/CompletionCategory'
        nextMilestone:
          type: object
          nullable: true
          properties:
            score:
              type: integer
            level:
              type: string
            pointsNeeded:
              type: integer
      required:
        - totalScore
        - level
        - categories

    CompletionCategory:
      type: object
      properties:
        score:
          type: integer
          minimum: 0
          maximum: 100
        weight:
          type: integer
          description: Category weight in total score calculation
        completed:
          type: array
          items:
            type: string
          description: Completed items in this category
        missing:
          type: array
          items:
            type: string
          description: Missing items in this category
      required:
        - score
        - weight
        - completed
        - missing

    ProfileAnalytics:
      type: object
      properties:
        profileViews:
          type: integer
          description: Number of times profile has been viewed
        lastViewedAt:
          type: string
          format: date-time
          nullable: true
        completionTrend:
          type: object
          properties:
            last7Days:
              type: integer
              description: Score change in last 7 days
            last30Days:
              type: integer
              description: Score change in last 30 days
        engagementScore:
          type: integer
          minimum: 0
          maximum: 100
          description: User engagement score
        achievements:
          type: object
          properties:
            totalBadges:
              type: integer
            totalMilestones:
              type: integer
            lastBadgeEarned:
              type: string
              format: date-time
              nullable: true

    ProfileRecommendation:
      type: object
      properties:
        category:
          type: string
          description: Profile completion category
        priority:
          type: string
          enum: [low, medium, high, critical]
        title:
          type: string
          description: Recommendation title
        description:
          type: string
          description: Detailed recommendation
        points:
          type: integer
          description: Points gained by completing this recommendation
        estimatedTime:
          type: string
          description: Estimated time to complete
        actionUrl:
          type: string
          format: uri
          nullable: true
          description: Direct URL to complete the recommendation
      required:
        - category
        - priority
        - title
        - description
        - points

  responses:
    Unauthorized:
      description: Authentication required or invalid
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          examples:
            missing_auth:
              summary: No authentication provided
              value:
                error: "Authentication required"
                code: "AUTH_REQUIRED"
                timestamp: "2025-08-26T12:30:00Z"
            invalid_token:
              summary: Invalid or expired token
              value:
                error: "Invalid or expired authentication token"
                code: "INVALID_TOKEN"
                timestamp: "2025-08-26T12:30:00Z"

    InternalServerError:
      description: Internal server error
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          examples:
            server_error:
              summary: Generic server error
              value:
                error: "Internal server error"
                code: "INTERNAL_ERROR"
                timestamp: "2025-08-26T12:30:00Z"

  examples:
    MFASetupResponse:
      summary: Complete MFA setup response
      value:
        message: "MFA setup initiated successfully"
        mfa_enabled: true
        methods_configured: ["totp", "backup_codes"]
        setup_data:
          totp:
            secret: "JBSWY3DPEHPK3PXP"
            qr_code_url: "data:image/png;base64,iVBORw0KGgo..."
            manual_entry_key: "JBSW Y3DP EHPK 3PXP"
          backup_codes:
            codes: ["abc123def456", "ghi789jkl012", "mno345pqr678"]
            expires_at: "2025-12-26T10:30:00Z"
        next_steps:
          - "Scan the QR code with your authenticator app"
          - "Enter the verification code to complete TOTP setup"
          - "Save your backup codes in a secure location"
          - "Test your MFA setup by logging out and back in"

tags:
  - name: Multi-Factor Authentication
    description: |
      Multi-factor authentication (MFA) endpoints for enhanced account security.
      
      The Lawless Directory supports multiple MFA methods:
      - **TOTP (Time-based One-time Password)**: Using authenticator apps like Google Authenticator, Authy
      - **SMS**: Text message verification codes  
      - **Email**: Email-based verification codes
      - **Backup Codes**: One-time use recovery codes
      
      **Security Features:**
      - Progressive enforcement based on user roles
      - Grace periods for new accounts
      - Trusted device management
      - Comprehensive audit logging
      - Rate limiting and abuse protection
      
  - name: Password Management
    description: |
      Secure password management including reset, recovery, and validation.
      
      **Security Features:**
      - Argon2id password hashing (OWASP 2024 recommended)
      - Cryptographically secure reset tokens
      - Rate limiting and abuse protection
      - CSRF protection for all state-changing operations
      - Progressive account lockout for failed attempts
      - Comprehensive audit logging
      
      **Password Requirements:**
      Following NIST 800-63B guidelines:
      - 8-128 character length
      - No forced complexity rules (encourages passphrases)
      - No forced password expiration
      - Breach detection integration
      
  - name: Profile Management
    description: |
      Comprehensive user profile management with completion scoring and analytics.
      
      **Features:**
      - Real-time profile completion scoring
      - Achievement badges and milestones
      - Privacy controls and visibility settings
      - Business owner verification integration
      - GDPR-compliant data management
      - Comprehensive audit logging
      
      **Profile Completion System:**
      - **Beginner (0-20%)**: Basic account setup
      - **Intermediate (21-40%)**: Essential information added
      - **Advanced (41-70%)**: Detailed profile with verification
      - **Expert (71-90%)**: Comprehensive profile with engagement
      - **Master (91-100%)**: Complete profile with all features utilized

externalDocs:
  description: Complete API Documentation
  url: https://docs.lawlessdirectory.com/api
```

## Authentication Overview

The Lawless Directory Authentication API provides enterprise-grade security with comprehensive user management capabilities. All authentication flows follow industry best practices and compliance requirements.

### Authentication Flow Overview

1. **Registration → Email Verification → Profile Completion → Optional MFA Setup**
2. **Login → MFA Challenge (if enabled) → Session Establishment**
3. **Password Reset → Secure Token → MFA Verification → Password Update**

### Security Schemes

- **Bearer Authentication**: JWT tokens for API access
- **Session Authentication**: HTTP-only cookies for web applications  
- **API Key Authentication**: Server-to-server communication

## Error Responses

All API endpoints return consistent error responses with appropriate HTTP status codes:

- **400 Bad Request**: Invalid request parameters or data
- **401 Unauthorized**: Authentication required or invalid credentials
- **403 Forbidden**: Insufficient permissions or policy violations
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource conflict (e.g., username taken)
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server-side error

## Implementation Examples

### JavaScript/Node.js Example

```javascript
// MFA Setup Example
const setupMFA = async (accessToken) => {
  const response = await fetch('/api/auth/mfa/setup', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      enable_mfa: true,
      methods: ['totp', 'backup_codes']
    })
  });

  const data = await response.json();
  
  if (data.setup_data?.totp) {
    // Display QR code for user to scan
    displayQRCode(data.setup_data.totp.qr_code_url);
    
    // Store backup codes securely
    storeBackupCodes(data.setup_data.backup_codes.codes);
  }
  
  return data;
};

// Profile Update Example
const updateProfile = async (accessToken, updates) => {
  const response = await fetch('/api/profile', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });

  const result = await response.json();
  
  if (result.newBadges?.length > 0) {
    // Show achievement notification
    showAchievementNotification(result.newBadges);
  }
  
  return result;
};

// Password Reset Example
const requestPasswordReset = async (email, csrfToken) => {
  const response = await fetch('/api/auth/password/reset/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      method: 'email',
      csrfToken
    })
  });

  return await response.json();
};
```

### cURL Examples

```bash
# Get MFA Status
curl -X GET "https://api.lawlessdirectory.com/v2/auth/mfa/setup" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json"

# Enable TOTP MFA
curl -X POST "https://api.lawlessdirectory.com/v2/auth/mfa/setup" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "enable_mfa": true,
    "methods": ["totp", "backup_codes"]
  }'

# Verify MFA Code
curl -X POST "https://api.lawlessdirectory.com/v2/auth/mfa/verify" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "123456",
    "method": "totp",
    "trust_device": true
  }'

# Get Profile with Completion Data
curl -X GET "https://api.lawlessdirectory.com/v2/profile?includeCompletion=true&includeRecommendations=true" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json"

# Update Profile Field
curl -X PATCH "https://api.lawlessdirectory.com/v2/profile" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "field": "username",
    "value": "new_username"
  }'

# Request Password Reset
curl -X POST "https://api.lawlessdirectory.com/v2/auth/password/reset/request" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "method": "email",
    "csrfToken": "abc123def456ghi789"
  }'
```

### Python Example

```python
import requests
import json

class LawlessDirectoryAPI:
    def __init__(self, base_url, access_token=None):
        self.base_url = base_url
        self.access_token = access_token
        self.session = requests.Session()
        
        if access_token:
            self.session.headers.update({
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            })
    
    def setup_mfa(self, methods=['totp']):
        """Enable MFA for the user account"""
        response = self.session.post(
            f"{self.base_url}/auth/mfa/setup",
            json={
                'enable_mfa': True,
                'methods': methods
            }
        )
        return response.json()
    
    def verify_mfa(self, code, method='totp', trust_device=False):
        """Verify MFA code"""
        response = self.session.post(
            f"{self.base_url}/auth/mfa/verify",
            json={
                'code': code,
                'method': method,
                'trust_device': trust_device
            }
        )
        return response.json()
    
    def get_profile(self, include_completion=True, include_recommendations=True):
        """Get user profile with optional completion data"""
        params = {
            'includeCompletion': str(include_completion).lower(),
            'includeRecommendations': str(include_recommendations).lower()
        }
        
        response = self.session.get(
            f"{self.base_url}/profile",
            params=params
        )
        return response.json()
    
    def update_profile(self, **updates):
        """Update user profile"""
        response = self.session.put(
            f"{self.base_url}/profile",
            json=updates
        )
        return response.json()
    
    def update_profile_field(self, field, value, metadata=None):
        """Update a single profile field"""
        data = {'field': field, 'value': value}
        if metadata:
            data['metadata'] = metadata
            
        response = self.session.patch(
            f"{self.base_url}/profile",
            json=data
        )
        return response.json()

# Usage Example
api = LawlessDirectoryAPI('https://api.lawlessdirectory.com/v2', access_token='your_token_here')

# Setup TOTP MFA
mfa_result = api.setup_mfa(['totp', 'backup_codes'])
print(f"QR Code: {mfa_result.get('setup_data', {}).get('totp', {}).get('qr_code_url')}")

# Get profile with completion analysis
profile = api.get_profile(include_completion=True)
print(f"Profile completion: {profile.get('completion', {}).get('totalScore')}%")

# Update profile
update_result = api.update_profile(
    display_name="John Doe",
    bio="Business owner and community member",
    city="San Francisco",
    show_location=True
)

if update_result.get('newBadges'):
    print(f"New badges earned: {[badge['name'] for badge in update_result['newBadges']]}")
```

---

**Generated:** 2025-08-26  
**Document Version:** 1.0.0  
**API Version:** 2.0.0  
**Maintained by:** The Lawless Directory Documentation Team

For additional examples, integration guides, and troubleshooting, visit our complete documentation at [docs.lawlessdirectory.com](https://docs.lawlessdirectory.com).
