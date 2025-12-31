-- Fix: Change guest RLS policies from RESTRICTIVE to PERMISSIVE
-- The issue is that RESTRICTIVE policies require ALL to pass, 
-- while PERMISSIVE policies need only ONE to pass (which is what we want)

-- Drop restrictive policies and recreate as permissive

-- PROJECTS
DROP POLICY IF EXISTS "Guests can view projects they have access to" ON public.projects;
CREATE POLICY "Guests can view projects they have access to" 
ON public.projects 
FOR SELECT 
TO authenticated
USING (
  id IN (
    SELECT project_id FROM guest_project_access 
    WHERE user_id = auth.uid()
  )
);

-- CAMPAIGNS
DROP POLICY IF EXISTS "Guests can view campaigns for accessible projects" ON public.campaigns;
CREATE POLICY "Guests can view campaigns for accessible projects" 
ON public.campaigns 
FOR SELECT 
TO authenticated
USING (
  project_id IN (
    SELECT project_id FROM guest_project_access 
    WHERE user_id = auth.uid()
  )
);

-- AD_SETS
DROP POLICY IF EXISTS "Guests can view ad_sets for accessible projects" ON public.ad_sets;
CREATE POLICY "Guests can view ad_sets for accessible projects" 
ON public.ad_sets 
FOR SELECT 
TO authenticated
USING (
  project_id IN (
    SELECT project_id FROM guest_project_access 
    WHERE user_id = auth.uid()
  )
);

-- ADS
DROP POLICY IF EXISTS "Guests can view ads for accessible projects" ON public.ads;
CREATE POLICY "Guests can view ads for accessible projects" 
ON public.ads 
FOR SELECT 
TO authenticated
USING (
  project_id IN (
    SELECT project_id FROM guest_project_access 
    WHERE user_id = auth.uid()
  )
);

-- ADS_DAILY_METRICS
DROP POLICY IF EXISTS "Guests can view daily metrics for accessible projects" ON public.ads_daily_metrics;
CREATE POLICY "Guests can view daily metrics for accessible projects" 
ON public.ads_daily_metrics 
FOR SELECT 
TO authenticated
USING (
  project_id IN (
    SELECT project_id FROM guest_project_access 
    WHERE user_id = auth.uid()
  )
);

-- DEMOGRAPHIC_INSIGHTS
DROP POLICY IF EXISTS "Guests can view demographic_insights for accessible projects" ON public.demographic_insights;
CREATE POLICY "Guests can view demographic_insights for accessible projects" 
ON public.demographic_insights 
FOR SELECT 
TO authenticated
USING (
  project_id IN (
    SELECT project_id FROM guest_project_access 
    WHERE user_id = auth.uid()
  )
);

-- PERIOD_METRICS
DROP POLICY IF EXISTS "Guests can view period_metrics for accessible projects" ON public.period_metrics;
CREATE POLICY "Guests can view period_metrics for accessible projects" 
ON public.period_metrics 
FOR SELECT 
TO authenticated
USING (
  project_id IN (
    SELECT project_id FROM guest_project_access 
    WHERE user_id = auth.uid()
  )
);

-- SYNC_LOGS
DROP POLICY IF EXISTS "Guests can view sync_logs for accessible projects" ON public.sync_logs;
CREATE POLICY "Guests can view sync_logs for accessible projects" 
ON public.sync_logs 
FOR SELECT 
TO authenticated
USING (
  project_id IN (
    SELECT project_id FROM guest_project_access 
    WHERE user_id = auth.uid()
  )
);

-- PROJECT_IMPORT_MONTHS
DROP POLICY IF EXISTS "Guests can view import months for accessible projects" ON public.project_import_months;
CREATE POLICY "Guests can view import months for accessible projects" 
ON public.project_import_months 
FOR SELECT 
TO authenticated
USING (
  project_id IN (
    SELECT project_id FROM guest_project_access 
    WHERE user_id = auth.uid()
  )
);

-- PROJECT_METRIC_CONFIG
DROP POLICY IF EXISTS "Guests can view metric config for accessible projects" ON public.project_metric_config;
CREATE POLICY "Guests can view metric config for accessible projects" 
ON public.project_metric_config 
FOR SELECT 
TO authenticated
USING (
  project_id IN (
    SELECT project_id FROM guest_project_access 
    WHERE user_id = auth.uid()
  )
);