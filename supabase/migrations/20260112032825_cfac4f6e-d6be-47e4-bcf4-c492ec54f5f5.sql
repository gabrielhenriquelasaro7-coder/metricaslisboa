-- Create a security definer function to check if user has access to a project
-- (either as owner or as guest)
CREATE OR REPLACE FUNCTION public.user_has_project_access(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- User owns the project
    SELECT 1 FROM public.projects 
    WHERE id = _project_id AND user_id = _user_id
  ) OR EXISTS (
    -- User has guest access to the project
    SELECT 1 FROM public.guest_project_access 
    WHERE project_id = _project_id AND user_id = _user_id
  )
$$;

-- Drop existing leads policies and create improved ones
DROP POLICY IF EXISTS "Users can view leads for their projects" ON public.leads;
DROP POLICY IF EXISTS "Users can insert leads for their projects" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads for their projects" ON public.leads;
DROP POLICY IF EXISTS "Users can delete leads for their projects" ON public.leads;

-- Leads: Select policy - owners and guests can view
CREATE POLICY "Users can view leads for their projects" 
ON public.leads 
FOR SELECT 
TO authenticated
USING (public.user_has_project_access(auth.uid(), project_id));

-- Leads: Insert policy - only owners can insert
CREATE POLICY "Users can insert leads for their projects" 
ON public.leads 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = project_id AND user_id = auth.uid()
  )
);

-- Leads: Update policy - only owners can update
CREATE POLICY "Users can update leads for their projects" 
ON public.leads 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = project_id AND user_id = auth.uid()
  )
);

-- Leads: Delete policy - only owners can delete
CREATE POLICY "Users can delete leads for their projects" 
ON public.leads 
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = project_id AND user_id = auth.uid()
  )
);

-- Drop existing crm_deals policies and create improved ones
DROP POLICY IF EXISTS "Users can manage deals via connection" ON public.crm_deals;
DROP POLICY IF EXISTS "Users can view deals via connection" ON public.crm_deals;

-- CRM Deals: Select policy - owners and guests can view
CREATE POLICY "Users can view crm deals for their projects" 
ON public.crm_deals 
FOR SELECT 
TO authenticated
USING (public.user_has_project_access(auth.uid(), project_id));

-- CRM Deals: Insert policy - only owners can insert
CREATE POLICY "Users can insert crm deals for their projects" 
ON public.crm_deals 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = project_id AND user_id = auth.uid()
  )
);

-- CRM Deals: Update policy - only owners can update
CREATE POLICY "Users can update crm deals for their projects" 
ON public.crm_deals 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = project_id AND user_id = auth.uid()
  )
);

-- CRM Deals: Delete policy - only owners can delete
CREATE POLICY "Users can delete crm deals for their projects" 
ON public.crm_deals 
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = project_id AND user_id = auth.uid()
  )
);