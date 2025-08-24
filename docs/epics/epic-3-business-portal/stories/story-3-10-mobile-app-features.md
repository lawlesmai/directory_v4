# Story 3.10: Business Portal Mobile App Features

**Epic:** Epic 3 - Full-Featured Business Portal  
**Story ID:** 3.10  
**Priority:** P1 (Mobile Experience)  
**Points:** 25  
**Sprint:** 4  
**Assignee:** Frontend Developer Agent

## User Story

**As a business owner frequently on-the-go,** I want mobile-optimized business portal features and potentially a dedicated mobile app, **so that** I can manage my business efficiently from anywhere using my mobile device.

## Background & Context

Business Portal Mobile App Features optimize the business management experience for mobile devices, recognizing that business owners often need to manage their online presence while away from their desktop. This story focuses on creating a Progressive Web App (PWA) with native app-like features and mobile-specific optimizations.

The mobile experience must prioritize the most common business management tasks while maintaining full functionality in a touch-friendly interface.

## Acceptance Criteria

### AC 3.10.1: Mobile-Optimized Web Portal
**Given** business owners using mobile devices  
**When** accessing the business portal on mobile  
**Then** provide optimized mobile experiences:

#### Mobile Dashboard Optimization:
- Touch-friendly interface with appropriate button sizing (minimum 44px targets)
- Swipe gestures for navigation between dashboard sections
- Mobile-specific layout with collapsible sections
- Quick action shortcuts accessible from mobile home screen
- Offline capability for critical business information
- Mobile-specific notification handling and display
- Bottom tab navigation for primary functions

#### Mobile-First Business Management:
- Streamlined business profile editing optimized for mobile
- Mobile photo upload with camera integration and gallery access
- Touch-optimized review response interface with swipe actions
- Mobile-friendly analytics with simplified charts and metrics
- Voice-to-text integration for review responses and updates
- Mobile barcode scanning for inventory (future enhancement)

### AC 3.10.2: Progressive Web App (PWA) Implementation
**Given** the need for app-like mobile experience  
**When** implementing PWA features  
**Then** create comprehensive PWA capabilities:

#### PWA Core Features:
- Home screen installation capability with custom icon
- Offline functionality with cached essential data
- Background sync for data updates when connection returns
- Push notifications for reviews, messages, and updates
- App-like navigation and user experience
- Fast loading with service worker caching
- Splash screen and loading states

#### Mobile-Specific Notifications:
- Push notifications for new customer reviews
- Real-time alerts for customer inquiries and messages
- Notification management and preferences
- Quiet hours settings for notifications
- Location-based notifications for multi-location businesses
- Emergency notification system for urgent updates

### AC 3.10.3: Mobile Business Tools & Quick Actions
**Given** mobile-specific business needs  
**When** providing mobile business tools  
**Then** implement mobile-optimized features:

```typescript
const MobileBusinessDashboard: React.FC = () => {
  const { business, notifications, quickStats } = useMobileDashboard()
  const [activeTab, setActiveTab] = useState<MobileTab>('overview')
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-dark via-teal-primary/10 to-navy-dark">
      {/* Mobile Header */}
      <div className="sticky top-0 z-50 bg-navy-90/95 backdrop-blur-lg border-b border-sage/20">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BusinessAvatar business={business} size="sm" />
              <div>
                <h1 className="font-medium text-cream text-sm truncate">
                  {business.name}
                </h1>
                <p className="text-xs text-sage/70">
                  {getBusinessStatusText(business)}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <NotificationBell
                count={notifications.unreadCount}
                onClick={openNotifications}
              />
              <MobileMenuButton onClick={openMobileMenu} />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="px-4 py-3 bg-navy-50/20">
        <div className="flex items-center justify-between text-center">
          <div>
            <div className="text-lg font-semibold text-cream">
              {quickStats.todayViews}
            </div>
            <div className="text-xs text-sage/70">Today's Views</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-cream">
              {quickStats.unreadReviews}
            </div>
            <div className="text-xs text-sage/70">New Reviews</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-cream">
              {quickStats.rating.toFixed(1)}
            </div>
            <div className="text-xs text-sage/70">Rating</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-cream">
              {quickStats.isOpen ? 'Open' : 'Closed'}
            </div>
            <div className="text-xs text-sage/70">Status</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto pb-20"> {/* Space for bottom nav */}
          {activeTab === 'overview' && <MobileOverviewTab />}
          {activeTab === 'reviews' && <MobileReviewsTab />}
          {activeTab === 'profile' && <MobileProfileTab />}
          {activeTab === 'analytics' && <MobileAnalyticsTab />}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-navy-90/95 backdrop-blur-lg border-t border-sage/20">
        <div className="grid grid-cols-4 gap-1 px-2 py-1">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'reviews', label: 'Reviews', icon: MessageSquare, badge: notifications.unreadReviews },
            { id: 'profile', label: 'Profile', icon: Building },
            { id: 'analytics', label: 'Analytics', icon: TrendingUp }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as MobileTab)}
              className={cn(
                'flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-colors relative',
                activeTab === tab.id
                  ? 'bg-teal-primary/20 text-teal-primary'
                  : 'text-sage/70'
              )}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{tab.label}</span>
              {tab.badge && tab.badge > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-error rounded-full flex items-center justify-center">
                  <span className="text-xs text-cream">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Action FAB */}
      <QuickActionsFAB
        actions={[
          { id: 'camera', label: 'Add Photo', icon: Camera, action: openCamera },
          { id: 'hours', label: 'Update Hours', icon: Clock, action: updateHours },
          { id: 'post', label: 'Post Update', icon: Edit, action: createPost }
        ]}
      />
    </div>
  )
}

const MobileReviewsTab: React.FC = () => {
  const { reviews, isLoading } = useMobileReviews()
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  
  return (
    <div className="p-4 space-y-4">
      {/* Review Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { label: 'All', value: 'all' },
          { label: 'Unread', value: 'unread' },
          { label: '5 Stars', value: '5' },
          { label: '4 Stars', value: '4' },
          { label: '≤3 Stars', value: 'low' }
        ].map((filter) => (
          <FilterChip
            key={filter.value}
            label={filter.label}
            active={selectedFilter === filter.value}
            onClick={() => setSelectedFilter(filter.value)}
          />
        ))}
      </div>

      {/* Reviews List */}
      <div className="space-y-3">
        {reviews.map((review) => (
          <MobileReviewCard
            key={review.id}
            review={review}
            onRespond={() => openMobileResponseModal(review)}
            onSwipeAction={(action) => handleReviewSwipe(review.id, action)}
          />
        ))}
      </div>

      {/* Mobile Response Modal */}
      {selectedReview && (
        <MobileResponseModal
          review={selectedReview}
          onClose={() => setSelectedReview(null)}
          onSubmit={handleResponseSubmit}
        />
      )}
    </div>
  )
}

const MobileReviewCard: React.FC<MobileReviewCardProps> = ({
  review,
  onRespond,
  onSwipeAction
}) => {
  const { swipeHandlers } = useSwipeGestures({
    onSwipeLeft: () => onSwipeAction('respond'),
    onSwipeRight: () => onSwipeAction('archive')
  })

  return (
    <div
      {...swipeHandlers}
      className="bg-navy-50/20 rounded-lg p-4 relative overflow-hidden"
    >
      {/* Swipe Indicators */}
      <div className="absolute inset-y-0 left-0 w-1 bg-teal-primary opacity-0 transition-opacity" 
           data-swipe-indicator="left" />
      <div className="absolute inset-y-0 right-0 w-1 bg-red-error opacity-0 transition-opacity" 
           data-swipe-indicator="right" />
      
      <div className="flex items-start gap-3">
        <Avatar size="sm" src={review.reviewer.avatar} name={review.reviewer.name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-medium text-cream text-sm truncate">
              {review.reviewer.name}
            </h4>
            <div className="flex items-center gap-1">
              <StarRating value={review.rating} size="xs" readonly />
              <span className="text-xs text-sage/70">
                {formatRelativeTime(review.createdAt)}
              </span>
            </div>
          </div>
          
          <p className="text-sm text-sage/90 leading-relaxed line-clamp-3">
            {review.content}
          </p>
          
          {!review.hasResponse && (
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRespond(review)}
                className="flex-1"
              >
                <MessageSquare className="w-3 h-3 mr-1" />
                Respond
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => markAsRead(review.id)}
              >
                <Check className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const QuickActionsFAB: React.FC<QuickActionsFABProps> = ({ actions }) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="fixed bottom-20 right-4 z-40">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-16 right-0 space-y-2"
          >
            {actions.map((action, index) => (
              <motion.button
                key={action.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => {
                  action.action()
                  setIsOpen(false)
                }}
                className="flex items-center gap-3 bg-navy-90/95 backdrop-blur-lg text-cream px-4 py-3 rounded-full shadow-lg"
              >
                <action.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{action.label}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-12 h-12 bg-teal-primary text-cream rounded-full shadow-lg',
          'flex items-center justify-center transition-transform',
          isOpen && 'rotate-45'
        )}
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  )
}
```

### AC 3.10.4: Location-Based Features & GPS Integration
**Given** mobile location capabilities  
**When** providing location-based tools  
**Then** implement location features:

#### GPS Integration:
- GPS integration for location verification and check-ins
- Check-in system for multi-location managers
- Location-specific task management and reminders
- Mobile-optimized directions and maps integration
- Nearby competitor monitoring and alerts
- Local event and opportunity notifications

#### Mobile Photography & Media:
- Camera integration for instant photo uploads
- Photo editing tools optimized for mobile
- GPS tagging for location-specific photos
- Bulk photo upload with mobile optimization
- Video recording for business updates
- Social media story creation tools

### AC 3.10.5: Mobile Analytics & Reporting
**Given** the need for on-the-go business insights  
**When** viewing analytics on mobile devices  
**Then** provide mobile-optimized reporting:
- Simplified dashboard with key metrics
- Swipeable charts and data visualizations
- Mobile-friendly report generation and sharing
- Voice-activated analytics queries (future enhancement)
- Mobile push notifications for significant metric changes
- Offline analytics viewing for cached data

## Technical Requirements

### PWA Implementation
- **Service Worker:** Comprehensive caching and offline functionality
- **Web App Manifest:** Proper configuration for home screen installation
- **Background Sync:** Queue operations for when connection returns
- **Push Notifications:** Firebase Cloud Messaging integration
- **Performance:** Lighthouse PWA score > 90

### Mobile Performance Optimization
- **Bundle Size:** < 150KB initial mobile bundle
- **Load Time:** < 2 seconds on 3G connections
- **Touch Response:** < 100ms touch feedback
- **Memory Usage:** < 50MB average usage
- **Battery Impact:** Optimized for minimal battery drain

## Dependencies

### Must Complete First:
- Story 3.1: Dashboard foundation for mobile optimization
- Story 3.5: Review management for mobile features

### External Dependencies:
- PWA service worker configuration
- Push notification service setup
- Mobile-specific API optimizations
- Camera and GPS permission handling

## Definition of Done

### Functional Requirements ✓
- [ ] Mobile-optimized business portal with touch-friendly interface
- [ ] PWA implementation with offline capability and notifications
- [ ] Mobile business tools and quick actions functional
- [ ] Location-based features integrated
- [ ] Mobile analytics and reporting optimized

### Technical Requirements ✓
- [ ] Performance optimization for mobile devices
- [ ] Cross-platform mobile compatibility validated
- [ ] PWA installation and offline functionality working
- [ ] Push notification system operational
- [ ] Mobile-specific API optimizations implemented

### User Experience ✓
- [ ] Intuitive mobile navigation and interactions
- [ ] Touch gestures working smoothly
- [ ] Mobile-specific workflows optimized
- [ ] Offline functionality providing value
- [ ] App-like experience achieved

## Success Metrics

### Mobile Adoption
- Mobile portal usage: > 60% of total sessions
- PWA installations: > 25% of mobile users
- Mobile task completion rate: > 90%
- Mobile session duration: > 8 minutes average

### Technical Performance
- Mobile page load time: < 2 seconds
- PWA performance score: > 90
- Offline functionality usage: > 30% of mobile users
- Push notification engagement: > 40%

### Business Impact
- Mobile-driven business actions: +50% increase
- Response time improvement: -40% faster on mobile
- User satisfaction with mobile: > 4.3/5
- Mobile user retention: > 80%

## Risk Assessment

### Technical Risks
- **Medium Risk:** PWA browser support variations across devices
  - *Mitigation:* Progressive enhancement and comprehensive device testing
- **Low Risk:** Mobile performance optimization complexity
  - *Mitigation:* Mobile-first development approach

### User Experience Risks
- **Low Risk:** Touch interface usability concerns
  - *Mitigation:* Extensive mobile user testing and iteration