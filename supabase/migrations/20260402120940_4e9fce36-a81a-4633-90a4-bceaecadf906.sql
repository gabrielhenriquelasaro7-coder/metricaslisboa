CREATE OR REPLACE FUNCTION public.is_project_owner(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = _project_id
      AND p.user_id = _user_id
  );
$$;

DROP POLICY IF EXISTS "Guests can view projects they have access to" ON public.projects;
DROP POLICY IF EXISTS "Projects_Select_Safe" ON public.projects;
DROP POLICY IF EXISTS "Users can view projects based on cargo and squad" ON public.projects;

CREATE POLICY "Authenticated users can view allowed projects"
ON public.projects
FOR SELECT
TO authenticated
USING (public.can_view_project(auth.uid(), id));

DROP POLICY IF EXISTS "Project owners can grant guest access" ON public.guest_project_access;
DROP POLICY IF EXISTS "Project owners can revoke guest access" ON public.guest_project_access;
DROP POLICY IF EXISTS "Project owners can update granted guest access" ON public.guest_project_access;
DROP POLICY IF EXISTS "Project owners can view granted guest access" ON public.guest_project_access;
DROP POLICY IF EXISTS "Users can view access they granted" ON public.guest_project_access;

CREATE POLICY "Authorized users can view guest access"
ON public.guest_project_access
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR auth.uid() = granted_by
  OR public.is_project_owner(auth.uid(), project_id)
  OR public.can_see_all_projects(auth.uid())
);

CREATE POLICY "Authorized users can create guest access"
ON public.guest_project_access
FOR INSERT
TO authenticated
WITH CHECK (
  (
    public.is_project_owner(auth.uid(), project_id)
    OR public.can_see_all_projects(auth.uid())
  )
  AND granted_by = auth.uid()
);

CREATE POLICY "Authorized users can update guest access"
ON public.guest_project_access
FOR UPDATE
TO authenticated
USING (
  public.is_project_owner(auth.uid(), project_id)
  OR public.can_see_all_projects(auth.uid())
)
WITH CHECK (
  (
    public.is_project_owner(auth.uid(), project_id)
    OR public.can_see_all_projects(auth.uid())
  )
  AND granted_by = auth.uid()
);

CREATE POLICY "Authorized users can delete guest access"
ON public.guest_project_access
FOR DELETE
TO authenticated
USING (
  public.is_project_owner(auth.uid(), project_id)
  OR public.can_see_all_projects(auth.uid())
);

DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.project_investidores;
DROP POLICY IF EXISTS "Allow insert for tech/gerente/coordenador" ON public.project_investidores;
DROP POLICY IF EXISTS "Allow delete for tech/gerente/coordenador" ON public.project_investidores;
DROP POLICY IF EXISTS "Project owners can manage investor links" ON public.project_investidores;
DROP POLICY IF EXISTS "Project owners can remove investor links" ON public.project_investidores;
DROP POLICY IF EXISTS "Project owners can view investor links" ON public.project_investidores;

CREATE POLICY "Authorized users can view investor links"
ON public.project_investidores
FOR SELECT
TO authenticated
USING (public.can_view_project(auth.uid(), project_id));

CREATE POLICY "Authorized users can create investor links"
ON public.project_investidores
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_project_owner(auth.uid(), project_id)
  OR public.can_see_all_projects(auth.uid())
);

CREATE POLICY "Authorized users can delete investor links"
ON public.project_investidores
FOR DELETE
TO authenticated
USING (
  public.is_project_owner(auth.uid(), project_id)
  OR public.can_see_all_projects(auth.uid())
);