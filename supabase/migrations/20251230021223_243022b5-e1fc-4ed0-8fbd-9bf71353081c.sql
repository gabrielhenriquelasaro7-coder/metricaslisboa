-- Tabela para rastrear importação mês a mês
CREATE TABLE public.project_import_months (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'importing', 'success', 'error', 'skipped')),
  records_count integer DEFAULT 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  retry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(project_id, year, month)
);

-- Índices para consultas rápidas
CREATE INDEX idx_project_import_months_project ON public.project_import_months(project_id);
CREATE INDEX idx_project_import_months_status ON public.project_import_months(status);

-- Enable RLS
ALTER TABLE public.project_import_months ENABLE ROW LEVEL SECURITY;

-- Política para usuários verem seus próprios meses
CREATE POLICY "Users can view import months for their projects" 
ON public.project_import_months 
FOR SELECT 
USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Política para service role gerenciar
CREATE POLICY "Service role can manage import months" 
ON public.project_import_months 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Habilitar realtime para atualizações em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_import_months;