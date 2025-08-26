# Authentication Flow User Guide

**Document Type:** User Documentation  
**Created:** 2025-08-26  
**Version:** 1.0.0  
**Scope:** Complete user guide for authentication flows in The Lawless Directory

## Table of Contents

1. [Getting Started](#getting-started)
2. [Account Registration](#account-registration)
3. [Email Verification](#email-verification)
4. [Login Process](#login-process)
5. [Multi-Factor Authentication](#multi-factor-authentication)
6. [Password Management](#password-management)
7. [Account Security](#account-security)
8. [Troubleshooting](#troubleshooting)

## Getting Started

The Lawless Directory provides secure, enterprise-grade authentication to protect your account and personal information. This guide will walk you through all authentication processes step-by-step.

### What You'll Need

- A valid email address
- A secure password (we'll help you create one)
- Access to your email for verification
- Optional: A smartphone for multi-factor authentication

### Security Features

- **Password Security**: Industry-standard Argon2id encryption
- **Multi-Factor Authentication**: Extra security with authenticator apps
- **Account Monitoring**: Real-time security event tracking
- **Privacy Controls**: Granular control over your information visibility

## Account Registration

### Step 1: Create Your Account

1. **Visit the Registration Page**
   - Go to [lawlessdirectory.com/register](https://lawlessdirectory.com/register)
   - Click "Create Account" or "Sign Up"

2. **Choose Registration Method**
   
   **Option A: Email Registration**
   - Enter your email address
   - Create a secure password (see password requirements below)
   - Confirm your password
   - Accept the Terms of Service and Privacy Policy
   - Click "Create Account"

   **Option B: Social Registration**
   - Click on your preferred social login provider:
     - Google
     - Apple
     - Facebook
     - GitHub
   - Authorize The Lawless Directory to access your basic information
   - Complete any additional required fields

### Step 2: Password Requirements

For your security, passwords must meet these requirements:

✅ **Required:**
- 8-128 characters in length
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)

✅ **Recommended:**
- Use a unique password not used elsewhere
- Consider using a passphrase (e.g., "Coffee!Morning$Sunrise2025")
- Use a password manager to generate and store secure passwords

❌ **Avoid:**
- Common passwords or dictionary words
- Personal information (name, birthday, etc.)
- Sequential patterns (123456, abcdef)
- Repeated characters (aaaaaa, 111111)

### Step 3: Profile Information

Complete your basic profile information:

**Required Fields:**
- First Name
- Last Name
- Display Name (how others see you)

**Optional Fields:**
- Phone Number (recommended for account recovery)
- City/State (helps with local business discovery)
- Bio/Description
- Website
- Social Media Links

**Privacy Settings:**
- Profile Visibility: Public, Private, or Business Only
- Show Contact Information: Yes/No
- Show Location: Yes/No
- Show Activity: Yes/No

## Email Verification

### Why Email Verification is Important

Email verification ensures:
- You have access to your registered email
- Account recovery options are available
- Important security notifications reach you
- Compliance with platform security policies

### Verification Process

1. **Check Your Email**
   - Look for an email from "noreply@lawlessdirectory.com"
   - Subject: "Verify Your Email Address - The Lawless Directory"
   - Check spam/junk folder if not in inbox

2. **Click Verification Link**
   - Click the "Verify Email Address" button in the email
   - Or copy and paste the verification URL into your browser
   - Link is valid for 24 hours

3. **Confirmation**
   - You'll see a "Email Verified Successfully" message
   - You can now access all platform features
   - Your account status will show as "Verified"

### Didn't Receive Verification Email?

**Check These First:**
- Spam/junk folder
- Promotions tab (Gmail)
- Email address spelling
- Email provider restrictions

**Request New Verification Email:**
1. Go to [lawlessdirectory.com/verify](https://lawlessdirectory.com/verify)
2. Enter your email address
3. Click "Resend Verification Email"
4. Check your email again (including spam)

**Still Having Issues?**
- Wait 5-10 minutes for email delivery
- Try from a different email provider
- Contact support at support@lawlessdirectory.com

## Login Process

### Standard Login

1. **Visit Login Page**
   - Go to [lawlessdirectory.com/login](https://lawlessdirectory.com/login)
   - Or click "Sign In" from any page

2. **Enter Credentials**
   - Email address or username
   - Password
   - Check "Remember me" to stay logged in (optional)

3. **Complete Login**
   - Click "Sign In"
   - Complete MFA challenge if enabled (see MFA section)
   - You'll be redirected to your dashboard or previous page

### Social Login

1. **Choose Provider**
   - Click your preferred social login button
   - Available options: Google, Apple, Facebook, GitHub

2. **Authorize Access**
   - You'll be redirected to the provider's login page
   - Enter your social account credentials
   - Authorize The Lawless Directory to access basic information

3. **Account Linking**
   - If this is your first social login, you'll create a new account
   - If you have an existing account, you can link the social account
   - Complete any missing profile information

### Device Management

**Trusted Devices:**
- After successful MFA verification, you can mark devices as "trusted"
- Trusted devices skip MFA for 30 days
- You can have up to 5 trusted devices
- Manage trusted devices in Account Settings

**Session Management:**
- Sessions last 24 hours by default
- Extend to 30 days with "Remember me"
- Sessions expire with inactivity (2 hours)
- You can end sessions remotely from any device

## Multi-Factor Authentication

MFA adds an extra security layer to protect your account, even if someone knows your password.

### When MFA is Required

**Automatic Requirements:**
- Business owner accounts
- Administrator accounts
- Accounts handling sensitive data

**Optional for:**
- Standard user accounts
- Personal profiles
- Read-only access

### MFA Methods Available

#### 1. Authenticator App (TOTP) - **Recommended**

**Setup Process:**
1. Go to Account Settings > Security > Multi-Factor Authentication
2. Click "Enable TOTP Authentication"
3. Install an authenticator app:
   - **Recommended:** Authy, Google Authenticator, Microsoft Authenticator
   - **Advanced:** 1Password, Bitwarden, LastPass Authenticator

4. **Scan QR Code:**
   - Open your authenticator app
   - Tap "Add Account" or "+"
   - Scan the QR code displayed
   - Or manually enter the provided key

5. **Verify Setup:**
   - Enter the 6-digit code from your authenticator app
   - Click "Verify and Enable"
   - Save your backup codes (important!)

**Using TOTP:**
- Open your authenticator app
- Find "The Lawless Directory" entry
- Enter the current 6-digit code
- Codes refresh every 30 seconds

#### 2. SMS Authentication

**Setup Process:**
1. Go to Account Settings > Security > Multi-Factor Authentication
2. Click "Enable SMS Authentication"
3. Enter your phone number (with country code)
4. Verify with the SMS code sent to your phone
5. SMS MFA is now active

**Using SMS:**
- Enter your email and password
- Click "Send SMS Code"
- Check your phone for the verification code
- Enter the code within 5 minutes

**SMS Limitations:**
- Requires mobile phone signal or WiFi
- May have delivery delays
- International SMS charges may apply
- Less secure than authenticator apps

#### 3. Email Authentication

**Setup Process:**
1. Email MFA uses your verified email address
2. Go to Account Settings > Security > Multi-Factor Authentication
3. Click "Enable Email Authentication"
4. Verify with the code sent to your email

**Using Email:**
- Enter your email and password
- Check your email for the verification code
- Enter the code within 10 minutes
- Click "Verify and Sign In"

### Backup Codes

**What are Backup Codes?**
- One-time use codes for account recovery
- Use when you can't access your primary MFA method
- Each code works only once
- You get 8 codes when MFA is enabled

**Using Backup Codes:**
1. On the MFA challenge screen, click "Use backup code"
2. Enter one of your backup codes
3. The code will be marked as used
4. Generate new codes when you have 2 or fewer remaining

**Important Notes:**
- Store backup codes securely (password manager, safe place)
- Don't share backup codes with anyone
- Generate new codes if you suspect compromise
- Backup codes expire after 6 months

## Password Management

### Changing Your Password

**From Account Settings:**
1. Go to Account Settings > Security > Password
2. Enter your current password
3. Enter your new password (must meet requirements)
4. Confirm your new password
5. Click "Update Password"
6. You'll be logged out and need to sign in again

**After Password Change:**
- All other sessions are automatically ended
- You'll receive an email confirmation
- Update password in password managers
- Trusted devices remain trusted

### Password Reset (Forgot Password)

**Step 1: Request Password Reset**
1. Go to [lawlessdirectory.com/login](https://lawlessdirectory.com/login)
2. Click "Forgot Password?"
3. Enter your email address
4. Complete the security captcha
5. Click "Send Reset Link"

**Step 2: Check Your Email**
- Look for "Password Reset - The Lawless Directory"
- Click "Reset Password" button in email
- Or copy and paste the reset URL
- Reset links expire in 1 hour

**Step 3: Create New Password**
1. Enter your new password (must meet requirements)
2. Confirm your new password
3. Complete MFA challenge if enabled
4. Click "Reset Password"
5. You'll be redirected to login with your new password

**Security Features:**
- Reset links can only be used once
- All active sessions are ended after reset
- Security team is notified of password resets
- Account lockout protections remain active

### Account Lockout Protection

**Automatic Lockout:**
- 5 failed login attempts = 15-minute lockout
- 10 failed attempts = 1-hour lockout
- 15 failed attempts = 24-hour lockout
- Repeated violations = longer lockouts

**During Lockout:**
- Login attempts are blocked
- Password reset is still available
- Account recovery options remain active
- Support can manually unlock accounts

**Preventing Lockouts:**
- Use correct credentials
- Update bookmarks with current login URL
- Clear browser cache if having issues
- Use password manager to avoid typos

## Account Security

### Security Dashboard

Access your security overview:
1. Go to Account Settings > Security Dashboard
2. Review recent activity
3. Check security score and recommendations
4. Manage security settings

**Security Score Factors:**
- Strong password ✅
- MFA enabled ✅
- Email verified ✅
- Phone verified ✅
- Recent activity reviewed ✅
- Trusted devices managed ✅

### Recent Activity Monitoring

**What's Tracked:**
- Login attempts (successful and failed)
- Password changes
- MFA setup/changes
- Profile updates
- Device additions
- Security setting changes

**Reviewing Activity:**
1. Go to Account Settings > Security > Activity Log
2. Review recent logins and actions
3. Check for any suspicious activity
4. Report concerns to security team

**Red Flags to Watch For:**
- Logins from unknown locations
- Failed login attempts you didn't make
- Password reset requests you didn't initiate
- MFA setup changes you didn't make
- Profile changes you didn't authorize

### Account Recovery Options

**Recovery Methods Available:**
1. **Email Recovery:** Primary method using verified email
2. **Phone Recovery:** SMS to verified phone number
3. **Social Account:** If linked to social media account
4. **Backup Codes:** For MFA-protected accounts
5. **Support Recovery:** Manual verification with ID

**Setting Up Recovery:**
- Verify your email address
- Add and verify a phone number
- Link at least one social media account
- Generate and secure backup codes
- Keep recovery information current

### Privacy and Data Controls

**Profile Visibility Settings:**
- **Public:** Visible to all users and search engines
- **Private:** Only visible to connections you approve
- **Business Only:** Visible to business network members only

**Information Sharing Controls:**
- Contact Information: Show/hide email and phone
- Location: Show/hide city and state
- Activity: Show/hide recent actions and reviews
- Social Links: Show/hide social media profiles

**Data Export and Deletion:**
- Export your data: Account Settings > Privacy > Export Data
- Delete your account: Account Settings > Privacy > Delete Account
- Data retention: Most data deleted within 30 days
- Legal requirements: Some data may be retained for compliance

## Troubleshooting

### Common Login Issues

**Problem: "Invalid email or password"**
- Check email address spelling
- Verify password (try typing instead of pasting)
- Check caps lock status
- Try password reset if unsure

**Problem: "Account not found"**
- Verify email address is correct
- Check if you registered with social login
- Try alternative email addresses you might have used
- Contact support if you're certain the account exists

**Problem: "Account locked"**
- Wait for lockout period to expire
- Try password reset (still works during lockout)
- Contact support for immediate unlock if needed

**Problem: MFA code not working**
- Check that authenticator app time is synchronized
- Try the next code (codes refresh every 30 seconds)
- Use a backup code if available
- Contact support for MFA reset

### Email Issues

**Problem: Not receiving emails**
- Check spam/junk folders
- Add noreply@lawlessdirectory.com to contacts
- Try from a different email provider
- Check email provider's security settings

**Problem: Verification links don't work**
- Links expire after 24 hours - request new one
- Copy full URL and paste into browser
- Try from different browser or device
- Contact support with error message details

### Social Login Issues

**Problem: "Social account already linked"**
- The social account is linked to a different email
- Try logging in with the social account directly
- Or unlink from the other account first
- Contact support to merge accounts if needed

**Problem: Authorization errors**
- Clear browser cookies and cache
- Try from incognito/private browser window
- Check that you're logged into the correct social account
- Reauthorize the connection

### Account Recovery

**Problem: Can't access email or phone**
- Use backup codes if MFA is enabled
- Try alternative recovery methods
- Contact support with identity verification
- May require government ID for verification

**Problem: Lost backup codes**
- Generate new codes from Account Settings
- Use alternative MFA method to access account
- Contact support for MFA reset with identity verification

### Getting Help

**Self-Service Options:**
- Security Dashboard for account status
- Activity Log for recent actions
- FAQ section for common issues
- Community forum for user discussions

**Contact Support:**
- Email: support@lawlessdirectory.com
- Live Chat: Available during business hours
- Support Ticket: Through account dashboard
- Phone Support: For urgent security issues

**When Contacting Support:**
- Include your email address (but not password)
- Describe the issue in detail
- Include any error messages
- Mention troubleshooting steps already tried
- For security issues, use security@lawlessdirectory.com

---

## Quick Reference

### Login URL
[lawlessdirectory.com/login](https://lawlessdirectory.com/login)

### Password Requirements
- 8-128 characters
- Mixed case letters, numbers, special characters
- Unique to this account

### MFA Backup
- Save backup codes securely
- 8 codes provided, use once each
- Generate new when 2 or fewer remain

### Account Recovery
- Keep email and phone updated
- Link at least one social account
- Store backup codes safely

### Security Best Practices
- Use unique, strong password
- Enable MFA with authenticator app
- Review activity log monthly
- Keep recovery information current
- Report suspicious activity immediately

---

**Generated:** 2025-08-26  
**Document Version:** 1.0.0  
**Last Updated:** 2025-08-26  
**Maintained by:** The Lawless Directory User Experience Team

Need help? Contact support at support@lawlessdirectory.com or visit our [Help Center](https://help.lawlessdirectory.com).
