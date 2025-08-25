import { Business } from '@/types/business'

export const mockBusiness: Business = {
  id: '1',
  name: 'Cozy Downtown Café',
  category: 'Coffee Shop',
  subcategory: 'Artisan Coffee',
  description: 'Artisan coffee and fresh pastries in a warm, welcoming atmosphere perfect for work or relaxation.',
  shortDescription: 'Artisan coffee and fresh pastries...',
  
  address: {
    street: '123 Main Street',
    city: 'Downtown',
    state: 'CA',
    zipCode: '90210',
    country: 'US'
  },
  coordinates: {
    lat: 34.0522,
    lng: -118.2437
  },
  phone: '(555) 123-4567',
  email: 'info@cozydowntowncafe.com',
  website: 'https://cozydowntowncafe.com',
  
  price: '$$',
  distance: 0.2,
  averageRating: 4.9,
  reviewCount: 127,
  hours: {
    monday: { open: '07:00', close: '19:00' },
    tuesday: { open: '07:00', close: '19:00' },
    wednesday: { open: '07:00', close: '19:00' },
    thursday: { open: '07:00', close: '19:00' },
    friday: { open: '07:00', close: '20:00' },
    saturday: { open: '08:00', close: '20:00' },
    sunday: { open: '08:00', close: '18:00' }
  },
  
  primaryImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=250&fit=crop',
  images: [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=250&fit=crop',
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&h=250&fit=crop'
  ],
  logo: '/logos/cozy-cafe-logo.png',
  
  isActive: true,
  isVerified: true,
  subscription: 'premium',
  features: ['Wi-Fi', 'Pet Friendly', 'Outdoor Seating', 'Live Music'],
  badges: ['✓ Verified', '🏆 Top Rated'],
  
  acceptsReservations: true,
  deliveryAvailable: true,
  takeoutAvailable: true,
  wheelchairAccessible: true,
  parkingAvailable: true,
  
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-08-24T00:00:00Z',
  claimedAt: '2024-01-15T00:00:00Z'
}

export const mockBusinessFree: Business = {
  ...mockBusiness,
  id: '2',
  name: 'Elite Auto Repair',
  category: 'Auto Service',
  subscription: 'free',
  primaryImage: 'https://images.unsplash.com/photo-1562967916-eb82221dfb92?w=400&h=250&fit=crop',
  averageRating: 4.6,
  reviewCount: 89,
  distance: 1.3,
  price: '$$$',
  badges: ['✓ Verified', '📍 Local Business']
}

export const mockBusinesses: Business[] = [
  mockBusiness,
  mockBusinessFree,
  {
    ...mockBusiness,
    id: '3',
    name: "Bella's Italian Kitchen",
    category: 'Italian Restaurant',
    subscription: 'free',
    primaryImage: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=250&fit=crop',
    averageRating: 4.8,
    reviewCount: 203,
    distance: 0.8,
    price: '$$$',
    badges: ['✓ Verified', '👨‍👩‍👧‍👦 Family Owned']
  }
]