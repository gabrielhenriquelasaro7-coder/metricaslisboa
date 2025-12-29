-- Tabela de métricas diárias por anúncio (1 linha por ad por dia)
-- Fonte única de verdade para todos os cálculos de período

CREATE TABLE IF NOT EXISTS public.ads_daily_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  ad_account_id text NOT NULL,
  date date NOT NULL,
  
  -- Entity IDs
  campaign_id text NOT NULL,
  campaign_name text NOT NULL,
  campaign_status text,
  campaign_objective text,
  
  adset_id text NOT NULL,
  adset_name text NOT NULL,
  adset_status text,
  
  ad_id text NOT NULL,
  ad_name text NOT NULL,
  ad_status text,
  
  -- Creative info
  creative_id text,
  creative_thumbnail text,
  
  -- Daily metrics
  spend numeric NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  reach bigint NOT NULL DEFAULT 0,
  frequency numeric DEFAULT 0,
  
  -- Calculated metrics (stored for performance)
  ctr numeric DEFAULT 0,
  cpm numeric DEFAULT 0,
  cpc numeric DEFAULT 0,
  
  -- Conversions
  conversions integer DEFAULT 0,
  conversion_value numeric DEFAULT 0,
  roas numeric DEFAULT 0,
  cpa numeric DEFAULT 0,
  
  -- Metadata
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- UNIQUE constraint: 1 linha por ad por dia
  CONSTRAINT ads_daily_metrics_unique UNIQUE (project_id, ad_id, date)
);

-- Enable RLS
ALTER TABLE public.ads_daily_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own project's metrics
CREATE POLICY "Users can view daily metrics for their projects" 
ON public.ads_daily_metrics 
FOR SELECT 
USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Policy: Service role can manage all metrics
CREATE POLICY "Service role can manage daily metrics" 
ON public.ads_daily_metrics 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Index for fast period queries
CREATE INDEX idx_ads_daily_metrics_project_date 
ON public.ads_daily_metrics (project_id, date DESC);

CREATE INDEX idx_ads_daily_metrics_campaign_date 
ON public.ads_daily_metrics (project_id, campaign_id, date DESC);

CREATE INDEX idx_ads_daily_metrics_adset_date 
ON public.ads_daily_metrics (project_id, adset_id, date DESC);

CREATE INDEX idx_ads_daily_metrics_ad_date 
ON public.ads_daily_metrics (project_id, ad_id, date DESC);

-- Index for date range queries
CREATE INDEX idx_ads_daily_metrics_date_range 
ON public.ads_daily_metrics (project_id, date);