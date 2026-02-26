
-- Tabela para persistir diagnósticos
CREATE TABLE public.diagnostic_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, month, year)
);

-- Enable RLS
ALTER TABLE public.diagnostic_reports ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view diagnostic reports for their projects"
ON public.diagnostic_reports FOR SELECT
USING (can_view_project(auth.uid(), project_id));

CREATE POLICY "Users can insert diagnostic reports"
ON public.diagnostic_reports FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their diagnostic reports"
ON public.diagnostic_reports FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their diagnostic reports"
ON public.diagnostic_reports FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_diagnostic_reports_updated_at
BEFORE UPDATE ON public.diagnostic_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
