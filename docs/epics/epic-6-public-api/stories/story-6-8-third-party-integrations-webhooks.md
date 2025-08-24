# Story 6.8: Third-Party Integrations & Webhooks

**Epic:** Epic 6 - Public API Platform  
**Story ID:** 6.8  
**Story Title:** Third-Party Integrations & Webhooks  
**Priority:** P1 (High)  
**Assignee:** Backend Architect Agent  
**Story Points:** 25  
**Sprint:** 3

## User Story

**As a** developer building applications that need real-time updates  
**I want** comprehensive webhook functionality and third-party integrations  
**So that** my application can respond to business directory changes and integrate with external services

## Epic Context

This story implements a comprehensive webhook system and popular third-party integrations, enabling real-time notifications and seamless data synchronization with external platforms. The webhook system provides reliable, secure delivery of business directory events, while pre-built integrations reduce development time for common use cases.

## Acceptance Criteria

### Comprehensive Webhook System

**Given** developers needing real-time notifications  
**When** implementing webhook functionality  
**Then** provide comprehensive webhook capabilities:

#### Webhook Event Types

```javascript
Business Events:
- business.created: New business listing added
- business.updated: Business profile changes
- business.verified: Business verification status change
- business.deleted: Business listing removal

Review Events:
- review.created: New review submission
- review.updated: Review content or rating changes
- review.responded: Business owner response added
- review.moderated: Review moderation decision

User Events:
- user.registered: New user account creation
- user.subscription_changed: Subscription tier changes

System Events:
- api.rate_limit_exceeded: Rate limit violations
- api.quota_warning: Usage approaching limits
```

#### Webhook Configuration & Management
- ✅ Webhook endpoint registration and validation
- ✅ Event type selection and filtering
- ✅ Custom payload configuration and field selection
- ✅ Webhook signing for security and authenticity verification
- ✅ Retry logic with exponential backoff
- ✅ Webhook failure handling and alerting
- ✅ Webhook testing and simulation tools

### Webhook Delivery & Reliability

**Given** reliable webhook delivery requirements  
**When** sending webhook notifications  
**Then** ensure reliable delivery:

#### Delivery Optimization
- ✅ Asynchronous webhook delivery with queue processing
- ✅ Retry attempts with intelligent backoff strategies
- ✅ Dead letter queue for failed webhook deliveries
- ✅ Webhook delivery analytics and success rate tracking
- ✅ Webhook endpoint health monitoring
- ✅ Batch webhook delivery for high-volume events
- ✅ Webhook delivery SLA and performance guarantees

#### Security & Authentication
- ✅ HMAC signature verification for webhook authenticity
- ✅ IP whitelisting for webhook endpoints
- ✅ SSL/TLS requirement for webhook URLs
- ✅ Webhook secret management and rotation
- ✅ Webhook payload encryption for sensitive data
- ✅ Rate limiting for webhook deliveries
- ✅ Webhook access logging and audit trails

### Third-Party Service Integrations

**Given** popular third-party service integration needs  
**When** providing pre-built integrations  
**Then** implement common integrations:

#### CRM System Integrations
- ✅ Salesforce integration for lead management
- ✅ HubSpot integration for customer relationship management
- ✅ Pipedrive integration for sales pipeline management
- ✅ Custom CRM webhook endpoints and data mapping
- ✅ Business lead qualification and routing
- ✅ Customer data synchronization and updates
- ✅ Sales opportunity tracking and analytics

#### Marketing Platform Integrations
- ✅ Mailchimp integration for email marketing
- ✅ Zapier integration for workflow automation
- ✅ Google Sheets integration for data export
- ✅ Slack integration for team notifications
- ✅ Microsoft Teams integration for business updates
- ✅ Social media platform integrations (Twitter, Facebook)
- ✅ Marketing automation trigger events

### Webhook Developer Tools

**Given** developers implementing webhook integrations  
**When** providing development tools  
**Then** offer comprehensive webhook tools:

#### Testing & Debugging Tools
- ✅ Webhook testing console with event simulation
- ✅ Webhook delivery log viewer with detailed information
- ✅ Webhook payload inspector and validator
- ✅ Ngrok-style tunnel service for local development
- ✅ Webhook event replay functionality
- ✅ Performance testing tools for webhook endpoints
- ✅ Webhook integration examples and templates

## Technical Implementation

### Webhook Infrastructure
- **Queue System:** Message queue system for reliable webhook delivery
- **Background Jobs:** Background job processing for webhook notifications
- **Retry Logic:** Webhook retry logic with exponential backoff
- **Analytics:** Webhook delivery monitoring and analytics

### Integration Framework
- **Architecture:** Plugin architecture for third-party service integrations
- **Authentication:** OAuth integration for third-party service authentication
- **Transformation:** Data transformation and mapping capabilities
- **Monitoring:** Integration health monitoring and alerting

### Security Implementation
- **HMAC:** HMAC signature generation and verification
- **Secrets:** Webhook secret management and rotation
- **SSL:** SSL certificate validation for webhook endpoints
- **Logging:** Request logging and security monitoring

## Webhook System Architecture

### Event System Design

```typescript
// Webhook event system
interface WebhookEvent {
  id: string
  type: WebhookEventType
  version: string
  timestamp: Date
  data: any
  metadata?: Record<string, any>
}

enum WebhookEventType {
  BUSINESS_CREATED = 'business.created',
  BUSINESS_UPDATED = 'business.updated',
  BUSINESS_VERIFIED = 'business.verified',
  BUSINESS_DELETED = 'business.deleted',
  REVIEW_CREATED = 'review.created',
  REVIEW_UPDATED = 'review.updated',
  REVIEW_RESPONDED = 'review.responded',
  REVIEW_MODERATED = 'review.moderated',
  USER_REGISTERED = 'user.registered',
  USER_SUBSCRIPTION_CHANGED = 'user.subscription_changed',
  API_RATE_LIMIT_EXCEEDED = 'api.rate_limit_exceeded',
  API_QUOTA_WARNING = 'api.quota_warning'
}

// Webhook subscription configuration
interface WebhookSubscription {
  id: string
  userId: string
  endpointUrl: string
  secret: string
  events: WebhookEventType[]
  active: boolean
  filters?: WebhookFilter[]
  retryConfig: RetryConfig
  headers?: Record<string, string>
  createdAt: Date
  updatedAt: Date
}

interface WebhookFilter {
  field: string
  operator: 'equals' | 'contains' | 'in' | 'exists'
  value: any
}

interface RetryConfig {
  maxRetries: number
  backoffMultiplier: number
  maxBackoffSeconds: number
}
```

### Webhook Delivery Service

```typescript
class WebhookDeliveryService {
  private queue: Queue
  private redis: Redis
  private analytics: AnalyticsService
  
  constructor() {
    this.queue = new Queue('webhooks', {
      connection: redis.connection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    })
    
    this.queue.process(this.processWebhookDelivery.bind(this))
  }
  
  async publishEvent(event: WebhookEvent): Promise<void> {
    // Find all subscriptions for this event type
    const subscriptions = await this.getSubscriptionsForEvent(event.type)
    
    for (const subscription of subscriptions) {
      // Check if event matches subscription filters
      if (!this.matchesFilters(event, subscription.filters)) {
        continue
      }
      
      // Queue webhook delivery
      await this.queue.add('deliver-webhook', {
        subscriptionId: subscription.id,
        event: event,
        attempt: 1
      }, {
        delay: 0,
        jobId: `${subscription.id}-${event.id}`
      })
    }
  }
  
  private async processWebhookDelivery(job: Job): Promise<void> {
    const { subscriptionId, event, attempt } = job.data
    const subscription = await this.getSubscription(subscriptionId)
    
    if (!subscription || !subscription.active) {
      await this.analytics.recordWebhookSkipped(subscriptionId, 'inactive')
      return
    }
    
    try {
      const payload = this.buildWebhookPayload(event, subscription)
      const signature = this.generateSignature(payload, subscription.secret)
      
      const startTime = Date.now()
      const response = await this.sendWebhook(
        subscription.endpointUrl,
        payload,
        signature,
        subscription.headers
      )
      const duration = Date.now() - startTime
      
      await this.analytics.recordWebhookDelivery(
        subscriptionId,
        event.type,
        'success',
        response.status,
        duration,
        attempt
      )
      
      console.log(`Webhook delivered successfully: ${subscription.id}`)
      
    } catch (error) {
      await this.analytics.recordWebhookDelivery(
        subscriptionId,
        event.type,
        'failure',
        error.response?.status || 0,
        0,
        attempt
      )
      
      if (attempt >= subscription.retryConfig.maxRetries) {
        await this.handleFailedWebhook(subscription, event, error)
      }
      
      throw error // Let Bull handle retries
    }
  }
  
  private async sendWebhook(
    url: string,
    payload: any,
    signature: string,
    headers?: Record<string, string>
  ): Promise<Response> {
    const requestHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'Lawless-Directory-Webhooks/1.0',
      'X-Webhook-Signature': signature,
      'X-Webhook-Timestamp': Date.now().toString(),
      ...headers
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(payload),
      timeout: 30000
    })
    
    if (!response.ok) {
      throw new WebhookDeliveryError(
        `Webhook delivery failed: ${response.status} ${response.statusText}`,
        response.status
      )
    }
    
    return response
  }
  
  private generateSignature(payload: any, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(JSON.stringify(payload))
    return `sha256=${hmac.digest('hex')}`
  }
  
  private buildWebhookPayload(event: WebhookEvent, subscription: WebhookSubscription): any {
    return {
      id: event.id,
      type: event.type,
      created: event.timestamp.toISOString(),
      data: event.data,
      webhook: {
        subscription_id: subscription.id,
        delivery_attempt: 1
      }
    }
  }
}
```

### Third-Party Integration Framework

```typescript
// Integration plugin interface
interface IntegrationPlugin {
  name: string
  version: string
  supportedEvents: WebhookEventType[]
  authenticate(credentials: any): Promise<boolean>
  transform(event: WebhookEvent): Promise<any>
  deliver(data: any): Promise<IntegrationResult>
  healthCheck(): Promise<boolean>
}

// Salesforce integration
class SalesforceIntegration implements IntegrationPlugin {
  name = 'salesforce'
  version = '1.0.0'
  supportedEvents = [
    WebhookEventType.BUSINESS_CREATED,
    WebhookEventType.REVIEW_CREATED
  ]
  
  private salesforceClient: SalesforceClient
  
  async authenticate(credentials: SalesforceCredentials): Promise<boolean> {
    try {
      this.salesforceClient = new SalesforceClient(credentials)
      await this.salesforceClient.authenticate()
      return true
    } catch (error) {
      console.error('Salesforce authentication failed:', error)
      return false
    }
  }
  
  async transform(event: WebhookEvent): Promise<SalesforceRecord> {
    switch (event.type) {
      case WebhookEventType.BUSINESS_CREATED:
        return {
          objectType: 'Lead',
          fields: {
            Company: event.data.name,
            Website: event.data.website,
            Phone: event.data.phone,
            Street: event.data.address?.street,
            City: event.data.address?.city,
            State: event.data.address?.state,
            PostalCode: event.data.address?.zip,
            LeadSource: 'Directory API',
            Status: 'New'
          }
        }
      case WebhookEventType.REVIEW_CREATED:
        return {
          objectType: 'Case',
          fields: {
            Subject: `New Review: ${event.data.business.name}`,
            Description: event.data.content,
            Priority: event.data.rating <= 2 ? 'High' : 'Low',
            Origin: 'Directory API',
            Status: 'New'
          }
        }
      default:
        throw new Error(`Unsupported event type: ${event.type}`)
    }
  }
  
  async deliver(data: SalesforceRecord): Promise<IntegrationResult> {
    try {
      const result = await this.salesforceClient.create(data.objectType, data.fields)
      return {
        success: true,
        externalId: result.id,
        message: 'Record created successfully'
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      await this.salesforceClient.query('SELECT Id FROM Organization LIMIT 1')
      return true
    } catch {
      return false
    }
  }
}
```

### Webhook Testing Tools

```typescript
// Webhook testing service
class WebhookTestingService {
  async simulateEvent(
    subscriptionId: string,
    eventType: WebhookEventType,
    mockData?: any
  ): Promise<TestResult> {
    const subscription = await this.getSubscription(subscriptionId)
    if (!subscription) {
      throw new Error('Subscription not found')
    }
    
    // Generate mock event data
    const event: WebhookEvent = {
      id: `test_${Date.now()}`,
      type: eventType,
      version: '1.0',
      timestamp: new Date(),
      data: mockData || this.generateMockData(eventType),
      metadata: { test: true }
    }
    
    // Deliver webhook and measure performance
    const startTime = Date.now()
    try {
      await this.deliverWebhook(subscription, event)
      const duration = Date.now() - startTime
      
      return {
        success: true,
        duration,
        event,
        message: 'Webhook delivered successfully'
      }
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        event,
        error: error.message
      }
    }
  }
  
  async validateEndpoint(url: string): Promise<EndpointValidation> {
    try {
      // Test basic connectivity
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Lawless-Directory-Webhook-Validator/1.0'
        },
        body: JSON.stringify({ test: true }),
        timeout: 10000
      })
      
      return {
        valid: response.ok,
        status: response.status,
        ssl: url.startsWith('https://'),
        responseTime: response.headers.get('x-response-time'),
        issues: this.identifyIssues(response)
      }
    } catch (error) {
      return {
        valid: false,
        status: 0,
        ssl: false,
        error: error.message,
        issues: ['Connection failed']
      }
    }
  }
  
  private generateMockData(eventType: WebhookEventType): any {
    switch (eventType) {
      case WebhookEventType.BUSINESS_CREATED:
        return {
          id: 'test_business_123',
          name: 'Test Restaurant',
          category: 'restaurant',
          address: {
            street: '123 Main St',
            city: 'San Francisco',
            state: 'CA',
            zip: '94105'
          },
          phone: '(555) 123-4567',
          website: 'https://testrestaurant.com'
        }
      case WebhookEventType.REVIEW_CREATED:
        return {
          id: 'test_review_456',
          business_id: 'test_business_123',
          rating: 4,
          title: 'Great experience!',
          content: 'Had a wonderful time at this restaurant.',
          author: {
            name: 'John Doe',
            verified: true
          }
        }
      default:
        return { test: true }
    }
  }
}
```

## Dependencies

- ✅ Story 6.7: API subscription system for webhook access tiers
- ✅ Story 6.3: Business management API for webhook events

## Testing Requirements

### Webhook Functionality Tests
- [ ] Complete webhook event delivery testing
- [ ] Webhook retry and failure handling validation
- [ ] Security signature verification testing
- [ ] Webhook configuration management testing

### Third-Party Integration Tests
- [ ] CRM system integration accuracy and reliability
- [ ] Marketing platform integration functionality
- [ ] Data synchronization and mapping accuracy
- [ ] OAuth authentication flow testing

### Performance Tests
- [ ] High-volume webhook delivery performance
- [ ] Webhook queue processing efficiency
- [ ] Third-party service integration reliability
- [ ] Webhook endpoint health monitoring accuracy

## Definition of Done

- [ ] Comprehensive webhook system with all event types
- [ ] Reliable webhook delivery with retry mechanisms
- [ ] Security features including HMAC signatures
- [ ] Third-party service integrations (CRM, marketing)
- [ ] Webhook developer tools and testing console
- [ ] Webhook analytics and monitoring dashboard
- [ ] Integration with API subscription tiers
- [ ] Performance optimization for high-volume webhooks
- [ ] All webhook and integration tests passing
- [ ] Documentation complete for webhook implementation

## Risk Assessment

**Medium Risk:** Third-party service integration reliability may vary  
**Low Risk:** Webhook system implementation  
**Mitigation:** Robust error handling and monitoring for all integrations

## Success Metrics

- Webhook delivery success rate > 98%
- Average webhook delivery time < 5 seconds
- Third-party integration uptime > 99.5%
- Developer webhook adoption rate > 60%
- Webhook endpoint health monitoring accuracy > 95%

## Webhook Event Schemas

### Business Events

```json
{
  "business.created": {
    "id": "string",
    "name": "string",
    "category": "string",
    "address": {
      "street": "string",
      "city": "string",
      "state": "string",
      "zip": "string",
      "coordinates": {
        "lat": "number",
        "lng": "number"
      }
    },
    "contact": {
      "phone": "string",
      "email": "string",
      "website": "string"
    },
    "status": "string",
    "created_at": "datetime"
  },
  "business.updated": {
    "id": "string",
    "changes": {
      "field_name": {
        "old_value": "any",
        "new_value": "any"
      }
    },
    "updated_at": "datetime"
  }
}
```

### Review Events

```json
{
  "review.created": {
    "id": "string",
    "business_id": "string",
    "rating": "integer",
    "title": "string",
    "content": "string",
    "author": {
      "name": "string",
      "verified": "boolean"
    },
    "photos": ["string"],
    "created_at": "datetime"
  }
}
```

## Notes

This story creates a robust webhook system that enables real-time integration capabilities, along with popular third-party service integrations that reduce development time for common use cases. The focus on reliability, security, and developer tools ensures successful webhook implementations.

**Created:** 2024-08-24  
**Last Updated:** 2024-08-24  
**Status:** Ready for Implementation