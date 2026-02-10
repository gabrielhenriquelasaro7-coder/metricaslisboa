
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view optimization_history for their projects" ON public.optimization_history;
DROP POLICY IF EXISTS "Guests can view optimization_history for accessible projects" ON public.optimization_history;

-- Create unified policy using can_view_project function
CREATE POLICY "Users can view optimization_history via can_view_project"
ON public.optimization_history
FOR SELECT
USING (public.can_view_project(auth.uid(), project_id));
