
-- Create table for Google Ads keywords
CREATE TABLE public.google_keywords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT,
  ad_group_id TEXT NOT NULL,
  ad_group_name TEXT,
  keyword_text TEXT NOT NULL,
  match_type TEXT,
  status TEXT,
  quality_score INTEGER,
  expected_ctr TEXT,
  ad_relevance TEXT,
  landing_page_experience TEXT,
  spend NUMERIC DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions NUMERIC DEFAULT 0,
  conversion_value NUMERIC DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  cpc NUMERIC DEFAULT 0,
  cpm NUMERIC DEFAULT 0,
  cost_per_conversion NUMERIC DEFAULT 0,
  search_impression_share NUMERIC,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create table for Google demographic insights
CREATE TABLE public.google_demographic_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  breakdown_type TEXT NOT NULL, -- 'age', 'gender', 'device'
  breakdown_value TEXT NOT NULL,
  spend NUMERIC DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions NUMERIC DEFAULT 0,
  conversion_value NUMERIC DEFAULT 0,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.google_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_demographic_insights ENABLE ROW LEVEL SECURITY;

-- RLS policies for google_keywords
CREATE POLICY "Users can view google keywords for their projects"
ON public.google_keywords FOR SELECT
USING (public.can_view_project(auth.uid(), project_id));

-- RLS policies for google_demographic_insights
CREATE POLICY "Users can view google demographic insights for their projects"
ON public.google_demographic_insights FOR SELECT
USING (public.can_view_project(auth.uid(), project_id));

-- Create indexes
CREATE INDEX idx_google_keywords_project ON public.google_keywords(project_id);
CREATE INDEX idx_google_keywords_campaign ON public.google_keywords(project_id, campaign_id);
CREATE INDEX idx_google_demographic_project_date ON public.google_demographic_insights(project_id, date);

-- Add unique constraint for upsert
CREATE UNIQUE INDEX idx_google_keywords_unique ON public.google_keywords(project_id, ad_group_id, keyword_text, match_type);
CREATE UNIQUE INDEX idx_google_demographic_unique ON public.google_demographic_insights(project_id, date, breakdown_type, breakdown_value);
