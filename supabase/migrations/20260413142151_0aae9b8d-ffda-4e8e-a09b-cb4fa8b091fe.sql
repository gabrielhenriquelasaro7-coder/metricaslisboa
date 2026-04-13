-- Fix: CRM connections should be viewable by all project members, not just the creator
DROP POLICY IF EXISTS "Users can view own CRM connections" ON public.crm_connections;

CREATE POLICY "Users can view CRM connections for accessible projects"
  ON public.crm_connections
  FOR SELECT
  TO authenticated
  USING (can_view_project(auth.uid(), project_id));