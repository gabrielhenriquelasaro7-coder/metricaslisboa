-- Create optimization history table to track all changes in campaigns, ad sets, and ads
CREATE TABLE public.optimization_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'campaign', 'ad_set', 'ad'
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  field_changed TEXT NOT NULL, -- e.g., 'status', 'daily_budget', 'spend', 'ctr'
  old_value TEXT,
  new_value TEXT,
  change_type TEXT NOT NULL, -- 'status_change', 'budget_change', 'metric_change', 'created', 'paused', 'activated'
  change_percentage NUMERIC, -- For metric changes, store the % change
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_optimization_history_project ON public.optimization_history(project_id);
CREATE INDEX idx_optimization_history_detected_at ON public.optimization_history(detected_at DESC);
CREATE INDEX idx_optimization_history_entity ON public.optimization_history(entity_type, entity_id);

-- Enable RLS
ALTER TABLE public.optimization_history ENABLE ROW LEVEL SECURITY;

-- Users can view optimization history for their projects
CREATE POLICY "Users can view optimization_history for their projects"
ON public.optimization_history
FOR SELECT
USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Guests can view optimization history for accessible projects
CREATE POLICY "Guests can view optimization_history for accessible projects"
ON public.optimization_history
FOR SELECT
USING (project_id IN (SELECT project_id FROM guest_project_access WHERE user_id = auth.uid()));

-- Service role can manage optimization history
CREATE POLICY "Service role can manage optimization_history"
ON public.optimization_history
FOR ALL
USING (true)
WITH CHECK (true);