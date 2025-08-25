'use client'

import React, { useState } from 'react'
import { Phone, Mail, MapPin, Calendar, ExternalLink, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Business } from '@/types/business'

interface BusinessActionsProps {
  business: Business
  onBookingRequest?: (business: Business) => void
  className?: string
}

export const BusinessActions: React.FC<BusinessActionsProps> = ({
  business,
  onBookingRequest,
  className
}) => {
  const [isCallingEnabled] = useState(true)
  const [isDirectionsLoading, setIsDirectionsLoading] = useState(false)

  const handleCall = () => {
    if (!business.phone) return
    
    // Track analytics if available
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'business_call', {
        business_id: business.id,
        business_name: business.name
      })
    }
    
    window.location.href = `tel:${business.phone}`
  }

  const handleEmail = () => {
    if (!business.email) return
    
    // Track analytics
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'business_email', {
        business_id: business.id,
        business_name: business.name
      })
    }
    
    window.location.href = `mailto:${business.email}`
  }

  const handleDirections = async () => {
    setIsDirectionsLoading(true)
    
    try {
      const address = `${business.address.street}, ${business.address.city}, ${business.address.state} ${business.address.zipCode}`
      
      // Check if device supports native maps
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords
            
            // Prefer Apple Maps on iOS, Google Maps elsewhere
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
            
            if (isIOS) {
              window.open(`maps://maps.google.com/maps?saddr=${latitude},${longitude}&daddr=${encodeURIComponent(address)}`)
            } else {
              window.open(`https://www.google.com/maps/dir/${latitude},${longitude}/${encodeURIComponent(address)}`)
            }
          },
          () => {
            // Fallback if geolocation fails
            window.open(`https://www.google.com/maps/search/${encodeURIComponent(address)}`)
          }
        )
      } else {
        window.open(`https://www.google.com/maps/search/${encodeURIComponent(address)}`)
      }
      
      // Track analytics
      if (typeof window !== 'undefined' && 'gtag' in window) {
        (window as any).gtag('event', 'business_directions', {
          business_id: business.id,
          business_name: business.name
        })
      }
    } catch (error) {
      console.error('Error opening directions:', error)
    } finally {
      setIsDirectionsLoading(false)
    }
  }

  const handleWebsite = () => {
    if (!business.website) return
    
    // Track analytics
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'business_website', {
        business_id: business.id,
        business_name: business.name
      })
    }
    
    window.open(business.website, '_blank', 'noopener,noreferrer')
  }

  const handleBooking = () => {
    if (onBookingRequest) {
      onBookingRequest(business)
    }
    
    // Track analytics
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'business_booking_request', {
        business_id: business.id,
        business_name: business.name
      })
    }
  }

  const primaryActions = []
  const secondaryActions = []

  // Primary actions (more prominent)
  if (business.phone && isCallingEnabled) {
    primaryActions.push({
      id: 'call',
      label: 'Call Now',
      icon: <Phone size={20} />,
      onClick: handleCall,
      className: 'bg-green-600 hover:bg-green-700 text-white'
    })
  }

  if (business.acceptsReservations) {
    primaryActions.push({
      id: 'booking',
      label: 'Book Now',
      icon: <Calendar size={20} />,
      onClick: handleBooking,
      className: 'bg-sage hover:bg-sage/90 text-navy-900'
    })
  }

  // Secondary actions
  if (business.email) {
    secondaryActions.push({
      id: 'email',
      label: 'Email',
      icon: <Mail size={18} />,
      onClick: handleEmail,
      className: 'bg-sage/20 hover:bg-sage/30 text-sage border border-sage/30'
    })
  }

  secondaryActions.push({
    id: 'directions',
    label: isDirectionsLoading ? 'Loading...' : 'Directions',
    icon: <MapPin size={18} />,
    onClick: handleDirections,
    disabled: isDirectionsLoading,
    className: 'bg-sage/20 hover:bg-sage/30 text-sage border border-sage/30'
  })

  if (business.website) {
    secondaryActions.push({
      id: 'website',
      label: 'Website',
      icon: <ExternalLink size={18} />,
      onClick: handleWebsite,
      className: 'bg-sage/20 hover:bg-sage/30 text-sage border border-sage/30'
    })
  }

  return (
    <div className={cn("business-actions space-y-4", className)}>
      {/* Primary Actions */}
      {primaryActions.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          {primaryActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className={cn(
                "flex items-center justify-center gap-2 px-6 py-3 rounded-lg",
                "font-semibold transition-all duration-200",
                "hover:scale-105 active:scale-95",
                "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-navy-900",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
                action.className
              )}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Secondary Actions */}
      {secondaryActions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {secondaryActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg",
                "font-medium text-sm transition-all duration-200",
                "hover:scale-105 active:scale-95",
                "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-navy-900 focus:ring-sage/50",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
                action.className
              )}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Business Status Indicators */}
      <div className="flex flex-wrap gap-2 pt-2">
        {business.deliveryAvailable && (
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full border border-blue-500/30">
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
            Delivery Available
          </div>
        )}
        
        {business.takeoutAvailable && (
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full border border-purple-500/30">
            <div className="w-1.5 h-1.5 bg-purple-400 rounded-full" />
            Takeout Available
          </div>
        )}
        
        {business.wheelchairAccessible && (
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full border border-green-500/30">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
            Wheelchair Accessible
          </div>
        )}

        {business.parkingAvailable && (
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-sage/20 text-sage text-xs rounded-full border border-sage/30">
            <div className="w-1.5 h-1.5 bg-sage rounded-full" />
            Parking Available
          </div>
        )}
      </div>

      {/* Additional CTA for Premium Businesses */}
      {business.subscription === 'premium' && (
        <div className="p-4 bg-gradient-to-r from-gold-primary/10 to-gold-secondary/10 border border-gold-primary/20 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-gold-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
              <MessageCircle size={16} className="text-gold-primary" />
            </div>
            <div className="flex-1">
              <h4 className="text-gold-primary font-semibold text-sm mb-1">
                Premium Business
              </h4>
              <p className="text-gold-secondary/80 text-xs leading-relaxed">
                This business is verified and committed to providing exceptional service. 
                Contact them directly for personalized assistance.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}