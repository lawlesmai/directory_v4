'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, Copy, Check, Eye, EyeOff, Smartphone, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '@/components/GlassMorphism';
import { TOTPCodeInput } from './CodeInput';
import { TOTPSetupProps, TOTPSetupData } from './types';

// QR Code component using inline SVG generation
const QRCodeDisplay: React.FC<{ 
  value: string; 
  size?: number;
  className?: string;
}> = ({ value, size = 200, className }) => {
  const [qrCodeSvg, setQrCodeSvg] = useState<string>('');
  
  useEffect(() => {
    // Generate QR code SVG (simplified for demo - in production use qrcode library)
    const generateQRCode = async () => {
      // This is a placeholder - in production, use a library like 'qrcode'
      // For now, we'll create a placeholder pattern
      const svg = `
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${size}" height="${size}" fill="white"/>
          <rect x="10" y="10" width="${size-20}" height="${size-20}" fill="none" stroke="#1a2332" stroke-width="2"/>
          <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="12" fill="#1a2332">QR Code</text>
          <text x="50%" y="60%" text-anchor="middle" dy=".3em" font-size="8" fill="#666">Scan with authenticator</text>
        </svg>
      `;
      setQrCodeSvg(svg);
    };
    
    generateQRCode();
  }, [value, size]);
  
  return (
    <div className={cn('relative inline-block', className)}>
      <div 
        className="bg-white p-4 rounded-lg"
        dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-white/10 to-transparent pointer-events-none rounded-lg" />
    </div>
  );
};

export const TOTPSetup: React.FC<TOTPSetupProps> = ({
  userId,
  onSetupComplete,
  onError,
  showManualEntry = true,
  className = ''
}) => {
  const [step, setStep] = useState<'display' | 'verify'>('display');
  const [setupData, setSetupData] = useState<TOTPSetupData | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationError, setVerificationError] = useState(false);
  const [verificationAttempts, setVerificationAttempts] = useState(0);

  // Generate TOTP setup data
  useEffect(() => {
    const generateSetupData = async () => {
      setIsLoading(true);
      try {
        // In production, this would be an API call to generate TOTP secret
        // For demo purposes, we'll use mock data
        const mockData: TOTPSetupData = {
          secret: 'JBSWY3DPEHPK3PXP',
          qrCodeUrl: `otpauth://totp/LawlessDirectory:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=LawlessDirectory`,
          manualEntryKey: 'JBSW Y3DP EHPK 3PXP',
          issuer: 'Lawless Directory',
          accountName: 'user@example.com'
        };
        setSetupData(mockData);
      } catch (error) {
        onError('Failed to generate TOTP setup data');
      } finally {
        setIsLoading(false);
      }
    };
    
    generateSetupData();
  }, [userId, onError]);

  // Copy secret to clipboard
  const copySecret = async () => {
    if (setupData?.manualEntryKey) {
      try {
        await navigator.clipboard.writeText(setupData.manualEntryKey.replace(/\s/g, ''));
        setSecretCopied(true);
        setTimeout(() => setSecretCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  // Handle verification
  const handleVerification = async (code: string) => {
    setIsLoading(true);
    setVerificationError(false);
    
    try {
      // In production, verify the TOTP code with the backend
      // For demo, accept '123456'
      if (code === '123456') {
        // Success animation
        await new Promise(resolve => setTimeout(resolve, 500));
        onSetupComplete('mock-factor-id');
      } else {
        setVerificationError(true);
        setVerificationAttempts(prev => prev + 1);
        
        if (verificationAttempts >= 2) {
          onError('Too many failed attempts. Please try again.');
        }
      }
    } catch (error) {
      onError('Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Regenerate QR code
  const regenerateQRCode = () => {
    setStep('display');
    setVerificationAttempts(0);
    setVerificationError(false);
    // Trigger data regeneration
    setSetupData(null);
  };

  return (
    <GlassMorphism
      variant="medium"
      className={cn('p-6 sm:p-8 max-w-md mx-auto', className)}
      animated
    >
      <AnimatePresence mode="wait">
        {step === 'display' ? (
          <motion.div
            key="display"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-teal-primary/10 rounded-full mb-2">
                <Smartphone className="w-8 h-8 text-teal-primary" />
              </div>
              <h2 className="text-2xl font-bold text-cream">
                Set Up Authenticator App
              </h2>
              <p className="text-sage/70 text-sm">
                Scan the QR code below with your authenticator app
              </p>
            </div>

            {/* QR Code */}
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-48 h-48 bg-navy-dark/30 rounded-lg animate-pulse" />
              </div>
            ) : setupData ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center space-y-4"
              >
                <QRCodeDisplay 
                  value={setupData.qrCodeUrl} 
                  size={200}
                  className="shadow-xl"
                />
                
                {/* App Suggestions */}
                <div className="text-center space-y-1">
                  <p className="text-xs text-sage/50">Popular authenticator apps:</p>
                  <p className="text-xs text-sage/70">
                    Google Authenticator • Microsoft Authenticator • Authy
                  </p>
                </div>
              </motion.div>
            ) : null}

            {/* Manual Entry Option */}
            {showManualEntry && setupData && (
              <div className="space-y-3">
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-navy-dark/30 hover:bg-navy-dark/40 transition-colors"
                >
                  <span className="text-sm text-sage/70">
                    Can't scan? Enter code manually
                  </span>
                  {showSecret ? (
                    <EyeOff className="w-4 h-4 text-sage/50" />
                  ) : (
                    <Eye className="w-4 h-4 text-sage/50" />
                  )}
                </button>
                
                <AnimatePresence>
                  {showSecret && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 bg-navy-dark/20 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <code className="text-sm font-mono text-cream">
                            {setupData.manualEntryKey}
                          </code>
                          <button
                            onClick={copySecret}
                            className="p-2 hover:bg-navy-dark/30 rounded-lg transition-colors"
                            aria-label="Copy secret key"
                          >
                            {secretCopied ? (
                              <Check className="w-4 h-4 text-teal-primary" />
                            ) : (
                              <Copy className="w-4 h-4 text-sage/50" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-sage/50">
                          Enter this code in your authenticator app
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Continue Button */}
            <button
              onClick={() => setStep('verify')}
              disabled={!setupData || isLoading}
              className={cn(
                'w-full px-6 py-3 rounded-lg font-medium transition-all duration-200',
                'bg-gradient-to-r from-teal-primary to-teal-secondary text-cream',
                'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
                'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                'focus:ring-offset-2 focus:ring-offset-navy-dark',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
              )}
            >
              I've Added the Account
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="verify"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-teal-primary/10 rounded-full mb-2">
                <QrCode className="w-8 h-8 text-teal-primary" />
              </div>
              <h2 className="text-2xl font-bold text-cream">
                Verify Setup
              </h2>
              <p className="text-sage/70 text-sm">
                Enter the code from your authenticator app to complete setup
              </p>
            </div>

            {/* Code Input */}
            <div className="py-4">
              <TOTPCodeInput
                onComplete={handleVerification}
                error={verificationError}
                disabled={isLoading}
              />
            </div>

            {/* Error Message */}
            <AnimatePresence>
              {verificationError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                >
                  <p className="text-sm text-red-400 text-center">
                    Invalid code. Please try again.
                    {verificationAttempts > 1 && (
                      <span className="block mt-1 text-xs">
                        {3 - verificationAttempts} attempts remaining
                      </span>
                    )}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep('display')}
                disabled={isLoading}
                className="flex-1 px-4 py-3 rounded-lg border border-sage/20 text-sage/70 hover:text-cream hover:border-sage/40 transition-colors disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={regenerateQRCode}
                disabled={isLoading}
                className="p-3 rounded-lg border border-sage/20 text-sage/70 hover:text-cream hover:border-sage/40 transition-colors disabled:opacity-50"
                aria-label="Regenerate QR code"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            {/* Help Text */}
            <div className="text-center">
              <p className="text-xs text-sage/50">
                Having trouble? Make sure your device's time is synced correctly.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassMorphism>
  );
};

export default TOTPSetup;