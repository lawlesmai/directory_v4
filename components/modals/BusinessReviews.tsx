'use client'

import React, { useState, useEffect } from 'react'
import { Star, ThumbsUp, ThumbsDown, Flag, MessageCircle, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Review {
  id: string
  userId: string
  userName: string
  userAvatar?: string
  rating: number
  title?: string
  comment: string
  date: string
  helpfulCount: number
  isHelpful?: boolean
  businessResponse?: {
    message: string
    date: string
    responderName: string
  }
  isVerified?: boolean
  photos?: string[]
}

interface BusinessReviewsProps {
  businessId: string
  averageRating: number
  reviewCount: number
  className?: string
}

export const BusinessReviews: React.FC<BusinessReviewsProps> = ({
  businessId,
  averageRating,
  reviewCount,
  className
}) => {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest' | 'helpful'>('newest')
  const [filterBy, setFilterBy] = useState<'all' | '5' | '4' | '3' | '2' | '1'>('all')
  const [showWriteReview, setShowWriteReview] = useState(false)


  // Mock data for demonstration
  useEffect(() => {
    const mockReviews: Review[] = [
      {
        id: '1',
        userId: 'user1',
        userName: 'Sarah Johnson',
        userAvatar: '/placeholder-user.jpg',
        rating: 5,
        title: 'Excellent service and quality!',
        comment: 'I had an amazing experience here. The staff was incredibly friendly and knowledgeable. The quality of service exceeded my expectations. I would definitely recommend this place to anyone looking for exceptional service.',
        date: '2024-08-15T10:30:00Z',
        helpfulCount: 12,
        isVerified: true,
        businessResponse: {
          message: 'Thank you so much for your kind words, Sarah! We\'re thrilled to hear about your positive experience. We look forward to serving you again soon!',
          date: '2024-08-16T09:15:00Z',
          responderName: 'Business Owner'
        }
      },
      {
        id: '2',
        userId: 'user2',
        userName: 'Mike Chen',
        rating: 4,
        comment: 'Great place overall. The atmosphere is nice and the service is good. Only minor issue was the wait time, but it was worth it in the end.',
        date: '2024-08-10T14:20:00Z',
        helpfulCount: 8,
        isVerified: false
      },
      {
        id: '3',
        userId: 'user3',
        userName: 'Emily Rodriguez',
        userAvatar: '/placeholder-user.jpg',
        rating: 5,
        title: 'My new favorite spot!',
        comment: 'This place has become my go-to! Consistent quality, friendly staff, and great value. I come here at least once a week now.',
        date: '2024-08-05T16:45:00Z',
        helpfulCount: 15,
        isVerified: true
      }
    ]

    setTimeout(() => {
      setReviews(mockReviews)
      setLoading(false)
    }, 1000)
  }, [businessId])

  const getRatingDistribution = () => {
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    reviews.forEach(review => {
      distribution[review.rating as keyof typeof distribution]++
    })
    return distribution
  }

  const filteredAndSortedReviews = reviews
    .filter(review => filterBy === 'all' || review.rating.toString() === filterBy)
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.date).getTime() - new Date(a.date).getTime()
        case 'oldest':
          return new Date(a.date).getTime() - new Date(b.date).getTime()
        case 'highest':
          return b.rating - a.rating
        case 'lowest':
          return a.rating - b.rating
        case 'helpful':
          return b.helpfulCount - a.helpfulCount
        default:
          return 0
      }
    })

  const ratingDistribution = getRatingDistribution()
  const totalRatings = Object.values(ratingDistribution).reduce((a, b) => a + b, 0)

  if (loading) {
    return (
      <div className={cn("business-reviews space-y-4", className)}>
        <div className="animate-pulse">
          <div className="h-6 bg-sage/20 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-4 bg-sage/10 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-sage/20 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-sage/20 rounded w-1/4 mb-1"></div>
                    <div className="h-3 bg-sage/20 rounded w-1/6"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-sage/20 rounded w-full"></div>
                  <div className="h-3 bg-sage/20 rounded w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("business-reviews space-y-6", className)}>
      {/* Reviews Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-sage-100">
          Customer Reviews
        </h3>
        
        <button
          type="button"
          onClick={() => setShowWriteReview(true)}
          className={cn(
            "px-4 py-2 bg-sage hover:bg-sage/90 text-navy-900",
            "rounded-lg font-medium text-sm transition-all duration-200",
            "hover:scale-105 active:scale-95",
            "focus:outline-none focus:ring-2 focus:ring-sage/50"
          )}
        >
          Write Review
        </button>
      </div>

      {/* Rating Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4 bg-sage/10 rounded-lg border border-sage/20">
        <div className="text-center lg:text-left">
          <div className="flex items-center justify-center lg:justify-start gap-2 mb-2">
            <span className="text-3xl font-bold text-sage-100">
              {averageRating.toFixed(1)}
            </span>
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={20}
                  className={cn(
                    star <= Math.round(averageRating)
                      ? "text-gold-primary fill-current"
                      : "text-gray-500"
                  )}
                />
              ))}
            </div>
          </div>
          <p className="text-sage/80 text-sm">
            Based on {reviewCount} reviews
          </p>
        </div>

        {/* Rating Distribution */}
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = ratingDistribution[rating as keyof typeof ratingDistribution]
            const percentage = totalRatings > 0 ? (count / totalRatings) * 100 : 0
            
            return (
              <div key={rating} className="flex items-center gap-2 text-sm">
                <span className="text-sage/80 w-8">{rating}★</span>
                <div className="flex-1 h-2 bg-sage/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gold-primary rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-sage/60 w-8 text-right">{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Filters and Sorting */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sage/80 text-sm">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="bg-sage/20 border border-sage/30 text-sage rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sage/50"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="highest">Highest Rated</option>
              <option value="lowest">Lowest Rated</option>
              <option value="helpful">Most Helpful</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sage/80 text-sm">Filter:</label>
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as typeof filterBy)}
              className="bg-sage/20 border border-sage/30 text-sage rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sage/50"
            >
              <option value="all">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
          </div>
        </div>

        <div className="text-sage/70 text-sm">
          Showing {filteredAndSortedReviews.length} of {reviews.length} reviews
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {filteredAndSortedReviews.map((review) => (
          <ReviewCard 
            key={review.id} 
            review={review}
            onHelpfulClick={(reviewId, isHelpful) => {
              // Handle helpful vote
              console.log('Helpful click:', reviewId, isHelpful)
            }}
            onReportClick={(reviewId) => {
              // Handle report
              console.log('Report click:', reviewId)
            }}
          />
        ))}

        {filteredAndSortedReviews.length === 0 && (
          <div className="text-center py-8 text-sage/60">
            <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
            <p>No reviews found matching your criteria.</p>
          </div>
        )}
      </div>

      {/* Load More Button */}
      {filteredAndSortedReviews.length > 0 && filteredAndSortedReviews.length < reviewCount && (
        <div className="text-center">
          <button
            type="button"
            className={cn(
              "px-6 py-3 bg-sage/20 hover:bg-sage/30 text-sage",
              "border border-sage/30 rounded-lg font-medium",
              "transition-all duration-200 hover:scale-105 active:scale-95",
              "focus:outline-none focus:ring-2 focus:ring-sage/50"
            )}
          >
            Load More Reviews
          </button>
        </div>
      )}
    </div>
  )
}

// Individual Review Card Component
interface ReviewCardProps {
  review: Review
  onHelpfulClick: (reviewId: string, isHelpful: boolean) => void
  onReportClick: (reviewId: string) => void
}

const ReviewCard: React.FC<ReviewCardProps> = ({
  review,
  onHelpfulClick,
  onReportClick
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [userHelpfulVote, setUserHelpfulVote] = useState<boolean | null>(null)

  const handleHelpfulClick = (isHelpful: boolean) => {
    setUserHelpfulVote(isHelpful)
    onHelpfulClick(review.id, isHelpful)
  }

  const isLongComment = review.comment.length > 200
  const displayComment = isExpanded || !isLongComment 
    ? review.comment 
    : review.comment.slice(0, 200) + '...'

  return (
    <div className="review-card p-4 bg-sage/10 rounded-lg border border-sage/20 space-y-4">
      {/* Review Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sage/20 rounded-full flex items-center justify-center">
            {review.userAvatar ? (
              <img 
                src={review.userAvatar} 
                alt={review.userName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-sage text-sm font-semibold">
                {review.userName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sage-100 font-medium">
                {review.userName}
              </span>
              {review.isVerified && (
                <div className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">
                  Verified
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={14}
                    className={cn(
                      star <= review.rating
                        ? "text-gold-primary fill-current"
                        : "text-gray-500"
                    )}
                  />
                ))}
              </div>
              
              <span className="text-sage/60 text-sm flex items-center gap-1">
                <Calendar size={12} />
                {new Date(review.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onReportClick(review.id)}
          className="p-1 text-sage/60 hover:text-sage/80 transition-colors"
          aria-label="Report review"
        >
          <Flag size={14} />
        </button>
      </div>

      {/* Review Title */}
      {review.title && (
        <h4 className="text-sage-100 font-semibold">
          {review.title}
        </h4>
      )}

      {/* Review Content */}
      <div className="space-y-3">
        <p className="text-sage-200 leading-relaxed">
          {displayComment}
        </p>
        
        {isLongComment && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sage hover:text-sage/80 text-sm font-medium transition-colors"
          >
            {isExpanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </div>

      {/* Review Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-sage/20">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => handleHelpfulClick(true)}
            className={cn(
              "flex items-center gap-1 text-sm transition-colors",
              userHelpfulVote === true
                ? "text-green-400"
                : "text-sage/70 hover:text-sage"
            )}
          >
            <ThumbsUp size={14} fill={userHelpfulVote === true ? "currentColor" : "none"} />
            <span>Helpful ({review.helpfulCount})</span>
          </button>
          
          <button
            type="button"
            onClick={() => handleHelpfulClick(false)}
            className={cn(
              "flex items-center gap-1 text-sm transition-colors",
              userHelpfulVote === false
                ? "text-red-400"
                : "text-sage/70 hover:text-sage"
            )}
          >
            <ThumbsDown size={14} fill={userHelpfulVote === false ? "currentColor" : "none"} />
            <span>Not Helpful</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-sage/70 hover:text-sage text-sm transition-colors"
          >
            Reply
          </button>
        </div>
      </div>

      {/* Business Response */}
      {review.businessResponse && (
        <div className="p-3 bg-navy-800/50 border border-sage/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 bg-sage/20 rounded-full flex items-center justify-center">
              <span className="text-sage text-xs font-semibold">B</span>
            </div>
            <span className="text-sage text-sm font-medium">
              Response from {review.businessResponse.responderName}
            </span>
            <span className="text-sage/60 text-xs">
              {new Date(review.businessResponse.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          </div>
          <p className="text-sage-200 text-sm leading-relaxed">
            {review.businessResponse.message}
          </p>
        </div>
      )}
    </div>
  )
}