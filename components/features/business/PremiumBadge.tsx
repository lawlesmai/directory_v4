'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface PremiumBadgeProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export const PremiumBadge: React.FC<PremiumBadgeProps> = ({
  className,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  }

  return (
    <motion.div
      className={cn(
        'premium-badge inline-flex items-center gap-1',
        'bg-gradient-to-r from-gold-primary to-gold-secondary',
        'text-black font-semibold rounded-full shadow-lg',
        'border border-gold-primary/20',
        sizeClasses[size],
        className
      )}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ 
        duration: 0.3,
        delay: 0.2,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      whileHover={{ 
        scale: 1.05,
        boxShadow: '0 8px 32px rgba(238, 155, 0, 0.3)'
      }}
    >
      <span className="star-icon">⭐</span>
      <span>PREMIUM</span>
    </motion.div>
  )
}