'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  PasswordChangeForm,
  PasswordResetFlow,
  SecurityDashboard,
  AccountRecovery,
  SecurityNotifications,
  InlineSecurityNotification,
  SecurityActivity
} from '@/components/auth';
import { GlassMorphism } from '@/components/GlassMorphism';
import { Shield, Lock, Key, Bell, Activity, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type DemoSection = 'password-change' | 'password-reset' | 'security-dashboard' | 'account-recovery' | 'notifications';

export default function SecurityDemoPage() {
  const [activeSection, setActiveSection] = useState<DemoSection>('security-dashboard');
  const [showNotifications, setShowNotifications] = useState(true);

  const sections = [
    {
      id: 'security-dashboard' as DemoSection,
      title: 'Security Dashboard',
      description: 'Comprehensive security overview and management',
      icon: Shield,
      gradient: 'from-teal-primary to-teal-secondary'
    },
    {
      id: 'password-change' as DemoSection,
      title: 'Password Change',
      description: 'Secure password update interface',
      icon: Lock,
      gradient: 'from-sage to-teal-primary'
    },
    {
      id: 'password-reset' as DemoSection,
      title: 'Password Reset',
      description: 'Complete reset workflow with verification',
      icon: Key,
      gradient: 'from-gold-primary to-gold-secondary'
    },
    {
      id: 'account-recovery' as DemoSection,
      title: 'Account Recovery',
      description: 'Multiple recovery method setup',
      icon: Shield,
      gradient: 'from-teal-secondary to-sage'
    },
    {
      id: 'notifications' as DemoSection,
      title: 'Security Notifications',
      description: 'Real-time security alerts and updates',
      icon: Bell,
      gradient: 'from-cream to-gold-primary'
    }
  ];

  const mockActivities = [
    {
      id: '1',
      type: 'login' as const,
      description: 'Successful login from Chrome',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      location: 'San Francisco, CA',
      device: 'MacBook Pro'
    },
    {
      id: '2',
      type: 'password_change' as const,
      description: 'Password successfully updated',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      device: 'iPhone 15 Pro'
    },
    {
      id: '3',
      type: 'suspicious' as const,
      description: 'Login attempt blocked',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      location: 'Unknown Location'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-dark via-teal-primary/10 to-navy-dark">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-30">
        <div className="absolute inset-0 bg-gradient-bg bg-[length:200%_200%] animate-[gradient_15s_ease_infinite]" />
      </div>

      {/* Security Notifications */}
      {showNotifications && (
        <SecurityNotifications position="top-right" />
      )}

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-to-br from-teal-primary/20 to-sage/20 rounded-full">
              <Shield className="w-12 h-12 text-sage" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-cream mb-4">
            Security & Password Management
          </h1>
          <p className="text-lg text-sage/80 max-w-2xl mx-auto">
            Comprehensive security UI components for password management, account recovery, and security monitoring
          </p>
        </motion.div>

        {/* Section Navigation */}
        <div className="mb-8">
          <GlassMorphism
            variant="subtle"
            className="p-2"
            border
          >
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      'p-4 rounded-lg transition-all duration-300',
                      'hover:shadow-lg group',
                      activeSection === section.id
                        ? 'bg-gradient-to-r ' + section.gradient + ' text-white shadow-lg scale-[1.02]'
                        : 'bg-navy-50/20 hover:bg-navy-50/30 text-cream'
                    )}
                  >
                    <Icon className={cn(
                      'w-6 h-6 mx-auto mb-2',
                      activeSection === section.id ? 'text-white' : 'text-sage'
                    )} />
                    <p className="text-sm font-medium">{section.title}</p>
                    <p className={cn(
                      'text-xs mt-1 hidden md:block',
                      activeSection === section.id ? 'text-white/80' : 'text-sage/60'
                    )}>
                      {section.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </GlassMorphism>
        </div>

        {/* Active Section Content */}
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeSection === 'security-dashboard' && (
            <div className="space-y-8">
              <SecurityDashboard
                onPasswordChange={() => setActiveSection('password-change')}
                onMFASetup={() => console.log('MFA Setup')}
                onRecoverySetup={() => setActiveSection('account-recovery')}
              />
              
              {/* Additional Activity Widget */}
              <div className="max-w-md mx-auto">
                <SecurityActivity activities={mockActivities} />
              </div>
            </div>
          )}

          {activeSection === 'password-change' && (
            <div className="max-w-md mx-auto">
              <PasswordChangeForm
                onSuccess={() => {
                  console.log('Password changed successfully');
                  setActiveSection('security-dashboard');
                }}
                onCancel={() => setActiveSection('security-dashboard')}
              />

              {/* Demo Inline Notification */}
              <div className="mt-6">
                <InlineSecurityNotification
                  type="info"
                  title="Password Policy"
                  message="Passwords must be at least 8 characters and contain uppercase, lowercase, numbers, and special characters."
                />
              </div>
            </div>
          )}

          {activeSection === 'password-reset' && (
            <div className="max-w-lg mx-auto">
              <PasswordResetFlow
                onSuccess={() => {
                  console.log('Password reset successfully');
                  setActiveSection('security-dashboard');
                }}
                onCancel={() => setActiveSection('security-dashboard')}
              />
            </div>
          )}

          {activeSection === 'account-recovery' && (
            <AccountRecovery
              onUpdate={() => console.log('Recovery methods updated')}
            />
          )}

          {activeSection === 'notifications' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <GlassMorphism
                variant="medium"
                className="p-6"
                border
                shadow
              >
                <h2 className="text-xl font-semibold text-cream mb-4">
                  Notification Settings & Examples
                </h2>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-navy-50/10 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-cream">Show Live Notifications</p>
                      <p className="text-xs text-sage/60">Toggle real-time security notifications</p>
                    </div>
                    <button
                      onClick={() => setShowNotifications(!showNotifications)}
                      className={cn(
                        'relative w-12 h-6 rounded-full transition-colors',
                        showNotifications ? 'bg-teal-primary' : 'bg-navy-50/30'
                      )}
                    >
                      <div className={cn(
                        'absolute w-5 h-5 bg-white rounded-full top-0.5 transition-transform',
                        showNotifications ? 'translate-x-6' : 'translate-x-0.5'
                      )} />
                    </button>
                  </div>

                  {/* Example Notifications */}
                  <div className="space-y-3">
                    <InlineSecurityNotification
                      type="success"
                      title="Security Score Improved"
                      message="Your security score has increased to 85/100 after enabling 2FA."
                    />
                    <InlineSecurityNotification
                      type="warning"
                      title="Password Expiring Soon"
                      message="Your password will expire in 7 days. Update it to maintain security."
                    />
                    <InlineSecurityNotification
                      type="error"
                      title="Suspicious Activity Detected"
                      message="Multiple failed login attempts from unknown location."
                    />
                    <InlineSecurityNotification
                      type="achievement"
                      title="Security Milestone"
                      message="Congratulations! You've maintained a perfect security score for 30 days."
                    />
                  </div>
                </div>
              </GlassMorphism>

              {/* Recent Activity */}
              <SecurityActivity activities={mockActivities} />
            </div>
          )}
        </motion.div>

        {/* Tips Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 max-w-4xl mx-auto"
        >
          <GlassMorphism
            variant="subtle"
            className="p-6"
            border
          >
            <h3 className="text-lg font-semibold text-cream mb-4">Security Best Practices</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  title: 'Use Strong Passwords',
                  description: 'Create unique passwords with 12+ characters including symbols',
                  icon: Lock
                },
                {
                  title: 'Enable 2FA',
                  description: 'Add an extra layer of security with two-factor authentication',
                  icon: Shield
                },
                {
                  title: 'Regular Updates',
                  description: 'Change passwords every 90 days for sensitive accounts',
                  icon: Activity
                },
                {
                  title: 'Multiple Recovery Options',
                  description: 'Set up backup codes, phone, and security questions',
                  icon: Key
                }
              ].map(({ title, description, icon: Icon }) => (
                <div key={title} className="flex gap-3">
                  <div className="p-2 bg-navy-50/20 rounded-full h-fit">
                    <Icon className="w-4 h-4 text-sage" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-cream">{title}</p>
                    <p className="text-xs text-sage/60 mt-1">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </GlassMorphism>
        </motion.div>
      </div>
    </div>
  );
}