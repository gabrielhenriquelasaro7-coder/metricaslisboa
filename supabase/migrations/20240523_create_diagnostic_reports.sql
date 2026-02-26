-- Criação da tabela de relatórios de diagnóstico
CREATE TABLE IF NOT EXISTS public.diagnostic_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    data JSONB NOT NULL, -- Contém bowtie, market, context, economics, ltp
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    status TEXT DEFAULT 'completo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Restrição para evitar duplicidade de relatório para o mesmo projeto no mesmo mês/ano
    UNIQUE(project_id, month, year)
);

-- Habilitar RLS
ALTER TABLE public.diagnostic_reports ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso (Seguindo o padrão do projeto)
CREATE POLICY "Usuários podem ver relatórios dos seus projetos"
ON public.diagnostic_reports FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = diagnostic_reports.project_id
    )
);

CREATE POLICY "Usuários podem inserir relatórios nos seus projetos"
ON public.diagnostic_reports FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = diagnostic_reports.project_id
    )
);

CREATE POLICY "Usuários podem atualizar relatórios dos seus projetos"
ON public.diagnostic_reports FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = diagnostic_reports.project_id
    )
);

CREATE POLICY "Usuários podem deletar relatórios dos seus projetos"
ON public.diagnostic_reports FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = diagnostic_reports.project_id
    )
);
