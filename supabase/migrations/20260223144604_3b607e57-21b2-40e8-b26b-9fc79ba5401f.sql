
-- Stories table
CREATE TABLE IF NOT EXISTS public.instagram_stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  ig_story_id TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'IMAGE',
  media_url TEXT,
  thumbnail_url TEXT,
  timestamp TIMESTAMPTZ,
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  taps_forward INTEGER DEFAULT 0,
  taps_back INTEGER DEFAULT 0,
  exits INTEGER DEFAULT 0,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, ig_story_id)
);

ALTER TABLE public.instagram_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view instagram stories for their projects"
  ON public.instagram_stories FOR SELECT
  USING (public.user_has_project_access(auth.uid(), project_id));

CREATE POLICY "Service can manage instagram stories"
  ON public.instagram_stories FOR ALL
  USING (true) WITH CHECK (true);
