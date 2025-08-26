'use client';

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Hash, Type, Key, AlertCircle, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPasswordRequirements, getPasswordStrength } from './validations';
import type { PasswordStrengthProps, PasswordRequirement } from './types';

// Icon mapping for password requirements
const requirementIcons = {
  hash: Hash,
  type: Type,
  key: Key
} as const;

// Individual requirement item component
const RequirementItem: React.FC<{
  requirement: PasswordRequirement;
  index: number;
  isVisible: boolean;
}> = ({ requirement, index, isVisible }) => {
  const IconComponent = requirementIcons[requirement.icon as keyof typeof requirementIcons] || Hash;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: -10, height: 0 }}
          animate={{ opacity: 1, x: 0, height: 'auto' }}
          exit={{ opacity: 0, x: -10, height: 0 }}
          transition={{ 
            delay: index * 0.05,
            duration: 0.3,
            ease: 'easeOut'
          }}
          className={cn(
            'flex items-center gap-2 text-xs transition-colors duration-200',
            requirement.met ? 'text-sage' : 'text-sage/50'
          )}
        >
          <div className={cn(
            'flex-shrink-0 transition-colors duration-200',
            requirement.met ? 'text-sage' : 'text-sage/30'
          )}>
            <AnimatePresence mode="wait">
              {requirement.met ? (
                <motion.div
                  key="check"
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 90 }}
                  transition={{ duration: 0.2, type: 'spring', stiffness: 200 }}
                >
                  <Check className="w-3 h-3" />
                </motion.div>
              ) : (
                <motion.div
                  key="icon"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <IconComponent className="w-3 h-3" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <span className="select-none">{requirement.label}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Main password strength indicator
export const PasswordStrength: React.FC<PasswordStrengthProps> = ({
  password,
  showRequirements = true,
  className = ''
}) => {
  const requirements = useMemo(() => getPasswordRequirements(password), [password]);
  const strength = useMemo(() => getPasswordStrength(password), [password]);
  
  const shouldShow = password.length > 0;

  // Color classes for different strength levels
  const strengthColors = {
    'Weak': 'text-red-error',
    'Fair': 'text-gold-primary', 
    'Good': 'text-teal-primary',
    'Strong': 'text-sage'
  } as const;

  const strengthBgColors = {
    'Weak': 'from-red-error to-red-warning',
    'Fair': 'from-gold-secondary to-gold-primary',
    'Good': 'from-teal-secondary to-teal-primary', 
    'Strong': 'from-sage to-teal-primary'
  } as const;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={cn('space-y-3 overflow-hidden', className)}
        >
          {/* Strength header and progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-sage/70" />
                <span className="text-sm font-medium text-cream">
                  Password Strength
                </span>
              </div>
              <motion.span
                key={strength.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  'text-sm font-medium transition-colors',
                  strengthColors[strength.label]
                )}
              >
                {strength.label}
              </motion.span>
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-navy-50/20 rounded-full h-2 overflow-hidden">
              <motion.div
                className={cn('h-full bg-gradient-to-r', strengthBgColors[strength.label])}
                initial={{ width: 0 }}
                animate={{ width: `${strength.percentage}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>

            {/* Percentage indicator */}
            <div className="flex justify-end">
              <motion.span
                key={strength.score}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-sage/70"
              >
                {Math.round(strength.percentage)}% complete
              </motion.span>
            </div>
          </div>

          {/* Requirements list */}
          {showRequirements && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="space-y-2"
            >
              <div className="text-xs font-medium text-sage/80 mb-2">
                Requirements:
              </div>
              <div className="grid grid-cols-1 gap-1">
                {requirements.map((requirement, index) => (
                  <RequirementItem
                    key={requirement.label}
                    requirement={requirement}
                    index={index}
                    isVisible={shouldShow}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Strength description */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="pt-2 border-t border-sage/10"
          >
            <StrengthDescription strength={strength.label} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Strength description component
const StrengthDescription: React.FC<{
  strength: 'Weak' | 'Fair' | 'Good' | 'Strong';
}> = ({ strength }) => {
  const descriptions = {
    'Weak': {
      text: 'This password is too weak and could be easily guessed.',
      icon: AlertCircle,
      color: 'text-red-error/80'
    },
    'Fair': {
      text: 'This password is okay but could be stronger.',
      icon: AlertCircle,
      color: 'text-gold-primary/80'
    },
    'Good': {
      text: 'This password is good and reasonably secure.',
      icon: Shield,
      color: 'text-teal-primary/80'
    },
    'Strong': {
      text: 'Excellent! This password is very secure.',
      icon: Shield,
      color: 'text-sage/80'
    }
  } as const;

  const config = descriptions[strength];
  const Icon = config.icon;

  return (
    <motion.div
      key={strength}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2"
    >
      <Icon className={cn('w-3 h-3 mt-0.5 flex-shrink-0', config.color)} />
      <p className={cn('text-xs', config.color)}>
        {config.text}
      </p>
    </motion.div>
  );
};

// Compact password strength indicator (for smaller spaces)
export const PasswordStrengthCompact: React.FC<{
  password: string;
  className?: string;
}> = ({ password, className = '' }) => {
  const strength = useMemo(() => getPasswordStrength(password), [password]);
  
  if (password.length === 0) return null;

  const strengthColors = {
    'Weak': 'text-red-error',
    'Fair': 'text-gold-primary',
    'Good': 'text-teal-primary', 
    'Strong': 'text-sage'
  } as const;

  const strengthBgColors = {
    'Weak': 'from-red-error to-red-warning',
    'Fair': 'from-gold-secondary to-gold-primary',
    'Good': 'from-teal-secondary to-teal-primary',
    'Strong': 'from-sage to-teal-primary'
  } as const;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn('flex items-center gap-2', className)}
    >
      <div className="flex-1 bg-navy-50/20 rounded-full h-1 overflow-hidden">
        <motion.div
          className={cn('h-full bg-gradient-to-r', strengthBgColors[strength.label])}
          initial={{ width: 0 }}
          animate={{ width: `${strength.percentage}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <span className={cn(
        'text-xs font-medium',
        strengthColors[strength.label]
      )}>
        {strength.label}
      </span>
    </motion.div>
  );
};

// Password strength indicator with tips
export const PasswordStrengthWithTips: React.FC<PasswordStrengthProps & {
  showTips?: boolean;
}> = ({ password, showRequirements = true, showTips = true, className = '' }) => {
  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const requirements = useMemo(() => getPasswordRequirements(password), [password]);
  
  const getStrengthTips = () => {
    const unmetRequirements = requirements.filter(req => !req.met);
    if (unmetRequirements.length === 0) return [];

    const tips = [
      'Consider using a passphrase with multiple words',
      'Add numbers and special characters',
      'Mix uppercase and lowercase letters',
      'Avoid common words or personal information'
    ];

    return tips.slice(0, 2); // Show only 2 tips at a time
  };

  const tips = getStrengthTips();

  return (
    <div className={cn('space-y-4', className)}>
      <PasswordStrength 
        password={password}
        showRequirements={showRequirements}
      />
      
      {showTips && tips.length > 0 && password.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="p-3 bg-teal-primary/5 border border-teal-primary/10 rounded-lg"
        >
          <div className="flex items-start gap-2">
            <Key className="w-4 h-4 text-teal-primary/70 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-teal-primary/80 mb-1">
                Tips for a stronger password:
              </p>
              <ul className="space-y-1">
                {tips.map((tip, index) => (
                  <motion.li
                    key={tip}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="text-xs text-teal-primary/70 flex items-start gap-1"
                  >
                    <div className="w-1 h-1 bg-teal-primary/50 rounded-full mt-1.5 flex-shrink-0" />
                    {tip}
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default PasswordStrength;