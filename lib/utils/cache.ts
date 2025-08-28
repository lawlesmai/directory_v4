/**
 * Cache Utilities - Performance Optimization
 * The Lawless Directory - Client-side and server-side caching utilities
 */

import { QueryClient } from '@tanstack/react-query'

// Server-side in-memory cache interface
interface CacheItem {
  value: any;
  expiry: number;
}

// Simple in-memory cache for server-side API responses
class ServerCache {
  private cache = new Map<string, CacheItem>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries every 5 minutes
    if (typeof process !== 'undefined') {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, 5 * 60 * 1000);
    }
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  set(key: string, value: any, ttl: number): void {
    const expiry = Date.now() + ttl;
    this.cache.set(key, { value, expiry });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }
}

// Export singleton cache instance
export const cache = new ServerCache();

// Create a singleton QueryClient instance for server-side rendering
let queryClient: QueryClient | undefined = undefined

export const getQueryClient = () => {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000, // 5 minutes
          gcTime: 10 * 60 * 1000, // 10 minutes
        },
      },
    })
  } else {
    // Browser: make a new query client if we don't already have one
    if (!queryClient) {
      queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error: any) => {
              if (error?.message?.includes('not found') || 
                  error?.message?.includes('permission')) {
                return false
              }
              return failureCount < 3
            },
          },
        },
      })
    }
    return queryClient
  }
}

// Cache keys for consistent caching
export const CACHE_KEYS = {
  BUSINESSES: 'businesses',
  BUSINESS_DETAIL: 'business-detail',
  CATEGORIES: 'categories',
  FEATURED: 'featured',
  SEARCH: 'search',
  NEARBY: 'nearby',
  REVIEWS: 'reviews'
} as const

// Cache durations in milliseconds
export const CACHE_DURATIONS = {
  SHORT: 2 * 60 * 1000,      // 2 minutes
  MEDIUM: 5 * 60 * 1000,     // 5 minutes
  LONG: 15 * 60 * 1000,      // 15 minutes
  VERY_LONG: 30 * 60 * 1000  // 30 minutes
} as const

// Performance monitoring utilities
export const performanceMonitor = {
  startTiming: (label: string) => {
    if (typeof window !== 'undefined' && window.performance) {
      performance.mark(`${label}-start`)
    }
  },

  endTiming: (label: string) => {
    if (typeof window !== 'undefined' && window.performance) {
      performance.mark(`${label}-end`)
      performance.measure(label, `${label}-start`, `${label}-end`)
      
      // Get the measurement
      const measure = performance.getEntriesByName(label, 'measure')[0]
      if (measure) {
        console.debug(`Performance: ${label} took ${measure.duration.toFixed(2)}ms`)
      }
    }
  }
}

// Image optimization utilities
export const optimizeImageUrl = (url: string | null | undefined, width?: number, height?: number): string => {
  if (!url) {
    return '/placeholder.jpg' // Default placeholder image
  }

  // If it's already a Supabase storage URL, we can add transform parameters
  if (url.includes('supabase.co/storage')) {
    const transformParams: string[] = []
    if (width) transformParams.push(`width=${width}`)
    if (height) transformParams.push(`height=${height}`)
    transformParams.push('quality=80') // Optimize quality
    
    if (transformParams.length > 0) {
      const separator = url.includes('?') ? '&' : '?'
      return `${url}${separator}${transformParams.join('&')}`
    }
  }

  return url
}

// Debounce utility for search
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Throttle utility for scroll events
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

// Local storage utilities with error handling
export const storage = {
  get: (key: string, defaultValue: any = null) => {
    if (typeof window === 'undefined') return defaultValue

    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue
    } catch (error) {
      console.warn(`Error reading from localStorage:`, error)
      return defaultValue
    }
  },

  set: (key: string, value: any) => {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.warn(`Error writing to localStorage:`, error)
    }
  },

  remove: (key: string) => {
    if (typeof window === 'undefined') return

    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.warn(`Error removing from localStorage:`, error)
    }
  }
}

// Session storage utilities
export const sessionStorage = {
  get: (key: string, defaultValue: any = null) => {
    if (typeof window === 'undefined') return defaultValue

    try {
      const item = window.sessionStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue
    } catch (error) {
      console.warn(`Error reading from sessionStorage:`, error)
      return defaultValue
    }
  },

  set: (key: string, value: any) => {
    if (typeof window === 'undefined') return

    try {
      window.sessionStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.warn(`Error writing to sessionStorage:`, error)
    }
  },

  remove: (key: string) => {
    if (typeof window === 'undefined') return

    try {
      window.sessionStorage.removeItem(key)
    } catch (error) {
      console.warn(`Error removing from sessionStorage:`, error)
    }
  }
}

// Intersection Observer for lazy loading
export const createIntersectionObserver = (
  callback: IntersectionObserverCallback,
  options: IntersectionObserverInit = {}
): IntersectionObserver | null => {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return null
  }

  return new IntersectionObserver(callback, {
    rootMargin: '50px',
    threshold: 0.1,
    ...options
  })
}

// Network status utilities
export const getNetworkStatus = () => {
  if (typeof window === 'undefined' || !('navigator' in window)) {
    return { online: true, effectiveType: 'unknown' }
  }

  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
  
  return {
    online: navigator.onLine,
    effectiveType: connection?.effectiveType || 'unknown',
    downlink: connection?.downlink || 0,
    rtt: connection?.rtt || 0
  }
}

// Performance-based query configurations
export const getQueryConfig = () => {
  const network = getNetworkStatus()
  
  // Adjust query settings based on network conditions
  if (!network.online) {
    return {
      staleTime: Infinity, // Use cached data when offline
      retry: false,
      refetchOnWindowFocus: false
    }
  }

  if (network.effectiveType === 'slow-2g' || network.effectiveType === '2g') {
    return {
      staleTime: CACHE_DURATIONS.VERY_LONG,
      gcTime: CACHE_DURATIONS.VERY_LONG * 2,
      refetchOnWindowFocus: false,
      retry: 1
    }
  }

  return {
    staleTime: CACHE_DURATIONS.MEDIUM,
    gcTime: CACHE_DURATIONS.LONG,
    refetchOnWindowFocus: false,
    retry: 3
  }
}