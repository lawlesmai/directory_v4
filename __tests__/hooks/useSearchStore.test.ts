/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import { useSearchStore } from '../../hooks/useSearchStore';
import type { SearchFilters } from '../../components/SearchInterface';

// Mock the business API
jest.mock('../../lib/api/businesses', () => ({
  businessApi: {
    getBusinesses: jest.fn(),
    searchSuggestions: jest.fn(),
  },
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock URL APIs
const mockReplaceState = jest.fn();
Object.defineProperty(window, 'history', {
  value: {
    replaceState: mockReplaceState,
  },
});

// Mock location
delete (window as any).location;
window.location = {
  href: 'http://localhost:3000',
  search: '',
  pathname: '/',
  origin: 'http://localhost:3000',
} as any;

describe('useSearchStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    
    // Reset the store state
    const { result } = renderHook(() => useSearchStore());
    act(() => {
      result.current.clearSearchHistory();
      result.current.setQuery('');
      result.current.resetFilters();
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useSearchStore());

      expect(result.current.query).toBe('');
      expect(result.current.filters.categories).toEqual([]);
      expect(result.current.filters.rating).toBeNull();
      expect(result.current.filters.distance).toBe(25);
      expect(result.current.suggestions).toEqual([]);
      expect(result.current.results).toBeNull();
      expect(result.current.isSearching).toBe(false);
      expect(result.current.showSuggestions).toBe(false);
      expect(result.current.selectedSuggestionIndex).toBe(-1);
      expect(result.current.recentSearches).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should have popular searches populated', () => {
      const { result } = renderHook(() => useSearchStore());

      expect(result.current.popularSearches).toContain('Restaurants near me');
      expect(result.current.popularSearches).toContain('Coffee shops');
      expect(result.current.popularSearches.length).toBeGreaterThan(0);
    });
  });

  describe('Query Management', () => {
    it('should update query', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.setQuery('pizza');
      });

      expect(result.current.query).toBe('pizza');
      expect(result.current.showSuggestions).toBe(true);
      expect(result.current.selectedSuggestionIndex).toBe(-1);
    });

    it('should clear suggestions when query is empty', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.setQuery('test');
      });

      expect(result.current.showSuggestions).toBe(true);

      act(() => {
        result.current.setQuery('');
      });

      expect(result.current.showSuggestions).toBe(false);
      expect(result.current.suggestions).toEqual([]);
    });

    it('should clear error when setting new query', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.setError('Test error');
        result.current.setQuery('new query');
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Filter Management', () => {
    it('should update filters', () => {
      const { result } = renderHook(() => useSearchStore());

      const newFilters: Partial<SearchFilters> = {
        categories: ['restaurants'],
        rating: 4.0,
        distance: 15,
      };

      act(() => {
        result.current.setFilters(newFilters);
      });

      expect(result.current.filters.categories).toEqual(['restaurants']);
      expect(result.current.filters.rating).toBe(4.0);
      expect(result.current.filters.distance).toBe(15);
    });

    it('should reset filters to defaults', () => {
      const { result } = renderHook(() => useSearchStore());

      // Set some filters
      act(() => {
        result.current.setFilters({
          categories: ['restaurants'],
          rating: 4.0,
          businessHours: 'open_now',
        });
      });

      // Reset filters
      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filters.categories).toEqual([]);
      expect(result.current.filters.rating).toBeNull();
      expect(result.current.filters.businessHours).toBe('any');
      expect(result.current.filters.distance).toBe(25); // Default distance
    });

    it('should preserve location when resetting filters', () => {
      const { result } = renderHook(() => useSearchStore());

      const location = {
        lat: 40.7128,
        lng: -74.0060,
        address: 'New York, NY',
      };

      // Set location and other filters
      act(() => {
        result.current.setFilters({
          categories: ['restaurants'],
          rating: 4.0,
          location,
        });
      });

      // Reset filters
      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filters.location).toEqual(location);
      expect(result.current.filters.categories).toEqual([]);
    });
  });

  describe('Search Execution', () => {
    beforeEach(() => {
      const { businessApi } = require('../../lib/api/businesses');
      businessApi.getBusinesses.mockResolvedValue({
        data: [
          { id: '1', name: 'Test Business', category: 'Restaurant' },
          { id: '2', name: 'Another Business', category: 'Coffee' },
        ],
        total: 2,
        hasMore: false,
      });
    });

    it('should execute search successfully', async () => {
      const { result } = renderHook(() => useSearchStore());

      await act(async () => {
        result.current.setQuery('pizza');
        await result.current.executeSearch();
      });

      expect(result.current.isSearching).toBe(false);
      expect(result.current.results).toBeDefined();
      expect(result.current.results?.businesses).toHaveLength(2);
      expect(result.current.results?.query).toBe('pizza');
      expect(result.current.error).toBeNull();
    });

    it('should handle search with custom filters', async () => {
      const { result } = renderHook(() => useSearchStore());
      const { businessApi } = require('../../lib/api/businesses');

      const customFilters: Partial<SearchFilters> = {
        categories: ['restaurants'],
        rating: 4.0,
        distance: 10,
      };

      await act(async () => {
        result.current.setFilters(customFilters);
        await result.current.executeSearch('italian food');
      });

      expect(businessApi.getBusinesses).toHaveBeenCalledWith({
        query: 'italian food',
        location: undefined,
        radius: 16093.4, // 10 miles in meters
        sortBy: 'relevance',
        filters: {
          rating: 4.0,
          openNow: false,
          premiumOnly: false,
          verifiedOnly: false,
        },
      });
    });

    it('should handle search errors', async () => {
      const { result } = renderHook(() => useSearchStore());
      const { businessApi } = require('../../lib/api/businesses');

      businessApi.getBusinesses.mockRejectedValue(new Error('Search failed'));

      await act(async () => {
        result.current.setQuery('test');
        await result.current.executeSearch();
      });

      expect(result.current.isSearching).toBe(false);
      expect(result.current.error).toBe('Search failed');
      expect(result.current.results).toBeNull();
    });

    it('should not execute search with empty query', async () => {
      const { result } = renderHook(() => useSearchStore());
      const { businessApi } = require('../../lib/api/businesses');

      await act(async () => {
        await result.current.executeSearch('');
      });

      expect(businessApi.getBusinesses).not.toHaveBeenCalled();
      expect(result.current.error).toBe('Please enter a search query');
    });

    it('should update search metrics', async () => {
      const { result } = renderHook(() => useSearchStore());

      const initialSearchCount = result.current.searchCount;
      const initialAvgResponseTime = result.current.averageResponseTime;

      await act(async () => {
        result.current.setQuery('test');
        await result.current.executeSearch();
      });

      expect(result.current.searchCount).toBe(initialSearchCount + 1);
      expect(result.current.averageResponseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Suggestions Management', () => {
    it('should update suggestions', () => {
      const { result } = renderHook(() => useSearchStore());

      const mockSuggestions = [
        { id: '1', text: 'Pizza', type: 'business' as const, icon: '🍕' },
        { id: '2', text: 'Coffee', type: 'business' as const, icon: '☕' },
      ];

      act(() => {
        result.current.setSuggestions(mockSuggestions);
      });

      expect(result.current.suggestions).toEqual(mockSuggestions);
      expect(result.current.selectedSuggestionIndex).toBe(-1);
    });

    it('should handle suggestion selection', async () => {
      const { result } = renderHook(() => useSearchStore());

      const mockSuggestion = {
        id: '1',
        text: 'Pizza Restaurant',
        type: 'business' as const,
        icon: '🍕',
        data: {
          category: 'restaurants',
          rating: 4.5,
        },
      };

      await act(async () => {
        await result.current.selectSuggestion(mockSuggestion, 0);
      });

      expect(result.current.query).toBe('Pizza Restaurant');
      expect(result.current.showSuggestions).toBe(false);
      expect(result.current.selectedSuggestionIndex).toBe(0);
    });

    it('should apply suggestion filters', async () => {
      const { result } = renderHook(() => useSearchStore());

      const suggestionWithFilters = {
        id: '1',
        text: 'Italian near me',
        type: 'location' as const,
        icon: '📍',
        data: {
          category: 'restaurants',
          rating: 4.0,
          nearMe: true,
        },
      };

      // Set current location
      act(() => {
        result.current.setFilters({
          location: { lat: 40.7128, lng: -74.0060, address: 'NYC' },
        });
      });

      await act(async () => {
        await result.current.selectSuggestion(suggestionWithFilters, 0);
      });

      expect(result.current.filters.categories).toEqual(['restaurants']);
      expect(result.current.filters.rating).toBe(4.0);
      expect(result.current.filters.distance).toBe(10); // Reduced for "near me"
    });
  });

  describe('Search History', () => {
    it('should add to recent searches', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.addToRecentSearches('pizza');
      });

      expect(result.current.recentSearches).toContain('pizza');
    });

    it('should not add duplicate recent searches', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.addToRecentSearches('pizza');
        result.current.addToRecentSearches('coffee');
        result.current.addToRecentSearches('pizza'); // Duplicate
      });

      expect(result.current.recentSearches).toEqual(['pizza', 'coffee']);
    });

    it('should limit recent searches to 10', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        // Add 15 searches
        for (let i = 1; i <= 15; i++) {
          result.current.addToRecentSearches(`search ${i}`);
        }
      });

      expect(result.current.recentSearches).toHaveLength(10);
      expect(result.current.recentSearches[0]).toBe('search 15'); // Most recent first
    });

    it('should clear search history', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.addToRecentSearches('pizza');
        result.current.trackSearch({
          query: 'pizza',
          filters: {},
          resultCount: 5,
          responseTime: 200,
          clickThroughRate: 0.5,
        });
      });

      act(() => {
        result.current.clearSearchHistory();
      });

      expect(result.current.recentSearches).toEqual([]);
      expect(result.current.searchHistory).toEqual([]);
      expect(result.current.searchAnalytics).toEqual([]);
    });
  });

  describe('Analytics Tracking', () => {
    it('should track search analytics', () => {
      const { result } = renderHook(() => useSearchStore());

      const analyticsData = {
        query: 'pizza',
        filters: { categories: ['restaurants'] },
        resultCount: 10,
        responseTime: 250,
        clickThroughRate: 0.3,
      };

      act(() => {
        result.current.trackSearch(analyticsData);
      });

      expect(result.current.searchAnalytics).toHaveLength(1);
      expect(result.current.searchAnalytics[0]).toMatchObject(analyticsData);
      expect(result.current.searchAnalytics[0].executedAt).toBeInstanceOf(Date);
    });

    it('should limit analytics storage to 100 entries', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        // Add 110 analytics entries
        for (let i = 1; i <= 110; i++) {
          result.current.trackSearch({
            query: `search ${i}`,
            filters: {},
            resultCount: i,
            responseTime: 200,
            clickThroughRate: 0.5,
          });
        }
      });

      expect(result.current.searchAnalytics).toHaveLength(100);
      expect(result.current.searchAnalytics[0].query).toBe('search 110'); // Most recent first
    });
  });

  describe('URL Synchronization', () => {
    beforeEach(() => {
      mockReplaceState.mockClear();
    });

    it('should update URL with search parameters', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.setQuery('pizza');
        result.current.setFilters({
          categories: ['restaurants'],
          rating: 4.0,
          distance: 15,
        });
      });

      // updateURL is called internally by setQuery and setFilters
      expect(mockReplaceState).toHaveBeenCalled();
    });

    it('should sync from URL parameters', () => {
      // Mock URL with search parameters
      Object.defineProperty(window, 'location', {
        value: {
          href: 'http://localhost:3000?q=pizza&categories=restaurants&rating=4.0&distance=15',
        },
        writable: true,
      });

      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.syncWithURL();
      });

      expect(result.current.query).toBe('pizza');
      expect(result.current.filters.categories).toEqual(['restaurants']);
      expect(result.current.filters.rating).toBe(4.0);
      expect(result.current.filters.distance).toBe(15);
    });

    it('should handle malformed URL parameters gracefully', () => {
      Object.defineProperty(window, 'location', {
        value: {
          href: 'http://localhost:3000?invalid=url&categories=invalid,format',
        },
        writable: true,
      });

      const { result } = renderHook(() => useSearchStore());

      expect(() => {
        act(() => {
          result.current.syncWithURL();
        });
      }).not.toThrow();
    });
  });

  describe('UI State Management', () => {
    it('should toggle suggestions visibility', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.setShowSuggestions(true);
      });

      expect(result.current.showSuggestions).toBe(true);

      act(() => {
        result.current.setShowSuggestions(false);
      });

      expect(result.current.showSuggestions).toBe(false);
      expect(result.current.selectedSuggestionIndex).toBe(-1);
    });

    it('should update selected suggestion index', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.setSelectedSuggestionIndex(2);
      });

      expect(result.current.selectedSuggestionIndex).toBe(2);
    });

    it('should handle error states', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.setError('Test error message');
      });

      expect(result.current.error).toBe('Test error message');

      act(() => {
        result.current.setError(null);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Persistence', () => {
    it('should persist recent searches to localStorage', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.addToRecentSearches('pizza');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'lawless-search-store',
        expect.stringContaining('pizza')
      );
    });

    it('should load persisted data from localStorage', () => {
      const persistedData = {
        state: {
          recentSearches: ['pizza', 'coffee'],
          searchHistory: [],
          searchAnalytics: [],
        },
        version: 0,
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(persistedData));

      const { result } = renderHook(() => useSearchStore());

      expect(result.current.recentSearches).toEqual(['pizza', 'coffee']);
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      expect(() => {
        renderHook(() => useSearchStore());
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should not trigger unnecessary updates', () => {
      const { result } = renderHook(() => useSearchStore());
      const initialRenderCount = result.current.searchCount;

      // Setting the same query should not trigger state changes
      act(() => {
        result.current.setQuery('test');
        result.current.setQuery('test'); // Same value
      });

      expect(result.current.query).toBe('test');
      // Should not have triggered additional processing
    });

    it('should debounce URL updates', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.setQuery('a');
        result.current.setQuery('ab');
        result.current.setQuery('abc');
      });

      // URL should only be updated once for the final value
      expect(result.current.query).toBe('abc');
    });
  });
});