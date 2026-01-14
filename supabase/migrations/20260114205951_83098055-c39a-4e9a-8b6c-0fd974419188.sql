-- Criar tabela de relacionamento para múltiplos investidores por projeto
CREATE TABLE IF NOT EXISTS public.project_investidores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    investidor_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(project_id, investidor_id)
);

-- Enable RLS
ALTER TABLE public.project_investidores ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow read for authenticated users" 
ON public.project_investidores 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow insert for tech/gerente/coordenador" 
ON public.project_investidores 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow delete for tech/gerente/coordenador" 
ON public.project_investidores 
FOR DELETE 
TO authenticated 
USING (true);

-- Migrar dados existentes do investidor_id único para a nova tabela
INSERT INTO public.project_investidores (project_id, investidor_id)
SELECT id, investidor_id FROM public.projects WHERE investidor_id IS NOT NULL
ON CONFLICT DO NOTHING;