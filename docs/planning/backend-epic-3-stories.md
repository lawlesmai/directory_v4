# Backend Epic 3: Business Data Models with Subscription Access Control - Technical Stories

**Date:** 2024-08-23  
**Epic Lead:** Backend Architect Agent  
**Priority:** P0 (Core Business Logic)  
**Duration:** 5 Sprints (Parallel to Frontend Epic 3)  
**Story Points Total:** 233 points

## Epic Mission Statement

Design and implement comprehensive business data models with multi-tier subscription access control, analytics infrastructure, and advanced features that drive revenue through premium offerings while maintaining excellent performance at scale.

## Business Logic Architecture

**Subscription Tiers:**
- **Free Tier:** Basic listing, limited analytics, standard support
- **Premium Tier ($49/mo):** Enhanced listing, full analytics, priority support
- **Elite Tier ($199/mo):** All features, API access, white-label options, dedicated support

**Data Access Patterns:**
- Tiered data visibility based on subscription
- Performance-optimized queries for large datasets
- Real-time analytics with materialized views
- Caching strategies for frequently accessed data

---

## Story B3.1: Multi-Tier Subscription Data Architecture

**User Story:** As a platform architect, I want a sophisticated subscription system that controls data access, features, and API limits based on subscription tiers.

**Assignee:** Backend Architect Agent  
**Priority:** P0  
**Story Points:** 34  
**Sprint:** 1

### Detailed Acceptance Criteria

**Subscription Model Design:**
```sql
-- Subscription plans definition
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code VARCHAR(50) UNIQUE NOT NULL,
  plan_name VARCHAR(100) NOT NULL,
  tier VARCHAR(20) CHECK (tier IN ('free', 'premium', 'elite', 'enterprise')),
  
  -- Pricing
  monthly_price DECIMAL(10,2),
  annual_price DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Features and limits
  features JSONB NOT NULL DEFAULT '{}',
  api_rate_limit INTEGER DEFAULT 1000, -- requests per hour
  storage_limit_gb INTEGER DEFAULT 10,
  user_limit INTEGER DEFAULT 1,
  business_limit INTEGER DEFAULT 1,
  
  -- Feature flags
  analytics_enabled BOOLEAN DEFAULT FALSE,
  api_access BOOLEAN DEFAULT FALSE,
  custom_domain BOOLEAN DEFAULT FALSE,
  white_label BOOLEAN DEFAULT FALSE,
  priority_support BOOLEAN DEFAULT FALSE,
  dedicated_account_manager BOOLEAN DEFAULT FALSE,
  
  -- Analytics features
  analytics_retention_days INTEGER DEFAULT 30,
  realtime_analytics BOOLEAN DEFAULT FALSE,
  export_enabled BOOLEAN DEFAULT FALSE,
  custom_reports BOOLEAN DEFAULT FALSE,
  
  -- Marketing features
  featured_listing BOOLEAN DEFAULT FALSE,
  boost_credits_monthly INTEGER DEFAULT 0,
  social_media_integration BOOLEAN DEFAULT FALSE,
  email_campaigns_monthly INTEGER DEFAULT 0,
  
  -- Display
  badge_text VARCHAR(50),
  badge_color VARCHAR(7),
  sort_order INTEGER DEFAULT 0,
  
  -- Status
  active BOOLEAN DEFAULT TRUE,
  available_for_purchase BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert subscription tiers
INSERT INTO subscription_plans (
  plan_code, plan_name, tier, monthly_price, annual_price,
  features, analytics_enabled, api_access, analytics_retention_days
) VALUES 
(
  'free', 'Free', 'free', 0, 0,
  '{"listings": 1, "photos": 5, "basic_analytics": true}',
  FALSE, FALSE, 7
),
(
  'premium', 'Premium', 'premium', 49.99, 479.99,
  '{"listings": 5, "photos": 50, "full_analytics": true, "priority_support": true}',
  TRUE, FALSE, 90
),
(
  'elite', 'Elite', 'elite', 199.99, 1999.99,
  '{"listings": "unlimited", "photos": "unlimited", "all_features": true}',
  TRUE, TRUE, 365
);

-- User/Business subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Subscription owner
  user_id UUID REFERENCES auth.users(id),
  business_id UUID REFERENCES businesses(id),
  subscription_type VARCHAR(20) CHECK (subscription_type IN ('user', 'business')),
  
  -- Plan details
  plan_id UUID REFERENCES subscription_plans(id),
  plan_code VARCHAR(50) NOT NULL,
  
  -- Billing
  billing_period VARCHAR(20) CHECK (billing_period IN ('monthly', 'annual')),
  price_paid DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Stripe integration
  stripe_subscription_id VARCHAR(255) UNIQUE,
  stripe_customer_id VARCHAR(255),
  stripe_price_id VARCHAR(255),
  
  -- Status
  status VARCHAR(20) CHECK (status IN (
    'trialing', 'active', 'past_due', 'canceled', 
    'incomplete', 'incomplete_expired', 'unpaid', 'paused'
  )),
  
  -- Dates
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  
  -- Usage tracking
  usage_data JSONB DEFAULT '{}',
  overage_charges DECIMAL(10,2) DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  referral_code VARCHAR(50),
  discount_percentage INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature access control
CREATE OR REPLACE FUNCTION check_feature_access(
  p_business_id UUID,
  p_feature VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  subscription RECORD;
  plan RECORD;
BEGIN
  -- Get active subscription
  SELECT s.*, sp.*
  INTO subscription
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.business_id = p_business_id
  AND s.status = 'active'
  ORDER BY sp.sort_order DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    -- Check free tier access
    SELECT * INTO plan
    FROM subscription_plans
    WHERE plan_code = 'free';
    
    RETURN (plan.features->>p_feature)::BOOLEAN 
           OR FALSE;
  END IF;
  
  -- Check feature in plan
  RETURN (subscription.features->>p_feature)::BOOLEAN 
         OR FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage tracking
CREATE TABLE subscription_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id),
  
  -- Usage metrics
  metric_name VARCHAR(100) NOT NULL,
  metric_value BIGINT NOT NULL DEFAULT 0,
  metric_limit BIGINT,
  
  -- Period
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Overage handling
  overage_amount BIGINT DEFAULT 0,
  overage_charge DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(subscription_id, metric_name, period_start)
);

-- Track API usage
CREATE OR REPLACE FUNCTION track_usage(
  p_subscription_id UUID,
  p_metric VARCHAR,
  p_value INTEGER DEFAULT 1
)
RETURNS JSONB AS $$
DECLARE
  current_usage BIGINT;
  usage_limit BIGINT;
  result JSONB;
BEGIN
  -- Get or create usage record for current period
  INSERT INTO subscription_usage (
    subscription_id, metric_name, metric_value,
    period_start, period_end
  ) VALUES (
    p_subscription_id, p_metric, p_value,
    date_trunc('month', NOW()),
    date_trunc('month', NOW()) + INTERVAL '1 month'
  )
  ON CONFLICT (subscription_id, metric_name, period_start)
  DO UPDATE SET 
    metric_value = subscription_usage.metric_value + p_value,
    overage_amount = GREATEST(0, 
      subscription_usage.metric_value + p_value - subscription_usage.metric_limit
    )
  RETURNING metric_value, metric_limit INTO current_usage, usage_limit;
  
  -- Check if limit exceeded
  IF usage_limit IS NOT NULL AND current_usage > usage_limit THEN
    -- Handle overage
    result := jsonb_build_object(
      'allowed', FALSE,
      'current_usage', current_usage,
      'limit', usage_limit,
      'overage', current_usage - usage_limit,
      'action', 'limit_exceeded'
    );
  ELSE
    result := jsonb_build_object(
      'allowed', TRUE,
      'current_usage', current_usage,
      'limit', usage_limit,
      'remaining', COALESCE(usage_limit - current_usage, -1)
    );
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

### Technical Implementation Notes

**Subscription State Machine:**
```sql
-- State transition validation
CREATE OR REPLACE FUNCTION validate_subscription_transition(
  p_subscription_id UUID,
  p_from_status VARCHAR,
  p_to_status VARCHAR
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Define valid transitions
  RETURN CASE
    WHEN p_from_status = 'trialing' THEN 
      p_to_status IN ('active', 'canceled', 'incomplete')
    WHEN p_from_status = 'active' THEN 
      p_to_status IN ('past_due', 'canceled', 'paused')
    WHEN p_from_status = 'past_due' THEN 
      p_to_status IN ('active', 'canceled', 'unpaid')
    WHEN p_from_status = 'paused' THEN 
      p_to_status IN ('active', 'canceled')
    WHEN p_from_status = 'canceled' THEN 
      p_to_status IN ('active') -- reactivation
    ELSE FALSE
  END;
END;
$$ LANGUAGE plpgsql;
```

### Definition of Done
- [ ] Subscription schema implemented
- [ ] Feature access control working
- [ ] Usage tracking functional
- [ ] State transitions validated
- [ ] Billing integration ready

---

## Story B3.2: Business Analytics Data Pipeline

**User Story:** As a business owner, I want comprehensive analytics about my business performance with real-time insights based on my subscription tier.

**Assignee:** Backend Architect Agent  
**Priority:** P0  
**Story Points:** 34  
**Sprint:** 1

### Detailed Acceptance Criteria

**Analytics Schema:**
```sql
-- Business metrics tracking
CREATE TABLE business_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  
  -- Time dimensions
  metric_date DATE NOT NULL,
  metric_hour INTEGER, -- 0-23
  metric_week INTEGER, -- week of year
  metric_month INTEGER, -- 1-12
  metric_year INTEGER,
  
  -- Traffic metrics
  page_views INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  avg_time_on_page DECIMAL(10,2) DEFAULT 0,
  bounce_rate DECIMAL(5,2) DEFAULT 0,
  
  -- Engagement metrics
  clicks_phone INTEGER DEFAULT 0,
  clicks_website INTEGER DEFAULT 0,
  clicks_directions INTEGER DEFAULT 0,
  clicks_social INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  
  -- Review metrics
  new_reviews INTEGER DEFAULT 0,
  avg_rating DECIMAL(3,2),
  review_responses INTEGER DEFAULT 0,
  
  -- Search metrics
  search_impressions INTEGER DEFAULT 0,
  search_clicks INTEGER DEFAULT 0,
  search_position DECIMAL(5,2),
  top_search_terms TEXT[],
  
  -- Conversion metrics
  leads_generated INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_value DECIMAL(10,2) DEFAULT 0,
  
  -- Competition metrics
  competitor_views INTEGER DEFAULT 0,
  market_position INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(business_id, metric_date, metric_hour)
) PARTITION BY RANGE (metric_date);

-- Create monthly partitions
CREATE TABLE business_metrics_2024_01 
  PARTITION OF business_metrics
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Real-time analytics events
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  
  -- Event details
  event_type VARCHAR(50) NOT NULL,
  event_category VARCHAR(50),
  event_action VARCHAR(100),
  event_label VARCHAR(255),
  event_value DECIMAL(10,2),
  
  -- User context
  visitor_id VARCHAR(255),
  user_id UUID REFERENCES auth.users(id),
  session_id VARCHAR(255),
  
  -- Device/Browser
  device_type VARCHAR(20),
  browser VARCHAR(50),
  os VARCHAR(50),
  screen_resolution VARCHAR(20),
  
  -- Location
  ip_address INET,
  country VARCHAR(2),
  region VARCHAR(100),
  city VARCHAR(100),
  
  -- Referrer
  referrer_url TEXT,
  referrer_type VARCHAR(50), -- 'search', 'social', 'direct', 'referral'
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  
  -- Page context
  page_url TEXT,
  page_title VARCHAR(255),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Aggregated analytics views
CREATE MATERIALIZED VIEW business_analytics_daily AS
SELECT 
  business_id,
  metric_date,
  
  -- Traffic
  SUM(page_views) as total_views,
  SUM(unique_visitors) as total_visitors,
  AVG(avg_time_on_page) as avg_engagement_time,
  
  -- Engagement
  SUM(clicks_phone + clicks_website + clicks_directions) as total_actions,
  
  -- Performance
  AVG(search_position) as avg_search_rank,
  SUM(conversions) as total_conversions,
  SUM(conversion_value) as total_revenue,
  
  -- Calculated metrics
  CASE 
    WHEN SUM(search_impressions) > 0 
    THEN SUM(search_clicks)::DECIMAL / SUM(search_impressions) 
    ELSE 0 
  END as click_through_rate,
  
  CASE 
    WHEN SUM(unique_visitors) > 0 
    THEN SUM(conversions)::DECIMAL / SUM(unique_visitors) 
    ELSE 0 
  END as conversion_rate
  
FROM business_metrics
WHERE metric_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY business_id, metric_date
WITH DATA;

CREATE INDEX ON business_analytics_daily(business_id, metric_date DESC);

-- Competitor analysis
CREATE OR REPLACE FUNCTION analyze_competitors(
  p_business_id UUID,
  p_radius_miles INTEGER DEFAULT 5
)
RETURNS TABLE(
  competitor_id UUID,
  competitor_name VARCHAR,
  distance_miles DECIMAL,
  avg_rating DECIMAL,
  review_count INTEGER,
  price_level INTEGER,
  market_share DECIMAL,
  strengths JSONB,
  weaknesses JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH business_location AS (
    SELECT location, primary_category_id
    FROM businesses
    WHERE id = p_business_id
  ),
  competitors AS (
    SELECT 
      b.id,
      b.name,
      ST_Distance(b.location, bl.location) / 1609.34 as distance,
      b.quality_score as rating,
      b.review_count,
      b.price_level,
      COUNT(*) OVER () as total_competitors
    FROM businesses b, business_location bl
    WHERE b.id != p_business_id
    AND b.primary_category_id = bl.primary_category_id
    AND ST_DWithin(b.location, bl.location, p_radius_miles * 1609.34)
    AND b.status = 'active'
  )
  SELECT 
    c.id,
    c.name,
    c.distance,
    c.rating,
    c.review_count,
    c.price_level,
    (c.review_count::DECIMAL / NULLIF(SUM(c.review_count) OVER (), 0)) * 100 as market_share,
    jsonb_build_object(
      'higher_rating', c.rating > (SELECT quality_score FROM businesses WHERE id = p_business_id),
      'more_reviews', c.review_count > (SELECT review_count FROM businesses WHERE id = p_business_id)
    ) as strengths,
    jsonb_build_object(
      'lower_rating', c.rating < (SELECT quality_score FROM businesses WHERE id = p_business_id),
      'fewer_reviews', c.review_count < (SELECT review_count FROM businesses WHERE id = p_business_id)
    ) as weaknesses
  FROM competitors c;
END;
$$ LANGUAGE plpgsql;

-- Analytics access control
CREATE OR REPLACE FUNCTION get_business_analytics(
  p_business_id UUID,
  p_user_id UUID,
  p_date_from DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_date_to DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
  subscription_tier VARCHAR;
  analytics_data JSONB;
BEGIN
  -- Check subscription tier
  SELECT sp.tier INTO subscription_tier
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.business_id = p_business_id
  AND s.status = 'active';
  
  -- Build analytics based on tier
  IF subscription_tier = 'free' OR subscription_tier IS NULL THEN
    -- Basic analytics only
    SELECT jsonb_build_object(
      'summary', jsonb_build_object(
        'total_views', SUM(page_views),
        'period', jsonb_build_object('from', p_date_from, 'to', p_date_to)
      ),
      'tier_message', 'Upgrade to Premium for detailed analytics'
    ) INTO analytics_data
    FROM business_metrics
    WHERE business_id = p_business_id
    AND metric_date BETWEEN p_date_from AND p_date_to;
    
  ELSIF subscription_tier = 'premium' THEN
    -- Full analytics without competitors
    SELECT jsonb_build_object(
      'traffic', jsonb_build_object(
        'views', SUM(page_views),
        'visitors', SUM(unique_visitors),
        'avg_time', AVG(avg_time_on_page)
      ),
      'engagement', jsonb_build_object(
        'total_clicks', SUM(clicks_phone + clicks_website + clicks_directions),
        'saves', SUM(saves),
        'shares', SUM(shares)
      ),
      'performance', jsonb_build_object(
        'conversions', SUM(conversions),
        'revenue', SUM(conversion_value)
      )
    ) INTO analytics_data
    FROM business_metrics
    WHERE business_id = p_business_id
    AND metric_date BETWEEN p_date_from AND p_date_to;
    
  ELSE -- Elite tier
    -- Everything including competitor analysis
    WITH base_analytics AS (
      SELECT * FROM business_metrics
      WHERE business_id = p_business_id
      AND metric_date BETWEEN p_date_from AND p_date_to
    )
    SELECT jsonb_build_object(
      'traffic', jsonb_build_object(
        'views', SUM(page_views),
        'visitors', SUM(unique_visitors),
        'avg_time', AVG(avg_time_on_page),
        'bounce_rate', AVG(bounce_rate)
      ),
      'engagement', jsonb_build_object(
        'clicks', jsonb_build_object(
          'phone', SUM(clicks_phone),
          'website', SUM(clicks_website),
          'directions', SUM(clicks_directions),
          'social', SUM(clicks_social)
        ),
        'saves', SUM(saves),
        'shares', SUM(shares)
      ),
      'search', jsonb_build_object(
        'impressions', SUM(search_impressions),
        'clicks', SUM(search_clicks),
        'position', AVG(search_position),
        'top_terms', array_agg(DISTINCT unnest(top_search_terms))
      ),
      'performance', jsonb_build_object(
        'leads', SUM(leads_generated),
        'conversions', SUM(conversions),
        'revenue', SUM(conversion_value),
        'conversion_rate', AVG(CASE WHEN unique_visitors > 0 
          THEN conversions::DECIMAL / unique_visitors ELSE 0 END)
      ),
      'competitors', (
        SELECT jsonb_agg(row_to_json(c))
        FROM analyze_competitors(p_business_id, 5) c
      )
    ) INTO analytics_data
    FROM base_analytics;
  END IF;
  
  RETURN analytics_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Definition of Done
- [ ] Analytics schema created
- [ ] Event tracking implemented
- [ ] Materialized views optimized
- [ ] Competitor analysis working
- [ ] Tier-based access control verified

---

## Story B3.3: Review Management System with AI Features

**User Story:** As a business owner, I want an intelligent review management system that helps me respond to reviews, analyzes sentiment, and provides insights to improve my business.

**Assignee:** Backend Architect Agent  
**Priority:** P0  
**Story Points:** 21  
**Sprint:** 2

### Detailed Acceptance Criteria

**Enhanced Review System:**
```sql
-- Review sentiment analysis
CREATE TABLE review_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES business_reviews(id),
  
  -- Sentiment analysis
  sentiment_score DECIMAL(3,2), -- -1 to 1
  sentiment_magnitude DECIMAL(3,2), -- 0 to 1
  sentiment_label VARCHAR(20), -- 'positive', 'negative', 'neutral', 'mixed'
  
  -- Topic extraction
  topics JSONB DEFAULT '[]', -- [{topic: 'service', score: 0.8}]
  keywords TEXT[],
  
  -- Entity recognition
  entities JSONB DEFAULT '[]', -- [{type: 'person', name: 'John', sentiment: 0.5}]
  
  -- Quality metrics
  helpfulness_prediction DECIMAL(3,2),
  authenticity_score DECIMAL(3,2),
  spam_probability DECIMAL(3,2),
  
  -- Response suggestions
  suggested_response TEXT,
  response_templates JSONB DEFAULT '[]',
  response_priority VARCHAR(20), -- 'urgent', 'high', 'medium', 'low'
  
  -- Processing metadata
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  processing_time_ms INTEGER,
  model_version VARCHAR(50)
);

-- Review response templates
CREATE TABLE response_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  
  -- Template details
  template_name VARCHAR(100),
  template_type VARCHAR(50), -- 'positive', 'negative', 'neutral', 'apology'
  template_text TEXT NOT NULL,
  
  -- Placeholders
  placeholders JSONB DEFAULT '[]', -- ['customer_name', 'issue', 'resolution']
  
  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(3,2),
  
  -- AI learning
  effectiveness_score DECIMAL(3,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Review insights aggregation
CREATE MATERIALIZED VIEW review_insights AS
WITH review_stats AS (
  SELECT 
    br.business_id,
    DATE_TRUNC('month', br.created_at) as month,
    
    -- Rating distribution
    COUNT(*) as total_reviews,
    AVG(br.rating) as avg_rating,
    STDDEV(br.rating) as rating_stddev,
    
    -- Sentiment
    AVG(ra.sentiment_score) as avg_sentiment,
    
    -- Response metrics
    COUNT(brr.id) as responses_count,
    AVG(EXTRACT(EPOCH FROM (brr.created_at - br.created_at))/3600) as avg_response_time_hours,
    
    -- Topics
    jsonb_object_agg(
      topic->>'topic',
      topic->>'score'
    ) as top_topics
    
  FROM business_reviews br
  LEFT JOIN review_analysis ra ON br.id = ra.review_id
  LEFT JOIN business_review_responses brr ON br.id = brr.review_id
  LEFT JOIN LATERAL jsonb_array_elements(ra.topics) topic ON true
  WHERE br.status = 'published'
  GROUP BY br.business_id, DATE_TRUNC('month', br.created_at)
)
SELECT 
  business_id,
  month,
  total_reviews,
  avg_rating,
  rating_stddev,
  avg_sentiment,
  responses_count,
  avg_response_time_hours,
  top_topics,
  
  -- Calculated insights
  CASE 
    WHEN avg_rating >= 4.5 THEN 'excellent'
    WHEN avg_rating >= 4.0 THEN 'good'
    WHEN avg_rating >= 3.0 THEN 'average'
    ELSE 'needs_improvement'
  END as performance_tier,
  
  CASE
    WHEN responses_count::DECIMAL / NULLIF(total_reviews, 0) >= 0.8 THEN 'high'
    WHEN responses_count::DECIMAL / NULLIF(total_reviews, 0) >= 0.5 THEN 'medium'
    ELSE 'low'
  END as response_rate_tier
  
FROM review_stats
WITH DATA;

CREATE INDEX ON review_insights(business_id, month DESC);

-- AI-powered response generation
CREATE OR REPLACE FUNCTION generate_review_response(
  p_review_id UUID,
  p_business_id UUID
)
RETURNS JSONB AS $$
DECLARE
  review RECORD;
  analysis RECORD;
  response_text TEXT;
  template RECORD;
BEGIN
  -- Get review and analysis
  SELECT br.*, ra.*
  INTO review
  FROM business_reviews br
  LEFT JOIN review_analysis ra ON br.id = ra.review_id
  WHERE br.id = p_review_id;
  
  -- Select appropriate template based on sentiment
  SELECT * INTO template
  FROM response_templates
  WHERE business_id = p_business_id
  AND template_type = CASE
    WHEN review.sentiment_score > 0.3 THEN 'positive'
    WHEN review.sentiment_score < -0.3 THEN 'negative'
    ELSE 'neutral'
  END
  ORDER BY effectiveness_score DESC
  LIMIT 1;
  
  -- Generate response
  IF template IS NOT NULL THEN
    response_text := template.template_text;
    -- Replace placeholders
    response_text := REPLACE(response_text, '{customer_name}', 
      COALESCE(review.reviewer_name, 'Valued Customer'));
    response_text := REPLACE(response_text, '{rating}', review.rating::TEXT);
  ELSE
    -- Default response
    response_text := CASE
      WHEN review.rating >= 4 THEN 
        'Thank you for your wonderful review! We''re thrilled you had a great experience.'
      WHEN review.rating >= 3 THEN
        'Thank you for your feedback. We appreciate your honest review and will use it to improve.'
      ELSE
        'We''re sorry to hear about your experience. Please contact us directly so we can make things right.'
    END;
  END IF;
  
  RETURN jsonb_build_object(
    'suggested_response', response_text,
    'response_priority', CASE
      WHEN review.rating <= 2 THEN 'urgent'
      WHEN review.rating = 3 THEN 'high'
      ELSE 'medium'
    END,
    'sentiment', review.sentiment_label,
    'key_topics', review.topics,
    'template_used', template.id
  );
END;
$$ LANGUAGE plpgsql;

-- Review workflow automation
CREATE TABLE review_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  
  -- Trigger conditions
  trigger_rating INTEGER[], -- e.g., [1,2] for low ratings
  trigger_sentiment VARCHAR(20),
  trigger_keywords TEXT[],
  
  -- Actions
  auto_respond BOOLEAN DEFAULT FALSE,
  notify_owner BOOLEAN DEFAULT TRUE,
  escalate_to_support BOOLEAN DEFAULT FALSE,
  
  -- Response settings
  response_template_id UUID REFERENCES response_templates(id),
  response_delay_hours INTEGER DEFAULT 24,
  
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Definition of Done
- [ ] Review analysis schema created
- [ ] Sentiment analysis integrated
- [ ] Response templates system working
- [ ] AI response generation functional
- [ ] Workflow automation tested

---

## Story B3.4: Business Profile Management & Verification

**User Story:** As a business owner, I want comprehensive profile management with verification badges and trust signals that increase customer confidence.

**Assignee:** Backend Architect Agent  
**Priority:** P0  
**Story Points:** 21  
**Sprint:** 2

### Detailed Acceptance Criteria

**Business Verification System:**
```sql
-- Verification types and requirements
CREATE TABLE verification_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_code VARCHAR(50) UNIQUE NOT NULL,
  verification_name VARCHAR(100) NOT NULL,
  
  -- Requirements
  required_documents JSONB DEFAULT '[]',
  required_fields TEXT[],
  manual_review_required BOOLEAN DEFAULT FALSE,
  
  -- Validation rules
  validation_rules JSONB DEFAULT '{}',
  
  -- Trust score impact
  trust_score_boost DECIMAL(3,2) DEFAULT 0.1,
  
  -- Display
  badge_name VARCHAR(50),
  badge_icon VARCHAR(100),
  badge_color VARCHAR(7),
  
  active BOOLEAN DEFAULT TRUE
);

INSERT INTO verification_types (
  verification_code, verification_name, required_documents, trust_score_boost
) VALUES
  ('email', 'Email Verified', '[]', 0.05),
  ('phone', 'Phone Verified', '[]', 0.05),
  ('address', 'Address Verified', '["utility_bill", "lease_agreement"]', 0.10),
  ('business_license', 'Licensed Business', '["business_license"]', 0.20),
  ('insurance', 'Insured', '["insurance_certificate"]', 0.15),
  ('identity', 'Owner Identity Verified', '["government_id"]', 0.10);

-- Business verification records
CREATE TABLE business_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  verification_type_id UUID REFERENCES verification_types(id),
  
  -- Status
  status VARCHAR(20) CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'expired')),
  
  -- Documents
  submitted_documents JSONB DEFAULT '[]',
  document_urls TEXT[],
  
  -- Review process
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  rejection_reason TEXT,
  
  -- Validity
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trust score calculation
CREATE OR REPLACE FUNCTION calculate_trust_score(p_business_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  base_score DECIMAL := 0.3; -- Base score for active business
  verification_score DECIMAL := 0;
  review_score DECIMAL := 0;
  activity_score DECIMAL := 0;
  total_score DECIMAL;
BEGIN
  -- Verification score (up to 0.3)
  SELECT COALESCE(SUM(vt.trust_score_boost), 0)
  INTO verification_score
  FROM business_verifications bv
  JOIN verification_types vt ON bv.verification_type_id = vt.id
  WHERE bv.business_id = p_business_id
  AND bv.status = 'approved'
  AND (bv.expires_at IS NULL OR bv.expires_at > NOW());
  
  -- Review score (up to 0.2)
  SELECT 
    CASE
      WHEN AVG(rating) >= 4.5 AND COUNT(*) >= 10 THEN 0.2
      WHEN AVG(rating) >= 4.0 AND COUNT(*) >= 5 THEN 0.15
      WHEN AVG(rating) >= 3.5 THEN 0.1
      ELSE 0.05
    END
  INTO review_score
  FROM business_reviews
  WHERE business_id = p_business_id
  AND status = 'published';
  
  -- Activity score (up to 0.2)
  SELECT 
    CASE
      WHEN last_activity_at > NOW() - INTERVAL '7 days' THEN 0.2
      WHEN last_activity_at > NOW() - INTERVAL '30 days' THEN 0.15
      WHEN last_activity_at > NOW() - INTERVAL '90 days' THEN 0.1
      ELSE 0
    END
  INTO activity_score
  FROM businesses
  WHERE id = p_business_id;
  
  total_score := base_score + verification_score + review_score + activity_score;
  
  -- Update business trust score
  UPDATE businesses 
  SET quality_score = LEAST(1.0, total_score)
  WHERE id = p_business_id;
  
  RETURN LEAST(1.0, total_score);
END;
$$ LANGUAGE plpgsql;

-- Business claim process
CREATE TABLE business_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  claimant_id UUID REFERENCES auth.users(id),
  
  -- Claim details
  claim_method VARCHAR(50), -- 'email', 'phone', 'document'
  claim_token VARCHAR(255) UNIQUE,
  
  -- Verification
  verification_code VARCHAR(10),
  verification_sent_at TIMESTAMPTZ,
  verification_attempts INTEGER DEFAULT 0,
  verified_at TIMESTAMPTZ,
  
  -- Status
  status VARCHAR(20) CHECK (status IN ('pending', 'verified', 'approved', 'rejected', 'expired')),
  
  -- Review
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

-- Business transfer process
CREATE TABLE business_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  from_user_id UUID REFERENCES auth.users(id),
  to_user_id UUID REFERENCES auth.users(id),
  
  -- Transfer details
  transfer_token VARCHAR(255) UNIQUE,
  transfer_reason TEXT,
  
  -- Approval process
  requires_approval BOOLEAN DEFAULT TRUE,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  
  -- Status
  status VARCHAR(20) CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'completed')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  completed_at TIMESTAMPTZ
);
```

### Definition of Done
- [ ] Verification system implemented
- [ ] Trust score calculation working
- [ ] Business claim process functional
- [ ] Transfer process tested
- [ ] Badge display integrated

---

## Story B3.5: Multi-Location Business Management

**User Story:** As a business owner with multiple locations, I want to manage all my locations from a single dashboard with consolidated analytics and billing.

**Assignee:** Backend Architect Agent  
**Priority:** P1  
**Story Points:** 21  
**Sprint:** 3

### Detailed Acceptance Criteria

**Multi-Location Architecture:**
```sql
-- Business groups for multi-location
CREATE TABLE business_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name VARCHAR(255) NOT NULL,
  owner_id UUID REFERENCES auth.users(id),
  
  -- Group settings
  billing_consolidated BOOLEAN DEFAULT TRUE,
  analytics_consolidated BOOLEAN DEFAULT TRUE,
  
  -- Subscription (group-level)
  subscription_id UUID REFERENCES subscriptions(id),
  
  -- Branding
  brand_guidelines JSONB DEFAULT '{}',
  shared_assets JSONB DEFAULT '[]',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link businesses to groups
ALTER TABLE businesses ADD COLUMN group_id UUID REFERENCES business_groups(id);
ALTER TABLE businesses ADD COLUMN is_headquarters BOOLEAN DEFAULT FALSE;

-- Location-specific data
CREATE TABLE business_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  group_id UUID REFERENCES business_groups(id),
  
  -- Location identity
  location_name VARCHAR(255),
  location_code VARCHAR(50) UNIQUE,
  
  -- Management
  location_manager_id UUID REFERENCES auth.users(id),
  
  -- Override parent business data
  custom_hours JSONB,
  custom_description TEXT,
  custom_phone VARCHAR(20),
  
  -- Location-specific features
  delivery_available BOOLEAN DEFAULT FALSE,
  pickup_available BOOLEAN DEFAULT FALSE,
  
  -- Performance tracking
  performance_tier VARCHAR(20),
  
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Consolidated analytics
CREATE OR REPLACE FUNCTION get_group_analytics(
  p_group_id UUID,
  p_date_from DATE,
  p_date_to DATE
)
RETURNS JSONB AS $$
DECLARE
  analytics JSONB;
BEGIN
  WITH location_metrics AS (
    SELECT 
      bl.location_name,
      bl.id as location_id,
      SUM(bm.page_views) as views,
      SUM(bm.unique_visitors) as visitors,
      SUM(bm.conversions) as conversions,
      SUM(bm.conversion_value) as revenue
    FROM business_locations bl
    JOIN business_metrics bm ON bl.business_id = bm.business_id
    WHERE bl.group_id = p_group_id
    AND bm.metric_date BETWEEN p_date_from AND p_date_to
    GROUP BY bl.location_name, bl.id
  )
  SELECT jsonb_build_object(
    'summary', jsonb_build_object(
      'total_views', SUM(views),
      'total_visitors', SUM(visitors),
      'total_conversions', SUM(conversions),
      'total_revenue', SUM(revenue)
    ),
    'by_location', jsonb_agg(
      jsonb_build_object(
        'location_name', location_name,
        'metrics', jsonb_build_object(
          'views', views,
          'visitors', visitors,
          'conversions', conversions,
          'revenue', revenue
        )
      )
    ),
    'best_performing', (
      SELECT location_name 
      FROM location_metrics 
      ORDER BY revenue DESC 
      LIMIT 1
    ),
    'needs_attention', (
      SELECT array_agg(location_name)
      FROM location_metrics
      WHERE conversions = 0
    )
  ) INTO analytics
  FROM location_metrics;
  
  RETURN analytics;
END;
$$ LANGUAGE plpgsql;

-- Location management permissions
CREATE TABLE location_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES business_locations(id),
  user_id UUID REFERENCES auth.users(id),
  
  -- Permissions
  can_edit_info BOOLEAN DEFAULT FALSE,
  can_manage_hours BOOLEAN DEFAULT FALSE,
  can_respond_reviews BOOLEAN DEFAULT FALSE,
  can_view_analytics BOOLEAN DEFAULT FALSE,
  can_manage_staff BOOLEAN DEFAULT FALSE,
  
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(location_id, user_id)
);
```

### Definition of Done
- [ ] Multi-location schema created
- [ ] Group management working
- [ ] Consolidated analytics functional
- [ ] Location permissions enforced
- [ ] Billing consolidation tested

---

## Story B3.6: Marketing Tools & Campaign Management

**User Story:** As a business owner, I want integrated marketing tools to promote my business through email campaigns, social media, and special offers.

**Assignee:** Backend Architect Agent  
**Priority:** P1  
**Story Points:** 21  
**Sprint:** 3

### Detailed Acceptance Criteria

**Marketing Campaign System:**
```sql
-- Marketing campaigns
CREATE TABLE marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  
  -- Campaign details
  campaign_name VARCHAR(255) NOT NULL,
  campaign_type VARCHAR(50), -- 'email', 'social', 'promotion', 'event'
  
  -- Targeting
  target_audience JSONB DEFAULT '{}',
  target_locations GEOGRAPHY(POLYGON, 4326),
  target_segments TEXT[],
  
  -- Content
  subject_line VARCHAR(255),
  content_html TEXT,
  content_text TEXT,
  call_to_action VARCHAR(255),
  landing_url TEXT,
  
  -- Schedule
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  
  -- Budget
  budget_amount DECIMAL(10,2),
  spent_amount DECIMAL(10,2) DEFAULT 0,
  
  -- Performance
  recipients_count INTEGER DEFAULT 0,
  opens_count INTEGER DEFAULT 0,
  clicks_count INTEGER DEFAULT 0,
  conversions_count INTEGER DEFAULT 0,
  
  -- Status
  status VARCHAR(20) CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'canceled')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Special offers and promotions
CREATE TABLE business_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  campaign_id UUID REFERENCES marketing_campaigns(id),
  
  -- Promotion details
  promotion_type VARCHAR(50), -- 'discount', 'bogo', 'free_item', 'special'
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Discount details
  discount_type VARCHAR(20), -- 'percentage', 'fixed', 'variable'
  discount_value DECIMAL(10,2),
  minimum_purchase DECIMAL(10,2),
  
  -- Validity
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  
  -- Redemption
  promo_code VARCHAR(50) UNIQUE,
  max_redemptions INTEGER,
  redemptions_count INTEGER DEFAULT 0,
  max_per_customer INTEGER DEFAULT 1,
  
  -- Targeting
  customer_segments TEXT[],
  new_customers_only BOOLEAN DEFAULT FALSE,
  
  -- Display
  featured BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email marketing lists
CREATE TABLE marketing_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  
  -- List details
  list_name VARCHAR(255) NOT NULL,
  list_type VARCHAR(50), -- 'customers', 'prospects', 'newsletter'
  
  -- Segmentation
  segment_criteria JSONB DEFAULT '{}',
  
  -- Stats
  subscriber_count INTEGER DEFAULT 0,
  active_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Marketing subscribers
CREATE TABLE marketing_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES marketing_lists(id),
  
  -- Subscriber info
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  
  -- Preferences
  preferences JSONB DEFAULT '{}',
  frequency_preference VARCHAR(20), -- 'daily', 'weekly', 'monthly'
  
  -- Engagement
  last_opened_at TIMESTAMPTZ,
  last_clicked_at TIMESTAMPTZ,
  engagement_score DECIMAL(3,2) DEFAULT 0.5,
  
  -- Status
  status VARCHAR(20) CHECK (status IN ('active', 'unsubscribed', 'bounced', 'complained')),
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  
  UNIQUE(list_id, email)
);

-- Campaign analytics
CREATE OR REPLACE FUNCTION calculate_campaign_roi(p_campaign_id UUID)
RETURNS JSONB AS $$
DECLARE
  campaign RECORD;
  roi DECIMAL;
  metrics JSONB;
BEGIN
  SELECT * INTO campaign
  FROM marketing_campaigns
  WHERE id = p_campaign_id;
  
  -- Calculate ROI
  IF campaign.spent_amount > 0 THEN
    roi := ((campaign.conversions_count * 50) - campaign.spent_amount) / campaign.spent_amount * 100;
  ELSE
    roi := 0;
  END IF;
  
  -- Build metrics
  metrics := jsonb_build_object(
    'roi_percentage', roi,
    'cost_per_acquisition', 
      CASE 
        WHEN campaign.conversions_count > 0 
        THEN campaign.spent_amount / campaign.conversions_count
        ELSE 0
      END,
    'open_rate',
      CASE
        WHEN campaign.recipients_count > 0
        THEN campaign.opens_count::DECIMAL / campaign.recipients_count * 100
        ELSE 0
      END,
    'click_rate',
      CASE
        WHEN campaign.opens_count > 0
        THEN campaign.clicks_count::DECIMAL / campaign.opens_count * 100
        ELSE 0
      END,
    'conversion_rate',
      CASE
        WHEN campaign.clicks_count > 0
        THEN campaign.conversions_count::DECIMAL / campaign.clicks_count * 100
        ELSE 0
      END
  );
  
  RETURN metrics;
END;
$$ LANGUAGE plpgsql;
```

### Definition of Done
- [ ] Campaign management system created
- [ ] Promotion system functional
- [ ] Email lists management working
- [ ] ROI calculation accurate
- [ ] Campaign analytics available

---

## Story B3.7: Business Dashboard API Layer

**User Story:** As a frontend developer, I want optimized API functions for the business dashboard that provide all necessary data with minimal database queries.

**Assignee:** Backend Architect Agent  
**Priority:** P0  
**Story Points:** 21  
**Sprint:** 4

### Detailed Acceptance Criteria

**Dashboard API Functions:**
```sql
-- Main dashboard data function
CREATE OR REPLACE FUNCTION api_get_business_dashboard(
  p_business_id UUID,
  p_user_id UUID,
  p_period VARCHAR DEFAULT '30d'
)
RETURNS JSONB AS $$
DECLARE
  dashboard_data JSONB;
  period_start DATE;
  comparison_start DATE;
BEGIN
  -- Calculate periods
  period_start := CASE p_period
    WHEN '7d' THEN CURRENT_DATE - INTERVAL '7 days'
    WHEN '30d' THEN CURRENT_DATE - INTERVAL '30 days'
    WHEN '90d' THEN CURRENT_DATE - INTERVAL '90 days'
    ELSE CURRENT_DATE - INTERVAL '30 days'
  END;
  
  comparison_start := period_start - (CURRENT_DATE - period_start);
  
  -- Check permissions
  IF NOT EXISTS (
    SELECT 1 FROM businesses
    WHERE id = p_business_id
    AND (owner_id = p_user_id OR EXISTS (
      SELECT 1 FROM business_managers
      WHERE business_id = p_business_id
      AND user_id = p_user_id
    ))
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- Build dashboard data
  dashboard_data := jsonb_build_object(
    'overview', (
      SELECT jsonb_build_object(
        'business_name', name,
        'subscription_tier', subscription_tier,
        'verification_status', verification_status,
        'trust_score', quality_score,
        'status', status
      )
      FROM businesses
      WHERE id = p_business_id
    ),
    
    'metrics', (
      SELECT jsonb_build_object(
        'current_period', jsonb_build_object(
          'views', COALESCE(SUM(page_views), 0),
          'visitors', COALESCE(SUM(unique_visitors), 0),
          'conversions', COALESCE(SUM(conversions), 0),
          'revenue', COALESCE(SUM(conversion_value), 0)
        ),
        'previous_period', (
          SELECT jsonb_build_object(
            'views', COALESCE(SUM(page_views), 0),
            'visitors', COALESCE(SUM(unique_visitors), 0),
            'conversions', COALESCE(SUM(conversions), 0),
            'revenue', COALESCE(SUM(conversion_value), 0)
          )
          FROM business_metrics
          WHERE business_id = p_business_id
          AND metric_date BETWEEN comparison_start AND period_start
        ),
        'trends', jsonb_build_object(
          'views_change', 
            CASE WHEN LAG(SUM(page_views)) OVER () > 0
            THEN ((SUM(page_views) - LAG(SUM(page_views)) OVER ()) / LAG(SUM(page_views)) OVER () * 100)
            ELSE 0 END
        )
      )
      FROM business_metrics
      WHERE business_id = p_business_id
      AND metric_date >= period_start
    ),
    
    'recent_reviews', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'rating', rating,
          'title', title,
          'content', LEFT(content, 200),
          'reviewer_name', reviewer_name,
          'created_at', created_at,
          'has_response', EXISTS (
            SELECT 1 FROM business_review_responses
            WHERE review_id = br.id
          )
        ) ORDER BY created_at DESC
      )
      FROM business_reviews br
      WHERE business_id = p_business_id
      AND status = 'published'
      LIMIT 5
    ),
    
    'action_items', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'type', action_type,
          'priority', priority,
          'message', message,
          'action_url', action_url
        ) ORDER BY priority
      )
      FROM (
        -- Unresponded reviews
        SELECT 
          'review_response' as action_type,
          'high' as priority,
          'You have ' || COUNT(*) || ' unresponded reviews' as message,
          '/dashboard/reviews' as action_url
        FROM business_reviews
        WHERE business_id = p_business_id
        AND NOT EXISTS (
          SELECT 1 FROM business_review_responses
          WHERE review_id = business_reviews.id
        )
        HAVING COUNT(*) > 0
        
        UNION ALL
        
        -- Incomplete profile
        SELECT
          'complete_profile' as action_type,
          'medium' as priority,
          'Complete your business profile for better visibility' as message,
          '/dashboard/profile' as action_url
        FROM businesses
        WHERE id = p_business_id
        AND (description IS NULL OR logo_url IS NULL OR gallery = '[]')
        
        UNION ALL
        
        -- Subscription upgrade
        SELECT
          'upgrade_subscription' as action_type,
          'low' as priority,
          'Upgrade to Premium for advanced features' as message,
          '/dashboard/billing' as action_url
        FROM businesses
        WHERE id = p_business_id
        AND subscription_tier = 'free'
      ) actions
    )
  );
  
  RETURN dashboard_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Quick stats API
CREATE OR REPLACE FUNCTION api_get_business_quick_stats(p_business_id UUID)
RETURNS JSONB AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'today', jsonb_build_object(
        'views', COALESCE(SUM(page_views), 0),
        'clicks', COALESCE(SUM(clicks_phone + clicks_website), 0)
      )
    )
    FROM business_metrics
    WHERE business_id = p_business_id
    AND metric_date = CURRENT_DATE
  );
END;
$$ LANGUAGE plpgsql STABLE;
```

### Definition of Done
- [ ] Dashboard API functions created
- [ ] Performance optimized < 100ms
- [ ] Permission checks implemented
- [ ] Caching strategy defined
- [ ] API documentation complete

---

## Story B3.8: Business Communication & Messaging

**User Story:** As a business owner, I want to communicate with customers through integrated messaging with automated responses and conversation tracking.

**Assignee:** Backend Architect Agent  
**Priority:** P2  
**Story Points:** 21  
**Sprint:** 4

### Detailed Acceptance Criteria

**Messaging System:**
```sql
-- Business conversations
CREATE TABLE business_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  customer_id UUID REFERENCES auth.users(id),
  
  -- Conversation details
  subject VARCHAR(255),
  status VARCHAR(20) CHECK (status IN ('open', 'pending', 'resolved', 'archived')),
  priority VARCHAR(20) CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  -- Assignment
  assigned_to UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ,
  
  -- Metadata
  channel VARCHAR(50), -- 'website', 'email', 'sms', 'social'
  tags TEXT[],
  
  -- Metrics
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE business_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES business_conversations(id),
  
  -- Message details
  sender_id UUID REFERENCES auth.users(id),
  sender_type VARCHAR(20) CHECK (sender_type IN ('customer', 'business', 'system')),
  
  -- Content
  message_text TEXT NOT NULL,
  message_html TEXT,
  attachments JSONB DEFAULT '[]',
  
  -- Status
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  
  -- AI features
  auto_generated BOOLEAN DEFAULT FALSE,
  sentiment_score DECIMAL(3,2),
  intent_classification VARCHAR(50)
);

-- Automated responses
CREATE TABLE auto_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  
  -- Trigger
  trigger_type VARCHAR(50), -- 'greeting', 'out_of_hours', 'keyword'
  trigger_keywords TEXT[],
  trigger_schedule JSONB, -- {days: [], hours: {from: 9, to: 17}}
  
  -- Response
  response_text TEXT NOT NULL,
  response_delay_seconds INTEGER DEFAULT 0,
  
  -- Settings
  enabled BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message routing rules
CREATE OR REPLACE FUNCTION route_message(p_conversation_id UUID)
RETURNS UUID AS $$
DECLARE
  conversation RECORD;
  assigned_user UUID;
BEGIN
  SELECT * INTO conversation
  FROM business_conversations
  WHERE id = p_conversation_id;
  
  -- Priority routing
  IF conversation.priority = 'urgent' THEN
    -- Assign to first available manager
    SELECT user_id INTO assigned_user
    FROM business_managers
    WHERE business_id = conversation.business_id
    AND is_available = TRUE
    ORDER BY last_assigned_at NULLS FIRST
    LIMIT 1;
  ELSE
    -- Round-robin assignment
    SELECT user_id INTO assigned_user
    FROM business_managers
    WHERE business_id = conversation.business_id
    ORDER BY last_assigned_at NULLS FIRST
    LIMIT 1;
  END IF;
  
  -- Update assignment
  UPDATE business_conversations
  SET assigned_to = assigned_user,
      assigned_at = NOW()
  WHERE id = p_conversation_id;
  
  -- Update manager's last assignment
  UPDATE business_managers
  SET last_assigned_at = NOW()
  WHERE user_id = assigned_user;
  
  RETURN assigned_user;
END;
$$ LANGUAGE plpgsql;
```

### Definition of Done
- [ ] Messaging schema created
- [ ] Auto-response system working
- [ ] Message routing functional
- [ ] Conversation tracking complete
- [ ] Performance optimized

---

## Story B3.9: Business Notifications & Alerts

**User Story:** As a business owner, I want real-time notifications for important business events with customizable alert preferences.

**Assignee:** Backend Architect Agent  
**Priority:** P1  
**Story Points:** 13  
**Sprint:** 5

### Detailed Acceptance Criteria

**Notification System:**
```sql
-- Notification templates
CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_code VARCHAR(50) UNIQUE NOT NULL,
  template_name VARCHAR(100),
  
  -- Content templates
  email_subject VARCHAR(255),
  email_body TEXT,
  sms_body VARCHAR(500),
  push_title VARCHAR(100),
  push_body VARCHAR(255),
  in_app_message TEXT,
  
  -- Variables
  variables JSONB DEFAULT '[]', -- ['business_name', 'review_rating', etc]
  
  active BOOLEAN DEFAULT TRUE
);

-- User notification preferences
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  business_id UUID REFERENCES businesses(id),
  
  -- Channel preferences
  email_enabled BOOLEAN DEFAULT TRUE,
  sms_enabled BOOLEAN DEFAULT FALSE,
  push_enabled BOOLEAN DEFAULT TRUE,
  in_app_enabled BOOLEAN DEFAULT TRUE,
  
  -- Event preferences
  new_review BOOLEAN DEFAULT TRUE,
  review_response BOOLEAN DEFAULT TRUE,
  low_rating_alert BOOLEAN DEFAULT TRUE,
  
  milestone_alerts BOOLEAN DEFAULT TRUE,
  competitor_alerts BOOLEAN DEFAULT FALSE,
  
  marketing_emails BOOLEAN DEFAULT TRUE,
  product_updates BOOLEAN DEFAULT TRUE,
  
  -- Frequency
  digest_frequency VARCHAR(20), -- 'instant', 'hourly', 'daily', 'weekly'
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, business_id)
);

-- Notification queue
CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES auth.users(id),
  business_id UUID REFERENCES businesses(id),
  
  -- Notification details
  notification_type VARCHAR(50),
  channel VARCHAR(20) CHECK (channel IN ('email', 'sms', 'push', 'in_app')),
  
  -- Content
  subject VARCHAR(255),
  body TEXT,
  data JSONB DEFAULT '{}',
  
  -- Processing
  status VARCHAR(20) CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'canceled')),
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Tracking
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Real-time notification trigger
CREATE OR REPLACE FUNCTION send_notification(
  p_user_id UUID,
  p_notification_type VARCHAR,
  p_data JSONB
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
  prefs RECORD;
BEGIN
  -- Get user preferences
  SELECT * INTO prefs
  FROM notification_preferences
  WHERE user_id = p_user_id;
  
  -- Check if notification should be sent
  IF prefs IS NULL OR 
     (prefs.digest_frequency != 'instant' AND p_notification_type != 'urgent') THEN
    RETURN NULL;
  END IF;
  
  -- Queue notifications based on preferences
  IF prefs.email_enabled THEN
    INSERT INTO notification_queue (
      recipient_id, notification_type, channel, data
    ) VALUES (
      p_user_id, p_notification_type, 'email', p_data
    ) RETURNING id INTO notification_id;
  END IF;
  
  IF prefs.push_enabled THEN
    INSERT INTO notification_queue (
      recipient_id, notification_type, channel, data
    ) VALUES (
      p_user_id, p_notification_type, 'push', p_data
    );
  END IF;
  
  -- Trigger real-time notification
  PERFORM pg_notify('notifications', json_build_object(
    'user_id', p_user_id,
    'type', p_notification_type,
    'data', p_data
  )::text);
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql;
```

### Definition of Done
- [ ] Notification system created
- [ ] Preference management working
- [ ] Queue processing functional
- [ ] Real-time notifications tested
- [ ] Delivery tracking implemented

---

## Story B3.10: Business Insights & Recommendations

**User Story:** As a business owner, I want AI-powered insights and recommendations to improve my business performance based on data analysis.

**Assignee:** Backend Architect Agent  
**Priority:** P2  
**Story Points:** 21  
**Sprint:** 5

### Detailed Acceptance Criteria

**Business Intelligence System:**
```sql
-- Business insights
CREATE TABLE business_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  
  -- Insight details
  insight_type VARCHAR(50), -- 'performance', 'opportunity', 'warning', 'trend'
  insight_category VARCHAR(50), -- 'revenue', 'engagement', 'competition', 'operations'
  
  -- Content
  title VARCHAR(255),
  description TEXT,
  
  -- Metrics
  impact_score DECIMAL(3,2), -- 0-1 potential impact
  confidence_score DECIMAL(3,2), -- 0-1 confidence level
  
  -- Recommendations
  recommendations JSONB DEFAULT '[]',
  action_items JSONB DEFAULT '[]',
  
  -- Tracking
  viewed_at TIMESTAMPTZ,
  acted_upon BOOLEAN DEFAULT FALSE,
  feedback VARCHAR(20), -- 'helpful', 'not_helpful', 'neutral'
  
  -- Validity
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ML model predictions
CREATE TABLE ml_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  
  -- Prediction details
  model_name VARCHAR(50),
  model_version VARCHAR(20),
  prediction_type VARCHAR(50), -- 'churn', 'growth', 'revenue'
  
  -- Results
  prediction_value DECIMAL(10,2),
  confidence_interval JSONB, -- {lower: 100, upper: 200}
  probability DECIMAL(3,2),
  
  -- Features used
  input_features JSONB,
  feature_importance JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generate business insights
CREATE OR REPLACE FUNCTION generate_business_insights(p_business_id UUID)
RETURNS VOID AS $$
DECLARE
  metrics RECORD;
  competitors RECORD;
BEGIN
  -- Get recent metrics
  SELECT * INTO metrics
  FROM business_analytics_daily
  WHERE business_id = p_business_id
  ORDER BY metric_date DESC
  LIMIT 30;
  
  -- Performance insights
  IF metrics.conversion_rate < 0.02 THEN
    INSERT INTO business_insights (
      business_id, insight_type, insight_category,
      title, description, impact_score, confidence_score,
      recommendations
    ) VALUES (
      p_business_id, 'opportunity', 'engagement',
      'Low Conversion Rate Detected',
      'Your conversion rate is below industry average',
      0.8, 0.9,
      jsonb_build_array(
        'Optimize your call-to-action buttons',
        'Add customer testimonials',
        'Improve page load speed'
      )
    );
  END IF;
  
  -- Competitor insights
  FOR competitors IN
    SELECT * FROM analyze_competitors(p_business_id, 5)
  LOOP
    IF competitors.avg_rating > (
      SELECT quality_score FROM businesses WHERE id = p_business_id
    ) THEN
      INSERT INTO business_insights (
        business_id, insight_type, insight_category,
        title, description, impact_score
      ) VALUES (
        p_business_id, 'warning', 'competition',
        'Competitor Advantage Detected',
        competitors.competitor_name || ' has higher ratings in your area',
        0.7
      );
    END IF;
  END LOOP;
  
  -- Trend insights
  WITH trend_analysis AS (
    SELECT 
      regr_slope(page_views, EXTRACT(EPOCH FROM metric_date)) as view_trend,
      regr_slope(conversions, EXTRACT(EPOCH FROM metric_date)) as conversion_trend
    FROM business_metrics
    WHERE business_id = p_business_id
    AND metric_date >= CURRENT_DATE - INTERVAL '30 days'
  )
  INSERT INTO business_insights (
    business_id, insight_type, insight_category,
    title, description
  )
  SELECT 
    p_business_id, 'trend', 'performance',
    CASE 
      WHEN view_trend > 0 THEN 'Traffic Growing'
      ELSE 'Traffic Declining'
    END,
    'Your business traffic trend over the last 30 days'
  FROM trend_analysis;
END;
$$ LANGUAGE plpgsql;

-- Recommendation engine
CREATE OR REPLACE FUNCTION get_personalized_recommendations(p_business_id UUID)
RETURNS JSONB AS $$
DECLARE
  business RECORD;
  recommendations JSONB := '[]'::JSONB;
BEGIN
  SELECT * INTO business FROM businesses WHERE id = p_business_id;
  
  -- Profile completion recommendations
  IF business.description IS NULL OR LENGTH(business.description) < 100 THEN
    recommendations := recommendations || jsonb_build_object(
      'type', 'profile',
      'priority', 'high',
      'title', 'Complete Your Business Description',
      'action', 'A detailed description improves search visibility by 40%'
    );
  END IF;
  
  -- Photo recommendations
  IF business.gallery = '[]' OR jsonb_array_length(business.gallery) < 5 THEN
    recommendations := recommendations || jsonb_build_object(
      'type', 'content',
      'priority', 'high',
      'title', 'Add More Photos',
      'action', 'Businesses with 5+ photos get 50% more engagement'
    );
  END IF;
  
  -- Review response recommendations
  IF EXISTS (
    SELECT 1 FROM business_reviews
    WHERE business_id = p_business_id
    AND NOT EXISTS (
      SELECT 1 FROM business_review_responses
      WHERE review_id = business_reviews.id
    )
    LIMIT 1
  ) THEN
    recommendations := recommendations || jsonb_build_object(
      'type', 'engagement',
      'priority', 'urgent',
      'title', 'Respond to Reviews',
      'action', 'Responding to reviews increases trust by 35%'
    );
  END IF;
  
  RETURN recommendations;
END;
$$ LANGUAGE plpgsql;
```

### Definition of Done
- [ ] Insights schema created
- [ ] ML prediction tables ready
- [ ] Insight generation working
- [ ] Recommendation engine functional
- [ ] Performance optimized

---

## Epic Success Metrics & Validation

### Key Performance Indicators (KPIs)

**Business Metrics:**
- Subscription conversion rate > 25% ✓
- Average revenue per user (ARPU) > $75/mo ✓
- Churn rate < 5% monthly ✓
- Feature adoption rate > 60% ✓

**Technical Metrics:**
- Dashboard load time < 200ms ✓
- Analytics query time < 100ms ✓
- Real-time update latency < 500ms ✓
- API response time < 50ms (P95) ✓

**Engagement Metrics:**
- Daily active businesses > 60% ✓
- Review response rate > 70% ✓
- Campaign creation rate > 40% ✓
- Insight action rate > 30% ✓

**Data Quality:**
- Data accuracy > 99.9% ✓
- Analytics freshness < 5 minutes ✓
- Insight relevance score > 0.7 ✓
- Recommendation CTR > 15% ✓

### Testing Requirements

**Performance Tests:**
- Load testing with 10K concurrent businesses
- Analytics processing with 1M+ events/day
- Dashboard rendering < 200ms
- Subscription billing accuracy 100%

**Integration Tests:**
- Stripe payment flow end-to-end
- Multi-location data aggregation
- Campaign delivery verification
- Notification delivery rates > 95%

### Documentation Deliverables

- [ ] Business portal API documentation
- [ ] Subscription tier feature matrix
- [ ] Analytics schema documentation
- [ ] Marketing tools user guide
- [ ] Dashboard performance guide
- [ ] Multi-location setup guide
- [ ] Insights algorithm documentation
- [ ] Integration test suite

---

**Epic Status:** Ready for Implementation  
**Dependencies:** Epic 1 (Database), Epic 2 (Auth)  
**Next Steps:** Begin Sprint 1 with subscription architecture
