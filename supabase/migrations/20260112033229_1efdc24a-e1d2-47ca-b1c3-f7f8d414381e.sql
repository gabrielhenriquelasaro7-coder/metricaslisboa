
-- =====================================================
-- FIX 1: profiles table - Change all policies to authenticated only
-- =====================================================
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Recreate with authenticated role only
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- FIX 2: projects table - Change all policies to authenticated only
-- =====================================================
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;

-- Recreate with authenticated role only
CREATE POLICY "Users can view their own projects" 
ON public.projects 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects" 
ON public.projects 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" 
ON public.projects 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" 
ON public.projects 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- FIX 3: demographic_insights table - Fix overly permissive policies
-- =====================================================
DROP POLICY IF EXISTS "Service role can manage demographic_insights" ON public.demographic_insights;
DROP POLICY IF EXISTS "Users can view demographic_insights for their projects" ON public.demographic_insights;

-- Recreate with authenticated role only using the helper function
CREATE POLICY "Users can view demographic_insights for their projects" 
ON public.demographic_insights 
FOR SELECT 
TO authenticated
USING (public.user_has_project_access(auth.uid(), project_id));

-- =====================================================
-- FIX 4: leads table policies already correct but ensure all use authenticated
-- =====================================================
-- Already using TO authenticated, verified in query above
