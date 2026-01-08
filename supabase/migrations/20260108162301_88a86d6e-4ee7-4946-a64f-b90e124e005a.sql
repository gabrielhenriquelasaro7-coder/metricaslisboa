-- Tabela: Instâncias WhatsApp do Gestor (máx 4 por usuário)
CREATE TABLE public.whatsapp_manager_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  instance_name TEXT NOT NULL,
  display_name TEXT DEFAULT 'Meu WhatsApp',
  instance_status TEXT DEFAULT 'disconnected',
  phone_connected TEXT,
  qr_code TEXT,
  qr_code_expires_at TIMESTAMPTZ,
  token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: Configurações de Relatório por Projeto
CREATE TABLE public.whatsapp_report_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  instance_id UUID REFERENCES public.whatsapp_manager_instances(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  
  -- Destino
  target_type TEXT DEFAULT 'phone',
  phone_number TEXT,
  group_id TEXT,
  group_name TEXT,
  
  -- Configuração do Relatório
  report_enabled BOOLEAN DEFAULT true,
  report_day_of_week INTEGER DEFAULT 1,
  report_time TIME DEFAULT '08:00',
  report_period TEXT DEFAULT 'last_7_days',
  message_template TEXT,
  
  -- Métricas incluídas
  include_spend BOOLEAN DEFAULT true,
  include_leads BOOLEAN DEFAULT true,
  include_cpl BOOLEAN DEFAULT true,
  include_impressions BOOLEAN DEFAULT true,
  include_clicks BOOLEAN DEFAULT true,
  include_ctr BOOLEAN DEFAULT true,
  include_roas BOOLEAN DEFAULT true,
  include_reach BOOLEAN DEFAULT true,
  include_cpm BOOLEAN DEFAULT true,
  include_cpc BOOLEAN DEFAULT true,
  include_conversions BOOLEAN DEFAULT true,
  include_conversion_value BOOLEAN DEFAULT true,
  include_frequency BOOLEAN DEFAULT true,
  
  -- Alerta de Saldo
  balance_alert_enabled BOOLEAN DEFAULT false,
  balance_alert_threshold INTEGER DEFAULT 3,
  last_balance_alert_at TIMESTAMPTZ,
  
  -- Tracking
  last_report_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, project_id)
);

-- Índices
CREATE INDEX idx_whatsapp_manager_instances_user_id ON public.whatsapp_manager_instances(user_id);
CREATE INDEX idx_whatsapp_report_configs_user_id ON public.whatsapp_report_configs(user_id);
CREATE INDEX idx_whatsapp_report_configs_project_id ON public.whatsapp_report_configs(project_id);
CREATE INDEX idx_whatsapp_report_configs_instance_id ON public.whatsapp_report_configs(instance_id);

-- Enable RLS
ALTER TABLE public.whatsapp_manager_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_report_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies para whatsapp_manager_instances
CREATE POLICY "Users can view own instances"
  ON public.whatsapp_manager_instances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own instances"
  ON public.whatsapp_manager_instances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own instances"
  ON public.whatsapp_manager_instances FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own instances"
  ON public.whatsapp_manager_instances FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage instances"
  ON public.whatsapp_manager_instances FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies para whatsapp_report_configs
CREATE POLICY "Users can view own configs"
  ON public.whatsapp_report_configs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own configs"
  ON public.whatsapp_report_configs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own configs"
  ON public.whatsapp_report_configs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own configs"
  ON public.whatsapp_report_configs FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage configs"
  ON public.whatsapp_report_configs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_whatsapp_manager_instances_updated_at
  BEFORE UPDATE ON public.whatsapp_manager_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_report_configs_updated_at
  BEFORE UPDATE ON public.whatsapp_report_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();