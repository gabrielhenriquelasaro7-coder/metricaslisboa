-- Create google_campaigns table
CREATE TABLE public.google_campaigns (
  id TEXT NOT NULL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'UNKNOWN',
  campaign_type TEXT,
  bidding_strategy TEXT,
  budget_amount NUMERIC DEFAULT 0,
  budget_type TEXT,
  start_date DATE,
  end_date DATE,
  spend NUMERIC DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_value NUMERIC DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  cpc NUMERIC DEFAULT 0,
  cpm NUMERIC DEFAULT 0,
  cost_per_conversion NUMERIC DEFAULT 0,
  roas NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create google_ad_groups table
CREATE TABLE public.google_ad_groups (
  id TEXT NOT NULL PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'UNKNOWN',
  cpc_bid NUMERIC,
  spend NUMERIC DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_value NUMERIC DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  cpc NUMERIC DEFAULT 0,
  cpm NUMERIC DEFAULT 0,
  cost_per_conversion NUMERIC DEFAULT 0,
  roas NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create google_ads table
CREATE TABLE public.google_ads (
  id TEXT NOT NULL PRIMARY KEY,
  ad_group_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'UNKNOWN',
  ad_type TEXT,
  final_urls TEXT[],
  headlines TEXT[],
  descriptions TEXT[],
  spend NUMERIC DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_value NUMERIC DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  cpc NUMERIC DEFAULT 0,
  cpm NUMERIC DEFAULT 0,
  cost_per_conversion NUMERIC DEFAULT 0,
  roas NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create google_ads_daily_metrics table
CREATE TABLE public.google_ads_daily_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  customer_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  campaign_status TEXT,
  campaign_type TEXT,
  ad_group_id TEXT NOT NULL,
  ad_group_name TEXT NOT NULL,
  ad_group_status TEXT,
  ad_id TEXT NOT NULL,
  ad_name TEXT NOT NULL,
  ad_status TEXT,
  spend NUMERIC NOT NULL DEFAULT 0,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_value NUMERIC DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  cpc NUMERIC DEFAULT 0,
  cpm NUMERIC DEFAULT 0,
  cost_per_conversion NUMERIC DEFAULT 0,
  roas NUMERIC DEFAULT 0,
  search_impression_share NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, date, ad_id)
);

-- Add ad_platform column to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS google_customer_id TEXT;

-- Enable RLS on all new tables
ALTER TABLE public.google_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_ad_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_ads_daily_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for google_campaigns
CREATE POLICY "Users can view google_campaigns for their projects"
ON public.google_campaigns FOR SELECT
USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Guests can view google_campaigns for accessible projects"
ON public.google_campaigns FOR SELECT
USING (project_id IN (SELECT project_id FROM guest_project_access WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage google_campaigns"
ON public.google_campaigns FOR ALL
USING (true) WITH CHECK (true);

-- RLS Policies for google_ad_groups
CREATE POLICY "Users can view google_ad_groups for their projects"
ON public.google_ad_groups FOR SELECT
USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Guests can view google_ad_groups for accessible projects"
ON public.google_ad_groups FOR SELECT
USING (project_id IN (SELECT project_id FROM guest_project_access WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage google_ad_groups"
ON public.google_ad_groups FOR ALL
USING (true) WITH CHECK (true);

-- RLS Policies for google_ads
CREATE POLICY "Users can view google_ads for their projects"
ON public.google_ads FOR SELECT
USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Guests can view google_ads for accessible projects"
ON public.google_ads FOR SELECT
USING (project_id IN (SELECT project_id FROM guest_project_access WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage google_ads"
ON public.google_ads FOR ALL
USING (true) WITH CHECK (true);

-- RLS Policies for google_ads_daily_metrics
CREATE POLICY "Users can view google_ads_daily_metrics for their projects"
ON public.google_ads_daily_metrics FOR SELECT
USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Guests can view google_ads_daily_metrics for accessible projects"
ON public.google_ads_daily_metrics FOR SELECT
USING (project_id IN (SELECT project_id FROM guest_project_access WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage google_ads_daily_metrics"
ON public.google_ads_daily_metrics FOR ALL
USING (true) WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_google_campaigns_project_id ON public.google_campaigns(project_id);
CREATE INDEX idx_google_ad_groups_project_id ON public.google_ad_groups(project_id);
CREATE INDEX idx_google_ad_groups_campaign_id ON public.google_ad_groups(campaign_id);
CREATE INDEX idx_google_ads_project_id ON public.google_ads(project_id);
CREATE INDEX idx_google_ads_campaign_id ON public.google_ads(campaign_id);
CREATE INDEX idx_google_ads_ad_group_id ON public.google_ads(ad_group_id);
CREATE INDEX idx_google_ads_daily_metrics_project_date ON public.google_ads_daily_metrics(project_id, date);
CREATE INDEX idx_google_ads_daily_metrics_campaign_id ON public.google_ads_daily_metrics(campaign_id);
CREATE INDEX idx_google_ads_daily_metrics_ad_group_id ON public.google_ads_daily_metrics(ad_group_id);