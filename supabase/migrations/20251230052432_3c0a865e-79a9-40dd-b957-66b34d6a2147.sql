-- Add AI briefing/context field to projects
ALTER TABLE public.projects 
ADD COLUMN ai_briefing TEXT DEFAULT NULL;

-- Add comment to explain the field
COMMENT ON COLUMN public.projects.ai_briefing IS 'Custom context and briefing for the AI agent (target market, country, acceptable KPIs, business specifics)';