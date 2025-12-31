-- Adicionar 'custom' ao enum business_model
ALTER TYPE public.business_model ADD VALUE IF NOT EXISTS 'custom';

-- Criar tabela de configuração de métricas por projeto
CREATE TABLE public.project_metric_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  
  -- Métricas principais (cards do dashboard)
  primary_metrics JSONB DEFAULT '["spend", "impressions", "clicks", "ctr", "cpm", "cpc"]'::jsonb,
  
  -- Métrica de resultado (o que conta como "conversão")
  result_metric TEXT DEFAULT 'conversions',
  result_metric_label TEXT DEFAULT 'Conversões',
  
  -- Métricas de custo a exibir
  cost_metrics JSONB DEFAULT '["cpa"]'::jsonb,
  
  -- Métricas de eficiência
  efficiency_metrics JSONB DEFAULT '["roas"]'::jsonb,
  
  -- Se mostra comparação com período anterior
  show_comparison BOOLEAN DEFAULT true,
  
  -- Métricas do gráfico principal
  chart_primary_metric TEXT DEFAULT 'spend',
  chart_secondary_metric TEXT DEFAULT 'conversions',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraint única por projeto
  CONSTRAINT unique_project_metric_config UNIQUE (project_id)
);

-- Habilitar RLS
ALTER TABLE public.project_metric_config ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view metric config for their projects"
ON public.project_metric_config
FOR SELECT
USING (project_id IN (
  SELECT id FROM public.projects WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create metric config for their projects"
ON public.project_metric_config
FOR INSERT
WITH CHECK (project_id IN (
  SELECT id FROM public.projects WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update metric config for their projects"
ON public.project_metric_config
FOR UPDATE
USING (project_id IN (
  SELECT id FROM public.projects WHERE user_id = auth.uid()
));

CREATE POLICY "Users can delete metric config for their projects"
ON public.project_metric_config
FOR DELETE
USING (project_id IN (
  SELECT id FROM public.projects WHERE user_id = auth.uid()
));

-- Trigger para updated_at
CREATE TRIGGER update_project_metric_config_updated_at
BEFORE UPDATE ON public.project_metric_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para performance
CREATE INDEX idx_project_metric_config_project_id ON public.project_metric_config(project_id);