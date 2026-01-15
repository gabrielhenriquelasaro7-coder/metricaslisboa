-- Add enabled_tabs column for tabs that are hidden by default but explicitly enabled
ALTER TABLE public.user_tab_visibility 
ADD COLUMN IF NOT EXISTS enabled_tabs text[] DEFAULT '{}'::text[];