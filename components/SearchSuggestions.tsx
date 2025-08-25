'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassMorphism } from './GlassMorphism';

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
}> = React.memo(({ suggestion, index, isSelected, onSelect, onMouseEnter }) => {
  const typeStyle = SUGGESTION_TYPE_STYLES[suggestion.type] || SUGGESTION_TYPE_STYLES.business;
  
  const handleClick = React.useCallback(() => {
    onSelect(suggestion, index);
  }, [suggestion, index, onSelect]);

  return (
    <motion.div
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-200 border-l-2 border-transparent ${isSelected ? `${typeStyle.bgColor} ${typeStyle.borderColor} border-l-2 shadow-sm` : 'hover:bg-gray-50'}`}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
    >
      <div className={`flex-shrink-0 text-lg ${typeStyle.iconColor} transition-transform duration-200`}>
        {suggestion.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-800 font-medium truncate">
          {suggestion.text}
        </div>
      </div>
      <div className="flex-shrink-0">
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${typeStyle.bgColor} ${typeStyle.iconColor} opacity-60`}>
          {suggestion.type}
        </div>
      </div>
    </motion.div>
  );
});

SearchSuggestionItem.displayName = 'SearchSuggestionItem';

const LoadingSkeleton: React.FC = () => (
  <div className="p-4 space-y-3">
    {Array.from({ length: 3 }, (_, index) => (
      <div key={index} className="animate-pulse flex items-center gap-3">
        <div className="w-5 h-5 bg-gray-200 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-gray-200 rounded w-3/4" />
          <div className="h-2 bg-gray-100 rounded w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

const EmptyState: React.FC = () => (
  <div className="p-6 text-center text-gray-500">
    <div className="text-3xl mb-2">🔍</div>
    <div className="text-sm">
      Start typing to see suggestions
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

  React.useEffect(() => {
    if (selectedIndex >= 0 && listRef.current && suggestions.length > 0) {
      try {
        const children = listRef.current.children;
        if (children && children[selectedIndex]) {
          const selectedElement = children[selectedIndex] as HTMLElement;
          if (selectedElement && selectedElement.scrollIntoView) {
            selectedElement.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest'
            });
          }
        }
      } catch (error) {
        console.warn('Error scrolling:', error);
      }
    }
  }, [selectedIndex, suggestions.length]);

  const handleMouseEnter = React.useCallback(() => {}, []);

  if (!isVisible) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`absolute top-full left-0 right-0 mt-2 z-50 ${className}`} data-testid="suggestions-container"
      >
        <GlassMorphism className="shadow-xl border border-gray-200/50">
          <div
            ref={listRef}
            className="overflow-y-auto"
            style={{ maxHeight }}
            role="listbox"
          >
            {loading ? (
              <LoadingSkeleton />
            ) : suggestions.length === 0 ? (
              <EmptyState />
            ) : (
              <div>
                {suggestions.map((suggestion, index) => (
                  <SearchSuggestionItem
                    key={suggestion.id}
                    suggestion={suggestion}
                    index={index}
                    isSelected={selectedIndex === index}
                    onSelect={onSelect}
                    onMouseEnter={handleMouseEnter}
                  />
                ))}
              </div>
            )}
          </div>
        </GlassMorphism>
      </motion.div>
    </AnimatePresence>
  );
};

export default SearchSuggestions;