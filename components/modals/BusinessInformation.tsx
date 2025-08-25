'use client'

import React, { useState } from 'react'
import { MapPin, Phone, Mail, Globe, Clock, Wifi, Car, Accessibility, CreditCard, Utensils, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Business, BusinessHours, DayHours } from '@/types/business'

interface BusinessInformationProps {
  business: Business
  className?: string
}

export const BusinessInformation: React.FC<BusinessInformationProps> = ({
  business,
  className
}) => {
  const [showFullHours, setShowFullHours] = useState(false)

  const formatAddress = (address: Business['address']) => {
    return `${address.street}, ${address.city}, ${address.state} ${address.zipCode}`
  }

  const formatHours = (hours: DayHours | undefined) => {
    if (!hours || hours.isClosed) return 'Closed'
    return `${formatTime(hours.open)} - ${formatTime(hours.close)}`
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number)
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`
  }

  const getCurrentDayStatus = () => {
    const now = new Date()
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const currentDay = dayNames[now.getDay()] as keyof BusinessHours
    return { day: currentDay, hours: business.hours[currentDay] }
  }

  const dayLabels = {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday'
  }

  const currentDayInfo = getCurrentDayStatus()

  // Business feature icons mapping
  const getFeatureIcon = (feature: string) => {
    const featureLower = feature.toLowerCase()
    if (featureLower.includes('wifi') || featureLower.includes('internet')) return <Wifi size={16} />
    if (featureLower.includes('parking') || featureLower.includes('park')) return <Car size={16} />
    if (featureLower.includes('accessible') || featureLower.includes('wheelchair')) return <Accessibility size={16} />
    if (featureLower.includes('takeout') || featureLower.includes('delivery')) return <ShoppingBag size={16} />
    if (featureLower.includes('dining') || featureLower.includes('restaurant')) return <Utensils size={16} />
    if (featureLower.includes('card') || featureLower.includes('payment')) return <CreditCard size={16} />
    return null
  }

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '')
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/)
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`
    }
    return phone
  }

  return (
    <div className={cn("business-information space-y-6", className)}>
      {/* Contact Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-sage-100 flex items-center gap-2">
          <Phone size={18} />
          Contact Information
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Address */}
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <MapPin size={18} className="text-sage/80 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sage-200 leading-relaxed">
                  {formatAddress(business.address)}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const address = encodeURIComponent(formatAddress(business.address))
                    window.open(`https://maps.google.com/?q=${address}`, '_blank')
                  }}
                  className="text-sage hover:text-sage/80 text-sm font-medium underline mt-1 transition-colors"
                >
                  Get directions
                </button>
              </div>
            </div>
          </div>

          {/* Phone */}
          {business.phone && (
            <div className="flex items-center gap-3">
              <Phone size={18} className="text-sage/80 flex-shrink-0" />
              <div>
                <a
                  href={`tel:${business.phone}`}
                  className="text-sage-200 hover:text-sage transition-colors"
                >
                  {formatPhoneNumber(business.phone)}
                </a>
              </div>
            </div>
          )}

          {/* Email */}
          {business.email && (
            <div className="flex items-center gap-3">
              <Mail size={18} className="text-sage/80 flex-shrink-0" />
              <div>
                <a
                  href={`mailto:${business.email}`}
                  className="text-sage-200 hover:text-sage transition-colors"
                >
                  {business.email}
                </a>
              </div>
            </div>
          )}

          {/* Website */}
          {business.website && (
            <div className="flex items-center gap-3">
              <Globe size={18} className="text-sage/80 flex-shrink-0" />
              <div>
                <a
                  href={business.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sage-200 hover:text-sage transition-colors"
                >
                  Visit website
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Business Hours */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-sage-100 flex items-center gap-2">
          <Clock size={18} />
          Business Hours
        </h3>
        
        <div className="space-y-2">
          {/* Current Day - Always Shown */}
          <div className="flex items-center justify-between p-3 bg-sage/10 rounded-lg border border-sage/20">
            <span className="text-sage-100 font-medium">
              {dayLabels[currentDayInfo.day]} (Today)
            </span>
            <span className="text-sage-200">
              {formatHours(currentDayInfo.hours)}
            </span>
          </div>

          {/* Other Days - Show/Hide Toggle */}
          {showFullHours && (
            <div className="space-y-2">
              {Object.entries(dayLabels).map(([day, label]) => {
                if (day === currentDayInfo.day) return null
                const hours = business.hours[day as keyof BusinessHours]
                
                return (
                  <div 
                    key={day}
                    className="flex items-center justify-between p-2 hover:bg-sage/5 rounded"
                  >
                    <span className="text-sage/80">
                      {label}
                    </span>
                    <span className="text-sage-200">
                      {formatHours(hours)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowFullHours(!showFullHours)}
            className="text-sage hover:text-sage/80 text-sm font-medium transition-colors"
          >
            {showFullHours ? 'Show less' : 'View all hours'}
          </button>
        </div>
      </div>

      {/* Features & Amenities */}
      {business.features.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-sage-100">
            Features & Amenities
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {business.features.map((feature, index) => {
              const icon = getFeatureIcon(feature)
              
              return (
                <div 
                  key={index}
                  className="flex items-center gap-3 p-3 bg-sage/10 rounded-lg border border-sage/20"
                >
                  {icon ? (
                    <div className="text-sage/80 flex-shrink-0">
                      {icon}
                    </div>
                  ) : (
                    <div className="w-2 h-2 bg-sage/60 rounded-full flex-shrink-0 mt-1" />
                  )}
                  <span className="text-sage-200 text-sm">
                    {feature}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick Service Info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {business.acceptsReservations && (
          <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="text-green-400 text-sm font-medium">
              Reservations
            </div>
            <div className="text-green-300 text-xs mt-1">
              Accepted
            </div>
          </div>
        )}

        {business.deliveryAvailable && (
          <div className="text-center p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="text-blue-400 text-sm font-medium">
              Delivery
            </div>
            <div className="text-blue-300 text-xs mt-1">
              Available
            </div>
          </div>
        )}

        {business.takeoutAvailable && (
          <div className="text-center p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <div className="text-purple-400 text-sm font-medium">
              Takeout
            </div>
            <div className="text-purple-300 text-xs mt-1">
              Available
            </div>
          </div>
        )}

        {business.wheelchairAccessible && (
          <div className="text-center p-3 bg-sage/10 border border-sage/20 rounded-lg">
            <div className="text-sage text-sm font-medium">
              Accessible
            </div>
            <div className="text-sage/80 text-xs mt-1">
              Wheelchair
            </div>
          </div>
        )}
      </div>
    </div>
  )
}