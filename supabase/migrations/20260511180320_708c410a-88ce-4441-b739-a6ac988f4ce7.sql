
-- 1) Enable RLS on squad_members and replace permissive policy
ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS squad_members_select_all ON public.squad_members;

CREATE POLICY "Tech and Gerente can view all squad members"
  ON public.squad_members FOR SELECT
  TO authenticated
  USING (public.can_see_all_projects(auth.uid()));

CREATE POLICY "Members can view their own squad members"
  ON public.squad_members FOR SELECT
  TO authenticated
  USING (
    squad_id = ANY (public.get_user_squad_ids(auth.uid()))
  );

CREATE POLICY "Tech and Gerente can insert squad members"
  ON public.squad_members FOR INSERT
  TO authenticated
  WITH CHECK (public.can_see_all_projects(auth.uid()));

CREATE POLICY "Tech and Gerente can update squad members"
  ON public.squad_members FOR UPDATE
  TO authenticated
  USING (public.can_see_all_projects(auth.uid()))
  WITH CHECK (public.can_see_all_projects(auth.uid()));

CREATE POLICY "Tech and Gerente can delete squad members"
  ON public.squad_members FOR DELETE
  TO authenticated
  USING (public.can_see_all_projects(auth.uid()));
