-- Create sync_progress table for tracking chunked sync progress
CREATE TABLE public.sync_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL DEFAULT 'metrics',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_chunks INTEGER NOT NULL,
  completed_chunks INTEGER DEFAULT 0,
  current_chunk JSONB,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  records_synced INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.sync_progress ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_sync_progress_project ON public.sync_progress(project_id);
CREATE INDEX idx_sync_progress_status ON public.sync_progress(status);
CREATE INDEX idx_sync_progress_project_status ON public.sync_progress(project_id, status);

-- RLS Policies
CREATE POLICY "Users can view their own sync progress"
  ON public.sync_progress FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
    OR
    project_id IN (
      SELECT project_id FROM public.guest_project_access WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert sync progress for their projects"
  ON public.sync_progress FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update sync progress for their projects"
  ON public.sync_progress FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete sync progress for their projects"
  ON public.sync_progress FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_sync_progress_updated_at
  BEFORE UPDATE ON public.sync_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();