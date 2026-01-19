-- Create table to track planner monday send history
CREATE TABLE public.whatsapp_planner_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  config_id UUID REFERENCES public.whatsapp_planner_configs(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  message_content TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'phone',
  target_identifier TEXT,
  target_name TEXT,
  instance_id UUID,
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_planner_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view planner history for accessible projects"
  ON public.whatsapp_planner_history
  FOR SELECT
  USING (public.can_view_project(auth.uid(), project_id));

CREATE POLICY "Users can insert planner history"
  ON public.whatsapp_planner_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_whatsapp_planner_history_project ON public.whatsapp_planner_history(project_id);
CREATE INDEX idx_whatsapp_planner_history_sent_at ON public.whatsapp_planner_history(sent_at DESC);