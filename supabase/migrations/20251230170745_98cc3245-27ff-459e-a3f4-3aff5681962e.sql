-- Add token column to whatsapp_instances table
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS token text;