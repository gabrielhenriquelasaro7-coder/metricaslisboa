-- Add missing metric columns to whatsapp_subscriptions
ALTER TABLE public.whatsapp_subscriptions
ADD COLUMN IF NOT EXISTS include_reach boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS include_cpm boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS include_cpc boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS include_conversions boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS include_conversion_value boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS include_frequency boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS report_period text DEFAULT 'last_7_days';