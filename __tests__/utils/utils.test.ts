import { cn, formatDistance, formatRating, generateStars } from '@/lib/utils'

describe('Utility Functions', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      const result = cn('base-class', 'additional-class')
      expect(result).toBe('base-class additional-class')
    })

    it('should handle conditional classes', () => {
      const result = cn('base-class', true && 'conditional-class', false && 'hidden-class')
      expect(result).toBe('base-class conditional-class')
    })
  })

  describe('formatDistance', () => {
    it('should format distance correctly', () => {
      expect(formatDistance(1.5)).toBe('1.5 mi')
      expect(formatDistance(0.2)).toBe('0.2 mi')
    })
  })

  describe('formatRating', () => {
    it('should format rating to one decimal place', () => {
      expect(formatRating(4.9)).toBe('4.9')
      expect(formatRating(4)).toBe('4.0')
    })
  })

  describe('generateStars', () => {
    it('should generate correct star patterns', () => {
      expect(generateStars(5)).toBe('★★★★★')
      expect(generateStars(4.5)).toBe('★★★★☆')
      expect(generateStars(3)).toBe('★★★☆☆')
      expect(generateStars(0)).toBe('☆☆☆☆☆')
    })
  })
})