'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { cn, formatDistance, formatRating, generateStars } from '@/lib/utils'
import { BusinessCardProps } from '@/types/business'
import { PremiumBadge } from './PremiumBadge'
import { BusinessCardHeader } from './BusinessCardHeader'
import { BusinessCardImage } from './BusinessCardImage'
import { BusinessCardContent } from './BusinessCardContent'
import { BusinessCardFooter } from './BusinessCardFooter'

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
        variant === 'list' && 'list-variant flex flex-row',
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
      <BusinessCardHeader 
        business={business}
        isPremium={isPremium}
        isBookmarked={isBookmarked}
        onBookmarkClick={handleBookmarkClick}
        onBookmarkKeyDown={handleBookmarkKeyDown}
      />
      
      <BusinessCardImage 
        src={business.primaryImage}
        alt={business.name}
        isHovered={isHovered}
        variant={variant}
      />
      
      <BusinessCardContent 
        business={business}
        variant={variant}
        headingId={headingId}
        descriptionId={descriptionId}
      />
      
      <BusinessCardFooter 
        rating={business.averageRating}
        reviewCount={business.reviewCount}
        distance={business.distance}
        price={business.price}
      />
      
      {isPremium && (
        <PremiumBadge className="absolute top-2 right-2 z-10" />
      )}
    </motion.article>
  )
}