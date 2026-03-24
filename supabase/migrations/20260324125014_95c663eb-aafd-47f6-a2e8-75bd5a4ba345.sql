
-- FIX 1: Google Ads tables - use can_view_project()

DROP POLICY IF EXISTS "Users can view google_campaigns for their projects" ON public.google_campaigns;
DROP POLICY IF EXISTS "Guests can view google_campaigns for accessible projects" ON public.google_campaigns;
CREATE POLICY "Anyone with project access can view google_campaigns"
  ON public.google_campaigns FOR SELECT TO authenticated
  USING (public.can_view_project(auth.uid(), project_id));

DROP POLICY IF EXISTS "Users can view google_ads for their projects" ON public.google_ads;
DROP POLICY IF EXISTS "Guests can view google_ads for accessible projects" ON public.google_ads;
CREATE POLICY "Anyone with project access can view google_ads"
  ON public.google_ads FOR SELECT TO authenticated
  USING (public.can_view_project(auth.uid(), project_id));

DROP POLICY IF EXISTS "Users can view google_ad_groups for their projects" ON public.google_ad_groups;
DROP POLICY IF EXISTS "Guests can view google_ad_groups for accessible projects" ON public.google_ad_groups;
CREATE POLICY "Anyone with project access can view google_ad_groups"
  ON public.google_ad_groups FOR SELECT TO authenticated
  USING (public.can_view_project(auth.uid(), project_id));

DROP POLICY IF EXISTS "Users can view google_ads_daily_metrics for their projects" ON public.google_ads_daily_metrics;
DROP POLICY IF EXISTS "Guests can view google_ads_daily_metrics for accessible project" ON public.google_ads_daily_metrics;
CREATE POLICY "Anyone with project access can view google_ads_daily_metrics"
  ON public.google_ads_daily_metrics FOR SELECT TO authenticated
  USING (public.can_view_project(auth.uid(), project_id));

-- FIX 2: CRM tables - add can_view_project() SELECT

DROP POLICY IF EXISTS "Users can view their own CRM connections" ON public.crm_connections;
CREATE POLICY "Users can view CRM connections for accessible projects"
  ON public.crm_connections FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id 
    OR public.can_view_project(auth.uid(), project_id)
  );

DROP POLICY IF EXISTS "Users can view pipelines via connection" ON public.crm_pipelines;
CREATE POLICY "Users can view pipelines for accessible projects"
  ON public.crm_pipelines FOR SELECT TO authenticated
  USING (
    public.can_view_project(auth.uid(), project_id)
    OR EXISTS (
      SELECT 1 FROM crm_connections
      WHERE crm_connections.id = crm_pipelines.connection_id
      AND crm_connections.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view sync logs via connection" ON public.crm_sync_logs;
CREATE POLICY "Users can view sync logs for accessible projects"
  ON public.crm_sync_logs FOR SELECT TO authenticated
  USING (
    public.can_view_project(auth.uid(), project_id)
    OR EXISTS (
      SELECT 1 FROM crm_connections
      WHERE crm_connections.id = crm_sync_logs.connection_id
      AND crm_connections.user_id = auth.uid()
    )
  );
