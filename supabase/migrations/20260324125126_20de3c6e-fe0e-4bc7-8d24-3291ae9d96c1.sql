
-- Fix project_import_months visibility for all users with project access
DROP POLICY IF EXISTS "Users can view import months for their projects" ON public.project_import_months;
DROP POLICY IF EXISTS "Guests can view import months for accessible projects" ON public.project_import_months;
CREATE POLICY "Anyone with project access can view import months"
  ON public.project_import_months FOR SELECT TO authenticated
  USING (public.can_view_project(auth.uid(), project_id));
