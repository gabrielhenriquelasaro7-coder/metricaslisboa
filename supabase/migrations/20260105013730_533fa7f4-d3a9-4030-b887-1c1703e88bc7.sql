-- Add profile_visits column to ads_daily_metrics for Instagram traffic campaigns
ALTER TABLE public.ads_daily_metrics ADD COLUMN IF NOT EXISTS profile_visits INTEGER DEFAULT 0;

-- Add profile_visits column to ads table
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS profile_visits INTEGER DEFAULT 0;

-- Add profile_visits column to ad_sets table
ALTER TABLE public.ad_sets ADD COLUMN IF NOT EXISTS profile_visits INTEGER DEFAULT 0;

-- Add profile_visits column to campaigns table
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS profile_visits INTEGER DEFAULT 0;

-- Add admin_notification_email to system_settings if not exists
INSERT INTO public.system_settings (key, value)
VALUES ('admin_notification_email', '')
ON CONFLICT (key) DO NOTHING;

-- Add token_expiry_notified_at to track when we last notified about token expiry
INSERT INTO public.system_settings (key, value)
VALUES ('token_expiry_notified_at', '')
ON CONFLICT (key) DO NOTHING;