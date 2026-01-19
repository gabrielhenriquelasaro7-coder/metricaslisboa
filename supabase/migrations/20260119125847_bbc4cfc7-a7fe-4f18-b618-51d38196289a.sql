-- Create table for Account Planner Monday configurations
CREATE TABLE public.whatsapp_planner_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES public.whatsapp_manager_instances(id) ON DELETE SET NULL,
  
  -- Target configuration
  target_type TEXT DEFAULT 'phone', -- 'phone' or 'group'
  phone_number TEXT,
  group_id TEXT,
  group_name TEXT,
  
  -- Scheduling
  planner_enabled BOOLEAN DEFAULT true,
  report_day_of_week INTEGER DEFAULT 1, -- 0-6 (Sunday-Saturday)
  report_time TIME WITHOUT TIME ZONE DEFAULT '09:00',
  
  -- Steps
  current_step TEXT DEFAULT 'V1', -- V0, V1, V2, V3, V4
  target_step TEXT DEFAULT 'V2', -- Always current + 1
  
  -- Manual Metrics
  roi_atual DECIMAL,
  cac_atual DECIMAL,
  investimento_mensal DECIMAL,
  faturamento_marketing DECIMAL,
  
  -- Main Goal
  meta_principal_quarter TEXT,
  
  -- Sub Goals (stored as JSON array)
  sub_metas JSONB DEFAULT '[]'::jsonb,
  
  -- Step Change Criteria (stored as JSON array)
  criterios_mudanca_step JSONB DEFAULT '[]'::jsonb,
  
  -- Weekly Goal
  meta_semana TEXT,
  meta_semana_porque TEXT,
  
  -- Operational Links
  link_forecasting TEXT,
  link_plano_midia TEXT,
  link_planejamento_quarter TEXT,
  
  -- Message template (optional custom)
  message_template TEXT,
  
  -- Timestamps
  last_report_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create unique constraint per project
CREATE UNIQUE INDEX whatsapp_planner_configs_project_unique ON public.whatsapp_planner_configs(project_id);

-- Enable RLS
ALTER TABLE public.whatsapp_planner_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own planner configs"
  ON public.whatsapp_planner_configs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own planner configs"
  ON public.whatsapp_planner_configs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own planner configs"
  ON public.whatsapp_planner_configs
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own planner configs"
  ON public.whatsapp_planner_configs
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_whatsapp_planner_configs_updated_at
  BEFORE UPDATE ON public.whatsapp_planner_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();