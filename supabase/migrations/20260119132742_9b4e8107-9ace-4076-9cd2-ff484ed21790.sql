-- Add new columns to whatsapp_planner_configs for metric_type, roas_atual, hidden_fields, and custom_message
ALTER TABLE public.whatsapp_planner_configs
ADD COLUMN IF NOT EXISTS metric_type text DEFAULT 'roi',
ADD COLUMN IF NOT EXISTS roas_atual numeric,
ADD COLUMN IF NOT EXISTS hidden_fields jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS custom_message text;