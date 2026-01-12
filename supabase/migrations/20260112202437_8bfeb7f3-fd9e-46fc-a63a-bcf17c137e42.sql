-- Add initiate_checkout_count column to ads_daily_metrics
ALTER TABLE public.ads_daily_metrics 
ADD COLUMN IF NOT EXISTS initiate_checkout_count INTEGER DEFAULT 0;