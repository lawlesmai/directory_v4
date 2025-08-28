-- =============================================
-- EPIC 5 STORY 5.7: Payment Failure Recovery & Dunning Management
-- Payment Failure Recovery Database Schema Migration
-- =============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PAYMENT FAILURES
-- Tracks payment failures and retry attempts
-- =============================================

CREATE TABLE IF NOT EXISTS payment_failures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES stripe_customers(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  payment_intent_id VARCHAR(255),
  failure_reason VARCHAR(100) NOT NULL, -- card_declined, insufficient_funds, expired_card, etc.
  failure_code VARCHAR(50), -- decline_code from Stripe
  failure_message TEXT,
  amount INTEGER NOT NULL, -- in cents
  currency VARCHAR(3) DEFAULT 'USD',
  payment_method_id VARCHAR(255),
  retry_count INTEGER DEFAULT 0,
  max_retry_attempts INTEGER DEFAULT 3,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  last_retry_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'pending', -- pending, retrying, resolved, abandoned
  resolution_type VARCHAR(50), -- payment_succeeded, payment_method_updated, subscription_canceled
  resolved_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- DUNNING CAMPAIGNS
-- Manages customer communication sequences
-- =============================================

CREATE TABLE IF NOT EXISTS dunning_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES stripe_customers(id) ON DELETE CASCADE,
  payment_failure_id UUID REFERENCES payment_failures(id) ON DELETE CASCADE,
  campaign_type VARCHAR(50) NOT NULL, -- standard, high_value, at_risk
  sequence_step INTEGER DEFAULT 1, -- 1, 3, 7, 10, 30 (day sequence)
  status VARCHAR(50) DEFAULT 'active', -- active, paused, completed, canceled
  current_step_status VARCHAR(50) DEFAULT 'pending', -- pending, sent, delivered, opened, clicked, failed
  total_steps INTEGER DEFAULT 5,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  next_communication_at TIMESTAMP WITH TIME ZONE,
  last_communication_at TIMESTAMP WITH TIME ZONE,
  communication_channels JSONB DEFAULT '["email"]', -- ["email", "sms", "in_app"]
  personalization_data JSONB DEFAULT '{}',
  ab_test_group VARCHAR(50), -- control, variant_a, variant_b
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- DUNNING COMMUNICATIONS
-- Individual communication attempts and responses
-- =============================================

CREATE TABLE IF NOT EXISTS dunning_communications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES dunning_campaigns(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES stripe_customers(id) ON DELETE CASCADE,
  communication_type VARCHAR(50) NOT NULL, -- email, sms, in_app, push
  template_id VARCHAR(255),
  subject VARCHAR(500),
  content TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, delivered, opened, clicked, bounced, failed
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  bounced_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  tracking_id VARCHAR(255),
  external_message_id VARCHAR(255), -- Provider message ID
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- ACCOUNT STATES
-- Tracks account suspension and feature restrictions
-- =============================================

CREATE TABLE IF NOT EXISTS account_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES stripe_customers(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  state VARCHAR(50) NOT NULL, -- active, grace_period, restricted, suspended, canceled
  previous_state VARCHAR(50),
  reason VARCHAR(100), -- payment_failure, voluntary_cancellation, etc.
  grace_period_end TIMESTAMP WITH TIME ZONE,
  suspension_date TIMESTAMP WITH TIME ZONE,
  reactivation_date TIMESTAMP WITH TIME ZONE,
  feature_restrictions JSONB DEFAULT '[]', -- Array of restricted features
  data_retention_period INTEGER DEFAULT 90, -- Days to retain data after cancellation
  automated_actions JSONB DEFAULT '{}', -- Actions taken automatically
  manual_override BOOLEAN DEFAULT FALSE,
  override_reason TEXT,
  override_by UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- RECOVERY ANALYTICS
-- Tracks recovery campaign performance
-- =============================================

CREATE TABLE IF NOT EXISTS recovery_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  campaign_type VARCHAR(50) NOT NULL,
  ab_test_group VARCHAR(50),
  failure_reason VARCHAR(100),
  customer_segment VARCHAR(50), -- new, existing, high_value, at_risk
  total_failures INTEGER DEFAULT 0,
  total_campaigns_started INTEGER DEFAULT 0,
  total_campaigns_completed INTEGER DEFAULT 0,
  total_communications_sent INTEGER DEFAULT 0,
  email_open_rate DECIMAL(5,4) DEFAULT 0.0,
  email_click_rate DECIMAL(5,4) DEFAULT 0.0,
  sms_response_rate DECIMAL(5,4) DEFAULT 0.0,
  recovery_rate DECIMAL(5,4) DEFAULT 0.0, -- Percentage of failures recovered
  revenue_recovered INTEGER DEFAULT 0, -- in cents
  recovery_time_avg INTEGER DEFAULT 0, -- Average time to recovery in hours
  cost_per_recovery INTEGER DEFAULT 0, -- Cost in cents
  roi_percentage DECIMAL(8,4) DEFAULT 0.0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(date, campaign_type, COALESCE(ab_test_group, 'default'), COALESCE(failure_reason, 'all'), customer_segment)
);

-- =============================================
-- RECOVERY OFFERS
-- Manages recovery incentives and promotions
-- =============================================

CREATE TABLE IF NOT EXISTS recovery_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  offer_type VARCHAR(50) NOT NULL, -- discount, trial_extension, payment_plan, free_month
  target_segment VARCHAR(50), -- new, existing, high_value, at_risk
  discount_percentage DECIMAL(5,2),
  discount_amount INTEGER, -- in cents
  trial_extension_days INTEGER,
  payment_plan_months INTEGER,
  eligibility_criteria JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5,4) DEFAULT 0.0,
  revenue_impact INTEGER DEFAULT 0, -- in cents
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- CUSTOMER RECOVERY OFFERS
-- Tracks which offers were presented to customers
-- =============================================

CREATE TABLE IF NOT EXISTS customer_recovery_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES stripe_customers(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES dunning_campaigns(id) ON DELETE SET NULL,
  offer_id UUID REFERENCES recovery_offers(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'offered', -- offered, accepted, declined, expired
  presented_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  declined_at TIMESTAMP WITH TIME ZONE,
  expired_at TIMESTAMP WITH TIME ZONE,
  stripe_coupon_id VARCHAR(255),
  stripe_promotion_code VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- PAYMENT METHOD HEALTH
-- Tracks payment method success rates and recommendations
-- =============================================

CREATE TABLE IF NOT EXISTS payment_method_health (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES stripe_customers(id) ON DELETE CASCADE,
  payment_method_id VARCHAR(255) NOT NULL,
  success_rate DECIMAL(5,4) DEFAULT 0.0,
  failure_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  last_successful_payment TIMESTAMP WITH TIME ZONE,
  last_failed_payment TIMESTAMP WITH TIME ZONE,
  common_failure_reasons JSONB DEFAULT '[]',
  health_score DECIMAL(3,2) DEFAULT 0.0, -- 0.0 to 1.0
  recommendation VARCHAR(50), -- update_payment_method, contact_bank, try_alternative
  blocked_until TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(customer_id, payment_method_id)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- Optimized indexes for recovery system queries
-- =============================================

-- Payment failures indexes
CREATE INDEX IF NOT EXISTS idx_payment_failures_customer_id ON payment_failures(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_failures_status ON payment_failures(status);
CREATE INDEX IF NOT EXISTS idx_payment_failures_next_retry ON payment_failures(next_retry_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_payment_failures_failure_reason ON payment_failures(failure_reason);
CREATE INDEX IF NOT EXISTS idx_payment_failures_created_at ON payment_failures(created_at);

-- Dunning campaigns indexes
CREATE INDEX IF NOT EXISTS idx_dunning_campaigns_customer_id ON dunning_campaigns(customer_id);
CREATE INDEX IF NOT EXISTS idx_dunning_campaigns_status ON dunning_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_dunning_campaigns_next_communication ON dunning_campaigns(next_communication_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_dunning_campaigns_payment_failure ON dunning_campaigns(payment_failure_id);

-- Dunning communications indexes
CREATE INDEX IF NOT EXISTS idx_dunning_communications_campaign_id ON dunning_communications(campaign_id);
CREATE INDEX IF NOT EXISTS idx_dunning_communications_status ON dunning_communications(status);
CREATE INDEX IF NOT EXISTS idx_dunning_communications_type ON dunning_communications(communication_type);
CREATE INDEX IF NOT EXISTS idx_dunning_communications_tracking_id ON dunning_communications(tracking_id);

-- Account states indexes
CREATE INDEX IF NOT EXISTS idx_account_states_customer_id ON account_states(customer_id);
CREATE INDEX IF NOT EXISTS idx_account_states_state ON account_states(state);
CREATE INDEX IF NOT EXISTS idx_account_states_grace_period ON account_states(grace_period_end) WHERE state = 'grace_period';

-- Recovery analytics indexes
CREATE INDEX IF NOT EXISTS idx_recovery_analytics_date ON recovery_analytics(date);
CREATE INDEX IF NOT EXISTS idx_recovery_analytics_campaign_type ON recovery_analytics(campaign_type, date);
CREATE INDEX IF NOT EXISTS idx_recovery_analytics_segment ON recovery_analytics(customer_segment, date);

-- Payment method health indexes
CREATE INDEX IF NOT EXISTS idx_payment_method_health_customer ON payment_method_health(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_method_health_score ON payment_method_health(health_score);
CREATE INDEX IF NOT EXISTS idx_payment_method_health_blocked ON payment_method_health(blocked_until) WHERE blocked_until IS NOT NULL;

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Secure access to recovery data
-- =============================================

-- Enable RLS on all recovery tables
ALTER TABLE payment_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE dunning_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE dunning_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_recovery_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_method_health ENABLE ROW LEVEL SECURITY;

-- Payment failures policies
CREATE POLICY "Users can view their payment failures" ON payment_failures
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stripe_customers 
      WHERE id = payment_failures.customer_id 
      AND (
        user_id = auth.uid() OR 
        (business_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM business_members 
          WHERE business_id = stripe_customers.business_id 
          AND user_id = auth.uid() 
          AND role IN ('owner', 'admin', 'billing')
        ))
      )
    )
  );

-- Dunning campaigns policies
CREATE POLICY "Users can view their dunning campaigns" ON dunning_campaigns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stripe_customers 
      WHERE id = dunning_campaigns.customer_id 
      AND (
        user_id = auth.uid() OR 
        (business_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM business_members 
          WHERE business_id = stripe_customers.business_id 
          AND user_id = auth.uid() 
          AND role IN ('owner', 'admin', 'billing')
        ))
      )
    )
  );

-- Account states policies
CREATE POLICY "Users can view their account states" ON account_states
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stripe_customers 
      WHERE id = account_states.customer_id 
      AND (
        user_id = auth.uid() OR 
        (business_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM business_members 
          WHERE business_id = stripe_customers.business_id 
          AND user_id = auth.uid() 
          AND role IN ('owner', 'admin', 'billing')
        ))
      )
    )
  );

-- Recovery offers are public (read-only)
CREATE POLICY "Anyone can view active recovery offers" ON recovery_offers
  FOR SELECT USING (active = TRUE);

-- Customer recovery offers policies
CREATE POLICY "Users can view their recovery offers" ON customer_recovery_offers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stripe_customers 
      WHERE id = customer_recovery_offers.customer_id 
      AND (
        user_id = auth.uid() OR 
        (business_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM business_members 
          WHERE business_id = stripe_customers.business_id 
          AND user_id = auth.uid() 
          AND role IN ('owner', 'admin', 'billing')
        ))
      )
    )
  );

-- Payment method health policies
CREATE POLICY "Users can view their payment method health" ON payment_method_health
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stripe_customers 
      WHERE id = payment_method_health.customer_id 
      AND (
        user_id = auth.uid() OR 
        (business_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM business_members 
          WHERE business_id = stripe_customers.business_id 
          AND user_id = auth.uid() 
          AND role IN ('owner', 'admin', 'billing')
        ))
      )
    )
  );

-- Admin policies for all tables
CREATE POLICY "Admins can manage payment failures" ON payment_failures
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can manage dunning campaigns" ON dunning_campaigns
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can manage recovery analytics" ON recovery_analytics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- Automated recovery processing and maintenance
-- =============================================

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_recovery_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to recovery tables
CREATE TRIGGER update_payment_failures_updated_at
  BEFORE UPDATE ON payment_failures
  FOR EACH ROW EXECUTE FUNCTION update_recovery_updated_at();

CREATE TRIGGER update_dunning_campaigns_updated_at
  BEFORE UPDATE ON dunning_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_recovery_updated_at();

CREATE TRIGGER update_dunning_communications_updated_at
  BEFORE UPDATE ON dunning_communications
  FOR EACH ROW EXECUTE FUNCTION update_recovery_updated_at();

CREATE TRIGGER update_account_states_updated_at
  BEFORE UPDATE ON account_states
  FOR EACH ROW EXECUTE FUNCTION update_recovery_updated_at();

CREATE TRIGGER update_recovery_analytics_updated_at
  BEFORE UPDATE ON recovery_analytics
  FOR EACH ROW EXECUTE FUNCTION update_recovery_updated_at();

-- Function to calculate next retry time based on failure reason
CREATE OR REPLACE FUNCTION calculate_next_retry_time(
  failure_reason TEXT,
  retry_count INTEGER
) RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
  retry_intervals INTEGER[] := ARRAY[1, 3, 7]; -- days
  retry_interval INTEGER;
BEGIN
  -- Determine retry interval based on failure reason and retry count
  CASE failure_reason
    WHEN 'insufficient_funds' THEN
      retry_intervals := ARRAY[1, 3, 7]; -- Slower retry for insufficient funds
    WHEN 'card_declined' THEN
      retry_intervals := ARRAY[1, 2, 5]; -- Medium retry for generic declines
    WHEN 'expired_card' THEN
      retry_intervals := ARRAY[0, 1, 3]; -- Faster retry for expired cards
    WHEN 'authentication_required' THEN
      retry_intervals := ARRAY[0, 1, 2]; -- Very fast retry for 3DS
    ELSE
      retry_intervals := ARRAY[1, 3, 7]; -- Default intervals
  END CASE;
  
  -- Get the appropriate interval or default to last interval if exceeded
  IF retry_count + 1 <= array_length(retry_intervals, 1) THEN
    retry_interval := retry_intervals[retry_count + 1];
  ELSE
    retry_interval := retry_intervals[array_length(retry_intervals, 1)];
  END IF;
  
  -- Add some random jitter (±25%) to avoid thundering herd
  retry_interval := retry_interval + (retry_interval * (random() - 0.5) * 0.5)::INTEGER;
  
  RETURN NOW() + (retry_interval || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically set next retry time
CREATE OR REPLACE FUNCTION set_next_retry_time()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set next retry time if status is pending and we haven't exceeded max attempts
  IF NEW.status = 'pending' AND NEW.retry_count < NEW.max_retry_attempts THEN
    NEW.next_retry_at := calculate_next_retry_time(NEW.failure_reason, NEW.retry_count);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_payment_failure_retry_time
  BEFORE INSERT OR UPDATE ON payment_failures
  FOR EACH ROW EXECUTE FUNCTION set_next_retry_time();

-- Function to update payment method health scores
CREATE OR REPLACE FUNCTION update_payment_method_health_score()
RETURNS TRIGGER AS $$
DECLARE
  total_attempts INTEGER;
  health_score DECIMAL(3,2);
  recommendation VARCHAR(50);
BEGIN
  total_attempts := NEW.success_count + NEW.failure_count;
  
  -- Calculate health score (0.0 to 1.0)
  IF total_attempts > 0 THEN
    health_score := NEW.success_count::DECIMAL / total_attempts;
    
    -- Apply penalties for recent failures
    IF NEW.last_failed_payment > NOW() - INTERVAL '7 days' THEN
      health_score := health_score * 0.8;
    END IF;
    
    -- Apply bonus for recent successes
    IF NEW.last_successful_payment > NOW() - INTERVAL '30 days' THEN
      health_score := LEAST(health_score * 1.1, 1.0);
    END IF;
  ELSE
    health_score := 0.5; -- Neutral score for new payment methods
  END IF;
  
  -- Determine recommendation based on score and patterns
  IF health_score < 0.3 THEN
    recommendation := 'update_payment_method';
  ELSIF health_score < 0.6 AND NEW.failure_count > 2 THEN
    recommendation := 'contact_bank';
  ELSIF health_score < 0.8 THEN
    recommendation := 'try_alternative';
  ELSE
    recommendation := 'healthy';
  END IF;
  
  NEW.health_score := health_score;
  NEW.recommendation := recommendation;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payment_method_health_score_trigger
  BEFORE INSERT OR UPDATE ON payment_method_health
  FOR EACH ROW EXECUTE FUNCTION update_payment_method_health_score();

-- =============================================
-- SEED DATA
-- Default recovery offers and configurations
-- =============================================

-- Insert default recovery offers
INSERT INTO recovery_offers (
  name, 
  offer_type, 
  target_segment,
  discount_percentage,
  trial_extension_days,
  eligibility_criteria,
  active
) VALUES 
  (
    '20% First Month Discount',
    'discount',
    'new',
    20.00,
    NULL,
    '{"min_failure_count": 1, "max_days_since_signup": 30}',
    TRUE
  ),
  (
    '7-Day Trial Extension',
    'trial_extension',
    'existing',
    NULL,
    7,
    '{"min_failure_count": 2, "subscription_status": "trialing"}',
    TRUE
  ),
  (
    'High-Value Customer Recovery',
    'discount',
    'high_value',
    15.00,
    NULL,
    '{"min_lifetime_value": 50000, "min_failure_count": 1}',
    TRUE
  ),
  (
    '3-Month Payment Plan',
    'payment_plan',
    'at_risk',
    NULL,
    NULL,
    '{"min_failure_count": 3, "payment_plan_months": 3}',
    TRUE
  );

-- =============================================
-- COMMENTS AND DOCUMENTATION
-- =============================================

COMMENT ON TABLE payment_failures IS 'Tracks payment failures and manages retry scheduling with intelligent timing';
COMMENT ON TABLE dunning_campaigns IS 'Manages customer communication sequences for payment recovery';
COMMENT ON TABLE dunning_communications IS 'Individual communication attempts with detailed tracking and analytics';
COMMENT ON TABLE account_states IS 'Tracks account status and feature restrictions during recovery process';
COMMENT ON TABLE recovery_analytics IS 'Aggregated recovery performance metrics for optimization and reporting';
COMMENT ON TABLE recovery_offers IS 'Available recovery incentives and promotional offers';
COMMENT ON TABLE customer_recovery_offers IS 'Tracks which offers were presented to which customers';
COMMENT ON TABLE payment_method_health IS 'Monitors payment method performance and provides recommendations';

-- Migration complete notification
SELECT 'Payment failure recovery system migration completed successfully' as status;