-- Drop existing SELECT policies on leads that allow anonymous access
DROP POLICY IF EXISTS "Users can view leads for their projects" ON public.leads;
DROP POLICY IF EXISTS "Guests can view leads for accessible projects" ON public.leads;
DROP POLICY IF EXISTS "Service role can manage leads" ON public.leads;

-- Create new restrictive SELECT policies that require authentication
CREATE POLICY "Users can view leads for their projects" 
ON public.leads 
FOR SELECT 
TO authenticated
USING (project_id IN (SELECT projects.id FROM projects WHERE projects.user_id = auth.uid()));

CREATE POLICY "Guests can view leads for accessible projects" 
ON public.leads 
FOR SELECT 
TO authenticated
USING (project_id IN (SELECT guest_project_access.project_id FROM guest_project_access WHERE guest_project_access.user_id = auth.uid()));

-- Create INSERT policy for authenticated users only
CREATE POLICY "Users can insert leads for their projects" 
ON public.leads 
FOR INSERT 
TO authenticated
WITH CHECK (project_id IN (SELECT projects.id FROM projects WHERE projects.user_id = auth.uid()));

-- Create UPDATE policy for authenticated users only
CREATE POLICY "Users can update leads for their projects" 
ON public.leads 
FOR UPDATE 
TO authenticated
USING (project_id IN (SELECT projects.id FROM projects WHERE projects.user_id = auth.uid()));

-- Create DELETE policy for authenticated users only
CREATE POLICY "Users can delete leads for their projects" 
ON public.leads 
FOR DELETE 
TO authenticated
USING (project_id IN (SELECT projects.id FROM projects WHERE projects.user_id = auth.uid()));