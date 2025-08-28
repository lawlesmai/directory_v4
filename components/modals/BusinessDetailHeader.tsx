'use client'

import React from 'react'
import { Star, MapPin, Clock, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Business } from '@/types/business'

interface BusinessDetailHeaderProps {
  business: Business
  className?: string
}

export const BusinessDetailHeader: React.FC<BusinessDetailHeaderProps> = ({
  business,
  className
}) => {
  // Get current status based on business hours
  const getCurrentStatus = (): { status: string; color: string } => {
    const now = new Date()
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as keyof Business['hours']
    const currentTime = now.toTimeString().slice(0, 5) // HH:MM format
    
    const todayHours = business.hours[currentDay]
    
    if (!todayHours || todayHours.isClosed) {
      return { status: 'Closed', color: 'text-red-400' }
    }

    if (currentTime >= todayHours.open && currentTime <= todayHours.close) {
      // Check if closing soon (within 1 hour)
      const closeTime = todayHours.close.split(':')
      const closeDate = new Date()
      closeDate.setHours(parseInt(closeTime[0]), parseInt(closeTime[1]), 0, 0)
      
      const timeDiff = closeDate.getTime() - now.getTime()
      const hoursDiff = timeDiff / (1000 * 60 * 60)
      
      if (hoursDiff <= 1) {
        return { status: 'Closing Soon', color: 'text-yellow-400' }
      }
      
      return { status: 'Open', color: 'text-green-400' }
    }

    return { status: 'Closed', color: 'text-red-400' }
  }

  const currentStatus = getCurrentStatus()

  const formatDistance = (distance: number): string => {
    if (distance < 1) {
      return `${(distance * 5280).toFixed(0)} ft`
    }
    return `${distance.toFixed(1)} mi`
  }

  return (
    <div className={cn("business-detail-header", className)}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl lg:text-3xl font-bold text-sage-50 leading-tight">
              {business.name}
            </h1>
            
            {/* Verification Badge */}
            {business.isVerified && (
              <div className="flex items-center justify-center w-6 h-6 bg-green-500 rounded-full">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M10.5 4.5L5.25 9.75L2.5 7"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            {/* Category */}
            <span className="text-sage font-medium">
              {business.category}
              {business.subcategory && ` • ${business.subcategory}`}
            </span>

            {/* Rating */}
            <div className="flex items-center gap-1">
              <Star size={16} className="text-gold-primary fill-current" />
              <span className="text-sage-100 font-semibold">
                {business.averageRating.toFixed(1)}
              </span>
              <span className="text-sage/70">
                ({business.reviewCount} {business.reviewCount === 1 ? 'review' : 'reviews'})
              </span>
            </div>

            {/* Price Level */}
            <div className="text-sage-100 font-semibold">
              {business.price}
            </div>

            {/* Distance */}
            <div className="flex items-center gap-1 text-sage/80">
              <MapPin size={14} />
              <span>{formatDistance(business.distance)}</span>
            </div>

            {/* Current Status */}
            <div className="flex items-center gap-1">
              <Clock size={14} className={currentStatus.color} />
              <span className={cn("font-medium", currentStatus.color)}>
                {currentStatus.status}
              </span>
            </div>
          </div>

          {/* Premium Features */}
          {business.subscription === 'premium' && (
            <div className="mt-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-gold-primary/20 to-gold-secondary/20 border border-gold-primary/30 rounded-full">
                <div className="w-2 h-2 bg-gold-primary rounded-full animate-pulse" />
                <span className="text-gold-primary text-sm font-semibold">
                  Premium Business
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Contact Actions */}
        <div className="flex items-center gap-2">
          {business.phone && (
            <a
              href={`tel:${business.phone}`}
              className={cn(
                "flex items-center justify-center w-12 h-12",
                "bg-sage/20 hover:bg-sage/30 text-sage",
                "rounded-full transition-all duration-200",
                "hover:scale-105 active:scale-95",
                "focus:outline-none focus:ring-2 focus:ring-sage/50"
              )}
              aria-label={`Call ${business.name}`}
            >
              <Phone size={20} />
            </a>
          )}

          {business.website && (
            <a
              href={business.website}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center justify-center w-12 h-12",
                "bg-sage/20 hover:bg-sage/30 text-sage",
                "rounded-full transition-all duration-200",
                "hover:scale-105 active:scale-95",
                "focus:outline-none focus:ring-2 focus:ring-sage/50"
              )}
              aria-label={`Visit ${business.name} website`}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="m12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </a>
          )}
        </div>
      </div>

      {/* Features and Badges */}
      {(business.features.length > 0 || business.badges.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {business.features.slice(0, 3).map((feature) => (
            <span
              key={feature}
              className="px-2 py-1 bg-sage/20 text-sage text-xs rounded-full"
            >
              {feature}
            </span>
          ))}
          
          {business.badges.map((badge) => (
            <span
              key={badge}
              className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full font-medium"
            >
              {badge}
            </span>
          ))}

          {business.features.length > 3 && (
            <span className="px-2 py-1 bg-sage/10 text-sage/70 text-xs rounded-full">
              +{business.features.length - 3} more
            </span>
          )}
        </div>
      )}
    </div>
  )
}