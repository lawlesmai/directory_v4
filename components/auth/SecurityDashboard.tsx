'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, Lock, Smartphone, Mail, Key, AlertTriangle,
  CheckCircle, XCircle, Clock, Monitor, Globe, MapPin,
  ChevronRight, Settings, Award, TrendingUp, Info,
  ShieldCheck, ShieldOff, Activity, UserCheck
} from 'lucide-react';
import { GlassMorphism } from '../GlassMorphism';
import { cn } from '@/lib/utils';

interface SecuritySession {
  id: string;
  device: string;
  location: string;
  ip: string;
  lastActive: Date;
  browser: string;
  isCurrent: boolean;
}

interface SecurityEvent {
  id: string;
  type: 'login' | 'logout' | 'password_change' | 'mfa_enabled' | 'suspicious_activity';
  timestamp: Date;
  details: string;
  ip?: string;
  location?: string;
  status: 'success' | 'warning' | 'error';
}

interface SecurityScore {
  overall: number;
  factors: {
    passwordStrength: number;
    mfaEnabled: boolean;
    recentPasswordChange: boolean;
    verifiedEmail: boolean;
    verifiedPhone: boolean;
    backupMethods: number;
  };
}

interface SecurityDashboardProps {
  onPasswordChange?: () => void;
  onMFASetup?: () => void;
  onRecoverySetup?: () => void;
  className?: string;
}

export const SecurityDashboard: React.FC<SecurityDashboardProps> = ({
  onPasswordChange,
  onMFASetup,
  onRecoverySetup,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'sessions' | 'settings'>('overview');
  
  // Mock data - replace with real data from API
  const securityScore: SecurityScore = {
    overall: 75,
    factors: {
      passwordStrength: 80,
      mfaEnabled: true,
      recentPasswordChange: true,
      verifiedEmail: true,
      verifiedPhone: false,
      backupMethods: 2
    }
  };

  const recentActivity: SecurityEvent[] = [
    {
      id: '1',
      type: 'login',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      details: 'Successful login from Chrome on macOS',
      ip: '192.168.1.1',
      location: 'San Francisco, CA',
      status: 'success'
    },
    {
      id: '2',
      type: 'password_change',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      details: 'Password successfully changed',
      status: 'success'
    },
    {
      id: '3',
      type: 'suspicious_activity',
      timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000),
      details: 'Login attempt from new location blocked',
      ip: '203.45.67.89',
      location: 'Unknown Location',
      status: 'warning'
    }
  ];

  const activeSessions: SecuritySession[] = [
    {
      id: '1',
      device: 'MacBook Pro',
      location: 'San Francisco, CA',
      ip: '192.168.1.1',
      lastActive: new Date(),
      browser: 'Chrome 120',
      isCurrent: true
    },
    {
      id: '2',
      device: 'iPhone 15 Pro',
      location: 'San Francisco, CA',
      ip: '192.168.1.2',
      lastActive: new Date(Date.now() - 30 * 60 * 1000),
      browser: 'Safari',
      isCurrent: false
    }
  ];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-sage';
    if (score >= 60) return 'text-teal-primary';
    if (score >= 40) return 'text-gold-primary';
    return 'text-red-error';
  };

  const getScoreGradient = (score: number) => {
    if (score >= 80) return 'from-sage to-teal-primary';
    if (score >= 60) return 'from-teal-secondary to-teal-primary';
    if (score >= 40) return 'from-gold-secondary to-gold-primary';
    return 'from-red-error to-red-warning';
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Security Score */}
      <GlassMorphism
        variant="subtle"
        className="p-6"
        tint="cool"
        border
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-cream mb-1">Security Score</h3>
            <p className="text-sm text-sage/70">Based on your security settings</p>
          </div>
          <div className="text-right">
            <div className={cn('text-3xl font-bold', getScoreColor(securityScore.overall))}>
              {securityScore.overall}
            </div>
            <div className="text-xs text-sage/50">out of 100</div>
          </div>
        </div>

        {/* Score Progress Bar */}
        <div className="w-full bg-navy-50/30 rounded-full h-3 mb-6 overflow-hidden">
          <motion.div
            className={cn('h-full bg-gradient-to-r', getScoreGradient(securityScore.overall))}
            initial={{ width: 0 }}
            animate={{ width: `${securityScore.overall}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>

        {/* Security Factors */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { 
              label: 'Password Strength', 
              value: securityScore.factors.passwordStrength, 
              type: 'percentage' as const,
              icon: Lock 
            },
            { 
              label: 'Two-Factor Auth', 
              value: securityScore.factors.mfaEnabled, 
              type: 'boolean' as const,
              icon: Smartphone 
            },
            { 
              label: 'Email Verified', 
              value: securityScore.factors.verifiedEmail, 
              type: 'boolean' as const,
              icon: Mail 
            },
            { 
              label: 'Phone Verified', 
              value: securityScore.factors.verifiedPhone, 
              type: 'boolean' as const,
              icon: Smartphone 
            },
            { 
              label: 'Recent Password Update', 
              value: securityScore.factors.recentPasswordChange, 
              type: 'boolean' as const,
              icon: Clock 
            },
            { 
              label: 'Recovery Methods', 
              value: `${securityScore.factors.backupMethods} active`, 
              type: 'text' as const,
              icon: Key 
            }
          ].map(({ label, value, type, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 p-3 bg-navy-50/10 rounded-lg">
              <Icon className="w-4 h-4 text-sage/50 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-sage/70 truncate">{label}</p>
                <p className={cn(
                  'text-sm font-medium',
                  type === 'boolean' 
                    ? value ? 'text-sage' : 'text-red-error'
                    : type === 'percentage'
                    ? getScoreColor(value as number)
                    : 'text-cream'
                )}>
                  {type === 'boolean' ? (
                    value ? 'Enabled' : 'Disabled'
                  ) : type === 'percentage' ? (
                    `${value}%`
                  ) : (
                    value
                  )}
                </p>
              </div>
              {type === 'boolean' && (
                value ? (
                  <CheckCircle className="w-4 h-4 text-sage flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-error flex-shrink-0" />
                )
              )}
            </div>
          ))}
        </div>
      </GlassMorphism>

      {/* Security Recommendations */}
      <GlassMorphism
        variant="subtle"
        className="p-6"
        border
      >
        <h3 className="text-lg font-semibold text-cream mb-4">Security Recommendations</h3>
        <div className="space-y-3">
          {!securityScore.factors.mfaEnabled && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-3 bg-gold-primary/10 border border-gold-primary/30 rounded-lg"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-gold-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-cream">Enable Two-Factor Authentication</p>
                  <p className="text-xs text-sage/70 mt-1">Add an extra layer of security to your account</p>
                </div>
              </div>
              <button
                onClick={onMFASetup}
                className="px-3 py-1.5 text-xs font-medium text-gold-primary bg-gold-primary/20 
                         rounded hover:bg-gold-primary/30 transition-colors"
              >
                Setup
              </button>
            </motion.div>
          )}

          {!securityScore.factors.verifiedPhone && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center justify-between p-3 bg-teal-primary/10 border border-teal-primary/30 rounded-lg"
            >
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-teal-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-cream">Verify Your Phone Number</p>
                  <p className="text-xs text-sage/70 mt-1">Enable SMS recovery and alerts</p>
                </div>
              </div>
              <button
                className="px-3 py-1.5 text-xs font-medium text-teal-primary bg-teal-primary/20 
                         rounded hover:bg-teal-primary/30 transition-colors"
              >
                Verify
              </button>
            </motion.div>
          )}

          {securityScore.factors.backupMethods < 3 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-center justify-between p-3 bg-sage/10 border border-sage/30 rounded-lg"
            >
              <div className="flex items-start gap-3">
                <Key className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-cream">Add Recovery Methods</p>
                  <p className="text-xs text-sage/70 mt-1">Ensure you can always access your account</p>
                </div>
              </div>
              <button
                onClick={onRecoverySetup}
                className="px-3 py-1.5 text-xs font-medium text-sage bg-sage/20 
                         rounded hover:bg-sage/30 transition-colors"
              >
                Add
              </button>
            </motion.div>
          )}
        </div>
      </GlassMorphism>

      {/* Security Achievements */}
      <GlassMorphism
        variant="subtle"
        className="p-6"
        border
      >
        <h3 className="text-lg font-semibold text-cream mb-4">Security Achievements</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Shield, label: 'First Steps', earned: true, description: 'Set up your account' },
            { icon: Lock, label: 'Strong Password', earned: true, description: 'Created a secure password' },
            { icon: ShieldCheck, label: '2FA Hero', earned: securityScore.factors.mfaEnabled, description: 'Enabled 2FA' },
            { icon: UserCheck, label: 'Fully Verified', earned: securityScore.factors.verifiedEmail && securityScore.factors.verifiedPhone, description: 'Verified all info' },
            { icon: Award, label: 'Security Pro', earned: securityScore.overall >= 80, description: 'Score 80+' },
            { icon: TrendingUp, label: 'Always Improving', earned: false, description: 'Monthly updates' }
          ].map(({ icon: Icon, label, earned, description }) => (
            <div
              key={label}
              className={cn(
                'p-3 rounded-lg text-center transition-all duration-200',
                earned
                  ? 'bg-gradient-to-br from-teal-primary/20 to-sage/20 border border-sage/30'
                  : 'bg-navy-50/10 border border-sage/10 opacity-50'
              )}
            >
              <Icon className={cn(
                'w-6 h-6 mx-auto mb-2',
                earned ? 'text-sage' : 'text-sage/30'
              )} />
              <p className={cn(
                'text-xs font-medium',
                earned ? 'text-cream' : 'text-cream/50'
              )}>
                {label}
              </p>
              <p className="text-xs text-sage/50 mt-1">{description}</p>
            </div>
          ))}
        </div>
      </GlassMorphism>
    </div>
  );

  const renderActivity = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-cream">Recent Security Activity</h3>
        <button className="text-xs text-teal-primary hover:text-teal-secondary transition-colors">
          View All
        </button>
      </div>

      {recentActivity.map((event) => {
        const EventIcon = {
          login: Monitor,
          logout: Monitor,
          password_change: Lock,
          mfa_enabled: Shield,
          suspicious_activity: AlertTriangle
        }[event.type];

        const statusColor = {
          success: 'text-sage',
          warning: 'text-gold-primary',
          error: 'text-red-error'
        }[event.status];

        return (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-start gap-4 p-4 bg-navy-50/10 rounded-lg hover:bg-navy-50/20 transition-colors"
          >
            <div className={cn('p-2 rounded-full', {
              'bg-sage/20': event.status === 'success',
              'bg-gold-primary/20': event.status === 'warning',
              'bg-red-error/20': event.status === 'error'
            })}>
              <EventIcon className={cn('w-4 h-4', statusColor)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-cream">{event.details}</p>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-xs text-sage/50">{formatTimeAgo(event.timestamp)}</span>
                {event.ip && (
                  <>
                    <span className="text-xs text-sage/30">•</span>
                    <span className="text-xs text-sage/50">IP: {event.ip}</span>
                  </>
                )}
                {event.location && (
                  <>
                    <span className="text-xs text-sage/30">•</span>
                    <span className="text-xs text-sage/50 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {event.location}
                    </span>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );

  const renderSessions = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-cream">Active Sessions</h3>
        <button className="text-xs text-red-error hover:text-red-warning transition-colors">
          Sign Out All Other Sessions
        </button>
      </div>

      {activeSessions.map((session) => (
        <motion.div
          key={session.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn(
            'flex items-center justify-between p-4 rounded-lg transition-colors',
            session.isCurrent
              ? 'bg-teal-primary/10 border border-teal-primary/30'
              : 'bg-navy-50/10 hover:bg-navy-50/20'
          )}
        >
          <div className="flex items-start gap-4">
            <div className="p-2 bg-navy-50/20 rounded-full">
              <Monitor className="w-4 h-4 text-sage" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-cream">{session.device}</p>
                {session.isCurrent && (
                  <span className="px-2 py-0.5 text-xs font-medium text-teal-primary bg-teal-primary/20 rounded">
                    Current
                  </span>
                )}
              </div>
              <p className="text-xs text-sage/70 mt-1">{session.browser}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-sage/50 flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  {session.ip}
                </span>
                <span className="text-xs text-sage/50 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {session.location}
                </span>
                <span className="text-xs text-sage/50 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTimeAgo(session.lastActive)}
                </span>
              </div>
            </div>
          </div>
          {!session.isCurrent && (
            <button className="text-xs text-red-error hover:text-red-warning transition-colors">
              End Session
            </button>
          )}
        </motion.div>
      ))}
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <GlassMorphism
        variant="subtle"
        className="p-4"
        border
      >
        <h3 className="text-lg font-semibold text-cream mb-4">Security Settings</h3>
        <div className="space-y-4">
          <button
            onClick={onPasswordChange}
            className="w-full flex items-center justify-between p-3 bg-navy-50/10 rounded-lg
                     hover:bg-navy-50/20 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-sage/70" />
              <div className="text-left">
                <p className="text-sm font-medium text-cream">Change Password</p>
                <p className="text-xs text-sage/50">Last changed 30 days ago</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-sage/50 group-hover:text-sage transition-colors" />
          </button>

          <button
            onClick={onMFASetup}
            className="w-full flex items-center justify-between p-3 bg-navy-50/10 rounded-lg
                     hover:bg-navy-50/20 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-sage/70" />
              <div className="text-left">
                <p className="text-sm font-medium text-cream">Two-Factor Authentication</p>
                <p className="text-xs text-sage/50">
                  {securityScore.factors.mfaEnabled ? 'Enabled' : 'Not configured'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-sage/50 group-hover:text-sage transition-colors" />
          </button>

          <button
            onClick={onRecoverySetup}
            className="w-full flex items-center justify-between p-3 bg-navy-50/10 rounded-lg
                     hover:bg-navy-50/20 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-sage/70" />
              <div className="text-left">
                <p className="text-sm font-medium text-cream">Account Recovery</p>
                <p className="text-xs text-sage/50">
                  {securityScore.factors.backupMethods} recovery methods configured
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-sage/50 group-hover:text-sage transition-colors" />
          </button>

          <button
            className="w-full flex items-center justify-between p-3 bg-navy-50/10 rounded-lg
                     hover:bg-navy-50/20 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-sage/70" />
              <div className="text-left">
                <p className="text-sm font-medium text-cream">Login Alerts</p>
                <p className="text-xs text-sage/50">Get notified of new sign-ins</p>
              </div>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                defaultChecked
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-navy-50/30 rounded-full peer-checked:bg-teal-primary/30 
                            transition-colors" />
              <div className="absolute left-1 top-1 w-4 h-4 bg-sage/50 rounded-full transition-transform
                            peer-checked:translate-x-4 peer-checked:bg-teal-primary" />
            </div>
          </button>
        </div>
      </GlassMorphism>
    </div>
  );

  return (
    <GlassMorphism
      variant="medium"
      className={cn('w-full max-w-4xl mx-auto p-6', className)}
      animated
      border
      shadow
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-teal-primary/20 to-sage/20 rounded-full">
            <Shield className="w-6 h-6 text-sage" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-cream">Security Center</h2>
            <p className="text-sm text-sage/70">Manage your account security</p>
          </div>
        </div>
        <Settings className="w-5 h-5 text-sage/50 cursor-pointer hover:text-sage transition-colors" />
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-navy-50/20 rounded-lg mb-6">
        {[
          { key: 'overview' as const, label: 'Overview', icon: Shield },
          { key: 'activity' as const, label: 'Activity', icon: Activity },
          { key: 'sessions' as const, label: 'Sessions', icon: Monitor },
          { key: 'settings' as const, label: 'Settings', icon: Settings }
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md',
              'text-sm font-medium transition-all duration-200',
              activeTab === key
                ? 'bg-gradient-to-r from-teal-primary/30 to-sage/30 text-cream'
                : 'text-sage/70 hover:text-cream hover:bg-navy-50/20'
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'activity' && renderActivity()}
          {activeTab === 'sessions' && renderSessions()}
          {activeTab === 'settings' && renderSettings()}
        </motion.div>
      </AnimatePresence>
    </GlassMorphism>
  );
};

export default SecurityDashboard;