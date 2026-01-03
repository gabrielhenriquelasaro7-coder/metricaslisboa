-- Create table for campaign goals (CPL/ROAS targets per campaign)
CREATE TABLE public.campaign_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  target_cpl NUMERIC NULL,
  target_roas NUMERIC NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, campaign_id)
);

-- Enable RLS
ALTER TABLE public.campaign_goals ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view campaign_goals for their projects" 
ON public.campaign_goals 
FOR SELECT 
USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can create campaign_goals for their projects" 
ON public.campaign_goals 
FOR INSERT 
WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can update campaign_goals for their projects" 
ON public.campaign_goals 
FOR UPDATE 
USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete campaign_goals for their projects" 
ON public.campaign_goals 
FOR DELETE 
USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Guests can view campaign_goals for accessible projects" 
ON public.campaign_goals 
FOR SELECT 
USING (project_id IN (SELECT project_id FROM guest_project_access WHERE user_id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_campaign_goals_updated_at
BEFORE UPDATE ON public.campaign_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();