'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassMorphism } from './GlassMorphism';
import type { SearchFilters } from './SearchInterface';

// Filter option interface
export interface FilterOption {
  id: string;
  label: string;
  value: string | number;
  count?: number;
  icon?: string;
  color?: string;
  category?: string;
}

// Filter group interface
export interface FilterGroup {
  id: string;
  label: string;
  type: 'single' | 'multiple' | 'range' | 'toggle';
  options: FilterOption[];
  priority: number;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

// Component props
export interface AdvancedFilterBarProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  className?: string;
  layout?: 'horizontal' | 'vertical' | 'mobile';
  showCounts?: boolean;
  enableAnimations?: boolean;
  isLoading?: boolean;
}

// Category data with hierarchy
const categoryHierarchy = [
  {
    id: 'restaurants',
    label: 'Restaurants & Food',
    icon: '🍽️',
    color: '#f59e0b',
    children: [
      { id: 'restaurants-casual', label: 'Casual Dining', icon: '🍕' },
      { id: 'restaurants-fine', label: 'Fine Dining', icon: '🍷' },
      { id: 'restaurants-fast', label: 'Fast Food', icon: '🍔' },
      { id: 'restaurants-coffee', label: 'Coffee & Cafes', icon: '☕' },
      { id: 'restaurants-bars', label: 'Bars & Pubs', icon: '🍺' },
    ]
  },
  {
    id: 'auto-services',
    label: 'Auto Services',
    icon: '🚗',
    color: '#3b82f6',
    children: [
      { id: 'auto-repair', label: 'Auto Repair', icon: '🔧' },
      { id: 'auto-dealers', label: 'Car Dealers', icon: '🚙' },
      { id: 'auto-parts', label: 'Auto Parts', icon: '⚙️' },
      { id: 'auto-wash', label: 'Car Wash', icon: '🧽' },
    ]
  },
  {
    id: 'health-beauty',
    label: 'Health & Beauty',
    icon: '💄',
    color: '#ec4899',
    children: [
      { id: 'health-doctors', label: 'Doctors', icon: '👩‍⚕️' },
      { id: 'health-dentists', label: 'Dentists', icon: '🦷' },
      { id: 'health-salons', label: 'Hair Salons', icon: '💇‍♀️' },
      { id: 'health-spas', label: 'Spas', icon: '🧖‍♀️' },
      { id: 'health-fitness', label: 'Fitness', icon: '💪' },
    ]
  },
  {
    id: 'professional-services',
    label: 'Professional Services',
    icon: '💼',
    color: '#6b7280',
    children: [
      { id: 'prof-legal', label: 'Legal', icon: '⚖️' },
      { id: 'prof-accounting', label: 'Accounting', icon: '💰' },
      { id: 'prof-consulting', label: 'Consulting', icon: '📊' },
      { id: 'prof-marketing', label: 'Marketing', icon: '📢' },
    ]
  },
  {
    id: 'shopping',
    label: 'Shopping & Retail',
    icon: '🛍️',
    color: '#8b5cf6',
    children: [
      { id: 'shop-clothing', label: 'Clothing', icon: '👕' },
      { id: 'shop-electronics', label: 'Electronics', icon: '📱' },
      { id: 'shop-grocery', label: 'Grocery', icon: '🛒' },
      { id: 'shop-home', label: 'Home & Garden', icon: '🏡' },
    ]
  },
  {
    id: 'home-services',
    label: 'Home Services',
    icon: '🏠',
    color: '#10b981',
    children: [
      { id: 'home-cleaning', label: 'Cleaning', icon: '🧹' },
      { id: 'home-repairs', label: 'Repairs', icon: '🔨' },
      { id: 'home-landscaping', label: 'Landscaping', icon: '🌳' },
      { id: 'home-plumbing', label: 'Plumbing', icon: '🚰' },
    ]
  },
];

export const AdvancedFilterBar: React.FC<AdvancedFilterBarProps> = ({
  filters,
  onFiltersChange,
  className = "",
  layout = 'horizontal',
  showCounts = false,
  enableAnimations = true,
  isLoading = false,
}) => {
  // State for UI interactions
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['categories']));
  const [hoveredFilter, setHoveredFilter] = useState<string | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, height: 0 },
    visible: { 
      opacity: 1, 
      height: 'auto',
      transition: {
        duration: 0.3,
        staggerChildren: 0.1,
        delayChildren: 0.1
      }
    },
    exit: { opacity: 0, height: 0 }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  // Toggle category selection
  const handleCategoryToggle = useCallback((categoryId: string) => {
    const newCategories = filters.categories.includes(categoryId)
      ? filters.categories.filter(id => id !== categoryId)
      : [...filters.categories, categoryId];
    
    onFiltersChange({
      ...filters,
      categories: newCategories
    });
  }, [filters, onFiltersChange]);

  // Update rating filter
  const handleRatingChange = useCallback((rating: number | null) => {
    onFiltersChange({
      ...filters,
      rating
    });
  }, [filters, onFiltersChange]);

  // Update distance filter
  const handleDistanceChange = useCallback((distance: number) => {
    onFiltersChange({
      ...filters,
      distance
    });
  }, [filters, onFiltersChange]);

  // Update price range filter
  const handlePriceRangeChange = useCallback((priceRange: [number, number] | null) => {
    onFiltersChange({
      ...filters,
      priceRange
    });
  }, [filters, onFiltersChange]);

  // Update business hours filter
  const handleBusinessHoursChange = useCallback((businessHours: SearchFilters['businessHours']) => {
    onFiltersChange({
      ...filters,
      businessHours
    });
  }, [filters, onFiltersChange]);

  // Toggle group expansion
  const toggleGroup = useCallback((groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  }, [expandedGroups]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    onFiltersChange({
      categories: [],
      rating: null,
      distance: 25,
      priceRange: null,
      businessHours: 'any',
      verification: 'any',
      subscription: 'any',
      location: filters.location, // Keep location
    });
  }, [filters.location, onFiltersChange]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.categories.length > 0) count += filters.categories.length;
    if (filters.rating !== null) count++;
    if (filters.priceRange !== null) count++;
    if (filters.businessHours !== 'any') count++;
    if (filters.verification !== 'any') count++;
    if (filters.subscription !== 'any') count++;
    return count;
  }, [filters]);

  // Categories to display
  const visibleCategories = useMemo(() => {
    if (showAllCategories) {
      return categoryHierarchy;
    }
    return categoryHierarchy.slice(0, 6);
  }, [showAllCategories]);

  // Mobile layout
  if (layout === 'mobile') {
    return (
      <div className={`advanced-filter-bar mobile-layout ${className}`}>
        <GlassMorphism variant="subtle" className="p-4" animated={enableAnimations}>
          {/* Mobile Filter Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Filters</h3>
            {activeFiltersCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  {activeFiltersCount} active
                </span>
                <button
                  onClick={clearAllFilters}
                  className="text-sm text-red-600 hover:text-red-700 underline"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Collapsible Filter Sections */}
          <div className="space-y-4">
            {/* Categories Section */}
            <div className="filter-section">
              <button
                onClick={() => toggleGroup('categories')}
                className="flex items-center justify-between w-full text-left font-medium text-gray-700 mb-2"
              >
                Categories
                <motion.span
                  animate={{ rotate: expandedGroups.has('categories') ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  ↓
                </motion.span>
              </button>
              
              <AnimatePresence>
                {expandedGroups.has('categories') && (
                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="space-y-2"
                  >
                    {visibleCategories.map((category) => (
                      <motion.button
                        key={category.id}
                        variants={itemVariants}
                        onClick={() => handleCategoryToggle(category.id)}
                        className={`
                          w-full flex items-center gap-3 p-3 rounded-lg transition-all
                          ${filters.categories.includes(category.id)
                            ? 'bg-blue-50 border-2 border-blue-200 text-blue-800'
                            : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                          }
                        `}
                        data-testid={`category-${category.id}`}
                      >
                        <span style={{ color: category.color }}>{category.icon}</span>
                        <span className="flex-1 text-left">{category.label}</span>
                        {showCounts && (
                          <span className="text-xs text-gray-500">
                            {Math.floor(Math.random() * 50) + 1}
                          </span>
                        )}
                      </motion.button>
                    ))}
                    
                    {categoryHierarchy.length > 6 && (
                      <button
                        onClick={() => setShowAllCategories(!showAllCategories)}
                        className="w-full text-center text-sm text-blue-600 hover:text-blue-700 py-2"
                      >
                        {showAllCategories ? 'Show Less' : `Show ${categoryHierarchy.length - 6} More`}
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Rating Section */}
            <div className="filter-section">
              <button
                onClick={() => toggleGroup('rating')}
                className="flex items-center justify-between w-full text-left font-medium text-gray-700 mb-2"
              >
                Rating
                <motion.span
                  animate={{ rotate: expandedGroups.has('rating') ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  ↓
                </motion.span>
              </button>
              
              <AnimatePresence>
                {expandedGroups.has('rating') && (
                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="space-y-2"
                  >
                    {[4.5, 4.0, 3.5, 3.0].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => handleRatingChange(rating)}
                        className={`
                          w-full flex items-center gap-2 p-2 rounded-lg transition-all text-left
                          ${filters.rating === rating
                            ? 'bg-yellow-50 border-2 border-yellow-200 text-yellow-800'
                            : 'hover:bg-gray-100'
                          }
                        `}
                      >
                        <div className="flex">
                          {Array.from({ length: 5 }, (_, i) => (
                            <span
                              key={i}
                              className={i < rating ? 'text-yellow-400' : 'text-gray-300'}
                            >
                              ⭐
                            </span>
                          ))}
                        </div>
                        <span>{rating}+ Stars</span>
                      </button>
                    ))}
                    
                    {filters.rating !== null && (
                      <button
                        onClick={() => handleRatingChange(null)}
                        className="w-full text-sm text-red-600 hover:text-red-700 text-left"
                      >
                        Clear rating filter
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Distance Section */}
            <div className="filter-section">
              <label className="block font-medium text-gray-700 mb-2">
                Distance: {filters.distance} miles
              </label>
              <input
                type="range"
                min="1"
                max="50"
                value={filters.distance}
                onChange={(e) => handleDistanceChange(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(filters.distance / 50) * 100}%, #e5e7eb ${(filters.distance / 50) * 100}%, #e5e7eb 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1 mi</span>
                <span>25 mi</span>
                <span>50+ mi</span>
              </div>
            </div>

            {/* Business Hours Section */}
            <div className="filter-section">
              <label className="block font-medium text-gray-700 mb-2">
                Business Hours
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'any', label: 'Any Time' },
                  { value: 'open_now', label: 'Open Now' },
                  { value: 'open_24_7', label: 'Open 24/7' },
                  { value: 'open_weekends', label: 'Open Weekends' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleBusinessHoursChange(option.value as SearchFilters['businessHours'])}
                    className={`
                      p-2 text-sm rounded-lg transition-all
                      ${filters.businessHours === option.value
                        ? 'bg-green-50 border-2 border-green-200 text-green-800'
                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                      }
                    `}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Toggles */}
            <div className="filter-section">
              <label className="block font-medium text-gray-700 mb-2">
                Quick Filters
              </label>
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.verification === 'verified_only'}
                    onChange={(e) => onFiltersChange({
                      ...filters,
                      verification: e.target.checked ? 'verified_only' : 'any'
                    })}
                    className="mr-2"
                  />
                  <span className="text-sm">✓ Verified Only</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.subscription === 'premium_only'}
                    onChange={(e) => onFiltersChange({
                      ...filters,
                      subscription: e.target.checked ? 'premium_only' : 'any'
                    })}
                    className="mr-2"
                  />
                  <span className="text-sm">⭐ Premium Only</span>
                </label>
              </div>
            </div>
          </div>
        </GlassMorphism>
      </div>
    );
  }

  // Desktop/horizontal layout
  return (
    <div className={`advanced-filter-bar desktop-layout ${className}`}>
      <GlassMorphism variant="subtle" className="p-4" animated={enableAnimations}>
        {/* Filter Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Filters</h3>
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {activeFiltersCount} filter{activeFiltersCount === 1 ? '' : 's'} active
              </span>
              <button
                onClick={clearAllFilters}
                className="text-sm text-red-600 hover:text-red-700 underline"
                data-testid="clear-all-filters"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* Filter Content */}
        <div className="space-y-6">
          {/* Categories */}
          <div className="filter-group">
            <h4 className="font-medium text-gray-700 mb-3">Categories</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {visibleCategories.map((category) => (
                <motion.button
                  key={category.id}
                  onClick={() => handleCategoryToggle(category.id)}
                  onHoverStart={() => setHoveredFilter(category.id)}
                  onHoverEnd={() => setHoveredFilter(null)}
                  whileHover={enableAnimations ? { scale: 1.02 } : undefined}
                  whileTap={enableAnimations ? { scale: 0.98 } : undefined}
                  className={`
                    flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-200
                    border-2 ${filters.categories.includes(category.id)
                      ? 'bg-blue-50 border-blue-200 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }
                  `}
                  data-testid={`category-${category.id}`}
                >
                  <span 
                    className="text-2xl"
                    style={{ color: filters.categories.includes(category.id) ? '#3b82f6' : category.color }}
                  >
                    {category.icon}
                  </span>
                  <span className={`text-xs font-medium text-center leading-tight ${
                    filters.categories.includes(category.id) ? 'text-blue-800' : 'text-gray-700'
                  }`}>
                    {category.label}
                  </span>
                  {showCounts && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      {Math.floor(Math.random() * 50) + 1}
                    </span>
                  )}
                </motion.button>
              ))}
            </div>
            
            {categoryHierarchy.length > 6 && (
              <div className="mt-3 text-center">
                <button
                  onClick={() => setShowAllCategories(!showAllCategories)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {showAllCategories ? 'Show Less' : `Show ${categoryHierarchy.length - 6} More Categories`}
                </button>
              </div>
            )}
          </div>

          {/* Secondary Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Rating Filter */}
            <div className="filter-group">
              <h4 className="font-medium text-gray-700 mb-3">Minimum Rating</h4>
              <div className="space-y-2">
                {[4.5, 4.0, 3.5, 3.0].map((rating) => (
                  <button
                    key={rating}
                    onClick={() => handleRatingChange(rating === filters.rating ? null : rating)}
                    className={`
                      w-full flex items-center gap-2 p-2 rounded-lg transition-all text-left text-sm
                      ${filters.rating === rating
                        ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                        : 'hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className="flex">
                      {Array.from({ length: 5 }, (_, i) => (
                        <span
                          key={i}
                          className={`text-xs ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`}
                        >
                          ⭐
                        </span>
                      ))}
                    </div>
                    <span>{rating}+</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Distance Filter */}
            <div className="filter-group">
              <h4 className="font-medium text-gray-700 mb-3">
                Distance: {filters.distance} miles
              </h4>
              <input
                type="range"
                min="1"
                max="50"
                value={filters.distance}
                onChange={(e) => handleDistanceChange(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>1 mi</span>
                <span>25 mi</span>
                <span>50+ mi</span>
              </div>
            </div>

            {/* Business Hours Filter */}
            <div className="filter-group">
              <h4 className="font-medium text-gray-700 mb-3">Business Hours</h4>
              <select
                value={filters.businessHours}
                onChange={(e) => handleBusinessHoursChange(e.target.value as SearchFilters['businessHours'])}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="any">Any Time</option>
                <option value="open_now">Open Now</option>
                <option value="open_24_7">Open 24/7</option>
                <option value="open_weekends">Open Weekends</option>
              </select>
            </div>

            {/* Quick Toggles */}
            <div className="filter-group">
              <h4 className="font-medium text-gray-700 mb-3">Quick Filters</h4>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.verification === 'verified_only'}
                    onChange={(e) => onFiltersChange({
                      ...filters,
                      verification: e.target.checked ? 'verified_only' : 'any'
                    })}
                    className="mr-2"
                  />
                  <span className="text-sm">✓ Verified Only</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.subscription === 'premium_only'}
                    onChange={(e) => onFiltersChange({
                      ...filters,
                      subscription: e.target.checked ? 'premium_only' : 'any'
                    })}
                    className="mr-2"
                  />
                  <span className="text-sm">⭐ Premium Only</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100 text-center"
            >
              <div className="flex items-center justify-center gap-2 text-blue-700">
                <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                <span className="text-sm">Applying filters...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassMorphism>
    </div>
  );
};

export default AdvancedFilterBar;