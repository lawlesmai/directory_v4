'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { cn, formatDistance, formatRating, generateStars } from '@/lib/utils'
import { BusinessCardProps } from '@/types/business'

export const BusinessCard: React.FC<BusinessCardProps> = ({
  business,
  variant = 'grid',
  animationDelay = 0,
  onCardClick,
  onBookmarkToggle,
  className
}) => {
  const [isHovered, setIsHovered] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const isPremium = business.subscription === 'premium'

  const handleCardClick = () => {
    onCardClick?.(business)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleCardClick()
    }
  }

  const handleBookmarkClick = (event: React.MouseEvent) => {
    event.stopPropagation()
    setIsBookmarked(!isBookmarked)
    onBookmarkToggle?.(business.id)
  }

  const handleBookmarkKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      event.stopPropagation()
      setIsBookmarked(!isBookmarked)
      onBookmarkToggle?.(business.id)
    }
  }

  const cardId = `business-card-${business.id}`
  const headingId = `${cardId}-heading`
  const descriptionId = `${cardId}-description`

  const stars = generateStars(business.averageRating)
  const isListVariant = variant === 'list'

  return (
    <motion.article
      ref={cardRef}
      className={cn(
        'business-card relative group cursor-pointer',
        'bg-navy-70/30 backdrop-blur-lg border border-sage/20',
        'rounded-lg overflow-hidden transition-all duration-300',
        'hover:bg-navy-70/40 hover:border-sage/30',
        'hover:shadow-2xl hover:scale-[1.02]',
        'focus:outline-none focus:ring-2 focus:ring-sage/50 focus:border-sage/50',
        isListVariant && 'list-variant flex flex-row',
        isPremium && 'premium-card border-gold-primary/30 bg-gradient-to-br from-gold-primary/10 to-gold-secondary/20',
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.6, 
        delay: animationDelay / 1000,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="article"
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Header with bookmark */}
      <div className="absolute top-2 left-2 right-2 z-10 flex justify-between items-start">
        <div className="flex flex-col gap-1">
          {business.isVerified && (
            <span className="verification-badge inline-flex items-center px-2 py-1 bg-sage/20 text-sage text-xs font-medium rounded-full backdrop-blur-sm">
              ✓ Verified
            </span>
          )}
        </div>
        
        <button
          className={cn(
            'bookmark-btn p-2 rounded-full backdrop-blur-sm transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-sage/50',
            'hover:bg-sage/20 hover:scale-110',
            isBookmarked 
              ? 'text-gold-primary bg-gold-primary/20' 
              : 'text-sage/70 bg-navy-70/30 hover:text-sage'
          )}
          onClick={handleBookmarkClick}
          onKeyDown={handleBookmarkKeyDown}
          aria-label="Bookmark business"
          tabIndex={0}
        >
          <span className="bookmark-icon text-lg">
            {isBookmarked ? '❤️' : '🤍'}
          </span>
        </button>
      </div>

      {/* Image */}
      <div className={cn(
        'card-image relative overflow-hidden',
        isListVariant ? 'h-32 w-48 flex-shrink-0' : 'h-48 w-full'
      )}>
        <motion.div
          className="w-full h-full"
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <Image
            src={business.primaryImage}
            alt={business.name}
            fill
            className={cn(
              'object-cover transition-all duration-300',
              isHovered && 'brightness-110 contrast-105'
            )}
            loading="lazy"
            sizes={isListVariant ? '192px' : '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'}
          />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-t from-navy-dark/60 via-transparent to-transparent pointer-events-none" />
      </div>
      
      {/* Content */}
      <div className={cn(
        'card-content p-4 space-y-3',
        isListVariant && 'flex-1'
      )}>
        <div className="business-info">
          <h3 
            id={headingId}
            className="business-name text-lg font-semibold text-cream mb-1 line-clamp-1 group-hover:text-sage transition-colors duration-200"
          >
            {business.name}
          </h3>
          
          <p className="category text-sage/80 text-sm font-medium mb-2">
            {business.category}
            {business.subcategory && ` • ${business.subcategory}`}
          </p>
          
          <p 
            id={descriptionId}
            className={cn(
              'description text-text-muted text-sm leading-relaxed',
              isListVariant ? 'line-clamp-2' : 'line-clamp-3'
            )}
          >
            {business.shortDescription || business.description}
          </p>
        </div>
        
        {business.badges && business.badges.length > 0 && (
          <div className="trust-indicators flex flex-wrap gap-2">
            {business.badges.slice(0, 3).map((badge: string, index: number) => (
              <span
                key={index}
                className="trust-badge inline-flex items-center px-2 py-1 bg-teal-20 text-teal-secondary text-xs font-medium rounded-full backdrop-blur-sm"
              >
                {badge}
              </span>
            ))}
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="card-footer p-4 pt-0 flex items-center justify-between border-t border-sage/10 mt-auto">
        <div className="rating-info flex items-center gap-2">
          <div 
            className="stars text-gold-primary text-sm"
            role="img"
            aria-label={`Star rating: ${formatRating(business.averageRating)} out of 5 stars`}
            title={`${formatRating(business.averageRating)} stars`}
          >
            {stars}
          </div>
          <div className="rating-details text-xs text-text-muted">
            <span className="rating-number font-medium text-cream">
              {formatRating(business.averageRating)}
            </span>
            <span className="review-count ml-1">
              ({business.reviewCount} reviews)
            </span>
          </div>
        </div>
        
        <div className="business-meta flex items-center gap-2 text-xs text-text-muted">
          <span className="price font-medium text-sage">
            {business.price}
          </span>
          <span className="separator">•</span>
          <span className="distance">
            {formatDistance(business.distance)}
          </span>
        </div>
      </div>
      
      {/* Premium Badge */}
      {isPremium && (
        <motion.div
          className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-gradient-to-r from-gold-primary to-gold-secondary text-black font-semibold rounded-full shadow-lg border border-gold-primary/20"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ 
            duration: 0.3,
            delay: 0.2,
            ease: [0.25, 0.46, 0.45, 0.94]
          }}
          whileHover={{ 
            scale: 1.05,
            boxShadow: '0 8px 32px rgba(238, 155, 0, 0.3)'
          }}
        >
          <span className="star-icon">⭐</span>
          <span>PREMIUM</span>
        </motion.div>
      )}
    </motion.article>
  )
}