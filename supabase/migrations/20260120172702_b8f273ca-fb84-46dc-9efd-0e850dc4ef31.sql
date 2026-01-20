
-- Atualizar função can_view_project para verificar também project_investidores
CREATE OR REPLACE FUNCTION public.can_view_project(_user_id uuid, _project_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        -- Investidor vê projetos onde é responsável (coluna investidor_id)
        (
            public.get_user_cargo(_user_id) = 'investidor'
            AND EXISTS (
                SELECT 1 FROM public.projects p
                WHERE p.id = _project_id AND p.investidor_id = _user_id
            )
        )
        OR
        -- Investidor vê projetos onde está na tabela project_investidores (múltiplos investidores)
        (
            public.get_user_cargo(_user_id) = 'investidor'
            AND EXISTS (
                SELECT 1 FROM public.project_investidores pi
                WHERE pi.project_id = _project_id AND pi.investidor_id = _user_id
            )
        )
        OR
        -- Membro (convidado) usa o sistema de guest_project_access
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
$function$;
