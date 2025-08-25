import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { BusinessCard } from '@/components/features/business/BusinessCard.simple'
import { mockBusiness, mockBusinessFree } from '@/__tests__/mocks/business'

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    img: ({ children, ...props }: any) => <img {...props}>{children}</img>,
  },
  AnimatePresence: ({ children }: any) => children,
}))

describe('BusinessCard Component', () => {
  const defaultProps = {
    business: mockBusiness,
    onCardClick: jest.fn(),
    onBookmarkToggle: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render business information correctly', () => {
      render(<BusinessCard {...defaultProps} />)
      
      expect(screen.getByText(mockBusiness.name)).toBeInTheDocument()
      expect(screen.getByText(mockBusiness.category)).toBeInTheDocument()
      expect(screen.getByText('0.2 mi')).toBeInTheDocument()
      expect(screen.getByText('4.9')).toBeInTheDocument()
      expect(screen.getByText('(127 reviews)')).toBeInTheDocument()
    })

    it('should display premium badge for premium businesses', () => {
      render(<BusinessCard {...defaultProps} business={mockBusiness} />)
      expect(screen.getByText('⭐ PREMIUM')).toBeInTheDocument()
    })

    it('should not display premium badge for free businesses', () => {
      render(<BusinessCard {...defaultProps} business={mockBusinessFree} />)
      expect(screen.queryByText('⭐ PREMIUM')).not.toBeInTheDocument()
    })

    it('should render business image with correct alt text', () => {
      render(<BusinessCard {...defaultProps} />)
      const image = screen.getByAltText(mockBusiness.name)
      expect(image).toBeInTheDocument()
      expect(image).toHaveAttribute('src', mockBusiness.primaryImage)
    })

    it('should render trust badges', () => {
      render(<BusinessCard {...defaultProps} />)
      mockBusiness.badges.forEach(badge => {
        expect(screen.getByText(badge)).toBeInTheDocument()
      })
    })
  })

  describe('Interactions', () => {
    it('should handle click events', () => {
      const handleSelect = jest.fn()
      render(<BusinessCard {...defaultProps} onCardClick={handleSelect} />)
      
      const card = screen.getByRole('article')
      fireEvent.click(card)
      expect(handleSelect).toHaveBeenCalledWith(mockBusiness)
    })

    it('should handle bookmark toggle', () => {
      const handleBookmark = jest.fn()
      render(<BusinessCard {...defaultProps} onBookmarkToggle={handleBookmark} />)
      
      const bookmarkButton = screen.getByLabelText('Bookmark business')
      fireEvent.click(bookmarkButton)
      expect(handleBookmark).toHaveBeenCalledWith(mockBusiness.id)
    })

    it('should be keyboard navigable', () => {
      const handleSelect = jest.fn()
      render(<BusinessCard {...defaultProps} onCardClick={handleSelect} />)
      
      const card = screen.getByRole('article')
      card.focus()
      fireEvent.keyDown(card, { key: 'Enter' })
      
      expect(handleSelect).toHaveBeenCalledWith(mockBusiness)
    })

    it('should handle keyboard navigation for bookmark', () => {
      const handleBookmark = jest.fn()
      render(<BusinessCard {...defaultProps} onBookmarkToggle={handleBookmark} />)
      
      const bookmarkButton = screen.getByLabelText('Bookmark business')
      fireEvent.keyDown(bookmarkButton, { key: 'Enter' })
      
      expect(handleBookmark).toHaveBeenCalledWith(mockBusiness.id)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<BusinessCard {...defaultProps} />)
      
      const card = screen.getByRole('article')
      expect(card).toHaveAttribute('aria-labelledby')
      expect(card).toHaveAttribute('aria-describedby')
      expect(card).toHaveAttribute('tabIndex', '0')
    })

    it('should have accessible star rating', () => {
      render(<BusinessCard {...defaultProps} />)
      
      const rating = screen.getByRole('img', { name: /star rating/i })
      expect(rating).toHaveAttribute('aria-label', 'Star rating: 4.9 out of 5 stars')
    })

    it('should have proper heading structure', () => {
      render(<BusinessCard {...defaultProps} />)
      
      const heading = screen.getByRole('heading', { level: 3 })
      expect(heading).toHaveTextContent(mockBusiness.name)
    })
  })

  describe('Variants', () => {
    it('should apply grid variant classes', () => {
      render(<BusinessCard {...defaultProps} variant="grid" />)
      const card = screen.getByRole('article')
      expect(card).toHaveClass('business-card')
    })

    it('should apply list variant classes', () => {
      render(<BusinessCard {...defaultProps} variant="list" />)
      const card = screen.getByRole('article')
      expect(card).toHaveClass('business-card', 'list-variant')
    })

    it('should apply premium styling for premium businesses', () => {
      render(<BusinessCard {...defaultProps} business={mockBusiness} />)
      const card = screen.getByRole('article')
      expect(card).toHaveClass('premium-card')
    })
  })

  describe('Animation', () => {
    it('should apply animation delay when provided', () => {
      render(<BusinessCard {...defaultProps} animationDelay={300} />)
      const card = screen.getByRole('article')
      expect(card).toHaveStyle('animation-delay: 300ms')
    })
  })
})