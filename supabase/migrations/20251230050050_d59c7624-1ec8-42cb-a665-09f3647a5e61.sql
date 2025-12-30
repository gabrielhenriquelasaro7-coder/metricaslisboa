-- Create table for AI analysis cache
CREATE TABLE public.ai_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  query_hash TEXT NOT NULL,
  user_message TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  context_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour')
);

-- Create index for faster lookups
CREATE INDEX idx_ai_cache_project_hash ON public.ai_analysis_cache(project_id, query_hash);
CREATE INDEX idx_ai_cache_expires ON public.ai_analysis_cache(expires_at);

-- Enable RLS
ALTER TABLE public.ai_analysis_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view cache for their projects"
ON public.ai_analysis_cache
FOR SELECT
USING (project_id IN (
  SELECT id FROM projects WHERE user_id = auth.uid()
));

CREATE POLICY "Service role can manage cache"
ON public.ai_analysis_cache
FOR ALL
USING (true)
WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.ai_analysis_cache IS 'Cache for AI analysis responses to reduce API calls';