'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassMorphism } from './GlassMorphism';
import { SearchSuggestions } from './SearchSuggestions';
import { useSearchFunctionality } from '../hooks/useSearchFunctionality';
import { useCommonShortcuts } from '../hooks/useKeyboardShortcuts';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
  initialQuery?: string;
  isLoading?: boolean;
  showAdvancedFilters?: boolean;
  onToggleFilters?: () => void;
}

export default function SearchBar({
  onSearch,
  placeholder = "Search businesses, services, or locations...",
  className = "",
  initialQuery = "",
  isLoading = false,
  showAdvancedFilters = false,
  onToggleFilters
}: SearchBarProps) {
  // Search functionality with all advanced features
  const {
    query,
    isSearching,
    showSuggestions,
    selectedSuggestionIndex,
    suggestions,
    suggestionsLoading,
    searchInputRef,
    suggestionsRef,
    updateQuery,
    executeSearch,
    selectSuggestion,
    showSuggestions: showSuggestionsHandler,
    hideSuggestions,
    clearSearch,
    handleKeyDown,
    handleCompositionStart,
    handleCompositionEnd,
    options: searchOptions
  } = useSearchFunctionality({
    onSearch,
    searchOptions: {
      placeholder,
      enableHistory: true,
      enableKeyboardNavigation: true,
      debounceMs: 300,
      minQueryLength: 2
    }
  });

  // Keyboard shortcuts
  useCommonShortcuts({
    onSearch: () => {
      searchInputRef.current?.focus();
      showSuggestionsHandler();
    },
    onEscape: () => {
      hideSuggestions();
      searchInputRef.current?.blur();
    }
  });

  // Initialize with initial query
  React.useEffect(() => {
    if (initialQuery && initialQuery !== query) {
      updateQuery(initialQuery);
    }
  }, [initialQuery, query, updateQuery]);

  // Handle input changes
  const handleInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateQuery(e.target.value);
  }, [updateQuery]);

  // Handle form submission
  const handleSubmit = React.useCallback((e: React.FormEvent) => {
    e.preventDefault();
    executeSearch();
  }, [executeSearch]);

  // Handle input focus
  const handleInputFocus = React.useCallback(() => {
    showSuggestionsHandler();
  }, [showSuggestionsHandler]);

  // Handle suggestion selection
  const handleSuggestionSelect = React.useCallback((suggestion: any, index: number) => {
    selectSuggestion(suggestion, index);
  }, [selectSuggestion]);

  // Handle clear button click
  const handleClearClick = React.useCallback(() => {
    clearSearch();
  }, [clearSearch]);

  // Determine if we should show the loading state
  const showLoading = isLoading || isSearching || suggestionsLoading;

  return (
    <div className={`search-bar-container relative ${className}`} data-testid="search-container">
      <form onSubmit={handleSubmit} className="search-form">
        <GlassMorphism
          variant="medium"
          className="search-glass-container overflow-visible"
          animated
          interactive
        >
          <div className="flex items-center gap-3 p-4">
            {/* Search Icon */}
            <motion.div
              animate={{ 
                rotate: showLoading ? 360 : 0,
                scale: showLoading ? 1.1 : 1
              }}
              transition={{ 
                rotate: { repeat: showLoading ? Infinity : 0, duration: 1, ease: "linear" },
                scale: { duration: 0.2 }
              }}
              className="search-icon flex-shrink-0 text-gray-500"
            >
              {showLoading ? (
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
              onFocus={handleInputFocus}
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
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
                  onClick={handleClearClick}
                  className="clear-button p-1 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
                  aria-label="Clear search"
                  data-testid="clear-button"
                >
                  <span className="text-gray-400 text-sm">✕</span>
                </motion.button>
              )}
            </AnimatePresence>

            {/* Advanced Filters Toggle */}
            {onToggleFilters && (
              <motion.button
                type="button"
                onClick={onToggleFilters}
                className={`
                  filters-toggle p-2 rounded-lg transition-all duration-200 flex-shrink-0
                  ${showAdvancedFilters 
                    ? 'bg-blue-100 text-blue-600 shadow-sm' 
                    : 'hover:bg-gray-100 text-gray-500'
                  }
                `}
                aria-label="Toggle advanced filters"
                data-testid="filters-toggle"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-sm">⚙️</span>
              </motion.button>
            )}

            {/* Search Submit Button */}
            <motion.button
              type="submit"
              className="search-submit-button px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium text-sm flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || !query.trim()}
              aria-label="Search"
              data-testid="search-button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Search
            </motion.button>
          </div>
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
          onClose={hideSuggestions}
          isVisible={showSuggestions}
          loading={suggestionsLoading}
          maxHeight={400}
          className="suggestions-container"
        />
      </div>
    </div>
  );
}