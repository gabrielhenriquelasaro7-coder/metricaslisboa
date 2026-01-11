-- Drop existing SELECT policies on campaigns that allow anonymous access
DROP POLICY IF EXISTS "Users can view campaigns for their projects" ON public.campaigns;
DROP POLICY IF EXISTS "Guests can view campaigns for accessible projects" ON public.campaigns;

-- Create new restrictive SELECT policies that require authentication
CREATE POLICY "Users can view campaigns for their projects" 
ON public.campaigns 
FOR SELECT 
TO authenticated
USING (project_id IN ( SELECT projects.id FROM projects WHERE projects.user_id = auth.uid()));

CREATE POLICY "Guests can view campaigns for accessible projects" 
ON public.campaigns 
FOR SELECT 
TO authenticated
USING (project_id IN ( SELECT guest_project_access.project_id FROM guest_project_access WHERE guest_project_access.user_id = auth.uid()));