'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassMorphism } from './GlassMorphism';
import { useFilterFunctionality } from '../hooks/useFilterFunctionality';

export interface FilterBarProps {
  categories?: string[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  isLoading?: boolean;
  className?: string;
  showCounts?: boolean;
  enableAnimations?: boolean;
  layout?: 'horizontal' | 'vertical' | 'grid';
  maxVisibleFilters?: number;
}

const defaultCategories = [
  "All",
  "Restaurants", 
  "Health & Beauty",
  "Auto Services",
  "Professional Services",
  "Shopping",
  "Home Services"
];

const categoryIcons: Record<string, string> = {
  "All": "🌟",
  "Restaurants": "🍽️",
  "Health & Beauty": "💄",
  "Auto Services": "🚗", 
  "Professional Services": "💼",
  "Shopping": "🛍️",
  "Home Services": "🏠"
};

export default function FilterBar({
  categories = defaultCategories,
  activeCategory,
  onCategoryChange,
  isLoading = false,
  className = "",
  showCounts = false,
  enableAnimations = true,
  layout = 'horizontal',
  maxVisibleFilters = 10
}: FilterBarProps) {
  const [showAllFilters, setShowAllFilters] = React.useState(false);
  const [hoveredFilter, setHoveredFilter] = React.useState<string | null>(null);

  // Convert categories to filter format for advanced functionality
  const filterGroups = React.useMemo(() => [{
    id: 'category',
    label: 'Category',
    type: 'single' as const,
    priority: 1,
    options: categories.map(cat => ({
      id: cat.toLowerCase().replace(/\s+/g, '-'),
      label: cat,
      value: cat,
      count: showCounts ? Math.floor(Math.random() * 50) + 1 : undefined,
      icon: categoryIcons[cat] || '📂'
    }))
  }], [categories, showCounts]);

  // Simple animation configuration
  const animationConfig = {
    animationDuration: 250,
    staggerDelay: 30
  };

  // Handle category selection
  const handleCategoryClick = React.useCallback((category: string) => {
    if (!isLoading) {
      onCategoryChange(category);
    }
  }, [isLoading, onCategoryChange]);

  // Show more/less filters
  const toggleShowAllFilters = React.useCallback(() => {
    setShowAllFilters(!showAllFilters);
  }, [showAllFilters]);

  // Determine visible categories
  const visibleCategories = showAllFilters 
    ? categories 
    : categories.slice(0, maxVisibleFilters);

  const hasHiddenCategories = categories.length > maxVisibleFilters;

  // Layout-specific container styles
  const getContainerStyles = () => {
    switch (layout) {
      case 'vertical':
        return 'flex flex-col gap-2';
      case 'grid':
        return 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2';
      case 'horizontal':
      default:
        return 'flex flex-wrap gap-2';
    }
  };

  // Filter chip variants for animations
  const chipVariants = {
    initial: { opacity: 0, scale: 0.8, y: 20 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.8, y: -20 },
    hover: { scale: 1.05, y: -2 }
  };

  return (
    <div 
      className={`filter-bar ${isLoading ? 'loading' : ''} ${className}`} 
      data-testid="filter-bar"
    >
      <GlassMorphism
        variant="subtle"
        className="filter-container p-4"
        animated={enableAnimations}
      >
        {/* Filter Header */}
        <div className="filter-header mb-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Filter by Category</h3>
          {isLoading && (
            <div className="loading-indicator text-xs text-blue-500 flex items-center gap-2">
              <div className="w-3 h-3 border border-blue-300 border-t-blue-500 rounded-full animate-spin" />
              Updating filters...
            </div>
          )}
        </div>

        {/* Filter Chips */}
        <div className={`filter-chips ${getContainerStyles()}`} data-testid="filter-chips">
          <AnimatePresence mode="wait">
            {visibleCategories.map((category, index) => {
              const isActive = activeCategory === category;
              const optionId = category.toLowerCase().replace(/\s+/g, '-');
              const icon = categoryIcons[category] || '📂';
              const option = filterGroups[0].options.find(opt => opt.value === category);
              const count = option?.count;

              return (
                <motion.button
                  key={category}
                  variants={chipVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  whileHover={enableAnimations ? "hover" : undefined}
                  whileTap={enableAnimations ? { scale: 0.95 } : undefined}
                  transition={{
                    duration: animationConfig.animationDuration! / 1000,
                    delay: enableAnimations ? index * (animationConfig.staggerDelay! / 1000) : 0,
                    ease: "easeOut"
                  }}
                  className={`
                    filter-chip relative overflow-hidden
                    flex items-center gap-2 px-4 py-2 rounded-full
                    font-medium text-sm transition-all duration-200
                    border-2 focus:outline-none focus:ring-2 focus:ring-blue-300
                    ${isActive 
                      ? 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-200' 
                      : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:shadow-md'
                    }
                    ${isLoading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
                  `}
                  onClick={() => handleCategoryClick(category)}
                  onMouseEnter={() => setHoveredFilter(category)}
                  onMouseLeave={() => setHoveredFilter(null)}
                  disabled={isLoading}
                  aria-pressed={isActive}
                  aria-label={`Filter by ${category}${count ? ` (${count} items)` : ''}`}
                  data-testid={`filter-chip-${optionId}`}
                >
                  {/* Background Animation */}
                  {enableAnimations && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-600 opacity-0"
                      animate={{ 
                        opacity: isActive ? 1 : (hoveredFilter === category ? 0.1 : 0) 
                      }}
                      transition={{ duration: 0.2 }}
                    />
                  )}

                  {/* Content */}
                  <span className="relative z-10 flex items-center gap-2">
                    <span className="filter-icon">{icon}</span>
                    <span className="filter-text">{category}</span>
                    {showCounts && count !== undefined && (
                      <span className={`
                        filter-count text-xs px-2 py-1 rounded-full
                        ${isActive ? 'bg-white/20' : 'bg-gray-100 text-gray-600'}
                      `}>
                        {count}
                      </span>
                    )}
                  </span>

                  {/* Loading Spinner */}
                  {isLoading && isActive && (
                    <div className="absolute inset-0 flex items-center justify-center bg-blue-500/80 z-20">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </motion.button>
              );
            })}
          </AnimatePresence>

          {/* Show More/Less Button */}
          {hasHiddenCategories && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              onClick={toggleShowAllFilters}
              className="show-more-button flex items-center gap-2 px-4 py-2 rounded-full border-2 border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors text-sm font-medium"
              data-testid="show-more-filters"
            >
              <span>{showAllFilters ? 'Show Less' : `+${categories.length - maxVisibleFilters} More`}</span>
              <motion.span
                animate={{ rotate: showAllFilters ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                ↓
              </motion.span>
            </motion.button>
          )}
        </div>

        {/* Active Filter Summary */}
        <AnimatePresence>
          {activeCategory && activeCategory !== 'All' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="filter-summary mt-3 pt-3 border-t border-gray-100"
            >
              <div className="text-xs text-gray-600 flex items-center justify-between">
                <span>Showing: {activeCategory}</span>
                <button
                  onClick={() => handleCategoryClick('All')}
                  className="clear-filters text-blue-500 hover:text-blue-600 underline"
                  data-testid="clear-filters"
                >
                  Clear filter
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Loading Indicator */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="filter-results mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100"
              data-testid="filter-results"
            >
              <div className="filter-loading text-sm text-blue-700 flex items-center gap-2" data-testid="filter-loading">
                <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                Filtering results...
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassMorphism>
    </div>
  );
}