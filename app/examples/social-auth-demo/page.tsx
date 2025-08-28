'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  SocialLoginButton,
  SocialLoginGroup,
  SocialAuthModal,
  useSocialAuthModal,
  ProviderSelection,
  AccountLinking,
  SocialProfileSync,
  OAuthErrorBoundary,
  useOAuthErrorHandler
} from '@/components/auth';
import { GlassMorphism } from '@/components/GlassMorphism';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AuthProvider, AuthError } from '@/components/auth/types';

// Mock data for demonstration
const mockLinkedAccounts = [
  {
    provider: 'google' as AuthProvider,
    providerId: 'google-123456',
    email: 'user@gmail.com',
    displayName: 'John Doe',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
    isPrimary: true,
    linkedAt: '2024-01-15T10:30:00Z',
    lastUsed: '2024-01-20T09:15:00Z'
  },
  {
    provider: 'github' as AuthProvider,
    providerId: 'github-789012',
    email: 'john@github.com',
    displayName: 'johndoe',
    isPrimary: false,
    linkedAt: '2024-01-10T14:20:00Z',
    metadata: {
      username: 'johndoe',
      profileUrl: 'https://github.com/johndoe'
    }
  }
];

const mockSocialProfile = {
  provider: 'google' as AuthProvider,
  id: 'google-123456',
  email: 'user@gmail.com',
  name: 'John Doe',
  firstName: 'John',
  lastName: 'Doe',
  avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
  location: {
    city: 'San Francisco',
    state: 'CA',
    country: 'United States'
  },
  bio: 'Software developer passionate about creating great user experiences.',
  website: 'https://johndoe.dev',
  verified: true,
  lastUpdated: '2024-01-20T09:15:00Z'
};

const mockCurrentProfile = {
  id: 'user-123',
  email: 'john@example.com',
  fullName: 'John Smith',
  firstName: 'John',
  lastName: 'Smith',
  phone: '+1-555-0123',
  avatar: undefined,
  location: {
    city: 'New York',
    state: 'NY',
    country: 'United States'
  },
  businessType: 'customer' as const,
  isEmailVerified: true,
  isPhoneVerified: false,
  preferences: {
    theme: 'dark' as const,
    notifications: {
      email: true,
      push: false,
      marketing: false
    },
    privacy: {
      profileVisible: true,
      allowDirectMessages: true
    },
    accessibility: {
      reducedMotion: false,
      highContrast: false,
      largeText: false
    }
  },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-20T09:15:00Z'
};

export default function SocialAuthDemo() {
  const [activeDemo, setActiveDemo] = useState('buttons');
  const [showProfileSync, setShowProfileSync] = useState(false);
  const socialAuthModal = useSocialAuthModal();
  const { error, handleError, clearError } = useOAuthErrorHandler();

  const handleSocialLogin = (user: any, provider?: AuthProvider) => {
    console.log(`Successfully logged in with ${provider}:`, user);
    // Handle successful login
  };

  const handleSocialError = (authError: AuthError) => {
    console.error('Social auth error:', authError);
    handleError(authError);
  };

  const handleProviderSelect = (method: any) => {
    console.log('Selected authentication method:', method);
    // Handle provider selection
  };

  const handleAccountLink = async (provider: AuthProvider) => {
    console.log('Linking account:', provider);
    // Mock linking delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Handle account linking
  };

  const handleAccountUnlink = async (provider: AuthProvider) => {
    console.log('Unlinking account:', provider);
    // Mock unlinking delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    // Handle account unlinking
  };

  const handleSetPrimary = async (provider: AuthProvider) => {
    console.log('Setting primary account:', provider);
    // Handle setting primary account
  };

  const handleProfileSync = async (data: any, settings: any) => {
    console.log('Syncing profile data:', data, settings);
    // Mock sync delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Handle profile sync
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-dark via-navy-light to-navy-dark">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-cream mb-4">
            Social Authentication Components
          </h1>
          <p className="text-sage/70 text-lg max-w-3xl mx-auto">
            Comprehensive demonstration of sophisticated social media login UI components 
            with provider-specific styling, OAuth callbacks, account linking, and error handling.
          </p>
        </div>

        <OAuthErrorBoundary onError={(error, errorInfo) => {
          console.error('OAuth Error Boundary:', error, errorInfo);
        }}>
          <Tabs value={activeDemo} onValueChange={setActiveDemo} className="w-full max-w-6xl mx-auto">
            <TabsList className="grid w-full grid-cols-6 mb-8">
              <TabsTrigger value="buttons">Login Buttons</TabsTrigger>
              <TabsTrigger value="modal">Auth Modal</TabsTrigger>
              <TabsTrigger value="selection">Provider Selection</TabsTrigger>
              <TabsTrigger value="linking">Account Linking</TabsTrigger>
              <TabsTrigger value="sync">Profile Sync</TabsTrigger>
              <TabsTrigger value="errors">Error Handling</TabsTrigger>
            </TabsList>

            {/* Social Login Buttons Demo */}
            <TabsContent value="buttons" className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <GlassMorphism variant="medium" className="p-8">
                  <h3 className="text-2xl font-bold text-cream mb-6">Individual Buttons</h3>
                  <div className="space-y-4">
                    <SocialLoginButton
                      provider="google"
                      onSuccess={handleSocialLogin}
                      onError={handleSocialError}
                    />
                    <SocialLoginButton
                      provider="apple"
                      onSuccess={handleSocialLogin}
                      onError={handleSocialError}
                    />
                    <SocialLoginButton
                      provider="facebook"
                      variant="outline"
                      onSuccess={handleSocialLogin}
                      onError={handleSocialError}
                    />
                    <SocialLoginButton
                      provider="github"
                      variant="ghost"
                      size="sm"
                      onSuccess={handleSocialLogin}
                      onError={handleSocialError}
                    />
                  </div>
                </GlassMorphism>

                <GlassMorphism variant="medium" className="p-8">
                  <h3 className="text-2xl font-bold text-cream mb-6">Button Groups</h3>
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-lg font-semibold text-cream mb-4">Vertical Layout</h4>
                      <SocialLoginGroup
                        providers={['google', 'apple', 'github']}
                        layout="vertical"
                        onSuccess={handleSocialLogin}
                        onError={handleSocialError}
                      />
                    </div>
                    
                    <div>
                      <h4 className="text-lg font-semibold text-cream mb-4">Grid Layout</h4>
                      <SocialLoginGroup
                        providers={['google', 'apple', 'facebook', 'github']}
                        layout="grid"
                        variant="outline"
                        size="sm"
                        onSuccess={handleSocialLogin}
                        onError={handleSocialError}
                      />
                    </div>
                  </div>
                </GlassMorphism>
              </div>
            </TabsContent>

            {/* Social Auth Modal Demo */}
            <TabsContent value="modal" className="space-y-8">
              <GlassMorphism variant="medium" className="p-8 max-w-2xl mx-auto">
                <h3 className="text-2xl font-bold text-cream mb-6 text-center">Social Auth Modal</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Button 
                    onClick={() => socialAuthModal.openLogin()}
                    variant="default"
                  >
                    Open Login Modal
                  </Button>
                  <Button 
                    onClick={() => socialAuthModal.openRegister()}
                    variant="secondary"
                  >
                    Open Register Modal
                  </Button>
                </div>
                
                <SocialAuthModal
                  isOpen={socialAuthModal.isOpen}
                  onClose={socialAuthModal.close}
                  mode={socialAuthModal.mode}
                  onModeChange={socialAuthModal.changeMode}
                  providers={['google', 'apple', 'facebook', 'github']}
                  onSuccess={handleSocialLogin}
                  onError={handleSocialError}
                  showBenefits={true}
                  showPrivacyNote={true}
                  oauthMode="popup"
                />
              </GlassMorphism>
            </TabsContent>

            {/* Provider Selection Demo */}
            <TabsContent value="selection">
              <GlassMorphism variant="medium" className="p-8">
                <ProviderSelection
                  providers={['google', 'apple', 'facebook', 'github', 'email', 'magic_link']}
                  onSelect={handleProviderSelect}
                  recommended="google"
                  showCategories={true}
                  showMetrics={true}
                  showDescription={true}
                />
              </GlassMorphism>
            </TabsContent>

            {/* Account Linking Demo */}
            <TabsContent value="linking">
              <GlassMorphism variant="medium" className="p-8">
                <AccountLinking
                  linkedAccounts={mockLinkedAccounts}
                  onLink={handleAccountLink}
                  onUnlink={handleAccountUnlink}
                  onSetPrimary={handleSetPrimary}
                  availableProviders={['google', 'apple', 'facebook', 'github']}
                />
              </GlassMorphism>
            </TabsContent>

            {/* Profile Sync Demo */}
            <TabsContent value="sync">
              <div className="space-y-8">
                <div className="text-center">
                  <Button 
                    onClick={() => setShowProfileSync(true)}
                    variant="default"
                    size="lg"
                  >
                    Demo Profile Sync
                  </Button>
                </div>

                <AnimatePresence>
                  {showProfileSync && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      <GlassMorphism variant="medium" className="p-8">
                        <SocialProfileSync
                          socialProfile={mockSocialProfile}
                          currentProfile={mockCurrentProfile}
                          onSync={handleProfileSync}
                          onCancel={() => setShowProfileSync(false)}
                          showPrivacyControls={true}
                          allowAutoSync={true}
                        />
                      </GlassMorphism>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </TabsContent>

            {/* Error Handling Demo */}
            <TabsContent value="errors">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <GlassMorphism variant="medium" className="p-8">
                  <h3 className="text-2xl font-bold text-cream mb-6">Error Simulation</h3>
                  <div className="space-y-4">
                    <Button 
                      onClick={() => handleSocialError({
                        message: 'Access was denied by the user',
                        code: 'access_denied',
                        provider: 'google'
                      } as any)}
                      variant="destructive"
                      className="w-full"
                    >
                      Simulate Access Denied
                    </Button>
                    <Button 
                      onClick={() => handleSocialError({
                        message: 'Authentication popup was blocked',
                        code: 'popup_blocked',
                        provider: 'apple'
                      } as any)}
                      variant="destructive"
                      className="w-full"
                    >
                      Simulate Popup Blocked
                    </Button>
                    <Button 
                      onClick={() => handleSocialError({
                        message: 'Network error occurred',
                        code: 'network_error',
                        provider: 'facebook'
                      } as any)}
                      variant="destructive"
                      className="w-full"
                    >
                      Simulate Network Error
                    </Button>
                    <Button 
                      onClick={clearError}
                      variant="secondary"
                      className="w-full"
                    >
                      Clear Errors
                    </Button>
                  </div>
                </GlassMorphism>

                {error && (
                  <GlassMorphism variant="medium" className="p-8">
                    <h3 className="text-2xl font-bold text-cream mb-6">Error Display</h3>
                    <div className="bg-red-error/10 border border-red-error/30 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-2 h-2 bg-red-error rounded-full animate-pulse"></div>
                        <span className="font-semibold text-red-error">{error.code}</span>
                      </div>
                      <p className="text-red-error mb-2">{error.message}</p>
                      {(error as any).provider && (
                        <p className="text-sage/70 text-sm">Provider: {(error as any).provider}</p>
                      )}
                    </div>
                  </GlassMorphism>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Feature Highlights */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">🎨</span>
                  Provider-Specific UI
                </CardTitle>
                <CardDescription>
                  Each provider follows official branding guidelines with proper colors, fonts, and styling.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">♿</span>
                  Accessibility First
                </CardTitle>
                <CardDescription>
                  WCAG 2.1 AA compliant with proper ARIA labels, keyboard navigation, and screen reader support.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">📱</span>
                  Mobile Optimized
                </CardTitle>
                <CardDescription>
                  Responsive design that works perfectly on all devices with touch-friendly interactions.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </OAuthErrorBoundary>
      </div>
    </div>
  );
}