'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Key, Mail, Phone, Shield, MessageSquare, Copy, 
  Download, Check, Plus, Trash2, AlertCircle,
  ChevronRight, RefreshCw, Lock, Info
} from 'lucide-react';
import { GlassMorphism } from '../GlassMorphism';
import { cn } from '@/lib/utils';

type RecoveryMethod = {
  id: string;
  type: 'email' | 'phone' | 'backup-codes' | 'security-questions';
  value: string;
  verified: boolean;
  isPrimary?: boolean;
  lastUsed?: Date;
};

type SecurityQuestion = {
  id: string;
  question: string;
  answer?: string;
  createdAt: Date;
};

interface AccountRecoveryProps {
  onUpdate?: () => void;
  className?: string;
}

export const AccountRecovery: React.FC<AccountRecoveryProps> = ({
  onUpdate,
  className = ''
}) => {
  const [activeMethod, setActiveMethod] = useState<RecoveryMethod['type'] | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Mock data - replace with real data
  const [recoveryMethods, setRecoveryMethods] = useState<RecoveryMethod[]>([
    {
      id: '1',
      type: 'email',
      value: 'user@example.com',
      verified: true,
      isPrimary: true
    },
    {
      id: '2',
      type: 'phone',
      value: '+1 (555) 123-4567',
      verified: false
    }
  ]);

  const [securityQuestions, setSecurityQuestions] = useState<SecurityQuestion[]>([
    {
      id: '1',
      question: 'What was your first pet\'s name?',
      answer: '••••••',
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    }
  ]);

  const generateBackupCodes = useCallback(async () => {
    setIsGenerating(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate random backup codes
      const codes = Array.from({ length: 10 }, () => 
        Array.from({ length: 8 }, () => 
          'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]
        ).join('')
      );
      
      setBackupCodes(codes);
      setShowBackupCodes(true);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const copyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }, []);

  const downloadBackupCodes = useCallback(() => {
    const content = backupCodes.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [backupCodes]);

  const methodConfig = {
    email: {
      icon: Mail,
      title: 'Email Recovery',
      description: 'Recover your account using your email address',
      color: 'teal-primary'
    },
    phone: {
      icon: Phone,
      title: 'SMS Recovery',
      description: 'Get verification codes via text message',
      color: 'sage'
    },
    'backup-codes': {
      icon: Key,
      title: 'Backup Codes',
      description: 'One-time use codes for emergency access',
      color: 'gold-primary'
    },
    'security-questions': {
      icon: MessageSquare,
      title: 'Security Questions',
      description: 'Answer personal questions to verify identity',
      color: 'cream'
    }
  };

  const renderMethodCard = (method: RecoveryMethod['type']) => {
    const config = methodConfig[method];
    const Icon = config.icon;
    const isActive = recoveryMethods.some(m => m.type === method);
    const methodData = recoveryMethods.find(m => m.type === method);

    return (
      <motion.div
        key={method}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02 }}
        className={cn(
          'relative p-4 rounded-lg cursor-pointer transition-all duration-200',
          'border hover:shadow-lg',
          activeMethod === method
            ? 'bg-gradient-to-br from-teal-primary/20 to-sage/20 border-teal-primary/30'
            : isActive
            ? 'bg-navy-50/20 border-sage/30'
            : 'bg-navy-50/10 border-sage/10 opacity-75'
        )}
        onClick={() => setActiveMethod(method)}
      >
        <div className="flex items-start gap-4">
          <div className={cn(
            'p-2 rounded-full',
            isActive ? `bg-${config.color}/20` : 'bg-navy-50/20'
          )}>
            <Icon className={cn(
              'w-5 h-5',
              isActive ? `text-${config.color}` : 'text-sage/50'
            )} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-cream">{config.title}</h4>
              {methodData?.isPrimary && (
                <span className="px-2 py-0.5 text-xs font-medium text-teal-primary bg-teal-primary/20 rounded">
                  Primary
                </span>
              )}
            </div>
            <p className="text-xs text-sage/70 mt-1">{config.description}</p>
            {methodData && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-cream/80">{methodData.value}</span>
                {methodData.verified ? (
                  <Check className="w-3 h-3 text-sage" />
                ) : (
                  <span className="text-xs text-gold-primary">Unverified</span>
                )}
              </div>
            )}
          </div>
          {isActive && (
            <ChevronRight className="w-4 h-4 text-sage/50" />
          )}
        </div>

        {!isActive && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Add method logic
            }}
            className="absolute top-4 right-4 p-1.5 text-sage/50 hover:text-sage 
                     bg-navy-50/20 rounded hover:bg-navy-50/30 transition-all"
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
      </motion.div>
    );
  };

  const renderBackupCodes = () => (
    <GlassMorphism
      variant="subtle"
      className="p-6"
      tint="cool"
      border
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-cream">Backup Codes</h3>
          <p className="text-sm text-sage/70 mt-1">
            Save these codes in a secure place. Each code can only be used once.
          </p>
        </div>
        {backupCodes.length > 0 && (
          <button
            onClick={generateBackupCodes}
            disabled={isGenerating}
            className="px-3 py-1.5 text-xs font-medium text-gold-primary bg-gold-primary/20 
                     rounded hover:bg-gold-primary/30 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3 h-3', isGenerating && 'animate-spin')} />
          </button>
        )}
      </div>

      {backupCodes.length === 0 ? (
        <div className="text-center py-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-navy-50/20 rounded-full">
              <Key className="w-8 h-8 text-sage/50" />
            </div>
          </div>
          <p className="text-sm text-sage/70 mb-4">
            No backup codes generated yet
          </p>
          <button
            onClick={generateBackupCodes}
            disabled={isGenerating}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg',
              'flex items-center justify-center gap-2 mx-auto',
              'bg-gradient-to-r from-teal-primary to-teal-secondary',
              'text-white hover:shadow-lg transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Key className="w-4 h-4" />
                Generate Backup Codes
              </>
            )}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {backupCodes.map((code, index) => (
              <motion.div
                key={code}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="relative group"
              >
                <div className={cn(
                  'p-3 bg-navy-dark/50 rounded-lg font-mono text-sm',
                  'flex items-center justify-between transition-all duration-200',
                  'hover:bg-navy-dark/70'
                )}>
                  <span className={showBackupCodes ? 'text-cream' : 'text-sage/50'}>
                    {showBackupCodes ? code : '••••••••'}
                  </span>
                  <button
                    onClick={() => copyCode(code)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {copiedCode === code ? (
                      <Check className="w-4 h-4 text-sage" />
                    ) : (
                      <Copy className="w-4 h-4 text-sage/50 hover:text-sage" />
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowBackupCodes(!showBackupCodes)}
              className="flex-1 px-3 py-2 text-sm font-medium text-sage 
                       bg-navy-50/20 border border-sage/20 rounded-lg
                       hover:bg-navy-50/30 transition-all duration-200"
            >
              {showBackupCodes ? 'Hide Codes' : 'Show Codes'}
            </button>
            <button
              onClick={downloadBackupCodes}
              className="flex-1 px-3 py-2 text-sm font-medium text-cream
                       bg-teal-primary/20 border border-teal-primary/30 rounded-lg
                       hover:bg-teal-primary/30 transition-all duration-200
                       flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>

          <div className="mt-4 p-3 bg-gold-primary/10 border border-gold-primary/30 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-gold-primary flex-shrink-0 mt-0.5" />
              <div className="text-xs text-gold-primary/90">
                <p className="font-medium mb-1">Important</p>
                <p>Store these codes securely. You won't be able to see them again after leaving this page.</p>
              </div>
            </div>
          </div>
        </>
      )}
    </GlassMorphism>
  );

  const renderSecurityQuestions = () => (
    <GlassMorphism
      variant="subtle"
      className="p-6"
      tint="warm"
      border
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-cream">Security Questions</h3>
          <p className="text-sm text-sage/70 mt-1">
            Answer these questions to verify your identity
          </p>
        </div>
        <button
          className="px-3 py-1.5 text-xs font-medium text-cream bg-sage/20 
                   rounded hover:bg-sage/30 transition-colors"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {securityQuestions.length === 0 ? (
        <div className="text-center py-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-navy-50/20 rounded-full">
              <MessageSquare className="w-8 h-8 text-sage/50" />
            </div>
          </div>
          <p className="text-sm text-sage/70 mb-4">
            No security questions configured
          </p>
          <button className="px-4 py-2 text-sm font-medium text-white rounded-lg
                           bg-gradient-to-r from-teal-primary to-teal-secondary
                           hover:shadow-lg transition-all duration-200">
            Add Security Questions
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {securityQuestions.map((question) => (
            <div
              key={question.id}
              className="p-4 bg-navy-50/10 rounded-lg hover:bg-navy-50/20 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-cream">{question.question}</p>
                  <p className="text-xs text-sage/50 mt-1">
                    Answer: {question.answer} • Set {Math.floor((Date.now() - question.createdAt.getTime()) / (1000 * 60 * 60 * 24))} days ago
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="p-1.5 text-sage/50 hover:text-sage transition-colors">
                    <Lock className="w-3 h-3" />
                  </button>
                  <button className="p-1.5 text-red-error/50 hover:text-red-error transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 p-3 bg-teal-primary/10 border border-teal-primary/30 rounded-lg">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-teal-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-teal-primary/90">
            Security questions provide an additional way to recover your account. Choose questions only you can answer.
          </p>
        </div>
      </div>
    </GlassMorphism>
  );

  return (
    <GlassMorphism
      variant="medium"
      className={cn('w-full max-w-3xl mx-auto p-6', className)}
      animated
      border
      shadow
    >
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-gradient-to-br from-teal-primary/20 to-sage/20 rounded-full">
            <Shield className="w-8 h-8 text-sage" />
          </div>
        </div>
        <h2 className="text-2xl font-semibold text-cream mb-2">
          Account Recovery Setup
        </h2>
        <p className="text-sm text-sage/70">
          Configure multiple ways to recover your account
        </p>
      </div>

      {/* Recovery Methods Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {(['email', 'phone', 'backup-codes', 'security-questions'] as RecoveryMethod['type'][]).map(renderMethodCard)}
      </div>

      {/* Active Method Details */}
      <AnimatePresence mode="wait">
        {activeMethod === 'backup-codes' && (
          <motion.div
            key="backup-codes"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {renderBackupCodes()}
          </motion.div>
        )}
        
        {activeMethod === 'security-questions' && (
          <motion.div
            key="security-questions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {renderSecurityQuestions()}
          </motion.div>
        )}

        {activeMethod === 'email' && (
          <motion.div
            key="email"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <GlassMorphism variant="subtle" className="p-6" tint="cool" border>
              <h3 className="text-lg font-semibold text-cream mb-4">Email Recovery</h3>
              <p className="text-sm text-sage/70 mb-4">
                Add alternative email addresses for account recovery
              </p>
              {/* Email management UI */}
            </GlassMorphism>
          </motion.div>
        )}

        {activeMethod === 'phone' && (
          <motion.div
            key="phone"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <GlassMorphism variant="subtle" className="p-6" tint="neutral" border>
              <h3 className="text-lg font-semibold text-cream mb-4">SMS Recovery</h3>
              <p className="text-sm text-sage/70 mb-4">
                Add phone numbers to receive verification codes via SMS
              </p>
              {/* Phone management UI */}
            </GlassMorphism>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Security Tips */}
      <div className="mt-8 p-4 bg-navy-50/10 rounded-lg border border-sage/10">
        <h4 className="text-sm font-semibold text-cream mb-2">Recovery Best Practices</h4>
        <ul className="space-y-1">
          <li className="text-xs text-sage/70 flex items-start gap-2">
            <div className="w-1 h-1 bg-sage/50 rounded-full mt-1.5 flex-shrink-0" />
            Set up at least 2 different recovery methods
          </li>
          <li className="text-xs text-sage/70 flex items-start gap-2">
            <div className="w-1 h-1 bg-sage/50 rounded-full mt-1.5 flex-shrink-0" />
            Keep recovery information up to date
          </li>
          <li className="text-xs text-sage/70 flex items-start gap-2">
            <div className="w-1 h-1 bg-sage/50 rounded-full mt-1.5 flex-shrink-0" />
            Store backup codes in a secure location
          </li>
          <li className="text-xs text-sage/70 flex items-start gap-2">
            <div className="w-1 h-1 bg-sage/50 rounded-full mt-1.5 flex-shrink-0" />
            Never share recovery codes or security answers
          </li>
        </ul>
      </div>
    </GlassMorphism>
  );
};

export default AccountRecovery;