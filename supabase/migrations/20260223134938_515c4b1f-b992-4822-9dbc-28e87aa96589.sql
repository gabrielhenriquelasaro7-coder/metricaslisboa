
-- Table for scheduled/published Instagram posts
CREATE TABLE public.instagram_scheduled_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  caption TEXT,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'IMAGE',
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  ig_media_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.instagram_scheduled_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their project posts"
  ON public.instagram_scheduled_posts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create posts"
  ON public.instagram_scheduled_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their posts"
  ON public.instagram_scheduled_posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their posts"
  ON public.instagram_scheduled_posts FOR DELETE
  USING (auth.uid() = user_id);
