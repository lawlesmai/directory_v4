import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { BusinessPageContent } from '@/components/pages/BusinessPageContent'
import { BusinessPageSkeleton } from '@/components/skeletons/BusinessPageSkeleton'
import { getBusinessBySlug, getBusinessesByCategory, getAllBusinessSlugs } from '@/lib/api/businesses'
import { Business } from '@/types/business'
import { generateBusinessJsonLd, generateBusinessBreadcrumbs } from '@/lib/utils/seo'

interface BusinessPageProps {
  params: {
    category: string
    slug: string
  }
}

// Generate metadata for SEO optimization
export async function generateMetadata({ params }: BusinessPageProps): Promise<Metadata> {
  try {
    const business = await getBusinessBySlug(params.slug)
    
    if (!business) {
      return {
        title: 'Business Not Found | The Lawless Directory',
        description: 'The requested business could not be found in our directory.'
      }
    }

    const businessUrl = `https://lawlessdirectory.com/business/${params.category}/${params.slug}`
    const description = business.shortDescription || business.description.slice(0, 160)

    return {
      title: `${business.name} - ${business.category} | The Lawless Directory`,
      description,
      keywords: [
        business.name,
        business.category,
        business.subcategory,
        business.address.city,
        business.address.state,
        'local business',
        'directory',
        ...business.features.slice(0, 3)
      ].filter(Boolean).join(', '),
      
      authors: [{ name: 'The Lawless Directory' }],
      
      openGraph: {
        title: business.name,
        description,
        type: 'business.business',
        url: businessUrl,
        siteName: 'The Lawless Directory',
        images: [
          {
            url: business.primaryImage || '/placeholder-business.jpg',
            width: 1200,
            height: 630,
            alt: `${business.name} - ${business.category}`
          },
          ...(business.images?.slice(0, 3).map(img => ({
            url: img,
            width: 800,
            height: 600,
            alt: `${business.name} gallery image`
          })) || [])
        ],
        locale: 'en_US'
      },

      twitter: {
        card: 'summary_large_image',
        title: business.name,
        description,
        images: [business.primaryImage || '/placeholder-business.jpg'],
        creator: '@LawlessDirectory'
      },

      alternates: {
        canonical: businessUrl,
        types: {
          'application/rss+xml': '/rss.xml'
        }
      },

      other: {
        'business:contact_data:street_address': business.address.street,
        'business:contact_data:locality': business.address.city,
        'business:contact_data:region': business.address.state,
        'business:contact_data:postal_code': business.address.zipCode,
        'business:contact_data:country_name': business.address.country,
        ...(business.phone && { 'business:contact_data:phone_number': business.phone }),
        ...(business.website && { 'business:contact_data:website': business.website }),
      },

      robots: {
        index: business.isActive,
        follow: business.isActive,
        googleBot: {
          index: business.isActive,
          follow: business.isActive,
          'max-video-preview': -1,
          'max-image-preview': 'large',
          'max-snippet': -1
        }
      }
    }
  } catch (error) {
    console.error('Error generating metadata for business page:', error)
    return {
      title: 'Business | The Lawless Directory',
      description: 'Discover local businesses in your area.'
    }
  }
}

// Generate static params for ISR
export async function generateStaticParams() {
  try {
    const slugs = await getAllBusinessSlugs()
    
    return slugs.map((item) => ({
      category: item.category,
      slug: item.slug
    }))
  } catch (error) {
    console.error('Error generating static params:', error)
    return []
  }
}

export default async function BusinessPage({ params }: BusinessPageProps) {
  let business: Business | null = null
  
  try {
    business = await getBusinessBySlug(params.slug)
  } catch (error) {
    console.error('Error fetching business:', error)
  }

  if (!business) {
    notFound()
  }

  // Verify the category matches
  const normalizedBusinessCategory = business.category.toLowerCase().replace(/\s+/g, '-')
  const normalizedParamCategory = params.category.toLowerCase()
  
  if (normalizedBusinessCategory !== normalizedParamCategory) {
    notFound()
  }

  // Generate structured data
  const jsonLd = generateBusinessJsonLd(business)
  const breadcrumbs = generateBusinessBreadcrumbs(business, params.category)

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([jsonLd, breadcrumbs])
        }}
      />

      <div className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800">
        <Suspense fallback={<BusinessPageSkeleton />}>
          <BusinessPageContent business={business} />
        </Suspense>
      </div>
    </>
  )
}

// Configure page for ISR
export const dynamic = 'force-static'
export const revalidate = 3600 // Revalidate every hour