'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassMorphism } from './GlassMorphism';
import type { SearchSuggestion } from './SearchInterface';

export interface SearchSuggestionsProps {
  suggestions: SearchSuggestion[];
  selectedIndex: number;
  onSelect: (suggestion: SearchSuggestion, index: number) => void;
  onClose: () => void;
  isVisible: boolean;
  loading?: boolean;
  maxHeight?: number;
  className?: string;
}

const SUGGESTION_TYPE_STYLES = {
  business: {
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50 hover:bg-blue-100',
    borderColor: 'border-blue-200'
  },
  category: {
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50 hover:bg-green-100',
    borderColor: 'border-green-200'
  },
  location: {
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50 hover:bg-red-100',
    borderColor: 'border-red-200'
  },
  service: {
    iconColor: 'text-purple-500',
    bgColor: 'bg-purple-50 hover:bg-purple-100',
    borderColor: 'border-purple-200'
  },
  recent: {
    iconColor: 'text-gray-500',
    bgColor: 'bg-gray-50 hover:bg-gray-100',
    borderColor: 'border-gray-200'
  }
};

const SearchSuggestionItem: React.FC<{
  suggestion: SearchSuggestion;
  index: number;
  isSelected: boolean;
  onSelect: (suggestion: SearchSuggestion, index: number) => void;
  onMouseEnter: () => void;
}> = ({ suggestion, index, isSelected, onSelect, onMouseEnter }) => {
  const typeStyle = SUGGESTION_TYPE_STYLES[suggestion.type] || SUGGESTION_TYPE_STYLES.business;
  
  const handleClick = React.useCallback(() => {
    onSelect(suggestion, index);
  }, [suggestion, index, onSelect]);

  const handleKeyDown = React.useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(suggestion, index);
    }
  }, [suggestion, index, onSelect]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{
        duration: 0.2,
        delay: index * 0.03,
        ease: 'easeOut'
      }}
      className={`
        suggestion-item
        flex items-center gap-3 px-4 py-3 
        cursor-pointer transition-all duration-200 ease-out
        border-l-2 border-transparent
        ${isSelected 
          ? `${typeStyle.bgColor} ${typeStyle.borderColor} border-l-2 shadow-sm` 
          : 'hover:bg-gray-50'
        }
      `}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      onKeyDown={handleKeyDown}
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      data-testid={`suggestion-${index}`}
      data-suggestion-type={suggestion.type}
    >
      {/* Icon */}
      <div className={`
        suggestion-icon flex-shrink-0 
        text-lg ${typeStyle.iconColor}
        ${isSelected ? 'scale-110' : 'scale-100'}
        transition-transform duration-200
      `}>
        {suggestion.icon}
      </div>

      {/* Content */}
      <div className="suggestion-content flex-1 min-w-0">
        <div className="suggestion-text text-sm text-gray-800 font-medium truncate">
          {suggestion.text}
        </div>
        
        {/* Additional data display */}
        {suggestion.data && (
          <div className="suggestion-meta text-xs text-gray-500 mt-1 flex items-center gap-2">
            {suggestion.data.category && (
              <span className="category-badge bg-gray-100 px-2 py-1 rounded-full">
                {suggestion.data.category}
              </span>
            )}
            {suggestion.data.nearMe && (
              <span className="location-indicator flex items-center gap-1">
                📍 Near you
              </span>
            )}
            {suggestion.data.sortBy && (
              <span className="sort-indicator flex items-center gap-1">
                ⭐ Top rated
              </span>
            )}
          </div>
        )}
      </div>

      {/* Type indicator */}
      <div className="suggestion-type flex-shrink-0">
        <div className={`
          type-badge px-2 py-1 rounded-full text-xs font-medium
          ${typeStyle.bgColor} ${typeStyle.iconColor}
          ${isSelected ? 'opacity-100' : 'opacity-60'}
          transition-opacity duration-200
        `}>
          {suggestion.type}
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="selection-indicator flex-shrink-0 w-2 h-2 rounded-full bg-blue-500"
        />
      )}
    </motion.div>
  );
};

const LoadingSkeleton: React.FC = () => (
  <div className="loading-skeleton p-4 space-y-3">
    {Array.from({ length: 4 }, (_, index) => (
      <div key={index} className="animate-pulse flex items-center gap-3">
        <div className="w-5 h-5 bg-gray-200 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-gray-200 rounded w-3/4" />
          <div className="h-2 bg-gray-100 rounded w-1/2" />
        </div>
        <div className="w-12 h-4 bg-gray-200 rounded-full flex-shrink-0" />
      </div>
    ))}
  </div>
);

const EmptyState: React.FC<{ query?: string }> = ({ query }) => (
  <div className="empty-state p-6 text-center text-gray-500">
    <div className="text-3xl mb-2">🔍</div>
    <div className="text-sm font-medium mb-1">
      {query ? `No suggestions for "${query}"` : 'Start typing to see suggestions'}
    </div>
    <div className="text-xs text-gray-400">
      Try searching for businesses, services, or locations
    </div>
  </div>
);

export const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  suggestions,
  selectedIndex,
  onSelect,
  onClose,
  isVisible,
  loading = false,
  maxHeight = 400,
  className = ''
}) => {
  const listRef = React.useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  React.useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }
    }
  }, [selectedIndex]);

  // Handle mouse enter for suggestion items
  const handleMouseEnter = React.useCallback((index: number) => {
    // Could trigger selection index change if needed
    // onSelectionChange?.(index);
  }, []);

  // Keyboard navigation helper
  const handleKeyDown = React.useCallback((event: React.KeyboardEvent) => {
    // This would be handled by the parent search component
    // but we include it here for completeness
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        onClose();
        break;
      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          onSelect(suggestions[selectedIndex], selectedIndex);
        }
        break;
    }
  }, [selectedIndex, suggestions, onSelect, onClose]);

  if (!isVisible) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{
          duration: 0.2,
          ease: 'easeOut'
        }}
        className={`
          search-suggestions
          absolute top-full left-0 right-0 mt-2 z-50
          ${className}
        `}
        onKeyDown={handleKeyDown}
        data-testid="search-suggestions"
      >
        <GlassMorphism
          variant="medium"
          className="shadow-xl border border-gray-200/50"
          animated
        >
          <div
            ref={listRef}
            className="suggestions-list overflow-y-auto"
            style={{ maxHeight }}
            role="listbox"
            aria-label="Search suggestions"
          >
            {loading ? (
              <LoadingSkeleton />
            ) : suggestions.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="suggestions-content">
                {/* Recent searches header */}
                {suggestions.some(s => s.type === 'recent') && (
                  <div className="section-header px-4 py-2 bg-gray-50 border-b border-gray-100">
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Recent Searches
                    </div>
                  </div>
                )}
                
                {/* Suggestions list */}
                <div className="suggestions-items">
                  {suggestions.map((suggestion, index) => (
                    <SearchSuggestionItem
                      key={suggestion.id}
                      suggestion={suggestion}
                      index={index}
                      isSelected={selectedIndex === index}
                      onSelect={onSelect}
                      onMouseEnter={() => handleMouseEnter(index)}
                    />
                  ))}
                </div>
                
                {/* Footer */}
                <div className="suggestions-footer px-4 py-2 bg-gray-50 border-t border-gray-100">
                  <div className="text-xs text-gray-500 flex items-center justify-between">
                    <span>Use ↑↓ to navigate, Enter to select</span>
                    <span className="text-xs text-gray-400">
                      {suggestions.length} suggestion{suggestions.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </GlassMorphism>
      </motion.div>
    </AnimatePresence>
  );
};

export default SearchSuggestions;