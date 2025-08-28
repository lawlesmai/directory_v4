'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassMorphism } from './GlassMorphism';
import { SearchSuggestions } from './SearchSuggestions';
import { useDebounce } from '../hooks/useDebounce';
import { useCommonShortcuts } from '../hooks/useKeyboardShortcuts';

// Enhanced search suggestion type
export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'business' | 'category' | 'location' | 'service' | 'recent';
  icon: string;
  data?: {
    category?: string;
    nearMe?: boolean;
    sortBy?: string;
    distance?: number;
    rating?: number;
  };
}

// Search filters interface
export interface SearchFilters {
  categories: string[];
  rating: number | null;
  distance: number; // radius in miles
  priceRange: [number, number] | null;
  businessHours: 'any' | 'open_now' | 'open_24_7' | 'open_weekends';
  verification: 'any' | 'verified_only';
  subscription: 'any' | 'premium_only';
  location: {
    lat: number;
    lng: number;
    address: string;
  } | null;
}

// Component props
export interface SearchInterfaceProps {
  placeholder?: string;
  onSearch: (query: string, filters: SearchFilters) => void;
  onFilterChange: (filters: SearchFilters) => void;
  suggestions?: SearchSuggestion[];
  isLoading?: boolean;
  className?: string;
  showAdvancedFilters?: boolean;
  initialQuery?: string;
  initialFilters?: Partial<SearchFilters>;
}

// Default filters
const defaultFilters: SearchFilters = {
  categories: [],
  rating: null,
  distance: 25, // 25 mile radius
  priceRange: null,
  businessHours: 'any',
  verification: 'any',
  subscription: 'any',
  location: null,
};

export const SearchInterface: React.FC<SearchInterfaceProps> = ({
  placeholder = "Search businesses, services, or locations...",
  onSearch,
  onFilterChange,
  suggestions = [],
  isLoading = false,
  className = "",
  showAdvancedFilters = false,
  initialQuery = "",
  initialFilters = {},
}) => {
  // State management
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<SearchFilters>({
    ...defaultFilters,
    ...initialFilters,
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [isExpanded, setIsExpanded] = useState(showAdvancedFilters);
  const [locationLoading, setLocationLoading] = useState(false);

  // Refs
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const suggestionsRef = React.useRef<HTMLDivElement>(null);

  // Debounced search query
  const debouncedQuery = useDebounce(query, 300);

  // Keyboard shortcuts
  useCommonShortcuts({
    onSearch: () => {
      searchInputRef.current?.focus();
      setShowSuggestions(true);
    },
    onEscape: () => {
      setShowSuggestions(false);
      searchInputRef.current?.blur();
    },
  });

  // Handle search execution
  const executeSearch = useCallback(() => {
    if (query.trim()) {
      onSearch(query.trim(), filters);
      setShowSuggestions(false);
    }
  }, [query, filters, onSearch]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setShowSuggestions(true);
    setSelectedSuggestionIndex(-1);
  }, []);

  // Handle form submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    executeSearch();
  }, [executeSearch]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: SearchSuggestion, index: number) => {
    setQuery(suggestion.text);
    setSelectedSuggestionIndex(index);
    setShowSuggestions(false);
    
    // Apply suggestion-specific filters
    if (suggestion.data) {
      const newFilters = { ...filters };
      
      if (suggestion.data.category) {
        newFilters.categories = [suggestion.data.category];
      }
      
      if (suggestion.data.rating) {
        newFilters.rating = suggestion.data.rating;
      }
      
      if (suggestion.data.nearMe && filters.location) {
        newFilters.distance = Math.min(filters.distance, 10); // Limit to 10 miles for "near me"
      }
      
      setFilters(newFilters);
      onFilterChange(newFilters);
    }
    
    onSearch(suggestion.text, filters);
  }, [filters, onFilterChange, onSearch]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => prev > -1 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
          handleSuggestionSelect(suggestions[selectedSuggestionIndex], selectedSuggestionIndex);
        } else {
          executeSearch();
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  }, [showSuggestions, suggestions, selectedSuggestionIndex, handleSuggestionSelect, executeSearch]);

  // Handle "Near Me" geolocation
  const handleNearMeClick = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newFilters = {
          ...filters,
          location: {
            lat: latitude,
            lng: longitude,
            address: 'Your Location',
          },
        };
        setFilters(newFilters);
        onFilterChange(newFilters);
        setLocationLoading(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to get your location. Please check your browser settings.');
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  }, [filters, onFilterChange]);

  // Clear search
  const clearSearch = useCallback(() => {
    setQuery('');
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    searchInputRef.current?.focus();
  }, []);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    const newFilters = { ...defaultFilters };
    setFilters(newFilters);
    onFilterChange(newFilters);
  }, [onFilterChange]);

  // Toggle advanced filters
  const toggleAdvancedFilters = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.categories.length > 0) count++;
    if (filters.rating !== null) count++;
    if (filters.priceRange !== null) count++;
    if (filters.businessHours !== 'any') count++;
    if (filters.verification !== 'any') count++;
    if (filters.subscription !== 'any') count++;
    if (filters.location !== null) count++;
    return count;
  }, [filters]);

  // Effect to trigger search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      // Trigger suggestion loading here if needed
    }
  }, [debouncedQuery]);

  return (
    <div className={`search-interface relative ${className}`} data-testid="search-interface">
      <form onSubmit={handleSubmit} className="search-form">
        <GlassMorphism
          variant="medium"
          className="search-container overflow-visible"
          animated
          interactive
        >
          {/* Main Search Input Row */}
          <div className="flex items-center gap-3 p-4">
            {/* Search Icon */}
            <motion.div
              animate={{ 
                rotate: isLoading ? 360 : 0,
                scale: isLoading ? 1.1 : 1,
              }}
              transition={{ 
                rotate: { repeat: isLoading ? Infinity : 0, duration: 1, ease: "linear" },
                scale: { duration: 0.2 },
              }}
              className="search-icon flex-shrink-0 text-gray-500"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
              ) : (
                <span className="text-lg">🔍</span>
              )}
            </motion.div>

            {/* Search Input */}
            <input
              ref={searchInputRef}
              type="search"
              placeholder={placeholder}
              className="search-input flex-1 bg-transparent border-none outline-none text-gray-800 placeholder-gray-500 text-base font-medium"
              value={query}
              onChange={handleInputChange}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              data-testid="search-input"
              disabled={isLoading}
              aria-label="Search businesses, services, or locations"
              aria-expanded={showSuggestions}
              aria-haspopup="listbox"
              aria-autocomplete="list"
              role="combobox"
            />

            {/* Clear Button */}
            <AnimatePresence>
              {query && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  type="button"
                  onClick={clearSearch}
                  className="clear-button p-1 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
                  aria-label="Clear search"
                  data-testid="clear-button"
                >
                  <span className="text-gray-400 text-sm">✕</span>
                </motion.button>
              )}
            </AnimatePresence>

            {/* Near Me Button */}
            <motion.button
              type="button"
              onClick={handleNearMeClick}
              disabled={locationLoading}
              className={`
                near-me-button p-2 rounded-lg transition-all duration-200 flex-shrink-0
                ${filters.location 
                  ? 'bg-green-100 text-green-600 shadow-sm' 
                  : 'hover:bg-gray-100 text-gray-500'
                }
                ${locationLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
              `}
              aria-label="Find businesses near me"
              data-testid="near-me-button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {locationLoading ? (
                <div className="w-4 h-4 border-2 border-gray-300 border-t-green-500 rounded-full animate-spin" />
              ) : (
                <span className="text-sm">📍</span>
              )}
            </motion.button>

            {/* Advanced Filters Toggle */}
            <motion.button
              type="button"
              onClick={toggleAdvancedFilters}
              className={`
                filters-toggle p-2 rounded-lg transition-all duration-200 flex-shrink-0 relative
                ${isExpanded || activeFiltersCount > 0
                  ? 'bg-blue-100 text-blue-600 shadow-sm' 
                  : 'hover:bg-gray-100 text-gray-500'
                }
              `}
              aria-label={`${isExpanded ? 'Hide' : 'Show'} advanced filters`}
              data-testid="filters-toggle"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="text-sm">⚙️</span>
              {activeFiltersCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center"
                >
                  {activeFiltersCount}
                </motion.span>
              )}
            </motion.button>

            {/* Search Button */}
            <motion.button
              type="submit"
              className="search-button px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium text-sm flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || !query.trim()}
              aria-label="Search"
              data-testid="search-button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Search
            </motion.button>
          </div>

          {/* Advanced Filters Panel */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="advanced-filters border-t border-gray-100 p-4 space-y-4"
                data-testid="advanced-filters"
              >
                {/* Filter Categories Row */}
                <div className="filter-row flex flex-wrap gap-2">
                  <span className="text-sm font-medium text-gray-600 w-full mb-2">Categories:</span>
                  {['Restaurants', 'Auto Services', 'Health & Beauty', 'Professional Services', 'Shopping', 'Home Services'].map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => {
                        const newCategories = filters.categories.includes(category)
                          ? filters.categories.filter(c => c !== category)
                          : [...filters.categories, category];
                        const newFilters = { ...filters, categories: newCategories };
                        setFilters(newFilters);
                        onFilterChange(newFilters);
                      }}
                      className={`
                        px-3 py-1 rounded-full text-sm font-medium transition-colors
                        ${filters.categories.includes(category)
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }
                      `}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                {/* Rating and Distance Row */}
                <div className="filter-row grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rating-filter">
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Minimum Rating:
                    </label>
                    <select
                      value={filters.rating || ''}
                      onChange={(e) => {
                        const rating = e.target.value ? Number(e.target.value) : null;
                        const newFilters = { ...filters, rating };
                        setFilters(newFilters);
                        onFilterChange(newFilters);
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      <option value="">Any Rating</option>
                      <option value="4.5">4.5+ Stars</option>
                      <option value="4.0">4.0+ Stars</option>
                      <option value="3.5">3.5+ Stars</option>
                      <option value="3.0">3.0+ Stars</option>
                    </select>
                  </div>

                  <div className="distance-filter">
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Distance: {filters.distance} miles
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={filters.distance}
                      onChange={(e) => {
                        const distance = Number(e.target.value);
                        const newFilters = { ...filters, distance };
                        setFilters(newFilters);
                        onFilterChange(newFilters);
                      }}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>1 mi</span>
                      <span>25 mi</span>
                      <span>50+ mi</span>
                    </div>
                  </div>
                </div>

                {/* Business Hours and Verification Row */}
                <div className="filter-row grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="hours-filter">
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Business Hours:
                    </label>
                    <select
                      value={filters.businessHours}
                      onChange={(e) => {
                        const businessHours = e.target.value as SearchFilters['businessHours'];
                        const newFilters = { ...filters, businessHours };
                        setFilters(newFilters);
                        onFilterChange(newFilters);
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      <option value="any">Any Hours</option>
                      <option value="open_now">Open Now</option>
                      <option value="open_24_7">Open 24/7</option>
                      <option value="open_weekends">Open Weekends</option>
                    </select>
                  </div>

                  <div className="verification-filter">
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Verification:
                    </label>
                    <div className="flex gap-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={filters.verification === 'verified_only'}
                          onChange={(e) => {
                            const verification = e.target.checked ? 'verified_only' as const : 'any' as const;
                            const newFilters = { ...filters, verification };
                            setFilters(newFilters);
                            onFilterChange(newFilters);
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm">Verified Only</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={filters.subscription === 'premium_only'}
                          onChange={(e) => {
                            const subscription = e.target.checked ? 'premium_only' as const : 'any' as const;
                            const newFilters = { ...filters, subscription };
                            setFilters(newFilters);
                            onFilterChange(newFilters);
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm">Premium Only</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Clear Filters Button */}
                {activeFiltersCount > 0 && (
                  <div className="filter-actions">
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="text-sm text-red-600 hover:text-red-700 underline"
                      data-testid="clear-all-filters"
                    >
                      Clear All Filters ({activeFiltersCount})
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </GlassMorphism>

        {/* Keyboard Shortcut Hint */}
        <div className="search-hint text-xs text-gray-400 mt-2 text-center">
          Press <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">⌘K</kbd> or <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Ctrl+K</kbd> to focus search
        </div>
      </form>

      {/* Search Suggestions */}
      <div ref={suggestionsRef}>
        <SearchSuggestions
          suggestions={suggestions}
          selectedIndex={selectedSuggestionIndex}
          onSelect={handleSuggestionSelect}
          onClose={() => setShowSuggestions(false)}
          isVisible={showSuggestions}
          loading={isLoading}
          maxHeight={400}
          className="suggestions-container"
        />
      </div>
    </div>
  );
};

export default SearchInterface;