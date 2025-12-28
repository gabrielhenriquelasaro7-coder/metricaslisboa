-- Add column for high resolution creative image URL
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS creative_image_url TEXT;