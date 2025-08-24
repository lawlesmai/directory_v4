# Story 2.7: User Profile Management & Settings

**Epic:** Epic 2 - Authentication & Authorization Layer  
**Story ID:** 2.7  
**Story Points:** 21  
**Priority:** P0 (Critical Security Foundation)  
**Assignee:** Frontend Developer Agent  
**Sprint:** 3

## User Story

As an authenticated user, I want to manage my profile information and account settings so that I can maintain accurate information, control my privacy preferences, and manage my platform experience effectively.

## Story Overview

This story implements a comprehensive user profile and account management interface that allows users to update their information, manage security settings, control privacy preferences, and handle account preferences with elegant UI interactions and robust security measures.

## Detailed Acceptance Criteria

### Profile Information Management
- **Given** an authenticated user accessing their profile
- **When** managing profile information
- **Then** provide comprehensive profile features:

**Basic Profile Information:**
- Display name editing with real-time availability checking
- Profile photo upload and cropping functionality with optimization
- Bio/description editing (500 character limit with counter)
- Location setting with autocomplete and geolocation options
- Contact information (email, phone) with verification workflows
- Social media links management with validation
- Website URL with validation and preview

**Privacy & Visibility Settings:**
- Profile visibility controls (public, private, business contacts only)
- Review visibility preferences with granular controls
- Contact information sharing settings
- Location sharing precision controls (exact, city, region, hidden)
- Search appearance preferences
- Activity visibility settings

### Account Settings Management
- **Given** the need for comprehensive account control
- **When** managing account settings
- **Then** implement:

**Security Settings:**
- Password change functionality with current password verification
- Two-factor authentication setup (TOTP/SMS) with QR codes
- Active session management with detailed device information
- Login activity history and monitoring with location data
- Security alerts and notification preferences
- Trusted device management
- Account deletion with data retention options

**Notification Preferences:**
- Email notification categories with granular controls
- Push notification settings (future mobile app preparation)
- SMS notification preferences with opt-in/opt-out
- Review response notifications
- Business update notifications
- Platform announcement preferences
- Marketing communication preferences (GDPR compliant)

**Data & Privacy Controls:**
- Data export functionality (GDPR compliance)
- Account deletion with clear data removal options
- Privacy policy acceptance tracking
- Cookie preferences management
- Third-party data sharing controls
- Data retention preferences

### Profile Management Implementation

```typescript
// components/profile/ProfileManagement.tsx
interface UserProfile {
  id: string
  email: string
  firstName: string
  lastName: string
  displayName: string
  phoneNumber?: string
  avatar?: string
  bio?: string
  location?: string
  website?: string
  socialLinks: {
    twitter?: string
    linkedin?: string
    instagram?: string
    facebook?: string
  }
  businessOwner: boolean
  emailNotifications: boolean
  marketingEmails: boolean
  twoFactorEnabled: boolean
  privacySettings: {
    profileVisibility: 'public' | 'private' | 'business_only'
    showEmail: boolean
    showPhone: boolean
    showLocation: 'exact' | 'city' | 'region' | 'hidden'
    showActivity: boolean
  }
  lastLogin: string
  createdAt: string
}

export const ProfileManagement: React.FC = () => {
  const { user, updateProfile } = useAuth()
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'privacy' | 'notifications'>('profile')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  const profileForm = useForm<Partial<UserProfile>>({
    resolver: zodResolver(profileSchema),
    mode: 'onChange',
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      displayName: user?.displayName || '',
      phoneNumber: user?.phoneNumber || '',
      bio: user?.bio || '',
      location: user?.location || '',
      website: user?.website || '',
      socialLinks: user?.socialLinks || {},
      emailNotifications: user?.emailNotifications ?? true,
      marketingEmails: user?.marketingEmails ?? false,
      privacySettings: user?.privacySettings || {
        profileVisibility: 'public',
        showEmail: false,
        showPhone: false,
        showLocation: 'city',
        showActivity: true
      }
    }
  })
  
  const { register, handleSubmit, formState: { errors, isDirty }, reset, watch } = profileForm

  const onSubmitProfile = async (data: Partial<UserProfile>) => {
    setIsSaving(true)
    
    try {
      await updateProfile(data)
      toast.success('Profile updated successfully!')
      setIsEditing(false)
      reset(data)
      
      // Track analytics
      trackEvent('profile_updated', {
        fields_changed: Object.keys(data)
      })
    } catch (error) {
      console.error('Profile update error:', error)
      toast.error('Failed to update profile. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    reset()
    setIsEditing(false)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Profile Header */}
      <div className="text-center">
        <h1 className="text-3xl font-heading font-semibold text-cream mb-2">
          Account Settings
        </h1>
        <p className="text-sage/70">
          Manage your account information, privacy, and preferences
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex justify-center">
        <div className="flex bg-navy-50/20 rounded-lg p-1">
          {(['profile', 'security', 'privacy', 'notifications'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-6 py-2 rounded-md text-sm font-medium transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                activeTab === tab
                  ? 'bg-teal-primary text-cream shadow-sm'
                  : 'text-sage/70 hover:text-sage hover:bg-navy-50/20'
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'profile' && (
            <ProfileTab
              user={user}
              isEditing={isEditing}
              isSaving={isSaving}
              onEdit={() => setIsEditing(true)}
              onCancel={handleCancelEdit}
              onSubmit={handleSubmit(onSubmitProfile)}
              form={profileForm}
              errors={errors}
              isDirty={isDirty}
            />
          )}
          
          {activeTab === 'security' && (
            <SecurityTab user={user} />
          )}
          
          {activeTab === 'privacy' && (
            <PrivacyTab user={user} form={profileForm} />
          )}
          
          {activeTab === 'notifications' && (
            <NotificationsTab user={user} form={profileForm} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
```

### Security Settings Component

```typescript
// components/profile/SecurityTab.tsx
export const SecurityTab: React.FC<{ user: User }> = ({ user }) => {
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [loginHistory, setLoginHistory] = useState<LoginEvent[]>([])
  
  const changePasswordForm = useForm({
    resolver: zodResolver(changePasswordSchema)
  })

  const handlePasswordChange = async (data: ChangePasswordData) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword
      })
      
      if (error) throw error
      
      toast.success('Password updated successfully!')
      setShowChangePassword(false)
      changePasswordForm.reset()
      
      // Send security notification
      await sendSecurityNotification('password_changed')
    } catch (error) {
      toast.error('Failed to update password. Please check your current password.')
    }
  }

  return (
    <div className="space-y-8">
      <GlassMorphism variant="medium" className="p-6">
        <h3 className="text-lg font-heading text-cream mb-6">Security Settings</h3>
        
        {/* Password Management */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-navy-50/20 rounded-lg">
            <div>
              <h4 className="font-medium text-cream">Password</h4>
              <p className="text-sm text-sage/70">Last updated 3 days ago</p>
            </div>
            <button
              onClick={() => setShowChangePassword(true)}
              className="px-4 py-2 bg-teal-primary/20 hover:bg-teal-primary/30 text-teal-primary rounded-lg transition-colors"
            >
              Change Password
            </button>
          </div>
          
          {/* Two-Factor Authentication */}
          <div className="flex items-center justify-between p-4 bg-navy-50/20 rounded-lg">
            <div>
              <h4 className="font-medium text-cream">Two-Factor Authentication</h4>
              <p className="text-sm text-sage/70">
                {user?.twoFactorEnabled ? 'Enabled' : 'Add an extra layer of security'}
              </p>
            </div>
            <TwoFactorToggle enabled={user?.twoFactorEnabled} />
          </div>
        </div>
      </GlassMorphism>

      {/* Active Sessions */}
      <SessionManager />
      
      {/* Login History */}
      <LoginHistory events={loginHistory} />
    </div>
  )
}
```

### Privacy Controls Component

```typescript
// components/profile/PrivacyTab.tsx
export const PrivacyTab: React.FC<{ user: User; form: UseFormReturn }> = ({ user, form }) => {
  const { register, watch, setValue } = form
  const privacySettings = watch('privacySettings')

  return (
    <GlassMorphism variant="medium" className="p-6">
      <h3 className="text-lg font-heading text-cream mb-6">Privacy & Visibility</h3>
      
      <div className="space-y-6">
        {/* Profile Visibility */}
        <div>
          <h4 className="font-medium text-cream mb-3">Profile Visibility</h4>
          <div className="space-y-3">
            {[
              { value: 'public', label: 'Public', desc: 'Anyone can see your profile' },
              { value: 'business_only', label: 'Business Contacts', desc: 'Only business owners can see your profile' },
              { value: 'private', label: 'Private', desc: 'Only you can see your profile' }
            ].map((option) => (
              <label key={option.value} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  value={option.value}
                  {...register('privacySettings.profileVisibility')}
                  className="sr-only"
                />
                <div className={cn(
                  'w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5',
                  privacySettings?.profileVisibility === option.value
                    ? 'border-teal-primary bg-teal-primary'
                    : 'border-sage/30'
                )}>
                  {privacySettings?.profileVisibility === option.value && (
                    <div className="w-2 h-2 bg-cream rounded-full" />
                  )}
                </div>
                <div>
                  <span className="text-cream font-medium">{option.label}</span>
                  <p className="text-sm text-sage/70">{option.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Contact Information Visibility */}
        <div>
          <h4 className="font-medium text-cream mb-3">Contact Information</h4>
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span className="text-sage/80">Show email address</span>
              <ToggleSwitch
                checked={privacySettings?.showEmail}
                onChange={(checked) => setValue('privacySettings.showEmail', checked)}
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sage/80">Show phone number</span>
              <ToggleSwitch
                checked={privacySettings?.showPhone}
                onChange={(checked) => setValue('privacySettings.showPhone', checked)}
              />
            </label>
          </div>
        </div>

        {/* Location Privacy */}
        <div>
          <h4 className="font-medium text-cream mb-3">Location Sharing</h4>
          <select
            {...register('privacySettings.showLocation')}
            className="w-full px-4 py-3 bg-navy-50/20 border border-sage/20 rounded-lg text-cream focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
          >
            <option value="exact">Show exact location</option>
            <option value="city">Show city only</option>
            <option value="region">Show region only</option>
            <option value="hidden">Don't show location</option>
          </select>
        </div>

        {/* Data Controls */}
        <div className="pt-6 border-t border-sage/20">
          <h4 className="font-medium text-cream mb-3">Data Controls</h4>
          <div className="space-y-3">
            <button className="w-full text-left p-4 bg-navy-50/20 hover:bg-navy-50/30 rounded-lg transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-cream font-medium">Download your data</span>
                  <p className="text-sm text-sage/70">Get a copy of your account data</p>
                </div>
                <Download className="w-5 h-5 text-sage/70" />
              </div>
            </button>
            
            <button className="w-full text-left p-4 bg-red-error/10 hover:bg-red-error/20 border border-red-error/20 rounded-lg transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-red-error font-medium">Delete account</span>
                  <p className="text-sm text-red-error/70">Permanently delete your account and data</p>
                </div>
                <Trash2 className="w-5 h-5 text-red-error/70" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </GlassMorphism>
  )
}
```

## Technical Implementation Notes

### Profile Data Management
- Implement real-time profile updates with optimistic UI updates
- Image upload with compression, resizing, and CDN optimization
- Form validation with immediate feedback and error recovery
- Change tracking and undo functionality for accidental changes

### Security Implementation
- Two-factor authentication with TOTP/SMS support and QR code generation
- Secure password change requiring current password verification
- Session management with detailed device fingerprinting and location tracking
- Security event logging and real-time alerting for suspicious activities

### Privacy Compliance
- GDPR-compliant data management with user consent tracking
- Cookie consent integration with granular preference controls
- Data retention policy enforcement with automated cleanup
- User consent tracking and management with audit trails

## Dependencies
- Story 2.5 (Session management for settings access)
- Story 2.1 (User profile database schema)
- Image processing and CDN services
- Two-factor authentication services

## Testing Requirements

### Profile Management Tests
- Profile information update functionality with validation
- Image upload and processing tests with various formats
- Privacy settings effectiveness tests with access control validation
- Data validation and security tests for all profile fields

### Security Feature Tests
- Two-factor authentication setup and validation workflows
- Password change security tests with attack prevention
- Session management functionality tests across devices
- Security monitoring and alerting tests for various scenarios

### Privacy Compliance Tests
- Data export functionality validation with complete data sets
- Account deletion process tests with data cleanup verification
- GDPR compliance verification with consent tracking
- Cookie consent and preferences tests with proper enforcement

## Definition of Done

### Profile Management System
- [ ] Complete profile information management system with real-time updates
- [ ] Profile photo upload with cropping, optimization, and CDN integration
- [ ] Privacy and visibility controls with granular permission settings
- [ ] Social media links management with validation and preview
- [ ] Bio and location editing with autocomplete and geolocation support

### Security Settings
- [ ] Account security settings interface with comprehensive controls
- [ ] Two-factor authentication system operational with multiple methods
- [ ] Password change functionality with security verification
- [ ] Active session management with device details and location tracking
- [ ] Login history and security monitoring with alert system

### Privacy & Data Controls
- [ ] Notification preference management with granular controls
- [ ] Data export and deletion capabilities with GDPR compliance
- [ ] Privacy settings with real-time access control enforcement
- [ ] Cookie consent management with preference granularity
- [ ] Data retention controls with automated policy enforcement

### User Experience
- [ ] Mobile-responsive settings interface with touch optimization
- [ ] Intuitive tab navigation with state persistence
- [ ] Real-time form validation with helpful error messages
- [ ] Loading states and progress feedback for all operations
- [ ] Accessibility compliance with screen reader and keyboard support

### Security & Performance
- [ ] All security features tested and validated against common attacks
- [ ] Profile update performance optimized (< 500ms response time)
- [ ] Image upload processing optimized with progress feedback
- [ ] Privacy settings enforcement tested across all platform features
- [ ] Security audit logging for all account changes

### Testing Coverage
- [ ] Unit tests for all profile management components
- [ ] Integration tests for security settings and privacy controls
- [ ] User experience testing with accessibility validation
- [ ] Security testing for all account management features
- [ ] Performance testing for profile updates and image uploads

### Documentation
- [ ] User guide for profile management and privacy settings
- [ ] Security best practices documentation for users
- [ ] Developer documentation for profile management APIs
- [ ] Privacy policy and data handling documentation

## Acceptance Validation

### Profile Management Success
- [ ] Profile update success rate > 98%
- [ ] Image upload completion rate > 95%
- [ ] Profile information accuracy maintained across updates
- [ ] Privacy settings enforcement effectiveness 100%
- [ ] User satisfaction with profile management > 4.5/5

### Security Features Validation
- [ ] Two-factor authentication adoption rate > 40% for active users
- [ ] Password security compliance > 95% for new passwords
- [ ] Session management accuracy across devices > 99%
- [ ] Security alert accuracy with false positive rate < 5%
- [ ] Account takeover prevention effectiveness 100%

### Privacy Compliance Metrics
- [ ] GDPR compliance score 100% for data handling
- [ ] Data export completeness and accuracy 100%
- [ ] Account deletion cleanup effectiveness 100%
- [ ] Privacy setting enforcement across platform 100%
- [ ] User consent tracking accuracy 100%

## Risk Assessment

**Medium Risk:** Complex privacy settings may confuse users
- *Mitigation:* User testing for settings UX, clear explanations, and contextual help

**High Risk:** Security feature implementation vulnerabilities
- *Mitigation:* Comprehensive security audits, penetration testing, and security reviews

**Low Risk:** Profile photo upload performance and storage costs
- *Mitigation:* Image optimization, CDN integration, and storage monitoring

**Low Risk:** Data export functionality complexity
- *Mitigation:* Automated testing, data validation, and user verification processes

## Success Metrics

- **User Engagement:** Profile completion rate > 85%
- **Security Adoption:** Two-factor authentication usage > 40%
- **Privacy Awareness:** Privacy settings configuration > 70%
- **User Satisfaction:** Account management experience > 4.5/5
- **Security Effectiveness:** Zero successful account compromise incidents

This story establishes comprehensive user profile and account management capabilities that provide users with complete control over their account information, privacy preferences, and security settings while maintaining the highest standards of data protection and user experience.