-- Migração para permitir que investidores visualizem coordenadores e gerentes
-- Necessário para que investidores possam selecionar os responsáveis ao criar um novo projeto

CREATE POLICY "Investors can view coordinators and managers"
ON public.user_management
FOR SELECT
TO authenticated
USING (
  (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.cargo = 'investidor'
    )
    AND
    cargo IN ('coordenador', 'gerente')
  )
  OR
  (
    -- Garante que tech e gerente continuem vendo tudo (redundante mas seguro)
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.cargo IN ('tech', 'gerente')
    )
  )
);

-- Nota: As políticas existentes "Tech and Gerente can manage users" e "Users can view own management record" 
-- permanecem ativas. Esta nova política apenas expande a visibilidade para investidores.
