-- =============================================
-- EPIC 5 STORY 5.9: International Payments & Tax Compliance
-- Database Schema Migration for Global Expansion
-- =============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- SUPPORTED CURRENCIES
-- Manages supported currencies and their configuration
-- =============================================

CREATE TABLE IF NOT EXISTS supported_currencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(3) UNIQUE NOT NULL, -- ISO 4217 currency code
  name VARCHAR(100) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  decimal_places INTEGER DEFAULT 2,
  active BOOLEAN DEFAULT TRUE,
  primary_regions JSONB DEFAULT '[]', -- Primary regions where this currency is used
  payment_methods JSONB DEFAULT '[]', -- Supported payment methods for this currency
  stripe_supported BOOLEAN DEFAULT FALSE,
  adyen_supported BOOLEAN DEFAULT FALSE,
  paypal_supported BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- EXCHANGE RATES
-- Real-time and historical currency exchange rates
-- =============================================

CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base_currency VARCHAR(3) NOT NULL,
  target_currency VARCHAR(3) NOT NULL,
  rate DECIMAL(15,8) NOT NULL,
  provider VARCHAR(50) NOT NULL, -- exchangerate-api, fixer, etc.
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(base_currency, target_currency, valid_from)
);

-- =============================================
-- REGIONAL PAYMENT METHODS
-- Configuration for region-specific payment methods
-- =============================================

CREATE TABLE IF NOT EXISTS regional_payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL, -- sepa_debit, ideal, sofort, etc.
  name VARCHAR(100) NOT NULL,
  provider VARCHAR(50) NOT NULL, -- stripe, adyen, mollie, etc.
  regions JSONB NOT NULL, -- Array of country codes
  currencies JSONB NOT NULL, -- Array of supported currencies
  payment_type VARCHAR(50) NOT NULL, -- bank_transfer, direct_debit, wallet, etc.
  configuration JSONB DEFAULT '{}', -- Provider-specific configuration
  fees JSONB DEFAULT '{}', -- Fee structure
  processing_time VARCHAR(100), -- Expected processing time
  active BOOLEAN DEFAULT TRUE,
  requires_mandate BOOLEAN DEFAULT FALSE, -- For direct debit methods
  min_amount INTEGER, -- Minimum amount in base currency cents
  max_amount INTEGER, -- Maximum amount in base currency cents
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TAX JURISDICTIONS
-- Global tax jurisdictions and their rules
-- =============================================

CREATE TABLE IF NOT EXISTS tax_jurisdictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(10) UNIQUE NOT NULL, -- US-CA, GB, DE, etc.
  name VARCHAR(200) NOT NULL,
  type VARCHAR(20) NOT NULL, -- country, state, province, etc.
  parent_jurisdiction_id UUID REFERENCES tax_jurisdictions(id),
  tax_system VARCHAR(20) NOT NULL, -- vat, gst, sales_tax, etc.
  default_rate DECIMAL(5,4), -- Default tax rate (e.g., 0.2000 for 20%)
  currency VARCHAR(3) NOT NULL,
  threshold_amount INTEGER, -- Digital services threshold in cents
  registration_required BOOLEAN DEFAULT FALSE,
  moss_eligible BOOLEAN DEFAULT FALSE, -- Mini One Stop Shop eligible
  reverse_charge_applicable BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  effective_from DATE NOT NULL,
  effective_until DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TAX RATES
-- Detailed tax rates by jurisdiction and product type
-- =============================================

CREATE TABLE IF NOT EXISTS tax_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  jurisdiction_id UUID REFERENCES tax_jurisdictions(id) ON DELETE CASCADE,
  product_category VARCHAR(100) DEFAULT 'standard', -- standard, digital_services, books, etc.
  rate DECIMAL(5,4) NOT NULL, -- Tax rate (e.g., 0.2000 for 20%)
  rate_type VARCHAR(20) DEFAULT 'percentage', -- percentage, fixed
  description TEXT,
  effective_from DATE NOT NULL,
  effective_until DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INTERNATIONAL CUSTOMERS
-- Extended customer data for international compliance
-- =============================================

CREATE TABLE IF NOT EXISTS international_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_customer_id UUID REFERENCES stripe_customers(id) ON DELETE CASCADE,
  country_code VARCHAR(2) NOT NULL, -- ISO 3166-1 alpha-2
  tax_jurisdiction_id UUID REFERENCES tax_jurisdictions(id),
  business_type VARCHAR(50), -- individual, business, non_profit, etc.
  vat_number VARCHAR(50),
  tax_id VARCHAR(50),
  tax_exempt BOOLEAN DEFAULT FALSE,
  exemption_certificate VARCHAR(500), -- URL to exemption certificate
  primary_currency VARCHAR(3) DEFAULT 'USD',
  preferred_payment_methods JSONB DEFAULT '[]',
  regulatory_requirements JSONB DEFAULT '{}', -- KYC, AML requirements
  compliance_status VARCHAR(20) DEFAULT 'pending', -- pending, verified, rejected
  compliance_verified_at TIMESTAMP WITH TIME ZONE,
  data_localization_required BOOLEAN DEFAULT FALSE,
  gdpr_consent BOOLEAN DEFAULT FALSE,
  gdpr_consent_date TIMESTAMP WITH TIME ZONE,
  marketing_consent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INTERNATIONAL TRANSACTIONS
-- Extended transaction data for international payments
-- =============================================

CREATE TABLE IF NOT EXISTS international_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE CASCADE,
  customer_country VARCHAR(2) NOT NULL,
  merchant_country VARCHAR(2) DEFAULT 'US',
  original_currency VARCHAR(3) NOT NULL,
  settlement_currency VARCHAR(3) NOT NULL,
  original_amount INTEGER NOT NULL, -- Amount in original currency cents
  exchange_rate DECIMAL(15,8),
  settlement_amount INTEGER NOT NULL, -- Amount in settlement currency cents
  tax_jurisdiction_id UUID REFERENCES tax_jurisdictions(id),
  tax_rate DECIMAL(5,4),
  tax_amount INTEGER DEFAULT 0, -- Tax amount in settlement currency cents
  regional_payment_method_id UUID REFERENCES regional_payment_methods(id),
  payment_processor VARCHAR(50) NOT NULL, -- stripe, adyen, mollie, etc.
  processor_fee INTEGER DEFAULT 0, -- Processor fee in settlement currency cents
  fx_fee INTEGER DEFAULT 0, -- Foreign exchange fee in settlement currency cents
  compliance_checks JSONB DEFAULT '{}', -- AML, sanctions checks
  risk_assessment JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TAX CALCULATIONS
-- Calculated tax amounts for transactions
-- =============================================

CREATE TABLE IF NOT EXISTS tax_calculations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES international_transactions(id) ON DELETE CASCADE,
  jurisdiction_id UUID REFERENCES tax_jurisdictions(id),
  tax_type VARCHAR(20) NOT NULL, -- vat, gst, sales_tax, etc.
  taxable_amount INTEGER NOT NULL, -- Taxable amount in settlement currency cents
  tax_rate DECIMAL(5,4) NOT NULL,
  tax_amount INTEGER NOT NULL, -- Tax amount in settlement currency cents
  reverse_charge BOOLEAN DEFAULT FALSE,
  exemption_reason VARCHAR(200),
  calculation_method VARCHAR(50) DEFAULT 'standard',
  moss_reported BOOLEAN DEFAULT FALSE, -- Reported via MOSS system
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- COMPLIANCE AUDIT LOG
-- Audit trail for compliance and regulatory requirements
-- =============================================

CREATE TABLE IF NOT EXISTS compliance_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(50) NOT NULL, -- kyc_check, aml_scan, gdpr_consent, etc.
  entity_type VARCHAR(20) NOT NULL, -- customer, transaction, payment_method
  entity_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  compliance_rule VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL, -- passed, failed, pending, manual_review
  details JSONB DEFAULT '{}',
  external_reference VARCHAR(255), -- Reference to external compliance system
  risk_score INTEGER, -- Risk score if applicable
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- GDPR DATA REQUESTS
-- Manages GDPR data subject requests
-- =============================================

CREATE TABLE IF NOT EXISTS gdpr_data_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_type VARCHAR(20) NOT NULL, -- export, deletion, rectification, portability
  customer_id UUID REFERENCES international_customers(id) ON DELETE CASCADE,
  requester_email VARCHAR(255) NOT NULL,
  verification_token VARCHAR(255) UNIQUE,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'pending', -- pending, verified, processing, completed, rejected
  data_export_url VARCHAR(500),
  deletion_completed BOOLEAN DEFAULT FALSE,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- REGULATORY REPORTS
-- Generated reports for tax and compliance authorities
-- =============================================

CREATE TABLE IF NOT EXISTS regulatory_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_type VARCHAR(50) NOT NULL, -- vat_return, moss_report, aml_suspicious_activity
  jurisdiction_id UUID REFERENCES tax_jurisdictions(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_transactions INTEGER DEFAULT 0,
  total_amount INTEGER DEFAULT 0, -- In jurisdiction currency cents
  total_tax_collected INTEGER DEFAULT 0, -- In jurisdiction currency cents
  file_path VARCHAR(500), -- Path to generated report file
  file_format VARCHAR(10) DEFAULT 'xml', -- xml, csv, pdf
  submitted BOOLEAN DEFAULT FALSE,
  submitted_at TIMESTAMP WITH TIME ZONE,
  submission_reference VARCHAR(255),
  generated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Currency and exchange rate indexes
CREATE INDEX IF NOT EXISTS idx_supported_currencies_code ON supported_currencies(code);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_currencies ON exchange_rates(base_currency, target_currency);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_valid_period ON exchange_rates(valid_from, valid_until);

-- Regional payment method indexes
CREATE INDEX IF NOT EXISTS idx_regional_payment_methods_regions ON regional_payment_methods USING GIN(regions);
CREATE INDEX IF NOT EXISTS idx_regional_payment_methods_currencies ON regional_payment_methods USING GIN(currencies);

-- Tax jurisdiction and rate indexes
CREATE INDEX IF NOT EXISTS idx_tax_jurisdictions_code ON tax_jurisdictions(code);
CREATE INDEX IF NOT EXISTS idx_tax_jurisdictions_type ON tax_jurisdictions(type);
CREATE INDEX IF NOT EXISTS idx_tax_rates_jurisdiction ON tax_rates(jurisdiction_id);
CREATE INDEX IF NOT EXISTS idx_tax_rates_effective ON tax_rates(effective_from, effective_until);

-- International customer indexes
CREATE INDEX IF NOT EXISTS idx_international_customers_country ON international_customers(country_code);
CREATE INDEX IF NOT EXISTS idx_international_customers_jurisdiction ON international_customers(tax_jurisdiction_id);
CREATE INDEX IF NOT EXISTS idx_international_customers_vat ON international_customers(vat_number);

-- International transaction indexes
CREATE INDEX IF NOT EXISTS idx_international_transactions_country ON international_transactions(customer_country);
CREATE INDEX IF NOT EXISTS idx_international_transactions_currency ON international_transactions(original_currency, settlement_currency);
CREATE INDEX IF NOT EXISTS idx_international_transactions_date ON international_transactions(created_at);

-- Tax calculation indexes
CREATE INDEX IF NOT EXISTS idx_tax_calculations_transaction ON tax_calculations(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tax_calculations_jurisdiction ON tax_calculations(jurisdiction_id);

-- Compliance audit indexes
CREATE INDEX IF NOT EXISTS idx_compliance_audit_log_entity ON compliance_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_log_date ON compliance_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_log_status ON compliance_audit_log(status);

-- GDPR request indexes
CREATE INDEX IF NOT EXISTS idx_gdpr_data_requests_customer ON gdpr_data_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_data_requests_status ON gdpr_data_requests(status);

-- Regulatory report indexes
CREATE INDEX IF NOT EXISTS idx_regulatory_reports_type ON regulatory_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_regulatory_reports_jurisdiction ON regulatory_reports(jurisdiction_id);
CREATE INDEX IF NOT EXISTS idx_regulatory_reports_period ON regulatory_reports(period_start, period_end);

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on all new tables
ALTER TABLE supported_currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE regional_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_jurisdictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE international_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE international_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_data_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_reports ENABLE ROW LEVEL SECURITY;

-- Public read access for reference data
CREATE POLICY "Anyone can view supported currencies" ON supported_currencies
  FOR SELECT USING (active = TRUE);

CREATE POLICY "Anyone can view exchange rates" ON exchange_rates
  FOR SELECT USING (valid_until > NOW());

CREATE POLICY "Anyone can view regional payment methods" ON regional_payment_methods
  FOR SELECT USING (active = TRUE);

CREATE POLICY "Anyone can view tax jurisdictions" ON tax_jurisdictions
  FOR SELECT USING (active = TRUE);

CREATE POLICY "Anyone can view tax rates" ON tax_rates
  FOR SELECT USING (effective_until IS NULL OR effective_until > CURRENT_DATE);

-- International customer policies
CREATE POLICY "Users can view their international profile" ON international_customers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stripe_customers sc
      WHERE sc.id = international_customers.stripe_customer_id
      AND (sc.user_id = auth.uid() OR 
           (sc.business_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM business_members bm
             WHERE bm.business_id = sc.business_id
             AND bm.user_id = auth.uid()
             AND bm.role IN ('owner', 'admin', 'billing')
           )))
    )
  );

-- International transaction policies
CREATE POLICY "Users can view their international transactions" ON international_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM payment_transactions pt
      JOIN stripe_customers sc ON pt.customer_id = sc.id
      WHERE pt.id = international_transactions.payment_transaction_id
      AND (sc.user_id = auth.uid() OR 
           (sc.business_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM business_members bm
             WHERE bm.business_id = sc.business_id
             AND bm.user_id = auth.uid()
             AND bm.role IN ('owner', 'admin', 'billing')
           )))
    )
  );

-- Admin policies for all tables
CREATE POLICY "Admins can manage reference data" ON supported_currencies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'super_admin')
    )
  );

-- Apply similar admin policies to other tables
CREATE POLICY "Admins can manage exchange rates" ON exchange_rates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can manage compliance data" ON compliance_audit_log
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
-- =============================================

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_international_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_supported_currencies_updated_at
  BEFORE UPDATE ON supported_currencies
  FOR EACH ROW EXECUTE FUNCTION update_international_updated_at();

CREATE TRIGGER update_regional_payment_methods_updated_at
  BEFORE UPDATE ON regional_payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_international_updated_at();

CREATE TRIGGER update_tax_jurisdictions_updated_at
  BEFORE UPDATE ON tax_jurisdictions
  FOR EACH ROW EXECUTE FUNCTION update_international_updated_at();

CREATE TRIGGER update_tax_rates_updated_at
  BEFORE UPDATE ON tax_rates
  FOR EACH ROW EXECUTE FUNCTION update_international_updated_at();

CREATE TRIGGER update_international_customers_updated_at
  BEFORE UPDATE ON international_customers
  FOR EACH ROW EXECUTE FUNCTION update_international_updated_at();

-- Function to automatically calculate tax for international transactions
CREATE OR REPLACE FUNCTION calculate_international_tax()
RETURNS TRIGGER AS $$
DECLARE
  applicable_rate DECIMAL(5,4);
  calculated_tax INTEGER;
BEGIN
  -- Get applicable tax rate
  SELECT tr.rate INTO applicable_rate
  FROM tax_rates tr
  JOIN tax_jurisdictions tj ON tr.jurisdiction_id = tj.id
  WHERE tj.id = NEW.tax_jurisdiction_id
  AND tr.effective_from <= CURRENT_DATE
  AND (tr.effective_until IS NULL OR tr.effective_until > CURRENT_DATE)
  LIMIT 1;

  -- Calculate tax amount
  IF applicable_rate IS NOT NULL THEN
    calculated_tax := FLOOR(NEW.settlement_amount * applicable_rate);
    
    -- Insert tax calculation record
    INSERT INTO tax_calculations (
      transaction_id,
      jurisdiction_id,
      tax_type,
      taxable_amount,
      tax_rate,
      tax_amount
    ) VALUES (
      NEW.id,
      NEW.tax_jurisdiction_id,
      'vat', -- Default to VAT, can be customized
      NEW.settlement_amount,
      applicable_rate,
      calculated_tax
    );
    
    -- Update transaction with tax amount
    NEW.tax_amount = calculated_tax;
    NEW.tax_rate = applicable_rate;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_international_tax_trigger
  BEFORE INSERT OR UPDATE ON international_transactions
  FOR EACH ROW EXECUTE FUNCTION calculate_international_tax();

-- =============================================
-- SEED DATA
-- =============================================

-- Insert supported currencies
INSERT INTO supported_currencies (code, name, symbol, payment_methods, stripe_supported) VALUES
('USD', 'US Dollar', '$', '["card", "bank_account", "ach_debit"]', TRUE),
('EUR', 'Euro', '€', '["card", "sepa_debit", "ideal", "sofort", "bancontact"]', TRUE),
('GBP', 'British Pound', '£', '["card", "bacs_debit"]', TRUE),
('CAD', 'Canadian Dollar', 'C$', '["card", "acss_debit"]', TRUE),
('AUD', 'Australian Dollar', 'A$', '["card", "au_becs_debit"]', TRUE),
('JPY', 'Japanese Yen', '¥', '["card"]', TRUE),
('CHF', 'Swiss Franc', 'CHF', '["card"]', TRUE),
('SEK', 'Swedish Krona', 'kr', '["card"]', TRUE),
('NOK', 'Norwegian Krone', 'kr', '["card"]', TRUE),
('DKK', 'Danish Krone', 'kr.', '["card"]', TRUE);

-- Insert regional payment methods
INSERT INTO regional_payment_methods (code, name, provider, regions, currencies, payment_type, processing_time) VALUES
('sepa_debit', 'SEPA Direct Debit', 'stripe', '["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"]', '["EUR"]', 'direct_debit', '2-5 business days'),
('ideal', 'iDEAL', 'stripe', '["NL"]', '["EUR"]', 'bank_transfer', 'Instant'),
('sofort', 'SOFORT', 'stripe', '["AT","BE","DE","IT","NL","ES"]', '["EUR"]', 'bank_transfer', 'Instant'),
('bancontact', 'Bancontact', 'stripe', '["BE"]', '["EUR"]', 'bank_transfer', 'Instant'),
('giropay', 'Giropay', 'stripe', '["DE"]', '["EUR"]', 'bank_transfer', 'Instant'),
('eps', 'EPS', 'stripe', '["AT"]', '["EUR"]', 'bank_transfer', 'Instant'),
('acss_debit', 'Canadian PAD', 'stripe', '["CA"]', '["CAD"]', 'direct_debit', '2-7 business days'),
('au_becs_debit', 'Australian BECS Direct Debit', 'stripe', '["AU"]', '["AUD"]', 'direct_debit', '2-3 business days'),
('bacs_debit', 'UK BACS Direct Debit', 'stripe', '["GB"]', '["GBP"]', 'direct_debit', '3 business days');

-- Insert major tax jurisdictions
INSERT INTO tax_jurisdictions (code, name, type, tax_system, default_rate, currency, registration_required, moss_eligible, effective_from) VALUES
('US', 'United States', 'country', 'sales_tax', 0.0000, 'USD', FALSE, FALSE, '2020-01-01'),
('GB', 'United Kingdom', 'country', 'vat', 0.2000, 'GBP', TRUE, FALSE, '2020-01-01'),
('DE', 'Germany', 'country', 'vat', 0.1900, 'EUR', TRUE, TRUE, '2020-01-01'),
('FR', 'France', 'country', 'vat', 0.2000, 'EUR', TRUE, TRUE, '2020-01-01'),
('IT', 'Italy', 'country', 'vat', 0.2200, 'EUR', TRUE, TRUE, '2020-01-01'),
('ES', 'Spain', 'country', 'vat', 0.2100, 'EUR', TRUE, TRUE, '2020-01-01'),
('NL', 'Netherlands', 'country', 'vat', 0.2100, 'EUR', TRUE, TRUE, '2020-01-01'),
('CA', 'Canada', 'country', 'gst', 0.0500, 'CAD', TRUE, FALSE, '2020-01-01'),
('AU', 'Australia', 'country', 'gst', 0.1000, 'AUD', TRUE, FALSE, '2020-01-01'),
('CH', 'Switzerland', 'country', 'vat', 0.0770, 'CHF', TRUE, FALSE, '2020-01-01');

-- Insert tax rates for jurisdictions
INSERT INTO tax_rates (jurisdiction_id, product_category, rate, effective_from) VALUES
((SELECT id FROM tax_jurisdictions WHERE code = 'GB'), 'standard', 0.2000, '2020-01-01'),
((SELECT id FROM tax_jurisdictions WHERE code = 'GB'), 'digital_services', 0.2000, '2020-01-01'),
((SELECT id FROM tax_jurisdictions WHERE code = 'DE'), 'standard', 0.1900, '2020-01-01'),
((SELECT id FROM tax_jurisdictions WHERE code = 'DE'), 'digital_services', 0.1900, '2020-01-01'),
((SELECT id FROM tax_jurisdictions WHERE code = 'FR'), 'standard', 0.2000, '2020-01-01'),
((SELECT id FROM tax_jurisdictions WHERE code = 'FR'), 'digital_services', 0.2000, '2020-01-01'),
((SELECT id FROM tax_jurisdictions WHERE code = 'CA'), 'standard', 0.0500, '2020-01-01'),
((SELECT id FROM tax_jurisdictions WHERE code = 'CA'), 'digital_services', 0.0500, '2020-01-01'),
((SELECT id FROM tax_jurisdictions WHERE code = 'AU'), 'standard', 0.1000, '2020-01-01'),
((SELECT id FROM tax_jurisdictions WHERE code = 'AU'), 'digital_services', 0.1000, '2020-01-01');

-- =============================================
-- COMMENTS AND DOCUMENTATION
-- =============================================

COMMENT ON TABLE supported_currencies IS 'Supported currencies with regional payment method configuration';
COMMENT ON TABLE exchange_rates IS 'Real-time and historical currency exchange rates from multiple providers';
COMMENT ON TABLE regional_payment_methods IS 'Regional payment methods like SEPA, iDEAL, SOFORT with configuration';
COMMENT ON TABLE tax_jurisdictions IS 'Global tax jurisdictions with VAT, GST, and sales tax systems';
COMMENT ON TABLE tax_rates IS 'Detailed tax rates by jurisdiction and product category';
COMMENT ON TABLE international_customers IS 'Extended customer profiles for international compliance';
COMMENT ON TABLE international_transactions IS 'International payment transactions with currency conversion';
COMMENT ON TABLE tax_calculations IS 'Calculated tax amounts for compliance and reporting';
COMMENT ON TABLE compliance_audit_log IS 'Audit trail for KYC, AML, and regulatory compliance';
COMMENT ON TABLE gdpr_data_requests IS 'GDPR data subject requests management';
COMMENT ON TABLE regulatory_reports IS 'Generated tax and compliance reports for authorities';

-- Migration complete notification
SELECT 'International payments and tax compliance migration completed successfully' as status;