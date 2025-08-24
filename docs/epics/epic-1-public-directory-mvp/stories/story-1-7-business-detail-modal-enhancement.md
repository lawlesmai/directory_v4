# Story 1.7: Business Detail Pages & Modal Enhancement

**Epic:** 1 - Public Directory MVP  
**Story ID:** 1.7  
**Priority:** P0 (Critical Path)  
**Story Points:** 21  
**Sprint:** 3

**Assignee:** Frontend Developer Agent  
**Dependencies:** Story 1.5 (Supabase Integration), Story 1.2 (Component Architecture)

---

## User Story

**As a user**, I want to view comprehensive business information in an engaging modal or dedicated page **so that** I can make informed decisions about businesses with detailed information, image galleries, reviews, and interactive features.

---

## Epic Context

This story enhances the existing modal functionality from the vanilla JavaScript prototype with React-based components that provide comprehensive business details, SEO-optimized dedicated pages, and enhanced user interactions while maintaining the premium glassmorphism aesthetic.

---

## Detailed Acceptance Criteria

### Enhanced Modal System

**Business Detail Modal Core:**
- **Given** the existing modal functionality from the prototype
- **When** enhancing for React and database-driven content
- **Then** implement:

  **Modal Core Features:**
  - Smooth modal open/close animations with backdrop blur effects
  - Focus trapping and comprehensive keyboard navigation
  - Scrollable content for long business descriptions with scroll indicators  
  - Mobile-responsive modal sizing with touch interactions
  - Deep linking support with URL updates when modal opens
  - Browser back/forward button support for modal state management
  - Modal stack management for nested modals (reviews, image gallery)
  - Escape key and backdrop click to close with confirmation if needed

  **Business Information Display:**
  - Hero image with responsive image gallery carousel
  - Business name, category, and premium subscription badges
  - Complete formatted business description with rich text support
  - Contact information with click-to-action functionality (call, email, website)
  - Full address with integrated map view and directions
  - Business hours with real-time status (open/closed/closing soon)
  - Social media links with platform-specific icons
  - Business tags, categories, and service listings
  - Trust signals and verification badges
  - Business statistics (views, saves, shares)

### SEO-Optimized Business Pages

**Dedicated Business Pages:**
- **Given** the need for SEO-optimized business pages
- **When** creating dedicated business routes
- **Then** implement:

  **Server-Side Rendering:**
  - Dynamic routing with business slug URLs (/business/[category]/[business-name])
  - Server-side rendering for optimal SEO performance
  - Incremental Static Regeneration (ISR) for performance
  - Meta tags generated dynamically from business data
  - Open Graph tags for social media sharing optimization
  - JSON-LD structured data for local business schema
  - Canonical URLs to prevent duplicate content issues

  **Page Structure & Navigation:**
  - Breadcrumb navigation with schema markup
  - Related/similar businesses section with ML recommendations
  - Business owner contact and claim options
  - Share functionality with native share API support
  - Print-friendly business information layout
  - QR code generation for easy mobile sharing

### Advanced Image Gallery System

**Image Gallery Implementation:**
- **Given** businesses with multiple images
- **When** displaying business media
- **Then** create:

  **Gallery Features:**
  - Responsive image gallery with lazy loading optimization
  - Lightbox functionality with full-screen viewing
  - Touch/swipe navigation optimized for mobile devices
  - Image zoom and pan capabilities with gesture support
  - Thumbnail navigation with active state indicators
  - Image metadata display (captions, upload dates)
  - Progressive image loading with WebP/AVIF support
  - Placeholder images for businesses without photos
  - Image optimization using Next.js Image component

  **Gallery Component Architecture:**
  ```typescript
  export const ImageGallery: React.FC<ImageGalleryProps> = ({
    images,
    activeIndex,
    onImageChange
  }) => {
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [imageLoading, setImageLoading] = useState(true)
    
    return (
      <div className="image-gallery relative">
        {/* Main display image with optimized loading */}
        <OptimizedImage
          src={images[activeIndex]?.url}
          alt={images[activeIndex]?.alt}
          className="aspect-video rounded-lg"
          priority
          onLoadingComplete={() => setImageLoading(false)}
        />
        
        {/* Navigation and controls */}
        {/* Thumbnail strip */}
        {/* Fullscreen modal */}
      </div>
    )
  }
  ```

### Review Integration & Display

**Review System Integration:**
- **Given** business review data from the database
- **When** displaying reviews on business pages
- **Then** show:

  **Review Display Features:**
  - Overall rating calculation with weighted averages
  - Star rating display with half-star precision
  - Recent reviews with pagination or infinite scroll
  - Review filtering and sorting (newest, oldest, highest, lowest rated)
  - Review helpfulness voting with optimistic updates
  - Business owner response display with verification
  - Review verification badges for confirmed customers
  - Review analytics (average rating trends, response rates)

  **Review Interaction:**
  - "Write a review" call-to-action for authenticated users
  - Review flagging system for inappropriate content
  - Review sharing functionality
  - Review photo display in lightbox
  - Review response time indicators for business owners

### Mobile-Specific Enhancements

**Mobile Modal Optimization:**
- **Given** mobile user experience requirements
- **When** optimizing for mobile devices
- **Then** implement:

  **Mobile-First Design:**
  - Bottom sheet modal design for mobile devices
  - Swipe-to-dismiss functionality with haptic feedback
  - Touch-optimized button sizing (minimum 44px)
  - Optimized scrolling with momentum and bounce effects
  - Mobile-specific navigation patterns
  - Safe area support for notched devices (iPhone X+)
  - Orientation change handling with layout adjustment

---

## Technical Implementation

### Modal Architecture
```typescript
// Modal context provider with stack management
interface ModalContextType {
  openModal: (modal: ModalConfig) => void
  closeModal: () => void
  modalStack: ModalConfig[]
  isOpen: boolean
}

export const ModalProvider: React.FC = ({ children }) => {
  const [modalStack, setModalStack] = useState<ModalConfig[]>([])
  
  const openModal = useCallback((modal: ModalConfig) => {
    setModalStack(prev => [...prev, modal])
    // Prevent body scroll
    document.body.style.overflow = 'hidden'
  }, [])
  
  const closeModal = useCallback(() => {
    setModalStack(prev => prev.slice(0, -1))
    if (modalStack.length <= 1) {
      document.body.style.overflow = 'unset'
    }
  }, [modalStack.length])
  
  return (
    <ModalContext.Provider value={{ openModal, closeModal, modalStack, isOpen: modalStack.length > 0 }}>
      {children}
      <ModalRenderer />
    </ModalContext.Provider>
  )
}
```

### Business Detail Component
```typescript
export const BusinessDetailModal: React.FC<BusinessDetailModalProps> = ({
  business,
  onClose,
  onBookingRequest
}) => {
  const modalRef = useRef<HTMLDivElement>(null)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  
  // Focus management
  useFocusTrap(modalRef)
  
  // URL state management
  useEffect(() => {
    const url = new URL(window.location)
    url.searchParams.set('business', business.slug)
    window.history.pushState({}, '', url)
    
    return () => {
      url.searchParams.delete('business')
      window.history.pushState({}, '', url)
    }
  }, [business.slug])

  return (
    <AnimatePresence>
      <motion.div className="modal-overlay" onClick={handleBackdropClick}>
        <GlassMorphism variant="strong" className="modal-content">
          {/* Business header with name, rating, actions */}
          <BusinessDetailHeader business={business} onClose={onClose} />
          
          {/* Scrollable content area */}
          <div className="modal-body">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Image gallery section */}
              <ImageGallery
                images={business.images}
                activeIndex={activeImageIndex}
                onImageChange={setActiveImageIndex}
              />
              
              {/* Business information section */}
              <BusinessInformation business={business} />
            </div>
            
            {/* Reviews section */}
            <BusinessReviews businessId={business.id} />
          </div>
        </GlassMorphism>
      </motion.div>
    </AnimatePresence>
  )
}
```

### SEO Implementation
```typescript
// Dynamic meta tags for business pages
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const business = await getBusinessBySlug(params.slug)
  
  return {
    title: `${business.name} - ${business.category} | Lawless Directory`,
    description: business.description.slice(0, 160),
    openGraph: {
      title: business.name,
      description: business.description,
      images: [business.primaryImage],
      type: 'business.business'
    },
    twitter: {
      card: 'summary_large_image',
      title: business.name,
      description: business.description,
      images: [business.primaryImage]
    },
    alternates: {
      canonical: `/business/${business.category.slug}/${business.slug}`
    }
  }
}
```

---

## Testing Requirements

### Unit Tests
- Modal state management and stack operations
- Business data display with various data scenarios
- Image gallery navigation and state management
- URL routing and browser navigation integration
- Focus management and keyboard navigation

### Integration Tests  
- Modal interactions with business data fetching
- SEO meta tag generation with real business data
- Image loading optimization and error handling
- Review display and pagination functionality
- Mobile responsive behavior across devices

### Accessibility Tests
- Screen reader compatibility with ARIA labels
- Keyboard navigation through modal content
- Focus trapping and management validation
- Color contrast compliance for all text
- Touch target size validation on mobile

### End-to-End Tests
- Complete business viewing user journeys
- Modal interactions on various devices and browsers
- SEO validation with search engine crawlers
- Performance validation for image loading
- Cross-browser modal functionality

### Performance Tests
- Modal rendering performance with large datasets
- Image gallery loading optimization
- Memory usage during modal operations
- Animation smoothness at 60fps
- Network request optimization

---

## Definition of Done

### Modal System
- [ ] Enhanced modal system with smooth animations and focus management
- [ ] Business detail modal with comprehensive information display
- [ ] Modal stack management for nested modals (gallery, reviews)
- [ ] Mobile-optimized modal with bottom sheet design
- [ ] URL state management and browser navigation support

### Business Pages  
- [ ] Dedicated SEO-optimized business pages with SSR
- [ ] Dynamic meta tag generation from business data
- [ ] JSON-LD structured data for local business schema
- [ ] Breadcrumb navigation with proper schema markup
- [ ] Social sharing optimization with Open Graph tags

### Image Gallery
- [ ] Responsive image gallery with lazy loading
- [ ] Lightbox functionality with zoom and pan
- [ ] Touch/swipe navigation for mobile devices  
- [ ] Image optimization with Next.js Image component
- [ ] Progressive loading with WebP/AVIF support

### Review Integration
- [ ] Review display with rating calculations
- [ ] Review interaction features (voting, flagging)
- [ ] Business owner response integration
- [ ] Review filtering and sorting functionality
- [ ] Review analytics and verification badges

### Performance & Accessibility
- [ ] Modal performance optimized for 60fps animations
- [ ] Accessibility compliance (WCAG 2.1 AA)
- [ ] Mobile responsiveness across all breakpoints
- [ ] SEO validation with search engines
- [ ] Cross-browser compatibility verified

### Testing Coverage
- [ ] Unit test coverage > 85% for modal components
- [ ] Integration tests for business data display
- [ ] End-to-end tests for complete user journeys
- [ ] Performance tests for image loading
- [ ] Accessibility audit passed

---

## Risk Assessment & Mitigation

**Medium Risk:** Complex modal state management across routes
- **Mitigation:** Comprehensive testing of modal edge cases and URL synchronization

**Medium Risk:** Image gallery performance with large image sets
- **Mitigation:** Progressive loading, image optimization, and lazy loading implementation

**Low Risk:** SEO implementation and search engine indexing
- **Mitigation:** SEO best practices and validation with search console

---

## Success Metrics

- Modal engagement rate > 40% of business card clicks
- Average time spent in modal > 2 minutes
- Image gallery interaction rate > 60%
- SEO page load performance score > 90
- Mobile modal usability score > 4.5/5
- Business page search engine indexing rate > 95%