-- Allow user_id to be nullable for users created via CSV import
-- These users will get their user_id when they're activated
ALTER TABLE public.user_management ALTER COLUMN user_id DROP NOT NULL;