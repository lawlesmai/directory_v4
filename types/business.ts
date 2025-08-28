export interface Business {
  id: string
  name: string
  category: string
  subcategory?: string
  description: string
  shortDescription?: string
  
  // Location & Contact
  address: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  coordinates?: {
    lat: number
    lng: number
  }
  phone?: string
  email?: string
  website?: string
  
  // Business Details
  price: '$' | '$$' | '$$$' | '$$$$'
  distance: number // in miles
  averageRating: number
  reviewCount: number
  hours: BusinessHours
  
  // Media & Images
  primaryImage: string
  images: string[]
  logo?: string
  
  // Status & Features
  isActive: boolean
  isVerified: boolean
  subscription: 'free' | 'premium' | 'enterprise'
  features: string[]
  badges: string[]
  
  // Business Operations
  acceptsReservations?: boolean
  deliveryAvailable?: boolean
  takeoutAvailable?: boolean
  wheelchairAccessible?: boolean
  parkingAvailable?: boolean
  
  // Timestamps
  createdAt: string
  updatedAt: string
  claimedAt?: string
}

export interface BusinessHours {
  monday?: DayHours
  tuesday?: DayHours
  wednesday?: DayHours
  thursday?: DayHours
  friday?: DayHours
  saturday?: DayHours
  sunday?: DayHours
}

export interface DayHours {
  open: string // "09:00"
  close: string // "17:00"
  isClosed?: boolean
}

export interface SearchSuggestion {
  text: string
  icon: string
  category?: string
  type: 'business' | 'category' | 'location' | 'query'
}

export interface BusinessCardProps {
  business: any
  variant?: 'grid' | 'list' | 'featured' | 'premium'
  animationDelay?: number
  onCardClick?: (business: Business) => void
  onBookmarkToggle?: (businessId: string) => void
  className?: string
}

export interface BusinessGridProps {
  businesses: Business[]
  loading?: boolean
  variant?: 'grid' | 'masonry' | 'list'
  onBusinessSelect: (business: Business) => void
  onBookmarkToggle?: (businessId: string) => void
  className?: string
}