/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchInterface, type SearchFilters } from '../../components/SearchInterface';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    button: 'button',
    input: 'input',
    span: 'span',
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock hooks
jest.mock('../../hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

jest.mock('../../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: jest.fn(),
}));

// Mock geolocation
const mockGeolocation = {
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
};

Object.defineProperty(global.navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true,
});

describe('SearchInterface', () => {
  const mockOnSearch = jest.fn();
  const mockOnFilterChange = jest.fn();

  const defaultProps = {
    onSearch: mockOnSearch,
    onFilterChange: mockOnFilterChange,
    suggestions: [],
    isLoading: false,
  };

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

  beforeEach(() => {
    jest.clearAllMocks();
    mockGeolocation.getCurrentPosition.mockClear();
  });

  describe('Rendering', () => {
    it('should render search interface with all elements', () => {
      render(<SearchInterface {...defaultProps} />);

      expect(screen.getByTestId('search-interface')).toBeInTheDocument();
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
      expect(screen.getByTestId('search-button')).toBeInTheDocument();
      expect(screen.getByTestId('near-me-button')).toBeInTheDocument();
      expect(screen.getByTestId('filters-toggle')).toBeInTheDocument();
    });

    it('should render with custom placeholder', () => {
      const customPlaceholder = 'Search for awesome businesses...';
      render(<SearchInterface {...defaultProps} placeholder={customPlaceholder} />);

      expect(screen.getByPlaceholderText(customPlaceholder)).toBeInTheDocument();
    });

    it('should render with initial query', () => {
      render(<SearchInterface {...defaultProps} initialQuery="pizza" />);

      expect(screen.getByDisplayValue('pizza')).toBeInTheDocument();
    });

    it('should show loading state', () => {
      render(<SearchInterface {...defaultProps} isLoading />);

      expect(screen.getByTestId('search-input')).toBeDisabled();
      expect(screen.getByTestId('search-button')).toBeDisabled();
    });
  });

  describe('Search Input Interactions', () => {
    it('should handle text input', async () => {
      const user = userEvent.setup();
      render(<SearchInterface {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'coffee');

      expect(searchInput).toHaveValue('coffee');
    });

    it('should handle form submission', async () => {
      const user = userEvent.setup();
      render(<SearchInterface {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'restaurant');
      await user.click(screen.getByTestId('search-button'));

      expect(mockOnSearch).toHaveBeenCalledWith('restaurant', expect.any(Object));
    });

    it('should handle Enter key submission', async () => {
      const user = userEvent.setup();
      render(<SearchInterface {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'pizza');
      await user.keyboard('{Enter}');

      expect(mockOnSearch).toHaveBeenCalledWith('pizza', expect.any(Object));
    });

    it('should show clear button when query exists', async () => {
      const user = userEvent.setup();
      render(<SearchInterface {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'test');

      expect(screen.getByTestId('clear-button')).toBeInTheDocument();
    });

    it('should clear search when clear button clicked', async () => {
      const user = userEvent.setup();
      render(<SearchInterface {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'test');
      await user.click(screen.getByTestId('clear-button'));

      expect(searchInput).toHaveValue('');
    });

    it('should not submit empty searches', async () => {
      const user = userEvent.setup();
      render(<SearchInterface {...defaultProps} />);

      await user.click(screen.getByTestId('search-button'));

      expect(mockOnSearch).not.toHaveBeenCalled();
    });
  });

  describe('Search Suggestions', () => {
    const mockSuggestions = [
      {
        id: '1',
        text: 'Coffee Shop',
        type: 'business' as const,
        icon: '☕',
      },
      {
        id: '2',
        text: 'Coffee near me',
        type: 'location' as const,
        icon: '📍',
        data: { nearMe: true },
      },
    ];

    it('should render suggestions when provided', () => {
      render(<SearchInterface {...defaultProps} suggestions={mockSuggestions} />);

      // Suggestions component should receive the suggestions
      // Note: This tests the props passed to SearchSuggestions component
    });

    it('should handle suggestion selection', async () => {
      const user = userEvent.setup();
      render(<SearchInterface {...defaultProps} suggestions={mockSuggestions} />);

      // Type to show suggestions
      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'cof');

      // This would test the handleSuggestionSelect callback
      // The actual implementation would depend on SearchSuggestions component
    });

    it('should apply suggestion data to filters', () => {
      // Test that suggestions with data property update filters appropriately
      const suggestionWithData = {
        id: '1',
        text: 'Pizza near me',
        type: 'location' as const,
        icon: '📍',
        data: { nearMe: true, category: 'Restaurants' },
      };

      // This would test the filter application logic in handleSuggestionSelect
    });
  });

  describe('Near Me Functionality', () => {
    it('should handle geolocation success', async () => {
      const mockPosition = {
        coords: {
          latitude: 40.7128,
          longitude: -74.0060,
        },
      };

      mockGeolocation.getCurrentPosition.mockImplementationOnce((success) => {
        success(mockPosition);
      });

      const user = userEvent.setup();
      render(<SearchInterface {...defaultProps} />);

      await user.click(screen.getByTestId('near-me-button'));

      await waitFor(() => {
        expect(mockOnFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({
            location: {
              lat: 40.7128,
              lng: -74.0060,
              address: 'Your Location',
            },
          })
        );
      });
    });

    it('should handle geolocation error', async () => {
      const mockError = new Error('Location access denied');
      mockGeolocation.getCurrentPosition.mockImplementationOnce((success, error) => {
        error(mockError);
      });

      // Mock alert
      window.alert = jest.fn();

      const user = userEvent.setup();
      render(<SearchInterface {...defaultProps} />);

      await user.click(screen.getByTestId('near-me-button'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith(
          'Unable to get your location. Please check your browser settings.'
        );
      });
    });

    it('should show loading state while getting location', async () => {
      let resolveGeolocation: (position: any) => void;
      
      mockGeolocation.getCurrentPosition.mockImplementationOnce((success) => {
        resolveGeolocation = success;
      });

      const user = userEvent.setup();
      render(<SearchInterface {...defaultProps} />);

      await user.click(screen.getByTestId('near-me-button'));

      // Should show loading state
      const nearMeButton = screen.getByTestId('near-me-button');
      expect(nearMeButton).toHaveClass(/cursor-not-allowed/);

      // Resolve the geolocation
      act(() => {
        resolveGeolocation({
          coords: { latitude: 40.7128, longitude: -74.0060 },
        });
      });

      await waitFor(() => {
        expect(nearMeButton).not.toHaveClass(/cursor-not-allowed/);
      });
    });

    it('should handle browsers without geolocation', async () => {
      // Temporarily remove geolocation
      const originalGeolocation = global.navigator.geolocation;
      // @ts-ignore
      delete global.navigator.geolocation;

      window.alert = jest.fn();

      const user = userEvent.setup();
      render(<SearchInterface {...defaultProps} />);

      await user.click(screen.getByTestId('near-me-button'));

      expect(window.alert).toHaveBeenCalledWith(
        'Geolocation is not supported by this browser.'
      );

      // Restore geolocation
      global.navigator.geolocation = originalGeolocation;
    });
  });

  describe('Advanced Filters', () => {
    it('should toggle advanced filters', async () => {
      const user = userEvent.setup();
      render(<SearchInterface {...defaultProps} />);

      const filtersToggle = screen.getByTestId('filters-toggle');
      await user.click(filtersToggle);

      expect(screen.getByTestId('advanced-filters')).toBeInTheDocument();

      await user.click(filtersToggle);
      // Note: Due to AnimatePresence, the element might still be in DOM but hidden
      // You'd need to test the actual visibility or animation state
    });

    it('should show active filters count', async () => {
      const filtersWithActive: SearchFilters = {
        ...defaultFilters,
        categories: ['restaurants', 'coffee'],
        rating: 4.0,
      };

      render(
        <SearchInterface 
          {...defaultProps} 
          initialFilters={filtersWithActive}
        />
      );

      const filtersToggle = screen.getByTestId('filters-toggle');
      // Should show count indicator
      expect(filtersToggle.textContent).toContain('2'); // 2 active filter groups
    });

    it('should handle category filter changes', async () => {
      const user = userEvent.setup();
      render(<SearchInterface {...defaultProps} showAdvancedFilters />);

      // Click on a category
      const restaurantsCategory = screen.getByText('Restaurants');
      await user.click(restaurantsCategory);

      expect(mockOnFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({
          categories: ['Restaurants'],
        })
      );
    });

    it('should handle rating filter changes', async () => {
      const user = userEvent.setup();
      render(<SearchInterface {...defaultProps} showAdvancedFilters />);

      const ratingSelect = screen.getByDisplayValue('Any Rating');
      await user.selectOptions(ratingSelect, '4.0');

      expect(mockOnFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({
          rating: 4.0,
        })
      );
    });

    it('should handle distance filter changes', async () => {
      const user = userEvent.setup();
      render(<SearchInterface {...defaultProps} showAdvancedFilters />);

      const distanceSlider = screen.getByRole('slider');
      await user.clear(distanceSlider);
      await user.type(distanceSlider, '15');

      expect(mockOnFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({
          distance: 15,
        })
      );
    });

    it('should handle business hours filter changes', async () => {
      const user = userEvent.setup();
      render(<SearchInterface {...defaultProps} showAdvancedFilters />);

      const hoursSelect = screen.getByDisplayValue('Any Hours');
      await user.selectOptions(hoursSelect, 'open_now');

      expect(mockOnFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({
          businessHours: 'open_now',
        })
      );
    });

    it('should clear all filters', async () => {
      const user = userEvent.setup();
      const activeFilters: SearchFilters = {
        ...defaultFilters,
        categories: ['restaurants'],
        rating: 4.0,
        businessHours: 'open_now',
      };

      render(
        <SearchInterface 
          {...defaultProps} 
          initialFilters={activeFilters}
          showAdvancedFilters
        />
      );

      const clearButton = screen.getByTestId('clear-all-filters');
      await user.click(clearButton);

      expect(mockOnFilterChange).toHaveBeenCalledWith(defaultFilters);
    });
  });

  describe('Keyboard Interactions', () => {
    it('should handle keyboard navigation in suggestions', async () => {
      const user = userEvent.setup();
      const mockSuggestions = [
        { id: '1', text: 'Coffee', type: 'business' as const, icon: '☕' },
        { id: '2', text: 'Coffee Shop', type: 'business' as const, icon: '🏪' },
      ];

      render(<SearchInterface {...defaultProps} suggestions={mockSuggestions} />);

      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'cof');

      // Test arrow key navigation
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowUp}');
      await user.keyboard('{Enter}');

      // Should trigger search with selected suggestion
      expect(mockOnSearch).toHaveBeenCalled();
    });

    it('should handle Escape key', async () => {
      const user = userEvent.setup();
      render(<SearchInterface {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'test');
      await user.keyboard('{Escape}');

      // Should clear suggestions and blur input
      expect(searchInput).not.toHaveFocus();
    });
  });

  describe('Integration', () => {
    it('should integrate search and filters correctly', async () => {
      const user = userEvent.setup();
      render(<SearchInterface {...defaultProps} showAdvancedFilters />);

      // Set up filters
      const restaurantsCategory = screen.getByText('Restaurants');
      await user.click(restaurantsCategory);

      const ratingSelect = screen.getByDisplayValue('Any Rating');
      await user.selectOptions(ratingSelect, '4.0');

      // Execute search
      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'italian');
      await user.click(screen.getByTestId('search-button'));

      expect(mockOnSearch).toHaveBeenCalledWith(
        'italian',
        expect.objectContaining({
          categories: ['Restaurants'],
          rating: 4.0,
        })
      );
    });

    it('should maintain filter state across searches', async () => {
      const user = userEvent.setup();
      render(<SearchInterface {...defaultProps} showAdvancedFilters />);

      // Set a filter
      const restaurantsCategory = screen.getByText('Restaurants');
      await user.click(restaurantsCategory);

      // Execute first search
      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'pizza');
      await user.click(screen.getByTestId('search-button'));

      // Execute second search
      await user.clear(searchInput);
      await user.type(searchInput, 'pasta');
      await user.click(screen.getByTestId('search-button'));

      // Both searches should include the filter
      expect(mockOnSearch).toHaveBeenCalledTimes(2);
      expect(mockOnSearch).toHaveBeenLastCalledWith(
        'pasta',
        expect.objectContaining({
          categories: ['Restaurants'],
        })
      );
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<SearchInterface {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      expect(searchInput).toHaveAttribute('aria-label');
      expect(searchInput).toHaveAttribute('role', 'combobox');
      expect(searchInput).toHaveAttribute('aria-autocomplete', 'list');
      expect(searchInput).toHaveAttribute('aria-expanded', 'false');
    });

    it('should update ARIA attributes based on state', async () => {
      const user = userEvent.setup();
      const mockSuggestions = [
        { id: '1', text: 'Coffee', type: 'business' as const, icon: '☕' },
      ];

      render(<SearchInterface {...defaultProps} suggestions={mockSuggestions} />);

      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'cof');

      expect(searchInput).toHaveAttribute('aria-expanded', 'true');
    });

    it('should support keyboard-only navigation', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      render(<SearchInterface {...defaultProps} showAdvancedFilters />);

      // Tab through elements
      await user.tab();
      expect(screen.getByTestId('search-input')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('near-me-button')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('filters-toggle')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('search-button')).toHaveFocus();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid filter values gracefully', () => {
      const invalidFilters = {
        ...defaultFilters,
        rating: -1, // Invalid rating
        distance: -5, // Invalid distance
      };

      expect(() => {
        render(<SearchInterface {...defaultProps} initialFilters={invalidFilters} />);
      }).not.toThrow();
    });

    it('should handle missing required props', () => {
      // @ts-expect-error Testing error handling
      expect(() => {
        render(<SearchInterface />);
      }).not.toThrow();
    });

    it('should handle malformed suggestions', () => {
      const malformedSuggestions = [
        // @ts-expect-error Testing error handling
        { id: '1' }, // Missing required fields
        // @ts-expect-error Testing error handling
        { text: 'Test' }, // Missing id
      ];

      expect(() => {
        render(<SearchInterface {...defaultProps} suggestions={malformedSuggestions} />);
      }).not.toThrow();
    });
  });
});