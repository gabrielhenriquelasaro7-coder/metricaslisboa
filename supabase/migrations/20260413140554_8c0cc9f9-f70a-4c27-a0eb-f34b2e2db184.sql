-- 1. Enable RLS on user_roles (was disabled)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Drop the overly permissive SELECT policy on user_roles
DROP POLICY IF EXISTS "user_roles_select_all" ON public.user_roles;

-- 3. Add a policy so users can read their own role
CREATE POLICY "Users can view own role"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 4. Fix optimization_history: drop the public ALL policy and replace with service_role scoped
DROP POLICY IF EXISTS "Service role can manage optimization_history" ON public.optimization_history;

-- Re-create the policy scoped to service_role only (not public)
CREATE POLICY "Service role can manage optimization_history"
  ON public.optimization_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Fix crm_connections SELECT: restrict to owner only (remove can_view_project access to credentials)
DROP POLICY IF EXISTS "Users can view CRM connections for accessible projects" ON public.crm_connections;

CREATE POLICY "Users can view own CRM connections"
  ON public.crm_connections
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
