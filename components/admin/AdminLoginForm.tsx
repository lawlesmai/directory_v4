'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Globe,
  Clock,
  Key
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '@/components/GlassMorphism';
import { MFAVerification } from '@/components/auth/mfa/MFAVerification';
import { MFAChallenge } from '@/components/auth/mfa/types';

interface AdminLoginFormProps {
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  className?: string;
}

interface LoginFormData {
  email: string;
  password: string;
  ipWhitelist?: boolean;
  rememberDevice?: boolean;
}

interface SecurityInfo {
  ipAddress: string;
  location: string;
  lastAttempt?: Date;
  failedAttempts: number;
  isLocked: boolean;
}

export const AdminLoginForm: React.FC<AdminLoginFormProps> = ({
  onSuccess,
  onError,
  className = ''
}) => {
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    ipWhitelist: false,
    rememberDevice: false
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'credentials' | 'mfa' | 'success'>('credentials');
  const [mfaChallenge, setMfaChallenge] = useState<MFAChallenge | null>(null);
  const [securityInfo] = useState<SecurityInfo>({
    ipAddress: '192.168.1.100',
    location: 'San Francisco, CA',
    failedAttempts: 0,
    isLocked: false
  });

  // Handle form input changes
  const handleInputChange = (field: keyof LoginFormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    if (error) setError(null);
  };

  // Validate form data
  const validateForm = (): string | null => {
    if (!formData.email) return 'Email is required';
    if (!formData.password) return 'Password is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      return 'Please enter a valid email address';
    }
    if (formData.password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    return null;
  };

  // Handle initial login submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Simulate API call for admin authentication
      await new Promise(resolve => setTimeout(resolve, 1500));

      // In production, this would be a real API call
      // Mock admin credentials for demo
      if (formData.email === 'admin@lawlessdirectory.com' && formData.password === 'AdminPass123!') {
        // Simulate MFA challenge
        const mockChallenge: MFAChallenge = {
          id: 'admin-challenge-' + Date.now(),
          userId: 'admin-user',
          factors: [
            {
              id: 'totp-primary',
              type: 'totp',
              status: 'enabled',
              friendlyName: 'Authenticator App',
              userId: 'admin-user',
              createdAt: new Date()
            },
            {
              id: 'sms-backup',
              type: 'sms',
              status: 'enabled',
              friendlyName: '+1 (555) ***-1234',
              userId: 'admin-user',
              createdAt: new Date()
            },
            {
              id: 'backup-codes',
              type: 'backup_codes',
              status: 'enabled',
              friendlyName: 'Recovery Codes',
              userId: 'admin-user',
              createdAt: new Date()
            }
          ],
          requiredFactors: 1,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
          attempts: 0,
          maxAttempts: 3,
          isLocked: false
        };

        setMfaChallenge(mockChallenge);
        setStep('mfa');
      } else {
        setError('Invalid admin credentials. Please check your email and password.');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle MFA success
  const handleMFASuccess = async (response: any) => {
    try {
      setStep('success');
      
      // Simulate successful admin authentication
      const adminData = {
        id: 'admin-user-1',
        email: formData.email,
        role: 'super_admin',
        permissions: ['read:all', 'write:all', 'admin:all'],
        sessionToken: 'mock-admin-session-token',
        deviceTrustToken: response.deviceTrustToken,
        loginTime: new Date(),
        ipAddress: securityInfo.ipAddress,
        location: securityInfo.location
      };

      // Small delay for success animation
      setTimeout(() => {
        onSuccess?.(adminData);
      }, 1500);
    } catch (err) {
      setError('Authentication failed. Please try again.');
      setStep('credentials');
    }
  };

  // Handle MFA error
  const handleMFAError = (error: string) => {
    setError(error);
    // Allow retry or go back to credentials
  };

  // Handle MFA cancellation
  const handleMFACancel = () => {
    setStep('credentials');
    setMfaChallenge(null);
    setError(null);
  };

  return (
    <div className={cn('min-h-screen flex items-center justify-center p-4', className)}>
      <div className="w-full max-w-md space-y-6">
        {/* Admin Portal Branding */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-2"
        >
          <div className="inline-flex p-4 bg-red-500/10 rounded-full border border-red-500/20 mb-4">
            <Shield className="w-12 h-12 text-red-400" />
          </div>
          <h1 className="text-3xl font-bold text-cream">
            Admin Portal
          </h1>
          <p className="text-sage/70">
            Secure administrative access to Lawless Directory
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* Credentials Step */}
          {step === 'credentials' && (
            <motion.div
              key="credentials"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.4 }}
            >
              <GlassMorphism
                variant="medium"
                className="p-6 sm:p-8"
                animated
              >
                {/* Security Info */}
                <div className="mb-6 p-4 bg-teal-primary/10 border border-teal-primary/20 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Globe className="w-5 h-5 text-teal-primary flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm text-cream font-medium">
                        Connection Secure
                      </p>
                      <p className="text-xs text-sage/60">
                        IP: {securityInfo.ipAddress} • {securityInfo.location}
                      </p>
                      <p className="text-xs text-sage/60">
                        Failed attempts: {securityInfo.failedAttempts}
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                  {/* Email Field */}
                  <div className="space-y-2">
                    <label htmlFor="email" className="block text-sm font-medium text-cream">
                      Admin Email
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="w-5 h-5 text-sage/50" />
                      </div>
                      <input
                        type="email"
                        id="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        disabled={isLoading}
                        className="w-full pl-10 pr-4 py-3 bg-navy-dark/30 border border-sage/20 rounded-lg text-cream placeholder-sage/50 focus:outline-none focus:ring-2 focus:ring-teal-primary focus:border-transparent transition-all"
                        placeholder="admin@lawlessdirectory.com"
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-2">
                    <label htmlFor="password" className="block text-sm font-medium text-cream">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="w-5 h-5 text-sage/50" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="password"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        disabled={isLoading}
                        className="w-full pl-10 pr-12 py-3 bg-navy-dark/30 border border-sage/20 rounded-lg text-cream placeholder-sage/50 focus:outline-none focus:ring-2 focus:ring-teal-primary focus:border-transparent transition-all"
                        placeholder="Enter your admin password"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-sage/50 hover:text-sage transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Security Options */}
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={formData.rememberDevice}
                        onChange={(e) => handleInputChange('rememberDevice', e.target.checked)}
                        className="w-4 h-4 text-teal-primary bg-navy-dark/30 border-sage/30 rounded focus:ring-teal-primary focus:ring-2"
                      />
                      <span className="text-sm text-cream">Remember this device for 7 days</span>
                    </label>

                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={formData.ipWhitelist}
                        onChange={(e) => handleInputChange('ipWhitelist', e.target.checked)}
                        className="w-4 h-4 text-teal-primary bg-navy-dark/30 border-sage/30 rounded focus:ring-teal-primary focus:ring-2"
                      />
                      <span className="text-sm text-cream">Add IP to whitelist</span>
                    </label>
                  </div>

                  {/* Error Message */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                      >
                        <div className="flex gap-2">
                          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-red-400">{error}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submit Button */}
                  <motion.button
                    type="submit"
                    disabled={isLoading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Authenticating...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <Shield className="w-4 h-4" />
                        Sign In to Admin Portal
                      </div>
                    )}
                  </motion.button>
                </form>

                {/* Footer Info */}
                <div className="mt-6 text-center space-y-2">
                  <p className="text-xs text-sage/60">
                    This is a secure admin portal. All access is logged and monitored.
                  </p>
                  <div className="flex items-center justify-center gap-4 text-xs text-sage/50">
                    <span className="flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      SSL Encrypted
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Session Timeout: 30min
                    </span>
                    <span className="flex items-center gap-1">
                      <Key className="w-3 h-3" />
                      MFA Required
                    </span>
                  </div>
                </div>
              </GlassMorphism>
            </motion.div>
          )}

          {/* MFA Step */}
          {step === 'mfa' && mfaChallenge && (
            <motion.div
              key="mfa"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.4 }}
            >
              <MFAVerification
                challenge={mfaChallenge}
                onSuccess={handleMFASuccess}
                onError={handleMFAError}
                onCancel={handleMFACancel}
                showTrustDevice={true}
                className="border border-red-500/20"
              />
            </motion.div>
          )}

          {/* Success Step */}
          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5 }}
            >
              <GlassMorphism
                variant="medium"
                className="p-8 text-center"
                animated
              >
                <div className="space-y-4">
                  <div className="inline-flex p-4 bg-green-500/10 rounded-full border border-green-500/20">
                    <CheckCircle className="w-12 h-12 text-green-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-cream">
                    Access Granted
                  </h3>
                  <p className="text-sage/70">
                    Redirecting to admin dashboard...
                  </p>
                  <div className="w-8 h-8 border-2 border-teal-primary border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              </GlassMorphism>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminLoginForm;