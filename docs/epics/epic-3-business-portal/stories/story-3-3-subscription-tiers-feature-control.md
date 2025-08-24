# Story 3.3: Subscription Tiers & Feature Access Control

**Epic:** Epic 3 - Full-Featured Business Portal  
**Story ID:** 3.3  
**Priority:** P0 (Revenue Generation)  
**Points:** 25  
**Sprint:** 2  
**Assignee:** Backend Architect Agent

## User Story

**As a platform owner,** I want a robust subscription tier system that provides clear value differentiation and feature access control, **so that** business owners can choose appropriate plans and we can generate sustainable revenue while delivering exceptional value.

## Background & Context

The Subscription Tiers & Feature Access Control system is the revenue engine of the business portal. This story establishes the foundation for monetization through a three-tier subscription model (Free, Premium, Elite) with sophisticated feature gating and access control.

This system must balance accessibility for free users with compelling upgrade incentives, while maintaining a seamless user experience. The feature control system needs to be flexible enough to accommodate future features while being performant enough to handle real-time access decisions.

## Acceptance Criteria

### AC 3.3.1: Three-Tier Subscription System Definition
**Given** the need for monetization through subscriptions  
**When** defining subscription tiers  
**Then** implement three distinct service levels:

#### Free Tier (Basic) - $0/month:
- Basic business profile with limited customization
- Up to 5 business photos
- Basic contact information display
- Review viewing (read-only)
- Basic analytics (profile views only)
- Standard listing placement in search results
- Community support only

#### Premium Tier - $29/month:
- All Free tier features +
- Unlimited photo uploads with advanced gallery
- Rich business description with formatting
- Review response capabilities
- Advanced analytics and customer insights
- Priority listing placement (higher in search results)
- Business hours management and special offers
- Social media integration
- Email support with 24-hour response time
- Marketing tools (basic promotions)

#### Elite Tier - $99/month:
- All Premium tier features +
- Multi-location business management
- Team member access with role-based permissions
- Custom business page design and branding
- Advanced marketing and promotion tools
- Featured listing placements and homepage spots
- API access for third-party integrations
- Priority customer support with 4-hour response
- Advanced reporting with data exports
- Custom analytics and competitor insights

### AC 3.3.2: Database Schema for Subscription Management
**Given** subscription management requirements  
**When** implementing the database schema  
**Then** create comprehensive subscription tracking:

```sql
-- Subscription plans definition
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_code VARCHAR(50) UNIQUE NOT NULL,
  plan_name VARCHAR(100) NOT NULL,
  tier VARCHAR(20) CHECK (tier IN ('free', 'premium', 'elite')),
  
  -- Pricing
  monthly_price DECIMAL(10,2),
  annual_price DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Features and limits
  features JSONB NOT NULL DEFAULT '{}',
  api_rate_limit INTEGER DEFAULT 1000,
  storage_limit_gb INTEGER DEFAULT 10,
  user_limit INTEGER DEFAULT 1,
  business_limit INTEGER DEFAULT 1,
  
  -- Feature flags
  analytics_enabled BOOLEAN DEFAULT FALSE,
  api_access BOOLEAN DEFAULT FALSE,
  custom_domain BOOLEAN DEFAULT FALSE,
  priority_support BOOLEAN DEFAULT FALSE,
  
  -- Status and metadata
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User/Business subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id),
  plan_code VARCHAR(50) NOT NULL,
  
  -- Billing information
  billing_period VARCHAR(20) CHECK (billing_period IN ('monthly', 'annual')),
  price_paid DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Payment integration
  stripe_subscription_id VARCHAR(255) UNIQUE,
  stripe_customer_id VARCHAR(255),
  
  -- Subscription status
  status VARCHAR(20) CHECK (status IN (
    'trialing', 'active', 'past_due', 'canceled', 
    'incomplete', 'expired', 'paused'
  )) DEFAULT 'active',
  
  -- Important dates
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  
  -- Usage tracking
  usage_data JSONB DEFAULT '{}',
  overage_charges DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feature usage tracking
CREATE TABLE subscription_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  
  -- Usage metrics
  metric_name VARCHAR(100) NOT NULL,
  metric_value BIGINT NOT NULL DEFAULT 0,
  metric_limit BIGINT,
  
  -- Time period
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Overage handling
  overage_amount BIGINT DEFAULT 0,
  overage_charge DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(subscription_id, metric_name, period_start)
);
```

### AC 3.3.3: Real-Time Feature Access Control
**Given** different subscription levels  
**When** controlling feature access  
**Then** implement dynamic access management:

```sql
-- Feature access validation function
CREATE OR REPLACE FUNCTION check_feature_access(
  p_business_id UUID,
  p_feature_name VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  subscription RECORD;
  has_access BOOLEAN := FALSE;
BEGIN
  -- Get active subscription with plan details
  SELECT s.*, sp.features, sp.tier
  INTO subscription
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.business_id = p_business_id
  AND s.status IN ('active', 'trialing')
  ORDER BY sp.monthly_price DESC
  LIMIT 1;
  
  IF FOUND THEN
    -- Check if feature is included in plan
    has_access := (subscription.features->p_feature_name)::BOOLEAN OR FALSE;
    
    -- Additional tier-based checks
    IF NOT has_access THEN
      has_access := CASE
        WHEN subscription.tier = 'elite' THEN TRUE
        WHEN subscription.tier = 'premium' AND p_feature_name IN (
          'advanced_analytics', 'review_responses', 'marketing_tools'
        ) THEN TRUE
        ELSE FALSE
      END;
    END IF;
  ELSE
    -- Default to free tier permissions
    has_access := p_feature_name IN ('basic_profile', 'basic_analytics');
  END IF;
  
  RETURN has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage tracking function
CREATE OR REPLACE FUNCTION track_feature_usage(
  p_business_id UUID,
  p_feature_name VARCHAR,
  p_usage_amount INTEGER DEFAULT 1
)
RETURNS JSONB AS $$
DECLARE
  subscription_id UUID;
  current_usage BIGINT;
  usage_limit BIGINT;
  result JSONB;
BEGIN
  -- Get subscription ID
  SELECT s.id INTO subscription_id
  FROM subscriptions s
  WHERE s.business_id = p_business_id
  AND s.status IN ('active', 'trialing');
  
  IF subscription_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No active subscription found');
  END IF;
  
  -- Update usage
  INSERT INTO subscription_usage (
    subscription_id, metric_name, metric_value,
    period_start, period_end
  ) VALUES (
    subscription_id, p_feature_name, p_usage_amount,
    date_trunc('month', NOW()),
    date_trunc('month', NOW()) + INTERVAL '1 month'
  )
  ON CONFLICT (subscription_id, metric_name, period_start)
  DO UPDATE SET 
    metric_value = subscription_usage.metric_value + p_usage_amount
  RETURNING metric_value, metric_limit INTO current_usage, usage_limit;
  
  -- Build response
  result := jsonb_build_object(
    'current_usage', current_usage,
    'limit', COALESCE(usage_limit, -1),
    'unlimited', usage_limit IS NULL,
    'remaining', CASE 
      WHEN usage_limit IS NULL THEN -1
      ELSE GREATEST(0, usage_limit - current_usage)
    END
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

### AC 3.3.4: Subscription Management Interface
**Given** business owners managing subscriptions  
**When** accessing subscription management  
**Then** provide comprehensive subscription tools:
- Current plan overview with feature comparison table
- Usage analytics showing feature utilization
- Upgrade/downgrade options with prorated billing
- Billing history and invoice downloads
- Payment method management
- Cancellation workflow with retention attempts
- Renewal date and auto-renewal settings

### AC 3.3.5: Graceful Feature Limitation & Upgrade Prompts
**Given** feature access restrictions  
**When** users attempt to access premium features  
**Then** provide elegant limitation handling:
- Clear messaging about feature requirements
- One-click upgrade flows with value proposition
- Feature preview modes where applicable
- Contextual upgrade prompts at point of need
- Trial period offerings for premium features
- No disruptive or frustrating limitations

## Technical Requirements

### Feature Flag System
- **Architecture:** Database-driven feature flags with Redis caching
- **Performance:** < 5ms feature access checks
- **Scalability:** Support for 100,000+ concurrent checks
- **Flexibility:** Runtime feature flag updates without deployment

### Billing Integration
- **Payment Processor:** Stripe for subscription management
- **Prorated Billing:** Automatic calculation for plan changes
- **Tax Handling:** Automated tax calculation by jurisdiction
- **Invoice Generation:** PDF invoice creation and delivery
- **Failed Payment Handling:** Automated retry with graceful degradation

### Caching Strategy
- **Redis:** Feature access decisions cached for 5 minutes
- **Database:** Subscription status cached for 1 minute
- **Invalidation:** Immediate cache clearing on subscription changes
- **Fallback:** Graceful degradation if cache unavailable

### Performance Requirements
- Feature access check: < 5ms
- Subscription status update: < 100ms
- Plan upgrade processing: < 2 seconds
- Usage tracking: < 50ms per event
- Dashboard load with subscription data: < 1 second

## Dependencies

### Must Complete First:
- Epic 2 Story 2.8: RBAC system integration
- Story 3.1: Dashboard for subscription management interface

### External Dependencies:
- Stripe account setup and configuration
- Tax calculation service integration
- Email service for billing notifications

## Testing Strategy

### Unit Tests
- Feature access control logic
- Subscription tier validation
- Usage tracking accuracy
- Billing calculation functions
- Feature flag system

### Integration Tests
- Stripe integration workflows
- Subscription lifecycle management
- Feature access across all tiers
- Usage limit enforcement
- Upgrade/downgrade processes

### E2E Tests
- Complete subscription signup flow
- Feature unlock after upgrade
- Billing cycle transitions
- Cancellation and reactivation
- Multi-location subscription handling

### Performance Tests
- Feature access check latency
- Concurrent subscription operations
- Database performance under load
- Cache effectiveness validation

## Definition of Done

### Functional Requirements ✓
- [ ] Three-tier subscription system fully implemented
- [ ] Feature access control operational across all features
- [ ] Subscription management interface complete and tested
- [ ] Usage tracking and limit enforcement active
- [ ] Upgrade/downgrade workflows functional

### Technical Requirements ✓
- [ ] Database schema optimized for subscription management
- [ ] Real-time feature enforcement working correctly
- [ ] Performance benchmarks met (< 5ms access checks)
- [ ] Caching layer operational and effective
- [ ] Stripe integration tested and secure

### Business Requirements ✓
- [ ] Revenue tracking and analytics functional
- [ ] Customer retention workflows implemented
- [ ] Billing compliance requirements met
- [ ] Tax calculation accuracy verified
- [ ] Invoice generation and delivery working

### Testing Requirements ✓
- [ ] All subscription-related tests passing
- [ ] Security testing for payment handling
- [ ] Performance testing under realistic load
- [ ] Edge case handling validated
- [ ] Disaster recovery procedures tested

## Success Metrics

### Subscription Conversion
- Free to Premium conversion rate: > 25%
- Premium to Elite upgrade rate: > 15%
- Trial to paid conversion: > 60%
- Annual billing adoption: > 40%

### Revenue Metrics
- Monthly recurring revenue (MRR) growth: > 20% monthly
- Average revenue per user (ARPU): > $35/month
- Customer lifetime value (CLV): > $500
- Churn rate: < 8% monthly

### Technical Performance
- Feature access check latency: < 5ms (95th percentile)
- Subscription operation success rate: > 99.9%
- Payment processing success rate: > 98%
- System uptime: > 99.9%

### User Experience
- Subscription management satisfaction: > 4.5/5
- Feature discovery rate: > 70%
- Upgrade process completion rate: > 85%
- Support ticket volume: < 5% of subscribers

## Risk Assessment

### Technical Risks
- **Medium Risk:** Complex feature access control may impact performance
  - *Mitigation:* Efficient caching and optimized database queries
- **High Risk:** Payment processing failures could impact revenue
  - *Mitigation:* Robust error handling and multiple payment retry mechanisms

### Business Risks
- **Medium Risk:** Pricing strategy may not optimize for conversions
  - *Mitigation:* A/B testing of pricing and continuous optimization
- **High Risk:** Feature limitations may frustrate users
  - *Mitigation:* User testing and gradual rollout of limitations

## Notes

### Pricing Strategy Considerations
- Competitive analysis with similar platforms
- Value-based pricing aligned with business owner ROI
- Trial periods to reduce friction
- Annual billing discounts to improve retention

### Future Enhancements (Post-MVP)
- Enterprise tier for large business chains
- Custom pricing for high-volume customers
- Add-on services (photography, marketing)
- Partner integrations with revenue sharing
- Usage-based pricing options

### Compliance Requirements
- PCI DSS compliance for payment handling
- GDPR compliance for customer data
- SOX compliance for financial reporting
- State tax registration requirements

### API Endpoints Required
- `GET /api/subscriptions/plans` - Available subscription plans
- `POST /api/subscriptions/subscribe` - Create new subscription
- `PUT /api/subscriptions/:id/upgrade` - Upgrade subscription
- `PUT /api/subscriptions/:id/cancel` - Cancel subscription
- `GET /api/subscriptions/:id/usage` - Usage analytics
- `POST /api/subscriptions/validate-access` - Feature access validation