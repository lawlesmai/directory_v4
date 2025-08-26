'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy,
  Star,
  Check,
  Lock,
  Unlock,
  Gift,
  Target,
  TrendingUp,
  Award,
  Zap,
  Mail,
  Camera,
  MapPin,
  Phone,
  Link2,
  MessageSquare,
  Shield,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProfileCompletionMetrics, Achievement } from './types';
import confetti from 'canvas-confetti';

interface ProfileCompletionProps {
  userData?: any; // Would come from auth context
  onActionClick?: (action: string) => void;
  className?: string;
  variant?: 'compact' | 'detailed';
}

const achievements: Achievement[] = [
  {
    id: 'first_steps',
    name: 'First Steps',
    description: 'Complete your basic profile',
    icon: <Star className="w-5 h-5" />,
    points: 100,
    progress: 0,
    maxProgress: 3
  },
  {
    id: 'verified',
    name: 'Verified User',
    description: 'Verify email and phone',
    icon: <Shield className="w-5 h-5" />,
    points: 200,
    progress: 0,
    maxProgress: 2
  },
  {
    id: 'socialite',
    name: 'Socialite',
    description: 'Connect social accounts',
    icon: <Link2 className="w-5 h-5" />,
    points: 150,
    progress: 0,
    maxProgress: 3
  },
  {
    id: 'contributor',
    name: 'Contributor',
    description: 'Write your first review',
    icon: <MessageSquare className="w-5 h-5" />,
    points: 300,
    progress: 0,
    maxProgress: 1
  },
  {
    id: 'explorer',
    name: 'Explorer',
    description: 'Save 5 favorite places',
    icon: <MapPin className="w-5 h-5" />,
    points: 250,
    progress: 0,
    maxProgress: 5
  }
];

const rewards = [
  {
    name: 'Search Filters',
    description: 'Advanced search and filtering',
    requiredPercentage: 25,
    icon: <Target className="w-5 h-5" />
  },
  {
    name: 'Save Favorites',
    description: 'Create collections of places',
    requiredPercentage: 50,
    icon: <Star className="w-5 h-5" />
  },
  {
    name: 'Priority Support',
    description: 'Get help faster',
    requiredPercentage: 75,
    icon: <Zap className="w-5 h-5" />
  },
  {
    name: 'Premium Badge',
    description: 'Stand out in the community',
    requiredPercentage: 100,
    icon: <Award className="w-5 h-5" />
  }
];

export const ProfileCompletion: React.FC<ProfileCompletionProps> = ({
  userData = {},
  onActionClick,
  className,
  variant = 'detailed'
}) => {
  const [showCelebration, setShowCelebration] = useState(false);
  const [lastPercentage, setLastPercentage] = useState(0);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const metrics: ProfileCompletionMetrics = useMemo(() => {
    const requiredFields = [
      { field: 'email', label: 'Email Address', completed: !!userData.email, points: 50 },
      { field: 'firstName', label: 'First Name', completed: !!userData.firstName, points: 30 },
      { field: 'lastName', label: 'Last Name', completed: !!userData.lastName, points: 30 },
      { field: 'avatar', label: 'Profile Photo', completed: !!userData.avatar, points: 40 },
      { field: 'location', label: 'Location', completed: !!userData.location, points: 50 }
    ];

    const optionalFields = [
      { field: 'phone', label: 'Phone Number', completed: !!userData.phone, points: 50 },
      { field: 'bio', label: 'Bio', completed: !!userData.bio, points: 30 },
      { field: 'website', label: 'Website', completed: !!userData.website, points: 20 },
      { field: 'socialAccounts', label: 'Social Accounts', completed: !!userData.socialAccounts?.length, points: 100 },
      { field: 'interests', label: 'Interests', completed: !!userData.interests?.length, points: 50 }
    ];

    const totalRequired = requiredFields.reduce((sum, field) => sum + field.points, 0);
    const totalOptional = optionalFields.reduce((sum, field) => sum + field.points, 0);
    const totalPoints = totalRequired + totalOptional;

    const earnedRequired = requiredFields.filter(f => f.completed).reduce((sum, f) => sum + f.points, 0);
    const earnedOptional = optionalFields.filter(f => f.completed).reduce((sum, f) => sum + f.points, 0);
    const earnedPoints = earnedRequired + earnedOptional;

    const percentage = Math.round((earnedPoints / totalPoints) * 100);

    const nextReward = rewards.find(r => r.requiredPercentage > percentage);

    return {
      percentage,
      requiredFields,
      optionalFields,
      totalPoints,
      earnedPoints,
      nextReward: nextReward ? {
        name: nextReward.name,
        description: nextReward.description,
        pointsRequired: Math.ceil((nextReward.requiredPercentage / 100) * totalPoints) - earnedPoints
      } : undefined
    };
  }, [userData]);

  // Trigger celebration on milestones
  useEffect(() => {
    const milestones = [25, 50, 75, 100];
    const currentMilestone = milestones.find(m => 
      m <= metrics.percentage && m > lastPercentage
    );

    if (currentMilestone) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 3000);
      
      // Trigger confetti for major milestones
      if (currentMilestone >= 50) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    }

    setLastPercentage(metrics.percentage);
  }, [metrics.percentage, lastPercentage]);

  const getProgressColor = (percentage: number) => {
    if (percentage >= 75) return 'from-sage to-teal-primary';
    if (percentage >= 50) return 'from-teal-secondary to-teal-primary';
    if (percentage >= 25) return 'from-gold-secondary to-gold-primary';
    return 'from-red-warning to-gold-secondary';
  };

  const handleActionClick = (action: string) => {
    onActionClick?.(action);
  };

  if (variant === 'compact') {
    return (
      <div className={cn('p-4 bg-navy-dark/50 backdrop-blur-sm rounded-lg border border-sage/20', className)}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-cream">Profile Completion</span>
          <span className="text-sm font-bold text-teal-primary">{metrics.percentage}%</span>
        </div>
        
        <div className="relative h-2 bg-navy-dark/50 rounded-full overflow-hidden mb-3">
          <motion.div
            className={cn('h-full bg-gradient-to-r', getProgressColor(metrics.percentage))}
            initial={{ width: 0 }}
            animate={{ width: `${metrics.percentage}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
        
        {metrics.nextReward && (
          <button
            onClick={() => setExpandedSection('details')}
            className="w-full text-left text-xs text-sage/70 hover:text-sage transition-colors"
          >
            <span className="flex items-center justify-between">
              <span>Next: {metrics.nextReward.name}</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Main Progress Card */}
      <div className="p-6 bg-navy-dark/50 backdrop-blur-sm rounded-xl border border-sage/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-cream mb-1">Profile Completion</h3>
            <p className="text-sm text-sage/70">Complete your profile to unlock features</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-teal-primary">{metrics.percentage}%</div>
            <div className="text-xs text-sage/50">{metrics.earnedPoints}/{metrics.totalPoints} points</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative h-4 bg-navy-dark/50 rounded-full overflow-hidden mb-6">
          <motion.div
            className={cn('h-full bg-gradient-to-r', getProgressColor(metrics.percentage))}
            initial={{ width: 0 }}
            animate={{ width: `${metrics.percentage}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
          
          {/* Milestone Markers */}
          {[25, 50, 75].map(milestone => (
            <div
              key={milestone}
              className="absolute top-0 h-full w-px bg-sage/30"
              style={{ left: `${milestone}%` }}
            >
              <div className={cn(
                'absolute -top-6 left-1/2 -translate-x-1/2 text-xs',
                metrics.percentage >= milestone ? 'text-teal-primary' : 'text-sage/50'
              )}>
                {milestone}%
              </div>
            </div>
          ))}
        </div>

        {/* Celebration Message */}
        <AnimatePresence>
          {showCelebration && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-3 bg-teal-primary/10 border border-teal-primary/20 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-teal-primary" />
                <span className="text-sm font-medium text-teal-primary">
                  Milestone reached! You're doing great!
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Next Reward */}
        {metrics.nextReward && (
          <div className="p-3 bg-sage/5 rounded-lg border border-sage/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Gift className="w-5 h-5 text-gold-primary" />
                <div>
                  <p className="text-sm font-medium text-cream">{metrics.nextReward.name}</p>
                  <p className="text-xs text-sage/60">{metrics.nextReward.pointsRequired} points to unlock</p>
                </div>
              </div>
              <TrendingUp className="w-4 h-4 text-sage/50" />
            </div>
          </div>
        )}
      </div>

      {/* Required Fields */}
      <div className="p-6 bg-navy-dark/50 backdrop-blur-sm rounded-xl border border-sage/20">
        <h4 className="text-sm font-semibold text-cream mb-4">Complete These Steps</h4>
        <div className="space-y-3">
          {metrics.requiredFields.map(field => (
            <div
              key={field.field}
              className={cn(
                'flex items-center justify-between p-3 rounded-lg transition-all duration-200',
                field.completed ? 'bg-sage/5' : 'bg-navy-dark/30 hover:bg-navy-dark/50 cursor-pointer'
              )}
              onClick={() => !field.completed && handleActionClick(field.field)}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200',
                  field.completed 
                    ? 'bg-sage/20 text-sage' 
                    : 'bg-sage/10 text-sage/50'
                )}>
                  {field.completed ? <Check className="w-3 h-3" /> : <div className="w-2 h-2 bg-current rounded-full" />}
                </div>
                <span className={cn(
                  'text-sm',
                  field.completed ? 'text-sage line-through' : 'text-cream'
                )}>
                  {field.label}
                </span>
              </div>
              <span className={cn(
                'text-xs font-medium',
                field.completed ? 'text-sage' : 'text-gold-primary'
              )}>
                +{field.points} pts
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Rewards */}
      <div className="p-6 bg-navy-dark/50 backdrop-blur-sm rounded-xl border border-sage/20">
        <h4 className="text-sm font-semibold text-cream mb-4">Rewards Unlocked</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rewards.map(reward => {
            const isUnlocked = metrics.percentage >= reward.requiredPercentage;
            return (
              <div
                key={reward.name}
                className={cn(
                  'p-3 rounded-lg border transition-all duration-200',
                  isUnlocked 
                    ? 'bg-teal-primary/5 border-teal-primary/20' 
                    : 'bg-navy-dark/30 border-sage/20 opacity-50'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    isUnlocked ? 'bg-teal-primary/20' : 'bg-sage/10'
                  )}>
                    {isUnlocked ? reward.icon : <Lock className="w-4 h-4 text-sage/50" />}
                  </div>
                  <div className="flex-1">
                    <p className={cn(
                      'text-sm font-medium',
                      isUnlocked ? 'text-cream' : 'text-sage/50'
                    )}>
                      {reward.name}
                    </p>
                    <p className="text-xs text-sage/60">{reward.description}</p>
                    {!isUnlocked && (
                      <p className="text-xs text-gold-primary mt-1">
                        {reward.requiredPercentage}% required
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Achievements */}
      <div className="p-6 bg-navy-dark/50 backdrop-blur-sm rounded-xl border border-sage/20">
        <h4 className="text-sm font-semibold text-cream mb-4">Achievements</h4>
        <div className="space-y-3">
          {achievements.map(achievement => (
            <div
              key={achievement.id}
              className="flex items-center justify-between p-3 bg-navy-dark/30 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  achievement.unlockedAt ? 'bg-gold-primary/20' : 'bg-sage/10'
                )}>
                  {achievement.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-cream">{achievement.name}</p>
                  <p className="text-xs text-sage/60">{achievement.description}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-gold-primary">
                  {achievement.points} pts
                </div>
                {achievement.maxProgress && (
                  <div className="text-xs text-sage/50">
                    {achievement.progress}/{achievement.maxProgress}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfileCompletion;