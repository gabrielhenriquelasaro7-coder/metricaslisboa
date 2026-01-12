-- Fix ads table: Add TO authenticated to all policies
DROP POLICY IF EXISTS "Service role can manage ads" ON public.ads;
DROP POLICY IF EXISTS "Users can view ads for their projects" ON public.ads;
DROP POLICY IF EXISTS "Guests can view ads for accessible projects" ON public.ads;

-- Recreate policies with proper restrictions
CREATE POLICY "Users can view ads for their projects" 
ON public.ads 
FOR SELECT 
TO authenticated
USING (public.user_has_project_access(auth.uid(), project_id));

-- Fix user_roles table: Remove overly permissive policies
DROP POLICY IF EXISTS "Service role can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins and gestors can view all roles" ON public.user_roles;

-- Recreate user_roles policies with proper restrictions
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles" 
ON public.user_roles 
FOR INSERT 
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles" 
ON public.user_roles 
FOR UPDATE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles" 
ON public.user_roles 
FOR DELETE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Fix whatsapp_manager_instances table
DROP POLICY IF EXISTS "Service role can manage instances" ON public.whatsapp_manager_instances;
DROP POLICY IF EXISTS "Users can view own instances" ON public.whatsapp_manager_instances;
DROP POLICY IF EXISTS "Users can create own instances" ON public.whatsapp_manager_instances;
DROP POLICY IF EXISTS "Users can update own instances" ON public.whatsapp_manager_instances;
DROP POLICY IF EXISTS "Users can delete own instances" ON public.whatsapp_manager_instances;

-- Recreate whatsapp_manager_instances policies with proper restrictions
CREATE POLICY "Users can view own whatsapp manager instances" 
ON public.whatsapp_manager_instances 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own whatsapp manager instances" 
ON public.whatsapp_manager_instances 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own whatsapp manager instances" 
ON public.whatsapp_manager_instances 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own whatsapp manager instances" 
ON public.whatsapp_manager_instances 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Fix whatsapp_report_configs table
DROP POLICY IF EXISTS "Service role can manage configs" ON public.whatsapp_report_configs;
DROP POLICY IF EXISTS "Users can view own configs" ON public.whatsapp_report_configs;
DROP POLICY IF EXISTS "Users can create own configs" ON public.whatsapp_report_configs;
DROP POLICY IF EXISTS "Users can update own configs" ON public.whatsapp_report_configs;
DROP POLICY IF EXISTS "Users can delete own configs" ON public.whatsapp_report_configs;

-- Recreate whatsapp_report_configs policies with proper restrictions
CREATE POLICY "Users can view own whatsapp report configs" 
ON public.whatsapp_report_configs 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own whatsapp report configs" 
ON public.whatsapp_report_configs 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own whatsapp report configs" 
ON public.whatsapp_report_configs 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own whatsapp report configs" 
ON public.whatsapp_report_configs 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);