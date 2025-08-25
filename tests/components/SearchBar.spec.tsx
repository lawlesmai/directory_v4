import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SearchBar from '../../components/SearchBar';

describe('SearchBar Component', () => {
  const mockOnSearch = jest.fn();

  beforeEach(() => {
    mockOnSearch.mockClear();
  });

  test('renders SearchBar with correct initial state', () => {
    render(<SearchBar onSearch={mockOnSearch} />);
    
    const searchInput = screen.getByTestId('search-input');
    const searchButton = screen.getByTestId('search-button');
    const searchContainer = screen.getByTestId('search-container');
    
    expect(searchInput).toBeInTheDocument();
    expect(searchButton).toBeInTheDocument();
    expect(searchContainer).toBeInTheDocument();
    expect(searchInput).toHaveAttribute('placeholder', 'Search businesses, services, or locations...');
  });

  test('handles user typing and search', async () => {
    render(<SearchBar onSearch={mockOnSearch} />);
    
    const searchInput = screen.getByTestId('search-input');
    const searchButton = screen.getByTestId('search-button');
    
    fireEvent.change(searchInput, { target: { value: 'restaurant' } });
    fireEvent.click(searchButton);
    
    await waitFor(() => {
      expect(mockOnSearch).toHaveBeenCalledWith('restaurant');
    });
  });

  test('displays suggestions when query length is 2 or more', async () => {
    render(<SearchBar onSearch={mockOnSearch} />);
    
    const searchInput = screen.getByTestId('search-input');
    
    fireEvent.change(searchInput, { target: { value: 're' } });
    
    await waitFor(() => {
      const suggestions = screen.getAllByTestId('search-suggestion');
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  test('handles loading state', () => {
    render(<SearchBar onSearch={mockOnSearch} isLoading={true} />);
    
    const searchInput = screen.getByTestId('search-input');
    const searchButton = screen.getByTestId('search-button');
    
    expect(searchInput).toBeDisabled();
    expect(searchButton).toBeDisabled();
    expect(searchButton).toHaveTextContent('⏳');
  });

  test('handles keyboard events', () => {
    render(<SearchBar onSearch={mockOnSearch} />);
    
    const searchInput = screen.getByTestId('search-input');
    
    fireEvent.keyDown(searchInput, { key: 'Enter', preventDefault: () => {} });
    
    expect(mockOnSearch).toHaveBeenCalled();
  });

  test('handles suggestion click', async () => {
    render(<SearchBar onSearch={mockOnSearch} />);
    
    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 're' } });
    
    await waitFor(() => {
      const suggestions = screen.getAllByTestId('search-suggestion');
      fireEvent.click(suggestions[0]);
      
      expect(mockOnSearch).toHaveBeenCalled();
    });
  });
});
