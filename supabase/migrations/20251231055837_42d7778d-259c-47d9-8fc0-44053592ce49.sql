-- Campaigns: permitir guests verem campanhas de projetos que têm acesso
CREATE POLICY "Guests can view campaigns for accessible projects"
ON public.campaigns FOR SELECT
USING (
  project_id IN (
    SELECT project_id FROM guest_project_access 
    WHERE user_id = auth.uid()
  )
);

-- Ad Sets: permitir guests verem ad_sets de projetos que têm acesso
CREATE POLICY "Guests can view ad_sets for accessible projects"
ON public.ad_sets FOR SELECT
USING (
  project_id IN (
    SELECT project_id FROM guest_project_access 
    WHERE user_id = auth.uid()
  )
);

-- Ads: permitir guests verem ads de projetos que têm acesso
CREATE POLICY "Guests can view ads for accessible projects"
ON public.ads FOR SELECT
USING (
  project_id IN (
    SELECT project_id FROM guest_project_access 
    WHERE user_id = auth.uid()
  )
);

-- Daily Metrics: permitir guests verem métricas diárias de projetos que têm acesso
CREATE POLICY "Guests can view daily metrics for accessible projects"
ON public.ads_daily_metrics FOR SELECT
USING (
  project_id IN (
    SELECT project_id FROM guest_project_access 
    WHERE user_id = auth.uid()
  )
);

-- Demographic Insights: permitir guests verem insights demográficos
CREATE POLICY "Guests can view demographic_insights for accessible projects"
ON public.demographic_insights FOR SELECT
USING (
  project_id IN (
    SELECT project_id FROM guest_project_access 
    WHERE user_id = auth.uid()
  )
);

-- Period Metrics: permitir guests verem métricas por período
CREATE POLICY "Guests can view period_metrics for accessible projects"
ON public.period_metrics FOR SELECT
USING (
  project_id IN (
    SELECT project_id FROM guest_project_access 
    WHERE user_id = auth.uid()
  )
);

-- Sync Logs: permitir guests verem logs de sync
CREATE POLICY "Guests can view sync_logs for accessible projects"
ON public.sync_logs FOR SELECT
USING (
  project_id IN (
    SELECT project_id FROM guest_project_access 
    WHERE user_id = auth.uid()
  )
);

-- Project Import Months: permitir guests verem status de importação
CREATE POLICY "Guests can view import months for accessible projects"
ON public.project_import_months FOR SELECT
USING (
  project_id IN (
    SELECT project_id FROM guest_project_access 
    WHERE user_id = auth.uid()
  )
);

-- Project Metric Config: permitir guests verem configuração de métricas
CREATE POLICY "Guests can view metric config for accessible projects"
ON public.project_metric_config FOR SELECT
USING (
  project_id IN (
    SELECT project_id FROM guest_project_access 
    WHERE user_id = auth.uid()
  )
);