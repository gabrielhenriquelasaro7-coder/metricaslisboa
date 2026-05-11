DROP POLICY IF EXISTS "Service role can manage ad_sets" ON public.ad_sets;
CREATE POLICY "Service role can manage ad_sets" ON public.ad_sets
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage daily metrics" ON public.ads_daily_metrics;
CREATE POLICY "Service role can manage daily metrics" ON public.ads_daily_metrics
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage cache" ON public.ai_analysis_cache;
CREATE POLICY "Service role can manage cache" ON public.ai_analysis_cache
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage anomaly_alerts" ON public.anomaly_alerts;
CREATE POLICY "Service role can manage anomaly_alerts" ON public.anomaly_alerts
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage campaigns" ON public.campaigns;
CREATE POLICY "Service role can manage campaigns" ON public.campaigns
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage google_ad_groups" ON public.google_ad_groups;
CREATE POLICY "Service role can manage google_ad_groups" ON public.google_ad_groups
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage google_ads" ON public.google_ads;
CREATE POLICY "Service role can manage google_ads" ON public.google_ads
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage google_ads_daily_metrics" ON public.google_ads_daily_metrics;
CREATE POLICY "Service role can manage google_ads_daily_metrics" ON public.google_ads_daily_metrics
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage google_campaigns" ON public.google_campaigns;
CREATE POLICY "Service role can manage google_campaigns" ON public.google_campaigns
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage instagram_accounts" ON public.instagram_accounts;
CREATE POLICY "Service role can manage instagram_accounts" ON public.instagram_accounts
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage instagram_insights_daily" ON public.instagram_insights_daily;
CREATE POLICY "Service role can manage instagram_insights_daily" ON public.instagram_insights_daily
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage instagram_media" ON public.instagram_media;
CREATE POLICY "Service role can manage instagram_media" ON public.instagram_media
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service can manage instagram stories" ON public.instagram_stories;
CREATE POLICY "Service can manage instagram stories" ON public.instagram_stories
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage leadgen_forms" ON public.leadgen_forms;
CREATE POLICY "Service role can manage leadgen_forms" ON public.leadgen_forms
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage period_metrics" ON public.period_metrics;
CREATE POLICY "Service role can manage period_metrics" ON public.period_metrics
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage import months" ON public.project_import_months;
CREATE POLICY "Service role can manage import months" ON public.project_import_months
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert logs" ON public.whatsapp_messages_log;
CREATE POLICY "Service role can insert logs" ON public.whatsapp_messages_log
  AS PERMISSIVE FOR INSERT TO service_role WITH CHECK (true);

REVOKE EXECUTE ON FUNCTION public.can_see_all_projects(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_see_all_projects(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.can_view_project(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_project(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_user_cargo(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_cargo(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_user_squad_ids(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_squad_ids(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_admin_access(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_admin_access(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_cargo(uuid, public.user_cargo_v2) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_cargo(uuid, public.user_cargo_v2) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_project_admin_access(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_project_admin_access(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_master_user(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_master_user(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_project_owner(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_project_owner(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.needs_password_change(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.needs_password_change(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.user_has_project_access(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_project_access(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.trigger_whatsapp_weekly_reports() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.trigger_whatsapp_weekly_reports() TO service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM anon, authenticated, PUBLIC;