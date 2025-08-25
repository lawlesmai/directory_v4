'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X, Download, Share2, Maximize2 } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useModal } from '@/lib/providers/ModalProvider'

interface ImageData {
  url: string
  alt: string
  caption?: string
}

interface ImageGalleryProps {
  images: ImageData[]
  activeIndex: number
  onImageChange: (index: number) => void
  businessName: string
  className?: string
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  activeIndex,
  onImageChange,
  businessName,
  className
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [imageLoading, setImageLoading] = useState(true)
  
  const { openModal } = useModal()
  const imageRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Reset zoom and position when image changes
  useEffect(() => {
    setZoom(1)
    setPosition({ x: 0, y: 0 })
    setImageLoading(true)
  }, [activeIndex])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFullscreen) return

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          handlePrevious()
          break
        case 'ArrowRight':
          e.preventDefault()
          handleNext()
          break
        case 'Escape':
          e.preventDefault()
          setIsFullscreen(false)
          break
        case '+':
        case '=':
          e.preventDefault()
          handleZoomIn()
          break
        case '-':
          e.preventDefault()
          handleZoomOut()
          break
      }
    }

    if (isFullscreen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFullscreen, activeIndex])

  const handlePrevious = useCallback(() => {
    const newIndex = activeIndex > 0 ? activeIndex - 1 : images.length - 1
    onImageChange(newIndex)
  }, [activeIndex, images.length, onImageChange])

  const handleNext = useCallback(() => {
    const newIndex = activeIndex < images.length - 1 ? activeIndex + 1 : 0
    onImageChange(newIndex)
  }, [activeIndex, images.length, onImageChange])

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.5, 4))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.5, 1))
    if (zoom <= 1.5) {
      setPosition({ x: 0, y: 0 })
    }
  }

  const handleImageLoad = () => {
    setImageLoading(false)
  }

  // Pan handling for zoomed images
  const handlePanStart = () => {
    setIsDragging(true)
  }

  const handlePan = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (zoom > 1) {
      setPosition(prev => ({
        x: prev.x + info.delta.x,
        y: prev.y + info.delta.y
      }))
    }
  }

  const handlePanEnd = () => {
    setIsDragging(false)
  }

  const openFullscreen = () => {
    openModal({
      component: FullscreenImageGallery,
      props: {
        images,
        activeIndex,
        onImageChange,
        businessName
      },
      size: 'full',
      variant: 'fullscreen',
      backdrop: 'dark',
      mobileVariant: 'fullscreen'
    })
  }

  const handleShare = async () => {
    const currentImage = images[activeIndex]
    
    if (navigator.share && 'canShare' in navigator) {
      try {
        await navigator.share({
          title: `${businessName} - Image`,
          text: currentImage.caption || `Image from ${businessName}`,
          url: currentImage.url
        })
      } catch (error) {
        console.error('Error sharing:', error)
      }
    } else {
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(currentImage.url)
        // Could show toast notification here
        console.log('Image URL copied to clipboard')
      } catch (error) {
        console.error('Error copying to clipboard:', error)
      }
    }
  }

  const handleDownload = () => {
    const currentImage = images[activeIndex]
    const link = document.createElement('a')
    link.href = currentImage.url
    link.download = `${businessName.replace(/\s+/g, '_')}_image_${activeIndex + 1}.jpg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (!images || images.length === 0) {
    return (
      <div className={cn("image-gallery-empty", className)}>
        <div className="aspect-video bg-sage/10 rounded-lg flex items-center justify-center border-2 border-dashed border-sage/20">
          <div className="text-center">
            <div className="w-12 h-12 bg-sage/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-sage/60">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21,15 16,10 5,21"/>
              </svg>
            </div>
            <p className="text-sage/60 text-sm">No images available</p>
          </div>
        </div>
      </div>
    )
  }

  const currentImage = images[activeIndex]

  return (
    <div className={cn("image-gallery relative", className)}>
      {/* Main Image Display */}
      <div 
        ref={containerRef}
        className="relative aspect-video bg-navy-800 rounded-lg overflow-hidden group cursor-pointer"
        onClick={openFullscreen}
      >
        <motion.div
          ref={imageRef}
          className="relative w-full h-full"
          style={{
            scale: zoom,
            x: position.x,
            y: position.y
          }}
          drag={zoom > 1}
          dragConstraints={containerRef}
          onDragStart={handlePanStart}
          onDrag={handlePan}
          onDragEnd={handlePanEnd}
          dragElastic={0.1}
        >
          <Image
            src={currentImage.url}
            alt={currentImage.alt}
            fill
            className={cn(
              "object-cover transition-opacity duration-300",
              imageLoading ? "opacity-0" : "opacity-100"
            )}
            onLoad={handleImageLoad}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={activeIndex === 0}
          />
          
          {/* Loading overlay */}
          {imageLoading && (
            <div className="absolute inset-0 bg-navy-800 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-sage/30 border-t-sage rounded-full animate-spin" />
            </div>
          )}
        </motion.div>

        {/* Image Controls Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handlePrevious()
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all duration-200 hover:scale-110"
                aria-label="Previous image"
              >
                <ChevronLeft size={20} />
              </button>
              
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleNext()
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all duration-200 hover:scale-110"
                aria-label="Next image"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}

          {/* Action Buttons */}
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleShare()
              }}
              className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all duration-200 hover:scale-110"
              aria-label="Share image"
            >
              <Share2 size={16} />
            </button>
            
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                openFullscreen()
              }}
              className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all duration-200 hover:scale-110"
              aria-label="View fullscreen"
            >
              <Maximize2 size={16} />
            </button>
          </div>

          {/* Image Counter */}
          {images.length > 1 && (
            <div className="absolute bottom-4 right-4 px-3 py-1 bg-black/50 text-white text-sm rounded-full">
              {activeIndex + 1} / {images.length}
            </div>
          )}
        </div>
      </div>

      {/* Image Caption */}
      {currentImage.caption && (
        <p className="mt-3 text-sage-200 text-sm leading-relaxed">
          {currentImage.caption}
        </p>
      )}

      {/* Thumbnail Strip */}
      {images.length > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {images.map((image, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onImageChange(index)}
              className={cn(
                "flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-200",
                "hover:scale-105 active:scale-95",
                index === activeIndex
                  ? "border-sage ring-2 ring-sage/50"
                  : "border-sage/20 hover:border-sage/40"
              )}
              aria-label={`View image ${index + 1}`}
            >
              <Image
                src={image.url}
                alt={image.alt}
                width={64}
                height={64}
                className="w-full h-full object-cover"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Fullscreen Image Gallery Modal Component
interface FullscreenImageGalleryProps {
  images: ImageData[]
  activeIndex: number
  onImageChange: (index: number) => void
  businessName: string
  onClose: () => void
}

const FullscreenImageGallery: React.FC<FullscreenImageGalleryProps> = ({
  images,
  activeIndex,
  onImageChange,
  businessName,
  onClose
}) => {
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [imageLoading, setImageLoading] = useState(true)

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setZoom(1)
    setPosition({ x: 0, y: 0 })
    setImageLoading(true)
  }, [activeIndex])

  const handlePrevious = () => {
    const newIndex = activeIndex > 0 ? activeIndex - 1 : images.length - 1
    onImageChange(newIndex)
  }

  const handleNext = () => {
    const newIndex = activeIndex < images.length - 1 ? activeIndex + 1 : 0
    onImageChange(newIndex)
  }

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.5, 4))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.5, 1))
    if (zoom <= 1.5) {
      setPosition({ x: 0, y: 0 })
    }
  }

  const handlePan = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (zoom > 1) {
      setPosition(prev => ({
        x: prev.x + info.delta.x,
        y: prev.y + info.delta.y
      }))
    }
  }

  const currentImage = images[activeIndex]

  return (
    <div className="fullscreen-image-gallery w-screen h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 bg-gradient-to-b from-black/80 to-transparent">
        <div className="text-white">
          <h2 className="text-lg font-semibold">{businessName}</h2>
          <p className="text-white/70 text-sm">
            Image {activeIndex + 1} of {images.length}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= 1}
            className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-all duration-200 disabled:opacity-50"
            aria-label="Zoom out"
          >
            <ZoomOut size={20} />
          </button>
          
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= 4}
            className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-all duration-200 disabled:opacity-50"
            aria-label="Zoom in"
          >
            <ZoomIn size={20} />
          </button>
          
          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-all duration-200"
            aria-label="Close fullscreen"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Image */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          style={{ scale: zoom, x: position.x, y: position.y }}
          drag={zoom > 1}
          dragConstraints={containerRef}
          onDrag={handlePan}
          dragElastic={0.1}
        >
          <Image
            src={currentImage.url}
            alt={currentImage.alt}
            width={1200}
            height={800}
            className={cn(
              "max-w-full max-h-full object-contain transition-opacity duration-300",
              imageLoading ? "opacity-0" : "opacity-100"
            )}
            onLoad={() => setImageLoading(false)}
            priority
          />
          
          {imageLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </motion.div>

        {/* Navigation */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrevious}
              className="absolute left-6 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all duration-200"
              aria-label="Previous image"
            >
              <ChevronLeft size={24} />
            </button>
            
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-6 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all duration-200"
              aria-label="Next image"
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}
      </div>

      {/* Caption and Controls */}
      {currentImage.caption && (
        <div className="p-6 bg-gradient-to-t from-black/80 to-transparent">
          <p className="text-white/90 text-center">
            {currentImage.caption}
          </p>
        </div>
      )}
    </div>
  )
}