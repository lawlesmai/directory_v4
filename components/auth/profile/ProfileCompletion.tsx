'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Star,
  Target,
  CheckCircle,
  Circle,
  ChevronRight,
  Camera,
  User,
  Mail,
  Phone,
  MapPin,
  FileText,
  Link as LinkIcon,
  Shield,
  Award,
  TrendingUp,
  Users,
  Sparkles,
  Gift,
  Zap,
  Crown
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { GlassMorphism } from '@/components/GlassMorphism';
import { cn } from '@/lib/utils';
import type { UserProfile } from '../types';

// Achievement levels and rewards
interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  requiredPercentage: number;
  rewards: string[];
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'profile-starter',
    title: 'Profile Starter',
    description: 'Complete your basic profile information',
    icon: User,
    color: 'teal',
    requiredPercentage: 25,
    rewards: ['Profile visibility boost', 'Welcome badge'],
  },
  {
    id: 'social-connector',
    title: 'Social Connector',
    description: 'Add profile photo and social links',
    icon: LinkIcon,
    color: 'blue',
    requiredPercentage: 50,
    rewards: ['2x profile views', 'Social media integration'],
  },
  {
    id: 'community-member',
    title: 'Community Member',
    description: 'Complete contact info and privacy settings',
    icon: Users,
    color: 'purple',
    requiredPercentage: 75,
    rewards: ['Featured in directory', 'Priority support'],
  },
  {
    id: 'profile-master',
    title: 'Profile Master',
    description: 'Complete your entire profile',
    icon: Crown,
    color: 'gold',
    requiredPercentage: 100,
    rewards: ['Profile Master badge', '5x engagement boost', 'Premium features preview'],
  },
];

// Profile completion steps
interface CompletionStep {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  weight: number;
  isCompleted: (profile: UserProfile | null) => boolean;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

const COMPLETION_STEPS: CompletionStep[] = [
  {
    id: 'basic-info',
    label: 'Basic Information',
    description: 'Add your name and account type',
    icon: User,
    weight: 20,
    isCompleted: (profile) => !!(profile?.firstName && profile?.lastName),
    action: { label: 'Complete Profile', href: '/profile/edit?tab=basic' },
  },
  {
    id: 'profile-photo',
    label: 'Profile Photo',
    description: 'Upload a profile picture',
    icon: Camera,
    weight: 15,
    isCompleted: (profile) => !!profile?.avatar,
    action: { label: 'Upload Photo', href: '/profile/edit?tab=basic' },
  },
  {
    id: 'contact-info',
    label: 'Contact Information',
    description: 'Add your email and phone number',
    icon: Mail,
    weight: 15,
    isCompleted: (profile) => !!(profile?.email && profile?.phone),
    action: { label: 'Add Contact Info', href: '/profile/edit?tab=contact' },
  },
  {
    id: 'location',
    label: 'Location',
    description: 'Share your location to connect with local businesses',
    icon: MapPin,
    weight: 10,
    isCompleted: (profile) => !!profile?.location,
    action: { label: 'Add Location', href: '/profile/edit?tab=contact' },
  },
  {
    id: 'bio',
    label: 'Bio & Description',
    description: 'Tell others about yourself',
    icon: FileText,
    weight: 10,
    isCompleted: (profile) => !!(profile?.bio && profile.bio.length >= 20),
    action: { label: 'Write Bio', href: '/profile/edit?tab=basic' },
  },
  {
    id: 'social-links',
    label: 'Social Links',
    description: 'Connect your social media accounts',
    icon: LinkIcon,
    weight: 15,
    isCompleted: (profile) => {
      const links = profile?.socialLinks;
      return !!(links && (links.twitter || links.linkedin || links.instagram || links.facebook));
    },
    action: { label: 'Add Social Links', href: '/profile/edit?tab=social' },
  },
  {
    id: 'privacy-settings',
    label: 'Privacy Settings',
    description: 'Configure your privacy preferences',
    icon: Shield,
    weight: 10,
    isCompleted: (profile) => !!profile?.preferences?.privacy,
    action: { label: 'Set Privacy', href: '/profile/privacy' },
  },
  {
    id: 'email-verification',
    label: 'Email Verification',
    description: 'Verify your email address for security',
    icon: Mail,
    weight: 5,
    isCompleted: (profile) => !!profile?.isEmailVerified,
    action: { label: 'Verify Email' },
  },
];

// Confetti animation component
const ConfettiAnimation: React.FC<{ show: boolean }> = ({ show }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {Array.from({ length: 50 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{
            x: Math.random() * window.innerWidth,
            y: -20,
            opacity: 1,
            rotate: 0,
          }}
          animate={{
            y: window.innerHeight + 20,
            opacity: 0,
            rotate: 360,
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            delay: Math.random() * 2,
          }}
          className={cn(
            'absolute w-3 h-3 rounded',
            ['bg-teal-primary', 'bg-gold-primary', 'bg-red-error', 'bg-sage', 'bg-cream'][i % 5]
          )}
          style={{
            left: Math.random() * window.innerWidth,
          }}
        />
      ))}
    </div>
  );
};

// Achievement notification
const AchievementNotification: React.FC<{
  achievement: Achievement;
  isVisible: boolean;
  onClose: () => void;
}> = ({ achievement, isVisible, onClose }) => {
  const Icon = achievement.icon;

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, 5000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -100, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -100, scale: 0.8 }}
          className="fixed top-6 right-6 z-50 w-96"
        >
          <GlassMorphism variant="strong" className="p-6 border border-gold-primary/30">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="flex items-start gap-4"
            >
              <div className={cn(
                'p-3 rounded-full flex-shrink-0',
                `bg-${achievement.color}-primary/20`
              )}>
                <Icon className={cn('w-6 h-6', `text-${achievement.color}-primary`)} />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="w-4 h-4 text-gold-primary" />
                  <span className="font-semibold text-cream">Achievement Unlocked!</span>
                </div>
                <h4 className="font-medium text-cream mb-1">{achievement.title}</h4>
                <p className="text-sm text-sage/70 mb-3">{achievement.description}</p>
                
                <div className="space-y-1">
                  <p className="text-xs text-gold-primary font-medium">Rewards:</p>
                  {achievement.rewards.map((reward, index) => (
                    <p key={index} className="text-xs text-sage/60 flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      {reward}
                    </p>
                  ))}
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="text-sage/50 hover:text-sage/70 transition-colors"
              >
                <span className="sr-only">Close</span>
                ×
              </button>
            </motion.div>
          </GlassMorphism>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Progress ring component
const ProgressRing: React.FC<{
  progress: number;
  size: number;
  strokeWidth: number;
  className?: string;
}> = ({ progress, size, strokeWidth, className }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn('relative', className)}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(148, 210, 189, 0.2)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(0, 95, 115)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
          className="text-center"
        >
          <div className="text-2xl font-bold text-cream">{Math.round(progress)}%</div>
          <div className="text-xs text-sage/70">Complete</div>
        </motion.div>
      </div>
    </div>
  );
};

// Step component
const CompletionStepItem: React.FC<{
  step: CompletionStep;
  profile: UserProfile | null;
  onAction?: () => void;
}> = ({ step, profile, onAction }) => {
  const Icon = step.icon;
  const isCompleted = step.isCompleted(profile);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'flex items-center justify-between p-4 rounded-lg border transition-all',
        isCompleted 
          ? 'bg-teal-primary/10 border-teal-primary/30' 
          : 'bg-navy-50/20 border-sage/20 hover:border-sage/30'
      )}
    >
      <div className="flex items-center gap-4">
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center',
          isCompleted ? 'bg-teal-primary text-cream' : 'bg-sage/20 text-sage/70'
        )}>
          {isCompleted ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <Icon className="w-5 h-5" />
          )}
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={cn(
              'font-medium',
              isCompleted ? 'text-cream' : 'text-sage/80'
            )}>
              {step.label}
            </h4>
            {isCompleted && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                <div className="px-2 py-0.5 bg-teal-primary/20 text-teal-primary text-xs rounded-full">
                  +{step.weight}%
                </div>
              </motion.div>
            )}
          </div>
          <p className="text-sm text-sage/60">{step.description}</p>
        </div>
      </div>
      
      {!isCompleted && step.action && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onAction || (() => {
            if (step.action?.href) {
              window.location.href = step.action.href;
            }
          })}
          className="flex items-center gap-2 px-3 py-1.5 bg-teal-primary hover:bg-teal-secondary text-cream rounded-lg text-sm font-medium transition-colors"
        >
          {step.action.label}
          <ChevronRight className="w-3 h-3" />
        </motion.button>
      )}
    </motion.div>
  );
};

// Achievement showcase
const AchievementShowcase: React.FC<{
  achievements: Achievement[];
  currentPercentage: number;
}> = ({ achievements, currentPercentage }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {achievements.map((achievement, index) => {
        const Icon = achievement.icon;
        const isUnlocked = currentPercentage >= achievement.requiredPercentage;
        const isNext = !isUnlocked && (index === 0 || achievements[index - 1].requiredPercentage <= currentPercentage);

        return (
          <motion.div
            key={achievement.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              'relative p-4 rounded-lg border overflow-hidden',
              isUnlocked ? 'bg-gradient-to-br from-gold-primary/20 to-teal-primary/20 border-gold-primary/30' :
              isNext ? 'bg-teal-primary/10 border-teal-primary/30' :
              'bg-sage/5 border-sage/20'
            )}
          >
            {isUnlocked && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="absolute top-2 right-2"
              >
                <Trophy className="w-5 h-5 text-gold-primary" />
              </motion.div>
            )}
            
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center mb-3',
              isUnlocked ? `bg-${achievement.color}-primary/30` :
              isNext ? 'bg-teal-primary/20' :
              'bg-sage/20'
            )}>
              <Icon className={cn(
                'w-6 h-6',
                isUnlocked ? `text-${achievement.color}-primary` :
                isNext ? 'text-teal-primary' :
                'text-sage/50'
              )} />
            </div>
            
            <h4 className={cn(
              'font-semibold mb-1',
              isUnlocked ? 'text-cream' :
              isNext ? 'text-cream' :
              'text-sage/60'
            )}>
              {achievement.title}
            </h4>
            
            <p className={cn(
              'text-sm mb-3',
              isUnlocked ? 'text-sage/80' :
              isNext ? 'text-sage/70' :
              'text-sage/50'
            )}>
              {achievement.description}
            </p>
            
            <div className={cn(
              'text-xs font-medium',
              isUnlocked ? 'text-gold-primary' :
              isNext ? 'text-teal-primary' :
              'text-sage/50'
            )}>
              {isUnlocked ? 'Unlocked!' :
               isNext ? `${achievement.requiredPercentage - currentPercentage}% to go` :
               `Requires ${achievement.requiredPercentage}%`}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

// Main component
export const ProfileCompletion: React.FC<{
  className?: string;
  showInline?: boolean;
}> = ({ className, showInline = false }) => {
  const { profile } = useAuth();
  const [showConfetti, setShowConfetti] = useState(false);
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null);

  // Calculate completion percentage
  const completionData = useMemo(() => {
    const completedSteps = COMPLETION_STEPS.filter(step => step.isCompleted(profile));
    const totalWeight = COMPLETION_STEPS.reduce((sum, step) => sum + step.weight, 0);
    const completedWeight = completedSteps.reduce((sum, step) => sum + step.weight, 0);
    const percentage = Math.round((completedWeight / totalWeight) * 100);

    return {
      percentage,
      completedSteps: completedSteps.length,
      totalSteps: COMPLETION_STEPS.length,
      completedWeight,
      totalWeight,
    };
  }, [profile]);

  // Check for new achievements
  useEffect(() => {
    const unlockedAchievements = ACHIEVEMENTS.filter(
      achievement => completionData.percentage >= achievement.requiredPercentage
    );
    
    // In a real app, you'd track which achievements have been shown before
    const newlyUnlocked = unlockedAchievements[unlockedAchievements.length - 1];
    
    if (newlyUnlocked && completionData.percentage === newlyUnlocked.requiredPercentage) {
      setNewAchievement(newlyUnlocked);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }
  }, [completionData.percentage]);

  // Social proof data
  const socialProofStats = {
    avgCompletion: 67,
    engagementBoost: '3x',
    usersWith100: 23,
  };

  if (showInline) {
    return (
      <GlassMorphism variant="medium" className={cn('p-6', className)}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-heading text-cream">Profile Completion</h3>
          <div className="text-right">
            <div className="text-2xl font-bold text-cream">{completionData.percentage}%</div>
            <div className="text-xs text-sage/70">Complete</div>
          </div>
        </div>
        
        <div className="relative h-2 bg-sage/20 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completionData.percentage}%` }}
            className="h-full bg-gradient-to-r from-teal-primary to-gold-primary"
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
        
        <div className="flex items-center justify-between mt-3 text-sm">
          <span className="text-sage/70">
            {completionData.completedSteps} of {completionData.totalSteps} completed
          </span>
          <span className="text-teal-primary">
            +{100 - completionData.percentage}% to go
          </span>
        </div>
      </GlassMorphism>
    );
  }

  return (
    <>
      <div className={cn('max-w-6xl mx-auto space-y-8', className)}>
        {/* Header */}
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="inline-block p-4 bg-gradient-to-br from-teal-primary/20 to-gold-primary/20 rounded-full mb-4"
          >
            <Target className="w-8 h-8 text-teal-primary" />
          </motion.div>
          <h1 className="text-3xl font-heading font-semibold text-cream mb-2">
            Complete Your Profile
          </h1>
          <p className="text-sage/70 max-w-2xl mx-auto">
            A complete profile gets {socialProofStats.engagementBoost} more engagement from local businesses.
            Join {socialProofStats.usersWith100}% of users with 100% completion!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Progress Overview */}
          <div className="lg:col-span-1">
            <GlassMorphism variant="medium" className="p-6 text-center">
              <ProgressRing
                progress={completionData.percentage}
                size={160}
                strokeWidth={8}
                className="mx-auto mb-6"
              />
              
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <Zap className="w-4 h-4 text-gold-primary" />
                  <span className="text-sm text-sage/70">
                    {completionData.completedSteps} of {completionData.totalSteps} steps complete
                  </span>
                </div>
                
                <div className="flex items-center justify-center gap-2">
                  <TrendingUp className="w-4 h-4 text-teal-primary" />
                  <span className="text-sm text-sage/70">
                    {100 - completionData.percentage}% away from Profile Master
                  </span>
                </div>
              </div>
            </GlassMorphism>

            {/* Social Proof */}
            <GlassMorphism variant="medium" className="p-6 mt-6">
              <h3 className="font-semibold text-cream mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Community Stats
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-sage/70">Average completion</span>
                  <span className="text-sm font-medium text-cream">{socialProofStats.avgCompletion}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-sage/70">Engagement boost</span>
                  <span className="text-sm font-medium text-teal-primary">{socialProofStats.engagementBoost}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-sage/70">Profile Masters</span>
                  <span className="text-sm font-medium text-gold-primary">{socialProofStats.usersWith100}%</span>
                </div>
              </div>
            </GlassMorphism>
          </div>

          {/* Completion Steps */}
          <div className="lg:col-span-2">
            <GlassMorphism variant="medium" className="p-6">
              <h3 className="text-lg font-heading text-cream mb-6">Completion Steps</h3>
              
              <div className="space-y-4">
                {COMPLETION_STEPS.map((step, index) => (
                  <CompletionStepItem
                    key={step.id}
                    step={step}
                    profile={profile}
                  />
                ))}
              </div>
            </GlassMorphism>
          </div>
        </div>

        {/* Achievements */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <Award className="w-6 h-6 text-gold-primary" />
            <h2 className="text-xl font-heading text-cream">Achievements</h2>
            <Sparkles className="w-5 h-5 text-gold-primary" />
          </div>
          
          <AchievementShowcase
            achievements={ACHIEVEMENTS}
            currentPercentage={completionData.percentage}
          />
        </div>

        {/* Call to Action */}
        {completionData.percentage < 100 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <GlassMorphism variant="medium" className="p-8">
              <Gift className="w-12 h-12 text-gold-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-cream mb-2">
                Complete Your Profile Today
              </h3>
              <p className="text-sage/70 mb-6 max-w-2xl mx-auto">
                You're only {100 - completionData.percentage}% away from unlocking Profile Master status
                and all the exclusive benefits that come with it.
              </p>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-3 bg-gradient-to-r from-teal-primary to-gold-primary text-cream rounded-lg font-medium shadow-lg hover:shadow-xl transition-all"
              >
                Continue Profile Setup
              </motion.button>
            </GlassMorphism>
          </motion.div>
        )}
      </div>

      {/* Achievement Notification */}
      {newAchievement && (
        <AchievementNotification
          achievement={newAchievement}
          isVisible={!!newAchievement}
          onClose={() => setNewAchievement(null)}
        />
      )}

      {/* Confetti Animation */}
      <ConfettiAnimation show={showConfetti} />
    </>
  );
};