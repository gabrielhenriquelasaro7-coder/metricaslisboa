-- Remove foreign key constraints that are causing ads to fail insertion
-- when ad_sets are not fully synced (Meta limits to 500 per request)

-- Drop ads foreign key to ad_sets
ALTER TABLE public.ads DROP CONSTRAINT IF EXISTS ads_ad_set_id_fkey;

-- Drop ads foreign key to campaigns 
ALTER TABLE public.ads DROP CONSTRAINT IF EXISTS ads_campaign_id_fkey;

-- Drop ad_sets foreign key to campaigns
ALTER TABLE public.ad_sets DROP CONSTRAINT IF EXISTS ad_sets_campaign_id_fkey;