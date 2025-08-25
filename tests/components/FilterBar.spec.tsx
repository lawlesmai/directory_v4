import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FilterBar from '../../components/FilterBar';

describe('FilterBar Component', () => {
  const mockCategories = ['All', 'Restaurants', 'Health & Beauty'];
  const mockOnCategoryChange = jest.fn();

  beforeEach(() => {
    mockOnCategoryChange.mockClear();
  });

  test('renders FilterBar with correct initial state', () => {
    render(
      <FilterBar
        categories={mockCategories}
        activeCategory="All"
        onCategoryChange={mockOnCategoryChange}
      />
    );
    
    const filterBar = screen.getByTestId('filter-bar');
    const filterChips = screen.getByTestId('filter-chips');
    const filterResults = screen.getByTestId('filter-results');
    
    expect(filterBar).toBeInTheDocument();
    expect(filterChips).toBeInTheDocument();
    expect(filterResults).toBeInTheDocument();
  });

  test('renders category chips with correct attributes', () => {
    render(
      <FilterBar
        categories={mockCategories}
        activeCategory="Restaurants"
        onCategoryChange={mockOnCategoryChange}
      />
    );
    
    mockCategories.forEach(category => {
      const chipTestId = category.toLowerCase().replace(/\s+/g, '-');
      const chip = screen.getByTestId(`filter-chip-${chipTestId}`);
      expect(chip).toBeInTheDocument();
      expect(chip).toHaveAttribute('aria-label', `Filter by ${category}`);
    });
  });

  test('handles category selection', () => {
    render(
      <FilterBar
        categories={mockCategories}
        activeCategory="All"
        onCategoryChange={mockOnCategoryChange}
      />
    );
    
    const restaurantChip = screen.getByTestId('filter-chip-restaurants');
    fireEvent.click(restaurantChip);
    
    expect(mockOnCategoryChange).toHaveBeenCalledWith('Restaurants');
  });

  test('handles loading state', () => {
    render(
      <FilterBar
        categories={mockCategories}
        activeCategory="All"
        onCategoryChange={mockOnCategoryChange}
        isLoading={true}
      />
    );
    
    const filterBar = screen.getByTestId('filter-bar');
    const filterLoading = screen.getByTestId('filter-loading');
    const restaurantChip = screen.getByTestId('filter-chip-restaurants');
    
    expect(filterBar).toHaveClass('loading');
    expect(filterLoading).toBeInTheDocument();
    expect(filterLoading).toHaveTextContent('Filtering results...');
    expect(restaurantChip).toBeDisabled();
  });

  test('active category is correctly highlighted', () => {
    render(
      <FilterBar
        categories={mockCategories}
        activeCategory="Restaurants"
        onCategoryChange={mockOnCategoryChange}
      />
    );
    
    const restaurantChip = screen.getByTestId('filter-chip-restaurants');
    expect(restaurantChip).toHaveClass('active');
  });
});
