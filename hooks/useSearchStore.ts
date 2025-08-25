import React from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SearchSuggestion, SearchFilters } from '../components/SearchInterface';
import type { Business } from '../types/business';

// Search result type
export interface SearchResult {
  businesses: Business[];
  total: number;
  hasMore: boolean;
  query: string;
  filters: SearchFilters;
  executedAt: Date;
  responseTime: number;
}

// Search analytics type
export interface SearchAnalytics {
  query: string;
  filters: SearchFilters;
  resultCount: number;
  clickThroughRate: number;
  executedAt: Date;
  responseTime: number;
  userId?: string;
}

// Search state interface
export interface SearchState {
  // Current search state
  query: string;
  filters: SearchFilters;
  suggestions: SearchSuggestion[];
  results: SearchResult | null;
  
  // UI state
  isSearching: boolean;
  isLoadingSuggestions: boolean;
  showSuggestions: boolean;
  selectedSuggestionIndex: number;
  
  // Search history
  recentSearches: string[];
  popularSearches: string[];
  searchHistory: SearchResult[];
  
  // Analytics
  searchAnalytics: SearchAnalytics[];
  
  // Error handling
  error: string | null;
  
  // Performance metrics
  averageResponseTime: number;
  searchCount: number;
}

// Search actions interface
export interface SearchActions {
  // Search actions
  setQuery: (query: string) => void;
  setFilters: (filters: Partial<SearchFilters>) => void;
  resetFilters: () => void;
  executeSearch: (query?: string, filters?: SearchFilters) => Promise<void>;
  
  // Suggestion actions
  setSuggestions: (suggestions: SearchSuggestion[]) => void;
  setLoadingSuggestions: (loading: boolean) => void;
  selectSuggestion: (suggestion: SearchSuggestion, index: number) => void;
  
  // UI actions
  setShowSuggestions: (show: boolean) => void;
  setSelectedSuggestionIndex: (index: number) => void;
  
  // History actions
  addToRecentSearches: (query: string) => void;
  clearSearchHistory: () => void;
  
  // Analytics actions
  trackSearch: (analytics: Omit<SearchAnalytics, 'executedAt'>) => void;
  
  // Error handling
  setError: (error: string | null) => void;
  
  // URL synchronization
  syncWithURL: () => void;
  updateURL: () => void;
}

// Combined store type
export type SearchStore = SearchState & SearchActions;

// Default filters
const defaultFilters: SearchFilters = {
  categories: [],
  rating: null,
  distance: 25,
  priceRange: null,
  businessHours: 'any',
  verification: 'any',
  subscription: 'any',
  location: null,
};

// Create the search store with persistence
export const useSearchStore = create<SearchStore>()(
  persist(
    (set, get) => ({
      // Initial state
      query: '',
      filters: defaultFilters,
      suggestions: [],
      results: null,
      isSearching: false,
      isLoadingSuggestions: false,
      showSuggestions: false,
      selectedSuggestionIndex: -1,
      recentSearches: [],
      popularSearches: [
        'Restaurants near me',
        'Coffee shops',
        'Auto repair',
        'Hair salons',
        'Grocery stores',
        'Banks',
        'Pharmacies',
        'Gas stations'
      ],
      searchHistory: [],
      searchAnalytics: [],
      error: null,
      averageResponseTime: 0,
      searchCount: 0,

      // Search actions
      setQuery: (query: string) => {
        set({ query, error: null });
        
        // Show suggestions if query is not empty
        if (query.trim().length > 0) {
          set({ showSuggestions: true, selectedSuggestionIndex: -1 });
        } else {
          set({ showSuggestions: false, suggestions: [] });
        }
        
        // Update URL
        get().updateURL();
      },

      setFilters: (newFilters: Partial<SearchFilters>) => {
        const currentFilters = get().filters;
        const updatedFilters = { ...currentFilters, ...newFilters };
        set({ filters: updatedFilters, error: null });
        
        // Update URL
        get().updateURL();
      },

      resetFilters: () => {
        set({ filters: defaultFilters, error: null });
        get().updateURL();
      },

      executeSearch: async (query?: string, filters?: SearchFilters) => {
        const state = get();
        const searchQuery = query || state.query;
        const searchFilters = filters || state.filters;
        
        if (!searchQuery.trim()) {
          set({ error: 'Please enter a search query' });
          return;
        }

        set({ 
          isSearching: true, 
          error: null, 
          showSuggestions: false,
          query: searchQuery,
          filters: searchFilters
        });

        const startTime = performance.now();

        try {
          // Import the business API dynamically to avoid circular dependencies
          const { businessApi } = await import('../lib/api/businesses');
          
          const response = await businessApi.getBusinesses({
            query: searchQuery,
            location: searchFilters.location ? {
              lat: searchFilters.location.lat,
              lng: searchFilters.location.lng,
            } : undefined,
            radius: searchFilters.distance * 1609.34, // Convert miles to meters
            sortBy: 'relevance',
            filters: {
              rating: searchFilters.rating || undefined,
              openNow: searchFilters.businessHours === 'open_now',
              premiumOnly: searchFilters.subscription === 'premium_only',
              verifiedOnly: searchFilters.verification === 'verified_only',
            },
          });

          const endTime = performance.now();
          const responseTime = endTime - startTime;

          if (response.error) {
            throw new Error(response.error);
          }

          const searchResult: SearchResult = {
            businesses: response.data || [],
            total: response.total || 0,
            hasMore: response.hasMore || false,
            query: searchQuery,
            filters: searchFilters,
            executedAt: new Date(),
            responseTime,
          };

          // Update state with results
          set({ 
            results: searchResult,
            isSearching: false,
            searchCount: state.searchCount + 1,
            averageResponseTime: (state.averageResponseTime * state.searchCount + responseTime) / (state.searchCount + 1)
          });

          // Add to search history
          const newHistory = [searchResult, ...state.searchHistory.slice(0, 19)]; // Keep last 20 searches
          set({ searchHistory: newHistory });

          // Add to recent searches
          get().addToRecentSearches(searchQuery);

          // Track analytics
          get().trackSearch({
            query: searchQuery,
            filters: searchFilters,
            resultCount: response.total || 0,
            clickThroughRate: 0, // Will be updated when users click on results
            responseTime,
          });

          // Update URL
          get().updateURL();

        } catch (error) {
          console.error('Search failed:', error);
          set({ 
            isSearching: false, 
            error: error instanceof Error ? error.message : 'Search failed',
            results: null
          });
        }
      },

      // Suggestion actions
      setSuggestions: (suggestions: SearchSuggestion[]) => {
        set({ suggestions, selectedSuggestionIndex: -1 });
      },

      setLoadingSuggestions: (loading: boolean) => {
        set({ isLoadingSuggestions: loading });
      },

      selectSuggestion: (suggestion: SearchSuggestion, index: number) => {
        set({ 
          query: suggestion.text,
          selectedSuggestionIndex: index,
          showSuggestions: false
        });

        // Apply suggestion-specific filters if available
        if (suggestion.data) {
          const currentFilters = get().filters;
          const newFilters: Partial<SearchFilters> = {};

          if (suggestion.data.category) {
            newFilters.categories = [suggestion.data.category];
          }
          if (suggestion.data.rating) {
            newFilters.rating = suggestion.data.rating;
          }
          if (suggestion.data.nearMe && currentFilters.location) {
            newFilters.distance = Math.min(currentFilters.distance, 10);
          }

          if (Object.keys(newFilters).length > 0) {
            get().setFilters(newFilters);
          }
        }

        // Execute search with the suggestion
        get().executeSearch(suggestion.text);
      },

      // UI actions
      setShowSuggestions: (show: boolean) => {
        set({ showSuggestions: show });
        if (!show) {
          set({ selectedSuggestionIndex: -1 });
        }
      },

      setSelectedSuggestionIndex: (index: number) => {
        set({ selectedSuggestionIndex: index });
      },

      // History actions
      addToRecentSearches: (query: string) => {
        const state = get();
        const trimmedQuery = query.trim();
        
        if (!trimmedQuery) return;

        const filtered = state.recentSearches.filter(q => q !== trimmedQuery);
        const newRecentSearches = [trimmedQuery, ...filtered].slice(0, 10); // Keep last 10
        
        set({ recentSearches: newRecentSearches });
      },

      clearSearchHistory: () => {
        set({ 
          searchHistory: [], 
          recentSearches: [], 
          searchAnalytics: [] 
        });
      },

      // Analytics actions
      trackSearch: (analytics: Omit<SearchAnalytics, 'executedAt'>) => {
        const state = get();
        const newAnalytics: SearchAnalytics = {
          ...analytics,
          executedAt: new Date(),
        };
        
        const updatedAnalytics = [newAnalytics, ...state.searchAnalytics.slice(0, 99)]; // Keep last 100
        set({ searchAnalytics: updatedAnalytics });
      },

      // Error handling
      setError: (error: string | null) => {
        set({ error });
      },

      // URL synchronization
      syncWithURL: () => {
        if (typeof window === 'undefined') return;

        try {
          const url = new URL(window.location.href);
          const query = url.searchParams.get('q') || '';
          const categories = url.searchParams.get('categories')?.split(',') || [];
          const rating = url.searchParams.get('rating') ? Number(url.searchParams.get('rating')) : null;
          const distance = url.searchParams.get('distance') ? Number(url.searchParams.get('distance')) : 25;
          
          const filters: Partial<SearchFilters> = {};
          if (categories.length > 0) filters.categories = categories;
          if (rating) filters.rating = rating;
          if (distance !== 25) filters.distance = distance;

          set({ query, filters: { ...defaultFilters, ...filters } });
        } catch (error) {
          console.warn('Failed to sync with URL:', error);
        }
      },

      updateURL: () => {
        if (typeof window === 'undefined') return;

        try {
          const state = get();
          const url = new URL(window.location.href);
          
          // Update search parameters
          if (state.query.trim()) {
            url.searchParams.set('q', state.query.trim());
          } else {
            url.searchParams.delete('q');
          }
          
          if (state.filters.categories.length > 0) {
            url.searchParams.set('categories', state.filters.categories.join(','));
          } else {
            url.searchParams.delete('categories');
          }
          
          if (state.filters.rating) {
            url.searchParams.set('rating', state.filters.rating.toString());
          } else {
            url.searchParams.delete('rating');
          }
          
          if (state.filters.distance !== 25) {
            url.searchParams.set('distance', state.filters.distance.toString());
          } else {
            url.searchParams.delete('distance');
          }

          // Update URL without reloading the page
          window.history.replaceState({}, '', url.toString());
        } catch (error) {
          console.warn('Failed to update URL:', error);
        }
      },
    }),
    {
      name: 'lawless-search-store',
      storage: createJSONStorage(() => {
        // Only persist certain fields
        return {
          getItem: (name) => {
            const value = localStorage.getItem(name);
            if (!value) return null;
            
            try {
              const parsed = JSON.parse(value);
              // Only return persistent fields
              return JSON.stringify({
                recentSearches: parsed.state?.recentSearches || [],
                searchHistory: parsed.state?.searchHistory?.slice(0, 5) || [], // Limit stored history
                searchAnalytics: parsed.state?.searchAnalytics?.slice(0, 20) || [], // Limit stored analytics
              });
            } catch {
              return null;
            }
          },
          setItem: (name, value) => {
            try {
              const parsed = JSON.parse(value);
              // Only persist certain fields
              const toStore = {
                state: {
                  recentSearches: parsed.state?.recentSearches || [],
                  searchHistory: parsed.state?.searchHistory?.slice(0, 5) || [],
                  searchAnalytics: parsed.state?.searchAnalytics?.slice(0, 20) || [],
                },
                version: parsed.version
              };
              localStorage.setItem(name, JSON.stringify(toStore));
            } catch (error) {
              console.warn('Failed to persist search store:', error);
            }
          },
          removeItem: (name) => localStorage.removeItem(name),
        };
      }),
      partialize: (state) => ({
        recentSearches: state.recentSearches,
        searchHistory: state.searchHistory.slice(0, 5),
        searchAnalytics: state.searchAnalytics.slice(0, 20),
      }),
    }
  )
);

// Hook for search suggestions with debouncing
export const useSearchSuggestions = (query: string, enabled = true) => {
  const { setSuggestions, setLoadingSuggestions, suggestions, isLoadingSuggestions } = useSearchStore();
  const [debouncedQuery, setDebouncedQuery] = React.useState('');

  // Debounce the query
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  // Fetch suggestions when debounced query changes
  React.useEffect(() => {
    if (!enabled || debouncedQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      setLoadingSuggestions(true);
      
      try {
        // Import the business API dynamically
        const { businessApi } = await import('../lib/api/businesses');
        
        const response = await businessApi.searchSuggestions(debouncedQuery, 8);
        
        if (response.error) {
          throw new Error(response.error);
        }

        // Transform API suggestions to SearchSuggestion format
        const suggestions: SearchSuggestion[] = (response.data || []).map((name, index) => ({
          id: `business-${index}`,
          text: name,
          type: 'business' as const,
          icon: '🏢',
          data: {
            category: undefined,
            nearMe: false,
          }
        }));

        // Add "near me" suggestion if there are results
        if (suggestions.length > 0) {
          suggestions.push({
            id: 'near-me',
            text: `"${debouncedQuery}" near me`,
            type: 'location' as const,
            icon: '📍',
            data: {
              nearMe: true,
            }
          });
        }

        setSuggestions(suggestions);
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    };

    fetchSuggestions();
  }, [debouncedQuery, enabled, setSuggestions, setLoadingSuggestions]);

  return { suggestions, isLoading: isLoadingSuggestions };
};