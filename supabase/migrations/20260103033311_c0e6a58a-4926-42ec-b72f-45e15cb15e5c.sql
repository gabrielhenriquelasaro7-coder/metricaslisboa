-- Add balance alert configuration to whatsapp_subscriptions
ALTER TABLE public.whatsapp_subscriptions
ADD COLUMN IF NOT EXISTS balance_alert_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS balance_alert_threshold integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS last_balance_alert_at timestamp with time zone;