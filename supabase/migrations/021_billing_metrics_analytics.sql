-- =============================================
-- EPIC 5 STORY 5.6: Revenue Analytics & Business Intelligence
-- Enhanced Billing Metrics & Analytics Database Schema
-- =============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- BILLING METRICS TABLE
-- Comprehensive metrics storage for analytics
-- =============================================

CREATE TABLE IF NOT EXISTS billing_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  
  -- Revenue Metrics
  mrr INTEGER DEFAULT 0, -- Monthly Recurring Revenue in cents
  arr INTEGER DEFAULT 0, -- Annual Recurring Revenue in cents
  new_mrr INTEGER DEFAULT 0, -- New MRR from new customers
  expansion_mrr INTEGER DEFAULT 0, -- MRR from upgrades/add-ons
  contraction_mrr INTEGER DEFAULT 0, -- MRR lost from downgrades
  churned_mrr INTEGER DEFAULT 0, -- MRR lost from cancellations
  net_new_mrr INTEGER DEFAULT 0, -- Net change in MRR
  
  -- Customer Metrics
  total_customers INTEGER DEFAULT 0,
  new_customers INTEGER DEFAULT 0,
  churned_customers INTEGER DEFAULT 0,
  active_subscribers INTEGER DEFAULT 0,
  trial_users INTEGER DEFAULT 0,
  
  -- Conversion Metrics
  trial_starts INTEGER DEFAULT 0,
  trial_conversions INTEGER DEFAULT 0,
  trial_conversion_rate DECIMAL(5,4) DEFAULT 0.0,
  
  -- Churn Metrics
  customer_churn_rate DECIMAL(5,4) DEFAULT 0.0,
  revenue_churn_rate DECIMAL(5,4) DEFAULT 0.0,
  voluntary_churn INTEGER DEFAULT 0,
  involuntary_churn INTEGER DEFAULT 0,
  
  -- Financial Metrics
  average_revenue_per_user INTEGER DEFAULT 0, -- ARPU in cents
  customer_acquisition_cost INTEGER DEFAULT 0, -- CAC in cents
  customer_lifetime_value INTEGER DEFAULT 0, -- CLV in cents
  ltv_cac_ratio DECIMAL(5,2) DEFAULT 0.0,
  payback_period_months INTEGER DEFAULT 0,
  
  -- Plan Metrics
  plan_metrics JSONB DEFAULT '{}', -- Per-plan breakdowns
  
  -- Geographic Metrics
  geographic_breakdown JSONB DEFAULT '{}', -- Revenue by country/region
  
  -- Payment Metrics
  payment_success_rate DECIMAL(5,4) DEFAULT 0.0,
  failed_payments INTEGER DEFAULT 0,
  payment_retry_success_rate DECIMAL(5,4) DEFAULT 0.0,
  
  -- Cohort Data Reference
  cohort_data JSONB DEFAULT '{}', -- Cohort retention data
  
  -- Forecasting Data
  forecasting_confidence DECIMAL(5,4) DEFAULT 0.0,
  predicted_mrr_next_month INTEGER DEFAULT 0,
  predicted_churn_next_month DECIMAL(5,4) DEFAULT 0.0,
  
  -- Metadata and Timestamps
  currency VARCHAR(3) DEFAULT 'USD',
  calculation_method VARCHAR(50) DEFAULT 'automated',
  data_quality_score DECIMAL(3,2) DEFAULT 1.0,
  metadata JSONB DEFAULT '{}',
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(date, currency)
);

-- =============================================
-- CUSTOMER COHORTS TABLE
-- Detailed cohort analysis tracking
-- =============================================

CREATE TABLE IF NOT EXISTS customer_cohorts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cohort_month DATE NOT NULL, -- First day of cohort month (YYYY-MM-01)
  analysis_month DATE NOT NULL, -- Month being analyzed (YYYY-MM-01)
  
  -- Cohort Metrics
  initial_customers INTEGER NOT NULL DEFAULT 0,
  active_customers INTEGER NOT NULL DEFAULT 0,
  churned_customers INTEGER NOT NULL DEFAULT 0,
  
  -- Revenue Metrics
  initial_mrr INTEGER NOT NULL DEFAULT 0, -- in cents
  current_mrr INTEGER NOT NULL DEFAULT 0, -- in cents
  expansion_mrr INTEGER DEFAULT 0, -- in cents
  contraction_mrr INTEGER DEFAULT 0, -- in cents
  
  -- Retention Rates
  customer_retention_rate DECIMAL(5,4) DEFAULT 0.0,
  revenue_retention_rate DECIMAL(5,4) DEFAULT 0.0,
  net_revenue_retention_rate DECIMAL(5,4) DEFAULT 0.0, -- Includes expansion
  
  -- Average Metrics
  average_revenue_per_customer INTEGER DEFAULT 0, -- in cents
  
  -- Age Metrics
  cohort_age_months INTEGER NOT NULL DEFAULT 0,
  
  -- Plan Distribution
  plan_distribution JSONB DEFAULT '{}',
  
  -- Geographic Data
  geographic_distribution JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(cohort_month, analysis_month)
);

-- =============================================
-- REVENUE FORECASTS TABLE
-- Store forecasting models and predictions
-- =============================================

CREATE TABLE IF NOT EXISTS revenue_forecasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  forecast_date DATE NOT NULL, -- Date the forecast was generated
  target_month DATE NOT NULL, -- Month being predicted
  
  -- Forecast Values
  predicted_mrr INTEGER NOT NULL, -- in cents
  predicted_arr INTEGER NOT NULL, -- in cents
  predicted_customers INTEGER DEFAULT 0,
  predicted_churn_rate DECIMAL(5,4) DEFAULT 0.0,
  
  -- Confidence Intervals
  confidence_level INTEGER DEFAULT 95, -- 90, 95, 99
  lower_bound_mrr INTEGER DEFAULT 0, -- in cents
  upper_bound_mrr INTEGER DEFAULT 0, -- in cents
  
  -- Model Information
  model_type VARCHAR(50) DEFAULT 'linear_regression',
  model_version VARCHAR(20) DEFAULT '1.0',
  training_data_months INTEGER DEFAULT 12,
  
  -- Accuracy Tracking (filled after actual results)
  actual_mrr INTEGER, -- in cents (filled after target month)
  accuracy_percentage DECIMAL(5,2), -- How accurate the prediction was
  
  -- Model Parameters
  model_parameters JSONB DEFAULT '{}',
  feature_importance JSONB DEFAULT '{}',
  
  -- Scenario Analysis
  scenario_type VARCHAR(20) DEFAULT 'base', -- conservative, base, optimistic
  assumptions JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(forecast_date, target_month, scenario_type)
);

-- =============================================
-- CHURN ANALYSIS TABLE
-- Detailed churn tracking and analysis
-- =============================================

CREATE TABLE IF NOT EXISTS churn_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_period_start DATE NOT NULL,
  analysis_period_end DATE NOT NULL,
  
  -- Customer Churn Metrics
  total_customers_start INTEGER DEFAULT 0,
  total_customers_end INTEGER DEFAULT 0,
  churned_customers INTEGER DEFAULT 0,
  customer_churn_rate DECIMAL(5,4) DEFAULT 0.0,
  
  -- Revenue Churn Metrics
  total_mrr_start INTEGER DEFAULT 0, -- in cents
  total_mrr_end INTEGER DEFAULT 0, -- in cents
  churned_mrr INTEGER DEFAULT 0, -- in cents
  revenue_churn_rate DECIMAL(5,4) DEFAULT 0.0,
  
  -- Churn Categorization
  voluntary_churn INTEGER DEFAULT 0,
  involuntary_churn INTEGER DEFAULT 0,
  
  -- Churn by Reason
  churn_reasons JSONB DEFAULT '{}', -- {"price": 5, "features": 3, ...}
  
  -- Churn by Plan
  churn_by_plan JSONB DEFAULT '{}',
  
  -- Churn by Customer Segment
  churn_by_segment JSONB DEFAULT '{}',
  
  -- Churn Timing Analysis
  average_days_to_churn INTEGER DEFAULT 0,
  churn_timing_distribution JSONB DEFAULT '{}', -- Days to churn histogram
  
  -- Geographic Churn Analysis
  churn_by_geography JSONB DEFAULT '{}',
  
  -- Churn Risk Factors
  risk_factors JSONB DEFAULT '{}',
  
  -- Recovery Metrics
  winback_attempts INTEGER DEFAULT 0,
  winback_successes INTEGER DEFAULT 0,
  winback_success_rate DECIMAL(5,4) DEFAULT 0.0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(analysis_period_start, analysis_period_end)
);

-- =============================================
-- CUSTOMER LIFETIME VALUE ANALYSIS
-- Track CLV calculations and segments
-- =============================================

CREATE TABLE IF NOT EXISTS customer_ltv_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES stripe_customers(id) ON DELETE CASCADE,
  calculation_date DATE NOT NULL,
  
  -- CLV Metrics
  current_ltv INTEGER NOT NULL DEFAULT 0, -- in cents
  predicted_ltv INTEGER DEFAULT 0, -- in cents
  months_active INTEGER DEFAULT 0,
  total_revenue INTEGER DEFAULT 0, -- in cents
  average_monthly_revenue INTEGER DEFAULT 0, -- in cents
  
  -- Acquisition Metrics
  acquisition_date DATE,
  acquisition_cost INTEGER DEFAULT 0, -- in cents
  acquisition_channel VARCHAR(100),
  first_payment_date DATE,
  
  -- Engagement Metrics
  subscription_changes INTEGER DEFAULT 0, -- upgrades/downgrades count
  payment_failures INTEGER DEFAULT 0,
  support_tickets INTEGER DEFAULT 0,
  
  -- Risk Assessment
  churn_risk_score DECIMAL(3,2) DEFAULT 0.0, -- 0-1 scale
  health_score DECIMAL(3,2) DEFAULT 1.0, -- 0-1 scale
  
  -- Segmentation
  customer_segment VARCHAR(50), -- high_value, at_risk, expansion_opportunity, etc.
  plan_history JSONB DEFAULT '[]', -- Array of plan changes
  
  -- Predictive Metrics
  predicted_churn_date DATE,
  expansion_probability DECIMAL(3,2) DEFAULT 0.0,
  next_likely_plan_id UUID REFERENCES subscription_plans(id),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(customer_id, calculation_date)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- Optimized indexes for analytics queries
-- =============================================

-- Billing metrics indexes
CREATE INDEX IF NOT EXISTS idx_billing_metrics_date ON billing_metrics(date);
CREATE INDEX IF NOT EXISTS idx_billing_metrics_date_currency ON billing_metrics(date, currency);
CREATE INDEX IF NOT EXISTS idx_billing_metrics_mrr ON billing_metrics(date, mrr);
CREATE INDEX IF NOT EXISTS idx_billing_metrics_customers ON billing_metrics(date, total_customers);

-- Customer cohorts indexes
CREATE INDEX IF NOT EXISTS idx_customer_cohorts_cohort_month ON customer_cohorts(cohort_month);
CREATE INDEX IF NOT EXISTS idx_customer_cohorts_analysis_month ON customer_cohorts(analysis_month);
CREATE INDEX IF NOT EXISTS idx_customer_cohorts_age ON customer_cohorts(cohort_age_months);
CREATE INDEX IF NOT EXISTS idx_customer_cohorts_retention ON customer_cohorts(customer_retention_rate);

-- Revenue forecasts indexes
CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_forecast_date ON revenue_forecasts(forecast_date);
CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_target_month ON revenue_forecasts(target_month);
CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_scenario ON revenue_forecasts(scenario_type, target_month);
CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_accuracy ON revenue_forecasts(accuracy_percentage) WHERE accuracy_percentage IS NOT NULL;

-- Churn analysis indexes
CREATE INDEX IF NOT EXISTS idx_churn_analysis_period ON churn_analysis(analysis_period_start, analysis_period_end);
CREATE INDEX IF NOT EXISTS idx_churn_analysis_rate ON churn_analysis(customer_churn_rate);

-- Customer LTV indexes
CREATE INDEX IF NOT EXISTS idx_customer_ltv_customer ON customer_ltv_analysis(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_ltv_date ON customer_ltv_analysis(calculation_date);
CREATE INDEX IF NOT EXISTS idx_customer_ltv_segment ON customer_ltv_analysis(customer_segment);
CREATE INDEX IF NOT EXISTS idx_customer_ltv_risk ON customer_ltv_analysis(churn_risk_score);
CREATE INDEX IF NOT EXISTS idx_customer_ltv_value ON customer_ltv_analysis(current_ltv);

-- =============================================
-- ANALYTICS FUNCTIONS
-- Database functions for common calculations
-- =============================================

-- Function to calculate MRR for a specific date
CREATE OR REPLACE FUNCTION calculate_mrr_for_date(target_date DATE)
RETURNS INTEGER AS $$
DECLARE
  total_mrr INTEGER := 0;
  subscription_record RECORD;
BEGIN
  -- Get all active subscriptions on target date
  FOR subscription_record IN
    SELECT 
      s.*,
      sp.amount,
      sp.interval
    FROM subscriptions s
    JOIN subscription_plans sp ON s.plan_id = sp.id
    WHERE s.status IN ('active', 'trialing')
    AND s.created_at::DATE <= target_date
    AND (s.canceled_at IS NULL OR s.canceled_at::DATE > target_date)
  LOOP
    -- Convert to monthly amount
    IF subscription_record.interval = 'year' THEN
      total_mrr := total_mrr + (subscription_record.amount / 12);
    ELSE
      total_mrr := total_mrr + subscription_record.amount;
    END IF;
  END LOOP;
  
  RETURN total_mrr;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate customer churn rate for a period
CREATE OR REPLACE FUNCTION calculate_churn_rate(
  start_date DATE,
  end_date DATE
)
RETURNS DECIMAL(5,4) AS $$
DECLARE
  customers_at_start INTEGER;
  churned_customers INTEGER;
  churn_rate DECIMAL(5,4) := 0.0;
BEGIN
  -- Count customers at start of period
  SELECT COUNT(DISTINCT customer_id)
  INTO customers_at_start
  FROM subscriptions
  WHERE status IN ('active', 'trialing')
  AND created_at::DATE < start_date;
  
  -- Count customers who churned during period
  SELECT COUNT(DISTINCT customer_id)
  INTO churned_customers
  FROM subscriptions
  WHERE status = 'canceled'
  AND canceled_at::DATE >= start_date
  AND canceled_at::DATE < end_date;
  
  -- Calculate churn rate
  IF customers_at_start > 0 THEN
    churn_rate := (churned_customers::DECIMAL / customers_at_start::DECIMAL);
  END IF;
  
  RETURN churn_rate;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate customer lifetime value
CREATE OR REPLACE FUNCTION calculate_customer_ltv(input_customer_id UUID)
RETURNS INTEGER AS $$
DECLARE
  total_revenue INTEGER := 0;
  subscription_record RECORD;
  start_date DATE;
  end_date DATE;
  duration_months INTEGER;
BEGIN
  -- Get all subscriptions for this customer
  FOR subscription_record IN
    SELECT 
      s.*,
      sp.amount,
      sp.interval
    FROM subscriptions s
    JOIN subscription_plans sp ON s.plan_id = sp.id
    WHERE s.customer_id = input_customer_id
  LOOP
    start_date := subscription_record.created_at::DATE;
    end_date := COALESCE(subscription_record.canceled_at::DATE, CURRENT_DATE);
    
    -- Calculate duration in months
    duration_months := EXTRACT(YEAR FROM AGE(end_date, start_date)) * 12 + 
                       EXTRACT(MONTH FROM AGE(end_date, start_date));
    
    -- Add to total revenue
    IF subscription_record.interval = 'year' THEN
      total_revenue := total_revenue + (subscription_record.amount * duration_months / 12);
    ELSE
      total_revenue := total_revenue + (subscription_record.amount * duration_months);
    END IF;
  END LOOP;
  
  RETURN total_revenue;
END;
$$ LANGUAGE plpgsql;

-- Function to update billing metrics daily
CREATE OR REPLACE FUNCTION update_daily_billing_metrics(target_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
DECLARE
  mrr_value INTEGER;
  arr_value INTEGER;
  total_customers_count INTEGER;
  churn_rate_value DECIMAL(5,4);
  previous_day DATE;
BEGIN
  previous_day := target_date - INTERVAL '1 day';
  
  -- Calculate MRR and ARR
  mrr_value := calculate_mrr_for_date(target_date);
  arr_value := mrr_value * 12;
  
  -- Count total active customers
  SELECT COUNT(DISTINCT customer_id)
  INTO total_customers_count
  FROM subscriptions
  WHERE status IN ('active', 'trialing')
  AND created_at::DATE <= target_date
  AND (canceled_at IS NULL OR canceled_at::DATE > target_date);
  
  -- Calculate churn rate (30-day rolling)
  churn_rate_value := calculate_churn_rate(target_date - INTERVAL '30 days', target_date);
  
  -- Insert or update metrics
  INSERT INTO billing_metrics (
    date,
    mrr,
    arr,
    total_customers,
    customer_churn_rate,
    calculated_at
  ) VALUES (
    target_date,
    mrr_value,
    arr_value,
    total_customers_count,
    churn_rate_value,
    NOW()
  )
  ON CONFLICT (date, currency) 
  DO UPDATE SET
    mrr = EXCLUDED.mrr,
    arr = EXCLUDED.arr,
    total_customers = EXCLUDED.total_customers,
    customer_churn_rate = EXCLUDED.customer_churn_rate,
    calculated_at = EXCLUDED.calculated_at,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Secure access to analytics data
-- =============================================

-- Enable RLS on analytics tables
ALTER TABLE billing_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE churn_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_ltv_analysis ENABLE ROW LEVEL SECURITY;

-- Analytics data - admin and business owners only
CREATE POLICY "Admins can view all billing metrics" ON billing_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'super_admin')
    )
  );

-- Similar policies for other analytics tables
CREATE POLICY "Admins can view customer cohorts" ON customer_cohorts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can manage revenue forecasts" ON revenue_forecasts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can view churn analysis" ON churn_analysis
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'super_admin')
    )
  );

-- Customer LTV - users can see their own data
CREATE POLICY "Users can view their own LTV data" ON customer_ltv_analysis
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stripe_customers sc
      WHERE sc.id = customer_ltv_analysis.customer_id
      AND sc.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- TRIGGERS
-- Automated updates and maintenance
-- =============================================

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_analytics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to analytics tables
CREATE TRIGGER update_billing_metrics_updated_at
  BEFORE UPDATE ON billing_metrics
  FOR EACH ROW EXECUTE FUNCTION update_analytics_updated_at();

CREATE TRIGGER update_customer_cohorts_updated_at
  BEFORE UPDATE ON customer_cohorts
  FOR EACH ROW EXECUTE FUNCTION update_analytics_updated_at();

CREATE TRIGGER update_revenue_forecasts_updated_at
  BEFORE UPDATE ON revenue_forecasts
  FOR EACH ROW EXECUTE FUNCTION update_analytics_updated_at();

CREATE TRIGGER update_churn_analysis_updated_at
  BEFORE UPDATE ON churn_analysis
  FOR EACH ROW EXECUTE FUNCTION update_analytics_updated_at();

CREATE TRIGGER update_customer_ltv_analysis_updated_at
  BEFORE UPDATE ON customer_ltv_analysis
  FOR EACH ROW EXECUTE FUNCTION update_analytics_updated_at();

-- =============================================
-- COMMENTS AND DOCUMENTATION
-- =============================================

COMMENT ON TABLE billing_metrics IS 'Daily aggregated billing and revenue metrics for business intelligence';
COMMENT ON TABLE customer_cohorts IS 'Customer cohort analysis data tracking retention and revenue over time';
COMMENT ON TABLE revenue_forecasts IS 'Revenue forecasting models and predictions with confidence intervals';
COMMENT ON TABLE churn_analysis IS 'Detailed churn analysis including reasons, timing, and recovery metrics';
COMMENT ON TABLE customer_ltv_analysis IS 'Individual customer lifetime value calculations and risk assessment';

-- Function comments
COMMENT ON FUNCTION calculate_mrr_for_date(DATE) IS 'Calculates total Monthly Recurring Revenue for a specific date';
COMMENT ON FUNCTION calculate_churn_rate(DATE, DATE) IS 'Calculates customer churn rate for a given period';
COMMENT ON FUNCTION calculate_customer_ltv(UUID) IS 'Calculates lifetime value for a specific customer';
COMMENT ON FUNCTION update_daily_billing_metrics(DATE) IS 'Updates daily billing metrics for analytics dashboard';

-- Migration complete notification
SELECT 'Enhanced billing metrics and analytics migration completed successfully' as status;