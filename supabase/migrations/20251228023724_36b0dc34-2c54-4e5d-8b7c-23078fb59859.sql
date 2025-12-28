-- Add video URL column to ads table for video creatives
ALTER TABLE public.ads 
ADD COLUMN IF NOT EXISTS creative_video_url TEXT;