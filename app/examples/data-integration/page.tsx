/**
 * Data Integration Example Page
 * The Lawless Directory - Example of using the new data access layer
 */

'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BusinessCard } from '../../../components/features/business/BusinessCard'
import { useBusinesses, useCategories, useFeaturedBusinesses, useSearchSuggestions } from '../../../hooks/useBusinessData'
import { transformBusinessListForUI } from '../../../lib/utils/data-transformers'
import type { Business } from '../../../types/business'

export default function DataIntegrationExample() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)

  // Use the new data fetching hooks
  const { 
    data: businessesData, 
    isLoading: businessesLoading, 
    error: businessesError,
    refetch: refetchBusinesses
  } = useBusinesses({
    query: searchQuery,
    category: selectedCategory,
    location: userLocation || undefined,
    radius: 10000, // 10km
    limit: 20
  })

  const {
    data: categories,
    isLoading: categoriesLoading
  } = useCategories()

  const {
    data: featuredBusinesses,
    isLoading: featuredLoading
  } = useFeaturedBusinesses(6)

  const {
    data: searchSuggestions,
    isLoading: suggestionsLoading
  } = useSearchSuggestions(searchQuery, 5)

  // Note: Business interaction tracking would be implemented separately

  // Note: Geolocation functionality would be implemented separately
  const geolocation = null;
  const locationLoading = false;

  useEffect(() => {
    if (geolocation) {
      setUserLocation(geolocation)
    }
  }, [geolocation])

  // Use businesses data directly (transformation would happen in real implementation)
  const uiBusinesses = businessesData?.data || []
  const uiFeaturedBusinesses = featuredBusinesses?.data || []

  const handleBusinessClick = (business: any) => {
    console.log('Business clicked:', business.name)
    
    // Note: Business interaction tracking would be implemented here

    // Here you would typically navigate to the business detail page
    // router.push(`/business/${business.id}`)
  }

  const handleBookmarkToggle = (businessId: string) => {
    console.log('Bookmark toggled for business:', businessId)
    
    // Note: Business save interaction tracking would be implemented here

    // Here you would implement bookmark logic
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    refetchBusinesses()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-primary via-navy-secondary to-navy-tertiary">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto"
        >
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-sage-primary mb-4">
              Data Integration Example
            </h1>
            <p className="text-xl text-sage-secondary/80">
              Demonstrating the new Supabase data access layer
            </p>
          </div>

          {/* Search Form */}
          <motion.form 
            onSubmit={handleSearch}
            className="mb-8 bg-navy-70/30 backdrop-blur-lg border border-sage/20 rounded-lg p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label htmlFor="search" className="block text-sm font-medium text-sage-primary mb-2">
                  Search Query
                </label>
                <input
                  id="search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search businesses..."
                  className="w-full px-4 py-2 bg-navy-80/50 border border-sage/30 rounded-lg text-sage-primary placeholder-sage-primary/50 focus:outline-none focus:ring-2 focus:ring-sage/50"
                />
              </div>
              
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-sage-primary mb-2">
                  Category
                </label>
                <select
                  id="category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-2 bg-navy-80/50 border border-sage/30 rounded-lg text-sage-primary focus:outline-none focus:ring-2 focus:ring-sage/50"
                  disabled={categoriesLoading}
                >
                  <option value="">All Categories</option>
                  {categories?.data?.map((category: any) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={businessesLoading}
                  className="w-full px-6 py-2 bg-sage-primary text-navy-primary font-semibold rounded-lg hover:bg-sage-secondary transition-colors disabled:opacity-50"
                >
                  {businessesLoading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>

            {/* Location Status */}
            <div className="text-sm text-sage-secondary/70">
              Location: {
                locationLoading ? 'Getting location...' :
                userLocation ? `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}` :
                'Not available'
              }
            </div>
          </motion.form>

          {/* Search Suggestions */}
          {searchQuery.length >= 2 && (
            <motion.div
              className="mb-8 bg-navy-70/30 backdrop-blur-lg border border-sage/20 rounded-lg p-6"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
            >
              <h3 className="text-lg font-semibold text-sage-primary mb-4">Search Suggestions</h3>
              {suggestionsLoading ? (
                <p className="text-sage-secondary/70">Loading suggestions...</p>
              ) : searchSuggestions?.data && searchSuggestions.data.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {searchSuggestions.data.map((suggestion: any, index: number) => (
                    <button
                      key={index}
                      onClick={() => setSearchQuery(suggestion.suggestion || suggestion.name || suggestion)}
                      className="px-3 py-1 bg-sage/20 text-sage-primary rounded-full text-sm hover:bg-sage/30 transition-colors"
                    >
                      {suggestion.suggestion || suggestion.name || suggestion}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sage-secondary/70">No suggestions found</p>
              )}
            </motion.div>
          )}

          {/* Featured Businesses */}
          {!searchQuery && (
            <motion.section
              className="mb-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <h2 className="text-2xl font-bold text-sage-primary mb-6">Featured Businesses</h2>
              {featuredLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-96 bg-navy-70/30 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : uiFeaturedBusinesses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {uiFeaturedBusinesses.map((business, index) => (
                    <BusinessCard
                      key={business.id}
                      business={business as any}
                      animationDelay={index * 100}
                      onCardClick={handleBusinessClick}
                      onBookmarkToggle={handleBookmarkToggle}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sage-secondary/70 text-center py-12">No featured businesses found</p>
              )}
            </motion.section>
          )}

          {/* Search Results */}
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-sage-primary">
                {searchQuery ? 'Search Results' : 'All Businesses'}
              </h2>
              {businessesData && (
                <p className="text-sage-secondary/70">
                  {businessesData.total} businesses found
                </p>
              )}
            </div>

            {businessesError ? (
              <div className="text-center py-12">
                <p className="text-red-400 mb-4">Error loading businesses</p>
                <button
                  onClick={() => refetchBusinesses()}
                  className="px-6 py-2 bg-sage-primary text-navy-primary rounded-lg hover:bg-sage-secondary transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : businessesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="h-96 bg-navy-70/30 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : uiBusinesses.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {uiBusinesses.map((business, index) => (
                    <BusinessCard
                      key={business.id}
                      business={business as any}
                      animationDelay={index * 50}
                      onCardClick={handleBusinessClick}
                      onBookmarkToggle={handleBookmarkToggle}
                    />
                  ))}
                </div>
                
                {businessesData?.hasMore && (
                  <div className="text-center">
                    <button
                      onClick={() => {
                        // Implement load more functionality
                        console.log('Load more clicked')
                      }}
                      className="px-8 py-3 bg-sage-primary text-navy-primary font-semibold rounded-lg hover:bg-sage-secondary transition-colors"
                    >
                      Load More Businesses
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-sage-secondary/70 mb-4">No businesses found</p>
                <p className="text-sm text-sage-secondary/50">
                  Try adjusting your search criteria or check back later
                </p>
              </div>
            )}
          </motion.section>

          {/* Debug Information */}
          <motion.details
            className="mt-12 bg-navy-70/20 border border-sage/10 rounded-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <summary className="p-4 text-sage-primary cursor-pointer hover:bg-navy-70/30">
              Debug Information (Click to expand)
            </summary>
            <div className="p-4 border-t border-sage/10">
              <pre className="text-xs text-sage-secondary/70 overflow-auto">
                {JSON.stringify({
                  searchQuery,
                  selectedCategory,
                  userLocation,
                  businessesData: businessesData ? {
                    count: (businessesData as any).data?.length || 0,
                    total: (businessesData as any).total || 0,
                    hasMore: (businessesData as any).hasMore || false
                  } : null,
                  categoriesCount: (categories as any)?.data?.length || 0,
                  featuredCount: (featuredBusinesses as any)?.data?.length || 0,
                  loading: {
                    businesses: businessesLoading,
                    categories: categoriesLoading,
                    featured: featuredLoading,
                    location: locationLoading
                  },
                  errors: {
                    businesses: businessesError?.message,
                    location: null
                  }
                }, null, 2)}
              </pre>
            </div>
          </motion.details>
        </motion.div>
      </div>
    </div>
  )
}