'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Smartphone, 
  Monitor, 
  Settings, 
  CheckCircle,
  AlertTriangle,
  Eye,
  Palette
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '../GlassMorphism';
import { AuthModal, useAuthModal } from './AuthModal';
import { MobileAuthSheet, useMobileAuthSheet } from './MobileAuthSheet';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { 
  PasswordStrength, 
  PasswordStrengthCompact, 
  PasswordStrengthWithTips 
} from './PasswordStrength';
import { 
  SocialLoginButton, 
  SocialLoginGroup, 
  SocialLoginIconButton 
} from './SocialLoginButton';
import { 
  LoadingSpinner, 
  LoadingDots, 
  LoadingPulse, 
  ProgressBar, 
  StepProgress,
  ButtonWithLoading
} from './LoadingStates';
import { 
  ErrorMessage, 
  AuthError, 
  SuccessMessage 
} from './ErrorMessages';

interface AuthDemoProps {
  className?: string;
}

export const AuthDemo: React.FC<AuthDemoProps> = ({ className = '' }) => {
  const [activeDemo, setActiveDemo] = useState<string>('overview');
  const [isMobile, setIsMobile] = useState(false);
  const [demoPassword, setDemoPassword] = useState('');
  const [demoProgress, setDemoProgress] = useState(65);
  const [currentStep, setCurrentStep] = useState(2);
  const [isLoading, setIsLoading] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const authModal = useAuthModal();
  const mobileAuthSheet = useMobileAuthSheet();

  const handleMockAuth = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }, 2000);
  };

  const handleMockError = () => {
    setShowError(true);
    setTimeout(() => setShowError(false), 5000);
  };

  const demoSections = [
    {
      id: 'overview',
      name: 'Overview',
      icon: Eye,
      description: 'Complete authentication system showcase'
    },
    {
      id: 'forms',
      name: 'Forms',
      icon: Settings,
      description: 'Login and registration forms'
    },
    {
      id: 'components',
      name: 'Components',
      icon: Palette,
      description: 'Individual UI components'
    },
    {
      id: 'responsive',
      name: 'Mobile',
      icon: Smartphone,
      description: 'Mobile-optimized interfaces'
    }
  ];

  const renderOverview = () => (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-cream mb-4">
          Authentication UI Components
        </h2>
        <p className="text-sage/70 max-w-2xl mx-auto">
          A comprehensive set of authentication components built with Next.js, 
          Supabase, and glassmorphism design. Includes advanced validation, 
          accessibility features, and mobile-responsive design.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <GlassMorphism variant="medium" className="p-6" animated interactive>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-teal-primary/20 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-teal-primary" />
            </div>
            <h3 className="text-lg font-semibold text-cream">Key Features</h3>
          </div>
          <ul className="space-y-2 text-sm text-sage/70">
            <li>• Real-time form validation with Zod</li>
            <li>• Password strength indicators</li>
            <li>• Social authentication support</li>
            <li>• Multi-step registration process</li>
            <li>• WCAG 2.1 AA accessibility compliance</li>
            <li>• Mobile-responsive design</li>
            <li>• Glassmorphism aesthetic</li>
            <li>• Sophisticated loading states</li>
          </ul>
        </GlassMorphism>

        <GlassMorphism variant="medium" className="p-6" animated interactive>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gold-primary/20 rounded-lg flex items-center justify-center">
              <Play className="w-5 h-5 text-gold-primary" />
            </div>
            <h3 className="text-lg font-semibold text-cream">Quick Demo</h3>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => authModal.openLogin()}
              className="w-full px-4 py-2 bg-gradient-to-r from-teal-primary to-teal-secondary text-cream rounded-lg hover:shadow-lg transition-all"
            >
              Open Login Modal
            </button>
            <button
              onClick={() => authModal.openRegister()}
              className="w-full px-4 py-2 bg-sage/20 text-sage rounded-lg hover:bg-sage/30 transition-colors"
            >
              Open Registration Modal
            </button>
            <button
              onClick={() => setIsMobile(!isMobile)}
              className="w-full px-4 py-2 text-sage/70 hover:text-sage transition-colors text-sm border border-sage/20 rounded-lg"
            >
              {isMobile ? 'Desktop' : 'Mobile'} View
            </button>
          </div>
        </GlassMorphism>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="text-center p-4">
          <div className="w-12 h-12 bg-teal-primary/20 rounded-lg mx-auto mb-3 flex items-center justify-center">
            <Monitor className="w-6 h-6 text-teal-primary" />
          </div>
          <h4 className="font-semibold text-cream mb-1">Desktop Experience</h4>
          <p className="text-xs text-sage/70">Full-featured modal interfaces</p>
        </div>
        <div className="text-center p-4">
          <div className="w-12 h-12 bg-sage/20 rounded-lg mx-auto mb-3 flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-sage" />
          </div>
          <h4 className="font-semibold text-cream mb-1">Mobile Optimized</h4>
          <p className="text-xs text-sage/70">Touch-friendly sheet interfaces</p>
        </div>
        <div className="text-center p-4">
          <div className="w-12 h-12 bg-gold-primary/20 rounded-lg mx-auto mb-3 flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-gold-primary" />
          </div>
          <h4 className="font-semibold text-cream mb-1">Accessibility</h4>
          <p className="text-xs text-sage/70">WCAG 2.1 AA compliant</p>
        </div>
      </div>
    </div>
  );

  const renderForms = () => (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-cream mb-2">Authentication Forms</h2>
        <p className="text-sage/70">Complete login and registration forms with validation</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-semibold text-cream mb-4">Login Form</h3>
          <LoginForm
            showSocialLogin={true}
            showRememberMe={true}
            showForgotPassword={true}
            showSignUpLink={true}
          />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-cream mb-4">Registration Form</h3>
          <div className="max-h-[600px] overflow-y-auto">
            <RegisterForm
              showSocialLogin={true}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderComponents = () => (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-cream mb-2">UI Components</h2>
        <p className="text-sage/70">Individual components and utilities</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Password Strength */}
        <GlassMorphism variant="medium" className="p-6">
          <h3 className="text-lg font-semibold text-cream mb-4">Password Strength</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-cream mb-2">
                Test Password
              </label>
              <input
                type="password"
                value={demoPassword}
                onChange={(e) => setDemoPassword(e.target.value)}
                className="w-full px-3 py-2 bg-navy-dark/50 border border-sage/20 rounded-lg text-cream placeholder-sage/50 focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
                placeholder="Try: Test123!"
              />
            </div>
            <PasswordStrengthWithTips password={demoPassword} />
          </div>
        </GlassMorphism>

        {/* Social Login */}
        <GlassMorphism variant="medium" className="p-6">
          <h3 className="text-lg font-semibold text-cream mb-4">Social Login</h3>
          <div className="space-y-4">
            <SocialLoginGroup
              providers={['google', 'apple']}
              onSuccess={handleMockAuth}
              onError={handleMockError}
            />
            
            <div className="text-center">
              <p className="text-xs text-sage/70 mb-3">Icon variants</p>
              <div className="flex justify-center gap-2">
                <SocialLoginIconButton 
                  provider="google" 
                  onSuccess={handleMockAuth}
                  onError={handleMockError}
                />
                <SocialLoginIconButton 
                  provider="apple" 
                  onSuccess={handleMockAuth}
                  onError={handleMockError}
                />
                <SocialLoginIconButton 
                  provider="facebook" 
                  onSuccess={handleMockAuth}
                  onError={handleMockError}
                />
              </div>
            </div>
          </div>
        </GlassMorphism>

        {/* Loading States */}
        <GlassMorphism variant="medium" className="p-6">
          <h3 className="text-lg font-semibold text-cream mb-4">Loading States</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <LoadingSpinner size="sm" />
              <LoadingSpinner size="md" />
              <LoadingSpinner size="lg" />
            </div>
            
            <div className="flex items-center gap-4">
              <LoadingDots size="sm" className="text-teal-primary" />
              <LoadingPulse size="md" />
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-cream">Progress</span>
                <span className="text-sage/70">{demoProgress}%</span>
              </div>
              <ProgressBar 
                progress={demoProgress} 
                variant="default" 
                showPercentage={false}
              />
              <div className="flex gap-2 mt-2">
                <button 
                  onClick={() => setDemoProgress(Math.max(0, demoProgress - 10))}
                  className="px-2 py-1 text-xs bg-sage/20 text-sage rounded"
                >
                  -10%
                </button>
                <button 
                  onClick={() => setDemoProgress(Math.min(100, demoProgress + 10))}
                  className="px-2 py-1 text-xs bg-sage/20 text-sage rounded"
                >
                  +10%
                </button>
              </div>
            </div>

            <div>
              <p className="text-sm text-cream mb-2">Step Progress</p>
              <StepProgress 
                currentStep={currentStep} 
                totalSteps={3} 
              />
              <div className="flex gap-2 mt-2">
                <button 
                  onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                  className="px-2 py-1 text-xs bg-sage/20 text-sage rounded"
                >
                  Prev
                </button>
                <button 
                  onClick={() => setCurrentStep(Math.min(3, currentStep + 1))}
                  className="px-2 py-1 text-xs bg-sage/20 text-sage rounded"
                >
                  Next
                </button>
              </div>
            </div>

            <ButtonWithLoading
              isLoading={isLoading}
              loadingText="Authenticating..."
              onClick={() => {
                setIsLoading(true);
                setTimeout(() => setIsLoading(false), 3000);
              }}
              variant="primary"
              className="w-full"
            >
              Test Loading Button
            </ButtonWithLoading>
          </div>
        </GlassMorphism>

        {/* Error & Success Messages */}
        <GlassMorphism variant="medium" className="p-6">
          <h3 className="text-lg font-semibold text-cream mb-4">Messages</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <button
                onClick={handleMockError}
                className="w-full px-3 py-2 bg-red-error/20 text-red-error rounded-lg text-sm"
              >
                Show Error Message
              </button>
              <button
                onClick={() => {
                  setShowSuccess(true);
                  setTimeout(() => setShowSuccess(false), 3000);
                }}
                className="w-full px-3 py-2 bg-sage/20 text-sage rounded-lg text-sm"
              >
                Show Success Message
              </button>
            </div>

            <AnimatePresence>
              {showError && (
                <AuthError
                  error="Invalid login credentials. Please check your email and password."
                  onDismiss={() => setShowError(false)}
                />
              )}
              {showSuccess && (
                <SuccessMessage
                  message="Authentication successful! Welcome back."
                  onDismiss={() => setShowSuccess(false)}
                />
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <ErrorMessage
                message="This is a warning message"
                variant="warning"
                size="sm"
              />
              <ErrorMessage
                message="This is an info message"
                variant="info"
                size="sm"
              />
            </div>
          </div>
        </GlassMorphism>
      </div>
    </div>
  );

  const renderMobile = () => (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-cream mb-2">Mobile Experience</h2>
        <p className="text-sage/70">Touch-optimized authentication interfaces</p>
      </div>

      <div className="flex justify-center gap-4">
        <button
          onClick={() => mobileAuthSheet.openLogin()}
          className="px-6 py-3 bg-gradient-to-r from-teal-primary to-teal-secondary text-cream rounded-lg hover:shadow-lg transition-all"
        >
          Open Mobile Login
        </button>
        <button
          onClick={() => mobileAuthSheet.openRegister()}
          className="px-6 py-3 bg-sage/20 text-sage rounded-lg hover:bg-sage/30 transition-colors"
        >
          Open Mobile Registration
        </button>
      </div>

      <GlassMorphism variant="medium" className="p-6 max-w-md mx-auto">
        <h3 className="text-lg font-semibold text-cream mb-4 text-center">
          Mobile Features
        </h3>
        <ul className="space-y-3 text-sm text-sage/70">
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-sage flex-shrink-0" />
            Bottom sheet interface with drag-to-dismiss
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-sage flex-shrink-0" />
            Touch-optimized form controls
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-sage flex-shrink-0" />
            Proper keyboard handling on mobile
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-sage flex-shrink-0" />
            Safe area support for iOS devices
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-sage flex-shrink-0" />
            Prevents background scrolling
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-sage flex-shrink-0" />
            Accessibility features maintained
          </li>
        </ul>
      </GlassMorphism>
    </div>
  );

  const renderActiveDemo = () => {
    switch (activeDemo) {
      case 'overview': return renderOverview();
      case 'forms': return renderForms();
      case 'components': return renderComponents();
      case 'responsive': return renderMobile();
      default: return renderOverview();
    }
  };

  return (
    <div className={cn('min-h-screen bg-navy-dark py-12', className)}>
      <div className="container mx-auto px-4">
        {/* Navigation */}
        <div className="mb-12">
          <div className="flex flex-wrap justify-center gap-4">
            {demoSections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveDemo(section.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200',
                    'text-sm font-medium',
                    activeDemo === section.id
                      ? 'bg-gradient-to-r from-teal-primary to-teal-secondary text-cream shadow-lg'
                      : 'bg-sage/10 text-sage/70 hover:bg-sage/20 hover:text-sage'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {section.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Demo Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeDemo}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderActiveDemo()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Modals */}
      <AuthModal
        isOpen={authModal.isOpen}
        onClose={authModal.close}
        mode={authModal.mode}
        onModeChange={authModal.changeMode}
      />

      <MobileAuthSheet
        isOpen={mobileAuthSheet.isOpen}
        onClose={mobileAuthSheet.close}
        mode={mobileAuthSheet.mode}
        onModeChange={mobileAuthSheet.changeMode}
      />
    </div>
  );
};

export default AuthDemo;