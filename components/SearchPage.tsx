'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchInterface } from './SearchInterface';
import { AdvancedFilterBar } from './AdvancedFilterBar';
import { BusinessCard } from './features/business/BusinessCard';
import PerformanceIndicator from './PerformanceIndicator';
import SkeletonLoader from './SkeletonLoader';
import { GlassMorphism } from './GlassMorphism';
import { BusinessDetailModal } from './modals/BusinessDetailModal';
import { BusinessDetailBottomSheet } from './modals/MobileBottomSheet';
import { useModal } from '../lib/providers/ModalProvider';
import { useSearchStore, useSearchSuggestions } from '../hooks/useSearchStore';
import { useMobileFeatures } from '../hooks/useMobileFeatures';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import type { SearchSuggestion, SearchFilters } from './SearchInterface';
import type { Business } from '../types/business';

interface SearchPageProps {
  initialQuery?: string;
  initialFilters?: Partial<SearchFilters>;
  showFilters?: boolean;
  layout?: 'mobile' | 'desktop';
}

export const SearchPage: React.FC<SearchPageProps> = ({
  initialQuery = '',
  initialFilters = {},
  showFilters = true,
  layout = 'desktop',
}) => {
  // Search store
  const {
    query,
    filters,
    results,
    isSearching,
    error,
    showSuggestions,
    selectedSuggestionIndex,
    setQuery,
    setFilters,
    executeSearch,
    setShowSuggestions,
    syncWithURL,
  } = useSearchStore();

  // Local state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(showFilters);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const mobileRef = React.useRef<HTMLDivElement>(null);
  
  // Mobile features
  const { 
    deviceInfo,
    triggerHapticFeedback,
    shareContent
  } = useMobileFeatures(mobileRef, {
    config: {
      enableGestures: true,
      enableHapticFeedback: true
    }
  });

  // Performance monitoring
  const { metrics, trackInteraction } = usePerformanceMonitor();

  // Search suggestions
  const { suggestions, isLoading: suggestionsLoading } = useSearchSuggestions(
    query, 
    showSuggestions
  );

  // Initialize from props and URL
  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
    }
    if (Object.keys(initialFilters).length > 0) {
      setFilters(initialFilters);
    }
    syncWithURL();
  }, [initialQuery, initialFilters, setQuery, setFilters, syncWithURL]);

  // Handle search execution
  const handleSearch = React.useCallback(async (searchQuery: string, searchFilters: SearchFilters) => {
    const startTime = performance.now();
    
    try {
      await executeSearch(searchQuery, searchFilters);
      triggerHapticFeedback?.('medium'); // Gentle haptic feedback on mobile
    } finally {
      trackInteraction(startTime);
    }
  }, [executeSearch, trackInteraction, triggerHapticFeedback]);

  // Handle filter changes
  const handleFilterChange = React.useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters);
    
    // Auto-execute search if we have a query
    if (query.trim()) {
      handleSearch(query, newFilters);
    }
  }, [setFilters, query, handleSearch]);

  // Modal system
  const { openModal } = useModal();

  // Handle business card interactions
  const handleBusinessSelect = React.useCallback((business: Business) => {
    setSelectedBusiness(business);
    triggerHapticFeedback?.('light'); // Light haptic feedback
    
    // Track interaction analytics if available
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'business_card_click', {
        business_id: business.id,
        business_name: business.name,
        search_query: query
      });
    }

    // Open appropriate modal based on device
    if (deviceInfo.isMobile) {
      // Use bottom sheet for mobile
      openModal({
        component: BusinessDetailBottomSheet,
        props: {
          business,
          businessName: business.name
        },
        size: 'full',
        variant: 'bottom-sheet',
        mobileVariant: 'bottom-sheet',
        backdrop: 'blur',
        urlState: true,
        urlParam: 'business'
      });
    } else {
      // Use centered modal for desktop
      openModal({
        component: BusinessDetailModal,
        props: {
          business,
          onBookingRequest: (business: Business) => {
            // Handle booking request
            console.log('Booking request for:', business.name);
          },
          onShareClick: (business: Business) => {
            // Handle share
            console.log('Share business:', business.name);
          },
          onBookmarkToggle: (businessId: string) => {
            // Handle bookmark toggle
            console.log('Toggle bookmark:', businessId);
          }
        },
        size: 'xl',
        variant: 'center',
        backdrop: 'blur',
        urlState: true,
        urlParam: 'business'
      });
    }
  }, [triggerHapticFeedback, deviceInfo.isMobile, openModal, query]);

  // Toggle advanced filters
  const toggleAdvancedFilters = React.useCallback(() => {
    setShowAdvancedFilters(!showAdvancedFilters);
  }, [showAdvancedFilters]);

  // Toggle view mode
  const toggleViewMode = React.useCallback(() => {
    setViewMode(prev => prev === 'grid' ? 'list' : 'grid');
  }, []);

  // Handle swipe gestures on mobile
  const handleSwipe = React.useCallback((direction: 'left' | 'right' | 'up' | 'down') => {
    if (direction === 'up' && !showAdvancedFilters) {
      setShowAdvancedFilters(true);
    } else if (direction === 'down' && showAdvancedFilters) {
      setShowAdvancedFilters(false);
    }
  }, [showAdvancedFilters]);

  // Enhanced suggestions with types
  const enhancedSuggestions: SearchSuggestion[] = React.useMemo(() => {
    return suggestions.map((suggestion, index) => ({
      id: suggestion.id || `suggestion-${index}`,
      text: suggestion.text || String(suggestion),
      type: (suggestion.text || String(suggestion)).includes('near me') ? 'location' : 'business',
      icon: (suggestion.text || String(suggestion)).includes('near me') ? '📍' : '🏢',
      data: {
        nearMe: (suggestion.text || String(suggestion)).includes('near me'),
      }
    }));
  }, [suggestions]);

  // Results display
  const renderResults = () => {
    if (isSearching) {
      return (
        <div className="results-loading py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonLoader.BusinessCardSkeleton key={i} />
            ))}
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="results-error py-8 text-center">
          <GlassMorphism variant="subtle" className="p-6 max-w-md mx-auto">
            <div className="text-red-500 text-lg mb-2">⚠️</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Search Error</h3>
            <p className="text-gray-600 text-sm">{error}</p>
            <button
              onClick={() => handleSearch(query, filters)}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Try Again
            </button>
          </GlassMorphism>
        </div>
      );
    }

    if (!results || results.businesses.length === 0) {
      return (
        <div className="results-empty py-8 text-center">
          <GlassMorphism variant="subtle" className="p-6 max-w-md mx-auto">
            <div className="text-gray-400 text-4xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Results Found</h3>
            <p className="text-gray-600 text-sm mb-4">
              {query 
                ? `No businesses found for "${query}"`
                : 'Try searching for businesses in your area'
              }
            </p>
            <div className="space-y-2 text-sm text-gray-500">
              <p>• Check your spelling</p>
              <p>• Try more general terms</p>
              <p>• Adjust your filters</p>
            </div>
          </GlassMorphism>
        </div>
      );
    }

    return (
      <div className="search-results">
        {/* Results Header */}
        <div className="results-header flex items-center justify-between mb-6">
          <div className="results-info">
            <h2 className="text-xl font-semibold text-gray-800">
              {query ? `Results for "${query}"` : 'All Businesses'}
            </h2>
            <p className="text-sm text-gray-600">
              {results.total.toLocaleString()} result{results.total === 1 ? '' : 's'} found
              {results.responseTime && (
                <span className="ml-2">
                  ({Math.round(results.responseTime)}ms)
                </span>
              )}
            </p>
          </div>

          {/* View Mode Toggle */}
          <div className="view-controls flex items-center gap-2">
            <button
              onClick={toggleViewMode}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
              title="Toggle view mode"
            >
              {viewMode === 'grid' ? '📋' : '⊞'}
            </button>
          </div>
        </div>

        {/* Business Results */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${viewMode}-${results.businesses.length}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className={`results-grid ${
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-4'
            }`}
          >
            {results.businesses.map((business, index) => (
              <motion.div
                key={business.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ 
                  duration: 0.2, 
                  delay: index * 0.05,
                  ease: 'easeOut'
                }}
              >
                <BusinessCard
                  business={business}
                  variant={viewMode === 'grid' ? 'grid' : 'list'}
                  animationDelay={index * 50}
                  onCardClick={handleBusinessSelect}
                  className="h-full"
                />
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Load More / Pagination */}
        {results.hasMore && (
          <div className="results-pagination mt-8 text-center">
            <button
              onClick={() => {
                // Implement load more functionality
                console.log('Load more results');
              }}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              Load More Results
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={mobileRef} className={`search-page ${deviceInfo.isMobile ? 'mobile-layout' : 'desktop-layout'}`}>
      {/* Search Interface */}
      <div className="search-section mb-6">
        <SearchInterface
          placeholder="Search businesses, services, or locations..."
          onSearch={handleSearch}
          onFilterChange={handleFilterChange}
          suggestions={enhancedSuggestions}
          isLoading={isSearching || suggestionsLoading}
          showAdvancedFilters={showAdvancedFilters}
          initialQuery={initialQuery}
          initialFilters={initialFilters}
        />
      </div>

      {/* Advanced Filters */}
      <AnimatePresence>
        {showAdvancedFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="filters-section mb-6"
          >
            <AdvancedFilterBar
              filters={filters}
              onFiltersChange={handleFilterChange}
              layout={deviceInfo.isMobile ? 'mobile' : 'horizontal'}
              showCounts={true}
              enableAnimations={true}
              isLoading={isSearching}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Performance Indicator */}
      <div className="performance-section mb-4">
        <PerformanceIndicator
          position="top-right"
          showDetails={true}
          minimized={true}
        />
      </div>

      {/* Results Section */}
      <div className="results-section">
        {renderResults()}
      </div>

      {/* Mobile-specific elements */}
      {deviceInfo.isMobile && (
        <>
          {/* Mobile Filter Toggle Button */}
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="fixed bottom-6 right-6 w-14 h-14 bg-blue-500 text-white rounded-full shadow-lg z-50 flex items-center justify-center"
            onClick={toggleAdvancedFilters}
            whileTap={{ scale: 0.95 }}
          >
            ⚙️
            {Object.keys(filters).some(key => {
              const value = filters[key as keyof SearchFilters];
              return Array.isArray(value) ? value.length > 0 : value !== null && value !== 'any';
            }) && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-xs">!</span>
              </div>
            )}
          </motion.button>

          {/* Mobile Search Stats */}
          {results && (
            <div className="mobile-stats fixed bottom-20 left-4 right-4 z-40">
              <GlassMorphism variant="subtle" className="p-2 text-center">
                <span className="text-sm text-gray-600">
                  {results.total} results • {Math.round(results.responseTime || 0)}ms
                </span>
              </GlassMorphism>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SearchPage;