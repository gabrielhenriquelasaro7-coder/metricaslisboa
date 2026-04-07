-- Allow investidores to read coordenadores and gerentes from user_management
-- so they can populate the "responsável" dropdown when creating projects
CREATE POLICY "Investidores can view coordinators and managers"
  ON public.user_management
  FOR SELECT
  TO authenticated
  USING (
    cargo IN ('coordenador', 'gerente')
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.cargo IN ('investidor', 'membro')
    )
  );