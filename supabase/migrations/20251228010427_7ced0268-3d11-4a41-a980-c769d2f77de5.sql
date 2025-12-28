-- Create campaigns table to store synced Meta Ads campaigns
CREATE TABLE public.campaigns (
  id TEXT NOT NULL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  objective TEXT,
  status TEXT DEFAULT 'UNKNOWN',
  daily_budget DECIMAL(12,2),
  lifetime_budget DECIMAL(12,2),
  spend DECIMAL(12,2) DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  ctr DECIMAL(5,2) DEFAULT 0,
  cpm DECIMAL(10,2) DEFAULT 0,
  cpc DECIMAL(10,2) DEFAULT 0,
  reach BIGINT DEFAULT 0,
  frequency DECIMAL(5,2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_value DECIMAL(12,2) DEFAULT 0,
  roas DECIMAL(8,2) DEFAULT 0,
  cpa DECIMAL(10,2) DEFAULT 0,
  created_time TIMESTAMP WITH TIME ZONE,
  updated_time TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create ad_sets table
CREATE TABLE public.ad_sets (
  id TEXT NOT NULL PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'UNKNOWN',
  daily_budget DECIMAL(12,2),
  lifetime_budget DECIMAL(12,2),
  targeting JSONB,
  spend DECIMAL(12,2) DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  ctr DECIMAL(5,2) DEFAULT 0,
  cpm DECIMAL(10,2) DEFAULT 0,
  cpc DECIMAL(10,2) DEFAULT 0,
  reach BIGINT DEFAULT 0,
  frequency DECIMAL(5,2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_value DECIMAL(12,2) DEFAULT 0,
  roas DECIMAL(8,2) DEFAULT 0,
  cpa DECIMAL(10,2) DEFAULT 0,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create ads table
CREATE TABLE public.ads (
  id TEXT NOT NULL PRIMARY KEY,
  ad_set_id TEXT NOT NULL REFERENCES public.ad_sets(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'UNKNOWN',
  creative_id TEXT,
  creative_thumbnail TEXT,
  headline TEXT,
  primary_text TEXT,
  cta TEXT,
  spend DECIMAL(12,2) DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  ctr DECIMAL(5,2) DEFAULT 0,
  cpm DECIMAL(10,2) DEFAULT 0,
  cpc DECIMAL(10,2) DEFAULT 0,
  reach BIGINT DEFAULT 0,
  frequency DECIMAL(5,2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_value DECIMAL(12,2) DEFAULT 0,
  roas DECIMAL(8,2) DEFAULT 0,
  cpa DECIMAL(10,2) DEFAULT 0,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for campaigns
CREATE POLICY "Users can view campaigns for their projects"
ON public.campaigns FOR SELECT
USING (
  project_id IN (
    SELECT id FROM public.projects WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage campaigns"
ON public.campaigns FOR ALL
USING (true)
WITH CHECK (true);

-- RLS Policies for ad_sets
CREATE POLICY "Users can view ad_sets for their projects"
ON public.ad_sets FOR SELECT
USING (
  project_id IN (
    SELECT id FROM public.projects WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage ad_sets"
ON public.ad_sets FOR ALL
USING (true)
WITH CHECK (true);

-- RLS Policies for ads
CREATE POLICY "Users can view ads for their projects"
ON public.ads FOR SELECT
USING (
  project_id IN (
    SELECT id FROM public.projects WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage ads"
ON public.ads FOR ALL
USING (true)
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_campaigns_project_id ON public.campaigns(project_id);
CREATE INDEX idx_ad_sets_campaign_id ON public.ad_sets(campaign_id);
CREATE INDEX idx_ad_sets_project_id ON public.ad_sets(project_id);
CREATE INDEX idx_ads_ad_set_id ON public.ads(ad_set_id);
CREATE INDEX idx_ads_campaign_id ON public.ads(campaign_id);
CREATE INDEX idx_ads_project_id ON public.ads(project_id);