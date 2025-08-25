import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useDebounce } from './useDebounce';
import { useSearchSuggestions } from './useBusinessData';
import { businessApi } from '../lib/api/businesses';

interface SearchSuggestion {
  id: string;
  text: string;
  category: string;
  icon?: string;
  count?: number;
  isRecent?: boolean;
  isPopular?: boolean;
}

interface SearchFilters {
  categories?: string[];
  sortBy?: 'relevance' | 'distance' | 'rating' | 'newest';
  radius?: number;
  priceRange?: [number, number];
  isOpen?: boolean;
  isPremium?: boolean;
}

interface SearchState {
  query: string;
  suggestions: SearchSuggestion[];
  selectedIndex: number;
  isLoading: boolean;
  hasError: boolean;
  errorMessage?: string;
  recentSearches: string[];
  popularSearches: string[];
  showSuggestions: boolean;
}

interface UseSearchFunctionalityOptions {
  debounceMs?: number;
  minQueryLength?: number;
  maxSuggestions?: number;
  maxRecentSearches?: number;
  enableHistory?: boolean;
  enablePopular?: boolean;
  onSearch?: (query: string, filters?: SearchFilters) => void;
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void;
  storageKey?: string;
}

const STORAGE_KEY_PREFIX = 'lawless_search_';

export const useSearchFunctionality = (options: UseSearchFunctionalityOptions = {}) => {
  const {
    debounceMs = 300,
    minQueryLength = 2,
    maxSuggestions = 8,
    maxRecentSearches = 5,
    enableHistory = true,
    enablePopular = true,
    onSearch,
    onSuggestionSelect,
    storageKey = 'default'
  } = options;

  // State management
  const [state, setState] = useState<SearchState>({
    query: '',
    suggestions: [],
    selectedIndex: -1,
    isLoading: false,
    hasError: false,
    recentSearches: [],
    popularSearches: [],
    showSuggestions: false
  });

  // Refs for managing focus and keyboard navigation
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const suggestionItemsRef = useRef<(HTMLElement | null)[]>([]);

  // Debounced query for API calls
  const debouncedQuery = useDebounce(state.query, debounceMs);

  // Load recent searches from localStorage
  useEffect(() => {
    if (!enableHistory) return;

    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${storageKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setState(prev => ({
          ...prev,
          recentSearches: parsed.recentSearches || []
        }));
      }
    } catch (error) {
      console.warn('Failed to load search history:', error);
    }
  }, [enableHistory, storageKey]);

  // Load popular searches (mock data for now, would come from API)
  useEffect(() => {
    if (!enablePopular) return;

    // Simulate loading popular searches
    const popularSearches = [
      'Restaurants near me',
      'Coffee shops',
      'Auto repair',
      'Hair salons',
      'Grocery stores'
    ];

    setState(prev => ({
      ...prev,
      popularSearches
    }));
  }, [enablePopular]);

  // Generate suggestions based on query
  const generateSuggestions = useCallback(async (query: string): Promise<SearchSuggestion[]> => {
    if (query.length < minQueryLength) {
      // Show recent and popular searches when query is empty or too short
      const suggestions: SearchSuggestion[] = [];

      if (enableHistory && state.recentSearches.length > 0) {
        suggestions.push(
          ...state.recentSearches.slice(0, 3).map((text, index) => ({
            id: `recent-${index}`,
            text,
            category: 'Recent',
            icon: '🕐',
            isRecent: true
          }))
        );
      }

      if (enablePopular && state.popularSearches.length > 0) {
        suggestions.push(
          ...state.popularSearches.slice(0, 5).map((text, index) => ({
            id: `popular-${index}`,
            text,
            category: 'Popular',
            icon: '⭐',
            isPopular: true
          }))
        );
      }

      return suggestions.slice(0, maxSuggestions);
    }

    try {
      // Use real API for search suggestions
      const response = await businessApi.searchSuggestions(query, maxSuggestions - 2); // Leave room for meta suggestions
      const apiSuggestions = response.data || [];
      
      const suggestions: SearchSuggestion[] = [];

      // Add the main query suggestion
      suggestions.push({
        id: 'query-all',
        text: `"${query}" in All Categories`,
        category: 'All',
        icon: '🔍',
        count: apiSuggestions.length
      });

      // Add business name suggestions from API
      apiSuggestions.forEach((businessName, index) => {
        suggestions.push({
          id: `business-${index}`,
          text: businessName,
          category: 'Business',
          icon: '🏢',
          count: 1
        });
      });

      // Add location-based suggestion
      if (suggestions.length < maxSuggestions) {
        suggestions.push({
          id: 'near-me',
          text: `"${query}" near me`,
          category: 'Location',
          icon: '📍',
          count: Math.floor(apiSuggestions.length * 0.7)
        });
      }

      return suggestions.slice(0, maxSuggestions);
    } catch (error) {
      console.error('Failed to fetch search suggestions:', error);
      
      // Fallback to basic suggestions if API fails
      return [
        {
          id: 'query-fallback',
          text: `Search for "${query}"`,
          category: 'Search',
          icon: '🔍',
          count: 0
        }
      ];
    }
  }, [minQueryLength, maxSuggestions, enableHistory, enablePopular, state.recentSearches, state.popularSearches]);

  // Fetch suggestions when debounced query changes
  useEffect(() => {
    if (!state.showSuggestions) return;

    const fetchSuggestions = async () => {
      setState(prev => ({ ...prev, isLoading: true, hasError: false }));

      try {
        const suggestions = await generateSuggestions(debouncedQuery);
        setState(prev => ({
          ...prev,
          suggestions,
          isLoading: false,
          selectedIndex: -1
        }));
      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          hasError: true,
          errorMessage: 'Failed to load suggestions'
        }));
      }
    };

    fetchSuggestions();
  }, [debouncedQuery, state.showSuggestions, generateSuggestions]);

  // Handle input change
  const handleInputChange = useCallback((value: string) => {
    setState(prev => ({
      ...prev,
      query: value,
      showSuggestions: true
    }));
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;
    const { suggestions, selectedIndex, query } = state;

    switch (key) {
      case 'ArrowDown':
        event.preventDefault();
        setState(prev => ({
          ...prev,
          selectedIndex: Math.min(prev.selectedIndex + 1, suggestions.length - 1)
        }));
        break;

      case 'ArrowUp':
        event.preventDefault();
        setState(prev => ({
          ...prev,
          selectedIndex: Math.max(prev.selectedIndex - 1, -1)
        }));
        break;

      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          selectSuggestion(suggestions[selectedIndex]);
        } else if (query.trim()) {
          performSearch(query);
        }
        break;

      case 'Escape':
        event.preventDefault();
        setState(prev => ({
          ...prev,
          showSuggestions: false,
          selectedIndex: -1
        }));
        inputRef.current?.blur();
        break;

      case 'Tab':
        // Allow normal tab behavior but hide suggestions
        setState(prev => ({
          ...prev,
          showSuggestions: false
        }));
        break;
    }
  }, [state]);

  // Scroll selected suggestion into view
  useEffect(() => {
    if (state.selectedIndex >= 0 && suggestionItemsRef.current[state.selectedIndex]) {
      suggestionItemsRef.current[state.selectedIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [state.selectedIndex]);

  // Select a suggestion
  const selectSuggestion = useCallback((suggestion: SearchSuggestion) => {
    const searchQuery = suggestion.text.replace(/^"|"$/g, '').split('" in ')[0];
    
    setState(prev => ({
      ...prev,
      query: searchQuery,
      showSuggestions: false,
      selectedIndex: -1
    }));

    // Add to recent searches if not already there
    if (enableHistory) {
      saveToRecentSearches(searchQuery);
    }

    // Call callbacks
    onSuggestionSelect?.(suggestion);
    performSearch(searchQuery);
  }, [enableHistory, onSuggestionSelect]);

  // Perform search
  const performSearch = useCallback((query: string) => {
    if (!query.trim()) return;

    // Hide suggestions
    setState(prev => ({
      ...prev,
      showSuggestions: false
    }));

    // Save to recent searches
    if (enableHistory) {
      saveToRecentSearches(query);
    }

    // Trigger search callback
    onSearch?.(query);
  }, [enableHistory, onSearch]);

  // Save to recent searches
  const saveToRecentSearches = useCallback((query: string) => {
    setState(prev => {
      const filtered = prev.recentSearches.filter(q => q !== query);
      const updated = [query, ...filtered].slice(0, maxRecentSearches);

      // Save to localStorage
      try {
        localStorage.setItem(
          `${STORAGE_KEY_PREFIX}${storageKey}`,
          JSON.stringify({ recentSearches: updated })
        );
      } catch (error) {
        console.warn('Failed to save search history:', error);
      }

      return {
        ...prev,
        recentSearches: updated
      };
    });
  }, [maxRecentSearches, storageKey]);

  // Clear search
  const clearSearch = useCallback(() => {
    setState(prev => ({
      ...prev,
      query: '',
      suggestions: [],
      selectedIndex: -1,
      showSuggestions: false
    }));
    inputRef.current?.focus();
  }, []);

  // Clear search history
  const clearHistory = useCallback(() => {
    setState(prev => ({
      ...prev,
      recentSearches: []
    }));

    try {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${storageKey}`);
    } catch (error) {
      console.warn('Failed to clear search history:', error);
    }
  }, [storageKey]);

  // Handle focus events
  const handleFocus = useCallback(() => {
    setState(prev => ({
      ...prev,
      showSuggestions: true
    }));
  }, []);

  const handleBlur = useCallback(() => {
    // Delay hiding suggestions to allow click events to fire
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        showSuggestions: false,
        selectedIndex: -1
      }));
    }, 200);
  }, []);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setState(prev => ({
          ...prev,
          showSuggestions: false,
          selectedIndex: -1
        }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input (for keyboard shortcut)
  const focusInput = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Memoized values
  const hasResults = useMemo(() => state.suggestions.length > 0, [state.suggestions]);
  const isActive = useMemo(() => state.query.length > 0 || state.showSuggestions, [state.query, state.showSuggestions]);

  return {
    // State
    query: state.query,
    suggestions: state.suggestions,
    selectedIndex: state.selectedIndex,
    isLoading: state.isLoading,
    hasError: state.hasError,
    errorMessage: state.errorMessage,
    recentSearches: state.recentSearches,
    popularSearches: state.popularSearches,
    showSuggestions: state.showSuggestions,
    
    // Computed
    hasResults,
    isActive,
    
    // Methods
    handleInputChange,
    handleKeyDown,
    handleFocus,
    handleBlur,
    selectSuggestion,
    performSearch,
    clearSearch,
    clearHistory,
    focusInput,
    
    // Refs
    inputRef,
    suggestionsRef,
    suggestionItemsRef
  };
};

export default useSearchFunctionality;