-- =============================================
-- EPIC 5 STORY 5.8: Enterprise Sales & Custom Billing
-- Enterprise Billing Infrastructure Database Migration
-- =============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ENTERPRISE LEADS MANAGEMENT
-- Manages enterprise sales leads and qualification
-- =============================================

CREATE TABLE IF NOT EXISTS enterprise_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(50),
  industry VARCHAR(100) NOT NULL,
  location_count INTEGER NOT NULL CHECK (location_count > 0),
  estimated_monthly_volume INTEGER DEFAULT 0,
  current_solution VARCHAR(255),
  budget_range VARCHAR(100),
  decision_timeframe VARCHAR(100) NOT NULL,
  qualification_score INTEGER DEFAULT 0 CHECK (qualification_score >= 0 AND qualification_score <= 100),
  qualification_tier VARCHAR(20) DEFAULT 'prospect' CHECK (qualification_tier IN ('prospect', 'qualified', 'enterprise')),
  sales_stage VARCHAR(20) DEFAULT 'discovery' CHECK (sales_stage IN ('discovery', 'demo', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
  assigned_sales_rep VARCHAR(255),
  custom_pricing_tier VARCHAR(50),
  estimated_arr_value INTEGER DEFAULT 0,
  lead_source VARCHAR(100) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- SALES REPRESENTATIVES
-- Manages sales team for lead assignment
-- =============================================

CREATE TABLE IF NOT EXISTS sales_representatives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  specialties TEXT[] DEFAULT '{}', -- ['enterprise', 'qualified', 'prospect']
  current_lead_count INTEGER DEFAULT 0,
  max_lead_capacity INTEGER DEFAULT 50,
  active BOOLEAN DEFAULT TRUE,
  performance_metrics JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- ENTERPRISE SALES ACTIVITIES
-- Tracks sales activities and interactions
-- =============================================

CREATE TABLE IF NOT EXISTS enterprise_sales_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES enterprise_leads(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN ('call', 'email', 'demo', 'proposal', 'meeting', 'contract_review')),
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  outcome TEXT,
  next_action TEXT,
  next_action_date TIMESTAMP WITH TIME ZONE,
  sales_rep_id VARCHAR(255) NOT NULL,
  attachments TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- ENTERPRISE CUSTOM PRICING
-- Stores custom pricing proposals for enterprise leads
-- =============================================

CREATE TABLE IF NOT EXISTS enterprise_custom_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES enterprise_leads(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES stripe_customers(id) ON DELETE SET NULL,
  pricing_tier VARCHAR(50) NOT NULL CHECK (pricing_tier IN ('volume_50', 'volume_100', 'volume_500', 'volume_1000', 'custom')),
  base_price INTEGER NOT NULL, -- in cents per location per month
  discount_percentage DECIMAL(5,2) DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  minimum_commitment INTEGER NOT NULL, -- minimum locations
  contract_length INTEGER NOT NULL CHECK (contract_length >= 12 AND contract_length <= 60), -- months
  payment_terms VARCHAR(20) DEFAULT 'net_30' CHECK (payment_terms IN ('net_30', 'net_60', 'net_90', 'annual_prepaid', 'quarterly_prepaid')),
  custom_features TEXT[] DEFAULT '{}',
  support_level VARCHAR(20) DEFAULT 'standard' CHECK (support_level IN ('standard', 'premium', 'enterprise')),
  sla_guarantees JSONB DEFAULT '{}',
  pricing JSONB NOT NULL, -- detailed pricing breakdown
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  approved_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- ENTERPRISE BILLING PROFILES
-- Customer billing preferences and configurations
-- =============================================

CREATE TABLE IF NOT EXISTS enterprise_billing_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES stripe_customers(id) ON DELETE CASCADE UNIQUE,
  company_name VARCHAR(255) NOT NULL,
  billing_type VARCHAR(20) DEFAULT 'consolidated' CHECK (billing_type IN ('consolidated', 'location_based', 'department_based')),
  payment_terms VARCHAR(20) DEFAULT 'net_30' CHECK (payment_terms IN ('net_30', 'net_60', 'net_90', 'annual_prepaid', 'quarterly_prepaid')),
  preferred_payment_method VARCHAR(20) DEFAULT 'credit_card' CHECK (preferred_payment_method IN ('credit_card', 'ach', 'wire_transfer', 'check', 'purchase_order')),
  billing_frequency VARCHAR(20) DEFAULT 'monthly' CHECK (billing_frequency IN ('monthly', 'quarterly', 'annually')),
  consolidated_billing BOOLEAN DEFAULT FALSE,
  cost_center_allocation BOOLEAN DEFAULT FALSE,
  purchase_order_required BOOLEAN DEFAULT FALSE,
  custom_invoice_format BOOLEAN DEFAULT FALSE,
  tax_exempt_status BOOLEAN DEFAULT FALSE,
  billing_contact JSONB NOT NULL,
  approval_workflow JSONB DEFAULT '{}',
  volume_discounts JSONB DEFAULT '[]',
  contract_terms JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- ENTERPRISE CUSTOM INVOICES
-- Custom invoices for enterprise customers
-- =============================================

CREATE TABLE IF NOT EXISTS enterprise_custom_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enterprise_customer_id UUID REFERENCES stripe_customers(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  locations JSONB DEFAULT '[]', -- location details and usage
  cost_centers JSONB DEFAULT '[]', -- cost center breakdown
  line_items JSONB NOT NULL, -- detailed line items
  subtotal INTEGER NOT NULL, -- in cents
  discounts JSONB DEFAULT '[]', -- discount details
  taxes JSONB DEFAULT '[]', -- tax breakdown
  total INTEGER NOT NULL, -- in cents
  currency VARCHAR(3) DEFAULT 'USD',
  payment_terms VARCHAR(20) NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  purchase_order VARCHAR(100),
  approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'paid', 'overdue', 'failed')),
  payment_method VARCHAR(20) NOT NULL,
  wire_instructions JSONB,
  custom_formatting JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- PURCHASE ORDER REQUESTS
-- Enterprise purchase order processing
-- =============================================

CREATE TABLE IF NOT EXISTS purchase_order_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enterprise_customer_id UUID REFERENCES stripe_customers(id) ON DELETE CASCADE,
  po_number VARCHAR(100) NOT NULL,
  vendor_name VARCHAR(255) DEFAULT 'The Lawless Directory',
  requestor_name VARCHAR(255) NOT NULL,
  requestor_email VARCHAR(255) NOT NULL,
  department VARCHAR(100) NOT NULL,
  cost_center VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  amount INTEGER NOT NULL, -- in cents
  currency VARCHAR(3) DEFAULT 'USD',
  requested_delivery_date TIMESTAMP WITH TIME ZONE,
  approval_workflow JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'processed')),
  attachments TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(enterprise_customer_id, po_number)
);

-- =============================================
-- WIRE TRANSFER PROCESSING
-- Manual reconciliation for wire transfers
-- =============================================

CREATE TABLE IF NOT EXISTS wire_transfer_processing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES enterprise_custom_invoices(id) ON DELETE CASCADE,
  reference_number VARCHAR(100),
  amount INTEGER NOT NULL, -- in cents
  sender_bank VARCHAR(255),
  received_date TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'verified', 'reconciled', 'rejected')),
  reconciliation_notes TEXT[],
  processed_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- ENTERPRISE CONTRACTS
-- Contract lifecycle management
-- =============================================

CREATE TABLE IF NOT EXISTS enterprise_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES stripe_customers(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  contract_type VARCHAR(20) NOT NULL CHECK (contract_type IN ('msa', 'dpa', 'baa', 'service_agreement', 'amendment')),
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'pending_signature', 'active', 'expired', 'terminated')),
  version VARCHAR(10) DEFAULT '1.0',
  parent_contract_id UUID REFERENCES enterprise_contracts(id) ON DELETE SET NULL,
  terms JSONB NOT NULL,
  pricing JSONB NOT NULL,
  compliance JSONB DEFAULT '{}',
  approval_workflow JSONB DEFAULT '{}',
  documents JSONB DEFAULT '{}',
  created_by VARCHAR(255) DEFAULT 'system',
  assigned_legal VARCHAR(255) NOT NULL,
  assigned_sales VARCHAR(255) NOT NULL,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- CONTRACT AMENDMENTS
-- Contract modification tracking
-- =============================================

CREATE TABLE IF NOT EXISTS contract_amendments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID REFERENCES enterprise_contracts(id) ON DELETE CASCADE,
  amendment_type VARCHAR(20) NOT NULL CHECK (amendment_type IN ('pricing', 'terms', 'scope', 'compliance', 'other')),
  description TEXT NOT NULL,
  changes JSONB NOT NULL, -- array of change objects
  effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected')),
  approval_workflow JSONB DEFAULT '{}',
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- CONTRACT RENEWALS
-- Renewal tracking and processing
-- =============================================

CREATE TABLE IF NOT EXISTS contract_renewals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID REFERENCES enterprise_contracts(id) ON DELETE CASCADE,
  renewal_type VARCHAR(20) NOT NULL CHECK (renewal_type IN ('automatic', 'manual')),
  renewal_date TIMESTAMP WITH TIME ZONE NOT NULL,
  new_terms JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'expired')),
  notifications_sent TIMESTAMP WITH TIME ZONE[],
  customer_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- CONTRACT ACTIVITIES
-- Contract workflow activity log
-- =============================================

CREATE TABLE IF NOT EXISTS contract_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID REFERENCES enterprise_contracts(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  performed_by VARCHAR(255) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- ENTERPRISE SLA METRICS
-- SLA performance tracking and reporting
-- =============================================

CREATE TABLE IF NOT EXISTS enterprise_sla_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES stripe_customers(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES enterprise_contracts(id) ON DELETE SET NULL,
  reporting_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  reporting_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  uptime JSONB NOT NULL,
  support JSONB NOT NULL,
  performance JSONB NOT NULL,
  compliance JSONB NOT NULL,
  overall_score DECIMAL(5,2) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- UPTIME INCIDENTS
-- Service incident tracking
-- =============================================

CREATE TABLE IF NOT EXISTS uptime_incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES stripe_customers(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration INTEGER DEFAULT 0, -- in minutes
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  cause TEXT NOT NULL,
  resolution TEXT,
  affected_services TEXT[] NOT NULL,
  customer_impact TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- SUPPORT TICKETS
-- Support ticket metrics for SLA tracking
-- =============================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES stripe_customers(id) ON DELETE CASCADE,
  priority VARCHAR(10) NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  category VARCHAR(100),
  subject VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  first_response_time INTEGER, -- in hours
  resolution_time INTEGER, -- in hours
  escalated BOOLEAN DEFAULT FALSE,
  satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
  assigned_to VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- PERFORMANCE METRICS
-- System performance data for SLA monitoring
-- =============================================

CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES stripe_customers(id) ON DELETE CASCADE,
  page_load_time INTEGER DEFAULT 0, -- in milliseconds
  api_response_time INTEGER DEFAULT 0, -- in milliseconds
  search_response_time INTEGER DEFAULT 0, -- in milliseconds
  total_requests INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- ENTERPRISE USAGE ANALYTICS
-- Detailed usage analytics for enterprise customers
-- =============================================

CREATE TABLE IF NOT EXISTS enterprise_usage_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES stripe_customers(id) ON DELETE CASCADE,
  reporting_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  reporting_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  locations JSONB DEFAULT '[]',
  features JSONB DEFAULT '[]',
  engagement JSONB DEFAULT '{}',
  business JSONB DEFAULT '{}',
  trends JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- ENTERPRISE REPORTS
-- Generated reports for customers
-- =============================================

CREATE TABLE IF NOT EXISTS enterprise_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES stripe_customers(id) ON DELETE CASCADE,
  report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('sla', 'usage', 'revenue', 'compliance', 'executive_summary')),
  reporting_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  reporting_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  sla_metrics JSONB,
  usage_analytics JSONB,
  revenue_analytics JSONB,
  executive_summary JSONB,
  delivery_method VARCHAR(10) DEFAULT 'portal' CHECK (delivery_method IN ('email', 'portal', 'api')),
  recipients TEXT[],
  status VARCHAR(10) DEFAULT 'generated' CHECK (status IN ('generated', 'delivered', 'viewed')),
  generated_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- COMPLIANCE TRACKING
-- Compliance requirements and audit findings
-- =============================================

CREATE TABLE IF NOT EXISTS audit_findings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES stripe_customers(id) ON DELETE CASCADE,
  finding TEXT NOT NULL,
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status VARCHAR(15) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  due_date TIMESTAMP WITH TIME ZONE,
  owner VARCHAR(255),
  resolution TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS remediation_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES stripe_customers(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  priority VARCHAR(10) NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status VARCHAR(15) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  due_date TIMESTAMP WITH TIME ZONE,
  assignee VARCHAR(255),
  completion_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- SEQUENCE TABLES
-- For generating sequential numbers
-- =============================================

CREATE TABLE IF NOT EXISTS invoice_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prefix VARCHAR(20) UNIQUE NOT NULL,
  next_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contract_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prefix VARCHAR(20) UNIQUE NOT NULL,
  next_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- Optimized indexes for common query patterns
-- =============================================

-- Enterprise leads indexes
CREATE INDEX IF NOT EXISTS idx_enterprise_leads_qualification_tier ON enterprise_leads(qualification_tier);
CREATE INDEX IF NOT EXISTS idx_enterprise_leads_sales_stage ON enterprise_leads(sales_stage);
CREATE INDEX IF NOT EXISTS idx_enterprise_leads_assigned_rep ON enterprise_leads(assigned_sales_rep);
CREATE INDEX IF NOT EXISTS idx_enterprise_leads_score ON enterprise_leads(qualification_score DESC);

-- Sales activities indexes
CREATE INDEX IF NOT EXISTS idx_sales_activities_lead_id ON enterprise_sales_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_sales_activities_type_date ON enterprise_sales_activities(activity_type, created_at DESC);

-- Custom pricing indexes
CREATE INDEX IF NOT EXISTS idx_custom_pricing_lead_id ON enterprise_custom_pricing(lead_id);
CREATE INDEX IF NOT EXISTS idx_custom_pricing_valid_until ON enterprise_custom_pricing(valid_until);

-- Custom invoices indexes
CREATE INDEX IF NOT EXISTS idx_custom_invoices_customer_id ON enterprise_custom_invoices(enterprise_customer_id);
CREATE INDEX IF NOT EXISTS idx_custom_invoices_due_date ON enterprise_custom_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_custom_invoices_status ON enterprise_custom_invoices(payment_status);

-- Contract indexes
CREATE INDEX IF NOT EXISTS idx_contracts_customer_id ON enterprise_contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON enterprise_contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_type ON enterprise_contracts(contract_type);

-- SLA metrics indexes
CREATE INDEX IF NOT EXISTS idx_sla_metrics_customer_period ON enterprise_sla_metrics(customer_id, reporting_period_start, reporting_period_end);
CREATE INDEX IF NOT EXISTS idx_sla_metrics_score ON enterprise_sla_metrics(overall_score);

-- Performance metrics indexes
CREATE INDEX IF NOT EXISTS idx_performance_metrics_customer_time ON performance_metrics(customer_id, recorded_at);

-- Support tickets indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_customer_id ON support_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority_status ON support_tickets(priority, status);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Secure access to enterprise data
-- =============================================

-- Enable RLS on all enterprise tables
ALTER TABLE enterprise_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_representatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_sales_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_custom_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_billing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_custom_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_sla_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_reports ENABLE ROW LEVEL SECURITY;

-- Enterprise sales team can manage leads
CREATE POLICY "Sales team can manage enterprise leads" ON enterprise_leads
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'super_admin', 'enterprise_sales', 'sales_manager')
    )
  );

-- Customers can view their own enterprise data
CREATE POLICY "Customers can view their enterprise data" ON enterprise_billing_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stripe_customers 
      WHERE id = enterprise_billing_profiles.customer_id 
      AND (
        user_id = auth.uid() OR 
        business_id IN (
          SELECT business_id FROM business_members 
          WHERE user_id = auth.uid() 
          AND role IN ('owner', 'admin', 'billing')
        )
      )
    )
  );

-- Similar policies for other enterprise tables...
CREATE POLICY "Customers can view their contracts" ON enterprise_contracts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stripe_customers 
      WHERE id = enterprise_contracts.customer_id 
      AND (
        user_id = auth.uid() OR 
        business_id IN (
          SELECT business_id FROM business_members 
          WHERE user_id = auth.uid() 
          AND role IN ('owner', 'admin', 'billing')
        )
      )
    )
  );

-- Admins can view all enterprise data
CREATE POLICY "Admins can manage all enterprise data" ON enterprise_leads
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
-- Automated enterprise data management
-- =============================================

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_enterprise_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_enterprise_leads_updated_at
  BEFORE UPDATE ON enterprise_leads
  FOR EACH ROW EXECUTE FUNCTION update_enterprise_updated_at();

CREATE TRIGGER update_sales_representatives_updated_at
  BEFORE UPDATE ON sales_representatives
  FOR EACH ROW EXECUTE FUNCTION update_enterprise_updated_at();

CREATE TRIGGER update_custom_pricing_updated_at
  BEFORE UPDATE ON enterprise_custom_pricing
  FOR EACH ROW EXECUTE FUNCTION update_enterprise_updated_at();

CREATE TRIGGER update_billing_profiles_updated_at
  BEFORE UPDATE ON enterprise_billing_profiles
  FOR EACH ROW EXECUTE FUNCTION update_enterprise_updated_at();

CREATE TRIGGER update_custom_invoices_updated_at
  BEFORE UPDATE ON enterprise_custom_invoices
  FOR EACH ROW EXECUTE FUNCTION update_enterprise_updated_at();

CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON enterprise_contracts
  FOR EACH ROW EXECUTE FUNCTION update_enterprise_updated_at();

-- Function to automatically assign leads to sales reps
CREATE OR REPLACE FUNCTION auto_assign_lead()
RETURNS TRIGGER AS $$
DECLARE
  selected_rep_id UUID;
BEGIN
  -- Only assign if not already assigned and qualification tier is qualified or higher
  IF NEW.assigned_sales_rep IS NULL AND NEW.qualification_tier IN ('qualified', 'enterprise') THEN
    -- Find available sales rep with capacity
    SELECT id INTO selected_rep_id
    FROM sales_representatives
    WHERE active = TRUE
    AND current_lead_count < max_lead_capacity
    AND NEW.qualification_tier = ANY(specialties)
    ORDER BY current_lead_count ASC, RANDOM()
    LIMIT 1;
    
    IF selected_rep_id IS NOT NULL THEN
      NEW.assigned_sales_rep = selected_rep_id::text;
      
      -- Update rep's lead count
      UPDATE sales_representatives
      SET current_lead_count = current_lead_count + 1,
          updated_at = NOW()
      WHERE id = selected_rep_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_assign_lead_trigger
  BEFORE INSERT ON enterprise_leads
  FOR EACH ROW EXECUTE FUNCTION auto_assign_lead();

-- Function to calculate invoice totals
CREATE OR REPLACE FUNCTION calculate_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
  discount_total INTEGER := 0;
  tax_total INTEGER := 0;
  discount_item JSONB;
  tax_item JSONB;
BEGIN
  -- Calculate total discounts
  FOR discount_item IN SELECT * FROM jsonb_array_elements(NEW.discounts)
  LOOP
    discount_total := discount_total + (discount_item->>'amount')::INTEGER;
  END LOOP;
  
  -- Calculate total taxes
  FOR tax_item IN SELECT * FROM jsonb_array_elements(NEW.taxes)
  LOOP
    tax_total := tax_total + (tax_item->>'amount')::INTEGER;
  END LOOP;
  
  -- Update total
  NEW.total := NEW.subtotal - discount_total + tax_total;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_invoice_totals_trigger
  BEFORE INSERT OR UPDATE ON enterprise_custom_invoices
  FOR EACH ROW EXECUTE FUNCTION calculate_invoice_totals();

-- =============================================
-- SEED DATA
-- Default data for enterprise features
-- =============================================

-- Insert default sales representative roles
INSERT INTO sales_representatives (name, email, specialties, max_lead_capacity)
VALUES 
  ('Enterprise Sales Manager', 'enterprise@company.com', '{"enterprise"}', 25),
  ('Senior Sales Representative', 'sales1@company.com', '{"qualified", "enterprise"}', 50),
  ('Sales Representative', 'sales2@company.com', '{"prospect", "qualified"}', 75)
ON CONFLICT (email) DO NOTHING;

-- =============================================
-- COMMENTS AND DOCUMENTATION
-- =============================================

COMMENT ON TABLE enterprise_leads IS 'Enterprise sales leads with qualification scoring and stage tracking';
COMMENT ON TABLE sales_representatives IS 'Sales team members for lead assignment and management';
COMMENT ON TABLE enterprise_sales_activities IS 'Sales activity log and interaction history';
COMMENT ON TABLE enterprise_custom_pricing IS 'Custom pricing proposals for enterprise prospects';
COMMENT ON TABLE enterprise_billing_profiles IS 'Customer billing preferences and enterprise configurations';
COMMENT ON TABLE enterprise_custom_invoices IS 'Custom invoices for enterprise customers with detailed breakdowns';
COMMENT ON TABLE purchase_order_requests IS 'Purchase order processing and approval workflow';
COMMENT ON TABLE enterprise_contracts IS 'Enterprise contract lifecycle management';
COMMENT ON TABLE enterprise_sla_metrics IS 'SLA performance tracking and compliance reporting';
COMMENT ON TABLE uptime_incidents IS 'Service incident tracking for SLA monitoring';
COMMENT ON TABLE support_tickets IS 'Support ticket metrics for SLA compliance';
COMMENT ON TABLE performance_metrics IS 'System performance data for enterprise SLA reporting';

-- Migration complete notification
SELECT 'Enterprise billing infrastructure migration completed successfully' as status;