-- Add project_id and grant_date columns
ALTER TABLE public.admin_access_grants 
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS grant_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Drop revoked columns (not needed for daily grants)
ALTER TABLE public.admin_access_grants 
  DROP COLUMN IF EXISTS revoked_at,
  DROP COLUMN IF EXISTS revoked_by,
  DROP COLUMN IF EXISTS updated_at;

-- Update expires_at default to 12 hours
ALTER TABLE public.admin_access_grants 
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '12 hours');

-- Create unique index for one grant per user per project per day
DROP INDEX IF EXISTS admin_access_grants_user_project_day_idx;
CREATE UNIQUE INDEX admin_access_grants_user_project_day_idx 
  ON public.admin_access_grants (user_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid), grant_date);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own admin grants" ON public.admin_access_grants;
DROP POLICY IF EXISTS "Tech users can manage admin grants" ON public.admin_access_grants;

-- Policy: Users can see their own grants
CREATE POLICY "Users can view their own admin grants"
  ON public.admin_access_grants
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Tech users can manage all grants
CREATE POLICY "Tech users can manage admin grants"
  ON public.admin_access_grants
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND cargo = 'tech'
    )
  );

-- Create security definer function to check if user has admin access for a project
CREATE OR REPLACE FUNCTION public.has_project_admin_access(check_user_id UUID, check_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_access_grants
    WHERE user_id = check_user_id
      AND (project_id = check_project_id OR project_id IS NULL)
      AND expires_at > now()
  )
$$;