# Story 6.7: API Subscription Tiers & Billing Integration

**Epic:** Epic 6 - Public API Platform  
**Story ID:** 6.7  
**Story Title:** API Subscription Tiers & Billing Integration  
**Priority:** P0 (Critical)  
**Assignee:** Backend Architect Agent  
**Story Points:** 25  
**Sprint:** 3

## User Story

**As an** API product manager  
**I want** a sophisticated API subscription tier system with usage-based billing  
**So that** we can monetize the API effectively while providing clear value at different price points

## Epic Context

This story implements a comprehensive subscription tier system for The Lawless Directory API, with usage-based billing, access control, and developer subscription management. The system enables multiple pricing tiers from free to enterprise, with automatic usage tracking, overage billing, and tier-based feature access control.

## Acceptance Criteria

### API Subscription Tier Management

**Given** different developer needs and usage patterns  
**When** implementing API subscription tiers  
**Then** create comprehensive tier management:

#### Subscription Tier Definition

```
Free Tier ($0/month)
├── 1,000 API requests per month
├── Basic endpoints (businesses, search, reviews - read only)
├── Rate limit: 10 requests/minute
├── Community support only
└── Attribution required in applications

Starter Tier ($29/month)
├── 10,000 API requests per month
├── All Free tier endpoints + analytics
├── Basic webhook subscriptions
├── Rate limit: 50 requests/minute
├── Email support (48-hour response)
└── Overage: $0.005 per additional request

Professional Tier ($99/month)
├── 100,000 API requests per month
├── All Starter tier + write operations
├── Advanced webhooks and real-time subscriptions
├── GraphQL API access
├── Rate limit: 200 requests/minute
├── Priority support (24-hour response)
└── Overage: $0.003 per additional request

Enterprise Tier (Custom pricing)
├── Unlimited API requests (fair use policy)
├── All Professional tier + custom endpoints
├── Dedicated infrastructure and SLA
├── White-label API solutions
├── Custom rate limits and features
├── Dedicated support manager
└── Custom billing terms
```

### Usage-Based Billing System

**Given** API usage tracking and billing requirements  
**When** implementing usage-based billing  
**Then** create comprehensive billing management:

#### Usage Tracking & Metering
- ✅ Real-time API request counting and tracking
- ✅ Usage aggregation by billing period
- ✅ Overage calculation and billing preparation
- ✅ Usage analytics and forecasting for customers
- ✅ Fair use policy monitoring and enforcement
- ✅ Usage alerts and notifications for approaching limits
- ✅ Historical usage data retention and reporting

#### Billing Integration with Stripe
- ✅ Stripe subscription management integration
- ✅ Usage-based billing with metered subscriptions
- ✅ Automated overage charge calculation
- ✅ Proration handling for plan changes mid-cycle
- ✅ Invoice generation with usage details
- ✅ Payment failure handling for API subscriptions
- ✅ Dunning management for failed API payments

### API Access Control & Rate Limiting

**Given** subscription tier enforcement requirements  
**When** controlling API access  
**Then** implement comprehensive access control:

#### Tier-Based Access Control
- ✅ API endpoint access based on subscription tier
- ✅ Feature flag integration for tier-specific functionality
- ✅ GraphQL field-level access control by tier
- ✅ Webhook subscription limits by tier
- ✅ Real-time access validation and enforcement
- ✅ Subscription status integration with API gateway
- ✅ Grace period handling for expired subscriptions

#### Dynamic Rate Limiting
- ✅ Subscription tier-based rate limiting
- ✅ Burst allowances and token bucket implementation
- ✅ Rate limit headers in API responses
- ✅ Rate limit violation handling and notifications
- ✅ Custom rate limits for enterprise customers
- ✅ Time-window based limiting (per minute, hour, day)
- ✅ Rate limit analytics and optimization

### Developer Subscription Management

**Given** developers managing their API subscriptions  
**When** providing subscription management tools  
**Then** implement self-service capabilities:

#### Developer Portal Integration
- ✅ Current subscription status and usage display
- ✅ Plan comparison and upgrade/downgrade options
- ✅ Usage analytics and trend analysis
- ✅ Billing history and invoice access
- ✅ Payment method management
- ✅ Subscription cancellation and reactivation
- ✅ Usage alerts and limit notifications

## Technical Implementation

### Billing System Integration
- **Stripe Integration:** Stripe API integration for subscription and usage billing
- **Background Processing:** Background job processing for usage aggregation
- **Usage Tracking:** Real-time usage tracking with efficient storage
- **Payment Infrastructure:** Integration with existing payment infrastructure

### Access Control Implementation
- **API Gateway:** API gateway integration for tier-based access control
- **Rate Limiting:** Redis-based rate limiting with distributed counters
- **Subscription Status:** Real-time subscription status checking
- **Caching:** Efficient access control caching

### Usage Tracking Architecture
- **Performance:** High-performance usage counting system
- **Storage:** Time-series data storage for usage analytics
- **Aggregation:** Efficient usage aggregation and reporting
- **Monitoring:** Real-time usage monitoring and alerting

## Subscription Management Architecture

### Tier Configuration

```typescript
interface SubscriptionTier {
  id: string
  name: string
  price: number // Monthly price in cents
  currency: string
  requestLimit: number // Monthly requests
  rateLimit: {
    requestsPerMinute: number
    requestsPerHour: number
    requestsPerDay: number
  }
  features: {
    readAccess: boolean
    writeAccess: boolean
    analytics: boolean
    webhooks: boolean
    graphql: boolean
    priority_support: boolean
    sla: boolean
  }
  overage: {
    enabled: boolean
    pricePerRequest: number // In cents
    threshold: number // Percentage of limit before charging
  }
}

const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'USD',
    requestLimit: 1000,
    rateLimit: {
      requestsPerMinute: 10,
      requestsPerHour: 100,
      requestsPerDay: 1000
    },
    features: {
      readAccess: true,
      writeAccess: false,
      analytics: false,
      webhooks: false,
      graphql: false,
      priority_support: false,
      sla: false
    },
    overage: {
      enabled: false,
      pricePerRequest: 0,
      threshold: 0
    }
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 2900, // $29.00
    currency: 'USD',
    requestLimit: 10000,
    rateLimit: {
      requestsPerMinute: 50,
      requestsPerHour: 1000,
      requestsPerDay: 10000
    },
    features: {
      readAccess: true,
      writeAccess: false,
      analytics: true,
      webhooks: true,
      graphql: false,
      priority_support: false,
      sla: false
    },
    overage: {
      enabled: true,
      pricePerRequest: 0.5, // $0.005
      threshold: 80
    }
  }
  // ... Professional and Enterprise tiers
]
```

### Usage Tracking System

```typescript
// Usage tracking service
class UsageTracker {
  private redis: Redis
  private db: Database
  
  async recordRequest(apiKeyId: string, endpoint: string, timestamp: Date) {
    const month = timestamp.toISOString().substr(0, 7) // YYYY-MM
    const day = timestamp.toISOString().substr(0, 10) // YYYY-MM-DD
    const hour = timestamp.toISOString().substr(0, 13) // YYYY-MM-DDTHH
    
    // Increment counters at different granularities
    await Promise.all([
      this.redis.incr(`usage:${apiKeyId}:${month}`),
      this.redis.incr(`usage:${apiKeyId}:${day}`),
      this.redis.incr(`usage:${apiKeyId}:${hour}`),
      this.redis.incr(`usage:${apiKeyId}:endpoint:${endpoint}:${month}`)
    ])
    
    // Set expiration for cleanup
    await Promise.all([
      this.redis.expire(`usage:${apiKeyId}:${hour}`, 86400 * 7), // 7 days
      this.redis.expire(`usage:${apiKeyId}:${day}`, 86400 * 90) // 90 days
    ])
    
    // Check if usage alerts should be sent
    await this.checkUsageAlerts(apiKeyId, month)
  }
  
  async getCurrentUsage(apiKeyId: string): Promise<UsageStats> {
    const month = new Date().toISOString().substr(0, 7)
    
    const [monthlyUsage, dailyUsage, hourlyUsage] = await Promise.all([
      this.redis.get(`usage:${apiKeyId}:${month}`),
      this.redis.get(`usage:${apiKeyId}:${new Date().toISOString().substr(0, 10)}`),
      this.redis.get(`usage:${apiKeyId}:${new Date().toISOString().substr(0, 13)}`)
    ])
    
    return {
      monthly: parseInt(monthlyUsage || '0'),
      daily: parseInt(dailyUsage || '0'),
      hourly: parseInt(hourlyUsage || '0')
    }
  }
  
  private async checkUsageAlerts(apiKeyId: string, month: string) {
    const usage = await this.getCurrentUsage(apiKeyId)
    const subscription = await this.getSubscription(apiKeyId)
    const tier = SUBSCRIPTION_TIERS.find(t => t.id === subscription.tierId)
    
    if (!tier) return
    
    const usagePercentage = usage.monthly / tier.requestLimit
    
    // Send alerts at 80% and 95% usage
    if (usagePercentage >= 0.8) {
      await this.sendUsageAlert(apiKeyId, usagePercentage, tier)
    }
  }
}
```

### Rate Limiting Implementation

```typescript
// Rate limiting middleware
class RateLimiter {
  private redis: Redis
  
  async checkRateLimit(apiKeyId: string, tierId: string): Promise<RateLimitResult> {
    const tier = SUBSCRIPTION_TIERS.find(t => t.id === tierId)
    if (!tier) throw new Error('Invalid subscription tier')
    
    const now = Date.now()
    const windowSizeMs = 60000 // 1 minute
    const key = `rate_limit:${apiKeyId}:${Math.floor(now / windowSizeMs)}`
    
    // Use sliding window rate limiting
    const pipeline = this.redis.pipeline()
    pipeline.incr(key)
    pipeline.expire(key, 60)
    const results = await pipeline.exec()
    
    const count = results[0][1] as number
    const remaining = Math.max(0, tier.rateLimit.requestsPerMinute - count)
    const resetTime = Math.ceil(now / windowSizeMs) * windowSizeMs
    
    return {
      allowed: count <= tier.rateLimit.requestsPerMinute,
      limit: tier.rateLimit.requestsPerMinute,
      remaining,
      resetTime,
      retryAfter: remaining === 0 ? Math.ceil((resetTime - now) / 1000) : null
    }
  }
}
```

### Billing Integration

```typescript
// Stripe billing integration
class BillingService {
  private stripe: Stripe
  
  async createSubscription(customerId: string, tierId: string): Promise<Subscription> {
    const tier = SUBSCRIPTION_TIERS.find(t => t.id === tierId)
    if (!tier) throw new Error('Invalid tier')
    
    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price: tier.stripePriceId,
          quantity: 1
        }
      ],
      metadata: {
        tierId: tier.id,
        apiProduct: 'directory-api'
      }
    })
    
    return subscription
  }
  
  async recordUsageForBilling(subscriptionId: string, usage: number) {
    // For usage-based billing with Stripe
    const subscriptionItem = await this.getSubscriptionItem(subscriptionId)
    
    await this.stripe.subscriptionItems.createUsageRecord(subscriptionItem.id, {
      quantity: usage,
      timestamp: Math.floor(Date.now() / 1000),
      action: 'set' // Set the total usage for the period
    })
  }
  
  async calculateOverageCharges(customerId: string, usage: number, limit: number, tier: SubscriptionTier): Promise<number> {
    if (!tier.overage.enabled || usage <= limit) return 0
    
    const overageRequests = usage - limit
    return Math.round(overageRequests * tier.overage.pricePerRequest)
  }
}
```

## API Access Control Middleware

```typescript
// Access control middleware
const apiAccessControl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers['x-api-key'] as string
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' })
    }
    
    // Get API key and subscription info
    const keyInfo = await getAPIKeyInfo(apiKey)
    if (!keyInfo || !keyInfo.active) {
      return res.status(401).json({ error: 'Invalid or inactive API key' })
    }
    
    // Check subscription status
    const subscription = await getSubscription(keyInfo.userId)
    if (!subscription || subscription.status !== 'active') {
      return res.status(402).json({ error: 'Subscription required or payment overdue' })
    }
    
    // Check feature access
    const tier = SUBSCRIPTION_TIERS.find(t => t.id === subscription.tierId)
    const endpoint = req.route.path
    
    if (!hasEndpointAccess(endpoint, tier, req.method)) {
      return res.status(403).json({ 
        error: 'Endpoint not available in current tier',
        tier: tier.name,
        upgradeUrl: '/developer/billing/upgrade'
      })
    }
    
    // Check rate limits
    const rateLimitResult = await rateLimiter.checkRateLimit(keyInfo.id, tier.id)
    
    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': rateLimitResult.limit.toString(),
      'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
    })
    
    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: rateLimitResult.retryAfter
      })
    }
    
    // Record usage
    await usageTracker.recordRequest(keyInfo.id, endpoint, new Date())
    
    // Add subscription context to request
    req.apiKey = keyInfo
    req.subscription = subscription
    req.tier = tier
    
    next()
  } catch (error) {
    console.error('API access control error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
```

## Dependencies

- ✅ Story 6.6: API analytics for usage tracking
- ✅ Epic 5 Story 5.2: Subscription billing infrastructure

## Testing Requirements

### Billing Integration Tests
- [ ] Usage-based billing accuracy validation
- [ ] Stripe integration and webhook processing tests
- [ ] Overage calculation and charging accuracy
- [ ] Subscription tier change and proration testing

### Access Control Tests
- [ ] Tier-based API access enforcement testing
- [ ] Rate limiting accuracy and fairness testing
- [ ] Subscription status integration validation
- [ ] Grace period and suspension handling tests

### Usage Tracking Tests
- [ ] Usage counting accuracy and performance tests
- [ ] Usage aggregation and reporting accuracy
- [ ] Real-time usage monitoring validation
- [ ] Historical usage data integrity tests

## Definition of Done

- [ ] Complete API subscription tier system implemented
- [ ] Usage-based billing with Stripe integration
- [ ] Tier-based API access control and rate limiting
- [ ] Developer portal subscription management
- [ ] Real-time usage tracking and analytics
- [ ] Overage billing and notification system
- [ ] Subscription status integration with API gateway
- [ ] Performance optimization for usage tracking
- [ ] All billing and access control tests passing
- [ ] Documentation complete for API billing procedures

## Risk Assessment

**Medium Risk:** Complex usage tracking may impact API performance  
**High Risk:** Billing accuracy is critical for revenue and customer trust  
**Mitigation:** Comprehensive testing and monitoring for billing accuracy

## Success Metrics

- Billing accuracy rate > 99.9%
- Usage tracking precision > 99.95%
- Rate limiting effectiveness > 99%
- Subscription conversion rate > 15%
- Customer billing satisfaction > 4.5/5
- Payment processing uptime > 99.9%

## Revenue Forecasting Model

### Subscription Revenue Projection

```typescript
interface RevenueProjection {
  free: {
    users: number
    conversionRate: number // To paid tiers
  }
  starter: {
    users: number
    averageUsage: number
    overageRevenue: number
  }
  professional: {
    users: number
    averageUsage: number
    overageRevenue: number
  }
  enterprise: {
    users: number
    averageContractValue: number
  }
  totals: {
    monthlyRecurring: number
    usageBased: number
    projected12Month: number
  }
}
```

### Customer Success Metrics

```typescript
interface CustomerSuccessMetrics {
  retention: {
    monthly: number
    annual: number
  }
  expansion: {
    upgradeRate: number
    averageRevenuePerUser: number
  }
  satisfaction: {
    nps: number
    supportRating: number
    featureUsage: number
  }
}
```

## Notes

This story establishes a comprehensive subscription and billing system that enables effective API monetization while providing clear value propositions at each tier. The focus on usage-based billing, real-time access control, and developer self-service ensures a scalable and user-friendly API business model.

**Created:** 2024-08-24  
**Last Updated:** 2024-08-24  
**Status:** Ready for Implementation