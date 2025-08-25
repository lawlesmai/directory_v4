'use client'

import { cn } from '@/lib/utils'
import { Business } from '@/types/business'

interface BusinessCardHeaderProps {
  business: Business
  isPremium: boolean
  isBookmarked: boolean
  onBookmarkClick: (event: React.MouseEvent) => void
  onBookmarkKeyDown: (event: React.KeyboardEvent) => void
}

export const BusinessCardHeader: React.FC<BusinessCardHeaderProps> = ({
  business,
  isPremium,
  isBookmarked,
  onBookmarkClick,
  onBookmarkKeyDown
}) => {
  return (
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
        onClick={onBookmarkClick}
        onKeyDown={onBookmarkKeyDown}
        aria-label="Bookmark business"
        tabIndex={0}
      >
        <span className="bookmark-icon text-lg">
          {isBookmarked ? '❤️' : '🤍'}
        </span>
      </button>
    </div>
  )
}