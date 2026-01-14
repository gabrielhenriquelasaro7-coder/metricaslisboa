-- =====================================================
-- SISTEMA DE CARGO + SQUAD - MIGRAÇÃO COMPLETA
-- =====================================================

-- 1. Criar novo enum para cargos (substituindo o antigo app_role)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_cargo_v2') THEN
        CREATE TYPE public.user_cargo_v2 AS ENUM (
            'tech',       -- Acesso técnico total ao Admin
            'gerente',    -- Vê tudo, gerencia squads e investidores
            'coordenador', -- Vê projetos da sua squad
            'investidor', -- Vê apenas projetos onde é responsável
            'membro'      -- Sem privilégios extras (convidado)
        );
    END IF;
END $$;

-- 2. Criar tabela de Squads
CREATE TABLE IF NOT EXISTS public.squads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT DEFAULT '#3B82F6',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Criar tabela de membros de squad (usuário pertence a uma ou mais squads)
CREATE TABLE IF NOT EXISTS public.squad_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    squad_id UUID NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, squad_id)
);

-- 4. Adicionar squad_id aos projetos (qual squad o projeto pertence)
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS squad_id UUID REFERENCES public.squads(id) ON DELETE SET NULL;

-- 5. Adicionar investidor_id aos projetos (quem é o responsável pelo projeto)
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS investidor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 6. Atualizar user_roles para usar o novo cargo
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS cargo user_cargo_v2 DEFAULT 'investidor';

-- 7. Migrar roles existentes para o novo sistema de cargo
UPDATE public.user_roles SET cargo = 'tech' WHERE role = 'admin';
UPDATE public.user_roles SET cargo = 'investidor' WHERE role = 'gestor';
UPDATE public.user_roles SET cargo = 'membro' WHERE role = 'convidado';

-- 8. Criar tabela de solicitações de acesso admin
CREATE TABLE IF NOT EXISTS public.admin_access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Criar squads iniciais
INSERT INTO public.squads (name, description, color) VALUES
    ('SHARK', 'Squad SHARK', '#3B82F6'),
    ('TIGERS', 'Squad TIGERS', '#F97316'),
    ('LIONS', 'Squad LIONS', '#EAB308')
ON CONFLICT (name) DO NOTHING;

-- 10. Criar funções de segurança (SECURITY DEFINER para evitar recursão RLS)

-- Função para verificar cargo do usuário
CREATE OR REPLACE FUNCTION public.get_user_cargo(_user_id uuid)
RETURNS user_cargo_v2
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(cargo, 'membro'::user_cargo_v2)
    FROM public.user_roles
    WHERE user_id = _user_id
    LIMIT 1
$$;

-- Função para verificar se usuário tem cargo específico
CREATE OR REPLACE FUNCTION public.has_cargo(_user_id uuid, _cargo user_cargo_v2)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND cargo = _cargo
    )
$$;

-- Função para verificar se usuário é Tech ou Gerente (vê tudo)
CREATE OR REPLACE FUNCTION public.can_see_all_projects(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND cargo IN ('tech', 'gerente')
    )
$$;

-- Função para verificar squads do usuário
CREATE OR REPLACE FUNCTION public.get_user_squad_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(array_agg(squad_id), ARRAY[]::uuid[])
    FROM public.squad_members
    WHERE user_id = _user_id
$$;

-- Função para verificar se usuário pode ver projeto
CREATE OR REPLACE FUNCTION public.can_view_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        -- Tech e Gerente veem tudo
        public.can_see_all_projects(_user_id)
        OR
        -- Coordenador vê projetos da sua squad
        (
            public.get_user_cargo(_user_id) = 'coordenador' 
            AND EXISTS (
                SELECT 1 FROM public.projects p
                JOIN public.squad_members sm ON sm.squad_id = p.squad_id
                WHERE p.id = _project_id AND sm.user_id = _user_id
            )
        )
        OR
        -- Investidor vê apenas projetos onde é responsável
        (
            public.get_user_cargo(_user_id) = 'investidor'
            AND EXISTS (
                SELECT 1 FROM public.projects p
                WHERE p.id = _project_id AND p.investidor_id = _user_id
            )
        )
        OR
        -- Membro (convidado) usa o sistema antigo de guest_project_access
        EXISTS (
            SELECT 1 FROM public.guest_project_access
            WHERE project_id = _project_id AND user_id = _user_id
        )
        OR
        -- Owner original do projeto
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE id = _project_id AND user_id = _user_id
        )
$$;

-- 11. Habilitar RLS nas novas tabelas
ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_access_requests ENABLE ROW LEVEL SECURITY;

-- 12. Políticas RLS para squads
CREATE POLICY "Authenticated users can view squads"
ON public.squads FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Tech and Gerente can manage squads"
ON public.squads FOR ALL
TO authenticated
USING (public.can_see_all_projects(auth.uid()));

-- 13. Políticas RLS para squad_members
CREATE POLICY "Users can view squad memberships"
ON public.squad_members FOR SELECT
TO authenticated
USING (
    public.can_see_all_projects(auth.uid())
    OR user_id = auth.uid()
);

CREATE POLICY "Tech and Gerente can manage squad members"
ON public.squad_members FOR ALL
TO authenticated
USING (public.can_see_all_projects(auth.uid()));

-- 14. Políticas RLS para admin_access_requests
CREATE POLICY "Users can view their own requests"
ON public.admin_access_requests FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_cargo(auth.uid(), 'tech'));

CREATE POLICY "Users can create their own requests"
ON public.admin_access_requests FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Tech can manage all requests"
ON public.admin_access_requests FOR UPDATE
TO authenticated
USING (public.has_cargo(auth.uid(), 'tech'));

-- 15. Atualizar política de projetos para usar novo sistema
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Guests can view their allowed projects" ON public.projects;

CREATE POLICY "Users can view projects based on cargo and squad"
ON public.projects FOR SELECT
TO authenticated
USING (public.can_view_project(auth.uid(), id));

-- 16. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_squads_updated_at ON public.squads;
CREATE TRIGGER update_squads_updated_at
    BEFORE UPDATE ON public.squads
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_admin_access_requests_updated_at ON public.admin_access_requests;
CREATE TRIGGER update_admin_access_requests_updated_at
    BEFORE UPDATE ON public.admin_access_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 17. Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_projects_squad_id ON public.projects(squad_id);
CREATE INDEX IF NOT EXISTS idx_projects_investidor_id ON public.projects(investidor_id);
CREATE INDEX IF NOT EXISTS idx_squad_members_user_id ON public.squad_members(user_id);
CREATE INDEX IF NOT EXISTS idx_squad_members_squad_id ON public.squad_members(squad_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_cargo ON public.user_roles(cargo);
CREATE INDEX IF NOT EXISTS idx_admin_access_requests_status ON public.admin_access_requests(status);