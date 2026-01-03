-- Adicionar novas colunas de metas na tabela campaign_goals
ALTER TABLE public.campaign_goals
ADD COLUMN IF NOT EXISTS target_ctr numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS max_cpc numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS target_leads integer DEFAULT NULL;