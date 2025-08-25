import { useState, useCallback, useEffect, useMemo, useTransition } from 'react';

interface FilterOption {
  id: string;
  label: string;
  value: string;
  count?: number;
  icon?: string;
}

interface FilterCategory {
  id: string;
  name: string;
  type: 'single' | 'multiple' | 'range';
  options: FilterOption[];
}

interface PriceRange {
  min: number;
  max: number;
}

interface FilterState {
  categories: string[];
  priceRange: PriceRange | null;
  rating: number | null;
  distance: number | null;
  isOpen: boolean;
  isPremium: boolean;
  sortBy: 'relevance' | 'distance' | 'rating' | 'price_low' | 'price_high' | 'newest';
}

interface UseFilterFunctionalityOptions {
  enableMultiSelect?: boolean;
  persistFilters?: boolean;
  storageKey?: string;
  onFilterChange?: (filters: FilterState) => void;
  onFilterApply?: (filters: FilterState) => void;
  animationDuration?: number;
}

const DEFAULT_FILTER_STATE: FilterState = {
  categories: [],
  priceRange: null,
  rating: null,
  distance: null,
  isOpen: false,
  isPremium: false,
  sortBy: 'relevance'
};

const STORAGE_KEY_PREFIX = 'lawless_filters_';

export const useFilterFunctionality = (
  options: UseFilterFunctionalityOptions = {}
) => {
  const {
    enableMultiSelect = true,
    persistFilters = true,
    storageKey = 'default',
    onFilterChange,
    onFilterApply,
    animationDuration = 300
  } = options;

  // State management
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [tempFilters, setTempFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [animatingItems, setAnimatingItems] = useState<Set<string>>(new Set());
  const [filteredCount, setFilteredCount] = useState(0);

  // Use transition for non-blocking updates
  const [isPending, startTransition] = useTransition();

  // Available filter categories (would come from API/config)
  const filterCategories: FilterCategory[] = useMemo(() => [
    {
      id: 'category',
      name: 'Category',
      type: enableMultiSelect ? 'multiple' : 'single',
      options: [
        { id: 'restaurants', label: 'Restaurants', value: 'restaurants', count: 45, icon: '🍽️' },
        { id: 'services', label: 'Services', value: 'services', count: 32, icon: '🔧' },
        { id: 'shopping', label: 'Shopping', value: 'shopping', count: 28, icon: '🛍️' },
        { id: 'health', label: 'Health & Beauty', value: 'health', count: 21, icon: '💆' },
        { id: 'entertainment', label: 'Entertainment', value: 'entertainment', count: 15, icon: '🎭' }
      ]
    }
  ], [enableMultiSelect]);

  // Load persisted filters from localStorage
  useEffect(() => {
    if (!persistFilters) return;

    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${storageKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setFilters(parsed);
        setTempFilters(parsed);
      }
    } catch (error) {
      console.warn('Failed to load filter preferences:', error);
    }
  }, [persistFilters, storageKey]);

  // Save filters to localStorage when they change
  const saveFilters = useCallback((newFilters: FilterState) => {
    if (!persistFilters) return;

    try {
      localStorage.setItem(
        `${STORAGE_KEY_PREFIX}${storageKey}`,
        JSON.stringify(newFilters)
      );
    } catch (error) {
      console.warn('Failed to save filter preferences:', error);
    }
  }, [persistFilters, storageKey]);

  // Toggle category filter
  const toggleCategory = useCallback((category: string) => {
    startTransition(() => {
      setTempFilters(prev => {
        const newCategories = enableMultiSelect
          ? prev.categories.includes(category)
            ? prev.categories.filter(c => c !== category)
            : [...prev.categories, category]
          : [category]; // Single select mode

        const newFilters = { ...prev, categories: newCategories };
        
        // Animate the filter chip
        setAnimatingItems(prev => new Set(prev).add(category));
        setTimeout(() => {
          setAnimatingItems(prev => {
            const next = new Set(prev);
            next.delete(category);
            return next;
          });
        }, animationDuration);

        return newFilters;
      });
    });
  }, [enableMultiSelect, animationDuration]);

  // Set price range filter
  const setPriceRange = useCallback((range: PriceRange | null) => {
    setTempFilters(prev => ({ ...prev, priceRange: range }));
  }, []);

  // Set rating filter
  const setRatingFilter = useCallback((rating: number | null) => {
    setTempFilters(prev => ({ ...prev, rating }));
  }, []);

  // Set distance filter
  const setDistanceFilter = useCallback((distance: number | null) => {
    setTempFilters(prev => ({ ...prev, distance }));
  }, []);

  // Toggle open now filter
  const toggleOpenNow = useCallback(() => {
    setTempFilters(prev => ({ ...prev, isOpen: !prev.isOpen }));
  }, []);

  // Toggle premium only filter
  const togglePremiumOnly = useCallback(() => {
    setTempFilters(prev => ({ ...prev, isPremium: !prev.isPremium }));
  }, []);

  // Set sort order
  const setSortBy = useCallback((sortBy: FilterState['sortBy']) => {
    startTransition(() => {
      setFilters(prev => {
        const newFilters = { ...prev, sortBy };
        saveFilters(newFilters);
        onFilterChange?.(newFilters);
        return newFilters;
      });
    });
  }, [saveFilters, onFilterChange]);

  // Apply temporary filters
  const applyFilters = useCallback(() => {
    startTransition(() => {
      setFilters(tempFilters);
      saveFilters(tempFilters);
      onFilterApply?.(tempFilters);
      onFilterChange?.(tempFilters);
      setIsFilterPanelOpen(false);
    });
  }, [tempFilters, saveFilters, onFilterApply, onFilterChange]);

  // Cancel filter changes
  const cancelFilters = useCallback(() => {
    setTempFilters(filters);
    setIsFilterPanelOpen(false);
  }, [filters]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    const clearedFilters = { ...DEFAULT_FILTER_STATE, sortBy: filters.sortBy };
    
    startTransition(() => {
      setFilters(clearedFilters);
      setTempFilters(clearedFilters);
      saveFilters(clearedFilters);
      onFilterChange?.(clearedFilters);
    });
  }, [filters.sortBy, saveFilters, onFilterChange]);

  // Clear specific filter type
  const clearFilterType = useCallback((filterType: keyof FilterState) => {
    startTransition(() => {
      setFilters(prev => {
        const newFilters = {
          ...prev,
          [filterType]: DEFAULT_FILTER_STATE[filterType]
        };
        saveFilters(newFilters);
        onFilterChange?.(newFilters);
        return newFilters;
      });
    });
  }, [saveFilters, onFilterChange]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      filters.categories.length > 0 ||
      filters.priceRange !== null ||
      filters.rating !== null ||
      filters.distance !== null ||
      filters.isOpen ||
      filters.isPremium
    );
  }, [filters]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.categories.length > 0) count += filters.categories.length;
    if (filters.priceRange) count++;
    if (filters.rating) count++;
    if (filters.distance) count++;
    if (filters.isOpen) count++;
    if (filters.isPremium) count++;
    return count;
  }, [filters]);

  // Get filter summary text
  const getFilterSummary = useCallback(() => {
    const parts: string[] = [];
    
    if (filters.categories.length > 0) {
      parts.push(`${filters.categories.length} ${filters.categories.length === 1 ? 'category' : 'categories'}`);
    }
    if (filters.priceRange) {
      parts.push('price range');
    }
    if (filters.rating) {
      parts.push(`${filters.rating}+ stars`);
    }
    if (filters.distance) {
      parts.push(`within ${filters.distance} miles`);
    }
    if (filters.isOpen) {
      parts.push('open now');
    }
    if (filters.isPremium) {
      parts.push('premium only');
    }
    
    return parts.length > 0 ? `Filtered by: ${parts.join(', ')}` : 'No filters applied';
  }, [filters]);

  // Check if a specific category is selected
  const isCategorySelected = useCallback((category: string) => {
    return filters.categories.includes(category);
  }, [filters.categories]);

  // Check if a temporary category is selected (for preview)
  const isTempCategorySelected = useCallback((category: string) => {
    return tempFilters.categories.includes(category);
  }, [tempFilters.categories]);

  // Get applied filters as tags for display
  const getFilterTags = useCallback(() => {
    const tags: Array<{ id: string; label: string; type: keyof FilterState }> = [];
    
    filters.categories.forEach(category => {
      tags.push({
        id: `category-${category}`,
        label: category,
        type: 'categories'
      });
    });
    
    if (filters.priceRange) {
      tags.push({
        id: 'price-range',
        label: `$${filters.priceRange.min} - $${filters.priceRange.max}`,
        type: 'priceRange'
      });
    }
    
    if (filters.rating) {
      tags.push({
        id: 'rating',
        label: `${filters.rating}+ stars`,
        type: 'rating'
      });
    }
    
    if (filters.distance) {
      tags.push({
        id: 'distance',
        label: `${filters.distance} miles`,
        type: 'distance'
      });
    }
    
    if (filters.isOpen) {
      tags.push({
        id: 'open-now',
        label: 'Open now',
        type: 'isOpen'
      });
    }
    
    if (filters.isPremium) {
      tags.push({
        id: 'premium-only',
        label: 'Premium only',
        type: 'isPremium'
      });
    }
    
    return tags;
  }, [filters]);

  // Remove a specific filter tag
  const removeFilterTag = useCallback((tagId: string, type: keyof FilterState) => {
    if (type === 'categories') {
      const category = tagId.replace('category-', '');
      setFilters(prev => {
        const newFilters = {
          ...prev,
          categories: prev.categories.filter(c => c !== category)
        };
        saveFilters(newFilters);
        onFilterChange?.(newFilters);
        return newFilters;
      });
    } else {
      clearFilterType(type);
    }
  }, [saveFilters, onFilterChange, clearFilterType]);

  return {
    // State
    filters,
    tempFilters,
    isFilterPanelOpen,
    animatingItems,
    filteredCount,
    isFiltering: isPending,
    
    // Computed
    hasActiveFilters,
    activeFilterCount,
    filterCategories,
    
    // Methods
    toggleCategory,
    setPriceRange,
    setRatingFilter,
    setDistanceFilter,
    toggleOpenNow,
    togglePremiumOnly,
    setSortBy,
    applyFilters,
    cancelFilters,
    clearAllFilters,
    clearFilterType,
    isCategorySelected,
    isTempCategorySelected,
    getFilterSummary,
    getFilterTags,
    removeFilterTag,
    
    // UI Controls
    openFilterPanel: () => setIsFilterPanelOpen(true),
    closeFilterPanel: () => setIsFilterPanelOpen(false),
    toggleFilterPanel: () => setIsFilterPanelOpen(prev => !prev)
  };
};

export default useFilterFunctionality;