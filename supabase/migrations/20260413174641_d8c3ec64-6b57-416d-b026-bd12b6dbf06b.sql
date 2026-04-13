
-- Fix diagnostic_reports SELECT policy: users should see their own reports OR project-accessible ones
DROP POLICY IF EXISTS "Users can view diagnostic reports for their projects" ON public.diagnostic_reports;

CREATE POLICY "Users can view diagnostic reports"
  ON public.diagnostic_reports
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR can_view_project(auth.uid(), project_id)
  );
