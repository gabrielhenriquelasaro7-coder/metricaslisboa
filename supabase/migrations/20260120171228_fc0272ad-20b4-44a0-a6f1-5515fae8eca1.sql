
-- Update ads RLS policy to use can_view_project function 
DROP POLICY IF EXISTS "Users can view ads for their projects" ON public.ads;

CREATE POLICY "Users can view ads for accessible projects"
ON public.ads
FOR SELECT
TO authenticated
USING (public.can_view_project(auth.uid(), project_id));

-- Update ad_sets RLS policies to be consistent
DROP POLICY IF EXISTS "Guests can view ad_sets for accessible projects" ON public.ad_sets;
DROP POLICY IF EXISTS "Users can view ad_sets for their projects" ON public.ad_sets;

CREATE POLICY "Users can view ad_sets for accessible projects"
ON public.ad_sets
FOR SELECT
TO authenticated
USING (public.can_view_project(auth.uid(), project_id));

-- Update campaigns RLS policies  
DROP POLICY IF EXISTS "Guests can view campaigns for accessible projects" ON public.campaigns;
DROP POLICY IF EXISTS "Users can view campaigns for their projects" ON public.campaigns;

CREATE POLICY "Users can view campaigns for accessible projects"
ON public.campaigns
FOR SELECT
TO authenticated
USING (public.can_view_project(auth.uid(), project_id));
