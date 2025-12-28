-- Create period_metrics table to store pre-calculated metrics by period
CREATE TABLE public.period_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  period_key text NOT NULL, -- 'last_7d', 'last_14d', 'last_30d', 'last_60d', 'last_90d'
  entity_type text NOT NULL, -- 'campaign', 'ad_set', 'ad'
  entity_id text NOT NULL,
  entity_name text NOT NULL,
  status text DEFAULT 'UNKNOWN',
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, period_key, entity_type, entity_id)
);

-- Enable RLS
ALTER TABLE public.period_metrics ENABLE ROW LEVEL SECURITY;

-- Users can view metrics for their own projects
CREATE POLICY "Users can view period_metrics for their projects"
ON public.period_metrics
FOR SELECT
USING (project_id IN (
  SELECT id FROM public.projects WHERE user_id = auth.uid()
));

-- Service role can manage all period_metrics
CREATE POLICY "Service role can manage period_metrics"
ON public.period_metrics
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for fast lookups
CREATE INDEX idx_period_metrics_project_period ON public.period_metrics(project_id, period_key);
CREATE INDEX idx_period_metrics_entity ON public.period_metrics(entity_type, entity_id);