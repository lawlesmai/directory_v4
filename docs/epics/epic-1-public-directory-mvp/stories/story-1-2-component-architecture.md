# Story 1.2: Component Architecture & HTML Structure Migration

**User Story:** As a frontend developer, I want to recreate the existing HTML structure as modular React components so that the sophisticated layout and accessibility features are preserved while enabling component reusability.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 21  
**Sprint:** 1

## Epic Context
**Epic:** 1 - Public Directory MVP  
**Epic Mission:** Transform The Lawless Directory's sophisticated vanilla JavaScript prototype into a production-ready Next.js + Supabase application while preserving and enhancing all existing UI sophistication, performance optimizations, and user experience features.

## Detailed Acceptance Criteria

### Component Architecture
- **Given** the existing 234-line HTML structure
- **When** converting to React components
- **Then** create the following component hierarchy:
  - `Layout` (root layout with navigation and footer)
  - `Header` (navigation with glassmorphism effect)
  - `HeroSection` (animated hero with search integration)
  - `BusinessCard` (individual business listing component)
  - `BusinessGrid` (business cards container with animations)
  - `SearchBar` (advanced search with suggestions)
  - `FilterPanel` (category and rating filters)
  - `Modal` (business detail modal system)
  - `PremiumBadge` (premium business indicator)
  - `LoadingSpinner` (custom loading animations)

### Business Card Component System
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

### Accessibility Preservation
- **Given** the existing accessibility features
- **When** migrating to React components
- **Then** maintain all ARIA attributes:
  - Screen reader compatibility
  - Keyboard navigation support
  - Focus management in modals
  - Alt text for all images
  - Semantic HTML structure (header, main, nav, article, aside)

### Responsive Design
- **Given** the existing 4-breakpoint responsive system
- **When** implementing React components
- **Then** ensure responsive behavior:
  - Mobile-first approach maintained
  - Touch-friendly interfaces on mobile
  - Desktop hover effects preserved
  - Flexible grid layouts using CSS Grid and Flexbox

## Technical Implementation Notes

### Component Standards
- Use TypeScript interfaces for all props
- Implement proper error boundaries
- Follow compound component patterns where appropriate
- Use forwardRef for components requiring DOM access

### Component Composition System
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

### State Management Approach
- Use React state for component-level state
- Implement useContext for shared UI state
- Prepare for future Zustand integration

### Performance Optimizations
- Implement React.memo for expensive components
- Use useCallback and useMemo appropriately
- Lazy load components where beneficial

### Mobile Touch Interaction Requirements

### Touch Gesture Support
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

## Current State Context
**Existing Prototype Assets:**
- 234-line semantic HTML structure with accessibility features
- 880-line CSS system with glassmorphism design and 80+ custom properties
- 861-line JavaScript with 3 main classes: LawlessDirectory, ParallaxManager, PerformanceMonitor
- Advanced features: search suggestions, mobile gestures, premium highlighting, modal system

**Performance Benchmarks to Maintain:**
- First Contentful Paint < 1.5s
- Lighthouse Performance Score > 90
- Mobile responsiveness across 4 breakpoints
- Touch gesture support with haptic feedback

## Dependencies
- Story 1.1 (Foundation setup must be complete)

## Testing Requirements

### Unit Tests
- Component rendering tests
- Props validation tests
- Event handler tests
- Accessibility tests with jest-axe

### Integration Tests
- Component interaction tests
- State management tests
- Navigation flow tests

### Visual Regression Tests
- Screenshot comparisons for each component
- Cross-browser rendering validation
- Mobile/desktop layout verification

## Definition of Done
- [ ] All HTML structure converted to React components
- [ ] Component hierarchy follows atomic design principles
- [ ] TypeScript interfaces defined for all component props
- [ ] Accessibility features fully preserved and tested
- [ ] Responsive behavior working across all breakpoints
- [ ] Component library documented with Storybook
- [ ] All components pass accessibility audits
- [ ] Visual regression tests passing
- [ ] Unit tests achieve >85% coverage

## Risk Assessment
- **Medium Risk:** Complex component relationships may introduce bugs
- **Mitigation:** Incremental migration with isolated component testing

## Backend/Frontend/Testing Integration

### Backend Requirements
- Component data interfaces aligned with database schema
- API response types matching component prop interfaces
- State management preparation for database integration

### Frontend Implementation
- Component library foundation with reusable patterns
- Design system token implementation in components
- TypeScript configuration with strict component typing
- Responsive design system implementation across components

### Testing Strategy (TDD Approach)
- Test-driven development for component library
- Visual regression testing for component migrations
- Accessibility testing with automated tools
- Cross-browser component compatibility testing

## Success Metrics
- **Technical:** All components render without errors and pass TypeScript compilation
- **Performance:** Component rendering maintains existing performance benchmarks
- **Quality:** 85%+ test coverage for all components
- **User Experience:** All existing interactions preserved with enhanced responsiveness