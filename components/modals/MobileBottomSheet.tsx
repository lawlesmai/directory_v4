'use client'

import React, { useRef, useState, useEffect } from 'react'
import { motion, PanInfo, useMotionValue, useTransform } from 'framer-motion'
import { X, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MobileBottomSheetProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  snapPoints?: number[] // Array of snap points as percentages (e.g., [0.3, 0.7, 1.0])
  initialSnap?: number // Index of initial snap point
  enableDrag?: boolean
  enableSwipeToClose?: boolean
  showHandle?: boolean
  className?: string
  headerClassName?: string
  contentClassName?: string
  onSnapChange?: (snapIndex: number) => void
}

export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  isOpen,
  onClose,
  children,
  title,
  snapPoints = [0.3, 0.7, 1.0],
  initialSnap = 0,
  enableDrag = true,
  enableSwipeToClose = true,
  showHandle = true,
  className,
  headerClassName,
  contentClassName,
  onSnapChange
}) => {
  const [currentSnapIndex, setCurrentSnapIndex] = useState(initialSnap)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  
  const y = useMotionValue(0)
  const opacity = useTransform(y, [0, 300], [1, 0])

  // Get current snap point as viewport percentage
  const currentSnapPoint = snapPoints[currentSnapIndex]
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1000

  // Handle pan gesture
  const handlePan = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!enableDrag) return
    
    const deltaY = info.delta.y
    const currentY = y.get()
    const newY = currentY + deltaY

    // Prevent dragging above the top
    if (newY < 0) {
      y.set(0)
      return
    }

    y.set(newY)
  }

  const handlePanEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!enableDrag) return
    
    setIsDragging(false)
    
    const currentY = y.get()
    const velocity = info.velocity.y
    
    // Calculate which snap point to go to
    const currentHeight = viewportHeight * currentSnapPoint - currentY
    const thresholds = snapPoints.map(point => viewportHeight * point)
    
    let targetSnapIndex = currentSnapIndex
    
    // If velocity is high enough, use velocity to determine direction
    if (Math.abs(velocity) > 500) {
      if (velocity > 0 && currentSnapIndex > 0) {
        // Swiping down, go to lower snap point
        targetSnapIndex = currentSnapIndex - 1
      } else if (velocity < 0 && currentSnapIndex < snapPoints.length - 1) {
        // Swiping up, go to higher snap point
        targetSnapIndex = currentSnapIndex + 1
      }
    } else {
      // Find closest snap point
      let closestDistance = Infinity
      thresholds.forEach((threshold, index) => {
        const distance = Math.abs(currentHeight - threshold)
        if (distance < closestDistance) {
          closestDistance = distance
          targetSnapIndex = index
        }
      })
    }

    // Check if should close
    if (enableSwipeToClose && (currentY > viewportHeight * 0.5 || (velocity > 800 && currentY > 100))) {
      onClose()
      return
    }

    // Animate to target snap point
    animateToSnap(targetSnapIndex)
  }

  const handlePanStart = () => {
    setIsDragging(true)
  }

  const animateToSnap = (snapIndex: number) => {
    if (snapIndex < 0 || snapIndex >= snapPoints.length) return
    
    setCurrentSnapIndex(snapIndex)
    onSnapChange?.(snapIndex)
    
    const targetHeight = viewportHeight * snapPoints[snapIndex]
    y.set(0) // Reset to show full height for the snap point
  }

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      
      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        case 'ArrowUp':
          if (currentSnapIndex < snapPoints.length - 1) {
            e.preventDefault()
            animateToSnap(currentSnapIndex + 1)
          }
          break
        case 'ArrowDown':
          if (currentSnapIndex > 0) {
            e.preventDefault()
            animateToSnap(currentSnapIndex - 1)
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, currentSnapIndex, snapPoints.length])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      document.body.style.paddingRight = `${window.innerWidth - document.documentElement.clientWidth}px`
    } else {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }

    return () => {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const sheetHeight = `${snapPoints[currentSnapIndex] * 100}vh`

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={onClose}
        style={{ opacity }}
      />

      {/* Bottom Sheet */}
      <motion.div
        ref={containerRef}
        className={cn(
          "relative w-full bg-gradient-to-t from-navy-900 to-navy-800",
          "border-t border-sage/20 rounded-t-2xl shadow-2xl",
          "flex flex-col overflow-hidden",
          className
        )}
        style={{
          height: sheetHeight,
          y: y
        }}
        initial={{ y: viewportHeight }}
        animate={{ y: 0 }}
        exit={{ y: viewportHeight }}
        transition={{
          type: "spring",
          damping: 30,
          stiffness: 300
        }}
        drag={enableDrag ? "y" : false}
        dragConstraints={{ top: 0, bottom: viewportHeight }}
        dragElastic={0.1}
        onPan={handlePan}
        onPanStart={handlePanStart}
        onPanEnd={handlePanEnd}
        dragMomentum={false}
      >
        {/* Drag Handle */}
        {showHandle && (
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1 bg-sage/40 rounded-full" />
          </div>
        )}

        {/* Header */}
        <div className={cn(
          "flex items-center justify-between px-6 py-4",
          "border-b border-sage/10",
          headerClassName
        )}>
          <div className="flex-1">
            {title && (
              <h2 className="text-lg font-semibold text-sage-50">
                {title}
              </h2>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Snap controls */}
            {snapPoints.length > 1 && (
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => {
                    if (currentSnapIndex < snapPoints.length - 1) {
                      animateToSnap(currentSnapIndex + 1)
                    }
                  }}
                  disabled={currentSnapIndex >= snapPoints.length - 1}
                  className={cn(
                    "p-1 text-sage/60 hover:text-sage transition-colors",
                    "disabled:opacity-30 disabled:cursor-not-allowed"
                  )}
                  aria-label="Expand"
                >
                  <ChevronUp size={16} />
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    if (currentSnapIndex > 0) {
                      animateToSnap(currentSnapIndex - 1)
                    }
                  }}
                  disabled={currentSnapIndex <= 0}
                  className={cn(
                    "p-1 text-sage/60 hover:text-sage transition-colors",
                    "disabled:opacity-30 disabled:cursor-not-allowed"
                  )}
                  aria-label="Collapse"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className={cn(
                "p-2 text-sage/60 hover:text-sage transition-colors",
                "hover:bg-sage/10 rounded-full"
              )}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div 
          ref={contentRef}
          className={cn(
            "flex-1 overflow-y-auto overscroll-contain",
            "scrollbar-thin scrollbar-thumb-sage/30 scrollbar-track-transparent",
            contentClassName
          )}
        >
          {children}
        </div>

        {/* Resize Indicator */}
        {isDragging && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2">
            <div className="px-3 py-1 bg-sage/20 text-sage text-xs rounded-full border border-sage/30">
              {Math.round(snapPoints[currentSnapIndex] * 100)}%
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

// Hook for managing bottom sheet state
export const useMobileBottomSheet = (initialOpen = false) => {
  const [isOpen, setIsOpen] = useState(initialOpen)
  const [snapIndex, setSnapIndex] = useState(0)

  const open = () => setIsOpen(true)
  const close = () => setIsOpen(false)
  const toggle = () => setIsOpen(!isOpen)

  return {
    isOpen,
    snapIndex,
    open,
    close,
    toggle,
    setSnapIndex
  }
}

// Specialized Business Detail Bottom Sheet
interface BusinessDetailBottomSheetProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  businessName?: string
  className?: string
}

export const BusinessDetailBottomSheet: React.FC<BusinessDetailBottomSheetProps> = ({
  isOpen,
  onClose,
  children,
  businessName,
  className
}) => {
  const [currentSnap, setCurrentSnap] = useState(1) // Start at medium height

  return (
    <MobileBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={businessName}
      snapPoints={[0.4, 0.7, 0.95]}
      initialSnap={currentSnap}
      onSnapChange={setCurrentSnap}
      enableSwipeToClose={true}
      className={cn(
        "backdrop-blur-xl border-t-2 border-sage/30",
        className
      )}
      headerClassName="bg-gradient-to-r from-sage/10 to-transparent"
    >
      {children}
    </MobileBottomSheet>
  )
}

export default MobileBottomSheet