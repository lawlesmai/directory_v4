# Multi-Factor Authentication (MFA) Setup Guide

**Document Type:** User Documentation  
**Created:** 2025-08-26  
**Version:** 1.0.0  
**Scope:** Complete MFA setup and management guide for end users

## Table of Contents

1. [What is Multi-Factor Authentication?](#what-is-multi-factor-authentication)
2. [Why MFA is Important](#why-mfa-is-important)
3. [MFA Requirements](#mfa-requirements)
4. [Setting Up TOTP (Recommended)](#setting-up-totp-recommended)
5. [Setting Up SMS Authentication](#setting-up-sms-authentication)
6. [Setting Up Email Authentication](#setting-up-email-authentication)
7. [Managing Backup Codes](#managing-backup-codes)
8. [Trusted Devices](#trusted-devices)
9. [Using MFA to Login](#using-mfa-to-login)
10. [Managing Your MFA Settings](#managing-your-mfa-settings)
11. [Troubleshooting MFA](#troubleshooting-mfa)

## What is Multi-Factor Authentication?

Multi-Factor Authentication (MFA) adds an extra layer of security to your account by requiring two or more verification methods:

1. **Something you know** (your password)
2. **Something you have** (your phone or authenticator app)
3. **Something you are** (biometric data - future feature)

Even if someone discovers your password, they still can't access your account without the second factor.

### MFA Methods Available

| Method | Security Level | Convenience | Recommended For |
|--------|---------------|-------------|-----------------|
| **Authenticator App (TOTP)** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Everyone (Primary choice) |
| **SMS Text Message** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Backup method |
| **Email Verification** | ⭐⭐ | ⭐⭐⭐ | Secondary backup |
| **Backup Codes** | ⭐⭐⭐⭐ | ⭐⭐ | Emergency access |

## Why MFA is Important

### Protection Against Common Threats

- **Password Breaches**: Even if your password is compromised, MFA blocks unauthorized access
- **Phishing Attacks**: Stolen passwords alone can't access MFA-protected accounts
- **Account Takeovers**: Prevent criminals from accessing your business information
- **Identity Theft**: Protect personal and business data from unauthorized access

### Business Benefits

- **Customer Trust**: Show customers you take security seriously
- **Compliance**: Meet industry security standards and regulations
- **Reputation Protection**: Avoid costly data breaches and downtime
- **Peace of Mind**: Sleep better knowing your business is protected

### Real-World Examples

> **Case Study**: A business owner's password was stolen in a data breach. Because they had MFA enabled, the attackers couldn't access their Lawless Directory account or customer data. Without MFA, this could have been a devastating breach.

## MFA Requirements

### Automatic MFA Requirements

MFA is **automatically required** for:

✅ **Business Owner Accounts**
- Verified business owners
- Premium subscription holders
- Accounts with customer data access

✅ **Administrator Accounts**
- Platform administrators
- Moderators and support staff
- API key holders

✅ **High-Risk Activities**
- Financial transactions
- Data export/deletion requests
- Security settings changes

### Grace Period for New Accounts

- **30-day grace period** for business owners to set up MFA
- **Gradual restrictions** as grace period expires
- **Full enforcement** after 30 days

### Voluntary MFA

**Recommended for everyone**, even if not required:
- Personal accounts
- Basic users
- Anyone handling sensitive information
- Users concerned about security

## Setting Up TOTP (Recommended)

Time-based One-Time Password (TOTP) using an authenticator app is the most secure and convenient MFA method.

### Step 1: Choose an Authenticator App

**Recommended Apps:**

🥇 **Authy** (Multi-device, cloud backup)
- iOS: [Download from App Store](https://apps.apple.com/us/app/authy/id494168017)
- Android: [Download from Google Play](https://play.google.com/store/apps/details?id=com.authy.authy)
- Desktop: Available for Windows, Mac, Linux

🥈 **Google Authenticator** (Simple, widely supported)
- iOS: [Download from App Store](https://apps.apple.com/us/app/google-authenticator/id388497605)
- Android: [Download from Google Play](https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2)

🥉 **Microsoft Authenticator** (Great for Microsoft users)
- iOS: [Download from App Store](https://apps.apple.com/us/app/microsoft-authenticator/id983156458)
- Android: [Download from Google Play](https://play.google.com/store/apps/details?id=com.azure.authenticator)

**Advanced Options:**
- **1Password** (If you use 1Password password manager)
- **Bitwarden** (If you use Bitwarden password manager)
- **LastPass Authenticator** (If you use LastPass)

### Step 2: Enable TOTP in Your Account

1. **Navigate to MFA Settings**
   - Log into your Lawless Directory account
   - Go to **Account Settings** → **Security** → **Multi-Factor Authentication**
   - Click **"Enable MFA"** or **"Setup TOTP"**

2. **Scan the QR Code**
   - A QR code will appear on screen
   - Open your authenticator app
   - Tap **"Add Account"**, **"+"**, or **"Scan QR Code"**
   - Point your camera at the QR code
   - The account will be added automatically

3. **Manual Entry (if QR code doesn't work)**
   - In your authenticator app, choose **"Enter setup key manually"**
   - **Account Name**: The Lawless Directory
   - **Secret Key**: Copy from the screen (format: JBSW Y3DP EHPK 3PXP)
   - **Type**: Time-based (TOTP)
   - Save the account

### Step 3: Verify Setup

1. **Get Verification Code**
   - Look at your authenticator app
   - Find "The Lawless Directory" entry
   - Note the 6-digit code (changes every 30 seconds)

2. **Complete Setup**
   - Enter the 6-digit code on the verification screen
   - Click **"Verify and Enable"**
   - ✅ Success! You'll see "TOTP Authentication Enabled"

3. **Save Backup Codes** (Critical Step!)
   - You'll be shown 8 backup codes
   - **Save these codes immediately** in a secure location
   - Options for storage:
     - Password manager (recommended)
     - Secure note-taking app
     - Physical printout in a safe place
   - **Never share these codes with anyone**

### Step 4: Test Your Setup

1. **Test Login Process**
   - Log out of your account
   - Log back in with email and password
   - You'll be prompted for MFA code
   - Enter the 6-digit code from your authenticator app
   - Successfully login confirms MFA is working

## Setting Up SMS Authentication

SMS authentication sends verification codes to your mobile phone via text message.

### Step 1: Enable SMS MFA

1. **Go to MFA Settings**
   - Account Settings → Security → Multi-Factor Authentication
   - Click **"Enable SMS Authentication"**

2. **Add Phone Number**
   - Enter your mobile phone number
   - Include country code (e.g., +1 for US/Canada)
   - Example: +1-555-123-4567
   - Click **"Send Verification Code"**

3. **Verify Phone Number**
   - Check your phone for a text message
   - Enter the 6-digit code received
   - Click **"Verify Phone Number"**
   - ✅ SMS Authentication is now enabled

### Step 2: Using SMS Authentication

**During Login:**
1. Enter email and password
2. Select **"Send SMS Code"**
3. Check your phone for the code
4. Enter the code within 5 minutes
5. Click **"Verify and Sign In"**

### SMS Limitations and Considerations

⚠️ **Important Limitations:**
- **Security**: Less secure than authenticator apps
- **Reliability**: Depends on mobile network coverage
- **Costs**: May incur SMS charges from your carrier
- **SIM Swapping**: Vulnerable to SIM card attacks
- **International**: May not work reliably when traveling

**Best Practices:**
- Use SMS as a **backup method only**
- Keep TOTP as your primary MFA method
- Ensure reliable mobile coverage
- Consider roaming charges when traveling

## Setting Up Email Authentication

Email authentication sends verification codes to your registered email address.

### Step 1: Enable Email MFA

1. **Access MFA Settings**
   - Your email address must be verified first
   - Go to Account Settings → Security → Multi-Factor Authentication
   - Click **"Enable Email Authentication"**

2. **Verify Email MFA**
   - A verification code will be sent to your email
   - Check your inbox for "MFA Verification Code"
   - Enter the code within 10 minutes
   - Click **"Verify and Enable"**

### Step 2: Using Email Authentication

**During Login:**
1. Enter email and password
2. Select **"Send Email Code"**
3. Check your email for the verification code
4. Enter the code within 10 minutes
5. Click **"Verify and Sign In"**

### Email MFA Considerations

⚠️ **Security Notes:**
- **Lower Security**: Email accounts can be compromised
- **Dependency**: Requires access to your email account
- **Delivery Time**: Email delays can slow login process
- **Backup Only**: Best used as secondary backup method

**When Email MFA is Useful:**
- Emergency access when other methods fail
- Temporary setup while configuring authenticator apps
- Users without smartphones
- International travel with limited mobile service

## Managing Backup Codes

Backup codes are your safety net when primary MFA methods are unavailable.

### Understanding Backup Codes

**What They Are:**
- 8 single-use codes generated when MFA is enabled
- Each code works only once
- Bypass normal MFA requirements
- Essential for emergency access

**Example Backup Codes:**
```
abc123def456
ghi789jkl012
mno345pqr678
stu901vwx234
yza567bcd890
efg123hij456
klm789nop012
qrs345tuv678
```

### Storing Backup Codes Securely

**✅ Recommended Storage Methods:**

1. **Password Manager** (Best Option)
   - Store in secure note or vault item
   - Available across all your devices
   - Encrypted and protected by master password
   - Examples: 1Password, Bitwarden, LastPass

2. **Physical Backup**
   - Print codes and store in safe or lockbox
   - Write in a secure notebook
   - Keep in fireproof/waterproof container
   - Store separately from other important documents

3. **Encrypted Digital File**
   - Save in encrypted cloud storage
   - Use encrypted note-taking apps
   - Store on encrypted USB drive
   - Include in regular backup routine

**❌ Never Store Backup Codes:**
- In plain text files on computer
- In regular note-taking apps
- In photos on phone
- Shared with others
- In email drafts or messages

### Using Backup Codes

**When to Use:**
- Lost or broken phone with authenticator app
- Traveling without mobile service
- Authenticator app not working
- SMS not delivering
- Emergency account access needed

**How to Use:**
1. On MFA challenge screen, click **"Use backup code"**
2. Enter one of your unused backup codes
3. Click **"Verify"**
4. The code is now used and won't work again
5. Save remaining codes for future use

### Managing Backup Codes

**Monitoring Code Usage:**
- Check Account Settings → Security → MFA Status
- See how many codes remain unused
- Get alerts when only 2 codes remain

**Generating New Codes:**
1. Go to Account Settings → Security → Multi-Factor Authentication
2. Click **"Generate New Backup Codes"**
3. **Old codes immediately stop working**
4. Save the 8 new codes securely
5. Update stored codes in password manager/safe storage

**Best Practices:**
- Check remaining codes monthly
- Generate new codes when 2 or fewer remain
- Generate new codes if you suspect compromise
- Always verify new codes are saved before leaving the page
- Generate new codes every 6 months for security

## Trusted Devices

Trusted devices reduce MFA friction while maintaining security.

### What Are Trusted Devices?

**Definition:**
- Devices you've marked as "trusted" during MFA verification
- Skip MFA challenges for 30 days on trusted devices
- Limited to 5 trusted devices per account
- Automatically untrusted after 30 days of inactivity

**Device Information Stored:**
- Device name (iPhone, Chrome on Windows, etc.)
- IP address and general location
- Date when trust was established
- Last activity timestamp

### Setting Up Trusted Devices

**During MFA Verification:**
1. Complete normal MFA process (TOTP, SMS, or email)
2. Check **"Trust this device for 30 days"** box
3. Click **"Verify and Sign In"**
4. Device is now trusted for 30 days

**Trusted Device Experience:**
- Login with just email and password
- No MFA challenge required
- Trust expires after 30 days
- Trust expires after 7 days of inactivity

### Managing Trusted Devices

**View Trusted Devices:**
1. Go to Account Settings → Security → Trusted Devices
2. See list of all trusted devices:
   - Device name and type
   - Location (city/region)
   - Trust established date
   - Last activity
   - Days until trust expires

**Remove Trust from Devices:**
- Click **"Remove Trust"** next to any device
- Immediately requires MFA on that device
- Use this if device is lost or stolen
- Use this for shared/public computers

**Security Monitoring:**
- Review trusted devices monthly
- Remove devices you don't recognize
- Remove trust before selling/giving away devices
- Contact support if suspicious devices appear

### Trusted Device Best Practices

**✅ Good Candidates for Trust:**
- Your personal smartphone
- Your home computer
- Your work computer (if secure)
- Tablet you regularly use

**❌ Never Trust These Devices:**
- Public computers (library, hotel, etc.)
- Shared family computers
- Work computers with other users
- Friend's or colleague's devices
- Devices you don't control

**Security Tips:**
- Use device trust sparingly (2-3 devices max)
- Remove trust when traveling with device
- Set up device lock screens/passwords
- Keep device software updated
- Review trusted devices monthly

## Using MFA to Login

### Standard Login Process with MFA

1. **Initial Login**
   - Go to [lawlessdirectory.com/login](https://lawlessdirectory.com/login)
   - Enter your email address
   - Enter your password
   - Click **"Sign In"**

2. **MFA Challenge Screen**
   - You'll see the MFA verification screen
   - Available methods depend on your setup
   - Choose your preferred method

3. **Complete Verification**
   - Enter the required code
   - Optionally check "Trust this device"
   - Click **"Verify and Sign In"**
   - You're now logged into your account

### MFA Method Selection

**If Multiple Methods Enabled:**
- Choose your preferred method
- Primary: Authenticator app (most secure)
- Fallback: SMS or email
- Emergency: Backup codes

**Method Priority Recommendations:**
1. 🥇 Authenticator app (TOTP)
2. 🥈 SMS to your phone
3. 🥉 Email verification
4. 🆘 Backup codes (emergency only)

### Troubleshooting Login Issues

**"Invalid Code" Errors:**

For **Authenticator App:**
- Wait for code to refresh (30-second cycles)
- Check that device time is synchronized
- Try the next code that appears
- Ensure you're looking at correct account entry

For **SMS:**
- Check message delivery (may take 1-2 minutes)
- Verify phone number is correct
- Check for international roaming issues
- Try requesting a new code

For **Email:**
- Check spam/junk folders
- Wait up to 5 minutes for delivery
- Verify email address is correct
- Try requesting a new code

**"Code Expired" Errors:**
- Codes have time limits (TOTP: 30 seconds, SMS: 5 minutes, Email: 10 minutes)
- Request a fresh code
- Enter code immediately after receiving

**Still Can't Login?**
- Use backup codes for emergency access
- Contact support at security@lawlessdirectory.com
- Have account details ready for identity verification

## Managing Your MFA Settings

### Accessing MFA Settings

1. **Login to Your Account**
   - Complete normal login process
   - Navigate to **Account Settings**

2. **Security Section**
   - Click **"Security"** in the left menu
   - Find **"Multi-Factor Authentication"** section
   - Current status and options will be displayed

### MFA Status Dashboard

**Information Displayed:**
- ✅/❌ MFA Enabled status
- 🔒 Enforcement status (Required vs. Optional)
- 📱 Configured methods (TOTP, SMS, Email)
- 🔑 Backup codes status (remaining count)
- 🖥️ Trusted devices count
- ⏰ Grace period information (if applicable)

### Adding Additional MFA Methods

**Why Multiple Methods?**
- Redundancy in case primary method fails
- Different methods for different situations
- Enhanced security through diversity

**How to Add Methods:**
1. Click **"Add MFA Method"**
2. Choose from available options
3. Follow setup process for chosen method
4. Verify the method works
5. Method is now available as backup

### Changing Your Primary MFA Method

1. **Enable New Method**
   - Add the method you want as primary
   - Complete verification process

2. **Test New Method**
   - Log out and back in
   - Use new method to verify it works

3. **Disable Old Method** (Optional)
   - Remove old method if no longer needed
   - Keep as backup if preferred

### Disabling MFA

⚠️ **Important Warning:**
MFA significantly improves your account security. Disabling it makes your account vulnerable to password-based attacks.

**For Optional MFA Accounts:**
1. Go to MFA settings
2. Click **"Disable MFA"**
3. Confirm your decision
4. Complete password verification
5. MFA is disabled immediately

**For Required MFA Accounts:**
- MFA cannot be disabled for business owners and administrators
- Contact support for special circumstances
- Temporary disables require administrative approval

## Troubleshooting MFA

### Common Issues and Solutions

#### Authenticator App Problems

**Problem**: "Invalid code" even with correct entry
**Solutions:**
- Check device time synchronization
  - iPhone: Settings → General → Date & Time → "Set Automatically"
  - Android: Settings → Date & Time → "Automatic date & time"
- Wait for new code to generate (codes change every 30 seconds)
- Try typing code instead of copy/paste
- Restart authenticator app

**Problem**: Lost phone with authenticator app
**Solutions:**
- Use backup codes to regain access
- Use alternative MFA method (SMS/email) if configured
- Contact support for MFA reset with identity verification
- Re-setup authenticator app on new device

**Problem**: Authenticator app was deleted accidentally
**Solutions:**
- Reinstall app and re-add account using QR code/setup key
- If setup info not available, use backup codes
- Use alternative MFA method to access account
- Generate new TOTP setup from account settings

#### SMS Issues

**Problem**: Not receiving SMS codes
**Solutions:**
- Check phone signal strength
- Verify phone number is correct (including country code)
- Check for SMS blocking or filtering
- Try from different location (network issue)
- Contact mobile carrier about SMS delivery
- Wait 5-10 minutes before requesting new code

**Problem**: SMS codes arrive late
**Solutions:**
- Request code and wait patiently (up to 5 minutes)
- Check for network congestion
- Try from different location
- Use alternative MFA method
- Consider switching to authenticator app

#### Email MFA Issues

**Problem**: Not receiving email codes
**Solutions:**
- Check spam/junk folders
- Add noreply@lawlessdirectory.com to contacts
- Check email provider security settings
- Wait up to 10 minutes for delivery
- Try requesting new code
- Use alternative MFA method

**Problem**: Email account compromised
**Solutions:**
- Use authenticator app or SMS to access account
- Change email password immediately
- Update account email address
- Generate new backup codes
- Review account security settings

### Account Recovery Scenarios

#### Scenario 1: Lost All MFA Methods

**What to do:**
1. Try backup codes first
2. Contact support immediately at security@lawlessdirectory.com
3. Prepare identity verification documents
4. Follow support team's recovery process

**Prevention:**
- Always keep backup codes in secure location
- Configure multiple MFA methods
- Keep recovery information updated

#### Scenario 2: Backup Codes Not Working

**Possible causes:**
- Codes already used
- Typing errors (codes are case-sensitive)
- Codes from old batch (after generating new ones)

**Solutions:**
- Double-check code entry
- Try different backup code
- Contact support if all codes fail

#### Scenario 3: Account Locked During MFA

**What happened:**
- Multiple failed MFA attempts triggered lockout
- Account security measure to prevent attacks

**Recovery:**
- Wait for lockout period to expire (starts at 15 minutes)
- Use backup codes (usually work during lockout)
- Contact support for immediate unlock if urgent

### Getting Help

#### Self-Service Resources

**MFA Status Check:**
- Login to Account Settings → Security
- Review MFA configuration
- Check recent security activity
- Verify contact information

**Documentation:**
- Complete user guides and FAQs
- Video tutorials for common procedures
- Community forum for user questions

#### Professional Support

**Email Support:**
- General issues: support@lawlessdirectory.com
- Security issues: security@lawlessdirectory.com
- Include account email and description of issue

**Live Chat:**
- Available during business hours
- Instant help for common issues
- Can escalate to security team if needed

**Phone Support:**
- For urgent security issues only
- Available for business owners and premium accounts
- Identity verification required

**What to Include When Contacting Support:**
- Your account email address (never include password)
- Detailed description of the problem
- Error messages (exact text or screenshots)
- Steps you've already tried
- Device and browser information
- Urgency level (urgent, normal, low priority)

---

## Quick Reference

### MFA Method Quick Comparison

| Method | Setup Time | Security | Convenience | Offline Use |
|--------|------------|----------|-------------|-------------|
| **Authenticator App** | 5 minutes | Highest | High | ✅ Yes |
| **SMS** | 2 minutes | Medium | Highest | ❌ No |
| **Email** | 1 minute | Low | Medium | ❌ No |
| **Backup Codes** | Automatic | High | Low | ✅ Yes |

### Emergency Contact Information

- **Security Issues**: security@lawlessdirectory.com
- **General Support**: support@lawlessdirectory.com  
- **Account Recovery**: Include "ACCOUNT RECOVERY" in subject line

### Important URLs

- **MFA Setup**: Account Settings → Security → Multi-Factor Authentication
- **Login Page**: [lawlessdirectory.com/login](https://lawlessdirectory.com/login)
- **Help Center**: [help.lawlessdirectory.com](https://help.lawlessdirectory.com)

---

**Generated:** 2025-08-26  
**Document Version:** 1.0.0  
**Last Updated:** 2025-08-26  
**Maintained by:** The Lawless Directory Security Team

🔒 **Security Note**: Never share your MFA codes, backup codes, or setup keys with anyone. The Lawless Directory will never ask for these in emails or phone calls.
