-- Add messaging_replies column to track message conversions for Inside Sales campaigns
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS messaging_replies integer DEFAULT 0;
ALTER TABLE public.ad_sets ADD COLUMN IF NOT EXISTS messaging_replies integer DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS messaging_replies integer DEFAULT 0;

-- Add to daily metrics as well
ALTER TABLE public.ads_daily_metrics ADD COLUMN IF NOT EXISTS messaging_replies integer DEFAULT 0;