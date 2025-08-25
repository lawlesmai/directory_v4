'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Share2, Bookmark, Phone, Mail, MapPin, Globe, Clock, Star } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Business } from '@/types/business'
import { useModal } from '@/lib/providers/ModalProvider'
import { BusinessDetailHeader } from './BusinessDetailHeader'
import { BusinessInformation } from './BusinessInformation'
import { BusinessActions } from './BusinessActions'
import { ImageGallery } from './ImageGallery'
import { BusinessReviews } from './BusinessReviews'

interface BusinessDetailModalProps {
  business: Business
  onClose?: () => void
  onBookingRequest?: (business: Business) => void
  onShareClick?: (business: Business) => void
  onBookmarkToggle?: (businessId: string) => void
  modalId?: string
  className?: string
}

export const BusinessDetailModal: React.FC<BusinessDetailModalProps> = ({
  business,
  onClose,
  onBookingRequest,
  onShareClick,
  onBookmarkToggle,
  modalId,
  className
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [showFullDescription, setShowFullDescription] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  
  const { closeModal } = useModal()

  // Handle escape key and backdrop clicks are managed by ModalProvider
  const handleClose = () => {
    if (modalId) {
      closeModal(modalId)
    }
    onClose?.()
  }

  const handleBookmarkToggle = () => {
    setIsBookmarked(!isBookmarked)
    onBookmarkToggle?.(business.id)
  }

  const handleShare = () => {
    if (navigator.share && 'canShare' in navigator) {
      navigator.share({
        title: business.name,
        text: business.shortDescription || business.description,
        url: window.location.origin + `/business/${business.category}/${business.id}`
      }).catch(console.error)
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(
        window.location.origin + `/business/${business.category}/${business.id}`
      ).then(() => {
        // Could show a toast notification here
        console.log('Link copied to clipboard')
      }).catch(console.error)
    }
    
    onShareClick?.(business)
  }

  const handleBookingRequest = () => {
    onBookingRequest?.(business)
  }

  // Scroll to top when modal content changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [business.id])

  const isLongDescription = business.description.length > 200
  const displayDescription = showFullDescription 
    ? business.description 
    : isLongDescription 
      ? business.description.slice(0, 200) + '...'
      : business.description

  return (
    <div 
      ref={modalRef}
      className={cn(
        "business-detail-modal",
        "bg-gradient-to-br from-navy-900/95 to-navy-800/95",
        "backdrop-blur-xl border border-sage/20",
        "rounded-2xl shadow-2xl overflow-hidden",
        "max-h-[95vh] flex flex-col",
        "relative",
        className
      )}
      role="dialog"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      {/* Modal Header with Close Button */}
      <div className="flex items-center justify-between p-6 pb-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-sage/20 flex items-center justify-center">
            <span className="text-sage text-sm font-semibold">
              {business.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h1 
              id="modal-title"
              className="text-xl font-bold text-sage-50 leading-tight"
            >
              {business.name}
            </h1>
            <p className="text-sage/80 text-sm font-medium">
              {business.category}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShare}
            className={cn(
              "p-2 rounded-full transition-all duration-200",
              "bg-sage/20 hover:bg-sage/30 text-sage",
              "hover:scale-105 active:scale-95",
              "focus:outline-none focus:ring-2 focus:ring-sage/50"
            )}
            aria-label={`Share ${business.name}`}
          >
            <Share2 size={18} />
          </button>
          
          <button
            type="button"
            onClick={handleBookmarkToggle}
            className={cn(
              "p-2 rounded-full transition-all duration-200",
              isBookmarked 
                ? "bg-gold-primary/20 text-gold-primary hover:bg-gold-primary/30" 
                : "bg-sage/20 hover:bg-sage/30 text-sage",
              "hover:scale-105 active:scale-95",
              "focus:outline-none focus:ring-2 focus:ring-sage/50"
            )}
            aria-label={`${isBookmarked ? 'Remove from' : 'Add to'} bookmarks`}
          >
            <Bookmark size={18} fill={isBookmarked ? "currentColor" : "none"} />
          </button>

          <button
            type="button"
            onClick={handleClose}
            className={cn(
              "p-2 rounded-full transition-all duration-200",
              "bg-red-500/20 hover:bg-red-500/30 text-red-400",
              "hover:scale-105 active:scale-95",
              "focus:outline-none focus:ring-2 focus:ring-red-500/50"
            )}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div 
        ref={contentRef}
        className="flex-1 overflow-y-auto px-6 py-4 space-y-6"
      >
        {/* Business Header with Rating and Status */}
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-4">
              {/* Rating */}
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={16}
                      className={cn(
                        star <= Math.round(business.averageRating)
                          ? "text-gold-primary fill-current"
                          : "text-gray-400"
                      )}
                    />
                  ))}
                </div>
                <span className="text-sage-100 font-semibold">
                  {business.averageRating.toFixed(1)}
                </span>
                <span className="text-sage/70 text-sm">
                  ({business.reviewCount} reviews)
                </span>
              </div>

              {/* Price Level */}
              <div className="text-sage-100 font-semibold">
                {business.price}
              </div>

              {/* Premium Badge */}
              {business.subscription === 'premium' && (
                <div className="px-3 py-1 bg-gradient-to-r from-gold-primary/20 to-gold-secondary/20 border border-gold-primary/30 rounded-full">
                  <span className="text-gold-primary text-xs font-semibold">
                    PREMIUM
                  </span>
                </div>
              )}

              {/* Verified Badge */}
              {business.isVerified && (
                <div className="px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full">
                  <span className="text-green-400 text-xs font-semibold">
                    VERIFIED
                  </span>
                </div>
              )}
            </div>

            {/* Description */}
            <div 
              id="modal-description"
              className="text-sage-200 leading-relaxed mb-6"
            >
              <p className="mb-3">{displayDescription}</p>
              {isLongDescription && (
                <button
                  type="button"
                  onClick={() => setShowFullDescription(!showFullDescription)}
                  className="text-sage font-semibold hover:text-sage/80 transition-colors"
                >
                  {showFullDescription ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>

            {/* Quick Actions */}
            <BusinessActions
              business={business}
              onBookingRequest={handleBookingRequest}
              className="mb-6"
            />
          </div>
        </div>

        {/* Image Gallery */}
        {business.images && business.images.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-sage-100 mb-4">Gallery</h3>
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
          </div>
        )}

        {/* Business Information */}
        <BusinessInformation business={business} />

        {/* Reviews Section */}
        <BusinessReviews 
          businessId={business.id}
          averageRating={business.averageRating}
          reviewCount={business.reviewCount}
        />
      </div>
    </div>
  )
}