-- Adicionar suporte a múltiplas métricas de resultado no modelo personalizado
-- Adiciona coluna para array de métricas de resultado
ALTER TABLE public.project_metric_config 
ADD COLUMN IF NOT EXISTS result_metrics JSONB DEFAULT '[]'::jsonb;

-- Adiciona coluna para labels personalizados por métrica
ALTER TABLE public.project_metric_config 
ADD COLUMN IF NOT EXISTS result_metrics_labels JSONB DEFAULT '{}'::jsonb;

-- Comentários para documentação
COMMENT ON COLUMN public.project_metric_config.result_metrics IS 'Array de métricas de resultado selecionadas (ex: ["leads", "purchases"])';
COMMENT ON COLUMN public.project_metric_config.result_metrics_labels IS 'Labels personalizados por métrica (ex: {"leads": "Leads Qualificados", "purchases": "Vendas"})';