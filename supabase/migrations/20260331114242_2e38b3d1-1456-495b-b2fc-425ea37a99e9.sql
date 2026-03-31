-- Align project visibility for all authenticated roles and allow project owners to grant access safely.

-- 1) Unify access checks so visibility works whether investor links were saved with auth user_id
--    or with user_management.id, and so squad/invite visibility is consistent everywhere.
CREATE OR REPLACE FUNCTION public.can_view_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.can_see_all_projects(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = _project_id
        AND p.user_id = _user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      JOIN public.squad_members sm ON sm.squad_id = p.squad_id
      WHERE p.id = _project_id
        AND sm.user_id = _user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.guest_project_access gpa
      WHERE gpa.project_id = _project_id
        AND gpa.user_id = _user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = _project_id
        AND p.investidor_id = _user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.project_investidores pi
      WHERE pi.project_id = _project_id
        AND pi.investidor_id = _user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.project_investidores pi
      JOIN public.user_management um ON um.id = pi.investidor_id
      WHERE pi.project_id = _project_id
        AND um.user_id = _user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.user_has_project_access(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_view_project(_user_id, _project_id);
$$;

-- 2) Let the project owner manage guest access rows for their own projects.
CREATE POLICY "Project owners can view granted guest access"
ON public.guest_project_access
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = guest_project_access.project_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Project owners can grant guest access"
ON public.guest_project_access
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = guest_project_access.project_id
      AND p.user_id = auth.uid()
  )
  AND granted_by = auth.uid()
);

CREATE POLICY "Project owners can update granted guest access"
ON public.guest_project_access
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = guest_project_access.project_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = guest_project_access.project_id
      AND p.user_id = auth.uid()
  )
  AND granted_by = auth.uid()
);

CREATE POLICY "Project owners can revoke guest access"
ON public.guest_project_access
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = guest_project_access.project_id
      AND p.user_id = auth.uid()
  )
);

-- 3) Let the project owner manage investor links for projects they created,
--    so any authenticated role that creates a project can assign visibility.
CREATE POLICY "Project owners can manage investor links"
ON public.project_investidores
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = project_investidores.project_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Project owners can view investor links"
ON public.project_investidores
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = project_investidores.project_id
      AND p.user_id = auth.uid()
  )
  OR public.can_view_project(auth.uid(), project_id)
);

CREATE POLICY "Project owners can remove investor links"
ON public.project_investidores
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = project_investidores.project_id
      AND p.user_id = auth.uid()
  )
);

-- 4) Safety: remove any stale access mismatch only at read-time via functions above;
--    no data rewrite needed because the function now supports both historical formats.