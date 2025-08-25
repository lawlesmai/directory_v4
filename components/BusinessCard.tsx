'use client';

import React from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassMorphism } from './GlassMorphism';
import { useCardAnimation } from '../hooks/useCardAnimations';
import { useMobileFeatures } from '../hooks/useMobileFeatures';
import { useModalSystem } from '../hooks/useModalSystem';
import type { EnhancedBusiness } from '../lib/api/businesses';

interface LegacyBusiness {
  id: number;
  name: string;
  category: string;
  price: string;
  distance: string;
  rating: number;
  reviews: number;
  description: string;
  image: string;
  isPremium: boolean;
  badges: string[];
  actions: string[];
}

// Union type to handle both legacy and database business formats
type BusinessData = LegacyBusiness | EnhancedBusiness;

// Helper function to check if business is legacy format
const isLegacyBusiness = (business: BusinessData): business is LegacyBusiness => {
  return 'id' in business && typeof business.id === 'number';
};

// Helper function to normalize business data for display
const normalizeBusinessData = (business: BusinessData) => {
  if (isLegacyBusiness(business)) {
    return {
      id: business.id.toString(),
      name: business.name,
      category: business.category,
      rating: business.rating,
      reviewCount: business.reviews,
      description: business.description,
      imageUrl: business.image,
      isPremium: business.isPremium,
      isVerified: false, // Legacy businesses don't have verification
      distance: business.distance,
      badges: business.badges,
      actions: business.actions,
      city: 'Unknown',
      state: 'Unknown',
    };
  } else {
    // Enhanced business from database
    const dbBusiness = business as EnhancedBusiness;
    return {
      id: dbBusiness.id,
      name: dbBusiness.name,
      category: dbBusiness.category?.name || 'Business',
      rating: dbBusiness.review_stats?.avg_rating || dbBusiness.quality_score || 0,
      reviewCount: dbBusiness.review_stats?.total_reviews || 0,
      description: dbBusiness.short_description || dbBusiness.description || 'No description available',
      imageUrl: dbBusiness.cover_image_url || dbBusiness.logo_url || '/placeholder.jpg',
      isPremium: dbBusiness.is_premium || dbBusiness.subscription_tier !== 'free',
      isVerified: dbBusiness.is_verified || dbBusiness.verification_status === 'verified',
      distance: dbBusiness.distance ? `${(dbBusiness.distance / 1000).toFixed(1)} km` : 'Unknown distance',
      badges: [
        ...(dbBusiness.is_verified || dbBusiness.verification_status === 'verified' ? ['✓ Verified'] : []),
        ...(dbBusiness.is_premium || dbBusiness.subscription_tier !== 'free' ? ['⭐ Premium'] : []),
        ...(dbBusiness.quality_score && dbBusiness.quality_score >= 4.5 ? ['🏆 Top Rated'] : [])
      ],
      actions: ['📞 Call', '🌐 Website', '📍 Directions'],
      city: dbBusiness.city,
      state: dbBusiness.state,
    };
  }
};

interface BusinessCardComponentProps {
  business: BusinessData;
  index: number;
  animationDelay?: number;
  isLoading?: boolean;
  onCardClick?: (businessName: string) => void;
  onActionClick?: (action: string, businessName: string, event: React.MouseEvent) => void;
  enableAnimations?: boolean;
  enableMobileFeatures?: boolean;
  showGlassEffect?: boolean;
}

const BusinessCard: React.FC<BusinessCardComponentProps> = ({
  business,
  index,
  animationDelay = 0,
  isLoading = false,
  onCardClick,
  onActionClick,
  enableAnimations = true,
  enableMobileFeatures = true,
  showGlassEffect = true
}) => {
  // Normalize business data for consistent display
  const normalizedBusiness = normalizeBusinessData(business);
  // Card animation hook
  const {
    cardRef,
    handleMouseEnter,
    handleMouseLeave,
    animationStyles,
    glassmorphismStyles
  } = useCardAnimation(index, `business-card-${normalizedBusiness.id}`, {
    enableHoverEffects: enableAnimations,
    enableGlassmorphism: showGlassEffect,
    animationDuration: 600,
    staggerDelay: 100
  });

  // Mobile features hook for touch gestures
  const mobileFeatures = useMobileFeatures(cardRef, {
    config: {
      enableGestures: enableMobileFeatures,
      enableHapticFeedback: true
    },
    onSwipeNavigation: (direction) => {
      // Could implement swipe-to-navigate between cards
      console.log(`Swiped ${direction} on card ${normalizedBusiness.name}`);
    }
  });

  // Modal system for business details
  const { openModal } = useModalSystem();

  const [isImageLoaded, setIsImageLoaded] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);

  // Rating rendering with enhanced visuals
  const renderStars = React.useCallback((rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    return (
      <div className="flex items-center gap-1">
        {/* Full stars */}
        {Array.from({ length: fullStars }, (_, i) => (
          <motion.span 
            key={`full-${i}`}
            className="text-yellow-400 text-sm"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: i * 0.1, duration: 0.3 }}
          >
            ⭐
          </motion.span>
        ))}
        
        {/* Half star */}
        {hasHalfStar && (
          <motion.span 
            className="text-yellow-400 text-sm"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: fullStars * 0.1, duration: 0.3 }}
          >
            ⚝
          </motion.span>
        )}
        
        {/* Empty stars */}
        {Array.from({ length: emptyStars }, (_, i) => (
          <span key={`empty-${i}`} className="text-gray-300 text-sm">☆</span>
        ))}
      </div>
    );
  }, []);

  // Handle card interactions
  const handleCardClick = React.useCallback(() => {
    if (mobileFeatures.deviceInfo.isMobile) {
      mobileFeatures.triggerHapticFeedback('light');
    }
    
    if (onCardClick) {
      onCardClick(normalizedBusiness.name);
    } else {
      // Open modal with business details as fallback
      openModal({
        component: () => <div>Business Details for {normalizedBusiness.name}</div>,
        size: 'lg',
        backdrop: 'blur'
      });
    }
  }, [normalizedBusiness.name, onCardClick, openModal, mobileFeatures]);

  const handleActionClick = React.useCallback((action: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (mobileFeatures.deviceInfo.isMobile) {
      mobileFeatures.triggerHapticFeedback('medium');
    }
    
    if (onActionClick) {
      onActionClick(action, normalizedBusiness.name, event);
    }
  }, [normalizedBusiness.name, onActionClick, mobileFeatures]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick();
    }
  }, [handleCardClick]);

  // Enhanced mouse events with animation
  const handleEnhancedMouseEnter = React.useCallback(() => {
    setIsHovered(true);
    if (enableAnimations) {
      handleMouseEnter();
    }
  }, [enableAnimations, handleMouseEnter]);

  const handleEnhancedMouseLeave = React.useCallback(() => {
    setIsHovered(false);
    if (enableAnimations) {
      handleMouseLeave();
    }
  }, [enableAnimations, handleMouseLeave]);

  // Card variants for animation
  const cardVariants = {
    hidden: { 
      opacity: 0, 
      y: 50, 
      scale: 0.9,
      rotateX: -15 
    },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      rotateX: 0,
      transition: {
        duration: 0.6,
        delay: animationDelay / 1000,
        ease: [0.4, 0, 0.2, 1]
      }
    },
    hover: {
      y: -8,
      scale: 1.02,
      rotateY: 2,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    }
  };

  const imageVariants = {
    loading: { scale: 1.1, opacity: 0.5 },
    loaded: { 
      scale: 1, 
      opacity: 1,
      transition: { duration: 0.4, ease: "easeOut" }
    }
  };

  return (
    <motion.div
      ref={cardRef}
      className={`business-card-container relative ${normalizedBusiness.isPremium ? 'premium' : ''}`}
      variants={enableAnimations ? cardVariants : undefined}
      initial={enableAnimations ? "hidden" : undefined}
      animate={enableAnimations ? "visible" : undefined}
      whileHover={enableAnimations ? "hover" : undefined}
      style={enableAnimations ? animationStyles : undefined}
      onClick={handleCardClick}
      onMouseEnter={handleEnhancedMouseEnter}
      onMouseLeave={handleEnhancedMouseLeave}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${normalizedBusiness.name}`}
      data-testid={`business-card-${normalizedBusiness.id}`}
    >
      <GlassMorphism
        variant={normalizedBusiness.isPremium ? "strong" : "medium"}
        className="business-card h-full overflow-hidden"
        animated={enableAnimations}
        interactive
        style={showGlassEffect ? glassmorphismStyles : undefined}
      >
        {/* Premium Badge Overlay */}
        <AnimatePresence>
          {normalizedBusiness.isPremium && (
            <motion.div
              initial={{ opacity: 0, scale: 0, rotate: -45 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              className="absolute top-4 right-4 z-10"
            >
              <div className="premium-badge bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                ⭐ PREMIUM
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading Overlay */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex items-center justify-center"
            >
              <div className="loading-spinner w-8 h-8 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Card Image */}
        <div className="card-image relative h-48 overflow-hidden">
          <motion.div
            variants={imageVariants}
            initial="loading"
            animate={isImageLoaded ? "loaded" : "loading"}
            className="w-full h-full"
          >
            <Image
              src={normalizedBusiness.imageUrl}
              alt={normalizedBusiness.name}
              fill
              className="object-cover transition-transform duration-700"
              style={{
                transform: isHovered && enableAnimations ? 'scale(1.1)' : 'scale(1)'
              }}
              loading="lazy"
              onLoad={() => setIsImageLoaded(true)}
              onError={() => setIsImageLoaded(true)}
            />
          </motion.div>

          {/* Image overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
        </div>

        {/* Card Content */}
        <div className="card-content p-6 space-y-4">
          {/* Rating Section */}
          <motion.div 
            className="rating flex items-center justify-between"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (animationDelay / 1000) + 0.2 }}
          >
            <div className="rating-stars">
              {renderStars(normalizedBusiness.rating)}
            </div>
            <div className="rating-text text-sm text-gray-600 font-medium">
              {normalizedBusiness.rating.toFixed(1)} ({normalizedBusiness.reviewCount} reviews)
            </div>
          </motion.div>

          {/* Business Name */}
          <motion.h3 
            className="business-name text-xl font-bold text-gray-800 leading-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (animationDelay / 1000) + 0.3 }}
          >
            {normalizedBusiness.name}
          </motion.h3>

          {/* Category Info */}
          <motion.div 
            className="category-info text-sm text-gray-600 flex items-center gap-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (animationDelay / 1000) + 0.4 }}
          >
            <span className="category font-medium">{normalizedBusiness.category}</span>
            <span className="separator">•</span>
            <span className="location font-medium text-blue-600">{normalizedBusiness.city}, {normalizedBusiness.state}</span>
            <span className="separator">•</span>
            <span className="distance">{normalizedBusiness.distance}</span>
          </motion.div>

          {/* Description */}
          <motion.p 
            className="description text-gray-700 text-sm line-clamp-2 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (animationDelay / 1000) + 0.5 }}
          >
            {normalizedBusiness.description}
          </motion.p>

          {/* Trust Indicators */}
          <AnimatePresence>
            {normalizedBusiness.badges.length > 0 && (
              <motion.div 
                className="trust-indicators flex flex-wrap gap-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (animationDelay / 1000) + 0.6 }}
              >
                {normalizedBusiness.badges.map((badge, badgeIndex) => (
                  <motion.span
                    key={badgeIndex}
                    className="trust-badge bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: (animationDelay / 1000) + 0.7 + (badgeIndex * 0.1) }}
                  >
                    {badge}
                  </motion.span>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Card Actions */}
          <motion.div 
            className="card-actions flex gap-2 pt-4 border-t border-gray-100"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (animationDelay / 1000) + 0.8 }}
          >
            {normalizedBusiness.actions.map((action, actionIndex) => (
              <motion.button
                key={actionIndex}
                className={`
                  action-btn flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all duration-200
                  ${actionIndex === normalizedBusiness.actions.length - 1 
                    ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg hover:shadow-xl' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                  focus:outline-none focus:ring-2 focus:ring-blue-300
                `}
                onClick={(e) => handleActionClick(action, e)}
                whileHover={enableAnimations ? { scale: 1.02 } : undefined}
                whileTap={enableAnimations ? { scale: 0.98 } : undefined}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: (animationDelay / 1000) + 0.9 + (actionIndex * 0.1) }}
              >
                {action}
              </motion.button>
            ))}
          </motion.div>
        </div>

        {/* Interactive Ripple Effect */}
        {enableAnimations && isHovered && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5" />
          </motion.div>
        )}
      </GlassMorphism>
    </motion.div>
  );
};

export default BusinessCard;