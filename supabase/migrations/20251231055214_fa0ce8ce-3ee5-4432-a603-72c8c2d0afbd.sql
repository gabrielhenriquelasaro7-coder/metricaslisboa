-- Add RLS policy to allow guests to view projects they have access to
CREATE POLICY "Guests can view projects they have access to"
ON public.projects
FOR SELECT
USING (
  id IN (
    SELECT project_id 
    FROM public.guest_project_access 
    WHERE user_id = auth.uid()
  )
);
