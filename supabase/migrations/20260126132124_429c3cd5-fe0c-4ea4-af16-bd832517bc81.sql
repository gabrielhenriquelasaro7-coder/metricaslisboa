-- Fix WhatsApp instances RLS to use can_view_project instead of user_id
-- This allows investors to see/manage WhatsApp instances for projects they have access to

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own instances" ON whatsapp_instances;
DROP POLICY IF EXISTS "Users can insert own instances" ON whatsapp_instances;
DROP POLICY IF EXISTS "Users can update own instances" ON whatsapp_instances;
DROP POLICY IF EXISTS "Users can delete own instances" ON whatsapp_instances;

-- Create new policies using can_view_project function
CREATE POLICY "Users can view project instances"
ON whatsapp_instances FOR SELECT
USING (public.can_view_project(auth.uid(), project_id));

CREATE POLICY "Users can insert project instances"
ON whatsapp_instances FOR INSERT
WITH CHECK (public.can_view_project(auth.uid(), project_id));

CREATE POLICY "Users can update project instances"
ON whatsapp_instances FOR UPDATE
USING (public.can_view_project(auth.uid(), project_id));

CREATE POLICY "Users can delete project instances"
ON whatsapp_instances FOR DELETE
USING (public.can_view_project(auth.uid(), project_id));

-- Also fix whatsapp_subscriptions RLS
DROP POLICY IF EXISTS "Users can view own subscriptions" ON whatsapp_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON whatsapp_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON whatsapp_subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON whatsapp_subscriptions;

-- Create new policies for subscriptions
CREATE POLICY "Users can view project subscriptions"
ON whatsapp_subscriptions FOR SELECT
USING (public.can_view_project(auth.uid(), project_id));

CREATE POLICY "Users can insert project subscriptions"
ON whatsapp_subscriptions FOR INSERT
WITH CHECK (public.can_view_project(auth.uid(), project_id));

CREATE POLICY "Users can update project subscriptions"
ON whatsapp_subscriptions FOR UPDATE
USING (public.can_view_project(auth.uid(), project_id));

CREATE POLICY "Users can delete project subscriptions"
ON whatsapp_subscriptions FOR DELETE
USING (public.can_view_project(auth.uid(), project_id));

-- Fix whatsapp_report_configs RLS
DROP POLICY IF EXISTS "Users can view own report configs" ON whatsapp_report_configs;
DROP POLICY IF EXISTS "Users can insert own report configs" ON whatsapp_report_configs;
DROP POLICY IF EXISTS "Users can update own report configs" ON whatsapp_report_configs;
DROP POLICY IF EXISTS "Users can delete own report configs" ON whatsapp_report_configs;

CREATE POLICY "Users can view project report configs"
ON whatsapp_report_configs FOR SELECT
USING (public.can_view_project(auth.uid(), project_id));

CREATE POLICY "Users can insert project report configs"
ON whatsapp_report_configs FOR INSERT
WITH CHECK (public.can_view_project(auth.uid(), project_id));

CREATE POLICY "Users can update project report configs"
ON whatsapp_report_configs FOR UPDATE
USING (public.can_view_project(auth.uid(), project_id));

CREATE POLICY "Users can delete project report configs"
ON whatsapp_report_configs FOR DELETE
USING (public.can_view_project(auth.uid(), project_id));

-- Fix whatsapp_planner_configs RLS
DROP POLICY IF EXISTS "Users can view own planner configs" ON whatsapp_planner_configs;
DROP POLICY IF EXISTS "Users can insert own planner configs" ON whatsapp_planner_configs;
DROP POLICY IF EXISTS "Users can update own planner configs" ON whatsapp_planner_configs;
DROP POLICY IF EXISTS "Users can delete own planner configs" ON whatsapp_planner_configs;

CREATE POLICY "Users can view project planner configs"
ON whatsapp_planner_configs FOR SELECT
USING (public.can_view_project(auth.uid(), project_id));

CREATE POLICY "Users can insert project planner configs"
ON whatsapp_planner_configs FOR INSERT
WITH CHECK (public.can_view_project(auth.uid(), project_id));

CREATE POLICY "Users can update project planner configs"
ON whatsapp_planner_configs FOR UPDATE
USING (public.can_view_project(auth.uid(), project_id));

CREATE POLICY "Users can delete project planner configs"
ON whatsapp_planner_configs FOR DELETE
USING (public.can_view_project(auth.uid(), project_id));