'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import BusinessCard from '../components/BusinessCard';
import SearchBar from '../components/SearchBar';
import FilterBar from '../components/FilterBar';
import { BusinessCardSkeleton } from '../components/SkeletonLoader';
import { useBusinesses, useCategories } from '../hooks/useBusinessData';
import type { BusinessSearchParams } from '../lib/api/businesses';
import { PageErrorBoundary, ComponentErrorBoundary } from '../components/ErrorBoundary';

// Legacy sample business data for fallback
const sampleBusinesses = [
  {
    id: 1,
    name: "Cozy Downtown Café",
    category: "Coffee Shop",
    price: "$$",
    distance: "0.2 mi",
    rating: 4.9,
    reviews: 127,
    description: "Artisan coffee and fresh pastries in a warm, welcoming atmosphere...",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=250&fit=crop",
    isPremium: true,
    badges: ["✓ Verified", "🏆 Top Rated"],
    actions: ["📞 Call", "🌐 Website", "📍 Directions"]
  },
  {
    id: 2,
    name: "Elite Auto Repair",
    category: "Auto Service",
    price: "$$$",
    distance: "1.3 mi",
    rating: 4.6,
    reviews: 89,
    description: "Complete automotive service with 20+ years experience...",
    image: "https://images.unsplash.com/photo-1562967916-eb82221dfb92?w=400&h=250&fit=crop",
    isPremium: false,
    badges: ["✓ Verified", "📍 Local Business"],
    actions: ["📞 Call", "🌐 Website", "📍 Directions"]
  },
  {
    id: 3,
    name: "Bella's Italian Kitchen",
    category: "Italian Restaurant",
    price: "$$$",
    distance: "0.8 mi",
    rating: 4.8,
    reviews: 203,
    description: "Authentic Italian cuisine with fresh ingredients and family recipes...",
    image: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=250&fit=crop",
    isPremium: false,
    badges: ["✓ Verified", "👨‍👩‍👧‍👦 Family Owned"],
    actions: ["📞 Call", "🌐 Menu", "📍 Directions"]
  }
];


export default function Home() {
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [sortBy, setSortBy] = useState('Recommended');

  // Build search parameters
  const searchParams: BusinessSearchParams = useMemo(() => {
    const params: BusinessSearchParams = {
      limit: 20,
      offset: 0,
    };

    // Add search query
    if (searchQuery.trim()) {
      params.query = searchQuery.trim();
    }

    // Add category filter
    if (activeCategory && activeCategory !== 'All') {
      params.category = activeCategory;
    }

    // Add sorting
    switch (sortBy) {
      case 'Distance':
        params.sortBy = 'distance';
        params.sortOrder = 'asc';
        break;
      case 'Rating':
        params.sortBy = 'rating';
        params.sortOrder = 'desc';
        break;
      case 'Most Reviews':
        params.sortBy = 'quality_score';
        params.sortOrder = 'desc';
        break;
      default: // Recommended
        params.sortBy = 'quality_score';
        params.sortOrder = 'desc';
        break;
    }

    return params;
  }, [searchQuery, activeCategory, sortBy]);

  // Fetch businesses data
  const {
    data: businessesResponse,
    isLoading: isLoadingBusinesses,
    error: businessesError,
    refetch: refetchBusinesses,
  } = useBusinesses(searchParams);

  // Fetch categories data
  const {
    data: categoriesResponse,
    isLoading: isLoadingCategories,
    error: categoriesError,
  } = useCategories();

  // Compute derived values
  const businesses = businessesResponse?.data || [];
  const businessCount = businessesResponse?.total || 0;
  const categories = useMemo(() => {
    const dbCategories = categoriesResponse?.data || [];
    return ['All', ...dbCategories.map(cat => cat.name)];
  }, [categoriesResponse?.data]);

  // Loading states
  const isLoading = isLoadingBusinesses || isLoadingCategories;
  const hasError = businessesError || categoriesError;


  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleCategoryFilter = (category: string) => {
    setActiveCategory(category);
  };

  const handleActionClick = (action: string, businessName: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    // Simulate different actions with notifications
    const messages = {
      call: `📞 Calling ${businessName}...`,
      website: `🌐 Opening ${businessName} website...`,
      menu: `🌐 Opening ${businessName} menu...`,
      directions: `🗺️ Getting directions to ${businessName}...`
    };
    
    const actionType = action.toLowerCase().includes('call') ? 'call' :
                      action.toLowerCase().includes('website') ? 'website' :
                      action.toLowerCase().includes('menu') ? 'menu' : 'directions';
    
    showNotification(messages[actionType]);
  };

  const showNotification = (message: string) => {
    // Create a temporary notification element
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.className = 'fixed top-5 right-5 bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-6 py-3 rounded-full font-semibold z-50 transform translate-x-full transition-transform duration-300 shadow-lg';
    
    document.body.appendChild(notification);
    
    // Animate in
    requestAnimationFrame(() => {
      notification.style.transform = 'translateX(0)';
    });
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  };


  return (
    <PageErrorBoundary pageName="home">
      {/* Animated gradient background */}
      <div className="gradient-bg"></div>
      
      {/* Enhanced header with search */}
      <header className="header-glass">
        <nav className="nav-container">
          <div className="nav-brand">
            <h1>The Lawless Directory</h1>
            <span className="tagline">Find it here. Not everywhere.</span>
          </div>
          
          {/* Central search bar */}
          <SearchBar
            onSearch={handleSearch}
            placeholder="Search businesses, services, or locations..."
            initialQuery={searchQuery}
          />
          
          <div className="nav-actions">
            <button className="btn-cta">List Your Business</button>
            <button className="btn-ghost">Sign In</button>
          </div>
        </nav>
        
        {/* Filter bar */}
        <FilterBar
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryFilter}
          isLoading={isLoading}
        />
      </header>

      <main className="main-container">
        {/* Split view layout */}
        <div className="split-view">
          <section className="listings-panel">
            <div className="listings-header">
              <h2>
                {isLoading ? 'Searching...' : 
                 activeCategory === 'All' ? `${businessCount} Businesses Near You` :
                 `${businessCount} ${activeCategory} Near You`}
              </h2>
              <div className="view-controls">
                <select 
                  className="sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option>Recommended</option>
                  <option>Distance</option>
                  <option>Rating</option>
                  <option>Most Reviews</option>
                </select>
                <div className="view-toggle">
                  <button 
                    className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                    onClick={() => setViewMode('list')}
                    aria-label="List view"
                  >
                    📋
                  </button>
                  <button 
                    className={`view-btn ${viewMode === 'map' ? 'active' : ''}`}
                    onClick={() => setViewMode('map')}
                    aria-label="Map view"
                  >
                    🗺️
                  </button>
                </div>
              </div>
            </div>
            
            <div className="business-grid">
              {/* Error state */}
              {hasError && (
                <div className="col-span-full text-center py-8">
                  <div className="text-red-500 mb-4">⚠️ Unable to load businesses</div>
                  <button 
                    onClick={() => refetchBusinesses()}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Business cards - Use database data or fallback to sample */}
              {!hasError && (businesses.length > 0 ? businesses : sampleBusinesses).map((business, index) => (
                <ComponentErrorBoundary 
                  key={'id' in business ? business.id : (business as any).id}
                  componentName="BusinessCard"
                  fallback={
                    <div className="p-4 bg-gray-100 border border-gray-200 rounded-md">
                      <div className="text-sm text-gray-600">Unable to load business card</div>
                    </div>
                  }
                >
                  <BusinessCard
                    business={business}
                    index={index}
                    animationDelay={index * 150}
                    isLoading={isLoading}
                    onCardClick={(businessName) => showNotification(`📋 Showing details for: ${businessName}`)}
                    onActionClick={handleActionClick}
                  />
                </ComponentErrorBoundary>
              ))}

              {/* Loading skeleton cards */}
              {isLoading && (
                <>
                  {Array.from({ length: 6 }, (_, index) => (
                    <BusinessCardSkeleton
                      key={`skeleton-${index}`}
                      animated={true}
                    />
                  ))}
                </>
              )}

              {/* No results state */}
              {!isLoading && !hasError && businesses.length === 0 && searchQuery && (
                <div className="col-span-full text-center py-8">
                  <div className="text-gray-500 mb-4">🔍 No businesses found for "{searchQuery}"</div>
                  <p className="text-sm text-gray-400">Try adjusting your search terms or category filter</p>
                </div>
              )}
            </div>
          </section>
          
          <section 
            className={`map-panel ${viewMode === 'list' ? 'md:block hidden' : 'block'}`}
          >
            <div className="interactive-map">
              <div className="map-placeholder">
                <h3>🗺️ Interactive Map</h3>
                <p>Business locations will appear here</p>
                <p className="map-note">Map integration coming soon</p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="footer-modern">
        {/* Trust indicators */}
        <div className="trust-bar">
          <div className="trust-stat">
            <strong>2.5K+</strong>
            <span>Businesses</span>
          </div>
          <div className="trust-stat">
            <strong>10K+</strong>
            <span>Reviews</span>
          </div>
          <div className="trust-stat">
            <strong>50K+</strong>
            <span>Monthly Users</span>
          </div>
          <div className="trust-stat">
            <strong>98%</strong>
            <span>Satisfaction</span>
          </div>
        </div>
        
        {/* Footer navigation */}
        <nav className="footer-nav">
          <div className="footer-section">
            <h4>For Businesses</h4>
            <a href="#advertise">Advertise</a>
            <a href="#business-app">Business App</a>
            <a href="#support">Support</a>
          </div>
          <div className="footer-section">
            <h4>Discover</h4>
            <a href="#categories">Categories</a>
            <a href="#collections">Collections</a>
            <a href="#events">Events</a>
          </div>
          <div className="footer-section">
            <h4>The Lawless Directory</h4>
            <a href="#about">About</a>
            <a href="#careers">Careers</a>
            <a href="#press">Press</a>
            <a href="#terms">Terms</a>
            <a href="#privacy">Privacy</a>
          </div>
          <div className="footer-section">
            <h4>Connect</h4>
            <a href="#blog">Blog</a>
            <a href="#twitter">Twitter</a>
            <a href="#facebook">Facebook</a>
            <a href="#instagram">Instagram</a>
          </div>
        </nav>
        
        <div className="footer-bottom">
          <p>&copy; 2024 The Lawless Directory. All rights reserved.</p>
          <p className="footer-tagline">Building trust in local business discovery.</p>
        </div>
      </footer>
    </PageErrorBoundary>
  );
}