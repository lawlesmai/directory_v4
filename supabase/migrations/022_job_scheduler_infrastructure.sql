-- =============================================
-- EPIC 5 STORY 5.7: Payment Failure Recovery & Dunning Management
-- Job Scheduler Infrastructure - Background job logging and monitoring
-- =============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- JOB EXECUTION LOG
-- Tracks background job execution and performance
-- =============================================

CREATE TABLE IF NOT EXISTS job_execution_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type VARCHAR(100) NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  duration INTEGER NOT NULL, -- milliseconds
  success BOOLEAN NOT NULL,
  processed INTEGER DEFAULT 0,
  successful INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  errors TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- SYSTEM HEALTH METRICS
-- Tracks system health and performance metrics
-- =============================================

CREATE TABLE IF NOT EXISTS system_health_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  metric_value NUMERIC NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(date, metric_name)
);

-- =============================================
-- JOB SCHEDULER CONFIG
-- Stores job scheduler configuration
-- =============================================

CREATE TABLE IF NOT EXISTS job_scheduler_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type VARCHAR(100) NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT TRUE,
  interval_minutes INTEGER NOT NULL,
  max_concurrent INTEGER DEFAULT 1,
  timeout_ms INTEGER DEFAULT 300000, -- 5 minutes
  priority INTEGER DEFAULT 5, -- 1-10, lower is higher priority
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE,
  configuration JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- JOB QUEUE
-- Queue for manual job executions and delayed jobs
-- =============================================

CREATE TABLE IF NOT EXISTS job_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed, cancelled
  priority INTEGER DEFAULT 5,
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  parameters JSONB DEFAULT '{}',
  result JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- RECOVERY NOTIFICATIONS
-- Stores notification queue for recovery-related communications
-- =============================================

CREATE TABLE IF NOT EXISTS recovery_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES stripe_customers(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL, -- grace_period_start, account_suspended, etc.
  channel VARCHAR(50) NOT NULL, -- email, sms, in_app
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, delivered, failed
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  content TEXT NOT NULL,
  template_id VARCHAR(255),
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Job execution log indexes
CREATE INDEX IF NOT EXISTS idx_job_execution_log_job_type ON job_execution_log(job_type);
CREATE INDEX IF NOT EXISTS idx_job_execution_log_start_time ON job_execution_log(start_time);
CREATE INDEX IF NOT EXISTS idx_job_execution_log_success ON job_execution_log(success);
CREATE INDEX IF NOT EXISTS idx_job_execution_log_type_time ON job_execution_log(job_type, start_time);

-- System health metrics indexes
CREATE INDEX IF NOT EXISTS idx_system_health_metrics_date ON system_health_metrics(date);
CREATE INDEX IF NOT EXISTS idx_system_health_metrics_metric ON system_health_metrics(metric_name, date);

-- Job scheduler config indexes
CREATE INDEX IF NOT EXISTS idx_job_scheduler_config_enabled ON job_scheduler_config(enabled);
CREATE INDEX IF NOT EXISTS idx_job_scheduler_config_next_run ON job_scheduler_config(next_run) WHERE enabled = TRUE;

-- Job queue indexes
CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status);
CREATE INDEX IF NOT EXISTS idx_job_queue_scheduled ON job_queue(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_job_queue_priority ON job_queue(priority, scheduled_at);

-- Recovery notifications indexes
CREATE INDEX IF NOT EXISTS idx_recovery_notifications_customer ON recovery_notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_recovery_notifications_status ON recovery_notifications(status);
CREATE INDEX IF NOT EXISTS idx_recovery_notifications_scheduled ON recovery_notifications(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_recovery_notifications_type ON recovery_notifications(notification_type);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on job scheduler tables
ALTER TABLE job_execution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_scheduler_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_notifications ENABLE ROW LEVEL SECURITY;

-- Job execution log - admin only
CREATE POLICY "Admins can view job execution logs" ON job_execution_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'super_admin')
    )
  );

-- System health metrics - admin only
CREATE POLICY "Admins can view system health metrics" ON system_health_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'super_admin')
    )
  );

-- Job scheduler config - admin only
CREATE POLICY "Admins can manage job scheduler config" ON job_scheduler_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'super_admin')
    )
  );

-- Job queue - admin and job creators
CREATE POLICY "Users can view their own jobs" ON job_queue
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Admins can view all jobs" ON job_queue
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'super_admin')
    )
  );

-- Recovery notifications - customer access
CREATE POLICY "Users can view their notifications" ON recovery_notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stripe_customers 
      WHERE id = recovery_notifications.customer_id 
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

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- =============================================

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_scheduler_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_system_health_metrics_updated_at
  BEFORE UPDATE ON system_health_metrics
  FOR EACH ROW EXECUTE FUNCTION update_scheduler_updated_at();

CREATE TRIGGER update_job_scheduler_config_updated_at
  BEFORE UPDATE ON job_scheduler_config
  FOR EACH ROW EXECUTE FUNCTION update_scheduler_updated_at();

CREATE TRIGGER update_job_queue_updated_at
  BEFORE UPDATE ON job_queue
  FOR EACH ROW EXECUTE FUNCTION update_scheduler_updated_at();

CREATE TRIGGER update_recovery_notifications_updated_at
  BEFORE UPDATE ON recovery_notifications
  FOR EACH ROW EXECUTE FUNCTION update_scheduler_updated_at();

-- Function to calculate next job run time
CREATE OR REPLACE FUNCTION calculate_next_job_run()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate next run time based on interval
  IF NEW.last_run IS NOT NULL THEN
    NEW.next_run = NEW.last_run + (NEW.interval_minutes || ' minutes')::INTERVAL;
  ELSE
    NEW.next_run = NOW() + (NEW.interval_minutes || ' minutes')::INTERVAL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_next_job_run_trigger
  BEFORE INSERT OR UPDATE ON job_scheduler_config
  FOR EACH ROW EXECUTE FUNCTION calculate_next_job_run();

-- Function to auto-retry failed jobs
CREATE OR REPLACE FUNCTION handle_job_queue_retry()
RETURNS TRIGGER AS $$
BEGIN
  -- If job failed and can be retried
  IF NEW.status = 'failed' AND OLD.status != 'failed' AND NEW.retry_count < NEW.max_retries THEN
    -- Schedule retry in 5 minutes
    INSERT INTO job_queue (
      job_type,
      status,
      priority,
      scheduled_at,
      parameters,
      max_retries,
      retry_count,
      created_by
    ) VALUES (
      NEW.job_type,
      'pending',
      NEW.priority + 1, -- Lower priority for retries
      NOW() + INTERVAL '5 minutes',
      NEW.parameters,
      NEW.max_retries,
      NEW.retry_count + 1,
      NEW.created_by
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_job_queue_retry_trigger
  AFTER UPDATE ON job_queue
  FOR EACH ROW EXECUTE FUNCTION handle_job_queue_retry();

-- =============================================
-- SEED DATA
-- Default job scheduler configuration
-- =============================================

INSERT INTO job_scheduler_config (job_type, interval_minutes, max_concurrent, timeout_ms, priority, configuration) VALUES
  ('payment_retry', 15, 1, 300000, 1, '{"description": "Process pending payment retries"}'),
  ('dunning_campaigns', 30, 1, 300000, 2, '{"description": "Send dunning communications"}'),
  ('grace_period_monitoring', 60, 1, 180000, 3, '{"description": "Monitor expired grace periods"}'),
  ('analytics_generation', 1440, 1, 600000, 4, '{"description": "Generate daily analytics"}'),
  ('notification_processing', 10, 2, 120000, 2, '{"description": "Process recovery notifications"}'),
  ('health_monitoring', 60, 1, 60000, 5, '{"description": "Monitor system health"}')
ON CONFLICT (job_type) DO NOTHING;

-- =============================================
-- UTILITY FUNCTIONS
-- =============================================

-- Function to get job statistics
CREATE OR REPLACE FUNCTION get_job_statistics(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  job_type TEXT,
  total_executions BIGINT,
  successful_executions BIGINT,
  failed_executions BIGINT,
  success_rate NUMERIC,
  avg_duration NUMERIC,
  avg_processed NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    jel.job_type::TEXT,
    COUNT(*) as total_executions,
    COUNT(*) FILTER (WHERE jel.success = true) as successful_executions,
    COUNT(*) FILTER (WHERE jel.success = false) as failed_executions,
    ROUND(
      COUNT(*) FILTER (WHERE jel.success = true) * 100.0 / COUNT(*), 
      2
    ) as success_rate,
    ROUND(AVG(jel.duration), 2) as avg_duration,
    ROUND(AVG(jel.processed), 2) as avg_processed
  FROM job_execution_log jel
  WHERE jel.start_time::DATE BETWEEN p_start_date AND p_end_date
  GROUP BY jel.job_type
  ORDER BY total_executions DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old job logs
CREATE OR REPLACE FUNCTION cleanup_old_job_logs(
  p_retention_days INTEGER DEFAULT 90
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM job_execution_log 
  WHERE start_time < NOW() - (p_retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Also clean up old system health metrics
  DELETE FROM system_health_metrics 
  WHERE date < CURRENT_DATE - (p_retention_days || ' days')::INTERVAL;
  
  -- Clean up old completed jobs from queue
  DELETE FROM job_queue 
  WHERE status IN ('completed', 'cancelled', 'failed')
    AND updated_at < NOW() - INTERVAL '7 days';
    
  -- Clean up old delivered notifications
  DELETE FROM recovery_notifications 
  WHERE status IN ('delivered', 'failed')
    AND updated_at < NOW() - INTERVAL '30 days';
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- COMMENTS AND DOCUMENTATION
-- =============================================

COMMENT ON TABLE job_execution_log IS 'Logs all background job executions with performance metrics';
COMMENT ON TABLE system_health_metrics IS 'Tracks system-wide health and performance metrics';
COMMENT ON TABLE job_scheduler_config IS 'Configuration for automated background jobs';
COMMENT ON TABLE job_queue IS 'Queue for manual and delayed job executions';
COMMENT ON TABLE recovery_notifications IS 'Queue for recovery-related notifications and communications';

-- Migration complete notification
SELECT 'Job scheduler infrastructure migration completed successfully' as status;