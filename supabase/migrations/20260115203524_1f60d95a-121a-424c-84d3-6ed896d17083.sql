-- Create table to store permanent admin access approvals
CREATE TABLE IF NOT EXISTS public.admin_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  granted_by UUID NOT NULL,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE, -- NULL means permanent
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id) -- One active grant per user
);

-- Enable RLS
ALTER TABLE public.admin_access_grants ENABLE ROW LEVEL SECURITY;

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

-- Create security definer function to check if user has admin access
CREATE OR REPLACE FUNCTION public.has_admin_access(check_user_id UUID)
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
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Create trigger to update updated_at
CREATE TRIGGER update_admin_access_grants_updated_at
  BEFORE UPDATE ON public.admin_access_grants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();