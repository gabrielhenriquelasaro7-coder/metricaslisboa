
-- Instagram Accounts (one per project)
CREATE TABLE public.instagram_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  ig_user_id TEXT NOT NULL,
  username TEXT,
  name TEXT,
  biography TEXT,
  profile_picture_url TEXT,
  followers_count INTEGER DEFAULT 0,
  follows_count INTEGER DEFAULT 0,
  media_count INTEGER DEFAULT 0,
  website TEXT,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

ALTER TABLE public.instagram_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view instagram_accounts for accessible projects"
  ON public.instagram_accounts FOR SELECT
  USING (can_view_project(auth.uid(), project_id));

CREATE POLICY "Service role can manage instagram_accounts"
  ON public.instagram_accounts FOR ALL
  USING (true) WITH CHECK (true);

-- Instagram Media (posts/reels/stories)
CREATE TABLE public.instagram_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  ig_media_id TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'IMAGE',
  caption TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  permalink TEXT,
  timestamp TIMESTAMP WITH TIME ZONE,
  like_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saved INTEGER DEFAULT 0,
  total_interactions INTEGER DEFAULT 0,
  plays INTEGER DEFAULT 0,
  avg_watch_time NUMERIC DEFAULT 0,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(project_id, ig_media_id)
);

ALTER TABLE public.instagram_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view instagram_media for accessible projects"
  ON public.instagram_media FOR SELECT
  USING (can_view_project(auth.uid(), project_id));

CREATE POLICY "Service role can manage instagram_media"
  ON public.instagram_media FOR ALL
  USING (true) WITH CHECK (true);

-- Instagram Insights Daily
CREATE TABLE public.instagram_insights_daily (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  reach INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  accounts_engaged INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  follows INTEGER DEFAULT 0,
  unfollows INTEGER DEFAULT 0,
  profile_views INTEGER DEFAULT 0,
  website_clicks INTEGER DEFAULT 0,
  total_interactions INTEGER DEFAULT 0,
  engaged_demographics JSONB,
  reached_demographics JSONB,
  follower_demographics JSONB,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(project_id, date)
);

ALTER TABLE public.instagram_insights_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view instagram_insights_daily for accessible projects"
  ON public.instagram_insights_daily FOR SELECT
  USING (can_view_project(auth.uid(), project_id));

CREATE POLICY "Service role can manage instagram_insights_daily"
  ON public.instagram_insights_daily FOR ALL
  USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_instagram_media_project ON public.instagram_media(project_id);
CREATE INDEX idx_instagram_media_timestamp ON public.instagram_media(timestamp DESC);
CREATE INDEX idx_instagram_insights_daily_project_date ON public.instagram_insights_daily(project_id, date DESC);
