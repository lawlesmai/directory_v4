# Story 4.5: Content Management & Review Moderation

**Epic:** Epic 4 - Platform Admin Portal  
**User Story:** As a content moderator, I want efficient tools to manage and moderate user reviews, business content, and platform communications so that I can maintain high content quality and community standards.

**Assignee:** Frontend Developer Agent  
**Priority:** P1  
**Story Points:** 25  
**Sprint:** 2

## Detailed Acceptance Criteria

### Review Moderation System

**Given** user-generated reviews requiring moderation  
**When** moderating review content  
**Then** provide comprehensive review moderation tools:

**Review Queue Management:**
- Automated review flagging based on suspicious patterns
- Priority queues for different types of review issues
- Review age tracking with escalation for old items
- Moderator assignment and workload distribution
- Bulk moderation actions for similar content
- Review source tracking (organic, incentivized, suspicious)
- Integration with AI sentiment and authenticity analysis

**Review Content Analysis:**
- Sentiment analysis with keyword highlighting
- Fake review detection using behavioral patterns
- Spam content identification and filtering
- Inappropriate language detection and masking
- Review authenticity scoring and verification
- Competitor review pattern identification
- Review bombing and coordinated attack detection

### Content Quality Management

**Given** various types of platform content requiring oversight  
**When** managing content quality  
**Then** implement comprehensive content management:

**Business Content Moderation:**
- Business description appropriateness review
- Image content moderation for appropriateness and quality
- Business hours and information accuracy verification
- Promotional content compliance with platform guidelines
- Category placement accuracy and appropriateness
- Contact information validation and spam prevention
- Business update and announcement moderation

**User-Generated Content Management:**
- Photo uploads moderation with AI assistance
- User profile content appropriateness review
- Comment and message content filtering
- Social media integration content monitoring
- User complaint investigation and resolution
- Community guideline enforcement
- Escalation procedures for serious violations

### Moderation Decision Management

**Given** moderation decisions requiring consistency and appeals  
**When** making and managing moderation decisions  
**Then** provide decision management tools:

**Decision Recording & Tracking:**
- Standardized decision categories and reasoning
- Decision history tracking for consistency analysis
- Moderator decision quality scoring
- Decision appeal process and review system
- Precedent case management for similar situations
- Decision impact tracking on user/business satisfaction
- Legal compliance documentation for decisions

**Appeal & Escalation System:**
- User-initiated appeal process with status tracking
- Escalation workflows for complex cases
- Second-level review process for contested decisions
- Legal team integration for serious violations
- Business owner communication for moderation decisions
- Resolution time tracking and SLA management
- Customer satisfaction monitoring for appeal resolution

### Content Analytics & Insights

**Given** moderated content data for platform improvement  
**When** analyzing content trends and patterns  
**Then** provide analytical insights:

**Moderation Analytics:**
- Content volume trends and seasonal patterns
- Moderation accuracy and consistency metrics
- Common violation types and trend analysis
- Geographic patterns in content violations
- Business category-specific content issues
- Moderator performance and efficiency metrics
- False positive and false negative analysis

## Frontend Implementation

### Review Moderation Interface

```typescript
// components/admin/moderation/ReviewModerationDashboard.tsx
export const ReviewModerationDashboard: React.FC = () => {
  const [filters, setFilters] = useState<ReviewModerationFilters>({
    status: 'flagged',
    priority: 'all',
    type: 'all'
  })
  const [selectedReviews, setSelectedReviews] = useState<string[]>([])
  
  const {
    data: reviewsData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['review-moderation', filters],
    queryFn: () => adminApi.getFlaggedReviews(filters),
    keepPreviousData: true
  })

  const moderationMutation = useMutation({
    mutationFn: adminApi.moderateReview,
    onSuccess: () => {
      refetch()
      setSelectedReviews([])
      toast.success('Review moderation completed')
    }
  })

  const handleBulkModeration = async (action: 'approve' | 'reject' | 'flag') => {
    if (selectedReviews.length === 0) return
    
    const confirmed = await confirmDialog({
      title: `Bulk ${action.charAt(0).toUpperCase() + action.slice(1)} Reviews`,
      description: `Are you sure you want to ${action} ${selectedReviews.length} review(s)?`,
      confirmText: action.charAt(0).toUpperCase() + action.slice(1)
    })
    
    if (confirmed) {
      moderationMutation.mutate({
        reviewIds: selectedReviews,
        action,
        bulk: true
      })
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-cream">
            Review Moderation
          </h1>
          <p className="text-sage/70 mt-1">
            Monitor and moderate user reviews for quality and authenticity
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <ReviewAnalyticsButton />
          <AutoModerationToggle />
        </div>
      </div>

      {/* Moderation Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Flagged Reviews"
          value={reviewsData?.stats.flaggedCount}
          urgent={reviewsData?.stats.highPriorityCount > 0}
          icon={Flag}
          color="red"
        />
        <StatCard
          title="Processed Today"
          value={reviewsData?.stats.processedToday}
          change={reviewsData?.stats.processedTodayChange}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Accuracy Rate"
          value={`${reviewsData?.stats.accuracyRate}%`}
          icon={Target}
          color="blue"
        />
        <StatCard
          title="Avg Response Time"
          value={`${reviewsData?.stats.avgResponseTime}m`}
          icon={Clock}
          color="teal"
        />
      </div>

      {/* Filters and Search */}
      <GlassMorphism variant="subtle" className="p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <SearchInput
              value={filters.search || ''}
              onChange={(search) => setFilters(prev => ({ ...prev, search }))}
              placeholder="Search reviews by content, business, or user..."
            />
          </div>
          
          <div className="flex items-center gap-4">
            <ReviewStatusFilter
              value={filters.status}
              onChange={(status) => setFilters(prev => ({ ...prev, status }))}
            />
            
            <ReviewPriorityFilter
              value={filters.priority}
              onChange={(priority) => setFilters(prev => ({ ...prev, priority }))}
            />
            
            <ReviewTypeFilter
              value={filters.type}
              onChange={(type) => setFilters(prev => ({ ...prev, type }))}
            />
          </div>
        </div>
      </GlassMorphism>

      {/* Bulk Actions */}
      <AnimatePresence>
        {selectedReviews.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <GlassMorphism variant="medium" className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-cream font-medium">
                  {selectedReviews.length} review(s) selected
                </span>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleBulkModeration('approve')}
                    className="px-4 py-2 bg-green-600 text-cream rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Approve All
                  </button>
                  
                  <button
                    onClick={() => handleBulkModeration('reject')}
                    className="px-4 py-2 bg-red-error text-cream rounded-lg hover:bg-red-critical transition-colors"
                  >
                    Reject All
                  </button>
                  
                  <button
                    onClick={() => setSelectedReviews([])}
                    className="px-4 py-2 text-sage/70 hover:text-sage transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </GlassMorphism>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reviews List */}
      <GlassMorphism variant="subtle" className="overflow-hidden">
        {isLoading ? (
          <ReviewModerationSkeleton />
        ) : error ? (
          <ErrorState
            title="Failed to load reviews"
            description={error.message}
            action={{ label: 'Retry', onClick: () => refetch() }}
          />
        ) : (
          <div className="divide-y divide-sage/10">
            {reviewsData?.reviews.map((review) => (
              <ReviewModerationItem
                key={review.id}
                review={review}
                selected={selectedReviews.includes(review.id)}
                onSelect={(selected) => {
                  setSelectedReviews(prev => 
                    selected 
                      ? [...prev, review.id]
                      : prev.filter(id => id !== review.id)
                  )
                }}
                onModerate={(action, reason) => 
                  moderationMutation.mutate({
                    reviewId: review.id,
                    action,
                    reason
                  })
                }
              />
            ))}
          </div>
        )}
      </GlassMorphism>
    </div>
  )
}
```

### Advanced Review Analysis Interface

```typescript
// components/admin/moderation/ReviewAnalysisPanel.tsx
interface ReviewAnalysisPanelProps {
  review: Review
  analysis: ReviewAnalysis
  onModerate: (action: ModerationAction, reason?: string) => void
}

export const ReviewAnalysisPanel: React.FC<ReviewAnalysisPanelProps> = ({
  review,
  analysis,
  onModerate
}) => {
  const [showDetails, setShowDetails] = useState(false)
  const [moderationReason, setModerationReason] = useState('')
  
  const getAnalysisColor = (score: number) => {
    if (score >= 0.8) return 'text-green-400'
    if (score >= 0.6) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case 'positive': return 'text-green-400'
      case 'negative': return 'text-red-400'
      default: return 'text-sage/70'
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Review Content */}
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar
              src={review.user.avatar}
              alt={review.user.name}
              size="sm"
              fallback={review.user.name.charAt(0)}
            />
            <div>
              <p className="font-medium text-cream">{review.user.name}</p>
              <div className="flex items-center gap-2 text-sm text-sage/70">
                <span>{formatDistanceToNow(review.createdAt)} ago</span>
                <span>•</span>
                <StarRating rating={review.rating} size="sm" readonly />
              </div>
            </div>
          </div>
          
          <ReviewFlagBadge
            flags={analysis.flags}
            severity={analysis.severity}
          />
        </div>
        
        <div className="bg-navy-dark/50 rounded-lg p-4">
          <p className="text-cream leading-relaxed">{review.content}</p>
        </div>
      </div>

      {/* AI Analysis Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-lg font-heading font-semibold text-cream">
            AI Analysis
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sage/70">Authenticity Score</span>
              <div className="flex items-center gap-2">
                <span className={cn('font-medium', getAnalysisColor(analysis.authenticityScore))}>
                  {Math.round(analysis.authenticityScore * 100)}%
                </span>
                <ScoreIndicator score={analysis.authenticityScore} />
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sage/70">Sentiment</span>
              <div className="flex items-center gap-2">
                <span className={cn('font-medium', getSentimentColor(analysis.sentiment))}>
                  {analysis.sentiment}
                </span>
                <span className="text-sm text-sage/60">
                  ({Math.round(analysis.sentimentScore * 100)}%)
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sage/70">Spam Probability</span>
              <div className="flex items-center gap-2">
                <span className={cn('font-medium', getAnalysisColor(1 - analysis.spamScore))}>
                  {Math.round(analysis.spamScore * 100)}%
                </span>
                <ScoreIndicator score={1 - analysis.spamScore} />
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sage/70">Language Appropriateness</span>
              <div className="flex items-center gap-2">
                <span className={cn('font-medium', getAnalysisColor(analysis.appropriatenessScore))}>
                  {Math.round(analysis.appropriatenessScore * 100)}%
                </span>
                <ScoreIndicator score={analysis.appropriatenessScore} />
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <h3 className="text-lg font-heading font-semibold text-cream">
            Detected Issues
          </h3>
          
          <div className="space-y-2">
            {analysis.flags.map((flag) => (
              <div
                key={flag.type}
                className="flex items-center gap-3 p-3 bg-red-error/20 border border-red-error/30 rounded-lg"
              >
                <AlertTriangle className="w-4 h-4 text-red-error" />
                <div className="flex-1">
                  <p className="font-medium text-red-error">{flag.title}</p>
                  <p className="text-sm text-sage/70">{flag.description}</p>
                </div>
                <span className="text-xs bg-red-error/30 text-red-error px-2 py-1 rounded">
                  {Math.round(flag.confidence * 100)}%
                </span>
              </div>
            ))}
          </div>
          
          {analysis.flags.length === 0 && (
            <div className="flex items-center gap-3 p-3 bg-green-600/20 border border-green-600/30 rounded-lg">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-green-400">No issues detected</span>
            </div>
          )}
        </div>
      </div>

      {/* Review Context */}
      <div className="space-y-4">
        <h3 className="text-lg font-heading font-semibold text-cream">
          Review Context
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ContextCard
            title="User History"
            value={`${analysis.userStats.reviewCount} reviews`}
            subtitle={`Avg rating: ${analysis.userStats.avgRating.toFixed(1)}`}
            icon={User}
          />
          
          <ContextCard
            title="Business Reviews"
            value={`${analysis.businessStats.totalReviews} total`}
            subtitle={`Avg: ${analysis.businessStats.avgRating.toFixed(1)} stars`}
            icon={Building}
          />
          
          <ContextCard
            title="Recent Activity"
            value={`${analysis.recentActivity} reviews`}
            subtitle="Last 7 days"
            icon={Activity}
          />
        </div>
      </div>

      {/* Moderation Actions */}
      <div className="flex items-center justify-between pt-6 border-t border-sage/20">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 text-sage/70 hover:text-sage transition-colors"
        >
          <FileText className="w-4 h-4" />
          {showDetails ? 'Hide' : 'Show'} Details
        </button>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => onModerate('approve')}
            className="px-6 py-2 bg-green-600 text-cream rounded-lg hover:bg-green-700 transition-colors"
          >
            Approve
          </button>
          
          <button
            onClick={() => onModerate('flag', moderationReason)}
            className="px-6 py-2 bg-yellow-600 text-cream rounded-lg hover:bg-yellow-700 transition-colors"
          >
            Flag for Review
          </button>
          
          <button
            onClick={() => onModerate('reject', moderationReason)}
            className="px-6 py-2 bg-red-error text-cream rounded-lg hover:bg-red-critical transition-colors"
          >
            Reject
          </button>
        </div>
      </div>
      
      {/* Moderation Reason */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-cream">
          Moderation Notes (Optional)
        </label>
        <textarea
          value={moderationReason}
          onChange={(e) => setModerationReason(e.target.value)}
          placeholder="Add notes about this moderation decision..."
          className="w-full px-3 py-2 bg-navy-dark border border-sage/30 rounded-lg text-cream resize-none"
          rows={3}
        />
      </div>

      {/* Detailed Analysis */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 pt-6 border-t border-sage/20"
          >
            <DetailedAnalysisPanel analysis={analysis} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

## Technical Implementation Notes

**AI-Assisted Moderation:**
- Integration with content analysis APIs (Google Cloud AI, AWS Comprehend)
- Machine learning model training on moderated content
- Natural language processing for sentiment and context analysis
- Computer vision for image content analysis

**Workflow Automation:**
- Automated content routing based on type and severity
- Batch processing for similar moderation cases
- Integration with notification systems for stakeholders
- API integrations for external content analysis services

**Decision Management System:**
- Structured data storage for moderation decisions
- Decision template system for consistency
- Appeal workflow management with status tracking
- Integration with user communication systems

## Dependencies

- Story 4.4 (Business verification workflows for content validation)
- Epic 1 Story 1.7 (Review system foundation)

## Testing Requirements

**Content Moderation Tests:**
- AI content detection accuracy and calibration tests
- Manual moderation interface functionality tests
- Decision consistency and quality assurance tests
- Appeal process workflow and resolution tests

**Integration Tests:**
- External AI service integration and fallback tests
- Notification and communication system tests
- Business owner and user notification delivery tests
- Decision impact tracking accuracy tests

**Performance Tests:**
- Large volume content processing performance tests
- Real-time content analysis response time tests
- Moderation queue management efficiency tests
- Database performance for content storage and retrieval

## Definition of Done

- [ ] Comprehensive review moderation system operational
- [ ] AI-assisted content analysis integrated
- [ ] Content quality management tools functional
- [ ] Moderation decision tracking and appeal system complete
- [ ] Content analytics and insights dashboard
- [ ] Mobile-responsive content moderation interface
- [ ] Integration with external AI content analysis services
- [ ] Performance optimization for high-volume content processing
- [ ] All content moderation accuracy tests passing
- [ ] Documentation complete for content moderation procedures

## Risk Assessment

- **Medium Risk:** AI content analysis may require significant training and calibration
- **Low Risk:** Manual moderation interface implementation
- **Mitigation:** Human oversight for AI decisions and continuous model improvement