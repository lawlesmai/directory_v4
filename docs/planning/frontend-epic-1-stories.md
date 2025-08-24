# Frontend Epic 1: Component Architecture & UI Migration - Comprehensive Implementation Stories

**Date:** 2024-08-23  
**Epic Lead:** Frontend Developer Agent  
**Priority:** P0 (Critical Foundation)  
**Duration:** 4 Sprints (12 weeks)  
**Story Points Total:** 159 points

## Epic Mission Statement

Transform The Lawless Directory's sophisticated vanilla JavaScript prototype (880-line CSS, 861-line JavaScript) into a modern React-based component architecture while preserving and enhancing all glassmorphism design elements, animations, mobile interactions, and performance optimizations.

## Frontend Architecture Context

**Current Prototype Analysis:**
- 880-line CSS system with 85+ custom properties
- Advanced glassmorphism effects and backdrop filters
- Sophisticated animation system with staggered reveals
- Mobile-first responsive design (4 breakpoints: 320px, 480px, 768px, 1200px)
- Touch gesture support with haptic feedback
- Performance optimizations: RequestAnimationFrame, intersection observers

**Target Architecture:**
- Next.js 14+ with App Router
- TypeScript for type safety
- Tailwind CSS + CSS Modules hybrid approach
- Zustand for state management
- React Query for server state
- Framer Motion for advanced animations
- React Hook Form for form management

**Performance Benchmarks:**
- Lighthouse Performance Score > 90
- First Contentful Paint < 1.5s
- Cumulative Layout Shift < 0.1
- Largest Contentful Paint < 2.5s
- Total Blocking Time < 300ms
- Mobile PageSpeed Score > 90

---

## Story F1.1: Design System Migration & CSS Architecture

**User Story:** As a frontend developer, I want to migrate the sophisticated CSS design system with all 85+ custom properties to a modern React architecture so that we preserve all glassmorphism effects and premium aesthetics while enabling component-based development.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 21  
**Sprint:** 1

### Detailed Acceptance Criteria

**Design System Foundation:**
- **Given** the existing 880-line CSS file with 85+ custom properties
- **When** migrating to Next.js + Tailwind architecture
- **Then** the system should implement:

```typescript
// tailwind.config.js theme extension
module.exports = {
  theme: {
    extend: {
      colors: {
        navy: {
          dark: '#001219',
          90: 'rgba(0, 18, 25, 0.9)',
          70: 'rgba(0, 18, 25, 0.7)',
          50: 'rgba(0, 18, 25, 0.5)',
        },
        teal: {
          primary: '#005F73',
          secondary: '#0A9396',
          20: 'rgba(0, 95, 115, 0.2)',
          10: 'rgba(0, 95, 115, 0.1)',
        },
        sage: '#94D2BD',
        cream: '#E9D8A6',
        gold: {
          primary: '#EE9B00',
          secondary: '#CA6702',
        },
        red: {
          warning: '#BB3E03',
          error: '#AE2012',
          critical: '#9B2226',
        }
      },
      backgroundImage: {
        'premium': 'linear-gradient(135deg, #EE9B00 0%, #CA6702 100%)',
        'trust': 'linear-gradient(135deg, #005F73 0%, #0A9396 100%)',
        'dark': 'linear-gradient(180deg, #001219 0%, #005F73 100%)',
        'dynamic': 'linear-gradient(-45deg, #001219, #005F73, #0A9396, #005F73)',
      },
      fontFamily: {
        'heading': ['Poppins', 'sans-serif'],
        'body': ['Inter', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'xs': '0.75rem',
        'sm': '0.875rem',
        'base': '1rem',
        'lg': '1.125rem',
        'xl': '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem',
      },
      spacing: {
        'micro': '0.25rem',
        'xs': '0.5rem',
        'sm': '0.75rem',
        'base': '1rem',
        'lg': '1.5rem',
        'xl': '2rem',
      },
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
      }
    }
  }
}
```

**Glassmorphism Component System:**
- **Given** the need for reusable glassmorphism effects
- **When** creating component utilities
- **Then** implement:

```typescript
// components/ui/glass-morphism.tsx
interface GlassMorphismProps {
  variant: 'subtle' | 'medium' | 'strong' | 'premium'
  className?: string
  children: React.ReactNode
}

export const GlassMorphism: React.FC<GlassMorphismProps> = ({ 
  variant, 
  className, 
  children 
}) => {
  const variants = {
    subtle: 'bg-navy-50/20 backdrop-blur-sm border border-sage/10',
    medium: 'bg-navy-70/30 backdrop-blur-md border border-sage/20',
    strong: 'bg-navy-90/40 backdrop-blur-lg border border-sage/30',
    premium: 'bg-gradient-to-br from-gold-primary/10 to-gold-secondary/20 backdrop-blur-xl border border-gold-primary/30'
  }
  
  return (
    <div className={cn(variants[variant], className)}>
      {children}
    </div>
  )
}
```

**CSS Modules Integration:**
- **Given** component-specific styling needs
- **When** implementing complex animations and effects
- **Then** create CSS modules for:
  - Business card hover effects
  - Search bar glassmorphism
  - Modal backdrop animations
  - Premium badge effects
  - Loading state animations

### Technical Implementation Requirements

**Font Optimization:**
```typescript
// app/layout.tsx
import { Inter, Poppins } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  weights: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
})

const poppins = Poppins({
  subsets: ['latin'],
  weights: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})
```

**Performance Requirements:**
- Preserve existing CSS custom property performance
- Implement CSS-in-JS for dynamic theming
- Maintain backdrop-filter browser compatibility
- Optimize font loading strategy

### Testing Requirements

**Visual Regression Tests:**
- Automated screenshot comparison for all glassmorphism effects
- Cross-browser backdrop-filter compatibility
- Mobile responsiveness validation across 4 breakpoints
- Dark mode contrast ratio validation

**Performance Tests:**
- CSS bundle size < 50KB gzipped
- Paint metrics preservation during migration
- Animation frame rate > 60fps for all effects

---

## Story F1.2: React Component Architecture & Business Card System

**User Story:** As a frontend developer, I want to create a comprehensive React component architecture that preserves all existing business card animations and interactions while enabling scalable component composition.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 18  
**Sprint:** 1

### Detailed Acceptance Criteria

**Business Card Component System:**
- **Given** the existing sophisticated business card design
- **When** implementing React components
- **Then** create:

```typescript
// components/business/BusinessCard.tsx
interface BusinessCardProps {
  business: Business
  variant: 'grid' | 'list' | 'featured' | 'premium'
  animationDelay?: number
  onCardClick: (business: Business) => void
  onBookmarkToggle: (businessId: string) => void
}

export const BusinessCard: React.FC<BusinessCardProps> = ({
  business,
  variant = 'grid',
  animationDelay = 0,
  onCardClick,
  onBookmarkToggle
}) => {
  const [isHovered, setIsHovered] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  
  // Preserve intersection observer animations
  useIntersectionObserver(cardRef, {
    threshold: 0.2,
    rootMargin: '50px',
    onIntersect: () => {
      // Trigger staggered reveal animation
    }
  })
  
  return (
    <motion.div
      ref={cardRef}
      className={cn(
        'business-card relative group cursor-pointer',
        'bg-navy-70/30 backdrop-blur-lg border border-sage/20',
        'rounded-lg overflow-hidden transition-all duration-300',
        'hover:bg-navy-70/40 hover:border-sage/30',
        'hover:shadow-2xl hover:scale-[1.02]',
        variant === 'premium' && 'border-gold-primary/30 bg-gradient-to-br from-gold-primary/10 to-gold-secondary/20'
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.6, 
        delay: animationDelay,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={() => onCardClick(business)}
    >
      <BusinessCardHeader 
        business={business}
        isPremium={business.subscription === 'premium'}
        isBookmarked={isBookmarked}
        onBookmarkToggle={() => onBookmarkToggle(business.id)}
      />
      
      <BusinessCardImage 
        src={business.primaryImage}
        alt={business.name}
        isHovered={isHovered}
      />
      
      <BusinessCardContent 
        business={business}
        variant={variant}
      />
      
      <BusinessCardFooter 
        rating={business.averageRating}
        reviewCount={business.reviewCount}
        distance={business.distance}
        hours={business.hours}
      />
      
      {business.subscription === 'premium' && (
        <PremiumBadge className="absolute top-2 right-2" />
      )}
    </motion.div>
  )
}
```

**Component Composition System:**
- **Given** the need for flexible business card layouts
- **When** creating component variations
- **Then** implement:

```typescript
// components/business/BusinessCardGrid.tsx
interface BusinessCardGridProps {
  businesses: Business[]
  loading?: boolean
  variant?: 'grid' | 'masonry' | 'list'
  onBusinessSelect: (business: Business) => void
}

export const BusinessCardGrid: React.FC<BusinessCardGridProps> = ({
  businesses,
  loading,
  variant = 'grid',
  onBusinessSelect
}) => {
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true
  })

  return (
    <div
      ref={ref}
      className={cn(
        'business-grid transition-all duration-500',
        variant === 'grid' && 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6',
        variant === 'masonry' && 'columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-6',
        variant === 'list' && 'flex flex-col gap-4'
      )}
    >
      {businesses.map((business, index) => (
        <BusinessCard
          key={business.id}
          business={business}
          variant={variant === 'list' ? 'list' : 'grid'}
          animationDelay={inView ? index * 0.1 : 0}
          onCardClick={onBusinessSelect}
          onBookmarkToggle={handleBookmarkToggle}
        />
      ))}
      
      {loading && (
        <BusinessCardSkeleton count={8} variant={variant} />
      )}
    </div>
  )
}
```

**Animation System Integration:**
- **Given** the existing staggered reveal animations
- **When** implementing with Framer Motion
- **Then** preserve:
  - Card entrance animations with proper delays
  - Hover state micro-interactions
  - Touch feedback for mobile devices
  - Loading state skeleton animations

### Mobile Touch Interaction Requirements

**Touch Gesture Support:**
- **Given** mobile user interactions
- **When** implementing touch handlers
- **Then** support:
  - Long press for context menu
  - Swipe gestures for bookmarking
  - Double tap for quick view
  - Haptic feedback integration

```typescript
// hooks/useTouch.ts
export const useTouch = (ref: RefObject<HTMLElement>) => {
  const [touchStart, setTouchStart] = useState<TouchPoint | null>(null)
  const [touchEnd, setTouchEnd] = useState<TouchPoint | null>(null)
  
  useEffect(() => {
    const element = ref.current
    if (!element) return

    const handleTouchStart = (e: TouchEvent) => {
      setTouchStart({
        x: e.targetTouches[0].clientX,
        y: e.targetTouches[0].clientY,
        timestamp: Date.now()
      })
    }

    const handleTouchEnd = (e: TouchEvent) => {
      setTouchEnd({
        x: e.changedTouches[0].clientX,
        y: e.changedTouches[0].clientY,
        timestamp: Date.now()
      })
    }

    element.addEventListener('touchstart', handleTouchStart)
    element.addEventListener('touchend', handleTouchEnd)

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchend', handleTouchEnd)
    }
  }, [ref])

  // Gesture detection logic
  return { swipeDirection, isLongPress, isDoubleTap }
}
```

### Testing Requirements

**Component Testing:**
- Unit tests for all business card variants
- Interaction testing for hover and touch events
- Animation testing with @testing-library/jest-dom
- Accessibility testing for keyboard navigation

**Visual Testing:**
- Storybook stories for all component variations
- Chromatic visual regression testing
- Cross-device screenshot testing

---

## Story F1.3: Advanced Search Interface & Auto-complete System

**User Story:** As a frontend developer, I want to create a sophisticated search interface with real-time auto-complete, filters, and glassmorphism effects that enhances the existing search functionality while maintaining premium aesthetics.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 21  
**Sprint:** 2

### Detailed Acceptance Criteria

**Search Component Architecture:**
- **Given** the existing search functionality
- **When** implementing the React search system
- **Then** create:

```typescript
// components/search/SearchInterface.tsx
interface SearchInterfaceProps {
  placeholder?: string
  onSearch: (query: string, filters: SearchFilters) => void
  onFilterChange: (filters: SearchFilters) => void
  suggestions?: SearchSuggestion[]
  isLoading?: boolean
  className?: string
}

export const SearchInterface: React.FC<SearchInterfaceProps> = ({
  placeholder = "Search businesses, services, or locations...",
  onSearch,
  onFilterChange,
  suggestions = [],
  isLoading,
  className
}) => {
  const [query, setQuery] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeFilters, setActiveFilters] = useState<SearchFilters>({})
  
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Debounced search with React Query
  const debouncedQuery = useDebounce(query, 300)
  
  const { data: searchSuggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ['search-suggestions', debouncedQuery],
    queryFn: () => fetchSearchSuggestions(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })

  return (
    <div
      ref={searchRef}
      className={cn(
        'search-interface relative w-full max-w-2xl mx-auto',
        className
      )}
    >
      <GlassMorphism variant="medium" className="relative overflow-visible">
        {/* Main Search Input */}
        <div className="flex items-center gap-3 p-4">
          <Search 
            className="w-5 h-5 text-sage/70 flex-shrink-0" 
            aria-hidden="true" 
          />
          
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            placeholder={placeholder}
            className={cn(
              'flex-1 bg-transparent border-none outline-none',
              'text-cream placeholder-sage/50',
              'text-base font-body'
            )}
            autoComplete="off"
            aria-label="Search businesses"
            aria-expanded={showSuggestions}
            aria-haspopup="listbox"
          />
          
          {/* Loading Indicator */}
          {(isLoading || suggestionsLoading) && (
            <div className="flex-shrink-0">
              <LoadingSpinner size="sm" />
            </div>
          )}
          
          {/* Filter Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              'flex-shrink-0 p-2 rounded-lg transition-colors',
              'hover:bg-navy-50/20 focus:bg-navy-50/20',
              isExpanded && 'bg-teal-primary/20'
            )}
            aria-label="Toggle search filters"
          >
            <Filter className="w-4 h-4 text-sage/70" />
          </button>
        </div>
        
        {/* Advanced Filters */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="border-t border-sage/20 overflow-hidden"
            >
              <SearchFilters
                filters={activeFilters}
                onChange={setActiveFilters}
                onApply={() => onFilterChange(activeFilters)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </GlassMorphism>
      
      {/* Search Suggestions Dropdown */}
      <AnimatePresence>
        {showSuggestions && searchSuggestions && searchSuggestions.length > 0 && (
          <SearchSuggestions
            suggestions={searchSuggestions}
            query={query}
            onSelect={handleSuggestionSelect}
            onClose={() => setShowSuggestions(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
```

**Auto-complete System:**
- **Given** real-time search requirements
- **When** implementing suggestion system
- **Then** create:

```typescript
// components/search/SearchSuggestions.tsx
interface SearchSuggestionsProps {
  suggestions: SearchSuggestion[]
  query: string
  onSelect: (suggestion: SearchSuggestion) => void
  onClose: () => void
}

export const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  suggestions,
  query,
  onSelect,
  onClose
}) => {
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const suggestionRefs = useRef<(HTMLButtonElement | null)[]>([])
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev => 
            prev < suggestions.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : suggestions.length - 1
          )
          break
        case 'Enter':
          e.preventDefault()
          if (selectedIndex >= 0) {
            onSelect(suggestions[selectedIndex])
          }
          break
        case 'Escape':
          onClose()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedIndex, suggestions, onSelect, onClose])

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="absolute top-full left-0 right-0 z-50 mt-2"
    >
      <GlassMorphism variant="strong" className="max-h-80 overflow-y-auto">
        <div className="p-2">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              ref={el => suggestionRefs.current[index] = el}
              onClick={() => onSelect(suggestion)}
              className={cn(
                'w-full text-left p-3 rounded-lg transition-colors',
                'hover:bg-navy-50/20 focus:bg-navy-50/20',
                index === selectedIndex && 'bg-teal-primary/20'
              )}
            >
              <div className="flex items-center gap-3">
                <SuggestionIcon type={suggestion.type} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-cream">
                    <HighlightedText 
                      text={suggestion.title}
                      highlight={query}
                    />
                  </div>
                  {suggestion.subtitle && (
                    <div className="text-sm text-sage/70 truncate">
                      {suggestion.subtitle}
                    </div>
                  )}
                </div>
                {suggestion.type === 'recent' && (
                  <Clock className="w-4 h-4 text-sage/50" />
                )}
              </div>
            </button>
          ))}
        </div>
      </GlassMorphism>
    </motion.div>
  )
}
```

**Filter System Implementation:**
- **Given** advanced filtering requirements
- **When** creating filter components
- **Then** implement:
  - Category filters with multi-select
  - Location radius selector
  - Rating and review filters
  - Price range slider
  - Open now/hours filters
  - Premium business toggle

### Performance Requirements

**Search Optimization:**
- Debounced input with 300ms delay
- React Query caching for suggestions
- Virtual scrolling for large result sets
- Intersection observer for infinite scroll
- Search analytics tracking

**Mobile Responsiveness:**
- Touch-friendly filter controls
- Swipe gestures for filter categories
- Keyboard avoidance on iOS
- Proper focus management

### Testing Requirements

**Functional Testing:**
- Search query handling and debouncing
- Filter state management
- Keyboard navigation testing
- Mobile touch interaction testing

**Performance Testing:**
- Search suggestion response time < 200ms
- Filter application time < 100ms
- Memory usage optimization

---

## Story F1.4: Modal System & Business Detail Components

**User Story:** As a frontend developer, I want to create a sophisticated modal system for business details that preserves the existing premium aesthetics while adding enhanced interactivity, image galleries, and booking functionality.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 18  
**Sprint:** 2

### Detailed Acceptance Criteria

**Modal Architecture System:**
- **Given** the existing modal functionality
- **When** implementing React modal system
- **Then** create:

```typescript
// components/modals/ModalProvider.tsx
interface ModalContextType {
  openModal: (modal: ModalConfig) => void
  closeModal: () => void
  isOpen: boolean
  currentModal: ModalConfig | null
}

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modalStack, setModalStack] = useState<ModalConfig[]>([])
  const [isOpen, setIsOpen] = useState(false)
  
  const openModal = useCallback((modal: ModalConfig) => {
    setModalStack(prev => [...prev, modal])
    setIsOpen(true)
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden'
  }, [])
  
  const closeModal = useCallback(() => {
    setModalStack(prev => prev.slice(0, -1))
    
    if (modalStack.length <= 1) {
      setIsOpen(false)
      document.body.style.overflow = 'unset'
    }
  }, [modalStack.length])
  
  const currentModal = modalStack[modalStack.length - 1] || null
  
  return (
    <ModalContext.Provider value={{ openModal, closeModal, isOpen, currentModal }}>
      {children}
      <ModalRenderer />
    </ModalContext.Provider>
  )
}
```

**Business Detail Modal:**
- **Given** comprehensive business information display
- **When** creating the business detail modal
- **Then** implement:

```typescript
// components/business/BusinessDetailModal.tsx
interface BusinessDetailModalProps {
  business: Business
  onClose: () => void
  onBookingRequest: (business: Business) => void
}

export const BusinessDetailModal: React.FC<BusinessDetailModalProps> = ({
  business,
  onClose,
  onBookingRequest
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [showAllReviews, setShowAllReviews] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  
  // Trap focus within modal
  useFocusTrap(modalRef)
  
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-navy-dark/90 backdrop-blur-sm" />
        
        {/* Modal Content */}
        <motion.div
          ref={modalRef}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ 
            duration: 0.3, 
            ease: [0.25, 0.46, 0.45, 0.94] 
          }}
          className={cn(
            'relative w-full max-w-4xl max-h-[90vh]',
            'bg-navy-70/30 backdrop-blur-xl border border-sage/20',
            'rounded-xl overflow-hidden shadow-2xl'
          )}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-sage/20">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-2xl font-heading font-semibold text-cream">
                  {business.name}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <StarRating 
                    rating={business.averageRating} 
                    size="sm" 
                    readonly 
                  />
                  <span className="text-sage/70 text-sm">
                    ({business.reviewCount} reviews)
                  </span>
                </div>
              </div>
              {business.subscription === 'premium' && (
                <PremiumBadge variant="large" />
              )}
            </div>
            
            <button
              onClick={onClose}
              className={cn(
                'p-2 rounded-lg transition-colors',
                'hover:bg-navy-50/20 focus:bg-navy-50/20'
              )}
              aria-label="Close modal"
            >
              <X className="w-6 h-6 text-sage/70" />
            </button>
          </div>
          
          {/* Modal Body - Scrollable */}
          <div className="flex-1 overflow-y-auto max-h-[calc(90vh-140px)]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
              {/* Image Gallery */}
              <div className="space-y-4">
                <ImageGallery
                  images={business.images}
                  activeIndex={activeImageIndex}
                  onImageChange={setActiveImageIndex}
                />
                
                {/* Quick Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => onBookingRequest(business)}
                    className={cn(
                      'flex-1 px-4 py-3 rounded-lg',
                      'bg-gradient-to-r from-gold-primary to-gold-secondary',
                      'text-navy-dark font-medium transition-all',
                      'hover:shadow-lg hover:scale-[1.02]'
                    )}
                  >
                    Book Now
                  </button>
                  
                  <button className="p-3 rounded-lg border border-sage/20 hover:bg-navy-50/20">
                    <Phone className="w-5 h-5 text-sage" />
                  </button>
                  
                  <button className="p-3 rounded-lg border border-sage/20 hover:bg-navy-50/20">
                    <MapPin className="w-5 h-5 text-sage" />
                  </button>
                  
                  <button className="p-3 rounded-lg border border-sage/20 hover:bg-navy-50/20">
                    <Share2 className="w-5 h-5 text-sage" />
                  </button>
                </div>
              </div>
              
              {/* Business Information */}
              <div className="space-y-6">
                <BusinessDetailSection
                  title="About"
                  content={business.description}
                />
                
                <BusinessDetailSection title="Contact & Hours">
                  <BusinessContactInfo business={business} />
                  <BusinessHours hours={business.hours} />
                </BusinessDetailSection>
                
                <BusinessDetailSection title="Services">
                  <ServiceList services={business.services} />
                </BusinessDetailSection>
                
                <BusinessDetailSection title="Reviews">
                  <ReviewSummary
                    reviews={business.reviews}
                    showAll={showAllReviews}
                    onToggleShowAll={() => setShowAllReviews(!showAllReviews)}
                  />
                </BusinessDetailSection>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
```

**Image Gallery Component:**
- **Given** multiple business images
- **When** implementing gallery functionality
- **Then** create:

```typescript
// components/business/ImageGallery.tsx
interface ImageGalleryProps {
  images: BusinessImage[]
  activeIndex: number
  onImageChange: (index: number) => void
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  activeIndex,
  onImageChange
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [imageLoading, setImageLoading] = useState(true)
  
  return (
    <div className="relative">
      {/* Main Image */}
      <div className="relative aspect-video rounded-lg overflow-hidden bg-navy-50/20">
        <Image
          src={images[activeIndex]?.url}
          alt={images[activeIndex]?.alt}
          fill
          className="object-cover transition-opacity duration-300"
          onLoadingComplete={() => setImageLoading(false)}
          priority
        />
        
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        )}
        
        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => onImageChange(
                activeIndex === 0 ? images.length - 1 : activeIndex - 1
              )}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-navy-90/50 hover:bg-navy-90/70 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-cream" />
            </button>
            
            <button
              onClick={() => onImageChange(
                activeIndex === images.length - 1 ? 0 : activeIndex + 1
              )}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-navy-90/50 hover:bg-navy-90/70 transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-cream" />
            </button>
          </>
        )}
        
        {/* Fullscreen Button */}
        <button
          onClick={() => setIsFullscreen(true)}
          className="absolute top-2 right-2 p-2 rounded-lg bg-navy-90/50 hover:bg-navy-90/70 transition-colors"
        >
          <Maximize className="w-4 h-4 text-cream" />
        </button>
      </div>
      
      {/* Thumbnail Grid */}
      {images.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => onImageChange(index)}
              className={cn(
                'relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden',
                'border-2 transition-colors',
                index === activeIndex 
                  ? 'border-gold-primary' 
                  : 'border-transparent hover:border-sage/30'
              )}
            >
              <Image
                src={image.thumbnailUrl}
                alt={image.alt}
                fill
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
      
      {/* Fullscreen Modal */}
      {isFullscreen && (
        <FullscreenImageGallery
          images={images}
          initialIndex={activeIndex}
          onClose={() => setIsFullscreen(false)}
        />
      )}
    </div>
  )
}
```

### Accessibility Requirements

**Modal Accessibility:**
- Focus trapping within modal
- Escape key to close
- Screen reader announcements
- Proper ARIA attributes
- Keyboard navigation support

**Image Gallery Accessibility:**
- Alt text for all images
- Keyboard navigation for thumbnails
- Screen reader image descriptions
- High contrast mode support

### Performance Requirements

**Modal Performance:**
- Lazy load modal content
- Image optimization and WebP support
- Smooth 60fps animations
- Memory cleanup on close

### Testing Requirements

**Modal Testing:**
- Focus management testing
- Keyboard navigation testing
- Mobile gesture testing
- Cross-browser modal rendering

---

## Story F1.5: Mobile-First Responsive Design & PWA Features

**User Story:** As a frontend developer, I want to implement comprehensive mobile-first responsive design with PWA capabilities that enhances the existing mobile experience while maintaining all touch interactions and gestures.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 15  
**Sprint:** 3

### Detailed Acceptance Criteria

**Responsive Breakpoint System:**
- **Given** the existing 4-breakpoint system
- **When** implementing responsive design
- **Then** maintain breakpoints:
  - Mobile: 320px - 479px
  - Mobile Large: 480px - 767px
  - Tablet: 768px - 1199px
  - Desktop: 1200px+

```typescript
// tailwind.config.js breakpoints
module.exports = {
  theme: {
    screens: {
      'xs': '320px',
      'sm': '480px',
      'md': '768px',
      'lg': '1200px',
      'xl': '1400px',
    }
  }
}
```

**Mobile Navigation System:**
- **Given** mobile navigation requirements
- **When** implementing mobile menu
- **Then** create:

```typescript
// components/navigation/MobileNavigation.tsx
export const MobileNavigation: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchVisible, setSearchVisible] = useState(false)
  const { y } = useScroll()
  const [hidden, setHidden] = useState(false)
  
  // Auto-hide navigation on scroll down
  useMotionValueEvent(y, "change", (latest) => {
    const previous = y.getPrevious()
    if (latest > previous && latest > 150) {
      setHidden(true)
    } else {
      setHidden(false)
    }
  })

  return (
    <>
      <motion.nav
        variants={{
          visible: { y: 0 },
          hidden: { y: "-100%" },
        }}
        animate={hidden ? "hidden" : "visible"}
        transition={{ duration: 0.35, ease: "easeInOut" }}
        className={cn(
          'fixed top-0 left-0 right-0 z-40',
          'bg-navy-90/80 backdrop-blur-lg border-b border-sage/20'
        )}
      >
        <div className="flex items-center justify-between p-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Logo className="w-8 h-8" />
            <span className="font-heading font-semibold text-cream hidden xs:block">
              Lawless Directory
            </span>
          </Link>
          
          {/* Mobile Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchVisible(!searchVisible)}
              className="p-2 rounded-lg hover:bg-navy-50/20"
            >
              <Search className="w-5 h-5 text-sage" />
            </button>
            
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-lg hover:bg-navy-50/20"
            >
              <Menu className="w-5 h-5 text-sage" />
            </button>
          </div>
        </div>
        
        {/* Mobile Search */}
        <AnimatePresence>
          {searchVisible && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-sage/20 p-4"
            >
              <SearchInterface compact />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>
      
      {/* Mobile Menu Overlay */}
      <MobileMenuOverlay 
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  )
}
```

**Touch Gesture Integration:**
- **Given** existing touch gesture support
- **When** implementing gesture handlers
- **Then** maintain:
  - Pull-to-refresh functionality
  - Swipe navigation between sections
  - Long press context menus
  - Haptic feedback integration

```typescript
// hooks/useGestures.ts
export const useGestures = (ref: RefObject<HTMLElement>) => {
  const [{ x, y }, api] = useSpring(() => ({ x: 0, y: 0 }))
  
  const bind = useDrag(({ 
    down, 
    movement: [mx, my], 
    direction: [xDir], 
    distance,
    velocity 
  }) => {
    const isSwipe = distance > 50 && velocity > 0.2
    
    if (isSwipe) {
      // Trigger haptic feedback on iOS
      if ('vibrate' in navigator) {
        navigator.vibrate(10)
      }
      
      // Handle swipe direction
      if (xDir > 0) {
        onSwipeRight()
      } else {
        onSwipeLeft()
      }
    }
    
    api.start({
      x: down ? mx : 0,
      y: down ? my : 0,
      immediate: down
    })
  }, {
    axis: 'x',
    bounds: { left: -100, right: 100 }
  })
  
  return bind
}
```

**PWA Implementation:**
- **Given** PWA requirements
- **When** implementing Progressive Web App features
- **Then** create:

```typescript
// next.config.js PWA configuration
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'offlineCache',
        expiration: {
          maxEntries: 200,
        },
      },
    },
  ],
})

module.exports = withPWA({
  // Next.js config
})
```

```json
// public/manifest.json
{
  "name": "The Lawless Directory",
  "short_name": "Lawless Directory",
  "description": "Premium business directory platform",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#001219",
  "theme_color": "#005F73",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**Mobile-Optimized Components:**
- **Given** mobile user experience requirements
- **When** optimizing components for mobile
- **Then** implement:
  - Touch-friendly button sizing (minimum 44px)
  - Appropriate spacing for thumb navigation
  - Optimized image loading with lazy loading
  - Mobile-specific micro-interactions

### Performance Requirements

**Mobile Performance:**
- First Contentful Paint < 2s on 3G
- Largest Contentful Paint < 3s on 3G
- Cumulative Layout Shift < 0.1
- Time to Interactive < 4s on 3G
- Bundle size < 300KB gzipped

**PWA Performance:**
- Service worker registration < 100ms
- Offline page load < 1s
- Cache hit ratio > 80%
- App shell load < 500ms

### Testing Requirements

**Mobile Testing:**
- Cross-device responsive testing
- Touch interaction testing
- Gesture recognition testing
- PWA functionality testing
- Offline mode testing

**Performance Testing:**
- Mobile network throttling tests
- Battery usage optimization
- Memory usage monitoring

---

## Story F1.6: Performance Optimization & Core Web Vitals

**User Story:** As a frontend developer, I want to implement comprehensive performance optimizations that achieve Lighthouse scores > 90 while preserving all visual effects and maintaining the sophisticated user experience.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 13  
**Sprint:** 3

### Detailed Acceptance Criteria

**Core Web Vitals Targets:**
- **Given** performance requirements
- **When** optimizing the application
- **Then** achieve:
  - **Largest Contentful Paint (LCP):** < 2.5s
  - **First Input Delay (FID):** < 100ms
  - **Cumulative Layout Shift (CLS):** < 0.1
  - **First Contentful Paint (FCP):** < 1.5s
  - **Time to Interactive (TTI):** < 3.5s
  - **Total Blocking Time (TBT):** < 300ms

**Image Optimization System:**
- **Given** business images and media assets
- **When** implementing image optimization
- **Then** create:

```typescript
// components/ui/OptimizedImage.tsx
interface OptimizedImageProps {
  src: string
  alt: string
  width: number
  height: number
  priority?: boolean
  className?: string
  placeholder?: 'blur' | 'empty'
  onLoad?: () => void
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  priority = false,
  className,
  placeholder = 'blur',
  onLoad
}) => {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  
  // Generate responsive image URLs
  const generateSrcSet = (baseSrc: string) => {
    const breakpoints = [480, 768, 1200, 1600]
    return breakpoints
      .map(bp => `${baseSrc}?w=${bp}&q=80 ${bp}w`)
      .join(', ')
  }
  
  // Generate sizes based on breakpoints
  const sizes = "(max-width: 480px) 100vw, (max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        placeholder={placeholder}
        srcSet={generateSrcSet(src)}
        sizes={sizes}
        className={cn(
          'transition-opacity duration-300',
          isLoading && 'opacity-0'
        )}
        onLoadingComplete={() => {
          setIsLoading(false)
          onLoad?.()
        }}
        onError={() => {
          setHasError(true)
          setIsLoading(false)
        }}
        quality={85}
        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
      />
      
      {isLoading && (
        <div className="absolute inset-0 bg-navy-50/20 animate-pulse" />
      )}
      
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-navy-50/20">
          <ImageIcon className="w-8 h-8 text-sage/50" />
        </div>
      )}
    </div>
  )
}
```

**Code Splitting Strategy:**
- **Given** large bundle size concerns
- **When** implementing code splitting
- **Then** create:

```typescript
// Dynamic imports for route-based splitting
const BusinessDetailModal = dynamic(
  () => import('@/components/business/BusinessDetailModal'),
  { 
    ssr: false,
    loading: () => <ModalSkeleton />
  }
)

const AdminDashboard = dynamic(
  () => import('@/components/admin/AdminDashboard'),
  {
    ssr: false,
    loading: () => <DashboardSkeleton />
  }
)

// Component-level code splitting
const AdvancedFilters = dynamic(
  () => import('@/components/search/AdvancedFilters'),
  {
    loading: () => <FiltersSkeleton />
  }
)
```

**Bundle Optimization:**
- **Given** JavaScript bundle size requirements
- **When** optimizing bundles
- **Then** implement:
  - Tree shaking for unused code
  - Bundle analyzer integration
  - Vendor bundle splitting
  - Runtime chunk optimization

```javascript
// next.config.js optimization
module.exports = {
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns']
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            enforce: true
          }
        }
      }
    }
    return config
  }
}
```

**Animation Performance:**
- **Given** sophisticated animations and effects
- **When** optimizing animation performance
- **Then** ensure:
  - Use of transform and opacity for animations
  - RequestAnimationFrame for custom animations
  - will-change property for optimization hints
  - GPU acceleration for smooth effects

```typescript
// hooks/usePerformantAnimation.ts
export const usePerformantAnimation = (
  ref: RefObject<HTMLElement>,
  options: AnimationOptions
) => {
  useEffect(() => {
    const element = ref.current
    if (!element) return

    // Add will-change for optimization
    element.style.willChange = 'transform, opacity'
    
    // Use RAF for smooth animations
    let animationId: number
    
    const animate = () => {
      // Animation logic using transform/opacity only
      animationId = requestAnimationFrame(animate)
    }
    
    animate()
    
    return () => {
      cancelAnimationFrame(animationId)
      element.style.willChange = 'auto'
    }
  }, [ref, options])
}
```

**Lazy Loading Implementation:**
- **Given** content loading optimization needs
- **When** implementing lazy loading
- **Then** create:

```typescript
// hooks/useLazyLoad.ts
export const useLazyLoad = <T extends HTMLElement>(
  callback: () => void,
  options?: IntersectionObserverInit
) => {
  const ref = useRef<T>(null)
  const [isIntersecting, setIsIntersecting] = useState(false)
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isIntersecting) {
          setIsIntersecting(true)
          callback()
          observer.disconnect()
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px',
        ...options
      }
    )
    
    if (ref.current) {
      observer.observe(ref.current)
    }
    
    return () => observer.disconnect()
  }, [callback, isIntersecting, options])
  
  return ref
}
```

### Performance Monitoring Integration

**Real User Monitoring:**
- **Given** performance tracking requirements
- **When** implementing monitoring
- **Then** integrate:

```typescript
// utils/performance.ts
export const performanceMonitor = {
  // Web Vitals tracking
  trackWebVitals: () => {
    getCLS((metric) => {
      analytics.track('Web Vital', {
        name: 'CLS',
        value: metric.value,
        rating: metric.rating
      })
    })
    
    getFID((metric) => {
      analytics.track('Web Vital', {
        name: 'FID', 
        value: metric.value,
        rating: metric.rating
      })
    })
    
    getLCP((metric) => {
      analytics.track('Web Vital', {
        name: 'LCP',
        value: metric.value,
        rating: metric.rating
      })
    })
  },
  
  // Custom performance metrics
  trackCustomMetric: (name: string, value: number) => {
    analytics.track('Performance Metric', { name, value })
  }
}
```

### Testing Requirements

**Performance Testing:**
- Lighthouse CI integration
- Bundle size monitoring
- Core Web Vitals tracking
- Real device performance testing

**Performance Benchmarks:**
- Initial bundle size < 250KB gzipped
- Route-based chunks < 50KB each
- Image optimization ratio > 70%
- Animation frame rate > 60fps

---

## Story F1.7: Accessibility Implementation & WCAG 2.1 AA Compliance

**User Story:** As a frontend developer, I want to implement comprehensive accessibility features that achieve WCAG 2.1 AA compliance while maintaining all visual effects and premium aesthetics.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 13  
**Sprint:** 3

### Detailed Acceptance Criteria

**Accessibility Foundation:**
- **Given** WCAG 2.1 AA compliance requirements
- **When** implementing accessibility features
- **Then** ensure:
  - Color contrast ratio ≥ 4.5:1 for normal text
  - Color contrast ratio ≥ 3:1 for large text
  - All interactive elements keyboard accessible
  - Screen reader compatibility
  - Focus management and indication

**Keyboard Navigation System:**
- **Given** keyboard-only users
- **When** implementing navigation
- **Then** create:

```typescript
// hooks/useKeyboardNavigation.ts
export const useKeyboardNavigation = (
  items: RefObject<HTMLElement>[],
  options: KeyboardNavigationOptions = {}
) => {
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const { loop = true, orientation = 'vertical' } = options
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { key } = event
      
      switch (key) {
        case 'ArrowDown':
        case 'ArrowRight':
          if (orientation === 'vertical' && key === 'ArrowRight') break
          if (orientation === 'horizontal' && key === 'ArrowDown') break
          
          event.preventDefault()
          setFocusedIndex(prev => {
            const nextIndex = prev + 1
            if (nextIndex >= items.length) {
              return loop ? 0 : prev
            }
            return nextIndex
          })
          break
          
        case 'ArrowUp':
        case 'ArrowLeft':
          if (orientation === 'vertical' && key === 'ArrowLeft') break
          if (orientation === 'horizontal' && key === 'ArrowUp') break
          
          event.preventDefault()
          setFocusedIndex(prev => {
            const nextIndex = prev - 1
            if (nextIndex < 0) {
              return loop ? items.length - 1 : prev
            }
            return nextIndex
          })
          break
          
        case 'Home':
          event.preventDefault()
          setFocusedIndex(0)
          break
          
        case 'End':
          event.preventDefault()
          setFocusedIndex(items.length - 1)
          break
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [items.length, loop, orientation])
  
  // Focus the current item
  useEffect(() => {
    if (focusedIndex >= 0 && items[focusedIndex]?.current) {
      items[focusedIndex].current!.focus()
    }
  }, [focusedIndex, items])
  
  return { focusedIndex, setFocusedIndex }
}
```

**Screen Reader Optimization:**
- **Given** screen reader users
- **When** implementing semantic markup
- **Then** create:

```typescript
// components/accessibility/ScreenReaderOnly.tsx
export const ScreenReaderOnly: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => (
  <span className="sr-only">
    {children}
  </span>
)

// components/accessibility/LiveRegion.tsx
interface LiveRegionProps {
  children: React.ReactNode
  politeness?: 'polite' | 'assertive'
  atomic?: boolean
}

export const LiveRegion: React.FC<LiveRegionProps> = ({ 
  children, 
  politeness = 'polite',
  atomic = false 
}) => (
  <div
    aria-live={politeness}
    aria-atomic={atomic}
    className="sr-only"
  >
    {children}
  </div>
)

// Enhanced BusinessCard with accessibility
export const AccessibleBusinessCard: React.FC<BusinessCardProps> = ({ 
  business, 
  ...props 
}) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const [announced, setAnnounced] = useState('')
  
  return (
    <div
      ref={cardRef}
      role="article"
      aria-labelledby={`business-name-${business.id}`}
      aria-describedby={`business-description-${business.id}`}
      tabIndex={0}
      onFocus={() => {
        setAnnounced(`${business.name}, ${business.category}, rated ${business.averageRating} stars`)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          props.onCardClick(business)
        }
      }}
    >
      <h3 id={`business-name-${business.id}`} className="sr-only">
        {business.name}
      </h3>
      
      <div id={`business-description-${business.id}`} className="sr-only">
        {business.category} business with {business.reviewCount} reviews, 
        average rating {business.averageRating} out of 5 stars.
        {business.subscription === 'premium' && ' Premium verified business.'}
      </div>
      
      <BusinessCard business={business} {...props} />
      
      {announced && (
        <LiveRegion>
          {announced}
        </LiveRegion>
      )}
    </div>
  )
}
```

**Focus Management System:**
- **Given** complex interactive components
- **When** implementing focus management
- **Then** create:

```typescript
// hooks/useFocusTrap.ts
export const useFocusTrap = (
  ref: RefObject<HTMLElement>,
  active: boolean = true
) => {
  useEffect(() => {
    if (!active || !ref.current) return
    
    const container = ref.current
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>
    
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]
    
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      }
    }
    
    // Focus first element when trap activates
    firstElement?.focus()
    
    container.addEventListener('keydown', handleTabKey)
    return () => container.removeEventListener('keydown', handleTabKey)
  }, [ref, active])
}
```

**Color Contrast Validation:**
- **Given** color contrast requirements
- **When** implementing color system
- **Then** validate:

```typescript
// utils/colorContrast.ts
export const colorContrastValidator = {
  // WCAG contrast ratio calculation
  getContrastRatio: (foreground: string, background: string): number => {
    const getLuminance = (color: string): number => {
      // Convert hex to RGB
      const rgb = hexToRgb(color)
      if (!rgb) return 0
      
      // Calculate relative luminance
      const { r, g, b } = rgb
      const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      })
      
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
    }
    
    const l1 = getLuminance(foreground)
    const l2 = getLuminance(background)
    const brightest = Math.max(l1, l2)
    const darkest = Math.min(l1, l2)
    
    return (brightest + 0.05) / (darkest + 0.05)
  },
  
  // Validate WCAG AA compliance
  isCompliant: (
    foreground: string, 
    background: string, 
    level: 'AA' | 'AAA' = 'AA',
    size: 'normal' | 'large' = 'normal'
  ): boolean => {
    const ratio = colorContrastValidator.getContrastRatio(foreground, background)
    
    if (level === 'AA') {
      return size === 'large' ? ratio >= 3 : ratio >= 4.5
    } else {
      return size === 'large' ? ratio >= 4.5 : ratio >= 7
    }
  }
}
```

**High Contrast Mode Support:**
- **Given** high contrast mode requirements
- **When** implementing contrast enhancements
- **Then** create:

```css
/* High contrast mode styles */
@media (prefers-contrast: high) {
  :root {
    --color-text-primary: #FFFFFF;
    --color-text-secondary: #FFFFFF;
    --color-border: #FFFFFF;
    --gradient-premium: none;
    --color-gold-primary: #FFFF00;
  }
  
  .business-card {
    border: 2px solid;
    background: #000000 !important;
  }
  
  .glass-morphism {
    backdrop-filter: none !important;
    background: rgba(0, 0, 0, 0.9) !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Testing Requirements

**Accessibility Testing:**
- Automated accessibility testing with @axe-core/react
- Manual keyboard navigation testing
- Screen reader testing with NVDA/JAWS/VoiceOver
- Color contrast validation
- Focus indicator testing

**Testing Implementation:**
```typescript
// tests/accessibility/a11y.test.tsx
import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

describe('Accessibility Tests', () => {
  test('BusinessCard has no accessibility violations', async () => {
    const { container } = render(
      <BusinessCard 
        business={mockBusiness}
        onCardClick={jest.fn()}
        onBookmarkToggle={jest.fn()}
      />
    )
    
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
  
  test('Modal keyboard navigation works correctly', () => {
    const { getByRole } = render(
      <BusinessDetailModal 
        business={mockBusiness}
        onClose={jest.fn()}
      />
    )
    
    const modal = getByRole('dialog')
    const closeButton = getByRole('button', { name: /close/i })
    
    // Test focus trapping
    fireEvent.keyDown(modal, { key: 'Tab' })
    expect(closeButton).toHaveFocus()
  })
})
```

---

## Story F1.8: State Management Architecture with Zustand & React Query

**User Story:** As a frontend developer, I want to implement a robust state management system using Zustand for client state and React Query for server state that provides optimal performance and developer experience.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 16  
**Sprint:** 4

### Detailed Acceptance Criteria

**Zustand Store Architecture:**
- **Given** client state management requirements
- **When** implementing Zustand stores
- **Then** create:

```typescript
// stores/useBusinessStore.ts
interface BusinessState {
  businesses: Business[]
  selectedBusiness: Business | null
  bookmarkedBusinesses: string[]
  searchQuery: string
  activeFilters: SearchFilters
  viewMode: 'grid' | 'list' | 'map'
  isLoading: boolean
  error: string | null
}

interface BusinessActions {
  setBusinesses: (businesses: Business[]) => void
  selectBusiness: (business: Business | null) => void
  toggleBookmark: (businessId: string) => void
  setSearchQuery: (query: string) => void
  setActiveFilters: (filters: SearchFilters) => void
  setViewMode: (mode: 'grid' | 'list' | 'map') => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  resetFilters: () => void
}

type BusinessStore = BusinessState & BusinessActions

export const useBusinessStore = create<BusinessStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        businesses: [],
        selectedBusiness: null,
        bookmarkedBusinesses: [],
        searchQuery: '',
        activeFilters: {
          category: [],
          rating: 0,
          priceRange: [0, 5],
          distance: 25,
          openNow: false,
          premiumOnly: false
        },
        viewMode: 'grid',
        isLoading: false,
        error: null,
        
        // Actions
        setBusinesses: (businesses) => 
          set({ businesses }, false, 'setBusinesses'),
          
        selectBusiness: (business) => 
          set({ selectedBusiness: business }, false, 'selectBusiness'),
          
        toggleBookmark: (businessId) => 
          set((state) => {
            const isBookmarked = state.bookmarkedBusinesses.includes(businessId)
            return {
              bookmarkedBusinesses: isBookmarked
                ? state.bookmarkedBusinesses.filter(id => id !== businessId)
                : [...state.bookmarkedBusinesses, businessId]
            }
          }, false, 'toggleBookmark'),
          
        setSearchQuery: (query) => 
          set({ searchQuery: query }, false, 'setSearchQuery'),
          
        setActiveFilters: (filters) => 
          set({ activeFilters: filters }, false, 'setActiveFilters'),
          
        setViewMode: (mode) => 
          set({ viewMode: mode }, false, 'setViewMode'),
          
        setLoading: (loading) => 
          set({ isLoading: loading }, false, 'setLoading'),
          
        setError: (error) => 
          set({ error }, false, 'setError'),
          
        resetFilters: () => 
          set({
            activeFilters: {
              category: [],
              rating: 0,
              priceRange: [0, 5],
              distance: 25,
              openNow: false,
              premiumOnly: false
            },
            searchQuery: ''
          }, false, 'resetFilters')
      }),
      {
        name: 'business-store',
        partialize: (state) => ({
          bookmarkedBusinesses: state.bookmarkedBusinesses,
          viewMode: state.viewMode,
          activeFilters: state.activeFilters
        })
      }
    ),
    { name: 'BusinessStore' }
  )
)

// Selectors for optimized re-renders
export const useBusinessSelectors = {
  businesses: () => useBusinessStore(state => state.businesses),
  selectedBusiness: () => useBusinessStore(state => state.selectedBusiness),
  bookmarkedBusinesses: () => useBusinessStore(state => state.bookmarkedBusinesses),
  searchState: () => useBusinessStore(state => ({
    searchQuery: state.searchQuery,
    activeFilters: state.activeFilters
  })),
  uiState: () => useBusinessStore(state => ({
    viewMode: state.viewMode,
    isLoading: state.isLoading,
    error: state.error
  }))
}
```

**React Query Integration:**
- **Given** server state management requirements
- **When** implementing React Query
- **Then** create:

```typescript
// hooks/useBusinessQueries.ts
export const useBusinessQueries = {
  // Get all businesses with search and filters
  useBusinesses: (params: BusinessSearchParams) => {
    return useQuery({
      queryKey: ['businesses', params],
      queryFn: () => businessApi.searchBusinesses(params),
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      enabled: !!params,
      placeholderData: keepPreviousData,
      select: (data) => ({
        ...data,
        businesses: data.businesses.map(business => ({
          ...business,
          // Add computed properties
          distanceInMiles: calculateDistance(params.location, business.location),
          isBookmarked: useBusinessStore.getState().bookmarkedBusinesses.includes(business.id)
        }))
      })
    })
  },
  
  // Get single business details
  useBusinessDetails: (businessId: string) => {
    return useQuery({
      queryKey: ['business', businessId],
      queryFn: () => businessApi.getBusinessDetails(businessId),
      staleTime: 10 * 60 * 1000, // 10 minutes
      enabled: !!businessId,
      retry: (failureCount, error) => {
        // Don't retry on 404s
        if (error.status === 404) return false
        return failureCount < 3
      }
    })
  },
  
  // Get business reviews
  useBusinessReviews: (businessId: string, page: number = 1) => {
    return useInfiniteQuery({
      queryKey: ['business-reviews', businessId],
      queryFn: ({ pageParam = 1 }) => 
        businessApi.getBusinessReviews(businessId, pageParam),
      initialPageParam: 1,
      getNextPageParam: (lastPage) => 
        lastPage.hasMore ? lastPage.page + 1 : undefined,
      staleTime: 15 * 60 * 1000, // 15 minutes
      enabled: !!businessId
    })
  },
  
  // Search suggestions
  useSearchSuggestions: (query: string) => {
    return useQuery({
      queryKey: ['search-suggestions', query],
      queryFn: () => searchApi.getSuggestions(query),
      staleTime: 5 * 60 * 1000,
      enabled: query.length >= 2,
      refetchOnWindowFocus: false
    })
  }
}

// Mutations for business operations
export const useBusinessMutations = {
  // Bookmark business
  useToggleBookmark: () => {
    const queryClient = useQueryClient()
    
    return useMutation({
      mutationFn: ({ businessId, action }: { businessId: string, action: 'add' | 'remove' }) =>
        businessApi.toggleBookmark(businessId, action),
      onMutate: async ({ businessId, action }) => {
        // Optimistic update
        await queryClient.cancelQueries({ queryKey: ['businesses'] })
        
        const previousData = queryClient.getQueryData(['businesses'])
        
        // Update local store immediately
        useBusinessStore.getState().toggleBookmark(businessId)
        
        return { previousData }
      },
      onError: (err, { businessId }, context) => {
        // Revert optimistic update
        if (context?.previousData) {
          queryClient.setQueryData(['businesses'], context.previousData)
        }
        useBusinessStore.getState().toggleBookmark(businessId) // Revert
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['businesses'] })
      }
    })
  },
  
  // Report business
  useReportBusiness: () => {
    return useMutation({
      mutationFn: (data: BusinessReportData) => 
        businessApi.reportBusiness(data),
      onSuccess: () => {
        toast.success('Report submitted successfully')
      },
      onError: (error) => {
        toast.error(`Failed to submit report: ${error.message}`)
      }
    })
  }
}
```

**Advanced Query Patterns:**
- **Given** complex data fetching requirements
- **When** implementing advanced patterns
- **Then** create:

```typescript
// hooks/useOptimisticBusinessList.ts
export const useOptimisticBusinessList = () => {
  const { searchQuery, activeFilters } = useBusinessSelectors.searchState()
  const { setBusinesses, setLoading, setError } = useBusinessStore()
  
  const searchParams = useMemo(() => ({
    query: searchQuery,
    filters: activeFilters,
    location: getCurrentLocation() // Assume this exists
  }), [searchQuery, activeFilters])
  
  const { 
    data, 
    isLoading, 
    error, 
    refetch 
  } = useBusinessQueries.useBusinesses(searchParams)
  
  // Sync React Query state with Zustand
  useEffect(() => {
    if (data?.businesses) {
      setBusinesses(data.businesses)
    }
    setLoading(isLoading)
    setError(error?.message || null)
  }, [data, isLoading, error, setBusinesses, setLoading, setError])
  
  // Prefetch next pages based on scroll position
  const queryClient = useQueryClient()
  const prefetchNextPage = useCallback(() => {
    if (data?.hasNextPage) {
      queryClient.prefetchQuery({
        queryKey: ['businesses', { ...searchParams, page: data.currentPage + 1 }],
        queryFn: () => businessApi.searchBusinesses({ ...searchParams, page: data.currentPage + 1 }),
        staleTime: 5 * 60 * 1000
      })
    }
  }, [data, searchParams, queryClient])
  
  return {
    businesses: data?.businesses || [],
    hasNextPage: data?.hasNextPage || false,
    refetch,
    prefetchNextPage
  }
}
```

**Performance Optimizations:**
- **Given** performance requirements
- **When** implementing state management optimizations
- **Then** ensure:

```typescript
// utils/queryOptimizations.ts
export const queryOptimizations = {
  // Selective hydration for SSR
  dehydrateQueries: (queryClient: QueryClient) => {
    return dehydrate(queryClient, {
      shouldDehydrateQuery: (query) => {
        // Only dehydrate essential queries
        return query.queryKey[0] === 'businesses' ||
               query.queryKey[0] === 'categories'
      }
    })
  },
  
  // Background refetch strategies
  setupBackgroundRefetch: (queryClient: QueryClient) => {
    // Refetch businesses when user comes back from background
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        queryClient.refetchQueries({
          queryKey: ['businesses'],
          type: 'active'
        })
      }
    })
    
    // Periodic background refresh for critical data
    setInterval(() => {
      if (document.visibilityState === 'visible') {
        queryClient.invalidateQueries({
          queryKey: ['business-stats'],
          refetchType: 'none' // Only invalidate, don't refetch immediately
        })
      }
    }, 10 * 60 * 1000) // 10 minutes
  },
  
  // Memory optimization
  setupMemoryManagement: (queryClient: QueryClient) => {
    queryClient.setDefaultOptions({
      queries: {
        gcTime: 5 * 60 * 1000, // Garbage collect after 5 minutes
        staleTime: 2 * 60 * 1000, // Data is fresh for 2 minutes
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Don't retry client errors
          if (error.status >= 400 && error.status < 500) {
            return false
          }
          return failureCount < 3
        }
      },
      mutations: {
        retry: 1
      }
    })
  }
}
```

### Testing Requirements

**State Management Testing:**
- Unit tests for Zustand stores
- React Query integration testing
- Optimistic update testing
- Error handling validation

```typescript
// tests/stores/businessStore.test.ts
describe('Business Store', () => {
  beforeEach(() => {
    useBusinessStore.getState().resetFilters()
  })
  
  test('should toggle bookmark correctly', () => {
    const { toggleBookmark } = useBusinessStore.getState()
    
    toggleBookmark('business-1')
    expect(useBusinessStore.getState().bookmarkedBusinesses).toContain('business-1')
    
    toggleBookmark('business-1')
    expect(useBusinessStore.getState().bookmarkedBusinesses).not.toContain('business-1')
  })
  
  test('should persist bookmarked businesses', () => {
    const { toggleBookmark } = useBusinessStore.getState()
    
    toggleBookmark('business-1')
    
    // Simulate page reload
    const newStore = create(/* same config */)
    expect(newStore.getState().bookmarkedBusinesses).toContain('business-1')
  })
})
```

---

## Epic 1 Summary & Success Metrics

### Completion Criteria

**Technical Deliverables:**
- ✅ Complete Next.js 14 migration with App Router
- ✅ 85+ CSS custom properties preserved in Tailwind theme
- ✅ React component architecture for all UI elements  
- ✅ Advanced search with auto-complete and filtering
- ✅ Sophisticated modal system with business details
- ✅ Mobile-first responsive design with PWA features
- ✅ Performance optimization achieving Lighthouse > 90
- ✅ WCAG 2.1 AA accessibility compliance
- ✅ Zustand + React Query state management

**Performance Targets:**
- First Contentful Paint < 1.5s
- Largest Contentful Paint < 2.5s  
- Cumulative Layout Shift < 0.1
- Mobile PageSpeed Score > 90
- Bundle size < 300KB gzipped

**Accessibility Targets:**
- All color contrasts meet WCAG AA standards
- Complete keyboard navigation support
- Screen reader compatibility tested
- Focus management implemented
- High contrast mode support

**Testing Coverage:**
- Unit test coverage > 80%
- Visual regression tests for all components
- Cross-browser compatibility validation
- Mobile device testing across breakpoints
- Performance monitoring implementation

This comprehensive frontend Epic 1 establishes the foundation for all subsequent frontend development while preserving and enhancing the sophisticated existing prototype. The component architecture, state management, and performance optimizations will serve as the base for building the complete business directory platform.