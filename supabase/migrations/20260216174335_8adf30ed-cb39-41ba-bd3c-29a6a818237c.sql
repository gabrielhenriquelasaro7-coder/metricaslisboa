
CREATE TABLE public.clarity_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  clarity_project_id TEXT NOT NULL,
  label TEXT NOT NULL,
  api_token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clarity_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view clarity projects"
ON public.clarity_projects FOR SELECT
USING (
  project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert clarity projects"
ON public.clarity_projects FOR INSERT
WITH CHECK (
  project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update clarity projects"
ON public.clarity_projects FOR UPDATE
USING (
  project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
);

CREATE POLICY "Users can delete clarity projects"
ON public.clarity_projects FOR DELETE
USING (
  project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
);

CREATE TRIGGER update_clarity_projects_updated_at
BEFORE UPDATE ON public.clarity_projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
