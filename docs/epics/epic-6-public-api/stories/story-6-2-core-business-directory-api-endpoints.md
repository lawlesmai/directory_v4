# Story 6.2: Core Business Directory API Endpoints

**Epic:** Epic 6 - Public API Platform  
**Story ID:** 6.2  
**Story Title:** Core Business Directory API Endpoints  
**Priority:** P0 (Critical)  
**Assignee:** Backend Architect Agent  
**Story Points:** 30  
**Sprint:** 1

## User Story

**As a** developer integrating with The Lawless Directory  
**I want** comprehensive API endpoints for business data access  
**So that** I can build applications that leverage the business directory information

## Epic Context

This story implements the core business directory API endpoints that provide comprehensive access to business listings, reviews, categories, and analytics data. These endpoints form the foundation of the public API, enabling third-party developers to access and integrate business directory data into their applications.

## Acceptance Criteria

### Business Listing API Endpoints

**Given** developers need access to business directory data  
**When** implementing core business endpoints  
**Then** provide comprehensive business data access:

#### Business Retrieval Endpoints

```http
GET /api/v1/businesses
- List businesses with pagination and filtering
- Query parameters: category, location, rating, verified, premium
- Pagination: offset/limit and cursor-based options
- Sorting: name, rating, distance, created_date
- Response includes: basic business info, location, rating, images

GET /api/v1/businesses/{id}
- Retrieve detailed business information
- Includes: full profile, hours, contact info, photos, reviews
- Conditional requests with ETag for caching
- Related businesses and recommendations

GET /api/v1/businesses/search
- Advanced business search with multiple criteria
- Full-text search across name, description, tags
- Geographic search with radius and coordinates
- Faceted search results with category breakdowns
```

#### Category & Location Endpoints

```http
GET /api/v1/categories
- List all business categories with hierarchy
- Category metadata: count, description, icon
- Subcategory relationships and tree structure

GET /api/v1/locations
- Geographic location data and hierarchy
- City, state, country breakdown with business counts
- Location suggestions for autocomplete

GET /api/v1/businesses/nearby
- Location-based business discovery
- GPS coordinate or address-based search
- Configurable radius and result limits
```

### Review & Rating API Endpoints

**Given** review data access requirements  
**When** implementing review endpoints  
**Then** provide comprehensive review functionality:

#### Review Data Access

```http
GET /api/v1/businesses/{id}/reviews
- List reviews for specific business
- Pagination, sorting (date, rating, helpfulness)
- Review filtering by rating, date range
- Includes: reviewer info, rating, content, response

GET /api/v1/reviews/{id}
- Detailed review information
- Review responses and interactions
- Review verification status and authenticity

POST /api/v1/businesses/{id}/reviews (Authenticated)
- Submit new business review
- Rating, title, content, photos
- Review validation and moderation queue
```

### Business Analytics & Insights

**Given** business performance data needs  
**When** providing analytics endpoints  
**Then** implement analytics access:

#### Public Analytics

```http
GET /api/v1/businesses/{id}/stats
- Public business statistics
- View counts, click-through rates
- Rating trends and review volume
- Engagement metrics (where privacy-compliant)

GET /api/v1/analytics/trends
- Market trends and category insights
- Popular businesses and emerging categories
- Geographic business distribution
- Seasonal patterns and growth metrics
```

### Advanced Search & Filtering

**Given** complex search requirements  
**When** implementing advanced search capabilities  
**Then** provide sophisticated search features:

#### Search Capabilities
- ✅ Multi-field search with weighted relevance
- ✅ Autocomplete and suggestion endpoints
- ✅ Fuzzy search for handling typos and variations
- ✅ Search result highlighting and snippet extraction
- ✅ Search analytics and popular queries
- ✅ Saved search functionality for authenticated users
- ✅ Real-time search suggestions with debounced requests

## Technical Implementation

### Database Optimization
- **Indexes:** Efficient database indexes for search and filtering
- **Queries:** Query optimization for complex business searches
- **Pooling:** Database connection pooling for high concurrency
- **Replicas:** Read replica usage for API queries

### Response Optimization
- **Compression:** JSON response compression (gzip)
- **Fields:** Selective field inclusion with field parameters
- **Caching:** Response caching with appropriate cache headers
- **CDN:** Image URL generation with CDN integration

### Search Implementation
- **Engine:** Elasticsearch integration for full-text search
- **Geography:** Geographic search with PostGIS or similar
- **Ranking:** Search result ranking algorithm
- **Monitoring:** Search performance monitoring and optimization

## API Endpoint Specifications

### Business Endpoints

#### List Businesses
```yaml
GET /api/v1/businesses:
  parameters:
    - name: category
      type: string
      description: Filter by business category
    - name: location
      type: string
      description: Filter by location (city, state, zip)
    - name: rating
      type: number
      description: Minimum rating filter (1-5)
    - name: verified
      type: boolean
      description: Filter verified businesses only
    - name: premium
      type: boolean
      description: Filter premium listings only
    - name: limit
      type: integer
      description: Number of results per page (max 100)
    - name: offset
      type: integer
      description: Pagination offset
    - name: sort
      type: string
      enum: [name, rating, distance, created_date]
      description: Sort order for results
  responses:
    200:
      description: List of businesses
      schema:
        type: object
        properties:
          businesses:
            type: array
            items:
              $ref: '#/components/schemas/BusinessSummary'
          pagination:
            $ref: '#/components/schemas/PaginationInfo'
          facets:
            $ref: '#/components/schemas/SearchFacets'
```

#### Get Business Details
```yaml
GET /api/v1/businesses/{id}:
  parameters:
    - name: id
      type: string
      required: true
      description: Business ID
    - name: include
      type: array
      items:
        type: string
        enum: [reviews, photos, hours, analytics]
      description: Additional data to include
  responses:
    200:
      description: Detailed business information
      schema:
        $ref: '#/components/schemas/BusinessDetail'
    404:
      description: Business not found
```

### Search Endpoints

#### Advanced Business Search
```yaml
GET /api/v1/businesses/search:
  parameters:
    - name: q
      type: string
      required: true
      description: Search query
    - name: location
      type: object
      properties:
        lat: number
        lng: number
        radius: number
      description: Geographic search parameters
    - name: filters
      type: object
      properties:
        categories: array
        rating_min: number
        price_range: array
        open_now: boolean
      description: Advanced filters
  responses:
    200:
      description: Search results with facets
      schema:
        type: object
        properties:
          results:
            type: array
            items:
              $ref: '#/components/schemas/BusinessSearchResult'
          facets:
            $ref: '#/components/schemas/SearchFacets'
          suggestions:
            type: array
            items:
              type: string
```

### Review Endpoints

#### Get Business Reviews
```yaml
GET /api/v1/businesses/{id}/reviews:
  parameters:
    - name: id
      type: string
      required: true
    - name: sort
      type: string
      enum: [newest, oldest, highest_rating, lowest_rating, most_helpful]
    - name: rating_filter
      type: integer
      minimum: 1
      maximum: 5
    - name: limit
      type: integer
      maximum: 50
      default: 20
  responses:
    200:
      description: List of reviews
      schema:
        type: object
        properties:
          reviews:
            type: array
            items:
              $ref: '#/components/schemas/Review'
          summary:
            $ref: '#/components/schemas/ReviewSummary'
```

## Dependencies

- ✅ Story 6.1: API architecture and authentication
- ✅ Epic 1 Story 1.5: Business data and search infrastructure

## Testing Requirements

### API Endpoint Tests
- [ ] Complete CRUD operation testing for all endpoints
- [ ] Query parameter validation and filtering tests
- [ ] Pagination and sorting functionality validation
- [ ] Search accuracy and performance testing

### Data Integrity Tests
- [ ] Business data consistency across endpoints
- [ ] Review data accuracy and privacy compliance
- [ ] Category and location data hierarchy validation
- [ ] Analytics data calculation accuracy

### Performance Tests
- [ ] API response time optimization (<200ms target)
- [ ] High-concurrency endpoint testing
- [ ] Database query performance optimization
- [ ] Search performance and accuracy testing

## Definition of Done

- [ ] Complete business directory API endpoints implemented
- [ ] Review and rating API functionality operational
- [ ] Advanced search and filtering capabilities
- [ ] Business analytics and insights endpoints
- [ ] Comprehensive API documentation with examples
- [ ] Performance optimization meeting response time targets
- [ ] Data privacy and security compliance validation
- [ ] API endpoint testing coverage >90%
- [ ] OpenAPI specification updated and validated
- [ ] Developer experience testing completed

## Risk Assessment

**Medium Risk:** Complex search functionality may impact performance  
**Low Risk:** Standard CRUD API implementation  
**Mitigation:** Performance monitoring and optimization, search result caching

## Success Metrics

- API response time 95th percentile < 200ms
- Search accuracy rate > 95%
- Business data completeness > 98%
- API endpoint uptime > 99.9%
- Developer satisfaction with endpoint coverage > 4.5/5

## Data Models

### BusinessSummary Schema
```json
{
  "id": "string",
  "name": "string",
  "category": "string",
  "location": {
    "address": "string",
    "city": "string",
    "state": "string",
    "zip": "string",
    "coordinates": {
      "lat": "number",
      "lng": "number"
    }
  },
  "rating": "number",
  "review_count": "integer",
  "verified": "boolean",
  "premium": "boolean",
  "photos": ["string"],
  "hours": "object",
  "contact": {
    "phone": "string",
    "website": "string",
    "email": "string"
  }
}
```

### Review Schema
```json
{
  "id": "string",
  "business_id": "string",
  "author": {
    "name": "string",
    "avatar": "string",
    "verified": "boolean"
  },
  "rating": "integer",
  "title": "string",
  "content": "string",
  "photos": ["string"],
  "created_at": "datetime",
  "updated_at": "datetime",
  "helpful_count": "integer",
  "response": {
    "content": "string",
    "author": "string",
    "created_at": "datetime"
  }
}
```

## Notes

This story establishes the core API endpoints that enable comprehensive access to business directory data. The focus on search functionality, performance optimization, and data richness ensures developers have the tools needed to build compelling applications on top of The Lawless Directory platform.

**Created:** 2024-08-24  
**Last Updated:** 2024-08-24  
**Status:** Ready for Implementation