'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface BusinessCardImageProps {
  src: string
  alt: string
  isHovered: boolean
  variant?: 'grid' | 'list' | 'featured' | 'premium'
}

export const BusinessCardImage: React.FC<BusinessCardImageProps> = ({
  src,
  alt,
  isHovered,
  variant = 'grid'
}) => {
  const containerClasses = {
    grid: 'h-48 w-full',
    list: 'h-32 w-48 flex-shrink-0',
    featured: 'h-64 w-full',
    premium: 'h-52 w-full'
  }

  return (
    <div className={cn('card-image relative overflow-hidden', containerClasses[variant])}>
      <motion.div
        className="w-full h-full"
        whileHover={{ scale: 1.05 }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          className={cn(
            'object-cover transition-all duration-300',
            isHovered && 'brightness-110 contrast-105'
          )}
          loading="lazy"
          sizes={variant === 'list' ? '(max-width: 768px) 192px, 192px' : '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'}
        />
      </motion.div>
      
      {/* Image overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-navy-dark/60 via-transparent to-transparent pointer-events-none" />
    </div>
  )
}