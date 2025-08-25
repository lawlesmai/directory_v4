import { Business, BusinessHours, DayHours } from '@/types/business'

/**
 * Generate JSON-LD structured data for a business
 * Following schema.org LocalBusiness specification
 */
export function generateBusinessJsonLd(business: Business) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://lawlessdirectory.com'
  const businessUrl = `${baseUrl}/business/${business.category.toLowerCase().replace(/\s+/g, '-')}/${business.id}`

  // Convert business hours to schema.org format
  const convertBusinessHours = (hours: BusinessHours) => {
    const dayMapping = {
      monday: 'Monday',
      tuesday: 'Tuesday', 
      wednesday: 'Wednesday',
      thursday: 'Thursday',
      friday: 'Friday',
      saturday: 'Saturday',
      sunday: 'Sunday'
    }

    const openingHours: string[] = []
    
    Object.entries(hours).forEach(([day, dayHours]) => {
      if (dayHours && !dayHours.isClosed) {
        const dayName = dayMapping[day as keyof typeof dayMapping]
        openingHours.push(`${dayName} ${dayHours.open}-${dayHours.close}`)
      }
    })

    return openingHours
  }

  // Determine the most specific business type
  const getBusinessType = (category: string) => {
    const categoryLower = category.toLowerCase()
    
    if (categoryLower.includes('restaurant') || categoryLower.includes('food')) return 'Restaurant'
    if (categoryLower.includes('shop') || categoryLower.includes('retail')) return 'Store'
    if (categoryLower.includes('service')) return 'ProfessionalService'
    if (categoryLower.includes('health') || categoryLower.includes('medical')) return 'MedicalOrganization'
    if (categoryLower.includes('beauty') || categoryLower.includes('salon')) return 'BeautySalon'
    if (categoryLower.includes('fitness') || categoryLower.includes('gym')) return 'ExerciseGym'
    if (categoryLower.includes('hotel') || categoryLower.includes('lodging')) return 'LodgingBusiness'
    
    return 'LocalBusiness'
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': getBusinessType(business.category),
    '@id': businessUrl,
    name: business.name,
    description: business.description,
    url: business.website || businessUrl,
    image: business.images?.length > 0 ? business.images : [business.primaryImage],
    
    // Address
    address: {
      '@type': 'PostalAddress',
      streetAddress: business.address.street,
      addressLocality: business.address.city,
      addressRegion: business.address.state,
      postalCode: business.address.zipCode,
      addressCountry: business.address.country
    },

    // Geographic coordinates
    ...(business.coordinates && {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: business.coordinates.lat,
        longitude: business.coordinates.lng
      }
    }),

    // Contact information
    ...(business.phone && { telephone: business.phone }),
    ...(business.email && { email: business.email }),

    // Business hours
    openingHoursSpecification: convertBusinessHours(business.hours).map(hours => ({
      '@type': 'OpeningHoursSpecification',
      opens: hours.split(' ')[1].split('-')[0],
      closes: hours.split(' ')[1].split('-')[1],
      dayOfWeek: hours.split(' ')[0]
    })),

    // Ratings and reviews
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: business.averageRating,
      reviewCount: business.reviewCount,
      bestRating: 5,
      worstRating: 1
    },

    // Price range
    priceRange: business.price,

    // Services and amenities
    ...(business.features.length > 0 && {
      amenityFeature: business.features.map(feature => ({
        '@type': 'LocationFeatureSpecification',
        name: feature
      }))
    }),

    // Additional business properties
    ...(business.acceptsReservations && {
      acceptsReservations: true
    }),

    ...(business.isVerified && {
      hasCredential: {
        '@type': 'EducationalOccupationalCredential',
        credentialCategory: 'Verified Business'
      }
    }),

    // Payment methods (if available)
    paymentAccepted: ['Cash', 'Credit Card'],

    // Accessibility
    ...(business.wheelchairAccessible && {
      isAccessibleForFree: true
    }),

    // Organization details
    foundingDate: business.createdAt,
    identifier: business.id,
    
    // Additional services
    ...(business.deliveryAvailable && {
      hasDeliveryMethod: {
        '@type': 'DeliveryMethod',
        deliveryMethod: 'OnSitePickup'
      }
    }),

    // Same as URL for consistency
    sameAs: business.website ? [business.website] : [],

    // Publisher information
    publisher: {
      '@type': 'Organization',
      name: 'The Lawless Directory',
      url: baseUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/logo.png`,
        width: 512,
        height: 512
      }
    },

    // Date published/updated
    datePublished: business.createdAt,
    dateModified: business.updatedAt
  }

  return jsonLd
}

/**
 * Generate breadcrumb structured data for business pages
 */
export function generateBusinessBreadcrumbs(business: Business, categorySlug: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://lawlessdirectory.com'
  
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: baseUrl
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Directory',
        item: `${baseUrl}/directory`
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: business.category,
        item: `${baseUrl}/category/${categorySlug}`
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: business.name,
        item: `${baseUrl}/business/${categorySlug}/${business.id}`
      }
    ]
  }

  return breadcrumbs
}

/**
 * Generate structured data for business review
 */
export function generateReviewJsonLd(business: Business, review: any) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://lawlessdirectory.com'
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    '@id': `${baseUrl}/business/${business.category.toLowerCase().replace(/\s+/g, '-')}/${business.id}#review-${review.id}`,
    itemReviewed: {
      '@type': 'LocalBusiness',
      name: business.name,
      '@id': `${baseUrl}/business/${business.category.toLowerCase().replace(/\s+/g, '-')}/${business.id}`
    },
    author: {
      '@type': 'Person',
      name: review.userName
    },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: review.rating,
      bestRating: 5,
      worstRating: 1
    },
    reviewBody: review.comment,
    datePublished: review.date,
    ...(review.businessResponse && {
      comment: {
        '@type': 'Comment',
        text: review.businessResponse.message,
        dateCreated: review.businessResponse.date,
        author: {
          '@type': 'Organization',
          name: business.name
        }
      }
    })
  }
}

/**
 * Generate Open Graph meta tags object for business
 */
export function generateBusinessOpenGraph(business: Business, categorySlug: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://lawlessdirectory.com'
  const businessUrl = `${baseUrl}/business/${categorySlug}/${business.id}`
  
  return {
    title: business.name,
    description: business.shortDescription || business.description.slice(0, 160),
    type: 'business.business',
    url: businessUrl,
    siteName: 'The Lawless Directory',
    images: [
      {
        url: business.primaryImage || `${baseUrl}/placeholder-business.jpg`,
        width: 1200,
        height: 630,
        alt: `${business.name} - ${business.category}`,
        type: 'image/jpeg'
      },
      ...(business.images?.slice(0, 3).map((img, index) => ({
        url: img,
        width: 800,
        height: 600,
        alt: `${business.name} gallery image ${index + 1}`,
        type: 'image/jpeg'
      })) || [])
    ],
    locale: 'en_US',
    // Business-specific Open Graph properties
    business: {
      contactData: {
        streetAddress: business.address.street,
        locality: business.address.city,
        region: business.address.state,
        postalCode: business.address.zipCode,
        country: business.address.country,
        ...(business.phone && { phoneNumber: business.phone }),
        ...(business.website && { website: business.website })
      }
    }
  }
}

/**
 * Generate Twitter Card meta tags for business
 */
export function generateBusinessTwitterCard(business: Business) {
  return {
    card: 'summary_large_image',
    site: '@LawlessDirectory',
    title: `${business.name} - ${business.category}`,
    description: business.shortDescription || business.description.slice(0, 160),
    image: business.primaryImage || '/placeholder-business.jpg',
    imageAlt: `${business.name} - ${business.category}`
  }
}

/**
 * Generate canonical URL for business page
 */
export function generateBusinessCanonicalUrl(business: Business, categorySlug: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://lawlessdirectory.com'
  return `${baseUrl}/business/${categorySlug}/${business.id}`
}

/**
 * Generate business-specific meta keywords
 */
export function generateBusinessKeywords(business: Business) {
  const keywords = [
    business.name,
    business.category,
    business.subcategory,
    business.address.city,
    business.address.state,
    'local business',
    'business directory',
    ...business.features.slice(0, 5),
    ...business.badges.slice(0, 3)
  ].filter(Boolean)

  return [...new Set(keywords)].join(', ')
}

/**
 * Generate robots meta tag based on business status
 */
export function generateBusinessRobots(business: Business) {
  const isIndexable = business.isActive && !business.name.toLowerCase().includes('test')
  
  return {
    index: isIndexable,
    follow: isIndexable,
    nocache: !isIndexable,
    googleBot: {
      index: isIndexable,
      follow: isIndexable,
      noimageindex: !isIndexable,
      'max-video-preview': isIndexable ? -1 : 0,
      'max-image-preview': isIndexable ? 'large' : 'none',
      'max-snippet': isIndexable ? -1 : 0
    }
  }
}

/**
 * Generate hreflang alternatives for international businesses
 */
export function generateBusinessHreflang(business: Business, categorySlug: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://lawlessdirectory.com'
  const businessPath = `/business/${categorySlug}/${business.id}`
  
  // For now, only English - could expand for international businesses
  return {
    'en-US': `${baseUrl}${businessPath}`,
    'x-default': `${baseUrl}${businessPath}`
  }
}