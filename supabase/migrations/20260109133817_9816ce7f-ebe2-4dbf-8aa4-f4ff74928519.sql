-- Create table for account-level goals (general goals for the entire project)
CREATE TABLE public.account_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  target_leads_monthly INTEGER,
  target_cpl NUMERIC,
  target_roas NUMERIC,
  target_ctr NUMERIC,
  target_cpc NUMERIC,
  target_spend_daily NUMERIC,
  target_spend_monthly NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

-- Enable RLS
ALTER TABLE public.account_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can manage goals for their own projects
CREATE POLICY "Users can view account goals for their projects"
ON public.account_goals
FOR SELECT
USING (
  project_id IN (
    SELECT id FROM public.projects WHERE user_id = auth.uid()
  ) OR
  project_id IN (
    SELECT project_id FROM public.guest_project_access WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert account goals for their projects"
ON public.account_goals
FOR INSERT
WITH CHECK (
  project_id IN (
    SELECT id FROM public.projects WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update account goals for their projects"
ON public.account_goals
FOR UPDATE
USING (
  project_id IN (
    SELECT id FROM public.projects WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete account goals for their projects"
ON public.account_goals
FOR DELETE
USING (
  project_id IN (
    SELECT id FROM public.projects WHERE user_id = auth.uid()
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_account_goals_updated_at
BEFORE UPDATE ON public.account_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();