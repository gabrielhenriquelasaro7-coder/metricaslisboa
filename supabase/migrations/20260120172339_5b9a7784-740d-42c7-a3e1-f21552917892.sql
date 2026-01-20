
-- Corrigir políticas RLS de ads_daily_metrics para usar função unificada
DROP POLICY IF EXISTS "Users can view daily metrics for their projects" ON public.ads_daily_metrics;
DROP POLICY IF EXISTS "Guests can view daily metrics for accessible projects" ON public.ads_daily_metrics;

CREATE POLICY "Users can view daily metrics for accessible projects"
ON public.ads_daily_metrics
FOR SELECT
TO authenticated
USING (public.can_view_project(auth.uid(), project_id));

-- Corrigir políticas RLS de demographic_insights para usar função unificada
DROP POLICY IF EXISTS "Users can view demographic_insights for their projects" ON public.demographic_insights;
DROP POLICY IF EXISTS "Guests can view demographic_insights for accessible projects" ON public.demographic_insights;

CREATE POLICY "Users can view demographic_insights for accessible projects"
ON public.demographic_insights
FOR SELECT
TO authenticated
USING (public.can_view_project(auth.uid(), project_id));
