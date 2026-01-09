-- Adicionar coluna changed_by para armazenar quem fez a mudança
ALTER TABLE public.optimization_history 
ADD COLUMN IF NOT EXISTS changed_by TEXT;

-- Adicionar índice para melhorar consultas por changed_by
CREATE INDEX IF NOT EXISTS idx_optimization_history_changed_by ON public.optimization_history(changed_by);

-- Limpar histórico antigo (manter apenas últimos 7 dias)
DELETE FROM public.optimization_history 
WHERE detected_at < NOW() - INTERVAL '7 days';