'use client'

import { cn, formatDistance, formatRating, generateStars } from '@/lib/utils'

interface BusinessCardFooterProps {
  rating: number
  reviewCount: number
  distance: number
  price: string
  className?: string
}

export const BusinessCardFooter: React.FC<BusinessCardFooterProps> = ({
  rating,
  reviewCount,
  distance,
  price,
  className
}) => {
  const stars = generateStars(rating)
  
  return (
    <div className={cn(
      'card-footer p-4 pt-0 flex items-center justify-between',
      'border-t border-sage/10 mt-auto',
      className
    )}>
      <div className="rating-info flex items-center gap-2">
        <div 
          className="stars text-gold-primary text-sm"
          role="img"
          aria-label={`Star rating: ${formatRating(rating)} out of 5 stars`}
          title={`${formatRating(rating)} stars`}
        >
          {stars}
        </div>
        <div className="rating-details text-xs text-text-muted">
          <span className="rating-number font-medium text-cream">
            {formatRating(rating)}
          </span>
          <span className="review-count ml-1">
            ({reviewCount} reviews)
          </span>
        </div>
      </div>
      
      <div className="business-meta flex items-center gap-2 text-xs text-text-muted">
        <span className="price font-medium text-sage">
          {price}
        </span>
        <span className="separator">•</span>
        <span className="distance">
          {formatDistance(distance)}
        </span>
      </div>
    </div>
  )
}