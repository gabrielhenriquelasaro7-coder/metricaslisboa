-- Add is_master column to user_roles for super admin protection
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS is_master BOOLEAN DEFAULT FALSE;

-- Set master status for the super admin email
UPDATE public.user_roles 
SET is_master = TRUE 
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'gabrielhenriquelasaro7@gmail.com'
);

-- Create function to check if user is master (can't be modified)
CREATE OR REPLACE FUNCTION public.is_master_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_master FROM public.user_roles WHERE user_id = _user_id LIMIT 1),
    FALSE
  )
$$;

-- Create policy to prevent updating master users (except by themselves)
DROP POLICY IF EXISTS "Prevent modifying master users" ON public.user_roles;
CREATE POLICY "Prevent modifying master users"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  NOT is_master OR user_id = auth.uid()
);

-- Ensure master user always has full access
DROP POLICY IF EXISTS "Master user has full access" ON public.user_roles;
CREATE POLICY "Master user has full access"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.is_master_user(auth.uid()) OR user_id = auth.uid()
);

-- Prevent deletion of master user roles
DROP POLICY IF EXISTS "Prevent deleting master users" ON public.user_roles;
CREATE POLICY "Prevent deleting master users"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  NOT is_master
);