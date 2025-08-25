'use client'

import { cn } from '@/lib/utils'
import { Business } from '@/types/business'

interface BusinessCardContentProps {
  business: Business
  variant?: 'grid' | 'list' | 'featured'
  headingId: string
  descriptionId: string
}

export const BusinessCardContent: React.FC<BusinessCardContentProps> = ({
  business,
  variant = 'grid',
  headingId,
  descriptionId
}) => {
  const isListVariant = variant === 'list'
  
  return (
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
          {business.badges.slice(0, 3).map((badge, index) => (
            <span
              key={index}
              className="trust-badge inline-flex items-center px-2 py-1 bg-teal-20 text-teal-secondary text-xs font-medium rounded-full backdrop-blur-sm"
            >
              {badge}
            </span>
          ))}
        </div>
      )}
      
      {business.features && business.features.length > 0 && (
        <div className="features flex flex-wrap gap-1 mt-2">
          {business.features.slice(0, 4).map((feature, index) => (
            <span
              key={index}
              className="feature-tag text-xs text-sage/60 bg-sage/10 px-2 py-0.5 rounded"
            >
              {feature}
            </span>
          ))}
          {business.features.length > 4 && (
            <span className="feature-tag text-xs text-sage/60">
              +{business.features.length - 4} more
            </span>
          )}
        </div>
      )}
    </div>
  )
}