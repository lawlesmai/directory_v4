# Story 6.5: GraphQL API Implementation

**Epic:** Epic 6 - Public API Platform  
**Story ID:** 6.5  
**Story Title:** GraphQL API Implementation  
**Priority:** P1 (High)  
**Assignee:** Backend Architect Agent  
**Story Points:** 30  
**Sprint:** 2

## User Story

**As a** developer building modern applications  
**I want** a GraphQL API that allows flexible data queries and real-time subscriptions  
**So that** I can efficiently fetch exactly the data I need and receive live updates

## Epic Context

This story implements a comprehensive GraphQL API alongside the existing RESTful API, providing developers with flexible data querying capabilities, real-time subscriptions, and optimized performance. GraphQL enables modern applications to request specific data sets, reduce over-fetching, and receive real-time updates through subscriptions.

## Acceptance Criteria

### GraphQL Schema Design & Implementation

**Given** the need for flexible data querying  
**When** implementing GraphQL API  
**Then** create comprehensive GraphQL schema:

#### Core Schema Types

```graphql
type Business {
  id: ID!
  name: String!
  description: String
  category: Category!
  location: Location!
  contact: ContactInfo!
  hours: [BusinessHours!]!
  rating: Float
  reviewCount: Int
  reviews(first: Int, after: String): ReviewConnection
  photos: [Photo!]!
  verified: Boolean!
  premium: Boolean!
  analytics: BusinessAnalytics
}

type Review {
  id: ID!
  business: Business!
  author: User
  rating: Int!
  title: String
  content: String!
  photos: [Photo!]
  response: ReviewResponse
  createdAt: DateTime!
  helpful: Int
}

type Category {
  id: ID!
  name: String!
  slug: String!
  businesses(first: Int, after: String, filter: BusinessFilter): BusinessConnection
  subcategories: [Category!]
}
```

#### Query Operations

```graphql
type Query {
  business(id: ID!): Business
  businesses(first: Int, after: String, filter: BusinessFilter, sort: BusinessSort): BusinessConnection
  searchBusinesses(query: String!, location: LocationInput, radius: Float): [Business!]!
  categories: [Category!]!
  nearbyBusinesses(location: LocationInput!, radius: Float): [Business!]!
  review(id: ID!): Review
  user(id: ID!): User
}
```

### GraphQL Mutations & Real-time Subscriptions

**Given** the need for data modification and real-time updates  
**When** implementing mutations and subscriptions  
**Then** provide comprehensive write operations:

#### Mutation Operations

```graphql
type Mutation {
  createReview(input: CreateReviewInput!): CreateReviewPayload
  updateBusiness(id: ID!, input: UpdateBusinessInput!): UpdateBusinessPayload
  responseToReview(reviewId: ID!, input: ReviewResponseInput!): ReviewResponsePayload
  uploadBusinessPhoto(businessId: ID!, photo: Upload!): PhotoUploadPayload
  updateBusinessHours(businessId: ID!, hours: [BusinessHoursInput!]!): BusinessHours
}
```

#### Subscription Operations

```graphql
type Subscription {
  businessUpdated(businessId: ID!): Business
  newReview(businessId: ID!): Review
  reviewResponse(reviewId: ID!): ReviewResponse
  businessAnalytics(businessId: ID!): BusinessAnalytics
}
```

### Advanced GraphQL Features

**Given** performance and developer experience requirements  
**When** enhancing GraphQL functionality  
**Then** implement advanced features:

#### Query Optimization
- ✅ N+1 query prevention with DataLoader implementation
- ✅ Query complexity analysis and limiting
- ✅ Query depth limiting for security
- ✅ Automatic query batching and caching
- ✅ Persisted queries for performance optimization
- ✅ Query whitelisting for production security
- ✅ Real-time query performance monitoring

#### Developer Experience
- ✅ GraphQL Playground for query testing and exploration
- ✅ Schema introspection and documentation generation
- ✅ Type-safe generated TypeScript types
- ✅ Query validation and error handling
- ✅ Custom scalar types for dates, coordinates, etc.
- ✅ Field-level deprecation and migration guidance
- ✅ Schema versioning and evolution strategy

### Authentication & Authorization for GraphQL

**Given** secure GraphQL access requirements  
**When** implementing GraphQL security  
**Then** provide comprehensive access control:

#### Field-Level Security
- ✅ Field-level authorization based on user roles
- ✅ Dynamic field filtering based on subscription tier
- ✅ Business ownership verification for mutations
- ✅ Rate limiting per field and operation type
- ✅ Audit logging for all GraphQL operations
- ✅ Input validation and sanitization
- ✅ Schema-level security rules and policies

## Technical Implementation

### GraphQL Server Implementation
- **Server:** Apollo Server or similar GraphQL server implementation
- **Development:** Schema-first development with code generation
- **Optimization:** Resolver optimization with DataLoader pattern
- **Subscriptions:** Subscription implementation with WebSocket support

### Performance Optimization
- **Caching:** Query caching with Redis integration
- **Database:** Database query optimization for GraphQL resolvers
- **Subscriptions:** Subscription performance optimization
- **Stitching:** Schema stitching for microservice integration

### Security Implementation
- **Analysis:** Query complexity analysis to prevent DoS attacks
- **Authentication:** Authentication integration with existing OAuth system
- **Authorization:** Authorization middleware for field-level access control
- **Validation:** Input validation and query sanitization

## GraphQL Schema Specifications

### Business Type Definition

```graphql
type Business {
  # Core fields
  id: ID!
  name: String!
  description: String
  slug: String!
  
  # Categorization
  category: Category!
  subcategories: [Category!]!
  tags: [String!]!
  
  # Location information
  location: Location!
  serviceAreas: [Location!]!
  
  # Contact information
  contact: ContactInfo!
  website: String
  socialMedia: SocialMediaLinks
  
  # Business details
  hours: [BusinessHours!]!
  amenities: [Amenity!]!
  paymentMethods: [PaymentMethod!]!
  languages: [Language!]!
  
  # Media
  logo: Photo
  coverPhoto: Photo
  photos: [Photo!]!
  videos: [Video!]!
  
  # Ratings and reviews
  rating: Float
  reviewCount: Int
  reviews(
    first: Int
    after: String
    sort: ReviewSort = NEWEST
    rating: Int
  ): ReviewConnection!
  
  # Status and verification
  verified: Boolean!
  premium: Boolean!
  status: BusinessStatus!
  claimedAt: DateTime
  
  # Analytics (authenticated users only)
  analytics: BusinessAnalytics @auth
  
  # Relationships
  owner: User @auth
  staff: [User!]! @auth
  competitors: [Business!]!
  relatedBusinesses: [Business!]!
}

type Location {
  id: ID!
  address: String!
  street: String
  city: String!
  state: String!
  zipCode: String!
  country: String!
  coordinates: Coordinates!
  timezone: String!
  formattedAddress: String!
}

type Coordinates {
  latitude: Float!
  longitude: Float!
}

type ContactInfo {
  phone: String
  email: String
  website: String
  fax: String
}

type BusinessHours {
  dayOfWeek: DayOfWeek!
  openTime: Time
  closeTime: Time
  closed: Boolean!
  notes: String
}

enum DayOfWeek {
  MONDAY
  TUESDAY
  WEDNESDAY
  THURSDAY
  FRIDAY
  SATURDAY
  SUNDAY
}
```

### Review Type Definition

```graphql
type Review {
  id: ID!
  business: Business!
  author: User
  
  # Review content
  rating: Int! # 1-5
  title: String
  content: String!
  pros: [String!]!
  cons: [String!]!
  
  # Media
  photos: [Photo!]!
  
  # Metadata
  createdAt: DateTime!
  updatedAt: DateTime!
  visitDate: Date
  verified: Boolean!
  
  # Engagement
  helpfulCount: Int!
  unhelpfulCount: Int!
  userHelpfulness: HelpfulnessVote @auth
  
  # Business response
  response: ReviewResponse
  
  # Moderation
  flagged: Boolean! @admin
  moderationStatus: ModerationStatus! @admin
}

type ReviewResponse {
  id: ID!
  review: Review!
  business: Business!
  author: User!
  content: String!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type ReviewConnection {
  edges: [ReviewEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
  averageRating: Float!
  ratingDistribution: RatingDistribution!
}

type RatingDistribution {
  oneStar: Int!
  twoStars: Int!
  threeStars: Int!
  fourStars: Int!
  fiveStars: Int!
}
```

### Query and Mutation Definitions

```graphql
type Query {
  # Business queries
  business(id: ID, slug: String): Business
  businesses(
    first: Int = 20
    after: String
    filter: BusinessFilter
    sort: BusinessSort = RELEVANCE
  ): BusinessConnection!
  
  # Search
  searchBusinesses(
    query: String!
    location: LocationInput
    radius: Float = 10
    filters: BusinessFilter
  ): BusinessSearchResult!
  
  # Location-based queries
  nearbyBusinesses(
    location: LocationInput!
    radius: Float = 5
    category: String
  ): [Business!]!
  
  # Categories
  categories(parent: ID): [Category!]!
  category(id: ID, slug: String): Category
  
  # Reviews
  review(id: ID!): Review
  reviews(
    businessId: ID
    authorId: ID
    first: Int = 20
    after: String
    sort: ReviewSort = NEWEST
  ): ReviewConnection!
  
  # User
  user(id: ID!): User @auth
  currentUser: User @auth
}

type Mutation {
  # Business management
  createBusiness(input: CreateBusinessInput!): CreateBusinessPayload! @auth
  updateBusiness(id: ID!, input: UpdateBusinessInput!): UpdateBusinessPayload! @auth
  deleteBusiness(id: ID!): DeleteBusinessPayload! @auth
  claimBusiness(id: ID!, proof: BusinessClaimProof!): ClaimBusinessPayload! @auth
  
  # Media management
  uploadBusinessPhoto(businessId: ID!, file: Upload!, category: PhotoCategory): Photo! @auth
  deleteBusinessPhoto(businessId: ID!, photoId: ID!): DeletePhotoPayload! @auth
  
  # Review management
  createReview(input: CreateReviewInput!): CreateReviewPayload! @auth
  updateReview(id: ID!, input: UpdateReviewInput!): UpdateReviewPayload! @auth
  deleteReview(id: ID!): DeleteReviewPayload! @auth
  
  # Review responses
  createReviewResponse(reviewId: ID!, content: String!): ReviewResponse! @auth
  updateReviewResponse(id: ID!, content: String!): ReviewResponse! @auth
  deleteReviewResponse(id: ID!): DeleteReviewResponsePayload! @auth
  
  # Review engagement
  markReviewHelpful(reviewId: ID!, helpful: Boolean!): Review! @auth
  reportReview(reviewId: ID!, reason: ReportReason!, details: String): ReportPayload! @auth
}

type Subscription {
  # Business updates
  businessUpdated(businessId: ID!): Business!
  businessVerified(businessId: ID!): Business!
  
  # Review updates
  newReview(businessId: ID!): Review!
  reviewUpdated(reviewId: ID!): Review!
  newReviewResponse(businessId: ID!): ReviewResponse!
  
  # Analytics updates (for business owners)
  businessAnalyticsUpdated(businessId: ID!): BusinessAnalytics! @auth
}
```

## Dependencies

- ✅ Story 6.3: Business management API for mutation operations
- ✅ Story 6.1: API authentication system

## Testing Requirements

### GraphQL Functionality Tests
- [ ] Complete schema query and mutation testing
- [ ] Subscription functionality and real-time update testing
- [ ] Query optimization and performance validation
- [ ] Authentication and authorization testing

### Performance Tests
- [ ] Query performance optimization and N+1 prevention
- [ ] Subscription performance under high load
- [ ] Complex query handling and timeout testing
- [ ] Database query efficiency for GraphQL resolvers

### Security Tests
- [ ] Query complexity and depth limiting validation
- [ ] Authentication bypass testing for GraphQL endpoints
- [ ] Authorization enforcement at field level
- [ ] Input validation and injection prevention

## Definition of Done

- [ ] Complete GraphQL schema with all business directory types
- [ ] Query, mutation, and subscription operations implemented
- [ ] Advanced GraphQL features (DataLoader, complexity analysis)
- [ ] GraphQL Playground and developer tools
- [ ] Authentication and field-level authorization
- [ ] Performance optimization for GraphQL queries
- [ ] Real-time subscription functionality
- [ ] GraphQL API documentation and examples
- [ ] All GraphQL functionality tests passing
- [ ] Integration with existing REST API authentication

## Risk Assessment

**High Risk:** Complex GraphQL queries may impact database performance  
**Medium Risk:** Real-time subscription scalability challenges  
**Mitigation:** Query complexity limiting and performance monitoring

## Success Metrics

- GraphQL query response time < 100ms for simple queries
- Subscription connection success rate > 99%
- Query complexity analysis preventing DoS attacks
- GraphQL API adoption rate > 30% of API users
- Real-time update delivery latency < 2 seconds

## GraphQL Performance Optimizations

### DataLoader Implementation

```typescript
// Business DataLoader for efficient database queries
const businessLoader = new DataLoader(async (businessIds: string[]) => {
  const businesses = await Business.findByIds(businessIds)
  return businessIds.map(id => 
    businesses.find(business => business.id === id)
  )
})

// Review DataLoader with caching
const reviewLoader = new DataLoader(async (businessIds: string[]) => {
  const reviews = await Review.findByBusinessIds(businessIds)
  return businessIds.map(id => 
    reviews.filter(review => review.businessId === id)
  )
}, {
  cache: true,
  maxBatchSize: 100
})
```

### Query Complexity Analysis

```typescript
// Query complexity calculation
const complexityAnalysis = {
  maximumComplexity: 1000,
  variables: {},
  createError: (max: number, actual: number) => {
    return new Error(`Query complexity ${actual} exceeds maximum ${max}`)
  },
  estimators: [
    fieldExtensionsEstimator(),
    simpleEstimator({ defaultComplexity: 1 })
  ]
}
```

## Subscription Implementation

### WebSocket Setup

```typescript
// GraphQL subscription server setup
const subscriptionServer = new SubscriptionServer({
  execute,
  subscribe,
  schema,
  onConnect: async (connectionParams: any) => {
    // Authenticate WebSocket connections
    const token = connectionParams.authorization
    const user = await authenticateToken(token)
    return { user }
  },
  onDisconnect: () => {
    console.log('Client disconnected from subscriptions')
  }
}, {
  server: httpServer,
  path: '/graphql-subscriptions'
})
```

### Real-time Event Publishing

```typescript
// Event publishing for subscriptions
const pubsub = new RedisPubSub({
  connection: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
  }
})

// Publish business update events
export const publishBusinessUpdate = (business: Business) => {
  pubsub.publish(`BUSINESS_UPDATED_${business.id}`, {
    businessUpdated: business
  })
}
```

## Notes

This story provides modern applications with flexible data querying capabilities through GraphQL while maintaining the existing RESTful API. The focus on performance optimization, real-time subscriptions, and developer experience enables sophisticated client applications with efficient data fetching patterns.

**Created:** 2024-08-24  
**Last Updated:** 2024-08-24  
**Status:** Ready for Implementation