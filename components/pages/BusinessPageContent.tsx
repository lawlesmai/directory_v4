'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Share2, Bookmark, MapPin, Phone, Globe, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Business } from '@/types/business'
import { BusinessDetailHeader } from '@/components/modals/BusinessDetailHeader'
import { BusinessInformation } from '@/components/modals/BusinessInformation'
import { BusinessActions } from '@/components/modals/BusinessActions'
import { ImageGallery } from '@/components/modals/ImageGallery'
import { BusinessReviews } from '@/components/modals/BusinessReviews'
import { useModal } from '@/lib/providers/ModalProvider'

interface BusinessPageContentProps {
  business: Business
}

export const BusinessPageContent: React.FC<BusinessPageContentProps> = ({
  business
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const router = useRouter()
  const { openModal } = useModal()

  const handleBack = () => {
    router.back()
  }

  const handleShare = async () => {
    const currentUrl = window.location.href
    
    if (navigator.share && 'canShare' in navigator) {
      try {
        await navigator.share({
          title: business.name,
          text: business.shortDescription || business.description,
          url: currentUrl
        })
      } catch (error) {
        console.error('Error sharing:', error)
      }
    } else {
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(currentUrl)
        // Could show toast notification here
        console.log('Link copied to clipboard')
      } catch (error) {
        console.error('Error copying to clipboard:', error)
      }
    }
  }

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked)
    // Here you would integrate with your bookmark API
  }

  const handleBookingRequest = (business: Business) => {
    // Open booking modal or redirect to booking page
    openModal({
      component: BookingRequestModal,
      props: { business },
      size: 'md',
      variant: 'center'
    })
  }

  return (
    <div className="business-page-content">
      {/* Navigation Header */}
      <div className="sticky top-0 z-40 bg-gradient-to-r from-navy-900/95 to-navy-800/95 backdrop-blur-xl border-b border-sage/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleBack}
                className={cn(
                  "p-2 text-sage hover:text-sage/80 transition-colors",
                  "hover:bg-sage/10 rounded-full"
                )}
                aria-label="Go back"
              >
                <ArrowLeft size={20} />
              </button>

              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  className="text-sage/80 hover:text-sage text-sm transition-colors"
                >
                  Directory
                </Link>
                <span className="text-sage/60">/</span>
                <Link
                  href={`/category/${business.category.toLowerCase().replace(/\s+/g, '-')}`}
                  className="text-sage/80 hover:text-sage text-sm transition-colors"
                >
                  {business.category}
                </Link>
                <span className="text-sage/60">/</span>
                <span className="text-sage text-sm font-medium truncate max-w-32">
                  {business.name}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShare}
                className={cn(
                  "p-2 text-sage hover:text-sage/80 transition-colors",
                  "hover:bg-sage/10 rounded-full"
                )}
                aria-label="Share business"
              >
                <Share2 size={20} />
              </button>

              <button
                type="button"
                onClick={handleBookmark}
                className={cn(
                  "p-2 transition-colors rounded-full",
                  isBookmarked
                    ? "text-gold-primary hover:text-gold-primary/80 bg-gold-primary/10"
                    : "text-sage hover:text-sage/80 hover:bg-sage/10"
                )}
                aria-label={`${isBookmarked ? 'Remove from' : 'Add to'} bookmarks`}
              >
                <Bookmark size={20} fill={isBookmarked ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Business Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <BusinessDetailHeader business={business} />
            </motion.div>

            {/* Image Gallery */}
            {business.images && business.images.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                <h2 className="text-xl font-semibold text-sage-100 mb-4">Gallery</h2>
                <ImageGallery
                  images={business.images.map((url, index) => ({
                    url,
                    alt: `${business.name} - Image ${index + 1}`,
                    caption: ''
                  }))}
                  activeIndex={activeImageIndex}
                  onImageChange={setActiveImageIndex}
                  businessName={business.name}
                />
              </motion.section>
            )}

            {/* Business Description */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="prose prose-invert max-w-none"
            >
              <h2 className="text-xl font-semibold text-sage-100 mb-4">About {business.name}</h2>
              <div className="text-sage-200 leading-relaxed">
                <p>{business.description}</p>
              </div>
            </motion.section>

            {/* Reviews Section */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <BusinessReviews
                businessId={business.id}
                averageRating={business.averageRating}
                reviewCount={business.reviewCount}
              />
            </motion.section>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {/* Quick Actions */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                className="bg-gradient-to-br from-navy-800/50 to-navy-700/50 backdrop-blur-lg border border-sage/20 rounded-lg p-6"
              >
                <h3 className="text-lg font-semibold text-sage-100 mb-4">Contact & Actions</h3>
                <BusinessActions
                  business={business}
                  onBookingRequest={handleBookingRequest}
                />
              </motion.div>

              {/* Business Information */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="bg-gradient-to-br from-navy-800/50 to-navy-700/50 backdrop-blur-lg border border-sage/20 rounded-lg p-6"
              >
                <BusinessInformation business={business} />
              </motion.div>

              {/* Location Map */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="bg-gradient-to-br from-navy-800/50 to-navy-700/50 backdrop-blur-lg border border-sage/20 rounded-lg p-6"
              >
                <h3 className="text-lg font-semibold text-sage-100 mb-4 flex items-center gap-2">
                  <MapPin size={18} />
                  Location
                </h3>
                
                {/* Placeholder for map - would integrate with Google Maps or similar */}
                <div className="aspect-video bg-sage/10 rounded-lg border border-sage/20 flex items-center justify-center">
                  <div className="text-center">
                    <MapPin size={32} className="text-sage/40 mx-auto mb-2" />
                    <p className="text-sage/60 text-sm">Interactive map coming soon</p>
                    <button
                      type="button"
                      onClick={() => {
                        const address = `${business.address.street}, ${business.address.city}, ${business.address.state} ${business.address.zipCode}`
                        window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, '_blank')
                      }}
                      className="mt-2 text-sage hover:text-sage/80 text-sm underline"
                    >
                      View on Google Maps
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Similar Businesses */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="bg-gradient-to-br from-navy-800/50 to-navy-700/50 backdrop-blur-lg border border-sage/20 rounded-lg p-6"
              >
                <h3 className="text-lg font-semibold text-sage-100 mb-4">Similar Businesses</h3>
                
                {/* Placeholder for similar businesses - would be dynamically loaded */}
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-sage/5 rounded-lg border border-sage/10">
                      <div className="w-12 h-12 bg-sage/20 rounded-lg flex-shrink-0" />
                      <div className="flex-1">
                        <div className="h-4 bg-sage/20 rounded w-3/4 mb-1" />
                        <div className="h-3 bg-sage/10 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
                
                <Link
                  href={`/category/${business.category.toLowerCase().replace(/\s+/g, '-')}`}
                  className="block mt-4 text-center text-sage hover:text-sage/80 text-sm underline"
                >
                  View all {business.category} businesses
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Simple booking modal component
const BookingRequestModal: React.FC<{ business: Business; onClose: () => void }> = ({
  business,
  onClose
}) => {
  return (
    <div className="bg-gradient-to-br from-navy-800 to-navy-700 rounded-lg p-6 max-w-md w-full">
      <h3 className="text-lg font-semibold text-sage-100 mb-4">
        Book with {business.name}
      </h3>
      <p className="text-sage-200 mb-6">
        Contact this business directly to make a reservation or booking.
      </p>
      
      <div className="flex gap-3">
        {business.phone && (
          <a
            href={`tel:${business.phone}`}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-center font-medium transition-colors"
          >
            Call Now
          </a>
        )}
        
        {business.website && (
          <a
            href={business.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-4 py-2 bg-sage hover:bg-sage/90 text-navy-900 rounded-lg text-center font-medium transition-colors"
          >
            Visit Website
          </a>
        )}
      </div>
      
      <button
        type="button"
        onClick={onClose}
        className="w-full mt-3 px-4 py-2 text-sage/80 hover:text-sage text-sm transition-colors"
      >
        Cancel
      </button>
    </div>
  )
}