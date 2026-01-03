-- Create anomaly alerts configuration table
CREATE TABLE public.anomaly_alert_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  -- Alert thresholds (percentage)
  ctr_drop_threshold NUMERIC DEFAULT 20,
  cpl_increase_threshold NUMERIC DEFAULT 30,
  campaign_paused_alert BOOLEAN DEFAULT true,
  ad_set_paused_alert BOOLEAN DEFAULT true,
  ad_paused_alert BOOLEAN DEFAULT false,
  budget_change_alert BOOLEAN DEFAULT true,
  -- Target (phone or group)
  target_type TEXT NOT NULL DEFAULT 'phone',
  phone_number TEXT,
  group_id TEXT,
  group_name TEXT,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_alert_at TIMESTAMP WITH TIME ZONE,
  -- Unique per user per project
  UNIQUE(user_id, project_id)
);

-- Enable RLS
ALTER TABLE public.anomaly_alert_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own alert config"
ON public.anomaly_alert_config
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own alert config"
ON public.anomaly_alert_config
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update own alert config"
ON public.anomaly_alert_config
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own alert config"
ON public.anomaly_alert_config
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_anomaly_alert_config_updated_at
BEFORE UPDATE ON public.anomaly_alert_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create anomaly_alerts table to log detected anomalies
CREATE TABLE public.anomaly_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  anomaly_type TEXT NOT NULL, -- 'ctr_drop', 'cpl_increase', 'campaign_paused', 'ad_set_paused', 'ad_paused', 'budget_change'
  entity_type TEXT NOT NULL, -- 'campaign', 'ad_set', 'ad'
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  details JSONB,
  severity TEXT NOT NULL DEFAULT 'warning', -- 'info', 'warning', 'critical'
  notified BOOLEAN NOT NULL DEFAULT false,
  notified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.anomaly_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for anomaly_alerts
CREATE POLICY "Users can view anomaly_alerts for their projects"
ON public.anomaly_alerts
FOR SELECT
USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Guests can view anomaly_alerts for accessible projects"
ON public.anomaly_alerts
FOR SELECT
USING (project_id IN (SELECT project_id FROM guest_project_access WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage anomaly_alerts"
ON public.anomaly_alerts
FOR ALL
USING (true)
WITH CHECK (true);