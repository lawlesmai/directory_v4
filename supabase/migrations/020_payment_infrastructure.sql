-- =============================================
-- EPIC 5 STORY 5.1: Stripe Integration & Payment Infrastructure
-- Payment Database Schema Migration
-- =============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- STRIPE CUSTOMER PROFILES
-- Manages customer payment profiles and billing information
-- =============================================

CREATE TABLE IF NOT EXISTS stripe_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  phone VARCHAR(50),
  default_payment_method VARCHAR(255),
  tax_id VARCHAR(255),
  tax_exempt VARCHAR(20) DEFAULT 'none', -- none, exempt, reverse
  billing_address JSONB DEFAULT '{}',
  shipping_address JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  balance INTEGER DEFAULT 0, -- in cents
  currency VARCHAR(3) DEFAULT 'USD',
  delinquent BOOLEAN DEFAULT FALSE,
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT stripe_customers_user_or_business CHECK (
    (user_id IS NOT NULL AND business_id IS NULL) OR 
    (user_id IS NULL AND business_id IS NOT NULL)
  )
);

-- =============================================
-- PAYMENT METHODS
-- Manages customer payment methods and cards
-- =============================================

CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_payment_method_id VARCHAR(255) UNIQUE NOT NULL,
  customer_id UUID REFERENCES stripe_customers(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- card, bank_account, ach_debit, etc.
  card_brand VARCHAR(50), -- visa, mastercard, amex, etc.
  card_last4 VARCHAR(4),
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  card_country VARCHAR(2),
  billing_details JSONB DEFAULT '{}',
  is_default BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, expired
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- SUBSCRIPTION PLANS
-- Manages available subscription plans and pricing
-- =============================================

CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_price_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_product_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  amount INTEGER NOT NULL, -- in cents
  currency VARCHAR(3) DEFAULT 'USD',
  interval VARCHAR(20) NOT NULL, -- month, year
  interval_count INTEGER DEFAULT 1,
  trial_period_days INTEGER DEFAULT 0,
  usage_type VARCHAR(20) DEFAULT 'licensed', -- licensed, metered
  billing_scheme VARCHAR(20) DEFAULT 'per_unit',
  tier_mode VARCHAR(20), -- graduated, volume
  tiers JSONB DEFAULT '[]',
  transform_usage JSONB,
  active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  features JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- SUBSCRIPTIONS
-- Manages active subscriptions and their lifecycle
-- =============================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
  customer_id UUID REFERENCES stripe_customers(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id),
  status VARCHAR(50) NOT NULL, -- active, canceled, incomplete, past_due, trialing, etc.
  quantity INTEGER DEFAULT 1,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  cancel_at TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  collection_method VARCHAR(20) DEFAULT 'charge_automatically',
  days_until_due INTEGER,
  default_payment_method VARCHAR(255),
  latest_invoice VARCHAR(255),
  pending_setup_intent VARCHAR(255),
  discount JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INVOICES
-- Manages invoice generation and payment tracking
-- =============================================

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_invoice_id VARCHAR(255) UNIQUE NOT NULL,
  customer_id UUID REFERENCES stripe_customers(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL, -- draft, open, paid, void, uncollectible
  amount_due INTEGER NOT NULL, -- in cents
  amount_paid INTEGER DEFAULT 0, -- in cents
  amount_remaining INTEGER DEFAULT 0, -- in cents
  subtotal INTEGER NOT NULL, -- in cents
  tax INTEGER DEFAULT 0, -- in cents
  total INTEGER NOT NULL, -- in cents
  currency VARCHAR(3) DEFAULT 'USD',
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  due_date TIMESTAMP WITH TIME ZONE,
  next_payment_attempt TIMESTAMP WITH TIME ZONE,
  attempt_count INTEGER DEFAULT 0,
  attempted BOOLEAN DEFAULT FALSE,
  auto_advance BOOLEAN DEFAULT FALSE,
  billing_reason VARCHAR(50), -- subscription_cycle, manual, etc.
  collection_method VARCHAR(20) DEFAULT 'charge_automatically',
  invoice_pdf VARCHAR(500),
  hosted_invoice_url VARCHAR(500),
  receipt_number VARCHAR(255),
  finalized_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  void_at TIMESTAMP WITH TIME ZONE,
  webhooks_delivered_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- PAYMENT TRANSACTIONS
-- Comprehensive payment transaction history
-- =============================================

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_charge_id VARCHAR(255),
  customer_id UUID REFERENCES stripe_customers(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL, -- in cents
  amount_received INTEGER DEFAULT 0, -- in cents
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50) NOT NULL, -- requires_payment_method, requires_confirmation, succeeded, canceled, etc.
  payment_method_id VARCHAR(255),
  payment_method_type VARCHAR(50), -- card, bank_account, etc.
  confirmation_method VARCHAR(20) DEFAULT 'automatic',
  capture_method VARCHAR(20) DEFAULT 'automatic',
  setup_future_usage VARCHAR(20), -- off_session, on_session
  receipt_email VARCHAR(255),
  receipt_url VARCHAR(500),
  description TEXT,
  statement_descriptor VARCHAR(22),
  statement_descriptor_suffix VARCHAR(10),
  shipping JSONB,
  failure_code VARCHAR(100),
  failure_message TEXT,
  outcome JSONB,
  risk_level VARCHAR(20), -- normal, elevated, highest
  risk_score INTEGER,
  paid BOOLEAN DEFAULT FALSE,
  refunded BOOLEAN DEFAULT FALSE,
  refund_amount INTEGER DEFAULT 0, -- in cents
  dispute_amount INTEGER DEFAULT 0, -- in cents
  fee_amount INTEGER DEFAULT 0, -- Stripe fees in cents
  net_amount INTEGER DEFAULT 0, -- amount after fees in cents
  metadata JSONB DEFAULT '{}',
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- PAYMENT REFUNDS
-- Manages refund transactions and history
-- =============================================

CREATE TABLE IF NOT EXISTS payment_refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_refund_id VARCHAR(255) UNIQUE NOT NULL,
  charge_id VARCHAR(255) NOT NULL,
  payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- in cents
  currency VARCHAR(3) DEFAULT 'USD',
  reason VARCHAR(50), -- duplicate, fraudulent, requested_by_customer
  status VARCHAR(20) NOT NULL, -- pending, succeeded, failed, canceled
  failure_reason VARCHAR(100),
  receipt_number VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- WEBHOOK EVENTS
-- Tracks Stripe webhook events for audit and processing
-- =============================================

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
  type VARCHAR(100) NOT NULL,
  api_version VARCHAR(20),
  data JSONB NOT NULL,
  object_id VARCHAR(255),
  livemode BOOLEAN DEFAULT FALSE,
  pending_webhooks INTEGER DEFAULT 0,
  request_id VARCHAR(255),
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- PAYMENT DISPUTES
-- Manages chargebacks and disputes
-- =============================================

CREATE TABLE IF NOT EXISTS payment_disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_dispute_id VARCHAR(255) UNIQUE NOT NULL,
  charge_id VARCHAR(255) NOT NULL,
  payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- in cents
  currency VARCHAR(3) DEFAULT 'USD',
  reason VARCHAR(50), -- duplicate, fraudulent, subscription_canceled, etc.
  status VARCHAR(20) NOT NULL, -- warning_needs_response, warning_under_review, warning_closed, etc.
  evidence JSONB DEFAULT '{}',
  evidence_details JSONB DEFAULT '{}',
  is_charge_refundable BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- PAYMENT ANALYTICS
-- Aggregated payment data for reporting and analytics
-- =============================================

CREATE TABLE IF NOT EXISTS payment_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  total_revenue INTEGER DEFAULT 0, -- in cents
  total_transactions INTEGER DEFAULT 0,
  successful_transactions INTEGER DEFAULT 0,
  failed_transactions INTEGER DEFAULT 0,
  refund_amount INTEGER DEFAULT 0, -- in cents
  dispute_amount INTEGER DEFAULT 0, -- in cents
  fee_amount INTEGER DEFAULT 0, -- in cents
  net_revenue INTEGER DEFAULT 0, -- in cents
  new_subscriptions INTEGER DEFAULT 0,
  canceled_subscriptions INTEGER DEFAULT 0,
  active_subscriptions INTEGER DEFAULT 0,
  churn_rate DECIMAL(5,4) DEFAULT 0.0,
  conversion_rate DECIMAL(5,4) DEFAULT 0.0,
  currency VARCHAR(3) DEFAULT 'USD',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(date, currency)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- Optimized indexes for common query patterns
-- =============================================

-- Customer indexes
CREATE INDEX IF NOT EXISTS idx_stripe_customers_user_id ON stripe_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_business_id ON stripe_customers(business_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_email ON stripe_customers(email);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_stripe_id ON stripe_customers(stripe_customer_id);

-- Payment method indexes
CREATE INDEX IF NOT EXISTS idx_payment_methods_customer_id ON payment_methods(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_stripe_id ON payment_methods(stripe_payment_method_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_default ON payment_methods(customer_id, is_default) WHERE is_default = TRUE;

-- Subscription indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_current_period ON subscriptions(current_period_end);

-- Invoice indexes
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON invoices(period_start, period_end);

-- Transaction indexes
CREATE INDEX IF NOT EXISTS idx_payment_transactions_customer_id ON payment_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_stripe_intent ON payment_transactions(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_date ON payment_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_amount ON payment_transactions(amount);

-- Webhook event indexes
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed, created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_id ON webhook_events(stripe_event_id);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_payment_analytics_date ON payment_analytics(date);
CREATE INDEX IF NOT EXISTS idx_payment_analytics_currency ON payment_analytics(currency, date);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Secure access to payment data
-- =============================================

-- Enable RLS on all payment tables
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_analytics ENABLE ROW LEVEL SECURITY;

-- Stripe customers policies
CREATE POLICY "Users can view their own payment profiles" ON stripe_customers
  FOR SELECT USING (
    auth.uid() = user_id OR 
    (business_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM business_members 
      WHERE business_id = stripe_customers.business_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'billing')
    ))
  );

-- Admins can view all customer data
CREATE POLICY "Admins can manage all payment profiles" ON stripe_customers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'super_admin')
    )
  );

-- Payment methods policies
CREATE POLICY "Users can manage their payment methods" ON payment_methods
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM stripe_customers 
      WHERE id = payment_methods.customer_id 
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

-- Subscription plans are public (read-only)
CREATE POLICY "Anyone can view subscription plans" ON subscription_plans
  FOR SELECT USING (active = TRUE);

-- Admins can manage subscription plans
CREATE POLICY "Admins can manage subscription plans" ON subscription_plans
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'super_admin')
    )
  );

-- Subscriptions policies
CREATE POLICY "Users can view their subscriptions" ON subscriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stripe_customers 
      WHERE id = subscriptions.customer_id 
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

-- Invoices policies
CREATE POLICY "Users can view their invoices" ON invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stripe_customers 
      WHERE id = invoices.customer_id 
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

-- Payment transactions policies
CREATE POLICY "Users can view their payment transactions" ON payment_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stripe_customers 
      WHERE id = payment_transactions.customer_id 
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

-- Webhook events - admin only
CREATE POLICY "Admins can manage webhook events" ON webhook_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'super_admin')
    )
  );

-- Payment analytics - admin only
CREATE POLICY "Admins can view payment analytics" ON payment_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- Automated payment processing and maintenance
-- =============================================

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_payment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all payment tables
CREATE TRIGGER update_stripe_customers_updated_at
  BEFORE UPDATE ON stripe_customers
  FOR EACH ROW EXECUTE FUNCTION update_payment_updated_at();

CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_payment_updated_at();

CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_payment_updated_at();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_payment_updated_at();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_payment_updated_at();

CREATE TRIGGER update_payment_transactions_updated_at
  BEFORE UPDATE ON payment_transactions
  FOR EACH ROW EXECUTE FUNCTION update_payment_updated_at();

CREATE TRIGGER update_payment_analytics_updated_at
  BEFORE UPDATE ON payment_analytics
  FOR EACH ROW EXECUTE FUNCTION update_payment_updated_at();

-- Function to ensure only one default payment method per customer
CREATE OR REPLACE FUNCTION ensure_single_default_payment_method()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting a payment method as default, unset others for this customer
  IF NEW.is_default = TRUE THEN
    UPDATE payment_methods 
    SET is_default = FALSE 
    WHERE customer_id = NEW.customer_id 
    AND id != NEW.id 
    AND is_default = TRUE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_default_payment_method_trigger
  BEFORE INSERT OR UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION ensure_single_default_payment_method();

-- Function to calculate net amounts for transactions
CREATE OR REPLACE FUNCTION calculate_transaction_net_amount()
RETURNS TRIGGER AS $$
BEGIN
  NEW.net_amount = NEW.amount_received - NEW.fee_amount - NEW.refund_amount - NEW.dispute_amount;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_transaction_net_amount_trigger
  BEFORE INSERT OR UPDATE ON payment_transactions
  FOR EACH ROW EXECUTE FUNCTION calculate_transaction_net_amount();

-- =============================================
-- SEED DATA
-- Default subscription plans and configuration
-- =============================================

-- Insert default subscription plans (will be updated via API with real Stripe data)
INSERT INTO subscription_plans (
  stripe_price_id, 
  stripe_product_id, 
  name, 
  description, 
  amount, 
  currency, 
  interval, 
  features
) VALUES 
  (
    'price_starter', 
    'prod_starter',
    'Starter Plan',
    'Perfect for small businesses getting started',
    2900, -- $29.00
    'USD',
    'month',
    '["Basic business listing", "5 photos", "Customer reviews", "Basic analytics"]'
  ),
  (
    'price_professional',
    'prod_professional', 
    'Professional Plan',
    'Advanced features for growing businesses',
    7900, -- $79.00
    'USD',
    'month',
    '["Everything in Starter", "Unlimited photos", "Advanced analytics", "Priority support", "API access"]'
  ),
  (
    'price_enterprise',
    'prod_enterprise',
    'Enterprise Plan', 
    'Full-featured solution for large organizations',
    19900, -- $199.00
    'USD',
    'month',
    '["Everything in Professional", "Multi-location management", "Custom branding", "Dedicated support", "Advanced integrations"]'
  );

-- =============================================
-- COMMENTS AND DOCUMENTATION
-- =============================================

COMMENT ON TABLE stripe_customers IS 'Stripe customer profiles linked to platform users or businesses';
COMMENT ON TABLE payment_methods IS 'Customer payment methods and card information';
COMMENT ON TABLE subscription_plans IS 'Available subscription plans and pricing tiers';
COMMENT ON TABLE subscriptions IS 'Active subscriptions and their current status';
COMMENT ON TABLE invoices IS 'Generated invoices and payment requests';
COMMENT ON TABLE payment_transactions IS 'Complete payment transaction history with detailed status';
COMMENT ON TABLE payment_refunds IS 'Refund transactions and processing status';
COMMENT ON TABLE webhook_events IS 'Stripe webhook events for audit trail and processing queue';
COMMENT ON TABLE payment_disputes IS 'Chargeback and dispute management';
COMMENT ON TABLE payment_analytics IS 'Daily aggregated payment metrics for reporting';

-- Migration complete notification
SELECT 'Payment infrastructure migration completed successfully' as status;