'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Settings, Lock, Key } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '@/components/GlassMorphism';
import { 
  MFASetupWizard,
  MFAVerification,
  DeviceTrust,
  MFARecovery,
  BackupCodesStatus
} from './index';
import type { 
  MFAChallenge, 
  MFAFactor, 
  TrustedDevice,
  MFAVerificationResponse 
} from './types';

// Demo navigation tabs
const DemoTabs = [
  { id: 'setup', label: 'Setup Wizard', icon: Shield },
  { id: 'verify', label: 'Verification', icon: Lock },
  { id: 'devices', label: 'Trusted Devices', icon: Settings },
  { id: 'recovery', label: 'Recovery', icon: Key }
];

export const MFADemo: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('setup');
  const [setupComplete, setSetupComplete] = useState(false);

  // Mock data for demonstrations
  const mockFactors: MFAFactor[] = [
    {
      id: 'factor-1',
      userId: 'user-123',
      type: 'totp',
      status: 'enabled',
      friendlyName: 'iPhone Authenticator',
      createdAt: new Date('2024-01-15'),
      lastUsedAt: new Date('2024-01-20')
    },
    {
      id: 'factor-2',
      userId: 'user-123',
      type: 'sms',
      status: 'enabled',
      phoneNumber: '+1 (555) 123-4567',
      createdAt: new Date('2024-01-10')
    },
    {
      id: 'factor-3',
      userId: 'user-123',
      type: 'backup_codes',
      status: 'enabled',
      createdAt: new Date('2024-01-10')
    }
  ];

  const mockChallenge: MFAChallenge = {
    id: 'challenge-123',
    userId: 'user-123',
    factors: mockFactors,
    requiredFactors: 1,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    attempts: 0,
    maxAttempts: 3,
    isLocked: false
  };

  const mockDevices: TrustedDevice[] = [
    {
      id: 'device-1',
      name: 'MacBook Pro',
      deviceType: 'desktop',
      browser: 'Chrome',
      os: 'macOS Sonoma',
      lastUsed: new Date(),
      trustedAt: new Date('2024-01-15'),
      ipAddress: '192.168.1.100',
      isCurrentDevice: true
    },
    {
      id: 'device-2',
      name: 'iPhone 15 Pro',
      deviceType: 'mobile',
      browser: 'Safari',
      os: 'iOS 17',
      lastUsed: new Date('2024-01-19'),
      trustedAt: new Date('2024-01-10'),
      ipAddress: '192.168.1.101',
      isCurrentDevice: false
    },
    {
      id: 'device-3',
      name: 'iPad Air',
      deviceType: 'tablet',
      browser: 'Safari',
      os: 'iPadOS 17',
      lastUsed: new Date('2024-01-05'),
      trustedAt: new Date('2023-12-20'),
      ipAddress: '192.168.1.102',
      isCurrentDevice: false
    }
  ];

  const handleSetupComplete = (factor: MFAFactor) => {
    console.log('MFA Setup Complete:', factor);
    setSetupComplete(true);
  };

  const handleVerificationSuccess = (response: MFAVerificationResponse) => {
    console.log('Verification Success:', response);
  };

  const handleDeviceRevoke = (deviceId: string) => {
    console.log('Revoke Device:', deviceId);
  };

  const handleRecoveryMethodSelect = (method: 'backup_code' | 'email' | 'support') => {
    console.log('Recovery Method Selected:', method);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-navy-dark to-navy-darker p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-cream">
            MFA Components Demo
          </h1>
          <p className="text-sage/70">
            Comprehensive Multi-Factor Authentication UI Components
          </p>
        </div>

        {/* Tab Navigation */}
        <GlassMorphism variant="subtle" className="p-2">
          <div className="flex flex-wrap gap-2">
            {DemoTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg',
                    'transition-all duration-200',
                    isActive
                      ? 'bg-teal-primary/20 text-cream border border-teal-primary/30'
                      : 'text-sage/70 hover:text-cream hover:bg-navy-dark/30'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </GlassMorphism>

        {/* Content Area */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'setup' && (
            <div className="space-y-8">
              <MFASetupWizard
                userId="user-123"
                onComplete={handleSetupComplete}
                onCancel={() => console.log('Setup cancelled')}
                availableMethods={['totp', 'sms']}
              />
              
              {setupComplete && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 bg-teal-primary/10 border border-teal-primary/20 rounded-lg text-center"
                >
                  <p className="text-cream">
                    Setup completed successfully! Try the Verification tab.
                  </p>
                </motion.div>
              )}
            </div>
          )}

          {activeTab === 'verify' && (
            <div className="space-y-8">
              <MFAVerification
                challenge={mockChallenge}
                onSuccess={handleVerificationSuccess}
                onError={(error) => console.error('Verification error:', error)}
                onCancel={() => console.log('Verification cancelled')}
                showTrustDevice
              />
              
              <div className="grid md:grid-cols-2 gap-4">
                <GlassMorphism variant="subtle" className="p-4">
                  <h3 className="text-sm font-medium text-cream mb-2">
                    Test Codes
                  </h3>
                  <ul className="space-y-1 text-xs text-sage/60">
                    <li>TOTP Code: <code className="text-teal-primary">123456</code></li>
                    <li>SMS Code: <code className="text-teal-primary">123456</code></li>
                    <li>Backup Code: <code className="text-teal-primary">TEST-TEST-TEST</code></li>
                  </ul>
                </GlassMorphism>
                
                <BackupCodesStatus
                  remaining={7}
                  total={10}
                  onGenerate={() => console.log('Generate new codes')}
                />
              </div>
            </div>
          )}

          {activeTab === 'devices' && (
            <DeviceTrust
              devices={mockDevices}
              onRevoke={handleDeviceRevoke}
              onRevokeAll={() => console.log('Revoke all devices')}
              currentDeviceId="device-1"
            />
          )}

          {activeTab === 'recovery' && (
            <MFARecovery
              onRecoveryMethodSelect={handleRecoveryMethodSelect}
              showBackupCode
              showEmailRecovery
              showSupportContact
            />
          )}
        </motion.div>

        {/* Component Features */}
        <GlassMorphism variant="subtle" className="p-6">
          <h3 className="text-lg font-medium text-cream mb-4">
            Key Features
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              'Auto-advancing code inputs',
              'QR code generation for TOTP',
              'SMS verification with resend',
              'Secure backup code display',
              'Device trust management',
              'Account recovery flows',
              'Progress indicators',
              'Mobile-optimized design',
              'Accessibility compliant',
              'Glassmorphism aesthetic',
              'Error handling',
              'Loading states'
            ].map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-2 text-sm text-sage/70"
              >
                <div className="w-1.5 h-1.5 bg-teal-primary rounded-full" />
                {feature}
              </div>
            ))}
          </div>
        </GlassMorphism>

        {/* Instructions */}
        <GlassMorphism variant="subtle" className="p-6">
          <h3 className="text-lg font-medium text-cream mb-4">
            Integration Instructions
          </h3>
          <div className="space-y-4 text-sm text-sage/70">
            <p>
              These MFA components are production-ready and can be integrated into your authentication flow:
            </p>
            <ol className="space-y-2 list-decimal list-inside">
              <li>Import components from <code className="text-teal-primary">@/components/auth/mfa</code></li>
              <li>Connect to your backend MFA infrastructure</li>
              <li>Implement the required API endpoints for TOTP, SMS, and backup codes</li>
              <li>Handle the callbacks for setup completion and verification</li>
              <li>Store device trust tokens securely</li>
            </ol>
            <p className="mt-4">
              All components support mobile gestures, keyboard navigation, and screen reader accessibility.
            </p>
          </div>
        </GlassMorphism>
      </div>
    </div>
  );
};

export default MFADemo;